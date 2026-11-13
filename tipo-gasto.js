// Na tela de lançar: "Só agora", "Fixo todo mês" ou "Parcelado".
// Fixo e parcelado lançam o gasto de hoje e já criam a conta para os próximos meses.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  let tipo = 'agora', pendente = null, ultimaContaId = null;

  const v = $('versao');
  if (v) v.textContent = 'Versão ' + (typeof VERSAO_APP !== 'undefined' ? VERSAO_APP : '?');

  function mostrar() {
    document.querySelectorAll('#tipo-gasto [data-tg]').forEach(b => b.classList.toggle('sel', b.dataset.tg === tipo));
    $('grupo-tg-fixo').hidden = tipo !== 'fixo';
    $('grupo-tg-parc').hidden = tipo !== 'parcelado';
  }
  $('tipo-gasto').addEventListener('click', e => {
    const b = e.target.closest('[data-tg]'); if (!b) return;
    tipo = b.dataset.tg; mostrar();
    if (tipo === 'fixo' && !$('tg-dia').value) $('tg-dia').value = new Date().getDate();
    if (tipo === 'parcelado' && !$('tg-dia-p').value) $('tg-dia-p').value = new Date().getDate();
  });

  const form = $('form-gasto');
  // antes de salvar: guarda o tipo escolhido
  form.addEventListener('submit', () => {
    pendente = tipo === 'agora' ? null : {
      tipo,
      dia: +(tipo === 'fixo' ? $('tg-dia').value : $('tg-dia-p').value) || new Date().getDate(),
      parcela: Math.max(1, +$('tg-parcela').value || 1),
      total: +$('tg-total').value || 0,
    };
  }, true);

  // depois que o gasto foi salvo: cria a conta
  form.addEventListener('submit', () => {
    const p = pendente; pendente = null;
    if (!p) return;
    const g = dados.gastos.find(x => x.id === ultimoId);
    if (!g) return;
    if (p.tipo === 'parcelado' && !(p.total >= 2)) { avisar('Coloque o total de parcelas para eu criar a conta.'); return; }
    if (!Array.isArray(dados.contas)) dados.contas = [];
    const hoje = new Date();
    const prox = chaveMes(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1));
    const dia = Math.min(31, Math.max(1, p.dia));
    let conta, msg;
    if (p.tipo === 'fixo') {
      conta = { tipo: 'fixa', total: null, pagas: 1 };
      msg = `🔁 Virou conta fixa: todo dia ${dia}`;
    } else {
      const k = Math.min(p.parcela, p.total);
      conta = { tipo: 'parcelada', total: p.total, pagas: k };
      g.descricao = `${g.descricao} (${k}/${p.total})`;
      const falta = p.total - k;
      msg = falta ? `🔢 Faltam ${falta} parcelas de ${brl(g.valor)}` : '🎉 Era a última parcela';
    }
    g.origem = 'conta'; // conta fixa/parcela não come o "posso gastar hoje"
    Object.assign(conta, {
      id: 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nome: g.descricao.replace(/\s\(\d+\/\d+\)$/, ''), valor: g.valor, proxMes: prox, dia,
      categoria: g.categoria === 'outros' ? 'contas' : g.categoria,
    });
    dados.contas.push(conta);
    ultimaContaId = conta.id;
    salvar(); desenharTudo();
    $('toast-text').textContent = `✓ ${brl(g.valor)} lançado · ${msg}`;
    tipo = 'agora'; mostrar();
    $('tg-parcela').value = 1; $('tg-total').value = '';
  });

  // "Desfazer" também tira a conta criada
  $('toast-undo').addEventListener('click', () => {
    if (!ultimaContaId) return;
    dados.contas = (dados.contas || []).filter(c => c.id !== ultimaContaId);
    ultimaContaId = null; salvar(); desenharTudo();
  });
  form.addEventListener('submit', () => { if (tipo === 'agora') ultimaContaId = null; }, true);

  function avisar(txt) { $('toast-text').textContent = txt; $('toast').hidden = false; }
  mostrar();

  // ---------- 👁️ esconder / mostrar valores ----------
  const olho = $('btn-olho');
  function pintarOlho() {
    const OLHO = '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
    const RISCO = '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>';
    olho.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${valoresOcultos ? RISCO : OLHO}</svg>`;
    olho.setAttribute('aria-label', valoresOcultos ? 'Mostrar valores' : 'Esconder valores');
    document.documentElement.classList.toggle('ocultos', valoresOcultos);
  }
  olho.addEventListener('click', () => {
    valoresOcultos = !valoresOcultos;
    try { localStorage.setItem('meus-gastos-ocultar', valoresOcultos ? '1' : '0'); } catch (e) {}
    pintarOlho(); desenharTudo();
  });
  pintarOlho();
})();
