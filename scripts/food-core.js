(function(){
  'use strict';
  const MTFood = window.MTFood = window.MTFood || {};
  const esc = (v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = ()=>new Date().toLocaleDateString('sv-SE');
  const qs = (k)=>new URLSearchParams(location.search).get(k);
  const fmtDate = (iso)=>{try{return new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${iso}T12:00:00`));}catch(e){return iso;}};
  const mealLabels={breakfast:'Petit-déjeuner',lunch:'Déjeuner',snack:'Collation',dinner:'Dîner'};
  const mealOrder=['breakfast','lunch','snack','dinner'];
  const mealTimes={breakfast:'08:30',lunch:'13:00',snack:'16:30',dinner:'20:00'};

  async function auth(){
    const sb=window.initSupabase&&window.initSupabase();
    if(!sb){ location.replace('auth.html'); return null; }
    const {data}=await sb.auth.getSession();
    const user=data?.session?.user||null;
    if(!user){
      const next=`${location.pathname}${location.search}${location.hash}`;
      location.replace(`auth.html?next=${encodeURIComponent(next)}`);
      return null;
    }
    return {sb,user};
  }

  function activateCarnetNav(){
    setTimeout(()=>{
      const nav=document.getElementById('bottomNav'); if(!nav)return;
      nav.querySelectorAll('a').forEach(a=>a.classList.remove('active'));
      const link=[...nav.querySelectorAll('a')].find(a=>/library\.html/i.test(a.getAttribute('href')||''));
      if(link)link.classList.add('active');
    },120);
  }

  async function signedUrl(sb,path,expires=3600){
    if(!path)return '';
    try{const {data,error}=await sb.storage.from('food-media').createSignedUrl(path,expires);if(error)throw error;return data?.signedUrl||'';}catch(e){return '';}
  }

  async function compressImage(file,maxPx=1280,quality=.76){
    if(!file)return null;
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,maxPx/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(bitmap,0,0,w,h);
    if(bitmap.close)bitmap.close();
    return await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
  }

  async function uploadMealPhoto(sb,user,file,mealId,oldPath=''){
    if(!file)return oldPath||'';
    const blob=await compressImage(file);
    if(!blob)throw new Error('Photo impossible à préparer.');
    const stamp=Date.now();
    const path=`${user.id}/${today()}/${mealId || crypto.randomUUID()}-${stamp}.webp`;
    const {error}=await sb.storage.from('food-media').upload(path,blob,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});
    if(error)throw error;
    if(oldPath && oldPath!==path){ try{await sb.storage.from('food-media').remove([oldPath]);}catch(e){} }
    return path;
  }

  async function deleteMealPhoto(sb,path){if(!path)return;try{await sb.storage.from('food-media').remove([path]);}catch(e){}}

  function toast(msg){
    if(window.mtToast)return window.mtToast(msg);
    let t=document.getElementById('mtFoodToast');
    if(!t){t=document.createElement('div');t.id='mtFoodToast';t.className='mt-food-toast';document.body.appendChild(t);}
    t.textContent=msg;t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),2200);
  }


  // Couche d'affichage des portions : CIQUAL reste en g/100 g en coulisses,
  // mais l'utilisateur manipule une unité naturelle quand elle est évidente.
  function portionProfile(name=''){
    const n=String(name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const has=(re)=>re.test(n);

    // Liquides : affichage en ml, calcul interne conservé en grammes (densité ≈ 1).
    if((/^lait\b/.test(n) && !has(/poudre|concentre|chocolat/)) ||
       /^boisson\b/.test(n) || /^jus\b/.test(n) || /^eau\b/.test(n) ||
       /^soda\b/.test(n) || /^limonade\b/.test(n) || /^cafe\b/.test(n) || /^the\b/.test(n)){
      return {kind:'ml',unit:'ml',gramsPerUnit:1,defaultAmount:100,step:10,min:10,estimated:true};
    }

    // Portions unitaires courantes.
    if(has(/burger|hamburger/)) return {kind:'piece',unit:'burger',gramsPerUnit:220,defaultAmount:1,step:.5,min:.5,estimated:true};
    if(has(/\boeuf\b|\boeufs\b|\bœuf\b|\bœufs\b/)) return {kind:'piece',unit:'œuf',gramsPerUnit:60,defaultAmount:1,step:1,min:1,estimated:true};
    if(has(/banane/)) return {kind:'piece',unit:'banane',gramsPerUnit:120,defaultAmount:1,step:.5,min:.5,estimated:true};
    if(has(/avocat/) && !has(/huile/)) return {kind:'piece',unit:'avocat',gramsPerUnit:150,defaultAmount:.5,step:.5,min:.5,estimated:true};
    if(has(/yaourt|yogourt|skyr/)) return {kind:'piece',unit:'pot',gramsPerUnit:125,defaultAmount:1,step:1,min:1,estimated:true};
    if(has(/pain de mie|toast|pain grille/)) return {kind:'piece',unit:'tranche',gramsPerUnit:30,defaultAmount:1,step:1,min:1,estimated:true};
    if(has(/\bpomme\b/) && !has(/compote|jus/)) return {kind:'piece',unit:'pomme',gramsPerUnit:150,defaultAmount:1,step:.5,min:.5,estimated:true};
    if(has(/\borange\b/) && !has(/jus/)) return {kind:'piece',unit:'orange',gramsPerUnit:150,defaultAmount:1,step:.5,min:.5,estimated:true};
    if(has(/\bkiwi\b/)) return {kind:'piece',unit:'kiwi',gramsPerUnit:75,defaultAmount:1,step:1,min:1,estimated:true};

    // Par défaut : le gramme reste pertinent (riz, chocolat, fromage, noix, etc.).
    return {kind:'g',unit:'g',gramsPerUnit:1,defaultAmount:100,step:5,min:1,estimated:false};
  }

  function gramsForPortion(name,amount){
    const p=portionProfile(name);return Math.max(0,(Number(amount)||0)*p.gramsPerUnit);
  }
  function portionFromGrams(name,grams){
    const p=portionProfile(name);const raw=(Number(grams)||0)/p.gramsPerUnit;
    return Math.round(raw*100)/100;
  }

  function nutrientFromItem(food,grams){
    const g=Math.max(0,Number(grams)||0),factor=g/100;
    const calc=(raw,precision=1)=>{
      if(raw===null||raw===undefined||raw==='')return null;
      const value=Number(raw);if(!Number.isFinite(value))return null;
      const p=10**precision;return Math.round(value*factor*p)/p;
    };
    return {
      kcal:calc(food.kcal_100g,1),
      protein:calc(food.protein_100g,1),
      fat:calc(food.fat_100g,1),
      carbs:calc(food.carbs_100g,1),
      fiber:calc(food.fiber_100g,1),
      salt:calc(food.salt_100g,2)
    };
  }

  function sumNutrition(items){
    const rows=Array.isArray(items)?items:[],out={};
    ['kcal','protein','fat','carbs','fiber','salt'].forEach(key=>{
      const vals=rows.map(i=>i?.[key]);
      out[key]=rows.length&&vals.every(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v)))
        ? vals.reduce((sum,v)=>sum+Number(v),0)
        : null;
    });
    return out;
  }

  function nutritionExtraFromFood(food,grams){
    const factor=Math.max(0,Number(grams)||0)/100,out={};
    Object.entries(food?.nutrition_extra_100g||{}).forEach(([key,raw])=>{
      if(String(key).startsWith('_'))return;
      const value=Number(raw?.value??raw);if(!Number.isFinite(value))return;
      const unit=raw?.unit||(/_mg$/.test(key)?'mg':/_ug$/.test(key)?'µg':'g');
      out[key]={value:Math.round(value*factor*1000)/1000,unit,source:raw?.source||food?.nutrition_extra_100g?._source||''};
    });
    return out;
  }

  function sumNutritionExtra(items){
    const rows=Array.isArray(items)?items:[];if(!rows.length)return {};
    const keys=[...new Set(rows.flatMap(i=>Object.keys(i?.nutrition_extra||{}).filter(k=>!k.startsWith('_'))))];
    const out={};
    keys.forEach(key=>{
      const vals=rows.map(i=>i?.nutrition_extra?.[key]);
      if(!vals.every(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v?.value??v))))return;
      const unit=vals.find(Boolean)?.unit||(/_mg$/.test(key)?'mg':/_ug$/.test(key)?'µg':'g');
      out[key]={value:Math.round(vals.reduce((sum,v)=>sum+Number(v?.value??v),0)*1000)/1000,unit};
    });
    return out;
  }

  function micronutrientsFromFood(food,grams){
    const factor=Math.max(0,Number(grams)||0)/100,out={};
    Object.entries(food?.micronutrients_100g||{}).forEach(([key,raw])=>{
      if(String(key).startsWith('_'))return; // métadonnées de provenance/portion, jamais des nutriments
      const value=Number(raw?.value??raw);if(!Number.isFinite(value))return;
      out[key]={value:Math.round(value*factor*1000)/1000,unit:raw?.unit||'',source:raw?.source||'ANSES - Table Ciqual 2025',version:raw?.version||'2025-11-03'};
    });return out;
  }

  // V376 · Une seule porte d'entrée vers la connaissance alimentaire distante.
  // Les réponses compactes sont mémorisées pour la session ; aucune donnée
  // personnelle n'entre dans ce cache.
  const foodKnowledgeCache=new Map();
  const foodCacheRead=key=>{const hit=foodKnowledgeCache.get(key);if(!hit)return null;if(Date.now()-hit.at>300000){foodKnowledgeCache.delete(key);return null;}return hit.rows;};
  const foodCacheWrite=(key,rows)=>{if(rows.length)foodKnowledgeCache.set(key,{rows,at:Date.now()});};
  async function searchFoods(sb,query,limit=10){
    const q=String(query||'').trim();if(q.length<3)return [];
    const key=`search:${q.toLocaleLowerCase('fr')}:${limit}`;
    const cached=foodCacheRead(key);if(cached)return cached;
    let {data,error}=await sb.rpc('search_foods_v4',{p_query:q,p_limit:Math.min(10,limit)});
    if(error){const v3=await sb.rpc('search_foods_v3',{p_query:q,p_limit:Math.min(10,limit)});data=v3.data;error=v3.error;}
    if(error){const fallback=await sb.rpc('search_foods_v2',{p_query:q,p_limit:Math.min(10,limit)});data=fallback.data;error=fallback.error;}
    if(error)throw error;
    const rows=Array.isArray(data)?data:[];foodCacheWrite(key,rows);return rows;
  }

  async function enrichNutritionReferences(sb,items,limit=16){
    const rows=(Array.isArray(items)?items:[]).map(x=>({...x}));
    const candidates=rows.filter(x=>x&&(x.ciqual_code||x.food_dictionary_id||x.dictionary_id)).slice(0,Math.max(1,limit));
    if(!candidates.length)return rows;
    const codes=[...new Set(candidates.map(x=>x.ciqual_code).filter(Boolean))];
    const dictIds=[...new Set(candidates.map(x=>x.food_dictionary_id||x.dictionary_id).filter(Boolean))];
    let refs=[];
    try{
      const {data,error}=await sb.rpc('mt_food_reference_lookup',{p_ciqual_codes:codes,p_dictionary_ids:dictIds});
      if(!error&&Array.isArray(data))refs=data;
    }catch(_){refs=[];}
    if(!refs.length){
      // Fallback ancien serveur : recherche uniquement pour les éléments reliés.
      for(const item of candidates){
        try{const found=await searchFoods(sb,item.food_name||item.name||'',10);const exact=found.find(r=>(item.ciqual_code&&r.code===item.ciqual_code)||((item.food_dictionary_id||item.dictionary_id)&&r.dictionary_id===(item.food_dictionary_id||item.dictionary_id)));if(exact)refs.push(exact);}catch(_){}
      }
    }
    const byCode=new Map(refs.filter(r=>r.code).map(r=>[String(r.code),r])),byDict=new Map(refs.filter(r=>r.dictionary_id).map(r=>[String(r.dictionary_id),r]));
    return rows.map(item=>{
      const ref=((item.food_dictionary_id||item.dictionary_id)&&byDict.get(String(item.food_dictionary_id||item.dictionary_id)))||(item.ciqual_code&&byCode.get(String(item.ciqual_code)));
      if(!ref)return item;
      const merged={...item};
      for(const key of ['kcal_100g','protein_100g','fat_100g','carbs_100g','fiber_100g','salt_100g'])if(merged[key]===null||merged[key]===undefined||merged[key]==='')merged[key]=ref[key];
      merged.nutrition_extra_100g={...(ref.nutrition_extra_100g||{}),...(merged.nutrition_extra_100g||{})};
      merged.micronutrients_100g={...(ref.micronutrients_100g||{}),...(merged.micronutrients_100g||{})};
      merged._reference_enriched=true;merged._reference_source=ref.source||ref.nutrition_source_label||'Référence alimentaire';
      return merged;
    });
  }
  async function resolveFoodText(sb,value,limit=12){
    const text=String(value||'').trim();if(text.length<3)return [];
    const key=`resolve:${text.toLocaleLowerCase('fr').slice(0,1000)}:${limit}`;
    const cached=foodCacheRead(key);if(cached)return cached;
    const {data,error}=await sb.rpc('resolve_food_text',{p_text:text,p_limit:Math.min(16,limit)});
    if(error)throw error;
    const rows=Array.isArray(data)?data:[];foodCacheWrite(key,rows);return rows;
  }

  // V418 · Clavier Safari/iOS — géométrie figée, aucun shell raccourci.
  // On NE touche plus à la hauteur du body/shell/page pendant la saisie.
  // Safari gère son visualViewport ; nous faisons uniquement deux choses :
  // 1) masquer visuellement la navbar sans la retirer du flux ;
  // 2) faire défiler le vrai scroller `.page` juste assez pour garder le champ visible.
  function installFoodKeyboardNav(){
    const selector='input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="tel"],input[type="url"],input[type="number"],input[type="password"],textarea,[contenteditable="true"]';
    const isTextEntry=(el)=>!!el?.matches?.(selector);
    let activeField=null;
    let closeTimer=0;
    let keepRaf=0;

    const pageScroller=()=>document.querySelector('.page');
    const keepFieldVisible=()=>{
      if(!activeField?.isConnected)return;
      const host=pageScroller();
      if(!host)return;
      const vv=window.visualViewport;
      const vvTop=(vv&&Number.isFinite(vv.offsetTop)?vv.offsetTop:0);
      const vvHeight=Math.max(1,(vv&&vv.height)||window.innerHeight||document.documentElement.clientHeight||1);
      const hostRect=host.getBoundingClientRect();
      const safeTop=Math.max(hostRect.top+10,vvTop+10);
      const safeBottom=Math.min(hostRect.bottom-10,vvTop+vvHeight-18);
      const rect=activeField.getBoundingClientRect();
      let delta=0;
      if(rect.bottom>safeBottom) delta=rect.bottom-safeBottom+14;
      else if(rect.top<safeTop) delta=rect.top-safeTop-14;
      if(Math.abs(delta)>1){
        const max=Math.max(0,host.scrollHeight-host.clientHeight);
        host.scrollTop=Math.max(0,Math.min(max,(host.scrollTop||0)+delta));
      }
    };
    const scheduleKeep=()=>{
      if(keepRaf)cancelAnimationFrame(keepRaf);
      keepRaf=requestAnimationFrame(()=>{ keepRaf=0; keepFieldVisible(); });
    };
    const open=(el)=>{
      clearTimeout(closeTimer);
      activeField=el;
      document.body.classList.add('mt-food-keyboard-open');
      scheduleKeep();
      [60,140,260,420].forEach(ms=>setTimeout(()=>{
        if(document.body.classList.contains('mt-food-keyboard-open'))keepFieldVisible();
      },ms));
    };
    const close=()=>{
      clearTimeout(closeTimer);
      closeTimer=setTimeout(()=>{
        if(isTextEntry(document.activeElement)){
          open(document.activeElement);
          return;
        }
        activeField=null;
        document.body.classList.remove('mt-food-keyboard-open');
      },180);
    };
    const reset=()=>{
      clearTimeout(closeTimer);
      if(keepRaf)cancelAnimationFrame(keepRaf);
      keepRaf=0;
      activeField=null;
      document.body.classList.remove('mt-food-keyboard-open');
    };

    document.addEventListener('focusin',(e)=>{if(isTextEntry(e.target))open(e.target);},true);
    document.addEventListener('focusout',close,true);
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize',scheduleKeep,{passive:true});
      window.visualViewport.addEventListener('scroll',scheduleKeep,{passive:true});
    }
    window.addEventListener('resize',scheduleKeep,{passive:true});
    window.addEventListener('pageshow',reset,{passive:true});
  }


  // V411.2 · Résolveur nutritionnel unique.
  // Le front ne décide plus lui-même si CIQUAL, un plat culturel ou un snapshot
  // historique est prioritaire : Supabase renvoie la meilleure source autorisée.
  const unifiedNutritionCache=new Map();
  const portionRemoteCache=new Map();

  function profileFromRemote(raw,fallback){
    if(!raw||!Number.isFinite(Number(raw.grams_per_unit))||Number(raw.grams_per_unit)<=0)return fallback;
    const unit=String(raw.unit||fallback?.unit||'g');
    const kind=unit==='g'?'g':unit==='ml'?'ml':'piece';
    return {
      kind,unit,
      gramsPerUnit:Number(raw.grams_per_unit),
      defaultAmount:Number(raw.default_amount)||fallback?.defaultAmount||1,
      step:Number(raw.step)||fallback?.step||1,
      min:Number(raw.min)||fallback?.min||.5,
      estimated:raw.estimated!==false,
      verified:raw.verified===true,
      sourceLabel:raw.source_label||'',
      notes:raw.notes||''
    };
  }
  function profileForItem(item){return item?._portion_profile||portionProfile(item?.name||item?.food_name||'');}
  function gramsForProfile(profile,amount){return Math.max(0,(Number(amount)||0)*Math.max(.000001,Number(profile?.gramsPerUnit)||1));}
  function portionFromProfile(profile,grams){const raw=(Number(grams)||0)/Math.max(.000001,Number(profile?.gramsPerUnit)||1);return Math.round(raw*100)/100;}
  async function resolvePortionProfile(sb,item={}){
    const fallback=portionProfile(item?.name||item?.food_name||'');
    if(!sb?.rpc)return fallback;
    const key=`${item?.ciqual_code||item?.code||''}|${item?.dictionary_id||item?.food_dictionary_id||''}|${item?.name||item?.food_name||''}`;
    if(portionRemoteCache.has(key))return portionRemoteCache.get(key);
    try{
      const {data,error}=await sb.rpc('mt_portion_profile',{
        p_name:item?.name||item?.food_name||'',
        p_ciqual_code:item?.ciqual_code||item?.code||null,
        p_dictionary_id:item?.dictionary_id||item?.food_dictionary_id||null
      });
      if(error)throw error;
      const profile=profileFromRemote(data,fallback);portionRemoteCache.set(key,profile);return profile;
    }catch(_){portionRemoteCache.set(key,fallback);return fallback;}
  }

  function applyResolvedReference(item,nutrition,{authoritative=true,historical=false}={}){
    const ref=nutrition?.reference_100g;if(!ref)return {...item};
    const out={...item};
    const map={kcal_100g:'kcal_100g',protein_100g:'protein_100g',fat_100g:'fat_100g',carbs_100g:'carbs_100g',fiber_100g:'fiber_100g',salt_100g:'salt_100g'};
    Object.entries(map).forEach(([field,key])=>{
      const value=ref?.[key];
      if(authoritative)out[field]=(value===undefined?'':value);
      else if(out[field]===null||out[field]===undefined||out[field]==='')out[field]=value;
    });
    if(authoritative||!out.nutrition_extra_100g)out.nutrition_extra_100g=ref.nutrition_extra_100g||{};
    else out.nutrition_extra_100g={...(ref.nutrition_extra_100g||{}),...(out.nutrition_extra_100g||{})};
    if(authoritative||!out.micronutrients_100g)out.micronutrients_100g=ref.micronutrients_100g||{};
    else out.micronutrients_100g={...(ref.micronutrients_100g||{}),...(out.micronutrients_100g||{})};
    out._resolved_reference=true;
    out._nutrition_basis=nutrition?.nutrition_basis||'100g';
    out._reference_kind=nutrition?.reference_kind||nutrition?.kind||'';
    out._reference_source=nutrition?.source_label||'';
    if(historical){out._historical_snapshot=true;out._meal_item_id=nutrition?.meal_item_id||out._meal_item_id||out.id||null;}
    return out;
  }

  async function prepareItemsForSnapshot(sb,items){
    const rows=(Array.isArray(items)?items:[]).map(x=>({...x}));
    const targets=rows.map((item,idx)=>({item,idx})).filter(x=>!x.item?._historical_snapshot&&(x.item?.ciqual_code||x.item?.code||x.item?.dictionary_id||x.item?.food_dictionary_id));
    if(!targets.length)return rows;
    const refs=targets.map(({item,idx})=>({
      client_key:String(idx),
      ciqual_code:item.ciqual_code||item.code||null,
      dictionary_id:item.dictionary_id||item.food_dictionary_id||null
    }));
    try{
      const {data,error}=await sb.rpc('mt_nutrition_resolve_batch',{p_refs:refs});if(error)throw error;
      (Array.isArray(data)?data:[]).forEach(entry=>{const idx=Number(entry?.client_key);if(Number.isInteger(idx)&&rows[idx]&&entry?.nutrition)rows[idx]=applyResolvedReference(rows[idx],entry.nutrition,{authoritative:true});});
    }catch(_){
      // Compatibilité douce si le front est chargé avant la migration : uniquement
      // pour une NOUVELLE consommation, jamais pour un snapshot historique.
      const enriched=await enrichNutritionReferences(sb,targets.map(x=>x.item),20).catch(()=>targets.map(x=>x.item));
      targets.forEach((t,j)=>{if(enriched[j])rows[t.idx]={...rows[t.idx],...enriched[j]};});
    }
    await Promise.all(rows.map(async(item,idx)=>{
      if(item?._historical_snapshot)return;
      const p=await resolvePortionProfile(sb,item);rows[idx]={...item,_portion_profile:p};
    }));
    return rows;
  }

  async function resolveHistoricalNutritionItems(sb,items){
    const rows=(Array.isArray(items)?items:[]).map(x=>({...x}));
    const refs=rows.map((item,idx)=>({client_key:String(idx),meal_item_id:item.id||item._meal_item_id||null})).filter(x=>x.meal_item_id);
    if(!refs.length)return rows.map(x=>({...x,_historical_snapshot:true}));
    try{
      const {data,error}=await sb.rpc('mt_nutrition_resolve_batch',{p_refs:refs});if(error)throw error;
      const byKey=new Map((Array.isArray(data)?data:[]).map(x=>[String(x.client_key),x.nutrition]));
      return rows.map((item,idx)=>{
        const nutrition=byKey.get(String(idx));
        return nutrition?applyResolvedReference(item,nutrition,{authoritative:true,historical:true}):{...item,_historical_snapshot:true};
      });
    }catch(_){return rows.map(x=>({...x,_historical_snapshot:true}));}
  }

  async function resolveNutrition(sb,{mealItemId=null,recipeId=null,blendId=null,dictionaryId=null,ciqualCode=null}={}){
    const key=[mealItemId,recipeId,blendId,dictionaryId,ciqualCode].map(x=>x||'').join('|');
    const hit=unifiedNutritionCache.get(key);if(hit&&Date.now()-hit.at<120000)return hit.data;
    const {data,error}=await sb.rpc('mt_nutrition_resolve',{
      p_meal_item_id:mealItemId,p_recipe_id:recipeId,p_blend_id:blendId,
      p_dictionary_id:dictionaryId,p_ciqual_code:ciqualCode
    });
    if(error)throw error;unifiedNutritionCache.set(key,{at:Date.now(),data});return data;
  }

  async function getRecipeMealItems(sb,recipeId,servings=1){
    if(!recipeId)return [];
    try{
      const {data,error}=await sb.rpc('mt_get_recipe_meal_items',{p_recipe_id:recipeId,p_servings:servings});if(error)throw error;
      return (Array.isArray(data)?data:[]).map(row=>{
        const ref=row.reference_100g||{};
        return {
          name:row.ingredient_name||'Ingrédient',grams:Number(row.quantity_g)||0,
          ciqual_code:row.ciqual_code||null,dictionary_id:row.dictionary_id||null,
          kcal_100g:ref.kcal_100g,protein_100g:ref.protein_100g,fat_100g:ref.fat_100g,
          carbs_100g:ref.carbs_100g,fiber_100g:ref.fiber_100g,salt_100g:ref.salt_100g,
          nutrition_extra_100g:ref.nutrition_extra_100g||{},micronutrients_100g:ref.micronutrients_100g||{},
          _resolved_reference:true,_reference_kind:row.reference_kind||'recipe_item',_reference_source:row.source_label||''
        };
      });
    }catch(_){return [];}
  }


  Object.assign(MTFood,{esc,today,qs,fmtDate,mealLabels,mealOrder,mealTimes,auth,activateCarnetNav,signedUrl,compressImage,uploadMealPhoto,deleteMealPhoto,toast,portionProfile,profileForItem,gramsForProfile,portionFromProfile,resolvePortionProfile,gramsForPortion,portionFromGrams,nutrientFromItem,micronutrientsFromFood,nutritionExtraFromFood,sumNutritionExtra,sumNutrition,searchFoods,resolveFoodText,enrichNutritionReferences,prepareItemsForSnapshot,resolveHistoricalNutritionItems,resolveNutrition,getRecipeMealItems,applyResolvedReference});
  document.addEventListener('DOMContentLoaded',()=>{activateCarnetNav();installFoodKeyboardNav();});
})();
