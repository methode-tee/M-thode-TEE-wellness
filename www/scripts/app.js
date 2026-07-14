
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
  if (!res.ok) throw new Error(json.error || "Erreur serveur.");
  return json;
}



/* V135 — iOS UE External Purchase Link helper
   Garde Stripe intact, mais ajoute une étape d'information avant d'ouvrir
   un achat externe dans l'app iOS. Pour l'App Store UE, l'entitlement Apple
   + l'API StoreKit native restent à activer côté App Store Connect/Xcode. */
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

function mtExternalPurchaseConfig(){
  return Object.assign({
    enabled: true,
    eu_only: true,
    merchant_name: "Méthode Tee",
    site_label: "methodetee.app",
    support_email: "support@methodetee.app"
  }, (window.MT_CONFIG && window.MT_CONFIG.EXTERNAL_PURCHASE_LINK_EU) || {});
}

function mtShouldShowExternalPurchaseSheet(){
  const cfg = mtExternalPurchaseConfig();
  return !!cfg.enabled && (mtIsIOSNativeApp() || mtIsCapacitorRuntime());
}

/* V175 — Retour Stripe → app Capacitor
   iOS ouvre bien l'application via methodetee://payment-success, mais sans
   gestionnaire JS la WebView reste sur l'accueil. On écoute donc appUrlOpen
   et on route vers le bon espace après paiement, sans toucher aux webhooks. */
function mtHandlePaymentReturnUrl(rawUrl){
  try{
    if(!rawUrl) return false;

    const normalizedRawUrl = String(rawUrl);
    const url = new URL(normalizedRawUrl);
    const marker = `${url.host || ""}${url.pathname || ""}`.toLowerCase();
    if(!marker.includes("payment-success") && !marker.includes("payment-cancelled")) return false;

    /*
      iOS garde parfois le même launchUrl après l'ouverture de l'app.
      Sans garde-fou, chaque page rechargée relit le même deep link, redirige à nouveau,
      puis produit des flashs noir/blanc. On traite donc une URL de retour une seule fois.
    */
    const handledKey = "mt_last_payment_return_url";
    const handledAtKey = "mt_last_payment_return_at";
    const lastUrl = localStorage.getItem(handledKey) || "";
    const lastAt = Number(localStorage.getItem(handledAtKey) || 0);
    const now = Date.now();
    if(lastUrl === normalizedRawUrl && now - lastAt < 10 * 60 * 1000){
      return true;
    }
    localStorage.setItem(handledKey, normalizedRawUrl);
    localStorage.setItem(handledAtKey, String(now));

    const status = marker.includes("payment-cancelled") ? "cancelled" : "success";
    const type = (url.searchParams.get("type") || url.searchParams.get("purchase_type") || "").toLowerCase();
    const id = url.searchParams.get("id") || url.searchParams.get("recipe_id") || url.searchParams.get("protocol_id") || url.searchParams.get("item_id") || "";

    localStorage.removeItem("mt_external_purchase_return_pending");
    localStorage.removeItem("mt_external_purchase_started_at");
    localStorage.removeItem("mt_protocols_cache");
    localStorage.removeItem("mt_recipes_cache");

    const nonce = now;
    let nextUrl = `index.html?payment=${encodeURIComponent(status)}&mt=${nonce}`;

    if(status === "cancelled"){
      if(type === "recipe") nextUrl = `page.html?slug=recettes&payment=cancelled&mt=${nonce}`;
      else if(type === "protocol") nextUrl = `protocols.html?payment=cancelled&mt=${nonce}`;
    } else if(type === "recipe"){
      const qs = id ? `&recipe=${encodeURIComponent(id)}` : "";
      nextUrl = `page.html?slug=recettes&payment=success${qs}&mt=${nonce}`;
    } else if(type === "protocol"){
      nextUrl = id
        ? `protocol-journey.html?id=${encodeURIComponent(id)}&payment=success&mt=${nonce}`
        : `protocols.html?payment=success&mt=${nonce}`;
    }

    const current = `${location.pathname.split('/').pop() || 'index.html'}${location.search || ''}`;
    if(current === nextUrl) return true;

    location.replace(nextUrl);
    return true;
  }catch(e){
    console.warn("Méthode Tee deep link ignored", e);
    return false;
  }
}
window.mtHandlePaymentReturnUrl = mtHandlePaymentReturnUrl;
window.mtHandleAppReturnUrl = mtHandlePaymentReturnUrl;

(function mtInstallCapacitorDeepLinkReturnHandler(){
  if(window.__MT_DEEPLINK_RETURN_HANDLER__) return;
  window.__MT_DEEPLINK_RETURN_HANDLER__ = true;

  function install(){
    try{
      const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if(!App) return false;
      if(typeof App.addListener === "function"){
        App.addListener("appUrlOpen", function(event){
          mtHandlePaymentReturnUrl(event && event.url);
        });
      }
      if(typeof App.getLaunchUrl === "function"){
        App.getLaunchUrl().then(function(result){
          if(result && result.url) mtHandlePaymentReturnUrl(result.url);
        }).catch(function(){});
      }
      return true;
    }catch(e){
      return false;
    }
  }

  if(install()) return;
  [100, 300, 700, 1200, 2000].forEach(function(ms){ setTimeout(install, ms); });
})();



(function mtInstallExternalPurchaseReturnRefresh(){
  function refreshAfterExternalPurchase(){
    try{
      if(!mtIsIOSNativeApp()) return;
      const pending = localStorage.getItem("mt_external_purchase_return_pending");
      const startedAt = Number(localStorage.getItem("mt_external_purchase_started_at") || 0);
      if(!pending || !startedAt) return;
      const age = Date.now() - startedAt;
      if(age < 1200 || age > 20 * 60 * 1000) return;
      localStorage.removeItem("mt_external_purchase_return_pending");
      localStorage.removeItem("mt_external_purchase_started_at");
      localStorage.removeItem("mt_protocols_cache");
      localStorage.removeItem("mt_recipes_cache");
      setTimeout(function(){ location.reload(); }, 350);
    }catch(e){}
  }
  window.addEventListener("focus", function(){ setTimeout(refreshAfterExternalPurchase, 450); }, { passive:true });
  document.addEventListener("visibilitychange", function(){
    if(!document.hidden) setTimeout(refreshAfterExternalPurchase, 650);
  }, { passive:true });
  window.addEventListener("pageshow", function(){ setTimeout(refreshAfterExternalPurchase, 500); }, { passive:true });
})();

function mtEscapeHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function mtExternalPurchaseHost(url){
  try{ return new URL(url).host.replace(/^www\./,''); }catch(e){ return mtExternalPurchaseConfig().site_label || "methodetee.app"; }
}

function mtOpenExternalUrl(url){
  try{
    // Dans Capacitor iOS, _system demande l'ouverture hors de la WebView.
    const opened = window.open(url, "_system", "noopener,noreferrer");
    if(opened) return;
  }catch(e){}
  window.location.href = url;
}

window.mtContinueExternalPurchase = function(){
  const url = window.__MT_EXTERNAL_PURCHASE_URL__;
  window.__MT_EXTERNAL_PURCHASE_URL__ = "";
  const sheet = document.getElementById("mtExternalPurchaseSheet");
  if(sheet) sheet.remove();
  try{
    localStorage.setItem("mt_external_purchase_started_at", String(Date.now()));
    localStorage.setItem("mt_external_purchase_return_pending", "1");
  }catch(e){}
  if(url) mtOpenExternalUrl(url);
};

window.mtCancelExternalPurchase = function(){
  window.__MT_EXTERNAL_PURCHASE_URL__ = "";
  const sheet = document.getElementById("mtExternalPurchaseSheet");
  if(sheet) sheet.remove();
};

function mtShowExternalPurchaseSheet(url, context){
  const cfg = mtExternalPurchaseConfig();
  window.__MT_EXTERNAL_PURCHASE_URL__ = url;
  const old = document.getElementById("mtExternalPurchaseSheet");
  if(old) old.remove();
  const host = mtExternalPurchaseHost(url);
  const typeLabel = context === "recipe" ? "cette recette" : context === "app_access" ? "cet accès" : "ce contenu";
  const sheet = document.createElement("div");
  sheet.id = "mtExternalPurchaseSheet";
  sheet.className = "mt-external-purchase-sheet";
  sheet.innerHTML = `
    <div class="mt-external-purchase-backdrop" onclick="mtCancelExternalPurchase()"></div>
    <section class="mt-external-purchase-card" role="dialog" aria-modal="true" aria-labelledby="mtExternalPurchaseTitle">
      <button class="mt-external-purchase-close" type="button" onclick="mtCancelExternalPurchase()" aria-label="Fermer">×</button>
      <div class="mt-external-purchase-mark">✦</div>
      <p class="mt-external-purchase-kicker">Achat externe sécurisé</p>
      <h2 id="mtExternalPurchaseTitle">Finaliser sur le site ${mtEscapeHTML(cfg.merchant_name)}</h2>
      <p>Tu vas quitter l’app pour finaliser ton achat sur le site officiel Méthode Tee. Le paiement est effectué de manière sécurisée avec Stripe. Cette transaction n’est pas traitée par Apple.</p>
      <p class="mt-external-purchase-note">Les achats réalisés en dehors de l’App Store ne sont pas gérés par Apple : historique d’achat, demandes de remboursement, partage familial et assistance Apple peuvent ne pas s’appliquer.</p>
      <div class="mt-external-purchase-actions">
        <button type="button" class="mt-external-purchase-secondary" onclick="mtCancelExternalPurchase()">Annuler</button>
        <button type="button" class="mt-external-purchase-primary" onclick="mtContinueExternalPurchase()">Continuer</button>
      </div>
    </section>`;
  document.body.appendChild(sheet);
  requestAnimationFrame(()=>sheet.classList.add("open"));
}

