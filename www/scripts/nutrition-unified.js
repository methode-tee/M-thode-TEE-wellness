(function(){
  'use strict';
  const LABELS={
    sugars_g:['Sucres','g'],saturated_fat_g:['Graisses saturées','g'],sodium_g:['Sodium','g'],trans_fat_g:['Acides gras trans','g'],
    monounsaturated_fat_g:['Graisses mono-insaturées','g'],polyunsaturated_fat_g:['Graisses poly-insaturées','g'],starch_g:['Amidon','g'],polyols_g:['Polyols','g'],cholesterol_g:['Cholestérol','g'],alcohol_g:['Alcool','g'],omega3_g:['Oméga-3','g'],omega6_g:['Oméga-6','g'],energy_kj:['Énergie','kJ'],
    iron_mg:['Fer','mg'],calcium_mg:['Calcium','mg'],zinc_mg:['Zinc','mg'],iodine_ug:['Iode','µg'],magnesium_mg:['Magnésium','mg'],phosphorus_mg:['Phosphore','mg'],potassium_mg:['Potassium','mg'],selenium_ug:['Sélénium','µg'],vitamin_b1_mg:['Vitamine B1','mg'],vitamin_b2_mg:['Vitamine B2','mg'],vitamin_b3_mg:['Vitamine B3','mg'],vitamin_b6_mg:['Vitamine B6','mg'],vitamin_b9_ug:['Vitamine B9','µg'],vitamin_b12_ug:['Vitamine B12','µg'],vitamin_c_mg:['Vitamine C','mg'],vitamin_d_ug:['Vitamine D','µg'],vitamin_e_mg:['Vitamine E','mg']
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(v,d=1)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fr-FR',{maximumFractionDigits:d}):null;};
  function metric(label,value,unit,d=1){const v=num(value,d);return `<div><strong>${v===null?'Non documenté':`${esc(v)}${unit?` ${esc(unit)}`:''}`}</strong><span>${esc(label)}</span></div>`;}
  function detailMetric(key,raw){
    const meta=LABELS[key]||[String(key).replace(/_g$|_mg$|_ug$/,'').replaceAll('_',' '),raw?.unit||''];
    const status=raw?.status||'undocumented';
    const value=status==='complete'?raw?.value:null;
    const display=status==='complete'&&Number.isFinite(Number(value))?`${num(value,Math.abs(Number(value))<10?2:1)}${meta[1]?` ${meta[1]}`:''}`:status==='partial'?'Données partielles':'Non documenté';
    return `<div class="mt-unified-detail ${status!=='complete'?'is-muted':''}"><span>${esc(meta[0])}</span><b>${esc(display)}</b></div>`;
  }
  function installStyle(){
    if(document.getElementById('mtUnifiedNutritionStyle'))return;
    const st=document.createElement('style');st.id='mtUnifiedNutritionStyle';st.textContent=`
      .mt-unified-recipe-nutrition{margin:18px 0;padding:18px;border:1px solid rgba(154,119,38,.24);border-radius:24px;background:rgba(255,252,245,.82)}
      .mt-unified-recipe-nutrition .mt-unified-kicker{font-size:11px;letter-spacing:.16em;font-weight:800;color:#9a7726;text-transform:uppercase;margin-bottom:5px}
      .mt-unified-recipe-nutrition>p{margin:0 0 14px;color:#6c665d;font-size:13px;line-height:1.45}
      .mt-unified-core{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      .mt-unified-core>div{padding:11px 8px;border-radius:16px;background:#fff;border:1px solid rgba(15,45,31,.08);text-align:center}
      .mt-unified-core strong{display:block;color:#0f2d1f;font-size:15px;line-height:1.2}.mt-unified-core span{display:block;margin-top:4px;font-size:10px;color:#777066}
      .mt-unified-recipe-nutrition details{margin-top:13px;border-top:1px solid rgba(154,119,38,.16);padding-top:11px}.mt-unified-recipe-nutrition summary{cursor:pointer;color:#0f2d1f;font-weight:700;font-size:13px}
      .mt-unified-details-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.mt-unified-detail{padding:10px 11px;border-radius:14px;background:#fff;border:1px solid rgba(15,45,31,.07)}.mt-unified-detail span,.mt-unified-detail b{display:block}.mt-unified-detail span{font-size:11px;color:#777066}.mt-unified-detail b{font-size:12px;color:#0f2d1f;margin-top:3px}.mt-unified-detail.is-muted b{color:#8c867d}
      @media(max-width:420px){.mt-unified-core{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;document.head.appendChild(st);
  }
  async function resolveRecipe(recipeId){
    const sb=window.initSupabase?.();if(!sb||!recipeId)return null;
    try{const {data,error}=await sb.rpc('mt_nutrition_resolve',{p_meal_item_id:null,p_recipe_id:recipeId,p_blend_id:null,p_dictionary_id:null,p_ciqual_code:null});if(error)throw error;return data?.kind==='recipe_snapshot'?data:null;}catch(e){console.warn('recipe nutrition resolver',e);return null;}
  }
  function buildCard(nutrition){
    const c=nutrition?.core||{},extras=nutrition?.nutrition_extra||{},micros=nutrition?.micronutrients||{};
    const extraRows=Object.entries(extras).filter(([,v])=>v?.status&&v.status!=='undocumented').map(([k,v])=>detailMetric(k,v)).join('');
    const microRows=Object.entries(micros).filter(([,v])=>v?.status&&v.status!=='undocumented').map(([k,v])=>detailMetric(k,v)).join('');
    return `<section class="mt-unified-recipe-nutrition" data-mt-unified-recipe-nutrition>
      <div class="mt-unified-kicker">Nutrition estimée · recette de référence</div>
      <p>${esc(nutrition.nutrition_disclaimer||'Valeurs estimées à partir de la recette structurée.')}</p>
      <div class="mt-unified-core">
        ${metric('Calories',c.kcal,'kcal',0)}${metric('Protéines',c.protein_g,'g')}${metric('Glucides',c.carbs_g,'g')}${metric('Lipides',c.fat_g,'g')}${metric('Fibres',c.fiber_g,'g')}${metric('Sel',c.salt_g,'g',2)}
      </div>
      ${(extraRows||microRows)?`<details><summary>Voir la nutrition détaillée</summary>${extraRows?`<div class="mt-unified-details-grid">${extraRows}</div>`:''}${microRows?`<div class="mt-unified-details-grid">${microRows}</div>`:''}</details>`:''}
    </section>`;
  }
  async function injectRecipeNutrition(recipeId){
    const sheet=document.querySelector('#mediaModal.recipe-open .mt-recipe-sheet-body');if(!sheet)return;
    const nutrition=await resolveRecipe(recipeId);if(!nutrition)return;
    if(!document.querySelector('#mediaModal.recipe-open .mt-recipe-sheet-body'))return;
    sheet.querySelector('[data-mt-unified-recipe-nutrition]')?.remove();
    // Le calcul structuré devient la source de vérité lorsqu'il existe ; l'ancien
    // bloc éditorial manuel reste le fallback pour les recettes non structurées.
    const old=sheet.querySelector('.mt-recipe-nutrition');
    if(old){
      const nutritionLabels=new Set(['Calories','Protéines','Glucides','Lipides']);
      old.querySelectorAll('.mt-recipe-nutrition-grid>div').forEach(card=>{const label=card.querySelector('span')?.textContent?.trim();if(nutritionLabels.has(label))card.hidden=true;});
      if(![...old.querySelectorAll('.mt-recipe-nutrition-grid>div')].some(card=>!card.hidden))old.hidden=true;
    }
    const anchor=sheet.querySelector('.mt-recipe-meta-grid');
    if(anchor)anchor.insertAdjacentHTML('afterend',buildCard(nutrition));
    else sheet.insertAdjacentHTML('afterbegin',buildCard(nutrition));
  }
  function hookViewer(){
    const original=window.openRecipeViewer;if(typeof original!=='function'||original.__mtUnifiedNutrition)return;
    const wrapped=async function(recipeId){const result=await original.apply(this,arguments);if(document.querySelector('#mediaModal.recipe-open .mt-recipe-sheet'))await injectRecipeNutrition(recipeId);return result;};
    wrapped.__mtUnifiedNutrition=true;window.openRecipeViewer=wrapped;
  }
  installStyle();hookViewer();
  window.MTNutritionResolver={resolveRecipe,injectRecipeNutrition};
})();
