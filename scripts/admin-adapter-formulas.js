(function(){
  'use strict';
  const COMPONENTS=['protein','protein_fish','protein_booster','egg','dairy','cheese','starch','grain','bread','wrap','pastry_base','vegetable','leafy','fruit','fat','fat_nut','condiment','sauce','aromatic_savory','aromatic_sweet','tomato','tomato_sauce','onion','chili','sweet','beverage','liquid','binder','flour','complete_dish','requires_preparation'];
  const GOALS=[['autre','Sans intention particulière'],['equilibre','Équilibre'],['digestion','Digestion'],['energie','Énergie'],['prise_masse','Nourrir & construire'],['perte_poids','Retrouver de la légèreté']];
  let seq=0;
  const uid=()=>`mtf_${Date.now()}_${++seq}`;
  const esc=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const list=s=>String(s||'').split(/[;,\n]/).map(x=>x.trim()).filter(Boolean);
  const state={id:null,triggers:[],slots:[],variants:[]};
  const byId=id=>document.getElementById(id);
  const status=(msg,bad=false)=>{const el=byId('adapterFormulaStatus');if(el){el.textContent=msg||'';el.style.color=bad?'#9f2d2d':'';}};

  async function rpc(name,args={}){
    const {data,error}=await initSupabase().rpc(name,args);if(error)throw error;return data;
  }
  async function searchProfiles(query,components=[]){
    return await rpc('mt_admin_adapter_profile_search_v1',{p_query:String(query||''),p_limit:16,p_component_keys:components.length?components:null});
  }
  function options(selected=[]){const set=new Set(selected||[]);return COMPONENTS.map(x=>`<option value="${x}" ${set.has(x)?'selected':''}>${x}</option>`).join('');}
  function goalOptions(selected){return GOALS.map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('');}

  function renderTriggers(){
    const box=byId('adapterFormulaTriggers');if(!box)return;
    box.innerHTML=state.triggers.length?state.triggers.map((x,i)=>`<article class="admin-item"><div><b>${esc(x.display_name||x.profile_key)}</b><small>${esc(x.profile_key)}</small></div><button type="button" data-remove-trigger="${i}">Retirer</button></article>`).join(''):'<p class="admin-note">Aucun déclencheur choisi.</p>';
    box.querySelectorAll('[data-remove-trigger]').forEach(b=>b.onclick=()=>{state.triggers.splice(Number(b.dataset.removeTrigger),1);renderTriggers();});
  }
  async function triggerSearch(){
    const q=byId('adapterFormulaTriggerSearch')?.value.trim();if(!q)return;
    const box=byId('adapterFormulaTriggerResults');box.innerHTML='<p>Recherche…</p>';
    try{
      const rows=await searchProfiles(q);box.innerHTML=(rows||[]).map((x,i)=>`<article class="admin-item"><div><b>${esc(x.display_name)}</b><small>${esc(x.profile_key)} · ${(x.components||[]).map(esc).join(', ')}</small></div><button type="button" data-trigger-result="${i}">Ajouter</button></article>`).join('')||'<p>Aucun profil exact.</p>';
      box.querySelectorAll('[data-trigger-result]').forEach(b=>b.onclick=()=>{const x=rows[Number(b.dataset.triggerResult)];if(!state.triggers.some(t=>t.profile_key===x.profile_key))state.triggers.push({profile_key:x.profile_key,display_name:x.display_name});renderTriggers();});
    }catch(e){box.innerHTML=`<p>${esc(e.message)}</p>`;}
  }

  function addSlot(data={}){
    state.slots.push({uid:uid(),slot_code:data.slot_code||`slot_${state.slots.length+1}`,slot_label:data.slot_label||'',accept_component_keys:[...(data.accept_component_keys||[])],required:data.required!==false});
    state.variants.forEach(v=>v.picks.push(null));renderSlots();renderVariants();
  }
  function renderSlots(){
    const box=byId('adapterFormulaSlots');if(!box)return;
    box.innerHTML=state.slots.map((s,i)=>`<article class="admin-item" style="display:block"><div class="admin-grid"><label>Nom du composant<input data-slot-label="${i}" value="${esc(s.slot_label)}" placeholder="Végétal"></label><label>Code<input data-slot-code="${i}" value="${esc(s.slot_code)}" placeholder="vegetable_side"></label></div><label>Capacités acceptées</label><select multiple size="6" data-slot-components="${i}">${options(s.accept_component_keys)}</select><label><input type="checkbox" data-slot-required="${i}" ${s.required?'checked':''}> Obligatoire</label><button type="button" class="ghost-btn" data-remove-slot="${i}">Supprimer ce composant</button></article>`).join('')||'<p class="admin-note">Ajoute les composants attendus par la formule. Ex. féculent, végétal, assaisonnement.</p>';
    box.querySelectorAll('[data-slot-label]').forEach(el=>el.oninput=()=>state.slots[Number(el.dataset.slotLabel)].slot_label=el.value);
    box.querySelectorAll('[data-slot-code]').forEach(el=>el.oninput=()=>state.slots[Number(el.dataset.slotCode)].slot_code=el.value);
    box.querySelectorAll('[data-slot-components]').forEach(el=>el.onchange=()=>state.slots[Number(el.dataset.slotComponents)].accept_component_keys=[...el.selectedOptions].map(o=>o.value));
    box.querySelectorAll('[data-slot-required]').forEach(el=>el.onchange=()=>state.slots[Number(el.dataset.slotRequired)].required=el.checked);
    box.querySelectorAll('[data-remove-slot]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.removeSlot);state.slots.splice(i,1);state.variants.forEach(v=>v.picks.splice(i,1));renderSlots();renderVariants();});
  }

  function addVariant(data={}){
    const picks=(data.profile_keys||[]).map(k=>k?{profile_key:k,display_name:k}:null);
    while(picks.length<state.slots.length)picks.push(null);
    state.variants.push({uid:uid(),goal:data.goal||'autre',picks:picks.slice(0,state.slots.length)});renderVariants();
  }
  async function searchVariant(vIndex,sIndex,query,resultBox){
    if(!query.trim())return;
    resultBox.innerHTML='<p>Recherche…</p>';
    try{
      const rows=await searchProfiles(query,state.slots[sIndex]?.accept_component_keys||[]);
      resultBox.innerHTML=(rows||[]).map((x,i)=>`<article class="admin-item"><div><b>${esc(x.display_name)}</b><small>${esc(x.profile_key)}</small></div><button type="button" data-pick-result="${i}">Choisir</button></article>`).join('')||'<p>Aucun profil compatible.</p>';
      resultBox.querySelectorAll('[data-pick-result]').forEach(b=>b.onclick=()=>{const x=rows[Number(b.dataset.pickResult)];state.variants[vIndex].picks[sIndex]={profile_key:x.profile_key,display_name:x.display_name};renderVariants();});
    }catch(e){resultBox.innerHTML=`<p>${esc(e.message)}</p>`;}
  }
  function renderVariants(){
    const box=byId('adapterFormulaVariants');if(!box)return;
    box.innerHTML=state.variants.map((v,vi)=>`<article class="admin-item" style="display:block"><div class="admin-grid"><label>Intention<select data-variant-goal="${vi}">${goalOptions(v.goal)}</select></label><div><button type="button" class="ghost-btn" data-remove-variant="${vi}">Supprimer la variante</button></div></div>${state.slots.map((s,si)=>{const pick=v.picks[si];return `<div style="margin:12px 0;padding:10px;border:1px solid rgba(15,45,31,.12);border-radius:14px"><b>${esc(s.slot_label||`Composant ${si+1}`)}</b><div>${pick?`<small>Choisi : ${esc(pick.display_name||pick.profile_key)} · ${esc(pick.profile_key)}</small>`:'<small>Aucun aliment choisi</small>'}</div><div class="admin-grid"><input data-variant-search="${vi}:${si}" placeholder="Chercher un aliment compatible"><button type="button" class="ghost-btn" data-variant-search-btn="${vi}:${si}">Chercher</button></div><div class="admin-list" data-variant-results="${vi}:${si}"></div></div>`}).join('')}</article>`).join('')||'<p class="admin-note">Ajoute plusieurs variantes, y compris plusieurs fois pour la même intention. La rotation utilisera ensuite le bundle complet.</p>';
    box.querySelectorAll('[data-variant-goal]').forEach(el=>el.onchange=()=>state.variants[Number(el.dataset.variantGoal)].goal=el.value);
    box.querySelectorAll('[data-remove-variant]').forEach(el=>el.onclick=()=>{state.variants.splice(Number(el.dataset.removeVariant),1);renderVariants();});
    box.querySelectorAll('[data-variant-search-btn]').forEach(btn=>btn.onclick=()=>{const [vi,si]=btn.dataset.variantSearchBtn.split(':').map(Number);const input=box.querySelector(`[data-variant-search="${vi}:${si}"]`),res=box.querySelector(`[data-variant-results="${vi}:${si}"]`);searchVariant(vi,si,input?.value||'',res);});
  }

  function resetFormula(){
    state.id=null;state.triggers=[];state.slots=[];state.variants=[];
    byId('adapterFormulaAdminForm')?.reset();if(byId('adapterFormulaPriority'))byId('adapterFormulaPriority').value='100';if(byId('adapterFormulaEnabled'))byId('adapterFormulaEnabled').checked=true;if(byId('adapterFormulaId'))byId('adapterFormulaId').value='';
    renderTriggers();renderSlots();renderVariants();status('');
  }
  function payload(){
    const counts={};
    return {
      id:state.id,title:byId('adapterFormulaTitle')?.value.trim(),public_label:byId('adapterFormulaLabel')?.value.trim(),priority:Number(byId('adapterFormulaPriority')?.value||100),
      meal_types:list(byId('adapterFormulaMealTypes')?.value),tags:list(byId('adapterFormulaTags')?.value),enabled:byId('adapterFormulaEnabled')?.checked!==false,
      trigger_profile_keys:state.triggers.map(x=>x.profile_key),
      slots:state.slots.map((s,i)=>({slot_code:s.slot_code||`slot_${i+1}`,slot_label:s.slot_label||`Élément ${i+1}`,accept_component_keys:s.accept_component_keys,required:s.required})),
      variants:state.variants.map(v=>{counts[v.goal]=(counts[v.goal]||0)+1;return {goal:v.goal,variant_no:counts[v.goal],profile_keys:v.picks.map(x=>x?.profile_key||'')}}),goal_bias:{}
    };
  }
  function validatePayload(p){
    if(!p.title||!p.public_label)return 'Renseigne le nom et le libellé.';
    if(!p.trigger_profile_keys.length)return 'Choisis au moins un aliment déclencheur.';
    if(!p.slots.length)return 'Ajoute au moins un composant à la formule.';
    if(p.slots.some(s=>!s.accept_component_keys.length))return 'Chaque composant doit accepter au moins une capacité.';
    if(!p.variants.length)return 'Ajoute au moins une variante.';
    if(p.variants.some(v=>v.profile_keys.length!==p.slots.length||v.profile_keys.some(x=>!x)))return 'Chaque variante doit contenir un aliment exact pour chaque composant.';
    return '';
  }
  async function saveFormula(publish){
    const p=payload(),err=validatePayload(p);if(err){status(err,true);return null;}
    status(publish?'Validation et publication…':'Sauvegarde du brouillon…');
    try{
      const id=await rpc('mt_admin_save_adapter_formula_v1',{p_payload:p});state.id=id;byId('adapterFormulaId').value=id;
      if(publish)await rpc('mt_admin_publish_adapter_formula_v1',{p_formula_id:id,p_publish:true});
      status(publish?'Formule publiée. Elle est utilisable immédiatement par Adapter.':'Brouillon enregistré.');await loadAdapterFormulaAdmin();return id;
    }catch(e){status(e.message,true);return null;}
  }
  async function loadAdapterFormulaAdmin(){
    const box=byId('adapterFormulaAdminList');if(!box)return;
    try{
      const rows=await rpc('mt_admin_list_adapter_formulas_v1');
      box.innerHTML=(rows||[]).map(x=>`<article class="admin-item"><div><b>${esc(x.title)}</b><small>${x.trigger_count} déclencheur(s) · ${x.published?'Publié':'Brouillon'} · ${x.enabled?'Actif':'Désactivé'}</small></div><div><button type="button" data-edit-formula="${x.id}">Modifier</button>${x.published?`<button type="button" class="ghost-btn" data-unpublish-formula="${x.id}">Dépublier</button>`:''}</div></article>`).join('')||'<p>Aucune formule admin.</p>';
      box.querySelectorAll('[data-edit-formula]').forEach(b=>b.onclick=()=>editFormula(b.dataset.editFormula));
      box.querySelectorAll('[data-unpublish-formula]').forEach(b=>b.onclick=()=>unpublishFormula(b.dataset.unpublishFormula));
    }catch(e){box.innerHTML=`<p>${esc(e.message)}</p>`;}
  }
  async function editFormula(id){
    try{
      const x=await rpc('mt_admin_get_adapter_formula_v1',{p_formula_id:id});if(!x)return;
      state.id=x.id;state.triggers=x.triggers||[];state.slots=(x.slots||[]).map(s=>({...s,uid:uid()}));state.variants=(x.variants||[]).map(v=>({uid:uid(),goal:v.goal,picks:(v.profile_keys||[]).map(k=>({profile_key:k,display_name:k}))}));
      byId('adapterFormulaId').value=x.id;byId('adapterFormulaTitle').value=x.title||'';byId('adapterFormulaLabel').value=x.public_label||'';byId('adapterFormulaPriority').value=x.priority||100;byId('adapterFormulaMealTypes').value=(x.meal_types||[]).join(', ');byId('adapterFormulaTags').value=(x.tags||[]).join(', ');byId('adapterFormulaEnabled').checked=x.enabled!==false;
      renderTriggers();renderSlots();renderVariants();status(x.published?'Cette formule est publiée. Une nouvelle publication remplacera proprement sa version active.':'Brouillon chargé.');
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
    renderTriggers();renderSlots();renderVariants();
    byId('adapterFormulaTriggerSearchBtn')?.addEventListener('click',triggerSearch);
    byId('adapterFormulaTriggerSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();triggerSearch();}});
    byId('adapterFormulaAddSlot')?.addEventListener('click',()=>addSlot());
    byId('adapterFormulaAddVariant')?.addEventListener('click',()=>addVariant());
    byId('adapterFormulaSaveDraft')?.addEventListener('click',()=>saveFormula(false));
    byId('adapterFormulaReset')?.addEventListener('click',resetFormula);
    byId('adapterFormulaAdminForm')?.addEventListener('submit',e=>{e.preventDefault();saveFormula(true);});
  });
})();