function mtOpenExternalPurchaseUrl(url, context){
  if(!url) return;
  if(mtShouldShowExternalPurchaseSheet()) return mtShowExternalPurchaseSheet(url, context || "content");
  mtOpenExternalUrl(url);
}

async function mtStartIOSExternalPurchaseIntent(payload, context){
  const cfg = mtExternalPurchaseConfig();
  const fallbackCheckoutUrl = cfg.checkout_url || "https://methodetee.app/checkout.html";

  try {
    const result = await mtCallFunction("create-external-purchase-intent", payload);
    const checkoutUrl = result?.checkout_url || result?.url || fallbackCheckoutUrl;
    mtOpenExternalPurchaseUrl(checkoutUrl, context || payload?.purchase_type || "content");
    return;
  } catch (intentErr) {
    // Si l'intention Apple n'est pas encore disponible côté Supabase, on ne laisse
    // jamais le bouton mourir silencieusement dans la WebView iOS.
    try {
      if (payload?.purchase_type === "recipe") {
        const r = await mtCallFunction("create-recipe-checkout-session", { recipe_id: payload.recipe_id });
        const u = r?.checkout_url || r?.url || fallbackCheckoutUrl;
        mtOpenExternalPurchaseUrl(u, "recipe");
        return;
      }
      if (payload?.purchase_type === "protocol") {
        const r = await mtCallFunction(window.MT_CONFIG.STRIPE_CHECKOUT_FUNCTION || "create-checkout-session", {
          purchase_type: "protocol",
          protocol_id: payload.protocol_id
        });
        const u = r?.checkout_url || r?.url || fallbackCheckoutUrl;
        mtOpenExternalPurchaseUrl(u, "protocol");
        return;
      }
    } catch (checkoutErr) {
      alert(checkoutErr?.message || intentErr?.message || "Impossible d’ouvrir le paiement.");
      return;
    }

    mtOpenExternalPurchaseUrl(fallbackCheckoutUrl, context || payload?.purchase_type || "content");
  }
}

async function startSecureCheckoutProtocol(protocolId) {
  try {
    if (mtShouldShowExternalPurchaseSheet()) {
      return mtStartIOSExternalPurchaseIntent({
        purchase_type: "protocol",
        protocol_id: protocolId
      }, "protocol");
    }

    const result = await mtCallFunction(window.MT_CONFIG.STRIPE_CHECKOUT_FUNCTION || "create-checkout-session", {
      purchase_type: "protocol",
      protocol_id: protocolId
    });
    const checkoutUrl = result?.url || result?.checkout_url;
    if (checkoutUrl) mtOpenExternalPurchaseUrl(checkoutUrl, "protocol");
    else alert("Lien de paiement indisponible.");
  } catch (err) {
    alert(err.message || "Impossible d’ouvrir le paiement.");
  }
}

