/* =========================================================
   MÉTHODE TEE — PWA Push FIX + diagnostic visible
   Corrige le bouton Activer : feedback immédiat + erreurs visibles.
   ========================================================= */
(function(){
  'use strict';

  window.MT_PUSH_FIX_VERSION = 'push-fix-installed-app-message-2026-07-02';

  function toast(msg){
    try { if (window.mtToast) return window.mtToast(msg); } catch(e){}
    alert(msg);
  }

  function setPushUI(state, message){
    const buttons = document.querySelectorAll('#pushNotifBtn, .journey-push-btn, .push-notif-btn');
    buttons.forEach(btn => {
      if (!btn) return;
      if (state === 'loading') {
        btn.disabled = true;
        btn.classList.add('is-loading');
        btn.textContent = 'Activation…';
      } else if (state === 'on') {
        btn.disabled = true;
        btn.classList.remove('is-loading');
        btn.classList.add('is-on');
        btn.textContent = 'Activé ✓';
      } else {
        btn.disabled = false;
        btn.classList.remove('is-loading');
        btn.classList.remove('is-on');
        btn.textContent = 'Activer';
      }
    });

    const desc = document.getElementById('pushNotifDesc');
    if (desc && message) desc.textContent = message;
  }

  function getClient(){
    try { return typeof initSupabase === 'function' ? initSupabase() : null; }
    catch(e){ return null; }
  }

  function getVapidKey(){
    return (window.MT_CONFIG && window.MT_CONFIG.VAPID_PUBLIC_KEY) || window.MT_VAPID_PUBLIC_KEY || '';
  }

  function getFriendlyPushError(err){
    const raw = err && err.message ? err.message : String(err || '');
    const lower = raw.toLowerCase();

    if (
      lower.includes('notification') && lower.includes('non support') ||
      lower.includes('pushmanager') ||
      lower.includes('service worker non support') ||
      lower.includes('non disponible')
    ) {
      return 'Les notifications sont disponibles uniquement depuis l’app installée. Ajoute Méthode Tee à l’écran d’accueil puis ouvre-la depuis son icône';
    }

    return raw || 'Les notifications n’ont pas pu être activées pour le moment.';
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
    if (!('serviceWorker' in navigator)) throw new Error('Les notifications sont disponibles uniquement depuis l’app installée. Ajoute Méthode Tee à l’écran d’accueil puis ouvre-la depuis son icône');
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    return reg;
  }

  async function saveSubscription(subscription){
    const client = getClient();
    if (!client) throw new Error('Supabase non disponible dans la page.');

    if (typeof mtGetUser !== 'function') throw new Error('mtGetUser introuvable. Connecte-toi puis réessaie.');
    const user = await mtGetUser();
    if (!user) throw new Error('Utilisateur non connecté. Connecte-toi puis réessaie.');

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

    if (error) throw new Error(error.message || JSON.stringify(error));
  }

  async function enablePush(){
    setPushUI('loading', 'Activation des rappels en cours…');

    try{
      if (!window.isSecureContext) throw new Error('Le site doit être ouvert en HTTPS.');

      if (!('Notification' in window)) {
        throw new Error('Les notifications sont disponibles uniquement depuis l’app installée. Ajoute Méthode Tee à l’écran d’accueil puis ouvre-la depuis son icône');
      }

      if (!('PushManager' in window)) {
        throw new Error('Les notifications sont disponibles uniquement depuis l’app installée. Ajoute Méthode Tee à l’écran d’accueil puis ouvre-la depuis son icône');
      }

      const vapid = getVapidKey();
      if (!vapid || vapid.includes('REMPLACE') || vapid.length < 50) {
        throw new Error('Clé VAPID publique absente ou invalide dans config.js.');
      }

      let permission = Notification.permission;
      if (permission !== 'granted') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        throw new Error('Permission notifications refusée ou non accordée.');
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
      setPushUI('on', 'Tes rappels doux sont activés');
      toast('Rappels doux activés');
      return true;
    } catch(err){
      console.error('[MT Push FIX]', err);
      const friendlyMessage = getFriendlyPushError(err);
      setPushUI('off', friendlyMessage);
      toast(friendlyMessage);
      return false;
    }
  }

  async function refreshPushButtons(){
    try{
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const reg = await navigator.serviceWorker.getRegistration('./');
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) setPushUI('on', 'Tes rappels doux sont activés');
    } catch(e){ console.warn('[MT Push refresh]', e); }
  }

  window.mtEnablePushNotifications = enablePush;
  window.mtRefreshPushButtons = refreshPushButtons;

  document.addEventListener('click', function(e){
    const btn = e.target.closest && e.target.closest('#pushNotifBtn, .journey-push-btn, .push-notif-btn');
    if (!btn) return;
    e.preventDefault();
    enablePush();
  }, true);

  document.addEventListener('DOMContentLoaded', () => setTimeout(refreshPushButtons, 1200));
})();
