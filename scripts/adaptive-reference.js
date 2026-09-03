// MÉTHODE TEE — V460 · Lecture adaptative V1
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

  function build(model,opts={}){
    if(!model)return null;
    const s=model.summary||{},rows=Array.isArray(opts.rows)?opts.rows:[],trends=bodyTrends(model,rows),kind=intentKind(model.bodyIntent);
    const documented=n(s.documented_days)||0,nutritionDays=n(s.nutrition_days)||0,recalDays=n(s.recalibration_days)||0;
    const avgSleep=n(s.avg_sleep_hours),avgRecovery=n(s.avg_recovery),avgStress=n(s.avg_stress),avgProtein=n(s.avg_protein_g),avgFiber=n(s.avg_fiber_g),avgDigestion=n(s.avg_digestion),avgSatiety=n(s.avg_food_satiety);

    if(model.isMinor){
      return makeDecision(model,trends,'insufficient','Repères adultes volontairement désactivés','Méthode Tee peut continuer à organiser les données du quotidien, mais ne produit pas ici d’ajustement énergétique adulte.','Continue simplement à renseigner les repères utiles à ton quotidien.',[],{horizon:'au fil des jours'});
    }
    if(documented<7){
      return makeDecision(model,trends,'insufficient','Ton historique se construit','Il manque encore quelques journées comparables pour choisir un levier prioritaire sans surinterpréter une journée isolée.','Continue à renseigner ton alimentation et les suivis qui comptent pour toi. Aucun ajustement n’est proposé pour l’instant.',[],{horizon:'jusqu’à 7 journées documentées'});
    }

    // 1. La récupération prime sur une restriction supplémentaire.
    const recoveryReasons=[];
    if(avgSleep!==null&&avgSleep<6.5)recoveryReasons.push(`Sommeil moyen documenté : ${fmt(avgSleep,1)} h`);
    if(avgRecovery!==null&&avgRecovery<=4.5)recoveryReasons.push(`Récupération moyenne : ${fmt(avgRecovery,1)}/10`);
    if(avgStress!==null&&avgStress>=7)recoveryReasons.push(`Stress moyen : ${fmt(avgStress,1)}/10`);
    if(recoveryReasons.length){
      const lossCopy=kind==='loss'?' Avant d’accentuer un déficit, la priorité est de protéger le rythme et la récupération.':'';
      return makeDecision(model,trends,'recovery','Priorité récupération & rythme',`Tes repères récents montrent davantage de charge ou une récupération moins favorable.${lossCopy}`,'Pendant 7 jours, garde ton repère énergétique actuel et priorise sommeil, récupération et repas suffisamment structurés. Réévalue ensuite avant de modifier autre chose.',recoveryReasons);
    }

    // Pour adapter un objectif corporel, le profil et l’alimentation doivent être assez documentés.
    if(['loss','gain','recomp'].includes(kind)&&!model.profileReady){
      const missing=(model.missing||[]).slice(0,3);
      return makeDecision(model,trends,'insufficient','Complète ton point de départ','Ton objectif est connu, mais le profil de départ n’est pas encore assez complet pour relier proprement alimentation et évolution corporelle.','Va dans Profil → Préférences et compte → Gérer mon espace → Mon profil, complète les informations manquantes puis poursuis quelques jours avant toute adaptation.',missing.length?[`À compléter : ${missing.join(' · ')}`]:[],{horizon:'avant toute adaptation'});
    }
    if(['loss','gain','recomp'].includes(kind)&&nutritionDays<7){
      return makeDecision(model,trends,'insufficient','Ton alimentation doit encore se documenter','Pour adapter un objectif corporel, Méthode Tee a besoin de plusieurs journées alimentaires réelles plutôt que d’un ou deux jours isolés.','Continue à renseigner tes repas jusqu’à disposer d’au moins 7 journées alimentaires exploitables. Aucun ajustement énergétique n’est proposé avant.',[`${nutritionDays} journée${nutritionDays>1?'s':''} alimentaire${nutritionDays>1?'s':''} exploitable${nutritionDays>1?'s':''}`],{horizon:'jusqu’à 7 journées alimentaires'});
    }

    // 2. Structure protéique avant de toucher à l’énergie.
    if(model.protein&&avgProtein!==null&&nutritionDays>=7&&avgProtein<model.protein.low*.88){
      const reasons=[`Protéines moyennes : ${fmt(avgProtein,0)} g`, `Bas de ton repère actuel : ${fmt(model.protein.low,0)} g`];
      if(avgSatiety!==null&&avgSatiety<5.5)reasons.push(`Satiété moyenne renseignée : ${fmt(avgSatiety,1)}/10`);
      return makeDecision(model,trends,'protein','Priorité protéines & structure des repas','L’énergie n’est pas le premier levier à modifier : la structure protéique de tes journées reste régulièrement sous ton repère actuel.','Pendant 7 jours, renforce d’abord la présence d’une source protéique adaptée dans tes repas principaux, puis observe satiété, récupération et évolution avant tout autre changement.',reasons);
    }

    // 3. Fibres / densité alimentaire : progressive si la digestion est fragile.
    if(model.fiber&&avgFiber!==null&&nutritionDays>=7&&avgFiber<model.fiber.low*.88){
      const gentle=avgDigestion!==null&&avgDigestion<5.5;
      const reasons=[`Fibres moyennes : ${fmt(avgFiber,1)} g`, `Repère actuel : ${fmt(model.fiber.low,0)}–${fmt(model.fiber.high,0)} g`];
      if(avgDigestion!==null)reasons.push(`Confort digestif moyen : ${fmt(avgDigestion,1)}/10`);
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

  function injectCSS(){
    if(document.getElementById('mtAdaptiveCSS'))return;
    const s=document.createElement('style');s.id='mtAdaptiveCSS';s.textContent=`
      .mt-adaptive-card{margin:14px 0;padding:16px;border:1px solid #dfcfad;border-radius:20px;background:linear-gradient(180deg,#fffaf2,#f8f1e5);color:#6d6156}
      .mt-adaptive-card small{display:block;color:#a87f36;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}.mt-adaptive-card h3{margin:6px 0 7px;color:#164b3f;font-family:Georgia,serif;font-size:22px;font-weight:400}.mt-adaptive-card p{margin:0;line-height:1.5;font-size:13px}
      .mt-adaptive-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:13px 0}.mt-adaptive-flow span{padding:7px 4px;border-radius:10px;background:#f0e8da;text-align:center;font-size:9px;font-weight:800;color:#7c6f61}.mt-adaptive-flow span.is-on{background:#164b3f;color:#fff}
      .mt-adaptive-action{margin-top:11px;padding:12px 13px;border-radius:14px;background:#edf3ef;color:#21473e}.mt-adaptive-action b{display:block;margin-bottom:4px;color:#164b3f}.mt-adaptive-reasons{margin:10px 0 0;padding:0;list-style:none}.mt-adaptive-reasons li{position:relative;padding:4px 0 4px 16px;font-size:12px;line-height:1.35}.mt-adaptive-reasons li:before{content:'✷';position:absolute;left:0;color:#b08b45}
      .mt-adaptive-evidence{margin-top:10px!important;font-size:11px!important;color:#847669}.mt-adaptive-note{margin-top:8px!important;font-size:11px!important;color:#8b7d70}.mt-adaptive-card--trend{margin:0 0 12px}.mt-adaptive-card--trend h3{font-size:20px}
    `;document.head.appendChild(s);
  }
  function flowHTML(decision){
    const idx=decision.key==='insufficient'?0:decision.key==='verify'?1:2;
    const labels=['Observer','Relier','Priorité','Réévaluer'];
    return `<div class="mt-adaptive-flow">${labels.map((x,i)=>`<span class="${i<=idx?'is-on':''}">${i+1} · ${x}</span>`).join('')}</div>`;
  }
  function render(decision,opts={}){
    if(!decision)return '';
    injectCSS();
    const reasons=decision.reasons?.length?`<ul class="mt-adaptive-reasons">${decision.reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
    const evidence=decision.evidence?.length?`<p class="mt-adaptive-evidence">Appuyé sur : ${esc(decision.evidence.join(' · '))}</p>`:'';
    return `<div class="mt-adaptive-card ${opts.variant==='trend'?'mt-adaptive-card--trend':''}"><small>Lecture Méthode Tee · ${esc(decision.level?.label||'repère évolutif')}</small><h3>${esc(decision.title)}</h3><p>${esc(decision.summary)}</p>${flowHTML(decision)}${reasons}<div class="mt-adaptive-action"><b>Un seul levier à la fois · ${esc(decision.horizon)}</b>${esc(decision.action)}</div>${evidence}<p class="mt-adaptive-note">Aucun objectif n’est modifié automatiquement. Une absence de donnée reste une absence et une association ne prouve pas une cause.</p></div>`;
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

  window.MTAdaptive={build,render,bodyTrends,dataLevel,hookReference,decorateReferenceSheet};
  injectCSS();
  if(!hookReference()){
    let tries=0;const timer=setInterval(()=>{tries++;if(hookReference()||tries>20)clearInterval(timer);},120);
  }
})();
