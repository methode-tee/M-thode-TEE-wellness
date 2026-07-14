
/* =========================================================
   MÉTHODE TEE V18 — Club + Protocoles premium
   Base V17b conservée : navbar/topbar/déblocage intactes.
   ========================================================= */
(function(){
  const safe = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

  // ── XP LEVEL SYSTEM ─────────────────────────────────────────────
  const MT_LEVELS = [
    { min:0,    max:499,  key:'graine',    label:'Graine',     iconKey:'seed', reward:'Bibliothèque botanique', detail:'Accès aux bases végétales et à ton espace progression.' },
    { min:500,  max:1499, key:'pousse',    label:'Pousse',     iconKey:'sprout', reward:'Rituel exclusif Méthode Tee', detail:'Un rituel privé à ajouter à ton espace.' },
    { min:1500, max:3999, key:'floraison', label:'Floraison',  iconKey:'flower', reward:'Mini-protocole inédit 3 jours', detail:'Un mini-parcours bonus pour prolonger ton évolution.' },
    { min:4000, max:7999, key:'racines',   label:'Racines',    iconKey:'tree', reward:'Bon privé -10%', detail:'Un avantage privé sur un contenu Méthode Tee.' },
    { min:8000, max:Infinity, key:'alchimiste', label:'Alchimiste', iconKey:'sparkle', reward:'Question privée à Teeyana', detail:'Une question privée à poser depuis ton espace.' },
  ];

  function mtComputeLevel(xp) {
    const n = Number(xp) || 0;
    return MT_LEVELS.find(l => n >= l.min && n <= l.max) || MT_LEVELS[0];
  }

  async function mtAddGlobalXP(client, user, amount) {
    try {
      const { data: mp } = await client.from('member_profiles').select('points,level,badge,level_label').eq('user_id', user.id).maybeSingle();
      const currentXp = Number(mp?.points || 0);
      const gain = Number(amount || 0);
      if (!gain || gain < 0) return { currentXp, newXp: currentXp, gain: 0 };
      const newXp = currentXp + gain;
      const newLevel = mtComputeLevel(newXp);
      const wasLevel = mtComputeLevel(currentXp);

      await client.from('member_profiles').upsert({
        user_id: user.id,
        points: newXp,
        level: newLevel.key,
        level_label: newLevel.label,
        badge: newLevel.emoji
      }, { onConflict: 'user_id' });

      try {
        localStorage.setItem('mt_last_xp_gain', JSON.stringify({
          gain, currentXp, newXp,
          oldLevel: wasLevel,
          newLevel,
          at: new Date().toISOString()
        }));
      } catch(e) {}

      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('mt:xp-gained', {
          detail: { gain, currentXp, newXp, oldLevel: wasLevel, newLevel }
        }));
      }

      if (window.mtToast) {
        const next = (window.MT_LEVELS || MT_LEVELS).find(l => newXp < l.min);
        const more = next ? ` · encore ${Math.max(0, next.min - newXp)} XP avant ${next.label}` : '';
        setTimeout(() => mtToast(`+${gain} XP gagnés${more}`), 250);
      }

      if (newLevel.key !== wasLevel.key) {
        if (window.mtShowLevelUp) setTimeout(() => window.mtShowLevelUp(wasLevel, newLevel, currentXp, newXp, gain), 500);
        else if (window.mtToast) setTimeout(() => mtToast(`Niveau atteint : ${newLevel.label} — ${newLevel.reward}`), 800);
      }
      return { currentXp, newXp, gain, oldLevel: wasLevel, newLevel };
    } catch(e) { console.warn('XP update failed:', e); return null; }
  }

  window.mtComputeLevel = mtComputeLevel;
  window.MT_LEVELS = MT_LEVELS;
  // ────────────────────────────────────────────────────────────────

  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

  const TYPE_META = {
    pdf:{emoji:'',iconKey:'book',label:'PDF premium'}, document:{emoji:'',iconKey:'book',label:'Document'}, ebook:{emoji:'',iconKey:'book',label:'Ebook'}, guide_plantes:{emoji:'',iconKey:'leaf',label:'Guide plantes'},
    video:{emoji:'',iconKey:'sparkle',label:'Vidéo'}, audio:{emoji:'',iconKey:'bell',label:'Audio'}, recette:{emoji:'',iconKey:'bowl',label:'Recette'}, routine:{emoji:'',iconKey:'leaf',label:'Routine'},
    checklist:{emoji:'',iconKey:'check',label:'Checklist'}, tracker:{emoji:'',iconKey:'chart',label:'Tracker'}, tableau:{emoji:'',iconKey:'chart',label:'Tableau'}, calendar:{emoji:'',iconKey:'calendar',label:'Calendrier'}, calendrier:{emoji:'',iconKey:'calendar',label:'Calendrier'}, playlist:{emoji:'',iconKey:'sparkle',label:'Playlist'}, suivi:{emoji:'',iconKey:'chart',label:'Suivi'}, photo:{emoji:'',iconKey:'sparkle',label:'Photo'}, private_doc:{emoji:'',iconKey:'lock',label:'Document privé'}, journal_private:{emoji:'',iconKey:'book',label:'Journal privé'}, journal:{emoji:'',iconKey:'book',label:'Journal privé'}
  };
  function meta(type){return TYPE_META[String(type||'document').toLowerCase()] || TYPE_META.document;}
  function mtTypeIcon(m, cls='saved-type-icon'){ return window.mtIconHTML ? mtIconHTML(m.iconKey || m.label || 'book', cls) : safe(m.emoji || ''); }
  function getUrl(c){return c.signed_url || c.public_url || c.file_url || c.video_url || c.audio_url || c.embed_url || c.thumbnail_url || '';}
  function embedUrl(url){
    const u=String(url||'');
    if(!u) return '';
    if(u.includes('youtube.com/embed') || u.includes('player.vimeo.com')) return u;
    const yt=u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
    if(yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vim=u.match(/vimeo\.com\/(\d+)/);
    if(vim) return `https://player.vimeo.com/video/${vim[1]}`;
    return u;
  }
  function parseChecklist(text){
    const raw = String(text || '').trim();
    if(!raw) return ['Lire le contenu', 'Faire la routine', 'Valider mon avancée'];
    try{
      const j=JSON.parse(raw);
      if(Array.isArray(j)) return j.map(x => typeof x==='string'?x:(x.title||x.text||'Étape'));
      if(Array.isArray(j.items)) return j.items.map(x => typeof x==='string'?x:(x.title||x.text||'Étape'));
    }catch(e){}
    return raw.split(/\n|;/).map(x=>x.trim()).filter(Boolean);
  }

  async function signedContent(content){
    const raw = getUrl(content);

    // Si le contenu vient de l'admin et possède un id, on demande d'abord
    // une URL signée temporaire. Cela évite d'ouvrir directement un lien
    // Supabase public cassé ou un fichier premium privé.
    if(content?.id && typeof mtCallFunction === 'function'){
      try{
        const r = await mtCallFunction((window.MT_CONFIG && window.MT_CONFIG.SIGNED_URL_FUNCTION) || 'create-signed-url',{content_id:content.id});
        if(r?.signed_url) return r.signed_url;
      }catch(e){}
    }

    // Fallback uniquement pour les liens externes manuels : YouTube, Vimeo,
    // audio externe, image publique, etc.
    if(raw && /^https?:\/\//i.test(raw)) return raw;
    return '';
  }

  async function getProtocolProgress(protocol){
    const client=initSupabase&&initSupabase(); const user=await mtGetUser();
    if(!client||!user||!protocol?.id) return null;
    let {data,error}=await client.from('protocol_progress').select('*').eq('user_id',user.id).eq('protocol_id',protocol.id).order('updated_at',{ascending:false}).limit(1).maybeSingle();
    if(!data){
      const total = Number(protocol.total_days || String(protocol.duration_label||'').match(/\d+/)?.[0] || 21);
      const nowIso = new Date().toISOString();
      const insert={user_id:user.id,protocol_id:protocol.id,current_day:1,total_days:total,streak:0,xp:0,level_label:protocol.level_label||'Exploration',started_at:nowIso};
      const res=await client.from('protocol_progress').insert(insert).select('*').maybeSingle();
      data=res.data || insert;
    }
    return data;
  }
  async function saveProtocolProgress(progress){
    const client=initSupabase&&initSupabase(); const user=await mtGetUser();
    if(!client||!user||!progress?.protocol_id) return null;
    const payload = {...progress, user_id:user.id};
    let res;
    if(payload.id){
      res = await client.from('protocol_progress').update(payload).eq('id', payload.id).select('*').maybeSingle();
    } else {
      const existing = await client.from('protocol_progress').select('id').eq('user_id',user.id).eq('protocol_id',payload.protocol_id).order('updated_at',{ascending:false}).limit(1).maybeSingle();
      if(existing?.data?.id){
        payload.id = existing.data.id;
        res = await client.from('protocol_progress').update(payload).eq('id', payload.id).select('*').maybeSingle();
      } else {
        res = await client.from('protocol_progress').insert(payload).select('*').maybeSingle();
      }
    }
    if(res?.error){ if(window.mtToast) mtToast(res.error.message,'error'); return progress; }
    return res?.data || progress;
  }
  function todayKey(){
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0,10);
  }
  function mtLocalDateKey(date){
    const d = date instanceof Date ? date : new Date(date);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0,10);
  }
  function mtNormalizeCompletedDays(value){
    if(Array.isArray(value)) return value.filter(Boolean).map(String);
    if(typeof value === 'string'){
      try{
        const parsed = JSON.parse(value);
        if(Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
      }catch(_){
        return value.split(',').map(s=>s.trim()).filter(Boolean);
      }
    }
    return [];
  }
  window.__mtValidatingProtocolDay = window.__mtValidatingProtocolDay || {};
  window.__mtValidatingProtocolDay = window.__mtValidatingProtocolDay || {};
  window.mtValidateProtocolToday = async function(protocolId,totalDays){
    const key=todayKey();
    const lockKey = `${protocolId}:${key}`;
    const localDoneKey = `mt_protocol_day_validated_${lockKey}`;

    const btns = Array.from(document.querySelectorAll('.validate-today-btn,.validate-journey-btn'));
    const markDone = ()=>btns.forEach(b=>{ b.disabled=true; b.classList.add('done'); b.textContent='✓ Journée validée'; });

    if(window.__mtValidatingProtocolDay[lockKey] || localStorage.getItem(localDoneKey)==='1'){
      markDone();
      if(window.mtToast) mtToast('Journée déjà validée aujourd’hui');
      return;
    }
    window.__mtValidatingProtocolDay[lockKey] = true;
    markDone();

    try{
      const client=initSupabase&&initSupabase(); const user=await mtGetUser(); if(!client||!user) return;
      const {data:current,error:fetchError}=await client.from('protocol_progress').select('*').eq('user_id',user.id).eq('protocol_id',protocolId).order('updated_at',{ascending:false}).limit(1).maybeSingle();
      if(fetchError){ if(window.mtToast) mtToast(fetchError.message,'error'); return; }

      const p=current || {user_id:user.id,protocol_id:protocolId,current_day:1,total_days:totalDays||21,streak:0,xp:0,completed_days:[],checklist_state:{},completed_content:[],started_at:new Date().toISOString()};
      const done = mtNormalizeCompletedDays(p.completed_days);
      if(done.includes(key)){
        localStorage.setItem(localDoneKey,'1');
        if(window.mtToast) mtToast('Journée déjà validée aujourd’hui');
        return;
      }

      const sortedBefore = [...new Set(done)].sort();
      let newStreak = 1;
      if(sortedBefore.length){
        const lastKey = sortedBefore[sortedBefore.length - 1];
        const lastDate = new Date(lastKey + 'T00:00:00');
        const nowDate = new Date(key + 'T00:00:00');
        const diffDays = Math.round((nowDate.getTime() - lastDate.getTime()) / 86400000);
        if(diffDays === 1) newStreak = (Number(p.streak)||0) + 1;
        else if(diffDays === 0) newStreak = Number(p.streak)||1;
        else newStreak = 1;
      }

      done.push(key);
      p.completed_days=[...new Set(done)].sort();
      p.last_validated_at=new Date().toISOString();
      p.streak=newStreak;
      const streakBonus = (p.streak > 0 && p.streak % 7 === 0) ? 50 : 0;
      const dayXp = 10 + streakBonus;
      const total = Number(p.total_days||totalDays||21);
      const currentDay = Math.max(1, Math.min(total, Number(p.current_day||1)));
      p.current_day = currentDay;

      let completionBonus = 0;
      if (currentDay >= total && !p.certificate_unlocked) {
        completionBonus = 100;
        p.certificate_unlocked = true;
      }
      p.xp=(Number(p.xp)||0)+dayXp+completionBonus;
      const newLvl = mtComputeLevel(p.xp);
      p.level_label = newLvl.label;

      const saved=await saveProtocolProgress(p);
      if(saved && mtNormalizeCompletedDays(saved.completed_days).includes(key)){
        localStorage.setItem(localDoneKey,'1');
        const client2=initSupabase&&initSupabase(); const user2=await mtGetUser();
        if(client2&&user2) await mtAddGlobalXP(client2, user2, dayXp + completionBonus);
        if(completionBonus && window.mtToast) setTimeout(()=>mtToast('Protocole terminé — +100 XP bonus'), 1200);
        const toast = streakBonus ? `Journée validée +${dayXp} XP (streak bonus!)` : `Journée validée +${dayXp} XP`;
        if(window.mtToast) mtToast(toast);
        if(window.mtJournalTrack) window.mtJournalTrack('checklist');
        setTimeout(()=>location.reload(),450);
      }
    } finally {
      setTimeout(()=>{ delete window.__mtValidatingProtocolDay[lockKey]; }, 2500);
    }
  };

  async function saveChecklist(contentId, protocolId, key, checked){
    const client=initSupabase&&initSupabase(); const user=await mtGetUser(); if(!client||!user) return;
    const {data:p}=await client.from('protocol_progress').select('*').eq('user_id',user.id).eq('protocol_id',protocolId).maybeSingle();
    if(!p) return;
    const state = p.checklist_state || {};
    state[contentId] = state[contentId] || {};
    state[contentId][key] = !!checked;
    await client.from('protocol_progress').update({checklist_state:state}).eq('id',p.id);
    if(checked && window.mtJournalTrack) window.mtJournalTrack('checklist');
  }



  function mtAudioTimeLabel(seconds){
    seconds = Number(seconds || 0);
    if(!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${m}:${String(sec).padStart(2,'0')}`;
  }
  window.mtImmersiveAudioToggle = function(playerId){
    const card = document.getElementById(playerId);
    if(!card) return;
    const audio = card.querySelector('audio');
    const btn = card.querySelector('.mt-audio-play');
    if(!audio || !btn) return;
    document.querySelectorAll('.mt-ritual-audio audio').forEach(a => { if(a !== audio) a.pause(); });
    if(audio.paused){
      const playPromise = audio.play();
      if(playPromise && typeof playPromise.catch === 'function') playPromise.catch(()=>{});
      card.classList.add('is-playing');
      btn.innerHTML = '<span>II</span>';
      btn.setAttribute('aria-label','Mettre en pause');
    }else{
      audio.pause();
      card.classList.remove('is-playing');
      btn.innerHTML = '<span>▶</span>';
      btn.setAttribute('aria-label','Lire l’audio');
    }
  };
  window.mtImmersiveAudioSeek = function(event, playerId){
    const card = document.getElementById(playerId);
    if(!card) return;
    const audio = card.querySelector('audio');
    const track = card.querySelector('.mt-audio-track');
    if(!audio || !track || !audio.duration) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  };
  window.mtImmersiveAudioBind = function(playerId){
    const card = document.getElementById(playerId);
    if(!card || card.dataset.bound === '1') return;
    card.dataset.bound = '1';
    const audio = card.querySelector('audio');
    const fill = card.querySelector('.mt-audio-fill');
    const time = card.querySelector('.mt-audio-time-current');
    const duration = card.querySelector('.mt-audio-time-total');
    const btn = card.querySelector('.mt-audio-play');
    if(!audio) return;
    const refresh = () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      if(fill) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      if(time) time.textContent = mtAudioTimeLabel(audio.currentTime);
      if(duration) duration.textContent = mtAudioTimeLabel(audio.duration);
    };
    audio.addEventListener('loadedmetadata', refresh);
    audio.addEventListener('timeupdate', refresh);
    audio.addEventListener('pause', () => { card.classList.remove('is-playing'); if(btn) btn.innerHTML = '<span>▶</span>'; });
    audio.addEventListener('ended', () => { card.classList.remove('is-playing'); if(btn) btn.innerHTML = '<span>▶</span>'; refresh(); });
    setTimeout(refresh, 120);
  };
  function renderImmersiveAudio(content, audioUrl){
    const src = safe(audioUrl || content.audio_url || content.public_url || '');
    const playerId = 'mtAudio_' + String(content.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g,'_');
    const title = safe(content.title || 'Rituel audio privé');
    const desc = safe(content.description || content.content_text || 'Installe-toi, respire doucement et laisse le rituel t’accompagner.');
    return `<div class="mt-ritual-audio" id="${playerId}">
      <div class="mt-audio-orb"><span>🎧</span></div>
      <div class="mt-audio-kicker">Audio immersif</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      <audio preload="metadata" src="${src}" onloadedmetadata="mtImmersiveAudioBind('${playerId}')"></audio>
      <div class="mt-audio-controls">
        <button class="mt-audio-play" type="button" aria-label="Lire l’audio" onclick="mtImmersiveAudioToggle('${playerId}')"><span>▶</span></button>
        <div class="mt-audio-main">
          <button class="mt-audio-track" type="button" onclick="mtImmersiveAudioSeek(event,'${playerId}')"><i class="mt-audio-fill"></i></button>
          <div class="mt-audio-times"><span class="mt-audio-time-current">0:00</span><span class="mt-audio-time-total">0:00</span></div>
        </div>
      </div>
      <div class="mt-audio-closed-eyes">Mode rituel · écoute au calme · respiration lente</div>
    </div><script>setTimeout(function(){ if(window.mtImmersiveAudioBind) mtImmersiveAudioBind('${playerId}'); },80);</script>`;
  }

  // ── Rendu premium d'une recette à partir du content_text ──────────────
  function renderImmersiveRecette(content, fileUrl) {
    const raw = content.content_text || content.description || '';
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    // Détecte les sections marquées entre [crochets] ou en MAJUSCULES seules
    const sectionRe = /^\[(.+)\]$|^([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ\s]{4,})\s*:?$/;
    let sections = [];
    let cur = null;
    lines.forEach(line => {
      const m = line.match(sectionRe);
      if (m) {
        if (cur) sections.push(cur);
        cur = { title: (m[1] || m[2]).trim(), items: [] };
      } else {
        if (!cur) cur = { title: 'Ingrédients', items: [] };
        cur.items.push(line);
      }
    });
    if (cur) sections.push(cur);

    // Si aucune section détectée → affichage liste simple
    if (!sections.length || (sections.length === 1 && !sections[0].title)) {
      const items = lines.map(l => `<li>${safe(l)}</li>`).join('');
      return `<div class="imm-recipe">
        <p class="imm-recipe-desc">${safe(content.description||'')}</p>
        <ul class="imm-recipe-list">${items}</ul>
        ${fileUrl ? renderRecipeFile(fileUrl) : ''}
      </div>`;
    }

    const sectionsHtml = sections.map(s => {
      const isPrep = /prép|preparation|étapes|method/i.test(s.title);
      const items = s.items.map((it, i) =>
        isPrep
          ? `<li class="imm-recipe-step"><span class="imm-step-num">${i+1}</span><span>${safe(it)}</span></li>`
          : `<li class="imm-recipe-ing"><span class="imm-ing-dot">◆</span><span>${safe(it)}</span></li>`
      ).join('');
      return `<div class="imm-recipe-section">
        <h4 class="imm-recipe-section-title">${safe(s.title)}</h4>
        <ul class="imm-recipe-list ${isPrep ? 'imm-recipe-list--steps' : ''}">${items}</ul>
      </div>`;
    }).join('');

    return `<div class="imm-recipe">
      ${content.description ? `<p class="imm-recipe-desc">${safe(content.description)}</p>` : ''}
      ${sectionsHtml}
      ${fileUrl ? renderRecipeFile(fileUrl) : ''}
    </div>`;
  }

  function renderRecipeFile(url) {
    const isImage = /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(url);
    const isPdf   = /\.pdf(\?|$)/i.test(url);
    if (isImage) return `<img class="imm-recipe-img" src="${safe(url)}" alt="">`;
    if (isPdf)   return `<div class="imm-recipe-pdf-wrap"><iframe class="immersive-frame" src="${safe(url)}"></iframe></div>`;
    return `<a class="imm-recipe-file-link" href="${safe(url)}" target="_blank" rel="noopener">📎 Ouvrir le fichier joint →</a>`;
  }
  // ───────────────────────────────────────────────────────────────────────


  // ── Rendus éditoriaux premium par type · inspirés Recette/Audio ──
  function mtContentLines(text){
    return String(text || '').split('\n').map(l=>l.trim()).filter(Boolean);
  }
  function mtSplitSections(raw, fallbackTitle='À retenir'){
    const lines = mtContentLines(raw);
    const sectionRe = /^\[(.+)\]$|^([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ0-9\s\/\-&]{4,})\s*:?$/;
    let sections=[]; let cur=null;
    lines.forEach(line=>{
      const m=line.match(sectionRe);
      if(m){ if(cur) sections.push(cur); cur={title:(m[1]||m[2]).trim(),items:[]}; }
      else { if(!cur) cur={title:fallbackTitle,items:[]}; cur.items.push(line); }
    });
    if(cur) sections.push(cur);
    return sections;
  }
  function mtRenderPremiumFile(url, label='Support joint'){
    if(!url) return '';
    const isImage=/\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(url);
    const isPdf=/\.pdf(\?|$)/i.test(url);
    if(isImage) return `<div class="imm-editorial-file"><h4>${safe(label)}</h4><img class="imm-recipe-img imm-editorial-img" src="${safe(url)}" alt=""></div>`;
    if(isPdf) return `<div class="imm-editorial-file"><h4>${safe(label)}</h4><div class="imm-recipe-pdf-wrap"><iframe class="immersive-frame" src="${safe(url)}"></iframe></div></div>`;
    return `<a class="imm-recipe-file-link" href="${safe(url)}" target="_blank" rel="noopener">📎 Ouvrir le fichier joint →</a>`;
  }
  function mtEditorialHeader(content, fallbackDesc=''){
    const desc = content.description || fallbackDesc;
    return desc ? `<p class="imm-recipe-desc">${safe(desc)}</p>` : '';
  }
  function mtRenderEditorial(content, fileUrl, opts={}){
    const title = opts.fallbackTitle || 'À retenir';
    const mode = opts.mode || 'bullets';
    const sections = mtSplitSections(content.content_text || '', title);
    const sectionsHtml = sections.length ? sections.map(section=>{
      const isSteps = mode==='steps' || /prép|preparation|étapes|rituel|routine|méthode|actions?/i.test(section.title);
      const items = section.items.map((it,i)=> isSteps
        ? `<li class="imm-recipe-step"><span class="imm-step-num">${i+1}</span><span>${safe(it)}</span></li>`
        : `<li class="imm-recipe-ing"><span class="imm-ing-dot">◆</span><span>${safe(it)}</span></li>`).join('');
      return `<div class="imm-recipe-section"><h4 class="imm-recipe-section-title">${safe(section.title)}</h4><ul class="imm-recipe-list ${isSteps?'imm-recipe-list--steps':''}">${items}</ul></div>`;
    }).join('') : '';
    return `<div class="imm-recipe imm-editorial imm-editorial--${safe(opts.kind||'module')}">${mtEditorialHeader(content, opts.desc||'')}${sectionsHtml || `<div class="immersive-text"><p>${safe(content.content_text || content.description || 'Contenu à consulter dans ton espace privé.')}</p></div>`}${mtRenderPremiumFile(fileUrl, opts.fileLabel||'Support joint')}</div>`;
  }
  function mtRenderPremiumChecklist(content, protocolId){
    return (async()=>{
      const progress = await getProtocolProgress({id:protocolId});
      const saved = (progress?.checklist_state || {})[content.id] || {};
      const items = parseChecklist(content.content_text || content.description);
      return `<div class="imm-recipe imm-editorial imm-editorial--checklist">${mtEditorialHeader(content,'Coche chaque étape au fil du rituel, puis valide ton avancée.')}
        <div class="imm-recipe-section"><h4 class="imm-recipe-section-title">Checklist du jour</h4><ul class="imm-recipe-list imm-recipe-list--steps">
        ${items.map((it,i)=>`<li class="imm-check-step"><label><input type="checkbox" ${saved[i]?'checked':''} onchange="window.mtSaveChecklistItem('${safe(content.id)}','${safe(protocolId)}','${i}',this.checked)"><span class="imm-step-num">${i+1}</span><span>${safe(it)}</span></label></li>`).join('')}
        </ul></div></div>`;
    })();
  }

  function mtLooksLikePrivateJournal(content){
    const t = String(content?.type || "").toLowerCase();
    const txt = String(content?.content_text || content?.description || "").trim();
    const title = String(content?.title || "").toLowerCase();
    const qCount = (txt.match(/\?/g) || []).length;
    return ['journal_private','journal','private_journal'].includes(t)
      || (['contenu','content','document','private_doc','fichier'].includes(t) && qCount >= 2 && /rapport|journal|bilan|réflexion|reflexion|engagement|sommeil|glucide|sucre|émotion|emotion/.test(title + ' ' + txt));
  }
  function mtParsePrivateJournalQuestions(text){
    const lines = mtContentLines(text || "");
    return lines.map(l => l.replace(/^\d+[\).\-\s]+/,"").trim()).filter(Boolean).length
      ? lines.map(l => l.replace(/^\d+[\).\-\s]+/,"").trim()).filter(Boolean)
      : ["Comment je me sens aujourd’hui ?","Qu’est-ce que j’ai observé ?","Quelle petite victoire puis-je reconnaître ?"];
  }
  function mtPrivateJournalLocalKey(content, protocolId){
    return `mt_private_journal_${protocolId || content?.protocol_id || "global"}_${content?.id || content?.title || "entry"}`;
  }
  function mtReadPrivateJournalLocal(key){
    try{return JSON.parse(localStorage.getItem(key)||"{}");}catch(e){return {};}
  }
  function mtWritePrivateJournalLocal(key,data){
    localStorage.setItem(key, JSON.stringify(data||{}));
  }
  function mtRenderPrivateJournalContent(content, protocolId){
    const questions = mtParsePrivateJournalQuestions(content.content_text || content.description);
    const entryKey = mtPrivateJournalLocalKey(content, protocolId);
    const saved = mtReadPrivateJournalLocal(entryKey);
    const answers = saved.answers || {};
    return `<div class="imm-recipe imm-editorial imm-editorial--journal">${mtEditorialHeader(content,'Un espace personnel et confidentiel pour déposer tes réponses, tes prises de conscience et ton évolution.')}
      <div class="imm-recipe-section">
        <h4 class="imm-recipe-section-title">Journal privé</h4>
        <p class="mt-journal-intro">Tes réponses restent enregistrées dans ton espace. Tu peux revenir les modifier quand tu en as besoin.</p>
        <div class="mt-private-journal" data-entry="${safe(entryKey)}">
          ${questions.map((q,i)=>`<label class="mt-journal-question">
            <span>Question ${i+1}</span>
            <strong>${safe(q)}</strong>
            <textarea id="mtJournal_${safe(entryKey)}_${i}" rows="4" placeholder="Écris ici, sans pression...">${safe(answers[i] || "")}</textarea>
          </label>`).join("")}
        </div>
        <button class="mt-journal-save-btn" onclick="mtSavePrivateJournalContent('${safe(entryKey)}','${safe(content.id || "")}','${safe(protocolId || content.protocol_id || "")}','${encodeURIComponent(JSON.stringify(questions))}','${safe(content.title || "Journal privé")}')">Enregistrer dans mon espace privé</button>
        ${saved.updated_at ? `<p class="mt-journal-live-note">Dernière sauvegarde : ${safe(new Date(saved.updated_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}))}</p>` : ""}
      </div>
    </div>`;
  }
  window.mtSavePrivateJournalContent = async function(entryKey, contentId, protocolId, encodedQuestions, journalTitle){
    let questions=[];
    try{ questions = JSON.parse(decodeURIComponent(encodedQuestions || "[]")); }catch(e){ questions=[]; }
    const answers = {};
    questions.forEach((q,i)=>{
      const el = document.getElementById(`mtJournal_${entryKey}_${i}`);
      answers[i] = el ? el.value.trim() : "";
    });
    const payload = {
      id: entryKey,
      content_id: contentId || "",
      protocol_id: protocolId || "",
      title: journalTitle || "Journal privé",
      questions,
      answers,
      date: todayKey(),
      updated_at: new Date().toISOString()
    };
    mtWritePrivateJournalLocal(entryKey, payload);

    if(window.mtSaveJournalProtocolEntry){
      try{ await window.mtSaveJournalProtocolEntry(payload); }catch(e){ console.warn("journal protocol save", e); }
    }
    if(window.mtJournalTrack) await window.mtJournalTrack("journal");
    if(window.mtRefreshParcoursCalendar) window.mtRefreshParcoursCalendar();

    const btn = document.querySelector(".mt-journal-save-btn");
    if(btn){
      const oldText = btn.textContent;
      btn.textContent = "Sauvegardé dans ton espace privé";
      btn.classList.add("is-saved");
      setTimeout(()=>{ btn.textContent = oldText; btn.classList.remove("is-saved"); }, 2200);
    }
    let note = document.querySelector(".mt-journal-live-note");
    if(!note && btn){
      note = document.createElement("p");
      note.className = "mt-journal-live-note";
      btn.insertAdjacentElement("afterend", note);
    }
    if(note) note.textContent = "Dernière sauvegarde : à l’instant";
    if(window.mtToast) mtToast("Journal privé sauvegardé");
  };


  function mtTrackerStorageKey(content, protocolId){
    return `mt_tracker_v1_${protocolId || content?.protocol_id || "global"}_${content?.id || content?.title || "tracker"}`;
  }
  function mtParseTrackerFields(text){
    const lines = mtContentLines(text || "");
    const parsed = lines.map((line, index) => {
      const parts = String(line).split("|").map(x => x.trim()).filter(Boolean);
      const label = parts[0] || `Repère ${index + 1}`;
      const min = Number(parts[1] || 1);
      const max = Number(parts[2] || 10);
      return {
        label,
        min: Number.isFinite(min) ? min : 1,
        max: Number.isFinite(max) ? max : 10,
        key: label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"") || `field_${index}`
      };
    });
    return parsed.length ? parsed : [
      {label:"Stress", min:1, max:10, key:"stress"},
      {label:"Calme intérieur", min:1, max:10, key:"calme_interieur"},
      {label:"Concentration", min:1, max:10, key:"concentration"},
      {label:"Qualité du sommeil prévue", min:1, max:10, key:"sommeil_prevu"}
    ];
  }
  function mtReadTrackerLog(key){
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch(e){ return {}; }
  }
  function mtWriteTrackerLog(key, log){
    localStorage.setItem(key, JSON.stringify(log || {}));
  }
  function mtTrackerToday(){
    return todayKey();
  }
  function mtTrackerAverage(entry, fields){
    if(!entry || !entry.values) return null;
    const vals = fields.map(f => Number(entry.values[f.key])).filter(v => Number.isFinite(v));
    if(!vals.length) return null;
    return Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
  }
  function mtTrackerHistoryHTML(log, fields){
    const days = [];
    for(let i=6;i>=0;i--){
      const d = new Date();
      d.setDate(d.getDate()-i);
      const key = mtLocalDateKey(d);
      const avg = mtTrackerAverage(log[key], fields);
      days.push({key, avg, label:d.toLocaleDateString("fr-FR",{weekday:"short"}).slice(0,3)});
    }
    return `<div class="mt-tracker-history">
      ${days.map(d => `<div class="mt-tracker-day ${d.avg ? "has-value" : ""}">
        <i style="height:${d.avg ? Math.max(8, d.avg*8) : 6}%"></i>
        <span>${safe(d.label)}</span>
      </div>`).join("")}
    </div>`;
  }
  function mtRenderPremiumTracker(content, fileUrl, protocolId){
    const fields = mtParseTrackerFields(content.content_text || content.description);
    const storageKey = mtTrackerStorageKey(content, protocolId);
    const log = mtReadTrackerLog(storageKey);
    const today = mtTrackerToday();
    const todayValues = log[today]?.values || {};
    return `<div class="imm-recipe imm-editorial imm-editorial--tracker">${mtEditorialHeader(content,'Un espace doux pour observer ton évolution sans pression.')}
      <div class="imm-recipe-section">
        <h4 class="imm-recipe-section-title">Tracker du jour</h4>
        <p class="mt-tracker-intro">Ajuste chaque repère selon ton ressenti du jour. Les valeurs restent enregistrées dans ton espace.</p>
        <div class="mt-tracker-sliders" data-tracker-key="${safe(storageKey)}">
          ${fields.map((f,i)=>{
            const value = Number(todayValues[f.key] || Math.round((f.min+f.max)/2));
            return `<div class="mt-tracker-row">
              <div class="mt-tracker-row-head">
                <span>${String(i+1).padStart(2,'0')}</span>
                <strong>${safe(f.label)}</strong>
                <b id="mtTrackerVal_${safe(f.key)}">${value}</b>
              </div>
              <input type="range" min="${f.min}" max="${f.max}" value="${value}" step="1"
                oninput="mtTrackerLiveValue('${safe(f.key)}', this.value)"
                onchange="mtSaveTrackerValue('${safe(storageKey)}','${safe(f.key)}',this.value)">
              <div class="mt-tracker-scale"><small>${f.min}</small><small>${f.max}</small></div>
            </div>`;
          }).join("")}
        </div>
        <button class="mt-tracker-save-btn" onclick="mtConfirmTrackerSaved()">Enregistré aujourd’hui</button>
      </div>
      <div class="imm-recipe-section">
        <h4 class="imm-recipe-section-title">Évolution 7 jours</h4>
        ${mtTrackerHistoryHTML(log, fields)}
      </div>
      ${mtRenderPremiumFile(fileUrl,'Support de suivi')}
    </div>`;
  }
  window.mtTrackerLiveValue = function(fieldKey, value){
    const el = document.getElementById(`mtTrackerVal_${fieldKey}`);
    if(el) el.textContent = value;
  };
  window.mtSaveTrackerValue = function(storageKey, fieldKey, value){
    const log = mtReadTrackerLog(storageKey);
    const today = mtTrackerToday();
    log[today] = log[today] || { values:{}, updated_at:new Date().toISOString() };
    log[today].values[fieldKey] = Number(value);
    log[today].updated_at = new Date().toISOString();
    mtWriteTrackerLog(storageKey, log);
    if(window.mtToast) mtToast("Tracker mis à jour");
    if(window.mtJournalTrack) window.mtJournalTrack("tracker");
  };
  window.mtConfirmTrackerSaved = function(){
    if(window.mtToast) mtToast("Tes repères du jour sont bien enregistrés");
  };
  function mtRenderPremiumPlaylist(content, url){
    const lines = mtContentLines(content.content_text || content.description);
    return `<div class="imm-recipe imm-editorial imm-editorial--playlist">${mtEditorialHeader(content,'Un moment sonore pour accompagner le rituel.')}
      <div class="imm-playlist-panel">${(lines.length?lines:['Respiration lente','Ambiance calme','Retour au corps']).map((l,i)=>`<div><b>${i+1}</b><span>${safe(l)}</span></div>`).join('')}</div>
      ${url?`<a class="imm-recipe-file-link" href="${safe(url)}" target="_blank" rel="noopener">🎶 Ouvrir la playlist →</a>`:''}</div>`;
  }


  function mtTrackContentOpen(content, protocolId){
    try{
      const raw = localStorage.getItem('mt_library_recent_opens');
      const list = raw ? JSON.parse(raw) : [];
      const item = {
        id: content?.id || content?.recipe_id || `${protocolId || 'content'}-${Date.now()}`,
        title: content?.title || 'Contenu privé',
        type: content?.type || 'document',
        description: content?.description || content?.content_text || content?.subtitle || '',
        protocol_id: protocolId || content?.protocol_id || '',
        opened_at: new Date().toISOString()
      };
      localStorage.setItem('mt_last_content_opened', JSON.stringify(item));
      const next = [item, ...list.filter(x => x.id !== item.id)].slice(0, 20);
      localStorage.setItem('mt_library_recent_opens', JSON.stringify(next));

      const counts = JSON.parse(localStorage.getItem('mt_library_use_counts') || '{}');
      counts[item.id] = (Number(counts[item.id]) || 0) + 1;
      localStorage.setItem('mt_library_use_counts', JSON.stringify(counts));
    }catch(e){}
  }

  window.openPremiumContent = async function(content, protocolId){
    if(typeof content === 'string'){
      try{ content = JSON.parse(decodeURIComponent(content)); }catch(e){ content = {title:'Contenu',type:'document',public_url:content}; }
    }
    mtTrackContentOpen(content, protocolId);
    const t = String(content.type || 'document').toLowerCase();
    const m = meta(t);
    const url = await signedContent(content);
    let body='';

    if(t === 'recette' || t === 'recipe'){
      body = renderImmersiveRecette(content, url || content.public_url || null);

    } else if(t === 'audio'){
      // Audio immersif validé : inchangé
      body = renderImmersiveAudio(content, url || content.audio_url || content.public_url);

    } else if(t === 'checklist'){
      body = await mtRenderPremiumChecklist(content, protocolId);

    } else if(mtLooksLikePrivateJournal(content)){
      body = mtRenderPrivateJournalContent(content, protocolId);

    } else if(t === 'routine'){
      body = mtRenderEditorial(content, url, {kind:'routine', fallbackTitle:'Rituel guidé', mode:'steps', desc:'Un geste simple, posé, pour avancer sans forcer.', fileLabel:'Support du rituel'});

    } else if(t === 'guide_plantes'){
      body = mtRenderEditorial(content, url, {kind:'guide', fallbackTitle:'Notes botaniques', desc:'Une lecture végétale douce pour accompagner ton terrain.', fileLabel:'Fiche plante'});

    } else if(['tracker','suivi','tableau'].includes(t)){
      body = mtRenderPremiumTracker(content, url, protocolId);

    } else if(['calendar','calendrier'].includes(t)){
      body = mtRenderEditorial(content, url, {kind:'calendar', fallbackTitle:'Calendrier du rituel', mode:'steps', desc:'Les repères du parcours, jour après jour.', fileLabel:'Calendrier joint'});

    } else if(t === 'playlist'){
      body = mtRenderPremiumPlaylist(content, url || content.public_url || content.video_url || content.embed_url);

    } else if(t === 'video'){
      body = `<div class="imm-recipe imm-editorial imm-editorial--video">${mtEditorialHeader(content,'Une vidéo privée pour t’accompagner dans le rituel.')}${url || content.video_url || content.embed_url ? `<iframe class="immersive-video" src="${safe(embedUrl(url || content.video_url || content.embed_url))}" allowfullscreen></iframe>`:''}${(content.content_text||'').trim()?`<div class="imm-recipe-section"><h4 class="imm-recipe-section-title">Notes</h4><div class="immersive-text"><p>${safe(content.content_text)}</p></div></div>`:''}</div>`;

    } else if(['pdf','document','ebook','private_doc','photo','fichier'].includes(t)){
      const isImage = /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(url || '');
      const fileBlock = url ? (isImage
        ? `<img class="imm-recipe-img imm-editorial-img" src="${safe(url)}" alt="">`
        : `<div class="imm-recipe-pdf-wrap"><iframe class="immersive-frame" src="${safe(url)}"></iframe></div>`) : '';
      body = `<div class="imm-recipe imm-editorial imm-editorial--file">${mtEditorialHeader(content,'Document privé à consulter dans ton espace.')}${fileBlock}${(content.content_text||'').trim()?mtRenderEditorial({...content, description:'', content_text:content.content_text}, null, {fallbackTitle:'Notes', kind:'file-notes'}):''}</div>`;

    } else {
      body = mtRenderEditorial(content, url, {kind:'generic', fallbackTitle:m.label || 'Contenu', fileLabel:'Fichier joint'});
    }

    const overlay=document.createElement('div'); overlay.className='immersive-overlay';
    overlay.innerHTML = `<section class="immersive-sheet"><div class="immersive-handle"></div><header class="immersive-head"><div><small>${safe(m.label)}</small><h2>${safe(content.title||'Contenu premium')}</h2></div><button class="immersive-close" onclick="this.closest('.immersive-overlay').remove()">×</button></header><div class="immersive-body">${body}<div class="viewer-actions">${url?`<a href="${safe(url)}" target="_blank" rel="noopener">Télécharger</a>`:''}<button class="primary" onclick="window.mtMarkContentDone('${safe(content.id)}','${safe(protocolId)}')">Marquer comme fait</button></div></div></section>`;
    document.body.appendChild(overlay); requestAnimationFrame(()=>overlay.classList.add('open'));
  };
  window.mtSaveChecklistItem = saveChecklist;
  window.mtMarkContentDone = async function(contentId, protocolId){
    const client=initSupabase&&initSupabase(); const user=await mtGetUser(); if(!client||!user) return;
    const {data:p,error}=await client.from('protocol_progress').select('*').eq('user_id',user.id).eq('protocol_id',protocolId).order('updated_at',{ascending:false}).limit(1).maybeSingle();
    if(error){ if(window.mtToast) mtToast(error.message,'error'); return; }
    if(!p) return;
    const arr=Array.isArray(p.completed_content)?p.completed_content:(typeof p.completed_content==='string'?(()=>{try{return JSON.parse(p.completed_content)||[]}catch(_){return []}})():[]);
    if(arr.includes(contentId)){ if(window.mtToast) mtToast('Contenu déjà marqué comme fait'); return; }
    arr.push(contentId);
    const contentXp = 5;
    const newXp = (Number(p.xp)||0) + contentXp;
    const newLevel = mtComputeLevel(newXp);
    await client.from('protocol_progress').update({completed_content:arr, xp:newXp, level_label:newLevel.label}).eq('id',p.id);
    await mtAddGlobalXP(client, user, contentXp);
    if(window.mtToast) mtToast(`+${contentXp} XP`);
  };

  function contentCard(c, protocolId){
    const m=meta(c.type); const encoded=encodeURIComponent(JSON.stringify(c));
    return `<article class="content-card viewer-content-card reveal" onclick="openPremiumContent('${encoded}','${safe(protocolId)}')"><span>${m.emoji}</span><h2>${safe(c.title||'Contenu')}</h2><p>${safe(c.description || c.content_text || '')}</p><div class="content-badges">${c.day_number?`<em class="content-badge">Jour ${c.day_number}</em>`:''}<em class="content-badge">${safe(m.label)}</em>${c.is_preview?`<em class="content-badge">Aperçu</em>`:''}</div><div class="content-open-pill">Ouvrir dans l’app →</div></article>`;
  }
  function renderProgress(protocol, progress){
    const total = Number(progress?.total_days || protocol.total_days || String(protocol.duration_label||'').match(/\d+/)?.[0] || 21);
    const day = Math.min(Number(progress?.current_day || 1), total);
    const pct = Math.min(100, Math.round(((day-1)/Math.max(total,1))*100));
    const doneDays = mtNormalizeCompletedDays(progress?.completed_days);
    const validatedToday = doneDays.includes(todayKey());
    const days = Array.from({length:Math.min(total,31)},(_,i)=>i+1).map(n=>`<button class="timeline-day ${n<day?'done':''} ${n===day?'active':''}"><b>${n}</b><span>Jour</span></button>`).join('');
    return `<section class="protocol-progress-card reveal visible"><div class="protocol-progress-top"><div><small>Progression privée</small><h2>Jour ${day}/${total}</h2></div><div class="progress-ring-text">${pct}%</div></div><div class="progress-bar"><span style="width:${pct}%"></span></div><div class="protocol-progress-meta"><div><b>${Number(progress?.streak||0)}</b><span>Streak</span></div><div><b>${Number(progress?.xp||0)}</b><span>XP</span></div><div><b>${safe(progress?.level_label||protocol.level_label||'Glow')}</b><span>Niveau</span></div></div><button class="validate-today-btn ${validatedToday?'done':''}" onclick="mtValidateProtocolToday('${safe(protocol.id)}',${total})">${validatedToday?'Validé aujourd’hui':'Valider aujourd’hui'}</button></section><section class="timeline-rail">${days}</section>`;
  }

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

  async function mtApplyAutoDay(protocol, progress){
    if(!progress || !protocol?.id) return progress;
    const client=initSupabase&&initSupabase(); const user=await mtGetUser();
    const total = Number(protocol.total_days || String(protocol.duration_label||'').match(/\d+/)?.[0] || progress.total_days || 1);
    const effectiveDay = mtAutoDayFromTime(progress,total);
    if(Number(progress.current_day||1) < effectiveDay && client && user && progress.id){
      try{
        await client.from('protocol_progress').update({current_day:effectiveDay,total_days:total}).eq('id',progress.id);
        progress.current_day=effectiveDay; progress.total_days=total;
      }catch(e){}
    } else {
      progress.current_day=effectiveDay; progress.total_days=total;
    }
    return progress;
  }

  async function filterUnlockedDayContents(contents, protocolId, admin=false){
    if(admin) return contents || [];
    const client=initSupabase&&initSupabase(); const user=await mtGetUser();
    if(!client||!user||!protocolId) return (contents||[]).filter(c => !Number(c.day_number || 0) || Number(c.day_number || 0) <= 1);

    const {data:progress}=await client
      .from('protocol_progress')
      .select('current_day')
      .eq('user_id',user.id)
      .eq('protocol_id',protocolId)
      .maybeSingle();

    const currentDay = Math.max(1, Number(progress?.current_day || 1));
    return (contents||[]).filter(c => {
      const d = Number(c.day_number || 0);
      return !d || d <= currentDay;
    });
  }

  window.renderProtocolDetail = async function(){
    const el=document.getElementById('protocolDetail'); if(!el) return;
    const user=await mtRequireUser(); if(!user) return;
    const id=getParam('id'); const owned=await fetchOwnedIds(); const protocols=await fetchProtocols();
    const protocol=protocols.find(p=>p.id===id||p.slug===id);
    if(!protocol){el.innerHTML=`<div class="empty-card"><h2>Protocole introuvable</h2></div>`;return;}
    if(!owned.includes(protocol.id)&&!owned.includes(protocol.slug)&&!(typeof mtHasFullPreviewAccess==='function' ? await mtHasFullPreviewAccess() : await mtIsAdmin())){
      el.innerHTML=`<div class="empty-card"><h2>Accès verrouillé</h2><p>Ce protocole se débloque automatiquement après paiement.</p><button class="main-cta" onclick="startPaymentLink('${safe(protocol.id||protocol.slug)}')">Débloquer</button></div>`;return;
    }
    const client=initSupabase(); let contents=[];
    if(client&&protocol.id){const {data}=await client.from('protocol_contents').select('*').eq('protocol_id',protocol.id).eq('active',true).order('sort_order',{ascending:true}); contents=data||[];}
    let progress=await getProtocolProgress(protocol);
    try{
      const u = await mtGetUser();
      if(u) localStorage.setItem(`mt_last_protocol_${u.id}`, JSON.stringify({id: protocol.id || protocol.slug, title: protocol.title, current_day: progress?.current_day || 1, total_days: progress?.total_days || protocol.total_days || 7, opened_at: new Date().toISOString()}));
    }catch(e){}
    progress = await mtApplyAutoDay(protocol, progress);
    contents = await filterUnlockedDayContents(contents, protocol.id, (typeof mtHasFullPreviewAccess === 'function' ? await mtHasFullPreviewAccess() : (typeof mtIsAdmin === 'function' ? await mtIsAdmin() : false)));
    el.innerHTML=`<div class="kicker">Protocole premium</div><h1 class="page-title">${safe(protocol.title)}<br><em>${safe(protocol.duration_label||'Transformation')}</em></h1><p class="lead">${safe(protocol.long_description||protocol.short_description||'')}</p>${renderProgress(protocol,progress)}<section class="content-list">${contents.map(c=>contentCard(c,protocol.id)).join('') || `<article class="content-card"><span>🤍</span><h2>Espace prêt</h2><p>Ajoute depuis l’admin tes PDF, vidéos, audios, recettes, routines, checklists, suivis et calendriers de progression.</p></article>`}${progress && progress.current_day>=progress.total_days && protocol.certificate_enabled?`<div class="certificate-card"><h2>Certificat disponible</h2><p>Bravo. Le protocole est terminé et ton badge de transformation est prêt.</p></div>`:''}</section>`;
    observeReveal();
  };

  
  function mtBiblioTypeKey(type){
    const t = String(type || '').toLowerCase().trim();
    if(['pdf','document','pdf premium','document privé','document prive','fichier téléchargeable','fichier telechargeable'].includes(t)) return 'pdf';
    if(['ebook','e-book'].includes(t)) return 'ebook';
    if(['guide_plantes','guide plantes','guide'].includes(t)) return 'guide_plantes';
    if(['vidéo','video'].includes(t)) return 'video';
    if(t === 'audio') return 'audio';
    if(['recette','recipe'].includes(t)) return 'recette';
    if(['routine','rituel'].includes(t)) return 'routine';
    if(t === 'checklist') return 'checklist';
    if(t === 'tracker') return 'tracker';
    if(['tableau','table'].includes(t)) return 'tableau';
    if(['calendar','calendrier'].includes(t)) return 'calendar';
    if(t === 'playlist') return 'playlist';
    if(t === 'suivi') return 'suivi';
    return t || 'pdf';
  }

  function mtBiblioCats(){
    return ['pdf','ebook','guide_plantes','video','audio','recette','routine','checklist','tracker','tableau','calendar','playlist','suivi'];
  }

  function mtBiblioItemCardHTML(item){
    const type = mtBiblioTypeKey(item.type);
    const m = meta(type);
    const label = safe(m.label || 'Contenu');
    const title = safe(item.title || 'Contenu privé');
    const full = item.description || item.content_text || item.subtitle || '';
    const text = safe(String(full).replace(/\s+/g,' ').slice(0, 145) + (String(full).length > 145 ? '…' : ''));
    const footer = safe(item.duration_label || item.protocols?.title || item.source || 'Accès privé');
    const encoded = encodeURIComponent(JSON.stringify(item));

    return `<article class="saved-editorial-card unlocked-protocol-card" onclick="mtOpenBiblioItem('${encoded}')">
      <div class="saved-editorial-top"><span class="saved-editorial-icon">${mtTypeIcon(m)}</span><small>${label}</small></div>
      <h4>${title}</h4>
      ${text ? `<p>${text}</p>` : ''}
      <div class="saved-editorial-foot"><span>${footer}</span><b>Ouvrir →</b></div>
    </article>`;
  }

  window.mtOpenBiblioItem = function(encodedItem){
    let item = null;
    try{ item = JSON.parse(decodeURIComponent(encodedItem)); }catch(e){ item = null; }
    if(!item) return;

    const drawer = document.getElementById("ritualSignalDrawer");
    if(drawer) drawer.classList.remove("open");

    setTimeout(()=>{
      if(item.recipe_id){
        openRecipeViewer(String(item.recipe_id));
      }else{
        openPremiumContent(encodeURIComponent(JSON.stringify(item)), item.protocol_id || 'club');
      }
    }, 80);
  };

  function mtBiblioShelfHTML(title, intro, items){
    const visible = (items || []).filter(Boolean).slice(0, 4);
    if(!visible.length) return '';
    return `<section class="biblio-smart-shelf reveal">
      <div class="biblio-shelf-kicker">Bibliothèque intelligente</div>
      <h2>${safe(title)}</h2>
      <p>${safe(intro)}</p>
      <div class="biblio-shelf-row">${visible.map(mtBiblioItemCardHTML).join('')}</div>
    </section>`;
  }

  function mtBiblioSmartShelves(all){
    let last = null;
    try{
      const raw = localStorage.getItem('mt_last_content_opened');
      if(raw) last = JSON.parse(raw);
    }catch(e){}
    const routines = all.filter(x => mtBiblioTypeKey(x.type)==='routine');
    const recent = [...all].sort((a,b)=> new Date(b.purchased_at || b.created_at || 0) - new Date(a.purchased_at || a.created_at || 0)).slice(0,4);
    let mostUsed = [];
    try{
      const counts = JSON.parse(localStorage.getItem('mt_library_use_counts') || '{}');
      mostUsed = [...all].sort((a,b)=> (counts[b.id || b.recipe_id] || 0) - (counts[a.id || a.recipe_id] || 0)).filter(x => (counts[x.id || x.recipe_id] || 0) > 0).slice(0,4);
    }catch(e){}

    return `
      ${last ? mtBiblioShelfHTML('Dernier ouvert', 'Reprends le contenu consulté récemment, sans chercher dans toute la bibliothèque.', [last]) : ''}
      ${mtBiblioShelfHTML('Récemment disponibles', 'Les derniers contenus ajoutés à ton espace privé.', recent)}
      ${mtBiblioShelfHTML('Routines favorites', 'Les rituels et routines que tu peux retrouver rapidement.', routines)}
      ${mtBiblioShelfHTML('Les plus utilisés', 'Les contenus que tu ouvres le plus souvent apparaissent ici.', mostUsed)}
    `;
  }

  function mtBiblioSourceKey(item){
    if(item.source === 'Recette favorite') return 'favorites';
    if(item.recipe_id) return 'recipes';
    return String(item.protocol_id || item.protocols?.title || item.source || 'club');
  }

  function mtBiblioSourceTitle(item){
    if(item.source === 'Recette favorite') return 'Favoris recettes';
    if(item.recipe_id) return 'Recettes disponiblees';
    return item.protocols?.title || item.protocol_title || item.source || 'Méthode Tee Club';
  }

  function mtBiblioGroupItems(items){
    const groups = new Map();
    (items || []).forEach(item => {
      const key = mtBiblioSourceKey(item);
      if(!groups.has(key)){
        groups.set(key, { key, title: mtBiblioSourceTitle(item), items: [] });
      }
      groups.get(key).items.push(item);
    });

    return [...groups.values()].sort((a,b)=>{
      if(a.key === 'favorites') return -1;
      if(b.key === 'favorites') return 1;
      return String(a.title).localeCompare(String(b.title), 'fr');
    });
  }

  function mtBiblioGroupedHTML(items){
    const groups = mtBiblioGroupItems(items);
    if(!groups.length) return '';
    return `<div class="biblio-program-groups">${groups.map((g,i)=>`
      <details class="biblio-program-group" ${i===0 ? 'open' : ''}>
        <summary>
          <span>
            <small>${g.key === 'favorites' ? 'Sélection personnelle' : 'Programme'}</small>
            <strong>${safe(g.title)}</strong>
          </span>
          <em>${g.items.length} contenu${g.items.length>1?'s':''}</em>
        </summary>
        <div class="saved-editorial-list biblio-program-list">${g.items.map(mtBiblioItemCardHTML).join('')}</div>
      </details>`).join('')}</div>`;
  }

  window.mtFilterBiblioCategory = function(){
    const input=document.getElementById('biblioCategorySearch');
    const body=document.getElementById('biblioCategoryBody');
    const key=body?.dataset?.key;
    const q=String(input?.value || '').trim().toLowerCase();
    const base=(window.mtBiblioItems || []).filter(item => mtBiblioTypeKey(item.type) === key);
    const items=!q ? base : base.filter(item => {
      const hay=[item.title,item.description,item.content_text,item.subtitle,item.protocols?.title,item.source].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    if(!body) return;
    body.innerHTML = items.length
      ? `<div class="saved-library-head"><div class="saved-library-count">${items.length} contenu${items.length > 1 ? "s" : ""}</div></div>${mtBiblioGroupedHTML(items)}`
      : `<div class="saved-empty"><b>${window.mtIconHTML ? mtIconHTML("sparkle", "empty-icon") : ""}</b><h4>Aucun résultat</h4><p>Essaie un autre mot-clé ou ouvre une autre rubrique.</p></div>`;
  };

  window.mtOpenBiblioCategory = function(key){
    const m = meta(key);
    const items = (window.mtBiblioItems || []).filter(item => mtBiblioTypeKey(item.type) === key);

    let modal = document.getElementById("ritualSignalDrawer");
    if(!modal){
      modal = document.createElement("div");
      modal.id = "ritualSignalDrawer";
      modal.className = "ritual-signal-drawer";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseBiblioCategory()"></div>
      <div class="ritual-signal-sheet saved-sheet saved-library-sheet biblio-premium-sheet">
        <div class="ritual-signal-grip"></div>
        <button class="ritual-signal-close" onclick="mtCloseBiblioCategory()">×</button>
        <div class="ritual-signal-icon">${m.emoji}</div>
        <div class="ritual-signal-kicker">Bibliothèque privée</div>
        <h3>${safe(m.label)}</h3>
        <p class="saved-library-intro">Les contenus disponibles sont maintenant rangés par programme, avec recherche rapide.</p>
        <div class="biblio-premium-search"><input id="biblioCategorySearch" type="search" placeholder="Rechercher dans ${safe(m.label)}…" oninput="mtFilterBiblioCategory()"></div>
        <div id="biblioCategoryBody" data-key="${safe(key)}">
          <div class="saved-empty"><b>${m.emoji}</b><h4>Chargement…</h4><p>On prépare tes contenus.</p></div>
        </div>
      </div>`;

    modal.classList.add("open");

    const body = document.getElementById("biblioCategoryBody");
    if (!body) return;

    body.innerHTML = items.length
      ? `<div class="saved-library-head">
          <div class="saved-library-count">${items.length} contenu${items.length > 1 ? "s" : ""}</div>
        </div>
        ${mtBiblioGroupedHTML(items)}`
      : `<div class="saved-empty"><b>${m.emoji}</b><h4>Aucun contenu</h4><p>Les contenus disponibles apparaîtront ici automatiquement.</p></div>`;
  };

  window.mtCloseBiblioCategory = function(){
    const modal = document.getElementById("ritualSignalDrawer");
    if (modal) modal.classList.remove("open");
  };

  window.renderLibraryPage = async function(){
    if(window.__MT_PREMIUM_LIBRARY_PROMISE__) return window.__MT_PREMIUM_LIBRARY_PROMISE__;
    window.__MT_PREMIUM_LIBRARY_PROMISE__=(async()=>{
    const el=document.getElementById('libraryPage'); if(!el) return;
    const user=await mtRequireUser(); if(!user) return;
    const client=initSupabase();
    const owned=await fetchOwnedIds();
    let contents=[]; let club=[]; let purchasedRecipes=[];

    function mtV18LibraryDurationDays(protocol){
      const fromLabel=String(protocol?.duration_label || protocol?.duration || '').match(/\d+/)?.[0];
      const days=Number(protocol?.total_days || fromLabel || 1);
      return Math.max(1, days || 1);
    }

    function mtV18LibraryCurrentDay(progress, protocol){
      const total=mtV18LibraryDurationDays(protocol);
      if(!progress) return 1;
      const rawStart=progress.started_at || progress.created_at;
      let timeDay=1;
      if(rawStart){
        const start=new Date(rawStart);
        if(!isNaN(start.getTime())){
          const firstUnlock=new Date(start);
          firstUnlock.setDate(firstUnlock.getDate()+1);
          firstUnlock.setHours(7,0,0,0);
          const now=new Date();
          if(now>=firstUnlock){
            const diff=now.getTime()-firstUnlock.getTime();
            timeDay=2+Math.floor(diff/86400000);
          }
        }
      }
      const manualDay=Math.max(1, Number(progress.current_day || 1));
      return Math.max(1, Math.min(total, Math.max(manualDay, timeDay)));
    }

    if(client){
      try{
        const protocols=await fetchProtocols();
        const ownedSet=new Set((owned || []).map(String));

        let progressRows=[];
        try{
          const {data:progressData,error:progressError}=await client
            .from('protocol_progress')
            .select('*')
            .eq('user_id', user.id);
          if(progressError) console.warn('biblio progress fallback error', progressError);
          progressRows=progressData || [];
        }catch(e){ progressRows=[]; }

        const progressIds=new Set((progressRows || []).map(p=>String(p.protocol_id)).filter(Boolean));

        // Biblio ne doit pas lire user_protocols uniquement : certains accès/progressions
        // existent déjà dans protocol_progress (logique utilisée par le parcours).
        // On garde la règle existante, puis on ajoute cette source comme miroir fiable,
        // sans toucher à Stripe, aux paiements, ni au déblocage des jours.
        const ownedProtocols=(protocols || []).filter(p =>
          ownedSet.has(String(p.id)) ||
          ownedSet.has(String(p.slug)) ||
          progressIds.has(String(p.id))
        );

        const protocolIds=[...new Set(ownedProtocols.map(p=>p.id).filter(Boolean).map(String))];
        const protocolById=new Map(ownedProtocols.map(p=>[String(p.id), p]));
        const progressByProtocolId=new Map((progressRows || []).map(p=>[String(p.protocol_id), p]));

        if(protocolIds.length){
          const {data,error}=await client
            .from('protocol_contents')
            .select('*, protocols(title, emoji, category)')
            .in('protocol_id', protocolIds)
            .eq('active', true)
            .order('sort_order', {ascending:true});
          if(error){
            console.warn('biblio protocol_contents error', error);
          }else{
            contents=(data || []).filter(c=>{
              const protocol=protocolById.get(String(c.protocol_id));
              const progress=progressByProtocolId.get(String(c.protocol_id));
              const unlockedDay=mtV18LibraryCurrentDay(progress, protocol);
              const contentDay=Number(c.day_number || 0);
              return !contentDay || contentDay <= unlockedDay;
            });
          }
        }
      }catch(e){ console.warn('biblio progressive read failed', e); }

      try{const {data:clubData}=await client.from('protocol_contents').select('*').eq('access_level','club').eq('active',true).order('created_at',{ascending:false}).limit(12); club=clubData||[];}catch(e){}
      try{
        const email = user.email || '';
        let query = client.from('recipe_purchases').select('recipe_id, purchased_at, recipes(*)').eq('status','active');
        query = email ? query.or(`user_id.eq.${user.id},user_email.eq.${email}`) : query.eq('user_id',user.id);
        const {data:recipeRows}=await query.order('purchased_at',{ascending:false});
        purchasedRecipes=(recipeRows||[]).map(r=>({...(r.recipes||{}), recipe_id:r.recipe_id || r.recipes?.id, purchased_at:r.purchased_at, type:'recette', source:'Recette achetée'})).filter(r=>r.recipe_id);
      }catch(e){}
    }

    const recipeItems = purchasedRecipes.map(r => ({
      ...r,
      id:r.recipe_id,
      recipe_id:r.recipe_id,
      type:'recette',
      title:r.title || 'Recette',
      description:r.description || r.subtitle || 'Recette premium disponiblee.',
      source:'Recette achetée'
    }));

    // Les recettes gratuites mises en favori doivent aussi apparaître dans Biblio > Recette.
    // On réutilise le stockage de favoris existant, sans étendre le cœur aux recettes payantes.
    try{
      const savedLocal = typeof mtReadSavedLocal === 'function' ? mtReadSavedLocal(user.id) : {favorites:[]};
      const already = new Set(recipeItems.map(r=>String(r.recipe_id || r.id)).filter(Boolean));
      (savedLocal.favorites || [])
        .filter(item => item && item.source === 'recipe_favorite' && item.recipe_id)
        .filter(item => !already.has(String(item.recipe_id)))
        .forEach(item => {
          recipeItems.push({
            id:String(item.recipe_id),
            recipe_id:String(item.recipe_id),
            type:'recette',
            title:item.title || 'Recette Méthode Tee',
            description:item.content || 'Recette sauvegardée dans tes favoris.',
            emoji:item.emoji || '🥣',
            saved_at:item.saved_at || item.created_at,
            source:'Recette favorite'
          });
        });
    }catch(e){}

    const all=[...recipeItems,...club,...contents];
    window.mtBiblioItems = all;

    const cats=mtBiblioCats();
    const categoryCards=cats.map(key=>{
      const m=meta(key);
      const count=all.filter(c=>mtBiblioTypeKey(c.type)===key).length;
      return `<article class="library-category reveal" onclick="mtOpenBiblioCategory('${safe(key)}')"><b>${mtTypeIcon(m, "library-category-icon")}</b><h2>${m.label}</h2><p>${count} contenu${count>1?'s':''}</p></article>`;
    }).join('');

    const recipeCards=recipeItems.map(r=>`<article class="content-card reveal recipe-owned-card ${r.source === 'Recette favorite' ? 'recipe-favorite-library-card' : ''}"><span>${window.mtIconHTML ? mtIconHTML("bowl", "recipe-card-icon") : ""}</span><h2>${safe(r.title||'Recette')}</h2><p>${safe(r.description||r.subtitle||'Recette premium disponiblee.')}</p><small>${safe(r.source || 'Recette')}</small><button class="download-link as-button" onclick="openRecipeViewer('${safe(r.recipe_id)}')">Ouvrir la recette</button></article>`).join('');

    el.innerHTML=`<div class="kicker">Bibliothèque privée</div><h1 class="page-title">Club &<br><em>protocoles</em></h1><p class="lead">Tes contenus sont rangés par rubrique. Ouvre une catégorie pour les retrouver par programme, sans liste interminable.</p>${mtBiblioSmartShelves(all)}<section class="library-grid">${categoryCards}</section>${all.length ? `<section class="biblio-premium-note reveal"><h2>Bibliothèque rangée</h2><p>Chaque rubrique s’ouvre en dossiers par protocole ou favoris. Les contenus futurs apparaissent automatiquement au fil des jours disponibles.</p></section>` : `<div class="empty-card"><h2>Aucun protocole disponible</h2><p>Les gros contenus premium apparaîtront ici après achat d’un protocole ou d’une recette.</p></div>`}`;
    el.dataset.mtRendered='1';
    observeReveal();
    })().catch(e=>{ console.warn('stable library render failed', e); }).finally(()=>{ window.__MT_PREMIUM_LIBRARY_PROMISE__=null; });
    return window.__MT_PREMIUM_LIBRARY_PROMISE__;
  };



  /* V116 — Accueil : helpers robustes pour le bloc "Ton rituel du jour".
     Le bloc existait déjà, mais plusieurs helpers appelés ici n'étaient pas
     définis dans cette version, ce qui stoppait l'injection avant affichage. */
  const escapeHTML = safe;

  function mtShortText(str, max=42){
    str = String(str || "").replace(/\s+/g," ").trim();
    return str.length > max ? str.slice(0, Math.max(0,max-1)).trim() + "…" : str;
  }

  function mtNormalizePostType(post){
    const raw = String((post && (post.type || post.category || post.tag || post.kind || post.title || "")) || "").toLowerCase();
    const body = raw.normalize ? raw.normalize("NFD").replace(/[\u0300-\u036f]/g,"") : raw;
    if(/routine|rituel|journal|geste|hydration|eau|fuel|mouvement|sweet/.test(body)) return "routine";
    if(/conseil|tip|astuce|coach|note/.test(body)) return "tip";
    if(/drop|prive|private|exclusif|bonus|secret/.test(body)) return "drop";
    if(/mindset|mood|intention|mental|calme|gratitude/.test(body)) return "mindset";
    if(/recette|recipe/.test(body)) return "recipe";
    return body || "journal";
  }

  function mtSignalFromPost(kind, post, fallback){
    const meta = {
      routine:{ icon:"🌿", iconKey:"routine", label:"Routine active", category:"Bienvenue dans…" },
      tip:{ icon:"✨", iconKey:"sparkle", label:"Conseil privé", category:"Tip" },
      drop:{ icon:"🔒", iconKey:"lock", label:"Drop exclusif", category:"Privé" },
      mindset:{ icon:"☁️", iconKey:"mindset", label:"Mood calme", category:"Mindset" }
    }[kind] || { icon:"✦", label:"Signal", category:"Journal" };
    const has = !!post;
    return {
      kind,
      available: has,
      icon: meta.icon,
      iconKey: meta.iconKey || kind,
      label: meta.label,
      category: has ? (post.type || post.category || meta.category) : meta.category,
      title: has ? (post.title || meta.label) : (fallback?.title || meta.label),
      text: has ? (post.content || post.description || post.subtitle || "") : (fallback?.text || ""),
      post: post || null
    };
  }

  async function getClubProgress(){ return {}; }

  window.mtOpenRitualSignal = function(index){
    const s = (window.MT_RITUAL_SIGNALS || [])[Number(index)];
    if(!s) return;
    try{
      const base = s?.post?.id || s?.post?.created_at || s?.post?.title || s?.title || s?.kind || "signal";
      localStorage.setItem(`mt_ritual_seen_${String(base).replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,80)}`, "1");
      const btn = document.querySelectorAll('.club-v18-tile')[Number(index)];
      if(btn){ btn.classList.remove('is-live'); btn.classList.add('is-read'); }
    }catch(e){}
    if(s.post){
      const id = window.mtPostDomId ? window.mtPostDomId(s.post) : (s.post.id ? `post-${s.post.id}` : "");
      const target = id ? document.getElementById(id) : null;
      if(target){
        target.scrollIntoView({behavior:"smooth", block:"center"});
        target.classList.add("post-highlight");
        setTimeout(()=>target.classList.remove("post-highlight"), 1300);
        return;
      }
    }
    if(window.mtToast) window.mtToast(s.title || "Signal du jour");
  };

  window.mtClubCheckin = async function(kind, value){
    try{
      if(window.mtJournalTrack) await window.mtJournalTrack(kind, value);
      if(window.mtToast) window.mtToast(kind === "water" ? "Hydratation notée" : "Rituel noté");
    }catch(e){ if(window.mtToast) window.mtToast("Rituel noté"); }
  };


  async function mtProtocolRitualBadge(){
    const client = initSupabase && initSupabase();
    const user = await mtGetUser();
    if(!client || !user) return "Aujourd’hui";

    let owned = [];
    try{
      const { data } = await client
        .from("user_protocols")
        .select("protocol_id,status,unlocked,purchased_at")
        .eq("user_id", user.id)
        .order("purchased_at", { ascending:false });
      owned = (data || []).filter(x => x.unlocked !== false && String(x.status || "active") === "active");
    }catch(e){ owned = []; }

    if(!owned.length) return "Aujourd’hui";
    if(owned.length > 1) return `${owned.length} actifs`;

    const protocolId = owned[0].protocol_id;
    try{
      const { data:p } = await client
        .from("protocol_progress")
        .select("current_day,total_days,last_validated_at,updated_at")
        .eq("user_id", user.id)
        .eq("protocol_id", protocolId)
        .maybeSingle();

      const day = Math.max(1, Number(p?.current_day || 1));
      const total = Math.max(day, Number(p?.total_days || 7));
      return `Jour ${day}/${total}`;
    }catch(e){
      return "Jour 1";
    }
  }


  function mtDeduplicateClubPanels(){ return document.getElementById('clubV18Panel'); }

  function mtPlaceClubPanel(panel){ return panel || document.getElementById('clubV18Panel'); }

  async function enhanceClubHome(){
    const hero=$('.home-hero'); const feed=$('#homeFeed');
    const existingPanel = mtDeduplicateClubPanels();
    if(existingPanel){ mtPlaceClubPanel(existingPanel, feed); return; }
    if(window.MT_CLUB_PANEL_BUILDING) return;
    if(!hero) return;
    window.MT_CLUB_PANEL_BUILDING = true;
    const p=await getClubProgress();
    const ritualBadge = await mtProtocolRitualBadge();
    let posts=[];
    try { posts = typeof fetchPosts === "function" ? await fetchPosts(30) : []; } catch(e) { posts = []; }

    const used = new Set();
    function pick(kind){
      const found = posts.find(post => !used.has(post) && mtNormalizePostType(post) === kind);
      if(found) used.add(found);
      return found || null;
    }

    const latestByKind = {
      routine: pick("routine"),
      tip: pick("tip"),
      drop: pick("drop"),
      mindset: pick("mindset")
    };

    // Si une catégorie n’existe pas encore, on prend un post compatible léger pour garder le bloc vivant.
    if(!latestByKind.routine) latestByKind.routine = posts.find(post => !used.has(post) && ["journal","recipe"].includes(mtNormalizePostType(post))) || null;
    if(latestByKind.routine) used.add(latestByKind.routine);

    const signals = [
      mtSignalFromPost("routine", latestByKind.routine, { title:"Un geste simple pour aujourd’hui", text:"Le prochain post routine apparaîtra ici comme un signal doux." }),
      mtSignalFromPost("tip", latestByKind.tip, { title:"Conseil privé à venir", text:"Publie un post de type Conseil ou Tip pour l’afficher ici." }),
      mtSignalFromPost("drop", latestByKind.drop, { title:"Drop exclusif à venir", text:"Les contenus privés du journal seront signalés ici sans alourdir l’accueil." }),
      mtSignalFromPost("mindset", latestByKind.mindset, { title:"Mood du jour", text:"Publie une note Mindset, Mood ou Intention pour nourrir cet espace." })
    ];

    function mtRitualSignalKey(s){
      const base = s?.post?.id || s?.post?.created_at || s?.post?.title || s?.title || s?.kind || "signal";
      return `mt_ritual_seen_${String(base).replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,80)}`;
    }
    signals.forEach(s=>{
      try{ s.seen = !!localStorage.getItem(mtRitualSignalKey(s)); }catch(e){ s.seen = false; }
    });
    window.MT_RITUAL_SIGNALS = signals;

    const panel=document.getElementById('clubV18Panel');
    if(!panel){ window.MT_CLUB_PANEL_BUILDING=false; return; }
    panel.className='club-v18-panel reveal visible club-v18-connected';
    panel.innerHTML=`<div class="club-v18-head">
      <div>
        <div class="club-v18-kicker">Échos du journal</div>
        <h2>Ton espace du jour</h2>
        <p>Les derniers posts importants du journal se glissent ici en signaux courts, sans casser le fil.</p>
      </div>
      <div class="club-streak-pill">Aujourd’hui</div>
    </div>
    <div class="club-v18-grid">
      ${signals.map((s,i)=>`<button class="club-v18-tile ${s.available ? (s.seen ? "is-read" : "is-live") : "is-empty"}" onclick="mtOpenRitualSignal(${i})">
        <b>${window.mtIconHTML ? mtIconHTML(s.iconKey || s.kind || s.icon, "ritual-icon") : s.icon}</b>
        <strong>${escapeHTML(s.label)}</strong>
        <span>${escapeHTML(s.available ? mtShortText(s.title, 26) : s.category)}</span>
      </button>`).join("")}
    </div>
    <div class="club-v18-actions">
      <button onclick="mtClubCheckin('water')">+ Eau</button>
      <button onclick="mtClubCheckin('mood','calme')">Mood calme</button>
      <button onclick="mtClubCheckin('gratitude', prompt('Ta note gratitude ?') || '')">Note gratitude</button>
    </div>`;
    panel.hidden=false;
    panel.removeAttribute('aria-busy');
    window.MT_CLUB_PANEL_BUILDING = false;
  }


  document.addEventListener('DOMContentLoaded',()=>{
    if($('#protocolDetail')) window.renderProtocolDetail();
    if($('#libraryPage')) window.renderLibraryPage();
    if($('#clubV18Panel')) enhanceClubHome();
  });
})();
