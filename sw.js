'use strict';
/*
 * Service worker: hra ide aj bez internetu, ale keď internet je,
 * vždy sa načíta najnovšia verzia z GitHubu (sieť má prednosť pred uloženou kópiou).
 * Pri aktualizácii hry tento súbor netreba meniť.
 */
const CACHE = 'macaci-zbor';
const NET_TIMEOUT = 4000; // pri veľmi slabom signáli po 4 s použi uloženú verziu

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  e.respondWith(networkFirst(e, req));
});

async function networkFirst(e, req) {
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  // 'no-cache' = vždy sa opýtaj servera, či nie je novšia verzia
  const net = (sameOrigin ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req))
    .then(async res => {
      if (res && (res.ok || res.type === 'opaque') && !res.redirected) {
        const cache = await caches.open(CACHE);
        await cache.put(req, res.clone());
      }
      return res;
    });
  e.waitUntil(net.catch(() => {}));

  try {
    return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NET_TIMEOUT))]);
  } catch (err) {
    const hit = await caches.match(req);
    return hit || net;
  }
}
