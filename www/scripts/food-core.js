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
    const {data,error}=await sb.rpc('search_foods_v2',{p_query:q,p_limit:Math.min(10,limit)});
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

  // V414 · Clavier iOS/Safari — stabilisation premium sans écran vide intermédiaire.
  // Safari anime la fermeture du clavier en plusieurs étapes : focusout arrive avant que
  // visualViewport retrouve sa hauteur finale. L'ancienne restauration immédiate faisait
  // donc brièvement conserver un scroll hors plage et affichait un grand vide beige.
  // On conserve ici l'ancre visuelle du champ, on attend réellement la fin de l'animation,
  // puis on synchronise la hauteur et on recale le scroll dans la même frame.
  function installFoodKeyboardNav(){
    const selector='input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="tel"],input[type="url"],input[type="number"],textarea';
    const isTextEntry=(el)=>!!el?.matches?.(selector);
    let stableHeightPx=0;
    let focusAnchor=null;
    let closeTimer=0;
    let settleRaf=0;

    const visibleHeight=()=>{
      const vv=window.visualViewport;
      return Math.max(320,Math.round((vv&&vv.height)||window.innerHeight||document.documentElement.clientHeight||0));
    };
    const layoutHeight=()=>Math.max(visibleHeight(),Math.round(window.innerHeight||0));
    const setStableHeight=(h)=>{
      if(!h)return;
      const value=`${Math.round(h)}px`;
      document.documentElement.style.setProperty('--mt-food-stable-height',value);
      document.body.style.setProperty('--mt-food-stable-height',value);
      document.documentElement.style.setProperty('--mt-app-height',value);
      document.body.style.setProperty('--mt-app-height',value);
    };
    const captureAnchor=(el)=>{
      const card=el?.closest?.('.mt-food-form-card')||el;
      const rect=card?.getBoundingClientRect?.();
      return rect?{el:card,top:rect.top}:null;
    };
    const clampScroll=()=>{
      const vv=window.visualViewport;
      const vh=Math.max(1,(vv&&vv.height)||window.innerHeight||1);
      const max=Math.max(0,document.documentElement.scrollHeight-vh);
      const y=Math.max(0,Math.min(window.scrollY||window.pageYOffset||0,max));
      if(Math.abs((window.scrollY||0)-y)>1)window.scrollTo(0,y);
    };
    const restoreAnchor=()=>{
      if(!focusAnchor?.el?.isConnected)return;
      const now=focusAnchor.el.getBoundingClientRect();
      const delta=now.top-focusAnchor.top;
      if(Number.isFinite(delta)&&Math.abs(delta)>1)window.scrollBy(0,delta);
      clampScroll();
    };
    const pin=()=>{
      if(!document.body.classList.contains('mt-food-keyboard-open')||!stableHeightPx)return;
      setStableHeight(stableHeightPx);
    };
    const open=(el)=>{
      clearTimeout(closeTimer);
      if(settleRaf)cancelAnimationFrame(settleRaf);
      document.body.classList.remove('mt-food-keyboard-settling');
      stableHeightPx=Math.max(layoutHeight(),stableHeightPx||0);
      focusAnchor=captureAnchor(el);
      document.body.classList.add('mt-food-keyboard-open');
      setStableHeight(stableHeightPx);
      requestAnimationFrame(pin);
      setTimeout(pin,80);
    };
    const finishClose=()=>{
      if(settleRaf)cancelAnimationFrame(settleRaf);
      settleRaf=0;
      const h=visibleHeight();
      document.body.classList.remove('mt-food-keyboard-open','mt-food-keyboard-settling');
      document.documentElement.style.removeProperty('--mt-food-stable-height');
      document.body.style.removeProperty('--mt-food-stable-height');
      if(h){
        const value=`${h}px`;
        document.documentElement.style.setProperty('--mt-app-height',value);
        document.body.style.setProperty('--mt-app-height',value);
      }
      requestAnimationFrame(()=>{
        restoreAnchor();
        requestAnimationFrame(()=>{restoreAnchor();window.dispatchEvent(new Event('resize'));});
      });
      stableHeightPx=0;
      setTimeout(()=>{focusAnchor=null;},80);
    };
    const settleClose=()=>{
      if(isTextEntry(document.activeElement))return;
      document.body.classList.add('mt-food-keyboard-settling');
      const started=performance.now();
      const target=Math.max(320,stableHeightPx||layoutHeight());
      const tick=()=>{
        if(isTextEntry(document.activeElement)){
          document.body.classList.remove('mt-food-keyboard-settling');
          return;
        }
        const recovered=visibleHeight()>=target*.88;
        if(recovered||performance.now()-started>520){finishClose();return;}
        settleRaf=requestAnimationFrame(tick);
      };
      settleRaf=requestAnimationFrame(tick);
    };

    document.addEventListener('focusin',(e)=>{if(isTextEntry(e.target))open(e.target);},true);
    document.addEventListener('focusout',()=>{
      clearTimeout(closeTimer);
      closeTimer=setTimeout(settleClose,20);
    },true);
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize',()=>{pin();if(document.body.classList.contains('mt-food-keyboard-settling'))clampScroll();},{passive:true});
      window.visualViewport.addEventListener('scroll',()=>{pin();if(document.body.classList.contains('mt-food-keyboard-settling'))clampScroll();},{passive:true});
    }
    window.addEventListener('resize',pin,{passive:true});
    window.addEventListener('pageshow',()=>{
      document.body.classList.remove('mt-food-keyboard-open','mt-food-keyboard-settling');
      document.documentElement.style.removeProperty('--mt-food-stable-height');
      document.body.style.removeProperty('--mt-food-stable-height');
      stableHeightPx=0;focusAnchor=null;
    },{passive:true});
  }

  Object.assign(MTFood,{esc,today,qs,fmtDate,mealLabels,mealOrder,mealTimes,auth,activateCarnetNav,signedUrl,compressImage,uploadMealPhoto,deleteMealPhoto,toast,portionProfile,gramsForPortion,portionFromGrams,nutrientFromItem,sumNutrition,searchFoods,resolveFoodText});
  document.addEventListener('DOMContentLoaded',()=>{activateCarnetNav();installFoodKeyboardNav();});
})();
