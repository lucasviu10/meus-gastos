// Lançar pela foto da nota: lê o texto no próprio celular, acha total, loja, data e itens.
// A foto não é guardada: só o que foi lido vira gasto.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const r2 = v => Math.round(v * 100) / 100;
  let worker = null, lida = null, catNota = 'outros';

  // ---------- Leitura (OCR) ----------
  function carregarScript(src) {
    return new Promise((ok, erro) => {
      if (window.Tesseract) return ok();
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => erro(new Error('não carregou o leitor'));
      document.head.appendChild(s);
    });
  }
  async function pegarWorker(progresso) {
    if (worker) return worker;
    await carregarScript('ocr/tesseract.min.js');
    worker = await Tesseract.createWorker('por', 1, {
      workerPath: 'ocr/worker.min.js', corePath: 'ocr/', langPath: 'ocr/', gzip: true,
      logger: m => { if (m.status === 'recognizing text') progresso(Math.round(m.progress * 100)); },
    });
    return worker;
  }
  // deixa a foto menor e em preto e branco: lê melhor e mais rápido
  async function prepararImagem(arquivo) {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
    const ctx = c.getContext('2d');
    ctx.filter = 'grayscale(1) contrast(1.4)';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close && bmp.close();
    return c;
  }

  // ---------- Entender o texto da nota ----------
  const DINHEIRO = /(\d{1,3}(?:\.\d{3})+,\d{2}|\d+[.,]\d{2})(?!\d)/g;
  const IGNORAR = /CNPJ|CPF|\bIE\b|INSCR|CEP|FONE|TEL|RUA|AV\.|AVENIDA|DOCUMENTO|CUPOM|DANFE|NFC|CHAVE|PROTOCOLO|CONSUMIDOR|SERIE|SÉRIE|EXTRATO|SAT\b|TRIBUT|IMPOSTO|LEI\s|APROX|OPERADOR|CAIXA|PDV/i;
  const NAO_ITEM = /TOTAL|TROCO|PAGO|PAGAR|DINHEIRO|CART[AÃ]O|CR[EÉ]DITO|D[EÉ]BITO|PIX|DESCONTO|ACR[EÉ]SCIMO|QTD|ITENS|FORMA|VALOR|SALDO/i;
  function lerTexto(texto) {
    const linhas = texto.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.length > 1);
    const valores = l => (l.match(DINHEIRO) || []).map(v => valorDeTexto(v)).filter(v => v > 0);

    // total: "valor a pagar" vale mais que "valor total", que vale mais que "total"
    let total = null, peso = 0;
    linhas.forEach(l => {
      const vs = valores(l); if (!vs.length || /SUBTOTAL|TRIBUT|APROX|TROCO/i.test(l)) return;
      const p = /A\s*PAGAR/i.test(l) ? 3 : /VALOR\s*TOTAL|TOTAL\s*(R\$|GERAL|DA\s*COMPRA)/i.test(l) ? 2 : /\bTOTAL\b/i.test(l) ? 1 : 0;
      if (p && p >= peso) { peso = p; total = vs[vs.length - 1]; }
    });
    if (!total) { // sem a palavra total: maior valor que não seja troco/pago
      const todos = linhas.filter(l => !/TROCO|PAGO|DINHEIRO|CNPJ|CPF/i.test(l)).flatMap(valores);
      total = todos.length ? Math.max(...todos) : null;
    }

    // loja: primeira linha com nome, nas primeiras linhas da nota
    let loja = '';
    for (const l of linhas.slice(0, 6)) {
      if (IGNORAR.test(l) || /\d{5,}/.test(l)) continue;
      const letras = l.replace(/[^A-Za-zÀ-ú ]/g, '').trim();
      const limpo = letras.replace(/\b(LTDA|ME|EPP|EIRELI|S\s?A|CIA|COMERCIO DE|COM)\b\.?/gi, ' ').replace(/\s+/g, ' ').trim();
      if (limpo.length >= 4) { loja = limpo.split(' ').slice(0, 4).join(' '); break; }
    }

    // data
    let data = isoDia(new Date());
    const md = texto.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{2,4})/);
    if (md) {
      let a = +md[3]; if (a < 100) a += 2000;
      const d = new Date(a, +md[2] - 1, +md[1]);
      if (!isNaN(d) && d <= new Date() && a > 2000) data = isoDia(d);
    }

    // itens: linhas com nome e valor no fim
    const itens = [];
    linhas.forEach(l => {
      if (IGNORAR.test(l) || NAO_ITEM.test(l)) return;
      const vs = l.match(DINHEIRO); if (!vs) return;
      const valor = valorDeTexto(vs[vs.length - 1]);
      let nome = l.replace(DINHEIRO, ' ')
        .replace(/\b\d+[.,]?\d*\s*(UN|UND|KG|G|L|ML|PC|CX|X)\b/gi, ' ')
        .replace(/^[\d\s.\-*#]+/, '')
        .replace(/\b[A-Z]?\d{4,}\b/g, ' ')
        .replace(/[^A-Za-zÀ-ú0-9 ]/g, ' ')
        .replace(/\b\d+\s*(unx|un|und|unid|kg|g|l|ml|pc|cx)\b/gi, ' ')
        .replace(/\b(r|x|un)\b/gi, ' ')
        .replace(/\s+/g, ' ').trim();
      if (nome.replace(/[^A-Za-zÀ-ú]/g, '').length < 3 || !(valor > 0)) return;
      if (total && valor > total) return;
      itens.push({ nome: nome.toLowerCase().slice(0, 40), valor });
    });

    return { total: total ? r2(total) : null, loja, data, itens: itens.slice(0, 25) };
  }

  const REGRAS = [
    [/POSTO|COMBUST|GASOLINA|ETANOL|DIESEL|SHELL|IPIRANGA|PETROBRAS|AUTO ?POSTO/i, 'transporte'],
    [/DROG|FARMA|RAIA|DROGASIL|PAGUE MENOS|PANVEL/i, 'saude'],
    [/SUPERMERC|MERCAD|ATACAD|ASSAI|ASSA[IÍ]|CARREFOUR|EXTRA|DIA\b|PADARIA|PANIFIC|HORTI|A[CÇ]OUGUE|RESTAURANTE|LANCHONETE|PIZZ|BURGER|MC ?DONALD|IFOOD|PASTEL|SORVET|A[CÇ]A[IÍ]/i, 'alimentacao'],
    [/LOJAS|MAGAZINE|SHOPEE|AMAZON|RENNER|RIACHUELO|C&A|CENTAURO|AMERICANAS|ELETRO/i, 'compras'],
    [/CINEMA|BAR\b|CERVEJ|CHOPP|BOATE|SHOW|INGRESSO/i, 'lazer'],
  ];
  function categoriaDa(r) {
    const tudo = r.loja + ' ' + r.itens.map(i => i.nome).join(' ');
    for (const [re, cat] of REGRAS) if (re.test(tudo)) return cat;
    const c = adivinharCategoria(tudo);
    return CAT[c] ? c : 'outros';
  }

  // ---------- Tela ----------
  function status(txt) { $('nota-status').textContent = txt; }
  function desenharCats() {
    $('nota-cats').innerHTML = CATEGORIAS.map(c =>
      `<button type="button" class="chip${c.id === catNota ? ' sel' : ''}" data-cat-nota="${c.id}">${c.emoji} ${c.nome}</button>`).join('');
  }
  function mostrar(r) {
    lida = r;
    catNota = categoriaDa(r);
    $('nota-loja').value = r.loja ? r.loja.toLowerCase() : '';
    $('nota-total').value = r.total ? String(r.total).replace('.', ',') : '';
    $('nota-data').value = r.data;
    desenharCats();
    $('nota-resumo-itens').textContent = r.itens.length ? `O que tinha na nota (${r.itens.length} itens)` : 'Não consegui ler os itens';
    $('nota-itens').innerHTML = r.itens.map(i => `<li><span class="desc">${escapar(i.nome)}</span><span class="val num">${brl(i.valor)}</span></li>`).join('');
    $('nota-detalhes').open = r.itens.length > 0 && r.itens.length <= 6;
    $('nota-campos').hidden = false;
    status(r.total ? 'Confira o total e a categoria antes de salvar.' : 'Não achei o total. Digite o valor que você pagou.');
    if (!r.total) $('nota-total').focus();
  }
  function fechar() { $('nota-painel').hidden = true; $('nota-campos').hidden = true; lida = null; }

  $('btn-nota').addEventListener('click', () => $('arquivo-nota').click());
  $('btn-nota-camera').addEventListener('click', () => $('arquivo-nota-camera').click());
  async function aoEscolher(e) {
    const arq = e.target.files && e.target.files[0];
    e.target.value = ''; // a foto não fica guardada
    if (!arq) return;
    $('nota-painel').hidden = false; $('nota-campos').hidden = true;
    $('nota-painel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      status(worker ? 'Lendo a nota…' : 'Preparando o leitor (só demora na primeira vez)…');
      const [img, w] = await Promise.all([prepararImagem(arq), pegarWorker(p => status(`Lendo a nota… ${p}%`))]);
      status('Lendo a nota…');
      const { data } = await w.recognize(img);
      mostrar(lerTexto(data.text || ''));
    } catch (err) {
      status('Não consegui ler a foto. Tente com mais luz e a nota bem reta, ou digite o gasto acima.');
    }
  }
  $('arquivo-nota').addEventListener('change', aoEscolher);
  $('arquivo-nota-camera').addEventListener('change', aoEscolher);
  $('nota-cats').addEventListener('click', e => {
    const b = e.target.closest('[data-cat-nota]'); if (!b) return;
    catNota = b.dataset.catNota; desenharCats();
  });
  $('nota-cancelar').addEventListener('click', fechar);
  $('nota-salvar').addEventListener('click', () => {
    const valor = valorDeTexto($('nota-total').value);
    if (!(valor > 0)) { status('Coloque o total pago.'); $('nota-total').focus(); return; }
    const loja = $('nota-loja').value.trim() || CAT[catNota].nome.toLowerCase();
    const g = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), valor: r2(valor),
      descricao: catNota === 'mc' ? 'MC' : loja.slice(0, 40), categoria: catNota,
      data: $('nota-data').value || isoDia(new Date()), criado: new Date().toISOString(), origem: 'nota' };
    if (catNota === 'mc') g.nota = loja;
    if (lida && lida.itens.length) g.itens = lida.itens.map(i => `${i.nome} ${brl(i.valor)}`);
    dados.gastos.push(g);
    salvar();
    ultimoId = g.id;
    fechar(); desenharTudo();
    $('toast-text').textContent = `🧾 ${brl(g.valor)} em ${CAT[g.categoria].nome} · ${g.descricao}`;
    $('toast-undo').hidden = false; $('toast').hidden = false;
    setTimeout(() => { $('toast').hidden = true; }, 6000);
  });

  window.__lerTextoNota = lerTexto; // para testes
})();
