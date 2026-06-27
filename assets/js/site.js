const cfgOk=()=>window.APPS_SCRIPT_URL&&window.APPS_SCRIPT_URL.includes('script.google.com')&&!window.APPS_SCRIPT_URL.includes('COLE_AQUI');
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let DATA=structuredClone(window.FALLBACK);
const DATA_CACHE_KEY='gde_public_data_v1';
const DATA_CACHE_MAX_AGE=1000*60*60*12;
const DATA_STALE_MAX_AGE=1000*60*60*24*7;
const JSONP_TIMEOUT=6500;
let interestSetupDone=false;
function cleanupJsonp(cb,s,timer){
 clearTimeout(timer);
 delete window[cb];
 if(s&&s.parentNode) s.remove();
}
function loadScriptData(timeout=JSONP_TIMEOUT){
 return new Promise((resolve,reject)=>{
  const cb='gdeDataCallback_'+Date.now();
  const s=document.createElement('script');
  const sep=window.APPS_SCRIPT_URL.includes('?')?'&':'?';
  const timer=setTimeout(()=>{cleanupJsonp(cb,s,timer);reject(new Error('Tempo esgotado ao carregar dados.'));},timeout);
  window[cb]=(payload)=>{cleanupJsonp(cb,s,timer); resolve(payload);};
  s.onerror=()=>{cleanupJsonp(cb,s,timer); reject(new Error('Falha ao carregar dados do Apps Script'));};
  s.src=`${window.APPS_SCRIPT_URL}${sep}action=publicData&callback=${cb}`;
  document.head.appendChild(s);
 });
}
function callAppsScript(action,params={}){
 return new Promise((resolve,reject)=>{
  if(!cfgOk()) return reject(new Error('Apps Script nao configurado.'));
  const cb='gdeCallback_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  const s=document.createElement('script');
  const sep=window.APPS_SCRIPT_URL.includes('?')?'&':'?';
  const qs=new URLSearchParams({...params,action,callback:cb});
  const timer=setTimeout(()=>{cleanupJsonp(cb,s,timer);reject(new Error('Tempo esgotado. Tente novamente.'));},JSONP_TIMEOUT);
  window[cb]=(payload)=>{cleanupJsonp(cb,s,timer); resolve(payload);};
  s.onerror=()=>{cleanupJsonp(cb,s,timer); reject(new Error('Falha ao enviar.'));};
  s.src=`${window.APPS_SCRIPT_URL}${sep}${qs.toString()}`;
  document.head.appendChild(s);
 });
}
function mergeRemoteData(remote){
 if(!remote||!remote.ok) return false;
 DATA={
  settings:{...DATA.settings,...(remote.settings||{})},
  categories:remote.categories?.length?remote.categories:DATA.categories,
  products:remote.products?.length?remote.products:DATA.products,
  posts:remote.posts?.length?remote.posts:DATA.posts,
  testimonials:remote.testimonials?.length?remote.testimonials:DATA.testimonials
 };
 return true;
}
function readCachedData(allowStale=false){
 try{
  const cached=JSON.parse(localStorage.getItem(DATA_CACHE_KEY)||'null');
  if(!cached||!cached.data) return null;
  const maxAge=allowStale?DATA_STALE_MAX_AGE:DATA_CACHE_MAX_AGE;
  if(Date.now()-(cached.savedAt||0)>maxAge) return null;
  return cached.data;
 }catch(e){return null}
}
function writeCachedData(data){
 try{localStorage.setItem(DATA_CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}))}catch(e){}
}
async function refreshDataInBackground(){
 if(!cfgOk()) return;
 try{
  const remote=await loadScriptData();
  if(mergeRemoteData(remote)){
   writeCachedData(remote);
   renderSite(true);
  }
 }catch(e){console.warn('Atualização em segundo plano falhou.',e)}
}
async function loadData(){
 if(!cfgOk()) return DATA;
 const cached=readCachedData(true);
 if(cached&&mergeRemoteData(cached)){
  refreshDataInBackground();
  return DATA;
 }
 try{
  const remote=await loadScriptData();
  if(mergeRemoteData(remote)){
   writeCachedData(remote);
  }
 }catch(e){console.warn('Usando dados locais.',e)}
 return DATA;
}
function categoryName(id){return DATA.categories.find(c=>c.id===id)?.name||id}
function asText(v){return String(v??'')}
function hasWhatsNumber(){return asText(DATA.settings.whatsapp).replace(/\D/g,'').length>0}
function hasWhats(){return settingOn('whatsapp')&&hasWhatsNumber()}
function waLink(msg='Olá! Vim pelo site e gostaria de tirar uma dúvida.'){let n=asText(DATA.settings.whatsapp).replace(/\D/g,'');return n?`https://wa.me/${n}?text=${encodeURIComponent(msg)}`:'#'}
const PRODUCT_IMAGE_MAP={
 'camomila':'assets/img/produtos/camomila.jpg','hibisco':'assets/img/produtos/hibisco.jpg','cha-verde':'assets/img/produtos/cha-verde.jpg','curcuma':'assets/img/produtos/curcuma.jpg','gengibre':'assets/img/produtos/gengibre.jpg','canela-em-pau':'assets/img/produtos/canela-em-pau.jpg','oregano':'assets/img/produtos/oregano.jpg','alecrim':'assets/img/produtos/alecrim.jpg','hortela':'assets/img/produtos/hortela.jpg','erva-doce':'assets/img/produtos/erva-doce.jpg','moringa-po':'assets/img/produtos/moringa-po.jpg','psyllium':'assets/img/produtos/psyllium.jpg','granola-integral':'assets/img/produtos/granola-integral.jpg','chia':'assets/img/produtos/chia.jpg','linhaça-dourada':'assets/img/produtos/linhaca-dourada.jpg','linhaca-dourada':'assets/img/produtos/linhaca-dourada.jpg','cha-relaxante':'assets/img/produtos/cha-relaxante.jpg'
};

