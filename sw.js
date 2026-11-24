/* Service worker di Fiber Tools: rende l'app utilizzabile offline.
   Quando modifichi i file dell'app, aumenta VERSION per forzare l'aggiornamento. */
const VERSION = 'fiber-tools-v55';
// mappa offline: i tasselli OpenStreetMap restano tra un aggiornamento e l'altro
const TILE_CACHE = 'fiber-tiles-v1';
const TILE_MAX = 8000;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './vendor/barcode-detector.js',
  './vendor/zxing_reader.wasm',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== TILE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Mappa: prima i tasselli salvati (funziona offline), poi la rete.
  if (req.method === 'GET' && url.hostname === 'tile.openstreetmap.org') {
    event.respondWith(tileFromCache(req, url));
    return;
  }

  // Google Sheets e qualsiasi altro sito esterno: sempre in rete, mai dalla cache.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pagina principale: prima la rete (così arrivano gli aggiornamenti), poi la cache se offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Icone, libreria scanner: prima la cache.
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});

let tilePuts = 0;
async function tileFromCache(req, url) {
  const cache = await caches.open(TILE_CACHE);
  const key = url.origin + url.pathname;            // stessa chiave anche per richieste diverse dello stesso tassello
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && res.type !== 'opaque') {
      await cache.put(key, res.clone());
      if (++tilePuts % 200 === 0) trimTiles(cache);
    }
    return res;
  } catch (e) {
    return new Response('', { status: 504, statusText: 'offline' });
  }
}
async function trimTiles(cache) {
  const keys = await cache.keys();
  if (keys.length > TILE_MAX) await Promise.all(keys.slice(0, keys.length - TILE_MAX).map(k => cache.delete(k)));
}


/* ---------- Notifiche sul telefono (anche ad app chiusa) ----------
   Arriva solo un segnale: leggo dallo script i messaggi non letti dell'account. */
function idbGetCfg() {
  return new Promise(res => {
    try {
      const r = indexedDB.open('fiber_tools_db', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onerror = () => res(null);
      r.onsuccess = () => {
        try {
          const db = r.result, q = db.transaction('kv', 'readonly').objectStore('kv').get('pushCfg');
          q.onsuccess = () => { db.close(); res(q.result || null); }; q.onerror = () => { db.close(); res(null); };
        } catch (e) { res(null); }
      };
    } catch (e) { res(null); }
  });
}
const NOTIF_ICON = 'icons/icon-192.png';
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let msgs = [];
    const cfg = await idbGetCfg();
    if (cfg && cfg.url && cfg.token) {
      try {
        const body = JSON.stringify({ action: 'pushInbox', token: cfg.token, ...(cfg.key ? { key: cfg.key } : {}) });
        const r = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
        const d = await r.json();
        msgs = (d && d.messages) || [];
      } catch (e) {}
    }
    if (!msgs.length) msgs = [{ titolo: 'Fiber Tools', testo: 'Hai una novità: apri l’app.', link: '' }];
    for (const m of msgs) {
      await self.registration.showNotification(m.titolo || 'Fiber Tools', {
        body: m.testo || '', icon: NOTIF_ICON, badge: NOTIF_ICON, tag: (m.link || 'ft') + '|' + (m.data || Date.now()), data: { link: m.link || '' }
      });
    }
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const scope = self.registration.scope, link = (event.notification.data && event.notification.data.link) || '';
  const url = scope + (link ? link : '');
  event.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(scope)) { try { await w.focus(); if (link) w.postMessage({ type: 'deepLink', link }); return; } catch (e) {} }
    }
    await clients.openWindow(url);
  })());
});
