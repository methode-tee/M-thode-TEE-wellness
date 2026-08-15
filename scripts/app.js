
/* V105 — Safari web viewport fix
   Safari iPhone recalcule parfois mal 100dvh quand on quitte/revient dans l'onglet.
   On expose la hauteur visible réelle en CSS pour garder la navbar collée au contenu. */
(function mtInstallSafariViewportFix(){
  function setAppHeight(){
    try{
      var vv = window.visualViewport;
      var h = vv && vv.height ? vv.height : window.innerHeight;
      if(!h || h < 320) return;
      document.documentElement.style.setProperty('--mt-app-height', h + 'px');
      document.body && document.body.style.setProperty('--mt-app-height', h + 'px');
    }catch(e){}
  }
  setAppHeight();
  window.addEventListener('resize', setAppHeight, { passive:true });
  window.addEventListener('orientationchange', function(){ setTimeout(setAppHeight, 80); setTimeout(setAppHeight, 350); }, { passive:true });
  window.addEventListener('pageshow', function(){ setTimeout(setAppHeight, 0); setTimeout(setAppHeight, 250); }, { passive:true });
  window.addEventListener('focus', function(){ setTimeout(setAppHeight, 60); }, { passive:true });
  document.addEventListener('visibilitychange', function(){ if(!document.hidden){ setTimeout(setAppHeight, 60); setTimeout(setAppHeight, 280); } }, { passive:true });
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', setAppHeight, { passive:true });
    window.visualViewport.addEventListener('scroll', setAppHeight, { passive:true });
  }
  // Capacitor (WKWebView) : au premier rendu, la vue native peut ne pas
  // encore avoir sa taille finale quand ce script tourne, et aucun des
  // événements ci-dessus ne se déclenche forcément pour rattraper le coup.
  // On force donc une rafale de nouvelles tentatives dans la seconde qui
  // suit — invisible car masquée par le loader (~1.5s) sur web comme sur
  // natif, et sans impact si la valeur était déjà correcte du premier coup.
  [30, 80, 150, 300, 500, 800, 1200].forEach(function(ms){ setTimeout(setAppHeight, ms); });
})();



/* V205 — Résilience réseau iOS / Wi‑Fi ↔ 5G
   - limite les attentes réseau qui peuvent rester suspendues pendant un changement de connexion
   - évite les rendus concurrents du profil
   - relance proprement la page active lorsque la connexion redevient stable */
function mtPromiseTimeout(promise, ms, fallbackValue){
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(()=>clearTimeout(timer)),
    new Promise(resolve=>{ timer=setTimeout(()=>resolve(fallbackValue), Math.max(250, Number(ms)||3500)); })
  ]);
}
window.mtPromiseTimeout = mtPromiseTimeout;

(function mtInstallNetworkResilience(){
  if(window.__MT_NETWORK_RESILIENCE_INSTALLED__) return;
  window.__MT_NETWORK_RESILIENCE_INSTALLED__ = true;
  let timer = null;
  let lastRefresh = 0;
  let wasOffline = !navigator.onLine;

  function mark(online){
    document.documentElement.classList.toggle('mt-network-offline', !online);
    document.body && document.body.classList.toggle('mt-network-offline', !online);
    if(!online) wasOffline = true;
  }

  async function refreshAfterStableConnection(){
    if(!navigator.onLine || document.hidden) return;
    const now=Date.now();
    if(now-lastRefresh < 2500) return;
    lastRefresh=now;
    // Stabilité d'abord : un changement Wi-Fi/4G/5G ne reconstruit jamais
    // la page visible. Les composants gardent leur dernier rendu valide et
    // pourront rafraîchir leurs données au prochain chargement volontaire.
    try{ window.dispatchEvent(new CustomEvent('mt:network-restored')); }catch(e){}
  }

  function scheduleRefresh(){
    mark(true);
    if(!wasOffline) return;
    wasOffline = false;
    clearTimeout(timer);
    timer=setTimeout(refreshAfterStableConnection, 900);
  }

  window.addEventListener('offline', ()=>{
    mark(false);
    clearTimeout(timer);
    if(window.mtToast) mtToast('Connexion interrompue · tes données restent affichées');
  }, {passive:true});
  window.addEventListener('online', scheduleRefresh, {passive:true});
  mark(navigator.onLine);

  // Capacitor Network, quand le plugin est disponible.
  function installNativeNetworkListener(){
    try{
      const Network=window.Capacitor?.Plugins?.Network;
      if(!Network?.addListener) return false;
      Network.addListener('networkStatusChange', status=>{
        const connected=!!status?.connected;
        mark(connected);
        if(connected) scheduleRefresh();
      });
      return true;
    }catch(e){ return false; }
  }
  if(!installNativeNetworkListener()) [250,700,1500].forEach(ms=>setTimeout(installNativeNetworkListener,ms));
})();

async function mtRequireUser() {
  const client = initSupabase && initSupabase();

  if (!client) {
    alert("Connexion indisponible. Réessaie dans quelques instants.");
    return null;
  }

  const { data } = await client.auth.getSession();
  const user = data?.session?.user;

  if (!user) {
    location.href = "auth.html";
    return null;
  }

  return user;
}

async function mtCallFunction(name, payload = {}) {
  const client = initSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    location.href = "auth.html";
    return null;
  }

  const base = window.MT_CONFIG.SUPABASE_FUNCTIONS_BASE || `${window.MT_CONFIG.SUPABASE_URL}/functions/v1`;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = setTimeout(() => controller?.abort(), 20000);
  let res;
  try {
    res = await fetch(`${base}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: controller?.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("La connexion prend trop de temps. Vérifie ton réseau puis réessaie.");
    if (!navigator.onLine) throw new Error("Connexion interrompue. Reconnecte-toi puis réessaie.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error || "Erreur serveur.");
  return json;
}




/* V234 — Apple In-App Purchase natif (StoreKit 2)
   Les contenus numériques iOS passent exclusivement par Apple.
   Le serveur Supabase valide la transaction Apple avant tout déblocage. */
function mtNativeIAPPlugin(){
  try { return window.Capacitor?.Plugins?.InAppPurchase || null; } catch(e){ return null; }
}

/* V239 — évite le flash du bouton de restauration sur le profil.
   Le bloc reste caché au premier affichage et n’est révélé qu’une fois
   le rendu principal terminé, uniquement dans l’application iOS native. */
function mtSyncAppleRestoreVisibility(){
  const shouldShow = mtIsIOSNativeApp() && !!mtNativeIAPPlugin()?.restore;
  document.querySelectorAll('[data-mt-apple-restore]').forEach((card) => {
    card.hidden = !shouldShow;
    card.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  });
}

async function mtAppleIAPPurchase({ purchase_type, item_id, product_id }){
  const user = await mtRequireUser();
  if(!user) return null;
  if(!mtIsIOSNativeApp()) throw new Error("L’achat Apple est disponible dans l’application iPhone.");
  if(!product_id) throw new Error("Ce contenu n’a pas encore de Product ID Apple configuré.");
  const plugin = mtNativeIAPPlugin();
  if(!plugin?.purchase) throw new Error("Le module d’achat Apple n’est pas disponible dans ce build.");

  const result = await plugin.purchase({
    productId: product_id,
    appAccountToken: user.id
  });
  if(result?.status === "cancelled") return { cancelled:true };
  if(result?.status === "pending") {
    alert("L’achat est en attente de validation Apple.");
    return { pending:true };
  }
  if(result?.status !== "purchased" || !result?.transactionId) throw new Error("Transaction Apple incomplète.");

  try {
    const validation = await mtCallFunction("validate-apple-iap", {
      transaction_id: result.transactionId,
      product_id: result.productId || product_id,
      purchase_type,
      item_id,
      signed_transaction: result.jwsRepresentation || null
    });
    if(!validation?.unlocked) {
      throw new Error("Le serveur n’a pas confirmé le déblocage de cet achat Apple.");
    }
    await plugin.finish({ transactionId: result.transactionId }).catch(()=>{});
    localStorage.removeItem("mt_protocols_cache");
    localStorage.removeItem("mt_recipes_cache");
    return validation;
  } catch(error) {
    throw new Error(error?.message || "Apple a encaissé l’achat, mais le déblocage n’a pas pu être confirmé. Utilise Restaurer mes achats.");
  }
}

async function mtRestoreApplePurchases(){
  const user = await mtRequireUser();
  if(!user) return;
  const plugin = mtNativeIAPPlugin();
  if(!mtIsIOSNativeApp() || !plugin?.restore) return alert("La restauration s’effectue depuis l’application iPhone.");
  const result = await plugin.restore();
  let restored = 0;
  for(const tx of (result?.transactions || [])){
    try{
      const validation = await mtCallFunction("validate-apple-iap", {
        transaction_id: tx.transactionId,
        product_id: tx.productId,
        purchase_type: "restore",
        item_id: null,
        signed_transaction: tx.jwsRepresentation || null
      });
      if(validation?.unlocked) {
        restored++;
        await plugin.finish({ transactionId: tx.transactionId }).catch(()=>{});
      }
    }catch(e){ console.warn("Restauration Apple ignorée", tx?.productId, e); }
  }
  localStorage.removeItem("mt_protocols_cache");
  localStorage.removeItem("mt_recipes_cache");
  alert(restored ? `${restored} achat${restored>1?'s':''} restauré${restored>1?'s':''}.` : "Aucun nouvel achat à restaurer.");
  location.reload();
}
window.mtRestoreApplePurchases = mtRestoreApplePurchases;


/* V236 — reprise automatique des transactions Apple inachevées. */
const MT_APPLE_IAP_RECOVERY_KEY = "mt_apple_iap_recovery_queue";
const mtAppleIAPRecoveryInFlight = new Set();

function mtReadAppleIAPRecoveryQueue(){
  try{
    const queue = JSON.parse(localStorage.getItem(MT_APPLE_IAP_RECOVERY_KEY) || "[]");
    return Array.isArray(queue) ? queue.filter(tx => tx?.transactionId && tx?.productId) : [];
  }catch(e){ return []; }
}

function mtWriteAppleIAPRecoveryQueue(queue){
  try{
    if(queue.length) localStorage.setItem(MT_APPLE_IAP_RECOVERY_KEY, JSON.stringify(queue));
    else localStorage.removeItem(MT_APPLE_IAP_RECOVERY_KEY);
  }catch(e){}
}

function mtQueueAppleIAPRecovery(tx){
  if(!tx?.transactionId || !tx?.productId) return;
  const queue = mtReadAppleIAPRecoveryQueue();
  const index = queue.findIndex(item => String(item.transactionId) === String(tx.transactionId));
  if(index >= 0) queue[index] = {...queue[index], ...tx};
  else queue.push(tx);
  mtWriteAppleIAPRecoveryQueue(queue);
}

async function mtProcessAppleIAPRecoveryQueue(){
  if(!mtIsIOSNativeApp() || !navigator.onLine) return;

  const plugin = mtNativeIAPPlugin();
  if(!plugin?.finish) return;

  const client = initSupabase && initSupabase();
  if(!client) return;
  const {data} = await client.auth.getSession();
  if(!data?.session?.user) return;

  for(const tx of mtReadAppleIAPRecoveryQueue()){
    const transactionId = String(tx.transactionId || "");
    if(!transactionId || mtAppleIAPRecoveryInFlight.has(transactionId)) continue;

    mtAppleIAPRecoveryInFlight.add(transactionId);
    try{
      const validation = await mtCallFunction("validate-apple-iap", {
        transaction_id: transactionId,
        product_id: tx.productId,
        purchase_type: "restore",
        item_id: null,
        signed_transaction: tx.jwsRepresentation || null
      });

      if(validation?.unlocked){
        await plugin.finish({transactionId});
        mtWriteAppleIAPRecoveryQueue(
          mtReadAppleIAPRecoveryQueue().filter(item => String(item.transactionId) !== transactionId)
        );
        localStorage.removeItem("mt_protocols_cache");
        localStorage.removeItem("mt_recipes_cache");
        try{
          window.dispatchEvent(new CustomEvent("mt:apple-iap-recovered", {
            detail: {transactionId, productId: tx.productId}
          }));
        }catch(e){}
      }
    }catch(error){
      console.warn("Transaction Apple conservée pour une nouvelle tentative", tx?.productId, error);
    }finally{
      mtAppleIAPRecoveryInFlight.delete(transactionId);
    }
  }
}

function mtInstallAppleIAPRecoveryListener(){
  if(!mtIsIOSNativeApp()) return;
  const plugin = mtNativeIAPPlugin();
  if(!plugin?.addListener || window.__MT_APPLE_IAP_RECOVERY_LISTENER__) return;

  window.__MT_APPLE_IAP_RECOVERY_LISTENER__ = true;
  Promise.resolve(plugin.addListener("unfinishedTransaction", tx => {
    mtQueueAppleIAPRecovery(tx);
    mtProcessAppleIAPRecoveryQueue();
  })).catch(error => {
    window.__MT_APPLE_IAP_RECOVERY_LISTENER__ = false;
    console.warn("Listener Apple IAP indisponible", error);
  });
}

[0, 300, 900, 1800].forEach(delay => {
  setTimeout(() => {
    mtInstallAppleIAPRecoveryListener();
    mtProcessAppleIAPRecoveryQueue();
  }, delay);
});

window.addEventListener("online", mtProcessAppleIAPRecoveryQueue, {passive:true});
window.addEventListener("mt:network-restored", mtProcessAppleIAPRecoveryQueue);
document.addEventListener("DOMContentLoaded", mtProcessAppleIAPRecoveryQueue);


/* Détection du runtime natif iOS pour router les achats numériques vers StoreKit. */
function mtIsCapacitorRuntime(){
  try{
    const cap = window.Capacitor;
    if(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) return true;
    if(location.protocol === "capacitor:") return true;
    if(location.hostname === "localhost" || location.hostname === "127.0.0.1") return true;
    if(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.bridge) return true;
  }catch(e){}
  return false;
}

function mtIsIOSNativeApp(){
  try{
    const cap = window.Capacitor;
    if(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()){
      const platform = typeof cap.getPlatform === "function" ? cap.getPlatform() : "";
      if(platform === "ios") return true;
    }

    const ua = navigator.userAgent || "";
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return !!(isAppleMobile && mtIsCapacitorRuntime());
  }catch(e){}
  return false;
}

(function mtMarkIOSNativeForSafeArea(){
  try{
    const ua = navigator.userAgent || "";
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isCapacitorUrl = location.protocol === "capacitor:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1" ||
      (window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
    if(isAppleMobile && isCapacitorUrl){
      document.documentElement.classList.add("mt-ios-native-app");
      document.body && document.body.classList.add("mt-ios-native-app");
    }
  }catch(e){}
})();

/* V235 — iOS utilise exclusivement Apple In-App Purchase.
   Stripe reste disponible uniquement dans le parcours web. */
function mtOpenExternalUrl(url){
  try{
    // Fallback web uniquement. Le build iOS utilise l'API StoreKit native ci-dessus.
    const opened = window.open(url, "_system", "noopener,noreferrer");
    if(opened) return;
  }catch(e){}
  window.location.href = url;
}

async function startSecureCheckoutProtocol(protocolId) {
  try {
    const protocols = await fetchProtocols();
    const protocol = protocols.find(p => String(p.id) === String(protocolId) || p.slug === protocolId);
    if(!protocol) throw new Error("Protocole introuvable.");
    if(mtIsIOSNativeApp()) {
      const result = await mtAppleIAPPurchase({ purchase_type:"protocol", item_id:protocol.id, product_id:protocol.apple_product_id });
      if(result?.unlocked) location.href = `protocol-journey.html?id=${encodeURIComponent(protocol.id)}&payment=success`;
      return;
    }
    const result = await mtCallFunction(window.MT_CONFIG.STRIPE_CHECKOUT_FUNCTION || "create-checkout-session", { purchase_type:"protocol", protocol_id:protocol.id });
    const checkoutUrl = result?.url || result?.checkout_url;
    if(checkoutUrl) mtOpenExternalUrl(checkoutUrl); else alert("Lien de paiement indisponible.");
  } catch (err) { alert(err.message || "Impossible d’ouvrir le paiement."); }
}

async function startSecureCheckoutAppAccess() {
  try {
    if(mtIsIOSNativeApp()) {
      alert("Cet accès global n’est pas encore proposé dans l’application iPhone. Les contenus numériques iOS sont disponibles exclusivement via les achats intégrés Apple.");
      return;
    }
    const result = await mtCallFunction(window.MT_CONFIG.STRIPE_CHECKOUT_FUNCTION || "create-checkout-session", {
      purchase_type: "app_access"
    });
    const checkoutUrl = result?.url || result?.checkout_url;
    if (checkoutUrl) mtOpenExternalUrl(checkoutUrl);
    else alert("Lien de paiement indisponible.");
  } catch (err) {
    alert(err.message || "Impossible d’ouvrir le paiement.");
  }
}

async function openSignedProtocolFile(contentId) {
  try {
    const result = await mtCallFunction(window.MT_CONFIG.SIGNED_URL_FUNCTION || "create-signed-url", {
      content_id: contentId
    });
    if (result?.signed_url) window.open(result.signed_url, "_blank", "noopener");
  } catch (err) {
    alert(err.message || "Fichier indisponible.");
  }
}

function euros(cents) {
  return ((cents || 0) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
function getParam(name) { return new URLSearchParams(location.search).get(name); }
function slugify(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function fmtDate(iso) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso || Date.now()));
  } catch(e) { return ""; }
}
function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function mtCurrentPageName(){
  return (location.pathname.split("/").pop() || "index.html").toLowerCase();
}

async function mtEnsurePrivatePageAccess(){
  const privatePages = new Set([
    "dashboard.html",
    "library.html",
    "protocol.html",
    "protocols.html",
    "protocol-journey.html",
    "food-day.html",
    "food-meal.html",
    "food-adapter.html"
  ]);
  const page = mtCurrentPageName();
  if(!privatePages.has(page)) return true;

  const client = initSupabase && initSupabase();
  if(!client){
    location.replace("auth.html");
    return false;
  }

  const { data } = await client.auth.getSession();
  if(data?.session?.user) return true;

  const next = `${location.pathname}${location.search}${location.hash}`;
  location.replace(`auth.html?next=${encodeURIComponent(next)}`);
  return false;
}

function mtIsInstalledAppMode(){
  return !!(window.navigator.standalone || window.matchMedia?.('(display-mode: standalone)')?.matches);
}


function mtIconHTML(key, extraClass = "") {
  const k = String(key || "").toLowerCase();
  const cls = `mt-line-icon ${extraClass || ""}`.trim();
  const map = {
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.2 12 4l8 7.2"/><path d="M6.5 10.5V20h11v-9.5"/><path d="M9.5 20v-5h5v5"/></svg>`,
    leaf: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c7.8-.4 12.4-5.2 14-14-8.8 1.6-13.6 6.2-14 14Z"/><path d="M5 19 15 9"/><path d="M9 15c-2.1-2.2-4.1-3.1-6-2.7 1.1 2.5 3.1 3.9 6 4.2"/></svg>`,
    target: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2.7v2.8M12 18.5v2.8M2.7 12h2.8M18.5 12h2.8"/></svg>`,
    bowl: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 11.5h15c-.6 4.4-3.4 7-7.5 7s-6.9-2.6-7.5-7Z"/><path d="M7 19.5h10"/><path d="M15.5 10.5 19 5"/><path d="M17.8 5.8 20 7.3"/></svg>`,
    book: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5c2.8-.6 5-.2 7 1.2v12c-2-1.4-4.2-1.8-7-1.2v-12Z"/><path d="M19 5.5c-2.8-.6-5-.2-7 1.2v12c2-1.4 4.2-1.8 7-1.2v-12Z"/></svg>`,
    profile: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 19.5c1.5-4 4-6 7-6s5.5 2 7 6"/></svg>`,
    drop: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5s-6 6.7-6 11.1a6 6 0 0 0 12 0c0-4.4-6-11.1-6-11.1Z"/><path d="M9 16.2c.7 1.2 1.7 1.8 3 1.8"/></svg>`,
    movement: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4.8" r="2"/><path d="M10.5 8.2 8.4 12l3.3 2.3-2 5"/><path d="M12 8.5l3.2 3.2 2.8-.8"/><path d="M7 19.5h3.8"/></svg>`,
    chocolate: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10v14H7z"/><path d="M7 9h10M7 13h10M12 5v14"/></svg>`,
    sparkle: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 13.7 9l5.8 1.5-5.8 1.8L12 18l-1.7-5.7-5.8-1.8L10.3 9 12 3.5Z"/><path d="M18 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8.5 10V7.8A3.5 3.5 0 0 1 12 4.3a3.5 3.5 0 0 1 3.5 3.5V10"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 18h9a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.4 1.5A3.3 3.3 0 0 0 7.5 18Z"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a8.4 8.4 0 1 0 11.2 11.2Z"/><path d="M16.8 5.2v2.4M15.6 6.4H18"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10a5 5 0 0 1 10 0c0 4 1.5 5.3 2.2 6H4.8C5.5 15.3 7 14 7 10Z"/><path d="M10 19c.5.8 1.2 1.2 2 1.2s1.5-.4 2-1.2"/></svg>`,
    key: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="12" r="3.2"/><path d="M11.7 12H21"/><path d="M17 12v3"/><path d="M20 12v2"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 6v5.3c0 4.6-2.8 7.6-7 9.2-4.2-1.6-7-4.6-7-9.2V6l7-2.5Z"/><path d="M9 12.2l2 2 4-4.4"/></svg>`,
    mail: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="m5 7 7 6 7-6"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7.5 7.5 8.4 20h7.2l.9-12.5"/><path d="M10.5 11v5M13.5 11v5"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H5.8A1.8 1.8 0 0 0 4 6.8v10.4A1.8 1.8 0 0 0 5.8 19H9"/><path d="M13 8l4 4-4 4"/><path d="M17 12H8"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="5.5" width="15" height="14" rx="2"/><path d="M8 3.8v3.4M16 3.8v3.4M4.5 9.5h15"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V5"/><path d="M5 19h15"/><path d="M8 16v-4M12 16V8M16 16v-6"/></svg>`,
    check: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="3"/><path d="m8.5 12.2 2.2 2.3 4.8-5"/></svg>`,
    seed: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V10"/><path d="M12 12c-3.2-.2-5.4-1.8-6.6-4.8 3.6-.5 5.8 1.1 6.6 4.8Z"/><path d="M12 14c3.2-.2 5.4-1.8 6.6-4.8-3.6-.5-5.8 1.1-6.6 4.8Z"/></svg>`,
    sprout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V9"/><path d="M12 11C9 8.5 6.3 7.8 4 8.8c1.2 3.1 3.7 4.5 8 4.2"/><path d="M12 10c2.9-3.2 5.7-4.1 8-2.8-.8 3.5-3.3 5.1-8 4.8"/></svg>`,
    flower: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1.8"/><path d="M12 4.2c2.6 2.2 2.6 4.3 0 6.2-2.6-1.9-2.6-4 0-6.2Z"/><path d="M19.8 12c-2.2 2.6-4.3 2.6-6.2 0 1.9-2.6 4-2.6 6.2 0Z"/><path d="M12 19.8c-2.6-2.2-2.6-4.3 0-6.2 2.6 1.9 2.6 4 0 6.2Z"/><path d="M4.2 12c2.2-2.6 4.3-2.6 6.2 0-1.9 2.6-4 2.6-6.2 0Z"/></svg>`,
    tree: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20v-5"/><path d="M8 15h8a4 4 0 0 0-1.1-7.8A4.8 4.8 0 0 0 5.5 10 3.5 3.5 0 0 0 8 15Z"/><path d="M9.5 20h5"/></svg>`,
    openbook: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5c2.8-.6 5.2-.1 7.5 1.4v11c-2.3-1.5-4.7-2-7.5-1.4v-11Z"/><path d="M19.5 6.5c-2.8-.6-5.2-.1-7.5 1.4v11c2.3-1.5 4.7-2 7.5-1.4v-11Z"/><path d="M12 8v11"/></svg>`
  };
  let name = "sparkle";
  if (/home|accueil|maison/.test(k)) name = "home";
  else if (/pharm|plante|leaf|feuille|routine|green|herb/.test(k)) name = "leaf";
  else if (/objectif|target|forme|silhouette|tonus|sport|fire/.test(k)) name = "target";
  else if (/recette|recipe|bowl|fuel|bol|latte|meal/.test(k)) name = "bowl";
  else if (/biblio|library|book|ebook|pdf|livre/.test(k)) name = "book";
  else if (/profil|profile|user|dashboard/.test(k)) name = "profile";
  else if (/hydrat|water|eau|drop/.test(k)) name = "drop";
  else if (/mouv|walk|move|marche/.test(k)) name = "movement";
  else if (/sweet|choco|sucre/.test(k)) name = "chocolate";
  else if (/lock|priv|drop-exclusif|security/.test(k)) name = "lock";
  else if (/sommeil|sleep|repos|nuit|moon|lune/.test(k)) name = "moon";
  else if (/mindset|mood|calme|cloud/.test(k)) name = "cloud";
  else if (/notif|bell|rappel/.test(k)) name = "bell";
  else if (/key|cle|clé|access|acces|accès/.test(k)) name = "key";
  else if (/shield|secur|sécur|confiance|confidential/.test(k)) name = "shield";
  else if (/mail|email|e-mail/.test(k)) name = "mail";
  else if (/trash|delete|supprimer|corbeille/.test(k)) name = "trash";
  else if (/logout|signout|deconnexion|déconnexion|sortir/.test(k)) name = "logout";
  else if (/graine|seed/.test(k)) name = "seed";
  else if (/pousse|sprout/.test(k)) name = "sprout";
  else if (/floraison|flower/.test(k)) name = "flower";
  else if (/racines|tree|arbre/.test(k)) name = "tree";
  else if (/calendar|calendrier|date/.test(k)) name = "calendar";
  else if (/journal|openbook|book-open|ecrire|écrire/.test(k)) name = "openbook";
  else if (/tracker|chart|suivi|tableau/.test(k)) name = "chart";
  else if (/check|checklist|valider/.test(k)) name = "check";
  return `<span class="${cls} mt-line-icon--${name}">${map[name]}</span>`;
}
window.mtIconHTML = mtIconHTML;


function mtHaptic(type = "light") {
  try {
    const h = window.Capacitor?.Plugins?.Haptics;
    if (h?.impact) {
      const style = type === "strong" ? "HEAVY" : type === "medium" ? "MEDIUM" : "LIGHT";
      h.impact({ style });
      return;
    }
  } catch(e) {}
  try {
    if (navigator.vibrate) navigator.vibrate(type === "strong" ? 18 : 8);
  } catch(e) {}
}
window.mtHaptic = mtHaptic;

(function mtNativeTouchPolish(){
  if (window.__MT_NATIVE_TOUCH_POLISH__) return;
  window.__MT_NATIVE_TOUCH_POLISH__ = true;
  const selector = 'button,a,.protocol-card,.post-card,.content-card,.mini-card,.library-category,.club-v18-tile,.story-bubble,.trust-app-card,.push-notif-card,.dashboard-card,.journal-card,.download-link';
  document.addEventListener('pointerdown', function(e){
    const el = e.target.closest && e.target.closest(selector);
    if (!el || el.classList.contains('no-press')) return;
    el.classList.add('mt-pressing');
  }, {passive:true});
  ['pointerup','pointercancel','pointerleave','scroll'].forEach(ev=>{
    document.addEventListener(ev, function(){
      document.querySelectorAll('.mt-pressing').forEach(x=>x.classList.remove('mt-pressing'));
    }, {passive:true});
  });
  document.addEventListener('click', function(e){
    const el = e.target.closest && e.target.closest('button,a,.club-v18-tile,.story-bubble,.library-category,.trust-app-card');
    if (!el || el.classList.contains('no-haptic')) return;
    const strong = el.classList.contains('main-cta') || el.classList.contains('push-notif-btn') || el.classList.contains('download-link');
    mtHaptic(strong ? 'medium' : 'light');
  }, true);
})();

function mediaKind(url) {
  const u = String(url || "").split("?")[0].toLowerCase();
  return u.match(/\.(mp4|webm|ogg|mov|m4v)$/) ? "video" : "image";
}
function renderTopActions() {
  const el = document.getElementById("topActions");
  if (!el) return;
  el.innerHTML = `
    <a class="round-action" href="dashboard.html" aria-label="Profil">${mtIconHTML("profile", "top-action-icon")}</a>
    <button class="round-action" onclick="mtSignOut()" aria-label="Déconnexion">${mtIconHTML("logout", "top-action-icon")}</button>
  `;
}

async function fetchPages() {
  const client = initSupabase();
  if (client) {
    try {
      const result = await Promise.race([
        client.from("app_pages").select("*").eq("active", true).order("sort_order", { ascending: true }),
        new Promise((resolve) => setTimeout(() => resolve({ data: null, error: new Error("mt-timeout") }), 4000))
      ]);
      const { data, error } = result || {};
      if (!error && data?.length) return data.map(p => ({
        ...p,
        href: p.system_key === "home" ? "index.html"
          : p.system_key === "dashboard" ? "dashboard.html"
          : p.system_key === "library" ? "library.html"
          : p.system_key === "protocols_pharmacie" ? "protocols.html?category=pharmacie_vegetale"
          : p.system_key === "protocols_objectifs" ? "protocols.html?category=objectifs_corps"
          : `page.html?slug=${p.slug}`
      }));
    } catch (e) { /* on bascule sur le fallback ci-dessous */ }
  }
  return window.MT_DEFAULT_PAGES || [];
}

async function renderNav() {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;
  const current = location.pathname.split("/").pop() || "index.html";
  // Les pages alimentaires appartiennent au Carnet. Le savoir avant la
  // réponse Supabase évite aussi le bref passage sans onglet actif.
  const currentNavPath = /^food-(?:day|meal|adapter)\.html$/i.test(current)
    ? "library.html"
    : current;
  const params = new URLSearchParams(location.search);
  const category = params.get("category");
  const pageSlug = params.get("slug");

  const markup = (pages) => (pages || []).slice(0, 7).map(item => {
      const itemPath = item.href.split("?")[0];
      const itemParams = new URLSearchParams((item.href.split("?")[1] || ""));
      let active = false;
      if (current === "protocols.html") active = itemPath === "protocols.html" && itemParams.get("category") === category;
      else if (current === "page.html") active = itemPath === "page.html" && itemParams.get("slug") === pageSlug;
      else active = itemPath === currentNavPath;
      if (current === "index.html" && item.system_key === "home") active = true;
      const navLabel = item.system_key === "protocols_pharmacie" ? "Pharmacopée" : (item.label || "Page");
      const navIconKey = item.system_key || item.slug || item.label || item.emoji || "sparkle";
      return `<a class="${active ? "active" : ""}" href="${item.href}"><b>${mtIconHTML(navIconKey, "nav-icon")}</b><span>${escapeHTML(navLabel)}</span></a>`;
    }).join("");
  const paint = (pages) => {
    const html = markup(pages);
    if (html && nav.innerHTML !== html) nav.innerHTML = html;
  };

  // Premier rendu synchrone depuis la configuration embarquée : la navbar
  // occupe sa place dès la toute première image, sans faux écran intermédiaire.
  paint(window.MT_DEFAULT_PAGES || []);

  // La configuration distante reste la source de vérité et se synchronise
  // silencieusement. Si elle est identique, le DOM n'est pas reconstruit.
  const pages = await fetchPages();
  paint(pages);
}

async function guardHomeAccess() {
  if (!window.MT_CONFIG.HOME_REQUIRES_LOGIN) return true;
  const user = await mtGetUser();
  if (!user) { location.href = "auth.html"; return false; }
  const ok = await mtHasLimitedAccess();
  if (!ok && !location.pathname.endsWith("access.html")) {
    const gate = document.getElementById("accessGate");
    if (gate) gate.classList.remove("hidden");
  }
  return true;
}

async function fetchPosts(limit = 30, type = null) {
  const client = initSupabase();
  if (client) {
    try {
      let q = client.from("posts").select("*").eq("active", true).order("created_at", { ascending: false }).limit(limit);
      if (type) q = q.eq("type", type);
      const result = await Promise.race([
        q,
        new Promise((resolve) => setTimeout(() => resolve({ data: null, error: new Error("mt-timeout") }), 4000))
      ]);
      const { data, error } = result || {};
      if (!error && data?.length) return data;
    } catch (e) { /* on bascule sur le fallback ci-dessous */ }
  }
  return [];
}

function mediaGrid(post, eager = false) {
  let urls = [];
  if (Array.isArray(post.media_urls)) urls = post.media_urls;
  else if (post.media_urls) {
    try { urls = JSON.parse(post.media_urls); } catch(e) { urls = [post.media_urls]; }
  }
  if (post.image_url && !urls.includes(post.image_url)) urls.unshift(post.image_url);
  urls = urls.filter(Boolean).slice(0,4);
  if (!urls.length) return "";
  return `<div class="post-media-grid count-${urls.length}">
    ${urls.map((url, i) => {
      const kind = mediaKind(url);
      return `<button class="media-tile" onclick="openMedia('${escapeHTML(url)}','${escapeHTML(post.title || "")}')">
        ${kind === "video" ? `<video src="${escapeHTML(url)}" muted playsinline preload="metadata"></video><span class="media-play">▶</span>` : `<img src="${escapeHTML(url)}" loading="${eager && i === 0 ? "eager" : "lazy"}" fetchpriority="${eager && i === 0 ? "high" : "auto"}" decoding="async" alt="" onerror="this.closest('.media-tile')?.classList.add('media-load-error')">`}
      </button>`;
    }).join("")}
  </div>`;
}


