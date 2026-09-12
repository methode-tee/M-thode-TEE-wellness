const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../scripts/adapter-completion.js');let count=0;
function test(n,f){f();count++;console.log('OK '+n);}

// Reproduction fidèle de la sémantique V4896592 : fill_roles = rôles REMPLIS par l'aliment,
// et non liste des rôles que l'Adapter a le droit d'ajouter.
const pasta={
  name:'Macaroni, cuit',roles:['starch'],fill_roles:['starch'],
  families:['slot:starch','base:pasta','dish_family:starch_side','taste:savory','service:hot_or_any'],
  pairing_mode:'starch_side',
  pairing_strong_families:['protein:poultry','protein:fish','veg:warm_mild','veg:green'],
  pairing_possible_families:['protein:egg','protein:plant','veg:mediterranean'],
  pairing_avoid_families:['taste:sweet'],pairing_requires_accompaniment:true,pairing_complete:false
};
const protein={name:'Poulet',roles:['protein'],fill_roles:['protein'],families:['slot:protein','protein:poultry','taste:savory'],compatibility_score:82};
const veg={name:'Courgette',roles:['vegetable'],fill_roles:['vegetable'],families:['slot:vegetable','veg:warm_mild','taste:savory'],compatibility_score:78};
const rice={name:'Riz complet',roles:['starch'],fill_roles:['starch'],families:['slot:starch','base:rice'],compatibility_score:80};
const cucumber={name:'Concombre',roles:['vegetable'],fill_roles:['vegetable'],families:['slot:vegetable','veg:raw_fresh'],compatibility_score:76};
const fish={name:'Saumon fumé, tranché',roles:['protein'],fill_roles:['protein'],families:['slot:protein','protein:fish','service:cold'],compatibility_score:90};

// Moteur pur.
test('V4896592 macaroni is a single structural base',()=>assert(C.simpleBase([pasta],['starch'])));
test('fill_roles starch means starch is covered',()=>assert.deepEqual([...C.coveredRoles([pasta],[])].sort(),['starch']));
test('macaroni still has protein and vegetable missing',()=>{const r=C.plan({rows:[pasta],roles:['starch'],candidates:{protein,vegetable:veg}});assert.deepEqual(r.names,['Poulet','Courgette']);});
test('macaroni completion no longer requires candidates to share base:pasta',()=>{assert(!C.groups(protein).includes('base:pasta'));const r=C.plan({rows:[pasta],roles:['starch'],candidates:{protein,vegetable:veg}});assert.equal(r.title,'Une proposition pour ton repas');});
test('strong family creates explicit compatibility',()=>assert.equal(C.pairStrength(pasta,protein),4));
test('possible family creates explicit compatibility',()=>assert(C.pairStrength({...pasta,pairing_strong_families:[],pairing_possible_families:['protein:poultry']},protein)>=3));
test('avoid family blocks candidate even with high server score',()=>assert.equal(C.pairStrength({...pasta,pairing_avoid_families:['protein:poultry']},{...protein,compatibility_score:99}),-1));
test('server v4 compatibility remains a conservative fallback',()=>assert(C.pairStrength(fish,rice)>0));
test('server candidate below bridge threshold is not accepted by completion',()=>assert.equal(C.pairStrength(fish,{...rice,compatibility_score:30}),0));
test('explicit empty fill roles is not an allow-list for missing roles',()=>{const base={...pasta,fill_roles:[]};const r=C.plan({rows:[base],roles:['starch'],candidates:{protein,vegetable:veg}});assert.deepEqual(r.names,['Poulet','Courgette']);});
test('requires_accompaniment produces explicit incomplete message when no candidate',()=>{const r=C.plan({rows:[pasta],roles:['starch'],candidates:{}});assert.equal(r.title,'Une base à compléter');assert.match(r.body,/attend un accompagnement/);});
test('salmon can become a meal using trusted bridge candidates',()=>{const r=C.plan({rows:[fish],roles:['protein'],candidates:{starch:rice,vegetable:cucumber}});assert.deepEqual(r.names,['Riz complet','Concombre']);});
test('missing one salmon complement is not called complete',()=>{const r=C.plan({rows:[fish],roles:['protein'],candidates:{starch:rice}});assert.equal(r.title,'Un premier accompagnement');assert.match(r.body,/ne présente pas cette proposition comme un repas complet/);});
test('digestive intention never invents tolerance',()=>{const r=C.plan({rows:[pasta],roles:['starch'],candidates:{protein,vegetable:veg},goal:'digestion'});assert(!r.names);assert.match(r.body,/tolères bien/);});
test('prepared pasta is composite',()=>assert(C.composed([{name:'Raviolis',roles:['composite'],fill_roles:[],pairing_mode:'prepared_composite'}])));
test('prepared pasta is not a simple base',()=>assert(!C.simpleBase([{name:'Raviolis',roles:['composite'],fill_roles:[],pairing_mode:'prepared_composite'}],['composite'])));
test('pairing_complete is not re-opened as a simple base',()=>assert(!C.simpleBase([{name:'Plat complet',roles:['protein'],fill_roles:['protein'],pairing_complete:true}],['protein'])));
test('bolognese composite asks for precision instead of second protein',()=>{const r=C.plan({rows:[{name:'Pâtes bolognaise',roles:['composite'],fill_roles:[],pairing_mode:'prepared_composite'}],roles:['composite'],candidates:{protein}});assert.equal(r.names,undefined);assert.match(r.title,/plat composé/i);});
test('vegetable spaghetti remains vegetable structurally',()=>{const squash={name:'Courge spaghetti',roles:['vegetable'],fill_roles:['vegetable'],families:['slot:vegetable','veg:squash']};assert(C.simpleBase([squash],['vegetable']));assert(!C.coveredRoles([squash],[]).has('starch'));});
test('nested profile.pairing V4896592 fields are read',()=>{const nested={name:'Penne',roles:['starch'],fill_roles:['starch'],families:['base:pasta'],profile:{pairing:{mode:'starch_side',strong_families:['protein:poultry'],possible_families:['veg:warm_mild'],requires_accompaniment:true,complete:false}}};assert.equal(C.pairingMode(nested),'starch_side');assert.equal(C.pairStrength(nested,protein),4);assert(C.requiresAccompaniment(nested));});
test('mutual explicit avoid stops a three-part assembly',()=>{const vegAvoid={...veg,pairing_avoid_families:['protein:poultry']};const r=C.plan({rows:[pasta],roles:['starch'],candidates:{protein,vegetable:vegAvoid}});assert.deepEqual(r.names,['Poulet']);});
test('full salmon variants remain distinct',()=>assert.notEqual(...C.choiceLabels([{name:'Saumon fumé, tranché'},{name:'Saumon fumé, à chaud'}])));
test('identical names remain selectable',()=>assert.notEqual(...C.choiceLabels([{name:'Saumon fumé',protein_100g:21},{name:'Saumon fumé',protein_100g:22}])));

