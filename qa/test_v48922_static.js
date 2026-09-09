const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'scripts','tee-next.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase','V48922_ROTATION_FORTE_CIQUAL_CULINAIRE.sql'),'utf8');
const checks={
  header:js.includes('V489.2.2'),
  history_v2:js.includes('mt_planner_recent_recommendations_v2'),
  record_v2:js.includes('mt_planner_record_generation_v2'),
  immediate_overlap_cap:js.includes('maxImmediateOverlap'),
  component_rotation:js.includes('componentRotationPenalty')&&js.includes('lastGenerationComponentKeys'),
  assembly_threshold_078:js.includes('_assemblyQuality||0)>=0.78')&&js.includes('quality<0.78'),
  dairy_plural_guard:/fromages\?/.test(js),
  sql_history_v2:sql.includes('mt_planner_recent_recommendations_v2'),
  sql_record_v2:sql.includes('mt_planner_record_generation_v2'),
  sql_component_keys:sql.includes('component_keys text[]'),
  sql_result:sql.includes('v48922_rotation_forte_ciqual_culinaire_pret')
};
const failed=Object.entries(checks).filter(([,v])=>!v);
console.log(JSON.stringify({status:failed.length?'FAIL':'PASS',checks,failed:failed.map(([k])=>k)},null,2));
if(failed.length)process.exit(1);
