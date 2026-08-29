// MÉTHODE TEE — V365 · SUIVIS · BOUCLE D’ACCOMPAGNEMENT + HISTORIQUE (lazy-load)
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
  const HISTORY_DAYS=27;
  const fmtNavDate=iso=>{const d=parseDate(iso);if(!d)return String(iso||'');const label=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(d);return label.charAt(0).toUpperCase()+label.slice(1);};
  const fmtNavToday=iso=>{const d=parseDate(iso);if(!d)return 'Aujourd’hui';const short=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long'}).format(d);return `Aujourd’hui · ${short}`;};
  const minHistoryDate=()=>addDays(TODAY(),-HISTORY_DAYS);
  const clampHistoryDate=iso=>{const today=TODAY(),min=minHistoryDate();return !parseDate(iso)?today:(iso>today?today:(iso<min?min:iso));};
  const val=(values,key,fallback='')=>values&&values[key]!==undefined&&values[key]!==null&&values[key]!==''?values[key]:fallback;
  const num=value=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;};
  const present=value=>value!==null&&value!==undefined&&String(value)!=='';
  const avg=(...values)=>{const list=values.map(num).filter(Number.isFinite);return list.length?Math.round(list.reduce((a,b)=>a+b,0)/list.length*10)/10:null;};
  const semanticScore=(value,scores={})=>Object.prototype.hasOwnProperty.call(scores,String(value||''))?scores[String(value)]:null;
  const formatDuration=hours=>{const n=num(hours);if(n===null)return '';const whole=Math.floor(n),minutes=Math.round((n-whole)*60);return `${whole}h${minutes?String(minutes).padStart(2,'0'):''}`;};
  const field=(key,label,type='range',options=null,attrs={})=>({key,label,type,options,attrs});

  const CATEGORIES=[
    ['quotidien','Mon quotidien','Sommeil, énergie et récupération générale.'],
    ['alimentation','Mon alimentation','Digestion, équilibre et rythme alimentaire.'],
    ['corps','Mon corps','Évolution, peau et symptômes personnels.'],
    ['performance','Mon activité','Des repères adaptés à toutes les façons de bouger, sans objectif de performance imposé.'],
    ['hormonal','Mon rythme hormonal','Des repères facultatifs, privés et toujours présentés comme des estimations.'],
    ['habitudes','Mes habitudes','Jeûne, sucre et habitudes à faire évoluer sans culpabilisation.']
  ];

  const TRACKERS={
    sommeil_profond:{category:'quotidien',title:'Sommeil approfondi',description:'Comprendre la qualité de tes nuits au-delà de leur durée.',fields:[
      field('night_state','Comment s’est passée ta nuit ?','select',['Réparatrice','Correcte','Agitée','Trop courte','Je ne souhaite pas l’évaluer']),
      field('bedtime','Heure de coucher','time'),field('wake_time','Heure de réveil','time'),
      field('latency','Temps d’endormissement (si tu le connais)','number',null,{min:0,max:240,step:5}),
      field('awakenings','Réveils nocturnes (si tu les as remarqués)','number',null,{min:0,max:20,step:1}),
      field('quality','Qualité ressentie','range',null,{optional:true}),field('wake_state','État au réveil','range',null,{optional:true}),
      field('evening_routine','Routine du soir','select',['Oui','Non','Pas aujourd’hui']),field('screens','Écrans avant le coucher','select',['Non','Oui','Je ne sais pas'])
    ]},
    digestion:{category:'alimentation',title:'Confort digestif',description:'Repérer ce qui soutient ou perturbe ta digestion.',fields:[
      field('day_state','Ta digestion aujourd’hui','select',['Confortable','Quelques gênes','Inconfort marqué','Je ne souhaite pas l’évaluer']),
      field('comfort','Confort digestif','range',null,{optional:true}),field('bloating','Ballonnements','range',null,{optional:true}),field('gas','Gaz','range',null,{optional:true}),
      field('pain','Douleurs','range',null,{optional:true}),field('transit','Transit (si pertinent)','select',['Habituel','Ralenti','Accéléré','Je ne sais pas']),
      field('foods','Repas ou aliments possiblement associés','textarea'),field('stress','Stress ressenti','range',null,{optional:true})
    ]},
    reflux:{category:'alimentation',title:'Reflux & aigreurs',description:'Observer les circonstances d’apparition et ce qui soulage.',fields:[
      field('episode','As-tu ressenti un reflux ou une aigreur ?','select',['Non aujourd’hui','Oui, une fois','Oui, plusieurs fois']),
      field('onset','Heure d’apparition (si concernée)','time'),field('intensity','Intensité ressentie','range',null,{optional:true}),field('previous_meal','Repas précédent (si utile)','textarea'),
      field('position','Position après le repas','select',['Debout / en mouvement','Assise','Allongée','Variable']),
      field('drinks','Boissons possiblement associées','textarea'),field('stress','Stress ressenti','range',null,{optional:true}),field('relief','Ce qui a soulagé','textarea')
    ]},
    equilibre_alimentaire:{category:'alimentation',title:'Équilibre alimentaire',description:'Suivre la diversité et la régularité sans transformer ton Carnet en compteur.',fields:[
      field('meals','Combien de repas souhaites-tu observer ?','select',['1 repas','2 repas','3 repas','Plus de 3']),
      field('diversity','Diversité dans l’assiette','range',null,{optional:true}),field('protein','Présence de protéines','range',null,{optional:true}),field('plants','Présence de végétaux','range',null,{optional:true}),
      field('hydration','Hydratation autour des repas','range',null,{optional:true}),field('prepared','Repas préparé / maison','select',['Oui, principalement','En partie','Non']),
      field('screenfree','Présence pendant les repas','select',['Plutôt présente','Variable','Souvent distraite']),field('schedule','Régularité des horaires','range',null,{optional:true})
    ]},
    evolution_corporelle:{category:'corps',title:'Évolution corporelle',description:'Des repères facultatifs, au-delà du chiffre sur la balance.',fields:[
      field('day_state','Que souhaites-tu observer aujourd’hui ?','select',['Mon ressenti corporel','Une mesure','Un changement remarqué','Rien de particulier']),
      field('weight','Poids (facultatif)','number',null,{min:20,max:400,step:.1}),field('waist','Tour de taille en cm (facultatif)','number',null,{min:30,max:250,step:.5}),
      field('hips','Tour de hanches en cm (facultatif)','number',null,{min:30,max:250,step:.5}),
      field('clothes','Sensation dans les vêtements','select',['Plus ample','Stable','Plus ajusté','Non observée']),
      field('hunger','Faim ressentie','range',null,{optional:true}),field('satiety','Satiété','range',null,{optional:true}),field('energy','Énergie','range',null,{optional:true})
    ]},
    peau:{category:'corps',title:'Peau',description:'Relier l’état de ta peau à tes autres repères.',fields:[
      field('day_state','État général de ta peau','select',['Confortable','Quelques changements','Plus réactive aujourd’hui','Non observée']),
      field('blemishes','Imperfections','range',null,{optional:true}),field('dryness','Sécheresse','range',null,{optional:true}),field('inflammation','Rougeurs / inflammation','range',null,{optional:true}),
      field('sensitivity','Sensibilité','range',null,{optional:true}),field('sleep','Sommeil ressenti','range',null,{optional:true}),field('stress','Stress','range',null,{optional:true}),field('products','Nouveau produit ou soin utilisé','textarea')
    ]},
    performance_recuperation:{category:'performance',title:'Activité & récupération',description:'Observer ton mouvement, ton énergie et ta récupération, quelle que soit ta pratique.',configurable:true},
    cycle:{category:'hormonal',title:'Cycle & rythme hormonal',description:'Un suivi facultatif avec estimations prudentes, jamais présenté comme une contraception.',configurable:true},
    perimenopause:{category:'hormonal',title:'Périménopause & ménopause',description:'Noter uniquement ce qui est présent aujourd’hui, sans supposer de symptôme ni poser de diagnostic.',fields:[
      field('day_state','Comment te sens-tu aujourd’hui ?','select',['Aucun symptôme particulier','Quelques changements à noter','Journée plus inconfortable']),
      field('hot_flashes','Bouffées de chaleur (si présentes)','select',['Aucune aujourd’hui','1 à 2','3 à 5','Plus de 5','Je ne souhaite pas les compter']),
      field('night_sweats','Sueurs nocturnes (si présentes)','select',['Aucune','Légères','Modérées','Marquées']),
      field('sleep','Sommeil','range',null,{optional:true}),field('mood','Humeur','range',null,{optional:true}),
      field('energy','Énergie','range',null,{optional:true}),field('digestion','Confort digestif','range',null,{optional:true}),
      field('joint_pain','Douleurs articulaires','range',null,{optional:true}),field('symptoms','Autre changement que tu souhaites noter','textarea')
    ]},
    jeune_intermit:{category:'habitudes',title:'Jeûne intermittent',description:'Observer ton rythme de jeûne, ta faim et ta rupture sans rigidité.',fields:[
      field('fast_state','Aujourd’hui','select',['Je jeûne aujourd’hui','Je fais une pause','Je souhaite seulement observer mon rythme']),
      field('last_meal','Dernier repas','time'),field('first_meal','Premier repas / rupture','time'),field('hunger','Faim pendant le jeûne','range',null,{optional:true}),
      field('energy','Énergie','range',null,{optional:true}),field('hydration','Hydratation ressentie','range',null,{optional:true}),field('break_quality','Confort après la rupture','range',null,{optional:true})
    ]},
    reduction_sucre:{category:'habitudes',title:'Réduction du sucre',description:'Comprendre les envies plutôt que seulement compter les jours.',fields:[
      field('craving_state','Envie sucrée aujourd’hui','select',['Aucune','Légère','Présente','Forte']),field('craving','Intensité si tu souhaites la préciser','range',null,{optional:true}),field('moment','Moment des envies','text'),
      field('trigger','Déclencheur possible','select',['Faim','Stress','Habitude','Émotion','Fatigue','Convivialité','Je ne sais pas','Autre']),field('products','Produits sucrés consommés (facultatif)','textarea'),
      field('alternative','Alternative choisie','textarea'),field('no_added_sugar','Journée sans sucre ajouté','select',['Oui','Non'])
    ]},
    changer_habitude:{category:'habitudes',title:'Changer une habitude',description:'Suivre déclencheurs, réponses et petites victoires sans culpabilisation.',configurable:true,fields:[
      field('day_state','Comment s’est passée la journée ?','select',['Petit pas réalisé','J’ai observé sans agir','Journée difficile','Pas concernée aujourd’hui']),
      field('urge','Envie ou impulsion','range',null,{optional:true}),field('trigger','Déclencheur observé','textarea'),
      field('moment','Moment','text'),field('response','Réponse choisie','textarea'),field('victory','Petite victoire du jour','textarea'),
      field('setback','Ce que tu souhaites comprendre, sans jugement','textarea')
    ]}
  };

  const ALIASES={performance_sportive:'performance_recuperation',football:'performance_recuperation',recuperation:'performance_recuperation'};
  const DISCIPLINES=['Pilates','Yoga','Fitness / cours collectifs','Marche / randonnée','Mobilité / stretching','Danse','Musculation','Course','Natation','Cyclisme','Football','Basketball','Tennis','Boxe','Autre'];
  const LEVELS=['Occasionnelle','Régulière','Intensive','Compétition'];
  const normalizePracticeRhythm=value=>({Loisir:'Occasionnelle','Régulier':'Régulière',Professionnel:'Intensive'}[String(value||'')]||String(value||'Occasionnelle'));
  const normalizeKey=key=>ALIASES[String(key||'')]||String(key||'');
  const tracker=key=>TRACKERS[normalizeKey(key)]||null;

  let UID=null;
  let PREFS={};
  let pendingAfterConfig=null;
  const HISTORY_CACHE=new Map();
  const HISTORY_TTL=5*60*1000;

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
      .mt-follow-kicker{font-size:11px;letter-spacing:.21em;text-transform:uppercase;color:#b28d45;font-weight:900}.mt-follow-sheet h2{font-family:Georgia,serif;font-weight:400;font-size:clamp(34px,8vw,48px);line-height:1.02;margin:10px 58px 9px 0}.mt-follow-date-nav{display:grid;grid-template-columns:38px minmax(0,1fr) 38px;align-items:center;width:min(100%,360px);min-height:42px;margin:3px 0 14px;border:1px solid rgba(201,176,122,.30);border-radius:999px;background:rgba(255,253,248,.62);overflow:hidden}.mt-follow-date-nav button{width:38px;height:40px;border:0;background:transparent;color:#173b31;font-size:24px;line-height:1;display:grid;place-items:center}.mt-follow-date-nav button:disabled{opacity:.22}.mt-follow-date-nav strong{min-width:0;text-align:center;color:#6f665d;font-size:12px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mt-follow-date-nav.is-loading{opacity:.62;pointer-events:none}.mt-follow-intro{color:#847667;font-size:14px;line-height:1.55;margin:0 0 20px}
      .mt-follow-active{display:flex;gap:8px;overflow:auto;padding:2px 0 18px}.mt-follow-chip{white-space:nowrap;border:1px solid #dfd4c1;background:#fffaf1;padding:10px 13px;border-radius:999px;color:#173b31;font-weight:750}
      .mt-follow-empty{padding:15px;border-radius:19px;background:#f2ece2;color:#796d60;font-size:13px;line-height:1.5}.mt-follow-cat{border-top:1px solid #e4dccf;padding:19px 0}.mt-follow-cat h3{font-family:Georgia,serif;font-weight:400;font-size:25px;margin:0 0 5px}.mt-follow-cat>p{margin:0 0 11px;color:#8a7c6d;font-size:13px;line-height:1.45}
      .mt-follow-row{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:14px 0;border-top:1px solid #eee6d9}.mt-follow-row b{display:block;font-size:14px}.mt-follow-row small{display:block;color:#897b6c;line-height:1.38;margin-top:4px;max-width:48ch}.mt-follow-row-actions{display:flex;gap:7px;align-items:center}.mt-follow-action{border:1px solid #c9b07a;border-radius:999px;background:transparent;color:#173b31;font-weight:850;padding:9px 12px}.mt-follow-action.is-on{background:#173b31;color:#fff;border-color:#173b31}.mt-follow-configure{border:0;background:transparent;color:#a77f37;font-weight:850;padding:8px 2px}
      .mt-follow-form{display:grid;gap:15px}.mt-follow-field label{display:block;font-weight:850;font-size:13px;margin-bottom:7px}.mt-follow-field input,.mt-follow-field select,.mt-follow-field textarea{width:100%;box-sizing:border-box;border:1px solid #ddd2c1;background:#fffdf8;color:#173b31;border-radius:18px;padding:13px 14px;font:inherit}.mt-follow-field textarea{min-height:92px;resize:vertical}.mt-follow-range{display:grid;grid-template-columns:1fr 55px;gap:11px;align-items:center}.mt-follow-range output{text-align:center;font-weight:850}.mt-follow-optional-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.mt-follow-optional-head label{margin:0}.mt-follow-optional-toggle{border:1px solid #d9ccb7;background:#fffaf1;color:#7b6848;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:850}.mt-follow-optional-range .mt-follow-range{margin-top:11px}.mt-follow-optional-range .mt-follow-range[hidden]{display:none}.mt-follow-save{width:100%;border:0;border-radius:18px;background:#173b31;color:white;padding:16px;font-weight:900;margin-top:4px}.mt-follow-help{padding:14px 15px;border-radius:18px;background:#f2ece2;color:#76695e;font-size:12px;line-height:1.55}.mt-follow-fixed-context{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 14px;padding:11px 14px;border:1px solid rgba(201,176,122,.26);border-radius:16px;background:rgba(255,250,241,.72)}.mt-follow-fixed-context small{color:#a77f37;font-size:10px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.mt-follow-fixed-context strong{color:#173b31;font-size:13px;font-weight:850}.mt-follow-estimate{padding:17px;border:1px solid rgba(178,141,69,.24);background:#fff8ea;border-radius:20px}.mt-follow-estimate small{display:block;color:#a77f37;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.mt-follow-estimate b{display:block;font-family:Georgia,serif;font-size:22px;font-weight:500;margin:7px 0 4px}.mt-follow-estimate p{margin:0;color:#796c60;font-size:13px;line-height:1.45}.mt-follow-loading{text-align:center;padding:35px 10px;color:#7e7164}.mt-follow-loading b{display:block;font-family:Georgia,serif;font-size:27px;font-weight:400;color:#173b31;margin-bottom:8px}.mt-follow-loading span{display:inline-block;width:25px;height:25px;border:2px solid rgba(23,59,49,.16);border-top-color:#173b31;border-radius:50%;animation:mtFollowSpin .8s linear infinite;margin-top:14px}@keyframes mtFollowSpin{to{transform:rotate(360deg)}}
      .mt-cycle-event{border:1px solid rgba(178,141,69,.26);background:#fffaf0;border-radius:20px;padding:15px}.mt-cycle-event small{display:block;color:#847667;font-size:12px;line-height:1.45;margin-bottom:11px}.mt-cycle-event button{width:100%;border:1px solid #c9b07a;border-radius:999px;background:#fffdf8;color:#173b31;padding:12px;font-weight:900}.mt-cycle-event.is-on{background:#f2ead9}.mt-cycle-event.is-on button{background:#173b31;border-color:#173b31;color:#fff}.mt-cycle-event-status{display:none;margin:0 0 8px;color:#9a7636;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.mt-cycle-event.is-on .mt-cycle-event-status{display:block}
      .mt-follow-history-head{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:5px 0 18px}.mt-follow-period{border:1px solid #d8ccb9;background:#fffaf1;color:#173b31;border-radius:999px;padding:10px 15px;font-weight:850}.mt-follow-period.is-on{background:#173b31;border-color:#173b31;color:#fff}.mt-follow-history-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:15px}.mt-follow-stat{padding:16px;border-radius:20px;background:#fffdf8;border:1px solid #e5dccf}.mt-follow-stat b{display:block;font-family:Georgia,serif;font-size:27px;font-weight:400}.mt-follow-stat small{display:block;color:#847667;line-height:1.35;margin-top:3px}.mt-follow-insight{padding:17px;border-radius:21px;background:#173b31;color:#fff;margin:0 0 15px}.mt-follow-insight small{display:block;color:#d1b46f;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.mt-follow-insight b{display:block;font-family:Georgia,serif;font-size:23px;font-weight:400;line-height:1.08;margin:7px 0}.mt-follow-insight p{margin:0;color:rgba(255,255,255,.78);font-size:13px;line-height:1.5}.mt-follow-history-list{display:grid;gap:10px}.mt-follow-history-row{padding:15px;border-radius:20px;background:#fffdf8;border:1px solid #e5dccf}.mt-follow-history-row header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.mt-follow-history-row strong{font-size:14px}.mt-follow-history-row p{margin:6px 0 0;color:#847667;font-size:12px;line-height:1.45}.mt-follow-history-actions{display:flex;gap:7px}.mt-follow-history-actions button{border:1px solid #d8ccb9;background:transparent;color:#173b31;border-radius:999px;padding:8px 10px;font-size:11px;font-weight:850}.mt-follow-history-actions .is-danger{color:#8a4038}.mt-follow-history-empty{padding:22px;border-radius:20px;background:#f2ece2;color:#796d60;text-align:center;line-height:1.5}.mt-follow-secondary{width:100%;border:1px solid #c9b07a;border-radius:18px;background:transparent;color:#173b31;padding:14px;font-weight:900;margin-top:10px}.mt-follow-result-actions{display:grid;gap:10px;margin-top:18px}.mt-follow-result-actions .mt-follow-save,.mt-follow-result-actions .mt-follow-secondary{margin:0}
      .mt-follow-coach{padding:14px 15px;border:1px solid rgba(178,141,69,.24);border-radius:18px;background:#fff8ea;margin:0 0 16px}.mt-follow-coach small{display:block;color:#a77f37;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.mt-follow-coach b{display:block;margin:6px 0 3px;font-size:14px}.mt-follow-coach p{margin:0;color:#796c60;font-size:12px;line-height:1.5}.mt-follow-coach-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.mt-follow-coach-actions button{border:1px solid #d8ccb9;background:#fffdf8;color:#173b31;border-radius:999px;padding:9px 11px;font-size:11px;font-weight:850}
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
    const starts=[...new Set([...(Array.isArray(settings.period_starts)?settings.period_starts:[]),settings.last_period_start].filter(value=>parseDate(value)))].sort();
    const eligible=starts.filter(value=>value<=date),start=String(eligible.length?eligible[eligible.length-1]:(starts[0]||''));
    if(!parseDate(start)||!parseDate(date))return null;
    const cycleLength=Math.min(45,Math.max(20,Number(settings.cycle_length)||28));
    const periodLength=Math.min(10,Math.max(1,Number(settings.period_length)||5));
    const elapsed=dayDiff(start,date);
    const cycleIndex=Math.floor(elapsed/cycleLength);
    const cycleDay=((elapsed%cycleLength)+cycleLength)%cycleLength+1;
    const ovulationDay=Math.max(periodLength+3,cycleLength-14);
    let phase='Phase lutéale';
    if(cycleDay<=periodLength)phase='Période menstruelle';
    else if(cycleDay<ovulationDay-2)phase='Phase folliculaire';
    else if(cycleDay===ovulationDay)phase='Ovulation';
    else if(cycleDay<=ovulationDay+2)phase="Fenêtre d’ovulation";
    const nextPeriod=addDays(start,(cycleIndex+1)*cycleLength);
    const ovulationDate=addDays(start,cycleIndex*cycleLength+ovulationDay-1);
    const cycleEvent=cycleDay<=periodLength?'menstrual':cycleDay===ovulationDay?'ovulation_day':cycleDay>=ovulationDay-2&&cycleDay<=ovulationDay+2?'ovulation_window':null;
    return {cycleDay,phase,cycleEvent,cycleLength,periodLength,ovulationDay,nextPeriod,ovulationDate,regularity:settings.regularity||'Je ne sais pas'};
  }

  function performanceSessionOptions(settings={}){
    const discipline=String(settings.discipline||'Autre'),level=normalizePracticeRhythm(settings.level);
    if(['Football','Basketball','Tennis'].includes(discipline))return ['Entraînement','Match / compétition','Pratique libre','Récupération active','Repos'];
    if(discipline==='Boxe')return ['Entraînement','Technique / sparring','Combat / compétition','Pratique libre','Récupération active','Repos'];
    if(discipline==='Course')return ['Entraînement','Course / compétition','Sortie libre','Récupération active','Repos'];
    if(discipline==='Natation')return ['Entraînement','Compétition','Nage libre','Récupération active','Repos'];
    if(discipline==='Cyclisme')return ['Entraînement','Course / compétition','Sortie libre','Récupération active','Repos'];
    if(discipline==='Danse')return ['Cours','Répétition','Pratique libre','Spectacle / représentation','Récupération active','Repos'];
    if(discipline==='Pilates')return ['Cours','Séance guidée','Pratique libre','Récupération / mobilité','Repos'];
    if(discipline==='Yoga')return ['Cours','Pratique guidée','Pratique libre','Récupération / respiration','Repos'];
    if(discipline==='Fitness / cours collectifs')return ['Cours','Séance / entraînement','Pratique libre','Récupération active','Repos'];
    if(discipline==='Marche / randonnée')return ['Marche / sortie','Randonnée','Déplacement actif','Récupération active','Repos'];
    if(discipline==='Mobilité / stretching')return ['Séance mobilité','Stretching','Pratique libre','Récupération active','Repos'];
    if(discipline==='Musculation')return ['Séance / entraînement','Pratique libre',...(level==='Compétition'?['Compétition']:[]),'Récupération active','Repos'];
    return ['Séance / pratique','Cours','Pratique libre',...(level==='Compétition'?['Événement / compétition']:[]),'Récupération active','Repos'];
  }

  function performanceFields(settings={}){
    const discipline=String(settings.discipline||'Autre');
    const base=[
      field('session','Ta pratique aujourd’hui','select',performanceSessionOptions(settings)),
      field('duration','Durée (min, si utile)','number',null,{min:0,max:600,step:5}),field('intensity','Intensité ressentie','range',null,{optional:true}),
      field('energy_before','Énergie avant la pratique','range',null,{optional:true}),field('fatigue_after','Fatigue après la pratique','range',null,{optional:true}),
      field('recovery','Récupération ressentie','range',null,{optional:true}),field('readiness','Disponibilité pour ta prochaine pratique','range',null,{optional:true}),
      field('sleep_quality','Sommeil avant cette pratique','range',null,{optional:true}),field('pain','Inconfort ou douleur à retenir','textarea'),field('hydration','Hydratation ressentie','range',null,{optional:true})
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
    if(discipline==='Pilates')return base.concat([
      field('pilates_style','Format','select',['Au sol','Reformer / machines','Cours collectif','Pratique libre']),field('mobility','Mobilité / aisance','range')
    ]);
    if(discipline==='Yoga')return base.concat([
      field('yoga_style','Type de pratique','select',['Douce','Dynamique','Restaurative','Méditative','Mixte']),field('mobility','Mobilité / aisance','range')
    ]);
    if(discipline==='Fitness / cours collectifs')return base.concat([
      field('fitness_style','Format','select',['Renforcement','Cardio','HIIT','Circuit','Cours collectif','Mixte'])
    ]);
    if(discipline==='Marche / randonnée')return base.concat([
      field('walk_style','Format','select',['Marche douce','Marche active','Randonnée','Déplacement']),field('distance','Distance (km, facultatif)','number',null,{min:0,max:200,step:.1})
    ]);
    if(discipline==='Mobilité / stretching')return base.concat([
      field('mobility','Mobilité / aisance','range'),field('body_focus','Zone travaillée (facultatif)','text')
    ]);
    return base;
  }

  function cycleFields(){return [
    field('day_state','Comment te sens-tu aujourd’hui ?','select',['Rien de particulier','Quelques changements à noter','Journée plus inconfortable']),
    field('flow','Flux (si présent)','select',['Aucun','Léger','Modéré','Abondant']),field('pain','Douleurs','range',null,{optional:true}),
    field('energy','Énergie','range',null,{optional:true}),field('mood','Humeur','range',null,{optional:true}),field('appetite','Appétit et envies','range',null,{optional:true}),
    field('sleep','Sommeil','range',null,{optional:true})
  ];}

  function cycleEventHTML(values={}){
    const active=values.new_period==='Oui';
    return `<div class="mt-cycle-event${active?' is-on':''}" data-cycle-event><div class="mt-cycle-event-status">Début des règles signalé pour cette date</div><small>Seulement si de nouvelles règles commencent aujourd’hui, utilise cette action ponctuelle. Tu n’as rien à sélectionner les autres jours.</small><input type="hidden" name="new_period" value="${active?'Oui':'Non'}"><button type="button" onclick="mtAdvancedTrackerTogglePeriodStart(this)">${active?'Annuler ce signalement':'Signaler le début de nouvelles règles'}</button></div>`;
  }

  function shouldOfferPeriodStart(settings={},date,values={}){
    if(values.new_period==='Oui')return true;
    const estimate=cycleEstimate(settings,date);if(!estimate)return false;
    const margin=String(settings.regularity||'').toLowerCase()==='variable'?7:4;
    return estimate.cycleDay>=estimate.cycleLength-margin;
  }

  window.mtAdvancedTrackerTogglePeriodStart=function(button){
    const box=button?.closest?.('[data-cycle-event]'),input=box?.querySelector?.('[name="new_period"]');if(!box||!input)return;
    const active=input.value!=='Oui';input.value=active?'Oui':'Non';box.classList.toggle('is-on',active);button.textContent=active?'Annuler ce signalement':'Signaler le début de nouvelles règles';
  };

  function fieldsFor(key,settings={}){
    key=normalizeKey(key);
    if(key==='performance_recuperation')return performanceFields(settings);
    if(key==='cycle')return cycleFields();
    return TRACKERS[key]?.fields||[];
  }

  function trackerSummary(key,values={},settings={},date=TODAY()){
    key=normalizeKey(key);
    if(key==='sommeil_profond'){
      const hours=durationBetween(values.bedtime,values.wake_time);return [values.night_state||'',hours?`${String(hours).replace('.',',')} h`:'',present(values.quality)?`qualité ${values.quality}/10`:''].filter(Boolean).join(' · ')||'Nuit renseignée';
    }
    if(key==='digestion')return [values.day_state||'',present(values.comfort)?`confort ${values.comfort}/10`:'',present(values.bloating)?`ballonnements ${values.bloating}/10`:''].filter(Boolean).join(' · ')||'Digestion renseignée';
    if(key==='reflux')return [values.episode||'',present(values.intensity)?`intensité ${values.intensity}/10`:''].filter(Boolean).join(' · ')||'Reflux renseigné';
    if(key==='equilibre_alimentaire')return [values.meals||'',present(values.diversity)?`diversité ${values.diversity}/10`:'',present(values.protein)?`protéines ${values.protein}/10`:''].filter(Boolean).join(' · ')||'Alimentation renseignée';
    if(key==='evolution_corporelle')return [values.day_state||'',values.clothes||'',present(values.energy)?`énergie ${values.energy}/10`:''].filter(Boolean).join(' · ')||'Ressenti corporel renseigné';
    if(key==='peau')return [values.day_state||'',present(values.inflammation)?`rougeurs ${values.inflammation}/10`:''].filter(Boolean).join(' · ')||'Peau renseignée';
    if(key==='performance_recuperation')return [values._discipline||(settings.discipline==='Autre'?settings.discipline_other:settings.discipline)||'Activité',values.session||'',values.duration?`${values.duration} min`:'',present(values.recovery)?`récupération ${values.recovery}/10`:''].filter(Boolean).join(' · ');
    if(key==='cycle'){
      const estimate=cycleEstimate(settings,date);return estimate?`J${estimate.cycleDay} · ${estimate.phase}`:'Cycle prêt à configurer';
    }
    if(key==='perimenopause')return values.day_state||[present(values.energy)?`énergie ${values.energy}/10`:'',values.hot_flashes||''].filter(Boolean).join(' · ')||'Journée renseignée';
    if(key==='jeune_intermit'){
      const hours=durationBetween(values.last_meal,values.first_meal);return [values.fast_state||'',hours?`${String(hours).replace('.',',')} h`:'',present(values.energy)?`énergie ${values.energy}/10`:''].filter(Boolean).join(' · ')||'Rythme renseigné';
    }
    if(key==='reduction_sucre')return [values.craving_state||'',present(values.craving)?`envie ${values.craving}/10`:'',values.no_added_sugar?`sans sucre ajouté : ${String(values.no_added_sugar).toLowerCase()}`:''].filter(Boolean).join(' · ')||'Repère sucre renseigné';
    if(key==='changer_habitude')return values.victory?`Petit pas · ${String(values.victory).slice(0,45)}`:(values.day_state||settings.habit||values.habit||'Habitude renseignée');
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
      const hours=num(values._sleep_hours)??durationBetween(values.bedtime,values.wake_time),duration=formatDuration(hours),sleepQuality=num(values.quality)??semanticScore(values.night_state,{Réparatrice:9,Correcte:7,Agitée:4,'Trop courte':3});
      pill('Sommeil',values.night_state||duration||'renseigné');if(present(values.quality))pill('Qualité',`${values.quality}/10`);
      metric('Nuit',values.night_state);metric('Durée',duration);metric('Qualité',present(values.quality)?`${values.quality}/10`:'');metric('État au réveil',present(values.wake_state)?`${values.wake_state}/10`:'');
      if(hours!==null)signals.sleep_minutes=Math.round(hours*60);signals.sleep_quality=sleepQuality;signals.energy=num(values.wake_state);
    }else if(key==='digestion'){
      const digestionScore=num(values.comfort)??semanticScore(values.day_state,{Confortable:9,'Quelques gênes':6,'Inconfort marqué':3});
      pill('Digestion',values.day_state||(present(values.comfort)?`${values.comfort}/10`:'renseignée'));
      metric('Aujourd’hui',values.day_state);metric('Confort',present(values.comfort)?`${values.comfort}/10`:'');metric('Ballonnements',present(values.bloating)?`${values.bloating}/10`:'');metric('Transit',values.transit);
      signals.digestion=digestionScore;signals.bloating=num(values.bloating);signals.stress=num(values.stress);
    }else if(key==='reflux'){
      const intensity=num(values.intensity),none=/^Non/i.test(String(values.episode||'')),level=none?'aucun aujourd’hui':intensity===null?(values.episode||'renseigné'):intensity<=3?'léger':intensity<=6?'modéré':'marqué';pill('Reflux',level);
      metric('Aujourd’hui',values.episode);metric('Intensité',intensity===null?'':`${intensity}/10`);metric('Apparition',values.onset);metric('Soulagement',values.relief);signals.reflux=none?0:intensity;signals.reflux_state=values.episode||null;
    }else if(key==='equilibre_alimentaire'){
      const balance=avg(values.diversity,values.protein,values.plants,values.hydration,values.schedule),meals=parseInt(String(values.meals||''),10)||null;pill('Alimentation',values.meals||(balance===null?'renseignée':`${balance}/10`));
      metric('Repas observés',values.meals);metric('Diversité',present(values.diversity)?`${values.diversity}/10`:'');metric('Protéines',present(values.protein)?`${values.protein}/10`:'');metric('Végétaux',present(values.plants)?`${values.plants}/10`:'');
      signals.nutrition_meals=meals;signals.nutrition_balance=balance===null?null:Math.round(balance*10)/100;signals.nutrition_protein=num(values.protein);signals.nutrition_plants=num(values.plants);signals.hydration_feeling=num(values.hydration);
    }else if(key==='evolution_corporelle'){
      pill('Corps',values.day_state||values.clothes||'repère renseigné');metric('Aujourd’hui',values.day_state);metric('Vêtements',values.clothes);metric('Énergie',present(values.energy)?`${values.energy}/10`:'');metric('Satiété',present(values.satiety)?`${values.satiety}/10`:'');
      signals.energy=num(values.energy);signals.hunger=num(values.hunger);signals.satiety=num(values.satiety);
    }else if(key==='peau'){
      const detailedDiscomfort=avg(values.blemishes,values.dryness,values.inflammation,values.sensitivity),discomfort=detailedDiscomfort??semanticScore(values.day_state,{Confortable:1,'Quelques changements':4,'Plus réactive aujourd’hui':8});pill('Peau',values.day_state||(discomfort===null?'renseignée':`${discomfort}/10`));
      metric('Aujourd’hui',values.day_state);metric('Rougeurs',present(values.inflammation)?`${values.inflammation}/10`:'');metric('Sensibilité',present(values.sensitivity)?`${values.sensitivity}/10`:'');signals.skin_discomfort=discomfort;signals.skin_state=values.day_state||null;signals.stress=num(values.stress);signals.sleep_quality=num(values.sleep);
    }else if(key==='performance_recuperation'){
      const discipline=values._discipline||(settings.discipline==='Autre'?settings.discipline_other:settings.discipline)||'Activité';
      pill('Activité',discipline);if(values.duration)pill('Durée',`${values.duration} min`);if(present(values.recovery))pill('Récupération',`${values.recovery}/10`);
      metric('Activité',discipline);metric('Séance',values.session);metric('Durée',values.duration?`${values.duration} min`:'');metric('Intensité',present(values.intensity)?`${values.intensity}/10`:'');metric('Énergie',present(values.energy_before)?`${values.energy_before}/10`:'');metric('Récupération',present(values.recovery)?`${values.recovery}/10`:'');
      signals.discipline=discipline;signals.sport_duration=num(values.duration);signals.sport_intensity=num(values.intensity);signals.energy=num(values.energy_before);signals.recovery=num(values.recovery);signals.readiness=num(values.readiness)??num(values.availability);signals.sleep_quality=num(values.sleep_quality)??num(values.sleep);signals.fatigue=num(values.fatigue_after)??num(values.muscle_fatigue);
    }else if(key==='cycle'){
      const estimate=cycleEstimate(settings,date),cycleDay=num(values.cycle_day_estimate)??estimate?.cycleDay,phase=values.cycle_phase_estimate||estimate?.phase||'Cycle';
      const cycleEvent=estimate?.cycleEvent||values._cycle_calendar_event||null;
      if(cycleEvent==='ovulation_day')pills.push('Ovulation');else if(cycleEvent==='ovulation_window')pills.push("Fenêtre d’ovulation");else if(cycleEvent==='menstrual')pills.push('Période menstruelle');else pill('Cycle',cycleDay?`J${cycleDay}`:'renseigné');
      metric('Aujourd’hui',values.day_state);metric('Phase',phase);metric('Énergie',present(values.energy)?`${values.energy}/10`:'');metric('Douleurs',present(values.pain)?`${values.pain}/10`:'');metric('Appétit',present(values.appetite)?`${values.appetite}/10`:'');metric('Flux',values.flow);
      signals.cycle_day=cycleDay;signals.cycle_phase=phase;signals.cycle_event=cycleEvent;signals.cycle_state=values.day_state||null;signals.energy=num(values.energy);signals.pain=num(values.pain);signals.appetite=num(values.appetite);signals.sleep_quality=num(values.sleep);signals.mood=num(values.mood);
    }else if(key==='perimenopause'){
      pill('Rythme hormonal',values.day_state||'journée renseignée');metric('Aujourd’hui',values.day_state);metric('Bouffées de chaleur',values.hot_flashes);metric('Sueurs nocturnes',values.night_sweats);metric('Énergie',present(values.energy)?`${values.energy}/10`:'');metric('Sommeil',present(values.sleep)?`${values.sleep}/10`:'');
      signals.menopause_state=values.day_state||null;signals.hot_flashes=values.hot_flashes||null;signals.night_sweats=values.night_sweats||null;signals.energy=num(values.energy);signals.sleep_quality=num(values.sleep);signals.mood=num(values.mood);signals.digestion=num(values.digestion);signals.pain=num(values.joint_pain);
    }else if(key==='jeune_intermit'){
      const hours=num(values._fast_hours)??durationBetween(values.last_meal,values.first_meal),duration=formatDuration(hours),paused=/pause/i.test(String(values.fast_state||''));pill('Jeûne',paused?'pause':duration||values.fast_state||'renseigné');metric('Aujourd’hui',values.fast_state);metric('Durée',duration);metric('Énergie',present(values.energy)?`${values.energy}/10`:'');metric('Faim',present(values.hunger)?`${values.hunger}/10`:'');
      signals.fast_state=values.fast_state||null;signals.fast_minutes=paused?null:(hours===null?null:Math.round(hours*60));signals.energy=num(values.energy);signals.hunger=num(values.hunger);signals.hydration_feeling=num(values.hydration);
    }else if(key==='reduction_sucre'){
      pill('Sucre',values.craving_state||(present(values.craving)?`envie ${values.craving}/10`:'renseigné'));metric('Aujourd’hui',values.craving_state);metric('Envie',present(values.craving)?`${values.craving}/10`:'');metric('Déclencheur',values.trigger);metric('Sans sucre ajouté',values.no_added_sugar);
      signals.sugar_craving=num(values.craving)??semanticScore(values.craving_state,{Aucune:0,Légère:3,Présente:6,Forte:9});signals.sugar_state=values.craving_state||null;signals.habit_done=values.no_added_sugar==='Oui';
    }else if(key==='changer_habitude'){
      const done=/Petit pas réalisé/i.test(String(values.day_state||''))||!!String(values.victory||values.response||'').trim(),habit=settings.habit||values.habit||'';
      pill('Habitude',values.day_state||(done?'petit pas réalisé':'renseignée'));metric('Aujourd’hui',values.day_state);metric('Habitude',habit);metric('Petit pas',values.victory);metric('Réponse choisie',values.response);
      signals.habit_state=values.day_state||null;signals.habit_done=done;signals.urge=num(values.urge);signals.habit=habit||null;
    }
    return {version:1,key,title:item.title,date,headline:trackerSummary(key,values,settings,date),pills:[...new Set(pills)],metrics,signals};
  }

  function renderCatalog(){
    const modal=root('mtAdvancedTrackers','mt-follow');
    const active=activeKeys();
    modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackersClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackersClose()" aria-label="Fermer">×</button><div class="mt-follow-kicker">Mon carnet · Mes suivis</div><h2>Ajouter un suivi</h2><p class="mt-follow-intro">Choisis seulement les repères qui comptent pour toi. Les suivis masqués conservent leur historique.</p>${active.length?`<div class="mt-follow-active">${active.map(key=>`<button class="mt-follow-chip" type="button" onclick="mtAdvancedTrackerEntry('${key}')">${esc(TRACKERS[key].title)} · Saisir</button><button class="mt-follow-chip" type="button" onclick="mtAdvancedTrackerHistory('${key}')">Évolution →</button>`).join('')}</div>`:`<div class="mt-follow-empty">Aucun suivi personnalisé actif pour le moment. Tu peux commencer par un seul repère.</div>`}${CATEGORIES.map(([category,label,description])=>`<section class="mt-follow-cat"><h3>${label}</h3><p>${description}</p>${Object.entries(TRACKERS).filter(([,item])=>item.category===category).map(([key,item])=>{const pref=preference(key),isOn=pref.enabled;return `<div class="mt-follow-row"><div><b>${esc(item.title)}</b><small>${esc(item.description)}</small></div><div class="mt-follow-row-actions">${isOn?`<button class="mt-follow-configure" type="button" onclick="mtAdvancedTrackerHistory('${key}')">Évolution</button>`:''}${isOn&&item.configurable?`<button class="mt-follow-configure" type="button" onclick="mtAdvancedTrackerConfigure('${key}')">Configurer</button>`:''}<button class="mt-follow-action ${isOn?'is-on':''}" type="button" onclick="mtAdvancedTrackerToggle('${key}')">${isOn?'Masquer':'Ajouter'}</button></div></div>`;}).join('')}</section>`).join('')}<div class="mt-follow-help">Les données de santé, de cycle et de symptômes restent privées. Les estimations du cycle ne constituent ni un diagnostic ni une méthode contraceptive.</div></section>`;
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
    if(key==='performance_recuperation'){
      const rhythm=normalizePracticeRhythm(settings.level);
      return `<div class="mt-follow-field"><label>Quelle activité pratiques-tu ?</label><select name="discipline" required><option value="">Choisir une activité…</option>${DISCIPLINES.map(x=>`<option value="${esc(x)}" ${settings.discipline===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="mt-follow-field" data-other-discipline><label>Si autre, précise ta pratique</label><input name="discipline_other" type="text" value="${esc(settings.discipline_other||'')}"></div><div class="mt-follow-field"><label>Ton rythme de pratique</label><select name="level">${LEVELS.map(x=>`<option value="${esc(x)}" ${rhythm===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="mt-follow-help">Yoga, Pilates, marche, fitness ou compétition : ce suivi s’adapte à ta pratique et à ton ressenti, sans niveau requis.</div>`;
    }
    if(key==='changer_habitude'){
      return `<div class="mt-follow-field"><label>Quelle habitude souhaites-tu faire évoluer ?</label><input name="habit" type="text" maxlength="120" required value="${esc(settings.habit||'')}" placeholder="Ex. grignoter le soir, scroller avant de dormir…"></div><div class="mt-follow-help">Tu la définis une seule fois. Chaque jour, tu notes seulement ce qui s’est passé : impulsion, déclencheur, réponse choisie et petite victoire. Tu pourras la modifier plus tard depuis « Gérer ».</div>`;
    }
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
      settings.discipline=String(fd.get('discipline')||'');settings.discipline_other=String(fd.get('discipline_other')||'').trim();settings.level=normalizePracticeRhythm(fd.get('level')||'Occasionnelle');
      if(!DISCIPLINES.includes(settings.discipline)){toast('Choisis d’abord ton activité.');return;}
    }else if(key==='changer_habitude'){
      settings.habit=String(fd.get('habit')||'').trim().replace(/\s+/g,' ').slice(0,120);
      if(!settings.habit){toast('Indique l’habitude que tu souhaites faire évoluer.');return;}
    }else if(key==='cycle'){
      settings.last_period_start=String(fd.get('last_period_start')||'');settings.period_length=Math.min(10,Math.max(1,Number(fd.get('period_length'))||5));settings.cycle_length=Math.min(45,Math.max(20,Number(fd.get('cycle_length'))||28));settings.regularity=String(fd.get('regularity')||'Je ne sais pas');
      if(!parseDate(settings.last_period_start)){toast('Choisis la date du premier jour de tes dernières règles.');return;}
      settings.period_starts=[...new Set([...(Array.isArray(settings.period_starts)?settings.period_starts:[]),settings.last_period_start].filter(parseDate))].sort();
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
    // Un curseur masqué ne doit jamais devenir implicitement un 5/10. Tous
    // les ressentis sont volontaires, sauf si un futur champ déclare required.
    if(def.type==='range'&&def.attrs?.required!==true){const active=present(values[def.key]);return `<div class="mt-follow-field mt-follow-optional-range" data-optional-range><div class="mt-follow-optional-head"><label>${esc(def.label)} <small>(facultatif)</small></label><button class="mt-follow-optional-toggle" type="button" onclick="mtAdvancedTrackerOptionalRangeToggle(this)">${active?'Ne pas renseigner':'Renseigner'}</button></div><div class="mt-follow-range" ${active?'':'hidden'}><input name="${esc(def.key)}" type="range" min="0" max="10" step="1" value="${esc(current)}" ${active?'':'disabled'} oninput="this.nextElementSibling.value=this.value+'/10'"><output>${esc(current)}/10</output></div></div>`;}
    if(def.type==='range')return `<div class="mt-follow-field"><label>${esc(def.label)}</label><div class="mt-follow-range"><input name="${esc(def.key)}" type="range" min="0" max="10" step="1" value="${esc(current)}" oninput="this.nextElementSibling.value=this.value+'/10'"><output>${esc(current)}/10</output></div></div>`;
    if(def.type==='select'){const options=[...(def.options||[])];if(present(current)&&!options.some(option=>String(option)===String(current)))options.unshift(String(current));return `<div class="mt-follow-field"><label>${esc(def.label)}</label><select name="${esc(def.key)}"><option value="">Choisir…</option>${options.map(option=>`<option value="${esc(option)}" ${String(current)===String(option)?'selected':''}>${esc(option)}</option>`).join('')}</select></div>`;}
    if(def.type==='textarea')return `<div class="mt-follow-field"><label>${esc(def.label)}</label><textarea name="${esc(def.key)}" placeholder="Écris seulement ce qui t’est utile.">${esc(current)}</textarea></div>`;
    return `<div class="mt-follow-field"><label>${esc(def.label)}</label><input name="${esc(def.key)}" type="${esc(def.type)}" value="${esc(current)}" ${inputAttrs(def.attrs)} ${def.type==='number'?'inputmode="decimal"':''}></div>`;
  }

  window.mtAdvancedTrackerOptionalRangeToggle=function(button){
    const field=button?.closest?.('[data-optional-range]'),range=field?.querySelector?.('.mt-follow-range'),input=range?.querySelector?.('input');if(!range||!input)return;
    const activate=input.disabled;input.disabled=!activate;range.hidden=!activate;button.textContent=activate?'Ne pas renseigner':'Renseigner';
  };

  async function fetchEntry(key,date){
    const local=readLocalEntry(key,date),c=client();if(!c||!UID)return local;
    try{
      const query=c.from('user_tracker_entries').select('tracker_key,entry_date,values,note,updated_at').eq('user_id',UID).eq('tracker_key',key).eq('entry_date',date).maybeSingle();
      const result=await Promise.race([query,new Promise(resolve=>setTimeout(()=>resolve({data:null}),1800))]);
      const remote=result?.data||null;if(remote){writeLocalEntry(key,date,remote);return remote;}return local;
    }catch(e){return local;}
  }

  function historyCacheKey(key){return `${UID||'guest'}:${normalizeKey(key)}`;}
  function invalidateHistory(key){HISTORY_CACHE.delete(historyCacheKey(key));}
  function removeLocalEntry(key,date){try{localStorage.removeItem(entryKey(UID,key,date));}catch(e){}}
  function readLocalHistory(key,from){
    const prefix=`mt_tracker_entry_${UID||'guest'}_${normalizeKey(key)}_`,rows=[];
    try{for(let i=0;i<localStorage.length;i++){const storageKey=localStorage.key(i)||'';if(!storageKey.startsWith(prefix))continue;const row=JSON.parse(localStorage.getItem(storageKey)||'null');if(row?.entry_date>=from)rows.push(row);}}catch(e){}
    return rows;
  }
  async function fetchHistory(rawKey,force=false){
    const key=normalizeKey(rawKey),cacheKey=historyCacheKey(key),cached=HISTORY_CACHE.get(cacheKey);
    if(!force&&cached&&Date.now()-cached.at<HISTORY_TTL)return cached.rows;
    const from=addDays(TODAY(),-27),localRows=readLocalHistory(key,from),c=client();let remoteRows=[];
    if(c&&UID){try{
      const query=c.from('user_tracker_entries').select('tracker_key,entry_date,values,note,updated_at').eq('user_id',UID).eq('tracker_key',key).gte('entry_date',from).lte('entry_date',TODAY()).order('entry_date',{ascending:false});
      const result=await Promise.race([query,new Promise(resolve=>setTimeout(()=>resolve({data:null}),2200))]);
      if(Array.isArray(result?.data))remoteRows=result.data;
    }catch(e){console.warn('[Mes suivis] historique local utilisé',e);}}
    const merged=new Map();[...localRows,...remoteRows].forEach(row=>{if(row?.entry_date)merged.set(row.entry_date,row);});
    const rows=[...merged.values()].sort((a,b)=>String(b.entry_date).localeCompare(String(a.entry_date)));
    rows.forEach(row=>writeLocalEntry(key,row.entry_date,row));HISTORY_CACHE.set(cacheKey,{at:Date.now(),rows});return rows;
  }

  function primarySpec(key){return ({
    sommeil_profond:{label:'qualité du sommeil',good:1,get:v=>num(v.quality)??semanticScore(v.night_state,{Réparatrice:9,Correcte:7,Agitée:4,'Trop courte':3})},
    digestion:{label:'confort digestif',good:1,get:v=>num(v.comfort)??semanticScore(v.day_state,{Confortable:9,'Quelques gênes':6,'Inconfort marqué':3})},
    reflux:{label:'intensité du reflux',good:-1,get:v=>/^Non/i.test(String(v.episode||''))?0:num(v.intensity)},
    equilibre_alimentaire:{label:'équilibre renseigné',good:1,get:v=>avg(v.diversity,v.protein,v.plants,v.hydration,v.schedule)},
    evolution_corporelle:{label:'énergie ressentie',good:1,get:v=>num(v.energy)},peau:{label:'inconfort de la peau',good:-1,get:v=>avg(v.blemishes,v.dryness,v.inflammation,v.sensitivity)},
    performance_recuperation:{label:'récupération',good:1,get:v=>num(v.recovery)},cycle:{label:'énergie ressentie',good:1,get:v=>num(v.energy)},
    perimenopause:{label:'énergie ressentie',good:1,get:v=>num(v.energy)},jeune_intermit:{label:'énergie ressentie',good:1,get:v=>num(v.energy)},
    reduction_sucre:{label:'intensité des envies',good:-1,get:v=>num(v.craving)??semanticScore(v.craving_state,{Aucune:0,Légère:3,Présente:6,Forte:9})},
    changer_habitude:{label:'petits pas réalisés',good:1,get:v=>/Petit pas réalisé/i.test(String(v.day_state||''))||v.victory?10:0}
  })[key]||null;}
  function average(list){const clean=list.map(num).filter(Number.isFinite);return clean.length?clean.reduce((a,b)=>a+b,0)/clean.length:null;}
  function correlation(pairs){
    if(pairs.length<5)return null;const xs=pairs.map(p=>p[0]),ys=pairs.map(p=>p[1]),mx=average(xs),my=average(ys);let top=0,dx=0,dy=0;
    pairs.forEach(([x,y])=>{const a=x-mx,b=y-my;top+=a*b;dx+=a*a;dy+=b*b;});return dx&&dy?top/Math.sqrt(dx*dy):null;
  }
  function cautiousRelation(key,rows){
    const map={
      sommeil_profond:['durée de sommeil','qualité ressentie',v=>num(v._sleep_hours)??durationBetween(v.bedtime,v.wake_time),v=>num(v.quality)],
      digestion:['stress renseigné','confort digestif',v=>num(v.stress),v=>num(v.comfort)],
      equilibre_alimentaire:['présence de végétaux','diversité',v=>num(v.plants),v=>num(v.diversity)],
      peau:['stress renseigné','inconfort de la peau',v=>num(v.stress),v=>avg(v.blemishes,v.dryness,v.inflammation,v.sensitivity)],
      performance_recuperation:['intensité ressentie','récupération',v=>num(v.intensity),v=>num(v.recovery)],
      jeune_intermit:['durée du jeûne','énergie ressentie',v=>num(v._fast_hours)??durationBetween(v.last_meal,v.first_meal),v=>num(v.energy)]
    },cfg=map[key];if(!cfg)return null;const pairs=rows.map(row=>[cfg[2](row.values||{}),cfg[3](row.values||{})]).filter(pair=>pair.every(Number.isFinite)),r=correlation(pairs);if(r===null||Math.abs(r)<.35)return null;
    const direction=r>0?'évoluent souvent dans le même sens':'semblent évoluer en sens inverse';
    return `Dans les ${pairs.length} journées comparables renseignées, ${cfg[0]} et ${cfg[1]} ${direction}. C’est un repère à observer, pas une relation de cause à effet.`;
  }
  function historyStats(key,rows,days){
    const from=addDays(TODAY(),-(days-1)),period=rows.filter(row=>row.entry_date>=from),spec=primarySpec(key),values=spec?period.map(row=>spec.get(row.values||{})).filter(Number.isFinite):[];
    let trend='Pas encore assez de recul';
    if(values.length>=4){const split=Math.ceil(values.length/2),recent=average(values.slice(0,split)),older=average(values.slice(split));if(recent!==null&&older!==null){const delta=(recent-older)*(spec.good||1);trend=Math.abs(recent-older)<.6?'Plutôt stable':delta>0?'Tendance plus favorable':'Point à observer';}}
    return {period,count:period.length,average:average(values),label:spec?.label||'repère principal',trend,relation:cautiousRelation(key,period)};
  }
  function historyRowsHTML(key,rows){
    if(!rows.length)return `<div class="mt-follow-history-empty">Aucun repère enregistré sur cette période. Commence par une seule saisie utile aujourd’hui.</div>`;
    return `<div class="mt-follow-history-list">${rows.map(row=>`<article class="mt-follow-history-row"><header><div><strong>${esc(row.entry_date===TODAY()?'Aujourd’hui':fmtDate(row.entry_date))}</strong><p>${esc(trackerSummary(key,row.values||{},preference(key).settings||{},row.entry_date))}</p></div><div class="mt-follow-history-actions"><button type="button" onclick="mtAdvancedTrackerEdit('${esc(key)}','${esc(row.entry_date)}')">Modifier</button><button class="is-danger" type="button" onclick="mtAdvancedTrackerDelete('${esc(key)}','${esc(row.entry_date)}')">Supprimer</button></div></header></article>`).join('')}</div>`;
  }
  function renderHistory(modal,key,rows,days=7){
    const item=tracker(key),stats=historyStats(key,rows,days),shown=stats.period;
    const used=`Repères utilisés : ${stats.label}, dates réellement renseignées${stats.relation?' et journées comparables':''}.`;
    modal.dataset.key=key;modal.dataset.period=String(days);modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><div class="mt-follow-kicker">${esc(item.title)} · évolution</div><h2>Mes repères</h2><div class="mt-follow-history-head"><button class="mt-follow-period ${days===7?'is-on':''}" type="button" onclick="mtAdvancedTrackerHistoryPeriod(7)">7 jours</button><button class="mt-follow-period ${days===28?'is-on':''}" type="button" onclick="mtAdvancedTrackerHistoryPeriod(28)">28 jours</button><button class="mt-follow-period" type="button" onclick="mtAdvancedTrackerEntry('${esc(key)}')">+ Aujourd’hui</button></div><div class="mt-follow-history-stats"><div class="mt-follow-stat"><b>${stats.count}/${days}</b><small>jours renseignés</small></div><div class="mt-follow-stat"><b>${stats.average===null?'—':String(Math.round(stats.average*10)/10).replace('.',',')}</b><small>${esc(stats.label)}</small></div></div><div class="mt-follow-insight"><small>Lecture prudente</small><b>${esc(stats.trend)}</b><p>${esc(stats.relation||'Continue quelques jours pour faire apparaître une relation simple entre tes propres repères.')} ${esc(used)}</p></div>${historyRowsHTML(key,shown)}<button class="mt-follow-secondary" type="button" onclick="mtAdvancedTrackerEntry('${esc(key)}')">Renseigner aujourd’hui</button></section>`;
  }
  window.mtAdvancedTrackerHistory=async function(rawKey){
    addCSS();const key=normalizeKey(rawKey),item=tracker(key);if(!item)return;if(!UID)UID=(await getUser())?.id||window.__MT_LIBRARY_USER_ID__||null;PREFS=Object.keys(PREFS).length?PREFS:readPrefs(UID);
    const modal=root('mtAdvancedTrackerEntry','mt-follow-entry');modal.dataset.key=key;modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><div class="mt-follow-loading"><b>${esc(item.title)}</b><p>Lecture de tes 28 derniers jours…</p><span></span></div></section>`;modal.classList.add('open');
    renderHistory(modal,key,await fetchHistory(key),7);
  };
  window.mtAdvancedTrackerHistoryPeriod=async function(days){const modal=root('mtAdvancedTrackerEntry','mt-follow-entry'),key=normalizeKey(modal.dataset.key);renderHistory(modal,key,await fetchHistory(key),Number(days)===28?28:7);};
  window.mtAdvancedTrackerEdit=(key,date)=>window.mtAdvancedTrackerEntry(key,date);
  window.mtAdvancedTrackerDelete=async function(rawKey,date){
    const key=normalizeKey(rawKey),item=tracker(key);if(!item||!parseDate(date)||!confirm(`Supprimer le repère du ${fmtDate(date)} ?`))return;
    const cacheKey=historyCacheKey(key),cached=HISTORY_CACHE.get(cacheKey),deleted=(cached?.rows||[]).find(row=>row.entry_date===date)||readLocalEntry(key,date),remaining=(cached?.rows||[]).filter(row=>row.entry_date!==date);
    const c=client();if(c&&UID){try{const {error}=await c.from('user_tracker_entries').delete().eq('user_id',UID).eq('tracker_key',key).eq('entry_date',date);if(error)throw error;}catch(e){toast('Suppression impossible pour le moment.');invalidateHistory(key);return;}}
    removeLocalEntry(key,date);HISTORY_CACHE.set(cacheKey,{at:Date.now(),rows:remaining});
    const latest=remaining[0]||null,pref=preference(key),settings={...(pref.settings||{})};if(key==='cycle'&&deleted?.values?.new_period==='Oui')settings.period_starts=(Array.isArray(settings.period_starts)?settings.period_starts:[]).filter(value=>value!==date);settings.latest_date=latest?.entry_date||null;settings.latest_summary=latest?trackerSummary(key,latest.values||{},settings,latest.entry_date):null;PREFS[key]={...pref,settings,updated_at:new Date().toISOString()};await savePreference(key);
    window.mtRefreshParcoursCalendar?.();window.dispatchEvent(new CustomEvent('mt:custom-trackers-changed',{detail:{key,date,deleted:true}}));window.dispatchEvent(new CustomEvent('mt:daily-state-changed',{detail:{source:'custom_trackers'}}));renderHistory(root('mtAdvancedTrackerEntry','mt-follow-entry'),key,remaining,Number(root('mtAdvancedTrackerEntry','mt-follow-entry').dataset.period)||7);toast('Repère supprimé.');
  };

  function estimateHTML(key,settings,date){
    if(key!=='cycle')return '';
    const estimate=cycleEstimate(settings,date);if(!estimate)return '';
    const caution=String(settings.regularity||'').toLowerCase()==='variable'?'Dates indicatives car ton cycle est variable.':'Ces dates s’affineront avec les prochains cycles renseignés.';
    return `<div class="mt-follow-estimate"><small>Repère du cycle</small><b>Jour ${estimate.cycleDay} · ${esc(estimate.phase)}</b><p>Prochaines règles vers le ${esc(fmtDate(estimate.nextPeriod))} · Ovulation autour du ${esc(fmtDate(estimate.ovulationDate))}. ${esc(caution)}</p></div>`;
  }

  function notePrompt(key){
    return ({
      sommeil_profond:['Ce qui a pu influencer ta nuit','Une soirée, une habitude ou un détail que tu veux retenir…'],
      digestion:['Contexte utile','Un repas, un rythme ou une situation à garder en mémoire…'],
      reflux:['Autre observation','Seulement si un détail peut t’aider à comprendre cet épisode…'],
      equilibre_alimentaire:['Ce que tu veux retenir','Une sensation ou un repère utile, sans compter chaque détail…'],
      evolution_corporelle:['Observation personnelle','Note seulement ce qui est utile pour toi aujourd’hui…'],
      peau:['Contexte utile','Un soin, une période ou un changement à retenir…'],
      performance_recuperation:['Ressenti général','Une sensation après ta pratique ou un détail pour ta récupération…'],
      cycle:['Observation personnelle','Un ressenti que tu souhaites conserver pour cette date…'],
      perimenopause:['Contexte ou remarque','Note seulement un changement qui compte pour toi…'],
      jeune_intermit:['Ce que tu veux retenir','Ton confort, ton rythme ou une raison de faire une pause…'],
      reduction_sucre:['Contexte du jour','Une envie, une situation ou une alternative utile…'],
      changer_habitude:['Ce que tu apprends','Un détail utile, sans jugement…']
    })[key]||['Note personnelle','Un détail que tu veux retenir…'];
  }

  function dateNavHTML(date){
    const current=clampHistoryDate(date),today=TODAY(),min=minHistoryDate();
    const label=current===today?fmtNavToday(current):fmtNavDate(current);
    return `<nav class="mt-follow-date-nav" aria-label="Jours précédents"><button type="button" aria-label="Jour précédent" ${current<=min?'disabled':''} onclick="mtAdvancedTrackerNavigate(-1)">‹</button><strong>${esc(label)}</strong><button type="button" aria-label="Jour suivant" ${current>=today?'disabled':''} onclick="mtAdvancedTrackerNavigate(1)">›</button></nav>`;
  }

  function coachingBeforeHTML(key,settings,date){
    if(date!==TODAY())return '';
    const coaching=settings.coaching||{},blocks=[];
    if(settings.latest_date&&settings.latest_date<date&&settings.latest_summary)blocks.push(`<div class="mt-follow-coach"><small>Ton dernier repère</small><p>${esc(settings.latest_summary)}</p></div>`);
    if(coaching.status==='pending'&&parseDate(coaching.date)&&coaching.date<date)blocks.push(`<div class="mt-follow-coach" id="mtFollowCoachQuestion"><small>Le point du lendemain</small><b>Est-ce que cette suggestion t’a aidé ?</b><p>${esc(coaching.title||coaching.copy||'Ton action précédente')}</p><div class="mt-follow-coach-actions"><button type="button" onclick="mtAdvancedTrackerCoachFeedback('${esc(key)}','helped')">Oui, plutôt</button><button type="button" onclick="mtAdvancedTrackerCoachFeedback('${esc(key)}','not_helped')">Pas vraiment</button><button type="button" onclick="mtAdvancedTrackerCoachFeedback('${esc(key)}','unsure')">Je ne sais pas</button></div></div>`);
    return blocks.join('');
  }

  window.mtAdvancedTrackerCoachFeedback=async function(rawKey,response){
    const key=normalizeKey(rawKey),pref=preference(key),settings={...(pref.settings||{})},coaching={...(settings.coaching||{})};
    if(coaching.status!=='pending')return;
    coaching.status='answered';coaching.feedback=['helped','not_helped','unsure'].includes(response)?response:'unsure';coaching.feedback_date=TODAY();settings.coaching=coaching;
    PREFS[key]={...pref,settings,updated_at:new Date().toISOString()};await savePreference(key);
    const box=document.getElementById('mtFollowCoachQuestion');if(box)box.innerHTML='<small>Merci pour ton retour</small><p>Tee utilisera ce repère pour ajuster la prochaine action, sans tirer de conclusion hâtive.</p>';
  };

  function renderEntry(modal,key,date,item,existing){
    const values=existing?.values||{},settings=preference(key).settings||{},fields=fieldsFor(key,settings);
    const persistedNote=existing?.note||(key==='cycle'&&values.symptoms?values.symptoms:'')||'';
    const discipline=key==='performance_recuperation'?(settings.discipline==='Autre'&&settings.discipline_other?settings.discipline_other:settings.discipline):'';
    const persistentContext=key==='changer_habitude'&&settings.habit?`<div class="mt-follow-fixed-context"><small>Habitude suivie</small><strong>${esc(settings.habit)}</strong></div>`:'';
    const [noteLabel,notePlaceholder]=notePrompt(key);
    const safety=key==='jeune_intermit'?`<div class="mt-follow-help">Ce suivi reste facultatif et ne remplace pas un avis médical. En cas de grossesse ou d’allaitement, de diabète, de traitement, de trouble du comportement alimentaire ou de problème de santé, demande conseil à un professionnel de santé avant de jeûner.</div>`:'';
    modal.dataset.key=key;modal.dataset.date=date;
    modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><div class="mt-follow-kicker">${esc(item.title)}${discipline?` · ${esc(discipline)}`:''}</div><h2>${date===TODAY()?"Aujourd’hui":esc(fmtDate(date))}</h2>${dateNavHTML(date)}${persistentContext}${coachingBeforeHTML(key,settings,date)}<p class="mt-follow-intro">${esc(item.description)}</p>${estimateHTML(key,settings,date)}${safety}<form class="mt-follow-form" id="mtAdvancedTrackerForm">${key==='cycle'&&shouldOfferPeriodStart(settings,date,values)?cycleEventHTML(values):''}${fields.map(def=>fieldHTML(def,values)).join('')}<div class="mt-follow-field"><label>${esc(noteLabel)} <small>(facultatif)</small></label><textarea name="_note" placeholder="${esc(notePlaceholder)}">${esc(persistedNote)}</textarea></div><button class="mt-follow-save" type="submit">Enregistrer ce repère</button></form></section>`;
    document.getElementById('mtAdvancedTrackerForm').onsubmit=saveEntry;
  }

  window.mtAdvancedTrackerNavigate=async function(direction){
    const modal=root('mtAdvancedTrackerEntry','mt-follow-entry'),key=normalizeKey(modal.dataset.key),item=tracker(key);if(!item)return;
    const current=clampHistoryDate(modal.dataset.date||TODAY()),target=clampHistoryDate(addDays(current,Number(direction)||0));
    if(target===current)return;
    const nav=modal.querySelector('.mt-follow-date-nav');nav?.classList.add('is-loading');
    const existing=await fetchEntry(key,target);
    renderEntry(modal,key,target,item,existing);
    const sheet=modal.querySelector('.mt-follow-sheet');if(sheet)sheet.scrollTop=0;
  };

  window.mtAdvancedTrackerEntry=async function(rawKey,date=TODAY()){
    addCSS();const key=normalizeKey(rawKey),item=tracker(key);if(!item)return;date=clampHistoryDate(date);
    if(!UID)UID=(await getUser())?.id||window.__MT_LIBRARY_USER_ID__||null;
    PREFS=Object.keys(PREFS).length?PREFS:readPrefs(UID);
    const pref=preference(key);
    if(item.configurable&&((key==='cycle'&&!pref.settings?.last_period_start)||(key==='performance_recuperation'&&!pref.settings?.discipline)||(key==='changer_habitude'&&!pref.settings?.habit))){pendingAfterConfig={entry:true,date};return window.mtAdvancedTrackerConfigure(key,pendingAfterConfig);}
    const modal=root('mtAdvancedTrackerEntry','mt-follow-entry');modal.dataset.key=key;modal.dataset.date=date;
    modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><div class="mt-follow-loading"><b>${esc(item.title)}</b><p>Ouverture de ton suivi…</p><span></span></div></section>`;modal.classList.add('open');
    const existing=await fetchEntry(key,date);
    renderEntry(modal,key,date,item,existing);
  };
  window.mtAdvancedTrackerEntryClose=()=>root('mtAdvancedTrackerEntry','mt-follow-entry').classList.remove('open');

  function hasActionableData(values={}){return Object.keys(values).some(name=>!name.startsWith('_')&&!['cycle_day_estimate','cycle_phase_estimate','next_period_estimate','ovulation_window_estimate'].includes(name));}
  function entryFeedback(key,values={},settings={}){
    if(!hasActionableData(values))return ['Encore quelques repères','Tee a enregistré ta saisie, mais n’a pas encore assez d’éléments pour proposer une action fiable.',true];
    let result;
    if(key==='sommeil_profond'){
      const hours=num(values._sleep_hours)??durationBetween(values.bedtime,values.wake_time),quality=num(values.quality);
      if(hours!==null&&hours<7)result=['Soutenir ta prochaine nuit','Si ton rythme le permet, prépare un coucher un peu plus tôt ce soir et observe demain ton état au réveil.'];
      else if(quality!==null&&quality<=4)result=['Alléger la fin de journée','Choisis ce soir un seul repère calme et réaliste : lumière plus douce, écran posé plus tôt ou respiration lente.'];
      else result=['Conserver ce qui t’aide','Ta nuit est renseignée. Retrouve ce même repère quelques jours pour voir ce qui accompagne tes nuits les plus réparatrices.'];
    }
    else if(key==='digestion'){const comfort=num(values.comfort),stress=num(values.stress);result=stress!==null&&stress>=7?['Créer une transition avant le repas','Essaie une pause de deux minutes avant ton prochain repas et observe seulement si ton confort change.']:comfort!==null&&comfort<=4?['Simplifier le prochain repas','Garde une composition connue, mange tranquillement et note seulement ce qui semble mieux toléré.']:['Observer sans tout changer','Ton repère est enregistré. Compare-le à ton prochain repas avant de modifier plusieurs éléments à la fois.'];}
    else if(key==='reflux')result=[/^Non/i.test(String(values.episode||''))?'Garder ce repère':'Observer le contexte du prochain épisode',/^Non/i.test(String(values.episode||''))?'Aucun reflux n’est signalé aujourd’hui. Continue seulement si ce suivi t’aide.':'Note l’horaire, le repas précédent et la position après le repas, sans conclure à une cause unique.'];
    else if(key==='equilibre_alimentaire'){const plants=num(values.plants),protein=num(values.protein);result=plants!==null&&plants<=4?['Ajouter un végétal précis','Au prochain repas, choisis un végétal que tu apprécies déjà et qui s’accorde réellement avec le plat.']:protein!==null&&protein<=4?['Renforcer la partie rassasiante','Au prochain repas, ajoute une source protéique familière adaptée à ton plat et à ton intention.']:['Ne change presque rien','Les principaux repères renseignés paraissent déjà présents. Ajuste seulement les quantités selon ta faim.'];}
    else if(key==='performance_recuperation'){const recovery=num(values.recovery),fatigue=num(values.fatigue_after)??num(values.muscle_fatigue),readiness=num(values.readiness)??num(values.availability);result=(recovery!==null&&recovery<=4)||(fatigue!==null&&fatigue>=7)?['Priorité à la récupération','Avant la prochaine séance, privilégie hydratation, repas régulier et récupération douce, puis réévalue ta disponibilité.']:readiness!==null&&readiness<=4?['Adapter la prochaine pratique','Prévois une version plus courte ou moins intense, puis observe comment ton énergie répond.']:['Conserver cette base','Ta séance et ta récupération sont renseignées. Répète ce suivi pour comparer intensité, sommeil et disponibilité.'];}
    else if(key==='reduction_sucre'){const craving=num(values.craving)??semanticScore(values.craving_state,{Aucune:0,Légère:3,Présente:6,Forte:9});result=craving!==null&&craving>=7?['Préparer une alternative familière','Pour le prochain moment à risque, prévois une option rassasiante que tu apprécies déjà, sans chercher la perfection.']:['Repérer ce qui fonctionne','Garde en mémoire le contexte et l’alternative choisie : la répétition compte davantage qu’une journée parfaite.'];}
    else if(key==='changer_habitude')result=['Garder un seul petit pas','Choisis la version la plus simple de cette habitude que tu pourrais répéter demain, même pendant une journée chargée.'];
    else if(key==='peau')result=['Comparer, sans conclure trop vite','Observe quelques jours le sommeil, le stress et les produits utilisés avant d’attribuer ce changement à une seule cause.'];
    else if(key==='jeune_intermit')result=['Faire passer le confort d’abord','Si faim, fatigue ou inconfort deviennent marqués, raccourcis ou interromps le jeûne et privilégie un repas adapté.'];
    else if(key==='cycle'||key==='perimenopause')result=['Écouter le repère du jour','Adapte doucement ton rythme à ton énergie et à ton confort, sans utiliser cette lecture comme un diagnostic.'];
    else result=['Continuer à observer','Ton repère est enregistré. Quelques journées comparables permettront une lecture plus utile.'];
    if(settings.coaching?.feedback==='not_helped')result[1]+=' Cette fois, choisis-en la version la plus simple possible pour qu’elle reste réaliste.';
    return [...result,false];
  }
  function renderSaveResult(modal,key,date,feedback,remoteSaved){
    const item=tracker(key),[title,copy,insufficient]=feedback;
    modal.dataset.key=key;modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><div class="mt-follow-kicker">${esc(item.title)} · ${date===TODAY()?'aujourd’hui':esc(fmtDate(date))}</div><h2>Repère enregistré</h2><div class="mt-follow-insight"><small>${insufficient?'Lecture du jour':'Une action utile'}</small><b>${esc(title)}</b><p>${esc(copy)}</p></div><div class="mt-follow-help">Cette lecture repose uniquement sur ce que tu viens de renseigner. Elle reste informative et ne constitue pas un diagnostic.</div><div class="mt-follow-result-actions"><button class="mt-follow-save" type="button" onclick="mtAdvancedTrackerHistory('${esc(key)}')">Voir mon évolution</button><button class="mt-follow-secondary" type="button" onclick="mtAdvancedTrackerEntryClose()">Revenir au Carnet</button></div>${remoteSaved?'':'<p class="mt-follow-intro">La saisie est conservée sur cet appareil et se synchronisera dès que possible.</p>'}</section>`;
  }

  async function saveEntry(event){
    event.preventDefault();const modal=root('mtAdvancedTrackerEntry','mt-follow-entry'),key=normalizeKey(modal.dataset.key),date=modal.dataset.date||TODAY(),fd=new FormData(event.currentTarget),values={};
    for(const [name,value] of fd.entries())if(name!=='_note'&&String(value).trim()!=='')values[name]=value;
    const note=String(fd.get('_note')||'').trim()||null,pref=preference(key),settings={...(pref.settings||{})};
    const meaningfulKeys=Object.keys(values).filter(name=>name!=='new_period'||values.new_period==='Oui');
    if(!meaningfulKeys.length&&!note){toast('Choisis au moins un repère utile pour cette journée.');return;}
    if(values.new_period==='Non')delete values.new_period;
    if(key==='cycle'&&fd.has('new_period')){
      const starts=[...new Set([...(Array.isArray(settings.period_starts)?settings.period_starts:[]),settings.last_period_start].filter(parseDate))];
      const withoutDate=starts.filter(value=>value!==date);if(values.new_period==='Oui')withoutDate.push(date);
      settings.period_starts=[...new Set(withoutDate)].sort();
      const eligible=settings.period_starts.filter(value=>value<=TODAY());if(eligible.length)settings.last_period_start=eligible[eligible.length-1];
    }
    if(key==='performance_recuperation')values._discipline=settings.discipline==='Autre'?(settings.discipline_other||'Autre'):(settings.discipline||'Activité');
    if(key==='sommeil_profond'){
      const hours=durationBetween(values.bedtime,values.wake_time);if(hours)values._sleep_hours=hours;
    }
    if(key==='jeune_intermit'){
      const hours=durationBetween(values.last_meal,values.first_meal);if(hours)values._fast_hours=hours;
    }
    if(key==='cycle'){
      const estimate=cycleEstimate(settings,date);if(estimate){values.cycle_day_estimate=estimate.cycleDay;values.cycle_phase_estimate=estimate.phase;values._cycle_calendar_event=estimate.cycleEvent;values.next_period_estimate=estimate.nextPeriod;values.ovulation_window_estimate=estimate.ovulationDate;}
    }
    const daily=trackerDailySummary(key,values,settings,date);values._daily=daily;
    const feedback=entryFeedback(key,values,settings),[feedbackTitle,feedbackCopy,insufficient]=feedback;
    if(date===TODAY()&&!insufficient)settings.coaching={date,title:feedbackTitle,copy:feedbackCopy,status:'pending',feedback:null,feedback_date:null};
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
    invalidateHistory(key);window.mtRefreshCarnetTrackers?.();window.mtRefreshParcoursCalendar?.();
    window.dispatchEvent(new CustomEvent('mt:custom-trackers-changed',{detail:{key,date,values,summary}}));
    window.dispatchEvent(new CustomEvent('mt:daily-state-changed',{detail:{source:'custom_trackers'}}));
    if(remoteSaved&&window.mtGardenAwardDaily)await window.mtGardenAwardDaily('personal_tracker',date);
    renderSaveResult(modal,key,date,feedback,remoteSaved);toast(remoteSaved?'Repère enregistré.':'Repère enregistré sur cet appareil.');
  }

  window.mtCustomTrackersCatalog=TRACKERS;
  window.mtCustomTrackerSummary=trackerSummary;
  window.mtCustomTrackerDailySummary=trackerDailySummary;
  window.mtCustomCycleEstimate=cycleEstimate;
})();