const CATEGORY_ICON_MAP={
 'ervas-medicinais':'assets/img/icones/ervas-medicinais.png',
 'chas-naturais':'assets/img/icones/chas-naturais.png',
 'alimentos-funcionais':'assets/img/icones/alimentos-funcionais.png',
 'especiarias-temperos':'assets/img/icones/especiarias-temperos.png'
};
function categoryIcon(c){return c?.image_url||CATEGORY_ICON_MAP[c?.id||c]||'assets/img/icones/ervas-medicinais.png'}
function productImage(p){return p?.image_url||PRODUCT_IMAGE_MAP[p?.id]||'assets/img/site/hero-ervas.png'}
window.handleImageError=function(img){let id=img.dataset.productId; img.onerror=null; img.src=PRODUCT_IMAGE_MAP[id]||'assets/img/site/hero-ervas.png'}
function selectedIds(){try{return JSON.parse(localStorage.getItem('gde_interest')||'[]')}catch(e){return []}}
function saveSelected(ids){localStorage.setItem('gde_interest',JSON.stringify([...new Set(ids)])); renderInterestBox(); updateInterestButtons();}
function selectedProducts(){let ids=selectedIds(); return ids.map(id=>DATA.products.find(p=>p.id===id)).filter(Boolean)}
function addInterest(id){let ids=selectedIds(); if(!ids.includes(id)) ids.push(id); saveSelected(ids)}
function removeInterest(id){saveSelected(selectedIds().filter(x=>x!==id))}
function updateInterestButtons(){let ids=selectedIds(); $$('[data-add-interest]').forEach(b=>{let added=ids.includes(b.dataset.addInterest); b.classList.toggle('added',added); b.textContent=added?'Adicionado à seleção':'Adicionar à seleção';})}
function interestMessage(items){return `Olá!\n\nMontei uma lista de interesse pelo site:\n\n${items.map(p=>'- '+p.name).join('\n')}\n\nGostaria de conversar sobre disponibilidade, quantidade, formas de retirada e pagamento.\n\nObrigado.`}
function renderInterestBox(){let box=$('#interestBox'); if(!box) return; let items=selectedProducts(); box.classList.toggle('open',items.length>0); box.innerHTML=`<button class="interest-toggle" type="button">Minha seleção <strong>${items.length}</strong></button><div class="interest-panel"><p class="interest-note">Esta é uma lista de interesse. Não é compra direta; tudo é combinado pelo WhatsApp.</p>${items.length?`<ul>${items.map(p=>`<li><span>${p.name}</span><button type="button" data-remove-interest="${p.id}" aria-label="Remover ${p.name}">×</button></li>`).join('')}</ul><a class="btn" target="_blank" href="${waLink(interestMessage(items))}">Conversar no WhatsApp</a>`:'<p>Nenhum produto selecionado ainda.</p>'}</div>`; $$('[data-remove-interest]',box).forEach(b=>b.onclick=()=>removeInterest(b.dataset.removeInterest)); $('.interest-toggle',box).onclick=()=>box.classList.toggle('expanded')}
function setupInterest(){if(!hasWhatsNumber()){const box=$('#interestBox'); if(box) box.remove(); return;} if(!$('#interestBox')){let div=document.createElement('div');div.id='interestBox';div.className='interest-box';document.body.appendChild(div)} renderInterestBox(); if(!interestSetupDone){document.addEventListener('click',e=>{let b=e.target.closest('[data-add-interest]'); if(b){e.preventDefault(); addInterest(b.dataset.addInterest)}}); interestSetupDone=true;}}

