// Contas fixas, parcelas e cartões de crédito: o que ainda vai sair.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const r2 = v => Math.round(v * 100) / 100;

  // ---------- Meses ----------
  const mesAtual = () => chaveMes(new Date());
  function addMes(km, n) { const [a, m] = km.split('-').map(Number); return chaveMes(new Date(a, m - 1 + n, 1)); }
  function difMes(de, ate) { const [a1, m1] = de.split('-').map(Number), [a2, m2] = ate.split('-').map(Number); return (a2 - a1) * 12 + (m2 - m1); }
  function nomeMes(km, curto) {
    const [a, m] = km.split('-').map(Number);
    const n = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: curto ? 'short' : 'long' }).replace('.', '');
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  const ehMes = s => /^\d{4}-\d{2}$/.test(s || '');

  function garantir() {
    ['contas', 'cartoes', 'compras'].forEach(k => { if (!Array.isArray(dados[k])) dados[k] = []; });
  }
  const novoId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- Contas ----------
  // conta: {id, nome, tipo:'fixa'|'parcelada'|'unica', valor, total, pagas, proxMes, dia, categoria}
  const restantes = c => c.tipo === 'fixa' ? Infinity : Math.max(0, c.total - c.pagas);
  function devidoAte(c, km) { // tudo que vence até o mês km e não foi pago (inclui atrasadas)
    const d = difMes(c.proxMes, km);
    return d < 0 ? 0 : Math.min(d + 1, restantes(c)) * c.valor;
  }
  function devidoNoMes(c, km) { // só a parcela que vence exatamente no mês km
    const d = difMes(c.proxMes, km);
    return d >= 0 && d < restantes(c) ? c.valor : 0;
  }
  function statusConta(c) {
    if (restantes(c) <= 0) return 'quitada';
    const d = difMes(c.proxMes, mesAtual());
    return d > 0 ? 'atrasada' : d === 0 ? 'pagar' : 'emdia';
  }

  // ---------- Cartões ----------
  // cartao: {id, nome, limite, fecha, vence, inicio, pagas:[YYYY-MM]}
  // compra: {id, cartaoId, descricao, valor (total), parcelas, data, categoria}
  function vencimentoDe(cartao, dataISO) {
    const d = new Date(dataISO + 'T12:00');
    const fechaMes = d.getDate() < cartao.fecha ? chaveMes(d) : addMes(chaveMes(d), 1);
    return cartao.vence > cartao.fecha ? fechaMes : addMes(fechaMes, 1);
  }
  function inicioCartao(cartao) { // primeira fatura ainda não paga quando o cartão foi cadastrado
    const hoje = new Date();
    return hoje.getDate() <= cartao.vence ? mesAtual() : addMes(mesAtual(), 1);
  }
  const faturaAberta = cartao => vencimentoDe(cartao, isoDia(new Date()));
  function parcelasDa(compra, cartao) {
    const primeira = ehMes(compra.primeiraFatura) ? compra.primeiraFatura : vencimentoDe(cartao, compra.data);
    if (compra.fixa) { // cobrança todo mês (academia, assinatura): mostra 12 meses à frente
      const n = Math.max(0, difMes(primeira, addMes(mesAtual(), 12)) + 1);
      return Array.from({ length: n }, (_, k) => ({ compra, k: k + 1, n: null, fixa: true, mes: addMes(primeira, k), valor: r2(compra.valor) }));
    }
    const n = Math.max(1, compra.parcelas | 0);
    const base = Math.floor((compra.valor / n) * 100) / 100;
    return Array.from({ length: n }, (_, k) => ({
      compra, k: k + 1, n, mes: addMes(primeira, k),
      valor: k === n - 1 ? r2(compra.valor - base * (n - 1)) : base,
    }));
  }
  const faturaPaga = (cartao, km) => (cartao.pagas || []).includes(km) || difMes(km, cartao.inicio) > 0;
  function parcelasDoCartao(cartao) {
    return dados.compras.filter(c => c.cartaoId === cartao.id).flatMap(c => parcelasDa(c, cartao));
  }
  function faturas(cartao) { // {mes: {total, itens}} só das não pagas
    const f = {};
    parcelasDoCartao(cartao).forEach(p => {
      if (faturaPaga(cartao, p.mes)) return;
      (f[p.mes] = f[p.mes] || { total: 0, itens: [] }).itens.push(p);
      f[p.mes].total = r2(f[p.mes].total + p.valor);
    });
    return f;
  }
  function usoCartao(cartao) {
    const f = faturas(cartao);
    const aberta = faturaAberta(cartao);
    // limite: parcelas que faltam + fixas só até a fatura aberta (as futuras ainda não foram cobradas)
    let usado = 0, divida = 0;
    Object.entries(f).forEach(([m, x]) => x.itens.forEach(p => {
      if (!p.fixa) { usado += p.valor; divida += p.valor; } else if (difMes(m, aberta) >= 0) usado += p.valor;
    }));
    const meses = Object.keys(f).sort();
    return { cartao, faturas: f, meses, usado: r2(usado), divida: r2(divida), disponivel: r2(cartao.limite - usado) };
  }

  // ---------- Resumo (usado pelo painel e pela assistente) ----------
  function resumo() {
    garantir();
    const km = mesAtual();
    const itens = [];
    dados.contas.forEach(c => { const v = devidoAte(c, km); if (v > 0) itens.push({ nome: c.nome, valor: v, tipo: 'conta' }); });
    const cartoes = dados.cartoes.map(usoCartao);
    cartoes.forEach(u => u.meses.filter(m => difMes(m, km) >= 0)
      .forEach(m => itens.push({ nome: `Fatura ${u.cartao.nome}`, valor: u.faturas[m].total, tipo: 'fatura' })));
    const aPagar = r2(itens.reduce((s, i) => s + i.valor, 0));
    const proximos = [1, 2, 3].map(i => {
      const m = addMes(km, i);
      const contas = dados.contas.reduce((s, c) => s + devidoNoMes(c, m), 0);
      const fat = cartoes.reduce((s, u) => s + (u.faturas[m] ? u.faturas[m].total : 0), 0);
      return { mes: m, total: r2(contas + fat) };
    });
    const faltaParcelas = r2(dados.contas.filter(c => c.tipo === 'parcelada').reduce((s, c) => s + restantes(c) * c.valor, 0));
    return { aPagar, itens, proximos, cartoes, faltaParcelas };
  }

  function normalizar(tipo, x) {
    if (tipo === 'contas') {
      const t = ['fixa', 'parcelada', 'unica'].includes(x.tipo) ? x.tipo : 'fixa';
      return { id: x.id, nome: String(x.nome || 'Conta').slice(0, 60), tipo: t, valor: r2(Number(x.valor) || 0),
        total: t === 'fixa' ? null : t === 'unica' ? 1 : Math.max(1, x.total | 0), pagas: Math.max(0, x.pagas | 0),
        proxMes: ehMes(x.proxMes) ? x.proxMes : mesAtual(), dia: Math.min(31, Math.max(1, x.dia | 0 || 10)),
        categoria: CAT[x.categoria] ? x.categoria : 'contas' };
    }
    if (tipo === 'cartoes') {
      const c = { id: x.id, nome: String(x.nome || 'Cartão').slice(0, 40), limite: r2(Number(x.limite) || 0),
        fecha: Math.min(31, Math.max(1, x.fecha | 0 || 1)), vence: Math.min(31, Math.max(1, x.vence | 0 || 10)), pagas: [] };
      c.inicio = ehMes(x.inicio) ? x.inicio : inicioCartao(c);
      return c;
    }
    const c = { id: x.id, cartaoId: String(x.cartaoId || ''), descricao: String(x.descricao || 'compra').slice(0, 60),
      valor: r2(Number(x.valor) || 0), parcelas: Math.max(1, x.parcelas | 0),
      data: /^\d{4}-\d{2}-\d{2}$/.test(x.data || '') ? x.data : isoDia(new Date()),
      categoria: CAT[x.categoria] ? x.categoria : adivinharCategoria(String(x.descricao || '')) };
    if (x.fixa) c.fixa = true;
    const cartao = dados.cartoes.find(k => k.id === c.cartaoId);
    if (ehMes(x.primeiraFatura)) c.primeiraFatura = x.primeiraFatura;
    else if ((x.fixa || x.parcelaAtual) && cartao) c.primeiraFatura = addMes(faturaAberta(cartao), -(Math.max(1, x.parcelaAtual | 0) - 1));
    return c;
  }
  window.compromissos = { resumo, normalizar };

  // ---------- Aviso com "Desfazer" ----------
  let desfazerExtra = null, timer = null;
  function aviso(txt, desfazer) {
    ultimoId = null; // não deixa o "Desfazer" do Lançar apagar outro gasto
    $('toast-text').textContent = txt;
    $('toast-undo').hidden = !desfazer;
    desfazerExtra = desfazer || null;
    $('toast').hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { $('toast').hidden = true; $('toast-undo').hidden = false; desfazerExtra = null; }, 6000);
  }
  $('toast-undo').addEventListener('click', () => {
    if (!desfazerExtra) return;
    const f = desfazerExtra; desfazerExtra = null; f(); salvar(); desenharTudo();
  });
  function lancarGasto(valor, descricao, categoria) {
    const g = { id: novoId('p'), valor: r2(valor), descricao, categoria, data: isoDia(new Date()), criado: new Date().toISOString(), origem: 'conta' };
    dados.gastos.push(g);
    return g.id;
  }
  const tirarGastos = ids => { dados.gastos = dados.gastos.filter(g => !ids.includes(g.id)); };

  // ---------- Desenhar: resumo ----------
  function desenharResumo() {
    const r = resumo();
    $('ct-apagar').textContent = brl(r.aPagar);
    $('ct-apagar-sub').textContent = r.itens.length
      ? r.itens.slice(0, 4).map(i => `${i.nome} ${brl(i.valor)}`).join(' · ') + (r.itens.length > 4 ? ' …' : '')
      : 'Nada pendente este mês. 👏';
    $('ct-proximos').innerHTML = r.proximos.map(p =>
      `<div><small>${nomeMes(p.mes, true)}</small><strong class="num">${brl(p.total)}</strong></div>`).join('');

    // cartão no Painel
    const el = $('painel-compromissos');
    const tem = dados.contas.length || dados.cartoes.length;
    el.hidden = !tem;
    if (tem) {
      const km = mesAtual();
      const gastoMes = dados.gastos.filter(g => g.data.startsWith(km)).reduce((s, g) => s + g.valor, 0);
      let html = `<span class="rotulo-suave">📅 Ainda vai sair este mês</span><strong class="valor-medio num">${brl(r.aPagar)}</strong>`;
      if (dados.orcamento > 0) {
        const sobra = dados.orcamento - gastoMes - r.aPagar;
        html += `<span class="sub">Sobra de verdade, já tirando as contas: <b class="${sobra < 0 ? 'bad' : 'ok'}">${brl(sobra)}</b></span>`;
      }
      html += `<span class="sub">Ver contas ›</span>`;
      el.innerHTML = html;
    }
  }
  $('painel-compromissos').addEventListener('click', () => document.querySelector('.abas button[data-tab="contas"]').click());

  // ---------- Desenhar: contas ----------
  const ORDEM = { atrasada: 0, pagar: 1, emdia: 2, quitada: 3 };
  function desenharContas() {
    const lista = [...dados.contas].sort((a, b) => ORDEM[statusConta(a)] - ORDEM[statusConta(b)] || a.dia - b.dia);
    $('lista-contas').innerHTML = lista.length ? lista.map(c => {
      const st = statusConta(c);
      const cat = CAT[c.categoria] || CAT.contas;
      const tag = c.tipo === 'fixa' ? '🔁 Fixa' : c.tipo === 'unica' ? '1️⃣ Única'
        : `Parcela ${Math.min(c.pagas + 1, c.total)} de ${c.total}`;
      const stTxt = { atrasada: `Atrasada desde ${nomeMes(c.proxMes, true)}`, pagar: `Vence dia ${c.dia}`,
        emdia: c.tipo === 'unica' ? `Vence ${pad(c.dia)}/${c.proxMes.slice(5)}` : `Paga ✓ · próxima em ${nomeMes(c.proxMes, true)}`, quitada: 'Quitada 🎉' }[st];
      let extra = '';
      if (c.tipo === 'parcelada') {
        const pago = c.pagas * c.valor, total = c.total * c.valor;
        extra = `<div class="barra fina"><div class="barra-cheia" style="width:${Math.min(100, c.pagas / c.total * 100)}%"></div></div>
          <p class="sub">Pago ${brl(pago)} · <b>Falta ${brl(total - pago)}</b> · Total ${brl(total)}</p>`;
      }
      const podePagar = st === 'atrasada' || st === 'pagar';
      const podeDesmarcar = !!ultimoPagamento(c);
      const estaPaga = (st === 'emdia' || st === 'quitada') && podeDesmarcar;
      return `<li class="conta st-${st}">
        <div class="conta-topo"><span>${cat.emoji} ${escapar(c.nome)}</span><strong class="num">${brl(c.valor)}</strong></div>
        <div class="conta-tags"><span class="tag">${tag}</span><span class="tag tag-${st}">${stTxt}</span></div>
        ${extra}
        <div class="conta-acoes">
          ${podePagar ? `<button type="button" class="btn-pagar" data-pagar-conta="${c.id}">✓ Paguei</button>` : ''}
          ${estaPaga ? `<button type="button" class="btn-paga" data-desmarcar-conta="${c.id}">✓ Paga · toque para desfazer</button>` : ''}
          ${podePagar && podeDesmarcar && Array.isArray(c.pagamentos) && c.pagamentos.length ? `<button type="button" class="btn-desmarcar" data-desmarcar-conta="${c.id}">↩️ Desfazer último</button>` : ''}
          <button type="button" class="btn-link" data-apagar-conta="${c.id}">Apagar</button>
        </div></li>`;
    }).join('') : '<li class="vazio">Nenhuma conta ainda. Cadastre aluguel, financiamento, internet…</li>';
  }

  // último pagamento marcado (para poder desmarcar). Pagamentos antigos: acha pelo gasto lançado.
  function ultimoPagamento(c) {
    if (Array.isArray(c.pagamentos) && c.pagamentos.length) return c.pagamentos[c.pagamentos.length - 1];
    if (!(c.pagas > 0)) return null;
    if (difMes(mesAtual(), c.proxMes) <= 0) return null; // nada pago no período atual
    const g = dados.gastos.filter(x => x.origem === 'conta' && (x.descricao === c.nome || x.descricao.startsWith(c.nome + ' (')))
      .sort((a, b) => b.criado.localeCompare(a.criado))[0];
    return { gastoId: g ? g.id : null, antes: { pagas: c.pagas - 1, proxMes: addMes(c.proxMes, -1) } };
  }

  $('lista-contas').addEventListener('click', e => {
    const dz = e.target.closest('[data-desmarcar-conta]');
    if (dz) {
      const c = dados.contas.find(x => x.id === dz.dataset.desmarcarConta); if (!c) return;
      const u = ultimoPagamento(c); if (!u) return;
      const g = dados.gastos.find(x => x.id === u.gastoId);
      const depois = { pagas: c.pagas, proxMes: c.proxMes };
      const registro = Array.isArray(c.pagamentos) && c.pagamentos.length ? c.pagamentos.pop() : null;
      Object.assign(c, u.antes);
      if (g) tirarGastos([g.id]);
      salvar(); desenharTudo();
      aviso(`↩️ ${c.nome} voltou para "a pagar"${g ? ` e o gasto de ${brl(g.valor)} saiu` : ''}`, () => {
        Object.assign(c, depois);
        if (registro) c.pagamentos.push(registro);
        if (g) dados.gastos.push(g);
      });
      return;
    }
    const p = e.target.closest('[data-pagar-conta]');
    const a = e.target.closest('[data-apagar-conta]');
    if (p) {
      const c = dados.contas.find(x => x.id === p.dataset.pagarConta); if (!c) return;
      const antes = { pagas: c.pagas, proxMes: c.proxMes };
      c.pagas++; c.proxMes = addMes(c.proxMes, 1);
      const desc = c.tipo === 'parcelada' ? `${c.nome} (${c.pagas}/${c.total})` : c.nome;
      const gid = lancarGasto(c.valor, desc, c.categoria);
      if (!Array.isArray(c.pagamentos)) c.pagamentos = [];
      c.pagamentos.push({ gastoId: gid, antes });
      salvar(); desenharTudo();
      aviso(`✓ ${desc}: ${brl(c.valor)} lançado nos gastos`, () => { Object.assign(c, antes); tirarGastos([gid]); });
    }
    if (a) {
      const i = dados.contas.findIndex(x => x.id === a.dataset.apagarConta); if (i < 0) return;
      const [c] = dados.contas.splice(i, 1);
      salvar(); desenharTudo();
      aviso(`Conta apagada: ${c.nome}`, () => dados.contas.splice(i, 0, c));
    }
  });

  // ---------- Formulário de conta ----------
  let tipoConta = 'fixa';
  function ajustarFormConta() {
    document.querySelectorAll('#conta-tipos .chip').forEach(b => b.classList.toggle('sel', b.dataset.tipo === tipoConta));
    $('grupo-parcelas').hidden = tipoConta !== 'parcelada';
    $('grupo-dia').hidden = tipoConta === 'unica';
    $('grupo-data').hidden = tipoConta !== 'unica';
    $('conta-valor-rotulo').textContent = { fixa: 'Valor por mês', parcelada: 'Valor da parcela', unica: 'Valor' }[tipoConta];
    const v = valorDeTexto($('conta-valor').value);
    let txt = '';
    if (v > 0 && tipoConta === 'parcelada') {
      const n = +$('conta-total').value || 0, p = Math.min(+$('conta-pagas').value || 0, n);
      if (n) txt = `${n}x de ${brl(v)} · Total ${brl(v * n)} · Pago ${brl(v * p)} · Falta ${brl(v * (n - p))} (${n - p} parcelas)`;
    } else if (v > 0 && tipoConta === 'fixa') txt = `${brl(v)} todo mês · ${brl(v * 12)} por ano`;
    $('conta-preview').textContent = txt;
  }
  $('conta-tipos').addEventListener('click', e => { const b = e.target.closest('[data-tipo]'); if (b) { tipoConta = b.dataset.tipo; ajustarFormConta(); } });
  ['conta-valor', 'conta-total', 'conta-pagas'].forEach(id => $(id).addEventListener('input', ajustarFormConta));
  function abrirFormConta(abrir) {
    $('form-conta').hidden = !abrir; $('btn-nova-conta').hidden = abrir;
    if (abrir) { $('form-conta').reset(); tipoConta = 'fixa'; ajustarFormConta(); $('conta-nome').focus(); }
  }
  $('btn-nova-conta').addEventListener('click', () => abrirFormConta(true));
  $('conta-cancelar').addEventListener('click', () => abrirFormConta(false));
  $('form-conta').addEventListener('submit', e => {
    e.preventDefault();
    const nome = $('conta-nome').value.trim();
    const valor = valorDeTexto($('conta-valor').value);
    if (!nome) { $('conta-preview').textContent = 'Falta o nome da conta.'; $('conta-nome').focus(); return; }
    if (!(valor > 0)) { $('conta-preview').textContent = 'Falta o valor.'; $('conta-valor').focus(); return; }
    const c = { id: novoId('k'), nome, tipo: tipoConta, valor: r2(valor), categoria: adivinharCategoria(nome) };
    if (c.categoria === 'outros') c.categoria = 'contas';
    if (tipoConta === 'unica') {
      const d = $('conta-data').value;
      if (!d) { $('conta-preview').textContent = 'Escolha a data do vencimento.'; return; }
      Object.assign(c, { total: 1, pagas: 0, proxMes: d.slice(0, 7), dia: +d.slice(8) });
    } else {
      const dia = +$('conta-dia').value;
      if (!(dia >= 1 && dia <= 31)) { $('conta-preview').textContent = 'Coloque o dia do vencimento (1 a 31).'; $('conta-dia').focus(); return; }
      const pagaMes = $('conta-paga-mes').checked;
      c.dia = dia;
      c.proxMes = pagaMes ? addMes(mesAtual(), 1) : mesAtual();
      if (tipoConta === 'parcelada') {
        const n = +$('conta-total').value;
        if (!(n >= 1)) { $('conta-preview').textContent = 'Coloque o total de parcelas.'; $('conta-total').focus(); return; }
        c.total = n; c.pagas = Math.min(Math.max(0, +$('conta-pagas').value || 0), n);
      } else { c.total = null; c.pagas = 0; }
    }
    garantir(); dados.contas.push(c); salvar(); abrirFormConta(false); desenharTudo();
    aviso(`✓ Conta salva: ${nome}`);
  });

  function desenharCompras(cartao) {
    const aberta = faturaAberta(cartao);
    const ativas = dados.compras.filter(c => c.cartaoId === cartao.id).map(c => {
      const ps = parcelasDa(c, cartao).filter(p => !faturaPaga(cartao, p.mes));
      return { c, ps };
    }).filter(x => x.c.fixa || (x.c.parcelas > 1 && x.ps.length));
    if (!ativas.length) return '';
    return `<details class="compras-ativas"><summary>Parcelados e fixos neste cartão (${ativas.length})</summary><ul class="lista compacta">${ativas.map(({ c, ps }) => {
      const info = c.fixa ? `🔁 ${brl(c.valor)} todo mês` : `${brl(c.valor / c.parcelas)} · faltam ${ps.length} de ${c.parcelas} · resta ${brl(ps.reduce((s, p) => s + p.valor, 0))}`;
      return `<li><span class="emoji">${(CAT[c.categoria] || CAT.outros).emoji}</span><span class="desc">${escapar(c.descricao)}<small>${info}</small></span>
        <button type="button" class="del" data-apagar-compra="${c.id}" aria-label="Apagar">✕</button></li>`;
    }).join('')}</ul></details>`;
  }

  // ---------- Desenhar: cartões ----------
  function desenharCartoes() {
    $('form-compra').hidden = !dados.cartoes.length;
    const sel = $('compra-cartao');
    sel.hidden = dados.cartoes.length < 2;
    const atual = sel.value;
    sel.innerHTML = dados.cartoes.map(c => `<option value="${c.id}">${escapar(c.nome)}</option>`).join('');
    if (atual && dados.cartoes.some(c => c.id === atual)) sel.value = atual;

    $('lista-cartoes').innerHTML = dados.cartoes.length ? dados.cartoes.map(c => {
      const u = usoCartao(c);
      const pct = c.limite ? Math.min(100, (u.usado / c.limite) * 100) : 0;
      const cor = pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'ok';
      const prox = u.meses[0];
      let fatura = '<p class="sub">Nenhuma fatura em aberto.</p>';
      if (prox) {
        const f = u.faturas[prox];
        fatura = `<div class="fatura-topo"><span>Fatura de ${nomeMes(prox)} · vence ${pad(c.vence)}/${prox.slice(5)}</span><strong class="num">${brl(f.total)}</strong></div>
          <ul class="lista compacta">${f.itens.map(p => `<li><span class="emoji">${(CAT[p.compra.categoria] || CAT.outros).emoji}</span>
            <span class="desc">${escapar(p.compra.descricao)}${p.fixa ? ' <small>🔁 todo mês</small>' : p.n > 1 ? ` <small>parcela ${p.k}/${p.n} · ${p.n - p.k ? `faltam ${p.n - p.k}` : 'última'}</small>` : ''}</span>
            <span class="val num">${brl(p.valor)}</span>
            <button type="button" class="del" data-apagar-compra="${p.compra.id}" aria-label="Apagar compra">✕</button></li>`).join('')}</ul>
          <button type="button" class="btn-pagar largo" data-pagar-fatura="${c.id}" data-mes="${prox}">✓ Paguei esta fatura</button>`;
      }
      const seguintes = u.meses.slice(1, 5);
      return `<div class="card cartao">
        <div class="conta-topo"><span>💳 ${escapar(c.nome)}</span><button type="button" class="btn-link" data-apagar-cartao="${c.id}">Apagar</button></div>
        <div class="linha-valor"><span class="rotulo-suave">Disponível</span><strong class="valor-medio num ${cor}">${brl(u.disponivel)}</strong></div>
        <div class="barra"><div class="barra-cheia" style="width:${pct}%;background:var(--${cor})"></div></div>
        <p class="sub">Usado ${brl(u.usado)} de ${brl(c.limite)} · fecha dia ${c.fecha} · vence dia ${c.vence}</p>
        ${desenharCompras(c)}
        <div class="fatura">${fatura}</div>
        ${seguintes.length ? `<p class="sub">Próximas faturas: ${seguintes.map(m => `${nomeMes(m, true)} <b>${brl(u.faturas[m].total)}</b>`).join(' · ')}</p>` : ''}
        ${ultimaFaturaPaga(c) ? `<p class="sub">Última fatura paga: ${nomeMes(ultimaFaturaPaga(c).mes)} ·
          <button type="button" class="btn-desmarcar" data-desmarcar-fatura="${c.id}">↩️ Desmarcar</button></p>` : ''}
        <button type="button" class="btn-sec largo" data-add-compra="${c.id}">+ Adicionar compra neste cartão</button>
      </div>`;
    }).join('') : '<p class="vazio card">Cadastre seu cartão para ver limite, fatura e parcelas.</p>';
  }

  function ultimaFaturaPaga(c) {
    return Array.isArray(c.pagamentosFatura) && c.pagamentosFatura.length ? c.pagamentosFatura[c.pagamentosFatura.length - 1] : null;
  }
  $('lista-cartoes').addEventListener('click', e => {
    const df = e.target.closest('[data-desmarcar-fatura]');
    if (df) {
      const c = dados.cartoes.find(x => x.id === df.dataset.desmarcarFatura); if (!c) return;
      const u = ultimaFaturaPaga(c); if (!u) return;
      if (!confirm(`Desmarcar a fatura de ${nomeMes(u.mes)} do ${c.nome}? Os gastos lançados junto serão apagados.`)) return;
      c.pagas = (c.pagas || []).filter(m => m !== u.mes);
      c.pagamentosFatura.pop();
      tirarGastos(u.ids);
      salvar(); desenharTudo();
      aviso(`↩️ Fatura de ${nomeMes(u.mes)} voltou para "a pagar"`);
      return;
    }
    const pf = e.target.closest('[data-pagar-fatura]');
    const ac = e.target.closest('[data-apagar-compra]');
    const ak = e.target.closest('[data-apagar-cartao]');
    if (pf) {
      const c = dados.cartoes.find(x => x.id === pf.dataset.pagarFatura); if (!c) return;
      const mes = pf.dataset.mes;
      const itens = (faturas(c)[mes] || { itens: [] }).itens;
      c.pagas = c.pagas || []; c.pagas.push(mes);
      const ids = itens.map(p => lancarGasto(p.valor,
        `${p.compra.descricao}${p.n > 1 ? ` (${p.k}/${p.n})` : ''} · ${c.nome}`, p.compra.categoria));
      const total = itens.reduce((s, p) => s + p.valor, 0);
      if (!Array.isArray(c.pagamentosFatura)) c.pagamentosFatura = [];
      c.pagamentosFatura.push({ mes, ids });
      salvar(); desenharTudo();
      aviso(`✓ Fatura ${c.nome} paga: ${brl(total)} lançados nos gastos`, () => { c.pagas = c.pagas.filter(m => m !== mes); tirarGastos(ids); });
    }
    if (ac) {
      const i = dados.compras.findIndex(x => x.id === ac.dataset.apagarCompra); if (i < 0) return;
      const [cp] = dados.compras.splice(i, 1);
      salvar(); desenharTudo();
      aviso(`Compra apagada: ${cp.descricao}`, () => dados.compras.splice(i, 0, cp));
    }
    if (ak) {
      const i = dados.cartoes.findIndex(x => x.id === ak.dataset.apagarCartao); if (i < 0) return;
      const [c] = dados.cartoes.splice(i, 1);
      const compras = dados.compras.filter(x => x.cartaoId === c.id);
      dados.compras = dados.compras.filter(x => x.cartaoId !== c.id);
      salvar(); desenharTudo();
      aviso(`Cartão apagado: ${c.nome}`, () => { dados.cartoes.splice(i, 0, c); dados.compras.push(...compras); });
    }
  });

  // ---------- Formulário de cartão ----------
  function abrirFormCartao(abrir) {
    $('form-cartao').hidden = !abrir; $('btn-novo-cartao').hidden = abrir;
    if (abrir) { $('form-cartao').reset(); $('cartao-nome').focus(); }
  }
  $('btn-novo-cartao').addEventListener('click', () => abrirFormCartao(true));
  $('cartao-cancelar').addEventListener('click', () => abrirFormCartao(false));
  $('form-cartao').addEventListener('submit', e => {
    e.preventDefault();
    const nome = $('cartao-nome').value.trim() || 'Cartão';
    const limite = valorDeTexto($('cartao-limite').value);
    const fecha = +$('cartao-fecha').value, vence = +$('cartao-vence').value;
    if (!(limite > 0) || !(fecha >= 1 && fecha <= 31) || !(vence >= 1 && vence <= 31)) {
      aviso('Preencha limite, dia que fecha e dia que vence.'); return;
    }
    garantir();
    dados.cartoes.push(normalizar('cartoes', { id: novoId('c'), nome, limite, fecha, vence }));
    salvar(); abrirFormCartao(false); desenharTudo();
    aviso(`✓ Cartão salvo: ${nome}`);
  });

  // ---------- Compra no cartão: "300 celular 10x" ou "10x de 30 tênis" ----------
  let tipoCompra = 'nova';
  const PH = { nova: 'ex: 300 celular 10x', andamento: 'valor da parcela e o que é. ex: 22,80 Brasil Paralelo', fixa: 'valor por mês. ex: 140 academia' };
  function mostrarTipoCompra() {
    document.querySelectorAll('#tipo-compra [data-tc]').forEach(b => b.classList.toggle('sel', b.dataset.tc === tipoCompra));
    $('grupo-andamento').hidden = tipoCompra !== 'andamento';
    $('compra-texto').placeholder = PH[tipoCompra];
    previewCompra();
  }
  $('tipo-compra').addEventListener('click', e => { const b = e.target.closest('[data-tc]'); if (b) { tipoCompra = b.dataset.tc; mostrarTipoCompra(); } });
  ['compra-k', 'compra-n'].forEach(id => $(id).addEventListener('input', () => previewCompra()));
  $('lista-cartoes').addEventListener('click', e => {
    const b = e.target.closest('[data-add-compra]'); if (!b) return;
    $('compra-cartao').value = b.dataset.addCompra;
    $('form-compra').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => $('compra-texto').focus(), 300);
  });
  function montarCompra(c) { // devolve a compra pronta (ou erro) conforme o tipo escolhido
    const texto = $('compra-texto').value;
    if (tipoCompra === 'nova') {
      const p = lerCompra(texto);
      if (!(p.total > 0)) return { erro: 'Falta o valor. Ex: 300 celular 10x' };
      return { compra: { descricao: p.descricao, valor: p.total, parcelas: p.parcelas, data: p.data, categoria: p.categoria },
        resumo: `<strong>${brl(p.total)}</strong> ${p.parcelas > 1 ? `em ${p.parcelas}x de ${brl(p.total / p.parcelas)}` : 'à vista'} · ${escapar(p.descricao)} · 1ª na fatura de ${nomeMes(vencimentoDe(c, p.data), true)}` };
    }
    const r = interpretar(texto);
    if (!(r.valor > 0)) return { erro: 'Falta o valor.' };
    const desc = r.descricao || 'compra';
    if (tipoCompra === 'fixa') {
      return { compra: { descricao: desc, valor: r.valor, parcelas: 1, fixa: true, data: isoDia(new Date()), categoria: r.categoria, primeiraFatura: faturaAberta(c) },
        resumo: `<strong>${brl(r.valor)}</strong> todo mês · 🔁 ${escapar(desc)} · a partir da fatura de ${nomeMes(faturaAberta(c), true)}` };
    }
    const k = +$('compra-k').value, n = +$('compra-n').value;
    if (!(n >= 2) || !(k >= 1) || k > n) return { erro: 'Preencha: estou na parcela __ de __.' };
    return { compra: { descricao: desc, valor: r2(r.valor * n), parcelas: n, data: isoDia(new Date()), categoria: r.categoria, primeiraFatura: addMes(faturaAberta(c), -(k - 1)) },
      resumo: `<strong>${brl(r.valor)}</strong> por mês · parcela ${k} de ${n} · <b>faltam ${n - k + 1}</b> (${brl(r.valor * (n - k + 1))}) contando a da fatura de ${nomeMes(faturaAberta(c), true)}` };
  }
  function lerCompra(texto) {
    let t = ' ' + texto.trim() + ' ', parcelas = 1, valorParcela = null, m;
    if ((m = t.match(/\s(\d{1,2})\s*x\s*(?:de\s*)?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)(?=\s)/i))) {
      parcelas = +m[1]; valorParcela = valorDeTexto(m[2]); t = t.replace(m[0], ' ');
    } else if ((m = t.match(/\s(\d{1,2})\s*(?:x|vezes|parcelas)(?=\s)/i))) {
      parcelas = +m[1]; t = t.replace(m[0], ' ');
    } else if (/\sà vista\s|\sa vista\s/i.test(t)) t = t.replace(/\s[àa] vista\s/i, ' ');
    const r = interpretar(t);
    const total = valorParcela ? r2(valorParcela * parcelas) : r.valor;
    return { total, parcelas: Math.max(1, parcelas), descricao: r.descricao || 'compra', categoria: r.categoria, data: r.data };
  }
  function previewCompra() {
    const c = dados.cartoes.find(x => x.id === $('compra-cartao').value) || dados.cartoes[0];
    if (!$('compra-texto').value.trim() || !c) {
      $('compra-preview').textContent = { nova: 'Valor, o que foi e parcelas. Ex: 10x de 30 tênis', andamento: 'Para compra antiga: valor da parcela e em qual parcela está.', fixa: 'Cobrança que vem todo mês no cartão.' }[tipoCompra];
      $('compra-salvar').disabled = true; return;
    }
    const m = montarCompra(c);
    if (m.erro) { $('compra-preview').textContent = m.erro; $('compra-salvar').disabled = true; return; }
    $('compra-preview').innerHTML = m.resumo;
    $('compra-salvar').disabled = false;
  }
  $('compra-texto').addEventListener('input', previewCompra);
  $('compra-cartao').addEventListener('change', previewCompra);
  $('form-compra').addEventListener('submit', e => {
    e.preventDefault();
    const c = dados.cartoes.find(x => x.id === $('compra-cartao').value) || dados.cartoes[0];
    if (!c) return;
    const m = montarCompra(c);
    if (m.erro) return;
    const compra = Object.assign({ id: novoId('b'), cartaoId: c.id }, m.compra);
    dados.compras.push(compra);
    $('compra-texto').value = ''; $('compra-k').value = ''; $('compra-n').value = '';
    tipoCompra = 'nova'; mostrarTipoCompra();
    salvar(); desenharTudo();
    aviso(`✓ ${compra.descricao} salvo no ${c.nome}`, () => { dados.compras = dados.compras.filter(x => x.id !== compra.id); });
  });

  // ---------- Abas internas ----------
  document.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-seg]').forEach(x => x.classList.toggle('sel', x === b));
    $('seg-contas').hidden = b.dataset.seg !== 'contas';
    $('seg-cartoes').hidden = b.dataset.seg !== 'cartoes';
  }));

  function desenharResumoCartao() {
    const us = dados.cartoes.map(usoCartao);
    $('cc-divida').textContent = brl(us.reduce((s, u) => s + u.divida, 0));
    $('cc-divida-sub').textContent = us.length
      ? us.map(u => `${u.cartao.nome}: disponível ${brl(u.disponivel)}`).join(' · ') + ' · fixos não entram na dívida'
      : 'Nenhum cartão cadastrado ainda.';
  }
  function desenharCompromissos() { garantir(); desenharResumo(); desenharContas(); desenharCartoes(); desenharResumoCartao(); }
  const _anterior = desenharTudo;
  desenharTudo = function () { _anterior(); desenharCompromissos(); };
  desenharCompromissos();
})();
