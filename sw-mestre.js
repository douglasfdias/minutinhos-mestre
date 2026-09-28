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
const CACHE_NAME = 'minutinhos-mestre-v16';

const ROOT  = '/minutinhos-mestre/';
const INDEX = '/minutinhos-mestre/index.html';

const ASSETS = [
  ROOT,
  INDEX,
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js',
];

/* Baixa SEMPRE da rede na instalação (ignora o cache HTTP do navegador).
   Sem isso o GitHub Pages devolve o HTML antigo e a versão nova nunca chega. */
self.addEventListener('install', event => {
  self.skipWaiting();                       // não fica esperando as abas fecharem
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {}))
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Rede primeiro para o que muda (HTML/JS/CSS do próprio app),
   cache primeiro só para bibliotecas externas e imagens. */
function ehConteudoDoApp(request, url) {
  if (request.mode === 'navigate') return true;
  if (url.origin !== self.location.origin) return false;
  return /\.(html|js|css|json)$/i.test(url.pathname) || url.pathname === ROOT;
}

async function redePrimeiro(request) {
  try {
    const res = await fetch(new Request(request.url, { cache: 'no-store' }));
    if (res && res.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, res.clone());
    }
    return res;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return (await caches.match(INDEX)) || (await caches.match(ROOT));
    }
    throw e;
  }
}

async function cachePrimeiro(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (request.method === 'GET' && res && res.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, res.clone());
  }
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('firebase.googleapis.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebaseinstallations')) return;

  event.respondWith(ehConteudoDoApp(req, url) ? redePrimeiro(req) : cachePrimeiro(req));
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'LIMPAR_CACHE') {
    event.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))));
  }
});