async function startSecureCheckoutAppAccess() {
  try {
    if (mtShouldShowExternalPurchaseSheet()) {
      return mtStartIOSExternalPurchaseIntent({ purchase_type: "app_access" }, "app_access");
    }

    const result = await mtCallFunction(window.MT_CONFIG.STRIPE_CHECKOUT_FUNCTION || "create-checkout-session", {
      purchase_type: "app_access"
    });
    const checkoutUrl = result?.url || result?.checkout_url;
    if (checkoutUrl) mtOpenExternalPurchaseUrl(checkoutUrl, "app_access");
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
    "protocol-journey.html"
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
  const pages = await fetchPages();
  const current = location.pathname.split("/").pop() || "index.html";
  const params = new URLSearchParams(location.search);
  const category = params.get("category");
  const pageSlug = params.get("slug");

  nav.innerHTML = pages.slice(0, 7).map(item => {
    const itemPath = item.href.split("?")[0];
    const itemParams = new URLSearchParams((item.href.split("?")[1] || ""));
    let active = false;
    if (current === "protocols.html") active = itemPath === "protocols.html" && itemParams.get("category") === category;
    else if (current === "page.html") active = itemPath === "page.html" && itemParams.get("slug") === pageSlug;
    else active = itemPath === current;
    if (current === "index.html" && item.system_key === "home") active = true;
    const navLabel = item.system_key === "protocols_pharmacie" ? "Pharmacopée" : (item.label || "Page");
    const navIconKey = item.system_key || item.slug || item.label || item.emoji || "sparkle";
    return `<a class="${active ? "active" : ""}" href="${item.href}"><b>${mtIconHTML(navIconKey, "nav-icon")}</b><span>${escapeHTML(navLabel)}</span></a>`;
  }).join("");
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

const MT_POST_PREVIEW_CHARS = 220;

function mtPostPreview(text) {
  if (!text) return { preview: "", isTruncated: false };
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= MT_POST_PREVIEW_CHARS) return { preview: clean, isTruncated: false };
  const cut = clean.slice(0, MT_POST_PREVIEW_CHARS).replace(/\s\S*$/, "");
  return { preview: cut, isTruncated: true };
}

function postCard(p, index = 0) {
  const domId = mtPostDomId(p);
  const { preview, isTruncated } = mtPostPreview(p.content);
  const fullContent = escapeHTML(p.content || "");
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
    ${preview ? `<p class="post-preview-text">${escapeHTML(preview)}${isTruncated ? "…" : ""}</p>` : ""}
    ${isTruncated ? `<button class="post-read-more" onclick="mtOpenPostDetail(this.closest('.post-card'))">Lire la suite →</button>` : ""}
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
      <div class="mt-post-detail-body">${escapeHTML(content).replace(/\n/g, "<br>")}</div>
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
async function fetchProtocols(category = null) {
  const client = initSupabase();
  if (client) {
    let q = client.from("protocols").select("*").eq("active", true).order("created_at", { ascending: false });
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (!error && data?.length) return data;
  }
  return (window.MT_PROTOCOLS || []).filter(p => !category || p.category === category);
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

  // 1) Accès normal : user_id = auth.uid()
  await collect(
    client.from("user_protocols")
      .select("protocol_id, unlocked, status")
      .eq("user_id", user.id)
  );

  // 2) Accès de secours : anciennes lignes créées par email uniquement
  if (user.email) {
    await collect(
      client.from("user_protocols")
        .select("protocol_id, unlocked, status")
        .ilike("user_email", user.email)
    );
  }

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

  // iOS / Capacitor : ouvrir systématiquement le flux External Purchase.
  if (mtShouldShowExternalPurchaseSheet() || mtIsCapacitorRuntime()) {
    return mtStartIOSExternalPurchaseIntent({
      purchase_type: "protocol",
      protocol_id: protocolId
    }, "protocol");
  }

  if (window.MT_CONFIG.SECURE_BACKEND) {
    return startSecureCheckoutProtocol(protocolId);
  }

  const protocols = await fetchProtocols();
  const protocol = protocols.find(p => (p.id === protocolId || p.slug === protocolId));
  if (!protocol) return alert("Protocole introuvable.");
  const link = getPaymentLink(protocol);
  if (!link || link === "#") {
    alert("Lien Stripe non configuré pour ce protocole.");
    return;
  }
  mtOpenExternalPurchaseUrl(link, "protocol");
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


function protocolCard(protocol, owned = false) {
  const id = protocol.id || protocol.slug;
  const image = protocol.image_url ? `<img src="${escapeHTML(protocol.image_url)}" alt="">` : `${mtIconHTML(protocol.icon_key || protocol.category || protocol.emoji || "leaf", "protocol-fallback-icon")}`;
  const duration = escapeHTML(protocol.duration_label || "Accès privé");
  const meta = owned
    ? `<div class="protocol-meta unlocked-meta"><span class="duration-pill">Disponible</span><span class="duration-pill">${duration}</span></div>`
    : `<div class="protocol-meta"><span class="price-pill">${euros(protocol.price_cents || 500)}</span><span class="duration-pill">${duration}</span></div>`;

  return `<article class="protocol-card ${owned ? "unlocked" : "locked"} reveal">
    <div class="protocol-hero ${owned ? "" : "is-locked"}">${image}</div>
    <div class="protocol-head">
      <div class="protocol-mini"><span class="avatar">${mtIconHTML(protocol.icon_key || protocol.category || protocol.emoji || "leaf", "protocol-mini-icon")}</span><div><small>${escapeHTML(protocol.subtitle || "Protocole")}</small></div></div>
      <span class="tag">${owned ? "Disponible" : "Payant"}</span>
    </div>
    <h2>${escapeHTML(protocol.title)}</h2>
    <p>${escapeHTML(protocol.short_description || "")}</p>
    ${meta}
    <button class="main-cta" onclick="${owned ? `location.href='protocol-journey.html?id=${id}'` : `startPaymentLink('${id}')`}">${owned ? "Ouvrir le protocole" : "Débloquer ce protocole"}</button>
  </article>`;
}
async function renderProtocolsPage() {
  const el = document.getElementById("protocolGrid");
  if (!el) return;
  await mtRequireUser();
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
        { key:'cycle', field:'filter_key', label:'Cycle', sub:'Féminin', words:['cycle','règles','regles','menstrues','menstruel','menstruation','hormone','hormonal','spm','douleur menstruelle','framboisier','khamaré','femme'] },
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

  const meta = PAGE_META[category] || PAGE_META.pharmacie_vegetale;
  const kEl = document.getElementById('pageKicker');
  const tEl = document.getElementById('pageTitle');
  const lEl = document.getElementById('pageLead');
  if (kEl) kEl.textContent = meta.kicker;
  if (tEl) tEl.innerHTML = meta.title;
  if (lEl) lEl.textContent = meta.lead;

  const protocols = await fetchProtocols(category);
  const owned = await fetchOwnedIds();

  document.querySelectorAll(".mt-protocol-filter-mount").forEach(n => n.remove());
  const filterMount = document.createElement("div");
  filterMount.className = "mt-protocol-filter-mount";
  filterMount.innerHTML = mtPremiumChipFilter("protocol", meta.chips);
  el.parentNode.insertBefore(filterMount, el);

  mtApplyPremiumChipFilter({
    items: protocols,
    filterId: "protocolFilters",
    targetId: "protocolGrid",
    chips: meta.chips,
    render: (p) => protocolCard(p, owned.includes(p.id) || owned.includes(p.slug)),
    emptyHTML: `<div class="empty-card"><h2>Aucun protocole trouvé</h2><p>Essaie un autre filtre.</p></div>`
  });
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
  if (!owned.includes(protocol.id) && !owned.includes(protocol.slug) && !(typeof mtHasFullPreviewAccess === "function" ? await mtHasFullPreviewAccess() : await mtIsAdmin())) {
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
      }).join("") || `<article class="content-card"><span>🤍</span><h2>Contenu à venir</h2><p>L’admin ajoutera ici ses fichiers, vidéos, checklists, calendriers, trackers et routines.</p></article>`}
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
  await mtRequireUser();
  const slug = getParam("slug");
  if (slug === "recettes" && typeof renderRecipesMarketplace === "function") {
    await renderRecipesMarketplace();
    return;
  }
  const page = await fetchCustomPage(slug);
  if (!page) { el.innerHTML = `<div class="empty-card"><h2>Page introuvable</h2></div>`; return; }
  const sections = page.sections || [];
  el.innerHTML = `<div class="kicker">${escapeHTML(page.emoji || "✦")} Espace privé</div>
    <h1 class="page-title">${escapeHTML(page.label || page.title || "Page")}<br><em>Méthode Tee</em></h1>
    <p class="lead">${escapeHTML(page.description || "Contenus privés, conseils, recettes, routines et ressources ajoutés depuis l’admin.")}</p>
    ${sections.map(renderSection).join("") || `<div class="empty-card"><h2>Page à construire</h2><p>Ajoute tes rubriques depuis l’admin.</p></div>`}`;
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
  const label = escapeHTML(mtProtocolCategoryLabel(protocol.category));
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
    return { favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [], routines: Array.isArray(parsed.routines) ? parsed.routines : [] };
  } catch(e) { return { favorites: [], routines: [] }; }
}
function mtWriteSavedLocal(userId, data) {
  localStorage.setItem(mtSavedKey(userId), JSON.stringify({ favorites: data.favorites || [], routines: data.routines || [] }));
}
function mtSavedItemFromCard(card) {
  return {
    id: card?.dataset?.postId || card?.id || `post-${Date.now()}`,
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
window.mtTogglePostSave = async function(kind, btn) {
  const user = await mtRequireAuthForSave();
  if (!user) return;
  const card = btn?.closest?.(".post-card");
  if (!card) return;
  const bucket = kind === "routine" ? "routines" : "favorites";
  const data = mtReadSavedLocal(user.id);
  const item = mtSavedItemFromCard(card);
  const exists = data[bucket].some(x => x.id === item.id);
  data[bucket] = exists ? data[bucket].filter(x => x.id !== item.id) : [item, ...data[bucket].filter(x => x.id !== item.id)].slice(0, 80);
  mtWriteSavedLocal(user.id, data);
  btn.classList.toggle("is-saved", !exists);
  btn.innerHTML = bucket === "favorites" ? (!exists ? "♥ Favori" : "♡ Favori") : (!exists ? "✓ Routine" : "＋ Routine");
  if (window.mtToast) mtToast(!exists ? (bucket === "favorites" ? "Ajouté à Mes favoris" : "Ajouté à Mes routines") : "Retiré de ton espace");
  window.mtRefreshSavedButtons && window.mtRefreshSavedButtons();
};
window.mtSavedCollectionState = window.mtSavedCollectionState || { bucket: 'favorites', filter: 'all', sort: 'recent', query: '' };

function mtSavedLabelFor(bucket) {
  return bucket === "routines"
    ? { title: "Mes routines", icon: mtIconHTML("leaf", "drawer-title-icon"), empty: "Aucune routine encore. Ajoute un post avec le bouton + Routine pour le retrouver ici." }
    : { title: "Mes favoris", icon: mtIconHTML("sparkle", "drawer-title-icon"), empty: "Aucun favori encore. Sauvegarde un post depuis l’accueil pour créer ta bibliothèque personnelle." };
}
function mtSavedTypes(items) {
  const list = [...new Set((items || []).map(x => String(x.type || "Journal").trim()).filter(Boolean))];
  return ["all", ...list.slice(0, 8)];
}
function mtSavedFilteredItems(items, state) {
  let out = Array.isArray(items) ? [...items] : [];
  if (state.filter && state.filter !== "all") out = out.filter(x => String(x.type || "Journal") === state.filter);
  const q = String(state.query || "").trim().toLowerCase();
  if (q) out = out.filter(x => `${x.title || ""} ${x.content || ""} ${x.type || ""}`.toLowerCase().includes(q));
  out.sort((a,b) => {
    const da = new Date(a.saved_at || a.created_at || 0).getTime();
    const db = new Date(b.saved_at || b.created_at || 0).getTime();
    return state.sort === "old" ? da - db : db - da;
  });
  return out;
}
function mtSavedCardHTML(it) {
  const type = escapeHTML(it.type || "Journal");
  const title = escapeHTML(it.title || "Post sauvegardé");
  const text = escapeHTML(mtShortSaved(it.content || "", 150));
  const date = it.saved_at ? fmtDate(it.saved_at) : "Sauvegardé";
  const iconKey = type.toLowerCase().includes("recette") ? "bowl" : type.toLowerCase().includes("routine") ? "leaf" : type.toLowerCase().includes("audio") ? "bell" : type.toLowerCase().includes("hydratation") ? "drop" : "sparkle";
  return `<article class="saved-editorial-card" onclick="mtOpenSavedDetail('${escapeHTML(it.id || '')}')">
    <div class="saved-editorial-top"><span class="saved-editorial-icon">${mtIconHTML(iconKey, "saved-editorial-line-icon")}</span><small>${type}</small></div>
    <h4>${title}</h4>
    ${text ? `<p>${text}</p>` : ""}
    <div class="saved-editorial-foot"><span>${escapeHTML(date)}</span><b>Ouvrir →</b></div>
  </article>`;
}
function mtRenderSavedCollectionContent() {
  const userId = window.mtSavedCollectionUserId;
  const state = window.mtSavedCollectionState || { bucket: 'favorites', filter: 'all', sort: 'recent', query: '' };
  const data = mtReadSavedLocal(userId);
  const items = state.bucket === "routines" ? data.routines : data.favorites;
  const meta = mtSavedLabelFor(state.bucket);
  const filtered = mtSavedFilteredItems(items, state);
  const types = mtSavedTypes(items);
  const target = document.getElementById("savedCollectionBody");
  if (!target) return;
  target.innerHTML = `
    <div class="saved-library-head">
      <div class="saved-library-count">${items.length} élément${items.length > 1 ? "s" : ""}</div>
      <div class="saved-library-switch">
        <button class="${state.bucket === "favorites" ? "active" : ""}" onclick="mtSwitchSavedBucket('favorites')">${mtIconHTML("sparkle", "saved-switch-icon")} Favoris</button>
        <button class="${state.bucket === "routines" ? "active" : ""}" onclick="mtSwitchSavedBucket('routines')">${mtIconHTML("leaf", "saved-switch-icon")} Routines</button>
      </div>
    </div>
    <div class="saved-library-tools">
      <input type="search" placeholder="Rechercher…" value="${escapeHTML(state.query || "")}" oninput="mtSetSavedQuery(this.value)">
      <select onchange="mtSetSavedSort(this.value)">
        <option value="recent" ${state.sort !== "old" ? "selected" : ""}>Plus récent</option>
        <option value="old" ${state.sort === "old" ? "selected" : ""}>Plus ancien</option>
      </select>
    </div>
    <div class="saved-library-filters">
      ${types.map(t => `<button class="${state.filter === t ? "active" : ""}" onclick="mtSetSavedFilter('${escapeHTML(t)}')">${t === "all" ? "Tout" : escapeHTML(t)}</button>`).join("")}
    </div>
    ${filtered.length ? `<div class="saved-editorial-list">${filtered.map(mtSavedCardHTML).join("")}</div>` : `<div class="saved-empty"><b>${meta.icon}</b><h4>${meta.title}</h4><p>${items.length ? "Aucun contenu ne correspond à cette recherche." : meta.empty}</p></div>`}
  `;
}
window.mtSwitchSavedBucket = function(bucket){ window.mtSavedCollectionState.bucket = bucket; window.mtSavedCollectionState.filter = 'all'; mtRenderSavedCollectionContent(); };
window.mtSetSavedFilter = function(filter){ window.mtSavedCollectionState.filter = filter; mtRenderSavedCollectionContent(); };
window.mtSetSavedSort = function(sort){ window.mtSavedCollectionState.sort = sort; mtRenderSavedCollectionContent(); };
window.mtSetSavedQuery = function(query){ window.mtSavedCollectionState.query = query; mtRenderSavedCollectionContent(); };
window.mtOpenSavedDetail = function(id){
  if (!id) return;
  const userId = window.mtSavedCollectionUserId;
  const data = mtReadSavedLocal(userId);
  const all = [...(data.favorites || []), ...(data.routines || [])];
  const it = all.find(x => x.id === id);
  if (!it) return;

  // Si le favori est une recette, on ferme la feuille Favoris puis on ouvre la vraie recette au-dessus.
  // Cela évite l’aperçu qui apparaissait derrière le drawer Profil.
  if (it.source === "recipe_favorite" && it.recipe_id && typeof openRecipeViewer === "function") {
    mtCloseSavedCollection && mtCloseSavedCollection();
    setTimeout(() => openRecipeViewer(it.recipe_id), 120);
    return;
  }

  const modal = document.getElementById("savedDetailPreview") || document.createElement("div");
  modal.id = "savedDetailPreview";
  modal.className = "saved-detail-preview open";
  modal.innerHTML = `<div class="saved-detail-backdrop" onclick="mtCloseSavedDetail()"></div>
    <article class="saved-detail-card">
      <button onclick="mtCloseSavedDetail()">×</button>
      <small>${escapeHTML(it.type || "Journal")}</small>
      <h3>${escapeHTML(it.title || "Post sauvegardé")}</h3>
      <p>${escapeHTML(it.content || "")}</p>
      <div class="saved-detail-actions"><button onclick="mtCloseSavedDetail()">Fermer</button></div>
    </article>`;
  document.body.appendChild(modal);
};
window.mtCloseSavedDetail = function(){ const modal=document.getElementById("savedDetailPreview"); if(modal) modal.remove(); };

window.mtOpenSavedCollection = async function(bucket) {
  const user = await mtRequireAuthForSave();
  if (!user) return;
  window.mtSavedCollectionUserId = user.id;
  window.mtSavedCollectionState = { bucket: bucket === "routines" ? "routines" : "favorites", filter: "all", sort: "recent", query: "" };
  let modal = document.getElementById("ritualSignalDrawer");
  if(!modal){ modal=document.createElement("div"); modal.id="ritualSignalDrawer"; modal.className="ritual-signal-drawer"; document.body.appendChild(modal); }
  const meta = mtSavedLabelFor(window.mtSavedCollectionState.bucket);
  modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseSavedCollection()"></div>
    <div class="ritual-signal-sheet saved-sheet saved-library-sheet">
      <div class="ritual-signal-grip"></div>
      <button class="ritual-signal-close" onclick="mtCloseSavedCollection()">×</button>
      <div class="ritual-signal-icon">${meta.icon}</div>
      <div class="ritual-signal-kicker">Espace personnel</div>
      <h3>${meta.title}</h3>
      <p class="saved-library-intro">Tes contenus enregistrés depuis le journal, rangés dans une bibliothèque privée et facile à retrouver.</p>
      <div id="savedCollectionBody"></div>
    </div>`;
  modal.classList.add("open");
  mtRenderSavedCollectionContent();
};
window.mtCloseSavedCollection = function(){ const modal=document.getElementById("ritualSignalDrawer"); if(modal) modal.classList.remove("open"); };

// ── V64 — MON PARCOURS SHEET intégré au Profil ────────────────────────────
window.mtOpenParcoursSheet = function() {
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
  modal.classList.add("open");
  if (window.mtJournalInitSheet) window.mtJournalInitSheet();
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
  return { favorites: data.favorites.length, routines: data.routines.length };
}


async function mtContinueJourneyHTML(ownedIds = []) {
  try {
    const user = await mtGetUser();
    const protocols = await fetchProtocols();
    const ownedSet = new Set((ownedIds || []).map(String));
    const ownedProtocols = (protocols || []).filter(p => ownedSet.has(String(p.id)) || ownedSet.has(String(p.slug)));
    if (!user || !ownedProtocols.length) {
      return `<article class="continue-journey-card reveal">
        <div class="continue-kicker">Continuer mon parcours</div>
        <h2>Reprendre là où tu t’es arrêtée <span class="title-inline-icon">${mtIconHTML('sparkle','title-sparkle-icon')}</span></h2>
        <p>Tes protocoles débloqués apparaîtront ici dès que ton premier parcours sera actif.</p>
        <button onclick="location.href='protocols.html?category=pharmacie_vegetale'">Explorer les protocoles</button>
      </article>`;
    }

    const client = initSupabase();
    let progressRows = [];
    if (client) {
      const ids = ownedProtocols.map(p => p.id).filter(Boolean);
      if (ids.length) {
        const { data } = await client
          .from("protocol_progress")
          .select("*")
          .eq("user_id", user.id)
          .in("protocol_id", ids)
          .order("last_validated_at", { ascending: false });
        progressRows = data || [];
      }
    }

    const lastLocal = JSON.parse(localStorage.getItem(`mt_last_protocol_${user.id}`) || "null");
    const chosen =
      (lastLocal && ownedProtocols.find(p => p.id === lastLocal.id || p.slug === lastLocal.id)) ||
      (progressRows[0] && ownedProtocols.find(p => p.id === progressRows[0].protocol_id)) ||
      ownedProtocols[0];

    const progress = progressRows.find(p => p.protocol_id === chosen.id) || {};
    const day = Math.max(1, Number(progress.current_day || lastLocal?.current_day || 1));
    const total = Math.max(day, Number(progress.total_days || chosen.total_days || String(chosen.duration_label || "").match(/\d+/)?.[0] || 7));
    const pct = Math.min(100, Math.round((day / total) * 100));
    const id = encodeURIComponent(chosen.id || chosen.slug);

    return `<article class="continue-journey-card reveal">
      <div class="continue-kicker">Continuer mon parcours</div>
      <div class="continue-topline"><span>Reprendre là où tu t’es arrêtée ${mtIconHTML('sparkle','inline-badge-icon')}</span><em>${pct}%</em></div>
      <h2>${escapeHTML(chosen.title || "Ton protocole")}</h2>
      <p>Dernier repère : jour ${day} sur ${total}. Ton espace reste prêt pour continuer sans repartir de zéro.</p>
      <div class="continue-progress"><i style="width:${pct}%"></i></div>
      <button onclick="location.href='protocol-journey.html?id=${id}'">Continuer</button>
    </article>`;
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
    const { data, error } = await c
      .from('daily_activity')
      .select('today_checks,hydration_liters,has_hydration,has_checklist,has_tracker,has_journal,has_photo,has_recipe,protocol_title,protocol_day')
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
  if(row?.has_hydration || Number(row?.hydration_liters || 0) >= 2) checks.hydration = true;
  if(row?.has_checklist) checks.checklist = true;
  if(row?.has_tracker) checks.tracker = true;
  if(row?.has_journal) checks.journal = true;
  return checks;
}
async function mtPersistTodayState(userId, checks, hydration){
  try{
    const c = initSupabase && initSupabase();
    if(!c || !userId || userId === 'guest') return;
    const cleanChecks = mtNormalizeTodayChecks(checks || {});
    const liters = Math.max(0, Math.min(2, Number(hydration) || 0));
    const hasRitual = Object.keys(cleanChecks).some(k => k.startsWith('ritual_') && cleanChecks[k]);
    const row = {
      user_id: userId,
      activity_date: mtTodayISO(),
      today_checks: cleanChecks,
      hydration_liters: liters,
      has_hydration: liters >= 2 || !!cleanChecks.hydration,
      has_protocol: !!cleanChecks.protocol,
      has_routine: !!cleanChecks.routine,
      has_ritual: hasRitual,
      updated_at: new Date().toISOString()
    };
    await c.from('daily_activity').upsert(row, { onConflict:'user_id,activity_date' });
  }catch(e){
    console.warn('today state persist failed', e);
  }
}
function mtTodayHydrationLiters(userId){
  const key = `mt_hydration_liters_${userId || 'guest'}_${mtTodayISO()}`;
  const alt = `mt_today_hydration_liters_${userId || 'guest'}_${mtTodayISO()}`;
  const val = Number(localStorage.getItem(key) || localStorage.getItem(alt) || 0);
  return Math.max(0, Math.min(2, Number.isFinite(val) ? val : 0));
}
function mtTodaySetHydration(userId, liters){
  const v = Math.max(0, Math.min(2, Number(liters) || 0));
  try { localStorage.setItem(`mt_hydration_liters_${userId || 'guest'}_${mtTodayISO()}`, String(v)); } catch(e){}
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
    return { id: chosen.id || chosen.slug, title: chosen.title || 'Ton protocole', day, total, pct: Math.min(100, Math.round((day/total)*100)) };
  }catch(e){ console.warn('today active protocol failed', e); return null; }
}
window.mtBuildTodayState = async function(){
  const user = await mtGetUser();
  const userId = user?.id || 'guest';
  const iso = mtTodayISO();
  let checks = mtReadTodayChecks(userId);
  let remoteToday = null;
  if(user){
    remoteToday = await mtFetchTodayRemoteState(userId, iso);
    const remoteChecks = mtRemoteChecksFromActivity(remoteToday);
    checks = { ...remoteChecks, ...checks };
    mtWriteTodayChecks(userId, checks);
    const remoteHydration = Number(remoteToday?.hydration_liters || 0);
    if(remoteHydration > 0 && mtTodayHydrationLiters(userId) < remoteHydration){
      mtTodaySetHydration(userId, remoteHydration);
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
  const journalDone = !!checks.journal;
  const personalMissions = [];
  if(active){
    personalMissions.push({ key:'protocol', icon:'movement', title:`Continuer ${active.title}`, sub:`Jour ${active.day} sur ${active.total}`, done:!!checks.protocol, action:`protocol-journey.html?id=${encodeURIComponent(active.id)}` });
  }
  personalMissions.push(
    { key:'hydration', icon:'hydration', title:'Hydratation', sub:`${String(hydration).replace('.', ',')} / 2 L`, done: hydration >= 2 || !!checks.hydration },
    { key:'routine', icon:'leaf', title:'Routine du matin', sub: checks.routine ? 'Complétée' : '2 rituels restants', done: !!checks.routine }
  );
  const missions = [...universalMissions, ...personalMissions];
  const completed = missions.filter(m => m.done).length + (journalDone ? 1 : 0);
  return { user, userId, hydration, checks, active, owned, completed, missions, universalMissions, journalDone };
};
window.mtToggleTodayMission = async function(key){
  const state = await window.mtBuildTodayState();
  if(!state.user){ window.mtOpenTodaySheet && window.mtOpenTodaySheet(); return; }
  const checks = { ...(state.checks || {}) };
  if(key === 'hydration'){
    const next = state.hydration >= 2 ? 0 : Math.min(2, Math.round((state.hydration + 0.25) * 100) / 100);
    mtTodaySetHydration(state.userId, next);
    checks.hydration = next >= 2;
    mtTodayTrackActivity('hydration');
  } else {
    checks[key] = !checks[key];
    mtTodayTrackActivity(key === 'protocol' ? 'protocol' : key === 'routine' ? 'routine' : key.startsWith('ritual_') ? 'ritual' : 'checklist');
  }
  mtWriteTodayChecks(state.userId, checks);
  await mtPersistTodayState(state.userId, checks, mtTodayHydrationLiters(state.userId));
  window.mtOpenTodaySheet && window.mtOpenTodaySheet();
  if(document.getElementById('dashboardSummary')) renderDashboard();
};
window.mtOpenTodaySheet = async function(){
  let modal = document.getElementById('ritualSignalDrawer');
  if(!modal){ modal = document.createElement('div'); modal.id='ritualSignalDrawer'; modal.className='ritual-signal-drawer'; document.body.appendChild(modal); }
  const state = await window.mtBuildTodayState();
  if(!state.user){
    const guestRows = (state.missions || []).map(m => `<button type="button" class="mt-today-row ${m.done?'is-done':''}" onclick="${m.action ? `location.href='${escapeHTML(m.action)}'` : `mtToggleTodayMission('${escapeHTML(m.key)}')`}">
      <span class="mt-today-row-icon">${mtIconHTML(m.icon,'today-row-icon')}</span>
      <span><b>${escapeHTML(m.title)}</b><em>${escapeHTML(m.sub)}</em></span>
      <i onclick="event.stopPropagation(); mtToggleTodayMission('${escapeHTML(m.key)}')">${m.done ? '✓' : ''}</i>
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
  const rows = state.missions.map(m => `<button type="button" class="mt-today-row ${m.done?'is-done':''}" onclick="${m.action ? `location.href='${escapeHTML(m.action)}'` : `mtToggleTodayMission('${escapeHTML(m.key)}')`}">
    <span class="mt-today-row-icon">${mtIconHTML(m.icon,'today-row-icon')}</span>
    <span><b>${escapeHTML(m.title)}</b><em>${escapeHTML(m.sub)}</em></span>
    <i onclick="event.stopPropagation(); mtToggleTodayMission('${escapeHTML(m.key)}')">${m.done ? '✓' : ''}</i>
  </button>`).join('');
  const pct = Math.min(100, Math.round((state.hydration / 2) * 100));
  modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseTodaySheet()"></div>
    <div class="ritual-signal-sheet mt-today-sheet">
      <div class="ritual-signal-grip"></div><button class="ritual-signal-close" onclick="mtCloseTodaySheet()">×</button>
      <div class="mt-today-head"><div class="ritual-signal-icon">${mtIconHTML('seed','today-sheet-icon')}</div><div><div class="ritual-signal-kicker">Aujourd’hui</div><h3>Ton rituel du jour</h3><p>Tes missions, tes habitudes et ton suivi.</p></div></div>
      <div class="mt-today-section-title">Mes missions du jour</div>
      <div class="mt-today-list">${rows}</div>
      <div class="mt-today-section-title">Mes suivis</div>
      <div class="mt-today-follow">
        <div><span>${mtIconHTML('hydration','today-row-icon')}</span><b>Hydratation</b><em>Objectif quotidien</em></div>
        <strong>${String(state.hydration).replace('.', ',')} / 2 L</strong>
        <i><em style="width:${pct}%"></em></i>
      </div>
      <button class="mt-today-primary" onclick="location.href='dashboard.html'">Voir mon profil <span>›</span></button>
    </div>`;
  modal.classList.add('open');
};
window.mtCloseTodaySheet = function(){ const modal=document.getElementById('ritualSignalDrawer'); if(modal) modal.classList.remove('open'); };
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
  const activeLine = state.active ? `${escapeHTML(state.active.title)} · Jour ${state.active.day}` : 'Aucun protocole actif';
  const hydration = String(state.hydration).replace('.', ',');
  const firstRitual = (state.universalMissions || [])[0] || null;
  const ritualLine = firstRitual?.title || 'Rituel du jour à découvrir';
  const ritualDone = !!firstRitual?.done;
  const protocolDone = !!state.checks.protocol;
  const hydrationDone = state.hydration >= 2 || !!state.checks.hydration;
  const routineDone = !!state.checks.routine;
  return `<article class="mt-profile-today-card reveal" onclick="mtOpenTodaySheet()">
    <div class="mt-profile-today-kicker">Mon parcours aujourd’hui</div>
    <h2>Tes objectifs, tes habitudes et ta progression.</h2>
    <div class="mt-profile-today-grid">
      ${mtProfileTodayLine('seed', 'Rituel universel', ritualLine, ritualDone)}
      ${mtProfileTodayLine('leaf', 'Protocole actuel', activeLine, protocolDone)}
      ${mtProfileTodayLine('hydration', 'Hydratation', `${hydration} / 2 L`, hydrationDone)}
      ${mtProfileTodayLine('bell', 'Routine du matin', routineDone ? 'Complétée' : '2 restantes', routineDone)}
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
          <input id="mtNewPasswordInput" type="password" autocomplete="new-password" minlength="6" placeholder="Minimum 6 caractères">
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
    if(!password || password.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
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
    try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
    if(msg) msg.textContent = "Compte supprimé.";
    setTimeout(()=>{ location.href = "auth.html?deleted=1"; }, 800);
  }catch(err){
    if(btn) btn.disabled = false;
    if(msg) msg.textContent = err?.message || "Impossible de supprimer le compte pour l’instant. Contacte hello@methodetee.app.";
  }
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
  const [owned, access, saved, todayState] = await Promise.all([
    mtPromiseTimeout(fetchOwnedIds(), 4000, []),
    mtPromiseTimeout(mtHasLimitedAccess(), 3500, false),
    mtPromiseTimeout(mtSavedCounts(), 3000, { favorites:0, routines:0 }),
    mtPromiseTimeout(window.mtBuildTodayState ? window.mtBuildTodayState() : Promise.resolve(null), 4500, null)
  ]);
  if(renderSeq !== window.__MT_DASHBOARD_RENDER_SEQ__) return;
  const continueHTML = await mtPromiseTimeout(mtContinueJourneyHTML(owned || []), 2500, "");
  const identityHTML = await mtIdentitySimpleHTML(todayState);
  const todayHydration = todayState ? String(todayState.hydration || 0).replace('.', ',') : '0';
  const activeProgressLine = todayState?.active ? `${todayState.active.title} · jour ${todayState.active.day} sur ${todayState.active.total}` : 'Aucun protocole actif';
  el.innerHTML = `${identityHTML}${continueHTML}
    <div class="mt-profile-main-stack reveal">
      <article class="mini-card glass mt-profile-stack-card"><b>${mtIconHTML(access ? "key" : "lock", "saved-editorial-icon")}</b><h2>${access ? "Actif" : "Limité"}</h2><p>Accès général</p></article>
      <article class="mini-card glass saved-profile-card mt-profile-stack-card" onclick="mtOpenUnlockedProtocols()"><b>${mtIconHTML("book", "saved-editorial-icon")}</b><h2>${owned.length}</h2><p>Protocoles débloqués</p></article>
      <article class="mini-card glass saved-profile-card mt-profile-stack-card" onclick="location.href='approche.html'"><b>${mtIconHTML("sparkle", "saved-editorial-icon")}</b><h2>L’approche Méthode Tee</h2><p>Une méthode imaginée par Teeyana</p></article>
      <article class="mini-card glass saved-profile-card mt-profile-stack-card" onclick="mtOpenSavedCollection('favorites')"><b>♡</b><h2>Mes favoris</h2><p>${saved.favorites} contenu${saved.favorites > 1 ? "s" : ""} sauvegardé${saved.favorites > 1 ? "s" : ""}</p></article>
      <article class="mini-card glass saved-profile-card mt-profile-stack-card" onclick="mtOpenSavedCollection('routines')"><b>${mtIconHTML("leaf", "saved-editorial-icon")}</b><h2>Mes routines</h2><p>${saved.routines} rituel${saved.routines > 1 ? "s" : ""} ajouté${saved.routines > 1 ? "s" : ""}</p></article>
    </div>

    <article class="daily-journal-card reveal" onclick="mtOpenParcoursSheet();setTimeout(()=>window.mtJournalOpenForm && window.mtJournalOpenForm((window.mtJournalTodayISO ? window.mtJournalTodayISO() : new Date().toLocaleDateString('sv-SE'))),600)">
      <div class="daily-journal-icon">${mtIconHTML("journal", "daily-journal-line-icon")}</div>
      <div>
        <div class="daily-journal-kicker">Journal privé</div>
        <h2>Écrire aujourd’hui</h2>
        <p>Un espace libre pour déposer ce que tu veux, jour après jour.</p>
      </div>
      <span class="daily-journal-arrow">→</span>
    </article>

    <article class="parcours-card reveal" onclick="mtOpenParcoursSheet()">
      <div class="parcours-card-left">
        <div class="parcours-card-kicker">Espace personnel confidentiel</div>
        <h2>Mon parcours</h2>
        <p>Ton évolution jour après jour.</p>
        <div class="parcours-card-today"><b>${mtIconHTML('calendar','parcours-chip-icon')} Aujourd’hui</b><span>${mtIconHTML('check','parcours-chip-icon')} ${todayState?.completed || 0} missions terminées</span><span>${mtIconHTML('hydration','parcours-chip-icon')} ${todayHydration} / 2 L</span><span>${mtIconHTML('leaf','parcours-chip-icon')} ${escapeHTML(activeProgressLine)}</span></div>
        <div class="parcours-card-badges">
          <span>${mtIconHTML("calendar", "parcours-badge-icon")} Calendrier</span>
          <span>${mtIconHTML("journal", "parcours-badge-icon")} Journal</span>
          <span>${mtIconHTML("tracker", "parcours-badge-icon")} Trackers</span>
          <span>${mtIconHTML("checklist", "parcours-badge-icon")} Checklists</span>
        </div>
      </div>
      <div class="parcours-card-cta">Voir →</div>
    </article>

    

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
    </div>
    <div class="mt-profile-version reveal">
      <strong>Méthode Tee</strong>
      <span>Version 1.0.0</span>
      <small>© 2026 Teeyana</small>
    </div>`;
  observeReveal();

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
    { key: "guide_plantes", label: "Guide plantes", iconKey: "leaf" },
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
  if(!(await mtEnsurePrivatePageAccess())) return;
  await autoUnlockFromSuccess();
  renderTopActions();
  await renderNav();
  renderHomeFeed();
  renderProtocolsPage();
  renderProtocolDetail();
  renderCustomPage();
  await renderDashboard();
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
    if (mtShouldShowExternalPurchaseSheet() || mtIsCapacitorRuntime()) {
      return mtStartIOSExternalPurchaseIntent({
        purchase_type: "recipe",
        recipe_id: recipeId
      }, "recipe");
    }

    const result = await mtCallFunction("create-recipe-checkout-session", {
      recipe_id: recipeId
    });
    const checkoutUrl = result?.url || result?.checkout_url;
    if (checkoutUrl) mtOpenExternalPurchaseUrl(checkoutUrl, "recipe");
    else alert("Lien de paiement indisponible.");
  } catch (err) {
    alert(err?.message || "Impossible d’ouvrir le paiement de la recette.");
  }
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

  // Sécurité lancement : le cœur reste réservé aux recettes gratuites.
  // On ne touche pas aux paiements ni à la logique de déblocage premium.
  if (recipe.is_premium) return;

  const data = mtReadSavedLocal(user.id);
  const exists = (data.favorites || []).some(x => String(x.recipe_id || x.id) === String(recipe.id) || String(x.id) === `recipe-${recipe.id}`);
  data.favorites = exists
    ? (data.favorites || []).filter(x => !(String(x.recipe_id || x.id) === String(recipe.id) || String(x.id) === `recipe-${recipe.id}`))
    : [mtRecipeSavedItem(recipe), ...(data.favorites || []).filter(x => !(String(x.recipe_id || x.id) === String(recipe.id) || String(x.id) === `recipe-${recipe.id}`))].slice(0, 80);
  mtWriteSavedLocal(user.id, data);

  if (btn) {
    btn.classList.toggle("is-saved", !exists);
    btn.setAttribute("aria-label", !exists ? "Retirer des favoris" : "Ajouter aux favoris");
    btn.innerHTML = !exists ? "♥" : "♡";
  }
  if (window.mtToast) mtToast(!exists ? "Ajouté à Mes favoris" : "Retiré de Mes favoris");
  window.mtRefreshSavedButtons && window.mtRefreshSavedButtons();
};

function mtRecipeCard(recipe, purchasedIds = []) {
  const owned = !recipe.is_premium || purchasedIds.includes(recipe.id);
  const price = recipe.is_premium ? euros(recipe.price_cents || 500) : "Gratuit";
  const badge = owned ? "Disponible" : (recipe.is_premium ? price : "Gratuit");
  const img = recipe.image_url
    ? `<div class="recipe-img"><img src="${escapeHTML(recipe.image_url)}" alt=""></div>`
    : `<div class="recipe-img recipe-img-placeholder"><span>${escapeHTML(recipe.emoji || "🥣")}</span></div>`;
  const favoriteBtn = !recipe.is_premium
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
  const user = await mtRequireUser();
  if (!user) return;

  const [recipes, purchasedIds] = await Promise.all([mtFetchRecipes(), mtGetPurchasedRecipeIds()]);
  const freeCount = recipes.filter(r => !r.is_premium).length;
  const premiumCount = recipes.filter(r => r.is_premium).length;

  const recipeChips = [
    { key:'all', label:'Tout', sub:'Tous' },
    { key:'breakfast', label:'Morning', sub:'Réveil', field:'meal_type' },
    { key:'daily', label:'Meals', sub:'Cuisine', field:'meal_type' },
    { key:'snack', label:'Snack', sub:'Pause', field:'meal_type' },
    { key:'dinner', label:'Dinner', sub:'Réconfort', field:'meal_type' },
    { key:'sweet', label:'Sweet', sub:'Gourmand', field:'meal_type' },
    { key:'drink', label:'Drinks', sub:'Smooth', field:'meal_type' }
  ];

  el.innerHTML = `<div class="kicker">🥣 Espace privé</div>
    <h1 class="page-title">Recettes<br><em>Méthode Tee</em></h1>
    <p class="lead">Découvre des idées repas, boissons, bowls, lattes et routines nutrition. Les recettes premium se débloquent ici puis se rangent automatiquement dans ta bibliothèque.</p>

    

    <div class="mt-recipes-filter-mount">
      ${mtPremiumChipFilter("recipe", recipeChips)}
    </div>

    <section id="recipeMarketGrid" class="recipe-market-grid"></section>
  `;

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

  // Accepte les titres rédigés dans l’admin avec un détail entre parenthèses,
  // ex. "Ingrédients (2 personnes)". Sans ça, la première ligne partait en
  // Note de Tee et les blocs Ingrédients / Préparation se mélangeaient.
  if (/^(ingr[eé]dients?|ingredients?|il vous faut|liste des ingr[eé]dients?)(?:\s*\([^)]*\))?$/.test(clean)) return "ingredients";
  if (/^(pr[eé]paration|preparation|[eé]tapes?|etapes?|r[eé]alisation|la recette)(?:\s*\([^)]*\))?$/.test(clean)) return "preparation";
  if (/^(conseil(?: m[eé]thode tee)?|note(?: de tee)?|astuce|astuce m[eé]thode tee|rituel|moment id[eé]al|quand la consommer|conservation|alternative|alternative simple|variante|variantes|petit plus|[aà] savoir|pourquoi [cç]a fonctionne)(?:\s*\([^)]*\))?$/.test(clean)) return "notes";
  return "";
}

