/* =========================================================
   MÉTHODE TEE V19.4 — PWA Push SAFE
   Opt-in client + stockage Supabase subscription.
   Ne touche pas Stripe / paiement / déblocage.
   ========================================================= */
(function(){
  'use strict';

  function toast(msg){
    if (window.mtToast) return window.mtToast(msg);
    alert(msg);
  }

  function getClient(){
    try { return typeof initSupabase === 'function' ? initSupabase() : null; }
    catch(e){ return null; }
  }

  function getVapidKey(){
    return (window.MT_CONFIG && window.MT_CONFIG.VAPID_PUBLIC_KEY) || window.MT_VAPID_PUBLIC_KEY || "";
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  async function registerSW(){
    if (!('serviceWorker' in navigator)) throw new Error("Service Worker non supporté.");
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  }

  async function saveSubscription(subscription){
    const client = getClient();
    if (!client) throw new Error("Supabase non disponible.");
    const user = await mtGetUser();
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

    if (error) throw error;
  }

  async function enablePush(){
    try{
      if (!('Notification' in window)) {
        toast("Les notifications ne sont pas supportées sur ce navigateur.");
        return false;
      }
      if (!('PushManager' in window)) {
        toast("Les notifications push ne sont pas supportées ici. Sur iPhone, ajoute l’app à l’écran d’accueil.");
        return false;
      }

      const vapid = getVapidKey();
      if (!vapid || vapid.includes("REMPLACE")) {
        toast("Rappels bientôt prêts 🌿 Il manque la clé VAPID dans config.js.");
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast("Notifications non activées.");
        return false;
      }

      const reg = await registerSW();
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid)
        });
      }

      await saveSubscription(sub);
      document.querySelectorAll('.journey-push-btn').forEach(btn => {
        btn.classList.add('is-on');
        btn.textContent = 'Rappels activés';
      });
      toast("Rappels doux activés 🌿");
      return true;
    } catch(err){
      console.error('[MT Push]', err);
      toast("Impossible d’activer les rappels pour l’instant.");
      return false;
    }
  }

  async function refreshPushButtons(){
    try{
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        document.querySelectorAll('.journey-push-btn').forEach(btn => {
          btn.classList.add('is-on');
          btn.textContent = 'Rappels activés';
        });
      }
    } catch(e){}
  }

  window.mtEnablePushNotifications = enablePush;
  window.mtRefreshPushButtons = refreshPushButtons;
  document.addEventListener('DOMContentLoaded', () => setTimeout(refreshPushButtons, 1200));
})();
