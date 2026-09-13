(function(){
  'use strict';

  const COMPONENTS=['protein','protein_fish','protein_booster','egg','dairy','cheese','starch','grain','bread','wrap','pastry_base','vegetable','leafy','fruit','fat','fat_nut','condiment','sauce','aromatic_savory','aromatic_sweet','tomato','tomato_sauce','onion','chili','sweet','beverage','liquid','binder','flour','complete_dish','requires_preparation'];
  const GOALS=[['autre','Sans intention particulière'],['equilibre','Équilibre'],['digestion','Digestion'],['energie','Énergie'],['prise_masse','Nourrir & construire'],['perte_poids','Retrouver de la légèreté']];
  const FAMILY_LABELS={protein:'Protéine',starch:'Féculent / base glucidique',vegetable:'Végétal',fruit:'Fruit',dairy:'Laitage / fromage',fat_nut:'Graines / oléagineux',fat:'Matière grasse',aromatic:'Assaisonnement / aromatique',sweet:'Touche sucrée',beverage:'Boisson / liquide',binder:'Liant',complete:'Préparation complète'};
  let seq=0;
  const uid=()=>`mtf_${Date.now()}_${++seq}`;
  const esc=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const list=s=>String(s||'').split(/[;,\n]/).map(x=>x.trim()).filter(Boolean);
  const byId=id=>document.getElementById(id);
  const state={id:null,triggers:[],slots:[],variants:[],simpleVariants:[],builderMode:'simple',lastPlan:null};
  const status=(msg,bad=false)=>{const el=byId('adapterFormulaStatus');if(el){el.textContent=msg||'';el.style.color=bad?'#9f2d2d':'';}};

  async function rpc(name,args={}){
    const {data,error}=await initSupabase().rpc(name,args);if(error)throw error;return data;
  }

  function familyLabel(value){return FAMILY_LABELS[value]||value||'Composant';}
  function goalOptions(selected){return GOALS.map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('');}
  function options(selected=[]){const set=new Set(selected||[]);return COMPONENTS.map(x=>`<option value="${x}" ${set.has(x)?'selected':''}>${x}</option>`).join('');}

  async function searchProfiles(query,components=[]){
    const q=String(query||'').trim();
    if(!q)return [];
    if(!components.length){
      try{return await rpc('mt_admin_adapter_profile_search_v2',{p_query:q,p_limit:18});}
      catch(e){console.warn('CP495R11 profile search v2 fallback',e);}
    }
    const rows=await rpc('mt_admin_adapter_profile_search_v1',{p_query:q,p_limit:18,p_component_keys:components.length?components:null});
    return (rows||[]).map(x=>({...x,slot_families:x.slot_families||[],slot_family_details:x.slot_family_details||[],recommended_slot_family:x.recommended_slot_family||'',recommended_slot_label:x.recommended_slot_label||''}));
  }

  function normalizeProfileForSimple(x){
    const families=Array.isArray(x?.slot_families)?x.slot_families:[];
    const recommended=x?.recommended_slot_family||families[0]||'';
    return {
      profile_key:x.profile_key,
      display_name:x.display_name||x.name||x.profile_key,
      slot_family:recommended,
      slot_families:families,
      slot_family_details:Array.isArray(x?.slot_family_details)?x.slot_family_details:[],
      recommended_slot_family:recommended
    };
  }

  // -------------------------------------------------------------------------
  // Déclencheurs
  // -------------------------------------------------------------------------
  function renderTriggers(){
    const box=byId('adapterFormulaTriggers');if(!box)return;
    box.innerHTML=state.triggers.length?state.triggers.map((x,i)=>`<article class="admin-item"><div><b>${esc(x.display_name||x.profile_key)}</b><small>Fiche exacte reliée automatiquement</small></div><button type="button" data-remove-trigger="${i}">Retirer</button></article>`).join(''):'<p class="admin-note">Aucun aliment déclencheur choisi.</p>';
    box.querySelectorAll('[data-remove-trigger]').forEach(b=>b.onclick=()=>{state.triggers.splice(Number(b.dataset.removeTrigger),1);renderTriggers();markPlanStale();});
  }

  async function triggerSearch(){
    const q=byId('adapterFormulaTriggerSearch')?.value.trim();if(!q)return;
    const box=byId('adapterFormulaTriggerResults');box.innerHTML='<p>Recherche…</p>';
    try{
      const rows=await searchProfiles(q);
      box.innerHTML=(rows||[]).map((x,i)=>{const blocked=['complete','log_only'].includes(x.behavior);return `<article class="admin-item"><div><b>${esc(x.display_name)}</b><small>${blocked?'Profil protégé · ne peut pas déclencher une formule':((x.slot_family_details||[]).map(d=>esc(d.label)).join(' · ')||'Profil moteur TEE')}</small></div><button type="button" data-trigger-result="${i}" ${blocked?'disabled':''}>${blocked?'Protégé':'Ajouter'}</button></article>`;}).join('')||'<p>Aucun profil exact.</p>';
      box.querySelectorAll('[data-trigger-result]:not([disabled])').forEach(b=>b.onclick=()=>{
        const x=rows[Number(b.dataset.triggerResult)];
        if(!state.triggers.some(t=>t.profile_key===x.profile_key))state.triggers.push({profile_key:x.profile_key,display_name:x.display_name});
        renderTriggers();markPlanStale();
      });
    }catch(e){box.innerHTML=`<p>${esc(e.message)}</p>`;}
  }

  // -------------------------------------------------------------------------
  // Mode simple : vrais aliments -> rôles inférés -> slots exacts côté serveur
  // -------------------------------------------------------------------------
  function addSimpleVariant(data={}){
    const foods=(data.foods||[]).map(x=>({
      profile_key:x.profile_key,
      display_name:x.display_name||x.profile_key,
      slot_family:x.slot_family||x.family||x.recommended_slot_family||'',
      slot_families:Array.isArray(x.slot_families)?x.slot_families:(x.family?[x.family]:[]),
      slot_family_details:Array.isArray(x.slot_family_details)?x.slot_family_details:[]
    }));
    state.simpleVariants.push({uid:uid(),goal:data.goal||'autre',foods});
    renderSimpleVariants();markPlanStale();
  }

  function roleSelect(food,vi,fi){
    const families=(food.slot_families||[]).length?food.slot_families:(food.slot_family?[food.slot_family]:[]);
    if(!families.length)return '<small>Rôle à déterminer automatiquement au moment de la vérification.</small>';
    if(families.length===1)return `<small>TEE l’utilisera comme <b>${esc(familyLabel(families[0]))}</b>.</small>`;
    return `<label style="margin-top:6px">Rôle dans cette formule<select data-simple-family="${vi}:${fi}">${families.map(f=>`<option value="${esc(f)}" ${f===food.slot_family?'selected':''}>${esc(familyLabel(f))}</option>`).join('')}</select></label><small>TEE a détecté plusieurs fonctions possibles. Tu peux garder son choix ou l’ajuster.</small>`;
  }

  async function searchSimpleFood(vi,query,resultBox){
    if(!query.trim())return;
    resultBox.innerHTML='<p>Recherche…</p>';
    try{
      const rows=await searchProfiles(query);
      resultBox.innerHTML=(rows||[]).map((x,i)=>{const families=x.slot_families||[];const blocked=x.preparation_required===true||['complete','log_only'].includes(x.behavior)||!families.length;const reason=x.preparation_required===true?'Nécessite une préparation avant proposition':(['complete','log_only'].includes(x.behavior)?'Profil protégé':(!families.length?'Capacités à compléter dans sa fiche moteur':families.map(f=>esc(familyLabel(f))).join(' · ')));return `<article class="admin-item"><div><b>${esc(x.display_name)}</b><small>${reason}</small></div><button type="button" data-simple-pick="${i}" ${blocked?'disabled':''}>${blocked?'À compléter':'Ajouter'}</button></article>`;}).join('')||'<p>Aucun aliment relié au moteur.</p>';
      resultBox.querySelectorAll('[data-simple-pick]:not([disabled])').forEach(b=>b.onclick=()=>{
        const x=normalizeProfileForSimple(rows[Number(b.dataset.simplePick)]);
        const v=state.simpleVariants[vi];if(!v)return;
        if(!v.foods.some(y=>y.profile_key===x.profile_key))v.foods.push(x);
        renderSimpleVariants();markPlanStale();
      });
    }catch(e){resultBox.innerHTML=`<p>${esc(e.message)}</p>`;}
  }

  function renderSimpleVariants(){
    const box=byId('adapterFormulaSimpleVariants');if(!box)return;
    box.innerHTML=state.simpleVariants.map((v,vi)=>`<article class="admin-item" style="display:block">
      <div class="admin-grid">
        <label>Intention<select data-simple-goal="${vi}">${goalOptions(v.goal)}</select></label>
        <div><button type="button" class="ghost-btn" data-remove-simple-variant="${vi}">Supprimer la variante</button></div>
      </div>
      <p class="admin-note">Choisis uniquement les aliments que TEE doit pouvoir ajouter autour du déclencheur. Les rôles, slots et <code>profile_key</code> sont gérés automatiquement.</p>
      <div data-simple-foods="${vi}">${v.foods.length?v.foods.map((food,fi)=>`<div style="margin:10px 0;padding:11px;border:1px solid rgba(15,45,31,.12);border-radius:14px"><div style="display:flex;gap:10px;justify-content:space-between;align-items:flex-start"><div><b>${esc(food.display_name||food.profile_key)}</b>${roleSelect(food,vi,fi)}</div><button type="button" class="ghost-btn" data-remove-simple-food="${vi}:${fi}">Retirer</button></div></div>`).join(''):'<p class="admin-note">Aucun aliment ajouté à cette variante.</p>'}</div>
      <div class="admin-grid"><input data-simple-search="${vi}" placeholder="Chercher riz basmati, courgettes, citron…"><button type="button" class="ghost-btn" data-simple-search-btn="${vi}">Chercher un aliment</button></div>
      <div class="admin-list" data-simple-results="${vi}"></div>
    </article>`).join('')||'<p class="admin-note">Ajoute au moins une variante. Tu peux créer plusieurs variantes pour la même intention : la rotation et la mémoire choisiront ensuite parmi les variantes valides.</p>';

    box.querySelectorAll('[data-simple-goal]').forEach(el=>el.onchange=()=>{state.simpleVariants[Number(el.dataset.simpleGoal)].goal=el.value;markPlanStale();});
    box.querySelectorAll('[data-remove-simple-variant]').forEach(el=>el.onclick=()=>{state.simpleVariants.splice(Number(el.dataset.removeSimpleVariant),1);renderSimpleVariants();markPlanStale();});
    box.querySelectorAll('[data-remove-simple-food]').forEach(el=>el.onclick=()=>{const [vi,fi]=el.dataset.removeSimpleFood.split(':').map(Number);state.simpleVariants[vi]?.foods.splice(fi,1);renderSimpleVariants();markPlanStale();});
    box.querySelectorAll('[data-simple-family]').forEach(el=>el.onchange=()=>{const [vi,fi]=el.dataset.simpleFamily.split(':').map(Number);if(state.simpleVariants[vi]?.foods[fi])state.simpleVariants[vi].foods[fi].slot_family=el.value;markPlanStale();});
    box.querySelectorAll('[data-simple-search-btn]').forEach(btn=>btn.onclick=()=>{const vi=Number(btn.dataset.simpleSearchBtn),input=box.querySelector(`[data-simple-search="${vi}"]`),res=box.querySelector(`[data-simple-results="${vi}"]`);searchSimpleFood(vi,input?.value||'',res);});
    box.querySelectorAll('[data-simple-search]').forEach(input=>input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const vi=Number(input.dataset.simpleSearch),res=box.querySelector(`[data-simple-results="${vi}"]`);searchSimpleFood(vi,input.value||'',res);}}));
  }

  function markPlanStale(){
    state.lastPlan=null;
    const box=byId('adapterFormulaInferencePreview');if(box)box.innerHTML='<p class="admin-note">Structure à vérifier avant publication.</p>';
  }

  function commonPayload(){
    return {
      id:state.id,
      title:byId('adapterFormulaTitle')?.value.trim(),
      public_label:byId('adapterFormulaLabel')?.value.trim(),
      priority:Number(byId('adapterFormulaPriority')?.value||100),
      meal_types:list(byId('adapterFormulaMealTypes')?.value),
      tags:list(byId('adapterFormulaTags')?.value),
      enabled:byId('adapterFormulaEnabled')?.checked!==false,
      trigger_profile_keys:state.triggers.map(x=>x.profile_key)
    };
  }

  function simplePayload(){
    return {...commonPayload(),variants:state.simpleVariants.map(v=>({
      goal:v.goal,
      foods:v.foods.map(x=>({
        profile_key:x.profile_key,
        display_name:x.display_name,
        slot_family:x.slot_family||null,
        slot_families:x.slot_families||[]
      }))
    }))};
  }

  function validateSimplePayload(p){
    if(!p.title||!p.public_label)return 'Renseigne le nom et le libellé affiché.';
    if(!p.trigger_profile_keys.length)return 'Choisis au moins un aliment déclencheur.';
    if(!p.variants.length)return 'Ajoute au moins une variante.';
    if(p.variants.some(v=>!v.foods.length))return 'Chaque variante doit contenir au moins un aliment.';
    return '';
  }

  async function previewSimplePlan(){
    const p=simplePayload(),err=validateSimplePayload(p);if(err){status(err,true);return null;}
    const box=byId('adapterFormulaInferencePreview');if(box)box.innerHTML='<p>TEE analyse les aliments sélectionnés…</p>';
    try{
      const plan=await rpc('mt_admin_infer_simple_formula_v2',{p_payload:p});state.lastPlan=plan;
      if(!plan?.valid){
        const errors=plan?.errors||[];
        if(box)box.innerHTML=`<div class="admin-type-guide"><b>Structure à corriger</b><br>${errors.map(x=>esc(x.message||x.code)).join('<br>')}</div>`;
        status(errors[0]?.message||'La structure doit être corrigée.',true);return null;
      }
      const slots=plan.slots||[];
      if(box)box.innerHTML=`<div class="admin-type-guide"><b>✓ TEE a construit la formule automatiquement</b><br>${slots.map(s=>`<span style="display:inline-block;margin:4px 6px 0 0;padding:5px 8px;border-radius:999px;background:rgba(15,45,31,.08)">${esc(s.slot_label)} · ${Array.isArray(s.allowed_profile_keys)?s.allowed_profile_keys.length:0} aliment(s) exact(s)</span>`).join('')}<br><small>${plan.variant_count||0} variante(s) · ${plan.slot_count||0} composant(s). Les whitelists exactes seront publiées dans CP495.</small></div>`;
      status('Structure valide. Tu peux publier.');return plan;
    }catch(e){if(box)box.innerHTML=`<p>${esc(e.message)}</p>`;status(e.message,true);return null;}
  }

  async function saveSimpleFormula(publish){
    const p=simplePayload(),err=validateSimplePayload(p);if(err){status(err,true);return null;}
    status(publish?'TEE construit puis publie la formule…':'TEE construit puis enregistre le brouillon…');
    try{
      const result=await rpc('mt_admin_save_simple_adapter_formula_v2',{p_payload:p,p_publish:publish});
      state.id=result?.formula_id||state.id;if(byId('adapterFormulaId'))byId('adapterFormulaId').value=state.id||'';
      state.lastPlan=result?.plan||null;
      status(publish?'Formule publiée. Les rôles, slots, whitelists exactes et variantes sont connectés automatiquement au moteur.':'Brouillon enregistré.');
      await loadAdapterFormulaAdmin();return result;
    }catch(e){status(e.message,true);return null;}
  }

  // -------------------------------------------------------------------------
  // Mode avancé historique : conservé pour les exceptions
  // -------------------------------------------------------------------------
  function addSlot(data={}){
    state.slots.push({uid:uid(),slot_code:data.slot_code||`slot_${state.slots.length+1}`,slot_label:data.slot_label||'',accept_component_keys:[...(data.accept_component_keys||[])],required:data.required!==false});
    state.variants.forEach(v=>v.picks.push(null));renderSlots();renderVariants();
  }
  function renderSlots(){
    const box=byId('adapterFormulaSlots');if(!box)return;
    box.innerHTML=state.slots.map((s,i)=>`<article class="admin-item" style="display:block"><div class="admin-grid"><label>Nom du composant<input data-slot-label="${i}" value="${esc(s.slot_label)}" placeholder="Végétal"></label><label>Code<input data-slot-code="${i}" value="${esc(s.slot_code)}" placeholder="vegetable_side"></label></div><label>Capacités acceptées</label><select multiple size="6" data-slot-components="${i}">${options(s.accept_component_keys)}</select><label><input type="checkbox" data-slot-required="${i}" ${s.required?'checked':''}> Obligatoire</label><button type="button" class="ghost-btn" data-remove-slot="${i}">Supprimer ce composant</button></article>`).join('')||'<p class="admin-note">Mode avancé : configure manuellement les slots si tu as un cas que TEE ne peut pas inférer proprement.</p>';
    box.querySelectorAll('[data-slot-label]').forEach(el=>el.oninput=()=>state.slots[Number(el.dataset.slotLabel)].slot_label=el.value);
    box.querySelectorAll('[data-slot-code]').forEach(el=>el.oninput=()=>state.slots[Number(el.dataset.slotCode)].slot_code=el.value);
    box.querySelectorAll('[data-slot-components]').forEach(el=>el.onchange=()=>state.slots[Number(el.dataset.slotComponents)].accept_component_keys=[...el.selectedOptions].map(o=>o.value));
    box.querySelectorAll('[data-slot-required]').forEach(el=>el.onchange=()=>state.slots[Number(el.dataset.slotRequired)].required=el.checked);
    box.querySelectorAll('[data-remove-slot]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.removeSlot);state.slots.splice(i,1);state.variants.forEach(v=>v.picks.splice(i,1));renderSlots();renderVariants();});
  }
  function addVariant(data={}){
    const picks=(data.profile_keys||[]).map(k=>k?{profile_key:k,display_name:k}:null);while(picks.length<state.slots.length)picks.push(null);
    state.variants.push({uid:uid(),goal:data.goal||'autre',picks:picks.slice(0,state.slots.length)});renderVariants();
  }
  async function searchVariant(vIndex,sIndex,query,resultBox){
    if(!query.trim())return;resultBox.innerHTML='<p>Recherche…</p>';
    try{
      const rows=await searchProfiles(query,state.slots[sIndex]?.accept_component_keys||[]);
      resultBox.innerHTML=(rows||[]).map((x,i)=>`<article class="admin-item"><div><b>${esc(x.display_name)}</b><small>Fiche exacte</small></div><button type="button" data-pick-result="${i}">Choisir</button></article>`).join('')||'<p>Aucun profil compatible.</p>';
      resultBox.querySelectorAll('[data-pick-result]').forEach(b=>b.onclick=()=>{const x=rows[Number(b.dataset.pickResult)];state.variants[vIndex].picks[sIndex]={profile_key:x.profile_key,display_name:x.display_name};renderVariants();});
    }catch(e){resultBox.innerHTML=`<p>${esc(e.message)}</p>`;}
  }
  function renderVariants(){
    const box=byId('adapterFormulaVariants');if(!box)return;
    box.innerHTML=state.variants.map((v,vi)=>`<article class="admin-item" style="display:block"><div class="admin-grid"><label>Intention<select data-variant-goal="${vi}">${goalOptions(v.goal)}</select></label><div><button type="button" class="ghost-btn" data-remove-variant="${vi}">Supprimer la variante</button></div></div>${state.slots.map((s,si)=>{const pick=v.picks[si];return `<div style="margin:12px 0;padding:10px;border:1px solid rgba(15,45,31,.12);border-radius:14px"><b>${esc(s.slot_label||`Composant ${si+1}`)}</b><div>${pick?`<small>Choisi : ${esc(pick.display_name||pick.profile_key)}</small>`:'<small>Aucun aliment choisi</small>'}</div><div class="admin-grid"><input data-variant-search="${vi}:${si}" placeholder="Chercher un aliment compatible"><button type="button" class="ghost-btn" data-variant-search-btn="${vi}:${si}">Chercher</button></div><div class="admin-list" data-variant-results="${vi}:${si}"></div></div>`}).join('')}</article>`).join('')||'<p class="admin-note">Ajoute les variantes avancées.</p>';
    box.querySelectorAll('[data-variant-goal]').forEach(el=>el.onchange=()=>state.variants[Number(el.dataset.variantGoal)].goal=el.value);
    box.querySelectorAll('[data-remove-variant]').forEach(el=>el.onclick=()=>{state.variants.splice(Number(el.dataset.removeVariant),1);renderVariants();});
    box.querySelectorAll('[data-variant-search-btn]').forEach(btn=>btn.onclick=()=>{const [vi,si]=btn.dataset.variantSearchBtn.split(':').map(Number);const input=box.querySelector(`[data-variant-search="${vi}:${si}"]`),res=box.querySelector(`[data-variant-results="${vi}:${si}"]`);searchVariant(vi,si,input?.value||'',res);});
  }

  function advancedPayload(){
    const counts={};return {...commonPayload(),
      slots:state.slots.map((s,i)=>({slot_code:s.slot_code||`slot_${i+1}`,slot_label:s.slot_label||`Élément ${i+1}`,accept_component_keys:s.accept_component_keys,required:s.required})),
      variants:state.variants.map(v=>{counts[v.goal]=(counts[v.goal]||0)+1;return {goal:v.goal,variant_no:counts[v.goal],profile_keys:v.picks.map(x=>x?.profile_key||'')}}),goal_bias:{}
    };
  }
  function validateAdvancedPayload(p){
    if(!p.title||!p.public_label)return 'Renseigne le nom et le libellé.';
    if(!p.trigger_profile_keys.length)return 'Choisis au moins un aliment déclencheur.';
    if(!p.slots.length)return 'Ajoute au moins un composant à la formule.';
    if(p.slots.some(s=>!s.accept_component_keys.length))return 'Chaque composant doit accepter au moins une capacité.';
    if(!p.variants.length)return 'Ajoute au moins une variante.';
    if(p.variants.some(v=>v.profile_keys.length!==p.slots.length||v.profile_keys.some(x=>!x)))return 'Chaque variante doit contenir un aliment exact pour chaque composant.';
    return '';
  }
  async function saveAdvancedFormula(publish){
    const p=advancedPayload(),err=validateAdvancedPayload(p);if(err){status(err,true);return null;}
    status(publish?'Validation et publication avancée…':'Sauvegarde du brouillon avancé…');
    try{
      const id=await rpc('mt_admin_save_adapter_formula_v1',{p_payload:p});state.id=id;if(byId('adapterFormulaId'))byId('adapterFormulaId').value=id;
      if(publish)await rpc('mt_admin_publish_adapter_formula_v1',{p_formula_id:id,p_publish:true});
      status(publish?'Formule avancée publiée.':'Brouillon avancé enregistré.');await loadAdapterFormulaAdmin();return id;
    }catch(e){status(e.message,true);return null;}
  }

  // -------------------------------------------------------------------------
  // Formulaire / édition
  // -------------------------------------------------------------------------
  function setBuilderMode(mode){
    state.builderMode=mode==='advanced'?'advanced':'simple';
    const advanced=byId('adapterFormulaAdvancedMode');if(advanced)advanced.checked=state.builderMode==='advanced';
    const simpleBox=byId('adapterFormulaSimpleBuilder');if(simpleBox)simpleBox.hidden=state.builderMode==='advanced';
    const advancedBox=byId('adapterFormulaAdvancedBuilder');if(advancedBox)advancedBox.hidden=state.builderMode!=='advanced';
  }

  function resetFormula(){
    state.id=null;state.triggers=[];state.slots=[];state.variants=[];state.simpleVariants=[];state.lastPlan=null;
    byId('adapterFormulaAdminForm')?.reset();if(byId('adapterFormulaPriority'))byId('adapterFormulaPriority').value='100';if(byId('adapterFormulaEnabled'))byId('adapterFormulaEnabled').checked=true;if(byId('adapterFormulaId'))byId('adapterFormulaId').value='';
    setBuilderMode('simple');renderTriggers();renderSlots();renderVariants();addSimpleVariant({goal:'autre'});status('');markPlanStale();
  }

  async function saveFormula(publish){return state.builderMode==='advanced'?saveAdvancedFormula(publish):saveSimpleFormula(publish);}

  async function loadAdapterFormulaAdmin(){
    const box=byId('adapterFormulaAdminList');if(!box)return;
    try{
      let rows;try{rows=await rpc('mt_admin_list_adapter_formulas_v2');}catch(e){rows=await rpc('mt_admin_list_adapter_formulas_v1');}
      box.innerHTML=(rows||[]).map(x=>`<article class="admin-item"><div><b>${esc(x.title)}</b><small>${x.trigger_count} déclencheur(s) · ${x.published?'Publié':'Brouillon'} · ${x.enabled?'Actif':'Désactivé'} · ${x.builder_mode==='simple'?'Création simple':'Avancé'}</small></div><div><button type="button" data-edit-formula="${x.id}">Modifier</button>${x.published?`<button type="button" class="ghost-btn" data-unpublish-formula="${x.id}">Dépublier</button>`:''}</div></article>`).join('')||'<p>Aucune formule admin.</p>';
      box.querySelectorAll('[data-edit-formula]').forEach(b=>b.onclick=()=>editFormula(b.dataset.editFormula));
      box.querySelectorAll('[data-unpublish-formula]').forEach(b=>b.onclick=()=>unpublishFormula(b.dataset.unpublishFormula));
    }catch(e){box.innerHTML=`<p>${esc(e.message)}</p>`;}
  }

  async function editFormula(id){
    try{
      let x;try{x=await rpc('mt_admin_get_adapter_formula_v2',{p_formula_id:id});}catch(e){x=await rpc('mt_admin_get_adapter_formula_v1',{p_formula_id:id});}
      if(!x)return;
      state.id=x.id;state.triggers=x.triggers||[];state.slots=(x.slots||[]).map(s=>({...s,uid:uid()}));state.variants=(x.variants||[]).map(v=>({uid:uid(),goal:v.goal,picks:(v.profile_keys||[]).map(k=>({profile_key:k,display_name:k}))}));
      byId('adapterFormulaId').value=x.id;byId('adapterFormulaTitle').value=x.title||'';byId('adapterFormulaLabel').value=x.public_label||'';byId('adapterFormulaPriority').value=x.priority||100;byId('adapterFormulaMealTypes').value=(x.meal_types||[]).join(', ');byId('adapterFormulaTags').value=(x.tags||[]).join(', ');byId('adapterFormulaEnabled').checked=x.enabled!==false;
      const mode=x.builder_mode==='simple'?'simple':'advanced';setBuilderMode(mode);
      if(mode==='simple'){
        const snap=x.simple_snapshot||{};
        state.simpleVariants=(snap.variants||[]).map(v=>({uid:uid(),goal:v.goal||'autre',foods:(v.foods||[]).map(food=>({profile_key:food.profile_key,display_name:food.display_name||food.profile_key,slot_family:food.slot_family||'',slot_families:food.slot_families||[],slot_family_details:food.slot_family_details||[]}))}));
        if(!state.simpleVariants.length)addSimpleVariant({goal:'autre'});else renderSimpleVariants();
        state.lastPlan={valid:true,slots:snap.generated_slots||[],signature:snap.signature||''};
      }
      renderTriggers();renderSlots();renderVariants();
      if(mode==='simple'&&state.lastPlan?.slots?.length){const box=byId('adapterFormulaInferencePreview');box.innerHTML=`<div class="admin-type-guide"><b>Structure enregistrée</b><br>${state.lastPlan.slots.map(s=>esc(s.slot_label)).join(' · ')}</div>`;}
      status(x.published?'Cette formule est publiée. Une nouvelle publication remplacera proprement sa version active.':'Brouillon chargé.');
      byId('adapterFormulaAdminForm')?.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){status(e.message,true);}
  }

  async function unpublishFormula(id){
    if(!confirm('Dépublier cette formule ? Les autres formules CP495 restent intactes.'))return;
    try{await rpc('mt_admin_publish_adapter_formula_v1',{p_formula_id:id,p_publish:false});await loadAdapterFormulaAdmin();status('Formule dépubliée.');}catch(e){status(e.message,true);}
  }

  window.loadAdapterFormulaAdmin=loadAdapterFormulaAdmin;
  window.mtAdapterFormulaEdit=editFormula;

  document.addEventListener('DOMContentLoaded',()=>{
    if(!byId('adapterFormulaAdminForm'))return;
    renderTriggers();renderSlots();renderVariants();if(!state.simpleVariants.length)addSimpleVariant({goal:'autre'});setBuilderMode('simple');
    byId('adapterFormulaTriggerSearchBtn')?.addEventListener('click',triggerSearch);
    byId('adapterFormulaTriggerSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();triggerSearch();}});
    byId('adapterFormulaAddSimpleVariant')?.addEventListener('click',()=>addSimpleVariant());
    byId('adapterFormulaPreviewSimple')?.addEventListener('click',previewSimplePlan);
    byId('adapterFormulaAdvancedMode')?.addEventListener('change',e=>setBuilderMode(e.target.checked?'advanced':'simple'));
    byId('adapterFormulaAddSlot')?.addEventListener('click',()=>addSlot());
    byId('adapterFormulaAddVariant')?.addEventListener('click',()=>addVariant());
    byId('adapterFormulaSaveDraft')?.addEventListener('click',()=>saveFormula(false));
    byId('adapterFormulaReset')?.addEventListener('click',resetFormula);
    byId('adapterFormulaAdminForm')?.addEventListener('submit',e=>{e.preventDefault();saveFormula(true);});
  });
})();
