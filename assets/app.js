/* ================================================================
   Radar 184 · Eleições 2026 — aplicação
   Lê window.DADOS, window.MAPA e window.PARL (assets/*.js).
   Rotas por hash:  #/            capa
                    #/m/<ibge>    município
                    #/p/<autor>   parlamentar
   ================================================================ */
(function () {
'use strict';

var D = window.DADOS, MAPA = window.MAPA, PARL = window.PARL || {}, NOTICIAS = window.NOTICIAS || {};
var AZUL = '#2451F5', LARANJA = '#F5730F';

/* ---------- formatação ---------- */
var fBRL  = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'});
var fBRL0 = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
var fNUM  = new Intl.NumberFormat('pt-BR');
function brl(v){ return fBRL.format(v||0); }
function brl0(v){ return fBRL0.format(v||0); }
function num(v){ return fNUM.format(v||0); }
function pct(a,b){ return b ? (100*a/b).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%' : '—'; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function data(iso){
  if(!iso) return '';
  var p = String(iso).slice(0,10).split('-');
  var m = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
           'setembro','outubro','novembro','dezembro'];
  return Number(p[2]) + ' de ' + m[Number(p[1])-1] + ' de ' + p[0];
}
function dataNoticia(rfc822){
  var d = new Date(rfc822);
  if(isNaN(d)) return '';
  return d.toLocaleDateString('pt-BR', {day:'numeric', month:'long', year:'numeric'});
}
function titulo(s){
  var min = {'de':1,'da':1,'do':1,'das':1,'dos':1,'e':1,'a':1,'o':1};
  return String(s).toLowerCase().split(/\s+/).map(function(w,i){
    if(i && min[w]) return w;
    if(w.length<=1) return w.toUpperCase();
    return w.charAt(0).toUpperCase()+w.slice(1);
  }).join(' ').replace(/(^|\s)(Dr|Dra|Sr|Sra)\b\.?/g, '$1$2.');
}
function slug(s){
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
         .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function iniciais(nome){
  var p = String(nome).replace(/^(Dr|Dra)\.?\s+/i,'').split(/\s+/).filter(function(w){return w.length>2;});
  return (p.slice(0,2).map(function(w){return w[0];}).join('') || '?').toUpperCase();
}

/* ---------- índices ---------- */
var MUN = {}, AUT = {};
D.municipios.forEach(function(m){ MUN[m.id] = m; });
D.autores.forEach(function(a){ AUT[a.id] = a; });
function ehIndividual(a){ return a && a.tipo === 'parlamentar'; }
function nomeAutor(a){
  if(!a) return 'Autor não informado';
  var p = PARL[a.id];
  return (p && p.nome) ? p.nome : titulo(a.nome);   // grafia oficial quando existe
}

function agrupa(lista, chave){
  var r = {};
  lista.forEach(function(o){ (r[o[chave]] = r[o[chave]] || []).push(o); });
  return r;
}
var porMun  = agrupa(D.mun_aut, 'm');
var porAut  = agrupa(D.mun_aut, 'p');
var funcMun = agrupa(D.mun_func, 'm');
var funcAut = agrupa(D.aut_func, 'p');
var anoAut  = agrupa(D.aut_ano, 'p');
var favMun  = agrupa(D.mun_fav, 'm');
var favAut  = agrupa(D.aut_fav, 'p');
function desc(a,b){ return b.v - a.v; }

/* ---------- ranking por ano (capa) ---------- */
var porAnoMun = agrupa(D.mun_ano || [], 'a');
var porAnoAut = agrupa((D.aut_ano || []).filter(function(r){ return r.pos; }), 'a');
function porPos(a,b){ return a.pos - b.pos; }

function itensRankMun(lista){
  return lista.slice().sort(porPos).map(function(r){
    var m = MUN[r.m];
    return {nome: m ? m.nome : 'Aplicação estadual', v: r.v, href: m ? '#/m/'+r.m : ''};
  });
}
function itensRankAut(lista){
  return lista.slice().sort(porPos).map(function(r){
    var a = AUT[r.p], p = PARL[r.p];
    return {nome: nomeAutor(a), v: r.v, cor: AZUL, retrato: true,
            foto: p && p.foto, sigla: p && p.sigla, href: '#/p/'+r.p};
  });
}

/* abas em CSS puro (radio + label), sem JS de estado — funciona com duplo clique no arquivo */
function secaoRankingAno(idBase, titulo, dica, porAno, montaItens){
  var anos = Object.keys(porAno).map(Number).sort();
  if(!anos.length) return '';
  var padrao = anos.length > 1 ? anos[anos.length-2] : anos[0];
  var abas = anos.map(function(a){
    var id = idBase+'-'+a;
    return '<input type="radio" name="'+idBase+'-ano" id="'+id+'" class="aba-radio ano-'+a+'"' +
           (a === padrao ? ' checked' : '') + '>' +
           '<label for="'+id+'" class="aba">'+a+'</label>';
  }).join('');
  var paineis = anos.map(function(a){
    return '<div class="painel-ano painel-'+a+'">' + barras(montaItens(porAno[a] || []), 10) + '</div>';
  }).join('');
  return '<section><h2 class="sec">'+esc(titulo)+'</h2><p class="dica">'+dica+'</p>' +
         '<div class="secao-ano">' + abas + paineis + '</div></section>';
}

/* ---------- tooltip ---------- */
var dica = document.getElementById('dica');
function liga(el, texto){
  el.addEventListener('mouseenter', function(){ dica.textContent = texto; dica.style.opacity = 1; });
  el.addEventListener('mousemove', function(e){
    dica.style.left = Math.min(e.clientX+14, innerWidth - dica.offsetWidth - 10) + 'px';
    dica.style.top  = (e.clientY+18) + 'px';
  });
  el.addEventListener('mouseleave', function(){ dica.style.opacity = 0; });
}

/* ---------- CSV ---------- */
function csv(nomeArq, cabec, linhas){
  var corpo = [cabec].concat(linhas).map(function(l){
    return l.map(function(c){
      c = String(c==null?'':c);
      return /[";\n]/.test(c) ? '"'+c.replace(/"/g,'""')+'"' : c;
    }).join(';');
  }).join('\r\n');
  var url = URL.createObjectURL(new Blob(['﻿'+corpo], {type:'text/csv;charset=utf-8'}));
  var a = document.createElement('a');
  a.href = url; a.download = nomeArq; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
}
function botaoCSV(rotulo, arq, cabec, linhas){
  return '<button class="baixar" data-csv="'+esc(arq)+'">'+esc(rotulo)+'</button>' +
         '<script type="application/json" data-csv-de="'+esc(arq)+'">' +
         JSON.stringify({c:cabec, l:linhas}) + '<\/script>';
}
document.addEventListener('click', function(e){
  var b = e.target.closest('[data-csv]'); if(!b) return;
  var s = document.querySelector('[data-csv-de="'+b.dataset.csv+'"]');
  if(!s) return;
  var d = JSON.parse(s.textContent);
  csv(b.dataset.csv, d.c, d.l);
});

/* ---------- blocos reutilizáveis ---------- */
function svgMapa(ids, rotulo){
  var destaque = ids.map(function(id){
    var p = MAPA.mun[id]; return p ? '<path d="'+p+'" fill="'+LARANJA+'" stroke="#FFFFFF" stroke-width="0.35"/>' : '';
  }).join('');
  var anel = '';
  if(ids.length === 1 && MAPA.cen[ids[0]]){
    var c = MAPA.cen[ids[0]];
    anel = '<circle cx="'+c[0]+'" cy="'+c[1]+'" r="7.5" fill="none" stroke="'+LARANJA+'" stroke-width="1.1" opacity=".85"/>';
  }
  return '<figure class="mapa"><svg viewBox="'+MAPA.vb+'" role="img" aria-label="'+esc(rotulo)+'">' +
         '<path d="'+MAPA.malha+'" fill="#EEF0F5" stroke="#FFFFFF" stroke-width="0.25"/>' +
         destaque + anel + '</svg><figcaption>'+esc(rotulo)+'</figcaption></figure>';
}

function heroi(rot, valor, pe){
  return '<div class="heroi"><p class="rot">'+esc(rot)+'</p>' +
         '<p class="num">'+brl(valor)+'</p><p class="pe">'+esc(pe)+'</p></div>';
}
function tile(rot, valor, pe){
  return '<div class="tile"><p class="rot">'+esc(rot)+'</p><p class="num">'+valor+'</p>' +
         (pe ? '<p class="pe">'+esc(pe)+'</p>' : '') + '</div>';
}

function blocoPilha(individual, coletivo){
  var tot = individual + coletivo;
  if(!tot) return '';
  var seg = [['Parlamentar com nome', individual, AZUL], ['Decisão coletiva', coletivo, LARANJA]];
  return '<div class="pilha">' + seg.map(function(s){
      return '<span style="width:'+(100*s[1]/tot)+'%;background:'+s[2]+'" data-t="'+
             esc(s[0]+' — '+brl(s[1])+' · '+pct(s[1],tot))+'"></span>';
    }).join('') + '</div><div class="chaves">' + seg.map(function(s){
      return '<div class="chave"><span class="ponto" style="background:'+s[2]+'"></span><div>' +
             '<p class="t">'+s[0]+' · '+pct(s[1],tot)+'</p><p class="v">'+brl0(s[1])+'</p></div></div>';
    }).join('') + '</div>';
}

/* barras horizontais. itens: {nome, v, cor, href, foto, sigla, sufixo} */
function barras(itens, teto){
  if(!itens.length) return '<p class="vazio">Sem lançamento registrado no período.</p>';
  var sobra = 0;
  if(teto && itens.length > teto){ sobra = itens.length - teto; itens = itens.slice(0, teto); }
  var max = Math.max.apply(null, itens.map(function(i){ return i.v; })) || 1;
  return itens.map(function(i){
    var av = '';
    if(i.retrato){
      av = i.foto
        ? '<img class="retrato" src="'+esc(i.foto)+'" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'iniciais\',textContent:\''+esc(iniciais(i.nome))+'\'}))">'
        : '<span class="iniciais">'+(i.coletiva ? '&#183;&#183;' : esc(iniciais(i.nome)))+'</span>';
    }
    var dentro =
      '<div class="cab"><span class="quem">'+av+'<span class="nome">'+esc(i.nome) +
      (i.sufixo ? ' <em>· '+esc(i.sufixo)+'</em>' : '') +
      (i.sigla ? '<span class="chip">'+esc(i.sigla)+'</span>' : '') +
      '</span></span><span class="val">'+brl0(i.v)+'</span></div>' +
      '<div class="trilho"><div class="barra" style="width:'+(100*i.v/max)+'%;background:'+
      (i.cor||AZUL)+'"></div></div>';
    var t = esc(i.nome + ' — ' + brl(i.v));
    return i.href
      ? '<a class="linha" href="'+i.href+'" data-t="'+t+'">'+dentro+'</a>'
      : '<div class="linha" data-t="'+t+'">'+dentro+'</div>';
  }).join('') + (sobra
      ? '<p class="nota">Mais ' + num(sobra) + (sobra === 1 ? ' item' : ' itens') +
        ' com valor menor — a lista inteira está na tabela abaixo.</p>'
      : '');
}

function colunas(serie){
  if(!serie.length) return '<p class="vazio">Sem série anual disponível.</p>';
  var max = Math.max.apply(null, serie.map(function(s){ return s.v; })) || 1;
  return '<div class="colunas">' + serie.map(function(s){
      return '<div class="col" data-t="'+esc(s.a+' — '+brl(s.v))+'">' +
             '<span class="v">'+brl0(s.v)+'</span>' +
             '<div class="mark" style="height:'+Math.max(3, 100*s.v/max*0.78)+'%"></div></div>';
    }).join('') + '</div><div class="eixo">' +
    serie.map(function(s){ return '<span>'+s.a+'</span>'; }).join('') + '</div>';
}

function blocoNoticias(id){
  var itens = NOTICIAS[id] || [];
  if(!itens.length){
    return '<div class="quadro-noticias"><p class="vazio">Nenhuma notícia encontrada no Google ' +
           'Notícias para este nome.</p></div>';
  }
  return '<div class="quadro-noticias"><ul class="noticias">' + itens.map(function(n, i){
    return '<li><a href="'+esc(n.link)+'" target="_blank" rel="noopener noreferrer">' +
      '<span class="num-noticia">'+(i+1)+'</span>' +
      '<span class="corpo-noticia">' +
        '<span class="titulo-noticia">'+esc(n.titulo)+'</span>' +
        '<span class="meta-noticia">' +
          (n.fonte ? '<span class="fonte-noticia">'+esc(n.fonte)+'</span>' : '') +
          (n.data ? '<span class="data-noticia">'+esc(dataNoticia(n.data))+'</span>' : '') +
        '</span>' +
      '</span>' +
      '<span class="seta-noticia" aria-hidden="true">↗</span>' +
      '</a></li>';
  }).join('') + '</ul></div>';
}

function tabela(cabec, linhas){
  return '<div class="rolagem"><table class="simples"><thead><tr>' +
    cabec.map(function(c,i){ return '<th'+(i?' class="n"':'')+'>'+esc(c)+'</th>'; }).join('') +
    '</tr></thead><tbody>' + linhas.map(function(l){
      return '<tr>' + l.map(function(c,i){ return '<td'+(i?' class="n"':'')+'>'+esc(c)+'</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
}

/* ---------- rodapé ---------- */
function rodape(){
  var t = D.meta.por_tipo, m = {};
  t.forEach(function(x){ m[x.t] = x; });
  function f(k){ return m[k] ? m[k].pct.toLocaleString('pt-BR',{minimumFractionDigits:1}) + '%' : '—'; }
  return '<footer><h3>Ficha técnica</h3>' +
  '<p>Projeto criado por <strong>Erico Cardoso</strong>, estudante de Análise de Dados. ' +
  'Produto em desenvolvimento — dados e telas ainda em revisão.</p>' +
  '<p><strong>Período analisado:</strong> pagamentos de emendas parlamentares registrados entre ' +
  data(D.meta.inicio) + ' e ' + data(D.meta.fim) + '.</p>' +
  '<p><strong>O que está aqui:</strong> ' + num(D.meta.lancamentos) + ' lançamentos, ' +
  brl(D.meta.total_pago) + ' pagos, os ' + num(D.meta.municipios) +
  ' municípios do Ceará, ' + num(D.meta.autores) + ' autores de emenda.</p>' +
  '<p><strong>Fonte:</strong> Controladoria-Geral da União — Emendas Parlamentares por Documentos ' +
  'de Despesa (portaldatransparencia.gov.br). Três arquivos anuais: 2024, 2025 e 2026 — o de 2026 ' +
  'está incompleto porque o ano ainda corre. A CGU atualiza a base diariamente. ' +
  'Malha municipal: IBGE. Fotos e situação de mandato: listas oficiais da Câmara dos Deputados e ' +
  'do Senado Federal.</p>' +
  '<p><strong>Três limites para ler os números corretamente:</strong></p><ol>' +
  '<li>Nem toda emenda tem dono. ' + f('parlamentar') + ' do valor foi destinado por parlamentares ' +
  'identificáveis; o restante veio de comissão (' + f('comissao') + '), bancada (' + f('bancada') +
  '), relator (' + f('relator') + ') e autor não informado (' + f('nao_informado') + ') — ' +
  'decisões coletivas ou sem identificação.</li>' +
  '<li>Quem não teve mandato não aparece. Candidatos sem mandato federal no período não tiveram ' +
  'emendas a destinar. Ausência aqui não é avaliação.</li>' +
  '<li>Só emendas federais. Este site não trata de deputado estadual, governador nem prefeito.</li>' +
  '</ol>' +
  '<p><strong>A data do pagamento não é a data da emenda.</strong> Um pagamento de 2025 pode estar ' +
  'quitando emenda aprovada anos antes.</p>' +
  '<p><a href="METODOLOGIA.md">Metodologia completa</a></p></footer>';
}

/* ================================ telas ============================== */

function telaCapa(){
  var m = {}; D.meta.por_tipo.forEach(function(x){ m[x.t] = x; });
  var indPct = m.parlamentar ? m.parlamentar.pct : 0;
  return '<div class="capa">' +
    '<h1>Para onde foi o dinheiro das emendas no Ceará</h1>' +
    '<p class="linha-fina">Todo pagamento de emenda parlamentar registrado nos ' +
    num(D.meta.municipios) + ' municípios do estado entre ' + data(D.meta.inicio) + ' e ' +
    data(D.meta.fim) + '. Procure pela sua cidade ou por um parlamentar.</p>' +
    '<div class="portas">' +
      '<div class="porta"><h2>Pela sua cidade</h2>' +
      '<p>Quanto chegou, de quem veio e em que área caiu.</p>' +
      '<div class="busca"><input type="search" id="q-mun" placeholder="Digite o município" ' +
      'autocomplete="off" aria-label="Buscar município"><div class="achados" id="r-mun"></div></div></div>' +
      '<div class="porta"><h2>Pelo parlamentar</h2>' +
      '<p>Quanto destinou, para onde e quem recebeu.</p>' +
      '<div class="busca"><input type="search" id="q-par" placeholder="Digite o nome" ' +
      'autocomplete="off" aria-label="Buscar parlamentar"><div class="achados" id="r-par"></div></div></div>' +
    '</div>' +
    '<div class="numeros">' +
      tile('Total pago no período', brl0(D.meta.total_pago), num(D.meta.lancamentos)+' lançamentos') +
      tile('Municípios alcançados', num(D.meta.municipios), 'todos os do Ceará') +
      tile('Com autor individual', indPct.toLocaleString('pt-BR',{minimumFractionDigits:1})+'%',
           'o resto é decisão coletiva') +
    '</div>' +

    secaoRankingAno('rk-mun', 'Quem mais recebeu, por ano',
      'Total pago em emendas por município, no ano em que o pagamento foi registrado — não o ' +
      'ano em que a emenda foi aprovada. Clique num município para ver a página dele.',
      porAnoMun, itensRankMun) +

    secaoRankingAno('rk-aut', 'Quem mais destinou, por ano',
      'Quanto cada parlamentar destinou aos municípios do Ceará, no ano em que o pagamento foi ' +
      'registrado. Só entram aqui parlamentares com nome — emendas de bancada, comissão e ' +
      'relator são decisão coletiva e não têm um autor individual para ranquear.',
      porAnoAut, itensRankAut) +

    '<section><h2 class="sec">Metade do dinheiro não tem dono</h2>' +
    '<p class="dica">Emendas de bancada e de comissão são decisões coletivas — não há um ' +
    'parlamentar por trás delas. Este site separa as duas coisas em toda tela, porque somar ' +
    'tudo junto faz parecer que um deputado entregou dinheiro que não foi decisão dele.</p>' +
    blocoPilha(D.meta.individual, D.meta.coletivo) + '</section>' +
    '</div>';
}

function telaMunicipio(id){
  var m = MUN[id];
  if(!m) return '<p class="vazio">Município não encontrado.</p>';

  var pares = (porMun[id] || []).slice().sort(desc);
  var individuais = pares.filter(function(r){ return ehIndividual(AUT[r.p]); });
  var coletivos   = pares.filter(function(r){ return !ehIndividual(AUT[r.p]); });

  var itens = pares.filter(function(r){ return r.v > 0; }).map(function(r){
    var a = AUT[r.p], ind = ehIndividual(a), p = PARL[r.p];
    return {nome: nomeAutor(a), v: r.v, cor: ind ? AZUL : LARANJA, retrato: true,
            coletiva: !ind, foto: p && p.foto, sigla: p && p.sigla,
            sufixo: ind ? '' : 'coletiva', href: ind ? '#/p/'+r.p : ''};
  });

  var funcoes = (funcMun[id] || []).filter(function(r){ return r.v > 0; }).sort(desc);
  var favs    = (favMun[id] || []).filter(function(r){ return r.v > 0; }).sort(desc);

  var linhasCSV = pares.map(function(r){
    var a = AUT[r.p];
    return [m.nome, nomeAutor(a), a ? a.tipo : '', String(r.v).replace('.', ',')];
  });

  return '<a class="voltar" href="#/">← todos os municípios</a>' +
  '<div class="cidade"><div class="txt">' +
    '<p class="eyebrow">Município</p><h1 class="nome-pg">'+esc(m.nome)+'</h1>' +
    '<p class="sub">'+num(m.pop)+' habitantes · Ceará</p></div>' +
    svgMapa([String(id)], m.nome + ' no Ceará') + '</div>' +

  heroi('Emendas parlamentares pagas em ' + m.nome, m.tot,
        'Entre ' + data(D.meta.inicio) + ' e ' + data(D.meta.fim)) +

  '<div class="tiles">' +
    tile('Por habitante', brl(m.pc), m.pos_pc + 'º entre os ' + num(D.meta.municipios) + ' municípios') +
    tile('Em valor total', m.pos + 'º', 'entre os ' + num(D.meta.municipios) + ' municípios') +
    tile('Parlamentares que destinaram',
         num(individuais.filter(function(r){ return r.v > 0; }).length),
         'além de ' + num(coletivos.filter(function(r){ return r.v > 0; }).length) + ' emendas coletivas') +
  '</div>' +

  '<section><h2 class="sec">De onde veio a decisão</h2>' +
  '<p class="dica lead">Em ' + esc(m.nome) + ', <strong>' + pct(m.ind, m.tot) + '</strong> do valor ' +
  'foi destinado por parlamentares com nome. No Ceará inteiro, essa fatia é de <strong>' +
  (D.meta.por_tipo[0] ? D.meta.por_tipo[0].pct.toLocaleString('pt-BR',{minimumFractionDigits:1}) : '') +
  '%</strong>.</p>' +
  '<p class="dica">Emendas de bancada e de comissão são decisões coletivas — não há um parlamentar ' +
  'por trás delas. Separar as duas coisas evita atribuir a alguém dinheiro que não foi decisão dele.</p>' +
  blocoPilha(m.ind, m.col) + '</section>' +

  '<section><h2 class="sec">Quem destinou</h2>' +
  '<p class="dica">Valor pago no período, do maior para o menor. Clique num parlamentar para ver ' +
  'o perfil dele.</p>' + barras(itens) +
  '<p class="nota">A etiqueta com partido e estado aparece em quem está <strong>em exercício ' +
  'hoje</strong> na Câmara ou no Senado, conferido contra as listas oficiais das duas casas. Quem ' +
  'não tem etiqueta pode ter deixado o mandato, estar licenciado ou ter sido substituído — a ' +
  'ausência não é avaliação.</p>' +
  '<details><summary>Ver tabela completa</summary>' +
  tabela(['Autor','Tipo','Valor pago'], pares.map(function(r){
    var a = AUT[r.p]; return [nomeAutor(a), a ? a.tipo : '', brl(r.v)];
  })) +
  botaoCSV('Baixar CSV', 'emendas-'+slug(m.nome)+'.csv',
           ['municipio','autor','tipo','valor_pago'], linhasCSV) +
  '</details></section>' +

  '<section><h2 class="sec">Em que área caiu</h2>' +
  '<p class="dica">Classificação orçamentária da despesa, segundo a própria CGU.</p>' +
  barras(funcoes.map(function(r){ return {nome: r.f, v: r.v}; }), 10) + '</section>' +

  '<section><h2 class="sec">Quem recebeu o dinheiro</h2>' +
  '<p class="dica">O destinatário registrado no documento de despesa — em geral a prefeitura, ' +
  'um fundo municipal ou o banco que operacionaliza o repasse. Os cinco maiores.</p>' +
  (favs.length
    ? tabela(['Destinatário','Valor recebido'], favs.map(function(r){ return [titulo(r.n), brl(r.v)]; }))
    : '<p class="vazio">Sem destinatário registrado no período.</p>') +
  '</section>';
}

function telaParlamentar(id){
  var a = AUT[id];
  if(!a) return '<p class="vazio">Parlamentar não encontrado.</p>';
  var p = PARL[id];
  var nome = nomeAutor(a);

  var mun = (porAut[id] || []).filter(function(r){ return r.v > 0; }).sort(desc);
  var fun = (funcAut[id] || []).filter(function(r){ return r.v > 0; }).sort(desc);
  var fav = (favAut[id] || []).filter(function(r){ return r.v > 0; }).sort(desc);
  var ano = (anoAut[id] || []).slice().sort(function(x,y){ return x.a - y.a; });

  var retrato = p && p.foto
    ? '<img class="foto" src="'+esc(p.foto)+'" alt="Retrato oficial de '+esc(nome)+'" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'foto-vazia\',textContent:\''+esc(iniciais(nome))+'\'}))">'
    : '<span class="foto-vazia">'+esc(iniciais(nome))+'</span>';

  var totalCE = D.meta.individual || 1;

  return '<a class="voltar" href="#/">← início</a>' +
  '<div class="cidade"><div class="perfil">' + retrato + '<div class="txt">' +
    '<p class="eyebrow">'+(ehIndividual(a) ? 'Parlamentar' : 'Emenda coletiva')+'</p>' +
    '<h1 class="nome-pg">'+esc(nome)+'</h1>' +
    '<p class="sub">' + (p
      ? 'Em exercício hoje · '+esc(p.casa)+' <span class="chip">'+esc(p.sigla)+'</span>'
      : 'Sem mandato federal em exercício hoje') + '</p>' +
  '</div></div>' +
  (mun.length ? svgMapa(mun.map(function(r){ return String(r.m); }),
      mun.length + (mun.length === 1 ? ' município alcançado' : ' municípios alcançados')) : '') +
  '</div>' +

  heroi('Emendas pagas com autoria de ' + nome, a.tot,
        'Entre ' + data(D.meta.inicio) + ' e ' + data(D.meta.fim)) +

  '<div class="tiles">' +
    tile('Entre os parlamentares', a.pos ? a.pos + 'º' : '—',
         a.pos ? 'em valor pago no Ceará' : 'não se aplica') +
    tile('Municípios alcançados', num(mun.length), 'dos ' + num(D.meta.municipios) + ' do estado') +
    tile('Fatia do dinheiro com nome', pct(a.tot, totalCE), 'no Ceará inteiro') +
  '</div>' +

  '<section><h2 class="sec">Por ano de pagamento</h2>' +
  '<p class="dica">Quanto saiu em cada ano. O ano de 2026 está incompleto — a base vai até ' +
  data(D.meta.fim) + '.</p>' + colunas(ano) + '</section>' +

  '<section><h2 class="sec">Onde o dinheiro caiu</h2>' +
  '<p class="dica">Municípios que receberam, do maior para o menor. Clique para ver a cidade ' +
  'inteira.</p>' +
  barras(mun.map(function(r){
    var m = MUN[r.m];
    return {nome: m ? m.nome : 'Aplicação estadual', v: r.v, href: m ? '#/m/'+r.m : ''};
  }), 15) +
  '<details><summary>Ver tabela completa</summary>' +
  tabela(['Município','Valor pago'], mun.map(function(r){
    var m = MUN[r.m]; return [m ? m.nome : 'Aplicação estadual', brl(r.v)];
  })) +
  botaoCSV('Baixar CSV', 'emendas-'+slug(nome)+'.csv',
           ['parlamentar','municipio','valor_pago'],
           mun.map(function(r){
             var m = MUN[r.m];
             return [nome, m ? m.nome : 'Aplicação estadual', String(r.v).replace('.', ',')];
           })) +
  '</details></section>' +

  '<section><h2 class="sec">Em que área</h2>' +
  '<p class="dica">Classificação orçamentária da despesa, segundo a própria CGU.</p>' +
  barras(fun.map(function(r){ return {nome: r.f, v: r.v}; }), 10) + '</section>' +

  '<section><h2 class="sec">Quem recebeu o dinheiro</h2>' +
  '<p class="dica">Os cinco maiores destinatários registrados nos documentos de despesa.</p>' +
  (fav.length
    ? tabela(['Destinatário','Valor recebido'], fav.map(function(r){ return [titulo(r.n), brl(r.v)]; }))
    : '<p class="vazio">Sem destinatário registrado no período.</p>') +
  '</section>' +

  '<section><h2 class="sec">Notícias recentes</h2>' +
  '<p class="dica">As dez notícias mais recentes sobre '+esc(nome)+' no Google Notícias. ' +
  'Atualizado manualmente, de vez em quando — pode não refletir o que saiu hoje.</p>' +
  blocoNoticias(id) + '</section>';
}

/* ================================ busca ============================== */
function chave(s){
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
}
var CATALOGO = D.municipios.map(function(m){
    return {k: chave(m.nome), nome: m.nome, tipo: 'município', href: '#/m/'+m.id};
  }).concat(D.autores.filter(ehIndividual).map(function(a){
    return {k: chave(a.nome), nome: nomeAutor(a), tipo: 'parlamentar', href: '#/p/'+a.id};
  }));

function ligaBusca(idInput, idLista, filtro){
  var inp = document.getElementById(idInput), lst = document.getElementById(idLista);
  if(!inp || !lst) return;
  var sel = -1, atual = [];
  function pinta(){
    var q = chave(inp.value.trim());
    atual = !q ? [] : CATALOGO.filter(function(c){
      return (!filtro || c.tipo === filtro) && c.k.indexOf(q) >= 0;
    }).sort(function(x,y){ return x.k.indexOf(q) - y.k.indexOf(q); }).slice(0, 8);
    sel = -1;
    lst.innerHTML = atual.map(function(c,i){
      return '<button role="option" data-i="'+i+'">'+esc(c.nome) +
             '<span class="tipo">'+c.tipo+'</span></button>';
    }).join('');
  }
  inp.addEventListener('input', pinta);
  inp.addEventListener('focus', pinta);
  inp.addEventListener('keydown', function(e){
    if(!atual.length) return;
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + atual.length) % atual.length;
      Array.prototype.forEach.call(lst.children, function(b,i){
        b.setAttribute('aria-selected', i === sel);
      });
    } else if(e.key === 'Enter'){
      e.preventDefault();
      var c = atual[sel < 0 ? 0 : sel];
      if(c){ location.hash = c.href; inp.value = ''; lst.innerHTML = ''; inp.blur(); }
    } else if(e.key === 'Escape'){ lst.innerHTML = ''; inp.blur(); }
  });
  lst.addEventListener('mousedown', function(e){
    var b = e.target.closest('button'); if(!b) return;
    e.preventDefault();
    location.hash = atual[+b.dataset.i].href;
    inp.value = ''; lst.innerHTML = '';
  });
  inp.addEventListener('blur', function(){ setTimeout(function(){ lst.innerHTML = ''; }, 120); });
}

/* ================================ rota =============================== */
function desenha(){
  var h = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  var html;
  if(h[0] === 'm' && h[1])      html = telaMunicipio(h[1]);
  else if(h[0] === 'p' && h[1]) html = telaParlamentar(h[1]);
  else                          html = telaCapa();

  document.getElementById('conteudo').innerHTML = html + rodape();
  document.querySelectorAll('[data-t]').forEach(function(el){ liga(el, el.dataset.t); });
  ligaBusca('q-mun', 'r-mun', 'município');
  ligaBusca('q-par', 'r-par', 'parlamentar');
  ligaBusca('q-topo', 'r-topo', null);
  document.title = (document.querySelector('.nome-pg')
    ? document.querySelector('.nome-pg').textContent + ' — '
    : '') + 'Radar 184 · Eleições 2026';
  window.scrollTo(0, 0);
}
addEventListener('hashchange', desenha);
desenha();

})();
