const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');

global.window=global;
const projectRoot=process.env.TEE_PROJECT_ROOT
  ? path.resolve(process.env.TEE_PROJECT_ROOT)
  : path.resolve(__dirname,'..');
const projectScript=name=>path.join(projectRoot,'scripts',name);
global.MTFoodInspirationKB=require(projectScript('food-inspiration-kb.js'));
global.MTFoodAffinities=require(projectScript('food-inspiration-affinities.js'));
global.MTFoodUniversalEngine=require(projectScript('food-universal-engine.js'));

const source=fs.readFileSync(path.join(__dirname,'../scripts/food-adapter.js'),'utf8');

function extract(name){
  const start=source.indexOf('    function '+name+'(');
  assert(start>=0,`missing ${name}`);
  const rest=source.slice(start+1);
  const end=rest.search(/\n    (?:async )?function /);
  return rest.slice(0,end<0?rest.length:end);
}
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/œ/g,'oe');

const ctx={
  normalize:norm,
  segmentKey:value=>norm(value).replace(/\s+/g,' ').trim(),
  window:{MTFoodUniversalEngine:global.MTFoodUniversalEngine},
  text:{value:'Pâtes + lardons'},
  adapterContext:{day_excluding_current:{protein_names:[]}},
  linkedMeal:null,
  libraryPool:()=>[],
  candidateLabel:c=>String(c?.display_name||c?.name||'').split(',')[0],
  culinaryMissingHints:()=>['champignons persillés','brocoli ail-citron','épinards ail-muscade']
};
vm.createContext(ctx);

for(const name of [
  'culinaryIntent','culinaryRawParts','culinaryHintsFromIngredients','adapterCulinaryHints',
  'culinaryStemToken','culinaryHintTerms','culinaryTokens','culinaryCandidateScore',
  'candidateSemanticFit','segmentCandidates','chooseLibraryCandidate','nutrientCoverage'
]) vm.runInContext(extract(name),ctx);

let count=0;
function test(name,fn){fn();count++;console.log('OK',name);}

test('real culinary engine proposes pasta-compatible vegetables',()=>{
  const hints=ctx.adapterCulinaryHints('Pâtes + lardons','autre').map(norm).join(' | ');
  assert.match(hints,/champignon|brocoli|epinard/);
  assert.doesNotMatch(hints,/artichaut/);
});

test('culinary terms are derived from engine hints, not a food-pair table',()=>{
  const hints=ctx.adapterCulinaryHints('Pâtes + lardons','autre');
  const terms=ctx.culinaryHintTerms(hints).map(norm);
  assert(terms.some(x=>/champignon|brocoli|epinard/.test(x)));
  assert(!terms.includes('artichaut'));
});

test('ambiguous burger does not pre-invent a garnish',()=>{
  assert.deepEqual(Array.from(ctx.adapterCulinaryHints('Burger + frites','autre')),[]);
});

test('pasta homonyms fail closed',()=>{
  const seg={input:'Pâtes',candidates:[
    {display_name:'Pâté (aliment moyen)'},
    {display_name:'Pâte à pizza fine'}
  ]};
  assert.equal(ctx.segmentCandidates(seg).length,0);
});

test('pasta resolver keeps real pasta candidates',()=>{
  const seg={input:'Pâtes',candidates:[
    {display_name:'Pâté (aliment moyen)'},
    {display_name:'Pâtes simples'}
  ]};
  const rows=ctx.segmentCandidates(seg);
  assert.equal(rows.length,1);
  assert.match(rows[0].display_name,/Pâtes/);
});

test('candidate choice follows culinary affinity, not first nutritional row',()=>{
  ctx.libraryPool=()=>[
    {name:'Artichaut',culinary_affinity:0},
    {name:'Champignon de Paris, cru',culinary_affinity:82,culinary_term:'champignons'}
  ];
  const picked=ctx.chooseLibraryCandidate('vegetable','autre',{parsed:{normalized:'pâtes lardons'}});
  assert.equal(picked.name,'Champignon de Paris, cru');
});

test('no compatible candidate means no invented named food',()=>{
  ctx.libraryPool=()=>[{name:'Artichaut',culinary_affinity:0}];
  assert.equal(ctx.chooseLibraryCandidate('vegetable','autre',{parsed:{normalized:'pâtes lardons'}}),null);
});

test('legacy partial macro coverage is rejected',()=>{
  assert.equal(ctx.nutrientCoverage({day_excluding_current:{coverage:{fiber:true}}},'fiber'),false);
});

test('strict complete macro coverage is accepted',()=>{
  assert.equal(ctx.nutrientCoverage({day_excluding_current:{coverage_strict:{nutrients:{fiber:{complete:true}}}}},'fiber'),true);
});

test('frontend calls v3 bridge and keeps v1 fallback',()=>{
  assert.match(source,/mt_adapter_library_bridge_v3/);
  assert.match(source,/mt_adapter_library_bridge_v1/);
});

test('adapter contains no hardcoded pasta accompaniment allowlist',()=>{
  assert.doesNotMatch(source,/\['courgette','épinard','petit pois'\]/);
  assert.doesNotMatch(source,/function adapterCulinaryHints\(raw\)\s*\{[\s\S]{0,400}pates[\s\S]{0,400}courgette/);
});

console.log(`${count} scenarios passed`);
