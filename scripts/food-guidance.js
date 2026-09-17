/* MÉTHODE TEE · V4896609 · tranches horaires repas + petits renforts cumulatif
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
  function guidanceMinuteOfDay(at=new Date()){const mins=minuteOfDay(at);return at.getHours()<7?mins+1440:mins;}
  function learnedRhythm(rhythm,at=new Date()){
    const documented=Math.max(0,Number(rhythm?.documented_days)||0),rawFirst=n(rhythm?.median_first_minute),rawLast=n(rhythm?.median_last_minute);
    const learned=documented>=3&&rawFirst!==null&&rawLast!==null&&rawLast>rawFirst&&(rawLast-rawFirst)>=180&&(rawLast-rawFirst)<=1080;
    const first=learned?rawFirst:8*60,last=learned?rawLast:20*60,span=Math.max(180,last-first),mins=guidanceMinuteOfDay(at);
    const progress=clamp((mins-first)/span,0,1),lateMinute=first+span*.68,veryLateMinute=first+span*.88;
    const phase=mins<first?'before':progress<.34?'early':progress<.68?'middle':progress<.88?'late':'closing';
    return {learned,documented,first,last,span,mins,progress,lateMinute,veryLateMinute,phase};
  }
  const MEAL_CONTEXT_ORDER=['breakfast','lunch','snack','dinner'];
  const FIXED_MEAL_WINDOWS=[
    {context:'breakfast',start:7*60,end:11*60,phase:'early',label:'matin'},
    {context:'lunch',start:11*60,end:15*60,phase:'middle',label:'déjeuner'},
    {context:'snack',start:15*60,end:18*60,phase:'middle',label:'collation'},
    {context:'dinner',start:18*60,end:23*60,phase:'late',label:'dîner'}
  ];
  function fixedMealWindow(at=new Date()){
    const mins=minuteOfDay(at),row=FIXED_MEAL_WINDOWS.find(x=>mins>=x.start&&mins<x.end);
    if(row)return {...row,closing:false,minute:mins};
    return {context:null,start:23*60,end:7*60,phase:'closing',label:'fin de journée',closing:true,minute:mins};
  }
  function mealContextIndex(v){return MEAL_CONTEXT_ORDER.indexOf(String(v||'').toLowerCase());}
  function loggedMealTypes(rhythm){return Array.isArray(rhythm?.today_meal_types)?rhythm.today_meal_types.map(x=>String(x||'').toLowerCase()).filter(x=>mealContextIndex(x)>=0):[];}
  function learnedMealSchedule(rhythm){
    const timing=rhythm?.meal_context_timing&&typeof rhythm.meal_context_timing==='object'?rhythm.meal_context_timing:{},documented=Math.max(0,Number(rhythm?.documented_days)||0);
    const minDays=Math.max(3,Math.ceil(documented*.18)),rows=[];
    for(const context of MEAL_CONTEXT_ORDER){
      const x=timing?.[context]||{},minute=n(x?.median_minute),days=Math.max(0,Number(x?.days)||Number(x?.day_count)||0),count=Math.max(0,Number(x?.count)||days);
      const enough=minute!==null&&minute>=0&&minute<1440&&days>=3&&(documented<8||days>=minDays);
      if(enough)rows.push({context,minute,days,count,source:'learned'});
    }
    if(rows.length>=2)return {learned:true,source:'meal_history',rows:rows.sort((a,b)=>a.minute-b.minute)};
    const day=learnedRhythm(rhythm),expected=Math.max(1,Number(rhythm?.expected_daily_meals)||3),first=day.first,last=day.last,span=Math.max(180,last-first);
    let fallback;
    if(day.learned&&expected<=2)fallback=[{context:'lunch',minute:first},{context:'dinner',minute:last}];
    else if(day.learned&&expected===3)fallback=[{context:'breakfast',minute:first},{context:'lunch',minute:Math.round(first+span*.48)},{context:'dinner',minute:last}];
    else if(day.learned)fallback=[{context:'breakfast',minute:first},{context:'lunch',minute:Math.round(first+span*.36)},{context:'snack',minute:Math.round(first+span*.64)},{context:'dinner',minute:last}];
    else fallback=[{context:'breakfast',minute:8*60+30},{context:'lunch',minute:12*60+30},{context:'snack',minute:16*60+30},{context:'dinner',minute:20*60}];
    return {learned:false,source:day.learned?'rhythm_fallback':'default_fallback',rows:fallback.map(x=>({...x,days:0,count:0,source:day.learned?'rhythm_fallback':'default_fallback'}))};
  }
  function contextFromClock(schedule,at=new Date()){
    const rows=Array.isArray(schedule?.rows)?schedule.rows.slice().sort((a,b)=>a.minute-b.minute):[];if(!rows.length)return null;
    const mins=guidanceMinuteOfDay(at);
    if(mins<=rows[0].minute)return rows[0].context;
    for(let i=0;i<rows.length-1;i++){const boundary=(rows[i].minute+rows[i+1].minute)/2;if(mins<boundary)return rows[i].context;}
    return rows[rows.length-1].context;
  }
  function mealContextDecision(rhythm=null,at=new Date()){
    const schedule=learnedMealSchedule(rhythm||{}),slot=fixedMealWindow(at),types=loggedMealTypes(rhythm||{});
    const currentAlreadyLogged=!!slot.context&&types.includes(slot.context);
    return {
      context:slot.closing||currentAlreadyLogged?null:slot.context,
      clockContext:slot.context||null,
      nextAfterLogged:null,
      loggedTypes:types,
      currentAlreadyLogged,
      fixedWindow:slot,
      scheduleSource:schedule.source,
      scheduleLearned:!!schedule.learned,
      scheduleRows:schedule.rows||[]
    };
  }
  function nextMealContext(rhythm,at=new Date()){return mealContextDecision(rhythm,at).context;}
  function currentMealContext(rhythm=null,at=new Date()){return nextMealContext(rhythm,at);}
  function contextHabitStats(rhythm,context){
    const timing=rhythm?.meal_context_timing&&typeof rhythm.meal_context_timing==='object'?rhythm.meal_context_timing:{};
    const x=timing?.[context]||{},observed=Math.max(0,Number(rhythm?.meal_context_observed_days_42)||Number(rhythm?.documented_days)||0);
    const days=Math.max(0,Number(x?.days)||Number(x?.day_count)||0),ratio=observed>0?days/observed:null;
    return {observed,days,ratio,usual:observed>=7?ratio>=.35:days>=3,usuallyAbsent:observed>=7&&ratio<=.25};
  }
  function knownContextMinute(rhythm,context){
    const x=rhythm?.meal_context_timing?.[context]||{},m=n(x?.median_minute);
    if(m!==null&&m>=0&&m<1440)return m;
    const row=(learnedMealSchedule(rhythm||{}).rows||[]).find(r=>r.context===context);
    return row?Number(row.minute):null;
  }
  function skippedMomentOpportunity(rhythm,at=new Date()){
    const slot=fixedMealWindow(at),types=loggedMealTypes(rhythm||{});
    if(slot.closing||!slot.context)return {active:false,fixedWindow:slot};
    if(slot.context==='breakfast'){
      const habit=contextHabitStats(rhythm,'breakfast');
      if(habit.usuallyAbsent&&!types.includes('breakfast'))return {active:true,context:'breakfast',habit,fixedWindow:slot};
    }
    if(slot.context==='snack'){
      const habit=contextHabitStats(rhythm,'snack');
      if(habit.usuallyAbsent&&!types.includes('snack'))return {active:true,context:'snack',habit,fixedWindow:slot};
    }
    return {active:false,fixedWindow:slot};
  }
  function effectiveMicroGap(model,focus,state){
    const live=n(state?.gap);if(live!==null)return live;
    const x=modelNumbers(model,focus);
    return x.low!==null&&x.recent!==null?Math.max(0,x.low-x.recent):null;
  }
  function microNeedEligible(model,payload,focus,opportunity,at=new Date()){
    if(!opportunity?.active)return false;
    const state=pacingState(model,payload,focus,at),x=modelNumbers(model,focus),gap=effectiveMicroGap(model,focus,state);
    const threshold=focus==='protein'?6:focus==='fiber'?2:focus==='energy'?100:.1;
    if(gap===null||gap<threshold||state.phase==='closing'||state.veryLate)return false;
    const persistent=x.recent!==null&&x.low!==null&&x.low>0&&x.recent<x.low*.92;
    const live=state.loggedMeals>0&&(state.behind||state.remainingMeals<=1||state.progress===null||(state.progress+0.12<state.trajectory));
    return opportunity.context==='breakfast'?persistent:(persistent||live);
  }
  function microTargetAmount(focus,gap){
    const g=Math.max(0,Number(gap)||0);
    if(focus==='protein')return clamp(g*.30,6,15);
    if(focus==='fiber')return clamp(g*.30,2,5);
    if(focus==='energy')return clamp(g*.28,100,250);
    return Math.max(.1,g*.30);
  }
  function microContextAllowed(c,context){
    const ctx=Array.isArray(c?.micro_contexts)?c.micro_contexts:[];
    return c?.micro_guidance_enabled===true&&ctx.includes(context);
  }
  function scaledMicroCandidate(c,focus,state,context,model){
    if(!microContextAllowed(c,context)||!candidateAllowed(c,model,focus,state))return null;
    if(['meal','commercial','treat','ingredient','condiment','small_quantity','special'].includes(String(c?.guidance_role||'')))return null;
    const normal=n(c?.portion_g),minG=n(c?.micro_portion_min_g),maxG=n(c?.micro_portion_max_g),amount=focusValue(c,focus);
    if(!normal||!minG||!maxG||amount<=0)return null;
    const target=microTargetAmount(focus,effectiveMicroGap(model,focus,state)),raw=normal*(target/amount),quantized=Math.round(clamp(raw,minG,maxG)/5)*5,grams=clamp(quantized,minG,maxG);
    const scale=grams/normal,out={...c,original_portion_g:normal,portion_g:grams,portion_source:'micro_guidance',micro_mode:true,micro_context:context};
    for(const key of ['kcal','protein_g','fiber_g','carbs_g','fat_g','focus_amount'])if(n(c?.[key])!==null)out[key]=Math.round(Number(c[key])*scale*1000)/1000;
    const minUseful=focus==='protein'?4:focus==='fiber'?1.2:focus==='energy'?60:.05;
    return focusValue(out,focus)>=minUseful?out:null;
  }
  function labelForFocus(f){return FOCUS_LABELS[f]||'ce repère';}

  function injectCSS(){if(document.getElementById('mtFoodGuidanceCSS'))return;const s=document.createElement('style');s.id='mtFoodGuidanceCSS';s.textContent=`
    .mt-food-guide{margin:16px 0 4px;padding:18px;border-radius:22px;background:#edf4f1;border:1px solid #dbe8e2;color:#164b3f}
    .mt-food-guide-kicker{font-size:11px;font-weight:850;letter-spacing:.15em;text-transform:uppercase;color:#a77f35;margin-bottom:6px}
    .mt-food-guide h3{font-family:Georgia,serif;font-size:24px;line-height:1.08;font-weight:400;margin:0 0 8px;color:#164b3f}
    .mt-food-guide>p{margin:0 0 13px;line-height:1.55;color:#315c52;font-size:14px}
    .mt-food-guide-gesture{padding:12px 13px;border-radius:15px;background:#fffaf2;border:1px solid #eadfc9;margin:0 0 13px;font-size:13px;line-height:1.5;color:#695e55}.mt-food-guide-gesture b{display:block;color:#164b3f;margin-bottom:3px}
    .mt-food-guide-options{display:grid;gap:9px}.mt-food-guide-option{background:#fffdf8;border:1px solid #e5dac7;border-radius:16px;padding:12px 13px}.mt-food-guide-option-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.mt-food-guide-option b{color:#164b3f;line-height:1.25}.mt-food-guide-option small{display:block;color:#88796c;margin-top:3px;line-height:1.35}.mt-food-guide-option .mt-food-guide-prep{color:#587168;font-weight:700;margin-top:5px}.mt-food-guide-chip{flex:0 0 auto;font-size:10px;font-weight:800;color:#9b762f;background:#f6ecd6;border-radius:99px;padding:5px 7px}.mt-food-guide-metrics{font-size:12px;color:#315c52;margin-top:8px}.mt-food-guide-pick{margin-top:9px;border:0;background:transparent;color:#164b3f;font-weight:800;padding:0;font-size:12px}.mt-food-guide-pick.is-picked{color:#9b762f}
    .mt-food-guide-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:13px}.mt-food-guide-btn{border:1px solid #cdbb94;background:#fffaf2;color:#164b3f;border-radius:999px;padding:12px 14px;font-weight:850;font-size:13px}.mt-food-guide-btn.primary{background:#164b3f;border-color:#164b3f;color:white}.mt-food-guide-alt{border:0;background:transparent;color:#75685d;font-weight:750;padding:8px 4px;font-size:12px}
    .mt-food-guide-note{font-size:11px!important;color:#8b7c70!important;margin:11px 0 0!important;line-height:1.45!important}
    .mt-exp-checkin-panel{margin:12px 0 2px;padding:15px;border-radius:18px;background:#f6f0e5;border:1px solid #e4d5ba}.mt-exp-checkin-panel b{display:block;color:#164b3f;margin-bottom:9px}.mt-exp-checkin-grid{display:flex;flex-wrap:wrap;gap:7px}.mt-exp-checkin-choice{border:1px solid #d6c6a9;background:#fffaf2;color:#164b3f;border-radius:99px;padding:9px 11px;font-weight:750;font-size:12px}.mt-exp-checkin-choice.is-selected{background:#164b3f;color:white;border-color:#164b3f}.mt-exp-checkin-step{margin-top:12px}.mt-exp-checkin-saved{color:#164b3f;font-weight:850}
  `;document.head.appendChild(s);}

  async function rpc(name,args){const sb=client();if(!sb)throw new Error('Connexion indisponible.');const {data,error}=await sb.rpc(name,args||{});if(error)throw error;return data;}
  async function fetchGuidance(focus,date,mealContext){
    const key=`${focus}|${date}|${mealContext||'neutral'}`,cached=CACHE.get(key);if(cached&&Date.now()-cached.at<TTL)return cached.data;
    let data;
    try{data=await rpc('mt_food_guidance_v4',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}
    catch(_v4){try{data=await rpc('mt_food_guidance_v3',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}
    catch(_v3){try{data=await rpc('mt_food_guidance_v2',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}
    catch(_v2){data=await rpc('mt_food_guidance_v1',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}}}
    CACHE.set(key,{at:Date.now(),data});return data;
  }
  async function loadRhythm(date=localDate()){return fetchGuidance('protein',date,null);}
  async function load(focus,opts={}){
    const date=opts.date||localDate(),at=opts.at instanceof Date?opts.at:new Date();
    if(opts.mealContext)return fetchGuidance(focus,date,opts.mealContext);
    const neutral=await fetchGuidance(focus,date,null),rhythm=neutral?.rhythm||{},decision=mealContextDecision(rhythm,at),slot=decision.fixedWindow||fixedMealWindow(at);
    // V4896609 : l'heure fixe le catalogue autorisé. Les habitudes ne déplacent plus
    // breakfast/lunch/snack/dinner hors de leur tranche ; elles servent seulement à décider
    // si un petit-déjeuner ou une collation habituellement absents méritent un petit renfort.
    if(slot.closing)return {...neutral,client_guidance_mode:'closing',fixed_time_window:slot,meal_context_decision:decision};
    if(decision.currentAlreadyLogged)return {...neutral,client_guidance_mode:'slot_already_logged',fixed_time_window:slot,meal_context_decision:decision};
    const opportunity=skippedMomentOpportunity(rhythm,at),habit=slot.context?contextHabitStats(rhythm,slot.context):null;
    if(['breakfast','snack'].includes(slot.context)&&habit?.usuallyAbsent){
      if(microNeedEligible(opts.model,neutral,focus,opportunity,at)){
        const microPayload=await fetchGuidance(focus,date,slot.context);
        return {...microPayload,client_guidance_mode:'micro_reinforcement',micro_opportunity:opportunity,fixed_time_window:slot,meal_context_decision:decision};
      }
      return {...neutral,client_guidance_mode:'optional_slot_no_need',micro_opportunity:opportunity,fixed_time_window:slot,meal_context_decision:decision};
    }
    const payload=await fetchGuidance(focus,date,slot.context);
    return {...payload,client_guidance_mode:'meal_slot',fixed_time_window:slot,meal_context_decision:decision};
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
    const x=modelNumbers(model,focus),rhythm=payload?.rhythm||{},day=learnedRhythm(rhythm,at),slot=payload?.fixed_time_window||fixedMealWindow(at);
    const expected=Math.max(1,Number(rhythm.expected_daily_meals)||3),logged=Math.max(0,Number(rhythm.today_logged_meals)||0);
    const low=x.low,cur=x.current,gap=cur!==null&&low!==null?Math.max(0,low-cur):null;
    const progress=cur!==null&&low>0?clamp(cur/low,0,1.4):null;
    const mealProgress=clamp(logged/expected,0,1),timeProgress=day.progress;
    // Avec un rythme appris, l'heure pèse réellement. Sans historique suffisant,
    // Tee s'appuie surtout sur les repas déjà renseignés et reste prudente avec l'horloge.
    const trajectory=day.learned?Math.max(mealProgress*.82,timeProgress*.66):Math.max(mealProgress*.86,timeProgress*.30);
    const behind=progress!==null&&gap>0&&trajectory>=.25&&progress+0.16<trajectory;
    const phase=String(slot?.phase||day.phase),late=phase==='late'||phase==='closing',veryLate=phase==='closing';
    const urgency=gap===null||gap<=0?'covered':behind&&late?'high':behind?'medium':late&&progress!==null&&progress<.55?'medium':'low';
    const remainingMeals=Math.max(0,expected-logged);
    return {focus,current:cur,recent:x.recent,low,high:x.high,unit:x.unit,gap,progress,first:day.first,last:day.last,expectedMeals:expected,loggedMeals:logged,remainingMeals,timeProgress,mealProgress,trajectory,behind,late,veryLate,urgency,phase,rhythmLearned:day.learned,lateMinute:day.lateMinute,veryLateMinute:day.veryLateMinute,fixedTimeWindow:slot,mealContext:slot?.context||null};
  }

  function selectPacingDecision(model,rawDecision=null,payload=null,at=new Date()){
    if(payload instanceof Date){at=payload;payload=null;}
    const days=Number(model?.nutritionDays)||0,learned=learnedRhythm(payload?.rhythm||{},at),slot=fixedMealWindow(at),day={...learned,phase:slot.phase},defs=[
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
      if(['before','early'].includes(state.phase)&&state.loggedMeals===0){
        const low=`${fmt(state.low,focus==='energy'?0:1)} ${x.unit}`;
        const recent=state.recent!==null?` Sur tes journées récentes, environ ${fmt(state.recent,focus==='energy'?0:1)} ${x.unit} ont été documentés.`:'';
        return `Ton repère bas actuel est d’environ ${low}.${recent} Ce matin, Tee reste dans les options prévues pour le matin et répartit progressivement ce qui est utile sur la suite de la journée.`;
      }
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
  function isCultureSpecific(c){
    const name=String(c?.name||''),country=String(c?.country||'').trim(),culture=String(c?.culture||'').trim();
    const cultureNorm=normText(culture),countryNorm=normText(country),nameNorm=normText(name);
    if(cultureNorm && !/(^| )(nutrition vegetale|restauration)( |$)/.test(cultureNorm))return true;
    if(countryNorm && !['france','international'].includes(countryNorm)){
      if(name.includes('—')||name.includes('-')||countryNorm.split(' ').some(x=>x.length>3&&nameNorm.includes(x)))return true;
    }
    return false;
  }
  function cultureSpecificAllowed(c){
    if(!isCultureSpecific(c))return true;
    const level=familiarityLevel(c),uses=Math.max(0,Number(c?.use_count_60d)||0);
    return uses>=2||['habit','tee_chosen','scanned_repeat'].includes(level);
  }
  function preparationState(c){
    const explicit=String(c?.preparation_state||'').trim();
    if(explicit)return explicit;
    if(c?.ready_to_eat===false)return 'requires_cooking';
    return String(c?.guidance_role||'')==='meal'?'meal_ready':'ready';
  }
  function requiresCooking(c){return preparationState(c)==='requires_cooking';}
  function familiarityLevel(c){
    const explicit=String(c?.familiarity_level||'').trim();
    if(explicit)return explicit;
    const uses=Math.max(0,Number(c?.use_count_60d)||0);
    if(uses>=2)return 'habit';
    if(uses===1)return 'consumed';
    return '';
  }
  function familiarityIsExact(c){return ['habit','consumed','tee_chosen','scanned_repeat'].includes(familiarityLevel(c));}
  function preparationCue(c,state){
    const prep=preparationState(c),role=String(c?.guidance_role||'food'),ctx=String(state?.mealContext||'');
    const ctxLabel={breakfast:'ton matin',lunch:'ton déjeuner',snack:'ta collation',dinner:'ton dîner'}[ctx]||'ton prochain moment alimentaire';
    if(prep==='requires_cooking')return state?.phase==='closing'?'Préparation reportée':`À préparer pour ${ctxLabel}`;
    if(prep==='assembly')return state?.phase==='closing'?'À intégrer simplement à ton dernier repas':`À intégrer à ${ctxLabel}`;
    if(role==='meal'||prep==='meal_ready')return state?.phase==='closing'?'Option pour ton dernier repas':`Option prête pour ${ctxLabel}`;
    if(state?.phase==='closing')return 'À ajouter à ton dernier repas';
    return `Pour ${ctxLabel}`;
  }
  function candidateMemoryTier(c){
    if(c?.rotation_due)return 4;
    const level=familiarityLevel(c);
    if(['habit','consumed','tee_chosen','scanned_repeat'].includes(level))return 0;
    if(level==='similar')return 1;
    return 2;
  }
  function focusValue(c,focus){
    if(focus==='protein')return n(c?.protein_g)||0;if(focus==='fiber')return n(c?.fiber_g)||0;if(focus==='energy')return n(c?.kcal)||0;
    return n(c?.focus_amount)||0;
  }
  function contextualCandidateScore(c,model,focus,state){
    let score=(n(c?.score)||0)*.35;
    const amount=focusValue(c,focus),gap=state?.gap,phase=state?.phase||'middle',role=String(c?.guidance_role||'food'),fam=familiarityLevel(c),prep=preparationState(c);
    const remaining=Math.max(1,Number(state?.remainingMeals)||1),baseShare=phase==='closing'?.42:phase==='late'?.58:phase==='middle'?.50:.38;
    const share=clamp(Math.max(baseShare,1/remaining*.72),.30,.68),target=gap!==null&&gap>0?Math.max(focus==='energy'?180:focus==='protein'?8:focus==='fiber'?3:.1,gap*share):Math.max(amount,1);
    const ratio=Math.max(.05,amount/Math.max(target,.05));
    score-=Math.abs(Math.log(ratio))*24;
    if(gap!==null&&gap>0&&amount>gap*1.15)score-=18+Math.min(30,(amount/gap-1.15)*22);
    if(fam==='habit'&&!c?.rotation_due)score+=32;
    else if(fam==='consumed'&&!c?.rotation_due)score+=23;
    else if(fam==='tee_chosen'&&!c?.rotation_due)score+=19;
    else if(fam==='similar')score+=10;
    if(c?.source_kind==='scanned')score+=12;
    if(c?.meal_context_fit)score+=6;
    score+=Math.min(15,n(c?.memory_affinity_score)||0);
    if(c?.rotation_due)score-=24;
    if(role==='meal')score+=phase==='middle'||phase==='late'?3:-2;
    if(prep==='ready'||prep==='meal_ready')score+=['before','early'].includes(phase)?8:4;
    if(prep==='assembly')score+=['closing','late'].includes(phase)?2:4;
    if(prep==='requires_cooking'){
      if(['before','early'].includes(phase))score+=familiarityIsExact(c)?7:-2;
      else if(phase==='middle')score-=familiarityIsExact(c)?7:18;
      else score-=35;
    }
    const kcal=n(c?.kcal)||0,energy=modelNumbers(model,'energy'),energyGap=energy.current!==null&&energy.low!==null?Math.max(0,energy.low-energy.current):null;
    if(focus!=='energy'){
      if(energyGap!==null&&energyGap<=0)score-=Math.min(28,kcal/28);
      else if(energyGap!==null&&energyGap>0){
        const eRatio=kcal/Math.max(energyGap,1);
        if(eRatio<=.45)score+=7;else if(eRatio>.85)score-=phase==='closing'?24:12;
      }
      if(kcal>700)score-=Math.min(34,(kcal-700)/18);
    }
    if(role==='meal'&&!familiarityIsExact(c)&&fam!=='similar')score-=12;
    return score;
  }
  function candidateAllowed(c,model,focus,state){
    if(!c||focusValue(c,focus)<=0||looksSmallQuantity(c)||looksCommercialGuidanceExcluded(c)||!cultureSpecificAllowed(c))return false;
    const kcal=n(c.kcal)||0,role=String(c.guidance_role||'food'),familiar=familiarityIsExact(c),prep=preparationState(c);
    if(prep==='requires_cooking'&&(state?.phase==='closing'||(state?.phase==='late'&&Number(state?.remainingMeals||0)<=1)))return false;
    if(prep==='requires_cooking'&&state?.phase==='middle'&&!familiar)return false;
    if(focus!=='energy'){
      if(kcal>1400)return false;
      if(state?.phase==='closing'&&kcal>850&&!familiar)return false;
      if(state?.phase==='closing'&&role==='meal'&&kcal>950)return false;
      const energy=modelNumbers(model,'energy'),energyGap=energy.current!==null&&energy.low!==null?Math.max(0,energy.low-energy.current):null;
      if(energyGap!==null&&energyGap<350&&kcal>650&&!familiar)return false;
    }
    return true;
  }
  function blendMorning(candidates,state){
    if(!['before','early'].includes(state?.phase))return candidates;
    const out=[],add=c=>{if(c&&!out.includes(c))out.push(c);};
    const trustedPrep=c=>requiresCooking(c)&&['habit','consumed','tee_chosen','similar'].includes(familiarityLevel(c))&&!c.rotation_due;
    add(candidates.find(c=>!requiresCooking(c)&&familiarityIsExact(c)&&!c.rotation_due));
    add(candidates.find(c=>!requiresCooking(c)&&!out.includes(c)));
    add(candidates.find(trustedPrep));
    candidates.filter(c=>!requiresCooking(c)).forEach(add);
    candidates.filter(trustedPrep).forEach(add);
    candidates.filter(c=>requiresCooking(c)&&!trustedPrep(c)).forEach(add);
    return out;
  }
  function sortedCandidates(payload,model,focus,state=null){
    const all=Array.isArray(payload?.candidates)?payload.candidates:[],pace=state||pacingState(model,payload,focus);
    const ranked=all.filter(c=>candidateAllowed(c,model,focus,pace)).map(c=>({c,fit:contextualCandidateScore(c,model,focus,pace),tier:candidateMemoryTier(c)})).sort((a,b)=>a.tier-b.tier||b.fit-a.fit||((n(b.c.focus_amount)||0)-(n(a.c.focus_amount)||0))).map(x=>x.c);
    return blendMorning(ranked,pace);
  }
  function sortedMicroCandidates(payload,model,focus,state,context){
    const all=Array.isArray(payload?.candidates)?payload.candidates:[];
    return all.map(c=>scaledMicroCandidate(c,focus,state,context,model)).filter(Boolean)
      .map(c=>({c,fit:contextualCandidateScore(c,model,focus,state),tier:candidateMemoryTier(c)}))
      .sort((a,b)=>a.tier-b.tier||b.fit-a.fit||((n(b.c.focus_amount)||0)-(n(a.c.focus_amount)||0)))
      .map(x=>x.c);
  }

  function candidateHTML(c,focus,index,state){
    const role=String(c.guidance_role||'food'),level=familiarityLevel(c),chip=c.rotation_due?'À varier':level==='habit'?'Dans tes habitudes':level==='consumed'?'Déjà consommé':level==='tee_chosen'?'Déjà choisi avec Tee':level==='similar'?'Proche de tes habitudes':role==='meal'?'Plat complet':'Option TEE';
    const prep=preparationState(c),pickLabel=['before','early'].includes(state?.phase)?(prep==='requires_cooking'?'Je le prépare':'Je prévois ça'):state?.phase==='closing'?'Je garde cette option':'Ça me convient';
    return `<div class="mt-food-guide-option" data-mt-guide-candidate="${index}"><div class="mt-food-guide-option-top"><div><b>${esc(c.name||'Option')}</b><small>${esc(portionLabel(c))}</small><small class="mt-food-guide-prep">${esc(preparationCue(c,state))}</small></div><span class="mt-food-guide-chip">${esc(chip)}</span></div><div class="mt-food-guide-metrics">${metricLine(c,focus)}</div><button class="mt-food-guide-pick" type="button" data-mt-guide-pick="${index}">${esc(pickLabel)}</button></div>`;
  }
  function microCandidateHTML(c,focus,index,context){
    const level=familiarityLevel(c),chip=c.rotation_due?'À varier':level==='habit'?'Dans tes habitudes':level==='consumed'?'Déjà consommé':level==='tee_chosen'?'Déjà choisi avec Tee':level==='similar'?'Proche de tes habitudes':'Petit renfort TEE';
    const cue=context==='breakfast'?'Petit apport facultatif avant ton premier vrai repas':'Petit apport facultatif entre tes repas';
    return `<div class="mt-food-guide-option" data-mt-guide-candidate="${index}"><div class="mt-food-guide-option-top"><div><b>${esc(c.name||'Option')}</b><small>${esc(portionLabel(c))}</small><small class="mt-food-guide-prep">${esc(cue)}</small></div><span class="mt-food-guide-chip">${esc(chip)}</span></div><div class="mt-food-guide-metrics">${metricLine(c,focus)}</div><button class="mt-food-guide-pick" type="button" data-mt-guide-pick="${index}">Ça me convient</button></div>`;
  }

  function renderHost(host,{model,decision,payload,experience=false,start=0}){
    if(!host)return;injectCSS();const focus=focusFromDecision(decision);if(!focus){host.innerHTML='';return;}
    const state=pacingState(model,payload,focus);
    if(state.phase==='closing'||state.veryLate){
      host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">Fin de journée</div><h3>Tee laisse la journée se terminer.</h3><p>À cette heure, elle ne te propose plus d’aliment à ajouter ni de repas à adapter. La priorité est de ne pas transformer la fin de journée en rattrapage.</p></section>`;
      return;
    }
    const guidanceMode=String(payload?.client_guidance_mode||''),slot=payload?.fixed_time_window||state.fixedTimeWindow||fixedMealWindow();
    if(guidanceMode==='slot_already_logged'){
      const label={breakfast:'Ton petit-déjeuner',lunch:'Ton déjeuner',snack:'Ta collation',dinner:'Ton dîner'}[slot?.context]||'Ce moment alimentaire';
      host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">Créneau déjà renseigné</div><h3>${esc(label)} est déjà documenté.</h3><p>Tee ne te repropose pas un deuxième ${esc(slot?.label||'repas')} dans la même tranche horaire. Elle attend le prochain créneau et réajustera avec ce que tu as réellement mangé.</p></section>`;
      return;
    }
    if(guidanceMode==='optional_slot_no_need'){
      const isBreakfast=slot?.context==='breakfast',noun=isBreakfast?'petit-déjeuner':'collation';
      host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">Ton rythme est respecté</div><h3>Pas besoin d’ajouter un ${noun}.</h3><p>Tu n’en prends généralement pas et, pour l’instant, Tee ne voit pas de petit renfort assez utile pour justifier de changer ton rythme. Elle garde les vrais repas comme prochains points d’appui.</p></section>`;
      return;
    }
    const microMode=guidanceMode==='micro_reinforcement';
    if(microMode){
      const context=String(payload?.micro_opportunity?.context||''),candidates=sortedMicroCandidates(payload,model,focus,state,context),visible=candidates.slice(start,start+3);
      const absentLabel=context==='breakfast'?'petit-déjeuner':'collation',headline=context==='breakfast'?'Un petit renfort peut aider sans créer un petit-déjeuner.':'Un petit renfort peut aider sans créer une collation.';
      const copy=`Tu ne prends généralement pas de ${absentLabel}. Tee ne t’en impose pas : aujourd’hui, elle te propose seulement une petite option si elle peut alléger ce qu’il restera à placer plus tard.`;
      host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">Petit renfort possible</div><h3>${esc(headline)}</h3><p>${esc(copy)}</p>${visible.length?`<div class="mt-food-guide-options">${visible.map((c,i)=>microCandidateHTML(c,focus,start+i,context)).join('')}</div>`:`<div class="mt-food-guide-gesture"><b>Pas de renfort utile à forcer</b>Tee ne trouve pas de petite option assez cohérente pour ce besoin. Ton prochain vrai repas reste le point d’appui.</div>`}<div class="mt-food-guide-actions">${candidates.length>3?'<button type="button" class="mt-food-guide-btn" data-mt-guide-alt>Propose-moi autre chose</button>':''}<button type="button" class="mt-food-guide-btn${visible.length?'':' primary'}" data-mt-guide-skip>Je préfère attendre mon prochain repas</button></div><p class="mt-food-guide-note">Ce renfort est facultatif. Sa portion est ajustée dans une plage pratique selon le besoin restant : Tee ne réduit jamais mécaniquement un aliment à un tiers.</p></section>`;
      host.querySelectorAll('[data-mt-guide-pick]').forEach(btn=>btn.addEventListener('click',async()=>{
        const idx=Number(btn.dataset.mtGuidePick),c=candidates[idx];if(!c)return;btn.disabled=true;
        await log('chosen',focus,c,{mealContext:context,payload:{micro_reinforcement:true,micro_context:context,portion_g:c.portion_g,original_portion_g:c.original_portion_g,focus_amount:c.focus_amount,familiarity_level:familiarityLevel(c)}});
        btn.classList.add('is-picked');btn.textContent='✓ Petit renfort prévu';
      }));
      host.querySelector('[data-mt-guide-alt]')?.addEventListener('click',async()=>{
        await log('alternative',focus,null,{mealContext:context,payload:{micro_reinforcement:true,micro_context:context,start}});
        const next=(start+3)>=candidates.length?0:start+3;renderHost(host,{model,decision,payload,experience,start:next});
      });
      host.querySelector('[data-mt-guide-skip]')?.addEventListener('click',async()=>{
        await log('dismissed',focus,null,{mealContext:context,payload:{micro_reinforcement:true,micro_context:context,reason:'wait_next_meal'}});
        host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">Ton rythme est respecté</div><h3>Pas besoin d’ajouter un repas.</h3><p>Tee garde ton prochain vrai repas comme point d’appui et continuera d’ajuster la journée avec ce que tu renseignes.</p></section>`;
      });
      return;
    }
    const candidates=sortedCandidates(payload,model,focus,state),visible=candidates.slice(start,start+3),preparing=slot?.context==='breakfast';
    const gesture=experience?experimentGesture(decision,focus):null;
    const slotKicker={breakfast:'Ce matin',lunch:'Pour ton déjeuner',snack:'Pour ta collation',dinner:'Pour ton dîner'}[slot?.context]||(preparing?'À prévoir aujourd’hui':'Concrètement maintenant');
    const slotTitle={breakfast:'Tee prépare ton matin.',lunch:'Tee prépare ton déjeuner.',snack:'Tee prépare ta collation.',dinner:'Tee prépare ton dîner.'}[slot?.context]||(preparing?'Tee prépare ta journée.':'Tee transforme ce repère en options.');
    host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">${esc(slotKicker)}</div><h3>${esc(slotTitle)}</h3><p>${esc(pacingCopy(model,payload,focus))}</p>${gesture?`<div class="mt-food-guide-gesture"><b>Jour ${gesture.day}/7 · le geste d’aujourd’hui</b>${esc(gesture.text)}</div>`:''}${visible.length?`<div class="mt-food-guide-options">${visible.map((c,i)=>candidateHTML(c,focus,start+i,state)).join('')}</div>`:`<div class="mt-food-guide-gesture"><b>Bibliothèque en cours de lecture</b>Aucune option assez solide n’est proposée pour l’instant. Tee préfère ne rien inventer.</div>`}<div class="mt-food-guide-actions"><button type="button" class="mt-food-guide-btn" data-mt-guide-more>Voir mes options pour aujourd’hui</button><button type="button" class="mt-food-guide-btn primary" data-mt-guide-adapter>Adapter mon prochain repas</button>${candidates.length>3?'<button type="button" class="mt-food-guide-alt" data-mt-guide-alt>Propose-moi autre chose</button>':''}</div><p class="mt-food-guide-note">Les propositions utilisent uniquement les valeurs nutritionnelles disponibles. Une valeur micronutritionnelle absente reste « non documentée » : elle n’est jamais interprétée comme une carence.</p></section>`;

    host.querySelectorAll('[data-mt-guide-pick]').forEach(btn=>btn.addEventListener('click',async()=>{
      const idx=Number(btn.dataset.mtGuidePick),c=candidates[idx];if(!c)return;btn.disabled=true;await log('chosen',focus,c,{payload:{portion_g:c.portion_g,focus_amount:c.focus_amount,preparation_state:preparationState(c),familiarity_level:familiarityLevel(c)}});btn.classList.add('is-picked');btn.textContent=preparationState(c)==='requires_cooking'?'✓ Préparation prévue':'✓ Prévu aujourd’hui';
    }));
    host.querySelector('[data-mt-guide-more]')?.addEventListener('click',()=>{
      const section=host.querySelector('.mt-food-guide-options');if(!section)return;
      section.innerHTML=candidates.slice(0,Math.min(9,candidates.length)).map((c,i)=>candidateHTML(c,focus,i,state)).join('');
      section.querySelectorAll('[data-mt-guide-pick]').forEach(btn=>btn.addEventListener('click',async()=>{const idx=Number(btn.dataset.mtGuidePick),c=candidates[idx];if(!c)return;btn.disabled=true;await log('chosen',focus,c,{payload:{portion_g:c.portion_g,focus_amount:c.focus_amount,preparation_state:preparationState(c),familiarity_level:familiarityLevel(c)}});btn.classList.add('is-picked');btn.textContent=preparationState(c)==='requires_cooking'?'✓ Préparation prévue':'✓ Prévu aujourd’hui';}));
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
      const payload=await load(focus,{mealContext:opts.mealContext||null,date:opts.date||localDate(),model:opts.model});
      const state=pacingState(opts.model,payload,focus);
      if(state.phase!=='closing'&&!state.veryLate&&!['slot_already_logged','optional_slot_no_need'].includes(String(payload?.client_guidance_mode||''))){
        const microMode=String(payload?.client_guidance_mode||'')==='micro_reinforcement',microContext=String(payload?.micro_opportunity?.context||''),mealContext=String(payload?.fixed_time_window?.context||'')||null;
        const first=(microMode?sortedMicroCandidates(payload,opts.model,focus,state,microContext):sortedCandidates(payload,opts.model,focus,state)).slice(0,3);
        first.forEach(c=>log('shown',focus,c,{mealContext:microMode?microContext:mealContext,payload:{placement:opts.experience?'experience':'reference',micro_reinforcement:microMode||undefined,micro_context:microMode?microContext:undefined,portion_g:c.portion_g,time_window:mealContext||undefined}}));
      }
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

  window.MTFoodGuidance={load,loadRhythm,mount,log,focusFromDecision,experimentGesture,bindExperimentCheckin,modelNumbers,pacingState,selectPacingDecision,learnedRhythm,learnedMealSchedule,fixedMealWindow,mealContextDecision,currentMealContext,contextHabitStats,skippedMomentOpportunity,rankCandidates:sortedCandidates,rankMicroCandidates:sortedMicroCandidates,pacingCopy,preparationState,familiarityLevel};
})();
