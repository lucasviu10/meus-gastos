// Assistente financeira: acha gargalos nos seus gastos e abre o Claude com seus números.
'use strict';

// ---------- Tema (claro por padrão) ----------
function aplicarTema(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('meus-gastos-tema', t); } catch (e) {}
  document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#121212' : '#ffffff';
  document.getElementById('btn-tema').textContent = t === 'dark' ? '☀️' : '🌙';
  document.querySelectorAll('[data-tema]').forEach(b => b.classList.toggle('sel', b.dataset.tema === t));
}
document.getElementById('btn-tema').addEventListener('click', () =>
  aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
document.querySelectorAll('[data-tema]').forEach(b => b.addEventListener('click', () => aplicarTema(b.dataset.tema)));
aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

// ---------- Números do mês ----------
function numerosDoMes() {
  const agora = new Date();
  const dia = agora.getDate();
  const diasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const km = chaveMes(agora);
  const doMes = dados.gastos.filter(g => g.data.startsWith(km) && +g.data.slice(8) <= dia);
  const total = doMes.reduce((s, g) => s + g.valor, 0);

  const porCat = {};
  doMes.forEach(g => { porCat[g.categoria] = (porCat[g.categoria] || 0) + g.valor; });
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);

  const ant = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const kmAnt = chaveMes(ant);
  const doAnt = dados.gastos.filter(g => g.data.startsWith(kmAnt) && +g.data.slice(8) <= dia);
  const totalAnt = doAnt.reduce((s, g) => s + g.valor, 0);
  const porCatAnt = {};
  doAnt.forEach(g => { porCatAnt[g.categoria] = (porCatAnt[g.categoria] || 0) + g.valor; });

  const pequenos = doMes.filter(g => g.valor <= 30);
  const somaPequenos = pequenos.reduce((s, g) => s + g.valor, 0);

  const fds = doMes.filter(g => { const w = new Date(g.data + 'T12:00').getDay(); return w === 0 || w === 6; })
    .reduce((s, g) => s + g.valor, 0);

  const diasComGasto = new Set(doMes.map(g => g.data));
  const primeiro = doMes.length ? Math.min(...doMes.map(g => +g.data.slice(8))) : dia;
  let diasZerados = 0;
  for (let d = primeiro; d < dia; d++) if (!diasComGasto.has(`${km}-${pad(d)}`)) diasZerados++;

  const maiores = [...doMes].sort((a, b) => b.valor - a.valor).slice(0, 5);
  // Contas fixas (aluguel, boletos) acontecem uma vez; só o dia a dia é projetado pelo ritmo.
  const FIXAS = ['casa', 'contas'];
  const fixo = doMes.filter(g => FIXAS.includes(g.categoria)).reduce((s, g) => s + g.valor, 0);
  const variavel = total - fixo;
  const projecao = dia >= 3 && total > 0 ? fixo + (variavel / dia) * diasMes : null;

  return { agora, dia, diasMes, doMes, total, cats, totalAnt, porCat, porCatAnt, pequenos, somaPequenos,
    fds, diasZerados, maiores, projecao, orc: dados.orcamento || 0 };
}

const nomeMes = d => d.toLocaleDateString('pt-BR', { month: 'long' });

