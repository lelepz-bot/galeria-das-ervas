/***********************
 * GALERIA DAS ERVAS
 * Backend simples com Google Sheets + Drive + Apps Script
 ***********************/

const APP = {
  // Pasta principal do cliente no Google Drive.
  // Tudo será criado dentro dela: planilha, pasta de imagens e arquivos enviados pelo painel.
  rootFolderId: '1wNeW_QrCNAiYygKHOjQ3zGj8UFopnbez',
  spreadsheetName: 'Galeria das Ervas - Base do Site',
  imageFolderName: 'Galeria das Ervas - Imagens do Site',
  sheets: {
    settings: 'configuracoes',
    categories: 'categorias',
    products: 'produtos',
    posts: 'blog',
    testimonials: 'depoimentos',
    subscriptions: 'inscricoes'
  }
};
const PUBLIC_CACHE_KEY = 'publicData:v1';

function doGet(e) {
  ensureSetup_();
  const action = e && e.parameter && e.parameter.action;
  if (action === 'publicData') return publicData_(e);
  if (action === 'subscribe') return subscribe_(e);
  const auth = adminAccess_();
  if (!auth.ok) return unauthorizedPage_(auth);
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Painel | Galeria das Ervas')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function publicData_(e) {
  const data = getPublicData();
  const callback = e.parameter.callback || '';
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function getPublicData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(PUBLIC_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      cache.remove(PUBLIC_CACHE_KEY);
    }
  }
  const ss = getDb_();
  const settings = settingsObject_(readRows_(ss.getSheetByName(APP.sheets.settings)));
  const data = {
    ok: true,
    settings,
    categories: readRows_(ss.getSheetByName(APP.sheets.categories)).filter(r => bool_(r.active)).sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999)),
    products: readRows_(ss.getSheetByName(APP.sheets.products)).filter(r => bool_(r.active)).sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999)),
    posts: readRows_(ss.getSheetByName(APP.sheets.posts)).filter(r => bool_(r.published)),
    testimonials: readRows_(ss.getSheetByName(APP.sheets.testimonials)).filter(r => bool_(r.active))
  };
  try {
    cache.put(PUBLIC_CACHE_KEY, JSON.stringify(data), 300);
  } catch (err) {}
  return data;
}

function getAdminData() {
  const access = adminGuard_();
  const ss = getDb_();
  return {
    ok: true,
    adminAccess: access,
    spreadsheetUrl: ss.getUrl(),
    folderUrl: getImageFolder_().getUrl(),
    settingsRows: readRows_(ss.getSheetByName(APP.sheets.settings)),
    settings: settingsObject_(readRows_(ss.getSheetByName(APP.sheets.settings))),
    categories: readRows_(ss.getSheetByName(APP.sheets.categories)).sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999)),
    products: readRows_(ss.getSheetByName(APP.sheets.products)),
    posts: readRows_(ss.getSheetByName(APP.sheets.posts)),
    testimonials: readRows_(ss.getSheetByName(APP.sheets.testimonials)),
    subscriptions: readRows_(ss.getSheetByName(APP.sheets.subscriptions)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
  };
}