function mtPostDomId(p) {
  const raw = String((p && (p.id || p.slug || p.title)) || "post");
  const safe = raw
    .normalize ? raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : raw;
  return "post-" + safe.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

const MT_POST_PREVIEW_CHARS = 155;
const MT_POST_EXCERPT_RE = /^\s*\[\[EXTRAIT:(.*?)\]\]\s*/s;

function mtPostContentParts(text) {
  const raw = String(text || "");
  const match = raw.match(MT_POST_EXCERPT_RE);
  return {
    excerpt: match ? String(match[1] || "").trim() : "",
    content: match ? raw.slice(match[0].length).trim() : raw.trim()
  };
}

function mtPostPreview(text, explicitExcerpt = "") {
  const source = String(explicitExcerpt || "").trim();
  const clean = (source || String(text || ""))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*•>]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return { preview: "", isTruncated: false };
  if (source || clean.length <= MT_POST_PREVIEW_CHARS) return { preview: clean, isTruncated: !source && clean.length > MT_POST_PREVIEW_CHARS };
  const windowText = clean.slice(0, MT_POST_PREVIEW_CHARS + 45);
  const sentence = windowText.match(/^(.{45,155}?[.!?])(?:\s|$)/);
  const cut = sentence ? sentence[1] : clean.slice(0, MT_POST_PREVIEW_CHARS).replace(/\s\S*$/, "");
  return { preview: cut.trim(), isTruncated: cut.trim().length < clean.length };
}

function mtPostEditorialHTML(text) {
  const lines = String(text || "").split(/\r?\n/);
  let html = "", paragraph = [], list = [], listType = "ul", anecdote = [];
  const flushParagraph = () => { if (paragraph.length) { html += `<p>${paragraph.map(escapeHTML).join("<br>")}</p>`; paragraph = []; } };
  const flushList = () => { if (list.length) { html += `<${listType} class="mt-post-editorial-list">${list.map(x=>`<li>${escapeHTML(x)}</li>`).join("")}</${listType}>`; list = []; } };
  const flushAnecdote = () => { if (anecdote.length) { html += `<aside class="mt-post-anecdote"><div class="mt-post-anecdote-kicker">✦ Anecdote méconnue</div><p>${anecdote.map(escapeHTML).join("<br>")}</p></aside>`; anecdote = []; } };
  let inAnecdote = false;
  lines.forEach(raw => {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushList(); if (inAnecdote) flushAnecdote(); inAnecdote = false; return; }
    if (/^>\s*anecdote m[eé]connue\s*$/i.test(line) || /^anecdote m[eé]connue\s*:?$/i.test(line)) { flushParagraph(); flushList(); flushAnecdote(); inAnecdote = true; return; }
    if (inAnecdote) { anecdote.push(line.replace(/^>\s*/, "")); return; }
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) { flushParagraph(); flushList(); html += h[1].length === 1 ? `<h3>${escapeHTML(h[2])}</h3>` : `<h4>${escapeHTML(h[2])}</h4>`; return; }
    if (/^[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý0-9 ’'&-]{3,}:?$/.test(line) && line.length < 70) { flushParagraph(); flushList(); html += `<h4>${escapeHTML(line.replace(/:$/, ""))}</h4>`; return; }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) { flushParagraph(); const nextType = numbered ? "ol" : "ul"; if (list.length && listType !== nextType) flushList(); listType = nextType; list.push((bullet || numbered)[1]); return; }
    flushList(); paragraph.push(line);
  });
  flushParagraph(); flushList(); flushAnecdote();
  return html;
}

function postCard(p, index = 0) {
  const domId = mtPostDomId(p);
  const parts = mtPostContentParts(p.content);
  const explicitExcerpt = p.excerpt || p.feed_excerpt || parts.excerpt || "";
  const { preview, isTruncated } = mtPostPreview(parts.content, explicitExcerpt);
  const hasMore = explicitExcerpt ? String(parts.content || '').trim() !== String(explicitExcerpt || '').trim() : isTruncated;
  const fullContent = escapeHTML(parts.content || "");
  return `<article id="${escapeHTML(domId)}" class="post-card reveal"
    data-post-id="${escapeHTML(domId)}"
    data-post-title="${escapeHTML(p.title || "")}"
    data-post-content="${fullContent}"
    data-post-type="${escapeHTML(p.type || "Journal")}"
    data-post-date="${escapeHTML(p.created_at || new Date().toISOString())}">
    <div class="post-head">
      <div class="avatar">T</div>
      <div>
        <strong>Méthode Tee</strong>
        <small>${fmtDate(p.created_at)}</small>
      </div>
      <span class="tag">${escapeHTML(p.type || "Journal")}</span>
    </div>
    ${p.title ? `<h2>${escapeHTML(p.title)}</h2>` : ""}
    ${mediaGrid(p, index === 0)}
    ${preview ? `<p class="post-preview-text">${escapeHTML(preview)}${!explicitExcerpt && isTruncated ? "…" : ""}</p>` : ""}
    ${hasMore ? `<button class="post-read-more" onclick="mtOpenPostDetail(this.closest('.post-card'))">Lire la suite →</button>` : ""}
  </article>`;
}

function mtOpenPostDetail(card) {
  if (!card) return;
  const title = card.dataset.postTitle || "";
  const content = card.dataset.postContent || "";
  const type = card.dataset.postType || "Journal";
  const date = card.dataset.postDate || "";

  // Clone the media grid if present
  const mediaEl = card.querySelector(".post-media-grid");
  const mediaHTML = mediaEl ? mediaEl.outerHTML : "";

  let drawer = document.getElementById("mtPostDetailDrawer");
  if (!drawer) {
    drawer = document.createElement("div");
    drawer.id = "mtPostDetailDrawer";
    drawer.className = "mt-post-detail-drawer";
    document.body.appendChild(drawer);
  }

  const fmtFull = date ? new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  drawer.innerHTML = `
    <div class="mt-post-detail-backdrop" onclick="mtClosePostDetail()"></div>
    <div class="mt-post-detail-sheet">
      <div class="mt-post-detail-handle"></div>
      <div class="mt-post-detail-head">
        <div class="avatar">T</div>
        <div>
          <strong>Méthode Tee</strong>
          <small>${fmtFull}</small>
        </div>
        <span class="tag">${escapeHTML(type)}</span>
        <button class="mt-post-detail-close" onclick="mtClosePostDetail()">×</button>
      </div>
      ${title ? `<h2 class="mt-post-detail-title">${escapeHTML(title)}</h2>` : ""}
      ${mediaHTML}
      <div class="mt-post-detail-body">${mtPostEditorialHTML(content)}</div>
    </div>`;

  drawer.classList.add("open");
  document.body.style.overflow = "hidden";
}

window.mtOpenPostDetail = mtOpenPostDetail;
window.mtClosePostDetail = function() {
  const drawer = document.getElementById("mtPostDetailDrawer");
  if (drawer) drawer.classList.remove("open");
  document.body.style.overflow = "";
};



// ─────────────────────────────────────────────────────────────
// Push deep-link premium : quand une notification ouvre
// /index.html?mt_post=post-...#post-... ou /#journal,
// on descend vers la bonne carte, même si le fil charge lentement.
// ─────────────────────────────────────────────────────────────
function mtNormalizeRouteKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^#/, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .trim();
}

function mtPostTypeMatchesRoute(type, route) {
  const t = mtNormalizeRouteKey(type);
  const r = mtNormalizeRouteKey(route);
  const aliases = {
    'journal': ['journal'],
    'hydratation': ['hydratation'],
    'fuel': ['fuel', 'fuel-du-jour'],
    'routine': ['routine', 'routines'],
    'conseil': ['conseil', 'conseil-prive', 'tip'],
    'drop': ['drop-exclusif', 'contenu-prive'],
    'mindset': ['mindset'],
    'mouvement': ['mouvement'],
    'sweet-switch': ['sweet-switch'],
    'recettes': ['recette', 'recettes'],
    'challenge': ['challenge'],
    'contenu-prive': ['contenu-prive', 'drop-exclusif']
  };
  return (aliases[r] || [r]).includes(t);
}

function mtReadPushDeepLink() {
  const params = new URLSearchParams(location.search || '');
  const hash = mtNormalizeRouteKey(location.hash || '');

  const post = params.get('mt_post') || (hash.startsWith('post-') ? hash : '');
  const route = params.get('mt_route') || (!hash.startsWith('post-') ? hash : '') || '';

  const payload = {
    post: post ? String(post).trim() : '',
    route: route ? String(route).trim() : ''
  };

  if (payload.post || payload.route) {
    try { sessionStorage.setItem('mt_pending_push_deeplink', JSON.stringify(payload)); } catch(e) {}
    return payload;
  }

  try {
    return JSON.parse(sessionStorage.getItem('mt_pending_push_deeplink') || '{}') || {};
  } catch(e) {
    return {};
  }
}

function mtResolvePushDeepLinkTarget(payload) {
  let target = null;

  if (payload?.post) {
    target = document.getElementById(payload.post);
  }

  if (!target && payload?.route) {
    const cards = Array.from(document.querySelectorAll('.post-card'));
    target = cards.find(card => mtPostTypeMatchesRoute(card.dataset.postType || '', payload.route));
  }

  if (!target && (payload?.post || payload?.route)) {
    target = document.getElementById('homeFeed');
  }

  return target;
}

function mtFocusPushDeepLinkTarget(target) {
  if (!target) return false;

  target.scrollIntoView({ behavior: 'smooth', block: target.id === 'homeFeed' ? 'start' : 'center' });
  target.classList.add('mt-push-highlight');
  setTimeout(() => target.classList.remove('mt-push-highlight'), 2400);

  try { sessionStorage.removeItem('mt_pending_push_deeplink'); } catch(e) {}

  // Nettoie les paramètres techniques sans recharger la page.
  if (location.search.includes('mt_post=') || location.search.includes('mt_route=')) {
    const clean = location.pathname + (location.hash || '');
    history.replaceState(null, '', clean);
  }

  return true;
}

function mtHandleNotificationDeepLink() {
  const payload = mtReadPushDeepLink();
  if (!payload?.post && !payload?.route) return;

  // Le fil d’actualité peut être injecté après auth + fetch Supabase.
  // On réessaie pendant quelques secondes pour que le lien direct marche
  // même si l’app met un peu de temps à rendre les cartes.
  let attempts = 0;
  const maxAttempts = 16;

  const tick = () => {
    attempts++;
    const target = mtResolvePushDeepLinkTarget(payload);

    if (target && (target.id !== 'homeFeed' || attempts >= 3)) {
      mtFocusPushDeepLinkTarget(target);
      return;
    }

    if (attempts < maxAttempts) {
      setTimeout(tick, 350);
    }
  };

  setTimeout(tick, 250);
}

window.addEventListener('hashchange', mtHandleNotificationDeepLink);
window.addEventListener('DOMContentLoaded', mtHandleNotificationDeepLink);
const MT_HOME_FEED_PAGE_SIZE = 5;
let mtHomeFeedPosts = [];
let mtHomeFeedVisibleCount = MT_HOME_FEED_PAGE_SIZE;

function mtRenderHomeFeedSlice() {
  const el = document.getElementById("homeFeed");
  if (!el) return;

  const visiblePosts = mtHomeFeedPosts.slice(0, mtHomeFeedVisibleCount);
  const remaining = Math.max(0, mtHomeFeedPosts.length - visiblePosts.length);
  const continuation = remaining > 0 ? `
    <div class="mt-feed-continuation">
      <span class="mt-feed-continuation-line" aria-hidden="true"></span>
      <button class="mt-feed-more" type="button" onclick="mtLoadMoreHomePosts()" aria-label="Afficher la suite du journal privé">
        <span>
          <small>Journal privé</small>
          <strong>Continuer le journal</strong>
        </span>
        <b aria-hidden="true">↓</b>
      </button>
      <p>${remaining} publication${remaining > 1 ? "s" : ""} à découvrir</p>
    </div>` : "";

  el.innerHTML = `<div class="feed-count">${mtHomeFeedPosts.length} publication${mtHomeFeedPosts.length > 1 ? "s" : ""}</div>`
    + visiblePosts.map(postCard).join("")
    + continuation;

  observeReveal();
  mtHandleNotificationDeepLink();
}

window.mtLoadMoreHomePosts = function() {
  const previousCount = mtHomeFeedVisibleCount;
  mtHomeFeedVisibleCount = Math.min(mtHomeFeedVisibleCount + MT_HOME_FEED_PAGE_SIZE, mtHomeFeedPosts.length);
  mtRenderHomeFeedSlice();

  requestAnimationFrame(() => {
    const nextCard = document.querySelectorAll("#homeFeed .post-card")[previousCount];
    if (nextCard) nextCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });
};

async function renderHomeFeed() {
  const el = document.getElementById("homeFeed");
  if (!el) return;
  await guardHomeAccess();
  mtHomeFeedPosts = await fetchPosts(40);
  mtHomeFeedVisibleCount = MT_HOME_FEED_PAGE_SIZE;
  mtRenderHomeFeedSlice();
}

function openMedia(url, title) {
  const modal = document.getElementById("mediaModal");
  if (!modal) return;
  const kind = mediaKind(url);
  modal.innerHTML = `<div class="modal-backdrop" onclick="closeMedia()"></div>
  <div class="modal-card">
    <button class="modal-close" onclick="closeMedia()">×</button>
    ${kind === "video" ? `<video src="${url}" controls autoplay playsinline></video>` : `<img src="${url}" alt="">`}
    ${title ? `<h3>${escapeHTML(title)}</h3>` : ""}
  </div>`;
  modal.classList.add("open");
}
function closeMedia() {
  const modal = document.getElementById("mediaModal");
  if (!modal) return;
  modal.classList.remove("open", "recipe-open");
  modal.innerHTML = "";
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.documentElement.style.overflow = "";
}
window.closeMedia = closeMedia;

window.mtPostDomId = mtPostDomId;
function mtSortProtocolsWithIntroFirst(protocols) {
  const introSlug = "premiers-pas-la-methode-tee";
  return [...(protocols || [])].sort((a, b) => {
    const aPinned = String(a?.slug || "") === introSlug ? 1 : 0;
    const bPinned = String(b?.slug || "") === introSlug ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;

    const aDate = Date.parse(a?.created_at || "") || 0;
    const bDate = Date.parse(b?.created_at || "") || 0;
    return bDate - aDate;
  });
}

async function fetchProtocols(category = null) {
  const client = initSupabase();
  if (client) {
    let q = client.from("protocols").select("*").eq("active", true).order("created_at", { ascending: false });
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (!error && data?.length) return mtSortProtocolsWithIntroFirst(data);
  }
  const fallback = (window.MT_PROTOCOLS || []).filter(p => !category || p.category === category);
  return mtSortProtocolsWithIntroFirst(fallback);
}
async function fetchOwnedIds() {
  const user = await mtGetUser();
  const client = initSupabase();
  const localOwned = JSON.parse(localStorage.getItem("mt_local_unlocks") || "[]").filter(Boolean);
  if (!user || !client) return [...new Set(localOwned)];

  const ids = new Set(localOwned);

  // FULL PREVIEW SAFE:
  // Admin + compte App Review voient tous les protocoles comme débloqués.
  // Ça ne crée aucun achat, ne modifie pas Stripe, ne modifie pas Supabase.
  const fullPreview = typeof mtHasFullPreviewAccess === "function" ? await mtHasFullPreviewAccess() : (typeof mtIsAdmin === "function" ? await mtIsAdmin() : false);
  if (fullPreview) {
    const protocols = await fetchProtocols();
    protocols.forEach(p => {
      if (p.id) ids.add(p.id);
      if (p.slug) ids.add(p.slug);
    });
    return [...ids];
  }

  async function collect(query) {
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      data.forEach(row => {
        const active = !row.status || row.status === "active";
        const unlocked = row.unlocked !== false;
        if (active && unlocked && row.protocol_id) ids.add(row.protocol_id);
      });
    }
  }

  // Les deux sources d'accès sont indépendantes : on les interroge en parallèle.
  const accessQueries = [
    collect(
      client.from("user_protocols")
        .select("protocol_id, unlocked, status")
        .eq("user_id", user.id)
    )
  ];
  if (user.email) {
    accessQueries.push(
      collect(
        client.from("user_protocols")
          .select("protocol_id, unlocked, status")
          .ilike("user_email", user.email)
      )
    );
  }
  await Promise.all(accessQueries);

  return [...ids];
}


async function autoUnlockFromSuccess(){
  // Après retour Stripe, on force juste la relecture Supabase.
  // On ne débloque plus tous les protocoles en local pour éviter de fausser l'app.
  const success = new URLSearchParams(window.location.search).get("payment");
  if (success === "success") {
    localStorage.removeItem("mt_protocols_cache");
  }
}


function getPaymentLink(protocol) {
  return protocol.payment_link || (window.MT_CONFIG.PAYMENT_LINKS || {})[protocol.slug || protocol.id] || "#";
}
async function startPaymentLink(protocolId) {
  const user = await mtRequireUser();
  if (!user) return;
  if(mtIsIOSNativeApp()) return startSecureCheckoutProtocol(protocolId);
  if(window.MT_CONFIG.SECURE_BACKEND) return startSecureCheckoutProtocol(protocolId);
  const protocols = await fetchProtocols();
  const protocol = protocols.find(p => String(p.id) === String(protocolId) || p.slug === protocolId);
  if(!protocol) return alert("Protocole introuvable.");
  const link = getPaymentLink(protocol);
  if(!link || link === "#") return alert("Paiement web non configuré pour ce protocole.");
  mtOpenExternalUrl(link);
}

window.startPaymentLink = startPaymentLink;

// Sécurité iOS/Capacitor : certains onclick inline peuvent être ignorés dans WKWebView.
// On intercepte donc les boutons de déblocage au niveau document et on appelle
// explicitement les fonctions de paiement.
(function mtInstallUnlockClickBridge(){
  if (window.__MT_UNLOCK_CLICK_BRIDGE__) return;
  window.__MT_UNLOCK_CLICK_BRIDGE__ = true;
  document.addEventListener("click", function(e){
    const btn = e.target && e.target.closest ? e.target.closest("button, .as-button, .download-link, .main-cta") : null;
    if(!btn) return;
    const attr = btn.getAttribute("onclick") || "";

    let m = attr.match(/startPaymentLink\('([^']+)'\)/);
    if(m){
      e.preventDefault();
      e.stopPropagation();
      startPaymentLink(m[1]);
      return;
    }

    m = attr.match(/startSecureCheckoutRecipe\('([^']+)'\)/);
    if(m){
      e.preventDefault();
      e.stopPropagation();
      startSecureCheckoutRecipe(m[1]);
    }
  }, true);
})();

function mtSmartText(item) {
  return [
    item?.title,
    item?.subtitle,
    item?.short_description,
    item?.description,
    item?.lead,
    item?.content,
    item?.content_text,
    item?.full_content,
    item?.category,
    item?.mood,
    item?.tags,
    item?.benefits,
    item?.duration_label,
    item?.emoji
  ].flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean).join(" ").toLowerCase();
}

function mtSmartRank(item, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return 1;
  const terms = q.split(/\s+/).filter(Boolean);
  const text = mtSmartText(item);
  let score = 0;
  terms.forEach(term => {
    if (text.includes(term)) score += 2;
    if (String(item?.title || "").toLowerCase().includes(term)) score += 3;
    if (String(item?.subtitle || "").toLowerCase().includes(term)) score += 2;
    if (String(item?.short_description || item?.description || "").toLowerCase().includes(term)) score += 2;
  });
  return score;
}

function mtDateValue(item) {
  const raw = item?.created_at || item?.updated_at || item?.published_at || item?.purchased_at || "";
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}



function mtNormalizeFilterValue(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, "-")
    .trim();
}

function mtInferRecipeMealType(item) {
  const direct = mtNormalizeFilterValue(item?.meal_type || item?.mealType);
  if (direct) return direct === "drinks" ? "drink" : direct;

  const cat = mtNormalizeFilterValue(item?.category);
  const title = mtNormalizeFilterValue(item?.title);
  const subtitle = mtNormalizeFilterValue(item?.subtitle);
  const mood = mtNormalizeFilterValue(item?.mood);
  const text = [cat, title, subtitle, mood].join(" ");

  if (/\b(smoothie|latte|matcha|boisson|drink|drinks|jus|iced|ice|glace|glacee|kombucha|infusion|the|tea)\b/.test(text)) return "drink";
  if (/\b(bowl|bol|porridge|yaourt|microbiote)\b/.test(text)) return "bowl";
  if (/\b(petit-dejeuner|breakfast|morning|matin|granola|muesli|pancake)\b/.test(text)) return "breakfast";
  if (/\b(dessert|sweet|sucre|sucree|gourmand|brownie|cookie|cake|chocolat|vanille|craving)\b/.test(text)) return "sweet";
  if (/\b(snack|collation|gouter|pause|energy-ball|barre)\b/.test(text)) return "snack";
  if (/\b(dinner|diner|diner|soir|curry|soupe|chaud|reconfort)\b/.test(text)) return "dinner";
  return "daily";
}

function mtInferProtocolFilterKey(item) {
  const direct = mtNormalizeFilterValue(item?.filter_key || item?.filterKey || item?.subcategory);
  if (direct) return direct;

  const text = [
    item?.title,
    item?.subtitle,
    item?.short_description,
    item?.description,
    item?.long_description,
    item?.category
  ].filter(Boolean).join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (/digestion|ventre|ballonnement|transit|intestin|foie|lourdeur/.test(text)) return "digestion";
  if (/sommeil|dormir|nuit|endormissement|calme|passiflore|camomille|verveine/.test(text)) return "sommeil";
  if (/drainage|elimination|retention|eau|jambes lourdes|queue|ortie|detox/.test(text)) return "drainage";
  if (/energie|fatigue|vitalite|tonus|boost|concentration|mate|matcha|moringa/.test(text)) return "energie";
  if (/cycle|regles|menstru|hormone|spm|framboisier|feminin/.test(text)) return "cycle";
  if (/douleur|migraine|crampe|inflammation|articulation|soulagement/.test(text)) return "douleurs";

  if (/silhouette|taille|courbe|hanche|fessier|posture|forme/.test(text)) return "silhouette";
  if (/tonus|tonicite|rafferm|activation|maintien|fermete/.test(text)) return "tonus";
  if (/force|muscle|masse|proteine|sport|entrainement|recuperation/.test(text)) return "force";
  if (/routine|habitude|discipline|constance|programme|rituel|mouvement/.test(text)) return "routine";
  return "";
}

function mtStrictFilterValue(item, chip) {
  if (!chip || !chip.field) return "";
  if (chip.field === "meal_type") return mtInferRecipeMealType(item);
  if (chip.field === "filter_key") return mtInferProtocolFilterKey(item);
  return mtNormalizeFilterValue(item?.[chip.field]);
}


function mtPremiumChipFilter(idPrefix, chips = []) {
  const chipHTML = chips.map((chip, idx) => `
    <button type="button" class="mt-filter-pill ${idx === 0 ? "is-active" : ""}" data-filter-key="${escapeHTML(chip.key)}">
      <span>${escapeHTML(chip.label)}</span>
      ${chip.sub ? `<small>${escapeHTML(chip.sub)}</small>` : ""}
    </button>
  `).join("");

  return `<section class="mt-premium-filter-zone reveal" data-premium-filter="${escapeHTML(idPrefix)}">
    <div class="mt-filter-inner" id="${escapeHTML(idPrefix)}Filters">${chipHTML}</div>
  </section>`;
}

function mtChipText(item) {
  return [
    item?.title,
    item?.subtitle,
    item?.short_description,
    item?.description,
    item?.lead,
    item?.content,
    item?.content_text,
    item?.full_content,
    item?.category,
    item?.mood,
    item?.tags,
    item?.benefits,
    item?.duration_label,
    item?.emoji
  ].flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean).join(" ").toLowerCase();
}

function mtItemMatchesPremiumChip(item, chip) {
  if (!chip || chip.key === "all") return true;

  if (chip.field) {
    const strict = mtStrictFilterValue(item, chip);
    const expected = mtNormalizeFilterValue(chip.value || chip.key);
    return strict === expected;
  }

  const text = mtChipText(item);
  const words = (chip.words && chip.words.length ? chip.words : [chip.key]).map(w => String(w).toLowerCase());
  return words.some(w => text.includes(w));
}

function mtApplyPremiumChipFilter({ items, filterId, targetId, render, chips = [], emptyHTML }) {
  const box = document.getElementById(filterId);
  const target = document.getElementById(targetId);
  if (!target) return;

  let active = chips[0] || { key: "all" };

  function draw() {
    const list = items.filter(item => mtItemMatchesPremiumChip(item, active));
    target.innerHTML = list.map(render).join("") || emptyHTML || `<div class="empty-card"><h2>Aucun résultat</h2><p>Essaie un autre filtre.</p></div>`;
    observeReveal();
  }

  box?.querySelectorAll("[data-filter-key]").forEach(btn => {
    btn.addEventListener("click", () => {
      box.querySelectorAll("[data-filter-key]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const key = btn.getAttribute("data-filter-key");
      active = chips.find(c => c.key === key) || chips[0] || { key: "all" };
      draw();
    });
  });

  draw();
}




/* V223 — rendu réel sans placeholder : prépare les vraies images hors écran
   puis affiche la carte complète en une seule fois. */
async function mtWaitForRealImagesFromHTML(html, limit = 3, timeoutMs = 2800) {
  const box = document.createElement("div");
  box.innerHTML = String(html || "");
  const urls = [...box.querySelectorAll("img[src]")]
    .map(img => img.getAttribute("src"))
    .filter(Boolean)
    .slice(0, Math.max(0, limit));
  if (!urls.length) return;

  await Promise.all(urls.map((url, index) => new Promise(resolve => {
    const image = new Image();
    image.decoding = "async";
    if (index < 2) image.fetchPriority = "high";
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const timer = setTimeout(finish, timeoutMs);
    image.onload = async () => {
      try { if (image.decode) await image.decode(); } catch (_) {}
      clearTimeout(timer);
      finish();
    };
    image.onerror = () => { clearTimeout(timer); finish(); };
    image.src = url;
    if (image.complete) image.onload();
  })));
}

async function mtCommitRealMarkup(target, html, options = {}) {
  if (!target) return;
  await mtWaitForRealImagesFromHTML(html, options.imageLimit ?? 3, options.timeoutMs ?? 2800);
  target.innerHTML = html;
}

function mtIsFreeIntroProtocol(protocol){
  return !!protocol && String(protocol.slug||'')==='premiers-pas-la-methode-tee';
}

function protocolCard(protocol, owned = false) {
  const id = protocol.id || protocol.slug;
  const image = protocol.image_url
    ? `<img src="${escapeHTML(protocol.image_url)}" alt="" loading="eager" decoding="async" fetchpriority="high">`
    : "";
  const isFree = mtIsFreeIntroProtocol(protocol);
  const isGardenReward = !!protocol.garden_exclusive;
  const available = owned || isFree;
  const duration = escapeHTML(protocol.duration_label || "Accès privé");
  const meta = available
    ? `<div class="protocol-meta unlocked-meta"><span class="duration-pill">${isFree ? "Gratuit" : "Disponible"}</span><span class="duration-pill">${duration}</span></div>`
    : `<div class="protocol-meta"><span class="price-pill">${euros(protocol.price_cents || 500)}</span><span class="duration-pill">${duration}</span></div>`;

  return `<article class="protocol-card ${available ? "unlocked" : "locked"} reveal">
    <div class="protocol-hero ${available ? "" : "is-locked"}">${image}</div>
    <div class="protocol-head">
      <div class="protocol-mini"><span class="avatar">${mtIconHTML(protocol.icon_key || protocol.category || protocol.emoji || "leaf", "protocol-mini-icon")}</span><div><small>${escapeHTML(protocol.subtitle || "Protocole")}</small></div></div>
      <span class="tag">${isGardenReward&&owned ? "✶ Récolte du Jardin" : (isFree ? "Gratuit" : (owned ? "Disponible" : "Payant"))}</span>
    </div>
    <h2>${escapeHTML(protocol.title)}</h2>
    <p>${escapeHTML(protocol.short_description || "")}</p>
    ${meta}
    <button class="main-cta" onclick="${available ? `location.href='protocol-journey.html?id=${id}'` : `startPaymentLink('${id}')`}">${available ? (isFree ? "Commencer gratuitement" : "Ouvrir le protocole") : "Débloquer ce protocole"}</button>
  </article>`;
}
async function renderProtocolsPage() {
  const el = document.getElementById("protocolGrid");
  if (!el) return;
  const category = getParam("category") || "pharmacie_vegetale";

  const PAGE_META = {
    pharmacie_vegetale: {
      kicker: 'Protocoles payants',
      title: 'Pharmacopée<br><em>végétale</em>',
      lead: 'Cartes privées pour besoins ciblés, routines, protocoles, fichiers et accompagnement du terrain.',
      chips: [
        { key:'all', label:'Tout', sub:'Tous' },
        { key:'digestion', field:'filter_key', label:'Digestion', sub:'Confort', words:['digestion','ventre','ballonnement','ballonnements','transit','intestin','intestinal','lourdeur','lourdeurs','mal au ventre','foie','confort digestif'] },
        { key:'sommeil', field:'filter_key', label:'Sommeil', sub:'Apaisement', words:['sommeil','endormissement','nuit','dormir','réveil','réveils','calme','apaisement','relaxation','passiflore','camomille','verveine'] },
        { key:'drainage', field:'filter_key', label:'Drainage', sub:'Élimination', words:['drainage','élimination','elimination','rétention','retention','eau','gonflement','jambes lourdes','queues de cerise','ortie','détox','detox','toxines','foie'] },
        { key:'energie', field:'filter_key', label:'Énergie', sub:'Vitalité', words:['énergie','energie','fatigue','vitalité','tonus','boost','concentration','maté','matcha','moringa'] },
        { key:'cycle', field:'filter_key', label:'Cycle', sub:'Rythme hormonal', words:['cycle','règles','regles','menstrues','menstruel','menstruation','hormone','hormonal','spm','douleur menstruelle','framboisier','khamaré','femme'] },
        { key:'douleurs', field:'filter_key', label:'Douleurs', sub:'Soulagement', words:['douleur','douleurs','migraine','migraines','crampe','crampes','tension','inflammation','articulation','règles douloureuses','soulagement','reine des prés'] }
      ]
    },
    objectifs_corps: {
      kicker: 'Protocoles corps',
      title: 'Objectifs<br><em>physiques</em>',
      lead: 'Programmes ciblés pour accompagner ta silhouette et ton bien-être physique, avec une approche douce, progressive et personnalisée.',
      chips: [
        { key:'all', label:'Tout', sub:'Tous' },
        { key:'silhouette', field:'filter_key', label:'Silhouette', sub:'Courbe', words:['silhouette','ligne','taille','corps','forme','formes','courbe','courbes','hanches','fessiers','posture','harmonie'] },
        { key:'tonus', field:'filter_key', label:'Tonus', sub:'Activation', words:['tonus','tonicité','tonicite','raffermir','raffermissement','activation','maintien','fermeté','fermete'] },
        { key:'force', field:'filter_key', label:'Force', sub:'Muscles', words:['force','muscle','muscles','puissance','protéine','proteine','masse','sport','récupération musculaire','entrainement','entraînement'] },
        { key:'routine', field:'filter_key', label:'Routine', sub:'Constance', words:['routine','habitude','habitudes','discipline','constance','programme','jour','rituel','marche','mouvement'] }
      ]
    }
  };

  // La structure visible est installée avant toute attente réseau.
  const meta = PAGE_META[category] || PAGE_META.pharmacie_vegetale;
  const kEl = document.getElementById('pageKicker');
  const tEl = document.getElementById('pageTitle');
  const lEl = document.getElementById('pageLead');
  if (kEl) kEl.textContent = meta.kicker;
  if (tEl) tEl.innerHTML = meta.title;
  if (lEl) lEl.textContent = meta.lead;

  let filterMount = document.querySelector(".mt-protocol-filter-mount");
  if (!filterMount) {
    filterMount = document.createElement("div");
    filterMount.className = "mt-protocol-filter-mount";
    el.parentNode.insertBefore(filterMount, el);
  }
  filterMount.innerHTML = mtPremiumChipFilter("protocol", meta.chips);

  const user = await mtRequireUser();
  if (!user) return;

  // Les contenus et les accès sont indépendants : ils chargent ensemble.
  const [protocols, owned] = await Promise.all([
    fetchProtocols(category),
    fetchOwnedIds()
  ]);

  const ownedSetForGarden=new Set((owned||[]).map(String));
  const visibleProtocols=protocols.filter(p=>!p.garden_exclusive||ownedSetForGarden.has(String(p.id))||ownedSetForGarden.has(String(p.slug)));
  const firstMarkup = visibleProtocols.map(p => protocolCard(p, owned.includes(p.id) || owned.includes(p.slug))).join("") ||
    `<div class="empty-card"><h2>Aucun protocole trouvé</h2><p>Essaie un autre filtre.</p></div>`;

  // Les cartes apparaissent dès que les données sont prêtes. Les images chargent
  // ensuite naturellement dans leurs balises, sans bloquer toute la grille.
  el.innerHTML = firstMarkup;

  mtApplyPremiumChipFilter({
    items: visibleProtocols,
    filterId: "protocolFilters",
    targetId: "protocolGrid",
    chips: meta.chips,
    render: (p) => protocolCard(p, owned.includes(p.id) || owned.includes(p.slug)),
    emptyHTML: `<div class="empty-card"><h2>Aucun protocole trouvé</h2><p>Essaie un autre filtre.</p></div>`
  });
  observeReveal();
}

async function renderProtocolDetail() {
  const el = document.getElementById("protocolDetail");
  if (!el) return;
  const user = await mtRequireUser();
  if (!user) return;
  const id = getParam("id");
  const owned = await fetchOwnedIds();
  const protocols = await fetchProtocols();
  const protocol = protocols.find(p => p.id === id || p.slug === id);
  if (!protocol) { el.innerHTML = `<div class="empty-card"><h2>Protocole introuvable</h2></div>`; return; }
  if (!mtIsFreeIntroProtocol(protocol) && !owned.includes(protocol.id) && !owned.includes(protocol.slug) && !(typeof mtHasFullPreviewAccess === "function" ? await mtHasFullPreviewAccess() : await mtIsAdmin())) {
    el.innerHTML = `<div class="empty-card"><h2>Accès verrouillé</h2><p>Ce protocole est débloqué après paiement et validation.</p><button class="main-cta" onclick="startPaymentLink('${protocol.id || protocol.slug}')">Débloquer</button></div>`;
    return;
  }
  const client = initSupabase();
  let contents = [];
  if (client && protocol?.id) {
    const { data } = await client.from("protocol_contents").select("*").eq("protocol_id", protocol.id).eq("active", true).order("sort_order", { ascending: true });
    contents = data || [];
  }
  el.innerHTML = `<div class="kicker">Protocole privé</div>
    <h1 class="page-title">${escapeHTML(protocol.title)}<br><em>${escapeHTML(protocol.duration_label || "")}</em></h1>
    <p class="lead">${escapeHTML(protocol.long_description || protocol.short_description || "")}</p>
    <section class="content-list">
      ${contents.map(c => {
        const file = c.public_url || c.file_url || c.video_url || "";
        return `<article class="content-card reveal">
          <span>${mtIconHTML(c.type === "video" ? "sparkle" : c.type === "tracker" ? "chart" : c.type === "calendar" ? "calendar" : "book", "content-type-icon")}</span>
          <h2>${escapeHTML(c.title)}</h2>
          <p>${escapeHTML(c.description || c.content_text || "")}</p>
          ${file ? `<button class="download-link as-button" onclick="openSignedProtocolFile(\'${c.id}\')">${c.type === "video" ? "Ouvrir la vidéo" : "Télécharger / ouvrir"}</button>` : ""}
        </article>`;
      }).join("") || `<article class="content-card"><span>◇</span><h2>Contenu momentanément indisponible</h2><p>Cette rubrique ne contient aucun élément accessible pour le moment.</p></article>`}
    </section>`;
  observeReveal();
}

async function fetchCustomPage(slug) {
  const client = initSupabase();
  if (client) {
    const { data } = await client.from("app_pages").select("*").eq("slug", slug).maybeSingle();
    if (data) {
      const { data: sections } = await client.from("page_sections").select("*").eq("page_id", data.id).eq("active", true).order("sort_order", { ascending: true });
      data.sections = sections || [];
      return data;
    }
  }
  const page = (window.MT_DEFAULT_PAGES || []).find(p => p.slug === slug);
  return page ? { ...page, sections: (window.MT_DEFAULT_SECTIONS || {})[slug] || [] } : null;
}
async function renderCustomPage() {
  const el = document.getElementById("customPage");
  if (!el) return;
  const slug = getParam("slug");
  if (slug === "recettes" && typeof renderRecipesMarketplace === "function") {
    await renderRecipesMarketplace();
    return;
  }
  const user = await mtRequireUser();
  if (!user) return;
  const page = await fetchCustomPage(slug);
  if (!page) { el.innerHTML = `<div class="empty-card"><h2>Page introuvable</h2></div>`; return; }
  const sections = page.sections || [];
  el.innerHTML = `<div class="kicker">${escapeHTML(page.emoji || "✦")} Espace privé</div>
    <h1 class="page-title">${escapeHTML(page.label || page.title || "Page")}<br><em>Méthode Tee</em></h1>
    <p class="lead">${escapeHTML(page.description || "Contenus privés, conseils, recettes, routines et ressources Méthode Tee.")}</p>
    ${sections.map(renderSection).join("") || `<div class="empty-card"><h2>Contenu momentanément indisponible</h2><p>Cette rubrique ne contient aucun élément accessible pour le moment.</p></div>`}`;
  observeReveal();
}
function renderSection(s) {
  let payload = s.payload || {};
  if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch(e) { payload = {}; } }
  const items = payload.items || [];
  if (s.type === "text") {
    return `<section class="page-section reveal"><div class="kicker">${escapeHTML(s.kicker || "")}</div><h2>${escapeHTML(s.title || "")}</h2><p>${escapeHTML(payload.text || s.intro || "")}</p></section>`;
  }
  if (s.type === "cards") {
    return `<section class="page-section reveal"><div class="kicker">${escapeHTML(s.kicker || "")}</div><h2>${escapeHTML(s.title || "")}</h2><p>${escapeHTML(s.intro || "")}</p><div class="mini-grid">${items.map(i => `<article class="mini-editorial-card"><b>${escapeHTML(i.emoji || "✦")}</b><h3>${escapeHTML(i.title || "")}</h3><p>${escapeHTML(i.text || "")}</p></article>`).join("")}</div></section>`;
  }
  if (s.type === "feed") {
    return `<section class="page-section reveal"><div class="kicker">${escapeHTML(s.kicker || "")}</div><h2>${escapeHTML(s.title || "")}</h2><p>${escapeHTML(s.intro || "")}</p><div class="feed-list">${items.map(i => postCard({ title:i.title, content:i.text, type:i.type || "Contenu", created_at:i.date || new Date().toISOString(), media_urls:i.media_urls || [] })).join("")}</div></section>`;
  }
  return `<section class="page-section reveal"><h2>${escapeHTML(s.title || "Rubrique")}</h2><p>${escapeHTML(s.intro || "")}</p></section>`;
}


