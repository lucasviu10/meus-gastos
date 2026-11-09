// Meus Gastos — tudo fica salvo só neste aparelho (localStorage).
'use strict';

const CHAVE = 'meus-gastos-v1';

const CATEGORIAS = [
  { id: 'alimentacao', nome: 'Alimentação', emoji: '🛒',
    palavras: ['mercado', 'supermercado', 'padaria', 'ifood', 'restaurante', 'lanche', 'almoco', 'janta', 'jantar', 'cafe', 'pizza', 'acougue', 'hortifruti', 'feira', 'comida', 'marmita', 'sorvete', 'acai', 'hamburguer', 'pao'] },
  { id: 'transporte', nome: 'Transporte', emoji: '🚗',
    palavras: ['uber', '99', 'gasolina', 'combustivel', 'posto', 'etanol', 'alcool', 'estacionamento', 'onibus', 'metro', 'pedagio', 'oficina', 'mecanico', 'ipva', 'carro', 'moto', 'taxi', 'trem'] },
  { id: 'casa', nome: 'Casa', emoji: '🏠',
    palavras: ['aluguel', 'luz', 'energia', 'agua', 'internet', 'condominio', 'gas', 'iptu', 'limpeza', 'faxina', 'moveis', 'casa'] },
  { id: 'saude', nome: 'Saúde', emoji: '💊',
    palavras: ['farmacia', 'remedio', 'academia', 'medico', 'dentista', 'consulta', 'exame', 'plano de saude', 'drogaria', 'suplemento', 'whey', 'medicamento', 'tadalafila', 'sildenafila'] },
  { id: 'lazer', nome: 'Lazer', emoji: '🎉',
    palavras: ['cinema', 'bar', 'show', 'netflix', 'spotify', 'viagem', 'cerveja', 'festa', 'balada', 'jogo', 'streaming', 'passeio', 'praia'] },
  { id: 'compras', nome: 'Compras', emoji: '🛍️',
    palavras: ['roupa', 'shopee', 'mercado livre', 'amazon', 'presente', 'tenis', 'shein', 'loja', 'celular novo', 'eletronico'] },
  { id: 'contas', nome: 'Contas', emoji: '🧾',
    palavras: ['cartao', 'boleto', 'fatura', 'telefone', 'plano celular', 'seguro', 'juros', 'emprestimo', 'parcela', 'consorcio', 'tarifa', 'banco', 'imposto'] },
  { id: 'mc', nome: 'MC', emoji: 'Ⓜ️', palavras: [] },
  { id: 'outros', nome: 'Outros', emoji: '📦', palavras: [] },
];
const CAT = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));

