// "Posso gastar hoje": quanto sobra livre no mês, dividido pelos dias que faltam.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const r2 = v => Math.round(v * 100) / 100;
  let aberto = false;

  function calcular() {
    const agora = new Date();
    const hoje = isoDia(agora);
    const diasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    const diasRestantes = diasMes - agora.getDate() + 1;
    // gasto do dia a dia de hoje (contas e faturas pagas não entram: já estavam reservadas)
    const gastoHoje = r2(dados.gastos.filter(g => g.data === hoje && g.origem !== 'conta' && g.categoria !== 'contas').reduce((s, g) => s + g.valor, 0));
    const neg = window.negativacoesResumo ? window.negativacoesResumo().noPlano : 0;
    const s = window.saldoAtual ? window.saldoAtual() : null;

    let livreMes, partes;
    if (s) {
      // dinheiro do início do dia: o saldo de agora + o que já gastei hoje
      livreMes = r2(s.agora + gastoHoje + s.aReceber - s.aPagar - neg);
      partes = [['💰 Tenho agora', s.agora], ['↩️ O que já gastei hoje', gastoHoje],
        ['⏳ Ainda vai entrar', s.aReceber], ['📅 Contas e faturas do mês', -s.aPagar]];
      if (neg) partes.push(['⚠️ Negativações no plano', -neg]);
    } else if (dados.orcamento > 0) {
      const km = chaveMes(agora);
      const gastoMes = dados.gastos.filter(g => g.data.startsWith(km)).reduce((t, g) => t + g.valor, 0);
      const aPagar = window.compromissos ? window.compromissos.resumo().aPagar : 0;
      livreMes = r2(dados.orcamento - gastoMes + gastoHoje - aPagar - neg);
      partes = [['🎯 Limite do mês', dados.orcamento], ['➖ Já gastei no mês (sem hoje)', -(gastoMes - gastoHoje)], ['📅 Contas a vencer', -aPagar]];
      if (neg) partes.push(['⚠️ Negativações no plano', -neg]);
    } else return null;

    const porDia = livreMes > 0 ? r2(livreMes / diasRestantes) : 0;
    return { porDia, gastoHoje, resta: r2(porDia - gastoHoje), livreMes, diasRestantes, partes };
  }
  window.possoGastarHoje = calcular;

  function desenhar() {
    const el = $('card-hoje');
    const c = calcular();
    if (!c) {
      el.innerHTML = `<span class="rotulo-suave">🎯 Posso gastar hoje</span>
        <span class="sub">Coloque seu saldo no 📊 Painel (ou um limite em ⚙️ Ajustes) para eu calcular.</span>`;
      return;
    }
    let cor, titulo, valor, sub;
    if (c.livreMes <= 0) {
      cor = 'bad'; titulo = '🎯 Posso gastar hoje'; valor = brl(0);
      sub = `Este mês não sobra para gastos extras. Faltam ${brl(-c.livreMes)} para fechar as contas.`;
    } else if (c.resta < 0) {
      cor = 'bad'; titulo = '🎯 Passei do valor de hoje'; valor = brl(-c.resta);
      sub = `Hoje o valor era ${brl(c.porDia)}. O de amanhã vai diminuir.`;
    } else {
      cor = c.resta >= c.porDia * 0.5 ? 'ok' : 'warn'; titulo = '🎯 Posso gastar hoje'; valor = brl(c.resta);
      sub = c.gastoHoje ? `de ${brl(c.porDia)} · já gastei ${brl(c.gastoHoje)} hoje` : `${brl(c.porDia)} por dia nos próximos ${c.diasRestantes} dias`;
    }
    let html = `<span class="rotulo-suave">${titulo}</span><strong class="valor-grande num ${cor}">${valor}</strong><span class="sub">${sub}</span>`;
    if (aberto) {
      html += `<div class="hoje-conta num">${c.partes.map(([n, v]) => `<span>${n}</span><b>${v < 0 ? '−' : ''}${brl(Math.abs(v))}</b>`).join('')}
        <span><b>= Livre no mês</b></span><b>${brl(c.livreMes)}</b>
        <span>÷ ${c.diasRestantes} dias</span><b>${brl(c.porDia)} por dia</b></div>`;
    } else html += '<span class="sub ver-conta">Toque para ver a conta</span>';
    el.innerHTML = html;
    el.setAttribute('aria-expanded', aberto);
  }
  $('card-hoje').addEventListener('click', () => { aberto = !aberto; desenhar(); });

  const _anterior = desenharTudo;
  desenharTudo = function () { _anterior(); desenhar(); };
  desenhar();
  // vira o dia com o app aberto
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') desenhar(); });
})();
