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
    testimonials: 'depoimentos'
  }
};

function doGet(e) {
  ensureSetup_();
  const action = e && e.parameter && e.parameter.action;
  if (action === 'publicData') return publicData_(e);
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
  const ss = getDb_();
  const settings = settingsObject_(readRows_(ss.getSheetByName(APP.sheets.settings)));
  return {
    ok: true,
    settings,
    categories: readRows_(ss.getSheetByName(APP.sheets.categories)).filter(r => bool_(r.active)).sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999)),
    products: readRows_(ss.getSheetByName(APP.sheets.products)).filter(r => bool_(r.active)).sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999)),
    posts: readRows_(ss.getSheetByName(APP.sheets.posts)).filter(r => bool_(r.published)),
    testimonials: readRows_(ss.getSheetByName(APP.sheets.testimonials)).filter(r => bool_(r.active))
  };
}

function getAdminData() {
  const ss = getDb_();
  return {
    ok: true,
    spreadsheetUrl: ss.getUrl(),
    folderUrl: getImageFolder_().getUrl(),
    settingsRows: readRows_(ss.getSheetByName(APP.sheets.settings)),
    settings: settingsObject_(readRows_(ss.getSheetByName(APP.sheets.settings))),
    categories: readRows_(ss.getSheetByName(APP.sheets.categories)).sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999)),
    products: readRows_(ss.getSheetByName(APP.sheets.products)),
    posts: readRows_(ss.getSheetByName(APP.sheets.posts)),
    testimonials: readRows_(ss.getSheetByName(APP.sheets.testimonials))
  };
}

function saveSettings(rows) {
  const sh = getDb_().getSheetByName(APP.sheets.settings);
  const header = ['key','label','value','type','help','active'];
  sh.clearContents();
  sh.getRange(1,1,1,header.length).setValues([header]);
  const clean = (rows || [])
    .map(r => [r.key || '', r.label || '', r.value || '', r.type || 'text', r.help || '', r.active === false ? false : true])
    .filter(r => r[0]);
  if (clean.length) sh.getRange(2,1,clean.length,header.length).setValues(clean);
  return {ok:true};
}

function saveProduct(item) { return upsert_('products', item, productHeader_()); }
function savePost(item) { return upsert_('posts', item, postHeader_()); }
function saveTestimonial(item) { return upsert_('testimonials', item, testimonialHeader_()); }
function saveCategory(item) { return upsert_('categories', item, categoryHeader_()); }
function deleteProduct(id) { return setActive_('products', id, false); }
function deletePost(id) { return setActive_('posts', id, false, 'published'); }
function deleteTestimonial(id) { return setActive_('testimonials', id, false); }

function uploadImage(fileObj) {
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
  return {ok:true};
}

function ensureSetup_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SPREADSHEET_ID')) {
    const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    moveFileToRootFolder_(ss.getId());
    ensureSheets_(ss);
    getImageFolder_();
    return;
  }
  const ss = SpreadsheetApp.create(APP.spreadsheetName);
  moveFileToRootFolder_(ss.getId());
  props.setProperty('SPREADSHEET_ID', ss.getId());
  ensureSheets_(ss, true);
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

function seedSettings_(){ return [
 ['whatsapp','WhatsApp principal','5541995876768','whatsapp','Usado nos botões do site',true],
 ['telefone_fixo','Telefone fixo','','text','Opcional',false],
 ['email','E-mail','contato@galeriadaservas.com.br','email','Aparece no rodapé e contato',true],
 ['endereco','Endereço','R. Ourizona, 2501 - Sítio Cercado, 81920-620 - Curitiba - PR','text','Usado no rodapé, contato e Maps',true],
 ['instagram','Instagram','https://instagram.com/galeriadaservas','url','Link completo do Instagram',true],
 ['facebook','Facebook','','url','Opcional',false],
 ['x_twitter','X / Twitter','','url','Opcional',false],
 ['logo_url','Logo','assets/img/site/logo.png','image','Pode usar imagem do Drive ou arquivo local',true],
 ['hero_url','Banner da Home','assets/img/site/hero-ervas.png','image','Imagem principal da Home',true],
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
