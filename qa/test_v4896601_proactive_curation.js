const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
global.window={};
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../scripts/food-guidance.js'),'utf8'));
const G=window.MTFoodGuidance;
function at(h,m=0){return new Date(2026,8,16,h,m,0,0);}
const model={
  nutritionDays:14,
  nutritionContext:{today:{fiber_g:2.9,protein_g:62,kcal:1750},recent:{fiber_g:7.6,protein_g:45,kcal:1800}},
  fiber:{low:15,high:30},protein:{low:75,high:110},energy:{low:2000,high:2400}
};
const payload={rhythm:{documented_days:12,median_first_minute:8*60,median_last_minute:20*60,expected_daily_meals:3,today_logged_meals:2,today_meal_types:['breakfast','lunch']},candidates:[
  {name:"Flocons d'avoine",portion_g:60,fiber_g:6.2,protein_g:7.8,kcal:228,focus_amount:6.2,score:70,familiar:true,rotation_due:false,guidance_role:'food',memory_affinity_score:10,meal_context_fit:true},
  {name:'Smoothie à la fraise et à la banane — McDonald’s',portion_g:371,fiber_g:6.7,kcal:301,focus_amount:6.7,score:500,familiar:true,rotation_due:false,guidance_role:'beverage',memory_affinity_score:15},
  {name:'Pain complet',portion_g:80,fiber_g:5.5,kcal:210,focus_amount:5.5,score:110,familiar:false,rotation_due:false,guidance_role:'food',memory_affinity_score:6,meal_context_fit:true},
  {name:'Choucroute garnie',portion_g:400,fiber_g:10.8,protein_g:20.2,kcal:436,focus_amount:10.8,score:260,familiar:false,rotation_due:false,guidance_role:'meal',memory_affinity_score:0,culture_familiar:false}
]};
const state=G.pacingState(model,payload,'fiber',at(21,15));
const ranked=G.rankCandidates(payload,model,'fiber',state);
assert.equal(state.phase,'closing');
assert(!ranked.some(x=>/mcdonald/i.test(x.name.normalize('NFD').replace(/[\u0300-\u036f]/g,''))),'McDonald’s ne doit jamais sortir en guidage proactif');
assert.equal(ranked[0].name,"Flocons d'avoine",'une option personnelle doit passer avant une découverte de catalogue même avec un score brut plus faible');
const home=fs.readFileSync(path.join(__dirname,'../scripts/home-smart-cards.js'),'utf8');
assert(home.includes("caption.textContent='Conseil du jour ✦'"),'la card Mon équilibre doit porter le signal discret');
assert(!home.includes("rail.insertAdjacentElement('afterend',card)"),'aucune cinquième grande card ne doit être ajoutée sous les univers');
assert(home.includes("sheetTitle:'On complète sans rattraper.'"),'la bottom sheet doit suivre la phase de clôture');
console.log(JSON.stringify({status:'V4896601_PROACTIVE_CURATION_OK',phase:state.phase,top:ranked.slice(0,3).map(x=>x.name)}));