function mtProtocolCategoryLabel(cat) {
  const c = String(cat || "").toLowerCase();
  if (c.includes("objectif")) return "Objectifs";
  if (c.includes("pharmacie")) return "Pharmacopée";
  return "Protocole";
}
function mtUnlockedProtocolCardHTML(protocol) {
  const id = escapeHTML(protocol.id || protocol.slug || "");
  const label = escapeHTML(protocol.garden_exclusive ? '✶ Récolte du Jardin' : mtProtocolCategoryLabel(protocol.category));
  const title = escapeHTML(protocol.title || "Protocole débloqué");
  const text = escapeHTML(mtShortSaved(protocol.short_description || protocol.description || protocol.long_description || "", 145));
  const duration = escapeHTML(protocol.duration_label || "Accès privé");
  const iconKey = protocol.icon_key || protocol.type || protocol.category || "book";

  return `<article class="saved-editorial-card unlocked-protocol-card" onclick="location.href='protocol-journey.html?id=${id}'">
    <div class="saved-editorial-top"><span class="saved-editorial-icon">${mtIconHTML(iconKey, "saved-editorial-line-icon")}</span><small>${label}</small></div>
    <h4>${title}</h4>
    ${text ? `<p>${text}</p>` : ""}
    <div class="saved-editorial-foot"><span>${duration}</span><b>Ouvrir →</b></div>
  </article>`;
}

window.mtOpenUnlockedProtocols = async function() {
  const user = await mtRequireUser();
  if (!user) return;

  let modal = document.getElementById("ritualSignalDrawer");
  if(!modal){
    modal = document.createElement("div");
    modal.id = "ritualSignalDrawer";
    modal.className = "ritual-signal-drawer";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseUnlockedProtocols()"></div>
    <div class="ritual-signal-sheet saved-sheet saved-library-sheet">
      <div class="ritual-signal-grip"></div>
      <button class="ritual-signal-close" onclick="mtCloseUnlockedProtocols()">×</button>
      <div class="ritual-signal-icon">${mtIconHTML("book", "drawer-title-icon")}</div>
      <div class="ritual-signal-kicker">Espace personnel</div>
      <h3>Protocoles débloqués</h3>
      <p class="saved-library-intro">Tes parcours achetés et accessibles, rangés dans ton espace privé.</p>
      <div id="unlockedProtocolsBody">
        <div class="saved-empty"><b>${mtIconHTML("book", "empty-icon")}</b><h4>Chargement…</h4><p>On prépare tes protocoles débloqués.</p></div>
      </div>
    </div>`;

  modal.classList.add("open");

  const [ownedIds, allProtocols] = await Promise.all([fetchOwnedIds(), fetchProtocols()]);
  const ownedSet = new Set((ownedIds || []).map(String));
  const protocols = (allProtocols || []).filter(p => ownedSet.has(String(p.id)) || ownedSet.has(String(p.slug)));

  const body = document.getElementById("unlockedProtocolsBody");
  if (!body) return;

  body.innerHTML = protocols.length
    ? `<div class="saved-library-head">
        <div class="saved-library-count">${protocols.length} protocole${protocols.length > 1 ? "s" : ""}</div>
      </div>
      <div class="saved-editorial-list">
        ${protocols.map(mtUnlockedProtocolCardHTML).join("")}
      </div>`
    : `<div class="saved-empty"><b>${mtIconHTML("book", "empty-icon")}</b><h4>Aucun protocole débloqué</h4><p>Les protocoles achetés apparaîtront ici automatiquement.</p></div>`;
};

window.mtCloseUnlockedProtocols = function() {
  const modal = document.getElementById("ritualSignalDrawer");
  if (modal) modal.classList.remove("open");
};



function mtSavedKey(userId) {
  return `mt_saved_space_${userId || "guest"}`;
}
function mtReadSavedLocal(userId) {
  try {
    const raw = localStorage.getItem(mtSavedKey(userId));
    const parsed = raw ? JSON.parse(raw) : { favorites: [], routines: [] };
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      // V372 garde ce bucket uniquement pour migrer les anciennes données.
      routines: Array.isArray(parsed.routines) ? parsed.routines : []
    };
  } catch(e) { return { favorites: [], routines: [] }; }
}
function mtWriteSavedLocal(userId, data) {
  localStorage.setItem(mtSavedKey(userId), JSON.stringify({
    favorites: data.favorites || [],
    routines: data.routines || []
  }));
}
function mtSavedItemFromCard(card) {
  return {
    id: card?.dataset?.postId || card?.id || `post-${Date.now()}`,
    item_ref: card?.dataset?.postId || card?.id || "",
    source: "feed_post",
    title: card?.dataset?.postTitle || card?.querySelector("h2")?.textContent?.trim() || "Post Méthode Tee",
    content: card?.dataset?.postContent || card?.querySelector("p")?.textContent?.trim() || "",
    type: card?.dataset?.postType || card?.querySelector(".tag")?.textContent?.trim() || "Journal",
    created_at: card?.dataset?.postDate || new Date().toISOString(),
    saved_at: new Date().toISOString()
  };
}
async function mtRequireAuthForSave() {
  const user = await mtGetUser();
  if (user) return user;
  if (window.mtToast) mtToast("Connecte-toi pour sauvegarder dans ton espace personnel.", "error");
  setTimeout(() => { location.href = "auth.html"; }, 650);
  return null;
}
function mtFavoriteCompositeId(item){
  return String(item?.id || item?.item_ref || item?.recipe_id || "").trim();
}
function mtFavoriteItemType(item){
  const raw=String(item?.favorite_type || item?.type || "contenu").trim().toLowerCase();
  return raw || "contenu";
}
async function mtFavoriteSyncUpsert(user,item){
  try{
    const c=initSupabase&&initSupabase();
    if(!c||!user||!item)return false;
    const itemId=mtFavoriteCompositeId(item);
    if(!itemId)return false;
    const payload={...item};
    const {error}=await c.from("user_favorites").upsert({
      user_id:user.id,
      item_type:mtFavoriteItemType(item),
      item_id:itemId,
      title:item.title||null,
      description:item.content||item.description||null,
      source:item.source||null,
      payload,
      updated_at:new Date().toISOString()
    },{onConflict:"user_id,item_type,item_id"});
    if(error)throw error;
    return true;
  }catch(e){
    console.warn("favorite sync upsert",e);
    return false;
  }
}
async function mtFavoriteSyncDelete(user,item){
  try{
    const c=initSupabase&&initSupabase();
    if(!c||!user||!item)return false;
    const itemId=mtFavoriteCompositeId(item);
    if(!itemId)return false;
    const {error}=await c.from("user_favorites")
      .delete()
      .eq("user_id",user.id)
      .eq("item_type",mtFavoriteItemType(item))
      .eq("item_id",itemId);
    if(error)throw error;
    return true;
  }catch(e){
    console.warn("favorite sync delete",e);
    return false;
  }
}
function mtFavoriteLocalToggle(userId,item,forceState){
  const data=mtReadSavedLocal(userId);
  const id=mtFavoriteCompositeId(item);
  const type=mtFavoriteItemType(item);
  const exists=(data.favorites||[]).some(x=>mtFavoriteCompositeId(x)===id&&mtFavoriteItemType(x)===type);
  const shouldAdd=forceState===undefined?!exists:!!forceState;
  data.favorites=shouldAdd
    ? [{...item,id:item.id||id,saved_at:item.saved_at||new Date().toISOString()},...(data.favorites||[]).filter(x=>!(mtFavoriteCompositeId(x)===id&&mtFavoriteItemType(x)===type))]
    : (data.favorites||[]).filter(x=>!(mtFavoriteCompositeId(x)===id&&mtFavoriteItemType(x)===type));
  mtWriteSavedLocal(userId,data);
  return {added:shouldAdd,item:{...item,id:item.id||id},data};
}
window.mtFavoriteToggleItem=async function(item,btn){
  const user=await mtRequireAuthForSave();
  if(!user||!item)return false;
  const result=mtFavoriteLocalToggle(user.id,item);
  if(btn){
    btn.classList.toggle("is-saved",result.added);
    btn.innerHTML=result.added?"♥ Favori":"♡ Favori";
    btn.setAttribute("aria-label",result.added?"Retirer des favoris":"Ajouter aux favoris");
  }
  if(window.mtToast)mtToast(result.added?"Ajouté à Mes favoris":"Retiré de Mes favoris");
  if(result.added)mtFavoriteSyncUpsert(user,result.item);
  else mtFavoriteSyncDelete(user,result.item);
  window.mtRefreshSavedButtons&&window.mtRefreshSavedButtons();
  return result.added;
};
async function mtSyncFavoritesFromCloud(user){
  if(!user)return mtReadSavedLocal("guest").favorites||[];
  const local=mtReadSavedLocal(user.id);
  const seedKey=`mt_favorites_cloud_seed_v372_${user.id}`;
  try{
    const c=initSupabase&&initSupabase();
    if(!c)return local.favorites||[];

    // Première ouverture V372 : on pousse une seule fois les favoris locaux
    // existants vers Supabase avant de laisser le cloud devenir la référence.
    if(!localStorage.getItem(seedKey)){
      const legacy=local.favorites||[];
      let seedOK=true;
      for(const item of legacy){
        const ok=await mtFavoriteSyncUpsert(user,item);
        if(!ok)seedOK=false;
      }
      if(seedOK)localStorage.setItem(seedKey,"1");
    }

    const {data,error}=await c.from("user_favorites")
      .select("item_type,item_id,title,description,source,payload,created_at,updated_at")
      .eq("user_id",user.id)
      .order("updated_at",{ascending:false});
    if(error)throw error;

    const localByKey=new Map((local.favorites||[]).map(item=>[
      `${mtFavoriteItemType(item)}::${mtFavoriteCompositeId(item)}`,item
    ]));
    const remoteItems=(data||[]).map(row=>{
      const key=`${String(row.item_type||"contenu").toLowerCase()}::${String(row.item_id||"")}`;
      const previous=localByKey.get(key)||{};
      const payload=row.payload&&typeof row.payload==="object"?row.payload:{};
      return {
        ...previous,
        ...payload,
        id:payload.id||row.item_id,
        title:payload.title||row.title||previous.title||"Contenu sauvegardé",
        content:payload.content||payload.description||row.description||previous.content||"",
        type:payload.type||row.item_type||previous.type||"Contenu",
        source:payload.source||row.source||previous.source||"favorite_cloud",
        saved_at:payload.saved_at||row.updated_at||row.created_at||previous.saved_at
      };
    });

    // Après la migration initiale, Supabase est la référence : une suppression
    // faite sur un autre appareil ne réapparaît donc pas depuis un vieux cache.
    if(localStorage.getItem(seedKey)){
      local.favorites=remoteItems;
      mtWriteSavedLocal(user.id,local);
    }
    return local.favorites||[];
  }catch(e){
    console.warn("favorites cloud merge",e);
    return local.favorites||[];
  }
}
window.mtRemoveFavorite=async function(id,type){
  const user=await mtRequireAuthForSave();
  if(!user)return;
  const data=mtReadSavedLocal(user.id);
  const item=(data.favorites||[]).find(x=>mtFavoriteCompositeId(x)===String(id)&&(!type||mtFavoriteItemType(x)===String(type).toLowerCase()));
  if(!item)return;
  mtFavoriteLocalToggle(user.id,item,false);
  mtFavoriteSyncDelete(user,item);
  mtRenderSavedCollectionContent();
  window.mtRefreshSavedButtons&&window.mtRefreshSavedButtons();
  if(window.mtToast)mtToast("Retiré de Mes favoris");
};

window.mtTogglePostSave = async function(kind, btn) {
  const user = await mtRequireAuthForSave();
  if (!user) return;
  const card = btn?.closest?.(".post-card");
  if (!card) return;
  const item = mtSavedItemFromCard(card);
  if(kind==="routine"){
    return window.mtOpenRoutinePickerCandidate?.({
      source_type:"feed_post",
      source_id:item.id,
      title:item.title,
      description:item.content,
      steps:[item.title]
    });
  }
  return window.mtFavoriteToggleItem(item,btn);
};

window.mtSavedCollectionState = window.mtSavedCollectionState || { bucket:'favorites',filter:'all',sort:'recent',query:'' };
function mtSavedLabelFor() {
  return {
    title:"Mes favoris",
    icon:mtIconHTML("sparkle","drawer-title-icon"),
    empty:"Aucun favori encore. Ajoute ce que tu veux retrouver rapidement depuis le Feed, les recettes ou ta Bibliothèque."
  };
}
function mtSavedTypes(items) {
  const list = [...new Set((items || []).map(x => String(x.type || "Contenu").trim()).filter(Boolean))];
  return ["all", ...list.slice(0, 12)];
}
function mtSavedFilteredItems(items, state) {
  let out = Array.isArray(items) ? [...items] : [];
  if (state.filter && state.filter !== "all") out = out.filter(x => String(x.type || "Contenu") === state.filter);
  const q = String(state.query || "").trim().toLowerCase();
  if (q) out = out.filter(x => `${x.title || ""} ${x.content || x.description || ""} ${x.type || ""}`.toLowerCase().includes(q));
  out.sort((a,b) => {
    const da = new Date(a.saved_at || a.created_at || 0).getTime();
    const db = new Date(b.saved_at || b.created_at || 0).getTime();
    return state.sort === "old" ? da - db : db - da;
  });
  return out;
}
function mtSavedCardHTML(it) {
  const type = escapeHTML(it.type || "Contenu");
  const title = escapeHTML(it.title || "Contenu sauvegardé");
  const text = escapeHTML(mtShortSaved(it.content || it.description || "", 150));
  const date = it.saved_at ? fmtDate(it.saved_at) : "Sauvegardé";
  const iconKey = type.toLowerCase().includes("recette") ? "bowl" : type.toLowerCase().includes("routine") ? "leaf" : type.toLowerCase().includes("audio") ? "bell" : type.toLowerCase().includes("hydratation") ? "drop" : "sparkle";
  const id=escapeHTML(mtFavoriteCompositeId(it));
  const favoriteType=escapeHTML(mtFavoriteItemType(it));
  return `<article class="saved-editorial-card" onclick="mtOpenSavedDetail('${id}')">
    <div class="saved-editorial-top"><span class="saved-editorial-icon">${mtIconHTML(iconKey,"saved-editorial-line-icon")}</span><small>${type}</small><button type="button" class="saved-favorite-remove" onclick="event.stopPropagation();mtRemoveFavorite('${id}','${favoriteType}')" aria-label="Retirer des favoris">♥</button></div>
    <h4>${title}</h4>
    ${text?`<p>${text}</p>`:""}
    <div class="saved-editorial-foot"><span>${escapeHTML(date)}</span><b>Ouvrir →</b></div>
  </article>`;
}
function mtRenderSavedCollectionContent() {
  const userId=window.mtSavedCollectionUserId;
  const state=window.mtSavedCollectionState||{bucket:'favorites',filter:'all',sort:'recent',query:''};
  const data=mtReadSavedLocal(userId);
  const items=data.favorites||[];
  const meta=mtSavedLabelFor();
  const filtered=mtSavedFilteredItems(items,state);
  const types=mtSavedTypes(items);
  const target=document.getElementById("savedCollectionBody");
  if(!target)return;
  target.innerHTML=`
    <div class="saved-library-head">
      <div class="saved-library-count">${items.length} contenu${items.length>1?"s":""}</div>
      <div class="saved-library-meaning">Favori = je veux le retrouver.</div>
    </div>
    <div class="saved-library-tools">
      <input type="search" placeholder="Rechercher…" value="${escapeHTML(state.query||"")}" oninput="mtSetSavedQuery(this.value)">
      <select onchange="mtSetSavedSort(this.value)">
        <option value="recent" ${state.sort!=="old"?"selected":""}>Plus récent</option>
        <option value="old" ${state.sort==="old"?"selected":""}>Plus ancien</option>
      </select>
    </div>
    <div class="saved-library-filters">
      ${types.map(t=>`<button class="${state.filter===t?"active":""}" onclick="mtSetSavedFilter('${escapeHTML(t)}')">${t==="all"?"Tout":escapeHTML(t)}</button>`).join("")}
    </div>
    ${filtered.length?`<div class="saved-editorial-list">${filtered.map(mtSavedCardHTML).join("")}</div>`:`<div class="saved-empty"><b>${meta.icon}</b><h4>${meta.title}</h4><p>${items.length?"Aucun contenu ne correspond à cette recherche.":meta.empty}</p></div>`}
  `;
}
window.mtSetSavedFilter=function(filter){window.mtSavedCollectionState.filter=filter;mtRenderSavedCollectionContent();};
window.mtSetSavedSort=function(sort){window.mtSavedCollectionState.sort=sort;mtRenderSavedCollectionContent();};
window.mtSetSavedQuery=function(query){window.mtSavedCollectionState.query=query;mtRenderSavedCollectionContent();};
window.mtOpenSavedDetail=async function(id){
  if(!id)return;
  const userId=window.mtSavedCollectionUserId;
  const data=mtReadSavedLocal(userId);
  const it=(data.favorites||[]).find(x=>mtFavoriteCompositeId(x)===String(id));
  if(!it)return;

  if(it.source==="recipe_favorite"&&it.recipe_id&&typeof openRecipeViewer==="function"){
    try{
      const recipes=await mtFetchRecipes();
      const recipe=(recipes||[]).find(r=>String(r.id)===String(it.recipe_id));
      if(!recipe)throw new Error("Recette indisponible");
      if(recipe.is_premium){
        const purchasedIds=await mtGetPurchasedRecipeIds();
        if(!purchasedIds.map(String).includes(String(recipe.id))){
          if(window.mtToast)mtToast("Cette recette n’est plus disponible dans tes accès.","error");
          return;
        }
      }
      mtCloseSavedCollection&&mtCloseSavedCollection();
      setTimeout(()=>openRecipeViewer(it.recipe_id),120);
      return;
    }catch(e){
      if(window.mtToast)mtToast("Cette recette n’est plus disponible dans tes accès.","error");
      return;
    }
  }
  if(it.source==="library_content_favorite"){
    mtCloseSavedCollection&&mtCloseSavedCollection();
    if(typeof window.mtOpenSavedLibraryFavorite==="function"){
      return setTimeout(()=>window.mtOpenSavedLibraryFavorite(it),120);
    }
    try{localStorage.setItem(`mt_pending_library_favorite_${userId}`,JSON.stringify({id:it.item_ref||it.id,protocol_id:it.protocol_id||""}));}catch(e){}
    location.href="library.html";
    return;
  }

  const modal=document.getElementById("savedDetailPreview")||document.createElement("div");
  modal.id="savedDetailPreview";
  modal.className="saved-detail-preview open";
  modal.innerHTML=`<div class="saved-detail-backdrop" onclick="mtCloseSavedDetail()"></div>
    <article class="saved-detail-card">
      <button onclick="mtCloseSavedDetail()">×</button>
      <small>${escapeHTML(it.type||"Contenu")}</small>
      <h3>${escapeHTML(it.title||"Contenu sauvegardé")}</h3>
      <p>${escapeHTML(it.content||it.description||"")}</p>
      <div class="saved-detail-actions"><button onclick="mtCloseSavedDetail()">Fermer</button></div>
    </article>`;
  document.body.appendChild(modal);
};
window.mtCloseSavedDetail=function(){const modal=document.getElementById("savedDetailPreview");if(modal)modal.remove();};

window.mtOpenSavedCollection=async function(bucket){
  if(bucket==="routines")return window.mtOpenMyRoutines?.("profile");
  const user=await mtRequireAuthForSave();
  if(!user)return;
  window.mtSavedCollectionUserId=user.id;
  window.mtSavedCollectionState={bucket:"favorites",filter:"all",sort:"recent",query:""};
  let modal=document.getElementById("ritualSignalDrawer");
  if(!modal){modal=document.createElement("div");modal.id="ritualSignalDrawer";modal.className="ritual-signal-drawer";document.body.appendChild(modal);}
  const meta=mtSavedLabelFor();
  modal.innerHTML=`<div class="ritual-signal-backdrop" onclick="mtCloseSavedCollection()"></div>
    <div class="ritual-signal-sheet saved-sheet saved-library-sheet">
      <div class="ritual-signal-grip"></div>
      <button class="ritual-signal-close" onclick="mtCloseSavedCollection()">×</button>
      <div class="ritual-signal-icon">${meta.icon}</div>
      <div class="ritual-signal-kicker">Espace personnel</div>
      <h3>${meta.title}</h3>
      <p class="saved-library-intro">Tout ce que tu veux retrouver, sans transformer ces contenus en obligations.</p>
      <div id="savedCollectionBody"><div class="saved-empty"><b>${mtIconHTML("sparkle","empty-icon")}</b><h4>Synchronisation…</h4><p>On retrouve tes favoris.</p></div></div>
    </div>`;
  modal.classList.add("open");
  mtRenderSavedCollectionContent();
  await mtSyncFavoritesFromCloud(user);
  mtRenderSavedCollectionContent();
};
window.mtCloseSavedCollection=function(){const modal=document.getElementById("ritualSignalDrawer");if(modal)modal.classList.remove("open");};


// ── V372 — MES ROUTINES : vraies habitudes répétables ─────────────────
function mtRoutineCacheKey(userId){return `mt_user_routines_v372_${userId||"guest"}`;}
function mtRoutineEntryCacheKey(userId,date){return `mt_user_routine_entries_v372_${userId||"guest"}_${date||mtTodayISO()}`;}
function mtReadRoutineCache(userId){
  try{const data=JSON.parse(localStorage.getItem(mtRoutineCacheKey(userId))||"[]");return Array.isArray(data)?data:[];}catch(e){return [];}
}
function mtWriteRoutineCache(userId,rows){
  try{localStorage.setItem(mtRoutineCacheKey(userId),JSON.stringify(Array.isArray(rows)?rows:[]));}catch(e){}
}
function mtReadRoutineEntryCache(userId,date){
  try{return JSON.parse(localStorage.getItem(mtRoutineEntryCacheKey(userId,date))||"{}")||{};}catch(e){return {};}
}
function mtWriteRoutineEntryCache(userId,date,data){
  try{localStorage.setItem(mtRoutineEntryCacheKey(userId,date),JSON.stringify(data||{}));}catch(e){}
}
function mtRoutineSteps(routine){
  const raw=routine?.steps;
  if(Array.isArray(raw)&&raw.length)return raw.map(x=>typeof x==="string"?x:String(x?.label||x?.title||"")).filter(Boolean);
  const fallback=String(routine?.description||routine?.title||"").trim();
  return fallback?[fallback]:[];
}
function mtRoutineIsScheduled(routine,date=mtTodayISO()){
  if(!routine||String(routine.status||"active")!=="active")return false;
  const f=String(routine.frequency||"daily");
  if(f==="on_demand")return false;
  const d=new Date(`${date}T12:00:00`),isoDay=((d.getDay()+6)%7)+1;
  if(f==="daily")return true;
  if(f==="weekdays")return isoDay>=1&&isoDay<=5;
  if(f==="weekend")return isoDay>=6;
  if(f==="custom")return (Array.isArray(routine.weekdays)?routine.weekdays:[]).map(Number).includes(isoDay);
  return true;
}
function mtRoutineFrequencyLabel(routine){
  const f=String(routine?.frequency||"daily");
  if(f==="daily")return"Tous les jours";
  if(f==="weekdays")return"Du lundi au vendredi";
  if(f==="weekend")return"Le week-end";
  if(f==="on_demand")return"À la demande";
  if(f==="custom"){
    const labels=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
    return (routine.weekdays||[]).map(n=>labels[Number(n)-1]).filter(Boolean).join(" · ")||"Jours choisis";
  }
  return"Selon mon rythme";
}
function mtRoutineDaypartLabel(value){
  return ({morning:"Matin",day:"Dans la journée",evening:"Soir",any:"À tout moment"})[String(value||"morning")]||"Dans la journée";
}
function mtRoutineLocalSummary(userId,date,remoteRow){
  const remote=Array.isArray(remoteRow?.routine_today)?remoteRow.routine_today:[];
  if(remote.length){
    const total=Number(remoteRow.routine_scheduled_count||remote.length);
    const completed=Number(remoteRow.routine_completed_count||remote.filter(x=>x.completed).length);
    return {total,completed,done:total>0&&completed>=total,items:remote};
  }
  const routines=mtReadRoutineCache(userId).filter(r=>mtRoutineIsScheduled(r,date));
  const entries=mtReadRoutineEntryCache(userId,date);
  const items=routines.map(r=>({
    id:r.id,title:r.title,daypart:r.daypart,steps_count:mtRoutineSteps(r).length,completed:!!entries?.[r.id]?.completed
  }));
  const completed=items.filter(x=>x.completed).length;
  return {total:items.length,completed,done:items.length>0&&completed>=items.length,items};
}
function mtRoutineLocalCount(userId){
  return mtReadRoutineCache(userId).filter(r=>String(r.status||"active")==="active").length;
}
async function mtMigrateLegacyRoutineBucket(user){
  if(!user)return;
  const marker=`mt_routine_bucket_migrated_v372_${user.id}`;
  if(localStorage.getItem(marker))return;
  const data=mtReadSavedLocal(user.id);
  const legacy=Array.isArray(data.routines)?data.routines:[];
  if(legacy.length){
    const current=[...(data.favorites||[])];
    legacy.forEach(item=>{
      const id=mtFavoriteCompositeId(item);
      const type=mtFavoriteItemType(item);
      if(!current.some(x=>mtFavoriteCompositeId(x)===id&&mtFavoriteItemType(x)===type)){
        current.push({...item,saved_at:item.saved_at||new Date().toISOString()});
      }
    });
    data.favorites=current;
    data.routines=[];
    mtWriteSavedLocal(user.id,data);
    legacy.forEach(item=>mtFavoriteSyncUpsert(user,item));
    if(window.mtToast)mtToast("Tes anciens éléments « Routine » ont été conservés dans Mes favoris.");
  }
  localStorage.setItem(marker,"1");
}
async function mtFetchMyRoutines(user,date=mtTodayISO()){
  const local=mtReadRoutineCache(user.id);
  try{
    const c=initSupabase&&initSupabase();
    if(!c)return {routines:local,entries:mtReadRoutineEntryCache(user.id,date)};
    const [rRes,eRes]=await Promise.all([
      c.from("user_routines")
        .select("id,title,description,status,daypart,frequency,weekdays,steps,source_items,created_at,updated_at")
        .eq("user_id",user.id)
        .eq("status","active")
        .order("updated_at",{ascending:false}),
      c.from("user_routine_entries")
        .select("routine_id,entry_date,step_state,completed,completed_at,updated_at")
        .eq("user_id",user.id)
        .eq("entry_date",date)
    ]);
    const routines=!rRes.error&&Array.isArray(rRes.data)?rRes.data:local;
    const entries={...mtReadRoutineEntryCache(user.id,date)};
    (eRes.data||[]).forEach(row=>{entries[row.routine_id]=row;});
    mtWriteRoutineCache(user.id,routines);
    mtWriteRoutineEntryCache(user.id,date,entries);
    return {routines,entries};
  }catch(e){
    console.warn("my routines fetch",e);
    return {routines:local,entries:mtReadRoutineEntryCache(user.id,date)};
  }
}
function mtRoutineWorkspace(){
  let modal=document.getElementById("mtRoutineWorkspace");
  if(!modal){modal=document.createElement("div");modal.id="mtRoutineWorkspace";modal.className="routine-workspace";document.body.appendChild(modal);}
  return modal;
}
window.mtCloseMyRoutines=function(){const m=document.getElementById("mtRoutineWorkspace");if(m)m.classList.remove("open");};
function mtRoutineListCard(routine,entry,picker){
  const steps=mtRoutineSteps(routine);
  const completed=!!entry?.completed;
  return `<article class="routine-personal-card ${completed?"is-complete":""}">
    <div class="routine-personal-top"><span>${mtIconHTML("leaf","routine-card-icon")}</span><small>${escapeHTML(mtRoutineDaypartLabel(routine.daypart))} · ${escapeHTML(mtRoutineFrequencyLabel(routine))}</small></div>
    <h4>${escapeHTML(routine.title||"Ma routine")}</h4>
    ${routine.description?`<p>${escapeHTML(routine.description)}</p>`:""}
    <div class="routine-personal-meta"><span>${steps.length} étape${steps.length>1?"s":""}</span>${completed?`<b>✓ Complétée aujourd’hui</b>`:""}</div>
    <div class="routine-personal-actions">
      ${picker?`<button class="primary" onclick="mtAddCandidateToRoutine('${escapeHTML(routine.id)}')">Ajouter ici</button>`:`<button class="primary" onclick="mtOpenRoutineDay('${escapeHTML(routine.id)}')">${completed?"Revoir":"Réaliser"}</button>`}
      <button onclick="mtOpenRoutineEditor('${escapeHTML(routine.id)}')">Modifier</button>
    </div>
  </article>`;
}
async function mtRenderRoutineWorkspace(mode="profile"){
  const user=await mtRequireAuthForSave();
  if(!user)return;
  await mtMigrateLegacyRoutineBucket(user);
  const date=mtTodayISO();
  const modal=mtRoutineWorkspace();
  modal.innerHTML=`<div class="routine-workspace-backdrop" onclick="mtCloseMyRoutines()"></div><section class="routine-workspace-sheet"><div class="ritual-signal-grip"></div><button class="ritual-signal-close" onclick="mtCloseMyRoutines()">×</button><div class="ritual-signal-kicker">${mode==="picker"?"Ajouter à une routine":"Espace personnel"}</div><h3>${mode==="picker"?"Choisir une routine":"Mes routines"}</h3><p class="routine-workspace-intro">${mode==="picker"?"Choisis où intégrer ce contenu, ou crée une nouvelle routine.":"Routine = un repère que tu choisis réellement de pratiquer."}</p><div class="routine-workspace-loading">Chargement…</div></section>`;
  modal.classList.add("open");
  const result=await mtFetchMyRoutines(user,date);
  window.__MT_ROUTINES_STATE__={user,date,routines:result.routines,entries:result.entries,mode};
  const body=modal.querySelector(".routine-workspace-sheet");
  if(!body)return;
  const list=(result.routines||[]).map(r=>mtRoutineListCard(r,result.entries?.[r.id],mode==="picker")).join("");
  body.innerHTML=`<div class="ritual-signal-grip"></div><button class="ritual-signal-close" onclick="mtCloseMyRoutines()">×</button><div class="ritual-signal-kicker">${mode==="picker"?"Ajouter à une routine":"Espace personnel"}</div><h3>${mode==="picker"?"Choisir une routine":"Mes routines"}</h3><p class="routine-workspace-intro">${mode==="picker"?"Choisis où intégrer ce contenu, ou crée une nouvelle routine.":"Les repères que tu choisis de garder dans ton quotidien."}</p><div class="routine-meaning">Routine = je veux le pratiquer.</div>${list?`<div class="routine-personal-list">${list}</div>`:`<div class="saved-empty"><b>${mtIconHTML("leaf","empty-icon")}</b><h4>Aucune routine personnelle</h4><p>Crée ton premier repère : matin, soir, récupération ou à la demande.</p></div>`}<button class="routine-create-btn" onclick="mtOpenRoutineEditor('',${mode==="picker"?"true":"false"})">+ ${mode==="picker"?"Créer une routine avec ce contenu":"Créer une routine"}</button>`;
}
window.mtOpenMyRoutines=function(mode="profile"){
  return mtRenderRoutineWorkspace(mode);
};
window.mtOpenRoutinePickerCandidate=async function(candidate){
  window.__MT_ROUTINE_CANDIDATE__=candidate||null;
  return mtRenderRoutineWorkspace("picker");
};
window.mtOpenRoutineEditor=function(routineId,fromCandidate=false){
  const state=window.__MT_ROUTINES_STATE__||{};
  const routine=(state.routines||[]).find(r=>String(r.id)===String(routineId))||null;
  const candidate=(fromCandidate||(!routine&&state.mode==="picker"))?window.__MT_ROUTINE_CANDIDATE__:null;
  const modal=mtRoutineWorkspace();
  const steps=routine?mtRoutineSteps(routine):(Array.isArray(candidate?.steps)&&candidate.steps.length?candidate.steps:[candidate?.title||""]).filter(Boolean);
  const sourceItems=routine?.source_items||[];
  window.__MT_ROUTINE_EDITOR__={routine,candidate,sourceItems};
  const weekdays=Array.isArray(routine?.weekdays)?routine.weekdays.map(Number):[];
  modal.innerHTML=`<div class="routine-workspace-backdrop" onclick="mtCloseMyRoutines()"></div><section class="routine-workspace-sheet routine-editor-sheet"><div class="ritual-signal-grip"></div><button class="ritual-signal-close" onclick="mtOpenMyRoutines('${escapeHTML(state.mode||"profile")}')">‹</button><div class="ritual-signal-kicker">Mes routines</div><h3>${routine?"Modifier ma routine":"Créer une routine"}</h3><p class="routine-workspace-intro">Une routine reste simple : quelques étapes que tu peux réellement refaire.</p>
    <label class="routine-field"><span>Nom</span><input id="mtRoutineTitle" type="text" maxlength="80" value="${escapeHTML(routine?.title||candidate?.title||"")}" placeholder="Ex. Retour au calme"></label>
    <label class="routine-field"><span>Intention</span><input id="mtRoutineDescription" type="text" maxlength="180" value="${escapeHTML(routine?.description||candidate?.description||"")}" placeholder="Pourquoi je veux garder ce repère ?"></label>
    <div class="routine-field-grid">
      <label class="routine-field"><span>Moment</span><select id="mtRoutineDaypart"><option value="morning" ${String(routine?.daypart||"morning")==="morning"?"selected":""}>Matin</option><option value="day" ${routine?.daypart==="day"?"selected":""}>Dans la journée</option><option value="evening" ${routine?.daypart==="evening"?"selected":""}>Soir</option><option value="any" ${routine?.daypart==="any"?"selected":""}>À tout moment</option></select></label>
      <label class="routine-field"><span>Fréquence</span><select id="mtRoutineFrequency" onchange="mtRoutineFrequencyChanged(this.value)"><option value="daily" ${String(routine?.frequency||"daily")==="daily"?"selected":""}>Tous les jours</option><option value="weekdays" ${routine?.frequency==="weekdays"?"selected":""}>Lun → Ven</option><option value="weekend" ${routine?.frequency==="weekend"?"selected":""}>Week-end</option><option value="custom" ${routine?.frequency==="custom"?"selected":""}>Jours choisis</option><option value="on_demand" ${routine?.frequency==="on_demand"?"selected":""}>À la demande</option></select></label>
    </div>
    <div id="mtRoutineWeekdays" class="routine-weekdays ${routine?.frequency==="custom"?"":"is-hidden"}">${["L","M","M","J","V","S","D"].map((l,i)=>`<button type="button" data-day="${i+1}" class="${weekdays.includes(i+1)?"active":""}" onclick="this.classList.toggle('active')">${l}</button>`).join("")}</div>
    <label class="routine-field"><span>Étapes · une par ligne</span><textarea id="mtRoutineSteps" rows="7" placeholder="Boire un verre d’eau&#10;5 min de mobilité&#10;Respirer 2 minutes">${escapeHTML(steps.join("\n"))}</textarea></label>
    <button class="routine-save-btn" onclick="mtSaveRoutineEditor()">${routine?"Enregistrer les modifications":"Créer ma routine"}</button>
    ${routine?`<button class="routine-archive-btn" onclick="mtArchiveRoutine('${escapeHTML(routine.id)}')">Retirer cette routine</button>`:""}
  </section>`;
  modal.classList.add("open");
};
window.mtRoutineFrequencyChanged=function(value){
  document.getElementById("mtRoutineWeekdays")?.classList.toggle("is-hidden",value!=="custom");
};
function mtRoutineUUID(){
  try{return crypto.randomUUID();}catch(e){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==="x"?r:(r&3|8);return v.toString(16);});}
}
window.mtSaveRoutineEditor=async function(){
  const state=window.__MT_ROUTINES_STATE__||{};
  const user=state.user||await mtRequireAuthForSave();
  if(!user)return;
  const editor=window.__MT_ROUTINE_EDITOR__||{};
  const title=document.getElementById("mtRoutineTitle")?.value?.trim()||"";
  const description=document.getElementById("mtRoutineDescription")?.value?.trim()||"";
  const daypart=document.getElementById("mtRoutineDaypart")?.value||"morning";
  const frequency=document.getElementById("mtRoutineFrequency")?.value||"daily";
  const steps=(document.getElementById("mtRoutineSteps")?.value||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const weekdays=[...document.querySelectorAll("#mtRoutineWeekdays button.active")].map(b=>Number(b.dataset.day)).filter(Boolean);
  if(!title){if(window.mtToast)mtToast("Donne un nom à ta routine.","error");return;}
  if(!steps.length){if(window.mtToast)mtToast("Ajoute au moins une étape.","error");return;}
  if(frequency==="custom"&&!weekdays.length){if(window.mtToast)mtToast("Choisis au moins un jour.","error");return;}
  const existing=editor.routine||null;
  const candidate=editor.candidate||null;
  const id=existing?.id||mtRoutineUUID();
  const sourceItems=[...(Array.isArray(existing?.source_items)?existing.source_items:[])];
  if(candidate?.source_id&&!sourceItems.some(x=>String(x.source_id)===String(candidate.source_id))){
    sourceItems.push({source_type:candidate.source_type||"content",source_id:candidate.source_id,title:candidate.title||""});
  }
  const row={id,user_id:user.id,title,description:description||null,status:"active",daypart,frequency,weekdays,steps,source_items:sourceItems,updated_at:new Date().toISOString()};
  const cache=mtReadRoutineCache(user.id);
  const next=[row,...cache.filter(r=>String(r.id)!==String(id))];
  mtWriteRoutineCache(user.id,next);
  try{
    const c=initSupabase&&initSupabase();
    if(c){
      const {error}=await c.from("user_routines").upsert(row,{onConflict:"id"});
      if(error)throw error;
    }
    if(window.mtToast)mtToast(existing?"Routine mise à jour":"Routine créée");
  }catch(e){
    console.warn("routine save",e);
    if(window.mtToast)mtToast("Routine conservée sur cet appareil · synchronisation à réessayer.","error");
  }
  window.__MT_ROUTINE_CANDIDATE__=null;
  await mtRenderRoutineWorkspace("profile");
  try{window.__MT_TODAY_STATE__=await window.mtBuildTodayState();}catch(e){}
};
window.mtArchiveRoutine=async function(id){
  const state=window.__MT_ROUTINES_STATE__||{};
  const user=state.user||await mtRequireAuthForSave();
  if(!user||!id)return;
  if(!confirm("Retirer cette routine de Mes routines ?"))return;
  mtWriteRoutineCache(user.id,mtReadRoutineCache(user.id).filter(r=>String(r.id)!==String(id)));
  try{
    const c=initSupabase&&initSupabase();
    if(c)await c.from("user_routines").update({status:"archived",updated_at:new Date().toISOString()}).eq("id",id).eq("user_id",user.id);
  }catch(e){}
  if(window.mtToast)mtToast("Routine retirée");
  await mtRenderRoutineWorkspace("profile");
};
window.mtAddCandidateToRoutine=async function(routineId){
  const state=window.__MT_ROUTINES_STATE__||{};
  const user=state.user||await mtRequireAuthForSave();
  const candidate=window.__MT_ROUTINE_CANDIDATE__;
  const routine=(state.routines||[]).find(r=>String(r.id)===String(routineId));
  if(!user||!candidate||!routine)return;
  const additions=(Array.isArray(candidate.steps)&&candidate.steps.length?candidate.steps:[candidate.title]).map(x=>String(x||"").trim()).filter(Boolean);
  const current=mtRoutineSteps(routine);
  const steps=[...current];
  additions.forEach(step=>{if(!steps.some(x=>x.toLowerCase()===step.toLowerCase()))steps.push(step);});
  const sourceItems=[...(Array.isArray(routine.source_items)?routine.source_items:[])];
  if(candidate.source_id&&!sourceItems.some(x=>String(x.source_id)===String(candidate.source_id))){
    sourceItems.push({source_type:candidate.source_type||"content",source_id:candidate.source_id,title:candidate.title||""});
  }
  const next={...routine,steps,source_items:sourceItems,updated_at:new Date().toISOString()};
  mtWriteRoutineCache(user.id,[next,...mtReadRoutineCache(user.id).filter(r=>String(r.id)!==String(routine.id))]);
  try{
    const c=initSupabase&&initSupabase();
    if(c){
      const {error}=await c.from("user_routines").update({steps,source_items:sourceItems,updated_at:new Date().toISOString()}).eq("id",routine.id).eq("user_id",user.id);
      if(error)throw error;
    }
    if(window.mtToast)mtToast("Ajouté à ta routine");
  }catch(e){if(window.mtToast)mtToast("Ajouté sur cet appareil · synchronisation à réessayer.","error");}
  window.__MT_ROUTINE_CANDIDATE__=null;
  await mtRenderRoutineWorkspace("profile");
};
window.mtOpenRoutineDay=async function(routineId){
  const state=window.__MT_ROUTINES_STATE__||{};
  const user=state.user||await mtRequireAuthForSave();
  if(!user)return;
  let routine=(state.routines||[]).find(r=>String(r.id)===String(routineId));
  if(!routine){
    const fetched=await mtFetchMyRoutines(user,mtTodayISO());
    routine=(fetched.routines||[]).find(r=>String(r.id)===String(routineId));
    window.__MT_ROUTINES_STATE__={...state,user,routines:fetched.routines,entries:fetched.entries,date:mtTodayISO()};
  }
  if(!routine)return;
  const date=state.date||mtTodayISO(),entries=window.__MT_ROUTINES_STATE__?.entries||mtReadRoutineEntryCache(user.id,date);
  const entry=entries?.[routine.id]||{};
  const stepState=entry.step_state&&typeof entry.step_state==="object"?entry.step_state:{};
  const steps=mtRoutineSteps(routine);
  const modal=mtRoutineWorkspace();
  modal.innerHTML=`<div class="routine-workspace-backdrop" onclick="mtCloseMyRoutines()"></div><section class="routine-workspace-sheet routine-day-sheet"><div class="ritual-signal-grip"></div><button class="ritual-signal-close" onclick="mtOpenMyRoutines('${escapeHTML(state.mode||"profile")}')">‹</button><div class="ritual-signal-kicker">${escapeHTML(mtRoutineDaypartLabel(routine.daypart))}</div><h3>${escapeHTML(routine.title)}</h3><p class="routine-workspace-intro">${escapeHTML(routine.description||mtRoutineFrequencyLabel(routine))}</p><div class="routine-step-list">${steps.map((step,i)=>`<label class="routine-step ${stepState[String(i)]?"is-done":""}"><input type="checkbox" data-step="${i}" ${stepState[String(i)]?"checked":""} onchange="mtRoutineStepChanged('${escapeHTML(routine.id)}',this)"><span><b>${i+1}</b>${escapeHTML(step)}</span></label>`).join("")}</div><div class="routine-day-status">${entry.completed?"✓ Routine complétée aujourd’hui":"Coche les étapes au fil de ta routine."}</div></section>`;
  modal.classList.add("open");
};
window.mtRoutineStepChanged=async function(routineId,input){
  const state=window.__MT_ROUTINES_STATE__||{};
  const user=state.user||await mtRequireAuthForSave();
  if(!user)return;
  const date=state.date||mtTodayISO();
  const routine=(state.routines||[]).find(r=>String(r.id)===String(routineId));
  if(!routine)return;
  const steps=mtRoutineSteps(routine);
  const current=mtReadRoutineEntryCache(user.id,date);
  const entry={...(current[routineId]||{}),routine_id:routineId,entry_date:date,step_state:{...(current[routineId]?.step_state||{})}};
  entry.step_state[String(input.dataset.step)]=!!input.checked;
  const completed=steps.length>0&&steps.every((_,i)=>entry.step_state[String(i)]===true);
  entry.completed=completed;
  entry.updated_at=new Date().toISOString();
  current[routineId]=entry;
  mtWriteRoutineEntryCache(user.id,date,current);
  input.closest(".routine-step")?.classList.toggle("is-done",!!input.checked);
  const status=document.querySelector("#mtRoutineWorkspace .routine-day-status");
  if(status)status.textContent=completed?"✓ Routine complétée aujourd’hui":"Coche les étapes au fil de ta routine.";
  try{
    const c=initSupabase&&initSupabase();
    if(c){
      const {data,error}=await c.rpc("user_routine_save_day",{target_routine:routineId,target_date:date,target_step_state:entry.step_state});
      if(error)throw error;
      entry.completed=!!data?.routine_completed;
      current[routineId]=entry;
      mtWriteRoutineEntryCache(user.id,date,current);
    }
  }catch(e){console.warn("routine day sync",e);}
  try{
    const nextState=await window.mtBuildTodayState();
    window.__MT_TODAY_STATE__=nextState;
    mtUpdateTodayMissionDOM("routine",nextState);
    window.dispatchEvent(new CustomEvent("mt:daily-state-changed",{detail:{source:"routine",todayState:nextState}}));
    if(window.mtRefreshParcoursCalendar)window.mtRefreshParcoursCalendar();
  }catch(e){}
};


// ── V64 — MON PARCOURS SHEET intégré au Profil ────────────────────────────
window.mtOpenParcoursSheet = async function(mode) {
  const directJournal = mode === "journal" || mode?.directJournal === true;
  // V342 · Le Journal privé ne charge plus tout le calendrier avant de
  // s'afficher. Il s'ouvre immédiatement au-dessus de la page courante dans
  // son singleton global, depuis Profil comme depuis Carnet.
  if (directJournal && window.mtJournalOpenDirect) {
    return window.mtJournalOpenDirect();
  }
  let modal = document.getElementById("parcoursSheetDrawer");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "parcoursSheetDrawer";
    modal.className = "ritual-signal-drawer";
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="ritual-signal-backdrop" onclick="mtCloseParcoursSheet()"></div>
    <div class="ritual-signal-sheet saved-sheet parcours-sheet">
      <div class="ritual-signal-grip"></div>
      <button class="ritual-signal-close" onclick="mtCloseParcoursSheet()">×</button>
      <div class="parcours-sheet-head">
        <div class="ritual-signal-kicker">Espace personnel confidentiel</div>
        <h3>Mon parcours</h3>
        <p>Ton évolution jour après jour.</p>
      </div>
      <div id="parcoursSheetBody"><div class="parcours-loading"><span>${mtIconHTML("leaf", "parcours-loading-icon")}</span><p>Chargement de ton parcours…</p></div></div>
    </div>`;
  modal.classList.toggle("journal-direct-open", directJournal);
  modal.classList.add("open");
  if (window.mtJournalInitSheet) await window.mtJournalInitSheet();
  if (directJournal && window.mtJournalOpenForm) {
    const iso = window.mtJournalTodayISO ? window.mtJournalTodayISO() : new Date().toLocaleDateString("sv-SE");
    await window.mtJournalOpenForm(iso);
  }
};
window.mtCloseParcoursSheet = function() {
  const m = document.getElementById("parcoursSheetDrawer");
  if (m) m.classList.remove("open");
};
// ─────────────────────────────────────────────────────────────────────────

function mtShortSaved(str, max=110){ str=String(str||"").replace(/\s+/g," ").trim(); return str.length>max ? str.slice(0,max-1).trim()+"…" : str; }
async function mtSavedCounts() {
  const user = await mtGetUser();
  if (!user) return { favorites: 0, routines: 0 };
  const data = mtReadSavedLocal(user.id);
  // Pas de lecture Supabase au démarrage : le compte Routine utilise le cache
  // personnel, rafraîchi quand l’espace Mes routines est ouvert/modifié.
  return { favorites: data.favorites.length, routines: mtRoutineLocalCount(user.id) };
}


async function mtContinueJourneyHTML(ownedIds = []) {
  try {
    const user = await mtGetUser();
    const protocols = await fetchProtocols();
    const ownedSet = new Set((ownedIds || []).map(String));
    const ownedProtocols = (protocols || []).filter(p =>
      ownedSet.has(String(p.id)) || ownedSet.has(String(p.slug))
    );

    if (!user || !ownedProtocols.length) {
      return `<article class="continue-journey-card reveal">
        <div class="continue-kicker">Mes protocoles</div>
        <h2>Aucun protocole en cours <span class="title-inline-icon">${mtIconHTML('sparkle','title-sparkle-icon')}</span></h2>
        <p>Quand tu débloqueras un protocole, tu pourras le commencer ou le reprendre directement ici.</p>
        <button onclick="location.href='protocols.html?category=pharmacie_vegetale'">Explorer les protocoles</button>
      </article>`;
    }

    const normalizeCompletedDays = value => {
      let rows = value;
      if (typeof rows === "string") {
        try { rows = JSON.parse(rows); }
        catch(e) { rows = rows.split(",").map(v => v.trim()).filter(Boolean); }
      }
      if (!Array.isArray(rows)) return [];
      return [...new Set(rows.map(v => {
        if (v && typeof v === "object") return String(v.date || v.day || v.entry_date || "");
        return String(v || "");
      }).filter(Boolean))];
    };

    const durationFor = (protocol, progress) => {
      const fromLabel = String(protocol?.duration_label || "").match(/\d+/)?.[0];
      return Math.max(1, Number(progress?.total_days || protocol?.total_days || fromLabel || 7));
    };

    const client = initSupabase();
    let progressRows = [];
    if (client) {
      const ids = ownedProtocols.map(p => p.id).filter(Boolean);
      if (ids.length) {
        const { data, error } = await client
          .from("protocol_progress")
          .select("protocol_id,current_day,total_days,completed_days,last_validated_at,updated_at,certificate_unlocked")
          .eq("user_id", user.id)
          .in("protocol_id", ids);
        if (!error) progressRows = data || [];
      }
    }

    const progressByProtocol = new Map(
      progressRows.map(row => [String(row.protocol_id), row])
    );

    const states = ownedProtocols.map(protocol => {
      const progress = progressByProtocol.get(String(protocol.id)) || null;
      const total = durationFor(protocol, progress);
      const completedDays = normalizeCompletedDays(progress?.completed_days);
      const completedCount = Math.min(total, completedDays.length);

      // "En cours" = une vraie journée a été validée.
      // Une simple ouverture du protocole ne suffit plus.
      const hasRealProgress = completedCount > 0 || !!progress?.last_validated_at;
      const finished = !!progress?.certificate_unlocked || completedCount >= total;

      const lastActivityAt = progress?.last_validated_at
        ? Date.parse(progress.last_validated_at) || 0
        : 0;

      return {
        protocol,
        progress,
        total,
        completedCount,
        hasRealProgress,
        finished,
        lastActivityAt
      };
    });

    // Priorité absolue : le protocole ayant la dernière activité RÉELLE.
    // Le dernier protocole simplement ouvert dans localStorage n'intervient plus.
    const inProgress = states
      .filter(x => x.hasRealProgress && !x.finished)
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);

    if (inProgress.length) {
      const chosen = inProgress[0];
      const { protocol, progress, total, completedCount } = chosen;
      const day = Math.min(total, Math.max(1, Number(progress?.current_day || 1)));
      const pct = Math.min(100, Math.round((completedCount / total) * 100));
      const id = encodeURIComponent(protocol.id || protocol.slug);
      const completedLabel = `${completedCount} journée${completedCount > 1 ? "s" : ""} complétée${completedCount > 1 ? "s" : ""}`;

      return `<article class="continue-journey-card reveal">
        <div class="continue-kicker">Mon protocole en cours</div>
        <div class="continue-topline"><span>Reprendre là où tu en étais ${mtIconHTML('sparkle','inline-badge-icon')}</span><em>${pct}%</em></div>
        <h2>${escapeHTML(protocol.title || "Ton protocole")}</h2>
        <p>Jour ${day} sur ${total} · ${completedLabel}. Ta progression correspond maintenant aux journées réellement validées.</p>
        <div class="continue-progress"><i style="width:${pct}%"></i></div>
        <button onclick="location.href='protocol-journey.html?id=${id}'">Continuer</button>
      </article>`;
    }

    // Aucun protocole réellement commencé : on propose un protocole débloqué à 0 %.
    // Une ouverture antérieure "par curiosité" ne transforme donc plus le bloc en reprise.
    const ready = states.find(x => !x.hasRealProgress && !x.finished);
    if (ready) {
      const { protocol, total } = ready;
      const id = encodeURIComponent(protocol.id || protocol.slug);

      return `<article class="continue-journey-card reveal">
        <div class="continue-kicker">Mon protocole en cours</div>
        <div class="continue-topline"><span>Prêt à commencer ${mtIconHTML('sparkle','inline-badge-icon')}</span><em>0%</em></div>
        <h2>${escapeHTML(protocol.title || "Ton protocole")}</h2>
        <p>0 journée complétée sur ${total}. Commence le jour 1 quand tu le souhaites.</p>
        <div class="continue-progress"><i style="width:0%"></i></div>
        <button onclick="location.href='protocol-journey.html?id=${id}'">Commencer</button>
      </article>`;
    }

    // Tous les protocoles débloqués sont terminés : ne pas afficher un faux "Continuer".
    return "";
  } catch(e) {
    return "";
  }
}



