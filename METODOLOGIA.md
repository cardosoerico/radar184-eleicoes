# Metodologia

Este documento é gerado junto com o site, a partir do mesmo pacote de dados.
Se um número aqui divergir de um número na tela, é erro — avise.

## O que este site mostra

Todo **pagamento** de emenda parlamentar registrado nos 184 municípios do
Ceará entre **2024-01-02** e **2026-08-27**.

- 24.806 lançamentos
- R$ 5.383.091.984,53 pagos
- 184 municípios
- 77 autores de emenda

## Por que o recorte é esse

A base vem de três arquivos anuais da CGU — 2024, 2025 e 2026. Não existe
arquivo de 2023 carregado, e o de 2026 está incompleto porque o ano ainda corre.

Poderíamos ter filtrado pelo **ano da emenda** para bater com o mandato
2023-2026. Não filtramos, por dois motivos:

1. As emendas de 2023 apareceriam pela metade — só a parte paga de 2024 em
   diante.
2. Jogaríamos fora pagamentos que **de fato aconteceram** na janela, só porque
   a emenda era antiga. Dentro desses arquivos há emendas de até 2014 sendo
   pagas agora.

Então o recorte é o próprio conjunto de arquivos: tudo que foi pago no período.
Isso tem uma consequência que precisa estar clara:

> **A data do pagamento não é a data da emenda.** Um pagamento de 2025 pode
> estar quitando uma emenda aprovada anos antes.

## Nem toda emenda tem dono

Esta é a distinção que o site faz em toda tela, e a razão de existirem duas
cores fixas: **azul** para dinheiro destinado por um parlamentar com nome,
**laranja** para decisão coletiva.

| tipo de autor | valor pago | fatia |
|---|---|---|
| parlamentar | R$ 2.871.377.947,17 | 53,3% |
| comissao | R$ 1.372.021.841,75 | 25,5% |
| bancada | R$ 1.041.344.044,85 | 19,3% |
| relator | R$ 92.902.920,40 | 1,7% |
| nao_informado | R$ 5.445.230,36 | 0,1% |

Emendas de **bancada** são decisão da bancada estadual inteira. Emendas de
**comissão** são decisão de um colegiado da Câmara. Nenhuma das duas tem um
parlamentar por trás. Somar tudo junto e atribuir a um deputado seria erro
grosseiro — e é o erro mais comum quando se noticia emenda.

## O selo de mandato

A etiqueta com partido e estado aparece só em quem está **em exercício hoje**,
conferido nome a nome contra as listas oficiais da Câmara e do Senado.
Hoje isso vale para **24 dos 59** parlamentares que aparecem na base.

Quem não tem etiqueta pode ter deixado o mandato, estar licenciado ou ter sido
substituído por suplente. **A ausência de etiqueta não afirma nada** e não é
avaliação. Não escrevemos "ex-deputado" em ninguém, porque a lista oficial é um
retrato de hoje, não um histórico.

Pelo mesmo motivo, parlamentares de outros estados que destinaram emenda ao
Ceará aparecem normalmente, com a sigla do estado deles.

## Três limites

1. **Nem toda emenda tem dono** — 53,3% do valor tem autor
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
- **Não são avaliação de desempenho.** Cota de emenda varia por cargo: senador
  tem cota muito maior que deputado. Comparar um senador com um deputado pelo
  valor bruto compara cotas, não empenho de trabalho.

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
