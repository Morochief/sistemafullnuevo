const CACHE_NAME = 'afull-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Bypass API requests, non-GET methods, and external domains
  if (event.request.method !== 'GET' || 
      !event.request.url.startsWith(self.location.origin) ||
      event.request.url.includes('/api/')) {
    return;
  }

  // Use Network-First strategy for the root HTML to avoid stale bundle errors on new deploys
  const isHtmlRequest = event.request.mode === 'navigate' || 
                        event.request.url === self.location.origin + '/' || 
                        event.request.url.endsWith('/index.html');

  if (isHtmlRequest) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request) || caches.match('/index.html');
        })
    );
    return;
  }

  // Cache-First strategy for compiled hashed assets and images
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache new assets dynamically if they are local static assets
        if (networkResponse.status === 200 && event.request.url.includes('/assets/')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(async () => {
        // Return index.html as fallback for client-side navigation (SPA)
        if (event.request.mode === 'navigate') {
          return (await caches.match('/')) || (await caches.match('/index.html')) || new Response('Offline', { status: 503 });
        }
        return new Response('Network error or offline', { status: 504, headers: { 'Content-Type': 'text/plain' } });
      });
    })
  );
});
