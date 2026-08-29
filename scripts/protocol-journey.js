/* =========================================================
   MÉTHODE TEE V19 — Protocol Journey SAFE
   Parcours émotionnel séparé, sans toucher au paiement/déblocage.
   Patch V19.2 FIX — milestones dynamiques sans casser le fichier complet.
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

  const ARC_BANK=[
    {day:1,icon:'🌱',quote:'Le voyage commence.',sub:'Ton corps commence à écouter.',title:'Le premier pas',text:'Chaque transformation naît d’un geste posé avec intention.'},
    {day:3,icon:'💧',quote:'La graine germe.',sub:'Les premiers repères s’installent.',title:'Jour 3 — L’éveil',text:'Ton organisme intègre. Ce que tu ressens maintenant compte.'},
    {day:5,icon:'🌿',quote:'La constance parle.',sub:'Le rituel devient plus naturel.',title:'Jour 5 — L’élan',text:'Tu n’es plus dans l’essai. Tu es dans le mouvement.'},
    {day:7,icon:'✨',quote:'Une semaine de présence.',sub:'Le rituel commence à s’ancrer.',title:'Cap de la semaine',text:'Tu as déjà posé une vraie base. Continue avec douceur.'},
    {day:14,icon:'🌙',quote:'Deux semaines de constance.',sub:'Ton terrain apprend la régularité.',title:'Jour 14 — L’ancrage',text:'Ce que tu répètes devient un repère pour ton corps.'},
    {day:21,icon:'🕯️',quote:'Le rituel devient naturel.',sub:'Tu entres dans une discipline douce.',title:'Jour 21 — La transformation',text:'Tu ne suis plus seulement un protocole. Tu incarnes une nouvelle manière de prendre soin de toi.'},
    {day:28,icon:'🏆',quote:'Rituel accompli.',sub:'Tu as honoré ton engagement.',title:'Rituel accompli',text:'Tu as tenu. Ton corps s’en souviendra.'}
  ];

  function getMilestoneDays(total){
    total = Number(total || 7);
    if (total <= 5) return [1,3,total];
    if (total <= 7) return [1,3,5,total];
    if (total <= 14) return [1,3,7,total];
    if (total <= 21) return [1,7,14,total];
    return [1,7,14,21,total];
  }

  function buildArc(total){
    const days = [...new Set(getMilestoneDays(total))];
    return days.map((d, i) => {
      const existing = ARC_BANK.find(x => x.day === d);
      if (existing) return existing;
      if (d === total) return {day:d,icon:'🏆',quote:'Rituel accompli.',sub:'Tu as honoré ton engagement.',title:'Rituel accompli',text:'Tu as tenu. Ton corps s’en souviendra.'};
      return {day:d,icon:['🌱','💧','🌿','✨','🌙'][i] || '🌿',quote:'Une étape clé.',sub:'Ton parcours continue.',title:`Jour ${d}`,text:'Chaque journée validée renforce ton engagement.'};
    });
  }

  function getParam(name){return new URLSearchParams(location.search).get(name)}
  function todayKey(){const now=new Date();const tzOffset=now.getTimezoneOffset()*60000;return new Date(now.getTime()-tzOffset).toISOString().slice(0,10)}
function mtLocalDateKey(date){const d=date instanceof Date?date:new Date(date);const tzOffset=d.getTimezoneOffset()*60000;return new Date(d.getTime()-tzOffset).toISOString().slice(0,10)}
function mtNormalizeCompletedDays(value){if(Array.isArray(value))return value.filter(Boolean).map(String);if(typeof value==='string'){try{const p=JSON.parse(value);if(Array.isArray(p))return p.filter(Boolean).map(String)}catch(_){}return value.split(',').map(s=>s.trim()).filter(Boolean)}return []}
  function level(score){return [...LEVELS].reverse().find(l=>score>=l.min)||LEVELS[0]}
  function score(progress,total){const day=Number(progress?.current_day||1); return Math.max(0,Math.min(100,Math.round(((day-1)/Math.max(1,total))*100)))}
  function durationDays(protocol){
  const fromLabel = String(protocol?.duration_label || protocol?.duration || '').match(/\d+/)?.[0];
  const days = Number(fromLabel || protocol?.total_days || 7);
  return Math.max(1, days);
}

  // Déblocage temporel premium:
  // Jour 1 disponible au début. Jour 2 le lendemain à 7h, puis +1 jour chaque matin à 7h.
  function mtAutoDayFromTime(progress, totalDays){
    const total = Math.max(1, Number(totalDays || progress?.total_days || 1));
    const rawStart = progress?.started_at || progress?.created_at;
    if(!rawStart) return Math.max(1, Math.min(total, Number(progress?.current_day || 1)));

    const start = new Date(rawStart);
    if(isNaN(start.getTime())) return Math.max(1, Math.min(total, Number(progress?.current_day || 1)));

    const now = new Date();

    const firstUnlock = new Date(start);
    firstUnlock.setDate(firstUnlock.getDate() + 1);
    firstUnlock.setHours(7,0,0,0);

    let timeDay = 1;
    if(now >= firstUnlock){
      const diff = now.getTime() - firstUnlock.getTime();
      timeDay = 2 + Math.floor(diff / 86400000);
    }

    const manualDay = Math.max(1, Number(progress?.current_day || 1));
    return Math.max(1, Math.min(total, Math.max(manualDay, timeDay)));
  }

  function mtNextUnlockText(currentDay, totalDays, progress){
    if(Number(currentDay||1) >= Number(totalDays||1)) return '';
    const rawStart = progress?.started_at || progress?.created_at;
    if(!rawStart) return 'Le prochain rituel se débloquera bientôt.';
    const start = new Date(rawStart);
    if(isNaN(start.getTime())) return 'Le prochain rituel se débloquera bientôt.';

    const next = new Date(start);
    next.setDate(next.getDate() + Number(currentDay || 1));
    next.setHours(7,0,0,0);

    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    const sameDate = (a,b)=>a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

    if(sameDate(next, tomorrow)) return `Jour ${Number(currentDay)+1} · se débloque demain à 7h`;
    if(sameDate(next, today)) return `Jour ${Number(currentDay)+1} · se débloque aujourd’hui à 7h`;

    return `Jour ${Number(currentDay)+1} · se débloque le ${next.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})} à 7h`;
  }

  function renderLockedNextDay(currentDay,totalDays,progress){
    if(Number(currentDay||1) >= Number(totalDays||1)) return '';
    return `<article class="journey-content-card locked-day-preview">
      <span class="icon">🔒</span>
      <h3>Prochain rituel</h3>
      <p>${safe(mtNextUnlockText(currentDay,totalDays,progress))}<br>Un nouveau contenu t’attendra sans être dévoilé en avance.</p>
      <span class="journey-open">Bientôt</span>
    </article>`;
  }
  async function getProgress(protocol){
    const client=initSupabase&&initSupabase(); const user=await mtGetUser(); if(!client||!user||!protocol?.id) return {current_day:1,total_days:durationDays(protocol),streak:0,xp:0,completed_days:[]};
    let {data}=await client.from('protocol_progress').select('*').eq('user_id',user.id).eq('protocol_id',protocol.id).order('updated_at',{ascending:false}).limit(1).maybeSingle();
    if(!data){
      const total=durationDays(protocol);
      const nowIso = new Date().toISOString();
      const insert={user_id:user.id,protocol_id:protocol.id,current_day:1,total_days:total,streak:0,completed_days:[],checklist_state:{},started_at:nowIso};
      const res=await client.from('protocol_progress').insert(insert).select('*').maybeSingle();
      data=res.data || insert;
    }

    const total = durationDays(protocol);
    const effectiveDay = mtAutoDayFromTime(data, total);
    if(Number(data.current_day || 1) < effectiveDay && client && user && data.id){
      try{
        await client.from('protocol_progress').update({ current_day: effectiveDay, total_days: total }).eq('id', data.id);
        data.current_day = effectiveDay;
        data.total_days = total;
      }catch(e){}
    } else {
      data.current_day = effectiveDay;
      data.total_days = total;
    }

    return data;
  }
  async function getContents(protocol, progress, admin=false){
    const client=initSupabase&&initSupabase(); if(!client||!protocol?.id) return [];
    let q=client.from('protocol_contents').select('*').eq('protocol_id',protocol.id).eq('active',true).order('sort_order',{ascending:true});
    const {data,error}=await q;
    const rows = error?[]:(data||[]);
    if(admin) return rows;

    const currentDay = Math.max(1, Number(progress?.current_day || 1));
    return rows.filter(c => {
      const d = Number(c.day_number || 0);
      const previewType=String(c.type||'').toLowerCase();
      const canPrepareTomorrow=['recette','guide_plantes'].includes(previewType);
      return !d || d <= currentDay || (d===currentDay+1 && canPrepareTomorrow);
    });
  }
  function meta(type){
    const map={pdf:['📄','PDF'],document:['📄','Document'],video:['🎥','Vidéo'],audio:['🎧','Audio'],recette:['🥣','Recette'],routine:['🌙','Routine'],checklist:['✅','Checklist'],playlist:['🎶','Playlist'],guide_plantes:['🌿','Guide terrain'],photo_progression:['📷','Photo privée'],tracker:['📊','Tracker'],suivi:['📈','Suivi'],tableau:['📋','Tableau'],calendar:['🗓️','Plan du parcours'],calendrier:['🗓️','Plan du parcours']};
    return map[String(type||'document').toLowerCase()] || ['✦','Contenu'];
  }
  function moodLogKey(pid){return 'mt_journey_mood_'+pid}
  function loadMood(pid){try{return JSON.parse(localStorage.getItem(moodLogKey(pid))||'{}')}catch(e){return {}}}
  function saveMood(pid,mood){const log=loadMood(pid); log[todayKey()]={mood,ts:new Date().toISOString()}; localStorage.setItem(moodLogKey(pid),JSON.stringify(log)); if(window.mtToast) mtToast('Humeur enregistrée 🌿')}
  function renderMoodBand(pid){
    const log=loadMood(pid); let html='<div class="mood-band">';
    for(let i=-6;i<=0;i++){const d=new Date(); d.setDate(d.getDate()+i); const key=mtLocalDateKey(d); const mood=log[key]?.mood; const val=mood?MOOD_VAL[mood]||0:0; html+=`<div class="mood-col"><div class="mood-bar"><div class="mood-fill" style="height:${val}%"></div></div><div>${mood||'·'}</div><div class="mood-label">${dayLabels[d.getDay()]}</div></div>`}
    return html+'</div>';
  }
  function renderVitality(scoreVal){
    const l=level(scoreVal), r=60, circ=2*Math.PI*r, offset=circ-(circ*scoreVal/100);
    return `<div class="vitality-wrap"><div class="vitality-ring"><svg viewBox="0 0 150 150"><circle class="track" cx="75" cy="75" r="60"></circle><circle class="fill" cx="75" cy="75" r="60" stroke="${l.color}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"></circle></svg><div class="vitality-center"><div class="vitality-score">${scoreVal}</div><div class="vitality-label">Vitalité</div></div></div><div class="vitality-name">${l.name}</div><div class="vitality-sub">${l.tag}</div></div>`;
  }
  function renderArc(progress,total){
    const day=Number(progress?.current_day||1);
    const items=buildArc(total);
    return `<div class="arc-list">${items.map(m=>{const reached=m.day<=day; const current=m.day===day; return `<div class="arc-item ${reached?'reached':''} ${current?'current':''}"><div class="arc-dot">${reached?'✓':''}</div><div class="arc-day">Jour ${m.day}</div><div class="arc-quote">${m.icon} ${m.quote}</div><div class="arc-sub">${m.sub}</div></div>`}).join('')}</div>`
  }
  function renderContent(c,pid){
    const [emoji,label]=meta(c.type);
    const enc=encodeURIComponent(JSON.stringify(c)).replace(/'/g,"%27");
    const desc = safe(c.description||c.content_text||'');
    return `<article class="journey-content-card" onclick="openPremiumContent('${enc}','${safe(pid)}')">
      <div class="jcc-type-tag">${emoji} <span>${label}</span></div>
      <h3 class="jcc-title">${safe(c.title||label)}</h3>
      ${desc ? `<p class="jcc-desc">${desc}</p>` : ''}
      <div class="jcc-footer">
        <button class="jcc-open-btn" tabindex="-1">OUVRIR →</button>
      </div>
    </article>`;
  }

  function mtTomorrowPreparationText(c){
    const type=String(c?.type||'').toLowerCase();
    const raw=String(c?.content_text||c?.description||'').replace(/\r/g,'').trim();
    if(type==='guide_plantes'){
      const plant=String(c?.title||'Guide terrain').trim();
      return `À prévoir : ${plant}. Le guide complet et ses précautions seront accessibles demain à 7h.`;
    }
    if(type==='recette'){
      const lines=raw.split('\n').map(x=>x.trim()).filter(Boolean);
      const start=lines.findIndex(x=>/^(\[?ingr[eé]dients?\]?|pour la recette|il te faut)/i.test(x));
      let picked=[];
      if(start>=0){
        for(let i=start+1;i<lines.length&&picked.length<8;i++){
          if(/^(\[?(pr[eé]paration|instructions?|[eé]tapes?|m[eé]thode|cuisson)\]?)/i.test(lines[i]))break;
          picked.push(lines[i]);
        }
      }
      if(!picked.length&&c?.description)picked=[String(c.description).trim()];
      const extract=picked.join(' · ').slice(0,420);
      return extract?`À préparer : ${extract}`:'Prépare les ingrédients habituels de cette recette. Les quantités et les étapes seront accessibles demain à 7h.';
    }
    return '';
  }

  function renderTomorrowPreparation(items){
    const preparable=(items||[]).filter(c=>['recette','guide_plantes'].includes(String(c?.type||'').toLowerCase()));
    if(!preparable.length)return '';
    return `<div class="jac-tomorrow-preview"><small>Aperçu préparation · demain</small>${preparable.map(c=>{const [emoji,label]=meta(c.type);return `<article><b>${emoji} ${safe(c.title||label)}</b><p>${safe(mtTomorrowPreparationText(c))}</p></article>`}).join('')}<em>Le contenu complet reste verrouillé jusqu’à 7h.</em></div>`;
  }

  // Textes par défaut jour par jour (jamais de 🏆 ici — réservé à la clôture)
  const DAY_INTROS = {
    1:  {icon:'🌱', label:'Premier rituel',          sub:'Le commencement. Tout naît d\'un geste posé avec intention.'},
    2:  {icon:'💧', label:'Deuxième rituel',          sub:'La graine germe. Ton corps commence à écouter.'},
    3:  {icon:'🌿', label:'Troisième rituel',         sub:'Les premiers repères s\'installent. Ton terrain répond.'},
    4:  {icon:'✨', label:'Quatrième rituel',          sub:'Tu n\'es plus dans l\'essai. Tu es dans le mouvement.'},
    5:  {icon:'🔥', label:'Cinquième rituel',          sub:'La constance parle plus fort que l\'intensité.'},
    6:  {icon:'🌙', label:'Sixième rituel',            sub:'La discipline devient une douceur que tu choisis.'},
    7:  {icon:'🕯️', label:'Septième rituel',          sub:'Une semaine de présence. Ton élan est réel.'},
    8:  {icon:'🌊', label:'Huitième rituel',           sub:'Le rythme est là. Laisse-le te porter.'},
    9:  {icon:'🌸', label:'Neuvième rituel',           sub:'Ce que tu répètes devient un repère pour ton organisme.'},
    10: {icon:'💎', label:'Dixième rituel',            sub:'Dix jours de constance. Une fondation que ton corps intègre.'},
    11: {icon:'🌺', label:'Onzième rituel',            sub:'Ton terrain apprend la régularité sans effort.'},
    12: {icon:'🕊️', label:'Douzième rituel',          sub:'La légèreté revient quand le rituel devient naturel.'},
    13: {icon:'🌟', label:'Treizième rituel',          sub:'Tu approches d\'un cap important. Continue doucement.'},
    14: {icon:'🌙', label:'Quatorzième rituel',        sub:'Quatorze jours. Le rituel s\'inscrit profondément.'},
    15: {icon:'🌿', label:'Quinzième rituel',          sub:'La deuxième quinzaine commence. Tu connais le chemin.'},
    16: {icon:'💫', label:'Seizième rituel',           sub:'Ce n\'est plus un effort. C\'est une manière d\'être.'},
    17: {icon:'🔮', label:'Dix-septième rituel',       sub:'Ton organisme intègre en profondeur. Fais confiance.'},
    18: {icon:'🌱', label:'Dix-huitième rituel',       sub:'Une nouvelle couche de transformation s\'installe.'},
    19: {icon:'✦',  label:'Dix-neuvième rituel',       sub:'La régularité devient une sensation, pas une règle.'},
    20: {icon:'🌊', label:'Vingtième rituel',          sub:'Vingt jours. Tu incarnes une nouvelle manière de prendre soin de toi.'},
    21: {icon:'🕯️', label:'Vingt et unième rituel',   sub:'Le rituel est ancré. La transformation est en marche.'},
    22: {icon:'🌸', label:'Vingt-deuxième rituel',     sub:'Tu vas au-delà de l\'habitude. Tu vis le rituel.'},
    23: {icon:'💎', label:'Vingt-troisième rituel',    sub:'Chaque jour supplémentaire est un cadeau à ton terrain.'},
    24: {icon:'🌟', label:'Vingt-quatrième rituel',    sub:'La constance de cette semaine est ta plus belle réussite.'},
    25: {icon:'🔥', label:'Vingt-cinquième rituel',    sub:'La ligne d\'arrivée approche. Ton élan est intact.'},
    26: {icon:'🌺', label:'Vingt-sixième rituel',      sub:'Deux jours restants. Tu as tenu ta promesse.'},
    27: {icon:'🕊️', label:'Avant-dernier rituel',     sub:'Demain, tu auras accompli quelque chose de rare.'},
    28: {icon:'✦',  label:'Vingt-huitième rituel',    sub:'Le dernier pas avant la ligne d\'arrivée.'},
  };

  // Textes de clôture spécifiques selon la durée totale du protocole
  const DAY_CLOSING = {
    5:  {icon:'🏆', label:'Cinq jours accomplis',        sub:'Tu as tenu cinq jours. C\'est un engagement réel, et ton corps l\'a senti.'},
    7:  {icon:'🏆', label:'Cap de la première semaine',  sub:'Sept jours de présence. Le rituel commence à t\'appartenir.'},
    10: {icon:'🏆', label:'Dix jours accomplis',         sub:'Dix jours de constance. Tu as posé une fondation que ton corps ne va pas oublier.'},
    14: {icon:'🏆', label:'Deux semaines d\'ancrage',   sub:'Quatorze jours. Ce que tu as répété est maintenant inscrit dans ton terrain.'},
    21: {icon:'🏆', label:'Cap des trois semaines',      sub:'Vingt et un jours. Le rituel est ancré. La transformation est réelle.'},
    28: {icon:'🏆', label:'Rituel accompli',             sub:'Vingt-huit jours de présence totale. Ton corps s\'en souviendra toujours.'},
  };

  function getDayIntro(dayNum, totalDays) {
    const d = Number(dayNum || 1);
    const t = Number(totalDays || 0);
    // Si c'est le dernier jour du protocole → texte de clôture
    if (t > 0 && d === t) {
      // Clôture spécifique si elle existe, sinon clôture générique
      if (DAY_CLOSING[t]) return DAY_CLOSING[t];
      return {icon:'🏆', label:'Rituel accompli', sub:'Tu as tenu jusqu\'au bout. Ton corps s\'en souviendra.'};
    }
    // Sinon texte standard du jour
    if (DAY_INTROS[d]) return DAY_INTROS[d];
    // Fallback au-delà de 28
    return {icon:'✦', label:`Jour ${d}`, sub:'Chaque journée validée renforce ce que tu construis.'};
  }

  function renderContentsByDay(contents, currentDay, pid, progress, total, isAdmin) {
    const cur = Number(currentDay || 1);

    // Build groups from unlocked contents
    const groups = {};
    contents.forEach(c => {
      const d = Number(c.day_number || 1);
      if (!groups[d]) groups[d] = [];
      groups[d].push(c);
    });

    // Add all future locked days up to total
    for (let d = cur + 1; d <= total; d++) {
      if (!groups[d]) groups[d] = null;
    }

    // ADMIN PREVIEW : toutes les journées visibles, aucune verrouillée
    const adminMode = isAdmin === true;

    const sortedDays = Object.keys(groups).map(Number).sort((a,b) => a - b);
    const uid = 'acc_' + Math.random().toString(36).slice(2,7);

    if (!sortedDays.length) {
      return `<div class="jac-empty"><span>🤍</span><p>Ajoute tes contenus depuis l'admin pour nourrir ce parcours.</p></div>`;
    }

    let html = `<div class="jac-accordion" id="${uid}">`;

    sortedDays.forEach(d => {
      const intro     = getDayIntro(d, total);
      const isToday   = d === cur;
      const isLocked  = adminMode ? false : d > cur;
      const isNext    = d === cur + 1;
      const isLast    = d === total;
      const items     = groups[d];
      const itemCount = items ? items.length : 0;
      const rowId     = 'journey-day-' + d;

      const rowClass = [
        'jac-row',
        isToday ? 'jac-row--today'  : '',
        isNext  ? 'jac-row--next'   : '',
        isLocked && !isNext ? 'jac-row--soon' : '',
        isLocked ? 'jac-row--locked' : '',
        isLast  ? 'jac-row--last'   : '',
      ].filter(Boolean).join(' ');

      const diamond = isLocked ? '◇' : (isToday ? '◆' : '◈');

      const badge = isToday
        ? `<span class="jac-badge jac-badge--today">Aujourd'hui</span>`
        : (adminMode && d > cur)
          ? `<span class="jac-badge jac-badge--admin">👁 Admin</span>`
          : (!isLocked && itemCount > 0)
            ? `<span class="jac-badge">${itemCount} contenu${itemCount > 1 ? 's' : ''}</span>`
            : '';

      const chevron = isLocked ? '' : `<span class="jac-chevron" aria-hidden="true"></span>`;

      const headerTag   = isLocked ? 'div' : 'button';
      const headerClick = isLocked ? '' : `onclick="mtToggleAccordion('${rowId}')"`;
      const headerAttr  = isLocked ? '' : `aria-expanded="${isToday ? 'true' : 'false'}" aria-controls="${rowId}_body"`;

      // Labels selon état
      const dayNum  = isNext
        ? `Prochain rituel · Jour ${d}`
        : isLocked
          ? `Jour ${d}`
          : `Jour ${d}`;

      const dayName = isLocked && !isNext
        ? 'Bientôt disponible'
        : intro.label;

      // Hint sous le nom (jours verrouillés uniquement)
      const hint = isNext
        ? `<span class="jac-locked-hint">${safe(typeof mtNextUnlockText === 'function' ? mtNextUnlockText(cur, total, progress) : 'Se déverrouille bientôt à 7h')}</span>`
        : isLocked
          ? `<span class="jac-locked-hint jac-locked-hint--soon">Un nouveau contenu t'attendra sans être dévoilé en avance.</span>`
          : '';

      html += `
      <div class="${rowClass}" id="${rowId}">
        <${headerTag} class="jac-header" ${headerClick} ${headerAttr}>
          <span class="jac-diamond">${diamond}</span>
          <span class="jac-day-label">
            <span class="jac-day-num">${dayNum}</span>
            <span class="jac-day-name">${dayName}</span>
            ${hint}
          </span>
          ${badge}
          ${chevron}
        </${headerTag}>`;

      if (!isLocked) {
        const open = isToday ? ' jac-body--open' : '';
        html += `
        <div class="jac-body${open}" id="${rowId}_body">
          <div class="jac-body-inner">
            <p class="jac-day-sub">${intro.sub}</p>
            ${itemCount > 0
              ? `<div class="jac-content-list">${items.map(c => renderContent(c, pid)).join('')}</div>`
              : `<div class="jac-empty-day"><span>🤍</span><span>Aucun contenu pour ce jour.</span></div>`
            }
          </div>
        </div>`;
      } else if(isNext && itemCount>0) {
        html += renderTomorrowPreparation(items);
      }

      html += `\n      </div>`;
    });

    html += `\n    </div>`;
    return html;
  }
  window.mtToggleAccordion = function(rowId) {
    const row  = document.getElementById(rowId);
    if (!row || row.classList.contains('jac-row--locked')) return;
    const body = document.getElementById(rowId + '_body');
    const btn  = row.querySelector('.jac-header');
    if (!body) return;
    const isOpen = body.classList.contains('jac-body--open');
    body.classList.toggle('jac-body--open', !isOpen);
    if (btn) btn.setAttribute('aria-expanded', String(!isOpen));
  };


  function mtProtocolTargetDayFromUrl() {
    const params = new URLSearchParams(location.search || '');
    const fromParam = Number(params.get('day') || 0);
    if (fromParam > 0) return fromParam;
    const hash = String(location.hash || '').replace('#', '');
    const match = hash.match(/(?:journey-day-|day-|jour-)(\d+)/i);
    return match ? Number(match[1]) : 0;
  }

  function mtOpenProtocolDayFromNotification() {
    const targetDay = mtProtocolTargetDayFromUrl();
    if (!targetDay) return;

    setTimeout(() => {
      const row = document.getElementById('journey-day-' + targetDay);
      if (!row) return;

      if (!row.classList.contains('jac-row--locked')) {
        const body = document.getElementById('journey-day-' + targetDay + '_body');
        const btn = row.querySelector('.jac-header');
        if (body) body.classList.add('jac-body--open');
        if (btn) btn.setAttribute('aria-expanded', 'true');
      }

      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('mt-push-highlight');
      setTimeout(() => row.classList.remove('mt-push-highlight'), 2200);
    }, 450);
  }
  function maybeCelebrate(progress,total){
    const day=Number(progress?.current_day||1);
    const m=buildArc(total).find(x=>x.day===day);
    if(!m) return;
    const key='mt_journey_celebration_'+day+'_'+todayKey(); if(localStorage.getItem(key)) return; localStorage.setItem(key,'1');
    setTimeout(()=>{const o=document.createElement('div');o.className='journey-celebration show';o.innerHTML=`<div class="celebration-box"><div class="celebration-icon">${m.icon}</div><div class="celebration-kicker">Milestone débloqué</div><div class="celebration-title">${m.title}</div><div class="celebration-text">${m.text}</div><button class="celebration-close" onclick="this.closest('.journey-celebration').remove()">Continuer</button></div>`;document.body.appendChild(o)},900);
  }
  
// ===== IMMERSIVE NOTIFICATIONS SAFE =====
function notificationMessage(day,total,validated,streak){
  if(!validated && day===1) return "🌿 Le voyage commence aujourd’hui.";
  if(!validated && day>1) return "🌙 Ton rituel du jour t’attend.";
  if(streak>=3) return "✨ La régularité devient une sensation.";
  if(day===total) return "🏆 Tu approches du rituel accompli.";
  return "🌿 Continue doucement, ton terrain répond.";
}
function renderImmersiveNotification(progress,total){
  const day=Number(progress?.current_day||1);
  const streak=Number(progress?.streak||0);
  const done=mtNormalizeCompletedDays(progress.completed_days);
  const validated=done.includes(todayKey());
  return `<section class="journey-section">
    <div class="journey-section-kicker">Petite note</div>
    <div class="journey-notification-card ${validated?'validated':''}">
      <div class="journey-notification-icon">${validated?'✨':'🌿'}</div>
      <div class="journey-notification-content">
        <div class="journey-notification-title">${validated?'Journée validée':'Rappel du jour'}</div>
        <div class="journey-notification-text">${notificationMessage(day,total,validated,streak)}</div>
        <button class="journey-push-btn" type="button" onclick="window.mtEnablePushNotifications ? window.mtEnablePushNotifications() : alert('Module notifications non chargé')">
          Activer les notifications
        </button>
      </div>
    </div>
  </section>`;
}
function mtJourneyIsFreeProtocol(protocol){return !!protocol && String(protocol.slug||'')==='premiers-pas-la-methode-tee';}

function mtProtocolNorm(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function mtProtocolNum(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function mtProtocolAverage(values){const v=values.map(mtProtocolNum).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;}
function mtProtocolDuration(values={}){const direct=mtProtocolNum(values._sleep_hours);if(direct!==null)return direct;if(!values.bedtime||!values.wake_time)return null;const [bh,bm]=String(values.bedtime).split(':').map(Number),[wh,wm]=String(values.wake_time).split(':').map(Number);if(![bh,bm,wh,wm].every(Number.isFinite))return null;let mins=(wh*60+wm)-(bh*60+bm);if(mins<=0)mins+=1440;return Math.round(mins/6)/10;}
function mtProtocolFastHours(values={}){const direct=mtProtocolNum(values._fast_hours);if(direct!==null)return direct;if(!values.last_meal||!values.first_meal)return null;const [lh,lm]=String(values.last_meal).split(':').map(Number),[fh,fm]=String(values.first_meal).split(':').map(Number);if(![lh,lm,fh,fm].every(Number.isFinite))return null;let mins=(fh*60+fm)-(lh*60+lm);if(mins<=0)mins+=1440;return Math.round(mins/6)/10;}
function mtProtocolFormat(value,unit='',digits=1){if(!Number.isFinite(Number(value)))return '—';const n=Number(value),rendered=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:digits}).format(n);return `${rendered}${unit?` ${unit}`:''}`;}
function mtProtocolLens(protocol){
  const text=mtProtocolNorm(`${protocol?.title||''} ${protocol?.slug||''}`);
  if(/sommeil|insomnie|nuit/.test(text))return {kind:'sleep',keys:['sommeil_profond'],title:'Tes nuits pendant ce protocole',subtitle:'Durée et ressentis restent séparés ; Apple Santé complète seulement les mesures qu’elle possède.',health:'sleep'};
  if(/reflux|aigreur|estomac/.test(text))return {kind:'reflux',keys:['reflux'],title:'Tes repères de reflux',subtitle:'Fréquence, intensité et contexte sont décrits sans attribuer automatiquement une cause.',health:null};
  if(/ventre|digest|ballonn|transit/.test(text))return {kind:'digestion',keys:['digestion'],title:'Ton confort digestif',subtitle:'Les balises suivent uniquement les journées réellement renseignées.',health:null};
  if(/sucre/.test(text))return {kind:'sugar',keys:['reduction_sucre'],title:'Ton rapport au sucre',subtitle:'Envies, alternatives et journées documentées, sans logique de réussite ou d’échec.',health:null};
  if(/jeune|intermittent/.test(text))return {kind:'fast',keys:['jeune_intermit'],title:'Ton rythme de jeûne',subtitle:'La durée n’est jamais transformée en note ; le confort reste prioritaire.',health:null};
  if(/perimenopause|menopause/.test(text))return {kind:'perimenopause',keys:['perimenopause'],title:'Tes repères de transition hormonale',subtitle:'Une lecture descriptive des symptômes et ressentis réellement présents.',health:null};
  if(/cycle|hormon|menstru|regles|periode menstruelle/.test(text))return {kind:'cycle',keys:['cycle'],title:'Tes repères de cycle',subtitle:'Énergie, sommeil et symptômes sont observés sans jauge « bonne / mauvaise ».',health:null};
  if(/peau|acne|imperfection/.test(text))return {kind:'skin',keys:['peau'],title:'Ta peau pendant le protocole',subtitle:'Confort, sensibilité et contexte sont comparés sans diagnostic.',health:null};
  if(/fer|anemie|vegetal|micronutr|nutrition/.test(text))return {kind:'nutrition',keys:['nutrition_vegetale'],title:'Tes apports documentés',subtitle:'Uniquement les aliments quantifiés et nutriments réellement disponibles dans le Carnet.',health:null};
  if(/silhouette|poids|ventre plat/.test(text))return {kind:'body',keys:['evolution_corporelle'],title:'Tes repères corporels',subtitle:'Plages et ressentis neutres : aucun poids ni mensuration n’est transformé en score.',health:'body'};
  if(/crampe|recuper|muscl|recomposition|pilates|sport|masse saine|endurance|mouvement|marche|pas/.test(text))return {kind:'activity',keys:['performance_recuperation','pas_marche'],title:'Mouvement & récupération',subtitle:'Le suivi combine ressenti personnel et données Apple Santé quand elles sont disponibles.',health:'activity'};
  if(/stress|cortisol|anxiete|apais/.test(text))return {kind:'stress',keys:['sommeil_profond'],title:'Présence & apaisement',subtitle:'Ici, la jauge mesure la présence des repères, pas ton niveau de « réussite ».',health:'sleep'};
  return {kind:'generic',keys:[],title:'Ton empreinte dans le protocole',subtitle:'Une lecture du parcours lui-même, distincte des jauges générales du Carnet.',health:null};
}
function mtProtocolMetric(label,value,detail,count,source='Méthode Tee'){return {label,value:value||'—',detail:detail||'Pas encore documenté.',count:Number(count)||0,source};}
function mtProtocolNumeric(rows,label,get,unit='',mode='average',source='Suivi Méthode Tee'){
  const series=(rows||[]).map(row=>({date:row.entry_date,value:get(row.values||{})})).filter(x=>Number.isFinite(Number(x.value))),vals=series.map(x=>Number(x.value));if(!vals.length)return mtProtocolMetric(label,'—','Pas encore documenté.',0,source);
  const digits=['pas','min','kcal'].includes(unit)?0:1,min=Math.min(...vals),max=Math.max(...vals),avg=mtProtocolAverage(vals),value=mode==='range'?(min===max?mtProtocolFormat(min,unit,digits):`${mtProtocolFormat(min,unit,digits)} – ${mtProtocolFormat(max,unit,digits)}`):mtProtocolFormat(avg,unit,digits),detail=mode==='range'?`Plage sur ${vals.length} journée${vals.length>1?'s':''} renseignée${vals.length>1?'s':''}.`:`Moyenne sur ${vals.length} journée${vals.length>1?'s':''} renseignée${vals.length>1?'s':''}.`;
  return mtProtocolMetric(label,value,detail,new Set(series.map(x=>x.date)).size,source);
}
function mtProtocolCount(rows,label,predicate,detail,source='Suivi Méthode Tee'){const days=new Set((rows||[]).filter(row=>predicate(row.values||{})).map(row=>row.entry_date));return mtProtocolMetric(label,String(days.size),detail||`${days.size} journée${days.size>1?'s':''} concernée${days.size>1?'s':''}.`,days.size,source);}
function mtProtocolMoodCount(protocol,start,end){const log=loadMood(protocol.id)||{};return Object.keys(log).filter(date=>date>=start&&date<=end).length;}
async function mtLoadProtocolModel(user,protocol,progress,total){
  const lens=mtProtocolLens(protocol),start=mtProtocolStartDate(progress),end=mtAddProtocolDays(start,total-1),client=initSupabase&&initSupabase();let rows=[];
  if(client&&user&&lens.keys.length){try{const {data}=await client.from('user_tracker_entries').select('tracker_key,entry_date,values').eq('user_id',user.id).in('tracker_key',lens.keys).gte('entry_date',start).lte('entry_date',end).order('entry_date',{ascending:true}).limit(Math.min(180,total*lens.keys.length+24));rows=Array.isArray(data)?data:[];}catch(_){rows=[];}}
  const sources=new Set(rows.length?['Suivi Méthode Tee']:[]),healthDays=[];
  if(lens.health==='activity'&&window.mtHealthKitReadActivityHistory){try{const hk=await window.mtHealthKitReadActivityHistory(start,(end<todayKey()?end:todayKey()),false);(hk?.days||[]).forEach(day=>{if(!day?.date||!day.hasData)return;healthDays.push(day);rows.push({tracker_key:'pas_marche',entry_date:day.date,values:{steps:day.steps,distance_km:day.distanceKm,walking_minutes:day.walkingMinutes,step_length_cm:day.stepLengthCm,walking_speed_kmh:day.walkingSpeedKmh,active_energy_kcal:day.activeEnergyKcal,_healthkit_source:'Apple Santé'}});});if(healthDays.length)sources.add('Apple Santé');}catch(_){}}
  if((lens.health==='sleep'||lens.health==='body')&&window.mtHealthKitReadSummary&&todayKey()>=start&&todayKey()<=end){try{const hk=await window.mtHealthKitReadSummary(todayKey(),{categories:[lens.health]});if(lens.health==='sleep'&&hk?.sleep?.hasData){const x=hk.sleep;rows.push({tracker_key:'sommeil_profond',entry_date:todayKey(),values:{_sleep_hours:mtProtocolNum(x.durationMinutes)!==null?Number(x.durationMinutes)/60:null,_healthkit_sleep_deep_minutes:x.deepMinutes,_healthkit_sleep_rem_minutes:x.remMinutes,awakenings:x.awakenings,_healthkit_source:'Apple Santé'}});sources.add('Apple Santé');}if(lens.health==='body'&&hk?.body){const b=hk.body,v={_healthkit_source:'Apple Santé'},sameDay=item=>{if(!item?.date)return false;const d=new Date(item.date);return !Number.isNaN(d.getTime())&&d.toLocaleDateString('sv-SE')===todayKey();};if(sameDay(b.weightKg))v.weight=b.weightKg.value;if(sameDay(b.waistCm))v.waist=b.waistCm.value;if(sameDay(b.bodyFatPercentage))v.body_fat=b.bodyFatPercentage.value;if(sameDay(b.leanBodyMassKg))v.lean_body_mass=b.leanBodyMassKg.value;if(Object.keys(v).length>1){rows.push({tracker_key:'evolution_corporelle',entry_date:todayKey(),values:v});sources.add('Apple Santé');}}}catch(_){}}
  const byIdentity=new Map();rows.forEach(row=>{const key=`${row.tracker_key}|${row.entry_date}`,old=byIdentity.get(key);byIdentity.set(key,old?{...row,...old,values:{...(row.values||{}),...(old.values||{})}}:row);});rows=[...byIdentity.values()].sort((a,b)=>String(a.entry_date).localeCompare(String(b.entry_date)));
  const done=mtNormalizeCompletedDays(progress.completed_days),moods=mtProtocolMoodCount(protocol,start,end),elapsed=Math.max(1,Math.min(total,Number(progress.current_day||1))),metrics=[];
  const rowsFor=key=>rows.filter(r=>r.tracker_key===key),sourceLabel=sources.has('Apple Santé')?'Apple Santé + Méthode Tee':'Méthode Tee';
  if(lens.kind==='sleep'){const r=rowsFor('sommeil_profond');metrics.push(mtProtocolNumeric(r,'Durée de sommeil',mtProtocolDuration,'h','average',sourceLabel),mtProtocolNumeric(r,'Qualité ressentie',v=>mtProtocolNum(v.quality),'/10','average','Ressenti personnel'),mtProtocolNumeric(r,'État au réveil',v=>mtProtocolNum(v.wake_state),'/10','average','Ressenti personnel'));}
  else if(lens.kind==='digestion'){const r=rowsFor('digestion');metrics.push(mtProtocolNumeric(r,'Confort digestif',v=>mtProtocolNum(v.comfort),'/10'),mtProtocolNumeric(r,'Ballonnements',v=>mtProtocolNum(v.bloating),'/10'),mtProtocolNumeric(r,'Douleurs / crampes',v=>mtProtocolNum(v.pain),'/10'));}
  else if(lens.kind==='reflux'){const r=rowsFor('reflux');metrics.push(mtProtocolCount(r,'Jours avec épisode',v=>v.episode&&!/^Non/i.test(String(v.episode)),'Nombre de journées où un épisode a été renseigné.'),mtProtocolNumeric(r,'Intensité renseignée',v=>/^Non/i.test(String(v.episode||''))?0:mtProtocolNum(v.intensity),'/10'),mtProtocolNumeric(r,'Stress renseigné',v=>mtProtocolNum(v.stress),'/10'));}
  else if(lens.kind==='sugar'){const r=rowsFor('reduction_sucre');metrics.push(mtProtocolNumeric(r,'Intensité des envies',v=>mtProtocolNum(v.craving),'/10'),mtProtocolCount(r,'Jours sans sucre ajouté',v=>v.no_added_sugar==='Oui','Uniquement quand ce repère a été explicitement renseigné.'),mtProtocolCount(r,'Alternatives utiles',v=>v.alternative_help==='Oui'||v.alternative_help==='Un peu','Journées où une alternative a été jugée utile.'));}
  else if(lens.kind==='fast'){const r=rowsFor('jeune_intermit');metrics.push(mtProtocolNumeric(r,'Durée du jeûne',mtProtocolFastHours,'h'),mtProtocolNumeric(r,'Énergie',v=>mtProtocolNum(v.energy),'/10'),mtProtocolNumeric(r,'Confort après rupture',v=>mtProtocolNum(v.break_quality),'/10'));}
  else if(lens.kind==='cycle'){const r=rowsFor('cycle');metrics.push(mtProtocolNumeric(r,'Énergie',v=>mtProtocolNum(v.energy),'/10'),mtProtocolNumeric(r,'Douleurs',v=>mtProtocolNum(v.pain),'/10'),mtProtocolNumeric(r,'Sommeil ressenti',v=>mtProtocolNum(v.sleep),'/10'));}
  else if(lens.kind==='perimenopause'){const r=rowsFor('perimenopause');metrics.push(mtProtocolNumeric(r,'Sommeil',v=>mtProtocolNum(v.sleep),'/10'),mtProtocolNumeric(r,'Énergie',v=>mtProtocolNum(v.energy),'/10'),mtProtocolCount(r,'Jours avec bouffées',v=>v.hot_flashes&&!/^Aucune/i.test(String(v.hot_flashes||'')),'Journées où des bouffées de chaleur ont été signalées.'));}
  else if(lens.kind==='skin'){const r=rowsFor('peau');metrics.push(mtProtocolNumeric(r,'Sensibilité',v=>mtProtocolNum(v.sensitivity),'/10'),mtProtocolNumeric(r,'Rougeurs',v=>mtProtocolNum(v.inflammation),'/10'),mtProtocolNumeric(r,'Sécheresse',v=>mtProtocolNum(v.dryness),'/10'));}
  else if(lens.kind==='nutrition'){const r=rowsFor('nutrition_vegetale');metrics.push(mtProtocolNumeric(r,'Protéines calculées',v=>mtProtocolNum(v.protein_g),'g'),mtProtocolNumeric(r,'Fibres calculées',v=>mtProtocolNum(v.fiber_g),'g'),mtProtocolNumeric(r,'Micronutriments documentés',v=>mtProtocolNum(v.micronutrient_coverage_count),'','average','Carnet · CIQUAL'));}
  else if(lens.kind==='body'){const r=rowsFor('evolution_corporelle');metrics.push(mtProtocolNumeric(r,'Poids',v=>mtProtocolNum(v.weight),'kg','range',sourceLabel),mtProtocolNumeric(r,'Tour de taille',v=>mtProtocolNum(v.waist),'cm','range',sourceLabel),mtProtocolNumeric(r,'Confort corporel',v=>mtProtocolNum(v.body_comfort),'/10','average','Ressenti personnel'));}
  else if(lens.kind==='activity'){const rp=rowsFor('performance_recuperation'),walk=rowsFor('pas_marche');metrics.push(mtProtocolNumeric(walk,'Pas quotidiens',v=>mtProtocolNum(v.steps),'pas','average',sourceLabel),mtProtocolNumeric(rp,'Récupération ressentie',v=>mtProtocolNum(v.recovery),'/10','average','Ressenti personnel'),mtProtocolNumeric(rp,'Temps de pratique',v=>mtProtocolNum(v.duration),'min','average','Suivi activité'));}
  else if(lens.kind==='stress'){const r=rowsFor('sommeil_profond');metrics.push(mtProtocolMetric('Rituels réalisés',`${done.length} / ${total}`,'Progression du protocole, sans interpréter ton état.',done.length,'Protocole'),mtProtocolMetric('Ressentis notés',String(moods),'Entrées du journal d’humeur de ce protocole.',moods,'Journal d’humeur'),mtProtocolNumeric(r,'Qualité du sommeil',v=>mtProtocolNum(v.quality),'/10','average',sourceLabel));}
  else {metrics.push(mtProtocolMetric('Journées réalisées',`${done.length} / ${total}`,'Rituels validés dans ce protocole.',done.length,'Protocole'),mtProtocolMetric('Rythme actuel',`${Number(progress.streak||0)} jour${Number(progress.streak||0)>1?'s':''}`,'Suite de journées validées.',Math.min(elapsed,Number(progress.streak||0)),'Protocole'),mtProtocolMetric('Ressentis notés',String(moods),'Entrées du journal d’humeur pendant ce parcours.',moods,'Journal d’humeur'));}
  const documentedDates=new Set(rows.map(r=>r.entry_date));Object.keys(loadMood(protocol.id)||{}).filter(date=>date>=start&&date<=end).forEach(date=>documentedDates.add(date));
  return {lens,start,end,rows,metrics:metrics.slice(0,3),documentedDates:[...documentedDates],done,elapsed,sources:[...sources]};
}
function mtProtocolEvidence(metric,elapsed){const ratio=Math.max(0,Math.min(1,(Number(metric.count)||0)/Math.max(1,elapsed))),filled=Math.round(ratio*7);return `<div class="protocol-evidence" aria-label="${safe(`${metric.count||0} journée(s) documentée(s) sur ${elapsed}`)}">${Array.from({length:7},(_,i)=>`<i class="${i<filled?'on':''}"></i>`).join('')}</div><div class="protocol-evidence-caption">Présence des données · ${Number(metric.count)||0}/${elapsed} jour${elapsed>1?'s':''} écoulé${elapsed>1?'s':''}</div>`;}
function mtRenderProtocolMarkers(protocol,progress,total,model){const lens=model?.lens||mtProtocolLens(protocol),metrics=model?.metrics||[],elapsed=model?.elapsed||Math.max(1,Math.min(total,Number(progress.current_day||1)));return `<section class="journey-section"><div class="journey-section-kicker">Balises du protocole</div><div class="journey-section-title">${safe(lens.title)}</div><p class="journey-section-sub">${safe(lens.subtitle)} Les rubans ci-dessous indiquent combien de journées alimentent chaque repère : ils ne notent pas ton corps ni ta santé.</p><div class="protocol-markers">${metrics.map(metric=>`<article class="protocol-marker"><div class="protocol-marker-head"><div><div class="protocol-marker-label">${safe(metric.label)}</div><div class="protocol-marker-value">${safe(metric.value)}</div></div><div class="protocol-marker-source">${safe(metric.source)}</div></div><div class="protocol-marker-detail">${safe(metric.detail)}</div>${mtProtocolEvidence(metric,elapsed)}</article>`).join('')}</div>${model?.sources?.includes('Apple Santé')?'<div class="protocol-source-note"><strong>Apple Santé connecté quand pertinent.</strong> Les mesures automatiques restent séparées de tes ressentis et sont lues en lecture seule.</div>':''}</section>`;}
function mtRenderProtocolTrajectory(model,progress,total){const documented=new Set(model?.documentedDates||[]),done=new Set(mtNormalizeCompletedDays(progress.completed_days)),start=model?.start||mtProtocolStartDate(progress),current=Math.max(1,Math.min(total,Number(progress.current_day||1)));const nodes=Array.from({length:total},(_,index)=>{const day=index+1,date=mtAddProtocolDays(start,index),isDone=done.has(date),isDoc=documented.has(date),future=day>current,cls=[isDone?'done':'',isDoc?'documented':'',future?'future':''].filter(Boolean).join(' ');return `<div class="protocol-day-node ${cls}"><div class="protocol-day-dot">${isDone?'✓':day}</div><span>J${day}</span></div>`;}).join('');return `<section class="journey-section"><div class="journey-section-kicker">Trajectoire du protocole</div><div class="journey-section-title">Jour après jour</div><p class="journey-section-sub">Ici, on suit la présence dans le protocole, pas les jauges générales de Mon Équilibre.</p><div class="protocol-trajectory">${nodes}</div><div class="protocol-trajectory-legend"><span>● <b>vert</b> · rituel réalisé</span><span>◉ <b>doré</b> · repère documenté</span><span>○ jour à venir</span></div></section>`;}
function mtProtocolStartDate(progress){const d=new Date(progress?.started_at||Date.now());return Number.isNaN(d.getTime())?todayKey():d.toLocaleDateString('sv-SE');}
function mtAddProtocolDays(iso,days){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);return d.toLocaleDateString('sv-SE');}
window.renderProtocolJourney=async function(){
    const root=document.getElementById('journeyRoot'); if(!root) return;
    const user=await mtRequireUser(); if(!user) return;
    const id=getParam('id'); const protocols=await fetchProtocols(); const protocol=protocols.find(p=>p.id===id||p.slug===id);
    if(!protocol){root.innerHTML='<div class="empty-card"><h2>Protocole introuvable</h2></div>';return;}
    const owned=await fetchOwnedIds(); const admin=typeof mtHasFullPreviewAccess==='function' ? await mtHasFullPreviewAccess() : (typeof mtIsAdmin==='function' ? await mtIsAdmin() : false);
    if(!mtJourneyIsFreeProtocol(protocol)&&!owned.includes(protocol.id)&&!owned.includes(protocol.slug)&&!admin){root.innerHTML=`<div class="empty-card"><h2>Accès verrouillé</h2><p>Ce parcours se débloque automatiquement après paiement.</p><button class="main-cta" onclick="startPaymentLink('${safe(protocol.id||protocol.slug)}')">Débloquer</button></div>`;return;}
    const progress=await getProgress(protocol); const total=durationDays(protocol); const s=score(progress,total); const intention=INTENTIONS[(Number(progress.current_day||1)-1)%INTENTIONS.length]; const [contents,protocolModel]=await Promise.all([getContents(protocol, progress, admin),mtLoadProtocolModel(user,protocol,progress,total)]); const done=mtNormalizeCompletedDays(progress.completed_days); const validated=done.includes(todayKey());
    root.innerHTML=`<section class="journey-hero"><div class="journey-kicker">Parcours immersif</div><h1 class="journey-title">${safe(protocol.title)}<br><em>${safe(protocol.duration_label||'Rituel')}</em></h1><p class="journey-lead">${safe(protocol.long_description||protocol.short_description||'')}</p><div class="journey-progress-wrap"><div class="journey-progress-fill" style="width:${s}%"></div></div><div class="journey-pill-row"><span class="journey-pill">Jour ${Number(progress.current_day||1)} / ${total}</span><span class="journey-pill">${s}% accompli</span><span class="journey-pill">${Number(progress.streak||0)} streak</span></div></section>${mtRenderProtocolMarkers(protocol,progress,total,protocolModel)}${renderImmersiveNotification(progress,total)}<section class="journey-section"><div class="journey-section-kicker">Intention du jour</div><div class="intention-card"><div class="intention-mark">“</div><div class="intention-text">${safe(intention.text)}</div><span class="intention-plant">🌿 ${safe(intention.plant)}</span></div></section><section class="journey-section"><div class="journey-section-kicker">Élan du protocole</div><div class="journey-stats"><div class="journey-stat"><b>${Number(progress.streak||0)}</b><span>Streak</span></div><div class="journey-stat"><b>${Number(progress.xp||0)}</b><span>XP</span></div><div class="journey-stat"><b>${safe(progress.level_label||protocol.level_label||'Glow')}</b><span>Niveau</span></div></div><button class="validate-journey-btn ${validated?'done':''}" onclick="mtValidateProtocolToday('${safe(protocol.id)}',${total})">${validated?'✓ Journée validée':'🌿 Valider la journée'}</button></section><section class="journey-section"><div class="journey-section-kicker">Journal d’humeur</div><div class="journey-section-title">Comment tu te sens ?</div><div class="mood-picker">${MOODS.map(m=>`<button class="mood-btn" data-mood="${m}">${m}</button>`).join('')}</div><div id="journeyMoodBand">${renderMoodBand(protocol.id)}</div></section><section class="journey-section"><div class="journey-section-kicker">Arc narratif</div><div class="journey-section-title">Tes étapes clés</div>${renderArc(progress,total)}</section><section class="journey-section journey-section--days"><div class="journey-section-kicker">Rituel · Jour par jour</div><div class="journey-section-title">Ton programme</div><p class="journey-section-sub">Chaque journée se déverrouille à 7h du matin. Ton espace privé t'attend.</p><div class="journey-days-wrap">${renderContentsByDay(contents, progress.current_day, protocol.id, progress, total, admin)}</div></section>`;
    document.querySelector('.journey-section--days')?.insertAdjacentHTML('beforebegin',mtRenderProtocolTrajectory(protocolModel,progress,total));
    document.querySelectorAll('.mood-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');saveMood(protocol.id,btn.dataset.mood);document.getElementById('journeyMoodBand').innerHTML=renderMoodBand(protocol.id)}));
    observeReveal && observeReveal();
    mtOpenProtocolDayFromNotification();
  };
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>window.renderProtocolJourney&&window.renderProtocolJourney(),350));
})();
