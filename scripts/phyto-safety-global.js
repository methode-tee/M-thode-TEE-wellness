/* MÉTHODE TEE — V487.3 · Sécurité phytothérapie invisible, app-wide */
(function(){
  'use strict';
  if(window.MTPhytoSafety?.version)return;

  const VERSION='V487.3';
  const TARGET_SELECTOR=[
    '#foodInspirationResult:not([hidden])',
    '#foodAdapterResult:not([hidden])',
    '.mt-food-adjustment',
    '.mt-food-signature',
    '.mt-tee-balance-message',
    '.mt-tee-guidance',
    '.ritual-signal-sheet',
    '.protocol-card',
    '.content-card',
    '.journey-content-card:not(.locked-day-preview)',
    '.intention-card',
    '[data-mt-phyto-safety]'
  ].join(',');

  const state={rules:null,loading:null,lastScan:new WeakMap(),observer:null,scanTimer:0};

  function norm(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[’']/g,' ').replace(/[^a-z0-9]+/g,' ')
      .replace(/\s+/g,' ').trim();
  }
  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function containsPhrase(text,term){
    const h=` ${norm(text)} `,n=norm(term);
    return n.length>=3&&h.includes(` ${n} `);
  }
  function severityRank(v){
    return ({block_auto:3,verify:2,caution:1})[String(v||'')]||0;
  }
  function insertStyles(){
    if(document.getElementById('mtPhytoSafetyStyleV4873'))return;
    const st=document.createElement('style');
    st.id='mtPhytoSafetyStyleV4873';
    st.textContent=`
      .mt-phyto-inline-safety{margin:12px 0 4px;padding:11px 12px;border:1px solid rgba(174,132,62,.24);border-radius:16px;background:rgba(252,248,239,.92);box-shadow:0 8px 24px rgba(26,57,48,.035);font-family:inherit}
      .mt-phyto-inline-safety__head{display:flex;align-items:flex-start;gap:9px}
      .mt-phyto-inline-safety__shield{width:27px;height:27px;flex:0 0 27px;border-radius:50%;display:grid;place-items:center;background:rgba(22,61,52,.07);color:#173f35;font-size:13px}
      .mt-phyto-inline-safety small{display:block;color:#a07b3c;font-size:9px;font-weight:850;letter-spacing:.075em;text-transform:uppercase;margin-bottom:2px}
      .mt-phyto-inline-safety b{display:block;color:#173f35;font-size:11px;line-height:1.35}
      .mt-phyto-inline-safety p{margin:5px 0 0;color:#786d63;font-size:10px;line-height:1.45}
      .mt-phyto-inline-safety[data-severity="block_auto"]{border-color:rgba(157,91,69,.25);background:rgba(251,244,239,.95)}
      .mt-phyto-inline-safety[data-severity="block_auto"] .mt-phyto-inline-safety__shield{background:rgba(157,91,69,.08)}
      .mt-phyto-inline-safety--compact{margin-top:8px}
    `;
    document.head.appendChild(st);
  }

  async function loadRules(){
    if(Array.isArray(state.rules))return state.rules;
    if(state.loading)return state.loading;
    state.loading=(async()=>{
      try{
        const sb=typeof initSupabase==='function'?initSupabase():null;
        if(!sb)return [];
        const {data:{user}}=await sb.auth.getUser();
        if(!user)return [];
        const {data,error}=await sb.rpc('mt_phyto_active_rules_v1');
        if(error){
          console.warn('[TEE phyto safety] règles indisponibles',error.message||error);
          return [];
        }
        return Array.isArray(data)?data:[];
      }catch(e){
        console.warn('[TEE phyto safety] lecture impossible',e);
        return [];
      }
    })();
    state.rules=await state.loading;
    state.loading=null;
    return state.rules;
  }

  function matchText(text,rules){
    const byPlant=new Map();
    (rules||[]).forEach(r=>{
      const terms=[r.plant_key,r.display_name,...(Array.isArray(r.aliases)?r.aliases:[])].filter(Boolean);
      if(!terms.some(t=>containsPhrase(text,t)))return;
      const key=norm(r.plant_key||r.display_name);
      const prev=byPlant.get(key);
      if(!prev||severityRank(r.severity)>severityRank(prev.severity))byPlant.set(key,r);
    });
    return [...byPlant.values()].sort((a,b)=>severityRank(b.severity)-severityRank(a.severity));
  }

  function warningHTML(matches,compact=false){
    if(!matches.length)return '';
    const top=matches[0],rank=severityRank(top.severity);
    const headline=rank>=3?'Vérification nécessaire avant d’utiliser cette plante'
      :rank===2?'Compatibilité à vérifier avec ton profil'
      :'Prudence recommandée avec ton profil';
    const names=[...new Set(matches.map(x=>x.display_name||x.plant_key).filter(Boolean))];
    const msg=matches.slice(0,2).map(x=>x.message).filter(Boolean).join(' ');
    return `<div class="mt-phyto-inline-safety${compact?' mt-phyto-inline-safety--compact':''}" data-severity="${esc(top.severity||'verify')}" data-mt-phyto-generated="1">
      <div class="mt-phyto-inline-safety__head">
        <span class="mt-phyto-inline-safety__shield" aria-hidden="true">🛡</span>
        <div><small>Sécurité plantes</small><b>${esc(headline)}</b><p>${names.length?`${esc(names.join(' · '))}. `:''}${esc(msg)}</p></div>
      </div>
    </div>`;
  }

  async function checkText(text){
    const rules=await loadRules();
    const matches=matchText(text,rules);
    return {version:VERSION,matches,active_rule_count:rules.length,severity:matches[0]?.severity||null};
  }

  async function decorate(el,text,opts={}){
    if(!el||!document.documentElement.contains(el))return {matches:[]};
    if(location.pathname.endsWith('tee-next.html')&&new URLSearchParams(location.search).get('tool')==='safety')return {matches:[]};

    const raw=String(text??el.innerText??el.textContent??'').trim();
    if(!raw)return {matches:[]};
    const key=norm(raw).slice(0,1800);
    if(state.lastScan.get(el)===key)return {matches:[]};
    state.lastScan.set(el,key);

    const rules=await loadRules(),matches=matchText(raw,rules);
    const old=[...el.children].find(x=>x.matches?.('.mt-phyto-inline-safety[data-mt-phyto-generated="1"]'));
    if(old)old.remove();
    if(!matches.length)return {matches:[]};

    insertStyles();
    const tmp=document.createElement('div');
    tmp.innerHTML=warningHTML(matches,!!opts.compact);
    const alert=tmp.firstElementChild;
    if(opts.position==='after')el.appendChild(alert);
    else el.insertBefore(alert,el.firstChild);

    el.dataset.mtPhytoSafetySeverity=matches[0]?.severity||'verify';
    return {matches,severity:matches[0]?.severity||null};
  }

  function scanNow(){
    const nodes=[...document.querySelectorAll(TARGET_SELECTOR)];
    if(!nodes.length)return;
    nodes.forEach(el=>{
      if(el.matches('.mt-phyto-inline-safety,[data-mt-phyto-generated]'))return;
      decorate(el,null,{
        compact:el.matches('.mt-food-adjustment,.mt-food-signature,.content-card,.journey-content-card,.intention-card,.protocol-card'),
        position:el.matches('#foodInspirationResult,#foodAdapterResult,.ritual-signal-sheet')?'first':'after'
      });
    });
  }
  function queueScan(){
    clearTimeout(state.scanTimer);
    state.scanTimer=setTimeout(scanNow,180);
  }
  function startObserver(){
    if(state.observer||!document.body)return;
    state.observer=new MutationObserver(muts=>{
      const onlyOwn=muts.every(m=>[...m.addedNodes].every(n=>n.nodeType===1&&n.matches?.('[data-mt-phyto-generated],.mt-phyto-inline-safety')));
      if(!onlyOwn)queueScan();
    });
    state.observer.observe(document.body,{childList:true,subtree:true});
    queueScan();
  }

  window.MTPhytoSafety={
    version:VERSION,
    checkText,
    decorate,
    rescan:queueScan,
    reset(){
      state.rules=null;state.loading=null;
      document.querySelectorAll('[data-mt-phyto-generated="1"]').forEach(x=>x.remove());
      queueScan();
    }
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});
  else startObserver();
})();