// ---------- Gargalos ----------
function acharGargalos(n) {
  const lista = [];
  const add = (nivel, titulo, texto, acao) => lista.push({ nivel, titulo, texto, acao });

  if (n.doMes.length < 5) {
    add('info', 'Poucos dados ainda',
      `Tenho ${n.doMes.length} lançamento(s) neste mês. Com uma semana de gastos eu já acho seus padrões.`,
      'Lance tudo hoje, até o cafezinho.');
  }

  if (!n.orc) {
    add('info', 'Sem limite do mês',
      'Sem uma meta, o cérebro não tem referência do que é "muito".',
      'Vá em ⚙️ Ajustes e coloque quanto pode gastar por mês.');
  } else if (n.total > n.orc) {
    add('bad', 'Limite estourado',
      `Você já gastou ${brl(n.total)}, ${brl(n.total - n.orc)} acima do limite de ${brl(n.orc)}.`,
      'Até o fim do mês, só o essencial: casa, comida e transporte.');
  } else if (n.projecao && n.projecao > n.orc) {
    const porDia = (n.orc - n.total) / (n.diasMes - n.dia + 1);
    add('bad', 'Ritmo acima do limite',
      `Nesse ritmo você fecha o mês em ${brl(n.projecao)}, ou seja ${brl(n.projecao - n.orc)} acima do limite.`,
      `Para fechar no limite: no máximo ${brl(porDia)} por dia até o fim do mês.`);
  } else if (n.projecao) {
    add('ok', 'Ritmo dentro do limite',
      `Projeção para o fim do mês: ${brl(n.projecao)} de ${brl(n.orc)}.`,
      'Continue assim. Se sobrar, separe para guardar no dia 1.');
  }

  const cp = window.compromissos ? window.compromissos.resumo() : null;
  if (cp && cp.aPagar > 0) {
    if (n.orc && n.total + cp.aPagar > n.orc) {
      add('bad', 'Contas a vencer estouram o limite',
        `Você já gastou ${brl(n.total)} e ainda vão sair ${brl(cp.aPagar)} em contas e faturas. Total: ${brl(n.total + cp.aPagar)}, acima do limite de ${brl(n.orc)}.`,
        'Antes de qualquer gasto extra, separe o dinheiro das contas.');
    } else {
      add('info', `Ainda vão sair ${brl(cp.aPagar)} este mês`,
        cp.itens.slice(0, 3).map(i => `${i.nome} ${brl(i.valor)}`).join(' · '),
        'Confira as datas na aba 📅 Contas.');
    }
  }
  if (cp) cp.cartoes.forEach(u => {
    if (u.cartao.limite > 0 && u.usado / u.cartao.limite >= 0.8) {
      add('warn', `Cartão ${u.cartao.nome} com ${Math.round(u.usado / u.cartao.limite * 100)}% do limite usado`,
        `Sobram ${brl(u.disponivel)} de limite. Parcelas novas prendem o limite por meses.`,
        'Evite parcelar até a próxima fatura ser paga.');
    }
  });

  if (n.cats.length && n.total > 0) {
    const [id, v] = n.cats[0];
    const pct = Math.round((v / n.total) * 100);
    const c = CAT[id] || CAT.outros;
    if (id !== 'casa' && pct >= 35) {
      const corteMes = id === 'contas' ? v * 0.1 : (v / n.dia) * n.diasMes * 0.1;
      add('warn', `${c.emoji} ${c.nome} levou ${pct}% do mês`,
        `Foram ${brl(v)} até agora. É aqui que o dinheiro mais escapa.`,
        `Cortar só 10% nessa categoria libera cerca de ${brl(corteMes)} no mês.`);
    }
  }

  if (n.pequenos.length >= 5) {
    const ano = (n.somaPequenos / n.dia) * 365;
    add('warn', `Gastos formiga: ${n.pequenos.length} compras pequenas`,
      `Compras de até R$ 30 somaram ${brl(n.somaPequenos)}. Nesse ritmo, dá cerca de ${brl(ano)} em um ano.`,
      'Escolha 1 desses hábitos para pausar por 7 dias.');
  }

  if (n.totalAnt > 0 && n.doMes.length >= 3) {
    const dif = ((n.total - n.totalAnt) / n.totalAnt) * 100;
    if (dif >= 15) {
      let maiorAlta = null, alta = 0;
      Object.entries(n.porCat).forEach(([id, v]) => { const d = v - (n.porCatAnt[id] || 0); if (d > alta) { alta = d; maiorAlta = id; } });
      add('warn', `Gastando ${Math.round(dif)}% a mais que no mês passado`,
        `Até o dia ${n.dia}: ${brl(n.total)} agora, contra ${brl(n.totalAnt)} no mesmo período do mês passado.`,
        maiorAlta ? `O que mais subiu: ${CAT[maiorAlta].emoji} ${CAT[maiorAlta].nome} (+${brl(alta)}).` : '');
    } else if (dif <= -10) {
      add('ok', `Gastando ${Math.round(-dif)}% a menos que no mês passado`,
        `Até o dia ${n.dia}: ${brl(n.total)} agora, contra ${brl(n.totalAnt)} no mesmo período do mês passado.`,
        'Boa! Isso é hábito sendo construído.');
    }
  }

  if (n.doMes.length >= 8 && n.total > 0 && n.fds / n.total >= 0.45) {
    add('warn', 'O fim de semana pesa',
      `Sábados e domingos concentram ${Math.round((n.fds / n.total) * 100)}% dos seus gastos.`,
      'Na sexta, defina um valor fixo para o fim de semana.');
  }

  if (n.diasZerados >= 2) {
    add('ok', `${n.diasZerados} dias sem gastar nada`,
      'Cada dia zerado é treino de controle.',
      'Tente bater esse número no mês que vem.');
  }

  const peso = { bad: 0, warn: 1, info: 2, ok: 3 };
  return lista.sort((a, b) => peso[a.nivel] - peso[b.nivel]).slice(0, 5);
}

