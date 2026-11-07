// Guarda o app no celular para abrir mesmo sem internet.
const CACHE = 'meus-gastos-v5';
const ARQUIVOS = ['./', 'index.html', 'style.css', 'app.js', 'assistente.js', 'voz.js', 'sync.js', 'manifest.webmanifest', 'icons/cifrao-192.png', 'icons/cifrao-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Tenta a versão nova da internet; sem internet, usa a guardada.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
