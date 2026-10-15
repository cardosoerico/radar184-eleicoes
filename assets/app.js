/* ================================================================
   Radar 184 · Eleições 2026 — aplicação
   Lê window.DADOS, window.MAPA, window.PARL e window.PARLAMENTARES (assets/*.js).
   Rotas por hash:  #/            capa
                    #/m/<ibge>    município
                    #/p/<autor>   parlamentar
   ================================================================ */
(function () {
'use strict';

var D = window.DADOS, MAPA = window.MAPA, PARL = window.PARL || {}, NOTICIAS = window.NOTICIAS || {};
var PERFIS = window.PARLAMENTARES || {};   // fichas oficiais (buscar_mandatos.py)
var AZUL = '#2451F5', LARANJA = '#F5730F', CINZA = '#A8B0C6';
var R = window.RESULTADOS;   // assets/resultados.js — votos 2026 x emendas empenhadas 2022-2026

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
  var f = PERFIS[a.id];
  if(f && f.nome) return f.nome === f.nome.toUpperCase() ? titulo(f.nome) : f.nome;
  var p = PARL[a.id];
  return (p && p.nome) ? p.nome : titulo(a.nome);   // grafia oficial quando existe
}
/* foto para todos os que têm ficha oficial; etiqueta de partido só para quem está em exercício */
function retratoDe(id){
  var f = PERFIS[id], p = PARL[id];
  if(f) return {foto: f.foto, sigla: emExercicio(f) ? f.partido + '-' + f.uf : ''};
  return {foto: p && p.foto, sigla: p && p.sigla};
}
function emExercicio(f){ return !!(f && f.situacao && f.situacao.situacao === 'em_exercicio'); }

/* ---------- situação e histórico (textos combinados com o Rico em 01/10/2026) ---------- */
function fem(f, m, fe){ return f && f.sexo === 'F' ? fe : m; }
function cargo(f, casa){
  return casa === 'Senado' ? fem(f, 'Senador', 'Senadora') : fem(f, 'Deputado federal', 'Deputada federal');
}
function dataCurta(iso){ var p = String(iso).slice(0,10).split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function mesAno(iso){
  var m = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
           'setembro','outubro','novembro','dezembro'];
  var p = String(iso).split('-'); return m[Number(p[1])-1] + ' de ' + p[0];
}
function mandatoSenadoHoje(f){
  var hoje = new Date().toISOString().slice(0,10);
  return ((f.senado && f.senado.mandatos) || []).filter(function(m){
    return m.inicio <= hoje && hoje <= m.fim; })[0];
}
function textoSituacao(f){
  var s = f && f.situacao;
  if(!s || s.situacao === 'mandato_encerrado') return '';   // sem rótulo: o histórico fala por si
  var chip = (f.partido && f.uf) ? ' <span class="chip">'+esc(f.partido+'-'+f.uf)+'</span>' : '';
  if(s.situacao === 'em_exercicio')
    return '<p class="sub"><strong>'+cargo(f, s.casa)+' em exercício</strong>'+chip+'</p>';
  var suplente = /suplent/i.test(s.participacao || '');
  if(!suplente){
    var fim = s.casa === 'Senado' ? (mandatoSenadoHoje(f) || {}).fim : '2027-01-31';
    return '<p class="sub"><strong>'+cargo(f, s.casa)+' em licença desde '+dataCurta(s.desde)+'</strong>' +
      (fim ? ' · mandato até '+mesAno(fim) : '') +
      (s.casa === 'Senado' && s.motivo
        ? '<br><span class="motivo">Motivo registrado pelo Senado: '+esc(s.motivo.toLowerCase())+'</span>' : '') +
      '</p>';
  }
  if(s.casa === 'Senado'){
    var n = (String(s.participacao).match(/^\d/) || [''])[0];
    var rot = (n ? n + fem(f, 'º', 'ª') + ' suplente' : 'Suplente');
    var anterior = new Date(s.desde + 'T12:00:00'); anterior.setDate(anterior.getDate() - 1);
    return '<p class="sub"><strong>'+rot+(s.titular ? ' de '+esc(s.titular) : '')+' no Senado</strong>' +
      ' · exerceu o mandato até '+mesAno(anterior.toISOString().slice(0,10)) +
      (s.motivo ? ' <span class="motivo">('+esc(s.motivo.toLowerCase())+', segundo o Senado)</span>' : '') +
      '</p>';
  }
  return '<p class="sub"><strong>Suplente de deputado federal</strong>'+chip +
    ' · exerceu o mandato na legislatura atual</p>';
}
function anosLegislatura(l){ var i = 2007 + (l - 53) * 4; return i + '–' + (i + 4); }
function textoHistorico(f){
  if(!f) return '';
  var partes = [];
  if(f.camara) partes.push('Câmara dos Deputados (' + f.camara.legislaturas.map(anosLegislatura).join(', ') + ')');
  if(f.senado) partes.push('Senado Federal (' + f.senado.mandatos.slice()
    .sort(function(x, y){ return x.inicio < y.inicio ? -1 : 1; })
    .map(function(m){
      var t = m.inicio.slice(0,4) + '–' + m.fim.slice(0,4);
      return /suplent/i.test(m.participacao || '') ? t + ', como suplente' : t;
    }).join('; ') + ')');
  var casa = f.situacao && f.situacao.casa;
  return '<p class="hist"><span class="rot">Mandatos federais (registros oficiais a partir de 2007):</span> ' +
    partes.join(' · ') + '</p>' +
    (f.pagina ? '<p class="hist"><a href="'+esc(f.pagina)+'" target="_blank" rel="noopener noreferrer">' +
      'Página oficial ' + (casa === 'Senado' ? 'no Senado' : 'na Câmara') + ' →</a></p>' : '');
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
    var a = AUT[r.p], p = retratoDe(r.p);
    return {nome: nomeAutor(a), v: r.v, cor: AZUL, retrato: true,
            foto: p.foto, sigla: p.sigla, href: '#/p/'+r.p};
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
      '</span></span><span class="val">'+(i.txt || brl0(i.v))+'</span></div>' +
      '<div class="trilho"><div class="barra" style="width:'+(100*i.v/max)+'%;background:'+
      (i.cor||AZUL)+'"></div></div>' + (i.nota ? '<p class="nota-barra">'+i.nota+'</p>' : '');
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
  'de Despesa (portaldatransparencia.gov.br). Um arquivo por ano, de 2014 a 2026 — o de 2026 ' +
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
    (R ? '<a class="destaque-res" href="#/resultados"><span class="sel-res">Resultados 2026</span>' +
      '<span class="tit-res">Quanto seu voto custou?</span>' +
      '<span class="txt-res">Votos de cada deputado federal, cidade por cidade, ao lado do dinheiro que ele destinou em emendas desde 2022.</span>' +
      '<span class="seta-res">Ver os resultados →</span></a>' : '') +
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
    var a = AUT[r.p], ind = ehIndividual(a), p = retratoDe(r.p);
    return {nome: nomeAutor(a), v: r.v, cor: ind ? AZUL : LARANJA, retrato: true,
            coletiva: !ind, foto: p.foto, sigla: p.sigla,
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
  var p = retratoDe(id), f = PERFIS[id];
  var nome = nomeAutor(a);

  var mun = (porAut[id] || []).filter(function(r){ return r.v > 0; }).sort(desc);
  var fun = (funcAut[id] || []).filter(function(r){ return r.v > 0; }).sort(desc);
  var fav = (favAut[id] || []).filter(function(r){ return r.v > 0; }).sort(desc);
  var ano = (anoAut[id] || []).filter(function(r){ return r.v > 0; })
            .sort(function(x,y){ return x.a - y.a; });

  var retrato = p && p.foto
    ? '<img class="foto" src="'+esc(p.foto)+'" alt="Retrato oficial de '+esc(nome)+'" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'foto-vazia\',textContent:\''+esc(iniciais(nome))+'\'}))">'
    : '<span class="foto-vazia">'+esc(iniciais(nome))+'</span>';

  var totalCE = D.meta.individual || 1;

  return '<a class="voltar" href="#/">← início</a>' +
  '<div class="cidade"><div class="perfil">' + retrato + '<div class="txt">' +
    '<p class="eyebrow">'+(ehIndividual(a) ? 'Parlamentar' : 'Emenda coletiva')+'</p>' +
    '<h1 class="nome-pg">'+esc(nome)+'</h1>' +
    (f ? textoSituacao(f) + textoHistorico(f)
       : (PARL[id] ? '<p class="sub">Em exercício hoje · '+esc(PARL[id].casa)+' <span class="chip">'+esc(PARL[id].sigla)+'</span></p>' : '')) +
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
  data(D.meta.fim) + '.</p>' +
  barras(ano.map(function(r){ return {nome: String(r.a), v: r.v}; })) + '</section>' +

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


/* ============== RESULTADOS 2026 · quanto seu voto custou ============== */
var RP = {}, RPM = {}, RAREA = {}, RORDEM = [];
if(R){
  R.pm.forEach(function(r){ (RPM[r[0]] = RPM[r[0]] || []).push({m: r[1], votos: r[2], emp: r[3]}); });
  R.area.forEach(function(r){ (RAREA[r[0]] = RAREA[r[0]] || []).push({f: r[1], v: r[2]}); });
  R.parl.forEach(function(p){
    p.votos = 0; p.emp = 0;
    (RPM[p.p] || []).forEach(function(x){ p.votos += x.votos; p.emp += x.emp; });
    p.vpv = p.votos ? p.emp / p.votos : 0;
    p.completo = p.anos.length === 5;
    RP[p.p] = p;
  });
  RORDEM = R.parl.slice().sort(function(a,b){ return b.votos - a.votos; });
}
function nomeRes(p){ return AUT[p.p] ? nomeAutor(AUT[p.p]) : titulo(p.u); }
function anosTxt(p){ return p.anos.length ? p.anos.join(' · ') : 'nenhum'; }
function mediana(v){
  if(!v.length) return 0;
  v = v.slice().sort(function(a,b){ return a-b; });
  var m = Math.floor(v.length/2);
  return v.length % 2 ? v[m] : (v[m-1] + v[m]) / 2;
}
var GRUPOS = [
  {k:'retrib',  nome:'Retribuição',     cor:AZUL,    def:'Muito dinheiro destinado e muitos votos.'},
  {k:'semret',  nome:'Sem retorno',     cor:LARANJA, def:'Muito dinheiro destinado e poucos votos.'},
  {k:'semdin',  nome:'Voto sem dinheiro', cor:'#0E9F83', def:'Muitos votos e pouco dinheiro destinado.'},
  {k:'distante',nome:'Distante',        cor:CINZA,   def:'Pouco dinheiro destinado e poucos votos.'}
];
/* "muito" = acima da mediana do próprio parlamentar: dos votos entre os municípios onde teve voto,
   e do valor entre os municípios onde destinou algum valor */
function classifica(lista){
  var medV = mediana(lista.filter(function(x){ return x.votos > 0; }).map(function(x){ return x.votos; }));
  var medE = mediana(lista.filter(function(x){ return x.emp > 0; }).map(function(x){ return x.emp; }));
  return lista.map(function(x){
    var altoV = x.votos > 0 && x.votos >= medV, altoE = x.emp > 0 && x.emp >= medE;
    var k = altoV && altoE ? 'retrib' : altoE ? 'semret' : altoV ? 'semdin' : 'distante';
    return {m: x.m, votos: x.votos, emp: x.emp, k: k};
  });
}
function rotuloGrupo(k){ return GRUPOS.filter(function(g){ return g.k === k; })[0].nome; }
function nomeMun(id){ return MUN[id] ? MUN[id].nome : String(id); }

function resParlMun(id){
  var p = RP[id], cl = classifica(RPM[id] || []);
  var vm = cl.filter(function(x){ return x.votos > 0; }).length;
  var em = cl.filter(function(x){ return x.emp > 0; }).length;
  var aviso = p.completo ? '' :
    '<p class="aviso-res menor"><strong>Atenção:</strong> '+esc(nomeRes(p))+' teve empenho em apenas ' +
    p.anos.length + ' dos 5 anos (' + anosTxt(p) + '). O valor por voto não é comparável com o de quem teve os cinco anos.</p>';
  var topo = '<div class="tiles">' +
    tile('Votos em 2026', num(p.votos), num(vm)+' municípios com voto') +
    tile('Destinado 2022–2026', brl0(p.emp), num(em)+' municípios receberam') +
    tile('Valor por voto', brl(p.vpv), 'empenho em: ' + anosTxt(p)) + '</div>' + aviso;
  var cards = GRUPOS.map(function(g){
    var l = cl.filter(function(x){ return x.k === g.k; });
    var ord = g.k === 'semdin' ? function(a,b){ return b.votos - a.votos; } : function(a,b){ return b.emp - a.emp; };
    var top = g.k === 'distante' ? [] : l.slice().sort(ord).slice(0,5);
    return '<div class="grupo" style="border-top-color:'+g.cor+'"><p class="g-num">'+num(l.length)+'</p>' +
      '<p class="g-nome">'+g.nome+'</p><p class="g-def">'+g.def+'</p>' +
      (top.length ? '<ul class="g-lista">' + top.map(function(x){
        return '<li><a href="#/m/'+x.m+'">'+esc(nomeMun(x.m))+'</a><span>'+num(x.votos)+' votos · '+brl0(x.emp)+'</span></li>';
      }).join('') + '</ul>' : '<p class="g-def">Municípios sem destaque nos dois lados.</p>') + '</div>';
  }).join('');
  var linhas = cl.slice().sort(function(a,b){ return b.votos - a.votos; }).map(function(x){
    return [nomeMun(x.m), num(x.votos), brl0(x.emp), x.votos ? brl(x.emp/x.votos) : '—', rotuloGrupo(x.k)];
  });
  return topo + '<div class="grupos">' + cards + '</div>' +
    '<details><summary>Ver os '+num(cl.length)+' municípios</summary>' +
    tabela(['Município','Votos 2026','Destinado','R$ por voto','Relação'], linhas) +
    botaoCSV('Baixar CSV','resultados-'+slug(nomeRes(p))+'.csv',
      ['parlamentar','municipio','votos_2026','empenhado_2022_2026','relacao'],
      cl.map(function(x){ return [nomeRes(p), nomeMun(x.m), x.votos, String(x.emp).replace('.',','), rotuloGrupo(x.k)]; })) +
    '</details>';
}
function resParlArea(id){
  var p = RP[id], l = (RAREA[id] || []).slice().sort(desc);
  var tot = l.reduce(function(a,x){ return a + x.v; }, 0);
  var itens = l.map(function(x){
    var esp = /encargos especiais/i.test(x.f);
    return {nome: esp ? 'Transferências Especiais' : titulo(x.f), v: x.v, cor: esp ? CINZA : AZUL,
            sufixo: esp ? 'área não informada' : '', txt: brl0(x.v)+' · '+pct(x.v, tot)};
  });
  return '<p class="nota-sel">Parlamentar: <strong>'+esc(nomeRes(p))+'</strong> · total '+brl0(tot)+
         ' (inclui valores destinados ao estado, sem município)</p>' + barras(itens, 10);
}
function ligaResultados(){
  var sel = document.getElementById('sel-parl'); if(!sel) return;
  function mostra(){
    document.getElementById('res-mun').innerHTML  = resParlMun(sel.value);
    document.getElementById('res-area').innerHTML = resParlArea(sel.value);
    document.querySelectorAll('#res-mun [data-t],#res-area [data-t]').forEach(function(el){ liga(el, el.dataset.t); });
  }
  sel.addEventListener('change', mostra);
  mostra();
}

function telaResultados(){
  if(!R) return '<p class="vazio">Dados de resultados não encontrados.</p>';
  var totV = 0, totE = 0;
  R.parl.forEach(function(p){ totV += p.votos; totE += p.emp; });
  var rank = R.parl.slice().sort(function(a,b){ return b.vpv - a.vpv; }).map(function(p){
    var f = retratoDe(p.p);
    return {nome: nomeRes(p), v: p.vpv, txt: brl(p.vpv)+' por voto', cor: p.completo ? AZUL : CINZA,
      retrato: true, foto: f.foto, sigla: p.t, href: AUT[p.p] ? '#/p/'+p.p : '',
      nota: '<strong>'+brl0(p.emp)+'</strong> ÷ '+num(p.votos)+' votos · empenho em ' + esc(anosTxt(p)) +
            (p.completo ? '' : ' <span class="alerta-anos">— só '+p.anos.length+' de 5 anos: não comparável</span>')};
  });
  var parts = R.part.map(function(r){
    var vt = r[2] + r[3];
    return {sigla: r[1], votos: vt, nom: r[2], leg: r[3], cand: r[4], eleitos: r[5], dos23: r[6], emp: r[7], pc: r[8]};
  });
  var barrasPart = parts.slice(0,10).map(function(x){
    return {nome: x.sigla, v: x.votos, txt: num(x.votos)+' votos · '+x.pc.toLocaleString('pt-BR',{minimumFractionDigits:1})+'%',
      nota: x.dos23 ? 'Deputados do partido entre os 23: <strong>'+x.dos23+'</strong> · destinaram '+brl0(x.emp)+' · '+brl(x.emp/x.votos)+' por voto do partido'
                    : 'Nenhum dos 23 parlamentares — sem valor destinado a comparar'};
  });
  var opcoes = RORDEM.map(function(p){
    return '<option value="'+p.p+'">'+esc(nomeRes(p))+' · '+num(p.votos)+' votos</option>';
  }).join('');
  return '<a class="voltar" href="#/">← início</a>' +
  '<div class="capa res">' +
    '<p class="eyebrow">Resultados 2026</p>' +
    '<h1 class="nome-pg">Quanto seu voto custou?</h1>' +
    '<p class="linha-fina">Em 2026, 23 parlamentares que já destinavam emendas ao Ceará disputaram a reeleição para deputado federal. ' +
    'Dividimos o que cada um destinou entre 2022 e 2026 pelos votos que recebeu, no estado e em cada município.</p>' +
    '<div class="aviso-res"><strong>Como ler.</strong> “Destinado” é o valor <em>empenhado</em>: o dinheiro que o parlamentar reservou na emenda. ' +
    'Não é o valor pago, que é o usado no resto do site, então os totais desta aba não batem com os das outras telas. ' +
    'R$ por voto é uma conta de divisão. Ela não prova que o dinheiro comprou o voto.</div>' +
    '<div class="tiles">' +
      tile('Parlamentares', num(R.parl.length), 'disputaram voto de novo em 2026') +
      tile('Votos nominais', num(totV), 'nos 23, em 184 municípios') +
      tile('Destinado 2022–2026', brl0(totE), 'empenhado, com município') +
    '</div>' +

    '<section><h2 class="sec">Quanto cada voto custou</h2>' +
    '<p class="dica">Valor empenhado em emendas individuais de 2022 a 2026, dividido pelos votos nominais de 2026. ' +
    'Quanto maior a barra, mais dinheiro foi destinado para cada voto recebido. Só entram aqui os 12 com empenho nos cinco anos.</p>' +
    barras(rank.filter(function(x){ return x.cor === AZUL; })) +
    '<h3 class="sub-sec">Não comparáveis: empenho em menos de cinco anos</h3>' +
    '<p class="dica">O valor por voto destes parlamentares usa menos anos de empenho que o dos demais. ' +
    'Ficam fora do ranking para não parecerem mais baratos ou mais caros do que são.</p>' +
    barras(rank.filter(function(x){ return x.cor !== AZUL; })) + '</section>' +

    '<section><h2 class="sec">Onde o dinheiro e o voto se encontram</h2>' +
    '<p class="dica">Escolha um parlamentar para ver, município por município, quanto ele destinou e quantos votos recebeu. ' +
    '“Muito” e “pouco” são medidos contra a mediana do próprio parlamentar.</p>' +
    '<label class="seletor">Parlamentar <select id="sel-parl">'+opcoes+'</select></label>' +
    '<div id="res-mun"></div></section>' +

    '<section><h2 class="sec">Em que áreas o dinheiro foi destinado</h2>' +
    '<p class="dica">Função orçamentária das emendas do parlamentar escolhido acima, segundo a CGU.</p>' +
    '<div class="aviso-res menor"><strong>Cerca de 37% do valor é “Transferências Especiais”</strong> (a chamada emenda Pix). ' +
    'Elas aparecem como “Encargos especiais” porque a área só é definida pelo município depois do repasse. ' +
    'Esse dinheiro não tem área conhecida neste site.</div>' +
    '<div id="res-area"></div></section>' +

    '<section><h2 class="sec">Votos e emendas por partido</h2>' +
    '<p class="dica">Votos do partido (nominais mais legenda) ao lado do valor destinado pelos deputados dele. ' +
    'O partido é o da candidatura em 2026: quem mudou de partido desde 2022 aparece no partido atual. ' +
    'PRD e PSOL não tinham nenhum dos 23 parlamentares, então não há valor a comparar.</p>' +
    barras(barrasPart) +
    '<details><summary>Ver os '+parts.length+' partidos</summary>' +
    tabela(['Partido','Votos','Eleitos','Dos 23','Destinado','R$ por voto'], parts.map(function(x){
      return [x.sigla, num(x.votos), x.eleitos, x.dos23, brl0(x.emp), x.dos23 ? brl(x.emp/x.votos) : '—'];
    })) + '</details></section>' +

    '<section class="metodo-res"><h2 class="sec">Metodologia</h2>' +
    '<p class="dica"><strong>Fontes:</strong> votos por seção eleitoral do TSE (Deputado Federal, Ceará, 2026); emendas da CGU ' +
    '(Portal da Transparência), fase de empenho, pelo ano do documento, de 2022 a 2026.</p>' +
    '<p class="dica"><strong>Quem entra:</strong> os 23 parlamentares que destinaram emendas individuais ao Ceará e disputaram voto de novo em 2026, eleitos ou não.</p>' +
    '<p class="dica"><strong>Limites:</strong> (1) só emendas individuais entram na conta, porque as de bancada, comissão e relator não têm um parlamentar por trás; ' +
    '(2) cerca de R$ 117 milhões foram destinados ao estado inteiro, sem município, e ficam fora das telas por município; ' +
    '(3) a lista inclui só quem já destinava emendas, então candidatos novos, mesmo bem votados, não aparecem; ' +
    '(4) voto de legenda só entra na visão por partido.</p></section>' +
  '</div>';
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
  else if(h[0] === 'resultados') html = telaResultados();
  else                          html = telaCapa();

  document.getElementById('conteudo').innerHTML = html + rodape();
  document.querySelectorAll('[data-t]').forEach(function(el){ liga(el, el.dataset.t); });
  ligaBusca('q-mun', 'r-mun', 'município');
  ligaBusca('q-par', 'r-par', 'parlamentar');
  ligaBusca('q-topo', 'r-topo', null);
  ligaResultados();
  document.title = (document.querySelector('.nome-pg')
    ? document.querySelector('.nome-pg').textContent + ' — '
    : '') + 'Radar 184 · Eleições 2026';
  window.scrollTo(0, 0);
}
addEventListener('hashchange', desenha);
desenha();

})();
