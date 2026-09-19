/* MÉTHODE TEE — V4896677 · Sécurité phytothérapie fail-closed + verrou actions automatiques */
(function(){
  'use strict';
  const VERSION='V4896677-PHYTO-SAFETY-ACTION-GUARD';
  if(window.MTPhytoSafety?.version===VERSION)return;

  const TARGET_SELECTOR=[
    '#foodInspirationResult:not([hidden])','#foodAdapterResult:not([hidden])',
    '.mt-food-adjustment','.mt-food-signature','.mt-tee-balance-message','.mt-tee-guidance',
    '.ritual-signal-sheet','.protocol-card','.content-card','.journey-content-card:not(.locked-day-preview)',
    '.intention-card','[data-mt-phyto-safety]','[data-mt-phyto-auto="1"]'
  ].join(',');

  const state={
    rules:null,loading:null,status:'idle',error:null,retryAt:0,retryTimer:0,
    lastScan:new WeakMap(),observer:null,scanTimer:0,
    contentRefs:new Map(),contentLoading:new Map(),authBound:false
  };

  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').replace(/[^a-z0-9-]+/g,' ').replace(/\s+/g,' ').trim();}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function containsPhrase(text,term){const h=` ${norm(text)} `,n=norm(term);return n.length>=3&&h.includes(` ${n} `);}
  function severityRank(v){return ({block_auto:3,verify:2,caution:1})[String(v||'')]||0;}
  function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));}
  function unique(arr){return [...new Set((arr||[]).filter(Boolean).map(String))];}
  function sbClient(){try{return typeof initSupabase==='function'?initSupabase():null}catch(_){return null;}}

  function insertStyles(){
    if(document.getElementById('mtPhytoSafetyStyleV4896677'))return;
    const st=document.createElement('style');st.id='mtPhytoSafetyStyleV4896677';st.textContent=`
      .mt-phyto-inline-safety{margin:12px 0 4px;padding:11px 12px;border:1px solid rgba(174,132,62,.24);border-radius:16px;background:rgba(252,248,239,.92);box-shadow:0 8px 24px rgba(26,57,48,.035);font-family:inherit}
      .mt-phyto-inline-safety__head{display:flex;align-items:flex-start;gap:9px}.mt-phyto-inline-safety__shield{width:27px;height:27px;flex:0 0 27px;border-radius:50%;display:grid;place-items:center;background:rgba(22,61,52,.07);color:#173f35;font-size:13px}
      .mt-phyto-inline-safety small{display:block;color:#a07b3c;font-size:9px;font-weight:850;letter-spacing:.075em;text-transform:uppercase;margin-bottom:2px}.mt-phyto-inline-safety b{display:block;color:#173f35;font-size:11px;line-height:1.35}.mt-phyto-inline-safety p{margin:5px 0 0;color:#786d63;font-size:10px;line-height:1.45}
      .mt-phyto-inline-safety[data-severity="block_auto"]{border-color:rgba(157,91,69,.28);background:rgba(251,244,239,.98)}.mt-phyto-inline-safety[data-severity="block_auto"] .mt-phyto-inline-safety__shield{background:rgba(157,91,69,.09)}
      .mt-phyto-inline-safety[data-severity="unavailable"]{border-color:rgba(160,123,60,.34);background:rgba(255,250,240,.98)}
      .mt-phyto-inline-safety--compact{margin-top:8px}.mt-phyto-retry{margin-top:8px;border:0;border-bottom:1px solid currentColor;background:none;padding:0;color:#173f35;font:inherit;font-weight:750;cursor:pointer}
      [data-mt-phyto-auto-blocked="1"],[data-mt-phyto-safety-pending="1"]{display:none!important}`;
    document.head.appendChild(st);
  }

  function setUnavailable(err){
    state.status='unavailable';state.error=err||new Error('Vérification indisponible');state.rules=null;state.retryAt=Date.now()+5000;
    scheduleRetry();
    return {status:'unavailable',rules:null,error:state.error};
  }

  function scheduleRetry(){
    clearTimeout(state.retryTimer);
    const delay=Math.max(1200,state.retryAt-Date.now());
    state.retryTimer=setTimeout(()=>{state.retryAt=0;state.lastScan=new WeakMap();queueScan();},delay);
  }

  async function loadRules(force=false){
    if(Array.isArray(state.rules)&&state.status==='ok'&&!force)return {status:'ok',rules:state.rules};
    if(state.loading&&!force)return state.loading;
    if(!force&&state.status==='unavailable'&&Date.now()<state.retryAt)return {status:'unavailable',rules:null,error:state.error};

    state.loading=(async()=>{
      try{
        const sb=sbClient();if(!sb)return setUnavailable(new Error('Client Supabase indisponible'));
        const auth=await sb.auth.getUser();if(auth?.error)throw auth.error;if(!auth?.data?.user)return setUnavailable(new Error('Session indisponible'));
        const {data,error}=await sb.rpc('mt_phyto_active_rules_v3');
        if(error)throw error;
        if(!data||data.status!=='ok'||!Array.isArray(data.rules))throw new Error('Réponse de sécurité plantes invalide.');
        state.rules=data.rules;state.status='ok';state.error=null;state.retryAt=0;
        return {status:'ok',rules:state.rules,source:'v3'};
      }catch(e){console.warn('[TEE phyto safety]',e);return setUnavailable(e);}
      finally{state.loading=null;}
    })();
    return state.loading;
  }

  function matchText(text,rules){
    const matches=[],seen=new Set();
    (rules||[]).forEach(r=>{
      const terms=[r.plant_key,r.display_name,r.latin_name,...(Array.isArray(r.aliases)?r.aliases:[])].filter(Boolean);
      if(!terms.some(t=>containsPhrase(text,t)))return;
      const sig=[r.ingredient_id||norm(r.plant_key||r.display_name),norm(r.message),r.severity].join('|');if(seen.has(sig))return;seen.add(sig);matches.push(r);
    });
    return matches.sort((a,b)=>severityRank(b.severity)-severityRank(a.severity)||String(a.display_name||a.plant_key||'').localeCompare(String(b.display_name||b.plant_key||''),'fr'));
  }

  function matchIds(ids,rules){
    const wanted=new Set(unique(ids));if(!wanted.size)return[];
    const out=[],seen=new Set();
    (rules||[]).forEach(r=>{
      const id=String(r.ingredient_id||'');if(!id||!wanted.has(id))return;
      const sig=[id,norm(r.message),r.severity].join('|');if(seen.has(sig))return;seen.add(sig);out.push(r);
    });
    return out.sort((a,b)=>severityRank(b.severity)-severityRank(a.severity)||String(a.display_name||a.plant_key||'').localeCompare(String(b.display_name||b.plant_key||''),'fr'));
  }

  function mergeMatches(...groups){
    const out=[],seen=new Set();
    groups.flat().filter(Boolean).forEach(r=>{const sig=[r.ingredient_id||norm(r.plant_key||r.display_name),norm(r.message),r.severity].join('|');if(seen.has(sig))return;seen.add(sig);out.push(r);});
    return out.sort((a,b)=>severityRank(b.severity)-severityRank(a.severity)||String(a.display_name||a.plant_key||'').localeCompare(String(b.display_name||b.plant_key||''),'fr'));
  }

  function idsFromAttr(el){
    const raw=String(el?.dataset?.mtPhytoIds||'');
    return unique(raw.split(/[|,;\s]+/).map(x=>x.trim()).filter(isUuid));
  }
  function namesFromAttr(el){return unique(String(el?.dataset?.mtPhytoName||'').split('|').map(x=>x.trim()).filter(Boolean));}

  async function refsForContent(contentId){
    const id=String(contentId||'');if(!isUuid(id))return {status:'ok',ids:[]};
    if(state.contentRefs.has(id))return {status:'ok',ids:state.contentRefs.get(id)};
    if(state.contentLoading.has(id))return state.contentLoading.get(id);
    const p=(async()=>{
      try{
        const sb=sbClient();if(!sb)throw new Error('Client Supabase indisponible');
        const {data,error}=await sb.rpc('mt_phyto_content_refs_v1',{p_content_ids:[id]});
        if(error)throw error;
        const ids=Array.isArray(data?.[id])?data[id].map(String).filter(isUuid):[];
        state.contentRefs.set(id,ids);return {status:'ok',ids};
      }catch(e){console.warn('[TEE phyto safety] refs contenu',e);return {status:'unavailable',ids:null,error:e};}
      finally{state.contentLoading.delete(id);}
    })();
    state.contentLoading.set(id,p);return p;
  }

  async function exactIdsForElement(el,opts={}){
    const ids=[...idsFromAttr(el),...(Array.isArray(opts.ingredientIds)?opts.ingredientIds:[])].map(String).filter(isUuid);
    const contentId=el?.dataset?.mtPhytoContentId||el?.dataset?.contentId||opts.contentId;
    if(contentId&&isUuid(contentId)){
      const refs=await refsForContent(contentId);
      if(refs.status!=='ok')return {status:'unavailable',ids:null,error:refs.error};
      ids.push(...refs.ids);
    }
    return {status:'ok',ids:unique(ids)};
  }

  function warningHTML(matches,compact=false,{autoBlocked=false}={}){
    if(!matches.length)return'';
    const top=matches[0],rank=severityRank(top.severity);
    const headline=autoBlocked||rank>=3?'Cette plante n’est pas proposée automatiquement':rank===2?'Compatibilité à vérifier avec ton profil':'Prudence recommandée';
    const names=[...new Set(matches.map(x=>x.display_name||x.plant_key).filter(Boolean))];
    const messages=[...new Set(matches.map(x=>String(x.message||'').trim()).filter(Boolean))].slice(0,3);
    return `<div class="mt-phyto-inline-safety${compact?' mt-phyto-inline-safety--compact':''}" data-severity="${esc(top.severity||'verify')}" data-mt-phyto-generated="1"><div class="mt-phyto-inline-safety__head"><span class="mt-phyto-inline-safety__shield" aria-hidden="true">🛡</span><div><small>Sécurité plantes</small><b>${esc(headline)}</b><p>${names.length?`${esc(names.join(' · '))}. `:''}${esc(messages.join(' '))}</p></div></div></div>`;
  }

  function unavailableHTML(compact=false,{automatic=false}={}){
    const title=automatic?'Suggestion automatique mise en pause':'Vérification plantes indisponible';
    const body=automatic?'Tee ne propose pas automatiquement cette plante tant que les règles de sécurité ne peuvent pas être vérifiées.':'Aucune absence d’alerte n’est déduite de cette panne. Réessaie la vérification lorsque la connexion revient.';
    return `<div class="mt-phyto-inline-safety${compact?' mt-phyto-inline-safety--compact':''}" data-severity="unavailable" data-mt-phyto-generated="1"><div class="mt-phyto-inline-safety__head"><span class="mt-phyto-inline-safety__shield" aria-hidden="true">🛡</span><div><small>Sécurité plantes</small><b>${esc(title)}</b><p>${esc(body)}</p><button type="button" class="mt-phyto-retry" data-mt-phyto-retry="1">Réessayer</button></div></div></div>`;
  }

  function hostFor(el,auto=false){return auto&&el?.parentElement?el.parentElement:el;}
  function removeGenerated(host){if(!host)return;[...host.querySelectorAll(':scope > [data-mt-phyto-generated="1"]')].forEach(x=>x.remove());}
  function insertGenerated(host,html,position='after'){
    if(!host||!html)return null;insertStyles();const tmp=document.createElement('div');tmp.innerHTML=html;const alert=tmp.firstElementChild;if(!alert)return null;
    if(position==='after')host.appendChild(alert);else host.insertBefore(alert,host.firstChild);return alert;
  }
  function setAutoBlocked(el,blocked){
    if(!el)return;
    if(blocked){el.dataset.mtPhytoAutoBlocked='1';el.setAttribute('aria-hidden','true');}
    else if(el.dataset.mtPhytoAutoBlocked==='1'){delete el.dataset.mtPhytoAutoBlocked;el.removeAttribute('aria-hidden');}
  }

  async function autoClearance({ingredientIds=[],names=[]}={}){
    try{
      const sb=sbClient();if(!sb)throw new Error('Client Supabase indisponible');
      const {data,error}=await sb.rpc('mt_phyto_auto_clearance_v1',{p_ingredient_ids:unique(ingredientIds).filter(isUuid),p_plant_names:unique(names)});
      if(error)throw error;
      if(!data||data.status!=='ok'||typeof data.allow_auto!=='boolean')throw new Error('Réponse de sécurité automatique invalide');
      return data;
    }catch(e){console.warn('[TEE phyto safety] auto clearance',e);return {status:'unavailable',allow_auto:false,error:e,blocked:[]};}
  }

  async function autoClearanceText({text='',ingredientIds=[],names=[]}={}){
    try{
      const sb=sbClient();if(!sb)throw new Error('Client Supabase indisponible');
      const {data,error}=await sb.rpc('mt_phyto_auto_clearance_text_v1',{
        p_text:String(text||''),
        p_ingredient_ids:unique(ingredientIds).filter(isUuid),
        p_plant_names:unique(names)
      });
      if(error)throw error;
      if(!data||data.status!=='ok'||typeof data.allow_auto!=='boolean')throw new Error('Réponse de sécurité automatique texte invalide');
      return data;
    }catch(e){console.warn('[TEE phyto safety] auto text clearance',e);return {status:'unavailable',allow_auto:false,error:e,blocked:[],unresolved_names:[]};}
  }

  async function guardAutomaticText(text,{ingredientIds=[],plantNames=[]}={}){
    const raw=String(text||'').trim();
    const loaded=await loadRules();
    if(loaded.status!=='ok')return {status:'unavailable',allow_auto:false,matches:null,error:loaded.error||state.error};

    const ids=unique(ingredientIds).filter(isUuid);
    const ruleMatches=mergeMatches(matchIds(ids,loaded.rules),raw?matchText(raw,loaded.rules):[]);
    const inferredNames=ruleMatches.map(r=>r.display_name||r.plant_key).filter(Boolean);
    const clearance=await autoClearanceText({
      text:raw,
      ingredientIds:ids,
      names:unique([...(plantNames||[]),...inferredNames])
    });
    if(clearance.status!=='ok')return {status:'unavailable',allow_auto:false,matches:null,error:clearance.error};

    const blocked=(Array.isArray(clearance.blocked)?clearance.blocked:[]).map(x=>({
      ingredient_id:x.ingredient_id,
      display_name:x.display_name,
      severity:'block_auto',
      message:'Cette plante est exclue des suggestions automatiques par les garde-fous actifs.'
    }));
    const unresolved=(Array.isArray(clearance.unresolved_names)?clearance.unresolved_names:[]).map(name=>({
      display_name:name,
      severity:'block_auto',
      message:'L’identité botanique exacte n’a pas pu être confirmée. Tee suspend donc la suggestion automatique.'
    }));
    const matches=mergeMatches(ruleMatches,blocked,unresolved);
    if(clearance.allow_auto===false&&!matches.length){
      matches.push({display_name:'Plante à vérifier',severity:'block_auto',message:'Cette proposition automatique a été suspendue par la vérification de sécurité plantes.'});
    }
    return {
      status:'ok',
      allow_auto:clearance.allow_auto===true,
      matches,
      clearance,
      active_rule_count:loaded.rules.length
    };
  }

  async function checkText(text){
    const loaded=await loadRules();if(loaded.status!=='ok')return {version:VERSION,status:'unavailable',matches:null,active_rule_count:null,severity:null};
    const matches=matchText(text,loaded.rules);return{version:VERSION,status:'ok',matches,active_rule_count:loaded.rules.length,severity:matches[0]?.severity||null};
  }

  async function checkIds(ids){
    const loaded=await loadRules();if(loaded.status!=='ok')return {version:VERSION,status:'unavailable',matches:null,active_rule_count:null,severity:null};
    const matches=matchIds(ids,loaded.rules);return{version:VERSION,status:'ok',matches,active_rule_count:loaded.rules.length,severity:matches[0]?.severity||null};
  }

  function setDependentAutoActions(el,enabled){
    const scope=el?.closest?.('#foodAdapterResult,#foodInspirationResult,[data-mt-phyto-scope]')||el?.parentElement||document;
    scope.querySelectorAll?.('[data-mt-phyto-auto-action="1"]').forEach(btn=>{
      btn.disabled=!enabled;
      btn.setAttribute('aria-disabled',enabled?'false':'true');
      btn.dataset.mtPhytoSafetyAction=enabled?'ready':'blocked';
    });
  }

  function cachedPresentation(el,host,entry){
    if(!entry)return null;
    if(entry.auto){
      if(entry.status==='ok'&&entry.allowAuto===true){
        setAutoBlocked(el,false);
        setDependentAutoActions(el,true);
        delete el.dataset.mtPhytoSafetyPending;
      }else{
        setAutoBlocked(el,true);
        setDependentAutoActions(el,false);
        if(entry.status!=='unavailable')delete el.dataset.mtPhytoSafetyPending;
      }
    }
    if(entry.html&&!host.querySelector(':scope > [data-mt-phyto-generated="1"]')){
      insertGenerated(host,entry.html,entry.position);
    }
    if(entry.severity)host.dataset.mtPhytoSafetySeverity=entry.severity;
    else delete host.dataset.mtPhytoSafetySeverity;
    return {
      status:entry.status,
      matches:entry.matches||[],
      severity:entry.severity||null,
      auto_blocked:!!entry.autoBlocked,
      allow_auto:entry.allowAuto,
      cached:true
    };
  }

  async function decorate(el,text,opts={}){
    if(!el||!document.documentElement.contains(el))return{status:'skipped',matches:[]};
    if(location.pathname.endsWith('tee-next.html')&&new URLSearchParams(location.search).get('tool')==='safety')return{status:'skipped',matches:[]};

    const auto=opts.auto===true||el.matches?.('[data-mt-phyto-auto="1"]');
    const host=hostFor(el,auto);
    const raw=String(text??el.innerText??el.textContent??'').trim();
    const names=unique([...(Array.isArray(opts.plantNames)?opts.plantNames:[]),...namesFromAttr(el)]);
    const previous=state.lastScan.get(el);

    if(auto){
      el.dataset.mtPhytoAuto='1';
      if(!previous||el.dataset.mtPhytoSafetyPending==='1'){
        el.dataset.mtPhytoSafetyPending='1';
        setAutoBlocked(el,true);
        setDependentAutoActions(el,false);
      }
    }

    const exact=await exactIdsForElement(el,opts);
    if(exact.status!=='ok'){
      if(auto){setAutoBlocked(el,true);setDependentAutoActions(el,false);el.dataset.mtPhytoSafetyPending='1';}
      removeGenerated(host);
      const html=unavailableHTML(!!opts.compact,{automatic:auto});
      insertGenerated(host,html,opts.position==='after'?'after':'first');
      state.retryAt=Date.now()+5000;
      scheduleRetry();
      return{status:'unavailable',matches:null,auto_blocked:auto};
    }

    const ids=[...exact.ids].sort();
    const scanKey=[norm(raw).slice(0,1800),ids.join(','),names.map(norm).sort().join(','),auto?'auto':'info'].join('|');

    // Important: on ne supprime PAS le bandeau avant ce test.
    // Si la carte a déjà été analysée, on conserve le bandeau existant
    // ou on le reconstruit à partir du résultat mémorisé.
    if(previous?.key===scanKey){
      return cachedPresentation(el,host,previous);
    }

    let matches=[],autoBlocked=false,allowAuto=true,status='ok',html='',severity=null;

    if(auto){
      const guard=opts.precheckedGuard?.status==='ok'
        ? opts.precheckedGuard
        : await guardAutomaticText(raw,{ingredientIds:ids,plantNames:names});

      if(guard.status!=='ok'){
        status='unavailable';
        allowAuto=false;
        autoBlocked=true;
        setAutoBlocked(el,true);
        setDependentAutoActions(el,false);
        el.dataset.mtPhytoSafetyPending='1';
        html=unavailableHTML(!!opts.compact,{automatic:true});
      }else{
        allowAuto=guard.allow_auto===true;
        autoBlocked=!allowAuto;
        matches=Array.isArray(guard.matches)?guard.matches:[];
        if(autoBlocked){
          setAutoBlocked(el,true);
          setDependentAutoActions(el,false);
        }else{
          setAutoBlocked(el,false);
          setDependentAutoActions(el,true);
        }
        delete el.dataset.mtPhytoSafetyPending;
        if(matches.length){
          severity=matches[0]?.severity||'verify';
          html=warningHTML(matches,!!opts.compact,{autoBlocked});
        }
      }
    }else{
      const loaded=await loadRules();
      if(loaded.status!=='ok'){
        status='unavailable';
        html=unavailableHTML(!!opts.compact,{automatic:false});
      }else{
        matches=mergeMatches(matchIds(ids,loaded.rules),raw?matchText(raw,loaded.rules):[]);
        if(matches.length){
          severity=matches[0]?.severity||'verify';
          html=warningHTML(matches,!!opts.compact,{autoBlocked:false});
        }
      }
    }

    removeGenerated(host);
    if(html)insertGenerated(host,html,opts.position==='after'?'after':'first');
    if(severity)host.dataset.mtPhytoSafetySeverity=severity;
    else delete host.dataset.mtPhytoSafetySeverity;

    state.lastScan.set(el,{
      key:scanKey,
      status,
      matches,
      severity,
      auto,
      autoBlocked,
      allowAuto,
      html,
      position:opts.position==='after'?'after':'first'
    });

    return{status,matches,severity,auto_blocked:autoBlocked,allow_auto:allowAuto};
  }

  function scanNow(){
    [...document.querySelectorAll(TARGET_SELECTOR)].forEach(el=>{
      if(el.matches('.mt-phyto-inline-safety,[data-mt-phyto-generated]'))return;
      decorate(el,null,{
        auto:el.matches('[data-mt-phyto-auto="1"]'),
        compact:el.matches('.mt-food-adjustment,.mt-food-signature,.content-card,.journey-content-card,.intention-card,.protocol-card,[data-mt-phyto-auto="1"]'),
        position:el.matches('#foodInspirationResult,#foodAdapterResult,.ritual-signal-sheet')?'first':'after'
      });
    });
  }

  function queueScan(){clearTimeout(state.scanTimer);state.scanTimer=setTimeout(scanNow,180);}

  function reset(opts={}){
    state.rules=null;
    state.loading=null;
    state.status='idle';
    state.error=null;
    state.retryAt=0;
    state.lastScan=new WeakMap();
    state.contentRefs.clear();
    state.contentLoading.clear();
    clearTimeout(state.retryTimer);

    document.querySelectorAll('[data-mt-phyto-generated="1"]').forEach(x=>x.remove());

    // Fail-closed : une suggestion automatique visible ne redevient jamais
    // visible pendant le trou entre reset et nouvelle vérification.
    document.querySelectorAll('[data-mt-phyto-auto="1"],[data-mt-phyto-auto-blocked="1"]').forEach(x=>{
      x.dataset.mtPhytoAuto='1';
      x.dataset.mtPhytoSafetyPending='1';
      setAutoBlocked(x,true);
      setDependentAutoActions(x,false);
    });
    document.querySelectorAll('[data-mt-phyto-auto-action="1"]').forEach(btn=>{
      btn.disabled=true;
      btn.setAttribute('aria-disabled','true');
      btn.dataset.mtPhytoSafetyAction='blocked';
    });

    if(opts.rescan!==false)queueScan();
  }

  function bindEvents(){
    document.addEventListener('click',e=>{
      if(!e.target.closest?.('[data-mt-phyto-retry="1"]'))return;
      e.preventDefault();reset({rescan:false});loadRules(true).finally(()=>queueScan());
    });
    window.addEventListener('mt:phyto-profile-updated',()=>reset({reason:'profile'}));
    window.addEventListener('mt:account-changed',()=>reset({reason:'account'}));
    if(state.authBound)return;state.authBound=true;
    try{
      const sb=sbClient();
      sb?.auth?.onAuthStateChange?.((event)=>{
        if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(String(event||'')))setTimeout(()=>reset({reason:'auth'}),0);
      });
    }catch(e){console.warn('[TEE phyto safety] auth listener',e);}
  }

  function startObserver(){
    bindEvents();
    if(state.observer||!document.body)return;
    state.observer=new MutationObserver(muts=>{
      const onlyOwn=muts.every(m=>m.type==='childList'&&[...m.addedNodes].every(n=>n.nodeType===1&&n.matches?.('[data-mt-phyto-generated],.mt-phyto-inline-safety')));
      if(!onlyOwn)queueScan();
    });
    state.observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-mt-phyto-ids','data-mt-phyto-name','data-mt-phyto-auto','data-content-id','data-mt-phyto-content-id']});
    queueScan();
  }

  window.MTPhytoSafety={
    version:VERSION,
    loadRules,
    checkText,
    checkIds,
    decorate,
    canAutoRecommend:autoClearance,
    guardAutomaticText,
    canAutoRecommendText:autoClearanceText,
    rescan:queueScan,
    reset
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});else startObserver();
})();
