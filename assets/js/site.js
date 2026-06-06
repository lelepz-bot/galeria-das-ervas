const cfgOk=()=>window.APPS_SCRIPT_URL&&window.APPS_SCRIPT_URL.includes('script.google.com')&&!window.APPS_SCRIPT_URL.includes('COLE_AQUI');
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let DATA=structuredClone(window.FALLBACK);
function loadScriptData(){
 return new Promise((resolve,reject)=>{
  const cb='gdeDataCallback_'+Date.now();
  const s=document.createElement('script');
  const sep=window.APPS_SCRIPT_URL.includes('?')?'&':'?';
  window[cb]=(payload)=>{delete window[cb]; s.remove(); resolve(payload);};
  s.onerror=()=>{delete window[cb]; s.remove(); reject(new Error('Falha ao carregar dados do Apps Script'));};
  s.src=`${window.APPS_SCRIPT_URL}${sep}action=publicData&callback=${cb}`;
  document.head.appendChild(s);
 });
}
async function loadData(){
 if(!cfgOk()) return DATA;
 try{
  const remote=await loadScriptData();
  if(remote&&remote.ok){
   DATA={
    settings:{...DATA.settings,...(remote.settings||{})},
    categories:remote.categories?.length?remote.categories:DATA.categories,
    products:remote.products?.length?remote.products:DATA.products,
    posts:remote.posts?.length?remote.posts:DATA.posts,
    testimonials:remote.testimonials?.length?remote.testimonials:DATA.testimonials
   };
  }
 }catch(e){console.warn('Usando dados locais.',e)}
 return DATA;
}
function categoryName(id){return DATA.categories.find(c=>c.id===id)?.name||id}
function waLink(msg='Olá! Vim pelo site e gostaria de tirar uma dúvida.'){let n=(DATA.settings.whatsapp||'').replace(/\D/g,'');return `https://wa.me/${n||'SEU_NUMERO_AQUI'}?text=${encodeURIComponent(msg)}`}
const PRODUCT_IMAGE_MAP={
 'camomila':'assets/img/produtos/camomila.jpg','hibisco':'assets/img/produtos/hibisco.jpg','cha-verde':'assets/img/produtos/cha-verde.jpg','curcuma':'assets/img/produtos/curcuma.jpg','gengibre':'assets/img/produtos/gengibre.jpg','canela-em-pau':'assets/img/produtos/canela-em-pau.jpg','oregano':'assets/img/produtos/oregano.jpg','alecrim':'assets/img/produtos/alecrim.jpg','hortela':'assets/img/produtos/hortela.jpg','erva-doce':'assets/img/produtos/erva-doce.jpg','moringa-po':'assets/img/produtos/moringa-po.jpg','psyllium':'assets/img/produtos/psyllium.jpg','granola-integral':'assets/img/produtos/granola-integral.jpg','chia':'assets/img/produtos/chia.jpg','linhaça-dourada':'assets/img/produtos/linhaca-dourada.jpg','linhaca-dourada':'assets/img/produtos/linhaca-dourada.jpg','cha-relaxante':'assets/img/produtos/cha-relaxante.jpg'
};

