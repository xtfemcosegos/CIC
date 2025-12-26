const CACHE_NAME = 'cic-v5'; 
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'Apps/Home.html',
  'Apps/Navegacion.html',
  'Apps/Perfiles.html',
  'Apps/Areas.html',
  'Apps/Bases.html',
  'Apps/Alertas.html',
  'Apps/Ayuda.html',
  'Apps/Configuracion.html',
  'Apps/AdminUsuarios.html',
  'https://img.icons8.com/flat-round/192/shield.png',
  'https://img.icons8.com/flat-round/512/shield.png',
  'https://img.icons8.com/flat-round/96/shield.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Usamos Promise.all con catch individual para evitar que un solo error 404
        // detenga la instalación de toda la aplicación.
        // 'login.html' ha sido eliminado de la lista ya que ahora es parte de index.html.
        return Promise.all(
          ASSETS.map(url => {
            return cache.add(url).catch(err => console.warn(`Error al cachear recurso: ${url}`, err));
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Limpiando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Estrategia: Intentar red primero, si falla buscar en caché.
  // Esto asegura que los cambios en el servidor se vean de inmediato si hay internet.
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});