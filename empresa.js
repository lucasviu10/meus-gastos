// Empresa (LM Serviços LTDA): o que entra, despesas e o que você libera para você.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const r2 = v => Math.round(v * 100) / 100;
  const novoId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function emp() {
    if (!dados.empresa || typeof dados.empresa !== 'object') dados.empresa = {};
    const e = dados.empresa;
    if (!e.nome) e.nome = 'LM Serviços LTDA';
    if (typeof e.cnpj !== 'string') e.cnpj = '';
    if (!Array.isArray(e.movs)) e.movs = [];
    if (!Array.isArray(e.aReceber)) e.aReceber = [];
    return e;
  }
  function formatarCnpj(c) {
    const d = String(c || '').replace(/\D/g, '').slice(0, 14);
    if (d.length !== 14) return d;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }

  function saldoEmpresa() {
    const e = emp();
    const soma = t => r2(e.movs.filter(m => m.tipo === t).reduce((s, m) => s + m.valor, 0));
    const entrou = soma('entrada'), despesas = soma('despesa'), liberado = soma('retirada');
    const aReceber = r2(e.aReceber.reduce((s, x) => s + x.valor, 0));
    return { entrou, despesas, liberado, aReceber, saldo: r2(entrou - despesas - liberado) };
  }
  window.empresaResumo = saldoEmpresa;

  // ---------- Desenhar ----------
  function desenhar() {
    const e = emp();
    $('emp-cabecalho').innerHTML = `<h1>🏢 ${escapar(e.nome)}</h1>
      <p class="sub sub-topo">CNPJ: ${e.cnpj ? formatarCnpj(e.cnpj) : '<i>não informado</i>'}
      · <button type="button" class="btn-link inline" id="emp-editar">✏️ Editar</button></p>`;

    const s = saldoEmpresa();
    let html = `<span class="rotulo-suave">Saldo da empresa</span>
      <strong class="valor-grande num ${s.saldo < 0 ? 'bad' : 'ok'}">${brl(s.saldo)}</strong>
      <div class="saldo-linhas num">
        <span>➕ Entrou</span><b class="ok">${brl(s.entrou)}</b>
        <span>🧾 Despesas</span><b>${brl(s.despesas)}</b>
        <span>💸 Liberado para mim</span><b>${brl(s.liberado)}</b>
      </div>`;
    if (e.aReceber.length) {
      html += `<div class="a-receber"><span class="rotulo-suave">⏳ Ainda vai entrar · ${brl(s.aReceber)}</span>
        <ul class="lista compacta">${e.aReceber.map(x => `<li><span class="desc">${escapar(x.descricao)}</span>
          <span class="val num">${brl(x.valor)}</span>
          <button type="button" class="btn-pagar" data-emp-recebi="${x.id}">✓ Recebi</button>
          <button type="button" class="del" data-emp-del-receber="${x.id}" aria-label="Apagar">✕</button></li>`).join('')}</ul></div>`;
    }
    if (s.saldo > 0) html += `<button type="button" class="btn-primary" id="emp-liberar-tudo">💸 Liberar ${brl(s.saldo)} para mim</button>`;
    $('emp-saldo').innerHTML = html;

    const km = chaveMes(new Date());
    const doMes = e.movs.filter(m => m.data.startsWith(km)).sort((a, b) => b.data.localeCompare(a.data));
    const ICONE = { entrada: '💰', despesa: '🧾', retirada: '💸' };
    $('emp-lista').innerHTML = doMes.length ? doMes.map(m => `<li>
      <span class="emoji">${ICONE[m.tipo]}</span>
      <span class="desc">${escapar(m.descricao)}<small>${dataLegivel(m.data)}${m.tipo === 'retirada' ? ' · foi para o seu saldo' : ''}</small></span>
      <span class="val num ${m.tipo === 'entrada' ? 'ok' : ''}">${m.tipo === 'entrada' ? '+' : '−'}${brl(m.valor)}</span>
      <button class="del" data-emp-del="${m.id}" aria-label="Apagar">✕</button></li>`).join('')
      : '<li class="vazio">Nada este mês. Ex: "540 Ademicon" em 💰 Entrou.</li>';
  }

  // ---------- Dados da empresa ----------
  document.addEventListener('click', ev => {
    if (ev.target.closest('#emp-editar')) {
      const e = emp();
      $('emp-nome').value = e.nome; $('emp-cnpj').value = formatarCnpj(e.cnpj);
      $('form-emp-dados').hidden = false; $('emp-nome').focus();
    }
  });
  $('emp-dados-cancelar').addEventListener('click', () => { $('form-emp-dados').hidden = true; });
  $('emp-cnpj').addEventListener('input', () => {
    const d = $('emp-cnpj').value.replace(/\D/g, '');
    if (d.length === 14) $('emp-cnpj').value = formatarCnpj(d);
  });
  $('form-emp-dados').addEventListener('submit', ev => {
    ev.preventDefault();
    const e = emp();
    e.nome = $('emp-nome').value.trim() || 'LM Serviços LTDA';
    e.cnpj = $('emp-cnpj').value.replace(/\D/g, '').slice(0, 14);
    e.dadosEm = new Date().toISOString();
    $('form-emp-dados').hidden = true;
    salvar(); desenharTudo();
  });

  // ---------- Lançar movimento ----------
  let tipo = 'entrada';
  function mostrarTipo() {
    document.querySelectorAll('#tipo-emp [data-te]').forEach(b => b.classList.toggle('sel', b.dataset.te === tipo));
    $('emp-previsto-linha').hidden = tipo !== 'entrada';
    $('emp-texto').placeholder = { entrada: 'ex: 540 Ademicon', despesa: 'ex: 220 contador', retirada: 'ex: 500 (quanto vai para você)' }[tipo];
    preview();
  }
  $('tipo-emp').addEventListener('click', ev => { const b = ev.target.closest('[data-te]'); if (b) { tipo = b.dataset.te; mostrarTipo(); } });
  function ler() {
    const r = interpretar($('emp-texto').value);
    const padrao = { entrada: 'entrada', despesa: 'despesa', retirada: 'retirada para mim' }[tipo];
    return { valor: r.valor, descricao: r.descricao || padrao, data: r.data };
  }
  function preview() {
    if (!$('emp-texto').value.trim()) { $('emp-preview').textContent = 'Valor e o que foi.'; $('emp-salvar').disabled = true; return; }
    const r = ler();
    if (!(r.valor > 0)) { $('emp-preview').textContent = 'Falta o valor.'; $('emp-salvar').disabled = true; return; }
    const txt = tipo === 'retirada' ? `💸 ${brl(r.valor)} sai da empresa e entra no seu saldo pessoal`
      : tipo === 'despesa' ? `🧾 Despesa da empresa: ${brl(r.valor)} · ${escapar(r.descricao)}`
      : $('emp-previsto').checked ? `⏳ Ainda vai entrar: ${brl(r.valor)} · ${escapar(r.descricao)}`
      : `💰 Entrou na empresa: ${brl(r.valor)} · ${escapar(r.descricao)}`;
    $('emp-preview').innerHTML = txt;
    $('emp-salvar').disabled = false;
  }
  $('emp-texto').addEventListener('input', preview);
  $('emp-previsto').addEventListener('change', preview);

  function liberar(valor, descricao, data) {
    const e = emp();
    const id = novoId('m'), idPessoal = novoId('e');
    e.movs.push({ id, tipo: 'retirada', valor: r2(valor), descricao, data, ligado: idPessoal });
    if (!Array.isArray(dados.entradas)) dados.entradas = [];
    dados.entradas.push({ id: idPessoal, valor: r2(valor), descricao: `${e.nome} (liberado)`, data, criado: new Date().toISOString() });
  }

  $('form-emp').addEventListener('submit', ev => {
    ev.preventDefault();
    const r = ler(); if (!(r.valor > 0)) return;
    const e = emp();
    let msg;
    if (tipo === 'retirada') { liberar(r.valor, r.descricao, r.data); msg = `💸 ${brl(r.valor)} liberado para você`; }
    else if (tipo === 'entrada' && $('emp-previsto').checked) { e.aReceber.push({ id: novoId('r'), valor: r.valor, descricao: r.descricao }); msg = `⏳ ${brl(r.valor)} anotado em "ainda vai entrar"`; }
    else { e.movs.push({ id: novoId('m'), tipo, valor: r.valor, descricao: r.descricao, data: r.data }); msg = `✓ ${tipo === 'entrada' ? 'Entrada' : 'Despesa'} de ${brl(r.valor)} na empresa`; }
    $('emp-texto').value = ''; $('emp-previsto').checked = false; preview();
    salvar(); desenharTudo(); avisar(msg);
  });

  document.addEventListener('click', ev => {
    const e = emp();
    const rc = ev.target.closest('[data-emp-recebi]');
    if (rc) {
      const x = e.aReceber.find(y => y.id === rc.dataset.empRecebi); if (!x) return;
      e.aReceber = e.aReceber.filter(y => y.id !== x.id);
      e.movs.push({ id: novoId('m'), tipo: 'entrada', valor: x.valor, descricao: x.descricao, data: isoDia(new Date()) });
      salvar(); desenharTudo(); avisar(`💰 ${x.descricao}: ${brl(x.valor)} entrou na empresa`);
      return;
    }
    const dr = ev.target.closest('[data-emp-del-receber]');
    if (dr) {
      const x = e.aReceber.find(y => y.id === dr.dataset.empDelReceber);
      if (x && confirm(`Tirar ${x.descricao} (${brl(x.valor)}) do "ainda vai entrar"?`)) { e.aReceber = e.aReceber.filter(y => y.id !== x.id); salvar(); desenharTudo(); }
      return;
    }
    const dm = ev.target.closest('[data-emp-del]');
    if (dm) {
      const m = e.movs.find(y => y.id === dm.dataset.empDel);
      if (m && confirm(`Apagar ${m.descricao} (${brl(m.valor)})?`)) {
        e.movs = e.movs.filter(y => y.id !== m.id);
        if (m.ligado) dados.entradas = (dados.entradas || []).filter(x => x.id !== m.ligado);
        salvar(); desenharTudo();
      }
      return;
    }
    if (ev.target.closest('#emp-liberar-tudo')) {
      const s = saldoEmpresa();
      if (s.saldo > 0 && confirm(`Liberar ${brl(s.saldo)} da empresa para você?`)) {
        liberar(s.saldo, 'retirada para mim', isoDia(new Date()));
        salvar(); desenharTudo(); avisar(`💸 ${brl(s.saldo)} liberado para você`);
      }
    }
  });

  function avisar(txt) {
    ultimoId = null;
    $('toast-text').textContent = txt; $('toast-undo').hidden = true; $('toast').hidden = false;
    setTimeout(() => { $('toast').hidden = true; $('toast-undo').hidden = false; }, 5000);
  }

  // ---------- Chat ----------
  window.empresaAplicarRemoto = function (remoto, vistos) {
    const r = remoto.empresa; if (!r || typeof r !== 'object') return 0;
    const e = emp(); let n = 0;
    if (r.dadosEm && r.dadosEm > (e.dadosEm || '')) {
      if (r.nome) e.nome = String(r.nome).slice(0, 80);
      if (typeof r.cnpj === 'string') e.cnpj = r.cnpj.replace(/\D/g, '').slice(0, 14);
      e.dadosEm = r.dadosEm; n++;
    }
    (Array.isArray(r.aReceber) ? r.aReceber : []).forEach(x => {
      if (!x || typeof x.id !== 'string' || vistos.has(x.id) || !(Number(x.valor) > 0)) return;
      vistos.add(x.id); dados.importados.push(x.id);
      e.aReceber.push({ id: x.id, valor: r2(Number(x.valor)), descricao: String(x.descricao || 'a receber').slice(0, 60) }); n++;
    });
    (Array.isArray(r.movs) ? r.movs : []).forEach(x => {
      if (!x || typeof x.id !== 'string' || vistos.has(x.id) || !(Number(x.valor) > 0) || !['entrada', 'despesa'].includes(x.tipo)) return;
      vistos.add(x.id); dados.importados.push(x.id);
      e.movs.push({ id: x.id, tipo: x.tipo, valor: r2(Number(x.valor)), descricao: String(x.descricao || x.tipo).slice(0, 60),
        data: /^\d{4}-\d{2}-\d{2}$/.test(x.data || '') ? x.data : isoDia(new Date()) }); n++;
    });
    return n;
  };

  // ---------- Ajustes no topo ----------
  $('btn-ajustes').addEventListener('click', () => document.querySelector('.abas button[data-tab="ajustes"]').click());

  emp();
  mostrarTipo();
  const _anterior = desenharTudo;
  desenharTudo = function () { _anterior(); desenhar(); };
  desenhar();
})();