// ---------- Dados ----------
function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE));
    if (d && Array.isArray(d.gastos)) return { orcamento: 0, ...d };
  } catch (e) { /* começa vazio */ }
  return { gastos: [], orcamento: 0 };
}
let dados = carregar();
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch (e) { alert('Não consegui salvar no aparelho.'); }
}
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- Utilidades ----------
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pad = n => String(n).padStart(2, '0');
const isoDia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const chaveMes = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
function dataLegivel(iso) {
  const hoje = isoDia(new Date());
  const ontem = isoDia(new Date(Date.now() - 864e5));
  if (iso === hoje) return 'hoje';
  if (iso === ontem) return 'ontem';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
function valorDeTexto(t) {
  // aceita: 45 | 23,50 | 23.50 | 1.200,00 | 1200
  t = t.replace(/r\$\s*/i, '').trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(',', '.');
  const v = parseFloat(t);
  return isFinite(v) ? Math.round(v * 100) / 100 : NaN;
}

// ---------- Interpretar texto ("45 mercado") ----------
function interpretar(texto) {
  let t = ' ' + texto.trim() + ' ';
  const hoje = new Date();
  let data = new Date(hoje);

  // data
  let m;
  if ((m = t.match(/\s(anteontem)\s/i))) { data.setDate(data.getDate() - 2); t = t.replace(m[0], ' '); }
  else if ((m = t.match(/\s(ontem)\s/i))) { data.setDate(data.getDate() - 1); t = t.replace(m[0], ' '); }
  else if ((m = t.match(/\s(hoje)\s/i))) { t = t.replace(m[0], ' '); }
  else if ((m = t.match(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s/))) {
    let ano = m[3] ? +m[3] : hoje.getFullYear();
    if (ano < 100) ano += 2000;
    const d = new Date(ano, +m[2] - 1, +m[1]);
    if (!isNaN(d)) data = d;
    t = t.replace(m[0], ' ');
  }

  // valor (primeiro número que aparecer)
  let valor = NaN;
  m = t.match(/\s(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?=\s)/i);
  if (m) { valor = valorDeTexto(m[1]); t = t.replace(m[0], ' '); }

  const { descricao, categoriaDita } = simplificar(t);
  return { valor, descricao, categoria: categoriaDita || adivinharCategoria(descricao), data: isoDia(data) };
}

// Deixa a descrição curta: "coloca lá na saúde tadalafila" -> "tadalafila" (categoria Saúde)
const NOMES_CATEGORIA = { alimentacao: 'alimentacao', comida: 'alimentacao', transporte: 'transporte', casa: 'casa',
  saude: 'saude', lazer: 'lazer', compras: 'compras', contas: 'contas', conta: 'contas', outros: 'outros', mc: 'mc' };
const COMANDOS = new Set(['coloca', 'coloque', 'colocar', 'anota', 'anote', 'anotar', 'lanca', 'lance', 'lancar', 'registra',
  'registre', 'bota', 'boto', 'poe', 'gastei', 'paguei', 'gasto', 'reais', 'real', 'conto', 'contos', 'pila']);
const ENCHIMENTO = new Set(['la', 'ai', 'aqui', 'ali', 'na', 'no', 'nas', 'nos', 'de', 'do', 'da', 'dos', 'das', 'em', 'com',
  'pro', 'pra', 'para', 'por', 'pelo', 'pela', 'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'que', 'eu', 'me', 'mim',
  'meu', 'minha', 'e', 'foi', 'foram', 'deu', 'tipo', 'entao', 'ne', 'tambem', 'so', 'isso', 'esse', 'essa', 'categoria',
  'valor', 'hoje', 'agora', 'ta', 'esta', 'ja']);
function simplificar(texto) {
  let palavras = texto.replace(/[,.;!?]+(\s|$)/g, ' ').split(/\s+/).filter(Boolean);
  const sa = w => semAcento(w);
  let categoriaDita = null;
  // "na saúde", "em lazer", "categoria casa" -> escolhe a categoria e tira da descrição
  palavras = palavras.filter((w, i) => {
    const cat = NOMES_CATEGORIA[sa(w)];
    const antes = i > 0 ? sa(palavras[i - 1]) : '';
    if (cat && /^(na|no|em|pra|para|de|da|do|categoria)$/.test(antes)) { categoriaDita = cat; return false; }
    // categoria dita no fim: "50 tadalafila saúde" (casa/conta ficam, podem ser parte do nome)
    if (cat && i === palavras.length - 1 && i > 0 && !['casa', 'conta', 'contas', 'mc'].includes(sa(w))) { categoriaDita = cat; return false; }
    return !COMANDOS.has(sa(w));
  });
  // tira palavras de enchimento do começo e do fim (o meio fica: "café da manhã")
  while (palavras.length && ENCHIMENTO.has(sa(palavras[0]))) palavras.shift();
  while (palavras.length && ENCHIMENTO.has(sa(palavras[palavras.length - 1]))) palavras.pop();
  const descricao = palavras.slice(0, 5).join(' ').toLowerCase();
  return { descricao, categoriaDita };
}
const PALAVRAS_MC = /(^|\s)(mc|maconha|seda|sedas|beck|erva|piteira|dichavador|baseado)(\s|$)/;
function adivinharCategoria(desc) {
  const d = ' ' + semAcento(desc) + ' ';
  if (PALAVRAS_MC.test(d)) return 'mc';
  for (const c of CATEGORIAS) {
    if (c.palavras.some(p => d.includes(' ' + p + ' ') || d.includes(' ' + p))) return c.id;
  }
  // aprende com o que você já lançou antes
  const igual = dados.gastos.find(g => semAcento(g.descricao) === semAcento(desc));
  return igual ? igual.categoria : 'outros';
}

function adicionar(texto, categoriaForcada) {
  const r = interpretar(texto);
  if (!(r.valor > 0)) return null;
  const categoria = categoriaForcada || r.categoria;
  const g = {
    id: novoId(),
    valor: r.valor,
    descricao: r.descricao || CAT[categoria].nome,
    categoria,
    data: r.data,
    criado: new Date().toISOString(),
  };
  // MC: na lista aparece só "MC"; o que foi fica guardado no detalhe escondido
  if (categoria === 'mc') {
    if (r.descricao && semAcento(r.descricao) !== 'mc') g.nota = r.descricao;
    g.descricao = 'MC';
  }
  dados.gastos.push(g);
  return g;
}

// ---------- Aba Lançar ----------
const $ = id => document.getElementById(id);
const entrada = $('entrada');
let catEscolhida = null;

function desenharChips(sugerida) {
  const atual = catEscolhida || sugerida;
  $('chips').innerHTML = CATEGORIAS.map(c =>
    `<button type="button" class="chip${c.id === atual ? ' sel' : ''}" data-cat="${c.id}">${c.emoji} ${c.nome}</button>`
  ).join('');
}
function atualizarPreview() {
  const texto = entrada.value;
  if (!texto.trim()) {
    $('preview').textContent = 'Digite o valor e o que foi.';
    $('btn-salvar').disabled = true;
    catEscolhida = null;
    desenharChips(null);
    return;
  }
  const r = interpretar(texto);
  const cat = CAT[catEscolhida || r.categoria];
  if (r.valor > 0) {
    $('preview').innerHTML = `<strong>${brl(r.valor)}</strong> · ${escapar(r.descricao || cat.nome)} · ${cat.emoji} ${cat.nome} · ${dataLegivel(r.data)}`;
    $('btn-salvar').disabled = false;
  } else {
    $('preview').textContent = 'Falta o valor. Ex: 45 mercado';
    $('btn-salvar').disabled = true;
  }
  desenharChips(r.categoria);
}
entrada.addEventListener('input', atualizarPreview);
$('chips').addEventListener('click', e => {
  const b = e.target.closest('.chip');
  if (!b) return;
  catEscolhida = b.dataset.cat;
  atualizarPreview();
  entrada.focus();
});

let ultimoId = null, timerToast = null;
$('form-gasto').addEventListener('submit', e => {
  e.preventDefault();
  const g = adicionar(entrada.value, catEscolhida);
  if (!g) return;
  salvar();
  ultimoId = g.id;
  entrada.value = '';
  catEscolhida = null;
  atualizarPreview();
  $('toast-text').textContent = `✓ ${brl(g.valor)} em ${CAT[g.categoria].nome}`;
  $('toast-undo').hidden = false;
  $('toast').hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { $('toast').hidden = true; }, 5000);
  desenharTudo();
  entrada.focus();
});
$('toast-undo').addEventListener('click', () => {
  if (ultimoId) remover(ultimoId, true);
  $('toast').hidden = true;
});

