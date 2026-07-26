/* Méthode Tee — V261 « Notre journée ensemble »
   Module collectif indépendant de daily_rituals.
   Un payload par journée, aucun polling, aucun intervalle, aucun observer.
*/
(function(){
  'use strict';

  const CACHE_TTL = 5 * 60 * 1000;
  const SLOT_ORDER = ['wake_up','morning','lunch','afternoon','evening','before_sleep'];
  const SLOT_LABELS = {
    wake_up:'Réveil', morning:'Matin', lunch:'Déjeuner', afternoon:'Après-midi', evening:'Soir', before_sleep:'Nuit'
  };
  const DEFAULT_SETTINGS = {
    title:'Notre journée ensemble',
    subtitle:'Les rendez-vous de la communauté au rythme de ta journée.',
    show_member_count:true,
    member_minimum:50,
    timezone_mode:'local',
    empty_message:'La journée se vit plus librement aujourd’hui.'
  };
  const state = {
    date:'', payload:null, user:null, completions:{}, loaded:false,
    request:null, participationSynced:false, openingScrollY:0,
    notificationSignature:''
  };

  const safe = value => String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const readJSON = (key, fallback) => { try { const v=JSON.parse(localStorage.getItem(key)||'null'); return v ?? fallback; } catch(_){ return fallback; } };
  const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch(_){} };
  const client = () => (typeof initSupabase === 'function' ? initSupabase() : null);

  function localDateKey(date=new Date(), mode='local'){
    const d = date instanceof Date ? date : new Date(date);
    if(mode === 'europe_paris'){
      try{
        const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
        const values = Object.fromEntries(parts.map(p=>[p.type,p.value]));
        return `${values.year}-${values.month}-${values.day}`;
      }catch(_){ }
    }
    const shifted = new Date(d.getTime() - d.getTimezoneOffset()*60000);
    return shifted.toISOString().slice(0,10);
  }
  function currentDate(){ return localDateKey(new Date(), state.payload?.settings?.timezone_mode || 'local'); }
  const cacheKey = date => `mt_community_journey_payload_v261_${date}`;
  const completionKey = (uid,date) => `mt_community_journey_completion_v261_${uid||'guest'}_${date}`;
  const participationKey = (uid,date) => `mt_community_journey_participation_v261_${uid||'guest'}_${date}`;

  async function getUser(){
    if(state.user) return state.user;
    try{
      if(typeof mtGetUser === 'function') state.user = await mtGetUser();
      else state.user = (await client()?.auth.getUser())?.data?.user || null;
    }catch(_){ state.user=null; }
    return state.user;
  }
  function readCache(date){
    const v=readJSON(cacheKey(date),null);
    if(!v || v.date!==date || Date.now()-Number(v.cached_at||0)>CACHE_TTL) return null;
    return v;
  }
  function writeCache(payload){ if(payload?.date) writeJSON(cacheKey(payload.date),payload); }
  function normalizePayload(raw,date){
    return {
      date,
      items:Array.isArray(raw?.items)?raw.items.filter(Boolean):[],
      settings:{...DEFAULT_SETTINGS,...(raw?.settings||{})},
      member_count:Math.max(0,Number(raw?.member_count||0)),
      completions:Array.isArray(raw?.completions)?raw.completions:[],
      cached_at:Date.now()
    };
  }
  function completionMap(payload,uid,date){
    const local=readJSON(completionKey(uid,date),{});
    const cloud={};
    (payload?.completions||[]).forEach(c=>{
      if(c?.journey_item_id && c.completed!==false) cloud[String(c.journey_item_id)]={completed:true,completed_at:c.completed_at||c.updated_at||null,source:'cloud'};
    });
    const merged={...local,...cloud};
    writeJSON(completionKey(uid,date),merged);
    return merged;
  }
  async function fetchPayload(date,force=false){
    if(!force){ const cached=readCache(date); if(cached) return cached; }
    const c=client();
    if(!c) return normalizePayload({},date);
    try{
      const {data,error}=await c.rpc('community_journey_payload',{target_date:date});
      if(error) throw error;
      const payload=normalizePayload(data||{},date);
      writeCache(payload);
      return payload;
    }catch(error){
      console.warn('Community journey payload',error);
      return readCache(date)||normalizePayload({},date);
    }
  }

  function displayTime(value){
    const raw=String(value||'').slice(0,5);
    const m=raw.match(/^(\d{2}):(\d{2})$/);
    return m?`${Number(m[1])}H${m[2]}`:'';
  }
  function minutes(value){
    const m=String(value||'').match(/^(\d{1,2}):(\d{2})/);
    return m?Number(m[1])*60+Number(m[2]):null;
  }
  function statusFor(item,done){
    if(done) return {key:'done',label:item.completed_label||'Terminé'};
    const at=minutes(item.scheduled_time);
    if(at===null) return {key:'todo',label:item.validation_enabled===false?'Disponible':'À faire'};
    const now=new Date(); const cur=now.getHours()*60+now.getMinutes();
    return cur<at?{key:'upcoming',label:'À venir'}:{key:'todo',label:item.validation_enabled===false?'Disponible':'À faire'};
  }
  function iconHTML(key,cls=''){
    if(typeof mtIconHTML==='function') return mtIconHTML(key==='members'?'profile':(key||'sparkle'),cls);
    const map={hydration:'💧',fuel:'🥣',movement:'◌',leaf:'🌿',journal:'☾',sparkle:'✦',calendar:'◷',checklist:'✓',recipe:'🥣',moon:'☾',cloud:'☁',members:'◎'};
    return `<span class="${safe(cls)}">${map[key]||'✦'}</span>`;
  }
  function memberCopy(count,settings){
    if(settings.show_member_count===false) return '';
    const min=Math.max(0,Number(settings.member_minimum||0));
    if(count<min) return '';
    if(count>=50) return `<strong>${count} membres</strong><span>avancent avec toi</span>`;
    if(count>=10) return `<strong>La communauté</strong><span>avance</span>`;
    if(count>=2) return `<strong>Quelques membres</strong><span>avec toi</span>`;
    if(count===1) return `<strong>Tu lances</strong><span>le mouvement</span>`;
    return '';
  }
  function progressHTML(done,total){
    const pct=total?Math.round(done/total*100):0;
    return `<div class="mt-journey-progress" data-mt-journey-progress><div class="mt-journey-progress-track"><i style="width:${pct}%"></i></div><small><b>${done}</b> / ${total} gestes réalisés</small></div>`;
  }
  function homeItems(){
    return (state.payload?.items||[]).filter(i=>i.show_on_home).sort((a,b)=>Number(a.display_order)-Number(b.display_order)).slice(0,4);
  }
  function pillItems(){
    return (state.payload?.items||[]).filter(i=>i.show_as_pill).sort((a,b)=>Number(a.display_order)-Number(b.display_order));
  }
  function cardHTML(item,detail=false){
    const done=!!state.completions[String(item.id)];
    const st=statusFor(item,done);
    const time=displayTime(item.scheduled_time);
    const linked=!!(item.linked_url||item.linked_content_id);
    if(detail){
      return `<article class="mt-journey-detail-card ${st.key}" data-journey-item-id="${safe(item.id)}">
        <div class="mt-journey-detail-icon">${iconHTML(item.icon_key||'sparkle')}</div>
        <div class="mt-journey-detail-copy">${time?`<span class="mt-journey-time">${safe(time)}</span>`:''}<small>${safe(SLOT_LABELS[item.slot_key]||'Rendez-vous')}</small><h3>${safe(item.title)}</h3>${item.short_text?`<p>${safe(item.short_text)}</p>`:''}
        ${item.validation_enabled!==false?`<button type="button" class="mt-journey-status ${st.key}" data-journey-toggle="${safe(item.id)}">${safe(done?(item.completed_label||'Terminé'):(item.validation_label||st.label))}</button>`:`<span class="mt-journey-status ${st.key}">${safe(st.label)}</span>`}</div>
        ${linked?`<button type="button" class="mt-journey-open-target" data-journey-open-target="${safe(item.id)}" aria-label="Ouvrir le contenu">›</button>`:'<span></span>'}
      </article>`;
    }
    return `<button type="button" class="club-v18-tile mt-journey-tile ${st.key}" data-journey-focus="${safe(item.id)}">
      <b>${iconHTML(item.icon_key||'sparkle')}</b>${time?`<em class="mt-journey-card-time">${safe(time)}</em>`:''}
      <strong>${safe(item.title)}</strong><span class="mt-journey-card-sub">${safe(item.short_text||SLOT_LABELS[item.slot_key]||'')}</span>
      <small class="mt-journey-card-status ${st.key}">${safe(st.label)}</small>
    </button>`;
  }
  function pillsHTML(){
    const items=pillItems();
    if(!items.length) return '';
    return `<div class="club-v18-actions mt-journey-pills" data-mt-journey-pills>${items.map(item=>{
      const done=!!state.completions[String(item.id)];
      return `<button type="button" class="${done?'is-done':''}" data-journey-toggle="${safe(item.id)}">${done?'✓ ':''}${safe(item.pill_label||item.title)}</button>`;
    }).join('')}</div>`;
  }
  function renderHome(){
    const panel=document.getElementById('clubV18Panel');
    if(!panel||!state.payload) return;
    const all=state.payload.items||[];
    const homes=homeItems();

    // Sans rendez-vous publié pour aujourd'hui, on conserve strictement le bloc V258.
    // Aucun état vide, aucune fausse carte et aucun compteur 0/0 ne sont injectés.
    if(!all.length || !homes.length){
      panel.classList.remove('mt-daily-journey-home');
      panel.removeAttribute('data-journey-open-page');
      delete panel.dataset.dailyJourneyOwner;
      return;
    }

    panel.dataset.dailyJourneyOwner='v261';
    panel.dataset.hydrated='1';
    panel.classList.add('mt-daily-journey-home');
    panel.setAttribute('data-journey-open-page','');
    panel.setAttribute('aria-busy','false');

    const done=all.filter(i=>state.completions[String(i.id)]).length;
    const member=memberCopy(state.payload.member_count,state.payload.settings);
    panel.innerHTML=`<div class="club-v18-head"><div><div class="club-v18-kicker">Échos du journal</div><h2>${safe(state.payload.settings.title)} ✨</h2><p>${safe(state.payload.settings.subtitle)}</p></div><div class="club-streak-pill">Aujourd’hui</div></div>
      <div class="club-v18-grid mt-journey-home-grid">${homes.map(i=>cardHTML(i)).join('')}</div>
      <div class="mt-journey-community ${member?'':'is-counter-hidden'}">${member?`<div class="mt-journey-members">${iconHTML('members')}<div>${member}</div></div>`:''}${progressHTML(done,all.length)}</div>${pillsHTML()}`;
  }
  function slotLineHTML(){
    const all=state.payload?.items||[];
    return SLOT_ORDER.map(slot=>{
      const items=all.filter(i=>i.slot_key===slot);
      const completed=items.length>0&&items.every(i=>state.completions[String(i.id)]);
      const hasCurrent=items.some(i=>statusFor(i,!!state.completions[String(i.id)]).key==='todo');
      const cls=!items.length?'empty':completed?'done':hasCurrent?'current':'future';
      const mark=!items.length?'—':completed?'✓':hasCurrent?'●':'○';
      return `<span class="${cls}"><b>${mark}</b><small>${safe(SLOT_LABELS[slot])}</small></span>`;
    }).join('');
  }
  function renderDetail(focusId=''){
    const page=document.getElementById('mtDailyJourneyPage'); if(!page||!state.payload) return;
    page.querySelector('[data-mt-journey-title]').textContent=state.payload.settings.title;
    page.querySelector('[data-mt-journey-subtitle]').textContent=state.payload.settings.subtitle;
    const dayline=page.querySelector('[data-mt-journey-dayline]'); if(dayline) dayline.innerHTML=slotLineHTML();
    const all=state.payload.items||[]; const done=all.filter(i=>state.completions[String(i.id)]).length;
    const member=memberCopy(state.payload.member_count,state.payload.settings);
    page.querySelector('[data-mt-journey-summary]').innerHTML=`${member?`<div class="mt-journey-members">${iconHTML('members')}<div>${member}</div></div>`:'<div></div>'}${progressHTML(done,all.length)}`;
    page.querySelector('[data-mt-journey-list]').innerHTML=all.length?all.map(i=>cardHTML(i,true)).join(''):`<div class="empty-card"><h2>Moment libre</h2><p>${safe(state.payload.settings.empty_message||DEFAULT_SETTINGS.empty_message)}</p></div>`;
    const actions=page.querySelector('[data-mt-journey-detail-pills]'); if(actions) actions.innerHTML=pillsHTML();
    if(focusId) requestAnimationFrame(()=>page.querySelector(`[data-journey-item-id="${CSS.escape(String(focusId))}"]`)?.scrollIntoView({block:'center'}));
  }
  function updateRendered(){ renderHome(); if(document.getElementById('mtDailyJourneyPage')?.classList.contains('is-open')) renderDetail(); }

  async function ensureCurrentDate(force=false){
    const mode=state.payload?.settings?.timezone_mode||'local';
    const date=localDateKey(new Date(),mode);
    if(!force&&state.loaded&&state.date===date) return;
    if(state.request) return state.request;
    state.date=date;
    const user=await getUser();
    state.participationSynced=!!readJSON(participationKey(user?.id,date),false);
    const cached=readCache(date);
    if(cached){ state.payload=cached; state.completions=completionMap(cached,user?.id,date); renderHome(); }
    state.request=fetchPayload(date,force||!cached).then(payload=>{
      if(state.date!==date) return;
      state.payload=payload; state.completions=completionMap(payload,user?.id,date); state.loaded=true;
      renderHome(); scheduleTodayNotifications();
    }).finally(()=>{state.request=null;});
    return state.request;
  }
  async function participate(completedNow=false){
    const date=currentDate(); if(state.date!==date) await ensureCurrentDate(true);
    const user=await getUser(); if(!user) return;
    const c=client(); if(!c) return;
    if(state.participationSynced&&!completedNow) return;
    try{
      const {data,error}=await c.rpc('community_journey_participate',{target_date:date,completed_now:!!completedNow});
      if(error) throw error;
      state.participationSynced=true; writeJSON(participationKey(user.id,date),true);
      if(state.payload){state.payload.member_count=Math.max(0,Number(data||state.payload.member_count));writeCache(state.payload);updateRendered();}
    }catch(error){ console.warn('Community journey participation',error); }
  }
  async function toggleItem(id){
    const date=currentDate(); if(state.date!==date) await ensureCurrentDate(true);
    const item=(state.payload?.items||[]).find(i=>String(i.id)===String(id)); if(!item||item.validation_enabled===false) return;
    const user=await getUser(); const key=String(id); const was=!!state.completions[key];
    if(was) delete state.completions[key]; else state.completions[key]={completed:true,completed_at:new Date().toISOString(),source:'local'};
    writeJSON(completionKey(user?.id,date),state.completions); updateRendered();
    if(!was) participate(true);
    if(!user||!client()) return;
    try{
      if(was){
        const {error}=await client().from('community_journey_completions').delete().eq('user_id',user.id).eq('journey_item_id',id).eq('journey_date',date); if(error) throw error;
      }else{
        const now=new Date().toISOString();
        const {error}=await client().from('community_journey_completions').upsert({user_id:user.id,journey_item_id:id,journey_date:date,completed:true,completed_at:now,updated_at:now},{onConflict:'user_id,journey_item_id,journey_date'}); if(error) throw error;
      }
      const cached=readCache(date); if(cached){cached.completions=Object.entries(state.completions).map(([journey_item_id,v])=>({journey_item_id,completed:!!v,completed_at:v?.completed_at||null}));writeCache(cached);}
    }catch(error){
      if(was) state.completions[key]={completed:true,source:'rollback'}; else delete state.completions[key];
      writeJSON(completionKey(user.id,date),state.completions); updateRendered();
      console.warn('Community journey completion',error);
    }
  }
  function openLinked(item){
    if(!item) return;
    if(item.linked_url){ location.href=item.linked_url; return; }
    const type=String(item.linked_content_type||'').toLowerCase(); const id=item.linked_content_id;
    if(!id) return;
    if(type==='post'&&typeof mtOpenPostById==='function') return mtOpenPostById(id);
    if(type==='recipe'&&typeof openRecipeViewer==='function') return openRecipeViewer(id);
    if(type==='protocol') { location.href=`protocol.html?id=${encodeURIComponent(id)}`; return; }
    if(type==='page') { location.href=`page.html?id=${encodeURIComponent(id)}`; return; }
    if(type==='audio'||type==='pdf'||type==='url') { location.href=String(id); }
  }
  async function openPage(focusId=''){
    await ensureCurrentDate();
    state.openingScrollY=window.scrollY;
    const page=document.getElementById('mtDailyJourneyPage'); if(!page) return;
    renderDetail(focusId); page.hidden=false; requestAnimationFrame(()=>page.classList.add('is-open'));
    document.body.classList.add('mt-journey-open'); participate(false);
  }
  function closePage(){
    const page=document.getElementById('mtDailyJourneyPage'); if(!page) return;
    page.classList.remove('is-open'); document.body.classList.remove('mt-journey-open');
    setTimeout(()=>{page.hidden=true;window.scrollTo(0,state.openingScrollY);},220);
  }

  function notificationId(item){
    let h=2166136261; const s=`${item.journey_date}:${item.id}`;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return 760000+Math.abs(h%200000);
  }
  async function scheduleTodayNotifications(){
    try{
      if(localStorage.getItem('mt_native_reminders_enabled')!=='1') return;
      const plugin=window.Capacitor?.Plugins?.LocalNotifications; if(!plugin||!state.payload) return;
      const permission=await plugin.checkPermissions(); if(permission?.display!=='granted') return;
      const items=(state.payload.items||[]).filter(i=>i.notification_enabled&&i.notification_time&&i.status!=='draft'&&i.status!=='archived');
      const signature=JSON.stringify(items.map(i=>[i.id,i.notification_time,i.notification_title,i.notification_body]));
      if(state.notificationSignature===signature) return;
      state.notificationSignature=signature;
      const ids=(state.payload.items||[]).map(i=>({id:notificationId(i)}));
      if(ids.length) try{await plugin.cancel({notifications:ids});}catch(_){ }
      const now=new Date();
      const notifications=items.map(item=>{
        const [h,m]=String(item.notification_time).split(':').map(Number); const at=new Date(); at.setHours(h,m,0,0);
        if(at<=now) return null;
        return {id:notificationId(item),title:item.notification_title||state.payload.settings.title,body:item.notification_body||item.short_text||item.title,schedule:{at},extra:{route:'index.html#daily-journey',journey_item_id:item.id,source:'community_journey'}};
      }).filter(Boolean);
      if(notifications.length) await plugin.schedule({notifications});
    }catch(error){ console.warn('Community journey notifications',error); }
  }

  document.addEventListener('click',event=>{
    const toggle=event.target.closest('[data-journey-toggle]');
    if(toggle){event.preventDefault();event.stopPropagation();toggleItem(toggle.dataset.journeyToggle);return;}
    const target=event.target.closest('[data-journey-open-target]');
    if(target){event.preventDefault();event.stopPropagation();openLinked((state.payload?.items||[]).find(i=>String(i.id)===target.dataset.journeyOpenTarget));return;}
    const focus=event.target.closest('[data-journey-focus]'); if(focus){openPage(focus.dataset.journeyFocus);return;}
    if(event.target.closest('[data-journey-open-page]')) openPage();
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible') ensureCurrentDate(currentDate()!==state.date);});
  window.addEventListener('pageshow',()=>ensureCurrentDate(currentDate()!==state.date));

  window.mtOpenDailyJourney=openPage;
  window.mtCloseDailyJourney=closePage;
  window.mtJourneyParticipate=participate;
  window.mtCommunityJourneyReload=()=>ensureCurrentDate(true);

  document.addEventListener('DOMContentLoaded',()=>{
    ensureCurrentDate();
    if(location.hash==='#daily-journey') setTimeout(()=>openPage(),0);
  });
})();
