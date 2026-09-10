#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const raw=fs.readFileSync(path.join(root,'scripts','tee-next.js'),'utf8');
const code=raw.replace(
  "document.addEventListener('DOMContentLoaded',init);",
  "globalThis.__T={optimizeWeekV489,plannerWeekHardValidV4896,plannerChooseReplacementV4896,containsNormalizedTerm,matchesAnyExcludedTerm,activeCuisineThreadsV4896,activeUnfamiliarCuisineThreadsV48961,familiarCuisineFamiliesV48961,isCuisineThreadV4896,plannerReasonV4896,plannerPurchaseFormatTextV48961,canonicalCuisineFamilyV48961};"
);
const ctx={
  console,URLSearchParams,location:{search:''},Date,Math,Set,Map,String,Number,Array,Object,JSON,Intl,RegExp,
  requestAnimationFrame:fn=>fn(),cancelAnimationFrame:()=>{},performance:{now:()=>0},
  window:{matchMedia:()=>({matches:false})},
  document:{}
};
vm.createContext(ctx);vm.runInContext(code,ctx);
const T=ctx.__T;

const proteins=['poultry','fish_seafood','plant','egg','beef','pork'];
const starches=['rice','potato','quinoa','bread','pasta_noodle','semolina_bulgur'];
const cuisines=['central_africa','west_africa','east_asia','southeast_asia','western_europe','southern_europe','mediterranean'];
function meal(i){
  const protein=proteins[i%proteins.length],starch=starches[(i*2)%starches.length],cuisine=cuisines[i%cuisines.length];
  return {
    recipe_id:`96100000-0000-4000-8000-${String(i).padStart(12,'0')}`,
    title:`Repas ${i}`,ingredients:[protein,starch,`légume ${i}`],
    _baseScore:4+(i%5),_missingPriceCoverage:100,_missingDocumentedCost:5.1+(i%3)*.35,
    _memoryRank:0,_memoryAffinity:0,_recentExact:false,_effectiveDiscoveryLevel:0,
    _meta:{source_kind:'curated_meal_v48941',discovery_level:0},
    _traits:{protein_family:protein,starch_family:starch,cooking_technique:['grilled','baked','sauteed'][i%3],dish_format:'plate',cuisine_family:cuisine,leftover_compatible:true},
    _componentKeys:[`protein:${protein}`,`starch:${starch}`,`vegetable:v${i}`],_semanticSignature:`meal:${i}`
  };
}
const candidates=Array.from({length:56},(_,i)=>meal(i+1));
const feedbackState={rejected:new Set([candidates[0].recipe_id]),replaced:new Map(),rows:new Map(),remote:false};

const noMemory={active:false,strong:false,countryMap:new Map(),recentTitles:new Set()};
const base={candidates,dayIndexes:[0,1,2,3,4,5,6],budget:45,budgetMode:'balanced',leftovers:false,memoryState:noMemory,feedbackState,historyMap:new Map(),signatureMap:new Map(),componentMap:new Map(),lastGenerationIds:new Set(),lastGenerationSignatures:new Set(),lastGenerationComponentKeys:new Set(),generationRound:0,userId:'qa-v48961'};
const optimized=T.optimizeWeekV489(base);
assert.equal(optimized.items.length,7,'semaine incomplète');
assert(optimized.cost<=45.001,'budget dépassé');
assert(optimized.cost>=45*.78,'plancher équilibré non atteint');
const cuisineCounts={};optimized.items.filter(x=>!x.leftover).forEach(x=>{const c=T.canonicalCuisineFamilyV48961(x.recipe._traits.cuisine_family);cuisineCounts[c]=(cuisineCounts[c]||0)+1});
assert(T.activeCuisineThreadsV4896(cuisineCounts).length<=3,'nouveau profil: plus de 3 univers culinaires');
assert(T.isCuisineThreadV4896('western_europe'),'western_europe ne doit plus être un socle privilégié');
assert(!optimized.items.some(x=>x.recipe.recipe_id===candidates[0].recipe_id),'repas refusé reproposé');

const familiarMemory={active:true,strong:true,countryMap:new Map([['cameroun',12],['senegal',3],['japon',1]]),recentTitles:new Set(['ancien repas']),tokenMap:new Map(),categoryMap:new Map(),familiarIds:new Set()};
const familiar=T.familiarCuisineFamiliesV48961(familiarMemory);
assert(familiar.has('central_africa'),'le Cameroun enregistré doit créer un socle central_africa');
assert(!familiar.has('western_europe'),'aucun socle occidental ne doit être injecté');
const familiarCandidates=candidates.map(x=>({...x,_memoryRank:.66,_memoryAffinity:1.1}));
const optimizedFamiliar=T.optimizeWeekV489({...base,candidates:familiarCandidates,memoryState:familiarMemory,generationRound:1});
assert.equal(optimizedFamiliar.items.length,7,'semaine profil familier incomplète');
const familiarCounts={};optimizedFamiliar.items.filter(x=>!x.leftover).forEach(x=>{const c=T.canonicalCuisineFamilyV48961(x.recipe._traits.cuisine_family);familiarCounts[c]=(familiarCounts[c]||0)+1});
assert(T.activeUnfamiliarCuisineThreadsV48961(familiarCounts,familiar).length<=2,'plus de 2 univers non familiers');

