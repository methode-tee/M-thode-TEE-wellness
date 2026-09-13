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
    protein:'une source de protéines',starch:'un féculent',vegetable:'un végétal',fruit:'un fruit',dairy:'un produit laitier',sweet:'une touche sucrée',beverage:'une boisson',fat:'une matière grasse',
    condiment_sandwich:'un assaisonnement',condiment_noodle:'un assaisonnement adapté',condiment_salad:'un assaisonnement',sauce_savory:'une sauce adaptée',
    dairy_or_fat:'une touche crémeuse ou grasse',dairy_or_protein_breakfast:'une base protéinée ou lactée',fat_nut:'des noix, graines ou bons lipides',grain_breakfast:'une base céréalière',
    protein_or_dairy:'une garniture principale',binder:'un liant',liquid_dairy:'un liquide',fat_baking:'une matière grasse',aromatic_sweet:'un parfum',aromatic_savory:'une aromatique'
  }[String(role||'').toLowerCase()]||'un complément');
  const rolePresentPhrase=role=>({protein:'une source de protéines',starch:'un féculent',vegetable:'un végétal',fruit:'un fruit',dairy:'un produit laitier'}[String(role||'').toLowerCase()]||'un élément utile');
  const repairPublicText=value=>{
    let s=String(value||'');
    const pairs=[['Ã©','é'],['Ã¨','è'],['Ãª','ê'],['Ã«','ë'],['Ã ','à'],['Ã¢','â'],['Ã®','î'],['Ã¯','ï'],['Ã´','ô'],['Ã¹','ù'],['Ã»','û'],['Ã§','ç'],['Å“','œ'],['Ã‰','É'],['Â','']];
    for(const [a,b] of pairs)s=s.split(a).join(b);
    return s;
  };
  const cleanPublic=s=>repairPublicText(String(s||'').replace(/V_(?:EXACT|MAIN|KNOW|FORM)[A-Za-z0-9_\-]*/g,'')).replace(/\s+/g,' ').trim();

  function buildAnalysis(engine,opts={}){
    if(!engine||engine.active!==true)throw new Error('Moteur alimentaire indisponible.');
    const selected=uniqueNames(engine.selected_items),added=uniqueNames(engine.suggestions);
    const matched=Array.isArray(engine.matched_slots)?engine.matched_slots:[];
    const missing=Array.isArray(engine.missing_roles)?engine.missing_roles:[];
    const formula=engine.selected_formula&&typeof engine.selected_formula==='object'?engine.selected_formula:{};
    const formulaLabel=cleanPublic(formula.label||'');
    const formulaCode=String(formula.formula_code||'');
    let title='Aucun ajout automatique',body='',why=[];

    if(engine.status==='preparation_required'){
      title='Prépare d’abord cet aliment';
      body='La référence choisie doit être préparée ou cuite avant d’être utilisée dans une formule. TEE ne la traite pas comme prête à manger.';
      why=['La préparation de la base passe avant les compléments.'];
    }else if(engine.status==='standalone'){
      title='Garde cet aliment comme prévu';
      body='Aucune formule suffisamment pertinente n’est attachée à cette fiche pour ce repas. TEE préfère ne rien inventer.';
      why=['Aucun ajout n’est forcé sans formule culinaire explicite.'];
    }else if(engine.composite_guard===true||engine.status==='protected_composite'){
      title='Garde ce plat comme base';
      body='Ce plat est enregistré comme une préparation déjà composée. TEE ne lui applique pas artificiellement une formule d’ingrédients.';
      why=['La structure propre du plat reste prioritaire.'];
    }else if(engine.complete===true){
      title=engine.anchor_preparation_required===true?'Prépare d’abord ta base':'Garde cette composition';
      body=engine.anchor_preparation_required===true
        ?`Les éléments requis par la formule${formulaLabel?` « ${formulaLabel} »`:''} sont déjà présents. Prépare ou cuis d’abord la base choisie.`
        :`Les éléments requis par la formule${formulaLabel?` « ${formulaLabel} »`:''} sont déjà présents. Rien n’est ajouté automatiquement.`;
      why=[formulaLabel?`Cette composition satisfait la formule « ${formulaLabel} ».`:'La formule sélectionnée est déjà satisfaite par les aliments saisis.'];
    }else if(added.length){
      title='Une proposition pour ton repas';
      const base=selected.length?`garder ${joinFr(selected)}`:'garder ta base';
      body=engine.anchor_preparation_required===true
        ?`Garde ${joinFr(selected)||'ta base'} ; prépare ou cuis d’abord la base qui le nécessite, puis ajoute ${joinFr(added)}.`
        :`Tu peux ${base} et ajouter ${joinFr(added)}.`;
      if(formulaLabel)why.push(`TEE poursuit ici la formule « ${formulaLabel} ».`);
      const suggestions=Array.isArray(engine.suggestions)?engine.suggestions:[];
      const seen=new Set();
      for(const suggestion of suggestions){
        const name=compactName(suggestion?.display_name||suggestion?.name||'');
        const label=cleanPublic(suggestion?.slot_label||'')||'un élément de la formule';
        if(!name)continue;
        const key=`${norm(label)}:${norm(name)}`;if(seen.has(key))continue;seen.add(key);
        why.push(`${label.charAt(0).toUpperCase()+label.slice(1)} : ${name}.`);
      }
      why=why.slice(0,4);
      if(!why.length)why=['Cette proposition complète uniquement les éléments manquants de la formule choisie.'];
    }else if(engine.status==='no_manual_recipe'||engine.status==='formula_variant_missing_profile'||engine.status==='explicit_variant_missing_profile'||engine.status==='explicit_variant_missing_pick'){
      title='Pas d’ajout automatique';
      body='TEE ne trouve pas de formule complète et fiable pour cette combinaison et préfère ne rien inventer.';
      why=['La proposition reste fermée quand une formule ne peut pas être satisfaite proprement.'];
    }else{
      title='Pas de complément nécessaire';
      body='Aucune formule ne justifie un ajout automatique pour cette composition.';
      why=['TEE ne déduit jamais la complétude d’un simple comptage protéine · féculent · végétal.'];
    }

    return {
      parsed:{
        confidence:'recognized',family:'explicit_profile_formula',structuralRoles:matched.map(x=>x?.slot_code).filter(Boolean),
        v_engine:{version:engine.engine_version||'CP495_PROFILE_BY_PROFILE',status:engine.status||null,matched_slots:matched,missing_slots:missing,anchor_profile_key:engine.anchor_profile_key||null,formula_code:formulaCode,formula_key:formula.formula_key||null,variant_key:formula.variant_key||null,variant_no:formula.variant_no||null,total_target_components:formula.total_target_components||null,required_target_components:formula.required_target_components||null,matched_components:formula.matched_components||null,memory:engine.personalization?.memory||null},
        personal_context:{line:''}
      },
      recommendations:[],why,signature:{title,body},personalContextLine:'',_v_engine_only:true
    };
  }
  return {buildAnalysis,compactName,uniqueNames,joinFr};
});
