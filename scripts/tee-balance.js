(function(){
  "use strict";
  const VERSION="5";
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
  function cacheKey(uid){return `mt_tee_balance_v3_${uid}_${DAY()}`;}
  function weeklyCacheKey(uid){return `mt_tee_balance_week_v3_${uid}_${DAY()}`;}
  function currentUser(ctx){return ctx?.todayState?.user||null;}
  function currentUid(ctx){return currentUser(ctx)?.id||ctx?.todayState?.userId||'guest';}
  function readCache(uid){const x=readJSON(cacheKey(uid));return x&&x.version===VERSION?x:null;}
  function writeCache(uid,data,journal){writeJSON(cacheKey(uid),{version:VERSION,ts:Date.now(),data,journal:journal||null});}

  function readinessFrom({isDiscovery,vitality,inner,regularity,sleep,hydration,stress}){
    if(isDiscovery)return {key:'discover',label:'À découvrir',title:'Ton rythme commence ici',message:'Renseigne un premier repère pour recevoir une lecture adaptée à ta journée.',tone:'neutral'};
    const values=[vitality,inner,regularity].filter(Number.isFinite);
    const avg=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
    if((Number.isFinite(vitality)&&vitality<42)||(sleep!=null&&sleep<5.5)||(stress!=null&&normalize(stress)<35))return {key:'recover',label:'Priorité récupération',title:'Ton corps demande de la douceur',message:'Privilégie aujourd’hui une récupération active, une marche calme ou des étirements.',tone:'recover'};
    if(avg!=null&&avg>=72&&(!Number.isFinite(vitality)||vitality>=65)&&(!Number.isFinite(inner)||inner>=60))return {key:'active',label:'Prête pour une journée active',title:'Ton corps semble disponible',message:'Une séance de renforcement, une course légère ou une journée dynamique peut bien s’intégrer aujourd’hui.',tone:'active'};
    return {key:'moderate',label:'Intensité modérée',title:'Avance avec équilibre',message:'Mise sur une activité modérée et garde de l’énergie pour la récupération.',tone:'moderate'};
  }
  function marker(label,value,state,detail){return {label,value,state,detail};}
  function dailyGuidance({isDiscovery,sleep,hydration,raw,checks,missionDone,missionTotal,readiness}){
    if(isDiscovery)return ['Renseigne ton sommeil ou ton énergie au réveil.','Ajoute ton hydratation au fil de la journée.','Écris quelques mots dans ton journal si tu en ressens le besoin.'];
    const tips=[];
    if(sleep!=null&&sleep<7)tips.push('Préserve ton énergie et prépare un coucher plus régulier ce soir.');
    if(hydration<1.5)tips.push('Fais de l’hydratation ton premier repère concret aujourd’hui.');
    if(raw.stress!=null&&Number(raw.stress)>=7)tips.push('Prends dix minutes de respiration, de marche ou de déconnexion.');
    if(!checks.routine)tips.push('Choisis une seule étape de routine à réaliser, sans chercher la perfection.');
    if(missionTotal>0&&missionDone<missionTotal)tips.push('Commence par la mission la plus simple pour créer un élan.');
    if(readiness.key==='active')tips.unshift('Ton niveau du jour permet une activité plus soutenue si tu en as envie.');
    if(readiness.key==='recover')tips.unshift('Évite de forcer : la récupération est aussi une forme de progression.');
    return tips.slice(0,3);
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
    const guidance=dailyGuidance({isDiscovery,sleep,hydration,raw,checks,missionDone,missionTotal,readiness});
    return {date:DAY(),completeness,isPartial,isDiscovery,availableInputs,missingInputs,readiness,markers,guidance,
      vitality:{value:isDiscovery?null:vitality,status:isDiscovery?'discover':status('vitality',vitality),label:isDiscovery?'À découvrir':label('vitality',vitality),availableInputs:vitalityInputs.filter(x=>x[1]!=null).map(x=>x[0]),missingInputs:vitalityInputs.filter(x=>x[1]==null).map(x=>x[0])},
      innerBalance:{value:isDiscovery?null:inner,status:isDiscovery?'building':status('inner',inner),label:isDiscovery?'En construction':label('inner',inner)},
      consistency:{value:isDiscovery?null:regularity,status:isDiscovery?'first_day':status('regularity',regularity),completed,total,label:isDiscovery?'Premier jour':label('regularity',regularity)},
      priority,actions:[{type:'today',label:'Voir mes repères du jour',target:'today',enabled:true},{type:'journal',label:'Écrire dans mon journal',target:'journal',enabled:true},{type:'weekly',label:'Voir mon empreinte de la semaine',target:'weekly',enabled:true}]};
  }

  function ring(name,obj){const val=obj?.value,pct=val==null?0:Math.round(val);return `<div class="mt-tee-balance-ring" aria-label="${esc(name)} : ${esc(obj?.label||'À renseigner')}" style="--mt-balance:${pct}"><div class="mt-tee-balance-ring__dial"><span>${val==null?'—':pct}</span></div><b>${esc(name)}</b><small>${esc(obj?.label||'À renseigner')}</small></div>`;}
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
  async function buildWeekly(){
    const ctx=window.__MT_TEE_BALANCE_CONTEXT__||{},user=currentUser(ctx),uid=currentUid(ctx),cached=readJSON(weeklyCacheKey(uid));
    if(cached&&Date.now()-Number(cached.ts||0)<300000)return cached.data;
    const from=isoOffset(-6),to=DAY();let activity=[],journals=[];
    if(user){try{const sb=window.initSupabase&&window.initSupabase();if(sb){const [a,j]=await Promise.all([
      sb.from('daily_activity').select('activity_date,hydration_liters,sleep_hours,has_journal,has_routine,today_checks').eq('user_id',user.id).gte('activity_date',from).lte('activity_date',to),
      sb.from('journal_entries').select('entry_date,tracker_stress,tracker_energie,tracker_digestion,tracker_sommeil,tracker_humeur').eq('user_id',user.id).gte('entry_date',from).lte('entry_date',to)
    ]);activity=a.data||[];journals=j.data||[];}}catch(e){}}
    const hydrationDaysReached=activity.filter(r=>Number(r.hydration_liters||0)>=2).length;
    const sleepValues=activity.map(r=>Number(r.sleep_hours||0)).filter(v=>v>0);
    const sleepAverage=sleepValues.length?Math.round((sleepValues.reduce((a,b)=>a+b,0)/sleepValues.length)*10)/10:null;
    const journalDays=new Set(journals.map(r=>r.entry_date).concat(activity.filter(r=>r.has_journal).map(r=>r.activity_date))).size;
    const routineDays=activity.filter(r=>r.has_routine||r.today_checks?.routine).length;
    let missionDone=0,missionTotal=0;activity.forEach(r=>{const c=r.today_checks||{};Object.keys(c).filter(k=>!['hydration','routine','protocol','journal'].includes(k)).forEach(k=>{missionTotal++;if(c[k])missionDone++;});});
    const missionRate=missionTotal?Math.round(missionDone/missionTotal*100):null;
    const hasData=journals.length>0||activity.some(r=>Number(r.hydration_liters||0)>0||Number(r.sleep_hours||0)>0||r.has_journal||r.has_routine||Object.values(r.today_checks||{}).some(Boolean));
    let strength='Tu as commencé à créer des repères réguliers.';
    if(hydrationDaysReached>=5)strength='Ton hydratation est devenue un repère solide.';else if(routineDays>=4)strength='Ta routine s’installe avec régularité.';else if(journalDays>=4)strength='Tu as pris le temps de t’écouter plusieurs jours.';
    let attention='Continue à observer tes journées sans chercher la perfection.';
    if(sleepAverage!=null&&sleepAverage<7)attention='Ton sommeil semble être le premier levier à soutenir.';else if(hydrationDaysReached<3)attention='Ton hydratation peut devenir un repère plus constant.';else if(journalDays<2)attention='Quelques mots dans ton journal peuvent affiner ta lecture.';
    const nextGoal=sleepAverage!=null&&sleepAverage<7?'Viser un rythme de sommeil plus régulier cette semaine.':hydrationDaysReached<5?'Atteindre ton objectif d’hydratation un jour de plus.':'Conserver les repères qui fonctionnent déjà pour toi.';
    const data={range:{from,to},hasData,hydrationDaysReached,sleepAverage,journalDays,routineDays,missionRate,strength,attention,nextGoal};writeJSON(weeklyCacheKey(uid),{ts:Date.now(),data});return data;
  }
  async function showWeekly(){const box=document.querySelector('[data-mt-weekly-balance]');if(!box)return;box.hidden=false;box.innerHTML='<div class="mt-tee-weekly-loading">Lecture de tes 7 derniers jours…</div>';const w=await buildWeekly();box.innerHTML=w.hasData?`<div class="mt-tee-weekly-grid"><span><b>${w.hydrationDaysReached}/7</b><small>jours hydratés</small></span><span><b>${w.sleepAverage==null?'—':w.sleepAverage+' h'}</b><small>sommeil moyen</small></span><span><b>${w.journalDays}/7</b><small>jours de journal</small></span><span><b>${w.routineDays}/7</b><small>jours de routine</small></span></div><div class="mt-tee-weekly-copy"><small>CE QUE TU AS CONSOLIDÉ</small><p>${esc(w.strength)}</p><small>TON POINT D’ATTENTION</small><p>${esc(w.attention)}</p><small>TON PROCHAIN CAP</small><p>${esc(w.nextGoal)}</p></div>`:`<div class="mt-tee-weekly-empty"><span>✦</span><h3>Ton empreinte commence ici.</h3><p>Renseigne quelques repères au fil des prochains jours. Ta semaine prendra forme naturellement, sans pression.</p></div>`;box.scrollIntoView({behavior:'smooth',block:'nearest'});}
  function markerHTML(m){return `<div class="mt-tee-marker is-${esc(m.state||'unknown')}"><span class="mt-tee-marker-dot"></span><div><b>${esc(m.label)}</b><small>${esc(m.detail||'')}</small></div><strong>${esc(m.value)}</strong></div>`;}
  function guidanceHTML(items){return (items||[]).map((x,i)=>`<li><span>${i+1}</span><p>${esc(x)}</p></li>`).join('');}
  function open(){const d=window.__MT_TEE_BALANCE_RESULT__;if(!d)return;close();const o=document.createElement('div');o.id='mtTeeBalanceDrawer';o.className='mt-tee-balance-drawer';o.innerHTML=`<div class="mt-tee-balance-backdrop" onclick="mtCloseTeeBalance()"></div><section class="mt-tee-balance-sheet"><div class="mt-tee-balance-grip"></div><button class="mt-tee-balance-close" onclick="mtCloseTeeBalance()">×</button><small>MON ÉQUILIBRE AUJOURD’HUI</small><h2>Comprendre ma journée</h2><div class="mt-tee-readiness-hero is-${esc(d.readiness?.tone||'neutral')}"><div class="mt-tee-readiness-icon">✦</div><div><small>ÉTAT GÉNÉRAL</small><h3>${esc(d.readiness?.label||'À découvrir')}</h3><p>${esc(d.readiness?.message||'')}</p></div></div><div class="mt-tee-balance-rings">${ring('Vitalité',d.vitality)}${ring('Équilibre intérieur',d.innerBalance)}${ring('Régularité',d.consistency)}</div><section class="mt-tee-balance-section"><div class="mt-tee-section-heading"><small>MES REPÈRES DU CORPS</small><h3>Pourquoi cette lecture ?</h3></div><div class="mt-tee-markers">${(d.markers||[]).map(markerHTML).join('')}</div></section><section class="mt-tee-balance-section mt-tee-guidance"><div class="mt-tee-section-heading"><small>AUJOURD’HUI</small><h3>Ce que Méthode Tee te conseille</h3></div><ol>${guidanceHTML(d.guidance)}</ol></section><div class="mt-tee-balance-priority"><small>MA PRIORITÉ</small><h3>${esc(d.priority.title)}</h3><p>${esc(d.priority.message)}</p></div><div class="mt-tee-balance-links"><button onclick="mtCloseTeeBalance();window.mtOpenTodaySheet&&window.mtOpenTodaySheet()">Voir mes repères du jour</button><button onclick="window.mtOpenTeeBalanceJournal&&window.mtOpenTeeBalanceJournal()">Écrire dans mon journal</button><button onclick="window.mtShowWeeklyTeeBalance&&window.mtShowWeeklyTeeBalance()">Voir mon empreinte de la semaine</button></div><section class="mt-tee-weekly" data-mt-weekly-balance hidden></section><p class="mt-tee-balance-disclaimer">Cette lecture est informative et repose uniquement sur les données renseignées dans Méthode Tee. Elle ne constitue pas une mesure médicale ni une recommandation d’entraînement personnalisée.</p></section>`;document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('open'));document.body.classList.add('mt-tee-balance-open');}

  let refreshTimer=0;
  window.addEventListener('mt:daily-state-changed',e=>{clearTimeout(refreshTimer);const source=e?.detail?.source||'';refreshTimer=setTimeout(()=>refresh({force:true,source}),180);});
  window.mtTeeBalanceInitialHTML=initialHTML;window.mtRefreshTeeBalance=refresh;window.mtOpenTeeBalance=open;window.mtCloseTeeBalance=close;window.mtOpenTeeBalanceJournal=openJournal;window.mtBuildTeeBalance=build;window.mtBuildWeeklyTeeBalance=buildWeekly;window.mtShowWeeklyTeeBalance=showWeekly;
})();
