# -*- coding: utf-8 -*-
"""
Radar 184 · Eleições 2026 — construtor do pacote de dados do site.

Lê:  dados.json          (gerado por sql/gerar_dados_site.sql)
     malha_ce.json       (IBGE, malha do CE por município)
     camara_deputados.json / senado_atual.xml  (listas oficiais)

Escreve: assets/dados.js, assets/mapa.js, assets/parl.js

CORREÇÕES aplicadas aqui porque a base ainda tem três defeitos conhecidos.
Quando forem corrigidos no Postgres, estes três blocos viram inofensivos.
  1. cod_autor -1  : nome com acento quebrado e tipo 'parlamentar'
  2. cod_autor 7117: "BANCADA DO PARANA" tipada como 'parlamentar'
  3. Eunício Oliveira duplicado em dois cod_autor (3520 e 2894)
"""
import json, math, re, unicodedata, pathlib, sys, xml.etree.ElementTree as ET

ENTRADA = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
SAIDA   = pathlib.Path('assets'); SAIDA.mkdir(exist_ok=True)

def achar(nome):
    """Procura o arquivo na pasta de entrada e nas subpastas usuais."""
    for c in (ENTRADA/nome, ENTRADA/'SITE'/nome, ENTRADA/'DADOS'/nome, ENTRADA/'SITE'/'DADOS'/nome):
        if c.exists(): return c
    raise SystemExit(f'nao encontrei {nome} a partir de {ENTRADA}')

def norm(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'\s+', ' ', re.sub(r'[^A-Za-z0-9 ]', ' ', s).upper()).strip()

def escreve_js(nome, var, obj):
    txt = f'window.{var} = ' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ';\n'
    p = SAIDA / nome; p.write_text(txt, encoding='utf-8')
    print(f'  {p}  {p.stat().st_size:,} bytes'.replace(',', '.'))

# ─────────────────────────────── 1. dados ────────────────────────────────
D = json.loads(achar('dados.json').read_text(encoding='utf-8'))

# (1) autor não informado
for a in D['autores']:
    if a['id'] == -1:
        a['nome'] = 'Autor não informado'
        a['tipo'] = 'nao_informado'
# (2) bancada tipada errado
for a in D['autores']:
    if a['tipo'] == 'parlamentar' and norm(a['nome']).startswith('BANCADA'):
        a['tipo'] = 'bancada'
# (3) duplicados por nome — o de maior valor absorve os outros
porNome, alias = {}, {}
for a in sorted(D['autores'], key=lambda x: -x['tot']):
    k = (a['tipo'], norm(a['nome']))
    if k in porNome:
        p = porNome[k]
        alias[a['id']] = p['id']
        p['tot']  = round(p['tot'] + a['tot'], 2)
        p['lanc'] += a['lanc']
        p['mun']   = max(p['mun'], a['mun'])
    else:
        porNome[k] = a
D['autores'] = sorted(porNome.values(), key=lambda x: -x['tot'])
if alias:
    print('  autores fundidos:', alias)
    for bloco, campo in (('mun_aut','p'), ('aut_func','p'), ('aut_ano','p'), ('aut_fav','p')):
        junta = {}
        for r in D[bloco]:
            r[campo] = alias.get(r[campo], r[campo])
            chave = tuple(r[k] for k in r if k != 'v')
            if chave in junta: junta[chave]['v'] = round(junta[chave]['v'] + r['v'], 2)
            else: junta[chave] = r
        D[bloco] = list(junta.values())

# ranking individual refeito depois das correções
ind = sorted([a for a in D['autores'] if a['tipo'] == 'parlamentar'], key=lambda x: -x['tot'])
for i, a in enumerate(ind, 1): a['pos'] = i
for a in D['autores']:
    if a['tipo'] != 'parlamentar': a['pos'] = None

# ranking de parlamentares por ano de pagamento — feito aqui (não no SQL) porque
# precisa vir depois da fusão de duplicados acima, senão o ranking sai errado
tipoPorId = {a['id']: a['tipo'] for a in D['autores']}
porAno = {}
for r in D['aut_ano']:
    if tipoPorId.get(r['p']) == 'parlamentar':
        porAno.setdefault(r['a'], []).append(r)