// ── V153 — Aujourd'hui partagé Accueil / Profil ───────────────────────────
function mtTodayISO(){
  try { return new Date().toLocaleDateString('sv-SE'); }
  catch(e){ return new Date().toISOString().slice(0,10); }
}
function mtReadTodayChecks(userId){
  try { return JSON.parse(localStorage.getItem(`mt_today_checks_${userId || 'guest'}_${mtTodayISO()}`) || '{}') || {}; }
  catch(e){ return {}; }
}
function mtWriteTodayChecks(userId, data){
  try { localStorage.setItem(`mt_today_checks_${userId || 'guest'}_${mtTodayISO()}`, JSON.stringify(data || {})); }
  catch(e){}
}
function mtNormalizeTodayChecks(data){
  if(!data || typeof data !== 'object') return {};
  const out = {};
  Object.keys(data).forEach(k => { if(data[k]) out[k] = true; });
  return out;
}
async function mtFetchTodayRemoteState(userId, iso){
  try{
    const c = initSupabase && initSupabase();
    if(!c || !userId) return null;
    // V372 : même nombre de requêtes qu'avant. Le RPC ajoute seulement le
    // résumé des routines programmées à la lecture déjà nécessaire d'Aujourd'hui.
    try{
      const {data,error}=await c.rpc('today_activity_summary',{target_date:iso});
      if(!error&&data)return data;
    }catch(e){}
    // Fallback si le SQL V372 n'est pas encore appliqué.
    const { data, error } = await c
      .from('daily_activity')
      .select('today_checks,hydration_liters,sleep_hours,has_hydration,has_sleep,has_checklist,has_tracker,has_journal,has_photo,has_recipe,has_protocol,has_routine,has_ritual,protocol_title,protocol_day')
      .eq('user_id', userId)
      .eq('activity_date', iso)
      .maybeSingle();
    if(error) throw error;
    return data || null;
  }catch(e){
    console.warn('today remote state fallback', e);
    return null;
  }
}
function mtRemoteChecksFromActivity(row){
  const checks = mtNormalizeTodayChecks(row?.today_checks || {});
  if(Number(row?.hydration_liters || 0) >= 2) checks.hydration = true;
  if(row?.has_checklist) checks.checklist = true;
  if(row?.has_tracker) checks.tracker = true;
  if(row?.has_journal) checks.journal = true;
  if(row?.has_photo) checks.photo = true;
  if(row?.has_recipe) checks.recipe = true;
  if(row?.has_routine) checks.routine = true;
  return checks;
}
function mtReadTodayLocalActivity(userId, iso){
  const uid=String(userId||'guest').replace(/[^a-zA-Z0-9_-]/g,'_');
  try{
    const scoped=JSON.parse(localStorage.getItem(`mt_daily_activity_local_v2_${uid}`)||'{}')||{};
    if(scoped[iso]) return scoped[iso];
    const legacy=JSON.parse(localStorage.getItem('mt_daily_activity_local_v1')||'{}')||{};
    return legacy[iso]||null;
  }catch(e){return null;}
}
async function mtPersistTodayState(userId, checks, hydration, sleepHours){
  try{
    const c = initSupabase && initSupabase();
    if(!c || !userId || userId === 'guest') return;
    const cleanChecks = mtNormalizeTodayChecks(checks || {});
    const liters = Math.max(0, Math.min(6, Math.round((Number(hydration) || 0) * 100) / 100));
    if(liters >= 2) cleanChecks.hydration = true;
    else delete cleanChecks.hydration;
    const sleep = Math.max(0, Math.min(24, Number(sleepHours) || 0));
    const hasRitual = Object.keys(cleanChecks).some(k => k.startsWith('ritual_') && cleanChecks[k]);
    const row = {
      user_id: userId,
      activity_date: mtTodayISO(),
      today_checks: cleanChecks,
      hydration_liters: liters,
      has_hydration: liters > 0,
      sleep_hours: sleep,
      has_sleep: sleep > 0,
      has_protocol: !!cleanChecks.protocol,
      has_routine: !!cleanChecks.routine,
      has_ritual: hasRitual,
      updated_at: new Date().toISOString()
    };
    const persisted=await c.from('daily_activity').upsert(row, { onConflict:'user_id,activity_date' });
    if(!persisted?.error&&liters>=2&&window.mtGardenAwardDaily)window.mtGardenAwardDaily('hydration',mtTodayISO());
  }catch(e){
    console.warn('today state persist failed', e);
  }
}
function mtTodayHydrationLiters(userId){
  const key = `mt_hydration_liters_${userId || 'guest'}_${mtTodayISO()}`;
  const alt = `mt_today_hydration_liters_${userId || 'guest'}_${mtTodayISO()}`;
  const val = Number(localStorage.getItem(key) || localStorage.getItem(alt) || 0);
  return Math.max(0, Math.min(6, Number.isFinite(val) ? val : 0));
}
function mtTodaySetHydration(userId, liters){
  const v = Math.max(0, Math.min(6, Math.round((Number(liters) || 0) * 100) / 100));
  try { localStorage.setItem(`mt_hydration_liters_${userId || 'guest'}_${mtTodayISO()}`, String(v)); } catch(e){}
  return v;
}
function mtFormatHydrationLiters(value){
  const n=Math.max(0,Math.round((Number(value)||0)*100)/100);
  try{return n.toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:2});}
  catch(e){return String(n).replace('.',',');}
}
function mtUpdateTodayMissionDOM(key,state){
  const row=[...document.querySelectorAll('.mt-today-row')].find(el=>el.dataset.todayKey===String(key||''));
  const mission=(state?.missions||[]).find(m=>m.key===key);
  if(!row||!mission)return;
  row.classList.toggle('is-done',!!mission.done);
  const title=row.querySelector('span b');if(title)title.textContent=mission.title||title.textContent;
  const sub=row.querySelector('[data-today-sub]');if(sub)sub.textContent=mission.sub||'';
  const status=row.querySelector('[data-today-status]');if(status)status.textContent=mission.done?'✓':'';
}
function mtUpdateTodayHydrationDOM(state){
  const hydration=Number(state?.hydration||0),pct=Math.min(100,Math.round((hydration/2)*100));
  const value=document.getElementById('mtTodayHydrationValue');if(value)value.textContent=`${mtFormatHydrationLiters(hydration)} / 2 L`;
  const bar=document.getElementById('mtTodayHydrationBar');if(bar)bar.style.width=`${pct}%`;
  const current=document.getElementById('mtHydrationQuickCurrent');if(current)current.textContent=`${mtFormatHydrationLiters(hydration)} L`;
  mtUpdateTodayMissionDOM('hydration',state);
  document.querySelectorAll('.mt-profile-today-line').forEach(line=>{
    const title=line.querySelector('b');if(title?.textContent?.trim()!=='Hydratation')return;
    const detail=line.querySelector('em');if(detail)detail.textContent=`${mtFormatHydrationLiters(hydration)} / 2 L`;
    line.classList.toggle('is-done',hydration>=2);
    const status=line.querySelector('.mt-profile-today-status');if(status)status.innerHTML=hydration>=2?mtIconHTML('check','mt-profile-today-status-icon'):mtIconHTML('hydration','mt-profile-today-status-icon');
  });
  document.querySelectorAll('.parcours-card-today span').forEach(span=>{if(/\/\s*2\s*L/.test(span.textContent||''))span.innerHTML=`${mtIconHTML('hydration','parcours-chip-icon')} ${mtFormatHydrationLiters(hydration)} / 2 L`;});
}
function mtTodaySleepLabel(value){
  const sleep=Number(value||0);
  return sleep>0?`${String(Math.round(sleep*100)/100).replace('.',',')} h`:'À renseigner';
}
function mtUpdateTodaySleepDOM(state){
  const sleep=Number(state?.sleep||0),label=mtTodaySleepLabel(sleep);
  const input=document.querySelector('.mt-sleep-entry input');if(input&&document.activeElement!==input)input.value=sleep||'';
  document.querySelectorAll('.mt-profile-today-line').forEach(line=>{
    const title=line.querySelector('b');if(title?.textContent?.trim()!=='Sommeil / repos')return;
    const detail=line.querySelector('em');if(detail)detail.textContent=label;
    // Le sommeil est un repère, pas une mission à réussir : aucune coche liée
    // à une durée fixe.
    line.classList.remove('is-done');
    const status=line.querySelector('.mt-profile-today-status');if(status)status.innerHTML=mtIconHTML('sleep','mt-profile-today-status-icon');
  });
  const parcoursSleep=document.querySelector('[data-parcours-sleep]');
  if(parcoursSleep)parcoursSleep.innerHTML=`${mtIconHTML('sleep','parcours-chip-icon')} ${escapeHTML(label)}`;
}
window.mtCloseTodayHydrationPicker=function(){document.getElementById('mtTodayHydrationQuick')?.remove();};
window.mtOpenTodayHydrationPicker=async function(){
  let state=window.__MT_TODAY_STATE__;
  if(!state?.user){state=await window.mtBuildTodayState();window.__MT_TODAY_STATE__=state;}
  if(!state?.user)return;
  window.mtCloseTodayHydrationPicker();
  const host=document.getElementById('ritualSignalDrawer')||document.body;
  const quick=document.createElement('div');quick.id='mtTodayHydrationQuick';quick.className='mt-hydration-quick';
  quick.innerHTML=`<button class="mt-hydration-quick-bg" type="button" onclick="mtCloseTodayHydrationPicker()" aria-label="Fermer"></button><section class="mt-hydration-quick-sheet" role="dialog" aria-modal="true" aria-label="Ajouter de l’eau"><div class="mt-hydration-quick-grip"></div><div class="mt-hydration-quick-kicker">Hydratation</div><h3>Quelle quantité as-tu bue ?</h3><p>Ajoute simplement la quantité réelle. Ton suivi se met à jour partout, sans recharger la page.</p><div class="mt-hydration-quick-chips">${[10,15,20,25,33,50].map(cl=>`<button type="button" onclick="mtAddTodayHydrationCl(${cl})">+ ${cl} cl</button>`).join('')}</div><div class="mt-hydration-custom"><label for="mtHydrationCustomCl">Autre quantité</label><div><input id="mtHydrationCustomCl" type="number" min="1" max="200" step="1" inputmode="decimal" placeholder="15"><span>cl</span><button type="button" onclick="mtAddTodayHydrationCustom()">Ajouter</button></div></div><footer>Déjà enregistré aujourd’hui <strong id="mtHydrationQuickCurrent">${mtFormatHydrationLiters(state.hydration)} L</strong></footer></section>`;
  host.appendChild(quick);requestAnimationFrame(()=>quick.classList.add('open'));
};
window.mtAddTodayHydrationCustom=function(){const input=document.getElementById('mtHydrationCustomCl');const cl=Number(String(input?.value||'').replace(',','.'));if(!Number.isFinite(cl)||cl<=0){input?.focus({preventScroll:true});return;}window.mtAddTodayHydrationCl(cl);};
window.mtAddTodayHydrationCl=async function(cl){
  const amount=Math.max(0,Math.min(200,Number(cl)||0));if(!amount)return;
  let state=window.__MT_TODAY_STATE__;
  if(!state?.user){state=await window.mtBuildTodayState();if(!state?.user)return;}
  const next=mtTodaySetHydration(state.userId,Number(state.hydration||0)+(amount/100));
  const checks={...(state.checks||{})};if(next>=2)checks.hydration=true;else delete checks.hydration;mtWriteTodayChecks(state.userId,checks);
  const missions=(state.missions||[]).map(m=>m.key==='hydration'?{...m,sub:`${mtFormatHydrationLiters(next)} / 2 L`,done:next>=2}:m);
  const nextState={...state,checks,hydration:next,missions,completed:missions.filter(m=>m.done).length+(state.journalDone?1:0)};
  window.__MT_TODAY_STATE__=nextState;
  mtUpdateTodayHydrationDOM(nextState);
  const counter=[...document.querySelectorAll('.parcours-card-today span')].find(x=>/missions terminées/.test(x.textContent||''));if(counter)counter.innerHTML=`${mtIconHTML('check','parcours-chip-icon')} ${nextState.completed} missions terminées`;
  window.mtCloseTodayHydrationPicker();
  window.dispatchEvent(new CustomEvent('mt:daily-state-changed',{detail:{source:'hydration',todayState:nextState}}));
  mtTodayTrackActivity('hydration');
  await mtPersistTodayState(state.userId,checks,next,state.sleep||0);
  try{if(window.mtRefreshParcoursCalendar)window.mtRefreshParcoursCalendar();}catch(e){}
  if(window.mtToast)window.mtToast(`+ ${String(amount).replace('.',',')} cl ajoutés`);
};
function mtTodaySleepHours(userId){
  const key = `mt_sleep_hours_${userId || 'guest'}_${mtTodayISO()}`;
  const val = Number(localStorage.getItem(key) || 0);
  return Math.max(0, Math.min(24, Number.isFinite(val) ? val : 0));
}
function mtTodaySetSleepHours(userId, hours){
  const v = Math.max(0, Math.min(24, Math.round((Number(hours) || 0) * 4) / 4));
  try { localStorage.setItem(`mt_sleep_hours_${userId || 'guest'}_${mtTodayISO()}`, String(v)); } catch(e){}
  return v;
}

