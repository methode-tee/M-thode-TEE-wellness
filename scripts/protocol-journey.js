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
      return !d || d <= currentDay;
    });
  }
  function meta(type){
    const map={pdf:['📄','PDF'],document:['📄','Document'],video:['🎥','Vidéo'],audio:['🎧','Audio'],recette:['🥣','Recette'],routine:['🌙','Routine'],checklist:['✅','Checklist'],playlist:['🎶','Playlist'],guide_plantes:['🌿','Guide terrain'],photo_progression:['📷','Photo privée'],tracker:['📊','Suivi'],calendar:['🗓️','Calendrier'],calendrier:['🗓️','Calendrier']};
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
          Activer les rappels doux
        </button>
      </div>
    </div>
  </section>`;
}
function mtJourneyIsFreeProtocol(protocol){return !!protocol && (String(protocol.slug||'')==='premiers-pas-la-methode-tee' || Number(protocol.price_cents)===0);}
window.renderProtocolJourney=async function(){
    const root=document.getElementById('journeyRoot'); if(!root) return;
    const user=await mtRequireUser(); if(!user) return;
    const id=getParam('id'); const protocols=await fetchProtocols(); const protocol=protocols.find(p=>p.id===id||p.slug===id);
    if(!protocol){root.innerHTML='<div class="empty-card"><h2>Protocole introuvable</h2></div>';return;}
    const owned=await fetchOwnedIds(); const admin=typeof mtHasFullPreviewAccess==='function' ? await mtHasFullPreviewAccess() : (typeof mtIsAdmin==='function' ? await mtIsAdmin() : false);
    if(!mtJourneyIsFreeProtocol(protocol)&&!owned.includes(protocol.id)&&!owned.includes(protocol.slug)&&!admin){root.innerHTML=`<div class="empty-card"><h2>Accès verrouillé</h2><p>Ce parcours se débloque automatiquement après paiement.</p><button class="main-cta" onclick="startPaymentLink('${safe(protocol.id||protocol.slug)}')">Débloquer</button></div>`;return;}
    const progress=await getProgress(protocol); const total=durationDays(protocol); const s=score(progress,total); const intention=INTENTIONS[(Number(progress.current_day||1)-1)%INTENTIONS.length]; const contents=await getContents(protocol, progress, admin); const done=mtNormalizeCompletedDays(progress.completed_days); const validated=done.includes(todayKey());
    root.innerHTML=`<section class="journey-hero"><div class="journey-kicker">Parcours immersif</div><h1 class="journey-title">${safe(protocol.title)}<br><em>${safe(protocol.duration_label||'Rituel')}</em></h1><p class="journey-lead">${safe(protocol.long_description||protocol.short_description||'')}</p><div class="journey-progress-wrap"><div class="journey-progress-fill" style="width:${s}%"></div></div><div class="journey-pill-row"><span class="journey-pill">Jour ${Number(progress.current_day||1)} / ${total}</span><span class="journey-pill">${s}% accompli</span><span class="journey-pill">${Number(progress.streak||0)} streak</span></div></section><section class="journey-section">${renderVitality(s)}</section>${renderImmersiveNotification(progress,total)}<section class="journey-section"><div class="journey-section-kicker">Intention du jour</div><div class="intention-card"><div class="intention-mark">“</div><div class="intention-text">${safe(intention.text)}</div><span class="intention-plant">🌿 ${safe(intention.plant)}</span></div></section><section class="journey-section"><div class="journey-section-kicker">Élan du protocole</div><div class="journey-stats"><div class="journey-stat"><b>${Number(progress.streak||0)}</b><span>Streak</span></div><div class="journey-stat"><b>${Number(progress.xp||0)}</b><span>XP</span></div><div class="journey-stat"><b>${safe(progress.level_label||protocol.level_label||'Glow')}</b><span>Niveau</span></div></div><button class="validate-journey-btn ${validated?'done':''}" onclick="mtValidateProtocolToday('${safe(protocol.id)}',${total})">${validated?'✓ Journée validée':'🌿 Valider la journée'}</button></section><section class="journey-section"><div class="journey-section-kicker">Journal d’humeur</div><div class="journey-section-title">Comment tu te sens ?</div><div class="mood-picker">${MOODS.map(m=>`<button class="mood-btn" data-mood="${m}">${m}</button>`).join('')}</div><div id="journeyMoodBand">${renderMoodBand(protocol.id)}</div></section><section class="journey-section"><div class="journey-section-kicker">Arc narratif</div><div class="journey-section-title">Tes étapes clés</div>${renderArc(progress,total)}</section><section class="journey-section journey-section--days"><div class="journey-section-kicker">Rituel · Jour par jour</div><div class="journey-section-title">Ton programme</div><p class="journey-section-sub">Chaque journée se déverrouille à 7h du matin. Ton espace privé t'attend.</p><div class="journey-days-wrap">${renderContentsByDay(contents, progress.current_day, protocol.id, progress, total, admin)}</div></section>`;
    document.querySelectorAll('.mood-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');saveMood(protocol.id,btn.dataset.mood);document.getElementById('journeyMoodBand').innerHTML=renderMoodBand(protocol.id)}));
    observeReveal && observeReveal();
    mtOpenProtocolDayFromNotification();
  };
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>window.renderProtocolJourney&&window.renderProtocolJourney(),350));
})();
