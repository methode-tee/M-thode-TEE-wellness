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
    return {
      kcal:Math.round((Number(food.kcal_100g)||0)*factor*10)/10,
      protein:Math.round((Number(food.protein_100g)||0)*factor*10)/10,
      fat:Math.round((Number(food.fat_100g)||0)*factor*10)/10,
      carbs:Math.round((Number(food.carbs_100g)||0)*factor*10)/10,
      fiber:Math.round((Number(food.fiber_100g)||0)*factor*10)/10,
      salt:Math.round((Number(food.salt_100g)||0)*factor*100)/100
    };
  }

  function sumNutrition(items){
    return (items||[]).reduce((a,i)=>{['kcal','protein','fat','carbs','fiber','salt'].forEach(k=>a[k]+=Number(i[k])||0);return a;},{kcal:0,protein:0,fat:0,carbs:0,fiber:0,salt:0});
  }

  function micronutrientsFromFood(food,grams){
    const factor=Math.max(0,Number(grams)||0)/100,out={};
    Object.entries(food?.micronutrients_100g||{}).forEach(([key,raw])=>{
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
    let {data,error}=await sb.rpc('search_foods_v3',{p_query:q,p_limit:Math.min(10,limit)});
    if(error){const fallback=await sb.rpc('search_foods_v2',{p_query:q,p_limit:Math.min(10,limit)});data=fallback.data;error=fallback.error;}
    if(error)throw error;
    const rows=Array.isArray(data)?data:[];foodCacheWrite(key,rows);return rows;
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

  Object.assign(MTFood,{esc,today,qs,fmtDate,mealLabels,mealOrder,mealTimes,auth,activateCarnetNav,signedUrl,compressImage,uploadMealPhoto,deleteMealPhoto,toast,portionProfile,gramsForPortion,portionFromGrams,nutrientFromItem,micronutrientsFromFood,sumNutrition,searchFoods,resolveFoodText});
  document.addEventListener('DOMContentLoaded',()=>{activateCarnetNav();installFoodKeyboardNav();});
})();