function mtTodayTrackActivity(type){
  try {
    if (window.mtJournalTrack) window.mtJournalTrack(type);
  } catch(e) {}
  try {
    if (window.mtRefreshParcoursCalendar) window.mtRefreshParcoursCalendar();
  } catch(e) {}
}

function mtTodayRitualsFallback(){
  return [
    { key:'daily-1', icon:'seed', title:'Boire un grand verre d’eau', sub:'Le premier geste du jour', url:'' }
  ];
}
function mtNormalizeDailyRituals(value){
  let raw = value;
  if(typeof raw === 'string'){
    try{ raw = JSON.parse(raw); }catch(e){ raw = []; }
  }
  if(!Array.isArray(raw)) raw = [];
  return raw.slice(0,5).map((r,i)=>{
    const title = String(r?.title || '').trim();
    if(!title) return null;
    const icon = String(r?.icon || r?.iconKey || 'seed').trim() || 'seed';
    const sub = String(r?.sub || r?.subtitle || r?.description || '').trim();
    const url = String(r?.url || r?.action || '').trim();
    const target_type = String(r?.target_type || r?.targetType || (url ? 'url' : 'none') || 'none').trim();
    const target_id = String(r?.target_id || r?.targetId || '').trim();
    return { key:`daily_${i+1}`, icon, title, sub, url, target_type, target_id };
  }).filter(Boolean);
}
async function mtFetchUniversalRituals(){
  try{
    const c = initSupabase && initSupabase();
    if(!c) return mtTodayRitualsFallback();
    const { data, error } = await c
      .from('daily_rituals')
      .select('icon,title,sub,url,target_type,target_id,position,active')
      .eq('active', true)
      .order('position', { ascending: true });
    if(error) throw error;
    const rituals = mtNormalizeDailyRituals(data || []);
    return rituals.length ? rituals : mtTodayRitualsFallback();
  }catch(e){
    console.warn('daily rituals fallback', e);
    return mtTodayRitualsFallback();
  }
}
function mtDailyRitualAction(r){
  const type = String(r?.target_type || (r?.url ? 'url' : 'none') || 'none').toLowerCase();
  const id = String(r?.target_id || '').trim();
  const url = String(r?.url || '').trim();
  if(type === 'recipe' && id) return `openRecipeViewer('${escapeHTML(id)}')`;
  if(type === 'protocol' && id) return `location.href='protocol.html?id=${encodeURIComponent(id)}'`;
  if(type === 'page' && id) return `location.href='page.html?slug=${encodeURIComponent(id)}'`;
  if(type === 'post' && id) return `location.href='index.html?mt_post=${encodeURIComponent(id)}#${encodeURIComponent(id)}'`;
  if(type === 'pdf' && id) return `location.href='page.html?slug=${encodeURIComponent(id)}'`;
  if(type === 'audio' && id) return `location.href='page.html?slug=${encodeURIComponent(id)}'`;
  if((type === 'url' || url) && url) return `location.href='${escapeHTML(url)}'`;
  return '';
}
function mtDailyRitualMission(r, index, checks){
  const key = `ritual_${index}`;
  return {
    key,
    icon: r.icon || 'seed',
    title: r.title,
    sub: r.sub || (r.url ? 'Ouvrir le contenu' : 'Rituel universel'),
    done: !!checks[key],
    action: mtDailyRitualAction(r),
    target_type: r.target_type || 'none',
    target_id: r.target_id || '',
    isUniversal: true
  };
}
async function mtGetActiveProtocolToday(user, ownedIds){
  try{
    if(!user) return null;
    const protocols = await fetchProtocols();
    const ownedSet = new Set((ownedIds || []).map(String));
    const ownedProtocols = (protocols || []).filter(p => ownedSet.has(String(p.id)) || ownedSet.has(String(p.slug)));
    if(!ownedProtocols.length) return null;
    const client = initSupabase && initSupabase();
    let progressRows = [];
    if(client){
      const ids = ownedProtocols.map(p => p.id).filter(Boolean);
      if(ids.length){
        const { data } = await client.from('protocol_progress').select('*').eq('user_id', user.id).in('protocol_id', ids).order('last_validated_at', { ascending:false });
        progressRows = Array.isArray(data) ? data : [];
      }
    }
    const lastLocal = (()=>{ try{return JSON.parse(localStorage.getItem('mt_last_journey_progress')||'null')}catch(e){return null} })();
    let chosen = null;
    if(lastLocal?.protocol_id) chosen = ownedProtocols.find(p => String(p.id) === String(lastLocal.protocol_id));
    if(!chosen && progressRows.length) chosen = ownedProtocols.find(p => String(p.id) === String(progressRows[0].protocol_id));
    if(!chosen) chosen = ownedProtocols[0];
    const progress = progressRows.find(p => String(p.protocol_id) === String(chosen.id)) || {};
    const day = Math.max(1, Number(progress.current_day || lastLocal?.current_day || 1));
    const total = Math.max(day, Number(progress.total_days || chosen.total_days || String(chosen.duration_label || '').match(/\d+/)?.[0] || 7));
    return { id: chosen.id || chosen.slug, title: mtRecipeDecodeEntities(chosen.title || 'Ton protocole'), day, total, pct: Math.min(100, Math.round((day/total)*100)) };
  }catch(e){ console.warn('today active protocol failed', e); return null; }
}
window.mtBuildTodayState = async function(){
  const user = await mtGetUser();
  const userId = user?.id || 'guest';
  const iso = mtTodayISO();
  let checks = mtReadTodayChecks(userId);
  checks = { ...mtRemoteChecksFromActivity(mtReadTodayLocalActivity(userId, iso)), ...checks };
  let remoteToday = null;
  if(user){
    remoteToday = await mtFetchTodayRemoteState(userId, iso);
    const remoteChecks = mtRemoteChecksFromActivity(remoteToday);
    checks = { ...remoteChecks, ...checks };
    mtWriteTodayChecks(userId, checks);
    const remoteHydration = Number(remoteToday?.hydration_liters || 0);
    const remoteSleep = Number(remoteToday?.sleep_hours || 0);
    if(remoteHydration > 0 && mtTodayHydrationLiters(userId) < remoteHydration){
      mtTodaySetHydration(userId, remoteHydration);
    }
    if(remoteSleep > 0 && mtTodaySleepHours(userId) < remoteSleep){
      mtTodaySetSleepHours(userId, remoteSleep);
    }
  }
  const universal = await mtFetchUniversalRituals();
  const universalMissions = universal.map((r,i)=>mtDailyRitualMission(r,i,checks));
  if(!user){
    return { user:null, userId, hydration:0, checks, active:null, completed:universalMissions.filter(m=>m.done).length, missions:universalMissions, universalMissions, journalDone:false };
  }
  const owned = await fetchOwnedIds();
  const active = await mtGetActiveProtocolToday(user, owned);
  const hydration = mtTodayHydrationLiters(userId);
  const sleep = mtTodaySleepHours(userId);
  const journalDone = !!checks.journal;
  let routineSummary=mtRoutineLocalSummary(userId,iso,remoteToday);
  if(!routineSummary.total&&checks.routine){
    routineSummary={total:1,completed:1,done:true,items:[{id:'completed-routine',title:'Mes routines',steps_count:0,completed:true}]};
  }
  if(routineSummary.total){
    if(routineSummary.done)checks.routine=true;
    else delete checks.routine;
    mtWriteTodayChecks(userId,checks);
  }
  const personalMissions = [];
  if(active){
    personalMissions.push({ key:'protocol', icon:'movement', title:`Continuer ${active.title}`, sub:`Jour ${active.day} sur ${active.total}`, done:!!checks.protocol, action:`protocol-journey.html?id=${encodeURIComponent(active.id)}` });
  }
  personalMissions.push({ key:'hydration', icon:'hydration', title:'Hydratation', sub:`${mtFormatHydrationLiters(hydration)} / 2 L`, done: hydration >= 2 });
  if(routineSummary.total){
    const first=routineSummary.items?.[0]||null;
    const routineTitle=routineSummary.total===1&&first?.title?first.title:'Mes routines';
    const routineSub=routineSummary.done
      ? 'Complétée'
      : routineSummary.total===1&&Number(first?.steps_count||0)>0
        ? `${Number(first.steps_count)} étape${Number(first.steps_count)>1?'s':''} · À faire`
        : `${routineSummary.completed} / ${routineSummary.total} complétée${routineSummary.total>1?'s':''}`;
    personalMissions.push({key:'routine',icon:'leaf',title:routineTitle,sub:routineSub,done:routineSummary.done,routineAction:true});
  }
  const missions = [...universalMissions, ...personalMissions];
  const completed = missions.filter(m => m.done).length + (journalDone ? 1 : 0);
  return { user, userId, hydration, sleep, checks, active, owned, completed, missions, universalMissions, journalDone, routineSummary };
};
window.mtToggleTodayMission = async function(key){
  if(key === 'hydration'){ window.mtOpenTodayHydrationPicker(); return; }
  if(key === 'routine'){ window.mtOpenMyRoutines?.('today'); return; }
  const state = window.__MT_TODAY_STATE__?.user ? window.__MT_TODAY_STATE__ : await window.mtBuildTodayState();
  if(!state.user){ window.mtOpenTodaySheet && window.mtOpenTodaySheet(); return; }
  const checks = { ...(state.checks || {}) };
  checks[key] = !checks[key];
  mtWriteTodayChecks(state.userId, checks);
  mtTodayTrackActivity(key === 'protocol' ? 'protocol' : key === 'routine' ? 'routine' : key.startsWith('ritual_') ? 'ritual' : 'checklist');
  const nextHydration = mtTodayHydrationLiters(state.userId);
  const nextSleep = mtTodaySleepHours(state.userId);
  const nextMissions = (state.missions || []).map(m => {
    if(m.key !== key) return m;
    return { ...m, done:!!checks[key] };
  });
  const nextState = {...state,checks,hydration:nextHydration,sleep:nextSleep,missions:nextMissions,completed:nextMissions.filter(m=>m.done).length+(state.journalDone?1:0)};
  window.__MT_TODAY_STATE__=nextState;
  mtUpdateTodayMissionDOM(key,nextState);
  window.dispatchEvent(new CustomEvent('mt:daily-state-changed',{detail:{source:key,todayState:nextState}}));
  await mtPersistTodayState(state.userId, checks, nextHydration, nextSleep);
  if(document.getElementById('dashboardSummary')){
    const counter=[...document.querySelectorAll('.parcours-card-today span')].find(x=>/missions terminées/.test(x.textContent||''));
    if(counter)counter.innerHTML=`${mtIconHTML('check','parcours-chip-icon')} ${nextState.completed} missions terminées`;
  }
};
window.mtUpdateTodaySleep = async function(value){
  const state = window.__MT_TODAY_STATE__?.user ? window.__MT_TODAY_STATE__ : await window.mtBuildTodayState();
  if(!state.user) return;
  const sleep = mtTodaySetSleepHours(state.userId, value);
  const nextState = { ...state, sleep };
  window.__MT_TODAY_STATE__=nextState;
  mtUpdateTodaySleepDOM(nextState);
  window.dispatchEvent(new CustomEvent('mt:daily-state-changed',{detail:{source:'sleep',todayState:nextState}}));
  try { if(window.mtRefreshParcoursCalendar) window.mtRefreshParcoursCalendar(); } catch(e) {}
  await mtPersistTodayState(state.userId, state.checks || {}, state.hydration || 0, sleep);
};
window.mtOpenTodaySheet = async function(){
  let modal = document.getElementById('ritualSignalDrawer');
  if(!modal){ modal = document.createElement('div'); modal.id='ritualSignalDrawer'; modal.className='ritual-signal-drawer'; document.body.appendChild(modal); }
  const state = await window.mtBuildTodayState();
  window.__MT_TODAY_STATE__=state;
  if(!state.user){
    const guestRows = (state.missions || []).map(m => `<button type="button" class="mt-today-row ${m.done?'is-done':''}" data-today-key="${escapeHTML(m.key)}" onclick="${m.action ? `location.href='${escapeHTML(m.action)}'` : `mtToggleTodayMission('${escapeHTML(m.key)}')`}">
      <span class="mt-today-row-icon">${mtIconHTML(m.icon,'today-row-icon')}</span>
      <span><b>${escapeHTML(m.title)}</b><em data-today-sub>${escapeHTML(m.sub)}</em></span>
      <i data-today-status onclick="event.stopPropagation(); mtToggleTodayMission('${escapeHTML(m.key)}')">${m.done ? '✓' : ''}</i>
    </button>`).join('');
    modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseTodaySheet()"></div>
      <div class="ritual-signal-sheet mt-today-sheet">
        <div class="ritual-signal-grip"></div><button class="ritual-signal-close" onclick="mtCloseTodaySheet()">×</button>
        <div class="mt-today-head"><div class="ritual-signal-icon">${mtIconHTML('lock','today-sheet-icon')}</div><div><div class="ritual-signal-kicker">Bienvenue</div><h3>Crée ton espace</h3><p>Ton rituel, tes suivis et tes contenus privés se rangent ici.</p></div></div>
        ${guestRows ? `<div class="mt-today-section-title">Rituels proposés</div><div class="mt-today-list">${guestRows}</div>` : ''}
        <div class="mt-today-guest-list">
          <span>${mtIconHTML('movement','today-mini-icon')} Suis tes protocoles et routines</span>
          <span>${mtIconHTML('journal','today-mini-icon')} Accède à ton journal privé</span>
          <span>${mtIconHTML('hydration','today-mini-icon')} Enregistre tes suivis quotidiens</span>
        </div>
        <button class="mt-today-primary" onclick="location.href='auth.html?next=index.html'">Créer mon espace gratuitement <span>›</span></button>
        <button class="mt-today-link" onclick="location.href='auth.html?next=index.html'">Déjà un compte ? Se connecter</button>
      </div>`;
    modal.classList.add('open');
    return;
  }
  const rows = state.missions.map(m => `<button type="button" class="mt-today-row ${m.done?'is-done':''}" data-today-key="${escapeHTML(m.key)}" onclick="${m.action ? `location.href='${escapeHTML(m.action)}'` : m.routineAction ? `mtOpenMyRoutines('today')` : `mtToggleTodayMission('${escapeHTML(m.key)}')`}">
    <span class="mt-today-row-icon">${mtIconHTML(m.icon,'today-row-icon')}</span>
    <span><b>${escapeHTML(m.title)}</b><em data-today-sub>${escapeHTML(m.sub)}</em></span>
    <i data-today-status onclick="event.stopPropagation(); ${m.routineAction ? `mtOpenMyRoutines('today')` : `mtToggleTodayMission('${escapeHTML(m.key)}')`}">${m.done ? '✓' : ''}</i>
  </button>`).join('');
  const pct = Math.min(100, Math.round((state.hydration / 2) * 100));
  modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseTodaySheet()"></div>
    <div class="ritual-signal-sheet mt-today-sheet">
      <div class="ritual-signal-grip"></div><button class="ritual-signal-close" onclick="mtCloseTodaySheet()">×</button>
      <div class="mt-today-head"><div class="ritual-signal-icon">${mtIconHTML('seed','today-sheet-icon')}</div><div><div class="ritual-signal-kicker">Aujourd’hui</div><h3>Ton rituel du jour</h3><p>Tes missions, tes habitudes et ton suivi.</p></div></div>
      <div class="mt-today-section-title">Mes missions du jour</div>
      <div class="mt-today-list">${rows}</div>
      <button type="button" class="mt-today-routines-link" onclick="mtOpenMyRoutines('today')">${state.routineSummary?.total?'Gérer mes routines':'Configurer mes routines'} <span>›</span></button>
      <div class="mt-today-section-title">Mes suivis</div>
      <div class="mt-today-follow mt-today-follow--hydration" role="button" tabindex="0" onclick="mtOpenTodayHydrationPicker()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();mtOpenTodayHydrationPicker();}">
        <div><span>${mtIconHTML('hydration','today-row-icon')}</span><b>Hydratation</b><em>Objectif 2 L · Ajouter une quantité</em></div>
        <strong id="mtTodayHydrationValue">${mtFormatHydrationLiters(state.hydration)} / 2 L</strong>
        <i><em id="mtTodayHydrationBar" style="width:${pct}%"></em></i>
      </div>
      <div class="mt-today-follow mt-today-follow--sleep">
        <div><span>${mtIconHTML('sleep','today-row-icon')}</span><b>Sommeil / repos</b><em>Durée réellement dormie</em></div>
        <label class="mt-sleep-entry"><input type="number" min="0" max="24" step="0.25" inputmode="decimal" value="${state.sleep || ''}" aria-label="Heures de sommeil" onchange="mtUpdateTodaySleep(this.value)"><span>h</span></label>
      </div>
      <button class="mt-today-primary" onclick="location.href='dashboard.html'">Voir mon profil <span>›</span></button>
    </div>`;
  modal.classList.add('open');
};
window.mtCloseTodaySheet = function(){ window.mtCloseTodayHydrationPicker?.(); const modal=document.getElementById('ritualSignalDrawer'); if(modal) modal.classList.remove('open'); };
function mtProfileTodayLine(icon, title, text, done){
  const safeTitle = escapeHTML(title || '');
  const safeText = escapeHTML(text || '');
  const stateClass = done ? ' is-done' : '';
  const statusIcon = done ? mtIconHTML('check','mt-profile-today-status-icon') : mtIconHTML(icon,'mt-profile-today-status-icon');
  return `<span class="mt-profile-today-line${stateClass}">
    <i class="mt-profile-today-status" aria-hidden="true">${statusIcon}</i>
    <b>${safeTitle}</b>
    <em>${safeText}</em>
  </span>`;
}

window.mtBuildProfileTodayCardFromState = function(state){
  if(!state?.user) return "";
  if(!state.user) return '';
  const activeLine = state.active ? `${state.active.title} · Jour ${state.active.day}` : 'Aucun protocole actif';
  const hydration = mtFormatHydrationLiters(state.hydration);
  const sleep = String(state.sleep || 0).replace('.', ',');
  const firstRitual = (state.universalMissions || [])[0] || null;
  const ritualLine = firstRitual?.title || 'Rituel du jour à découvrir';
  const ritualDone = !!firstRitual?.done;
  const protocolDone = !!state.checks.protocol;
  const hydrationDone = state.hydration >= 2;
  const sleepLabel = mtTodaySleepLabel(state.sleep);
  const routineSummary=state.routineSummary||{total:0,completed:0,done:false,items:[]};
  const routineDone = !!routineSummary.done;
  const routineFirst=routineSummary.items?.[0]||null;
  const routineTitle=routineSummary.total===1&&routineFirst?.title?routineFirst.title:'Mes routines';
  const routineLine=routineSummary.total
    ? (routineDone?'Complétée':`${routineSummary.completed} / ${routineSummary.total} complétée${routineSummary.total>1?'s':''}`)
    : 'À configurer';
  return `<article class="mt-profile-today-card reveal" onclick="mtOpenTodaySheet()">
    <div class="mt-profile-today-kicker">Mon parcours aujourd’hui</div>
    <h2>Tes objectifs, tes habitudes et ta progression.</h2>
    <div class="mt-profile-today-grid">
      ${mtProfileTodayLine('seed', 'Rituel universel', ritualLine, ritualDone)}
      ${mtProfileTodayLine('leaf', 'Protocole actuel', activeLine, protocolDone)}
      ${mtProfileTodayLine('hydration', 'Hydratation', `${hydration} / 2 L`, hydrationDone)}
      ${mtProfileTodayLine('sleep', 'Sommeil / repos', sleepLabel, false)}
      ${mtProfileTodayLine('bell', routineTitle, routineLine, routineDone)}
    </div>
    <button type="button">Continuer aujourd’hui →</button>
  </article>`;
};
window.mtBuildProfileTodayCard = async function(){
  const state = await mtPromiseTimeout(window.mtBuildTodayState(), 3500, null);
  return window.mtBuildProfileTodayCardFromState(state);
};
// ─────────────────────────────────────────────────────────────────────────



/* V52 · Identité simple dashboard */
function mtReadIdentitySimple(){
  try { return JSON.parse(localStorage.getItem("mt_identity_simple") || "{}"); }
  catch(e){ return {}; }
}
function mtWriteIdentitySimple(data){
  localStorage.setItem("mt_identity_simple", JSON.stringify(data || {}));
}
function mtIdentityGreeting(){
  const h = new Date().getHours();
  if(h < 12) return "Bonjour";
  if(h < 18) return "Bienvenue";
  return "Bonsoir";
}
function mtIdentitySettingsCardHTML(){
  const profile = mtReadIdentitySimple();
  const name = profile.name || "";
  const gender = profile.gender || "";
  const label = name ? `Identité · ${escapeHTML(name)}` : "Identité";
  const sub = gender === "masculin" ? "Profil masculin" : gender === "feminin" ? "Profil féminin" : "Nom, pseudo et profil affiché.";
  return `<article class="trust-app-card mt-profile-tight-card mt-profile-identity-settings" onclick="mtOpenIdentitySimple()">
    <div class="trust-app-icon">${mtIconHTML("profile", "profile-card-icon")}</div>
    <div>
      <div class="trust-app-kicker">Espace personnel</div>
      <h2>${label}</h2>
      <p>${sub}</p>
    </div>
    <span class="trust-app-arrow">→</span>
  </article>`;
}
async function mtIdentitySimpleHTML(todayState){
  const xpCard = await mtPromiseTimeout(window.mtBuildXPCard ? window.mtBuildXPCard() : Promise.resolve(""), 4500, "");
  const todayCard = window.mtBuildProfileTodayCardFromState ? window.mtBuildProfileTodayCardFromState(todayState) : (window.mtBuildProfileTodayCard ? await window.mtBuildProfileTodayCard() : "");
  return `${xpCard}${todayCard}`;
}

window.mtOpenIdentitySimple = function(){
  let modal = document.getElementById("ritualSignalDrawer");
  if(!modal){
    modal = document.createElement("div");
    modal.id = "ritualSignalDrawer";
    modal.className = "ritual-signal-drawer";
    document.body.appendChild(modal);
  }
  const current = mtReadIdentitySimple();
  modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseIdentitySimple()"></div>
    <div class="ritual-signal-sheet saved-sheet mt-identity-simple-sheet">
      <div class="ritual-signal-grip"></div>
      <button class="ritual-signal-close" onclick="mtCloseIdentitySimple()">×</button>
      <div class="ritual-signal-kicker">Espace personnel</div>
      <h3>Ton identité ici</h3>
      <p class="saved-library-intro">Choisis simplement le nom affiché dans ton espace et le profil qui te correspond.</p>
      <div class="mt-identity-simple-form">
        <label>Nom / pseudo</label>
        <input id="mtIdentitySimpleName" value="${escapeHTML(current.name || "")}" placeholder="Ex : Tatiana, Alex, Tee..." />
        <label>Profil</label>
        <select id="mtIdentitySimpleGender">
          <option value="">Ne pas préciser</option>
          <option value="feminin">Féminin</option>
          <option value="masculin">Masculin</option>
          <option value="autre">Autre / non binaire</option>
        </select>
        <button onclick="mtSaveIdentitySimple()">Enregistrer</button>
      </div>
    </div>`;
  const select = document.getElementById("mtIdentitySimpleGender");
  if(select && current.gender) select.value = current.gender;
  modal.classList.add("open");
  requestAnimationFrame(() => {
    const sheet = modal.querySelector(".mt-security-sheet");
    const home = modal.querySelector("#mtSecurityHomeView");
    const deleteEntry = modal.querySelector("#mtDeleteAccountEntry");
    if (sheet) sheet.scrollTop = 0;
    if (home) home.scrollTop = 0;
    if (deleteEntry) {
      deleteEntry.style.display = "grid";
      deleteEntry.style.visibility = "visible";
    }
  });
};
window.mtCloseIdentitySimple = function(){
  const modal = document.getElementById("ritualSignalDrawer");
  if(modal) modal.classList.remove("open");
};
window.mtSaveIdentitySimple = function(){
  mtWriteIdentitySimple({
    name: document.getElementById("mtIdentitySimpleName")?.value?.trim() || "",
    gender: document.getElementById("mtIdentitySimpleGender")?.value || ""
  });
  mtCloseIdentitySimple();
  if(window.mtToast) mtToast("Identité enregistrée");
  setTimeout(()=>location.reload(), 220);
};


/* V59 · Connexion & Sécurité style réglages compact */
window.mtOpenSecuritySheet = async function(initialView = "home"){
  const client = initSupabase && initSupabase();
  const { data } = client ? await client.auth.getSession() : { data: null };
  if(!data?.session?.user){
    if(window.mtToast) mtToast("Connecte-toi pour gérer tes accès.");
    location.href = "auth.html?next=" + encodeURIComponent("dashboard.html");
    return;
  }

  let modal = document.getElementById("mtSecuritySheet");
  if(!modal){
    modal = document.createElement("div");
    modal.id = "mtSecuritySheet";
    modal.className = "ritual-signal-drawer";
    document.body.appendChild(modal);
  }
  modal.classList.toggle("mt-installed-context", mtIsInstalledAppMode());
  modal.classList.toggle("mt-browser-context", !mtIsInstalledAppMode());

  modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseSecuritySheet()"></div>
    <div class="ritual-signal-sheet saved-sheet mt-security-sheet mt-security-apple">
      <div class="ritual-signal-grip"></div>
      <button class="ritual-signal-close" onclick="mtCloseSecuritySheet()">×</button>

      <section class="mt-security-view active" id="mtSecurityHomeView">
        <div class="ritual-signal-kicker">Connexion & sécurité</div>
        <h3>Gérer mes accès</h3>
        <p class="saved-library-intro">Protège ton espace Méthode Tee et garde tes informations à jour.</p>

        <button type="button" class="mt-settings-row" onclick="mtSecurityOpenView('password')">
          <span class="mt-settings-icon">🔐</span>
          <span class="mt-settings-text"><b>Changer mon mot de passe</b><small>Protège l’accès à ton espace.</small></span>
          <span class="mt-settings-arrow">→</span>
        </button>

        <button type="button" class="mt-settings-row" onclick="mtSecurityOpenView('email')">
          <span class="mt-settings-icon">✉️</span>
          <span class="mt-settings-text"><b>Modifier mon adresse e-mail</b><small>Recevoir un lien de confirmation.</small></span>
          <span class="mt-settings-arrow">→</span>
        </button>

        <button type="button" class="mt-settings-row" onclick="mtSecurityOpenView('devices')">
          <span class="mt-settings-icon">🛡️</span>
          <span class="mt-settings-text"><b>Appareils connectés</b><small>Sécuriser les sessions ouvertes.</small></span>
          <span class="mt-settings-arrow">→</span>
        </button>

        <button type="button" id="mtDeleteAccountEntry" class="mt-settings-row mt-settings-row-danger mt-delete-entry" onclick="mtSecurityOpenView('delete')">
          <span class="mt-settings-icon">🗑️</span>
          <span class="mt-settings-text"><b>Supprimer mon compte</b><small>Demander la suppression définitive de ton espace.</small></span>
          <span class="mt-settings-arrow">→</span>
        </button>
      </section>

      <section class="mt-security-view" id="mtSecurityPasswordView">
        <button type="button" class="mt-security-back" onclick="mtSecurityOpenView('home')">← Retour</button>
        <div class="ritual-signal-kicker">Mot de passe</div>
        <h3>Créer un nouveau mot de passe</h3>
        <p class="saved-library-intro">Choisis un mot de passe que toi seule connais.</p>
        <div class="mt-security-form-card">
          <label>Nouveau mot de passe</label>
          <input id="mtNewPasswordInput" type="password" autocomplete="new-password" minlength="8" placeholder="Minimum 8 caractères">
          <button type="button" onclick="mtSaveNewPasswordFromProfile()">Enregistrer</button>
          <p id="mtSecurityPasswordMessage"></p>
        </div>
      </section>

      <section class="mt-security-view" id="mtSecurityEmailView">
        <button type="button" class="mt-security-back" onclick="mtSecurityOpenView('home')">← Retour</button>
        <div class="ritual-signal-kicker">Adresse e-mail</div>
        <h3>Modifier mon adresse e-mail</h3>
        <p class="saved-library-intro">Un lien de confirmation sera envoyé à la nouvelle adresse.</p>
        <div class="mt-security-form-card">
          <label>Nouvelle adresse e-mail</label>
          <input id="mtNewEmailInput" type="email" autocomplete="email" placeholder="nouvelle-adresse@email.com">
          <button type="button" onclick="mtSaveNewEmailFromProfile()">Envoyer le lien</button>
          <p id="mtSecurityEmailMessage"></p>
        </div>
      </section>

      <section class="mt-security-view" id="mtSecurityDevicesView">
        <button type="button" class="mt-security-back" onclick="mtSecurityOpenView('home')">← Retour</button>
        <div class="ritual-signal-kicker">Appareils connectés</div>
        <h3>Sécuriser mon compte</h3>
        <p class="saved-library-intro">Cette action déconnecte ton compte sur tous les appareils, puis te ramène à la connexion.</p>
        <div class="mt-security-form-card mt-devices-card">
          <div class="mt-device-line"><span>📱</span><div><b>Sessions actives</b><small>Compte connecté sur un ou plusieurs appareils.</small></div></div>
          <button type="button" onclick="mtSignOutEverywhere()">Déconnecter tous les appareils</button>
          <p id="mtSecurityDevicesMessage"></p>
        </div>
      </section>

      <section class="mt-security-view" id="mtSecurityDeleteView">
        <button type="button" class="mt-security-back" onclick="mtSecurityOpenView('home')">← Retour</button>
        <div class="ritual-signal-kicker">Suppression du compte</div>
        <h3>Supprimer mon compte</h3>
        <p class="saved-library-intro">
          Cette action supprime définitivement ton compte Méthode Tee et les données personnelles associées à ton espace.
          Tes progressions, favoris, rappels et accès liés au compte seront retirés.
        </p>
        <div class="mt-security-form-card mt-delete-account-card">
          <div class="mt-delete-warning">
            <b>Action définitive</b>
            <small>Pour confirmer, écris SUPPRIMER ci-dessous.</small>
          </div>
          <label>Confirmation</label>
          <input id="mtDeleteAccountConfirmInput" type="text" autocomplete="off" placeholder="SUPPRIMER">
          <button type="button" class="mt-delete-account-btn" onclick="mtDeleteMyAccount()">Supprimer définitivement mon compte</button>
          <p id="mtSecurityDeleteMessage"></p>
        </div>
      </section>
    </div>`;
  modal.classList.add("open");
  mtSecurityOpenView(initialView);
};

window.mtCloseSecuritySheet = function(){
  const modal = document.getElementById("mtSecuritySheet");
  if(modal) modal.classList.remove("open");
};

window.mtSecurityOpenView = function(view){
  const views = {
    home: "mtSecurityHomeView",
    password: "mtSecurityPasswordView",
    email: "mtSecurityEmailView",
    devices: "mtSecurityDevicesView",
    delete: "mtSecurityDeleteView"
  };
  Object.values(views).forEach(id => document.getElementById(id)?.classList.remove("active"));
  document.getElementById(views[view] || views.home)?.classList.add("active");
  setTimeout(()=>{
    if(view === "password") document.getElementById("mtNewPasswordInput")?.focus();
    if(view === "email") document.getElementById("mtNewEmailInput")?.focus();
    if(view === "delete") document.getElementById("mtDeleteAccountConfirmInput")?.focus();
  }, 180);
};

window.mtSaveNewPasswordFromProfile = async function(){
  const msg = document.getElementById("mtSecurityPasswordMessage");
  const input = document.getElementById("mtNewPasswordInput");
  const password = input?.value || "";
  if(msg) msg.textContent = "Enregistrement...";
  try{
    if(!password || password.length < 8) throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
    const client = initSupabase && initSupabase();
    if(!client) throw new Error("Connexion Supabase indisponible.");
    const { error } = await client.auth.updateUser({ password });
    if(error) throw error;
    if(msg) msg.textContent = "Mot de passe modifié";
    if(window.mtToast) mtToast("Mot de passe modifié");
    if(input) input.value = "";
    setTimeout(()=>mtSecurityOpenView("home"), 900);
  }catch(err){
    if(msg) msg.textContent = err.message || "Impossible de modifier le mot de passe.";
  }
};

window.mtSaveNewEmailFromProfile = async function(){
  const msg = document.getElementById("mtSecurityEmailMessage");
  const input = document.getElementById("mtNewEmailInput");
  const email = input?.value?.trim() || "";
  if(msg) msg.textContent = "Envoi du lien...";
  try{
    if(!email || !email.includes("@")) throw new Error("Entre une adresse e-mail valide.");
    const client = initSupabase && initSupabase();
    if(!client) throw new Error("Connexion Supabase indisponible.");
    const { error } = await client.auth.updateUser({ email });
    if(error) throw error;
    if(msg) msg.textContent = "Lien de confirmation envoyé. Vérifie ta boîte mail.";
    if(window.mtToast) mtToast("Confirmation envoyée");
  }catch(err){
    if(msg) msg.textContent = err.message || "Impossible de modifier l’adresse e-mail.";
  }
};

window.mtSignOutEverywhere = async function(){
  const msg = document.getElementById("mtSecurityDevicesMessage");
  if(!confirm("Déconnecter ce compte de tous les appareils ?")) return;
  if(msg) msg.textContent = "Déconnexion...";
  try{
    const client = initSupabase && initSupabase();
    if(!client) throw new Error("Connexion Supabase indisponible.");
    const { error } = await client.auth.signOut({ scope: "global" });
    if(error) throw error;
    if (typeof window.mtClearPrivateDeviceData === "function") await window.mtClearPrivateDeviceData();
    location.href = "auth.html";
  }catch(err){
    if(msg) msg.textContent = err.message || "Impossible de déconnecter tous les appareils.";
  }
};

window.mtDeleteMyAccount = async function(){
  const input = document.getElementById("mtDeleteAccountConfirmInput");
  const msg = document.getElementById("mtSecurityDeleteMessage");
  const btn = document.querySelector(".mt-delete-account-btn");
  const value = String(input?.value || "").trim().toUpperCase();

  if(value !== "SUPPRIMER"){
    if(msg) msg.textContent = "Écris SUPPRIMER pour confirmer la suppression du compte.";
    return;
  }

  if(!confirm("Confirmer la suppression définitive de ton compte Méthode Tee ? Cette action est irréversible.")) return;

  try{
    if(btn) btn.disabled = true;
    if(msg) msg.textContent = "Suppression du compte en cours…";
    await mtCallFunction("delete-account", { confirm: "SUPPRIMER" });
    try { await initSupabase().auth.signOut({ scope: "global" }); } catch(e) {}
    if (typeof window.mtClearPrivateDeviceData === "function") await window.mtClearPrivateDeviceData();
    if(msg) msg.textContent = "Compte supprimé.";
    setTimeout(()=>{ location.href = "auth.html?deleted=1"; }, 800);
  }catch(err){
    if(btn) btn.disabled = false;
    if(msg) msg.textContent = err?.message || "Impossible de supprimer le compte pour l’instant. Contacte hello@methodetee.app.";
  }
};

// Efface les données privées conservées uniquement sur l'appareil, y compris
// les repères photo IndexedDB. Utilisé après déconnexion et suppression.
window.mtClearPrivateDeviceData = async function(){
  try { localStorage.clear(); } catch (_) {}
  try { sessionStorage.clear(); } catch (_) {}
  if (typeof window.mtClearProgressPhotoStorage === 'function') {
    try { await window.mtClearProgressPhotoStorage(); return; } catch (_) {}
  }
  if (!('indexedDB' in window)) return;
  await new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase('methode_tee_private_photos_v1');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    } catch (_) { resolve(); }
  });
};



