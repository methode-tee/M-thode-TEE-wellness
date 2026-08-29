// MÉTHODE TEE — V416 · APPLE SANTÉ / HEALTHKIT · 1.1.0
(function(){
  'use strict';
  if(window.__MT_HEALTHKIT_READY__) return;
  window.__MT_HEALTHKIT_READY__=true;

  const STORAGE_KEY='mt_healthkit_v1';
  const SUPPORTED_TRACKERS=new Set(['sommeil_profond','performance_recuperation','pas_marche','evolution_corporelle']);
  const DAILY_CACHE=new Map(),HISTORY_CACHE=new Map(),CACHE_MS=5*60*1000;
  const DEFAULT_STATE={
    enabled:false,
    categories:{sleep:true,activity:true,body:true},
    autoPrefill:true,
    connectedAt:null,
    lastSyncAt:null,
    lastReadDate:null
  };

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const round1=value=>Math.round(Number(value||0)*10)/10;
  const round2=value=>Math.round(Number(value||0)*100)/100;
  const today=()=>new Date().toLocaleDateString('sv-SE');

  function readState(){
    try{
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!raw||typeof raw!=='object') return structuredCloneSafe(DEFAULT_STATE);
      return {
        ...structuredCloneSafe(DEFAULT_STATE),
        ...raw,
        categories:{...DEFAULT_STATE.categories,...(raw.categories||{})}
      };
    }catch(_){ return structuredCloneSafe(DEFAULT_STATE); }
  }
  function structuredCloneSafe(value){return JSON.parse(JSON.stringify(value));}
  function writeState(next){
    const state={...readState(),...(next||{})};
    state.categories={...DEFAULT_STATE.categories,...(next?.categories||state.categories||{})};
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(_){}
    window.dispatchEvent(new CustomEvent('mt:healthkit-state',{detail:state}));
    refreshProfileCard();
    return state;
  }
  function state(){return readState();}

  function isNativeIOS(){
    try{
      const cap=window.Capacitor;
      if(!cap) return false;
      const native=typeof cap.isNativePlatform==='function'?cap.isNativePlatform():!!cap.isNative;
      const platform=typeof cap.getPlatform==='function'?cap.getPlatform():cap.platform;
      return !!native && platform==='ios';
    }catch(_){return false;}
  }

  let pluginCache=null;
  function plugin(){
    if(pluginCache) return pluginCache;
    try{
      const cap=window.Capacitor;
      if(!cap) return null;
      pluginCache=cap.Plugins?.HealthKit || (typeof cap.registerPlugin==='function'?cap.registerPlugin('HealthKit'):null);
      return pluginCache;
    }catch(_){return null;}
  }

  function categoryList(s=state()){
    return Object.entries(s.categories||{}).filter(([,on])=>!!on).map(([key])=>key);
  }

  async function availability(){
    if(!isNativeIOS()) return {available:false,reason:'ios_app_only'};
    try{
      const p=plugin();
      if(!p?.isAvailable) return {available:false,reason:'plugin_missing'};
      return await p.isAvailable();
    }catch(error){return {available:false,reason:'native_error',error};}
  }

  async function requestAuthorization(categories=categoryList()){
    const p=plugin();
    if(!p?.requestAuthorization) throw new Error('Connexion Apple Santé indisponible dans cette version de l’app.');
    return await p.requestAuthorization({categories});
  }

  async function readSummary(date=today(),opts={}){
    const s=state();
    const categories=opts.categories||categoryList(s);
    if(!s.enabled&&!opts.force) throw new Error('Apple Santé n’est pas activée dans Méthode Tee.');
    const p=plugin();
    if(!p?.readDailySummary) throw new Error('Lecture Apple Santé indisponible.');
    const cacheKey=`${date}|${categories.slice().sort().join(',')}`,cached=DAILY_CACHE.get(cacheKey);
    if(!opts.force&&cached&&Date.now()-cached.at<CACHE_MS)return cached.data;
    const data=await p.readDailySummary({date,categories});
    DAILY_CACHE.set(cacheKey,{at:Date.now(),data:data||{}});
    writeState({lastSyncAt:new Date().toISOString(),lastReadDate:date});
    window.dispatchEvent(new CustomEvent('mt:healthkit-daily-data',{detail:{date,data:data||{}}}));
    return data||{};
  }

  async function readActivityHistory(startDate,endDate,includeHourly=false,force=false){
    if(!state().enabled)throw new Error('Apple Santé n’est pas activée dans Méthode Tee.');
    const p=plugin();if(!p?.readActivityHistory)throw new Error('Mets à jour l’application pour lire l’historique de marche.');
    const key=`${startDate}|${endDate}|${includeHourly?1:0}`,cached=HISTORY_CACHE.get(key);
    if(!force&&cached&&Date.now()-cached.at<CACHE_MS)return cached.data;
    const data=await p.readActivityHistory({startDate,endDate,includeHourly});HISTORY_CACHE.set(key,{at:Date.now(),data:data||{}});return data||{};
  }
  window.mtHealthKitReadActivityHistory=readActivityHistory;
  window.mtHealthKitGetCachedDailySummary=date=>[...DAILY_CACHE.entries()].find(([key])=>key.startsWith(`${date}|`))?.[1]?.data||null;

  function addCSS(){
    if(document.getElementById('mtHealthKitCSS')) return;
    const style=document.createElement('style');style.id='mtHealthKitCSS';
    style.textContent=`
      .mt-hk-overlay{position:fixed;inset:0;z-index:10060;display:none;align-items:flex-end;justify-content:center}.mt-hk-overlay.open{display:flex}.mt-hk-bg{position:absolute;inset:0;background:rgba(11,25,21,.58);backdrop-filter:blur(7px)}.mt-hk-sheet{position:relative;width:min(680px,100%);max-height:min(88dvh,820px);overflow:auto;background:#fffaf2;border:1px solid rgba(181,138,59,.28);border-radius:30px 30px 0 0;padding:16px 20px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -24px 80px rgba(8,31,25,.2)}.mt-hk-grip{width:46px;height:4px;border-radius:999px;background:#d9cdbb;margin:0 auto 15px}.mt-hk-close{position:absolute;right:18px;top:17px;width:38px;height:38px;border:0;border-radius:50%;background:#f1e9dc;color:#173b31;font-size:22px}.mt-hk-kicker{color:#a77f37;font-size:10px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.mt-hk-sheet h2{font-family:Georgia,serif;color:#173b31;font-size:31px;font-weight:400;margin:7px 45px 7px 0}.mt-hk-sheet>p{color:#776b60;font-size:13px;line-height:1.55;margin:0 0 15px}.mt-hk-hero{border-radius:24px;background:#173b31;color:white;padding:18px;margin:16px 0}.mt-hk-hero small{display:block;color:#d4b76f;font-weight:900;letter-spacing:.12em;text-transform:uppercase;font-size:9px}.mt-hk-hero b{display:block;font-family:Georgia,serif;font-size:23px;font-weight:400;margin:6px 0}.mt-hk-hero p{margin:0;color:rgba(255,255,255,.76);font-size:12px;line-height:1.5}.mt-hk-options{display:grid;gap:10px}.mt-hk-option{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:20px;background:#fffdf8;border:1px solid #e6dccd}.mt-hk-option input{margin-top:3px;width:19px;height:19px;accent-color:#173b31}.mt-hk-option b{display:block;color:#173b31;font-size:14px}.mt-hk-option span{display:block;color:#84786d;font-size:12px;line-height:1.4;margin-top:3px}.mt-hk-divider{height:1px;background:#e6dccd;margin:16px 0}.mt-hk-actions{display:grid;gap:10px;margin-top:16px}.mt-hk-primary,.mt-hk-secondary,.mt-hk-danger{width:100%;border-radius:18px;padding:15px 16px;font-weight:900;font:inherit}.mt-hk-primary{border:0;background:#173b31;color:#fff}.mt-hk-secondary{border:1px solid #c9b07a;background:transparent;color:#173b31}.mt-hk-danger{border:1px solid #dfc9bf;background:#fff7f2;color:#8d4c43}.mt-hk-primary:disabled,.mt-hk-secondary:disabled{opacity:.55}.mt-hk-status{padding:14px;border-radius:18px;background:#f2ece2;color:#706459;font-size:12px;line-height:1.5;margin-top:12px}.mt-hk-preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:13px}.mt-hk-preview div{padding:13px;border-radius:18px;background:#fffdf8;border:1px solid #e6dccd}.mt-hk-preview b{display:block;color:#173b31;font-size:17px}.mt-hk-preview small{display:block;color:#887a6d;font-size:10px;line-height:1.35;margin-top:3px}.mt-hk-tracker{border:1px solid rgba(181,138,59,.28);background:linear-gradient(135deg,#fff9ee,#f4eee2);border-radius:20px;padding:14px 15px;margin:0 0 15px}.mt-hk-tracker-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mt-hk-tracker small{display:block;color:#a77f37;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.mt-hk-tracker b{display:block;color:#173b31;font-size:14px;margin:4px 0}.mt-hk-tracker p{margin:0;color:#776b60;font-size:11px;line-height:1.45}.mt-hk-tracker button{border:1px solid #c9b07a;background:#fffdf8;color:#173b31;border-radius:999px;padding:8px 10px;font-weight:850;font-size:11px;white-space:nowrap}.mt-hk-tracker.is-loading{opacity:.66}.mt-hk-imported{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.mt-hk-imported span{border-radius:999px;background:#173b31;color:#fff;padding:6px 9px;font-size:10px;font-weight:800}.mt-hk-source-note{margin-top:10px;color:#8b7c6d;font-size:10px;line-height:1.45}.mt-hk-profile-connected{border-color:rgba(181,138,59,.42)!important}.mt-hk-profile-connected .mt-profile-card-action{color:#9a742c}.mt-hk-profile-status{font-weight:850;color:#173b31}.mt-hk-unavailable{padding:18px;border-radius:20px;background:#f2ece2;color:#76695e;line-height:1.55;font-size:13px}
      @media(min-width:700px){.mt-hk-sheet{border-radius:30px;margin-bottom:24px}.mt-hk-overlay{align-items:center}.mt-hk-preview{grid-template-columns:repeat(3,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function root(){
    addCSS();
    let el=document.getElementById('mtHealthKitOverlay');
    if(!el){el=document.createElement('div');el.id='mtHealthKitOverlay';el.className='mt-hk-overlay';document.body.appendChild(el);}
    return el;
  }

  function fmtDuration(minutes){
    const n=Math.max(0,Math.round(Number(minutes||0)));const h=Math.floor(n/60),m=n%60;
    return h?`${h} h${m?` ${String(m).padStart(2,'0')} min`:''}`:`${m} min`;
  }
  function fmtNumber(value,unit=''){
    if(value===null||value===undefined||value==='') return '—';
    return `${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Number(value))}${unit?` ${unit}`:''}`;
  }
  function fmtSync(iso){
    if(!iso) return 'Jamais';
    const d=new Date(iso);if(Number.isNaN(d.getTime())) return 'Jamais';
    if(d.toLocaleDateString('sv-SE')===today()) return `Aujourd’hui · ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`;
    return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  }

  function previewHTML(data={}){
    const cells=[];
    const sleep=data.sleep||{},activity=data.activity||{},body=data.body||{};
    if(sleep.hasData) cells.push([fmtDuration(sleep.durationMinutes),'Sommeil détecté']);
    if(activity.steps!==undefined) cells.push([new Intl.NumberFormat('fr-FR').format(activity.steps),'Pas']);
    if(activity.distanceKm!==undefined) cells.push([fmtNumber(activity.distanceKm,'km'),'Distance marche/course']);
    if(activity.activeEnergyKcal!==undefined) cells.push([fmtNumber(activity.activeEnergyKcal,'kcal'),'Énergie active']);
    if(activity.stepLengthCm!==undefined) cells.push([fmtNumber(activity.stepLengthCm,'cm'),'Longueur de pas moyenne']);
    if(activity.walkingSpeedKmh!==undefined) cells.push([fmtNumber(activity.walkingSpeedKmh,'km/h'),'Vitesse de marche moyenne']);
    if(activity.flightsClimbed!==undefined) cells.push([fmtNumber(activity.flightsClimbed),'Étages montés']);
    if(activity.workoutMinutes) cells.push([fmtDuration(activity.workoutMinutes),`${activity.workoutCount||1} entraînement${(activity.workoutCount||1)>1?'s':''}`]);
    const weight=body.weightKg?.value;if(weight!==undefined) cells.push([fmtNumber(weight,'kg'),'Dernier poids disponible']);
    const bmi=body.bodyMassIndex?.value;if(bmi!==undefined) cells.push([fmtNumber(bmi),'IMC enregistré dans Santé']);
    if(!cells.length) return '<div class="mt-hk-status">Aucune donnée disponible pour les catégories autorisées à cette date. Apple ne permet pas à Méthode Tee de distinguer une absence de donnée d’un refus de lecture.</div>';
    return `<div class="mt-hk-preview">${cells.slice(0,6).map(([v,l])=>`<div><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>`;
  }

  function sheetHTML(available){
    const s=state();
    if(!available){
      return `<div class="mt-hk-bg" onclick="mtHealthKitClose()"></div><section class="mt-hk-sheet"><div class="mt-hk-grip"></div><button class="mt-hk-close" onclick="mtHealthKitClose()">×</button><div class="mt-hk-kicker">Mon suivi personnel</div><h2>Apple Santé</h2><div class="mt-hk-unavailable">Apple Santé est disponible uniquement dans l’application Méthode Tee installée sur iPhone. La version web/PWA continue de fonctionner avec les saisies manuelles.</div></section>`;
    }
    return `<div class="mt-hk-bg" onclick="mtHealthKitClose()"></div><section class="mt-hk-sheet"><div class="mt-hk-grip"></div><button class="mt-hk-close" onclick="mtHealthKitClose()">×</button><div class="mt-hk-kicker">Mon suivi personnel · iPhone</div><h2>Apple Santé</h2><p>Choisis ce que Méthode Tee peut lire pour préremplir certains suivis. La connexion est entièrement facultative.</p><div class="mt-hk-hero"><small>Lecture seule</small><b>Tes données restent sous ton contrôle</b><p>Méthode Tee n’écrit rien dans Apple Santé. L’historique brut lu depuis HealthKit reste sur l’iPhone ; seules les valeurs que tu décides ensuite d’enregistrer dans un suivi Méthode Tee rejoignent ce suivi.</p></div><div class="mt-hk-options"><label class="mt-hk-option"><input id="mtHkSleep" type="checkbox" ${s.categories.sleep?'checked':''}><div><b>Sommeil</b><span>Durée, horaires, réveils et stades disponibles.</span></div></label><label class="mt-hk-option"><input id="mtHkActivity" type="checkbox" ${s.categories.activity?'checked':''}><div><b>Activité & entraînements</b><span>Pas, distance marche/course, énergie active et séances enregistrées.</span></div></label><label class="mt-hk-option"><input id="mtHkBody" type="checkbox" ${s.categories.body?'checked':''}><div><b>Évolution corporelle</b><span>Poids, tour de taille, masse grasse et masse maigre lorsqu’ils existent dans Santé.</span></div></label></div><div class="mt-hk-divider"></div><label class="mt-hk-option"><input id="mtHkAuto" type="checkbox" ${s.autoPrefill?'checked':''}><div><b>Préremplir automatiquement</b><span>À l’ouverture d’un suivi compatible, seules les cases encore vides sont complétées. Rien n’est enregistré tant que tu n’appuies pas sur « Enregistrer ce repère ».</span></div></label><div id="mtHealthKitStatus" class="mt-hk-status">${s.enabled?`Apple Santé activée dans Méthode Tee · dernière lecture : ${esc(fmtSync(s.lastSyncAt))}.`:'Aucune autorisation n’a encore été demandée par Méthode Tee.'}</div><div id="mtHealthKitPreview"></div><div class="mt-hk-actions"><button id="mtHealthKitConnect" class="mt-hk-primary" type="button" onclick="mtHealthKitConnect()">${s.enabled?'Mettre à jour les autorisations':'Connecter Apple Santé'}</button>${s.enabled?'<button id="mtHealthKitRead" class="mt-hk-secondary" type="button" onclick="mtHealthKitReadNow()">Lire mes données d’aujourd’hui</button><button class="mt-hk-danger" type="button" onclick="mtHealthKitDisable()">Désactiver dans Méthode Tee</button>':''}</div>${s.enabled?'<div class="mt-hk-source-note">Pour retirer une autorisation déjà accordée au niveau d’iOS, utilise les réglages Apple Santé. « Désactiver dans Méthode Tee » arrête simplement toute lecture par l’app.</div>':''}</section>`;
  }

  window.mtHealthKitOpen=async function(){
    const el=root();el.innerHTML=sheetHTML(isNativeIOS());el.classList.add('open');
    if(!isNativeIOS()) return;
    const avail=await availability();
    if(!avail.available){el.innerHTML=sheetHTML(false);return;}
    if(state().enabled) window.mtHealthKitReadNow(true);
  };
  window.mtHealthKitClose=function(){root().classList.remove('open');};

  function selectedCategoriesFromSheet(){
    const selected=[];
    if(document.getElementById('mtHkSleep')?.checked) selected.push('sleep');
    if(document.getElementById('mtHkActivity')?.checked) selected.push('activity');
    if(document.getElementById('mtHkBody')?.checked) selected.push('body');
    return selected;
  }

  function setSheetBusy(busy,message){
    const connect=document.getElementById('mtHealthKitConnect'),read=document.getElementById('mtHealthKitRead');
    if(connect) connect.disabled=busy;if(read) read.disabled=busy;
    const status=document.getElementById('mtHealthKitStatus');if(status&&message) status.textContent=message;
  }

  window.mtHealthKitConnect=async function(){
    if(!isNativeIOS()) return;
    const categories=selectedCategoriesFromSheet();
    if(!categories.length){const status=document.getElementById('mtHealthKitStatus');if(status)status.textContent='Choisis au moins une catégorie à connecter.';return;}
    setSheetBusy(true,'Ouverture des autorisations Apple Santé…');
    try{
      await requestAuthorization(categories);
      const current=state();
      writeState({
        enabled:true,
        categories:{sleep:categories.includes('sleep'),activity:categories.includes('activity'),body:categories.includes('body')},
        autoPrefill:document.getElementById('mtHkAuto')?.checked!==false,
        connectedAt:current.connectedAt||new Date().toISOString()
      });
      root().innerHTML=sheetHTML(true);
      await window.mtHealthKitReadNow(true);
    }catch(error){
      setSheetBusy(false,error?.message||'Impossible de connecter Apple Santé pour le moment.');
    }
  };

  window.mtHealthKitReadNow=async function(silent=false){
    if(!state().enabled) return;
    if(!silent) setSheetBusy(true,'Lecture locale de tes données Apple Santé…');
    try{
      const data=await readSummary(today());
      const preview=document.getElementById('mtHealthKitPreview');if(preview)preview.innerHTML=previewHTML(data);
      const status=document.getElementById('mtHealthKitStatus');if(status)status.textContent=`Lecture effectuée · ${fmtSync(state().lastSyncAt)}. Aucun enregistrement n’est créé automatiquement dans ton Carnet.`;
    }catch(error){
      const status=document.getElementById('mtHealthKitStatus');if(status)status.textContent=error?.message||'Lecture Apple Santé impossible.';
    }finally{setSheetBusy(false);}
  };

  window.mtHealthKitDisable=function(){
    const s=state();
    writeState({...s,enabled:false,lastSyncAt:null,lastReadDate:null});
    root().innerHTML=sheetHTML(true);
  };

  function refreshProfileCard(){
    const card=document.getElementById('mtHealthKitProfileCard');if(!card)return;
    const s=state(),status=card.querySelector('[data-healthkit-status]'),action=card.querySelector('[data-healthkit-action]');
    card.classList.toggle('mt-hk-profile-connected',!!s.enabled);
    if(status){
      if(!isNativeIOS()) status.textContent='Disponible dans l’app iPhone';
      else if(s.enabled){const names=[];if(s.categories.sleep)names.push('sommeil');if(s.categories.activity)names.push('activité');if(s.categories.body)names.push('corps');status.textContent=`Activée · ${names.join(' · ')}${s.lastSyncAt?` · ${fmtSync(s.lastSyncAt)}`:''}`;}
      else status.textContent='Préremplis sommeil, activité et évolution corporelle';
    }
    if(action) action.textContent=s.enabled?'Gérer →':'Connecter →';
  }
  window.mtHealthKitRefreshProfileCard=refreshProfileCard;

  function trackerLabel(key){
    if(key==='sommeil_profond') return ['Sommeil Apple Santé','Durée, horaires et réveils peuvent préremplir les champs vides.'];
    if(key==='performance_recuperation') return ['Activité Apple Santé','Pas, distance, énergie active et entraînements restent visibles dans ce repère.'];
    if(key==='pas_marche') return ['Marche Apple Santé','Pas, distance, longueur de pas, vitesse, étages et répartition horaire peuvent préremplir ce suivi.'];
    return ['Mesures Apple Santé','Poids, tour de taille, masse grasse et masse maigre peuvent être repris lorsqu’une mesure existe à cette date.'];
  }

  window.mtHealthKitTrackerBridgeHTML=function(key,date){
    if(!SUPPORTED_TRACKERS.has(String(key||''))||!isNativeIOS()) return '';
    const s=state(),[title,copy]=trackerLabel(key);
    if(!s.enabled) return `<div class="mt-hk-tracker" id="mtHealthKitTrackerBridge"><div class="mt-hk-tracker-head"><div><small>Apple Santé · facultatif</small><b>${esc(title)}</b><p>${esc(copy)}</p></div><button type="button" onclick="mtHealthKitOpen()">Connecter</button></div></div>`;
    const category=key==='sommeil_profond'?'sleep':(['performance_recuperation','pas_marche'].includes(key)?'activity':'body');
    if(!s.categories?.[category]) return `<div class="mt-hk-tracker" id="mtHealthKitTrackerBridge"><div class="mt-hk-tracker-head"><div><small>Apple Santé</small><b>${esc(title)}</b><p>Cette catégorie n’est pas activée dans ta connexion Apple Santé.</p></div><button type="button" onclick="mtHealthKitOpen()">Gérer</button></div></div>`;
    return `<div class="mt-hk-tracker" id="mtHealthKitTrackerBridge" data-key="${esc(key)}" data-date="${esc(date)}"><div class="mt-hk-tracker-head"><div><small>Apple Santé · lecture seule</small><b>${esc(title)}</b><p data-hk-copy>${esc(copy)}</p></div><button type="button" onclick="mtHealthKitImportIntoTracker('${esc(key)}','${esc(date)}',true)">Actualiser</button></div><div class="mt-hk-imported" data-hk-imported hidden></div><div data-hk-walk-detail></div></div>`;
  };

  function localDateFromISO(iso){
    if(!iso) return '';
    const d=new Date(iso);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('sv-SE');
  }
  function localTimeFromISO(iso){
    if(!iso) return '';
    const d=new Date(iso);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',hour12:false});
  }
  function inputByName(name){return document.querySelector(`#mtAdvancedTrackerForm [name="${CSS.escape(name)}"]`);}
  function fillBlank(name,value){
    if(value===undefined||value===null||value==='') return false;
    const input=inputByName(name);if(!input||String(input.value||'').trim()!=='') return false;
    input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }
  function hidden(name,value){
    if(value===undefined||value===null||value==='') return;
    const form=document.getElementById('mtAdvancedTrackerForm');if(!form)return;
    let input=form.querySelector(`input[type="hidden"][name="${CSS.escape(name)}"]`);
    if(!input){input=document.createElement('input');input.type='hidden';input.name=name;form.appendChild(input);}
    input.value=String(value);
  }
  function chips(values){
    const box=document.querySelector('#mtHealthKitTrackerBridge [data-hk-imported]');if(!box)return;
    box.hidden=!values.length;box.innerHTML=values.map(v=>`<span>${esc(v)}</span>`).join('');
  }
  function trackerMessage(message){const el=document.querySelector('#mtHealthKitTrackerBridge [data-hk-copy]');if(el)el.textContent=message;}

  window.mtHealthKitImportIntoTracker=async function(key,date,manual=false){
    if(!SUPPORTED_TRACKERS.has(key)||!state().enabled||!isNativeIOS()) return;
    const bridge=document.getElementById('mtHealthKitTrackerBridge');if(bridge?.classList.contains('is-loading'))return;
    bridge?.classList.add('is-loading');
    try{
      const category=key==='sommeil_profond'?'sleep':(['performance_recuperation','pas_marche'].includes(key)?'activity':'body');
      const data=await readSummary(date,{categories:[category]});
      const imported=[];
      hidden('_healthkit_imported_at',new Date().toISOString());hidden('_healthkit_source','Apple HealthKit');

      if(key==='sommeil_profond'){
        const sleep=data.sleep||{};
        if(!sleep.hasData){trackerMessage('Aucune donnée de sommeil lisible pour cette nuit. Tu peux continuer en saisie manuelle.');chips([]);return;}
        fillBlank('bedtime',localTimeFromISO(sleep.sleepStart));fillBlank('wake_time',localTimeFromISO(sleep.sleepEnd));
        fillBlank('awakenings',sleep.awakenings);fillBlank('awake_minutes',sleep.awakeMinutes);
        if(sleep.durationMinutes!==undefined){hidden('_healthkit_sleep_hours',round2(sleep.durationMinutes/60));imported.push(fmtDuration(sleep.durationMinutes));}
        if(sleep.deepMinutes!==undefined)hidden('_healthkit_sleep_deep_minutes',sleep.deepMinutes);
        if(sleep.coreMinutes!==undefined)hidden('_healthkit_sleep_core_minutes',sleep.coreMinutes);
        if(sleep.remMinutes!==undefined)hidden('_healthkit_sleep_rem_minutes',sleep.remMinutes);
        if(sleep.inBedMinutes!==undefined)hidden('_healthkit_in_bed_minutes',sleep.inBedMinutes);
        if(sleep.awakenings!==undefined)imported.push(`${sleep.awakenings} réveil${Number(sleep.awakenings)>1?'s':''}`);
        const stages=[];if(sleep.deepMinutes)stages.push(`profond ${fmtDuration(sleep.deepMinutes)}`);if(sleep.remMinutes)stages.push(`REM ${fmtDuration(sleep.remMinutes)}`);if(stages.length)imported.push(stages.join(' · '));
        trackerMessage('Les champs compatibles ont été préremplis. Garde tes ressentis personnels pour la qualité, l’état au réveil et le contexte.');
      }

      if(key==='performance_recuperation'){
        const activity=data.activity||{};
        if(!activity.hasData){trackerMessage('Aucune activité Apple Santé disponible pour cette date. La saisie manuelle reste inchangée.');chips([]);return;}
        if(activity.workoutMinutes) fillBlank('duration',activity.workoutMinutes);
        const distanceInput=inputByName('distance');
        if(distanceInput&&String(distanceInput.value||'').trim()===''&&activity.distanceKm!==undefined){
          const label=distanceInput.closest('.mt-follow-field')?.querySelector('label')?.textContent||'';
          const value=/\(m\)/i.test(label)?Math.round(Number(activity.distanceKm)*1000):round2(activity.distanceKm);
          fillBlank('distance',value);
        }
        if(activity.steps!==undefined){hidden('_healthkit_steps',activity.steps);imported.push(`${new Intl.NumberFormat('fr-FR').format(activity.steps)} pas`);}
        if(activity.distanceKm!==undefined){hidden('_healthkit_distance_km',activity.distanceKm);imported.push(`${fmtNumber(activity.distanceKm,'km')}`);}
        if(activity.activeEnergyKcal!==undefined){hidden('_healthkit_active_energy_kcal',activity.activeEnergyKcal);imported.push(`${fmtNumber(activity.activeEnergyKcal,'kcal')} actives`);}
        if(activity.workoutMinutes!==undefined)hidden('_healthkit_workout_minutes',activity.workoutMinutes);
        if(activity.workoutCount!==undefined)hidden('_healthkit_workout_count',activity.workoutCount);
        if(activity.workoutMinutes)imported.push(`${fmtDuration(activity.workoutMinutes)} entraînement`);
        trackerMessage('Les données objectives restent séparées de ton ressenti : intensité, fatigue, récupération et plaisir restent à toi de les évaluer.');
      }

      if(key==='pas_marche'){
        const activity=data.activity||{};
        if(!activity.hasData){trackerMessage('Aucune donnée de marche Apple Santé disponible pour cette date. Tu peux saisir manuellement ce que tu connais.');chips([]);return;}
        fillBlank('steps',activity.steps);fillBlank('distance_km',activity.distanceKm);fillBlank('walking_minutes',activity.walkingMinutes);fillBlank('flights',activity.flightsClimbed);fillBlank('step_length_cm',activity.stepLengthCm);fillBlank('walking_speed_kmh',activity.walkingSpeedKmh);
        if(activity.steps!==undefined)imported.push(`${new Intl.NumberFormat('fr-FR').format(activity.steps)} pas`);
        if(activity.distanceKm!==undefined)imported.push(fmtNumber(activity.distanceKm,'km'));
        if(activity.stepLengthCm!==undefined)imported.push(`pas ${fmtNumber(activity.stepLengthCm,'cm')}`);
        if(activity.walkingSpeedKmh!==undefined)imported.push(fmtNumber(activity.walkingSpeedKmh,'km/h'));
        if(activity.flightsClimbed!==undefined)imported.push(`${activity.flightsClimbed} étage${Number(activity.flightsClimbed)>1?'s':''}`);
        hidden('_healthkit_active_energy_kcal',activity.activeEnergyKcal);hidden('_healthkit_workout_minutes',activity.workoutMinutes);
        try{
          const history=await readActivityHistory(date,date,true),hours=(history.hourly||[]).filter(row=>Number(row.steps)>0),max=Math.max(1,...hours.map(row=>Number(row.steps)||0)),detail=bridge?.querySelector('[data-hk-walk-detail]');
          hidden('_healthkit_hourly_steps',hours);
          if(detail&&hours.length)detail.innerHTML=`<div style="margin-top:12px"><small>Répartition dans la journée</small><div style="display:flex;align-items:flex-end;gap:3px;height:54px;margin-top:7px">${hours.map(row=>`<i title="${new Date(row.start).toLocaleTimeString('fr-FR',{hour:'2-digit'})} · ${row.steps} pas" style="display:block;flex:1;min-width:4px;height:${Math.max(5,Math.round(Number(row.steps)/max*100))}%;border-radius:5px 5px 2px 2px;background:#c39a49"></i>`).join('')}</div><p style="margin-top:7px">Lecture horaire locale ; une période sans pas n’est pas qualifiée automatiquement de sédentaire.</p></div>`;
        }catch(_){/* Les agrégats quotidiens restent disponibles. */}
        trackerMessage('Apple Santé a prérempli les données objectives disponibles. Ton aisance, ton énergie et ton éventuel inconfort restent personnels.');
      }

      if(key==='evolution_corporelle'){
        const body=data.body||{},sameDay=item=>item?.date&&localDateFromISO(item.date)===date;
        let any=false;
        if(sameDay(body.weightKg)){any=fillBlank('weight',body.weightKg.value)||any;hidden('_healthkit_weight_source_date',body.weightKg.date);imported.push(`${fmtNumber(body.weightKg.value,'kg')}`);}
        if(sameDay(body.waistCm)){any=fillBlank('waist',body.waistCm.value)||any;hidden('_healthkit_waist_source_date',body.waistCm.date);imported.push(`taille ${fmtNumber(body.waistCm.value,'cm')}`);}
        if(sameDay(body.bodyFatPercentage)){any=fillBlank('body_fat',body.bodyFatPercentage.value)||any;hidden('_healthkit_body_fat_source_date',body.bodyFatPercentage.date);imported.push(`${fmtNumber(body.bodyFatPercentage.value,'%')} masse grasse`);}
        if(sameDay(body.leanBodyMassKg)){any=fillBlank('lean_body_mass',body.leanBodyMassKg.value)||any;hidden('_healthkit_lean_mass_source_date',body.leanBodyMassKg.date);imported.push(`${fmtNumber(body.leanBodyMassKg.value,'kg')} masse maigre`);}
        if(sameDay(body.bodyMassIndex)){hidden('_healthkit_body_mass_index',body.bodyMassIndex.value);hidden('_healthkit_bmi_source_date',body.bodyMassIndex.date);imported.push(`IMC ${fmtNumber(body.bodyMassIndex.value)}`);}
        if(!imported.length){trackerMessage('Apple Santé ne contient pas de mesure corporelle datée de ce jour. Une ancienne mesure n’est jamais recopiée comme si elle avait été prise aujourd’hui.');chips([]);return;}
        trackerMessage(any?'Les mesures disponibles à cette date ont prérempli les champs encore vides.':'Des mesures existent dans Apple Santé, mais les champs correspondants ne sont pas activés ou contiennent déjà une valeur.');
      }

      hidden('_healthkit_fields',imported.join(' · '));chips(imported.slice(0,5));
      if(manual&&window.mtToast)window.mtToast('Apple Santé · champs compatibles actualisés');
    }catch(error){
      trackerMessage(error?.message||'Lecture Apple Santé impossible pour le moment.');
    }finally{bridge?.classList.remove('is-loading');}
  };

  window.mtHealthKitEnhanceTrackerForm=function(key,date){
    const s=state();if(!s.enabled||!s.autoPrefill||!SUPPORTED_TRACKERS.has(key)||!isNativeIOS())return;
    setTimeout(()=>window.mtHealthKitImportIntoTracker(key,date,false),80);
  };

  // app.js rappelle explicitement refreshProfileCard après le rendu du Profil.
  document.addEventListener('DOMContentLoaded',()=>{addCSS();refreshProfileCard();});
  window.addEventListener('mt:healthkit-state',refreshProfileCard);
})();
