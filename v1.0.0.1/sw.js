const APP_VERSION = '1.0.0.856';
const CACHE_NAME = `cic-os-cache-${APP_VERSION}`;

self.addEventListener('install', event => {
    // Forzamos al Service Worker a instalarse de inmediato
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    // Solo interceptamos peticiones GET a los archivos de nuestra propia aplicación
    // (Ignoramos peticiones a Firebase, bases de datos externas o APIs de clima)
    // También ignoramos el propio script del Service Worker para evitar que se cachee a sí mismo.
    if (event.request.url.includes('sw.js')) {
        return;
    }

    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // 1. Si el archivo (HTML/CSS/JS) ya está guardado en el teléfono, lo devolvemos al instante
            if (cachedResponse) return cachedResponse;
            
            // 2. Si no lo tenemos, lo descargamos de internet y lo guardamos automáticamente en el caché
            return fetch(event.request).then(networkResponse => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            });
        }).catch(error => {
            console.warn("El sistema está offline y este recurso no estaba en caché. Error:", error, "URL:", event.request.url);
            // Devolvemos una respuesta de error genérica para evitar que el navegador se quede "colgado"
            // esperando una respuesta que nunca llegará. Este es el fix para el congelamiento.
            return new Response('Recurso no disponible offline.', {
                status: 404,
                headers: { 'Content-Type': 'text/plain' },
            });
        })
    );
});

self.addEventListener('activate', event => {
    // Limpiamos versiones de caché antiguas si en el futuro actualizas a "cic-os-cache-v2"
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => { if (key !== CACHE_NAME) return caches.delete(key); })
        ))
    );
    self.clients.claim();
});