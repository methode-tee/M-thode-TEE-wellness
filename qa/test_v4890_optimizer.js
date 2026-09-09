const fs=require('fs'),vm=require('vm'),assert=require('assert');
const file=process.argv[2]||require('path').join(__dirname,'..','scripts','tee-next.js');
let code=fs.readFileSync(file,'utf8');
code=code.replace("document.addEventListener('DOMContentLoaded',init);","globalThis.__TEE_V489_TEST={optimizeWeekV489,budgetModePolicy,recommendationHistoryMaps,recommendationPenalty};");
const ctx={console,URLSearchParams,location:{search:''},Date,Math,Set,Map,String,Number,Array,Object,JSON,Intl,RegExp};
vm.createContext(ctx);vm.runInContext(code,ctx);
const {optimizeWeekV489}=ctx.__TEE_V489_TEST;
const proteins=['poultry','fish_seafood','plant','beef','egg','mixed_unknown'];
const starches=['rice','pasta_noodle','potato','semolina_bulgur','bread','other_none'];
const techs=['grilled','soup','baked','stew','cold_raw','mixed'];
const cuisines=['tee_general','east_southeast_asia','europe','maghreb','west_africa'];
function c(i,cost,coverage=100){return {
  recipe_id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,
  title:`Plat ${i}`,_baseScore:0,_missingPriceCoverage:coverage,_missingDocumentedCost:cost,
  _memoryRank:(i%10)/9,_memoryAffinity:(i%7)*0.38,_recentExact:false,_effectiveDiscoveryLevel:i===18?2:(i===16?1:0),
  _traits:{protein_family:proteins[i%proteins.length],starch_family:starches[i%starches.length],cooking_technique:techs[i%techs.length],dish_format:['plate','bowl','soup','salad'][i%4],cuisine_family:cuisines[i%cuisines.length],leftover_compatible:i%3!==0}
}}
const candidates=[];
[1.8,2.1,2.4,2.7,3.0,3.3,3.6,3.9,4.2,4.5,4.8,5.1,5.4,5.7,6.0,6.3,6.7,7.1,7.6,8.2].forEach((x,i)=>candidates.push(c(i+1,x,100)));
candidates.push(c(99,1.1,75));
const days=[0,1,2,3,4,5,6];
const memory={active:true,strong:true};
const base={candidates,dayIndexes:days,budgetMode:'balanced',leftovers:false,memoryState:memory,historyMap:new Map(),generationRound:0,userId:'test-user'};
const p30=optimizeWeekV489({...base,budget:30});
const p45=optimizeWeekV489({...base,budget:45});
assert.equal(p30.items.length,7);assert.equal(p45.items.length,7);
assert(p30.items.every(x=>x.recipe._missingPriceCoverage===100),'30€ selected partial cost candidate');
assert(p45.items.every(x=>x.recipe._missingPriceCoverage===100),'45€ selected partial cost candidate');
assert(p30.cost<=30.001&&p45.cost<=45.001,'budget exceeded');
const s30=new Set(p30.items.map(x=>x.recipe.recipe_id));const s45=new Set(p45.items.map(x=>x.recipe.recipe_id));
const shared=[...s30].filter(x=>s45.has(x)).length;
assert(shared<=5,`30/45 too similar: ${shared}/7 shared`);
assert(p45.cost>p30.cost+3,`45€ envelope not exploited enough: ${p30.cost} vs ${p45.cost}`);
const historyMap=new Map(p45.items.slice(0,5).map(x=>[x.recipe.recipe_id,{times_7d:2,times_28d:2,last_seen:new Date().toISOString()}]));
const p45b=optimizeWeekV489({...base,budget:45,historyMap,generationRound:1});
const s45b=new Set(p45b.items.map(x=>x.recipe.recipe_id));
const sharedRegen=[...s45].filter(x=>s45b.has(x)).length;
assert(sharedRegen<=5,`rotation too weak: ${sharedRegen}/7 shared after regeneration`);
for(const plan of [p30,p45,p45b]){
  const beef=plan.items.filter(x=>x.recipe._traits.protein_family==='beef').length;
  const specific=plan.items.filter(x=>x.recipe._effectiveDiscoveryLevel===2).length;
  assert(beef<=2,'more than two beef dishes');assert(specific<=1,'more than one specific discovery');
}
console.log(JSON.stringify({status:'ok',p30_cost:p30.cost,p45_cost:p45.cost,shared_30_45:shared,shared_regeneration:sharedRegen,p30:p30.items.map(x=>x.recipe.title),p45:p45.items.map(x=>x.recipe.title),p45_regenerated:p45b.items.map(x=>x.recipe.title)},null,2));
