/* MÉTHODE TEE · V4896601 · curation proactive et priorité mémoire
 * Couche d'action au-dessus de MTReference / MTAdaptive.
 * - bibliothèque réelle + produits scannés mémorisés côté serveur
 * - portions réalistes, familiarité, rotation et contexte repas
 * - aucune interprétation de « non documenté » comme carence
 */
(function(){
  'use strict';
  if(window.MTFoodGuidance)return;

  const CACHE=new Map(),TTL=3*60*1000;
  const FOCUS_BY_DECISION={protein:'protein',density:'fiber',energy_review:'energy'};
  const FOCUS_LABELS={
    protein:'protéines',fiber:'fibres',energy:'énergie',carbs:'glucides',fat:'lipides',
    iron_mg:'fer',calcium_mg:'calcium',zinc_mg:'zinc',iodine_ug:'iode',magnesium_mg:'magnésium',phosphorus_mg:'phosphore',potassium_mg:'potassium',selenium_ug:'sélénium',
    vitamin_b1_mg:'vitamine B1',vitamin_b2_mg:'vitamine B2',vitamin_b3_mg:'vitamine B3',vitamin_b6_mg:'vitamine B6',vitamin_b9_ug:'vitamine B9',vitamin_b12_ug:'vitamine B12',vitamin_c_mg:'vitamine C',vitamin_d_ug:'vitamine D',vitamin_e_mg:'vitamine E',omega3_g:'oméga-3'
  };
  const CHECKIN_ACTIONS=[
    ['source_added','Ajouté une source'],['portion_reinforced','Renforcé une portion'],['meal_adapted','Adapté un repas'],['prepared_ahead','Préparé à l’avance'],['other','Autre']
  ];
  const CHECKIN_DIFFICULTY=[['easy','Facile'],['okay','Correct'],['hard','Difficile']];

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function n(v){const x=Number(v);return Number.isFinite(x)?x:null;}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function fmt(v,d=0){const x=n(v);return x===null?'—':x.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});}
  function localDate(){const d=new Date(),p=v=>String(v).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;}
  function client(){try{return typeof initSupabase==='function'?initSupabase():window.supabaseClient||null;}catch(_){return null;}}
  function focusFromDecision(decision){return FOCUS_BY_DECISION[String(decision?.key||'')]||null;}
  function minuteOfDay(at=new Date()){return at.getHours()*60+at.getMinutes();}
  function learnedRhythm(rhythm,at=new Date()){
    const documented=Math.max(0,Number(rhythm?.documented_days)||0),rawFirst=n(rhythm?.median_first_minute),rawLast=n(rhythm?.median_last_minute);
    const learned=documented>=3&&rawFirst!==null&&rawLast!==null&&rawLast>rawFirst&&(rawLast-rawFirst)>=180&&(rawLast-rawFirst)<=1080;
    const first=learned?rawFirst:8*60,last=learned?rawLast:20*60,span=Math.max(180,last-first),mins=minuteOfDay(at);
    const progress=clamp((mins-first)/span,0,1),lateMinute=first+span*.68,veryLateMinute=first+span*.88;
    const phase=mins<first?'before':progress<.34?'early':progress<.68?'middle':progress<.88?'late':'closing';
    return {learned,documented,first,last,span,mins,progress,lateMinute,veryLateMinute,phase};
  }
  function nextMealContext(rhythm){
    const order=['breakfast','lunch','snack','dinner'],types=Array.isArray(rhythm?.today_meal_types)?rhythm.today_meal_types.map(x=>String(x||'').toLowerCase()):[];
    const idx=types.reduce((m,t)=>Math.max(m,order.indexOf(t)),-1);
    return idx>=0&&idx<order.length-1?order[idx+1]:idx===order.length-1?'dinner':null;
  }
  function currentMealContext(rhythm=null){return nextMealContext(rhythm);}
  function labelForFocus(f){return FOCUS_LABELS[f]||'ce repère';}

  function injectCSS(){if(document.getElementById('mtFoodGuidanceCSS'))return;const s=document.createElement('style');s.id='mtFoodGuidanceCSS';s.textContent=`
    .mt-food-guide{margin:16px 0 4px;padding:18px;border-radius:22px;background:#edf4f1;border:1px solid #dbe8e2;color:#164b3f}
    .mt-food-guide-kicker{font-size:11px;font-weight:850;letter-spacing:.15em;text-transform:uppercase;color:#a77f35;margin-bottom:6px}
    .mt-food-guide h3{font-family:Georgia,serif;font-size:24px;line-height:1.08;font-weight:400;margin:0 0 8px;color:#164b3f}
    .mt-food-guide>p{margin:0 0 13px;line-height:1.55;color:#315c52;font-size:14px}
    .mt-food-guide-gesture{padding:12px 13px;border-radius:15px;background:#fffaf2;border:1px solid #eadfc9;margin:0 0 13px;font-size:13px;line-height:1.5;color:#695e55}.mt-food-guide-gesture b{display:block;color:#164b3f;margin-bottom:3px}
    .mt-food-guide-options{display:grid;gap:9px}.mt-food-guide-option{background:#fffdf8;border:1px solid #e5dac7;border-radius:16px;padding:12px 13px}.mt-food-guide-option-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.mt-food-guide-option b{color:#164b3f;line-height:1.25}.mt-food-guide-option small{display:block;color:#88796c;margin-top:3px;line-height:1.35}.mt-food-guide-chip{flex:0 0 auto;font-size:10px;font-weight:800;color:#9b762f;background:#f6ecd6;border-radius:99px;padding:5px 7px}.mt-food-guide-metrics{font-size:12px;color:#315c52;margin-top:8px}.mt-food-guide-pick{margin-top:9px;border:0;background:transparent;color:#164b3f;font-weight:800;padding:0;font-size:12px}.mt-food-guide-pick.is-picked{color:#9b762f}
    .mt-food-guide-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:13px}.mt-food-guide-btn{border:1px solid #cdbb94;background:#fffaf2;color:#164b3f;border-radius:999px;padding:12px 14px;font-weight:850;font-size:13px}.mt-food-guide-btn.primary{background:#164b3f;border-color:#164b3f;color:white}.mt-food-guide-alt{border:0;background:transparent;color:#75685d;font-weight:750;padding:8px 4px;font-size:12px}
    .mt-food-guide-note{font-size:11px!important;color:#8b7c70!important;margin:11px 0 0!important;line-height:1.45!important}
    .mt-exp-checkin-panel{margin:12px 0 2px;padding:15px;border-radius:18px;background:#f6f0e5;border:1px solid #e4d5ba}.mt-exp-checkin-panel b{display:block;color:#164b3f;margin-bottom:9px}.mt-exp-checkin-grid{display:flex;flex-wrap:wrap;gap:7px}.mt-exp-checkin-choice{border:1px solid #d6c6a9;background:#fffaf2;color:#164b3f;border-radius:99px;padding:9px 11px;font-weight:750;font-size:12px}.mt-exp-checkin-choice.is-selected{background:#164b3f;color:white;border-color:#164b3f}.mt-exp-checkin-step{margin-top:12px}.mt-exp-checkin-saved{color:#164b3f;font-weight:850}
  `;document.head.appendChild(s);}

  async function rpc(name,args){const sb=client();if(!sb)throw new Error('Connexion indisponible.');const {data,error}=await sb.rpc(name,args||{});if(error)throw error;return data;}
  async function fetchGuidance(focus,date,mealContext){
    const key=`${focus}|${date}|${mealContext||'neutral'}`,cached=CACHE.get(key);if(cached&&Date.now()-cached.at<TTL)return cached.data;
    const data=await rpc('mt_food_guidance_v1',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});
    CACHE.set(key,{at:Date.now(),data});return data;
  }
  async function loadRhythm(date=localDate()){return fetchGuidance('protein',date,null);}
  async function load(focus,opts={}){
    const date=opts.date||localDate();
    if(opts.mealContext)return fetchGuidance(focus,date,opts.mealContext);
    const neutral=await fetchGuidance(focus,date,null),mealContext=currentMealContext(neutral?.rhythm);
    // Avant le premier repas documenté, Tee ne devine pas arbitrairement
    // « petit-déjeuner / déjeuner ». Les options restent génériques.
    if(!mealContext)return neutral;
    return fetchGuidance(focus,date,mealContext);
  }
  async function log(eventType,focus,candidate=null,extra={}){
    try{return await rpc('mt_food_guidance_event_v1',{
      p_event_type:eventType,p_focus:focus,p_candidate_ref:candidate?.candidate_ref||null,p_candidate_name:candidate?.name||null,p_meal_context:extra.mealContext||currentMealContext(),p_payload:extra.payload||{}
    });}catch(_){return null;}
  }

  function modelNumbers(model,focus){
    const today=model?.nutritionContext?.today||{},recent=model?.nutritionContext?.recent||{};
    if(focus==='protein')return {current:n(today.protein_g),recent:n(recent.protein_g),low:n(model?.protein?.low),high:n(model?.protein?.high),unit:'g'};
    if(focus==='fiber')return {current:n(today.fiber_g),recent:n(recent.fiber_g),low:n(model?.fiber?.low),high:n(model?.fiber?.high),unit:'g'};
    if(focus==='energy')return {current:n(today.kcal),recent:n(recent.kcal),low:n(model?.energy?.low),high:n(model?.energy?.high),unit:'kcal'};
    return {current:null,recent:null,low:null,high:null,unit:''};
  }

  function pacingState(model,payload,focus,at=new Date()){
    const x=modelNumbers(model,focus),rhythm=payload?.rhythm||{},day=learnedRhythm(rhythm,at);
    const expected=Math.max(1,Number(rhythm.expected_daily_meals)||3),logged=Math.max(0,Number(rhythm.today_logged_meals)||0);
    const low=x.low,cur=x.current,gap=cur!==null&&low!==null?Math.max(0,low-cur):null;
    const progress=cur!==null&&low>0?clamp(cur/low,0,1.4):null;
    const mealProgress=clamp(logged/expected,0,1),timeProgress=day.progress;
    // Avec un rythme appris, l'heure pèse réellement. Sans historique suffisant,
    // Tee s'appuie surtout sur les repas déjà renseignés et reste prudente avec l'horloge.
    const trajectory=day.learned?Math.max(mealProgress*.82,timeProgress*.66):Math.max(mealProgress*.86,timeProgress*.30);
    const behind=progress!==null&&gap>0&&trajectory>=.25&&progress+0.16<trajectory;
    const late=day.mins>=day.lateMinute,veryLate=day.mins>=day.veryLateMinute;
    const urgency=gap===null||gap<=0?'covered':behind&&late?'high':behind?'medium':late&&progress!==null&&progress<.55?'medium':'low';
    const remainingMeals=Math.max(0,expected-logged);
    return {focus,current:cur,recent:x.recent,low,high:x.high,unit:x.unit,gap,progress,first:day.first,last:day.last,expectedMeals:expected,loggedMeals:logged,remainingMeals,timeProgress,mealProgress,trajectory,behind,late,veryLate,urgency,phase:day.phase,rhythmLearned:day.learned,lateMinute:day.lateMinute,veryLateMinute:day.veryLateMinute};
  }

  function selectPacingDecision(model,rawDecision=null,payload=null,at=new Date()){
    if(payload instanceof Date){at=payload;payload=null;}
    const days=Number(model?.nutritionDays)||0,day=learnedRhythm(payload?.rhythm||{},at),defs=[
      {focus:'protein',key:'protein',title:'Protéines',unit:'g',today:model?.nutritionContext?.today?.protein_g,recent:model?.nutritionContext?.recent?.protein_g,low:model?.protein?.low},
      {focus:'fiber',key:'density',title:'Fibres',unit:'g',today:model?.nutritionContext?.today?.fiber_g,recent:model?.nutritionContext?.recent?.fiber_g,low:model?.fiber?.low},
      {focus:'energy',key:'energy_review',title:'Énergie',unit:'kcal',today:model?.nutritionContext?.today?.kcal,recent:model?.nutritionContext?.recent?.kcal,low:model?.energy?.low}
    ],rows=[];
    for(const d of defs){
      const low=n(d.low),recent=n(d.recent),cur=n(d.today);if(!low||low<=0)continue;
      const recentGap=days>=3&&recent!==null?clamp((low-recent)/low,0,1):0;
      const todayGap=cur!==null?clamp((low-cur)/low,0,1):0;
      const hasSignal=recentGap>=.08||(day.progress>=.20&&cur!==null&&todayGap>=.12);
      if(!hasSignal)continue;
      const dayWeight=.22+(.78*day.progress);
      const score=Math.max(recentGap,todayGap*dayWeight)+(day.progress>=.68&&todayGap>.4?.12:0);
      rows.push({...d,score,recentGap,todayGap});
    }
    rows.sort((a,b)=>b.score-a.score);
    const best=rows[0];
    if(!best){
      if(['protein','density','energy_review'].includes(String(rawDecision?.key||'')))return rawDecision;
      return null;
    }
    const reasons=[];
    if(n(best.today)!==null)reasons.push(`Aujourd’hui : ${fmt(best.today,best.focus==='energy'?0:1)} ${best.unit} documentés`);
    if(n(best.recent)!==null)reasons.push(`Moyenne récente : ${fmt(best.recent,best.focus==='energy'?0:1)} ${best.unit}`);
    reasons.push(`Bas de ton repère actuel : ${fmt(best.low,best.focus==='energy'?0:1)} ${best.unit}`);
    const action=['before','early'].includes(day.phase)
      ?`Aujourd’hui, Tee t’aide à placer une partie de ce repère dans tes premiers repas, en utilisant d’abord des options compatibles avec tes habitudes.`
      :['middle','late'].includes(day.phase)
        ?`Tee vérifie ce qu’il reste à répartir selon ton rythme habituel et te propose une option maintenant plutôt que de laisser l’essentiel au dernier repas.`
        :`À ce stade, Tee ne cherche plus à tout rattraper : elle te propose seulement ce qui reste raisonnable à compléter dans ton dernier moment alimentaire.`;
    const decisionTitle=['before','early'].includes(day.phase)
      ?`Répartir ${best.title.toLowerCase()} plus tôt`
      :['middle','late'].includes(day.phase)
        ?`Mieux répartir ${best.title.toLowerCase()} aujourd’hui`
        :`Compléter ${best.title.toLowerCase()} sans rattraper`;
    return {key:best.key,title:decisionTitle,summary:`${best.title} ressort comme le levier nutritionnel le plus utile à travailler aujourd’hui à partir de tes données documentées.`,action,reasons,_pacingFocus:best.focus,_pacingScore:best.score};
  }

  function pacingCopy(model,payload,focus){
    const x=modelNumbers(model,focus),label=labelForFocus(focus),state=pacingState(model,payload,focus),gap=state.gap;
    if(gap!==null&&gap<=0)return `Ton repère bas de ${label} est déjà couvert par ce qui est documenté aujourd’hui. Tee ne cherche pas à ajouter pour ajouter.`;
    if(gap!==null){
      const amount=`${fmt(gap,focus==='energy'?0:1)} ${x.unit}`;
      if(state.phase==='closing'||state.veryLate)return `Il reste environ ${amount} pour te rapprocher de ton repère bas. À ce stade, inutile de chercher à tout rattraper : si tu manges encore, Tee te propose seulement une option raisonnable pour renforcer ton dernier repas.`;
      if(state.phase==='late'&&state.remainingMeals<=1)return `Il reste environ ${amount} pour te rapprocher de ton repère bas. Comme tu approches de ton dernier repas habituel, Tee vise seulement une contribution raisonnable plutôt qu’un rattrapage complet.`;
      if(state.urgency==='high')return `Il reste environ ${amount} pour te rapprocher de ton repère bas, et une grosse part risque sinon de rester au dernier repas. Tee te propose d’en placer une partie maintenant.`;
      if(state.urgency==='medium')return `Il reste environ ${amount} pour te rapprocher de ton repère bas. Le plus simple est d’en placer une partie dans ton prochain repas ou ta prochaine collation.`;
      if(['before','early'].includes(state.phase))return `Il reste environ ${amount} pour te rapprocher de ton repère bas. Tee te propose de commencer à le répartir dans tes premiers moments alimentaires, sans changer toute ta journée.`;
      return `Il reste environ ${amount} sur la journée documentée. Tee te propose une option raisonnable maintenant, sans transformer le dîner en repas de rattrapage.`;
    }
    if(x.recent!==null&&x.low!==null&&x.recent<x.low)return `Sur tes journées récentes, les ${label} restent souvent sous ton repère actuel. Tee te propose des options concrètes proches de tes habitudes.`;
    return `Tee cherche dans ta bibliothèque et dans tes habitudes des options compatibles avec ton repère actuel, sans inventer ce qui n’est pas documenté.`;
  }

  function experimentGesture(decision,focus){
    const day=clamp(Number(decision?.cycle?.day)||1,1,7),noun=focus==='protein'?'protéines':focus==='fiber'?'fibres':'énergie';
    const specific={
      protein:[
        'Ajoute une source protéique à ton repas principal le moins structuré.',
        'Place une partie de tes protéines plus tôt dans la journée au lieu de les concentrer au dîner.',
        'Choisis aujourd’hui une option protéinée déjà familière : on teste la facilité, pas la nouveauté.',
        'Renforce ou adapte un repas que tu aurais mangé de toute façon, plutôt que d’ajouter un repas entier.',
        'Observe surtout satiété, digestion et récupération après cette meilleure répartition.',
        'Répète l’option qui t’a semblé la plus simple ces derniers jours, sans multiplier les changements.',
        'Garde le même levier et compare : atteinte du repère, facilité, satiété et ressenti global.'
      ],
      fiber:[
        'Ajoute une source de fibres tolérée dans un repas déjà prévu.',
        'Répartis les fibres sur plusieurs moments plutôt que de tout concentrer le soir.',
        'Choisis une source familière et bien tolérée aujourd’hui.',
        'Adapte un repas existant avec une option végétale ou céréalière cohérente.',
        'Observe surtout satiété et confort digestif, sans forcer la quantité.',
        'Répète la source ou la répartition qui t’a semblé la plus confortable.',
        'Compare tes 7 jours : facilité, confort digestif et quantité réellement documentée.'
      ],
      energy:[
        'Place une vraie part de ton énergie plus tôt dans la journée, dans un repas que tu prends déjà.',
        'Évite de laisser l’essentiel à récupérer le soir : renforce plutôt ton prochain repas.',
        'Choisis une option familière qui apporte de l’énergie sans bouleverser tes habitudes.',
        'Adapte un repas existant au lieu d’ajouter au hasard en fin de journée.',
        'Observe faim, énergie et confort après une répartition plus régulière.',
        'Répète la répartition qui t’a semblé la plus naturelle.',
        'Compare tes 7 jours : facilité à couvrir ton repère et ressenti dans la journée.'
      ]
    };
    return {day,text:(specific[focus]||specific.energy)[day-1],noun};
  }

  function metricLine(c,focus){
    const bits=[];
    if(focus==='protein'&&n(c.protein_g)>0)bits.push(`+${fmt(c.protein_g,1)} g protéines`);
    else if(focus==='fiber'&&n(c.fiber_g)>0)bits.push(`+${fmt(c.fiber_g,1)} g fibres`);
    else if(focus==='energy'&&n(c.kcal)>0)bits.push(`+${fmt(c.kcal,0)} kcal`);
    else if(n(c.focus_amount)>0)bits.push(`+${fmt(c.focus_amount,n(c.focus_amount)<10?2:1)} ${esc(c.focus_unit||'')} ${labelForFocus(focus)}`);
    if(focus!=='protein'&&n(c.protein_g)>=10)bits.push(`${fmt(c.protein_g,1)} g prot.`);
    if(focus!=='fiber'&&n(c.fiber_g)>=3)bits.push(`${fmt(c.fiber_g,1)} g fibres`);
    if(focus!=='energy'&&n(c.kcal)>=80)bits.push(`${fmt(c.kcal,0)} kcal`);
    return bits.slice(0,3).join(' · ');
  }

  function portionLabel(c){const g=n(c.portion_g);if(!g)return '';return `${fmt(g,0)} g${c.portion_source==='habitual'?' · ta portion habituelle':''}`;}
  function normText(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function looksSmallQuantity(c){
    if(String(c?.guidance_role||'')==='small_quantity')return true;
    const t=normText(c?.name);
    return /(^| )(gousse de vanille|extrait de vanille|vanille en poudre|persil|coriandre|basilic|ciboulette|thym|romarin|menthe|aneth|origan|epice|cannelle|curcuma|poivre|huile|beurre|margarine|mayonnaise|ketchup|moutarde|vinaigrette|condiment|sirop)( |$)/.test(t);
  }
  function looksCommercialGuidanceExcluded(c){
    const t=normText(c?.name);
    return /(^| )(mcdonald|mcdonalds|mcdo|big mac|mcwrap|mcdeal|mcflurry|mcnugget|mcnuggets|burger king|quick|kfc|kentucky fried|five guys|o tacos|otacos)( |$)/.test(t);
  }
  function candidateMemoryTier(c){
    if(c?.rotation_due)return 3;
    if(c?.familiar||c?.source_kind==='scanned')return 0;
    if((n(c?.memory_affinity_score)||0)>=3||c?.culture_familiar)return 1;
    return 2;
  }
  function focusValue(c,focus){
    if(focus==='protein')return n(c?.protein_g)||0;if(focus==='fiber')return n(c?.fiber_g)||0;if(focus==='energy')return n(c?.kcal)||0;
    return n(c?.focus_amount)||0;
  }
  function contextualCandidateScore(c,model,focus,state){
    let score=(n(c?.score)||0)*.35;
    const amount=focusValue(c,focus),gap=state?.gap,phase=state?.phase||'middle',role=String(c?.guidance_role||'food');
    const remaining=Math.max(1,Number(state?.remainingMeals)||1),baseShare=phase==='closing'?.42:phase==='late'?.58:phase==='middle'?.50:.38;
    const share=clamp(Math.max(baseShare,1/remaining*.72),.30,.68),target=gap!==null&&gap>0?Math.max(focus==='energy'?180:focus==='protein'?8:focus==='fiber'?3:.1,gap*share):Math.max(amount,1);
    const ratio=Math.max(.05,amount/Math.max(target,.05));
    score-=Math.abs(Math.log(ratio))*24;
    if(gap!==null&&gap>0&&amount>gap*1.15)score-=18+Math.min(30,(amount/gap-1.15)*22);
    if(c?.familiar&&!c?.rotation_due)score+=28;
    if(c?.source_kind==='scanned')score+=18;
    if(c?.meal_context_fit)score+=6;
    if(c?.culture_familiar)score+=8;
    score+=Math.min(15,n(c?.memory_affinity_score)||0);
    if(c?.rotation_due)score-=24;
    if(role==='meal')score+=phase==='middle'||phase==='late'?3:-2;
    const kcal=n(c?.kcal)||0,energy=modelNumbers(model,'energy'),energyGap=energy.current!==null&&energy.low!==null?Math.max(0,energy.low-energy.current):null;
    if(focus!=='energy'){
      if(energyGap!==null&&energyGap<=0)score-=Math.min(28,kcal/28);
      else if(energyGap!==null&&energyGap>0){
        const eRatio=kcal/Math.max(energyGap,1);
        if(eRatio<=.45)score+=7;else if(eRatio>.85)score-=phase==='closing'?24:12;
      }
      if(kcal>700)score-=Math.min(34,(kcal-700)/18);
    }
    if(role==='meal'&&!c?.familiar&&!c?.culture_familiar&&n(c?.memory_affinity_score)<=0)score-=12;
    return score;
  }
  function candidateAllowed(c,model,focus,state){
    if(!c||focusValue(c,focus)<=0||looksSmallQuantity(c)||looksCommercialGuidanceExcluded(c))return false;
    const kcal=n(c.kcal)||0,role=String(c.guidance_role||'food'),familiar=!!c.familiar||c.source_kind==='scanned';
    if(focus!=='energy'){
      if(kcal>1400)return false;
      if(state?.phase==='closing'&&kcal>850&&!familiar)return false;
      if(state?.phase==='closing'&&role==='meal'&&kcal>950)return false;
      const energy=modelNumbers(model,'energy'),energyGap=energy.current!==null&&energy.low!==null?Math.max(0,energy.low-energy.current):null;
      if(energyGap!==null&&energyGap<350&&kcal>650&&!familiar)return false;
    }
    return true;
  }
  function sortedCandidates(payload,model,focus,state=null){
    const all=Array.isArray(payload?.candidates)?payload.candidates:[],pace=state||pacingState(model,payload,focus);
    return all.filter(c=>candidateAllowed(c,model,focus,pace)).map(c=>({c,fit:contextualCandidateScore(c,model,focus,pace),tier:candidateMemoryTier(c)})).sort((a,b)=>a.tier-b.tier||b.fit-a.fit||((n(b.c.focus_amount)||0)-(n(a.c.focus_amount)||0))).map(x=>x.c);
  }

  function candidateHTML(c,focus,index,state){
    const familiar=c.familiar&&!c.rotation_due,role=String(c.guidance_role||'food'),affinity=(n(c?.memory_affinity_score)||0)>=3||c.culture_familiar,chip=familiar?'Dans tes habitudes':c.source_kind==='scanned'&&!c.rotation_due?'Déjà utilisé':c.rotation_due?'À varier':affinity?'Proche de tes habitudes':role==='meal'?'Plat complet':'Option TEE';
    const pickLabel=['before','early'].includes(state?.phase)?'Je prévois ça':state?.phase==='closing'?'Pour mon dernier repas':'Ça me convient';
    return `<div class="mt-food-guide-option" data-mt-guide-candidate="${index}"><div class="mt-food-guide-option-top"><div><b>${esc(c.name||'Option')}</b><small>${esc(portionLabel(c))}</small></div><span class="mt-food-guide-chip">${esc(chip)}</span></div><div class="mt-food-guide-metrics">${metricLine(c,focus)}</div><button class="mt-food-guide-pick" type="button" data-mt-guide-pick="${index}">${esc(pickLabel)}</button></div>`;
  }

  function renderHost(host,{model,decision,payload,experience=false,start=0}){
    if(!host)return;injectCSS();const focus=focusFromDecision(decision);if(!focus){host.innerHTML='';return;}
    const state=pacingState(model,payload,focus),candidates=sortedCandidates(payload,model,focus,state),visible=candidates.slice(start,start+3),preparing=['before','early'].includes(state.phase);
    const gesture=experience?experimentGesture(decision,focus):null;
    host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">${preparing?'À prévoir aujourd’hui':'Concrètement maintenant'}</div><h3>${preparing?'Tee prépare ta journée.':'Tee transforme ce repère en options.'}</h3><p>${esc(pacingCopy(model,payload,focus))}</p>${gesture?`<div class="mt-food-guide-gesture"><b>Jour ${gesture.day}/7 · le geste d’aujourd’hui</b>${esc(gesture.text)}</div>`:''}${visible.length?`<div class="mt-food-guide-options">${visible.map((c,i)=>candidateHTML(c,focus,start+i,state)).join('')}</div>`:`<div class="mt-food-guide-gesture"><b>Bibliothèque en cours de lecture</b>Aucune option assez solide n’est proposée pour l’instant. Tee préfère ne rien inventer.</div>`}<div class="mt-food-guide-actions"><button type="button" class="mt-food-guide-btn" data-mt-guide-more>Voir mes options pour aujourd’hui</button><button type="button" class="mt-food-guide-btn primary" data-mt-guide-adapter>Adapter mon prochain repas</button>${candidates.length>3?'<button type="button" class="mt-food-guide-alt" data-mt-guide-alt>Propose-moi autre chose</button>':''}</div><p class="mt-food-guide-note">Les propositions utilisent uniquement les valeurs nutritionnelles disponibles. Une valeur micronutritionnelle absente reste « non documentée » : elle n’est jamais interprétée comme une carence.</p></section>`;

    host.querySelectorAll('[data-mt-guide-pick]').forEach(btn=>btn.addEventListener('click',async()=>{
      const idx=Number(btn.dataset.mtGuidePick),c=candidates[idx];if(!c)return;btn.disabled=true;await log('chosen',focus,c,{payload:{portion_g:c.portion_g,focus_amount:c.focus_amount}});btn.classList.add('is-picked');btn.textContent='✓ Prévu aujourd’hui';
    }));
    host.querySelector('[data-mt-guide-more]')?.addEventListener('click',()=>{
      const section=host.querySelector('.mt-food-guide-options');if(!section)return;
      section.innerHTML=candidates.slice(0,Math.min(9,candidates.length)).map((c,i)=>candidateHTML(c,focus,i,state)).join('');
      section.querySelectorAll('[data-mt-guide-pick]').forEach(btn=>btn.addEventListener('click',async()=>{const idx=Number(btn.dataset.mtGuidePick),c=candidates[idx];if(!c)return;btn.disabled=true;await log('chosen',focus,c,{payload:{portion_g:c.portion_g,focus_amount:c.focus_amount}});btn.classList.add('is-picked');btn.textContent='✓ Prévu aujourd’hui';}));
      host.querySelector('[data-mt-guide-more]')?.remove();
    });
    host.querySelector('[data-mt-guide-alt]')?.addEventListener('click',async()=>{
      await log('alternative',focus,null,{payload:{start}});const next=(start+3)>=candidates.length?0:start+3;renderHost(host,{model,decision,payload,experience,start:next});
    });
    host.querySelector('[data-mt-guide-adapter]')?.addEventListener('click',async()=>{
      await log('adapter_opened',focus,null,{payload:{source:'home_guidance'}});try{sessionStorage.setItem('mt_food_guidance_focus_v1',focus);}catch(_){}location.href=`food-adapter.html?source=tee-guidance&focus=${encodeURIComponent(focus)}`;
    });
  }

  async function mount(opts={}){
    const host=typeof opts.host==='string'?document.querySelector(opts.host):(opts.host||document.getElementById('mtFoodGuidanceHost'));
    const focus=focusFromDecision(opts.decision);if(!host||!focus)return null;
    injectCSS();host.innerHTML='<div class="mt-food-guide"><div class="mt-food-guide-kicker">Méthode TEE</div><p>Je cherche les options les plus cohérentes avec ta bibliothèque et tes habitudes…</p></div>';
    try{
      const payload=await load(focus,{mealContext:opts.mealContext||null,date:opts.date||localDate()});
      const first=sortedCandidates(payload,opts.model,focus).slice(0,3);first.forEach(c=>log('shown',focus,c,{payload:{placement:opts.experience?'experience':'reference'}}));
      renderHost(host,{model:opts.model,decision:opts.decision,payload,experience:!!opts.experience,start:0});return payload;
    }catch(e){
      host.innerHTML='<div class="mt-food-guide"><div class="mt-food-guide-kicker">Concrètement aujourd’hui</div><p>La bibliothèque personnalisée n’est pas encore installée sur ce compte. Le repère reste visible, mais Tee ne fabrique pas d’option alimentaire de secours.</p></div>';console.warn('[TEE guidance]',e);return null;
    }
  }

  function bindExperimentCheckin(opts={}){
    const button=typeof opts.button==='string'?document.querySelector(opts.button):opts.button;if(!button||!opts.decision?.cycle?.startedOn)return;
    injectCSS();button.addEventListener('click',()=>{
      if(document.getElementById('mtExperimentCheckinPanel'))return;
      button.hidden=true;let action=null;
      const panel=document.createElement('div');panel.id='mtExperimentCheckinPanel';panel.className='mt-exp-checkin-panel';panel.innerHTML=`<b>Qu’as-tu fait aujourd’hui ?</b><div class="mt-exp-checkin-grid">${CHECKIN_ACTIONS.map(([k,l])=>`<button type="button" class="mt-exp-checkin-choice" data-mt-ci-action="${k}">${esc(l)}</button>`).join('')}</div><div class="mt-exp-checkin-step" data-mt-ci-difficulty hidden><b>Ça t’a semblé :</b><div class="mt-exp-checkin-grid">${CHECKIN_DIFFICULTY.map(([k,l])=>`<button type="button" class="mt-exp-checkin-choice" data-mt-ci-diff="${k}">${esc(l)}</button>`).join('')}</div></div>`;
      button.insertAdjacentElement('afterend',panel);
      panel.querySelectorAll('[data-mt-ci-action]').forEach(b=>b.addEventListener('click',()=>{
        action=b.dataset.mtCiAction;panel.querySelectorAll('[data-mt-ci-action]').forEach(x=>x.classList.toggle('is-selected',x===b));panel.querySelector('[data-mt-ci-difficulty]').hidden=false;
      }));
      panel.querySelectorAll('[data-mt-ci-diff]').forEach(b=>b.addEventListener('click',async()=>{
        if(!action)return;panel.querySelectorAll('button').forEach(x=>x.disabled=true);b.classList.add('is-selected');
        const args={p_cycle_started_on:opts.decision.cycle.startedOn,p_lever_key:opts.decision.key,p_applied:true,p_action_kind:action,p_difficulty:b.dataset.mtCiDiff,p_detail:{focus:focusFromDecision(opts.decision),day:Number(opts.decision?.cycle?.day)||1}};
        try{
          let ok=false;try{await rpc('mt_adaptive_cycle_checkin_v2',args);ok=true;}catch(_){await rpc('mt_adaptive_cycle_checkin',{p_cycle_started_on:opts.decision.cycle.startedOn,p_lever_key:opts.decision.key,p_applied:true});ok=true;}
          if(ok){panel.innerHTML='<div class="mt-exp-checkin-saved">✓ Repère appliqué aujourd’hui</div>';button.textContent='✓ Repère appliqué aujourd’hui';window.MTReference?.invalidate?.();}
        }catch(_){panel.querySelectorAll('button').forEach(x=>x.disabled=false);window.mtToast?.('Impossible d’enregistrer pour le moment.','error');}
      }));
    },{once:true});
  }

  window.MTFoodGuidance={load,loadRhythm,mount,log,focusFromDecision,experimentGesture,bindExperimentCheckin,modelNumbers,pacingState,selectPacingDecision,learnedRhythm,currentMealContext,rankCandidates:sortedCandidates,pacingCopy};
})();
