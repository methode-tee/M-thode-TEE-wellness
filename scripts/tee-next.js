/* MÉTHODE TEE — V488.8.2 CUMULATIF · V488.8.1 + hiérarchie culturelle + mémoire alimentaire · shell V487.4 préservé */
(function(){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=k=>new URLSearchParams(location.search).get(k);
const tool=q('tool')||'planner';
let sb,user;
const tools=[['planner','Planifier'],['safety','Sécurité plantes']];
const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

function list(v){return String(v||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean)}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function tokens(v){return new Set(norm(v).split(' ').filter(x=>x.length>2))}
function euro(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}):''}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function budgetTier(budget){
  if(!budget)return 'balanced';
  if(budget<=35)return 'economy';
  if(budget<=55)return 'balanced';
  return 'flexible';
}
function coverageReliabilityScore(coverage){
  const c=Number(coverage)||0;
  if(c>=100)return 1.25;
  if(c>=90)return 0.90;
  if(c>=80)return 0.35;
  if(c>=70)return -0.70;
  if(c>=60)return -1.50;
  if(c>=50)return -2.40;
  if(c>=30)return -3.60;
  return -5.00;
}
function isWholeDishCandidate(recipe){
  const p=recipe?._price;
  if(!p)return false;
  if(p.status==='planner_food_whole_dish_v1')return true;
  const items=Array.isArray(p.items)?p.items:[];
  return items.some(i=>i?.resolution_status==='whole_dish_strict'||i?.strict_match_mode==='dictionary_id');
}
function plannerMetaFor(recipe,metaMap){return metaMap.get(String(recipe?.recipe_id||''))||{source_kind:'recipe',discovery_level:0,normalized_title:norm(recipe?.title||'')}}
function memoryMaps(memory){
  const tokenMap=new Map(),categoryMap=new Map(),countryMap=new Map(),recentTitles=new Set(),familiarIds=new Set();
  (Array.isArray(memory?.dominant_tokens)?memory.dominant_tokens:[]).forEach(x=>{const k=norm(x?.token||'');if(k)tokenMap.set(k,Number(x?.score)||0)});
  (Array.isArray(memory?.dominant_categories)?memory.dominant_categories:[]).forEach(x=>{const k=norm(x?.category||'');if(k)categoryMap.set(k,Number(x?.score)||0)});
  (Array.isArray(memory?.dominant_countries)?memory.dominant_countries:[]).forEach(x=>{const k=norm(x?.country_key||x?.country||'');if(k)countryMap.set(k,Number(x?.score)||0)});
  (Array.isArray(memory?.recent_titles)?memory.recent_titles:[]).forEach(x=>{const k=norm(x);if(k)recentTitles.add(k)});
  (Array.isArray(memory?.familiar_dictionary_ids)?memory.familiar_dictionary_ids:[]).forEach(x=>{if(x?.food_dictionary_id)familiarIds.add(String(x.food_dictionary_id))});
  return {tokenMap,categoryMap,countryMap,recentTitles,familiarIds};
}
function candidateMemoryAffinity(recipe,memoryState,meta){
  if(!memoryState?.active)return 0;
  const text=[recipe?.title,recipe?.subtitle,...(Array.isArray(recipe?.ingredients)?recipe.ingredients:[])].join(' ');
  let raw=0,matches=0;
  [...tokens(text)].forEach(t=>{const w=memoryState.tokenMap.get(t)||0;if(w>0){raw+=Math.min(7,w);matches++}});
  let categoryRaw=0;
  (Array.isArray(meta?.categories)?meta.categories:[]).forEach(c=>{categoryRaw+=Math.min(6,memoryState.categoryMap.get(norm(c))||0)});
  const countryKey=norm(meta?.country||'');
  const countryScore=countryKey?(memoryState.countryMap.get(countryKey)||0):0;
  const dictFamiliar=meta?.food_dictionary_id&&memoryState.familiarIds.has(String(meta.food_dictionary_id));
  return Math.min(4.6,raw*0.11)+Math.min(0.9,categoryRaw*0.035)+Math.min(1.8,countryScore*0.18)+(dictFamiliar?1.2:0)+(matches>=3?0.45:0);
}
function effectiveDiscoveryLevel(recipe,memoryState,meta){
  let level=clamp(Number(meta?.discovery_level)||0,0,2);
  if(!memoryState?.active||level===0)return level;
  const affinity=candidateMemoryAffinity(recipe,memoryState,meta);
  const countryScore=memoryState.countryMap.get(norm(meta?.country||''))||0;
  const familiar=meta?.food_dictionary_id&&memoryState.familiarIds.has(String(meta.food_dictionary_id));
  if(familiar||countryScore>=7||affinity>=3.8)level=Math.max(0,level-1);
  if(countryScore>=12||affinity>=5.2)level=0;
  return level;
}
function isBudgetRelevantItem(item){
  return !!item && item.optional!==true && item.requires_choice!==true && item.budget_exempt!==true;
}
function priceItemsForPantry(price,pTok){
  const items=Array.isArray(price?.items)?price.items:[];
  return items.filter(isBudgetRelevantItem).filter(i=>!ingredientIsOwned(i.ingredient_name,pTok));
}
function priceFacts(price,pTok){
  const items=priceItemsForPantry(price,pTok);
  const known=items.filter(i=>num(i.cost_eur)!==null);
  const cost=known.reduce((s,i)=>s+Number(i.cost_eur),0);
  const coverage=items.length?Math.round(known.length/items.length*100):100;
  return {items,known,cost,coverage,total:items.length,priced:known.length};
}
function withTimeout(value,ms=9000,label='Chargement'){
  return Promise.race([
    Promise.resolve(value),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} prend plus de temps que prévu.`)),ms))
  ]);
}
async function safeCall(value,ms=9000,label='Chargement'){
  try{return await withTimeout(value,ms,label)}catch(error){return {data:null,error}}
}
function showOpenError(error){
  const message=error?.message||'Impossible d’ouvrir cet outil pour le moment.';
  body(`<div class="mt-next-result is-alert"><b>Ouverture impossible</b><p>${esc(message)}</p><button type="button" class="mt-next-secondary" id="mtNextRetry">Réessayer</button></div>`);
  document.getElementById('mtNextRetry')?.addEventListener('click',()=>location.reload());
}
function ingredientIsOwned(name,pTok){
  const t=[...tokens(name)];
  return t.length>0&&t.some(x=>pTok.has(x));
}
async function auth(){
  sb=typeof initSupabase==='function'?initSupabase():null;
  if(!sb)throw Error('Connexion indisponible.');
  const {data}=await withTimeout(sb.auth.getUser(),8000,'La connexion');
  user=data?.user;
  if(!user){location.href='auth.html';throw Error('Connexion requise.')}
}
function tabs(){
  const e=document.getElementById('mtNextTabs');
  e.innerHTML=tools.map(([k,l])=>`<a class="${k===tool?'active':''}" href="tee-next.html?tool=${k}">${esc(l)}</a>`).join('');
}
function body(html){document.getElementById('mtNextBody').innerHTML=html}

async function safety(){
  body('<div class="mt-next-status">Préparation de tes garde-fous…</div>');
  const profileRes=await safeCall(sb.from('mt_phyto_user_profile').select('*').eq('user_id',user.id).maybeSingle(),8000,'Le profil plantes');
  if(profileRes?.error) throw profileRes.error;
  const f=profileRes?.data||{};
  const flags=[
    ['regular_medication','Je prends un traitement régulier'],
    ['anticoagulants','Traitement anticoagulant / antiagrégant'],
    ['sedatives','Traitement sédatif / somnifère'],
    ['hypertension','Hypertension connue'],
    ['pregnancy','Grossesse'],
    ['breastfeeding','Allaitement'],
    ['caffeine_sensitive','Sensibilité forte à la caféine'],
    ['allergy_asteraceae','Allergie connue aux Astéracées'],
    ['hormone_sensitive','Situation hormono-sensible à vérifier']
  ];
  body(`<article class="mt-next-card">
    <div class="mt-next-kicker">Sécurité phytothérapie</div>
    <h2>Vérifier avant de suggérer.</h2>
    <p>Ce profil sert uniquement de garde-fou. L’absence d’alerte ne signifie jamais qu’une plante est garantie compatible.</p>
    <div class="mt-next-grid">${flags.map(([k,l])=>`<label class="mt-next-choice"><input type="checkbox" data-phyto-flag="${k}" ${f[k]?'checked':''}><span>${esc(l)}</span></label>`).join('')}</div>
    <button class="mt-next-primary" id="mtPhytoSave">Enregistrer mes garde-fous</button>
  </article>
  <article class="mt-next-card">
    <h2>Vérifier une plante</h2>
    <div class="mt-next-field"><label>Plante</label><input id="mtPhytoPlant" placeholder="Ex. millepertuis, réglisse, sauge…"></div>
    <button class="mt-next-primary" id="mtPhytoCheck">Vérifier avec mon profil</button>
    <div id="mtPhytoResult"></div>
  </article>`);
  document.getElementById('mtPhytoSave').onclick=async()=>{
    const flags={};
    document.querySelectorAll('[data-phyto-flag]').forEach(x=>flags[x.dataset.phytoFlag]=x.checked);
    const {error}=await withTimeout(sb.rpc('mt_phyto_save_profile',{p_flags:flags}),8000,'L’enregistrement');
    if(error)alert(error.message);else alert('Garde-fous enregistrés.');
  };
  document.getElementById('mtPhytoCheck').onclick=async()=>{
    const plant=document.getElementById('mtPhytoPlant').value.trim(),box=document.getElementById('mtPhytoResult');
    if(!plant)return;
    box.innerHTML='<div class="mt-next-status">Vérification…</div>';
    const {data,error}=await withTimeout(sb.rpc('mt_phyto_safety_check',{p_plant:plant}),8000,'La vérification');
    if(error){box.innerHTML=`<div class="mt-next-result is-alert">${esc(error.message)}</div>`;return;}
    const rules=Array.isArray(data?.matches)?data.matches:[];
    box.innerHTML=`<div class="mt-next-result ${rules.length?'is-alert':'is-ok'}"><b>${esc(data?.headline||'Vérification terminée')}</b>${rules.length?rules.map(r=>`<p>${esc(r.message)}</p>`).join(''):`<p>Aucun garde-fou renseigné dans ton profil n’a déclenché de règle pour cette plante. Cela ne remplace pas une vérification professionnelle en cas de traitement, grossesse, maladie ou doute.</p>`}</div>`;
  };
}

function priceSourceLine(status){
  const total=Number(status?.price_reference_count||0);
  const rnm=Number(status?.rnm_reference_count||0);
  const manual=Number(status?.manual_reference_count||0);
  if(!total)return `<div class="mt-next-price-source is-empty"><b>Couche prix prête</b><span>Aucun prix n’a encore été importé. Tu peux déjà planifier ; les estimations apparaîtront au fur et à mesure.</span></div>`;
  return `<div class="mt-next-price-source"><b>${total} référence${total>1?'s':''} prix disponible${total>1?'s':''}</b><span>${rnm?`${rnm} RNM FranceAgriMer`:''}${rnm&&manual?' · ':''}${manual?`${manual} administrée${manual>1?'s':''} TEE`:''}</span></div>`;
}

async function planner(){
  const seedRaw=sessionStorage.getItem('mtPlannerPantrySeedV1')||'';
  if(seedRaw)sessionStorage.removeItem('mtPlannerPantrySeedV1');
  body('<div class="mt-next-status">Préparation de ta semaine…</div>');

  const [prefsRes,catalogRes,priceRes,metaRes,memoryRes]=await Promise.all([
    safeCall(sb.from('mt_planner_preferences').select('*').eq('user_id',user.id).maybeSingle(),8000,'Tes préférences'),
    safeCall(sb.rpc('mt_planner_recipe_catalog'),9000,'Tes recettes'),
    safeCall(sb.rpc('mt_price_status_v1'),6000,'Les repères de prix'),
    safeCall(sb.rpc('mt_planner_candidate_meta_v1'),7000,'La hiérarchie des plats'),
    safeCall(sb.rpc('mt_planner_personal_memory_v1',{p_days:60}),7000,'Ta mémoire alimentaire')
  ]);
  if(catalogRes?.error) throw catalogRes.error;

  const prefs=prefsRes?.error?null:prefsRes?.data;
  const catalog=catalogRes?.data;
  const priceStatus=priceRes?.error?null:priceRes?.data;
  const metaRows=metaRes?.error?[]:(Array.isArray(metaRes?.data)?metaRes.data:[]);
  const memory=memoryRes?.error?null:(memoryRes?.data||null);
  const metaMap=new Map(metaRows.map(x=>[String(x.recipe_id),x]));
  const memoryBase=memoryMaps(memory||{});
  const memoryState={...memoryBase,active:!!memory?.active,strong:!!memory?.strong,mealCount:Number(memory?.planner_meal_count||0),days:Number(memory?.planner_days_with_meals||0)};
  const p=prefs||{},rows=Array.isArray(catalog)?catalog:[];
  const seedTerms=list(seedRaw);
  const pantryInitial=[...new Set([...(seedTerms||[]),...(p.pantry_terms||[])])];

  body(`<article class="mt-next-card">
    <div class="mt-next-kicker">Planification adaptative</div>
    <h2>Partir de la vraie vie.</h2>
    <p>TEE réutilise tes recettes, ton placard et les prix que nous avons réellement documentés. Aucun menu n’est généré par une API externe.</p>
    ${priceSourceLine(priceStatus||{})}
    ${memoryState.active?`<div class="mt-next-price-source"><b>Mémoire alimentaire active</b><span>TEE s’appuie sur ${memoryState.mealCount} repas déjeuner/dîner enregistrés récemment pour rester proche de tes habitudes sans répéter exactement les mêmes plats.</span></div>`:`<div class="mt-next-price-source is-empty"><b>Mémoire alimentaire en construction</b><span>Elle s’activera automatiquement lorsque Ma journée alimentaire contiendra assez de repas récents.</span></div>`}
    <div class="mt-next-field"><label>Ce que j’ai déjà</label><textarea id="mtPlanPantry" placeholder="saumon, riz, courgettes…">${esc(pantryInitial.join(', '))}</textarea></div>
    <div class="mt-next-field"><label>Je ne veux pas</label><input id="mtPlanExclude" value="${esc((p.excluded_terms||[]).join(', '))}" placeholder="œufs, porc…"></div>
    <div class="mt-next-grid">
      <div class="mt-next-field"><label>Budget indicatif semaine</label><input id="mtPlanBudget" type="number" min="0" step="1" value="${esc(p.weekly_budget_eur??45)}"></div>
      <div class="mt-next-field"><label>Personnes</label><input id="mtPlanServings" type="number" min="1" max="8" value="${esc(p.servings||1)}"></div>
    </div>
    <div class="mt-next-grid">
      <div class="mt-next-field"><label>Restaurant</label><select id="mtPlanRestaurant"><option value="">Aucun jour prévu</option>${DAYS.map((d,i)=>`<option value="${i}" ${String(p.restaurant_day??'')===String(i)?'selected':''}>${d}</option>`).join('')}</select></div>
      <label class="mt-next-choice" style="margin-top:28px"><input id="mtPlanLeftovers" type="checkbox" ${p.use_leftovers!==false?'checked':''}><span>Réutiliser les restes</span></label>
    </div>
    <button class="mt-next-primary" id="mtPlanGo">Construire ma semaine</button>
    <p class="mt-next-mini">Le budget guide la sélection sans chercher à tout dépenser. TEE privilégie tes habitudes sans répéter exactement tes repas récents ; seuls les vrais plats cuisinés peuvent revenir sous forme de restes.</p>
  </article><section id="mtPlanResult"></section>`);

  document.getElementById('mtPlanGo').onclick=async()=>{
    const result=document.getElementById('mtPlanResult');
    result.innerHTML='<div class="mt-next-status">TEE organise ta semaine…</div>';

    try{
      const pantry=list(document.getElementById('mtPlanPantry').value);
      const exclude=list(document.getElementById('mtPlanExclude').value);
      const budget=Number(document.getElementById('mtPlanBudget').value)||0;
      const servings=Math.max(1,Math.min(8,Number(document.getElementById('mtPlanServings').value)||1));
      const restaurant=document.getElementById('mtPlanRestaurant').value;
      const leftovers=document.getElementById('mtPlanLeftovers').checked;
      const tier=budgetTier(budget);
      const availableDays=restaurant===''?7:6;
      const target=budget>0?budget/Math.max(1,availableDays):0;

      const prefSave=await withTimeout(sb.from('mt_planner_preferences').upsert({
        user_id:user.id,pantry_terms:pantry,excluded_terms:exclude,
        weekly_budget_eur:budget||null,servings,
        restaurant_day:restaurant===''?null:Number(restaurant),
        use_leftovers:leftovers,updated_at:new Date().toISOString()
      }),8000,'L’enregistrement de ta planification');
      if(prefSave?.error)throw prefSave.error;

      const pTok=tokens(pantry.join(' ')),eTok=[...tokens(exclude.join(' '))];

      let candidates=rows.map(r=>{
        const ing=Array.isArray(r.ingredients)?r.ingredients:[];
        const all=norm([r.title,r.subtitle,...ing].join(' '));
        if(eTok.some(x=>all.includes(x)))return null;

        let have=0;
        ing.forEach(i=>{if(ingredientIsOwned(i,pTok))have++});
        const missing=ing.filter(i=>!ingredientIsOwned(i,pTok));

        const missingPenalty=tier==='economy'?0.62:tier==='balanced'?0.24:0.08;
        const complexityBonus=tier==='flexible'?Math.min(8,ing.length)*0.11:tier==='balanced'?Math.min(8,ing.length)*0.025:0;
        let score=have*4.2-missing.length*missingPenalty+complexityBonus;
        if(!ing.length)score-=8;

        const meta=plannerMetaFor(r,metaMap);
        const affinity=candidateMemoryAffinity(r,memoryState,meta);
        const recentKey=norm(meta?.normalized_title||r.title||'');
        const recentExact=memoryState.active&&memoryState.recentTitles.has(recentKey);
        const discoveryLevel=effectiveDiscoveryLevel(r,memoryState,meta);
        return {
          ...r,
          _meta:meta,
          _memoryAffinity:affinity,
          _recentExact:recentExact,
          _effectiveDiscoveryLevel:discoveryLevel,
          _baseScore:score,
          _score:score,
          _missing:missing,
          _price:null,
          _priceFacts:{items:[],known:[],cost:0,coverage:0,total:0,priced:0},
          _missingDocumentedCost:0,
          _missingPriceCoverage:0
        };
      }).filter(Boolean);

      // Prix uniquement au clic : aucun coût de chargement supplémentaire sur Profil/Accueil.
      const priceIds=candidates.slice(0,60).map(x=>x.recipe_id);
      if(priceIds.length){
        try{
          const {data:priced,error:priceErr}=await withTimeout(sb.rpc('mt_recipe_cost_batch_v1',{
            p_recipe_ids:priceIds,p_servings:servings,p_country:'FR',p_region:null
          }),10000,'Le calcul des prix');
          if(priceErr)throw priceErr;

          const priceMap=new Map((priced||[]).map(x=>[x.recipe_id,x.cost]));
          candidates=candidates.map(r=>{
            const price=priceMap.get(r.recipe_id)||null;
            const facts=priceFacts(price,pTok);
            const coverage=facts.coverage;
            const missingCost=facts.cost;
            const confidence=coverage/100;
            let priceScore=0;

            if(target){
              const ratio=target>0?missingCost/target:0;

              if(coverage>=80){
                if(tier==='economy'){
                  priceScore=clamp((1-ratio)*3.2,-5,2.8);
                  if(ratio<=0.85)priceScore+=0.7;
                }else if(tier==='balanced'){
                  priceScore=-Math.abs(ratio-0.68)*1.35;
                  if(ratio<=1)priceScore+=0.45;
                  if(ratio>1)priceScore-=(ratio-1)*2.2;
                }else{
                  // Budget souple = plus de liberté sur le PRIX, pas sur la qualité du chiffrage.
                  priceScore=ratio<=1.15
                    ?clamp(ratio,0,1)*0.75
                    :-(ratio-1.15)*2.4;
                }
              }else if(coverage>=50){
                // Un coût partiel reste un signal fragile, même avec un budget élevé.
                const partial=tier==='economy'
                  ?clamp((1-ratio)*1.1,-1.8,0.7)
                  :tier==='balanced'
                    ?clamp(-Math.abs(ratio-0.65)*0.55,-1.2,0.35)
                    :clamp(-Math.abs(ratio-0.80)*0.20,-0.55,0.05);
                priceScore=partial-(1-confidence)*1.4;
              }else{
                priceScore=tier==='economy'?-2.4:tier==='balanced'?-1.35:-1.10;
              }
            }

            return {
              ...r,
              _price:price,
              _priceFacts:facts,
              _missingPriceItems:facts.items,
              _missingDocumentedCost:missingCost,
              _missingPriceCoverage:coverage,
              _coverageReliabilityScore:coverageReliabilityScore(coverage),
              _score:r._baseScore+priceScore+coverageReliabilityScore(coverage)
            };
          });
        }catch(e){
          console.warn('[TEE planner] prix indisponibles, sélection variété sans coût',e);
        }
      }

      // Construction dynamique : un plat frais une seule fois.
      // Les restes peuvent revenir au maximum 2 jours en budget serré, 1 jour sinon.
      const plan=[];
      const freshUsed=new Set();
      const categoryUse=new Map();
      const reuseTokens=new Set();
      let knownPlannedCost=0;
      let leftoversUsed=0;
      let noveltyUsed=0;
      let accessibleDiscoveryUsed=0;
      let specificDiscoveryUsed=0;
      const maxLeftovers=leftovers?(tier==='economy'?2:1):0;
      let pendingLeftover=null;

      function dynamicScore(r){
        let score=r._score;
        const category=norm(r.category||r.meal_type||'');
        const catCount=categoryUse.get(category)||0;
        score-=catCount*0.5;

        const ing=Array.isArray(r.ingredients)?r.ingredients:[];
        let overlap=0;
        ing.forEach(name=>{
          [...tokens(name)].forEach(t=>{if(reuseTokens.has(t))overlap++});
        });
        score+=Math.min(1.25,overlap*0.12);

        // Mémoire : se rapprocher des habitudes réellement enregistrées, sans
        // réafficher exactement le même plat récent. L'affinité reste un bonus
        // modéré : budget, disponibilité et fiabilité gardent la priorité.
        if(memoryState.active){
          score+=Math.min(4.5,Number(r._memoryAffinity)||0);
          if(r._recentExact)score-=9;
          const novel=(Number(r._memoryAffinity)||0)<0.65&&!r._recentExact;
          if(novel)score-=noveltyUsed>=1?6.5:0.35;
        }

        // Hiérarchie culturelle explicite. Niveau 1 : découverte accessible ;
        // niveau 2 : spécifique/complexe par défaut. Une familiarité réellement
        // observée dans le journal peut déjà avoir abaissé ce niveau à la volée.
        const discovery=Number(r._effectiveDiscoveryLevel)||0;
        if(discovery===1)score-=1.25+(accessibleDiscoveryUsed>=2?5.5:0);
        if(discovery===2)score-=4.8+(specificDiscoveryUsed>=1?10:0);

        if(budget>0&&r._missingPriceCoverage>=70){
          const projected=knownPlannedCost+r._missingDocumentedCost;
          const tolerance=tier==='flexible'?1.12:tier==='balanced'?1.04:1.0;
          if(projected>budget*tolerance){
            score-=(projected-budget*tolerance)*1.8;
          }
        }

        return score;
      }

      function registerFresh(r){
        freshUsed.add(r.recipe_id);
        const category=norm(r.category||r.meal_type||'');
        categoryUse.set(category,(categoryUse.get(category)||0)+1);
        (Array.isArray(r.ingredients)?r.ingredients:[]).forEach(name=>{
          [...tokens(name)].forEach(t=>reuseTokens.add(t));
        });
        knownPlannedCost+=Number(r._missingDocumentedCost)||0;
        const discovery=Number(r._effectiveDiscoveryLevel)||0;
        if(discovery===1)accessibleDiscoveryUsed++;
        if(discovery===2)specificDiscoveryUsed++;
        if(memoryState.active&&(Number(r._memoryAffinity)||0)<0.65&&!r._recentExact)noveltyUsed++;
      }

      for(let i=0;i<7;i++){
        if(String(i)===String(restaurant)){
          plan.push({day:DAYS[i],restaurant:true});
          continue;
        }

        if(pendingLeftover&&leftoversUsed<maxLeftovers){
          plan.push({day:DAYS[i],recipe:pendingLeftover,leftover:true,repeat:false});
          knownPlannedCost+=Number(pendingLeftover._missingDocumentedCost)||0;
          leftoversUsed++;
          pendingLeftover=null;
          continue;
        }

        const available=candidates.filter(r=>!freshUsed.has(r.recipe_id));
        const basePool=available.length?available:candidates;

        // V488.8.1 cumulatif : en budget souple, tant qu'un pool 100 %
        // chiffrable existe, aucune fiche partielle n'est retenue.
        const reliablePool=tier==='flexible'
          ?basePool.filter(r=>Number(r._missingPriceCoverage||0)>=100)
          :basePool;
        let selectionPool=reliablePool.length?reliablePool:basePool;

        // Évite le même plat déjà consommé récemment quand une alternative existe.
        if(memoryState.active){
          const nonRecent=selectionPool.filter(r=>!r._recentExact);
          if(nonRecent.length)selectionPool=nonRecent;

          // Une fois une vraie nouveauté éloignée utilisée, on revient aux plats
          // proches des habitudes s'il reste au moins une alternative familière.
          if(noveltyUsed>=1){
            const familiar=selectionPool.filter(r=>(Number(r._memoryAffinity)||0)>=0.65);
            if(familiar.length)selectionPool=familiar;
          }
        }

        // Niveau 2 = au maximum une découverte spécifique par semaine par défaut.
        // Niveau 1 = au maximum deux découvertes accessibles, sauf familiarité :
        // effectiveDiscoveryLevel les aura alors déjà remontées au niveau 0.
        if(specificDiscoveryUsed>=1){
          const noSpecific=selectionPool.filter(r=>(Number(r._effectiveDiscoveryLevel)||0)!==2);
          if(noSpecific.length)selectionPool=noSpecific;
        }
        if(accessibleDiscoveryUsed>=2){
          const noAccessible=selectionPool.filter(r=>(Number(r._effectiveDiscoveryLevel)||0)!==1);
          if(noAccessible.length)selectionPool=noAccessible;
        }

        const ranked=selectionPool
          .map(r=>({r,score:dynamicScore(r)}))
          .sort((a,b)=>b.score-a.score || String(a.r.title).localeCompare(String(b.r.title),'fr'));

        const pick=ranked[0]?.r;
        if(!pick){
          plan.push({day:DAYS[i]});
          continue;
        }

        registerFresh(pick);
        plan.push({day:DAYS[i],recipe:pick});

        if(leftoversUsed<maxLeftovers&&!isWholeDishCandidate(pick)){
          pendingLeftover=pick;
        }
      }

      // Liste de courses : on ignore désormais les lignes optional / choice / budget_exempt.
      const shop=new Map();
      let pricedOccurrences=0,totalOccurrences=0,totalDocumented=0;

      plan.forEach(day=>{
        if(!day.recipe)return;

        const facts=priceFacts(day.recipe._price,pTok);
        const items=facts.items;

        if(items.length){
          items.forEach(i=>{
            totalOccurrences++;
            const key=norm(i.ingredient_name)||String(i.ingredient_name);
            const prev=shop.get(key)||{
              name:i.ingredient_name,
              quantity_g:0,
              cost_eur:0,
              priced:false,
              source:i.source_label||'',
              occurrences:0
            };

            prev.quantity_g+=Number(i.quantity_g)||0;
            prev.occurrences++;

            if(num(i.cost_eur)!==null){
              prev.cost_eur+=Number(i.cost_eur);
              prev.priced=true;
              pricedOccurrences++;
              totalDocumented+=Number(i.cost_eur);
            }

            if(!prev.source&&i.source_label)prev.source=i.source_label;
            shop.set(key,prev);
          });
        }else{
          (day.recipe._missing||[]).forEach(name=>{
            if(ingredientIsOwned(name,pTok))return;
            totalOccurrences++;
            const key=norm(name)||name;
            const prev=shop.get(key)||{
              name,quantity_g:0,cost_eur:0,priced:false,source:'',occurrences:0
            };
            prev.occurrences++;
            shop.set(key,prev);
          });
        }
      });

      const coverage=totalOccurrences?Math.round(pricedOccurrences/totalOccurrences*100):100;
      const shopRows=[...shop.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'));
      const confident=coverage>=80;
      const budgetState=budget>0
        ?confident
          ?(totalDocumented<=budget?'Dans ton budget indicatif':'Au-dessus du budget indicatif')
          :'Budget à confirmer'
        :'';
      const costLabel=totalOccurrences
        ?pricedOccurrences
          ?`${euro(totalDocumented)} ${confident?'estimés':'documentés'}`
          :'Coût à compléter'
        :'Aucun achat structuré détecté';

      const tierLabel=tier==='economy'
        ?'Priorité économie + réutilisation'
        :tier==='balanced'
          ?'Équilibre budget + variété'
          :'Plus de liberté + variété fiable';

      result.innerHTML=`<article class="mt-next-card">
        <div class="mt-next-kicker">Ta semaine</div>
        <h2>Une base qui s’adapte.</h2>
        <div class="mt-next-budget-summary">
          <div><small>Achats à prévoir</small><b>${esc(costLabel)}</b></div>
          <div><small>Part chiffrable</small><b>${coverage}%</b></div>
          ${budget?`<div><small>Repère budget</small><b>${esc(budgetState)}</b></div>`:''}
        </div>
        <p class="mt-next-mini">${esc(tierLabel)} · TEE rapproche la semaine de tes habitudes sans répéter exactement tes repas récents.</p>
        ${plan.map(x=>`<div class="mt-next-plan-day">
          <small>${x.day}</small>
          <b>${x.restaurant?'Restaurant · journée libre':x.recipe?`${x.leftover?'Restes · ':x.repeat?'À nouveau · ':''}${esc(x.recipe.title)}`:'Repas libre'}</b>
          ${x.recipe?`<span class="mt-next-mini">${
            x.recipe._missingPriceCoverage>=80
              ?`≈ ${euro(x.recipe._missingDocumentedCost)} · ${x.recipe._missingPriceCoverage}% chiffrable`
              :x.recipe._missingDocumentedCost
                ?`≈ ${euro(x.recipe._missingDocumentedCost)} documentés · ${x.recipe._missingPriceCoverage}% chiffrable`
                :`${x.recipe._missingPriceCoverage}% chiffrable · coût à confirmer`
          }</span>`:''}
        </div>`).join('')}
        ${coverage<100&&totalOccurrences?`<p class="mt-next-mini">Le total reste partiel : ${100-coverage}% des achats sélectionnés ne peuvent pas encore être chiffrés automatiquement à partir de leur quantité/format. Ils ne sont jamais comptés comme 0 €.</p>`:''}
      </article>
      <article class="mt-next-card">
        <h2>À prévoir</h2>
        <div class="mt-next-shopping mt-next-shopping-priced">${shopRows.length?shopRows.map(x=>`<span>
          <b>${esc(x.name)}</b>
          <small>${x.quantity_g?`${Math.round(x.quantity_g)} g · `:''}${x.priced?`≈ ${euro(x.cost_eur)}`:'coût à confirmer'}${x.source?` · ${esc(x.source)}`:''}</small>
        </span>`).join(''):'<p>Rien de structuré à ajouter depuis les recettes sélectionnées.</p>'}</div>
      </article>`;

      window.mtLastPlannerDebug={
        version:'V488.8.2',
        budget,
        tier,
        coverage,
        totalDocumented,
        memory:{active:memoryState.active,strong:memoryState.strong,plannerMeals:memoryState.mealCount,plannerDays:memoryState.days,noveltyUsed,accessibleDiscoveryUsed,specificDiscoveryUsed},
        plan:plan.map(x=>({
          day:x.day,
          restaurant:!!x.restaurant,
          leftover:!!x.leftover,
          repeat:!!x.repeat,
          recipe:x.recipe?.title||null,
          sourceKind:x.recipe?x.recipe._meta?.source_kind:null,
          discoveryLevel:x.recipe?x.recipe._effectiveDiscoveryLevel:null,
          memoryAffinity:x.recipe?Number(x.recipe._memoryAffinity||0):null,
          recentExact:x.recipe?!!x.recipe._recentExact:false,
          cost:x.recipe?x.recipe._missingDocumentedCost:null,
          costCoverage:x.recipe?x.recipe._missingPriceCoverage:null
        }))
      };
    }catch(e){
      result.innerHTML=`<div class="mt-next-result is-alert"><b>Planification interrompue</b><p>${esc(e?.message||'Impossible de construire la semaine pour le moment.')}</p><button type="button" class="mt-next-secondary" onclick="location.reload()">Réessayer</button></div>`;
    }
  };
}

async function init(){
  try{
    tabs();
    await auth();
    await (({planner,safety}[tool]||planner)());
  }catch(e){
    showOpenError(e);
  }
}
document.addEventListener('DOMContentLoaded',init);
})();