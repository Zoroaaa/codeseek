const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE_NAME = `codeseek-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `codeseek-dynamic-${CACHE_VERSION}`;
const API_CACHE_NAME = `codeseek-api-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo.png'
];

const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

const API_CACHE_CONFIG = {
  '/api/search': { strategy: CACHE_STRATEGIES.NETWORK_FIRST, maxAge: 5 * 60 * 1000 },
  '/api/sources': { strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE, maxAge: 30 * 60 * 1000 },
  '/api/config': { strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE, maxAge: 60 * 60 * 1000 },
  '/api/user': { strategy: CACHE_STRATEGIES.NETWORK_FIRST, maxAge: 0 }
};

function getApiCacheConfig(url) {
  const pathname = new URL(url).pathname;
  for (const [path, config] of Object.entries(API_CACHE_CONFIG)) {
    if (pathname.startsWith(path)) {
      return config;
    }
  }
  return null;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('离线状态，资源不可用', { status: 503 });
  }
}

async function networkFirst(request, cacheName, maxAge = 0) {
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      responseToCache.headers.set('sw-cache-time', Date.now().toString());
      cache.put(request, responseToCache);
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      if (maxAge > 0) {
        const cacheTime = parseInt(cachedResponse.headers.get('sw-cache-time') || '0');
        if (Date.now() - cacheTime > maxAge) {
          return new Response('离线状态，缓存已过期', { status: 503 });
        }
      }
      return cachedResponse;
    }
    return new Response('离线状态，无可用缓存', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName, maxAge = 0) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      responseToCache.headers.set('sw-cache-time', Date.now().toString());
      cache.put(request, responseToCache);
    }
    return networkResponse;
  }).catch(() => null);
  
  if (cachedResponse) {
    if (maxAge > 0) {
      const cacheTime = parseInt(cachedResponse.headers.get('sw-cache-time') || '0');
      if (Date.now() - cacheTime <= maxAge) {
        return cachedResponse;
      }
    } else {
      return cachedResponse;
    }
  }
  
  try {
    return await fetchPromise || cachedResponse || new Response('离线状态', { status: 503 });
  } catch {
    return cachedResponse || new Response('离线状态', { status: 503 });
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => {
              return name.startsWith('codeseek-') && 
                     name !== STATIC_CACHE_NAME && 
                     name !== DYNAMIC_CACHE_NAME &&
                     name !== API_CACHE_NAME;
            })
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (request.method !== 'GET') {
    return;
  }
  
  if (url.origin !== location.origin) {
    return;
  }
  
  if (url.pathname.startsWith('/api/')) {
    const config = getApiCacheConfig(request.url);
    if (config) {
      switch (config.strategy) {
        case CACHE_STRATEGIES.CACHE_FIRST:
          event.respondWith(cacheFirst(request, API_CACHE_NAME));
          break;
        case CACHE_STRATEGIES.NETWORK_FIRST:
          event.respondWith(networkFirst(request, API_CACHE_NAME, config.maxAge));
          break;
        case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
          event.respondWith(staleWhileRevalidate(request, API_CACHE_NAME, config.maxAge));
          break;
        default:
          event.respondWith(networkFirst(request, API_CACHE_NAME, config.maxAge));
      }
    } else {
      event.respondWith(networkFirst(request, API_CACHE_NAME));
    }
    return;
  }
  
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname === asset + '/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
    return;
  }
  
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'font' ||
      request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE_NAME));
    return;
  }
  
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      networkFirst(request, DYNAMIC_CACHE_NAME)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE_NAME));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
      })
    );
  }
});