function mtRecipeLineKind(line, current) {
  const raw = String(line || "").trim();
  const headingKind = mtRecipeHeadingKind(raw);
  if (headingKind) return headingKind;
  const clean = mtRecipeNormalizeTitle(raw);

  // Sous-parties : elles restent dans la section en cours, mais ne sont jamais prises pour des étapes.
  if (/^(p[aâ]te|garniture|topping|sauce|cr[eè]me|d[eé]coration|base|option|options|version simple|version express)$/.test(clean)) {
    return current || "ingredients";
  }

  // Si aucune section n’a été annoncée, on devine intelligemment.
  const looksLikeIngredient = /^(?:[-•*]\s*)?(?:\d+\s*(?:g|kg|ml|cl|l)\b|\d+[,.]?\d*\s*(?:c\.|cuill[eè]re|pinc[eé]e|poign[eé]e|tranche|feuille|zeste|jus|verre|tasse|sachet)|\d+\s+[^.!?]{2,80}$|une?\s+(?:pinc[eé]e|poign[eé]e|cuill[eè]re|tranche|feuille|zeste|gousse|petit|gros)|quelques\s+|sel$|poivre$|[½¼¾]\s*c\.)/i.test(raw);
  const looksLikeStep = /^(?:\d+[.)]\s*)?(pr[eé]chauffe|m[eé]lange|ajoute|verse|incorpore|fais|laisse|d[eé]pose|dispose|saupoudre|pars[eè]me|replie|enfourne|filtre|chauffe|mix[e]?|coupe|d[eé]coupe|forme|sers|savoure|d[eé]guste|retire|porte|prends|r[eé]alise|conserve)\b/i.test(raw);

  if (!current || current === "notes") {
    if (looksLikeStep) return "preparation";
    if (looksLikeIngredient) return "ingredients";
  }
  return current || "notes";
}

