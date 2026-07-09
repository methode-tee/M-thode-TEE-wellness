
/* MÉTHODE TEE V14 — Private Club Luxe Layer */
(function(){
  const state={settings:{club_name:'Ton espace Méthode Tee',hero_subtitle:'Journal privé · Nutrition · Plantes · Bien-être',ambiance:'botanical',quote:'Ton corps sait. Accompagne-le.',show_stories:true,show_private_drops:true},member:null,capsules:[],drops:[]};
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const safe=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  function mtPresenceDays(member){
    const raw = member?.created_at || member?.joined_at || member?.inserted_at || member?.updated_at || "";
    const d = raw ? new Date(raw) : null;
    if(!d || Number.isNaN(d.getTime())) return Number(member?.streak || 0);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.max(0, Math.floor((today - start) / 86400000));
  }

  async function fetchSettings(){try{const c=initSupabase&&initSupabase(); if(!c)return state.settings; const {data}=await c.from('club_settings').select('*').limit(1).maybeSingle(); if(data)state.settings={...state.settings,...data};}catch(e){} return state.settings;}
  async function fetchMember(){try{const c=initSupabase&&initSupabase(), u=await mtGetUser(); if(!c||!u){state.member=null;return null;} const {data}=await c.from('member_profiles').select('*').eq('user_id',u.id).maybeSingle(); state.member=data||{points:0,streak:0,badge:''}; if(!state.member.created_at && u.created_at) state.member.created_at=u.created_at;}catch(e){state.member=null} return state.member;}
  function mtHomeLevelFromXP(xp){
    const n=Number(xp||0);
    const levels=[
      {min:0,max:499,label:'Graine',iconKey:'seed'},
      {min:500,max:1499,label:'Pousse',iconKey:'sprout'},
      {min:1500,max:3999,label:'Floraison',iconKey:'flower'},
      {min:4000,max:7999,label:'Racines',iconKey:'tree'},
      {min:8000,max:Infinity,label:'Alchimiste',iconKey:'sparkle'}
    ];
    return levels.find(l=>n>=l.min&&n<=l.max)||levels[0];
  }
  function mtHomeMemberStrip(member){
    if(!member){
      return '<button type="button" class="member-strip member-strip-today is-guest" onclick="window.mtOpenTodaySheet && mtOpenTodaySheet()"><span>'+(window.mtIconHTML ? window.mtIconHTML('lock','member-strip-icon') : '🔒')+'</span><div><strong>Bienvenue</strong><small>Crée ton espace gratuitement</small></div><em>Commencer →</em></button>';
    }
    const xp=Number(member.points||member.xp||0);
    return '<button type="button" class="member-strip member-strip-today" onclick="window.mtOpenTodaySheet && mtOpenTodaySheet()"><span>'+(window.mtIconHTML ? window.mtIconHTML('seed','member-strip-icon') : '🌱')+'</span><div><strong>Aujourd’hui</strong><small>Voir ton rituel du jour</small></div><em>Ouvrir →</em></button>';
  }
  async function fetchCapsules(){
    // V34 — le rail du haut devient les "tips journaliers" publics.
    // Il ne sert plus à dupliquer le journal : il affiche 4 micro-thèmes éditoriaux
    // que tu peux nourrir en publiant un post avec le type correspondant.
    state.capsules=[
      {title:'Hydratation',emoji:'💧',iconKey:'hydration',type:'Hydratation',key:'hydration',accent:'green'},
      {title:'Fuel du jour',emoji:'🥣',iconKey:'fuel',type:'Fuel',key:'fuel',accent:'gold'},
      {title:'Mouvement',emoji:'🚶🏽‍♀️',iconKey:'movement',type:'Mouvement',key:'movement',accent:'soft'},
      {title:'Sweet switch',emoji:'🍫',iconKey:'sweet',type:'Sweet switch',key:'sweet',accent:'dark'}
    ];
    return state.capsules;
  }
  async function fetchDrops(){try{const c=initSupabase&&initSupabase(); if(c){const {data}=await c.from('private_drops').select('*').eq('active',true).order('created_at',{ascending:false}).limit(5); state.drops=data||[];}}catch(e){} return state.drops;}

  function mtDailyKey(post){
    const raw = String((post && (post.type || post.category || post.tag || post.title || "")) || "").toLowerCase();
    const body = raw.normalize ? raw.normalize("NFD").replace(/[\u0300-\u036f]/g,"") : raw;
    if(/hydrat|eau|water/.test(body)) return "hydration";
    if(/fuel|proteine|protein|repas|petit[- ]?dej|breakfast|assiette/.test(body)) return "fuel";
    if(/mouvement|marche|pas|sport|courir|run|walk|training|forme/.test(body)) return "movement";
    if(/sweet|switch|sucre|craving|gourmand|dessert|chocolat|healthy/.test(body)) return "sweet";
    return "";
  }

  function mtDailyShort(str, max=42){
    str = String(str || "").replace(/\s+/g," ").trim();
    return str.length > max ? str.slice(0, max - 1).trim() + "…" : str;
  }

  function mtDailyEnrich(caps, posts){
    const used = new Set();
    return caps.map(cap => {
      const post = (posts || []).find(p => !used.has(p) && mtDailyKey(p) === cap.key);
      if(post) used.add(post);
      return {...cap, post: post || null};
    });
  }

  window.mtOpenDailyCapsule = function(index){
    const cap = (window.MT_DAILY_CAPSULES || [])[Number(index)];
    if(!cap) return;
    let modal = document.getElementById("ritualSignalDrawer");
    if(!modal){
      modal = document.createElement("div");
      modal.id = "ritualSignalDrawer";
      modal.className = "ritual-signal-drawer";
      document.body.appendChild(modal);
    }
    const hasPost = !!cap.post;
    const title = hasPost ? (cap.post.title || cap.title) : cap.title;
    const text = hasPost
      ? mtDailyShort(cap.post.content || cap.post.subtitle || cap.post.description || "Note du jour.", 150)
      : "Ce tip journalier apparaîtra ici dès qu’un post de ce type sera publié dans l’admin.";
    modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseDailyCapsule()"></div>
      <div class="ritual-signal-sheet">
        <div class="ritual-signal-grip"></div>
        <button class="ritual-signal-close" onclick="mtCloseDailyCapsule()">×</button>
        <div class="ritual-signal-icon">${cap.emoji || "✦"}</div>
        <div class="ritual-signal-kicker">${safe(cap.type || "Tip du jour")}</div>
        <h3>${safe(cap.title || "Note du jour")}</h3>
        <h4>${safe(title)}</h4>
        <p>${safe(text)}</p>
        <div class="ritual-signal-actions">
          <button class="ritual-signal-secondary" onclick="mtCloseDailyCapsule()">Fermer</button>
          <button class="ritual-signal-primary" onclick="mtGoToDailyCapsule(${Number(index)})">${hasPost ? "Voir dans le journal" : "À venir"}</button>
        </div>
      </div>`;
    modal.classList.add("open");
  };

  window.mtCloseDailyCapsule = function(){
    const modal = document.getElementById("ritualSignalDrawer");
    if(modal) modal.classList.remove("open");
  };

  window.mtGoToDailyCapsule = function(index){
    const cap = (window.MT_DAILY_CAPSULES || [])[Number(index)];
    if(!cap || !cap.post){
      mtCloseDailyCapsule();
      if(window.mtToast) mtToast("Publie un post de ce type pour nourrir cette capsule.");
      return;
    }
    mtCloseDailyCapsule();
    setTimeout(()=>{
      const id = window.mtPostDomId ? window.mtPostDomId(cap.post) : "";
      const target = id ? document.getElementById(id) : null;
      if(target){
        target.scrollIntoView({behavior:"smooth", block:"center"});
        target.classList.add("post-highlight");
        setTimeout(()=>target.classList.remove("post-highlight"), 1300);
      }
    },180);
  };

  function ambiance(s){if($('#ambianceLayer'))return; let d=document.createElement('div'); d.id='ambianceLayer'; d.className='ambiance-layer ambiance-'+(s.ambiance||'botanical'); d.innerHTML='<div class="orb orb-a"></div><div class="orb orb-b"></div><div class="grain"></div>'; document.body.prepend(d);}
  function loader(){
    // Le loader est normalement déjà présent dans le HTML (premier enfant du
    // body) pour s'afficher dès le tout premier rendu, avant même que ce
    // script ne s'exécute. On le réutilise plutôt que d'en recréer un, pour
    // éviter tout flash de la page réelle avant son apparition.
    let d = document.getElementById('mtBootLoader');
    if(!d){
      d = document.createElement('div');
      d.className = 'luxury-loader';
      d.id = 'mtBootLoader';
      d.innerHTML = '<img src="assets/brand-logo.png"><span>Ouverture du club privé</span>';
      document.body.prepend(d);
    }
    window._mtLoaderEl = d;
    window._mtLoaderDone = false;
    setTimeout(()=>{
      window._mtLoaderDone = true;
      d.classList.add('hide');
      setTimeout(()=>d.remove(), 450);
      document.querySelectorAll('.home-hero').forEach(h=>h.classList.add('mt-hero-ready'));
    }, 1100);
  }
  function transitions(){
    // Fix retour navigateur Safari (bfcache) — écran blanc
    window.addEventListener('pageshow', e => {
      if (e.persisted) {
        // Page restaurée depuis le cache Safari → on force un reload propre
        document.body.classList.remove('page-leaving');
        document.body.classList.add('page-entered');
        // Le loader peut avoir un setTimeout en pause depuis avant la mise
        // en cache : on le neutralise et on retire le loader tout de suite
        // pour éviter qu'il ne réapparaisse/disparaisse brusquement plus tard.
        window._mtLoaderDone = true;
        if (window._mtLoaderEl) {
          window._mtLoaderEl.remove();
          window._mtLoaderEl = null;
        }
      }
    });
    document.body.classList.add('page-entered');
    document.addEventListener('click',e=>{
      let a=e.target.closest('a[href]');
      if(!a)return;
      let h=a.getAttribute('href');
      if(!h||h.startsWith('http')||h.startsWith('#')||a.target==='_blank')return;
      // Navigation directe : pas de fade-out, pour éviter le flash noir iOS/Capacitor
      // entre deux fichiers HTML.
      e.preventDefault();
      location.href = h;
    });
  }
  function touch(){document.addEventListener('pointerdown',e=>{let c=e.target.closest('.post-card,.protocol-card,.content-card,.mini-card,.library-category,.main-cta,.navbar a'); if(c)c.classList.add('is-pressing')}); ['pointerup','pointercancel'].forEach(ev=>document.addEventListener(ev,()=>$$('.is-pressing').forEach(x=>x.classList.remove('is-pressing'))));}
  function toasts(){window.mtToast=(m,t='success')=>{let w=$('#toastLayer'); if(!w){w=document.createElement('div'); w.id='toastLayer'; w.className='toast-layer'; document.body.appendChild(w)} let n=document.createElement('div'); n.className='premium-toast '+t; n.innerHTML='<b>'+(t==='error'?'⚠️':'✨')+'</b><span>'+safe(m)+'</span>'; w.appendChild(n); requestAnimationFrame(()=>n.classList.add('show')); setTimeout(()=>{n.classList.remove('show');setTimeout(()=>n.remove(),350)},3200)}}
  async function enhanceHome(){let feed=$('#homeFeed'), hero=$('.home-hero'); if(!feed&&!hero)return;
    let revealTimer = feed ? setTimeout(()=>feed.classList.add('mt-feed-ready'), 2200) : null;
    let s=await fetchSettings(), m=await fetchMember(), caps=await fetchCapsules(), drops=await fetchDrops(); ambiance(s); if(hero&&!$('#clubIntro')){let x=document.createElement('section'); x.id='clubIntro'; x.className='club-intro reveal visible'; const clubName=/^méthode tee club$/i.test(String(s.club_name||'').trim())?'Ton espace Méthode Tee':(s.club_name||'Ton espace Méthode Tee'); x.innerHTML='<div class="club-eyebrow">'+safe(clubName)+'</div><h2>'+safe(s.quote)+'</h2><p>'+safe(s.hero_subtitle)+'</p>'+mtHomeMemberStrip(m); hero.appendChild(x);
      if(window._mtLoaderDone){hero.classList.add('mt-hero-ready');}else{const t=setInterval(()=>{if(window._mtLoaderDone){clearInterval(t);hero.classList.add('mt-hero-ready');}},30);setTimeout(()=>{clearInterval(t);hero.classList.add('mt-hero-ready');},1300);}
    } else if(hero){hero.classList.add('mt-hero-ready');} if(s.show_stories&&feed&&!$('#storyRail')){let r=document.createElement('section'); r.id='storyRail'; r.className='story-rail reveal visible'; let posts=[]; try{posts=typeof fetchPosts==='function'?await fetchPosts(40):[]}catch(e){posts=[]}
      const dailyCaps=mtDailyEnrich(caps,posts); window.MT_DAILY_CAPSULES=dailyCaps;
      r.innerHTML=dailyCaps.map((c,i)=>'<button class="story-bubble accent-'+safe(c.accent||'green')+(c.post?' is-live':'')+'" onclick="mtOpenDailyCapsule('+i+')"><span>'+(window.mtIconHTML ? window.mtIconHTML(c.iconKey||c.key||c.type||'sparkle','story-icon') : safe(c.emoji||'✦'))+'</span><b>'+safe(c.title)+'</b><small>'+safe(c.post?mtDailyShort(c.post.title||c.type,18):(c.type||'Tip du jour'))+'</small></button>').join(''); feed.parentNode.insertBefore(r,feed)} if(s.show_private_drops&&drops.length&&feed&&!$('#privateDrops')){let b=document.createElement('section'); b.id='privateDrops'; b.className='private-drops reveal visible'; b.innerHTML='<div class="kicker">Drops privés</div><div class="drop-grid">'+drops.map(d=>'<article class="drop-card"><span>'+(window.mtIconHTML ? window.mtIconHTML(d.iconKey||d.type||"lock","drop-icon") : safe(d.emoji||"✦"))+'</span><h3>'+safe(d.title)+'</h3><p>'+safe(d.description||'')+'</p>'+(d.url?'<a href="'+safe(d.url)+'" target="_blank">Ouvrir</a>':'')+'</article>').join('')+'</div>'; feed.parentNode.insertBefore(b,feed)} if(feed){clearTimeout(revealTimer); feed.classList.add('mt-feed-ready');}}
  function posts(){ $$('.post-card').forEach((c,i)=>{if(c.dataset.v14)return; c.dataset.v14='1'; c.style.setProperty('--delay',Math.min(i*60,420)+'ms'); if(!c.querySelector('.post-actions')){let a=document.createElement('div'); a.className='post-actions'; a.innerHTML='<button class="save-favorite-btn" onclick="mtTogglePostSave(\'favorite\', this)">♡ Favori</button><button class="save-routine-btn" onclick="mtTogglePostSave(\'routine\', this)">＋ Routine</button>'; c.appendChild(a)}}); if(window.mtRefreshSavedButtons) window.mtRefreshSavedButtons();}

  window.mtRefreshSavedButtons = async function(){
    try{
      const user = await (window.mtGetUser ? mtGetUser() : null);
      if(!user) return;
      const raw = localStorage.getItem(`mt_saved_space_${user.id}`);
      const saved = raw ? JSON.parse(raw) : {favorites:[], routines:[]};
      const favIds = new Set((saved.favorites||[]).map(x=>x.id));
      const routineIds = new Set((saved.routines||[]).map(x=>x.id));
      $$('.post-card').forEach(card=>{
        const id = card.dataset.postId || card.id;
        const fav = card.querySelector('.save-favorite-btn');
        const routine = card.querySelector('.save-routine-btn');
        if(fav){ fav.classList.toggle('is-saved', favIds.has(id)); fav.innerHTML = favIds.has(id) ? '♥ Favori' : '♡ Favori'; }
        if(routine){ routine.classList.toggle('is-saved', routineIds.has(id)); routine.innerHTML = routineIds.has(id) ? '✓ Routine' : '＋ Routine'; }
      });
    }catch(e){}
  };
  function observe(){new MutationObserver(()=>posts()).observe(document.body,{childList:true,subtree:true})}
  document.addEventListener('DOMContentLoaded',()=>{loader();transitions();touch();toasts();observe();setTimeout(enhanceHome,0);setTimeout(posts,700)});
})();

(function(){
  const s=document.createElement('style');
  s.textContent=`
  /* ── XP CARD ────────────────────────────────────── */
  .mt-xp-card {
    background: var(--white, #fff);
    border-radius: 20px;
    padding: 20px;
    margin: 0 0 16px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  }
  .mt-xp-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 14px;
  }
  .mt-xp-header small {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gold, #B8924A);
    display: block;
    margin-bottom: 4px;
  }
  .mt-xp-level {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-weight: 500;
    color: var(--sage, #4A5E42);
    margin: 0 0 2px;
  }
  .mt-xp-reward {
    font-size: 11px;
    color: var(--gray, #8A8278);
    margin: 0;
  }
  .mt-xp-score {
    text-align: right;
    background: var(--sage-bg, #EBF0E7);
    border-radius: 12px;
    padding: 10px 14px;
    min-width: 70px;
  }
  .mt-xp-score b {
    font-family: 'Cormorant Garamond', serif;
    font-size: 24px;
    font-weight: 600;
    color: var(--sage, #4A5E42);
    display: block;
    line-height: 1;
  }
  .mt-xp-score span {
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gold, #B8924A);
  }
  .mt-xp-bar-wrap {
    height: 6px;
    background: var(--cream-dk, #EDE8DC);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  .mt-xp-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--sage-lt, #7A8F6F), var(--sage, #4A5E42));
    border-radius: 3px;
    transition: width 0.6s ease;
  }
  .mt-xp-next {
    font-size: 10.5px;
    color: var(--gray, #8A8278);
    margin: 0 0 16px;
  }
  .mt-xp-next b { color: var(--sage, #4A5E42); }
  .mt-xp-levels {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 14px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .xp-level-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 44px;
    opacity: 0.35;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .xp-level-node.active { opacity: 0.75; }
  .xp-level-node.current { opacity: 1; }
  .xp-node-emoji { font-size: 18px; }
  .xp-node-label { font-size: 8px; font-weight: 500; color: var(--sage, #4A5E42); text-align: center; white-space: nowrap; }
  .xp-node-min { font-size: 7px; color: var(--gray, #8A8278); }
  .xp-level-line { flex: 1; height: 1px; background: var(--cream-dk, #EDE8DC); min-width: 8px; }
  .mt-xp-rewards-btn {
    width: 100%;
    background: none;
    border: 1px solid var(--sage, #4A5E42);
    color: var(--sage, #4A5E42);
    border-radius: 50px;
    padding: 10px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.05em;
    cursor: pointer;
  }

  /* ── REWARDS MODAL ──────────────────────────────── */
  .mt-rewards-modal {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 9999;
    display: flex;
    align-items: flex-end;
    animation: fadeIn 0.2s ease;
  }
  .mt-rewards-inner {
    background: var(--cream, #F4F0E7);
    border-radius: 24px 24px 0 0;
    padding: 24px 20px 40px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
  }
  .mt-rewards-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .mt-rewards-header h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    color: var(--sage, #4A5E42);
  }
  .mt-rewards-header button {
    background: var(--cream-dk, #EDE8DC);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    font-size: 14px;
    cursor: pointer;
  }
  .mt-rewards-sub {
    font-size: 11px;
    color: var(--gray, #8A8278);
    margin-bottom: 16px;
    line-height: 1.5;
  }
  .reward-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 12px;
    margin-bottom: 8px;
    background: white;
  }
  .reward-row.locked { opacity: 0.5; }
  .reward-emoji { font-size: 22px; flex-shrink: 0; }
  .reward-info { flex: 1; }
  .reward-info b { font-size: 13px; color: var(--dark, #2C2C2C); display: block; margin-bottom: 2px; }
  .reward-info span { font-size: 11px; color: var(--gray, #8A8278); display: block; }
  .reward-info em { font-size: 10px; color: var(--gray, #8A8278); font-style: normal; }
  .reward-done { color: var(--sage, #4A5E42) !important; font-weight: 500; }
  .reward-xp { font-size: 11px; font-weight: 600; color: var(--gold, #B8924A); white-space: nowrap; }
  .mt-rewards-gain {
    margin-top: 16px;
    background: white;
    border-radius: 12px;
    padding: 14px;
  }
  .mt-rewards-gain small {
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gold, #B8924A);
    display: block;
    margin-bottom: 10px;
  }
  .gain-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 0;
    border-bottom: 0.5px solid var(--cream-dk, #EDE8DC);
    font-size: 11px;
  }
  .gain-row:last-child { border-bottom: none; }
  .gain-row b { color: var(--sage, #4A5E42); font-weight: 600; }
  /* ─────────────────────────────────────────────── */
`;
  document.head.appendChild(s);
})();
