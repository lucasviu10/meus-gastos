// Comando de voz: toque no 🎤 e fale "45 reais no mercado" ou "quanto eu gastei?".
'use strict';
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const botao = document.getElementById('btn-voz');
  if (!SR) return; // navegador sem voz: o botão continua escondido
  botao.hidden = false;

  const preview = document.getElementById('preview');
  let rec = null, ouvindo = false;

  function falar(texto) {
    try {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* sem voz de saída, tudo bem */ }
  }
  const reais = v => brl(v).replace('R$', '').trim() + ' reais';

  // "gastei 23 reais e 50 no uber" -> "23,50 no uber"
  function limparFala(t) {
    return (' ' + t.toLowerCase() + ' ')
      .replace(/\s(gastei|paguei|foi|foram|deu|coloca|anota|lança|lanca)\s/g, ' ')
      .replace(/(\d+)\s*(?:reais|real|conto|contos)?\s+e\s+(\d{1,2})\s*(?:centavos?)?(?=\s)/g, '$1,$2')
      .replace(/\s(reais|real|contos|conto|pila|centavos)(?=\s)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function abrirAba(nome) {
    const b = document.querySelector(`.abas button[data-tab="${nome}"]`);
    if (b) b.click();
  }

  function resumoFalado() {
    const km = chaveMes(new Date());
    const total = dados.gastos.filter(g => g.data.startsWith(km)).reduce((s, g) => s + g.valor, 0);
    let t = `Este mês você gastou ${reais(total)}.`;
    if (dados.orcamento > 0) {
      const resta = dados.orcamento - total;
      t += resta >= 0 ? ` Ainda pode gastar ${reais(resta)}.` : ` Passou do limite em ${reais(-resta)}.`;
    }
    return t;
  }

  function processar(fala) {
    const texto = limparFala(fala);
    const sa = semAcento(texto);

    if (!/\d/.test(texto)) {
      if (/quanto|resumo|painel|saldo|sobra|limite/.test(sa)) {
        abrirAba('painel');
        falar(resumoFalado());
        return;
      }
      if (/assistente|gargalo|dica|ajuda|analise/.test(sa)) {
        abrirAba('assistente');
        const primeiro = document.querySelector('#ia-gargalos li b');
        falar(primeiro ? `Seu principal ponto agora: ${primeiro.textContent}.` : 'Abri sua assistente.');
        return;
      }
      preview.textContent = `Ouvi "${fala}", mas faltou o valor. Fale assim: 45 reais no mercado.`;
      falar('Faltou o valor. Fale, por exemplo: 45 reais no mercado.');
      return;
    }

    abrirAba('lancar');
    entrada.value = texto;
    atualizarPreview();
    if (!document.getElementById('btn-salvar').disabled) {
      document.getElementById('form-gasto').requestSubmit();
      const t = document.getElementById('toast-text').textContent.replace('✓', '').trim();
      falar('Anotado: ' + t.replace(/R\$\s?([\d.,]+)/, (_, v) => reais(valorDeTexto(v))));
    }
  }

  function parar() {
    ouvindo = false;
    botao.classList.remove('ouvindo');
    botao.textContent = '🎤';
  }

  botao.addEventListener('click', () => {
    if (ouvindo) { rec && rec.stop(); return; }
    rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let final = '';
    rec.onresult = e => {
      let parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else parcial += e.results[i][0].transcript;
      }
      preview.textContent = '🎤 ' + (final || parcial);
    };
    rec.onerror = e => {
      parar();
      preview.textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Libere o microfone: toque no cadeado ao lado do endereço ou nas permissões do app.'
        : e.error === 'no-speech' ? 'Não ouvi nada. Toque no 🎤 e fale de novo.'
        : 'A voz falhou. Verifique a internet e tente de novo.';
    };
    rec.onend = () => { parar(); if (final.trim()) processar(final.trim()); };
    try {
      rec.start();
      ouvindo = true;
      botao.classList.add('ouvindo');
      botao.textContent = '⏹';
      preview.textContent = 'Ouvindo… fale: "45 reais no mercado"';
    } catch (e) { parar(); }
  });

  // deixa a função de limpeza visível para testes
  window.__limparFala = limparFala;
  window.__processarFala = processar;
})();
