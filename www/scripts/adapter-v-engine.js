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
  const cleanPublic=s=>String(s||'').replace(/V_(?:EXACT|MAIN|KNOW|FORM)[A-Za-z0-9_\-]*/g,'').replace(/\s+/g,' ').trim();

  function buildAnalysis(engine,opts={}){
    if(!engine||engine.active!==true)throw new Error('Moteur alimentaire indisponible.');
    const selected=uniqueNames(engine.selected_items),added=uniqueNames(engine.suggestions);
    const present=Array.isArray(engine.present_roles)?engine.present_roles:[];
    const missing=Array.isArray(engine.missing_roles)?engine.missing_roles:[];
    const formula=engine.selected_formula&&typeof engine.selected_formula==='object'?engine.selected_formula:{};
    const formulaLabel=cleanPublic(formula.label||'');
    const formulaCode=String(formula.formula_code||'');
    let title='Aucun ajout automatique',body='',why=[];

    if(engine.status==='preparation_required'){
      title='Prépare d’abord cet aliment';
      body='La référence choisie correspond à un aliment qui doit être préparé ou cuit avant de composer le repas. TEE ne le traite pas comme prêt à manger.';
      why=['La préparation passe avant les compléments du repas.'];
    }else if(engine.status==='standalone'){
      title='Garde cet aliment comme prévu';
      if(formulaCode==='protected_snack')body='Cet aliment est plutôt un snack ou un accompagnement. TEE ne le transforme pas automatiquement en repas complet.';
      else body='Cet ingrédient ne constitue pas à lui seul une base à compléter automatiquement.';
      why=['Aucun ajout n’est forcé quand la structure ne s’y prête pas.'];
    }else if(engine.composite_guard===true||engine.status==='protected_composite'){
      title='Garde ce plat comme base';
      body=engine.anchor_preparation_required===true?'Cette préparation est déjà composée, mais la référence choisie doit d’abord être cuite ou préparée. Ensuite, garde sa structure sans la surcharger.':'Ce plat est déjà composé. TEE préfère le garder tel quel plutôt que de le surcharger.';
      why=['Ton plat possède déjà sa propre structure.'];
    }else if(engine.complete===true){
      title=engine.anchor_preparation_required===true?'Prépare d’abord ta base':'Garde ton repas comme prévu';
      body=engine.anchor_preparation_required===true?'Tous les compléments prévus sont déjà présents. Prépare ou cuis d’abord la base choisie, puis garde cette composition.':(formulaLabel?`Ta préparation couvre déjà les éléments prévus pour une ${formulaLabel.toLowerCase()}. Rien à ajouter.`:'Ton repas est déjà suffisamment complet. Rien à ajouter.');
      why=['Les éléments prévus pour cette préparation sont déjà présents.'];
    }else if(added.length){
      title='Une proposition pour ton repas';
      const base=selected.length?`garder ${joinFr(selected)}`:'garder ta base';
      body=engine.anchor_preparation_required===true?`Prépare d’abord ${joinFr(selected)||'ta base'}, puis ajoute ${joinFr(added)}.`:`Tu peux ${base} et ajouter ${joinFr(added)}.`;
      const suggestions=Array.isArray(engine.suggestions)?engine.suggestions:[];
      const seen=new Set();
      if(formulaLabel)why.push(`Cette base suit une structure de ${formulaLabel.toLowerCase()}.`);
      for(const role of present){
        const key=String(role||'').toLowerCase();
        if(!['protein','starch','vegetable'].includes(key)||seen.has(`present:${key}`))continue;
        seen.add(`present:${key}`);
        why.push(`Ton repas contient déjà ${rolePresentPhrase(key)}.`);
      }
      for(const suggestion of suggestions){
        const name=compactName(suggestion?.display_name||suggestion?.name||'');
        const role=String(suggestion?.slot_code||suggestion?.role||'').toLowerCase();
        if(!name)continue;
        const key=`add:${norm(name)}:${role}`;if(seen.has(key))continue;seen.add(key);
        const label=cleanPublic(suggestion?.slot_label||'')||rolePhrase(role);
        why.push(`${name} apporte ${label.replace(/^un |^une |^des /i,m=>m.toLowerCase())}.`);
      }
      why=why.slice(0,4);
      if(!why.length)why=['Cette proposition complète simplement ta préparation.'];
    }else if(engine.status==='no_common_v'){
      title='Pas d’ajout automatique';
      body='TEE ne trouve pas de combinaison assez cohérente pour compléter cette base et préfère ne rien inventer.';
      why=['Mieux vaut garder ton repas tel quel que proposer un assemblage peu pertinent.'];
    }else{
      title='Pas de complément nécessaire';
      body='TEE ne trouve pas d’ajout suffisamment pertinent pour cette préparation.';
      why=['Ton repas peut rester comme prévu.'];
    }

    return {
      parsed:{
        confidence:'recognized',family:'exact_variable_formula',structuralRoles:present,
        v_engine:{version:engine.engine_version||'CP490R5',status:engine.status||null,present_roles:present,missing_slots:missing,formula_code:formulaCode,total_target_components:formula.total_target_components||null},
        personal_context:{line:''}
      },
      recommendations:[],why,signature:{title,body},personalContextLine:'',_v_engine_only:true
    };
  }
  return {buildAnalysis,compactName,uniqueNames,joinFr};
});