function settingOn(key){ return DATA.settings[key + '_active'] !== false && String(DATA.settings[key + '_active']).toLowerCase() !== 'false'; }
function applyVisibility(selector, key){ $$(selector).forEach(el=>{ el.style.display = settingOn(key) ? '' : 'none'; }); }
function applyVisibilityWithFallback(selector, visible, opts={}){
 $$(selector).forEach(el=>{
  if(opts.skip && opts.skip.some(skip=>el.closest(skip))) return;
  const target=opts.parent ? (el.closest(opts.parent) || el) : el;
  target.style.display=visible?'':'none';
 });
}
function applyWhatsVisibility(){
 const visible=hasWhats();
 applyVisibilityWithFallback('.js-whats', visible, {parent:'.quick-item,.footer-contact p,.contact-info-card p,.mobile-menu-info a,.social a,.footer-social a,.nav a', skip:['.detail-actions','#interestBox']});
 applyVisibilityWithFallback('.setting-whatsapp', visible, {skip:['.detail-actions','#interestBox']});
}
function applyEmailVisibility(){
 const visible=settingOn('email');
 applyVisibility('.setting-email','email');
 applyVisibilityWithFallback('.js-email', visible, {parent:'.quick-item,.footer-contact p,.contact-info-card p,.mobile-menu-info a'});
}
function applyAddressVisibility(){
 const visible=settingOn('endereco');
 applyVisibility('.setting-endereco','endereco');
 applyVisibilityWithFallback('.js-endereco', visible, {parent:'.footer-contact p,.contact-info-card p'});
 applyVisibilityWithFallback('.js-maps', visible);
 applyVisibilityWithFallback('.js-map-frame', visible, {parent:'.contact-map-preview'});
}
function applySocialVisibility(){
 applyVisibility('.setting-instagram','instagram');
 applyVisibility('.setting-facebook','facebook');
 applyVisibility('.setting-x-twitter','x_twitter');
 applyVisibilityWithFallback('.js-instagram', settingOn('instagram'), {parent:'.social a,.footer-social a,.mobile-menu-info a'});
 applyVisibilityWithFallback('.js-facebook', settingOn('facebook'), {parent:'.social a,.footer-social a,.mobile-menu-info a'});
 applyVisibilityWithFallback('.js-x-twitter', settingOn('x_twitter'), {parent:'.social a,.footer-social a,.mobile-menu-info a'});
}
function refreshVisibility(){
 applyWhatsVisibility();
 applyEmailVisibility();
 applyAddressVisibility();
 applySocialVisibility();
}
function setBase(){
 const endereco=DATA.settings.endereco||'R. Ourizona, 2501 - Sítio Cercado, 81920-620 - Curitiba - PR';
 const maps='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(endereco);
 const mapsEmbed='https://www.google.com/maps?q='+encodeURIComponent(endereco)+'&output=embed';
 $$('.js-logo').forEach(i=>i.src=DATA.settings.logo_url||'assets/img/site/logo.png');
 $$('.js-email').forEach(a=>{a.textContent=DATA.settings.email||'contato@galeriadaservas.com.br';a.href='mailto:'+(DATA.settings.email||'contato@galeriadaservas.com.br')});
 $$('.js-whats').forEach(a=>{a.href=waLink();});
 $$('.js-endereco').forEach(e=>e.textContent=endereco);
 $$('.js-maps').forEach(a=>{a.href=maps});
 $$('.js-map-frame').forEach(f=>{f.src=mapsEmbed;f.title='Mapa: '+endereco});
 $$('.js-instagram').forEach(a=>{let v=asText(DATA.settings.instagram);a.href=v.startsWith('http')?v:'#';});
 $$('.js-facebook').forEach(a=>{let v=asText(DATA.settings.facebook);a.href=v.startsWith('http')?v:'#';});
 $$('.js-x-twitter').forEach(a=>{let v=asText(DATA.settings.x_twitter);a.href=v.startsWith('http')?v:'#';});
 enhanceSocialIcons();
 refreshVisibility();
 markActiveMenu();
 setupNewsletterForms();
}
function markActiveMenu(){let file=location.pathname.split('/').pop()||'index.html'; if(file==='produto.html')file='produtos.html'; if(file==='artigo.html')file='blog.html'; $$('.nav a[href]').forEach(a=>{a.classList.toggle('active',a.getAttribute('href')===file)})}