function subscribe_(e) {
  const callback = e && e.parameter && e.parameter.callback || '';
  const email = String(e && e.parameter && e.parameter.email || '').trim().toLowerCase();
  const source = String(e && e.parameter && e.parameter.source || 'newsletter').trim() || 'newsletter';
  let payload;
  try {
    payload = saveSubscription(email, source);
  } catch (err) {
    payload = {ok: false, message: err.message || String(err)};
  }
  const json = JSON.stringify(payload);
  if (callback) {
    return ContentService.createTextOutput(`${callback}(${json});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function saveSubscription(email, source) {
  ensureSetup_();
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getDb_().getSheetByName(APP.sheets.subscriptions);
    const rows = readRows_(sh);
    const existing = rows.find(r => String(r.email || '').trim().toLowerCase() === email);
    const now = new Date();
    if (existing) return {ok: true, duplicate: true, message: 'E-mail já cadastrado.'};
    sh.appendRow([Utilities.getUuid(), now, email, source, '']);
    return {ok: true, duplicate: false, message: 'Inscrição cadastrada.'};
  } finally {
    lock.releaseLock();
  }
}

function saveSettings(rows) {
  adminGuard_();
  const sh = getDb_().getSheetByName(APP.sheets.settings);
  const header = ['key','label','value','type','help','active'];
  sh.clearContents();
  sh.getRange(1,1,1,header.length).setValues([header]);
  const clean = (rows || [])
    .map(r => [r.key || '', r.label || '', r.value || '', r.type || 'text', r.help || '', r.active === false ? false : true])
    .filter(r => r[0]);
  if (clean.length) sh.getRange(2,1,clean.length,header.length).setValues(clean);
  clearPublicCache_();
  return {ok:true};
}

function saveProduct(item) { adminGuard_(); return upsert_('products', item, productHeader_()); }
function savePost(item) { adminGuard_(); return upsert_('posts', item, postHeader_()); }
function saveTestimonial(item) { adminGuard_(); return upsert_('testimonials', item, testimonialHeader_()); }
function saveCategory(item) { adminGuard_(); return upsert_('categories', item, categoryHeader_()); }
function deleteProduct(id) { adminGuard_(); return setActive_('products', id, false); }
function deletePost(id) { adminGuard_(); return setActive_('posts', id, false, 'published'); }
function deleteTestimonial(id) { adminGuard_(); return setActive_('testimonials', id, false); }

function uploadImage(fileObj) {
  adminGuard_();
  if (!fileObj || !fileObj.data || !fileObj.name) throw new Error('Arquivo inválido.');
  const folder = getImageFolder_();
  const bytes = Utilities.base64Decode(fileObj.data.split(',').pop());
  const mime = fileObj.mimeType || 'image/jpeg';
  const safeName = String(fileObj.name).replace(/[^a-zA-Z0-9._-]/g,'-');
  const blob = Utilities.newBlob(bytes, mime, Date.now() + '-' + safeName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const id = file.getId();
  return {
    ok: true,
    id,
    url: `https://drive.google.com/thumbnail?id=${id}&sz=w1200`,
    viewUrl: file.getUrl()
  };
}

function upsert_(type, item, header) {
  const ss = getDb_();
  const name = APP.sheets[type];
  const sh = ss.getSheetByName(name);
  item = item || {};
  item.id = item.id || slug_(item.name || item.title || Utilities.getUuid());
  const rows = readRows_(sh);
  const idx = rows.findIndex(r => String(r.id) === String(item.id));
  const rowObj = {};
  header.forEach(h => rowObj[h] = item[h] !== undefined ? item[h] : '');
  const values = header.map(h => rowObj[h]);
  if (idx >= 0) sh.getRange(idx + 2, 1, 1, header.length).setValues([values]);
  else sh.appendRow(values);
  clearPublicCache_();
  return {ok:true, id:item.id};
}

function setActive_(type, id, value, field) {
  field = field || 'active';
  const sh = getDb_().getSheetByName(APP.sheets[type]);
  const header = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const idCol = header.indexOf('id') + 1;
  const fieldCol = header.indexOf(field) + 1;
  if (!idCol || !fieldCol) throw new Error('Colunas não encontradas.');
  const ids = sh.getRange(2,idCol,Math.max(sh.getLastRow()-1,0),1).getValues().flat();
  const pos = ids.findIndex(x => String(x) === String(id));
  if (pos >= 0) sh.getRange(pos+2, fieldCol).setValue(value);
  clearPublicCache_();
  return {ok:true};
}

function clearPublicCache_() {
  CacheService.getScriptCache().remove(PUBLIC_CACHE_KEY);
}

function ensureSetup_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SPREADSHEET_ID')) {
    const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    moveFileToRootFolder_(ss.getId());
    ensureSheets_(ss);
    ensureDefaultSettings_(ss);
    getImageFolder_();
    return;
  }
  const ss = SpreadsheetApp.create(APP.spreadsheetName);
  moveFileToRootFolder_(ss.getId());
  props.setProperty('SPREADSHEET_ID', ss.getId());
  ensureSheets_(ss, true);
  ensureDefaultSettings_(ss);
  getImageFolder_();
}

function getDb_() {
  ensureSetup_();
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
}

function getRootFolder_() {
  return DriveApp.getFolderById(APP.rootFolderId);
}

function moveFileToRootFolder_(fileId) {
  const file = DriveApp.getFileById(fileId);
  moveDriveItemToRootFolder_(file);
}

function moveDriveItemToRootFolder_(item) {
  const root = getRootFolder_();
  const parents = item.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === root.getId()) return;
  }
  item.moveTo(root);
}

function getImageFolder_() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty('IMAGE_FOLDER_ID');
  if (existing) {
    const folder = DriveApp.getFolderById(existing);
    moveDriveItemToRootFolder_(folder);
    return folder;
  }
  const root = getRootFolder_();
  const matches = root.getFoldersByName(APP.imageFolderName);
  const folder = matches.hasNext() ? matches.next() : root.createFolder(APP.imageFolderName);
  props.setProperty('IMAGE_FOLDER_ID', folder.getId());
  return folder;
}

function ensureSheets_(ss, seed) {
  setupSheet_(ss, APP.sheets.settings, ['key','label','value','type','help','active'], seedSettings_(), seed);
  setupSheet_(ss, APP.sheets.categories, categoryHeader_(), seedCategories_(), seed);
  setupSheet_(ss, APP.sheets.products, productHeader_(), seedProducts_(), seed);
  setupSheet_(ss, APP.sheets.posts, postHeader_(), seedPosts_(), seed);
  setupSheet_(ss, APP.sheets.testimonials, testimonialHeader_(), seedTestimonials_(), seed);
  setupSheet_(ss, APP.sheets.subscriptions, subscriptionHeader_(), [], seed);
  const defaultSheet = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
}

function setupSheet_(ss, name, header, rows, seed) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 || seed) {
    sh.clear();
    sh.getRange(1,1,1,header.length).setValues([header]);
    if (rows.length) sh.getRange(2,1,rows.length,header.length).setValues(rows);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, header.length);
  } else {
    ensureHeaderColumns_(sh, header);
  }
}

function ensureHeaderColumns_(sh, header) {
  const current = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(String);
  if (header.every((h,i) => current[i] === h)) return;
  const data = sh.getLastRow() > 1 ? sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues() : [];
  const reordered = data.map(row => header.map(h => {
    const idx = current.indexOf(h);
    return idx >= 0 ? row[idx] : '';
  }));
  sh.clearContents();
  sh.getRange(1,1,1,header.length).setValues([header]);
  if (reordered.length) sh.getRange(2,1,reordered.length,header.length).setValues(reordered);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);
}

function ensureDefaultSettings_(ss) {
  const sh = ss.getSheetByName(APP.sheets.settings);
  const rows = readRows_(sh);
  const existing = rows.map(r => String(r.key));
  const defaults = seedSettings_().filter(r => !existing.includes(r[0]));
  if (defaults.length) sh.getRange(sh.getLastRow() + 1, 1, defaults.length, defaults[0].length).setValues(defaults);
}

function defaultAdminEmails_() {
  return '';
}

function currentAdminEmail_() {
  return '';
}

