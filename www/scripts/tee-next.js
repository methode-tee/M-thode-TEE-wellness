/* MÉTHODE TEE — V489.6.5 · panier magasin strict · raisons factuelles et distinctives */
(function(){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=k=>new URLSearchParams(location.search).get(k);
const tool=q('tool')||'planner';
let sb,user;
let ciqualUniverseCache=null;
const tools=[['planner','Planifier'],['safety','Sécurité plantes']];
const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

function list(v){return String(v||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean)}
function norm(v){return String(v||'').replace(/œ/gi,'oe').replace(/æ/gi,'ae').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function tokens(v){return new Set(norm(v).split(' ').filter(x=>x.length>2))}
function containsNormalizedTerm(text,term){
  const hay=` ${norm(text)} `,needle=norm(term);
  return !!needle&&hay.includes(` ${needle} `);
}
function matchesAnyExcludedTerm(text,terms){return (Array.isArray(terms)?terms:[]).some(term=>containsNormalizedTerm(text,term))}
function euro(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}):''}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function plannerLoaderMarkup(title='TEE compose ta semaine…',subtitle='Elle équilibre les repas, le budget et la variété.'){
  return `<div class="mt-next-status mt-next-planner-loading" role="status" aria-live="polite">
    <span class="mt-next-kitchen-loader" aria-hidden="true">
      <span class="mt-next-steam"><i></i><i></i><i></i></span>
      <span class="mt-next-plate"><i class="leaf"></i><i class="grain"></i><i class="protein"></i></span>
    </span>
    <b>${esc(title)}</b>
    <small>${esc(subtitle)}</small>
  </div>`;
}

function stableHash32(v,seed=2166136261){
  let h=(seed>>>0),str=String(v??'');
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
  return h>>>0;
}
function stableUuidV4891(v){
  const a=stableHash32(v,2166136261).toString(16).padStart(8,'0');
  const b=stableHash32(v,2246822519).toString(16).padStart(8,'0');
  const c=stableHash32(v,3266489917).toString(16).padStart(8,'0');
  const d=stableHash32(v,668265263).toString(16).padStart(8,'0');
  const hex=(a+b+c+d).slice(0,32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
function shortCiqualName(v){
  const raw=String(v||'').trim();
  if(!raw)return 'Aliment';
  // CIQUAL contient souvent des précisions industrielles très longues entre
  // parenthèses ou après une virgule. Elles restent dans les données source,
  // mais ne deviennent pas le nom visible du plat.
  const noParen=raw.replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim();
  const first=noParen.split(',')[0].trim();
  return (first.length>=3?first:noParen).slice(0,88);
}
function ciqualMemoryAffinity(food,memoryState){
  if(!memoryState?.active)return 0;
  const txt=norm([food?.display_name,food?.name,...(Array.isArray(food?.categories)?food.categories:[])].join(' '));
  let s=0,m=0;
  for(const [tok,w] of memoryState.tokenMap.entries()){
    if(tok&&txt.includes(tok)){s+=Math.min(8,Number(w)||0);m++}
  }
  const country=norm(food?.country||'');
  if(country)s+=Math.min(10,memoryState.countryMap.get(country)||0)*1.6;
  (Array.isArray(food?.categories)?food.categories:[]).forEach(c=>{s+=Math.min(8,memoryState.categoryMap.get(norm(c))||0)*0.6});
  if(food?.food_dictionary_id&&memoryState.familiarIds.has(String(food.food_dictionary_id)))s+=8;
  return s*0.12+(m>=2?0.5:0);
}
function ciqualGeneralQuality(food){
  const role=String(food?.role||'other');
  const p=Number(food?.protein_100g)||0,c=Number(food?.carbs_100g)||0,f=Number(food?.fiber_100g)||0,k=Number(food?.kcal_100g)||0;
  if(role==='protein'||role==='protein_plant')return clamp(p/22,0,1.5)+clamp(f/8,0,0.35);
  if(role==='starch')return clamp(c/35,0,1.2)+clamp(f/8,0,0.5);
  if(role==='vegetable')return clamp(f/5,0,1.2)+clamp((120-k)/120,0,0.55);
  if(role==='composite')return clamp(p/18,0,1)+clamp(c/35,0,0.65)+clamp(f/8,0,0.5);
  return 0;
}
function ciqualRolePortion(food){
  const role=String(food?.role||'other'),t=norm(food?.name||'');
  if(role==='protein'||role==='protein_plant')return 140;
  if(role==='vegetable')return 180;
  if(role==='starch')return /\b(cru|crue|sec|seche|deshydrate|farine|semoule)\b/.test(t)?80:180;
  if(role==='composite')return 350;
  return 100;
}
function ciqualPriceCost(price,qty){
  if(!price||price.stale===true||price.verified===false)return null;
  const kg=num(price.eur_per_kg);
  if(kg!==null&&kg>0)return qty/1000*kg;
  const unit=num(price.unit_price_eur),weight=num(price.unit_weight_g);
  if(unit!==null&&unit>0&&weight!==null&&weight>0)return qty/weight*unit;
  return null;
}
async function loadCiqualUniverseV4891(){
  if(Array.isArray(ciqualUniverseCache))return ciqualUniverseCache;
  const r=await safeCall(sb.rpc('mt_planner_ciqual_universe_v1'),15000,'L’univers alimentaire CIQUAL');
  if(r?.error){console.warn('[TEE V489.1] univers CIQUAL indisponible',r.error);return []}
  ciqualUniverseCache=Array.isArray(r?.data)?r.data:[];
  return ciqualUniverseCache;
}
function ciqualAssemblyFamily(food,role){
  const t=norm([food?.display_name,food?.name].join(' '));
  // Une valeur nutritionnelle ne suffit jamais à déterminer un rôle culinaire.
  // Seuls des aliments nommément identifiables peuvent devenir les trois piliers
  // d'une assiette. Le reste de CIQUAL demeure consultable mais non assemblable.
  if(/\b(specialite|dessert|compote|confiture|fruit|graine|graines|semence|poudre|farine|fecule|amidon|chapelure|arome|extrait|sauce|jus|sirop)\b/.test(t))return null;
  if(role==='protein'||role==='protein_plant'){
    if(/\b(nuggets?|croquettes?|pane(?:e|es|s)?|panes?|charcuteries?|cordons? bleus?|saucisses?|merguez|boudins?|rillettes?|terrines?|quenelles?|hot dogs?|knacks?)\b/.test(t))return null;
    const families=[
      ['poultry',/\b(poulet|dinde|volaille|canard)\b/],['beef',/\b(boeuf|veau)\b/],
      ['pork',/\b(porc|jambon)\b/],['lamb',/\b(agneau|mouton)\b/],['egg',/\b(oeuf|oeufs)\b/],
      ['shrimp_shellfish',/\b(crevette|crevettes|moule|moules|huitre|huitres|calamar|seiche)\b/],
      ['fish',/\b(saumon|truite|thon|cabillaud|colin|merlu|lieu|dorade|bar|sardine|maquereau|hareng|anchois|poisson)\b/],
      ['tofu_tempeh',/\b(tofu|tempeh|seitan)\b/],['legume',/\b(lentille|lentilles|pois chiche|pois chiches|haricot blanc|haricots blancs|haricot rouge|haricots rouges|haricot noir|haricots noirs|flageolet|flageolets)\b/]
    ];
    return families.find(([,re])=>re.test(t))?.[0]||null;
  }
  if(role==='starch'){
    const families=[
      ['rice',/\b(riz)\b/],['pasta',/\b(pate|pates|spaghetti|nouille|nouilles|vermicelle|macaroni)\b/],
      ['potato',/\b(pomme de terre|pommes de terre|patate douce|patates douces)\b/],
      ['semolina',/\b(semoule|boulgour|couscous grain|millet|polenta)\b/],['quinoa',/\b(quinoa|sarrasin)\b/],
      ['bread',/\b(pain)\b/],['plantain',/\b(plantain|banane plantain)\b/],['oats_barley',/\b(avoine|orge)\b/]
    ];
    return families.find(([,re])=>re.test(t))?.[0]||null;
  }
  if(role==='vegetable'){
    if(/\b(graine|graines|semence|huile|vinaigre|concentre|concentree)\b/.test(t))return null;
    const families=[
      ['zucchini',/\b(courgette|courgettes)\b/],['eggplant',/\b(aubergine|aubergines)\b/],['tomato',/\b(tomate|tomates)\b/],
      ['carrot',/\b(carotte|carottes)\b/],['pepper',/\b(poivron|poivrons)\b/],['broccoli',/\b(brocoli|brocolis)\b/],
      ['cabbage',/\b(chou|choux)\b/],['spinach',/\b(epinard|epinards|blette|blettes)\b/],['green_bean',/\b(haricot vert|haricots verts)\b/],
      ['mushroom',/\b(champignon|champignons)\b/],['leek',/\b(poireau|poireaux)\b/],['squash',/\b(courge|courges|potiron|potimarron)\b/],
      ['fennel',/\b(fenouil)\b/],['beet',/\b(betterave|betteraves)\b/],['turnip',/\b(navet|navets)\b/],
      ['asparagus',/\b(asperge|asperges)\b/],['artichoke',/\b(artichaut|artichauts)\b/],['endive',/\b(endive|endives)\b/]
    ];
    return families.find(([,re])=>re.test(t))?.[0]||null;
  }
  return null;
}
function ciqualAssemblySanity(food,role){
  const t=norm([food?.display_name,food?.name].join(' '));
  const autoAssemblyReject=/\b(nuggets?|croquettes?|pane(?:e|es|s)?|panes?|charcuteries?|cordons? bleus?|saucisses?|merguez|boudins?|rillettes?|terrines?|quenelles?|hot dogs?|knacks?|specialite de fruits?|melange de fruits?|preparation a base de|substitut|poudre|farine|fecule|amidon|chapelure|graines?|semences?)\b/;
  if(autoAssemblyReject.test(t))return false;
  // Un aliment peut rester visible au cerveau sans être autorisé comme composant
  // principal d'une assiette. Cette barrière protège l'assembleur même si une
  // future classification backend dérive.
  const aromatic=/\b(ail|oignon|echalote|basilic|persil|coriandre|ciboulette|menthe|aneth|thym|romarin|origan|herbe|epice|vinaigre|cornichon|pickle|capre)\b/;
  const dairy=/\b(fromages?|fromage blanc|camemberts?|emmentals?|comtes?|chevres?|bries?|mozzarellas?|fetas?|ricottas?|yaourts?|skyrs?|lait)\b/;
  const condiment=/\b(huile|beurre|margarine|mayonnaise|sauce|vinaigrette|sel|sucre|sirop|miel|bouillon)\b/;
  const sweet=/\b(gateau|biscuit|bonbon|chocolat|glace|dessert|viennoiserie|croissant)\b/;
  if(aromatic.test(t)||condiment.test(t)||sweet.test(t))return false;
  // Un laitage peut être un accompagnement, mais jamais l'un des trois piliers
  // protéine/féculent/légume de l'assembleur.
  if(dairy.test(t))return false;
  if(role==='starch'&&/\b(ail|oignons?|echalotes?|basilic|persil|coriandre|fruits?|fromages?|yaourts?|skyrs?|lait|graines?|semences?|farine|fecule|amidon|chapelure|chips|biscuits?)\b/.test(t))return false;
  if(role==='vegetable'&&/\b(ail|oignons?|echalotes?|basilic|persil|coriandre|ciboulette|menthe|aneth|thym|romarin|origan|vinaigre|graines?|semences?|jus|concentre|concentree|marinade|pickle|cornichons?)\b/.test(t))return false;
  return !!ciqualAssemblyFamily(food,role);
}

function ciqualCompositeFamily(food){
  const t=norm([food?.display_name,food?.name].join(' '));
  const known=['paella','cassoulet','hachis','moussaka','choucroute','bourguignon','chili','curry','tajine','risotto','ravioli','quiche','gratin','sandwich','burger','wrap','couscous','lasagne','potee'];
  return known.find(x=>t.includes(x))||t.split(' ').filter(x=>x.length>2).slice(0,6).join('_')||'composite';
}
function candidateSemanticSignature(r){
  if(r?._semanticSignature)return String(r._semanticSignature);
  const keys=Array.isArray(r?._componentKeys)?r._componentKeys.filter(Boolean).map(String).sort():[];
  if(keys.length)return `components:${keys.join('|')}`;
  return `title:${norm(r?.title||r?.recipe_id||'unknown')}`;
}

function ciqualComponentQuality(food,role){
  const t=norm([food?.display_name,food?.name].join(' '));
  const p=Number(food?.protein_100g)||0,c=Number(food?.carbs_100g)||0,f=Number(food?.fiber_100g)||0,k=Number(food?.kcal_100g)||0;
  let q=0.72;
  if(role==='protein'||role==='protein_plant'){
    q+=clamp(p/28,0,0.25);
    if(/\b(nuggets?|croquettes?|pane(?:e|es|s)?|panes?|charcuteries?|saucisses?|merguez|cordons? bleus?|boudins?|rillettes?|terrines?|quenelles?|hot dogs?|knacks?)\b/.test(t))q-=0.30;
    if(/\b(foie|rognon|abats|tripes)\b/.test(t))q-=0.05;
  }else if(role==='starch'){
    q+=clamp(c/55,0,0.18)+clamp(f/8,0,0.08);
    if(/\b(farine|fecule|fécule|amidon|chapelure|poudre)\b/.test(t))q-=0.35;
  }else if(role==='vegetable'){
    q+=clamp(f/7,0,0.16)+clamp((140-k)/220,0,0.08);
    if(/\b(jus|puree concentree|purée concentrée|conserve au vinaigre|marinade)\b/.test(t))q-=0.20;
  }
  if(/\b(arome|arôme|extrait|poudre|deshydrate|déshydraté|assaisonnement)\b/.test(t))q-=0.20;
  return clamp(q,0,1);
}
function ciqualAssemblyQuality(protein,starch,veg){
  const qp=ciqualComponentQuality(protein,String(protein?.role||'protein'));
  const qs=ciqualComponentQuality(starch,'starch');
  const qv=ciqualComponentQuality(veg,'vegetable');
  if(Math.min(qp,qs,qv)<0.56)return 0;
  const texts=[protein,starch,veg].map(x=>norm([x?.display_name,x?.name].join(' ')));
  const processed=texts.filter(t=>/\b(preemballe|préemballé|nuggets?|croquettes?|pane(?:e|es|s)?|panes?|charcuteries?|saucisses?|merguez|cordons? bleus?|boudins?|rillettes?|terrines?|quenelles?|sauce|specialite|spécialité)\b/.test(t)).length;
  let q=(qp+qs+qv)/3;
  if(processed>=2)q-=0.12;
  const tokenSets=texts.map(t=>new Set(t.split(' ').filter(x=>x.length>3)));
  let overlap=0;
  for(let i=0;i<tokenSets.length;i++)for(let j=i+1;j<tokenSets.length;j++){
    const a=tokenSets[i],b=tokenSets[j];
    overlap+= [...a].filter(x=>b.has(x)).length;
  }
  if(overlap>=3)q-=0.10;
  return clamp(q,0,1);
}
function isEligibleCiqualAssembly(r){
  return String(r?._meta?.source_kind||'')==='assembled_ciqual' && Number(r?._assemblyQuality||0)>=0.78;
}
function ciqualReservoir(universe,role,memoryState,seed,excludeNorm,max=60){
  const arr=universe.filter(x=>String(x?.role||'')===role && ciqualAssemblySanity(x,role) && !matchesAnyExcludedTerm(x?.name||'',excludeNorm));
  return arr.map(x=>{
    const mem=ciqualMemoryAffinity(x,memoryState),quality=ciqualGeneralQuality(x);
    const rot=stableUnit(`${seed}|${x.ciqual_code}`);
    return {x,score:quality+(memoryState?.active?mem*2.4:0)+rot*0.9};
  }).sort((a,b)=>b.score-a.score||String(a.x.name).localeCompare(String(b.x.name),'fr')).slice(0,max).map(z=>z.x);
}
function buildCiqualPriceMap(rows){
  return new Map((Array.isArray(rows)?rows:[]).map(x=>[String(x.ciqual_code),x.price||null]));
}

function curatedTechniqueV48941(row){
  const t=norm([row?.title,row?.seasoning_note].join(' '));
  if(/grill|brais|four|roti/.test(t))return 'roast_grill';
  if(/mijot|ragout|tajine|curry|mafe|ndole|sauce|moambe|cassoulet|bourguignon/.test(t))return 'stew';
  if(/salade|crudite|ceviche/.test(t))return 'cold_plate';
  if(/soupe|harira|pho/.test(t))return 'soup';
  if(/pate|pasta|nouille|soba|spaghetti/.test(t))return 'pasta_noodle';
  return 'mixed';
}
function curatedProteinFamilyV48941(component){
  const role=String(component?.role||'');
  const actual=String(component?.resolved_role||'');
  const name=norm([component?.resolved_name,component?.name].join(' '));
  if(role==='dairy_protein'||actual==='dairy')return 'dairy';
  if(role==='protein_plant'||actual==='protein_plant')return 'plant';
  if(/\b(saumon|truite|thon|cabillaud|colin|merlu|poisson|crevette|moule|calamar|sardine|maquereau)\b/.test(name))return 'fish_seafood';
  if(/\b(poulet|dinde|canard|volaille)\b/.test(name))return 'poultry';
  if(/\b(boeuf|veau)\b/.test(name))return 'beef';
  if(/\b(porc|jambon)\b/.test(name))return 'pork';
  if(/\b(agneau|mouton)\b/.test(name))return 'lamb';
  if(/\b(oeuf|oeufs)\b/.test(name))return 'egg';
  return 'other';
}
function curatedStarchFamilyV48941(component){
  const name=norm([component?.resolved_name,component?.name].join(' '));
  if(/\b(riz)\b/.test(name))return 'rice';
  if(/\b(pate|pates|spaghetti|nouille|nouilles|vermicelle|soba)\b/.test(name))return 'pasta';
  if(/\b(pomme de terre|patate douce)\b/.test(name))return 'potato';
  if(/\b(semoule|boulgour|couscous|millet|polenta)\b/.test(name))return 'semolina';
  if(/\b(quinoa|sarrasin)\b/.test(name))return 'quinoa';
  if(/\b(pain|pita|tortilla)\b/.test(name))return 'bread';
  if(/\b(plantain|banane plantain)\b/.test(name))return 'plantain';
  if(/\b(orge|avoine)\b/.test(name))return 'oats_barley';
  return 'other';
}
function appendUniqueCandidatesV48941(target,incoming){
  const titles=new Set(target.map(x=>norm(x?.title||'')));
  const sigs=new Set(target.map(x=>String(x?._semanticSignature||'')).filter(Boolean));
  let added=0;
  for(const r of Array.isArray(incoming)?incoming:[]){
    const title=norm(r?.title||''),sig=String(r?._semanticSignature||'');
    if((title&&titles.has(title))||(sig&&sigs.has(sig)))continue;
    target.push(r);added++;
    if(title)titles.add(title);
    if(sig)sigs.add(sig);
  }
  return added;
}
async function buildCuratedCandidatesV48941({rows,memoryState,exclude,servings,pantryTokens}){
  const catalog=Array.isArray(rows)?rows:[];
  if(!catalog.length)return {candidates:[],publishedMeals:0,pricedMeals:0};
  const excluded=(Array.isArray(exclude)?exclude:[]).map(norm).filter(Boolean);
  const eligible=[];
  for(const row of catalog){
    const components=Array.isArray(row?.components)?row.components:[];
    if(components.length<3)continue;
    if(components.some(c=>!c?.ciqual_code||!(Number(c?.grams)>0)))continue;
    const text=norm([row?.title,...components.map(c=>c?.name),...components.map(c=>c?.resolved_name)].join(' '));
    if(matchesAnyExcludedTerm(text,excluded))continue;
    eligible.push(row);
  }
  const codes=[...new Set(eligible.flatMap(row=>row.components.map(c=>String(c.ciqual_code))))];
  if(!codes.length)return {candidates:[],publishedMeals:catalog.length,pricedMeals:0};
  const pr=await safeCall(sb.rpc('mt_planner_ciqual_price_batch_v1',{p_ciqual_codes:codes,p_country:'FR',p_region:null}),20000,'Le chiffrage du catalogue culinaire');
  if(pr?.error)return {candidates:[],publishedMeals:catalog.length,pricedMeals:0};
  const priceMap=buildCiqualPriceMap(pr?.data||[]),out=[];
  for(const row of eligible){
    const items=[];let cost=0,valid=true;
    for(const component of row.components){
      const qty=(Number(component?.grams)||0)*servings;
      const p=priceMap.get(String(component.ciqual_code));
      const itemCost=ciqualPriceCost(p,qty);
      // V489.5.3 — intégrité coût : un composant obligatoire d'un repas éditorial
      // doit avoir un coût strictement positif. Une valeur absente/0 ne peut plus
      // être traitée comme si elle était chiffrée.
      if(!(qty>0)||itemCost===null||!(Number(itemCost)>0)){valid=false;break}
      cost+=itemCost;
      items.push({
        ingredient_name:component.name||component.resolved_name,
        dictionary_id:null,
        ciqual_code:String(component.ciqual_code),
        quantity_g:qty,
        cost_eur:itemCost,
        optional:false,requires_choice:false,budget_exempt:false,
        resolution_status:'curated_ciqual_resolved_v2'
      });
    }
    if(!valid)continue;
    const id=stableUuidV4891(`TEE-CURATED-V48941|${row.meal_code}`);
    const level=Number(row.discovery_level)||0;
    const meta={
      source_kind:'curated_meal_v48941',
      discovery_level:level,
      normalized_title:norm(row.title),
      food_dictionary_id:null,
      country:row.country||null,
      categories:Array.isArray(row.diet_tags)?row.diet_tags:[]
    };
    const base={
      recipe_id:id,title:row.title,
      subtitle:level===0?'Repas validé · catalogue Méthode TEE':level===1?'Découverte accessible · catalogue Méthode TEE':'Découverte culturelle · catalogue Méthode TEE',
      meal_type:'dinner',mood:'equilibre',
      ingredients:items.map(x=>x.ingredient_name)
    };
    const price={status:'tee_curated_meal_v48941',total_estimated_eur:cost,coverage_pct:100,items};
    const facts=priceFacts(price,pantryTokens instanceof Set?pantryTokens:new Set());
    const traits=fallbackCandidateTraits(base,meta);
    const proteinComponent=row.components.find(c=>['protein','protein_plant','dairy_protein'].includes(String(c.role)));
    const starchComponent=row.components.find(c=>String(c.role)==='starch');
    traits.protein_family=proteinComponent?curatedProteinFamilyV48941(proteinComponent):traits.protein_family;
    traits.starch_family=starchComponent?curatedStarchFamilyV48941(starchComponent):traits.starch_family;
    traits.cuisine_family=row.cuisine_family||'tee_general';
    traits.cooking_technique=curatedTechniqueV48941(row);
    traits.dish_format=String(row.meal_kind||'').includes('soup')?'soup':'plate';
    traits.complete_meal=true;
    traits.leftover_compatible=true;
    traits.traits_source='curated_v48941';
    const affinity=candidateMemoryAffinity(base,memoryState,meta);
    const componentKeys=row.components
      .filter(c=>['protein','protein_plant','dairy_protein','starch','vegetable'].includes(String(c.role)))
      .map(c=>`${c.role}:${norm(c.resolved_name||c.name)}`);
    const editorial=Number(row.editorial_confidence||0.9);
    out.push({
      ...base,_meta:meta,_traits:traits,_haveCount:items.length-facts.total,
      _memoryAffinity:affinity,
      _recentExact:memoryState?.active&&memoryState.recentTitles.has(norm(row.title)),
      _effectiveDiscoveryLevel:level,
      _baseScore:2.6+editorial*1.8+(items.length-facts.total)*4.2,
      _score:2.6+editorial*1.8+(items.length-facts.total)*4.2+coverageReliabilityScore(100),
      _missing:facts.items.map(x=>x.ingredient_name),_price:price,_priceFacts:facts,
      _missingPriceItems:facts.items,_missingDocumentedCost:facts.cost,
      _fullDocumentedCost:cost,
      _curatedCostAudit:{componentCount:row.components.length,pricedComponentCount:items.length,allRequiredPriced:items.length===row.components.length&&items.every(x=>Number(x.cost_eur)>0)},
      _seasoningNote:row.seasoning_note||'',
      _missingPriceCoverage:100,_coverageReliabilityScore:coverageReliabilityScore(100),
      _curatedMeal:true,_componentKeys:componentKeys,
      _componentCodes:items.map(x=>`ciqual:${x.ciqual_code}`),
      _semanticSignature:`curated:${row.semantic_signature}`
    });
  }
  return {candidates:out,publishedMeals:catalog.length,pricedMeals:out.length};
}
async function buildDirectCiqualCompositeCandidatesV48941({memoryState,exclude,servings,generationRound,userId,max=80}){
  const universe=await loadCiqualUniverseV4891();
  if(!universe.length)return {candidates:[],universeCount:0};
  const excluded=(Array.isArray(exclude)?exclude:[]).map(norm).filter(Boolean);
  const pool=universe.filter(f=>{
    if(String(f?.role||'')!=='composite')return false;
    const text=norm([f?.display_name,f?.name].join(' '));
    return !matchesAnyExcludedTerm(text,excluded);
  }).map(f=>{
    const base={title:shortCiqualName(f.display_name||f.name),ingredients:[f.display_name||f.name]};
    const affinity=candidateMemoryAffinity(base,memoryState,{source_kind:'ciqual_composite_dynamic',categories:f.categories||[],country:f.country||null});
    const rot=stableUnit(`V48941|${userId}|${generationRound}|${f.ciqual_code}`);
    return {f,score:ciqualGeneralQuality(f)+(memoryState?.active?affinity*1.8:0)+rot*.7};
  }).sort((a,b)=>b.score-a.score).slice(0,Math.max(30,max));
  const codes=pool.map(x=>String(x.f.ciqual_code));
  const pr=await safeCall(sb.rpc('mt_planner_ciqual_price_batch_v1',{p_ciqual_codes:codes,p_country:'FR',p_region:null}),18000,'Le chiffrage des plats CIQUAL complets');
  if(pr?.error)return {candidates:[],universeCount:universe.length};
  const priceMap=buildCiqualPriceMap(pr?.data||[]),out=[];
  for(const {f} of pool){
    const c=dynamicCandidateFromComposite(f,priceMap.get(String(f.ciqual_code)),servings,memoryState);
    if(c)out.push(c);
    if(out.length>=max)break;
  }
  return {candidates:out,universeCount:universe.length};
}
function dynamicCandidateFromComposite(food,price,servings,memoryState){
  const qty=ciqualRolePortion(food)*servings,cost=ciqualPriceCost(price,qty);
  if(cost===null)return null;
  const title=shortCiqualName(food.display_name||food.name),id=stableUuidV4891(`CIQUAL-COMPOSITE|${food.ciqual_code}`);
  const meta={source_kind:'ciqual_composite_dynamic',discovery_level:0,normalized_title:norm(title),food_dictionary_id:food.food_dictionary_id||null,country:food.country||null,categories:Array.isArray(food.categories)?food.categories:[]};
  const base={recipe_id:id,title,subtitle:'Référence CIQUAL · plat composé',meal_type:'dinner',mood:'equilibre',ingredients:[food.display_name||food.name]};
  const item={ingredient_name:food.display_name||food.name,dictionary_id:food.food_dictionary_id||null,ciqual_code:food.ciqual_code,quantity_g:qty,cost_eur:cost,optional:false,requires_choice:false,budget_exempt:false,resolution_status:'ciqual_component_price'};
  const p={status:'tee_ciqual_composite_v1',total_estimated_eur:cost,coverage_pct:100,items:[item]};
  const facts={items:[item],known:[item],cost,coverage:100,total:1,priced:1};
  const traits=fallbackCandidateTraits(base,meta);traits.leftover_compatible=false;traits.traits_source='ciqual_dynamic';
  const affinity=candidateMemoryAffinity(base,memoryState,meta);
  const family=`composite:${ciqualCompositeFamily(food)}`;
  return {...base,_meta:meta,_traits:traits,_haveCount:0,_memoryAffinity:affinity,_recentExact:memoryState?.active&&memoryState.recentTitles.has(norm(title)),_effectiveDiscoveryLevel:0,_baseScore:0.8,_score:0.8+coverageReliabilityScore(100),_missing:[],_price:p,_priceFacts:facts,_missingPriceItems:[item],_missingDocumentedCost:cost,_missingPriceCoverage:100,_coverageReliabilityScore:coverageReliabilityScore(100),_dynamicCiqual:true,_componentKeys:[family],_componentCodes:[`ciqual:${food.ciqual_code}`],_semanticSignature:family};
}
function dynamicCandidateFromParts(protein,starch,veg,priceMap,servings,memoryState){
  const parts=[protein,starch,veg],items=[],names=[],codes=[];
  let cost=0;
  for(const f of parts){
    const qty=ciqualRolePortion(f)*servings,p=priceMap.get(String(f.ciqual_code)),c=ciqualPriceCost(p,qty);
    if(c===null)return null;
    cost+=c;codes.push(f.ciqual_code);names.push(shortCiqualName(f.display_name||f.name));
    items.push({ingredient_name:f.display_name||f.name,dictionary_id:f.food_dictionary_id||null,ciqual_code:f.ciqual_code,quantity_g:qty,cost_eur:c,optional:false,requires_choice:false,budget_exempt:false,resolution_status:'ciqual_component_price'});
  }
  const families=[ciqualAssemblyFamily(protein,String(protein?.role||'protein')),ciqualAssemblyFamily(starch,'starch'),ciqualAssemblyFamily(veg,'vegetable')];
  if(families.some(x=>!x))return null;
  const familyKeys=[`protein:${families[0]}`,`starch:${families[1]}`,`vegetable:${families[2]}`];
  const semanticSignature=`assembly:${familyKeys.join('|')}`;
  const title=`${names[0]}, ${names[1]} et ${names[2]}`;
  const id=stableUuidV4891(`TEE-ASSEMBLED|${codes.join('|')}`);
  const quality=ciqualAssemblyQuality(protein,starch,veg);
  if(quality<0.78)return null;
  const categories=[...new Set(parts.flatMap(f=>Array.isArray(f.categories)?f.categories:[]))];
  const meta={source_kind:'assembled_ciqual',discovery_level:0,normalized_title:norm(title),food_dictionary_id:null,country:null,categories};
  const base={recipe_id:id,title,subtitle:'Assiette composée par TEE · références CIQUAL',meal_type:'dinner',mood:'equilibre',ingredients:parts.map(f=>f.display_name||f.name)};
  const p={status:'tee_ciqual_assembled_v1',total_estimated_eur:cost,coverage_pct:100,items};
  const facts={items,known:items,cost,coverage:100,total:items.length,priced:items.length};
  const traits=fallbackCandidateTraits(base,meta);traits.leftover_compatible=false;traits.dish_format='plate';traits.cooking_technique='mixed';traits.complete_meal=true;traits.traits_source='ciqual_assembled';
  const affinity=candidateMemoryAffinity(base,memoryState,meta);
  return {...base,_meta:meta,_traits:traits,_haveCount:0,_memoryAffinity:affinity,_recentExact:memoryState?.active&&memoryState.recentTitles.has(norm(title)),_effectiveDiscoveryLevel:0,_baseScore:1.0+quality*0.35,_score:1.0+quality*0.35+coverageReliabilityScore(100),_missing:[],_price:p,_priceFacts:facts,_missingPriceItems:items,_missingDocumentedCost:cost,_missingPriceCoverage:100,_coverageReliabilityScore:coverageReliabilityScore(100),_dynamicCiqual:true,_assemblyQuality:quality,_componentKeys:familyKeys,_componentCodes:codes.map(c=>`ciqual:${c}`),_semanticSignature:semanticSignature};
}
async function buildDynamicCiqualCandidatesV4891({memoryState,exclude,budget,budgetMode,servings,generationRound,userId}){
  const universe=await loadCiqualUniverseV4891();
  if(!universe.length)return {candidates:[],universeCount:0,pricedComponents:0};
  const excludeNorm=exclude.map(norm).filter(Boolean),seed=`${userId}|${isoWeekKey()}|${budget}|${budgetMode}|${generationRound}`;
  const roles={
    protein:[...ciqualReservoir(universe,'protein',memoryState,seed,excludeNorm,55),...ciqualReservoir(universe,'protein_plant',memoryState,seed,excludeNorm,25)],
    starch:ciqualReservoir(universe,'starch',memoryState,seed,excludeNorm,65),
    vegetable:ciqualReservoir(universe,'vegetable',memoryState,seed,excludeNorm,65),
    composite:ciqualReservoir(universe,'composite',memoryState,seed,excludeNorm,55)
  };
  const codeSet=new Set([...roles.protein,...roles.starch,...roles.vegetable,...roles.composite].map(x=>String(x.ciqual_code)));
  const pr=await safeCall(sb.rpc('mt_planner_ciqual_price_batch_v1',{p_ciqual_codes:[...codeSet],p_country:'FR',p_region:null}),16000,'Le chiffrage des aliments CIQUAL');
  if(pr?.error){console.warn('[TEE V489.1] prix CIQUAL indisponibles',pr.error);return {candidates:[],universeCount:universe.length,pricedComponents:0}}
  const priceMap=buildCiqualPriceMap(pr?.data||[]);
  const usable=f=>ciqualPriceCost(priceMap.get(String(f.ciqual_code)),ciqualRolePortion(f)*servings)!==null;
  const P=roles.protein.filter(usable).slice(0,16),S=roles.starch.filter(usable).slice(0,14),V=roles.vegetable.filter(usable).slice(0,16),C=roles.composite.filter(usable).slice(0,40);
  const out=[];
  C.forEach(f=>{const c=dynamicCandidateFromComposite(f,priceMap.get(String(f.ciqual_code)),servings,memoryState);if(c)out.push(c)});
  const target=budget>0?budget/7:0,combos=[];
  for(const p of P)for(const s of S)for(const v of V){
    const c=dynamicCandidateFromParts(p,s,v,priceMap,servings,memoryState);if(!c)continue;
    const fit=target>0?1-Math.min(1,Math.abs((c._missingDocumentedCost/target)-0.78)):0.5;
    const mem=Number(c._memoryAffinity)||0,rot=stableUnit(`${seed}|${c.recipe_id}`);
    const aq=Number(c._assemblyQuality)||0;
    combos.push({c,score:fit*2.0+aq*2.2+(memoryState?.active?mem*1.35:0)+rot*0.55});
  }
  combos.sort((a,b)=>b.score-a.score||String(a.c.title).localeCompare(String(b.c.title),'fr'));
  out.push(...combos.slice(0,220).map(x=>x.c));
  return {candidates:out,universeCount:universe.length,pricedComponents:P.length+S.length+V.length+C.length};
}
function budgetTier(budget){
  if(!budget)return 'balanced';
  if(budget<=35)return 'economy';
  if(budget<=55)return 'balanced';
  return 'flexible';
}
function coverageReliabilityScore(coverage){
  const c=Number(coverage)||0;
  if(c>=100)return 1.25;
  if(c>=90)return 0.90;
  if(c>=80)return 0.35;
  if(c>=70)return -0.70;
  if(c>=60)return -1.50;
  if(c>=50)return -2.40;
  if(c>=30)return -3.60;
  return -5.00;
}
function isWholeDishCandidate(recipe){
  const p=recipe?._price;
  if(!p)return false;
  if(p.status==='planner_food_whole_dish_v1')return true;
  const items=Array.isArray(p.items)?p.items:[];
  return items.some(i=>i?.resolution_status==='whole_dish_strict'||i?.strict_match_mode==='dictionary_id');
}
function plannerMetaFor(recipe,metaMap){return metaMap.get(String(recipe?.recipe_id||''))||{source_kind:'recipe',discovery_level:0,normalized_title:norm(recipe?.title||'')}}
function memoryMaps(memory){
  const tokenMap=new Map(),categoryMap=new Map(),countryMap=new Map(),recentTitles=new Set(),familiarIds=new Set();
  (Array.isArray(memory?.dominant_tokens)?memory.dominant_tokens:[]).forEach(x=>{const k=norm(x?.token||'');if(k)tokenMap.set(k,Number(x?.score)||0)});
  (Array.isArray(memory?.dominant_categories)?memory.dominant_categories:[]).forEach(x=>{const k=norm(x?.category||'');if(k)categoryMap.set(k,Number(x?.score)||0)});
  (Array.isArray(memory?.dominant_countries)?memory.dominant_countries:[]).forEach(x=>{const k=norm(x?.country_key||x?.country||'');if(k)countryMap.set(k,Number(x?.score)||0)});
  (Array.isArray(memory?.recent_titles)?memory.recent_titles:[]).forEach(x=>{const k=norm(x);if(k)recentTitles.add(k)});
  (Array.isArray(memory?.familiar_dictionary_ids)?memory.familiar_dictionary_ids:[]).forEach(x=>{if(x?.food_dictionary_id)familiarIds.add(String(x.food_dictionary_id))});
  return {tokenMap,categoryMap,countryMap,recentTitles,familiarIds};
}
function candidateMemoryAffinity(recipe,memoryState,meta){
  if(!memoryState?.active)return 0;
  const text=[recipe?.title,recipe?.subtitle,...(Array.isArray(recipe?.ingredients)?recipe.ingredients:[])].join(' ');
  let raw=0,matches=0;
  [...tokens(text)].forEach(t=>{const w=memoryState.tokenMap.get(t)||0;if(w>0){raw+=Math.min(7,w);matches++}});
  let categoryRaw=0;
  (Array.isArray(meta?.categories)?meta.categories:[]).forEach(c=>{categoryRaw+=Math.min(6,memoryState.categoryMap.get(norm(c))||0)});
  const countryKey=norm(meta?.country||'');
  const countryScore=countryKey?(memoryState.countryMap.get(countryKey)||0):0;
  const dictFamiliar=meta?.food_dictionary_id&&memoryState.familiarIds.has(String(meta.food_dictionary_id));
  return Math.min(4.6,raw*0.11)+Math.min(0.9,categoryRaw*0.035)+Math.min(1.8,countryScore*0.18)+(dictFamiliar?1.2:0)+(matches>=3?0.45:0);
}
function effectiveDiscoveryLevel(recipe,memoryState,meta){
  let level=clamp(Number(meta?.discovery_level)||0,0,2);
  if(!memoryState?.active||level===0)return level;
  const affinity=candidateMemoryAffinity(recipe,memoryState,meta);
  const countryScore=memoryState.countryMap.get(norm(meta?.country||''))||0;
  const familiar=meta?.food_dictionary_id&&memoryState.familiarIds.has(String(meta.food_dictionary_id));
  if(familiar||countryScore>=7||affinity>=3.8)level=Math.max(0,level-1);
  if(countryScore>=12||affinity>=5.2)level=0;
  return level;
}
function budgetFitValue(recipe,tier,target){
  const cost=Number(recipe?._missingDocumentedCost)||0;
  if(!target||!cost)return 0.35;
  const ratio=cost/target;
  if(tier==='economy'){
    // Budget serré : préférence franche pour les plats sous le repère/jour,
    // sans forcer artificiellement le moins cher de tous.
    return clamp(1.15-ratio,0,1.15);
  }
  if(tier==='balanced'){
    // Budget intermédiaire : on exploite réellement le budget disponible.
    // Le coeur est autour de 65–85 % du repère/jour.
    return clamp(1-Math.abs(ratio-0.72)/0.72,0,1);
  }
  // Budget souple : on autorise des plats plus chers, sans chercher à dépenser.
  return clamp(1-Math.abs(ratio-0.88)/0.88,0,1);
}
function budgetCorePool(pool,tier,target){
  const arr=Array.isArray(pool)?pool:[];
  if(!target||arr.length<5)return arr;
  let core=[];
  if(tier==='economy'){
    core=arr.filter(r=>{
      const c=Number(r?._missingDocumentedCost)||0;
      return c>0&&c<=target*1.08;
    });
  }else if(tier==='balanced'){
    core=arr.filter(r=>{
      const c=Number(r?._missingDocumentedCost)||0;
      return c>0&&c>=target*0.50&&c<=target*1.08;
    });
  }else{
    core=arr.filter(r=>{
      const c=Number(r?._missingDocumentedCost)||0;
      return c>0&&c>=target*0.38&&c<=target*1.22;
    });
  }
  // Un band budgétaire ne doit jamais appauvrir dangereusement le catalogue.
  return core.length>=5?core:arr;
}
function profileGuidedPool(pool,memoryState,tier,target){
  if(!memoryState?.active)return [];
  const base=budgetCorePool(pool,tier,target).filter(r=>!r?._recentExact);
  if(!base.length)return [];

  const ranked=base.map(r=>({
      r,
      aff:Number(r?._memoryAffinity)||0,
      rank:Number(r?._memoryRank)||0,
      fit:budgetFitValue(r,tier,target)
    }))
    .sort((a,b)=>{
      const sa=a.rank*0.72+a.fit*0.28;
      const sb=b.rank*0.72+b.fit*0.28;
      return sb-sa || b.aff-a.aff || String(a.r?.title||'').localeCompare(String(b.r?.title||''),'fr');
    });

  // Il faut un signal personnel réel : sinon on laisse le moteur budget/variété
  // fonctionner plutôt que de prétendre personnaliser.
  if((ranked[0]?.aff||0)<0.22 && (ranked[0]?.rank||0)<0.62)return [];

  // Un vrai sous-pool : 5 à 6 voisins maximum. Avant, jusqu'à 10 candidats
  // finissaient par recréer presque exactement la semaine générique.
  const wanted=Math.min(6,Math.max(4,Math.ceil(base.length*0.32)));
  return ranked.slice(0,wanted).map(x=>x.r);
}
function plannedOpenMemorySlot(index){
  // 5 choix profilés + 2 respirations. Les slots ouverts restent soumis
  // au budget et à la fiabilité, mais la mémoire y pèse beaucoup moins.
  return index===4||index===5;
}


// ---------------------------------------------------------------------------
// V489.0 — moteur déterministe global de semaine
// ---------------------------------------------------------------------------
function stableUnit(value){return (stableHash32(value,2166136261)%100000)/100000}
function isoWeekKey(date=new Date()){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week=Math.ceil((((d-yearStart)/86400000)+1)/7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}
function recommendationHistoryMaps(history){
  const map=new Map(),componentMap=new Map(),signatureMap=new Map();
  (Array.isArray(history?.items)?history.items:[]).forEach(x=>{
    if(x?.candidate_id)map.set(String(x.candidate_id),x);
    if(x?.candidate_signature)signatureMap.set(String(x.candidate_signature),x);
  });
  (Array.isArray(history?.signature_counts)?history.signature_counts:[]).forEach(x=>{
    if(x?.candidate_signature)signatureMap.set(String(x.candidate_signature),x);
  });
  (Array.isArray(history?.component_counts)?history.component_counts:[]).forEach(x=>{
    if(x?.component_key)componentMap.set(String(x.component_key),x);
  });
  const recentGenerations=Array.isArray(history?.recent_generations)?history.recent_generations:[];
  let lastGenerationIds=new Set(),lastGenerationComponentKeys=new Set(),lastGenerationSignatures=new Set();
  if(recentGenerations.length){
    const g=recentGenerations[0]||{};
    (Array.isArray(g.candidate_ids)?g.candidate_ids:[]).forEach(x=>{if(x)lastGenerationIds.add(String(x))});
    (Array.isArray(g.component_keys)?g.component_keys:[]).forEach(x=>{if(x)lastGenerationComponentKeys.add(String(x))});
    (Array.isArray(g.candidate_signatures)?g.candidate_signatures:[]).forEach(x=>{if(x)lastGenerationSignatures.add(String(x))});
  }else{
    // Fallback V1 : tous les candidats portant le timestamp le plus récent
    // appartiennent en pratique à la dernière génération (now() est stable
    // pendant l'INSERT serveur). Tolérance 2 s pour les anciens historiques.
    const arr=[...map.values()].filter(x=>x?.last_seen).sort((a,b)=>new Date(b.last_seen)-new Date(a.last_seen));
    if(arr.length){
      const newest=new Date(arr[0].last_seen).getTime();
      arr.forEach(x=>{
        const t=new Date(x.last_seen).getTime();
        if(Number.isFinite(t)&&Math.abs(newest-t)<=2000&&x?.candidate_id)lastGenerationIds.add(String(x.candidate_id));
      });
    }
  }
  return {
    map,componentMap,signatureMap,recentGenerations,lastGenerationIds,lastGenerationComponentKeys,lastGenerationSignatures,
    generationsThisWeek:Number(history?.generations_this_week||0)
  };
}
function applyLocalGenerationHistory(bundle,plan){
  const now=new Date().toISOString();
  const ids=new Set(),components=new Set(),signatures=new Set();
  (Array.isArray(plan)?plan:[]).forEach(x=>{
    if(!x?.recipe||x.leftover)return;
    const key=String(x.recipe.recipe_id||'');
    if(!key)return;
    ids.add(key);
    const signature=candidateSemanticSignature(x.recipe);
    signatures.add(signature);
    const old=bundle.map.get(key)||{};
    bundle.map.set(key,{
      ...old,candidate_id:key,candidate_title:x.recipe.title,last_seen:now,
      times_7d:Number(old.times_7d||0)+1,
      times_28d:Number(old.times_28d||0)+1,
      times_window:Number(old.times_window||0)+1
    });
    const oldSignature=bundle.signatureMap.get(signature)||{};
    bundle.signatureMap.set(signature,{
      ...oldSignature,candidate_signature:signature,candidate_title:x.recipe.title,last_seen:now,
      times_7d:Number(oldSignature.times_7d||0)+1,
      times_28d:Number(oldSignature.times_28d||0)+1,
      times_window:Number(oldSignature.times_window||0)+1
    });
    (Array.isArray(x.recipe._componentKeys)?x.recipe._componentKeys:[]).forEach(k=>{
      if(!k)return;
      const ck=String(k); components.add(ck);
      const prev=bundle.componentMap.get(ck)||{};
      bundle.componentMap.set(ck,{
        ...prev,component_key:ck,last_seen:now,
        times_7d:Number(prev.times_7d||0)+1,
        times_28d:Number(prev.times_28d||0)+1,
        times_window:Number(prev.times_window||0)+1
      });
    });
  });
  bundle.lastGenerationIds=ids;
  bundle.lastGenerationComponentKeys=components;
  bundle.lastGenerationSignatures=signatures;
  bundle.generationsThisWeek=Number(bundle.generationsThisWeek||0)+1;
}
function componentRotationPenalty(candidate,componentMap){
  const keys=Array.isArray(candidate?._componentKeys)?candidate._componentKeys:[];
  if(!keys.length||!componentMap)return 0;
  let p=0;
  keys.forEach(k=>{
    const h=componentMap.get(String(k));
    if(!h)return;
    const age=h.last_seen?Math.max(0,(Date.now()-new Date(h.last_seen).getTime())/86400000):999;
    if(age<1.5)p-=1.8;
    else if(age<7)p-=0.9;
    p-=Math.min(1.8,Number(h.times_7d||0)*0.35);
  });
  return p;
}
function countLastComponentOverlap(candidate,lastKeys){
  if(!lastKeys?.size)return 0;
  return (Array.isArray(candidate?._componentKeys)?candidate._componentKeys:[])
    .filter(k=>lastKeys.has(String(k))).length;
}
function recommendationPenalty(candidate,historyMap){
  const h=historyMap.get(String(candidate?.recipe_id||''));
  if(!h)return 0;
  const t7=Number(h.times_7d||0),t28=Number(h.times_28d||0);
  const age=h.last_seen?Math.max(0,(Date.now()-new Date(h.last_seen).getTime())/86400000):999;
  let p=0;
  if(age<1.5)p-=7.0;
  else if(age<7)p-=4.2;
  else if(age<14)p-=2.2;
  else if(age<28)p-=1.0;
  p-=Math.min(5,t7*1.25);
  p-=Math.min(2.5,Math.max(0,t28-t7)*0.35);
  return p;
}
function emptyPlannerFeedbackV4896(){return {rejected:new Set(),replaced:new Map(),rows:new Map(),remote:false}}
function plannerFeedbackStorageKeyV4896(userId){return `mtPlannerFeedbackV48961:${String(userId||'anonymous')}`}
function normalizePlannerFeedbackRowsV4896(rows){
  const state=emptyPlannerFeedbackV4896();
  (Array.isArray(rows)?rows:[]).forEach(row=>{
    const id=String(row?.candidate_id||'');if(!id)return;
    const replacementCount=Math.max(0,Number(row?.replacement_count??(row?.signal==='replaced'?row?.feedback_count:0))||0);
    const rejected=Boolean(row?.is_rejected??(row?.signal==='rejected'));
    const signal=rejected?'rejected':'replaced';
    const normalized={...row,candidate_id:id,signal,feedback_count:Math.max(1,Number(row?.feedback_count)||Math.max(1,replacementCount)),replacement_count:replacementCount,is_rejected:rejected};
    const previous=state.rows.get(id);
    if(!previous||String(normalized.updated_at||'')>=String(previous?.updated_at||''))state.rows.set(id,normalized);
  });
  state.rows.forEach(row=>{
    const id=String(row.candidate_id);
    if(row.is_rejected)state.rejected.add(id);
    if(Number(row.replacement_count||0)>0)state.replaced.set(id,Number(row.replacement_count||0));
  });
  return state;
}
function mergePlannerFeedbackV4896(...states){
  const rows=[];
  states.forEach(state=>state?.rows?.forEach(row=>rows.push(row)));
  const merged=normalizePlannerFeedbackRowsV4896(rows);
  merged.remote=states.some(x=>x?.remote);
  return merged;
}
function loadLocalPlannerFeedbackV4896(userId){
  try{
    const current=JSON.parse(localStorage.getItem(plannerFeedbackStorageKeyV4896(userId))||'[]');
    const legacy=current.length?[]:JSON.parse(localStorage.getItem(`mtPlannerFeedbackV4896:${String(userId||'anonymous')}`)||'[]');
    return normalizePlannerFeedbackRowsV4896(current.length?current:legacy);
  }catch(_){return emptyPlannerFeedbackV4896()}
}
function persistLocalPlannerFeedbackV4896(userId,state){
  try{
    const all=[...state.rows.values()];
    const rejected=all.filter(x=>x?.is_rejected||x?.signal==='rejected');
    const replaced=all.filter(x=>!(x?.is_rejected||x?.signal==='rejected'))
      .sort((a,b)=>String(b?.updated_at||'').localeCompare(String(a?.updated_at||''))).slice(0,500);
    const keep=new Map();
    [...rejected,...replaced].forEach(x=>keep.set(String(x.candidate_id),x));
    localStorage.setItem(plannerFeedbackStorageKeyV4896(userId),JSON.stringify([...keep.values()]));
  }catch(_){}
}
async function loadPlannerFeedbackV4896(userId){
  const local=loadLocalPlannerFeedbackV4896(userId);
  let remote=await safeCall(sb.rpc('mt_planner_feedback_list_v2'),6000,'La mémoire de tes choix');
  if(remote?.error)remote=await safeCall(sb.rpc('mt_planner_feedback_list_v1'),6000,'La mémoire de tes choix');
  if(remote?.error)return local;
  const remoteState=normalizePlannerFeedbackRowsV4896(remote?.data||[]);remoteState.remote=true;
  const merged=mergePlannerFeedbackV4896(local,remoteState);persistLocalPlannerFeedbackV4896(userId,merged);return merged;
}
async function recordPlannerFeedbackV4896(userId,state,candidate,signal){
  const id=String(candidate?.recipe_id||'');if(!id)return state;
  const previous=state.rows.get(id);
  const previousReplacement=Math.max(0,Number(previous?.replacement_count??(previous?.signal==='replaced'?previous?.feedback_count:0))||0);
  const rejected=signal==='rejected'||Boolean(previous?.is_rejected);
  const replacementCount=signal==='replaced'?previousReplacement+1:previousReplacement;
  const row={
    candidate_id:id,candidate_title:String(candidate?.title||'').slice(0,180),
    signal:rejected?'rejected':'replaced',feedback_count:Math.max(1,(Number(previous?.feedback_count)||0)+1),
    replacement_count:replacementCount,is_rejected:rejected,updated_at:new Date().toISOString()
  };
  state.rows.set(id,row);
  if(rejected)state.rejected.add(id); else state.rejected.delete(id);
  if(replacementCount>0)state.replaced.set(id,replacementCount); else state.replaced.delete(id);
  persistLocalPlannerFeedbackV4896(userId,state);
  let remote=await safeCall(sb.rpc('mt_planner_feedback_record_v2',{p_candidate_id:id,p_candidate_title:row.candidate_title,p_signal:signal}),5000,'La mémorisation de ton choix');
  if(remote?.error)remote=await safeCall(sb.rpc('mt_planner_feedback_record_v1',{p_candidate_id:id,p_candidate_title:row.candidate_title,p_signal:signal}),5000,'La mémorisation de ton choix');
  if(!remote?.error)state.remote=true;
  return state;
}
async function undoPlannerRejectionV48961(userId,state,candidateId){
  const id=String(candidateId||'');if(!id)return false;
  const row=state.rows.get(id);
  const replacementCount=Math.max(0,Number(row?.replacement_count??(row?.signal==='replaced'?row?.feedback_count:0))||0);
  state.rejected.delete(id);
  if(replacementCount>0){
    state.rows.set(id,{...row,signal:'replaced',is_rejected:false,replacement_count:replacementCount,updated_at:new Date().toISOString()});
    state.replaced.set(id,replacementCount);
  }else{
    state.rows.delete(id);state.replaced.delete(id);
  }
  persistLocalPlannerFeedbackV4896(userId,state);
  const remote=await safeCall(sb.rpc('mt_planner_feedback_unreject_v2',{p_candidate_id:id}),5000,'L’annulation de ton choix');
  if(!remote?.error)state.remote=true;
  return true;
}
function plannerFeedbackPenaltyV4896(candidate,state){
  const id=String(candidate?.recipe_id||'');
  if(state?.rejected?.has(id))return -1000;
  return -Math.min(14,Number(state?.replaced?.get(id)||0)*4.5);
}
function signatureRotationPenalty(candidate,signatureMap){
  if(!signatureMap)return 0;
  const h=signatureMap.get(candidateSemanticSignature(candidate));
  if(!h)return 0;
  const age=h.last_seen?Math.max(0,(Date.now()-new Date(h.last_seen).getTime())/86400000):999;
  let p=age<1.5?-8.5:age<7?-4.8:age<28?-1.8:0;
  p-=Math.min(4,Number(h.times_7d||0)*0.9);
  return p;
}
function wasInLastGeneration(r,ctx){
  return !!(ctx.lastGenerationIds?.has(String(r?.recipe_id||''))||ctx.lastGenerationSignatures?.has(candidateSemanticSignature(r)));
}
function fallbackCandidateTraits(recipe,meta){
  const text=norm([recipe?.title,recipe?.subtitle,recipe?.meal_type,...(Array.isArray(recipe?.ingredients)?recipe.ingredients:[])].join(' '));
  const has=(re)=>re.test(text);
  let protein='mixed_unknown';
  if(has(/\b(boeuf|steak|bourguignon|kefta)\b/))protein='beef';
  else if(has(/\b(poulet|dinde|volaille|chicken|gai)\b/))protein='poultry';
  else if(has(/\b(porc|jambon|saucisse|lardon|lardons|chorizo)\b/))protein='pork';
  else if(has(/\b(poisson|saumon|truite|thon|crevette|crevettes)\b/))protein='fish_seafood';
  else if(has(/\b(oeuf|oeufs)\b/))protein='egg';
  else if(has(/\b(tofu|lentille|lentilles|pois chiche|pois chiches|haricot|haricots)\b/))protein='plant';
  let starch='other_none';
  if(has(/\b(riz|paella)\b/))starch='rice';
  else if(has(/\b(ramen|nouille|nouilles|pate|pates|pasta|pad thai)\b/))starch='pasta_noodle';
  else if(has(/\b(pomme de terre|pommes de terre|hachis)\b/))starch='potato';
  else if(has(/\b(couscous|semoule|boulgour)\b/))starch='semolina_bulgur';
  else if(has(/\b(pain|tartine)\b/))starch='bread';
  else if(has(/\b(plantain|banane plantain)\b/))starch='plantain';
  let technique='mixed',format='plate';
  if(has(/\b(soupe|ramen|harira|tom kha)\b/)){technique='soup';format='soup'}
  else if(has(/\b(bourguignon|cassoulet|potee|mijote|tajine|mafe|yassa)\b/)){technique='stew';format='stew_plate'}
  else if(has(/\b(salade)\b/)){technique='cold_raw';format='salad'}
  else if(has(/\b(bowl)\b/)){format='bowl'}
  else if(has(/\b(frit|frite|friture|tempura)\b/)){technique='fried'}
  else if(has(/\b(grille|grillee|grill)\b/)){technique='grilled'}
  else if(has(/\b(four|gratin|moussaka|hachis)\b/)){technique='baked'}
  const country=norm(meta?.country||'');
  let cuisine='tee_general';
  if(['japon','chine','coree du sud','coree','taiwan'].includes(country))cuisine='east_asia';
  else if(['thailande','vietnam','cambodge','laos','malaisie','singapour','indonesie','philippines'].includes(country))cuisine='southeast_asia';
  else if(['maroc','tunisie','algerie'].includes(country))cuisine='maghreb';
  else if(['senegal','cote d ivoire','mali','ghana','nigeria'].includes(country))cuisine='west_africa';
  else if(['cameroun','rdc','republique democratique du congo','congo'].includes(country))cuisine='central_africa';
  else if(country)cuisine=country;
  return {
    protein_family:protein,starch_family:starch,vegetable_family:'unknown_none',
    dish_format:format,cooking_technique:technique,cuisine_family:cuisine,
    complete_meal:true,leftover_compatible:(meta?.source_kind||'recipe')==='recipe'&&technique!=='cold_raw',
    traits_source:'frontend_fallback'
  };
}
function candidateTraitsFor(recipe,meta,traitMap){
  const t=traitMap.get(String(recipe?.recipe_id||''));
  return t||fallbackCandidateTraits(recipe,meta);
}
function budgetModePolicy(mode){
  if(mode==='save')return {targetRatio:0.62,minRatio:0.30,maxRatio:0.82,hardFloorRatio:0,budgetWeight:15,diversityWeight:0.82,memoryWeight:1.0,label:'Économiser au maximum'};
  if(mode==='variety')return {targetRatio:0.94,minRatio:0.82,maxRatio:1.00,hardFloorRatio:0.82,budgetWeight:28,diversityWeight:1.45,memoryWeight:1.08,label:'Privilégier la variété dans cette enveloppe'};
  // Mode équilibré : si le pool fiable le permet, on évite désormais les
  // semaines artificiellement trop basses (ex. 23 € pour une enveloppe de 45 €).
  // 78 % est un plancher de sélection, pas une obligation de dépense : si aucune
  // semaine cohérente n'atteint ce niveau, le moteur garde la meilleure solution.
  return {targetRatio:0.90,minRatio:0.78,maxRatio:0.99,hardFloorRatio:0.78,budgetWeight:29,diversityWeight:1.10,memoryWeight:1.05,label:'Utiliser raisonnablement mon budget'};
}
function weeklyBudgetScore(cost,budget,policy){
  if(!budget||budget<=0)return 0;
  const ratio=cost/budget;
  if(ratio>1)return -120-(ratio-1)*180;
  if(policy===undefined)policy=budgetModePolicy('balanced');
  if(policy.targetRatio<=0.65){
    // Mode économies : rester nettement sous l'enveloppe est volontaire.
    return 8-clamp(ratio,0,1)*2-Math.max(0,ratio-policy.maxRatio)*45;
  }
  let score=15-Math.abs(ratio-policy.targetRatio)*policy.budgetWeight;
  if(ratio<policy.minRatio)score-=(policy.minRatio-ratio)*38;
  if(ratio>policy.maxRatio)score-=(ratio-policy.maxRatio)*55;
  return score;
}
function candidateIsFamiliar(r,memoryState){
  if(!memoryState?.active)return false;
  return (Number(r?._memoryRank)||0)>=0.58 || (Number(r?._memoryAffinity)||0)>=1.0;
}
function candidateIsFarNovel(r,memoryState){
  if(!memoryState?.active)return false;
  return (Number(r?._memoryRank)||0)<0.28 && (Number(r?._memoryAffinity)||0)<0.38;
}
function isSpecificCulturalCandidate(r){
  // La règle porte sur la hiérarchie éditoriale brute, jamais sur un niveau
  // temporairement abaissé par l'affinité du profil.
  return Number(r?._meta?.discovery_level||0)>=2;
}
function isDynamicCiqualCandidate(r){
  return !!r?._dynamicCiqual || ['assembled_ciqual','ciqual_composite_dynamic'].includes(String(r?._meta?.source_kind||''));
}
function countInc(obj,key){
  const out={...obj};
  const k=String(key||'unknown');
  out[k]=(out[k]||0)+1;
  return out;
}
function countGet(obj,key){return Number(obj?.[String(key||'unknown')]||0)}
function canonicalProteinFamilyV48951(value){
  const v=String(value||'unknown').toLowerCase();
  const map={
    chicken:'poultry',volaille:'poultry',turkey:'poultry',duck:'poultry',poultry:'poultry',
    fish:'fish_seafood',seafood:'fish_seafood','fish-seafood':'fish_seafood',fish_seafood:'fish_seafood',
    vegetarian:'plant',legume:'plant',legumes:'plant',pulse:'plant',pulses:'plant',plant:'plant',
    veal:'beef',beef:'beef',pork:'pork',lamb:'lamb',mutton:'lamb',egg:'egg',eggs:'egg',dairy:'dairy'
  };
  return map[v]||v;
}
function canonicalStarchFamilyV48951(value){
  const v=String(value||'unknown').toLowerCase();
  const map={
    pasta:'pasta_noodle',noodle:'pasta_noodle',noodles:'pasta_noodle',pasta_noodle:'pasta_noodle',
    semolina:'semolina_bulgur',bulgur:'semolina_bulgur',couscous:'semolina_bulgur',semolina_bulgur:'semolina_bulgur',
    potatoes:'potato',sweet_potato:'potato',potato:'potato',
    basmati:'rice',rice:'rice',
    quinoa_buckwheat:'quinoa',buckwheat:'quinoa',quinoa:'quinoa',
    pita:'bread',tortilla:'bread',bread:'bread',
    banana_plantain:'plantain',plantain:'plantain',
    barley:'oats_barley',oats:'oats_barley',oats_barley:'oats_barley'
  };
  return map[v]||v;
}
function canonicalCuisineFamilyV48961(value){
  const v=norm(value||'unknown').replace(/\s+/g,'_');
  const map={
    east_asian:'east_asia',east_asian_inspired:'east_asia',
    east_southeast_asia:'east_southeast_asia',
    southeast_asian:'southeast_asia',southeast_asian_inspired:'southeast_asia',
    south_asian:'south_asia',indian_inspired:'south_asia',
    maghreb:'maghreb',maghreb_inspired:'maghreb',
    west_african:'west_africa',west_african_inspired:'west_africa',west_africa:'west_africa',
    central_african:'central_africa',central_africa:'central_africa',
    east_african:'east_africa',east_africa:'east_africa',
    caribbean:'caribbean',caribbean_inspired:'caribbean',
    latin_american:'latin_america',latin_inspired:'latin_america',
    greek_inspired:'mediterranean',mediterranean:'mediterranean',
    italian_inspired:'southern_europe',southern_europe:'southern_europe',
    french_home:'western_europe',france:'western_europe',western_europe:'western_europe',
    levantine:'middle_east',middle_eastern:'middle_east',
    nordic:'nordic',nordic_inspired:'nordic',
    tee_general:'tee_general',unknown:'unknown'
  };
  return map[v]||v;
}
function countryCuisineFamilyV48961(country){
  const c=norm(country);
  if(!c)return null;
  const groups=[
    ['western_europe',/\b(france|belgique|suisse|allemagne|autriche|pays bas|luxembourg)\b/],
    ['southern_europe',/\b(italie|espagne|portugal)\b/],
    ['mediterranean',/\b(grece|chypre)\b/],
    ['nordic',/\b(suede|norvege|danemark|finlande|islande)\b/],
    ['maghreb',/\b(maroc|algerie|tunisie)\b/],
    ['west_africa',/\b(senegal|cote d ivoire|mali|ghana|nigeria|benin|togo|guinee|burkina faso)\b/],
    ['central_africa',/\b(cameroun|congo|rdc|republique democratique du congo|gabon|centrafrique)\b/],
    ['east_africa',/\b(ethiopie|erythree|kenya|tanzanie|ouganda|rwanda|burundi)\b/],
    ['east_asia',/\b(japon|chine|coree du sud|coree|taiwan)\b/],
    ['southeast_asia',/\b(thailande|vietnam|cambodge|laos|malaisie|singapour|indonesie|philippines)\b/],
    ['south_asia',/\b(inde|pakistan|bangladesh|sri lanka|nepal)\b/],
    ['middle_east',/\b(liban|syrie|jordanie|israel|palestine|turquie|iran|irak)\b/],
    ['caribbean',/\b(martinique|guadeloupe|haiti|jamaique|cuba|republique dominicaine|trinite)\b/],
    ['latin_america',/\b(mexique|bresil|perou|colombie|argentine|chili|equateur|bolivie|venezuela)\b/]
  ];
  for(const [family,re] of groups)if(re.test(c))return family;
  return canonicalCuisineFamilyV48961(c);
}
function familiarCuisineFamiliesV48961(memoryState){
  const out=new Set();
  if(!memoryState?.active||!(memoryState.countryMap instanceof Map)||!memoryState.countryMap.size)return out;
  const ranked=[...memoryState.countryMap.entries()]
    .map(([country,score])=>({country,score:Number(score)||0}))
    .filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  const peak=ranked[0]?.score||0;
  const threshold=Math.max(3,peak*.35);
  ranked.filter(x=>x.score>=threshold).slice(0,5).forEach(x=>{
    const family=countryCuisineFamilyV48961(x.country);
    if(family&&!['unknown','tee_general'].includes(family))out.add(family);
  });
  return out;
}
function canonicalTraitValueV48951(key,value){
  if(key==='protein_family')return canonicalProteinFamilyV48951(value);
  if(key==='starch_family')return canonicalStarchFamilyV48951(value);
  if(key==='cuisine_family')return canonicalCuisineFamilyV48961(value);
  return String(value||'unknown');
}
function traitKey(r,key){
  const raw=r?._traits?.[key]||'unknown';
  if(key==='cuisine_family'){
    const canonical=canonicalCuisineFamilyV48961(raw);
    if(canonical==='east_southeast_asia'){
      const fromCountry=countryCuisineFamilyV48961(r?._meta?.country||'');
      if(['east_asia','southeast_asia'].includes(fromCountry))return fromCountry;
    }
    return canonical;
  }
  return canonicalTraitValueV48951(key,raw);
}
function candidateTrueVarietyKeys(r){
  const text=norm([
    r?.title,r?.subtitle,...(Array.isArray(r?.ingredients)?r.ingredients:[]),
    ...(Array.isArray(r?._componentKeys)?r._componentKeys:[])
  ].join(' '));
  const out=new Set();
  const protein=traitKey(r,'protein_family');
  if(!['mixed_unknown','unknown','other','other_none'].includes(protein))out.add(`protein:${protein}`);
  const starch=traitKey(r,'starch_family');
  if(!['other_none','unknown','other'].includes(starch))out.add(`starch:${starch}`);
  const vegetables=[
    ['broccoli',/\b(brocoli|brocolis)\b/],['tomato',/\b(tomate|tomates)\b/],
    ['carrot',/\b(carotte|carottes)\b/],['zucchini',/\b(courgette|courgettes)\b/],
    ['spinach',/\b(epinard|epinards)\b/],['green_beans',/\b(haricot vert|haricots verts)\b/],
    ['pepper',/\b(poivron|poivrons)\b/],['eggplant',/\b(aubergine|aubergines)\b/],
    ['cabbage',/\b(chou|choux|chou-fleur)\b/],['leek',/\b(poireau|poireaux)\b/],
    ['cucumber',/\b(concombre|concombres)\b/],['mushroom',/\b(champignon|champignons)\b/],
    ['pumpkin',/\b(courge|courges|potiron|potimarron)\b/],['peas',/\b(petit pois|petits pois)\b/],
    ['okra',/\b(gombo|gombos)\b/],['salad',/\b(salade|laitue|roquette)\b/]
  ];
  vegetables.forEach(([family,re])=>{if(re.test(text))out.add(`vegetable:${family}`)});
  return [...out];
}
function trueVarietyCap(key,relaxation){
  const k=String(key||'');
  // V489.5.2 — les familles protéiques animales ne se relâchent plus à 3.
  // Avec 261 repas éditoriaux, 3 poulets différents restent 3 repas au poulet.
  if(k.startsWith('protein:')&&!k.startsWith('protein:plant'))return 2;
  if(k.startsWith('protein:plant'))return relaxation>=2?4:3;
  if(relaxation>=2)return 7;
  if(relaxation===1)return 3;
  return 2;
}
function individualUtilityV489(r,ctx){
  const memoryState=ctx.memoryState;
  let score=clamp(Number(r?._baseScore)||0,-10,10)*0.24;
  score+=plannerFeedbackPenaltyV4896(r,ctx.feedbackState);
  score+=coverageReliabilityScore(Number(r?._missingPriceCoverage)||0)*1.35;
  score+=recommendationPenalty(r,ctx.historyMap);
  score+=signatureRotationPenalty(r,ctx.signatureMap);
  score+=componentRotationPenalty(r,ctx.componentMap);
  if(r?._recentExact)score-=16;
  if(wasInLastGeneration(r,ctx))score-=9.5;
  const compOverlap=countLastComponentOverlap(r,ctx.lastGenerationComponentKeys);
  if(compOverlap>=2)score-=8.0;
  else if(compOverlap===1)score-=2.2;
  if(memoryState?.active){
    const rank=Number(r?._memoryRank)||0;
    const aff=Number(r?._memoryAffinity)||0;
    // Le contexte global personnel calibre la confiance accordée à la mémoire,
    // mais seuls les repas réellement saisis définissent les goûts alimentaires.
    const contextFactor=1+Math.min(0.12,Math.max(0,Number(memoryState.contextConfidence)||0)/100*0.12);
    const weight=(memoryState.strong?1.35:1.05)*ctx.policy.memoryWeight*contextFactor;
    score+=rank*7.2*weight+Math.min(5.5,aff)*1.25*weight;
    if(candidateIsFarNovel(r,memoryState))score-=1.3;
  }
  const discovery=Number(r?._effectiveDiscoveryLevel)||0;
  if(discovery===1)score-=0.55;
  if(discovery===2 && !candidateIsFamiliar(r,memoryState))score-=4.2;
  const rotationSeed=`${ctx.userId}|${ctx.weekKey}|${ctx.budget}|${ctx.budgetMode}|${ctx.generationRound}|${r?.recipe_id}`;
  score+=(stableUnit(rotationSeed)-0.5)*0.7;
  return score;
}
function candidateExpansionPool(candidates,ctx){
  if(candidates.length<=42)return candidates;
  const target=ctx.budget>0?ctx.budget/Math.max(1,ctx.totalSteps):0;
  const dynamic=candidates.filter(isDynamicCiqualCandidate);
  const catalog=candidates.filter(r=>!isDynamicCiqualCandidate(r));
  const byUtility=[...candidates].sort((a,b)=>individualUtilityV489(b,ctx)-individualUtilityV489(a,ctx)).slice(0,14);
  const byMemory=ctx.memoryState?.active?[...candidates].sort((a,b)=>(Number(b._memoryRank)||0)-(Number(a._memoryRank)||0)).slice(0,7):[];
  const byBudgetFit=target?[...candidates].sort((a,b)=>budgetFitValue(b,budgetTier(ctx.budget),target)-budgetFitValue(a,budgetTier(ctx.budget),target)).slice(0,12):[];
  const targetSpendPerMeal=(ctx.budget>0&&ctx.policy?.targetRatio>0)?ctx.budget*ctx.policy.targetRatio/Math.max(1,ctx.totalSteps):target;
  const bySpendFit=targetSpendPerMeal?[...candidates]
    .filter(r=>Number(r?._missingDocumentedCost||0)>0)
    .sort((a,b)=>Math.abs(Number(a?._missingDocumentedCost||0)-targetSpendPerMeal)-Math.abs(Number(b?._missingDocumentedCost||0)-targetSpendPerMeal))
    .slice(0,16):[];
  const byUpperSpend=targetSpendPerMeal?[...candidates]
    .filter(r=>{
      const c=Number(r?._missingDocumentedCost||0);
      return c>=targetSpendPerMeal*0.85&&c<=targetSpendPerMeal*1.45;
    })
    .sort((a,b)=>individualUtilityV489(b,ctx)-individualUtilityV489(a,ctx))
    .slice(0,12):[];
  const byDynamic=[...dynamic].sort((a,b)=>individualUtilityV489(b,ctx)-individualUtilityV489(a,ctx)).slice(0,14);
  const byCurated=[...catalog].filter(r=>r?._curatedMeal).sort((a,b)=>individualUtilityV489(b,ctx)-individualUtilityV489(a,ctx)).slice(0,10);
  const byHistorical=[...catalog].filter(r=>!r?._curatedMeal).sort((a,b)=>individualUtilityV489(b,ctx)-individualUtilityV489(a,ctx)).slice(0,16);
  const byFresh=[...candidates]
    .filter(r=>!wasInLastGeneration(r,ctx))
    .sort((a,b)=>individualUtilityV489(b,ctx)-individualUtilityV489(a,ctx))
    .slice(0,14);
  const byFreshDynamic=[...dynamic]
    .filter(r=>!wasInLastGeneration(r,ctx)&&countLastComponentOverlap(r,ctx.lastGenerationComponentKeys)<2)
    .sort((a,b)=>individualUtilityV489(b,ctx)-individualUtilityV489(a,ctx))
    .slice(0,12);
  const byCheap=[...candidates].sort((a,b)=>(Number(a._missingDocumentedCost)||0)-(Number(b._missingDocumentedCost)||0)).slice(0,5);
  const out=[],seen=new Set();
  [...byFreshDynamic,...byFresh,...bySpendFit,...byUpperSpend,...byCurated,...byHistorical,...byDynamic,...byBudgetFit,...byUtility,...byMemory,...byCheap].forEach(r=>{const k=String(r.recipe_id);if(!seen.has(k)){seen.add(k);out.push(r)}});
  return out.slice(0,ctx.budgetFloorPass?96:64);
}
function budgetFloorExpansionPoolV48952(basePool,ctx){
  if(basePool.length<=220)return [...basePool];
  const slots=Math.max(1,ctx.totalSteps||7);
  const floorMeal=ctx.budget>0?ctx.budget*Number(ctx.policy?.hardFloorRatio||0)/slots:0;
  const targetMeal=ctx.budget>0?ctx.budget*Number(ctx.policy?.targetRatio||0)/slots:0;
  const positive=basePool.filter(r=>Number(r?._missingDocumentedCost||0)>0);
  const byTarget=[...positive].sort((a,b)=>Math.abs(Number(a?._missingDocumentedCost||0)-targetMeal)-Math.abs(Number(b?._missingDocumentedCost||0)-targetMeal)).slice(0,90);
  const byFloor=[...positive].sort((a,b)=>Math.abs(Number(a?._missingDocumentedCost||0)-floorMeal)-Math.abs(Number(b?._missingDocumentedCost||0)-floorMeal)).slice(0,80);
  const bySpend=[...positive].sort((a,b)=>Number(b?._missingDocumentedCost||0)-Number(a?._missingDocumentedCost||0)).slice(0,90);
  const byUtility=[...basePool].sort((a,b)=>individualUtilityV489(b,ctx)-individualUtilityV489(a,ctx)).slice(0,70);
  const byFresh=[...basePool].filter(r=>!wasInLastGeneration(r,ctx)).sort((a,b)=>individualUtilityV489(b,ctx)-individualUtilityV489(a,ctx)).slice(0,70);
  const out=[],seen=new Set();
  [...byTarget,...byFloor,...bySpend,...byFresh,...byUtility].forEach(r=>{const id=String(r?.recipe_id||'');if(id&&!seen.has(id)){seen.add(id);out.push(r)}});
  return out.slice(0,220);
}
function incrementalDiversityV489(state,r,ctx){
  const p=traitKey(r,'protein_family'),s=traitKey(r,'starch_family'),t=traitKey(r,'cooking_technique'),f=traitKey(r,'dish_format'),c=traitKey(r,'cuisine_family');
  const pc=countGet(state.proteinCounts,p),sc=countGet(state.starchCounts,s),tc=countGet(state.techniqueCounts,t),fc=countGet(state.formatCounts,f),cc=countGet(state.cuisineCounts,c);
  let d=0;
  d+=pc===0?0.95:pc===1?-0.35:-1.8;
  if(s!=='other_none'&&s!=='unknown')d+=sc===0?0.70:sc===1?-0.45:-2.1;
  d+=tc===0?0.72:tc===1?-0.25:-1.4;
  d+=fc===0?0.48:fc===1?-0.20:-1.0;
  d+=cc===0?0.52:cc===1?-0.18:-0.9;
  return d*ctx.policy.diversityWeight;
}
function isCuisineThreadV4896(value){
  const c=canonicalCuisineFamilyV48961(value);
  return !['','unknown','tee_general'].includes(c);
}
function activeCuisineThreadsV4896(counts){
  const out=[];
  for(const [raw,count] of Object.entries(counts||{})){
    const k=canonicalCuisineFamilyV48961(raw);
    if(isCuisineThreadV4896(k)&&Number(count||0)>0&&!out.includes(k))out.push(k);
  }
  return out;
}
function activeUnfamiliarCuisineThreadsV48961(counts,familiarSet){
  const familiar=familiarSet instanceof Set?familiarSet:new Set();
  return activeCuisineThreadsV4896(counts).filter(k=>!familiar.has(k));
}
function violatesHardWeekConstraint(state,r,ctx){
  const p=traitKey(r,'protein_family'),s=traitKey(r,'starch_family'),t=traitKey(r,'cooking_technique'),c=traitKey(r,'cuisine_family');
  if(state.used.has(String(r.recipe_id)))return true;
  const signature=candidateSemanticSignature(r);
  if(state.usedSignatures.has(signature))return true;
  const inLast=wasInLastGeneration(r,ctx);
  if(inLast&&state.overlapLast>=ctx.maxImmediateOverlap)return true;
  // Une nouvelle assiette CIQUAL ne doit pas simplement changer la protéine tout
  // en recyclant le même duo féculent+légume de la génération précédente.
  if(isEligibleCiqualAssembly(r)&&ctx.strictDynamicRotation&&countLastComponentOverlap(r,ctx.lastGenerationComponentKeys)>=2)return true;
  // Deux assiettes CIQUAL de la même semaine ne recyclent pas exactement le même
  // composant principal quand suffisamment d'alternatives existent.
  if(isEligibleCiqualAssembly(r)&&ctx.strictDynamicRotation){
    const keys=Array.isArray(r?._componentKeys)?r._componentKeys:[];
    if(keys.some(k=>countGet(state.componentCounts,k)>=1))return true;
  }
  if(isEligibleCiqualAssembly(r)&&state.dynamicCiqualCount>=ctx.dynamicMaximum)return true;
  if(candidateTrueVarietyKeys(r).some(k=>countGet(state.trueVarietyCounts,k)>=trueVarietyCap(k,ctx.varietyRelaxation)))return true;
  if(p==='beef'&&countGet(state.proteinCounts,p)>=(ctx.varietyRelaxation?3:2))return true;
  if(s!=='other_none'&&s!=='unknown'&&countGet(state.starchCounts,s)>=(ctx.varietyRelaxation?3:2))return true;
  if(t==='stew'&&state.lastTechnique==='stew')return true;
  if(c!=='tee_general'&&countGet(state.cuisineCounts,c)>=3)return true;
  // V489.6.1 — aucun socle occidental implicite. Le socle culinaire vient
  // uniquement des pays réellement présents dans la mémoire alimentaire.
  // Sans mémoire exploitable, toutes les cuisines sont traitées à égalité.
  const familiarCuisines=ctx.familiarCuisineFamilies instanceof Set?ctx.familiarCuisineFamilies:new Set();
  const totalThreads=activeCuisineThreadsV4896(state.cuisineCounts);
  const unfamiliarThreads=activeUnfamiliarCuisineThreadsV48961(state.cuisineCounts,familiarCuisines);
  const isNewThread=isCuisineThreadV4896(c)&&countGet(state.cuisineCounts,c)===0;
  const isFamiliarThread=familiarCuisines.has(canonicalCuisineFamilyV48961(c));
  if(isNewThread){
    const maxNeutralThreads=ctx.varietyRelaxation>=2?4:3;
    const maxUnfamiliarThreads=ctx.varietyRelaxation>=2?3:2;
    const maxTotalThreads=ctx.varietyRelaxation>=2?5:4;
    if(!familiarCuisines.size&&totalThreads.length>=maxNeutralThreads)return true;
    if(familiarCuisines.size&&!isFamiliarThread&&unfamiliarThreads.length>=maxUnfamiliarThreads)return true;
    if(totalThreads.length>=maxTotalThreads)return true;
  }
  // V489.2.1 : maximum absolu d'un plat classé « culturel spécifique ».
  // La familiarité peut améliorer son score, mais ne contourne plus cette règle.
  if(isSpecificCulturalCandidate(r)&&state.specificCultural>=1)return true;
  const discovery=Number(r?._effectiveDiscoveryLevel)||0;
  if(discovery===2&&state.specificDiscovery>=1&&!candidateIsFamiliar(r,ctx.memoryState))return true;
  if(ctx.memoryState?.active&&candidateIsFarNovel(r,ctx.memoryState)&&state.farNovel>=1)return true;
  return false;
}
function makeNextStateV489(state,r,ctx,dayIndex,isLeftover=false){
  const cost=Number(r?._missingDocumentedCost)||0;
  const nextCost=state.cost+cost;
  if(ctx.budget>0&&nextCost>ctx.budget*1.001)return null;
  const p=traitKey(r,'protein_family'),s=traitKey(r,'starch_family'),t=traitKey(r,'cooking_technique'),f=traitKey(r,'dish_format'),c=traitKey(r,'cuisine_family');
  const next={
    items:[...state.items,{dayIndex,recipe:r,leftover:isLeftover}],
    used:new Set(state.used),
    usedSignatures:new Set(state.usedSignatures),
    cost:nextCost,
    score:state.score,
    proteinCounts:{...state.proteinCounts},starchCounts:{...state.starchCounts},techniqueCounts:{...state.techniqueCounts},formatCounts:{...state.formatCounts},cuisineCounts:{...state.cuisineCounts},
    specificDiscovery:state.specificDiscovery,specificCultural:state.specificCultural,accessibleDiscovery:state.accessibleDiscovery,
    familiarCount:state.familiarCount,farNovel:state.farNovel,
    fishCount:state.fishCount,vegetarianCount:state.vegetarianCount,dynamicCiqualCount:state.dynamicCiqualCount,
    overlapLast:state.overlapLast,componentCounts:{...state.componentCounts},trueVarietyCounts:{...state.trueVarietyCounts},
    leftovers:state.leftovers,lastTechnique:state.lastTechnique,lastRecipe:state.lastRecipe
  };
  if(isLeftover){
    next.leftovers++;
    next.score+=ctx.budgetMode==='save'?1.0:0.18;
    next.lastTechnique=t;
    next.lastRecipe=r;
    return next;
  }
  next.used.add(String(r.recipe_id));
  next.usedSignatures.add(candidateSemanticSignature(r));
  if(wasInLastGeneration(r,ctx))next.overlapLast++;
  (Array.isArray(r?._componentKeys)?r._componentKeys:[]).forEach(k=>{next.componentCounts=countInc(next.componentCounts,k)});
  candidateTrueVarietyKeys(r).forEach(k=>{next.trueVarietyCounts=countInc(next.trueVarietyCounts,k)});
  next.score+=individualUtilityV489(r,ctx)+incrementalDiversityV489(state,r,ctx);
  next.proteinCounts=countInc(next.proteinCounts,p);
  next.starchCounts=countInc(next.starchCounts,s);
  next.techniqueCounts=countInc(next.techniqueCounts,t);
  next.formatCounts=countInc(next.formatCounts,f);
  next.cuisineCounts=countInc(next.cuisineCounts,c);
  const discovery=Number(r?._effectiveDiscoveryLevel)||0;
  if(discovery===2)next.specificDiscovery++;
  if(isSpecificCulturalCandidate(r))next.specificCultural++;
  if(isEligibleCiqualAssembly(r))next.dynamicCiqualCount++;
  if(discovery===1)next.accessibleDiscovery++;
  if(candidateIsFamiliar(r,ctx.memoryState))next.familiarCount++;
  if(candidateIsFarNovel(r,ctx.memoryState))next.farNovel++;
  if(p==='fish_seafood')next.fishCount++;
  if(p==='plant')next.vegetarianCount++;
  next.lastTechnique=t;
  next.lastRecipe=r;
  return next;
}
function provisionalStateScoreV489(state,step,totalSteps,ctx){
  let s=state.score;
  if(ctx.budget>0&&ctx.budgetMode!=='save'){
    const expected=ctx.budget*ctx.policy.targetRatio*(step/Math.max(1,totalSteps));
    s-=Math.abs(state.cost-expected)*0.72;
  }
  return s;
}
function finalStateScoreV489(state,ctx){
  let s=state.score+weeklyBudgetScore(state.cost,ctx.budget,ctx.policy);
  const uniqueProteins=Object.keys(state.proteinCounts).filter(k=>state.proteinCounts[k]>0&&k!=='mixed_unknown').length;
  const uniqueStarches=Object.keys(state.starchCounts).filter(k=>state.starchCounts[k]>0&&k!=='other_none').length;
  const uniqueTechniques=Object.keys(state.techniqueCounts).filter(k=>state.techniqueCounts[k]>0).length;
  const uniqueFormats=Object.keys(state.formatCounts).filter(k=>state.formatCounts[k]>0).length;
  s+=(uniqueProteins*0.65+uniqueStarches*0.45+uniqueTechniques*0.48+uniqueFormats*0.30)*ctx.policy.diversityWeight;
  if(ctx.capabilities.hasFish)s+=state.fishCount>0?2.4:-2.8;
  if(ctx.capabilities.hasVegetarian)s+=state.vegetarianCount>0?1.8:-2.0;
  if(ctx.memoryState?.active){
    const target=ctx.memoryState.strong?5:4;
    s-=Math.abs(state.familiarCount-target)*1.55;
    // La semaine personnalisée doit conserver 1 à 2 respirations quand possible.
    const openCount=Math.max(0,ctx.totalSteps-state.familiarCount);
    if(openCount>=1&&openCount<=2)s+=1.2;
    if(state.familiarCount>=ctx.totalSteps)s-=1.4;
  }
  // Les assemblages CIQUAL sont une possibilité, jamais un quota qui forcerait
  // un repas incohérent. Les 1–2 premières assiettes strictement validées sont
  // favorisées ; au-delà, le catalogue et les plats composés reprennent la main.
  s+=Math.min(state.dynamicCiqualCount,ctx.dynamicTarget)*1.35;
  if(state.dynamicCiqualCount>ctx.dynamicTarget)s-=(state.dynamicCiqualCount-ctx.dynamicTarget)*0.9;
  s-=state.overlapLast*3.8;
  return s;
}
function selectBeamV489(states,step,totalSteps,ctx,limit=240){
  const seen=new Set(),out=[];
  const add=state=>{
    const key=state.items.map(x=>`${x.dayIndex}:${x.recipe?.recipe_id}:${x.leftover?1:0}`).join('|');
    if(seen.has(key)||out.length>=limit)return;
    seen.add(key);out.push(state);
  };
  const quality=[...states].sort((a,b)=>provisionalStateScoreV489(b,step,totalSteps,ctx)-provisionalStateScoreV489(a,step,totalSteps,ctx));
  quality.slice(0,ctx.budgetFloorPass?520:140).forEach(add);
  if(ctx.budget>0&&ctx.budgetMode!=='save'){
    const progress=step/Math.max(1,totalSteps);
    const target=ctx.budget*ctx.policy.targetRatio*progress;
    const floor=ctx.budget*Number(ctx.policy.hardFloorRatio||0)*progress;
    [...states].sort((a,b)=>Math.abs(a.cost-target)-Math.abs(b.cost-target)).slice(0,90).forEach(add);
    [...states].sort((a,b)=>Math.abs(a.cost-floor)-Math.abs(b.cost-floor)).slice(0,ctx.budgetFloorPass?420:70).forEach(add);
    [...states].sort((a,b)=>b.cost-a.cost).slice(0,ctx.budgetFloorPass?360:45).forEach(add);
  }
  quality.forEach(add);
  return out;
}
function optimizeWeekV489({candidates,dayIndexes,budget,budgetMode,leftovers,memoryState,feedbackState,historyMap,signatureMap,componentMap,lastGenerationIds,lastGenerationSignatures,lastGenerationComponentKeys,generationRound,userId,varietyRelaxation=0,budgetFloorPass=false}){
  const policy=budgetModePolicy(budgetMode);
  const weekKey=isoWeekKey();
  const reliable=candidates.filter(r=>Number(r?._missingPriceCoverage||0)>=100);
  // Fiabilité avant mémoire : si assez de plats 100 % existent pour construire la semaine,
  // aucun 75/86 % ne peut entrer dans le pool d'optimisation.
  const basePool=reliable.length>=dayIndexes.length?reliable:candidates;
  const capabilities={
    hasFish:basePool.some(r=>traitKey(r,'protein_family')==='fish_seafood'),
    hasVegetarian:basePool.some(r=>traitKey(r,'protein_family')==='plant')
  };
  const affordableDynamic=basePool.filter(r=>isEligibleCiqualAssembly(r)&&(budget<=0||Number(r?._missingDocumentedCost||0)<=budget/Math.max(1,dayIndexes.length)*1.20));
  const dynamicFamilies=new Set(affordableDynamic.map(candidateSemanticSignature));
  const dynamicTarget=Math.min(2,dayIndexes.length,dynamicFamilies.size);
  const dynamicMaximum=Math.min(2,dayIndexes.length);
  const dynamicMinimum=0;
  const lastIds=lastGenerationIds instanceof Set?lastGenerationIds:new Set();
  const lastSignatures=lastGenerationSignatures instanceof Set?lastGenerationSignatures:new Set();
  const alternatives=basePool.filter(r=>!lastIds.has(String(r?.recipe_id||''))&&!lastSignatures.has(candidateSemanticSignature(r))).length;
  // Si le catalogue le permet, une régénération ne conserve au maximum que
  // 2 plats de la semaine immédiatement précédente. En cas de pool trop étroit,
  // TEE relâche progressivement au lieu d'échouer.
  const maxImmediateOverlap=lastIds.size
    ?(alternatives>=dayIndexes.length?2:alternatives>=Math.ceil(dayIndexes.length/2)?3:5)
    :dayIndexes.length;
  const freshDynamic=affordableDynamic.filter(r=>!lastIds.has(String(r?.recipe_id||''))&&!lastSignatures.has(candidateSemanticSignature(r))&&countLastComponentOverlap(r,lastGenerationComponentKeys)<2);
  const strictDynamicRotation=freshDynamic.length>=2;
  const familiarCuisineFamilies=familiarCuisineFamiliesV48961(memoryState);
  const ctx={budget,budgetMode,policy,memoryState,feedbackState,historyMap,signatureMap,componentMap,lastGenerationIds:lastIds,lastGenerationSignatures:lastSignatures,lastGenerationComponentKeys:lastGenerationComponentKeys||new Set(),generationRound,userId,weekKey,capabilities,totalSteps:dayIndexes.length,dynamicMinimum,dynamicTarget,dynamicMaximum,maxImmediateOverlap,strictDynamicRotation,varietyRelaxation,budgetFloorPass,familiarCuisineFamilies};
  const expansionPool=budgetFloorPass?budgetFloorExpansionPoolV48952(basePool,ctx):candidateExpansionPool(basePool,ctx);
  const beamWidth=budgetFloorPass?1200:160;
  const perStateLimit=Math.min(budgetFloorPass?140:36,expansionPool.length);
  const maxLeftovers=leftovers?(budgetMode==='save'?2:1):0;
  let beam=[{
    items:[],used:new Set(),usedSignatures:new Set(),cost:0,score:0,
    proteinCounts:{},starchCounts:{},techniqueCounts:{},formatCounts:{},cuisineCounts:{},
    specificDiscovery:0,specificCultural:0,accessibleDiscovery:0,familiarCount:0,farNovel:0,fishCount:0,vegetarianCount:0,dynamicCiqualCount:0,
    overlapLast:0,componentCounts:{},trueVarietyCounts:{},leftovers:0,lastTechnique:null,lastRecipe:null
  }];
  dayIndexes.forEach((dayIndex,stepIdx)=>{
    const next=[];
    for(const state of beam){
      const valid=[...expansionPool]
        .filter(r=>!violatesHardWeekConstraint(state,r,ctx))
        .map(r=>({r,u:individualUtilityV489(r,ctx)+incrementalDiversityV489(state,r,ctx)}));
      // V489.5.2 — pendant le passage budget, on élimine seulement les états qui
      // ne peuvent mathématiquement plus atteindre le plancher même en prenant
      // les candidats les plus chers encore valides. C'est un upper-bound : il
      // ne sacrifie donc aucune solution réellement faisable.
      if(budgetFloorPass&&budget>0&&valid.length){
        const remainingSlots=Math.max(1,dayIndexes.length-stepIdx);
        const maxPossible=[...valid].map(x=>Number(x.r?._missingDocumentedCost||0)).sort((a,b)=>b-a).slice(0,remainingSlots).reduce((a,b)=>a+b,0);
        if(state.cost+maxPossible<budget*Number(policy.hardFloorRatio||0)-1e-6)continue;
      }
      const ranked=[],rankedIds=new Set();
      const keep=x=>{const id=String(x.r?.recipe_id||'');if(!rankedIds.has(id)){rankedIds.add(id);ranked.push(x)}};
      [...valid].sort((a,b)=>b.u-a.u).slice(0,Math.min(budgetFloorPass?70:24,perStateLimit)).forEach(keep);
      if(budget>0&&budgetMode!=='save'){
        const remaining=Math.max(1,dayIndexes.length-stepIdx);
        const remainingTarget=Math.max(0,budget*policy.targetRatio-state.cost)/remaining;
        const remainingFloor=Math.max(0,budget*Number(policy.hardFloorRatio||0)-state.cost)/remaining;
        [...valid].sort((a,b)=>Math.abs(Number(a.r?._missingDocumentedCost||0)-remainingTarget)-Math.abs(Number(b.r?._missingDocumentedCost||0)-remainingTarget)).slice(0,budgetFloorPass?55:16).forEach(keep);
        if(budgetFloorPass)[...valid].sort((a,b)=>Math.abs(Number(a.r?._missingDocumentedCost||0)-remainingFloor)-Math.abs(Number(b.r?._missingDocumentedCost||0)-remainingFloor)).slice(0,55).forEach(keep);
        [...valid].sort((a,b)=>Number(b.r?._missingDocumentedCost||0)-Number(a.r?._missingDocumentedCost||0)).slice(0,budgetFloorPass?60:10).forEach(keep);
      }
      ranked.splice(Math.max(perStateLimit,budgetFloorPass?170:48));
      for(const x of ranked){
        const n=makeNextStateV489(state,x.r,ctx,dayIndex,false);
        if(n)next.push(n);
      }
      if(state.lastRecipe&&state.leftovers<maxLeftovers&&state.lastRecipe?._traits?.leftover_compatible){
        const n=makeNextStateV489(state,state.lastRecipe,ctx,dayIndex,true);
        if(n)next.push(n);
      }
    }
    beam=selectBeamV489(next,stepIdx+1,dayIndexes.length,ctx,Math.max(beamWidth,budgetFloorPass?1500:240));
  });
  if(!beam.length&&varietyRelaxation<2&&!budgetFloorPass)return optimizeWeekV489({
    candidates,dayIndexes,budget,budgetMode,leftovers,memoryState,feedbackState,historyMap,signatureMap,componentMap,
    lastGenerationIds,lastGenerationSignatures,lastGenerationComponentKeys,generationRound,userId,
    varietyRelaxation:varietyRelaxation+1,budgetFloorPass:false
  });
  if(!beam.length)return {items:[],score:-Infinity,cost:0,reliableUsed:reliable.length>=dayIndexes.length,poolSize:basePool.length,budgetFloorEnforced:false,budgetFloorRatio:0,varietyRelaxationUsed:varietyRelaxation,budgetFloorSecondPassUsed:budgetFloorPass,budgetFloorSearchAttempted:budgetFloorPass};
  // V489.5.2 — vrai second passage budget : si le premier faisceau termine sous
  // le plancher, on relance une recherche dédiée [hardFloor, budget] avec un
  // faisceau plus large et davantage de trajectoires de dépense. La variété
  // n'est pas relâchée uniquement pour consommer le budget.
  const floorRatio=(budget>0&&budgetMode!=='save')?Number(policy.hardFloorRatio||0):0;
  const floorStates=floorRatio>0
    ?beam.filter(s=>s.cost>=budget*floorRatio&&s.cost<=budget*1.001)
    :[];
  const unrestrictedBest=[...beam].sort((a,b)=>finalStateScoreV489(b,ctx)-finalStateScoreV489(a,ctx))[0];
  if(floorRatio>0&&!floorStates.length&&!budgetFloorPass){
    const rescue=optimizeWeekV489({
      candidates,dayIndexes,budget,budgetMode,leftovers,memoryState,feedbackState,historyMap,signatureMap,componentMap,
      lastGenerationIds,lastGenerationSignatures,lastGenerationComponentKeys,generationRound,userId,
      varietyRelaxation,budgetFloorPass:true
    });
    const qualityFloor=unrestrictedBest?finalStateScoreV489(unrestrictedBest,ctx)-12:-Infinity;
    if(rescue?.items?.length&&rescue.cost>=budget*floorRatio&&rescue.cost<=budget*1.001&&Number(rescue.score)>=qualityFloor){
      return {...rescue,budgetFloorEnforced:true,budgetFloorSecondPassUsed:true,budgetFloorSearchAttempted:true};
    }
  }
  if(budgetFloorPass&&floorRatio>0&&!floorStates.length){
    return {items:[],score:-Infinity,cost:0,reliableUsed:basePool===reliable,poolSize:basePool.length,capabilities,dynamicMinimum,dynamicTarget,dynamicMaximum,dynamicUsed:0,specificCulturalUsed:0,overlapLast:0,maxImmediateOverlap,strictDynamicRotation,budgetFloorEnforced:false,budgetFloorRatio:floorRatio,varietyRelaxationUsed:varietyRelaxation,trueVarietyCounts:{},budgetFloorSecondPassUsed:true,budgetFloorSearchAttempted:true};
  }
  // Le budget reste un plafond. Le plancher n'est retenu que si son meilleur
  // plan ne dégrade pas fortement la qualité globale (variété, mémoire,
  // fiabilité et cohérence culinaire) par rapport au meilleur plan plus sobre.
  const bestFloor=floorStates.length?[...floorStates].sort((a,b)=>finalStateScoreV489(b,ctx)-finalStateScoreV489(a,ctx))[0]:null;
  const floorQualityAccepted=!!(bestFloor&&(!unrestrictedBest||finalStateScoreV489(bestFloor,ctx)>=finalStateScoreV489(unrestrictedBest,ctx)-12));
  const finalPool=floorQualityAccepted?floorStates:beam;
  finalPool.sort((a,b)=>finalStateScoreV489(b,ctx)-finalStateScoreV489(a,ctx));
  const best=finalPool[0];
  return {items:best.items,score:finalStateScoreV489(best,ctx),cost:best.cost,reliableUsed:basePool===reliable,poolSize:basePool.length,capabilities,dynamicMinimum,dynamicTarget,dynamicMaximum,dynamicUsed:best.dynamicCiqualCount,specificCulturalUsed:best.specificCultural,overlapLast:best.overlapLast,maxImmediateOverlap,strictDynamicRotation,budgetFloorEnforced:floorQualityAccepted,budgetFloorQualityProtected:!!(floorStates.length&&!floorQualityAccepted),budgetFloorRatio:floorRatio,varietyRelaxationUsed:varietyRelaxation,trueVarietyCounts:best.trueVarietyCounts,budgetFloorSecondPassUsed:budgetFloorPass,budgetFloorSearchAttempted:budgetFloorPass};
}
let plannerScrollMotionToken=0;
function plannerScrollRootFor(target){
  if(!target)return document.scrollingElement||document.documentElement;
  const page=target.closest?.('.page');
  if(page&&page.scrollHeight>page.clientHeight+4)return page;
  let node=target.parentElement;
  while(node&&node!==document.body&&node!==document.documentElement){
    try{
      const oy=getComputedStyle(node).overflowY;
      if(/auto|scroll|overlay/.test(oy)&&node.scrollHeight>node.clientHeight+4)return node;
    }catch(_){ }
    node=node.parentElement;
  }
  return document.scrollingElement||document.documentElement;
}
function plannerScrollTopOf(root){
  if(root===document.scrollingElement||root===document.documentElement||root===document.body){
    return Number(window.scrollY||document.documentElement?.scrollTop||document.body?.scrollTop||0);
  }
  return Number(root?.scrollTop||0);
}
function plannerSetScrollTop(root,y){
  const top=Math.max(0,Number(y)||0);
  if(root===document.scrollingElement||root===document.documentElement||root===document.body){
    try{window.scrollTo(0,top)}catch(_){ }
    try{document.documentElement.scrollTop=top}catch(_){ }
    try{document.body.scrollTop=top}catch(_){ }
    return;
  }
  try{root.scrollTop=top}catch(_){ }
}
function plannerPremiumTargetTop(target,root){
  const tr=target.getBoundingClientRect();
  if(root===document.scrollingElement||root===document.documentElement||root===document.body){
    // Le header sticky reste visible : on laisse une respiration courte, sans
    // coller brutalement la carte au bord de l'écran.
    const topInset=18;
    return Math.max(0,plannerScrollTopOf(root)+tr.top-topInset);
  }
  const rr=root.getBoundingClientRect();
  const topInset=14;
  return Math.max(0,plannerScrollTopOf(root)+(tr.top-rr.top)-topInset);
}
function plannerEasePremium(t){
  // Courbe douce, sans rebond : accélération courte puis arrivée très posée.
  return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
}
function plannerAnimateScroll(root,to,{duration=660,token}={}){
  const from=plannerScrollTopOf(root);
  const delta=to-from;
  if(Math.abs(delta)<2){plannerSetScrollTop(root,to);return Promise.resolve(true)}
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){plannerSetScrollTop(root,to);return Promise.resolve(true)}
  const started=performance.now();
  return new Promise(resolve=>{
    const frame=now=>{
      if(token!==plannerScrollMotionToken){resolve(false);return}
      const p=Math.min(1,(now-started)/Math.max(1,duration));
      plannerSetScrollTop(root,from+delta*plannerEasePremium(p));
      if(p<1)requestAnimationFrame(frame);
      else{plannerSetScrollTop(root,to);resolve(true)}
    };
    requestAnimationFrame(frame);
  });
}
function plannerPremiumReveal(result){
  if(!result||window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
  const cards=[...result.children].filter(x=>x?.classList?.contains('mt-next-card'));
  cards.slice(0,2).forEach((card,i)=>{
    try{
      card.animate([
        {opacity:.82,transform:'translateY(7px)'},
        {opacity:1,transform:'translateY(0)'}
      ],{
        duration:360,
        delay:i*55,
        easing:'cubic-bezier(.22,.72,.25,1)',
        fill:'both'
      });
    }catch(_){ }
  });
}
function orientPlannerResult(result,{focus=false,behavior='smooth'}={}){
  if(!result)return;
  try{
    const active=document.activeElement;
    if(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName||''))active.blur();
  }catch(_){ }

  const token=++plannerScrollMotionToken;
  const root=plannerScrollRootFor(result);
  const loader=!!result.querySelector?.('.mt-next-planner-loading');
  const run=async()=>{
    if(token!==plannerScrollMotionToken||!result?.isConnected)return;
    let to;
    try{to=plannerPremiumTargetTop(result,root)}catch(_){return}
    const distance=Math.abs(to-plannerScrollTopOf(root));
    const duration=behavior==='auto'?0:Math.round(clamp(520+distance*.10,560,760));
    if(duration<=0)plannerSetScrollTop(root,to);
    else await plannerAnimateScroll(root,to,{duration,token});
    if(token!==plannerScrollMotionToken)return;

    // Un seul micro-ajustement invisible après stabilisation du viewport iOS.
    // Contrairement aux versions précédentes, aucun enchaînement de scrolls
    // smooth/auto qui donne une impression de saut ou de lutte avec Safari.
    setTimeout(()=>{
      if(token!==plannerScrollMotionToken||!result?.isConnected)return;
      try{
        const settled=plannerPremiumTargetTop(result,root);
        if(Math.abs(settled-plannerScrollTopOf(root))>7){
          plannerAnimateScroll(root,settled,{duration:220,token});
        }
      }catch(_){ }
    },220);

    if(!loader)plannerPremiumReveal(result);
    if(focus){
      try{
        result.setAttribute('tabindex','-1');
        result.focus({preventScroll:true});
      }catch(_){ }
    }
  };

  // On attend juste le prochain layout après fermeture du clavier. Le mouvement
  // reste unique et continu : c'est ce qui donne l'effet plus premium.
  requestAnimationFrame(()=>requestAnimationFrame(run));

  // Si Safari modifie encore le visualViewport (clavier/barre d'adresse), on ne
  // relance pas un nouveau grand scroll ; on recale seulement en douceur.
  try{
    if(window.visualViewport){
      const onResize=()=>setTimeout(()=>{
        if(token!==plannerScrollMotionToken||!result?.isConnected)return;
        try{
          const settled=plannerPremiumTargetTop(result,root);
          if(Math.abs(settled-plannerScrollTopOf(root))>10){
            plannerAnimateScroll(root,settled,{duration:260,token});
          }
        }catch(_){ }
      },150);
      window.visualViewport.addEventListener('resize',onResize,{once:true});
    }
  }catch(_){ }

  // Si l'utilisatrice reprend la main pendant le mouvement, on lui rend le
  // contrôle immédiatement au lieu de forcer la page à continuer à défiler.
  const cancel=()=>{if(token===plannerScrollMotionToken)plannerScrollMotionToken++};
  try{root.addEventListener('touchstart',cancel,{once:true,passive:true})}catch(_){ }
  try{root.addEventListener('wheel',cancel,{once:true,passive:true})}catch(_){ }
}

function plannerPurchaseMultiplier(plan,index){
  const day=plan?.[index];
  if(!day?.recipe||day.leftover)return 0;
  const next=plan?.[index+1];
  const sameNext=!!next?.leftover
    && String(next?.recipe?.recipe_id||'')===String(day.recipe.recipe_id||'');
  return sameNext?2:1;
}
function plannerHasPreparedLeftoverNext(plan,index){
  return plannerPurchaseMultiplier(plan,index)===2;
}
function plannerPeopleLabelV4896(servings){const n=Math.max(1,Number(servings)||1);return `${n} ${n>1?'personnes':'personne'}`}
function plannerReasonV4896(recipe,{memoryState,budget,availableDays,plan,index}={}){
  const reasons=[];
  const push=(text)=>{if(text&&!reasons.includes(text))reasons.push(text)};
  const sourceMeals=(Array.isArray(plan)?plan:[]).filter(x=>x?.recipe&&!x.leftover&&!x.restaurant);
  const protein=traitKey(recipe,'protein_family');
  const starch=canonicalStarchFamilyV48951(traitKey(recipe,'starch_family'));
  const starchCount=starch?sourceMeals.filter(x=>canonicalStarchFamilyV48951(traitKey(x.recipe,'starch_family'))===starch).length:0;
  const validFamily=(v)=>!!v&&!['mixed_unknown','unknown','other','other_none','tee_general'].includes(v);
  const earlierMeals=(Array.isArray(plan)?plan:[]).slice(0,Math.max(0,Number(index)||0)).filter(x=>x?.recipe&&!x.leftover&&!x.restaurant);
  const earlierProteins=new Set(earlierMeals.map(x=>traitKey(x.recipe,'protein_family')).filter(validFamily));
  const validStarchCounts=sourceMeals.reduce((acc,x)=>{
    const family=canonicalStarchFamilyV48951(traitKey(x.recipe,'starch_family'));
    if(validFamily(family))acc[family]=(acc[family]||0)+1;
    return acc;
  },{});
  const mostUsedStarch=Math.max(0,...Object.values(validStarchCounts));

  // Raisons les plus personnelles / concrètes d'abord. Chaque affirmation doit
  // être démontrable par les données réellement présentes dans le planner.
  if(Number(recipe?._haveCount||0)>0)push('utilise une partie de ce que tu as déjà');

  if(plannerHasPreparedLeftoverNext(plan,Number(index)))push('permet de préparer deux portions et simplifie le lendemain');

  if(validFamily(protein)&&earlierProteins.size>0&&!earlierProteins.has(protein)){
    push('apporte une protéine différente du début de semaine');
  }

  const familiarCuisine=familiarCuisineFamiliesV48961(memoryState);
  const cuisine=traitKey(recipe,'cuisine_family');
  if(familiarCuisine.has(cuisine))push('reste dans un univers culinaire présent dans tes habitudes');

  if(validFamily(starch)&&mostUsedStarch>0&&starchCount<mostUsedStarch){
    push('utilise un féculent moins présent cette semaine');
  }

  if(!familiarCuisine.has(cuisine)&&candidateIsFamiliar(recipe,memoryState))push('reste proche de tes habitudes enregistrées');
  if(recipe?._curatedMeal)push('repose sur une association culinaire déjà validée');
  else if(isDynamicCiqualCandidate(recipe))push('s’appuie sur un plat complet déjà référencé');

  // Le budget reste un motif de secours : utile, mais moins distinctif qu'un
  // signal de variété, de placard ou de familiarité.
  const daily=budget>0?budget/Math.max(1,availableDays||7):0;
  const cost=Number(recipe?._missingDocumentedCost||0);
  if(daily>0&&cost>0&&cost<=daily*1.12)push('reste compatible avec ton repère budget par repas');

  return reasons.slice(0,2).join(' · ')||'respecte les contraintes que tu as renseignées';
}
function plannerWeekHardValidV4896(plan,budget,varietyRelaxation=0,memoryState=null){
  const used=new Set(),signatures=new Set(),proteins={},starches={},cuisines={},trueCounts={};
  let specific=0,cost=0,lastTechnique=null;
  for(const day of Array.isArray(plan)?plan:[]){
    if(!day?.recipe||day.restaurant)continue;
    cost+=Number(day.recipe?._missingDocumentedCost||0);
    if(day.leftover)continue;
    const id=String(day.recipe.recipe_id||''),signature=candidateSemanticSignature(day.recipe);
    if(used.has(id)||signatures.has(signature))return false;
    used.add(id);signatures.add(signature);
    const p=traitKey(day.recipe,'protein_family'),s=traitKey(day.recipe,'starch_family'),t=traitKey(day.recipe,'cooking_technique'),c=traitKey(day.recipe,'cuisine_family');
    proteins[p]=(proteins[p]||0)+1;starches[s]=(starches[s]||0)+1;cuisines[c]=(cuisines[c]||0)+1;
    candidateTrueVarietyKeys(day.recipe).forEach(k=>{trueCounts[k]=(trueCounts[k]||0)+1});
    if(isSpecificCulturalCandidate(day.recipe))specific++;
    if(t==='stew'&&lastTechnique==='stew')return false;
    lastTechnique=t;
  }
  if(budget>0&&cost>budget*1.001)return false;
  if(specific>1)return false;
  if(Object.entries(proteins).some(([k,v])=>!['mixed_unknown','unknown','other','other_none'].includes(k)&&!k.startsWith('plant')&&v>2))return false;
  if(Object.entries(starches).some(([k,v])=>!['other_none','unknown'].includes(k)&&v>(varietyRelaxation?3:2)))return false;
  if(Object.entries(trueCounts).some(([k,v])=>v>trueVarietyCap(k,varietyRelaxation)))return false;
  if(Object.entries(cuisines).some(([k,v])=>k!=='tee_general'&&v>3))return false;
  const familiar=familiarCuisineFamiliesV48961(memoryState);
  const totalThreads=activeCuisineThreadsV4896(cuisines);
  const unfamiliar=activeUnfamiliarCuisineThreadsV48961(cuisines,familiar);
  const maxNeutralThreads=varietyRelaxation>=2?4:3;
  const maxUnfamiliarThreads=varietyRelaxation>=2?3:2;
  const maxTotalThreads=varietyRelaxation>=2?5:4;
  if(!familiar.size&&totalThreads.length>maxNeutralThreads)return false;
  if(familiar.size&&unfamiliar.length>maxUnfamiliarThreads)return false;
  if(totalThreads.length>maxTotalThreads)return false;
  return true;
}
function plannerChooseReplacementV4896(plan,index,candidates,ctx){
  const current=plan[index]?.recipe;if(!current||plan[index]?.leftover)return null;
  const used=new Set(plan.filter((x,i)=>x?.recipe&&!x.leftover&&i!==index).map(x=>String(x.recipe.recipe_id||'')));
  const signatures=new Set(plan.filter((x,i)=>x?.recipe&&!x.leftover&&i!==index).map(x=>candidateSemanticSignature(x.recipe)));
  const currentCost=Number(current?._missingDocumentedCost||0),needsLeftover=!!plan[index+1]?.leftover;
  const candidatesValid=(Array.isArray(candidates)?candidates:[]).filter(r=>{
    const id=String(r?.recipe_id||'');
    if(!id||id===String(current.recipe_id||'')||used.has(id)||signatures.has(candidateSemanticSignature(r)))return false;
    if(ctx.feedbackState?.rejected?.has(id)||ctx.sessionSkipped?.has(id))return false;
    if(needsLeftover&&!r?._traits?.leftover_compatible)return false;
    if(Number(r?._missingPriceCoverage||0)<80)return false;
    const proposal=plan.map(x=>({...x}));proposal[index].recipe=r;
    if(needsLeftover)proposal[index+1].recipe=r;
    return plannerWeekHardValidV4896(proposal,ctx.budget,ctx.varietyRelaxation||0,ctx.memoryState);
  });
  candidatesValid.sort((a,b)=>{
    const score=r=>{
      let s=clamp(Number(r?._baseScore)||0,-10,10)*.25+coverageReliabilityScore(Number(r?._missingPriceCoverage)||0);
      s+=plannerFeedbackPenaltyV4896(r,ctx.feedbackState);
      s+=(Number(r?._memoryRank)||0)*3.2+(Number(r?._memoryAffinity)||0)*.7;
      s-=Math.abs(Number(r?._missingDocumentedCost||0)-currentCost)*.55;
      if(r?._recentExact)s-=5;
      s+=(stableUnit(`${ctx.userId}|${ctx.generationRound}|replace|${index}|${r?.recipe_id}`)-.5)*.8;
      return s;
    };
    return score(b)-score(a);
  });
  return candidatesValid[0]||null;
}
function plannerShoppingSummaryV4896(plan,pTok){
  const shop=new Map();let pricedOccurrences=0,totalOccurrences=0,totalDocumented=0;
  plan.forEach((day,index)=>{
    if(!day?.recipe)return;
    const purchaseMultiplier=plannerPurchaseMultiplier(plan,index);if(purchaseMultiplier<=0)return;
    const facts=priceFacts(day.recipe._price,pTok),items=facts.items;
    if(items.length){
      items.forEach(i=>{
        totalOccurrences++;
        const key=norm(i.ingredient_name)||String(i.ingredient_name);
        const prev=shop.get(key)||{name:i.ingredient_name,food_dictionary_id:i.dictionary_id||day.recipe?._meta?.food_dictionary_id||null,ciqual_code:i.ciqual_code||null,candidate_id:day.recipe?.recipe_id||null,quantity_g:0,cost_eur:0,priced:false,source:i.source_label||'',occurrences:0};
        prev.quantity_g+=(Number(i.quantity_g)||0)*purchaseMultiplier;
        if(!prev.food_dictionary_id)prev.food_dictionary_id=i.dictionary_id||day.recipe?._meta?.food_dictionary_id||null;
        if(!prev.ciqual_code&&i.ciqual_code)prev.ciqual_code=i.ciqual_code;
        prev.occurrences++;
        if(num(i.cost_eur)!==null){prev.cost_eur+=Number(i.cost_eur)*purchaseMultiplier;prev.priced=true;pricedOccurrences++;totalDocumented+=Number(i.cost_eur)*purchaseMultiplier}
        if(!prev.source&&i.source_label)prev.source=i.source_label;shop.set(key,prev);
      });
    }else{
      (day.recipe._missing||[]).forEach(name=>{
        if(ingredientIsOwned(name,pTok))return;totalOccurrences++;
        const key=norm(name)||name,prev=shop.get(key)||{name,food_dictionary_id:null,ciqual_code:null,candidate_id:day.recipe?.recipe_id||null,quantity_g:0,cost_eur:0,priced:false,source:'',occurrences:0};
        prev.occurrences++;shop.set(key,prev);
      });
    }
  });
  return {shopRows:[...shop.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr')),pricedOccurrences,totalOccurrences,totalDocumented,coverage:totalOccurrences?Math.round(pricedOccurrences/totalOccurrences*100):100};
}
function plannerPurchaseQuoteMapV48961(purchaseQuote){
  const byKey=new Map();
  (Array.isArray(purchaseQuote?.items)?purchaseQuote.items:[]).forEach(item=>{
    const keys=[
      item?.dictionary_id?`d:${String(item.dictionary_id)}`:null,
      item?.ciqual_code?`c:${String(item.ciqual_code)}`:null,
      item?.ingredient_name?`n:${norm(item.ingredient_name)}`:null
    ].filter(Boolean);
    keys.forEach(k=>{if(!byKey.has(k))byKey.set(k,item)});
  });
  return byKey;
}
function plannerStrictPurchaseSummaryV48964(purchaseQuote){
  const items=Array.isArray(purchaseQuote?.items)?purchaseQuote.items:[];
  const isStrict=item=>/^(exact_package|exact_package_fresh|exact_package_refreshed|format_plus_fresh)/.test(String(item?.pricing_mode||''));
  const strictItems=items.filter(item=>isStrict(item)&&num(item?.estimated_purchase_eur)!==null);
  const backendStrict=num(purchaseQuote?.strict_package_total_eur);
  const calculatedStrict=strictItems.reduce((sum,item)=>sum+Number(item.estimated_purchase_eur||0),0);
  const strictPackageTotal=strictItems.length?(backendStrict!==null?backendStrict:calculatedStrict):null;
  const totalItems=Math.max(0,Number(purchaseQuote?.total_items)||items.length);
  const coverage=totalItems?Math.round(strictItems.length/totalItems*100):(strictItems.length?100:0);
  return {
    strictPackageTotal,
    strictPackageItems:strictItems.length,
    strictPackageCoverage:coverage,
    strictPackagePartial:strictItems.length>0&&strictItems.length<totalItems
  };
}
function plannerQuoteItemForRowV489651(row,quoteMap){
  if(!row||!quoteMap)return null;
  return (row.food_dictionary_id&&quoteMap.get(`d:${String(row.food_dictionary_id)}`))
    ||(row.ciqual_code&&quoteMap.get(`c:${String(row.ciqual_code)}`))
    ||quoteMap.get(`n:${norm(row.name)}`)||null;
}
function plannerIsStrictPackageItemV489651(item){
  if(!item)return false;
  const mode=String(item?.pricing_mode||'');
  return /^(exact_package|exact_package_fresh|exact_package_refreshed|format_plus_fresh)/.test(mode)
    && num(item?.estimated_purchase_eur)!==null;
}
function plannerHybridBudgetReferenceV489651(rows,purchaseQuote,strictSummary=null){
  const quoteMap=plannerPurchaseQuoteMapV48961(purchaseQuote);
  const strict=strictSummary||plannerStrictPurchaseSummaryV48964(purchaseQuote);
  const strictPackageTotal=num(strict?.strictPackageTotal);
  let fallbackConsumedTotal=0,fallbackPricedRows=0,strictMatchedRows=0,unknownRows=0;
  (Array.isArray(rows)?rows:[]).forEach(row=>{
    const q=plannerQuoteItemForRowV489651(row,quoteMap);
    if(plannerIsStrictPackageItemV489651(q)){strictMatchedRows++;return;}
    const consumed=num(row?.cost_eur);
    if(row?.priced&&consumed!==null){fallbackConsumedTotal+=consumed;fallbackPricedRows++;}
    else unknownRows++;
  });
  const strictPart=strictPackageTotal!==null?strictPackageTotal:0;
  const budgetReferenceCost=strictPart+fallbackConsumedTotal;
  return {
    budgetReferenceCost,
    strictPackageBudgetPart:strictPart,
    fallbackConsumedTotal,
    strictMatchedRows,
    fallbackPricedRows,
    unknownBudgetRows:unknownRows,
    budgetReferenceMode:strictPart>0?'package_plus_consumed_fallback':'consumed_only',
    budgetReferenceComplete:unknownRows===0
  };
}
function plannerAttachPurchaseDetailsV48961(rows,purchaseQuote){
  const map=plannerPurchaseQuoteMapV48961(purchaseQuote);
  return (Array.isArray(rows)?rows:[]).map(row=>{
    const q=(row.food_dictionary_id&&map.get(`d:${String(row.food_dictionary_id)}`))
      ||(row.ciqual_code&&map.get(`c:${String(row.ciqual_code)}`))
      ||map.get(`n:${norm(row.name)}`)||null;
    return {...row,purchase:q};
  });
}
function plannerPurchaseFormatTextV48961(row){
  const q=row?.purchase;if(!q)return '';
  const packages=Math.max(0,Number(q?.packages)||0);
  const label=String(q?.package_label||'').trim();
  const weight=Number(q?.package_weight_g)||0;
  const descriptor=label||(weight>0?`${Math.round(weight)} g`:'');
  const mode=String(q?.pricing_mode||'');
  const purchaseCost=num(q?.estimated_purchase_eur);
  if(packages>0&&descriptor&&purchaseCost!==null&&/^(exact_package|format_plus_fresh)/.test(mode)){
    return `À acheter : ${packages} × ${descriptor} · ≈ ${euro(purchaseCost)}`;
  }
  if(descriptor&&['format_known_price_fallback_consumed','consumed_quantity_fallback'].includes(mode)){
    return `Format magasin : ${descriptor} · prix du paquet à confirmer`;
  }
  return '';
}
async function plannerFinancialSummaryV4896(plan,pTok){
  const summary=plannerShoppingSummaryV4896(plan,pTok);
  const quoteInput=summary.shopRows.map(x=>({food_dictionary_id:x.food_dictionary_id||null,ciqual_code:x.ciqual_code||null,candidate_id:x.candidate_id||null,ingredient_name:x.name,quantity_g:Number(x.quantity_g)||0,consumed_cost_eur:x.priced?Number(x.cost_eur):null}));
  let purchaseRes=await safeCall(sb.rpc('mt_planner_purchase_quote_v2',{p_items:quoteInput,p_country:'FR'}),7000,'Le panier magasin');
  if(purchaseRes?.error)purchaseRes=await safeCall(sb.rpc('mt_planner_purchase_quote_v1',{p_items:quoteInput,p_country:'FR'}),7000,'Le panier magasin');
  summary.purchaseQuote=purchaseRes?.error?null:(purchaseRes?.data||null);
  summary.shopRows=plannerAttachPurchaseDetailsV48961(summary.shopRows,summary.purchaseQuote);
  summary.freshPackageCoverage=Number(summary.purchaseQuote?.fresh_package_price_coverage_pct||0);
  summary.packageCoverage=Number(summary.purchaseQuote?.package_coverage_pct||0);
  summary.purchaseEstimated=num(summary.purchaseQuote?.estimated_total_eur);
  Object.assign(summary,plannerStrictPurchaseSummaryV48964(summary.purchaseQuote));
  Object.assign(summary,plannerHybridBudgetReferenceV489651(summary.shopRows,summary.purchaseQuote,summary));
  summary.usePurchaseReference=Number(summary.strictPackageBudgetPart||0)>0;
  return summary;
}
async function plannerRenderInteractiveV4896(ctx,summary=null){
  const {result,plan,candidates,pTok,budget,budgetMode,servings,memoryState,globalBrain,tierLabel,feedbackState,userId,generationRound,availableDays}=ctx;
  if(result) result.dataset.plannerUiVersion='v489651';
  const finance=summary||await plannerFinancialSummaryV4896(plan,pTok),policy=budgetModePolicy(budgetMode);
  const ratio=budget>0?finance.budgetReferenceCost/budget:0;
  const budgetState=!budget?'Sans enveloppe renseignée':finance.coverage<80?'Budget à confirmer':finance.budgetReferenceCost>budget?'Au-dessus du budget indicatif':budgetMode==='save'?'Économies privilégiées':ratio>=Number(policy.hardFloorRatio||0)?'Budget équilibré':'Enveloppe préservée';
  const people=plannerPeopleLabelV4896(servings);
  const strictPackageTotal=num(finance.strictPackageTotal);
  const strictPackageItems=Math.max(0,Number(finance.strictPackageItems)||0);
  const storeMain=strictPackageTotal!==null&&strictPackageItems>0
    ?`≈ ${euro(strictPackageTotal)} sur les formats connus`
    :'À confirmer';
  const storeCaption=strictPackageTotal!==null&&strictPackageItems>0
    ?`${finance.strictPackagePartial?'Estimation partielle':'Formats documentés'} · ${Math.max(0,Number(finance.strictPackageCoverage)||0)} % des lignes chiffrées en conditionnements`
    :'Aucun conditionnement chiffré disponible';
  const notice=ctx.feedbackNotice;
  const noticeHtml=notice?`<div class="mt-next-feedback-notice" data-feedback-notice>
    <span><strong>${esc(notice.title||'Préférence enregistrée')}</strong>${notice.message?` · ${esc(notice.message)}`:''}</span>
    ${notice.candidateId?`<button type="button" data-plan-undo-reject="${esc(notice.candidateId)}">Annuler</button>`:''}
  </div>`:'';
  result.innerHTML=`${noticeHtml}<article class="mt-next-card mt-next-week-card">
    <div class="mt-next-kicker">Ta semaine</div><h2>Une base qui s’adapte.</h2>
    <div class="mt-next-budget-summary">
      <div><small>Coût des portions</small><b>${euro(finance.totalDocumented)} estimés</b></div>
      <div><small>Panier magasin</small><b>${esc(storeMain)}</b><span class="mt-next-budget-caption">${esc(storeCaption)}</span></div>
      <div><small>Budget</small><b>${esc(budgetState)}</b></div>
      <div><small>Portions</small><b>${esc(people)} / repas</b></div>
    </div>
    <p class="mt-next-mini">${esc(plannerMemorySentence(memoryState,globalBrain,tierLabel))}</p>
    ${plan.map((x,index)=>`<div class="mt-next-plan-day" data-plan-day="${index}">
      <small>${x.day}</small>
      <b>${x.restaurant?'Restaurant · journée libre':x.recipe?`${x.leftover?'Restes · ':''}${esc(x.recipe.title)}`:'Repas libre'}</b>
      ${x.recipe?`<span class="mt-next-mini">${x.leftover?'Déjà préparé avec le repas précédent · 0 € d’achat supplémentaire':`${euro(x.recipe._missingDocumentedCost||0)} pour ${esc(people)}${plannerHasPreparedLeftoverNext(plan,index)?' · préparer deux repas':''}`}</span>`:''}
      ${x.recipe&&!x.leftover?`<span class="mt-next-plan-why"><strong>Pourquoi ce choix ?</strong> ${esc(plannerReasonV4896(x.recipe,{memoryState,budget,availableDays,plan,index}))}</span>
      <div class="mt-next-plan-actions"><button type="button" data-plan-replace="${index}">Changer ce repas</button><button type="button" data-plan-reject="${index}">Ne plus me le proposer</button></div>`:''}
    </div>`).join('')}
    <p class="mt-next-cost-note">${finance.usePurchaseReference?'Pour garder un budget réaliste, TEE combine les formats magasin chiffrés avec une estimation des aliments dont le conditionnement reste à confirmer. Le montant « Panier magasin » reste limité aux formats connus.':'Le coût des portions sert de repère budgétaire tant qu’aucun conditionnement magasin chiffré n’est disponible.'}</p>
  </article>
  <article class="mt-next-card"><h2>À prévoir</h2><div class="mt-next-shopping mt-next-shopping-priced">${finance.shopRows.length?finance.shopRows.map(x=>{
    const consumed=`Prévu : ${x.quantity_g?`${Math.round(x.quantity_g)} g`:''}${x.priced?`${x.quantity_g?' · ':''}≈ ${euro(x.cost_eur)} d’ingrédients`:x.quantity_g?'':'coût à confirmer'}`;
    const purchase=plannerPurchaseFormatTextV48961(x);
    return `<span><b>${esc(x.name)}</b><small>${esc(consumed)}${purchase?`<em>${esc(purchase)}</em>`:''}</small></span>`;
  }).join(''):'<p>Rien de structuré à ajouter depuis les recettes sélectionnées.</p>'}</div></article>`;

  const wireUndo=()=>{
    result.querySelectorAll('[data-plan-undo-reject]').forEach(button=>button.addEventListener('click',async()=>{
      if(button.disabled)return;button.disabled=true;
      await undoPlannerRejectionV48961(userId,feedbackState,button.dataset.planUndoReject);
      ctx.feedbackNotice={title:'Choix annulé',message:'Ce repas pourra de nouveau être proposé.',candidateId:null};
      await plannerRenderInteractiveV4896(ctx);
    }));
  };
  const change=async(index,reject=false)=>{
    if(ctx.replacing)return;ctx.replacing=true;
    const current=plan[index]?.recipe;if(!current){ctx.replacing=false;return}
    ctx.sessionSkipped.add(String(current.recipe_id||''));
    const next=plannerChooseReplacementV4896(plan,index,candidates,ctx);
    if(!next){
      ctx.sessionSkipped.delete(String(current.recipe_id||''));
      if(reject){
        await recordPlannerFeedbackV4896(userId,feedbackState,current,'rejected');
        ctx.feedbackNotice={title:'Repas écarté',message:'Il ne sera plus proposé tant que tu n’annules pas ce choix.',candidateId:String(current.recipe_id||'')};
        await plannerRenderInteractiveV4896(ctx,finance);
      }else{
        const day=result.querySelector(`[data-plan-day="${index}"]`);if(day)day.insertAdjacentHTML('beforeend','<span class="mt-next-plan-message">Aucune autre proposition fiable ne respecte toutes tes contraintes pour ce jour.</span>');
      }
      ctx.replacing=false;return;
    }
    await recordPlannerFeedbackV4896(userId,feedbackState,current,reject?'rejected':'replaced');
    if(reject)ctx.feedbackNotice={title:'Repas écarté',message:'Il ne sera plus proposé tant que tu n’annules pas ce choix.',candidateId:String(current.recipe_id||'')};
    else ctx.feedbackNotice=null;
    plan[index].recipe=next;
    if(plan[index+1]?.leftover)plan[index+1].recipe=next;
    result.innerHTML=plannerLoaderMarkup('TEE remplace uniquement ce repas…','Le budget et la liste de courses sont recalculés.');
    try{await plannerRenderInteractiveV4896(ctx)}finally{ctx.replacing=false}
    result.querySelector(`[data-plan-day="${index}"]`)?.scrollIntoView?.({behavior:'smooth',block:'center'});
  };
  result.querySelectorAll('[data-plan-replace]').forEach(button=>button.addEventListener('click',()=>change(Number(button.dataset.planReplace),false)));
  result.querySelectorAll('[data-plan-reject]').forEach(button=>button.addEventListener('click',()=>change(Number(button.dataset.planReject),true)));
  wireUndo();
  ctx.lastFinance=finance;
  return finance;
}
function isBudgetRelevantItem(item){
  return !!item && item.optional!==true && item.requires_choice!==true && item.budget_exempt!==true;
}
function priceItemsForPantry(price,pTok){
  const items=Array.isArray(price?.items)?price.items:[];
  return items.filter(isBudgetRelevantItem).filter(i=>!ingredientIsOwned(i.ingredient_name,pTok));
}
function priceFacts(price,pTok){
  const items=priceItemsForPantry(price,pTok);
  const known=items.filter(i=>num(i.cost_eur)!==null);
  const cost=known.reduce((s,i)=>s+Number(i.cost_eur),0);
  const coverage=items.length?Math.round(known.length/items.length*100):100;
  return {items,known,cost,coverage,total:items.length,priced:known.length};
}
function withTimeout(value,ms=9000,label='Chargement'){
  return Promise.race([
    Promise.resolve(value),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} prend plus de temps que prévu.`)),ms))
  ]);
}
async function safeCall(value,ms=9000,label='Chargement'){
  try{return await withTimeout(value,ms,label)}catch(error){return {data:null,error}}
}
function showOpenError(error){
  const message=error?.message||'Impossible d’ouvrir cet outil pour le moment.';
  body(`<div class="mt-next-result is-alert"><b>Ouverture impossible</b><p>${esc(message)}</p><button type="button" class="mt-next-secondary" id="mtNextRetry">Réessayer</button></div>`);
  document.getElementById('mtNextRetry')?.addEventListener('click',()=>location.reload());
}
function ingredientIsOwned(name,pTok){
  const t=[...tokens(name)];
  return t.length>0&&t.some(x=>pTok.has(x));
}
async function auth(){
  sb=typeof initSupabase==='function'?initSupabase():null;
  if(!sb)throw Error('Connexion indisponible.');
  const {data}=await withTimeout(sb.auth.getUser(),8000,'La connexion');
  user=data?.user;
  if(!user){location.href='auth.html';throw Error('Connexion requise.')}
}
function tabs(){
  const e=document.getElementById('mtNextTabs');
  if(!e)return;
  e.innerHTML=tools.map(([k,l])=>`<a class="${k===tool?'active':''}" href="tee-next.html?tool=${k}">${esc(l)}</a>`).join('');
}
function body(html){
  const e=document.getElementById('mtNextBody');
  if(!e)throw Error('Zone de contenu indisponible.');
  e.innerHTML=html;
}

async function safety(){
  body('<div class="mt-next-status">Préparation de tes garde-fous…</div>');
  const profileRes=await safeCall(sb.from('mt_phyto_user_profile').select('*').eq('user_id',user.id).maybeSingle(),8000,'Le profil plantes');
  if(profileRes?.error) throw profileRes.error;
  const f=profileRes?.data||{};
  const flags=[
    ['regular_medication','Je prends un traitement régulier'],
    ['anticoagulants','Traitement anticoagulant / antiagrégant'],
    ['sedatives','Traitement sédatif / somnifère'],
    ['hypertension','Hypertension connue'],
    ['pregnancy','Grossesse'],
    ['breastfeeding','Allaitement'],
    ['caffeine_sensitive','Sensibilité forte à la caféine'],
    ['allergy_asteraceae','Allergie connue aux Astéracées'],
    ['hormone_sensitive','Situation hormono-sensible à vérifier']
  ];
  body(`<article class="mt-next-card">
    <div class="mt-next-kicker">Sécurité phytothérapie</div>
    <h2>Vérifier avant de suggérer.</h2>
    <p>Ce profil sert uniquement de garde-fou. L’absence d’alerte ne signifie jamais qu’une plante est garantie compatible.</p>
    <div class="mt-next-grid">${flags.map(([k,l])=>`<label class="mt-next-choice"><input type="checkbox" data-phyto-flag="${k}" ${f[k]?'checked':''}><span>${esc(l)}</span></label>`).join('')}</div>
    <button class="mt-next-primary" id="mtPhytoSave">Enregistrer mes garde-fous</button>
  </article>
  <article class="mt-next-card">
    <h2>Vérifier une plante</h2>
    <div class="mt-next-field"><label>Plante</label><input id="mtPhytoPlant" placeholder="Ex. millepertuis, réglisse, sauge…"></div>
    <button class="mt-next-primary" id="mtPhytoCheck">Vérifier avec mon profil</button>
    <div id="mtPhytoResult"></div>
  </article>`);
  document.getElementById('mtPhytoSave').onclick=async()=>{
    const flags={};
    document.querySelectorAll('[data-phyto-flag]').forEach(x=>flags[x.dataset.phytoFlag]=x.checked);
    const {error}=await withTimeout(sb.rpc('mt_phyto_save_profile',{p_flags:flags}),8000,'L’enregistrement');
    if(error)alert(error.message);else alert('Garde-fous enregistrés.');
  };
  document.getElementById('mtPhytoCheck').onclick=async()=>{
    const plant=document.getElementById('mtPhytoPlant').value.trim(),box=document.getElementById('mtPhytoResult');
    if(!plant)return;
    box.innerHTML='<div class="mt-next-status">Vérification…</div>';
    const {data,error}=await withTimeout(sb.rpc('mt_phyto_safety_check',{p_plant:plant}),8000,'La vérification');
    if(error){box.innerHTML=`<div class="mt-next-result is-alert">${esc(error.message)}</div>`;return;}
    const rules=Array.isArray(data?.matches)?data.matches:[];
    box.innerHTML=`<div class="mt-next-result ${rules.length?'is-alert':'is-ok'}"><b>${esc(data?.headline||'Vérification terminée')}</b>${rules.length?rules.map(r=>`<p>${esc(r.message)}</p>`).join(''):`<p>Aucun garde-fou renseigné dans ton profil n’a déclenché de règle pour cette plante. Cela ne remplace pas une vérification professionnelle en cas de traitement, grossesse, maladie ou doute.</p>`}</div>`;
  };
}

async function loadFusedPlannerMemory(){
  const targetDate=new Date().toLocaleDateString('sv-SE');
  let fused=await safeCall(sb.rpc('mt_planner_personal_context_v2',{
    p_target_date:targetDate
  }),8000,'La mémoire personnelle TEE');
  if(fused?.error){
    fused=await safeCall(sb.rpc('mt_tee_memory_domain_v1',{
      p_domain:'planner',p_target_date:targetDate,p_refresh_learning:false
    }),8000,'La mémoire globale TEE');
  }
  if(!fused?.error&&fused?.data){
    return {global:fused.data,food:fused.data.food_memory||null,source:fused.data.version==='V4892_PLANNER_CONTEXT_V2'?'fused_v2':'fused_v1'};
  }
  // Compatibilité de secours : si le backend fusionné n'est pas encore déployé,
  // la mémoire alimentaire V488.8.2 continue de fonctionner sans casser l'écran.
  const legacy=await safeCall(sb.rpc('mt_planner_personal_memory_v1',{p_days:60}),7000,'Ta mémoire alimentaire');
  return {global:null,food:legacy?.error?null:(legacy?.data||null),source:'food_only'};
}
async function loadPlannerMetaV4892(){
  const v2=await safeCall(sb.rpc('mt_planner_candidate_meta_v2'),7000,'La hiérarchie des plats');
  if(!v2?.error)return v2;
  return safeCall(sb.rpc('mt_planner_candidate_meta_v1'),7000,'La hiérarchie des plats');
}

async function loadPlannerRecommendationHistoryV48922(){
  const v3=await safeCall(sb.rpc('mt_planner_recent_recommendations_v3',{p_days:42,p_generations:4}),7000,'La rotation sémantique des semaines');
  if(!v3?.error)return v3;
  const v2=await safeCall(sb.rpc('mt_planner_recent_recommendations_v2',{p_days:42,p_generations:4}),7000,'La rotation des semaines');
  if(!v2?.error)return v2;
  return safeCall(sb.rpc('mt_planner_recent_recommendations_v1',{p_days:42}),7000,'La rotation des semaines');
}

function plannerMemorySentence(memoryState,globalBrain,tierLabel){
  if(memoryState?.active){
    return `${tierLabel} · TEE s’appuie sur ce que tu manges réellement pour varier la semaine sans te proposer toujours les mêmes repas.`;
  }
  const stage=String(globalBrain?.stage||'starting');
  if(stage==='learning'||stage==='personalized'||stage==='deep_personalization'){
    return `${tierLabel} · TEE affine progressivement les propositions à partir de ce que tu renseignes dans l’app.`;
  }
  return `${tierLabel} · TEE te propose une base simple et variée, puis l’affine au fil de tes habitudes.`;
}

async function planner(){
  const seedRaw=sessionStorage.getItem('mtPlannerPantrySeedV1')||'';
  if(seedRaw)sessionStorage.removeItem('mtPlannerPantrySeedV1');
  body(plannerLoaderMarkup('TEE prépare ta semaine…','Elle rassemble tes préférences et tes repères avant de te proposer les choix.'));

  const [prefsRes,catalogRes,curatedRes,metaRes,traitsRes,historyRes,memoryBundle,feedbackState]=await Promise.all([
    safeCall(sb.from('mt_planner_preferences').select('*').eq('user_id',user.id).maybeSingle(),8000,'Tes préférences'),
    safeCall(sb.rpc('mt_planner_recipe_catalog'),9000,'Tes recettes'),
    safeCall(sb.rpc('mt_planner_curated_catalog_v2'),10000,'Le catalogue culinaire validé'),
    loadPlannerMetaV4892(),
    safeCall(sb.rpc('mt_planner_candidate_traits_v1'),7000,'Les caractéristiques des plats'),
    loadPlannerRecommendationHistoryV48922(),
    loadFusedPlannerMemory(),
    loadPlannerFeedbackV4896(user.id)
  ]);
  if(catalogRes?.error) throw catalogRes.error;

  const prefs=prefsRes?.error?null:prefsRes?.data;
  const catalog=catalogRes?.data;
  const curatedRows=curatedRes?.error?[]:(Array.isArray(curatedRes?.data)?curatedRes.data:[]);
  // V489.4.3 — le catalogue éditorial peut être techniquement présent mais encore
  // trop petit pour porter seul la semaine. Avec <21 repas publiés, TEE reste en
  // mode hybride sécurisé : recettes/whole-dishes historiques + plats CIQUAL
  // composés existants + repas éditoriaux déjà validés. Aucun assemblage libre.
  const curatedPublishedCount=curatedRows.length;
  const curatedCatalogReady=curatedPublishedCount>=21;
  const metaRows=metaRes?.error?[]:(Array.isArray(metaRes?.data)?metaRes.data:[]);
  const traitRows=traitsRes?.error?[]:(Array.isArray(traitsRes?.data)?traitsRes.data:[]);
  const recommendationHistory=historyRes?.error?null:(historyRes?.data||null);
  const globalBrain=memoryBundle?.global||null;
  const memory=memoryBundle?.food||null;
  const metaMap=new Map(metaRows.map(x=>[String(x.recipe_id),x]));
  const traitMap=new Map(traitRows.map(x=>[String(x.candidate_id),x]));
  let historyBundle=recommendationHistoryMaps(recommendationHistory||{});
  const memoryBase=memoryMaps(memory||{});
  const contextStage=String(globalBrain?.stage||'starting');
  const contextConfidence=Number(globalBrain?.confidence||0);
  const memoryState={...memoryBase,active:!!memory?.active,strong:!!memory?.strong,mealCount:Number(memory?.planner_meal_count||0),days:Number(memory?.planner_days_with_meals||0),contextStage,contextConfidence,contextActive:contextStage!=='starting'};
  const p=prefs||{},rows=Array.isArray(catalog)?catalog:[];
  const seedTerms=list(seedRaw);
  const pantryInitial=[...new Set([...(seedTerms||[]),...(p.pantry_terms||[])])];

  body(`<article class="mt-next-card">
    <div class="mt-next-kicker">Planification adaptative</div>
    <h2>Partir de la vraie vie.</h2>
    <p>TEE part de ce que tu as déjà, de ton budget et de tes habitudes pour te proposer une semaine réaliste, variée et facile à suivre.</p>
    ${memoryState.active
      ?`<div class="mt-next-price-source"><b>TEE apprend de tes habitudes</b><span>Elle tient compte de ce que tu enregistres pour varier les repas sans t’éloigner de ce que tu manges réellement.</span></div>`
      :`<div class="mt-next-price-source is-empty"><b>TEE apprend avec toi</b><span>Plus tu renseignes tes repas et tes préférences, plus les propositions deviennent personnelles.</span></div>`}
    <div class="mt-next-field"><label>Ce que j’ai déjà</label><textarea id="mtPlanPantry" placeholder="saumon, riz, courgettes…">${esc(pantryInitial.join(', '))}</textarea></div>
    <div class="mt-next-field"><label>Allergies ou aliments à exclure</label><input id="mtPlanExclude" value="${esc((p.excluded_terms||[]).join(', '))}" placeholder="œufs, porc…"><small>Ces exclusions sont strictes. TEE n’invente jamais une interdiction alimentaire à partir d’un suivi santé.</small></div>
    <div class="mt-next-grid">
      <div class="mt-next-field"><label>Budget indicatif semaine</label><input id="mtPlanBudget" type="number" min="0" step="1" value="${esc(p.weekly_budget_eur??45)}"></div>
      <div class="mt-next-field"><label>Personnes</label><input id="mtPlanServings" type="number" min="1" max="8" value="${esc(p.servings||1)}"></div>
    </div>
    <div class="mt-next-field"><label>Comment utiliser mon budget ?</label><select id="mtPlanBudgetMode">
      <option value="save" ${p.budget_mode==='save'?'selected':''}>Économiser au maximum</option>
      <option value="balanced" ${!p.budget_mode||p.budget_mode==='balanced'?'selected':''}>Utiliser raisonnablement mon budget</option>
      <option value="variety" ${p.budget_mode==='variety'?'selected':''}>Privilégier la variété dans cette enveloppe</option>
    </select></div>
    <div class="mt-next-grid">
      <div class="mt-next-field"><label>Restaurant</label><select id="mtPlanRestaurant"><option value="">Aucun jour prévu</option>${DAYS.map((d,i)=>`<option value="${i}" ${String(p.restaurant_day??'')===String(i)?'selected':''}>${d}</option>`).join('')}</select></div>
      <label class="mt-next-choice" style="margin-top:28px"><input id="mtPlanLeftovers" type="checkbox" ${p.use_leftovers!==false?'checked':''}><span>Réutiliser les restes</span></label>
    </div>
    <button class="mt-next-primary" id="mtPlanGo">Construire ma semaine</button>
    <p class="mt-next-mini">TEE ajuste toute la semaine à ton budget, à ce que tu as déjà et à tes repas récents. Le but : rester réaliste, varier suffisamment et éviter les répétitions inutiles.</p>
  </article><section id="mtPlanResult"></section>`);

  document.getElementById('mtPlanGo').onclick=async()=>{
    const go=document.getElementById('mtPlanGo');
    if(go.disabled)return;
    go.disabled=true;
    go.setAttribute('aria-busy','true');
    const result=document.getElementById('mtPlanResult');
    result.innerHTML=plannerLoaderMarkup('TEE compose ta semaine…','Elle équilibre les repas, le budget et la variété.');
    orientPlannerResult(result,{focus:true,behavior:'smooth'});

    try{
      const pantry=list(document.getElementById('mtPlanPantry').value);
      const exclude=list(document.getElementById('mtPlanExclude').value);
      const budget=Number(document.getElementById('mtPlanBudget').value)||0;
      const budgetMode=document.getElementById('mtPlanBudgetMode')?.value||'balanced';
      const servings=Math.max(1,Math.min(8,Number(document.getElementById('mtPlanServings').value)||1));
      const restaurant=document.getElementById('mtPlanRestaurant').value;
      const leftovers=document.getElementById('mtPlanLeftovers').checked;
      const tier=budgetTier(budget);
      const generationRound=Number(historyBundle.generationsThisWeek||0);
      const availableDays=restaurant===''?7:6;
      const target=budget>0?budget/Math.max(1,availableDays):0;

      const prefSave=await withTimeout(sb.from('mt_planner_preferences').upsert({
        user_id:user.id,pantry_terms:pantry,excluded_terms:exclude,
        weekly_budget_eur:budget||null,budget_mode:budgetMode,servings,
        restaurant_day:restaurant===''?null:Number(restaurant),
        use_leftovers:leftovers,updated_at:new Date().toISOString()
      }),8000,'L’enregistrement de ta planification');
      if(prefSave?.error)throw prefSave.error;

      const pTok=tokens(pantry.join(' ')),excludeTerms=exclude.map(norm).filter(Boolean);

      let candidates=rows.map(r=>{
        const ing=Array.isArray(r.ingredients)?r.ingredients:[];
        const all=norm([r.title,r.subtitle,...ing].join(' '));
        if(matchesAnyExcludedTerm(all,excludeTerms))return null;

        let have=0;
        ing.forEach(i=>{if(ingredientIsOwned(i,pTok))have++});
        const missing=ing.filter(i=>!ingredientIsOwned(i,pTok));

        const missingPenalty=tier==='economy'?0.62:tier==='balanced'?0.24:0.08;
        const complexityBonus=tier==='flexible'?Math.min(8,ing.length)*0.11:tier==='balanced'?Math.min(8,ing.length)*0.025:0;
        let score=have*4.2-missing.length*missingPenalty+complexityBonus;
        if(!ing.length)score-=8;

        const meta=plannerMetaFor(r,metaMap);
        const traits=candidateTraitsFor(r,meta,traitMap);
        const affinity=candidateMemoryAffinity(r,memoryState,meta);
        const recentKey=norm(meta?.normalized_title||r.title||'');
        const recentExact=memoryState.active&&memoryState.recentTitles.has(recentKey);
        const discoveryLevel=effectiveDiscoveryLevel(r,memoryState,meta);
        return {
          ...r,
          _meta:meta,
          _traits:traits,
          _haveCount:have,
          _memoryAffinity:affinity,
          _recentExact:recentExact,
          _effectiveDiscoveryLevel:discoveryLevel,
          _baseScore:score,
          _score:score,
          _missing:missing,
          _price:null,
          _priceFacts:{items:[],known:[],cost:0,coverage:0,total:0,priced:0},
          _missingDocumentedCost:0,
          _missingPriceCoverage:0
        };
      }).filter(Boolean);

      // V489.0 — prix de TOUS les candidats au clic, sans limite cachée à 60.
      // Le batch V2 découpe côté Supabase et réutilise le dispatch strict V488.5.
      const priceIds=candidates.map(x=>x.recipe_id);
      if(priceIds.length){
        try{
          let priced=null,priceErr=null;
          const v2=await safeCall(sb.rpc('mt_recipe_cost_batch_v2',{
            p_recipe_ids:priceIds,p_servings:servings,p_country:'FR',p_region:null
          }),16000,'Le calcul complet des prix');
          if(!v2?.error){priced=v2?.data||[]}
          else{
            // Fallback rétrocompatible si le SQL V489 n'est pas encore déployé :
            // appels V1 en tranches de 60, donc aucun candidat silencieusement ignoré.
            const chunks=[];
            for(let i=0;i<priceIds.length;i+=60)chunks.push(priceIds.slice(i,i+60));
            const parts=[];
            for(const chunk of chunks){
              const r=await withTimeout(sb.rpc('mt_recipe_cost_batch_v1',{
                p_recipe_ids:chunk,p_servings:servings,p_country:'FR',p_region:null
              }),12000,'Le calcul des prix');
              if(r?.error){priceErr=r.error;break}
              parts.push(...(r?.data||[]));
            }
            priced=parts;
          }
          if(priceErr)throw priceErr;
          const priceMap=new Map((priced||[]).map(x=>[String(x.recipe_id),x.cost]));
          candidates=candidates.map(r=>{
            const price=priceMap.get(String(r.recipe_id))||null;
            const facts=priceFacts(price,pTok);
            const coverage=facts.coverage;
            return {
              ...r,
              _price:price,
              _priceFacts:facts,
              _missingPriceItems:facts.items,
              _missingDocumentedCost:facts.cost,
              _missingPriceCoverage:coverage,
              _coverageReliabilityScore:coverageReliabilityScore(coverage),
              _score:r._baseScore+coverageReliabilityScore(coverage)
            };
          });
        }catch(e){
          console.warn('[TEE planner V489] prix indisponibles',e);
        }
      }


      // V489.4.1 — aucune combinaison libre de trois aliments.
      // 1) repas éditoriaux publiés et déjà résolus vers des codes CIQUAL ;
      // 2) plats composés CIQUAL existants, pris comme plats complets ;
      // 3) recettes/whole-dishes historiques déjà présents dans candidates.
      let curatedBuild={candidates:[],publishedMeals:curatedRows.length,pricedMeals:0};
      let compositeBuild={candidates:[],universeCount:0};
      try{
        curatedBuild=await buildCuratedCandidatesV48941({
          rows:curatedRows,memoryState,exclude,servings,pantryTokens:pTok
        });
        appendUniqueCandidatesV48941(candidates,curatedBuild.candidates);
      }catch(e){console.warn('[TEE V489.4.1] catalogue culinaire indisponible',e)}
      try{
        compositeBuild=await buildDirectCiqualCompositeCandidatesV48941({
          memoryState,exclude,servings,generationRound,userId:user.id,max:curatedCatalogReady?80:140
        });
        appendUniqueCandidatesV48941(candidates,compositeBuild.candidates);
      }catch(e){console.warn('[TEE V489.4.1] plats composés CIQUAL indisponibles',e)}
      candidates=candidates.filter(r=>!feedbackState.rejected.has(String(r?.recipe_id||'')));
      candidates._ciqualUniverseCount=compositeBuild.universeCount||0;
      candidates._ciqualDynamicCount=0;

      // V489.0 — normalisation RELATIVE du signal mémoire.
      // Deux profils avec des scores bruts proches peuvent ainsi avoir des
      // classements réellement différents : on compare les candidats ENTRE EUX
      // pour ce profil, au lieu d'appliquer seulement un bonus absolu.
      if(memoryState.active&&candidates.length){
        const ordered=[...candidates].sort((a,b)=>(Number(a._memoryAffinity)||0)-(Number(b._memoryAffinity)||0));
        const n=Math.max(1,ordered.length-1);
        ordered.forEach((r,idx)=>{r._memoryRank=idx/n});
      }else{
        candidates.forEach(r=>{r._memoryRank=0});
      }

      // V489.0 — OPTIMISATION DE LA SEMAINE ENTIÈRE.
      // Plus de sélection gloutonne lundi -> mardi -> mercredi.
      const dayIndexes=[];
      for(let i=0;i<7;i++)if(String(i)!==String(restaurant))dayIndexes.push(i);
      const optimized=optimizeWeekV489({
        candidates,dayIndexes,budget,budgetMode,leftovers,memoryState,feedbackState,
        historyMap:historyBundle.map,signatureMap:historyBundle.signatureMap,componentMap:historyBundle.componentMap,
        lastGenerationIds:historyBundle.lastGenerationIds,
        lastGenerationSignatures:historyBundle.lastGenerationSignatures,
        lastGenerationComponentKeys:historyBundle.lastGenerationComponentKeys,
        generationRound,userId:user.id
      });
      if(!optimized.items.length)throw new Error('Aucune semaine complète ne respecte actuellement les contraintes et la fiabilité disponibles.');
      const plan=[];
      const byDay=new Map(optimized.items.map(x=>[x.dayIndex,x]));
      for(let i=0;i<7;i++){
        if(String(i)===String(restaurant)){plan.push({day:DAYS[i],restaurant:true,dayIndex:i});continue}
        const x=byDay.get(i);
        plan.push({day:DAYS[i],dayIndex:i,recipe:x?.recipe||null,leftover:!!x?.leftover,repeat:false});
      }
      const reliableFallbackUsed=optimized.reliableUsed?0:1;
      const specificDiscoveryUsed=plan.filter(x=>Number(x.recipe?._effectiveDiscoveryLevel||0)===2&&!x.leftover).length;
      const accessibleDiscoveryUsed=plan.filter(x=>Number(x.recipe?._effectiveDiscoveryLevel||0)===1&&!x.leftover).length;
      const memoryGuidedUsed=memoryState.active?plan.filter(x=>x.recipe&&!x.leftover&&candidateIsFamiliar(x.recipe,memoryState)).length:0;
      const memoryOpenUsed=memoryState.active?plan.filter(x=>x.recipe&&!x.leftover&&!candidateIsFamiliar(x.recipe,memoryState)).length:0;
      const noveltyUsed=memoryState.active?plan.filter(x=>x.recipe&&!x.leftover&&candidateIsFarNovel(x.recipe,memoryState)).length:0;
      const memoryGuidedTarget=memoryState.active?(memoryState.strong?5:4):0;
      const memoryOpenTarget=memoryState.active?Math.max(0,dayIndexes.length-memoryGuidedTarget):0;

      // Liste de courses : on ignore désormais les lignes optional / choice / budget_exempt.
      const shop=new Map();
      let pricedOccurrences=0,totalOccurrences=0,totalDocumented=0;

      plan.forEach((day,index)=>{
        if(!day.recipe)return;

        // V489.5.3 — un jour « Restes » n'est pas un nouvel achat.
        // La quantité nécessaire est portée explicitement par le repas préparé
        // la veille (x2), puis le jour Restes apporte 0 nouvel achat.
        const purchaseMultiplier=plannerPurchaseMultiplier(plan,index);
        if(purchaseMultiplier<=0)return;

        const facts=priceFacts(day.recipe._price,pTok);
        const items=facts.items;

        if(items.length){
          items.forEach(i=>{
            totalOccurrences++;
            const key=norm(i.ingredient_name)||String(i.ingredient_name);
            const prev=shop.get(key)||{
              name:i.ingredient_name,
              food_dictionary_id:i.dictionary_id||day.recipe?._meta?.food_dictionary_id||null,
              ciqual_code:i.ciqual_code||null,
              candidate_id:day.recipe?.recipe_id||null,
              quantity_g:0,
              cost_eur:0,
              priced:false,
              source:i.source_label||'',
              occurrences:0
            };

            prev.quantity_g+=(Number(i.quantity_g)||0)*purchaseMultiplier;
            if(!prev.food_dictionary_id)prev.food_dictionary_id=i.dictionary_id||day.recipe?._meta?.food_dictionary_id||null;
            if(!prev.ciqual_code&&i.ciqual_code)prev.ciqual_code=i.ciqual_code;
            prev.occurrences++;

            if(num(i.cost_eur)!==null){
              prev.cost_eur+=Number(i.cost_eur)*purchaseMultiplier;
              prev.priced=true;
              pricedOccurrences++;
              totalDocumented+=Number(i.cost_eur)*purchaseMultiplier;
            }

            if(!prev.source&&i.source_label)prev.source=i.source_label;
            shop.set(key,prev);
          });
        }else{
          (day.recipe._missing||[]).forEach(name=>{
            if(ingredientIsOwned(name,pTok))return;
            totalOccurrences++;
            const key=norm(name)||name;
            const prev=shop.get(key)||{
              name,food_dictionary_id:null,quantity_g:0,cost_eur:0,priced:false,source:'',occurrences:0
            };
            prev.occurrences++;
            shop.set(key,prev);
          });
        }
      });

      const coverage=totalOccurrences?Math.round(pricedOccurrences/totalOccurrences*100):100;
      const shopRows=[...shop.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'));

      // Format magasin : exact seulement quand un paquet vérifié est documenté.
      const quoteInput=shopRows.map(x=>({
        food_dictionary_id:x.food_dictionary_id||null,
        ciqual_code:x.ciqual_code||null,
        candidate_id:x.candidate_id||null,
        ingredient_name:x.name,
        quantity_g:Number(x.quantity_g)||0,
        consumed_cost_eur:x.priced?Number(x.cost_eur):null
      }));
      let purchaseRes=await safeCall(sb.rpc('mt_planner_purchase_quote_v2',{p_items:quoteInput,p_country:'FR'}),7000,'Le panier magasin');
      if(purchaseRes?.error)purchaseRes=await safeCall(sb.rpc('mt_planner_purchase_quote_v1',{p_items:quoteInput,p_country:'FR'}),7000,'Le panier magasin');
      const purchaseQuote=purchaseRes?.error?null:(purchaseRes?.data||null);
      const packageCoverage=Number(purchaseQuote?.package_coverage_pct||0);
      const freshPackageCoverage=Number(purchaseQuote?.fresh_package_price_coverage_pct||0);
      const purchaseKnownCoverage=Number(purchaseQuote?.known_coverage_pct||0);
      const purchaseEstimated=num(purchaseQuote?.estimated_total_eur);
      const strictPurchaseSummary=plannerStrictPurchaseSummaryV48964(purchaseQuote);
      // Référence budgétaire interne hybride :
      // - prix de paquet strict/frais pour les lignes réellement documentées ;
      // - coût consommé uniquement pour les lignes sans paquet strict chiffré.
      // Le « Panier magasin » affiché reste, lui, strictement limité aux paquets connus.
      const hybridBudget=plannerHybridBudgetReferenceV489651(shopRows,purchaseQuote,strictPurchaseSummary);
      const usePurchaseReference=Number(hybridBudget.strictPackageBudgetPart||0)>0;
      const budgetReferenceCost=hybridBudget.budgetReferenceCost;
      const confident=coverage>=80;
      const policy=budgetModePolicy(budgetMode);
      const budgetUseRatio=budget>0?budgetReferenceCost/budget:0;
      const budgetState=budget>0
        ?confident
          ?(budgetReferenceCost>budget?'Au-dessus du budget indicatif'
            :budgetMode!=='save'&&budgetUseRatio>=Number(policy.hardFloorRatio||0)?'Budget équilibré'
            :budgetMode!=='save'?'Sous le repère choisi':'Économies privilégiées')
          :'Budget à confirmer'
        :'';
      const costLabel=totalOccurrences
        ?pricedOccurrences
          ?`${euro(budgetReferenceCost)} estimés`
          :'Coût à compléter'
        :'Aucun achat structuré détecté';

      // La rotation persistante est enregistrée APRÈS une semaine valide. Un échec
      // de journalisation ne bloque jamais la planification.
      const recordItems=plan.filter(x=>x.recipe).map(x=>({
        day_index:x.dayIndex,candidate_id:x.recipe.recipe_id,candidate_title:x.recipe.title,is_leftover:!!x.leftover,
        candidate_signature:candidateSemanticSignature(x.recipe),
        component_keys:Array.isArray(x.recipe?._componentKeys)?x.recipe._componentKeys:[]
      }));
      let recordRes=await safeCall(sb.rpc('mt_planner_record_generation_v2',{
        p_budget_eur:budget||null,
        p_budget_mode:budgetMode,
        p_generation_score:Number(optimized.score)||0,
        p_estimated_cost_eur:Number(budgetReferenceCost)||0,
        p_items:recordItems
      }),5000,'La rotation de tes suggestions');
      if(recordRes?.error){
        recordRes=await safeCall(sb.rpc('mt_planner_record_generation_v1',{
          p_budget_eur:budget||null,
          p_budget_mode:budgetMode,
          p_generation_score:Number(optimized.score)||0,
          p_estimated_cost_eur:Number(budgetReferenceCost)||0,
          p_items:recordItems
        }),5000,'La rotation de tes suggestions');
      }
      // La session courante doit tourner immédiatement, même si la journalisation
      // distante rencontre momentanément un problème. La prochaine ouverture
      // retrouvera la mémoire persistée lorsque l'appel a réussi.
      applyLocalGenerationHistory(historyBundle,plan);

      const tierLabel=budgetMode==='save'
        ?'Priorité économies + rotation'
        :budgetMode==='variety'
          ?'Variété maximale dans ton enveloppe'
          :'Équilibre budget + variété';

      // V489.6.2 — rendu unique : l'ancien rendu V489.5.x a été supprimé.
      // Le résultat final est désormais produit uniquement par plannerRenderInteractiveV4896(),
      // afin que Pourquoi ce choix / Changer / Ne plus proposer soient toujours présents.

      window.mtLastPlannerDebug={
        version:'V489.6.3',
        budget,
        tier,
        budgetMode,
        coverage,
        totalDocumented,
        purchaseQuote,
        curated:{published:curatedRows.length,ready:curatedCatalogReady,minimumReady:21,priced:curatedBuild.pricedMeals||0,directCiqualComposite:(compositeBuild.candidates||[]).length,rawAssemblyFallbackUsed:false,safeHybridFallback:true},
        optimizer:{score:optimized.score,cost:optimized.cost,poolSize:optimized.poolSize,reliableUsed:optimized.reliableUsed,capabilities:optimized.capabilities,generationRound,dynamicMinimum:0,dynamicTarget:0,dynamicMaximum:0,dynamicUsed:0,specificCulturalUsed:optimized.specificCulturalUsed,overlapLast:optimized.overlapLast,maxImmediateOverlap:optimized.maxImmediateOverlap,strictDynamicRotation:optimized.strictDynamicRotation,budgetFloorEnforced:!!optimized.budgetFloorEnforced,budgetFloorQualityProtected:!!optimized.budgetFloorQualityProtected,budgetFloorRatio:Number(optimized.budgetFloorRatio||0),budgetFloorSecondPassUsed:!!optimized.budgetFloorSecondPassUsed,budgetFloorSearchAttempted:!!optimized.budgetFloorSearchAttempted,budgetUseRatio,varietyRelaxationUsed:Number(optimized.varietyRelaxationUsed||0),trueVarietyCounts:optimized.trueVarietyCounts||{},historyPersisted:!recordRes?.error},
        memory:{active:memoryState.active,strong:memoryState.strong,plannerMeals:memoryState.mealCount,plannerDays:memoryState.days,noveltyUsed,accessibleDiscoveryUsed,specificDiscoveryUsed,memoryGuidedTarget,memoryGuidedUsed,memoryOpenTarget,memoryOpenUsed,reliableFallbackUsed,feedbackRemote:!!feedbackState.remote,rejectedMeals:feedbackState.rejected.size,replacedMeals:feedbackState.replaced.size,brainStage:globalBrain?.stage||null,brainConfidence:Number(globalBrain?.confidence||0),source:memoryBundle?.source||null},
        plan:plan.map(x=>({
          day:x.day,
          restaurant:!!x.restaurant,
          leftover:!!x.leftover,
          repeat:!!x.repeat,
          recipe:x.recipe?.title||null,
          sourceKind:x.recipe?x.recipe._meta?.source_kind:null,
          discoveryLevel:x.recipe?x.recipe._effectiveDiscoveryLevel:null,
          memoryAffinity:x.recipe?Number(x.recipe._memoryAffinity||0):null,
          memoryRank:x.recipe?Number(x.recipe._memoryRank||0):null,
          traits:x.recipe?x.recipe._traits:null,
          recommendationPenalty:x.recipe?recommendationPenalty(x.recipe,historyBundle.map):null,
          componentRotationPenalty:x.recipe?componentRotationPenalty(x.recipe,historyBundle.componentMap):null,
          componentKeys:x.recipe?(x.recipe._componentKeys||[]):[],
          wasInPreviousGeneration:x.recipe?historyBundle.lastGenerationIds.has(String(x.recipe.recipe_id||'')):false,
          recentExact:x.recipe?!!x.recipe._recentExact:false,
          cost:x.recipe?x.recipe._missingDocumentedCost:null,
          costCoverage:x.recipe?x.recipe._missingPriceCoverage:null
        }))
      };
      await plannerRenderInteractiveV4896({
        result,plan,candidates,pTok,budget,budgetMode,servings,memoryState,globalBrain,tierLabel,
        feedbackState,userId:user.id,generationRound,availableDays,
        varietyRelaxation:Number(optimized.varietyRelaxationUsed||0),sessionSkipped:new Set()
      },{
        shopRows,pricedOccurrences,totalOccurrences,totalDocumented,coverage,purchaseQuote,
        packageCoverage,freshPackageCoverage,purchaseKnownCoverage,purchaseEstimated,
        ...strictPurchaseSummary,...hybridBudget,
        usePurchaseReference,budgetReferenceCost
      });
      orientPlannerResult(result,{behavior:'smooth'});
    }catch(e){
      result.innerHTML=`<div class="mt-next-result is-alert"><b>Planification interrompue</b><p>${esc(e?.message||'Impossible de construire la semaine pour le moment.')}</p><button type="button" class="mt-next-secondary" onclick="location.reload()">Réessayer</button></div>`;
    }finally{
      go.disabled=false;
      go.removeAttribute('aria-busy');
    }
  };
}

async function init(){
  try{
    tabs();
    await auth();
    await (({planner,safety}[tool]||planner)());
  }catch(e){
    showOpenError(e);
  }
}
document.addEventListener('DOMContentLoaded',init);
})();
