// @ts-nocheck
// Service Worker for Really Safe Skiing PWA
// Service workers run in a different context (ServiceWorkerGlobalScope)
// TypeScript doesn't have full type definitions for this context by default

const CACHE_NAME = 'really-safe-skiing-v1';

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Installing and caching essential files');
        // Only cache files that definitely exist in production
        return cache.addAll([
          '/',
          '/index.html',
          '/icon.png',
          '/manifest.json'
        ]).catch((error) => {
          // Don't fail installation if some files are missing
          console.warn('Service Worker: Some files could not be cached', error);
        });
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - cache everything and serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Skip external domains (like Google Fonts) - cache them but don't block on them
  const isExternal = !event.request.url.startsWith(self.location.origin);
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // If we have a cached version, return it (even if online for faster loading)
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise, fetch from network
        return fetch(event.request)
          .then((fetchResponse) => {
            // Only cache successful responses
            if (!fetchResponse || fetchResponse.status !== 200) {
              return fetchResponse;
            }

            // Don't cache opaque responses (CORS issues) unless it's external
            if (fetchResponse.type === 'opaque' && !isExternal) {
              return fetchResponse;
            }

            // Clone the response before caching
            const responseToCache = fetchResponse.clone();

            // Cache all successful responses for offline use
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch((error) => {
                console.warn('Service Worker: Failed to cache', event.request.url, error);
              });

            return fetchResponse;
          })
          .catch((error) => {
            // Network failed - try to serve from cache
            console.warn('Service Worker: Network failed for', event.request.url, error);
            
            // For navigation requests, return the main HTML
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            
            // For other requests, return undefined (will show network error)
            return undefined;
          });
      })
  );
});
