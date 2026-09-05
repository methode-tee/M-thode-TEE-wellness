// MÉTHODE TEE — V453 · Repères personnels transversaux · contexte du jour prioritaire
// Estimation adulte + contexte observé. Aucune donnée inconnue n'est convertie en zéro.
(function(){
  'use strict';
  if(window.MTReference)return;

  const CACHE=new Map();
  const TTL=5*60*1000;
  const today=()=>new Date().toLocaleDateString('sv-SE');
  const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const roundTo=(v,step=1)=>Math.round(v/step)*step;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,d=0)=>Number(v).toLocaleString('fr-FR',{maximumFractionDigits:d,minimumFractionDigits:0});

  const signalKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9._]+/g,'_');
  function todayEntries(ctx){return Object.entries(ctx?.today||{}).filter(([,v])=>n(v)!==null);}
  function semanticSignal(ctx,preferred=[],patterns=[]){
    const t=ctx?.today||{};
    for(const key of preferred){const v=n(t[key]);if(v!==null)return v;}
    const entries=todayEntries(ctx);
    for(const [key,value] of entries){const nk=signalKey(key);if(patterns.some(rx=>rx.test(nk)))return n(value);}
    return null;
  }
  const TRACKER_LABELS={
    performance_recuperation:'Activité & récupération',pas_marche:'Pas & marche',sommeil_profond:'Sommeil',stress_regulation:'Stress',cycle:'Cycle',perimenopause:'Périménopause',digestion:'Digestion',nutrition_vegetale:'Micronutrition',evolution_corporelle:'Évolution corporelle',equilibre_alimentaire:'Équilibre alimentaire',reduction_sucre:'Réduction du sucre',fringales_envies:'Fringales & envies',reflux:'Reflux',peau:'Peau',jeune_intermit:'Jeûne',boissons:'Boissons',
    beverages:'Boissons',beverage:'Boissons',daily_activity:'Activité quotidienne',activity:'Activité quotidienne',healthkit:'Apple Santé',
    food_meals:'Alimentation',food_meal_items:'Alimentation',nutrition:'Alimentation',micronutrition:'Micronutrition',hydration:'Hydratation',
    journal_entries:'Journal & ressentis',journal:'Journal & ressentis',protocol:'Protocole en cours',protocols:'Protocoles en cours',protocol_tracker:'Suivi du protocole',
    user_tracker_entries:'Suivis personnels',trackers:'Suivis personnels',sleep:'Sommeil',body:'Évolution corporelle',recovery:'Récupération'
  };
  const LABEL_TOKEN_MAP={
    activity:'activité',daily:'quotidienne',beverage:'boissons',beverages:'boissons',food:'alimentation',meal:'repas',meals:'alimentation',
    tracker:'suivi',trackers:'suivis',sleep:'sommeil',cycle:'cycle',nutrition:'nutrition',hydration:'hydratation',recovery:'récupération',
    stress:'stress',digestion:'digestion',body:'corps',journal:'journal',protocol:'protocole',health:'santé'
  };
  function publicTrackerLabel(raw){
    const source=String(raw||'').trim();if(!source)return '';
    if(/^protocol_tracker[:._-]/i.test(source))return 'Suivi du protocole';
    const key=signalKey(source).replace(/\.+/g,'_').replace(/^_+|_+$/g,'');
    if(TRACKER_LABELS[key])return TRACKER_LABELS[key];
    const exact=TRACKER_LABELS[source]||TRACKER_LABELS[source.toLowerCase()];if(exact)return exact;
    const parts=key.split('_').filter(Boolean).filter(x=>!['mt','user','entry','entries','table','public','source','data','fact','facts'].includes(x));
    const translated=parts.map(x=>LABEL_TOKEN_MAP[x]||x).join(' ').trim();
    if(!translated)return 'Suivi personnel';
    if(/[0-9]{3,}|\b(id|uuid|rpc|sql|json|core|numeric|signal|signals)\b/i.test(translated))return 'Suivi personnel';
    const cleaned=translated.replace(/\s+/g,' ');
    return cleaned.charAt(0).toUpperCase()+cleaned.slice(1);
  }
  function trackerKeysToday(ctx){
    const direct=Array.isArray(ctx?.today_tracker_keys)?ctx.today_tracker_keys:[];
    const inferred=Object.keys(ctx?.today||{}).filter(k=>k.includes('.')).map(k=>k.split('.')[0]);
    const textInferred=Object.keys(ctx?.today_text_signals||{}).filter(k=>k.includes('.')).map(k=>k.split('.')[0]);
    return [...new Set([...direct,...inferred,...textInferred].filter(Boolean))];
  }
  function todayContextItems(modelOrCtx){
    const ctx=modelOrCtx?.context||modelOrCtx||{},items=[],seen=new Set();
    const add=(key,label,value)=>{if(value===null||value===undefined||value===''||seen.has(key))return;seen.add(key);items.push({key,label,value:String(value)});};
    const sleep=semanticSignal(ctx,['sleep_hours'],[/(_sleep_hours|sleep_hours|sommeil.*heure|sleep.*hour)/]);
    const steps=semanticSignal(ctx,['steps'],[/(^|\.)(steps|pas)$/,/pas_marche.*steps/]);
    const workout=semanticSignal(ctx,[],[/(performance_recuperation|activite|activity|sport|workout|training|pilates).*(duration|minutes|min|practice|temps)/]);
    const active=semanticSignal(ctx,['active_energy_kcal'],[/active.*energy|energie.*active/]);
    const recovery=semanticSignal(ctx,['recovery'],[/recovery|recuperation/]);
    const stress=semanticSignal(ctx,['stress'],[/stress|cortisol/]);
    const digestion=semanticSignal(ctx,['digestion'],[/digestion.*(comfort|confort)|(^|\.)digestion$/]);
    const hydration=semanticSignal(ctx,['hydration_liters'],[/hydration.*liter|hydratation.*litre/]);
    const appetite=semanticSignal(ctx,[],[/cycle.*appetite|cycle.*appetit|hunger|faim/]);
    const bloating=semanticSignal(ctx,[],[/bloating|ballonnement/]);
    const fatigue=semanticSignal(ctx,[],[/fatigue|tired/]);
    if(sleep!==null)add('sleep','Sommeil',`${fmt(sleep,1)} h`);
    if(workout!==null&&workout>0)add('workout','Pratique / séance',`${fmt(workout,0)} min`);
    if(steps!==null)add('steps','Pas',`${fmt(steps,0)} pas`);
    if(active!==null&&active>0)add('active','Énergie active',`${fmt(active,0)} kcal`);
    if(recovery!==null)add('recovery','Récupération',`${fmt(recovery,1)}/10`);
    if(stress!==null)add('stress','Stress',`${fmt(stress,1)}/10`);
    if(digestion!==null)add('digestion','Digestion',`${fmt(digestion,1)}/10`);
    if(hydration!==null)add('hydration','Hydratation',`${fmt(hydration,1)} L`);
    if(appetite!==null)add('appetite','Appétit / faim',`${fmt(appetite,1)}/10`);
    if(bloating!==null)add('bloating','Ballonnements',`${fmt(bloating,1)}/10`);
    if(fatigue!==null)add('fatigue','Fatigue',`${fmt(fatigue,1)}/10`);
    const textSignals=ctx?.today_text_signals||{},cyclePhase=Object.entries(textSignals).find(([k])=>/cycle.*(phase|periode|period)/.test(signalKey(k)))?.[1];
    if(cyclePhase)add('cycle_phase','Cycle',cyclePhase);
    const nutritionKeys=Object.keys(ctx?.today||{}).filter(k=>k.startsWith('nutrition.')&&n(ctx.today[k])!==null);
    const microCount=n(ctx?.today?.micronutrient_coverage_count)??nutritionKeys.length;
    if(microCount>0)add('micros','Micronutrition',`${microCount} repère${microCount>1?'s':''} documenté${microCount>1?'s':''}`);
    const protocols=Array.isArray(ctx?.active_protocols)?ctx.active_protocols:[];
    if(protocols.length)add('protocol','Protocole en cours',protocols[0]?.title||'Parcours actif');
    const keys=trackerKeysToday(ctx);
    const representedLabels=new Set();
    if(items.some(i=>['sleep'].includes(i.key)))representedLabels.add('Sommeil');
    if(items.some(i=>['workout','active','recovery'].includes(i.key)))representedLabels.add('Activité & récupération');
    if(items.some(i=>['steps'].includes(i.key)))representedLabels.add('Pas & marche');
    if(items.some(i=>['stress'].includes(i.key)))representedLabels.add('Stress');
    if(items.some(i=>['digestion','bloating'].includes(i.key)))representedLabels.add('Digestion');
    if(items.some(i=>['hydration'].includes(i.key)))representedLabels.add('Hydratation');
    if(items.some(i=>['cycle_phase','appetite'].includes(i.key)))representedLabels.add('Cycle');
    if(items.some(i=>['micros'].includes(i.key)))representedLabels.add('Micronutrition');
    if(items.some(i=>['protocol'].includes(i.key))){representedLabels.add('Protocole en cours');representedLabels.add('Protocoles en cours');}
    const publicNames=[...new Set(keys.map(publicTrackerLabel).filter(Boolean))].filter(name=>!representedLabels.has(name));
    if(publicNames.length && items.length<6)add('trackers','Repères pris en compte',publicNames.slice(0,3).join(' · ')+(publicNames.length>3?` · +${publicNames.length-3}`:''));
    return items.slice(0,6);
  }

  function client(){try{return typeof initSupabase==='function'?initSupabase():window.supabaseClient||null;}catch(_){return null;}}
  async function authContext(opts={}){
    if(opts.sb&&opts.user)return {sb:opts.sb,user:opts.user};
    const sb=opts.sb||client();if(!sb)return null;
    try{const {data}=await sb.auth.getSession();const user=data?.session?.user||null;return user?{sb,user}:null;}catch(_){return null;}
  }
  async function rpc(name,args,opts={}){
    const auth=await authContext(opts);if(!auth)return null;
    const key=`${auth.user.id}:${name}:${JSON.stringify(args||{})}`;const cached=CACHE.get(key);
    if(!opts.force&&cached&&Date.now()-cached.at<TTL)return cached.data;
    try{
      const q=auth.sb.rpc(name,args||{});
      const timeoutMs=Math.max(1500,Math.min(12000,Number(opts.timeoutMs)||6500));
      const result=await Promise.race([q,new Promise(resolve=>setTimeout(()=>resolve({data:null,error:{message:'timeout'}}),timeoutMs))]);
      if(result?.error){console.warn(`[Repères V442] ${name} indisponible`,result.error);return null;}
      CACHE.set(key,{at:Date.now(),data:result?.data??null});return result?.data??null;
    }catch(e){console.warn(`[Repères V442] ${name}`,e);return null;}
  }

  async function directProfileContext(date=today(),opts={}){
    const auth=await authContext(opts);if(!auth)return null;
    try{
      const [profileRes,dayRes,trackerRes]=await Promise.all([
        auth.sb.from('profiles').select('birth_date,height_cm,reference_gender,reference_sex,reference_weight_kg,reference_settings').eq('id',auth.user.id).maybeSingle(),
        auth.sb.from('user_reference_daily_facts').select('core,numeric_signals,tracker_keys,source_count').eq('user_id',auth.user.id).eq('fact_date',date).maybeSingle(),
        auth.sb.from('user_tracker_entries').select('tracker_key,values').eq('user_id',auth.user.id).eq('entry_date',date).limit(24)
      ]);
      if(profileRes.error||!profileRes.data)return null;
      const d=dayRes?.data||{},todayData={...(d.core||{}),...(d.numeric_signals||{})},textSignals={};
      const liveKeys=[];(trackerRes?.data||[]).forEach(row=>{if(row?.tracker_key)liveKeys.push(row.tracker_key);Object.entries(row?.values||{}).forEach(([k,v])=>{if((typeof v==='string'||typeof v==='boolean')&&String(v).length<=80)textSignals[`${row.tracker_key}.${k}`]=v;});});
      return {
        date,profile:{...(profileRes.data||{}),settings:profileRes.data?.reference_settings||{}},today:todayData,summary28:{},tracker_days:{},preferences:{},active_protocols:[],
        today_tracker_keys:[...new Set([...(Array.isArray(d.tracker_keys)?d.tracker_keys:[]),...liveKeys])],today_text_signals:textSignals,today_source_count:Number(d.source_count)||0,
        context_mode:'profile_today_fallback',
        source_note:'Repère de départ depuis Mon profil + faits compacts du jour. Les tendances récentes seront ajoutées dès que la couche transversale complète répond.'
      };
    }catch(e){console.warn('[Repères V453] profil/jour direct indisponible',e);return null;}
  }
  async function context(date=today(),opts={}){
    const auth=await authContext(opts);if(!auth)return null;
    // V475.1 : le contexte holistique continue en arrière-plan et alimente son cache,
    // mais l'interface reprend une base locale après 2,5 s au lieu de rester bloquée.
    const shared={...opts,sb:auth.sb,user:auth.user};
    const holisticPromise=rpc('mt_holistic_context',{target_date:date},{...shared,timeoutMs:9000});
    const quick=await Promise.race([holisticPromise,new Promise(resolve=>setTimeout(()=>resolve(null),2500))]);
    if(quick)return quick;
    const direct=await directProfileContext(date,shared);
    if(direct)return direct;
    const legacy=await rpc('mt_reference_context',{target_date:date},{...shared,timeoutMs:3000});
    if(legacy)return legacy;
    return holisticPromise;
  }
  async function overview(mode='28d',opts={}){return rpc('mt_reference_overview',{p_mode:mode},opts);}
  async function protocol(protocolId,opts={}){if(!protocolId)return null;return rpc('mt_protocol_reference_comparison',{p_protocol_id:protocolId},opts);}
  function invalidate(){CACHE.clear();}

  function birthInfo(value){
    if(!value)return {age:null,valid:false,isMinor:false,isAdult:false};
    const d=new Date(`${value}T12:00:00`);if(Number.isNaN(d.getTime()))return {age:null,valid:false,isMinor:false,isAdult:false};
    const now=new Date();let age=now.getFullYear()-d.getFullYear();
    const before=now.getMonth()<d.getMonth()||(now.getMonth()===d.getMonth()&&now.getDate()<d.getDate());if(before)age--;
    if(age<0||age>120)return {age:null,valid:false,isMinor:false,isAdult:false};
    return {age,valid:true,isMinor:age<18,isAdult:age>=18};
  }
  function profileSettings(ctx){const v=ctx?.profile?.settings;return v&&typeof v==='object'?v:{};}
  function intent(ctx){
    const tracker=String(ctx?.preferences?.evolution_corporelle?.body_intention||'').trim();
    if(tracker)return tracker;
    return String(profileSettings(ctx).body_intention||'Observer sans objectif chiffré');
  }
  function practice(ctx){return String(ctx?.preferences?.performance_recuperation?.level||'');}
  function currentWeight(ctx){
    return n(ctx?.today?.weight_kg)??n(ctx?.summary28?.weight_last)??n(ctx?.profile?.reference_weight_kg)??n(ctx?.summary28?.avg_weight_kg);
  }
  function declaredActivity(ctx){
    const s=profileSettings(ctx),main=String(s.activity_main||''),commute=String(s.activity_commute||''),sport=String(s.sport_frequency||''),duration=String(s.sport_duration||'');
    const has=!!(main||commute||sport||duration);if(!has)return null;
    const mainScore={seated:0,standing:1,mobile:2,physical:3}[main]??0;
    const commuteScore={motorized:0,some_walk:1,active:2}[commute]??0;
    const sportScore={none:0,occasional:0.5,'1_2':1,'3_4':2,'5_plus':3}[sport]??0;
    const durationScore={'lt30':0,'30_60':0.5,'60_plus':1}[duration]??0;
    const score=mainScore+commuteScore+sportScore+durationScore;
    const pal=score<=1.5?1.4:score<=4?1.6:score<=6.5?1.8:2.0;
    const labels={1.4:'Peu actif',1.6:'Modérément actif',1.8:'Actif',2:'Très actif'};
    return {pal,label:labels[pal]||'À préciser',source:'déclaré'};
  }
  function observedActivity(ctx){
    const s=ctx?.summary28||{},steps=n(s.avg_steps),stepsDays=n(s.steps_days)||Math.max(n(ctx?.tracker_days?.pas_marche)||0,n(ctx?.tracker_days?.performance_recuperation)||0);
    if(steps===null||stepsDays<7)return null;
    let pal=steps<4500?1.4:steps<8000?1.6:steps<12000?1.8:2.0;
    const p=practice(ctx);if(/Intensive|Compétition/i.test(p))pal=Math.max(pal,1.8);else if(/Régulière/i.test(p))pal=Math.max(pal,1.6);
    return {pal,days:stepsDays,source:'observé'};
  }
  function activityProfile(ctx){
    const declared=declaredActivity(ctx),observed=observedActivity(ctx);
    if(declared&&observed){
      const center=clamp(declared.pal*.45+observed.pal*.55,1.4,2.0);
      return {low:clamp(center-.08,1.35,2),high:clamp(center+.08,1.4,2),center,label:'Rythme affiné',source:'déclaré + observé',declared,observed,known:true};
    }
    if(observed){const center=observed.pal;return {low:clamp(center-.08,1.35,2),high:clamp(center+.08,1.4,2),center,label:'Rythme observé',source:'observé',observed,known:true};}
    if(declared){const center=declared.pal;return {low:clamp(center-.05,1.35,2),high:clamp(center+.05,1.4,2),center,label:declared.label,source:'déclaré',declared,known:true};}
    return {low:1.4,high:1.6,center:1.5,label:'À préciser',source:'provisoire',known:false};
  }
  function intentionFactor(label){if(/perdre.*graisse/i.test(label))return .90;if(/prise|masse/i.test(label))return 1.08;return 1.0;}

  function buildModel(ctx){
    ctx=ctx||{};const profile=ctx.profile||{},s=ctx.summary28||{},birth=birthInfo(profile.birth_date);
    const age=birth.age,height=n(profile.height_cm),referenceSex=String(profile.reference_sex||''),weight=currentWeight(ctx),bodyIntent=intent(ctx),activity=activityProfile(ctx);
    const nutritionDays=n(s.nutrition_days)||0,recalibrationDays=n(s.recalibration_days)||0,documentedDays=n(s.documented_days)||0;
    const bmi=height&&weight?weight/Math.pow(height/100,2):null;
    const adultEligible=birth.isAdult;
    let theoryMaintenance=null,theoryLow=null,theoryHigh=null,observedMaintenance=null,blend=0;

    if(adultEligible&&height&&weight&&weight>=35&&weight<=250){
      const base=10*weight+6.25*height-5*age;
      let bmrLow,bmrHigh;
      if(referenceSex==='male'){bmrLow=bmrHigh=base+5;}
      else if(referenceSex==='female'){bmrLow=bmrHigh=base-161;}
      else {bmrLow=base-161;bmrHigh=base+5;}
      if(bmrLow>700&&bmrHigh<3600){
        theoryLow=bmrLow*activity.low;
        theoryHigh=bmrHigh*activity.high;
        theoryMaintenance=(theoryLow+theoryHigh)/2;
      }
    }

    const oldW=n(s.weight_older_avg),recentW=n(s.weight_recent_avg),oldN=n(s.weight_older_count)||0,recentN=n(s.weight_recent_count)||0,avgKcal=n(s.avg_food_kcal_recalibration);
    // Recalibrage strict : adulte + estimation théorique existante + >=10 journées
    // complètes/éligibles + tendances corporelles répétées. L'observé ne crée jamais
    // à lui seul un besoin calorique si le profil de base n'est pas admissible.
    if(adultEligible&&theoryMaintenance&&recalibrationDays>=10&&oldN>=3&&recentN>=3&&avgKcal&&avgKcal>=900&&oldW&&recentW){
      const delta=recentW-oldW,relative=Math.abs(delta)/Math.max(oldW,1);
      if(relative<=.03&&Math.abs(delta)<=2){
        const candidate=avgKcal-(delta*7700/14);
        if(candidate>=1000&&candidate<=5000&&candidate>=theoryMaintenance*.80&&candidate<=theoryMaintenance*1.20)observedMaintenance=candidate;
      }
    }

    let maintenance=theoryMaintenance;
    if(observedMaintenance&&theoryMaintenance){
      blend=clamp(.12+(recalibrationDays-10)*.012,.12,.35);
      maintenance=theoryMaintenance*(1-blend)+observedMaintenance*blend;
    }

    let energy=null;
    if(maintenance&&theoryLow&&theoryHigh){
      const factor=intentionFactor(bodyIntent),center=maintenance*factor;
      const baseLow=theoryLow*factor,baseHigh=theoryHigh*factor;
      const uncertainty=Math.max(.075,(baseHigh-baseLow)/(Math.max(center,1)*2));
      energy={low:roundTo(center*(1-uncertainty),25),high:roundTo(center*(1+uncertainty),25),center:roundTo(center,25),source:observedMaintenance?'estimé + observé':referenceSex?'estimé':'provisoire',activity};
    }

    let protein=null;
    if(adultEligible&&weight){
      let lowFactor=1.2,highFactor=1.6;
      if(/recomposition|perdre.*graisse|prise|masse/i.test(bodyIntent)){lowFactor=1.6;highFactor=2.0;}
      else if(activity.center>=1.75){lowFactor=1.4;highFactor=1.8;}
      protein={low:roundTo(weight*lowFactor,5),high:roundTo(weight*highFactor,5)};
    }

    let fiber=null;
    if(adultEligible){
      const avgFiber=n(s.avg_fiber_g),avgDig=n(s.avg_digestion);fiber={low:25,high:30,progressive:false};
      if(avgFiber!==null&&nutritionDays>=4&&avgFiber<24){const gentle=avgDig!==null&&avgDig<5,addLow=gentle?1:2,addHigh=gentle?3:5;fiber={low:roundTo(clamp(avgFiber+addLow,15,25),1),high:roundTo(clamp(avgFiber+addHigh,18,30),1),progressive:true};if(fiber.high<=fiber.low)fiber.high=fiber.low+3;}
    }

    const profileReady=!!(adultEligible&&age&&height&&weight),historyStrong=documentedDays>=21&&recalibrationDays>=10;
    let status=birth.isMinor?'minor':historyStrong&&profileReady?'established':(documentedDays>=10||nutritionDays>=7)?'evolving':'building';
    const confidence=birth.isMinor?0:clamp((profileReady?35:10)+Math.min(35,documentedDays*1.5)+Math.min(30,recalibrationDays*2.2),10,100);
    const missing=[];
    if(!birth.valid)missing.push('date de naissance');
    if(!height)missing.push('taille');
    if(!weight)missing.push('poids actuel');
    if(!activity.known)missing.push('rythme quotidien');
    const activeProtocols=Array.isArray(ctx.active_protocols)?ctx.active_protocols:[];
    const nutritionContext={today:{kcal:n(ctx.today?.food_kcal),protein_g:n(ctx.today?.protein_g),fiber_g:n(ctx.today?.fiber_g),fat_g:n(ctx.today?.fat_g),carbs_g:n(ctx.today?.carbs_g),salt_g:n(ctx.today?.salt_g),sugars_g:n(ctx.today?.sugars_g),saturated_fat_g:n(ctx.today?.saturated_fat_g),omega3_g:n(ctx.today?.omega3_g),micronutrient_coverage_count:n(ctx.today?.micronutrient_coverage_count)},recent:{kcal:n(s.avg_food_kcal),protein_g:n(s.avg_protein_g),fiber_g:n(s.avg_fiber_g),fat_g:n(s.avg_fat_g),carbs_g:n(s.avg_carbs_g),salt_g:n(s.avg_salt_g),sugars_g:n(s.avg_sugars_g),saturated_fat_g:n(s.avg_saturated_fat_g),omega3_g:n(s.avg_omega3_g)}};
    const beverageContext={today:{count:n(ctx.today?.beverage_count),hydration_liters:n(ctx.today?.beverage_hydration_liters),energy:n(ctx.today?.beverage_energy),digestion:n(ctx.today?.beverage_digestion)},recent:{count:n(s.avg_beverage_count),energy:n(s.avg_beverage_energy),digestion:n(s.avg_beverage_digestion)}};
    return {status,confidence,profileReady,missing,age,isMinor:birth.isMinor,adultEligible,height,weight,bmi,bmiAdultEligible:adultEligible,referenceSex,bodyIntent,activity,energy,protein,fiber,observedMaintenance,theoryMaintenance,blend,summary:s,today:ctx.today||{},trackerDays:ctx.tracker_days||{},context:ctx,recalibrationDays,nutritionDays,activeProtocols,nutritionContext,beverageContext};
  }

  function statusLabel(model){if(model.status==='minor')return 'Repères adultes non calculés';return model.status==='established'?'Repère personnel établi':model.status==='evolving'?'Repère personnel évolutif':'Repère en construction';}
  function compare(value,range){if(value===null||!range)return null;if(value<range.low)return 'below';if(value>range.high)return 'above';return 'inside';}
  function dayEditorial(model,totals={}){
    if(model.isMinor)return 'Les repères énergétiques adultes ne sont pas calculés pour ce profil. Ton Carnet reste disponible sans interprétation calorique personnalisée.';
    const kcal=n(totals.kcal),protein=n(totals.protein),fiber=n(totals.fiber),parts=[];
    const coverage=totals.coverage||{},mealCount=n(totals.mealCount)||0,calc=n(totals.calculatedMeals)||0;
    const anyKnown=coverage.kcal||coverage.protein||coverage.fiber;
    if(!anyKnown||calc===0)return 'Tes repas sont enregistrés, mais leurs valeurs nutritionnelles ne sont pas assez connues pour les comparer à tes repères. Une donnée inconnue reste inconnue, jamais zéro.';
    if(totals.nutritionState==='partial')return 'Certaines valeurs nutritionnelles sont encore partielles. Méthode Tee les affiche sans conclure que tu es sous ou au-dessus d’un repère.';
    const enoughForLow=mealCount>=2&&calc>=2;
    if(model.energy&&kcal!==null&&coverage.kcal){const c=compare(kcal,model.energy);if(c==='inside')parts.push('Tes apports renseignés se situent dans ton repère énergétique actuel.');else if(c==='above')parts.push('Ta journée se situe au-dessus de ta zone habituelle estimée : une journée isolée ne change pas ton repère.');else if(enoughForLow)parts.push('Tes apports renseignés restent pour l’instant sous ton repère énergétique estimé.');}
    if(model.protein&&protein!==null&&coverage.protein){const c=compare(protein,model.protein);if(c==='inside')parts.push('Tes protéines sont bien représentées aujourd’hui.');else if(c==='below'&&enoughForLow)parts.push('Les protéines peuvent encore être renforcées sur la suite de la journée, si cela correspond à tes repas.');}
    if(model.fiber&&fiber!==null&&coverage.fiber){const c=compare(fiber,model.fiber);if(c==='below'&&enoughForLow)parts.push(model.fiber.progressive?'Les fibres peuvent progresser doucement, en tenant compte de ton confort digestif.':'Les fibres pourraient prendre davantage de place dans tes repas.');}
    if(!parts.length){if(mealCount<2)return 'Ton repère du jour se précisera avec la suite de tes repas. Méthode Tee évite d’interpréter une seule saisie comme une journée complète.';if(model.missing.length)return `Tes repères commencent à se construire. Complète ${model.missing.slice(0,2).join(' et ')} dans Mon profil pour affiner l’estimation.`;return 'Méthode Tee apprend ton rythme à partir de tes journées réellement renseignées.';}
    return parts.slice(0,2).join(' ');
  }

  function injectCSS(){if(document.getElementById('mtReferenceCSS'))return;const s=document.createElement('style');s.id='mtReferenceCSS';s.textContent=`
  .mt-ref-modal{position:fixed;inset:0;z-index:10050;display:none}.mt-ref-modal.open{display:block}.mt-ref-bg{position:absolute;inset:0;background:rgba(15,45,31,.28);backdrop-filter:blur(5px)}
  .mt-ref-sheet{position:absolute;left:0;right:0;bottom:0;margin:auto;max-width:720px;max-height:min(calc(100dvh - max(16px, env(safe-area-inset-top))),900px);overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#fffaf2;border:1px solid #e4d8c3;border-radius:30px 30px 0 0;padding:18px 22px calc(28px + env(safe-area-inset-bottom));box-shadow:0 -22px 60px rgba(41,55,45,.16);color:#6f6257}
  .mt-ref-grip{width:44px;height:4px;border-radius:99px;background:#d8cdbd;margin:0 auto 14px}.mt-ref-close{position:absolute;right:18px;top:18px;border:0;background:#f3eee5;width:38px;height:38px;border-radius:50%;font-size:22px;color:#164b3f}
  .mt-ref-kicker{font-size:11px;font-weight:800;letter-spacing:.22em;color:#b08b45;text-transform:uppercase;margin-top:6px}.mt-ref-sheet h2{font-family:Georgia,serif;font-size:34px;font-weight:400;color:#164b3f;margin:8px 42px 8px 0}.mt-ref-lead{line-height:1.55;margin:0 0 18px}
  .mt-ref-state{background:#f5efe4;border-radius:18px;padding:13px 15px;margin:12px 0 18px}.mt-ref-state b{display:block;color:#21473e}.mt-ref-state small{display:block;margin-top:4px;line-height:1.4}
  .mt-ref-row{padding:16px 0;border-top:1px solid #e8ddcb}.mt-ref-row-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.mt-ref-row-head b{color:#23483f}.mt-ref-row-head strong{color:#164b3f}.mt-ref-row p{font-size:13px;line-height:1.45;margin:7px 0 0}.mt-ref-track{position:relative;height:7px;background:#e9e0d2;border-radius:99px;margin:10px 0 4px;overflow:hidden}.mt-ref-track .mt-ref-zone{position:absolute;top:0;bottom:0;background:rgba(176,139,69,.20);border-left:1px solid rgba(176,139,69,.55);z-index:1}.mt-ref-track i{position:relative;z-index:2;display:block;height:100%;background:#164b3f;border-radius:99px}.mt-ref-sources{font-size:12px;line-height:1.5;padding:14px;border-radius:16px;background:#f8f3ea;margin-top:14px}.mt-ref-profile-link{width:100%;border:1px solid #d5b66b;background:transparent;color:#164b3f;border-radius:999px;padding:13px;margin-top:14px;font-weight:800}
  `;document.head.appendChild(s);}

  function rowHTML(label,current,range,unit,copy,available=true){
    if(!range)return `<div class="mt-ref-row"><div class="mt-ref-row-head"><b>${esc(label)}</b><strong>En construction</strong></div><p>${esc(copy||'Encore quelques repères sont nécessaires.')}</p></div>`;
    let pct=null,zoneStart=null;
    if(current!==null&&available&&Number.isFinite(Number(range.high))&&Number(range.high)>0){
      // La jauge représente désormais réellement la quantité du jour par rapport
      // au haut de la zone. Ex.: 1 678 / 2 650 ≈ 63 %, et non 5 %.
      // Le début de la zone personnelle est matérialisé sans transformer la jauge
      // en objectif rigide. Une valeur au-dessus de la zone est simplement plafonnée.
      pct=clamp(Number(current)/Number(range.high)*100,0,100);
      zoneStart=clamp(Number(range.low)/Number(range.high)*100,0,100);
    }
    const meter=pct!==null?`<div class="mt-ref-track"><span class="mt-ref-zone" style="left:${zoneStart}%;width:${100-zoneStart}%"></span><i style="width:${pct}%"></i></div>`:'';
    return `<div class="mt-ref-row"><div class="mt-ref-row-head"><b>${esc(label)}</b><strong>${fmt(range.low,0)}–${fmt(range.high,0)} ${esc(unit)}</strong></div>${current!==null&&available?`<p>Aujourd’hui : <b>${fmt(current,1)} ${esc(unit)}</b></p>`:`<p>Valeur du jour insuffisamment documentée pour être comparée.</p>`}${meter}<p>${esc(copy||'Zone indicative, jamais une obligation quotidienne.')}</p></div>`;
  }

  function openSheet(model,totals={}){
    injectCSS();let modal=document.getElementById('mtReferenceModal');if(!modal){modal=document.createElement('div');modal.id='mtReferenceModal';modal.className='mt-ref-modal';document.body.appendChild(modal);}
    const s=model.summary||{},documented=n(s.documented_days)||0,nutrition=n(s.nutrition_days)||0,recal=n(s.recalibration_days)||0,coverage=totals.coverage||{};
    const sourceCopy=model.isMinor?'Les formules énergétiques adultes restent désactivées pour ce profil.':model.status==='building'?`${documented} journée${documented>1?'s':''} documentée${documented>1?'s':''}. Le repère se précisera sans transformer une journée isolée en règle.`:`${documented} journées documentées sur 28 jours · ${nutrition} avec données nutritionnelles connues · ${recal} suffisamment complètes pour un éventuel recalibrage.`;
    const activityCopy=model.activity?.source==='provisoire'?'Ton niveau d’activité est encore provisoire. Complète Mon profil pour resserrer la fourchette.':`Niveau d’activité utilisé : ${model.activity?.label||'personnalisé'} · ${model.activity?.source||'estimé'}. Les calories d’Apple Santé ne sont pas ajoutées une seconde fois.`;
    modal.innerHTML=`<div class="mt-ref-bg" onclick="MTReference.closeSheet()"></div><section class="mt-ref-sheet"><div class="mt-ref-grip"></div><button class="mt-ref-close" onclick="MTReference.closeSheet()">×</button><div class="mt-ref-kicker">Mes repères personnels</div><h2>Comment se situe ma journée ?</h2><p class="mt-ref-lead">Des zones estimées qui évoluent avec ton profil, ton activité et tes propres tendances — sans transformer ton Carnet en compteur rigide.</p><div class="mt-ref-state"><b>✷ ${esc(statusLabel(model))}</b><small>${esc(sourceCopy)}</small></div>${model.isMinor?'':`${rowHTML('Énergie',n(totals.kcal),model.energy,'kcal',model.energy?.source==='estimé + observé'?'Le calcul initial est légèrement nuancé par plusieurs journées comparables et une évolution corporelle répétée.':activityCopy,!!coverage.kcal)}${rowHTML('Protéines',n(totals.protein),model.protein,'g','Repère lié au poids récent, au contexte adulte, à l’activité et à l’intention actuelle.',!!coverage.protein)}${rowHTML('Fibres',n(totals.fiber),model.fiber,'g',model.fiber?.progressive?'La progression est volontairement graduelle et tient compte du confort digestif renseigné.':'Repère de référence, à adapter à la tolérance et à la journée.',!!coverage.fiber)}`}<div class="mt-ref-sources"><b>Ce qui nourrit ce repère</b><br>Profil de départ · alimentation · évolution corporelle · activité/marche · sommeil · stress · digestion · cycle et autres suivis quand ils sont réellement renseignés. Une donnée absente reste absente et n’est jamais interprétée comme zéro.</div>${model.missing.length&&!model.isMinor?`<button class="mt-ref-profile-link" onclick="location.href='dashboard.html?open=profile'">Compléter Mon profil · ${esc(model.missing.join(', '))}</button>`:''}</section>`;
    modal.classList.add('open');
  }
  function openPendingSheet(totals={},opts={}){
    injectCSS();let modal=document.getElementById('mtReferenceModal');if(!modal){modal=document.createElement('div');modal.id='mtReferenceModal';modal.className='mt-ref-modal';document.body.appendChild(modal);}
    const coverage=totals.coverage||{},current=(label,key,unit)=>{
      const value=n(totals[key]);
      return `<div class="mt-ref-row"><div class="mt-ref-row-head"><b>${esc(label)}</b><strong>Repère en mise à jour</strong></div><p>${value!==null&&coverage[key==='kcal'?'kcal':key]?`Aujourd’hui : <b>${fmt(value,1)} ${esc(unit)}</b>`:'Valeur du jour non comparée tant que le repère personnel n’est pas disponible.'}</p></div>`;
    };
    const message=opts.message||'Tes repères personnels ne répondent pas encore. Ton résumé de journée reste disponible et aucune valeur inconnue n’est interprétée comme zéro.';
    modal.innerHTML=`<div class="mt-ref-bg"></div><section class="mt-ref-sheet"><div class="mt-ref-grip"></div><button class="mt-ref-close" type="button">×</button><div class="mt-ref-kicker">Mes repères personnels</div><h2>Comment se situe ma journée ?</h2><p class="mt-ref-lead">${esc(message)}</p><div class="mt-ref-state"><b>✷ Repères en mise à jour</b><small>Le moteur ne produit aucun verdict tant que les données nécessaires ne sont pas disponibles.</small></div>${current('Énergie','kcal','kcal')}${current('Protéines','protein','g')}${current('Fibres','fiber','g')}<div class="mt-ref-sources"><b>Ce qui nourrit ce repère</b><br>Profil de départ · alimentation · évolution corporelle · activité/marche · sommeil · stress · digestion · cycle et autres suivis réellement renseignés.</div><button type="button" class="mt-ref-profile-link mt-ref-retry">Réessayer maintenant</button><button type="button" class="mt-ref-profile-link mt-ref-open-profile">Ouvrir Mon profil</button></section>`;
    modal.classList.add('open');
    modal.querySelector('.mt-ref-bg').onclick=closeSheet;
    modal.querySelector('.mt-ref-close').onclick=closeSheet;
    modal.querySelector('.mt-ref-open-profile').onclick=()=>{location.href='dashboard.html?open=profile';};
    modal.querySelector('.mt-ref-retry').onclick=()=>{if(typeof opts.onRetry==='function')opts.onRetry();};
  }
  function closeSheet(){document.getElementById('mtReferenceModal')?.classList.remove('open');}

  function compactSnapshot(model,line){return {status:model.status,line,energy:model.energy?{low:model.energy.low,high:model.energy.high}:null,protein:model.protein?{low:model.protein.low,high:model.protein.high}:null,fiber:model.fiber?{low:model.fiber.low,high:model.fiber.high,progressive:model.fiber.progressive}:null,documented_days:n(model.summary?.documented_days)||0,nutrition_days:n(model.summary?.nutrition_days)||0,recalibration_days:n(model.summary?.recalibration_days)||0,today_items:todayContextItems(model),today_tracker_keys:trackerKeysToday(model.context)};}

  function applyMealContext(analysis,ctx,goal='equilibre'){
    if(!analysis||!ctx)return analysis;
    const model=buildModel(ctx),s=model.summary||{},baseRecs=[...(analysis.recommendations||[])].slice(0,3),recs=[...baseRecs],baseWhy=[...(analysis.why||[])],contextWhy=[];let line='';
    // V453 : la donnée du JOUR passe toujours avant la moyenne récente.
    const todayStress=semanticSignal(ctx,['stress'],[/stress|cortisol/]);
    const todaySleep=semanticSignal(ctx,['sleep_hours'],[/(_sleep_hours|sleep_hours|sommeil.*heure|sleep.*hour)/]);
    const todayDig=semanticSignal(ctx,['digestion'],[/digestion.*(comfort|confort)|(^|\.)digestion$/]);
    const todaySteps=semanticSignal(ctx,['steps'],[/(^|\.)(steps|pas)$/,/pas_marche.*steps/]);
    const todayRecovery=semanticSignal(ctx,['recovery'],[/recovery|recuperation/]);
    const todayHydration=semanticSignal(ctx,['hydration_liters'],[/hydration.*liter|hydratation.*litre/]);
    const todayWorkout=semanticSignal(ctx,[],[/(performance_recuperation|activite|activity|sport|workout|training|pilates).*(duration|minutes|min|practice|temps)/]);
    const todayActiveEnergy=semanticSignal(ctx,['active_energy_kcal'],[/active.*energy|energie.*active/]);
    const todayFatigue=semanticSignal(ctx,[],[/fatigue|tired/]);
    const stress=todayStress??n(s.avg_stress),sleep=todaySleep??n(s.avg_sleep_hours),dig=todayDig??n(s.avg_digestion),steps=todaySteps??n(s.avg_steps),recentSatiety=n(s.avg_food_satiety),todayFiber=n(ctx.today?.fiber_g),todayProtein=n(ctx.today?.protein_g),recovery=todayRecovery??n(s.avg_recovery),hydration=todayHydration??n(s.avg_hydration_liters);
    const todayHunger=semanticSignal(ctx,[],[/equilibre_alimentaire.*hunger|evolution_corporelle.*hunger|cycle.*appetite|cycle.*appetit|(^|\.)hunger$|(^|\.)faim$/]);
    const todayBloating=semanticSignal(ctx,[],[/digestion.*bloating|cycle.*bloating|evolution_corporelle.*bloating|ballonnement/]);
    const prioritize=rx=>{const i=recs.findIndex(r=>rx.test(`${r.title||''} ${r.body||''}`));if(i>0){const [hit]=recs.splice(i,1);recs.unshift(hit);return true;}return i===0;};
    const deprioritize=rx=>{const i=recs.findIndex(r=>rx.test(`${r.title||''} ${r.body||''}`));if(i>=0&&i<recs.length-1){const [hit]=recs.splice(i,1);recs.push(hit);return true;}return i>=0;};

    if((todayStress!==null&&todayStress>=7)||(todaySleep!==null&&todaySleep<6.5)||(todayRecovery!==null&&todayRecovery<=4)||(todayFatigue!==null&&todayFatigue>=7)){
      line='Tes repères d’aujourd’hui montrent davantage de charge ou moins de récupération : Tee garde les propositions propres à ton repas et évite de prioriser une restriction supplémentaire.';
      if(goal==='perte_poids')deprioritize(/réduire|retirer|diminuer|alléger|supprimer/i);
      contextWhy.push('Le sommeil, le stress, la récupération ou la fatigue du jour passent avant les moyennes récentes quand ils sont renseignés.');
    }else if((stress!==null&&stress>=7)||(sleep!==null&&sleep<6.5)||(recovery!==null&&recovery<=4)){
      line='Ton contexte récent suggère davantage de charge ou moins de récupération : Tee garde les propositions propres à ton repas et évite de prioriser une restriction supplémentaire.';
      if(goal==='perte_poids')deprioritize(/réduire|retirer|diminuer|alléger|supprimer/i);
      contextWhy.push('Le contexte récent nuance l’ordre des propositions sans effacer l’identité culinaire du repas.');
    }
    if((todayHunger!==null&&todayHunger>=7)||(recentSatiety!==null&&recentSatiety<5)){
      line=line||'Ta faim ou ta satiété renseignée invite à privilégier, parmi les propositions du repas, celles qui soutiennent sa structure et sa satiété.';
      prioritize(/protéin|fibre|végét|fécul|accompagnement|structure|sati/i);
      contextWhy.push('La faim / satiété réellement renseignée peut faire remonter une proposition déjà adaptée au plat.');
    }
    if(todayBloating!==null&&todayBloating>=7&&(dig===null||dig<6)){
      line=line||'Ton confort digestif du jour semble plus fragile : si une proposition du repas est plus simple ou progressive, Tee la fait passer devant.';
      prioritize(/digesti|tolér|cuit|progress|simple/i);
      contextWhy.push('Le confort digestif et les ballonnements du jour modulent la priorité, jamais l’identité du plat.');
    }
    if(model.fiber&&todayFiber!==null&&todayFiber<model.fiber.low){
      if(prioritize(/fibre|végét|légume|fruit|légumineuse|complet/i)){line=line||'Tes fibres documentées sont sous ton repère actuel : Tee met en avant l’option végétale déjà cohérente avec ce repas.';contextWhy.push('Le repère fibres influence l’ordre uniquement lorsqu’une proposition compatible existe déjà.');}
    }
    if(model.protein&&todayProtein!==null&&todayProtein<model.protein.low){
      if(prioritize(/protéin|œuf|oeuf|poisson|poulet|tofu|yaourt|skyr|légumineuse/i)){line=line||'Tes protéines documentées sont sous ton repère actuel : Tee priorise la proposition protéinée déjà cohérente avec ce plat.';contextWhy.push('Le repère protéique réordonne seulement une proposition culinaire déjà pertinente.');}
    }
    const activeToday=(todaySteps!==null&&todaySteps>=9000)||(todayWorkout!==null&&todayWorkout>=30)||(todayActiveEnergy!==null&&todayActiveEnergy>=350);
    if(activeToday){
      const moved=goal==='perte_poids'?prioritize(/protéin|structure|fécul|accompagnement|sati/i):prioritize(/fécul|riz|quinoa|pain|pomme de terre|énerg|accompagnement|protéin/i);
      if(moved){line=line||'Ton activité d’aujourd’hui est soutenue : Tee fait remonter l’option déjà cohérente qui soutient le repas, sans ajouter une seconde fois les calories d’activité.';contextWhy.push('Pas, séance ou énergie active du jour peuvent modifier la priorité, sans double comptage calorique.');}
    }else if(steps!==null&&steps>=9500&&/energie|prise_masse/.test(String(goal))){
      if(prioritize(/fécul|riz|quinoa|pain|pomme de terre|énerg|accompagnement/i)){line=line||'Ton rythme de mouvement récent est soutenu : Tee fait remonter l’accompagnement énergétique déjà adapté au repas.';contextWhy.push('L’activité récente affine la priorité sans additionner les calories d’Apple Santé au besoin théorique.');}
    }

    const protocolText=model.activeProtocols.map(p=>`${p.title||''} ${p.slug||''}`).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(protocolText){
      if(/stop sucre|sucre/.test(protocolText)&&prioritize(/sucre|sucré|dessert|boisson sucrée/i)){line=line||'Ton protocole en cours fait remonter l’option déjà pertinente autour du sucre, sans confondre sucres totaux et sucres ajoutés.';contextWhy.push('Le protocole actif peut réordonner une proposition compatible, jamais inventer une restriction.');}
      else if(/ventre|digest|reflux|aigreur|estomac/.test(protocolText)&&prioritize(/digesti|tolér|cuit|progress|simple|sauce/i)){line=line||'Ton protocole digestif en cours fait remonter l’ajustement le plus simple déjà cohérent avec ce repas.';contextWhy.push('Le protocole actif contextualise l’ordre sans attribuer une cause alimentaire.');}
      else if(/recomposition|definition|prise de masse|masse saine|silhouette/.test(protocolText)&&prioritize(/protéin|structure|fécul|accompagnement/i)){line=line||'Ton protocole corporel en cours fait remonter une proposition de structure déjà adaptée au repas.';contextWhy.push('Le protocole actif oriente la priorité sans transformer le poids ou les calories en note.');}
      else if(/sommeil|stress|anxi|cortisol/.test(protocolText)&&goal==='perte_poids'){deprioritize(/réduire|retirer|diminuer|alléger|supprimer/i);line=line||'Ton protocole de récupération en cours reste un contexte : Tee évite de placer une restriction générale devant les propositions propres au repas.';}
    }
    if(hydration!==null&&hydration<1&&!line)line='Ton hydratation renseignée est encore légère aujourd’hui. Les propositions culinaires restent inchangées ; ce signal reste visible dans ton contexte.';

    const uniqueWhy=[...new Set([...baseWhy.slice(0,2),...contextWhy.slice(0,1)])].slice(0,3);
    analysis.recommendations=recs.slice(0,3);
    analysis.why=uniqueWhy.length?uniqueWhy:baseWhy.slice(0,3);
    analysis.personalContextLine=line||'Ce conseil garde la précision du moteur alimentaire et utilise tes données du jour en priorité, puis tes tendances récentes seulement lorsqu’elles sont suffisamment documentées.';
    analysis.parsed={...(analysis.parsed||{}),personal_context:compactSnapshot(model,analysis.personalContextLine)};
    return analysis;
  }

  window.MTReference={context,overview,protocol,invalidate,buildModel,dayEditorial,statusLabel,openSheet,openPendingSheet,closeSheet,applyMealContext,compactSnapshot,activityProfile,birthInfo,todayContextItems,trackerKeysToday,semanticSignal,publicTrackerLabel};
})();
