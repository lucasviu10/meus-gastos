// "⚡ Paguei agora" na aba Contas: lança direto como pago, sem dia nem vencimento.
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const campo = $('agora-texto');
  function preview() {
    if (!campo.value.trim()) { $('agora-preview').textContent = 'Já pagou? Digite o valor e o que foi. Entra direto como pago.'; $('agora-salvar').disabled = true; return; }
    const r = interpretar(campo.value);
    if (!(r.valor > 0)) { $('agora-preview').textContent = 'Falta o valor. Ex: 70 maconha'; $('agora-salvar').disabled = true; return; }
    const c = CAT[r.categoria] || CAT.outros;
    const desc = r.categoria === 'mc' ? 'MC' : (r.descricao || c.nome);
    $('agora-preview').innerHTML = `<strong>${brl(r.valor)}</strong> · ${escapar(desc)} · ${c.emoji} ${c.nome} · ${dataLegivel(r.data)} · ✅ pago`;
    $('agora-salvar').disabled = false;
  }
  campo.addEventListener('input', preview);
  $('form-agora').addEventListener('submit', e => {
    e.preventDefault();
    const g = adicionar(campo.value);
    if (!g) return;
    salvar();
    ultimoId = g.id; // "Desfazer" do aviso apaga este gasto
    campo.value = ''; preview();
    desenharTudo();
    $('toast-text').textContent = `✅ ${brl(g.valor)} pago · ${(CAT[g.categoria] || CAT.outros).nome}`;
    $('toast-undo').hidden = false; $('toast').hidden = false;
    setTimeout(() => { $('toast').hidden = true; }, 6000);
  });
})();