// Detalhe escondido: só aparece quando você toca no gasto.
const abertos = new Set();
let editandoNota = null;
function itemLista(g, mostrarData) {
  const c = CAT[g.categoria] || CAT.outros;
  const aberto = abertos.has(g.id);
  let detalhe = '';
  if (aberto) {
    detalhe = editandoNota === g.id
      ? `<div class="detalhe"><input class="nota-input" data-nota-input="${g.id}" value="${escapar(g.nota || '')}" placeholder="O que foi? (só aparece aqui)">
          <button type="button" class="btn-pagar" data-salvar-nota="${g.id}">Salvar</button></div>`
      : `<div class="detalhe"><span>${g.nota ? `🔒 ${escapar(g.nota)}` : '<span class="sub">Sem detalhe</span>'}</span>
          <span class="sub">${c.emoji} ${c.nome} · ${dataLegivel(g.data)}</span>
          <button type="button" class="btn-link" data-editar-nota="${g.id}">✏️ ${g.nota ? 'Editar' : 'Adicionar'} detalhe</button></div>`;
  }
  return `<li class="item${aberto ? ' aberto' : ''}" data-gid="${g.id}">
    <span class="emoji">${c.emoji}</span>
    <span class="desc">${escapar(g.descricao)}${g.nota && !aberto ? ' <span class="tem-nota" aria-label="tem detalhe">•</span>' : ''}${mostrarData ? `<small>${dataLegivel(g.data)}</small>` : ''}</span>
    <span class="val">${brl(g.valor)}</span>
    <button class="del" data-del="${g.id}" aria-label="Apagar">✕</button>
    ${detalhe}
  </li>`;
}
function escapar(s) {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function remover(id, semPerguntar) {
  const g = dados.gastos.find(x => x.id === id);
  if (!g) return;
  if (!semPerguntar && !confirm(`Apagar ${g.descricao} (${brl(g.valor)})?`)) return;
  dados.gastos = dados.gastos.filter(x => x.id !== id);
  salvar();
  desenharTudo();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-del]');
  if (b) { remover(b.dataset.del); return; }
  const ed = e.target.closest('[data-editar-nota]');
  if (ed) { editandoNota = ed.dataset.editarNota; desenharTudo(); const i = document.querySelector(`[data-nota-input="${editandoNota}"]`); if (i) i.focus(); return; }
  const sv = e.target.closest('[data-salvar-nota]');
  if (sv) {
    const g = dados.gastos.find(x => x.id === sv.dataset.salvarNota);
    const i = document.querySelector(`[data-nota-input="${sv.dataset.salvarNota}"]`);
    if (g && i) { const v = i.value.trim(); if (v) g.nota = v.slice(0, 120); else delete g.nota; salvar(); }
    editandoNota = null; desenharTudo(); return;
  }
  if (e.target.closest('.detalhe')) return;
  const cat = e.target.closest('[data-cat-abrir]');
  if (cat) { catAberta = catAberta === cat.dataset.catAbrir ? null : cat.dataset.catAbrir; desenharPainel(); return; }
  const li = e.target.closest('li.item[data-gid]');
  if (li) {
    const id = li.dataset.gid;
    if (abertos.has(id)) { abertos.delete(id); if (editandoNota === id) editandoNota = null; } else abertos.add(id);
    desenharTudo();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('[data-nota-input]')) {
    e.preventDefault();
    document.querySelector(`[data-salvar-nota="${e.target.dataset.notaInput}"]`).click();
  }
});

