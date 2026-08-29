// MÉTHODE TEE — V416 · SUIVIS PREMIUM + APPLE SANTÉ / HEALTHKIT (lazy-load)
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
  const HISTORY_DAYS=364;
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
  const section=(label,copy='')=>({key:`__section_${String(label).toLowerCase().replace(/[^a-z0-9]+/g,'_')}`,label,type:'section',copy});

  const CATEGORIES=[
    ['quotidien','Mon quotidien','Sommeil, énergie et récupération générale.'],
    ['alimentation','Mon alimentation','Digestion, équilibre et rythme alimentaire.'],
    ['corps','Mon corps','Évolution, peau et symptômes personnels.'],
    ['performance','Mon activité','Des repères adaptés à toutes les façons de bouger, sans objectif de performance imposé.'],
    ['hormonal','Mon rythme hormonal','Des repères facultatifs, privés et toujours présentés comme des estimations.'],
    ['habitudes','Mes habitudes','Jeûne, sucre et habitudes à faire évoluer sans culpabilisation.']
  ];

  const TRACKERS={
    sommeil_profond:{category:'quotidien',title:'Sommeil approfondi',description:'Comprendre la durée, la qualité, la continuité et le contexte de tes nuits, sans chercher une nuit parfaite.',fields:[
      section('Ta nuit','Les repères centraux : horaires, continuité et ressenti.'),
      field('night_state','Comment s’est passée ta nuit ?','select',['Réparatrice','Correcte','Agitée','Trop courte','Décalée','Je ne souhaite pas l’évaluer']),
      field('bedtime','Heure de coucher','time'),field('wake_time','Heure de réveil','time'),
      field('latency','Temps d’endormissement (min, si tu le connais)','number',null,{min:0,max:240,step:5}),
      field('awakenings','Réveils nocturnes remarqués','number',null,{min:0,max:20,step:1}),
      field('awake_minutes','Temps éveillée pendant la nuit (min, facultatif)','number',null,{min:0,max:480,step:5}),
      field('quality','Qualité ressentie','range'),field('wake_state','État au réveil','range'),field('sleepiness','Somnolence dans la journée','range'),
      section('Rythme & récupération','Pour repérer ce qui accompagne tes meilleures nuits.'),
      field('schedule_regularity','Régularité de l’horaire','select',['Proche de mon rythme habituel','Un peu décalé','Très décalé','Je ne sais pas']),
      field('nap','Sieste','select',['Non','Oui, courte (<30 min)','Oui, 30–90 min','Oui, >90 min']),
      field('nap_time','Heure de la sieste (si utile)','time'),
      field('evening_routine','Routine du soir','select',['Oui','En partie','Non','Pas aujourd’hui']),
      field('screens','Écrans dans l’heure avant le coucher','select',['Non','Un peu','Oui','Je ne sais pas']),
      field('late_meal','Repas tardif / très proche du coucher','select',['Non','Oui','Je ne sais pas']),
      field('caffeine_late','Caféine en fin de journée','select',['Non','Oui','Je ne sais pas']),
      field('alcohol_evening','Alcool le soir','select',['Non','Oui','Je ne souhaite pas répondre']),
      field('stress_evening','Tension / stress en soirée','range'),field('room_comfort','Confort de la chambre','range')
    ]},
    digestion:{category:'alimentation',title:'Confort digestif',description:'Observer repas, rythme, transit et sensations pour repérer ce qui te convient, sans attribuer trop vite une cause.',fields:[
      section('Confort du jour','Commence par ce que tu ressens réellement.'),
      field('day_state','Ta digestion aujourd’hui','select',['Confortable','Quelques gênes','Inconfort marqué','Variable selon les repas','Je ne souhaite pas l’évaluer']),
      field('comfort','Confort digestif','range'),field('bloating','Ballonnements','range'),field('gas','Gaz','range'),field('pain','Douleurs / crampes','range'),
      field('heaviness','Lourdeur après les repas','range'),field('nausea','Nausée / écœurement','range'),
      section('Transit','Seulement si ces repères sont utiles pour toi.'),
      field('transit','Transit','select',['Habituel','Ralenti','Accéléré','Alternance','Je ne sais pas']),
      field('stool_frequency','Passages aux toilettes','select',['Aucun','1','2','3 ou plus','Je ne souhaite pas compter']),
      field('urgency','Urgence à aller aux toilettes','select',['Non','Par moments','Oui','Non concernée']),
      section('Autour des repas','Cherche des répétitions, pas un coupable unique.'),
      field('meal_moment','Moment où l’inconfort est surtout présent','select',['À jeun','Pendant le repas','Juste après','1 à 3 h après','En soirée / nuit','Variable']),
      field('meal_size','Taille du repas associé','select',['Petite','Habituelle','Copieuse','Je ne sais pas']),
      field('meal_speed','Rythme du repas','select',['Lent / posé','Habituel','Rapide','Variable']),
      field('foods','Repas ou aliments possiblement associés','textarea'),
      field('hydration','Hydratation ressentie','range'),field('stress','Stress ressenti','range'),field('movement_after','Mouvement après le repas','select',['Oui','Un peu','Non','Variable'])
    ]},
    reflux:{category:'alimentation',title:'Reflux & aigreurs',description:'Noter les épisodes, leur contexte et ce qui aide, sans conclure qu’un aliment est responsable à lui seul.',fields:[
      section('Épisode','Décris d’abord ce qui s’est réellement passé.'),
      field('episode','As-tu ressenti un reflux ou une aigreur ?','select',['Non aujourd’hui','Oui, une fois','Oui, plusieurs fois','Présent par périodes']),
      field('onset','Heure d’apparition (si concernée)','time'),field('intensity','Intensité ressentie','range'),
      field('duration','Durée approximative','select',['Quelques minutes','Moins d’1 h','1 à 3 h','Plus longtemps','Je ne sais pas']),
      field('throat','Gêne gorge / remontées hautes','select',['Non','Légère','Présente','Je ne sais pas']),field('burping','Rots / remontées gazeuses','select',['Non','Un peu','Présents','Je ne sais pas']),
      section('Contexte','Ces repères servent à comparer plusieurs épisodes.'),
      field('previous_meal','Repas précédent (si utile)','textarea'),field('meal_size','Taille du repas précédent','select',['Petite','Habituelle','Copieuse','Je ne sais pas']),
      field('meal_gap_bed','Temps entre repas et coucher','select',['>3 h','2–3 h','1–2 h','<1 h','Non concernée','Je ne sais pas']),
      field('position','Position après le repas','select',['Debout / en mouvement','Assise','Allongée','Variable']),
      field('spicy_fatty','Repas particulièrement épicé / gras','select',['Non','Oui','Peut-être','Je ne sais pas']),
      field('acidic','Aliments ou boissons acides','select',['Non','Oui','Peut-être','Je ne sais pas']),
      field('caffeine','Café / thé caféiné proche de l’épisode','select',['Non','Oui','Je ne sais pas']),
      field('drinks','Boissons possiblement associées','textarea'),field('stress','Stress ressenti','range'),
      field('relief','Ce qui a semblé soulager','textarea')
    ]},
    equilibre_alimentaire:{category:'alimentation',title:'Équilibre alimentaire',description:'Observer la structure, la variété, la satiété et le rythme de tes repas sans calories ni perfectionnisme.',fields:[
      section('Structure de la journée','Une vue simple de tes repas, pas un compteur.'),
      field('meals','Combien de repas souhaites-tu observer ?','select',['1 repas','2 repas','3 repas','Plus de 3']),
      field('snacks','Collations','select',['Aucune','1','2','3 ou plus','Je ne souhaite pas les compter']),
      field('schedule','Régularité des horaires','range'),
      section('Dans l’assiette','Évalue seulement les dimensions que tu souhaites observer.'),
      field('diversity','Diversité dans l’assiette','range'),field('protein','Présence de protéines','range'),field('plants','Présence de végétaux','range'),
      field('starches','Féculents / céréales / tubercules adaptés à ma faim','range'),field('fats','Matières grasses / oléagineux','range'),field('fruit','Fruits dans la journée','range'),
      field('fiber','Richesse végétale / fibres ressentie','range'),field('hydration','Hydratation autour des repas','range'),
      section('Faim, satiété & contexte','Pour comprendre ton rythme plutôt que contrôler les quantités.'),
      field('hunger_before','Faim avant le repas principal','range'),field('satiety_after','Satiété après le repas principal','range'),
      field('energy_after','Énergie après les repas','range'),field('digestion_after','Confort digestif après les repas','range'),
      field('prepared','Repas préparé / maison','select',['Oui, principalement','En partie','Non','Variable']),
      field('screenfree','Présence pendant les repas','select',['Plutôt présente','Variable','Souvent distraite']),
      field('pleasure','Plaisir / satisfaction alimentaire','range'),field('restriction','Sensation de restriction','range')
    ]},
    evolution_corporelle:{category:'corps',title:'Évolution corporelle',description:'Suivre silhouette, mesures, composition et ressenti avec une lecture de tendance, jamais réduite à la balance.',configurable:true},
    peau:{category:'corps',title:'Peau',description:'Observer confort, imperfections, sensibilité et contexte pour faire ressortir des tendances personnelles.',fields:[
      section('État de la peau','Une photo mentale de ta peau aujourd’hui.'),
      field('day_state','État général de ta peau','select',['Confortable','Stable','Quelques changements','Plus réactive aujourd’hui','Non observée']),
      field('blemishes','Imperfections','range'),field('dryness','Sécheresse / tiraillements','range'),field('inflammation','Rougeurs / inflammation','range'),
      field('sensitivity','Sensibilité','range'),field('itching','Démangeaisons','range'),field('oiliness','Brillance / excès de sébum','range'),
      field('texture','Texture irrégulière','range'),
      field('zones','Zones surtout concernées','text'),
      section('Contexte','Ces informations aident à comparer plusieurs journées.'),
      field('sleep','Sommeil ressenti','range'),field('stress','Stress','range'),field('hydration','Hydratation ressentie','range'),
      field('cycle_context','Contexte hormonal si tu souhaites le noter','select',['Non renseigné','Règles','Avant les règles','Autre moment du cycle','Périménopause / ménopause','Non concernée']),
      field('sun','Exposition solaire inhabituelle','select',['Non','Oui','Je ne sais pas']),
      field('makeup','Maquillage / occlusion prolongée','select',['Non','Oui','Variable','Non concernée']),
      field('products','Nouveau produit, soin ou changement de routine','textarea')
    ]},
    performance_recuperation:{category:'performance',title:'Activité & récupération',description:'Observer mouvement, charge ressentie, récupération et disponibilité, quelle que soit ta pratique.',configurable:true},
    cycle:{category:'hormonal',title:'Cycle & rythme hormonal',description:'Un suivi détaillé et facultatif avec estimations prudentes, jamais présenté comme contraception.',configurable:true},
    perimenopause:{category:'hormonal',title:'Périménopause & ménopause',description:'Observer les changements physiques et émotionnels présents aujourd’hui, sans supposer de symptôme ni poser de diagnostic.',fields:[
      section('Ressenti général','Renseigne uniquement ce qui est présent.'),
      field('day_state','Comment te sens-tu aujourd’hui ?','select',['Aucun changement particulier','Quelques changements à noter','Journée plus inconfortable','Variable dans la journée']),
      field('hot_flashes','Bouffées de chaleur','select',['Aucune aujourd’hui','1 à 2','3 à 5','Plus de 5','Je ne souhaite pas les compter']),
      field('night_sweats','Sueurs nocturnes','select',['Aucune','Légères','Modérées','Marquées']),
      field('sleep','Sommeil','range'),field('energy','Énergie','range'),field('mood','Humeur','range'),field('stress','Stress / tension','range'),
      field('brain_fog','Clarté mentale / concentration','range'),field('headache','Maux de tête','range'),
      section('Confort physique','Ces repères restent entièrement facultatifs.'),
      field('joint_pain','Douleurs articulaires / raideur','range'),field('muscle_discomfort','Inconfort musculaire','range'),
      field('digestion','Confort digestif','range'),field('bloating','Ballonnements','range'),
      field('palpitations','Palpitations ressenties','select',['Non','Oui, ponctuellement','Oui, plusieurs fois','Je ne souhaite pas répondre']),
      field('vaginal_dryness','Sécheresse intime / inconfort','select',['Non','Légère','Modérée','Marquée','Je ne souhaite pas répondre']),
      field('bleeding_change','Changement de saignement si concernée','select',['Non','Oui','Non concernée','Je ne souhaite pas répondre']),
      field('symptoms','Autre changement que tu souhaites noter','textarea')
    ]},
    jeune_intermit:{category:'habitudes',title:'Jeûne intermittent',description:'Observer rythme, confort, énergie et rupture du jeûne sans rigidité ni objectif imposé.',fields:[
      section('Rythme','Le confort prime toujours sur la durée.'),
      field('fast_state','Aujourd’hui','select',['Je jeûne aujourd’hui','Je fais une pause','Je souhaite seulement observer mon rythme']),
      field('last_meal','Dernier repas','time'),field('first_meal','Premier repas / rupture','time'),
      field('planned_window','Fenêtre visée (si tu en as une)','select',['12 h','13 h','14 h','16 h','18 h','Autre','Aucune cible']),
      field('hunger','Faim pendant le jeûne','range'),field('energy','Énergie','range'),field('mood','Humeur / irritabilité','range'),
      field('hydration','Hydratation ressentie','range'),field('headache','Maux de tête','range'),field('dizziness','Étourdissement / faiblesse','range'),
      section('Rupture & lendemain','Pour vérifier que le rythme reste confortable.'),
      field('break_type','Comment as-tu rompu le jeûne ?','select',['Repas complet','Collation puis repas','Repas léger','Non concernée','Autre']),
      field('break_quality','Confort après la rupture','range'),field('satiety','Satiété après la rupture','range'),field('digestion','Digestion après la rupture','range'),
      field('caffeine','Boissons caféinées pendant le jeûne','select',['Aucune','1','2','3 ou plus','Je ne souhaite pas compter']),
      field('pause_reason','Si tu as fait une pause, pourquoi ?','textarea')
    ]},
    reduction_sucre:{category:'habitudes',title:'Réduction du sucre',description:'Comprendre les envies, leurs contextes et les alternatives qui fonctionnent sans culpabilisation.',fields:[
      section('Envie sucrée','Observe l’intensité et le contexte avant de juger la journée.'),
      field('craving_state','Envie sucrée aujourd’hui','select',['Aucune','Légère','Présente','Forte','Variable']),field('craving','Intensité si tu souhaites la préciser','range'),
      field('moment','Moment principal des envies','select',['Matin','Après le déjeuner','Après-midi','Après le dîner','Soirée / nuit','Variable','Non concernée']),
      field('trigger','Déclencheur possible','select',['Faim','Stress','Habitude','Émotion','Fatigue','Convivialité','Disponibilité du produit','Je ne sais pas','Autre']),
      field('hunger','Faim au moment de l’envie','range'),field('stress','Stress','range'),field('fatigue','Fatigue','range'),
      section('Réponse choisie','Ce qui compte est ce que tu apprends de la situation.'),
      field('products','Produits sucrés consommés (facultatif)','textarea'),field('portion_feeling','Quantité ressentie','select',['Petite','Adaptée','Plus importante que prévu','Je ne souhaite pas l’évaluer']),
      field('alternative','Alternative choisie','textarea'),field('alternative_help','Cette alternative a-t-elle aidé ?','select',['Oui','Un peu','Non','Non concernée']),
      field('satisfaction','Satisfaction après le choix','range'),field('no_added_sugar','Journée sans sucre ajouté','select',['Oui','Non','Je ne souhaite pas suivre ce repère']),
      field('environment','Contexte','select',['Chez moi','Travail / études','Restaurant / sortie','Chez des proches','Déplacement','Autre'])
    ]},
    nutrition_vegetale:{category:'alimentation',title:'Nutrition végétale & micronutriments',configurable:true,description:'Relier les repas réellement renseignés aux protéines, fibres et micronutriments disponibles, sans diagnostiquer de carence.',fields:[
      section('Lecture du Carnet','Les valeurs calculées viennent uniquement des aliments et quantités renseignés lorsque les données nutritionnelles correspondantes sont disponibles. Une absence de source renseignée ne prouve pas une carence.'),
      field('diet_pattern','Mon alimentation aujourd’hui','select',['Végane','Végétarienne','Majoritairement végétale','Flexitarienne','Omnivore','Je préfère ne pas la catégoriser']),
      section('Compléments facultatifs','Ces réponses servent seulement à distinguer ce qui est renseigné de ce qui ne l’est pas. Aucune dose n’est demandée.'),
      field('fortified_today','Aliment enrichi / fortifié aujourd’hui','select',['Non renseigné','Oui','Non']),
      field('supplement_taken','Supplémentation prise aujourd’hui','select',['Non renseigné','Oui','Non']),
      field('energy','Énergie après les repas','range'),field('satiety','Satiété','range'),field('digestion','Confort digestif','range'),field('hunger','Faim','range'),field('variety','Impression de variété','range'),
      field('observation','Remarque utile','textarea')
    ]},
    pas_marche:{category:'performance',title:'Pas & marche',description:'Comprendre ton rythme de marche, sa répartition et sa régularité sans imposer automatiquement 10 000 pas.',configurable:true,fields:[
      section('Aujourd’hui','Apple Santé peut préremplir les données objectives. La saisie manuelle reste possible.'),
      field('steps','Pas','number',null,{min:0,max:200000,step:1}),field('distance_km','Distance marche/course (km)','number',null,{min:0,max:500,step:.01}),
      field('walking_minutes','Temps de marche / entraînement renseigné (min)','number',null,{min:0,max:1440,step:1}),field('flights','Étages montés','number',null,{min:0,max:1000,step:1}),
      field('step_length_cm','Longueur de pas moyenne (cm)','number',null,{min:0,max:250,step:.1}),field('walking_speed_kmh','Vitesse de marche moyenne (km/h)','number',null,{min:0,max:30,step:.1}),
      field('active_energy_kcal','Énergie active (kcal)','number',null,{min:0,max:10000,step:.1}),field('walking_workout_minutes','Temps d’entraînement marche / randonnée (min)','number',null,{min:0,max:1440,step:1}),field('walking_workout_count','Entraînements marche / randonnée','number',null,{min:0,max:100,step:1}),
      section('Ressenti','Ces repères personnels restent distincts des données Apple Santé.'),
      field('ease','Aisance pendant la marche','range'),field('energy_after','Énergie après avoir marché','range'),field('discomfort','Inconfort ou gêne','range'),
      field('walk_type','Type de marche principal','select',['Déplacements du quotidien','Marche volontaire','Promenade','Marche active','Randonnée','Plusieurs contextes','Autre']),
      field('terrain','Terrain principal','select',['Ville / trottoir','Route','Parc / chemin','Sentier / randonnée','Tapis','Mixte','Non renseigné']),
      field('context','Contexte principal','select',['Déplacements du quotidien','Promenade','Marche active','Randonnée','Travail','Plusieurs contextes','Autre']),
      field('observation','Observation utile','textarea')
    ]},
    changer_habitude:{category:'habitudes',title:'Changer une habitude',description:'Comprendre déclencheurs, environnement, réponse et répétition d’un petit pas sans culpabilisation.',configurable:true,fields:[
      section('Ce qui s’est passé','Décris la situation sans jugement.'),
      field('day_state','Comment s’est passée la journée ?','select',['Petit pas réalisé','J’ai observé sans agir','Journée difficile','Pas concernée aujourd’hui']),
      field('urge','Envie ou impulsion','range'),field('moment','Moment','select',['Matin','Midi','Après-midi','Soir','Nuit','Variable']),
      field('context','Contexte / lieu','select',['Chez moi','Travail / études','Transport','Sortie','Avec d’autres personnes','Seule','Autre']),
      field('emotion','État émotionnel dominant','select',['Calme','Stress','Ennui','Fatigue','Tristesse','Colère','Excitation','Autre','Je ne sais pas']),
      field('trigger','Déclencheur observé','textarea'),
      section('La réponse','Une petite modification répétable vaut plus qu’une journée parfaite.'),
      field('response','Réponse choisie','textarea'),field('replacement','Alternative / comportement de remplacement','textarea'),
      field('difficulty','Difficulté ressentie','range'),field('confidence','Confiance pour recommencer demain','range'),
      field('victory','Petite victoire du jour','textarea'),field('setback','Ce que tu souhaites comprendre, sans jugement','textarea')
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
      .mt-follow-form{display:grid;gap:15px}.mt-follow-field label{display:block;font-weight:850;font-size:13px;margin-bottom:7px}.mt-follow-field input,.mt-follow-field select,.mt-follow-field textarea{width:100%;box-sizing:border-box;border:1px solid #ddd2c1;background:#fffdf8;color:#173b31;border-radius:18px;padding:13px 14px;font:inherit} .mt-follow-field input[type="time"],.mt-follow-field input[type="date"],.mt-follow-field input[type="datetime-local"]{-webkit-appearance:none;appearance:none;display:block;inline-size:100%;width:100%;min-inline-size:0;min-width:0;max-inline-size:100%;max-width:100%}.mt-follow-field{min-width:0;overflow:hidden}.mt-follow-field textarea{min-height:92px;resize:vertical}.mt-follow-range{display:grid;grid-template-columns:1fr 55px;gap:11px;align-items:center}.mt-follow-range output{text-align:center;font-weight:850}.mt-follow-optional-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.mt-follow-optional-head label{margin:0}.mt-follow-optional-toggle{border:1px solid #d9ccb7;background:#fffaf1;color:#7b6848;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:850}.mt-follow-optional-range .mt-follow-range{margin-top:11px}.mt-follow-optional-range .mt-follow-range[hidden]{display:none}.mt-follow-save{width:100%;border:0;border-radius:18px;background:#173b31;color:white;padding:16px;font-weight:900;margin-top:4px}.mt-follow-help{padding:14px 15px;border-radius:18px;background:#f2ece2;color:#76695e;font-size:12px;line-height:1.55}.mt-follow-fixed-context{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 14px;padding:11px 14px;border:1px solid rgba(201,176,122,.26);border-radius:16px;background:rgba(255,250,241,.72)}.mt-follow-fixed-context small{color:#a77f37;font-size:10px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.mt-follow-fixed-context strong{color:#173b31;font-size:13px;font-weight:850}.mt-follow-estimate{padding:17px;border:1px solid rgba(178,141,69,.24);background:#fff8ea;border-radius:20px}.mt-follow-estimate small{display:block;color:#a77f37;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.mt-follow-estimate b{display:block;font-family:Georgia,serif;font-size:22px;font-weight:500;margin:7px 0 4px}.mt-follow-estimate p{margin:0;color:#796c60;font-size:13px;line-height:1.45}.mt-follow-loading{text-align:center;padding:35px 10px;color:#7e7164}.mt-follow-loading b{display:block;font-family:Georgia,serif;font-size:27px;font-weight:400;color:#173b31;margin-bottom:8px}.mt-follow-loading span{display:inline-block;width:25px;height:25px;border:2px solid rgba(23,59,49,.16);border-top-color:#173b31;border-radius:50%;animation:mtFollowSpin .8s linear infinite;margin-top:14px}@keyframes mtFollowSpin{to{transform:rotate(360deg)}}
      .mt-cycle-event{border:1px solid rgba(178,141,69,.26);background:#fffaf0;border-radius:20px;padding:15px}.mt-cycle-event small{display:block;color:#847667;font-size:12px;line-height:1.45;margin-bottom:11px}.mt-cycle-event button{width:100%;border:1px solid #c9b07a;border-radius:999px;background:#fffdf8;color:#173b31;padding:12px;font-weight:900}.mt-cycle-event.is-on{background:#f2ead9}.mt-cycle-event.is-on button{background:#173b31;border-color:#173b31;color:#fff}.mt-cycle-event-status{display:none;margin:0 0 8px;color:#9a7636;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.mt-cycle-event.is-on .mt-cycle-event-status{display:block}
      .mt-follow-history-head{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:5px 0 18px}.mt-follow-period{border:1px solid #d8ccb9;background:#fffaf1;color:#173b31;border-radius:999px;padding:10px 15px;font-weight:850}.mt-follow-period.is-on{background:#173b31;border-color:#173b31;color:#fff}.mt-follow-history-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:15px}.mt-follow-stat{padding:16px;border-radius:20px;background:#fffdf8;border:1px solid #e5dccf}.mt-follow-stat b{display:block;font-family:Georgia,serif;font-size:27px;font-weight:400}.mt-follow-stat small{display:block;color:#847667;line-height:1.35;margin-top:3px}.mt-follow-insight{padding:17px;border-radius:21px;background:#173b31;color:#fff;margin:0 0 15px}.mt-follow-insight small{display:block;color:#d1b46f;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.mt-follow-insight b{display:block;font-family:Georgia,serif;font-size:23px;font-weight:400;line-height:1.08;margin:7px 0}.mt-follow-insight p{margin:0;color:rgba(255,255,255,.78);font-size:13px;line-height:1.5}.mt-follow-history-list{display:grid;gap:10px}.mt-follow-history-row{padding:15px;border-radius:20px;background:#fffdf8;border:1px solid #e5dccf}.mt-follow-history-row header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.mt-follow-history-row strong{font-size:14px}.mt-follow-history-row p{margin:6px 0 0;color:#847667;font-size:12px;line-height:1.45}.mt-follow-history-actions{display:flex;gap:7px}.mt-follow-history-actions button{border:1px solid #d8ccb9;background:transparent;color:#173b31;border-radius:999px;padding:8px 10px;font-size:11px;font-weight:850}.mt-follow-history-actions .is-danger{color:#8a4038}.mt-follow-history-empty{padding:22px;border-radius:20px;background:#f2ece2;color:#796d60;text-align:center;line-height:1.5}.mt-follow-secondary{width:100%;border:1px solid #c9b07a;border-radius:18px;background:transparent;color:#173b31;padding:14px;font-weight:900;margin-top:10px}.mt-follow-result-actions{display:grid;gap:10px;margin-top:18px}.mt-follow-result-actions .mt-follow-save,.mt-follow-result-actions .mt-follow-secondary{margin:0}
      .mt-follow-coach{padding:14px 15px;border:1px solid rgba(178,141,69,.24);border-radius:18px;background:#fff8ea;margin:0 0 16px}.mt-follow-coach small{display:block;color:#a77f37;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.mt-follow-coach b{display:block;margin:6px 0 3px;font-size:14px}.mt-follow-coach p{margin:0;color:#796c60;font-size:12px;line-height:1.5}.mt-follow-coach-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.mt-follow-coach-actions button{border:1px solid #d8ccb9;background:#fffdf8;color:#173b31;border-radius:999px;padding:9px 11px;font-size:11px;font-weight:850}
      .mt-follow-analytics-launch{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid rgba(178,141,69,.30);background:#fff8ea;color:#173b31;border-radius:20px;padding:14px 16px;font-weight:900;margin:0 0 16px}.mt-follow-analytics-launch small{display:block;color:#8b7b68;font-size:11px;font-weight:650;margin-top:3px;text-align:left}.mt-follow-analytics-launch span:last-child{font-size:20px;color:#a77f37}.mt-follow-analytics{margin:2px 0 16px}.mt-follow-analytics-title{display:flex;justify-content:space-between;gap:12px;align-items:end;margin:0 0 10px}.mt-follow-analytics-title h3{font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0}.mt-follow-analytics-title small{color:#8c7c6b;font-size:10px;text-align:right}.mt-follow-analytics-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.mt-follow-analytics-card{padding:15px;border:1px solid #e4d8c7;border-radius:20px;background:#fffdf8;min-width:0}.mt-follow-analytics-card>small{display:block;color:#a77f37;font-size:9px;font-weight:900;letter-spacing:.10em;text-transform:uppercase}.mt-follow-analytics-card b{display:block;font-family:Georgia,serif;font-size:22px;font-weight:400;line-height:1.12;margin:7px 0 4px;overflow-wrap:anywhere}.mt-follow-analytics-card p{margin:0;color:#827568;font-size:11px;line-height:1.4}.mt-follow-gauge-track{height:8px;border-radius:999px;background:#eee5d8;overflow:hidden;margin:11px 0 7px}.mt-follow-gauge-fill{height:100%;border-radius:inherit;background:#173b31}.mt-follow-range-track{position:relative;height:10px;border-radius:999px;background:#eee5d8;margin:12px 0 7px}.mt-follow-range-track i{position:absolute;top:50%;width:11px;height:11px;border:2px solid #fffdf8;border-radius:50%;background:#b28d45;transform:translate(-50%,-50%);box-shadow:0 0 0 1px rgba(23,59,49,.16)}.mt-follow-distribution{display:flex;align-items:flex-end;gap:3px;height:58px;margin-top:11px}.mt-follow-distribution i{display:block;flex:1;min-width:3px;border-radius:5px 5px 2px 2px;background:#b28d45}.mt-follow-analytics-note{margin:10px 1px 0;color:#8b7d6f;font-size:10px;line-height:1.45}
      .mt-health-summary{margin:2px 0 16px}.mt-health-summary-head{display:flex;justify-content:space-between;gap:12px;align-items:end;margin:0 0 12px}.mt-health-summary-head h3{font-family:Georgia,serif;font-size:29px;font-weight:400;margin:0;color:#173b31}.mt-health-summary-head small{color:#8c7c6b;font-size:10px;text-align:right;line-height:1.35}.mt-health-metrics{display:grid;gap:10px}.mt-health-metric{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;text-align:left;border:1px solid #e3d8c9;border-radius:22px;background:#fffdf8;padding:15px 16px;color:#173b31}.mt-health-metric:active{transform:scale(.994)}.mt-health-metric small{display:block;color:#a77f37;font-size:10px;font-weight:900;letter-spacing:.10em;text-transform:uppercase}.mt-health-metric b{display:block;font-family:Georgia,serif;font-size:27px;font-weight:400;line-height:1.05;margin-top:8px}.mt-health-metric p{margin:6px 0 0;color:#847669;font-size:11px;line-height:1.4}.mt-health-metric-arrow{font-size:25px;color:#b18a43;align-self:center}.mt-health-detail-hero{margin:8px 0 14px;padding:18px 0 6px}.mt-health-detail-hero small{display:block;color:#8a8078;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.mt-health-detail-hero b{display:block;font-family:Georgia,serif;font-size:44px;font-weight:400;line-height:1;margin:8px 0 5px;color:#173b31}.mt-health-detail-hero p{margin:0;color:#817468;font-size:12px}.mt-health-chart{padding:14px 10px 9px;border:1px solid #e5dccf;border-radius:22px;background:#fffdf8}.mt-health-chart svg{display:block;width:100%;height:auto}.mt-health-last{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 17px;border-radius:20px;background:#efece5;margin:14px 0;color:#173b31}.mt-health-last small{display:block;color:#756b63;font-size:11px}.mt-health-last b{font-family:Georgia,serif;font-size:24px;font-weight:400}.mt-health-about{margin-top:14px;padding:17px;border-radius:22px;background:#fffdf8;border:1px solid #e5dccf}.mt-health-about small{display:block;color:#a77f37;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.mt-health-about b{display:block;font-family:Georgia,serif;font-size:22px;font-weight:400;margin:6px 0}.mt-health-about p{margin:0;color:#776b60;font-size:12px;line-height:1.55}.mt-health-back{border:0;background:transparent;color:#173b31;font-weight:900;padding:7px 0 13px}.mt-health-detail-empty{padding:24px;border-radius:20px;background:#f2ece2;color:#796d60;line-height:1.5}
            .mt-follow-section{margin:7px 0 -2px;padding:15px 2px 4px;border-top:1px solid rgba(201,176,122,.28)}.mt-follow-section:first-child{border-top:0;padding-top:2px}.mt-follow-section b{display:block;font-family:Georgia,serif;font-size:21px;font-weight:400;color:#173b31}.mt-follow-section p{margin:5px 0 0;color:#8a7c6d;font-size:12px;line-height:1.45}.mt-follow-config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:14px;border:1px solid #e3d8c6;border-radius:20px;background:#fffaf1}.mt-follow-config-title{grid-column:1/-1;font-weight:900;font-size:13px;margin-bottom:2px}.mt-follow-check{display:flex;align-items:center;gap:9px;padding:10px 11px;border:1px solid #e1d5c2;border-radius:14px;background:#fffdf8;color:#173b31;font-size:12px;font-weight:750}.mt-follow-check input{width:18px;height:18px;accent-color:#173b31}.mt-follow-check-wide{margin-top:10px}.mt-follow-history-highlights{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 15px}.mt-follow-highlight{padding:14px;border-radius:18px;background:#fff8ea;border:1px solid rgba(178,141,69,.22)}.mt-follow-highlight b{display:block;font-family:Georgia,serif;font-size:20px;font-weight:400;line-height:1.1}.mt-follow-highlight small{display:block;color:#847667;font-size:11px;line-height:1.35;margin-top:5px}.mt-follow-source-note{margin:-4px 0 14px;color:#948575;font-size:11px;line-height:1.45}
      @media(max-width:520px){.mt-follow-config-grid,.mt-follow-history-highlights,.mt-follow-analytics-grid{grid-template-columns:1fr}.mt-follow-sheet{left:0;right:0;transform:none;width:100%;height:89dvh;max-height:89dvh;padding:22px 20px calc(30px + env(safe-area-inset-bottom,0px))}.mt-follow-row{grid-template-columns:1fr}.mt-follow-row-actions{justify-content:flex-start}.mt-follow-sheet h2{font-size:38px}}
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
      section('Mouvement du jour','Le suivi s’adapte à une séance, une marche, une récupération active ou un jour de repos.'),
      field('session','Ta pratique aujourd’hui','select',performanceSessionOptions(settings)),
      field('duration','Durée (min, si utile)','number',null,{min:0,max:600,step:5}),field('intensity','Intensité ressentie','range'),
      field('energy_before','Énergie avant la pratique','range'),field('motivation','Envie / motivation avant','range'),field('fatigue_after','Fatigue après la pratique','range'),
      field('enjoyment','Plaisir / satisfaction après','range'),
      section('Récupération','Pour voir comment ta charge et ton quotidien s’accordent.'),
      field('recovery','Récupération ressentie','range'),field('readiness','Disponibilité pour ta prochaine pratique','range'),
      field('sleep_quality','Sommeil avant cette pratique','range'),field('muscle_soreness','Courbatures / raideur','range'),field('hydration','Hydratation ressentie','range'),
      field('nutrition_recovery','Repas / collation de récupération','select',['Adapté à ma faim','Partiel / tardif','Pas encore','Non concerné','Je ne souhaite pas l’évaluer']),
      field('movement_total','Mouvement global de la journée','select',['Faible','Habituel','Actif','Très actif','Je ne sais pas']),
      field('pain','Inconfort ou douleur à retenir','textarea')
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

  function evolutionFields(settings={}){
    const selected=Array.isArray(settings.measurements)&&settings.measurements.length?settings.measurements:['weight','waist','hips'];
    const show=key=>selected.includes(key)&&!(key==='weight'&&settings.hide_weight===true);
    const measurementFields=[];
    if(show('weight'))measurementFields.push(field('weight','Poids (kg)','number',null,{min:20,max:400,step:.1}));
    if(show('waist'))measurementFields.push(field('waist','Tour de taille (cm)','number',null,{min:30,max:250,step:.5}));
    if(show('hips'))measurementFields.push(field('hips','Tour de hanches (cm)','number',null,{min:30,max:250,step:.5}));
    if(show('chest'))measurementFields.push(field('chest','Tour de poitrine (cm)','number',null,{min:30,max:250,step:.5}));
    if(show('thigh'))measurementFields.push(field('thigh','Tour de cuisse (cm)','number',null,{min:20,max:150,step:.5}));
    if(show('arm'))measurementFields.push(field('arm','Tour de bras (cm)','number',null,{min:15,max:100,step:.5}));
    if(show('body_fat'))measurementFields.push(field('body_fat','Masse grasse (%) — si ton appareil la fournit','number',null,{min:2,max:75,step:.1}));
    if(show('lean_body_mass'))measurementFields.push(field('lean_body_mass','Masse maigre (kg) — si Apple Santé ou ton appareil la fournit','number',null,{min:5,max:250,step:.1}));
    if(show('muscle_mass'))measurementFields.push(field('muscle_mass','Masse musculaire (kg) — si ton appareil la fournit','number',null,{min:5,max:200,step:.1}));
    return [
      section('Ressenti corporel','Le suivi reste utile même sans aucune mesure.'),
      field('day_state','Que souhaites-tu observer aujourd’hui ?','select',['Mon ressenti corporel','Mes vêtements / ma silhouette','Une ou plusieurs mesures','Un changement remarqué','Rien de particulier']),
      field('body_comfort','Confort dans mon corps','range'),field('clothes','Sensation dans les vêtements','select',['Plus ample','Stable','Plus ajusté','Variable','Non observée']),
      field('bloating','Ballonnements / ventre gonflé','range'),field('water_retention','Sensation de rétention / gonflement','range'),
      field('energy','Énergie','range'),field('hunger','Faim ressentie','range'),field('satiety','Satiété','range'),
      ...(measurementFields.length?[section('Mesures choisies',settings.frequency?`Fréquence souhaitée : ${settings.frequency}. Les mesures restent toujours facultatives.`:'Mesure seulement lorsque cela a du sens pour toi.'),...measurementFields]:[]),
      section('Contexte de mesure','Pour comparer des repères pris dans des conditions proches.'),
      field('measurement_time','Moment de la mesure','select',['Au réveil / matin','Dans la journée','Soir','Variable','Non concernée']),
      field('measurement_conditions','Conditions similaires aux mesures précédentes','select',['Oui','À peu près','Non','Je ne sais pas','Non concernée']),
      field('training_context','Activité récente','select',['Repos / activité habituelle','Entraînement récent','Journée très active','Non renseigné']),
      field('change_noticed','Changement remarqué','textarea')
    ];
  }

  function cycleFields(){return [
    section('Repère du jour','Tu peux renseigner seulement ce qui t’est utile.'),
    field('day_state','Comment te sens-tu aujourd’hui ?','select',['Rien de particulier','Quelques changements à noter','Journée plus inconfortable','Variable dans la journée']),
    field('flow','Flux (si présent)','select',['Aucun','Très léger / spotting','Léger','Modéré','Abondant','Je ne souhaite pas le préciser']),
    field('pain','Douleurs / crampes','range'),field('energy','Énergie','range'),field('mood','Humeur','range'),field('stress','Stress / tension','range'),
    field('appetite','Appétit et envies','range'),field('sleep','Sommeil','range'),
    section('Changements corporels','Repères facultatifs pour retrouver des tendances au fil des cycles.'),
    field('bloating','Ballonnements','range'),field('breast_tenderness','Sensibilité des seins','range'),field('headache','Maux de tête','range'),
    field('digestion','Confort digestif','range'),field('skin','Peau / imperfections','range'),field('fluid','Pertes / glaire observée','select',['Non observée','Sèche / peu présente','Crémeuse','Plus fluide / transparente','Variable','Je ne souhaite pas la suivre']),
    field('movement_feeling','Disponibilité pour bouger','range'),field('symptoms','Autre changement que tu souhaites noter','textarea')
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
    if(key==='evolution_corporelle')return evolutionFields(settings);
    if(key==='cycle')return cycleFields();
    // Le mode alimentaire est un réglage de suivi, pas une question répétée chaque jour.
    if(key==='nutrition_vegetale')return (TRACKERS[key]?.fields||[]).filter(def=>def.key!=='diet_pattern');
    return TRACKERS[key]?.fields||[];
  }

  function trackerSummary(key,values={},settings={},date=TODAY()){
    key=normalizeKey(key);
    if(key==='sommeil_profond'){
      const hours=num(values._sleep_hours)??durationBetween(values.bedtime,values.wake_time);return [values.night_state||'',hours?`${String(hours).replace('.',',')} h`:'',present(values.quality)?`qualité ${values.quality}/10`:'',present(values.wake_state)?`réveil ${values.wake_state}/10`:''].filter(Boolean).join(' · ')||'Nuit renseignée';
    }
    if(key==='digestion')return [values.day_state||'',present(values.comfort)?`confort ${values.comfort}/10`:'',present(values.bloating)?`ballonnements ${values.bloating}/10`:''].filter(Boolean).join(' · ')||'Digestion renseignée';
    if(key==='reflux')return [values.episode||'',present(values.intensity)?`intensité ${values.intensity}/10`:''].filter(Boolean).join(' · ')||'Reflux renseigné';
    if(key==='equilibre_alimentaire')return [values.meals||'',present(values.diversity)?`diversité ${values.diversity}/10`:'',present(values.protein)?`protéines ${values.protein}/10`:'',present(values.satiety_after)?`satiété ${values.satiety_after}/10`:''].filter(Boolean).join(' · ')||'Alimentation renseignée';
    if(key==='evolution_corporelle')return [values.day_state||'',values.clothes||'',present(values.body_comfort)?`confort ${values.body_comfort}/10`:'',present(values.weight)?`${String(values.weight).replace('.',',')} kg`:'',present(values.waist)?`taille ${String(values.waist).replace('.',',')} cm`:''].filter(Boolean).join(' · ')||'Ressenti corporel renseigné';
    if(key==='peau')return [values.day_state||'',present(values.inflammation)?`rougeurs ${values.inflammation}/10`:''].filter(Boolean).join(' · ')||'Peau renseignée';
    if(key==='performance_recuperation')return [values._discipline||(settings.discipline==='Autre'?settings.discipline_other:settings.discipline)||'Activité',values.session||'',values.duration?`${values.duration} min`:'',present(values.recovery)?`récupération ${values.recovery}/10`:''].filter(Boolean).join(' · ');
    if(key==='cycle'){
      const estimate=cycleEstimate(settings,date);return estimate?`J${estimate.cycleDay} · ${estimate.phase}`:'Cycle prêt à configurer';
    }
    if(key==='perimenopause')return [values.day_state||'',values.hot_flashes||'',present(values.energy)?`énergie ${values.energy}/10`:'',present(values.sleep)?`sommeil ${values.sleep}/10`:''].filter(Boolean).join(' · ')||'Journée renseignée';
    if(key==='jeune_intermit'){
      const hours=durationBetween(values.last_meal,values.first_meal);return [values.fast_state||'',hours?`${String(hours).replace('.',',')} h`:'',present(values.energy)?`énergie ${values.energy}/10`:''].filter(Boolean).join(' · ')||'Rythme renseigné';
    }
    if(key==='reduction_sucre')return [values.craving_state||'',present(values.craving)?`envie ${values.craving}/10`:'',values.trigger||'',values.no_added_sugar?`sans sucre ajouté : ${String(values.no_added_sugar).toLowerCase()}`:''].filter(Boolean).join(' · ')||'Repère sucre renseigné';
    if(key==='pas_marche'){const goal=num(values._step_goal)??num(settings.step_goal);return [present(values.steps)?`${new Intl.NumberFormat('fr-FR').format(Number(values.steps))} pas`:'',present(values.distance_km)?`${String(values.distance_km).replace('.',',')} km`:'',goal!==null&&settings.goal_mode==='Fixer mon propre objectif'?`repère personnel ${new Intl.NumberFormat('fr-FR').format(goal)}`:''].filter(Boolean).join(' · ')||'Marche renseignée';}
    if(key==='nutrition_vegetale'){const calc=num(values.calculated_meals),count=num(values.meal_count);return [calc!==null?(count!==null?`${calc}/${count} repas calculables`:`${calc} repas calculable${calc>1?'s':''}`):'',present(values.protein_g)?`${String(values.protein_g).replace('.',',')} g protéines`:'',present(values.fiber_g)?`${String(values.fiber_g).replace('.',',')} g fibres`:''].filter(Boolean).join(' · ')||'Nutrition végétale renseignée';}
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
      metric('Nuit',values.night_state);metric('Durée',duration);metric('Qualité',present(values.quality)?`${values.quality}/10`:'');metric('État au réveil',present(values.wake_state)?`${values.wake_state}/10`:'');metric('Sommeil profond',present(values._healthkit_sleep_deep_minutes)?`${values._healthkit_sleep_deep_minutes} min`:'');metric('Sommeil REM',present(values._healthkit_sleep_rem_minutes)?`${values._healthkit_sleep_rem_minutes} min`:'');
      if(hours!==null)signals.sleep_minutes=Math.round(hours*60);signals.sleep_quality=sleepQuality;signals.energy=num(values.wake_state);signals.sleepiness=num(values.sleepiness);signals.sleep_awakenings=num(values.awakenings);signals.sleep_latency=num(values.latency);signals.sleep_deep_minutes=num(values._healthkit_sleep_deep_minutes);signals.sleep_rem_minutes=num(values._healthkit_sleep_rem_minutes);
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
      signals.nutrition_meals=meals;signals.nutrition_balance=balance===null?null:Math.round(balance*10)/100;signals.nutrition_protein=num(values.protein);signals.nutrition_plants=num(values.plants);signals.hydration_feeling=num(values.hydration);signals.hunger=num(values.hunger_before);signals.satiety=num(values.satiety_after);signals.digestion=num(values.digestion_after);signals.energy=num(values.energy_after);
    }else if(key==='evolution_corporelle'){
      pill('Corps',values.day_state||values.clothes||'repère renseigné');if(present(values.body_comfort))pill('Confort',`${values.body_comfort}/10`);metric('Aujourd’hui',values.day_state);metric('Vêtements',values.clothes);metric('Confort corporel',present(values.body_comfort)?`${values.body_comfort}/10`:'');metric('Poids',present(values.weight)?`${values.weight} kg`:'');metric('Tour de taille',present(values.waist)?`${values.waist} cm`:'');metric('Masse grasse',present(values.body_fat)?`${values.body_fat} %`:'');metric('Masse maigre',present(values.lean_body_mass)?`${values.lean_body_mass} kg`:'');metric('Énergie',present(values.energy)?`${values.energy}/10`:'');
      signals.energy=num(values.energy);signals.hunger=num(values.hunger);signals.satiety=num(values.satiety);signals.body_comfort=num(values.body_comfort);signals.weight=num(values.weight);signals.waist=num(values.waist);signals.hips=num(values.hips);signals.body_fat=num(values.body_fat);signals.lean_body_mass=num(values.lean_body_mass);signals.bloating=num(values.bloating);signals.water_retention=num(values.water_retention);
    }else if(key==='peau'){
      const detailedDiscomfort=avg(values.blemishes,values.dryness,values.inflammation,values.sensitivity),discomfort=detailedDiscomfort??semanticScore(values.day_state,{Confortable:1,'Quelques changements':4,'Plus réactive aujourd’hui':8});pill('Peau',values.day_state||(discomfort===null?'renseignée':`${discomfort}/10`));
      metric('Aujourd’hui',values.day_state);metric('Rougeurs',present(values.inflammation)?`${values.inflammation}/10`:'');metric('Sensibilité',present(values.sensitivity)?`${values.sensitivity}/10`:'');signals.skin_discomfort=discomfort;signals.skin_state=values.day_state||null;signals.stress=num(values.stress);signals.sleep_quality=num(values.sleep);
    }else if(key==='performance_recuperation'){
      const discipline=values._discipline||(settings.discipline==='Autre'?settings.discipline_other:settings.discipline)||'Activité';
      pill('Activité',discipline);if(values.duration)pill('Durée',`${values.duration} min`);if(present(values.recovery))pill('Récupération',`${values.recovery}/10`);
      metric('Activité',discipline);metric('Séance',values.session);metric('Durée',values.duration?`${values.duration} min`:'');metric('Pas',present(values._healthkit_steps)?new Intl.NumberFormat('fr-FR').format(Number(values._healthkit_steps)):'');metric('Distance',present(values._healthkit_distance_km)?`${String(values._healthkit_distance_km).replace('.',',')} km`:'');metric('Énergie active',present(values._healthkit_active_energy_kcal)?`${String(values._healthkit_active_energy_kcal).replace('.',',')} kcal`:'');metric('Intensité',present(values.intensity)?`${values.intensity}/10`:'');metric('Énergie',present(values.energy_before)?`${values.energy_before}/10`:'');metric('Récupération',present(values.recovery)?`${values.recovery}/10`:'');
      signals.discipline=discipline;signals.sport_duration=num(values.duration);signals.sport_intensity=num(values.intensity);signals.energy=num(values.energy_before);signals.recovery=num(values.recovery);signals.readiness=num(values.readiness)??num(values.availability);signals.sleep_quality=num(values.sleep_quality)??num(values.sleep);signals.fatigue=num(values.fatigue_after)??num(values.muscle_fatigue);signals.steps=num(values._healthkit_steps);signals.distance_km=num(values._healthkit_distance_km);signals.active_energy_kcal=num(values._healthkit_active_energy_kcal);signals.workout_minutes=num(values._healthkit_workout_minutes);
    }else if(key==='pas_marche'){
      const steps=num(values.steps),distance=num(values.distance_km),minutes=num(values.walking_minutes),activeEnergy=num(values.active_energy_kcal)??num(values._healthkit_active_energy_kcal),walkWorkoutMinutes=num(values.walking_workout_minutes),walkWorkoutCount=num(values.walking_workout_count),hourly=parseHourly(values._healthkit_hourly_steps),hourlyTotal=hourly.reduce((sum,x)=>sum+(Number(x.steps)||0),0),morningShare=hourlyTotal?Math.round(hourly.filter(x=>{const h=Number.isFinite(Number(x.hour))?Number(x.hour):new Date(x.start).getHours();return h<14;}).reduce((sum,x)=>sum+(Number(x.steps)||0),0)/hourlyTotal*100):null;
      pill('Marche',steps===null?'renseignée':`${new Intl.NumberFormat('fr-FR').format(steps)} pas`);if(distance!==null)pill('Distance',`${String(distance).replace('.',',')} km`);
      metric('Pas',steps===null?'':new Intl.NumberFormat('fr-FR').format(steps));metric('Distance',distance===null?'':`${String(distance).replace('.',',')} km`);metric('Temps de marche',minutes===null?'':`${minutes} min`);metric('Longueur du pas',present(values.step_length_cm)?`${values.step_length_cm} cm`:'');metric('Vitesse',present(values.walking_speed_kmh)?`${values.walking_speed_kmh} km/h`:'');metric('Étages',values.flights);metric('Énergie active',activeEnergy===null?'':`${activeEnergy} kcal`);metric('Marche / randonnée',walkWorkoutMinutes===null?'':`${walkWorkoutMinutes} min`);
      const target=Number(settings.step_goal),baseline=Number(settings.personal_baseline_steps);signals.steps=steps;signals.distance_km=distance;signals.walking_minutes=minutes;signals.step_length_cm=num(values.step_length_cm);signals.walking_step_length_cm=num(values.step_length_cm);signals.walking_speed_kmh=num(values.walking_speed_kmh);signals.flights=num(values.flights);signals.flights_climbed=num(values.flights);signals.active_energy_kcal=activeEnergy;signals.walking_workout_minutes=walkWorkoutMinutes;signals.walking_workout_count=walkWorkoutCount;signals.walking_distribution_score=morningShare;signals.walking_goal_progress=steps!==null&&settings.goal_mode==='Fixer mon propre objectif'&&Number.isFinite(target)&&target>0?Math.round(steps/target*100):null;signals.walking_vs_baseline_pct=steps!==null&&Number.isFinite(baseline)&&baseline>0?Math.round((steps-baseline)/baseline*100):null;signals.walking_ease=num(values.ease);signals.energy=num(values.energy_after);signals.walking_discomfort=num(values.discomfort);
    }else if(key==='nutrition_vegetale'){
      const protein=num(values.protein_g),fiber=num(values.fiber_g),coverage=num(values.micronutrient_coverage_count),calculated=num(values.calculated_meals),mealCount=num(values.meal_count),profile=values.diet_pattern||settings.diet_pattern||null;
      pill('Nutrition',protein===null?'Carnet observé':`${String(protein).replace('.',',')} g protéines`);if(coverage!==null)pill('Micronutriments',`${coverage} documentés`);
      metric('Repas calculables',calculated===null?'':mealCount!==null?`${calculated}/${mealCount}`:calculated);metric('Protéines',protein===null?'':`${protein} g`);metric('Glucides',present(values.carbs_g)?`${values.carbs_g} g`:'');metric('Lipides',present(values.fat_g)?`${values.fat_g} g`:'');metric('Fibres',fiber===null?'':`${fiber} g`);metric('Micronutriments documentés',coverage);metric('Sources alimentaires',present(values.micronutrient_source_count)?values.micronutrient_source_count:'');metric('Profil',profile);
      signals.nutrition_protein_g=protein;signals.nutrition_fiber_g=fiber;signals.micronutrient_coverage_count=coverage;signals.nutrition_calculated_meals=calculated;signals.nutrition_meal_count=mealCount;signals.nutrition_data_coverage=calculated!==null&&mealCount!==null&&mealCount>0?Math.round(calculated/mealCount*100):null;signals.nutrition_data_quality=values._nutrition_data_quality||null;signals.energy=num(values.energy);signals.satiety=num(values.satiety);signals.hunger=num(values.hunger);signals.variety=num(values.variety);signals.digestion=num(values.digestion);signals.nutrition_micros=values._micronutrients||null;signals.nutrition_micronutrient_sources=values._micronutrient_sources||null;signals.nutrition_micronutrient_source_count=num(values.micronutrient_source_count);signals.nutrition_source_foods=values._nutrition_source_foods||null;signals.nutrition_carbs_g=num(values.carbs_g);signals.nutrition_fat_g=num(values.fat_g);
    }else if(key==='cycle'){
      const estimate=cycleEstimate(settings,date),cycleDay=num(values.cycle_day_estimate)??estimate?.cycleDay,phase=values.cycle_phase_estimate||estimate?.phase||'Cycle';
      const cycleEvent=estimate?.cycleEvent||values._cycle_calendar_event||null;
      if(cycleEvent==='ovulation_day')pills.push('Ovulation');else if(cycleEvent==='ovulation_window')pills.push("Fenêtre d’ovulation");else if(cycleEvent==='menstrual')pills.push('Période menstruelle');else pill('Cycle',cycleDay?`J${cycleDay}`:'renseigné');
      metric('Aujourd’hui',values.day_state);metric('Phase',phase);metric('Énergie',present(values.energy)?`${values.energy}/10`:'');metric('Douleurs',present(values.pain)?`${values.pain}/10`:'');metric('Appétit',present(values.appetite)?`${values.appetite}/10`:'');metric('Flux',values.flow);
      signals.cycle_day=cycleDay;signals.cycle_phase=phase;signals.cycle_event=cycleEvent;signals.cycle_state=values.day_state||null;signals.energy=num(values.energy);signals.pain=num(values.pain);signals.appetite=num(values.appetite);signals.sleep_quality=num(values.sleep);signals.mood=num(values.mood);
    }else if(key==='perimenopause'){
      pill('Rythme hormonal',values.day_state||'journée renseignée');metric('Aujourd’hui',values.day_state);metric('Bouffées de chaleur',values.hot_flashes);metric('Sueurs nocturnes',values.night_sweats);metric('Énergie',present(values.energy)?`${values.energy}/10`:'');metric('Sommeil',present(values.sleep)?`${values.sleep}/10`:'');
      signals.menopause_state=values.day_state||null;signals.hot_flashes=values.hot_flashes||null;signals.night_sweats=values.night_sweats||null;signals.energy=num(values.energy);signals.sleep_quality=num(values.sleep);signals.mood=num(values.mood);signals.stress=num(values.stress);signals.brain_fog=num(values.brain_fog);signals.digestion=num(values.digestion);signals.bloating=num(values.bloating);signals.pain=num(values.joint_pain);
    }else if(key==='jeune_intermit'){
      const hours=num(values._fast_hours)??durationBetween(values.last_meal,values.first_meal),duration=formatDuration(hours),paused=/pause/i.test(String(values.fast_state||''));pill('Jeûne',paused?'pause':duration||values.fast_state||'renseigné');metric('Aujourd’hui',values.fast_state);metric('Durée',duration);metric('Énergie',present(values.energy)?`${values.energy}/10`:'');metric('Faim',present(values.hunger)?`${values.hunger}/10`:'');
      signals.fast_state=values.fast_state||null;signals.fast_minutes=paused?null:(hours===null?null:Math.round(hours*60));signals.energy=num(values.energy);signals.hunger=num(values.hunger);signals.hydration_feeling=num(values.hydration);
    }else if(key==='reduction_sucre'){
      pill('Sucre',values.craving_state||(present(values.craving)?`envie ${values.craving}/10`:'renseigné'));metric('Aujourd’hui',values.craving_state);metric('Envie',present(values.craving)?`${values.craving}/10`:'');metric('Déclencheur',values.trigger);metric('Sans sucre ajouté',values.no_added_sugar);
      signals.sugar_craving=num(values.craving)??semanticScore(values.craving_state,{Aucune:0,Légère:3,Présente:6,Forte:9,Variable:5});signals.sugar_state=values.craving_state||null;signals.habit_done=values.no_added_sugar==='Oui';signals.hunger=num(values.hunger);signals.stress=num(values.stress);signals.fatigue=num(values.fatigue);signals.satisfaction=num(values.satisfaction);
    }else if(key==='changer_habitude'){
      const done=/Petit pas réalisé/i.test(String(values.day_state||''))||!!String(values.victory||values.response||'').trim(),habit=settings.habit||values.habit||'';
      pill('Habitude',values.day_state||(done?'petit pas réalisé':'renseignée'));metric('Aujourd’hui',values.day_state);metric('Habitude',habit);metric('Petit pas',values.victory);metric('Réponse choisie',values.response);
      signals.habit_state=values.day_state||null;signals.habit_done=done;signals.urge=num(values.urge);signals.habit=habit||null;signals.habit_difficulty=num(values.difficulty);signals.habit_confidence=num(values.confidence);
    }
    return {version:1,key,title:item.title,date,headline:trackerSummary(key,values,settings,date),pills:[...new Set(pills)],metrics,signals};
  }

  function renderCatalog(){
    const modal=root('mtAdvancedTrackers','mt-follow');
    const active=activeKeys();
    modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackersClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackersClose()" aria-label="Fermer">×</button><div class="mt-follow-kicker">Mon carnet · Mes suivis</div><h2>Ajouter un suivi</h2><p class="mt-follow-intro">Choisis seulement les repères qui comptent pour toi. Les suivis masqués conservent leur historique.</p>${active.length?`<div class="mt-follow-active">${active.map(key=>`<button class="mt-follow-chip" type="button" onclick="mtAdvancedTrackerEntry('${key}')">${esc(TRACKERS[key].title)} · Saisir</button>`).join('')}</div>`:`<div class="mt-follow-empty">Aucun suivi personnalisé actif pour le moment. Tu peux commencer par un seul repère.</div>`}${CATEGORIES.map(([category,label,description])=>`<section class="mt-follow-cat"><h3>${label}</h3><p>${description}</p>${Object.entries(TRACKERS).filter(([,item])=>item.category===category).map(([key,item])=>{const pref=preference(key),isOn=pref.enabled;return `<div class="mt-follow-row"><div><b>${esc(item.title)}</b><small>${esc(item.description)}</small></div><div class="mt-follow-row-actions">${isOn&&item.configurable?`<button class="mt-follow-configure" type="button" onclick="mtAdvancedTrackerConfigure('${key}')">Configurer</button>`:''}<button class="mt-follow-action ${isOn?'is-on':''}" type="button" onclick="mtAdvancedTrackerToggle('${key}')">${isOn?'Masquer':'Ajouter'}</button></div></div>`;}).join('')}</section>`).join('')}<div class="mt-follow-help">Les données de santé, de cycle et de symptômes restent privées. Les estimations du cycle ne constituent ni un diagnostic ni une méthode contraceptive.</div></section>`;
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
    if(key==='pas_marche'){
      const mode=settings.goal_mode||'Construire mon repère personnel';
      return `<div class="mt-follow-field"><label>Quel repère souhaites-tu ?</label><select name="goal_mode"><option ${mode==='Observer sans objectif'?'selected':''}>Observer sans objectif</option><option ${mode==='Construire mon repère personnel'?'selected':''}>Construire mon repère personnel</option><option ${mode==='Fixer mon propre objectif'?'selected':''}>Fixer mon propre objectif</option></select></div><div class="mt-follow-field"><label>Objectif personnel de pas, si choisi</label><input name="step_goal" type="number" min="100" max="100000" step="100" value="${esc(settings.step_goal||'')}"></div><input type="hidden" name="personal_baseline_steps" value="${esc(settings.personal_baseline_steps||'')}"><input type="hidden" name="baseline_days" value="${esc(settings.baseline_days||'')}"><div class="mt-follow-fixed-context" data-walking-baseline-suggestion><small>Repère 28 jours</small><strong>${settings.personal_baseline_steps?`${new Intl.NumberFormat('fr-FR').format(Number(settings.personal_baseline_steps))} pas de médiane personnelle`:'Apple Santé peut proposer ton repère si 4 journées comparables sont disponibles.'}</strong><p style="margin:5px 0 0;color:#7d7165;font-size:11px">Aucun objectif n’est modifié automatiquement.</p></div><div class="mt-follow-help">Méthode Tee ne fixe jamais automatiquement 10 000 pas. Le repère personnel est construit à partir de tes journées réellement disponibles, sans transformer les jours manquants en zéro.</div>`;
    }
    if(key==='nutrition_vegetale'){
      const mode=settings.diet_pattern||'Je ne souhaite pas préciser';
      const observed=Array.isArray(settings.observed_nutrients)&&settings.observed_nutrients.length?settings.observed_nutrients:['protein','fiber','iron_mg','calcium_mg','vitamin_b12_ug','vitamin_d_ug','omega3_g','plant_diversity'];
      const opts=[['protein','Protéines'],['fiber','Fibres'],['iron_mg','Fer'],['calcium_mg','Calcium'],['zinc_mg','Zinc'],['iodine_ug','Iode'],['vitamin_b12_ug','Vitamine B12'],['vitamin_d_ug','Vitamine D'],['vitamin_b9_ug','Vitamine B9 / folates'],['vitamin_c_mg','Vitamine C'],['vitamin_b1_mg','Vitamine B1'],['vitamin_b2_mg','Vitamine B2'],['vitamin_b3_mg','Vitamine B3'],['vitamin_b6_mg','Vitamine B6'],['vitamin_e_mg','Vitamine E'],['magnesium_mg','Magnésium'],['phosphorus_mg','Phosphore'],['potassium_mg','Potassium'],['selenium_ug','Sélénium'],['omega3_g','Oméga-3'],['plant_diversity','Diversité végétale']];
      return `<div class="mt-follow-field"><label>Mon mode alimentaire</label><select name="diet_pattern"><option ${mode==='Végane'?'selected':''}>Végane</option><option ${mode==='Végétarien'?'selected':''}>Végétarien</option><option ${mode==='Majoritairement végétal'?'selected':''}>Majoritairement végétal</option><option ${mode==='Flexitarien'?'selected':''}>Flexitarien</option><option ${mode==='Omnivore — je souhaite surtout observer mes micronutriments'?'selected':''}>Omnivore — je souhaite surtout observer mes micronutriments</option><option ${mode==='Je ne souhaite pas préciser'?'selected':''}>Je ne souhaite pas préciser</option></select></div><div class="mt-follow-config-grid"><div class="mt-follow-config-title">Ce que je souhaite observer</div>${opts.map(([k,label])=>`<label class="mt-follow-check"><input type="checkbox" name="observed_nutrients" value="${k}" ${observed.includes(k)?'checked':''}><span>${label}</span></label>`).join('')}</div><div class="mt-follow-field"><label>Aliments enrichis / fortifiés</label><select name="fortified_foods"><option value="">Je ne souhaite pas préciser</option><option ${settings.fortified_foods==='Oui'?'selected':''}>Oui</option><option ${settings.fortified_foods==='Non'?'selected':''}>Non</option></select></div><div class="mt-follow-field"><label>Supplémentation B12 renseignée</label><select name="supplement_b12"><option ${settings.supplement_b12==='Je ne souhaite pas préciser'?'selected':''}>Je ne souhaite pas préciser</option><option ${settings.supplement_b12==='Oui'?'selected':''}>Oui</option><option ${settings.supplement_b12==='Non'?'selected':''}>Non</option></select></div><div class="mt-follow-field"><label>Supplémentation vitamine D renseignée</label><select name="supplement_d"><option ${settings.supplement_d==='Je ne souhaite pas préciser'?'selected':''}>Je ne souhaite pas préciser</option><option ${settings.supplement_d==='Oui'?'selected':''}>Oui</option><option ${settings.supplement_d==='Non'?'selected':''}>Non</option></select></div><div class="mt-follow-field"><label>Supplémentation oméga-3 renseignée</label><select name="supplement_omega3"><option ${settings.supplement_omega3==='Je ne souhaite pas préciser'?'selected':''}>Je ne souhaite pas préciser</option><option ${settings.supplement_omega3==='Oui'?'selected':''}>Oui</option><option ${settings.supplement_omega3==='Non'?'selected':''}>Non</option></select></div><div class="mt-follow-help">Ces repères décrivent seulement ce qui est renseigné. Ils ne permettent jamais d’évaluer un statut biologique ni de diagnostiquer une carence.</div>`;
    }
    if(key==='performance_recuperation'){
      const rhythm=normalizePracticeRhythm(settings.level);
      return `<div class="mt-follow-field"><label>Quelle activité pratiques-tu ?</label><select name="discipline" required><option value="">Choisir une activité…</option>${DISCIPLINES.map(x=>`<option value="${esc(x)}" ${settings.discipline===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="mt-follow-field" data-other-discipline><label>Si autre, précise ta pratique</label><input name="discipline_other" type="text" value="${esc(settings.discipline_other||'')}"></div><div class="mt-follow-field"><label>Ton rythme de pratique</label><select name="level">${LEVELS.map(x=>`<option value="${esc(x)}" ${rhythm===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="mt-follow-help">Yoga, Pilates, marche, fitness ou compétition : ce suivi s’adapte à ta pratique et à ton ressenti, sans niveau requis.</div>`;
    }
    if(key==='evolution_corporelle'){
      const measurements=Array.isArray(settings.measurements)&&settings.measurements.length?settings.measurements:['weight','waist','hips'];
      const opts=[['weight','Poids'],['waist','Tour de taille'],['hips','Tour de hanches'],['chest','Tour de poitrine'],['thigh','Tour de cuisse'],['arm','Tour de bras'],['body_fat','Masse grasse %'],['lean_body_mass','Masse maigre'],['muscle_mass','Masse musculaire']];
      const checked=k=>measurements.includes(k)?'checked':'';
      return `<div class="mt-follow-field"><label>Ce que tu veux surtout observer</label><select name="body_focus"><option ${settings.body_focus==='Vue globale'?'selected':''}>Vue globale</option><option ${settings.body_focus==='Silhouette & mesures'?'selected':''}>Silhouette & mesures</option><option ${settings.body_focus==='Poids & tendance'?'selected':''}>Poids & tendance</option><option ${settings.body_focus==='Ressenti & vêtements'?'selected':''}>Ressenti & vêtements</option><option ${settings.body_focus==='Composition corporelle'?'selected':''}>Composition corporelle</option></select></div><div class="mt-follow-field"><label>Ton intention</label><select name="body_intention"><option ${settings.body_intention==='Observer sans objectif chiffré'?'selected':''}>Observer sans objectif chiffré</option><option ${settings.body_intention==='Perdre de la graisse'?'selected':''}>Perdre de la graisse</option><option ${settings.body_intention==='Prendre de la masse'?'selected':''}>Prendre de la masse</option><option ${settings.body_intention==='Recomposition corporelle'?'selected':''}>Recomposition corporelle</option><option ${settings.body_intention==='Stabilisation'?'selected':''}>Stabilisation</option><option ${settings.body_intention==='Autre'?'selected':''}>Autre</option></select></div><div class="mt-follow-field"><label>Fréquence de mesure souhaitée</label><select name="frequency"><option ${settings.frequency==='Quand je le souhaite'?'selected':''}>Quand je le souhaite</option><option ${settings.frequency==='1× par semaine'?'selected':''}>1× par semaine</option><option ${settings.frequency==='Toutes les 2 semaines'?'selected':''}>Toutes les 2 semaines</option><option ${settings.frequency==='Mensuel'?'selected':''}>Mensuel</option><option ${settings.frequency==='Quotidien'?'selected':''}>Quotidien</option></select></div><div class="mt-follow-config-grid"><div class="mt-follow-config-title">Mesures à afficher</div>${opts.map(([k,label])=>`<label class="mt-follow-check"><input type="checkbox" name="measurements" value="${k}" ${checked(k)}><span>${label}</span></label>`).join('')}</div><label class="mt-follow-check mt-follow-check-wide"><input type="checkbox" name="hide_weight" value="1" ${settings.hide_weight===true?'checked':''}><span>Je préfère masquer le poids de mon suivi</span></label><div class="mt-follow-help">Tu peux utiliser ce suivi sans balance. Les tendances de mesures ne seront jamais qualifiées de « bonnes » ou « mauvaises » : Tee les présente comme des évolutions à observer dans leur contexte.</div>`;
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
    if(key==='pas_marche'){
      const modeSelect=modal.querySelector('[name="goal_mode"]'),goalField=modal.querySelector('[name="step_goal"]')?.closest('.mt-follow-field');
      const syncGoal=()=>{if(goalField)goalField.hidden=modeSelect?.value!=='Fixer mon propre objectif';};
      modeSelect?.addEventListener('change',syncGoal);syncGoal();
      const baselineHost=modal.querySelector('[data-walking-baseline-suggestion]');
      Promise.resolve(window.mtHealthKitWalkingBaseline?.(28)).then(model=>{if(!model||!baselineHost)return;const base=modal.querySelector('[name="personal_baseline_steps"]'),count=modal.querySelector('[name="baseline_days"]');if(base)base.value=String(model.medianSteps||'');if(count)count.value=String(model.days||'');if(model.days>=4){baselineHost.querySelector('strong').textContent=`${new Intl.NumberFormat('fr-FR').format(model.medianSteps)} pas de médiane · ${model.days} jours disponibles`;const p=baselineHost.querySelector('p');if(p)p.innerHTML=`Moyenne : ${new Intl.NumberFormat('fr-FR').format(model.averageSteps)} pas/j · proposition douce : ${new Intl.NumberFormat('fr-FR').format(model.suggestedStepGoal)} pas. Rien ne change sans ton accord. <button type="button" data-use-walk-suggestion style="margin-top:8px;border:1px solid #c9b07a;background:#fffdf8;color:#173b31;border-radius:999px;padding:7px 10px;font-weight:800">Utiliser la proposition comme objectif</button>`;baselineHost.querySelector('[data-use-walk-suggestion]')?.addEventListener('click',()=>{if(modeSelect)modeSelect.value='Fixer mon propre objectif';const goal=modal.querySelector('[name="step_goal"]');if(goal)goal.value=String(model.suggestedStepGoal);syncGoal();});}else baselineHost.querySelector('strong').textContent=`${model.days} journée${model.days>1?'s':''} disponible${model.days>1?'s':''} · encore quelques repères`;}).catch(()=>{});
    }else if(key==='performance_recuperation'){
      const disciplineSelect=modal.querySelector('[name="discipline"]'),otherField=modal.querySelector('[data-other-discipline]');
      const syncOther=()=>{if(otherField)otherField.hidden=disciplineSelect?.value!=='Autre';};
      disciplineSelect?.addEventListener('change',syncOther);syncOther();
    }
  };
  window.mtAdvancedTrackerConfigClose=()=>{root('mtAdvancedTrackerConfig','mt-follow-config').classList.remove('open');pendingAfterConfig=null;};

  async function saveConfig(event){
    event.preventDefault();const modal=root('mtAdvancedTrackerConfig','mt-follow-config'),key=normalizeKey(modal.dataset.key),fd=new FormData(event.currentTarget),current=preference(key),settings={...(current.settings||{})};
    if(key==='pas_marche'){
      settings.goal_mode=String(fd.get('goal_mode')||'Construire mon repère personnel');settings.step_goal=fd.get('step_goal')?Math.max(100,Math.min(100000,Number(fd.get('step_goal'))||0)):null;settings.personal_baseline_steps=fd.get('personal_baseline_steps')?Math.round(Number(fd.get('personal_baseline_steps')))||null:null;settings.baseline_days=fd.get('baseline_days')?Math.round(Number(fd.get('baseline_days')))||null:null;
      if(settings.goal_mode==='Fixer mon propre objectif'&&!settings.step_goal){toast('Indique ton objectif personnel de pas.');return;}
    }else if(key==='nutrition_vegetale'){
      settings.diet_pattern=String(fd.get('diet_pattern')||'Je ne souhaite pas préciser');
      settings.observed_nutrients=fd.getAll('observed_nutrients').map(String).filter(Boolean);
      settings.fortified_foods=String(fd.get('fortified_foods')||'');settings.supplement_b12=String(fd.get('supplement_b12')||'Je ne souhaite pas préciser');settings.supplement_d=String(fd.get('supplement_d')||'Je ne souhaite pas préciser');settings.supplement_omega3=String(fd.get('supplement_omega3')||'Je ne souhaite pas préciser');settings.nutrition_setup_done=true;
    }else if(key==='performance_recuperation'){
      settings.discipline=String(fd.get('discipline')||'');settings.discipline_other=String(fd.get('discipline_other')||'').trim();settings.level=normalizePracticeRhythm(fd.get('level')||'Occasionnelle');
      if(!DISCIPLINES.includes(settings.discipline)){toast('Choisis d’abord ton activité.');return;}
    }else if(key==='evolution_corporelle'){
      settings.body_focus=String(fd.get('body_focus')||'Vue globale');settings.body_intention=String(fd.get('body_intention')||'Observer sans objectif chiffré');settings.frequency=String(fd.get('frequency')||'Quand je le souhaite');settings.hide_weight=fd.get('hide_weight')==='1';settings.measurements=fd.getAll('measurements').map(String).filter(Boolean);settings.body_setup_done=true;
      if(!settings.measurements.length&&settings.body_focus!=='Ressenti & vêtements')settings.measurements=settings.hide_weight?['waist','hips']:['weight','waist','hips'];
      if(settings.hide_weight)settings.measurements=settings.measurements.filter(x=>x!=='weight');
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
    if(def.type==='section')return `<div class="mt-follow-section"><b>${esc(def.label)}</b>${def.copy?`<p>${esc(def.copy)}</p>`:''}</div>`;
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

  function historyCacheKey(key,days=7){return `${UID||'guest'}:${normalizeKey(key)}:${Number(days)||0}`;}
  function invalidateHistory(key){const prefix=`${UID||'guest'}:${normalizeKey(key)}:`;for(const cacheKey of [...HISTORY_CACHE.keys()])if(cacheKey.startsWith(prefix))HISTORY_CACHE.delete(cacheKey);}
  function removeLocalEntry(key,date){try{localStorage.removeItem(entryKey(UID,key,date));}catch(e){}}
  function readLocalHistory(key,from='1900-01-01'){
    const prefix=`mt_tracker_entry_${UID||'guest'}_${normalizeKey(key)}_`,rows=[];
    try{for(let i=0;i<localStorage.length;i++){const storageKey=localStorage.key(i)||'';if(!storageKey.startsWith(prefix))continue;const row=JSON.parse(localStorage.getItem(storageKey)||'null');if(row?.entry_date>=from&&row.entry_date<=TODAY())rows.push(row);}}catch(e){}
    return rows;
  }
  async function fetchHistory(rawKey,days=7,force=false){
    const key=normalizeKey(rawKey),n=[0,7,28,90].includes(Number(days))?Number(days):7,all=n===0,from=all?'1900-01-01':addDays(TODAY(),-(n-1)),cacheKey=historyCacheKey(key,n),cached=HISTORY_CACHE.get(cacheKey);
    if(!force&&cached&&Date.now()-cached.at<HISTORY_TTL)return cached.rows;
    const localRows=readLocalHistory(key,from),c=client();let remoteRows=[];
    if(c&&UID){try{
      const base=()=>{let q=c.from('user_tracker_entries').select('tracker_key,entry_date,values,note,updated_at').eq('user_id',UID).eq('tracker_key',key).lte('entry_date',TODAY()).order('entry_date',{ascending:false});if(!all)q=q.gte('entry_date',from);return q;};
      if(!all){
        const query=base().limit(Math.min(110,n+8));const result=await Promise.race([query,new Promise(resolve=>setTimeout(()=>resolve({data:null}),2600))]);if(Array.isArray(result?.data))remoteRows=result.data;
      }else{
        // « Depuis le début » est la seule vue qui peut parcourir tout l'historique.
        // Elle est chargée explicitement par pages de 200, jamais au simple affichage du formulaire.
        for(let offset=0;offset<5000;offset+=200){
          const result=await Promise.race([base().range(offset,offset+199),new Promise(resolve=>setTimeout(()=>resolve({data:null}),3200))]);
          const page=Array.isArray(result?.data)?result.data:[];remoteRows.push(...page);if(page.length<200)break;
        }
      }
    }catch(e){console.warn('[Mes suivis] historique local utilisé',e);}}
    const merged=new Map();[...localRows,...remoteRows].forEach(row=>{if(row?.entry_date)merged.set(row.entry_date,row);});
    const rows=[...merged.values()].sort((a,b)=>String(b.entry_date).localeCompare(String(a.entry_date)));
    rows.forEach(row=>writeLocalEntry(key,row.entry_date,row));HISTORY_CACHE.set(cacheKey,{at:Date.now(),rows});return rows;
  }

  async function mergeWalkingHealthKitHistory(rows,days=28){
    if(!window.mtHealthKitReadActivityHistory)return rows;const n=!Number(days)?365:Math.max(28,Math.min(365,Number(days)||28)),from=addDays(TODAY(),-(n-1));
    try{
      const history=await window.mtHealthKitReadActivityHistory(from,TODAY(),false),map=new Map((rows||[]).map(row=>[row.entry_date,row]));
      (history?.days||[]).forEach(day=>{if(!day?.date||!day.hasData)return;const existing=map.get(day.date),auto={steps:day.steps,distance_km:day.distanceKm,walking_minutes:day.walkingMinutes,flights:day.flightsClimbed,step_length_cm:day.stepLengthCm,walking_speed_kmh:day.walkingSpeedKmh,active_energy_kcal:day.activeEnergyKcal,walking_workout_minutes:day.walkingMinutes,walking_workout_count:day.walkingWorkoutCount,_healthkit_active_energy_kcal:day.activeEnergyKcal,_healthkit_workout_minutes:day.workoutMinutes,_healthkit_source:'Apple HealthKit'};Object.keys(auto).forEach(k=>auto[k]===undefined&&delete auto[k]);map.set(day.date,{tracker_key:'pas_marche',entry_date:day.date,values:{...auto,...(existing?.values||{})},note:existing?.note||'',updated_at:existing?.updated_at||history.readAt||null,_transient_healthkit:!existing});});
      try{const one=await window.mtHealthKitReadActivityHistory(TODAY(),TODAY(),true),hours=(one?.hourly||[]).filter(x=>Number(x.steps)>0),todayRow=map.get(TODAY());if(todayRow&&hours.length)todayRow.values={...(todayRow.values||{}),_healthkit_hourly_steps:hours};}catch(_){/* distribution facultative */}
      return [...map.values()].sort((a,b)=>String(b.entry_date).localeCompare(String(a.entry_date)));
    }catch(_){return rows;}
  }

  function primarySpec(key){return ({
    sommeil_profond:{label:'qualité du sommeil',good:1,get:v=>num(v.quality)??semanticScore(v.night_state,{Réparatrice:9,Correcte:7,Agitée:4,'Trop courte':3,Décalée:5})},
    digestion:{label:'confort digestif',good:1,get:v=>num(v.comfort)??semanticScore(v.day_state,{Confortable:9,'Quelques gênes':6,'Inconfort marqué':3,'Variable selon les repas':5})},
    reflux:{label:'intensité du reflux',good:-1,get:v=>/^Non/i.test(String(v.episode||''))?0:num(v.intensity)},
    equilibre_alimentaire:{label:'équilibre renseigné',good:1,get:v=>avg(v.diversity,v.protein,v.plants,v.starches,v.hydration,v.schedule,v.satiety_after)},
    evolution_corporelle:{label:'confort corporel',good:1,get:v=>num(v.body_comfort)??num(v.energy)},
    peau:{label:'inconfort de la peau',good:-1,get:v=>avg(v.blemishes,v.dryness,v.inflammation,v.sensitivity,v.itching)},
    performance_recuperation:{label:'récupération',good:1,get:v=>num(v.recovery)},cycle:{label:'énergie ressentie',good:1,get:v=>num(v.energy)},
    perimenopause:{label:'énergie ressentie',good:1,get:v=>num(v.energy)},jeune_intermit:{label:'confort après rupture',good:1,get:v=>num(v.break_quality)??num(v.energy)},
    reduction_sucre:{label:'intensité des envies',good:-1,get:v=>num(v.craving)??semanticScore(v.craving_state,{Aucune:0,Légère:3,Présente:6,Forte:9,Variable:5})},
    pas_marche:{label:'pas quotidiens',good:1,get:v=>num(v.steps)},
    nutrition_vegetale:{label:'micronutriments documentés',good:1,get:v=>num(v.micronutrient_coverage_count)},
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
      reflux:['stress renseigné','intensité du reflux',v=>num(v.stress),v=>/^Non/i.test(String(v.episode||''))?0:num(v.intensity)],
      equilibre_alimentaire:['satiété après le repas','énergie après les repas',v=>num(v.satiety_after),v=>num(v.energy_after)],
      evolution_corporelle:['ballonnements / gonflement','confort corporel',v=>avg(v.bloating,v.water_retention),v=>num(v.body_comfort)],
      peau:['stress renseigné','inconfort de la peau',v=>num(v.stress),v=>avg(v.blemishes,v.dryness,v.inflammation,v.sensitivity,v.itching)],
      performance_recuperation:['intensité ressentie','récupération',v=>num(v.intensity),v=>num(v.recovery)],
      cycle:['qualité du sommeil','énergie ressentie',v=>num(v.sleep),v=>num(v.energy)],
      perimenopause:['sommeil renseigné','énergie ressentie',v=>num(v.sleep),v=>num(v.energy)],
      jeune_intermit:['durée du jeûne','confort après la rupture',v=>num(v._fast_hours)??durationBetween(v.last_meal,v.first_meal),v=>num(v.break_quality)],
      reduction_sucre:['fatigue renseignée','intensité des envies',v=>num(v.fatigue),v=>num(v.craving)??semanticScore(v.craving_state,{Aucune:0,Légère:3,Présente:6,Forte:9,Variable:5})],
      pas_marche:['pas renseignés','énergie après la marche',v=>num(v.steps),v=>num(v.energy_after)],
      nutrition_vegetale:['fibres calculées','confort digestif',v=>num(v.fiber_g),v=>num(v.digestion)],
      changer_habitude:['intensité de l’impulsion','difficulté ressentie',v=>num(v.urge),v=>num(v.difficulty)]
    },cfg=map[key];if(!cfg)return null;const pairs=rows.map(row=>[cfg[2](row.values||{}),cfg[3](row.values||{})]).filter(pair=>pair.every(Number.isFinite)),r=correlation(pairs);if(r===null||Math.abs(r)<.35)return null;
    const direction=r>0?'évoluent souvent dans le même sens':'semblent évoluer en sens inverse';
    return `Dans les ${pairs.length} journées comparables renseignées, ${cfg[0]} et ${cfg[1]} ${direction}. C’est un repère personnel à observer, pas une relation de cause à effet.`;
  }
  function historyStats(key,rows,days){
    const all=!Number(days),from=all?'1900-01-01':addDays(TODAY(),-(Number(days)-1)),period=all?rows:rows.filter(row=>row.entry_date>=from),spec=primarySpec(key),values=spec?period.map(row=>spec.get(row.values||{})).filter(Number.isFinite):[];
    let trend='Pas encore assez de recul';
    if(values.length>=4){const ordered=[...values].reverse(),split=Math.ceil(ordered.length/2),older=average(ordered.slice(0,split)),recent=average(ordered.slice(split));if(recent!==null&&older!==null){const delta=(recent-older)*(spec.good||1);trend=Math.abs(recent-older)<.6?'Plutôt stable':key==='evolution_corporelle'?'Évolution à observer':delta>0?'Tendance plus favorable':'Point à observer';}}
    return {period,count:period.length,average:average(values),label:spec?.label||'repère principal',trend,relation:cautiousRelation(key,period),all};
  }

  function lastFirstNumeric(rows,key){
    const clean=[...rows].reverse().map(r=>({date:r.entry_date,value:num(r.values?.[key])})).filter(x=>x.value!==null);if(clean.length<1)return null;
    return {first:clean[0],last:clean[clean.length-1],delta:Math.round((clean[clean.length-1].value-clean[0].value)*10)/10};
  }
  function fmtDelta(info,unit=''){
    if(!info)return '—';const d=info.delta,sign=d>0?'+':'';return `${sign}${String(d).replace('.',',')}${unit}`;
  }
  function fmtMinutes(minutes){const n=Math.max(0,Math.round(Number(minutes||0))),h=Math.floor(n/60),m=n%60;return h?`${h} h${m?` ${String(m).padStart(2,'0')} min`:''}`:`${m} min`;}
  function median(list){const clean=list.map(num).filter(Number.isFinite).sort((a,b)=>a-b);if(!clean.length)return null;const m=Math.floor(clean.length/2);return clean.length%2?clean[m]:(clean[m-1]+clean[m])/2;}
  function metricSeries(rows,get){return [...rows].reverse().map(row=>({date:row.entry_date,value:get(row.values||{})})).filter(point=>Number.isFinite(point.value));}
  function fmtMetric(value,unit='',digits=1){if(!Number.isFinite(value))return '—';const n=Math.round(value*(10**digits))/(10**digits);const rendered=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:digits}).format(n);return `${rendered}${unit?` ${unit}`:''}`;}
  function rangeCard(label,rows,get,unit='',source='Saisi manuellement',formatter=null){const series=metricSeries(rows,get);if(!series.length)return null;const vals=series.map(x=>x.value),min=Math.min(...vals),max=Math.max(...vals),latest=series.at(-1),format=formatter||((v)=>fmtMetric(v,unit));return {type:'range',label,value:`${format(min)}${min===max?'':` – ${format(max)}`}`,detail:`Dernière donnée : ${format(latest.value)} · ${fmtDate(latest.date)}`,source,min,max,latest:latest.value,aria:`${label} : minimum ${format(min)}, maximum ${format(max)}, dernière donnée ${format(latest.value)}`};}
  function ratingCard(label,rows,get,source='Ressenti personnel'){const series=metricSeries(rows,get);if(!series.length)return null;const value=average(series.map(x=>x.value));return {type:'rating',label,value:`${fmtMetric(value,'',1)} / 10`,detail:`Moyenne sur ${series.length} repère${series.length>1?'s':''}`,source,percent:Math.max(0,Math.min(100,value*10)),aria:`${label} : moyenne ${fmtMetric(value,'',1)} sur 10`};}
  function frequencyCard(label,rows,predicate,source='Calcul Méthode Tee'){if(!rows.length)return null;const value=rows.filter(row=>predicate(row.values||{})).length,total=rows.length;return {type:'frequency',label,value:`${value} / ${total}`,detail:`jours renseignés concernés`,source,percent:total?value/total*100:0,aria:`${label} : ${value} sur ${total} jours renseignés`};}
  function consistencyCard(label,rows,get,unit='',source='Calcul Méthode Tee'){const series=metricSeries(rows,get);if(series.length<3)return null;const vals=series.map(x=>x.value),med=median(vals),tol=Math.max(unit==='pas'?500:unit==='h'?.35:1,Math.abs(med)*.18),near=vals.filter(v=>Math.abs(v-med)<=tol).length;return {type:'consistency',label,value:`${near} / ${vals.length}`,detail:`proches de ta médiane · ${fmtMetric(med,unit,unit==='pas'?0:1)}`,source,percent:near/vals.length*100,aria:`${label} : ${near} journées sur ${vals.length} proches de la médiane`};}
  function distributionCard(label,rows,get,source='Calcul Méthode Tee'){const counts=new Map();rows.forEach(row=>{const value=String(get(row.values||{})||'').trim();if(value&&!/^Je ne|^Non concern/i.test(value))counts.set(value,(counts.get(value)||0)+1);});const entries=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);if(!entries.length)return null;const total=entries.reduce((a,b)=>a+b[1],0);return {type:'distributionText',label,value:entries[0][0],detail:entries.map(([k,v])=>`${k} · ${v}`).join(' · '),source,percent:total?entries[0][1]/total*100:0,aria:`${label} : ${entries.map(([k,v])=>`${k} ${v}`).join(', ')}`};}
  function parseHourly(value){if(Array.isArray(value))return value;try{const x=JSON.parse(String(value||''));return Array.isArray(x)?x:[];}catch(e){return [];}}
  function hourlyCard(rows){const latest=[...rows].find(row=>parseHourly(row.values?._healthkit_hourly_steps).length);if(!latest)return null;const hours=parseHourly(latest.values._healthkit_hourly_steps),bins=Array.from({length:24},()=>0);hours.forEach(x=>{let h=Number(x.hour);if(!Number.isFinite(h)&&x.start){const d=new Date(x.start);if(!Number.isNaN(d.getTime()))h=d.getHours();}if(h>=0&&h<24)bins[h]+=Number(x.steps)||0;});const total=bins.reduce((a,b)=>a+b,0);if(!total)return null;const sum=(a,b)=>bins.slice(a,b).reduce((x,y)=>x+y,0),morning=sum(5,12),afternoon=sum(12,18),evening=sum(18,24)+sum(0,5),parts=[['Matin',morning],['Après-midi',afternoon],['Soirée / nuit',evening]].map(([label,value])=>[label,Math.round(value/total*100)]),dominant=[...parts].sort((a,b)=>b[1]-a[1])[0];return {type:'hourly',label:'Répartition de ma journée',value:`${dominant[0]} · ${dominant[1]} %`,detail:`${parts.map(([label,pct])=>`${label} ${pct} %`).join(' · ')}. Une période sans pas n’est jamais appelée « sédentaire ».`,source:'Apple Santé',bins,aria:`Répartition des pas : ${parts.map(([label,pct])=>`${label} ${pct} pour cent`).join(', ')}`};}
  function progressCard(label,rows,get,target,unit='pas'){if(!Number.isFinite(Number(target))||Number(target)<=0)return null;const series=metricSeries(rows,get);if(!series.length)return null;const latest=series.at(-1).value,pct=Math.max(0,Math.min(100,latest/Number(target)*100));return {type:'progress',label,value:`${fmtMetric(latest,unit,0)} / ${fmtMetric(Number(target),unit,0)}`,detail:'Repère choisi par toi',source:'Objectif personnel',percent:pct,aria:`${label} : ${fmtMetric(latest,unit,0)} sur ${fmtMetric(Number(target),unit,0)}`};}
  function parseJSONValue(value,fallback={}){if(value&&typeof value==='object')return value;try{const parsed=JSON.parse(String(value||''));return parsed&&typeof parsed==='object'?parsed:fallback;}catch(_){return fallback;}}
  const MICRO_META={iron_mg:['Fer','mg'],calcium_mg:['Calcium','mg'],zinc_mg:['Zinc','mg'],iodine_ug:['Iode','µg'],magnesium_mg:['Magnésium','mg'],phosphorus_mg:['Phosphore','mg'],potassium_mg:['Potassium','mg'],selenium_ug:['Sélénium','µg'],vitamin_b1_mg:['Vitamine B1','mg'],vitamin_b2_mg:['Vitamine B2','mg'],vitamin_b3_mg:['Vitamine B3','mg'],vitamin_b6_mg:['Vitamine B6','mg'],vitamin_b9_ug:['Vitamine B9','µg'],vitamin_b12_ug:['Vitamine B12','µg'],vitamin_c_mg:['Vitamine C','mg'],vitamin_d_ug:['Vitamine D','µg'],vitamin_e_mg:['Vitamine E','mg'],omega3_g:['Oméga-3','g']};
  function microNumber(values,key){const micros=parseJSONValue(values?._micronutrients,{}),raw=micros?.[key];return num(raw&&typeof raw==='object'?raw.value:raw);}
  function microSources(values,key){const sources=parseJSONValue(values?._micronutrient_sources,{}),raw=Array.isArray(sources?.[key])?sources[key]:[];return raw.map(x=>typeof x==='string'?x:(x?.name||x?.food_name||'')).filter(Boolean);}
  function microSourceDetails(values,key,unit=''){const sources=parseJSONValue(values?._micronutrient_sources,{}),raw=Array.isArray(sources?.[key])?sources[key]:[];return raw.map(x=>{if(typeof x==='string')return x;const name=x?.name||x?.food_name||'',value=num(x?.value);return [name,value===null?'':fmtMetric(value,unit,2)].filter(Boolean).join(' · ');}).filter(Boolean);}
  function averageCard(label,rows,get,unit='',source='Calcul Méthode Tee',digits=1){const series=metricSeries(rows,get);if(!series.length)return null;const value=average(series.map(x=>x.value));return {type:'average',label,value:fmtMetric(value,unit,digits),detail:`Moyenne · ${series.length} journée${series.length>1?'s':''} renseignée${series.length>1?'s':''}`,source,aria:`${label} : moyenne ${fmtMetric(value,unit,digits)}`};}
  function clockMinutes(value){const m=String(value||'').match(/^(\d{1,2}):(\d{2})/);if(!m)return null;const h=Number(m[1]),min=Number(m[2]);return Number.isFinite(h)&&Number.isFinite(min)?h*60+min:null;}
  function clockLabel(minutes){if(!Number.isFinite(minutes))return '—';const n=((Math.round(minutes)%1440)+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
  function clockSeries(rows,get,nightShift=false){return [...rows].reverse().map(row=>{let value=clockMinutes(get(row.values||{}));if(value===null)return null;if(nightShift&&value<12*60)value+=1440;return {date:row.entry_date,value};}).filter(Boolean);}
  function timeAverageCard(label,rows,get,nightShift=false,source='Saisi / Apple Santé'){const series=clockSeries(rows,get,nightShift);if(!series.length)return null;const value=average(series.map(x=>x.value));return {type:'average',label,value:clockLabel(value),detail:`Horaire moyen · ${series.length} repère${series.length>1?'s':''}`,source,aria:`${label} : horaire moyen ${clockLabel(value)}`};}
  function timeVariabilityCard(label,rows,get,nightShift=false){const series=clockSeries(rows,get,nightShift);if(series.length<3)return null;const vals=series.map(x=>x.value),mean=average(vals),mad=average(vals.map(v=>Math.abs(v-mean)));return {type:'consistency',label,value:`± ${Math.round(mad)} min`,detail:'Écart moyen autour de ton horaire habituel',source:'Calcul Méthode Tee',percent:Math.max(0,Math.min(100,100-(mad/120*100))),aria:`${label} : variabilité moyenne ${Math.round(mad)} minutes`};}
  function statusCard(label,value,detail,source='Méthode Tee'){return {type:'status',label,value,detail,source,aria:`${label} : ${value}`};}
  function walkingBaselineCard(rows,settings={}){
    const ordered=[...rows].reverse(),latest=ordered.map(r=>({date:r.entry_date,value:num(r.values?.steps)})).filter(x=>Number.isFinite(x.value)).at(-1);if(!latest)return null;
    const from=addDays(latest.date,-28),prior=ordered.map(r=>({date:r.entry_date,value:num(r.values?.steps)})).filter(x=>Number.isFinite(x.value)&&x.date<latest.date&&x.date>=from).slice(-28),vals=prior.map(x=>x.value);
    let med=median(vals),mean=average(vals),days=vals.length,source='Tes 28 derniers jours renseignés';
    if(days<4&&Number.isFinite(Number(settings.personal_baseline_steps))){med=Number(settings.personal_baseline_steps);mean=med;days=Number(settings.baseline_days)||days;source='Apple Santé · repère 28 jours';}
    if(!Number.isFinite(med)||days<4)return statusCard('Rythme personnel · 28 j','Premières données',`${Math.max(days,0)} journée${days>1?'s':''} comparable${days>1?'s':''}. Le repère se construit sans imposer 10 000 pas.`,source);
    const delta=(latest.value-med)/med*100,near=Math.abs(delta)<10,copy=near?'Proche de ton rythme habituel':`${delta>0?'+':''}${Math.round(delta)} % vs ton rythme habituel`;
    return {type:'baseline',label:'Aujourd’hui vs mon rythme · 28 j',value:new Intl.NumberFormat('fr-FR').format(Math.round(latest.value))+' pas',detail:`${copy} · médiane ${new Intl.NumberFormat('fr-FR').format(Math.round(med))} · moyenne ${new Intl.NumberFormat('fr-FR').format(Math.round(mean||med))}`,source,percent:Math.max(0,Math.min(100,50+delta)),aria:`Pas aujourd'hui ${Math.round(latest.value)}, ${copy}`};
  }
  function micronutrientCard(key,rows){const meta=MICRO_META[key];if(!meta)return null;const [label,unit]=meta,series=metricSeries(rows,v=>microNumber(v,key));if(!series.length){const latest=[...rows].find(r=>microSources(r.values||{},key).length);const names=latest?microSources(latest.values||{},key):[];return statusCard(label,'Non documenté',names.length?`Sources renseignées : ${names.slice(0,3).join(' · ')}`:'Aucune source calculable renseignée sur cette période. Cela ne signifie pas une carence.','Carnet alimentaire');}const vals=series.map(x=>x.value),latest=series.at(-1),latestRow=[...rows].find(r=>r.entry_date===latest.date),sources=latestRow?microSourceDetails(latestRow.values||{},key,unit):[];return {type:'range',label,value:`${fmtMetric(Math.min(...vals),unit,2)}${Math.min(...vals)===Math.max(...vals)?'':` – ${fmtMetric(Math.max(...vals),unit,2)}`}`,detail:`Dernière donnée : ${fmtMetric(latest.value,unit,2)}${sources.length?` · Sources : ${sources.slice(0,3).join(' · ')}`:''}`,source:'Carnet alimentaire',min:Math.min(...vals),max:Math.max(...vals),latest:latest.value,aria:`${label}, plage ${fmtMetric(Math.min(...vals),unit,2)} à ${fmtMetric(Math.max(...vals),unit,2)}`};}
  function trackerAnalytics(key,rows,settings={},allRows=rows){
    const cards=[],add=x=>{if(x)cards.push(x);};
    if(key==='sommeil_profond'){
      add(rangeCard('Durée du sommeil',rows,v=>num(v._sleep_hours)??durationBetween(v.bedtime,v.wake_time),'h','Saisi / Apple Santé',v=>formatDuration(v)));
      add(averageCard('Durée moyenne',rows,v=>num(v._sleep_hours)??durationBetween(v.bedtime,v.wake_time),'h','Calcul Méthode Tee',1));
      add(timeAverageCard('Heure de coucher moyenne',rows,v=>v.bedtime,true));add(timeAverageCard('Heure de réveil moyenne',rows,v=>v.wake_time,false));add(timeVariabilityCard('Régularité des horaires',rows,v=>v.bedtime,true));
      add(averageCard('Réveils nocturnes',rows,v=>num(v.awakenings),'','Saisi / Apple Santé',1));add(averageCard('Temps éveillé la nuit',rows,v=>num(v.awake_minutes),'min','Saisi / Apple Santé',0));
      add(averageCard('Sommeil profond',rows,v=>num(v._healthkit_sleep_deep_minutes),'min','Apple Santé',0));add(averageCard('Sommeil REM',rows,v=>num(v._healthkit_sleep_rem_minutes),'min','Apple Santé',0));
      add(ratingCard('Qualité ressentie',rows,v=>num(v.quality)));add(ratingCard('État au réveil',rows,v=>num(v.wake_state)));add(consistencyCard('Régularité de durée',rows,v=>num(v._sleep_hours)??durationBetween(v.bedtime,v.wake_time),'h'));
    }
    else if(key==='digestion'){
      add(ratingCard('Confort digestif',rows,v=>num(v.comfort)));add(ratingCard('Ballonnements',rows,v=>num(v.bloating)));add(ratingCard('Douleurs / crampes',rows,v=>num(v.pain)));add(ratingCard('Lourdeur',rows,v=>num(v.heaviness)));add(ratingCard('Gaz',rows,v=>num(v.gas)));
      add(frequencyCard('Jours avec gêne',rows,v=>/gêne|inconfort|variable/i.test(String(v.day_state||''))));add(distributionCard('Transit le plus renseigné',rows,v=>v.transit));add(distributionCard('Moment le plus associé',rows,v=>v.meal_moment));add(distributionCard('Taille des repas',rows,v=>v.meal_size));add(distributionCard('Vitesse des repas',rows,v=>v.meal_speed));
    }
    else if(key==='reflux'){
      add(frequencyCard('Jours avec reflux',rows,v=>v.episode&&!/^Non/i.test(String(v.episode))));add(ratingCard('Intensité ressentie',rows,v=>/^Non/i.test(String(v.episode||''))?0:num(v.intensity)));add(distributionCard('Moment des épisodes',rows,v=>v.onset));add(distributionCard('Durée renseignée',rows,v=>v.duration));add(distributionCard('Repas proche du coucher',rows,v=>v.meal_gap_bed));add(distributionCard('Position après repas',rows,v=>v.position));add(distributionCard('Contexte gras / épicé',rows,v=>v.spicy_fatty));add(distributionCard('Contexte acidité',rows,v=>v.acidic));add(distributionCard('Caféine',rows,v=>v.caffeine));
    }
    else if(key==='equilibre_alimentaire'){
      add(ratingCard('Diversité',rows,v=>num(v.diversity)));add(ratingCard('Repères protéines',rows,v=>num(v.protein)));add(ratingCard('Végétaux',rows,v=>num(v.plants)));add(ratingCard('Fibres ressenties',rows,v=>num(v.fiber)));add(ratingCard('Satiété',rows,v=>num(v.satiety_after)));add(ratingCard('Hydratation autour des repas',rows,v=>num(v.hydration)));add(ratingCard('Plaisir',rows,v=>num(v.pleasure)));add(ratingCard('Sensation de restriction',rows,v=>num(v.restriction)));
    }
    else if(key==='evolution_corporelle'){
      if(!settings.hide_weight)add(rangeCard('Poids',rows,v=>num(v.weight),'kg'));add(rangeCard('Tour de taille',rows,v=>num(v.waist),'cm'));add(rangeCard('Tour de hanches',rows,v=>num(v.hips),'cm'));add(rangeCard('Tour de poitrine',rows,v=>num(v.chest),'cm'));add(rangeCard('Tour de cuisse',rows,v=>num(v.thigh),'cm'));add(rangeCard('Tour de bras',rows,v=>num(v.arm),'cm'));add(rangeCard('Masse grasse',rows,v=>num(v.body_fat),'%'));add(rangeCard('Masse maigre',rows,v=>num(v.lean_body_mass),'kg'));add(rangeCard('Masse musculaire',rows,v=>num(v.muscle_mass),'kg'));add(ratingCard('Confort corporel',rows,v=>num(v.body_comfort)));add(distributionCard('Sensation dans les vêtements',rows,v=>v.clothes));add(ratingCard('Ballonnements ressentis',rows,v=>num(v.bloating)));add(ratingCard('Rétention ressentie',rows,v=>num(v.water_retention)));
    }
    else if(key==='peau'){
      add(ratingCard('Imperfections',rows,v=>num(v.blemishes)));add(ratingCard('Réactivité / rougeurs',rows,v=>avg(v.inflammation,v.sensitivity)));add(ratingCard('Sécheresse',rows,v=>num(v.dryness)));add(ratingCard('Démangeaisons',rows,v=>num(v.itching)));add(ratingCard('Sébum',rows,v=>num(v.oiliness)));add(ratingCard('Texture',rows,v=>num(v.texture)));add(frequencyCard('Jours réactifs / changés',rows,v=>/réactive|changement/i.test(String(v.day_state||''))));add(ratingCard('Sommeil renseigné',rows,v=>num(v.sleep)));add(ratingCard('Stress renseigné',rows,v=>num(v.stress)));
    }
    else if(key==='performance_recuperation'){
      add(ratingCard('Récupération',rows,v=>num(v.recovery)));add(ratingCard('Disponibilité',rows,v=>num(v.readiness)??num(v.availability)));add(ratingCard('Charge ressentie',rows,v=>num(v.intensity)));add(ratingCard('Fatigue après pratique',rows,v=>num(v.fatigue_after)??num(v.muscle_fatigue)));add(ratingCard('Énergie avant pratique',rows,v=>num(v.energy_before)));add(rangeCard('Temps de pratique',rows,v=>num(v.duration),'min'));add(frequencyCard('Jours avec pratique',rows,v=>v.session&&!/Repos/i.test(String(v.session))));add(consistencyCard('Régularité de pratique',rows,v=>num(v.duration),'min'));add(rangeCard('Pas Apple Santé',rows,v=>num(v._healthkit_steps),'pas','Apple Santé'));add(rangeCard('Distance Apple Santé',rows,v=>num(v._healthkit_distance_km),'km','Apple Santé'));add(rangeCard('Énergie active Apple Santé',rows,v=>num(v._healthkit_active_energy_kcal),'kcal','Apple Santé'));
    }
    else if(key==='cycle'){
      add(ratingCard('Énergie',rows,v=>num(v.energy)));add(ratingCard('Sommeil',rows,v=>num(v.sleep)));add(ratingCard('Douleurs',rows,v=>num(v.pain)));add(ratingCard('Stress',rows,v=>num(v.stress)));add(ratingCard('Humeur',rows,v=>num(v.mood)));add(ratingCard('Appétit / envies',rows,v=>num(v.appetite)));add(ratingCard('Ballonnements',rows,v=>num(v.bloating)));add(ratingCard('Peau',rows,v=>num(v.skin)));add(ratingCard('Disponibilité pour bouger',rows,v=>num(v.movement_feeling)));add(frequencyCard('Jours avec flux renseigné',rows,v=>present(v.flow)&&v.flow!=='Aucun'));add(frequencyCard('Jours avec symptômes renseignés',rows,v=>[v.pain,v.bloating,v.headache,v.breast_tenderness].some(x=>num(x)!==null&&num(x)>0)));
    }
    else if(key==='perimenopause'){
      add(ratingCard('Sommeil',rows,v=>num(v.sleep)));add(ratingCard('Énergie',rows,v=>num(v.energy)));add(ratingCard('Humeur',rows,v=>num(v.mood)));add(ratingCard('Stress',rows,v=>num(v.stress)));add(ratingCard('Concentration',rows,v=>num(v.brain_fog)));add(ratingCard('Douleurs articulaires',rows,v=>num(v.joint_pain)));add(ratingCard('Confort digestif',rows,v=>num(v.digestion)));add(frequencyCard('Jours avec bouffées',rows,v=>v.hot_flashes&&!/^Aucune/i.test(String(v.hot_flashes))));add(frequencyCard('Nuits avec sueurs',rows,v=>v.night_sweats&&!/^Aucune/i.test(String(v.night_sweats))));
    }
    else if(key==='jeune_intermit'){
      add(rangeCard('Durée du jeûne',rows,v=>num(v._fast_hours)??durationBetween(v.last_meal,v.first_meal),'h','Saisi manuellement',v=>formatDuration(v)));add(ratingCard('Faim',rows,v=>num(v.hunger)));add(ratingCard('Énergie',rows,v=>num(v.energy)));add(ratingCard('Hydratation ressentie',rows,v=>num(v.hydration)));add(ratingCard('Maux de tête',rows,v=>num(v.headache)));add(ratingCard('Étourdissement / faiblesse',rows,v=>num(v.dizziness)));add(ratingCard('Confort après rupture',rows,v=>num(v.break_quality)));add(ratingCard('Satiété après rupture',rows,v=>num(v.satiety)));add(ratingCard('Digestion après rupture',rows,v=>num(v.digestion)));add(frequencyCard('Jours de pause',rows,v=>/pause/i.test(String(v.fast_state||''))));
    }
    else if(key==='reduction_sucre'){
      add(ratingCard('Intensité des envies',rows,v=>num(v.craving)??semanticScore(v.craving_state,{Aucune:0,Légère:3,Présente:6,Forte:9,Variable:5})));add(frequencyCard('Jours sans sucre ajouté',rows,v=>v.no_added_sugar==='Oui'));add(frequencyCard('Alternatives utilisées',rows,v=>present(v.alternative)));add(frequencyCard('Alternatives jugées utiles',rows,v=>v.alternative_help==='Oui'||v.alternative_help==='Un peu'));add(distributionCard('Moments des envies',rows,v=>v.moment));add(distributionCard('Déclencheurs renseignés',rows,v=>v.trigger));add(ratingCard('Satisfaction après le choix',rows,v=>num(v.satisfaction)));
    }
    else if(key==='changer_habitude'){
      add(frequencyCard('Petits pas réalisés',rows,v=>/Petit pas réalisé/i.test(String(v.day_state||''))||present(v.victory)));add(ratingCard('Confiance',rows,v=>num(v.confidence)));add(ratingCard('Difficulté / friction',rows,v=>num(v.difficulty)));add(ratingCard('Intensité de l’impulsion',rows,v=>num(v.urge)));add(distributionCard('Déclencheurs fréquents',rows,v=>v.trigger));add(frequencyCard('Réponses alternatives utilisées',rows,v=>present(v.replacement)||present(v.response)));
    }
    else if(key==='pas_marche'){
      add(walkingBaselineCard(allRows,settings));add(rangeCard('Pas',rows,v=>num(v.steps),'pas',rows.some(r=>present(r.values?._healthkit_source))?'Apple Santé / saisie':'Saisi manuellement'));add(averageCard('Moyenne de pas',rows,v=>num(v.steps),'pas','Calcul Méthode Tee',0));const st=metricSeries(rows,v=>num(v.steps));if(st.length)add(statusCard('Médiane',fmtMetric(median(st.map(x=>x.value)),'pas',0),`${st.length} journée${st.length>1?'s':''} réellement renseignée${st.length>1?'s':''}`));add(consistencyCard('Régularité du rythme',rows,v=>num(v.steps),'pas'));add(rangeCard('Distance',rows,v=>num(v.distance_km),'km'));add(averageCard('Distance moyenne',rows,v=>num(v.distance_km),'km','Calcul Méthode Tee',1));add(rangeCard('Longueur de pas',rows,v=>num(v.step_length_cm),'cm',rows.some(r=>present(r.values?._healthkit_source))?'Apple Santé / saisie':'Saisi manuellement'));add(rangeCard('Vitesse de marche',rows,v=>num(v.walking_speed_kmh),'km/h'));add(rangeCard('Énergie active',rows,v=>num(v.active_energy_kcal)??num(v._healthkit_active_energy_kcal),'kcal','Apple Santé / saisie'));add(rangeCard('Étages montés',rows,v=>num(v.flights),'étages','Apple Santé / saisie'));add(rangeCard('Temps marche / randonnée',rows,v=>num(v.walking_workout_minutes)??num(v.walking_minutes),'min','Apple Santé / saisie'));add(averageCard('Entraînements marche / randonnée',rows,v=>num(v.walking_workout_count),'','Apple Santé / saisie',1));if(settings.goal_mode==='Fixer mon propre objectif')add(progressCard('Objectif personnel',rows,v=>num(v.steps),Number(settings.step_goal),'pas'));add(hourlyCard(rows));
    }
    else if(key==='nutrition_vegetale'){
      const coverage=metricSeries(rows,v=>{const a=num(v.calculated_meals),b=num(v.meal_count);return a!==null&&b>0?a/b*100:null;});if(coverage.length){const value=average(coverage.map(x=>x.value));add({type:'ratingPercent',label:'Données nutritionnelles exploitables',value:`${Math.round(value)} %`,detail:'Qualité du journal, pas qualité de l’alimentation',source:'Carnet alimentaire',percent:value,aria:`Données nutritionnelles exploitables : ${Math.round(value)} pour cent`});}
      const selected=Array.isArray(settings.observed_nutrients)&&settings.observed_nutrients.length?settings.observed_nutrients:['protein','fiber','iron_mg','calcium_mg','vitamin_b12_ug','vitamin_d_ug','omega3_g'];
      if(selected.includes('protein'))add(rangeCard('Protéines calculées',rows,v=>num(v.protein_g),'g','Carnet alimentaire'));add(rangeCard('Glucides calculés',rows,v=>num(v.carbs_g),'g','Carnet alimentaire'));add(rangeCard('Lipides calculés',rows,v=>num(v.fat_g),'g','Carnet alimentaire'));if(selected.includes('fiber'))add(rangeCard('Fibres calculées',rows,v=>num(v.fiber_g),'g','Carnet alimentaire'));selected.filter(k=>MICRO_META[k]).forEach(k=>add(micronutrientCard(k,rows)));
      if(selected.includes('plant_diversity')){const uniq=new Set();rows.forEach(r=>{const foods=parseJSONValue(r.values?._nutrition_source_foods,[]);(Array.isArray(foods)?foods:[]).forEach(x=>{const name=typeof x==='string'?x:x?.name;if(name)uniq.add(name);});});add(statusCard('Diversité végétale documentée',uniq.size?`${uniq.size} aliment${uniq.size>1?'s':''}`:'Non documentée','Nombre de noms d’aliments sources réellement renseignés sur la période, sans note de qualité.','Carnet'));}
      add(frequencyCard('Jours avec repas calculables',rows,v=>num(v.calculated_meals)>0,'Carnet alimentaire'));add(frequencyCard('Jours avec sources micronutritionnelles',rows,v=>num(v.micronutrient_source_count)>0,'Carnet alimentaire'));add(ratingCard('Satiété ressentie',rows,v=>num(v.satiety)));add(ratingCard('Impression de variété',rows,v=>num(v.variety)));add(ratingCard('Confort digestif',rows,v=>num(v.digestion)));
    }
    return {cards:cards.slice(0,key==='nutrition_vegetale'?32:key==='pas_marche'?18:14)};
  }

  function analyticsCardHTML(card){const meter=['rating','frequency','consistency','progress','ratingPercent','distributionText','baseline'].includes(card.type)?`<div class="mt-follow-gauge-track" aria-hidden="true"><div class="mt-follow-gauge-fill" style="width:${Math.max(0,Math.min(100,Number(card.percent)||0))}%"></div></div>`:'';let visual=meter;if(card.type==='range'&&Number.isFinite(card.min)&&Number.isFinite(card.max)){const span=card.max-card.min||1,pos=Math.max(0,Math.min(100,(card.latest-card.min)/span*100));visual=`<div class="mt-follow-range-track" aria-hidden="true"><i style="left:${pos}%"></i></div>`;}if(card.type==='hourly'){const max=Math.max(1,...card.bins);visual=`<div class="mt-follow-distribution" aria-hidden="true">${card.bins.map(v=>`<i style="height:${Math.max(3,Math.round(v/max*100))}%"></i>`).join('')}</div>`;}return `<article class="mt-follow-analytics-card" role="group" aria-label="${esc(card.aria||card.label)}"><small>${esc(card.label)}</small><b>${esc(card.value)}</b>${visual}<p>${esc(card.detail||'')}</p><p style="margin-top:5px;color:#a28e73">${esc(card.source||'')}</p></article>`;}
  function analyticsHTML(key,rows,settings,days,allRows=rows){const model=trackerAnalytics(key,rows,settings,allRows);if(!model.cards.length)return `<div class="mt-follow-source-note">Les jauges apparaîtront dès qu’un premier repère compatible sera renseigné. Une donnée absente reste inconnue, jamais égale à zéro.</div>`;const label=!Number(days)?'Depuis le début':`${days} jours`;return `<section class="mt-follow-analytics"><div class="mt-follow-analytics-title"><h3>Repères analytiques</h3><small>${esc(label)} · données réellement renseignées</small></div><div class="mt-follow-analytics-grid">${model.cards.map(analyticsCardHTML).join('')}</div><p class="mt-follow-analytics-note">Ces repères sont descriptifs : ils montrent plages, moyennes, fréquences ou repères choisis. Elles ne posent aucun diagnostic et ne transforment pas les jours sans donnée en zéro.</p></section>`;}
  function historyHighlights(key,rows){
    const values=rows.map(r=>r.values||{}),items=[];const push=(value,label)=>{if(value!==null&&value!==undefined&&value!=='')items.push({value:String(value),label});};
    if(key==='sommeil_profond'){const durations=values.map(v=>num(v._sleep_hours)??durationBetween(v.bedtime,v.wake_time)).filter(Number.isFinite),deep=values.map(v=>num(v._healthkit_sleep_deep_minutes)).filter(Number.isFinite);push(durations.length?formatDuration(average(durations)):'—','durée moyenne');push(Math.round((average(values.map(v=>num(v.quality)))||0)*10)/10||'—','qualité moyenne /10');if(deep.length)push(fmtMinutes(average(deep)),'sommeil profond moyen · Apple Santé');push(values.filter(v=>Number(v.awakenings)>0).length,'nuits avec réveils signalés');}
    else if(key==='digestion'){push(Math.round((average(values.map(v=>num(v.comfort)))||0)*10)/10||'—','confort moyen /10');push(Math.round((average(values.map(v=>num(v.bloating)))||0)*10)/10||'—','ballonnements moyens /10');push(values.filter(v=>v.transit&&v.transit!=='Habituel').length,'jours avec transit différent');}
    else if(key==='reflux'){push(values.filter(v=>v.episode&&!/^Non/i.test(v.episode)).length,'jours avec épisode signalé');push(Math.round((average(values.map(v=>num(v.intensity)))||0)*10)/10||'—','intensité moyenne /10');}
    else if(key==='equilibre_alimentaire'){push(Math.round((average(values.map(v=>num(v.plants)))||0)*10)/10||'—','végétaux /10');push(Math.round((average(values.map(v=>num(v.protein)))||0)*10)/10||'—','protéines /10');push(Math.round((average(values.map(v=>num(v.satiety_after)))||0)*10)/10||'—','satiété /10');}
    else if(key==='evolution_corporelle'){const w=lastFirstNumeric(rows,'weight'),wa=lastFirstNumeric(rows,'waist'),hi=lastFirstNumeric(rows,'hips'),bf=lastFirstNumeric(rows,'body_fat'),lm=lastFirstNumeric(rows,'lean_body_mass');if(w)push(fmtDelta(w,' kg'),'poids · début → dernier');if(wa)push(fmtDelta(wa,' cm'),'tour de taille');if(hi)push(fmtDelta(hi,' cm'),'tour de hanches');if(bf)push(fmtDelta(bf,' pt'),'masse grasse');if(lm)push(fmtDelta(lm,' kg'),'masse maigre');if(!items.length)push(Math.round((average(values.map(v=>num(v.body_comfort)))||0)*10)/10||'—','confort corporel /10');}
    else if(key==='peau'){push(Math.round((average(values.map(v=>avg(v.blemishes,v.dryness,v.inflammation,v.sensitivity,v.itching)))||0)*10)/10||'—','inconfort moyen /10');push(values.filter(v=>/réactive|changements/i.test(String(v.day_state||''))).length,'jours avec changement');}
    else if(key==='performance_recuperation'){const hkSteps=values.map(v=>num(v._healthkit_steps)).filter(Number.isFinite);push(values.filter(v=>v.session&&!/Repos/i.test(v.session)).length,'séances / pratiques');push(Math.round(values.reduce((a,v)=>a+(num(v.duration)||0),0))+' min','temps de pratique');if(hkSteps.length)push(new Intl.NumberFormat('fr-FR').format(Math.round(average(hkSteps))),'pas moyens · Apple Santé');push(Math.round((average(values.map(v=>num(v.recovery)))||0)*10)/10||'—','récupération /10');}
    else if(key==='cycle'){push(values.filter(v=>present(v.flow)&&v.flow!=='Aucun').length,'jours avec flux renseigné');push(Math.round((average(values.map(v=>num(v.energy)))||0)*10)/10||'—','énergie /10');push(Math.round((average(values.map(v=>num(v.pain)))||0)*10)/10||'—','douleurs /10');}
    else if(key==='perimenopause'){push(values.filter(v=>v.hot_flashes&&!/^Aucune/i.test(v.hot_flashes)).length,'jours avec bouffées signalées');push(Math.round((average(values.map(v=>num(v.sleep)))||0)*10)/10||'—','sommeil /10');push(Math.round((average(values.map(v=>num(v.energy)))||0)*10)/10||'—','énergie /10');}
    else if(key==='jeune_intermit'){const hours=values.map(v=>num(v._fast_hours)??durationBetween(v.last_meal,v.first_meal)).filter(Number.isFinite);push(hours.length?formatDuration(average(hours)):'—','durée moyenne du jeûne');push(values.filter(v=>/pause/i.test(String(v.fast_state||''))).length,'jours de pause');push(Math.round((average(values.map(v=>num(v.break_quality)))||0)*10)/10||'—','confort après rupture /10');}
    else if(key==='reduction_sucre'){push(values.filter(v=>v.no_added_sugar==='Oui').length,'jours sans sucre ajouté renseignés');push(Math.round((average(values.map(v=>num(v.craving)))||0)*10)/10||'—','envie moyenne /10');push(values.filter(v=>v.alternative_help==='Oui'||v.alternative_help==='Un peu').length,'alternatives jugées utiles');}
    else if(key==='pas_marche'){const steps=values.map(v=>num(v.steps)).filter(Number.isFinite),distance=values.map(v=>num(v.distance_km)).filter(Number.isFinite),length=values.map(v=>num(v.step_length_cm)).filter(Number.isFinite);if(steps.length){push(new Intl.NumberFormat('fr-FR').format(Math.round(average(steps))),'pas moyens / jour');push(`${new Intl.NumberFormat('fr-FR').format(Math.min(...steps))}–${new Intl.NumberFormat('fr-FR').format(Math.max(...steps))}`,'plage observée');}if(distance.length)push(`${String(Math.round(average(distance)*10)/10).replace('.',',')} km`,'distance moyenne');if(length.length)push(`${String(Math.round(average(length)*10)/10).replace('.',',')} cm`,'longueur de pas moyenne');}
    else if(key==='nutrition_vegetale'){const protein=values.map(v=>num(v.protein_g)).filter(Number.isFinite),fiber=values.map(v=>num(v.fiber_g)).filter(Number.isFinite),coverage=values.map(v=>num(v.micronutrient_coverage_count)).filter(Number.isFinite);if(protein.length)push(`${String(Math.round(average(protein)*10)/10).replace('.',',')} g`,'protéines moyennes calculées');if(fiber.length)push(`${String(Math.round(average(fiber)*10)/10).replace('.',',')} g`,'fibres moyennes calculées');if(coverage.length)push(Math.round(average(coverage)),'micronutriments documentés en moyenne');push(values.filter(v=>num(v.calculated_meals)>0).length,'journées avec repas quantifié');}
    else if(key==='changer_habitude'){push(values.filter(v=>/Petit pas réalisé/i.test(String(v.day_state||''))||v.victory).length,'petits pas réalisés');push(Math.round((average(values.map(v=>num(v.confidence)))||0)*10)/10||'—','confiance /10');push(Math.round((average(values.map(v=>num(v.urge)))||0)*10)/10||'—','impulsion /10');}
    return items.slice(0,4);
  }
  function historyRowsHTML(key,rows){
    if(!rows.length)return `<div class="mt-follow-history-empty">Aucun repère enregistré sur cette période. Commence par une seule saisie utile aujourd’hui.</div>`;
    return `<div class="mt-follow-history-list">${rows.map(row=>`<article class="mt-follow-history-row"><header><div><strong>${esc(row.entry_date===TODAY()?'Aujourd’hui':fmtDate(row.entry_date))}</strong><p>${esc(trackerSummary(key,row.values||{},preference(key).settings||{},row.entry_date))}</p></div><div class="mt-follow-history-actions"><button type="button" onclick="mtAdvancedTrackerEdit('${esc(key)}','${esc(row.entry_date)}')">Modifier</button><button class="is-danger" type="button" onclick="mtAdvancedTrackerDelete('${esc(key)}','${esc(row.entry_date)}')">Supprimer</button></div></header></article>`).join('')}</div>`;
  }
  function chartSpecs(key,settings={}){const map={
    sommeil_profond:[['Durée du sommeil',v=>num(v._sleep_hours)??durationBetween(v.bedtime,v.wake_time),'h'],['Qualité ressentie',v=>num(v.quality),'/10'],['État au réveil',v=>num(v.wake_state),'/10'],['Sommeil profond',v=>num(v._healthkit_sleep_deep_minutes),'min'],['Sommeil REM',v=>num(v._healthkit_sleep_rem_minutes),'min'],['Réveils nocturnes',v=>num(v.awakenings),'']],
    digestion:[['Confort digestif',v=>num(v.comfort),'/10'],['Ballonnements',v=>num(v.bloating),'/10'],['Douleurs',v=>num(v.pain),'/10'],['Lourdeur',v=>num(v.heaviness),'/10'],['Hydratation ressentie',v=>num(v.hydration),'/10']],
    reflux:[['Intensité',v=>/^Non/i.test(String(v.episode||''))?0:num(v.intensity),'/10'],['Stress renseigné',v=>num(v.stress),'/10']],
    equilibre_alimentaire:[['Diversité',v=>num(v.diversity),'/10'],['Présence de protéines',v=>num(v.protein),'/10'],['Présence de végétaux',v=>num(v.plants),'/10'],['Satiété',v=>num(v.satiety_after),'/10'],['Hydratation',v=>num(v.hydration),'/10']],
    evolution_corporelle:[...(settings.hide_weight?[]:[['Poids',v=>num(v.weight),'kg']]),['Tour de taille',v=>num(v.waist),'cm'],['Tour de hanches',v=>num(v.hips),'cm'],['Masse grasse',v=>num(v.body_fat),'%'],['Masse maigre',v=>num(v.lean_body_mass),'kg'],['IMC',v=>num(v._healthkit_body_mass_index),''],['Confort corporel',v=>num(v.body_comfort),'/10']],
    peau:[['Inconfort global',v=>avg(v.blemishes,v.dryness,v.inflammation,v.sensitivity,v.itching),'/10'],['Sensibilité',v=>num(v.sensitivity),'/10'],['Rougeurs',v=>num(v.inflammation),'/10'],['Sécheresse',v=>num(v.dryness),'/10'],['Sébum',v=>num(v.oiliness),'/10']],
    performance_recuperation:[['Récupération',v=>num(v.recovery),'/10'],['Charge ressentie',v=>num(v.intensity),'/10'],['Durée',v=>num(v.duration),'min'],['Pas Apple Santé',v=>num(v._healthkit_steps),'pas'],['Distance Apple Santé',v=>num(v._healthkit_distance_km),'km'],['Énergie active Apple Santé',v=>num(v._healthkit_active_energy_kcal),'kcal']],
    cycle:[['Énergie',v=>num(v.energy),'/10'],['Douleurs',v=>num(v.pain),'/10'],['Sommeil',v=>num(v.sleep),'/10'],['Appétit',v=>num(v.appetite),'/10'],['Ballonnements',v=>num(v.bloating),'/10']],
    perimenopause:[['Énergie',v=>num(v.energy),'/10'],['Sommeil',v=>num(v.sleep),'/10'],['Stress',v=>num(v.stress),'/10'],['Clarté mentale',v=>num(v.brain_fog),'/10'],['Confort digestif',v=>num(v.digestion),'/10']],
    jeune_intermit:[['Durée du jeûne',v=>num(v._fast_hours)??durationBetween(v.last_meal,v.first_meal),'h'],['Faim',v=>num(v.hunger),'/10'],['Énergie',v=>num(v.energy),'/10'],['Hydratation',v=>num(v.hydration),'/10'],['Confort après rupture',v=>num(v.break_quality),'/10']],
    reduction_sucre:[['Envies',v=>num(v.craving),'/10'],['Faim',v=>num(v.hunger),'/10'],['Fatigue',v=>num(v.fatigue),'/10'],['Satisfaction',v=>num(v.satisfaction),'/10']],
    changer_habitude:[['Confiance',v=>num(v.confidence),'/10'],['Difficulté',v=>num(v.difficulty),'/10'],['Impulsion',v=>num(v.urge),'/10']],
    pas_marche:[['Pas',v=>num(v.steps),'pas'],['Distance',v=>num(v.distance_km),'km'],['Longueur de pas',v=>num(v.step_length_cm),'cm'],['Vitesse de marche',v=>num(v.walking_speed_kmh),'km/h'],['Énergie active',v=>num(v.active_energy_kcal)??num(v._healthkit_active_energy_kcal),'kcal'],['Étages montés',v=>num(v.flights),''],['Temps de marche',v=>num(v.walking_minutes),'min']],
    nutrition_vegetale:[['Protéines',v=>num(v.protein_g),'g'],['Glucides',v=>num(v.carbs_g),'g'],['Lipides',v=>num(v.fat_g),'g'],['Fibres',v=>num(v.fiber_g),'g'],...(Array.isArray(settings.observed_nutrients)?settings.observed_nutrients:[]).filter(k=>MICRO_META[k]).slice(0,8).map(k=>[MICRO_META[k][0],v=>microNumber(v,k),MICRO_META[k][1]])]
  };return (map[key]||[]).slice(0,12);}
  function singleCurveHTML(label,rows,get,unit=''){
    const points=[...rows].reverse().map(row=>({date:row.entry_date,value:get(row.values||{})})).filter(point=>Number.isFinite(point.value));if(points.length<2)return '';
    const values=points.map(point=>point.value),min=Math.min(...values),max=Math.max(...values),span=max-min||1,w=320,h=108,pad=14,xy=points.map((point,index)=>({x:pad+index*(w-pad*2)/Math.max(1,points.length-1),y:h-pad-(point.value-min)*(h-pad*2)/span,...point})),path=xy.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
    return `<article style="padding:14px;border:1px solid #e6dccd;border-radius:22px;background:#fffdf8"><div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px"><b style="color:#173b31">${esc(label)}</b><small style="color:#887a6d">${esc(fmtMetric(min,unit,unit==='pas'?0:1))} – ${esc(fmtMetric(max,unit,unit==='pas'?0:1))}</small></div><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(`${label} : minimum ${fmtMetric(min,unit,unit==='pas'?0:1)}, maximum ${fmtMetric(max,unit,unit==='pas'?0:1)}, dernière donnée ${fmtMetric(points.at(-1).value,unit,unit==='pas'?0:1)}, du ${points[0].date} au ${points.at(-1).date}`)}" style="width:100%;height:auto;display:block"><path d="${path}" fill="none" stroke="#173b31" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${xy.map(point=>`<circle cx="${point.x}" cy="${point.y}" r="4" fill="#c49a45"><title>${esc(point.date)} · ${esc(fmtMetric(point.value,unit,unit==='pas'?0:1))}</title></circle>`).join('')}</svg><small style="display:block;color:#887a6d;line-height:1.45">${esc(points[0].date)} → ${esc(points.at(-1).date)} · jours sans donnée laissés vides.</small></article>`;
  }
  function curvesHTML(key,rows,settings={}){const charts=chartSpecs(key,settings).map(([label,get,unit])=>singleCurveHTML(label,rows,get,unit)).filter(Boolean);if(!charts.length)return '<div class="mt-follow-source-note"><b>Mes courbes</b><br>Les courbes apparaîtront après deux journées réellement renseignées pour un même repère. Les jours sans donnée restent vides.</div>';return `<section style="margin:18px 0"><div class="mt-follow-analytics-title"><h3>Mes courbes</h3><small>évolution réelle · sans zéros inventés</small></div><div style="display:grid;gap:10px">${charts.join('')}</div></section>`;}

  function metricSource(key,row,label=''){
    const values=row?.values||{};
    if(key==='nutrition_vegetale')return 'Carnet alimentaire';
    if(values._healthkit_source||row?._transient_healthkit||/^Apple Santé/i.test(String(label||'')))return 'Apple Santé';
    if(key==='pas_marche'&&row?._transient_healthkit)return 'Apple Santé';
    return 'Saisie Méthode Tee';
  }
  function metricLimit(key){return key==='evolution_corporelle'?8:key==='pas_marche'?8:key==='nutrition_vegetale'?8:6;}
  function metricListHTML(key,rows,settings={}){
    const cards=chartSpecs(key,settings).map((spec,index)=>{const [label,get,unit]=spec,series=metricSeries(rows,get);if(!series.length)return '';const latest=series.at(-1),values=series.map(x=>x.value),min=Math.min(...values),max=Math.max(...values),sourceRow=[...rows].find(row=>row.entry_date===latest.date&&Number.isFinite(get(row.values||{}))),digits=unit==='pas'||unit==='min'||unit===''?0:1,latestText=fmtMetric(latest.value,unit,digits),rangeText=values.length>1?`${fmtMetric(min,unit,digits)} – ${fmtMetric(max,unit,digits)}`:'Une donnée disponible',source=metricSource(key,sourceRow,label);return `<button class="mt-health-metric" type="button" onclick="mtAdvancedTrackerMetricDetail('${esc(key)}',${index},7)"><span><small>${esc(label)}</small><b>${esc(latestText)}</b><p>${esc(fmtDate(latest.date))} · ${esc(rangeText)} · ${esc(source)}</p></span><span class="mt-health-metric-arrow">›</span></button>`;}).filter(Boolean).slice(0,metricLimit(key));
    if(!cards.length)return '<div class="mt-health-detail-empty">Aucun repère chiffré n’est encore disponible. Dès qu’une donnée compatible est enregistrée, elle apparaîtra ici sans transformer les jours vides en zéro.</div>';
    return `<section class="mt-health-summary"><div class="mt-health-summary-head"><h3>Mes repères</h3><small>comme dans Santé : dernière donnée d’abord<br>touche un repère pour sa courbe</small></div><div class="mt-health-metrics">${cards.join('')}</div></section>`;
  }
  function metricAboutCopy(key,label){
    if(key==='evolution_corporelle')return `${label} est présenté comme une mesure neutre. Méthode Tee décrit sa plage et son évolution sans lui attribuer de note « bonne » ou « mauvaise ». Compare de préférence des mesures prises dans des conditions proches.`;
    if(key==='pas_marche')return `${label} décrit ton rythme réel de marche. Quand Apple Santé possède ce repère, il peut être lu en lecture seule. Une période sans données n’est jamais interprétée automatiquement comme de la sédentarité.`;
    if(key==='nutrition_vegetale')return `${label} est calculé uniquement à partir des aliments quantifiés et des données de composition disponibles dans le Carnet. Une absence de valeur documentée ne signifie pas une carence.`;
    if(key==='cycle'||key==='perimenopause')return `${label} est un repère descriptif. Il sert à comparer tes propres journées et ne transforme jamais un symptôme ou une phase en jugement de qualité.`;
    if(key==='sommeil_profond')return `${label} peut combiner tes saisies et, lorsque disponible, une donnée Apple Santé. Le ressenti personnel reste séparé de la mesure automatique.`;
    return `${label} est suivi à partir des journées réellement renseignées. Les journées absentes restent vides et les tendances restent descriptives, sans diagnostic.`;
  }
  function metricDetailGraph(series,label,unit){
    if(!series.length)return '<div class="mt-health-detail-empty">Aucune donnée sur cette période.</div>';
    const values=series.map(x=>x.value),min=Math.min(...values),max=Math.max(...values),span=max-min||1,w=330,h=170,padX=18,padY=22,xy=series.map((point,index)=>({x:padX+index*(w-padX*2)/Math.max(1,series.length-1),y:h-padY-(point.value-min)*(h-padY*2)/span,...point})),path=xy.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '),grid=[0,.33,.66,1].map(r=>`<line x1="${padX}" y1="${(padY+r*(h-padY*2)).toFixed(1)}" x2="${w-padX}" y2="${(padY+r*(h-padY*2)).toFixed(1)}" stroke="#ece6dc" stroke-width="1"/>`).join(''),digits=unit==='pas'||unit==='min'||unit===''?0:1;
    return `<div class="mt-health-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(`${label} : minimum ${fmtMetric(min,unit,digits)}, maximum ${fmtMetric(max,unit,digits)}, dernière donnée ${fmtMetric(series.at(-1).value,unit,digits)}`)}">${grid}${series.length>1?`<path d="${path}" fill="none" stroke="#b28239" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`:''}${xy.map(point=>`<circle cx="${point.x}" cy="${point.y}" r="5" fill="#173b31"><title>${esc(fmtDate(point.date))} · ${esc(fmtMetric(point.value,unit,digits))}</title></circle>`).join('')}</svg><small style="display:block;color:#887a6d;line-height:1.45;padding:0 4px 3px">Les jours sans donnée restent vides ; aucune valeur zéro n’est inventée.</small></div>`;
  }
  function renderMetricDetail(modal,key,rows,index,days){
    const item=tracker(key),settings=preference(key).settings||{},spec=chartSpecs(key,settings)[Number(index)];if(!spec){renderHistory(modal,key,rows,days);return;}const [label,get,unit]=spec,series=metricSeries(rows,get),periodLabel=!Number(days)?'Depuis le début':`${days} jours`,digits=unit==='pas'||unit==='min'||unit===''?0:1;
    modal.dataset.key=key;modal.dataset.metricIndex=String(index);modal.dataset.metricPeriod=String(days);
    if(!series.length){modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><button class="mt-health-back" type="button" onclick="mtAdvancedTrackerHistory('${esc(key)}')">‹ Retour à mes repères</button><div class="mt-follow-kicker">${esc(item.title)} · ${esc(label)}</div><h2>${esc(label)}</h2><div class="mt-follow-history-head"><button class="mt-follow-period ${days===7?'is-on':''}" type="button" onclick="mtAdvancedTrackerMetricPeriod(7)">7 j</button><button class="mt-follow-period ${days===28?'is-on':''}" type="button" onclick="mtAdvancedTrackerMetricPeriod(28)">28 j</button><button class="mt-follow-period ${days===90?'is-on':''}" type="button" onclick="mtAdvancedTrackerMetricPeriod(90)">90 j</button><button class="mt-follow-period ${!Number(days)?'is-on':''}" type="button" onclick="mtAdvancedTrackerMetricPeriod(0)">Depuis le début</button></div><div class="mt-health-detail-empty">Aucune donnée ${esc(label.toLowerCase())} sur cette période.</div></section>`;return;}
    const values=series.map(x=>x.value),min=Math.min(...values),max=Math.max(...values),latest=series.at(-1),range=min===max?fmtMetric(latest.value,unit,digits):`${fmtMetric(min,unit,digits)} – ${fmtMetric(max,unit,digits)}`,sourceRow=[...rows].find(row=>row.entry_date===latest.date&&Number.isFinite(get(row.values||{}))),source=metricSource(key,sourceRow,label);
    modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><button class="mt-health-back" type="button" onclick="mtAdvancedTrackerHistory('${esc(key)}')">‹ Retour à mes repères</button><div class="mt-follow-kicker">${esc(item.title)} · détail</div><h2>${esc(label)}</h2><div class="mt-follow-history-head"><button class="mt-follow-period ${days===7?'is-on':''}" type="button" onclick="mtAdvancedTrackerMetricPeriod(7)">7 j</button><button class="mt-follow-period ${days===28?'is-on':''}" type="button" onclick="mtAdvancedTrackerMetricPeriod(28)">28 j</button><button class="mt-follow-period ${days===90?'is-on':''}" type="button" onclick="mtAdvancedTrackerMetricPeriod(90)">90 j</button><button class="mt-follow-period ${!Number(days)?'is-on':''}" type="button" onclick="mtAdvancedTrackerMetricPeriod(0)">Depuis le début</button></div><div class="mt-health-detail-hero"><small>${series.length>1?'Plage':'Dernière donnée'} · ${esc(periodLabel)}</small><b>${esc(range)}</b><p>${esc(fmtDate(series[0].date))}${series.length>1?` → ${esc(fmtDate(latest.date))}`:''}</p></div>${metricDetailGraph(series,label,unit)}<div class="mt-health-last"><span><small>Dernières données · ${esc(fmtDate(latest.date))}</small><b>${esc(source)}</b></span><b>${esc(fmtMetric(latest.value,unit,digits))}</b></div><div class="mt-health-about"><small>À propos de ce repère</small><b>${esc(label)}</b><p>${esc(metricAboutCopy(key,label))}</p></div></section>`;
  }
  function renderHistory(modal,key,rows,days=7){
    const item=tracker(key),stats=historyStats(key,rows,days),shown=stats.period,highlights=historyHighlights(key,shown),settings=preference(key).settings||{};
    const periodLabel=stats.all?'depuis le début':`${days} jours`,used=`Repères utilisés : ${stats.label}, dates réellement renseignées${stats.relation?' et journées comparables':''}.`;
    const highlightHTML=highlights.length?`<div class="mt-follow-history-highlights">${highlights.map(x=>`<div class="mt-follow-highlight"><b>${esc(x.value)}</b><small>${esc(x.label)}</small></div>`).join('')}</div>`:'';
    modal.dataset.key=key;modal.dataset.period=String(days);modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><div class="mt-follow-kicker">${esc(item.title)} · évolution</div><h2>Analyse complète</h2><div class="mt-follow-history-head"><button class="mt-follow-period ${days===7?'is-on':''}" type="button" onclick="mtAdvancedTrackerHistoryPeriod(7)">7 j</button><button class="mt-follow-period ${days===28?'is-on':''}" type="button" onclick="mtAdvancedTrackerHistoryPeriod(28)">28 j</button><button class="mt-follow-period ${days===90?'is-on':''}" type="button" onclick="mtAdvancedTrackerHistoryPeriod(90)">90 j</button><button class="mt-follow-period ${!Number(days)?'is-on':''}" type="button" onclick="mtAdvancedTrackerHistoryPeriod(0)">Depuis le début</button><button class="mt-follow-period" type="button" onclick="mtAdvancedTrackerEntry('${esc(key)}')">+ Aujourd’hui</button></div>${analyticsHTML(key,shown,settings,days,rows)}${curvesHTML(key,shown,settings)}<div class="mt-follow-history-stats"><div class="mt-follow-stat"><b>${stats.all?stats.count:`${stats.count}/${days}`}</b><small>${stats.all?'repères renseignés':'jours renseignés'}</small></div><div class="mt-follow-stat"><b>${stats.average===null?'—':String(Math.round(stats.average*10)/10).replace('.',',')}</b><small>${esc(stats.label)}</small></div></div>${highlightHTML}<div class="mt-follow-insight"><small>Lecture prudente · ${esc(periodLabel)}</small><b>${esc(stats.trend)}</b><p>${esc(stats.relation||'Continue quelques repères comparables pour faire ressortir une tendance personnelle utile.')} ${esc(used)}</p></div><div class="mt-follow-insight" data-cross-tracker-insight hidden></div>${key==='evolution_corporelle'?'<div class="mt-follow-source-note">Les variations de poids, mensurations ou composition corporelle sont décrites sans jugement. Compare de préférence des mesures prises dans des conditions proches.</div>':''}${historyRowsHTML(key,shown)}<button class="mt-follow-secondary" type="button" onclick="mtAdvancedTrackerEntry('${esc(key)}')">Renseigner aujourd’hui</button></section>`;
    loadCrossTrackerInsight(modal,key,days).catch(()=>{});
  }
  async function hydrateInlineAnalytics(key){
    const modal=root('mtAdvancedTrackerEntry','mt-follow-entry'),host=modal.querySelector('[data-inline-analytics]');if(!host||modal.dataset.key!==key)return;
    try{
      let rows=await fetchHistory(key,7);if(key==='pas_marche')rows=await mergeWalkingHealthKitHistory(rows,7);
      if(!host.isConnected||modal.dataset.key!==key)return;
      const settings=preference(key).settings||{};
      host.innerHTML=`<div class="mt-follow-analytics-title"><h3>Aperçu de mon évolution</h3><small>7 derniers jours · dernière donnée + plage</small></div>${metricListHTML(key,rows,settings)}<button class="mt-follow-secondary" type="button" onclick="mtAdvancedTrackerHistory('${esc(key)}')">Vue d’ensemble · tendances & croisements</button>`;
    }catch(_){if(host.isConnected)host.innerHTML='<div class="mt-follow-source-note">L’aperçu analytique se chargera dès que les repères disponibles pourront être lus. La saisie reste utilisable.</div>';}
  }

  async function crossRows(keys,days){const c=client();if(!c||!UID)return[];const n=!Number(days)?365:Math.min(365,Math.max(7,Number(days))),from=addDays(TODAY(),-(n-1));try{const q=c.from('user_tracker_entries').select('tracker_key,entry_date,values').eq('user_id',UID).in('tracker_key',keys).gte('entry_date',from).lte('entry_date',TODAY()).order('entry_date',{ascending:false}).limit(240),result=await Promise.race([q,new Promise(resolve=>setTimeout(()=>resolve({data:[]}),2600))]);return Array.isArray(result?.data)?result.data:[];}catch(_){return[];}}
  function crossEnergy(v={}){const daily=parseJSONValue(v._daily,{}),signal=num(daily?.signals?.energy);return signal??num(v.energy)??num(v.energy_before)??num(v.energy_after)??num(v.wake_state);}
  function crossDigestion(v={}){const daily=parseJSONValue(v._daily,{}),signal=num(daily?.signals?.digestion);return signal??num(v.comfort)??num(v.digestion)??num(v.digestion_after);}
  function crossSleep(v={}){const daily=parseJSONValue(v._daily,{}),mins=num(daily?.signals?.sleep_minutes);return mins!==null?mins/60:(num(v._sleep_hours)??durationBetween(v.bedtime,v.wake_time));}
  async function loadCrossTrackerInsight(modal,key,days){
    const host=modal.querySelector('[data-cross-tracker-insight]');if(!host)return;let keys=[],xKey='',yLabel='',xLabel='',xGetter=null,yGetter=null;
    if(key==='pas_marche'){keys=['pas_marche','performance_recuperation','evolution_corporelle','cycle','perimenopause','equilibre_alimentaire','nutrition_vegetale'];xLabel='activité de marche';yLabel='énergie renseignée';xGetter=v=>num(v.steps);yGetter=crossEnergy;xKey='pas_marche';}
    else if(key==='nutrition_vegetale'){keys=['nutrition_vegetale','digestion','equilibre_alimentaire'];xLabel='fibres calculées';yLabel='confort digestif renseigné';xGetter=v=>num(v.fiber_g);yGetter=crossDigestion;xKey='nutrition_vegetale';}
    else if(key==='sommeil_profond'){keys=['sommeil_profond','performance_recuperation','evolution_corporelle','cycle','perimenopause'];xLabel='durée de sommeil';yLabel='énergie renseignée';xGetter=crossSleep;yGetter=crossEnergy;xKey='sommeil_profond';}
    else if(key==='performance_recuperation'){keys=['performance_recuperation','sommeil_profond'];xLabel='durée de sommeil';yLabel='récupération renseignée';xGetter=crossSleep;yGetter=v=>num(v.recovery);xKey='sommeil_profond';}
    else return;
    const rows=await crossRows(keys,days),byDate=new Map();rows.forEach(row=>{const d=byDate.get(row.entry_date)||[];d.push(row);byDate.set(row.entry_date,d);});const pairs=[];
    byDate.forEach(day=>{const xs=day.filter(r=>r.tracker_key===xKey).map(r=>xGetter(r.values||{})).filter(Number.isFinite);const ys=day.filter(r=>r.tracker_key!==xKey).map(r=>yGetter(r.values||{})).filter(Number.isFinite);if(xs.length&&ys.length)pairs.push([average(xs),average(ys)]);});if(pairs.length<4)return;
    const r=(()=>{const xs=pairs.map(p=>p[0]),ys=pairs.map(p=>p[1]),mx=average(xs),my=average(ys);let top=0,dx=0,dy=0;pairs.forEach(([x,y])=>{const a=x-mx,b=y-my;top+=a*b;dx+=a*a;dy+=b*b;});return dx&&dy?top/Math.sqrt(dx*dy):0;})();const relation=Math.abs(r)<.25?'ne montrent pas encore de relation nette':r>0?'évoluent souvent dans le même sens':'semblent parfois évoluer en sens inverse';host.hidden=false;host.innerHTML=`<small>Ce que j’observe · croisement entre suivis</small><b>${esc(pairs.length)} journées comparables</b><p>${esc(xLabel)} et ${esc(yLabel)} ${esc(relation)} sur les journées où les deux sont disponibles. C’est une association personnelle à observer, jamais une preuve de causalité.</p>`;
  }
  window.mtAdvancedTrackerHistory=async function(rawKey){
    addCSS();const key=normalizeKey(rawKey),item=tracker(key);if(!item)return;if(!UID)UID=(await getUser())?.id||window.__MT_LIBRARY_USER_ID__||null;PREFS=Object.keys(PREFS).length?PREFS:readPrefs(UID);
    const modal=root('mtAdvancedTrackerEntry','mt-follow-entry');modal.dataset.key=key;modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><div class="mt-follow-loading"><b>${esc(item.title)}</b><p>Lecture de tes jauges et courbes…</p><span></span></div></section>`;modal.classList.add('open');
    if(key==='pas_marche'&&window.mtHealthKitWalkingBaseline){try{const model=await window.mtHealthKitWalkingBaseline(28);if(model?.days>=4){const pref=preference(key),same=Number(pref.settings?.personal_baseline_steps)===Number(model.medianSteps)&&Number(pref.settings?.baseline_days)===Number(model.days);if(!same){const settings={...(pref.settings||{}),personal_baseline_steps:model.medianSteps,baseline_days:model.days,baseline_source:'Apple Santé'};PREFS[key]={...pref,settings};await savePreference(key);}}}catch(_){/* Le suivi fonctionne aussi sans Apple Santé. */}}
    let rows=await fetchHistory(key,key==='pas_marche'?28:7);if(key==='pas_marche')rows=await mergeWalkingHealthKitHistory(rows,28);renderHistory(modal,key,rows,7);
  };
  window.mtAdvancedTrackerHistoryPeriod=async function(days){const modal=root('mtAdvancedTrackerEntry','mt-follow-entry'),key=normalizeKey(modal.dataset.key),n=[0,7,28,90].includes(Number(days))?Number(days):7,fetchDays=key==='pas_marche'&&n===7?28:n;modal.querySelector('.mt-follow-sheet')?.classList.add('is-loading');let rows=await fetchHistory(key,fetchDays);if(key==='pas_marche')rows=await mergeWalkingHealthKitHistory(rows,fetchDays||365);renderHistory(modal,key,rows,n);};
  window.mtAdvancedTrackerMetricDetail=async function(rawKey,index,days=7){
    addCSS();const key=normalizeKey(rawKey),modal=root('mtAdvancedTrackerEntry','mt-follow-entry'),n=[0,7,28,90].includes(Number(days))?Number(days):7,fetchDays=key==='pas_marche'&&n===7?28:n;modal.classList.add('open');modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><div class="mt-follow-loading"><b>Lecture du repère…</b><p>Chargement de la période choisie.</p><span></span></div></section>`;let rows=await fetchHistory(key,n===0?0:fetchDays);if(key==='pas_marche')rows=await mergeWalkingHealthKitHistory(rows,n===0?365:fetchDays);const shown=!n?rows:rows.filter(row=>row.entry_date>=addDays(TODAY(),-(n-1)));renderMetricDetail(modal,key,shown,Number(index),n);
  };
  window.mtAdvancedTrackerMetricPeriod=async function(days){const modal=root('mtAdvancedTrackerEntry','mt-follow-entry'),key=normalizeKey(modal.dataset.key),index=Number(modal.dataset.metricIndex||0),n=[0,7,28,90].includes(Number(days))?Number(days):7,fetchDays=key==='pas_marche'&&n===7?28:n;let rows=await fetchHistory(key,n===0?0:fetchDays);if(key==='pas_marche')rows=await mergeWalkingHealthKitHistory(rows,n===0?365:fetchDays);const shown=!n?rows:rows.filter(row=>row.entry_date>=addDays(TODAY(),-(n-1)));renderMetricDetail(modal,key,shown,index,n);};
  window.mtAdvancedTrackerEdit=(key,date)=>window.mtAdvancedTrackerEntry(key,date);
  window.mtAdvancedTrackerDelete=async function(rawKey,date){
    const key=normalizeKey(rawKey),modal=root('mtAdvancedTrackerEntry','mt-follow-entry'),period=Number(modal.dataset.period)||7,deleted=readLocalEntry(key,date);
    const c=client();
    if(c&&UID){try{const {error}=await c.from('user_tracker_entries').delete().eq('user_id',UID).eq('tracker_key',key).eq('entry_date',date);if(error)throw error;}catch(e){toast('Suppression impossible pour le moment.');invalidateHistory(key);return;}}
    removeLocalEntry(key,date);invalidateHistory(key);
    const pref=preference(key),settings={...(pref.settings||{})};
    if(key==='cycle'&&deleted?.values?.new_period==='Oui')settings.period_starts=(Array.isArray(settings.period_starts)?settings.period_starts:[]).filter(value=>value!==date);
    // Une seule ligne suffit à reconstruire le dernier repère : pas de lecture massive.
    let latest=null;
    if(c&&UID){try{const {data}=await c.from('user_tracker_entries').select('entry_date,values,note,updated_at').eq('user_id',UID).eq('tracker_key',key).order('entry_date',{ascending:false}).limit(1).maybeSingle();latest=data||null;}catch(e){}}
    if(!latest){const local=localEntries(key).filter(row=>row.entry_date!==date).sort((a,b)=>String(b.entry_date).localeCompare(String(a.entry_date)));latest=local[0]||null;}
    settings.latest_date=latest?.entry_date||null;settings.latest_summary=latest?trackerSummary(key,latest.values||{},settings,latest.entry_date):null;PREFS[key]={...pref,settings,updated_at:new Date().toISOString()};await savePreference(key);
    window.mtRefreshParcoursCalendar?.();window.dispatchEvent(new CustomEvent('mt:custom-trackers-changed',{detail:{key,date,deleted:true}}));window.dispatchEvent(new CustomEvent('mt:daily-state-changed',{detail:{source:'custom_trackers'}}));
    const fresh=await fetchHistory(key,period,true);renderHistory(modal,key,fresh,period);toast('Repère supprimé.');
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
      pas_marche:['Contexte de la marche','Un trajet, une sensation ou une gêne à garder en mémoire…'],
      nutrition_vegetale:['Observation nutritionnelle','Une source, une supplémentation ou un ressenti utile…'],
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
    const persistentContext=key==='changer_habitude'&&settings.habit?`<div class="mt-follow-fixed-context"><small>Habitude suivie</small><strong>${esc(settings.habit)}</strong></div>`:key==='evolution_corporelle'&&settings.body_setup_done?`<div class="mt-follow-fixed-context"><small>Mon suivi</small><strong>${esc(settings.body_intention||settings.body_focus||'Évolution corporelle')} · ${esc(settings.frequency||'à mon rythme')}</strong></div>`:'';
    const [noteLabel,notePlaceholder]=notePrompt(key);
    const safety=key==='jeune_intermit'?`<div class="mt-follow-help">Ce suivi reste facultatif et ne remplace pas un avis médical. En cas de grossesse ou d’allaitement, de diabète, de traitement, de trouble du comportement alimentaire ou de problème de santé, demande conseil à un professionnel de santé avant de jeûner.</div>`:'';
    modal.dataset.key=key;modal.dataset.date=date;
    const healthKitBridge=window.mtHealthKitTrackerBridgeHTML?window.mtHealthKitTrackerBridgeHTML(key,date):'';
    modal.innerHTML=`<div class="mt-follow-bg" onclick="mtAdvancedTrackerEntryClose()"></div><section class="mt-follow-sheet"><div class="mt-follow-grip"></div><button class="mt-follow-close" type="button" onclick="mtAdvancedTrackerEntryClose()">×</button><div class="mt-follow-kicker">${esc(item.title)}${discipline?` · ${esc(discipline)}`:''}</div><h2>${date===TODAY()?"Aujourd’hui":esc(fmtDate(date))}</h2>${dateNavHTML(date)}${persistentContext}${coachingBeforeHTML(key,settings,date)}<p class="mt-follow-intro">${esc(item.description)}</p>${estimateHTML(key,settings,date)}${safety}${healthKitBridge}<section data-inline-analytics style="margin:14px 0"><div class="mt-follow-loading"><b>Aperçu analytique · 7 jours</b><p>Lecture des repères réellement disponibles…</p><span></span></div></section><form class="mt-follow-form" id="mtAdvancedTrackerForm">${key==='cycle'&&shouldOfferPeriodStart(settings,date,values)?cycleEventHTML(values):''}${fields.map(def=>fieldHTML(def,values)).join('')}<div class="mt-follow-field"><label>${esc(noteLabel)} <small>(facultatif)</small></label><textarea name="_note" placeholder="${esc(notePlaceholder)}">${esc(persistedNote)}</textarea></div><button class="mt-follow-save" type="submit">Enregistrer ce repère</button></form></section>`;
    document.getElementById('mtAdvancedTrackerForm').onsubmit=saveEntry;
    window.mtHealthKitEnhanceTrackerForm?.(key,date);
    window.mtV419EnhanceTrackerForm?.(key,date,settings);
    hydrateInlineAnalytics(key).catch(()=>{});
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
    if(item.configurable&&((key==='cycle'&&!pref.settings?.last_period_start)||(key==='performance_recuperation'&&!pref.settings?.discipline)||(key==='pas_marche'&&!pref.settings?.goal_mode)||(key==='nutrition_vegetale'&&!pref.settings?.nutrition_setup_done)||(key==='evolution_corporelle'&&!pref.settings?.body_setup_done)||(key==='changer_habitude'&&!pref.settings?.habit))){pendingAfterConfig={entry:true,date};return window.mtAdvancedTrackerConfigure(key,pendingAfterConfig);}
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
      const hours=num(values._sleep_hours)??durationBetween(values.bedtime,values.wake_time),quality=num(values.quality),sleepiness=num(values.sleepiness),latency=num(values.latency);
      if(hours!==null&&hours<6.5)result=['Protéger ta prochaine fenêtre de sommeil','Si ton rythme le permet, cherche surtout à récupérer du temps de sommeil plutôt qu’à optimiser dix détails à la fois.'];
      else if((quality!==null&&quality<=4)||(sleepiness!==null&&sleepiness>=7))result=['Observer la récupération réelle','Ta durée seule ne raconte pas tout : compare qualité, réveils nocturnes, état au réveil et somnolence sur plusieurs nuits.'];
      else if(latency!==null&&latency>=45)result=['Créer une transition plus nette','Teste ce soir un seul repère de descente : lumière plus douce, écran posé plus tôt ou activité calme, puis compare quelques nuits.'];
      else result=['Conserver ce qui t’aide','Cette nuit semble globalement soutenante dans les repères renseignés. Observe ce qui se répète lorsque tes nuits sont les plus réparatrices.'];
    }
    else if(key==='digestion'){
      const comfort=num(values.comfort),stress=num(values.stress),bloat=num(values.bloating),pain=num(values.pain),speed=values.meal_speed;
      if(pain!==null&&pain>=7)result=['Ne pas banaliser une douleur marquée','Si la douleur est intense, inhabituelle ou persiste, le suivi ne remplace pas un avis médical. Garde surtout une trace du contexte.'];
      else if(stress!==null&&stress>=7)result=['Créer une transition avant le repas','Essaie une pause courte avant un prochain repas comparable et observe si le confort change, sans conclure à une cause unique.'];
      else if((comfort!==null&&comfort<=4)||(bloat!==null&&bloat>=7))result=['Comparer un repas à la fois','Garde une composition simple et familière au prochain repas, puis compare taille, vitesse du repas et sensations plutôt que supprimer plusieurs aliments d’un coup.'];
      else if(/Rapide/i.test(String(speed||'')))result=['Ralentir juste assez pour observer','Sans chercher à manger très lentement, laisse un peu plus de temps au prochain repas et regarde si le confort change.'];
      else result=['Conserver les repères qui fonctionnent','Ton confort paraît plutôt favorable aujourd’hui. Note les repas et rythmes qui reviennent les jours similaires.'];
    }
    else if(key==='reflux'){
      const none=/^Non/i.test(String(values.episode||'')),intensity=num(values.intensity);
      if(none)result=['Garder ce repère','Aucun reflux n’est signalé aujourd’hui. Les jours sans symptôme sont aussi utiles pour comprendre ton contexte habituel.'];
      else if(intensity!==null&&intensity>=7)result=['Observer sans attendre si cela devient important','Un épisode marqué ou récurrent mérite un avis médical. Le Carnet peut t’aider à conserver horaires, repas, position et éléments associés.'];
      else result=['Comparer le contexte du prochain épisode','Note surtout l’horaire, le repas précédent, sa taille et la position après le repas. Plusieurs épisodes comparables valent mieux qu’une conclusion après une seule journée.'];
    }
    else if(key==='equilibre_alimentaire'){
      const plants=num(values.plants),protein=num(values.protein),sat=num(values.satiety_after),restriction=num(values.restriction),pleasure=num(values.pleasure);
      if(restriction!==null&&restriction>=7)result=['Ramener de la souplesse','Un suivi alimentaire utile ne doit pas devenir une source de contrôle. Reviens à faim, satiété, variété et plaisir plutôt qu’à une journée parfaite.'];
      else if(plants!==null&&plants<=4)result=['Ajouter une couleur réaliste','Au prochain repas, choisis un végétal que tu apprécies déjà et qui s’accorde vraiment avec le plat.'];
      else if(protein!==null&&protein<=4)result=['Renforcer la structure du repas','Au prochain repas, ajoute une source protéique familière adaptée au plat et à ta faim.'];
      else if(sat!==null&&sat<=4)result=['Observer ce qui manque à la satiété','Compare la présence de protéines, féculents, matières grasses et végétaux avant de simplement augmenter ou réduire les quantités.'];
      else if(pleasure!==null&&pleasure<=3)result=['Garder aussi la satisfaction en vue','L’équilibre ne repose pas seulement sur la composition : un repas qui ne satisfait pas peut être difficile à répéter.'];
      else result=['Ne change presque rien','Les principaux repères renseignés sont déjà présents. Laisse la répétition et ta faim guider les petits ajustements.'];
    }
    else if(key==='evolution_corporelle'){
      const comfort=num(values.body_comfort),bloat=num(values.bloating),water=num(values.water_retention),conditions=values.measurement_conditions;
      if(present(values.weight)||present(values.waist)||present(values.hips)||present(values.body_fat))result=['Regarder la tendance, pas le chiffre isolé',`Ta mesure est enregistrée${conditions&&conditions!=='Oui'?' dans un contexte différent des précédentes':''}. Compare plusieurs repères pris dans des conditions proches avant d’interpréter une variation.`];
      else if((bloat!==null&&bloat>=7)||(water!==null&&water>=7))result=['Distinguer sensation et évolution de fond','Un gonflement ressenti peut varier rapidement. Garde ce repère à côté des vêtements, du confort corporel et des mesures prises à intervalle régulier.'];
      else if(comfort!==null&&comfort<=4)result=['Observer sans réduire ton corps à une mesure','Utilise aussi ton confort, ton énergie et la sensation dans les vêtements. Une évolution corporelle ne se résume pas au poids.'];
      else result=['Construire une tendance personnelle','Continue à ton rythme. Quelques repères espacés et comparables seront plus utiles qu’une multiplication de mesures.'];
    }
    else if(key==='performance_recuperation'){
      const recovery=num(values.recovery),fatigue=num(values.fatigue_after)??num(values.muscle_fatigue),readiness=num(values.readiness)??num(values.availability),soreness=num(values.muscle_soreness);
      if((recovery!==null&&recovery<=4)||(fatigue!==null&&fatigue>=7)||(soreness!==null&&soreness>=8))result=['Priorité à la récupération','Avant une prochaine séance exigeante, privilégie sommeil, hydratation, repas régulier et récupération douce, puis réévalue ta disponibilité.'];
      else if(readiness!==null&&readiness<=4)result=['Adapter la prochaine pratique','Prévois une version plus courte, plus douce ou plus technique, puis observe comment ton énergie répond.'];
      else result=['Conserver cette base','Ta pratique et ta récupération sont renseignées. Répète ce suivi pour comparer charge, sommeil, énergie et disponibilité.'];
    }
    else if(key==='reduction_sucre'){
      const craving=num(values.craving)??semanticScore(values.craving_state,{Aucune:0,Légère:3,Présente:6,Forte:9,Variable:5}),hunger=num(values.hunger),fatigue=num(values.fatigue);
      if(craving!==null&&craving>=7&&hunger!==null&&hunger>=7)result=['Commencer par la faim réelle','Une envie forte accompagnée d’une forte faim peut appeler un vrai repas ou une collation structurée plutôt qu’une simple stratégie anti-sucre.'];
      else if(craving!==null&&craving>=7&&fatigue!==null&&fatigue>=7)result=['Préparer le moment de fatigue','Garde une option facile et satisfaisante disponible pour les moments où fatigue et envie sucrée se rencontrent.'];
      else if(craving!==null&&craving>=7)result=['Préparer une alternative familière','Pour le prochain moment similaire, prévois une option rassasiante ou plaisante que tu apprécies déjà, sans chercher la perfection.'];
      else result=['Repérer ce qui fonctionne','Garde en mémoire le contexte et l’alternative choisie : la répétition compte davantage qu’une journée parfaite.'];
    }
    else if(key==='changer_habitude'){
      const confidence=num(values.confidence),difficulty=num(values.difficulty);
      if((confidence!==null&&confidence<=4)||(difficulty!==null&&difficulty>=8))result=['Réduire encore le petit pas','Rends la prochaine version tellement simple qu’elle reste faisable pendant une journée chargée.'];
      else result=['Garder un seul petit pas','Repère le déclencheur et répète la réponse la plus simple qui a fonctionné aujourd’hui.'];
    }
    else if(key==='pas_marche'){
      const discomfort=num(values.discomfort),ease=num(values.ease),steps=num(values.steps);
      if(discomfort!==null&&discomfort>=7)result=['Ne pas banaliser une gêne marquée','Si une douleur ou une gêne importante persiste, adapte la marche et demande un avis professionnel. Le suivi conserve le contexte sans poser de diagnostic.'];
      else if(steps!==null)result=['Comparer à ton propre rythme','Observe la tendance sur 28 jours, la répartition dans la journée et ton aisance. Le repère personnel compte davantage qu’un seuil universel de 10 000 pas.'];
      else if(ease!==null)result=['Garder le ressenti au centre','La quantité ne raconte pas tout. Compare ton aisance, ton énergie après la marche et les journées réellement comparables.'];
      else result=['Construire ton repère personnel','Quelques journées de marche permettront d’afficher une plage et une moyenne qui te ressemblent.'];
    }
    else if(key==='nutrition_vegetale'){
      const calculated=num(values.calculated_meals),coverage=num(values.micronutrient_coverage_count);
      if(calculated===null||calculated===0)result=['Quantifier au moins un aliment','Le suivi ne fabrique aucune valeur : ajoute une quantité dans Ma journée alimentaire pour obtenir une lecture nutritionnelle calculée.'];
      else if(coverage===null||coverage===0)result=['Données micronutritionnelles non disponibles','Tes repas sont enregistrés, mais aucune valeur officielle exploitable n’est disponible pour ces aliments. Cela ne signifie pas que les micronutriments sont absents.'];
      else result=['Lire les sources, pas diagnostiquer','Compare les sources alimentaires documentées sur plusieurs jours. « Aucune source renseignée » ne signifie jamais « carence ».'];
    }
    else if(key==='peau'){
      const discomfort=avg(values.blemishes,values.dryness,values.inflammation,values.sensitivity,values.itching),stress=num(values.stress),sleep=num(values.sleep);
      if(discomfort!==null&&discomfort>=7)result=['Revenir à une routine simple','Si ta peau est très réactive, évite de multiplier les nouveautés et observe quelques jours les produits, le sommeil et le contexte.'];
      else if(stress!==null&&stress>=7||sleep!==null&&sleep<=4)result=['Comparer le contexte, sans attribuer une cause','Stress, sommeil et peau peuvent varier ensemble. Continue quelques jours avant de conclure qu’un seul facteur explique le changement.'];
      else result=['Conserver une routine stable','Ta peau est renseignée. Les tendances seront plus lisibles si tu notes surtout les changements de produits et les journées vraiment différentes.'];
    }
    else if(key==='jeune_intermit'){
      const dizzy=num(values.dizziness),headache=num(values.headache),energy=num(values.energy),breakQ=num(values.break_quality);
      if((dizzy!==null&&dizzy>=6)||(energy!==null&&energy<=3))result=['Faire passer le confort d’abord','Si faiblesse, étourdissement ou fatigue marquée apparaissent, raccourcis ou interromps le jeûne et privilégie ton confort.'];
      else if(breakQ!==null&&breakQ<=4)result=['Soigner davantage la rupture','Observe taille du repas, vitesse et composition de la rupture avant d’allonger davantage la fenêtre de jeûne.'];
      else result=['Garder un rythme tolérable','La durée seule n’est pas l’objectif : compare faim, énergie, hydratation et confort après la rupture.'];
    }
    else if(key==='cycle'){
      const pain=num(values.pain),energy=num(values.energy);
      if(pain!==null&&pain>=8)result=['Ne pas banaliser une douleur très marquée','Si la douleur est inhabituelle, intense ou invalidante, un professionnel de santé pourra mieux l’évaluer. Le suivi conserve simplement le contexte.'];
      else if(energy!==null&&energy<=4)result=['Adapter le rythme du jour','Si tu le peux, ajuste mouvement, récupération et organisation à ton niveau d’énergie sans considérer la phase estimée comme une règle.'];
      else result=['Écouter le repère du jour','Compare énergie, sommeil, douleurs, appétit et autres changements d’un cycle à l’autre sans utiliser les estimations comme contraception.'];
    }
    else if(key==='perimenopause'){
      const sleep=num(values.sleep),energy=num(values.energy),hot=String(values.hot_flashes||'');
      if((sleep!==null&&sleep<=4)||(energy!==null&&energy<=4))result=['Protéger la récupération','Quand sommeil ou énergie sont bas, privilégie une journée plus souple et compare les mêmes repères sur plusieurs jours.'];
      else if(/Plus de 5|3 à 5/.test(hot))result=['Conserver le contexte des épisodes','Note le moment, le sommeil et les autres changements présents. Des symptômes fréquents ou gênants peuvent être discutés avec un professionnel de santé.'];
      else result=['Observer sans supposer','Continue seulement avec les symptômes réellement présents. Les tendances deviennent plus utiles sur plusieurs semaines.'];
    }
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
      const importedHours=num(values._healthkit_sleep_hours),hours=importedHours??durationBetween(values.bedtime,values.wake_time);if(hours)values._sleep_hours=hours;
    }
    if(key==='jeune_intermit'){
      const hours=durationBetween(values.last_meal,values.first_meal);if(hours)values._fast_hours=hours;
    }
    if(key==='cycle'){
      const estimate=cycleEstimate(settings,date);if(estimate){values.cycle_day_estimate=estimate.cycleDay;values.cycle_phase_estimate=estimate.phase;values._cycle_calendar_event=estimate.cycleEvent;values.next_period_estimate=estimate.nextPeriod;values.ovulation_window_estimate=estimate.ovulationDate;}
    }
    if(key==='pas_marche'){
      values._goal_mode=settings.goal_mode||'Observer sans objectif';
      if(Number.isFinite(Number(settings.step_goal))&&Number(settings.step_goal)>0)values._step_goal=Number(settings.step_goal);
      if(Number.isFinite(Number(settings.personal_baseline_steps))&&Number(settings.personal_baseline_steps)>0)values._personal_baseline_steps=Number(settings.personal_baseline_steps);
    }
    if(key==='nutrition_vegetale'){
      if(settings.diet_pattern&&!values.diet_pattern)values.diet_pattern=settings.diet_pattern;
      values._observed_nutrients=Array.isArray(settings.observed_nutrients)?settings.observed_nutrients:[];
      values._fortified_foods=settings.fortified_foods||'';values._supplement_b12=settings.supplement_b12||'Je ne souhaite pas préciser';values._supplement_d=settings.supplement_d||'Je ne souhaite pas préciser';values._supplement_omega3=settings.supplement_omega3||'Je ne souhaite pas préciser';
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
  window.mtCustomTrackerFieldsFor=fieldsFor;
  window.mtCustomTrackerDailySummary=trackerDailySummary;
  window.mtCustomTrackerAnalytics=trackerAnalytics;
  window.mtCustomCycleEstimate=cycleEstimate;
})();