function mtRecipeSectionFromLines(title, lines, mode = "bullet") {
  if (!lines || !lines.length) return "";
  const items = lines.map((line, idx) => {
    const clean = line.replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, "");
    if (mode === "steps") {
      return `<li class="mt-recipe-step"><span>${idx + 1}</span><p>${escapeHTML(clean)}</p></li>`;
    }
    return `<li class="mt-recipe-ingredient"><span>✦</span><p>${escapeHTML(clean)}</p></li>`;
  }).join("");
  return `<section class="mt-recipe-editorial-section">
    <div class="mt-recipe-section-kicker">${escapeHTML(title)}</div>
    <ul class="${mode === "steps" ? "mt-recipe-steps" : "mt-recipe-ingredients"}">${items}</ul>
  </section>`;
}

function mtRecipeParseSections(recipe) {
  const raw = recipe.full_content || recipe.content_text || recipe.description || "";
  const lines = mtRecipeSplitLines(raw);
  let ingredients = [];
  let preparation = [];
  let notes = [];
  let current = "";

  lines.forEach(line => {
    const explicitTitle = !!mtRecipeHeadingKind(line);
    const kind = mtRecipeLineKind(line, current);
    if (explicitTitle) { current = kind; return; }
    current = kind;
    if (kind === "ingredients") ingredients.push(line);
    else if (kind === "preparation") preparation.push(line);
    else notes.push(line);
  });

  if (!ingredients.length && !preparation.length && lines.length) preparation = lines;
  return { ingredients, preparation, notes };
}