function desenharHoje() {
  const hoje = isoDia(new Date());
  const lista = dados.gastos.filter(g => g.data === hoje).sort((a, b) => b.criado.localeCompare(a.criado));
  $('hoje-total').textContent = brl(lista.reduce((s, g) => s + g.valor, 0));
  $('hoje-lista').innerHTML = lista.length ? lista.map(g => itemLista(g, false)).join('') : '<li class="vazio">Nada lançado hoje.</li>';
}

// ---------- Aba Painel ----------
let mesVisto = new Date(); mesVisto.setDate(1);

let catAberta = null;
function desenharPainel() {
  const km = chaveMes(mesVisto);
  { const n = mesVisto.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); $('mes-nome').textContent = n.charAt(0).toUpperCase() + n.slice(1); }
  const doMes = dados.gastos.filter(g => g.data.startsWith(km));
  const total = doMes.reduce((s, g) => s + g.valor, 0);
  const orc = dados.orcamento || 0;

  const barra = $('destaque-barra');
  const valorEl = $('destaque-valor');
  valorEl.className = 'valor-grande';
  if (orc > 0) {
    const resta = orc - total;
    const pct = Math.min(100, (total / orc) * 100);
    const cor = pct >= 100 ? 'bad' : pct >= 80 ? 'warn' : 'ok';
    $('destaque-rotulo').textContent = resta >= 0 ? 'Ainda posso gastar' : 'Passei do limite em';
    valorEl.textContent = brl(Math.abs(resta));
    valorEl.classList.add(cor);
    barra.style.width = pct + '%';
    barra.style.background = `var(--${cor})`;
    let sub = `Gastei ${brl(total)} de ${brl(orc)}`;
    const agora = new Date();
    if (km === chaveMes(agora) && resta > 0) {
      const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
      const diasRestantes = ultimoDia - agora.getDate() + 1;
      sub += ` · dá ${brl(resta / diasRestantes)} por dia`;
    }
    $('destaque-sub').textContent = sub;
  } else {
    $('destaque-rotulo').textContent = 'Gastei este mês';
    valorEl.textContent = brl(total);
    barra.style.width = '0';
    $('destaque-sub').textContent = 'Defina seu limite em ⚙️ Ajustes para ver quanto sobra.';
  }

  // categorias
  const porCat = {};
  doMes.forEach(g => { porCat[g.categoria] = (porCat[g.categoria] || 0) + g.valor; });
  const ordem = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const maior = ordem.length ? ordem[0][1] : 1;
  $('lista-cat').innerHTML = ordem.length ? ordem.map(([id, v]) => {
    const c = CAT[id] || CAT.outros;
    const pct = total ? Math.round((v / total) * 100) : 0;
    const aberta = catAberta === id;
    const itens = aberta ? doMes.filter(g => g.categoria === id).sort((a, b) => (b.data + b.criado).localeCompare(a.data + a.criado)) : [];
    return `<li class="cat${aberta ? ' aberta' : ''}"><button type="button" class="cat-botao" data-cat-abrir="${id}" aria-expanded="${aberta}">
      <div class="topo"><span>${c.emoji} ${c.nome} <span class="seta">${aberta ? '▾' : '›'}</span></span><span><strong>${brl(v)}</strong> <small class="sub">${pct}%</small></span></div>
      <div class="barra"><div class="barra-cheia" style="width:${(v / maior) * 100}%"></div></div></button>
      ${aberta ? `<ul class="lista dentro">${itens.map(g => itemLista(g, true)).join('')}</ul>` : ''}</li>`;
  }).join('') : '<li class="vazio">Sem gastos neste mês.</li>';

  const ultimos = [...doMes].sort((a, b) => (b.data + b.criado).localeCompare(a.data + a.criado)).slice(0, 8);
  $('lista-ultimos').innerHTML = ultimos.length ? ultimos.map(g => itemLista(g, true)).join('') : '<li class="vazio">Nada por aqui.</li>';
}
$('mes-ant').addEventListener('click', () => { mesVisto.setMonth(mesVisto.getMonth() - 1); desenharPainel(); });
$('mes-prox').addEventListener('click', () => { mesVisto.setMonth(mesVisto.getMonth() + 1); desenharPainel(); });

