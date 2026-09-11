const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'scripts/home-smart-cards.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function ok(cond,msg){if(!cond){console.error('FAIL:',msg);process.exitCode=1;}else console.log('OK:',msg);}
ok(js.includes('__MT_HOME_SMART_CARDS_V4896561__'),'guard V4896561 présent');
ok(js.includes("eq('protocol_id',active.id)"),'progression active relue explicitement par identifiant');
ok(js.includes("value===null||value===undefined||value===''?null"),'null de compteur reste indisponible');
ok(!js.includes('const n=Number(total)||0'),'Number(null) ne force plus le compteur à 0');
ok(js.includes("homeTransitionScreen('favorite'"),'transition dédiée favoris');
ok(js.includes("homeTransitionScreen('routine'"),'transition dédiée routines');
ok(js.includes('mt-home-premium-loader-track'),'barre de chargement premium présente');
ok(js.includes('mt-home-handoff-loading'),'écrans intermédiaires masqués pendant le handoff');
ok(js.includes("await window.openRecipeViewer(item.recipe_id)"),'recette favorite ouverte directement quand possible');
ok(js.includes("await window.mtOpenRoutineDay(id)"),'routine ouverte directement après préparation');
ok(html.includes('v4896561-transitions-progress-r1'),'cache-buster V4896561 présent');
if(process.exitCode)process.exit(process.exitCode);
