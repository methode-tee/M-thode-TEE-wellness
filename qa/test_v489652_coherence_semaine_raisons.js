#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const raw=fs.readFileSync(path.join(root,'scripts','tee-next.js'),'utf8');
const code=raw.replace(
  "document.addEventListener('DOMContentLoaded',init);",
  "globalThis.__T={plannerWeekHardValidV4896,plannerReasonV4896,familiarCuisineFamiliesV48961,activeCuisineThreadsV4896};"
);
const ctx={console,URLSearchParams,location:{search:''},Date,Math,Set,Map,String,Number,Array,Object,JSON,Intl,RegExp,window:{},document:{addEventListener(){}}};
vm.createContext(ctx);vm.runInContext(code,ctx);
const T=ctx.__T;

function meal(id,cuisine,{protein='poultry',starch='rice',curated=true,cost=4}={}){
  return {recipe_id:id,title:id,_missingDocumentedCost:cost,_curatedMeal:curated,_haveCount:0,_recentExact:false,_traits:{protein_family:protein,starch_family:starch,cuisine_family:cuisine,cooking_technique:'grill',dish_format:'plate',leftover_compatible:true}};
}
function day(recipe){return {recipe,leftover:false,restaurant:false};}
function memory(countries){
  return {active:true,strong:true,countryMap:new Map(countries),recentTitles:new Set(),tokenMap:new Map(),categoryMap:new Map(),familiarIds:new Set()};
}
const neutralMemory={active:false,countryMap:new Map(),recentTitles:new Set(),tokenMap:new Map(),categoryMap:new Map(),familiarIds:new Set()};
const familiar3=memory([['France',10],['Japon',8],['Cameroun',7]]);

// Sans mémoire culinaire fiable : 2 fils maximum.
assert.equal(T.plannerWeekHardValidV4896([
  day(meal('a','western_europe',{protein:'beef',starch:'rice'})),
  day(meal('b','east_asia',{protein:'fish',starch:'quinoa'})),
  day(meal('c','central_africa',{protein:'poultry',starch:'potato'}))
],45,0,neutralMemory),false,'3 fils sans mémoire doivent être refusés');
assert.equal(T.plannerWeekHardValidV4896([
  day(meal('a1','western_europe',{protein:'beef',starch:'rice'})),
  day(meal('b1','east_asia',{protein:'fish',starch:'quinoa'})),
  day(meal('n1','tee_general',{protein:'egg',starch:'potato'}))
],45,0,neutralMemory),true,'2 fils + neutre doivent rester possibles');

// Avec mémoire : 3 fils maximum, sans privilège occidental.
assert.equal(T.plannerWeekHardValidV4896([
  day(meal('f1','western_europe',{protein:'beef',starch:'rice'})),
  day(meal('j1','east_asia',{protein:'fish',starch:'quinoa'})),
  day(meal('c1','central_africa',{protein:'poultry',starch:'potato'}))
],45,0,familiar3),true,'3 fils familiers doivent être possibles');
assert.equal(T.plannerWeekHardValidV4896([
  day(meal('f2','western_europe',{protein:'beef',starch:'rice'})),
  day(meal('j2','east_asia',{protein:'fish',starch:'quinoa'})),
  day(meal('c2','central_africa',{protein:'poultry',starch:'potato'})),
  day(meal('m2','maghreb',{protein:'plant',starch:'semolina'}))
],45,0,memory([['France',10],['Japon',9],['Cameroun',8],['Maroc',7]])),false,'4 fils même familiers doivent être refusés');

// Un seul fil extérieur au socle familier, et une seule occurrence de ce fil.
const franceOnly=memory([['France',10]]);
assert.equal(T.plannerWeekHardValidV4896([
  day(meal('f3','western_europe',{protein:'beef',starch:'rice'})),
  day(meal('j3','east_asia',{protein:'fish',starch:'quinoa'})),
  day(meal('c3','central_africa',{protein:'poultry',starch:'potato'}))
],45,0,franceOnly),false,'2 fils extérieurs doivent être refusés');
assert.equal(T.plannerWeekHardValidV4896([
  day(meal('f4','western_europe',{protein:'beef',starch:'rice'})),
  day(meal('j4','east_asia',{protein:'fish',starch:'quinoa'})),
  day(meal('j5','east_asia',{protein:'egg',starch:'potato'}))
],45,0,franceOnly),false,'un fil extérieur ne doit pas être répété');

// Pourquoi ce choix : pas de budget générique, priorité aux faits distinctifs.
const plan=[
  day(meal('it1','southern_europe',{protein:'poultry',starch:'polenta'})),
  day(meal('it2','southern_europe',{protein:'fish',starch:'rice'}))
];
const italyMemory=memory([['Italie',10]]);
const reason=T.plannerReasonV4896(plan[1].recipe,{memoryState:italyMemory,budget:45,availableDays:7,plan,index:1});
assert(reason.includes('apporte une protéine différente du début de semaine'),'raison protéique attendue');
assert(reason.includes('prolonge un fil culinaire déjà présent dans tes habitudes et dans la semaine'),'raison de cohérence culinaire attendue');
assert(!reason.includes('budget'),'le budget ne doit plus servir de motif générique');
assert(!reason.includes('évite de répéter'),'ancienne raison générique interdite');

const noReasonMeal=meal('plain','tee_general',{protein:'unknown',starch:'unknown',curated:false});
const noReason=T.plannerReasonV4896(noReasonMeal,{memoryState:neutralMemory,budget:45,availableDays:7,plan:[day(noReasonMeal)],index:0});
assert.equal(noReason,'','sans fait distinctif, le bloc Pourquoi doit être masquable');

assert(raw.includes("const maxTotalThreads=familiarCuisines.size?3:2"),'garde 2/3 fils absente du beam');
assert(raw.includes("un seul fil extérieur au socle familier"),'commentaire garde fil extérieur absent');
assert(raw.includes('plannerWhyHtmlV489652'),'rendu conditionnel Pourquoi absent');
assert(!raw.includes("push('reste compatible avec ton repère budget par repas')"),'raison budget générique encore présente');
assert.equal(raw,fs.readFileSync(path.join(root,'www','scripts','tee-next.js'),'utf8'),'miroir JS différent');
assert.equal(fs.readFileSync(path.join(root,'tee-next.html'),'utf8'),fs.readFileSync(path.join(root,'www','tee-next.html'),'utf8'),'miroir HTML différent');
console.log(JSON.stringify({
  status:'ok_v489652',
  no_memory_max_threads:2,
  familiar_memory_max_threads:3,
  max_unfamiliar_threads:1,
  unfamiliar_thread_max_occurrences:1,
  reason,
  budget_reason_removed:true,
  empty_reason_hidden:true,
  mirrors:'identical'
},null,2));
