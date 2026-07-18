const PANEL_URL = '/painel/';
const INSTALL_URL = 'https://www.galeriadaservas.com.br/instalar/';
const INSTALL_HINT_KEY = 'gde_panel_install_hint_v1';
const INSTALL_HINT_MAX_AGE = 1000 * 60 * 60 * 24 * 180;

const STRINGS = {
  checking: 'Verificando seu aparelho…',
  android: 'Android · instalação pelo Chrome',
  ios: 'iPhone ou iPad · instalação pela Tela de Início',
  desktop: 'Computador · acesso pelo navegador',
  inApp: 'Navegador interno detectado',
  installed: 'Aplicativo já instalado',
  ready: 'Pronto para instalar',
  accepted: 'Aplicativo instalado. Abrindo o painel…',
  dismissed: 'Instalação cancelada. Você pode tentar novamente pelo menu do navegador.',
  copied: 'Endereço copiado. Cole no Chrome ou Safari.',
  copyFailed: 'Não foi possível copiar. Acesse galeriadaservas.com.br/instalar/ no navegador.'
};

const elements = {
  title: document.querySelector('#installerTitle'),
  lead: document.querySelector('#installerLead'),
  platformLabel: document.querySelector('#platformLabel'),
  stateMessage: document.querySelector('#stateMessage'),
  installButton: document.querySelector('#installButton'),
  iosGuideButton: document.querySelector('#iosGuideButton'),
  openPanelButton: document.querySelector('#openPanelButton'),
  waitingState: document.querySelector('#waitingState'),
  manualHelpButton: document.querySelector('#manualHelpButton'),
  manualInstallHelp: document.querySelector('#manualInstallHelp'),
  inAppState: document.querySelector('#inAppState'),
  inAppInstructions: document.querySelector('#inAppInstructions'),
  openExternalButton: document.querySelector('#openExternalButton'),
  copyAddressButton: document.querySelector('#copyAddressButton'),
  continueBrowserLink: document.querySelector('#continueBrowserLink'),
  tutorial: document.querySelector('#iosTutorial'),
  dialog: document.querySelector('.tutorial-dialog'),
  closeTutorialButton: document.querySelector('#closeTutorialButton'),
  cancelTutorialButton: document.querySelector('#cancelTutorialButton'),
  alreadyAddedButton: document.querySelector('#alreadyAddedButton'),
  sharePointer: document.querySelector('#sharePointer'),
  sharePositionText: document.querySelector('#sharePositionText'),
  toast: document.querySelector('#toast')
};

let deferredPrompt = null;
let platform = null;
let installed = false;
let previousFocus = null;
let toastTimer = 0;
let fallbackTimer = 0;

function detectPlatform() {
  const ua = navigator.userAgent || '';
  const uaDataBrands = navigator.userAgentData?.brands?.map(item => item.brand).join(' ') || '';
  const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIPhone = /iPhone|iPod/i.test(ua);
  const isIOS = isIPad || isIPhone;
  const isAndroid = /Android/i.test(ua);
  const isSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  const isChromium = isAndroid && (/Chrome|Chromium|EdgA|OPR|SamsungBrowser/i.test(ua) || /Chrom/i.test(uaDataBrands));
  const isInApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Twitter|Snapchat|Pinterest/i.test(ua)
    || (isAndroid && /;\s*wv\)/i.test(ua))
    || /WebView/i.test(ua);
  const iosMatch = ua.match(/OS (\d+)[._]/i) || ua.match(/Version\/(\d+)/i);

  return {
    ua,
    isIPad,
    isIPhone,
    isIOS,
    isAndroid,
    isSafari,
    isChromium,
    isInApp,
    iosMajor: Number(iosMatch?.[1] || 0),
    isDesktop: !isIOS && !isAndroid
  };
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || navigator.standalone === true
    || document.referrer.startsWith('android-app://');
}

function readInstallHint() {
  try {
    const savedAt = Number(localStorage.getItem(INSTALL_HINT_KEY) || 0);
    return savedAt > 0 && Date.now() - savedAt < INSTALL_HINT_MAX_AGE;
  } catch (error) {
    return false;
  }
}

function saveInstallHint() {
  try {
    localStorage.setItem(INSTALL_HINT_KEY, String(Date.now()));
  } catch (error) {}
}

function clearInstallHint() {
  try {
    localStorage.removeItem(INSTALL_HINT_KEY);
  } catch (error) {}
}

async function hasInstalledRelatedApp() {
  if (typeof navigator.getInstalledRelatedApps !== 'function') return false;
  try {
    const apps = await navigator.getInstalledRelatedApps();
    return apps.some(app => {
      const id = String(app.id || '');
      const url = String(app.url || '');
      return app.platform === 'webapp' && (id.includes('/painel/') || url.includes('/painel/manifest.webmanifest'));
    });
  } catch (error) {
    return false;
  }
}

