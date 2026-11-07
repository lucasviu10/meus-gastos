// Saldo: quanto você tem agora = saldo inicial + o que entrou − o que saiu.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const r2 = v => Math.round(v * 100) / 100;
  if (!Array.isArray(dados.entradas)) dados.entradas = [];
  if (!Array.isArray(dados.aReceber)) dados.aReceber = [];
  const novoIdE = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- Contas do saldo ----------
  function calcular() {
    if (!Array.isArray(dados.entradas)) dados.entradas = [];
    const ini = dados.saldoInicial;
    if (!ini || !(ini.valor >= 0) || !ini.data) return null;
    const entrou = dados.entradas.filter(e => e.data >= ini.data).reduce((s, e) => s + e.valor, 0);
    const saiu = dados.gastos.filter(g => g.data >= ini.data).reduce((s, g) => s + g.valor, 0);
    const agora = r2(ini.valor + entrou - saiu);
    const aPagar = window.compromissos ? window.compromissos.resumo().aPagar : 0;
    if (!Array.isArray(dados.aReceber)) dados.aReceber = [];
    const aReceber = r2(dados.aReceber.reduce((s, x) => s + x.valor, 0));
    return { inicial: ini.valor, data: ini.data, entrou: r2(entrou), saiu: r2(saiu), agora, aPagar, aReceber,
      depois: r2(agora - aPagar), previsao: r2(agora + aReceber - aPagar) };
  }
  window.saldoAtual = calcular;

  // ---------- Painel ----------
  function desenharSaldo() {
    const el = $('card-saldo');
    const s = calcular();
    if (!s) {
      el.innerHTML = `<span class="rotulo-suave">💰 Quanto sobrou?</span>
        <p class="sub sub-topo">Coloque quanto você tinha no começo e o app calcula o que sobra.</p>
        <div class="linha-entrada"><input id="saldo-rapido" type="text" inputmode="decimal" placeholder="ex: 2770" aria-label="Quanto você tinha no dia 1">
        <button type="button" id="btn-saldo-rapido" class="btn-pagar">Salvar</button></div>
        <p class="sub">Vale a partir do dia 1 deste mês. Dá para mudar em ⚙️ Ajustes.</p>`;
      return;
    }
    const cor = s.agora < 0 ? 'bad' : 'ok';
    const [, m, d] = s.data.split('-');
    let html = `<span class="rotulo-suave">💰 Tenho agora</span>
      <strong class="valor-grande num ${cor}">${brl(s.agora)}</strong>
      <div class="saldo-linhas num">
        <span>Comecei ${d}/${m}</span><b>${brl(s.inicial)}</b>
        <span>➕ Entrou</span><b class="ok">${brl(s.entrou)}</b>
        <span>➖ Saiu</span><b>${brl(s.saiu)}</b>
      </div>`;
    if (dados.aReceber.length) {
      html += `<div class="a-receber"><span class="rotulo-suave">⏳ Ainda vai entrar · ${brl(s.aReceber)}</span>
        <ul class="lista compacta">${dados.aReceber.map(x => `<li><span class="desc">${escapar(x.descricao)}</span>
          <span class="val num">${brl(x.valor)}</span>
          <button type="button" class="btn-pagar" data-recebi="${x.id}">✓ Recebi</button>
          <button type="button" class="del" data-del-receber="${x.id}" aria-label="Apagar">✕</button></li>`).join('')}</ul></div>`;
    }
    if (s.aPagar > 0 || s.aReceber > 0) {
      const partes = [];
      if (s.aReceber > 0) partes.push(`+ ${brl(s.aReceber)} a receber`);
      if (s.aPagar > 0) partes.push(`− ${brl(s.aPagar)} de contas`);
      html += `<p class="saldo-depois">Previsão para o fim do mês (${partes.join(' ')}): <b class="${s.previsao < 0 ? 'bad' : 'ok'}">${brl(s.previsao)}</b></p>`;
    }
    el.innerHTML = html;
  }

  function desenharEntradas() {
    const km = chaveMes(mesVisto);
    const lista = dados.entradas.filter(e => e.data.startsWith(km)).sort((a, b) => b.data.localeCompare(a.data));
    $('lista-entradas').innerHTML = lista.length ? lista.map(e => `<li>
      <span class="emoji">💰</span>
      <span class="desc">${escapar(e.descricao)}<small>${dataLegivel(e.data)}</small></span>
      <span class="val num ok">+${brl(e.valor)}</span>
      <button class="del" data-del-entrada="${e.id}" aria-label="Apagar entrada">✕</button></li>`).join('')
      : '<li class="vazio">Nenhuma entrada neste mês. Para lançar: "+500 comissão".</li>';
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-del-entrada]');
    if (b) {
      const en = dados.entradas.find(x => x.id === b.dataset.delEntrada);
      if (en && confirm(`Apagar entrada ${en.descricao} (${brl(en.valor)})?`)) {
        dados.entradas = dados.entradas.filter(x => x.id !== en.id);
        salvar(); desenharTudo();
      }
    }
    const rc = e.target.closest('[data-recebi]');
    if (rc) {
      const x = dados.aReceber.find(y => y.id === rc.dataset.recebi); if (!x) return;
      dados.aReceber = dados.aReceber.filter(y => y.id !== x.id);
      dados.entradas.push({ id: novoIdE('e'), valor: x.valor, descricao: x.descricao, data: isoDia(new Date()), criado: new Date().toISOString() });
      salvar(); desenharTudo();
      avisarSaldo(`💰 ${x.descricao}: ${brl(x.valor)} entrou no saldo`);
      return;
    }
    const dr = e.target.closest('[data-del-receber]');
    if (dr) {
      const x = dados.aReceber.find(y => y.id === dr.dataset.delReceber);
      if (x && confirm(`Tirar ${x.descricao} (${brl(x.valor)}) do "ainda vai entrar"?`)) {
        dados.aReceber = dados.aReceber.filter(y => y.id !== x.id); salvar(); desenharTudo();
      }
      return;
    }
    if (e.target.closest('#btn-saldo-rapido')) {
      const v = valorDeTexto($('saldo-rapido').value);
      if (!(v >= 0) || $('saldo-rapido').value.trim() === '') { $('saldo-rapido').focus(); return; }
      salvarSaldo(v, chaveMes(new Date()) + '-01');
    }
  });

  function salvarSaldo(valor, data) {
    dados.saldoInicial = { valor: r2(valor), data };
    dados.saldoEm = new Date().toISOString();
    salvar(); preencherAjustes(); desenharTudo();
  }

  // ---------- Ajustes ----------
  function preencherAjustes() {
    const ini = dados.saldoInicial;
    $('saldo-valor').value = ini ? String(ini.valor).replace('.', ',') : '';
    $('saldo-data').value = ini ? ini.data : chaveMes(new Date()) + '-01';
  }
  $('btn-saldo').addEventListener('click', () => {
    const v = valorDeTexto($('saldo-valor').value);
    const d = $('saldo-data').value;
    if (!(v >= 0) || !d) return;
    salvarSaldo(v, d);
    $('btn-saldo').textContent = '✓ Salvo';
    setTimeout(() => { $('btn-saldo').textContent = 'Salvar saldo inicial'; }, 1500);
  });

  function avisarSaldo(txt) {
    ultimoId = null;
    $('toast-text').textContent = txt; $('toast-undo').hidden = true; $('toast').hidden = false;
    setTimeout(() => { $('toast').hidden = true; $('toast-undo').hidden = false; }, 5000);
  }

  // ---------- Lançar entrada: "+500 comissão" ou "recebi 500" ----------
  // "vai entrar 540 ademicon" / "a receber 940 nestlé" = dinheiro que ainda não caiu
  const PALAVRAS_PREVISTO = /(^|\s)(vai entrar|vai cair|a receber|vou receber|falta entrar|falta receber)(\s|$)/;
  const ehPrevisto = t => PALAVRAS_PREVISTO.test(' ' + semAcento(t) + ' ');
  const PALAVRAS_ENTRADA = /(^|\s)(recebi|entrou|entrada|salario|comissao|comissoes|ganhei|renda|reembolso|pix recebido|caiu)(\s|$)/;
  function ehEntrada(texto) { return /^\s*\+/.test(texto) || ehPrevisto(texto) || PALAVRAS_ENTRADA.test(' ' + semAcento(texto) + ' '); }
  function lerEntrada(texto) {
    const limpo = texto.replace(/^\s*\+\s*/, '')
      .replace(/(^|\s)(vai entrar|vai cair|a receber|vou receber|falta entrar|falta receber)(?=\s|$)/gi, ' ')
      .replace(/(^|\s)(recebi|entrou|caiu)(?=\s|$)/gi, ' ');
    const r = interpretar(limpo);
    return { valor: r.valor, descricao: r.descricao || 'entrada', data: r.data };
  }

  const entrada = $('entrada');
  entrada.addEventListener('input', () => {
    if (!ehEntrada(entrada.value)) return;
    const r = lerEntrada(entrada.value);
    if (r.valor > 0) {
      $('preview').innerHTML = ehPrevisto(entrada.value)
        ? `<strong>${brl(r.valor)}</strong> · ⏳ Ainda vai entrar · ${escapar(r.descricao)}`
        : `<strong class="ok">+${brl(r.valor)}</strong> · 💰 Entrada · ${escapar(r.descricao)} · ${dataLegivel(r.data)}`;
      $('btn-salvar').disabled = false;
    }
  });
  // roda antes do salvar normal: se for entrada, guarda como entrada e não como gasto
  $('form-gasto').addEventListener('submit', e => {
    if (!ehEntrada(entrada.value)) return;
    const r = lerEntrada(entrada.value);
    if (!(r.valor > 0)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (ehPrevisto(entrada.value)) {
      dados.aReceber.push({ id: novoIdE('r'), valor: r.valor, descricao: r.descricao });
      salvar(); entrada.value = ''; entrada.dispatchEvent(new Event('input'));
      avisarSaldo(`⏳ ${brl(r.valor)} anotado em "ainda vai entrar"`);
      desenharTudo();
      return;
    }
    const en = { id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), valor: r.valor, descricao: r.descricao, data: r.data, criado: new Date().toISOString() };
    dados.entradas.push(en);
    salvar();
    entrada.value = ''; entrada.dispatchEvent(new Event('input'));
    ultimoId = null;
    $('toast-text').textContent = `💰 Entrada de ${brl(en.valor)} anotada`;
    $('toast-undo').hidden = true;
    $('toast').hidden = false;
    setTimeout(() => { $('toast').hidden = true; $('toast-undo').hidden = false; }, 5000);
    desenharTudo();
  }, true);

  // ---------- Ligar no resto do app ----------
  window.saldoAplicarRemoto = function (remoto, vistos) { // usado pela sincronização com o chat
    let n = 0;
    (Array.isArray(remoto.entradas) ? remoto.entradas : []).forEach(x => {
      if (!x || typeof x.id !== 'string' || vistos.has(x.id) || !(Number(x.valor) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(x.data || '')) return;
      vistos.add(x.id); dados.importados.push(x.id);
      dados.entradas.push({ id: x.id, valor: r2(Number(x.valor)), descricao: String(x.descricao || 'entrada').slice(0, 60), data: x.data, criado: new Date().toISOString() });
      n++;
    });
    if (!Array.isArray(dados.aReceber)) dados.aReceber = [];
    (Array.isArray(remoto.aReceber) ? remoto.aReceber : []).forEach(x => {
      if (!x || typeof x.id !== 'string' || vistos.has(x.id) || !(Number(x.valor) > 0)) return;
      vistos.add(x.id); dados.importados.push(x.id);
      dados.aReceber.push({ id: x.id, valor: r2(Number(x.valor)), descricao: String(x.descricao || 'a receber').slice(0, 60) });
      n++;
    });
    const si = remoto.saldoInicial;
    if (si && Number(si.valor) >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(si.data || '') && remoto.saldoEm && remoto.saldoEm > (dados.saldoEm || '')) {
      dados.saldoInicial = { valor: r2(Number(si.valor)), data: si.data };
      dados.saldoEm = remoto.saldoEm;
      preencherAjustes();
      n++;
    }
    return n;
  };

  preencherAjustes();
  const _anterior = desenharTudo;
  desenharTudo = function () { _anterior(); desenharSaldo(); desenharEntradas(); };
  const _painel = desenharPainel;
  desenharPainel = function () { _painel(); desenharSaldo(); desenharEntradas(); };
  desenharSaldo(); desenharEntradas();
})();
