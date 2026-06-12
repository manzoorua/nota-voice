// Service Worker for PWA capabilities
const CACHE_NAME = 'notavoice-v4';
const STATIC_CACHE = 'notavoice-static-v4';
const DYNAMIC_CACHE = 'notavoice-dynamic-v4';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/app',
  '/manifest.json',
  '/placeholder.svg'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(STATIC_FILES);
      })
      .catch((error) => {
        console.error('Failed to cache static files:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Message handler for SKIP_WAITING
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event - network-first for app shell, cache-first for others
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);

  // Bypass SW entirely when ?no-sw=1 is present
  if (url.searchParams.get('no-sw') === '1') {
    return;
  }

  const isHTML = event.request.destination === 'document';
  const isAsset =
    ['script', 'style', 'worker'].includes(event.request.destination) ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css');

  if (isHTML || isAsset) {
    // Network-first for app shell
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          const cache = await caches.open(DYNAMIC_CACHE);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (isHTML) {
            return caches.match('/');
          }
        }
      })()
    );
    return;
  }

  // Default: cache-first for images and other assets
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        const networkResponse = await fetch(event.request);
        const cache = await caches.open(DYNAMIC_CACHE);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        return Response.error();
      }
    })()
  );
});

// Background Sync tag for the offline-queue subsystem.
// NOTE: source of truth is BACKGROUND_SYNC_TAG in
// src/lib/offline-queue/utils/constants.ts. The service worker is plain JS and
// cannot import that constant, so this literal MUST be kept in sync with it.
const OFFLINE_QUEUE_SYNC_TAG = 'offline-queue-sync';

// Background sync handler.
// Handles both the legacy 'background-sync-recordings' tag (existing behavior)
// and the offline-queue 'offline-queue-sync' tag.
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-recordings') {
    event.waitUntil(syncRecordings());
  } else if (event.tag === OFFLINE_QUEUE_SYNC_TAG) {
    event.waitUntil(notifyClientsOfflineQueueSync());
  }
});

// The service worker cannot directly drive the page-side OfflineQueue/SyncEngine
// (they live on the page). When an 'offline-queue-sync' event fires, ping any
// open clients so the page can run OfflineQueue.processQueue(). If there are no
// open clients, resolve gracefully — the app will process the queue on its next
// foreground session (Req 6.6).
async function notifyClientsOfflineQueueSync() {
  try {
    const clientList = await self.clients.matchAll({ includeUncontrolled: true });
    for (const client of clientList) {
      client.postMessage({ type: 'OFFLINE_QUEUE_SYNC' });
    }
  } catch (error) {
    console.error('Failed to notify clients of offline-queue sync:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'New notification from NotaVoice',
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
    tag: 'notavoice-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: 'View Notes'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('NotaVoice', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/app')
    );
  }
});

// Sync recordings function
async function syncRecordings() {
  try {
    // Get stored recordings from IndexedDB
    const recordings = await getStoredRecordings();
    
    for (const recording of recordings) {
      try {
        // Attempt to sync each recording
        await syncRecording(recording);
        await removeStoredRecording(recording.id);
      } catch (error) {
        console.error('Failed to sync recording:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Placeholder functions for IndexedDB operations
async function getStoredRecordings() {
  // Implementation would use IndexedDB
  return [];
}

async function syncRecording(recording) {
  // Implementation would sync to server
  return Promise.resolve();
}

async function removeStoredRecording(id) {
  // Implementation would remove from IndexedDB
  return Promise.resolve();
}