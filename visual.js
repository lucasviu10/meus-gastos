// Acabamento visual: ícones de traço nos botões fixos e um toque de vibração ao salvar.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const ABAS = { lancar: 'lancar', painel: 'painel', contas: 'contasAba', cartao: 'cartao', empresa: 'empresa', assistente: 'ia', ajustes: 'ajustes' };
  document.querySelectorAll('.abas button').forEach(b => {
    const span = b.querySelector('span');
    if (span && ABAS[b.dataset.tab]) span.innerHTML = icone(ABAS[b.dataset.tab], 22);
  });
  if ($('btn-ajustes')) $('btn-ajustes').innerHTML = icone('ajustes', 20);
  if ($('btn-voz')) $('btn-voz').innerHTML = icone('mic', 24);
  if ($('btn-nota-camera')) $('btn-nota-camera').innerHTML = `${icone('camera', 18)} Tirar foto da nota`;
  if ($('btn-nota')) $('btn-nota').innerHTML = `${icone('galeria', 18)} Galeria`;

  // vibração curta ao salvar (só em celulares que suportam)
  const vibrar = () => { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} };
  ['form-gasto', 'form-agora', 'form-compra', 'form-emp'].forEach(id => { const f = $(id); if (f) f.addEventListener('submit', vibrar); });
})();
