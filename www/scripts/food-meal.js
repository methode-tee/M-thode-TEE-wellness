(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded',async()=>{
    const F=window.MTFood;if(!F)return;const ctx=await F.auth();if(!ctx)return;const {sb,user}=ctx;
    const mealId=F.qs('meal_id');let mealDate=F.qs('date')||F.today();let mealType=F.qs('type')||'lunch';
    let currentMeal=null,photoFile=null,photoPath='',recipeSource=null,items=[];
    const pageTitle=document.getElementById('mealPageTitle'),desc=document.getElementById('mealDescription'),time=document.getElementById('mealTime');
    const itemsBox=document.getElementById('mealItems'),search=document.getElementById('foodSearchInput'),results=document.getElementById('foodSearchResults');
    const preview=document.getElementById('mealPhotoPreview'),photoInput=document.getElementById('mealPhotoInput');
    const feelings={energy:7,digestion:7,satiety:7};
    const types=F.mealOrder;
    const labels=F.mealLabels;
    const typeGrid=document.getElementById('mealTypeGrid');
    const back=()=>location.href=`food-day.html?date=${mealDate}`;
    document.getElementById('mealBack').onclick=back;

    function renderTypes(){typeGrid.innerHTML=types.map(t=>`<button type="button" class="mt-food-type-btn ${t===mealType?'active':''}" data-type="${t}">${labels[t]}</button>`).join('');typeGrid.querySelectorAll('button').forEach(b=>b.onclick=()=>{mealType=b.dataset.type;renderTypes();if(!time.value)time.value=F.mealTimes[mealType];});}
    function renderFeelings(){const box=document.getElementById('mealFeelings');box.innerHTML=[['energy','Énergie'],['digestion','Digestion'],['satiety','Satiété']].map(([k,l])=>`<label class="mt-food-feeling"><span>${l}</span><select data-feeling="${k}">${Array.from({length:10},(_,i)=>i+1).map(v=>`<option value="${v}" ${Number(feelings[k])===v?'selected':''}>${v}/10</option>`).join('')}</select></label>`).join('');box.querySelectorAll('select').forEach(s=>s.onchange=()=>feelings[s.dataset.feeling]=Number(s.value));}
    function itemTotals(i){return F.nutrientFromItem(i,Number(i.grams)||0);}
    function renderItems(){
      itemsBox.innerHTML=items.length?items.map((i,idx)=>{
        const n=itemTotals(i),profile=F.portionProfile(i.name),amount=F.portionFromGrams(i.name,Number(i.grams)||0)||profile.defaultAmount;
        const kcal=n.kcal?`${profile.estimated?'≈ ':''}${n.kcal} kcal`:'';
        return `<div class="mt-food-item"><div><b>${F.esc(i.name)}</b><small>${kcal}</small></div><label class="mt-food-quantity"><input type="number" min="${profile.min}" max="2000" step="${profile.step}" value="${amount}" data-portion="${idx}" aria-label="Quantité"><span>${F.esc(profile.unit)}</span></label><button type="button" data-remove="${idx}" aria-label="Retirer">×</button></div>`;
      }).join(''):'<p class="mt-food-summary-note">Tu peux enregistrer ton repas avec une description seule, ou ajouter des aliments pour obtenir des repères nutritionnels plus précis.</p>';
      itemsBox.querySelectorAll('[data-portion]').forEach(inp=>inp.onchange=()=>{const i=items[Number(inp.dataset.portion)],profile=F.portionProfile(i.name),amount=Math.max(profile.min,Number(inp.value)||profile.defaultAmount);i.grams=F.gramsForPortion(i.name,amount);renderItems();});
      itemsBox.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>{items.splice(Number(btn.dataset.remove),1);renderItems();});
    }

    async function loadRecipe(recipeId){
      try{const recipes=await window.mtFetchRecipes?.();const r=(recipes||[]).find(x=>String(x.id)===String(recipeId));if(!r)return;recipeSource=r;desc.value=r.title||r.subtitle||'';mealType=F.qs('type')||mealType;renderTypes();if(r.image_url){preview.innerHTML=`<img src="${F.esc(r.image_url)}" alt="">`;}}
      catch(e){console.warn('recipe prefill',e)}
    }

    async function loadExisting(){
      if(!mealId)return;
      const {data,error}=await sb.from('food_meals').select('*').eq('id',mealId).eq('user_id',user.id).maybeSingle();
      if(error||!data){F.toast('Repas introuvable');return;}
      currentMeal=data;mealDate=data.meal_date;mealType=data.meal_type||mealType;photoPath=data.photo_path||'';pageTitle.textContent='Modifier mon repas';desc.value=data.description||data.source_recipe_title||'';time.value=(data.meal_time||F.mealTimes[mealType]||'').slice(0,5);feelings.energy=Number(data.energy_after)||7;feelings.digestion=Number(data.digestion_after)||7;feelings.satiety=Number(data.satiety_after)||7;
      if(photoPath){const url=await F.signedUrl(sb,photoPath,1800);if(url)preview.innerHTML=`<img src="${F.esc(url)}" alt="Photo du repas">`;}
      else if(data.source_recipe_image_url)preview.innerHTML=`<img src="${F.esc(data.source_recipe_image_url)}" alt="">`;
      const {data:itemRows}=await sb.from('food_meal_items').select('*').eq('meal_id',mealId).order('sort_order');
      items=(itemRows||[]).map(x=>({ciqual_code:x.ciqual_code,name:x.food_name,grams:Number(x.quantity_g)||100,kcal_100g:x.kcal_100g,protein_100g:x.protein_100g,fat_100g:x.fat_100g,carbs_100g:x.carbs_100g,fiber_100g:x.fiber_100g,salt_100g:x.salt_100g}));
      document.getElementById('mealDelete').hidden=false;renderTypes();renderFeelings();renderItems();
    }

    let timer=0,searchSeq=0;
    search.addEventListener('input',()=>{clearTimeout(timer);const q=search.value.trim();if(q.length<3){results.hidden=true;results.innerHTML='';return;}timer=setTimeout(()=>doSearch(q),350);});
    async function doSearch(q){
      const seq=++searchSeq;results.hidden=false;results.innerHTML='<div class="mt-food-loading">Recherche…</div>';
      let rows=[];
      try{
        let r=await sb.from('ciqual_foods').select('code,name,kcal_100g,protein_100g,fat_100g,carbs_100g,fiber_100g,salt_100g').textSearch('search_text',q,{type:'websearch',config:'simple'}).limit(10);
        if(r.error)r=await sb.from('ciqual_foods').select('code,name,kcal_100g,protein_100g,fat_100g,carbs_100g,fiber_100g,salt_100g').ilike('search_text',`%${q.replace(/[%_]/g,'')}%`).limit(10);
        rows=r.data||[];
      }catch(e){rows=[];}
      if(seq!==searchSeq)return;
      results.innerHTML=rows.length?rows.map((r,i)=>{const p=F.portionProfile(r.name),g=F.gramsForPortion(r.name,p.defaultAmount),n=F.nutrientFromItem(r,g);let amount=p.defaultAmount===.5?'½':String(p.defaultAmount);const repere=p.kind==='g'?`100 g`:p.kind==='ml'?`${amount} ml`:`${amount} ${p.unit}`;return `<button type="button" class="mt-food-search-result" data-result="${i}"><span>${F.esc(r.name)}</span><small>${n.kcal?`${p.estimated?'≈ ':''}${n.kcal} kcal · ${F.esc(repere)}`:''}</small></button>`;}).join(''):'<div class="mt-food-loading">Aucun résultat. Tu peux simplement décrire le repas.</div>';
      results.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{const r=rows[Number(b.dataset.result)],profile=F.portionProfile(r.name);items.push({ciqual_code:r.code,name:r.name,grams:F.gramsForPortion(r.name,profile.defaultAmount),...r});search.value='';results.hidden=true;renderItems();});
    }

    photoInput.onchange=()=>{const f=photoInput.files?.[0];if(!f)return;photoFile=f;const url=URL.createObjectURL(f);preview.innerHTML=`<img src="${url}" alt="Aperçu">`;};

    async function save(){
      const saveBtns=[document.getElementById('mealSave'),document.getElementById('mealSaveTop')];saveBtns.forEach(b=>b.disabled=true);
      try{
        const id=currentMeal?.id||crypto.randomUUID();
        if(photoFile)photoPath=await F.uploadMealPhoto(sb,user,photoFile,id,photoPath);
        const calculated=F.sumNutrition(items.map(i=>itemTotals(i)));
        const row={id,user_id:user.id,meal_date:mealDate,meal_type:mealType,meal_time:time.value||F.mealTimes[mealType],description:desc.value.trim(),photo_path:photoPath||null,source_recipe_id:recipeSource?.id||currentMeal?.source_recipe_id||null,source_recipe_title:recipeSource?.title||currentMeal?.source_recipe_title||null,source_recipe_image_url:recipeSource?.image_url||currentMeal?.source_recipe_image_url||null,kcal_total:calculated.kcal,protein_total:calculated.protein,fat_total:calculated.fat,carbs_total:calculated.carbs,fiber_total:calculated.fiber,salt_total:calculated.salt,energy_after:feelings.energy,digestion_after:feelings.digestion,satiety_after:feelings.satiety,updated_at:new Date().toISOString()};
        const {error}=await sb.from('food_meals').upsert(row,{onConflict:'id'});if(error)throw error;
        await sb.from('food_meal_items').delete().eq('meal_id',id);
        if(items.length){const insert=items.map((i,idx)=>{const n=itemTotals(i);return {meal_id:id,sort_order:idx,ciqual_code:i.ciqual_code||null,food_name:i.name,quantity_g:Number(i.grams)||100,kcal_100g:Number(i.kcal_100g)||0,protein_100g:Number(i.protein_100g)||0,fat_100g:Number(i.fat_100g)||0,carbs_100g:Number(i.carbs_100g)||0,fiber_100g:Number(i.fiber_100g)||0,salt_100g:Number(i.salt_100g)||0,kcal:n.kcal,protein:n.protein,fat:n.fat,carbs:n.carbs,fiber:n.fiber,salt:n.salt};});const r=await sb.from('food_meal_items').insert(insert);if(r.error)throw r.error;}
        try{localStorage.removeItem(`mt_tee_balance_v4_${user.id}_${mealDate}`);localStorage.removeItem(`mt_tee_balance_v8_${user.id}_${mealDate}`);}catch(e){}
        location.href=`food-day.html?date=${mealDate}`;
      }catch(e){console.warn('meal save',e);F.toast(e.message||'Impossible d’enregistrer ce repas.');saveBtns.forEach(b=>b.disabled=false);}
    }
    document.getElementById('mealSave').onclick=save;document.getElementById('mealSaveTop').onclick=save;
    document.getElementById('mealDelete').onclick=async()=>{if(!currentMeal||!confirm('Supprimer ce repas de ton carnet ?'))return;try{await sb.from('food_meals').delete().eq('id',currentMeal.id).eq('user_id',user.id);await F.deleteMealPhoto(sb,currentMeal.photo_path);location.href=`food-day.html?date=${mealDate}`;}catch(e){F.toast('Suppression impossible.')}};

    renderTypes();renderFeelings();renderItems();time.value=F.mealTimes[mealType]||'13:00';
    if(mealId)await loadExisting();else if(F.qs('recipe_id'))await loadRecipe(F.qs('recipe_id'));
  });
})();