function allowedAdminEmails_() {
  const rows = readRows_(getDb_().getSheetByName(APP.sheets.settings));
  const settings = settingsObject_(rows);
  return String(settings.allowed_admin_emails || '')
    .split(/[,\n; ]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function adminAccess_() {
  return {ok: true, email: ''};
}

function adminGuard_() {
  const access = adminAccess_();
  if (!access.ok) throw new Error(access.message);
  return access;
}

function unauthorizedPage_(auth) {
  const safeTitle = String(auth.title || 'Acesso bloqueado').replace(/[<>&"]/g, '');
  const safeMessage = String(auth.message || 'Você não tem acesso a este painel.').replace(/[<>&"]/g, '');
  return HtmlService.createHtmlOutput(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>body{margin:0;font-family:Arial,sans-serif;background:#f7fae9;color:#1d261d;display:grid;min-height:100vh;place-items:center;padding:24px}.box{max-width:560px;background:#fff;border:1px solid #e8eadf;border-radius:18px;box-shadow:0 18px 48px rgba(20,70,30,.14);padding:28px}h1{margin:0 0 10px;color:#0f7f25;font-size:28px}p{line-height:1.55;color:#687267}</style></head><body><main class="box"><h1>${safeTitle}</h1><p>${safeMessage}</p></main></body></html>`)
    .setTitle(safeTitle);
}

function readRows_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const header = values.shift().map(String);
  return values.filter(r => r.some(c => c !== '')).map(row => {
    const obj = {};
    header.forEach((h,i) => obj[h] = row[i]);
    return obj;
  });
}

function settingsObject_(rows) {
  const obj = {};
  rows.forEach(r => {
    obj[r.key] = r.value;
    obj[r.key + '_active'] = r.active === '' || r.active === undefined ? true : bool_(r.active);
  });
  return obj;
}
function bool_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'sim' || String(v) === '1'; }
function slug_(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function productHeader_(){ return ['id','name','category','description','benefits','image_url','featured','active','order']; }
function categoryHeader_(){ return ['id','name','description','image_url','active','order']; }
function postHeader_(){ return ['id','title','excerpt','body','cover_url','published','order']; }
function testimonialHeader_(){ return ['id','name','text','photo_url','rating','active','order']; }
function subscriptionHeader_(){ return ['id','created_at','email','source','notes']; }

function seedSettings_(){ return [
 ['allowed_admin_emails','E-mails do ADM','','text','Controle interno do painel; não aparece no site público.',true],
 ['whatsapp','WhatsApp principal','5541995876768','whatsapp','Usado nos botões do site. Se desativado, some dos atalhos públicos, mas continua disponível na seleção/cesta para iniciar conversa.',true],
 ['telefone_fixo','Telefone fixo','','text','Opcional',false],
 ['email','E-mail','contato@galeriadaservas.com.br','email','Aparece no rodapé, contato e atalhos do site. Se desativado, some de todas as áreas públicas.',true],
 ['endereco','Endereço','R. Ourizona, 2501 - Sítio Cercado, 81920-620 - Curitiba - PR','text','Usado no rodapé, contato e Maps. Se desativado, some de todo o site.',true],
 ['instagram','Instagram','https://instagram.com/galeriadaservas','url','Link completo do Instagram. Se desativado, some dos atalhos públicos.',true],
 ['facebook','Facebook','','url','Opcional. Se desativado, some dos atalhos públicos.',false],
 ['x_twitter','X / Twitter','','url','Opcional. Se desativado, some dos atalhos públicos.',false],
 ['logo_url','Logo','assets/img/site/logo.png','image','Pode usar imagem do Drive ou arquivo local. Se desativado, oculta a marca no site.',true],
 ['hero_url','Banner da Home','assets/img/site/hero-ervas.png','image','Imagem principal da Home. Se desativado, a home usa o fallback padrão.',true],
 ['footer_text','Texto do rodapé','Mais de 300 opções naturais para sua saúde e bem-estar.','text','Texto institucional curto',true]
 ]; }
function seedCategories_(){ return [
 ['ervas-medicinais','Ervas medicinais','Tratamento natural que equilibra corpo e mente.','assets/img/icones/ervas-medicinais.png',true,1],
 ['chas-naturais','Chás naturais','Bebidas saudáveis com aromas e benefícios terapêuticos.','assets/img/icones/chas-naturais.png',true,2],
 ['alimentos-funcionais','Alimentos funcionais','Nutrição inteligente para sua rotina.','assets/img/icones/alimentos-funcionais.png',true,3],
 ['especiarias-temperos','Especiarias e temperos','Sabor marcante com propriedades naturais.','assets/img/icones/especiarias-temperos.png',true,4]
 ]; }
function seedProducts_(){ return [
 ['camomila','Camomila','chas-naturais','Flor de camomila selecionada para infusões suaves e aromáticas.','Aroma delicado; uso tradicional; ótimo para chás noturnos.','assets/img/produtos/camomila.jpg',true,true,1],
 ['hibisco','Hibisco','chas-naturais','Infusão de cor intensa e sabor levemente ácido.','Versátil quente ou gelado; sabor marcante; ótimo para blends.','assets/img/produtos/hibisco.jpg',true,true,2],
 ['cha-verde','Chá verde','chas-naturais','Clássico natural para uma rotina equilibrada.','Tradicional; refrescante; preparo simples.','assets/img/produtos/cha-verde.jpg',true,true,3],
 ['curcuma','Cúrcuma','especiarias-temperos','Tempero dourado em pó, ideal para receitas naturais.','Cor vibrante; aroma artesanal; combina com pratos salgados.','assets/img/produtos/curcuma.jpg',true,true,4],
 ['gengibre','Gengibre','especiarias-temperos','Raiz aromática para chás, sucos e preparos culinários.','Picância natural; muito versátil; ótimo em infusões.','assets/img/produtos/gengibre.jpg',false,true,5],
 ['canela-em-pau','Canela em pau','especiarias-temperos','Canela aromática para chás, doces, cafés e receitas caseiras.','Aroma acolhedor; sabor marcante; produto tradicional.','assets/img/produtos/canela-em-pau.jpg',false,true,6],
 ['psyllium','Psyllium','alimentos-funcionais','Fibra alimentar para incluir na rotina de forma prática.','Funcional; neutro; fácil de usar em receitas.','assets/img/produtos/psyllium.jpg',false,true,7],
 ['granola-integral','Granola integral','alimentos-funcionais','Mistura crocante para café da manhã, frutas e lanches.','Crocante; sabor natural; rotina saudável.','assets/img/produtos/granola-integral.jpg',false,true,8]
 ]; }
function seedPosts_(){ return [
 ['beneficios-da-moringa','Benefícios da moringa oleífera','Conheça formas simples de incluir a moringa na rotina.','## Por que a moringa chama tanta atenção?\n\nA moringa oleífera é uma planta muito conhecida no universo dos produtos naturais. Suas folhas podem ser usadas em pó, cápsulas, chás e preparos simples do dia a dia.\n\n## Como incluir na rotina\n\n- Em vitaminas com banana, maçã ou abacaxi\n- Misturada em sucos verdes\n- Em receitas caseiras\n\nOBS: Este conteúdo é informativo e não substitui orientação médica.','assets/img/blog/beneficios-da-moringa.jpg',true,1],
 ['chas-para-digestao','Chás que ajudam na digestão','Veja opções naturais para depois das refeições.','## Chás depois das refeições\n\nTomar um chá após as refeições é um hábito simples, acolhedor e muito presente na rotina natural.\n\n- Camomila\n- Hortelã\n- Erva-doce\n\nOBS: Este conteúdo é informativo e não substitui orientação médica.','assets/img/blog/chas-para-digestao.jpg',true,2],
 ['temperos-que-curam','Temperos que curam: o poder das especiarias','Especiarias dão sabor e personalidade às receitas.','## Mais sabor na rotina natural\n\nAs especiarias transformam receitas simples em preparos aromáticos, coloridos e cheios de personalidade.\n\n- Cúrcuma\n- Gengibre\n- Canela\n\nOBS: Este conteúdo é informativo e não substitui orientação médica.','assets/img/blog/temperos-que-curam.jpg',true,3]
 ]; }
function seedTestimonials_(){ return [
 ['rafaela','Rafaela Carmin Pereira','Atendimento maravilhoso e produtos de ótima qualidade.','assets/img/depoimentos/rafaela.jpg',5,true,1],
 ['rosangela','Rosangela Mira','Ótimo atendimento e loja com muita variedade.','assets/img/depoimentos/rosangela.jpg',5,true,2]
]; }

/* ==============================
 * IMPORTAÇÃO EM LOTE DE PRODUTOS
 * ==============================
 * 1. Execute prepararImportacaoProdutos().
 * 2. Cole os nomes na coluna "nome" da aba importacao_produtos.
 * 3. Execute analisarImportacaoProdutos() e confira o relatório.
 * 4. Execute importarProdutosDaAba() para gravar os produtos.
 *
 * A importação é aditiva: não apaga produtos existentes e não substitui
 * registros com o mesmo id. Categorias novas são criadas automaticamente.
 */
function prepararImportacaoProdutos() {
  ensureSetup_();
  const ss = getDb_();
  let sh = ss.getSheetByName('importacao_produtos');
  if (!sh) sh = ss.insertSheet('importacao_produtos');
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 8).setValues([[
      'nome', 'categoria_manual', 'descricao_manual', 'beneficios_manual',
      'image_url', 'featured', 'active', 'order'
    ]]);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, 8);
  }
  return {ok: true, spreadsheetUrl: ss.getUrl(), sheet: 'importacao_produtos'};
}

function verificarPlanilhaConfigurada() {
  const expectedId = '1tsn3BxnT3r2s_uExAQYTpzOKh7c4DtSwOQ-nNHh_VhA';
  const configuredId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!configuredId) throw new Error('SPREADSHEET_ID ainda não foi configurado. Execute prepararImportacaoProdutos() primeiro.');
  const ss = SpreadsheetApp.openById(configuredId);
  const result = {
    ok: true,
    configurada: configuredId,
    esperada: expectedId,
    corresponde: configuredId === expectedId,
    nome: ss.getName(),
    url: ss.getUrl(),
    abas: ss.getSheets().map(sh => sh.getName())
  };
  Logger.log(JSON.stringify(result));
  return result;
}

function analisarImportacaoProdutos() {
  ensureSetup_();
  const ss = getDb_();
  const source = ss.getSheetByName('importacao_produtos');
  if (!source || source.getLastRow() < 2) throw new Error('Cole os nomes na aba importacao_produtos antes de analisar.');
  const rows = readRows_(source);
  const report = buildProductImportReport_(rows);
  writeProductImportReport_(ss, report);
  if (!report.items.length) throw new Error('Nenhum produto reconhecido. Cole os nomes abaixo do cabeçalho nome, name ou produto na aba importacao_produtos.');
  return {ok: true, total: report.items.length, duplicates: report.duplicates.length, review: report.review.length};
}

function importarProdutosDaAba() {
  ensureSetup_();
  const ss = getDb_();
  const source = ss.getSheetByName('importacao_produtos');
  if (!source || source.getLastRow() < 2) throw new Error('Cole os nomes na aba importacao_produtos antes de importar.');
  const report = buildProductImportReport_(readRows_(source));
  if (!report.items.length) throw new Error('Nenhum produto reconhecido. Cole os nomes abaixo do cabeçalho nome, name ou produto na aba importacao_produtos.');
  writeProductImportReport_(ss, report);

  const categorySheet = ss.getSheetByName(APP.sheets.categories);
  const productSheet = ss.getSheetByName(APP.sheets.products);
  const categories = readRows_(categorySheet);
  const categoryIds = {};
  categories.forEach(c => categoryIds[String(c.id)] = true);
  const newCategories = [];
  report.categories.forEach((category, index) => {
    if (categoryIds[category.id]) return;
    newCategories.push([
      category.id, category.name, category.description,
      category.image_url, true, categories.length + newCategories.length + 1
    ]);
    categoryIds[category.id] = true;
  });
  if (newCategories.length) categorySheet.getRange(categorySheet.getLastRow() + 1, 1, newCategories.length, 6).setValues(newCategories);

  const existing = {};
  readRows_(productSheet).forEach(p => existing[String(p.id)] = true);
  const products = [];
  const skipped = [];
  report.items.forEach(item => {
    if (existing[item.id]) {
      skipped.push([item.name, item.id, 'Já existe; não substituído']);
      return;
    }
    products.push([
      item.id, item.name, item.category, item.description, item.benefits,
      item.image_url, item.featured, item.active, item.order
    ]);
    existing[item.id] = true;
  });
  if (products.length) productSheet.getRange(productSheet.getLastRow() + 1, 1, products.length, 9).setValues(products);
  clearPublicCache_();
  if (skipped.length) {
    const sh = ss.getSheetByName('relatorio_importacao');
    sh.getRange(sh.getLastRow() + 2, 1, 1, 3).setValues([['IGNORADOS', 'id', 'motivo']]);
    sh.getRange(sh.getLastRow() + 1, 1, skipped.length, 3).setValues(skipped);
  }
  return {ok: true, imported: products.length, skipped: skipped.length, categoriesCreated: newCategories.length, review: report.review.length};
}

function buildProductImportReport_(rows) {
  const seen = {};
  const items = [], duplicates = [], review = [], categoryMap = {};
  let order = 1;
  rows.forEach(row => {
    const raw = importRowName_(row);
    if (!raw || /^(name|nome|produto)$/i.test(raw)) return;
    const name = normalizeImportedProductName_(raw);
    const id = slug_(name);
    if (!id) return;
    if (seen[id]) {
      duplicates.push([raw, name, id, 'Nome/ID duplicado']);
      return;
    }
    seen[id] = true;
    const category = classifyImportedProduct_(name, row.categoria_manual);
    categoryMap[category.id] = category;
    const item = {
      id,
      name,
      category: category.id,
      description: String(row.descricao_manual || '').trim() || importedDescription_(category.name),
      benefits: String(row.beneficios_manual || '').trim(),
      image_url: String(row.image_url || '').trim(),
      featured: bool_(row.featured),
      active: row.active === '' || row.active === undefined ? true : bool_(row.active),
      order: Number(row.order) || order++
    };
    items.push(item);
    if (isImportedNameForReview_(raw)) review.push([raw, name, category.name, 'Confirmar nome comercial ou correção']);
  });
  return {items, duplicates, review, categories: Object.keys(categoryMap).map(id => categoryMap[id])};
}

function writeProductImportReport_(ss, report) {
  let sh = ss.getSheetByName('relatorio_importacao');
  if (!sh) sh = ss.insertSheet('relatorio_importacao');
  sh.clearContents();
  sh.getRange(1, 1, 1, 4).setValues([['nome_original', 'nome_normalizado', 'categoria', 'observacao']]);
  const rows = report.items.map(item => [item.name, item.name, item.category, 'Pronto para importação']);
  if (report.duplicates.length) report.duplicates.forEach(r => rows.push([r[0], r[1], '', r[3]]));
  if (report.review.length) report.review.forEach(r => rows.push([r[0], r[1], r[2], r[3]]));
  if (!rows.length) rows.push(['', '', '', 'Nenhum produto reconhecido. Verifique a coluna nome/name/produto.']);
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 4);
}

function importRowName_(row) {
  const preferred = ['nome', 'name', 'produto', 'produto_nome', 'nome_produto'];
  for (let i = 0; i < preferred.length; i++) {
    const value = String(row[preferred[i]] || '').trim();
    if (value) return value;
  }
  const keys = Object.keys(row);
  for (let i = 0; i < keys.length; i++) {
    const value = String(row[keys[i]] || '').trim();
    if (value) return value;
  }
  return '';
}

function normalizeImportedProductName_(value) {
  let s = String(value || '').replace(/\s+/g, ' ').trim();
  const fixes = {
    'ACAFRAO': 'AÇAFRÃO', 'ACAI': 'AÇAÍ', 'ACUCAR': 'AÇÚCAR', 'ADOCANTE': 'ADOÇANTE',
    'AGUA': 'ÁGUA', 'ALCACUZ': 'ALCAÇUZ', 'ALFAZEMAAZUL': 'ALFAZEMA AZUL',
    'AMEMDOIM': 'AMENDOIM', 'AMENDIM': 'AMENDOIM', 'ANIZ': 'ANIS', 'ARTEMISEA': 'ARTEMÍSIA',
    'ASSAPEIXE': 'ASSA-PEIXE', 'AVEIA FLOCOS MEDIO': 'AVEIA EM FLOCOS MÉDIOS',
    'AZEITE OLVI': 'AZEITE OLIVA', 'B12 METHIL': 'B12 METIL', 'BARBATIMAO': 'BARBATIMÃO',
    'BATATA RUFLLES': 'BATATA RUFFLES', 'BERINGELA': 'BERINJELA', 'CACAU': 'CACAU',
    'CALCIO': 'CÁLCIO', 'CANELA DE VELHO': 'CANELA-DE-VELHO', 'CAPIM LIMAO': 'CAPIM-LIMÃO',
    'CARQUEJAAMARGA': 'CARQUEJA AMARGA', 'CHA': 'CHÁ', 'CHAPÉU': 'CHAPÉU',
    'CHAPEU': 'CHAPÉU', 'COENTRO': 'COENTRO', 'CURCUMA': 'CÚRCUMA', 'DENTE DE LEAO': 'DENTE-DE-LEÃO',
    'DESCACADOR': 'DESCASCADOR', 'ERVA DOCE': 'ERVA-DOCE', 'ESPINHEIRA SANTA': 'ESPINHEIRA-SANTA',
    'FARINAH': 'FARINHA', 'FUBAAMARELO': 'FUBÁ AMARELO', 'GENGIBRE E PO': 'GENGIBRE EM PÓ',
    'HORTELA FOHAS': 'HORTELÃ FOLHAS', 'IPE ROXO PO': 'IPÊ-ROXO EM PÓ', 'JAMBOLAO': 'JAMBOLÃO',
    'LINFACHA': 'LINHAÇA', 'MARCELA': 'MARCELA', 'MANJERICAO': 'MANJERICÃO', 'MELAO DE SAO CAETANO': 'MELÃO-DE-SÃO-CAETANO',
    'OREGANO': 'ORÉGANO', 'PAPrica': 'PÁPRICA', 'PIMENTAO': 'PIMENTÃO', 'PROPOLIS': 'PRÓPOLIS',
    'TOMILHO': 'TOMILHO', 'UCUMA': 'CÚRCUMA', 'URUCUM': 'URUCUM', 'UUVA': 'UVA', 'UVA PASSA': 'UVA-PASSA',
    'VINAGRE DE MACA': 'VINAGRE DE MAÇÃ', 'VITAMINA C 1 000 mg': 'VITAMINA C 1.000 MG'
  };
  Object.keys(fixes).forEach(key => { s = s.replace(new RegExp('\\b' + key + '\\b', 'gi'), fixes[key]); });
  s = s.replace(/\bC\//gi, 'COM ').replace(/\bS\//gi, 'SEM ')
    .replace(/\bPCTE\b/gi, 'PACOTE').replace(/\bCAPS\b/gi, 'CÁPSULAS')
    .replace(/\bCPS\b/gi, 'CÁPSULAS').replace(/\bCHA\b/gi, 'CHÁ')
    .replace(/\s{2,}/g, ' ').trim();
  return s.split(' ').map((word, i) => {
    if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9%+.\-/]+$/i.test(word) && word.length > 3) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    return word;
  }).join(' ').replace(/\b(De|Da|Do|Das|Dos|Em|E|Com|Sem|Para)\b/g, m => m.toLowerCase())
    .replace(/^./, m => m.toUpperCase());
}

function classifyImportedProduct_(name, manual) {
  if (manual) return importedCategory_(manual);
  const n = slug_(name);
  const rules = [
    ['suplementos-encapsulados', 'Suplementos e encapsulados', /capsula|encapsulado|vitamina|magnesio|colageno|creatina|albumina|biotina|ginseng|cromo|calcio|zinco|omega|probio|glutamina|melatonina|coenzima|espirulina|cloreto-de-magnesio/],
    ['chas-naturais', 'Chás naturais', /cha|erva|folha|folhas|casca|flor|valeriana|camomila|hibisco|mate|funcho|boldo|carqueja|cavalinha/],
    ['ervas-medicinais', 'Ervas medicinais', /extrato|tintura|gotas|xarope|elixir|arnica|babosa|eucalipto|propolis|guaco|jure|moringa|ginkgo|ginko|garcinia/],
    ['especiarias-temperos', 'Especiarias e temperos', /pimenta|canela|curcuma|acafrao|urucum|colorau|cominho|oregano|tomilho|alecrim|manjer|curry|tempero|alho|cebola|paprica|chimichurri|cravo|noz-moscada/],
    ['graos-farinhas-sementes', 'Grãos, farinhas e sementes', /farinha|farelo|grao|feijao|arroz|aveia|chia|linhaca|quinoa|amaranto|trigo|lentilha|fuba|polvilho|fecula|gergelim|semente/],
    ['castanhas-frutas-secas', 'Castanhas e frutas secas', /castanha|amendoim|amendoa|nozes|uva-passa|banana-passa|damasco|ameixa|figo|goji|coco|fruta desidratada/],
    ['bebidas', 'Bebidas', /agua|suco|refrigerante|cerveja|cafe|vinagre|leite|cha gelado/],
    ['doces-snacks', 'Doces, biscoitos e snacks', /bala|biscoito|bolacha|chocolate|doce|geleia|goiabada|paçoca|pacoca|bombom|granola|cookie|marshmallow|pipoca/],
    ['cuidados-pessoais', 'Cosméticos e cuidados pessoais', /sabonete|shampoo|creme|gel |oleo de|argila|sebo|cosmetico|hidratante|pomada/],
    ['acessorios-utensilios', 'Acessórios e utensílios', /espremedor|descascador|fatiador|moedor|canudo|copo|chaveiro|kit |acende fogao|bomba/]
  ];
  for (let i = 0; i < rules.length; i++) if (rules[i][2].test(n)) return importedCategory_(rules[i][0], rules[i][1]);
  return importedCategory_('outros-produtos', 'Outros produtos naturais');
}

function importedCategory_(idOrName, explicitName) {
  const names = {
    'ervas-medicinais': ['Ervas medicinais', 'Tratamento natural que equilibra corpo e mente.', 'assets/img/icones/ervas-medicinais.png'],
    'chas-naturais': ['Chás naturais', 'Bebidas saudáveis com aromas e benefícios tradicionais.', 'assets/img/icones/chas-naturais.png'],
    'alimentos-funcionais': ['Alimentos funcionais', 'Nutrição inteligente para sua rotina.', 'assets/img/icones/alimentos-funcionais.png'],
    'especiarias-temperos': ['Especiarias e temperos', 'Sabor marcante para receitas e preparos naturais.', 'assets/img/icones/especiarias-temperos.png']
  };
  const id = slug_(idOrName);
  const data = names[id] || [explicitName || idOrName, 'Produtos selecionados da Galeria das Ervas.', 'assets/img/icones/ervas-medicinais.png'];
  return {id, name: data[0], description: data[1], image_url: data[2]};
}

function importedDescription_(category) { return 'Produto selecionado da Galeria das Ervas. Consulte disponibilidade, apresentação e formas de uso.'; }
function isImportedNameForReview_(name) { return /\bteste\b|thermoro|trique|tsubassa|adicional|gotas$|encapsulados$|diversos$/.test(String(name).toLowerCase()); }

/* ==============================
 * ENRIQUECIMENTO AUTOMÁTICO DE PRODUTOS
 * ==============================
 * Pesquisa cada produto com Google Search via Gemini e preenche somente
 * descrição/benefícios vazios ou genéricos. O processo é retomável:
 * execute enriquecerProdutosAutomaticamente() novamente para continuar.
 *
 * Configuração única:
 * 1. Crie uma chave no Google AI Studio.
 * 2. Execute salvarChaveGemini('SUA_CHAVE') uma vez.
 * 3. Execute enriquecerProdutosAutomaticamente() quantas vezes precisar.
 *
 * A chave fica nas Script Properties e não é gravada na planilha.
 */
const PRODUCT_ENRICHMENT_ = {
  model: 'gemini-2.5-flash',
  batchSize: 8,
  cursorKey: 'PRODUCT_ENRICHMENT_CURSOR',
  apiKey: 'GEMINI_API_KEY',
  reportSheet: 'relatorio_enriquecimento'
};

function salvarChaveGemini(apiKey) {
  apiKey = String(apiKey || '').trim();
  if (!apiKey || apiKey.length < 20) throw new Error('Informe uma chave Gemini válida.');
  PropertiesService.getScriptProperties().setProperty(PRODUCT_ENRICHMENT_.apiKey, apiKey);
  return {ok: true, message: 'Chave Gemini salva nas propriedades do projeto.'};
}

function prepararEnriquecimentoProdutos() {
  ensureSetup_();
  const ss = getDb_();
  const sh = getOrCreateEnrichmentReport_(ss);
  const products = readRows_(ss.getSheetByName(APP.sheets.products));
  const pending = products.filter(productNeedsEnrichment_).length;
  return {
    ok: true,
    total: products.length,
    pendentes: pending,
    lote: PRODUCT_ENRICHMENT_.batchSize,
    relatorio: sh.getName(),
    cursor: Number(PropertiesService.getScriptProperties().getProperty(PRODUCT_ENRICHMENT_.cursorKey) || 0)
  };
}

function statusEnriquecimentoProdutos() {
  ensureSetup_();
  const products = readRows_(getDb_().getSheetByName(APP.sheets.products));
  const cursor = Number(PropertiesService.getScriptProperties().getProperty(PRODUCT_ENRICHMENT_.cursorKey) || 0);
  const report = getDb_().getSheetByName(PRODUCT_ENRICHMENT_.reportSheet);
  return {
    ok: true,
    total: products.length,
    cursor,
    restantes: products.slice(cursor).filter(productNeedsEnrichment_).length,
    relatorio: report ? report.getUrl() : ''
  };
}

function resetarEnriquecimentoProdutos() {
  PropertiesService.getScriptProperties().deleteProperty(PRODUCT_ENRICHMENT_.cursorKey);
  return {ok: true, message: 'Progresso zerado. A próxima execução começará do primeiro produto.'};
}

function enriquecerProdutosAutomaticamente() {
  ensureSetup_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty(PRODUCT_ENRICHMENT_.apiKey);
    if (!apiKey) throw new Error('Chave ausente. Execute salvarChaveGemini("SUA_CHAVE") primeiro.');

    const ss = getDb_();
    const sh = ss.getSheetByName(APP.sheets.products);
    const reportSh = getOrCreateEnrichmentReport_(ss);
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const rows = readRows_(sh);
    let cursor = Number(PropertiesService.getScriptProperties().getProperty(PRODUCT_ENRICHMENT_.cursorKey) || 0);
    const result = {ok: true, processados: 0, atualizados: 0, ignorados: 0, erros: 0, restantes: 0};

    for (let i = cursor; i < rows.length && result.processados < PRODUCT_ENRICHMENT_.batchSize; i++) {
      const product = rows[i];
      cursor = i + 1;
      if (!productNeedsEnrichment_(product)) {
        result.ignorados++;
        appendEnrichmentReport_(reportSh, product, 'ignorado', '', 'Descrição e benefícios já parecem preenchidos.');
        continue;
      }
      result.processados++;
      try {
        const enrichment = researchProductWithGemini_(product, apiKey);
        const descriptionCol = headers.indexOf('description') + 1;
        const benefitsCol = headers.indexOf('benefits') + 1;
        if (!descriptionCol || !benefitsCol) throw new Error('Colunas description/benefits não encontradas.');
        if (productNeedsDescription_(product)) sh.getRange(i + 2, descriptionCol).setValue(enrichment.description);
        if (productNeedsBenefits_(product)) sh.getRange(i + 2, benefitsCol).setValue(enrichment.benefits);
        appendEnrichmentReport_(reportSh, product, 'atualizado', enrichment.sources.join('\n'), enrichment.confidence || 'não informado');
        result.atualizados++;
      } catch (err) {
        appendEnrichmentReport_(reportSh, product, 'erro', '', err.message || String(err));
        result.erros++;
      }
    }

    PropertiesService.getScriptProperties().setProperty(PRODUCT_ENRICHMENT_.cursorKey, String(cursor));
    result.restantes = rows.slice(cursor).filter(productNeedsEnrichment_).length;
    clearPublicCache_();
    return result;
  } finally {
    lock.releaseLock();
  }
}

