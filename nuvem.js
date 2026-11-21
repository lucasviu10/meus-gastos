// Nuvem (Supabase): backup automático e os mesmos dados em outro celular.
// Uma linha por pessoa na tabela meus_gastos, protegida por senha (RLS: cada um só vê o seu).
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const CFG = 'meus-gastos-nuvem';
  const TABELA = 'meus_gastos';
  const SQL = `create table if not exists public.meus_gastos (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  dados jsonb not null,
  atualizado timestamptz not null default now()
);
alter table public.meus_gastos enable row level security;
create policy "meus gastos: ler" on public.meus_gastos for select using (auth.uid() = user_id);
create policy "meus gastos: criar" on public.meus_gastos for insert with check (auth.uid() = user_id);
create policy "meus gastos: atualizar" on public.meus_gastos for update using (auth.uid() = user_id);`;

  // ---------- configuração guardada no celular (a senha não é guardada) ----------
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(CFG)) || {}; } catch (e) { cfg = {}; }
  const guardar = () => { try { localStorage.setItem(CFG, JSON.stringify(cfg)); } catch (e) {} };
  const ligada = () => !!(cfg.url && cfg.chave && cfg.refresh);

  function status(txt, tipo) {
    const el = $('nuvem-status');
    el.textContent = txt;
    el.className = 'sub sub-topo' + (tipo ? ' ' + tipo : '');
  }
  function telas() {
    $('nuvem-form').hidden = ligada();
    $('nuvem-ligada').hidden = !ligada();
  }
  function quando(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const hoje = isoDia(new Date()) === isoDia(d);
    return (hoje ? 'hoje' : d.toLocaleDateString('pt-BR')) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function mostrarLigada() {
    status(`✓ Ligada${cfg.email ? ' · ' + cfg.email : ''}${cfg.ultimoSync ? ' · salvo na nuvem ' + quando(cfg.ultimoSync) : ''}`, 'ok');
  }

  // ---------- chamadas ao Supabase ----------
  const base = () => cfg.url.replace(/\/+$/, '');
  async function pedir(caminho, opcoes = {}, comToken = true) {
    const headers = Object.assign({ apikey: cfg.chave, 'Content-Type': 'application/json' }, opcoes.headers || {});
    if (comToken) headers.Authorization = 'Bearer ' + (await token());
    const r = await fetch(base() + caminho, Object.assign({}, opcoes, { headers }));
    const texto = await r.text();
    let corpo = null; try { corpo = texto ? JSON.parse(texto) : null; } catch (e) { corpo = texto; }
    if (!r.ok) {
      const msg = (corpo && (corpo.msg || corpo.message || corpo.error_description || corpo.error)) || ('erro ' + r.status);
      const err = new Error(String(msg)); err.status = r.status; err.corpo = corpo; throw err;
    }
    return corpo;
  }
  function guardarSessao(s) {
    cfg.acesso = s.access_token; cfg.refresh = s.refresh_token;
    cfg.expira = Date.now() + (s.expires_in || 3600) * 1000 - 60000;
    if (s.user) cfg.usuario = s.user.id;
    guardar();
  }
  async function token() {
    if (cfg.acesso && Date.now() < cfg.expira) return cfg.acesso;
    const s = await pedir('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: cfg.refresh }) }, false);
    guardarSessao(s);
    return cfg.acesso;
  }
  async function baixar() {
    const linhas = await pedir(`/rest/v1/${TABELA}?select=dados,atualizado&user_id=eq.${cfg.usuario}`, { method: 'GET' });
    return Array.isArray(linhas) && linhas[0] ? linhas[0] : null;
  }
  async function enviar() {
    const agora = new Date().toISOString();
    await pedir(`/rest/v1/${TABELA}?on_conflict=user_id`, {
      method: 'POST', keepalive: true,
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: cfg.usuario, dados, atualizado: agora }),
    });
    cfg.ultimoSync = agora; cfg.mudouLocal = false; guardar();
  }

  // ---------- trocar os dados do app pelos da nuvem ----------
  const salvarLocal = salvar; // grava só no celular (sem disparar envio)
  function aplicarDaNuvem(remoto) {
    dados = Object.assign({ gastos: [], orcamento: 0 }, remoto.dados);
    salvarLocal();
    cfg.ultimoSync = remoto.atualizado; cfg.mudouLocal = false; guardar();
    desenharTudo();
  }

  // ---------- envio automático depois de cada mudança ----------
  let timer = null, enviando = false;
  async function enviarAgora() {
    if (!ligada() || enviando || !navigator.onLine) return;
    enviando = true; clearTimeout(timer);
    try { await enviar(); mostrarLigada(); }
    catch (e) { status(e.status === 401 ? '⚠️ Sessão expirou. Desconecte e entre de novo.' : '⚠️ Não consegui salvar na nuvem agora. Tento de novo sozinho.', 'bad'); }
    enviando = false;
  }
  salvar = function () {
    salvarLocal();
    if (!ligada()) return;
    cfg.mudouLocal = true; guardar();
    clearTimeout(timer);
    timer = setTimeout(enviarAgora, 3000);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && ligada() && cfg.mudouLocal) enviarAgora();
    if (document.visibilityState === 'visible' && ligada()) puxar();
  });
  window.addEventListener('online', () => { if (ligada()) { if (cfg.mudouLocal) enviarAgora(); else puxar(); } });

  // ---------- ao abrir: traz da nuvem o que mudou em outro aparelho ----------
  let puxando = false;
  async function puxar() {
    if (puxando || !navigator.onLine) return;
    puxando = true;
    try {
      const remoto = await baixar();
      if (!remoto) { await enviar(); }
      else if (!cfg.ultimoSync || remoto.atualizado > cfg.ultimoSync) {
        if (cfg.mudouLocal) await enviar(); // mudou nos dois lugares: vale o deste celular
        else aplicarDaNuvem(remoto);
      } else if (cfg.mudouLocal) await enviar();
      mostrarLigada();
    } catch (e) {
      status(e.status === 401 || e.status === 400 ? '⚠️ Sessão expirou. Desconecte e entre de novo.' : '⚠️ Sem conexão com a nuvem agora. Seus dados continuam salvos no celular.', 'bad');
    }
    puxando = false;
  }

  // ---------- entrar ----------
  const temDados = d => d && ((d.gastos || []).length || (d.contas || []).length || (d.entradas || []).length || d.saldoInicial);
  let remotoPendente = null;
  $('nuvem-entrar').addEventListener('click', async () => {
    const url = $('nuvem-url').value.trim(), chave = $('nuvem-chave').value.trim();
    const email = $('nuvem-email').value.trim(), senha = $('nuvem-senha').value;
    if (!/^https:\/\/.+\.supabase\.(co|in)\/?$/.test(url)) { status('Confira o Project URL: algo como https://xxxx.supabase.co', 'bad'); return; }
    if (chave.length < 20) { status('Cole a chave "anon public" completa.', 'bad'); return; }
    if (!email || senha.length < 6) { status('Preencha o e-mail e uma senha com pelo menos 6 caracteres.', 'bad'); return; }
    cfg = { url, chave, email };
    status('Entrando…');
    try {
      let sessao;
      try {
        sessao = await pedir('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password: senha }) }, false);
      } catch (e) {
        if (!/invalid login/i.test(e.message)) throw e;
        const cad = await pedir('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password: senha }) }, false);
        if (!cad || !cad.access_token) {
          cfg = {}; guardar();
          status('📧 Conta criada. Abra o e-mail que o Supabase mandou, confirme, e toque em "Entrar" de novo.', 'ok');
          return;
        }
        sessao = cad;
      }
      guardarSessao(sessao);
      $('nuvem-senha').value = '';
      status('Sincronizando…');
      const remoto = await baixar();
      if (remoto && temDados(remoto.dados) && temDados(dados)) {
        remotoPendente = remoto; $('nuvem-escolha').hidden = false; telas();
        status('Escolha quais dados usar.', '');
        return;
      }
      if (remoto && temDados(remoto.dados)) aplicarDaNuvem(remoto); else await enviar();
      telas(); mostrarLigada();
    } catch (e) {
      cfg = {}; guardar(); telas();
      const m = String(e.message || '');
      status(/relation|does not exist|schema cache/i.test(m) ? '⚠️ Falta preparar o banco: abra "Primeira vez?" abaixo e rode o texto no Supabase.'
        : /email not confirmed/i.test(m) ? '📧 Confirme o e-mail que o Supabase mandou e tente de novo.'
        : /invalid login|invalid_credentials/i.test(m) ? '⚠️ E-mail ou senha errados.'
        : /invalid api key|no api key/i.test(m) ? '⚠️ A chave anon public não confere com esse projeto.'
        : '⚠️ Não consegui entrar: ' + m, 'bad');
    }
  });
  $('nuvem-usar-nuvem').addEventListener('click', () => {
    if (remotoPendente) aplicarDaNuvem(remotoPendente);
    remotoPendente = null; $('nuvem-escolha').hidden = true; telas(); mostrarLigada();
  });
  $('nuvem-usar-local').addEventListener('click', async () => {
    remotoPendente = null; $('nuvem-escolha').hidden = true; telas();
    status('Enviando os dados deste celular…'); await enviarAgora();
  });
  $('nuvem-agora').addEventListener('click', async () => {
    status('Sincronizando…');
    if (cfg.mudouLocal) await enviarAgora(); else await puxar();
  });
  $('nuvem-sair').addEventListener('click', () => {
    if (!confirm('Desconectar este celular da nuvem? Os dados continuam aqui e na nuvem.')) return;
    cfg = {}; guardar(); telas(); status('Desligada. Seus dados ficam só neste celular.');
  });
  $('nuvem-sql').value = SQL;
  $('nuvem-copiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(SQL); $('nuvem-copiar').textContent = '✓ Copiado'; }
    catch (e) { $('nuvem-sql').select(); $('nuvem-copiar').textContent = 'Selecionei: toque e segure para copiar'; }
    setTimeout(() => { $('nuvem-copiar').textContent = 'Copiar texto'; }, 2500);
  });

  if (cfg.url) $('nuvem-url').value = cfg.url;
  if (cfg.chave) $('nuvem-chave').value = cfg.chave;
  if (cfg.email) $('nuvem-email').value = cfg.email;
  telas();
  if (ligada()) { mostrarLigada(); puxar(); }
})();
