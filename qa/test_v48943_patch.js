const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'scripts/tee-next.js'),'utf8');
const html=fs.readFileSync(path.join(root,'tee-next.html'),'utf8');
const htmlMirror=fs.readFileSync(path.join(root,'www/tee-next.html'),'utf8');
const jsMirror=fs.readFileSync(path.join(root,'www/scripts/tee-next.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase/V48943_CATALOGUE_ETENDU_BUDGET_UI_PROPRE.sql'),'utf8');
const dict=JSON.parse(fs.readFileSync(path.join(root,'data/v48943/component_dictionary_v3.json'),'utf8'));
const coverage=JSON.parse(fs.readFileSync(path.join(root,'data/v48943/mapping_coverage_v48943.json'),'utf8'));

function ok(cond,msg){if(!cond)throw new Error(msg)}

ok(js===jsMirror,'miroirs JS différents');
ok(html===htmlMirror,'miroirs HTML différents');
ok(/v48943-catalogue-etendu-budget-ui-r1/.test(html),'cache bust V489.4.3 absent');
ok(/targetRatio:0\.90,minRatio:0\.78,maxRatio:0\.99,hardFloorRatio:0\.78/.test(js),'politique balanced V489.4.3 absente');
ok(/floorStates=floorRatio>0/.test(js),'filtre plancher budgétaire absent');
ok(/finalPool=floorStates\.length\?floorStates:beam/.test(js),'fallback budget sûr absent');
ok(/budgetFloorEnforced/.test(js),'debug plancher budget absent');
ok(!/Catalogue culinaire TEE en enrichissement/.test(js),'texte technique catalogue encore visible');
ok(!/3 585\+ références/.test(js),'compteur CIQUAL technique encore visible');
ok(!/Part chiffrable/.test(js),'part chiffrable encore visible');
ok(!/Formats magasin/.test(js),'formats magasin encore visibles');
ok(!/prix de paquet frais/.test(js),'fraîcheur paquet encore visible');
ok(!/RNM FranceAgriMer/.test(js),'source prix interne encore visible');
ok(!/Aucun assemblage libre, aucun appel à une IA externe/.test(js),'architecture interne encore visible');
ok(/Estimation<\/small>/.test(js),'carte estimation utilisateur absente');
ok(/Repas planifiés<\/small>/.test(js),'carte repas planifiés absente');
ok(dict.length===111,'dictionnaire explicite != 111');
ok(coverage.catalog_component_occurrences===937,'total composants source inattendu');
ok(coverage.occurrences_covered_by_explicit_dictionary===923,'couverture explicite inattendue');
ok(coverage.occurrences_intentionally_left_for_review===14,'reste revue inattendu');
ok(/mt_curated_component_dictionary_v3/.test(sql),'table dictionnaire v3 absente');
ok(/TEE_V48943_EXPLICIT/.test(sql),'source résolution explicite absente');
ok(/resolution_status='resolved_high'/.test(sql),'publication forte absente');
ok(/level_2_requires_manual_review/.test(sql),'garde culture niveau 2 absent');
ok(/free_ciqual_assembly_required',false/.test(sql),'assembleur libre non verrouillé');

const mockBeam=[{cost:23.84},{cost:39.93},{cost:44.80}];
const floor=45*0.78;
const eligible=mockBeam.filter(x=>x.cost>=floor&&x.cost<=45*1.001);
ok(eligible.length===2 && !eligible.some(x=>x.cost===23.84),'plancher budget synthétique incorrect');

console.log(JSON.stringify({
  status:'ok',
  version:'V489.4.3',
  dictionary_rows:dict.length,
  source_occurrences_covered:coverage.occurrences_covered_by_explicit_dictionary,
  source_occurrences_total:coverage.catalog_component_occurrences,
  balanced_target_ratio:0.90,
  balanced_hard_floor_if_feasible:0.78,
  technical_debug_copy_visible:false,
  freeAssemblyRuntime:false
},null,2));