function resumo(n) {
  if (!n.doMes.length) return 'Ainda não tenho gastos deste mês. Lance por alguns dias e eu te mostro onde o dinheiro está escapando.';
  let s = `Em ${nomeMes(n.agora)} você gastou <strong>${brl(n.total)}</strong> em ${n.doMes.length} lançamento(s).`;
  if (n.orc && n.projecao) s += n.projecao > n.orc ? ' Nesse ritmo, vai passar do limite.' : ' Nesse ritmo, fecha dentro do limite. 👏';
  return s;
}

// ---------- Dica do dia ----------
const DICAS = [
  'Regra das 24 horas: viu algo fora do plano? Espere um dia. Se ainda fizer sentido amanhã, compre sem culpa.',
  'Pague-se primeiro: quando o dinheiro entrar, separe uma parte para guardar antes de gastar. O que sobra é o que dá para gastar.',
  'Parcelado não é sinônimo de barato. Some todas as parcelas e compare com o preço à vista. A diferença é o custo de ter agora.',
  'Juros compostos funcionam dos dois lados: na dívida do cartão, eles crescem contra você todo mês. Quitar dívida cara costuma ser a melhor decisão.',
  'Gasto formiga: R$ 15 por dia viram R$ 450 por mês e R$ 5.475 por ano.',
  'Pagar no cartão "dói" menos que pagar em dinheiro, e por isso a gente gasta mais. Se o cartão está pesando, teste o débito ou o Pix por um mês.',
  'Com TDAH, o que está fora de vista some da cabeça. Lance o gasto na hora, ainda no caixa, em 5 segundos.',
  'Compra por impulso costuma vir com fome, cansaço ou tédio. Antes de pagar, pergunte: "o que eu estou sentindo agora?"',
  'Reserva de emergência: a referência comum é de 3 a 6 meses do seu custo de vida. Comece com a meta de 1 mês.',
  'Desconto só é economia se você já ia comprar. Se não ia, é gasto.',
  'Assinaturas esquecidas: uma vez por mês, olhe o que é cobrado no cartão e cancele o que não usou.',
  'Dê a você um valor fixo por semana para lazer. Gastar dentro dele é liberdade, não culpa.',
  'Regra 50-30-20 como ponto de partida: 50% para o necessário, 30% para desejos e 20% para o futuro. Ajuste à sua realidade.',
  'O cérebro aprende com recompensa, não com culpa. Comemore cada dia sem gasto desnecessário.',
];
function dicaDoDia() {
  const inicio = new Date(new Date().getFullYear(), 0, 0);
  const diaAno = Math.floor((Date.now() - inicio) / 864e5);
  return DICAS[diaAno % DICAS.length];
}

