// sw-mestre.js - Service Worker - Painel do Mestre
// v31 - Central de Mensagens: notificação única, com o texto da mensagem

const TITULO_PADRAO = 'Painel do Mestre';

// --- Notificações push (com o app fechado) ----------------------------------
// O Worker manda só "dados" (sem bloco notification). Assim só ESTE código
// mostra a notificação, uma vez só. Antes o Firebase mostrava uma e este
// arquivo mostrava outra: era a notificação duplicada.
const ICONE_PADRAO = 'https://i.ibb.co/1YgwbMTG/duolingo-oraculo-head.png';
const SELO = new URL('badge-notif.png', self.registration.scope).href;

function lerPush(event) {
  if (!event.data) return {};
  try { return event.data.json() || {}; } catch (e) { return { data: { titulo: TITULO_PADRAO, corpo: event.data.text() } }; }
}

async function clientesVisiveis() {
  const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return lista.filter((c) => c.url.startsWith(self.registration.scope) && c.visibilityState === 'visible');
}

async function mostrarPush(payload) {
  const d = Object.assign({}, payload.data || {});
  const n = payload.notification || {};               // compatibilidade com o Worker antigo
  const titulo = d.titulo || n.title || TITULO_PADRAO;
  const corpo = d.corpo || d.mensagem || n.body || '';
  const tipo = d.tipo || 'geral';
  const url = d.url || self.registration.scope;

  // App aberto na tela: ele mesmo avisa (aviso no topo, sino do Oráculo).
  const visiveis = await clientesVisiveis();
  if (visiveis.length) {
    visiveis.forEach((c) => c.postMessage({ cx: 'push', tipo, dados: d }));
    return;
  }

  if (tipo === 'chat' && d.cid) {
    // Uma notificação por conversa, juntando as mensagens (como no WhatsApp)
    const tag = 'chat-' + d.cid;
    const antigas = await self.registration.getNotifications({ tag });
    const ant = (antigas[0] && antigas[0].data) || {};
    const mids = Array.isArray(ant.mids) ? ant.mids : [];
    const linhas = Array.isArray(ant.linhas) ? ant.linhas : [];
    const repetida = d.mid && mids.includes(d.mid);   // a mesma mensagem chegou de novo
    if (!repetida) { linhas.push(corpo); if (d.mid) mids.push(d.mid); }
    const ultimas = linhas.slice(-6);
    const qtd = linhas.length;
    return self.registration.showNotification(qtd > 1 ? titulo + ' (' + qtd + ' mensagens)' : titulo, {
      body: ultimas.join('\n'),
      icon: d.icone || ICONE_PADRAO,
      badge: SELO,
      tag,
      renotify: !repetida,
      vibrate: repetida ? undefined : [80, 50, 80, 50, 160],
      timestamp: Number(d.ts) || Date.now(),
      data: { url, cid: d.cid, tipo, mids: mids.slice(-30), linhas: linhas.slice(-30) }
    });
  }

  // Avisos da Ordem (aprovações, vouchers...). A tag usa o id do envio:
  // se o mesmo aviso chegar duas vezes, a segunda substitui a primeira em silêncio.
  const tag = d.nid ? 'aviso-' + d.nid : 'aviso-' + tipo + '-' + Date.now();
  const ja = d.nid ? await self.registration.getNotifications({ tag }) : [];
  const opcoes = { body: corpo, icon: d.icone || ICONE_PADRAO, badge: SELO, tag, data: { url, tipo } };
  if (ja.length) opcoes.silent = true; else opcoes.vibrate = [80, 50, 80, 50, 160];
  return self.registration.showNotification(titulo, opcoes);
}

self.addEventListener('push', (event) => {
  event.waitUntil(mostrarPush(lerPush(event)).catch(() =>
    self.registration.showNotification(TITULO_PADRAO, { body: 'Você tem uma novidade.', icon: ICONE_PADRAO, badge: SELO })));
});

// Tocar na notificação abre o app (e a conversa certa, se for mensagem)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const destino = d.url || self.registration.scope;
  event.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const meu = lista.find((c) => c.url.startsWith(self.registration.scope));
    if (meu) {
      try { await meu.focus(); } catch (e) {}
      if (d.cid) meu.postMessage({ cx: 'abrir', cid: d.cid });
      return;
    }
    if (self.clients.openWindow) return self.clients.openWindow(destino);
  })());
});

const CACHE_NAME = 'minutinhos-mestre-v31';

const ROOT  = '/minutinhos-mestre/';
const INDEX = '/minutinhos-mestre/index.html';

const ASSETS = [
  ROOT,
  INDEX,
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js',
  'https://i.ibb.co/YF6L3bP8/imagem-livro-180x140.png',
  'https://i.ibb.co/jvkzKpNL/duolingo-oraculo-head-50x50.png',
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
