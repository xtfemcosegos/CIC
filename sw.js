const CACHE_NAME = 'cic-cache-v1';
const ASSETS = [
  'index.html',
  'Paneles/Administración.html',
  'MM/Logo.png',
  'MM/RegAs.png',
  'MM/RegUs.png',
  'MM/RegSin.png'
];

// Instalación: Cachear archivos base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Estrategia: Network First con fallback a Cache
// Para asegurar que siempre vean los datos más recientes de Firebase
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});