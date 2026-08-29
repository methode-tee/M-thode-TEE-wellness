(function(){
  "use strict";
  const VERSION="17";
  const DAY=()=>new Date().toLocaleDateString('sv-SE');
  const clamp=(n,min=0,max=100)=>Math.min(max,Math.max(min,Number(n)||0));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  // Une donnée absente n'est jamais un zéro. Sans ce garde-fou, Number(null)
  // fabriquait un score à 0 % avant même qu'un ressenti soit renseigné.
  const normalize=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?clamp(((n-1)/9)*100):null;};
  const weighted=items=>{const a=items.filter(x=>Number.isFinite(x.value)&&x.weight>0);if(!a.length)return null;const w=a.reduce((s,x)=>s+x.weight,0);return a.reduce((s,x)=>s+x.value*(x.weight/w),0);};

  // V366 — Le haut des jauges est volontairement exigeant.
  // Un 8/10 reste un bon repère, mais 95–100 % nécessite plusieurs signaux
  // très favorables et cohérents : ce ne sont pas des points faciles à gagner.
  const strictRating=v=>{
    if(v===null||v===undefined||v==='')return null;
    const n=Number(v);if(!Number.isFinite(n))return null;
    const x=clamp(n,1,10),table=[0,8,17,27,38,50,62,74,86,100];
    const lo=Math.floor(x),hi=Math.ceil(x);
    if(lo===hi)return table[lo-1];
    const a=table[lo-1],b=table[hi-1];
    return a+(b-a)*(x-lo);
  };
  const sleepScore=hours=>{
    if(hours===null||hours===undefined||hours==='')return null;
    const h=Number(hours);if(!Number.isFinite(h))return null;
    const points=[[0,0],[4,15],[5,35],[6,55],[7,75],[7.5,88],[8,100],[8.5,98],[9,94],[9.5,88],[10.5,72],[12,50]];
    if(h<=points[0][0])return points[0][1];
    if(h>=points[points.length-1][0])return points[points.length-1][1];
    for(let i=1;i<points.length;i++){
      if(h<=points[i][0]){
        const [x0,y0]=points[i-1],[x1,y1]=points[i],t=(h-x0)/(x1-x0);
        return y0+(y1-y0)*t;
      }
    }
    return null;
  };
  const hardenTop=score=>{
    if(!Number.isFinite(score))return null;
    const x=clamp(score);
    if(x<=70)return x;
    if(x<=80)return 70+(x-70)*.7;      // 80 brut -> 77
    if(x<=90)return 77+(x-80)*.8;      // 90 brut -> 85
    if(x<=95)return 85+(x-90)*1.2;     // 95 brut -> 91
    return 91+(x-95)*1.8;              // seuls les quasi-parfaits approchent 100
  };
  const wellbeingEvidenceCap=count=>count<=0?null:count<=2?79:count===3?89:count===4?95:100;
  const regularityEvidenceCap=count=>count<=0?null:count<=2?89:count===3?94:count===4?97:100;
  function hardenWellbeing(parts,majorValues=[]){
    const available=parts.filter(x=>Number.isFinite(x.value)&&x.weight>0),raw=weighted(parts);
    if(raw==null)return null;
    let score=hardenTop(raw),cap=wellbeingEvidenceCap(available.length);
    const weak=majorValues.filter(Number.isFinite);
    if(weak.length){
      const lowest=Math.min(...weak);
      if(lowest<30)cap=Math.min(cap??100,69);
      else if(lowest<50)cap=Math.min(cap??100,84);
    }
    return Math.min(score,cap??100);
  }
  function hardenRegularity(parts){
    const available=parts.filter(x=>Number.isFinite(x.value)&&x.weight>0),raw=weighted(parts);
    if(raw==null)return null;
    return Math.min(hardenTop(raw),regularityEvidenceCap(available.length)??100);
  }
  const isoOffset=days=>{const d=new Date();d.setDate(d.getDate()+days);return d.toLocaleDateString('sv-SE');};
  const readJSON=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch(e){return null}};
  const writeJSON=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  function status(type,v){if(v==null)return 'unknown';if(type==='vitality')return v<35?'low':v<55?'support':v<70?'stable':v<85?'good':'high';if(type==='inner')return v<35?'fragile':v<55?'moving':v<70?'stable':v<85?'good_inner':'harmonious';return v<25?'build':v<50?'starting':v<70?'progress':v<85?'solid':'anchored';}
  function label(type,v){const s=status(type,v);return ({low:'Basse',support:'À préserver',stable:'Stable',good:'Bonne',high:'Très haute',fragile:'Fragile',moving:'En mouvement',good_inner:'Bon équilibre',harmonious:'Très harmonieux',build:'À construire',starting:'En démarrage',progress:'En progression',solid:'Bien ancrée',anchored:'Très ancrée',unknown:'À renseigner'})[s]||'À renseigner';}
  function cacheKey(uid){return `mt_tee_balance_v4_${uid}_${DAY()}`;}
  function weeklyCacheKey(uid){return `mt_tee_balance_week_v11_${uid}_${DAY()}`;}
  function historyCacheKey(uid){return `mt_tee_balance_history_v1_${uid}_${DAY()}`;}
  const FOOD_CATALOG_KEY='mt_tee_food_catalog_v2_targeted',FOOD_CATALOG_TTL=24*60*60*1000;
  function currentUser(ctx){return ctx?.todayState?.user||null;}
  function currentUid(ctx){return currentUser(ctx)?.id||ctx?.todayState?.userId||'guest';}
  function readCache(uid){const x=readJSON(cacheKey(uid));return x&&x.version===VERSION?x:null;}
  function writeCache(uid,data,journal,food,dailySummary,beverage){
    // Le cache transversal reste volontairement compact : aucune ligne CIQUAL,
    // aucun formulaire complet et aucun historique de suivi n'y sont recopiés.
    writeJSON(cacheKey(uid),{version:VERSION,ts:Date.now(),data,journal:journal||null,food:food||null,dailySummary:dailySummary||null,beverage:beverage||null});
  }

  async function beveragesToday(user,{force=false}={}){
    if(!user)return null;
    const key=`mt_beverage_day_v1_${user.id}_${DAY()}`,cached=readJSON(key);
    if(!force&&cached&&Date.now()-Number(cached.ts||0)<300000)return cached.data||null;
    try{const sb=window.initSupabase&&window.initSupabase();if(!sb)return cached?.data||null;const{data,error}=await sb.rpc('beverage_day_summary',{p_date:DAY()});if(error)throw error;writeJSON(key,{ts:Date.now(),data:data||null});return data||null}catch(e){return cached?.data||null}
  }
  async function ensureFoodCatalog(){
    if(Array.isArray(window.__MT_TEE_FOOD_CATALOG__))return window.__MT_TEE_FOOD_CATALOG__;
    const cached=readJSON(FOOD_CATALOG_KEY);
    if(Array.isArray(cached?.items)&&Date.now()-Number(cached.ts||0)<FOOD_CATALOG_TTL){window.__MT_TEE_FOOD_CATALOG__=cached.items;return cached.items;}
    try{
      const sb=window.initSupabase&&window.initSupabase();if(!sb)throw new Error('Supabase indisponible');
      // Catalogue analytique volontairement petit : jamais les 500 aliments au chargement.
      // Les recherches de repas utilisent leurs RPC ciblées ; ici on conserve seulement
      // quelques candidats utiles aux suggestions de Mon Équilibre.
      const {data,error}=await sb.from('food_dictionary').select('id,canonical_name,display_name,aliases,country,culture,ciqual_code,priority,meal_contexts,categories,typical_components,optional_components,adapter_profile,ciqual:ciqual_foods(kcal_100g,protein_100g,fiber_100g,fat_100g,carbs_100g,salt_100g)').eq('enabled',true).overlaps('categories',['protein','vegetable','composite_dish']).order('priority',{ascending:true}).limit(48);
      if(error)throw error;
      const items=(data||[]).map(x=>({...x,aliases:Array.isArray(x.aliases)?x.aliases.slice(0,8):[],categories:Array.isArray(x.categories)?x.categories:[],typical_components:Array.isArray(x.typical_components)?x.typical_components.slice(0,8):[],optional_components:Array.isArray(x.optional_components)?x.optional_components.slice(0,8):[],adapter_profile:x.adapter_profile&&typeof x.adapter_profile==='object'?x.adapter_profile:{},ciqual:Array.isArray(x.ciqual)?x.ciqual[0]||null:x.ciqual||null}));
      window.__MT_TEE_FOOD_CATALOG__=items;writeJSON(FOOD_CATALOG_KEY,{ts:Date.now(),items});return items;
    }catch(e){
      console.warn('food catalog fallback',e);const stale=Array.isArray(cached?.items)?cached.items:[];window.__MT_TEE_FOOD_CATALOG__=stale;return stale;
    }
  }

  // Historique compact des 3 jauges. On ne précharge jamais l'historique :
  // seul le score du jour est enregistré, en JSON léger, quand il change.
  // Cela évite toute nouvelle lecture Supabase au démarrage et limite l'egress.
  function snapshotWriteKey(uid){return `mt_tee_balance_snapshot_v3_${uid}_${DAY()}`;}
  function compactBalanceSnapshot(d){
    const pick=o=>Number.isFinite(o?.value)?Math.round(o.value):null;
    const daily=d?.dailySummary||{};
    const finite=v=>Number.isFinite(Number(v))?Number(v):null;
    return {
      version:VERSION,date:d?.date||DAY(),
      vitality:pick(d?.vitality),inner:pick(d?.innerBalance),regularity:pick(d?.consistency),
      vitality_label:d?.vitality?.label||'À découvrir',inner_label:d?.innerBalance?.label||'En construction',regularity_label:d?.consistency?.label||'Premier jour',
      readiness:{key:d?.readiness?.key||'',label:d?.readiness?.label||'À découvrir',tone:d?.readiness?.tone||'neutral'},
      signals:{
        sleep_minutes:finite(daily.sleep_minutes),hydration_ml:finite(daily.hydration_ml),
        nutrition_calculated_meals:finite(daily.nutrition_calculated_meals),nutrition_protein_g:finite(daily.nutrition_protein_g),nutrition_fiber_g:finite(daily.nutrition_fiber_g),
        sport_duration_minutes:finite(daily.sport_duration_minutes),steps:finite(daily.steps),distance_km:finite(daily.distance_km),walking_minutes:finite(daily.walking_minutes),active_energy_kcal:finite(daily.active_energy_kcal),flights_climbed:finite(daily.flights_climbed),walking_workout_minutes:finite(daily.walking_workout_minutes),micronutrient_coverage_count:finite(daily.micronutrient_coverage_count),micronutrient_source_count:finite(daily.micronutrient_source_count),nutrition_carbs_g:finite(daily.nutrition_carbs_g),nutrition_fat_g:finite(daily.nutrition_fat_g),sugar_craving:finite(daily.sugar_craving),
        digestion:finite(daily.digestion),energy:finite(daily.energy),food_context:Array.isArray(daily.food_context)?daily.food_context.slice(0,8):[]
      },
      is_partial:!!d?.isPartial,is_discovery:!!d?.isDiscovery,saved_at:new Date().toISOString()
    };
  }
  function snapshotSignature(x){return [x?.vitality,x?.inner,x?.regularity,x?.readiness?.key,x?.signals?.sleep_minutes,x?.signals?.hydration_ml,x?.signals?.nutrition_calculated_meals,x?.signals?.nutrition_protein_g,x?.signals?.nutrition_fiber_g,x?.signals?.micronutrient_coverage_count,x?.signals?.sport_duration_minutes,x?.signals?.steps,x?.signals?.distance_km,x?.signals?.walking_minutes,x?.signals?.active_energy_kcal,x?.signals?.flights_climbed,x?.signals?.walking_workout_minutes,x?.signals?.micronutrient_source_count,x?.signals?.nutrition_carbs_g,x?.signals?.nutrition_fat_g,x?.signals?.sugar_craving,(x?.signals?.food_context||[]).map(i=>i?.canonical_name||i?.name||'').join(','),x?.is_partial?1:0,x?.is_discovery?1:0].join('|');}
  async function persistBalanceSnapshot(user,d){
    if(!user?.id||user.id==='guest'||!d||d.isDiscovery)return;
    const snap=compactBalanceSnapshot(d);
    if(![snap.vitality,snap.inner,snap.regularity].some(Number.isFinite))return;
    const key=snapshotWriteKey(user.id),previous=readJSON(key),sig=snapshotSignature(snap);
    if(previous?.sig===sig)return;
    try{
      const sb=window.initSupabase&&window.initSupabase();if(!sb)return;
      // Marque localement juste avant l'appel : plusieurs événements rapprochés
      // ne provoquent pas plusieurs écritures identiques. En cas d'échec on libère.
      writeJSON(key,{sig,ts:Date.now()});
      const {error}=await sb.from('daily_activity').upsert({
        user_id:user.id,activity_date:DAY(),tee_balance_snapshot:snap,updated_at:new Date().toISOString()
      },{onConflict:'user_id,activity_date'});
      if(error)throw error;
      try{localStorage.removeItem(weeklyCacheKey(user.id));localStorage.removeItem(historyCacheKey(user.id));}catch(_){}
    }catch(e){
      try{localStorage.removeItem(key);}catch(_){}
      console.warn('balance snapshot persist skipped',e);
    }
  }

  function readinessFrom({isDiscovery,vitality,inner,regularity,sleep,hydration,stress}){
    if(isDiscovery)return {key:'discover',label:'À découvrir',title:'Premiers repères',message:'Renseigne un premier repère pour recevoir une lecture adaptée à ton quotidien.',tone:'neutral'};
    const values=[vitality,inner,regularity].filter(Number.isFinite);
    const avg=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
    const highStress=stress!=null&&normalize(stress)>=65;
    if((Number.isFinite(vitality)&&vitality<42)||(sleep!=null&&sleep<5.5)||highStress)return {key:'recover',label:'Besoin de douceur',title:'Ton corps demande davantage de douceur',message:'Allège ce qui peut l’être, soutiens ton hydratation et avance à un rythme plus calme aujourd’hui.',tone:'recover'};
    if(values.length>=2&&Number.isFinite(vitality)&&vitality>=65&&avg!=null&&avg>=72&&(!Number.isFinite(inner)||inner>=60))return {key:'active',label:'Belle disponibilité',title:'Ton énergie semble disponible',message:'Profite de cette disponibilité pour avancer dans tes objectifs tout en gardant les repères qui te font du bien.',tone:'active'};
    return {key:'moderate',label:'Rythme équilibré',title:'Avance avec équilibre',message:'Poursuis ta journée avec des repas réguliers, une hydratation progressive et un rythme qui reste confortable.',tone:'moderate'};
  }
  function marker(label,value,state,detail){return {label,value,state,detail};}
  function dailyGuidance({isDiscovery,sleep,hydration,raw,checks,missionDone,missionTotal,hasProtocol,readiness}){
    if(isDiscovery)return ['Renseigne ton sommeil ou ton énergie au réveil.','Ajoute ton hydratation au fil de la journée.','Écris quelques mots dans ton journal si tu en ressens le besoin.'];
    const tips=[];
    if(readiness.key==='recover')tips.push('Ralentis ce qui peut l’être et choisis aujourd’hui des gestes simples qui te soutiennent.');
    if(readiness.key==='active')tips.push('Profite de ton énergie pour avancer dans ton protocole, ton rituel ou une priorité importante.');
    if(sleep!=null&&sleep<7)tips.push('Préserve ton énergie et respecte autant que possible ton heure de coucher ce soir.');
    if(hydration<1.5)tips.push('Poursuis ton hydratation progressivement au fil de la journée.');
    if(raw.digestion!=null&&Number(raw.digestion)<=4)tips.push('Choisis un repas simple, nourrissant et confortable pour ta digestion.');
    if(raw.stress!=null&&Number(raw.stress)>=7)tips.push('Accorde-toi dix minutes de respiration, de marche calme ou une infusion réconfortante.');
    if(hasProtocol&&!checks.protocol)tips.push('Poursuis ton protocole du jour à ton rythme.');
    if(!checks.routine)tips.push('Réalise une seule étape de ton rituel, sans chercher la perfection.');
    if(missionTotal>0&&missionDone<missionTotal)tips.push('Commence par la mission la plus simple pour créer un élan.');
    return [...new Set(tips)].slice(0,3);
  }

  function influenceFactors({isDiscovery,sleep,hydration,raw,checks,missionDone,missionTotal}){
    if(isDiscovery)return [];
    const factors=[];
    if(sleep!=null)factors.push({label:'Sommeil',value:sleep>=7?'Soutient ta vitalité':sleep>=6?'À stabiliser':'À soutenir en priorité',impact:sleep>=7?18:sleep>=6?-8:-18,tone:sleep>=7?'positive':'attention'});
    if(hydration>0)factors.push({label:'Hydratation',value:hydration>=2?'Objectif atteint':hydration>=1?'En bonne voie':'À poursuivre',impact:hydration>=2?14:hydration>=1?5:-10,tone:hydration>=1?'positive':'attention'});
    if(raw.energy!=null)factors.push({label:'Énergie ressentie',value:raw.energy>=7?'Élan disponible':raw.energy>=5?'Énergie modérée':'Besoin de douceur',impact:raw.energy>=7?16:raw.energy>=5?2:-16,tone:raw.energy>=5?'positive':'attention'});
    if(raw.stress!=null)factors.push({label:'Stress perçu',value:raw.stress<=4?'Niveau apaisé':raw.stress<=6?'À observer':'Pèse sur ton équilibre',impact:raw.stress<=4?12:raw.stress<=6?-4:-17,tone:raw.stress<=4?'positive':'attention'});
    if(checks.routine)factors.push({label:'Routine',value:'Repère réalisé',impact:10,tone:'positive'});
    if(missionTotal>0)factors.push({label:'Missions',value:`${missionDone}/${missionTotal} réalisées`,impact:missionDone===missionTotal?11:missionDone>0?4:-6,tone:missionDone>0?'positive':'attention'});
    return factors.sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)).slice(0,4);
  }
  function tomorrowProjection({isDiscovery,sleep,hydration,raw,checks}){
    if(isDiscovery)return {title:'Ta lecture de demain se construit aujourd’hui.',message:'Un premier repère renseigné aujourd’hui suffira pour commencer à personnaliser ta lecture.'};
    if(hydration<2)return {title:'Ton hydratation peut soutenir demain.',message:'Atteindre progressivement ton objectif aujourd’hui peut favoriser une lecture plus stable demain.'};
    if(sleep!=null&&sleep<7)return {title:'Ta soirée peut préparer demain.',message:'Un coucher plus régulier et une nuit suffisamment longue peuvent soutenir ta vitalité de demain.'};
    if(raw.stress!=null&&raw.stress>=7)return {title:'Un moment de calme peut faire la différence.',message:'Quelques minutes de respiration, de marche douce ou un rituel apaisant peuvent soutenir ton équilibre de demain.'};
    if(!checks.routine)return {title:'Un petit repère peut renforcer ta constance.',message:'Réaliser une seule étape de ta routine aujourd’hui peut aider ta régularité à progresser.'};
    return {title:'Continue simplement ce qui fonctionne.',message:'Tes repères actuels sont favorables. La continuité compte davantage que la perfection.'};
  }
  function teePhrase({isDiscovery,readiness,regularity,hydration,sleep}){
    if(isDiscovery)return 'Tu n’as pas besoin de tout renseigner : un premier repère suffit pour commencer.';
    if(readiness.key==='recover')return 'Aujourd’hui, avancer doucement est déjà une manière de prendre soin de toi.';
    if(Number.isFinite(regularity)&&regularity>=75)return 'Ta régularité construit quelque chose de durable, même lorsque tu ne le vois pas encore.';
    if(hydration>=2)return 'Tu as déjà posé un repère solide aujourd’hui : continue sans chercher à en faire trop.';
    if(sleep!=null&&sleep>=7)return 'Ton corps dispose d’une base favorable aujourd’hui. Écoute-la et avance à ton rythme.';
    return 'Ce n’est pas une journée parfaite qui compte, mais les repères que tu choisis de garder.';
  }
  function protocolReading(active,checks){
    if(!active?.title)return null;
    const title=String(active.title),key=title.toLowerCase();
    let message=checks.protocol?'Tu as réalisé le repère de ton protocole aujourd’hui.':'Ton protocole peut devenir ton prochain petit repère de la journée.';
    if(/sommeil/.test(key))message=checks.protocol?'Ton rituel sommeil soutient ta régularité cette semaine.':'Un horaire de coucher plus régulier peut soutenir ton protocole sommeil.';
    else if(/jeûne/.test(key))message=checks.protocol?'Tu as suivi ton repère de jeûne aujourd’hui. Observe surtout ton énergie et ton confort.':'Renseigne ton énergie et ton confort avant de prolonger ta fenêtre de jeûne.';
    else if(/stress|anxi|cortisol/.test(key))message=checks.protocol?'Ton rituel d’apaisement est bien intégré aujourd’hui.':'Un geste d’apaisement simple peut compléter ton protocole aujourd’hui.';
    else if(/ventre|digestion|aigreur/.test(key))message=checks.protocol?'Ton repère digestif est réalisé. Observe maintenant ton confort après les repas.':'Privilégie aujourd’hui un repas simple et confortable pour ta digestion.';
    else if(/recomposition|définition|muscle|souplesse|mobilité/.test(key))message=checks.protocol?'Ton protocole soutient ta constance physique aujourd’hui.':'Associe ton protocole à une action réaliste : mobilité, marche ou séance adaptée.';
    else if(/cycle|hormone|menstru/.test(key))message=checks.protocol?'Tu as pris soin de ton rythme hormonal aujourd’hui.':'Observe ton énergie et ton confort pour adapter ton protocole à ton rythme.';
    return {title,message,done:!!checks.protocol};
  }

  let journalMemory={uid:null,date:null,ts:0,data:null};
  async function journalToday(user,{force=false}={}){
    if(!user)return null;
    const now=Date.now(),date=DAY();
    if(!force&&journalMemory.uid===user.id&&journalMemory.date===date&&now-journalMemory.ts<300000)return journalMemory.data;
    const cached=readCache(user.id);
    if(!force&&cached?.journal&&now-cached.ts<300000){journalMemory={uid:user.id,date,ts:cached.ts,data:cached.journal};return cached.journal;}
    try{
      const sb=window.initSupabase&&window.initSupabase();if(!sb)return journalMemory.data;
      // Une seule lecture compacte : le journal quotidien reste prioritaire et
      // les signaux structurés d'un ressenti de protocole ne complètent que les
      // repères quotidiens absents. Aucun texte libre n'est interprété.
      const q=sb.rpc('journal_balance_summary',{target_date:date});
      const r=await Promise.race([q,new Promise(res=>setTimeout(()=>res({data:null}),2400))]);
      const data=r?.data||null;journalMemory={uid:user.id,date,ts:now,data};return data;
    }catch(e){return journalMemory.data;}
  }

  let foodMemory={uid:null,date:null,ts:0,data:null};
  async function foodToday(user,{force=false}={}){
    if(!user)return null;
    const now=Date.now(),date=DAY();
    if(!force&&foodMemory.uid===user.id&&foodMemory.date===date&&now-foodMemory.ts<300000)return foodMemory.data;
    try{
      const sb=window.initSupabase&&window.initSupabase();if(!sb)return null;
      const q=sb.rpc('food_day_balance_summary',{target_date:date});
      const r=await Promise.race([q,new Promise(res=>setTimeout(()=>res({data:null}),1800))]);
      const data=r?.data||null;foodMemory={uid:user.id,date,ts:now,data};return data;
    }catch(e){return null;}
  }

  let trackerMemory={uid:null,date:null,ts:0,data:[]};
  function localTrackerRows(uid,date){
    const rows=[],seen=new Set();
    for(const owner of [uid,'guest'].filter(Boolean)){
      const prefix=`mt_tracker_entry_${owner}_`,suffix=`_${date}`;
      try{
        for(let i=0;i<localStorage.length;i++){
          const storageKey=localStorage.key(i);if(!storageKey?.startsWith(prefix)||!storageKey.endsWith(suffix))continue;
          const row=readJSON(storageKey);if(!row?.tracker_key)continue;
          const key=trackerAlias(row.tracker_key);if(seen.has(key))continue;
          seen.add(key);rows.push({...row,tracker_key:key,entry_date:row.entry_date||date});
        }
      }catch(e){}
    }
    return rows;
  }
  function localCyclePreference(uid){
    for(const owner of [uid,'guest'].filter(Boolean))for(const version of [2,1]){
      const raw=readJSON(`mt_custom_trackers_v${version}_${owner}`),pref=raw?.cycle;
      if(pref===true)return {enabled:true,settings:{}};
      if(pref?.enabled)return {enabled:true,settings:pref.settings&&typeof pref.settings==='object'?pref.settings:{}};
    }
    return {enabled:false,settings:{}};
  }
  function cycleProjectionRow(settings,date){
    const parse=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso||''))?new Date(`${iso}T12:00:00`):null;
    const starts=[...new Set([...(Array.isArray(settings?.period_starts)?settings.period_starts:[]),settings?.last_period_start].filter(value=>parse(value)))].sort();
    const eligible=starts.filter(value=>value<=date),anchor=eligible[eligible.length-1]||starts[0],target=parse(date),start=parse(anchor);if(!target||!start)return null;
    const cycleLength=Math.min(45,Math.max(20,Number(settings?.cycle_length)||28)),periodLength=Math.min(10,Math.max(1,Number(settings?.period_length)||5));
    const elapsed=Math.floor((target-start)/86400000),cycleDay=((elapsed%cycleLength)+cycleLength)%cycleLength+1,ovulationDay=Math.max(periodLength+3,cycleLength-14);
    const event=cycleDay<=periodLength?'menstrual':cycleDay===ovulationDay?'ovulation_day':cycleDay>=ovulationDay-2&&cycleDay<=ovulationDay+2?'ovulation_window':null;
    const phase=event==='menstrual'?'Période menstruelle':event==='ovulation_day'?'Ovulation':event==='ovulation_window'?"Fenêtre d’ovulation":cycleDay<ovulationDay-2?'Phase folliculaire':'Phase lutéale';
    const pills=event==='ovulation_day'?['Ovulation']:event==='ovulation_window'?["Fenêtre d’ovulation"]:event==='menstrual'?['Période menstruelle']:[`Cycle · J${cycleDay}`];
    return {tracker_key:'cycle',entry_date:date,projected:true,values:{cycle_day_estimate:cycleDay,cycle_phase_estimate:phase,_cycle_calendar_event:event,_cycle_projection:true,_daily:{version:1,key:'cycle',title:'Cycle & rythme hormonal',date,headline:`J${cycleDay} · ${phase}`,pills,metrics:[{label:'Jour du cycle',value:`J${cycleDay}`},{label:'Phase',value:phase}],signals:{cycle_day:cycleDay,cycle_phase:phase,cycle_event:event}}}};
  }
  async function trackersToday(user,{force=false}={}){
    if(!user)return [];
    const now=Date.now(),date=DAY();
    if(!force&&trackerMemory.uid===user.id&&trackerMemory.date===date&&now-trackerMemory.ts<300000)return trackerMemory.data;
    const localRows=localTrackerRows(user.id,date),localPreference=localCyclePreference(user.id);
    try{
      const sb=window.initSupabase&&window.initSupabase();
      let remoteRows=[],remotePreference=null;
      if(sb){
        const [entriesResult,prefResult]=await Promise.all([
          Promise.race([sb.from('user_tracker_entries').select('tracker_key,values,note').eq('user_id',user.id).eq('entry_date',date),new Promise(res=>setTimeout(()=>res({data:[]}),1800))]),
          Promise.race([sb.from('user_tracker_preferences').select('enabled,settings').eq('user_id',user.id).eq('tracker_key','cycle').maybeSingle(),new Promise(res=>setTimeout(()=>res({data:null}),1800))])
        ]);
        remoteRows=Array.isArray(entriesResult?.data)?entriesResult.data:[];remotePreference=prefResult?.data||null;
      }
      const byKey=new Map();remoteRows.forEach(row=>byKey.set(trackerAlias(row.tracker_key),{...row,tracker_key:trackerAlias(row.tracker_key)}));localRows.forEach(row=>byKey.set(trackerAlias(row.tracker_key),row));
      const preference=localPreference.enabled?localPreference:(remotePreference?.enabled?{enabled:true,settings:remotePreference.settings||{}}:{enabled:false,settings:{}});
      if(preference.enabled&&!byKey.has('cycle')){const projected=cycleProjectionRow(preference.settings,date);if(projected)byKey.set('cycle',projected);}
      const data=[...byKey.values()];trackerMemory={uid:user.id,date,ts:now,data};return data;
    }catch(e){
      const byKey=new Map(localRows.map(row=>[trackerAlias(row.tracker_key),row]));
      if(localPreference.enabled&&!byKey.has('cycle')){const projected=cycleProjectionRow(localPreference.settings,date);if(projected)byKey.set('cycle',projected);}
      const data=[...byKey.values()];trackerMemory={uid:user.id,date,ts:now,data};return data;
    }
  }

  const trackerAlias=key=>({performance_sportive:'performance_recuperation',football:'performance_recuperation',recuperation:'performance_recuperation'})[String(key||'')]||String(key||'');
  const trackerTitle=key=>({stress_regulation:'Stress & régulation',sommeil_profond:'Sommeil approfondi',digestion:'Confort digestif',reflux:'Reflux & aigreurs',equilibre_alimentaire:'Équilibre alimentaire',evolution_corporelle:'Évolution corporelle',peau:'Peau',performance_recuperation:'Activité & récupération',pas_marche:'Pas & marche',nutrition_vegetale:'Nutrition végétale & micronutriments',cycle:'Cycle & rythme hormonal',perimenopause:'Périménopause & ménopause',jeune_intermit:'Jeûne intermittent',reduction_sucre:'Réduction du sucre',changer_habitude:'Changer une habitude'})[String(key||'')]||'Suivi personnel';
  const numeric=(value)=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;};
  const firstNumber=(...values)=>{for(const value of values){const n=numeric(value);if(n!==null)return n;}return null;};
  const cleanCycleLabel=(value,event)=>event==='ovulation_day'?'Ovulation':String(value||'Cycle').replace(/Fenêtre ovulatoire/gi,"Fenêtre d’ovulation").replace(/\s+estimée?s?/gi,'').trim();

  function buildLegacy(ctx,journal,foodSummary,trackerRows=[]){
    const t=ctx?.todayState||{},j=journal||{},food=foodSummary||{},checks=t.checks||{};
    const custom={};(Array.isArray(trackerRows)?trackerRows:[]).forEach(row=>{custom[trackerAlias(row.tracker_key)]={...(row.values||{}),_note:row.note||''};});
    const stressReg=custom.stress_regulation||{},perf=custom.performance_recuperation||{},cycle=custom.cycle||{},dig=custom.digestion||{},reflux=custom.reflux||{},deepSleep=custom.sommeil_profond||{},skin=custom.peau||{},peri=custom.perimenopause||{},fast=custom.jeune_intermit||{},body=custom.evolution_corporelle||{};
    const sleep=Number(t.sleep)>0?Number(t.sleep):null;
    const raw={
      energy:firstNumber(j.tracker_energie,perf.energy_before,cycle.energy,body.energy,peri.energy,fast.energy),
      stress:firstNumber(j.tracker_stress,stressReg.stress,dig.stress,skin.stress),
      digestion:firstNumber(j.tracker_digestion,dig.comfort,peri.digestion,reflux.intensity==null?null:10-Number(reflux.intensity)),
      sleepFeeling:firstNumber(j.tracker_sommeil,deepSleep.quality,cycle.sleep,peri.sleep),
      mood:firstNumber(j.tracker_humeur,cycle.mood,peri.mood),
      recovery:firstNumber(perf.recovery),intensity:firstNumber(perf.intensity),fatigue:firstNumber(perf.fatigue_after,perf.muscle_fatigue)
    };
    const vitalityInputs=[['sleep',sleep],['energy',raw.energy],['sleepFeeling',raw.sleepFeeling],['stress',raw.stress],['recovery',raw.recovery]];
    const vitality=weighted([{value:sleep==null?null:clamp((sleep/7)*100),weight:30},{value:normalize(raw.energy),weight:30},{value:normalize(raw.sleepFeeling),weight:15},{value:raw.stress==null?null:100-normalize(raw.stress),weight:10},{value:normalize(raw.recovery),weight:15}]);
    const inner=weighted([{value:normalize(raw.digestion),weight:30},{value:normalize(raw.mood),weight:30},{value:raw.stress==null?null:100-normalize(raw.stress),weight:25},{value:normalize(raw.sleepFeeling),weight:15}]);
    const missions=Array.isArray(t.missions)?t.missions:[],missionTotal=missions.length,missionDone=missions.filter(x=>x.done).length;
    const journey=ctx?.journeySummary?.today||{};
    const recordedCustomCount=(Array.isArray(trackerRows)?trackerRows:[]).filter(row=>!row?.projected&&!row?.values?._cycle_projection).length;
    const regItems=[
      {key:'hydration',available:true,value:clamp((Number(t.hydration||0)/2)*100),weight:25,done:Number(t.hydration||0)>=2},
      {key:'routine',available:missions.some(x=>x.key==='routine'),value:checks.routine?100:0,weight:15,done:!!checks.routine},
      {key:'protocol',available:!!t.active,value:checks.protocol?100:0,weight:20,done:!!checks.protocol},
      {key:'missions',available:missionTotal>0,value:missionTotal?missionDone/missionTotal*100:0,weight:20,done:missionTotal>0&&missionDone===missionTotal},
      {key:'journal',available:true,value:t.journalDone?100:0,weight:10,done:!!t.journalDone},
      {key:'personal_trackers',available:recordedCustomCount>0,value:recordedCustomCount?100:0,weight:10,done:recordedCustomCount>0},
      {key:'journey',available:Number(journey.total||0)>0,value:journey.total?Number(journey.completed||0)/Number(journey.total)*100:0,weight:10,done:Number(journey.total||0)>0&&Number(journey.completed||0)>=Number(journey.total||0)}
    ].filter(x=>x.available);
    const regularity=weighted(regItems),completed=regItems.filter(x=>x.done).length,total=regItems.length;
    const expected=['sleep','energy','stress','digestion','sleepFeeling','mood'];
    const availableInputs=expected.filter(k=>k==='sleep'?sleep!=null:raw[k]!=null),missingInputs=expected.filter(k=>!availableInputs.includes(k));
    const hasMeaningfulToday=availableInputs.length>0||Number(t.hydration||0)>0||Object.values(checks).some(Boolean)||missionDone>0||Number(journey.completed||0)>0||!!t.journalDone||Number(food.meal_count||0)>0||recordedCustomCount>0;
    const completeness=Math.round((availableInputs.length/expected.length)*100),isDiscovery=!hasMeaningfulToday,isPartial=!isDiscovery&&completeness<70;
    let priority=isDiscovery
      ?{key:'discover',title:'Commence simplement par un premier repère.',message:'Renseigne ton sommeil, ton ressenti ou une habitude du jour. Méthode Tee commencera ensuite à comprendre ton rythme.'}
      :{key:'complete_inputs',title:'Renseigne ton sommeil ou ton ressenti.',message:'Ta lecture se précisera avec quelques repères simples.'};
    if(!isDiscovery&&availableInputs.length){
      if(vitality!=null&&vitality<55)priority={key:'support_energy',title:'Stabiliser ton énergie sans te brusquer',message:'Ton énergie semble demander davantage de douceur aujourd’hui.'};
      else if(inner!=null&&inner<55)priority={key:'softness',title:'Retrouver de la douceur',message:'Ton équilibre intérieur est en mouvement. Avance sans te surcharger.'};
      else if(regularity!=null&&regularity<50)priority={key:'consistency',title:'Transformer ton énergie en régularité',message:'Quelques repères simples peuvent soutenir ta journée.'};
      else priority={key:'consolidate',title:'Consolider ce qui te fait du bien',message:'Ton équilibre paraît stable. Continue doucement, sans en faire davantage.'};
    }
    const hydration=Number(t.hydration||0);
    const readiness=readinessFrom({isDiscovery,vitality,inner,regularity,sleep,hydration,stress:raw.stress});
    const markers=[
      marker('Sommeil',sleep==null?'À renseigner':sleep+' h',sleep==null?'unknown':sleep>=7?'good':sleep>=6?'watch':'support',sleep==null?'Ajoute ton temps de sommeil.':sleep>=7?'Durée favorable à la récupération.':'Un rythme plus régulier peut soutenir ta vitalité.'),
      marker('Hydratation',hydration>0?hydration.toFixed(hydration%1?1:0)+' L':'À commencer',hydration>=2?'good':hydration>=1?'watch':'support',hydration>=2?'Objectif quotidien atteint.':'Continue progressivement au fil de la journée.'),
      marker('Énergie',raw.energy==null?'À renseigner':raw.energy+'/10',raw.energy==null?'unknown':raw.energy>=7?'good':raw.energy>=5?'watch':'support','Basé sur ton ressenti renseigné.'),
      marker('Stress',raw.stress==null?'À renseigner':raw.stress+'/10',raw.stress==null?'unknown':raw.stress<=4?'good':raw.stress<=6?'watch':'support','Plus le niveau est bas, plus l’équilibre intérieur est soutenu.'),
      marker('Routine',checks.routine?'Réalisée':'À faire',checks.routine?'good':'watch','Un repère simple pour renforcer ta régularité.'),
      marker('Missions',missionTotal?missionDone+'/'+missionTotal:'Aucune',missionTotal&&missionDone===missionTotal?'good':missionDone>0?'watch':'unknown','Progression dans tes actions du jour.'),
      marker('Alimentation',Number(food.meal_count||0)>0?Number(food.meal_count)+' repas renseigné'+(Number(food.meal_count)>1?'s':''):'À renseigner',Number(food.meal_count||0)>=2?'good':Number(food.meal_count||0)>0?'watch':'unknown',Number(food.meal_count||0)>0?'Résumé basé uniquement sur les repas que tu as renseignés dans ton Carnet.':'Ajoute un repas dans ton Carnet pour enrichir cette lecture.')
    ];
    const guidance=dailyGuidance({isDiscovery,sleep,hydration,raw,checks,missionDone,missionTotal,hasProtocol:!!t.active,readiness});
    if(raw.recovery!=null)markers.push(marker('Récupération',raw.recovery+'/10',raw.recovery>=7?'good':raw.recovery>=5?'watch':'support','Repère issu de ton suivi Activité & récupération.'));
    if(cycle.cycle_day_estimate)markers.push(marker(cleanCycleLabel(cycle.cycle_phase_estimate,cycle._cycle_calendar_event)==='Ovulation'?'Ovulation':'Cycle',cleanCycleLabel(cycle.cycle_phase_estimate,cycle._cycle_calendar_event)==='Ovulation'?'Aujourd’hui':`J${cycle.cycle_day_estimate}`,'watch',cleanCycleLabel(cycle.cycle_phase_estimate,cycle._cycle_calendar_event)));
    if(dig.comfort!=null&&!j.tracker_digestion)markers.push(marker('Digestion',dig.comfort+'/10',Number(dig.comfort)>=7?'good':Number(dig.comfort)>=5?'watch':'support','Repère issu de ton suivi Confort digestif.'));
    if(raw.recovery!=null&&raw.recovery<5){guidance.unshift('Ta récupération est basse aujourd’hui : allège l’intensité et privilégie sommeil, hydratation et mobilité douce.');if(guidance.length>3)guidance.length=3;}
    if(cycle.cycle_phase_estimate&&raw.energy!=null&&raw.energy<5){guidance.unshift('Ton énergie est basse dans le contexte de ton cycle : adapte le rythme à ton ressenti réel.');if(guidance.length>3)guidance.length=3;}
    if(!isDiscovery&&Number(food.meal_count||0)>0&&Number(food.digestion_after||0)>0&&Number(food.digestion_after)<5){guidance.unshift('Ton confort digestif semble plus fragile après les repas renseignés : garde le prochain repas simple et observe ce qui te convient.');if(guidance.length>3)guidance.length=3;}
    const factors=influenceFactors({isDiscovery,sleep,hydration,raw,checks,missionDone,missionTotal});
    if(!isDiscovery&&Number(food.meal_count||0)>0){factors.push({label:'Alimentation',value:`${Number(food.meal_count)} repas renseigné${Number(food.meal_count)>1?'s':''}`,impact:6,tone:'positive'});factors.sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact));if(factors.length>4)factors.length=4;}
    if(!isDiscovery&&raw.recovery!=null){factors.push({label:'Récupération',value:`${raw.recovery}/10`,impact:raw.recovery>=7?13:raw.recovery>=5?2:-15,tone:raw.recovery>=5?'positive':'attention'});factors.sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact));if(factors.length>4)factors.length=4;}
    const projection=tomorrowProjection({isDiscovery,sleep,hydration,raw,checks});
    const phrase=teePhrase({isDiscovery,readiness,regularity,hydration,sleep});
    const protocol=protocolReading(t.active,checks);
    return {date:DAY(),completeness,isPartial,isDiscovery,availableInputs,missingInputs,readiness,markers,guidance,factors,projection,phrase,protocol,
      vitality:{value:isDiscovery?null:vitality,status:isDiscovery?'discover':status('vitality',vitality),label:isDiscovery?'À découvrir':label('vitality',vitality),availableInputs:vitalityInputs.filter(x=>x[1]!=null).map(x=>x[0]),missingInputs:vitalityInputs.filter(x=>x[1]==null).map(x=>x[0])},
      innerBalance:{value:isDiscovery?null:inner,status:isDiscovery?'building':status('inner',inner),label:isDiscovery?'En construction':label('inner',inner)},
      consistency:{value:isDiscovery?null:regularity,status:isDiscovery?'first_day':status('regularity',regularity),completed,total,label:isDiscovery?'Premier jour':label('regularity',regularity)},
      priority,actions:[{type:'today',label:'Voir mes repères du jour',target:'today',enabled:true},{type:'journal',label:'Écrire dans mon journal',target:'journal',enabled:true},{type:'weekly',label:'Voir mon empreinte de la semaine',target:'weekly',enabled:true}]};
  }

  function compactFoodSummary(value){
    const food=Array.isArray(value)?(value[0]||{}):(value||{});
    return {
      meal_count:firstNumber(food.meal_count,food.count)||0,
      calculated_meal_count:firstNumber(food.calculated_meal_count)||0,
      protein_total:firstNumber(food.protein_total),
      fiber_total:firstNumber(food.fiber_total),
      energy_after:firstNumber(food.energy_after),
      digestion_after:firstNumber(food.digestion_after),
      satiety_after:firstNumber(food.satiety_after),
      food_context:Array.isArray(food.food_context)?food.food_context.slice(0,8):[]
    };
  }

  function compactTrackerRow(row){
    const key=trackerAlias(row?.tracker_key),values=row?.values&&typeof row.values==='object'?row.values:{};
    const stored=values._daily&&typeof values._daily==='object'?values._daily:null;
    if(stored){
      const signals=stored.signals&&typeof stored.signals==='object'?stored.signals:{},event=signals.cycle_event||values._cycle_calendar_event||null;
      if(key==='cycle'){
        const cycleDay=firstNumber(signals.cycle_day,values.cycle_day_estimate),phase=cleanCycleLabel(signals.cycle_phase||values.cycle_phase_estimate,event);
        const pills=event==='ovulation_day'?['Ovulation']:event==='ovulation_window'?["Fenêtre d’ovulation"]:event==='menstrual'?['Période menstruelle']:(cycleDay?[`Cycle · J${cycleDay}`]:[]);
        return {key,title:String(stored.title||trackerTitle(key)),headline:cycleDay?`J${cycleDay} · ${phase}`:phase,projected:!!row?.projected||!!values._cycle_projection,pills,metrics:[{label:'Jour du cycle',value:cycleDay?`J${cycleDay}`:''},{label:'Phase',value:phase}].filter(item=>item.value),signals:{...signals,cycle_day:cycleDay,cycle_phase:phase,cycle_event:event}};
      }
      return {key,title:String(stored.title||key),headline:String(stored.headline||''),projected:!!row?.projected||!!values._cycle_projection,pills:Array.isArray(stored.pills)?stored.pills.slice(0,3):[],metrics:Array.isArray(stored.metrics)?stored.metrics.slice(0,8):[],signals};
    }
    return {key,title:trackerTitle(key),headline:'Repère renseigné',projected:!!row?.projected||!!values._cycle_projection,pills:[],metrics:[],signals:{}};
  }

  function scoreFoodBalance(food){
    // Le nombre de repas n'est jamais une note : 1, 2, 3 ou 4 repas peuvent
    // convenir selon le rythme de la personne. Un pourcentage nutritionnel
    // n'existe que lorsqu'au moins un repas contient de vrais aliments structurés.
    const calculatedMeals=Math.max(0,Number(food.calculated_meal_count)||0);
    if(!calculatedMeals)return null;
    const parts=[];
    if(food.protein_total!=null)parts.push({value:clamp((Number(food.protein_total)/calculatedMeals)/20*100),weight:45});
    if(food.fiber_total!=null)parts.push({value:clamp((Number(food.fiber_total)/calculatedMeals)/6*100),weight:40});
    if(food.satiety_after!=null)parts.push({value:normalize(food.satiety_after),weight:15});
    const result=weighted(parts);return result==null?null:Math.round(result)/100;
  }

  function buildDailySummary(ctx,journal,foodValue,trackerRows=[]){
    const t=ctx?.todayState||{},j=journal||{},food=compactFoodSummary(foodValue),rows=Array.isArray(trackerRows)?trackerRows:[];
    const valuesByKey={},dailyByKey={};
    rows.forEach(row=>{
      const key=trackerAlias(row?.tracker_key);if(!key)return;
      valuesByKey[key]=row?.values&&typeof row.values==='object'?row.values:{};
      dailyByKey[key]=compactTrackerRow(row);
    });
    const values=key=>valuesByKey[key]||{},signals=key=>dailyByKey[key]?.signals||{};
    const stressReg=values('stress_regulation'),perf=values('performance_recuperation'),walk=values('pas_marche'),plantNutrition=values('nutrition_vegetale'),cycle=values('cycle'),dig=values('digestion'),reflux=values('reflux'),deepSleep=values('sommeil_profond'),skin=values('peau'),peri=values('perimenopause'),fast=values('jeune_intermit'),body=values('evolution_corporelle'),foodTracker=values('equilibre_alimentaire'),sugar=values('reduction_sucre'),habit=values('changer_habitude');
    const sStress=signals('stress_regulation'),sPerf=signals('performance_recuperation'),sWalk=signals('pas_marche'),sPlant=signals('nutrition_vegetale'),sCycle=signals('cycle'),sDig=signals('digestion'),sReflux=signals('reflux'),sSleep=signals('sommeil_profond'),sSkin=signals('peau'),sPeri=signals('perimenopause'),sFast=signals('jeune_intermit'),sBody=signals('evolution_corporelle'),sFood=signals('equilibre_alimentaire'),sSugar=signals('reduction_sucre'),sHabit=signals('changer_habitude');
    const baseSleep=Number(t.sleep)>0?Number(t.sleep)*60:null;
    const customSleepHours=firstNumber(deepSleep._sleep_hours);
    const sleepMinutes=firstNumber(sSleep.sleep_minutes,customSleepHours==null?null:customSleepHours*60,baseSleep);
    const hydrationLiters=firstNumber(t.hydration)||0;
    const foodScore=scoreFoodBalance(food),trackerFoodScore=firstNumber(sFood.nutrition_balance);
    // nutritionBalance désigne uniquement les repères réellement calculés à
    // partir des aliments du Carnet. Le suivi « Équilibre alimentaire » reste
    // disponible séparément sans être présenté comme un calcul CIQUAL.
    const nutritionBalance=foodScore;
    const refluxIntensity=firstNumber(sReflux.reflux,reflux.intensity);
    const digestion=firstNumber(j.tracker_digestion,food.digestion_after,sDig.digestion,dig.comfort,sFood.digestion,foodTracker.digestion_after,sPeri.digestion,peri.digestion,sFast.digestion,fast.digestion,refluxIntensity==null?null:10-refluxIntensity);
    const energy=firstNumber(j.tracker_energie,sStress.energy,stressReg.energy,sPerf.energy,perf.energy_before,sWalk.energy,walk.energy_after,sCycle.energy,cycle.energy,sBody.energy,body.energy,sPeri.energy,peri.energy,sFast.energy,fast.energy,sSleep.energy,deepSleep.wake_state,sFood.energy,foodTracker.energy_after,food.energy_after);
    const stress=firstNumber(j.tracker_stress,sStress.stress,stressReg.stress,sDig.stress,dig.stress,sSkin.stress,skin.stress,sSugar.stress,sugar.stress);
    const sleepQuality=firstNumber(j.tracker_sommeil,sStress.sleep_quality,stressReg.sleep_context,sSleep.sleep_quality,deepSleep.quality,sCycle.sleep_quality,cycle.sleep,sPeri.sleep_quality,peri.sleep,sSkin.sleep_quality,skin.sleep);
    const mood=firstNumber(j.tracker_humeur,sStress.mood,stressReg.mood,sCycle.mood,cycle.mood,sPeri.mood,peri.mood);
    const recovery=firstNumber(sPerf.recovery,perf.recovery),sportIntensity=firstNumber(sPerf.sport_intensity,perf.intensity),sportDuration=firstNumber(sPerf.sport_duration,perf.duration),sportFatigue=firstNumber(sPerf.fatigue,perf.fatigue_after,perf.muscle_fatigue);
    const cycleEvent=sCycle.cycle_event||cycle._cycle_calendar_event||null,cycleDay=firstNumber(sCycle.cycle_day,cycle.cycle_day_estimate),cyclePhase=cleanCycleLabel(sCycle.cycle_phase||cycle.cycle_phase_estimate||'',cycleEvent);
    return {
      version:1,date:DAY(),
      sleep_minutes:sleepMinutes==null?null:Math.round(sleepMinutes),
      hydration_ml:Math.round(hydrationLiters*1000),
      nutrition_meals:Math.max(Number(food.meal_count)||0,firstNumber(sFood.nutrition_meals)||0),
      nutrition_calculated_meals:Number(food.calculated_meal_count)||0,
      nutrition_balance:nutritionBalance==null?null:Math.round(nutritionBalance*100)/100,
      nutrition_protein_g:food.protein_total,
      nutrition_fiber_g:food.fiber_total,
      micronutrient_coverage_count:firstNumber(sPlant.micronutrient_coverage_count,plantNutrition.micronutrient_coverage_count),
      micronutrient_source_count:firstNumber(sPlant.nutrition_micronutrient_source_count,plantNutrition.micronutrient_source_count),
      nutrition_micros:sPlant.nutrition_micros||plantNutrition._micronutrients||null,
      nutrition_micronutrient_sources:sPlant.nutrition_micronutrient_sources||plantNutrition._micronutrient_sources||null,
      nutrition_carbs_g:firstNumber(sPlant.nutrition_carbs_g,plantNutrition.carbs_g),nutrition_fat_g:firstNumber(sPlant.nutrition_fat_g,plantNutrition.fat_g),
      nutrition_energy:firstNumber(food.energy_after),
      nutrition_digestion:firstNumber(food.digestion_after),
      nutrition_satiety:firstNumber(food.satiety_after),
      food_context:Array.isArray(food.food_context)?food.food_context.slice(0,8):[],
      sport_intensity:sportIntensity,sport_duration_minutes:sportDuration,recovery,sport_fatigue:sportFatigue,
      steps:firstNumber(sWalk.steps,walk.steps,sPerf.steps,perf._healthkit_steps),distance_km:firstNumber(sWalk.distance_km,walk.distance_km,sPerf.distance_km,perf._healthkit_distance_km),walking_minutes:firstNumber(sWalk.walking_minutes,walk.walking_minutes),step_length_cm:firstNumber(sWalk.walking_step_length_cm,sWalk.step_length_cm,walk.step_length_cm),walking_speed_kmh:firstNumber(sWalk.walking_speed_kmh,walk.walking_speed_kmh),flights_climbed:firstNumber(sWalk.flights_climbed,sWalk.flights,walk.flights),active_energy_kcal:firstNumber(sWalk.active_energy_kcal,walk.active_energy_kcal,sPerf.active_energy_kcal,perf._healthkit_active_energy_kcal),walking_workout_minutes:firstNumber(sWalk.walking_workout_minutes,walk.walking_workout_minutes),walking_workout_count:firstNumber(sWalk.walking_workout_count,walk.walking_workout_count),walking_distribution_score:firstNumber(sWalk.walking_distribution_score),
      cycle_day:cycleDay,cycle_phase:cyclePhase||null,cycle_event:cycleEvent,
      menopause_state:sPeri.menopause_state||peri.day_state||null,
      hot_flashes:sPeri.hot_flashes||peri.hot_flashes||null,
      night_sweats:sPeri.night_sweats||peri.night_sweats||null,
      digestion,stress,energy,sleep_quality:sleepQuality,mood,
      reflux_intensity:refluxIntensity,
      skin_discomfort:firstNumber(sSkin.skin_discomfort),
      fast_minutes:firstNumber(sFast.fast_minutes,fast._fast_hours==null?null:Number(fast._fast_hours)*60),
      sugar_craving:firstNumber(sSugar.sugar_craving,sugar.craving),
      habit_done:sHabit.habit_done===true||sSugar.habit_done===true||sugar.no_added_sugar==='Oui'||/Petit pas réalisé/i.test(String(habit.day_state||''))||!!String(habit.victory||'').trim(),
      food_tracker_balance:trackerFoodScore,
      active_trackers:Object.keys(valuesByKey),
      recorded_trackers:rows.filter(row=>!row?.projected&&!row?.values?._cycle_projection).map(row=>trackerAlias(row.tracker_key)),
      tracker_cards:Object.values(dailyByKey)
    };
  }

  function crossReading(daily,isDiscovery){
    if(isDiscovery)return null;
    const sleepHours=daily.sleep_minutes==null?null:daily.sleep_minutes/60;
    if(/plus inconfortable/i.test(String(daily.menopause_state||''))){
      return {
        key:'cross_menopause',label:'Rythme à préserver',title:'Une journée qui demande plus de confort',tone:'recover',
        message:'Tu as signalé une journée plus inconfortable. Tes autres repères du jour permettent d’adapter les conseils sans supposer quels symptômes tu ressens.',
        priority:{key:'menopause_comfort',title:'Respecter ton ressenti aujourd’hui',message:'Allège ce qui peut l’être et appuie-toi sur les gestes qui te procurent réellement du confort.'},
        guidance:['Adapte ton activité à ton énergie et à ton confort réels.','Observe ce qui t’aide aujourd’hui sans chercher à tout renseigner.','Si un symptôme t’inquiète ou persiste, parles-en à un professionnel de santé.']
      };
    }
    if(sleepHours!=null&&sleepHours<6&&daily.sport_intensity!=null&&daily.sport_intensity>=7&&daily.recovery!=null&&daily.recovery<=4){
      return {
        key:'cross_recovery',label:'Besoin de douceur',title:'Ta récupération est plus sollicitée',tone:'recover',
        message:'Ta récupération semble plus sollicitée aujourd’hui. Ton sommeil court et ta séance intense pèsent davantage que d’habitude sur ta disponibilité.',
        priority:{key:'soft_recovery',title:'Soutenir ta récupération sans te brusquer',message:'Allège l’intensité si tu le peux et appuie-toi sur un repas nourrissant, une hydratation progressive et un temps de repos.'},
        guidance:['Allège l’intensité si tu le peux et privilégie une récupération douce.','Garde un repas nourrissant et régulier pour soutenir ta disponibilité.','Hydrate-toi progressivement et protège ton prochain temps de sommeil.']
      };
    }
    if(/lut/i.test(String(daily.cycle_phase||''))&&daily.energy!=null&&daily.energy<=5){
      return {
        key:'cross_cycle',label:'Rythme à adapter',title:'Ton énergie évolue aujourd’hui',tone:'moderate',
        message:'Ton énergie est légèrement plus basse aujourd’hui. Cela coïncide avec une phase où tes besoins de récupération peuvent évoluer.',
        priority:{key:'cycle_pace',title:'Adapter le rythme à ton ressenti',message:'Garde ton cycle comme un repère, puis ajuste surtout ta journée à ton énergie et à ton confort réels.'},
        guidance:['Adapte l’intensité à ton énergie réelle plutôt qu’à un objectif fixe.','Préserve des repas réguliers et un temps de récupération confortable.']
      };
    }
    if(daily.digestion!=null&&daily.digestion>=7&&daily.nutrition_balance!=null&&daily.nutrition_balance>=.6&&daily.hydration_ml>0&&daily.hydration_ml<1500){
      return {
        key:'cross_food_hydration',label:'Équilibre à ajuster',title:'Ton confort digestif reste favorable',tone:'moderate',
        message:'Ta digestion est restée confortable après les repas renseignés. Ton hydratation peut encore progresser au fil de la journée.',
        priority:{key:'hydrate',title:'Compléter doucement ton hydratation',message:'Tes repères alimentaires et digestifs sont renseignés ; poursuis maintenant ton hydratation sans chercher à rattraper tout d’un coup.'},
        guidance:['Poursuis ton hydratation par petites prises au fil de la journée.','Conserve les repas qui t’ont laissé un confort digestif favorable.']
      };
    }
    if(daily.sport_intensity!=null&&daily.sport_intensity>=7&&daily.recovery!=null&&daily.recovery<5){
      return {
        key:'cross_sport',label:'Récupération à soutenir',title:'Ta séance pèse sur ta disponibilité',tone:'recover',
        message:'Ta séance a été intense et ta récupération reste basse. Méthode Tee relie ces deux repères pour t’inviter à alléger la suite de la journée.',
        priority:{key:'recover_after_sport',title:'Faire de la récupération une priorité',message:'Privilégie une récupération calme, une hydratation régulière et un prochain repas nourrissant.'},
        guidance:['Laisse une vraie place à la récupération après cette séance.','Évite d’ajouter une nouvelle contrainte intense aujourd’hui.']
      };
    }
    return null;
  }

  function dailyTrackerMarker(card){
    const firstPill=String(card?.pills?.[0]||''),value=firstPill.includes('·')?firstPill.split('·').slice(1).join('·').trim():(card?.headline||'Renseigné');
    const key=card?.key||'',signals=card?.signals||{};
    let state='watch';
    if(key==='reflux'&&numeric(signals.reflux)!=null)state=Number(signals.reflux)<=3?'good':Number(signals.reflux)<=6?'watch':'support';
    else if(key==='reduction_sucre'&&numeric(signals.sugar_craving)!=null)state=Number(signals.sugar_craving)<=4?'good':Number(signals.sugar_craving)<=6?'watch':'support';
    else if(key==='changer_habitude')state=signals.habit_done?'good':'watch';
    else if(key==='peau'&&numeric(signals.skin_discomfort)!=null)state=Number(signals.skin_discomfort)<=4?'good':Number(signals.skin_discomfort)<=6?'watch':'support';
    if(key==='cycle'&&signals.cycle_event==='ovulation_day')return marker('Ovulation','Aujourd’hui',state,'Repère indicatif calculé à partir de ton cycle renseigné.');
    return marker(card?.title||'Suivi personnel',value||'Renseigné',state,card?.projected?'Repère indicatif calculé à partir de ton cycle renseigné.':'Repère du jour issu de ton Carnet.');
  }

  function priorityInsightFrom({isDiscovery,priority,cross,daily,sleep,hydration,raw,checks,missionDone,missionTotal,todayState}){
    if(isDiscovery||!priority||priority.key==='complete_inputs')return null;
    const evidence=[],seen=new Set();
    const add=(key,label,value)=>{if(value===null||value===undefined||value==='')return;if(seen.has(key))return;seen.add(key);evidence.push({key,label,value:String(value)});};
    const sleepLabel=sleep==null?'':`${Math.floor(sleep)} h${Math.round((sleep%1)*60)?` ${Math.round((sleep%1)*60)} min`:''}`;
    const nutritionLabel=daily.nutrition_meals?`${daily.nutrition_meals} repas${daily.nutrition_balance==null?' · repères non calculés':` · ${Math.round(daily.nutrition_balance*100)} %`}`:'';
    const available={
      sleep:()=>add('sleep','Sommeil',sleepLabel),energy:()=>add('energy','Énergie',raw.energy==null?'':`${raw.energy}/10`),
      sleepQuality:()=>add('sleepQuality','Qualité du sommeil',raw.sleepFeeling==null?'':`${raw.sleepFeeling}/10`),stress:()=>add('stress','Stress',raw.stress==null?'':`${raw.stress}/10`),
      recovery:()=>add('recovery','Récupération',raw.recovery==null?'':`${raw.recovery}/10`),digestion:()=>add('digestion','Digestion',raw.digestion==null?'':`${raw.digestion}/10`),
      mood:()=>add('mood','Humeur',raw.mood==null?'':`${raw.mood}/10`),hydration:()=>add('hydration','Hydratation',hydration>0?`${hydration.toFixed(hydration%1?1:0)} L`:''),
      nutrition:()=>add('nutrition','Alimentation',nutritionLabel),activity:()=>add('activity','Activité',raw.intensity==null?'':`intensité ${raw.intensity}/10`),
      cycle:()=>add('cycle','Cycle',daily.cycle_phase?`${daily.cycle_day?`J${daily.cycle_day} · `:''}${daily.cycle_phase} · repère indicatif`:''),
      menopause:()=>add('menopause','Ressenti du jour',daily.menopause_state||''),routine:()=>add('routine','Routine',checks.routine?'réalisée':''),
      missions:()=>add('missions','Missions',missionDone>0?`${missionDone}/${missionTotal} réalisées`:''),journal:()=>add('journal','Journal',todayState?.journalDone?'renseigné':''),
      trackers:()=>add('trackers','Suivis personnels',daily.recorded_trackers?.length?`${daily.recorded_trackers.length} renseigné${daily.recorded_trackers.length>1?'s':''}`:'')
    };
    const byPriority={
      support_energy:['sleep','energy','sleepQuality','stress','recovery','nutrition'],softness:['digestion','mood','stress','sleepQuality','nutrition'],
      consistency:['hydration','nutrition','routine','missions','journal','trackers'],hydrate:['hydration'],nutrition_observe:['nutrition','digestion'],
      observe_one:['energy','sleep','sleepQuality','stress','digestion','mood','recovery','activity'],
      recovery_observe:['recovery','activity','sleep'],consolidate:['energy','sleep','digestion','mood','recovery','hydration','nutrition','routine']
    };
    const byCross={
      cross_menopause:['menopause','energy','sleepQuality','mood'],cross_recovery:['sleep','activity','recovery'],cross_cycle:['cycle','energy'],
      cross_food_hydration:['digestion','nutrition','hydration'],cross_sport:['activity','recovery']
    };
    (byCross[cross?.key]||byPriority[priority.key]||['energy','sleep','stress','digestion','recovery','hydration','nutrition']).forEach(key=>available[key]?.());
    if(!evidence.length)return null;
    const whyByKey={
      support_energy:'Tes repères d’énergie et de récupération invitent à préserver davantage ton rythme aujourd’hui.',
      softness:'Les ressentis que tu as renseignés indiquent qu’une journée plus douce peut mieux correspondre à ton état actuel.',
      consistency:'Tes actions déjà renseignées montrent que le prochain petit geste régulier compte davantage que d’en faire beaucoup.',
      hydrate:'Ton niveau d’hydratation renseigné aujourd’hui peut encore progresser tranquillement.',
      nutrition_observe:'Tes repas renseignés permettent de proposer un repère alimentaire simple, sans interpréter ce que tu n’as pas indiqué.',
      observe_one:'Cette suggestion s’appuie sur ce seul repère renseigné et ne décrit pas l’ensemble de ta journée.',
      recovery_observe:'Ton suivi d’activité indique que ta récupération mérite d’être privilégiée aujourd’hui.',
      consolidate:'Les repères disponibles sont favorables : la priorité est de conserver ce qui fonctionne sans ajouter de contrainte.'
    };
    return {title:priority.title,message:priority.message,why:cross?.message||whyByKey[priority.key]||'Cette suggestion repose uniquement sur les repères que tu as renseignés aujourd’hui.',usedReperes:evidence.slice(0,4)};
  }

  function build(ctx,journal,foodSummary,trackerRows=[],beverageSummary=null){
    const t=ctx?.todayState||{},j=journal||{},checks=t.checks||{},food=compactFoodSummary(foodSummary),daily=buildDailySummary(ctx,journal,food,trackerRows),bev=beverageSummary&&typeof beverageSummary==='object'?beverageSummary:{};
    daily.beverage_count=Number(bev.beverage_count)||0;daily.infusion_count=Number(bev.infusion_count)||0;daily.fruit_beverage_count=Number(bev.fruit_beverage_count)||0;
    if(daily.energy==null&&Number(bev.energy_after)>0)daily.energy=Number(bev.energy_after);
    if(daily.digestion==null&&Number(bev.digestion_after)>0)daily.digestion=Number(bev.digestion_after);
    const sleep=daily.sleep_minutes==null?null:Math.round(daily.sleep_minutes/6)/10,hydration=daily.hydration_ml/1000;
    const raw={energy:daily.energy,stress:daily.stress,digestion:daily.digestion,sleepFeeling:daily.sleep_quality,mood:daily.mood,recovery:daily.recovery,intensity:daily.sport_intensity,fatigue:daily.sport_fatigue};
    const vitalityInputs=[['sleep',sleep],['energy',raw.energy],['sleepFeeling',raw.sleepFeeling],['stress',raw.stress],['recovery',raw.recovery],['nutritionEnergy',daily.nutrition_energy]];
    const vitalityParts=[
      {key:'sleep',value:sleepScore(sleep),weight:25},
      {key:'energy',value:strictRating(raw.energy),weight:24},
      {key:'sleepFeeling',value:strictRating(raw.sleepFeeling),weight:13},
      {key:'stress',value:raw.stress==null?null:100-strictRating(raw.stress),weight:12},
      {key:'recovery',value:strictRating(raw.recovery),weight:18},
      {key:'nutritionEnergy',value:strictRating(daily.nutrition_energy),weight:8}
    ];
    const vitalityMajor=['sleep','energy','stress','recovery'].map(key=>vitalityParts.find(x=>x.key===key)?.value);
    const vitality=hardenWellbeing(vitalityParts,vitalityMajor);

    const innerFood=daily.nutrition_balance!=null?clamp(daily.nutrition_balance*100):(daily.food_tracker_balance!=null?clamp(daily.food_tracker_balance*100):null);
    const innerParts=[
      {key:'digestion',value:strictRating(raw.digestion),weight:28},
      {key:'mood',value:strictRating(raw.mood),weight:24},
      {key:'stress',value:raw.stress==null?null:100-strictRating(raw.stress),weight:25},
      {key:'sleepFeeling',value:strictRating(raw.sleepFeeling),weight:13},
      {key:'nutrition',value:innerFood,weight:10}
    ];
    const innerMajor=['digestion','mood','stress'].map(key=>innerParts.find(x=>x.key===key)?.value);
    const inner=hardenWellbeing(innerParts,innerMajor);

    const missions=Array.isArray(t.missions)?t.missions:[],missionTotal=missions.length,missionDone=missions.filter(x=>x.done).length,journey=ctx?.journeySummary?.today||{};
    const regItems=[
      {key:'hydration',available:true,value:clamp(hydration/2*100),weight:30,done:hydration>=2},
      {key:'journal',available:true,value:t.journalDone?100:0,weight:15,done:!!t.journalDone},
      {key:'routine',available:missions.some(x=>x.key==='routine'),value:checks.routine?100:0,weight:15,done:!!checks.routine},
      {key:'protocol',available:!!t.active,value:checks.protocol?100:0,weight:15,done:!!checks.protocol},
      {key:'missions',available:missionTotal>0,value:missionTotal?missionDone/missionTotal*100:0,weight:15,done:missionTotal>0&&missionDone===missionTotal},
      {key:'personal_trackers',available:daily.recorded_trackers.length>0,value:daily.recorded_trackers.length?100:0,weight:12,done:daily.recorded_trackers.length>0},
      {key:'journey',available:Number(journey.total||0)>0,value:journey.total?Number(journey.completed||0)/Number(journey.total)*100:0,weight:10,done:Number(journey.total||0)>0&&Number(journey.completed||0)>=Number(journey.total||0)}
    ].filter(x=>x.available);
    const hasRegularityEvidence=hydration>0||daily.beverage_count>0||daily.recorded_trackers.length>0||!!t.journalDone||!!checks.routine||!!checks.protocol||missionDone>0||Number(journey.completed||0)>0;
    const regularity=hasRegularityEvidence?hardenRegularity(regItems):null,completed=regItems.filter(x=>x.done).length,total=regItems.length;
    const expected=['sleep','energy','stress','digestion','sleepFeeling','mood'],availableInputs=expected.filter(k=>k==='sleep'?sleep!=null:raw[k]!=null),missingInputs=expected.filter(k=>!availableInputs.includes(k));
    // Une projection automatique du cycle n'est pas une saisie du jour et ne
    // doit donc jamais, à elle seule, faire apparaître de faux scores à 0 %.
    const hasMeaningfulToday=availableInputs.length>0||hydration>0||daily.beverage_count>0||Object.values(checks).some(Boolean)||missionDone>0||Number(journey.completed||0)>0||!!t.journalDone||daily.nutrition_meals>0||daily.recorded_trackers.length>0;
    const completeness=Math.round(availableInputs.length/expected.length*100),isDiscovery=!hasMeaningfulToday,isPartial=!isDiscovery&&completeness<70;
    let priority=isDiscovery
      ?{key:'discover',title:'Commence simplement par un premier repère.',message:'Renseigne ton sommeil, ton ressenti ou une habitude du jour. Méthode Tee commencera ensuite à comprendre ton rythme.'}
      :{key:'complete_inputs',title:'Renseigne ton sommeil ou ton ressenti.',message:'Ta lecture se précisera avec quelques repères simples.'};
    if(!isDiscovery&&availableInputs.length){
      if(vitality!=null&&vitality<55)priority={key:'support_energy',title:'Stabiliser ton énergie sans te brusquer',message:'Ton énergie semble demander davantage de douceur aujourd’hui.'};
      else if(inner!=null&&inner<55)priority={key:'softness',title:'Retrouver de la douceur',message:'Ton équilibre intérieur est en mouvement. Avance sans te surcharger.'};
      else if(regularity!=null&&regularity<50)priority={key:'consistency',title:'Transformer ton énergie en régularité',message:'Quelques repères simples peuvent soutenir ta journée.'};
      else if(availableInputs.length===1)priority={key:'observe_one',title:'Garder ce repère comme point d’appui',message:'Ce repère est favorable aujourd’hui. Observe simplement ce qui t’aide à le conserver.'};
      else priority={key:'consolidate',title:'Consolider ce qui te fait du bien',message:'Ton équilibre paraît stable. Continue doucement, sans en faire davantage.'};
    }
    if(!isDiscovery&&!availableInputs.length){
      if(raw.recovery!=null)priority=raw.recovery<5
        ?{key:'recovery_observe',title:'Donner la priorité à ta récupération',message:'Adapte la suite de la journée à ta récupération réelle, sans ajouter d’intensité inutile.'}
        :{key:'consolidate',title:'Conserver un rythme confortable',message:'Ta récupération renseignée est favorable ; poursuis sans chercher à en faire davantage.'};
      else if(hydration>0)priority=hydration<2
        ?{key:'hydrate',title:'Poursuivre doucement ton hydratation',message:'Continue par petites prises au fil de la journée, sans chercher à tout rattraper d’un coup.'}
        :{key:'consolidate',title:'Conserver ce repère d’hydratation',message:'Ton repère d’hydratation est posé aujourd’hui ; garde simplement ce rythme.'};
      else if(daily.nutrition_balance!=null)priority={key:'nutrition_observe',title:'Observer ce qui te convient après les repas',message:'Appuie-toi sur ton énergie, ta satiété et ton confort digestif plutôt que sur la perfection.'};
    }
    const baseReadiness=!isDiscovery&&!availableInputs.length
      ?{key:'limited',label:'Repère enregistré',title:'Ta journée se construit',message:'Ce repère est conservé. Ajoute un ressenti si tu souhaites une lecture plus personnalisée.',tone:'neutral'}
      :readinessFrom({isDiscovery,vitality,inner,regularity,sleep,hydration,stress:raw.stress}),cross=crossReading(daily,isDiscovery);
    const readiness=cross?{key:cross.key,label:cross.label,title:cross.title,message:cross.message,tone:cross.tone}:baseReadiness;
    if(cross?.priority)priority=cross.priority;
    const markers=[
      marker('Sommeil',sleep==null?'À renseigner':`${Math.floor(sleep)} h ${Math.round((sleep%1)*60)||''}`.trim(),sleep==null?'unknown':sleep>=7?'good':sleep>=6?'watch':'support',sleep==null?'Ajoute ton temps de sommeil.':sleep>=7?'Durée favorable à la récupération.':'Un rythme plus régulier peut soutenir ta vitalité.'),
      marker('Hydratation',hydration>0?hydration.toFixed(hydration%1?1:0)+' L':'À commencer',hydration>=2?'good':hydration>=1?'watch':'support',hydration>=2?'Objectif quotidien atteint.':'Continue progressivement au fil de la journée.'),
      marker('Énergie',raw.energy==null?'À renseigner':raw.energy+'/10',raw.energy==null?'unknown':raw.energy>=7?'good':raw.energy>=5?'watch':'support','Basé sur ton ressenti renseigné.'),
      marker('Stress',raw.stress==null?'À renseigner':raw.stress+'/10',raw.stress==null?'unknown':raw.stress<=4?'good':raw.stress<=6?'watch':'support','Plus le niveau est bas, plus l’équilibre intérieur est soutenu.'),
      marker('Routine',checks.routine?'Réalisée':'À faire',checks.routine?'good':'watch','Un repère simple pour renforcer ta régularité.'),
      marker('Missions',missionTotal?missionDone+'/'+missionTotal:'Aucune',missionTotal&&missionDone===missionTotal?'good':missionDone>0?'watch':'unknown','Progression dans tes actions du jour.'),
      marker('Alimentation',daily.nutrition_meals?`${daily.nutrition_meals} repas renseigné${daily.nutrition_meals>1?'s':''}`:'À renseigner',daily.nutrition_balance!=null?(daily.nutrition_balance>=.65?'good':'watch'):'unknown',daily.nutrition_meals?(daily.nutrition_balance==null?'Repas enregistré · repères nutritionnels non calculés.':'Repères nutritionnels calculés uniquement à partir des aliments renseignés.'):'Ajoute un repas dans ton Carnet pour enrichir cette lecture.')
    ];
    const seenMarker=new Set(markers.map(x=>x.label));
    (daily.tracker_cards||[]).forEach(card=>{const next=dailyTrackerMarker(card);if(!seenMarker.has(next.label)){seenMarker.add(next.label);markers.push(next);}});
    if(raw.recovery!=null&&!seenMarker.has('Récupération'))markers.push(marker('Récupération',raw.recovery+'/10',raw.recovery>=7?'good':raw.recovery>=5?'watch':'support','Repère issu de Activité & récupération.'));
    const guidance=[...(cross?.guidance||[]),...dailyGuidance({isDiscovery,sleep,hydration,raw,checks,missionDone,missionTotal,hasProtocol:!!t.active,readiness})];
    if(!cross&&raw.recovery!=null&&raw.recovery<5)guidance.unshift('Ta récupération est basse aujourd’hui : allège l’intensité et privilégie sommeil, hydratation et mobilité douce.');
    const finalGuidance=[...new Set(guidance)].slice(0,3);
    const factors=influenceFactors({isDiscovery,sleep,hydration,raw,checks,missionDone,missionTotal}),addFactor=f=>{const i=factors.findIndex(x=>x.label===f.label);if(i>=0)factors[i]=f;else factors.push(f);};
    if(!isDiscovery&&daily.nutrition_meals>0)addFactor({label:'Alimentation',value:daily.nutrition_balance==null?`${daily.nutrition_meals} repas · repères non calculés`:`${daily.nutrition_meals} repas · équilibre ${Math.round(daily.nutrition_balance*100)} %`,impact:daily.nutrition_balance==null?0:(daily.nutrition_balance>=.65?12:-8),tone:daily.nutrition_balance==null?'neutral':daily.nutrition_balance>=.65?'positive':'attention'});
    if(!isDiscovery&&raw.recovery!=null)addFactor({label:'Récupération',value:`${raw.recovery}/10`,impact:raw.recovery>=7?15:raw.recovery>=5?2:-18,tone:raw.recovery>=5?'positive':'attention'});
    if(!isDiscovery&&raw.intensity!=null)addFactor({label:'Séance',value:`Intensité ${raw.intensity}/10`,impact:raw.intensity>=7?-14:raw.intensity>=5?-3:5,tone:raw.intensity>=7?'attention':'positive'});
    if(!isDiscovery&&daily.cycle_phase)addFactor({label:'Cycle',value:daily.cycle_day?`J${daily.cycle_day} · ${daily.cycle_phase}`:daily.cycle_phase,impact:/lut/i.test(daily.cycle_phase)&&raw.energy!=null&&raw.energy<=5?-13:2,tone:/lut/i.test(daily.cycle_phase)&&raw.energy!=null&&raw.energy<=5?'attention':'positive'});
    if(!isDiscovery&&raw.digestion!=null)addFactor({label:'Digestion',value:`${raw.digestion}/10`,impact:raw.digestion>=7?12:raw.digestion>=5?2:-14,tone:raw.digestion>=5?'positive':'attention'});
    factors.sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact));factors.length=Math.min(4,factors.length);
    const projection=tomorrowProjection({isDiscovery,sleep,hydration,raw,checks}),phrase=cross?'Méthode Tee relie tes repères pour éclairer ta journée, sans poser de diagnostic.':teePhrase({isDiscovery,readiness,regularity,hydration,sleep}),protocol=protocolReading(t.active,checks);
    const priorityInsight=priorityInsightFrom({isDiscovery,priority,cross,daily,sleep,hydration,raw,checks,missionDone,missionTotal,todayState:t});
    const result={date:DAY(),dailySummary:daily,completeness,isPartial,isDiscovery,availableInputs,missingInputs,readiness,markers,guidance:finalGuidance,factors,projection,phrase,protocol,priorityInsight,
      vitality:{value:isDiscovery?null:vitality,status:isDiscovery?'discover':status('vitality',vitality),label:isDiscovery?'À découvrir':label('vitality',vitality),availableInputs:vitalityInputs.filter(x=>x[1]!=null).map(x=>x[0]),missingInputs:vitalityInputs.filter(x=>x[1]==null).map(x=>x[0])},
      innerBalance:{value:isDiscovery?null:inner,status:isDiscovery?'building':status('inner',inner),label:isDiscovery?'En construction':label('inner',inner)},
      consistency:{value:isDiscovery?null:regularity,status:isDiscovery?'first_day':status('regularity',regularity),completed,total,label:isDiscovery?'Premier jour':regularity==null?'À construire':label('regularity',regularity)},
      priority,actions:[{type:'today',label:'Voir mes repères du jour',target:'today',enabled:true},{type:'journal',label:'Écrire dans mon journal',target:'journal',enabled:true},{type:'weekly',label:'Voir mon empreinte de la semaine',target:'weekly',enabled:true}]};
    window.mtTeeDailySummary=daily;return result;
  }

  function ring(name,obj){const val=obj?.value,pct=val==null?0:Math.round(val);return `<div class="mt-tee-balance-ring" aria-label="${esc(name)} : ${val==null?esc(obj?.label||'À découvrir'):pct+' %'}" style="--mt-balance:${pct}"><div class="mt-tee-balance-ring__dial"><span>${val==null?'—':pct+' %'}</span></div><b>${esc(name)}</b><small>${esc(obj?.label||'À découvrir')}</small></div>`;}
  const priorityHiddenMemory=new Set();
  function priorityDismissKey(){return `mt_tee_priority_hidden_${currentUid(window.__MT_TEE_BALANCE_CONTEXT__||{})}_${DAY()}`;}
  function isPriorityHidden(){const key=priorityDismissKey();try{return localStorage.getItem(key)==='1'||priorityHiddenMemory.has(key);}catch(e){return priorityHiddenMemory.has(key);}}
  function priorityInsightHTML(d){
    const insight=d?.priorityInsight;if(!insight)return '';
    if(isPriorityHidden())return `<div class="mt-tee-priority-hidden"><span>Lecture masquée uniquement pour aujourd’hui.</span><button type="button" onclick="window.mtRestoreTeePriority&&window.mtRestoreTeePriority()">Afficher</button></div>`;
    return `<section class="mt-tee-daily-priority"><button class="mt-tee-priority-dismiss" type="button" onclick="window.mtDismissTeePriority&&window.mtDismissTeePriority()" aria-label="Masquer cette lecture pour aujourd’hui">×</button><small>MA PRIORITÉ AUJOURD’HUI</small><h3>${esc(insight.title)}</h3><p class="mt-tee-priority-action">${esc(insight.message)}</p><div class="mt-tee-priority-why"><b>Pourquoi cette suggestion ?</b><p>${esc(insight.why)}</p></div><div class="mt-tee-priority-sources"><b>Repères utilisés</b><div>${(insight.usedReperes||[]).map(item=>`<span>${esc(item.label)} · ${esc(item.value)}</span>`).join('')}</div></div><button class="mt-tee-priority-feedback" type="button" onclick="window.mtDismissTeePriority&&window.mtDismissTeePriority()">Cette lecture ne me correspond pas</button></section>`;
  }
  function prioritySlotHTML(d){return `<div data-mt-priority-slot>${priorityInsightHTML(d)}</div>`;}
  function cardHTML(d){const note=d.isDiscovery?'Dès tes premiers repères, ta lecture personnalisée apparaîtra ici.':(d.isPartial?'Lecture partielle · complète ton ressenti pour l’affiner.':'');const r=d.readiness||{},priorityMessage=!isPriorityHidden()&&d.priorityInsight?.message;return `<article class="mt-tee-balance-card${d.isDiscovery?' is-discovery':''}" onclick="window.mtOpenTeeBalance&&window.mtOpenTeeBalance()"><div class="mt-tee-balance-kicker">MON ÉQUILIBRE AUJOURD’HUI</div><h2>Comprendre comment je vais</h2><div class="mt-tee-balance-rings">${ring('Vitalité',d.vitality)}${ring('Équilibre intérieur',d.innerBalance)}${ring('Régularité',d.consistency)}</div><div class="mt-tee-readiness-inline is-${esc(r.tone||'neutral')}"><span></span><b>${esc(r.label||'À découvrir')}</b></div><p class="mt-tee-balance-message">${esc(priorityMessage||r.message||d.priority.message)}</p>${note?`<small class="mt-tee-balance-partial">${esc(note)}</small>`:''}<span class="mt-tee-balance-cta">Comprendre ma journée →</span></article>`;}
  function inlineHTML(d){const r=d.readiness||{};return `<button type="button" class="mt-carnet-balance-inline${d.isDiscovery?' is-discovery':''}" onclick="window.mtOpenTeeBalance&&window.mtOpenTeeBalance()" aria-label="Comprendre ma journée"><div class="mt-tee-balance-rings">${ring('Vitalité',d.vitality)}${ring('Équilibre intérieur',d.innerBalance)}${ring('Régularité',d.consistency)}</div><div class="mt-carnet-balance-bottom"><div class="mt-tee-readiness-inline is-${esc(r.tone||'neutral')}"><span></span><b>${esc(r.label||'À découvrir')}</b></div><strong>Comprendre ma journée →</strong></div></button>`;}
  function inlineLoadingHTML(){
    const loadingRing=name=>`<div class="mt-tee-balance-ring mt-tee-balance-ring--loading"><div class="mt-tee-balance-ring__dial"><span></span></div><b>${esc(name)}</b><small></small></div>`;
    return `<div class="mt-carnet-balance-inline mt-carnet-balance-inline--loading"><div class="mt-tee-balance-rings">${loadingRing('Vitalité')}${loadingRing('Équilibre intérieur')}${loadingRing('Régularité')}</div><div class="mt-carnet-balance-bottom"><div class="mt-tee-balance-loading-pill"></div><strong>Comprendre ma journée →</strong></div></div>`;
  }
  function mountHTML(d){return `<div data-mt-tee-balance>${cardHTML(d)}</div>`;}
  function mountInlineHTML(d){return `<div data-mt-tee-balance-inline>${inlineHTML(d)}</div>`;}
  function mountInlineLoadingHTML(){return `<div data-mt-tee-balance-inline aria-busy="true" aria-label="Préparation de ton équilibre">${inlineLoadingHTML()}</div>`;}
  function renderPrioritySlots(d){document.querySelectorAll('[data-mt-priority-slot]').forEach(el=>{el.innerHTML=priorityInsightHTML(d);});}
  function render(d){document.querySelectorAll('[data-mt-tee-balance]').forEach(el=>{el.innerHTML=cardHTML(d);});document.querySelectorAll('[data-mt-tee-balance-inline]').forEach(el=>{el.innerHTML=inlineHTML(d);el.setAttribute('aria-busy','false');el.removeAttribute('aria-label');});renderPrioritySlots(d);window.__MT_TEE_BALANCE_RESULT__=d;if(d?.dailySummary)window.mtTeeDailySummary=d.dailySummary;}
  function initialHTML(ctx){
    const uid=currentUid(ctx),cached=readCache(uid);
    // L'ouverture peint immédiatement le dernier résumé compact. Les données
    // du jour sont rafraîchies ensuite, sans précharger un historique.
    const d=cached?.data||build(ctx,null,null,[]);
    window.__MT_TEE_BALANCE_RESULT__=d;if(d?.dailySummary)window.mtTeeDailySummary=d.dailySummary;
    return mountHTML(d);
  }
  async function refresh(opts={}){
    let ctx=opts.context||window.__MT_TEE_BALANCE_CONTEXT__||{};
    const source=opts.source||'';
    // Les événements issus d'Aujourd'hui peuvent fournir leur nouvel état
    // directement : Mon Équilibre se met alors à jour sans relire Supabase.
    if(opts.todayState){
      ctx={...ctx,todayState:opts.todayState};
      window.__MT_TEE_BALANCE_CONTEXT__=ctx;
    }else if(['journal','checklist','tracker','photo','recipe','protocol','routine','ritual','hydration','sleep'].includes(source)&&window.mtBuildTodayState){
      // Les anciens points d'entrée ne transmettent pas encore toujours leur
      // état. Une seule reconstruction ciblée garantit alors la cohérence.
      const todayState=await window.mtBuildTodayState();
      ctx={...ctx,todayState};
      window.__MT_TEE_BALANCE_CONTEXT__=ctx;
    }
    if(source==='community_journey'&&window.mtCommunityJourneyGetProfileSummary){
      const journeySummary=window.mtCommunityJourneyGetCachedProfileSummary?.()||await window.mtCommunityJourneyGetProfileSummary();
      ctx={...ctx,journeySummary};
      window.__MT_TEE_BALANCE_CONTEXT__=ctx;
      window.__MT_JOURNEY_PROFILE_SUMMARY__=journeySummary||null;
    }
    const user=currentUser(ctx),uid=currentUid(ctx);
    const cached=readCache(uid);
    if(cached?.data&&!opts.force&&!opts.silent)render(cached.data);
    // Un événement ne doit invalider que sa propre famille de données. Cela
    // évite trois lectures (journal + repas + suivis) pour une simple gorgée.
    const forceAll=!!opts.force&&(!source||source==='carnet'||source==='profile');
    const forceJournal=forceAll||source==='journal';
    const needsJournal=forceJournal||!cached||Date.now()-Number(cached.ts||0)>300000;
    const [journal,food,trackers,beverage]=await Promise.all([
      needsJournal?journalToday(user,{force:forceJournal}):Promise.resolve(cached?.journal||journalMemory.data||null),
      foodToday(user,{force:forceAll||source==='food'}),
      trackersToday(user,{force:forceAll||source==='custom_trackers'}),
      beveragesToday(user,{force:forceAll||source==='beverage'})
    ]);
    const d=build(ctx,journal,food,trackers,beverage);writeCache(uid,d,journal,food,d.dailySummary,beverage);
    // Même en mode silencieux (chargement initial du Carnet), le résultat courant
    // doit être publié immédiatement. Sinon le bouton « Comprendre ma journée »
    // affiche bien les jauges mais n'a encore aucune lecture à ouvrir.
    window.__MT_TEE_BALANCE_RESULT__=d;
    if(d?.dailySummary)window.mtTeeDailySummary=d.dailySummary;
    // Écriture minuscule et dédupliquée uniquement si les jauges changent.
    // Aucune lecture d'historique supplémentaire n'est déclenchée ici.
    persistBalanceSnapshot(user,d);
    if(!opts.silent)render(d);return d;
  }

  function close(){const o=document.getElementById('mtTeeBalanceDrawer');if(o){o.classList.remove('open');setTimeout(()=>o.remove(),220);}document.body.classList.remove('mt-tee-balance-open');}
  function openJournal(){close();window.mtOpenParcoursSheet&&window.mtOpenParcoursSheet('journal');}
  function dateRows(activity,journals){
    const journalMap=new Map((journals||[]).map(r=>[r.entry_date,r]));
    return (activity||[]).map(a=>({date:a.activity_date,activity:a,journal:journalMap.get(a.activity_date)||null}));
  }
  function avg(values){const a=values.filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}
  function periodStats(rows,from,to){
    const selected=rows.filter(r=>r.date>=from&&r.date<=to),hydrationDaysReached=selected.filter(r=>Number(r.activity?.hydration_liters||0)>=2).length;
    const sleepAverage=avg(selected.map(r=>Number(r.activity?.sleep_hours||0)).filter(v=>v>0));
    const journalDays=selected.filter(r=>r.journal||r.activity?.has_journal).length;
    const routineDays=selected.filter(r=>r.activity?.has_routine||r.activity?.today_checks?.routine).length;
    const protocolDays=selected.filter(r=>r.activity?.today_checks?.protocol).length;
    let missionDone=0,missionTotal=0;
    selected.forEach(r=>{const c=r.activity?.today_checks||{};Object.keys(c).filter(k=>!['hydration','routine','protocol','journal'].includes(k)).forEach(k=>{missionTotal++;if(c[k])missionDone++;});});
    const missionRate=missionTotal?Math.round(missionDone/missionTotal*100):null;
    return {days:selected.length,hydrationDaysReached,sleepAverage:sleepAverage==null?null:Math.round(sleepAverage*10)/10,journalDays,routineDays,protocolDays,missionRate};
  }
  function trend(label,current,previous,unit=''){
    if(current==null||previous==null)return null;
    const delta=Math.round((current-previous)*10)/10;
    if(Math.abs(delta)<0.2)return {label,value:'Stable',tone:'stable'};
    return {label,value:`${delta>0?'+':''}${delta}${unit}`,tone:delta>0?'up':'down'};
  }
  function simplifiedDailyScore(row){
    const a=row.activity||{},j=row.journal||{},sleep=Number(a.sleep_hours||0)||null,hydration=Number(a.hydration_liters||0);
    const vitality=weighted([{value:sleep==null?null:clamp((sleep/7)*100),weight:40},{value:normalize(j.tracker_energie),weight:35},{value:j.tracker_stress==null?null:100-normalize(j.tracker_stress),weight:25}]);
    const inner=weighted([{value:normalize(j.tracker_digestion),weight:30},{value:normalize(j.tracker_humeur),weight:30},{value:j.tracker_stress==null?null:100-normalize(j.tracker_stress),weight:40}]);
    const checks=a.today_checks||{},reg=weighted([{value:clamp((hydration/2)*100),weight:35},{value:(a.has_routine||checks.routine)?100:0,weight:25},{value:(a.has_journal||row.journal)?100:0,weight:20},{value:checks.protocol?100:0,weight:20}]);
    return {vitality,inner,regularity:reg};
  }
  function personalPatterns(rows){
    if(rows.length<10)return [];
    const groups={};
    rows.forEach(r=>{const d=new Date(r.date+'T12:00:00'),k=d.getDay();(groups[k]||(groups[k]=[])).push(r);});
    const names=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'],out=[];
    const hydration=Object.entries(groups).map(([k,v])=>({k:Number(k),n:v.length,rate:v.filter(r=>Number(r.activity?.hydration_liters||0)>=2).length/v.length})).filter(x=>x.n>=2);
    if(hydration.length>=3){const low=hydration.slice().sort((a,b)=>a.rate-b.rate)[0];if(low.rate<0.75)out.push(`Le ${names[low.k]}, ton objectif d’hydratation est moins souvent atteint.`);}
    const routine=Object.entries(groups).map(([k,v])=>({k:Number(k),n:v.length,rate:v.filter(r=>r.activity?.has_routine||r.activity?.today_checks?.routine).length/v.length})).filter(x=>x.n>=2);
    if(routine.length>=3){const high=routine.slice().sort((a,b)=>b.rate-a.rate)[0];if(high.rate>0.5)out.push(`Le ${names[high.k]}, ta routine est souvent plus régulière.`);}
    return out.slice(0,2);
  }
  async function buildWeekly(){
    const ctx=window.__MT_TEE_BALANCE_CONTEXT__||{},user=currentUser(ctx),uid=currentUid(ctx),cached=readJSON(weeklyCacheKey(uid));
    // Si l'empreinte hebdomadaire est déjà en cache, zéro lecture catalogue.
    if(cached&&Date.now()-Number(cached.ts||0)<600000)return cached.data;
    const catalogPromise=user?ensureFoodCatalog():Promise.resolve([]);
    const from28=isoOffset(-27),from7=isoOffset(-6),prevFrom=isoOffset(-13),prevTo=isoOffset(-7),to=DAY();let activity=[],journals=[];
    if(user){try{const sb=window.initSupabase&&window.initSupabase();if(sb){const [a,j]=await Promise.all([
      // L'empreinte hebdomadaire ne charge que les repères nécessaires à
      // ses tendances. Les snapshots des jauges ont leur propre lecture 6 jours.
      sb.from('daily_activity').select('activity_date,hydration_liters,sleep_hours,has_journal,has_routine,today_checks,tee_balance_snapshot').eq('user_id',user.id).gte('activity_date',from28).lte('activity_date',to),
      sb.from('journal_entries').select('entry_date,tracker_stress,tracker_energie,tracker_digestion,tracker_sommeil,tracker_humeur').eq('user_id',user.id).gte('entry_date',from28).lte('entry_date',to)
    ]);activity=a.data||[];journals=j.data||[];}}catch(e){}}
    await catalogPromise;
    const rows=dateRows(activity,journals),current=periodStats(rows,from7,to),previous=periodStats(rows,prevFrom,prevTo);
    const hasData=rows.some(r=>Number(r.activity?.hydration_liters||0)>0||Number(r.activity?.sleep_hours||0)>0||r.activity?.has_journal||r.activity?.has_routine||r.journal||Object.values(r.activity?.today_checks||{}).some(Boolean));
    const constancyParts=[current.hydrationDaysReached/7*100,current.routineDays/7*100,current.journalDays/7*100,current.missionRate].filter(Number.isFinite);
    const constancy=constancyParts.length?Math.round(avg(constancyParts)):null;
    const historicalRows=rows.filter(r=>r.date>=from7&&r.date<to);
    // Comparaison strictement « même jauge contre même jauge ». On utilise
    // uniquement les snapshots de la version courante enregistrés par ce moteur, jamais une
    // reconstitution simplifiée d'anciens jours avec une autre formule.
    const scores=historicalRows.map(row=>{
      const snap=row?.activity?.tee_balance_snapshot;
      if(!snap||typeof snap!=='object'||String(snap.version||'')!==String(VERSION))return {vitality:null,inner:null,regularity:null};
      return {
        vitality:Number.isFinite(snap.vitality)?Number(snap.vitality):null,
        inner:Number.isFinite(snap.inner)?Number(snap.inner):null,
        regularity:Number.isFinite(snap.regularity)?Number(snap.regularity):null
      };
    });
    const scoreAverages={vitality:avg(scores.map(x=>x.vitality)),inner:avg(scores.map(x=>x.inner)),regularity:avg(scores.map(x=>x.regularity))};
    const today=window.__MT_TEE_BALANCE_RESULT__||{},comparisons=[];
    [['Vitalité',today.vitality?.value,scoreAverages.vitality],['Équilibre intérieur',today.innerBalance?.value,scoreAverages.inner],['Régularité',today.consistency?.value,scoreAverages.regularity]].forEach(([label,value,average])=>{
      if(Number.isFinite(value)&&Number.isFinite(average)){const delta=Math.round(value-average);comparisons.push({label,delta,text:Math.abs(delta)<5?'proche de ta moyenne des jours précédents':delta>0?'au-dessus de ta moyenne des jours précédents':'en dessous de ta moyenne des jours précédents'});}
    });
    const trends=[
      trend('Hydratation',current.hydrationDaysReached,previous.hydrationDaysReached,' j'),
      trend('Sommeil',current.sleepAverage,previous.sleepAverage,' h'),
      trend('Routine',current.routineDays,previous.routineDays,' j'),
      trend('Journal',current.journalDays,previous.journalDays,' j')
    ].filter(Boolean);
    const victories=[];
    if(current.hydrationDaysReached>=5)victories.push('Objectif d’hydratation atteint au moins 5 jours cette semaine.');
    if(current.routineDays>=5)victories.push('Routine réalisée au moins 5 jours cette semaine.');
    if(current.journalDays>=4)victories.push('Tu as pris le temps d’écrire au moins 4 jours.');
    if(current.missionRate!=null&&current.missionRate>=80)victories.push('Au moins 80 % de tes missions ont été réalisées.');
    if(constancy!=null&&constancy>=75)victories.push('Ta constance hebdomadaire est devenue un repère solide.');
    let strength='Tu as commencé à créer des repères réguliers.';
    if(current.hydrationDaysReached>=5)strength='Ton hydratation est devenue un repère solide.';else if(current.routineDays>=4)strength='Ta routine s’installe avec régularité.';else if(current.journalDays>=4)strength='Tu as pris le temps de t’écouter plusieurs jours.';
    let attention='Continue à observer tes journées sans chercher la perfection.';
    if(current.sleepAverage!=null&&current.sleepAverage<7)attention='Ton sommeil semble être le premier levier à soutenir.';else if(current.hydrationDaysReached<3)attention='Ton hydratation peut devenir un repère plus constant.';else if(current.journalDays<2)attention='Quelques mots dans ton journal peuvent affiner ta lecture.';
    const nextGoal=current.sleepAverage!=null&&current.sleepAverage<7?'Viser un rythme de sommeil plus régulier cette semaine.':current.hydrationDaysReached<5?'Atteindre ton objectif d’hydratation un jour de plus.':'Conserver les repères qui fonctionnent déjà pour toi.';
    const month=periodStats(rows,from28,to);
    const monthSnapshots=rows.map(row=>{
      const snap=row?.activity?.tee_balance_snapshot;
      if(!snap||typeof snap!=='object'||String(snap.version||'')!==String(VERSION))return null;
      return {date:row.date,vitality:Number.isFinite(snap.vitality)?Number(snap.vitality):null,inner:Number.isFinite(snap.inner)?Number(snap.inner):null,regularity:Number.isFinite(snap.regularity)?Number(snap.regularity):null,signals:snap.signals&&typeof snap.signals==='object'?snap.signals:{}};
    }).filter(Boolean);
    const live=window.__MT_TEE_BALANCE_RESULT__,liveDaily=live?.dailySummary;
    if(liveDaily&&!monthSnapshots.some(x=>x.date===to))monthSnapshots.push({date:to,vitality:Number.isFinite(live?.vitality?.value)?Number(live.vitality.value):null,inner:Number.isFinite(live?.innerBalance?.value)?Number(live.innerBalance.value):null,regularity:Number.isFinite(live?.consistency?.value)?Number(live.consistency.value):null,signals:{sleep_minutes:liveDaily.sleep_minutes,hydration_ml:liveDaily.hydration_ml,nutrition_calculated_meals:liveDaily.nutrition_calculated_meals,nutrition_protein_g:liveDaily.nutrition_protein_g,nutrition_fiber_g:liveDaily.nutrition_fiber_g,sport_duration_minutes:liveDaily.sport_duration_minutes,sugar_craving:liveDaily.sugar_craving,digestion:liveDaily.digestion,energy:liveDaily.energy,food_context:Array.isArray(liveDaily.food_context)?liveDaily.food_context:[]}});
    const data={range:{from:from7,to},monthRange:{from:from28,to},hasData,...current,constancy,comparisons,trends,victories,patterns:personalPatterns(rows),strength,attention,nextGoal,month,monthSnapshots};
    writeJSON(weeklyCacheKey(uid),{ts:Date.now(),data});return data;
  }

  async function buildLightHistory(){
    const ctx=window.__MT_TEE_BALANCE_CONTEXT__||{},user=currentUser(ctx),uid=currentUid(ctx),cached=readJSON(historyCacheKey(uid));
    if(cached&&Date.now()-Number(cached.ts||0)<600000)return Array.isArray(cached.days)?cached.days:[];
    if(!user?.id)return [];
    const from=isoOffset(-6),to=isoOffset(-1);let rows=[];
    try{
      const sb=window.initSupabase&&window.initSupabase();
      if(sb){
        const {data,error}=await sb.from('daily_activity')
          .select('activity_date,tee_balance_snapshot')
          .eq('user_id',user.id)
          .gte('activity_date',from)
          .lte('activity_date',to)
          .order('activity_date',{ascending:true});
        if(error)throw error;
        rows=data||[];
      }
    }catch(e){console.warn('balance history load skipped',e);}
    const days=rows.map(row=>{
      const snap=row?.tee_balance_snapshot;
      if(!snap||typeof snap!=='object'||![snap.vitality,snap.inner,snap.regularity].some(Number.isFinite))return null;
      return {
        date:row.activity_date,
        vitality:Number.isFinite(snap.vitality)?Number(snap.vitality):null,
        inner:Number.isFinite(snap.inner)?Number(snap.inner):null,
        regularity:Number.isFinite(snap.regularity)?Number(snap.regularity):null,
        labels:{vitality:snap.vitality_label||'',inner:snap.inner_label||'',regularity:snap.regularity_label||''},
        readiness:snap.readiness||null,
        source:'saved'
      };
    }).filter(Boolean);
    writeJSON(historyCacheKey(uid),{ts:Date.now(),days});
    return days;
  }

  function historyDateLabel(iso){
    try{return new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${iso}T12:00:00`));}catch(e){return iso;}
  }
  function historyRing(name,value,labelText){
    const obj={value:Number.isFinite(value)?value:null,label:labelText||(Number.isFinite(value)?label(name==='Vitalité'?'vitality':name==='Équilibre intérieur'?'inner':'regularity',value):'À découvrir')};
    return ring(name,obj);
  }
  let historyState={days:[],index:-1};
  function renderHistoryDay(){
    const box=document.querySelector('[data-mt-balance-history]');if(!box)return;
    const days=historyState.days||[],i=historyState.index,d=days[i];
    if(!d){
      box.innerHTML='<div class="mt-tee-history-empty"><span>✶</span><h3>Ton historique commence ici.</h3><p>Les jauges des jours précédents apparaîtront au fil de tes prochaines journées renseignées.</p></div>';return;
    }
    const readiness=d.readiness?.label||'';
    box.innerHTML=`<div class="mt-tee-history-head"><div><small>MES JOURS PRÉCÉDENTS</small><h3>${esc(historyDateLabel(d.date))}</h3></div><div class="mt-tee-history-nav"><button type="button" onclick="window.mtNavigateTeeBalanceHistory&&window.mtNavigateTeeBalanceHistory(-1)" ${i<=0?'disabled':''} aria-label="Jour précédent">‹</button><button type="button" onclick="window.mtNavigateTeeBalanceHistory&&window.mtNavigateTeeBalanceHistory(1)" ${i>=days.length-1?'disabled':''} aria-label="Jour suivant">›</button></div></div><div class="mt-tee-history-card"><div class="mt-tee-balance-rings">${historyRing('Vitalité',d.vitality,d.labels?.vitality)}${historyRing('Équilibre intérieur',d.inner,d.labels?.inner)}${historyRing('Régularité',d.regularity,d.labels?.regularity)}</div>${readiness?`<div class="mt-tee-history-status"><span></span><b>${esc(readiness)}</b></div>`:''}<p class="mt-tee-history-note">Lecture enregistrée ce jour-là.</p></div>`;
  }
  async function showHistory(){
    const box=document.querySelector('[data-mt-balance-history]');if(!box)return;
    box.hidden=false;box.innerHTML='<div class="mt-tee-weekly-loading">Retrouver tes journées…</div>';
    // Chargement strictement à la demande : une seule lecture compacte des
    // 6 jours précédents, limitée à activity_date + tee_balance_snapshot.
    const days=await buildLightHistory();
    historyState.days=days;historyState.index=days.length-1;renderHistoryDay();
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function navigateHistory(delta){
    if(!historyState.days.length)return;
    historyState.index=Math.max(0,Math.min(historyState.days.length-1,historyState.index+Number(delta||0)));renderHistoryDay();
  }
  function trendHTML(t){return `<div class="mt-tee-trend is-${esc(t.tone)}"><span>${t.tone==='up'?'↗':t.tone==='down'?'↘':'→'}</span><div><b>${esc(t.label)}</b><small>${esc(t.value)}</small></div></div>`;}
  function sparkline(points,key,labelText,color){
    const values=(points||[]).filter(p=>Number.isFinite(p?.[key]));
    if(values.length<3)return '';
    const width=280,height=72,pad=7,step=(width-pad*2)/Math.max(1,values.length-1);
    const coords=values.map((p,i)=>`${Math.round((pad+i*step)*10)/10},${Math.round((height-pad-(clamp(p[key])/100)*(height-pad*2))*10)/10}`).join(' ');
    return `<div class="mt-tee-month-line"><div><b>${esc(labelText)}</b><span>${Math.round(values[values.length-1][key])} %</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Tendance ${esc(labelText.toLowerCase())} sur 28 jours"><polyline points="${coords}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  }
  function rotatingChoice(key,items){
    const seed=[...`${currentUid(window.__MT_TEE_BALANCE_CONTEXT__||{})}|${DAY()}|${key}`].reduce((n,c)=>((n*31)+c.charCodeAt(0))>>>0,7);
    return items[seed%items.length];
  }
  function itemCategories(item){
    const explicit=Array.isArray(item?.categories)?item.categories.map(x=>String(x).toLowerCase()):[],name=String(item?.canonical_name||item?.name||'').toLowerCase(),out=new Set(explicit);
    if(Number(item?.protein)>=12||/poulet|poisson|thon|saumon|oeuf|œuf|viande|boeuf|bœuf|tofu|tempeh|crevette|lentille|haricot|pois chiche|ni[eé]b|cassoulet/.test(name))out.add('protein');
    if(Number(item?.fiber)>=3||/légume|salade|crudité|fruit|gombo|chou|carotte|courgette|aubergine|haricot|lentille|pois chiche|cassoulet/.test(name))out.add('fiber');
    if(/riz|pâte|nouille|pain|semoule|couscous|manioc|plantain|atti[eé]k|pomme de terre|foufou|foutou/.test(name))out.add('starch');
    if(/muesli|granola|porridge|avoine/.test(name))out.add('sweet_bowl');
    return [...out];
  }
  function profileFamily(item){
    const p=item?.adapter_profile||{},given=String(p.adapter_family||'');if(given)return given;
    const n=String(item?.canonical_name||item?.name||'').toLowerCase();
    if(/muesli|granola|porridge|avoine/.test(n))return 'sweet_bowl';
    if(/nem|samoussa|beignet|tempura|fricass/.test(n))return 'fried_snack';
    if(/nouille|ramen|udon|soba|chow mein|yakisoba/.test(n))return 'noodle_dish';
    if(/soupe|soup|harira|chorba/.test(n))return 'soup';
    if(/burger|hamburger/.test(n))return 'burger';
    if(/couscous|cassoulet|thi[eé]b|jollof|waakye|poulet dg/.test(n))return 'complete_composite';
    const c=itemCategories(item);if(c.includes('protein')&&!c.includes('starch'))return 'protein_main';if(c.includes('starch')&&!c.includes('protein'))return 'starch_side';return 'general';
  }
  function contextText(items){return (items||[]).map(i=>[i?.name,i?.canonical_name,...(Array.isArray(i?.typical_components)?i.typical_components:[]),...(Array.isArray(i?.optional_components)?i.optional_components:[])].join(' ')).join(' ').toLowerCase();}
  function optionalProtein(item){
    const options=Array.isArray(item?.optional_components)?item.optional_components.map(String):[],matches=options.filter(x=>/poisson|poulet|crevette|oeuf|œuf|viande|tofu|lentille|haricot|pois|ni[eé]b/i.test(x));
    if(!matches.length)return null;const picked=rotatingChoice(`optional|${item?.canonical_name||item?.name}`,matches),n=picked.toLowerCase();
    if(/poisson/.test(n))return {name:'poisson',title:`Vérifie la protéine de ${item.canonical_name||item.name}`,action:`Si ton ${item.canonical_name||item.name} n’en contient pas déjà, ajoute environ 120 g de poisson cuit.`};
    if(/crevette/.test(n))return {name:'crevettes',title:`Vérifie la protéine de ${item.canonical_name||item.name}`,action:`Si ton ${item.canonical_name||item.name} n’en contient pas déjà, ajoute environ 120 g de crevettes cuites.`};
    if(/poulet|viande/.test(n))return {name:/poulet/.test(n)?'poulet':'viande',title:`Vérifie la protéine de ${item.canonical_name||item.name}`,action:`Si ton plat n’en contient pas déjà, ajoute environ 120 g ${/poulet/.test(n)?'de poulet cuit':'de viande maigre cuite'}.`};
    if(/oeuf|œuf/.test(n))return {name:'œufs',title:`Vérifie la protéine de ${item.canonical_name||item.name}`,action:`Si ton ${item.canonical_name||item.name} n’en contient pas déjà, ajoute deux œufs cuits.`};
    return {name:picked,title:`Vérifie la composition de ${item.canonical_name||item.name}`,action:`Si ton plat n’en contient pas déjà, ajoute une portion de ${picked}.`};
  }
  function contextualFoodChoice(key,foodContext){
    const items=Array.isArray(foodContext)?foodContext:[],familiar=contextText(items),confirmed=items.map(i=>String(i?.name||'')).join(' ').toLowerCase(),has=x=>confirmed.includes(x),profiles=items.filter(i=>i?.canonical_name||i?.adapter_profile),target=profiles.find(i=>{
      const c=itemCategories(i),p=i.adapter_profile||{};return key==='fiber'?(!c.includes('vegetable')&&!p.already_contains_vegetable):(!c.includes('protein')||p.protein_is_variable);
    })||profiles[0]||items[0]||null,family=profileFamily(target),country=String(target?.country||'').toLowerCase(),cats=itemCategories(target),p=target?.adapter_profile||{};
    if((key==='protein'||key==='protein_fiber')&&target&&p.protein_is_variable){const optional=optionalProtein(target);if(optional&&!has(optional.name))return optional;}
    if(key==='protein'||key==='protein_fiber'){
      if(family==='sweet_bowl')return !has('skyr')?{name:'skyr nature',title:'Ajoute un skyr nature à ton bol',action:'Ajoute un skyr nature à ton prochain muesli, porridge ou bol de fruits.'}:{name:'graines de chanvre',title:'Ajoute des graines de chanvre décortiquées',action:'Ajoute deux cuillères à soupe de graines de chanvre décortiquées à ton prochain bol.'};
      if(family==='noodle_dish'||/japon|chine|thaï/.test(country))return !has('tofu')?{name:'tofu',title:'Ajoute du tofu à ton prochain plat',action:'Ajoute environ 120 g de tofu poêlé à ton prochain plat de riz ou de nouilles.'}:{name:'edamame',title:'Ajoute des edamame à ton prochain plat',action:'Ajoute environ 120 g d’edamame cuits et décortiqués à ton prochain bowl.'};
      if(/cameroun|congo|ghana|nigeria|ivoire|s[eé]n[eé]gal|afrique/.test(country)||/plantain|manioc|atti[eé]k|foufou|foutou|gombo/.test(familiar))return !has('niébé')?{name:'niébé',title:'Ajoute du niébé à un prochain repas',action:'Ajoute environ 150 g de niébé cuit à un prochain repas à base de céréale, manioc ou plantain.'}:{name:'poisson',title:'Ajoute du poisson grillé',action:'Ajoute environ 120 g de poisson grillé à un prochain repas qui ne contient pas déjà de protéine.'};
      if(/maroc|alg[eé]rie|tunisie|maghreb/.test(country)||/semoule|couscous/.test(familiar))return !has('pois chiche')?{name:'pois chiches',title:'Ajoute des pois chiches à un prochain plat',action:'Ajoute environ 150 g de pois chiches cuits à un prochain plat de semoule ou de légumes.'}:{name:'lentilles',title:'Ajoute des lentilles à une prochaine soupe',action:'Ajoute environ 150 g de lentilles cuites à une prochaine soupe ou sauce.'};
      if(family==='soup')return {name:'lentilles corail',title:'Enrichis une prochaine soupe avec des lentilles corail',action:'Ajoute environ 120 g de lentilles corail cuites à une prochaine soupe.'};
      if(family==='fried_snack')return {name:'edamame',title:'Complète plutôt l’accompagnement',action:'Accompagne ta prochaine portion de nems, beignets ou friture d’environ 120 g d’edamame cuits et d’une salade croquante.'};
      if(family==='complete_composite'&&cats.includes('protein'))return {name:'yaourt nature',title:'Structure plutôt une prochaine collation',action:'Ajoute un yaourt nature ou soja nature à une prochaine collation, au lieu de surcharger ton plat composé.'};
      return rotatingChoice(`${key}|protein-default|${target?.canonical_name||target?.name||''}`,[
        {name:'lentilles vertes',title:'Ajoute des lentilles vertes à ton prochain repas',action:'Ajoute environ 150 g de lentilles vertes cuites à ton prochain repas principal.'},
        {name:'pois chiches',title:'Ajoute des pois chiches à ton prochain repas',action:'Ajoute environ 150 g de pois chiches cuits à ton prochain déjeuner ou dîner.'},
        {name:'haricots blancs',title:'Ajoute des haricots blancs à ton prochain repas',action:'Ajoute environ 150 g de haricots blancs cuits à ton prochain plat chaud ou à une salade.'},
        {name:'pois cassés',title:'Ajoute des pois cassés à une prochaine soupe',action:'Ajoute environ 150 g de pois cassés cuits à une prochaine soupe ou purée.'},
        {name:'haricots rouges',title:'Ajoute des haricots rouges à ton prochain repas',action:'Ajoute environ 150 g de haricots rouges cuits à ton prochain bowl, chili ou plat de riz.'},
        {name:'fèves',title:'Ajoute des fèves à ton prochain repas',action:'Ajoute environ 150 g de fèves cuites à une salade, une soupe ou un plat de céréales.'},
        {name:'lentilles corail',title:'Ajoute des lentilles corail à une prochaine sauce',action:'Ajoute environ 150 g de lentilles corail cuites à une prochaine sauce, soupe ou purée.'},
        {name:'haricots noirs',title:'Ajoute des haricots noirs à ton prochain repas',action:'Ajoute environ 150 g de haricots noirs cuits à ton prochain bowl ou plat de riz.'}
      ]);
    }
    if(family==='sweet_bowl')return !has('chia')?{name:'graines de chia',title:'Ajoute des graines de chia à ton prochain bol',action:'Ajoute une cuillère à soupe de graines de chia hydratées à ton prochain muesli, yaourt ou porridge.'}:{name:'framboises',title:'Ajoute des framboises à ton prochain bol',action:'Ajoute une poignée de framboises fraîches ou surgelées à ton prochain bol.'};
    if(family==='noodle_dish'||/japon|chine|thaï/.test(country))return {name:'pak-choï',title:'Ajoute du pak-choï à ton prochain plat',action:'Ajoute un pak-choï émincé et poêlé à ton prochain plat de riz ou de nouilles.'};
    if(family==='fried_snack'||/nem|samoussa|beignet/.test(familiar))return {name:'salade chou-carotte-concombre',title:'Ajoute une salade croquante à côté',action:'Prépare une petite salade de chou, carotte et concombre pour accompagner ton prochain repas frit.'};
    if(family==='burger')return {name:'chou rouge',title:'Ajoute du chou rouge croquant',action:'Ajoute une poignée de chou rouge émincé dans ton burger ou en accompagnement.'};
    if(cats.includes('vegetable')||p.already_contains_vegetable||family==='complete_composite')return {name:'kiwi',title:'Ajoute un kiwi à un autre moment',action:'Garde ton plat tel qu’il est et ajoute un kiwi entier à une collation ou à la fin d’un autre repas.'};
    if(/cameroun|congo|ghana|nigeria|ivoire|s[eé]n[eé]gal|afrique/.test(country)||/plantain|manioc|atti[eé]k|foufou|foutou/.test(familiar))return {name:'gombo',title:'Ajoute du gombo à une prochaine sauce',action:'Ajoute une portion de gombo cuit à une prochaine sauce ou assiette qui contient peu de végétaux.'};
    if(/maroc|alg[eé]rie|tunisie|maghreb/.test(country)||/semoule|couscous/.test(familiar))return {name:'carottes rôties',title:'Ajoute des carottes rôties au cumin',action:'Ajoute une portion de carottes rôties au cumin à un prochain plat.'};
    return rotatingChoice(`fiber|default|${target?.canonical_name||target?.name||''}`,[
      {name:'poire',title:'Ajoute une poire aujourd’hui',action:'Ajoute une poire entière, avec la peau bien lavée, à une collation ou à la fin d’un repas.'},
      {name:'kiwi',title:'Ajoute un kiwi aujourd’hui',action:'Ajoute un kiwi entier à ton petit-déjeuner ou à une collation.'},
      {name:'flocons d’avoine',title:'Ajoute des flocons d’avoine aujourd’hui',action:'Ajoute 40 g de flocons d’avoine à un yaourt, une boisson végétale ou un porridge.'},
      {name:'framboises',title:'Ajoute une poignée de framboises',action:'Ajoute une poignée de framboises fraîches ou surgelées à une collation ou à ton prochain bol.'},
      {name:'artichaut',title:'Ajoute des cœurs d’artichaut',action:'Ajoute une portion de cœurs d’artichaut à une salade, une omelette ou un plat de céréales.'},
      {name:'petits pois',title:'Ajoute des petits pois à ton prochain repas',action:'Ajoute environ 120 g de petits pois cuits à ton prochain repas principal.'},
      {name:'pain de seigle complet',title:'Choisis du pain de seigle complet',action:'Remplace une portion de pain blanc par une tranche de pain de seigle complet lors d’un prochain repas.'},
      {name:'graines de lin moulues',title:'Ajoute des graines de lin moulues',action:'Ajoute une cuillère à soupe de graines de lin moulues à un yaourt, un porridge ou une compote.'},
      {name:'mûres',title:'Ajoute une poignée de mûres',action:'Ajoute une poignée de mûres fraîches ou surgelées à une collation.'},
      {name:'brocoli',title:'Ajoute du brocoli rôti',action:'Ajoute une portion de brocoli rôti ou vapeur à ton prochain repas principal.'}
    ]);
  }
  function contextualAlternative(key,foodContext){
    const items=Array.isArray(foodContext)?foodContext:[],seen=contextText(items),countries=items.map(i=>String(i?.country||'').toLowerCase()).join(' '),families=items.map(profileFamily),isProtein=key==='protein'||key==='protein_fiber';
    let choices;
    if(/cameroun|congo|ghana|nigeria|ivoire|s[eé]n[eé]gal|afrique/.test(countries)||/ndol|yassa|atti[eé]k|gombo|plantain|manioc|foufou|foutou/.test(seen)){
      choices=isProtein?[
        {name:'koki de haricots',text:'Pour varier, prépare un koki de haricots accompagné de crudités ou de légumes cuits.'},
        {name:'niébé',text:'Pour varier, compose un prochain repas avec du niébé, une petite portion d’attiéké et des crudités.'},
        {name:'moi-moi',text:'Pour varier, choisis un moi-moi accompagné de légumes ou d’une salade croquante.'}
      ]:[
        {name:'thiéré',text:'Pour varier, prépare un thiéré généreux en légumes et complète-le avec du niébé.'},
        {name:'gombo',text:'Pour varier, choisis une sauce gombo riche en légumes avec une portion mesurée de féculent.'},
        {name:'haricots',text:'Pour varier, compose un bol de haricots, tomates, concombre et herbes fraîches.'}
      ];
    }else if(/maroc|alg[eé]rie|tunisie|maghreb/.test(countries)||/couscous|semoule|tajine|chorba|harira/.test(seen)){
      choices=isProtein?[
        {name:'bissara',text:'Pour varier, choisis une bissara de pois cassés avec des crudités et un morceau de pain complet.'},
        {name:'chorba aux lentilles',text:'Pour varier, prépare une chorba aux lentilles avec des légumes.'},
        {name:'couscous aux pois chiches',text:'Pour varier, prépare un couscous aux légumes et pois chiches, sans multiplier les autres féculents.'}
      ]:[
        {name:'tajine de légumes',text:'Pour varier, choisis un tajine de légumes avec des pois chiches.'},
        {name:'salade méchouia',text:'Pour varier, accompagne ton prochain repas d’une salade méchouia.'}
      ];
    }else if(/japon|chine|thaï/.test(countries)||families.includes('noodle_dish')||/ramen|nouille|riz saut[eé]|wonton|nem/.test(seen)){
      choices=isProtein?[
        {name:'tofu pak-choï',text:'Pour varier, prépare un bol de tofu poêlé, pak-choï et riz.'},
        {name:'edamame',text:'Pour varier, compose un bowl de riz, edamame, concombre et chou rouge.'}
      ]:[
        {name:'soba aux légumes',text:'Pour varier, prépare des soba avec pak-choï, carotte et champignons.'},
        {name:'rouleaux de printemps',text:'Pour varier, choisis des rouleaux de printemps riches en crudités plutôt qu’une nouvelle friture.'}
      ];
    }else if(families.includes('sweet_bowl')){
      choices=isProtein?[
        {name:'porridge au skyr',text:'Pour varier, prépare un porridge d’avoine avec du skyr nature et des fruits rouges.'},
        {name:'chia pudding',text:'Pour varier, prépare un chia pudding au yaourt nature avec une poignée de fruits.'}
      ]:[
        {name:'porridge poire-lin',text:'Pour varier, prépare un porridge avec une poire et une cuillère de graines de lin moulues.'}
      ];
    }else{
      choices=isProtein?[
        {name:'salade de lentilles',text:'Pour varier, prépare une salade de lentilles vertes, légumes rôtis et herbes fraîches.'},
        {name:'bowl pois chiches',text:'Pour varier, compose un bowl de pois chiches, céréale complète et légumes de saison.'}
      ]:[
        {name:'bol avoine-fruits',text:'Pour varier, prépare un bol d’avoine, poire et graines de lin moulues.'},
        {name:'assiette légumes-légumineuses',text:'Pour varier, compose une assiette de légumes rôtis et de légumineuses.'}
      ];
    }
    const unseen=choices.filter(x=>!seen.includes(x.name));return rotatingChoice(`alternative|${key}|${seen}`,unseen.length?unseen:choices).text;
  }
  function dynamicCatalogChoice(key,foodContext){
    const catalog=Array.isArray(window.__MT_TEE_FOOD_CATALOG__)?window.__MT_TEE_FOOD_CATALOG__:[];
    if(!catalog.length)return null;
    const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[^a-z0-9]+/g,' ').trim();
    const words=s=>norm(s).split(' ').filter(x=>x.length>2&&!['avec','sans','pour','dans','plat','repas','sauce','cuit','cuite'].includes(x));
    const recentText=norm(contextText(foodContext)),recentNames=new Set(foodContext.flatMap(x=>[x?.name,x?.canonical_name,x?.display_name]).filter(Boolean).map(norm));
    const recentCountries=new Set(foodContext.flatMap(x=>[x?.country,x?.culture]).filter(Boolean).flatMap(words));
    const preferenceWords=new Set(foodContext.flatMap(x=>[x?.name,x?.canonical_name,x?.display_name,...(Array.isArray(x?.typical_components)?x.typical_components:[]),...(Array.isArray(x?.optional_components)?x.optional_components:[])].flatMap(words)));
    const recentFamilies=new Set(foodContext.map(profileFamily));
    const scored=catalog.map(item=>{
      const name=norm(item.canonical_name||item.display_name),aliases=(item.aliases||[]).map(norm),cats=(item.categories||[]).map(norm),profile=item.adapter_profile||{},family=profileFamily(item),typical=(item.typical_components||[]).map(String),optional=(item.optional_components||[]).map(String);
      const isDish=cats.includes('composite dish')||family!=='general'||typical.length>=2;if(!isDish||!name)return null;
      if(recentNames.has(name)||aliases.some(a=>recentNames.has(a))||recentText.includes(` ${name} `)||recentText===name)return null;
      const macro=item.ciqual||profile,protein=Number(macro?.protein_100g),fiber=Number(macro?.fiber_100g),candidateWords=new Set([item.display_name,item.canonical_name,...typical,...optional].flatMap(words));
      let overlap=0;candidateWords.forEach(w=>{if(preferenceWords.has(w))overlap++;});
      const cultureWords=words(`${item.country||''} ${item.culture||''}`),cultureMatch=cultureWords.some(w=>recentCountries.has(w));
      let score=Math.min(24,overlap*4)+(cultureMatch?20:0)+(recentFamilies.has(family)?9:0)+(item.ciqual_code?5:0)+Math.max(0,8-Math.floor(Number(item.priority||100)/20));
      if(key==='protein'||key==='protein_fiber')score+=(Number.isFinite(protein)&&protein>=8)||cats.includes('protein')?22:-8;
      if(key==='fiber'||key==='protein_fiber')score+=(Number.isFinite(fiber)&&fiber>=2.5)||cats.includes('vegetable')?22:-8;
      if(key==='variety'){if(cats.includes('vegetable'))score+=8;if(cats.includes('protein'))score+=5;if(cats.includes('fried')||cats.includes('rich sauce'))score-=5;}
      if(profile.composite_complete)score+=5;if(profile.composition_variable&&typical.length<2)score-=12;
      return {item,score,typical,optional,family,cultureMatch,overlap,protein:Number.isFinite(protein)?protein:null,fiber:Number.isFinite(fiber)?fiber:null};
    }).filter(Boolean).sort((a,b)=>b.score-a.score||Number(a.item.priority||100)-Number(b.item.priority||100));
    if(!scored.length)return null;
    const best=scored[0].score,shortlist=scored.filter(x=>x.score>=best-4).slice(0,5),rotation=readJSON(`mt_tee_catalog_rotation_v1_${currentUid(window.__MT_TEE_BALANCE_CONTEXT__||{})}_${key}_${DAY()}`),base=shortlist.indexOf(rotatingChoice(`catalog|${key}|${recentText}`,shortlist)),picked=shortlist[(Math.max(0,base)+Math.max(0,Number(rotation?.index)||0))%shortlist.length],item=picked.item,display=item.display_name||item.canonical_name;
    const ingredients=[...picked.typical];
    if(ingredients.length<4)for(const x of picked.optional){if(ingredients.length>=4)break;if(!ingredients.some(y=>norm(y)===norm(x)))ingredients.push(`${x} (selon la version)`);}
    const reason=[];
    if(picked.cultureMatch)reason.push('son univers culinaire rejoint celui de plusieurs repas récents');
    if(picked.overlap)reason.push(`certains de ses composants prolongent tes préférences déjà observées`);
    if((key==='protein'||key==='protein_fiber')&&((picked.protein!=null&&picked.protein>=8)||(item.categories||[]).includes('protein')))reason.push('sa structure apporte un repère protéiné pertinent');
    if((key==='fiber'||key==='protein_fiber')&&((picked.fiber!=null&&picked.fiber>=2.5)||(item.categories||[]).includes('vegetable')))reason.push('sa composition renforce la place des végétaux ou des fibres');
    if(key==='variety')reason.push('il permet de varier sans sortir brutalement de tes habitudes');
    return {name:display,title:`Découvrir ${display}`,action:`Pour ton prochain repas, Tee te suggère ${display}${picked.typical.length?` autour de ${picked.typical.slice(0,3).join(', ')}`:''}.`,ingredients:ingredients.slice(0,5),reason:reason.join(' ; '),source:item.ciqual_code?'Dictionnaire Méthode Tee relié à CIQUAL':'Dictionnaire culturel Méthode Tee',catalogKey:key};
  }
  function recentPersonalPriority(w){
    const recent=(w.monthSnapshots||[]).filter(x=>x.date>=w.range.from&&x.date<=w.range.to),signals=recent.map(x=>x.signals||{});
    const foodContext=signals.flatMap(s=>Array.isArray(s.food_context)?s.food_context:[]).filter(x=>x&&typeof x==='object').slice(0,32),ingredients=[...new Set(foodContext.map(x=>String(x.canonical_name||x.name||'')).filter(Boolean))];
    const nutrition=signals.filter(s=>Number(s.nutrition_calculated_meals)>0&&Number.isFinite(Number(s.nutrition_protein_g))&&Number.isFinite(Number(s.nutrition_fiber_g)));
    const mealCount=nutrition.reduce((n,s)=>n+Number(s.nutrition_calculated_meals||0),0),protein=nutrition.reduce((n,s)=>n+Number(s.nutrition_protein_g||0),0),fiber=nutrition.reduce((n,s)=>n+Number(s.nutrition_fiber_g||0),0);
    const proteinPerMeal=mealCount?protein/mealCount:null,fiberPerMeal=mealCount?fiber/mealCount:null;
    if(nutrition.length>=3&&mealCount>=5&&proteinPerMeal<14&&fiberPerMeal<4){const food=contextualFoodChoice('protein_fiber',foodContext),alternative=contextualAlternative('protein_fiber',foodContext),catalog=dynamicCatalogChoice('protein_fiber',foodContext);return {key:'protein_fiber',title:catalog?.title||food.title,action:catalog?.action||`${food.action} ${alternative}`,why:`Sur ${mealCount} repas calculables via CIQUAL, les apports moyens en protéines et en fibres apparaissent tous les deux modestes. ${catalog?`Tee a retenu ce plat parce que ${catalog.reason}.`:`Cette proposition tient compte de ${ingredients.slice(0,3).join(', ')} et du profil culinaire des plats.`}`,evidence:`${Math.round(proteinPerMeal)} g de protéines et ${Math.round(fiberPerMeal*10)/10} g de fibres en moyenne par repas calculable${catalog?` · ${catalog.source}`:''}`,note:`La proposition exclut les plats récemment reconnus et peut être remplacée.`,preparationChoices:catalog?.ingredients?.length?[catalog.ingredients]:undefined,catalogKey:catalog?.catalogKey};}
    if(nutrition.length>=3&&mealCount>=5&&proteinPerMeal<14){const food=contextualFoodChoice('protein',foodContext),alternative=contextualAlternative('protein',foodContext),catalog=dynamicCatalogChoice('protein',foodContext);return {key:'protein',title:catalog?.title||food.title,action:catalog?.action||`${food.action} ${alternative}`,why:`Les ${mealCount} repas calculables via CIQUAL contiennent en moyenne peu de protéines. ${catalog?`Tee a retenu ce plat parce que ${catalog.reason}.`:`Le choix de ${food.name} a été rapproché de ${ingredients.slice(0,3).join(', ')} et des composants connus des plats.`}`,evidence:`${Math.round(proteinPerMeal)} g de protéines en moyenne par repas calculable${catalog?` · ${catalog.source}`:''}`,note:'La proposition exclut les plats récemment reconnus et peut être remplacée.',preparationChoices:catalog?.ingredients?.length?[catalog.ingredients]:undefined,catalogKey:catalog?.catalogKey};}
    if(nutrition.length>=3&&mealCount>=5&&fiberPerMeal<4){const food=contextualFoodChoice('fiber',foodContext),alternative=contextualAlternative('fiber',foodContext),catalog=dynamicCatalogChoice('fiber',foodContext);return {key:'fiber',title:catalog?.title||food.title,action:catalog?.action||`${food.action} ${alternative}`,why:`Dans les ${mealCount} repas calculables via CIQUAL, les fibres apparaissent peu présentes. ${catalog?`Tee a retenu ce plat parce que ${catalog.reason}.`:`Le choix de ${food.name} tient compte de ${ingredients.slice(0,3).join(', ')} et évite de répéter un composant déjà identifié.`}`,evidence:`${Math.round(fiberPerMeal*10)/10} g de fibres en moyenne par repas calculable${catalog?` · ${catalog.source}`:''}`,note:'La proposition exclut les plats récemment reconnus et peut être remplacée.',preparationChoices:catalog?.ingredients?.length?[catalog.ingredients]:undefined,catalogKey:catalog?.catalogKey};}
    if(nutrition.length>=3&&mealCount>=5&&foodContext.length){
      const familiar=contextText(foodContext),countries=foodContext.map(i=>String(i?.country||'').toLowerCase()).join(' '),families=foodContext.map(profileFamily),alternative=contextualAlternative('variety',foodContext),catalog=dynamicCatalogChoice('variety',foodContext);
      let choices;
      if(/cameroun|congo|ghana|nigeria|ivoire|s[eé]n[eé]gal|afrique/.test(countries)||/ndol|yassa|atti[eé]k|gombo|plantain|manioc|foufou|foutou|thi[eé]b/.test(familiar))choices=[['Gombo','tomates','oignon','niébé'],['Mil ou thiéré','courgette','carotte','niébé'],['Haricots','tomates','concombre','herbes fraîches']];
      else if(/maroc|alg[eé]rie|tunisie|maghreb/.test(countries)||/couscous|semoule|tajine|chorba|harira/.test(familiar))choices=[['Pois chiches','courgette','carotte','cumin'],['Poivron','tomate','oignon','herbes fraîches'],['Lentilles','tomate','carotte','coriandre']];
      else if(/japon|chine|thaï/.test(countries)||families.includes('noodle_dish')||/ramen|nouille|riz saut[eé]|wonton|nem|bo ?bun/.test(familiar))choices=[['Soba','pak-choï','carotte','champignons'],['Riz','edamame','concombre','chou rouge'],['Galettes de riz','carotte','concombre','herbes fraîches']];
      else if(families.includes('sweet_bowl'))choices=[['Flocons d’avoine','skyr nature','fruits rouges'],['Graines de chia','yaourt nature','poire'],['Flocons d’avoine','pomme','graines de lin moulues']];
      else choices=[['Lentilles vertes','légumes rôtis','herbes fraîches'],['Pois chiches','céréale complète','légumes de saison'],['Haricots blancs','tomates','concombre','persil']];
      return {key:'culinary_variety',title:catalog?.title||'Varier sans quitter tes habitudes',action:catalog?.action||alternative,why:`Tes ${mealCount} repas calculables ne font pas ressortir de manque prioritaire en protéines ou en fibres. ${catalog?`Tee a comparé le catalogue activé à ton historique et a retenu ce plat parce que ${catalog.reason}.`:`Tee utilise donc les plats et aliments déjà renseignés pour proposer une composition proche de tes goûts.`}`,evidence:`${mealCount} repas analysés · plats récents exclus${catalog?` · ${catalog.source}`:''}`,note:'La proposition varie selon ton historique et peut être remplacée si elle ne correspond pas à ce que tu as.',preparationChoices:catalog?.ingredients?.length?[catalog.ingredients]:choices,catalogKey:catalog?.catalogKey};
    }
    const hydration=signals.map(s=>Number(s.hydration_ml)).filter(v=>Number.isFinite(v)&&v>0),lowHydration=hydration.filter(v=>v<1500).length;
    if(hydration.length>=4&&lowHydration>=3){return {key:'hydration',title:'Prépare une bouteille de 750 ml',action:'Remplis une bouteille de 750 ml maintenant et prévois de la remplir une seconde fois dans la journée.',why:`Ton hydratation est restée sous 1,5 L lors de ${lowHydration} des ${hydration.length} journées renseignées récemment.`,evidence:`${lowHydration} journées sous 1,5 L`,note:'Adapte toujours cette quantité si un professionnel de santé t’a donné une consigne particulière.'};}
    const sleep=signals.map(s=>Number(s.sleep_minutes)).filter(v=>Number.isFinite(v)&&v>0),sleepAverage=avg(sleep);
    if(sleep.length>=3&&sleepAverage<390){return {key:'sleep',title:'Avance ton coucher de 20 minutes',action:'Ce soir, commence ta routine de coucher 20 minutes plus tôt que d’habitude.',why:`Tes ${sleep.length} dernières nuits renseignées durent en moyenne moins de 6 h 30. La proposition porte sur ton organisation, sans prétendre qu’un aliment peut corriger ton sommeil.`,evidence:`${Math.round(sleepAverage/6)/10} h de sommeil en moyenne`,note:'Une tendance renseignée n’est pas un diagnostic du sommeil.'};}
    const cravings=signals.map(s=>Number(s.sugar_craving)).filter(v=>Number.isFinite(v)),cravingAverage=avg(cravings);
    if(cravings.length>=3&&cravingAverage>=7){return {key:'sugar',title:'Prépare un bol d’avoine et de pomme',action:'Prévois 40 g de flocons d’avoine avec une pomme coupée et de la cannelle, sans sucre ajouté.',why:`Les envies de sucre ont été élevées sur plusieurs suivis récents. Cette proposition apporte une collation structurée sans déduire ta consommation réelle de sucre.`,evidence:`Envie de sucre moyenne : ${Math.round(cravingAverage*10)/10}/10`,note:'Adapte la portion à ta faim réelle.'};}
    const activity=signals.map(s=>Number(s.sport_duration_minutes)).filter(v=>Number.isFinite(v)&&v>=0),activityAverage=avg(activity);
    if(activity.length>=4&&activityAverage<20){return {key:'activity',title:'Planifie 20 minutes de marche',action:'Choisis aujourd’hui un créneau précis de 20 minutes pour marcher à un rythme confortable.',why:`Les ${activity.length} activités volontairement renseignées récemment durent en moyenne moins de 20 minutes.`,evidence:`${Math.round(activityAverage)} minutes en moyenne par activité renseignée`,note:'Adapte le rythme à tes capacités et à ton état du jour.'};}
    return null;
  }
  function preparationChoices(p){
    if(Array.isArray(p?.preparationChoices)&&p.preparationChoices.length)return p.preparationChoices;
    const byKey={
      protein_fiber:[['Lentilles vertes','carottes','persil','citron'],['Pois chiches','tomates','concombre','coriandre'],['Haricots rouges','poivron','maïs','citron vert']],
      protein:[['Œufs','épinards','pain complet'],['Skyr nature','flocons d’avoine','fruits rouges'],['Tofu','pak-choï','riz']],
      fiber:[['Poire','flocons d’avoine','graines de lin moulues'],['Pois chiches','courgette','herbes fraîches'],['Patate douce','haricots verts','persil']],
      sugar:[['Flocons d’avoine','pomme','cannelle'],['Skyr nature','poire','amandes'],['Pain complet','purée d’amande','banane']],
      hydration:[['Bouteille de 750 ml','citron ou menthe facultatif']],
      sleep:[['Tisane sans caféine facultative','repère calme pour le coucher']],
      activity:[['Chaussures confortables','bouteille d’eau']]
    };
    return byKey[p?.key]||[];
  }
  function preparationStateKey(p){const uid=currentUid(window.__MT_TEE_BALANCE_CONTEXT__||{})||'local';return `mt_tee_prepare_v366_${uid}_${p.key}_${new Date().toISOString().slice(0,10)}`;}
  function readPreparationState(p){try{return JSON.parse(localStorage.getItem(preparationStateKey(p))||'{}');}catch(e){return {};}}
  function preparationHTML(p){const choices=preparationChoices(p);if(!choices.length)return '';const state=readPreparationState(p),index=Math.abs(Number(state.index)||0)%choices.length,items=choices[index];return `<section class="mt-tee-preparation"><small>À PRÉVOIR DEMAIN</small><h4>${state.status==='ready'?'Tout est prêt':'Une mini-liste, pas davantage'}</h4><ul>${items.map(x=>`<li><span>✶</span>${esc(x)}</li>`).join('')}</ul><div class="mt-tee-preparation-actions"><button type="button" class="${state.status==='ready'?'is-active':''}" onclick="mtTeePreparationAction('${esc(p.key)}','ready')">Je l’ai</button><button type="button" onclick="mtTeePreparationAction('${esc(p.key)}','missing')">Je ne l’ai pas</button><button type="button" onclick="mtTeePreparationAction('${esc(p.key)}','replace')">Remplacer</button></div><p>${state.status==='ready'?'Tee gardera cette préparation comme repère pour demain.':state.status==='missing'?'Tee a proposé une option différente avec des ingrédients accessibles.':'Choisis selon ce que tu as déjà. Aucun achat n’est obligatoire.'}</p></section>`;}
  window.mtTeePreparationAction=(key,action)=>{const w=window.__MT_TEE_PERIOD_RESULT__,p=w&&recentPersonalPriority(w);if(!p||p.key!==key)return;const state=readPreparationState(p),choices=preparationChoices(p);if(action==='ready')state.status='ready';else{state.status=action==='missing'?'missing':'replaced';state.index=((Number(state.index)||0)+1)%Math.max(1,choices.length);if(p.catalogKey){const rotationKey=`mt_tee_catalog_rotation_v1_${currentUid(window.__MT_TEE_BALANCE_CONTEXT__||{})}_${p.catalogKey}_${DAY()}`,rotation=readJSON(rotationKey)||{};writeJSON(rotationKey,{index:(Number(rotation.index)||0)+1});}}try{localStorage.setItem(preparationStateKey(p),JSON.stringify(state));}catch(e){}const active=document.querySelector('[data-mt-period].is-active')?.dataset.mtPeriod||'7';selectBalancePeriod(active);};
  function personalPriorityHTML(w){
    const p=recentPersonalPriority(w);if(!p)return `<div class="mt-tee-period-priority is-waiting"><small>TA PROCHAINE PRIORITÉ</small><h3>Encore quelques repères</h3><p>Lorsque plusieurs journées seront suffisamment renseignées, Tee proposera ici une seule action précise et expliquée.</p></div>`;
    return `<div class="mt-tee-period-priority"><small>LA PRIORITÉ DE TEE</small><h3>${esc(p.title)}</h3><p class="mt-tee-period-action">${esc(p.action)}</p><div><b>Pourquoi cette proposition ?</b><p>${esc(p.why)}</p><span>${esc(p.evidence)}</span></div><em>${esc(p.note)}</em></div>${preparationHTML(p)}`;
  }
  function monthlyCopy(w){
    const m=w.month||{},observed=w.monthSnapshots?.length||0;
    if(observed<3)return {title:'Ton évolution prend forme.',text:'Il faut au moins trois journées comparables pour afficher une tendance fiable. Continue simplement à renseigner tes repères.',goal:w.nextGoal};
    if(m.protocolDays>=14)return {title:'Ta progression est bien installée.',text:`Tu as validé du contenu de protocole pendant ${m.protocolDays} jours sur cette période. Les courbes montrent uniquement tes repères enregistrés, jamais une note médicale.`,goal:w.nextGoal};
    if(m.routineDays>=12)return {title:'Ta régularité devient visible.',text:`Ta routine apparaît sur ${m.routineDays} journées renseignées. Observe les tendances sans chercher une progression parfaitement linéaire.`,goal:w.nextGoal};
    return {title:'Tes repères racontent déjà une histoire.',text:'Les variations sont normales. Regarde surtout ce qui revient plusieurs fois et ce qui semble soutenir tes meilleures journées.',goal:w.nextGoal};
  }
  function renderBalancePeriod(w,period){
    if(period==='28'){
      const m=w.month||{},copy=monthlyCopy(w),charts=[sparkline(w.monthSnapshots,'vitality','Vitalité','#2f7666'),sparkline(w.monthSnapshots,'inner','Équilibre intérieur','#b18a42'),sparkline(w.monthSnapshots,'regularity','Régularité','#78956f')].join('');
      return `<div class="mt-tee-weekly-grid"><span><b>${m.hydrationDaysReached||0}</b><small>jours à 2 L d’eau</small></span><span><b>${m.sleepAverage==null?'—':m.sleepAverage+' h'}</b><small>sommeil moyen</small></span><span><b>${m.routineDays||0}</b><small>jours de routine</small></span><span><b>${m.protocolDays||0}</b><small>jours de protocole validés</small></span></div>${personalPriorityHTML(w)}${charts?`<div class="mt-tee-month-chart"><small>TES TENDANCES SUR 28 JOURS</small>${charts}</div>`:''}<div class="mt-tee-weekly-copy"><small>CE QUE TEE REMARQUE</small><p><b>${esc(copy.title)}</b> ${esc(copy.text)}</p><small>TA PRIORITÉ POUR LA SUITE</small><p>${esc(copy.goal)}</p></div>`;
    }
    return `<div class="mt-tee-weekly-grid"><span><b>${w.hydrationDaysReached}/7</b><small>objectifs d’hydratation atteints</small></span><span><b>${w.sleepAverage==null?'—':w.sleepAverage+' h'}</b><small>sommeil moyen</small></span><span><b>${w.journalDays}/7</b><small>jours de journal</small></span><span><b>${w.routineDays}/7</b><small>jours de routine</small></span></div>${personalPriorityHTML(w)}${w.constancy!=null?`<div class="mt-tee-constancy"><span>✶</span><div><small>CONSTANCE DE LA SEMAINE</small><h3>${w.constancy} %</h3><p>${w.constancy>=75?'Tes repères sont solides cette semaine.':w.constancy>=50?'Ta régularité prend forme progressivement.':'Quelques gestes simples suffisent pour reconstruire ton rythme.'}</p></div></div>`:''}${w.comparisons?.length?`<div class="mt-tee-weekly-block"><small>AUJOURD’HUI PAR RAPPORT À TOI</small>${w.comparisons.map(c=>`<p><b>${esc(c.label)}</b> est ${esc(c.text)}${c.delta?` (${c.delta>0?'+':''}${c.delta})`:''}.</p>`).join('')}</div>`:''}${w.trends?.length?`<div class="mt-tee-weekly-block"><small>TES TENDANCES</small><div class="mt-tee-trends">${w.trends.map(trendHTML).join('')}</div></div>`:''}${w.victories?.length?`<div class="mt-tee-weekly-block"><small>TES PETITES VICTOIRES</small><ul class="mt-tee-victories">${w.victories.map(v=>`<li><span>✶</span>${esc(v)}</li>`).join('')}</ul></div>`:''}${w.patterns?.length?`<div class="mt-tee-weekly-block"><small>CE QUE TEE REMARQUE</small>${w.patterns.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}<div class="mt-tee-weekly-copy"><small>CE QUE TU AS CONSOLIDÉ</small><p>${esc(w.strength)}</p><small>TON POINT D’ATTENTION</small><p>${esc(w.attention)}</p><small>TON PROCHAIN CAP</small><p>${esc(w.nextGoal)}</p></div>`;
  }
  function selectBalancePeriod(period){
    const box=document.querySelector('[data-mt-weekly-balance]'),w=window.__MT_TEE_PERIOD_RESULT__;if(!box||!w)return;
    box.querySelectorAll('[data-mt-period]').forEach(b=>b.classList.toggle('is-active',b.dataset.mtPeriod===period));
    const content=box.querySelector('[data-mt-period-content]');if(content)content.innerHTML=renderBalancePeriod(w,period);
  }
  async function showWeekly(){
    const box=document.querySelector('[data-mt-weekly-balance]');if(!box)return;
    box.hidden=false;box.innerHTML='<div class="mt-tee-weekly-loading">Lecture de tes repères personnels…</div>';
    const w=await buildWeekly();
    if(!w.hasData){
      box.innerHTML=`<div class="mt-tee-weekly-empty"><span>✶</span><h3>Ton empreinte commence ici.</h3><p>Renseigne quelques repères au fil des prochains jours. Ta semaine prendra forme naturellement, sans pression.</p></div>`;
      box.scrollIntoView({behavior:'smooth',block:'nearest'});return;
    }
    window.__MT_TEE_PERIOD_RESULT__=w;
    box.innerHTML=`<div class="mt-tee-period-tabs" role="tablist" aria-label="Période du bilan"><button type="button" class="is-active" data-mt-period="7" onclick="window.mtSelectTeeBalancePeriod&&window.mtSelectTeeBalancePeriod('7')">Cette semaine</button><button type="button" data-mt-period="28" onclick="window.mtSelectTeeBalancePeriod&&window.mtSelectTeeBalancePeriod('28')">Depuis 28 jours</button></div><div data-mt-period-content>${renderBalancePeriod(w,'7')}</div>`;
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function markerHTML(m){return `<div class="mt-tee-marker is-${esc(m.state||'unknown')}"><span class="mt-tee-marker-dot"></span><div><b>${esc(m.label)}</b><small>${esc(m.detail||'')}</small></div><strong>${esc(m.value)}</strong></div>`;}
  function factorHTML(f){return `<div class="mt-tee-factor is-${esc(f.tone||'neutral')}"><span>${f.tone==='positive'?'✶':'·'}</span><div><b>${esc(f.label)}</b><small>${esc(f.value)}</small></div></div>`;}
  function guidanceHTML(items){return (items||[]).map((x,i)=>`<li><span>${i+1}</span><p>${esc(x)}</p></li>`).join('');}
  function open(){const ctx=window.__MT_TEE_BALANCE_CONTEXT__||{},d=window.__MT_TEE_BALANCE_RESULT__||readCache(currentUid(ctx))?.data;if(!d)return;window.__MT_TEE_BALANCE_RESULT__=d;close();const o=document.createElement('div');o.id='mtTeeBalanceDrawer';o.className='mt-tee-balance-drawer';o.innerHTML=`<div class="mt-tee-balance-backdrop" onclick="mtCloseTeeBalance()"></div><section class="mt-tee-balance-sheet"><div class="mt-tee-balance-grip"></div><button class="mt-tee-balance-close" onclick="mtCloseTeeBalance()">×</button><small>MON ÉQUILIBRE AUJOURD’HUI</small><h2>Comprendre ma journée</h2><div class="mt-tee-readiness-hero is-${esc(d.readiness?.tone||'neutral')}"><div class="mt-tee-readiness-icon">✶</div><div><small>ÉTAT GÉNÉRAL</small><h3>${esc(d.readiness?.label||'À découvrir')}</h3><p>${esc(d.readiness?.message||'')}</p></div></div><div class="mt-tee-balance-rings">${ring('Vitalité',d.vitality)}${ring('Équilibre intérieur',d.innerBalance)}${ring('Régularité',d.consistency)}</div>${prioritySlotHTML(d)}<blockquote class="mt-tee-phrase"><span>✶</span><p>${esc(d.phrase||'Chaque repère compte.')}</p></blockquote><section class="mt-tee-balance-section"><div class="mt-tee-section-heading"><small>CE QUI INFLUENCE TA JOURNÉE</small><h3>Les facteurs les plus importants</h3></div><div class="mt-tee-factors">${(d.factors||[]).map(factorHTML).join('')||'<p class="mt-tee-muted">Tes premiers facteurs apparaîtront ici dès que tu renseigneras quelques repères.</p>'}</div></section><section class="mt-tee-balance-section"><div class="mt-tee-section-heading"><small>MES REPÈRES DU CORPS</small><h3>Le détail de ma journée</h3></div><div class="mt-tee-markers">${(d.markers||[]).map(markerHTML).join('')}</div></section><section class="mt-tee-balance-section mt-tee-guidance"><div class="mt-tee-section-heading"><small>AUJOURD’HUI</small><h3>D’autres gestes possibles</h3></div><ol>${guidanceHTML(d.guidance)}</ol></section>${d.protocol?`<section class="mt-tee-protocol-reading"><small>MON PROTOCOLE ACTUEL</small><h3>${esc(d.protocol.title)}</h3><p>${esc(d.protocol.message)}</p></section>`:''}<section class="mt-tee-projection"><small>POUR DEMAIN</small><h3>${esc(d.projection?.title||'Continue à observer ton rythme.')}</h3><p>${esc(d.projection?.message||'')}</p></section><div class="mt-tee-balance-links"><button onclick="mtCloseTeeBalance();window.mtOpenTodaySheet&&window.mtOpenTodaySheet()">Voir mes repères du jour</button><button onclick="window.mtOpenTeeBalanceJournal&&window.mtOpenTeeBalanceJournal()">Écrire dans mon journal</button><button onclick="window.mtShowTeeBalanceHistory&&window.mtShowTeeBalanceHistory()">Revoir mes journées</button><button onclick="window.mtShowWeeklyTeeBalance&&window.mtShowWeeklyTeeBalance()">Voir mon empreinte de la semaine</button></div><section class="mt-tee-history" data-mt-balance-history hidden></section><section class="mt-tee-weekly" data-mt-weekly-balance hidden></section><p class="mt-tee-balance-disclaimer">Cette lecture est informative et repose uniquement sur les données renseignées dans Méthode Tee. Elle ne constitue pas une mesure médicale ni un diagnostic personnalisé.</p></section>`;document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('open'));document.body.classList.add('mt-tee-balance-open');}

  function refreshPriorityVisibility(){const d=window.__MT_TEE_BALANCE_RESULT__||{};render(d);const slot=document.querySelector('#mtTeeBalanceDrawer [data-mt-priority-slot]');if(slot)slot.innerHTML=priorityInsightHTML(d);}
  function dismissPriority(){const key=priorityDismissKey();priorityHiddenMemory.add(key);try{localStorage.setItem(key,'1');}catch(e){}refreshPriorityVisibility();if(typeof window.mtToast==='function')window.mtToast('Lecture masquée pour aujourd’hui');}
  function restorePriority(){const key=priorityDismissKey();priorityHiddenMemory.delete(key);try{localStorage.removeItem(key);}catch(e){}refreshPriorityVisibility();}

  let refreshTimer=0;
  window.addEventListener('mt:daily-state-changed',e=>{clearTimeout(refreshTimer);const source=e?.detail?.source||'',todayState=e?.detail?.todayState||null;refreshTimer=setTimeout(()=>refresh({force:true,source,todayState}),180);});
  window.mtEnsureFoodCatalog=ensureFoodCatalog;window.mtTeeBalanceInitialHTML=initialHTML;window.mtTeeBalanceInlineHTML=function(ctx){const uid=currentUid(ctx),cached=readCache(uid),d=cached?.data||build(ctx,null,null,[]);window.__MT_TEE_BALANCE_RESULT__=d;if(d?.dailySummary)window.mtTeeDailySummary=d.dailySummary;return mountInlineHTML(d);};window.mtTeeBalanceResolvedInlineHTML=mountInlineHTML;window.mtTeeBalanceInlineLoadingHTML=mountInlineLoadingHTML;window.mtRefreshTeeBalance=refresh;window.mtOpenTeeBalance=open;window.mtCloseTeeBalance=close;window.mtOpenTeeBalanceJournal=openJournal;window.mtBuildTeeBalance=build;window.mtBuildTeeDailySummary=buildDailySummary;window.mtBuildWeeklyTeeBalance=buildWeekly;window.mtShowWeeklyTeeBalance=showWeekly;window.mtSelectTeeBalancePeriod=selectBalancePeriod;window.mtShowTeeBalanceHistory=showHistory;window.mtNavigateTeeBalanceHistory=navigateHistory;window.mtDismissTeePriority=dismissPriority;window.mtRestoreTeePriority=restorePriority;
})();
