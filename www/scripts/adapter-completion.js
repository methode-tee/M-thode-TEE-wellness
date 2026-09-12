(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MTAdapterCompletion=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const STRUCTURAL=['starch','protein','vegetable'];
  const list=x=>Array.isArray(x)?x:[];
  const norm=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  const uniq=x=>[...new Set(list(x).filter(Boolean))];
  const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
  const bool=(...xs)=>{for(const x of xs){if(typeof x==='boolean')return x;if(x==='true')return true;if(x==='false')return false;}return false;};

  function profile(row){
    const r=obj(row),adapter=obj(r.adapter_profile),culinary=obj(r.culinary_profile),stored=obj(r.profile),pairing=obj(stored.pairing),culinaryPairing=obj(culinary.pairing);
    return {...adapter,...culinary,...stored,...pairing,...culinaryPairing,...r};
  }
  function label(row){return String(row?.display_name||row?.name||row?.food_name||'').replace(/\s+/g,' ').trim();}
  function proseLabel(row){
    let raw=label(row).replace(/\s*[—–-]\s*poids\b.*$/i,'').replace(/\s*\(aliment moyen[^)]*\)\s*/ig,' ').replace(/\s+/g,' ').trim();
    const n=norm(raw);
    if(!raw)return '';
    if(/^maccheroni\b|^macaroni\b/.test(n))return 'macaroni';
    if(/^poulet\b/.test(n))return /\bfilet\b/.test(n)?'filet de poulet':'poulet';
    if(/^dinde\b/.test(n))return 'dinde';
    if(/^thon\b/.test(n))return 'thon';
    if(/^saumon\b/.test(n))return /\bfume\b/.test(n)?'saumon fumé':'saumon';
    if(/^oeufs?\b/.test(n))return 'œufs';
    if(/^tomate\b/.test(n)&&/\bsech/.test(n))return 'tomates séchées';
    if(/^pomme de terre\b/.test(n))return 'pommes de terre';
    if(/^salade vegetarienne a base\b/.test(n))return 'salade de céréales et légumes';
    raw=raw.split(',')[0].trim();
    if(!raw)return '';
    return raw.charAt(0).toLocaleLowerCase('fr')+raw.slice(1);
  }
  function inputHasInfantIntent(value){return /\b(bebe|nourrisson|nourrissons|infantile|1er age|premier age|2e age|deuxieme age|preparation de suite|lait de croissance|enfant)\b/.test(norm(value));}
  function infantReference(row){return /\b(nourrisson|nourrissons|1er age|premier age|2e age|deuxieme age|preparation pour nourrisson|preparation de suite|lait de croissance|infantile)\b/.test(norm(label(row)));}
  function referenceAllowed(input,row){return inputHasInfantIntent(input)||!infantReference(row);}
  function referencePriority(input,row){
    const q=norm(input),raw=norm(label(row));
    if(!referenceAllowed(input,row))return -10000;
    const rank=Number(row?.match_rank),safeRank=Number.isFinite(rank)?rank:80;
    let score=120-Math.min(100,safeRank);
    if(raw.startsWith(q)||q.startsWith(raw))score+=18;
    if(row?.familiar===true)score+=8;
    if(/^laits?$/.test(q)){
      if(/\bdemi[- ]ecreme\b/.test(raw))score+=52;
      else if(/\blait entier\b|\bentier\b/.test(raw))score+=46;
      else if(/\blait ecreme\b|\becreme\b/.test(raw))score+=42;
      else if(/\bvache\b/.test(raw))score+=34;
      else if(/\bchevre\b|\bbrebis\b/.test(raw))score+=18;
      if(/\bpoudre\b|\bconcentre\b|\bcondense\b/.test(raw))score-=22;
    }
    return score;
  }
  function qualityScore(row,role){
    const raw=norm(label(row)),rs=new Set([...roles(row),...fillRoles(row)]);let score=0;
    if(rs.has(role))score+=12;
    if(row?.familiar===true)score+=6;
    if(infantReference(row))score-=220;
    if(rs.has('composite')||pairingComplete(row)||['prepared_composite','variable_composite'].includes(pairingMode(row)))score-=55;
    if(/\b(preemball\w*|plat prepare\w*|salade vegetarienne a base|sandwich|pizza|burger|quiche|tarte salee|repas compose)\b/.test(raw))score-=38;
    if(/\b(vapeur sous pression|appert\w*|sterilis\w*|deshydrat\w*|poudre soluble)\b/.test(raw))score-=10;
    if(role==='vegetable'){
      if(/\b(sech\w*|deshydrat\w*|conserve\w*|preemball\w*)\b/.test(raw))score-=28;
      if(/\bcourgette\b/.test(raw))score+=28;
      else if(/\bbrocoli\b/.test(raw))score+=26;
      else if(/\bharicot vert\b/.test(raw))score+=25;
      else if(/\bepinard\b/.test(raw))score+=24;
      else if(/\bchampignon\b/.test(raw))score+=23;
      else if(/\btomate\b/.test(raw)&&!/\bsech/.test(raw))score+=22;
      else if(/\bconcombre\b/.test(raw))score+=21;
      else if(/\bpoivron\b/.test(raw))score+=20;
      else if(/\bcarotte\b/.test(raw))score+=19;
      else if(/\baubergine\b|\bchou fleur\b|\basperge\b|\bsalade verte\b/.test(raw))score+=18;
    }else if(role==='starch'){
      if(/\bbiscotte\b|\bcracker\b|\bchips\b|\bgalette de riz\b/.test(raw))score-=32;
      if(/\bpomme de terre\b/.test(raw))score+=28;
      else if(/\briz\b/.test(raw)&&!/\briz au lait\b/.test(raw))score+=25;
      else if(/\bpain\b/.test(raw)&&!/\bbiscotte\b/.test(raw))score+=22;
      else if(/\bsemoule\b/.test(raw))score+=20;
      else if(/\bquinoa\b|\bboulgour\b/.test(raw))score+=18;
      else if(/\bpates?\b|\bmacaroni\b|\bspaghetti\b|\bpenne\b/.test(raw))score+=18;
    }else if(role==='protein'){
      if(/\b(charcuterie|saucisse\w*|lardon\w*|nugget\w*|pane\w*)\b/.test(raw))score-=18;
      if(/\bpoulet\b/.test(raw))score+=25;
      else if(/\bdinde\b/.test(raw))score+=23;
      else if(/\boeuf\b/.test(raw))score+=20;
      else if(/\bsaumon\b/.test(raw))score+=22;
      else if(/\bthon\b/.test(raw))score+=21;
      else if(/\boeufs?\b/.test(raw))score+=22;
      else if(/\btofu\b|\btempeh\b/.test(raw))score+=19;
      else if(/\blentille\b|\bpois chiche\b|\bharicot rouge\b/.test(raw))score+=17;
      else if(/\bpoisson\b/.test(raw))score+=19;
    }
    const commas=(label(row).match(/,/g)||[]).length;if(commas>=3)score-=5;
    return score;
  }
  function roles(row){const p=profile(row);return uniq(p.roles);}
  function fillRoles(row){const p=profile(row);return uniq(p.fill_roles);}
  function families(row){const p=profile(row);return uniq(p.families);}
  function accepts(row){const p=profile(row);return uniq(p.accepts);}
  function pairingMode(row){const p=profile(row),stored=obj(row?.profile),pair=obj(stored.pairing),culPair=obj(row?.culinary_profile?.pairing);return String(p.pairing_mode||pair.mode||culPair.mode||p.mode||'').trim();}
  function strongFamilies(row){const p=profile(row),pair=obj(row?.profile?.pairing),culPair=obj(row?.culinary_profile?.pairing);return uniq(p.pairing_strong_families||pair.strong_families||culPair.strong_families||p.strong_families);}
  function possibleFamilies(row){const p=profile(row),pair=obj(row?.profile?.pairing),culPair=obj(row?.culinary_profile?.pairing);return uniq(p.pairing_possible_families||pair.possible_families||culPair.possible_families||p.possible_families);}
  function avoidFamilies(row){const p=profile(row),pair=obj(row?.profile?.pairing),culPair=obj(row?.culinary_profile?.pairing);return uniq(p.pairing_avoid_families||pair.avoid_families||culPair.avoid_families||p.avoid_families);}
  function strongTerms(row){const p=profile(row),pair=obj(row?.profile?.pairing),culPair=obj(row?.culinary_profile?.pairing);return uniq(p.pairing_strong_terms||pair.strong_terms||culPair.strong_terms||p.strong_terms);}
  function requiresAccompaniment(row){const p=profile(row),pair=obj(row?.profile?.pairing),culPair=obj(row?.culinary_profile?.pairing);return bool(p.pairing_requires_accompaniment,p.requires_accompaniment,pair.requires_accompaniment,culPair.requires_accompaniment,row?.adapter_profile?.requires_accompaniment);}
  function pairingComplete(row){const p=profile(row),pair=obj(row?.profile?.pairing),culPair=obj(row?.culinary_profile?.pairing);return bool(p.pairing_complete,p.complete,pair.complete,culPair.complete,row?.adapter_profile?.composite_complete);}
  function compatibilityScore(row){const n=Number(row?.compatibility_score);return Number.isFinite(n)?n:null;}

  function composed(rows){
    return rows.some(row=>{
      const p=profile(row),r=roles(row),mode=pairingMode(row),kind=String(p.identity_kind||p.dish_kind||'').toLowerCase();
      return r.includes('composite')||list(p.categories).includes('composite_dish')||kind==='composite'||mode==='prepared_composite'||mode==='variable_composite';
    });
  }
  function simpleBase(rows,currentRoles=[]){
    if(rows.length!==1||composed(rows))return false;
    const row=rows[0],mode=pairingMode(row),r=uniq([...currentRoles,...roles(row),...fillRoles(row)]);
    if(pairingComplete(row)||mode==='complete'||mode==='prepared_composite')return false;
    return STRUCTURAL.some(x=>r.includes(x));
  }

  // Ancien signal de groupe conservé uniquement comme fallback positif.
  // Il n'est plus exigé : une protéine ne doit pas partager "base:pasta" avec des pâtes.
  function groups(row){const p=profile(row);return uniq([...list(p.pairing_groups),...families(row).filter(x=>/^(dish_family:|pairing:|base:)/.test(x))]);}
  function intersects(a,b){const bb=new Set(list(b));return list(a).some(x=>bb.has(x));}
  function termMatch(terms,row){const l=norm(label(row));if(!l)return false;return list(terms).some(t=>{const n=norm(t);return n&&n.length>=2&&(l.includes(n)||n.includes(l));});}
  function explicitAvoid(a,b){return intersects(avoidFamilies(a),families(b))||intersects(avoidFamilies(b),families(a));}
  function roleOf(row){return STRUCTURAL.find(r=>roles(row).includes(r)||fillRoles(row).includes(r))||null;}

  function pairStrength(base,candidate){
    if(!base||!candidate||explicitAvoid(base,candidate))return -1;
    // V4896594 : un candidat renvoyé par la matrice déterministe serveur a déjà
    // passé la formule de rôle ET la compatibilité profile -> profile.
    // On ne lui redemande pas de partager une ancienne famille V4896592.
    if(candidate?.deterministic_compatible===true||candidate?.source==='V4896594_profile_matrix')return 4;
    const bf=families(base),cf=families(candidate),ba=accepts(base),ca=accepts(candidate),candRole=roleOf(candidate),baseRole=roleOf(base);
    if(termMatch(strongTerms(base),candidate)||termMatch(strongTerms(candidate),base))return 4;
    if(intersects(strongFamilies(base),cf)||intersects(strongFamilies(candidate),bf))return 4;
    if((candRole&&ba.includes(candRole))||(baseRole&&ca.includes(baseRole))||intersects(ba,cf)||intersects(ca,bf))return 3;
    if(intersects(possibleFamilies(base),cf)||intersects(possibleFamilies(candidate),bf))return 3;
    if(groups(base).some(g=>groups(candidate).includes(g)))return 2;
    const score=compatibilityScore(candidate);
    if(score!==null&&score>=65)return 2;
    if(score!==null&&score>=45)return 1;
    return 0;
  }

  function together(rows){
    if(rows.length<2)return true;
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(explicitAvoid(rows[i],rows[j]))return false;
    const base=rows[0];
    return rows.slice(1).every(x=>pairStrength(base,x)>0);
  }

  function coveredRoles(rows,currentRoles=[]){
    const covered=new Set(currentRoles);
    rows.forEach(row=>{roles(row).forEach(x=>covered.add(x));fillRoles(row).forEach(x=>covered.add(x));});
    return covered;
  }

  function plan({rows=[],roles:currentRoles=[],candidates={},goal='autre'}){
    if(composed(rows))return {title:'Préciser le plat composé',body:'Cette préparation contient déjà plusieurs ingrédients. Précise ses accompagnements avant de compléter le repas.',why:['Un plat composé ne se traite pas comme un féculent ou une protéine seuls.']};
    if(!rows.length)return {title:'Préciser ton repas',body:'TEE n’a pas de fiche alimentaire suffisamment précise pour compléter ce repas sans inventer.',why:['Aucune base alimentaire fiable n’a été confirmée.']};

    const base=rows[0],mode=pairingMode(base),covered=coveredRoles(rows,currentRoles);
    if(covered.has('fruit'))covered.add('vegetable'); // convention déjà utilisée par l’Adapter actuel
    const missing=STRUCTURAL.filter(r=>!covered.has(r));

    if(pairingComplete(base)||mode==='complete')return {title:'La structure est déjà présente',body:'Cette fiche est marquée comme complète. TEE ne rajoute pas automatiquement un deuxième composant structurel.',why:['La fiche culinaire indique que cette préparation est déjà complète.']};
    if(!missing.length)return {title:'La structure est déjà présente',body:'Les principaux rôles du repas sont déjà couverts. Cela ne permet pas de juger les quantités.',why:['TEE respecte les rôles réellement présents dans la composition.']};
    if(goal==='digestion')return {title:'Compléter selon ton confort',body:'Tu souhaites en faire un repas. Précise les accompagnements que tu tolères bien : TEE ne déduit pas ta tolérance du seul rôle nutritionnel des aliments.',why:['La compatibilité culinaire ne suffit pas à établir une tolérance digestive.']};

    const offered=[];
    for(const role of missing){
      const c=candidates[role];
      if(!c||!label(c))continue;
      const strength=pairStrength(base,c);
      if(strength<1)continue;
      if(offered.some(x=>explicitAvoid(x,c)))continue;
      offered.push(c);
    }

    if(!offered.length){
      const specificallyExpected=requiresAccompaniment(base)||['starch_side','cultural_base'].includes(mode);
      return {
        title:specificallyExpected?'Une base à compléter':'Un repas à préciser',
        body:specificallyExpected
          ?'Ton aliment est bien reconnu comme une base qui attend un accompagnement, mais aucun complément suffisamment compatible n’est disponible dans les résultats. Précise ce que tu envisages de manger avec.'
          :'Ton aliment est reconnu, mais TEE n’a pas assez d’éléments compatibles pour nommer un accompagnement sans inventer. Précise ce que tu envisages de manger avec.',
        why:['Absence de suggestion ne signifie pas que le repas est complet.']
      };
    }

    const names=offered.map(proseLabel),allMissingCovered=offered.length===missing.length;
    const sourceHasPairing=strongFamilies(base).length||possibleFamilies(base).length||strongTerms(base).length||requiresAccompaniment(base);
    const precision=allMissingCovered
      ?(sourceHasPairing?'Les compléments proposés respectent les rôles manquants et les compatibilités de la fiche culinaire.':'Les compléments proposés respectent les rôles manquants et le filtre de compatibilité de la bibliothèque.')
      :'Cette proposition ne couvre qu’une partie des rôles manquants et n’est pas présentée comme un repas complet.';
    return {
      title:allMissingCovered?'Une proposition pour ton repas':'Un premier accompagnement',
      body:`Tu peux garder ${proseLabel(base)||'ta base'} et l’accompagner de ${names.join(' et ')}.${allMissingCovered?'':' C’est une première piste ; TEE ne présente pas cette proposition comme un repas complet.'} Les quantités restent à adapter à ton repas.`,
      why:[precision],names
    };
  }

  function choiceLabels(rows){
    return rows.map((row,i)=>{
      const full=label(row),same=rows.filter(x=>label(x)===full);
      if(same.length<2)return full;
      const details=['protein_100g','fat_100g','carbs_100g','fiber_100g'].map((k,j)=>row[k]==null?'':`${['protéines','lipides','glucides','fibres'][j]} ${row[k]} g`).filter(Boolean).join(' · ');
      return `${full} — ${details||'référence'} (option ${i+1})`;
    });
  }

  return {profile,label,proseLabel,inputHasInfantIntent,infantReference,referenceAllowed,referencePriority,qualityScore,roles,fillRoles,families,accepts,pairingMode,strongFamilies,possibleFamilies,avoidFamilies,strongTerms,requiresAccompaniment,pairingComplete,composed,simpleBase,groups,pairStrength,together,coveredRoles,plan,choiceLabels};
});
