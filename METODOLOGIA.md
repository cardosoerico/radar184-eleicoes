# Metodologia

Este documento é gerado junto com o site, a partir do mesmo pacote de dados.
Se um número aqui divergir de um número na tela, é erro — avise.

## O que este site mostra

Todo **pagamento** de emenda parlamentar registrado nos 184 municípios do
Ceará entre **2014-05-27** e **2026-08-27**.

- 84.104 lançamentos
- R$ 11.846.993.983,68 pagos
- 184 municípios
- 98 autores de emenda

## Por que o recorte é esse

A base vem dos arquivos anuais da CGU, um por ano, de 2014 (o mais antigo
disponível no Portal da Transparência) a 2026. O de 2026 está incompleto
porque o ano ainda corre.

Os arquivos são separados pelo **ano do documento de pagamento**, não pelo ano
da emenda. Não filtramos pelo ano da emenda, porque isso jogaria fora
pagamentos que **de fato aconteceram** no período, só porque a emenda era de
outro ano. O recorte é o próprio conjunto de arquivos: tudo que foi pago
entre 2014 e hoje.

Isso tem uma consequência que precisa estar clara:

> **A data do pagamento não é a data da emenda.** Um pagamento de 2025 pode
> estar quitando uma emenda aprovada anos antes.

## Um documento, vários municípios

Na base da CGU, um mesmo documento de pagamento pode dividir o dinheiro entre
vários municípios e várias emendas. Cada lançamento deste site é uma
combinação única de **documento + emenda + autor + município**, para que cada
real fique no município e no autor certos. Somar por documento, e não por essa
combinação, atribuiria o dinheiro ao lugar errado.

## Nem toda emenda tem dono

Esta é a distinção que o site faz em toda tela, e a razão de existirem duas
cores fixas: **azul** para dinheiro destinado por um parlamentar com nome,
**laranja** para decisão coletiva.

| tipo de autor | valor pago | fatia |
|---|---|---|
| parlamentar | R$ 6.116.439.037,67 | 51,6% |
| bancada | R$ 2.369.949.962,37 | 20,0% |
| comissao | R$ 1.389.304.257,32 | 11,7% |
| relator | R$ 1.340.354.002,74 | 11,3% |
| nao_informado | R$ 630.946.723,58 | 5,3% |

Emendas de **bancada** são decisão da bancada estadual inteira. Emendas de
**comissão** são decisão de um colegiado da Câmara. Emendas de **relator** são
distribuídas pelo relator-geral do Orçamento. Nenhuma delas tem um
parlamentar identificado por trás no registro da CGU. Somar tudo junto e
atribuir a um deputado seria erro grosseiro — e é o erro mais comum quando se
noticia emenda.

**Autor não informado** reúne pagamentos em que a própria CGU não registra o
autor — concentrados nos anos mais antigos da base.

## O selo de mandato

A etiqueta com partido e estado aparece só em quem está **em exercício hoje**,
conferido nome a nome contra as listas oficiais da Câmara e do Senado.
Hoje isso vale para **27 dos 78** parlamentares que aparecem na base.

Quem não tem etiqueta pode ter deixado o mandato, estar licenciado ou ter sido
substituído por suplente. **A ausência de etiqueta não afirma nada** e não é
avaliação. Não escrevemos "ex-deputado" em ninguém, porque a lista oficial é um
retrato de hoje, não um histórico.

Pelo mesmo motivo, parlamentares de outros estados que destinaram emenda ao
Ceará aparecem normalmente, com a sigla do estado deles.

## Três limites

1. **Nem toda emenda tem dono** — 51,6% do valor tem autor
   individual; o resto é decisão coletiva ou sem identificação.
2. **Quem não teve mandato não aparece.** Candidato sem mandato federal no
   período não teve emenda a destinar. Ausência aqui não é avaliação.
3. **Só emendas federais.** Este site não trata de deputado estadual,
   governador nem prefeito.

## O que os números NÃO são

- **Não são "obras entregues".** São pagamentos registrados. O que aconteceu
  com o dinheiro depois é outra apuração.
- **Não são taxa de execução.** Na base da CGU, empenho e pagamento vivem em
  documentos separados — nenhuma linha tem os dois valores ao mesmo tempo.
  Dividir um pelo outro produz um número sem significado, que pode até passar
  de 100%.
- **Não são avaliação de desempenho.** Cota de emenda varia por cargo e por
  ano: senador tem cota muito maior que deputado, e quem teve mais mandatos no
  período teve mais anos para destinar. Comparar pelo valor bruto compara cotas
  e tempo de mandato, não empenho de trabalho.

## Quem recebeu

O destinatário é o registrado no documento de despesa. Em geral é a prefeitura,
um fundo municipal ou o banco que operacionaliza o repasse — por isso o Banco
do Brasil aparece com frequência. Isso não significa que o banco ficou com o
dinheiro; significa que o repasse passou por ele.

## Fontes

| dado | fonte |
|---|---|
| Emendas por documento de despesa | Controladoria-Geral da União — portaldatransparencia.gov.br |
| População e malha municipal | IBGE |
| Foto e situação de mandato — deputados | Câmara dos Deputados, dados abertos |
| Foto e situação de mandato — senadores | Senado Federal, dados abertos |

## Reprodutibilidade

A consulta SQL que extrai o pacote está em `sql/gerar_dados_site.sql`. O script
que monta os arquivos do site está em `construir.py`. Os dois estão no
repositório: qualquer pessoa pode baixar os mesmos arquivos da CGU e chegar aos
mesmos números.
