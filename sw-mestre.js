importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyABCdoTrqwRmj3wmiYGRJfTbcyoqyf5uME",
  authDomain: "minutinhos.firebaseapp.com",
  databaseURL: "https://minutinhos-default-rtdb.firebaseio.com",
  projectId: "minutinhos",
  storageBucket: "minutinhos.firebasestorage.app",
  messagingSenderId: "205117538078",
  appId: "1:205117538078:web:33a0c88a10c6b3d7f5930f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const titulo = payload.notification?.title || 'Minutinhos — Painel do Mestre';
  const corpo = payload.notification?.body || '';
  self.registration.showNotification(titulo, {
    body: corpo,
    icon: 'https://i.ibb.co/7xwvFvSK/avatar-boy-full-body-mod1-nobg.png',
    badge: 'https://i.ibb.co/7xwvFvSK/avatar-boy-full-body-mod1-nobg.png',
    vibrate: [60, 30, 60, 30, 120],
    data: payload.data || {},
    tag: payload.data?.tipo || 'minutinhos-mestre'
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('minutinhos-mestre') && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

// sw-mestre.js — Service Worker — Painel do Mestre
const CACHE_NAME = 'minutinhos-mestre-v12';

const ASSETS = [
  '/minutinhos-mestre/',
  '/minutinhos-mestre/index.html',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('firebase.googleapis.com')) return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (event.request.method === 'GET' && res && res.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      }).catch(() => {
        if (event.request.destination === 'document')
          return caches.match('/minutinhos-mestre/');
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
