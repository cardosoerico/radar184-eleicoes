-- =====================================================================
-- SITE ELEITORAL 2026 — gerador do pacote de dados
--
-- Produz UM único valor JSON com tudo que o site precisa.
-- Período: todo pagamento de emenda registrado na base (02/01/2024 a
-- 27/08/2026). Sem filtro por ano da emenda — ver metodologia.
--
-- COMO RODAR (SQL Shell / psql), gerando o arquivo limpo:
--     \t on
--     \a
--     \o C:/caminho/para/o/repo/dados/dados.json
--     \i C:/caminho/para/gerar_dados_site.sql
--     \o
--     \t off
--     \a
--
-- No pgAdmin: rode normalmente, clique na célula do resultado,
-- copie e cole num arquivo salvo como dados.json (UTF-8).
--
-- Autor: Erico Cardoso
-- =====================================================================

WITH lanc AS (
    SELECT f.cod_ibge,
           f.cod_autor,
           a.nome                                  AS autor,
           a.tipo_ente,
           coalesce(c.funcao, 'Nao informada')     AS funcao,
           f.valor_pago,
           extract(year from f.data_documento)::int AS ano_doc,
           (a.tipo_ente = 'parlamentar')           AS individual
    FROM radar184.fato_emenda f
    JOIN radar184.dim_autor_emenda a     ON a.cod_autor = f.cod_autor
    LEFT JOIN radar184.dim_categoria_emenda c ON c.id = f.id_categoria
),

-- ---- município: total, quanto veio de parlamentar, quanto de coletivo
mun AS (
    SELECT m.cod_ibge, m.nome, m.populacao,
           round(sum(l.valor_pago), 2)                                          AS tot,
           round(coalesce(sum(l.valor_pago) FILTER (WHERE l.individual), 0), 2)     AS ind,
           round(coalesce(sum(l.valor_pago) FILTER (WHERE NOT l.individual), 0), 2) AS col
    FROM lanc l
    JOIN radar184.dim_municipio m ON m.cod_ibge = l.cod_ibge
    GROUP BY 1, 2, 3
),
mun_r AS (
    SELECT *,
           round(tot / nullif(populacao, 0), 2)                       AS pc,
           rank() OVER (ORDER BY tot DESC)                            AS pos,
           rank() OVER (ORDER BY tot / nullif(populacao, 0) DESC)     AS pos_pc
    FROM mun
),

-- ---- município por ano de pagamento, com posição no ranking daquele ano
mun_ano AS (
    SELECT m.cod_ibge, m.nome,
           l.ano_doc                          AS a,
           round(sum(l.valor_pago), 2)        AS v
    FROM lanc l
    JOIN radar184.dim_municipio m ON m.cod_ibge = l.cod_ibge
    WHERE l.ano_doc IS NOT NULL
    GROUP BY 1, 2, 3
),
mun_ano_r AS (
    SELECT *,
           rank() OVER (PARTITION BY a ORDER BY v DESC) AS pos
    FROM mun_ano
),

-- ---- autores: os 77, com o tipo (parlamentar / bancada / comissao / relator)
aut AS (
    SELECT cod_autor, autor, tipo_ente,
           round(sum(valor_pago), 2)  AS tot,
           count(*)                   AS lanc,
           count(DISTINCT cod_ibge)   AS mun
    FROM lanc
    GROUP BY 1, 2, 3
),
aut_r AS (
    SELECT *,
           CASE WHEN tipo_ente = 'parlamentar'
                THEN rank() OVER (PARTITION BY (tipo_ente = 'parlamentar') ORDER BY tot DESC)
           END AS pos
    FROM aut
),

-- ---- cruzamentos
mp AS (SELECT cod_ibge AS m, cod_autor AS p, round(sum(valor_pago), 2) AS v
       FROM lanc WHERE cod_ibge IS NOT NULL GROUP BY 1, 2),

mf AS (SELECT cod_ibge AS m, funcao AS f, round(sum(valor_pago), 2) AS v
       FROM lanc WHERE cod_ibge IS NOT NULL GROUP BY 1, 2),

