/* MÉTHODE TEE · V4896617 · collation filtrée + passerelle vers le carnet
 * Couche d'action au-dessus de MTReference / MTAdaptive.
 * - bibliothèque réelle + produits scannés mémorisés côté serveur
 * - portions réalistes, familiarité, rotation et contexte repas
 * - déjeuner/dîner : 1 rôle principal par carte + construction progressive après sélection
 * - une base choisie masque les autres bases et Tee ne montre ensuite que les rôles complémentaires
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
    .mt-food-guide-options{display:grid;gap:9px}.mt-food-guide-option{background:#fffdf8;border:1px solid #e5dac7;border-radius:16px;padding:12px 13px}.mt-food-guide-option-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.mt-food-guide-option b{color:#164b3f;line-height:1.25}.mt-food-guide-option small{display:block;color:#88796c;margin-top:3px;line-height:1.35}.mt-food-guide-option .mt-food-guide-prep{color:#587168;font-weight:700;margin-top:5px}.mt-food-guide-chip{flex:0 0 auto;font-size:10px;font-weight:800;color:#9b762f;background:#f6ecd6;border-radius:99px;padding:5px 7px}.mt-food-guide-metrics{font-size:12px;color:#315c52;margin-top:8px}.mt-food-guide-pick{margin-top:9px;border:0;background:transparent;color:#164b3f;font-weight:800;padding:0;font-size:12px}.mt-food-guide-pick.is-picked{color:#9b762f}.mt-food-guide-role-alt{display:block;margin-top:7px;border:0;background:transparent;color:#8a796c;font-weight:750;padding:0;font-size:11px;text-decoration:underline;text-underline-offset:2px}
    .mt-food-guide-build{padding:12px 13px;border-radius:15px;background:#fffaf2;border:1px solid #eadfc9;margin:0 0 13px}.mt-food-guide-build-title{font-weight:850;color:#164b3f;margin-bottom:8px}.mt-food-guide-selected{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #eee2ce}.mt-food-guide-selected:first-of-type{border-top:0}.mt-food-guide-selected small{display:block;color:#9b762f;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.04em}.mt-food-guide-selected b{display:block;color:#164b3f;margin-top:2px}.mt-food-guide-selected span{display:block;color:#88796c;font-size:11px;margin-top:2px}
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
    const reasons=[],documentedAgreement=best.focus==='energy'?'documentées':'documentés';
    if(n(best.today)!==null)reasons.push(`Aujourd’hui : ${fmt(best.today,best.focus==='energy'?0:1)} ${best.unit} ${documentedAgreement}`);
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
      const amount=`${fmt(gap,focus==='energy'?0:1)} ${x.unit}`,low=`${fmt(state.low,focus==='energy'?0:1)} ${x.unit}`;
      const recentAgreement=focus==='energy'?'documentées':'documentés';
      const recent=state.recent!==null?` Sur tes journées récentes, environ ${fmt(state.recent,focus==='energy'?0:1)} ${x.unit} ont été ${recentAgreement}.`:'';
      if(state.loggedMeals===0&&(state.current===null||state.current===0)){
        return `Ton repère bas actuel est d’environ ${low}. Rien n’est encore documenté aujourd’hui.${recent} Tee ne traite pas ce repère comme une dette à rattraper : elle le répartit progressivement entre les moments alimentaires restants.`;
      }
      if(['before','early'].includes(state.phase)&&state.loggedMeals===0)return `Ton repère bas actuel est d’environ ${low}.${recent} Ce matin, Tee reste dans les options prévues pour le matin et répartit progressivement ce qui est utile sur la suite de la journée.`;
      if(state.phase==='closing'||state.veryLate)return `D’après ce qui est documenté, l’écart au bas de ton repère est d’environ ${amount}. À ce stade, inutile de chercher à tout rattraper : Tee laisse la journée se terminer.`;
      if(state.phase==='late'&&state.remainingMeals<=1)return `D’après ce qui est documenté, l’écart au bas de ton repère est d’environ ${amount}. Comme tu approches de ton dernier repas habituel, Tee vise seulement une contribution raisonnable plutôt qu’un rattrapage complet.`;
      if(state.urgency==='high')return `D’après ce qui est documenté, l’écart au bas de ton repère est d’environ ${amount}. Tee te propose d’en répartir une partie maintenant plutôt que de concentrer l’essentiel sur le dernier repas.`;
      if(state.urgency==='medium')return `D’après ce qui est documenté, l’écart au bas de ton repère est d’environ ${amount}. Le plus simple est d’en répartir une partie dans ton prochain moment alimentaire.`;
      if(['before','early'].includes(state.phase))return `D’après ce qui est documenté, l’écart au bas de ton repère est d’environ ${amount}. Tee te propose de commencer à le répartir dans tes premiers moments alimentaires, sans changer toute ta journée.`;
      return `D’après ce qui est documenté, l’écart au bas de ton repère est d’environ ${amount}. Tee te propose seulement ce qui est raisonnable d’intégrer à ce repas et répartira le reste sur les moments suivants.`;
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
  function looksAnimalRawOrCookRequired(c){
    const t=normText(c?.name);
    if(/(^| )(a cuire|a cuire au|a griller|a rotir)( |$)/.test(t))return true;
    const animal=/(^| )(agneau|boeuf|bœuf|veau|porc|cochon|poulet|dinde|canard|lapin|mouton|chevre|chevreau|viande|steak|lardon|bacon|jambon|saucisse|merguez|poisson|saumon|thon|cabillaud|truite|crevette|gambas)( |$)/.test(t);
    return animal&&/(^| )(cru|crue|crus|crues)( |$)/.test(t);
  }
  function preparationState(c){
    if(looksAnimalRawOrCookRequired(c))return 'requires_cooking';
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
  function snackFriendlyCandidate(c,state){
    if(String(state?.mealContext||'')!=='snack')return true;
    const family=guidanceFoodFamily(c),role=mealIntegrationRole(c),prep=preparationState(c),kcal=n(c?.kcal)||0,portion=n(c?.portion_g)||0,protein=n(c?.protein_g)||0;
    if(role==='complete_meal'||String(c?.guidance_role||'')==='meal'||prep==='meal_ready')return false;
    if(prep==='requires_cooking')return false;
    if(['processed_meat','pork','beef','lamb','poultry','seafood'].includes(family))return false;
    if(kcal>450)return false;
    if(portion>250&&!['fruit','dairy','vegetable'].includes(family))return false;
    if(role==='starch_base'&&kcal>320&&protein<10)return false;
    return true;
  }
  function guidanceFoodFamily(c){
    const t=normText(c?.name),role=String(c?.guidance_role||'food');
    if(role==='meal'||preparationState(c)==='meal_ready')return 'complete_meal';
    if(/(^| )(lardon|bacon|saucisse|saucisson|merguez|chorizo|charcuterie)( |$)/.test(t))return 'processed_meat';
    if(/(^| )(porc|cochon|jambon)( |$)/.test(t))return 'pork';
    if(/(^| )(boeuf|bœuf|veau|steak)( |$)/.test(t))return 'beef';
    if(/(^| )(agneau|mouton|chevre|chevreau)( |$)/.test(t))return 'lamb';
    if(/(^| )(poulet|dinde|canard|volaille)( |$)/.test(t))return 'poultry';
    if(/(^| )(saumon|thon|cabillaud|colin|truite|sardine|maquereau|poisson|crevette|gambas|moule|huitre)( |$)/.test(t))return 'seafood';
    if(/(^| )(oeuf|œuf|omelette)( |$)/.test(t))return 'eggs';
    if(/(^| )(tofu|tempeh|seitan)( |$)/.test(t))return 'plant_protein';
    if(/(^| )(lentille|pois chiche|haricot blanc|haricot rouge|haricot noir|feve|fève)( |$)/.test(t))return 'legumes';
    if(/(^| )(riz|pates|pâte|pasta|semoule|couscous|quinoa|boulgour|ble|blé|orge|avoine|pain|baguette|pomme de terre|patate|igname|manioc|plantain)( |$)/.test(t))return 'starch';
    if(/(^| )(courgette|brocoli|epinard|épinard|carotte|haricot vert|chou|salade|tomate|concombre|poivron|aubergine|artichaut|asperge|poireau|champignon|legume|légume)( |$)/.test(t))return 'vegetable';
    if(/(^| )(skyr|yaourt|yogourt|fromage blanc|petit suisse|lait|fromage|feta|mozzarella)( |$)/.test(t))return 'dairy';
    if(/(^| )(amande|noix|noisette|cajou|pistache|graine|avocat)( |$)/.test(t))return 'fat_side';
    if(/(^| )(pomme|poire|banane|orange|kiwi|mangue|ananas|fraise|framboise|myrtille|fruit)( |$)/.test(t))return 'fruit';
    return 'other';
  }
  function mealIntegrationRole(c){
    const role=String(c?.guidance_role||'food'),prep=preparationState(c),family=guidanceFoodFamily(c),kcal=n(c?.kcal)||0,protein=n(c?.protein_g)||0,carbs=n(c?.carbs_g)||0,fiber=n(c?.fiber_g)||0,fat=n(c?.fat_g)||0;
    if(role==='meal'||prep==='meal_ready'||family==='complete_meal')return 'complete_meal';
    if(role==='beverage')return 'beverage';
    if(family==='processed_meat')return 'meal_accent';
    if(['pork','beef','lamb','poultry','seafood','eggs','plant_protein'].includes(family))return 'protein_base';
    if(family==='legumes')return protein>=8?'protein_fiber':'fiber_side';
    if(family==='starch')return 'starch_base';
    if(family==='vegetable')return 'vegetable_fiber';
    if(family==='dairy')return protein>=8?'protein_side':'meal_side';
    if(family==='fat_side'||family==='fruit')return 'meal_side';
    if(protein>=12&&protein>=Math.max(6,carbs*.45))return 'protein_base';
    if(carbs>=18&&carbs>=protein*1.25)return 'starch_base';
    if(fiber>=3&&kcal<=220)return 'vegetable_fiber';
    if(fat>=10&&kcal<=380)return 'meal_side';
    return 'meal_side';
  }
  function mealRolePriority(focus){
    if(focus==='fiber')return ['vegetable','protein','starch'];
    if(focus==='energy')return ['starch','protein','vegetable'];
    if(focus==='protein')return ['protein','starch','vegetable'];
    return ['protein','starch','vegetable'];
  }
  function mealRoleGroup(c){
    const role=mealIntegrationRole(c);
    if(role==='complete_meal')return 'complete';
    if(role==='protein_base'||role==='protein_fiber')return 'protein';
    if(role==='starch_base')return 'starch';
    if(role==='vegetable_fiber'||role==='fiber_side')return 'vegetable';
    if(role==='meal_accent')return 'accent';
    if(role==='beverage')return 'beverage';
    return 'side';
  }
  function structuredMealCandidates(candidates,state,focus,opts={}){
    if(!['lunch','dinner'].includes(String(state?.mealContext||'')))return candidates;
    const pool=Array.isArray(candidates)?candidates:[],selectedGroups=new Set(Array.isArray(opts?.selectedGroups)?opts.selectedGroups:[]),used=new Set(),families=new Set(),groups=new Set(),primary=[];
    if(selectedGroups.has('complete')){const empty=[];empty.primaryCount=0;return empty;}
    const key=c=>String(c?.candidate_ref||c?.name||'');
    const eligible=c=>{const g=mealRoleGroup(c);return c&&!selectedGroups.has(g)&&!(selectedGroups.size>0&&g==='complete')&&!['accent','beverage'].includes(g);};
    const addPrimary=(c)=>{if(!eligible(c)||used.has(key(c)))return false;const group=mealRoleGroup(c),fam=guidanceFoodFamily(c);if(groups.has(group)||families.has(fam))return false;primary.push(c);used.add(key(c));groups.add(group);families.add(fam);return true;};

    // Un plat complet peut être proposé comme une option autonome. On ne lui ajoute pas
    // artificiellement des composants autour : il occupe seul le premier niveau.
    const firstComplete=pool.find(c=>eligible(c)&&mealRoleGroup(c)==='complete');
    const firstComponent=pool.find(c=>eligible(c)&&['protein','starch','vegetable'].includes(mealRoleGroup(c)));
    if(firstComplete && (!firstComponent || pool.indexOf(firstComplete)<pool.indexOf(firstComponent))){
      addPrimary(firstComplete);
    }else{
      // Garde le meilleur candidat personnalisé, puis complète seulement avec des rôles différents.
      addPrimary(firstComponent);
      for(const group of mealRolePriority(focus)){
        if(primary.length>=3)break;
        if(groups.has(group)||selectedGroups.has(group))continue;
        const c=pool.find(x=>eligible(x)&&mealRoleGroup(x)===group&&!used.has(key(x))&&!families.has(guidanceFoodFamily(x)));
        addPrimary(c);
      }
    }

    // Les alternatives restent accessibles, mais elles ne remplissent jamais artificiellement
    // les 3 cartes principales avec un deuxième aliment du même rôle.
    const rest=pool.filter(c=>!used.has(key(c))&&!selectedGroups.has(mealRoleGroup(c))).sort((a,b)=>{
      const ga=mealRoleGroup(a),gb=mealRoleGroup(b);
      const pa=['protein','starch','vegetable','complete','side','accent','beverage'].indexOf(ga);
      const pb=['protein','starch','vegetable','complete','side','accent','beverage'].indexOf(gb);
      return pa-pb;
    });
    const out=[...primary,...rest];
    out.primaryCount=primary.length;
    return out;
  }
  function mealBuildKey(state){
    const ctx=String(state?.mealContext||'meal');
    return `mt_meal_build_v4896617_${localDate()}_${ctx}`;
  }
  function loadMealBuildState(state){
    if(!['breakfast','snack','lunch','dinner'].includes(String(state?.mealContext||'')))return {items:[]};
    try{
      const raw=sessionStorage.getItem(mealBuildKey(state)),parsed=raw?JSON.parse(raw):null;
      return parsed&&Array.isArray(parsed.items)?parsed:{items:[]};
    }catch(_){return {items:[]};}
  }
  function saveMealBuildState(state,data){
    try{sessionStorage.setItem(mealBuildKey(state),JSON.stringify({items:Array.isArray(data?.items)?data.items:[]}));}catch(_){}
  }
  function addMealBuildChoice(state,c){
    const ctx=String(state?.mealContext||''),data=loadMealBuildState(state),group=mealRoleGroup(c),item={key:String(c?.candidate_ref||c?.dictionary_id||c?.ciqual_code||c?.name||'Option'),candidate_ref:c?.candidate_ref||null,ciqual_code:c?.ciqual_code||c?.code||null,dictionary_id:c?.dictionary_id||c?.food_dictionary_id||null,name:c?.name||'Option',group,role:mealIntegrationRole(c),family:guidanceFoodFamily(c),portion_g:n(c?.portion_g),preparation_state:preparationState(c),kcal:n(c?.kcal),protein_g:n(c?.protein_g),fiber_g:n(c?.fiber_g),carbs_g:n(c?.carbs_g),fat_g:n(c?.fat_g)};
    if(['lunch','dinner'].includes(ctx)){
      data.items=(data.items||[]).filter(x=>x?.group!==group);
      data.items.push(item);
    }else{
      data.items=(data.items||[]).filter(x=>String(x?.key||x?.name||'')!==item.key);
      data.items.push(item);
      if(ctx==='snack')data.items=data.items.slice(-2);
    }
    saveMealBuildState(state,data);return data;
  }
  function removeMealBuildChoice(state,token){
    const ctx=String(state?.mealContext||''),data=loadMealBuildState(state);
    if(['lunch','dinner'].includes(ctx))data.items=(data.items||[]).filter(x=>x?.group!==token);
    else data.items=(data.items||[]).filter(x=>String(x?.key||x?.name||'')!==String(token||''));
    saveMealBuildState(state,data);return data;
  }
  function clearMealBuildState(state){try{sessionStorage.removeItem(mealBuildKey(state));}catch(_){}return {items:[]};}
  function mealRoleSelectedLabel(group){return {protein:'✓ Base choisie',starch:'✓ Accompagnement prévu',vegetable:'✓ Végétaux ajoutés',complete:'✓ Repas choisi',side:'✓ Complément retenu'}[group]||'✓ Élément retenu';}
  function mealRoleAlternativeLabel(group){return {protein:'Voir d’autres bases',starch:'Voir d’autres accompagnements',vegetable:'Voir d’autres végétaux',complete:'Voir d’autres repas',side:'Voir d’autres compléments'}[group]||'Voir d’autres options';}
  function mealRoleBrowseTitle(group,state){
    const ctx=String(state?.mealContext||''),meal=ctx==='dinner'?'ton dîner':'ton déjeuner';
    return {protein:`Autres bases pour ${meal}.`,starch:`Autres accompagnements pour ${meal}.`,vegetable:`Autres végétaux pour ${meal}.`,complete:`Autres options pour ${meal}.`,side:`Autres compléments pour ${meal}.`}[group]||`Autres options pour ${meal}.`;
  }
  function mealBuildSummaryHTML(build,state){
    const items=Array.isArray(build?.items)?build.items:[];if(!items.length)return '';
    const ctx=String(state?.mealContext||''),structured=['lunch','dinner'].includes(ctx);
    const title=ctx==='breakfast'?'Ton petit-déjeuner se prépare':ctx==='snack'?'Ta collation se prépare':'Ton repas se construit';
    const rows=items.map(x=>`<div class="mt-food-guide-selected"><div><small>${esc(structured?mealRoleSelectedLabel(x.group):'✓ Ajout prévu')}</small><b>${esc(x.name||'Option')}</b>${x.portion_g?`<span>${esc(fmt(x.portion_g,0))} g</span>`:''}</div><button type="button" class="mt-food-guide-alt" ${structured?`data-mt-guide-change-role="${esc(x.group||'side')}"`:`data-mt-guide-remove-choice="${esc(x.key||x.name||'')}"`}>${structured?'Changer':'Retirer'}</button></div>`).join('');
    return `<div class="mt-food-guide-build"><div class="mt-food-guide-build-title">${title}</div>${rows}<button type="button" class="mt-food-guide-alt" data-mt-guide-reset>${structured?'Recommencer cette sélection':'Vider cette sélection'}</button></div>`;
  }
  function mealRoleCue(c,state){
    const ctx=String(state?.mealContext||''),ctxLabel=ctx==='lunch'?'ton déjeuner':ctx==='dinner'?'ton dîner':'ton repas',prep=preparationState(c),role=mealIntegrationRole(c);
    if(role==='complete_meal')return `Option complète pour ${ctxLabel}`;
    if(role==='protein_base'||role==='protein_fiber')return prep==='requires_cooking'?`À préparer comme base protéinée de ${ctxLabel}`:`Comme base protéinée de ${ctxLabel}`;
    if(role==='starch_base')return prep==='requires_cooking'?`À préparer pour accompagner ${ctxLabel}`:`Pour accompagner ${ctxLabel}`;
    if(role==='vegetable_fiber'||role==='fiber_side')return prep==='requires_cooking'?`À préparer pour compléter ${ctxLabel} en fibres et végétaux`:`Pour compléter ${ctxLabel} en fibres et végétaux`;
    if(role==='meal_accent')return prep==='requires_cooking'?`À préparer en petite place dans ${ctxLabel}`:`À utiliser en complément de ${ctxLabel}`;
    return prep==='requires_cooking'?`À préparer pour compléter ${ctxLabel}`:`Pour compléter ${ctxLabel}`;
  }
  function selectionActionLabel(state){
    const ctx=String(state?.mealContext||'');
    return {breakfast:'Ajouter à mon petit-déjeuner',snack:'Ajouter à ma collation',lunch:'Ajouter à mon déjeuner',dinner:'Ajouter à mon dîner'}[ctx]||'Ajouter à mon repas';
  }
  function adapterActionLabel(state){
    const ctx=String(state?.mealContext||'');
    return {breakfast:'Adapter mon petit-déjeuner',snack:'Adapter ma collation',lunch:'Adapter mon déjeuner',dinner:'Adapter mon dîner'}[ctx]||'Adapter mon prochain repas';
  }
  function openGuidanceMealDraft(state,build){
    const items=(Array.isArray(build?.items)?build.items:[]).map(x=>({ciqual_code:x?.ciqual_code||null,dictionary_id:x?.dictionary_id||null,name:x?.name||'Option',grams:Math.max(1,Number(x?.portion_g)||0)})).filter(x=>x.grams>0&&x.name);
    if(!items.length)return false;
    try{sessionStorage.setItem('mt_guidance_meal_draft_v4896617',JSON.stringify({meal_type:String(state?.mealContext||'lunch'),input:items.map(x=>x.name).join(', '),items}));}catch(_){}
    location.href=`food-meal.html?date=${encodeURIComponent(localDate())}&type=${encodeURIComponent(String(state?.mealContext||'lunch'))}&source=guidance`;
    return true;
  }
  function mealActionLabel(c,state){
    const role=mealIntegrationRole(c),group=mealRoleGroup(c),prep=preparationState(c);
    if(role==='complete_meal')return 'Je choisis ce repas';
    if(group==='protein')return prep==='requires_cooking'?'Je prépare cette base':'Je choisis cette base';
    if(group==='starch')return prep==='requires_cooking'?'Je prévois cet accompagnement':'J’ajoute cet accompagnement';
    if(group==='vegetable')return prep==='requires_cooking'?'Je prépare ce complément':'J’ajoute ce complément';
    if(prep==='requires_cooking')return 'Je le prépare';
    return 'J’ajoute à mon repas';
  }
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
    const amount=focusValue(c,focus),gap=state?.gap,phase=state?.phase||'middle',role=String(c?.guidance_role||'food'),fam=familiarityLevel(c),prep=preparationState(c),family=guidanceFoodFamily(c),ctx=String(state?.mealContext||'');
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
    if(ctx==='snack'){
      if(['dairy','plant_protein','fruit','fat_side','eggs','legumes'].includes(family))score+=12;
      else if(family==='starch')score+=5;
      else if(['processed_meat','pork','beef','lamb','poultry','seafood'].includes(family))score-=45;
    }
    if(role==='meal'&&!familiarityIsExact(c)&&fam!=='similar')score-=12;
    const integrationRole=mealIntegrationRole(c);
    if(integrationRole==='meal_accent')score-=16;
    if(['lunch','dinner'].includes(String(state?.mealContext||''))&&integrationRole==='beverage')score-=30;
    return score;
  }
  function candidateAllowed(c,model,focus,state){
    if(!c||focusValue(c,focus)<=0||looksSmallQuantity(c)||looksCommercialGuidanceExcluded(c)||!cultureSpecificAllowed(c)||!snackFriendlyCandidate(c,state))return false;
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

  function candidateHTML(c,focus,index,state,opts={}){
    const role=String(c.guidance_role||'food'),level=familiarityLevel(c),chip=c.rotation_due?'À varier':level==='habit'?'Dans tes habitudes':level==='consumed'?'Déjà consommé':level==='tee_chosen'?'Déjà choisi avec Tee':level==='similar'?'Proche de tes habitudes':role==='meal'?'Plat complet':'Option TEE';
    const mealStructured=['lunch','dinner'].includes(String(state?.mealContext||''));
    const prep=preparationState(c),cue=mealStructured?mealRoleCue(c,state):preparationCue(c,state),pickLabel=mealStructured?mealActionLabel(c,state):(state?.mealContext==='snack'?'J’ajoute à ma collation':state?.mealContext==='breakfast'?'J’ajoute à mon petit-déjeuner':(['before','early'].includes(state?.phase)?(prep==='requires_cooking'?'Je le prépare':'Je prévois ça'):state?.phase==='closing'?(prep==='requires_cooking'?'Je le prépare pour plus tard':'Je garde cette option'):'Ça me convient'));
    const group=mealRoleGroup(c),roleAlt=mealStructured&&opts?.showRoleAlt?`<button class="mt-food-guide-role-alt" type="button" data-mt-guide-role-more="${esc(group)}">${esc(mealRoleAlternativeLabel(group))}</button>`:'';
    return `<div class="mt-food-guide-option" data-mt-guide-candidate="${index}"><div class="mt-food-guide-option-top"><div><b>${esc(c.name||'Option')}</b><small>${esc(portionLabel(c))}</small><small class="mt-food-guide-prep">${esc(cue)}</small></div><span class="mt-food-guide-chip">${esc(chip)}</span></div><div class="mt-food-guide-metrics">${metricLine(c,focus)}</div><button class="mt-food-guide-pick" type="button" data-mt-guide-pick="${index}">${esc(pickLabel)}</button>${roleAlt}</div>`;
  }
  function microCandidateHTML(c,focus,index,context){
    const level=familiarityLevel(c),chip=c.rotation_due?'À varier':level==='habit'?'Dans tes habitudes':level==='consumed'?'Déjà consommé':level==='tee_chosen'?'Déjà choisi avec Tee':level==='similar'?'Proche de tes habitudes':'Petit renfort TEE';
    const cue=context==='breakfast'?'Petit apport facultatif avant ton premier vrai repas':'Petit apport facultatif entre tes repas';
    return `<div class="mt-food-guide-option" data-mt-guide-candidate="${index}"><div class="mt-food-guide-option-top"><div><b>${esc(c.name||'Option')}</b><small>${esc(portionLabel(c))}</small><small class="mt-food-guide-prep">${esc(cue)}</small></div><span class="mt-food-guide-chip">${esc(chip)}</span></div><div class="mt-food-guide-metrics">${metricLine(c,focus)}</div><button class="mt-food-guide-pick" type="button" data-mt-guide-pick="${index}">Ça me convient</button></div>`;
  }

  function renderHost(host,{model,decision,payload,experience=false,start=0,browseRole=null}){
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
      const isBreakfast=slot?.context==='breakfast';
      host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">${isBreakfast?'Ce matin':'Pour ta collation'}</div><h3>Pas besoin de forcer un repas.</h3><p>Ce moment ne fait généralement pas partie de ton rythme et aucun petit renfort n’est utile maintenant. Tee garde le prochain vrai repas comme point d’appui.</p></section>`;
      return;
    }
    if(guidanceMode==='micro_reinforcement'){
      const context=String(payload?.micro_opportunity?.context||slot?.context||''),ranked=sortedMicroCandidates(payload,model,focus,state,context),visible=ranked.slice(start,start+3),gesture=experience?experimentGesture(decision,focus):null;
      const isBreakfast=context==='breakfast',title=isBreakfast?'Un petit renfort peut t’aider ce matin.':'Un petit renfort peut t’aider maintenant.';
      const copy=isBreakfast?'Tu ne prends généralement pas de petit-déjeuner. Pas besoin d’en créer un : Tee te propose seulement une petite option si elle peut alléger ce qu’il restera à répartir plus tard.':'Tu ne prends généralement pas de collation. Tee n’en impose pas une : cette petite option reste facultative et sert seulement à éviter de concentrer l’essentiel sur le repas suivant.';
      host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">Petit renfort facultatif</div><h3>${esc(title)}</h3><p>${esc(copy)}</p>${gesture?`<div class="mt-food-guide-gesture"><b>Jour ${gesture.day}/7 · le geste d’aujourd’hui</b>${esc(gesture.text)}</div>`:''}<div class="mt-food-guide-options">${visible.map((c,i)=>microCandidateHTML(c,focus,start+i,context)).join('')}</div><div class="mt-food-guide-actions">${ranked.length>start+3?'<button type="button" class="mt-food-guide-btn" data-mt-guide-more>Voir d’autres petits renforts</button>':''}<button type="button" class="mt-food-guide-btn primary" data-mt-guide-wait>Je préfère attendre mon prochain repas</button></div></section>`;
      host.querySelectorAll('[data-mt-guide-pick]').forEach(btn=>btn.addEventListener('click',async()=>{const idx=Number(btn.dataset.mtGuidePick),c=ranked[idx];if(!c)return;btn.disabled=true;await log('chosen',focus,c,{mealContext:context,payload:{micro_reinforcement:true,micro_context:context,portion_g:c.portion_g}});btn.classList.add('is-picked');btn.textContent='✓ Petit renfort prévu';}));
      host.querySelector('[data-mt-guide-more]')?.addEventListener('click',()=>renderHost(host,{model,decision,payload,experience,start:(start+3)>=ranked.length?0:start+3}));
      host.querySelector('[data-mt-guide-wait]')?.addEventListener('click',async()=>{await log('micro_declined',focus,null,{mealContext:context,payload:{micro_reinforcement:true,micro_context:context,reason:'wait_next_meal'}});host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">Ton rythme est respecté</div><h3>Pas besoin d’ajouter un repas.</h3><p>Tee garde ton prochain vrai repas comme point d’appui et continuera d’ajuster la journée avec ce que tu renseignes.</p></section>`;});
      return;
    }
    const ranked=sortedCandidates(payload,model,focus,state),structuredMainMeal=['lunch','dinner'].includes(String(slot?.context||'')),build=loadMealBuildState(state),selectedGroups=(build.items||[]).map(x=>x.group);
    const rolePool=structuredMainMeal&&browseRole?ranked.filter(c=>mealRoleGroup(c)===browseRole&&!['accent','beverage'].includes(mealRoleGroup(c))):null;
    const candidates=rolePool||structuredMealCandidates(ranked,state,focus,{selectedGroups});
    const structuredPrimaryCount=Number(candidates?.primaryCount);
    const primaryCount=rolePool?Math.min(6,candidates.length):(Number.isFinite(structuredPrimaryCount)?Math.max(0,structuredPrimaryCount):Math.min(3,candidates.length));
    const pageSize=rolePool?primaryCount:(start===0?primaryCount:Math.min(3,Math.max(0,candidates.length-start)));
    const visible=candidates.slice(rolePool?0:start,(rolePool?0:start)+pageSize),preparing=slot?.context==='breakfast';
    const gesture=experience?experimentGesture(decision,focus):null;
    const slotKicker={breakfast:'Ce matin',lunch:'Pour ton déjeuner',snack:'Pour ta collation',dinner:'Pour ton dîner'}[slot?.context]||(preparing?'À prévoir aujourd’hui':'Concrètement maintenant');
    const slotTitle=browseRole?mealRoleBrowseTitle(browseRole,state):({breakfast:'Tee prépare ton matin.',lunch:'Tee prépare ton déjeuner.',snack:'Tee prépare ta collation.',dinner:'Tee prépare ton dîner.'}[slot?.context]||(preparing?'Tee prépare ta journée.':'Tee transforme ce repère en options.'));
    const guideCopy=browseRole?'Choisis simplement l’alternative qui te convient pour ce rôle. Le reste de ton repas ne change pas.':(structuredMainMeal?'Ton repère est réparti progressivement sur les moments alimentaires restants. Tee te propose seulement les éléments les plus utiles pour construire ton repas, à partir de tes habitudes et de ce qui est documenté aujourd’hui.':pacingCopy(model,payload,focus));
    const buildSummary=mealBuildSummaryHTML(build,state);
    const buildComplete=structuredMainMeal&&(build.items||[]).some(x=>x.group==='complete');
    const selectedMealGroups=new Set((build.items||[]).map(x=>String(x?.group||'')));
    const mealCoreReady=selectedMealGroups.has('protein')&&selectedMealGroups.has('starch');
    const emptyCopy=buildComplete?'Tu as déjà retenu une option complète pour ce repas. Tee ne rajoute rien automatiquement autour.':(mealCoreReady?'Ton repas prend forme. Ta base et ton accompagnement sont déjà posés. Aucun végétal ou apport en fibres assez pertinent ne ressort maintenant, donc Tee préfère s’arrêter là plutôt que d’ajouter un aliment inutile.':(structuredMainMeal&&(build.items||[]).length?'Ta sélection est posée. Aucun autre rôle assez pertinent ne ressort pour compléter ce repas maintenant.':'Aucun aliment assez pertinent ne ressort pour ce besoin maintenant. Ton repas peut rester libre, ou être travaillé avec Adapter mon repas.'));
    const candidateMarkup=visible.map((c,i)=>{const idx=(rolePool?i:start+i),group=mealRoleGroup(c),hasAlt=!browseRole&&structuredMainMeal&&ranked.some(x=>x!==c&&mealRoleGroup(x)===group&&!['accent','beverage'].includes(group));return candidateHTML(c,focus,idx,state,{showRoleAlt:hasAlt});}).join('');
    const topActions=browseRole?'<button type="button" class="mt-food-guide-btn" data-mt-guide-back>Retour à mon repas</button>':((!structuredMainMeal&&candidates.length>primaryCount)?'<button type="button" class="mt-food-guide-btn" data-mt-guide-more>Voir d’autres options</button>':'');
    const addAction=(build.items||[]).length?`<button type="button" class="mt-food-guide-btn primary" data-mt-guide-to-meal>${esc(selectionActionLabel(state))}</button>`:'';
    host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">${esc(slotKicker)}</div><h3>${esc(slotTitle)}</h3><p>${esc(guideCopy)}</p>${gesture?`<div class="mt-food-guide-gesture"><b>Jour ${gesture.day}/7 · le geste d’aujourd’hui</b>${esc(gesture.text)}</div>`:''}${buildSummary}${visible.length?`<div class="mt-food-guide-options">${candidateMarkup}</div>`:`<div class="mt-food-guide-gesture"><b>Tee garde le repas simple</b>${esc(emptyCopy)}</div>`}<div class="mt-food-guide-actions">${topActions}${addAction}<button type="button" class="mt-food-guide-btn${(build.items||[]).length?'':' primary'}" data-mt-guide-adapter>${esc(adapterActionLabel(state))}</button></div><p class="mt-food-guide-note">Un choix reste une intention tant que tu n’as pas confirmé ce que tu as réellement mangé.</p></section>`;

    const bindPickButtons=(root)=>root.querySelectorAll('[data-mt-guide-pick]').forEach(btn=>btn.addEventListener('click',async()=>{
      const idx=Number(btn.dataset.mtGuidePick),c=candidates[idx];if(!c)return;btn.disabled=true;await log('chosen',focus,c,{mealContext:state?.mealContext||null,payload:{portion_g:c.portion_g,focus_amount:c.focus_amount,preparation_state:preparationState(c),familiarity_level:familiarityLevel(c),meal_integration_role:mealIntegrationRole(c),meal_role_group:mealRoleGroup(c),food_family:guidanceFoodFamily(c)}});
      addMealBuildChoice(state,c);renderHost(host,{model,decision,payload,experience,start:0,browseRole:null});return;
    }));
    bindPickButtons(host);
    host.querySelectorAll('[data-mt-guide-role-more]').forEach(btn=>btn.addEventListener('click',()=>renderHost(host,{model,decision,payload,experience,start:0,browseRole:String(btn.dataset.mtGuideRoleMore||'')})));
    host.querySelectorAll('[data-mt-guide-change-role]').forEach(btn=>btn.addEventListener('click',()=>renderHost(host,{model,decision,payload,experience,start:0,browseRole:String(btn.dataset.mtGuideChangeRole||'')})));
    host.querySelector('[data-mt-guide-back]')?.addEventListener('click',()=>renderHost(host,{model,decision,payload,experience,start:0,browseRole:null}));
    host.querySelector('[data-mt-guide-more]')?.addEventListener('click',()=>{const section=host.querySelector('.mt-food-guide-options');if(!section)return;section.innerHTML=candidates.slice(0,Math.min(9,candidates.length)).map((c,i)=>candidateHTML(c,focus,i,state)).join('');bindPickButtons(section);host.querySelector('[data-mt-guide-more]')?.remove();});
    host.querySelector('[data-mt-guide-alt]')?.addEventListener('click',async()=>{await log('alternative',focus,null,{payload:{start}});const next=(start+3)>=candidates.length?0:start+3;renderHost(host,{model,decision,payload,experience,start:next,browseRole:null});});
    host.querySelectorAll('[data-mt-guide-remove-choice]').forEach(btn=>btn.addEventListener('click',()=>{removeMealBuildChoice(state,String(btn.dataset.mtGuideRemoveChoice||''));renderHost(host,{model,decision,payload,experience,start:0,browseRole:null});}));
    host.querySelector('[data-mt-guide-reset]')?.addEventListener('click',()=>{clearMealBuildState(state);renderHost(host,{model,decision,payload,experience,start:0,browseRole:null});});
    host.querySelector('[data-mt-guide-to-meal]')?.addEventListener('click',async()=>{await log('meal_confirmed',focus,null,{mealContext:state?.mealContext||null,payload:{source:'tee_guidance',items:(build.items||[]).map(x=>({name:x.name,portion_g:x.portion_g}))}});openGuidanceMealDraft(state,build);});
    host.querySelector('[data-mt-guide-adapter]')?.addEventListener('click',async()=>{await log('adapter_opened',focus,null,{payload:{source:'home_guidance'}});try{sessionStorage.setItem('mt_food_guidance_focus_v1',focus);}catch(_){}location.href=`food-adapter.html?source=tee-guidance&focus=${encodeURIComponent(focus)}&type=${encodeURIComponent(String(state?.mealContext||''))}`;});
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
        const baseFirst=microMode?sortedMicroCandidates(payload,opts.model,focus,state,microContext):sortedCandidates(payload,opts.model,focus,state);
        const buildForShown=(!microMode&&['lunch','dinner'].includes(String(state?.mealContext||'')))?loadMealBuildState(state):{items:[]};
        const structuredForShown=microMode?baseFirst:structuredMealCandidates(baseFirst,state,focus,{selectedGroups:(buildForShown.items||[]).map(x=>x.group)});
        const shownPrimaryCount=Number(structuredForShown?.primaryCount);
        const shownCount=microMode?3:(Number.isFinite(shownPrimaryCount)?Math.max(0,shownPrimaryCount):Math.min(3,structuredForShown.length));
        const first=structuredForShown.slice(0,shownCount);
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

  window.MTFoodGuidance={load,loadRhythm,mount,log,focusFromDecision,experimentGesture,bindExperimentCheckin,modelNumbers,pacingState,selectPacingDecision,learnedRhythm,learnedMealSchedule,fixedMealWindow,mealContextDecision,currentMealContext,contextHabitStats,skippedMomentOpportunity,rankCandidates:sortedCandidates,rankMicroCandidates:sortedMicroCandidates,structureMealCandidates:structuredMealCandidates,mealIntegrationRole,mealRoleGroup,guidanceFoodFamily,pacingCopy,preparationState,familiarityLevel,loadMealBuildState,clearMealBuildState,removeMealBuildChoice,openGuidanceMealDraft};
})();