// ---------- Aba Ajustes ----------
$('orcamento').value = dados.orcamento ? String(dados.orcamento).replace('.', ',') : '';
$('btn-orcamento').addEventListener('click', () => {
  const v = valorDeTexto($('orcamento').value);
  dados.orcamento = v > 0 ? v : 0;
  dados.orcamentoEm = new Date().toISOString();
  salvar();
  desenharTudo();
  $('btn-orcamento').textContent = '✓ Salvo';
  setTimeout(() => { $('btn-orcamento').textContent = 'Salvar limite'; }, 1500);
});

$('btn-lote').addEventListener('click', () => {
  const linhas = $('lote').value.split('\n').map(l => l.trim()).filter(Boolean);
  let ok = 0; const erro = [];
  linhas.forEach(l => { adicionar(l) ? ok++ : erro.push(l); });
  salvar();
  desenharTudo();
  $('lote').value = erro.join('\n');
  $('lote-msg').textContent = `${ok} gasto(s) adicionado(s).` + (erro.length ? ` ${erro.length} linha(s) sem valor ficaram acima.` : '');
});

$('btn-exportar').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `meus-gastos-${isoDia(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('arquivo-import').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.gastos)) throw new Error();
    if (!confirm(`Restaurar ${d.gastos.length} gastos? Isso substitui o que está no app.`)) return;
    dados = { orcamento: 0, ...d };
    salvar();
    $('orcamento').value = dados.orcamento ? String(dados.orcamento).replace('.', ',') : '';
    desenharTudo();
    alert('Backup restaurado.');
  } catch (err) {
    alert('Arquivo inválido.');
  } finally { e.target.value = ''; }
});

// ---------- Abas ----------
document.querySelectorAll('.abas button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.abas button').forEach(x => x.classList.toggle('ativa', x === b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'painel') desenharPainel();
  window.scrollTo(0, 0);
}));

function desenharTudo() { desenharHoje(); desenharPainel(); }
desenharChips(null);
desenharTudo();

// ---------- Funcionar como app / offline ----------
const VERSAO_APP = '17';
if ('serviceWorker' in navigator) {
  const jaTinha = !!navigator.serviceWorker.controller;
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (jaTinha && !recarregou) { recarregou = true; location.reload(); }
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then(reg => { reg.update(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update(); }); })
    .catch(() => {}));
}