// Exerce les fonctions réelles de la page, pas une réimplémentation de test.
const source=fs.readFileSync(path.join(__dirname,'../scripts/food-adapter.js'),'utf8');
function extract(name){const start=source.indexOf('    function '+name+'(');assert(start>=0,name);const rest=source.slice(start+1);const end=rest.search(/\n    (?:async )?function /);return rest.slice(0,end);}
const ctx={
  Completion:C,completionScope:null,linkedMeal:null,librarySelections:new Map([['macaroni',pasta]]),structuredItems:[],
  questionBox:{hidden:true,innerHTML:'',querySelectorAll:()=>[],scrollIntoView:()=>{}},document:{getElementById:()=>({})},
  mealStructure:a=>({roles:a.parsed.structuralRoles,protein:a.parsed.structuralRoles.includes('protein'),starch:a.parsed.structuralRoles.includes('starch'),vegetable:a.parsed.structuralRoles.includes('vegetable'),fruit:false}),
  mealMoment:()=>({key:'unknown'}),inferDirectMainMeal:()=>false,libraryBridge:{profile_engine_active:true,_selected_refs_applied:true},
  chooseLibraryCandidate:r=>({protein,vegetable:veg,starch:rice}[r])
};
vm.createContext(ctx);for(const n of ['completionRows','askCompletionScope','setUnifiedDecision'])vm.runInContext(extract(n),ctx);
test('actual page asks how to use real V4896592 macaroni',()=>{assert(ctx.askCompletionScope({structuralRoles:['starch']}));assert.match(ctx.questionBox.innerHTML,/En faire un repas/);});
test('actual page completes macaroni with protein and vegetable',()=>{ctx.completionScope='complete';const r=ctx.setUnifiedDecision({parsed:{structuralRoles:['starch']}},{},'autre');assert.match(r.recommendations[0].body,/Poulet et Courgette/);assert.equal(r.parsed.completion_scope,'complete');assert.equal(r.parsed.unified_decision.version,'V4896593R1');});
test('actual page respects keep-alone choice',()=>{ctx.completionScope='adjust';const r=ctx.setUnifiedDecision({parsed:{structuralRoles:['starch']}},{},'autre');assert.equal(r.recommendations[0].title,'Tu gardes cet aliment seul');});
test('actual page does not name fallback candidates when selected refs were not applied',()=>{ctx.completionScope='complete';ctx.libraryBridge._selected_refs_applied=false;const r=ctx.setUnifiedDecision({parsed:{structuralRoles:['starch']}},{},'autre');assert.match(r.recommendations[0].body,/aucun complément suffisamment compatible/);});
test('lunch entry chooses meal scope automatically',()=>{ctx.completionScope=null;ctx.linkedMeal={meal_type:'lunch'};ctx.structuredItems=[fish];assert.equal(ctx.askCompletionScope({structuralRoles:['protein']}),false);assert.equal(ctx.completionScope,'complete');});
test('snack entry is not forced into a full meal',()=>{ctx.completionScope=null;ctx.linkedMeal={meal_type:'snack'};assert.equal(ctx.askCompletionScope({structuralRoles:['protein']}),false);assert.equal(ctx.completionScope,null);});

console.log(`${count} tests passed`);
