#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const file=process.argv[2]||path.join(__dirname,'..','scripts','tee-next.js');
let code=fs.readFileSync(file,'utf8');
code=code.replace("document.addEventListener('DOMContentLoaded',init);","globalThis.__TEE_V48921_TEST={optimizeWeekV489,recommendationHistoryMaps,applyLocalGenerationHistory,isSpecificCulturalCandidate,isDynamicCiqualCandidate,isEligibleCiqualAssembly,stableUuidV4891};");
const ctx={console,URLSearchParams,location:{search:''},Date,Math,Set,Map,String,Number,Array,Object,JSON,Intl,RegExp};
vm.createContext(ctx);vm.runInContext(code,ctx);
const {optimizeWeekV489,recommendationHistoryMaps,applyLocalGenerationHistory,stableUuidV4891}=ctx.__TEE_V48921_TEST;

const proteins=['poultry','fish_seafood','plant','beef','egg','pork','mixed_unknown'];
const starches=['rice','pasta_noodle','potato','semolina_bulgur','bread','legume','other_none'];
const techniques=['grilled','soup','baked','stew','cold_raw','mixed','sauteed'];
function candidate(i){
  const dynamic=i%3===0;
  const cultural=i>=1&&i<=3;
  return {
    recipe_id:`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`,
    title:`Candidat ${i}`,_baseScore:cultural?9:(i%5)*0.12,_missingPriceCoverage:100,
    _missingDocumentedCost:2.6+(i%9)*0.47,_memoryRank:cultural?1:(i%11)/10,
    _memoryAffinity:cultural?5:(i%7)*0.21,_recentExact:false,
    _effectiveDiscoveryLevel:cultural?0:0,
    _dynamicCiqual:dynamic,_assemblyQuality:dynamic?0.88:null,
    _meta:{source_kind:dynamic?'assembled_ciqual':(cultural?'cultural':'recipe'),discovery_level:cultural?2:0},
    _traits:{protein_family:proteins[i%proteins.length],starch_family:starches[i%starches.length],cooking_technique:techniques[i%techniques.length],dish_format:['plate','bowl','soup','salad'][i%4],cuisine_family:cultural?'west_africa':['tee_general','europe','east_southeast_asia'][i%3],leftover_compatible:i%4!==0}
  };
}
const candidates=Array.from({length:36},(_,i)=>candidate(i+1));
const historyBundle=recommendationHistoryMaps({items:[],generations_this_week:0});
const base={candidates,dayIndexes:[0,1,2,3,4,5,6],budget:45,budgetMode:'balanced',leftovers:false,memoryState:{active:true,strong:true},userId:'profile-A'};

const first=optimizeWeekV489({...base,historyMap:historyBundle.map,generationRound:historyBundle.generationsThisWeek});
assert.equal(first.items.length,7,'la première semaine doit contenir 7 jours');
assert(first.cost<=45.001,'le budget ne doit pas être dépassé');
assert.equal(first.items.filter(x=>x.recipe._meta.discovery_level===2).length,1,'un seul plat culturel spécifique malgré trois candidats prioritaires');
assert(first.items.filter(x=>x.recipe._dynamicCiqual&&x.recipe._assemblyQuality>=0.72).length>=2,'au moins deux assemblages CIQUAL qualifiés quand ils sont faisables');

applyLocalGenerationHistory(historyBundle,first.items.map(x=>({dayIndex:x.dayIndex,recipe:x.recipe,leftover:x.leftover})));
assert.equal(historyBundle.generationsThisWeek,1,'la génération locale doit avancer immédiatement');
assert.equal(historyBundle.map.size,7,'les 7 recommandations doivent alimenter la rotation locale');

const second=optimizeWeekV489({...base,historyMap:historyBundle.map,generationRound:historyBundle.generationsThisWeek});
assert.equal(second.items.length,7,'la régénération doit rester complète');
assert(second.items.filter(x=>x.recipe._meta.discovery_level===2).length<=1,'la règle culturelle reste dure après régénération');
assert(second.items.filter(x=>x.recipe._dynamicCiqual&&x.recipe._assemblyQuality>=0.72).length>=2,'les assemblages CIQUAL qualifiés restent présents après régénération');
const a=new Set(first.items.map(x=>x.recipe.recipe_id));
const shared=second.items.filter(x=>a.has(x.recipe.recipe_id)).length;
assert(shared<=5,`la régénération doit tourner réellement (${shared}/7 communs)`);

const sql=fs.readFileSync(path.join(__dirname,'..','supabase','V48921_ROTATION_CULTURE_FORMATS_CIQUAL_RENFORCE.sql'),'utf8');
for(const needle of ['TOO_MANY_RECIPE_IDS','TOO_MANY_ITEMS','mt_planner_purchase_quote_v2','mt_planner_personal_context_v2','mt_planner_candidate_meta_v2'])assert(sql.includes(needle),`garde SQL absente: ${needle}`);
for(const needle of ['mt_planner_purchase_quote_v2','applyLocalGenerationHistory(historyBundle,plan)','go.disabled=true','specificCulturalUsed','dynamicUsed'])assert(code.includes(needle),`connexion frontend absente: ${needle}`);


// UUID dynamiques : les quatre seeds doivent réellement contribuer.
const ids=new Set();
for(let i=0;i<10000;i++)ids.add(stableUuidV4891(`TEE-ASSEMBLED|${i}|${i+1}|${i+2}`));
assert.equal(ids.size,10000,'les UUID CIQUAL dynamiques ne doivent pas collisionner sur le corpus QA');
assert.equal((code.match(/function stableHash32\(/g)||[]).length,1,'stableHash32 ne doit être déclaré qu’une seule fois');

// Prix/format : format 365 j, prix 120 j, jamais de prix paquet périmé.
for(const needle of [
  "mt_planner_ciqual_universe_v1()",
  "mt_planner_ciqual_price_batch_v1(text[],text,text)",
  "format_max_age_days',365",
  "price_max_age_days',120",
  "stale_package_price_used',false",
  "(current_date-p.observed_on)<=120"
])assert(sql.includes(needle),`garde V489.2.1 absente: ${needle}`);
assert(!sql.includes("(current_date-pf.observed_on)<=365"),'un prix paquet ne doit plus être validé 365 jours par simple observed_on');

console.log(JSON.stringify({status:'ok_v48921',first_cost:first.cost,second_cost:second.cost,shared_after_regeneration:shared,first_dynamic:first.dynamicUsed,second_dynamic:second.dynamicUsed,first_specific_cultural:first.specificCulturalUsed,second_specific_cultural:second.specificCulturalUsed},null,2));
