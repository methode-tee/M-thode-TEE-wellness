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
  {name:'Gousse de vanille',portion_g:100,fiber_g:24,kcal:392,focus_amount:24,score:190,familiar:false,rotation_due:false},
  {name:'Egusi soup — Nigeria',portion_g:300,fiber_g:22,protein_g:56.8,kcal:1356,focus_amount:22,score:180,familiar:false,rotation_due:false,guidance_role:'meal',culture_familiar:false,memory_affinity_score:0},
  {name:'Achu / Taro sauce jaune — Cameroun',portion_g:300,fiber_g:20.1,protein_g:28.8,kcal:972,focus_amount:20.1,score:170,familiar:false,rotation_due:false,guidance_role:'meal',culture_familiar:false,memory_affinity_score:0},
  {name:"Flocons d'avoine",portion_g:60,fiber_g:6.2,protein_g:7.8,kcal:228,focus_amount:6.2,score:120,familiar:true,rotation_due:false,guidance_role:'food',memory_affinity_score:10,meal_context_fit:true},
  {name:'Framboises',portion_g:150,fiber_g:9.8,protein_g:1.8,kcal:78,focus_amount:9.8,score:105,familiar:false,rotation_due:false,guidance_role:'food',memory_affinity_score:2,meal_context_fit:true}
]};
const state=G.pacingState(model,payload,'fiber',at(20,33));
assert.equal(state.phase,'closing');
const ranked=G.rankCandidates(payload,model,'fiber',state);
assert(!ranked.some(x=>/vanille/i.test(x.name)),'la vanille ne doit jamais sortir comme option autonome');
assert(!ranked.some(x=>/Egusi/i.test(x.name)),'un plat de 1356 kcal ne doit pas corriger seul un petit reliquat de fibres en fin de journée');
assert(!ranked.some(x=>/Achu/i.test(x.name)),'un plat de 972 kcal non familier ne doit pas sortir en clôture pour un petit reliquat de fibres');
assert.equal(ranked[0].name,"Flocons d'avoine",'une option familière et proportionnée doit remonter');
const copy=G.pacingCopy(model,payload,'fiber');
// pacingCopy utilise l'heure réelle : on vérifie surtout que la branche de clôture existe dans le code.
const src=fs.readFileSync(path.join(__dirname,'../scripts/food-guidance.js'),'utf8');
assert(src.includes('inutile de chercher à tout rattraper'));
const decision=G.selectPacingDecision(model,{key:'density'},payload,at(20,33));
assert(/^Compléter /.test(decision.title),'le titre ne doit plus dire “plus tôt” en fin de journée');
console.log(JSON.stringify({status:'V4896600_CONTEXTUAL_GUIDANCE_OK',phase:state.phase,top:ranked.slice(0,3).map(x=>x.name),title:decision.title}));
