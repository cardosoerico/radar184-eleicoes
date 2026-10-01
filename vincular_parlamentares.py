"""
RADAR 184 -- LIGAÇÃO DE PARLAMENTARES DA BASE AOS CÓDIGOS OFICIAIS
CÂMARA E SENADO.

"""

import json
import pathlib
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import csv

CAMARA = 'https://dadosabertos.camara.leg.br/api/v2/deputados'
SENADO = 'https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura/53/57'
INSUMOS = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '../insumos')
LEGISLATURAS = [53, 54, 55, 56, 57]
PAUSA = 0.5 
MANUAL = {
    3085: 178940,  # DR. JOAO: emenda de 2016 (leg. 55); o Dr. João-BA só tomou posse em 2019
    2815: 160655,  # RICARDO IZAR: emenda de 2020; o homônimo 73557 só tem a leg. 53 (2007-2011)
    2441: 141464,  # JOSE AIRTON FELIX CIRILO: na Câmara usa o nome parlamentar "José Airton"
}

def norm(s):
    """'Dr. João' -> 'DR JOAO'."""
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c)).upper()
    s = re.sub(r'[^A-Z0-9 ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def baixar(url, aceita='application/json', tentativas=4):
    """Baixa o conteúdo de uma URL e devolve os bytes.
    Se o servidor der erro temporário (5xx) ou demorar demais,
    espera um pouco e tenta de novo."""
    req = urllib.request.Request(url, headers={'Accept': aceita,
                                               'User-Agent': 'radar184-eleicoes'})
    for n in range(1, tentativas + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 or n == tentativas:
                raise
            erro = f'HTTP {e.code}'
        except (urllib.error.URLError, TimeoutError) as e:
            if n == tentativas:
                raise
            erro = str(e)
        espera = 5 * n
        print(f'  tentativa {n} falhou ({erro}); nova tentativa em {espera}s')
        time.sleep(espera)

def lista_camara():
    """Todos os deputados que tomaram posse nas legislaturas 53-57, um por ID"""
    cache = INSUMOS / 'camara_deputados_53a57.json'
    if cache.exists():
        print(f' Câmara: usando {cache.name} já baixado')
        linhas = json.loads(cache.read_text(encoding='utf-8'))
    else: 
        linhas, pagina = [], 1
        filtro = ''.join(f'&idLegislatura={l}' for l in LEGISLATURAS)
        while True:
            url = f'{CAMARA}?itens=100&pagina={pagina}&ordem=ASC&ordenarPor=nome{filtro}'
            corpo = json.loads(baixar(url))
            linhas.extend(corpo['dados'])
            if not any(l['rel'] == 'next' for l in corpo['links']):
                break
            pagina += 1
            time.sleep(PAUSA)
        cache.write_text(json.dumps(linhas, ensure_ascii=False, indent=2), encoding='utf-8')

    deps = {}
    for d in linhas:
        x = deps.setdefault(d['id'], {'id': d['id'], 'nome': d['nome'], 'uf': d['siglaUf'],
                                       'partido': d['siglaPartido'], 'legs': set()})
        x['legs'].add(d['idLegislatura'])
    return list(deps.values())


def lista_senado():
    cache = INSUMOS / 'senado_senadores_53a57.xml'
    if cache.exists():
        print(f' Senado: usando {cache.name} já baixado')
        xml = cache.read_bytes()
    else:
        xml = baixar(SENADO, aceita='application/xml')
        cache.write_bytes(xml)

    sens = {}
    for i in ET.fromstring(xml).iter('IdentificacaoParlamentar'):
        cod = i.findtext('CodigoParlamentar')
        if cod and cod not in sens: 
            sens[cod] = {'id': cod,
                         'nome': i.findtext('NomeParlamentar') or '',
                         'nome_completo': i.findtext('NomeCompletoParlamentar') or '',
                         'uf': i.findtext('UfParlamentar') or '',
                         'partido': i.findtext('SiglaPartidoParlamentar') or ''}
    return list(sens.values())

def carrega_autores():
    texto = pathlib.Path('assets/dados.js').read_text(encoding='utf-8')
    inicio = texto.index('=') + 1
    dados = json.loads(texto[inicio:].strip().rstrip(';'))
    return sorted([a for a in dados['autores'] if a['tipo'] == 'parlamentar'],
                  key=lambda a: a['nome'])

def indexa(itens, *campos):
    """Monta um dicionário: nome normalizado -> lista de quem tem esse nome."""
    idx = {}
    for it in itens:
        for c in campos:
            k = norm(it.get(c, ''))
            if k and it not in idx.setdefault(k, []):
                idx[k].append(it)
    return idx


def casar(autores, deps, sens):
    """Para cada autor da base, procura o nome nas duas listas oficiais."""
    ic = indexa(deps, 'nome')
    i_s = indexa(sens, 'nome', 'nome_completo')
    saida = []
    for a in autores:
        k = norm(a['nome'])
        c, s = ic.get(k, []), i_s.get(k, [])
        lin = {'id_autor': a['id'], 'nome_base': a['nome'],
               'id_camara': '', 'nome_camara': '', 'uf_camara': '', 'legislaturas_camara': '',
               'id_senado': '', 'nome_senado': '', 'situacao': '', 'opcoes': ''}
        if len(c) > 1 or len(s) > 1:
            lin['situacao'] = 'ambiguo'
            lin['opcoes'] = ' | '.join(
                [f"Câmara {x['id']} {x['nome']}-{x['uf']}" for x in c] +
                [f"Senado {x['id']} {x['nome']}" for x in s])
        else:
            if c:
                x = c[0]
                lin['id_camara'] = x['id']
                lin['nome_camara'] = x['nome']
                lin['uf_camara'] = x['uf']
                lin['legislaturas_camara'] = ','.join(str(l) for l in sorted(x['legs']))
            if s:
                lin['id_senado'] = s[0]['id']
                lin['nome_senado'] = s[0]['nome']
            if c and s:
                lin['situacao'] = 'camara+senado'
            elif c:
                lin['situacao'] = 'camara'
            elif s:
                lin['situacao'] = 'senado'
            else:
                lin['situacao'] = 'sem_par'
        saida.append(lin)
    return saida

def aplica_manual(linhas, deps):
    """Preenche os casos que a regra automática não resolveu."""
    por_id = {d['id']: d for d in deps}
    for lin in linhas:
        if lin['id_autor'] not in MANUAL:
            continue
        x = por_id[MANUAL[lin['id_autor']]]
        lin['id_camara'] = x['id']
        lin['nome_camara'] = x['nome']
        lin['uf_camara'] = x['uf']
        lin['legislaturas_camara'] = ','.join(str(l) for l in sorted(x['legs']))
        lin['situacao'] = 'camara_manual'
        lin['opcoes'] = ''
    return linhas


def grava_csv(linhas):
    destino = INSUMOS / 'vinculo_parlamentares.csv'
    with open(destino, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(linhas[0].keys()), delimiter=';')
        w.writeheader()
        w.writerows(linhas)
    return destino

if __name__ == '__main__':
    autores = carrega_autores()
    deps = lista_camara()
    sens = lista_senado()
    linhas = aplica_manual(casar(autores, deps, sens), deps)
    contagem = {}
    for l in linhas:
        contagem[l['situacao']] = contagem.get(l['situacao'], 0) + 1
    print(contagem)
    pendentes = [l['nome_base'] for l in linhas if l['situacao'] in ('ambiguo', 'sem_par')]
    print('pendentes:', pendentes if pendentes else 'nenhum')
    print('gravado:', grava_csv(linhas))




    