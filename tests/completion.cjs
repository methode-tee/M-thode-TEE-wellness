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
test('macaroni still has protein and vegetable missing',()=>{const r=C.plan({rows:[pasta],roles:['starch'],candidates:{protein,vegetable:veg}});assert.deepEqual(r.names,['poulet','courgette']);});
test('macaroni completion no longer requires candidates to share base:pasta',()=>{assert(!C.groups(protein).includes('base:pasta'));const r=C.plan({rows:[pasta],roles:['starch'],candidates:{protein,vegetable:veg}});assert.equal(r.title,'Une proposition pour ton repas');});
test('strong family creates explicit compatibility',()=>assert.equal(C.pairStrength(pasta,protein),4));
test('possible family creates explicit compatibility',()=>assert(C.pairStrength({...pasta,pairing_strong_families:[],pairing_possible_families:['protein:poultry']},protein)>=3));
test('avoid family blocks candidate even with high server score',()=>assert.equal(C.pairStrength({...pasta,pairing_avoid_families:['protein:poultry']},{...protein,compatibility_score:99}),-1));
test('server v4 compatibility remains a conservative fallback',()=>assert(C.pairStrength(fish,rice)>0));
test('server candidate below bridge threshold is not accepted by completion',()=>assert.equal(C.pairStrength(fish,{...rice,compatibility_score:30}),0));
test('explicit empty fill roles is not an allow-list for missing roles',()=>{const base={...pasta,fill_roles:[]};const r=C.plan({rows:[base],roles:['starch'],candidates:{protein,vegetable:veg}});assert.deepEqual(r.names,['poulet','courgette']);});
test('requires_accompaniment produces explicit incomplete message when no candidate',()=>{const r=C.plan({rows:[pasta],roles:['starch'],candidates:{}});assert.equal(r.title,'Une base à compléter');assert.match(r.body,/attend un accompagnement/);});
test('salmon can become a meal using trusted bridge candidates',()=>{const r=C.plan({rows:[fish],roles:['protein'],candidates:{starch:rice,vegetable:cucumber}});assert.deepEqual(r.names,['riz complet','concombre']);});
test('missing one salmon complement is not called complete',()=>{const r=C.plan({rows:[fish],roles:['protein'],candidates:{starch:rice}});assert.equal(r.title,'Un premier accompagnement');assert.match(r.body,/ne présente pas cette proposition comme un repas complet/);});
test('digestive intention never invents tolerance',()=>{const r=C.plan({rows:[pasta],roles:['starch'],candidates:{protein,vegetable:veg},goal:'digestion'});assert(!r.names);assert.match(r.body,/tolères bien/);});
test('prepared pasta is composite',()=>assert(C.composed([{name:'Raviolis',roles:['composite'],fill_roles:[],pairing_mode:'prepared_composite'}])));
test('prepared pasta is not a simple base',()=>assert(!C.simpleBase([{name:'Raviolis',roles:['composite'],fill_roles:[],pairing_mode:'prepared_composite'}],['composite'])));
test('pairing_complete is not re-opened as a simple base',()=>assert(!C.simpleBase([{name:'Plat complet',roles:['protein'],fill_roles:['protein'],pairing_complete:true}],['protein'])));
test('bolognese composite asks for precision instead of second protein',()=>{const r=C.plan({rows:[{name:'Pâtes bolognaise',roles:['composite'],fill_roles:[],pairing_mode:'prepared_composite'}],roles:['composite'],candidates:{protein}});assert.equal(r.names,undefined);assert.match(r.title,/plat composé/i);});
test('vegetable spaghetti remains vegetable structurally',()=>{const squash={name:'Courge spaghetti',roles:['vegetable'],fill_roles:['vegetable'],families:['slot:vegetable','veg:squash']};assert(C.simpleBase([squash],['vegetable']));assert(!C.coveredRoles([squash],[]).has('starch'));});
test('nested profile.pairing V4896592 fields are read',()=>{const nested={name:'Penne',roles:['starch'],fill_roles:['starch'],families:['base:pasta'],profile:{pairing:{mode:'starch_side',strong_families:['protein:poultry'],possible_families:['veg:warm_mild'],requires_accompaniment:true,complete:false}}};assert.equal(C.pairingMode(nested),'starch_side');assert.equal(C.pairStrength(nested,protein),4);assert(C.requiresAccompaniment(nested));});
test('mutual explicit avoid stops a three-part assembly',()=>{const vegAvoid={...veg,pairing_avoid_families:['protein:poultry']};const r=C.plan({rows:[pasta],roles:['starch'],candidates:{protein,vegetable:vegAvoid}});assert.deepEqual(r.names,['poulet']);});
test('full salmon variants remain distinct',()=>assert.notEqual(...C.choiceLabels([{name:'Saumon fumé, tranché'},{name:'Saumon fumé, à chaud'}])));
test('identical names remain selectable',()=>assert.notEqual(...C.choiceLabels([{name:'Saumon fumé',protein_100g:21},{name:'Saumon fumé',protein_100g:22}])));
test('generic milk excludes infant formula references',()=>{const infant={name:'Lait 1er âge, poudre soluble (préparation pour nourrissons)'};assert.equal(C.referenceAllowed('Lait',infant),false);assert.equal(C.referenceAllowed('Lait 1er âge',infant),true);});
test('adult milk ranks above infant formula for generic milk',()=>{const adult={name:'Lait demi-écrémé, UHT',match_rank:18},infant={name:'Lait 1er âge, prêt à consommer (préparation pour nourrissons)',match_rank:1};assert(C.referencePriority('Lait',adult)>C.referencePriority('Lait',infant));});
test('fresh vegetable outranks dried technical vegetable',()=>{const fresh={name:'Courgette, cuite',roles:['vegetable'],fill_roles:['vegetable']},dry={name:'Tomate, séchée',roles:['vegetable'],fill_roles:['vegetable']};assert(C.qualityScore(fresh,'vegetable')>C.qualityScore(dry,'vegetable'));});
test('bread outranks biscotte as a structural starch',()=>{const bread={name:'Pain (aliment moyen)',roles:['starch'],fill_roles:['starch']},biscotte={name:'Biscotte aux céréales',roles:['starch'],fill_roles:['starch']};assert(C.qualityScore(bread,'starch')>C.qualityScore(biscotte,'starch'));});
test('simple vegetable outranks prepacked composite salad',()=>{const fresh={name:'Champignon de Paris',roles:['vegetable'],fill_roles:['vegetable']},packed={name:'Salade végétarienne à base de boulgour et/ou quinoa et légumes, préemballée',roles:['vegetable','composite'],fill_roles:['vegetable'],pairing_mode:'prepared_composite'};assert(C.qualityScore(fresh,'vegetable')>C.qualityScore(packed,'vegetable'));});
test('technical labels are humanized in prose',()=>{assert.equal(C.proseLabel({name:'Maccheroni — poids cuit, nature'}),'macaroni');assert.equal(C.proseLabel({name:'Thon germon ou thon blanc, cuit à la vapeur sous pression'}),'thon');assert.equal(C.proseLabel({name:'Pain (aliment moyen)'}),'pain');});

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
ctx.normalize=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
ctx.text={value:''};ctx.adapterContext={day_excluding_current:{protein_names:[]}};ctx.libraryBridge={profile_engine_active:true,_selected_refs_applied:true,candidate_pools:{}};
ctx.culinaryMissingHints=()=>[];ctx.culinaryCandidateScore=c=>Number(c?.compatibility_score||0)*1.35;ctx.libraryPool=role=>ctx.libraryBridge.candidate_pools[role]||[];
vm.createContext(ctx);for(const n of ['completionRows','candidateLabel','segmentKey','candidateSemanticFit','segmentCandidates','chooseLibraryCandidate','askCompletionScope','setUnifiedDecision'])vm.runInContext(extract(n),ctx);