function productNeedsEnrichment_(product) {
  return productNeedsDescription_(product) || productNeedsBenefits_(product);
}

function productNeedsDescription_(product) {
  const value = String(product && product.description || '').trim().toLowerCase();
  return !value || value.indexOf('produto selecionado da galeria das ervas') >= 0 ||
    value.indexOf('consulte disponibilidade') >= 0 || value === 'produto natural.';
}

function productNeedsBenefits_(product) {
  const value = String(product && product.benefits || '').trim().toLowerCase();
  return !value || value.indexOf('consulte disponibilidade') >= 0 || value === 'benefícios a confirmar.';
}

function researchProductWithGemini_(product, apiKey) {
  const name = String(product.name || '').trim();
  const category = String(product.category || '').trim();
  const prompt = [
    'Pesquise na web antes de responder e use fontes confiáveis, preferencialmente órgãos públicos, universidades, sociedades científicas e fabricantes oficiais.',
    'Produto: ' + name,
    'Categoria cadastrada: ' + category,
    '',
    'Crie conteúdo em português do Brasil para uma loja de produtos naturais.',
    'Descrição: 2 ou 3 frases objetivas sobre o que é o produto, sua forma/apresentação e usos culinários ou tradicionais quando confirmados.',
    'Benefícios: 3 a 5 itens curtos separados por ponto e vírgula, somente benefícios nutricionais, características ou usos tradicionais sustentados pelas fontes.',
    'Não invente composição, dose, origem ou indicação. Não diga que cura, trata, previne doenças, emagrece, substitui remédio ou garante resultado. Se a evidência for limitada, escreva isso com clareza.',
    'Retorne apenas JSON válido no formato solicitado. Inclua as URLs das fontes consultadas.'
  ].join('\n');

  const schema = {
    type: 'OBJECT',
    properties: {
      description: {type: 'STRING'},
      benefits: {type: 'STRING'},
      confidence: {type: 'STRING'},
      sources: {type: 'ARRAY', items: {type: 'STRING'}}
    },
    required: ['description', 'benefits', 'confidence', 'sources']
  };
  const payload = {
    contents: [{role: 'user', parts: [{text: prompt}]}],
    tools: [{google_search: {}}],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: schema
    }
  };
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + PRODUCT_ENRICHMENT_.model + ':generateContent?key=' + encodeURIComponent(apiKey);
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code < 200 || code >= 300) throw new Error('Gemini HTTP ' + code + ': ' + body.slice(0, 500));
  const data = JSON.parse(body);
  const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts
    .map(function(part) { return part.text || ''; }).join('');
  const result = parseGeminiJson_(text);
  const grounding = data.candidates[0].groundingMetadata || {};
  const groundedSources = (grounding.groundingChunks || []).map(function(chunk) {
    return chunk.web && chunk.web.uri ? chunk.web.uri : '';
  }).filter(Boolean);
  result.sources = uniqueStrings_(result.sources.concat(groundedSources));
  validateEnrichment_(result, name);
  return result;
}

