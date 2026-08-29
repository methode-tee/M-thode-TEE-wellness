// MÉTHODE TEE V419 — pont Carnet ↔ micronutrition ↔ suivis analytiques
(function(){
  'use strict';
  if(window.__MT_V419_ANALYTICS__)return;window.__MT_V419_ANALYTICS__=true;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={iron_mg:'Fer',calcium_mg:'Calcium',zinc_mg:'Zinc',iodine_ug:'Iode',magnesium_mg:'Magnésium',potassium_mg:'Potassium',selenium_ug:'Sélénium',vitamin_b9_ug:'Vitamine B9',vitamin_b12_ug:'Vitamine B12',vitamin_c_mg:'Vitamine C',vitamin_d_ug:'Vitamine D',omega3_g:'Oméga-3'};
  const units=key=>key.endsWith('_ug')?'µg':key.endsWith('_mg')?'mg':'g';
  const rounded=value=>Number.isFinite(Number(value))?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(Number(value)):'—';
  function hidden(form,name,value){let input=form.querySelector(`input[name="${CSS.escape(name)}"]`);if(!input){input=document.createElement('input');input.type='hidden';input.name=name;form.appendChild(input);}input.value=typeof value==='object'?JSON.stringify(value):String(value??'');}
  function hiddenIfKnown(form,name,value){if(value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value)))hidden(form,name,Number(value));}
  window.mtV419EnhanceTrackerForm=async function(key,date){
    if(key!=='nutrition_vegetale')return;const form=document.getElementById('mtAdvancedTrackerForm');if(!form)return;
    const host=document.createElement('div');host.className='mt-follow-estimate';host.innerHTML='<small>Lecture automatique du Carnet</small><b>Calcul des repas renseignés…</b><p>Aucune valeur absente ne sera remplacée par zéro.</p>';form.prepend(host);
    try{
      const sb=window.initSupabase?.();if(!sb)throw new Error('Carnet indisponible.');
      const {data,error}=await sb.rpc('food_day_micronutrition_summary',{target_date:date});if(error)throw error;
      const summary=data||{},micros=summary.micronutrients||{},entries=Object.entries(micros).filter(([,value])=>Number.isFinite(Number(value))&&Number(value)>=0),calculated=Number.isFinite(Number(summary.calculated_meals))?Number(summary.calculated_meals):null,mealCount=Number.isFinite(Number(summary.meal_count))?Number(summary.meal_count):null;
      hiddenIfKnown(form,'meal_count',mealCount);hiddenIfKnown(form,'calculated_meals',calculated);hiddenIfKnown(form,'protein_g',summary.protein_g);hiddenIfKnown(form,'fiber_g',summary.fiber_g);hiddenIfKnown(form,'micronutrient_coverage_count',summary.micronutrient_coverage_count);hidden(form,'_micronutrients',micros);hidden(form,'_nutrition_data_quality',summary.data_quality||'unknown');
      const cards=entries.map(([name,value])=>`<span style="display:block;padding:9px 11px;border-radius:14px;background:#fffdf8;border:1px solid #e6dccd"><b style="display:block;color:#173b31">${esc(labels[name]||name)}</b><small>${esc(rounded(value))} ${esc(units(name))} calculés</small></span>`).join('');
      const mealLabel=calculated===null?'Repas calculables non déterminés':`${calculated}${mealCount!==null?` / ${mealCount}`:''} repas calculable${calculated>1?'s':''}`,macroCopy=Number.isFinite(Number(summary.protein_g))||Number.isFinite(Number(summary.fiber_g))?`${Number.isFinite(Number(summary.protein_g))?`${rounded(summary.protein_g)} g de protéines`: 'Protéines non documentées'} · ${Number.isFinite(Number(summary.fiber_g))?`${rounded(summary.fiber_g)} g de fibres`:'Fibres non documentées'}`:'Aucune valeur macro ne peut être calculée avec les aliments quantifiés disponibles.';
      host.innerHTML=`<small>Carnet · ${esc(date)}</small><b>${esc(mealLabel)}</b><p>${calculated?macroCopy:'Ajoute au moins un aliment quantifié relié à une référence CIQUAL pour obtenir une lecture calculée.'}</p>${cards?`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px">${cards}</div>`:''}<p style="margin-top:10px">${esc(summary.source_note||'Une donnée absente signifie non documentée, jamais carence.')}</p>`;
    }catch(error){host.innerHTML=`<small>Lecture automatique du Carnet</small><b>Données micronutritionnelles non disponibles</b><p>${esc(error?.message||'Applique le SQL V419 puis importe le CSV officiel.')} Tu peux tout de même renseigner ton ressenti.</p>`;}
  };
})();
