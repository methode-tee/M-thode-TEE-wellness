#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const raw=fs.readFileSync(path.join(root,'scripts','tee-next.js'),'utf8');
const code=raw.replace(
  "document.addEventListener('DOMContentLoaded',init);",
  "globalThis.__T={plannerStrictPurchaseSummaryV48964,plannerHybridBudgetReferenceV489651,plannerReasonV4896};"
);
const ctx={console,URLSearchParams,location:{search:''},Date,Math,Set,Map,String,Number,Array,Object,JSON,Intl,RegExp,window:{},document:{addEventListener(){}}};
vm.createContext(ctx);vm.runInContext(code,ctx);
const T=ctx.__T;

// Cas critique : 2 paquets stricts connus + 1 ligne sans format magasin.
// Le panier affiché doit rester 36 €, mais le budget interne doit compter les 6 € consommés restants.
const quote={
  strict_package_total_eur:36,
  total_items:5,
  items:[
    {ingredient_name:'Poulet',pricing_mode:'exact_package_fresh',estimated_purchase_eur:12},
    {ingredient_name:'Riz',pricing_mode:'format_plus_fresh',estimated_purchase_eur:8},
    {ingredient_name:'Courgettes',pricing_mode:'exact_package_refreshed',estimated_purchase_eur:7},
    {ingredient_name:'Tomates',pricing_mode:'exact_package',estimated_purchase_eur:9},
    {ingredient_name:'Brocoli',pricing_mode:'consumed_quantity_fallback',estimated_purchase_eur:6}
  ]
};
const rows=[
  {name:'Poulet',cost_eur:7,priced:true},
  {name:'Riz',cost_eur:4,priced:true},
  {name:'Courgettes',cost_eur:3,priced:true},
  {name:'Tomates',cost_eur:4,priced:true},
  {name:'Brocoli',cost_eur:6,priced:true}
];
const strict=T.plannerStrictPurchaseSummaryV48964(quote);
const hybrid=T.plannerHybridBudgetReferenceV489651(rows,quote,strict);
assert.equal(strict.strictPackageTotal,36,'le panier magasin strict doit rester limité aux paquets documentés');
assert.equal(strict.strictPackageCoverage,80,'le cas de régression doit bien être à 80 % de couverture paquet');
assert.equal(hybrid.strictPackageBudgetPart,36,'la part paquet du budget interne est incorrecte');
assert.equal(hybrid.fallbackConsumedTotal,6,'seule la ligne sans paquet strict doit retomber sur le consommé');
assert.equal(hybrid.budgetReferenceCost,42,'la référence budget doit être paquet strict + consommé non couvert');
assert.equal(hybrid.budgetReferenceMode,'package_plus_consumed_fallback');

// Sans aucun paquet strict, la référence reste le coût consommé documenté.
const quote2={total_items:2,items:[
  {ingredient_name:'Lentilles',pricing_mode:'consumed_quantity_fallback',estimated_purchase_eur:2.5},
  {ingredient_name:'Carottes',pricing_mode:'unknown',estimated_purchase_eur:null}
]};
const rows2=[
  {name:'Lentilles',cost_eur:2.5,priced:true},
  {name:'Carottes',cost_eur:1.2,priced:true}
];
const hybrid2=T.plannerHybridBudgetReferenceV489651(rows2,quote2,T.plannerStrictPurchaseSummaryV48964(quote2));
assert.equal(hybrid2.budgetReferenceCost,3.7);
assert.equal(hybrid2.budgetReferenceMode,'consumed_only');

const meal=(id,protein,starch,cuisine='tee_general')=>({recipe_id:id,title:id,_haveCount:0,_missingDocumentedCost:4,_curatedMeal:true,_recentExact:false,_traits:{protein_family:protein,starch_family:starch,cuisine_family:cuisine,leftover_compatible:true}});
const plan=[{recipe:meal('lundi','poultry','rice')},{recipe:meal('mardi','poultry','rice')},{recipe:meal('mercredi','fish','quinoa')},{recipe:null,leftover:true}];
plan[3].recipe=plan[2].recipe;
const memory={active:true,recentTitles:new Set(['ancien repas']),countryMap:new Map(),tokenMap:new Map(),categoryMap:new Map(),familiarIds:new Set()};
const reason=T.plannerReasonV4896(plan[2].recipe,{memoryState:memory,budget:45,availableDays:7,plan,index:2});
assert(reason.includes('permet de préparer deux portions et simplifie le lendemain'));
assert(reason.includes('apporte une protéine différente du début de semaine'));
assert(!reason.includes('évite de répéter un repas récemment enregistré'));

assert(raw.includes('package_plus_consumed_fallback'),'mode hybride absent');
assert(raw.includes('Le montant « Panier magasin » reste limité aux formats connus.'),'explication utilisateur du panier strict absente');
assert(!raw.includes('summary.budgetReferenceCost=summary.usePurchaseReference?summary.strictPackageTotal:summary.totalDocumented'),'ancien switch strict/fallback encore présent');
assert.equal(raw,fs.readFileSync(path.join(root,'www','scripts','tee-next.js'),'utf8'),'miroir JS différent');
assert.equal(fs.readFileSync(path.join(root,'styles','tee-next.css'),'utf8'),fs.readFileSync(path.join(root,'www','styles','tee-next.css'),'utf8'),'miroir CSS différent');
assert.equal(fs.readFileSync(path.join(root,'tee-next.html'),'utf8'),fs.readFileSync(path.join(root,'www','tee-next.html'),'utf8'),'miroir HTML différent');
console.log(JSON.stringify({status:'ok_v489651',strict_store_display_eur:strict.strictPackageTotal,internal_budget_reference_eur:hybrid.budgetReferenceCost,fallback_consumed_non_package_eur:hybrid.fallbackConsumedTotal,reason,mirrors:'identical'},null,2));
