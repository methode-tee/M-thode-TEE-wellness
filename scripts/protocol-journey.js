/* =========================================================
   MÉTHODE TEE V19 — Protocol Journey SAFE
   Parcours émotionnel séparé, sans toucher au paiement/déblocage.
   ========================================================= */
(function(){
  'use strict';
  const safe = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const $ = (s,r=document)=>r.querySelector(s);
  const dayLabels=['Di','Lu','Ma','Me','Je','Ve','Sa'];
  const MOODS=['😞','😐','🙂','😊','🤩'];
  const MOOD_VAL={'😞':20,'😐':50,'🙂':70,'😊':85,'🤩':100};
  const INTENTIONS=[
    {plant:'Fenouil', text:'Aujourd’hui, je choisis la douceur plutôt que la force.'},
    {plant:'Mélisse', text:'Je relâche ce qui pèse et je laisse mon corps retrouver son rythme.'},
    {plant:'Gingembre', text:'Mon feu digestif se rallume doucement, sans violence.'},
    {plant:'Camomille', text:'Je crée de l’espace dans mon ventre, dans mon souffle, dans ma journée.'},
    {plant:'Menthe poivrée', text:'La légèreté revient quand je cesse de me brusquer.'},
    {plant:'Romarin', text:'Je soutiens mon terrain avec des gestes simples et réguliers.'},
    {plant:'Verveine', text:'Mon corps entend la constance plus fort que la pression.'}
  ];
  const LEVELS=[
    {min:0,name:'Éveil',tag:'Le parcours commence. Chaque geste compte.',color:'#8C7B6E'},
    {min:20,name:'Ancrage',tag:'Les racines prennent. Ton terrain répond.',color:'#53624A'},
    {min:40,name:'Épanouissement',tag:'Ton corps commence à intégrer le rituel.',color:'#153D39'},
    {min:70,name:'Floraison',tag:'La régularité devient une sensation.',color:'#C9A96E'},
    {min:90,name:'Plénitude',tag:'Tu as honoré ton engagement.',color:'#C9A96E'}
  ];
  const ARC_DEFAULT=[
    {day:1,icon:'🌱',quote:'Le voyage commence.',sub:'Ton corps commence à écouter.',title:'Le premier pas',text:'Chaque transformation naît d’un geste posé avec intention.'},
    {day:3,icon:'💧',quote:'La graine germe.',sub:'Les premiers repères s’installent.',title:'Jour 3 — L’éveil',text:'Ton organisme intègre. Ce que tu ressens maintenant compte.'},
    {day:5,icon:'🌿',quote:'La constance parle.',sub:'Le rituel devient plus naturel.',title:'Jour 5 — L’élan',text:'Tu n’es plus dans l’essai. Tu es dans le mouvement.'},
    {day:-1,icon:'🏆',quote:'Rituel accompli.',sub:'Tu as honoré ton engagement.',title:'Rituel accompli',text:'Tu as tenu. Ton corps s’en souviendra.'}
  ];
  function getParam(name){return new URLSearchParams(location.search).get(name)}
  function todayKey(){return new Date().toISOString().slice(0,10)}
  function level(score){return [...LEVELS].reverse().find(l=>score>=l.min)||LEVELS[0]}
  function score(progress,total){const day=Number(progress?.current_day||1); return Math.max(0,Math.min(100,Math.round(((day-1)/Math.max(1,total))*100)))}
  function durationDays(protocol){return Number(protocol?.total_days || String(protocol?.duration_label||'').match(/\d+/)?.[0] || 7)}
  async function getProgress(protocol){
    const client=initSupabase&&initSupabase(); const user=await mtGetUser(); if(!client||!user||!protocol?.id) return {current_day:1,total_days:durationDays(protocol),streak:0,xp:0,completed_days:[]};
    let {data}=await client.from('protocol_progress').select('*').eq('user_id',user.id).eq('protocol_id',protocol.id).maybeSingle();
    if(!data){
      const total=durationDays(protocol);
      const insert={user_id:user.id,protocol_id:protocol.id,current_day:1,total_days:total,streak:0,completed_days:[],checklist_state:{}};
      const res=await client.from('protocol_progress').insert(insert).select('*').maybeSingle();
      data=res.data || insert;
    }
    return data;
  }
  async function getContents(protocol){
    const client=initSupabase&&initSupabase(); if(!client||!protocol?.id) return [];
    let q=client.from('protocol_contents').select('*').eq('protocol_id',protocol.id).eq('active',true).order('sort_order',{ascending:true});
    const {data,error}=await q;
    return error?[]:(data||[]);
  }
  function meta(type){
    const map={pdf:['📄','PDF'],document:['📄','Document'],video:['🎥','Vidéo'],audio:['🎧','Audio'],recette:['🥣','Recette'],routine:['🌙','Routine'],checklist:['✅','Checklist'],playlist:['🎶','Playlist'],guide_plantes:['🌿','Guide plantes'],tracker:['📊','Suivi'],calendar:['🗓️','Calendrier'],calendrier:['🗓️','Calendrier']};
    return map[String(type||'document').toLowerCase()] || ['✦','Contenu'];
  }
  function moodLogKey(pid){return 'mt_journey_mood_'+pid}
  function loadMood(pid){try{return JSON.parse(localStorage.getItem(moodLogKey(pid))||'{}')}catch(e){return {}}}
  function saveMood(pid,mood){const log=loadMood(pid); log[todayKey()]={mood,ts:new Date().toISOString()}; localStorage.setItem(moodLogKey(pid),JSON.stringify(log)); if(window.mtToast) mtToast('Humeur enregistrée 🌿')}
  function renderMoodBand(pid){
    const log=loadMood(pid); let html='<div class="mood-band">';
    for(let i=-6;i<=0;i++){const d=new Date(); d.setDate(d.getDate()+i); const key=d.toISOString().slice(0,10); const mood=log[key]?.mood; const val=mood?MOOD_VAL[mood]||0:0; html+=`<div class="mood-col"><div class="mood-bar"><div class="mood-fill" style="height:${val}%"></div></div><div>${mood||'·'}</div><div class="mood-label">${dayLabels[d.getDay()]}</div></div>`}
    return html+'</div>';
  }
  function renderVitality(scoreVal){
    const l=level(scoreVal), r=60, circ=2*Math.PI*r, offset=circ-(circ*scoreVal/100);
    return `<div class="vitality-wrap"><div class="vitality-ring"><svg viewBox="0 0 150 150"><circle class="track" cx="75" cy="75" r="60"></circle><circle class="fill" cx="75" cy="75" r="60" stroke="${l.color}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"></circle></svg><div class="vitality-center"><div class="vitality-score">${scoreVal}</div><div class="vitality-label">Vitalité</div></div></div><div class="vitality-name">${l.name}</div><div class="vitality-sub">${l.tag}</div></div>`;
  }
  function renderArc(progress,total){
    const day=Number(progress?.current_day||1); const items=ARC_DEFAULT.map(x=>x.day===-1?{...x,day:total}:x).filter(x=>x.day<=total);
    return `<div class="arc-list">${items.map(m=>{const reached=m.day<=day; const current=m.day===day; return `<div class="arc-item ${reached?'reached':''} ${current?'current':''}"><div class="arc-dot">${reached?'✓':''}</div><div class="arc-day">Jour ${m.day}</div><div class="arc-quote">${m.icon} ${m.quote}</div><div class="arc-sub">${m.sub}</div></div>`}).join('')}</div>`
  }
  function renderContent(c,pid){const [emoji,label]=meta(c.type); const enc=encodeURIComponent(JSON.stringify(c)); return `<article class="journey-content-card" onclick="openPremiumContent('${enc}','${safe(pid)}')"><span class="icon">${emoji}</span><h3>${safe(c.title||label)}</h3><p>${safe(c.description||c.content_text||'')}</p><span class="journey-open">Ouvrir</span></article>`}
  function maybeCelebrate(progress,total){
    const day=Number(progress?.current_day||1); const m=ARC_DEFAULT.map(x=>x.day===-1?{...x,day:total}:x).find(x=>x.day===day); if(!m) return;
    const key='mt_journey_celebration_'+day+'_'+todayKey(); if(localStorage.getItem(key)) return; localStorage.setItem(key,'1');
    setTimeout(()=>{const o=document.createElement('div');o.className='journey-celebration show';o.innerHTML=`<div class="celebration-box"><div class="celebration-icon">${m.icon}</div><div class="celebration-kicker">Milestone débloqué</div><div class="celebration-title">${m.title}</div><div class="celebration-text">${m.text}</div><button class="celebration-close" onclick="this.closest('.journey-celebration').remove()">Continuer</button></div>`;document.body.appendChild(o)},900);
  }
  window.renderProtocolJourney=async function(){
    const root=document.getElementById('journeyRoot'); if(!root) return;
    const user=await mtRequireUser(); if(!user) return;
    const id=getParam('id'); const protocols=await fetchProtocols(); const protocol=protocols.find(p=>p.id===id||p.slug===id);
    if(!protocol){root.innerHTML='<div class="empty-card"><h2>Protocole introuvable</h2></div>';return;}
    const owned=await fetchOwnedIds(); const admin=typeof mtIsAdmin==='function' ? await mtIsAdmin() : false;
    if(!owned.includes(protocol.id)&&!owned.includes(protocol.slug)&&!admin){root.innerHTML=`<div class="empty-card"><h2>Accès verrouillé</h2><p>Ce parcours se débloque automatiquement après paiement.</p><button class="main-cta" onclick="startPaymentLink('${safe(protocol.id||protocol.slug)}')">Débloquer</button></div>`;return;}
    const progress=await getProgress(protocol); const total=durationDays(protocol); const s=score(progress,total); const intention=INTENTIONS[(Number(progress.current_day||1)-1)%INTENTIONS.length]; const contents=await getContents(protocol); const done=Array.isArray(progress.completed_days)?progress.completed_days:[]; const validated=done.includes(todayKey());
    root.innerHTML=`<a class="journey-back" href="protocol.html?id=${safe(protocol.id||protocol.slug)}">← Vue classique</a><section class="journey-hero"><div class="journey-kicker">Parcours immersif</div><h1 class="journey-title">${safe(protocol.title)}<br><em>${safe(protocol.duration_label||'Rituel')}</em></h1><p class="journey-lead">${safe(protocol.long_description||protocol.short_description||'')}</p><div class="journey-progress-wrap"><div class="journey-progress-fill" style="width:${s}%"></div></div><div class="journey-pill-row"><span class="journey-pill">Jour ${Number(progress.current_day||1)} / ${total}</span><span class="journey-pill">${s}% accompli</span><span class="journey-pill">${Number(progress.streak||0)} streak</span></div></section><section class="journey-section">${renderVitality(s)}</section><section class="journey-section"><div class="journey-section-kicker">Intention du jour</div><div class="intention-card"><div class="intention-mark">“</div><div class="intention-text">${safe(intention.text)}</div><span class="intention-plant">🌿 ${safe(intention.plant)}</span></div></section><section class="journey-section"><div class="journey-section-kicker">Élan du protocole</div><div class="journey-stats"><div class="journey-stat"><b>${Number(progress.streak||0)}</b><span>Streak</span></div><div class="journey-stat"><b>${Number(progress.xp||0)}</b><span>XP</span></div><div class="journey-stat"><b>${safe(progress.level_label||protocol.level_label||'Glow')}</b><span>Niveau</span></div></div><button class="validate-journey-btn ${validated?'done':''}" onclick="mtValidateProtocolToday('${safe(protocol.id)}',${total})">${validated?'✓ Journée validée':'🌿 Valider la journée'}</button></section><section class="journey-section"><div class="journey-section-kicker">Journal d’humeur</div><div class="journey-section-title">Comment tu te sens ?</div><div class="mood-picker">${MOODS.map(m=>`<button class="mood-btn" data-mood="${m}">${m}</button>`).join('')}</div><div id="journeyMoodBand">${renderMoodBand(protocol.id)}</div></section><section class="journey-section"><div class="journey-section-kicker">Arc narratif</div><div class="journey-section-title">Tes étapes clés</div>${renderArc(progress,total)}</section><section class="journey-section"><div class="journey-section-kicker">Contenus du jour</div><div class="journey-section-title">Ton espace privé</div><p class="journey-section-sub">PDF, audios, routines, recettes, checklists et fichiers uploadés depuis l’admin.</p><div class="journey-content-grid">${contents.length?contents.map(c=>renderContent(c,protocol.id)).join(''):'<div class="journey-content-card"><span class="icon">🤍</span><h3>Espace prêt</h3><p>Ajoute tes contenus depuis l’admin pour nourrir ce parcours.</p></div>'}</div></section>`;
    document.querySelectorAll('.mood-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');saveMood(protocol.id,btn.dataset.mood);document.getElementById('journeyMoodBand').innerHTML=renderMoodBand(protocol.id)}));
    maybeCelebrate(progress,total); observeReveal && observeReveal();
  };
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>window.renderProtocolJourney&&window.renderProtocolJourney(),350));
})();
