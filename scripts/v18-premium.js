
/* =========================================================
   MÉTHODE TEE V18 — Club + Protocoles premium
   Base V17b conservée : navbar/topbar/déblocage intactes.
   ========================================================= */
(function(){
  const safe = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

  const TYPE_META = {
    pdf:{emoji:'📄',label:'PDF premium'}, document:{emoji:'📄',label:'Document'}, ebook:{emoji:'📚',label:'Ebook'}, guide_plantes:{emoji:'🌿',label:'Guide plantes'},
    video:{emoji:'🎥',label:'Vidéo'}, audio:{emoji:'🎧',label:'Audio'}, recette:{emoji:'🥣',label:'Recette'}, routine:{emoji:'🌙',label:'Routine'},
    checklist:{emoji:'✅',label:'Checklist'}, tracker:{emoji:'📊',label:'Tracker'}, tableau:{emoji:'📋',label:'Tableau'}, calendar:{emoji:'🗓️',label:'Calendrier'}, calendrier:{emoji:'🗓️',label:'Calendrier'}, playlist:{emoji:'🎶',label:'Playlist'}, suivi:{emoji:'📈',label:'Suivi'}, photo:{emoji:'🖼️',label:'Photo'}, private_doc:{emoji:'🔒',label:'Document privé'}
  };
  function meta(type){return TYPE_META[String(type||'document').toLowerCase()] || TYPE_META.document;}

  function mtLibNormalizeType(v) {
    const t = String(v || '').toLowerCase().trim();
    if(['pdf','pdf premium','document','fichier téléchargeable','fichier telechargeable'].includes(t)) return 'pdf';
    if(['ebook','e-book'].includes(t)) return 'ebook';
    if(['guide_plantes','guide plantes','guide'].includes(t)) return 'guide_plantes';
    if(['vidéo','video'].includes(t)) return 'video';
    if(['audio'].includes(t)) return 'audio';
    if(['recette','recipe'].includes(t)) return 'recette';
    if(['routine','rituel'].includes(t)) return 'routine';
    if(['checklist'].includes(t)) return 'checklist';
    if(['tracker'].includes(t)) return 'tracker';
    if(['tableau','table'].includes(t)) return 'tableau';
    if(['calendar','calendrier'].includes(t)) return 'calendar';
    if(['playlist'].includes(t)) return 'playlist';
    if(['suivi'].includes(t)) return 'suivi';
    return t || 'pdf';
  }

  function mtLibCategories() {
    return ['pdf','ebook','guide_plantes','video','audio','recette','routine','checklist','tracker','tableau','calendar','playlist','suivi'];
  }

  function mtLibWordsFor(key) {
    const map = {
      pdf:['pdf','document','fichier','téléchargeable','telechargeable'],
      ebook:['ebook','e-book','livre'],
      guide_plantes:['guide','plantes','phytothérapie','phytotherapie','herboristerie','pharmacopée'],
      video:['video','vidéo','film','mini vidéo'],
      audio:['audio','écoute','ecoute','motivation'],
      recette:['recette','recipe'],
      routine:['routine','rituel'],
      checklist:['checklist','liste'],
      tracker:['tracker','suivi','progression'],
      tableau:['tableau','table'],
      calendar:['calendar','calendrier'],
      playlist:['playlist','musique'],
      suivi:['suivi','tracking']
    };
    return map[key] || [key];
  }

  function mtLibMatchesCategory(item, key) {
    const type = mtLibNormalizeType(item.type);
    if(type === key) return true;
    const text = [item.type,item.title,item.description,item.content_text,item.protocols?.title,item.category,item.subtitle]
      .filter(Boolean).join(' ').toLowerCase();
    return mtLibWordsFor(key).some(w => text.includes(String(w).toLowerCase()));
  }

  function mtLibContentCard(item) {
    const type = mtLibNormalizeType(item.type);
    const m = meta(type);
    const title = safe(item.title || 'Contenu privé');
    const desc = safe(item.description || item.content_text || item.subtitle || '');
    const source = safe(item.protocols?.title || item.source || item.protocol_title || 'Bibliothèque privée');
    const btn = item.recipe_id
      ? `<button class="download-link as-button" onclick="openRecipeViewer('${safe(item.recipe_id)}')">Ouvrir la recette</button>`
      : (item.id ? `<button class="download-link as-button" onclick="openSignedProtocolFile('${safe(item.id)}')">${type==='video'?'Ouvrir la vidéo':'Ouvrir / télécharger'}</button>` : '');
    return `<article class="saved-editorial-card library-editorial-item reveal">
      <div class="saved-editorial-top"><span class="saved-editorial-icon">${m.emoji}</span><small>${safe(m.label)}</small></div>
      <h4>${title}</h4>
      ${desc ? `<p>${desc}</p>` : ''}
      <div class="saved-editorial-foot"><span>${source}</span><b>${btn ? '' : 'Privé'}</b></div>
      ${btn ? `<div class="library-item-action">${btn}</div>` : ''}
    </article>`;
  }

  window.mtOpenLibraryCategory = function(key) {
    const allItems = window.mtLibraryAllItems || [];
    const m = meta(key);
    const items = allItems.filter(item => mtLibMatchesCategory(item, key));

    let modal = document.getElementById('ritualSignalDrawer');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'ritualSignalDrawer';
      modal.className = 'ritual-signal-drawer';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseLibraryCategory()"></div>
      <div class="ritual-signal-sheet saved-sheet saved-library-sheet">
        <div class="ritual-signal-grip"></div>
        <button class="ritual-signal-close" onclick="mtCloseLibraryCategory()">×</button>
        <div class="ritual-signal-icon">${m.emoji}</div>
        <div class="ritual-signal-kicker">Bibliothèque privée</div>
        <h3>${safe(m.label)}</h3>
        <p class="saved-library-intro">Tous les contenus débloqués de cette rubrique, rangés proprement dans ton espace.</p>
        <div class="saved-library-head"><div class="saved-library-count">${items.length} contenu${items.length>1?'s':''}</div></div>
        ${items.length ? `<div class="saved-editorial-list">${items.map(mtLibContentCard).join('')}</div>` : `<div class="saved-empty"><b>${m.emoji}</b><h4>Aucun contenu</h4><p>Les contenus débloqués apparaîtront ici automatiquement.</p></div>`}
      </div>`;
    modal.classList.add('open');
  };

  window.mtCloseLibraryCategory = function(){
    const modal = document.getElementById('ritualSignalDrawer');
    if(modal) modal.classList.remove('open');
  };


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
    let {data,error}=await client.from('protocol_progress').select('*').eq('user_id',user.id).eq('protocol_id',protocol.id).maybeSingle();
    if(!data){
      const total = Number(protocol.total_days || String(protocol.duration_label||'').match(/\d+/)?.[0] || 21);
      const insert={user_id:user.id,protocol_id:protocol.id,current_day:1,total_days:total,streak:0,xp:0,level_label:protocol.level_label||'Exploration'};
      const res=await client.from('protocol_progress').insert(insert).select('*').maybeSingle();
      data=res.data || insert;
    }
    return data;
  }
  async function saveProtocolProgress(progress){
    const client=initSupabase&&initSupabase(); const user=await mtGetUser();
    if(!client||!user||!progress?.protocol_id) return null;
    const {data,error}=await client.from('protocol_progress').upsert(progress,{onConflict:'user_id,protocol_id'}).select('*').maybeSingle();
    if(error){ if(window.mtToast) mtToast(error.message,'error'); return progress; }
    return data;
  }
  function todayKey(){return new Date().toISOString().slice(0,10);}
  window.mtValidateProtocolToday = async function(protocolId,totalDays){
    const client=initSupabase&&initSupabase(); const user=await mtGetUser(); if(!client||!user) return;
    const {data:current}=await client.from('protocol_progress').select('*').eq('user_id',user.id).eq('protocol_id',protocolId).maybeSingle();
    const p=current || {user_id:user.id,protocol_id:protocolId,current_day:1,total_days:totalDays||21,streak:0,completed_days:[],checklist_state:{},completed_content:[]};
    const done = Array.isArray(p.completed_days) ? p.completed_days : [];
    const key=todayKey();
    if(!done.includes(key)) done.push(key);
    p.completed_days=done;
    p.last_validated_at=new Date().toISOString();
    p.streak=(Number(p.streak)||0)+1;
    p.current_day=Math.min(Number(p.current_day||1)+1, Number(p.total_days||totalDays||21));
    p.xp=(Number(p.xp)||0)+10;
    const saved=await saveProtocolProgress(p);
    if(window.mtToast) mtToast('Journée validée 🌿');
    setTimeout(()=>location.reload(),450);
  };

  async function saveChecklist(contentId, protocolId, key, checked){
    const client=initSupabase&&initSupabase(); const user=await mtGetUser(); if(!client||!user) return;
    const {data:p}=await client.from('protocol_progress').select('*').eq('user_id',user.id).eq('protocol_id',protocolId).maybeSingle();
    if(!p) return;
    const state = p.checklist_state || {};
    state[contentId] = state[contentId] || {};
    state[contentId][key] = !!checked;
    await client.from('protocol_progress').update({checklist_state:state}).eq('id',p.id);
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
  function mtRenderPremiumTracker(content, fileUrl){
    const lines = mtContentLines(content.content_text || content.description);
    const prompts = lines.length ? lines : ['Énergie du jour', 'Envies ressenties', 'Rituel réalisé', 'Ce que je remarque'];
    return `<div class="imm-recipe imm-editorial imm-editorial--tracker">${mtEditorialHeader(content,'Un espace doux pour observer ton évolution sans pression.')}
      <div class="imm-recipe-section"><h4 class="imm-recipe-section-title">Journal de suivi</h4><div class="imm-tracker-premium">
      ${prompts.map((p,i)=>`<div><span>${String(i+1).padStart(2,'0')}</span><p>${safe(p)}</p></div>`).join('')}
      </div></div>${mtRenderPremiumFile(fileUrl,'Support de suivi')}</div>`;
  }
  function mtRenderPremiumPlaylist(content, url){
    const lines = mtContentLines(content.content_text || content.description);
    return `<div class="imm-recipe imm-editorial imm-editorial--playlist">${mtEditorialHeader(content,'Un moment sonore pour accompagner le rituel.')}
      <div class="imm-playlist-panel">${(lines.length?lines:['Respiration lente','Ambiance calme','Retour au corps']).map((l,i)=>`<div><b>${i+1}</b><span>${safe(l)}</span></div>`).join('')}</div>
      ${url?`<a class="imm-recipe-file-link" href="${safe(url)}" target="_blank" rel="noopener">🎶 Ouvrir la playlist →</a>`:''}</div>`;
  }

  window.openPremiumContent = async function(content, protocolId){
    if(typeof content === 'string'){
      try{ content = JSON.parse(decodeURIComponent(content)); }catch(e){ content = {title:'Contenu',type:'document',public_url:content}; }
    }
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

    } else if(t === 'routine'){
      body = mtRenderEditorial(content, url, {kind:'routine', fallbackTitle:'Rituel guidé', mode:'steps', desc:'Un geste simple, posé, pour avancer sans forcer.', fileLabel:'Support du rituel'});

    } else if(t === 'guide_plantes'){
      body = mtRenderEditorial(content, url, {kind:'guide', fallbackTitle:'Notes botaniques', desc:'Une lecture végétale douce pour accompagner ton terrain.', fileLabel:'Fiche plante'});

    } else if(['tracker','suivi','tableau'].includes(t)){
      body = mtRenderPremiumTracker(content, url);

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
    const {data:p}=await client.from('protocol_progress').select('*').eq('user_id',user.id).eq('protocol_id',protocolId).maybeSingle(); if(!p) return;
    const arr=Array.isArray(p.completed_content)?p.completed_content:[]; if(!arr.includes(contentId)) arr.push(contentId);
    await client.from('protocol_progress').update({completed_content:arr,xp:(Number(p.xp)||0)+5}).eq('id',p.id);
    if(window.mtToast) mtToast('Contenu validé ✨');
  };

  function contentCard(c, protocolId){
    const m=meta(c.type); const encoded=encodeURIComponent(JSON.stringify(c));
    return `<article class="content-card viewer-content-card reveal" onclick="openPremiumContent('${encoded}','${safe(protocolId)}')"><span>${m.emoji}</span><h2>${safe(c.title||'Contenu')}</h2><p>${safe(c.description || c.content_text || '')}</p><div class="content-badges">${c.day_number?`<em class="content-badge">Jour ${c.day_number}</em>`:''}<em class="content-badge">${safe(m.label)}</em>${c.is_preview?`<em class="content-badge">Aperçu</em>`:''}</div><div class="content-open-pill">Ouvrir dans l’app →</div></article>`;
  }
  function renderProgress(protocol, progress){
    const total = Number(progress?.total_days || protocol.total_days || String(protocol.duration_label||'').match(/\d+/)?.[0] || 21);
    const day = Math.min(Number(progress?.current_day || 1), total);
    const pct = Math.min(100, Math.round(((day-1)/Math.max(total,1))*100));
    const doneDays = Array.isArray(progress?.completed_days) ? progress.completed_days : [];
    const validatedToday = doneDays.includes(todayKey());
    const days = Array.from({length:Math.min(total,31)},(_,i)=>i+1).map(n=>`<button class="timeline-day ${n<day?'done':''} ${n===day?'active':''}"><b>${n}</b><span>Jour</span></button>`).join('');
    return `<section class="protocol-progress-card reveal visible"><div class="protocol-progress-top"><div><small>Progression privée</small><h2>Jour ${day}/${total}</h2></div><div class="progress-ring-text">${pct}%</div></div><div class="progress-bar"><span style="width:${pct}%"></span></div><div class="protocol-progress-meta"><div><b>${Number(progress?.streak||0)}</b><span>Streak</span></div><div><b>${Number(progress?.xp||0)}</b><span>XP</span></div><div><b>${safe(progress?.level_label||protocol.level_label||'Glow')}</b><span>Niveau</span></div></div><button class="validate-today-btn ${validatedToday?'done':''}" onclick="mtValidateProtocolToday('${safe(protocol.id)}',${total})">${validatedToday?'Validé aujourd’hui':'Valider aujourd’hui'}</button></section><section class="timeline-rail">${days}</section>`;
  }

  function mtAutoDayFromTime(progress, totalDays){
    const total = Math.max(1, Number(totalDays || progress?.total_days || 1));
    const rawStart = progress?.started_at || progress?.created_at || progress?.purchased_at || progress?.updated_at;
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
    if(!owned.includes(protocol.id)&&!owned.includes(protocol.slug)&&!(await mtIsAdmin())){
      el.innerHTML=`<div class="empty-card"><h2>Accès verrouillé</h2><p>Ce protocole se débloque automatiquement après paiement.</p><button class="main-cta" onclick="startPaymentLink('${safe(protocol.id||protocol.slug)}')">Débloquer</button></div>`;return;
    }
    const client=initSupabase(); let contents=[];
    if(client&&protocol.id){const {data}=await client.from('protocol_contents').select('*').eq('protocol_id',protocol.id).eq('active',true).order('sort_order',{ascending:true}); contents=data||[];}
    let progress=await getProtocolProgress(protocol);
    progress = await mtApplyAutoDay(protocol, progress);
    contents = await filterUnlockedDayContents(contents, protocol.id, (typeof mtIsAdmin === 'function' ? await mtIsAdmin() : false));
    el.innerHTML=`<div class="kicker">Protocole premium</div><h1 class="page-title">${safe(protocol.title)}<br><em>${safe(protocol.duration_label||'Transformation')}</em></h1><p class="lead">${safe(protocol.long_description||protocol.short_description||'')}</p>${renderProgress(protocol,progress)}<section class="content-list">${contents.map(c=>contentCard(c,protocol.id)).join('') || `<article class="content-card"><span>🤍</span><h2>Espace prêt</h2><p>Ajoute depuis l’admin tes PDF, vidéos, audios, recettes, routines, checklists, suivis et calendriers de progression.</p></article>`}${progress && progress.current_day>=progress.total_days && protocol.certificate_enabled?`<div class="certificate-card"><h2>Certificat débloqué</h2><p>Bravo. Le protocole est terminé et ton badge de transformation est prêt.</p></div>`:''}</section>`;
    observeReveal();
  };

  window.renderLibraryPage = async function(){
    const el=document.getElementById('libraryPage'); if(!el) return;
    const user=await mtRequireUser(); if(!user) return;
    const owned=await fetchOwnedIds(); const client=initSupabase(); let contents=[]; let club=[]; let purchasedRecipes=[];
    if(client){
      if(owned.length){const {data}=await client.from('protocol_contents').select('*, protocols(title, emoji, category)').in('protocol_id',owned).eq('active',true).order('created_at',{ascending:false}); contents=data||[];}
      try{const {data:clubData}=await client.from('protocol_contents').select('*').eq('access_level','club').eq('active',true).order('created_at',{ascending:false}).limit(12); club=clubData||[];}catch(e){}
      try{const {data:recipeRows}=await client.from('recipe_purchases').select('recipe_id, purchased_at, recipes(*)').eq('user_id',user.id).order('purchased_at',{ascending:false}); purchasedRecipes=(recipeRows||[]).map(r=>({...(r.recipes||{}),purchased_at:r.purchased_at})).filter(r=>r.id);}catch(e){}
    }
    const recipeItems = (purchasedRecipes||[]).map(r=>({id:r.id,recipe_id:r.id,type:'recette',title:r.title||'Recette',description:r.description||r.subtitle||'Recette premium débloquée.',source:'Recette achetée',purchased_at:r.purchased_at,category:r.category||'',subtitle:r.subtitle||''}));
    const all=[...recipeItems,...club,...contents];
    window.mtLibraryAllItems = all;
    const cats=mtLibCategories();
    const categoryCards=cats.map(key=>{
      const m=meta(key);
      const count=all.filter(item=>mtLibMatchesCategory(item,key)).length;
      return `<article class="library-category reveal" onclick="mtOpenLibraryCategory('${safe(key)}')"><b>${m.emoji}</b><h2>${m.label}</h2><p>${count} contenu${count>1?'s':''}</p><span class="library-open-hint">Ouvrir →</span></article>`;
    }).join('');
    const recipeCards=purchasedRecipes.map(r=>`<article class="content-card reveal recipe-owned-card"><span>${safe(r.emoji||'🥣')}</span><h2>${safe(r.title||'Recette')}</h2><p>${safe(r.description||r.subtitle||'Recette premium débloquée.')}</p><small>Recette achetée</small><button class="download-link as-button" onclick="openRecipeViewer('${safe(r.id)}')">Ouvrir la recette</button></article>`).join('');
    el.innerHTML=`<div class="kicker">Bibliothèque privée</div><h1 class="page-title">Club &<br><em>protocoles</em></h1><p class="lead">Les contenus Club 5€ donnent accès à l’univers. Les protocoles premium débloquent les transformations complètes.</p><section class="library-grid">${categoryCards}</section><section class="content-list">${recipeCards}${club.map(c=>contentCard({...c,is_preview:true},c.protocol_id||'club')).join('')}${contents.map(c=>contentCard(c,c.protocol_id)).join('') || (club.length || recipeCards?'':`<div class="empty-card"><h2>Aucun protocole débloqué</h2><p>Les gros contenus premium apparaîtront ici après achat d’un protocole ou d’une recette.</p></div>`)}</section>`;
    observeReveal();
  };

  async function getClubProgress(){
    const client=initSupabase&&initSupabase(); const user=await mtGetUser(); if(!client||!user) return {club_streak:0,xp:0};
    let {data}=await client.from('club_progress').select('*').eq('user_id',user.id).maybeSingle();
    if(!data){const res=await client.from('club_progress').insert({user_id:user.id,club_streak:0,xp:0}).select('*').maybeSingle(); data=res.data||{club_streak:0,xp:0};}
    return data;
  }
  window.mtClubCheckin = async function(kind,value){
    const client=initSupabase&&initSupabase(); const user=await mtGetUser(); if(!client||!user) return;
    const p=await getClubProgress(); const today=todayKey(); const wasToday = p.last_checkin_at && String(p.last_checkin_at).slice(0,10)===today;
    const update={user_id:user.id,last_checkin_at:new Date().toISOString(),club_streak:wasToday?Number(p.club_streak||0):Number(p.club_streak||0)+1,xp:Number(p.xp||0)+3};
    if(kind==='mood') update.mood=value; if(kind==='water') update.water_count=Number(p.water_count||0)+1; if(kind==='gratitude') update.gratitude_note=value;
    await client.from('club_progress').upsert(update,{onConflict:'user_id'});
    if(window.mtToast) mtToast('Club actualisé 🌿');
  };

  function mtNormalizePostType(post){
    const raw = String((post && (post.type || post.category || post.tag || "")) || "").toLowerCase();
    const title = String((post && post.title) || "").toLowerCase();
    const body = `${raw} ${title}`;
    if(/hydrat|eau|water|fuel|proteine|protein|mouvement|marche|pas|sport|courir|sweet|switch|craving/.test(body)) return "daily";
    if(/audio|écouter|ecouter|son|respiration/.test(body)) return "audio";
    if(/routine|rituel|checklist|jour/.test(body)) return "routine";
    if(/tip|conseil|astuce|note/.test(body)) return "tip";
    if(/drop|exclusif|privé|prive|premium|club/.test(body)) return "drop";
    if(/mindset|mood|pensée|pensee|intention|calme/.test(body)) return "mindset";
    if(/recette|latte|matcha|gourmand|boisson/.test(body)) return "recipe";
    return "journal";
  }

  function mtShortText(str, max=86){
    str = String(str || "").replace(/\s+/g," ").trim();
    return str.length > max ? str.slice(0, max - 1).trim() + "…" : str;
  }

  function mtSignalFromPost(kind, post, fallback){
    const meta = {
      routine: { icon:"🌿", label:"Routine active", category:"Routine" },
      audio: { icon:"🎧", label:"Audio disponible", category:"Audio" },
      tip: { icon:"✨", label:"Conseil privé", category:"Tip" },
      drop: { icon:"🔒", label:"Drop exclusif", category:"Privé" },
      mindset: { icon:"☁️", label:"Mood calme", category:"Mindset" },
      recipe: { icon:"🍵", label:"Pause gourmande", category:"Recette" },
      journal: { icon:"✦", label:"Note du jour", category:"Journal" },
    }[kind] || { icon:"✦", label:"Signal du jour", category:"Journal" };

    const hasPost = !!post;
    return {
      kind,
      icon: meta.icon,
      label: meta.label,
      category: meta.category,
      title: hasPost ? (post.title || meta.label) : fallback.title,
      text: hasPost ? mtShortText(post.content || post.subtitle || post.description || fallback.text, 118) : fallback.text,
      postId: hasPost && window.mtPostDomId ? window.mtPostDomId(post) : "",
      cta: hasPost ? "Voir dans le journal" : "À venir",
      available: hasPost
    };
  }

  window.mtOpenRitualSignal = function(index){
    const signal = (window.MT_RITUAL_SIGNALS || [])[Number(index)];
    if(!signal) return;
    let modal = document.getElementById("ritualSignalDrawer");
    if(!modal){
      modal = document.createElement("div");
      modal.id = "ritualSignalDrawer";
      modal.className = "ritual-signal-drawer";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseRitualSignal()"></div>
      <div class="ritual-signal-sheet">
        <div class="ritual-signal-grip"></div>
        <button class="ritual-signal-close" onclick="mtCloseRitualSignal()">×</button>
        <div class="ritual-signal-icon">${signal.icon}</div>
        <div class="ritual-signal-kicker">${signal.category}</div>
        <h3>${escapeHTML(signal.label)}</h3>
        <h4>${escapeHTML(signal.title)}</h4>
        <p>${escapeHTML(signal.text || "Un contenu doux t’attend dans ton journal privé.")}</p>
        <div class="ritual-signal-actions">
          <button class="ritual-signal-secondary" onclick="mtCloseRitualSignal()">Fermer</button>
          <button class="ritual-signal-primary" onclick="mtGoToRitualPost(${Number(index)})">${signal.cta}</button>
        </div>
      </div>`;
    modal.classList.add("open");
  };

  window.mtCloseRitualSignal = function(){
    const modal = document.getElementById("ritualSignalDrawer");
    if(modal) modal.classList.remove("open");
  };

  window.mtGoToRitualPost = function(index){
    const signal = (window.MT_RITUAL_SIGNALS || [])[Number(index)];
    if(!signal || !signal.postId){
      mtCloseRitualSignal();
      if(window.mtToast) mtToast("Ce contenu sera relié au prochain post publié.");
      return;
    }
    mtCloseRitualSignal();
    setTimeout(()=>{
      const target = document.getElementById(signal.postId);
      if(target){
        target.scrollIntoView({behavior:"smooth", block:"center"});
        target.classList.add("post-highlight");
        setTimeout(()=>target.classList.remove("post-highlight"), 1300);
      }
    }, 180);
  };

  async function enhanceClubHome(){
    const hero=$('.home-hero'); const feed=$('#homeFeed'); if(!hero || $('#clubV18Panel')) return;
    const p=await getClubProgress();
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

    window.MT_RITUAL_SIGNALS = signals;

    const panel=document.createElement('section'); panel.id='clubV18Panel'; panel.className='club-v18-panel reveal visible club-v18-connected';
    panel.innerHTML=`<div class="club-v18-head">
      <div>
        <div class="club-v18-kicker">Échos du journal</div>
        <h2>Ton rituel du jour</h2>
        <p>Les derniers posts importants du journal se glissent ici en signaux courts, sans casser le fil.</p>
      </div>
      <div class="club-streak-pill">${Number(p.club_streak||0)} jours</div>
    </div>
    <div class="club-v18-grid">
      ${signals.map((s,i)=>`<button class="club-v18-tile ${s.available ? "is-live" : "is-empty"}" onclick="mtOpenRitualSignal(${i})">
        <b>${s.icon}</b>
        <strong>${escapeHTML(s.label)}</strong>
        <span>${escapeHTML(s.available ? mtShortText(s.title, 26) : s.category)}</span>
      </button>`).join("")}
    </div>
    <div class="club-v18-actions">
      <button onclick="mtClubCheckin('water')">+ Eau</button>
      <button onclick="mtClubCheckin('mood','calme')">Mood calme</button>
      <button onclick="mtClubCheckin('gratitude', prompt('Ta note gratitude ?') || '')">Note gratitude</button>
    </div>`;
    if(feed) feed.parentNode.insertBefore(panel,feed); else hero.appendChild(panel);
  }


  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(()=>{enhanceClubHome();},900);
    setTimeout(()=>{ if($('#protocolDetail')) window.renderProtocolDetail(); if($('#libraryPage')) window.renderLibraryPage(); },250);
  });
})();
