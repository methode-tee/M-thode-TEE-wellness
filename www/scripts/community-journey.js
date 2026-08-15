/* Méthode Tee — Bloc 3 « Notre journée ensemble »
   Remplace uniquement la source du bloc Échos du journal.
   Le gabarit, la hauteur et les quatre tuiles restent ceux du bloc d'origine. */
(function(){
  'use strict';
  window.MT_COMMUNITY_JOURNEY_ACTIVE = true;

  const SLOTS = [
    {key:'wake_up', label:'Réveil', free:'Réveil libre', icon:'sun'},
    {key:'morning', label:'Ce matin', free:'Matin libre', icon:'sparkle'},
    {key:'lunch', label:'Déjeuner', free:'Déjeuner libre', icon:'bowl'},
    {key:'afternoon', label:'Après-midi', free:'Après-midi libre', icon:'cloud'},
    {key:'evening', label:'Ce soir', free:'Soirée libre', icon:'moon'},
    {key:'before_sleep', label:'Nuit', free:'Nuit libre', icon:'moon'}
  ];
  const HOME_FALLBACK = ['morning','lunch','afternoon','evening'];
  let state = {date:'', items:[], completions:new Set(), settings:{}, memberCount:0, user:null, participated:false, readOnly:false};
  const profileSummaryCache = new Map();

  function cachedProfileSummary(targetDate=localDate()){
    const b=monthBounds(targetDate),key=`${targetDate}|${b.start}|${b.end}`;
    const cached=profileSummaryCache.get(key);
    return cached&&typeof cached.then!=='function'?cached:null;
  }
  window.mtCommunityJourneyGetCachedProfileSummary=cachedProfileSummary;

  function esc(v){return String(v == null ? '' : v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function localDate(){const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10);}
  function slot(k){return SLOTS.find(x=>x.key===k)||SLOTS[1];}
  function time(v){return v ? String(v).slice(0,5).replace(':','H') : '';}
  function short(v,n=31){v=String(v||'').trim(); return v.length>n ? v.slice(0,n-1).trim()+'…' : v;}
  function iconHTML(key, cls='journey-icon'){
    if(window.mtIconHTML) return window.mtIconHTML(key, cls);
    const map={sun:'☼',sparkle:'✦',bowl:'◌',cloud:'☁',moon:'☾',leaf:'◇'};
    return `<span class="${cls}">${map[key]||'✦'}</span>`;
  }
  async function client(){ return typeof window.initSupabase==='function' ? window.initSupabase() : window.supabaseClient; }

  function invalidateProfileSummary(){
    profileSummaryCache.clear();
    window.__MT_JOURNEY_PROFILE_SUMMARY__=null;
  }
  window.mtCommunityJourneyInvalidateProfileSummary=invalidateProfileSummary;

  function announceJourneyUpdate(){
    invalidateProfileSummary();
    document.dispatchEvent(new CustomEvent('mt:community-journey-updated',{detail:{date:state.date}}));
  }

  async function fetchPayload(targetDate){
    const sb=await client();
    if(!sb) throw new Error('Supabase indisponible');
    const auth=await sb.auth.getUser();
    const {data,error}=await sb.rpc('community_journey_payload',{target_date:targetDate});
    if(error) throw error;
    return {sb,user:auth?.data?.user||null,payload:data||{}};
  }
  async function load(){
    state.date=localDate(); state.readOnly=false;
    try{
      const loaded=await fetchPayload(state.date), p=loaded.payload;
      state.user=loaded.user;
      state.items=Array.isArray(p.items)?p.items:[];
      state.settings=p.settings||{};
      state.memberCount=Number(p.member_count||0);
      state.completions=new Set((p.completions||[]).filter(x=>x.completed).map(x=>String(x.journey_item_id)));
    }catch(e){
      console.warn('community journey',e);
      state.items=[]; state.completions=new Set();
    }
    renderHome();
  }

  function homeCards(){
    const chosen=state.items.filter(i=>i.show_on_home).slice(0,4);
    const cards=[];
    chosen.forEach(i=>cards.push({item:i,slot:slot(i.slot_key)}));
    const used=new Set(chosen.map(i=>i.slot_key));
    for(const key of HOME_FALLBACK){
      if(cards.length>=4) break;
      if(!used.has(key)) cards.push({item:null,slot:slot(key)});
    }
    while(cards.length<4) cards.push({item:null,slot:SLOTS[cards.length+1]||SLOTS[1]});
    return cards.slice(0,4);
  }

  function memberDisplayText(){
    if(state.settings.show_member_count === false) return 'Ta progression du jour';
    const count=Number(state.memberCount||0);
    const threshold=Math.max(0,Number(state.settings.member_count_threshold ?? 20));
    if(count < threshold) return String(state.settings.low_member_text||'La communauté avance avec toi');
    return String(state.settings.counted_member_text||'{count} membres avancent avec toi').replace('{count}',String(count));
  }


  function validableItems(){
    return state.items.filter(i=>i.validation_enabled!==false);
  }
  function progressData(){
    const items=validableItems();
    const completed=items.filter(i=>state.completions.has(String(i.id))).length;
    const total=items.length;
    return {items,completed,total,pct:total?Math.round(completed/total*100):0};
  }
  function itemState(i){
    if(!i) return {key:'empty',label:'À venir'};
    if(state.completions.has(String(i.id))) return {key:'done',label:'Terminé'};
    if(i.validation_enabled===false) return {key:'discover',label:'À découvrir'};
    const hhmm=String(i.scheduled_time||'').slice(0,5);
    if(hhmm){
      const now=new Date();
      const current=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
      if(hhmm>current) return {key:'upcoming',label:'À venir'};
    }
    return {key:'todo',label:'À faire'};
  }

  function journeyPills(){
    const configured=state.items.filter(i=>i.show_as_pill).slice(0,3);
    if(configured.length){
      return configured.map(i=>`<button type="button" data-journey-pill="${esc(i.id)}">${esc(i.pill_label||short(i.title,18))}</button>`).join('');
    }
    return '<button type="button">+ Eau</button><button type="button">Mood calme</button><button type="button">Note gratitude</button>';
  }

  async function participate(){
    // Une journée sans rendez-vous reste consultable visuellement, mais ne doit
    // jamais compter comme une participation réelle dans les statistiques.
    if(state.participated || !state.user || !state.items.length) return;
    state.participated=true;
    try{
      const sb=await client();
      const {data,error}=await sb.rpc('community_journey_participate',{target_date:state.date,completed_now:false});
      if(error) throw error;
      state.memberCount=Number(data||state.memberCount||0);
      renderHome();
      announceJourneyUpdate();
    }catch(e){
      state.participated=false;
      console.warn('community journey participation',e);
    }
  }

  function tile(card,index){
    const i=card.item, s=card.slot;
    if(!i){
      return `<button class="club-v18-tile is-empty journey-home-tile" type="button" data-journey-card="${index}">
        <b>${iconHTML(s.icon)}</b><span class="journey-home-time">${esc(s.label)}</span><strong>${esc(s.free)}</strong><em>Un moment à inventer</em><small class="journey-home-status is-upcoming">À venir</small>
      </button>`;
    }
    const st=itemState(i);
    return `<button class="club-v18-tile ${st.key==='done'?'is-read':'is-live'} journey-home-tile" type="button" data-journey-card="${index}">
      <b>${iconHTML(i.icon_key||s.icon)}</b><span class="journey-home-time">${esc(time(i.scheduled_time)||s.label)}</span><strong>${esc(short(i.title,28))}</strong><em>${esc(short(i.short_text||'Ce rendez-vous t’accompagne aujourd’hui.',54))}</em><small class="journey-home-status is-${esc(st.key)}">${esc(st.label)}</small>
    </button>`;
  }

  function renderHome(){
    const panel=document.getElementById('clubV18Panel');
    if(!panel) return;
    const cards=homeCards();
    window.MT_JOURNEY_HOME_CARDS=cards;
    panel.hidden=false;
    panel.removeAttribute('aria-hidden');
    panel.className='club-v18-panel reveal visible club-v18-connected mt-stable-slot community-journey-home';
    panel.removeAttribute('aria-busy');
    const prog=progressData();
    const memberText=memberDisplayText();
    panel.innerHTML=`<div class="club-v18-head" data-journey-open-all>
      <div><div class="club-v18-kicker">Les rendez-vous du jour</div><h2>Notre journée ensemble</h2><p>Les rendez-vous de la communauté au rythme de ta journée.</p></div>
      <div class="club-streak-pill">Aujourd’hui</div>
    </div>
    <div class="club-v18-grid">${cards.map(tile).join('')}</div>
    <div class="journey-home-progress" data-journey-open-all>
      <div class="journey-home-members">${esc(memberText)}</div>
      <div class="journey-home-bar"><i style="width:${prog.pct}%"></i></div>
      <b>${prog.completed} / ${prog.total} gestes réalisés</b>
    </div>
    <div class="club-v18-actions" data-journey-open-all>${journeyPills()}</div>`;
    panel.onclick=(ev)=>{
      const pill=ev.target.closest('[data-journey-pill]');
      if(pill){ev.stopPropagation(); const item=state.items.find(x=>String(x.id)===pill.dataset.journeyPill); if(item) openItem(item); return;}
      const btn=ev.target.closest('[data-journey-card]');
      if(btn){ev.stopPropagation(); const card=cards[Number(btn.dataset.journeyCard)]; card?.item ? openItem(card.item) : openAll(); return;}
      openAll();
    };
    panel.dataset.hydrated='1';
  }

  function ensureDrawer(){
    let d=document.getElementById('communityJourneyDrawer');
    if(d) return d;
    d=document.createElement('div');
    d.id='communityJourneyDrawer'; d.className='journey-drawer';
    d.innerHTML='<div class="journey-drawer-backdrop" data-journey-close></div><section class="journey-drawer-sheet" role="dialog" aria-modal="true"><div class="journey-drawer-grip"></div><button class="journey-drawer-close" type="button" aria-label="Fermer" data-journey-close>×</button><div class="journey-drawer-content"></div></section>';
    d.addEventListener('click',e=>{if(e.target.closest('[data-journey-close]')) closeDrawer();});
    document.body.appendChild(d); return d;
  }
  function showDrawer(html,large=false){const d=ensureDrawer(); d.classList.toggle('is-large',large); d.querySelector('.journey-drawer-content').innerHTML=html; requestAnimationFrame(()=>d.classList.add('open')); document.body.classList.add('journey-sheet-open');}
  function closeDrawer(){const d=document.getElementById('communityJourneyDrawer'); if(!d)return; d.classList.remove('open'); document.body.classList.remove('journey-sheet-open');}
  window.mtCloseCommunityJourney=closeDrawer;

  function actionLabel(i,done){return done?(i.completed_label||'Terminé'):(i.validation_label||'Marquer comme fait');}
  function linkedButton(i){if(!i.linked_url&&!i.linked_content_id)return''; return `<button type="button" class="journey-primary" data-journey-link="${esc(i.id)}">Voir le contenu</button>`;}
  function openItem(i){
    participate();
    const s=slot(i.slot_key), done=state.completions.has(String(i.id));
    showDrawer(`<div class="journey-detail-icon">${iconHTML(i.icon_key||s.icon)}</div><div class="journey-sheet-kicker">${esc(time(i.scheduled_time)||s.label)}</div><h2>${esc(i.title)}</h2><p class="journey-detail-text">${esc(i.short_text||'Ce rendez-vous t’accompagne au rythme de ta journée.')}</p><div class="journey-sheet-buttons">${i.validation_enabled!==false&&!state.readOnly?`<button type="button" class="journey-secondary ${done?'is-done':''}" data-journey-toggle="${esc(i.id)}">${esc(actionLabel(i,done))}</button>`:''}${linkedButton(i)}</div>`,false);
    bindDrawerActions();
  }

  function timelineItem(i,s){
    if(!i)return `<article class="journey-line-card is-empty"><div class="journey-line-icon">${iconHTML(s.icon)}</div><div><small>--:--</small><h3>${esc(s.free)}</h3><p>Aucun rendez-vous prévu</p></div></article>`;
    const st=itemState(i);
    return `<article class="journey-line-card" data-journey-item="${esc(i.id)}"><div class="journey-line-icon">${iconHTML(i.icon_key||s.icon)}</div><div><small>${esc(time(i.scheduled_time)||s.label)}</small><h3>${esc(i.title)}</h3><p>${esc(i.short_text||s.label)}</p><span class="journey-status is-${esc(st.key)}">${st.key==='done'?'✓ ':''}${esc(st.label)}</span></div><button type="button" aria-label="Ouvrir">›</button></article>`;
  }
  function sixMomentGauge(bySlot){
    return `<div class="journey-six-gauge">${SLOTS.map((s,index)=>{
      const i=bySlot.get(s.key), st=itemState(i);
      return `<div class="journey-six-step is-${esc(st.key)}"><div class="journey-six-icon">${iconHTML(i?.icon_key||s.icon)}</div><span></span><small>${esc(s.label)}</small></div>`;
    }).join('')}</div>`;
  }

  function openAll(){
    participate();
    const bySlot=new Map(); state.items.forEach(i=>{if(!bySlot.has(i.slot_key))bySlot.set(i.slot_key,i);});
    const prog=progressData();
    showDrawer(`<div class="journey-sheet-kicker">Aujourd’hui</div><h2>${esc(state.settings.title||'Notre journée ensemble')}</h2><p class="journey-sheet-intro">${esc(state.settings.subtitle||'Les rendez-vous de la communauté au rythme de ta journée.')}</p>${sixMomentGauge(bySlot)}<div class="journey-progress"><span>${esc(memberDisplayText())}</span><div><i style="width:${prog.pct}%"></i></div><b>${prog.completed} / ${prog.total} gestes réalisés</b></div><div class="journey-timeline">${SLOTS.map(s=>timelineItem(bySlot.get(s.key),s)).join('')}</div><div class="journey-sheet-pills">${journeyPills()}</div>`,true);
    bindDrawerActions();
  }

  function bindDrawerActions(){
    const d=ensureDrawer();
    d.querySelectorAll('[data-journey-item]').forEach(n=>n.onclick=()=>{const i=state.items.find(x=>String(x.id)===n.dataset.journeyItem); if(i)openItem(i);});
    d.querySelectorAll('[data-journey-toggle]').forEach(n=>n.onclick=()=>toggle(n.dataset.journeyToggle));
    d.querySelectorAll('[data-journey-link]').forEach(n=>n.onclick=()=>openLinked(n.dataset.journeyLink));
    d.querySelectorAll('[data-journey-pill]').forEach(n=>n.onclick=()=>{const i=state.items.find(x=>String(x.id)===n.dataset.journeyPill); if(i)openItem(i);});
  }
  async function toggle(id){
    if(state.readOnly){alert('Cette journée passée est disponible en consultation uniquement.');return;}
    const i=state.items.find(x=>String(x.id)===String(id)); if(!i)return;
    if(!state.user){alert('Connecte-toi pour enregistrer ce geste.');return;}
    const done=state.completions.has(String(id));
    const sb=await client();
    const payload={user_id:state.user.id,journey_item_id:i.id,journey_date:state.date,completed:!done,completed_at:!done?new Date().toISOString():null,updated_at:new Date().toISOString()};
    const {error}=await sb.from('community_journey_completions').upsert(payload,{onConflict:'user_id,journey_item_id,journey_date'});
    if(error){alert(error.message);return;}
    done?state.completions.delete(String(id)):state.completions.add(String(id));
    try{ await sb.rpc('community_journey_participate',{target_date:state.date,completed_now:!done}); }catch(e){}
    const gardenProgress=progressData();
    if(!done&&gardenProgress.total>0&&gardenProgress.completed>=gardenProgress.total&&window.mtGardenAwardDaily)await window.mtGardenAwardDaily('community_journey',state.date);
    if(state.date===localDate()) renderHome();
    announceJourneyUpdate();
    openItem(i);
  }
  function openLinked(id){
    const i=state.items.find(x=>String(x.id)===String(id)); if(!i)return;
    if(i.linked_url){location.href=i.linked_url;return;}
    const t=String(i.linked_content_type||'').toLowerCase(), cid=encodeURIComponent(i.linked_content_id||'');
    const map={recipe:`page.html?type=recipes&id=${cid}`,protocol:`protocol.html?id=${cid}`,post:`index.html#post-${cid}`,page:`page.html?id=${cid}`,pdf:i.linked_content_id,audio:i.linked_content_id,url:i.linked_content_id};
    if(map[t]) location.href=map[t];
  }

  function monthBounds(dateStr){
    const d=new Date(dateStr+'T12:00:00');
    const first=new Date(d.getFullYear(),d.getMonth(),1), last=new Date(d.getFullYear(),d.getMonth()+1,0);
    const iso=x=>{const y=new Date(x);y.setMinutes(y.getMinutes()-y.getTimezoneOffset());return y.toISOString().slice(0,10);};
    return {start:iso(first),end:iso(last)};
  }
  window.mtCommunityJourneyGetProfileSummary=async function(targetDate=localDate(),options={}){
    const b=monthBounds(targetDate);
    const key=`${targetDate}|${b.start}|${b.end}`;
    const force=options===true||options?.force===true;
    if(!force&&profileSummaryCache.has(key))return profileSummaryCache.get(key);
    const request=(async()=>{
      const sb=await client(); if(!sb) return null;
      const auth=await sb.auth.getUser(); if(!auth?.data?.user) return null;
      const {data,error}=await sb.rpc('community_journey_profile_summary',{target_date:targetDate,month_start:b.start,month_end:b.end});
      if(error) throw error;
      return data||null;
    })();
    profileSummaryCache.set(key,request);
    try{
      const summary=await request;
      if(!summary&&profileSummaryCache.get(key)===request)profileSummaryCache.delete(key);
      else if(summary&&profileSummaryCache.get(key)===request)profileSummaryCache.set(key,summary);
      return summary;
    }
    catch(e){if(profileSummaryCache.get(key)===request)profileSummaryCache.delete(key);console.warn('journey profile summary',e);return null;}
  };
  window.mtOpenCommunityJourneyDate=async function(targetDate){
    const previous={...state,items:[...state.items],completions:new Set(state.completions)};
    try{
      const loaded=await fetchPayload(targetDate), p=loaded.payload;
      state.date=targetDate; state.readOnly=targetDate<localDate(); state.user=loaded.user;
      state.items=Array.isArray(p.items)?p.items:[]; state.settings=p.settings||{}; state.memberCount=Number(p.member_count||0);
      state.completions=new Set((p.completions||[]).filter(x=>x.completed).map(x=>String(x.journey_item_id)));
      openAll();
      const d=ensureDrawer();
      d.addEventListener('transitionend',function restore(e){
        if(e.target===d && !d.classList.contains('open')){state=previous;d.removeEventListener('transitionend',restore);}
      });
    }catch(e){console.warn(e);alert('Cette journée ne peut pas être ouverte pour le moment.');}
  };

  document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('clubV18Panel')) load();});
  document.addEventListener('mt:home-shell-ready',()=>load(),{once:true});
})();
