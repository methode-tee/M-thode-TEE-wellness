/* MÉTHODE TEE — V489.1 · univers CIQUAL complet + assembleur déterministe · sans IA externe */
(function(){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=k=>new URLSearchParams(location.search).get(k);
const tool=q('tool')||'planner';
let sb,user;
let ciqualUniverseCache=null;
const tools=[['planner','Planifier'],['safety','Sécurité plantes']];
const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

function list(v){return String(v||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean)}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function tokens(v){return new Set(norm(v).split(' ').filter(x=>x.length>2))}
function euro(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}):''}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

function stableHash32(v,seed=2166136261){
  let h=(seed>>>0),str=String(v??'');
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
  return h>>>0;
}
function stableUuidV4891(v){
  const a=stableHash32(v,2166136261).toString(16).padStart(8,'0');
  const b=stableHash32(v,2246822519).toString(16).padStart(8,'0');
  const c=stableHash32(v,3266489917).toString(16).padStart(8,'0');
  const d=stableHash32(v,668265263).toString(16).padStart(8,'0');
  const hex=(a+b+c+d).slice(0,32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
function shortCiqualName(v){
  const raw=String(v||'').trim();
  if(!raw)return 'Aliment';
  const first=raw.split(',')[0].trim();
  return first.length>=3?first:raw;
}
function ciqualMemoryAffinity(food,memoryState){
  if(!memoryState?.active)return 0;
  const txt=norm([food?.display_name,food?.name,...(Array.isArray(food?.categories)?food.categories:[])].join(' '));
  let s=0,m=0;
  for(const [tok,w] of memoryState.tokenMap.entries()){
    if(tok&&txt.includes(tok)){s+=Math.min(8,Number(w)||0);m++}
  }
  const country=norm(food?.country||'');
  if(country)s+=Math.min(10,memoryState.countryMap.get(country)||0)*1.6;
  (Array.isArray(food?.categories)?food.categories:[]).forEach(c=>{s+=Math.min(8,memoryState.categoryMap.get(norm(c))||0)*0.6});
  if(food?.food_dictionary_id&&memoryState.familiarIds.has(String(food.food_dictionary_id)))s+=8;
  return s*0.12+(m>=2?0.5:0);
}
function ciqualGeneralQuality(food){
  const role=String(food?.role||'other');
  const p=Number(food?.protein_100g)||0,c=Number(food?.carbs_100g)||0,f=Number(food?.fiber_100g)||0,k=Number(food?.kcal_100g)||0;
  if(role==='protein'||role==='protein_plant')return clamp(p/22,0,1.5)+clamp(f/8,0,0.35);
  if(role==='starch')return clamp(c/35,0,1.2)+clamp(f/8,0,0.5);
  if(role==='vegetable')return clamp(f/5,0,1.2)+clamp((120-k)/120,0,0.55);
  if(role==='composite')return clamp(p/18,0,1)+clamp(c/35,0,0.65)+clamp(f/8,0,0.5);
  return 0;
}
function ciqualRolePortion(food){
  const role=String(food?.role||'other'),t=norm(food?.name||'');
  if(role==='protein'||role==='protein_plant')return 140;
  if(role==='vegetable')return 180;
  if(role==='starch')return /\b(cru|crue|sec|seche|deshydrate|farine|semoule)\b/.test(t)?80:180;
  if(role==='composite')return 350;
  return 100;
}
function ciqualPriceCost(price,qty){
  if(!price||price.stale===true||price.verified===false)return null;
  const kg=num(price.eur_per_kg);
  if(kg!==null&&kg>0)return qty/1000*kg;
  const unit=num(price.unit_price_eur),weight=num(price.unit_weight_g);
  if(unit!==null&&unit>0&&weight!==null&&weight>0)return qty/weight*unit;
  return null;
}
async function loadCiqualUniverseV4891(){
  if(Array.isArray(ciqualUniverseCache))return ciqualUniverseCache;
  const r=await safeCall(sb.rpc('mt_planner_ciqual_universe_v1'),15000,'L’univers alimentaire CIQUAL');
  if(r?.error){console.warn('[TEE V489.1] univers CIQUAL indisponible',r.error);return []}
  ciqualUniverseCache=Array.isArray(r?.data)?r.data:[];
  return ciqualUniverseCache;
}
function ciqualReservoir(universe,role,memoryState,seed,excludeNorm,max=60){
  const arr=universe.filter(x=>String(x?.role||'')===role && !excludeNorm.some(e=>e&&norm(x?.name||'').includes(e)));
  return arr.map(x=>{
    const mem=ciqualMemoryAffinity(x,memoryState),quality=ciqualGeneralQuality(x);
    const rot=stableUnit(`${seed}|${x.ciqual_code}`);
    return {x,score:quality+(memoryState?.active?mem*2.4:0)+rot*0.9};
  }).sort((a,b)=>b.score-a.score||String(a.x.name).localeCompare(String(b.x.name),'fr')).slice(0,max).map(z=>z.x);
}
function buildCiqualPriceMap(rows){
  return new Map((Array.isArray(rows)?rows:[]).map(x=>[String(x.ciqual_code),x.price||null]));
}
function dynamicCandidateFromComposite(food,price,servings,memoryState){
  const qty=ciqualRolePortion(food)*servings,cost=ciqualPriceCost(price,qty);
  if(cost===null)return null;
  const title=shortCiqualName(food.display_name||food.name),id=stableUuidV4891(`CIQUAL-COMPOSITE|${food.ciqual_code}`);
  const meta={source_kind:'ciqual_composite_dynamic',discovery_level:0,normalized_title:norm(title),food_dictionary_id:food.food_dictionary_id||null,country:food.country||null,categories:Array.isArray(food.categories)?food.categories:[]};
  const base={recipe_id:id,title,subtitle:'Référence CIQUAL · plat composé',meal_type:'dinner',mood:'equilibre',ingredients:[food.display_name||food.name]};
  const item={ingredient_name:food.display_name||food.name,dictionary_id:food.food_dictionary_id||null,ciqual_code:food.ciqual_code,quantity_g:qty,cost_eur:cost,optional:false,requires_choice:false,budget_exempt:false,resolution_status:'ciqual_component_price'};
  const p={status:'tee_ciqual_composite_v1',total_estimated_eur:cost,coverage_pct:100,items:[item]};
  const facts={items:[item],known:[item],cost,coverage:100,total:1,priced:1};
  const traits=fallbackCandidateTraits(base,meta);traits.leftover_compatible=false;traits.traits_source='ciqual_dynamic';
  const affinity=candidateMemoryAffinity(base,memoryState,meta);
  return {...base,_meta:meta,_traits:traits,_haveCount:0,_memoryAffinity:affinity,_recentExact:memoryState?.active&&memoryState.recentTitles.has(norm(title)),_effectiveDiscoveryLevel:0,_baseScore:0.8,_score:0.8+coverageReliabilityScore(100),_missing:[],_price:p,_priceFacts:facts,_missingPriceItems:[item],_missingDocumentedCost:cost,_missingPriceCoverage:100,_coverageReliabilityScore:coverageReliabilityScore(100),_dynamicCiqual:true};
}
function dynamicCandidateFromParts(protein,starch,veg,priceMap,servings,memoryState){
  const parts=[protein,starch,veg],items=[],names=[],codes=[];
  let cost=0;
  for(const f of parts){
    const qty=ciqualRolePortion(f)*servings,p=priceMap.get(String(f.ciqual_code)),c=ciqualPriceCost(p,qty);
    if(c===null)return null;
    cost+=c;codes.push(f.ciqual_code);names.push(shortCiqualName(f.display_name||f.name));
    items.push({ingredient_name:f.display_name||f.name,dictionary_id:f.food_dictionary_id||null,ciqual_code:f.ciqual_code,quantity_g:qty,cost_eur:c,optional:false,requires_choice:false,budget_exempt:false,resolution_status:'ciqual_component_price'});
  }
  const title=`${names[0]} · ${names[1]} · ${names[2]}`;
  const id=stableUuidV4891(`TEE-ASSEMBLED|${codes.join('|')}`);
  const categories=[...new Set(parts.flatMap(f=>Array.isArray(f.categories)?f.categories:[]))];
  const meta={source_kind:'assembled_ciqual',discovery_level:0,normalized_title:norm(title),food_dictionary_id:null,country:null,categories};
  const base={recipe_id:id,title,subtitle:'Assiette composée par TEE · références CIQUAL',meal_type:'dinner',mood:'equilibre',ingredients:parts.map(f=>f.display_name||f.name)};
  const p={status:'tee_ciqual_assembled_v1',total_estimated_eur:cost,coverage_pct:100,items};
  const facts={items,known:items,cost,coverage:100,total:items.length,priced:items.length};
  const traits=fallbackCandidateTraits(base,meta);traits.leftover_compatible=false;traits.dish_format='plate';traits.cooking_technique='mixed';traits.complete_meal=true;traits.traits_source='ciqual_assembled';
  const affinity=candidateMemoryAffinity(base,memoryState,meta);
  return {...base,_meta:meta,_traits:traits,_haveCount:0,_memoryAffinity:affinity,_recentExact:memoryState?.active&&memoryState.recentTitles.has(norm(title)),_effectiveDiscoveryLevel:0,_baseScore:1.0,_score:1.0+coverageReliabilityScore(100),_missing:[],_price:p,_priceFacts:facts,_missingPriceItems:items,_missingDocumentedCost:cost,_missingPriceCoverage:100,_coverageReliabilityScore:coverageReliabilityScore(100),_dynamicCiqual:true};
}
async function buildDynamicCiqualCandidatesV4891({memoryState,exclude,budget,budgetMode,servings,generationRound,userId}){
  const universe=await loadCiqualUniverseV4891();
  if(!universe.length)return {candidates:[],universeCount:0,pricedComponents:0};
  const excludeNorm=exclude.map(norm).filter(Boolean),seed=`${userId}|${isoWeekKey()}|${budget}|${budgetMode}|${generationRound}`;
  const roles={
    protein:[...ciqualReservoir(universe,'protein',memoryState,seed,excludeNorm,55),...ciqualReservoir(universe,'protein_plant',memoryState,seed,excludeNorm,25)],
    starch:ciqualReservoir(universe,'starch',memoryState,seed,excludeNorm,65),
    vegetable:ciqualReservoir(universe,'vegetable',memoryState,seed,excludeNorm,65),
    composite:ciqualReservoir(universe,'composite',memoryState,seed,excludeNorm,55)
  };
  const codeSet=new Set([...roles.protein,...roles.starch,...roles.vegetable,...roles.composite].map(x=>String(x.ciqual_code)));
  const pr=await safeCall(sb.rpc('mt_planner_ciqual_price_batch_v1',{p_ciqual_codes:[...codeSet],p_country:'FR',p_region:null}),16000,'Le chiffrage des aliments CIQUAL');
  if(pr?.error){console.warn('[TEE V489.1] prix CIQUAL indisponibles',pr.error);return {candidates:[],universeCount:universe.length,pricedComponents:0}}
  const priceMap=buildCiqualPriceMap(pr?.data||[]);
  const usable=f=>ciqualPriceCost(priceMap.get(String(f.ciqual_code)),ciqualRolePortion(f)*servings)!==null;
  const P=roles.protein.filter(usable).slice(0,16),S=roles.starch.filter(usable).slice(0,14),V=roles.vegetable.filter(usable).slice(0,16),C=roles.composite.filter(usable).slice(0,40);
  const out=[];
  C.forEach(f=>{const c=dynamicCandidateFromComposite(f,priceMap.get(String(f.ciqual_code)),servings,memoryState);if(c)out.push(c)});
  const target=budget>0?budget/7:0,combos=[];
  for(const p of P)for(const s of S)for(const v of V){
    const c=dynamicCandidateFromParts(p,s,v,priceMap,servings,memoryState);if(!c)continue;
    const fit=target>0?1-Math.min(1,Math.abs((c._missingDocumentedCost/target)-0.78)):0.5;
    const mem=Number(c._memoryAffinity)||0,rot=stableUnit(`${seed}|${c.recipe_id}`);
    combos.push({c,score:fit*2.2+(memoryState?.active?mem*1.5:0)+rot*0.8});
  }
  combos.sort((a,b)=>b.score-a.score||String(a.c.title).localeCompare(String(b.c.title),'fr'));
  out.push(...combos.slice(0,220).map(x=>x.c));
  return {candidates:out,universeCount:universe.length,pricedComponents:P.length+S.length+V.length+C.length};
}
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
function budgetFitValue(recipe,tier,target){
  const cost=Number(recipe?._missingDocumentedCost)||0;
  if(!target||!cost)return 0.35;
  const ratio=cost/target;
  if(tier==='economy'){
    // Budget serré : préférence franche pour les plats sous le repère/jour,
    // sans forcer artificiellement le moins cher de tous.
    return clamp(1.15-ratio,0,1.15);
  }
  if(tier==='balanced'){
    // Budget intermédiaire : on exploite réellement le budget disponible.
    // Le coeur est autour de 65–85 % du repère/jour.
    return clamp(1-Math.abs(ratio-0.72)/0.72,0,1);
  }
  // Budget souple : on autorise des plats plus chers, sans chercher à dépenser.
  return clamp(1-Math.abs(ratio-0.88)/0.88,0,1);
}
function budgetCorePool(pool,tier,target){
  const arr=Array.isArray(pool)?pool:[];
  if(!target||arr.length<5)return arr;
  let core=[];
  if(tier==='economy'){
    core=arr.filter(r=>{
      const c=Number(r?._missingDocumentedCost)||0;
      return c>0&&c<=target*1.08;
    });
  }else if(tier==='balanced'){
    core=arr.filter(r=>{
      const c=Number(r?._missingDocumentedCost)||0;
      return c>0&&c>=target*0.50&&c<=target*1.08;
    });
  }else{
    core=arr.filter(r=>{
      const c=Number(r?._missingDocumentedCost)||0;
      return c>0&&c>=target*0.38&&c<=target*1.22;
    });
  }
  // Un band budgétaire ne doit jamais appauvrir dangereusement le catalogue.
  return core.length>=5?core:arr;
}
function profileGuidedPool(pool,memoryState,tier,target){
  if(!memoryState?.active)return [];
  const base=budgetCorePool(pool,tier,target).filter(r=>!r?._recentExact);
  if(!base.length)return [];

  const ranked=base.map(r=>({
      r,
      aff:Number(r?._memoryAffinity)||0,
      rank:Number(r?._memoryRank)||0,
      fit:budgetFitValue(r,tier,target)
    }))
    .sort((a,b)=>{
      const sa=a.rank*0.72+a.fit*0.28;
      const sb=b.rank*0.72+b.fit*0.28;
      return sb-sa || b.aff-a.aff || String(a.r?.title||'').localeCompare(String(b.r?.title||''),'fr');
    });

  // Il faut un signal personnel réel : sinon on laisse le moteur budget/variété
  // fonctionner plutôt que de prétendre personnaliser.
  if((ranked[0]?.aff||0)<0.22 && (ranked[0]?.rank||0)<0.62)return [];

  // Un vrai sous-pool : 5 à 6 voisins maximum. Avant, jusqu'à 10 candidats
  // finissaient par recréer presque exactement la semaine générique.
  const wanted=Math.min(6,Math.max(4,Math.ceil(base.length*0.32)));
  return ranked.slice(0,wanted).map(x=>x.r);
}
function plannedOpenMemorySlot(index){
  // 5 choix profilés + 2 respirations. Les slots ouverts restent soumis
  // au budget et à la fiabilité, mais la mémoire y pèse beaucoup moins.
  return index===4||index===5;
}


// ---------------------------------------------------------------------------
// V489.0 — moteur déterministe global de semaine
// ---------------------------------------------------------------------------
function stableHash32(value){
  let h=2166136261>>>0;
  const s=String(value??'');
  for(let i=0;i<s.length;i++){
    h^=s.charCodeAt(i);
    h=Math.imul(h,16777619)>>>0;
  }
  return h>>>0;
}
function stableUnit(value){return (stableHash32(value)%100000)/100000}
function isoWeekKey(date=new Date()){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week=Math.ceil((((d-yearStart)/86400000)+1)/7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}
function recommendationHistoryMaps(history){
  const map=new Map();
  (Array.isArray(history?.items)?history.items:[]).forEach(x=>{
    if(x?.candidate_id)map.set(String(x.candidate_id),x);
  });
  return {map,generationsThisWeek:Number(history?.generations_this_week||0)};
}
function recommendationPenalty(candidate,historyMap){
  const h=historyMap.get(String(candidate?.recipe_id||''));
  if(!h)return 0;
  const t7=Number(h.times_7d||0),t28=Number(h.times_28d||0);
  const age=h.last_seen?Math.max(0,(Date.now()-new Date(h.last_seen).getTime())/86400000):999;
  let p=0;
  if(age<1.5)p-=7.0;
  else if(age<7)p-=4.2;
  else if(age<14)p-=2.2;
  else if(age<28)p-=1.0;
  p-=Math.min(5,t7*1.25);
  p-=Math.min(2.5,Math.max(0,t28-t7)*0.35);
  return p;
}
function fallbackCandidateTraits(recipe,meta){
  const text=norm([recipe?.title,recipe?.subtitle,recipe?.meal_type,...(Array.isArray(recipe?.ingredients)?recipe.ingredients:[])].join(' '));
  const has=(re)=>re.test(text);
  let protein='mixed_unknown';
  if(has(/\b(boeuf|steak|bourguignon|kefta|hachis)\b/))protein='beef';
  else if(has(/\b(poulet|dinde|volaille|chicken|gai)\b/))protein='poultry';
  else if(has(/\b(poisson|saumon|truite|thon|crevette|crevettes|wonton)\b/))protein='fish_seafood';
  else if(has(/\b(oeuf|oeufs)\b/))protein='egg';
  else if(has(/\b(tofu|lentille|lentilles|pois chiche|pois chiches|haricot|haricots)\b/))protein='plant';
  let starch='other_none';
  if(has(/\b(riz|paella)\b/))starch='rice';
  else if(has(/\b(ramen|nouille|nouilles|pate|pates|pasta|pad thai)\b/))starch='pasta_noodle';
  else if(has(/\b(pomme de terre|pommes de terre|hachis)\b/))starch='potato';
  else if(has(/\b(couscous|semoule|boulgour)\b/))starch='semolina_bulgur';
  else if(has(/\b(pain|tartine)\b/))starch='bread';
  else if(has(/\b(plantain|banane plantain)\b/))starch='plantain';
  let technique='mixed',format='plate';
  if(has(/\b(soupe|ramen|harira|tom kha)\b/)){technique='soup';format='soup'}
  else if(has(/\b(bourguignon|cassoulet|potee|mijote|tajine|mafe|yassa)\b/)){technique='stew';format='stew_plate'}
  else if(has(/\b(salade)\b/)){technique='cold_raw';format='salad'}
  else if(has(/\b(bowl)\b/)){format='bowl'}
  else if(has(/\b(frit|frite|friture|tempura)\b/)){technique='fried'}
  else if(has(/\b(grille|grillee|grill)\b/)){technique='grilled'}
  else if(has(/\b(four|gratin|moussaka|hachis)\b/)){technique='baked'}
  const country=norm(meta?.country||'');
  let cuisine='tee_general';
  if(['japon','chine','thailande','coree du sud','vietnam'].includes(country))cuisine='east_southeast_asia';
  else if(['maroc','tunisie','algerie'].includes(country))cuisine='maghreb';
  else if(['senegal','cote d ivoire','mali','ghana','nigeria'].includes(country))cuisine='west_africa';
  else if(['cameroun','rdc','republique democratique du congo','congo'].includes(country))cuisine='central_africa';
  else if(country)cuisine=country;
  return {
    protein_family:protein,starch_family:starch,vegetable_family:'unknown_none',
    dish_format:format,cooking_technique:technique,cuisine_family:cuisine,
    complete_meal:true,leftover_compatible:(meta?.source_kind||'recipe')==='recipe'&&technique!=='cold_raw',
    traits_source:'frontend_fallback'
  };
}
function candidateTraitsFor(recipe,meta,traitMap){
  const t=traitMap.get(String(recipe?.recipe_id||''));
  return t||fallbackCandidateTraits(recipe,meta);
}
function budgetModePolicy(mode){
  if(mode==='save')return {targetRatio:0.62,minRatio:0.30,maxRatio:0.82,budgetWeight:15,diversityWeight:0.82,memoryWeight:1.0,label:'Économiser au maximum'};
  if(mode==='variety')return {targetRatio:0.94,minRatio:0.76,maxRatio:1.00,budgetWeight:24,diversityWeight:1.45,memoryWeight:1.08,label:'Privilégier la variété dans cette enveloppe'};
  return {targetRatio:0.86,minRatio:0.68,maxRatio:0.98,budgetWeight:21,diversityWeight:1.10,memoryWeight:1.05,label:'Utiliser raisonnablement mon budget'};
}
function weeklyBudgetScore(cost,budget,policy){
  if(!budget||budget<=0)return 0;
  const ratio=cost/budget;
  if(ratio>1)return -120-(ratio-1)*180;
  if(policy===undefined)policy=budgetModePolicy('balanced');
  if(policy.targetRatio<=0.65){
    // Mode économies : rester nettement sous l'enveloppe est volontaire.
    return 8-clamp(ratio,0,1)*2-Math.max(0,ratio-policy.maxRatio)*45;
  }
  let score=15-Math.abs(ratio-policy.targetRatio)*policy.budgetWeight;
  if(ratio<policy.minRatio)score-=(policy.minRatio-ratio)*38;
  if(ratio>policy.maxRatio)score-=(ratio-policy.maxRatio)*55;
  return score;
}
function candidateIsFamiliar(r,memoryState){
  if(!memoryState?.active)return false;
  return (Number(r?._memoryRank)||0)>=0.58 || (Number(r?._memoryAffinity)||0)>=1.0;
}
function candidateIsFarNovel(r,memoryState){
  if(!memoryState?.active)return false;
  return (Number(r?._memoryRank)||0)<0.28 && (Number(r?._memoryAffinity)||0)<0.38;
}
function countInc(obj,key){
  const out={...obj};
  const k=String(key||'unknown');
  out[k]=(out[k]||0)+1;
  return out;
}
function countGet(obj,key){return Number(obj?.[String(key||'unknown')]||0)}
function traitKey(r,key){return String(r?._traits?.[key]||'unknown')}
function individualUtilityV489(r,ctx){
  const memoryState=ctx.memoryState;
  let score=clamp(Number(r?._baseScore)||0,-10,10)*0.24;
  score+=coverageReliabilityScore(Number(r?._missingPriceCoverage)||0)*1.35;
  score+=recommendationPenalty(r,ctx.historyMap);
  if(r?._recentExact)score-=16;
  if(memoryState?.active){
    const rank=Number(r?._memoryRank)||0;
    const aff=Number(r?._memoryAffinity)||0;
    const weight=(memoryState.strong?1.35:1.05)*ctx.policy.memoryWeight;
    score+=rank*7.2*weight+Math.min(5.5,aff)*1.25*weight;
    if(candidateIsFarNovel(r,memoryState))score-=1.3;
  }
  const discovery=Number(r?._effectiveDiscoveryLevel)||0;
  if(discovery===1)score-=0.55;
  if(discovery===2 && !candidateIsFamiliar(r,memoryState))score-=4.2;
  const rotationSeed=`${ctx.userId}|${ctx.weekKey}|${ctx.budget}|${ctx.budgetMode}|${ctx.generationRound}|${r?.recipe_id}`;
  score+=(stableUnit(rotationSeed)-0.5)*0.7;
  return score;
}
function candidateExpansionPool(candidates,ctx){
  if(candidates.length<=42)return candidates;
  const byUtility=[...candidates].sort((a,b)=>individualUtilityV489(b,ctx)-individualUtilityV489(a,ctx)).slice(0,22);
  const byMemory=ctx.memoryState?.active?[...candidates].sort((a,b)=>(Number(b._memoryRank)||0)-(Number(a._memoryRank)||0)).slice(0,10):[];
  const byCheap=[...candidates].sort((a,b)=>(Number(a._missingDocumentedCost)||0)-(Number(b._missingDocumentedCost)||0)).slice(0,6);
  const byExpensive=[...candidates].sort((a,b)=>(Number(b._missingDocumentedCost)||0)-(Number(a._missingDocumentedCost)||0)).slice(0,8);
  const out=[],seen=new Set();
  [...byUtility,...byMemory,...byCheap,...byExpensive].forEach(r=>{const k=String(r.recipe_id);if(!seen.has(k)){seen.add(k);out.push(r)}});
  return out.slice(0,42);
}
function incrementalDiversityV489(state,r,ctx){
  const p=traitKey(r,'protein_family'),s=traitKey(r,'starch_family'),t=traitKey(r,'cooking_technique'),f=traitKey(r,'dish_format'),c=traitKey(r,'cuisine_family');
  const pc=countGet(state.proteinCounts,p),sc=countGet(state.starchCounts,s),tc=countGet(state.techniqueCounts,t),fc=countGet(state.formatCounts,f),cc=countGet(state.cuisineCounts,c);
  let d=0;
  d+=pc===0?0.95:pc===1?-0.35:-1.8;
  if(s!=='other_none'&&s!=='unknown')d+=sc===0?0.70:sc===1?-0.45:-2.1;
  d+=tc===0?0.72:tc===1?-0.25:-1.4;
  d+=fc===0?0.48:fc===1?-0.20:-1.0;
  d+=cc===0?0.52:cc===1?-0.18:-0.9;
  return d*ctx.policy.diversityWeight;
}
function violatesHardWeekConstraint(state,r,ctx){
  const p=traitKey(r,'protein_family'),s=traitKey(r,'starch_family'),t=traitKey(r,'cooking_technique'),c=traitKey(r,'cuisine_family');
  if(state.used.has(String(r.recipe_id)))return true;
  if(p==='beef'&&countGet(state.proteinCounts,p)>=2)return true;
  if(s!=='other_none'&&s!=='unknown'&&countGet(state.starchCounts,s)>=2)return true;
  if(t==='stew'&&state.lastTechnique==='stew')return true;
  if(c!=='tee_general'&&countGet(state.cuisineCounts,c)>=3)return true;
  const discovery=Number(r?._effectiveDiscoveryLevel)||0;
  if(discovery===2&&state.specificDiscovery>=1&&!candidateIsFamiliar(r,ctx.memoryState))return true;
  if(ctx.memoryState?.active&&candidateIsFarNovel(r,ctx.memoryState)&&state.farNovel>=1)return true;
  return false;
}
function makeNextStateV489(state,r,ctx,dayIndex,isLeftover=false){
  const cost=Number(r?._missingDocumentedCost)||0;
  const nextCost=state.cost+cost;
  if(ctx.budget>0&&nextCost>ctx.budget*1.001)return null;
  const p=traitKey(r,'protein_family'),s=traitKey(r,'starch_family'),t=traitKey(r,'cooking_technique'),f=traitKey(r,'dish_format'),c=traitKey(r,'cuisine_family');
  const next={
    items:[...state.items,{dayIndex,recipe:r,leftover:isLeftover}],
    used:new Set(state.used),
    cost:nextCost,
    score:state.score,
    proteinCounts:{...state.proteinCounts},starchCounts:{...state.starchCounts},techniqueCounts:{...state.techniqueCounts},formatCounts:{...state.formatCounts},cuisineCounts:{...state.cuisineCounts},
    specificDiscovery:state.specificDiscovery,accessibleDiscovery:state.accessibleDiscovery,
    familiarCount:state.familiarCount,farNovel:state.farNovel,
    fishCount:state.fishCount,vegetarianCount:state.vegetarianCount,
    leftovers:state.leftovers,lastTechnique:state.lastTechnique,lastRecipe:state.lastRecipe
  };
  if(isLeftover){
    next.leftovers++;
    next.score+=ctx.budgetMode==='save'?1.0:0.18;
    next.lastTechnique=t;
    next.lastRecipe=r;
    return next;
  }
  next.used.add(String(r.recipe_id));
  next.score+=individualUtilityV489(r,ctx)+incrementalDiversityV489(state,r,ctx);
  next.proteinCounts=countInc(next.proteinCounts,p);
  next.starchCounts=countInc(next.starchCounts,s);
  next.techniqueCounts=countInc(next.techniqueCounts,t);
  next.formatCounts=countInc(next.formatCounts,f);
  next.cuisineCounts=countInc(next.cuisineCounts,c);
  const discovery=Number(r?._effectiveDiscoveryLevel)||0;
  if(discovery===2)next.specificDiscovery++;
  if(discovery===1)next.accessibleDiscovery++;
  if(candidateIsFamiliar(r,ctx.memoryState))next.familiarCount++;
  if(candidateIsFarNovel(r,ctx.memoryState))next.farNovel++;
  if(p==='fish_seafood')next.fishCount++;
  if(p==='plant')next.vegetarianCount++;
  next.lastTechnique=t;
  next.lastRecipe=r;
  return next;
}
function provisionalStateScoreV489(state,step,totalSteps,ctx){
  let s=state.score;
  if(ctx.budget>0&&ctx.budgetMode!=='save'){
    const expected=ctx.budget*ctx.policy.targetRatio*(step/Math.max(1,totalSteps));
    s-=Math.abs(state.cost-expected)*0.48;
  }
  return s;
}
function finalStateScoreV489(state,ctx){
  let s=state.score+weeklyBudgetScore(state.cost,ctx.budget,ctx.policy);
  const uniqueProteins=Object.keys(state.proteinCounts).filter(k=>state.proteinCounts[k]>0&&k!=='mixed_unknown').length;
  const uniqueStarches=Object.keys(state.starchCounts).filter(k=>state.starchCounts[k]>0&&k!=='other_none').length;
  const uniqueTechniques=Object.keys(state.techniqueCounts).filter(k=>state.techniqueCounts[k]>0).length;
  const uniqueFormats=Object.keys(state.formatCounts).filter(k=>state.formatCounts[k]>0).length;
  s+=(uniqueProteins*0.65+uniqueStarches*0.45+uniqueTechniques*0.48+uniqueFormats*0.30)*ctx.policy.diversityWeight;
  if(ctx.capabilities.hasFish)s+=state.fishCount>0?2.4:-2.8;
  if(ctx.capabilities.hasVegetarian)s+=state.vegetarianCount>0?1.8:-2.0;
  if(ctx.memoryState?.active){
    const target=ctx.memoryState.strong?5:4;
    s-=Math.abs(state.familiarCount-target)*1.55;
    // La semaine personnalisée doit conserver 1 à 2 respirations quand possible.
    const openCount=Math.max(0,ctx.totalSteps-state.familiarCount);
    if(openCount>=1&&openCount<=2)s+=1.2;
    if(state.familiarCount>=ctx.totalSteps)s-=1.4;
  }
  return s;
}
function optimizeWeekV489({candidates,dayIndexes,budget,budgetMode,leftovers,memoryState,historyMap,generationRound,userId}){
  const policy=budgetModePolicy(budgetMode);
  const weekKey=isoWeekKey();
  const reliable=candidates.filter(r=>Number(r?._missingPriceCoverage||0)>=100);
  // Fiabilité avant mémoire : si assez de plats 100 % existent pour construire la semaine,
  // aucun 75/86 % ne peut entrer dans le pool d'optimisation.
  const basePool=reliable.length>=dayIndexes.length?reliable:candidates;
  const capabilities={
    hasFish:basePool.some(r=>traitKey(r,'protein_family')==='fish_seafood'),
    hasVegetarian:basePool.some(r=>traitKey(r,'protein_family')==='plant')
  };
  const ctx={budget,budgetMode,policy,memoryState,historyMap,generationRound,userId,weekKey,capabilities,totalSteps:dayIndexes.length};
  const expansionPool=candidateExpansionPool(basePool,ctx);
  const beamWidth=160;
  const perStateLimit=Math.min(36,expansionPool.length);
  const maxLeftovers=leftovers?(budgetMode==='save'?2:1):0;
  let beam=[{
    items:[],used:new Set(),cost:0,score:0,
    proteinCounts:{},starchCounts:{},techniqueCounts:{},formatCounts:{},cuisineCounts:{},
    specificDiscovery:0,accessibleDiscovery:0,familiarCount:0,farNovel:0,fishCount:0,vegetarianCount:0,leftovers:0,lastTechnique:null,lastRecipe:null
  }];
  dayIndexes.forEach((dayIndex,stepIdx)=>{
    const next=[];
    for(const state of beam){
      const ranked=[...expansionPool]
        .filter(r=>!violatesHardWeekConstraint(state,r,ctx))
        .map(r=>({r,u:individualUtilityV489(r,ctx)+incrementalDiversityV489(state,r,ctx)}))
        .sort((a,b)=>b.u-a.u)
        .slice(0,perStateLimit);
      for(const x of ranked){
        const n=makeNextStateV489(state,x.r,ctx,dayIndex,false);
        if(n)next.push(n);
      }
      if(state.lastRecipe&&state.leftovers<maxLeftovers&&state.lastRecipe?._traits?.leftover_compatible){
        const n=makeNextStateV489(state,state.lastRecipe,ctx,dayIndex,true);
        if(n)next.push(n);
      }
    }
    next.sort((a,b)=>provisionalStateScoreV489(b,stepIdx+1,dayIndexes.length,ctx)-provisionalStateScoreV489(a,stepIdx+1,dayIndexes.length,ctx));
    beam=next.slice(0,beamWidth);
  });
  if(!beam.length)return {items:[],score:-Infinity,cost:0,reliableUsed:reliable.length>=dayIndexes.length,poolSize:basePool.length};
  beam.sort((a,b)=>finalStateScoreV489(b,ctx)-finalStateScoreV489(a,ctx));
  const best=beam[0];
  return {items:best.items,score:finalStateScoreV489(best,ctx),cost:best.cost,reliableUsed:basePool===reliable,poolSize:basePool.length,capabilities};
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

async function loadFusedPlannerMemory(){
  const fused=await safeCall(sb.rpc('mt_tee_memory_domain_v1',{
    p_domain:'planner',
    p_target_date:new Date().toLocaleDateString('sv-SE'),
    p_refresh_learning:false
  }),8000,'La mémoire globale TEE');
  if(!fused?.error&&fused?.data){
    return {global:fused.data,food:fused.data.food_memory||null,source:'fused'};
  }
  // Compatibilité de secours : si le backend fusionné n'est pas encore déployé,
  // la mémoire alimentaire V488.8.2 continue de fonctionner sans casser l'écran.
  const legacy=await safeCall(sb.rpc('mt_planner_personal_memory_v1',{p_days:60}),7000,'Ta mémoire alimentaire');
  return {global:null,food:legacy?.error?null:(legacy?.data||null),source:'food_only'};
}

function plannerMemorySentence(memoryState,globalBrain,tierLabel){
  if(memoryState?.active){
    return `${tierLabel} · TEE rapproche la semaine de tes habitudes alimentaires sans répéter exactement tes repas récents.`;
  }
  const stage=String(globalBrain?.stage||'starting');
  if(stage==='learning'||stage==='personalized'||stage==='deep_personalization'){
    return `${tierLabel} · TEE tient compte des repères déjà renseignés dans l’app, sans prétendre connaître tes habitudes alimentaires tant que ton carnet n’est pas assez documenté.`;
  }
  return `${tierLabel} · TEE garde une base familière et variée tant qu’elle ne connaît pas encore suffisamment tes habitudes.`;
}

async function planner(){
  const seedRaw=sessionStorage.getItem('mtPlannerPantrySeedV1')||'';
  if(seedRaw)sessionStorage.removeItem('mtPlannerPantrySeedV1');
  body('<div class="mt-next-status">Préparation de ta semaine…</div>');

  const [prefsRes,catalogRes,priceRes,metaRes,traitsRes,historyRes,memoryBundle]=await Promise.all([
    safeCall(sb.from('mt_planner_preferences').select('*').eq('user_id',user.id).maybeSingle(),8000,'Tes préférences'),
    safeCall(sb.rpc('mt_planner_recipe_catalog'),9000,'Tes recettes'),
    safeCall(sb.rpc('mt_price_status_v1'),6000,'Les repères de prix'),
    safeCall(sb.rpc('mt_planner_candidate_meta_v1'),7000,'La hiérarchie des plats'),
    safeCall(sb.rpc('mt_planner_candidate_traits_v1'),7000,'Les caractéristiques des plats'),
    safeCall(sb.rpc('mt_planner_recent_recommendations_v1',{p_days:42}),7000,'La rotation des semaines'),
    loadFusedPlannerMemory()
  ]);
  if(catalogRes?.error) throw catalogRes.error;

  const prefs=prefsRes?.error?null:prefsRes?.data;
  const catalog=catalogRes?.data;
  const priceStatus=priceRes?.error?null:priceRes?.data;
  const metaRows=metaRes?.error?[]:(Array.isArray(metaRes?.data)?metaRes.data:[]);
  const traitRows=traitsRes?.error?[]:(Array.isArray(traitsRes?.data)?traitsRes.data:[]);
  const recommendationHistory=historyRes?.error?null:(historyRes?.data||null);
  const globalBrain=memoryBundle?.global||null;
  const memory=memoryBundle?.food||null;
  const metaMap=new Map(metaRows.map(x=>[String(x.recipe_id),x]));
  const traitMap=new Map(traitRows.map(x=>[String(x.candidate_id),x]));
  const historyBundle=recommendationHistoryMaps(recommendationHistory||{});
  const memoryBase=memoryMaps(memory||{});
  const memoryState={...memoryBase,active:!!memory?.active,strong:!!memory?.strong,mealCount:Number(memory?.planner_meal_count||0),days:Number(memory?.planner_days_with_meals||0)};
  const p=prefs||{},rows=Array.isArray(catalog)?catalog:[];
  const seedTerms=list(seedRaw);
  const pantryInitial=[...new Set([...(seedTerms||[]),...(p.pantry_terms||[])])];

  body(`<article class="mt-next-card">
    <div class="mt-next-kicker">Planification adaptative</div>
    <h2>Partir de la vraie vie.</h2>
    <p>TEE exploite tes recettes, ton placard et l’univers CIQUAL complet comme briques alimentaires. Elle peut assembler de nouvelles assiettes déterministes à partir des références chiffrables, sans API d’IA externe.</p>
    ${priceSourceLine(priceStatus||{})}
    ${memoryState.active?`<div class="mt-next-price-source"><b>Mémoire personnelle active</b><span>TEE s’appuie sur ${memoryState.mealCount} repas déjeuner/dîner récents et les relie à tes autres repères personnels. Les habitudes alimentaires viennent uniquement de ce que tu as réellement enregistré.</span></div>`:`<div class="mt-next-price-source is-empty"><b>Mémoire personnelle en construction</b><span>${globalBrain&&String(globalBrain.stage||'starting')!=='starting'?'TEE connaît déjà certains repères de ton profil et de ton parcours, mais elle attend assez de repas enregistrés avant de parler de tes habitudes alimentaires.':'Elle se construit progressivement avec les informations que tu choisis de renseigner dans l’app.'}</span></div>`}
    <div class="mt-next-field"><label>Ce que j’ai déjà</label><textarea id="mtPlanPantry" placeholder="saumon, riz, courgettes…">${esc(pantryInitial.join(', '))}</textarea></div>
    <div class="mt-next-field"><label>Je ne veux pas</label><input id="mtPlanExclude" value="${esc((p.excluded_terms||[]).join(', '))}" placeholder="œufs, porc…"></div>
    <div class="mt-next-grid">
      <div class="mt-next-field"><label>Budget indicatif semaine</label><input id="mtPlanBudget" type="number" min="0" step="1" value="${esc(p.weekly_budget_eur??45)}"></div>
      <div class="mt-next-field"><label>Personnes</label><input id="mtPlanServings" type="number" min="1" max="8" value="${esc(p.servings||1)}"></div>
    </div>
    <div class="mt-next-field"><label>Comment utiliser mon budget ?</label><select id="mtPlanBudgetMode">
      <option value="save" ${p.budget_mode==='save'?'selected':''}>Économiser au maximum</option>
      <option value="balanced" ${!p.budget_mode||p.budget_mode==='balanced'?'selected':''}>Utiliser raisonnablement mon budget</option>
      <option value="variety" ${p.budget_mode==='variety'?'selected':''}>Privilégier la variété dans cette enveloppe</option>
    </select></div>
    <div class="mt-next-grid">
      <div class="mt-next-field"><label>Restaurant</label><select id="mtPlanRestaurant"><option value="">Aucun jour prévu</option>${DAYS.map((d,i)=>`<option value="${i}" ${String(p.restaurant_day??'')===String(i)?'selected':''}>${d}</option>`).join('')}</select></div>
      <label class="mt-next-choice" style="margin-top:28px"><input id="mtPlanLeftovers" type="checkbox" ${p.use_leftovers!==false?'checked':''}><span>Réutiliser les restes</span></label>
    </div>
    <button class="mt-next-primary" id="mtPlanGo">Construire ma semaine</button>
    <p class="mt-next-mini">Le budget est une enveloppe pilotée selon le mode choisi. TEE optimise la semaine entière à partir du catalogue de plats ET de l’univers CIQUAL complet : coût, diversité, mémoire, placard, répétitions et fiabilité. Aucun appel à une IA externe.</p>
  </article><section id="mtPlanResult"></section>`);

  document.getElementById('mtPlanGo').onclick=async()=>{
    const result=document.getElementById('mtPlanResult');
    result.innerHTML='<div class="mt-next-status">TEE organise ta semaine…</div>';

    try{
      const pantry=list(document.getElementById('mtPlanPantry').value);
      const exclude=list(document.getElementById('mtPlanExclude').value);
      const budget=Number(document.getElementById('mtPlanBudget').value)||0;
      const budgetMode=document.getElementById('mtPlanBudgetMode')?.value||'balanced';
      const servings=Math.max(1,Math.min(8,Number(document.getElementById('mtPlanServings').value)||1));
      const restaurant=document.getElementById('mtPlanRestaurant').value;
      const leftovers=document.getElementById('mtPlanLeftovers').checked;
      const tier=budgetTier(budget);
      const availableDays=restaurant===''?7:6;
      const target=budget>0?budget/Math.max(1,availableDays):0;

      const prefSave=await withTimeout(sb.from('mt_planner_preferences').upsert({
        user_id:user.id,pantry_terms:pantry,excluded_terms:exclude,
        weekly_budget_eur:budget||null,budget_mode:budgetMode,servings,
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
        const traits=candidateTraitsFor(r,meta,traitMap);
        const affinity=candidateMemoryAffinity(r,memoryState,meta);
        const recentKey=norm(meta?.normalized_title||r.title||'');
        const recentExact=memoryState.active&&memoryState.recentTitles.has(recentKey);
        const discoveryLevel=effectiveDiscoveryLevel(r,memoryState,meta);
        return {
          ...r,
          _meta:meta,
          _traits:traits,
          _haveCount:have,
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

      // V489.0 — prix de TOUS les candidats au clic, sans limite cachée à 60.
      // Le batch V2 découpe côté Supabase et réutilise le dispatch strict V488.5.
      const priceIds=candidates.map(x=>x.recipe_id);
      if(priceIds.length){
        try{
          let priced=null,priceErr=null;
          const v2=await safeCall(sb.rpc('mt_recipe_cost_batch_v2',{
            p_recipe_ids:priceIds,p_servings:servings,p_country:'FR',p_region:null
          }),16000,'Le calcul complet des prix');
          if(!v2?.error){priced=v2?.data||[]}
          else{
            // Fallback rétrocompatible si le SQL V489 n'est pas encore déployé :
            // appels V1 en tranches de 60, donc aucun candidat silencieusement ignoré.
            const chunks=[];
            for(let i=0;i<priceIds.length;i+=60)chunks.push(priceIds.slice(i,i+60));
            const parts=[];
            for(const chunk of chunks){
              const r=await withTimeout(sb.rpc('mt_recipe_cost_batch_v1',{
                p_recipe_ids:chunk,p_servings:servings,p_country:'FR',p_region:null
              }),12000,'Le calcul des prix');
              if(r?.error){priceErr=r.error;break}
              parts.push(...(r?.data||[]));
            }
            priced=parts;
          }
          if(priceErr)throw priceErr;
          const priceMap=new Map((priced||[]).map(x=>[String(x.recipe_id),x.cost]));
          candidates=candidates.map(r=>{
            const price=priceMap.get(String(r.recipe_id))||null;
            const facts=priceFacts(price,pTok);
            const coverage=facts.coverage;
            return {
              ...r,
              _price:price,
              _priceFacts:facts,
              _missingPriceItems:facts.items,
              _missingDocumentedCost:facts.cost,
              _missingPriceCoverage:coverage,
              _coverageReliabilityScore:coverageReliabilityScore(coverage),
              _score:r._baseScore+coverageReliabilityScore(coverage)
            };
          });
        }catch(e){
          console.warn('[TEE planner V489] prix indisponibles',e);
        }
      }


      // V489.1 — le cerveau voit TOUT l'univers CIQUAL, puis assemble des repas
      // complets à partir de briques chiffrables. Les 32 anciens candidats restent
      // disponibles, mais ne constituent plus l'univers alimentaire du moteur.
      try{
        const dyn=await buildDynamicCiqualCandidatesV4891({
          memoryState,exclude,budget,budgetMode,servings,
          generationRound:historyBundle.generationsThisWeek,userId:user.id
        });
        if(Array.isArray(dyn.candidates)&&dyn.candidates.length){
          candidates.push(...dyn.candidates);
        }
        candidates._ciqualUniverseCount=dyn.universeCount||0;
        candidates._ciqualDynamicCount=(dyn.candidates||[]).length;
      }catch(e){
        console.warn('[TEE V489.1] assembleur CIQUAL indisponible',e);
      }

      // V489.0 — normalisation RELATIVE du signal mémoire.
      // Deux profils avec des scores bruts proches peuvent ainsi avoir des
      // classements réellement différents : on compare les candidats ENTRE EUX
      // pour ce profil, au lieu d'appliquer seulement un bonus absolu.
      if(memoryState.active&&candidates.length){
        const ordered=[...candidates].sort((a,b)=>(Number(a._memoryAffinity)||0)-(Number(b._memoryAffinity)||0));
        const n=Math.max(1,ordered.length-1);
        ordered.forEach((r,idx)=>{r._memoryRank=idx/n});
      }else{
        candidates.forEach(r=>{r._memoryRank=0});
      }

      // V489.0 — OPTIMISATION DE LA SEMAINE ENTIÈRE.
      // Plus de sélection gloutonne lundi -> mardi -> mercredi.
      const dayIndexes=[];
      for(let i=0;i<7;i++)if(String(i)!==String(restaurant))dayIndexes.push(i);
      const optimized=optimizeWeekV489({
        candidates,dayIndexes,budget,budgetMode,leftovers,memoryState,
        historyMap:historyBundle.map,generationRound:historyBundle.generationsThisWeek,
        userId:user.id
      });
      if(!optimized.items.length)throw new Error('Aucune semaine complète ne respecte actuellement les contraintes et la fiabilité disponibles.');
      const plan=[];
      const byDay=new Map(optimized.items.map(x=>[x.dayIndex,x]));
      for(let i=0;i<7;i++){
        if(String(i)===String(restaurant)){plan.push({day:DAYS[i],restaurant:true,dayIndex:i});continue}
        const x=byDay.get(i);
        plan.push({day:DAYS[i],dayIndex:i,recipe:x?.recipe||null,leftover:!!x?.leftover,repeat:false});
      }
      const reliableFallbackUsed=optimized.reliableUsed?0:1;
      const specificDiscoveryUsed=plan.filter(x=>Number(x.recipe?._effectiveDiscoveryLevel||0)===2&&!x.leftover).length;
      const accessibleDiscoveryUsed=plan.filter(x=>Number(x.recipe?._effectiveDiscoveryLevel||0)===1&&!x.leftover).length;
      const memoryGuidedUsed=memoryState.active?plan.filter(x=>x.recipe&&!x.leftover&&candidateIsFamiliar(x.recipe,memoryState)).length:0;
      const memoryOpenUsed=memoryState.active?plan.filter(x=>x.recipe&&!x.leftover&&!candidateIsFamiliar(x.recipe,memoryState)).length:0;
      const noveltyUsed=memoryState.active?plan.filter(x=>x.recipe&&!x.leftover&&candidateIsFarNovel(x.recipe,memoryState)).length:0;
      const memoryGuidedTarget=memoryState.active?(memoryState.strong?5:4):0;
      const memoryOpenTarget=memoryState.active?Math.max(0,dayIndexes.length-memoryGuidedTarget):0;

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
              food_dictionary_id:i.dictionary_id||null,
              quantity_g:0,
              cost_eur:0,
              priced:false,
              source:i.source_label||'',
              occurrences:0
            };

            prev.quantity_g+=Number(i.quantity_g)||0;
            if(!prev.food_dictionary_id&&i.dictionary_id)prev.food_dictionary_id=i.dictionary_id;
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
              name,food_dictionary_id:null,quantity_g:0,cost_eur:0,priced:false,source:'',occurrences:0
            };
            prev.occurrences++;
            shop.set(key,prev);
          });
        }
      });

      const coverage=totalOccurrences?Math.round(pricedOccurrences/totalOccurrences*100):100;
      const shopRows=[...shop.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'));

      // Format magasin : exact seulement quand un paquet vérifié est documenté.
      const quoteInput=shopRows.map(x=>({
        food_dictionary_id:x.food_dictionary_id||null,
        ingredient_name:x.name,
        quantity_g:Number(x.quantity_g)||0,
        consumed_cost_eur:x.priced?Number(x.cost_eur):null
      }));
      const purchaseRes=await safeCall(sb.rpc('mt_planner_purchase_quote_v1',{p_items:quoteInput,p_country:'FR'}),7000,'Le panier magasin');
      const purchaseQuote=purchaseRes?.error?null:(purchaseRes?.data||null);
      const packageCoverage=Number(purchaseQuote?.package_coverage_pct||0);
      const purchaseKnownCoverage=Number(purchaseQuote?.known_coverage_pct||0);
      const purchaseEstimated=num(purchaseQuote?.estimated_total_eur);
      const usePurchaseReference=purchaseEstimated!==null&&packageCoverage>=80;
      const budgetReferenceCost=usePurchaseReference?purchaseEstimated:totalDocumented;
      const confident=coverage>=80;
      const budgetState=budget>0
        ?confident
          ?(budgetReferenceCost<=budget?'Dans ton budget indicatif':'Au-dessus du budget indicatif')
          :'Budget à confirmer'
        :'';
      const costLabel=totalOccurrences
        ?pricedOccurrences
          ?`${euro(budgetReferenceCost)} ${usePurchaseReference?'panier estimé':'estimés'}`
          :'Coût à compléter'
        :'Aucun achat structuré détecté';

      // La rotation persistante est enregistrée APRÈS une semaine valide. Un échec
      // de journalisation ne bloque jamais la planification.
      safeCall(sb.rpc('mt_planner_record_generation_v1',{
        p_budget_eur:budget||null,
        p_budget_mode:budgetMode,
        p_generation_score:Number(optimized.score)||0,
        p_estimated_cost_eur:Number(budgetReferenceCost)||0,
        p_items:plan.filter(x=>x.recipe).map(x=>({
          day_index:x.dayIndex,candidate_id:x.recipe.recipe_id,candidate_title:x.recipe.title,is_leftover:!!x.leftover
        }))
      }),5000,'La rotation de tes suggestions');

      const policy=budgetModePolicy(budgetMode);
      const tierLabel=budgetMode==='save'
        ?'Priorité économies + rotation'
        :budgetMode==='variety'
          ?'Variété maximale dans ton enveloppe'
          :'Équilibre budget + variété';

      result.innerHTML=`<article class="mt-next-card">
        <div class="mt-next-kicker">Ta semaine</div>
        <h2>Une base qui s’adapte.</h2>
        <div class="mt-next-budget-summary">
          <div><small>Achats à prévoir</small><b>${esc(costLabel)}</b></div>
          <div><small>Part chiffrable</small><b>${coverage}%</b></div>
          ${budget?`<div><small>Repère budget</small><b>${esc(budgetState)}</b></div>`:''}
          ${purchaseQuote?`<div><small>Formats magasin</small><b>${packageCoverage}% documentés</b></div>`:''}
        </div>
        <p class="mt-next-mini">${esc(plannerMemorySentence(memoryState,globalBrain,tierLabel))}</p>
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
        ${purchaseQuote&&packageCoverage<100?`<p class="mt-next-mini">Formats magasin : ${packageCoverage}% des lignes disposent d’un paquet/format exact vérifié. Pour le reste, TEE conserve le coût des quantités consommées et ne prétend pas connaître le ticket de caisse exact.</p>`:''}
      </article>
      <article class="mt-next-card">
        <h2>À prévoir</h2>
        <div class="mt-next-shopping mt-next-shopping-priced">${shopRows.length?shopRows.map(x=>`<span>
          <b>${esc(x.name)}</b>
          <small>${x.quantity_g?`${Math.round(x.quantity_g)} g · `:''}${x.priced?`≈ ${euro(x.cost_eur)}`:'coût à confirmer'}${x.source?` · ${esc(x.source)}`:''}</small>
        </span>`).join(''):'<p>Rien de structuré à ajouter depuis les recettes sélectionnées.</p>'}</div>
      </article>`;

      window.mtLastPlannerDebug={
        version:'V489.0',
        budget,
        tier,
        budgetMode,
        coverage,
        totalDocumented,
        purchaseQuote,
        optimizer:{score:optimized.score,cost:optimized.cost,poolSize:optimized.poolSize,reliableUsed:optimized.reliableUsed,capabilities:optimized.capabilities,generationRound:historyBundle.generationsThisWeek},
        memory:{active:memoryState.active,strong:memoryState.strong,plannerMeals:memoryState.mealCount,plannerDays:memoryState.days,noveltyUsed,accessibleDiscoveryUsed,specificDiscoveryUsed,memoryGuidedTarget,memoryGuidedUsed,memoryOpenTarget,memoryOpenUsed,reliableFallbackUsed,brainStage:globalBrain?.stage||null,brainConfidence:Number(globalBrain?.confidence||0),source:memoryBundle?.source||null},
        plan:plan.map(x=>({
          day:x.day,
          restaurant:!!x.restaurant,
          leftover:!!x.leftover,
          repeat:!!x.repeat,
          recipe:x.recipe?.title||null,
          sourceKind:x.recipe?x.recipe._meta?.source_kind:null,
          discoveryLevel:x.recipe?x.recipe._effectiveDiscoveryLevel:null,
          memoryAffinity:x.recipe?Number(x.recipe._memoryAffinity||0):null,
          memoryRank:x.recipe?Number(x.recipe._memoryRank||0):null,
          traits:x.recipe?x.recipe._traits:null,
          recommendationPenalty:x.recipe?recommendationPenalty(x.recipe,historyBundle.map):null,
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