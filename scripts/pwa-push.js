/* =========================================================
   MÉTHODE TEE — PWA Push PATCH DIAGNOSTIC + REGISTER FIX
   Objectif :
   1) rendre le bouton "Activer les rappels" vraiment traçable
   2) afficher l'erreur exacte si l'abonnement push échoue
   3) enregistrer le Service Worker sans dépendre d'un chemin absolu fragile
   4) écrire la subscription dans public.push_subscriptions
   Ne touche pas Stripe / paiements / déblocages.
   ========================================================= */
(function(){
  'use strict';

  const PUSH_BUTTON_SELECTOR = '.journey-push-btn, #pushNotifBtn';

  function toast(msg, type){
    try {
      if (window.mtToast) return window.mtToast(msg, type || 'success');
    } catch(e) {}
    alert(msg);
  }

  function setButtons(label, isOn){
    document.querySelectorAll(PUSH_BUTTON_SELECTOR).forEach(btn => {
      if (!btn) return;
      btn.disabled = false;
      btn.classList.toggle('is-on', !!isOn);
      btn.textContent = label;
    });
  }

  function setButtonsLoading(label){
    document.querySelectorAll(PUSH_BUTTON_SELECTOR).forEach(btn => {
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = label || 'Activation...';
    });
  }

  function getClient(){
    try {
      if (typeof initSupabase === 'function') return initSupabase();
      return null;
    } catch(e){
      throw new Error("Supabase init impossible : " + (e?.message || e));
    }
  }

  async function getCurrentUser(){
    if (typeof mtGetUser === 'function') return await mtGetUser();

    const client = getClient();
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }

  function getVapidKey(){
    return (window.MT_CONFIG && window.MT_CONFIG.VAPID_PUBLIC_KEY) || window.MT_VAPID_PUBLIC_KEY || "";
  }

  function urlBase64ToUint8Array(base64String) {
    const clean = String(base64String || '').trim();
    const padding = '='.repeat((4 - clean.length % 4) % 4);
    const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function isStandalonePWA(){
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }

  function isIOS(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  }

  function assertEnvironment(){
    if (!window.isSecureContext) {
      throw new Error("Le site doit être ouvert en HTTPS pour activer les notifications.");
    }
    if (!('Notification' in window)) {
      throw new Error("Notifications non supportées par ce navigateur.");
    }
    if (!('serviceWorker' in navigator)) {
      throw new Error("Service Worker non supporté par ce navigateur.");
    }
    if (!('PushManager' in window)) {
      throw new Error("PushManager non supporté. Sur iPhone, ouvre l'app installée sur l'écran d'accueil.");
    }
    if (isIOS() && !isStandalonePWA()) {
      throw new Error("Sur iPhone, ouvre Méthode Tee depuis l'icône installée sur l'écran d'accueil, pas depuis Safari.");
    }
  }

  async function registerSW(){
    /*
      Important :
      - Ancienne version : /sw.js avec scope /
      - Ça peut échouer si l'app est servie avec un chemin ou un domaine différent.
      - Ici on enregistre sw.js depuis le dossier courant, ce qui marche en racine custom domain.
    */
    const swUrl = new URL('sw.js', window.location.href);
    const reg = await navigator.serviceWorker.register(swUrl.pathname, { scope: './' });
    await navigator.serviceWorker.ready;
    return reg;
  }

  async function saveSubscription(subscription){
    const client = getClient();
    if (!client) throw new Error("Supabase non disponible.");

    const user = await getCurrentUser();
    if (!user) throw new Error("Utilisateur non connecté.");

    const payload = {
      user_id: user.id,
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON(),
      enabled: true,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .from('push_subscriptions')
      .upsert(payload, { onConflict: 'endpoint' });

    if (error) {
      throw new Error("Erreur Supabase push_subscriptions : " + (error.message || JSON.stringify(error)));
    }
  }

  async function enablePush(){
    setButtonsLoading('Activation...');
    try{
      assertEnvironment();

      const vapid = getVapidKey();
      if (!vapid || vapid.includes("REMPLACE")) {
        throw new Error("Clé VAPID publique absente dans config.js.");
      }

      const vapidBytes = urlBase64ToUint8Array(vapid);
      if (vapidBytes.length !== 65) {
        throw new Error("Clé VAPID publique invalide : longueur " + vapidBytes.length + " au lieu de 65.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error("Autorisation refusée ou non accordée : " + permission);
      }

      const reg = await registerSW();
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidBytes
        });
      }

      await saveSubscription(sub);

      try {
        localStorage.setItem('mt_push_enabled_at', new Date().toISOString());
      } catch(e) {}

      setButtons('Rappels activés', true);
      toast("Rappels doux activés 🌿");
      return true;
    } catch(err){
      console.error('[MT Push]', err);
      setButtons('Activer', false);
      toast("Erreur notifications : " + (err?.message || err), 'error');
      return false;
    }
  }

  async function refreshPushButtons(){
    try{
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const regs = await navigator.serviceWorker.getRegistrations();
      let sub = null;

      for (const reg of regs) {
        try {
          sub = await reg.pushManager.getSubscription();
          if (sub) break;
        } catch(e) {}
      }

      if (sub || localStorage.getItem('mt_push_enabled_at')) {
        setButtons('Rappels activés', true);
      }
    } catch(e){
      console.warn('[MT Push refresh]', e);
    }
  }

  async function debugPush(){
    const report = {
      secureContext: window.isSecureContext,
      notificationSupport: 'Notification' in window,
      notificationPermission: ('Notification' in window) ? Notification.permission : 'unsupported',
      serviceWorkerSupport: 'serviceWorker' in navigator,
      pushManagerSupport: 'PushManager' in window,
      standalonePWA: isStandalonePWA(),
      ios: isIOS(),
      vapidPresent: !!getVapidKey(),
      vapidLength: (() => { try { return urlBase64ToUint8Array(getVapidKey()).length; } catch(e){ return 'invalid'; } })()
    };
    console.table(report);
    toast("Diagnostic push : " + JSON.stringify(report), 'success');
    return report;
  }

  window.mtEnablePushNotifications = enablePush;
  window.mtRefreshPushButtons = refreshPushButtons;
  window.mtPushDebug = debugPush;

  document.addEventListener('DOMContentLoaded', () => setTimeout(refreshPushButtons, 1200));
})();
