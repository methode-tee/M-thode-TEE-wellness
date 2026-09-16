const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
global.window={};
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../scripts/food-guidance.js'),'utf8'));
const G=window.MTFoodGuidance;
function at(h,m=0){return new Date(2026,8,16,h,m,0,0);}
const model={nutritionContext:{today:{fiber_g:2.9,protein_g:44.5,kcal:1500},recent:{fiber_g:7.6,protein_g:45,kcal:1800}},fiber:{low:15,high:30},protein:{low:75,high:110},energy:{low:2000,high:2400}};
const payload={memory:{strong:true},rhythm:{documented_days:12,median_first_minute:8*60,median_last_minute:20*60,expected_daily_meals:3,today_logged_meals:2,today_meal_types:['breakfast','lunch']},candidates:[
 {name:'Lentille, sèche (aliment moyen)',portion_g:70,fiber_g:11.4,protein_g:17.6,kcal:229,focus_amount:11.4,score:600,use_count_60d:0,familiarity_level:null,preparation_state:'requires_cooking',guidance_role:'food'},
 {name:'Épinard, bouilli/cuit à l’eau',portion_g:125,fiber_g:4.4,kcal:35,focus_amount:4.4,score:250,use_count_60d:3,familiarity_level:'habit',preparation_state:'ready',guidance_role:'food'},
 {name:'Foutou igname — Côte d’Ivoire',portion_g:180,fiber_g:7.7,kcal:175,focus_amount:7.7,score:350,use_count_60d:0,familiarity_level:'similar',preparation_state:'meal_ready',guidance_role:'food'}
]};
let state=G.pacingState(model,payload,'fiber',at(22,49));
let closingRanked=G.rankCandidates(payload,model,'fiber',state);
assert.equal(state.phase,'closing');
assert(!closingRanked.some(x=>/lentille/i.test(x.name)),'un aliment sec à cuire ne doit pas être proposé en clôture');
assert.equal(G.familiarityLevel(payload.candidates[1]),'habit');
assert.equal(G.preparationState(payload.candidates[0]),'requires_cooking');

const familiarPrep={name:'Pois chiches secs',portion_g:70,fiber_g:10,kcal:240,focus_amount:10,score:290,use_count_60d:2,familiarity_level:'habit',preparation_state:'requires_cooking',guidance_role:'food'};
const morningPayload={...payload,rhythm:{documented_days:12,median_first_minute:8*60,median_last_minute:20*60,expected_daily_meals:3,today_logged_meals:0,today_meal_types:[]},candidates:[...payload.candidates,familiarPrep]};
state=G.pacingState(model,morningPayload,'fiber',at(8,15));
const morningRanked=G.rankCandidates(morningPayload,model,'fiber',state);
assert.equal(state.phase,'early');
assert(morningRanked.slice(0,3).some(x=>x.name==='Pois chiches secs'),'le matin une préparation familière peut être proposée pour plus tard');
assert(!morningRanked.slice(0,3).some(x=>x.name.startsWith('Lentille')),'une préparation inconnue ne doit pas être poussée dans le top 3 matinal');
console.log(JSON.stringify({status:'V4896603_PRACTICAL_GUIDANCE_OK',closingTop:closingRanked.map(x=>x.name),morningTop:morningRanked.slice(0,3).map(x=>x.name)}));
