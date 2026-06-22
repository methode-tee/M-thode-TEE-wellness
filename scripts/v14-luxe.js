
/* MÉTHODE TEE V14 — Private Club Luxe Layer */
(function(){
  const state={settings:{club_name:'Méthode Tee Club',hero_subtitle:'Journal privé · Nutrition · Plantes · Bien-être',ambiance:'botanical',quote:'Ton corps sait. Accompagne-le.',show_stories:true,show_private_drops:true},member:null,capsules:[],drops:[]};
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
  async function fetchMember(){try{const c=initSupabase&&initSupabase(), u=await mtGetUser(); if(!c||!u)return null; const {data}=await c.from('member_profiles').select('*').eq('user_id',u.id).maybeSingle(); state.member=data||{level:'Green',points:0,streak:0,badge:'🌿'}; if(!state.member.created_at && u.created_at) state.member.created_at=u.created_at;}catch(e){state.member={level:'Green',points:0,streak:0,badge:'🌿'}} return state.member;}
  async function fetchCapsules(){
    // V34 — le rail du haut devient les "tips journaliers" publics.
    // Il ne sert plus à dupliquer le journal : il affiche 4 micro-thèmes éditoriaux
    // que tu peux nourrir en publiant un post avec le type correspondant.
    state.capsules=[
      {title:'Hydratation',emoji:'💧',type:'Hydratation',key:'hydration',accent:'green'},
      {title:'Fuel du jour',emoji:'🥣',type:'Fuel',key:'fuel',accent:'gold'},
      {title:'Mouvement',emoji:'🚶🏽‍♀️',type:'Mouvement',key:'movement',accent:'soft'},
      {title:'Sweet switch',emoji:'🍫',type:'Sweet switch',key:'sweet',accent:'dark'}
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
  function loader(){let d=document.createElement('div'); d.className='luxury-loader'; d.innerHTML='<img src="assets/brand-logo.png"><span>Ouverture du club privé</span>'; document.body.appendChild(d); setTimeout(()=>d.classList.add('hide'),650); setTimeout(()=>d.remove(),1100)}
  function transitions(){
    // Fix retour navigateur Safari (bfcache) — écran blanc
    window.addEventListener('pageshow', e => {
      if (e.persisted) {
        // Page restaurée depuis le cache Safari → on force un reload propre
        document.body.classList.remove('page-leaving');
        document.body.classList.add('page-entered');
      }
    });
    document.body.classList.add('page-entered');
    document.addEventListener('click',e=>{
      let a=e.target.closest('a[href]');
      if(!a)return;
      let h=a.getAttribute('href');
      if(!h||h.startsWith('http')||h.startsWith('#')||a.target==='_blank')return;
      e.preventDefault();
      document.body.classList.add('page-leaving');
      setTimeout(()=>location.href=h,170);
    });
  }
  function touch(){document.addEventListener('pointerdown',e=>{let c=e.target.closest('.post-card,.protocol-card,.content-card,.mini-card,.library-category,.main-cta,.navbar a'); if(c)c.classList.add('is-pressing')}); ['pointerup','pointercancel'].forEach(ev=>document.addEventListener(ev,()=>$$('.is-pressing').forEach(x=>x.classList.remove('is-pressing'))));}
  function toasts(){window.mtToast=(m,t='success')=>{let w=$('#toastLayer'); if(!w){w=document.createElement('div'); w.id='toastLayer'; w.className='toast-layer'; document.body.appendChild(w)} let n=document.createElement('div'); n.className='premium-toast '+t; n.innerHTML='<b>'+(t==='error'?'⚠️':'✨')+'</b><span>'+safe(m)+'</span>'; w.appendChild(n); requestAnimationFrame(()=>n.classList.add('show')); setTimeout(()=>{n.classList.remove('show');setTimeout(()=>n.remove(),350)},3200)}}
  async function enhanceHome(){let feed=$('#homeFeed'), hero=$('.home-hero'); if(!feed&&!hero)return;
    if(hero){hero.style.opacity='0';hero.style.transition='opacity 0.25s ease';}
    let s=await fetchSettings(), m=await fetchMember(), caps=await fetchCapsules(), drops=await fetchDrops(); ambiance(s); if(hero&&!$('#clubIntro')){let x=document.createElement('section'); x.id='clubIntro'; x.className='club-intro reveal visible'; x.innerHTML='<div class="club-eyebrow">'+safe(s.club_name)+'</div><h2>'+safe(s.quote)+'</h2><p>'+safe(s.hero_subtitle)+'</p><div class="member-strip"><span>'+safe(m?.badge||'🌿')+'</span><strong>'+safe(m?.level||'Green')+' Member</strong><em>'+Number(m?.streak||0)+' jours de présence</em></div>'; hero.appendChild(x); requestAnimationFrame(()=>{hero.style.opacity='1';});} else if(hero){hero.style.opacity='1';} if(s.show_stories&&feed&&!$('#storyRail')){let r=document.createElement('section'); r.id='storyRail'; r.className='story-rail reveal visible'; let posts=[]; try{posts=typeof fetchPosts==='function'?await fetchPosts(40):[]}catch(e){posts=[]}
      const dailyCaps=mtDailyEnrich(caps,posts); window.MT_DAILY_CAPSULES=dailyCaps;
      r.innerHTML=dailyCaps.map((c,i)=>'<button class="story-bubble accent-'+safe(c.accent||'green')+(c.post?' is-live':'')+'" onclick="mtOpenDailyCapsule('+i+')"><span>'+safe(c.emoji||'✦')+'</span><b>'+safe(c.title)+'</b><small>'+safe(c.post?mtDailyShort(c.post.title||c.type,18):(c.type||'Tip du jour'))+'</small></button>').join(''); feed.parentNode.insertBefore(r,feed)} if(s.show_private_drops&&drops.length&&feed&&!$('#privateDrops')){let b=document.createElement('section'); b.id='privateDrops'; b.className='private-drops reveal visible'; b.innerHTML='<div class="kicker">Drops privés</div><div class="drop-grid">'+drops.map(d=>'<article class="drop-card"><span>'+safe(d.emoji||'🔒')+'</span><h3>'+safe(d.title)+'</h3><p>'+safe(d.description||'')+'</p>'+(d.url?'<a href="'+safe(d.url)+'" target="_blank">Ouvrir</a>':'')+'</article>').join('')+'</div>'; feed.parentNode.insertBefore(b,feed)}}
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
