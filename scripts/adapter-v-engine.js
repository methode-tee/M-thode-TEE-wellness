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
  const rolePhrase=role=>({
    protein:'une source de protéines',
    starch:'un féculent',
    vegetable:'un végétal',
    fruit:'un fruit',
    dairy:'un produit laitier',
    sweet:'une touche sucrée',
    beverage:'une boisson',
    fat:'une matière grasse'
  }[String(role||'').toLowerCase()]||'un complément');
  const rolePresentPhrase=role=>({
    protein:'une source de protéines',
    starch:'un féculent',
    vegetable:'un végétal',
    fruit:'un fruit',
    dairy:'un produit laitier'
  }[String(role||'').toLowerCase()]||'un élément utile');
  function buildAnalysis(engine,opts={}){
    if(!engine||engine.active!==true)throw new Error('Moteur V indisponible.');
    const selected=uniqueNames(engine.selected_items),added=uniqueNames(engine.suggestions);
    const group=engine.selected_group||null,present=Array.isArray(engine.present_roles)?engine.present_roles:[],missing=Array.isArray(engine.missing_roles)?engine.missing_roles:[];
    let title='Aucun ajout automatique',body='',why=[];
    if(engine.composite_guard===true){
      title='Garde ce plat comme base';
      body='Ce plat est déjà composé. TEE préfère le garder tel quel plutôt que de le surcharger.';
      why=['Ton plat possède déjà sa propre structure.'];
    }else if(engine.complete===true){
      title='Garde ton repas comme prévu';
      body=engine.formula_source==='fixed_main_role_formula_v1'
        ?'Ton repas contient déjà une source de protéines, un féculent et un végétal. Rien à ajouter.'
        :'Ton repas est déjà suffisamment complet. Rien à ajouter.';
      why=['Ton repas couvre déjà les éléments essentiels attendus.'];
    }else if(added.length){
      title=engine.formula_source==='fixed_main_role_formula_v1'?'Une proposition pour ton repas':'Compléter cette préparation';
      const base=selected.length?`garder ${joinFr(selected)}`:'garder ta base';
      body=`Tu peux ${base} et ajouter ${joinFr(added)}.`;
      const suggestions=Array.isArray(engine.suggestions)?engine.suggestions:[];
      const seen=new Set();
      for(const role of present){
        const key=String(role||'').toLowerCase();
        if(!['protein','starch','vegetable'].includes(key)||seen.has(`present:${key}`))continue;
        seen.add(`present:${key}`);
        why.push(`Ton repas contient déjà ${rolePresentPhrase(key)}.`);
      }
      for(const suggestion of suggestions){
        const name=compactName(suggestion?.display_name||suggestion?.name||'');
        const role=String(suggestion?.role||'').toLowerCase();
        if(!name)continue;
        const key=`add:${norm(name)}:${role}`;if(seen.has(key))continue;seen.add(key);
        why.push(`${name} complète simplement ton repas avec ${rolePhrase(role)}.`);
      }
      why=why.slice(0,3);
      if(!why.length)why=['Cette proposition complète simplement ton repas sans le surcharger.'];
    }else if(engine.status==='no_common_v'){
      title='Pas d’ajout nécessaire';
      body='TEE ne trouve pas de complément assez cohérent pour ce repas et préfère ne rien ajouter.';
      why=['Mieux vaut garder ton repas tel quel que proposer un ajout peu pertinent.'];
    }else{
      title='Pas de complément nécessaire';
      body='TEE ne trouve pas d’ajout suffisamment pertinent pour ce repas.';
      why=['Ton repas peut rester comme prévu.'];
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
