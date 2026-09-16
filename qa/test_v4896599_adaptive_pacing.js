const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.window={};
vm.runInThisContext(fs.readFileSync(require('path').join(__dirname,'../scripts/food-guidance.js'),'utf8'));
const G=window.MTFoodGuidance;
function at(h,m=0){const d=new Date(2026,8,16,h,m,0,0);return d;}
const earlyRhythm={documented_days:12,median_first_minute:8*60,median_last_minute:20*60,expected_daily_meals:4,today_logged_meals:2,today_meal_types:['breakfast','lunch']};
const lateRhythm={documented_days:12,median_first_minute:11*60+30,median_last_minute:22*60,expected_daily_meals:3,today_logged_meals:1,today_meal_types:['lunch']};
let a=G.learnedRhythm(earlyRhythm,at(17));
let b=G.learnedRhythm(lateRhythm,at(17));
assert.equal(a.learned,true);assert.equal(b.learned,true);
assert.equal(a.phase,'late');
assert.equal(b.phase,'middle');
assert(a.lateMinute < b.lateMinute,'le seuil tardif doit suivre le rythme personnel');
assert.equal(G.currentMealContext(earlyRhythm),'snack');
assert.equal(G.currentMealContext(lateRhythm),'snack');
assert.equal(G.currentMealContext({today_meal_types:[]}),null,'avant le premier repas, Tee ne doit pas deviner un type de repas');
const noHistory=G.learnedRhythm({documented_days:1},at(12));assert.equal(noHistory.learned,false);
console.log(JSON.stringify({status:'V4896599_ADAPTIVE_PACING_OK',early_late_minute:a.lateMinute,late_late_minute:b.lateMinute,no_history_is_conservative:!noHistory.learned,next_context:G.currentMealContext(earlyRhythm)}));
