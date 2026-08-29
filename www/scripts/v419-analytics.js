// MÉTHODE TEE V419 — pont Carnet ↔ micronutrition ↔ suivis analytiques
(function(){
  'use strict';
  if(window.__MT_V419_ANALYTICS__)return;window.__MT_V419_ANALYTICS__=true;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={iron_mg:'Fer',calcium_mg:'Calcium',zinc_mg:'Zinc',iodine_ug:'Iode',magnesium_mg:'Magnésium',phosphorus_mg:'Phosphore',potassium_mg:'Potassium',selenium_ug:'Sélénium',vitamin_b1_mg:'Vitamine B1',vitamin_b2_mg:'Vitamine B2',vitamin_b3_mg:'Vitamine B3',vitamin_b6_mg:'Vitamine B6',vitamin_b9_ug:'Vitamine B9 / folates',vitamin_b12_ug:'Vitamine B12',vitamin_c_mg:'Vitamine C',vitamin_d_ug:'Vitamine D',vitamin_e_mg:'Vitamine E',omega3_g:'Oméga-3'};
  const units=key=>key.endsWith('_ug')?'µg':key.endsWith('_mg')?'mg':'g';
  const rounded=value=>Number.isFinite(Number(value))?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(Number(value)):'—';
  const known=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
  function hidden(form,name,value){let input=form.querySelector(`input[name="${CSS.escape(name)}"]`);if(!input){input=document.createElement('input');input.type='hidden';input.name=name;form.appendChild(input);}input.value=value&&typeof value==='object'?JSON.stringify(value):String(value??'');}
  function hiddenIfKnown(form,name,value){if(known(value))hidden(form,name,Number(value));}
  function sourceNames(raw){return (Array.isArray(raw)?raw:[]).map(x=>typeof x==='string'?x:(x?.name||x?.food_name||'')).filter(Boolean).slice(0,5);}
  function sourceDetails(raw,key){return (Array.isArray(raw)?raw:[]).map(x=>{if(typeof x==='string')return x;const name=x?.name||x?.food_name||'',value=known(x?.value)?`${rounded(x.value)} ${units(key)}`:'';return [name,value].filter(Boolean).join(' · ');}).filter(Boolean).slice(0,5);}
  function qualityModel(summary){
    const mealCount=Number(summary.meal_count)||0,calculated=Number(summary.calculated_meals)||0,itemCount=Number(summary.item_count)||0,quantified=Number(summary.quantified_items)||0,microItems=Number(summary.calculable_items)||0;
    if(!mealCount)return {level:'none',title:'Aucun calcul disponible',copy:'Aucun repas renseigné aujourd’hui.',mealCount,calculated,itemCount,quantified,microItems};
    if(!calculated)return {level:'insufficient',title:'Pas assez de données pour interpréter',copy:'Tes repas existent, mais les aliments ou quantités ne permettent pas encore de calculer les repères nutritionnels.',mealCount,calculated,itemCount,quantified,microItems};
    if(calculated<mealCount)return {level:'partial',title:'Lecture partielle',copy:`${calculated} repas sur ${mealCount} est${calculated>1?' sont':''} calculable${calculated>1?'s':''}. Les valeurs ci-dessous ne représentent donc pas forcément toute la journée.`,mealCount,calculated,itemCount,quantified,microItems};
    return {level:'complete',title:'Données largement exploitables',copy:`${calculated} repas sur ${mealCount} est${calculated>1?' sont':''} calculable${calculated>1?'s':''} à partir des aliments quantifiés.`,mealCount,calculated,itemCount,quantified,microItems};
  }
  function macroCard(label,value){return `<span style="display:block;padding:10px 11px;border-radius:14px;background:#fffdf8;border:1px solid #e6dccd"><b style="display:block;color:#173b31">${esc(label)}</b><small>${known(value)?`${esc(rounded(value))} g calculés`:'Non documenté'}</small></span>`;}
  function microCard(key,micros,sources){
    const value=micros?.[key],names=sourceNames(sources?.[key]),details=sourceDetails(sources?.[key],key),isKnown=known(value);
    return `<span style="display:block;padding:10px 11px;border-radius:14px;background:#fffdf8;border:1px solid #e6dccd"><b style="display:block;color:#173b31">${esc(labels[key]||key)}</b><small>${isKnown?`${esc(rounded(value))} ${esc(units(key))} calculés`:'Non documenté sur cette journée'}</small>${details.length?`<small style="display:block;margin-top:4px;color:#887a6d">Sources : ${esc(details.slice(0,3).join(' · '))}</small>`:`<small style="display:block;margin-top:4px;color:#887a6d">Aucune source calculable renseignée</small>`}</span>`;
  }
  function adviceHTML(settings,micros,sources){
    const profile=String(settings?.diet_pattern||''),out=[];
    if(known(micros?.iron_mg)&&sourceNames(sources?.iron_mg).length){out.push('<b>Fer végétal</b><p>Une ou plusieurs sources de fer sont renseignées. Associer une source de vitamine C au même repas peut être un repère alimentaire intéressant. Cette lecture ne mesure pas tes réserves en fer.</p>');}
    const b12Known=known(micros?.vitamin_b12_ug)&&Number(micros.vitamin_b12_ug)>0,b12Supplement=settings?.supplement_b12==='Oui';
    if(/^Végane$/i.test(profile)&&!b12Known&&!b12Supplement){out.push('<b>Vitamine B12</b><p>Aucune source calculable de B12 ni supplémentation n’est renseignée dans la configuration. La B12 mérite une attention spécifique dans une alimentation végétalienne ; ce repère ne permet pas d’évaluer ton statut biologique et ne prescrit aucune dose.</p>');}
    if(!known(micros?.omega3_g)){out.push('<b>À explorer · oméga-3</b><p>Les graines de chia ou de lin et les noix peuvent apporter de l’ALA. Il s’agit d’une suggestion alimentaire séparée de ce que tu as réellement consommé ; l’app n’évalue pas ton statut biologique en oméga-3.</p>');}
    return out.length?`<div style="margin-top:11px;padding:12px;border-radius:16px;background:#f4eee2;color:#6d6258;font-size:11px;line-height:1.5">${out.join('')}</div>`:'';
  }
  window.mtV419EnhanceTrackerForm=async function(key,date,settings={}){
    if(key!=='nutrition_vegetale')return;const form=document.getElementById('mtAdvancedTrackerForm');if(!form)return;
    const host=document.createElement('div');host.className='mt-follow-estimate';host.innerHTML='<small>Ce que mon Carnet permet de calculer</small><b>Lecture des repas renseignés…</b><p>Aucune valeur absente ne sera remplacée par zéro.</p>';form.prepend(host);
    try{
      const sb=window.initSupabase?.();if(!sb)throw new Error('Carnet indisponible.');
      const {data,error}=await sb.rpc('food_day_micronutrition_summary',{target_date:date});if(error)throw error;
      const summary=data||{},micros=summary.micronutrients&&typeof summary.micronutrients==='object'?summary.micronutrients:{},sources=summary.micronutrient_sources&&typeof summary.micronutrient_sources==='object'?summary.micronutrient_sources:{},sourceFoods=Array.isArray(summary.source_foods)?summary.source_foods:[],quality=qualityModel(summary);
      hiddenIfKnown(form,'meal_count',summary.meal_count);hiddenIfKnown(form,'calculated_meals',summary.calculated_meals);hiddenIfKnown(form,'item_count',summary.item_count);hiddenIfKnown(form,'quantified_items',summary.quantified_items);hiddenIfKnown(form,'calculable_items',summary.calculable_items);hiddenIfKnown(form,'protein_g',summary.protein_g);hiddenIfKnown(form,'fiber_g',summary.fiber_g);hiddenIfKnown(form,'carbs_g',summary.carbs_g);hiddenIfKnown(form,'fat_g',summary.fat_g);hiddenIfKnown(form,'micronutrient_coverage_count',summary.micronutrient_coverage_count);hiddenIfKnown(form,'micronutrient_source_count',summary.micronutrient_source_count);hidden(form,'_micronutrients',micros);hidden(form,'_micronutrient_sources',sources);hidden(form,'_nutrition_source_foods',sourceFoods);hidden(form,'_nutrition_data_quality',quality.level);
      const observed=Array.isArray(settings?.observed_nutrients)&&settings.observed_nutrients.length?settings.observed_nutrients:['protein','fiber','iron_mg','calcium_mg','vitamin_b12_ug','vitamin_d_ug','omega3_g'];
      const macroCards=[observed.includes('protein')?macroCard('Protéines',summary.protein_g):'',macroCard('Glucides',summary.carbs_g),macroCard('Lipides',summary.fat_g),observed.includes('fiber')?macroCard('Fibres',summary.fiber_g):''].filter(Boolean).join('');
      const microKeys=observed.filter(k=>labels[k]),microCards=microKeys.map(k=>microCard(k,micros,sources)).join('');
      const coverage=quality.mealCount?Math.round(quality.calculated/quality.mealCount*100):null;
      const qualityLine=quality.mealCount?`${quality.calculated}/${quality.mealCount} repas calculables${quality.itemCount?` · ${quality.quantified}/${quality.itemCount} aliments quantifiés`:''}${coverage!==null?` · couverture repas ${coverage} %`:''}`:'Aucun repas renseigné';
      const addMeal=quality.level==='none'?`<button type="button" onclick="location.href='food-meal.html?date=${encodeURIComponent(date)}'" style="margin-top:10px;border:0;border-radius:999px;background:#173b31;color:white;padding:9px 12px;font-weight:800">Ajouter un repas</button>`:'';
      host.innerHTML=`<small>Carnet alimentaire · ${esc(date)}</small><b>${esc(quality.title)}</b><p>${esc(qualityLine)}. ${esc(quality.copy)}</p>${addMeal}${quality.level!=='none'?`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px">${macroCards}</div>`:''}${microCards?`<div style="margin-top:12px"><small style="display:block;margin-bottom:6px">Micronutriments observés</small><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px">${microCards}</div></div>`:''}${adviceHTML(settings,micros,sources)}<p style="margin-top:10px">Cette lecture repose uniquement sur les aliments et quantités renseignés. Elle ne permet pas de diagnostiquer une carence, d’évaluer un taux sanguin ou de prescrire une supplémentation.</p>`;
    }catch(error){host.innerHTML=`<small>Ce que mon Carnet permet de calculer</small><b>Lecture nutritionnelle indisponible</b><p>${esc(error?.message||'Les données nutritionnelles détaillées ne sont pas encore disponibles pour cette entrée.')} Tu peux tout de même renseigner ton ressenti ; aucune valeur n’est inventée.</p>`;}
  };
})();