function mtRecipeRelatedProtocolCard(protocol) {
  if (!protocol) return "";
  const category = protocol.category || "pharmacie_vegetale";
  const id = protocol.id || protocol.slug || "";
  return `<button type="button" class="mt-recipe-protocol-meta" onclick="mtGoToRelatedProtocol('${escapeHTML(id)}','${escapeHTML(category)}')" aria-label="Voir le protocole ${escapeHTML(protocol.title || "Méthode Tee")}">
    <strong>${escapeHTML(protocol.title || "Protocole Méthode Tee")}</strong>
    <span>Issue du protocole</span>
    <i aria-hidden="true">→</i>
  </button>`;
}

function mtGoToRelatedProtocol(protocolId, category) {
  try { localStorage.setItem("mt_focus_protocol_id", String(protocolId || "")); } catch(e) {}
  closeMedia();
  location.href = `protocols.html?category=${encodeURIComponent(category || "pharmacie_vegetale")}`;
}
window.mtGoToRelatedProtocol = mtGoToRelatedProtocol;

function mtRecipeBuildEditorialContent(recipe, relatedProtocol = null) {
  const { ingredients, preparation, notes } = mtRecipeParseSections(recipe);

  const intro = recipe.description || recipe.subtitle || "";
  return `
    ${intro ? `<section class="mt-recipe-intro-card"><p>${escapeHTML(intro)}</p></section>` : ""}
    <section class="mt-recipe-meta-grid">
      <div><strong>${escapeHTML(recipe.category || "Recette")}</strong><span>Univers</span></div>
      <div><strong>${escapeHTML(recipe.mood || "Rituel")}</strong><span>Intention</span></div>
      <div><strong>${recipe.is_premium ? "Disponiblee" : "Libre"}</strong><span>Accès</span></div>
    </section>
    ${mtRecipeRelatedProtocolCard(relatedProtocol)}
    ${mtRecipeSectionFromLines("Ingrédients", ingredients, "bullet")}
    ${mtRecipeSectionFromLines("Préparation", preparation, "steps")}
    ${mtRecipeSectionFromLines("Note de Tee", notes, "bullet")}
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
        <button class="mt-pdf-close" type="button" onclick="closeRecipePDFViewer()">×</button>
      </div>

      <div class="mt-pdf-loader">
        <div class="mt-private-loader-card">
          <div class="mt-private-loader-star"><img src="assets/brand-compass-star.png" alt=""></div>
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
        <button type="button" class="mt-pdf-primary" onclick="shareRecipePDF()">Partager / PDF</button>
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
      modal.style.display = "none";
      document.body.classList.remove("mt-pdf-open");
    }, 220);
  }
}

function shareRecipePDF() {
  if (MT_CURRENT_RECIPE_PDF_URL) {
    const a = document.createElement("a");
    a.href = MT_CURRENT_RECIPE_PDF_URL;
    a.target = "_blank";
    a.rel = "noopener";
    a.download = "recette-methodetee.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  const frame = document.getElementById("mtRecipePdfFrame");
  if (!frame || !frame.contentWindow) {
    alert("L’aperçu n’est pas encore prêt.");
    return;
  }

  try {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  } catch (e) {
    alert("Utilise le bouton de partage/impression de ton navigateur pour enregistrer en PDF.");
  }
}

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
    const { ingredients, preparation, notes } = mtRecipePlainSections(recipe);
    const title = recipe.title || "Recette Méthode Tee";
    const subtitle = recipe.subtitle || recipe.description || "Une recette privée pensée comme un rituel simple, doux et intentionnel.";
    const category = recipe.category || "Recette";
    const mood = recipe.mood || "Rituel";
    const access = recipe.is_premium ? "Disponiblee" : "Libre";
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
            Télécharger la recette en PDF
          </button>
          <small>Une fiche propre s’ouvre pour l’enregistrer ou l’imprimer en PDF.</small>
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
      const refreshQuery = client.from('member_profiles').select('points,level,badge,level_label,claimed_rewards').eq('user_id', user.id).maybeSingle();
      Promise.resolve(refreshQuery).then(fresh => {
        if (fresh?.data) {
          try { localStorage.setItem(cacheKey, JSON.stringify(fresh.data)); } catch(e) {}
        }
      }).catch(()=>{});
    } else {
      const query = client.from('member_profiles').select('points,level,badge,level_label,claimed_rewards').eq('user_id', user.id).maybeSingle();
      result = await mtPromiseTimeout(query, 2200, null);
      if(result?.data){
        try { localStorage.setItem(cacheKey, JSON.stringify(result.data)); } catch(e) {}
      }
    }
    const mp = result?.data || cached || null;
    const xp = Number(mp?.points || 0);
    const levels = window.MT_LEVELS || [
      { min:0,    max:499,  key:'graine',    label:'Graine',     iconKey:'seed', reward:'Bibliothèque botanique', detail:'Accès aux bases végétales et à ton espace progression.' },
      { min:500,  max:1499, key:'pousse',    label:'Pousse',     iconKey:'sprout', reward:'Rituel exclusif Méthode Tee', detail:'Un rituel privé à ajouter à ton espace.' },
      { min:1500, max:3999, key:'floraison', label:'Floraison',  iconKey:'flower', reward:'Mini-protocole inédit 3 jours', detail:'Un mini-parcours bonus pour prolonger ton évolution.' },
      { min:4000, max:7999, key:'racines',   label:'Racines',    iconKey:'tree', reward:'Bon privé -10%', detail:'Un avantage privé sur un contenu Méthode Tee.' },
      { min:8000, max:Infinity, key:'alchimiste', label:'Alchimiste', iconKey:'sparkle', reward:'Question privée à Teeyana', detail:'Une question privée à poser depuis ton espace.' },
    ];
    const normalizedLevels = levels.map(l => ({...l, label: String(l.label || l.key || "").replace(/^[^\p{L}\p{N}]+\s*/u, ""), iconKey: l.iconKey || l.key || "seed"}));
    const currentLevel = normalizedLevels.find(l => xp >= l.min && xp <= l.max) || normalizedLevels[0];
    const nextLevel = normalizedLevels[normalizedLevels.indexOf(currentLevel) + 1];
    const progress = nextLevel ? Math.max(0, Math.min(100, Math.round(((xp - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100))) : 100;
    const xpToNext = nextLevel ? Math.max(0, nextLevel.min - xp) : 0;
    const claimed = Array.isArray(mp?.claimed_rewards) ? mp.claimed_rewards : [];
    const unlockedCount = normalizedLevels.filter(l => xp >= l.min).length;
    const claimableCount = normalizedLevels.filter(l => xp >= l.min && !claimed.includes(l.key)).length;

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
        ${claimableCount ? `Réclamer ${claimableCount} récompense${claimableCount>1?'s':''} →` : `Voir mes récompenses →`}
      </button>
      <p class="mt-xp-mini">${unlockedCount}/${normalizedLevels.length} niveau${normalizedLevels.length>1?'x':''} débloqué${unlockedCount>1?'s':''}</p>
    </section>`;
  } catch(e) { console.warn('XP card failed', e); return ''; }
};

