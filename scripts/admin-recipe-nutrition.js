(function(){
  'use strict';
  let items=[],searchRows=[],timer=0,seq=0;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sb=()=>window.initSupabase?.();
  function style(){if($('mtRecipeNutritionAdminStyle'))return;const s=document.createElement('style');s.id='mtRecipeNutritionAdminStyle';s.textContent=`
    .mt-recipe-structured-admin{margin:18px 0;padding:16px;border:1px solid rgba(15,45,31,.16);border-radius:18px;background:#fbfaf5}
    .mt-recipe-structured-admin h3{margin:0 0 6px;color:#0f2d1f}.mt-recipe-structured-admin>p{margin:0 0 12px;color:#69645d;font-size:13px;line-height:1.45}
    .mt-rn-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mt-rn-search{position:relative}.mt-rn-results{display:grid;gap:6px;margin:8px 0 12px}.mt-rn-results button{text-align:left;padding:10px 12px;border:1px solid #ded8cb;border-radius:12px;background:#fff;color:#0f2d1f}
    .mt-rn-items{display:grid;gap:8px;margin:10px 0}.mt-rn-item{display:grid;grid-template-columns:minmax(0,1fr) 92px auto;gap:8px;align-items:center;padding:10px;border-radius:14px;background:#fff;border:1px solid #e3ded2}.mt-rn-item b,.mt-rn-item small{display:block}.mt-rn-item small{color:#777066;margin-top:2px}.mt-rn-item input[type=number]{margin:0}.mt-rn-remove{width:34px;height:34px;padding:0;border-radius:50%;background:#f6f1e8;color:#6b6257;border:0}
    .mt-rn-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.mt-rn-actions button{width:auto}.mt-rn-status{font-size:12px;color:#6f695f;margin-top:9px}.mt-rn-snapshot{margin-top:12px;padding:12px;border-radius:14px;background:#f1f5f0;color:#0f2d1f;font-size:13px}
    @media(max-width:520px){.mt-rn-grid{grid-template-columns:1fr}.mt-rn-item{grid-template-columns:minmax(0,1fr) 82px auto}}
  `;document.head.appendChild(s);}
  function inject(){
    if($('mtRecipeStructuredNutrition'))return;
    const form=$('recipeForm'),anchor=form?.querySelector('.recipe-nutrition-admin');if(!form||!anchor)return;
    const box=document.createElement('section');box.id='mtRecipeStructuredNutrition';box.className='mt-recipe-structured-admin';box.innerHTML=`
      <h3>Calcul nutritionnel automatique</h3>
      <p>Ajoute les ingrédients réellement utilisés et leur poids. La nutrition de la recette et d’une portion sera recalculée depuis les références documentées. Une valeur absente restera non documentée.</p>
      <div class="mt-rn-grid"><label>Nombre de portions<input id="mtRecipeNutritionServings" type="number" min="0.25" step="0.25" value="1"></label><label>Nom d’une portion<input id="mtRecipeNutritionServingLabel" value="1 portion" placeholder="1 portion"></label></div>
      <div class="mt-rn-grid"><label>Poids final préparé <small>facultatif</small><input id="mtRecipeYieldWeight" type="number" min="1" step="1" placeholder="Ex. 820"><small>g après cuisson / préparation</small></label><label>Base du poids<select id="mtRecipeYieldBasis"><option value="measured">Poids réellement pesé</option><option value="estimated">Poids estimé</option></select></label></div>
      <label>Méthode de préparation <small>facultatif</small><input id="mtRecipeYieldMethod" placeholder="Ex. poêle, four, sans cuisson…"></label>
      <p class="admin-note">Le poids final affine le poids d’une portion et le repère pour 100 g préparés. Il ne sert pas à inventer des pertes vitaminiques ou une absorption d’huile.</p>
      <label>Rechercher un ingrédient<input id="mtRecipeNutritionSearch" type="search" autocomplete="off" placeholder="Ex. poulet, champignon, skyr…"></label>
      <div id="mtRecipeNutritionResults" class="mt-rn-results"></div>
      <div id="mtRecipeNutritionItems" class="mt-rn-items"></div>
      <div class="mt-rn-actions"><button type="button" id="mtRecipeNutritionSave">Calculer & enregistrer</button><button type="button" class="ghost-btn" id="mtRecipeNutritionClear">Retirer le calcul structuré</button></div>
      <div id="mtRecipeNutritionStatus" class="mt-rn-status">Pour une nouvelle recette : enregistre d’abord la fiche, puis ouvre « Modifier » pour renseigner ses ingrédients structurés.</div>
      <div id="mtRecipeNutritionSnapshot" class="mt-rn-snapshot" hidden></div>`;
    anchor.insertAdjacentElement('afterend',box);
    bind();render();
  }
  async function searchFoods(q){
    const client=sb();if(!client||q.trim().length<3)return [];
    let out=await client.rpc('mt_recipe_ingredient_search',{p_query:q.trim(),p_limit:8});
    if(!out.error)return (Array.isArray(out.data)?out.data:[]).map(r=>({code:r.ciqual_code||null,dictionary_id:r.dictionary_id||null,display_name:r.display_name,name:r.display_name,reference_kind:r.reference_kind,source_label:r.source_label}));
    // Fallback conservateur si le front précède la migration : CIQUAL uniquement.
    out=await client.rpc('search_foods_v4',{p_query:q.trim(),p_limit:8});
    if(out.error)throw out.error;return (Array.isArray(out.data)?out.data:[]).filter(r=>!!r.code);
  }
  function renderResults(){const box=$('mtRecipeNutritionResults');if(!box)return;box.innerHTML=searchRows.map((r,i)=>`<button type="button" data-mt-rn-result="${i}"><b>${esc(r.display_name||r.name)}</b><small>Ajouter à la recette</small></button>`).join('');box.querySelectorAll('[data-mt-rn-result]').forEach(b=>b.onclick=()=>{const r=searchRows[Number(b.dataset.mtRnResult)],name=r.display_name||r.name;if(!r)return;if(!items.some(x=>(r.code&&x.ciqual_code===r.code)||(r.dictionary_id&&x.dictionary_id===r.dictionary_id)))items.push({ingredient_name:name,ciqual_code:r.code||null,dictionary_id:r.dictionary_id||null,quantity_g:100,optional:false,included_in_reference:true});searchRows=[];$('mtRecipeNutritionSearch').value='';renderResults();render();});}
  function render(){const box=$('mtRecipeNutritionItems');if(!box)return;box.innerHTML=items.length?items.map((x,i)=>`<div class="mt-rn-item"><div><b>${esc(x.ingredient_name)}</b><small>${x.included_in_reference===false?'Hors calcul de référence':'Inclus dans le calcul'}</small><label style="display:flex;align-items:center;gap:6px;margin-top:5px;font-size:11px"><input type="checkbox" data-mt-rn-include="${i}" ${x.included_in_reference===false?'':'checked'}> Inclure</label></div><label><input type="number" min="0.1" step="0.1" value="${Number(x.quantity_g)||100}" data-mt-rn-grams="${i}"><small>g</small></label><button type="button" class="mt-rn-remove" data-mt-rn-remove="${i}" aria-label="Retirer">×</button></div>`).join(''):'<p class="admin-note">Aucun ingrédient structuré pour le moment.</p>';
    box.querySelectorAll('[data-mt-rn-grams]').forEach(el=>el.onchange=()=>{items[Number(el.dataset.mtRnGrams)].quantity_g=Math.max(.1,Number(el.value)||.1);});
    box.querySelectorAll('[data-mt-rn-include]').forEach(el=>el.onchange=()=>{items[Number(el.dataset.mtRnInclude)].included_in_reference=el.checked;render();});
    box.querySelectorAll('[data-mt-rn-remove]').forEach(el=>el.onclick=()=>{items.splice(Number(el.dataset.mtRnRemove),1);render();});
  }
  function snapshotText(s){const c=s?.core||{};const parts=[];if(c.kcal!=null)parts.push(`${Math.round(Number(c.kcal))} kcal`);if(c.protein_g!=null)parts.push(`${Number(c.protein_g).toLocaleString('fr-FR',{maximumFractionDigits:1})} g protéines`);if(c.carbs_g!=null)parts.push(`${Number(c.carbs_g).toLocaleString('fr-FR',{maximumFractionDigits:1})} g glucides`);if(c.fat_g!=null)parts.push(`${Number(c.fat_g).toLocaleString('fr-FR',{maximumFractionDigits:1})} g lipides`);return parts.join(' · ');}
  async function load(recipeId){
    items=[];render();const snap=$('mtRecipeNutritionSnapshot');if(snap)snap.hidden=true;
    if(!recipeId)return;
    const client=sb();if(!client)return;
    try{const {data,error}=await client.rpc('mt_get_recipe_nutrition_admin',{p_recipe_id:recipeId});if(error)throw error;const profile=data?.profile||{},yieldData=data?.yield||{};items=Array.isArray(data?.items)?data.items.map(x=>({...x})):[];$('mtRecipeNutritionServings').value=Number(profile.servings)||1;$('mtRecipeNutritionServingLabel').value=profile.serving_label||'1 portion';if($('mtRecipeYieldWeight'))$('mtRecipeYieldWeight').value=yieldData.final_weight_g??'';if($('mtRecipeYieldBasis'))$('mtRecipeYieldBasis').value=yieldData.weight_basis||'measured';if($('mtRecipeYieldMethod'))$('mtRecipeYieldMethod').value=yieldData.preparation_method||'';render();if(data?.snapshot&&snap){snap.hidden=false;const pw=Number(data.snapshot.portion_weight_g);snap.textContent=`Calcul actuel · ${snapshotText(data.snapshot) || 'repères partiels'}${Number.isFinite(pw)?` · ≈ ${pw.toLocaleString('fr-FR',{maximumFractionDigits:0})} g / portion`:''}`;}$('mtRecipeNutritionStatus').textContent=items.length?'Nutrition structurée chargée. Tu peux modifier les grammes puis recalculer.':'Cette recette n’a pas encore de calcul structuré.';}catch(e){console.warn('recipe nutrition admin load',e);$('mtRecipeNutritionStatus').textContent='Calcul structuré indisponible tant que les migrations V411.2/V411.3 ne sont pas installées.';}
  }
  async function save(){
    const recipeId=$('recipeId')?.value;if(!recipeId){alert('Enregistre d’abord la recette, puis ouvre-la avec « Modifier » pour ajouter son calcul nutritionnel.');return;}
    if(!items.length){alert('Ajoute au moins un ingrédient.');return;}
    const btn=$('mtRecipeNutritionSave'),status=$('mtRecipeNutritionStatus');btn.disabled=true;status.textContent='Calcul en cours…';
    try{const {data,error}=await sb().rpc('mt_admin_save_recipe_nutrition',{p_recipe_id:recipeId,p_servings:Number($('mtRecipeNutritionServings').value)||1,p_serving_label:$('mtRecipeNutritionServingLabel').value||'1 portion',p_items:items});if(error)throw error;const rawWeight=$('mtRecipeYieldWeight')?.value?.trim()||'';const yieldResult=await sb().rpc('mt_admin_save_recipe_yield',{p_recipe_id:recipeId,p_final_weight_g:rawWeight?Number(rawWeight):null,p_weight_basis:$('mtRecipeYieldBasis')?.value||'measured',p_preparation_method:$('mtRecipeYieldMethod')?.value||null,p_notes:null});if(yieldResult.error)throw yieldResult.error;status.textContent='Nutrition structurée enregistrée et recalculée.';await load(recipeId);}catch(e){console.warn(e);alert(e.message||'Impossible de calculer cette recette.');status.textContent='Calcul non enregistré.';}finally{btn.disabled=false;}
  }
  async function clear(){
    const recipeId=$('recipeId')?.value;if(!recipeId)return;if(!confirm('Retirer le calcul nutritionnel structuré de cette recette ?'))return;
    try{const {error}=await sb().rpc('mt_admin_save_recipe_nutrition',{p_recipe_id:recipeId,p_servings:Number($('mtRecipeNutritionServings').value)||1,p_serving_label:$('mtRecipeNutritionServingLabel').value||'1 portion',p_items:[]});if(error)throw error;await sb().rpc('mt_admin_save_recipe_yield',{p_recipe_id:recipeId,p_final_weight_g:null,p_weight_basis:'measured',p_preparation_method:null,p_notes:null});items=[];render();$('mtRecipeNutritionSnapshot').hidden=true;if($('mtRecipeYieldWeight'))$('mtRecipeYieldWeight').value='';$('mtRecipeNutritionStatus').textContent='Calcul structuré retiré.';}catch(e){alert(e.message||'Impossible de retirer le calcul.');}
  }
  function bind(){
    const input=$('mtRecipeNutritionSearch');input?.addEventListener('input',()=>{clearTimeout(timer);const q=input.value.trim();if(q.length<3){searchRows=[];renderResults();return;}timer=setTimeout(async()=>{const n=++seq;try{const rows=await searchFoods(q);if(n!==seq)return;searchRows=rows;renderResults();}catch(_){searchRows=[];renderResults();}},300);});
    $('mtRecipeNutritionSave').onclick=save;$('mtRecipeNutritionClear').onclick=clear;
  }
  function hook(){
    const baseEdit=window.editRecipe;if(typeof baseEdit==='function'&&!baseEdit.__mtNutrition){const fn=function(id){const r=baseEdit.apply(this,arguments);setTimeout(()=>load(id),0);return r;};fn.__mtNutrition=true;window.editRecipe=fn;}
    const baseReset=window.resetRecipeForm;if(typeof baseReset==='function'&&!baseReset.__mtNutrition){const fn=function(){const r=baseReset.apply(this,arguments);items=[];render();if($('mtRecipeNutritionServings'))$('mtRecipeNutritionServings').value=1;if($('mtRecipeNutritionServingLabel'))$('mtRecipeNutritionServingLabel').value='1 portion';if($('mtRecipeYieldWeight'))$('mtRecipeYieldWeight').value='';if($('mtRecipeYieldBasis'))$('mtRecipeYieldBasis').value='measured';if($('mtRecipeYieldMethod'))$('mtRecipeYieldMethod').value='';if($('mtRecipeNutritionSnapshot'))$('mtRecipeNutritionSnapshot').hidden=true;if($('mtRecipeNutritionStatus'))$('mtRecipeNutritionStatus').textContent='Enregistre d’abord la recette, puis ouvre « Modifier » pour renseigner ses ingrédients structurés.';return r;};fn.__mtNutrition=true;window.resetRecipeForm=fn;}
  }
  document.addEventListener('DOMContentLoaded',()=>{style();inject();hook();});
})();