const SOCIAL_ICONS={
 instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.2" y="4.2" width="15.6" height="15.6" rx="4.7"></rect><circle cx="12" cy="12" r="3.8"></circle><circle class="dot" cx="16.9" cy="7.1" r="1.1"></circle></svg>',
 facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 8.1h2.1V4.7c-.4-.1-1.6-.2-3-.2-3 0-5 1.8-5 5.2v2.9H5v3.8h3.3V24h4.1v-7.6h3.2l.5-3.8h-3.7v-2.5c0-1.1.3-2 1.8-2Z"></path></svg>',
 whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2a8.7 8.7 0 0 0-7.4 13.2L3.7 21l4.7-1.2A8.7 8.7 0 1 0 12 3.2Z"></path><path class="phone" d="M8.8 7.9c-.2-.5-.4-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.1 1.1-1.1 2.6 0 1.5 1.1 3 1.2 3.2.1.2 2.1 3.3 5.2 4.4 2.6 1 3.1.8 3.7.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4l-1.9-.9c-.3-.1-.5-.1-.7.2-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.5.1-.2.1-.4 0-.6l-.9-2.1Z"></path></svg>',
 x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 10.5 21.4 2h-1.7l-6.3 7.4L8.4 2H2.6l7.6 11.1L2.6 22h1.7l6.7-7.9 5.4 7.9h5.8l-8-11.5Zm-2.4 2.8-.8-1.1L4.9 3.3h2.6l4.9 7 .8 1.1 6.4 9.2H17l-5.2-7.3Z"></path></svg>'
};
function enhanceSocialIcons(){
 const pairs=[['.social .js-instagram,.footer-social .js-instagram','instagram','Instagram'],['.social .js-facebook,.footer-social .js-facebook','facebook','Facebook'],['.social .js-whats,.footer-social .js-whats','whatsapp','WhatsApp'],['.social .js-x-twitter,.footer-social .js-x-twitter','x','X']];
 pairs.forEach(([selector,key,label])=>{
  $$(selector).forEach(a=>{
   if(a.dataset.iconReady==='true') return;
   a.innerHTML=SOCIAL_ICONS[key];
   a.setAttribute('aria-label',label);
   a.dataset.iconReady='true';
  });
 });
}

function setupNewsletterForms(){
 $$('.newsletter form').forEach(form=>{
  if(form.dataset.bound==='true') return;
  form.dataset.bound='true';
  const input=form.querySelector('input[type="email"],input');
  const button=form.querySelector('button');
  let msg=form.querySelector('.newsletter-msg');
  if(!msg){msg=document.createElement('p');msg.className='newsletter-msg';form.appendChild(msg)}
  form.addEventListener('submit',e=>e.preventDefault());
  if(button) button.type='submit';
  if(input) input.setAttribute('autocomplete','email');
  form.onsubmit=async e=>{
   e.preventDefault();
   const email=(input&&input.value||'').trim();
   msg.textContent='Enviando...';
   msg.classList.remove('error');
   if(button){button.disabled=true;button.textContent='Enviando...';}
   try{
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail valido.');
    const res=await callAppsScript('subscribe',{email,source:'newsletter'});
    if(!res||!res.ok) throw new Error(res&&res.message||'Nao foi possivel cadastrar.');
    msg.textContent=res.duplicate?'Este e-mail ja esta cadastrado.':'E-mail cadastrado com sucesso.';
    if(input&&!res.duplicate) input.value='';
   }catch(err){
    msg.textContent=err.message||String(err);
    msg.classList.add('error');
   }finally{
    if(button){button.disabled=false;button.textContent='Enviar';}
   }
  };
 });
}