window.mtReadClaimedRewards = async function(){
  const client = initSupabase && initSupabase();
  const user = await mtGetUser();
  let claimed = [];
  if(client && user){
    try{
      const { data } = await client.from('member_profiles').select('claimed_rewards').eq('user_id', user.id).maybeSingle();
      if(Array.isArray(data?.claimed_rewards)) claimed = data.claimed_rewards;
    }catch(e){}
  }
  try{
    const local = JSON.parse(localStorage.getItem(`mt_claimed_rewards_${user?.id || 'guest'}`) || "[]");
    claimed = [...new Set([...(claimed||[]), ...(Array.isArray(local)?local:[])])];
  }catch(e){}
  return claimed;
};

window.mtClaimReward = async function(key){
  const levels = window.MT_LEVELS || [];
  const level = levels.find(l => l.key === key);
  if(!level) return;
  const client = initSupabase && initSupabase();
  const user = await mtGetUser();
  let xp = 0, claimed = [];
  if(client && user){
    const { data: mp } = await client.from('member_profiles').select('points,claimed_rewards').eq('user_id', user.id).maybeSingle();
    xp = Number(mp?.points || 0);
    claimed = Array.isArray(mp?.claimed_rewards) ? mp.claimed_rewards : [];
  }
  try{
    const local = JSON.parse(localStorage.getItem(`mt_claimed_rewards_${user?.id || 'guest'}`) || "[]");
    claimed = [...new Set([...(claimed||[]), ...(Array.isArray(local)?local:[])])];
  }catch(e){}

  if(xp < level.min){
    if(window.mtToast) mtToast(`Encore ${Math.max(0, level.min - xp)} XP avant ${level.label}`, 'error');
    return;
  }
  if(claimed.includes(key)){
    if(window.mtToast) mtToast("Récompense déjà réclamée");
    return;
  }
  claimed.push(key);
  try{ localStorage.setItem(`mt_claimed_rewards_${user?.id || 'guest'}`, JSON.stringify(claimed)); }catch(e){}
  if(client && user){
    try{
      await client.from('member_profiles').update({ claimed_rewards: claimed }).eq('user_id', user.id);
    }catch(e){
      console.warn("claimed_rewards update failed", e);
    }
  }
  if(window.mtToast) mtToast(`Récompense ajoutée : ${level.reward}`);
  if(window.mtRewardClaimAnimation) window.mtRewardClaimAnimation(level);
  const modal = document.getElementById('mtRewardsModal');
  if(modal) modal.remove();
  setTimeout(()=>window.mtOpenRewards && window.mtOpenRewards(), 650);
};