function resetMacaroniPage(){
  ctx.linkedMeal=null;ctx.completionScope=null;ctx.librarySelections=new Map([['macaroni',pasta]]);ctx.structuredItems=[];
  ctx.libraryBridge={profile_engine_active:true,_selected_refs_applied:true,candidate_pools:{protein:[protein],vegetable:[veg],starch:[rice]}};
  ctx.adapterContext={day_excluding_current:{protein_names:[]}};ctx.text.value='Macaroni';
}
test('actual page asks how to use real V4896592 macaroni',()=>{resetMacaroniPage();assert(ctx.askCompletionScope({structuralRoles:['starch']}));assert.match(ctx.questionBox.innerHTML,/En faire un repas/);});
test('actual page hides infant milks for generic lait',()=>{const seg={input:'Lait',candidates:[{name:'Lait 1er âge, poudre soluble (préparation pour nourrissons)',match_rank:1},{name:'Lait demi-écrémé, UHT',match_rank:18},{name:'Lait entier, UHT',match_rank:20}]};const out=ctx.segmentCandidates(seg);assert.equal(out.length,2);assert.match(out[0].name,/demi-écrémé/i);assert(!out.some(x=>/nourrisson/i.test(x.name)));});
test('actual page can show infant milk when user asks for it',()=>{const seg={input:'Lait 1er âge',candidates:[{name:'Lait 1er âge, poudre soluble (préparation pour nourrissons)',match_rank:1}]};assert.equal(ctx.segmentCandidates(seg).length,1);});
test('actual page prefers pain to biscotte for starch completion',()=>{ctx.structuredItems=[{name:'Œufs',roles:['protein'],fill_roles:['protein'],compatibility_score:90}];ctx.librarySelections=new Map();ctx.libraryBridge={profile_engine_active:true,_selected_refs_applied:true,candidate_pools:{starch:[{name:'Biscotte aux céréales',roles:['starch'],fill_roles:['starch'],compatibility_score:92},{name:'Pain (aliment moyen)',roles:['starch'],fill_roles:['starch'],compatibility_score:75}]}};const c=ctx.chooseLibraryCandidate('starch','autre',{parsed:{normalized:'oeufs'}});assert.match(c.name,/Pain/);});
test('actual page prefers fresh veg to dried or composite veg',()=>{ctx.structuredItems=[pasta];ctx.libraryBridge={profile_engine_active:true,_selected_refs_applied:true,candidate_pools:{vegetable:[{name:'Tomate, séchée',roles:['vegetable'],fill_roles:['vegetable'],compatibility_score:94},{name:'Salade végétarienne à base de boulgour et/ou quinoa et légumes, préemballée',roles:['vegetable','composite'],fill_roles:['vegetable'],pairing_mode:'prepared_composite',compatibility_score:96},{name:'Courgette, cuite',roles:['vegetable'],fill_roles:['vegetable'],families:['veg:warm_mild'],compatibility_score:72}]}};const c=ctx.chooseLibraryCandidate('vegetable','autre',{parsed:{normalized:'macaroni'}});assert.match(c.name,/Courgette/);});
test('actual page completes macaroni with protein and vegetable',()=>{resetMacaroniPage();ctx.completionScope='complete';const r=ctx.setUnifiedDecision({parsed:{structuralRoles:['starch'],normalized:'macaroni'}},{},'autre');assert.match(r.recommendations[0].body,/poulet et courgette/);assert.equal(r.parsed.completion_scope,'complete');assert.equal(r.parsed.unified_decision.version,'V4896593R2');});
test('actual page respects keep-alone choice',()=>{resetMacaroniPage();ctx.completionScope='adjust';const r=ctx.setUnifiedDecision({parsed:{structuralRoles:['starch'],normalized:'macaroni'}},{},'autre');assert.equal(r.recommendations[0].title,'Tu gardes cet aliment seul');});
test('actual page does not name fallback candidates when selected refs were not applied',()=>{resetMacaroniPage();ctx.completionScope='complete';ctx.libraryBridge._selected_refs_applied=false;const r=ctx.setUnifiedDecision({parsed:{structuralRoles:['starch'],normalized:'macaroni'}},{},'autre');assert.match(r.recommendations[0].body,/aucun complément suffisamment compatible/);});
test('lunch entry chooses meal scope automatically',()=>{ctx.completionScope=null;ctx.linkedMeal={meal_type:'lunch'};ctx.structuredItems=[fish];assert.equal(ctx.askCompletionScope({structuralRoles:['protein']}),false);assert.equal(ctx.completionScope,'complete');});
test('snack entry is not forced into a full meal',()=>{ctx.completionScope=null;ctx.linkedMeal={meal_type:'snack'};assert.equal(ctx.askCompletionScope({structuralRoles:['protein']}),false);assert.equal(ctx.completionScope,null);});

console.log(`${count} tests passed`);
