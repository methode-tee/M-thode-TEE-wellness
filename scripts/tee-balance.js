(function(){
  "use strict";
  const VERSION="7";
  const DAY=()=>new Date().toLocaleDateString('sv-SE');
  const clamp=(n,min=0,max=100)=>Math.min(max,Math.max(min,Number(n)||0));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const normalize=v=>{const n=Number(v);return Number.isFinite(n)?clamp(((n-1)/9)*100):null;};
  const weighted=items=>{const a=items.filter(x=>Number.isFinite(x.value)&&x.weight>0);if(!a.length)return null;const w=a.reduce((s,x)=>s+x.weight,0);return a.reduce((s,x)=>s+x.value*(x.weight/w),0);};
  const isoOffset=days=>{const d=new Date();d.setDate(d.getDate()+days);return d.toLocaleDateString('sv-SE');};
  const readJSON=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch(e){return null}};
  const writeJSON=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  function status(type,v){if(v==null)return 'unknown';if(type==='vitality')return v<35?'low':v<55?'support':v<75?'stable':'high';if(type==='inner')return v<35?'fragile':v<55?'moving':v<75?'stable':'harmonious';return v<25?'build':v<50?'starting':v<75?'progress':'anchored';}
  function label(type,v){const s=status(type,v);return ({low:'Basse',support:'À préserver',stable:'Stable',high:'Haute',fragile:'Fragile',moving:'En mouvement',harmonious:'Harmonieux',build:'À construire',starting:'En démarrage',progress:'En progression',anchored:'Bien ancrée',unknown:'À renseigner'})[s]||'À renseigner';}
  function cacheKey(uid){return `mt_tee_balance_v4_${uid}_${DAY()}`;}
  function weeklyCacheKey(uid){return `mt_tee_balance_week_v4_${uid}_${DAY()}`;}
  function currentUser(ctx){return ctx?.todayState?.user||null;}
  function currentUid(ctx){return currentUser(ctx)?.id||ctx?.todayState?.userId||'guest';}
  function readCache(uid){const x=readJSON(cacheKey(uid));return x&&x.version===VERSION?x:null;}
  function writeCache(uid,data,journal){writeJSON(cacheKey(uid),{version:VERSION,ts:Date.now(),data,journal:journal||null});}

  function readinessFrom({isDiscovery,vitality,inner,regularity,sleep,hydration,stress}){
    if(isDiscovery)return {key:'discover',label:'À découvrir',title:'Premiers repères',message:'Renseigne un premier repère pour recevoir une lecture adaptée à ton quotidien.',tone:'neutral'};
    const values=[vitality,inner,regularity].filter(Number.isFinite);
    const avg=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
    const highStress=stress!=null&&normalize(stress)>=65;
    if((Number.isFinite(vitality)&&vitality<42)||(sleep!=null&&sleep<5.5)||highStress)return {key:'recover',label:'Besoin de douceur',title:'Ton corps demande davantage de douceur',message:'Allège ce qui peut l’être, soutiens ton hydratation et avance à un rythme plus calme aujourd’hui.',tone:'recover'};
    if(avg!=null&&avg>=72&&(!Number.isFinite(vitality)||vitality>=65)&&(!Number.isFinite(inner)||inner>=60))return {key:'active',label:'Belle disponibilité',title:'Ton énergie semble disponible',message:'Profite de cette disponibilité pour avancer dans tes objectifs tout en gardant les repères qui te font du bien.',tone:'active'};
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
      const q=sb.from('journal_entries').select('tracker_stress,tracker_energie,tracker_digestion,tracker_sommeil,tracker_humeur,mood').eq('user_id',user.id).eq('entry_date',date).maybeSingle();
      const r=await Promise.race([q,new Promise(res=>setTimeout(()=>res({data:null}),2400))]);
      const data=r?.data||null;journalMemory={uid:user.id,date,ts:now,data};return data;
    }catch(e){return journalMemory.data;}
  }

  function build(ctx,journal){
    const t=ctx?.todayState||{},j=journal||{},checks=t.checks||{};
    const sleep=Number(t.sleep)>0?Number(t.sleep):null;
    const raw={energy:Number(j.tracker_energie)||null,stress:Number(j.tracker_stress)||null,digestion:Number(j.tracker_digestion)||null,sleepFeeling:Number(j.tracker_sommeil)||null,mood:Number(j.tracker_humeur)||null};
    const vitalityInputs=[['sleep',sleep],['energy',raw.energy],['sleepFeeling',raw.sleepFeeling],['stress',raw.stress]];
    const vitality=weighted([{value:sleep==null?null:clamp((sleep/7)*100),weight:35},{value:normalize(raw.energy),weight:35},{value:normalize(raw.sleepFeeling),weight:20},{value:raw.stress==null?null:100-normalize(raw.stress),weight:10}]);
    const inner=weighted([{value:normalize(raw.digestion),weight:30},{value:normalize(raw.mood),weight:30},{value:raw.stress==null?null:100-normalize(raw.stress),weight:25},{value:normalize(raw.sleepFeeling),weight:15}]);
    const missions=Array.isArray(t.missions)?t.missions:[],missionTotal=missions.length,missionDone=missions.filter(x=>x.done).length;
    const journey=ctx?.journeySummary?.today||{};
    const regItems=[
      {key:'hydration',available:true,value:clamp((Number(t.hydration||0)/2)*100),weight:25,done:Number(t.hydration||0)>=2},
      {key:'routine',available:missions.some(x=>x.key==='routine'),value:checks.routine?100:0,weight:15,done:!!checks.routine},
      {key:'protocol',available:!!t.active,value:checks.protocol?100:0,weight:20,done:!!checks.protocol},
      {key:'missions',available:missionTotal>0,value:missionTotal?missionDone/missionTotal*100:0,weight:20,done:missionTotal>0&&missionDone===missionTotal},
      {key:'journal',available:true,value:t.journalDone?100:0,weight:10,done:!!t.journalDone},
      {key:'journey',available:Number(journey.total||0)>0,value:journey.total?Number(journey.completed||0)/Number(journey.total)*100:0,weight:10,done:Number(journey.total||0)>0&&Number(journey.completed||0)>=Number(journey.total||0)}
    ].filter(x=>x.available);
    const regularity=weighted(regItems),completed=regItems.filter(x=>x.done).length,total=regItems.length;
    const expected=['sleep','energy','stress','digestion','sleepFeeling','mood'];
    const availableInputs=expected.filter(k=>k==='sleep'?sleep!=null:raw[k]!=null),missingInputs=expected.filter(k=>!availableInputs.includes(k));
    const hasMeaningfulToday=availableInputs.length>0||Number(t.hydration||0)>0||Object.values(checks).some(Boolean)||missionDone>0||Number(journey.completed||0)>0||!!t.journalDone;
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
      marker('Missions',missionTotal?missionDone+'/'+missionTotal:'Aucune',missionTotal&&missionDone===missionTotal?'good':missionDone>0?'watch':'unknown','Progression dans tes actions du jour.')
    ];
    const guidance=dailyGuidance({isDiscovery,sleep,hydration,raw,checks,missionDone,missionTotal,hasProtocol:!!t.active,readiness});
    const factors=influenceFactors({isDiscovery,sleep,hydration,raw,checks,missionDone,missionTotal});
    const projection=tomorrowProjection({isDiscovery,sleep,hydration,raw,checks});
    const phrase=teePhrase({isDiscovery,readiness,regularity,hydration,sleep});
    const protocol=protocolReading(t.active,checks);
    return {date:DAY(),completeness,isPartial,isDiscovery,availableInputs,missingInputs,readiness,markers,guidance,factors,projection,phrase,protocol,
      vitality:{value:isDiscovery?null:vitality,status:isDiscovery?'discover':status('vitality',vitality),label:isDiscovery?'À découvrir':label('vitality',vitality),availableInputs:vitalityInputs.filter(x=>x[1]!=null).map(x=>x[0]),missingInputs:vitalityInputs.filter(x=>x[1]==null).map(x=>x[0])},
      innerBalance:{value:isDiscovery?null:inner,status:isDiscovery?'building':status('inner',inner),label:isDiscovery?'En construction':label('inner',inner)},
      consistency:{value:isDiscovery?null:regularity,status:isDiscovery?'first_day':status('regularity',regularity),completed,total,label:isDiscovery?'Premier jour':label('regularity',regularity)},
      priority,actions:[{type:'today',label:'Voir mes repères du jour',target:'today',enabled:true},{type:'journal',label:'Écrire dans mon journal',target:'journal',enabled:true},{type:'weekly',label:'Voir mon empreinte de la semaine',target:'weekly',enabled:true}]};
  }

  function ring(name,obj){const val=obj?.value,pct=val==null?0:Math.round(val);return `<div class="mt-tee-balance-ring" aria-label="${esc(name)} : ${val==null?esc(obj?.label||'À découvrir'):pct+' %'}" style="--mt-balance:${pct}"><div class="mt-tee-balance-ring__dial"><span>${val==null?'—':pct+' %'}</span></div><b>${esc(name)}</b><small>${esc(obj?.label||'À découvrir')}</small></div>`;}
  function cardHTML(d){const note=d.isDiscovery?'Dès tes premiers repères, ta lecture personnalisée apparaîtra ici.':(d.isPartial?'Lecture partielle · complète ton ressenti pour l’affiner.':'');const r=d.readiness||{};return `<article class="mt-tee-balance-card${d.isDiscovery?' is-discovery':''}" onclick="window.mtOpenTeeBalance&&window.mtOpenTeeBalance()"><div class="mt-tee-balance-kicker">MON ÉQUILIBRE AUJOURD’HUI</div><h2>Comprendre comment je vais</h2><div class="mt-tee-balance-rings">${ring('Vitalité',d.vitality)}${ring('Équilibre intérieur',d.innerBalance)}${ring('Régularité',d.consistency)}</div><div class="mt-tee-readiness-inline is-${esc(r.tone||'neutral')}"><span></span><b>${esc(r.label||'À découvrir')}</b></div><p class="mt-tee-balance-message">${esc(r.message||d.priority.message)}</p>${note?`<small class="mt-tee-balance-partial">${esc(note)}</small>`:''}<span class="mt-tee-balance-cta">Comprendre ma journée →</span></article>`;}
  function mountHTML(d){return `<div data-mt-tee-balance>${cardHTML(d)}</div>`;}
  function render(d){document.querySelectorAll('[data-mt-tee-balance]').forEach(el=>{el.innerHTML=cardHTML(d);});window.__MT_TEE_BALANCE_RESULT__=d;}
  function initialHTML(ctx){
    const uid=currentUid(ctx),cached=readCache(uid);
    const d=cached?.data||build(ctx,cached?.journal||null);
    window.__MT_TEE_BALANCE_RESULT__=d;
    return mountHTML(d);
  }
  async function refresh(opts={}){
    const ctx=opts.context||window.__MT_TEE_BALANCE_CONTEXT__||{},user=currentUser(ctx),uid=currentUid(ctx),source=opts.source||'';
    const cached=readCache(uid);
    if(cached?.data&&!opts.force)render(cached.data);
    const forceJournal=source==='journal';
    const needsJournal=forceJournal||!cached||Date.now()-Number(cached.ts||0)>300000;
    const journal=needsJournal?await journalToday(user,{force:forceJournal}):(cached?.journal||journalMemory.data||null);
    const d=build(ctx,journal);writeCache(uid,d,journal);render(d);return d;
  }

  function close(){const o=document.getElementById('mtTeeBalanceDrawer');if(o){o.classList.remove('open');setTimeout(()=>o.remove(),220);}document.body.classList.remove('mt-tee-balance-open');}
  function openJournal(){close();window.mtOpenParcoursSheet&&window.mtOpenParcoursSheet();setTimeout(()=>{const iso=window.mtJournalTodayISO?window.mtJournalTodayISO():DAY();window.mtJournalOpenForm&&window.mtJournalOpenForm(iso);},520);}
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
    let missionDone=0,missionTotal=0;
    selected.forEach(r=>{const c=r.activity?.today_checks||{};Object.keys(c).filter(k=>!['hydration','routine','protocol','journal'].includes(k)).forEach(k=>{missionTotal++;if(c[k])missionDone++;});});
    const missionRate=missionTotal?Math.round(missionDone/missionTotal*100):null;
    return {days:selected.length,hydrationDaysReached,sleepAverage:sleepAverage==null?null:Math.round(sleepAverage*10)/10,journalDays,routineDays,missionRate};
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
    if(cached&&Date.now()-Number(cached.ts||0)<600000)return cached.data;
    const from28=isoOffset(-27),from7=isoOffset(-6),prevFrom=isoOffset(-13),prevTo=isoOffset(-7),to=DAY();let activity=[],journals=[];
    if(user){try{const sb=window.initSupabase&&window.initSupabase();if(sb){const [a,j]=await Promise.all([
      sb.from('daily_activity').select('activity_date,hydration_liters,sleep_hours,has_journal,has_routine,today_checks').eq('user_id',user.id).gte('activity_date',from28).lte('activity_date',to),
      sb.from('journal_entries').select('entry_date,tracker_stress,tracker_energie,tracker_digestion,tracker_sommeil,tracker_humeur').eq('user_id',user.id).gte('entry_date',from28).lte('entry_date',to)
    ]);activity=a.data||[];journals=j.data||[];}}catch(e){}}
    const rows=dateRows(activity,journals),current=periodStats(rows,from7,to),previous=periodStats(rows,prevFrom,prevTo);
    const hasData=rows.some(r=>Number(r.activity?.hydration_liters||0)>0||Number(r.activity?.sleep_hours||0)>0||r.activity?.has_journal||r.activity?.has_routine||r.journal||Object.values(r.activity?.today_checks||{}).some(Boolean));
    const constancyParts=[current.hydrationDaysReached/7*100,current.routineDays/7*100,current.journalDays/7*100,current.missionRate].filter(Number.isFinite);
    const constancy=constancyParts.length?Math.round(avg(constancyParts)):null;
    const scores=rows.filter(r=>r.date>=from7&&r.date<to).map(simplifiedDailyScore);
    const scoreAverages={vitality:avg(scores.map(x=>x.vitality)),inner:avg(scores.map(x=>x.inner)),regularity:avg(scores.map(x=>x.regularity))};
    const today=window.__MT_TEE_BALANCE_RESULT__||{},comparisons=[];
    [['Vitalité',today.vitality?.value,scoreAverages.vitality],['Équilibre intérieur',today.innerBalance?.value,scoreAverages.inner],['Régularité',today.consistency?.value,scoreAverages.regularity]].forEach(([label,value,average])=>{
      if(Number.isFinite(value)&&Number.isFinite(average)){const delta=Math.round(value-average);comparisons.push({label,delta,text:Math.abs(delta)<5?'proche de ta moyenne des 7 derniers jours':delta>0?'au-dessus de ta moyenne des 7 derniers jours':'en dessous de ta moyenne des 7 derniers jours'});}
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
    const data={range:{from:from7,to},hasData,...current,constancy,comparisons,trends,victories,patterns:personalPatterns(rows),strength,attention,nextGoal};
    writeJSON(weeklyCacheKey(uid),{ts:Date.now(),data});return data;
  }

  function trendHTML(t){return `<div class="mt-tee-trend is-${esc(t.tone)}"><span>${t.tone==='up'?'↗':t.tone==='down'?'↘':'→'}</span><div><b>${esc(t.label)}</b><small>${esc(t.value)}</small></div></div>`;}
  async function showWeekly(){
    const box=document.querySelector('[data-mt-weekly-balance]');if(!box)return;
    box.hidden=false;box.innerHTML='<div class="mt-tee-weekly-loading">Lecture de tes repères personnels…</div>';
    const w=await buildWeekly();
    if(!w.hasData){
      box.innerHTML=`<div class="mt-tee-weekly-empty"><span>✶</span><h3>Ton empreinte commence ici.</h3><p>Renseigne quelques repères au fil des prochains jours. Ta semaine prendra forme naturellement, sans pression.</p></div>`;
      box.scrollIntoView({behavior:'smooth',block:'nearest'});return;
    }
    box.innerHTML=`<div class="mt-tee-weekly-grid"><span><b>${w.hydrationDaysReached}/7</b><small>objectifs d’hydratation atteints</small></span><span><b>${w.sleepAverage==null?'—':w.sleepAverage+' h'}</b><small>sommeil moyen</small></span><span><b>${w.journalDays}/7</b><small>jours de journal</small></span><span><b>${w.routineDays}/7</b><small>jours de routine</small></span></div>
      ${w.constancy!=null?`<div class="mt-tee-constancy"><span>✶</span><div><small>CONSTANCE DE LA SEMAINE</small><h3>${w.constancy} %</h3><p>${w.constancy>=75?'Tes repères sont solides cette semaine.':w.constancy>=50?'Ta régularité prend forme progressivement.':'Quelques gestes simples suffisent pour reconstruire ton rythme.'}</p></div></div>`:''}
      ${w.comparisons?.length?`<div class="mt-tee-weekly-block"><small>AUJOURD’HUI PAR RAPPORT À TOI</small>${w.comparisons.map(c=>`<p><b>${esc(c.label)}</b> est ${esc(c.text)}${c.delta?` (${c.delta>0?'+':''}${c.delta})`:''}.</p>`).join('')}</div>`:''}
      ${w.trends?.length?`<div class="mt-tee-weekly-block"><small>TES TENDANCES</small><div class="mt-tee-trends">${w.trends.map(trendHTML).join('')}</div></div>`:''}
      ${w.victories?.length?`<div class="mt-tee-weekly-block"><small>TES PETITES VICTOIRES</small><ul class="mt-tee-victories">${w.victories.map(v=>`<li><span>✶</span>${esc(v)}</li>`).join('')}</ul></div>`:''}
      ${w.patterns?.length?`<div class="mt-tee-weekly-block"><small>CE QUE TES HABITUDES RACONTENT</small>${w.patterns.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}
      <div class="mt-tee-weekly-copy"><small>CE QUE TU AS CONSOLIDÉ</small><p>${esc(w.strength)}</p><small>TON POINT D’ATTENTION</small><p>${esc(w.attention)}</p><small>TON PROCHAIN CAP</small><p>${esc(w.nextGoal)}</p></div>`;
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function markerHTML(m){return `<div class="mt-tee-marker is-${esc(m.state||'unknown')}"><span class="mt-tee-marker-dot"></span><div><b>${esc(m.label)}</b><small>${esc(m.detail||'')}</small></div><strong>${esc(m.value)}</strong></div>`;}
  function factorHTML(f){return `<div class="mt-tee-factor is-${esc(f.tone||'neutral')}"><span>${f.tone==='positive'?'✶':'·'}</span><div><b>${esc(f.label)}</b><small>${esc(f.value)}</small></div></div>`;}
  function guidanceHTML(items){return (items||[]).map((x,i)=>`<li><span>${i+1}</span><p>${esc(x)}</p></li>`).join('');}
  function open(){const d=window.__MT_TEE_BALANCE_RESULT__;if(!d)return;close();const o=document.createElement('div');o.id='mtTeeBalanceDrawer';o.className='mt-tee-balance-drawer';o.innerHTML=`<div class="mt-tee-balance-backdrop" onclick="mtCloseTeeBalance()"></div><section class="mt-tee-balance-sheet"><div class="mt-tee-balance-grip"></div><button class="mt-tee-balance-close" onclick="mtCloseTeeBalance()">×</button><small>MON ÉQUILIBRE AUJOURD’HUI</small><h2>Comprendre ma journée</h2><div class="mt-tee-readiness-hero is-${esc(d.readiness?.tone||'neutral')}"><div class="mt-tee-readiness-icon">✶</div><div><small>ÉTAT GÉNÉRAL</small><h3>${esc(d.readiness?.label||'À découvrir')}</h3><p>${esc(d.readiness?.message||'')}</p></div></div><div class="mt-tee-balance-rings">${ring('Vitalité',d.vitality)}${ring('Équilibre intérieur',d.innerBalance)}${ring('Régularité',d.consistency)}</div><blockquote class="mt-tee-phrase"><span>✶</span><p>${esc(d.phrase||'Chaque repère compte.')}</p></blockquote><section class="mt-tee-balance-section"><div class="mt-tee-section-heading"><small>CE QUI INFLUENCE TA JOURNÉE</small><h3>Les facteurs les plus importants</h3></div><div class="mt-tee-factors">${(d.factors||[]).map(factorHTML).join('')||'<p class="mt-tee-muted">Tes premiers facteurs apparaîtront ici dès que tu renseigneras quelques repères.</p>'}</div></section><section class="mt-tee-balance-section"><div class="mt-tee-section-heading"><small>MES REPÈRES DU CORPS</small><h3>Pourquoi cette lecture ?</h3></div><div class="mt-tee-markers">${(d.markers||[]).map(markerHTML).join('')}</div></section><section class="mt-tee-balance-section mt-tee-guidance"><div class="mt-tee-section-heading"><small>AUJOURD’HUI</small><h3>Ce que Méthode Tee te conseille</h3></div><ol>${guidanceHTML(d.guidance)}</ol></section>${d.protocol?`<section class="mt-tee-protocol-reading"><small>MON PROTOCOLE ACTUEL</small><h3>${esc(d.protocol.title)}</h3><p>${esc(d.protocol.message)}</p></section>`:''}<section class="mt-tee-projection"><small>POUR DEMAIN</small><h3>${esc(d.projection?.title||'Continue à observer ton rythme.')}</h3><p>${esc(d.projection?.message||'')}</p></section><div class="mt-tee-balance-priority"><small>MA PRIORITÉ</small><h3>${esc(d.priority.title)}</h3><p>${esc(d.priority.message)}</p></div><div class="mt-tee-balance-links"><button onclick="mtCloseTeeBalance();window.mtOpenTodaySheet&&window.mtOpenTodaySheet()">Voir mes repères du jour</button><button onclick="window.mtOpenTeeBalanceJournal&&window.mtOpenTeeBalanceJournal()">Écrire dans mon journal</button><button onclick="window.mtShowWeeklyTeeBalance&&window.mtShowWeeklyTeeBalance()">Voir mon empreinte de la semaine</button></div><section class="mt-tee-weekly" data-mt-weekly-balance hidden></section><p class="mt-tee-balance-disclaimer">Cette lecture est informative et repose uniquement sur les données renseignées dans Méthode Tee. Elle ne constitue pas une mesure médicale ni un diagnostic personnalisé.</p></section>`;document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('open'));document.body.classList.add('mt-tee-balance-open');}

  let refreshTimer=0;
  window.addEventListener('mt:daily-state-changed',e=>{clearTimeout(refreshTimer);const source=e?.detail?.source||'';refreshTimer=setTimeout(()=>refresh({force:true,source}),180);});
  window.mtTeeBalanceInitialHTML=initialHTML;window.mtRefreshTeeBalance=refresh;window.mtOpenTeeBalance=open;window.mtCloseTeeBalance=close;window.mtOpenTeeBalanceJournal=openJournal;window.mtBuildTeeBalance=build;window.mtBuildWeeklyTeeBalance=buildWeekly;window.mtShowWeeklyTeeBalance=showWeekly;
})();
