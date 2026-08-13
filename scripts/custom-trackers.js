// MÉTHODE TEE — V342 · SYSTÈME CONNECTÉ DES SUIVIS (lazy-load)
(function(){
  'use strict';
  if(window.__MT_ADVANCED_TRACKERS_READY__) return;
  window.__MT_ADVANCED_TRACKERS_READY__=true;

  const VERSION=2;
  const TODAY=()=>new Date().toLocaleDateString('sv-SE');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parseDate=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso||''))?new Date(`${iso}T12:00:00`):null;
  const addDays=(iso,days)=>{const d=parseDate(iso);if(!d)return '';d.setDate(d.getDate()+Number(days||0));return d.toLocaleDateString('sv-SE');};
  const dayDiff=(from,to)=>{const a=parseDate(from),b=parseDate(to);return a&&b?Math.floor((b-a)/86400000):0;};
  const fmtDate=iso=>{const d=parseDate(iso);return d?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(d):String(iso||'');};
  const val=(values,key,fallback='')=>values&&values[key]!==undefined&&values[key]!==null&&values[key]!==''?values[key]:fallback;
  const num=value=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;};
  const present=value=>value!==null&&value!==undefined&&String(value)!=='';
  const avg=(...values)=>{const list=values.map(num).filter(Number.isFinite);return list.length?Math.round(list.reduce((a,b)=>a+b,0)/list.length*10)/10:null;};
  const formatDuration=hours=>{const n=num(hours);if(n===null)return '';const whole=Math.floor(n),minutes=Math.round((n-whole)*60);return `${whole}h${minutes?String(minutes).padStart(2,'0'):''}`;};
  const field=(key,label,type='range',options=null,attrs={})=>({key,label,type,options,attrs});

  const CATEGORIES=[
    ['quotidien','Mon quotidien','Sommeil, énergie et récupération générale.'],
    ['alimentation','Mon alimentation','Digestion, équilibre et rythme alimentaire.'],
    ['corps','Mon corps','Évolution, peau et symptômes personnels.'],
    ['performance','Ma performance','Une lecture adaptée à ta discipline et à ton niveau.'],
    ['hormonal','Mon rythme hormonal','Des repères facultatifs, privés et toujours présentés comme des estimations.'],
    ['habitudes','Mes habitudes','Jeûne, sucre et habitudes à faire évoluer sans culpabilisation.']
  ];

  const TRACKERS={
    sommeil_profond:{category:'quotidien',title:'Sommeil approfondi',description:'Comprendre la qualité de tes nuits au-delà de leur durée.',fields:[
      field('bedtime','Heure de coucher','time'),field('wake_time','Heure de réveil','time'),
      field('latency','Temps d’endormissement estimé (min)','number',null,{min:0,max:240,step:5}),
      field('awakenings','Réveils nocturnes','number',null,{min:0,max:20,step:1}),
      field('quality','Qualité ressentie','range'),field('wake_state','État au réveil','range'),
      field('evening_routine','Routine du soir','select',['Oui','Non']),field('screens','Écrans avant le coucher','select',['Non','Oui'])
    ]},
    digestion:{category:'alimentation',title:'Confort digestif',description:'Repérer ce qui soutient ou perturbe ta digestion.',fields:[
      field('comfort','Confort digestif','range'),field('bloating','Ballonnements','range'),field('gas','Gaz','range'),
      field('pain','Douleurs','range'),field('transit','Transit','select',['Habituel','Ralenti','Accéléré','Je ne sais pas']),
      field('foods','Repas ou aliments possiblement associés','textarea'),field('stress','Stress ressenti','range')
    ]},
    reflux:{category:'alimentation',title:'Reflux & aigreurs',description:'Observer les circonstances d’apparition et ce qui soulage.',fields:[
      field('onset','Heure d’apparition','time'),field('intensity','Intensité','range'),field('previous_meal','Repas précédent','textarea'),
      field('position','Position après le repas','select',['Debout / en mouvement','Assise','Allongée','Variable']),
      field('drinks','Boissons consommées','textarea'),field('stress','Stress ressenti','range'),field('relief','Ce qui a soulagé','textarea')
    ]},
    equilibre_alimentaire:{category:'alimentation',title:'Équilibre alimentaire',description:'Suivre la diversité et la régularité sans transformer ton Carnet en compteur.',fields:[
      field('diversity','Diversité alimentaire','range'),field('protein','Présence de protéines','range'),field('plants','Fruits et légumes','range'),
      field('hydration','Hydratation autour des repas','range'),field('prepared','Repas préparé / maison','select',['Oui','Non']),
      field('screenfree','Repas sans écran','select',['Oui','Non']),field('schedule','Régularité des horaires','range')
    ]},
    evolution_corporelle:{category:'corps',title:'Évolution corporelle',description:'Des repères facultatifs, au-delà du chiffre sur la balance.',fields:[
      field('weight','Poids (facultatif)','number',null,{min:20,max:400,step:.1}),field('waist','Tour de taille en cm (facultatif)','number',null,{min:30,max:250,step:.5}),
      field('hips','Tour de hanches en cm (facultatif)','number',null,{min:30,max:250,step:.5}),
      field('clothes','Sensation dans les vêtements','select',['Plus ample','Stable','Plus ajusté']),
      field('hunger','Faim','range'),field('satiety','Satiété','range'),field('energy','Énergie','range')
    ]},
    peau:{category:'corps',title:'Peau',description:'Relier l’état de ta peau à tes autres repères.',fields:[
      field('blemishes','Imperfections','range'),field('dryness','Sécheresse','range'),field('inflammation','Inflammation','range'),
      field('sensitivity','Sensibilité','range'),field('sleep','Sommeil ressenti','range'),field('stress','Stress','range'),field('products','Produits ou soins utilisés','textarea')
    ]},
    performance_recuperation:{category:'performance',title:'Performance & récupération',description:'Un suivi qui s’adapte à ta discipline, de la pratique loisir au niveau professionnel.',configurable:true},
    cycle:{category:'hormonal',title:'Cycle & rythme hormonal',description:'Un suivi facultatif avec estimations prudentes, jamais présenté comme une contraception.',configurable:true},
    perimenopause:{category:'hormonal',title:'Périménopause & ménopause',description:'Observer les symptômes qui comptent pour toi sans diagnostic automatisé.',fields:[
      field('hot_flashes','Bouffées de chaleur','number',null,{min:0,max:50,step:1}),field('sleep','Sommeil','range'),
      field('mood','Humeur','range'),field('energy','Énergie','range'),field('digestion','Confort digestif','range'),
      field('joint_pain','Douleurs articulaires','range'),field('symptoms','Évolution ou autres symptômes','textarea')
    ]},
    jeune_intermit:{category:'habitudes',title:'Jeûne intermittent',description:'Observer ton rythme de jeûne, ta faim et ta rupture sans rigidité.',fields:[
      field('last_meal','Dernier repas','time'),field('first_meal','Premier repas','time'),field('hunger','Niveau de faim','range'),
      field('energy','Énergie','range'),field('hydration','Hydratation','range'),field('break_quality','Qualité de la rupture du jeûne','range')
    ]},
    reduction_sucre:{category:'habitudes',title:'Réduction du sucre',description:'Comprendre les envies plutôt que seulement compter les jours.',fields:[
      field('craving','Envie sucrée','range'),field('moment','Moment des envies','text'),
      field('trigger','Déclencheur','select',['Faim','Stress','Habitude','Émotion','Autre']),field('products','Produits sucrés consommés','textarea'),
      field('alternative','Alternative choisie','textarea'),field('no_added_sugar','Journée sans sucre ajouté','select',['Oui','Non'])
    ]},
    changer_habitude:{category:'habitudes',title:'Changer une habitude',description:'Suivre déclencheurs, réponses et petites victoires sans culpabilisation.',fields:[
      field('habit','Habitude à faire évoluer','text'),field('urge','Envie ou impulsion','range'),field('trigger','Déclencheur','textarea'),
      field('moment','Moment','text'),field('response','Réponse choisie','textarea'),field('victory','Victoire du jour','textarea'),
      field('setback','Écart ou rechute, sans jugement','textarea')
    ]}
  };

  const ALIASES={performance_sportive:'performance_recuperation',football:'performance_recuperation',recuperation:'performance_recuperation'};
  const DISCIPLINES=['Football','Musculation','Course','Boxe','Danse','Basketball','Tennis','Natation','Cyclisme','Autre'];
  const LEVELS=['Loisir','Régulier','Compétition','Professionnel'];
  const normalizeKey=key=>ALIASES[String(key||'')]||String(key||'');
  const tracker=key=>TRACKERS[normalizeKey(key)]||null;

  let UID=null;
  let PREFS={};
  let pendingAfterConfig=null;

  const prefKey=uid=>`mt_custom_trackers_v${VERSION}_${uid||'guest'}`;
  const legacyPrefKey=uid=>`mt_custom_trackers_v1_${uid||'guest'}`;
  const entryKey=(uid,key,date)=>`mt_tracker_entry_${uid||'guest'}_${normalizeKey(key)}_${date}`;

  function normalizePreference(raw,key){
    if(raw===true||raw===false) return {enabled:!!raw,settings:{}};
    const settings=raw&&typeof raw.settings==='object'&&raw.settings?raw.settings:{};
    return {enabled:!!raw?.enabled,settings:{...settings},updated_at:raw?.updated_at||null,key:normalizeKey(key)};
  }

  function mergeSettings(local={},remote={}){
    const out={...local,...remote};
    const localDate=String(local.latest_date||''),remoteDate=String(remote.latest_date||'');
    if(localDate>remoteDate){out.latest_date=local.latest_date;out.latest_summary=local.latest_summary;}
    return out;
  }

  function readPrefs(uid=UID){
    const out={};
    try{
      const raw=JSON.parse(localStorage.getItem(prefKey(uid))||'{}');
      Object.entries(raw||{}).forEach(([key,value])=>{
        const normalized=normalizeKey(key);if(!TRACKERS[normalized])return;
        const next=normalizePreference(value,normalized);
        if(!out[normalized])out[normalized]=next;
        else out[normalized]={...out[normalized],enabled:out[normalized].enabled||next.enabled,settings:mergeSettings(out[normalized].settings,next.settings)};
      });
    }catch(e){}
    try{
      const legacy=JSON.parse(localStorage.getItem(legacyPrefKey(uid))||'{}');
      Object.entries(legacy||{}).forEach(([key,value])=>{
        const normalized=normalizeKey(key);if(!TRACKERS[normalized])return;
        const next=normalizePreference(value,normalized);
        if(key==='football'&&next.enabled)next.settings.discipline='Football';
        if(!out[normalized])out[normalized]=next;
        else{out[normalized].enabled=out[normalized].enabled||next.enabled;out[normalized].settings=mergeSettings(out[normalized].settings,next.settings);}
      });
    }catch(e){}
    return out;
  }

  function writePrefs(){try{localStorage.setItem(prefKey(UID),JSON.stringify(PREFS||{}));}catch(e){}}
  function readLocalEntry(key,date){try{return JSON.parse(localStorage.getItem(entryKey(UID,key,date))||'null');}catch(e){return null;}}
  function writeLocalEntry(key,date,payload){try{localStorage.setItem(entryKey(UID,key,date),JSON.stringify(payload));}catch(e){}}

  function client(){try{return window.initSupabase?.()||window.mtSupabase||null;}catch(e){return null;}}
  async function getUser(){try{const c=client();if(!c)return null;return (await c.auth.getUser()).data?.user||null;}catch(e){return null;}}
  function root(id,className){let el=document.getElementById(id);if(!el){el=document.createElement('div');el.id=id;el.className=className;document.body.appendChild(el);}return el;}
  function toast(message){if(window.mtToast)return window.mtToast(message);}

  function addCSS(){
    if(document.getElementById('mt-follow-css'))return;
    const style=document.createElement('style');
    style.id='mt-follow-css';
    style.textContent=`
      .mt-follow,.mt-follow-entry,.mt-follow-config{position:fixed;inset:0;z-index:19000;display:none;color:#173b31}.mt-follow-entry{z-index:19020}.mt-follow-config{z-index:19040}.mt-follow.open,.mt-follow-entry.open,.mt-follow-config.open{display:block}
      .mt-follow-bg{position:absolute;inset:0;background:rgba(23,36,30,.42);backdrop-filter:blur(7px)}
      .mt-follow-sheet{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,720px);max-height:90dvh;overflow:auto;-webkit-overflow-scrolling:touch;background:linear-gradient(180deg,#fffdf8,#f8f1e7);border-radius:34px 34px 0 0;padding:20px 22px calc(32px + env(safe-area-inset-bottom,0px));box-shadow:0 -18px 70px rgba(20,35,29,.18)}
      .mt-follow-grip{width:60px;height:6px;border-radius:8px;background:rgba(23,59,49,.14);margin:0 auto 22px}.mt-follow-close{position:absolute;right:22px;top:24px;border:0;background:#eef0e8;width:46px;height:46px;border-radius:50%;font-size:28px;color:#173b31}
      .mt-follow-kicker{font-size:11px;letter-spacing:.21em;text-transform:uppercase;color:#b28d45;font-weight:900}.mt-follow-sheet h2{font-family:Georgia,serif;font-weight:400;font-size:clamp(34px,8vw,48px);line-height:1.02;margin:10px 58px 9px 0}.mt-follow-intro{color:#847667;font-size:14px;line-height:1.55;margin:0 0 20px}
      .mt-follow-active{display:flex;gap:8px;overflow:auto;padding:2px 0 18px}.mt-follow-chip{white-space:nowrap;border:1px solid #dfd4c1;background:#fffaf1;padding:10px 13px;border-radius:999px;color:#173b31;font-weight:750}
      .mt-follow-empty{padding:15px;border-radius:19px;background:#f2ece2;color:#796d60;font-size:13px;line-height:1.5}.mt-follow-cat{border-top:1px solid #e4dccf;padding:19px 0}.mt-follow-cat h3{font-family:Georgia,serif;font-weight:400;font-size:25px;margin:0 0 5px}.mt-follow-cat>p{margin:0 0 11px;color:#8a7c6d;font-size:13px;line-height:1.45}
      .mt-follow-row{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:14px 0;border-top:1px solid #eee6d9}.mt-follow-row b{display:block;font-size:14px}.mt-follow-row small{display:block;color:#897b6c;line-height:1.38;margin-top:4px;max-width:48ch}.mt-follow-row-actions{display:flex;gap:7px;align-items:center}.mt-follow-action{border:1px solid #c9b07a;border-radius:999px;background:transparent;color:#173b31;font-weight:850;padding:9px 12px}.mt-follow-action.is-on{background:#173b31;color:#fff;border-color:#173b31}.mt-follow-configure{border:0;background:transparent;color:#a77f37;font-weight:850;padding:8px 2px}
      .mt-follow-form{display:grid;gap:15px}.mt-follow-field label{display:block;font-weight:850;font-size:13px;margin-bottom:7px}.mt-follow-field input,.mt-follow-field select,.mt-follow-field textarea{width:100%;box-sizing:border-box;border:1px solid #ddd2c1;background:#fffdf8;color:#173b31;border-radius:18px;padding:13px 14px;font:inherit}.mt-follow-field textarea{min-height:92px;resize:vertical}.mt-follow-range{display:grid;grid-template-columns:1fr 55px;gap:11px;align-items:center}.mt-follow-range output{text-align:center;font-weight:850}.mt-follow-save{width:100%;border:0;border-radius:18px;background:#173b31;color:white;padding:16px;font-weight:900;margin-top:4px}.mt-follow-help{padding:14px 15px;border-radius:18px;background:#f2ece2;color:#76695e;font-size:12px;line-height:1.55}.mt-follow-estimate{padding:17px;border:1px solid rgba(178,141,69,.24);background:#fff8ea;border-radius:20px}.mt-follow-estimate small{display:block;color:#a77f37;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.mt-follow-estimate b{display:block;font-family:Georgia,serif;font-size:22px;font-weight:500;margin:7px 0 4px}.mt-follow-estimate p{margin:0;color:#796c60;font-size:13px;line-height:1.45}.mt-follow-loading{text-align:center;padding:35px 10px;color:#7e7164}.mt-follow-loading b{display:block;font-family:Georgia,serif;font-size:27px;font-weight:400;color:#173b31;margin-bottom:8px}.mt-follow-loading span{display:inline-block;width:25px;height:25px;border:2px solid rgba(23,59,49,.16);border-top-color:#173b31;border-radius:50%;animation:mtFollowSpin .8s linear infinite;margin-top:14px}@keyframes mtFollowSpin{to{transform:rotate(360deg)}}
      @media(max-width:520px){.mt-follow-sheet{left:0;right:0;transform:none;width:100%;height:89dvh;max-height:89dvh;padding:22px 20px calc(30px + env(safe-area-inset-bottom,0px))}.mt-follow-row{grid-template-columns:1fr}.mt-follow-row-actions{justify-content:flex-start}.mt-follow-sheet h2{font-size:38px}}
      @media(prefers-reduced-motion:reduce){.mt-follow-loading span{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function preference(key){const normalized=normalizeKey(key);return PREFS[normalized]||{enabled:false,settings:{}};}
  function activeKeys(){return Object.keys(TRACKERS).filter(key=>preference(key).enabled);}

  function durationBetween(start,end){
    if(!/^\d{2}:\d{2}$/.test(String(start||''))||!/^\d{2}:\d{2}$/.test(String(end||'')))return null;
    const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);let minutes=(eh*60+em)-(sh*60+sm);if(minutes<=0)minutes+=1440;return Math.round(minutes/6)/10;
  }

  function cycleEstimate(settings={},date=TODAY()){
    const start=String(settings.last_period_start||'');
    if(!parseDate(start)||!parseDate(date))return null;
    const cycleLength=Math.min(45,Math.max(20,Number(settings.cycle_length)||28));
    const periodLength=Math.min(10,Math.max(1,Number(settings.period_length)||5));
    const elapsed=dayDiff(start,date);
    const cycleIndex=Math.floor(elapsed/cycleLength);
    const cycleDay=((elapsed%cycleLength)+cycleLength)%cycleLength+1;
    const ovulationDay=Math.max(periodLength+3,cycleLength-14);
    let phase='Phase lutéale estimée';
    if(cycleDay<=periodLength)phase='Période menstruelle estimée';
    else if(cycleDay<ovulationDay-2)phase='Phase folliculaire estimée';
    else if(cycleDay<=ovulationDay+2)phase='Fenêtre ovulatoire estimée';
    const nextPeriod=addDays(start,(cycleIndex+1)*cycleLength);
    const ovulationDate=addDays(start,cycleIndex*cycleLength+ovulationDay-1);
    return {cycleDay,phase,cycleLength,periodLength,ovulationDay,nextPeriod,ovulationDate,regularity:settings.regularity||'Je ne sais pas'};
  }

  function performanceFields(settings={}){
    const discipline=String(settings.discipline||'Autre');
    const base=[
      field('session','Type de journée','select',['Entraînement','Match / compétition','Récupération','Repos']),
      field('duration','Durée (min)','number',null,{min:0,max:600,step:5}),field('intensity','Intensité ressentie','range'),
      field('energy_before','Énergie avant l’effort','range'),field('fatigue_after','Fatigue après l’effort','range'),
      field('recovery','Qualité de récupération','range'),field('pain','Douleurs localisées','textarea'),field('hydration','Hydratation avant / après','range')
    ];
    if(discipline==='Football')return base.concat([
      field('play_time','Temps de jeu (min)','number',null,{min:0,max:180,step:5}),field('position','Poste (facultatif)','text'),
      field('premeal','Repas pré-entraînement','textarea'),field('recoverymeal','Repas de récupération','textarea'),
      field('cramps','Crampes','select',['Non','Oui']),field('muscle_fatigue','Fatigue musculaire','range'),field('sleep','Sommeil','range'),field('availability','Disponibilité prochaine séance','range')
    ]);
    if(discipline==='Boxe')return base.concat([
      field('boxing_session','Contenu de séance','select',['Technique','Sparring','Cardio','Sac / paos','Mixte']),field('rounds','Rounds réalisés','number',null,{min:0,max:50,step:1}),field('impact_discomfort','Inconfort après impacts','range')
    ]);
    if(discipline==='Danse')return base.concat([
      field('dance_type','Type de séance','text'),field('mobility','Mobilité / amplitude','range'),field('feet_legs','Confort pieds et jambes','range')
    ]);
    if(discipline==='Musculation')return base.concat([
      field('focus','Zone ou séance travaillée','text'),field('load_feeling','Charges ressenties','select',['Légères','Adaptées','Difficiles']),field('muscle_fatigue','Fatigue musculaire','range')
    ]);
    if(discipline==='Course')return base.concat([
      field('distance','Distance (km)','number',null,{min:0,max:300,step:.1}),field('terrain','Terrain','select',['Route','Piste','Tapis','Trail','Mixte']),field('breathing','Confort respiratoire','range')
    ]);
    if(discipline==='Basketball')return base.concat([
      field('play_time','Temps de jeu (min)','number',null,{min:0,max:180,step:5}),field('court_role','Poste ou rôle (facultatif)','text'),field('jump_load','Sollicitation des sauts','range'),field('contact_discomfort','Inconfort après les contacts','range')
    ]);
    if(discipline==='Tennis')return base.concat([
      field('court_time','Temps sur le court (min)','number',null,{min:0,max:360,step:5}),field('surface','Surface','select',['Dur','Terre battue','Gazon','Moquette','Autre']),field('sets','Sets joués','number',null,{min:0,max:10,step:1}),field('arm_comfort','Confort bras / épaule','range')
    ]);
    if(discipline==='Natation')return base.concat([
      field('distance','Distance (m)','number',null,{min:0,max:50000,step:50}),field('stroke','Nage principale','select',['Crawl','Brasse','Dos','Papillon','Mixte']),field('environment','Environnement','select',['Piscine','Eau libre','Mixte']),field('shoulder_comfort','Confort des épaules','range')
    ]);
    if(discipline==='Cyclisme')return base.concat([
      field('distance','Distance (km)','number',null,{min:0,max:600,step:.1}),field('elevation','Dénivelé (m)','number',null,{min:0,max:10000,step:10}),field('ride_type','Type de sortie','select',['Route','Gravel','VTT','Intérieur','Déplacement']),field('leg_comfort','Confort jambes / assise','range')
    ]);
    return base;
  }

  function cycleFields(){return [
    field('new_period','Mes règles ont commencé aujourd’hui','select',['Non','Oui']),
    field('flow','Flux','select',['Aucun','Léger','Modéré','Abondant']),field('pain','Douleurs','range'),
    field('energy','Énergie','range'),field('mood','Humeur','range'),field('appetite','Appétit et envies','range'),
    field('sleep','Sommeil','range'),field('symptoms','Symptômes ou observations','textarea')
  ];}

  function fieldsFor(key,settings={}){
    key=normalizeKey(key);
    if(key==='performance_recuperation')return performanceFields(settings);
    if(key==='cycle')return cycleFields();
    return TRACKERS[key]?.fields||[];
  }

  function trackerSummary(key,values={},settings={},date=TODAY()){
    key=normalizeKey(key);
    if(key==='sommeil_profond'){
      const hours=durationBetween(values.bedtime,values.wake_time);return [hours?`${String(hours).replace('.',',')} h`:'',values.quality!==undefined?`qualité ${values.quality}/10`:''].filter(Boolean).join(' · ')||'Sommeil prêt à renseigner';
    }
    if(key==='digestion')return [values.comfort!==undefined?`confort ${values.comfort}/10`:'',values.bloating!==undefined?`ballonnements ${values.bloating}/10`:''].filter(Boolean).join(' · ')||'Confort digestif renseigné';
    if(key==='reflux')return values.intensity!==undefined?`intensité ${values.intensity}/10`:'Reflux renseigné';
    if(key==='equilibre_alimentaire')return [values.diversity!==undefined?`diversité ${values.diversity}/10`:'',values.protein!==undefined?`protéines ${values.protein}/10`:''].filter(Boolean).join(' · ')||'Équilibre renseigné';
    if(key==='evolution_corporelle')return [values.clothes||'',values.energy!==undefined?`énergie ${values.energy}/10`:''].filter(Boolean).join(' · ')||'Évolution renseignée';
    if(key==='peau')return values.inflammation!==undefined?`inflammation ${values.inflammation}/10`:'Peau renseignée';
    if(key==='performance_recuperation')return [settings.discipline||'Activité',values.duration?`${values.duration} min`:'',values.energy_before!==undefined?`énergie ${values.energy_before}/10`:'',values.recovery!==undefined?`récupération ${values.recovery}/10`:''].filter(Boolean).join(' · ')||'Performance prête à renseigner';
    if(key==='cycle'){
      const estimate=cycleEstimate(settings,date);return estimate?`J${estimate.cycleDay} estimé · ${estimate.phase.replace(' estimée','').replace(' estimé','')}`:'Cycle prêt à configurer';
    }
    if(key==='perimenopause')return values.energy!==undefined?`énergie ${values.energy}/10`:'Symptômes renseignés';
    if(key==='jeune_intermit'){
      const hours=durationBetween(values.last_meal,values.first_meal);return [hours?`${String(hours).replace('.',',')} h de jeûne`:'',values.energy!==undefined?`énergie ${values.energy}/10`:''].filter(Boolean).join(' · ')||'Jeûne renseigné';
    }
    if(key==='reduction_sucre')return values.craving!==undefined?`envie ${values.craving}/10`:'Repère sucre renseigné';
    if(key==='changer_habitude')return values.victory?`Victoire · ${String(values.victory).slice(0,45)}`:'Habitude renseignée';
    return 'Repère renseigné';
  }

  // Résumé quotidien canonique : suffisamment riche pour Mon parcours et
  // Mon Équilibre, mais sans historique ni détail lourd. Il est conservé avec
  // l'entrée afin que les vues transversales n'aient pas à réinterpréter tout
  // le formulaire à chaque ouverture.
  function trackerDailySummary(rawKey,values={},settings={},date=TODAY()){
    const key=normalizeKey(rawKey),item=TRACKERS[key]||{title:'Suivi personnel'},metrics=[],pills=[],signals={};
    const metric=(label,value)=>{if(present(value))metrics.push({label,value:String(value)});};
    const pill=(label,value)=>{if(present(value))pills.push(`${label} · ${value}`);};
    if(key==='sommeil_profond'){
      const hours=num(values._sleep_hours)??durationBetween(values.bedtime,values.wake_time),duration=formatDuration(hours);
      pill('Sommeil',duration||'renseigné');if(present(values.quality))pill('Qualité',`${values.quality}/10`);
      metric('Durée',duration);metric('Qualité',present(values.quality)?`${values.quality}/10`:'');metric('État au réveil',present(values.wake_state)?`${values.wake_state}/10`:'');
      if(hours!==null)signals.sleep_minutes=Math.round(hours*60);signals.sleep_quality=num(values.quality);signals.energy=num(values.wake_state);
    }else if(key==='digestion'){
      pill('Digestion',present(values.comfort)?`${values.comfort}/10`:'renseignée');
      metric('Confort',present(values.comfort)?`${values.comfort}/10`:'');metric('Ballonnements',present(values.bloating)?`${values.bloating}/10`:'');metric('Transit',values.transit);
      signals.digestion=num(values.comfort);signals.bloating=num(values.bloating);signals.stress=num(values.stress);
    }else if(key==='reflux'){
      const intensity=num(values.intensity),level=intensity===null?'renseigné':intensity<=3?'léger':intensity<=6?'modéré':'marqué';pill('Reflux',level);
      metric('Intensité',intensity===null?'':`${intensity}/10`);metric('Apparition',values.onset);metric('Soulagement',values.relief);signals.reflux=intensity;
    }else if(key==='equilibre_alimentaire'){
      const balance=avg(values.diversity,values.protein,values.plants,values.hydration,values.schedule);pill('Équilibre',balance===null?'renseigné':`${balance}/10`);
      metric('Diversité',present(values.diversity)?`${values.diversity}/10`:'');metric('Protéines',present(values.protein)?`${values.protein}/10`:'');metric('Végétaux',present(values.plants)?`${values.plants}/10`:'');
      signals.nutrition_balance=balance===null?null:Math.round(balance*10)/100;signals.nutrition_protein=num(values.protein);signals.nutrition_plants=num(values.plants);signals.hydration_feeling=num(values.hydration);
    }else if(key==='evolution_corporelle'){
      pill('Évolution',values.clothes||'renseignée');metric('Vêtements',values.clothes);metric('Énergie',present(values.energy)?`${values.energy}/10`:'');metric('Satiété',present(values.satiety)?`${values.satiety}/10`:'');
      signals.energy=num(values.energy);signals.hunger=num(values.hunger);signals.satiety=num(values.satiety);
    }else if(key==='peau'){
      const discomfort=avg(values.blemishes,values.dryness,values.inflammation,values.sensitivity);pill('Peau',discomfort===null?'renseignée':`${discomfort}/10`);
      metric('Inflammation',present(values.inflammation)?`${values.inflammation}/10`:'');metric('Sensibilité',present(values.sensitivity)?`${values.sensitivity}/10`:'');signals.skin_discomfort=discomfort;signals.stress=num(values.stress);signals.sleep_quality=num(values.sleep);
    }else if(key==='performance_recuperation'){
      const discipline=values._discipline||(settings.discipline==='Autre'?settings.discipline_other:settings.discipline)||'Activité';
      pill('Sport',values.duration?`${values.duration} min`:values.session||'renseigné');if(present(values.recovery))pill('Récupération',`${values.recovery}/10`);
      metric('Activité',discipline);metric('Séance',values.session);metric('Durée',values.duration?`${values.duration} min`:'');metric('Intensité',present(values.intensity)?`${values.intensity}/10`:'');metric('Énergie',present(values.energy_before)?`${values.energy_before}/10`:'');metric('Récupération',present(values.recovery)?`${values.recovery}/10`:'');
      signals.discipline=discipline;signals.sport_duration=num(values.duration);signals.sport_intensity=num(values.intensity);signals.energy=num(values.energy_before);signals.recovery=num(values.recovery);signals.fatigue=num(values.fatigue_after)??num(values.muscle_fatigue);
    }else if(key==='cycle'){
      const estimate=cycleEstimate(settings,date),cycleDay=num(values.cycle_day_estimate)??estimate?.cycleDay,phase=values.cycle_phase_estimate||estimate?.phase||'Phase estimée';
      pill('Cycle',cycleDay?`J${cycleDay}`:'renseigné');metric('Phase',phase);metric('Énergie',present(values.energy)?`${values.energy}/10`:'');metric('Douleurs',present(values.pain)?`${values.pain}/10`:'');metric('Appétit',present(values.appetite)?`${values.appetite}/10`:'');metric('Flux',values.flow);
      signals.cycle_day=cycleDay;signals.cycle_phase=phase;signals.energy=num(values.energy);signals.pain=num(values.pain);signals.appetite=num(values.appetite);signals.sleep_quality=num(values.sleep);signals.mood=num(values.mood);
    }else if(key==='perimenopause'){
      pill('Rythme hormonal',present(values.energy)?`énergie ${values.energy}/10`:'renseigné');metric('Énergie',present(values.energy)?`${values.energy}/10`:'');metric('Sommeil',present(values.sleep)?`${values.sleep}/10`:'');metric('Bouffées de chaleur',values.hot_flashes);
      signals.energy=num(values.energy);signals.sleep_quality=num(values.sleep);signals.mood=num(values.mood);signals.digestion=num(values.digestion);signals.pain=num(values.joint_pain);
    }else if(key==='jeune_intermit'){
      const hours=num(values._fast_hours)??durationBetween(values.last_meal,values.first_meal),duration=formatDuration(hours);pill('Jeûne',duration||'renseigné');metric('Durée',duration);metric('Énergie',present(values.energy)?`${values.energy}/10`:'');metric('Faim',present(values.hunger)?`${values.hunger}/10`:'');
      signals.fast_minutes=hours===null?null:Math.round(hours*60);signals.energy=num(values.energy);signals.hunger=num(values.hunger);signals.hydration_feeling=num(values.hydration);
    }else if(key==='reduction_sucre'){
      pill('Sucre',present(values.craving)?`envie ${values.craving}/10`:'renseigné');metric('Envie',present(values.craving)?`${values.craving}/10`:'');metric('Déclencheur',values.trigger);metric('Sans sucre ajouté',values.no_added_sugar);
      signals.sugar_craving=num(values.craving);signals.habit_done=values.no_added_sugar==='Oui';
    }else if(key==='changer_habitude'){
      const done=!!String(values.victory||values.response||'').trim();pill('Habitude',done?'✓':'renseignée');metric('Habitude',values.habit);metric('Victoire',values.victory);metric('Réponse choisie',values.response);
      signals.habit_done=done;signals.urge=num(values.urge);
    }
    return {version:1,key,title:item.title,date,headline:trackerSummary(key,values,settings,date),pills:[...new Set(pills)],metrics,signals};
  }

  function renderCatalog(){
    const modal=root('mtAdvancedTrackers','mt-follow');
    const active=activeKeys();
    modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackersClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackersClose()" aria-label="Fermer">×</button><div class="mt-follow-kicker">Mon carnet · Mes suivis</div><h2>Ajouter un suivi</h2><p class="mt-follow-intro">Choisis seulement les repères qui comptent pour toi. Les suivis masqués conservent leur historique.</p>${active.length?`<div class="mt-follow-active">${active.map(key=>`<button class="mt-follow-chip" type="button" onclick="mtAdvancedTrackerEntry('${key}')">${esc(TRACKERS[key].title)} →</button>`).join('')}</div>`:`<div class="mt-follow-empty">Aucun suivi personnalisé actif pour le moment. Tu peux commencer par un seul repère.</div>`}${CATEGORIES.map(([category,label,description])=>`<section class="mt-follow-cat"><h3>${label}</h3><p>${description}</p>${Object.entries(TRACKERS).filter(([,item])=>item.category===category).map(([key,item])=>{const pref=preference(key),isOn=pref.enabled;return `<div class="mt-follow-row"><div><b>${esc(item.title)}</b><small>${esc(item.description)}</small></div><div class="mt-follow-row-actions">${isOn&&item.configurable?`<button class="mt-follow-configure" type="button" onclick="mtAdvancedTrackerConfigure('${key}')">Configurer</button>`:''}<button class="mt-follow-action ${isOn?'is-on':''}" type="button" onclick="mtAdvancedTrackerToggle('${key}')">${isOn?'Masquer':'Ajouter'}</button></div></div>`;}).join('')}</section>`).join('')}<div class="mt-follow-help">Les données de santé, de cycle et de symptômes restent privées. Les estimations du cycle ne constituent ni un diagnostic ni une méthode contraceptive.</div></section>`;
    modal.classList.add('open');
  }

  async function remotePreferences(){
    const c=client();if(!c||!UID)return;
    try{
      const {data,error}=await c.from('user_tracker_preferences').select('tracker_key,enabled,settings,updated_at').eq('user_id',UID);
      if(error)throw error;
      const rows=data||[],oldKeys=[];
      const canonical=new Set(rows.filter(row=>!ALIASES[row.tracker_key]).map(row=>String(row.tracker_key)));
      rows.filter(row=>!ALIASES[row.tracker_key]).forEach(row=>{
        const key=normalizeKey(row.tracker_key);if(!TRACKERS[key])return;
        const incoming=normalizePreference(row,key);
        const current=preference(key);
        PREFS[key]={enabled:incoming.enabled,settings:mergeSettings(current.settings,incoming.settings),updated_at:incoming.updated_at||current.updated_at};
      });
      rows.filter(row=>ALIASES[row.tracker_key]).forEach(row=>{
        const key=normalizeKey(row.tracker_key);if(!TRACKERS[key])return;
        oldKeys.push(row.tracker_key);if(canonical.has(key)||!row.enabled)return;
        const incoming=normalizePreference(row,key);if(row.tracker_key==='football')incoming.settings.discipline='Football';
        const current=preference(key);PREFS[key]={enabled:true,settings:mergeSettings(current.settings,incoming.settings),updated_at:incoming.updated_at||current.updated_at};
      });
      writePrefs();
      if(PREFS.performance_recuperation?.enabled){
        await c.from('user_tracker_preferences').upsert({user_id:UID,tracker_key:'performance_recuperation',enabled:true,settings:PREFS.performance_recuperation.settings||{},updated_at:new Date().toISOString()},{onConflict:'user_id,tracker_key'});
        if(oldKeys.length)await Promise.all(oldKeys.map(key=>c.from('user_tracker_preferences').upsert({user_id:UID,tracker_key:key,enabled:false,updated_at:new Date().toISOString()},{onConflict:'user_id,tracker_key'})));
      }
      if(document.getElementById('mtAdvancedTrackers')?.classList.contains('open'))renderCatalog();
      window.mtRefreshCarnetTrackers?.();
    }catch(e){console.warn('[Mes suivis] préférences locales utilisées',e);}
  }

  async function savePreference(key){
    const c=client(),pref=preference(key);writePrefs();
    if(c&&UID){try{const {error}=await c.from('user_tracker_preferences').upsert({user_id:UID,tracker_key:key,enabled:!!pref.enabled,settings:pref.settings||{},updated_at:new Date().toISOString()},{onConflict:'user_id,tracker_key'});if(error)throw error;}catch(e){console.warn('[Mes suivis] préférence conservée localement',e);}}
    window.mtRefreshCarnetTrackers?.();
    window.dispatchEvent(new CustomEvent('mt:tracker-preferences-changed',{detail:{key,enabled:!!pref.enabled}}));
  }

  window.mtAdvancedTrackersOpen=async function(){
    addCSS();UID=(await getUser())?.id||window.__MT_LIBRARY_USER_ID__||null;PREFS=readPrefs(UID);writePrefs();renderCatalog();remotePreferences();
  };
  window.mtAdvancedTrackersClose=()=>root('mtAdvancedTrackers','mt-follow').classList.remove('open');

  window.mtAdvancedTrackerToggle=async function(rawKey){
    const key=normalizeKey(rawKey),item=tracker(key);if(!item)return;
    const pref=preference(key);
    if(pref.enabled){PREFS[key]={...pref,enabled:false};await savePreference(key);renderCatalog();return;}
    if(item.configurable){pendingAfterConfig=null;return window.mtAdvancedTrackerConfigure(key);}
    PREFS[key]={...pref,enabled:true,settings:pref.settings||{}};await savePreference(key);renderCatalog();toast(`${item.title} ajouté à Mes suivis.`);
  };

  function configHTML(key,settings={}){
    if(key==='performance_recuperation')return `<div class="mt-follow-field"><label>Quelle activité pratiques-tu ?</label><select name="discipline" required><option value="">Choisir une activité…</option>${DISCIPLINES.map(x=>`<option value="${esc(x)}" ${settings.discipline===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="mt-follow-field" data-other-discipline><label>Si autre, précise ta discipline</label><input name="discipline_other" type="text" value="${esc(settings.discipline_other||'')}"></div><div class="mt-follow-field"><label>Ton niveau</label><select name="level">${LEVELS.map(x=>`<option value="${esc(x)}" ${settings.level===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="mt-follow-help">Football n’est pas un suivi principal : les champs spécifiques apparaîtront seulement si tu choisis cette discipline.</div>`;
    const maxDate=TODAY();
    return `<div class="mt-follow-field"><label>Premier jour de tes dernières règles</label><input name="last_period_start" type="date" max="${maxDate}" value="${esc(settings.last_period_start||'')}" required></div><div class="mt-follow-field"><label>Durée habituelle des règles</label><input name="period_length" type="number" min="1" max="10" step="1" value="${esc(settings.period_length||5)}" required></div><div class="mt-follow-field"><label>Durée habituelle du cycle</label><input name="cycle_length" type="number" min="20" max="45" step="1" value="${esc(settings.cycle_length||28)}" required></div><div class="mt-follow-field"><label>Régularité du cycle</label><select name="regularity"><option ${settings.regularity==='Plutôt régulier'?'selected':''}>Plutôt régulier</option><option ${settings.regularity==='Variable'?'selected':''}>Variable</option><option ${settings.regularity==='Je ne sais pas'?'selected':''}>Je ne sais pas</option></select></div><div class="mt-follow-help">Les dates, phases et fenêtres d’ovulation sont des estimations de bien-être. Elles ne confirment pas une ovulation et ne doivent jamais être utilisées comme contraception.</div>`;
  }

  window.mtAdvancedTrackerConfigure=function(rawKey,after){
    addCSS();const key=normalizeKey(rawKey),item=tracker(key);if(!item?.configurable)return;
    pendingAfterConfig=after||pendingAfterConfig;
    const settings=preference(key).settings||{},modal=root('mtAdvancedTrackerConfig','mt-follow-config');
    modal.dataset.key=key;
    modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerConfigClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerConfigClose()">×</button><div class="mt-follow-kicker">Configuration privée</div><h2>${esc(item.title)}</h2><p class="mt-follow-intro">Quelques repères suffisent pour adapter ce suivi à ton rythme.</p><form class="mt-follow-form" id="mtAdvancedTrackerConfigForm">${configHTML(key,settings)}<button class="mt-follow-save" type="submit">Enregistrer et activer</button></form></section>`;
    modal.classList.add('open');
    document.getElementById('mtAdvancedTrackerConfigForm').onsubmit=saveConfig;
    if(key==='performance_recuperation'){
      const disciplineSelect=modal.querySelector('[name="discipline"]'),otherField=modal.querySelector('[data-other-discipline]');
      const syncOther=()=>{if(otherField)otherField.hidden=disciplineSelect?.value!=='Autre';};
      disciplineSelect?.addEventListener('change',syncOther);syncOther();
    }
  };
  window.mtAdvancedTrackerConfigClose=()=>{root('mtAdvancedTrackerConfig','mt-follow-config').classList.remove('open');pendingAfterConfig=null;};

  async function saveConfig(event){
    event.preventDefault();const modal=root('mtAdvancedTrackerConfig','mt-follow-config'),key=normalizeKey(modal.dataset.key),fd=new FormData(event.currentTarget),current=preference(key),settings={...(current.settings||{})};
    if(key==='performance_recuperation'){
      settings.discipline=String(fd.get('discipline')||'');settings.discipline_other=String(fd.get('discipline_other')||'').trim();settings.level=String(fd.get('level')||'Loisir');
      if(!DISCIPLINES.includes(settings.discipline)){toast('Choisis d’abord ton activité.');return;}
    }else if(key==='cycle'){
      settings.last_period_start=String(fd.get('last_period_start')||'');settings.period_length=Math.min(10,Math.max(1,Number(fd.get('period_length'))||5));settings.cycle_length=Math.min(45,Math.max(20,Number(fd.get('cycle_length'))||28));settings.regularity=String(fd.get('regularity')||'Je ne sais pas');
      if(!parseDate(settings.last_period_start)){toast('Choisis la date du premier jour de tes dernières règles.');return;}
      const estimate=cycleEstimate(settings,TODAY());if(estimate)settings.latest_summary=trackerSummary(key,{},settings,TODAY());
    }
    PREFS[key]={...current,enabled:true,settings};await savePreference(key);modal.classList.remove('open');
    if(document.getElementById('mtAdvancedTrackers')?.classList.contains('open'))renderCatalog();
    toast(`${TRACKERS[key].title} ajouté à Mes suivis.`);
    const after=pendingAfterConfig;pendingAfterConfig=null;if(after?.entry)window.mtAdvancedTrackerEntry(key,after.date||TODAY());
  }

  function inputAttrs(attrs={}){return Object.entries(attrs).map(([key,value])=>`${esc(key)}="${esc(value)}"`).join(' ');}
  function fieldHTML(def,values={}){
    const current=val(values,def.key,def.type==='range'?5:'');
    if(def.type==='range')return `<div class="mt-follow-field"><label>${esc(def.label)}</label><div class="mt-follow-range"><input name="${esc(def.key)}" type="range" min="0" max="10" step="1" value="${esc(current)}" oninput="this.nextElementSibling.value=this.value+'/10'"><output>${esc(current)}/10</output></div></div>`;
    if(def.type==='select')return `<div class="mt-follow-field"><label>${esc(def.label)}</label><select name="${esc(def.key)}"><option value="">Choisir…</option>${(def.options||[]).map(option=>`<option value="${esc(option)}" ${String(current)===String(option)?'selected':''}>${esc(option)}</option>`).join('')}</select></div>`;
    if(def.type==='textarea')return `<div class="mt-follow-field"><label>${esc(def.label)}</label><textarea name="${esc(def.key)}" placeholder="Écris seulement ce qui t’est utile.">${esc(current)}</textarea></div>`;
    return `<div class="mt-follow-field"><label>${esc(def.label)}</label><input name="${esc(def.key)}" type="${esc(def.type)}" value="${esc(current)}" ${inputAttrs(def.attrs)} ${def.type==='number'?'inputmode="decimal"':''}></div>`;
  }

  async function fetchEntry(key,date){
    const local=readLocalEntry(key,date),c=client();if(!c||!UID)return local;
    try{
      const query=c.from('user_tracker_entries').select('tracker_key,entry_date,values,note,updated_at').eq('user_id',UID).eq('tracker_key',key).eq('entry_date',date).maybeSingle();
      const result=await Promise.race([query,new Promise(resolve=>setTimeout(()=>resolve({data:null}),1800))]);
      const remote=result?.data||null;if(remote){writeLocalEntry(key,date,remote);return remote;}return local;
    }catch(e){return local;}
  }

  function estimateHTML(key,settings,date){
    if(key!=='cycle')return '';
    const estimate=cycleEstimate(settings,date);if(!estimate)return '';
    const caution=String(settings.regularity||'').toLowerCase()==='variable'?'Estimation prudente car ton cycle est indiqué comme variable.':'Cette estimation évoluera avec les prochaines dates renseignées.';
    return `<div class="mt-follow-estimate"><small>Repère estimé</small><b>Jour ${estimate.cycleDay} · ${esc(estimate.phase)}</b><p>Prochaines règles estimées vers le ${esc(fmtDate(estimate.nextPeriod))}. Fenêtre d’ovulation estimée autour du ${esc(fmtDate(estimate.ovulationDate))}. ${esc(caution)}</p></div>`;
  }

  window.mtAdvancedTrackerEntry=async function(rawKey,date=TODAY()){
    addCSS();const key=normalizeKey(rawKey),item=tracker(key);if(!item)return;
    if(!UID)UID=(await getUser())?.id||window.__MT_LIBRARY_USER_ID__||null;
    PREFS=Object.keys(PREFS).length?PREFS:readPrefs(UID);
    const pref=preference(key);
    if(item.configurable&&((key==='cycle'&&!pref.settings?.last_period_start)||(key==='performance_recuperation'&&!pref.settings?.discipline))){pendingAfterConfig={entry:true,date};return window.mtAdvancedTrackerConfigure(key,pendingAfterConfig);}
    const modal=root('mtAdvancedTrackerEntry','mt-follow-entry');modal.dataset.key=key;modal.dataset.date=date;
    modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><div class="mt-follow-loading"><b>${esc(item.title)}</b><p>Ouverture de ton suivi…</p><span></span></div></section>`;modal.classList.add('open');
    const existing=await fetchEntry(key,date),values=existing?.values||{},settings=preference(key).settings||{},fields=fieldsFor(key,settings);
    const discipline=key==='performance_recuperation'?(settings.discipline==='Autre'&&settings.discipline_other?settings.discipline_other:settings.discipline):'';
    modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><div class="mt-follow-kicker">${esc(item.title)}${discipline?` · ${esc(discipline)}`:''}</div><h2>${date===TODAY()?"Aujourd’hui":esc(fmtDate(date))}</h2><p class="mt-follow-intro">${esc(item.description)}</p>${estimateHTML(key,settings,date)}<form class="mt-follow-form" id="mtAdvancedTrackerForm">${fields.map(def=>fieldHTML(def,values)).join('')}<div class="mt-follow-field"><label>Note libre (facultatif)</label><textarea name="_note" placeholder="Un détail que tu veux retenir…">${esc(existing?.note||'')}</textarea></div><button class="mt-follow-save" type="submit">Enregistrer ce repère</button></form></section>`;
    document.getElementById('mtAdvancedTrackerForm').onsubmit=saveEntry;
  };
  window.mtAdvancedTrackerEntryClose=()=>root('mtAdvancedTrackerEntry','mt-follow-entry').classList.remove('open');

  async function saveEntry(event){
    event.preventDefault();const modal=root('mtAdvancedTrackerEntry','mt-follow-entry'),key=normalizeKey(modal.dataset.key),date=modal.dataset.date||TODAY(),fd=new FormData(event.currentTarget),values={};
    for(const [name,value] of fd.entries())if(name!=='_note'&&String(value).trim()!=='')values[name]=value;
    const note=String(fd.get('_note')||'').trim()||null,pref=preference(key),settings={...(pref.settings||{})};
    if(key==='cycle'&&values.new_period==='Oui')settings.last_period_start=date;
    if(key==='performance_recuperation')values._discipline=settings.discipline==='Autre'?(settings.discipline_other||'Autre'):(settings.discipline||'Activité');
    if(key==='sommeil_profond'){
      const hours=durationBetween(values.bedtime,values.wake_time);if(hours)values._sleep_hours=hours;
    }
    if(key==='jeune_intermit'){
      const hours=durationBetween(values.last_meal,values.first_meal);if(hours)values._fast_hours=hours;
    }
    if(key==='cycle'){
      const estimate=cycleEstimate(settings,date);if(estimate){values.cycle_day_estimate=estimate.cycleDay;values.cycle_phase_estimate=estimate.phase;values.next_period_estimate=estimate.nextPeriod;values.ovulation_window_estimate=estimate.ovulationDate;}
    }
    const daily=trackerDailySummary(key,values,settings,date);values._daily=daily;
    const summary=daily.headline;
    if(!settings.latest_date||date>=settings.latest_date){settings.latest_date=date;settings.latest_summary=summary;}
    PREFS[key]={...pref,enabled:true,settings,updated_at:new Date().toISOString()};writePrefs();
    const payload={tracker_key:key,entry_date:date,values,note,updated_at:new Date().toISOString()};writeLocalEntry(key,date,payload);
    let remoteSaved=false;const c=client();
    if(c&&UID){
      try{
        const {error}=await c.from('user_tracker_entries').upsert({user_id:UID,...payload},{onConflict:'user_id,tracker_key,entry_date'});if(error)throw error;
        const prefResult=await c.from('user_tracker_preferences').upsert({user_id:UID,tracker_key:key,enabled:true,settings,updated_at:new Date().toISOString()},{onConflict:'user_id,tracker_key'});if(prefResult.error)throw prefResult.error;remoteSaved=true;
      }catch(e){console.warn('[Mes suivis] repère conservé localement',e);}
    }
    modal.classList.remove('open');window.mtRefreshCarnetTrackers?.();window.mtRefreshParcoursCalendar?.();
    window.dispatchEvent(new CustomEvent('mt:custom-trackers-changed',{detail:{key,date,values,summary}}));
    window.dispatchEvent(new CustomEvent('mt:daily-state-changed',{detail:{source:'custom_trackers'}}));
    toast(remoteSaved?'Repère enregistré.':'Repère enregistré sur cet appareil.');
  }

  window.mtCustomTrackersCatalog=TRACKERS;
  window.mtCustomTrackerSummary=trackerSummary;
  window.mtCustomTrackerDailySummary=trackerDailySummary;
  window.mtCustomCycleEstimate=cycleEstimate;
})();
