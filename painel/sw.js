const CACHE_NAME='gde-painel-shell-v1';
const OFFLINE_URL='/painel/offline.html';
const CORE_ASSETS=[
  '/painel/',
  '/painel/index.html',
  '/painel/manifest.webmanifest',
  '/painel/icons/icon-192.png',
  '/painel/icons/icon-512.png',
  OFFLINE_URL,
  '/assets/img/site/logo.png',
  '/assets/img/site/favicon-192.png',
  '/assets/img/site/favicon-512.png',
  '/assets/img/site/apple-touch-icon.png'
];

self.addEventListener('install',event=>{
  console.info('[Galeria das Ervas PWA] Instalando shell do painel.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(CORE_ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith('gde-painel-')&&key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(request,fallback){
  const cache=await caches.open(CACHE_NAME);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),6000);
  try{
    const response=await fetch(request,{signal:controller.signal});
    if(response.ok) await cache.put(request,response.clone());
    return response;
  }catch(error){
    const cached=(await caches.match(request,{ignoreSearch:true}))||(fallback&&await caches.match(fallback));
    return cached||new Response('',{status:503,statusText:'Offline'});
  }finally{
    clearTimeout(timeout);
  }
}

async function cacheFirst(request){
  const cached=await caches.match(request);
  if(cached) return cached;
  const response=await fetch(request);
  if(response.ok){
    const cache=await caches.open(CACHE_NAME);
    await cache.put(request,response.clone());
  }
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request,OFFLINE_URL));
    return;
  }

  const acceptsJson=(request.headers.get('accept')||'').includes('application/json');
  if(url.pathname.startsWith('/api/')||acceptsJson){
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});
