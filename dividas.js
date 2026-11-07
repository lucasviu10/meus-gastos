// Negativações (Serasa): ficam separadas. Só entram no plano se você ligar "Somar no meu plano".
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const r2 = v => Math.round(v * 100) / 100;
  const lista = () => { if (!Array.isArray(dados.negativacoes)) dados.negativacoes = []; return dados.negativacoes; };

  function resumo() {
    const abertas = lista().filter(n => !n.quitada);
    return {
      total: r2(abertas.reduce((s, n) => s + n.valor, 0)),
      noPlano: r2(abertas.filter(n => n.incluir).reduce((s, n) => s + n.valor, 0)),
      qtd: abertas.length,
    };
  }
  window.negativacoesResumo = resumo;

  function desenhar() {
    const r = resumo();
    $('neg-total').textContent = brl(r.total);
    $('neg-sub').textContent = r.noPlano
      ? `${brl(r.noPlano)} está somado no seu plano. O resto fica só para você saber que existe.`
      : 'Fica separado: não entra no saldo, nas despesas nem no "posso gastar hoje".';
    const ordenadas = [...lista()].sort((a, b) => (a.quitada - b.quitada) || b.valor - a.valor);
    $('neg-lista').innerHTML = ordenadas.length ? ordenadas.map(n => `<li class="conta ${n.quitada ? 'st-quitada' : n.incluir ? 'st-pagar' : 'st-neg'}">
      <div class="conta-topo"><span>⚠️ ${escapar(n.credor)}</span><strong class="num">${brl(n.valor)}</strong></div>
      ${n.obs ? `<p class="sub">${escapar(n.obs)}</p>` : ''}
      ${n.quitada ? '<div class="conta-tags"><span class="tag tag-emdia">Quitada 🎉</span></div>' : `
      <label class="check troca"><input type="checkbox" data-neg-incluir="${n.id}" ${n.incluir ? 'checked' : ''}> Somar no meu plano deste mês</label>`}
      <div class="conta-acoes">
        ${n.quitada ? '' : `<button type="button" class="btn-pagar" data-neg-quitei="${n.id}">✓ Quitei</button>`}
        <button type="button" class="btn-link" data-neg-apagar="${n.id}">Apagar</button>
      </div></li>`).join('')
      : '<li class="vazio">Nenhuma negativação cadastrada.</li>';
  }

  // abas internas da aba Contas
  document.querySelectorAll('[data-seg2]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-seg2]').forEach(x => x.classList.toggle('sel', x === b));
    $('seg-contas').hidden = b.dataset.seg2 !== 'contas';
    $('seg-neg').hidden = b.dataset.seg2 !== 'neg';
  }));

  // formulário
  const abrir = sim => { $('form-neg').hidden = !sim; $('btn-nova-neg').hidden = sim; if (sim) { $('form-neg').reset(); $('neg-credor').focus(); } };
  $('btn-nova-neg').addEventListener('click', () => abrir(true));
  $('neg-cancelar').addEventListener('click', () => abrir(false));
  $('form-neg').addEventListener('submit', e => {
    e.preventDefault();
    const credor = $('neg-credor').value.trim();
    const valor = valorDeTexto($('neg-valor').value);
    if (!credor) { $('neg-credor').focus(); return; }
    if (!(valor > 0)) { $('neg-valor').focus(); return; }
    lista().push({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), credor: credor.slice(0, 60), valor: r2(valor),
      obs: $('neg-obs').value.trim().slice(0, 100), incluir: false, quitada: false });
    salvar(); abrir(false); desenharTudo();
  });

  document.addEventListener('change', e => {
    const c = e.target.closest('[data-neg-incluir]'); if (!c) return;
    const n = lista().find(x => x.id === c.dataset.negIncluir); if (!n) return;
    n.incluir = c.checked; salvar(); desenharTudo();
  });
  document.addEventListener('click', e => {
    const q = e.target.closest('[data-neg-quitei]');
    if (q) {
      const n = lista().find(x => x.id === q.dataset.negQuitei);
      if (n && confirm(`Marcar ${n.credor} como quitada? (Se pagou agora, lance o valor pago como gasto também.)`)) { n.quitada = true; n.incluir = false; salvar(); desenharTudo(); }
      return;
    }
    const a = e.target.closest('[data-neg-apagar]');
    if (a) {
      const n = lista().find(x => x.id === a.dataset.negApagar);
      if (n && confirm(`Apagar ${n.credor} da lista?`)) { dados.negativacoes = lista().filter(x => x.id !== n.id); salvar(); desenharTudo(); }
    }
  });

  // pelo chat: {"negativacoes": [{"id": "n-...", "credor": "...", "valor": 1500, "obs": "..."}]}
  window.negativacoesAplicarRemoto = function (remoto, vistos) {
    let n = 0;
    (Array.isArray(remoto.negativacoes) ? remoto.negativacoes : []).forEach(x => {
      if (!x || typeof x.id !== 'string' || vistos.has(x.id) || !(Number(x.valor) > 0)) return;
      vistos.add(x.id); dados.importados.push(x.id);
      lista().push({ id: x.id, credor: String(x.credor || 'dívida').slice(0, 60), valor: r2(Number(x.valor)),
        obs: String(x.obs || '').slice(0, 100), incluir: !!x.incluir, quitada: false });
      n++;
    });
    return n;
  };

  const _anterior = desenharTudo;
  desenharTudo = function () { _anterior(); desenhar(); };
  desenhar();
})();
