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
    const nutritionLabels={kcal:'calories',protein:'protéines',fat:'lipides',carbs:'glucides',fiber:'fibres',salt:'sel'};
    function missingNutrition(i){
      const missing=new Set(Array.isArray(i?.micronutrients_100g?._incomplete)?i.micronutrients_100g._incomplete:[]);
      const fields={kcal:'kcal_100g',protein:'protein_100g',fat:'fat_100g',carbs:'carbs_100g',fiber:'fiber_100g',salt:'salt_100g'};
      Object.entries(fields).forEach(([key,field])=>{if(i?.[field]===null||i?.[field]===undefined||i?.[field]==='')missing.add(key);});
      return [...missing];
    }
    function scannedUnit(i){return i?.micronutrients_100g?._quantity_unit||null;}
    function renderItems(){
      itemsBox.innerHTML=items.length?items.map((i,idx)=>{
        const n=itemTotals(i),unit=scannedUnit(i),profile=unit?{min:.1,step:unit==='ml'?10:1,unit,estimated:false}:F.portionProfile(i.name),amount=unit?(Number(i.grams)||100):(F.portionFromGrams(i.name,Number(i.grams)||0)||profile.defaultAmount),missing=missingNutrition(i);
        const kcal=i.kcal_100g===null||i.kcal_100g===undefined?'':`${profile.estimated?'≈ ':''}${n.kcal} kcal`;
        const quality=missing.length?`Repères partiels · ${missing.map(k=>nutritionLabels[k]||k).join(', ')} non renseigné${missing.length>1?'s':''}`:'';
        return `<div class="mt-food-item"><div><b>${F.esc(i.name)}</b><small>${F.esc([kcal,quality].filter(Boolean).join(' · '))}</small></div><label class="mt-food-quantity"><input type="number" min="${profile.min}" max="2000" step="${profile.step}" value="${amount}" data-portion="${idx}" aria-label="Quantité"><span>${F.esc(profile.unit)}</span></label><button type="button" data-remove="${idx}" aria-label="Retirer">×</button></div>`;
      }).join(''):'<p class="mt-food-summary-note">Tu peux enregistrer ton repas avec une description seule, ou ajouter des aliments pour obtenir des repères nutritionnels plus précis.</p>';
      itemsBox.querySelectorAll('[data-portion]').forEach(inp=>inp.onchange=()=>{const i=items[Number(inp.dataset.portion)],unit=scannedUnit(i),profile=unit?{min:.1,defaultAmount:100}:F.portionProfile(i.name),amount=Math.max(profile.min,Number(inp.value)||profile.defaultAmount);i.grams=unit?amount:F.gramsForPortion(i.name,amount);renderItems();});
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
      const {data:itemRows}=await sb.from('food_meal_items').select('ciqual_code,food_dictionary_id,food_name,quantity_g,kcal_100g,protein_100g,fat_100g,carbs_100g,fiber_100g,salt_100g,micronutrients_100g,nutrition_extra_100g').eq('meal_id',mealId).order('sort_order');
      items=(itemRows||[]).map(x=>({ciqual_code:x.ciqual_code,dictionary_id:x.food_dictionary_id,name:x.food_name,grams:Number(x.quantity_g)||100,kcal_100g:x.kcal_100g,protein_100g:x.protein_100g,fat_100g:x.fat_100g,carbs_100g:x.carbs_100g,fiber_100g:x.fiber_100g,salt_100g:x.salt_100g,micronutrients_100g:x.micronutrients_100g||{},nutrition_extra_100g:x.nutrition_extra_100g||{}}));
      document.getElementById('mealDelete').hidden=false;renderTypes();renderFeelings();renderItems();
    }

    let timer=0,searchSeq=0,recognizeTimer=0,recognizeSeq=0,recognizedRows=[];
    const hasNutritionRef=r=>!!r&&(!!r.code||(r.adapter_profile?.tee_has_custom_nutrition===true&&r.adapter_profile?.tee_custom_nutrition_verified===true));
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
    function offNutriment(n,key){const raw=n?.[`${key}_100g`];if(raw===null||raw===undefined||raw==='')return null;const v=Number(raw);return Number.isFinite(v)?v:null;}
    function showBarcodeStatus(title,copy){if(!barcodeStatus)return;barcodeStatus.hidden=false;barcodeStatus.innerHTML=`<b>${F.esc(title)}</b>${F.esc(copy)}`;}
    async function lookupBarcode(raw){
      const code=String(raw||'').replace(/\D/g,'');if(code.length<8||code.length>14)throw new Error('Code-barres invalide.');
      const cache=readBarcodeCache(),cached=cache[code];if(cached&&Date.now()-Number(cached.at||0)<7*86400000)return cached.product;
      showBarcodeStatus('Recherche du produit…','Quelques secondes suffisent pour retrouver ses repères nutritionnels.');
      const url=`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,nutriments,serving_size,serving_quantity,product_quantity,product_quantity_unit,nutrition_data_per,categories_tags,image_front_small_url`;
      const res=await fetch(url,{headers:{Accept:'application/json'}});if(!res.ok)throw new Error('Produit introuvable pour le moment.');const json=await res.json();
      if(Number(json.status)!==1||!json.product)throw new Error('Ce produit n’est pas encore disponible dans le catalogue.');
      cache[code]={at:Date.now(),product:json.product};writeBarcodeCache(cache);return json.product;
    }
    const OFF_CORE_BASES=new Set(['energy-kcal','proteins','fat','carbohydrates','fiber','salt']);
    const OFF_EXTRA_NAMES={
      'saturated-fat':'saturated_fat_g','sugars':'sugars_g','sodium':'sodium_g','trans-fat':'trans_fat_g',
      'monounsaturated-fat':'monounsaturated_fat_g','polyunsaturated-fat':'polyunsaturated_fat_g',
      'starch':'starch_g','polyols':'polyols_g','alcohol':'alcohol_g','cholesterol':'cholesterol_g',
      'omega-3-fat':'omega3_g','omega-6-fat':'omega6_g','energy-kj':'energy_kj'
    };
    function offExtraNutrition(n){
      const out={_source:'Open Food Facts'};
      const toGrams=(value,unit)=>{const u=String(unit||'g').toLowerCase().replace('μ','µ');if(u==='g'||!u)return value;if(u==='mg')return value/1000;if(u==='µg'||u==='ug')return value/1e6;return null;};
      Object.entries(n||{}).forEach(([rawKey,rawValue])=>{
        if(!rawKey.endsWith('_100g'))return;
        const base=rawKey.slice(0,-5);if(OFF_CORE_BASES.has(base))return;
        let value=Number(rawValue);if(!Number.isFinite(value))return;
        const key=OFF_EXTRA_NAMES[base]||`off_${base.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}`;
        let unit=String(n?.[`${base}_unit`]||(/_g$/.test(key)?'g':key==='energy_kj'?'kJ':''));
        if(/_g$/.test(key)){const normalized=toGrams(value,unit);if(normalized===null)return;value=normalized;unit='g';}
        out[key]={value,unit,source:'Open Food Facts',original_key:base};
      });
      return out;
    }
    const OFF_MICRO_MAP={
      iron:['iron_mg','mg'],calcium:['calcium_mg','mg'],zinc:['zinc_mg','mg'],iodine:['iodine_ug','µg'],
      magnesium:['magnesium_mg','mg'],phosphorus:['phosphorus_mg','mg'],potassium:['potassium_mg','mg'],selenium:['selenium_ug','µg'],
      'vitamin-b1':['vitamin_b1_mg','mg'],'vitamin-b2':['vitamin_b2_mg','mg'],'vitamin-b3':['vitamin_b3_mg','mg'],'vitamin-pp':['vitamin_b3_mg','mg'],
      'vitamin-b6':['vitamin_b6_mg','mg'],'vitamin-b9':['vitamin_b9_ug','µg'],folates:['vitamin_b9_ug','µg'],'vitamin-b12':['vitamin_b12_ug','µg'],
      'vitamin-c':['vitamin_c_mg','mg'],'vitamin-d':['vitamin_d_ug','µg'],'vitamin-e':['vitamin_e_mg','mg'],'omega-3-fat':['omega3_g','g']
    };
    function offUnitFactor(from,to){
      const f=String(from||'').toLowerCase().replace('μ','µ'),t=String(to||'').toLowerCase().replace('μ','µ');
      const grams={g:1,mg:1e-3,'µg':1e-6,ug:1e-6};
      if(!(f in grams)||!(t in grams))return f===t?1:null;
      return grams[f]/grams[t];
    }
    function offMicronutrients(n,code,unit,serving){
      const out={_source:'Open Food Facts',_barcode:String(code),_quantity_unit:unit,_basis:unit==='ml'?'100ml':'100g',_serving_amount:serving?.amount||null,_serving_label:serving?.label||null};
      Object.entries(OFF_MICRO_MAP).forEach(([base,[key,targetUnit]])=>{
        const raw=n?.[`${base}_100g`];if(raw===null||raw===undefined||raw==='')return;
        const value=Number(raw);if(!Number.isFinite(value))return;
        const sourceUnit=String(n?.[`${base}_unit`]||targetUnit),factor=offUnitFactor(sourceUnit,targetUnit);if(factor===null)return;
        out[key]={value:Math.round(value*factor*1e6)/1e6,unit:targetUnit,source:'Open Food Facts'};
      });
      return out;
    }
    function productToItem(product,code){
      const n=product.nutriments||{},name=String(product.product_name||'').trim()||`Produit ${code}`,brand=String(product.brands||'').split(',')[0]?.trim(),display=brand&&!name.toLocaleLowerCase('fr').includes(brand.toLocaleLowerCase('fr'))?`${name} · ${brand}`:name;
      const kcal=offNutriment(n,'energy-kcal'),protein=offNutriment(n,'proteins'),fat=offNutriment(n,'fat'),carbs=offNutriment(n,'carbohydrates'),fiber=offNutriment(n,'fiber'),salt=offNutriment(n,'salt');
      const values=[['kcal',kcal],['protein',protein],['fat',fat],['carbs',carbs],['fiber',fiber],['salt',salt]],available=values.filter(([,v])=>v!==null);
      if(!available.length)throw new Error('Produit reconnu, mais aucune donnée nutritionnelle exploitable n’est disponible. Tu peux toujours le décrire manuellement.');
      const serving=parseProductServing(product),unit=serving?.unit||productMeasureUnit(product),extra=offExtraNutrition(n),micros=offMicronutrients(n,code,unit,serving);
      extra._barcode=String(code);extra._basis=unit==='ml'?'100ml':'100g';
      micros._incomplete=values.filter(([,v])=>v===null).map(([k])=>k);
      return {name:display,grams:serving?.amount||100,ciqual_code:null,dictionary_id:null,kcal_100g:kcal,protein_100g:protein,fat_100g:fat,carbs_100g:carbs,fiber_100g:fiber,salt_100g:salt,nutrition_extra_100g:extra,micronutrients_100g:micros};
    }
    function productMeasureUnit(product){
      const explicit=String(product?.product_quantity_unit||'').toLowerCase(),serving=String(product?.serving_size||'').toLowerCase(),categories=(product?.categories_tags||[]).join(' ').toLowerCase();
      return /\b(ml|cl|litre|liter|l)\b/.test(`${explicit} ${serving}`)||/(beverage|boisson|drink|juice|jus|milk|lait|soda|water|eau)/.test(categories)?'ml':'g';
    }
    function parseProductServing(product){
      const label=String(product?.serving_size||'').trim(),match=label.replace(',','.').match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/i);let amount=match?Number(match[1]):Number(product?.serving_quantity),unit=match?.[2]?.toLowerCase()||productMeasureUnit(product);
      if(!Number.isFinite(amount)||amount<=0)return null;
      if(unit==='kg'){amount*=1000;unit='g';}else if(unit==='cl'){amount*=10;unit='ml';}else if(unit==='l'){amount*=1000;unit='ml';}
      return {amount:Math.round(amount*10)/10,unit,label:label||`${amount} ${unit}`};
    }
    function chooseProductPortion(item){
      const meta=item.micronutrients_100g||{},serving=Number(meta._serving_amount),unit=meta._quantity_unit||'g';
      if(!serving)return Promise.resolve(100);
      return new Promise(resolve=>{
        document.getElementById('mtBarcodePortionSheet')?.remove();const restoreY=window.scrollY||0,wrap=document.createElement('div');wrap.id='mtBarcodePortionSheet';wrap.className='mt-food-code-sheet mt-food-choice-sheet';wrap.innerHTML=`<div class="mt-food-code-backdrop" data-close-portion></div><section class="mt-food-code-panel mt-food-choice-panel" role="dialog" aria-modal="true" aria-labelledby="mtBarcodePortionTitle"><button type="button" class="mt-food-code-close" data-close-portion aria-label="Fermer">×</button><small>PORTION DU PRODUIT</small><h3 id="mtBarcodePortionTitle">Quelle base veux-tu utiliser ?</h3><p>Tu pourras encore ajuster la quantité après l’ajout.</p><div class="mt-food-choice-actions"><button type="button" class="mt-food-choice-action is-primary" data-portion-value="${serving}"><span class="mt-food-choice-mark">1×</span><span><b>Portion indiquée</b><small>${F.esc(meta._serving_label||`${serving} ${unit}`)}</small></span><i>›</i></button><button type="button" class="mt-food-choice-action" data-portion-value="100"><span class="mt-food-choice-mark">100</span><span><b>Base 100 ${unit}</b><small>Repère standard de l’étiquette</small></span><i>›</i></button></div></section>`;document.body.appendChild(wrap);requestAnimationFrame(()=>wrap.classList.add('open'));
        let done=false;const finish=value=>{if(done)return;done=true;closeBarcodeSheet(wrap,restoreY);resolve(value);};wrap.querySelectorAll('[data-close-portion]').forEach(x=>x.onclick=()=>finish(null));wrap.querySelectorAll('[data-portion-value]').forEach(x=>x.onclick=()=>finish(Number(x.dataset.portionValue)));
      });
    }
    async function useBarcode(code){
      try{const product=await lookupBarcode(code),item=productToItem(product,code),portion=await chooseProductPortion(item);if(!portion)return;item.grams=portion;items.push(item);renderItems();const missing=missingNutrition(item);showBarcodeStatus('Produit ajouté',`${item.name} · ${portion} ${scannedUnit(item)}${missing.length?` · données partielles clairement signalées`:''}.`);F.toast('Produit ajouté au repas.');}
      catch(e){showBarcodeStatus('Scan non ajouté',e.message||'Impossible de récupérer ce produit.');F.toast(e.message||'Produit introuvable.');}
    }
    function closeBarcodeSheet(wrap,restoreY){
      try{const active=document.activeElement;if(active&&typeof active.blur==='function')active.blur();}catch(_){ }
      wrap?.classList.remove('open');
      const restore=()=>{try{window.scrollTo(0,Math.max(0,Number(restoreY)||0));}catch(_){ }};
      requestAnimationFrame(()=>requestAnimationFrame(restore));
      setTimeout(restore,90);setTimeout(restore,240);
      setTimeout(()=>wrap?.remove(),260);
    }
    function openBarcodeManual(){
      document.getElementById('mtBarcodeChoiceSheet')?.remove();
      document.getElementById('mtBarcodeManualSheet')?.remove();
      const restoreY=window.scrollY||window.pageYOffset||0;
      const wrap=document.createElement('div');wrap.id='mtBarcodeManualSheet';wrap.className='mt-food-code-sheet';wrap.innerHTML=`<div class="mt-food-code-backdrop" data-close-code></div><section class="mt-food-code-panel" role="dialog" aria-modal="true" aria-labelledby="mtBarcodeCodeTitle"><button type="button" class="mt-food-code-close" data-close-code aria-label="Fermer">×</button><small>AJOUTER UN PRODUIT</small><h3 id="mtBarcodeCodeTitle">Saisir le code-barres</h3><p>Entre les chiffres indiqués sous le code-barres du produit.</p><input id="mtBarcodeManualInput" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="14" placeholder="Ex. 3760123456789" aria-label="Code-barres du produit"><button type="button" class="mt-food-code-confirm" id="mtBarcodeManualConfirm">Ajouter le produit</button></section>`;
      document.body.appendChild(wrap);requestAnimationFrame(()=>wrap.classList.add('open'));
      const input=wrap.querySelector('#mtBarcodeManualInput'),close=()=>closeBarcodeSheet(wrap,restoreY);
      wrap.querySelectorAll('[data-close-code]').forEach(b=>b.addEventListener('click',close));
      wrap.querySelector('#mtBarcodeManualConfirm')?.addEventListener('click',async()=>{const code=String(input?.value||'').replace(/\D/g,'');if(code.length<8||code.length>14){F.toast('Vérifie le code saisi.');input?.focus();return;}try{input?.blur();}catch(_){ }close();setTimeout(()=>useBarcode(code),280);});
      input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();wrap.querySelector('#mtBarcodeManualConfirm')?.click();}});
      // Pas d'auto-focus : on évite l'ouverture/fermeture brutale du clavier iOS et le saut de viewport.
    }
    let barcodeCameraBusy=false;
    function barcodeCameraPlugin(){
      const cap=window.Capacitor;
      const native=typeof cap?.isNativePlatform==='function'?cap.isNativePlatform():['ios','android'].includes(cap?.getPlatform?.());
      if(!native)return null;
      if(typeof cap?.isPluginAvailable==='function'&&!cap.isPluginAvailable('BarcodeScanner'))return null;
      const plugin=cap?.Plugins?.BarcodeScanner||(typeof cap?.registerPlugin==='function'?cap.registerPlugin('BarcodeScanner'):null);
      return typeof plugin?.scan==='function'?plugin:null;
    }
    async function scanBarcodeWithCamera(){
      if(barcodeCameraBusy)return;
      barcodeCameraBusy=true;
      if(barcodeScan)barcodeScan.disabled=true;
      try{
        const plugin=barcodeCameraPlugin();
        if(!plugin){openBarcodeManual();return;}
        const out=await plugin.scan();
        if(out?.cancelled)return;
        if(out?.manual){openBarcodeManual();return;}
        if(out?.code){await useBarcode(out.code);return;}
        throw new Error('Aucun code reconnu. Tu peux le saisir manuellement.');
      }catch(e){
        if(['CANCELLED','USER_CANCELLED'].includes(String(e?.code||'')))return;
        const msg=String(e?.message||'').trim();
        const copy=msg||'Le scan n’a pas pu démarrer. Tu peux saisir le code-barres.';
        showBarcodeStatus('Caméra indisponible',copy);
        F.toast(copy);
        openBarcodeManual();
      }finally{
        barcodeCameraBusy=false;
        if(barcodeScan)barcodeScan.disabled=false;
      }
    }
    function openBarcodeChoice(){
      document.getElementById('mtBarcodeChoiceSheet')?.remove();
      const restoreY=window.scrollY||window.pageYOffset||0;
      const canCamera=!!barcodeCameraPlugin();
      const wrap=document.createElement('div');wrap.id='mtBarcodeChoiceSheet';wrap.className='mt-food-code-sheet mt-food-choice-sheet';wrap.innerHTML=`<div class="mt-food-code-backdrop" data-close-choice></div><section class="mt-food-code-panel mt-food-choice-panel" role="dialog" aria-modal="true" aria-labelledby="mtBarcodeChoiceTitle"><button type="button" class="mt-food-code-close" data-close-choice aria-label="Fermer">×</button><small>AJOUTER UN PRODUIT</small><h3 id="mtBarcodeChoiceTitle">Comment veux-tu l’ajouter ?</h3><p>Choisis simplement la méthode disponible qui te convient.</p><div class="mt-food-choice-actions">${canCamera?`<button type="button" class="mt-food-choice-action is-primary" data-scan-camera><span class="mt-food-choice-mark">▥</span><span><b>Scanner avec l’appareil photo</b><small>Cadre le code-barres du produit</small></span><i>›</i></button>`:''}<button type="button" class="mt-food-choice-action" data-enter-code><span class="mt-food-choice-mark">123</span><span><b>Saisir le code-barres</b><small>Entre les chiffres inscrits sous le code</small></span><i>›</i></button></div>${canCamera?'':`<div class="mt-food-choice-note">Le scan caméra est disponible dans l’app iPhone. La saisie du code reste disponible ici.</div>`}</section>`;
      document.body.appendChild(wrap);requestAnimationFrame(()=>wrap.classList.add('open'));
      const close=()=>closeBarcodeSheet(wrap,restoreY);
      wrap.querySelectorAll('[data-close-choice]').forEach(b=>b.addEventListener('click',close));
      wrap.querySelector('[data-scan-camera]')?.addEventListener('click',()=>{close();setTimeout(scanBarcodeWithCamera,260);});
      wrap.querySelector('[data-enter-code]')?.addEventListener('click',()=>{close();setTimeout(openBarcodeManual,260);});
    }
    barcodeScan?.addEventListener('click',openBarcodeChoice);

    photoInput.onchange=()=>{const f=photoInput.files?.[0];if(!f)return;photoFile=f;const url=URL.createObjectURL(f);preview.innerHTML=`<img src="${url}" alt="Aperçu">`;};

    let savingMeal=false;
    async function save(){
      if(savingMeal)return;
      savingMeal=true;
      const saveBtns=[document.getElementById('mealSave'),document.getElementById('mealSaveTop')].filter(Boolean);
      saveBtns.forEach(b=>{
        b.dataset.idleLabel=b.textContent;
        b.disabled=true;
        b.setAttribute('aria-busy','true');
        b.textContent='Enregistrement…';
      });
      // Laisse iOS peindre immédiatement l'état occupé avant les écritures Supabase.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      try{
        const hasMealContent=Boolean(desc.value.trim()||items.length||photoFile||photoPath||recipeSource?.id||currentMeal?.source_recipe_id);
        if(!hasMealContent)throw new Error('Ajoute au moins une description, un aliment ou une photo avant d’enregistrer.');
        const id=currentMeal?.id||crypto.randomUUID();
        if(photoFile)photoPath=await F.uploadMealPhoto(sb,user,photoFile,id,photoPath);
        const itemNutrition=items.map(i=>itemTotals(i)),calculated=F.sumNutrition(itemNutrition);
        const itemExtras=items.map(i=>F.nutritionExtraFromFood(i,Number(i.grams)||100));
        const extraTotal=F.sumNutritionExtra(items.map((i,idx)=>({nutrition_extra:itemExtras[idx]})));
        const row={id,user_id:user.id,meal_date:mealDate,meal_type:mealType,meal_time:time.value||F.mealTimes[mealType],description:desc.value.trim(),photo_path:photoPath||null,source_recipe_id:recipeSource?.id||currentMeal?.source_recipe_id||null,source_recipe_title:recipeSource?.title||currentMeal?.source_recipe_title||null,source_recipe_image_url:recipeSource?.image_url||currentMeal?.source_recipe_image_url||null,kcal_total:calculated.kcal,protein_total:calculated.protein,fat_total:calculated.fat,carbs_total:calculated.carbs,fiber_total:calculated.fiber,salt_total:calculated.salt,nutrition_extra_total:extraTotal,energy_after:feelings.energy,digestion_after:feelings.digestion,satiety_after:feelings.satiety,updated_at:new Date().toISOString()};
        const {error}=await sb.from('food_meals').upsert(row,{onConflict:'id'});if(error)throw error;
        await sb.from('food_meal_items').delete().eq('meal_id',id);
        if(items.length){const insert=items.map((i,idx)=>{const n=itemTotals(i),micro100=i.micronutrients_100g||{},micros=window.MTFood.micronutrientsFromFood(i,Number(i.grams)||100),extra100=i.nutrition_extra_100g||{},extra=window.MTFood.nutritionExtraFromFood(i,Number(i.grams)||100),numberOrNull=value=>value===null||value===undefined||value===''?null:Number(value);return {meal_id:id,sort_order:idx,ciqual_code:i.ciqual_code||null,food_dictionary_id:i.dictionary_id||null,food_name:i.name,quantity_g:Number(i.grams)||100,kcal_100g:numberOrNull(i.kcal_100g),protein_100g:numberOrNull(i.protein_100g),fat_100g:numberOrNull(i.fat_100g),carbs_100g:numberOrNull(i.carbs_100g),fiber_100g:numberOrNull(i.fiber_100g),salt_100g:numberOrNull(i.salt_100g),micronutrients_100g:micro100,micronutrients:micros,nutrition_extra_100g:extra100,nutrition_extra:extra,kcal:n.kcal,protein:n.protein,fat:n.fat,carbs:n.carbs,fiber:n.fiber,salt:n.salt};});const r=await sb.from('food_meal_items').insert(insert);if(r.error)throw r.error;}
        rememberMeal();
        try{localStorage.removeItem(`mt_tee_balance_v4_${user.id}_${mealDate}`);localStorage.removeItem(`mt_tee_balance_v8_${user.id}_${mealDate}`);}catch(e){}
        location.href=`food-day.html?date=${mealDate}`;
      }catch(e){
        console.warn('meal save',e);
        F.toast(e.message||'Impossible d’enregistrer ce repas.');
        savingMeal=false;
        saveBtns.forEach(b=>{
          b.disabled=false;
          b.removeAttribute('aria-busy');
          b.textContent=b.dataset.idleLabel||'Enregistrer';
          delete b.dataset.idleLabel;
        });
      }
    }
    document.getElementById('mealSave').onclick=save;document.getElementById('mealSaveTop').onclick=save;
    document.getElementById('mealDelete').onclick=async()=>{if(!currentMeal||!confirm('Supprimer ce repas de ton carnet ?'))return;try{await sb.from('food_meals').delete().eq('id',currentMeal.id).eq('user_id',user.id);await F.deleteMealPhoto(sb,currentMeal.photo_path);location.href=`food-day.html?date=${mealDate}`;}catch(e){F.toast('Suppression impossible.')}};

    renderTypes();renderFeelings();renderItems();renderQuick();time.value=F.mealTimes[mealType]||'13:00';
    if(mealId)await loadExisting();else if(F.qs('recipe_id'))await loadRecipe(F.qs('recipe_id'));
    if(desc.value.trim().length>=3)recognizeDescription(desc.value.trim());
  });
})();
