# Radar 184 · Eleições 2026

Para onde foi o dinheiro das emendas parlamentares nos 184 municípios do Ceará.

Site estático, sem banco e sem servidor: os dados viajam junto com a página.
Consulta por duas portas — pela cidade e pelo parlamentar.

**Autor:** Erico Cardoso, estudante de Análise de Dados.
**Situação:** produto em desenvolvimento.

---

## Como publicar

O site é uma pasta de arquivos estáticos. Qualquer hospedagem gratuita serve.

**GitHub Pages** — suba esta pasta para um repositório, vá em *Settings →
Pages*, escolha a branch e a raiz (`/`). Em um ou dois minutos o endereço
fica no ar.

**Netlify** — arraste a pasta inteira para [app.netlify.com/drop](https://app.netlify.com/drop).

Para ver localmente, basta abrir `index.html` no navegador. Não precisa de
servidor: os dados são carregados por `<script src>`, não por `fetch`, justamente
para funcionar com duplo clique.

---

## Estrutura

```
index.html                 casca da página (cabeçalho, busca, rodapé)
assets/
  estilo.css               identidade visual
  app.js                   telas, busca, gráficos, CSV
  dados.js                 window.DADOS — o pacote de dados
  mapa.js                  window.MAPA  — contornos dos 184 municípios
  parl.js                  window.PARL  — foto e situação de mandato
  logo-radar-184.png
construir.py               gera os três arquivos de dados
sql/
  gerar_dados_site.sql     extrai o pacote do Postgres
METODOLOGIA.md             o que os números querem dizer, e o que não querem
```

---

## Como atualizar os dados

A CGU atualiza a base de emendas diariamente. O site é atualizado quando você
refaz o pacote:

**1. Baixar os arquivos anuais da CGU** (um por ano, Brasil inteiro — filtrar UF=CE):
<https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares-documentos>

**2. Recarregar no Postgres** com os scripts de carga do projeto Radar 184
(`sql/CARGAS/06a`, `06b`, `06c` e `08`).

**3. Gerar o pacote.** No SQL Shell (psql):

```
\encoding UTF8
\t on
\a
\o dados.json
\i sql/gerar_dados_site.sql
\o
\t off
\a
```

**4. Atualizar as listas oficiais** (mudam quando um parlamentar sai, entra ou
é substituído):

| arquivo | endereço |
|---|---|
| `camara_deputados.json` | `https://dadosabertos.camara.leg.br/api/v2/deputados?itens=600&ordem=ASC&ordenarPor=nome` |
| `senado_atual.xml` | `https://legis.senado.leg.br/dadosabertos/senador/lista/atual` |
| `malha_ce.json` | `https://servicodados.ibge.gov.br/api/v3/malhas/estados/23?formato=application/vnd.geo+json&intrarregiao=municipio&qualidade=2` (só muda se o IBGE mexer na malha) |

**5. Reconstruir:**

```
python3 construir.py <pasta com os quatro arquivos>
```

Isso reescreve `assets/dados.js`, `assets/mapa.js` e `assets/parl.js`. Suba, e
o site está atualizado.

---

## Correções aplicadas na construção

`construir.py` conserta três defeitos conhecidos da base. **Quando forem
corrigidos no Postgres, estes blocos viram inofensivos** e podem sair:

| # | defeito | conserto |
|---|---|---|
| 1 | `cod_autor = -1` tem o nome com acento quebrado (`Sem informaÃ§Ã£o`) e está tipado como `parlamentar` | vira `Autor não informado`, tipo `nao_informado` |
| 2 | `cod_autor = 7117` ("BANCADA DO PARANA") está tipado como `parlamentar` | vira tipo `bancada` |
| 3 | Eunício Oliveira aparece em dois `cod_autor` (3520 e 2894) | os registros são somados no de maior valor |

O conserto no banco:

```sql
UPDATE radar184.dim_autor_emenda
SET nome      = convert_from(convert_to(nome,'LATIN1'),'UTF8'),
    tipo_ente = 'nao_informado'
WHERE cod_autor = -1;

UPDATE radar184.dim_autor_emenda SET tipo_ente = 'bancada' WHERE cod_autor = 7117;
```

A duplicidade do Eunício é de origem — vem assim da CGU — então a fusão por
nome continua fazendo sentido no `construir.py`.

---

## Fontes

- **Emendas:** Controladoria-Geral da União — Emendas Parlamentares por
  Documentos de Despesa.
- **População e malha municipal:** IBGE.
- **Foto e situação de mandato:** listas oficiais da Câmara dos Deputados e do
  Senado Federal.

---

## Licença

Código sob licença MIT. Os dados são públicos e pertencem às suas fontes
originais; ao reutilizar, cite a CGU, o IBGE, a Câmara e o Senado.
