// Guarda o app no celular para abrir mesmo sem internet.
const CACHE = 'meus-gastos-v24';
const ARQUIVOS = ['./', 'index.html', 'style.css', 'app.js', 'contas.js', 'saldo.js', 'assistente.js', 'voz.js', 'sync.js', 'tipo-gasto.js', 'empresa.js', 'dividas.js', 'hoje.js', 'pago-agora.js', 'nota.js', 'manifest.webmanifest', 'icons/cifrao-192.png', 'icons/cifrao-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Tenta a versão nova da internet; sem internet, usa a guardada.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
