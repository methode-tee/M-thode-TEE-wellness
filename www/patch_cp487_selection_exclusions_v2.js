(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MTCP487Selection=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';

  const norm=v=>String(v??'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/œ/g,'oe').replace(/[’']/g,"'")
    .replace(/\s+/g,' ').trim();

  const canonicalName=v=>{
    let s=norm(v);
    if(!s)return '';
    s=s.replace(/\([^)]*\)/g,' ').replace(/\s+/g,' ').trim();
    s=s.split(',')[0].trim();
    s=s.replace(/\b(?:preemballe|surgel|decongele|cru|crue|crus|crues|cuit|cuite|cuits|cuites|nature|sans sel ajoute|sans sucre ajoute)\b/g,' ')
      .replace(/\s+/g,' ').trim();
    return s;
  };

  const hasRef=s=>!!(s&&s.profile_key&&(s.dictionary_id||s.ciqual_code||s.code));

  const identityKeys=s=>{
    const keys=[];
    if(s?.dictionary_id)keys.push(`dict:${String(s.dictionary_id)}`);
    if(s?.ciqual_code||s?.code)keys.push(`ciqual:${String(s.ciqual_code||s.code)}`);
    const name=canonicalName(s?.display_name||s?.name||'');
    if(name)keys.push(`name:${name}`);
    if(!keys.length&&s?.profile_key)keys.push(`profile:${String(s.profile_key)}`);
    return [...new Set(keys)];
  };

  const dedupeKey=s=>identityKeys(s)[0]||'';

  function apply(engine){
    if(!engine||typeof engine!=='object')return engine;

    const seen=new Set(),clean=[];
    for(const raw of Array.isArray(engine.suggestions)?engine.suggestions:[]){
      if(!raw||raw.excluded===true||raw.compatible===false||!raw.role||!hasRef(raw))continue;
      const keys=identityKeys(raw);
      if(!keys.length||keys.some(k=>seen.has(k)))continue;
      keys.forEach(k=>seen.add(k));
      const explanation=raw.decision_explanation&&typeof raw.decision_explanation==='object'
        ?raw.decision_explanation
        :{
          compatibility:'Candidat conservé uniquement après validation du même groupe V exact et du rôle manquant.',
          rotation:'La rotation n’intervient qu’entre candidats de compatibilité équivalente.',
          memory:'La mémoire alimentaire n’intervient qu’au dernier départage.'
        };
      clean.push({
        ...raw,
        compatible:true,
        references:raw.references||{
          profile_key:raw.profile_key,
          dictionary_id:raw.dictionary_id||null,
          ciqual_code:raw.ciqual_code||raw.code||null
        },
        decision_explanation:explanation
      });
    }

    const missing=Array.isArray(engine.missing_roles)?engine.missing_roles:[];
    const incomplete=missing.length>0&&clean.length<missing.length;
    const visibleReasons=clean.map(s=>s?.decision_explanation?.visible).filter(Boolean);

    return {
      ...engine,
      suggestions:incomplete?[]:clean,
      status:incomplete?'no_common_v':engine.status,
      selection_explanations:incomplete?[]:visibleReasons,
      cp487_ui:{
        version:'CP487_SELECTION_EXCLUSIONS_V2',
        strict_exclusions:true,
        complete_references:true,
        identity_deduplication:true,
        rotation_before_memory:true,
        food_memory_last_tiebreak_only:true,
        goal_filtering_added:false,
        personal_nutritional_needs_calculation:false,
        failed_closed:incomplete
      }
    };
  }

  return {apply,norm,canonicalName,hasRef,identityKeys,dedupeKey};
});