async function detectInstalledState() {
  if (isStandalone()) return true;
  if (await hasInstalledRelatedApp()) return true;
  return readInstallHint();
}

function hideActionStates() {
  elements.installButton.hidden = true;
  elements.iosGuideButton.hidden = true;
  elements.openPanelButton.hidden = true;
  elements.waitingState.hidden = true;
  elements.manualHelpButton.hidden = true;
  elements.manualInstallHelp.hidden = true;
  elements.inAppState.hidden = true;
}

function setMessage(message) {
  elements.stateMessage.textContent = message;
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  requestAnimationFrame(() => elements.toast.classList.add('visible'));
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove('visible');
    window.setTimeout(() => { elements.toast.hidden = true; }, 240);
  }, 3200);
}

function renderInstalled() {
  installed = true;
  clearTimeout(fallbackTimer);
  hideActionStates();
  elements.platformLabel.textContent = STRINGS.installed;
  elements.title.textContent = 'O painel já está pronto.';
  elements.lead.textContent = 'Abra pelo ícone da tela inicial ou continue diretamente para o painel.';
  setMessage('A instalação foi identificada neste aparelho.');
  elements.openPanelButton.hidden = false;
  elements.continueBrowserLink.hidden = true;
}

function renderInstallReady() {
  if (platform?.isInApp || platform?.isIOS || installed) return;
  clearTimeout(fallbackTimer);
  clearInstallHint();
  hideActionStates();
  elements.platformLabel.textContent = STRINGS.ready;
  setMessage('O navegador confirmou que o aplicativo pode ser instalado.');
  elements.installButton.hidden = false;
}

