(function(){
  "use strict";
  const VERSION="1";
  const DAY=()=>new Date().toLocaleDateString('sv-SE');
  const clamp=(n,min=0,max=100)=>Math.min(max,Math.max(min,Number(n)||0));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function normalize(v){const n=Number(v);return Number.isFinite(n)?clamp(((n-1)/9)*100):null;}
  function weighted(items){const a=items.filter(x=>Number.isFinite(x.value)&&x.weight>0);if(!a.length)return null;const w=a.reduce((s,x)=>s+x.weight,0);return a.reduce((s,x)=>s+x.value*(x.weight/w),0);}
  function label(type,v){if(v==null)return '—';if(type==='vitality')return v<35?'Basse':v<55?'À préserver':v<75?'Stable':'Haute';if(type==='inner')return v<35?'Fragile':v<55?'En mouvement':v<75?'Stable':'Harmonieux';return v<25?'À construire':v<50?'En démarrage':v<75?'En progression':'Bien ancrée';}
  function cacheKey(uid){return `mt_tee_balance_cache_v1_${uid}_${DAY()}`;}
  function readCache(uid){try{const x=JSON.parse(localStorage.getItem(cacheKey(uid))||'null');return x&&x.version===VERSION?x:null}catch(e){return null}}
  function writeCache(uid,data){try{localStorage.setItem(cacheKey(uid),JSON.stringify({version:VERSION,ts:Date.now(),data}))}catch(e){}}
  async function journalToday(user){
    if(!user)return null;
    try{
      const sb=window.initSupabase&&window.initSupabase(); if(!sb)return null;
      const q=sb.from('journal_entries').select('tracker_stress,tracker_energie,tracker_digestion,tracker_sommeil,tracker_humeur,mood').eq('user_id',user.id).eq('entry_date',DAY()).maybeSingle();
      const r=await Promise.race([q,new Promise(res=>setTimeout(()=>res({data:null}),2600))]);
      return r?.data||null;
    }catch(e){return null}
  }
  function build(ctx,journal){
    const t=ctx?.todayState||{}; const j=journal||{}; const checks=t.checks||{};
    const sleep=Number(t.sleep)>0?Number(t.sleep):null;
    const energy=Number(j.tracker_energie)||null, stress=Number(j.tracker_stress)||null, digestion=Number(j.tracker_digestion)||null, sleepFeeling=Number(j.tracker_sommeil)||null, mood=Number(j.tracker_humeur)||null;
    const vitality=weighted([{value:sleep==null?null:clamp((sleep/7)*100),weight:35},{value:normalize(energy),weight:35},{value:normalize(sleepFeeling),weight:20},{value:stress==null?null:100-normalize(stress),weight:10}]);
    const inner=weighted([{value:normalize(digestion),weight:30},{value:normalize(mood),weight:30},{value:stress==null?null:100-normalize(stress),weight:25},{value:normalize(sleepFeeling),weight:15}]);
    const missions=Array.isArray(t.missions)?t.missions:[];
    const missionTotal=missions.length, missionDone=missions.filter(x=>x.done).length;
    const journey=ctx?.journeySummary?.today||{};
    const regItems=[
      {available:true,value:clamp((Number(t.hydration||0)/2)*100),weight:25},
      {available:missions.some(x=>x.key==='routine'),value:checks.routine?100:0,weight:15},
      {available:!!t.active,value:checks.protocol?100:0,weight:20},
      {available:missionTotal>0,value:missionTotal?missionDone/missionTotal*100:0,weight:20},
      {available:true,value:t.journalDone?100:0,weight:10},
      {available:Number(journey.total||0)>0,value:journey.total?Number(journey.completed||0)/Number(journey.total)*100:0,weight:10}
    ].filter(x=>x.available);
    const regularity=weighted(regItems);
    const available=[sleep,energy,stress,digestion,sleepFeeling,mood].filter(v=>v!=null).length;
    let priority='Commence par renseigner ton sommeil et ton ressenti.';
    let message='Ton équilibre se construit aujourd’hui.';
    if(available){
      if(vitality!=null&&vitality<55){priority='Stabiliser ton énergie sans te brusquer';message='Ton énergie semble demander davantage de douceur aujourd’hui.';}
      else if(inner!=null&&inner<55){priority='Retrouver de la douceur';message='Ton équilibre intérieur est en mouvement. Avance sans te surcharger.';}
      else if(regularity!=null&&regularity<50){priority='Transformer ton énergie en régularité';message='Tes ressentis sont plutôt stables. Quelques repères simples peuvent soutenir ta journée.';}
      else {priority='Consolider les repères qui te font du bien';message='Ton équilibre paraît stable. Continue doucement, sans en faire davantage.';}
    }
    return {vitality,inner,regularity,available,priority,message,labels:{vitality:label('vitality',vitality),inner:label('inner',inner),regularity:label('regularity',regularity)}};
  }
  function ring(name,val,labelText){const pct=val==null?0:Math.round(val);return `<div class="mt-tee-balance-ring" role="img" aria-label="${esc(name)} : ${esc(labelText)}${val==null?'':`, ${pct} sur 100`}" style="--mt-balance:${pct}"><div class="mt-tee-balance-ring__dial"><span>${val==null?'—':pct}</span></div><b>${esc(name)}</b><small>${esc(labelText)}</small></div>`;}
  function cardHTML(d){return `<article class="mt-tee-balance-card reveal" onclick="window.mtOpenTeeBalance&&window.mtOpenTeeBalance()"><div class="mt-tee-balance-kicker">MON ÉQUILIBRE AUJOURD’HUI</div><h2>Comprendre comment je vais aujourd’hui</h2><div class="mt-tee-balance-rings">${ring('Vitalité',d.vitality,d.labels.vitality)}${ring('Équilibre intérieur',d.inner,d.labels.inner)}${ring('Régularité',d.regularity,d.labels.regularity)}</div><p class="mt-tee-balance-message">${esc(d.message)}</p>${d.available<2?'<small class="mt-tee-balance-partial">Lecture partielle · ajoute ton ressenti pour affiner la lecture.</small>':''}<button type="button" class="mt-tee-balance-action">COMPRENDRE MA JOURNÉE →</button></article>`;}
  function render(d){document.querySelectorAll('[data-mt-tee-balance]').forEach(el=>{el.innerHTML=cardHTML(d);});window.__MT_TEE_BALANCE_RESULT__=d;}
  async function refresh(opts={}){
    const ctx=window.__MT_TEE_BALANCE_CONTEXT__||{}; const user=ctx.todayState?.user||null; const uid=user?.id||'guest';
    if(!opts.force){const c=readCache(uid);if(c?.data)render(c.data)}
    const journal=await journalToday(user); const d=build(ctx,journal); writeCache(uid,d); render(d); return d;
  }
  function close(){const o=document.getElementById('mtTeeBalanceDrawer');if(o){o.classList.remove('open');setTimeout(()=>o.remove(),220)}document.body.classList.remove('mt-tee-balance-open')}
  function open(){const d=window.__MT_TEE_BALANCE_RESULT__;if(!d)return refresh().then(open);close();const o=document.createElement('div');o.id='mtTeeBalanceDrawer';o.className='mt-tee-balance-drawer';o.innerHTML=`<div class="mt-tee-balance-backdrop" onclick="mtCloseTeeBalance()"></div><section class="mt-tee-balance-sheet"><div class="mt-tee-balance-grip"></div><button class="mt-tee-balance-close" onclick="mtCloseTeeBalance()">×</button><small>MON ÉQUILIBRE AUJOURD’HUI</small><h2>Comprendre ma journée</h2><div class="mt-tee-balance-rings">${ring('Vitalité',d.vitality,d.labels.vitality)}${ring('Équilibre intérieur',d.inner,d.labels.inner)}${ring('Régularité',d.regularity,d.labels.regularity)}</div><div class="mt-tee-balance-priority"><small>MA PRIORITÉ</small><h3>${esc(d.priority)}</h3><p>${esc(d.message)}</p></div><div class="mt-tee-balance-links"><button onclick="mtCloseTeeBalance();window.mtOpenTodaySheet&&window.mtOpenTodaySheet()">Voir mes repères du jour</button><button onclick="mtCloseTeeBalance();window.mtOpenParcoursSheet&&window.mtOpenParcoursSheet()">Ouvrir mon journal</button></div><p class="mt-tee-balance-disclaimer">Cette lecture est informative et repose uniquement sur les données que tu renseignes dans Méthode Tee. Elle ne constitue pas une mesure médicale.</p></section>`;document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('open'));document.body.classList.add('mt-tee-balance-open')}
  let refreshTimer=0;
  window.addEventListener('mt:daily-state-changed',()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh({force:true}),120)});
  window.mtRefreshTeeBalance=refresh; window.mtOpenTeeBalance=open; window.mtCloseTeeBalance=close; window.mtBuildTeeBalance=build;
})();
