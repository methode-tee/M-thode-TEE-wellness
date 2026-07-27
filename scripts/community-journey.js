/* V295 BLOC 3 — Affichage utilisateur « Notre journée ensemble »
   Module isolé : remplace seulement le panneau Échos du journal sur l'accueil. */
(function(){
  'use strict';

  const SLOT_ORDER=['wake_up','morning','lunch','afternoon','evening','before_sleep'];
  const SLOT_META={
    wake_up:{label:'Réveil',home:'CE MATIN',icon:'sun'},
    morning:{label:'Matin',home:'CE MATIN',icon:'leaf'},
    lunch:{label:'Déjeuner',home:'MAINTENANT',icon:'bowl'},
    afternoon:{label:'Après-midi',home:'CET APRÈS-MIDI',icon:'cup'},
    evening:{label:'Soir',home:'CE SOIR',icon:'moon'},
    before_sleep:{label:'Nuit',home:'CE SOIR',icon:'moon'}
  };
  let state={date:'',items:[],settings:{},member_count:0,completed:new Set(),user:null};

  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function localISO(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
  function timeLabel(v){if(!v)return '—';const s=String(v).slice(0,5);return s.replace(':','H');}
  function iconHTML(slot, cls=''){ const key=SLOT_META[slot]?.icon||'leaf'; return window.mtIconHTML?window.mtIconHTML(key,cls):({'sun':'☀','leaf':'♧','bowl':'◉','cup':'▣','moon':'☾'}[key]||'◇'); }
  function meta(item){return SLOT_META[item?.slot_key]||{label:'Moment',home:'AUJOURD’HUI',icon:'leaf'};}
  function completionMap(payload){return new Set((payload?.completions||[]).filter(x=>x.completed).map(x=>String(x.journey_item_id)));}
  function visibleItems(){return state.items.filter(i=>i.show_on_home).slice(0,4);}
  function completeCount(){return state.items.filter(i=>state.completed.has(String(i.id))).length;}
  function statusFor(item){
    if(state.completed.has(String(item.id))) return {label:item.completed_label||'Terminé',cls:'done'};
    const now=new Date(), t=item.scheduled_time?String(item.scheduled_time).slice(0,5):'';
    if(t){const [h,m]=t.split(':').map(Number);const when=new Date();when.setHours(h,m,0,0);if(when>now)return {label:'À venir',cls:'upcoming'};}
    return {label:item.validation_label||'À faire',cls:'todo'};
  }

  async function currentUser(){
    try{const c=window.initSupabase&&initSupabase();if(!c)return null;const {data}=await c.auth.getUser();return data?.user||null;}catch(e){return null;}
  }
  async function loadPayload(){
    const c=window.initSupabase&&initSupabase(); if(!c) throw new Error('Supabase indisponible');
    const date=localISO();
    const [rpc,user]=await Promise.all([c.rpc('community_journey_payload',{target_date:date}),currentUser()]);
    if(rpc.error) throw rpc.error;
    const p=rpc.data||{};
    state={date,items:Array.isArray(p.items)?p.items:[],settings:p.settings||{},member_count:Number(p.member_count||0),completed:completionMap(p),user};
    return state;
  }

  function renderHome(){
    const panel=document.getElementById('clubV18Panel'); if(!panel)return;
    const items=visibleItems(); const total=state.items.length; const done=completeCount();
    const member=Math.max(Number(state.settings.member_minimum||0),Number(state.member_count||0));
    panel.className='club-v18-panel reveal visible community-journey-home';
    panel.dataset.hydrated='1'; panel.removeAttribute('aria-busy');
    panel.innerHTML=`
      <div class="cj-home-main" role="button" tabindex="0" aria-label="Ouvrir Notre journée ensemble">
        <div class="cj-home-head">
          <div><div class="club-v18-kicker">Échos du journal</div><h2>${esc(state.settings.title||'Notre journée ensemble')} <span aria-hidden="true">✦</span></h2><p>${esc(state.settings.subtitle||'Les rendez-vous de la communauté au rythme de ta journée.')}</p></div>
          <div class="club-streak-pill">Aujourd’hui</div>
        </div>
        <div class="cj-home-grid">
          ${items.length?items.map(item=>{const s=statusFor(item),m=meta(item);return `<button class="cj-home-card" type="button" data-cj-item="${esc(item.id)}">
            <span class="cj-card-top"><i>${iconHTML(item.slot_key,'cj-icon')}</i><span><small>${esc(timeLabel(item.scheduled_time))}</small><b>${esc(m.home)}</b></span></span>
            <strong>${esc(item.short_text||item.title)}</strong><em class="${s.cls}">${esc(s.label)}</em>
          </button>`}).join(''):`<div class="cj-home-empty">${esc(state.settings.empty_message||'La journée se vit plus librement aujourd’hui.')}</div>`}
        </div>
        <div class="cj-home-progress">
          <span>${iconHTML('morning','cj-people')}<b>${member} membres</b><small>avancent avec toi</small></span>
          <span class="cj-progress-side"><i><u style="width:${total?Math.round(done/total*100):0}%"></u></i><small>${done} / ${total||0} gestes réalisés</small></span>
        </div>
        <div class="club-v18-actions">${state.items.filter(i=>i.show_as_pill).slice(0,3).map(i=>`<button type="button" data-cj-item="${esc(i.id)}">${esc(i.pill_label||i.title)}</button>`).join('')||'<button type="button">+ Eau</button><button type="button">Mood calme</button><button type="button">Note gratitude</button>'}</div>
      </div>`;

    panel.querySelector('.cj-home-main')?.addEventListener('click',e=>{if(e.target.closest('[data-cj-item]'))return;openFull();});
    panel.querySelector('.cj-home-main')?.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('[data-cj-item]')){e.preventDefault();openFull();}});
    panel.querySelectorAll('[data-cj-item]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const item=state.items.find(x=>String(x.id)===String(btn.dataset.cjItem));if(item)openItem(item);}));
  }

  function ensureDrawer(){
    let d=document.getElementById('communityJourneyDrawer'); if(d)return d;
    d=document.createElement('div');d.id='communityJourneyDrawer';d.className='community-journey-drawer';d.innerHTML='<div class="cj-backdrop"></div><section class="cj-sheet" role="dialog" aria-modal="true"><div class="cj-grip"></div><button class="cj-close" type="button" aria-label="Fermer">×</button><div class="cj-sheet-scroll"></div></section>';
    document.body.appendChild(d);d.querySelector('.cj-backdrop').onclick=closeDrawer;d.querySelector('.cj-close').onclick=closeDrawer;return d;
  }
  function openDrawer(html,full=false){const d=ensureDrawer();d.classList.toggle('is-full',full);d.querySelector('.cj-sheet-scroll').innerHTML=html;document.body.classList.add('cj-no-scroll');requestAnimationFrame(()=>d.classList.add('open'));}
  function closeDrawer(){const d=document.getElementById('communityJourneyDrawer');if(!d)return;d.classList.remove('open');document.body.classList.remove('cj-no-scroll');}

  function openItem(item){const m=meta(item),s=statusFor(item);openDrawer(`
    <div class="cj-detail-icon">${iconHTML(item.slot_key,'cj-detail-svg')}</div>
    <div class="cj-detail-kicker">${esc(m.label)}</div>
    <h3>${esc(item.title)}</h3>
    <h4>${esc(item.short_text||'Un rendez-vous à vivre à ton rythme.')}</h4>
    ${item.scheduled_time?`<p class="cj-detail-time">${esc(timeLabel(item.scheduled_time))}</p>`:''}
    <div class="cj-detail-actions">
      ${item.validation_enabled?`<button type="button" class="cj-secondary" data-cj-complete="${esc(item.id)}">${s.cls==='done'?'✓ '+esc(item.completed_label||'Terminé'):esc(item.validation_label||'Marquer comme fait')}</button>`:'<button type="button" class="cj-secondary" data-cj-close>Fermer</button>'}
      ${item.linked_url||item.linked_content_id?`<button type="button" class="cj-primary" data-cj-link="${esc(item.id)}">Voir le contenu</button>`:'<button type="button" class="cj-primary" data-cj-full>Voir la journée</button>'}
    </div>`,false);
    bindDrawerActions(item);
  }

  function fullTimeline(){
    return SLOT_ORDER.map(slot=>{const item=state.items.find(i=>i.slot_key===slot);const m=SLOT_META[slot];if(!item)return `<article class="cj-timeline-card is-empty"><i>${iconHTML(slot,'cj-timeline-icon')}</i><div><small>--:--</small><h4>${esc(m.label)}</h4><p>Aucun rendez-vous prévu</p><em>--</em></div></article>`;const s=statusFor(item);return `<article class="cj-timeline-card" data-cj-item="${esc(item.id)}"><i>${iconHTML(slot,'cj-timeline-icon')}</i><div><small>${esc(timeLabel(item.scheduled_time))}</small><h4>${esc(item.title)}</h4><p>${esc(item.short_text)}</p><em class="${s.cls}">${esc(s.label)}</em></div><button type="button" aria-label="Ouvrir">›</button></article>`;}).join('');
  }
  async function openFull(){
    const total=state.items.length,done=completeCount(),member=Math.max(Number(state.settings.member_minimum||0),Number(state.member_count||0));
    openDrawer(`<header class="cj-full-head"><div class="cj-detail-kicker">Aujourd’hui</div><h3>${esc(state.settings.title||'Notre journée ensemble')}</h3><p>${esc(state.settings.subtitle||'Les rendez-vous de la communauté au rythme de ta journée.')}</p></header>
      <div class="cj-slot-rail">${SLOT_ORDER.map(slot=>`<span class="${state.items.some(i=>i.slot_key===slot&&state.completed.has(String(i.id)))?'done':state.items.some(i=>i.slot_key===slot)?'active':''}">${iconHTML(slot,'cj-rail-icon')}<small>${esc(SLOT_META[slot].label)}</small></span>`).join('')}</div>
      <div class="cj-full-progress"><span>${member} membres<br><small>avancent avec toi</small></span><span><i><u style="width:${total?Math.round(done/total*100):0}%"></u></i><b>${done} / ${total} gestes réalisés</b></span></div>
      <div class="cj-timeline">${fullTimeline()}</div>
      <div class="club-v18-actions cj-full-pills">${state.items.filter(i=>i.show_as_pill).slice(0,3).map(i=>`<button type="button" data-cj-item="${esc(i.id)}">${esc(i.pill_label||i.title)}</button>`).join('')}</div>`,true);
    const d=ensureDrawer();d.querySelectorAll('[data-cj-item]').forEach(el=>el.onclick=e=>{e.stopPropagation();const item=state.items.find(x=>String(x.id)===String(el.dataset.cjItem));if(item)openItem(item);});
    try{if(state.user){const {data}=await initSupabase().rpc('community_journey_participate',{target_date:state.date,completed_now:false});if(Number.isFinite(Number(data))){state.member_count=Number(data);renderHome();}}}catch(e){}
  }

  function bindDrawerActions(item){const d=ensureDrawer();d.querySelector('[data-cj-close]')?.addEventListener('click',closeDrawer);d.querySelector('[data-cj-full]')?.addEventListener('click',openFull);d.querySelector('[data-cj-complete]')?.addEventListener('click',()=>toggleComplete(item));d.querySelector('[data-cj-link]')?.addEventListener('click',()=>openLinked(item));}
  async function toggleComplete(item){
    if(!state.user){window.mtToast?mtToast('Connecte-toi pour valider ce rendez-vous.'):alert('Connecte-toi pour valider ce rendez-vous.');return;}
    const c=initSupabase(),isDone=state.completed.has(String(item.id));
    const payload={user_id:state.user.id,journey_item_id:item.id,journey_date:state.date,completed:!isDone,completed_at:!isDone?new Date().toISOString():null,updated_at:new Date().toISOString()};
    const {error}=await c.from('community_journey_completions').upsert(payload,{onConflict:'user_id,journey_item_id,journey_date'});if(error){alert(error.message);return;}
    if(isDone)state.completed.delete(String(item.id));else state.completed.add(String(item.id));renderHome();openItem(item);
  }
  function openLinked(item){
    const url=String(item.linked_url||'').trim();if(url){location.href=url;return;}
    const id=encodeURIComponent(item.linked_content_id||'');const type=String(item.linked_content_type||'').toLowerCase();
    if(type==='recipe'||type==='recette')location.href=`page.html?slug=recipes&id=${id}`;
    else if(type==='protocol'||type==='protocole')location.href=`protocol.html?id=${id}`;
    else if(type==='post'||type==='publication')location.href=`index.html?mt_post=${id}#post-${id}`;
    else if(type==='page')location.href=`page.html?id=${id}`;
    else if(id)location.href=id;
  }

  async function render(){try{await loadPayload();renderHome();return true;}catch(e){console.warn('community journey',e);return false;}}
  window.mtRenderCommunityJourney=render;window.mtOpenCommunityJourney=openFull;window.mtCloseCommunityJourney=closeDrawer;
  document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('clubV18Panel'))render();});
})();
