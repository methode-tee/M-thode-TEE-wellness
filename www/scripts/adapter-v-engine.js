(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MTAdapterVEngine=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[’']/g,"'").trim();
  const compactName=value=>{
    let s=repairPublicText(String(value||'')).replace(/\s+/g,' ').trim();
    if(!s)return '';
    s=s.replace(/\s*\(aliment moyen\)\s*/ig,'').trim();
    const n=norm(s);
    // Les virgules CIQUAL ne doivent plus effacer l'identité utile ou l'état de préparation.
    if(/^courge,\s*graine/.test(n))return 'Graines de courge';
    if(/^chia,\s*graine/.test(n))return 'Graines de chia';
    if(/^sesame,\s*(?:grille,\s*)?graine/.test(n))return 'Graines de sésame';
    if(/^pates seches,/.test(n)){
      const complete=/ble complet|complet/.test(n),cooked=/\bcuit/.test(n),raw=/\bcru|a cuire/.test(n);
      if(cooked)return complete?'Pâtes complètes cuites':'Pâtes cuites';
      if(raw)return complete?'Pâtes complètes à cuire':'Pâtes à cuire';
      return complete?'Pâtes complètes':'Pâtes';
    }
    if(/^semoule ou graine de couscous complete,/.test(n))return /\bcuit/.test(n)?'Semoule complète cuite':'Semoule complète';
    if(/^oeuf brouille,/.test(n))return 'Œufs brouillés';
    if(/^poulet, filet sans peau grille\/poele/.test(n))return 'Poulet grillé';
    if(/^pain complet ou integral/.test(n))return 'Pain complet';
    if(/^pomme de terre, bouillie\/cuite a l'eau/.test(n))return 'Pommes de terre cuites';
    if(/^pomme de terre, vapeur/.test(n))return 'Pommes de terre vapeur';
    if(/^epinard, bouilli\/cuit a l'eau/.test(n))return 'Épinards cuits';
    if(/^carotte, bouillie\/cuite a l'eau/.test(n))return 'Carottes cuites';
    if(/^haricot vert, cuit/.test(n))return 'Haricots verts';
    if(/^courgette, rotie\/cuite au four/.test(n))return 'Courgettes rôties';
    if(/^courgette, bouillie\/cuite a l'eau/.test(n))return 'Courgettes cuites';
    if(/^lieu jaune ou colin, cuit/.test(n))return 'Poisson blanc cuit';
    if(/^fromage blanc, nature, 0% mg/.test(n))return 'Fromage blanc 0 %';
    if(/^fromage blanc, nature, 2-3% mg/.test(n))return 'Fromage blanc 2–3 %';
    if(/^fromage blanc, nature, 7-8% mg/.test(n))return 'Fromage blanc 7–8 %';
    const parts=s.split(',').map(x=>x.trim()).filter(Boolean);
    if(parts.length===1)return parts[0];
    const head=parts[0];
    const useful=parts.find((p,i)=>i>0&&/(grill|po[eê]l|r[oô]ti|cuit(?:e|es|s)?(?: au four| à la vapeur)?|vapeur)/i.test(p));
    if(useful&&!/^(p[aâ]tes|semoule)/i.test(head)){
      const state=useful.replace(/\s*(?:sans sel ajout[eé]|aliment moyen).*$/i,'').trim();
      if(state&&state.length<=42)return `${head}, ${state}`;
    }
    return head||s;
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
  // CP495R10 — segmentation repas : les fractions et les décimales ne sont jamais des séparateurs.
  const inputSegments=value=>{
    const token='__MT_DECIMAL_COMMA__';
    const protectedText=String(value||'').replace(/(\d),(\d)/g,`$1${token}$2`);
    return protectedText
      .split(/\s*(?:\+|;|&)\s*|\s*,\s*|\n+|\s+et\s+|\s+avec\s+/i)
      .map(x=>x.replaceAll(token,',').replace(/\s+/g,' ').trim())
      .filter(Boolean)
      .slice(0,32);
  };
  const quantityMeta=value=>{
    const raw=String(value||'').replace(/[’]/g,"'").replace(/[–—]/g,'-').trim();
    const out={raw};
    let m=raw.match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:à|a|-)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|mg|ml|cl|l)\b/i);
    if(m){
      const min=Number(m[1].replace(',','.')),max=Number(m[2].replace(',','.')),unit=m[3].toLowerCase();
      Object.assign(out,{kind:'range',min,max,unit});
      if(unit==='g')Object.assign(out,{min_grams:min,max_grams:max});
      if(unit==='kg')Object.assign(out,{min_grams:min*1000,max_grams:max*1000});
      return out;
    }
    m=raw.match(/^\s*(\d+(?:[.,]\d+)?)\s*(kg|g|mg|ml|cl|l)\b/i);
    if(m){
      const valueNumber=Number(m[1].replace(',','.')),unit=m[2].toLowerCase();
      Object.assign(out,{kind:'exact_unit',value:valueNumber,unit});
      if(unit==='g')out.grams=valueNumber;
      if(unit==='kg')out.grams=valueNumber*1000;
      return out;
    }
    m=raw.match(/^\s*(\d+)\s*\/\s*(\d+)\b/);
    if(m){const den=Number(m[2]);if(den)Object.assign(out,{kind:'fraction',count:Number(m[1])/den,fraction:`${m[1]}/${m[2]}`});return out;}
    const fracMap={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3};
    const first=[...raw][0];if(fracMap[first]){Object.assign(out,{kind:'fraction',count:fracMap[first],fraction:first});return out;}
    m=raw.match(/^\s*(\d+(?:[.,]\d+)?)\b/);
    if(m)Object.assign(out,{kind:'count',count:Number(m[1].replace(',','.'))});
    return out;
  };
  const suggestionReason=(label,name)=>{
    const l=norm(label),n=norm(name);
    if(/sesame/.test(n))return `${name} complète l’assaisonnement et apporte une finition légèrement grillée et croquante.`;
    if(/citron/.test(n))return `${name} apporte la touche acidulée et aromatique prévue sans changer la base du repas.`;
    if(/moutarde/.test(n))return `${name} sert ici d’assaisonnement : elle relève la préparation sans en changer la structure.`;
    if(/basilic|persil|aneth|coriandre|thym|origan/.test(n))return `${name} apporte la finition aromatique prévue par cette formule.`;
    if(/graine|oleagineux|noix|amande|cajou|chia/.test(l))return `${name} apporte la portion de graines ou d’oléagineux prévue par cette formule.`;
    if(/legume|vegetal|verdure/.test(l))return `${name} complète la part végétale du repas.`;
    if(/feculent|cereal|pain|support/.test(l))return `${name} complète la base glucidique prévue, sans imposer un nouveau type de plat.`;
    if(/laitage|yaourt|fromage blanc/.test(l))return `${name} complète la composante laitière prévue par cette formule.`;
    if(/assaisonnement|aromatique|parfum|finition/.test(l))return `${name} complète l’assaisonnement de cette formule.`;
    return `${label.charAt(0).toUpperCase()+label.slice(1)} : ${name}.`;
  };
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
  const listNorm=list=>(Array.isArray(list)?list:[]).map(x=>norm(x));
  const hasAny=(list,rx)=>list.some(v=>rx.test(v));
  const isSavoryProteinBase=list=>hasAny(list,/\b(omelette|oeuf|œuf|poulet|poisson|saumon|thon|truite|dinde|boeuf|bœuf|steak|jambon|tofu|crevette)s?\b/);
  const publicFormulaLabel=(formulaLabel,selected,added)=>{
    const raw=cleanPublic(formulaLabel||'');
    if(!raw)return '';
    const nraw=norm(raw), all=listNorm([...(selected||[]),...(added||[])]);
    if(/salade proteinee.*cereale/.test(nraw) && isSavoryProteinBase(all))return 'assiette complète autour de ta protéine';
    if(/assiette complete autour du vegetal/.test(nraw) && isSavoryProteinBase(all))return 'assiette complète autour de ta protéine';
    if(/fruit,? yaourt/.test(nraw))return 'fruit, yaourt & oléagineux';
    return raw;
  };

  function buildAnalysis(engine,opts={}){
    if(!engine||engine.active!==true)throw new Error('Moteur alimentaire indisponible.');
    const canonicalSelected=uniqueNames(engine.selected_items),typedSelected=inputSegments(opts.inputText);
    // CP495R8 : le resolver peut décomposer UNE formulation naturelle en plusieurs fiches
    // (ex. « pomme légèrement poêlée à la cannelle » -> pomme + cannelle).
    // Pour le texte public, on regroupe les enfants par source_input afin de conserver
    // exactement la formulation de l’utilisateur au lieu d’afficher une liste technique.
    const resolvedSegments=Array.isArray(opts.resolvedSegments)?opts.resolvedSegments:[];
    const sourceSelected=[];
    const sourceSeen=new Set();
    for(const seg of resolvedSegments){
      const src=repairPublicText(String(seg?.source_input||'')).replace(/\s+/g,' ').trim();
      const key=norm(src);
      if(!src||sourceSeen.has(key))continue;
      sourceSeen.add(key);sourceSelected.push(src);
    }
    const selected=sourceSelected.length?sourceSelected:(typedSelected.length===canonicalSelected.length?typedSelected:canonicalSelected);
    const added=uniqueNames(engine.suggestions);
    const matched=Array.isArray(engine.matched_slots)?engine.matched_slots:[];
    const missing=Array.isArray(engine.missing_roles)?engine.missing_roles:[];
    const formula=engine.selected_formula&&typeof engine.selected_formula==='object'?engine.selected_formula:{};
    const formulaLabel=publicFormulaLabel(formula.label||'',selected,added);
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
        why.push(suggestionReason(label,name));
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
  return {buildAnalysis,compactName,uniqueNames,joinFr,inputSegments,quantityMeta};
});
