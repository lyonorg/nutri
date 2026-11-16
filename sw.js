// Guarda la app para que funcione sin internet (en la clínica, por ejemplo).
// Al publicar una versión nueva, sube VERSION para que el teléfono la descargue.
const VERSION = 'nutri-v2';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/app.js', 'js/db.js',
  'motor/index.js', 'motor/constantes.js', 'motor/dia.js', 'motor/tdee.js', 'motor/recalculo.js',
  'motor/saciedad.js', 'motor/actividad.js', 'motor/planificador.js', 'motor/recetas.js', 'motor/variantes.js',
  'datos/alimentos.json', 'datos/recetas.json', 'iconos/icono-192.png', 'iconos/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Primero la red (para recibir cambios), y si no hay internet, lo guardado.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && new URL(e.request.url).origin === location.origin) {
          const copia = r.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r ?? caches.match('index.html'))),
  );
});
