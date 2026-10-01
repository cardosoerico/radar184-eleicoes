import csv
import pathlib
import sys
import xml.etree.ElementTree as ET
import datetime
import json
from vincular_parlamentares import baixar, CAMARA
import time

INSUMOS = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '../insumos')
HOJE = datetime.date.today().isoformat()
PAUSA = 0.5  # segundos entre requisições para não sobrecarregar os servidores da Câmara e do Senado
LEG_ATUAL = 57
FIM_LEGISLATURA = {53: '2011-01-31', 54: '2015-01-31', 55: '2019-01-31', 56: '2023-01-31'}

def carrega_vinculo():
    """As 78 linhas do vínculo, como lista de dicionários."""
    with open(INSUMOS / 'vinculo_parlamentares.csv', encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f, delimiter=';'))


def mandatos_senado():
    """Código do Senado -> lista de mandatos, cada um com seus períodos de exercício."""
    raiz = ET.fromstring((INSUMOS / 'senado_senadores_53a57.xml').read_bytes())
    saida = {}
    for p in raiz.iter('Parlamentar'):
        cod = p.findtext('IdentificacaoParlamentar/CodigoParlamentar')
        if not cod or cod in saida:
            continue
        mandatos = []
        for m in p.iter('Mandato'):
            exercicios = [{'inicio': e.findtext('DataInicio'),
                           'fim': e.findtext('DataFim'),
                           'causa': e.findtext('DescricaoCausaAfastamento')}
                          for e in m.iter('Exercicio')]
            mandatos.append({'uf': m.findtext('UfParlamentar'),
                             'participacao': m.findtext('DescricaoParticipacao'),
                             'titular': m.findtext('Titular/NomeParlamentar'),
                             'inicio': m.findtext('PrimeiraLegislaturaDoMandato/DataInicio'),
                             'fim': m.findtext('SegundaLegislaturaDoMandato/DataFim'),
                             'exercicios': exercicios})
        saida[cod] = mandatos
    return saida

def identificacao_senado():
    """Código do Senado -> nome, foto, partido e página oficial."""
    raiz = ET.fromstring((INSUMOS / 'senado_senadores_53a57.xml').read_bytes())
    saida = {}
    for i in raiz.iter('IdentificacaoParlamentar'):
        cod = i.findtext('CodigoParlamentar')
        if cod and cod not in saida:
            saida[cod] = {'nome': i.findtext('NomeParlamentar'),
                          'sexo': (i.findtext('SexoParlamentar') or '')[:1],
                          'foto': (i.findtext('UrlFotoParlamentar') or '').replace('http://', 'https://'),
                          'partido': i.findtext('SiglaPartidoParlamentar'),
                          'pagina': (i.findtext('UrlPaginaParlamentar') or '').replace('http://', 'https://')}
    return saida

def situacao_senado(mandatos, hoje=HOJE):
    """Situação na data de hoje, a partir dos períodos de exercício."""
    if not mandatos:
        return {'situacao': 'sem_dados'}
    for m in mandatos:
        if not (m['inicio'] <= hoje <= m['fim']):
            continue
        for e in m['exercicios']:
            if e['inicio'] <= hoje and (e['fim'] is None or e['fim'] >= hoje):
                return {'situacao': 'em_exercicio', 'desde': e['inicio']}
        ultimo = max(m['exercicios'], key=lambda e: e['inicio'], default=None)
        return {'situacao': 'fora_de_exercicio',
                'participacao': m['participacao'],
                'titular': m['titular'],
                'desde': dia_seguinte(ultimo['fim']) if ultimo else None,
                'motivo': ultimo['causa'] if ultimo else None}
    return {'situacao': 'mandato_encerrado', 'fim': max(m['fim'] for m in mandatos)}

