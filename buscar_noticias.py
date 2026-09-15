# -*- coding: utf-8 -*-
"""
Radar 184 · Eleições 2026 — buscador de notícias por parlamentar

Lê assets/dados.js (window.DADOS, já gerado pelo construir.py), busca as
notícias mais recentes de cada parlamentar individual no Google News RSS
(gratuito, sem chave de API) e grava assets/noticias.js.

Script separado do construir.py de propósito: notícia muda todo dia, dado de
emenda muda uma vez por mês — não faz sentido prender os dois ao mesmo ritmo.

USO

  Testar um nome só, sem gravar nada (faça isso primeiro):
      python buscar_noticias.py --teste "Danilo Forte"

  Buscar para todos os parlamentares e gravar assets/noticias.js:
      python buscar_noticias.py
"""
import json, pathlib, sys, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

LIMITE = 10
PAUSA = 1.2  # segundos entre uma busca e outra — educado com o servidor do Google
SAIDA = pathlib.Path('assets')


def buscar(nome, limite=LIMITE):
    """Busca notícias recentes sobre `nome` no Google News RSS."""
    url = ('https://news.google.com/rss/search?q=' + urllib.parse.quote(nome) +
           '&hl=pt-BR&gl=BR&ceid=BR:pt')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as r:
        raiz = ET.fromstring(r.read())

    itens = []
    for item in raiz.findall('.//item')[:limite]:
        titulo = (item.findtext('title') or '').strip()
        link   = (item.findtext('link') or '').strip()
        data   = (item.findtext('pubDate') or '').strip()
        fonte_el = item.find('source')
        if fonte_el is not None and fonte_el.text:
            fonte = fonte_el.text.strip()
            sufixo = ' - ' + fonte
            if titulo.endswith(sufixo):          # o Google repete a fonte no título
                titulo = titulo[:-len(sufixo)]
        elif ' - ' in titulo:
            titulo, fonte = titulo.rsplit(' - ', 1)
        else:
            fonte = ''
        itens.append({'titulo': titulo, 'link': link, 'fonte': fonte, 'data': data})
    return itens


def escreve_js(nome, var, obj):
    txt = f'window.{var} = ' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ';\n'
    p = SAIDA / nome
    p.write_text(txt, encoding='utf-8')
    print(f'  {p}  {p.stat().st_size:,} bytes'.replace(',', '.'))


def le_dados():
    txt = (SAIDA / 'dados.js').read_text(encoding='utf-8')
    txt = txt[len('window.DADOS = '):].rstrip('\n').rstrip(';')
    return json.loads(txt)


if __name__ == '__main__':
    if '--teste' in sys.argv:
        i = sys.argv.index('--teste')
        nome = sys.argv[i + 1]
        print(f'Buscando "{nome}"...\n')
        for n in buscar(nome):
            print(n['titulo'])
            print(' ', n['fonte'], '·', n['data'])
            print(' ', n['link'])
            print()
        sys.exit(0)

    D = le_dados()
    parlamentares = [a for a in D['autores'] if a['tipo'] == 'parlamentar']
    print(f'{len(parlamentares)} parlamentares individuais na base.\n')

    NOTICIAS = {}
    for i, a in enumerate(parlamentares, 1):
        print(f'[{i}/{len(parlamentares)}] {a["nome"]}')
        try:
            NOTICIAS[str(a['id'])] = buscar(a['nome'])
        except Exception as e:
            print('   erro:', e)
            NOTICIAS[str(a['id'])] = []
        if i < len(parlamentares):
            time.sleep(PAUSA)

    print('\narquivo gerado:')
    escreve_js('noticias.js', 'NOTICIAS', NOTICIAS)
