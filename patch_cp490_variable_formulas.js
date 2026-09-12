(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MTCP490VariableFormulas=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  const forbidden=s=>{
    const name=norm(s?.display_name||s?.name||'');
    return /(?:mcdonald|mcdo|mcdeal|mcwrap|big mac|cbo|golden royal|ptite salade|p tite salade)/.test(name);
  };
  const identity=s=>{
    if(s?.dictionary_id)return `d:${s.dictionary_id}`;
    if(s?.ciqual_code||s?.code)return `c:${s.ciqual_code||s.code}`;
    return `n:${norm(s?.display_name||s?.name||s?.profile_key||'')}`;
  };
  function apply(engine){
    if(!engine||typeof engine!=='object')return engine;
    const seen=new Set(),out=[];
    for(const s of Array.isArray(engine.suggestions)?engine.suggestions:[]){
      if(!s||forbidden(s)||s.compatible===false)continue;
      if(!s.profile_key||!(s.dictionary_id||s.ciqual_code||s.code))continue;
      const k=identity(s);if(!k||seen.has(k))continue;seen.add(k);
      out.push({...s,public_reason:String(s.public_reason||'').replace(/V_(?:EXACT|MAIN|KNOW|FORM)[A-Za-z0-9_\-]*/g,'').trim()});
    }
    const missing=Array.isArray(engine.missing_roles)?engine.missing_roles:[];
    const failed=missing.length>0&&out.length<missing.length;
    return {
      ...engine,
      suggestions:failed?[]:out,
      status:failed?'no_common_v':engine.status,
      selection_explanations:failed?[]:(engine.selection_explanations||[]),
      cp490_ui:{
        version:'CP490R5_FRONTEND_FINAL',
        exact_formula_per_profile:true,
        technical_details_hidden:true,
        mcdonalds_auto_suggestions:false,
        failed_closed:failed
      }
    };
  }
  return {apply,norm,forbidden,identity};
});