function addEntrance(root=document){
 const productCards=$$('.product-card',root);
 productCards.forEach(el=>{el.classList.add('product-fade'); el.style.transitionDelay='0ms';});

 const grouped=$$('.feature-strip .mini,.categories .category',root);
 grouped.forEach(el=>{el.classList.add('group-rise'); el.style.transitionDelay='0ms';});

 const normal=$$('.hero h1,.newsletter,.about-card,.about-photo,.about-value,.title,.post-card,.testimonial',root)
  .filter(el=>!el.classList.contains('product-card'));
 normal.forEach((el,i)=>{el.classList.add('scroll-reveal'); el.style.transitionDelay=(i%3)*110+'ms';});

 const observed=[...productCards,...grouped,...normal];
 const obs=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');obs.unobserve(e.target)}})},{threshold:.14,rootMargin:'0px 0px -7% 0px'});
 observed.forEach(el=>obs.observe(el));

 const floaters=$$('.mini,.category,.about-photo,.about-card,.testimonial',root);
 let ticking=false;
 function float(){
  let vh=innerHeight;
  floaters.forEach((el)=>{
   let r=el.getBoundingClientRect();
   if(r.bottom>0&&r.top<vh){
    let center=(r.top+r.height/2)-vh/2;
    let y=Math.max(-5,Math.min(5,-center/vh*6));
    el.style.setProperty('--float-y',y+'px');
   }
  });
  ticking=false;
 }
 addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(float);ticking=true;}},{passive:true});
 float();
}
function revealDynamic(root=document){
 const productCards=$$('.product-card',root);
 productCards.forEach(el=>{el.classList.add('product-fade'); el.style.transitionDelay='0ms'; requestAnimationFrame(()=>el.classList.add('in-view'));});
}

function formatArticleBody(body=''){
 return body.split(/\n{2,}/).map(block=>{
  const text=block.trim();
  if(!text) return '';
  if(text.startsWith('## ')) return `<h2>${text.slice(3)}</h2>`;
  if(text.startsWith('> ')) return `<div class="article-callout">${text.slice(2)}</div>`;
  if(text.startsWith('- ')) return `<ul>${text.split('\n').map(x=>`<li>${x.replace(/^- /,'').trim()}</li>`).join('')}</ul>`;
  if(text.startsWith('OBS:')) return `<p class="article-note">${text}</p>`;
  return `<p>${text.replaceAll('\n','<br>')}</p>`;
 }).join('');
}

