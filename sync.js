// Sincronização com o chat: o Claude grava gastos no arquivo chat.json (branch "dados")
// do GitHub, e o app puxa sozinho quando você abre ou volta para ele.
'use strict';
(function () {
  const URL_DADOS = 'https://api.github.com/repos/lucasviu10/meus-gastos/contents/chat.json?ref=dados';
  const INTERVALO_MIN = 20000; // não busca mais de uma vez a cada 20 s
  let ultimaBusca = 0, buscando = false;

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
      dados.gastos.push({
        id: g.id, valor, categoria, data: g.data,
        descricao: String(g.descricao || CAT[categoria].nome).slice(0, 80),
        criado: g.criado || new Date().toISOString(),
        origem: 'chat',
      });
      novos++; soma += valor;
    });

    let extras = 0;
    ['contas', 'cartoes', 'compras'].forEach(k => (Array.isArray(remoto[k]) ? remoto[k] : []).forEach(x => {
      if (!x || typeof x.id !== 'string' || !x.id || vistos.has(x.id) || !window.compromissos) return;
      vistos.add(x.id); dados.importados.push(x.id);
      if (!Array.isArray(dados[k])) dados[k] = [];
      dados[k].push(window.compromissos.normalizar(k, x));
      extras++;
    }));

    (Array.isArray(remoto.apagar) ? remoto.apagar : []).forEach(id => {
      const antes = dados.gastos.length;
      dados.gastos = dados.gastos.filter(g => g.id !== id);
      ['contas', 'cartoes', 'compras'].forEach(k => { if (Array.isArray(dados[k])) dados[k] = dados[k].filter(x => x.id !== id); });
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
    else if (extras) avisar(`💬 ${extras} conta(s)/compra(s) chegaram do chat`);
    else if (removidos) avisar(`💬 ${removidos} gasto(s) apagado(s) pelo chat`);
  }

  function avisar(txt) {
    const t = document.getElementById('toast');
    document.getElementById('toast-text').textContent = txt;
    document.getElementById('toast-undo').hidden = true;
    t.hidden = false;
    setTimeout(() => { t.hidden = true; document.getElementById('toast-undo').hidden = false; }, 6000);
  }

  async function sincronizar(forcar) {
    if (buscando || !navigator.onLine) return;
    if (!forcar && Date.now() - ultimaBusca < INTERVALO_MIN) return;
    buscando = true; ultimaBusca = Date.now();
    try {
      const r = await fetch(URL_DADOS, { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-cache' });
      if (r.ok) aplicar(await r.json());
    } catch (e) { /* sem internet ou limite do GitHub: tenta na próxima */ }
    buscando = false;
  }

  window.sincronizarChat = sincronizar;
  sincronizar(true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
  window.addEventListener('online', () => sincronizar(true));
})();
