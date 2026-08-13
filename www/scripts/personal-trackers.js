(function(){
  'use strict';
  if(window.__MT_PERSONAL_TRACKERS_V338__) return;
  window.__MT_PERSONAL_TRACKERS_V338__=true;

  const VERSION='v338';
  const TODAY=()=>new Date().toLocaleDateString('sv-SE');
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const byId=id=>document.getElementById(id);

  const CATEGORIES=[
    {key:'alimentation',label:'Mon alimentation',intro:'Observer mes sensations et mes habitudes.',items:['satiety','sugar','balanced']},
    {key:'corps',label:'Mon corps',intro:'Suivre une évolution sans tout ramener à la balance.',items:['body','skin','reflux','deep_sleep']},
    {key:'performance',label:'Ma performance',intro:'Adapter mes repères à mon activité et à ma récupération.',items:['performance','football','recovery']},
    {key:'hormonal',label:'Mon rythme hormonal',intro:'Des suivis facultatifs, activés uniquement si tu les choisis.',items:['cycle','menopause']},
    {key:'habitudes',label:'Mes habitudes',intro:'Comprendre un rythme, une envie ou un changement.',items:['fasting','habit']}
  ];

  const T={
    satiety:{title:'Faim & satiété',short:'Satiété',desc:'Mieux comprendre ma faim avant et après les repas.',fields:[
      ['range','hunger_before','Faim avant le repas','5','0','10'],['range','satiety_after','Satiété après le repas','7','0','10'],['text','moment','Moment où la faim est la plus présente','']
    ]},
    sugar:{title:'Rapport au sucre',short:'Sucre',desc:'Observer les envies sucrées sans culpabiliser.',fields:[
      ['range','cravings','Intensité des envies','5','0','10'],['select','trigger','Déclencheur','',['Faim','Stress','Habitude','Émotion','Autre']],['text','moment','Moment des envies',''],['text','products','Produits sucrés consommés',''],['text','alternative','Alternative choisie',''],['check','no_added_sugar','Journée sans sucre ajouté','false']
    ]},
    balanced:{title:'Équilibre alimentaire',short:'Équilibre alimentaire',desc:'Observer la diversité et la régularité sans compter chaque calorie.',fields:[
      ['number','vegetables','Portions de fruits/légumes','0','0','20'],['check','protein_anchor','Une vraie source de protéines aujourd’hui','false'],['check','prepared_meal','Au moins un repas préparé','false'],['check','screen_free','Au moins un repas sans écran','false'],['text','rhythm','Régularité des horaires','']
    ]},
    body:{title:'Évolution corporelle',short:'Évolution corporelle',desc:'Poids et mensurations restent facultatifs.',fields:[
      ['number','weight','Poids (kg) — facultatif','','0','400'],['number','waist','Tour de taille (cm) — facultatif','','0','300'],['select','clothes','Sensation dans les vêtements','',['Plus ample','Comme d’habitude','Plus ajusté','Je ne souhaite pas noter']],['range','energy','Énergie','6','0','10']
    ]},
    skin:{title:'Peau',short:'Peau',desc:'Suivre ce que ta peau exprime au fil des jours.',fields:[
      ['range','imperfections','Imperfections','3','0','10'],['range','dryness','Sécheresse','3','0','10'],['range','inflammation','Inflammation / rougeurs','3','0','10'],['range','sensitivity','Sensibilité','3','0','10'],['text','care','Produit ou soin utilisé','']
    ]},
    reflux:{title:'Reflux & aigreurs',short:'Reflux',desc:'Observer les circonstances d’apparition et le soulagement.',fields:[
      ['range','intensity','Intensité','3','0','10'],['time','time','Heure d’apparition',''],['text','previous_meal','Repas précédent',''],['select','position','Position après le repas','',['Debout / active','Assise','Allongée','Variable']],['text','drinks','Boissons consommées',''],['text','relief','Ce qui a soulagé','']
    ]},
    deep_sleep:{title:'Sommeil profond',short:'Sommeil approfondi',desc:'Aller plus loin que la simple durée de sommeil.',fields:[
      ['time','bedtime','Heure de coucher',''],['number','latency','Temps d’endormissement (min)','','0','240'],['number','awakenings','Nombre de réveils','0','0','30'],['range','quality','Qualité ressentie','6','0','10'],['check','screens','Écrans dans l’heure avant le coucher','false'],['check','caffeine_late','Caféine en fin de journée','false'],['text','wake_state','État au réveil','']
    ]},
    performance:{title:'Performance sportive',short:'Performance sportive',desc:'Un suivi général pour les jours d’entraînement ou de compétition.',fields:[
      ['text','sport','Discipline sportive',''],['select','session','Séance du jour','',['Entraînement','Compétition / match','Récupération','Repos']],['number','duration','Durée (min)','','0','600'],['range','intensity','Intensité perçue','6','0','10'],['range','energy_before','Énergie avant l’effort','6','0','10'],['range','performance','Performance ressentie','6','0','10'],['range','recovery','Qualité de récupération','6','0','10']
    ]},
    football:{title:'Football',short:'Football',desc:'Repères spécifiques pour entraînement, match et récupération.',fields:[
      ['select','session','Type de journée','',['Entraînement','Match','Récupération','Repos']],['number','minutes','Temps de jeu / séance (min)','','0','180'],['text','position','Poste',''],['range','intensity','Intensité perçue','6','0','10'],['text','pre_meal','Repas pré-entraînement',''],['text','recovery_meal','Repas de récupération',''],['check','cramps','Crampes aujourd’hui','false'],['text','pain','Douleurs localisées',''],['range','availability','Disponibilité pour la prochaine séance','7','0','10']
    ]},
    recovery:{title:'Récupération',short:'Récupération',desc:'Suivre les signaux qui conditionnent la prochaine séance.',fields:[
      ['range','fatigue','Fatigue musculaire','4','0','10'],['range','soreness','Courbatures','3','0','10'],['text','pain','Douleurs localisées',''],['range','mobility','Mobilité ressentie','7','0','10'],['check','rest_day','Jour de repos','false'],['range','availability','Disponibilité physique','7','0','10']
    ]},
    cycle:{title:'Cycle menstruel',short:'Cycle',desc:'Un suivi facultatif de tes ressentis et symptômes.',fields:[
      ['select','flow','Flux','',['Pas de règles','Léger','Modéré','Abondant']],['range','pain','Douleurs','2','0','10'],['range','energy','Énergie','6','0','10'],['range','appetite','Appétit','5','0','10'],['text','symptoms','Symptômes / ressentis',''],['text','note','Note personnelle','']
    ]},
    menopause:{title:'Périménopause & ménopause',short:'Périménopause / ménopause',desc:'Observer les symptômes qui comptent pour toi.',fields:[
      ['range','hot_flashes','Bouffées de chaleur','2','0','10'],['range','sleep','Sommeil','6','0','10'],['range','mood','Humeur','6','0','10'],['range','energy','Énergie','6','0','10'],['range','digestion','Confort digestif','6','0','10'],['range','joints','Confort articulaire','6','0','10']
    ]},
    fasting:{title:'Jeûne intermittent',short:'Jeûne',desc:'Observer ton rythme de jeûne sans rigidité.',fields:[
      ['time','last_meal','Heure du dernier repas',''],['time','first_meal','Heure du premier repas',''],['range','hunger','Niveau de faim','4','0','10'],['range','energy','Énergie','6','0','10'],['number','hydration','Hydratation pendant le jeûne (L)','','0','6'],['range','break_quality','Qualité ressentie de la rupture','7','0','10']
    ]},
    habit:{title:'Changer une habitude',short:'Habitude',desc:'Observer les déclencheurs, les réponses et les petites victoires.',fields:[
      ['text','habit','Habitude que je veux faire évoluer',''],['range','urge','Intensité de l’envie','5','0','10'],['text','trigger','Déclencheur',''],['text','moment','Moment',''],['text','response','Réponse choisie',''],['check','victory','Victoire du jour','false'],['check','lapse','Écart / rechute observé sans jugement','false']
    ]}
  };

  function injectStyles(){
    if(byId('mtPersonalTrackersStyle')) return;
    const st=document.createElement('style'); st.id='mtPersonalTrackersStyle';
    st.textContent=`
      .mt-tracker-card{margin:18px 0 22px;padding:20px;border:1px solid rgba(190,155,92,.24);border-radius:24px;background:rgba(255,252,246,.78)}
      .mt-tracker-kicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#b28b49;font-weight:800}.mt-tracker-card h3{margin:7px 0 5px;color:#173f35;font-family:Georgia,serif;font-weight:500;font-size:27px}.mt-tracker-card p{margin:0;color:#8c7c6b;font-size:14px;line-height:1.5}.mt-tracker-chips{display:flex;flex-wrap:wrap;gap:8px;margin:15px 0}.mt-tracker-chip{border:1px solid rgba(23,63,53,.12);background:#f3f2eb;color:#173f35;border-radius:999px;padding:8px 11px;font-size:12px;font-weight:700}.mt-tracker-card-actions{display:flex;gap:9px;flex-wrap:wrap}.mt-tracker-card-actions button{border:0;border-radius:999px;padding:11px 14px;font-weight:800;font-size:12px}.mt-tracker-primary{background:#173f35;color:#fff}.mt-tracker-secondary{background:transparent;color:#173f35;border:1px solid rgba(23,63,53,.18)!important}
      .mt-track-drawer{position:fixed;inset:0;z-index:100500;display:none}.mt-track-drawer.open{display:block}.mt-track-backdrop{position:absolute;inset:0;background:rgba(33,35,30,.42);backdrop-filter:blur(3px)}.mt-track-sheet{position:absolute;left:0;right:0;bottom:0;max-height:88dvh;overflow:auto;background:#fbf7ef;border-radius:32px 32px 0 0;padding:24px 22px calc(30px + env(safe-area-inset-bottom));box-shadow:0 -12px 50px rgba(34,40,35,.12)}.mt-track-grip{width:48px;height:5px;border-radius:99px;background:rgba(23,63,53,.12);margin:0 auto 18px}.mt-track-close{position:absolute;right:20px;top:21px;width:44px;height:44px;border:0;border-radius:50%;background:#eef0e9;color:#173f35;font-size:27px;line-height:1}.mt-track-sheet small.k{display:block;color:#b28b49;letter-spacing:.18em;text-transform:uppercase;font-weight:800;font-size:11px;margin-right:56px}.mt-track-sheet h2{font-family:Georgia,serif;font-weight:500;color:#173f35;font-size:31px;margin:8px 56px 7px 0}.mt-track-sheet .intro{color:#897767;line-height:1.55;margin:0 0 18px;font-size:14px}
      .mt-track-category{padding:16px 0;border-top:1px solid rgba(23,63,53,.09)}.mt-track-category h3{font-family:Georgia,serif;font-weight:500;font-size:22px;color:#173f35;margin:0}.mt-track-category>p{color:#948474;font-size:12px;margin:4px 0 11px}.mt-track-option{display:flex;align-items:flex-start;gap:12px;padding:12px 0}.mt-track-option input{margin-top:4px;accent-color:#173f35;width:18px;height:18px}.mt-track-option b{display:block;color:#173f35;font-size:14px}.mt-track-option span{display:block;color:#948474;font-size:12px;line-height:1.4;margin-top:2px}.mt-track-saveprefs,.mt-track-saveentry{position:sticky;bottom:0;width:100%;border:0;border-radius:999px;background:#173f35;color:#fff;padding:15px 18px;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin-top:15px;box-shadow:0 -8px 18px rgba(251,247,239,.94)}
      .mt-track-entry-field{margin:15px 0}.mt-track-entry-field label{display:block;color:#173f35;font-weight:800;font-size:13px;margin-bottom:7px}.mt-track-entry-field input[type=text],.mt-track-entry-field input[type=number],.mt-track-entry-field input[type=time],.mt-track-entry-field select{width:100%;box-sizing:border-box;border:1px solid rgba(178,139,73,.28);border-radius:16px;background:#fffdf8;padding:13px 14px;font-size:16px;color:#173f35}.mt-track-entry-field input[type=range]{width:100%;accent-color:#173f35}.mt-track-range-line{display:flex;justify-content:space-between;align-items:center;color:#8e7d6d;font-size:12px}.mt-track-check{display:flex!important;gap:10px;align-items:center}.mt-track-check input{width:19px;height:19px;accent-color:#173f35}.mt-track-today-list{display:grid;gap:8px;margin-top:12px}.mt-track-today-btn{display:flex;justify-content:space-between;align-items:center;text-align:left;border:1px solid rgba(23,63,53,.1);background:#fffdf8;border-radius:16px;padding:12px 13px;color:#173f35}.mt-track-today-btn b{font-size:13px}.mt-track-today-btn span{color:#b28b49;font-size:16px}
    `;
    document.head.appendChild(st);
  }

  async function ctx(){
    try{
      const sb=window.initSupabase&&window.initSupabase(); if(!sb) return {sb:null,user:null};
      const r=await sb.auth.getUser(); return {sb,user:r?.data?.user||null};
    }catch(e){ return {sb:null,user:null}; }
  }
  function localKey(uid){return `mt_personal_trackers_${VERSION}_${uid||'guest'}`}
  function readLocal(uid){try{return JSON.parse(localStorage.getItem(localKey(uid))||'[]').filter(k=>T[k])}catch(e){return []}}
  function writeLocal(uid,arr){try{localStorage.setItem(localKey(uid),JSON.stringify([...new Set(arr)].filter(k=>T[k])))}catch(e){}}
  let state={uid:null,selected:[],loadedRemote:false};

  async function getSelected({remote=false}={}){
    const {sb,user}=await ctx(); const uid=user?.id||'guest';
    if(state.uid!==uid){state={uid,selected:readLocal(uid),loadedRemote:false}}
    if(remote && sb && user && !state.loadedRemote){
      try{
        const r=await sb.from('user_tracker_preferences').select('tracker_key').eq('user_id',user.id).eq('enabled',true);
        if(!r.error){state.selected=(r.data||[]).map(x=>x.tracker_key).filter(k=>T[k]);writeLocal(uid,state.selected);state.loadedRemote=true;}
      }catch(e){}
    }
    return state.selected.slice();
  }

  function ensureDrawer(){
    let d=byId('mtPersonalTrackersDrawer'); if(d)return d;
    d=document.createElement('div');d.id='mtPersonalTrackersDrawer';d.className='mt-track-drawer';document.body.appendChild(d);return d;
  }
  function closeDrawer(){const d=byId('mtPersonalTrackersDrawer');if(d){d.classList.remove('open');d.innerHTML='';}}
  window.mtClosePersonalTrackers=closeDrawer;

  function renderMount(selected){
    const mount=byId('mtPersonalTrackersMount'); if(!mount)return;
    const chips=selected.slice(0,6).map(k=>`<span class="mt-tracker-chip">${esc(T[k].short)}</span>`).join('');
    const more=selected.length>6?`<span class="mt-tracker-chip">+${selected.length-6}</span>`:'';
    mount.innerHTML=`<section class="mt-tracker-card"><div class="mt-tracker-kicker">Mes repères personnalisés</div><h3>Ce que je choisis d’observer</h3><p>Tes suivis actuels restent inchangés. Ajoute seulement les repères avancés qui ont du sens pour toi.</p>${selected.length?`<div class="mt-tracker-chips">${chips}${more}</div><div class="mt-tracker-card-actions"><button class="mt-tracker-primary" onclick="mtOpenTodayPersonalTrackers()">Renseigner aujourd’hui</button><button class="mt-tracker-secondary" onclick="mtOpenPersonalTrackersSettings()">Personnaliser</button></div>`:`<div class="mt-tracker-card-actions" style="margin-top:15px"><button class="mt-tracker-primary" onclick="mtOpenPersonalTrackersSettings()">+ Personnaliser mes suivis</button></div>`}</section>`;
  }

  window.mtPersonalTrackersMount=async function(){injectStyles();renderMount(await getSelected({remote:false}));};

  window.mtOpenPersonalTrackersSettings=async function(){
    injectStyles();const d=ensureDrawer();d.innerHTML=`<div class="mt-track-backdrop" onclick="mtClosePersonalTrackers()"></div><section class="mt-track-sheet"><div class="mt-track-grip"></div><button class="mt-track-close" onclick="mtClosePersonalTrackers()">×</button><small class="k">Accompagnement personnalisé</small><h2>Personnaliser mes suivis</h2><p class="intro">Choisis uniquement ce que tu souhaites mieux comprendre ou améliorer. Rien n’est activé automatiquement.</p><div id="mtTrackPrefsBody"><p class="intro">Chargement…</p></div></section>`;d.classList.add('open');
    const selected=new Set(await getSelected({remote:true}));
    const body=byId('mtTrackPrefsBody'); if(!body)return;
    body.innerHTML=CATEGORIES.map(c=>`<section class="mt-track-category"><h3>${esc(c.label)}</h3><p>${esc(c.intro)}</p>${c.items.map(k=>{const x=T[k];return `<label class="mt-track-option"><input type="checkbox" value="${k}" ${selected.has(k)?'checked':''}><span><b>${esc(x.title)}</b><span>${esc(x.desc)}</span></span></label>`}).join('')}</section>`).join('')+`<button class="mt-track-saveprefs" onclick="mtSavePersonalTrackerPrefs()">Enregistrer mes choix</button>`;
  };

  window.mtSavePersonalTrackerPrefs=async function(){
    const d=byId('mtPersonalTrackersDrawer');if(!d)return;
    const next=[...d.querySelectorAll('input[type=checkbox][value]:checked')].map(x=>x.value).filter(k=>T[k]);
    const prev=state.selected.slice(); const {sb,user}=await ctx(); const uid=user?.id||'guest';
    state={...state,uid,selected:next};writeLocal(uid,next);renderMount(next);
    if(sb&&user){
      try{
        if(next.length){await sb.from('user_tracker_preferences').upsert(next.map(k=>({user_id:user.id,tracker_key:k,enabled:true,updated_at:new Date().toISOString()})),{onConflict:'user_id,tracker_key'});}
        const removed=prev.filter(k=>!next.includes(k));
        if(removed.length) await sb.from('user_tracker_preferences').delete().eq('user_id',user.id).in('tracker_key',removed);
      }catch(e){console.warn('[Mes repères] synchro différée',e)}
    }
    closeDrawer();if(window.mtToast)window.mtToast('Tes suivis sont personnalisés.');
  };

  window.mtOpenTodayPersonalTrackers=async function(){
    injectStyles();const selected=await getSelected({remote:false}); if(!selected.length)return window.mtOpenPersonalTrackersSettings();
    const d=ensureDrawer();d.innerHTML=`<div class="mt-track-backdrop" onclick="mtClosePersonalTrackers()"></div><section class="mt-track-sheet"><div class="mt-track-grip"></div><button class="mt-track-close" onclick="mtClosePersonalTrackers()">×</button><small class="k">Aujourd’hui · ${esc(new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long'}))}</small><h2>Mes suivis du jour</h2><p class="intro">Ouvre seulement le repère que tu veux renseigner.</p><div class="mt-track-today-list">${selected.map(k=>`<button class="mt-track-today-btn" onclick="mtOpenPersonalTracker('${k}')"><b>${esc(T[k].title)}</b><span>→</span></button>`).join('')}</div></section>`;d.classList.add('open');
  };

  function fieldHTML(f){
    const [type,key,label,def,min,maxOrOptions]=f;
    if(type==='range')return `<div class="mt-track-entry-field"><label>${esc(label)}</label><input type="range" name="${key}" min="${min}" max="${maxOrOptions}" value="${def}" oninput="this.nextElementSibling.querySelector('b').textContent=this.value+'/10'"><div class="mt-track-range-line"><span>0</span><b>${def}/10</b><span>10</span></div></div>`;
    if(type==='select')return `<div class="mt-track-entry-field"><label>${esc(label)}</label><select name="${key}"><option value="">Choisir</option>${(maxOrOptions||[]).map(o=>`<option>${esc(o)}</option>`).join('')}</select></div>`;
    if(type==='check')return `<div class="mt-track-entry-field"><label class="mt-track-check"><input type="checkbox" name="${key}"><span>${esc(label)}</span></label></div>`;
    return `<div class="mt-track-entry-field"><label>${esc(label)}</label><input type="${type}" name="${key}" value="${esc(def||'')}" ${min!==undefined&&min!==''?`min="${esc(min)}"`:''} ${maxOrOptions!==undefined&&!Array.isArray(maxOrOptions)?`max="${esc(maxOrOptions)}"`:''}></div>`;
  }

  window.mtOpenPersonalTracker=function(key){
    const x=T[key];if(!x)return;injectStyles();const d=ensureDrawer();d.innerHTML=`<div class="mt-track-backdrop" onclick="mtClosePersonalTrackers()"></div><section class="mt-track-sheet"><div class="mt-track-grip"></div><button class="mt-track-close" onclick="mtClosePersonalTrackers()">×</button><small class="k">Mon repère du jour</small><h2>${esc(x.title)}</h2><p class="intro">${esc(x.desc)}</p><form id="mtTrackerEntryForm" onsubmit="event.preventDefault();mtSavePersonalTrackerEntry('${key}')">${x.fields.map(fieldHTML).join('')}<div class="mt-track-entry-field"><label>Une note, si tu veux</label><input type="text" name="note" placeholder="Facultatif"></div><button class="mt-track-saveentry" type="submit">Enregistrer aujourd’hui</button></form></section>`;d.classList.add('open');
  };

  window.mtSavePersonalTrackerEntry=async function(key){
    const form=byId('mtTrackerEntryForm');if(!form||!T[key])return;
    const values={};T[key].fields.forEach(f=>{const el=form.elements[f[1]];if(!el)return;if(f[0]==='check')values[f[1]]=!!el.checked;else if(f[0]==='number'||f[0]==='range')values[f[1]]=el.value===''?null:Number(el.value);else values[f[1]]=String(el.value||'').trim()||null;});
    const note=String(form.elements.note?.value||'').trim()||null;const {sb,user}=await ctx();
    if(!sb||!user){if(window.mtToast)window.mtToast('Connecte-toi pour enregistrer ce suivi.');return;}
    const btn=form.querySelector('button[type=submit]');if(btn){btn.disabled=true;btn.textContent='Enregistrement…';}
    try{
      const r=await sb.from('user_tracker_entries').upsert({user_id:user.id,tracker_key:key,entry_date:TODAY(),values,note,updated_at:new Date().toISOString()},{onConflict:'user_id,tracker_key,entry_date'});
      if(r.error)throw r.error;
      closeDrawer();if(window.mtToast)window.mtToast('Repère enregistré.');
      window.dispatchEvent(new CustomEvent('mt:daily-state-changed',{detail:{source:'personal_tracker',tracker_key:key}}));
    }catch(e){console.warn('[Mes repères] save',e);if(btn){btn.disabled=false;btn.textContent='Réessayer';}if(window.mtToast)window.mtToast('Active d’abord les tables de suivis dans Supabase.');}
  };
})();
