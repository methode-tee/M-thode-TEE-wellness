#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const rawCode=fs.readFileSync(path.join(root,'scripts','tee-next.js'),'utf8');
let code=rawCode;
code=code.replace("document.addEventListener('DOMContentLoaded',init);","globalThis.__TEE_V48951_TEST={optimizeWeekV489,candidateTrueVarietyKeys,canonicalProteinFamilyV48951,canonicalStarchFamilyV48951};");
const ctx={console,URLSearchParams,location:{search:''},Date,Math,Set,Map,String,Number,Array,Object,JSON,Intl,RegExp,requestAnimationFrame:fn=>fn()};
vm.createContext(ctx);vm.runInContext(code,ctx);
const {optimizeWeekV489,candidateTrueVarietyKeys,canonicalProteinFamilyV48951,canonicalStarchFamilyV48951}=ctx.__TEE_V48951_TEST;

const proteins=['poultry','fish_seafood','plant','egg','beef','pork'];
const starches=['rice','potato','quinoa','bread','pasta_noodle','semolina_bulgur'];
const vegetables=['brocoli','tomates','carottes','courgettes','épinards','haricots verts'];
function meal(i){
  const chicken=i<10;
  const protein=chicken?'poultry':proteins[i%proteins.length];
  const starch=starches[i%starches.length];
  const vegetable=vegetables[i%vegetables.length];
  const cost=4.25+(i%6)*0.55;
  return {
    recipe_id:`95000000-0000-4000-8000-${String(i).padStart(12,'0')}`,
    title:chicken?`Poulet variante ${i}, ${starch} et ${vegetable}`:`Repas ${protein} ${i}, ${starch} et ${vegetable}`,
    ingredients:[protein,starch,vegetable],_baseScore:chicken?9:2+(i%4),
    _missingPriceCoverage:100,_missingDocumentedCost:cost,_memoryRank:0,_memoryAffinity:0,_recentExact:false,
    _effectiveDiscoveryLevel:0,_meta:{source_kind:'curated_meal_v48941',discovery_level:0},
    _traits:{protein_family:protein,starch_family:starch,cooking_technique:['grilled','baked','stew','sauteed'][i%4],dish_format:['plate','bowl'][i%2],cuisine_family:'tee_general',leftover_compatible:true},
    _componentKeys:[`protein:${protein}`,`starch:${starch}`,`vegetable:${vegetable}`],
    _semanticSignature:`meal:${i}`
  };
}
const candidates=Array.from({length:42},(_,i)=>meal(i+1));
const base={candidates,dayIndexes:[0,1,2,3,4,5,6],budget:45,budgetMode:'balanced',leftovers:false,memoryState:{active:false,strong:false},historyMap:new Map(),signatureMap:new Map(),componentMap:new Map(),lastGenerationIds:new Set(),lastGenerationSignatures:new Set(),lastGenerationComponentKeys:new Set(),generationRound:0,userId:'qa-v4895'};
const plan=optimizeWeekV489(base);
assert.equal(plan.items.length,7,'la semaine équilibrée doit être complète');
assert(plan.cost>=45*.78-1e-9,`le plancher de 78 % doit être atteint quand il est faisable (${plan.cost})`);
assert(plan.cost<=45.001,'le budget ne doit jamais être dépassé');
assert.equal(plan.budgetFloorEnforced,true,'le moteur doit signaler le plancher réellement appliqué');
const chicken=plan.items.filter(x=>x.recipe._traits.protein_family==='poultry').length;
assert(chicken<=2,`les variantes de poulet ne doivent pas créer une fausse variété (${chicken})`);
const counts={};
plan.items.forEach(x=>candidateTrueVarietyKeys(x.recipe).forEach(k=>{counts[k]=(counts[k]||0)+1}));
for(const [key,value] of Object.entries(counts))assert(value<=3,`${key} est trop répété (${value})`);
const candidates30=candidates.map((x,i)=>({...x,_missingDocumentedCost:3.0+(i%6)*0.30}));
const plan30=optimizeWeekV489({...base,candidates:candidates30,budget:30,userId:'qa-v4895-30'});
assert.equal(plan30.items.length,7,'la semaine équilibrée à 30 € doit être complète');
assert(plan30.cost>=30*.78-1e-9,`le plancher de 78 % doit aussi fonctionner à 30 € (${plan30.cost})`);
assert(plan30.cost<=30.001,'le budget de 30 € ne doit pas être dépassé');

const html=fs.readFileSync(path.join(root,'tee-next.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles','tee-next.css'),'utf8');
assert(code.includes('orientPlannerResult(result);'),'orientation automatique absente');
assert(code.includes('mt-next-planner-loading'),'chargement premium absent');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'accessibilité animation absente');
assert(html.includes('v48951-budget-floor-variete-canonique-r1'),'cache bust V489.5.1 absent');
assert.equal(canonicalStarchFamilyV48951('pasta'),'pasta_noodle','pasta doit rejoindre pasta_noodle');
assert.equal(canonicalStarchFamilyV48951('semolina'),'semolina_bulgur','semolina doit rejoindre semolina_bulgur');
assert.equal(canonicalProteinFamilyV48951('chicken'),'poultry','chicken doit rejoindre poultry');
assert(rawCode.includes('budgetFloorPass:true'),'le second passage budget dédié est absent');
assert(rawCode.includes('budgetFloorSecondPassUsed'),'le diagnostic du second passage budget est absent');
assert.equal(rawCode,fs.readFileSync(path.join(root,'www','scripts','tee-next.js'),'utf8'),'miroir JS différent');
assert.equal(css,fs.readFileSync(path.join(root,'www','styles','tee-next.css'),'utf8'),'miroir CSS différent');
assert.equal(html,fs.readFileSync(path.join(root,'www','tee-next.html'),'utf8'),'miroir HTML différent');

console.log(JSON.stringify({status:'ok_v48951',cost_45:Number(plan.cost.toFixed(2)),floor_45:35.10,cost_30:Number(plan30.cost.toFixed(2)),floor_30:23.40,chicken_meals:chicken,variety_relaxation:plan.varietyRelaxationUsed,true_variety_counts:counts},null,2));
