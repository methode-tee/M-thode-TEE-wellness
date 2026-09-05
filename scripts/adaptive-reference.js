// MÉTHODE TEE — V474 · Lecture adaptative holistique · apprentissage statistique individuel
// Ridge multivariée personnelle + graphe causal pré-spécifié + estimation d'effet appariée.
// Observe -> relie -> priorise -> réévalue.
// Cette couche ne modifie jamais automatiquement les objectifs : elle propose UN levier à la fois
// à partir des repères compacts déjà chargés par Méthode Tee.
(function(){
  'use strict';
  if(window.MTAdaptive)return;

  const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const avg=list=>{const a=(list||[]).map(n).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;};
  const fmt=(v,d=0)=>Number(v).toLocaleString('fr-FR',{maximumFractionDigits:d,minimumFractionDigits:0});
  function client(){try{return typeof initSupabase==='function'?initSupabase():window.supabaseClient||null;}catch(_){return null;}}
  const holistic=model=>model?.context?.holistic&&typeof model.context.holistic==='object'?model.context.holistic:null;

  function trackerDays(model,key){return n(model?.trackerDays?.[key])||0;}
  function evidenceCount(rows,key,field){
    const dates=new Set();
    (rows||[]).forEach(r=>{if(String(r?.tracker_key||'')!==key)return;if(n(r?.values?.[field])!==null&&r?.entry_date)dates.add(r.entry_date);});
    return dates.size;
  }
  function metricTrend(rows,key,field){
    const byDate=new Map();
    (rows||[]).forEach(r=>{if(String(r?.tracker_key||'')!==key)return;const value=n(r?.values?.[field]);if(value===null||!r?.entry_date)return;byDate.set(String(r.entry_date),value);});
    const series=[...byDate.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,value])=>({date,value}));
    if(series.length<4)return null;
    const split=Math.max(2,Math.floor(series.length/2)),older=series.slice(0,split),recent=series.slice(split);
    if(recent.length<2)return null;
    const oldAvg=avg(older.map(x=>x.value)),recentAvg=avg(recent.map(x=>x.value));
    if(oldAvg===null||recentAvg===null)return null;
    const delta=recentAvg-oldAvg,pct=Math.abs(oldAvg)>0?delta/oldAvg:null;
    return {count:series.length,oldAvg,recentAvg,delta,pct,first:series[0],last:series.at(-1)};
  }
  function bodyTrends(model,rows=[]){
    const weightRows=metricTrend(rows,'evolution_corporelle','weight');
    const waistRows=metricTrend(rows,'evolution_corporelle','waist');
    const s=model?.summary||{};
    let weight=weightRows;
    if(!weight){
      const oldAvg=n(s.weight_older_avg),recentAvg=n(s.weight_recent_avg),oldN=n(s.weight_older_count)||0,recentN=n(s.weight_recent_count)||0;
      if(oldAvg!==null&&recentAvg!==null&&oldN>=3&&recentN>=3){
        const delta=recentAvg-oldAvg;
        weight={count:oldN+recentN,oldAvg,recentAvg,delta,pct:oldAvg?delta/oldAvg:null,source:'résumés 14 j + 14 j'};
      }
    }
    return {weight,waist:waistRows};
  }
  function intentKind(label){
    const x=norm(label);
    if(/perdre.*graisse|perte.*graisse/.test(x))return 'loss';
    if(/recomposition/.test(x))return 'recomp';
    if(/prise.*masse|prendre.*masse/.test(x))return 'gain';
    if(/stabilis/.test(x))return 'maintain';
    return 'observe';
  }
  function dataLevel(model){
    const hc=holistic(model)?.confidence;if(hc?.label)return {key:n(hc.score)>=75?'solid':n(hc.score)>=50?'usable':n(hc.score)>=30?'growing':'building',label:String(hc.label),score:n(hc.score)};
    const s=model?.summary||{},documented=n(s.documented_days)||0,nutrition=n(s.nutrition_days)||0,recal=n(s.recalibration_days)||0;
    if(documented<7)return {key:'building',label:'Repères en construction'};
    if(documented>=21&&nutrition>=10&&recal>=10)return {key:'solid',label:'Données suffisamment solides'};
    if(documented>=14&&nutrition>=7)return {key:'usable',label:'Lecture évolutive disponible'};
    return {key:'growing',label:'Lecture en cours de précision'};
  }
  function evidence(model,trends){
    const s=model?.summary||{},items=[];
    const documented=n(s.documented_days)||0,nutrition=n(s.nutrition_days)||0,recal=n(s.recalibration_days)||0;
    if(documented)items.push(`${documented} j documentés`);
    if(nutrition)items.push(`${nutrition} j alimentation`);
    if(recal)items.push(`${recal} j comparables`);
    if(trends?.weight?.count)items.push(`${trends.weight.count} repères poids`);
    if(trends?.waist?.count)items.push(`${trends.waist.count} repères taille`);
    const hc=holistic(model)?.confidence;if(n(hc?.score)!==null)items.push(`confiance ${Math.round(n(hc.score))}%`);
    return items.slice(0,5);
  }
  function makeDecision(model,trends,key,title,summary,action,reasons=[],extra={}){
    const level=dataLevel(model);
    return {
      key,title,summary,action,reasons:reasons.filter(Boolean).slice(0,3),
      horizon:extra.horizon||'7 jours',
      level,period:'28 derniers jours',
      evidence:evidence(model,trends),
      automatic:false,
      ...extra
    };
  }

  // V474 — Les poids ne sont plus identiques pour tout le monde.
  // Le serveur entraîne des modèles ridge individuels sur 90 jours et renvoie uniquement
  // un contexte compact. Le client utilise ces poids comme arbitre supplémentaire, jamais
  // comme preuve causale ni comme autorisation de modifier automatiquement un objectif.
  function baselineStat(h,key,period='baseline28'){
    const x=h?.[period]?.[key];return x&&typeof x==='object'?x:null;
  }
  function recentZ(h,key){
    const r=baselineStat(h,key,'baseline7'),b=baselineStat(h,key,'baseline28');
    const rv=n(r?.avg),bv=n(b?.median??b?.avg),sd=n(b?.sd);
    if(rv===null||bv===null||sd===null||Math.abs(sd)<1e-6)return null;
    return clamp((rv-bv)/sd,-3,3);
  }
  function learnedPrioritySignals(model){
    const h=holistic(model),models=h?.learning?.models;
    const out={recovery:0,protein:0,density:0,confidence:0,used:0,contributors:{recovery:[],protein:[],density:[]}};
    if(!models||typeof models!=='object')return out;
    const configs={energy:'higher_good',recovery:'higher_good',digestion:'higher_good',satiety:'higher_good',cravings:'higher_bad'};
    const leverFor={sleep_hours:'recovery',stress:'recovery',active_energy_kcal:'recovery',protein_g:'protein',fiber_g:'density'};
    Object.entries(configs).forEach(([mkey,outcomeMode])=>{
      const m=models[mkey];if(!m||String(m.status||'')!=='usable')return;
      const rel=n(m?.reliability?.score)||0,samples=n(m.samples)||0;
      if(rel<60||samples<30)return;
      out.confidence=Math.max(out.confidence,rel);out.used++;
      (Array.isArray(m.coefficients)?m.coefficients:[]).forEach(c=>{
        if(c?.active===false)return;
        const key=String(c?.key||''),lever=leverFor[key];if(!lever)return;
        const beta=n(c?.beta_std),z=recentZ(h,key),coverage=(n(c?.coverage)||0)/100;
        if(beta===null||z===null||coverage<.35)return;
        const predictedShift=beta*z;
        const adverse=outcomeMode==='higher_bad'?predictedShift:-predictedShift;
        if(adverse<=.10)return;
        const contribution=adverse*(rel/100)*clamp(coverage,0,1);
        out[lever]+=contribution;
        out.contributors[lever].push({key,score:contribution,model:mkey});
      });
    });
    ['recovery','protein','density'].forEach(k=>{
      out[k]=clamp(out[k],0,1.5);
      out.contributors[k].sort((a,b)=>b.score-a.score);
    });
    return out;
  }
  function learningSupportReason(learned,key){
    if(!learned||learned.confidence<60||learned[key]<.28)return null;
    return 'Plusieurs de tes repères personnels récents renforcent cette priorité';
  }

  function buildRaw(model,opts={}){
    if(!model)return null;
    const s=model.summary||{},rows=Array.isArray(opts.rows)?opts.rows:[],trends=bodyTrends(model,rows),kind=intentKind(model.bodyIntent),hc=holistic(model),concord=hc?.concordance||{},learned=learnedPrioritySignals(model);
    const documented=n(s.documented_days)||0,nutritionDays=n(s.nutrition_days)||0,recalDays=n(s.recalibration_days)||0;
    const avgSleep=n(s.avg_sleep_hours),avgRecovery=n(s.avg_recovery),avgStress=n(s.avg_stress),avgProtein=n(s.avg_protein_g),avgFiber=n(s.avg_fiber_g),avgDigestion=n(s.avg_digestion),avgSatiety=n(s.avg_food_satiety);

    if(model.isMinor){
      return makeDecision(model,trends,'insufficient','Repères adultes volontairement désactivés','Méthode Tee peut continuer à organiser les données du quotidien, mais ne produit pas ici d’ajustement énergétique adulte.','Continue simplement à renseigner les repères utiles à ton quotidien.',[],{horizon:'au fil des jours'});
    }
    if(documented<7){
      return makeDecision(model,trends,'insufficient','Ton historique se construit','Il manque encore quelques journées comparables pour choisir un levier prioritaire sans surinterpréter une journée isolée.','Continue à renseigner ton alimentation et les suivis qui comptent pour toi. Aucun ajustement n’est proposé pour l’instant.',[],{horizon:'jusqu’à 7 journées documentées'});
    }

    // 1. La récupération prime sur une restriction supplémentaire. V473 compare
    // d'abord la semaine récente à la zone personnelle 28 j lorsqu'elle existe.
    // Quand les repères personnels vont réellement dans des directions opposées,
    // on observe encore au lieu de forcer une conclusion.
    if(concord.state==='mixed'&&Number(concord.recovery_load_count)>=1&&Number(concord.recovery_support_count)>=1){
      return makeDecision(model,trends,'verify','Tes repères ne racontent pas tous la même chose','Certains repères récents sont plus fragiles que d’habitude alors que d’autres sont plus favorables. Méthode Tee évite de réduire cette situation à une seule conclusion.','Garde ton rythme actuel quelques jours et renseigne les mêmes repères. La priorité apparaîtra lorsque la tendance sera plus cohérente.',[],{horizon:'quelques journées comparables'});
    }
    const recoveryReasons=[],personalSignals=Array.isArray(concord.recovery_load_signals)?concord.recovery_load_signals:[];
    if(Number(concord.recovery_load_count)>=2){
      if(personalSignals.includes('sleep'))recoveryReasons.push('Ton sommeil récent est plus bas que ton rythme habituel');
      if(personalSignals.includes('recovery'))recoveryReasons.push('Ta récupération récente est plus basse que ton repère habituel');
      if(personalSignals.includes('stress'))recoveryReasons.push('Ton stress récent est plus haut que ton repère habituel');
      if(personalSignals.includes('energy'))recoveryReasons.push('Ton énergie récente est plus basse que ton repère habituel');
    }else{
      // Filet de sécurité quand la baseline personnelle n'est pas encore assez construite.
      if(avgSleep!==null&&avgSleep<6.0)recoveryReasons.push(`Sommeil moyen documenté : ${fmt(avgSleep,1)} h`);
      if(avgRecovery!==null&&avgRecovery<=4)recoveryReasons.push(`Récupération moyenne : ${fmt(avgRecovery,1)}/10`);
      if(avgStress!==null&&avgStress>=8)recoveryReasons.push(`Stress moyen : ${fmt(avgStress,1)}/10`);
    }
    const learnedRecovery=learningSupportReason(learned,'recovery');
    if(learnedRecovery&&!recoveryReasons.includes(learnedRecovery))recoveryReasons.push(learnedRecovery);
    if(recoveryReasons.length){
      const lossCopy=kind==='loss'?' Avant d’accentuer un déficit, la priorité est de protéger le rythme et la récupération.':'';
      return makeDecision(model,trends,'recovery','Priorité récupération & rythme',`Plusieurs repères récents invitent à protéger la récupération avant d’ajuster autre chose.${lossCopy}`,'Pendant 7 jours, garde ton repère énergétique actuel et priorise sommeil, récupération et repas suffisamment structurés. Réévalue ensuite avant de modifier autre chose.',recoveryReasons);
    }

    // Pour adapter un objectif corporel, le profil et l’alimentation doivent être assez documentés.
    if(['loss','gain','recomp'].includes(kind)&&!model.profileReady){
      const missing=(model.missing||[]).slice(0,3);
      return makeDecision(model,trends,'insufficient','Complète ton point de départ','Ton objectif est connu, mais le profil de départ n’est pas encore assez complet pour relier proprement alimentation et évolution corporelle.','Va dans Profil → Préférences et compte → Gérer mon espace → Mon profil, complète les informations manquantes puis poursuis quelques jours avant toute adaptation.',missing.length?[`À compléter : ${missing.join(' · ')}`]:[],{horizon:'avant toute adaptation'});
    }
    if(['loss','gain','recomp'].includes(kind)&&nutritionDays<7){
      return makeDecision(model,trends,'insufficient','Ton alimentation doit encore se documenter','Pour adapter un objectif corporel, Méthode Tee a besoin de plusieurs journées alimentaires réelles plutôt que d’un ou deux jours isolés.','Continue à renseigner tes repas jusqu’à disposer d’au moins 7 journées alimentaires exploitables. Aucun ajustement énergétique n’est proposé avant.',[`${nutritionDays} journée${nutritionDays>1?'s':''} alimentaire${nutritionDays>1?'s':''} exploitable${nutritionDays>1?'s':''}`],{horizon:'jusqu’à 7 journées alimentaires'});
    }

    // 2. Structure protéique avant de toucher à l’énergie. V474 peut rapprocher le
    // seuil du repère personnel lorsque le modèle individuel relie réellement ce signal
    // à la satiété / aux envies avec une fiabilité suffisante.
    const learnedProtein=learned.confidence>=60&&learned.protein>=.34;
    if(model.protein&&avgProtein!==null&&nutritionDays>=7&&(avgProtein<model.protein.low*.88||(learnedProtein&&avgProtein<model.protein.low))){
      const reasons=[`Protéines moyennes : ${fmt(avgProtein,0)} g`, `Bas de ton repère actuel : ${fmt(model.protein.low,0)} g`];
      if(avgSatiety!==null&&avgSatiety<5.5)reasons.push(`Satiété moyenne renseignée : ${fmt(avgSatiety,1)}/10`);
      const learnedReason=learningSupportReason(learned,'protein');if(learnedReason)reasons.push(learnedReason);
      return makeDecision(model,trends,'protein','Priorité protéines & structure des repas','L’énergie n’est pas le premier levier à modifier : la structure protéique de tes journées reste régulièrement sous ton repère actuel.','Pendant 7 jours, renforce d’abord la présence d’une source protéique adaptée dans tes repas principaux, puis observe satiété, récupération et évolution avant tout autre changement.',reasons);
    }

    // 3. Fibres / densité alimentaire : progressive si la digestion est fragile.
    const learnedDensity=learned.confidence>=60&&learned.density>=.34;
    if(model.fiber&&avgFiber!==null&&nutritionDays>=7&&(avgFiber<model.fiber.low*.88||(learnedDensity&&avgFiber<model.fiber.low))){
      const gentle=avgDigestion!==null&&avgDigestion<5.5;
      const reasons=[`Fibres moyennes : ${fmt(avgFiber,1)} g`, `Repère actuel : ${fmt(model.fiber.low,0)}–${fmt(model.fiber.high,0)} g`];
      if(avgDigestion!==null)reasons.push(`Confort digestif moyen : ${fmt(avgDigestion,1)}/10`);
      const learnedReason=learningSupportReason(learned,'density');if(learnedReason)reasons.push(learnedReason);
      return makeDecision(model,trends,'density',gentle?'Priorité densité nutritionnelle, progressivement':'Priorité fibres & densité nutritionnelle',gentle?'Les fibres documentées restent basses et ton confort digestif invite à progresser sans brusquer le rythme.':'Les fibres documentées restent régulièrement sous ton repère. Avant de réduire l’énergie, Méthode Tee privilégie la qualité et la densité des repas.',gentle?'Pendant 7 jours, augmente très progressivement les végétaux et sources de fibres que tu tolères déjà, puis observe le confort digestif.':'Pendant 7 jours, renforce progressivement végétaux, légumineuses, fruits, céréales complètes ou autres sources de fibres adaptées à tes habitudes.',reasons);
    }

    // 4. Pour adapter un objectif corporel, il faut aussi une tendance corporelle répétée.
    const wt=trends.weight,wa=trends.waist;
    if(['loss','gain','recomp'].includes(kind)&&!wt){
      return makeDecision(model,trends,'insufficient','Il manque encore une tendance corporelle comparable','Ton alimentation commence à être documentée, mais Méthode Tee ne modifie pas un repère lié au corps sans plusieurs mesures comparables.','Si cela correspond à ton objectif, utilise Carnet → Mes suivis → Évolution corporelle et renseigne les repères que tu as choisi de suivre dans des conditions aussi comparables que possible.',[],{horizon:'jusqu’à plusieurs mesures comparables'});
    }

    // 5. Une taille qui baisse avec un poids stable ne justifie pas de réduire davantage.
    const weightStable=!!(wt&&wt.pct!==null&&Math.abs(wt.pct)<=.006);
    const waistDown=!!(wa&&wa.delta<=-0.8);
    if(weightStable&&waistDown){
      return makeDecision(model,trends,'maintain','Maintenir : ton corps évolue déjà','Ton poids est plutôt stable alors que ton tour de taille évolue à la baisse sur les mesures comparables. Méthode Tee ne réduit pas davantage les apports sur ce seul constat.','Garde ton repère actuel pendant 7 jours et continue à documenter alimentation, activité, récupération et évolution corporelle dans des conditions comparables.',[
        `Poids : ${fmt(wt.oldAvg,1)} → ${fmt(wt.recentAvg,1)} kg`,
        `Tour de taille : ${fmt(wa.oldAvg,1)} → ${fmt(wa.recentAvg,1)} cm`
      ]);
    }

    // 6. Garde-fou : une variation corporelle très importante n'est jamais utilisée pour recalibrer automatiquement.
    if(wt&&wt.pct!==null&&Math.abs(wt.pct)>.03){
      return makeDecision(model,trends,'verify','Vérifier avant d’ajuster','La variation corporelle récente est trop importante pour servir seule de base à un recalibrage automatique.','Garde le repère inchangé pour l’instant, vérifie que les mesures ont été prises dans des conditions comparables et poursuis l’observation. Si cette évolution est réelle ou inhabituelle, fais-la interpréter dans son contexte.',[
        `Repères poids comparables : ${wt.count}`,
        `Évolution moyenne observée : ${wt.delta>0?'+':''}${fmt(wt.delta,1)} kg`
      ],{horizon:'avant tout nouvel ajustement'});
    }

    // 7. Si la direction corporelle correspond déjà à l'intention, on maintient.
    if(wt&&wt.pct!==null){
      const aligned=(kind==='loss'&&wt.pct<=-.003)||(kind==='gain'&&wt.pct>=.003)||(kind==='maintain'&&Math.abs(wt.pct)<=.007)||(kind==='recomp'&&(Math.abs(wt.pct)<=.008||waistDown));
      if(aligned){
        const intentCopy=kind==='loss'?'La tendance corporelle va déjà dans le sens de ton intention.':kind==='gain'?'La tendance corporelle va déjà dans le sens de ta prise de masse.':kind==='recomp'?'La tendance corporelle reste compatible avec une phase de recomposition.':'La tendance corporelle reste proche d’un rythme stable.';
        return makeDecision(model,trends,'maintain','Maintenir ton repère actuel',intentCopy+' Aucun levier prioritaire ne justifie un changement supplémentaire pour l’instant.','Garde ton repère actuel pendant 7 jours. Continue à documenter tes journées et réévalue seulement si plusieurs indicateurs changent ensemble.',[
          `Poids moyen : ${fmt(wt.oldAvg,1)} → ${fmt(wt.recentAvg,1)} kg`,
          `Journées nutritionnelles : ${nutritionDays}`
        ]);
      }
    }

    // 8. Revoir l’énergie seulement après récupération, protéines et structure alimentaire.
    const bodyEnough=!!(wt&&wt.count>=6),energyEnough=!!(model.profileReady&&model.energy&&nutritionDays>=10&&recalDays>=10&&bodyEnough);
    if(energyEnough&&(kind==='loss'||kind==='gain')){
      const notMovingLoss=kind==='loss'&&wt.pct>-.0025;
      const notMovingGain=kind==='gain'&&wt.pct<.0025;
      if(notMovingLoss||notMovingGain){
        return makeDecision(model,trends,'energy_review','Repère énergétique à réévaluer',kind==='loss'?'Tes journées sont suffisamment documentées et la tendance corporelle ne montre pas encore de baisse nette malgré ton intention actuelle. Les autres leviers prioritaires ne ressortent pas avant l’énergie.':'Tes journées sont suffisamment documentées et la tendance corporelle ne montre pas encore de hausse nette malgré ton intention actuelle. Les autres leviers prioritaires ne ressortent pas avant l’énergie.','Aucun changement n’est appliqué automatiquement. Maintiens encore 7 jours de données comparables ; si la tendance se confirme, ton repère énergétique pourra être réévalué prudemment plutôt que modifié sur une seule semaine.',[
          `Journées alimentaires : ${nutritionDays}`,
          `Journées comparables : ${recalDays}`,
          `Poids moyen : ${fmt(wt.oldAvg,1)} → ${fmt(wt.recentAvg,1)} kg`
        ]);
      }
    }

    // 9. Par défaut, ne rien changer est une vraie décision.
    const reasons=[];
    if(nutritionDays)reasons.push(`${nutritionDays} journées alimentaires documentées`);
    if(avgSleep!==null)reasons.push(`Sommeil moyen : ${fmt(avgSleep,1)} h`);
    if(avgRecovery!==null)reasons.push(`Récupération moyenne : ${fmt(avgRecovery,1)}/10`);
    return makeDecision(model,trends,'maintain','Maintenir et continuer à observer','Aucun signal suffisamment solide ne justifie de changer ton repère principal maintenant. Ne rien modifier est aussi une décision lorsque les données restent cohérentes.','Continue ton rythme actuel pendant 7 jours et renseigne régulièrement les mêmes repères. Méthode Tee réévaluera la priorité lorsque plusieurs journées raconteront autre chose.',reasons);
  }

  // V473 — Le levier reste stable 7 jours et l'état compact est synchronisé au compte.
  // localStorage reste un secours instantané si le réseau est indisponible.
  const CYCLE_VERSION=2;
  const CYCLE_DAYS=7;
  const todayISO=()=>new Date().toLocaleDateString('sv-SE');
  function hashText(value){
    let h=2166136261;const t=String(value||'');
    for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619);}
    return (h>>>0).toString(36);
  }
  function authUserHint(){
    try{
      if(window.__MT_LIBRARY_USER_ID__)return String(window.__MT_LIBRARY_USER_ID__);
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)||'';
        if(!/^sb-.*-auth-token$/.test(key))continue;
        const raw=localStorage.getItem(key);if(!raw)continue;
        const parsed=JSON.parse(raw),uid=parsed?.user?.id||parsed?.currentSession?.user?.id||parsed?.session?.user?.id;
        if(uid)return String(uid);
      }
    }catch(_){ }
    return '';
  }
  function profileKey(model){
    const uid=authUserHint();if(uid)return `u_${hashText(uid)}`;
    const p=model?.context?.profile||{};
    const stable=[p.birth_date,p.height_cm,p.reference_sex||p.reference_gender,model?.bodyIntent].join('|');
    return `p_${hashText(stable||'default')}`;
  }
  function cycleStorageKey(model){return `mt_adaptive_cycle_v473_${profileKey(model)}`;}
  function readCycle(key,model=null){
    let local=null;try{const v=JSON.parse(localStorage.getItem(key)||'null');if(v&&v.version===CYCLE_VERSION)local=v;}catch(_){ }
    const remote=holistic(model)?.adaptive_cycle_state,remoteOk=remote&&typeof remote==='object'&&remote.version===CYCLE_VERSION;
    if(remoteOk){
      const remoteStart=String(remote.startedOn||''),localStart=String(local?.startedOn||''),remoteAt=Date.parse(remote.updatedAt||remote.createdAt||'')||0,localAt=Date.parse(local?.updatedAt||local?.createdAt||'')||0;
      const remoteNewer=!local||remoteStart>localStart||(remoteStart===localStart&&(remoteAt>localAt||(!local?.reevaluatedOn&&!!remote.reevaluatedOn)));
      if(remoteNewer){try{localStorage.setItem(key,JSON.stringify(remote));}catch(_){ }return remote;}
    }
    return local||(remoteOk?remote:null);
  }
  function writeCycle(key,value){
    if(value&&typeof value==='object')value.updatedAt=new Date().toISOString();
    try{localStorage.setItem(key,JSON.stringify(value));}catch(_){ }
    try{const c=client();if(c&&value)c.rpc('mt_adaptive_cycle_save',{p_state:value}).then(()=>{}).catch(()=>{});}catch(_){ }
    return value;
  }
  function dayDiff(from,to){
    const a=new Date(`${from}T12:00:00`),b=new Date(`${to}T12:00:00`);
    if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return 0;
    return Math.max(0,Math.floor((b-a)/86400000));
  }
  function snapshot(model,trends){
    const s=model?.summary||{};
    return {
      documented:n(s.documented_days)||0,nutrition:n(s.nutrition_days)||0,recal:n(s.recalibration_days)||0,
      sleep:n(s.avg_sleep_hours),recovery:n(s.avg_recovery),stress:n(s.avg_stress),protein:n(s.avg_protein_g),fiber:n(s.avg_fiber_g),digestion:n(s.avg_digestion),satiety:n(s.avg_food_satiety),
      weight:n(trends?.weight?.recentAvg),waist:n(trends?.waist?.recentAvg)
    };
  }
  function decisionSnapshot(d){
    return {key:d.key,title:d.title,summary:d.summary,action:d.action,reasons:Array.isArray(d.reasons)?d.reasons.slice(0,3):[],horizon:d.horizon||'7 jours'};
  }
  function startCycle(storageKey,raw,model,trends,date=todayISO()){
    const state={version:CYCLE_VERSION,startedOn:date,reevaluatedOn:null,decision:decisionSnapshot(raw),baseline:snapshot(model,trends),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    writeCycle(storageKey,state);return state;
  }
  function deltaText(label,before,after,unit='',threshold=0.01,digits=1){
    if(before===null||after===null||before===undefined||after===undefined)return null;
    const d=after-before;if(Math.abs(d)<threshold)return null;
    const sign=d>0?'+':'';return `${label} : ${fmt(before,digits)} → ${fmt(after,digits)}${unit} (${sign}${fmt(d,digits)}${unit})`;
  }
  function comparisonLines(previousKey,base,current){
    const lines=[];
    const add=x=>{if(x&&!lines.includes(x)&&lines.length<4)lines.push(x);};
    const documented=(current.documented||0)-(base.documented||0),nutrition=(current.nutrition||0)-(base.nutrition||0);
    const metric={
      protein:()=>deltaText('Protéines moyennes',base.protein,current.protein,' g',3,0),
      fiber:()=>deltaText('Fibres moyennes',base.fiber,current.fiber,' g',1.5,1),
      digestion:()=>deltaText('Confort digestif',base.digestion,current.digestion,'/10',0.5,1),
      sleep:()=>deltaText('Sommeil moyen',base.sleep,current.sleep,' h',0.2,1),
      recovery:()=>deltaText('Récupération',base.recovery,current.recovery,'/10',0.5,1),
      stress:()=>deltaText('Stress',base.stress,current.stress,'/10',0.5,1),
      weight:()=>deltaText('Poids moyen récent',base.weight,current.weight,' kg',0.2,1),
      waist:()=>deltaText('Tour de taille récent',base.waist,current.waist,' cm',0.5,1)
    };
    const orders={
      recovery:['sleep','recovery','stress','protein'],protein:['protein','satiety','recovery','weight'],density:['fiber','digestion','satiety','weight'],
      energy_review:['weight','waist','protein','sleep'],maintain:['weight','waist','recovery','sleep']
    };
    const order=orders[previousKey]||['weight','waist','protein','fiber','sleep','recovery','stress','digestion'];
    order.forEach(k=>{if(k==='satiety')add(deltaText('Satiété',base.satiety,current.satiety,'/10',0.5,1));else add(metric[k]?.());});
    if(documented>0)add(`Historique : +${documented} journée${documented>1?'s':''} documentée${documented>1?'s':''}`);
    if(nutrition>0)add(`Alimentation : +${nutrition} journée${nutrition>1?'s':''} exploitable${nutrition>1?'s':''}`);
    if(!lines.length)lines.push('Les principaux repères restent proches du point de départ de ce cycle.');
    return lines.slice(0,4);
  }
  function actionable(raw){return raw&&!['insufficient','verify'].includes(raw.key);}
  function nonActionPhase(raw,model){
    if(raw?.key==='verify')return 'relate';
    const documented=n(model?.summary?.documented_days)||0;
    return documented>=7?'relate':'observe';
  }
  function pinnedDecision(state,raw,day){
    const d={...state.decision,level:raw.level,evidence:raw.evidence,automatic:false,period:raw.period,flowPhase:'priority'};
    d.cycle={day,total:CYCLE_DAYS,startedOn:state.startedOn,storageKey:null,appliedDays:Math.max(0,Number(raw?._appliedDays)||0),appliedToday:!!(raw?._appliedToday)};
    // On garde UN levier pendant le cycle. Les preuves continuent toutefois à se mettre à jour.
    if(raw.key!==state.decision.key)d.pendingSignal={key:raw.key,title:raw.title};
    return d;
  }
  function reevaluationDecision(state,raw,model,trends,storageKey,date){
    const h=holistic(model),current=snapshot(model,trends),nextActionable=actionable(raw),same=nextActionable&&raw.key===state.decision.key,changes=comparisonLines(state.decision.key,state.baseline||{},current),appliedDays=Math.max(0,Number(h?.adaptive_cycle_applied_days)||0),effect=h?.intervention_effect||{};
    const effectRel=n(effect?.reliability?.score)||0,effectUsable=effect?.status==='usable'&&effectRel>=60;
    if(!state.reevaluatedOn){state.reevaluatedOn=date;writeCycle(storageKey,state);}
    if(appliedDays<4){
      return {...raw,key:'reevaluate',flowPhase:'reevaluate',title:'Réévaluation après 7 jours',summary:`Le cycle « ${state.decision.title} » arrive à son point de réévaluation, mais l’application du repère n’est pas encore assez documentée pour juger son effet.`,action:'Garde le levier simple et note les jours où tu l’appliques réellement. Méthode Tee réévaluera son effet avec davantage de recul.',reasons:[`${appliedDays} jour${appliedDays>1?'s':''} d’application documenté${appliedDays>1?'s':''}`,...changes].slice(0,3),horizon:'encore quelques jours comparables',cycle:{day:7,total:CYCLE_DAYS,startedOn:state.startedOn,reevaluatedOn:state.reevaluatedOn,appliedDays,appliedToday:!!(holistic(model)?.adaptive_cycle_applied_today)},cycleComparison:{previous:state.decision.title,next:state.decision.title,same:true,gate:true},previousDecision:state.decision};
    }
    if(effectUsable&&effect.interpretation==='unfavorable'){
      return {...raw,key:'reevaluate',flowPhase:'reevaluate',title:'Réévaluation après 7 jours',summary:`Le cycle « ${state.decision.title} » a été suffisamment appliqué pour être comparé à des journées personnelles similaires. Les repères observés ne montrent pas une évolution favorable assez nette pour renforcer ce levier maintenant.`,action:'N’intensifie pas ce levier. Reviens quelques jours à l’observation avec les mêmes repères ; Méthode Tee cherchera une priorité plus cohérente avec ta réponse réelle.',reasons:[...changes,'Les journées comparables ne renforcent pas ce levier'].slice(0,3),horizon:'retour à Observer',cycle:{day:7,total:CYCLE_DAYS,startedOn:state.startedOn,reevaluatedOn:state.reevaluatedOn,appliedDays,appliedToday:!!h?.adaptive_cycle_applied_today},cycleComparison:{previous:state.decision.title,next:'Observer',same:false,gate:true},previousDecision:state.decision};
    }
    let summary,action,horizon,comparison;
    if(!nextActionable){
      summary=`Le cycle « ${state.decision.title} » arrive à son point de réévaluation. Le levier précédent a bien été réévalué, mais les données actuelles ne permettent pas encore de choisir proprement le suivant.`;
      action=`${raw.title}. ${raw.action}`;
      horizon=raw.horizon||'jusqu’à disposer de données suffisantes';
      comparison={previous:state.decision.title,next:raw.title,same:false,gate:true};
    }else if(same){
      summary=`Le cycle « ${state.decision.title} » arrive à son point de réévaluation. Les nouvelles données permettent de vérifier si ce levier reste prioritaire.`;
      action=`La priorité reste « ${raw.title} ». ${raw.action}`;
      horizon='nouveau cycle de 7 jours';
      comparison={previous:state.decision.title,next:raw.title,same:true};
    }else{
      summary=`Le cycle « ${state.decision.title} » arrive à son point de réévaluation. Les nouvelles données permettent maintenant de faire évoluer la priorité.`;
      action=`Le prochain levier proposé est « ${raw.title} ». ${raw.action}`;
      horizon='nouveau levier dès le prochain cycle';
      comparison={previous:state.decision.title,next:raw.title,same:false};
    }
    if(effectUsable&&effect.interpretation==='favorable'){
      summary+=' Les journées où tu as réellement appliqué ce repère évoluent aussi dans un sens favorable lorsqu’elles sont comparées à des journées personnelles proches.';
      changes.unshift('La réponse observée sur les jours d’application renforce ce levier');
    }else if(effectUsable&&effect.interpretation==='neutral'){
      changes.unshift('L’effet observé reste encore discret malgré une application suffisante');
    }
    return {
      ...raw,key:'reevaluate',flowPhase:'reevaluate',title:'Réévaluation après 7 jours',summary,action,reasons:changes.slice(0,4),horizon,
      cycle:{day:7,total:CYCLE_DAYS,startedOn:state.startedOn,reevaluatedOn:state.reevaluatedOn,appliedDays,appliedToday:!!(holistic(model)?.adaptive_cycle_applied_today)},
      cycleComparison:comparison,previousDecision:state.decision
    };
  }
  function applyCycle(raw,model,opts={}){
    if(!raw)return raw;
    // La vue 90 jours reste analytique : le cycle d'action est celui de la lecture actuelle / 28 jours.
    if(opts.mode==='90d')return {...raw,flowPhase:actionable(raw)?'priority':nonActionPhase(raw,model)};
    const trends=bodyTrends(model,Array.isArray(opts.rows)?opts.rows:[]),storageKey=cycleStorageKey(model),date=todayISO();
    raw._appliedDays=Math.max(0,Number(holistic(model)?.adaptive_cycle_applied_days)||0);
    raw._appliedToday=!!(holistic(model)?.adaptive_cycle_applied_today);
    let state=readCycle(storageKey,model);

    // Sans cycle existant, seules les décisions réellement actionnables démarrent un compte à rebours.
    if(!state){
      if(!actionable(raw))return {...raw,flowPhase:nonActionPhase(raw,model)};
      state=startCycle(storageKey,raw,model,trends,date);
    }

    // Une vérification de sécurité s'affiche immédiatement et ne détruit pas le cycle mémorisé.
    if(raw.key==='verify')return {...raw,flowPhase:'relate'};

    // La récupération peut interrompre un levier moins prioritaire : protection avant optimisation.
    if(raw.key==='recovery'&&state.decision?.key!=='recovery')state=startCycle(storageKey,raw,model,trends,date);

    // Après une journée complète de réévaluation visible, le nouveau cycle démarre automatiquement.
    if(state.reevaluatedOn&&state.reevaluatedOn<date){
      if(!actionable(raw))return {...raw,flowPhase:nonActionPhase(raw,model)};
      state=startCycle(storageKey,raw,model,trends,date);
    }

    const elapsed=dayDiff(state.startedOn,date),day=clamp(elapsed+1,1,CYCLE_DAYS);
    // Même si le levier précédent a déjà amélioré les données et que le moteur brut retombe
    // momentanément sur « données insuffisantes », le 7e jour reste une vraie réévaluation du cycle.
    if(day>=CYCLE_DAYS)return reevaluationDecision(state,raw,model,trends,storageKey,date);
    return pinnedDecision(state,raw,day);
  }
  function build(model,opts={}){
    const raw=buildRaw(model,opts);return applyCycle(raw,model,opts);
  }

  function injectCSS(){
    if(document.getElementById('mtAdaptiveCSS'))return;
    const s=document.createElement('style');s.id='mtAdaptiveCSS';s.textContent=`
      .mt-adaptive-card{margin:14px 0;padding:16px;border:1px solid #dfcfad;border-radius:20px;background:linear-gradient(180deg,#fffaf2,#f8f1e5);color:#6d6156}
      .mt-adaptive-card small{display:block;color:#a87f36;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}.mt-adaptive-card h3{margin:6px 0 7px;color:#164b3f;font-family:Georgia,serif;font-size:22px;font-weight:400}.mt-adaptive-card p{margin:0;line-height:1.5;font-size:13px}
      .mt-adaptive-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:13px 0}.mt-adaptive-flow span{padding:7px 4px;border-radius:10px;background:#f0e8da;text-align:center;font-size:9px;font-weight:800;color:#7c6f61}.mt-adaptive-flow span.is-done{background:#dfe9e3;color:#31584e}.mt-adaptive-flow span.is-current{background:#164b3f;color:#fff;box-shadow:0 0 0 2px rgba(22,75,63,.10)}
      .mt-adaptive-cycle{margin:10px 0 2px;padding:10px 12px;border-radius:14px;background:#fffdf8;border:1px solid #eadfc9}.mt-adaptive-cycle-head{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#164b3f;font-size:11px}.mt-adaptive-cycle-head b{font-size:12px}.mt-adaptive-days{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:8px}.mt-adaptive-days i{display:block;height:5px;border-radius:999px;background:#e8dfd1}.mt-adaptive-days i.is-done{background:#8ca99f}.mt-adaptive-days i.is-current{background:#164b3f}.mt-adaptive-compare{margin:10px 0;padding:10px 12px;border-left:3px solid #b08b45;background:#fffaf1;border-radius:0 12px 12px 0;font-size:11px;line-height:1.45;color:#6f6255}.mt-adaptive-compare b{color:#164b3f}.mt-adaptive-action{margin-top:11px;padding:12px 13px;border-radius:14px;background:#edf3ef;color:#21473e}.mt-adaptive-action b{display:block;margin-bottom:4px;color:#164b3f}.mt-adaptive-reasons{margin:10px 0 0;padding:0;list-style:none}.mt-adaptive-reasons li{position:relative;padding:4px 0 4px 16px;font-size:12px;line-height:1.35}.mt-adaptive-reasons li:before{content:'✷';position:absolute;left:0;color:#b08b45}
      .mt-adaptive-evidence{margin-top:10px!important;font-size:11px!important;color:#847669}.mt-adaptive-note{margin-top:8px!important;font-size:11px!important;color:#8b7d70}.mt-adaptive-card--trend{margin:0 0 12px}.mt-adaptive-card--trend h3{font-size:20px}.mt-adaptive-applied{display:block!important;margin-top:7px;color:#7d6f61!important;letter-spacing:0!important;text-transform:none!important;font-weight:600!important}.mt-adaptive-checkin{width:100%;margin-top:10px;padding:10px 12px;border:1px solid #c9b994;border-radius:999px;background:#fffdf8;color:#164b3f;font-weight:800;font-size:11px}.mt-adaptive-checkin.is-saved{background:#e2ece6;border-color:#b8cec2}
    `;document.head.appendChild(s);
  }
  function flowHTML(decision){
    const phase=decision.flowPhase||((decision.key==='insufficient')?'observe':decision.key==='verify'?'relate':decision.key==='reevaluate'?'reevaluate':'priority');
    const idx={observe:0,relate:1,priority:2,reevaluate:3}[phase]??0,labels=['Observer','Relier','Priorité','Réévaluer'];
    return `<div class="mt-adaptive-flow">${labels.map((x,i)=>`<span class="${i<idx?'is-done':i===idx?'is-current':''}">${i+1} · ${x}</span>`).join('')}</div>`;
  }
  function cycleHTML(decision){
    const c=decision.cycle;if(!c)return '';
    const phase=decision.flowPhase||'priority',day=clamp(Number(c.day)||1,1,7),title=phase==='reevaluate'?'Réévaluation du cycle':'Priorité en cours';
    const applied=Math.max(0,Number(c.appliedDays)||0);
    return `<div class="mt-adaptive-cycle"><div class="mt-adaptive-cycle-head"><b>${title}</b><span>Jour ${day}/7</span></div><div class="mt-adaptive-days">${Array.from({length:7},(_,i)=>`<i class="${i+1<day?'is-done':i+1===day?'is-current':''}"></i>`).join('')}</div>${applied?`<small class="mt-adaptive-applied">${applied} jour${applied>1?'s':''} d’application noté${applied>1?'s':''}</small>`:''}</div>`;
  }
  function actionLabel(decision){
    const phase=decision.flowPhase||'priority';
    if(phase==='observe')return `Observation en cours · ${decision.horizon||'au fil des jours'}`;
    if(phase==='relate')return `Relier avant d’ajuster · ${decision.horizon||'avant tout ajustement'}`;
    if(phase==='reevaluate')return `Suite proposée · ${decision.horizon||'nouveau cycle'}`;
    return `Un seul levier à la fois · ${decision.horizon||'7 jours'}`;
  }
  function comparisonHTML(decision){
    const c=decision.cycleComparison;if(!c)return '';
    return `<div class="mt-adaptive-compare"><b>Cycle suivi</b> · ${esc(c.previous)}<br><b>${c.gate?'Étape suivante':c.same?'Priorité après réévaluation':'Nouveau levier proposé'}</b> · ${esc(c.next)}</div>`;
  }
  function render(decision,opts={}){
    if(!decision)return '';
    injectCSS();
    const reasons=decision.reasons?.length?`<ul class="mt-adaptive-reasons">${decision.reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
    const evidence=decision.evidence?.length?`<p class="mt-adaptive-evidence">Appuyé sur : ${esc(decision.evidence.join(' · '))}</p>`:'';
    const canCheck=decision.flowPhase==='priority'&&decision.cycle?.startedOn&&actionable(decision),alreadyApplied=!!decision.cycle?.appliedToday,checkin=canCheck?`<button class="mt-adaptive-checkin ${alreadyApplied?'is-saved':''}" type="button" data-mt-adaptive-checkin="${esc(decision.cycle.startedOn)}" data-mt-adaptive-lever="${esc(decision.key)}" onclick="MTAdaptive.checkin(this)" ${alreadyApplied?'disabled':''}>${alreadyApplied?'✓ Repère appliqué aujourd’hui':'J’ai appliqué ce repère aujourd’hui'}</button>`:'';
    return `<div class="mt-adaptive-card ${opts.variant==='trend'?'mt-adaptive-card--trend':''}"><small>Lecture Méthode Tee · ${esc(decision.level?.label||'repère évolutif')}</small><h3>${esc(decision.title)}</h3><p>${esc(decision.summary)}</p>${flowHTML(decision)}${cycleHTML(decision)}${comparisonHTML(decision)}${reasons}<div class="mt-adaptive-action"><b>${esc(actionLabel(decision))}</b>${esc(decision.action)}</div>${checkin}${evidence}<p class="mt-adaptive-note">Aucun objectif n’est modifié automatiquement. La lecture apprend de ton historique, mais une estimation statistique ne constitue jamais à elle seule une preuve de cause.</p></div>`;
  }
  async function checkin(button){
    const started=button?.dataset?.mtAdaptiveCheckin,lever=button?.dataset?.mtAdaptiveLever;if(!started||!lever)return;
    button.disabled=true;button.textContent='Enregistrement…';
    try{const c=client();if(!c)throw new Error('offline');const {data,error}=await c.rpc('mt_adaptive_cycle_checkin',{p_cycle_started_on:started,p_lever_key:lever,p_applied:true});if(error)throw error;button.classList.add('is-saved');button.textContent='✓ Repère appliqué aujourd’hui';button.dataset.appliedDays=String(data?.applied_days||'');window.MTReference?.invalidate?.();}
    catch(_){button.disabled=false;button.textContent='Réessayer de noter ce repère';}
  }
  function decorateReferenceSheet(model){
    try{
      const modal=document.getElementById('mtReferenceModal'),sheet=modal?.querySelector('.mt-ref-sheet');if(!sheet||sheet.querySelector('.mt-adaptive-card'))return;
      const decision=build(model);if(!decision)return;
      const source=sheet.querySelector('.mt-ref-sources');if(source)source.insertAdjacentHTML('beforebegin',render(decision));else sheet.insertAdjacentHTML('beforeend',render(decision));
    }catch(e){console.warn('[Lecture adaptative] affichage fiche',e);}
  }
  function hookReference(){
    const ref=window.MTReference;if(!ref||ref.__mtAdaptiveHooked)return !!ref;
    const original=ref.openSheet;
    if(typeof original==='function'){
      ref.openSheet=function(model,totals){const out=original.call(ref,model,totals);setTimeout(()=>decorateReferenceSheet(model),0);return out;};
    }
    ref.__mtAdaptiveHooked=true;return true;
  }

  window.MTAdaptive={build,buildRaw,render,bodyTrends,dataLevel,learnedPrioritySignals,hookReference,decorateReferenceSheet,checkin};
  injectCSS();
  if(!hookReference()){
    let tries=0;const timer=setInterval(()=>{tries++;if(hookReference()||tries>20)clearInterval(timer);},120);
  }
})();