window.mtOpenVisualMarkers = async function(){
  const overlay=document.createElement('div');
  overlay.className='mt-visual-markers-overlay';
  overlay.innerHTML=`<section class="mt-visual-markers-sheet"><header><div><small>Mon suivi personnel</small><h2>Mes repères visuels</h2><p>Photos privées stockées uniquement sur cet appareil.</p></div><button type="button" onclick="this.closest('.mt-visual-markers-overlay').remove()">×</button></header><div class="mt-visual-markers-body"><p class="mt-visual-markers-loading">Chargement local…</p></div></section>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('open'));
  const body=overlay.querySelector('.mt-visual-markers-body');
  try{
    const items=typeof window.mtListProgressPhotos==='function' ? await window.mtListProgressPhotos() : [];
    if(!items.length){ body.innerHTML='<div class="mt-visual-markers-empty"><b>Aucun repère enregistré</b><p>Ajoute une photo depuis un contenu « Photo privée / repère visuel » dans un protocole.</p></div>'; return; }
    const protocols=await fetchProtocols();
    const titles=new Map((protocols||[]).map(p=>[String(p.id),p.title]));
    const roleLabel={start:'Départ',progress:'Intermédiaire',final:'Final'};
    body.innerHTML=`<div class="mt-visual-markers-grid">${items.map(item=>`<article class="mt-visual-marker-card" data-local-photo-key="${escapeHTML(item.key||'')}">
      <img src="${escapeHTML(item.dataUrl||'')}" alt="Repère visuel privé">
      <div><small>${escapeHTML(titles.get(String(item.protocolId))||'Protocole')}</small><h3>${escapeHTML(item.title||`Repère ${roleLabel[item.role]||''}`)}</h3><p>${escapeHTML(roleLabel[item.role]||'Repère')} · ${item.updatedAt||item.createdAt?new Date(item.updatedAt||item.createdAt).toLocaleDateString('fr-FR'):''}</p>${item.note?`<blockquote>${escapeHTML(item.note)}</blockquote>`:''}</div>
      <button type="button" onclick="mtDeleteVisualMarker('${escapeHTML(item.key||'')}',this)">Supprimer</button>
    </article>`).join('')}</div>`;
  }catch(e){ body.innerHTML=`<div class="mt-visual-markers-empty"><b>Impossible d’ouvrir les repères</b><p>${escapeHTML(e?.message||'Stockage local indisponible.')}</p></div>`; }
};
window.mtDeleteVisualMarker=async function(key,button){
  if(!confirm('Supprimer définitivement ce repère local ?')) return;
  button.disabled=true;
  try{
    await window.mtDeleteProgressPhotoByKey(key);
    button.closest('.mt-visual-marker-card')?.remove();
    if(!document.querySelector('.mt-visual-marker-card')) document.querySelector('.mt-visual-markers-body').innerHTML='<div class="mt-visual-markers-empty"><b>Aucun repère enregistré</b></div>';
  }catch(e){button.disabled=false;alert(e?.message||'Suppression impossible.');}
};

async function renderDashboard(options = {}) {
  const el = document.getElementById("dashboardSummary");
  if (!el) return;
  const renderSeq = (window.__MT_DASHBOARD_RENDER_SEQ__ || 0) + 1;
  window.__MT_DASHBOARD_RENDER_SEQ__ = renderSeq;
  const user = await mtRequireUser();
  if (!user || renderSeq !== window.__MT_DASHBOARD_RENDER_SEQ__) return;

  // Toutes les données indépendantes sont chargées en parallèle. Avant, elles
  // étaient attendues l'une après l'autre et l'état du jour était demandé deux fois.
  const [owned, access, saved, todayState, journeySummary] = await Promise.all([
    mtPromiseTimeout(fetchOwnedIds(), 4000, []),
    mtPromiseTimeout(mtHasLimitedAccess(), 3500, false),
    mtPromiseTimeout(mtSavedCounts(), 3000, { favorites:0, routines:0 }),
    mtPromiseTimeout(window.mtBuildTodayState ? window.mtBuildTodayState() : Promise.resolve(null), 4500, null),
    mtPromiseTimeout(window.mtCommunityJourneyGetProfileSummary ? window.mtCommunityJourneyGetProfileSummary() : Promise.resolve(null), 3500, null)
  ]);
  if(renderSeq !== window.__MT_DASHBOARD_RENDER_SEQ__) return;
  const continueHTML = await mtPromiseTimeout(mtContinueJourneyHTML(owned || []), 2500, "");
  const identityHTML = await mtIdentitySimpleHTML(todayState);
  const todayHydration = todayState ? String(todayState.hydration || 0).replace('.', ',') : '0';
  const todaySleep = todayState ? mtTodaySleepLabel(todayState.sleep) : 'À renseigner';
  window.__MT_JOURNEY_PROFILE_SUMMARY__ = journeySummary || null;
  const journeyToday=journeySummary?.today||{};
  const journeySettings=journeySummary?.settings||{};
  const journeyLabel=journeySettings.profile_label||'Notre journée';
  const journeyChip=journeySettings.show_profile_progress===false?'':`<span class="parcours-journey-chip" onclick="event.stopPropagation();window.mtOpenCommunityJourneyDate&&window.mtOpenCommunityJourneyDate(new Date().toLocaleDateString('sv-SE'))">${mtIconHTML('sparkle','parcours-chip-icon')} ${escapeHTML(journeyLabel)} · ${Number(journeyToday.completed||0)} / ${Number(journeyToday.total||0)}</span>`;
  const activeProgressLine = todayState?.active ? `${todayState.active.title} · jour ${todayState.active.day} sur ${todayState.active.total}` : 'Aucun protocole actif';
  const teeBalanceContext = { todayState, journeySummary };
  window.__MT_TEE_BALANCE_CONTEXT__ = teeBalanceContext;
  const teeBalanceHTML = window.mtTeeBalanceInitialHTML ? window.mtTeeBalanceInitialHTML(teeBalanceContext) : '';
  el.innerHTML = `${identityHTML}${continueHTML}
    <div class="mt-profile-section-heading reveal"><span>Mon espace</span><h2>Mes contenus</h2></div>
    <div class="mt-profile-main-stack reveal">
      <article class="mini-card glass saved-profile-card mt-profile-stack-card mt-profile-access-card" onclick="mtOpenUnlockedProtocols()"><b>${mtIconHTML(access ? "key" : "lock", "saved-editorial-icon")}</b><h2>Mes accès</h2><p>Protocoles, recettes et contenus déjà disponibles</p><span class="mt-profile-card-action">Voir mes accès →</span></article>
      <article class="mini-card glass saved-profile-card mt-profile-stack-card" onclick="mtOpenUnlockedProtocols()"><b>${mtIconHTML("book", "saved-editorial-icon")}</b><h2>${owned.length}</h2><p>Protocoles débloqués</p></article>
      <article class="mini-card glass saved-profile-card mt-profile-stack-card" onclick="location.href='approche.html'"><b>${mtIconHTML("sparkle", "saved-editorial-icon")}</b><h2>L’approche Méthode Tee</h2><p>Une méthode imaginée par Teeyana</p></article>
      <article class="mini-card glass saved-profile-card mt-profile-stack-card" onclick="mtOpenSavedCollection('favorites')"><b>♡</b><h2>Mes favoris</h2><p>${saved.favorites} contenu${saved.favorites > 1 ? "s" : ""} sauvegardé${saved.favorites > 1 ? "s" : ""}</p></article>
      <article class="mini-card glass saved-profile-card mt-profile-stack-card" onclick="mtOpenMyRoutines('profile')"><b>${mtIconHTML("leaf", "saved-editorial-icon")}</b><h2>Mes routines</h2><p>${saved.routines} routine${saved.routines > 1 ? "s" : ""} personnelle${saved.routines > 1 ? "s" : ""}</p></article>
    </div>

    <div class="mt-profile-section-heading reveal"><span>Mon suivi personnel</span><h2>Observer mon évolution</h2></div>
    <article class="daily-journal-card reveal" onclick="mtOpenParcoursSheet('journal')">
      <div class="daily-journal-icon">${mtIconHTML("journal", "daily-journal-line-icon")}</div>
      <div>
        <div class="daily-journal-kicker">Journal privé</div>
        <h2>Écrire aujourd’hui</h2>
        <p>Un espace libre pour déposer ce que tu veux, jour après jour.</p>
      </div>
      <span class="daily-journal-arrow">→</span>
    </article>

    ${teeBalanceHTML}

    <article class="mini-card glass saved-profile-card mt-profile-stack-card mt-profile-visual-markers" onclick="mtOpenVisualMarkers()">
      <b>${mtIconHTML("sparkle", "saved-editorial-icon")}</b><h2>Mes repères visuels</h2>
      <p>Retrouver mes photos privées stockées sur cet appareil</p><span class="mt-profile-card-action">Ouvrir →</span>
    </article>

    <article class="parcours-card reveal" onclick="mtOpenParcoursSheet()">
      <div class="parcours-card-left">
        <div class="parcours-card-kicker">Espace personnel confidentiel</div>
        <h2>Mon parcours</h2>
        <p>Ton évolution jour après jour.</p>
        <div class="parcours-card-today"><b>${mtIconHTML('calendar','parcours-chip-icon')} Aujourd’hui</b><span>${mtIconHTML('check','parcours-chip-icon')} ${todayState?.completed || 0} missions terminées</span><span>${mtIconHTML('hydration','parcours-chip-icon')} ${todayHydration} / 2 L</span><span data-parcours-sleep>${mtIconHTML('sleep','parcours-chip-icon')} ${escapeHTML(todaySleep)}</span><span>${mtIconHTML('leaf','parcours-chip-icon')} ${escapeHTML(activeProgressLine)}</span>${journeyChip}</div>
        <div class="parcours-card-badges">
          <span>${mtIconHTML("calendar", "parcours-badge-icon")} Calendrier</span>
          <span>${mtIconHTML("journal", "parcours-badge-icon")} Journal</span>
          <span>${mtIconHTML("tracker", "parcours-badge-icon")} Trackers</span>
          <span>${mtIconHTML("checklist", "parcours-badge-icon")} Checklists</span>
        </div>
      </div>
      <div class="parcours-card-cta">Voir →</div>
    </article>

    

    <div class="mt-profile-section-heading reveal"><span>Préférences et compte</span><h2>Gérer mon espace</h2></div>
    <div class="mt-profile-trust-stack reveal">
      <article class="trust-app-card mt-profile-tight-card" onclick="location.href='confiance.html'">
        <div class="trust-app-icon">${mtIconHTML("shield", "profile-card-icon")}</div>
        <div>
          <div class="trust-app-kicker">Espace confiance</div>
          <h2>Confiance & Confidentialité</h2>
          <p>Protection des données, paiements sécurisés, contenus privés et cadre bien-être.</p>
        </div>
        <span class="trust-app-arrow">→</span>
      </article>

      <article class="trust-app-card mt-profile-tight-card" onclick="location.href='privacy.html'">
        <div class="trust-app-icon">${mtIconHTML("shield", "profile-card-icon")}</div>
        <div><div class="trust-app-kicker">Données personnelles</div><h2>Politique de confidentialité</h2><p>Données traitées, conservation, suppression et exercice de tes droits.</p></div>
        <span class="trust-app-arrow">→</span>
      </article>

      <article class="trust-app-card mt-profile-tight-card" onclick="location.href='mentions-legales.html'">
        <div class="trust-app-icon">${mtIconHTML("book", "profile-card-icon")}</div>
        <div><div class="trust-app-kicker">Informations juridiques</div><h2>Mentions légales</h2><p>Éditeur, société, hébergement et propriété intellectuelle.</p></div>
        <span class="trust-app-arrow">→</span>
      </article>

      <article class="trust-app-card security-app-card mt-profile-tight-card" onclick="mtOpenSecuritySheet()">
        <div class="trust-app-icon">${mtIconHTML("key", "profile-card-icon")}</div>
        <div>
          <div class="trust-app-kicker">Connexion & sécurité</div>
          <h2>Gérer mes accès</h2>
          <p>Mot de passe, adresse e-mail et appareils connectés.</p>
        </div>
        <span class="trust-app-arrow">→</span>
      </article>

      ${mtIdentitySettingsCardHTML()}

      <article class="trust-app-card mt-profile-tight-card" onclick="location.href='assistance.html'">
        <div class="trust-app-icon">${mtIconHTML("mail", "profile-card-icon")}</div>
        <div>
          <div class="trust-app-kicker">Support</div>
          <h2>Assistance & Contact</h2>
          <p>FAQ, aide, support achat et informations de contact.</p>
        </div>
        <span class="trust-app-arrow">→</span>
      </article>

      <article class="push-notif-card mt-profile-tight-card" id="pushNotifCard">
        <div class="push-notif-icon">${mtIconHTML("bell", "profile-card-icon")}</div>
        <div class="push-notif-body">
          <div class="push-notif-kicker">Rappels doux</div>
          <h2>Notifications</h2>
          <p id="pushNotifDesc">Le corps aime la régularité. Ton rituel du soir t’attend, ou prends 2 minutes pour revenir à toi.</p>
        </div>
        <button type="button" class="push-notif-btn journey-push-btn" id="pushNotifBtn" aria-label="Activer les notifications"
          onclick="window.mtEnablePushNotifications ? window.mtEnablePushNotifications() : alert('Module notifications non chargé')">
          <span>Activer</span>
        </button>
      </article>

      <section class="form-card mt-ios-restore-card mt-profile-tight-card" data-mt-apple-restore hidden aria-hidden="true">
        <button type="button" class="ghost-btn" onclick="mtRestoreApplePurchases()">Restaurer mes achats Apple</button>
      </section>

    </div>
    <div class="mt-profile-version reveal">
      <strong>Méthode Tee</strong>
      <span>Version 1.0.2</span>
      <small>© 2026 Teeyana</small>
    </div>`;
  observeReveal();
  if(window.mtRefreshTeeBalance) window.mtRefreshTeeBalance({source:'profile',context:teeBalanceContext});
  mtSyncAppleRestoreVisibility();

  setTimeout(()=>window.mtAnimateXPWidgets && window.mtAnimateXPWidgets(), 120);
}
function observeReveal() {
  const items = document.querySelectorAll(".reveal:not(.observed)");
  const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }), { threshold: .08 });
  items.forEach(i => { i.classList.add("observed"); obs.observe(i); });
}

async function renderLibraryPage() {
  const el = document.getElementById("libraryPage");
  if (!el) return;

  const user = await mtRequireUser();
  if (!user) return;

  const client = initSupabase();
  const owned = await fetchOwnedIds();
  const ownedSet = new Set((owned || []).map(String));

  function mtLibraryNormalizeType(type) {
    const t = String(type || "document").toLowerCase().trim();
    if (["pdf", "document", "private_doc", "journal_private", "journal", "file", "fichier"].includes(t)) return "pdf";
    if (["ebook", "e-book", "book", "livre"].includes(t)) return "ebook";
    if (["guide_plantes", "guide plante", "guide-plantes", "plante", "plant", "herbier"].includes(t)) return "guide_plantes";
    if (["video", "vidéo"].includes(t)) return "video";
    if (["audio", "playlist", "podcast"].includes(t)) return "audio";
    if (["recette", "recipe"].includes(t)) return "recette";
    if (["routine", "rituel"].includes(t)) return "routine";
    if (["checklist", "check-list"].includes(t)) return "checklist";
    if (["tracker", "suivi", "calendar", "calendrier"].includes(t)) return "tracker";
    if (["tableau", "table", "sheet"].includes(t)) return "tableau";
    return t;
  }

  function mtLibraryDurationDays(protocol) {
    const fromLabel = String(protocol?.duration_label || protocol?.duration || "").match(/\d+/)?.[0];
    const days = Number(protocol?.total_days || fromLabel || 1);
    return Math.max(1, days || 1);
  }

  function mtLibraryCurrentDay(progress, protocol) {
    const total = mtLibraryDurationDays(protocol);
    if (!progress) return 1;

    const rawStart = progress.started_at || progress.created_at;
    let timeDay = 1;

    if (rawStart) {
      const start = new Date(rawStart);
      if (!isNaN(start.getTime())) {
        const firstUnlock = new Date(start);
        firstUnlock.setDate(firstUnlock.getDate() + 1);
        firstUnlock.setHours(7, 0, 0, 0);

        const now = new Date();
        if (now >= firstUnlock) {
          const diff = now.getTime() - firstUnlock.getTime();
          timeDay = 2 + Math.floor(diff / 86400000);
        }
      }
    }

    // On garde la même logique que le parcours :
    // un jour peut être disponible via le temps à 7h ou via la progression déjà enregistrée,
    // mais jamais au-delà du total du protocole.
    const manualDay = Math.max(1, Number(progress.current_day || 1));
    return Math.max(1, Math.min(total, Math.max(manualDay, timeDay)));
  }

  let purchasedRecipes = [];
  if (client) {
    const fullPreview = typeof mtHasFullPreviewAccess === "function" ? await mtHasFullPreviewAccess() : (typeof mtIsAdmin === "function" ? await mtIsAdmin() : false);
    if (fullPreview) {
      const { data: reviewRecipes, error: reviewRecipesError } = await client
        .from("recipes")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (reviewRecipesError) console.warn("review library recipes read error", reviewRecipesError);
      purchasedRecipes = (reviewRecipes || [])
        .filter(r => r.id)
        .map(r => ({ ...r, purchased_at: new Date().toISOString(), library_source: "review" }));
    } else {
    const email = user.email || "";
    let recipePurchaseQuery = client
      .from("recipe_purchases")
      .select("recipe_id, purchased_at, recipes(*)")
      .eq("status", "active");

    if (email) {
      recipePurchaseQuery = recipePurchaseQuery.or(`user_id.eq.${user.id},user_email.eq.${email}`);
    } else {
      recipePurchaseQuery = recipePurchaseQuery.eq("user_id", user.id);
    }

    const { data: recipeRows, error: recipeRowsError } = await recipePurchaseQuery
      .order("purchased_at", { ascending: false });

    if (recipeRowsError) console.warn("recipe library read error", recipeRowsError);
    purchasedRecipes = (recipeRows || [])
      .map(r => ({ ...(r.recipes || {}), purchased_at: r.purchased_at, library_source: "purchase" }))
      .filter(r => r.id);
    }
  }

  // Recettes gratuites ajoutées au cœur : affichées aussi dans Biblio > Recette.
  // Ce complément lit uniquement les favoris locaux, sans toucher au paiement ni aux déblocages premium.
  const savedLocal = mtReadSavedLocal(user.id);
  const purchasedRecipeIds = new Set(purchasedRecipes.map(r => String(r.id)).filter(Boolean));
  const favoriteRecipes = (savedLocal.favorites || [])
    .filter(item => item && item.source === "recipe_favorite" && item.recipe_id)
    .filter(item => !purchasedRecipeIds.has(String(item.recipe_id)))
    .map(item => ({
      id: String(item.recipe_id),
      title: item.title || "Recette Méthode Tee",
      description: item.content || "Recette sauvegardée dans tes favoris.",
      subtitle: item.content || "",
      emoji: item.emoji || "🥣",
      saved_at: item.saved_at || item.created_at,
      library_source: "favorite"
    }));

  let contents = [];
  if (client) {
    const protocols = await fetchProtocols();

    // Biblio doit être un miroir des parcours réellement accessibles,
    // sans toucher à Stripe ni au webhook externe.
    // Source principale : fetchOwnedIds() (user_protocols + accès locaux + admin).
    // Source de secours sûre : protocol_progress du compte connecté,
    // car le parcours l'utilise déjà pour les jours débloqués à 7h.
    let progressRows = [];
    const { data: allProgressData, error: allProgressError } = await client
      .from("protocol_progress")
      .select("*")
      .eq("user_id", user.id);

    if (allProgressError) console.warn("library progress read error", allProgressError);
    progressRows = allProgressData || [];

    const progressIds = new Set(progressRows.map(p => String(p.protocol_id)).filter(Boolean));
    const accessSet = new Set([...ownedSet, ...progressIds]);

    const ownedProtocols = (protocols || []).filter(p =>
      accessSet.has(String(p.id)) || accessSet.has(String(p.slug))
    );
    const protocolIds = [...new Set(ownedProtocols.map(p => p.id).filter(Boolean).map(String))];

    const protocolById = new Map(ownedProtocols.map(p => [String(p.id), p]));
    const progressByProtocolId = new Map(progressRows.map(p => [String(p.protocol_id), p]));

    if (protocolIds.length) {
      const { data, error } = await client
        .from("protocol_contents")
        .select("*, protocols(title, emoji, category)")
        .in("protocol_id", protocolIds)
        .neq("active", false)
        .order("sort_order", { ascending: true });

      if (error) {
        console.warn("library protocol_contents read error", error);
      } else {
        contents = (data || []).filter(c => {
          const protocol = protocolById.get(String(c.protocol_id));
          const progress = progressByProtocolId.get(String(c.protocol_id));
          const unlockedDay = mtLibraryCurrentDay(progress, protocol);
          const contentDay = Number(c.day_number || 0);
          return !contentDay || contentDay <= unlockedDay;
        });
      }
    }
  }

  const categories = [
    { key: "pdf", label: "PDF premium", iconKey: "book" },
    { key: "ebook", label: "Ebook", iconKey: "book" },
    { key: "guide_plantes", label: "Guide terrain", iconKey: "leaf" },
    { key: "video", label: "Vidéo", iconKey: "sparkle" },
    { key: "audio", label: "Audio", iconKey: "bell" },
    { key: "recette", label: "Recette", iconKey: "bowl" },
    { key: "routine", label: "Routine", iconKey: "leaf" },
    { key: "checklist", label: "Checklist", iconKey: "check" },
    { key: "tracker", label: "Tracker", iconKey: "chart" },
    { key: "tableau", label: "Tableau", iconKey: "chart" }
  ];

  const countByType = contents.reduce((acc, c) => {
    const key = mtLibraryNormalizeType(c.type);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  countByType.recette = (countByType.recette || 0) + purchasedRecipes.length + favoriteRecipes.length;

  const categoryCards = categories.map(cat => {
    const count = countByType[cat.key] || 0;
    return `<article class="library-category reveal">
      <b>${mtIconHTML(cat.iconKey || cat.key, "library-category-icon")}</b>
      <h2>${cat.label}</h2>
      <p>${count} contenu${count > 1 ? "s" : ""}</p>
    </article>`;
  }).join("");

  const libraryRecipes = [...purchasedRecipes, ...favoriteRecipes];
  const recipeCards = libraryRecipes.map(r => `<article class="content-card reveal recipe-owned-card ${r.library_source === "favorite" ? "recipe-favorite-library-card" : ""}">
      <span>${mtIconHTML("bowl", "recipe-card-icon")}</span>
      <h2>${escapeHTML(r.title || "Recette")}</h2>
      <p>${escapeHTML(r.description || r.subtitle || (r.library_source === "favorite" ? "Recette sauvegardée dans tes favoris." : "Recette premium débloquée."))}</p>
      <small>${r.library_source === "favorite" ? "Recette favorite" : "Recette achetée"}</small>
      <button class="download-link as-button" onclick="openRecipeViewer('${escapeHTML(r.id)}')">Ouvrir la recette</button>
    </article>`).join("");

  const contentCards = contents.map(c => {
    const url = c.public_url || c.file_url || c.video_url || c.file_path || "";
    const key = mtLibraryNormalizeType(c.type);
    const meta = categories.find(cat => cat.key === key) || { iconKey: "book", label: "Contenu" };
    return `<article class="content-card reveal">
      <span>${mtIconHTML(meta.iconKey || key, "recipe-card-icon")}</span>
      <h2>${escapeHTML(c.title || meta.label || "Contenu")}</h2>
      <p>${escapeHTML(c.description || c.content_text || "")}</p>
      <small>${escapeHTML(c.protocols?.title || "Protocole privé")}</small>
      ${url ? `<button class="download-link as-button" onclick="openSignedProtocolFile('${c.id}')">${key === "video" ? "Ouvrir la vidéo" : "Ouvrir / télécharger"}</button>` : ""}
    </article>`;
  }).join("");

  el.innerHTML = `
    <div class="kicker">Bibliothèque privée</div>
    <h1 class="page-title">Tes contenus<br><em>débloqués</em></h1>
    <p class="lead">Tous les PDFs, vidéos, recettes, routines, trackers et fichiers liés aux protocoles achetés.</p>
    <section class="library-grid">${categoryCards}</section>
    <section class="content-list">${recipeCards}${contentCards || (recipeCards ? "" : `<div class="empty-card"><h2>Aucun contenu débloqué</h2><p>Les contenus apparaîtront ici après achat et déblocage d’un protocole ou d’une recette.</p></div>`)}</section>
  `;
  observeReveal();
}


// V211 — rendu stable : une seule construction à la fois par page.
// Empêche les doubles cartes lors des événements réseau / reprise d'app.
const mtRenderLibraryPageCore = renderLibraryPage;
renderLibraryPage = function(){
  if(window.__MT_LIBRARY_RENDER_PROMISE__) return window.__MT_LIBRARY_RENDER_PROMISE__;
  window.__MT_LIBRARY_RENDER_PROMISE__ = Promise.resolve(mtRenderLibraryPageCore()).finally(()=>{ window.__MT_LIBRARY_RENDER_PROMISE__ = null; });
  return window.__MT_LIBRARY_RENDER_PROMISE__;
};

const mtRenderDashboardCore = renderDashboard;
renderDashboard = function(options = {}){
  if(window.__MT_DASHBOARD_RENDER_PROMISE__) return window.__MT_DASHBOARD_RENDER_PROMISE__;
  window.__MT_DASHBOARD_RENDER_PROMISE__ = Promise.resolve(mtRenderDashboardCore(options)).finally(()=>{ window.__MT_DASHBOARD_RENDER_PROMISE__ = null; });
  return window.__MT_DASHBOARD_RENDER_PROMISE__;
};

document.addEventListener("DOMContentLoaded", async () => {
  // Peindre d'abord les éléments structurels locaux. Les contrôles d'accès et
  // la synchronisation distante continuent ensuite sans faire flasher la page.
  renderTopActions();
  const navReady = renderNav();
  if(!(await mtEnsurePrivatePageAccess())) return;
  await autoUnlockFromSuccess();
  await navReady;
  renderHomeFeed();
  renderProtocolsPage();
  renderProtocolDetail();
  renderCustomPage();
  await renderDashboard();
  mtSyncAppleRestoreVisibility();
  // La bibliothèque premium possède son propre orchestrateur de rendu.
  // Ne jamais la lancer ici : cela créait deux requêtes/rendus concurrents.
  setTimeout(() => {
    if (typeof window.mtRefreshPushButtons === 'function') window.mtRefreshPushButtons();
    if ('Notification' in window && Notification.permission === 'granted') {
      const btn = document.getElementById('pushNotifBtn');
      const desc = document.getElementById('pushNotifDesc');
      if (btn) { btn.classList.add('is-on'); btn.textContent = 'Rappels activés ✓'; btn.disabled = true; }
      if (desc) desc.textContent = 'Tes rappels doux sont activés : le corps aime la régularité.';
    }
  }, 800);
});

/* =========================================================
   V20 — RECETTES MARKETPLACE SAFE
   Page Recettes = découverte + vente
   Biblio > Recette = recettes déjà achetées
   ========================================================= */

async function mtGetPurchasedRecipeIds() {
  const user = await mtGetUser();
  if (!user) return [];
  const client = initSupabase();
  if (!client) return [];

  const fullPreview = typeof mtHasFullPreviewAccess === "function" ? await mtHasFullPreviewAccess() : (typeof mtIsAdmin === "function" ? await mtIsAdmin() : false);
  if (fullPreview) {
    const { data, error } = await client
      .from("recipes")
      .select("id")
      .eq("active", true);
    if (error) console.warn("review recipes read error", error);
    return [...new Set((data || []).map(r => String(r.id)).filter(Boolean))];
  }

  // Lecture renforcée :
  // 1) user_id = compte connecté
  // 2) fallback user_email = email du compte connecté
  // Cela évite qu'une recette payée reste visuellement verrouillée
  // si Stripe renvoie surtout l'email client.
  const email = user.email || "";
  let query = client
    .from("recipe_purchases")
    .select("recipe_id")
    .eq("status", "active");

  if (email) {
    query = query.or(`user_id.eq.${user.id},user_email.eq.${email}`);
  } else {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("recipe_purchases read error", error);
    return [];
  }

  return [...new Set((data || []).map(r => String(r.recipe_id)).filter(Boolean))];
}

async function mtFetchRecipes() {
  const client = initSupabase();
  if (client) {
    const { data, error } = await client
      .from("recipes")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (!error && data?.length) return data;
  }
  return [
    {
      id: "smoothie-glow-demo",
      title: "Smoothie Glow Rouge",
      subtitle: "Peau, énergie douce, envie sucrée apaisée",
      description: "Une recette fruitée, fraîche et simple pour nourrir le glow sans tomber dans le sucre lourd.",
      category: "Glow peau",
      mood: "Énergie douce",
      emoji: "🍓",
      image_url: "",
      is_premium: false,
      price_cents: 0,
      content_text: "Ingrédients : fruits rouges, banane, yaourt végétal ou lait, graines de chia.\nPréparation : mixer, servir frais, ajouter quelques fruits secs Maison Yanna en topping."
    },
    {
      id: "latte-sommeil-demo",
      title: "Latte Sommeil Velours",
      subtitle: "Routine du soir, douceur, détente",
      description: "Un latte chaud et réconfortant pensé comme un rituel du soir.",
      category: "Sommeil",
      mood: "Soir calme",
      emoji: "🌙",
      image_url: "",
      is_premium: true,
      price_cents: 500,
      content_text: "Preview : une base végétale chaude, des notes douces, une préparation lente et apaisante."
    }
  ];
}

async function startSecureCheckoutRecipe(recipeId) {
  try {
    if(mtIsIOSNativeApp()) {
      const recipes = await mtFetchRecipes();
      const recipe = recipes.find(r => String(r.id) === String(recipeId));
      if(!recipe) throw new Error("Recette introuvable.");
      const result = await mtAppleIAPPurchase({ purchase_type:"recipe", item_id:recipe.id, product_id:recipe.apple_product_id });
      if(result?.unlocked) location.reload();
      return;
    }
    const result = await mtCallFunction("create-recipe-checkout-session", { recipe_id: recipeId });
    const checkoutUrl = result?.url || result?.checkout_url;
    if(checkoutUrl) mtOpenExternalUrl(checkoutUrl); else alert("Lien de paiement indisponible.");
  } catch (err) { alert(err?.message || "Impossible d’ouvrir le paiement de la recette."); }
}

window.startSecureCheckoutRecipe = startSecureCheckoutRecipe;

function mtRecipeSavedItem(recipe) {
  return {
    id: `recipe-${recipe?.id || Date.now()}`,
    recipe_id: String(recipe?.id || ""),
    source: "recipe_favorite",
    title: recipe?.title || "Recette Méthode Tee",
    content: recipe?.description || recipe?.subtitle || "",
    type: "Recette",
    created_at: recipe?.created_at || new Date().toISOString(),
    saved_at: new Date().toISOString()
  };
}

async function mtIsRecipeFavorite(recipeId) {
  const user = await mtGetUser();
  if (!user) return false;
  const data = mtReadSavedLocal(user.id);
  return (data.favorites || []).some(x => String(x.recipe_id || x.id) === String(recipeId) || String(x.id) === `recipe-${recipeId}`);
}

window.mtToggleRecipeFavorite = async function(recipeId, btn) {
  const user = await mtRequireAuthForSave();
  if (!user) return;
  const recipes = await mtFetchRecipes();
  const recipe = recipes.find(r => String(r.id) === String(recipeId));
  if (!recipe) return;

  // Le favori ne modifie aucun droit commercial.
  // Une recette premium est ajoutable uniquement si elle est déjà réellement possédée.
  if (recipe.is_premium) {
    const purchasedIds = await mtGetPurchasedRecipeIds();
    const owned = purchasedIds.map(String).includes(String(recipe.id));
    if (!owned) return;
  }

  return window.mtFavoriteToggleItem(mtRecipeSavedItem(recipe), btn);
};

function mtRecipeCard(recipe, purchasedIds = []) {
  const owned = !recipe.is_premium || purchasedIds.includes(recipe.id);
  const price = recipe.is_premium ? euros(recipe.price_cents || 500) : "Gratuit";
  const badge = owned ? "Disponible" : (recipe.is_premium ? price : "Gratuit");
  const img = recipe.image_url
    ? `<div class="recipe-img"><img src="${escapeHTML(recipe.image_url)}" alt="" loading="eager" decoding="async" fetchpriority="high"></div>`
    : "";
  const favoriteBtn = owned
    ? `<button type="button" class="recipe-favorite-btn" data-recipe-favorite="${escapeHTML(recipe.id)}" onclick="event.stopPropagation(); mtToggleRecipeFavorite('${escapeHTML(recipe.id)}', this)" aria-label="Ajouter aux favoris">♡</button>`
    : "";
  return `<article class="recipe-market-card reveal ${recipe.is_premium ? "is-premium" : "is-free"}">
    ${img}
    <div class="recipe-market-body">
      <div class="recipe-market-top"><span>${escapeHTML(recipe.category || "Recette")}</span><div class="recipe-market-actions">${favoriteBtn}<b>${escapeHTML(badge)}</b></div></div>
      <h2>${escapeHTML(recipe.title || "Recette")}</h2>
      <p>${escapeHTML(recipe.subtitle || recipe.description || "")}</p>
      <div class="recipe-market-meta">
        <span>${escapeHTML(recipe.mood || "Rituel nutrition")}</span>
        ${recipe.is_premium && !owned ? `<span class="premium-tag"><i class="premium-star" aria-hidden="true">✦</i>Premium</span>` : `<span>✓ Disponible</span>`}
      </div>
      ${owned
        ? `<button class="download-link as-button" onclick="openRecipeViewer('${escapeHTML(recipe.id)}')">Voir la recette</button>`
        : `<button class="download-link as-button" onclick="startSecureCheckoutRecipe('${escapeHTML(recipe.id)}')">Débloquer la recette</button>`}
    </div>
  </article>`;
}

async function mtRefreshRecipeFavoriteButtons() {
  const user = await mtGetUser();
  const buttons = document.querySelectorAll('[data-recipe-favorite]');
  if (!buttons.length || !user) return;
  const data = mtReadSavedLocal(user.id);
  const favIds = new Set((data.favorites || []).map(x => String(x.recipe_id || "")).filter(Boolean));
  buttons.forEach(btn => {
    const id = String(btn.getAttribute('data-recipe-favorite') || '');
    const saved = favIds.has(id) || (data.favorites || []).some(x => String(x.id) === `recipe-${id}`);
    btn.classList.toggle('is-saved', saved);
    btn.innerHTML = saved ? '♥' : '♡';
    btn.setAttribute('aria-label', saved ? 'Retirer des favoris' : 'Ajouter aux favoris');
  });
}


async function renderRecipesMarketplace() {
  const el = document.getElementById("customPage");
  if (!el) return;

  const recipeChips = [
    { key:'all', label:'Tout', sub:'Toutes' },
    { key:'breakfast', label:'Petit-déjeuner', sub:'Réveil', field:'meal_type' },
    { key:'daily', label:'Repas', sub:'Cuisine', field:'meal_type' },
    { key:'bowl', label:'Bowls', sub:'Complet', words:['bowl','bol','poke'] },
    { key:'snack', label:'Collations', sub:'Pause', field:'meal_type' },
    { key:'dinner', label:'Dîner', sub:'Réconfort', field:'meal_type' },
    { key:'sweet', label:'Desserts', sub:'Gourmand', field:'meal_type' },
    { key:'drink', label:'Boissons', sub:'Fraîcheur', field:'meal_type' }
  ];

  // Le titre, le filtre et la grille existent dès le HTML initial. On les rétablit
  // uniquement si cette page a été ouverte depuis un ancien rendu personnalisé.
  let filterMount = el.querySelector('.mt-recipes-filter-mount');
  let grid = el.querySelector('#recipeMarketGrid');
  if (!filterMount || !grid) {
    el.innerHTML = `<div class="kicker">🥣 Espace privé</div>
      <h1 class="page-title">Recettes<br><em>Méthode Tee</em></h1>
      <p class="lead">Découvre des idées repas, boissons, bowls, lattes et routines nutrition. Les recettes premium se débloquent ici puis se rangent automatiquement dans ta bibliothèque.</p>
      <div class="mt-recipes-filter-mount"></div>
      <section id="recipeMarketGrid" class="recipe-market-grid" aria-live="polite"></section>`;
    filterMount = el.querySelector('.mt-recipes-filter-mount');
    grid = el.querySelector('#recipeMarketGrid');
  }
  filterMount.innerHTML = mtPremiumChipFilter("recipe", recipeChips);

  const user = await mtRequireUser();
  if (!user) return;

  const [recipes, purchasedIds] = await Promise.all([mtFetchRecipes(), mtGetPurchasedRecipeIds()]);
  const recipeCardsMarkup = recipes.map(r => mtRecipeCard(r, purchasedIds)).join("") ||
    `<div class="empty-card"><h2>Aucune recette trouvée</h2><p>Essaie un autre filtre.</p></div>`;

  // Aucun préchargement bloquant : les cartes sont insérées immédiatement, puis
  // chaque image se charge indépendamment sans masquer le reste de la page.
  grid.innerHTML = recipeCardsMarkup;

  mtApplyPremiumChipFilter({
    items: recipes,
    filterId: "recipeFilters",
    targetId: "recipeMarketGrid",
    chips: recipeChips,
    render: (r) => mtRecipeCard(r, purchasedIds),
    emptyHTML: `<div class="empty-card"><h2>Aucune recette trouvée</h2><p>Essaie un autre filtre.</p></div>`
  });
  mtRefreshRecipeFavoriteButtons();
  observeReveal();
}


function mtRecipeDecodeEntities(value) {
  const text = String(value || "");
  if (!text || !/&(?:amp|lt|gt|quot|#39|#039);/i.test(text)) return text;
  const area = document.createElement("textarea");
  area.innerHTML = text;
  return area.value;
}

function mtRecipeExtractMeta(recipe) {
  const raw = String(recipe.full_content || "");
  const match = raw.match(/^\s*\[MT_META\]([\s\S]*?)\[\/MT_META\]\s*/i);
  let meta = {};
  if (match) {
    try { meta = JSON.parse(match[1]); } catch(e) { meta = {}; }
  }
  return {
    meta,
    content: match ? raw.slice(match[0].length) : (recipe.full_content || recipe.content_text || recipe.description || "")
  };
}

function mtRecipeSplitLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
}

function mtRecipeNormalizeTitle(line) {
  return String(line || "")
    .trim()
    .replace(/^[-•*]\s*/, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/[：:]\s*$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function mtRecipeHeadingKind(line) {
  const clean = mtRecipeNormalizeTitle(line);
  if (/^(ingr[eé]dients?|ingredients?|il vous faut|liste des ingr[eé]dients?)(?:\s*\([^)]*\))?$/.test(clean)) return "ingredients";
  if (/^(pr[eé]paration|preparation|[eé]tapes?|etapes?|r[eé]alisation|la recette)(?:\s*\([^)]*\))?$/.test(clean)) return "preparation";
  if (/^(conseil(?: de tee| m[eé]thode tee)?|note(?: de tee)?|astuce|astuce m[eé]thode tee|petit plus)(?:\s*\([^)]*\))?$/.test(clean)) return "advice";
  if (/^(variante|variantes|alternative|alternatives|alternative simple)(?:\s*\([^)]*\))?$/.test(clean)) return "variants";
  if (/^(conservation)(?:\s*\([^)]*\))?$/.test(clean)) return "conservation";
  if (/^(rituel|rituel du repas|moment id[eé]al|quand la consommer)(?:\s*\([^)]*\))?$/.test(clean)) return "ritual";
  if (/^([aà] savoir|pr[eé]caution|pr[eé]cautions|pourquoi [cç]a fonctionne)(?:\s*\([^)]*\))?$/.test(clean)) return "know";
  return "";
}

function mtRecipeLineKind(line, current) {
  const raw = String(line || "").trim();
  const headingKind = mtRecipeHeadingKind(raw);
  if (headingKind) return headingKind;
  const clean = mtRecipeNormalizeTitle(raw);
  if (/^(p[aâ]te|garniture|topping|sauce|cr[eè]me|d[eé]coration|base|option|options|version simple|version express)$/.test(clean)) {
    return current || "ingredients";
  }
  const looksLikeIngredient = /^(?:[-•*]\s*)?(?:\d+\s*(?:g|kg|ml|cl|l)\b|\d+[,.]?\d*\s*(?:c\.|cuill[eè]re|pinc[eé]e|poign[eé]e|tranche|feuille|zeste|jus|verre|tasse|sachet)|\d+\s+[^.!?]{2,80}$|une?\s+(?:pinc[eé]e|poign[eé]e|cuill[eè]re|tranche|feuille|zeste|gousse|petit|gros)|quelques\s+|sel$|poivre$|[½¼¾]\s*c\.)/i.test(raw);
  const looksLikeStep = /^(?:\d+[.)]\s*)?(pr[eé]chauffe|m[eé]lange|ajoute|verse|incorpore|fais|laisse|d[eé]pose|dispose|saupoudre|pars[eè]me|replie|enfourne|filtre|chauffe|mix[e]?|coupe|d[eé]coupe|forme|sers|savoure|d[eé]guste|retire|porte|prends|r[eé]alise|conserve)\b/i.test(raw);
  if (!current || !["ingredients","preparation"].includes(current)) {
    if (looksLikeStep) return "preparation";
    if (looksLikeIngredient) return "ingredients";
  }
  return current || "advice";
}

function mtRecipeIngredientStar() {
  return `<span class="mt-recipe-official-star" aria-hidden="true">✦</span>`;
}

function mtRecipeSectionFromLines(title, lines, mode = "bullet") {
  if (!lines || !lines.length) return "";
  const items = lines.map((line, idx) => {
    const clean = line.replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, "");
    if (mode === "steps") return `<li class="mt-recipe-step"><span>${idx + 1}</span><p>${escapeHTML(clean)}</p></li>`;
    return `<li class="mt-recipe-ingredient">${mtRecipeIngredientStar()}<p>${escapeHTML(clean)}</p></li>`;
  }).join("");
  return `<section class="mt-recipe-editorial-section">
    <div class="mt-recipe-section-kicker">${escapeHTML(title)}</div>
    <ul class="${mode === "steps" ? "mt-recipe-steps" : "mt-recipe-ingredients"}">${items}</ul>
  </section>`;
}

function mtRecipeEditorialTextSection(title, lines, kind) {
  if (!lines || !lines.length) return "";
  const paragraphs = lines.map(line => `<p>${escapeHTML(String(line).replace(/^[-•*]\s*/, ""))}</p>`).join("");
  return `<section class="mt-recipe-editorial-section mt-recipe-note-section mt-recipe-note--${escapeHTML(kind)}">
    <div class="mt-recipe-section-kicker">${escapeHTML(title)}</div>
    <div class="mt-recipe-note-copy">${paragraphs}</div>
  </section>`;
}

function mtRecipeParseSections(recipe) {
  const extracted = mtRecipeExtractMeta(recipe);
  const lines = mtRecipeSplitLines(extracted.content);
  const sections = { ingredients:[], preparation:[], advice:[], variants:[], conservation:[], ritual:[], know:[] };
  let current = "";
  lines.forEach(line => {
    const explicitTitle = !!mtRecipeHeadingKind(line);
    const kind = mtRecipeLineKind(line, current);
    if (explicitTitle) { current = kind; return; }
    current = kind;
    (sections[kind] || sections.advice).push(line);
  });
  if (!sections.ingredients.length && !sections.preparation.length && lines.length) sections.preparation = lines;
  return { ...sections, meta: extracted.meta };
}

function mtRecipeRelatedProtocolCard(protocol) {
  if (!protocol) return "";
  const category = protocol.category || "pharmacie_vegetale";
  const id = protocol.id || protocol.slug || "";
  return `<button type="button" class="mt-recipe-protocol-meta" onclick="mtGoToRelatedProtocol('${escapeHTML(id)}','${escapeHTML(category)}')" aria-label="Voir le protocole ${escapeHTML(mtRecipeDecodeEntities(protocol.title || "Méthode Tee"))}">
    <strong>${escapeHTML(mtRecipeDecodeEntities(protocol.title || "Protocole Méthode Tee"))}</strong>
    <span>À retrouver dans ce protocole</span>
    <i aria-hidden="true">→</i>
  </button>`;
}

function mtGoToRelatedProtocol(protocolId, category) {
  try { localStorage.setItem("mt_focus_protocol_id", String(protocolId || "")); } catch(e) {}
  closeMedia();
  location.href = `protocols.html?category=${encodeURIComponent(category || "pharmacie_vegetale")}`;
}
window.mtGoToRelatedProtocol = mtGoToRelatedProtocol;

function mtRecipeNutritionGrid(meta) {
  const items = [
    [meta.time, "Temps"], [meta.portions, "Portions"], [meta.calories, "Calories"],
    [meta.proteins, "Protéines"], [meta.carbs, "Glucides"], [meta.fats, "Lipides"]
  ].filter(([value]) => String(value || "").trim());
  if (!items.length) return "";
  return `<section class="mt-recipe-nutrition"><div class="mt-recipe-section-kicker">Repères nutritionnels</div><div class="mt-recipe-nutrition-grid">${items.map(([value,label]) => `<div><strong>${escapeHTML(value)}</strong><span>${escapeHTML(label)}</span></div>`).join("")}</div></section>`;
}

function mtRecipeBuildEditorialContent(recipe, relatedProtocol = null) {
  const parsed = mtRecipeParseSections(recipe);
  const intro = recipe.description || recipe.subtitle || "";
  return `
    ${intro ? `<section class="mt-recipe-intro-card"><p>${escapeHTML(intro)}</p></section>` : ""}
    <section class="mt-recipe-meta-grid">
      <div><strong>${escapeHTML(recipe.category || "Recette")}</strong><span>Univers</span></div>
      <div><strong>${escapeHTML(recipe.mood || "Rituel")}</strong><span>Intention</span></div>
      <div><strong>${recipe.is_premium ? "Disponible" : "Libre"}</strong><span>Accès</span></div>
    </section>
    ${mtRecipeNutritionGrid(parsed.meta)}
    ${mtRecipeRelatedProtocolCard(relatedProtocol)}
    ${mtRecipeSectionFromLines("Ingrédients", parsed.ingredients, "bullet")}
    ${mtRecipeSectionFromLines("Préparation", parsed.preparation, "steps")}
    ${mtRecipeEditorialTextSection("Conseil de Tee", parsed.advice, "advice")}
    ${mtRecipeEditorialTextSection("Variantes", parsed.variants, "variants")}
    ${mtRecipeEditorialTextSection("Conservation", parsed.conservation, "conservation")}
    ${mtRecipeEditorialTextSection("Rituel du repas", parsed.ritual, "ritual")}
    ${mtRecipeEditorialTextSection("À savoir", parsed.know, "know")}
  `;
}

function mtRecipePlainSections(recipe) {
  return mtRecipeParseSections(recipe);
}



function mtPdfCleanText(value) {
  return String(value || "")
    .replace(/conseil\s+du\s+coach/gi, "Note de Tee")
    .replace(/note\s+du\s+coach/gi, "Note de Tee")
    .replace(/coach/gi, "Tee");
}

function mtRecipePdfSection(title, items, ordered = false) {
  if (!items || !items.length) return "";
  const cleanItems = items.map(i => escapeHTML(String(i).replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, ""))).filter(Boolean);
  const body = cleanItems.map((item, index) => {
    if (ordered) {
      return `<li><span class="step-num">${String(index + 1).padStart(2, "0")}</span><div class="step-copy">${item}</div></li>`;
    }
    return `<li><span class="ingredient-dot">✦</span><div class="ingredient-copy">${item}</div></li>`;
  }).join("");
  const tag = ordered ? "ol" : "ul";
  return `<section class="pdf-card pdf-section ${ordered ? "pdf-steps" : "pdf-ingredients"}"><h2>${escapeHTML(title)}</h2><${tag}>${body}</${tag}></section>`;
}

function mtRecipeEnsurePdfModal() {
  let modal = document.getElementById("mtRecipePdfModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "mtRecipePdfModal";
  modal.className = "mt-pdf-modal";
  modal.innerHTML = `
    <div class="mt-pdf-backdrop" onclick="closeRecipePDFViewer()"></div>
    <div class="mt-pdf-shell">
      <div class="mt-pdf-topbar">
        <div>
          <small>FICHE ÉDITORIALE</small>
          <strong>Recette Méthode Tee</strong>
        </div>
        <div class="mt-pdf-topbar-actions"><button class="mt-pdf-share" type="button" onclick="shareRecipePDF()" aria-label="Partager le carnet">↗</button><button class="mt-pdf-close" type="button" onclick="closeRecipePDFViewer()">×</button></div>
      </div>

      <div class="mt-pdf-loader">
        <div class="mt-private-loader-card">
          <div class="mt-private-loader-star"><img src="assets/brand-compass-star-transparent.png" alt=""></div>
          <small id="mtPdfLoaderNumber">Carnet Signature</small>
          <h3>Préparation de<br>ta fiche privée...</h3>
          <p id="mtPdfLoaderTitle">Ta recette est en cours de finalisation.</p>
          <div class="mt-private-loader-image"><img id="mtPdfLoaderImage" alt=""></div>
          <div class="mt-private-loader-progress"><span id="mtPdfLoaderBar"></span></div>
          <strong id="mtPdfLoaderPercent">0%</strong>
          <div class="mt-private-loader-steps" id="mtPdfLoaderSteps">
            <span data-step="1">Sélection<br>des ingrédients</span>
            <span data-step="2">Préparation<br>de la fiche</span>
            <span data-step="3">Mise en page<br>immersive</span>
          </div>
          <em>Merci pour ta confiance.</em>
        </div>
        <div class="mt-private-book-card" aria-hidden="true">
          <small id="mtPdfBookNumber">Carnet Signature</small>
          <h3 id="mtPdfBookTitle">Recette privée</h3>
          <p>Édition privée</p>
        </div>
      </div>

      <div class="mt-pdf-preview-wrap">
        <iframe id="mtRecipePdfFrame" class="mt-pdf-frame" title="Aperçu PDF recette"></iframe>
      </div>

      <div class="mt-pdf-actions">
        <button type="button" class="mt-pdf-secondary" onclick="closeRecipePDFViewer()">Fermer</button>
        <button type="button" class="mt-pdf-save" onclick="saveRecipePDF()">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function closeRecipePDFViewer() {
  const modal = document.getElementById("mtRecipePdfModal");
  if (modal) {
    modal.classList.remove("is-open", "is-ready", "is-book-opening");
    setTimeout(() => {
      const frame = document.getElementById("mtRecipePdfFrame");
      if (frame) { frame.srcdoc = ""; frame.removeAttribute("src"); }
      MT_CURRENT_RECIPE_PDF_URL = "";
      MT_CURRENT_RECIPE_PDF_TITLE = "Recette Méthode Tee";
      MT_CURRENT_RECIPE_PDF_FILE_PROMISE = null;
      modal.style.display = "none";
      document.body.classList.remove("mt-pdf-open");
    }, 220);
  }
}

async function mtRecipePdfFile(){
  if(!MT_CURRENT_RECIPE_PDF_URL) return null;
  if(MT_CURRENT_RECIPE_PDF_FILE_PROMISE) return MT_CURRENT_RECIPE_PDF_FILE_PROMISE;
  MT_CURRENT_RECIPE_PDF_FILE_PROMISE=(async()=>{
    try{
      const response=await fetch(MT_CURRENT_RECIPE_PDF_URL,{credentials:'omit',cache:'force-cache'});
      if(!response.ok) throw new Error('Téléchargement indisponible');
      const blob=await response.blob();
      const safe=String(MT_CURRENT_RECIPE_PDF_TITLE||'recette-methodetee').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
      return new File([blob],`${safe||'recette-methodetee'}.pdf`,{type:'application/pdf'});
    }catch(e){MT_CURRENT_RECIPE_PDF_FILE_PROMISE=null;return null;}
  })();
  return MT_CURRENT_RECIPE_PDF_FILE_PROMISE;
}
function mtRecipeCanShareFile(file){
  try{return !!(file&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})));}catch(e){return false;}
}
async function mtRecipeShareFile(file,mode){
  if(!mtRecipeCanShareFile(file)) return false;
  try{
    await navigator.share({title:MT_CURRENT_RECIPE_PDF_TITLE,text:mode==='save'?'Enregistre ce carnet dans Fichiers pour le conserver.':'Carnet recette Méthode Tee',files:[file]});
    return true;
  }catch(e){return e?.name==='AbortError';}
}
function mtRecipeDownloadFile(file){
  const url=URL.createObjectURL(file),a=document.createElement('a');
  a.href=url;a.download=file.name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function saveRecipePDF(){
  const file=await mtRecipePdfFile();
  if(!file){alert('Le carnet ne peut pas être téléchargé pour le moment.');return;}
  if(await mtRecipeShareFile(file,'save')) return;
  mtRecipeDownloadFile(file);
}
async function shareRecipePDF(){
  const file=await mtRecipePdfFile();
  if(!file){alert('Le carnet ne peut pas être préparé pour le partage.');return;}
  if(await mtRecipeShareFile(file,'share')) return;
  mtRecipeDownloadFile(file);
}
window.saveRecipePDF=saveRecipePDF;
window.shareRecipePDF=shareRecipePDF;

function mtRecipeSignatureNumber(recipe, recipes = [], recipeId = "") {
  const explicit = recipe?.carnet_number || recipe?.signature_number || recipe?.book_number;
  if (explicit) return String(explicit).replace(/^0+/, "").padStart(3, "0").slice(-3);
  const index = Array.isArray(recipes) ? recipes.findIndex(r => String(r.id) === String(recipeId || recipe?.id)) : -1;
  if (index >= 0 && recipes.length > 1) return String(index + 1).padStart(3, "0");
  const seed = String(recipe?.id || recipeId || recipe?.title || "recette");
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash * 31) + seed.charCodeAt(i)) % 999;
  return String(hash + 1).padStart(3, "0");
}

