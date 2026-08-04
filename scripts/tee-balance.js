(function(){
  "use strict";
  const VERSION="2";
  const DAY=()=>new Date().toLocaleDateString('sv-SE');
  const clamp=(n,min=0,max=100)=>Math.min(max,Math.max(min,Number(n)||0));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const normalize=v=>{const n=Number(v);return Number.isFinite(n)?clamp(((n-1)/9)*100):null;};
  const weighted=items=>{const a=items.filter(x=>Number.isFinite(x.value)&&x.weight>0);if(!a.length)return null;const w=a.reduce((s,x)=>s+x.weight,0);return a.reduce((s,x)=>s+x.value*(x.weight/w),0);};
  const isoOffset=days=>{const d=new Date();d.setDate(d.getDate()+days);return d.toLocaleDateString('sv-SE');};
  function status(type,v){if(v==null)return 'unknown';if(type==='vitality')return v<35?'low':v<55?'support':v<75?'stable':'high';if(type==='inner')return v<35?'fragile':v<55?'moving':v<75?'stable':'harmonious';return v<25?'build':v<50?'starting':v<75?'progress':'anchored';}
  function label(type,v){const s=status(type,v);return ({low:'Basse',support:'À préserver',stable:'Stable',high:'Haute',fragile:'Fragile',moving:'En mouvement',harmonious:'Harmonieux',build:'À construire',starting:'En démarrage',progress:'En progression',anchored:'Bien ancrée',unknown:'—'})[s]||'—';}
  function cacheKey(uid){return `mt_tee_balance_cache_v2_${uid}_${DAY()}`;}
  function weeklyCacheKey(uid){return `mt_tee_balance_week_v2_${uid}_${DAY()}`;}
  function readJSON(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(e){return null}}
  function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}}
  function readCache(uid){const x=readJSON(cacheKey(uid));return x&&x.version===VERSION?x:null;}
  function writeCache(uid,data,journal){writeJSON(cacheKey(uid),{version:VERSION,ts:Date.now(),data,journal:journal||null});}
  let journalMemory={uid:null,date:null,ts:0,data:null};
  async function journalToday(user,{force=false}={}){
    if(!user)return null;
    const now=Date.now(), date=DAY();
    if(!force&&journalMemory.uid===user.id&&journalMemory.date===date&&now-journalMemory.ts<300000)return journalMemory.data;
    const cached=readCache(user.id);
    if(!force&&cached?.journal&&now-cached.ts<300000){journalMemory={uid:user.id,date,ts:cached.ts,data:cached.journal};return cached.journal;}
    try{
      const sb=window.initSupabase&&window.initSupabase();if(!sb)return journalMemory.data;
      const q=sb.from('journal_entries').select('tracker_stress,tracker_energie,tracker_digestion,tracker_sommeil,tracker_humeur,mood').eq('user_id',user.id).eq('entry_date',date).maybeSingle();
      const r=await Promise.race([q,new Promise(res=>setTimeout(()=>res({data:null}),2600))]);
      const data=r?.data||null;journalMemory={uid:user.id,date,ts:now,data};return data;
    }catch(e){return journalMemory.data;}
  }
  function build(ctx,journal){
    const t=ctx?.todayState||{},j=journal||{},checks=t.checks||{};
    const sleep=Number(t.sleep)>0?Number(t.sleep):null;
    const raw={energy:Number(j.tracker_energie)||null,stress:Number(j.tracker_stress)||null,digestion:Number(j.tracker_digestion)||null,sleepFeeling:Number(j.tracker_sommeil)||null,mood:Number(j.tracker_humeur)||null};
    const vitalityInputs=[['sleep',sleep],['energy',raw.energy],['sleepFeeling',raw.sleepFeeling],['stress',raw.stress]];
    const innerInputs=[['digestion',raw.digestion],['mood',raw.mood],['stress',raw.stress],['sleepFeeling',raw.sleepFeeling]];
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
    const completeness=Math.round((availableInputs.length/expected.length)*100),isPartial=completeness<70;
    let priority={key:'complete_inputs',title:'Commence par renseigner ton sommeil et ton ressenti.',message:'Ton équilibre se construit aujourd’hui.'};
    if(availableInputs.length){
      if(vitality!=null&&vitality<55)priority={key:'support_energy',title:'Stabiliser ton énergie sans te brusquer',message:'Ton énergie semble demander davantage de douceur aujourd’hui.'};
      else if(inner!=null&&inner<55)priority={key:'softness',title:'Retrouver de la douceur',message:'Ton équilibre intérieur est en mouvement. Avance sans te surcharger.'};
      else if(regularity!=null&&regularity<50)priority={key:'consistency',title:'Transformer ton énergie en régularité',message:'Tes ressentis sont plutôt stables. Quelques repères simples peuvent soutenir ta journée.'};
      else priority={key:'consolidate',title:'Consolider les repères qui te font du bien',message:'Ton équilibre paraît stable. Continue doucement, sans en faire davantage.'};
    }
    return {
      date:DAY(),completeness,isPartial,
      vitality:{value:vitality,status:status('vitality',vitality),label:label('vitality',vitality),availableInputs:vitalityInputs.filter(x=>x[1]!=null).map(x=>x[0]),missingInputs:vitalityInputs.filter(x=>x[1]==null).map(x=>x[0])},
      innerBalance:{value:inner,status:status('inner',inner),label:label('inner',inner)},
      consistency:{value:regularity,status:status('regularity',regularity),completed,total,label:label('regularity',regularity)},
      priority,
      actions:[
        {type:'today',label:'Voir mes repères du jour',target:'today',enabled:true},
        {type:'journal',label:'Écrire dans mon journal',target:'journal',enabled:true},
        {type:'weekly',label:'Voir mon empreinte de la semaine',target:'weekly',enabled:true}
      ],
      // Alias de compatibilité avec le rendu V305.
      inner,regularity,available:availableInputs.length,message:priority.message,labels:{vitality:label('vitality',vitality),inner:label('inner',inner),regularity:label('regularity',regularity)}
    };
  }
  function ring(name,val,labelText){const pct=val==null?0:Math.round(val);return `<div class="mt-tee-balance-ring" role="img" aria-label="${esc(name)} : ${esc(labelText)}${val==null?'':`, ${pct} sur 100`}" style="--mt-balance:${pct}"><div class="mt-tee-balance-ring__dial"><span>${val==null?'—':pct}</span></div><b>${esc(name)}</b><small>${esc(labelText)}</small></div>`;}
  function cardHTML(d){return `<article class="mt-tee-balance-card reveal" onclick="window.mtOpenTeeBalance&&window.mtOpenTeeBalance()"><div class="mt-tee-balance-kicker">MON ÉQUILIBRE AUJOURD’HUI</div><h2>Comprendre comment je vais aujourd’hui</h2><div class="mt-tee-balance-rings">${ring('Vitalité',d.vitality.value,d.vitality.label)}${ring('Équilibre intérieur',d.innerBalance.value,d.innerBalance.label)}${ring('Régularité',d.consistency.value,d.consistency.label)}</div><p class="mt-tee-balance-message">${esc(d.priority.message)}</p>${d.isPartial?'<small class="mt-tee-balance-partial">Lecture partielle · ajoute ton ressenti pour affiner la lecture.</small>':''}<button type="button" class="mt-tee-balance-action">COMPRENDRE MA JOURNÉE →</button></article>`;}
  function render(d){document.querySelectorAll('[data-mt-tee-balance]').forEach(el=>{el.innerHTML=cardHTML(d);});window.__MT_TEE_BALANCE_RESULT__=d;}
  async function refresh(opts={}){
    const ctx=window.__MT_TEE_BALANCE_CONTEXT__||{},user=ctx.todayState?.user||null,uid=user?.id||'guest';
    if(!opts.force){const c=readCache(uid);if(c?.data)render(c.data);}
    const source=opts.source||'';
    const forceJournal=source==='journal'||source==='profile';
    const journal=await journalToday(user,{force:forceJournal});
    const d=build(ctx,journal);writeCache(uid,d,journal);render(d);return d;
  }
  function close(){const o=document.getElementById('mtTeeBalanceDrawer');if(o){o.classList.remove('open');setTimeout(()=>o.remove(),220);}document.body.classList.remove('mt-tee-balance-open');}
  function openJournal(){close();if(window.mtOpenParcoursSheet)window.mtOpenParcoursSheet();setTimeout(()=>{const iso=window.mtJournalTodayISO?window.mtJournalTodayISO():DAY();window.mtJournalOpenForm&&window.mtJournalOpenForm(iso);},520);}
  async function buildWeekly(){
    const ctx=window.__MT_TEE_BALANCE_CONTEXT__||{},user=ctx.todayState?.user||null,uid=user?.id||'guest',cached=readJSON(weeklyCacheKey(uid));
    if(cached&&Date.now()-Number(cached.ts||0)<300000)return cached.data;
    const from=isoOffset(-6),to=DAY();let activity=[],journals=[];
    if(user){
      try{const sb=window.initSupabase&&window.initSupabase();if(sb){const [a,j]=await Promise.all([
        sb.from('daily_activity').select('activity_date,hydration_liters,sleep_hours,has_journal,has_routine,today_checks').eq('user_id',user.id).gte('activity_date',from).lte('activity_date',to),
        sb.from('journal_entries').select('entry_date,tracker_stress,tracker_energie,tracker_digestion,tracker_sommeil,tracker_humeur').eq('user_id',user.id).gte('entry_date',from).lte('entry_date',to)
      ]);activity=a.data||[];journals=j.data||[];}}
      catch(e){}
    }
    const byDate={};activity.forEach(r=>{byDate[r.activity_date]=r;});
    const hydrationDaysReached=activity.filter(r=>Number(r.hydration_liters||0)>=2).length;
    const sleepValues=activity.map(r=>Number(r.sleep_hours||0)).filter(v=>v>0);
    const sleepAverage=sleepValues.length?Math.round((sleepValues.reduce((a,b)=>a+b,0)/sleepValues.length)*10)/10:null;
    const journalDays=new Set(journals.map(r=>r.entry_date).concat(activity.filter(r=>r.has_journal).map(r=>r.activity_date))).size;
    const routineDays=activity.filter(r=>r.has_routine||r.today_checks?.routine).length;
    let missionDone=0,missionTotal=0;activity.forEach(r=>{const c=r.today_checks||{};Object.keys(c).filter(k=>!['hydration','routine','protocol','journal'].includes(k)).forEach(k=>{missionTotal++;if(c[k])missionDone++;});});
    const missionRate=missionTotal?Math.round(missionDone/missionTotal*100):null;
    let strength='Tu as commencé à créer des repères réguliers.';
    if(hydrationDaysReached>=5)strength='Ton hydratation est devenue un repère solide.';
    else if(routineDays>=4)strength='Ta routine s’installe avec régularité.';
    else if(journalDays>=4)strength='Tu as pris le temps de t’écouter plusieurs jours.';
    let attention='Continue à observer tes journées sans chercher la perfection.';
    if(sleepAverage!=null&&sleepAverage<7)attention='Ton sommeil semble être le premier levier à soutenir.';
    else if(hydrationDaysReached<3)attention='Ton hydratation peut devenir un repère plus constant.';
    else if(journalDays<2)attention='Quelques mots dans ton journal peuvent affiner ta lecture.';
    const nextGoal=sleepAverage!=null&&sleepAverage<7?'Viser un rythme de sommeil plus régulier cette semaine.':hydrationDaysReached<5?'Atteindre ton objectif d’hydratation un jour de plus.':'Conserver les repères qui fonctionnent déjà pour toi.';
    const data={range:{from,to},hydrationDaysReached,sleepAverage,journalDays,routineDays,missionRate,strength,attention,nextGoal};
    writeJSON(weeklyCacheKey(uid),{ts:Date.now(),data});return data;
  }
  async function showWeekly(){const box=document.querySelector('[data-mt-weekly-balance]');if(!box)return;box.innerHTML='<div class="mt-tee-weekly-loading">Lecture de tes 7 derniers jours…</div>';const w=await buildWeekly();box.innerHTML=`<div class="mt-tee-weekly-grid"><span><b>${w.hydrationDaysReached}/7</b><small>jours hydratés</small></span><span><b>${w.sleepAverage==null?'—':w.sleepAverage+' h'}</b><small>sommeil moyen</small></span><span><b>${w.journalDays}/7</b><small>jours de journal</small></span><span><b>${w.routineDays}/7</b><small>jours de routine</small></span></div><div class="mt-tee-weekly-copy"><small>CE QUE TU AS CONSOLIDÉ</small><p>${esc(w.strength)}</p><small>TON POINT D’ATTENTION</small><p>${esc(w.attention)}</p><small>TON PROCHAIN CAP</small><p>${esc(w.nextGoal)}</p></div>`;}
  function open(){const d=window.__MT_TEE_BALANCE_RESULT__;if(!d)return refresh({source:'profile'}).then(open);close();const o=document.createElement('div');o.id='mtTeeBalanceDrawer';o.className='mt-tee-balance-drawer';o.innerHTML=`<div class="mt-tee-balance-backdrop" onclick="mtCloseTeeBalance()"></div><section class="mt-tee-balance-sheet"><div class="mt-tee-balance-grip"></div><button class="mt-tee-balance-close" onclick="mtCloseTeeBalance()">×</button><small>MON ÉQUILIBRE AUJOURD’HUI</small><h2>Comprendre ma journée</h2><div class="mt-tee-balance-rings">${ring('Vitalité',d.vitality.value,d.vitality.label)}${ring('Équilibre intérieur',d.innerBalance.value,d.innerBalance.label)}${ring('Régularité',d.consistency.value,d.consistency.label)}</div><div class="mt-tee-balance-priority"><small>MA PRIORITÉ</small><h3>${esc(d.priority.title)}</h3><p>${esc(d.priority.message)}</p></div><div class="mt-tee-balance-links"><button onclick="mtCloseTeeBalance();window.mtOpenTodaySheet&&window.mtOpenTodaySheet()">Voir mes repères du jour</button><button onclick="window.mtOpenTeeBalanceJournal&&window.mtOpenTeeBalanceJournal()">Écrire dans mon journal</button><button onclick="window.mtShowWeeklyTeeBalance&&window.mtShowWeeklyTeeBalance()">Voir mon empreinte de la semaine</button></div><section class="mt-tee-weekly" data-mt-weekly-balance hidden></section><p class="mt-tee-balance-disclaimer">Cette lecture est informative et repose uniquement sur les données que tu renseignes dans Méthode Tee. Elle ne constitue pas une mesure médicale.</p></section>`;document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('open'));document.body.classList.add('mt-tee-balance-open');}
  async function showWeeklyAndReveal(){const box=document.querySelector('[data-mt-weekly-balance]');if(!box)return;box.hidden=false;await showWeekly();box.scrollIntoView({behavior:'smooth',block:'nearest'});}
  let refreshTimer=0;
  window.addEventListener('mt:daily-state-changed',e=>{clearTimeout(refreshTimer);const source=e?.detail?.source||'';refreshTimer=setTimeout(()=>refresh({force:true,source}),120);});
  window.mtRefreshTeeBalance=refresh;window.mtOpenTeeBalance=open;window.mtCloseTeeBalance=close;window.mtOpenTeeBalanceJournal=openJournal;window.mtBuildTeeBalance=build;window.mtBuildWeeklyTeeBalance=buildWeekly;window.mtShowWeeklyTeeBalance=showWeeklyAndReveal;
})();
