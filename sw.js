// Service Worker for Line Rehearsal PWA
// Version: 2.0.0 - Updated for cache-busting and auto-updates

const CACHE_NAME = 'line-rehearsal-v2.0.9';
const STATIC_CACHE = 'line-rehearsal-static-v2.0.0';
const DYNAMIC_CACHE = 'line-rehearsal-dynamic-v2.0.0';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        // Force activation of new service worker
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Delete old caches that don't match current version
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement cache-first strategy with network fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // If we have a cached version, return it immediately
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache:', request.url);
          
          // For HTML files, also fetch from network to check for updates
          if (request.url.includes('.html') || request.url === self.location.origin + '/') {
            fetch(request)
              .then(response => {
                // If network response is different, update cache
                if (response.ok && response.status === 200) {
                  caches.open(DYNAMIC_CACHE)
                    .then(cache => cache.put(request, response.clone()));
                }
              })
              .catch(() => {
                // Network failed, cached version is fine
              });
          }
          
          return cachedResponse;
        }
        
        // No cached version, fetch from network
        console.log('Service Worker: Fetching from network:', request.url);
        return fetch(request)
          .then(response => {
            // Only cache successful responses
            if (response.ok && response.status === 200) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then(cache => cache.put(request, responseClone));
            }
            return response;
          })
          .catch(error => {
            console.error('Service Worker: Network fetch failed:', error);
            
            // For navigation requests, return the cached index.html
            if (request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            
            throw error;
          });
      })
  );
});

// Handle service worker updates
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Skipping waiting...');
    self.skipWaiting();
  }
});

// Background sync for when app comes back online
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    // Handle any pending operations when back online
  }
});

// Push notifications (for future use)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});