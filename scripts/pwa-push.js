/* =========================================================
   MÉTHODE TEE — V414 notifications premium
   - iOS natif : vraie inscription APNs via Capacitor PushNotifications
   - Web/PWA : conserve Web Push + VAPID
   - Les rappels éditoriaux locaux restent compatibles via LocalNotifications
   ========================================================= */
(function(){
  'use strict';

  window.MT_PUSH_FIX_VERSION = 'v414-native-apns-premium-2026-08-29';

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

  function isNativeApp(){
    try {
      return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
    } catch(e) { return false; }
  }

  function nativePushPlugin(){
    try { return window.Capacitor?.Plugins?.PushNotifications || null; }
    catch(e){ return null; }
  }

  function cleanNativeRoute(value){
    let route=String(value||'').trim();
    if(!route)return '';
    try{
      if(/^https?:\/\//i.test(route)){
        const u=new URL(route);
        route=(u.pathname||'/index.html')+(u.search||'')+(u.hash||'');
      }
    }catch(e){}
    route=route.replace(/^\/+/, '');
    if(!route||route.startsWith('javascript:'))return '';
    return route;
  }

  function openNativeRoute(notification){
    const data=notification?.data||notification?.notification?.data||{};
    const route=cleanNativeRoute(data.url||data.route||data.href||'');
    if(!route)return;
    setTimeout(()=>{ try{ location.href=route; }catch(e){} },80);
  }

  async function saveNativeToken(token){
    const value=String(token||'').trim();
    if(!value)throw new Error('Token APNs vide.');
    const client=getClient();
    if(!client)throw new Error('Notifications momentanément indisponibles.');
    const user=typeof mtGetUser==='function'?await mtGetUser():null;
    if(!user?.id)throw new Error('Connecte-toi avant d’activer les notifications.');
    const {error}=await client.rpc('claim_native_push_token',{
      p_token:value,
      p_platform:'ios',
      p_user_agent:navigator.userAgent||null
    });
    if(error)throw error;
    try{localStorage.setItem('mt_native_reminders_enabled','1');}catch(e){}
  }

  let nativeListenersInstalled=false;
  let nativeRegistrationWaiters=[];
  async function installNativeListeners(){
    if(nativeListenersInstalled)return;
    const plugin=nativePushPlugin();
    if(!plugin)throw new Error('Le module de notifications push iPhone n’est pas disponible dans ce build.');

    await plugin.addListener('registration', async token=>{
      try{
        await saveNativeToken(token?.value);
        const waiters=nativeRegistrationWaiters.splice(0);
        waiters.forEach(w=>w.resolve(token?.value||''));
        setPushUI('on','Notifications push iPhone activées. Tu recevras les nouveaux contenus et rappels importants même lorsque l’app est fermée.');
      }catch(err){
        console.error('[MT Native Push token]',err);
        const waiters=nativeRegistrationWaiters.splice(0);
        waiters.forEach(w=>w.reject(err));
      }
    });
    await plugin.addListener('registrationError', err=>{
      const error=new Error(err?.error||'Impossible d’enregistrer cet iPhone auprès d’Apple Push Notification service.');
      console.error('[MT Native Push registration]',err);
      const waiters=nativeRegistrationWaiters.splice(0);
      waiters.forEach(w=>w.reject(error));
    });
    await plugin.addListener('pushNotificationActionPerformed', action=>openNativeRoute(action?.notification));
    nativeListenersInstalled=true;
  }

  async function registerNativePush({ask=true,silent=false}={}){
    const plugin=nativePushPlugin();
    if(!plugin)throw new Error('Le module de notifications push iPhone n’est pas disponible dans ce build.');
    await installNativeListeners();
    let permissions=await plugin.checkPermissions();
    if(ask && permissions?.receive!=='granted')permissions=await plugin.requestPermissions();
    if(permissions?.receive!=='granted'){
      if(silent)return false;
      throw new Error('Permission notifications refusée. Tu peux l’autoriser dans Réglages > Notifications > Méthode Tee.');
    }

    const registration=new Promise((resolve,reject)=>{
      const waiter={resolve,reject};
      nativeRegistrationWaiters.push(waiter);
      setTimeout(()=>{
        const i=nativeRegistrationWaiters.indexOf(waiter);
        if(i>=0){nativeRegistrationWaiters.splice(i,1);reject(new Error('Apple n’a pas renvoyé le token push à temps. Réessaie dans quelques secondes.'));}
      },12000);
    });
    await plugin.register();
    await registration;
    return true;
  }

  function getFriendlyPushError(err){
    const raw = err && err.message ? err.message : String(err || '');
    const lower = raw.toLowerCase();
    if (lower.includes('pushmanager') || lower.includes('service worker non support') || lower.includes('non disponible')) {
      return 'Les notifications sont disponibles depuis l’app installée. Ajoute Méthode Tee à l’écran d’accueil ou utilise l’app iPhone.';
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
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker non disponible.');
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    return reg;
  }

  async function saveSubscription(subscription){
    const client = getClient();
    if (!client) throw new Error('Notifications momentanément indisponibles.');
    if (typeof mtGetUser !== 'function') throw new Error('Connecte-toi puis réessaie.');
    const user = await mtGetUser();
    if (!user) throw new Error('Utilisateur non connecté.');
    const payload = {
      user_id: user.id,
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON(),
      enabled: true,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from('push_subscriptions').upsert(payload, { onConflict: 'endpoint' });
    if (error) throw error;
  }

  let pushBusy=false;
  async function enablePush(){
    if(pushBusy)return false;
    pushBusy=true;
    setPushUI('loading',isNativeApp()?'Connexion sécurisée aux notifications Apple…':'Activation des notifications…');
    try{
      if(isNativeApp()){
        await registerNativePush({ask:true,silent:false});
        toast('Notifications push iPhone activées');
        return true;
      }

      if (!window.isSecureContext) throw new Error('Le site doit être ouvert en HTTPS.');
      if (!('Notification' in window) || !('PushManager' in window)) throw new Error('PushManager non disponible.');
      const vapid=getVapidKey();
      if(!vapid||vapid.includes('REMPLACE')||vapid.length<50)throw new Error('Clé VAPID publique absente ou invalide dans config.js.');
      let permission=Notification.permission;
      if(permission!=='granted')permission=await Notification.requestPermission();
      if(permission!=='granted')throw new Error('Permission notifications refusée ou non accordée.');
      const reg=await registerSW();
      let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapid)});
      await saveSubscription(sub);
      setPushUI('on','Notifications activées.');
      toast('Notifications activées');
      return true;
    }catch(err){
      console.error('[MT Push V414]',err);
      const friendly=getFriendlyPushError(err);
      setPushUI('off',friendly);
      if(!String(err?.message||'').includes('refusée')||!isNativeApp())toast(friendly); else toast(friendly);
      return false;
    }finally{pushBusy=false;}
  }

  async function refreshPushButtons(){
    try{
      if(isNativeApp()){
        const plugin=nativePushPlugin();
        if(!plugin){setPushUI('off','Les notifications push nécessitent la synchronisation native de ce build.');return;}
        await installNativeListeners();
        const permissions=await plugin.checkPermissions();
        if(permissions?.receive==='granted'){
          setPushUI('on','Notifications push iPhone activées.');
          // Apple recommande de redemander un token à chaque lancement : il peut changer.
          registerNativePush({ask:false,silent:true}).catch(e=>console.warn('[MT Native Push refresh]',e));
        }else{
          setPushUI('off','Active les notifications pour recevoir les nouveaux contenus et rappels importants sur ton iPhone.');
        }
        return;
      }
      if(!('serviceWorker' in navigator)||!('PushManager' in window))return;
      const reg=await navigator.serviceWorker.getRegistration('./');
      if(!reg)return;
      const sub=await reg.pushManager.getSubscription();
      if(sub)setPushUI('on','Notifications activées.');
    }catch(e){console.warn('[MT Push refresh]',e);}
  }

  window.mtEnablePushNotifications=enablePush;
  window.mtRefreshPushButtons=refreshPushButtons;

  document.addEventListener('click',function(e){
    const btn=e.target.closest&&e.target.closest('#pushNotifBtn, .journey-push-btn, .push-notif-btn');
    if(!btn)return;
    e.preventDefault();
    enablePush();
  },true);

  document.addEventListener('DOMContentLoaded',()=>setTimeout(refreshPushButtons,700));
})();