for linhas in porAno.values():
    linhas.sort(key=lambda x: -x['v'])
    for i, r in enumerate(linhas, 1): r['pos'] = i
for r in D['aut_ano']:
    r.setdefault('pos', None)

# fatias por tipo, recalculadas
tot = sum(a['tot'] for a in D['autores'])
fatias = {}
for a in D['autores']:
    fatias[a['tipo']] = round(fatias.get(a['tipo'], 0) + a['tot'], 2)
D['meta']['por_tipo'] = [{'t': t, 'v': v, 'pct': round(100*v/tot, 1)}
                         for t, v in sorted(fatias.items(), key=lambda kv: -kv[1])]
D['meta']['individual'] = round(fatias.get('parlamentar', 0), 2)
D['meta']['coletivo']   = round(tot - fatias.get('parlamentar', 0), 2)
print('  fatias:', {f['t']: f['pct'] for f in D['meta']['por_tipo']})

# ─────────────────────────────── 2. mapa ─────────────────────────────────
M = json.loads(achar('malha_ce.json').read_text(encoding='utf-8'))
def aneis(g): return g['coordinates'] if g['type'] == 'Polygon' else [r for p in g['coordinates'] for r in p]
xs = [x for f in M['features'] for r in aneis(f['geometry']) for x, _ in r]
ys = [y for f in M['features'] for r in aneis(f['geometry']) for _, y in r]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
kx = math.cos(math.radians((y0 + y1) / 2)); W = 100.0
H = W * ((y1 - y0) / ((x1 - x0) * kx))
def px(x, y): return ((x - x0) / (x1 - x0) * W, (y1 - y) / (y1 - y0) * H)
def caminho(g):
    return ''.join('M' + 'L'.join(f'{a:.2f} {b:.2f}' for a, b in (px(x, y) for x, y in r)) + 'Z'
                   for r in aneis(g))
mun = {f['properties']['codarea']: caminho(f['geometry']) for f in M['features']}
cen = {f['properties']['codarea']: [round(v, 2) for v in px(*f['properties']['centroide'])]
       for f in M['features']}
MAPA = {'vb': f'0 0 {W:.0f} {H:.1f}', 'malha': ''.join(mun.values()), 'mun': mun, 'cen': cen}

# ──────────────────────── 3. parlamentares (foto/selo) ───────────────────
idx = {}
for d in json.loads(achar('camara_deputados.json').read_text(encoding='utf-8'))['dados']:
    idx[norm(d['nome'])] = {'casa': 'Câmara', 'foto': d['urlFoto'], 'nome': d['nome'],
                            'sigla': f"{d['siglaPartido']}-{d['siglaUf']}"}
for p in ET.fromstring(achar('senado_atual.xml').read_text(encoding='utf-8')).findall('.//Parlamentar'):
    i = p.find('IdentificacaoParlamentar')
    if i is None: continue
    idx[norm(i.findtext('NomeParlamentar'))] = {
        'casa': 'Senado', 'nome': i.findtext('NomeParlamentar'),
        'foto': (i.findtext('UrlFotoParlamentar') or '').replace('http://', 'https://'),
        'sigla': f"{i.findtext('SiglaPartidoParlamentar')}-{i.findtext('UfParlamentar')}"}

PARL, achou = {}, 0
for a in D['autores']:
    if a['tipo'] != 'parlamentar': continue
    m = idx.get(norm(a['nome']))
    if m: PARL[str(a['id'])] = m; achou += 1
print(f'  em exercício hoje: {achou} de {len(ind)} parlamentares')

# ─────────────────────────────── grava ───────────────────────────────────
print('\narquivos gerados:')
escreve_js('dados.js', 'DADOS', D)
escreve_js('mapa.js',  'MAPA',  MAPA)
escreve_js('parl.js',  'PARL',  PARL)
