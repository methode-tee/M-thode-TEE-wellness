/* Méthode Tee — V259 Notre journée ensemble
   Module isolé : rendez-vous administrables, cache local, ouverture instantanée.
   Ne touche ni aux achats, ni aux protocoles, ni aux déblocages. */
(function(){
  'use strict';
  if(window.top !== window.self) return;
  const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  if(file && file!=='index.html') return;

  const CACHE_PREFIX='mt_daily_journey_v259_';
  const COMPLETION_PREFIX='mt_daily_journey_done_v259_';
  const TODAY=()=>new Date().toLocaleDateString('sv-SE');
  const safe=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const short=(s,n=34)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).trim()+'…':s};
  const client=()=>{try{return window.initSupabase&&window.initSupabase()}catch(_){return null}};

  const FALLBACK=[
    {id:'fallback-1',position:1,icon:'hydration',title:'Commence par un grand verre d’eau.',sub:'Le premier geste du jour',time_label:'08:00',target_type:'none',target_id:'',url:''},
    {id:'fallback-2',position:2,icon:'fuel',title:'Ajoute une vraie source de protéines.',sub:'Ton assiette',time_label:'12:00',target_type:'none',target_id:'',url:''},
    {id:'fallback-3',position:3,icon:'leaf',title:'Préparons ensemble notre infusion.',sub:'Un moment botanique',time_label:'18:00',target_type:'none',target_id:'',url:''},
    {id:'fallback-4',position:4,icon:'moon',title:'Faisons le point avant de choisir.',sub:'Rendez-vous du soir',time_label:'21:30',target_type:'none',target_id:'',url:''}
  ];
  const DEFAULT_SETTINGS={id:1,title:'Notre journée ensemble',subtitle:'Les rendez-vous de la communauté au rythme de ta journée.',show_member_count:true,member_minimum:50};

  function cacheKey(){return CACHE_PREFIX+TODAY()}
  function readCache(){try{return JSON.parse(localStorage.getItem(cacheKey())||'null')}catch(_){return null}}
  function writeCache(v){try{localStorage.setItem(cacheKey(),JSON.stringify(v))}catch(_){}}
  function completionKey(uid){return `${COMPLETION_PREFIX}${uid||'guest'}_${TODAY()}`}
  function readDone(uid){try{return JSON.parse(localStorage.getItem(completionKey(uid))||'{}')}catch(_){return {}}}
  function writeDone(uid,v){try{localStorage.setItem(completionKey(uid),JSON.stringify(v))}catch(_){}}
  async function getUser(){try{if(window.mtGetUser)return await mtGetUser();const c=client();if(!c)return null;const {data}=await c.auth.getUser();return data?.user||null}catch(_){return null}}

  function isScheduled(r){
    const now=new Date(), iso=TODAY(), weekday=now.getDay();
    if(r.starts_on && iso<String(r.starts_on)) return false;
    if(r.ends_on && iso>String(r.ends_on)) return false;
    const days=Array.isArray(r.weekdays)?r.weekdays:String(r.weekdays||'').split(',').map(Number).filter(Number.isFinite);
    return !days.length || days.includes(weekday);
  }
  function minutes(time){
    const m=String(time||'').match(/^(\d{1,2}):(\d{2})/); return m?(Number(m[1])*60+Number(m[2])):9999;
  }
  function displayTime(t){return String(t||'').replace(/^0/,'').replace(':','H')}
  function momentLabel(t){
    const h=Math.floor(minutes(t)/60);
    if(h<10)return 'RÉVEIL'; if(h<12)return 'CE MATIN'; if(h<14)return 'DÉJEUNER'; if(h<18)return 'APRÈS-MIDI'; if(h<22)return 'CE SOIR'; return 'NUIT';
  }
  function statusFor(r,done){
    if(done)return {key:'done',label:'✓ Terminé'};
    const now=new Date(), cur=now.getHours()*60+now.getMinutes(), at=minutes(r.time_label);
    if(at===9999)return {key:'todo',label:'À faire'};
    if(cur+45<at)return {key:'future',label:'À venir'};
    if(cur-120>at)return {key:'todo',label:'À faire'};
    return {key:'todo',label:'À faire'};
  }
  function iconHTML(key,cls=''){
    if(window.mtIconHTML){try{return mtIconHTML(key||'seed',cls)}catch(_){}}
    const map={hydration:'💧',fuel:'🥣',movement:'◌',leaf:'🌿',journal:'☾',sparkle:'✦',calendar:'◷',checklist:'✓',recipe:'🥣',lock:'◇',moon:'☾',cloud:'☁'};
    return `<span class="${cls}">${map[key]||'✦'}</span>`;
  }

  async function fetchPayload(force=false){
    const cached=readCache();
    if(cached&&!force)return cached;
    const c=client();
    if(!c){const v={rituals:FALLBACK,settings:DEFAULT_SETTINGS,members:0,at:Date.now()};writeCache(v);return v}
    try{
      const [rr,ss,mm]=await Promise.all([
        c.from('daily_rituals').select('id,position,icon,title,sub,url,target_type,target_id,time_label,starts_on,ends_on,weekdays,active').eq('active',true).order('position',{ascending:true}),
        c.from('daily_journey_settings').select('*').eq('id',1).maybeSingle(),
        c.rpc('daily_journey_member_count',{target_date:TODAY()})
      ]);
      const rituals=(rr.data||[]).filter(isScheduled).slice(0,8);
      const settings={...DEFAULT_SETTINGS,...(ss.data||{})};
      const members=Number(mm.data||0);
      const v={rituals:rituals.length?rituals:FALLBACK,settings,members,at:Date.now()};writeCache(v);return v;
    }catch(e){console.warn('daily journey fallback',e);return cached||{rituals:FALLBACK,settings:DEFAULT_SETTINGS,members:0,at:Date.now()}}
  }

  function memberCopy(count,settings){
    if(settings?.show_member_count===false)return '';
    const min=Math.max(0,Number(settings?.member_minimum||0));
    if(count>=Math.max(50,min))return `<strong>${count} membres</strong><span>avancent avec toi</span>`;
    if(count>=10 && (min===0||count>=min))return `<strong>La communauté</strong><span>avance</span>`;
    if(count>=2 && (min===0||count>=min))return `<strong>Quelques membres</strong><span>avec toi</span>`;
    if(count===1 && (min===0||count>=min))return `<strong>Tu lances</strong><span>le mouvement</span>`;
    return '';
  }

  function progressHTML(done,total){
    const ratio=total?Math.min(100,Math.round(done/total*100)):0;
    return `<div class="mt-journey-progress"><div class="mt-journey-progress-track"><i style="width:${ratio}%"></i></div><small>${done} / ${total} gestes réalisés</small></div>`;
  }

  function ritualCard(r,done,idx,detail=false){
    const st=statusFor(r,done), time=displayTime(r.time_label), label=momentLabel(r.time_label);
    if(detail){
      return `<article class="mt-journey-detail-card ${st.key}" data-ritual-id="${safe(r.id)}">
        <div class="mt-journey-detail-icon">${iconHTML(r.icon,'mt-line-icon')}</div>
        <div class="mt-journey-detail-copy"><div class="mt-journey-time">${safe(time||'—')}</div><h3>${safe(r.title)}</h3><p>${safe(r.sub||'')}</p><button type="button" class="mt-journey-status ${st.key}" onclick="event.stopPropagation();mtToggleJourneyRitual('${safe(r.id)}')">${safe(st.label)}</button></div>
        <button type="button" class="mt-journey-open-target" aria-label="Ouvrir" onclick="event.stopPropagation();mtOpenJourneyTarget('${safe(r.id)}')">›</button>
      </article>`;
    }
    return `<button type="button" class="club-v18-tile mt-journey-tile ${st.key}" data-ritual-id="${safe(r.id)}" onclick="event.stopPropagation();mtOpenDailyJourney('${safe(r.id)}')">
      <b>${iconHTML(r.icon,'ritual-icon')}</b><small class="mt-journey-card-time">${safe(time||label)}</small><strong>${safe(short(r.title,38))}</strong><span class="mt-journey-card-sub">${safe(short(r.sub||label,28))}</span><em class="mt-journey-card-status ${st.key}">${safe(st.label)}</em>
    </button>`;
  }

  let state={payload:null,user:null,done:{}};
  async function hydrate(force=false){
    const panel=document.getElementById('clubV18Panel'); if(!panel)return;
    const cached=readCache();
    if(cached&&!state.payload){state.payload=cached;renderAll()}
    state.user=state.user||await getUser(); state.done=readDone(state.user?.id);
    state.payload=await fetchPayload(force); renderAll();
    if(force) setTimeout(()=>fetchPayload(true).then(v=>{state.payload=v;renderAll()}),100);
  }

  function renderAll(){
    const panel=document.getElementById('clubV18Panel'); if(!panel||!state.payload)return;
    const all=state.payload.rituals||[], visible=all.slice(0,4), doneCount=all.filter(r=>state.done[r.id]).length;
    const members=memberCopy(state.payload.members||0,state.payload.settings||{});
    panel.className='club-v18-panel reveal visible club-v18-connected mt-daily-journey-home';
    panel.dataset.hydrated='1'; panel.setAttribute('role','button'); panel.setAttribute('tabindex','0');
    panel.onclick=e=>{if(!e.target.closest('.club-v18-actions,button'))window.mtOpenDailyJourney()};
    panel.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();window.mtOpenDailyJourney()}};
    panel.innerHTML=`<div class="club-v18-head"><div><div class="club-v18-kicker">Échos du journal</div><h2>${safe(state.payload.settings.title||'Notre journée ensemble')} ✨</h2><p>${safe(state.payload.settings.subtitle||'Les rendez-vous de la communauté au rythme de ta journée.')}</p></div><div class="club-streak-pill">Aujourd’hui</div></div>
      <div class="club-v18-grid">${visible.map((r,i)=>ritualCard(r,!!state.done[r.id],i)).join('')}</div>
      <div class="mt-journey-community ${members?'':'is-counter-hidden'}"><div class="mt-journey-members">${members?`${iconHTML('members','mt-line-icon')}<div>${members}</div>`:''}</div>${progressHTML(doneCount,all.length)}</div>
      <div class="club-v18-actions"><button data-checkin="water" data-label="+ Eau" aria-pressed="false" onclick="event.stopPropagation();mtClubCheckin('water');mtJourneyParticipate()">+ Eau</button><button data-checkin="mood" data-label="Mood calme" aria-pressed="false" onclick="event.stopPropagation();mtClubCheckin('mood','calme');mtJourneyParticipate()">Mood calme</button><button data-checkin="gratitude" data-label="Note gratitude" aria-pressed="false" onclick="event.stopPropagation();const v=prompt('Ta note gratitude ?')||'';if(v){mtClubCheckin('gratitude',v);mtJourneyParticipate()}">Note gratitude</button></div>`;
    renderDetail();
    if(window.mtPaintDailyQuickActions)window.mtPaintDailyQuickActions();
  }

  function renderDetail(focusId){
    const page=document.getElementById('mtDailyJourneyPage');if(!page||!state.payload)return;
    const all=state.payload.rituals||[], doneCount=all.filter(r=>state.done[r.id]).length;
    const members=memberCopy(state.payload.members||0,state.payload.settings||{});
    page.querySelector('[data-mt-journey-title]').textContent=state.payload.settings.title||'Notre journée ensemble';
    page.querySelector('[data-mt-journey-subtitle]').textContent=state.payload.settings.subtitle||'Les rendez-vous de la communauté au rythme de ta journée.';
    page.querySelector('[data-mt-journey-summary]').innerHTML=`<div class="mt-journey-members">${members?`${iconHTML('members','mt-line-icon')}<div>${members}</div>`:''}</div>${progressHTML(doneCount,all.length)}`;
    page.querySelector('[data-mt-journey-list]').innerHTML=all.map((r,i)=>ritualCard(r,!!state.done[r.id],i,true)).join('')||'<div class="empty-card"><h2>Moment libre</h2><p>Aucun rendez-vous prévu.</p></div>';
    if(focusId)setTimeout(()=>page.querySelector(`[data-ritual-id="${CSS.escape(focusId)}"]`)?.scrollIntoView({block:'center'}),50);
  }

  window.mtOpenDailyJourney=function(focusId){
    const page=document.getElementById('mtDailyJourneyPage');if(!page)return;
    renderDetail(focusId); page.hidden=false; requestAnimationFrame(()=>page.classList.add('is-open')); document.body.classList.add('mt-journey-open');
  };
  window.mtCloseDailyJourney=function(){const page=document.getElementById('mtDailyJourneyPage');if(!page)return;page.classList.remove('is-open');document.body.classList.remove('mt-journey-open');setTimeout(()=>{if(!page.classList.contains('is-open'))page.hidden=true},220)};

  window.mtJourneyParticipate=async function(){
    const u=state.user||await getUser(); if(!u)return;
    const c=client();if(!c)return;
    try{await c.from('daily_journey_participation').upsert({user_id:u.id,participation_date:TODAY(),updated_at:new Date().toISOString()},{onConflict:'user_id,participation_date'});}
    catch(e){console.warn('journey participation',e)}
  };
  window.mtToggleJourneyRitual=async function(id){
    const u=state.user||await getUser();state.user=u;const next=!state.done[id];state.done[id]=next?{at:new Date().toISOString()}:false;writeDone(u?.id,state.done);renderAll();if(next)mtJourneyParticipate();
    const c=client();if(!c||!u)return;
    try{if(next)await c.from('daily_journey_completions').upsert({user_id:u.id,ritual_id:id,completion_date:TODAY(),completed_at:new Date().toISOString()},{onConflict:'user_id,ritual_id,completion_date'});else await c.from('daily_journey_completions').delete().eq('user_id',u.id).eq('ritual_id',id).eq('completion_date',TODAY());}catch(e){console.warn('journey completion sync',e)}
  };
  window.mtOpenJourneyTarget=function(id){
    const r=(state.payload?.rituals||[]).find(x=>String(x.id)===String(id));if(!r)return;
    const type=String(r.target_type||'none'), target=String(r.target_id||''), url=String(r.url||'');
    if(type==='recipe'&&target&&window.openRecipeViewer)return openRecipeViewer(target);
    if(type==='protocol'&&target)return location.href=`protocol.html?id=${encodeURIComponent(target)}`;
    if(type==='page'&&target)return location.href=`page.html?slug=${encodeURIComponent(target)}`;
    if(type==='post'&&target){mtCloseDailyJourney();return location.href=`index.html?mt_post=${encodeURIComponent(target)}#${encodeURIComponent(target)}`}
    if((type==='pdf'||type==='audio')&&target)return location.href=`page.html?slug=${encodeURIComponent(target)}`;
    if(url)return location.href=url;
    window.mtToggleJourneyRitual(id);
  };

  document.addEventListener('DOMContentLoaded',()=>{
    hydrate(false);
    document.addEventListener('mt:home-shell-ready',()=>hydrate(false),{once:true});
    setTimeout(()=>hydrate(true),2400);
  });
})();
