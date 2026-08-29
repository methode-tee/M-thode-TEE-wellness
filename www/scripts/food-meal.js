(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded',async()=>{
    const F=window.MTFood;if(!F)return;const ctx=await F.auth();if(!ctx)return;const {sb,user}=ctx;
    const mealId=F.qs('meal_id');let mealDate=F.qs('date')||F.today();let mealType=F.qs('type')||'lunch';
    let currentMeal=null,photoFile=null,photoPath='',recipeSource=null,items=[];
    const pageTitle=document.getElementById('mealPageTitle'),desc=document.getElementById('mealDescription'),time=document.getElementById('mealTime');
    const itemsBox=document.getElementById('mealItems'),search=document.getElementById('foodSearchInput'),results=document.getElementById('foodSearchResults');
    const recognizedBox=document.getElementById('mealRecognizedFoods');
    const preview=document.getElementById('mealPhotoPreview'),photoInput=document.getElementById('mealPhotoInput');
    const quickCard=document.getElementById('mealQuickChoices'),quickList=document.getElementById('mealQuickList');
    const barcodeScan=document.getElementById('mealBarcodeScan'),barcodeStatus=document.getElementById('mealBarcodeStatus');
    // Un ressenti non choisi doit rester absent : aucune note implicite à 7/10.
    const feelings={energy:null,digestion:null,satiety:null};
    const types=F.mealOrder;
    const labels=F.mealLabels;
    const typeGrid=document.getElementById('mealTypeGrid');
    const back=()=>location.href=`food-day.html?date=${mealDate}`;
    document.getElementById('mealBack').onclick=back;

    const quickKey=`mt_food_quick_v366_${user.id}`;
    function readQuick(){try{const x=JSON.parse(localStorage.getItem(quickKey)||'{}');return {recent:Array.isArray(x.recent)?x.recent:[],favorites:Array.isArray(x.favorites)?x.favorites:[]};}catch(e){return {recent:[],favorites:[]};}}
    function writeQuick(x){try{localStorage.setItem(quickKey,JSON.stringify({recent:(x.recent||[]).slice(0,8),favorites:(x.favorites||[]).slice(0,12)}));}catch(e){}}
    function quickId(x){return `${x.meal_type||''}|${String(x.description||'').toLocaleLowerCase('fr')}|${(x.items||[]).map(i=>`${i.ciqual_code||i.name}:${Math.round(Number(i.grams)||0)}`).join(',')}`;}
    function quickSnapshot(){return {id:'',meal_type:mealType,description:desc.value.trim(),items:items.map(i=>({...i})),meal_date:mealDate,saved_at:new Date().toISOString()};}
    function rememberMeal(){const snap=quickSnapshot();snap.id=quickId(snap);if(!snap.description&&!snap.items.length)return;const x=readQuick();x.recent=[snap,...x.recent.filter(i=>quickId(i)!==snap.id)];x.favorites=x.favorites.map(i=>quickId(i)===snap.id?snap:i);writeQuick(x);}
    let quickTab='recent';
    function applyQuick(x){mealType=types.includes(x.meal_type)?x.meal_type:mealType;desc.value=x.description||'';items=(x.items||[]).map(i=>({...i}));renderTypes();renderItems();desc.dispatchEvent(new Event('input'));F.toast('Repas repris. Tu peux tout corriger avant de l’enregistrer.');window.scrollTo({top:desc.getBoundingClientRect().top+window.scrollY-120,behavior:'smooth'});}
    function renderQuick(){const x=readQuick(),rows=x[quickTab]||[],all=[...x.recent,...x.favorites],yesterday=(()=>{const d=new Date(`${mealDate}T12:00:00`);d.setDate(d.getDate()-1);return d.toLocaleDateString('sv-SE')})(),yRow=x.recent.find(r=>r.meal_date===yesterday&&r.meal_type===mealType);quickCard.hidden=!all.length;if(quickCard.hidden)return;quickCard.querySelectorAll('[data-quick-tab]').forEach(b=>b.classList.toggle('active',b.dataset.quickTab===quickTab));quickList.innerHTML=(yRow?`<div class="mt-food-quick-row mt-food-quick-yesterday"><button type="button" data-quick-yesterday><b>✶ ${F.esc(labels[mealType]||'Repas')} d’hier</b><span>Ajouter en 1 clic · tout reste modifiable</span></button><span></span></div>`:'')+(rows.length?rows.map((r,i)=>{const fav=x.favorites.some(f=>quickId(f)===quickId(r));return `<div class="mt-food-quick-row"><button type="button" data-quick-use="${i}"><b>${F.esc(labels[r.meal_type]||'Repas')}</b><span>${F.esc(r.description||(r.items||[]).map(v=>v.name).join(', ')||'Repas enregistré')}</span></button><button type="button" class="mt-food-quick-favorite ${fav?'is-favorite':''}" data-quick-favorite="${i}" aria-label="${fav?'Retirer des favoris':'Ajouter aux favoris'}">${fav?'★':'☆'}</button></div>`;}).join(''):'<p class="mt-food-summary-note">Aucun repas favori pour le moment. Appuie sur l’étoile d’un repas récent pour le garder ici.</p>');quickList.querySelector('[data-quick-yesterday]')?.addEventListener('click',()=>applyQuick(yRow));quickList.querySelectorAll('[data-quick-use]').forEach(b=>b.onclick=()=>applyQuick(rows[Number(b.dataset.quickUse)]));quickList.querySelectorAll('[data-quick-favorite]').forEach(b=>b.onclick=()=>{const row=rows[Number(b.dataset.quickFavorite)],id=quickId(row),state=readQuick(),exists=state.favorites.some(v=>quickId(v)===id);state.favorites=exists?state.favorites.filter(v=>quickId(v)!==id):[{...row,id},...state.favorites.filter(v=>quickId(v)!==id)];writeQuick(state);renderQuick();F.toast(exists?'Retiré des favoris':'Ajouté aux favoris');});}
    quickCard?.querySelectorAll('[data-quick-tab]').forEach(b=>b.onclick=()=>{quickTab=b.dataset.quickTab;renderQuick();});

    function renderTypes(){typeGrid.innerHTML=types.map(t=>`<button type="button" class="mt-food-type-btn ${t===mealType?'active':''}" data-type="${t}">${labels[t]}</button>`).join('');typeGrid.querySelectorAll('button').forEach(b=>b.onclick=()=>{mealType=b.dataset.type;renderTypes();if(!time.value)time.value=F.mealTimes[mealType];});}
    function nullableScore(value){
      if(value===null||value===undefined||value==='')return null;
      const score=Number(value);
      return Number.isFinite(score)&&score>=1&&score<=10?score:null;
    }
    function renderFeelings(){const box=document.getElementById('mealFeelings');box.innerHTML=[['energy','Énergie'],['digestion','Digestion'],['satiety','Satiété']].map(([k,l])=>`<label class="mt-food-feeling"><span>${l}</span><select data-feeling="${k}"><option value="" ${feelings[k]===null?'selected':''}>Non renseigné</option>${Array.from({length:10},(_,i)=>i+1).map(v=>`<option value="${v}" ${feelings[k]===v?'selected':''}>${v}/10</option>`).join('')}</select></label>`).join('');box.querySelectorAll('select').forEach(s=>s.onchange=()=>feelings[s.dataset.feeling]=nullableScore(s.value));}
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
      const {data,error}=await sb.from('food_meals').select('id,meal_date,meal_type,meal_time,description,photo_path,source_recipe_id,source_recipe_title,source_recipe_image_url,energy_after,digestion_after,satiety_after').eq('id',mealId).eq('user_id',user.id).maybeSingle();
      if(error||!data){F.toast('Repas introuvable');return;}
      currentMeal=data;mealDate=data.meal_date;mealType=data.meal_type||mealType;photoPath=data.photo_path||'';pageTitle.textContent='Modifier mon repas';desc.value=data.description||data.source_recipe_title||'';time.value=(data.meal_time||F.mealTimes[mealType]||'').slice(0,5);feelings.energy=nullableScore(data.energy_after);feelings.digestion=nullableScore(data.digestion_after);feelings.satiety=nullableScore(data.satiety_after);
      if(photoPath){const url=await F.signedUrl(sb,photoPath,1800);if(url)preview.innerHTML=`<img src="${F.esc(url)}" alt="Photo du repas">`;}
      else if(data.source_recipe_image_url)preview.innerHTML=`<img src="${F.esc(data.source_recipe_image_url)}" alt="">`;
      const {data:itemRows}=await sb.from('food_meal_items').select('ciqual_code,food_dictionary_id,food_name,quantity_g,kcal_100g,protein_100g,fat_100g,carbs_100g,fiber_100g,salt_100g,micronutrients_100g').eq('meal_id',mealId).order('sort_order');
      items=(itemRows||[]).map(x=>({ciqual_code:x.ciqual_code,dictionary_id:x.food_dictionary_id,name:x.food_name,grams:Number(x.quantity_g)||100,kcal_100g:x.kcal_100g,protein_100g:x.protein_100g,fat_100g:x.fat_100g,carbs_100g:x.carbs_100g,fiber_100g:x.fiber_100g,salt_100g:x.salt_100g,micronutrients_100g:x.micronutrients_100g||{}}));
      document.getElementById('mealDelete').hidden=false;renderTypes();renderFeelings();renderItems();
    }

    let timer=0,searchSeq=0,recognizeTimer=0,recognizeSeq=0,recognizedRows=[];
    const hasNutritionRef=r=>!!r&&(!!r.code||['kcal_100g','protein_100g','fat_100g','carbs_100g','fiber_100g','salt_100g'].some(k=>r[k]!==null&&r[k]!==undefined&&r[k]!==''));
    desc.addEventListener('input',()=>{clearTimeout(recognizeTimer);const value=desc.value.trim();if(value.length<3){recognizedBox.hidden=true;recognizedBox.innerHTML='';return;}recognizeTimer=setTimeout(()=>recognizeDescription(value),500);});
    async function recognizeDescription(value){
      const seq=++recognizeSeq;
      try{recognizedRows=await F.resolveFoodText(sb,value,6);}catch(e){recognizedRows=[];}
      if(seq!==recognizeSeq)return;
      if(!recognizedRows.length){recognizedBox.hidden=true;recognizedBox.innerHTML='';return;}
      recognizedBox.hidden=false;
      recognizedBox.innerHTML=`<b>✶ ${recognizedRows.length>1?'Repères reconnus':'Plat reconnu'}</b><div class="mt-food-recognized-list">${recognizedRows.map((r,i)=>`<div><span>${F.esc(r.display_name)}</span><span>${r.ciqual_code||r.adapter_profile?.tee_has_custom_nutrition?`<button type="button" class="mt-food-text-btn" data-recognized="${i}">Confirmer</button>`:'<small>Composition connue · quantité non calculée</small>'}<button type="button" class="mt-food-text-btn" data-correct-recognized="${i}">Ce n’est pas ça</button></span></div>`).join('')}</div><small>Rien n’est imposé : confirme, ignore ou recherche l’aliment exact. Ton texte reste modifiable.</small>`;
      recognizedBox.querySelectorAll('[data-recognized]').forEach(btn=>btn.onclick=async()=>{
        const r=recognizedRows[Number(btn.dataset.recognized)];btn.disabled=true;
        try{const matches=await F.searchFoods(sb,r.canonical_name,10);const food=matches.find(x=>x.code===r.ciqual_code)||matches.find(x=>x.dictionary_id===r.id);if(!food||!hasNutritionRef(food))throw new Error();const name=food.display_name||food.name,profile=F.portionProfile(name);items.push({...food,ciqual_code:food.code||null,dictionary_id:food.dictionary_id||r.id,name,grams:F.gramsForPortion(name,profile.defaultAmount)});renderItems();btn.textContent='Repère ajouté';}
        catch(e){btn.disabled=false;F.toast('Ce plat est reconnu, mais son repère nutritionnel n’est pas encore relié.');}
      });
      recognizedBox.querySelectorAll('[data-correct-recognized]').forEach(btn=>btn.onclick=()=>{recognizedRows.splice(Number(btn.dataset.correctRecognized),1);recognizedBox.hidden=true;recognizedBox.innerHTML='';search.value='';search.focus();search.scrollIntoView({behavior:'smooth',block:'center'});F.toast('Recherche l’aliment exact ou corrige simplement ton texte.');});
    }
    search.addEventListener('input',()=>{clearTimeout(timer);const q=search.value.trim();if(q.length<3){results.hidden=true;results.innerHTML='';return;}timer=setTimeout(()=>doSearch(q),350);});
    async function doSearch(q){
      const seq=++searchSeq;results.hidden=false;results.innerHTML='<div class="mt-food-loading">Recherche…</div>';
      let rows=[];
      try{
        rows=await F.searchFoods(sb,q,10);
      }catch(e){rows=[];}
      if(seq!==searchSeq)return;
      results.innerHTML=rows.length?rows.map((r,i)=>{const name=r.display_name||r.name,p=F.portionProfile(name),g=F.gramsForPortion(name,p.defaultAmount),n=F.nutrientFromItem(r,g);let amount=p.defaultAmount===.5?'½':String(p.defaultAmount);const repere=p.kind==='g'?`100 g`:p.kind==='ml'?`${amount} ml`:`${amount} ${p.unit}`;return `<button type="button" class="mt-food-search-result" data-result="${i}"><span>${F.esc(name)}</span><small>${hasNutritionRef(r)&&n.kcal?`${p.estimated?'≈ ':''}${n.kcal} kcal · ${F.esc(repere)}`:'Plat reconnu · quantité à confirmer'}</small></button>`;}).join(''):'<div class="mt-food-loading">Aucun résultat. Tu peux simplement décrire le repas.</div>';
      results.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{const r=rows[Number(b.dataset.result)],name=r.display_name||r.name;search.value='';results.hidden=true;if(!hasNutritionRef(r)){if(!desc.value.toLocaleLowerCase('fr').includes(name.toLocaleLowerCase('fr')))desc.value=`${desc.value.trim()}${desc.value.trim()?', ':''}${name}`;desc.dispatchEvent(new Event('input'));F.toast('Plat reconnu. Aucun chiffre nutritionnel n’est inventé tant qu’il n’est pas relié à un repère.');return;}const profile=F.portionProfile(name);items.push({...r,ciqual_code:r.code||null,dictionary_id:r.dictionary_id||null,name,grams:F.gramsForPortion(name,profile.defaultAmount)});renderItems();});
    }


    const barcodeCacheKey='mt_off_cache_v1';
    function readBarcodeCache(){try{return JSON.parse(localStorage.getItem(barcodeCacheKey)||'{}')||{};}catch(_){return {};}}
    function writeBarcodeCache(cache){try{const entries=Object.entries(cache).sort((a,b)=>(b[1]?.at||0)-(a[1]?.at||0)).slice(0,40);localStorage.setItem(barcodeCacheKey,JSON.stringify(Object.fromEntries(entries)));}catch(_){}}
    function offNutriment(n,key){const v=Number(n?.[`${key}_100g`]);return Number.isFinite(v)?v:null;}
    function showBarcodeStatus(title,copy){if(!barcodeStatus)return;barcodeStatus.hidden=false;barcodeStatus.innerHTML=`<b>${F.esc(title)}</b>${F.esc(copy)}`;}
    async function lookupBarcode(raw){
      const code=String(raw||'').replace(/\D/g,'');if(code.length<8||code.length>14)throw new Error('Code-barres invalide.');
      const cache=readBarcodeCache(),cached=cache[code];if(cached&&Date.now()-Number(cached.at||0)<7*86400000)return cached.product;
      showBarcodeStatus('Recherche du produit…','Quelques secondes suffisent pour retrouver ses repères nutritionnels.');
      const url=`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,nutriments,serving_size,image_front_small_url`;
      const res=await fetch(url,{headers:{Accept:'application/json'}});if(!res.ok)throw new Error('Produit introuvable pour le moment.');const json=await res.json();
      if(Number(json.status)!==1||!json.product)throw new Error('Ce produit n’est pas encore disponible dans le catalogue.');
      cache[code]={at:Date.now(),product:json.product};writeBarcodeCache(cache);return json.product;
    }
    function productToItem(product,code){
      const n=product.nutriments||{},name=String(product.product_name||'').trim()||`Produit ${code}`,brand=String(product.brands||'').split(',')[0]?.trim(),display=brand&&!name.toLocaleLowerCase('fr').includes(brand.toLocaleLowerCase('fr'))?`${name} · ${brand}`:name;
      const kcal=offNutriment(n,'energy-kcal'),protein=offNutriment(n,'proteins'),fat=offNutriment(n,'fat'),carbs=offNutriment(n,'carbohydrates'),fiber=offNutriment(n,'fiber'),salt=offNutriment(n,'salt');
      if([kcal,protein,fat,carbs,fiber,salt].some(v=>v===null))throw new Error('Produit reconnu, mais son étiquette nutritionnelle est trop incomplète pour calculer le repas sans inventer de valeur. Tu peux le décrire manuellement.');
      return {name:display,grams:100,ciqual_code:null,dictionary_id:null,kcal_100g:kcal??0,protein_100g:protein??0,fat_100g:fat??0,carbs_100g:carbs??0,fiber_100g:fiber??0,salt_100g:salt??0,micronutrients_100g:{_source:'Open Food Facts',_barcode:String(code),_incomplete:[['kcal',kcal],['protein',protein],['fat',fat],['carbs',carbs],['fiber',fiber],['salt',salt]].filter(([,v])=>v===null).map(([k])=>k)}};
    }
    async function useBarcode(code){
      try{const product=await lookupBarcode(code),item=productToItem(product,code);items.push(item);renderItems();showBarcodeStatus('Produit ajouté',`${item.name} · vérifie simplement la portion réellement consommée.`);F.toast('Produit ajouté au repas.');}
      catch(e){showBarcodeStatus('Scan non ajouté',e.message||'Impossible de récupérer ce produit.');F.toast(e.message||'Produit introuvable.');}
    }
    barcodeScan?.addEventListener('click',async()=>{
      try{
        const cap=window.Capacitor,p=cap?.Plugins?.BarcodeScanner||(typeof cap?.registerPlugin==='function'?cap.registerPlugin('BarcodeScanner'):null);
        if(!p?.scan){const code=prompt('Saisis les chiffres sous le code-barres :');if(code)await useBarcode(code);return;}
        const out=await p.scan();if(out?.code)await useBarcode(out.code);
      }catch(e){if(String(e?.message||'').toLowerCase().includes('cam'))F.toast(e.message);else {const code=prompt('Saisis les chiffres sous le code-barres :');if(code)await useBarcode(code);}}
    });

    photoInput.onchange=()=>{const f=photoInput.files?.[0];if(!f)return;photoFile=f;const url=URL.createObjectURL(f);preview.innerHTML=`<img src="${url}" alt="Aperçu">`;};

    async function save(){
      const saveBtns=[document.getElementById('mealSave'),document.getElementById('mealSaveTop')];saveBtns.forEach(b=>b.disabled=true);
      try{
        const hasMealContent=Boolean(desc.value.trim()||items.length||photoFile||photoPath||recipeSource?.id||currentMeal?.source_recipe_id);
        if(!hasMealContent)throw new Error('Ajoute au moins une description, un aliment ou une photo avant d’enregistrer.');
        const id=currentMeal?.id||crypto.randomUUID();
        if(photoFile)photoPath=await F.uploadMealPhoto(sb,user,photoFile,id,photoPath);
        const calculated=F.sumNutrition(items.map(i=>itemTotals(i)));
        const row={id,user_id:user.id,meal_date:mealDate,meal_type:mealType,meal_time:time.value||F.mealTimes[mealType],description:desc.value.trim(),photo_path:photoPath||null,source_recipe_id:recipeSource?.id||currentMeal?.source_recipe_id||null,source_recipe_title:recipeSource?.title||currentMeal?.source_recipe_title||null,source_recipe_image_url:recipeSource?.image_url||currentMeal?.source_recipe_image_url||null,kcal_total:calculated.kcal,protein_total:calculated.protein,fat_total:calculated.fat,carbs_total:calculated.carbs,fiber_total:calculated.fiber,salt_total:calculated.salt,energy_after:feelings.energy,digestion_after:feelings.digestion,satiety_after:feelings.satiety,updated_at:new Date().toISOString()};
        const {error}=await sb.from('food_meals').upsert(row,{onConflict:'id'});if(error)throw error;
        await sb.from('food_meal_items').delete().eq('meal_id',id);
        if(items.length){const insert=items.map((i,idx)=>{const n=itemTotals(i),micro100=i.micronutrients_100g||{},micros=window.MTFood.micronutrientsFromFood(i,Number(i.grams)||100);return {meal_id:id,sort_order:idx,ciqual_code:i.ciqual_code||null,food_dictionary_id:i.dictionary_id||null,food_name:i.name,quantity_g:Number(i.grams)||100,kcal_100g:Number(i.kcal_100g)||0,protein_100g:Number(i.protein_100g)||0,fat_100g:Number(i.fat_100g)||0,carbs_100g:Number(i.carbs_100g)||0,fiber_100g:Number(i.fiber_100g)||0,salt_100g:Number(i.salt_100g)||0,micronutrients_100g:micro100,micronutrients:micros,kcal:n.kcal,protein:n.protein,fat:n.fat,carbs:n.carbs,fiber:n.fiber,salt:n.salt};});const r=await sb.from('food_meal_items').insert(insert);if(r.error)throw r.error;}
        rememberMeal();
        try{localStorage.removeItem(`mt_tee_balance_v4_${user.id}_${mealDate}`);localStorage.removeItem(`mt_tee_balance_v8_${user.id}_${mealDate}`);}catch(e){}
        location.href=`food-day.html?date=${mealDate}`;
      }catch(e){console.warn('meal save',e);F.toast(e.message||'Impossible d’enregistrer ce repas.');saveBtns.forEach(b=>b.disabled=false);}
    }
    document.getElementById('mealSave').onclick=save;document.getElementById('mealSaveTop').onclick=save;
    document.getElementById('mealDelete').onclick=async()=>{if(!currentMeal||!confirm('Supprimer ce repas de ton carnet ?'))return;try{await sb.from('food_meals').delete().eq('id',currentMeal.id).eq('user_id',user.id);await F.deleteMealPhoto(sb,currentMeal.photo_path);location.href=`food-day.html?date=${mealDate}`;}catch(e){F.toast('Suppression impossible.')}};

    renderTypes();renderFeelings();renderItems();renderQuick();time.value=F.mealTimes[mealType]||'13:00';
    if(mealId)await loadExisting();else if(F.qs('recipe_id'))await loadRecipe(F.qs('recipe_id'));
    if(desc.value.trim().length>=3)recognizeDescription(desc.value.trim());
  });
})();