function mtRecipeLoaderSetSteps(value) {
  document.querySelectorAll("#mtPdfLoaderSteps span").forEach((step, index) => {
    const threshold = [18, 55, 88][index] || 100;
    step.classList.toggle("is-done", value >= threshold);
  });
}

function mtRecipePdfSetLoader(recipe, carnetNumber) {
  const title = recipe?.title || "Recette privée";
  const img = recipe?.image_url || "";
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText("mtPdfLoaderNumber", `Carnet Signature n°${carnetNumber}`);
  setText("mtPdfBookNumber", `Carnet Signature n°${carnetNumber}`);
  setText("mtPdfLoaderTitle", title);
  setText("mtPdfBookTitle", title);
  const topTitle=document.querySelector('#mtRecipePdfModal .mt-pdf-topbar strong');
  if(topTitle) topTitle.textContent=title;
  MT_CURRENT_RECIPE_PDF_TITLE=title;
  const imageEl = document.getElementById("mtPdfLoaderImage");
  if (imageEl) {
    if (img) {
      imageEl.src = img;
      imageEl.parentElement?.classList.remove("is-empty");
    } else {
      imageEl.removeAttribute("src");
      imageEl.parentElement?.classList.add("is-empty");
    }
  }
  const bar = document.getElementById("mtPdfLoaderBar");
  const percent = document.getElementById("mtPdfLoaderPercent");
  if (bar) bar.style.width = "0%";
  if (percent) percent.textContent = "0%";
  mtRecipeLoaderSetSteps(0);
  let value = 0;
  const timer = setInterval(() => {
    value = Math.min(94, value + Math.floor(8 + Math.random() * 13));
    if (bar) bar.style.width = value + "%";
    if (percent) percent.textContent = value + "%";
    mtRecipeLoaderSetSteps(value);
    if (value >= 94) clearInterval(timer);
  }, 150);
  return timer;
}

function mtRecipePdfFinishLoader(timer) {
  clearInterval(timer);
  const bar = document.getElementById("mtPdfLoaderBar");
  const percent = document.getElementById("mtPdfLoaderPercent");
  if (bar) bar.style.width = "100%";
  if (percent) percent.textContent = "100%";
  mtRecipeLoaderSetSteps(100);
}

let MT_CURRENT_RECIPE_PDF_URL = "";
let MT_CURRENT_RECIPE_PDF_TITLE = "Recette Méthode Tee";
let MT_CURRENT_RECIPE_PDF_FILE_PROMISE = null;