const CATEGORY_ICON_MAP={
 'ervas-medicinais':'assets/img/icones/ervas-medicinais.png',
 'chas-naturais':'assets/img/icones/chas-naturais.png',
 'alimentos-funcionais':'assets/img/icones/alimentos-funcionais.png',
 'especiarias-temperos':'assets/img/icones/especiarias-temperos.png'
};
function categoryIcon(id){return CATEGORY_ICON_MAP[id]||'assets/img/icones/ervas-medicinais.png'}
function productImage(p){return p?.image_url||PRODUCT_IMAGE_MAP[p?.id]||'assets/img/site/hero-ervas.png'}
window.handleImageError=function(img){let id=img.dataset.productId; img.onerror=null; img.src=PRODUCT_IMAGE_MAP[id]||'assets/img/site/hero-ervas.png'}
function selectedIds(){try{return JSON.parse(localStorage.getItem('gde_interest')||'[]')}catch(e){return []}}
function saveSelected(ids){localStorage.setItem('gde_interest',JSON.stringify([...new Set(ids)])); renderInterestBox(); updateInterestButtons();}
function selectedProducts(){let ids=selectedIds(); return ids.map(id=>DATA.products.find(p=>p.id===id)).filter(Boolean)}
function addInterest(id){let ids=selectedIds(); if(!ids.includes(id)) ids.push(id); saveSelected(ids)}
function removeInterest(id){saveSelected(selectedIds().filter(x=>x!==id))}
function updateInterestButtons(){let ids=selectedIds(); $$('[data-add-interest]').forEach(b=>{let added=ids.includes(b.dataset.addInterest); b.classList.toggle('added',added); b.textContent=added?'Adicionado à seleção':'Adicionar à seleção';})}
function interestMessage(items){return `Olá!\n\nGostaria de informações sobre os seguintes produtos:\n\n${items.map(p=>'🌿 '+p.name).join('\n')}\n\nPoderiam me orientar sobre disponibilidade e formas de compra?\n\nObrigado.`}
function renderInterestBox(){let box=$('#interestBox'); if(!box) return; let items=selectedProducts(); box.classList.toggle('open',items.length>0); box.innerHTML=`<button class="interest-toggle" type="button">Minha seleção <strong>${items.length}</strong></button><div class="interest-panel"><p class="interest-note">Esta é uma lista de interesse, não é checkout. O atendimento continua pelo WhatsApp.</p>${items.length?`<ul>${items.map(p=>`<li><span>🌿 ${p.name}</span><button type="button" data-remove-interest="${p.id}">×</button></li>`).join('')}</ul><a class="btn" target="_blank" href="${waLink(interestMessage(items))}">Solicitar atendimento</a>`:'<p>Nenhum produto selecionado ainda.</p>'}</div>`; $$('[data-remove-interest]',box).forEach(b=>b.onclick=()=>removeInterest(b.dataset.removeInterest)); $('.interest-toggle',box).onclick=()=>box.classList.toggle('expanded')}
function setupInterest(){if(!$('#interestBox')){let div=document.createElement('div');div.id='interestBox';div.className='interest-box';document.body.appendChild(div)} renderInterestBox(); document.addEventListener('click',e=>{let b=e.target.closest('[data-add-interest]'); if(b){e.preventDefault(); addInterest(b.dataset.addInterest)}})}

function settingOn(key){ return DATA.settings[key + '_active'] !== false && String(DATA.settings[key + '_active']).toLowerCase() !== 'false'; }
function applyVisibility(selector, key){ $$(selector).forEach(el=>{ el.style.display = settingOn(key) ? '' : 'none'; }); }
function setBase(){
 const endereco=DATA.settings.endereco||'R. Ourizona, 2501 - Sítio Cercado, 81920-620 - Curitiba - PR';
 const maps='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(endereco);
 $$('.js-logo').forEach(i=>i.src=DATA.settings.logo_url||'assets/img/site/logo.png');
 $$('.js-email').forEach(a=>{a.textContent=DATA.settings.email||'contato@galeriadaservas.com.br';a.href='mailto:'+(DATA.settings.email||'contato@galeriadaservas.com.br')});
 $$('.js-whats').forEach(a=>{a.href=waLink();});
 $$('.js-endereco').forEach(e=>e.textContent=endereco);
 $$('.js-maps').forEach(a=>{a.href=maps});
 $$('.js-instagram').forEach(a=>{a.href=DATA.settings.instagram?.startsWith('http')?DATA.settings.instagram:'#';});
 $$('.js-facebook').forEach(a=>{a.href=DATA.settings.facebook?.startsWith('http')?DATA.settings.facebook:'#';});
 $$('.js-x-twitter').forEach(a=>{a.href=DATA.settings.x_twitter?.startsWith('http')?DATA.settings.x_twitter:'#';});
 applyVisibility('.setting-whatsapp','whatsapp'); applyVisibility('.setting-email','email'); applyVisibility('.setting-endereco','endereco');
 applyVisibility('.setting-instagram','instagram'); applyVisibility('.setting-facebook','facebook'); applyVisibility('.setting-x-twitter','x_twitter');
 markActiveMenu();
}
function markActiveMenu(){let file=location.pathname.split('/').pop()||'index.html'; if(file==='produto.html')file='produtos.html'; if(file==='artigo.html')file='blog.html'; $$('.nav a[href]').forEach(a=>{if(a.getAttribute('href')===file)a.classList.add('active')})}

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

