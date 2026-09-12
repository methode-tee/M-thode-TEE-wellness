(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MTAdapterVEngine=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[’']/g,"'").trim();
  const compactName=value=>{
    let s=String(value||'').replace(/\s+/g,' ').trim();
    if(!s)return '';
    s=s.replace(/\s*\(aliment moyen\)\s*/ig,'').replace(/\s*[—-]\s*(?:poids )?(?:cuit|cru|nature).*$/i,'').trim();
    const first=s.split(',')[0].trim();
    return first||s;
  };
  const uniqueNames=rows=>{
    const seen=new Set(),out=[];
    for(const row of rows||[]){
      const name=compactName(row?.display_name||row?.name||row?.source_component||'');
      const key=norm(name);if(!name||seen.has(key))continue;seen.add(key);out.push(name);
    }
    return out;
  };
  const joinFr=list=>list.length<2?(list[0]||''):list.length===2?`${list[0]} et ${list[1]}`:`${list.slice(0,-1).join(', ')} et ${list[list.length-1]}`;
  function buildAnalysis(engine,opts={}){
    if(!engine||engine.active!==true)throw new Error('Moteur V indisponible.');
    const selected=uniqueNames(engine.selected_items),added=uniqueNames(engine.suggestions);
    const group=engine.selected_group||null,present=Array.isArray(engine.present_roles)?engine.present_roles:[],missing=Array.isArray(engine.missing_roles)?engine.missing_roles:[];
    let title='Aucun ajout automatique',body='',why=[];
    if(engine.composite_guard===true){
      title='Garde ce plat comme base';
      body='Ce plat est déjà une préparation composée. TEE ne lui ajoute pas automatiquement une deuxième structure de repas.';
      why=['Les plats composés sont protégés des assemblages automatiques.'];
    }else if(engine.complete===true){
      title='Garde ton repas comme prévu';
      body=engine.formula_source==='fixed_main_role_formula_v1'
        ?'Les aliments que tu as confirmés couvrent déjà la protéine, le féculent et le végétal. TEE ne rajoute rien.'
        :'Les composants prévus par cet assemblage sont déjà présents. TEE ne rajoute rien.';
      why=['Le moteur V vérifie uniquement les profils et groupes préétablis ; aucun autre moteur ne complète ce résultat.'];
    }else if(added.length){
      title=engine.formula_source==='fixed_main_role_formula_v1'?'Une proposition pour ton repas':'Compléter cette préparation';
      const base=selected.length?`garder ${joinFr(selected)}`:'garder ta base';
      body=`Tu peux ${base} et ajouter ${joinFr(added)}.`;
      why=[
        group?.v_code?`Ces aliments partagent le même groupe d’association préétabli ${group.v_code}.`:'Les aliments proposés appartiennent au même groupe d’association préétabli.',
        'TEE choisit uniquement dans la liste compatible déjà enregistrée ; aucune IA ne compose ce repas au moment de la demande.'
      ];
    }else if(engine.status==='no_common_v'){
      title='Pas d’assemblage automatique';
      body='TEE reconnaît les aliments, mais aucun groupe V commun préétabli ne les relie avec assez de certitude. Elle préfère ne rien inventer.';
      why=['Aucun assemblage hors des groupes enregistrés n’est autorisé.'];
    }else{
      title='Pas de complément préétabli';
      body='TEE reconnaît les aliments, mais la liste V associée ne contient pas de complément disponible pour ce cas. Elle ne remplace pas ce manque par une suggestion libre.';
      why=['Le moteur V fonctionne en liste fermée : profil → groupe V → aliments autorisés.'];
    }
    return {
      parsed:{
        confidence:'recognized',family:'v_engine_only',structuralRoles:present,
        v_engine:{version:engine.engine_version||'V4896596H',status:engine.status||null,group:group?.v_code||null,group_kind:engine.group_kind||group?.group_kind||null,present_roles:present,missing_roles:missing},
        personal_context:{line:''}
      },
      recommendations:[],why,signature:{title,body},personalContextLine:'',_v_engine_only:true
    };
  }
  return {buildAnalysis,compactName,uniqueNames,joinFr};
});
