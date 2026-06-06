const ok=()=>window.SUPABASE_URL&&!window.SUPABASE_URL.includes('COLE_AQUI')&&window.SUPABASE_ANON_KEY&&!window.SUPABASE_ANON_KEY.includes('COLE_AQUI');
const client=ok()?supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY):null;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)]; let current='products', editing=null;
const fields={
 products:['id','name','category','description','benefits','image_url','featured','active'],
 posts:['id','title','excerpt','body','cover_url','published'],
 testimonials:['id','name','text','photo_url','rating','active'],
 categories:['id','name','description'],
 settings:['whatsapp','email','endereco','instagram','logo_url','hero_url']
};
const labels={products:'Produtos',posts:'Blog / Artigos',testimonials:'Depoimentos',categories:'Categorias',settings:'Configurações'};
function inputFor(k,v=''){let type=(k.includes('featured')||k.includes('active')||k.includes('published'))?'checkbox':(k.includes('body')||k.includes('description')||k.includes('benefits')||k.includes('text')?'textarea':'input');let ph={id:'identificador-sem-espaco',image_url:'URL da imagem ou envie abaixo',cover_url:'URL da capa ou envie abaixo',photo_url:'URL da foto ou envie abaixo'}[k]||k; if(type==='checkbox')return `<label><input name="${k}" type="checkbox" ${v?'checked':''}> ${k}</label>`; if(type==='textarea')return `<textarea name="${k}" placeholder="${ph}" rows="4">${v||''}</textarea>`; return `<input name="${k}" placeholder="${ph}" value="${v||''}">`}
async function upload(file){if(!file)return null;let path=`uploads/${Date.now()}-${file.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9.]/g,'-')}`;let {error}=await client.storage.from(window.SITE_IMAGE_BUCKET||'site-images').upload(path,file,{upsert:true});if(error)throw error;return client.storage.from(window.SITE_IMAGE_BUCKET||'site-images').getPublicUrl(path).data.publicUrl}
async function requireLogin(){if(!client){$('#app').innerHTML='<div class="notice">Configure o Supabase em assets/js/config.js para usar o painel.</div>';return false}let {data}=await client.auth.getSession(); if(!data.session){$('#app').innerHTML=`<div class="admin-panel" style="max-width:420px;margin:80px auto"><h1>Entrar no painel</h1><input id="email" placeholder="E-mail"><input id="pass" type="password" placeholder="Senha"><button class="btn" id="login">Entrar</button><p id="msg"></p></div>`;$('#login').onclick=async()=>{let {error}=await client.auth.signInWithPassword({email:$('#email').value,password:$('#pass').value}); if(error)$('#msg').textContent=error.message; else location.reload()};return false}return true}
async function list(){let table=current; $('#title').textContent=labels[table]; editing=null; let data=[]; if(table==='settings'){let r=await client.from('settings').select('*').limit(1).maybeSingle(); data=r.data?[r.data]:[]} else {let r=await client.from(table).select('*').order(fields[table][1]||'id'); data=r.data||[]} renderForm(data[0]||{}); $('#list').innerHTML=data.map(row=>`<div class="admin-item"><b>${row.name||row.title||row.email||row.id}</b><span><button data-id="${row.id||'settings'}" class="edit">Editar</button>${table!=='settings'?` <button data-id="${row.id}" class="del">Excluir</button>`:''}</span></div>`).join(''); $$('.edit').forEach(b=>b.onclick=()=>{editing=data.find(x=>(x.id||'settings')===b.dataset.id); renderForm(editing)}); $$('.del').forEach(b=>b.onclick=async()=>{if(confirm('Excluir?')){await client.from(table).delete().eq('id',b.dataset.id);list()}})}

function renderForm(row={}){
 let urlField=current==='products'?'image_url':current==='posts'?'cover_url':current==='testimonials'?'photo_url':null;
 let extra='';
 if(urlField){extra=`<label class="full">Enviar imagem<input id="file" type="file" accept="image/*"></label>`}
 if(current==='settings'){
  extra=`<label>Enviar logo<input id="fileLogo" type="file" accept="image/*"></label><label>Enviar banner da Home<input id="fileHero" type="file" accept="image/*"></label>`
 }
 $('#form').innerHTML=`<div class="admin-form">${fields[current].map(k=>inputFor(k,row[k])).join('')}${extra}<button class="btn full" id="save">Salvar</button></div>`; $('#save').onclick=save
}


async function save(){
 let obj={}; fields[current].forEach(k=>{let el=$(`[name="${k}"]`); obj[k]=el.type==='checkbox'?el.checked:el.value});
 let file=$('#file')?.files?.[0];
 if(file){let url=await upload(file); if(current==='products')obj.image_url=url; if(current==='posts')obj.cover_url=url; if(current==='testimonials')obj.photo_url=url}
 if(current==='settings'){
  let logo=$('#fileLogo')?.files?.[0], hero=$('#fileHero')?.files?.[0];
  if(logo)obj.logo_url=await upload(logo);
  if(hero)obj.hero_url=await upload(hero);
  await client.from('settings').upsert({...obj,id:1})
 } else {
  if(!obj.id)obj.id=(obj.name||obj.title||Date.now()).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');
  await client.from(current).upsert(obj)
 }
 list()
}

async function boot(){if(!await requireLogin())return; $('#app').innerHTML=`<div class="admin"><aside><h2>Galeria das Ervas</h2>${Object.keys(labels).map(k=>`<button data-tab="${k}">${labels[k]}</button>`).join('')}<button id="logout">Sair</button></aside><main><div class="admin-panel"><div class="notice">Painel simples: edite textos, envie imagens e salve. O site público atualiza automaticamente.</div><h1 id="title"></h1><div id="form"></div><div id="list" class="admin-list"></div></div></main></div>`; $$('aside button[data-tab]').forEach(b=>b.onclick=()=>{current=b.dataset.tab;$$('aside button').forEach(x=>x.classList.remove('active'));b.classList.add('active');list()}); $('#logout').onclick=async()=>{await client.auth.signOut();location.reload()}; $('aside button[data-tab]').classList.add('active');list()}
document.addEventListener('DOMContentLoaded',boot);