function cardProduct(p){return `<article class="card product-card"><a class="product-image-link" href="produto.html?id=${p.id}"><img src="${productImage(p)}" data-product-id="${p.id}" alt="${p.name}" loading="lazy" onerror="handleImageError(this)"></a><div><small>${categoryName(p.category)}</small><h3>${p.name}</h3><p>${p.description||''}</p></div><div class="product-actions"><a class="btn small" href="produto.html?id=${p.id}">Ver produto</a><button class="btn outline small" type="button" data-add-interest="${p.id}">Adicionar à seleção</button></div></article>`}
function cardPost(p){return `<article class="card post-card"><img src="${p.cover_url||'assets/img/site/hero-ervas.png'}" alt="${p.title}" loading="lazy" onerror="this.onerror=null;this.src='assets/img/site/hero-ervas.png'"><div><h3>${p.title}</h3><p>${p.excerpt||''}</p><a href="artigo.html?id=${p.id}">Leia mais</a></div></article>`}
async function boot(){await loadData(); setBase(); setupInterest(); const page=document.body.dataset.page;
 if(page==='home'){ $('.hero').style.backgroundImage=`linear-gradient(90deg,rgba(21,115,50,.65),rgba(21,115,50,.2)),url('${DATA.settings.hero_url||'assets/img/site/hero-ervas.png'}')`; $('#featured').innerHTML=DATA.products.filter(p=>p.featured).slice(0,4).map(cardProduct).join(''); $('#categories').innerHTML=DATA.categories.map(c=>`<article class="category"><img class="category-icon" src="${categoryIcon(c.id)}" alt=""><h3>${c.name}</h3><p>${c.description||''}</p></article>`).join(''); $('#posts').innerHTML=DATA.posts.slice(0,3).map(cardPost).join(''); $('#testimonials').innerHTML=DATA.testimonials.slice(0,3).map(t=>`<article class="card testimonial"><img src="${t.photo_url}" alt="${t.name}"><h3>${t.name}</h3><p>${t.text}</p><strong>${'★'.repeat(t.rating||5)}</strong></article>`).join('');}
 if(page==='produtos'){ $('#filters').innerHTML='<button data-cat="all" class="active">Todos</button>'+DATA.categories.map(c=>`<button data-cat="${c.id}">${c.name}</button>`).join(''); const render=cat=>{ $('#products').innerHTML=DATA.products.filter(p=>cat==='all'||p.category===cat).map(cardProduct).join(''); revealDynamic($('#products')); }; render('all'); $$('#filters button').forEach(b=>b.onclick=()=>{$$('#filters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');render(b.dataset.cat)});}
 if(page==='produto'){let id=new URLSearchParams(location.search).get('id')||DATA.products[0].id, p=DATA.products.find(x=>x.id===id)||DATA.products[0]; document.title=p.name+' | Galeria das Ervas'; $('#productDetail').innerHTML=`<img src="${productImage(p)}" data-product-id="${p.id}" alt="${p.name}" onerror="handleImageError(this)"><div><span class="pill">${categoryName(p.category)}</span><h1>${p.name}</h1><p>${p.description||''}</p><h3>Características</h3><p>${p.benefits||'Produto natural selecionado com cuidado.'}</p><div class="detail-actions"><a class="btn" href="${waLink(`Olá!\n\nTenho interesse no produto:\n\n🌿 ${p.name}\n\nGostaria de mais informações sobre disponibilidade, utilização e formas de compra.\n\nObrigado.`)}" target="_blank">Tenho interesse neste produto</a><button class="btn outline" type="button" data-add-interest="${p.id}">Adicionar à minha seleção</button></div></div>`; let rel=DATA.products.filter(x=>x.category===p.category&&x.id!==p.id); if(rel.length<4){rel=[...rel,...DATA.products.filter(x=>x.id!==p.id&&!rel.find(r=>r.id===x.id))]}; $('#related').innerHTML=rel.slice(0,4).map(cardProduct).join('');}
 if(page==='blog'){ $('#postsList').innerHTML=DATA.posts.map(cardPost).join('');}
 if(page==='artigo'){let id=new URLSearchParams(location.search).get('id')||DATA.posts[0].id, p=DATA.posts.find(x=>x.id===id)||DATA.posts[0]; document.title=p.title+' | Galeria das Ervas'; $('#article').innerHTML=`<img class="article-cover" src="${p.cover_url||'assets/img/site/hero-ervas.png'}" alt="${p.title}" onerror="this.onerror=null;this.src='assets/img/site/hero-ervas.png'"><h1>${p.title}</h1><p class="lead">${p.excerpt||''}</p><div class="article-body">${formatArticleBody(p.body||'')}</div>`;}
 addEntrance(); updateInterestButtons(); renderInterestBox();
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
