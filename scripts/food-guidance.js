/* MÉTHODE TEE · V4896645 · contexte nutritionnel global + repas construits
 * Couche d'action au-dessus de MTReference / MTAdaptive.
 * - bibliothèque réelle + produits scannés mémorisés côté serveur
 * - portions réalistes, familiarité, rotation et contexte repas
 * - déjeuner/dîner : base protéinée → accompagnement → végétaux, un rôle à la fois
 * - chaque étape est un vrai bouton visible ; les rôles suivants utilisent leur propre classement nutritionnel
 * - un choix reste une intention jusqu’à l’enregistrement réel dans Ma journée alimentaire
 * - aucune interprétation de « non documenté » comme carence
 */
(function(){
  'use strict';
  if(window.MTFoodGuidance)return;

  const CACHE=new Map(),ADDON_CACHE=new Map(),CONTEXT_CACHE=new Map(),TTL=3*60*1000;
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
    .mt-food-guide-host{min-height:0}.mt-food-guide-quiet-loader{height:34px;display:flex;align-items:center;justify-content:center;gap:5px;opacity:.78}.mt-food-guide-quiet-loader i{width:4px;height:4px;border-radius:999px;background:#a77f35;opacity:.22;animation:mtGuideQuietDot 1.25s ease-in-out infinite}.mt-food-guide-quiet-loader i:nth-child(2){animation-delay:.16s}.mt-food-guide-quiet-loader i:nth-child(3){animation-delay:.32s}.mt-food-guide-host.is-initial-reveal{overflow:hidden;height:0;opacity:0;transform:translateY(5px);filter:blur(.45px);will-change:height,opacity,transform,filter}.mt-food-guide-host.is-initial-reveal.is-visible{opacity:1;transform:translateY(0);filter:blur(0)}@keyframes mtGuideQuietDot{0%,72%,100%{opacity:.18;transform:translateY(0)}36%{opacity:.72;transform:translateY(-1px)}}
    .mt-food-guide-kicker{font-size:11px;font-weight:850;letter-spacing:.15em;text-transform:uppercase;color:#a77f35;margin-bottom:6px}
    .mt-food-guide h3{font-family:Georgia,serif;font-size:24px;line-height:1.08;font-weight:400;margin:0 0 8px;color:#164b3f}
    .mt-food-guide>p{margin:0 0 13px;line-height:1.55;color:#315c52;font-size:14px}
    .mt-food-guide-gesture{padding:12px 13px;border-radius:15px;background:#fffaf2;border:1px solid #eadfc9;margin:0 0 13px;font-size:13px;line-height:1.5;color:#695e55}.mt-food-guide-gesture b{display:block;color:#164b3f;margin-bottom:3px}
    .mt-food-guide-options{display:grid;gap:9px}.mt-food-guide-option{background:#fffdf8;border:1px solid #e5dac7;border-radius:16px;padding:12px 13px;transition:border-color .16s ease,background .16s ease,transform .16s ease}.mt-food-guide-option.is-selectable{cursor:pointer}.mt-food-guide-option.is-selectable:hover,.mt-food-guide-option.is-selectable:focus-within{border-color:#cdbb94;background:#fffaf4}.mt-food-guide-option.is-selected{border-color:#cdbb94;background:#fffaf2}.mt-food-guide-option-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.mt-food-guide-option b{color:#164b3f;line-height:1.25}.mt-food-guide-option small{display:block;color:#88796c;margin-top:3px;line-height:1.35}.mt-food-guide-option .mt-food-guide-prep{color:#587168;font-weight:700;margin-top:5px}.mt-food-guide-chip{flex:0 0 auto;font-size:10px;font-weight:800;color:#9b762f;background:#f6ecd6;border-radius:99px;padding:5px 7px}.mt-food-guide-metrics{font-size:12px;color:#315c52;margin-top:8px}.mt-food-guide-pick{display:flex;align-items:center;justify-content:center;width:100%;margin-top:11px;border:1px solid #164b3f;background:#f7fbf9;color:#164b3f;border-radius:999px;font-weight:850;padding:10px 12px;font-size:12.5px;line-height:1.2;cursor:pointer;transition:background .15s ease,color .15s ease,opacity .15s ease}.mt-food-guide-pick:hover,.mt-food-guide-pick:focus-visible{background:#164b3f;color:#fff}.mt-food-guide-pick:disabled{opacity:.58;cursor:default}.mt-food-guide-pick.is-picked{color:#9b762f;border-color:#cdbb94;background:#fffaf2}.mt-food-guide-pick.is-premium-inline{display:inline-flex;align-items:center;justify-content:flex-start;width:auto;margin-top:10px;padding:5px 0 4px;border:0;border-bottom:1px solid rgba(155,118,47,.52);border-radius:0;background:transparent;color:#164b3f;font-size:12.5px;font-weight:850;line-height:1.25;letter-spacing:.005em}.mt-food-guide-pick.is-premium-inline:hover,.mt-food-guide-pick.is-premium-inline:focus-visible{background:transparent;color:#0f3c32;border-bottom-color:#9b762f}.mt-food-guide-pick.is-premium-inline:disabled{opacity:1;color:#9b762f;border-bottom-color:transparent}.mt-food-guide-role-alt{display:block;margin-top:8px;border:0;background:transparent;color:#8a796c;font-weight:750;padding:0;font-size:11px;text-decoration:underline;text-underline-offset:2px}.mt-food-guide-step-hint{display:flex;align-items:center;gap:7px;margin:0 0 9px;padding:9px 11px;border-radius:12px;background:#dfece7;color:#164b3f;font-size:11.5px;font-weight:800;line-height:1.35}.mt-food-guide-step-hint span{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:99px;background:#164b3f;color:#fff;font-size:10px}
    .mt-food-guide-transition{display:flex;align-items:center;gap:10px;margin:11px 0 2px;padding:10px 12px;border-radius:13px;background:rgba(255,250,242,.78);border:1px solid #eadfc9;color:#587168;font-size:11.5px;font-weight:750;line-height:1.35;opacity:0;transform:translateY(2px);animation:mtGuideTransitionIn .52s cubic-bezier(.22,1,.36,1) forwards;transition:opacity .34s cubic-bezier(.22,1,.36,1),transform .34s cubic-bezier(.22,1,.36,1),filter .30s ease;filter:blur(.25px)}.mt-food-guide-transition.is-leaving{opacity:0!important;transform:translateY(-1px)!important;filter:blur(.35px)!important}.mt-food-guide-transition-mark{width:7px;height:7px;border-radius:999px;background:#a77f35;box-shadow:0 0 0 4px rgba(167,127,53,.09);flex:0 0 auto}.mt-food-guide-transition-dots{display:inline-flex;gap:3px;margin-left:auto;flex:0 0 auto}.mt-food-guide-transition-dots i{width:4px;height:4px;border-radius:99px;background:#a77f35;opacity:.28;animation:mtGuideDot 1.15s ease-in-out infinite}.mt-food-guide-transition-dots i:nth-child(2){animation-delay:.16s}.mt-food-guide-transition-dots i:nth-child(3){animation-delay:.32s}.mt-food-guide-next-step-shell{display:grid;grid-template-rows:1fr;opacity:1;transform:translateY(0);filter:blur(0)}.mt-food-guide-next-step-shell>.mt-food-guide-next-step{min-height:0;overflow:hidden}.mt-food-guide-next-step-shell.is-entering{grid-template-rows:0fr;opacity:0;transform:translateY(4px);filter:blur(.35px);transition:grid-template-rows .90s cubic-bezier(.22,1,.36,1),opacity .82s cubic-bezier(.22,1,.36,1) .04s,transform .90s cubic-bezier(.22,1,.36,1) .02s,filter .48s ease .02s;will-change:grid-template-rows,opacity,transform,filter}.mt-food-guide-next-step-shell.is-entering.is-visible{grid-template-rows:1fr;opacity:1;transform:translateY(0);filter:blur(0)}.mt-food-guide-next-step-shell.is-entering .mt-food-guide-step-hint,.mt-food-guide-next-step-shell.is-entering .mt-food-guide-options,.mt-food-guide-next-step-shell.is-entering .mt-food-guide-gesture{opacity:0;transform:translateY(3px)}.mt-food-guide-next-step-shell.is-entering.is-visible .mt-food-guide-step-hint{opacity:1;transform:translateY(0);transition:opacity .72s cubic-bezier(.22,1,.36,1) .12s,transform .82s cubic-bezier(.22,1,.36,1) .08s}.mt-food-guide-next-step-shell.is-entering.is-visible .mt-food-guide-options,.mt-food-guide-next-step-shell.is-entering.is-visible .mt-food-guide-gesture{opacity:1;transform:translateY(0);transition:opacity .80s cubic-bezier(.22,1,.36,1) .18s,transform .88s cubic-bezier(.22,1,.36,1) .14s}@keyframes mtGuideTransitionIn{to{opacity:1;transform:translateY(0);filter:blur(0)}}@keyframes mtGuideDot{0%,72%,100%{opacity:.2;transform:translateY(0)}36%{opacity:.82;transform:translateY(-1.5px)}}@media (prefers-reduced-motion:reduce){.mt-food-guide-transition,.mt-food-guide-transition-dots i{animation:none!important;opacity:1!important;transform:none!important;filter:none!important}.mt-food-guide-next-step-shell,.mt-food-guide-next-step-shell.is-entering,.mt-food-guide-next-step-shell.is-entering.is-visible{grid-template-rows:1fr!important;opacity:1!important;transform:none!important;filter:none!important;transition:none!important}.mt-food-guide-next-step-shell.is-entering .mt-food-guide-step-hint,.mt-food-guide-next-step-shell.is-entering .mt-food-guide-options,.mt-food-guide-next-step-shell.is-entering .mt-food-guide-gesture{opacity:1!important;transform:none!important;transition:none!important}}
    @media (prefers-reduced-motion:reduce){.mt-food-guide-quiet-loader i{animation:none!important;opacity:.45!important}.mt-food-guide-host.is-initial-reveal,.mt-food-guide-host.is-initial-reveal.is-visible{height:auto!important;opacity:1!important;transform:none!important;filter:none!important;transition:none!important}}
    .mt-food-guide-build{padding:12px 13px;border-radius:15px;background:#fffaf2;border:1px solid #eadfc9;margin:0 0 13px}.mt-food-guide-build-title{font-weight:850;color:#164b3f;margin-bottom:8px}.mt-food-guide-selected{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #eee2ce}.mt-food-guide-selected:first-of-type{border-top:0}.mt-food-guide-selected small{display:block;color:#9b762f;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.04em}.mt-food-guide-selected b{display:block;color:#164b3f;margin-top:2px}.mt-food-guide-selected span{display:block;color:#88796c;font-size:11px;margin-top:2px}
    .mt-food-guide-context{margin:0 0 12px;padding:9px 11px;border-radius:13px;background:#edf4f1;color:#315c52;font-size:10.8px;line-height:1.45}.mt-food-guide-context b{display:block;color:#164b3f;font-size:10px;letter-spacing:.05em;text-transform:uppercase;margin-bottom:2px}.mt-food-guide-context span{display:block}
    .mt-food-guide-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:13px}.mt-food-guide-btn{border:1px solid #cdbb94;background:#fffaf2;color:#164b3f;border-radius:999px;padding:12px 14px;font-weight:850;font-size:13px}.mt-food-guide-btn.primary{background:#164b3f;border-color:#164b3f;color:white}.mt-food-guide-alt{border:0;background:transparent;color:#75685d;font-weight:750;padding:8px 4px;font-size:12px}
    .mt-food-guide-note{font-size:11px!important;color:#8b7c70!important;margin:11px 0 0!important;line-height:1.45!important}
    .mt-food-guide-addon{margin:11px 0 0;padding:11px 12px;border-radius:14px;background:rgba(255,250,242,.76);border:1px solid #e7d9bd}.mt-food-guide-addon-kicker{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#a77f35}.mt-food-guide-addon-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-top:5px}.mt-food-guide-addon-copy b{display:block;color:#164b3f;font-size:13px;line-height:1.3}.mt-food-guide-addon-copy span{display:block;color:#75685d;font-size:11px;line-height:1.4;margin-top:2px}.mt-food-guide-addon-action{flex:0 0 auto;border:0;background:transparent;color:#164b3f;font-weight:850;font-size:11.5px;padding:2px 0;border-bottom:1px solid rgba(155,118,47,.45)}.mt-food-guide-addon-action.is-added{color:#9b762f;border-bottom-color:transparent}.mt-food-guide-addon-none{font-size:11px;color:#8b7c70;margin-top:4px}
    .mt-exp-checkin-panel{margin:12px 0 2px;padding:15px;border-radius:18px;background:#f6f0e5;border:1px solid #e4d5ba}.mt-exp-checkin-panel b{display:block;color:#164b3f;margin-bottom:9px}.mt-exp-checkin-grid{display:flex;flex-wrap:wrap;gap:7px}.mt-exp-checkin-choice{border:1px solid #d6c6a9;background:#fffaf2;color:#164b3f;border-radius:99px;padding:9px 11px;font-weight:750;font-size:12px}.mt-exp-checkin-choice.is-selected{background:#164b3f;color:white;border-color:#164b3f}.mt-exp-checkin-step{margin-top:12px}.mt-exp-checkin-saved{color:#164b3f;font-weight:850}
  `;document.head.appendChild(s);}

  async function rpc(name,args){const sb=client();if(!sb)throw new Error('Connexion indisponible.');const {data,error}=await sb.rpc(name,args||{});if(error)throw error;return data;}
  async function fetchDecisionContext(date=localDate()){
    const key=String(date||localDate()),cached=CONTEXT_CACHE.get(key);if(cached&&Date.now()-cached.at<TTL)return cached.data;
    try{
      const data=await rpc('mt_food_decision_context_v1',{p_target_date:key});
      const safe=data&&typeof data==='object'?data:{};CONTEXT_CACHE.set(key,{at:Date.now(),data:safe});return safe;
    }catch(e){
      console.warn('[V4896645] contexte nutritionnel global indisponible',e);const safe={};CONTEXT_CACHE.set(key,{at:Date.now(),data:safe});return safe;
    }
  }
  function attachDecisionContext(payload,ctx){if(payload&&typeof payload==='object')payload.__tee_global_context=ctx&&typeof ctx==='object'?ctx:{};return payload;}
  function globalContext(payload,model){
    const remote=payload?.__tee_global_context&&typeof payload.__tee_global_context==='object'?payload.__tee_global_context:{};
    const local=model?.context&&typeof model.context==='object'?model.context:{};
    return {remote,local};
  }
  function contextText(v){return normText(Array.isArray(v)?v.join(' '):v||'');}
  function profileGoalMode(model,payload){
    const {remote}=globalContext(payload,model),profile=remote?.profile||{},settings=profile?.reference_settings||{};
    const canonical=[settings?.body_intention,model?.bodyIntent,profile?.main_goal].map(x=>String(x||'').trim()).find(Boolean)||'';
    const t=normText(canonical);
    if(/prise.*masse|masse.*saine|construction|prendre.*poids|gain/.test(t))return {key:'mass_gain',label:canonical,source:'profile'};
    if(/recomposition|definition|définition/.test(t))return {key:'recomposition',label:canonical,source:'profile'};
    if(/perdre.*graisse|perte.*poids|legerete|légèreté/.test(t))return {key:'loss',label:canonical,source:'profile'};
    if(/energie|énergie|performance/.test(t))return {key:'energy',label:canonical,source:'profile'};
    if(/digestion|digestif/.test(t))return {key:'digestion',label:canonical,source:'profile'};
    return {key:'neutral',label:canonical||'Observer sans objectif chiffré',source:canonical?'profile':'none'};
  }
  function contextSemanticTags(model,payload,state=null){
    const {remote,local}=globalContext(payload,model),tags=new Set(),why=[];
    const goal=profileGoalMode(model,payload);if(goal.key!=='neutral'){tags.add(goal.key);why.push(`objectif du profil : ${goal.label}`);}
    const addSource=(label,fn)=>{const before=tags.size;fn();if(tags.size>before)why.push(label);};
    const current=String(state?.mealContext||'');
    const mealRelevant=row=>{
      const t=contextText(`${row?.title||''} ${row?.sub||''} ${row?.short_text||''} ${row?.description||''}`);
      const names={breakfast:/petit.?dejeuner|matin/,lunch:/dejeuner|midi/,snack:/collation|gouter|goûter|apres.?midi/,dinner:/diner|soir/};
      const mentioned=Object.entries(names).filter(([,re])=>re.test(t)).map(([k])=>k);
      return !mentioned.length||mentioned.includes(current);
    };
    const parseNutritionText=t=>{
      if(/protein|proteine|protéine/.test(t))tags.add('context_protein');
      if(/fibre|vegetal|végétal|legume|légume/.test(t))tags.add('context_fiber');
      if(/hydrat|\beau\b|boisson/.test(t))tags.add('context_hydration');
      if(/recuper|récup|sommeil|repos/.test(t))tags.add('context_recovery');
      if(/digestion|digestif|ballonn|reflux|aigreur/.test(t))tags.add('context_digestive');
      if(/sans.*boisson.*sucr|sucre/.test(t))tags.add('context_sugar');
    };
    const protocols=[...(Array.isArray(remote?.active_protocols)?remote.active_protocols:[]),...(Array.isArray(local?.active_protocols)?local.active_protocols:[])];
    addSource('protocole en cours',()=>{
      const t=contextText(protocols.map(x=>`${x?.title||''} ${x?.slug||''}`));
      if(/prise.*masse|masse.*saine|construction|muscle/.test(t))tags.add('program_mass_gain');
      if(/recomposition|definition/.test(t))tags.add('program_recomposition');
      if(/ventre|digest|reflux|aigreur/.test(t))tags.add('program_digestive');
      if(/sommeil|stress|anxi|cortisol/.test(t))tags.add('program_recovery');
      if(/stop.*sucre|sucre/.test(t))tags.add('program_sugar');
    });
    const trackerPrefs=Array.isArray(remote?.active_trackers)?remote.active_trackers:[],trackerToday=Array.isArray(remote?.today_tracker_entries)?remote.today_tracker_entries:[];
    addSource('suivis actifs',()=>{
      for(const x of trackerPrefs){
        const t=contextText(`${x?.tracker_key||''} ${JSON.stringify(x?.settings||{})}`);parseNutritionText(t);
        const observed=Array.isArray(x?.settings?.observed_nutrients)?x.settings.observed_nutrients.map(String):[];
        if(observed.includes('protein'))tags.add('tracking_protein');if(observed.includes('fiber'))tags.add('tracking_fiber');
      }
      for(const x of trackerToday)parseNutritionText(contextText(`${x?.tracker_key||''} ${JSON.stringify(x?.values||{})}`));
    });
    const rituals=(Array.isArray(remote?.daily_rituals)?remote.daily_rituals:[]).filter(mealRelevant);
    addSource('rituel du jour',()=>parseNutritionText(contextText(rituals.map(x=>`${x?.title||''} ${x?.sub||''}`))));
    const journeyRows=(Array.isArray(remote?.community_journey?.items)?remote.community_journey.items:[]).filter(x=>x?.completed!==true).filter(mealRelevant),journeySettings=remote?.community_journey?.settings||{};
    addSource('Notre journée ensemble',()=>parseNutritionText(contextText([`${journeySettings?.title||''} ${journeySettings?.subtitle||''}`,...journeyRows.map(x=>`${x?.title||''} ${x?.short_text||''}`)])));
    const routines=(Array.isArray(remote?.routines_today)?remote.routines_today:[]).filter(r=>r?.completed_today!==true).filter(r=>{
      const dp=String(r?.daypart||'').toLowerCase();return mealRelevant(r)&&(!dp||dp==='any'||(current==='breakfast'&&/morning|matin/.test(dp))||(current==='lunch'&&/midday|midi|lunch/.test(dp))||(current==='snack'&&/afternoon|apres|collation/.test(dp))||(current==='dinner'&&/evening|soir/.test(dp)));
    });
    addSource('routine active',()=>parseNutritionText(contextText(routines.map(x=>`${x?.title||''} ${x?.description||''} ${JSON.stringify(x?.steps||[])}`))));
    return {goal,tags,why:[...new Set(why)]};
  }
  function firstNumeric(...vals){for(const v of vals){const x=n(v);if(x!==null)return x;}return null;}
  function hydrationContext(model,payload){
    const {remote,local}=globalContext(payload,model),core=remote?.today_reference?.core||local?.today||{},activity=remote?.daily_activity||{},bev=remote?.beverages_today||{},entries=Array.isArray(remote?.today_tracker_entries)?remote.today_tracker_entries:[];
    let feeling=null;for(const e of entries){const v=e?.values||{};const x=firstNumeric(v.hydration,v.hydration_feeling);if(x!==null){feeling=x;break;}}
    const activityLiters=activity?.has_hydration===true?firstNumeric(activity.hydration_liters):null;
    const referenceLiters=firstNumeric(core.hydration_liters,core.beverage_hydration_liters,model?.beverageContext?.today?.hydration_liters);
    const directLiters=activityLiters!==null?activityLiters:referenceLiters,beverageLiters=Number(bev?.entry_count||0)>0&&firstNumeric(bev.hydration_ml)!==null?firstNumeric(bev.hydration_ml)/1000:null;
    const liters=directLiters!==null?directLiters:beverageLiters;
    return {liters,feeling,known:liters!==null||feeling!==null,source:directLiters!==null?'daily_activity':beverageLiters!==null?'beverages':feeling!==null?'tracker':null};
  }
  function globalNutritionState(model,payload,state=null){
    const defs=[
      {focus:'energy',key:'energy_review',label:'énergie',unit:'kcal'},
      {focus:'protein',key:'protein',label:'protéines',unit:'g'},
      {focus:'fiber',key:'density',label:'fibres',unit:'g'}
    ].map(d=>{const x=modelNumbers(model,d.focus),gap=x.current!==null&&x.low!==null?Math.max(0,x.low-x.current):null,ratio=gap!==null&&x.low>0?clamp(gap/x.low,0,1.5):0;return {...d,...x,gap,ratio};});
    const {remote}=globalContext(payload,model),by=Object.fromEntries(defs.map(x=>[x.focus,x])),semantic=contextSemanticTags(model,payload,state),hydration=hydrationContext(model,payload);
    const digestion=firstNumeric(remote?.today_reference?.core?.digestion,remote?.today_reference?.core?.food_digestion,model?.today?.digestion),digestiveCaution=digestion!==null&&digestion<=4;
    const meaningful=defs.filter(x=>x.gap!==null&&x.gap>(x.focus==='energy'?120:x.focus==='protein'?5:2));
    return {needs:defs,by,meaningful,goal:semantic.goal,tags:semantic.tags,contextWhy:semantic.why,hydration,digestion,digestiveCaution};
  }
  async function fetchGuidance(focus,date,mealContext){
    const key=`${focus}|${date}|${mealContext||'neutral'}`,cached=CACHE.get(key);if(cached&&Date.now()-cached.at<TTL)return cached.data;
    let data;
    try{data=await rpc('mt_food_guidance_v9',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}
    catch(_v9){try{data=await rpc('mt_food_guidance_v8',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}
    catch(_v8){try{data=await rpc('mt_food_guidance_v7',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}
    catch(_v7){try{data=await rpc('mt_food_guidance_v6',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}
    catch(_v6){try{data=await rpc('mt_food_guidance_v5',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}
    catch(_v5){try{data=await rpc('mt_food_guidance_v4',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}
    catch(_v4){try{data=await rpc('mt_food_guidance_v3',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}
    catch(_v3){try{data=await rpc('mt_food_guidance_v2',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}
    catch(_v2){data=await rpc('mt_food_guidance_v1',{p_focus:focus,p_target_date:date,p_meal_context:mealContext||null,p_limit:24});}}}}}}}}
    CACHE.set(key,{at:Date.now(),data});return data;
  }
  async function fetchMicroAddons(date,context='breakfast'){
    const key=`${date}|${context}`,cached=ADDON_CACHE.get(key);if(cached&&Date.now()-cached.at<TTL)return cached.data;
    try{
      const data=await rpc('mt_food_micro_addons_v1',{p_context:context,p_target_date:date});
      const safe=data&&typeof data==='object'?data:{candidates:[]};ADDON_CACHE.set(key,{at:Date.now(),data:safe});return safe;
    }catch(e){
      console.warn('[V4896639] petits plus indisponibles',e);const safe={candidates:[]};ADDON_CACHE.set(key,{at:Date.now(),data:safe});return safe;
    }
  }
  async function ensureMicroAddons(payload,state,date=localDate()){
    if(String(state?.mealContext||'')!=='breakfast')return payload;
    if(payload&&payload.__tee_micro_addons)return payload;
    if(payload)payload.__tee_micro_addons=await fetchMicroAddons(date,'breakfast');
    return payload;
  }
  async function loadRhythm(date=localDate()){const [p,c]=await Promise.all([fetchGuidance('protein',date,null),fetchDecisionContext(date)]);return attachDecisionContext(p,c);}
  async function load(focus,opts={}){
    const date=opts.date||localDate(),at=opts.at instanceof Date?opts.at:new Date(),contextPromise=fetchDecisionContext(date);
    if(opts.mealContext){const [direct,ctx]=await Promise.all([fetchGuidance(focus,date,opts.mealContext),contextPromise]);return attachDecisionContext(direct,ctx);}
    const [neutral,global]=await Promise.all([fetchGuidance(focus,date,null),contextPromise]);attachDecisionContext(neutral,global);const rhythm=neutral?.rhythm||{},decision=mealContextDecision(rhythm,at),slot=decision.fixedWindow||fixedMealWindow(at);
    // V4896609 : l'heure fixe le catalogue autorisé. Les habitudes ne déplacent plus
    // breakfast/lunch/snack/dinner hors de leur tranche ; elles servent seulement à décider
    // si un petit-déjeuner ou une collation habituellement absents méritent un petit renfort.
    if(slot.closing)return {...neutral,client_guidance_mode:'closing',fixed_time_window:slot,meal_context_decision:decision};
    if(decision.currentAlreadyLogged)return {...neutral,client_guidance_mode:'slot_already_logged',fixed_time_window:slot,meal_context_decision:decision};
    const opportunity=skippedMomentOpportunity(rhythm,at),habit=slot.context?contextHabitStats(rhythm,slot.context):null;
    if(['breakfast','snack'].includes(slot.context)&&habit?.usuallyAbsent){
      if(microNeedEligible(opts.model,neutral,focus,opportunity,at)){
        const microPayload=attachDecisionContext(await fetchGuidance(focus,date,slot.context),global);
        return {...microPayload,client_guidance_mode:'micro_reinforcement',micro_opportunity:opportunity,fixed_time_window:slot,meal_context_decision:decision};
      }
      return {...neutral,client_guidance_mode:'optional_slot_no_need',micro_opportunity:opportunity,fixed_time_window:slot,meal_context_decision:decision};
    }
    const payload=attachDecisionContext(await fetchGuidance(focus,date,slot.context),global);
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
    const days=Number(model?.nutritionDays)||0,learned=learnedRhythm(payload?.rhythm||{},at),slot=fixedMealWindow(at),day={...learned,phase:slot.phase},global=globalNutritionState(model,payload,{mealContext:slot.context}),rows=[];
    for(const d of global.needs){
      const low=n(d.low),recent=n(d.recent),cur=n(d.current);if(!low||low<=0)continue;
      const recentGap=days>=3&&recent!==null?clamp((low-recent)/low,0,1):0,todayGap=cur!==null?clamp((low-cur)/low,0,1):0;
      const hasSignal=recentGap>=.08||(day.progress>=.20&&cur!==null&&todayGap>=.12);if(!hasSignal)continue;
      const dayWeight=.22+(.78*day.progress),score=Math.max(recentGap,todayGap*dayWeight)+(day.progress>=.68&&todayGap>.4?.12:0);
      rows.push({...d,score,recentGap,todayGap});
    }
    rows.sort((a,b)=>b.score-a.score);const best=rows[0];
    if(!best){if(['protein','density','energy_review'].includes(String(rawDecision?.key||'')))return rawDecision;return null;}
    const activeRanked=rows.filter(x=>x.todayGap>=.16||x.recentGap>=.12).slice(0,3),active=['energy','protein','fiber'].map(k=>activeRanked.find(x=>x.focus===k)).filter(Boolean),labels=active.map(x=>x.label),today=model?.nutritionContext?.today||{};
    const remaining=active.map(x=>x.gap===null?null:`${fmt(x.gap,x.focus==='energy'?0:1)} ${x.unit} ${x.label}`).filter(Boolean);
    const todayBits=[];if(n(today.kcal)!==null)todayBits.push(`${fmt(today.kcal,0)} kcal`);if(n(today.protein_g)!==null)todayBits.push(`${fmt(today.protein_g,1)} g prot.`);if(n(today.fiber_g)!==null)todayBits.push(`${fmt(today.fiber_g,1)} g fibres`);
    const contextBits=[];if(slot.context)contextBits.push({breakfast:'petit-déjeuner maintenant',lunch:'déjeuner maintenant',snack:'collation maintenant',dinner:'dîner maintenant'}[slot.context]);
    const mealDecision=mealContextDecision(payload?.rhythm||{},at),later=MEAL_CONTEXT_ORDER.filter(x=>{const a=mealContextIndex(x),b=mealContextIndex(slot.context);return b>=0&&a>b&&!mealDecision.loggedTypes.includes(x);});if(later.length)contextBits.push(`${later.map(x=>({snack:'collation',dinner:'dîner',lunch:'déjeuner',breakfast:'petit-déjeuner'}[x])).join(' + ')} encore à venir`);
    if(global.goal.key!=='neutral')contextBits.push(global.goal.label);
    const list=labels.length>1?labels.slice(0,-1).join(', ')+' et '+labels.at(-1):labels[0];
    const title=['before','early'].includes(day.phase)?`Répartir ${list} plus tôt`:['middle','late'].includes(day.phase)?`Mieux répartir ${list} aujourd’hui`:`Compléter ${list} sans rattraper`;
    const summary=active.length>1?`Plusieurs repères sont encore peu documentés aujourd’hui. Tee les traite ensemble pour construire le prochain moment alimentaire, au lieu de réduire la décision à un seul nutriment.`:`${best.label.charAt(0).toUpperCase()+best.label.slice(1)} ressort comme le repère le plus utile maintenant à partir de tes données documentées.`;
    const action=slot.context==='snack'&&active.length>1?`Pour cette collation, Tee construit progressivement une base protéinée, une source d’énergie et un apport en fibres selon ce qu’il reste réellement à répartir, puis s’arrête quand la collation est cohérente.`:['before','early'].includes(day.phase)?`Tee répartit progressivement ce qui est utile dans les premiers moments alimentaires, sans chercher à tout concentrer dans un seul aliment.`:['middle','late'].includes(day.phase)?`Tee répartit ce qu’il reste entre ce moment et les repas suivants, en tenant compte de ton profil, de tes habitudes et des signaux réellement renseignés.`:`À ce stade, Tee ne cherche plus à tout rattraper et garde seulement ce qui reste raisonnable à compléter.`;
    const reasons=[];if(todayBits.length)reasons.push(`Aujourd’hui : ${todayBits.join(' · ')}`);if(remaining.length)reasons.push(`À répartir vers le bas de tes repères : ${remaining.join(' · ')}`);if(contextBits.length)reasons.push(`Contexte : ${contextBits.join(' · ')}`);
    return {key:best.key,title,summary,action,reasons,_pacingFocus:best.focus,_pacingScore:best.score,_globalNeeds:active.map(x=>({focus:x.focus,gap:x.gap,low:x.low,current:x.current,ratio:x.todayGap})),_globalGoal:global.goal};
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

  function portionLabel(c){const g=n(c.portion_g);if(!g)return '';const habitual=c?.portion_source==='habitual'&&c?.habitual_portion_confident===true;return `${fmt(g,0)} g${habitual?' · ta portion habituelle':''}`;}
  function normText(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function candidateDisplayName(c){return String(c?.ui_display_name||c?.name||'Option').trim();}
  function rescaleCandidatePortion(c,grams,source='tee_realistic_portion'){
    const current=n(c?.portion_g),next=Math.max(1,Math.round(Number(grams)||0));
    if(!current||!next||Math.abs(current-next)<.5)return c;
    const scale=next/current,out={...c,original_portion_g:n(c?.original_portion_g)||current,portion_g:next,portion_source:source};
    for(const key of ['kcal','protein_g','fiber_g','carbs_g','fat_g','focus_amount'])if(n(c?.[key])!==null)out[key]=Math.round(Number(c[key])*scale*1000)/1000;
    return out;
  }
  function realisticBreakfastCandidate(c,group){
    if(!c)return c;
    const current=n(c?.portion_g);if(!current)return c;
    const t=normText(c?.name),family=guidanceFoodFamily(c);
    let cap=group==='side'?180:group==='starch'?120:220;
    if(/noix du bresil|noix d amazonie/.test(t))cap=10;
    else if(/(^| )(pignon|amande|noix|noisette|cajou|pistache|graine)( |$)/.test(t))cap=30;
    else if(/fruit sec|raisins secs|abricot sec|datte|figue seche/.test(t))cap=35;
    else if(/galette.*(cereal|souffl)|cereal.*souffl/.test(t))cap=45;
    else if(/flocon|avoine|muesli|granola|cereale/.test(t))cap=70;
    else if(/(^| )(pain|baguette|toast|tartine)( |$)/.test(t))cap=100;
    else if(/(^| )(fromage|feta|mozzarella|cheddar|emmental|comte)( |$)/.test(t)&&!/fromage blanc/.test(t))cap=40;
    else if(family==='fat_side')cap=/avocat/.test(t)?100:30;
    else if(family==='fruit')cap=200;
    else if(family==='eggs')cap=120;
    else if(family==='dairy')cap=220;
    else if(family==='plant_protein'||family==='legumes')cap=150;
    let out=current>cap?rescaleCandidatePortion(c,cap,'tee_breakfast_realistic_cap'):c;
    const maxKcal=group==='side'?220:group==='starch'?360:350,kcal=n(out?.kcal)||0,grams=n(out?.portion_g)||0;
    if(kcal>maxKcal&&grams>0){
      const adjusted=Math.max(5,Math.floor((grams*(maxKcal/kcal))/5)*5);
      out=rescaleCandidatePortion(out,adjusted,'tee_breakfast_realistic_cap');
    }
    return out;
  }
  function breakfastMainComplementAllowed(c){
    if(!c)return false;
    const name=normText(c?.name),microUse=String(c?.micro_use_type||'').trim(),role=String(c?.guidance_role||'food').trim();
    // V4896637 : un aliment explicitement curé comme assemblage rapide reste un MICRO-ajout.
    // Il ne doit jamais devenir la carte principale de l'étape 3/3.
    if(microUse==='quick_assembly'||role==='ingredient')return false;
    // Compatibilité immédiate avec les profils déjà en cache avant exécution du SQL V4896637.
    // Les graines entières restent disponibles dans la bibliothèque / micro-guidance, mais pas
    // comme "complément retenu" autonome du petit-déjeuner.
    if(/(^| )(chia|lin|sesame|pavot|tournesol|chanvre)( |$)/.test(name)&&/(^| )graine( |$)/.test(name))return false;
    return true;
  }
  function breakfastRoleAllowed(c,group){
    if(!c)return false;
    const name=normText(c?.name);
    // La noix du Brésil reste dans la bibliothèque mais n'est pas proposée de façon proactive
    // au petit-déjeuner : sa densité en sélénium en fait un mauvais levier énergétique générique.
    if(/noix du bresil|noix d amazonie/.test(name))return false;
    const family=guidanceFoodFamily(c),role=mealRoleGroup(c),uses=contextUseCount(c),protein=n(c?.protein_g)||0;
    if(role!==group)return false;
    if(group==='protein'){
      if(['eggs','dairy','plant_protein','legumes'].includes(family))return protein>=5;
      if(['poultry','seafood','pork','beef','lamb'].includes(family))return uses>=1;
      return protein>=8;
    }
    if(group==='starch')return !['processed_meat','pork','beef','lamb','poultry','seafood'].includes(family);
    if(group==='side')return breakfastMainComplementAllowed(c)&&['fruit','fat_side','dairy'].includes(family);
    return false;
  }
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
  function contextUseCount(c){
    const explicit=Number(c?.context_use_count_60d);
    return Number.isFinite(explicit)?Math.max(0,explicit):Math.max(0,Number(c?.use_count_60d)||0);
  }
  function cultureSpecificAllowed(c){
    if(!isCultureSpecific(c))return true;
    // Les clics Tee ne suffisent jamais à créer une familiarité culturelle.
    // Il faut au moins deux consommations réelles dans CE moment alimentaire.
    return contextUseCount(c)>=2;
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
    const uses=contextUseCount(c);
    if(uses>=2)return 'habit';
    if(uses===1)return 'consumed';
    return '';
  }
  function familiarityIsExact(c){return ['habit','consumed','tee_chosen','scanned_repeat'].includes(familiarityLevel(c));}
  function snackFriendlyCandidate(c,state,focus=null){
    if(String(state?.mealContext||'')!=='snack')return true;
    const family=guidanceFoodFamily(c),role=mealIntegrationRole(c),prep=preparationState(c),kcal=n(c?.kcal)||0,portion=n(c?.portion_g)||0,protein=n(c?.protein_g)||0,fiber=n(c?.fiber_g)||0,uses=contextUseCount(c),name=normText(c?.name);
    if(role==='complete_meal'||String(c?.guidance_role||'')==='meal'||prep==='meal_ready'||prep==='requires_cooking')return false;
    // Une habitude de déjeuner/dîner ne traverse plus vers la collation.
    // Un aliment atypique reste possible uniquement s'il a été réellement consommé en collation.
    if(['processed_meat','pork','beef','lamb','poultry','seafood'].includes(family)&&uses<1)return false;
    if(/(^| )(sauce|vinaigrette|mayonnaise|mayo|ketchup|moutarde|condiment)( |$)/.test(name)&&uses<1)return false;
    if(/(^| )(camembert|brie|roquefort|bleu|reblochon|munster|raclette|comte|emmental|parmesan|gouda|cheddar|creme de .*fromage|creme de camembert)( |$)/.test(name)&&portion>80&&uses<1)return false;
    // Une option doit réellement contribuer au levier du moment.
    if(focus==='protein'&&protein<5)return false;
    if(focus==='fiber'&&fiber<1.5)return false;
    if(focus==='energy'&&kcal<60)return false;
    if(kcal>450&&uses<1)return false;
    if(portion>250&&!['fruit','dairy','vegetable'].includes(family)&&uses<1)return false;
    if(role==='starch_base'&&kcal>320&&protein<10&&uses<1)return false;
    return true;
  }
  function snackClusterKey(c){
    const name=normText(c?.name),family=guidanceFoodFamily(c);
    if(/fromage blanc/.test(name))return 'fromage_blanc';
    if(/skyr/.test(name))return 'skyr';
    if(/yaourt|yogourt|yogurt|yoplait|petit suisse/.test(name))return 'yogurt';
    if(/chanvre|whey|proteine/.test(name))return 'protein_powder';
    if(/amande|noix|noisette|cajou|pistache|graine/.test(name))return 'nuts_seeds';
    if(family==='fruit')return 'fruit';
    if(family==='eggs')return 'eggs';
    if(family==='legumes')return 'legumes';
    if(family==='dairy')return 'dairy_other';
    return family||'other';
  }
  function diversifySnackCandidates(rows,limitPerCluster=2){
    const counts=new Map(),out=[];
    for(const c of rows||[]){
      const key=snackClusterKey(c),count=counts.get(key)||0;
      if(count>=limitPerCluster)continue;
      counts.set(key,count+1);out.push(c);
    }
    return out;
  }
  function guidanceFoodFamily(c){
    const t=normText(c?.name),role=String(c?.guidance_role||'food');
    if(role==='meal'||preparationState(c)==='meal_ready')return 'complete_meal';
    if(/(^| )(lardon|bacon|saucisse|saucisson|merguez|chorizo|charcuterie)( |$)/.test(t))return 'processed_meat';
    if(/(^| )(porc|cochon|jambon)( |$)/.test(t))return 'pork';
    if(/(^| )(boeuf|bœuf|veau|steak)( |$)/.test(t))return 'beef';
    if(/(^| )(agneau|mouton|chevre|chevreau)( |$)/.test(t))return 'lamb';
    if(/(^| )(poulet|dinde|canard|volaille)( |$)/.test(t))return 'poultry';
    if(/(^| )(saumon|thon|cabillaud|colin|truite|sardine|maquereau|poisson|crevette|gambas|moule|huitre|fruits? de mer|crustac|mollusque)( |$)/.test(t))return 'seafood';
    if(/(^| )(oeuf|œuf|omelette)( |$)/.test(t))return 'eggs';
    if(/(^| )(tofu|tempeh|seitan)( |$)/.test(t))return 'plant_protein';
    if(/(^| )(lentille|pois chiche|haricot blanc|haricot rouge|haricot noir|feve|fève)( |$)/.test(t))return 'legumes';
    if(/(^| )(riz|pates|pâte|pasta|semoule|couscous|quinoa|boulgour|ble|blé|orge|avoine|pain|baguette|biscotte|cracotte|galette|muesli|granola|cereale|céréale|pomme de terre|patate|igname|manioc|plantain)( |$)/.test(t))return 'starch';
    if(/(^| )(courgette|brocoli|epinard|épinard|carotte|haricot vert|chou|salade|tomate|concombre|poivron|aubergine|artichaut|asperge|poireau|champignon|legume|légume)( |$)/.test(t))return 'vegetable';
    if(/(^| )(skyr|yaourt|yogourt|fromage blanc|petit suisse|lait|fromage|feta|mozzarella)( |$)/.test(t))return 'dairy';
    if(/(^| )(amande|noix|noisette|cajou|pistache|graine|avocat)( |$)/.test(t))return 'fat_side';
    if(/(^| )(pomme|poire|banane|orange|kiwi|mangue|ananas|fraise|framboise|myrtille|goji|datte|pruneau|figue|abricot sec|raisin sec|cranberry|fruits?)( |$)/.test(t))return 'fruit';
    return 'other';
  }
  function mealIntegrationRole(c){
    const lunchRole=String(c?.lunch_role||'').trim();
    if(lunchRole)return lunchRole;
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
  function snackRequiredRoles(model,payload,state,build=null){
    if(String(state?.mealContext||'')!=='snack')return [];
    const g=globalNutritionState(model,payload,state),selected=new Set((Array.isArray(build?.items)?build.items:[]).map(x=>String(x?.group||''))),roles=[];
    const protein=g.by.protein,energy=g.by.energy,fiber=g.by.fiber;
    const proteinGap=protein?.gap??0,energyGap=energy?.gap??0,fiberGap=fiber?.gap??0;
    const proteinContext=g.tags.has('context_protein')||g.tags.has('tracking_protein')||g.tags.has('program_mass_gain')||g.tags.has('program_recomposition')||g.goal.key==='mass_gain'||g.goal.key==='recomposition';
    const fiberContext=g.tags.has('context_fiber')||g.tags.has('tracking_fiber');
    const energyContext=g.goal.key==='mass_gain'||g.tags.has('program_mass_gain')||g.tags.has('context_recovery')||g.tags.has('program_recovery');
    const proteinNeed=proteinGap>0&&(proteinGap>=8||protein.ratio>=.16||(proteinContext&&proteinGap>=4));
    const energyNeed=energyGap>0&&(energyGap>=220||energy.ratio>=.14||(energyContext&&energyGap>=120));
    const fiberNeed=fiberGap>0&&(fiberGap>=3||fiber.ratio>=.14||(fiberContext&&fiberGap>=1.5));
    if(proteinNeed)roles.push('protein');
    if(energyNeed)roles.push('starch');
    if(fiberNeed)roles.push('side');
    if(!roles.length){const focus=String(state?.focus||'');roles.push(focus==='protein'?'protein':focus==='fiber'?'side':'starch');}
    return roles.filter((x,i,a)=>a.indexOf(x)===i&&!selected.has(x));
  }
  function snackEnergyBudget(model,payload,state,build=null){
    const g=globalNutritionState(model,payload,state),gap=g.by.energy?.gap,totals=buildTotals(build||{items:[]});if(gap===null||gap<=0)return Math.max(120,totals.kcal);
    const goal=g.goal.key,share=goal==='mass_gain'?.34:goal==='loss'?.20:.26,cap=goal==='mass_gain'?650:goal==='loss'?360:520;
    return clamp(gap*share,180,cap);
  }
  function scaledSnackCandidate(c,group,model,payload,state,build){
    if(!c)return null;const copy={...c},portion=n(c?.portion_g)||0;if(portion<=0)return copy;
    // Une vraie portion habituelle issue de V4896641 reste prioritaire : Tee adapte les autres
    // composantes autour d'elle au lieu de réécrire silencieusement l'habitude confirmée.
    if(['habitual','scanned_serving'].includes(String(c?.portion_source||'')))return copy;
    const g=globalNutritionState(model,payload,state),tot=buildTotals(build||{items:[]});let factor=1;
    if(group==='protein'){const amount=Math.max(.1,n(c?.protein_g)||0),target=clamp((g.by.protein?.gap||12)*.34,9,24);factor=clamp(target/amount,.65,1.45);}
    else if(group==='starch'){
      const kcal=Math.max(1,n(c?.kcal)||0),remaining=Math.max(90,snackEnergyBudget(model,payload,state,build)-tot.kcal),reserveFiber=(g.by.fiber?.gap||0)>=3;
      const target=clamp(remaining*(reserveFiber?.68:.88),90,340);factor=clamp(target/kcal,.45,1.35);
    }
    else if(group==='side'){
      const fiber=Math.max(.1,n(c?.fiber_g)||0),kcal=Math.max(1,n(c?.kcal)||0),fiberShare=g.digestiveCaution?.18:.30,fiberTarget=clamp((g.by.fiber?.gap||4)*fiberShare,g.digestiveCaution?1.5:2.5,g.digestiveCaution?4.5:7),fiberFactor=clamp(fiberTarget/fiber,.25,1.35);
      const remaining=Math.max(0,snackEnergyBudget(model,payload,state,build)-tot.kcal),energyFactor=clamp(remaining/kcal,.25,1.25);factor=Math.min(fiberFactor,energyFactor);
    }
    if(Math.abs(factor-1)<.08)return copy;
    copy.portion_g=Math.max(5,Math.round(portion*factor/5)*5);for(const k of ['kcal','protein_g','fiber_g','carbs_g','fat_g','focus_amount']){if(n(c?.[k])!==null)copy[k]=Math.round(Number(c[k])*factor*10)/10;}
    copy.portion_source=String(c?.portion_source||'')==='habitual'?c.portion_source:'global_context_scaled';return copy;
  }
  function snackRoleAllowed(c,group){
    const family=guidanceFoodFamily(c),prep=preparationState(c),protein=n(c?.protein_g)||0,fiber=n(c?.fiber_g)||0,kcal=n(c?.kcal)||0;if(prep==='requires_cooking'||prep==='meal_ready'||family==='complete_meal')return false;
    if(group==='protein')return protein>=6&&kcal>0&&(kcal/Math.max(protein,.1))<=30&&['dairy','plant_protein','eggs','legumes'].includes(family);
    if(group==='starch')return kcal>=70&&family==='starch';
    if(group==='side')return fiber>=1.5&&kcal>0&&['fruit','legumes'].includes(family);
    return false;
  }
  function structuredRoleFocus(group,state=null){
    if(String(state?.mealContext||'')==='snack')return group==='protein'?'protein':group==='starch'?'energy':group==='side'?'fiber':'protein';
    return group==='protein'?'protein':group==='starch'?'carbs':group==='vegetable'||group==='side'?'fiber':'protein';
  }
  function nextStructuredMealRole(build,state=null,model=null,payload=null){
    const groups=new Set((Array.isArray(build?.items)?build.items:[]).map(x=>String(x?.group||''))),ctx=String(state?.mealContext||'');
    if(groups.has('complete'))return null;
    if(ctx==='snack')return snackRequiredRoles(model,payload,state,build)[0]||null;
    if(!groups.has('protein'))return 'protein';
    if(!groups.has('starch'))return 'starch';
    if(ctx==='breakfast'){if(!groups.has('side'))return 'side';return null;}
    if(!groups.has('vegetable'))return 'vegetable';
    return null;
  }
  function structuredRoleStep(group,state=null,model=null,payload=null){if(String(state?.mealContext||'')==='snack'){const plan=snackRequiredRoles(model,payload,{...state,focus:structuredRoleFocus(group,state)},{items:[]});const all=[...new Set([...plan,group])];const i=all.indexOf(group);return i>=0?i+1:1;}return group==='protein'?1:group==='starch'?2:3;}
  function structuredRoleStepLabel(group,state=null){
    const ctx=String(state?.mealContext||'');
    if(ctx==='breakfast')return {protein:'Choisis une base protéinée',starch:'Ajoute une base énergétique',side:'Complète avec un fruit ou un petit accompagnement'}[group]||'Complète ton petit-déjeuner';
    if(ctx==='snack')return {protein:'Commence par une base protéinée',starch:'Ajoute une source d’énergie adaptée',side:'Complète avec un fruit ou un apport en fibres'}[group]||'Complète ta collation';
    return {protein:'Choisis ta base protéinée',starch:'Choisis maintenant un accompagnement',vegetable:'Ajoute des végétaux si une option pertinente te convient'}[group]||'Complète ton repas';
  }
  function structuredGuideCopy(build,state,model=null,payload=null){
    const items=Array.isArray(build?.items)?build.items:[],groups=new Set(items.map(x=>String(x?.group||''))),breakfast=String(state?.mealContext||'')==='breakfast';
    if(groups.has('complete'))return 'Ton option complète est choisie. Vérifie-la puis ajoute-la à ton repas seulement si c’est bien ce que tu vas réellement manger.';
    if(String(state?.mealContext||'')==='snack'){
      const plan=snackRequiredRoles(model,payload,state,build);
      if(!groups.has('protein')&&plan.includes('protein'))return 'Tee regarde l’ensemble de ta journée : elle commence par une base protéinée si les protéines sont encore peu documentées, puis construit la collation autour.';
      if(!groups.has('starch')&&plan.includes('starch'))return 'Ta base est posée. Tee ajoute maintenant une source d’énergie adaptée au reliquat de la journée, sans essayer de tout rattraper dans la collation.';
      if(!groups.has('side')&&plan.includes('side'))return 'La collation tient déjà debout. Tee vérifie maintenant si un fruit ou un apport en fibres complète réellement ce qu’il reste à répartir.';
      return 'Ta collation est construite à partir de plusieurs repères à la fois. Tu peux la confirmer dans Ma journée alimentaire et ajuster ce que tu manges réellement.';
    }
    if(breakfast){
      if(!groups.has('protein'))return 'Tee ne cherche pas à combler un gros écart avec un seul aliment. Commence par une base protéinée réaliste ; elle construira ensuite ton petit-déjeuner autour.';
      if(!groups.has('starch'))return 'Ta base protéinée est choisie. Tee ajoute maintenant une vraie base énergétique, avec une portion de petit-déjeuner réaliste.';
      if(!groups.has('side'))return 'Ton petit-déjeuner tient déjà debout. Tee te propose seulement un fruit ou un petit complément cohérent, sans transformer les oléagineux en repas à eux seuls.';
      return 'Ton petit-déjeuner est construit. Tu peux le confirmer dans Ma journée alimentaire et ajuster ce que tu as réellement mangé.';
    }
    if(!groups.has('protein'))return 'Commence par choisir une base protéinée. Dès que tu la sélectionnes, Tee te propose l’accompagnement correspondant, puis des végétaux si un choix pertinent existe.';
    if(!groups.has('starch'))return 'Ta base est choisie. Étape suivante : sélectionne un accompagnement. Tee ne te repropose pas une deuxième protéine pour remplir le repas.';
    if(!groups.has('vegetable'))return 'Ta base et ton accompagnement sont posés. Tee vérifie maintenant s’il existe un végétal ou un apport en fibres cohérent pour compléter le repas.';
    return 'Ton repas est construit. Tu peux encore changer un élément, ou l’envoyer vers Ma journée alimentaire pour confirmer les quantités réellement mangées.';
  }
  function mealRoleMetricLine(c,group,focus){
    const bits=[];
    if(group==='protein'&&n(c?.protein_g)>0)bits.push(`+${fmt(c.protein_g,1)} g protéines`);
    else if(group==='starch'&&n(c?.carbs_g)>0)bits.push(`${fmt(c.carbs_g,1)} g glucides`);
    else if((group==='vegetable'||group==='side')&&n(c?.fiber_g)>0)bits.push(`${fmt(c.fiber_g,1)} g fibres`);
    else return metricLine(c,focus);
    if(group!=='vegetable'&&n(c?.fiber_g)>=3)bits.push(`${fmt(c.fiber_g,1)} g fibres`);
    if(group!=='protein'&&n(c?.protein_g)>=8)bits.push(`${fmt(c.protein_g,1)} g prot.`);
    if(n(c?.kcal)>=60)bits.push(`${fmt(c.kcal,0)} kcal`);
    return bits.slice(0,3).join(' · ');
  }
  function rolePayloadFor(payload,group,focus,state=null){
    if(structuredRoleFocus(group,state)===focus)return payload;
    return payload?.__tee_role_payloads?.[group]||null;
  }
  async function ensureStructuredRoleSupport(payload,model,focus,state,build,requestedRole=null){
    if(!payload||!['breakfast','snack','lunch','dinner'].includes(String(state?.mealContext||'')))return payload;
    const group=requestedRole||nextStructuredMealRole(build,state,model,payload);
    if(!group||!['protein','starch','vegetable','side'].includes(group))return payload;
    const roleFocus=structuredRoleFocus(group,state);
    if(roleFocus===focus)return payload;
    if(!payload.__tee_role_payloads)payload.__tee_role_payloads={};
    if(payload.__tee_role_payloads[group])return payload;
    try{
      payload.__tee_role_payloads[group]=await fetchGuidance(roleFocus,payload?.target_date||localDate(),state?.mealContext||null);
    }catch(e){
      console.warn('[V4896622] rôle repas indisponible',group,e);
      payload.__tee_role_payloads[group]={candidates:[]};
    }
    return payload;
  }
  function sortedStructuredRoleCandidates(payload,model,focus,state,group,build=null){
    const sources=[];
    const dedicated=rolePayloadFor(payload,group,focus,state);
    if(dedicated)sources.push({payload:dedicated,focus:structuredRoleFocus(group,state)});
    if(payload&&payload!==dedicated)sources.push({payload,focus});
    const seen=new Set(),seenLunchClusters=new Set(),out=[];
    for(const src of sources){
      const roleState=pacingState(model,src.payload,src.focus);
      roleState.mealContext=state?.mealContext||roleState.mealContext;
      let ranked=sortedCandidates(src.payload,model,src.focus,roleState);
      if(String(state?.mealContext||'')==='breakfast'){
        ranked=ranked.map(c=>realisticBreakfastCandidate(c,group)).filter(c=>breakfastRoleAllowed(c,group)).sort((a,b)=>candidateMemoryTier(a)-candidateMemoryTier(b)||contextualCandidateScore(b,model,src.focus,roleState)-contextualCandidateScore(a,model,src.focus,roleState));
      }
      if(String(state?.mealContext||'')==='snack'){
        ranked=ranked.map(c=>scaledSnackCandidate(c,group,model,payload,state,build)).filter(c=>snackRoleAllowed(c,group)).sort((a,b)=>candidateMemoryTier(a)-candidateMemoryTier(b)||contextualCandidateScore(b,model,src.focus,roleState)-contextualCandidateScore(a,model,src.focus,roleState));
      }
      for(const c of ranked){
        if(mealRoleGroup(c)!==group)continue;
        const key=String(c?.candidate_ref||c?.dictionary_id||c?.ciqual_code||c?.name||'');
        const cluster=String(c?.lunch_cluster_key||'').trim();
        if(!key||seen.has(key))continue;
        if(String(state?.mealContext||'')==='lunch'&&cluster&&seenLunchClusters.has(cluster))continue;
        seen.add(key);
        if(String(state?.mealContext||'')==='lunch'&&cluster)seenLunchClusters.add(cluster);
        out.push(c);
      }
    }
    return out;
  }
  function mealBuildKey(state){
    const ctx=String(state?.mealContext||'meal');
    const version=ctx==='breakfast'?'mt_meal_build_v4896637':ctx==='lunch'?'mt_meal_build_v4896640':ctx==='snack'?'mt_meal_build_v4896645':'mt_meal_build_v4896617';
    return `${version}_${localDate()}_${ctx}`;
  }
  function loadMealBuildState(state){
    if(!['breakfast','snack','lunch','dinner'].includes(String(state?.mealContext||'')))return {items:[],addon:null};
    try{
      const raw=sessionStorage.getItem(mealBuildKey(state)),parsed=raw?JSON.parse(raw):null;
      return parsed&&Array.isArray(parsed.items)?{items:parsed.items,addon:parsed.addon||null}:{items:[],addon:null};
    }catch(_){return {items:[],addon:null};}
  }
  function saveMealBuildState(state,data){
    try{sessionStorage.setItem(mealBuildKey(state),JSON.stringify({items:Array.isArray(data?.items)?data.items:[],addon:data?.addon||null}));}catch(_){}
  }
  function addMealBuildChoice(state,c){
    const ctx=String(state?.mealContext||''),data=loadMealBuildState(state),group=mealRoleGroup(c),item={key:String(c?.candidate_ref||c?.dictionary_id||c?.ciqual_code||c?.name||'Option'),candidate_ref:c?.candidate_ref||null,ciqual_code:c?.ciqual_code||c?.code||null,dictionary_id:c?.dictionary_id||c?.food_dictionary_id||null,name:candidateDisplayName(c),group,role:mealIntegrationRole(c),family:guidanceFoodFamily(c),portion_g:n(c?.portion_g),preparation_state:preparationState(c),kcal:n(c?.kcal),protein_g:n(c?.protein_g),fiber_g:n(c?.fiber_g),carbs_g:n(c?.carbs_g),fat_g:n(c?.fat_g)};
    if(['breakfast','snack','lunch','dinner'].includes(ctx)){
      data.items=(data.items||[]).filter(x=>x?.group!==group);
      data.items.push(item);
      if(ctx==='breakfast')data.addon=null;
    }else{
      data.items=(data.items||[]).filter(x=>String(x?.key||x?.name||'')!==item.key);
      data.items.push(item);
      if(ctx==='snack')data.items=data.items.slice(-2);
    }
    saveMealBuildState(state,data);return data;
  }
  function removeMealBuildChoice(state,token){
    const ctx=String(state?.mealContext||''),data=loadMealBuildState(state);
    if(['breakfast','snack','lunch','dinner'].includes(ctx)){
      data.items=(data.items||[]).filter(x=>x?.group!==token);
      if(ctx==='breakfast')data.addon=null;
    }else data.items=(data.items||[]).filter(x=>String(x?.key||x?.name||'')!==String(token||''));
    saveMealBuildState(state,data);return data;
  }
  function clearMealBuildState(state){try{sessionStorage.removeItem(mealBuildKey(state));}catch(_){}return {items:[],addon:null};}
  function buildTotals(build){
    const rows=Array.isArray(build?.items)?build.items:[];return rows.reduce((a,x)=>{a.kcal+=(n(x?.kcal)||0);a.protein+=(n(x?.protein_g)||0);a.fiber+=(n(x?.fiber_g)||0);return a;},{kcal:0,protein:0,fiber:0});
  }
  function breakfastPairingTags(build){
    const tags=new Set(),items=Array.isArray(build?.items)?build.items:[];
    for(const x of items){
      const t=normText(x?.name),family=String(x?.family||'');
      if(/(^| )(yaourt|yogourt|yogurt|skyr|fromage blanc|petit suisse)( |$)/.test(t))tags.add('yogurt');
      if(/(^| )(porridge|flocon|avoine|muesli)( |$)/.test(t))tags.add('porridge');
      if(/(^| )(smoothie|shake)( |$)/.test(t))tags.add('smoothie');
      if(/(^| )compote( |$)/.test(t))tags.add('compote');
      if(/(^| )(pain|tartine|toast|biscotte|cracotte|galette)( |$)/.test(t))tags.add('bread');
      if(family==='fruit'||/(^| )(pomme|poire|banane|orange|kiwi|mangue|ananas|fraise|framboise|myrtille|fruit de la passion|tamarin)( |$)/.test(t))tags.add('fruit');
      if(/(^| )(bowl|salade de fruits|coupe de fruits)( |$)/.test(t))tags.add('fruit_bowl');
    }
    return tags;
  }
  function addonNeed(model,build,preferredFocus=''){
    const totals=buildTotals(build),share=.22,defs=[
      {focus:'protein',target:(n(model?.protein?.low)||0)*share,current:totals.protein,minContribution:2.5},
      {focus:'fiber',target:(n(model?.fiber?.low)||0)*share,current:totals.fiber,minContribution:1},
      {focus:'energy',target:(n(model?.energy?.low)||0)*share,current:totals.kcal,minContribution:45}
    ];
    const rows=defs.filter(x=>x.target>0).map(x=>({...x,deficit:Math.max(0,x.target-x.current),ratio:x.target>0?x.current/x.target:1})).filter(x=>x.ratio<.74&&x.deficit>0);
    rows.sort((a,b)=>((b.focus===preferredFocus?1:0)-(a.focus===preferredFocus?1:0))||((1-b.ratio)-(1-a.ratio)));
    return rows[0]||null;
  }
  function addonPer100(c,focus){return focus==='protein'?n(c?.protein_100g)||0:focus==='fiber'?n(c?.fiber_100g)||0:focus==='energy'?n(c?.kcal_100g)||0:0;}
  function addonPortion(c,need){
    const minG=n(c?.micro_addon_portion_min_g),maxG=n(c?.micro_addon_portion_max_g);if(!minG||!maxG||!need)return null;
    const per100=addonPer100(c,need.focus),target=Math.max(need.minContribution,need.deficit*.35);let grams=minG;
    if(per100>0)grams=clamp((target/per100)*100,minG,maxG);
    grams=Math.round(grams/5)*5;grams=clamp(grams,minG,maxG);return grams;
  }
  function scaledAddon(c,need){
    const grams=addonPortion(c,need);if(!grams)return null;const scale=grams/100,out={...c,portion_g:grams,addon_focus:need.focus};
    out.kcal=(n(c?.kcal_100g)||0)*scale;out.protein_g=(n(c?.protein_100g)||0)*scale;out.fiber_g=(n(c?.fiber_100g)||0)*scale;return out;
  }
  function addonCompatible(c,tags){
    if(c?.micro_addon_enabled!==true||c?.micro_addon_requires_base===false)return false;
    const pairs=Array.isArray(c?.micro_addon_pairing_tags)?c.micro_addon_pairing_tags:[];return pairs.some(x=>tags.has(String(x||'')));
  }
  function addonAlreadyInBuild(c,build){
    const items=Array.isArray(build?.items)?build.items:[],dict=String(c?.dictionary_id||''),ciqual=String(c?.ciqual_code||''),name=normText(c?.display_name||c?.name);
    return items.some(x=>(dict&&String(x?.dictionary_id||'')===dict)||(ciqual&&String(x?.ciqual_code||'')===ciqual)||(name&&normText(x?.name)===name));
  }
  function addonContributionEnough(c,need){
    if(!c||!need)return false;const amount=need.focus==='protein'?n(c?.protein_g)||0:need.focus==='fiber'?n(c?.fiber_g)||0:n(c?.kcal)||0;return amount>=need.minContribution;
  }
  function selectBreakfastAddon(payload,model,focus,build){
    if(String(payload?.fixed_time_window?.context||'')!=='breakfast'||build?.addon)return null;
    const need=addonNeed(model,build,focus),tags=breakfastPairingTags(build);if(!need||!tags.size)return null;
    const rows=Array.isArray(payload?.__tee_micro_addons?.candidates)?payload.__tee_micro_addons.candidates:[];
    return rows.filter(c=>String(c?.micro_addon_mode||'never')!=='never')
      .filter(c=>String(c?.micro_addon_mode||'')!=='familiar_only'||Number(c?.context_use_count_60d||0)>0)
      .filter(c=>addonCompatible(c,tags)&&!addonAlreadyInBuild(c,build))
      .map(c=>scaledAddon(c,need)).filter(c=>addonContributionEnough(c,need))
      .map(c=>({c,score:(Number(c?.context_use_count_60d||0)>0?18:0)+(n(c?.nutrient_scores?.[need.focus])||0)*8+(need.focus===focus?4:0)+(need.focus==='protein'&&c?.micro_addon_kind==='protein_powder'?5:0)+(need.focus==='fiber'&&['seed','fiber_booster'].includes(String(c?.micro_addon_kind||''))?5:0)+(need.focus==='energy'&&c?.micro_addon_kind==='spread'?5:0)}))
      .sort((a,b)=>b.score-a.score||String(a.c?.display_name||'').localeCompare(String(b.c?.display_name||''),'fr'))[0]?.c||null;
  }
  function addonReason(c){
    if(c?.addon_focus==='protein')return 'Pour renforcer doucement les protéines de ce petit-déjeuner.';
    if(c?.addon_focus==='fiber')return 'Pour compléter doucement les fibres de ce petit-déjeuner.';
    if(c?.addon_focus==='energy')return 'Pour densifier légèrement ce petit-déjeuner sans en faire une nouvelle étape.';
    return String(c?.micro_addon_hint||'Petit ajout facultatif, seulement si cela te convient.');
  }
  function breakfastAddonHTML(payload,model,focus,build,state){
    if(String(state?.mealContext||'')!=='breakfast')return '';
    if(build?.addon){const a=build.addon;return `<div class="mt-food-guide-addon"><div class="mt-food-guide-addon-kicker">Petit plus facultatif · ajouté</div><div class="mt-food-guide-addon-row"><div class="mt-food-guide-addon-copy"><b>${esc(a.name||'Petit plus')}</b><span>${esc(fmt(a.portion_g,0))} g · ajouté au brouillon du petit-déjeuner</span></div><button type="button" class="mt-food-guide-addon-action" data-mt-guide-remove-addon>Retirer</button></div></div>`;}
    const c=selectBreakfastAddon(payload,model,focus,build);if(!c)return '';
    return `<div class="mt-food-guide-addon"><div class="mt-food-guide-addon-kicker">Petit plus facultatif</div><div class="mt-food-guide-addon-row"><div class="mt-food-guide-addon-copy"><b>${esc(c.display_name||c.name||'Petit plus')} · ${esc(fmt(c.portion_g,0))} g</b><span>${esc(addonReason(c))}</span></div><button type="button" class="mt-food-guide-addon-action" data-mt-guide-add-addon="${esc(c.profile_key||'')}">Ajouter</button></div></div>`;
  }
  function saveBreakfastAddon(state,c){
    const data=loadMealBuildState(state);data.addon={key:String(c?.profile_key||c?.candidate_ref||c?.display_name||'addon'),candidate_ref:c?.candidate_ref||null,profile_key:c?.profile_key||null,ciqual_code:c?.ciqual_code||null,dictionary_id:c?.dictionary_id||null,name:c?.display_name||c?.name||'Petit plus',portion_g:n(c?.portion_g),kcal:n(c?.kcal),protein_g:n(c?.protein_g),fiber_g:n(c?.fiber_g),kind:c?.micro_addon_kind||null};saveMealBuildState(state,data);return data;
  }
  function removeBreakfastAddon(state){const data=loadMealBuildState(state);data.addon=null;saveMealBuildState(state,data);return data;}
  function mealRoleSelectedLabel(group,state=null){
    if(String(state?.mealContext||'')==='snack')return {protein:'✓ Base protéinée',starch:'✓ Énergie ajoutée',side:'✓ Fibres / fruit'}[group]||'✓ Élément retenu';
    return {protein:'✓ Base choisie',starch:'✓ Accompagnement prévu',vegetable:'✓ Végétaux ajoutés',complete:'✓ Repas choisi',side:'✓ Complément retenu'}[group]||'✓ Élément retenu';
  }
  function mealRoleSelectedChip(group,state=null){
    if(String(state?.mealContext||'')==='snack')return {protein:'✓ Base choisie',starch:'✓ Énergie choisie',side:'✓ Fibres choisies'}[group]||'✓ Choisi';
    return {protein:'✓ Base choisie',starch:'✓ Accompagnement choisi',vegetable:'✓ Végétaux choisis',complete:'✓ Repas choisi',side:'✓ Complément choisi'}[group]||'✓ Choisi';
  }
  function sameMealBuildCandidate(item,c){
    if(!item||!c)return false;
    const candidateKey=String(c?.candidate_ref||c?.dictionary_id||c?.ciqual_code||c?.name||'');
    const itemKey=String(item?.key||item?.candidate_ref||item?.dictionary_id||item?.ciqual_code||item?.name||'');
    return !!candidateKey&&candidateKey===itemKey;
  }
  function isCandidateSelected(c,state){
    if(!['breakfast','snack','lunch','dinner'].includes(String(state?.mealContext||'')))return false;
    const build=loadMealBuildState(state);
    return (build.items||[]).some(item=>sameMealBuildCandidate(item,c));
  }
  function mealRoleAlternativeLabel(group,state=null){
    if(String(state?.mealContext||'')==='snack')return {protein:'Voir d’autres bases',starch:'Voir d’autres sources d’énergie',side:'Voir d’autres fruits / fibres'}[group]||'Voir d’autres options';
    return {protein:'Voir d’autres bases',starch:'Voir d’autres accompagnements',vegetable:'Voir d’autres végétaux',complete:'Voir d’autres repas',side:'Voir d’autres compléments'}[group]||'Voir d’autres options';
  }
  function mealRoleBrowseTitle(group,state){
    const ctx=String(state?.mealContext||''),meal=ctx==='breakfast'?'ton petit-déjeuner':ctx==='dinner'?'ton dîner':'ton déjeuner';
    if(ctx==='breakfast')return {protein:'Autres bases protéinées pour ton petit-déjeuner.',starch:'Autres bases énergétiques pour ton petit-déjeuner.',side:'Autres compléments pour ton petit-déjeuner.'}[group]||`Autres options pour ${meal}.`;
    if(ctx==='snack')return {protein:'Autres bases protéinées pour ta collation.',starch:'Autres sources d’énergie pour ta collation.',side:'Autres fruits ou apports en fibres pour ta collation.'}[group]||'Autres options pour ta collation.';
    return {protein:`Autres bases pour ${meal}.`,starch:`Autres accompagnements pour ${meal}.`,vegetable:`Autres végétaux pour ${meal}.`,complete:`Autres options pour ${meal}.`,side:`Autres compléments pour ${meal}.`}[group]||`Autres options pour ${meal}.`;
  }
  function mealBuildSummaryHTML(build,state){
    const items=Array.isArray(build?.items)?build.items:[];if(!items.length)return '';
    const ctx=String(state?.mealContext||''),structured=['breakfast','snack','lunch','dinner'].includes(ctx);
    const title=ctx==='breakfast'?'Ton petit-déjeuner se prépare':ctx==='snack'?'Ta collation se prépare':'Ton repas se construit';
    const rows=items.map(x=>`<div class="mt-food-guide-selected"><div><small>${esc(structured?mealRoleSelectedLabel(x.group,state):'✓ Ajout prévu')}</small><b>${esc(x.name||'Option')}</b>${x.portion_g?`<span>${esc(fmt(x.portion_g,0))} g</span>`:''}</div><button type="button" class="mt-food-guide-alt" ${structured?`data-mt-guide-change-role="${esc(x.group||'side')}"`:`data-mt-guide-remove-choice="${esc(x.key||x.name||'')}"`}>${structured?'Changer':'Retirer'}</button></div>`).join('');
    return `<div class="mt-food-guide-build"><div class="mt-food-guide-build-title">${title}</div>${rows}<button type="button" class="mt-food-guide-alt" data-mt-guide-reset>${structured?'Recommencer cette sélection':'Vider cette sélection'}</button></div>`;
  }
  function mealRoleCue(c,state){
    const ctx=String(state?.mealContext||''),ctxLabel=ctx==='breakfast'?'ton petit-déjeuner':ctx==='lunch'?'ton déjeuner':ctx==='dinner'?'ton dîner':'ton repas',prep=preparationState(c),role=mealIntegrationRole(c);
    if(ctx==='snack'){
      const group=mealRoleGroup(c);
      if(group==='protein')return 'Base protéinée pour ta collation';
      if(group==='starch')return 'Source d’énergie pour ta collation';
      if(group==='side')return 'Fruit ou apport en fibres pour ta collation';
    }
    if(ctx==='breakfast'){
      const group=mealRoleGroup(c);
      if(group==='protein')return prep==='requires_cooking'?`À préparer comme base protéinée de ${ctxLabel}`:`Comme base protéinée de ${ctxLabel}`;
      if(group==='starch')return prep==='requires_cooking'?`À préparer comme base énergétique de ${ctxLabel}`:`Comme base énergétique de ${ctxLabel}`;
      if(group==='side')return `Petit complément pour ${ctxLabel}`;
    }
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
  function openGuidanceMealDraft(state,build,focus){
    const sourceItems=Array.isArray(build?.items)?build.items:[],addon=build?.addon?[build.addon]:[];
    const items=sourceItems.concat(addon).map(x=>({ciqual_code:x?.ciqual_code||null,dictionary_id:x?.dictionary_id||null,name:x?.name||'Option',grams:Math.max(1,Number(x?.portion_g)||0)})).filter(x=>x.grams>0&&x.name);
    if(!items.length)return false;
    try{sessionStorage.setItem('mt_guidance_meal_draft_v4896617',JSON.stringify({source:'tee_guidance',focus:focus||'protein',meal_type:String(state?.mealContext||'lunch'),build_key:mealBuildKey(state),input:items.map(x=>x.name).join(', '),items}));}catch(_){}
    location.href=`food-meal.html?date=${encodeURIComponent(localDate())}&type=${encodeURIComponent(String(state?.mealContext||'lunch'))}&source=guidance`;
    return true;
  }
  function mealActionLabel(c,state){
    const role=mealIntegrationRole(c),group=mealRoleGroup(c),prep=preparationState(c),breakfast=String(state?.mealContext||'')==='breakfast';
    if(role==='complete_meal')return 'Choisir ce repas →';
    if(String(state?.mealContext||'')==='snack'){if(group==='protein')return 'Choisir cette base →';if(group==='starch')return 'Ajouter cette source d’énergie →';if(group==='side')return 'Ajouter ce complément →';}
    if(breakfast){
      if(group==='protein')return prep==='requires_cooking'?'Prévoir cette base →':'Choisir cette base →';
      if(group==='starch')return prep==='requires_cooking'?'Prévoir cette base énergétique →':'Ajouter cette base énergétique →';
      if(group==='side')return 'Ajouter ce complément →';
    }
    if(group==='protein')return prep==='requires_cooking'?'Prévoir cette base →':'Choisir cette base →';
    if(group==='starch')return prep==='requires_cooking'?'Prévoir cet accompagnement →':'Ajouter cet accompagnement →';
    if(group==='vegetable')return prep==='requires_cooking'?'Prévoir ces végétaux →':'Ajouter ces végétaux →';
    if(prep==='requires_cooking')return 'Prévoir cet élément →';
    return 'Ajouter à mon repas →';
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
    if(ctx==='lunch'&&Number.isFinite(Number(c?.lunch_priority))){
      const p=Number(c.lunch_priority);
      score+=p===3?8:p===2?3:p===1?-5:-14;
    }
    const remaining=Math.max(1,Number(state?.remainingMeals)||1),baseShare=phase==='closing'?.42:phase==='late'?.58:phase==='middle'?.50:.38;
    const share=clamp(Math.max(baseShare,1/remaining*.72),.30,.68),target=gap!==null&&gap>0?Math.max(focus==='energy'?180:focus==='protein'?8:focus==='fiber'?3:.1,gap*share):Math.max(amount,1);
    const ratio=Math.max(.05,amount/Math.max(target,.05));
    score-=Math.abs(Math.log(ratio))*24;
    if(gap!==null&&gap>0&&amount>gap*1.15)score-=18+Math.min(30,(amount/gap-1.15)*22);
    if(fam==='habit'&&!c?.rotation_due)score+=32;
    else if(fam==='consumed'&&!c?.rotation_due)score+=23;
    else if(fam==='similar')score+=10;
    const intentCount=Math.max(0,Number(c?.tee_chosen_context_count)||0);
    if(intentCount>0&&fam!=='habit'&&fam!=='consumed')score+=Math.min(4,intentCount);
    if(c?.source_kind==='scanned')score+=12;
    if(c?.meal_context_fit)score+=6;
    score+=Math.min(15,n(c?.memory_affinity_score)||0);
    if(c?.rotation_due)score-=24;
    // V4896634 : variété douce entre les jours, sans instabilité dans la même journée.
    // Le serveur ne renseigne cette pénalité que pour un affichage des 1 à 3 jours précédents
    // dans le même contexte alimentaire. Elle reste un simple malus : jamais une exclusion.
    score-=Math.max(0,Number(c?.shown_rotation_penalty)||0);
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
  function lunchVisibilityAllowed(c,state){
    if(String(state?.mealContext||'')!=='lunch')return true;
    const mode=String(c?.lunch_visibility_mode||'').trim();
    if(!mode||mode==='general')return true;
    if(mode==='never')return false;
    if(mode==='familiar_only'){
      const level=familiarityLevel(c);
      return contextUseCount(c)>0||['habit','consumed','scanned_repeat'].includes(level);
    }
    return true;
  }
  function candidateAllowed(c,model,focus,state){
    if(!c||!lunchVisibilityAllowed(c,state)||focusValue(c,focus)<=0||looksSmallQuantity(c)||looksCommercialGuidanceExcluded(c)||!cultureSpecificAllowed(c)||!snackFriendlyCandidate(c,state,focus))return false;
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
    const contextual=String(pace?.mealContext||'')==='snack'?diversifySnackCandidates(ranked,2):ranked;
    return blendMorning(contextual,pace);
  }
  function sortedMicroCandidates(payload,model,focus,state,context){
    const all=Array.isArray(payload?.candidates)?payload.candidates:[];
    const ranked=all.map(c=>scaledMicroCandidate(c,focus,state,context,model)).filter(Boolean)
      .map(c=>({c,fit:contextualCandidateScore(c,model,focus,state),tier:candidateMemoryTier(c)}))
      .sort((a,b)=>a.tier-b.tier||b.fit-a.fit||((n(b.c.focus_amount)||0)-(n(a.c.focus_amount)||0)))
      .map(x=>x.c);
    return context==='snack'?diversifySnackCandidates(ranked,2):ranked;
  }

  function candidateHTML(c,focus,index,state,opts={}){
    const role=String(c.guidance_role||'food'),level=familiarityLevel(c),intentCount=Math.max(0,Number(c?.tee_chosen_context_count)||0);
    const mealStructured=['breakfast','snack','lunch','dinner'].includes(String(state?.mealContext||''));
    const group=mealRoleGroup(c),selected=mealStructured&&isCandidateSelected(c,state);
    const chip=selected?mealRoleSelectedChip(group,state):(c.rotation_due?'À varier':level==='habit'?'Dans tes habitudes':level==='consumed'?'Déjà consommé':mealStructured?(role==='meal'?'Plat complet':'Option TEE'):(intentCount>0?'Déjà choisi avec Tee':role==='meal'?'Plat complet':'Option TEE'));
    const prep=preparationState(c),cue=mealStructured?mealRoleCue(c,state):preparationCue(c,state),pickLabel=selected?mealRoleSelectedChip(group,state):(mealStructured?mealActionLabel(c,state):(state?.mealContext==='snack'?'J’ajoute à ma collation':state?.mealContext==='breakfast'?'J’ajoute à mon petit-déjeuner':(['before','early'].includes(state?.phase)?(prep==='requires_cooking'?'Je le prépare':'Je prévois ça'):state?.phase==='closing'?(prep==='requires_cooking'?'Je le prépare pour plus tard':'Je garde cette option'):'Ça me convient')));
    const roleAlt=mealStructured&&opts?.showRoleAlt?`<button class="mt-food-guide-role-alt" type="button" data-mt-guide-role-more="${esc(group)}">${esc(mealRoleAlternativeLabel(group,state))}</button>`:'';
    const optionClass=`mt-food-guide-option${mealStructured?' is-selectable':''}${selected?' is-selected':''}`;
    const pickClass=`mt-food-guide-pick${mealStructured?' is-premium-inline':''}${selected?' is-picked':''}`;
    const disabled=selected?' disabled aria-pressed="true"':' aria-pressed="false"';
    return `<div class="${optionClass}" data-mt-guide-candidate="${index}"><div class="mt-food-guide-option-top"><div><b>${esc(candidateDisplayName(c))}</b><small>${esc(portionLabel(c))}</small><small class="mt-food-guide-prep">${esc(cue)}</small></div><span class="mt-food-guide-chip">${esc(chip)}</span></div><div class="mt-food-guide-metrics">${mealStructured?mealRoleMetricLine(c,group,focus):metricLine(c,focus)}</div><button class="${pickClass}" type="button" data-mt-guide-pick="${index}"${disabled}>${esc(pickLabel)}</button>${roleAlt}</div>`;
  }
  function microCandidateHTML(c,focus,index,context){
    const level=familiarityLevel(c),intentCount=Math.max(0,Number(c?.tee_chosen_context_count)||0),chip=c.rotation_due?'À varier':level==='habit'?'Dans tes habitudes':level==='consumed'?'Déjà consommé':intentCount>0?'Déjà choisi avec Tee':'Petit renfort TEE';
    const cue=context==='breakfast'?'Petit apport facultatif avant ton premier vrai repas':'Petit apport facultatif entre tes repas';
    return `<div class="mt-food-guide-option" data-mt-guide-candidate="${index}"><div class="mt-food-guide-option-top"><div><b>${esc(c.name||'Option')}</b><small>${esc(portionLabel(c))}</small><small class="mt-food-guide-prep">${esc(cue)}</small></div><span class="mt-food-guide-chip">${esc(chip)}</span></div><div class="mt-food-guide-metrics">${metricLine(c,focus)}</div><button class="mt-food-guide-pick" type="button" data-mt-guide-pick="${index}">Ça me convient</button></div>`;
  }

  function structuredTransitionCopy(group,state){
    const ctx=String(state?.mealContext||''),meal=ctx==='breakfast'?'petit-déjeuner':ctx==='lunch'?'déjeuner':'dîner';
    if(ctx==='snack'){if(group==='protein')return 'Tee cherche maintenant une source d’énergie adaptée à ta journée…';if(group==='starch')return 'Tee vérifie si un fruit ou un apport en fibres complète la collation…';if(group==='side')return 'Tee prépare ta collation pour confirmation…';}
    if(ctx==='breakfast'){
      if(group==='protein')return 'Tee cherche une base énergétique qui complète ton choix…';
      if(group==='starch')return 'Tee vérifie si un petit complément rend ton matin plus cohérent…';
      if(group==='side')return 'Tee prépare ton petit-déjeuner pour confirmation…';
    }
    if(group==='protein')return `Tee cherche l’accompagnement qui va avec ta base…`;
    if(group==='starch')return `Tee vérifie si des végétaux complètent bien ton ${meal}…`;
    if(group==='vegetable')return `Tee prépare ton ${meal} pour confirmation…`;
    if(group==='complete')return `Tee prépare ton ${meal} pour confirmation…`;
    return `Tee prépare la suite de ton ${meal}…`;
  }
  function showStructuredTransition(host,group,state){
    if(!host)return null;
    host.setAttribute('aria-busy','true');
    host.querySelector('.mt-food-guide-transition')?.remove();
    const el=document.createElement('div');
    el.className='mt-food-guide-transition';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.innerHTML=`<span class="mt-food-guide-transition-mark" aria-hidden="true"></span><span>${esc(structuredTransitionCopy(group,state))}</span><span class="mt-food-guide-transition-dots" aria-hidden="true"><i></i><i></i><i></i></span>`;
    const options=host.querySelector('.mt-food-guide-options');
    const anchor=options||host.querySelector('.mt-food-guide-step-hint')||host.querySelector('.mt-food-guide-build');
    if(anchor)anchor.insertAdjacentElement('afterend',el);else host.querySelector('.mt-food-guide')?.appendChild(el);
    return el;
  }
  function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

  function globalContextLine(model,payload,state){
    const g=globalNutritionState(model,payload,state),parts=[];
    if(g.meaningful.length>1)parts.push(`${g.meaningful.map(x=>x.label).join(' · ')} reliées ensemble`);
    if(g.goal.key!=='neutral')parts.push(`objectif profil : ${g.goal.label}`);
    const why=g.contextWhy.filter(x=>!/^objectif/.test(x)).slice(0,3);if(why.length)parts.push(why.join(' · '));
    if(g.digestiveCaution)parts.push('confort digestif du jour pris en compte');
    if(g.hydration.known)parts.push(g.hydration.liters!==null?`hydratation : ${fmt(g.hydration.liters,1)} L documenté` :'hydratation ressentie prise en compte');
    return parts.length?`<div class="mt-food-guide-context"><b>Contexte relié</b><span>${esc(parts.join(' · '))}</span></div>`:'';
  }
  function renderHost(host,{model,decision,payload,experience=false,start=0,browseRole=null,animateStep=false}){
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
    const ranked=sortedCandidates(payload,model,focus,state),structuredMainMeal=['breakfast','snack','lunch','dinner'].includes(String(slot?.context||'')),build=loadMealBuildState(state);
    const selectedMealGroups=new Set((build.items||[]).map(x=>String(x?.group||'')));
    const nextRole=structuredMainMeal?nextStructuredMealRole(build,state,model,payload):null;
    const rolePool=structuredMainMeal&&(browseRole||nextRole)?sortedStructuredRoleCandidates(payload,model,focus,state,browseRole||nextRole,build):null;
    let candidates;
    if(structuredMainMeal){
      if(rolePool&&rolePool.length)candidates=rolePool;
      else if(!selectedMealGroups.size){
        const completeFallback=ranked.filter(c=>mealRoleGroup(c)==='complete');
        candidates=completeFallback.length?completeFallback:[];
      }else candidates=[];
    }else candidates=ranked;
    const primaryCount=browseRole?Math.min(6,candidates.length):(structuredMainMeal?Math.min(1,candidates.length):Math.min(3,candidates.length));
    const pageSize=browseRole?primaryCount:(start===0?primaryCount:Math.min(3,Math.max(0,candidates.length-start)));
    const visible=candidates.slice(browseRole?0:start,(browseRole?0:start)+pageSize),preparing=slot?.context==='breakfast';
    const gesture=experience?experimentGesture(decision,focus):null;
    const slotKicker={breakfast:'Ce matin',lunch:'Pour ton déjeuner',snack:'Pour ta collation',dinner:'Pour ton dîner'}[slot?.context]||(preparing?'À prévoir aujourd’hui':'Concrètement maintenant');
    const slotTitle=browseRole?mealRoleBrowseTitle(browseRole,state):({breakfast:'Tee prépare ton matin.',lunch:'Tee prépare ton déjeuner.',snack:'Tee prépare ta collation.',dinner:'Tee prépare ton dîner.'}[slot?.context]||(preparing?'Tee prépare ta journée.':'Tee transforme ce repère en options.'));
    const guideCopy=browseRole?'Choisis simplement l’alternative qui te convient pour ce rôle. Le reste de ton repas ne change pas.':(structuredMainMeal?structuredGuideCopy(build,state,model,payload):pacingCopy(model,payload,focus));
    const buildSummary=mealBuildSummaryHTML(build,state);
    const buildComplete=structuredMainMeal&&selectedMealGroups.has('complete'),ctx=String(state?.mealContext||'');
    const snackPlan=ctx==='snack'?snackRequiredRoles(model,payload,state,{items:[]}):[],snackReady=ctx==='snack'&&snackPlan.length>0&&snackPlan.every(g=>selectedMealGroups.has(g));
    const mealCoreReady=ctx==='snack'?snackReady:(selectedMealGroups.has('protein')&&selectedMealGroups.has('starch'));
    const finalGroup=ctx==='breakfast'?'side':ctx==='snack'?null:'vegetable';
    const mealFullyBuilt=ctx==='snack'?snackReady:(mealCoreReady&&selectedMealGroups.has(finalGroup));
    const isBreakfastStructured=ctx==='breakfast',isSnackStructured=ctx==='snack';
    const emptyCopy=buildComplete?'Tu as déjà retenu une option complète pour ce repas. Tee ne rajoute rien automatiquement autour.':(mealFullyBuilt?(isBreakfastStructured?'Ta base protéinée, ta base énergétique et ton complément sont posés. Ton petit-déjeuner est prêt à être confirmé.':isSnackStructured?'Les composantes utiles de ta collation sont posées. Tee s’arrête là plutôt que d’ajouter des calories sans raison.':'Ta base, ton accompagnement et tes végétaux sont posés. Ton repas est prêt à être confirmé.'):(mealCoreReady?(isBreakfastStructured?'Ton petit-déjeuner tient déjà debout. Aucun fruit ou petit complément assez pertinent ne ressort maintenant, donc Tee s’arrête là plutôt que d’ajouter pour ajouter.':isSnackStructured?'Ta collation couvre déjà les rôles utiles maintenant. Tee n’ajoute pas un aliment supplémentaire uniquement pour remplir la carte.':'Ton repas prend forme. Ta base et ton accompagnement sont déjà posés. Aucun végétal ou apport en fibres assez pertinent ne ressort maintenant, donc Tee préfère s’arrêter là plutôt que d’ajouter un aliment inutile.'):(structuredMainMeal&&(build.items||[]).length?'Ta sélection est posée. Aucun candidat assez pertinent ne ressort pour le rôle suivant. Tee préfère s’arrêter plutôt que de remplir ton repas artificiellement.':'Aucun aliment assez pertinent ne ressort pour ce besoin maintenant. Ton repas peut rester libre, ou être travaillé avec Adapter mon repas.')));
    const candidateMarkup=visible.map((c,i)=>{const idx=(browseRole?i:start+i),group=mealRoleGroup(c),hasAlt=structuredMainMeal&&!browseRole&&candidates.length>1;return candidateHTML(c,focus,idx,state,{showRoleAlt:hasAlt});}).join('');
    const stepRole=structuredMainMeal&&!browseRole&&visible.length?(nextRole||mealRoleGroup(visible[0])):null;
    const totalSteps=isSnackStructured?Math.max(1,snackPlan.length):3;
    const stepHint=stepRole&&['protein','starch','vegetable','side'].includes(stepRole)?`<div class="mt-food-guide-step-hint"><span>${structuredRoleStep(stepRole,state,model,payload)}/${totalSteps}</span>${esc(structuredRoleStepLabel(stepRole,state))}</div>`:'';
    const topActions=browseRole?'<button type="button" class="mt-food-guide-btn" data-mt-guide-back>Retour à mon repas</button>':((!structuredMainMeal&&candidates.length>primaryCount)?'<button type="button" class="mt-food-guide-btn" data-mt-guide-more>Voir d’autres options</button>':'');
    const canFinalize=(build.items||[]).length>0&&(!structuredMainMeal||buildComplete||mealCoreReady||visible.length===0);
    const addAction=canFinalize?`<button type="button" class="mt-food-guide-btn primary" data-mt-guide-to-meal>${esc(selectionActionLabel(state))}</button>`:'';
    const addonHTML=mealFullyBuilt&&isBreakfastStructured?breakfastAddonHTML(payload,model,focus,build,state):'';
    host.removeAttribute('aria-busy');
    const nextStepHTML=`${stepHint}${visible.length?`<div class="mt-food-guide-options">${candidateMarkup}</div>`:`<div class="mt-food-guide-gesture"><b>Tee garde le repas simple</b>${esc(emptyCopy)}</div>`}`;
    const contextLine=globalContextLine(model,payload,state);
    host.innerHTML=`<section class="mt-food-guide"><div class="mt-food-guide-kicker">${esc(slotKicker)}</div><h3>${esc(slotTitle)}</h3><p>${esc(guideCopy)}</p>${contextLine}${gesture?`<div class="mt-food-guide-gesture"><b>Jour ${gesture.day}/7 · le geste d’aujourd’hui</b>${esc(gesture.text)}</div>`:''}<div class="mt-food-guide-stage">${buildSummary}<div class="mt-food-guide-next-step-shell${animateStep?' is-entering':''}"><div class="mt-food-guide-next-step">${nextStepHTML}</div></div>${addonHTML}<div class="mt-food-guide-actions">${topActions}${addAction}<button type="button" class="mt-food-guide-btn${(build.items||[]).length?'':' primary'}" data-mt-guide-adapter>${esc(adapterActionLabel(state))}</button></div><p class="mt-food-guide-note">Un choix reste une intention tant que tu n’as pas confirmé ce que tu as réellement mangé.</p></div></section>`;
    if(animateStep){
      const nextStepShell=host.querySelector('.mt-food-guide-next-step-shell.is-entering');
      if(nextStepShell){
        nextStepShell.classList.remove('is-visible');
        void nextStepShell.offsetHeight;
        requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>nextStepShell.classList.add('is-visible'),70)));
      }
    }

    const bindPickButtons=(root)=>{
      root.querySelectorAll('[data-mt-guide-pick]').forEach(btn=>btn.addEventListener('click',async()=>{
        if(btn.disabled)return;
        const idx=Number(btn.dataset.mtGuidePick),c=candidates[idx];if(!c)return;btn.disabled=true;
        const group=mealRoleGroup(c);btn.textContent=mealRoleSelectedChip(group,state);
        const nextBuild=addMealBuildChoice(state,c);
        if(structuredMainMeal)showStructuredTransition(host,group,state);
        const started=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
        const logPromise=log('chosen',focus,c,{mealContext:state?.mealContext||null,payload:{intent_only:true,portion_g:c.portion_g,focus_amount:c.focus_amount,preparation_state:preparationState(c),familiarity_level:familiarityLevel(c),meal_integration_role:mealIntegrationRole(c),meal_role_group:group,food_family:guidanceFoodFamily(c)}});
        const supportPromise=structuredMainMeal?ensureStructuredRoleSupport(payload,model,focus,state,nextBuild,null):Promise.resolve(payload);
        await Promise.allSettled([logPromise,supportPromise]);
        if(structuredMainMeal){
          const elapsed=((typeof performance!=='undefined'&&performance.now)?performance.now():Date.now())-started;
          if(elapsed<380)await sleep(380-elapsed);
          const transition=host.querySelector('.mt-food-guide-transition');
          if(transition){transition.classList.add('is-leaving');await sleep(240);}
        }
        renderHost(host,{model,decision,payload,experience,start:0,browseRole:null,animateStep:structuredMainMeal});return;
      }));
      if(structuredMainMeal){
        root.querySelectorAll('.mt-food-guide-option.is-selectable').forEach(card=>card.addEventListener('click',event=>{
          if(event.target.closest('button,a'))return;
          const pick=card.querySelector('[data-mt-guide-pick]:not(:disabled)');
          if(pick)pick.click();
        }));
      }
    };
    bindPickButtons(host);
    host.querySelectorAll('[data-mt-guide-role-more]').forEach(btn=>btn.addEventListener('click',async()=>{const role=String(btn.dataset.mtGuideRoleMore||'');await ensureStructuredRoleSupport(payload,model,focus,state,build,role);renderHost(host,{model,decision,payload,experience,start:0,browseRole:role});}));
    host.querySelectorAll('[data-mt-guide-change-role]').forEach(btn=>btn.addEventListener('click',async()=>{const role=String(btn.dataset.mtGuideChangeRole||'');await ensureStructuredRoleSupport(payload,model,focus,state,build,role);renderHost(host,{model,decision,payload,experience,start:0,browseRole:role});}));
    host.querySelector('[data-mt-guide-back]')?.addEventListener('click',()=>renderHost(host,{model,decision,payload,experience,start:0,browseRole:null}));
    host.querySelector('[data-mt-guide-more]')?.addEventListener('click',()=>{const section=host.querySelector('.mt-food-guide-options');if(!section)return;section.innerHTML=candidates.slice(0,Math.min(9,candidates.length)).map((c,i)=>candidateHTML(c,focus,i,state)).join('');bindPickButtons(section);host.querySelector('[data-mt-guide-more]')?.remove();});
    host.querySelector('[data-mt-guide-alt]')?.addEventListener('click',async()=>{await log('alternative',focus,null,{payload:{start}});const next=(start+3)>=candidates.length?0:start+3;renderHost(host,{model,decision,payload,experience,start:next,browseRole:null});});
    host.querySelectorAll('[data-mt-guide-remove-choice]').forEach(btn=>btn.addEventListener('click',()=>{removeMealBuildChoice(state,String(btn.dataset.mtGuideRemoveChoice||''));renderHost(host,{model,decision,payload,experience,start:0,browseRole:null});}));
    host.querySelector('[data-mt-guide-reset]')?.addEventListener('click',()=>{clearMealBuildState(state);renderHost(host,{model,decision,payload,experience,start:0,browseRole:null});});
    host.querySelector('[data-mt-guide-add-addon]')?.addEventListener('click',async()=>{const c=selectBreakfastAddon(payload,model,focus,build);if(!c)return;saveBreakfastAddon(state,c);await log('chosen',focus,{candidate_ref:c?.candidate_ref||`micro-addon:${c?.profile_key||''}`,name:c?.display_name||c?.name},{mealContext:'breakfast',payload:{intent_only:true,micro_addon:true,profile_key:c?.profile_key||null,portion_g:c?.portion_g,addon_kind:c?.micro_addon_kind||null}});renderHost(host,{model,decision,payload,experience,start:0,browseRole:null});});
    host.querySelector('[data-mt-guide-remove-addon]')?.addEventListener('click',()=>{removeBreakfastAddon(state);renderHost(host,{model,decision,payload,experience,start:0,browseRole:null});});
    host.querySelector('[data-mt-guide-to-meal]')?.addEventListener('click',async()=>{const draftItems=(build.items||[]).concat(build?.addon?[build.addon]:[]);await log('meal_confirmation_opened',focus,null,{mealContext:state?.mealContext||null,payload:{source:'tee_guidance',intent_only:true,items:draftItems.map(x=>({name:x.name,portion_g:x.portion_g}))}});openGuidanceMealDraft(state,build,focus);});
    host.querySelector('[data-mt-guide-adapter]')?.addEventListener('click',async()=>{await log('adapter_opened',focus,null,{payload:{source:'home_guidance'}});try{sessionStorage.setItem('mt_food_guidance_focus_v1',focus);}catch(_){}location.href=`food-adapter.html?source=tee-guidance&focus=${encodeURIComponent(focus)}&type=${encodeURIComponent(String(state?.mealContext||''))}`;});
  }

  function revealInitialGuidance(host){
    if(!host)return;
    const card=host.querySelector(':scope > .mt-food-guide');
    if(!card){host.style.cssText='';return;}
    const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce){host.classList.remove('is-initial-reveal','is-visible');host.style.cssText='';return;}
    host.classList.add('mt-food-guide-host','is-initial-reveal');
    host.classList.remove('is-visible');
    host.style.transition='none';
    host.style.height='34px';
    host.style.opacity='0';
    host.style.transform='translateY(5px)';
    host.style.filter='blur(.45px)';
    void host.offsetHeight;
    const cardStyle=window.getComputedStyle?getComputedStyle(card):null;
    const margins=(parseFloat(cardStyle?.marginTop)||0)+(parseFloat(cardStyle?.marginBottom)||0);
    const target=Math.max(34,card.offsetHeight+margins);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      host.style.transition='height .72s cubic-bezier(.22,1,.36,1),opacity .52s ease .08s,transform .66s cubic-bezier(.22,1,.36,1) .04s,filter .42s ease .04s';
      host.style.height=`${target}px`;
      host.classList.add('is-visible');
      host.style.opacity='1';
      host.style.transform='translateY(0)';
      host.style.filter='blur(0)';
      setTimeout(()=>{
        host.style.height='auto';
        host.style.overflow='visible';
        host.style.transition='';
        host.style.opacity='';
        host.style.transform='';
        host.style.filter='';
        host.classList.remove('is-initial-reveal','is-visible');
      },780);
    }));
  }

  async function prepare(opts={}){
    const focus=focusFromDecision(opts.decision);if(!focus)return null;
    const payload=opts.payload||await load(focus,{mealContext:opts.mealContext||null,date:opts.date||localDate(),model:opts.model});
    const state=pacingState(opts.model,payload,focus),mountedBuild=loadMealBuildState(state),mainMeal=['breakfast','snack','lunch','dinner'].includes(String(state?.mealContext||''));
    if(mainMeal)await ensureStructuredRoleSupport(payload,opts.model,focus,state,mountedBuild,null);
    if(String(state?.mealContext||'')==='breakfast')await ensureMicroAddons(payload,state,opts.date||localDate());
    return {payload,state,build:mountedBuild,mainMeal,focus};
  }

  async function mount(opts={}){
    const host=typeof opts.host==='string'?document.querySelector(opts.host):(opts.host||document.getElementById('mtFoodGuidanceHost'));
    const focus=focusFromDecision(opts.decision);if(!host||!focus)return null;
    injectCSS();host.classList.add('mt-food-guide-host');host.setAttribute('aria-busy','true');
    if(!opts.skipInitialLoader)host.innerHTML='<div class="mt-food-guide-quiet-loader" role="status" aria-label="Préparation de tes options"><i></i><i></i><i></i></div>';
    try{
      const prepared=opts.prepared&&opts.prepared.payload?opts.prepared:null;
      const payload=prepared?.payload||await load(focus,{mealContext:opts.mealContext||null,date:opts.date||localDate(),model:opts.model});
      const state=prepared?.state||pacingState(opts.model,payload,focus),mountedBuild=prepared?.build||loadMealBuildState(state),mainMeal=prepared?!!prepared.mainMeal:['breakfast','snack','lunch','dinner'].includes(String(state?.mealContext||''));
      if(mainMeal&&!prepared)await ensureStructuredRoleSupport(payload,opts.model,focus,state,mountedBuild,null);
      if(String(state?.mealContext||'')==='breakfast'&&!payload.__tee_micro_addons)await ensureMicroAddons(payload,state,opts.date||localDate());
      if(state.phase!=='closing'&&!state.veryLate&&!['slot_already_logged','optional_slot_no_need'].includes(String(payload?.client_guidance_mode||''))){
        const microMode=String(payload?.client_guidance_mode||'')==='micro_reinforcement',microContext=String(payload?.micro_opportunity?.context||''),mealContext=String(payload?.fixed_time_window?.context||'')||null;
        let first=[];
        if(microMode)first=sortedMicroCandidates(payload,opts.model,focus,state,microContext).slice(0,3);
        else if(mainMeal){const role=nextStructuredMealRole(mountedBuild,state,opts.model,payload);first=role?sortedStructuredRoleCandidates(payload,opts.model,focus,state,role,mountedBuild).slice(0,1):[];}
        else first=sortedCandidates(payload,opts.model,focus,state).slice(0,3);
        first.forEach(c=>log('shown',focus,c,{mealContext:microMode?microContext:mealContext,payload:{placement:opts.experience?'experience':'reference',micro_reinforcement:microMode||undefined,micro_context:microMode?microContext:undefined,portion_g:c.portion_g,time_window:mealContext||undefined,meal_role_group:mainMeal?mealRoleGroup(c):undefined}}));
      }
      renderHost(host,{model:opts.model,decision:opts.decision,payload,experience:!!opts.experience,start:0});host.removeAttribute('aria-busy');if(opts.initialReveal!==false)revealInitialGuidance(host);return payload;
    }catch(e){
      host.innerHTML='<div class="mt-food-guide"><div class="mt-food-guide-kicker">Concrètement aujourd’hui</div><p>La bibliothèque personnalisée n’est pas encore installée sur ce compte. Le repère reste visible, mais Tee ne fabrique pas d’option alimentaire de secours.</p></div>';host.removeAttribute('aria-busy');if(opts.initialReveal!==false)revealInitialGuidance(host);console.warn('[TEE guidance]',e);return null;
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

  window.MTFoodGuidance={load,loadRhythm,prepare,mount,log,fetchDecisionContext,globalNutritionState,profileGoalMode,focusFromDecision,experimentGesture,bindExperimentCheckin,modelNumbers,pacingState,selectPacingDecision,learnedRhythm,learnedMealSchedule,fixedMealWindow,mealContextDecision,currentMealContext,contextHabitStats,skippedMomentOpportunity,rankCandidates:sortedCandidates,rankMicroCandidates:sortedMicroCandidates,selectBreakfastAddon,structureMealCandidates:structuredMealCandidates,mealIntegrationRole,mealRoleGroup,guidanceFoodFamily,pacingCopy,preparationState,familiarityLevel,contextUseCount,loadMealBuildState,clearMealBuildState,removeMealBuildChoice,openGuidanceMealDraft};
})();