function parseGeminiJson_(text) {
  let clean = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) clean = clean.slice(start, end + 1);
  const result = JSON.parse(clean);
  result.description = String(result.description || '').trim();
  result.benefits = String(result.benefits || '').trim();
  result.confidence = String(result.confidence || '').trim();
  result.sources = Array.isArray(result.sources) ? result.sources.map(String).filter(Boolean) : [];
  return result;
}

function validateEnrichment_(result, productName) {
  if (result.description.length < 80) throw new Error('Descrição curta demais para ' + productName + '.');
  if (result.benefits.length < 30) throw new Error('Benefícios insuficientes para ' + productName + '.');
  if (!result.sources.length) throw new Error('Nenhuma fonte retornada para ' + productName + '.');
  if (/cura|curar|trata|tratamento|previne|prevenir|emagrece|emagrec|substitui remédio|garante resultado/i.test(result.description + ' ' + result.benefits)) {
    throw new Error('Texto rejeitado por conter promessa médica ou resultado garantido.');
  }
}

function uniqueStrings_(values) {
  const seen = {};
  return values.filter(function(value) {
    value = String(value || '').trim();
    if (!value || seen[value]) return false;
    seen[value] = true;
    return true;
  });
}

function getOrCreateEnrichmentReport_(ss) {
  let sh = ss.getSheetByName(PRODUCT_ENRICHMENT_.reportSheet);
  if (!sh) sh = ss.insertSheet(PRODUCT_ENRICHMENT_.reportSheet);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 6).setValues([['data', 'id', 'produto', 'status', 'fontes', 'observacao']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function appendEnrichmentReport_(sh, product, status, sources, note) {
  sh.appendRow([new Date(), product.id || '', product.name || '', status, sources || '', note || '']);
}