function buildChromeIntent() {
  const path = `${location.host}/instalar/`;
  const fallback = encodeURIComponent(INSTALL_URL);
  return `intent://${path}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

function renderInAppBrowser() {
  hideActionStates();
  elements.platformLabel.textContent = STRINGS.inApp;
  setMessage('Este aplicativo abriu uma janela interna que não consegue instalar o painel.');
  elements.inAppState.hidden = false;

  if (platform.isAndroid) {
    elements.inAppInstructions.textContent = 'Toque em Abrir no Chrome. Se não funcionar, copie o endereço e cole no Chrome.';
    elements.openExternalButton.href = buildChromeIntent();
    elements.openExternalButton.hidden = false;
  } else if (platform.isIOS) {
    elements.inAppInstructions.textContent = 'No menu do WhatsApp, Instagram ou Facebook, escolha Abrir no Safari. Você também pode copiar o endereço.';
    elements.openExternalButton.hidden = true;
  } else {
    elements.inAppInstructions.textContent = 'Copie o endereço e abra no Chrome, Safari ou Edge.';
    elements.openExternalButton.hidden = true;
  }
}

function renderIOS() {
  hideActionStates();
  elements.platformLabel.textContent = STRINGS.ios;
  setMessage('No iPhone e iPad, a confirmação é feita pelo menu Compartilhar.');
  elements.iosGuideButton.hidden = false;
}

function renderAndroidWaiting() {
  hideActionStates();
  elements.platformLabel.textContent = platform.isChromium ? STRINGS.android : 'Android · navegador sem instalação automática';
  elements.waitingState.hidden = false;
  setMessage(platform.isChromium
    ? 'O Chrome está validando o aparelho. O botão aparece assim que a instalação for liberada.'
    : 'Este navegador pode exigir a instalação pelo próprio menu.');

  fallbackTimer = window.setTimeout(() => {
    if (deferredPrompt || installed) return;
    elements.waitingState.hidden = true;
    elements.manualHelpButton.hidden = false;
    setMessage('Se a instalação automática não aparecer, use o menu do navegador.');
  }, 6000);
}

function renderDesktop() {
  hideActionStates();
  elements.platformLabel.textContent = STRINGS.desktop;
  setMessage('Este instalador foi otimizado para celular. Você também pode usar o painel neste navegador.');
  elements.openPanelButton.hidden = false;
}

async function installApp() {
  if (!deferredPrompt) {
    renderAndroidWaiting();
    return;
  }

  elements.installButton.disabled = true;
  elements.installButton.classList.add('working');
  setMessage('Aguardando sua confirmação no navegador…');

  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;

    if (choice.outcome === 'accepted') {
      saveInstallHint();
      showToast(STRINGS.accepted);
      renderInstalled();
      window.setTimeout(() => location.assign(PANEL_URL), 1500);
      return;
    }

    showToast(STRINGS.dismissed);
    renderAndroidWaiting();
  } catch (error) {
    deferredPrompt = null;
    renderAndroidWaiting();
    showToast('O navegador não abriu a instalação. Use o menu para continuar.');
  } finally {
    elements.installButton.disabled = false;
    elements.installButton.classList.remove('working');
  }
}

async function copyInstallAddress() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(INSTALL_URL);
    } else {
      const helper = document.createElement('textarea');
      helper.value = INSTALL_URL;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      const copied = document.execCommand('copy');
      helper.remove();
      if (!copied) throw new Error('copy failed');
    }
    showToast(STRINGS.copied);
    elements.copyAddressButton.textContent = 'Endereço copiado';
    window.setTimeout(() => { elements.copyAddressButton.textContent = 'Copiar endereço'; }, 2200);
  } catch (error) {
    showToast(STRINGS.copyFailed);
  }
}

function getIOSPointerPosition() {
  const landscape = window.innerWidth > window.innerHeight;
  const otherIOSBrowser = platform.isIOS && !platform.isSafari;
  return platform.isIPad || landscape || otherIOSBrowser || platform.iosMajor >= 26 ? 'top' : 'bottom';
}

function updateIOSPointer() {
  if (!platform?.isIOS) return;
  const position = getIOSPointerPosition();
  elements.tutorial.dataset.sharePosition = position;
  elements.sharePositionText.textContent = position === 'top'
    ? 'Procure o símbolo de compartilhar no alto da tela.'
    : 'Procure o símbolo de compartilhar na barra inferior.';
}

function focusableInDialog() {
  return [...elements.dialog.querySelectorAll('button:not([disabled]),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .filter(item => !item.hidden && item.offsetParent !== null);
}

function openIOSTutorial() {
  previousFocus = document.activeElement;
  updateIOSPointer();
  elements.tutorial.hidden = false;
  document.body.classList.add('tutorial-open');
  requestAnimationFrame(() => elements.tutorial.classList.add('visible'));
  window.setTimeout(() => elements.closeTutorialButton.focus(), 80);
}

function closeIOSTutorial() {
  elements.tutorial.classList.remove('visible');
  document.body.classList.remove('tutorial-open');
  window.setTimeout(() => {
    elements.tutorial.hidden = true;
    previousFocus?.focus?.();
  }, 240);
}

function trapTutorialFocus(event) {
  if (elements.tutorial.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeIOSTutorial();
    return;
  }
  if (event.key !== 'Tab') return;

  const focusable = focusableInDialog();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function confirmIOSInstall() {
  saveInstallHint();
  closeIOSTutorial();
  showToast('Perfeito. O painel está pronto para abrir.');
  renderInstalled();
}

function toggleManualHelp() {
  const expanded = elements.manualHelpButton.getAttribute('aria-expanded') === 'true';
  elements.manualHelpButton.setAttribute('aria-expanded', String(!expanded));
  elements.manualHelpButton.textContent = expanded ? 'Ver instalação pelo menu' : 'Ocultar instruções';
  elements.manualInstallHelp.hidden = expanded;
}

async function registerPanelServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/painel/sw.js', {scope: '/painel/', updateViaCache: 'none'});
  } catch (error) {}
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  if (platform) renderInstallReady();
});

window.addEventListener('appinstalled', () => {
  saveInstallHint();
  showToast(STRINGS.accepted);
  renderInstalled();
});

elements.installButton.addEventListener('click', installApp);
elements.iosGuideButton.addEventListener('click', openIOSTutorial);
elements.closeTutorialButton.addEventListener('click', closeIOSTutorial);
elements.cancelTutorialButton.addEventListener('click', closeIOSTutorial);
elements.alreadyAddedButton.addEventListener('click', confirmIOSInstall);
elements.copyAddressButton.addEventListener('click', copyInstallAddress);
elements.manualHelpButton.addEventListener('click', toggleManualHelp);
elements.tutorial.addEventListener('click', event => {
  if (event.target === elements.tutorial) closeIOSTutorial();
});
document.addEventListener('keydown', trapTutorialFocus);
window.addEventListener('orientationchange', () => window.setTimeout(updateIOSPointer, 120));
window.addEventListener('resize', updateIOSPointer, {passive: true});

async function init() {
  platform = detectPlatform();
  registerPanelServiceWorker();
  installed = await detectInstalledState();

  if (installed) {
    renderInstalled();
    return;
  }
  if (platform.isInApp) {
    renderInAppBrowser();
    return;
  }
  if (platform.isIOS) {
    renderIOS();
    return;
  }
  if (deferredPrompt) {
    renderInstallReady();
    return;
  }
  if (platform.isAndroid) {
    renderAndroidWaiting();
    return;
  }
  renderDesktop();
}

init();