af AS (SELECT cod_autor AS p, funcao AS f, round(sum(valor_pago), 2) AS v
       FROM lanc GROUP BY 1, 2),

pa AS (SELECT cod_autor AS p, ano_doc AS a, round(sum(valor_pago), 2) AS v
       FROM lanc WHERE ano_doc IS NOT NULL GROUP BY 1, 2),

-- ---- favorecidos (top 5 por município e top 5 por autor)
fav_raw AS (
    SELECT f.cod_ibge, f.cod_autor, fv.favorecido, sum(f.valor_pago) AS v
    FROM radar184.fato_emenda f
    JOIN radar184.emenda_favorecido_raw fv ON fv.cod_documento = f.cod_documento
    WHERE fv.favorecido IS NOT NULL
    GROUP BY 1, 2, 3
),
mfav AS (
    SELECT m, n, v FROM (
        SELECT cod_ibge AS m, favorecido AS n, round(sum(v), 2) AS v,
               row_number() OVER (PARTITION BY cod_ibge ORDER BY sum(v) DESC) AS rn
        FROM fav_raw WHERE cod_ibge IS NOT NULL GROUP BY 1, 2
    ) t WHERE rn <= 5
),
afav AS (
    SELECT p, n, v FROM (
        SELECT cod_autor AS p, favorecido AS n, round(sum(v), 2) AS v,
               row_number() OVER (PARTITION BY cod_autor ORDER BY sum(v) DESC) AS rn
        FROM fav_raw GROUP BY 1, 2
    ) t WHERE rn <= 5
),

tipo AS (
    SELECT tipo_ente AS t,
           round(sum(valor_pago), 2) AS v,
           round(100 * sum(valor_pago) / sum(sum(valor_pago)) OVER (), 1) AS pct
    FROM lanc GROUP BY 1
),

payload AS (
SELECT json_build_object(

  'meta', json_build_object(
      'gerado_em',   current_date,
      'inicio',      (SELECT min(data_documento) FROM radar184.fato_emenda),
      'fim',         (SELECT max(data_documento) FROM radar184.fato_emenda),
      'total_pago',  (SELECT round(sum(valor_pago), 2) FROM lanc),
      'lancamentos', (SELECT count(*) FROM lanc),
      'municipios',  (SELECT count(*) FROM mun_r),
      'autores',     (SELECT count(*) FROM aut_r),
      'por_tipo',    (SELECT json_agg(json_build_object('t', t, 'v', v, 'pct', pct)
                                      ORDER BY v DESC) FROM tipo)),

  'municipios', (SELECT json_agg(json_build_object(
                    'id', cod_ibge, 'nome', nome, 'pop', populacao,
                    'tot', tot, 'ind', ind, 'col', col,
                    'pc', pc, 'pos', pos, 'pos_pc', pos_pc)
                    ORDER BY nome) FROM mun_r),

  'mun_ano',    (SELECT json_agg(json_build_object(
                    'm', cod_ibge, 'a', a, 'v', v, 'pos', pos)
                    ORDER BY a, pos) FROM mun_ano_r),

  'autores',    (SELECT json_agg(json_build_object(
                    'id', cod_autor, 'nome', autor, 'tipo', tipo_ente,
                    'tot', tot, 'lanc', lanc, 'mun', mun, 'pos', pos)
                    ORDER BY tot DESC) FROM aut_r),

  'mun_aut',  (SELECT json_agg(json_build_object('m', m, 'p', p, 'v', v)) FROM mp),
  'mun_func', (SELECT json_agg(json_build_object('m', m, 'f', f, 'v', v)) FROM mf),
  'aut_func', (SELECT json_agg(json_build_object('p', p, 'f', f, 'v', v)) FROM af),
  'aut_ano',  (SELECT json_agg(json_build_object('p', p, 'a', a, 'v', v)) FROM pa),
  'mun_fav',  (SELECT json_agg(json_build_object('m', m, 'n', n, 'v', v)) FROM mfav),
  'aut_fav',  (SELECT json_agg(json_build_object('p', p, 'n', n, 'v', v)) FROM afav)

) AS j)

SELECT j::text FROM payload;