// ---------- Perguntar ao Claude ----------
const PERSONA = 'Você é minha assistente financeira pessoal, especialista em comportamento humano (economia comportamental e TDAH), finanças pessoais e matemática financeira. Responda em português, curto e simples, com no máximo 5 passos práticos. Seja direta e gentil. Não invente taxas nem rentabilidade; se precisar de um número que não está aqui, diga que precisa confirmar.';
const PERGUNTAS = {
  analise: 'Analise meu mês: o que está bom, o que preocupa e o que eu faço esta semana.',
  cortar: 'Onde posso cortar gastos sem sofrer? Me dê 3 cortes concretos e quanto economizo com cada um.',
  orcamento: 'Monte um orçamento simples para o próximo mês, com valor por categoria, baseado nos meus gastos.',
  habito: 'Olhando meus gastos, que padrões de comportamento você percebe? Como mudar com estratégias que funcionam para quem tem TDAH?',
};
function textoDados(n) {
  const linhas = [`Meus dados de ${nomeMes(n.agora)} (até o dia ${n.dia} de ${n.diasMes}):`,
    `- Total gasto: ${brl(n.total)} em ${n.doMes.length} lançamentos`,
    `- Limite do mês: ${n.orc ? brl(n.orc) : 'não definido'}`];
  if (n.cats.length) linhas.push('- Por categoria: ' + n.cats.map(([id, v]) => `${CAT[id].nome} ${brl(v)}`).join('; '));
  if (n.maiores.length) linhas.push('- Maiores gastos: ' + n.maiores.map(g => `${g.descricao} ${brl(g.valor)}`).join('; '));
  linhas.push(`- Compras pequenas (até R$ 30): ${n.pequenos.length}, somando ${brl(n.somaPequenos)}`);
  if (n.totalAnt) linhas.push(`- Mês passado, no mesmo período: ${brl(n.totalAnt)}`);
  const em = window.empresaResumo ? window.empresaResumo() : null;
  if (em && (em.entrou || em.aReceber)) linhas.push(`- Empresa (LM Serviços): saldo ${brl(em.saldo)}, a receber ${brl(em.aReceber)}, despesas ${brl(em.despesas)}, já liberado para mim ${brl(em.liberado)}`);
  const sd = window.saldoAtual ? window.saldoAtual() : null;
  if (sd) linhas.push(`- Saldo agora: ${brl(sd.agora)} (comecei com ${brl(sd.inicial)} em ${sd.data}, entrou ${brl(sd.entrou)}, saiu ${brl(sd.saiu)}); depois das contas do mês: ${brl(sd.depois)}`);
  const cp = window.compromissos ? window.compromissos.resumo() : null;
  if (cp) {
    linhas.push(`- Ainda a pagar este mês (contas e faturas): ${brl(cp.aPagar)}`);
    linhas.push('- Compromissos dos próximos meses: ' + cp.proximos.map(p => `${p.mes} ${brl(p.total)}`).join('; '));
    if (cp.faltaParcelas) linhas.push(`- Total que falta pagar em parcelas: ${brl(cp.faltaParcelas)}`);
    if (dados.contas && dados.contas.length) linhas.push('- Contas: ' + dados.contas.map(c => `${c.nome} ${brl(c.valor)} (${c.tipo === 'parcelada' ? `${c.pagas}/${c.total} pagas` : c.tipo})`).join('; '));
    cp.cartoes.forEach(u => linhas.push(`- Cartão ${u.cartao.nome}: limite ${brl(u.cartao.limite)}, usado ${brl(u.usado)}`));
  }
  return linhas.join('\n');
}
function linkClaude(pergunta) {
  const n = numerosDoMes();
  const texto = `${PERSONA}\n\n${textoDados(n)}\n\nMinha pergunta: ${pergunta}`;
  return 'https://claude.ai/new?q=' + encodeURIComponent(texto.slice(0, 3500));
}

document.getElementById('form-pergunta').addEventListener('submit', e => {
  e.preventDefault();
  const campo = document.getElementById('pergunta-livre');
  const q = campo.value.trim();
  if (!q) { campo.focus(); return; }
  window.open(linkClaude(q), '_blank', 'noopener');
  campo.value = '';
});

// ---------- Desenhar ----------
function desenharAssistente() {
  const n = numerosDoMes();
  document.getElementById('ia-resumo').innerHTML = resumo(n);
  document.getElementById('ia-gargalos').innerHTML = acharGargalos(n).map(g =>
    `<li class="${g.nivel}"><b>${escapar(g.titulo)}</b><p>${escapar(g.texto)}</p>${g.acao ? `<p class="acao">👉 ${escapar(g.acao)}</p>` : ''}</li>`
  ).join('') || '<li class="ok"><b>Nenhum gargalo agora</b><p>Seus gastos estão equilibrados. Continue lançando.</p></li>';
  document.querySelectorAll('[data-pergunta]').forEach(a => { a.href = linkClaude(PERGUNTAS[a.dataset.pergunta]); });
  document.getElementById('ia-dica').textContent = dicaDoDia();
}

const _desenharTudoOriginal = desenharTudo;
desenharTudo = function () { _desenharTudoOriginal(); desenharAssistente(); };
desenharAssistente();
