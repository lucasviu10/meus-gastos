// Sincronização com o chat: o Claude grava gastos no arquivo chat.json (branch "dados")
// do GitHub, e o app puxa sozinho quando você abre ou volta para ele.
'use strict';
(function () {
  const URL_DADOS = 'https://api.github.com/repos/lucasviu10/meus-gastos/contents/chat.json?ref=dados';
  const INTERVALO_MIN = 20000; // não busca mais de uma vez a cada 20 s
  let ultimaBusca = 0, buscando = false;

  // detalhe escondido vem disfarçado (base64) para não ficar legível no arquivo
  function lerNota(x) {
    try {
      if (typeof x.nota64 === 'string' && x.nota64) return decodeURIComponent(escape(atob(x.nota64))).slice(0, 120);
    } catch (e) { /* ignora */ }
    return typeof x.nota === 'string' ? x.nota.slice(0, 120) : '';
  }

  function valido(g) {
    return g && typeof g.id === 'string' && g.id && Number(g.valor) > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(g.data || '');
  }

  function aplicar(remoto) {
    if (!Array.isArray(dados.importados)) dados.importados = [];
    const vistos = new Set(dados.importados);
    let novos = 0, removidos = 0, soma = 0;

    (Array.isArray(remoto.gastos) ? remoto.gastos : []).forEach(g => {
      if (!valido(g) || vistos.has(g.id)) return;
      vistos.add(g.id);
      dados.importados.push(g.id);
      const valor = Math.round(Number(g.valor) * 100) / 100;
      const categoria = CAT[g.categoria] ? g.categoria : adivinharCategoria(String(g.descricao || ''));
      const novo = {
        id: g.id, valor, categoria, data: g.data,
        descricao: String(g.descricao || CAT[categoria].nome).slice(0, 80),
        criado: g.criado || new Date().toISOString(),
        origem: g.origem === 'conta' ? 'conta' : 'chat',
      };
      const nota = lerNota(g);
      if (nota) novo.nota = nota;
      dados.gastos.push(novo);
      novos++; soma += valor;
    });

    let extras = 0;
    // correções em gastos que já existem: {uid, id, descricao?, categoria?, nota64?}
    (Array.isArray(remoto.atualizar) ? remoto.atualizar : []).forEach(u => {
      if (!u || typeof u.uid !== 'string' || vistos.has(u.uid)) return;
      vistos.add(u.uid); dados.importados.push(u.uid);
      const g = dados.gastos.find(x => x.id === u.id);
      if (!g) return;
      if (u.descricao) g.descricao = String(u.descricao).slice(0, 80);
      if (CAT[u.categoria]) g.categoria = u.categoria;
      if (/^\d{4}-\d{2}-\d{2}$/.test(u.data || '')) g.data = u.data;
      if (Number(u.valor) > 0) g.valor = Math.round(Number(u.valor) * 100) / 100;
      const nota = lerNota(u);
      if (nota) g.nota = nota;
      extras++;
    });
    ['contas', 'cartoes', 'compras'].forEach(k => (Array.isArray(remoto[k]) ? remoto[k] : []).forEach(x => {
      if (!x || typeof x.id !== 'string' || !x.id || vistos.has(x.id) || !window.compromissos) return;
      vistos.add(x.id); dados.importados.push(x.id);
      if (!Array.isArray(dados[k])) dados[k] = [];
      dados[k].push(window.compromissos.normalizar(k, x));
      extras++;
    }));

    if (window.saldoAplicarRemoto) extras += window.saldoAplicarRemoto(remoto, vistos);
    if (window.empresaAplicarRemoto) extras += window.empresaAplicarRemoto(remoto, vistos);
    if (window.negativacoesAplicarRemoto) extras += window.negativacoesAplicarRemoto(remoto, vistos);

    (Array.isArray(remoto.apagar) ? remoto.apagar : []).forEach(id => {
      const antes = dados.gastos.length;
      dados.gastos = dados.gastos.filter(g => g.id !== id);
      ['contas', 'cartoes', 'compras', 'entradas', 'aReceber'].forEach(k => { if (Array.isArray(dados[k])) dados[k] = dados[k].filter(x => x.id !== id); });
      if (dados.gastos.length < antes) removidos++;
      if (!vistos.has(id)) { vistos.add(id); dados.importados.push(id); }
    });

    const orc = Number(remoto.orcamento);
    if (orc > 0 && remoto.orcamentoEm && remoto.orcamentoEm > (dados.orcamentoEm || '')) {
      dados.orcamento = orc;
      dados.orcamentoEm = remoto.orcamentoEm;
      const campo = document.getElementById('orcamento');
      if (campo) campo.value = String(orc).replace('.', ',');
    }

    if (novos || removidos || extras || orc > 0) { salvar(); desenharTudo(); }
    if (novos) avisar(`💬 ${novos} gasto(s) do chat chegaram: ${brl(soma)}`);
    else if (extras) avisar(`💬 ${extras} atualização(ões) chegaram do chat`);
    else if (removidos) avisar(`💬 ${removidos} gasto(s) apagado(s) pelo chat`);
  }

  function avisar(txt) {
    const t = document.getElementById('toast');
    document.getElementById('toast-text').textContent = txt;
    document.getElementById('toast-undo').hidden = true;
    t.hidden = false;
    setTimeout(() => { t.hidden = true; document.getElementById('toast-undo').hidden = false; }, 6000);
  }

  const URL_RESERVA = 'https://raw.githubusercontent.com/lucasviu10/meus-gastos/dados/chat.json';
  const status = { quando: null, ok: null, erro: '' };
  window.statusSync = status;

  async function buscar() {
    // 1º: API do GitHub (atualiza na hora). 2º: arquivo direto (sem limite de acessos).
    try {
      const r = await fetch(URL_DADOS, { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-cache' });
      if (r.ok) return await r.json();
    } catch (e) { /* tenta a reserva */ }
    const r2 = await fetch(URL_RESERVA + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r2.ok) throw new Error('GitHub respondeu ' + r2.status);
    return await r2.json();
  }

  async function sincronizar(forcar) {
    if (buscando) return;
    if (!navigator.onLine) { status.ok = false; status.erro = 'Sem internet'; mostrarStatus(); return; }
    if (!forcar && Date.now() - ultimaBusca < INTERVALO_MIN) return;
    buscando = true; ultimaBusca = Date.now(); mostrarStatus('Buscando…');
    try {
      aplicar(await buscar());
      status.ok = true; status.erro = '';
    } catch (e) {
      status.ok = false; status.erro = 'Não consegui buscar. Tente de novo em instantes.';
    }
    status.quando = new Date();
    buscando = false;
    mostrarStatus();
  }

  function mostrarStatus(txt) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    if (txt) { el.textContent = txt; return; }
    if (status.ok === null) { el.textContent = 'Ainda não buscou.'; return; }
    const h = status.quando ? status.quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    el.textContent = status.ok ? `✓ Atualizado com o chat às ${h}` : `⚠️ ${status.erro}`;
    el.className = 'sub ' + (status.ok ? 'ok' : 'bad');
  }
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-sync')) sincronizar(true);
  });

  window.sincronizarChat = sincronizar;
  sincronizar(true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
  window.addEventListener('online', () => sincronizar(true));
})();
