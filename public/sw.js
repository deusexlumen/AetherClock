import { ALARM_NOTIFICATION_OPTIONS } from './notification-config.js';

const CACHE_NAME = 'aetherclock-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/icon.svg',
  '/manifest.json',
  '/notification-config.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(() => {
      // Silent fail for missing assets during development
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isStatic = STATIC_ASSETS.some((path) => url.pathname === path);
  const isAsset = url.pathname.match(/\.(js|css|svg|png|json|woff2?)$/);

  if (isStatic || isAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});

const showAlarmNotification = (data) => {
  return self.registration.showNotification(data.title || 'AetherClock', {
    body: data.body || 'Wake up! Your alarm is ringing.',
    ...ALARM_NOTIFICATION_OPTIONS,
    data: { url: data.url || '/' },
  });
};

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(showAlarmNotification(data));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data?.url || '/');
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(showAlarmNotification({
      title: event.data.title,
      body: event.data.body,
      url: event.data.url,
    }));
  }

  if (event.data?.type === 'SET_DEVICE_ID') {
    event.waitUntil(storeDeviceId(event.data.deviceId));
  }
});

// --- Device ID persistence for push subscription changes ---

const DB_NAME = 'aetherclock-sw';
const DB_STORE = 'kv';
const DB_KEY = 'deviceId';

const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(DB_STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const storeDeviceId = async (deviceId) => {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const req = tx.objectStore(DB_STORE).put(deviceId, DB_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

const getStoredDeviceId = async () => {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(DB_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const deviceId = await getStoredDeviceId();
      if (!deviceId || !event.oldSubscription) return;

      const options = event.oldSubscription.options;
      const newSubscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: options.applicationServerKey,
      });

      await fetch('/api/resubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          subscription: newSubscription.toJSON(),
        }),
      });
    })()
  );
});