def status_camara(vinc):
    """Último status oficial de cada deputado do vínculo (um arquivo por dia)."""
    cache = INSUMOS / f'camara_status_{HOJE}.json'
    if cache.exists():
        print(f'  Câmara: usando {cache.name}')
        return json.loads(cache.read_text(encoding='utf-8'))
    saida = {}
    ids = [v['id_camara'] for v in vinc if v['id_camara']]
    for n, i in enumerate(ids, 1):
        corpo = json.loads(baixar(f'{CAMARA}/{i}'))
        st = corpo['dados']['ultimoStatus']
        saida[i] = {'nome': st['nome'], 'sexo': corpo['dados'].get('sexo'),
                    'partido': st['siglaPartido'], 'uf': st['siglaUf'],
                    'legislatura': st['idLegislatura'], 'data': st['data'],
                    'situacao': st['situacao'], 'condicao': st['condicaoEleitoral'],
                    'foto': st['urlFoto']}
        print(f'  Câmara: {n}/{len(ids)} {st["nome"]}')
        time.sleep(PAUSA)
    cache.write_text(json.dumps(saida, ensure_ascii=False, indent=2), encoding='utf-8')
    return saida

def situacao_camara(s):
    """Situação de hoje a partir do último status da Câmara."""
    if s['legislatura'] == LEG_ATUAL and s['situacao'] == 'Exercício':
        return {'situacao': 'em_exercicio', 'desde': s['data']}
    if s['legislatura'] == LEG_ATUAL:
        return {'situacao': 'fora_de_exercicio', 'participacao': s['condicao'],
                'desde': s['data'], 'motivo': s['situacao']}
    if s['situacao'] in ('Vacância', 'Suplência'):
        fim = s['data']
    else:
        fim = FIM_LEGISLATURA.get(s['legislatura'])
    return {'situacao': 'mandato_encerrado', 'fim': fim, 'como': s['situacao']}

def combinar(sits):
    """Escolhe a situação que vale hoje entre as das duas casas."""
    for tipo in ('em_exercicio', 'fora_de_exercicio'):
        for s in sits:
            if s['situacao'] == tipo:
                return s
    return max(sits, key=lambda s: s.get('fim') or '')

def montar_ficha(v, st, sen, ident):
    """Uma ficha por autor da base, juntando as duas casas."""
    sits, perfil = [], {}
    ficha = {'camara': None, 'senado': None}
    if v['id_camara']:
        s = st[v['id_camara']]
        sits.append(dict(situacao_camara(s), casa='Câmara'))
        perfil['Câmara'] = {'nome': s['nome'], 'sexo': s.get('sexo'), 'foto': s['foto'],
                            'partido': s['partido'], 'uf': s['uf'],
                            'pagina': f"https://www.camara.leg.br/deputados/{v['id_camara']}"}
        ficha['camara'] = {'id': int(v['id_camara']),
                           'legislaturas': [int(l) for l in v['legislaturas_camara'].split(',')]}
    if v['id_senado']:
        mandatos = sen[v['id_senado']]
        sits.append(dict(situacao_senado(mandatos), casa='Senado'))
        recente = max(mandatos, key=lambda m: m['inicio'])
        perfil['Senado'] = dict(ident[v['id_senado']], uf=recente['uf'])
        ficha['senado'] = {'id': int(v['id_senado']),
                           'mandatos': [{'inicio': m['inicio'], 'fim': m['fim'],
                                         'participacao': m['participacao'], 'uf': m['uf'],
                                         'titular': m['titular']}
                                        for m in mandatos]}
    ficha['situacao'] = combinar(sits)
    ficha.update(perfil[ficha['situacao']['casa']])
    return ficha

def grava_js(fichas):
    """Grava assets/parlamentares.js no formato que o site carrega."""
    destino = pathlib.Path('assets/parlamentares.js')
    texto = ('window.PARLAMENTARES = '
             + json.dumps(fichas, ensure_ascii=False, separators=(',', ':')) + ';\n')
    destino.write_text(texto, encoding='utf-8')
    return destino

def dia_seguinte(data):
    """'2026-08-09' -> '2026-08-10'."""
    return (datetime.date.fromisoformat(data) + datetime.timedelta(days=1)).isoformat()

if __name__ == '__main__':
    vinc = carrega_vinculo()
    st = status_camara(vinc)
    sen = mandatos_senado()
    ident = identificacao_senado()
    fichas = {v['id_autor']: montar_ficha(v, st, sen, ident) for v in vinc}
    print(len(fichas), 'fichas')
    print(json.dumps(fichas['4281'], ensure_ascii=False, indent=2))
    print('gravado:', grava_js(fichas))
    print('fichas com sexo:', sum(1 for f in fichas.values() if f.get('sexo')))