async function downloadRecipePDF(recipeId) {
  const modal = mtRecipeEnsurePdfModal();
  modal.style.display = "block";
  document.body.classList.add("mt-pdf-open");

  requestAnimationFrame(() => {
    modal.classList.add("is-open");
    modal.classList.remove("is-ready", "is-book-opening");
  });

  let loaderTimer = null;

  try {
    const recipes = await mtFetchRecipes();
    const recipe = recipes.find(r => String(r.id) === String(recipeId));
    if (!recipe) throw new Error("Recette introuvable.");

    const purchasedIds = await mtGetPurchasedRecipeIds();
    const owned = !recipe.is_premium || purchasedIds.includes(String(recipe.id));
    if (!owned) {
      closeRecipePDFViewer();
      return startSecureCheckoutRecipe(recipe.id);
    }

    const carnetNumber = mtRecipeSignatureNumber(recipe, recipes, recipeId);
    loaderTimer = mtRecipePdfSetLoader(recipe, carnetNumber);
    const pdfStartTime = Date.now();

    // Si un PDF premium a été uploadé via l’admin, on le garde uniquement
    // pour le bouton “Partager / PDF”. L’aperçu reste le viewer HTML premium,
    // afin que la cliente voie l’expérience carnet avant de télécharger le PDF.
    const uploadedPdfUrl = recipe.pdf_url || recipe.recipe_pdf_url || recipe.pdf_file_url || "";
    MT_CURRENT_RECIPE_PDF_URL = uploadedPdfUrl || "";
    MT_CURRENT_RECIPE_PDF_FILE_PROMISE = null;
    const { ingredients, preparation, advice, variants, conservation, ritual, know, meta } = mtRecipePlainSections(recipe);
    const notes = [...advice, ...variants, ...conservation, ...ritual, ...know];
    const title = recipe.title || "Recette Méthode Tee";
    const subtitle = recipe.subtitle || recipe.description || "Une recette privée pensée comme un rituel simple, doux et intentionnel.";
    const category = recipe.category || "Recette";
    const mood = recipe.mood || "Rituel";
    const access = recipe.is_premium ? "Disponible" : "Libre";
    const emoji = recipe.emoji || "🥣";
    const imageUrl = recipe.image_url || "";

    const image = imageUrl
      ? `<figure class="cover-visual"><img src="${escapeHTML(imageUrl)}" alt=""></figure>`
      : `<figure class="cover-visual fallback"><span>${escapeHTML(emoji)}</span></figure>`;
    const imageRibbon = imageUrl
      ? `<div class="image-ribbon"><img src="${escapeHTML(imageUrl)}" alt=""></div>`
      : "";
    const noteText = mtPdfCleanText(notes && notes.length
      ? notes.join(" ")
      : "À savourer lentement, comme une pause. L’intention compte autant que la recette.");

    const prepChunks = [];
    for (let i = 0; i < preparation.length; i += 4) prepChunks.push(preparation.slice(i, i + 4));
    const ingredientItems = ingredients.map((item, i) => `<li><span>${String(i+1).padStart(2,'0')}</span><p>${escapeHTML(mtPdfCleanText(String(item).replace(/^[-•*]\\s*/, "")))}</p></li>`).join("");
    const prepPages = (prepChunks.length ? prepChunks : [[]]).map((chunk, pageIndex) => {
      const prepItems = chunk.map((item, i) => `<li><span>${String(pageIndex*4+i+1).padStart(2,'0')}</span><p>${escapeHTML(mtPdfCleanText(String(item).replace(/^[-•*]\\s*/, "").replace(/^\\d+[.)]\\s*/, "")))}</p></li>`).join("");
      return `<main class="pdf-page pdf-content-page">
        <div class="pdf-page-head"><small>Préparation</small><b>${pageIndex === 0 ? "Le rituel" : "La suite"}</b></div>
        <section class="pdf-soft-card"><ol class="pdf-list pdf-steps-list">${prepItems}</ol></section>
        ${pageIndex === prepChunks.length - 1 ? `<section class="pdf-note-card"><small>Note de Tee</small><p>${escapeHTML(noteText)}</p></section>` : ""}
        <footer>${escapeHTML(title)}<span>Page ${3 + pageIndex}</span></footer>
      </main>`;
    }).join("");

    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)} · Méthode Tee</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:#f6f1e8; color:#201c18; font-family: Helvetica, Arial, sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .pdf-page { width:210mm; height:297mm; margin:0 auto; padding:18mm; position:relative; overflow:hidden; page-break-after:always; background:#fbf7ef; }
  .pdf-page:last-child{ page-break-after:auto; }
  .pdf-page:before{ content:""; position:absolute; inset:9mm; border:1px solid rgba(184,146,74,.18); border-radius:28px; pointer-events:none; }
  .pdf-brand{ position:relative; z-index:2; display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12mm; }
  .pdf-brand-logo{ font:italic 28px Georgia,serif; color:#173f35; line-height:1; }
  .pdf-brand-sub{ margin-top:5px; color:#8c7561; font-size:7.5px; text-transform:uppercase; letter-spacing:.36em; font-weight:700; }
  .pdf-pill{ border:1px solid rgba(23,63,53,.16); border-radius:999px; padding:9px 13px; background:rgba(255,255,255,.65); color:#173f35; font-size:8px; text-transform:uppercase; letter-spacing:.22em; font-weight:800; }
  .pdf-cover{ background:linear-gradient(135deg,#fbf7ef 0%,#f7efe0 55%,#173f35 55%,#0c1814 100%); }
  .pdf-cover:after{ content:""; position:absolute; width:118mm; height:118mm; border-radius:50%; background:#bd9445; left:-24mm; top:18mm; opacity:.94; }
  .pdf-cover-content{ position:relative; z-index:2; }
  .pdf-eyebrow{ color:#b8924a; text-transform:uppercase; letter-spacing:.34em; font-weight:900; font-size:9px; margin-bottom:8mm; }
  .pdf-title{ font:400 43px/0.95 Georgia,serif; letter-spacing:-.035em; margin:0; color:#1f1b17; max-width:145mm; }
  .pdf-title em{ display:block; color:#173f35; font-style:italic; }
  .pdf-subtitle{ margin:6mm 0 9mm; color:#725f52; font-size:13px; line-height:1.55; max-width:145mm; }
  .pdf-photo{ height:86mm; border-radius:18px; overflow:hidden; border:1px solid rgba(255,255,255,.28); box-shadow:0 18px 40px rgba(0,0,0,.22); background:#eadfcd; }
  .pdf-photo img{ width:100%; height:100%; object-fit:cover; display:block; }
  .pdf-photo.fallback{display:grid;place-items:center;font-size:54px;}
  .pdf-meta-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:5mm; margin-top:7mm; }
  .pdf-meta{ background:rgba(255,255,255,.82); border:1px solid rgba(184,146,74,.2); border-radius:13px; padding:5mm 3mm; text-align:center; }
  .pdf-meta strong{ display:block; color:#173f35; font:400 16px Georgia,serif; line-height:1.05; }
  .pdf-meta span{ display:block; margin-top:4px; color:#8c7561; font-size:7px; text-transform:uppercase; letter-spacing:.22em; font-weight:800; }
  .pdf-quote{ margin-top:8mm; padding:6mm 8mm; border-radius:16px; background:#173f35; color:#fffdf7; font:italic 17px/1.4 Georgia,serif; }
  .pdf-content-page{ background:radial-gradient(circle at 88% 18%, rgba(184,146,74,.13), transparent 32%), #fbf7ef; }
  .pdf-page-head{ position:relative; z-index:2; margin-bottom:10mm; }
  .pdf-page-head small, .pdf-note-card small{ display:block; color:#b8924a; text-transform:uppercase; letter-spacing:.34em; font-weight:900; font-size:9px; margin-bottom:5mm; }
  .pdf-page-head b{ display:block; color:#173f35; font:400 34px/1 Georgia,serif; }
  .pdf-ribbon{ position:relative; z-index:2; height:45mm; border-radius:18px; overflow:hidden; margin-bottom:8mm; border:1px solid rgba(184,146,74,.16); }
  .pdf-ribbon img{ width:100%; height:100%; object-fit:cover; display:block; }
  .pdf-soft-card, .pdf-note-card{ position:relative; z-index:2; background:rgba(255,255,255,.86); border:1px solid rgba(23,63,53,.08); border-radius:22px; padding:9mm; box-shadow:0 16px 35px rgba(23,63,53,.055); margin-bottom:8mm; }
  .pdf-list{ margin:0; padding:0; list-style:none; }
  .pdf-list li{ display:grid; grid-template-columns:12mm 1fr; gap:5mm; align-items:start; margin-bottom:6mm; color:#201c18; break-inside:avoid; }
  .pdf-list li:last-child{ margin-bottom:0; }
  .pdf-list span{ width:9mm; height:9mm; border-radius:999px; background:#173f35; color:#fffdf7; display:grid; place-items:center; font-size:8px; font-weight:900; margin-top:1mm; }
  .pdf-ingredients-list span{ background:#e8ebe5; color:#173f35; }
  .pdf-list p{ margin:0; font-size:15px; line-height:1.55; }
  .pdf-steps-list p{ font-size:14px; }
  .pdf-note-card p{ margin:0; font:italic 18px/1.55 Georgia,serif; color:#725f52; }
  .pdf-ritual-card{ position:relative; z-index:2; display:grid; grid-template-columns:1fr 68mm; gap:9mm; align-items:center; }
  .pdf-ritual-card .pdf-photo{ height:72mm; }
  .pdf-closing{ position:relative; z-index:2; background:#173f35; color:#fffdf7; border-radius:24px; padding:11mm; margin-top:10mm; }
  .pdf-closing small{ color:#d7bd7a; text-transform:uppercase; letter-spacing:.32em; font-size:8px; font-weight:900; }
  .pdf-closing h2{ margin:5mm 0; font:400 35px/1 Georgia,serif; color:#fffdf7; }
  .pdf-closing p{ margin:0; color:rgba(255,253,247,.78); line-height:1.65; font-size:13px; }
  footer{ position:absolute; left:18mm; right:18mm; bottom:8mm; display:flex; justify-content:space-between; color:rgba(140,117,97,.72); font-size:7px; z-index:4; }
  @media screen{ body{padding:18px;} .pdf-page{ width:min(100%,820px); height:auto; min-height:780px; border-radius:28px; margin-bottom:18px; padding:28px; box-shadow:0 24px 80px rgba(23,63,53,.12); } .pdf-page:before{ inset:10px; border-radius:23px;} footer{ position:static; margin-top:26px;} .pdf-title{font-size:clamp(44px,12vw,76px);} .pdf-meta-grid{grid-template-columns:1fr;} .pdf-ritual-card{grid-template-columns:1fr;} }
  @media print{
    html,body{background:white;margin:0!important;padding:0!important;}
    .pdf-page{
      width:210mm!important;
      height:297mm!important;
      min-height:297mm!important;
      margin:0!important;
      padding:18mm!important;
      border-radius:0!important;
      box-shadow:none!important;
      page-break-after:always;
      break-after:page;
      page-break-inside:avoid;
      break-inside:avoid;
    }
    .pdf-page:last-child{page-break-after:auto;break-after:auto;}
    .pdf-page:before{inset:9mm;border-radius:28px;}
    footer{position:absolute!important;left:18mm!important;right:18mm!important;bottom:8mm!important;}
    .pdf-title{font-size:43px!important;}
    .pdf-photo{height:86mm!important;}
    .pdf-ribbon{height:45mm!important;}
    .pdf-soft-card,.pdf-note-card{padding:9mm!important;margin-bottom:8mm!important;}
    .pdf-list li{margin-bottom:6mm!important;}
    .pdf-list p{font-size:15px!important;line-height:1.55!important;}
    .pdf-steps-list p{font-size:14px!important;}
    .pdf-note-card p{font-size:18px!important;}
    .pdf-page-head b{font-size:34px!important;}
    .pdf-quote{font-size:17px!important;}
    .pdf-ritual-card{grid-template-columns:1fr 68mm!important;}
    .pdf-ritual-card .pdf-photo{height:72mm!important;}
  }
</style>
</head>
<body>
  <main class="pdf-page pdf-cover">
    <header class="pdf-brand"><div><div class="pdf-brand-logo">Teeyana</div><div class="pdf-brand-sub">Nutrition · Plantes · Bien-être</div></div><div class="pdf-pill">Recette privée</div></header>
    <section class="pdf-cover-content">
      <div class="pdf-eyebrow">Carnet Signature n°${carnetNumber} · ${escapeHTML(category)}</div>
      <h1 class="pdf-title">${escapeHTML(title)}<em>${escapeHTML(mood)}</em></h1>
      <p class="pdf-subtitle">${escapeHTML(subtitle)}</p>
      ${imageUrl ? `<figure class="pdf-photo"><img src="${escapeHTML(imageUrl)}" alt=""></figure>` : `<figure class="pdf-photo fallback">${escapeHTML(emoji)}</figure>`}
      <div class="pdf-meta-grid"><div class="pdf-meta"><strong>${escapeHTML(category)}</strong><span>Univers</span></div><div class="pdf-meta"><strong>${escapeHTML(mood)}</strong><span>Intention</span></div><div class="pdf-meta"><strong>${escapeHTML(access)}</strong><span>Accès</span></div></div>
      <div class="pdf-quote">Une recette comme un rituel : simple, douce, précise, et pensée pour accompagner ton équilibre au quotidien.</div>
    </section><footer><span>https://methodetee.app</span><span>Page 1</span></footer>
  </main>
  <main class="pdf-page pdf-content-page">
    <header class="pdf-page-head"><small>Ingrédients</small><b>La sélection</b></header>
    ${imageUrl ? `<div class="pdf-ribbon"><img src="${escapeHTML(imageUrl)}" alt=""></div>` : ""}
    <section class="pdf-soft-card"><ol class="pdf-list pdf-ingredients-list">${ingredientItems}</ol></section>
    <footer>${escapeHTML(title)}<span>Page 2</span></footer>
  </main>
  ${prepPages}
  <main class="pdf-page pdf-content-page">
    <header class="pdf-page-head"><small>Rituel de dégustation</small><b>À savourer<br><em class="title-soft">lentement</em></b></header>
    <section class="pdf-ritual-card">
      <div class="pdf-soft-card"><ol class="pdf-list pdf-ingredients-list"><li><span>01</span><p>Installe-toi dans un moment calme.</p></li><li><span>02</span><p>Respire avant de commencer.</p></li><li><span>03</span><p>Savoure sans te presser.</p></li></ol></div>
      ${imageUrl ? `<figure class="pdf-photo"><img src="${escapeHTML(imageUrl)}" alt=""></figure>` : ""}
    </section>
    <section class="pdf-closing"><small>Carnet Signature n°${carnetNumber}</small><h2>Ta fiche est prête.</h2><p>Merci d’avoir choisi Méthode Tee. Cette fiche fait désormais partie de ta bibliothèque privée.</p></section>
    <footer>PDF généré depuis ton espace<span>Dernière page</span></footer>
  </main>
</body>
</html>`;

    const frame = document.getElementById("mtRecipePdfFrame");
    if (!frame) throw new Error("Aperçu indisponible.");

    frame.srcdoc = html;

    frame.onload = () => {
      // Expérience volontairement lente : 5s de préparation + 2s d’ouverture carnet.
      const elapsed = Date.now() - pdfStartTime;
      const waitForLoader = Math.max(0, 5000 - elapsed);
      setTimeout(() => {
        mtRecipePdfFinishLoader(loaderTimer);
        modal.classList.add("is-book-opening");
        setTimeout(() => modal.classList.add("is-ready"), 2000);
      }, waitForLoader);
    };
  } catch (err) {
    if (loaderTimer) clearInterval(loaderTimer);
    closeRecipePDFViewer();
    alert(err.message || "Impossible de préparer le PDF.");
  }
}

async function openRecipeViewer(recipeId) {
  const recipes = await mtFetchRecipes();
  const recipe = recipes.find(r => String(r.id) === String(recipeId));
  if (!recipe) return alert("Recette introuvable.");

  const purchasedIds = await mtGetPurchasedRecipeIds();
  const owned = !recipe.is_premium || purchasedIds.includes(String(recipe.id));
  if (!owned) return startSecureCheckoutRecipe(recipe.id);

  const modal = document.getElementById("mediaModal") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "mediaModal", className: "media-modal" }));
  const hero = recipe.image_url
    ? `<div class="mt-recipe-hero-image"><img src="${escapeHTML(recipe.image_url)}" alt="${escapeHTML(recipe.title || "Recette")}"></div>`
    : `<div class="mt-recipe-hero-image mt-recipe-hero-fallback"><span>${escapeHTML(recipe.emoji || "🥣")}</span></div>`;

  let relatedProtocol = null;
  if (recipe.related_protocol_id) {
    const protocols = await fetchProtocols();
    relatedProtocol = protocols.find(p => String(p.id) === String(recipe.related_protocol_id)) || null;
  }

  modal.innerHTML = `
    <div class="modal-backdrop mt-recipe-backdrop" onclick="closeMedia()"></div>
    <article class="modal-card mt-recipe-sheet">
      <button class="modal-close mt-recipe-close" onclick="closeMedia()" aria-label="Fermer">&#x2715;</button>
      ${hero}
      <div class="mt-recipe-sheet-body">
        <div class="mt-recipe-topline">
          <span>${escapeHTML(recipe.category || "Recette privée")}</span>
          <b>✓ Disponible</b>
        </div>
        <h1>${escapeHTML(recipe.title || "Recette")}</h1>
        ${recipe.subtitle ? `<p class="mt-recipe-subtitle">${escapeHTML(recipe.subtitle)}</p>` : ""}
        ${mtRecipeBuildEditorialContent(recipe, relatedProtocol)}
        <div class="mt-recipe-download-zone">
          <button class="mt-recipe-download-btn" onclick="downloadRecipePDF('${escapeHTML(recipe.id)}')">
            <span>↓</span>
            Voir le PDF premium
          </button>
          <small>Ouvrir le carnet premium de la recette.</small>
          <button class="mt-recipe-food-link" onclick="location.href='food-meal.html?recipe_id=${escapeHTML(recipe.id)}'">J’ai mangé cette recette</button>
        </div>
      </div>
    </article>`;
  modal.classList.add("open", "recipe-open");
  document.body.style.overflow = "hidden";
}
window.renderRecipesMarketplace = renderRecipesMarketplace;
window.startSecureCheckoutRecipe = startSecureCheckoutRecipe;
window.openRecipeViewer = openRecipeViewer;
window.downloadRecipePDF = downloadRecipePDF;


// ── XP CARD & REWARDS ───────────────────────────────────────────────
window.mtBuildXPCard = async function() {
  try {
    const client = initSupabase && initSupabase();
    const user = await mtGetUser();
    if (!client || !user) return '';
    const cacheKey = `mt_xp_profile_${user.id}`;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(cacheKey) || "null"); } catch(e) {}
    let result = null;
    // Si un profil XP est déjà en cache, on l'affiche immédiatement : aucune grande carte
    // squelette à chaque retour sur Profil. La donnée distante se rafraîchit en arrière-plan.
    if (cached) {
      const refreshQuery = client.from('member_profiles').select('points,level,badge,level_label,garden_claimed_rewards').eq('user_id', user.id).maybeSingle();
      Promise.resolve(refreshQuery).then(fresh => {
        if (fresh?.data) {
          try { localStorage.setItem(cacheKey, JSON.stringify(fresh.data)); } catch(e) {}
        }
      }).catch(()=>{});
    } else {
      const query = client.from('member_profiles').select('points,level,badge,level_label,garden_claimed_rewards').eq('user_id', user.id).maybeSingle();
      result = await mtPromiseTimeout(query, 2200, null);
      if(result?.data){
        try { localStorage.setItem(cacheKey, JSON.stringify(result.data)); } catch(e) {}
      }
    }
    const mp = result?.data || cached || null;
    const xp = Number(mp?.points || 0);
    const levels = window.MT_LEVELS || [
      { min:0,    max:249,  key:'semence',   label:'Semence',    iconKey:'seed', reward:'Ton jardin commence ici', detail:'Chaque geste régulier nourrit ta progression.', claimable:false },
      { min:250,  max:499,  key:'racines',   label:'Racines',    iconKey:'seed', reward:'Secret du Jardin — fiche Pharmacopée exclusive', detail:'Une fiche privée autour d’une plante et de son intégration au quotidien.' },
      { min:500,  max:1499, key:'pousse',    label:'Pousse',     iconKey:'sprout', reward:'Rituel signature TEE', detail:'15 minutes pour revenir à soi et retrouver un repère simple.' },
      { min:1500, max:3999, key:'feuillage', label:'Feuillage',  iconKey:'leaf', reward:'Mini-protocole exclusif · 3 jours', detail:'3 jours pour retrouver ton rythme, disponible uniquement grâce au Jardin.' },
      { min:4000, max:7999, key:'floraison', label:'Floraison',  iconKey:'flower', reward:'Collection privée — L’Herbier de Tee', detail:'Quatre contenus exclusifs : plante, assiette, récupération et bilan.' },
      { min:8000, max:Infinity, key:'alchimiste', label:'Alchimiste', iconKey:'sparkle', reward:'Le choix de l’Alchimiste', detail:'Un protocole complet Méthode TEE offert au choix.' },
    ];
    const normalizedLevels = levels.map(l => ({...l, label: String(l.label || l.key || "").replace(/^[^\p{L}\p{N}]+\s*/u, ""), iconKey: l.iconKey || l.key || "seed"}));
    const currentLevel = normalizedLevels.find(l => xp >= l.min && xp <= l.max) || normalizedLevels[0];
    const nextLevel = normalizedLevels[normalizedLevels.indexOf(currentLevel) + 1];
    const progress = nextLevel ? Math.max(0, Math.min(100, Math.round(((xp - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100))) : 100;
    const xpToNext = nextLevel ? Math.max(0, nextLevel.min - xp) : 0;
    const claimed = Array.isArray(mp?.garden_claimed_rewards) ? mp.garden_claimed_rewards : [];
    const unlockedCount = normalizedLevels.filter(l => xp >= l.min).length;
    const claimableCount = normalizedLevels.filter(l => l.claimable !== false && xp >= l.min && !claimed.includes(l.key)).length;

    const levelBars = normalizedLevels.map(l => {
      const isActive = xp >= l.min;
      const isClaimed = claimed.includes(l.key);
      const isCurrent = l.key === currentLevel.key;
      return `<div class="xp-level-node ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''} ${isClaimed ? 'claimed' : ''}" onclick="window.mtOpenRewards()">
        <span class="xp-node-emoji xp-node-icon">${mtIconHTML(l.iconKey || l.key, "xp-level-icon")}</span>
        <span class="xp-node-label">${l.label}</span>
        <span class="xp-node-min">${l.min === 0 ? '0' : l.min.toLocaleString()}</span>
      </div>`;
    }).join('<div class="xp-level-line"></div>');

    return `<section class="mt-xp-card reveal" data-xp="${xp}" data-progress="${progress}">
      <div class="mt-xp-glow"></div>
      <div class="mt-xp-header">
        <div>
          <small>Ton jardin intérieur</small>
          <h2 class="mt-xp-level">${currentLevel.label}</h2>
          <p class="mt-xp-reward">${currentLevel.reward}</p>
        </div>
        <div class="mt-xp-score">
          <b class="mt-xp-number" data-value="${xp}">0</b>
          <span>XP</span>
        </div>
      </div>
      <div class="mt-xp-bar-wrap">
        <div class="mt-xp-bar-fill" style="width:0%" data-target="${progress}"></div>
      </div>
      ${nextLevel ? `<p class="mt-xp-next">Encore <b>${xpToNext.toLocaleString()} XP</b> pour atteindre ${nextLevel.label}</p>` : `<p class="mt-xp-next">${mtIconHTML("sparkle", "inline-badge-icon")} Tu as atteint le niveau maximum</p>`}
      <div class="mt-xp-levels">${levelBars}</div>
      <button class="mt-xp-rewards-btn ${claimableCount ? 'has-claim' : ''}" onclick="window.mtOpenRewards()">
        ${claimableCount ? `Récolter ${claimableCount} récompense${claimableCount>1?'s':''} →` : `Voir mes récoltes →`}
      </button>
      <p class="mt-xp-mini">${unlockedCount}/${normalizedLevels.length} niveau${normalizedLevels.length>1?'x':''} débloqué${unlockedCount>1?'s':''}</p>
    </section>`;
  } catch(e) { console.warn('XP card failed', e); return ''; }
};

window.mtReadClaimedRewards = async function(){
  const client=initSupabase&&initSupabase(); const user=await mtGetUser();
  if(!client||!user)return [];
  try{const {data}=await client.from('member_profiles').select('garden_claimed_rewards').eq('user_id',user.id).maybeSingle();return Array.isArray(data?.garden_claimed_rewards)?data.garden_claimed_rewards:[];}catch(e){return [];}
};

window.mtGardenAwardDaily = async function(actionKey,date){
  const client=initSupabase&&initSupabase(); const user=await mtGetUser();
  if(!client||!user)return 0;
  const iso=String(date||new Date().toLocaleDateString('sv-SE')).slice(0,10);
  const guard=`mt_garden_xp_v1_${user.id}_${actionKey}_${iso}`;
  try{if(localStorage.getItem(guard)==='1')return 0;}catch(e){}
  try{
    const {data,error}=await client.rpc('garden_award_daily',{action_key:String(actionKey||''),target_date:iso});
    if(error)throw error;
    try{localStorage.setItem(guard,'1');localStorage.removeItem(`mt_xp_profile_${user.id}`);}catch(e){}
    const gained=Number(data||0);
    if(gained>0&&window.mtToast)mtToast(`+${gained} XP · Ton jardin grandit`);
    return gained;
  }catch(e){console.warn('garden daily xp',e);return 0;}
};

window.mtShowGardenHarvestResult=function(level,result){
  document.getElementById('mtGardenHarvestResult')?.remove();
  const isProtocol=!!result?.protocol_id;
  const modal=document.createElement('div');modal.id='mtGardenHarvestResult';modal.className='mt-rewards-modal';
  modal.innerHTML=`<div class="mt-rewards-backdrop" onclick="document.getElementById('mtGardenHarvestResult')?.remove()"></div><div class="mt-rewards-inner"><div class="mt-rewards-header"><div><small>Récolte du Jardin</small><h2>Ta récolte est prête ✶</h2></div><button onclick="document.getElementById('mtGardenHarvestResult')?.remove()">✕</button></div><p class="mt-rewards-sub"><b>${escapeHTML(level?.reward||result?.title||'Récompense')}</b><br>Cette récolte est maintenant liée à ton compte et tu la gardes définitivement.</p><div class="reward-row unlocked claimed"><div class="reward-info"><b>${escapeHTML(result?.title||level?.reward||'Récolte')}</b><p>${isProtocol?'Elle a rejoint tes protocoles.':'Elle a rejoint ta Bibliothèque.'}</p></div></div><div style="display:grid;gap:9px;margin-top:16px"><button class="reward-claim-btn" onclick="location.href='${isProtocol?`protocol-journey.html?id=${encodeURIComponent(result.protocol_id)}`:'library.html'}'">${isProtocol?'Commencer maintenant':'Voir dans ma bibliothèque'}</button><button class="main-cta" style="background:transparent;color:#173f35;border:1px solid rgba(23,63,53,.18)" onclick="document.getElementById('mtGardenHarvestResult')?.remove()">Plus tard</button></div></div>`;
  document.body.appendChild(modal);
};

window.mtClaimReward=async function(key,selectedProtocolId=null){
  const levels=window.MT_LEVELS||[]; const level=levels.find(l=>l.key===key); if(!level||level.claimable===false)return;
  const client=initSupabase&&initSupabase(); const user=await mtGetUser(); if(!client||!user)return;
  try{
    const {data,error}=await client.rpc('garden_claim_reward',{target_reward_key:key,selected_protocol:selectedProtocolId||null});
    if(error)throw error;
    try{localStorage.removeItem(`mt_xp_profile_${user.id}`);}catch(e){}
    if(data?.already_claimed){if(window.mtToast)mtToast('Cette récolte est déjà dans ton espace.');return;}
    if(window.mtToast)mtToast(`Récolte ajoutée : ${level.reward}`);
    if(window.mtRewardClaimAnimation)window.mtRewardClaimAnimation(level);
    document.getElementById('mtRewardsModal')?.remove(); document.getElementById('mtGardenProtocolChoice')?.remove();
    setTimeout(()=>window.mtShowGardenHarvestResult(level,data||{}),500);
  }catch(e){
    const msg=String(e?.message||'');
    if(window.mtToast)mtToast(msg.includes('NOT_ENOUGH_XP')?'Ce palier n’est pas encore atteint.':msg.includes('PROTOCOL_ALREADY_OWNED')?'Ce protocole est déjà dans tes accès. Choisis-en un autre.':'Impossible de récolter pour le moment.','error');
  }
};

window.mtOpenGardenProtocolChoice=async function(){
  const client=initSupabase&&initSupabase(); const user=await mtGetUser(); if(!client||!user)return;
  const [protocols,owned]=await Promise.all([fetchProtocols(),fetchOwnedIds()]); const own=new Set((owned||[]).map(String));
  const eligible=(protocols||[]).filter(p=>!p.garden_exclusive&&Number(p.price_cents||0)>0&&!own.has(String(p.id))&&!own.has(String(p.slug)));
  document.getElementById('mtGardenProtocolChoice')?.remove();
  const modal=document.createElement('div');modal.id='mtGardenProtocolChoice';modal.className='mt-rewards-modal';
  modal.innerHTML=`<div class="mt-rewards-backdrop" onclick="document.getElementById('mtGardenProtocolChoice')?.remove()"></div><div class="mt-rewards-inner"><div class="mt-rewards-header"><div><small>Le choix de l’Alchimiste ✶</small><h2>Choisis ton protocole offert</h2></div><button onclick="document.getElementById('mtGardenProtocolChoice')?.remove()">✕</button></div><p class="mt-rewards-sub">Ta récolte de 8 000 XP te permet de débloquer définitivement un protocole complet Méthode TEE.</p><div class="mt-rewards-list">${eligible.length?eligible.map(p=>`<div class="reward-row unlocked"><div class="reward-info"><b>${escapeHTML(p.title||'Protocole')}</b><span>${escapeHTML(p.duration_label||'Protocole complet')}</span><p>${escapeHTML(p.short_description||'')}</p></div><div class="reward-side"><button class="reward-claim-btn" onclick="window.mtClaimReward('alchimiste','${escapeHTML(p.id)}')">Choisir</button></div></div>`).join(''):`<div class="reward-row unlocked"><div class="reward-info"><b>Ta récolte reste disponible</b><p>Tous les protocoles actuels sont déjà dans tes accès. Tu pourras utiliser ce choix lorsqu’un nouveau protocole éligible sera disponible.</p></div></div>`}</div></div>`;
  document.body.appendChild(modal);
};

window.mtBeginRewardClaim=function(key){if(key==='alchimiste')return window.mtOpenGardenProtocolChoice();return window.mtClaimReward(key);};

window.mtOpenRewards=function(){
  let modal=document.getElementById('mtRewardsModal'); if(modal){modal.remove();return;}
  const levels=(window.MT_LEVELS||[]).map(l=>({...l,label:String(l.label||l.key||'').replace(/^[^\p{L}\p{N}]+\s*/u,''),iconKey:l.iconKey||l.key||'seed'}));
  (async()=>{
    const client=initSupabase&&initSupabase();const user=await mtGetUser();let xp=0,claimed=[];
    if(client&&user){const {data:mp}=await client.from('member_profiles').select('points,garden_claimed_rewards').eq('user_id',user.id).maybeSingle();xp=Number(mp?.points||0);claimed=Array.isArray(mp?.garden_claimed_rewards)?mp.garden_claimed_rewards:[];}
    const currentLevel=levels.find(l=>xp>=l.min&&xp<=l.max)||levels[0];const nextLevel=levels[levels.indexOf(currentLevel)+1];const progress=nextLevel?Math.max(0,Math.min(100,Math.round(((xp-currentLevel.min)/(nextLevel.min-currentLevel.min))*100))):100;
    const html=levels.map(l=>{const unlocked=xp>=l.min,isClaimed=claimed.includes(l.key),left=Math.max(0,l.min-xp);return `<div class="reward-row ${unlocked?'unlocked':'locked'} ${isClaimed?'claimed':''}"><span class="reward-emoji reward-icon">${mtIconHTML(l.iconKey||l.key,'reward-line-icon')}</span><div class="reward-info"><b>${l.label}</b><span>${l.reward}</span><p>${l.detail||''}</p>${l.claimable===false?`<em>Première récolte à 250 XP</em>`:!unlocked?`<em>${left.toLocaleString()} XP restants</em>`:isClaimed?`<em class="reward-done">✓ Récoltée</em>`:`<em class="reward-ready">Prête à récolter</em>`}</div><div class="reward-side"><span class="reward-xp">${l.min.toLocaleString()} XP</span>${unlocked&&!isClaimed&&l.claimable!==false?`<button class="reward-claim-btn" onclick="window.mtBeginRewardClaim('${l.key}')">Récolter</button>`:''}</div></div>`;}).join('');
    modal=document.createElement('div');modal.id='mtRewardsModal';modal.className='mt-rewards-modal';modal.innerHTML=`<div class="mt-rewards-backdrop" onclick="document.getElementById('mtRewardsModal')?.remove()"></div><div class="mt-rewards-inner"><div class="mt-rewards-header"><div><small>Ton jardin intérieur</small><h2>Tes récoltes</h2></div><button onclick="document.getElementById('mtRewardsModal').remove()">✕</button></div><div class="mt-rewards-progress"><div><b>${currentLevel?.label||'Semence'}</b><span>${xp.toLocaleString()} XP</span></div><i><em style="width:${progress}%"></em></i>${nextLevel?`<p>Encore ${Math.max(0,nextLevel.min-xp).toLocaleString()} XP avant ${nextLevel.label}</p>`:`<p>Niveau maximum atteint</p>`}</div><p class="mt-rewards-sub">Tes XP ne sont jamais dépensés. Chaque palier atteint fait naître une récolte que tu peux débloquer définitivement.</p><div class="mt-rewards-list">${html}</div><div class="mt-rewards-gain"><small>Comment faire grandir mon Jardin</small><div class="gain-row"><span>Journal privé du jour</span><b>+5 XP</b></div><div class="gain-row"><span>Objectif hydratation atteint</span><b>+5 XP</b></div><div class="gain-row"><span>Un suivi personnel renseigné</span><b>+3 XP / jour</b></div><div class="gain-row"><span>Notre journée ensemble terminée</span><b>+5 XP</b></div><div class="gain-row"><span>Journée de protocole validée</span><b>+10 XP</b></div><div class="gain-row"><span>Contenu de protocole terminé</span><b>XP du contenu</b></div><div class="gain-row"><span>Série de 7 jours</span><b>+50 XP</b></div><div class="gain-row"><span>Protocole réellement terminé</span><b>+100 XP</b></div></div></div>`;document.body.appendChild(modal);
  })();
};

window.mtAnimateXPWidgets = function(){
  document.querySelectorAll('.mt-xp-card').forEach(card=>{
    const fill = card.querySelector('.mt-xp-bar-fill');
    if(fill && fill.dataset.target){
      requestAnimationFrame(()=>{ fill.style.width = `${Number(fill.dataset.target)||0}%`; });
    }
    const num = card.querySelector('.mt-xp-number');
    if(num && !num.dataset.done){
      num.dataset.done = "1";
      const target = Number(num.dataset.value || 0);
      const start = performance.now();
      const duration = 850;
      function tick(now){
        const p = Math.min(1, (now-start)/duration);
        const eased = 1 - Math.pow(1-p, 3);
        num.textContent = Math.round(target*eased).toLocaleString();
        if(p<1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  });
};

window.mtRewardClaimAnimation = function(level){
  const overlay = document.createElement('div');
  overlay.className = 'mt-levelup-overlay reward-claim-overlay';
  overlay.innerHTML = `<div class="mt-levelup-card">
    <div class="mt-leaf-confetti">${Array.from({length:18}).map((_,i)=>`<span style="--i:${i}">🍃</span>`).join('')}</div>
    <div class="mt-levelup-emoji">${level.emoji}</div>
    <small>Récompense réclamée</small>
    <h2>${level.reward}</h2>
    <p>Elle est maintenant enregistrée dans ton espace Méthode Tee.</p>
    <button onclick="this.closest('.mt-levelup-overlay').remove()">Continuer</button>
  </div>`;
  document.body.appendChild(overlay);
};

window.mtShowLevelUp = function(oldLevel, newLevel, oldXp, newXp, gain){
  const overlay = document.createElement('div');
  overlay.className = 'mt-levelup-overlay';
  overlay.innerHTML = `<div class="mt-levelup-card">
    <div class="mt-leaf-confetti">${Array.from({length:24}).map((_,i)=>`<span style="--i:${i}">🍃</span>`).join('')}</div>
    <div class="mt-levelup-emoji">${newLevel.emoji}</div>
    <small>Nouveau niveau atteint</small>
    <h2>${newLevel.label}</h2>
    <p>${newLevel.reward}</p>
    <div class="mt-levelup-xp"><span data-from="${oldXp}" data-to="${newXp}">${oldXp}</span> XP</div>
    <button onclick="this.closest('.mt-levelup-overlay').remove(); window.mtOpenRewards && window.mtOpenRewards();">Voir ma récompense</button>
  </div>`;
  document.body.appendChild(overlay);
  const span = overlay.querySelector('.mt-levelup-xp span');
  const start = performance.now();
  const duration = 1100;
  function tick(now){
    const p = Math.min(1, (now-start)/duration);
    const eased = 1 - Math.pow(1-p, 3);
    span.textContent = Math.round(oldXp + (newXp-oldXp)*eased).toLocaleString();
    if(p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
};

window.addEventListener('mt:xp-gained', ()=>setTimeout(window.mtAnimateXPWidgets, 300));
document.addEventListener('DOMContentLoaded', ()=>setTimeout(window.mtAnimateXPWidgets, 900));

// ────────────────────────────────────────────────────────────────────


// ── Fix Safari navbar décollée au retour du background ──────────────
(function() {
  function fixShellHeight() {
    const shell = document.querySelector('.shell');
    if (!shell) return;
    // Force recalcul dvh en passant par auto puis dvh
    shell.style.height = 'auto';
    requestAnimationFrame(() => {
      shell.style.height = '100dvh';
    });
  }

  // Au retour depuis le background Safari
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fixShellHeight();
      // Double sécurité 300ms après
      setTimeout(fixShellHeight, 300);
    }
  });

  // Au focus de la fenêtre (retour depuis une autre app)
  window.addEventListener('focus', () => {
    fixShellHeight();
    setTimeout(fixShellHeight, 300);
  });

  // pageshow bfcache
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      fixShellHeight();
      setTimeout(fixShellHeight, 300);
    }
  });

  // Resize (barre Safari qui apparaît/disparaît en scrollant)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fixShellHeight, 100);
  });
})();
// ────────────────────────────────────────────────────────────────────