window.mtOpenRewards = function() {
  let modal = document.getElementById('mtRewardsModal');
  if (modal) { modal.remove(); return; }
  const levels = window.MT_LEVELS || [];
  const normalizedLevels = levels.map(l => ({...l, label: String(l.label || l.key || "").replace(/^[^\p{L}\p{N}]+\s*/u, ""), iconKey: l.iconKey || l.key || "seed"}));

  (async () => {
    const client = initSupabase && initSupabase();
    const user = await mtGetUser();
    let xp = 0;
    let claimed = [];
    if (client && user) {
      const { data: mp } = await client.from('member_profiles').select('points,claimed_rewards').eq('user_id', user.id).maybeSingle();
      xp = Number(mp?.points || 0);
      claimed = Array.isArray(mp?.claimed_rewards) ? mp.claimed_rewards : [];
    }
    try{
      const local = JSON.parse(localStorage.getItem(`mt_claimed_rewards_${user?.id || 'guest'}`) || "[]");
      claimed = [...new Set([...(claimed||[]), ...(Array.isArray(local)?local:[])])];
    }catch(e){}

    const currentLevel = normalizedLevels.find(l => xp >= l.min && xp <= l.max) || normalizedLevels[0];
    const nextLevel = normalizedLevels[normalizedLevels.indexOf(currentLevel) + 1];
    const progress = nextLevel ? Math.max(0, Math.min(100, Math.round(((xp-currentLevel.min)/(nextLevel.min-currentLevel.min))*100))) : 100;

    const html = normalizedLevels.map(l => {
      const unlocked = xp >= l.min;
      const isClaimed = claimed.includes(l.key);
      const left = Math.max(0, l.min - xp);
      return `<div class="reward-row ${unlocked ? 'unlocked' : 'locked'} ${isClaimed ? 'claimed' : ''}">
        <span class="reward-emoji reward-icon">${mtIconHTML(l.iconKey || l.key, "reward-line-icon")}</span>
        <div class="reward-info">
          <b>${l.label}</b>
          <span>${l.reward}</span>
          <p>${l.detail || ''}</p>
          ${!unlocked ? `<em>${left.toLocaleString()} XP restants</em>` : isClaimed ? `<em class="reward-done">✓ Réclamée</em>` : `<em class="reward-ready">Disponible maintenant</em>`}
        </div>
        <div class="reward-side">
          <span class="reward-xp">${l.min.toLocaleString()} XP</span>
          ${unlocked && !isClaimed ? `<button class="reward-claim-btn" onclick="window.mtClaimReward('${l.key}')">Réclamer</button>` : ''}
        </div>
      </div>`;
    }).join('');

    modal = document.createElement('div');
    modal.id = 'mtRewardsModal';
    modal.className = 'mt-rewards-modal';
    modal.innerHTML = `
      <div class="mt-rewards-backdrop" onclick="document.getElementById('mtRewardsModal')?.remove()"></div>
      <div class="mt-rewards-inner">
        <div class="mt-rewards-header">
          <div>
            <small>Progression Méthode Tee</small>
            <h2>Tes récompenses</h2>
          </div>
          <button onclick="document.getElementById('mtRewardsModal').remove()">✕</button>
        </div>
        <div class="mt-rewards-progress">
          <div><b>${currentLevel?.label || 'Graine'}</b><span>${xp.toLocaleString()} XP</span></div>
          <i><em style="width:${progress}%"></em></i>
          ${nextLevel ? `<p>Encore ${Math.max(0,nextLevel.min-xp).toLocaleString()} XP avant ${nextLevel.label}</p>` : `<p>Niveau maximum atteint</p>`}
        </div>
        <p class="mt-rewards-sub">Tes XP font grandir ton jardin intérieur. Quand un seuil est atteint, la récompense devient réclamable.</p>
        <div class="mt-rewards-list">${html}</div>
        <div class="mt-rewards-gain">
          <small>Comment gagner des XP</small>
          <div class="gain-row"><span>Valider une journée de protocole</span><b>+10 XP</b></div>
          <div class="gain-row"><span>Valider un contenu</span><b>XP du contenu</b></div>
          <div class="gain-row"><span>Streak 7 jours</span><b>+50 XP bonus</b></div>
          <div class="gain-row"><span>Terminer un protocole complet</span><b>+100 XP</b></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
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