assert(T.containsNormalizedTerm('salade avec laitue','laitue'),'mot entier non reconnu');
assert(!T.containsNormalizedTerm('salade avec laitue','lait'),'« lait » ne doit pas exclure « laitue »');
assert(T.matchesAnyExcludedTerm('œufs brouillés et pain',['oeufs']),'œ/oe non normalisé');

const reasonNoMemory=T.plannerReasonV4896({_haveCount:0,_missingDocumentedCost:3,_curatedMeal:true,_recentExact:false,_traits:{cuisine_family:'western_europe'}},{memoryState:noMemory,budget:45,availableDays:7});
assert(!/repas récemment|habitudes enregistrées|univers culinaire présent/.test(reasonNoMemory),'raison mémoire inventée sans mémoire');
const reasonWithMemory=T.plannerReasonV4896({_haveCount:0,_missingDocumentedCost:3,_curatedMeal:true,_recentExact:false,_memoryRank:.8,_memoryAffinity:2,_traits:{cuisine_family:'central_africa'}},{memoryState:familiarMemory,budget:45,availableDays:7});
assert(/habitudes enregistrées|univers culinaire présent/.test(reasonWithMemory),'raison familière absente malgré preuve');

const packageText=T.plannerPurchaseFormatTextV48961({purchase:{packages:2,package_label:'sachet 500 g',package_weight_g:500,pricing_mode:'exact_package_fresh',estimated_purchase_eur:4.5}});
assert(packageText.includes('2 × sachet 500 g'),'format magasin non détaillé');
assert(packageText.includes('4,50'), 'coût panier magasin absent');

const plan=optimized.items.map(x=>({dayIndex:x.dayIndex,recipe:x.recipe,leftover:!!x.leftover}));
assert(T.plannerWeekHardValidV4896(plan,45,optimized.varietyRelaxationUsed,noMemory),'semaine optimisée rejetée');
const replacement=T.plannerChooseReplacementV4896(plan,0,candidates,{budget:45,varietyRelaxation:optimized.varietyRelaxationUsed,feedbackState,sessionSkipped:new Set(),userId:'qa-v48961',generationRound:1,memoryState:noMemory});
assert(replacement,'aucun remplacement ciblé trouvé');
assert.notEqual(replacement.recipe_id,plan[0].recipe.recipe_id,'remplacement identique');

const html=fs.readFileSync(path.join(root,'tee-next.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles','tee-next.css'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase','V48961_MEMOIRE_CHOIX_PLANIFICATEUR_DURCIE.sql'),'utf8');

for(const needle of ['Changer ce repas','Ne plus me le proposer','Pourquoi ce choix ?','Quantités consommées','Panier magasin','data-plan-undo-reject'])assert(raw.includes(needle),`interface absente: ${needle}`);
for(const needle of ['mt_planner_feedback_record_v2','mt_planner_feedback_list_v2','mt_planner_feedback_unreject_v2','is_rejected','replacement_count'])assert(sql.includes(needle),`SQL absent: ${needle}`);
assert(!sql.includes("interval '365 days'"),'un refus ne doit plus expirer à 365 jours');
assert(css.includes('.mt-next-feedback-notice'),'style annulation absent');
assert(css.includes('.mt-next-shopping-priced span small em'),'style format magasin absent');
assert(html.includes('v48961-planification-consolidee-durcie-r1'),'cache V489.6.1 absent');
assert.equal(raw,fs.readFileSync(path.join(root,'www','scripts','tee-next.js'),'utf8'),'miroir JS différent');
assert.equal(css,fs.readFileSync(path.join(root,'www','styles','tee-next.css'),'utf8'),'miroir CSS différent');
assert.equal(html,fs.readFileSync(path.join(root,'www','tee-next.html'),'utf8'),'miroir HTML différent');

console.log(JSON.stringify({
  status:'ok_v48961',
  cost:Number(optimized.cost.toFixed(2)),
  neutral_cuisine_threads:T.activeCuisineThreadsV4896(cuisineCounts),
  familiar_cuisine_base:[...familiar],
  unfamiliar_threads_with_profile:T.activeUnfamiliarCuisineThreadsV48961(familiarCounts,familiar),
  western_default_privilege:false,
  factual_reasons:true,
  persistent_rejection:true,
  undo_rejection:true,
  package_detail:true,
  single_meal_replacement:true,
  strict_exclusions:true,
  mirrors:'identical'
},null,2));