function featuredProducts(){let featured=DATA.products.filter(p=>p.featured===true||asText(p.featured).toLowerCase()==='true'||asText(p.featured).toLowerCase()==='sim'||asText(p.featured)==='1'); return (featured.length?featured:DATA.products).slice(0,4)}
function cardProduct(p){return `<article class="card product-card"><a class="product-image-link" href="produto.html?id=${p.id}"><img src="${productImage(p)}" data-product-id="${p.id}" alt="${p.name}" loading="lazy" onerror="handleImageError(this)"></a><div><small>${categoryName(p.category)}</small><h3>${p.name}</h3><p>${p.description||''}</p></div><div class="product-actions"><a class="btn small" href="produto.html?id=${p.id}">Ver produto</a><button class="btn outline small" type="button" data-add-interest="${p.id}">Adicionar à seleção</button></div></article>`}
function cardPost(p){return `<article class="card post-card"><img src="${p.cover_url||'assets/img/site/hero-ervas.png'}" alt="${p.title}" loading="lazy" onerror="this.onerror=null;this.src='assets/img/site/hero-ervas.png'"><div><h3>${p.title}</h3><p>${p.excerpt||''}</p><a href="artigo.html?id=${p.id}">Leia mais</a></div></article>`}
function renderSite(isRefresh=false){setBase(); setupInterest(); const page=document.body.dataset.page;
 if(page==='home'){ $('.hero').style.backgroundImage=`linear-gradient(90deg,rgba(21,115,50,.65),rgba(21,115,50,.2)),url('${DATA.settings.hero_url||'assets/img/site/hero-ervas.png'}')`; $('#featured').innerHTML=featuredProducts().map(cardProduct).join(''); $('#categories').innerHTML=DATA.categories.map(c=>`<article class="category"><img class="category-icon" src="${categoryIcon(c)}" alt="" onerror="this.onerror=null;this.src='${CATEGORY_ICON_MAP[c.id]||'assets/img/icones/ervas-medicinais.png'}'"><h3>${c.name}</h3><p>${c.description||''}</p></article>`).join(''); $('#posts').innerHTML=DATA.posts.slice(0,3).map(cardPost).join(''); $('#testimonials').innerHTML=DATA.testimonials.slice(0,3).map(t=>`<article class="card testimonial"><img src="${t.photo_url||'assets/img/site/logo.png'}" alt="${t.name}" onerror="this.onerror=null;this.src='assets/img/site/logo.png'"><h3>${t.name}</h3><p>${t.text}</p><strong>${t.rating||5}/5</strong></article>`).join('');}
 if(page==='produtos'){ $('#filters').innerHTML='<button data-cat="all" class="active">Todos</button>'+DATA.categories.map(c=>`<button data-cat="${c.id}">${c.name}</button>`).join(''); const render=cat=>{ $('#products').innerHTML=DATA.products.filter(p=>cat==='all'||p.category===cat).map(cardProduct).join(''); revealDynamic($('#products')); }; render('all'); $$('#filters button').forEach(b=>b.onclick=()=>{$$('#filters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');render(b.dataset.cat)});}
 if(page==='produto'){let id=new URLSearchParams(location.search).get('id')||DATA.products[0].id, p=DATA.products.find(x=>x.id===id)||DATA.products[0]; document.title=p.name+' | Galeria das Ervas'; $('#productDetail').innerHTML=`<img src="${productImage(p)}" data-product-id="${p.id}" alt="${p.name}" onerror="handleImageError(this)"><div><span class="pill">${categoryName(p.category)}</span><h1>${p.name}</h1><p>${p.description||''}</p><h3>Características</h3><p>${p.benefits||'Produto natural selecionado com cuidado.'}</p><div class="detail-actions"><a class="btn js-whats setting-whatsapp" href="${waLink(`Olá!\n\nTenho interesse no produto:\n\n- ${p.name}\n\nGostaria de conversar sobre disponibilidade, quantidade, formas de retirada e pagamento.\n\nObrigado.`)}" target="_blank">Tenho interesse neste produto</a><button class="btn outline" type="button" data-add-interest="${p.id}">Adicionar à minha seleção</button></div></div>`; let rel=DATA.products.filter(x=>x.category===p.category&&x.id!==p.id); if(rel.length<4){rel=[...rel,...DATA.products.filter(x=>x.id!==p.id&&!rel.find(r=>r.id===x.id))]}; $('#related').innerHTML=rel.slice(0,4).map(cardProduct).join('');}
 if(page==='blog'){ $('#postsList').innerHTML=DATA.posts.map(cardPost).join('');}
 if(page==='artigo'){let id=new URLSearchParams(location.search).get('id')||DATA.posts[0].id, p=DATA.posts.find(x=>x.id===id)||DATA.posts[0]; document.title=p.title+' | Galeria das Ervas'; $('#article').innerHTML=`<img class="article-cover" src="${p.cover_url||'assets/img/site/hero-ervas.png'}" alt="${p.title}" onerror="this.onerror=null;this.src='assets/img/site/hero-ervas.png'"><h1>${p.title}</h1><p class="lead">${p.excerpt||''}</p><div class="article-body">${formatArticleBody(p.body||'')}</div>`;}
 refreshVisibility(); isRefresh?revealDynamic(document):addEntrance(); updateInterestButtons(); renderInterestBox();
}
async function boot(){
 setupNewsletterForms();
 const cached=cfgOk()?readCachedData(true):null;
 if(cached) mergeRemoteData(cached);
 renderSite(false);
 refreshDataInBackground();
}
document.addEventListener('DOMContentLoaded',boot);

// v10 - abre/fecha menu sanduíche no mobile
(function setupMobileMenu(){
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.querySelector('.menu-toggle');
    const nav=document.querySelector('.nav');
    if(!btn||!nav) return;
    btn.addEventListener('click',()=>{
      const open=document.body.classList.toggle('menu-open');
      btn.classList.toggle('is-open',open);
      btn.setAttribute('aria-expanded',open?'true':'false');
    });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
      document.body.classList.remove('menu-open');
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded','false');
    }));
  });
})();
