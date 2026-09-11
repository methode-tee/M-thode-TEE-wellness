(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded',async()=>{
    const F=window.MTFood;if(!F)return;const ctx=await F.auth();if(!ctx)return;const {sb,user}=ctx;
    const inputSection=document.getElementById('foodAdapterInput'),resultSection=document.getElementById('foodAdapterResult'),text=document.getElementById('adapterText');
    const goalsBox=document.getElementById('adapterGoals'),preview=document.getElementById('adapterPhotoPreview'),photoInput=document.getElementById('adapterPhotoInput'),questionBox=document.getElementById('adapterSmartQuestion');
    let selectedGoal='autre',linkedMeal=null,structuredItems=[],smartAnswers=[],questionKey='',photoFile=null,photoPath='',adapterContext=null;
    const goalLabels={autre:'Sans intention particulière',equilibre:'Équilibre',digestion:'Digestion',energie:'Énergie',prise_masse:'Nourrir & construire',perte_poids:'Retrouver de la légèreté'};
    const intentionCopy=goal=>goal==='autre'?'':` pour l’intention « ${goalLabels[goal]||goal} »`;

    function ensureAdapterContextCSS(){if(document.getElementById('mtAdapterContextCSS'))return;const st=document.createElement('style');st.id='mtAdapterContextCSS';st.textContent=`.mt-food-context-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.mt-food-context-chip{display:inline-flex;gap:6px;align-items:center;padding:8px 10px;border-radius:999px;background:#f4efe6;color:#31544a;font-size:12px;line-height:1.2}.mt-food-context-chip b{font-weight:700}.mt-food-personal-context small{display:block}`;document.head.appendChild(st);}

    const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[’']/g,"'");
    const words=s=>normalize(s).split(/\s+/).filter(Boolean);
    function hasCompositeCategory(row){return (row?.categories||[]).includes('composite_dish')||normalize(row?.adapter_profile?.adapter_family||'').includes('composite');}
    function trustedResolvedSegments(ctx){
      return (ctx?.resolved?.segments||[]).filter(seg=>{
        const input=normalize(seg?.input),matched=normalize(seg?.matched_name),composite=(seg?.categories||[]).includes('composite_dish')||(seg?.roles||[]).includes('composite');
        if(!input)return false;
        if(!composite)return true;
        if(input===matched)return true;
        // Un plat composé ne peut pas être déduit d'un préfixe générique comme « poulet » -> « Poulet DG ».
        return words(input).length>=2&&matched.startsWith(`${input} `);
      });
    }
    function safeResolvedRoles(ctx){return [...new Set(trustedResolvedSegments(ctx).flatMap(seg=>seg?.roles||[]))];}
    function explicitNamedDish(raw,row){
      if(!hasCompositeCategory(row))return false;
      const r=normalize(raw),names=[row?.canonical_name,row?.display_name].map(normalize).filter(Boolean);
      return names.some(name=>{
        if(r===name)return true;
        if(words(name).length<2)return false;
        return (` ${r} `).includes(` ${name} `);
      });
    }
    function friendlyProteinLabel(value){
      const raw=String(value||'').trim(),n=normalize(raw);
      if(!raw)return '';
      if(/\bpoulet\b/.test(n))return 'poulet';
      if(/\bdinde\b/.test(n))return 'dinde';
      if(/\bboeuf\b/.test(n))return 'bœuf';
      if(/\bporc\b/.test(n))return 'porc';
      if(/\b(agneau|mouton)\b/.test(n))return 'agneau';
      if(/\bsaumon\b/.test(n))return 'saumon';
      if(/\bthon\b/.test(n))return 'thon';
      if(/\b(tilapia|dorade|maquereau|sardine|poisson)\b/.test(n))return 'poisson';
      if(/\b(crevette|gamba)\w*\b/.test(n))return 'crevettes';
      if(/\b(oeuf|œuf)\w*\b/.test(n))return 'œufs';
      if(/\btofu\b/.test(n))return 'tofu';
      if(/\btempeh\b/.test(n))return 'tempeh';
      if(/\blentille\w*\b/.test(n))return 'lentilles';
      if(/\bpois chiche\w*\b/.test(n))return 'pois chiches';
      if(/\bharicot\w*\b/.test(n))return 'haricots';
      if(/\b(skyr|yaourt grec|fromage blanc)\b/.test(n))return 'produit laitier protéiné';
      return raw.split(',')[0].trim();
    }
    function withArticle(label){
      const n=normalize(label);if(!n)return '';
      if(['poulet','boeuf','porc','saumon','thon','poisson','tofu','tempeh'].includes(n))return `du ${label}`;
      if(['dinde'].includes(n))return `de la ${label}`;
      if(['oeufs','crevettes','lentilles','pois chiches','haricots'].includes(n))return `des ${label}`;
      return label;
    }
    const lexicon=[
      [/\b(pain|baguette|bun|brioche|tortilla|wrap|riz|quinoa|pates?|nouilles?|semoule|couscous|mil|fonio|manioc|igname|plantain|pomme de terre|patate|frites?)\b/,'starch'],
      [/\b(steak|boeuf|porc|agneau|mouton|chevre|cabri|poulet|dinde|canard|escalope|thon|saumon|poisson|tilapia|dorade|maquereau|sardines?|crevettes?|gambas?|crabe|oeufs?|saucisses?|merguez|tofu|tempeh|lentilles?|pois chiches?|pois casses?|feves?|haricots?)\b/,'protein'],
      [/\b(yaourt grec|skyr|fromage blanc|yaourt nature|yaourt soja|lait de soja|boisson soja|petit suisse|lait(?! d[' ]?(?:amande|amandes|coco|avoine)))\b/,'dairy_protein'],
      [/\b(lait d'amande|lait d'amandes|lait de coco|lait d'avoine|boisson amande|boisson coco|boisson avoine)\b/,'plant_drink'],
      [/\b(cheddar|fromage|mozzarella|emmental|parmesan|raclette)\b/,'cheese'],[/\b(bacon|lardons?|charcuterie|jambon sec|saucisson|saucisses?|merguez)\b/,'charcuterie'],
      [/\b(mayonnaise|mayo|sauce burger|sauce fromagere|creme|creme fraiche|aioli|arachide|cacahuete|graine de palme|huile de palme|lait de coco|creme de coco)\b/,'rich_sauce'],[/\b(ketchup|sauce barbecue|bbq|sauce sucree)\b/,'sweet_sauce'],
      [/\b(salade|tomates?|courgettes?|carottes?|brocolis?|epinards?|haricots verts|concombre|poivrons?|aubergines?|crudites?|legumes?|gombo|feuilles)\b/,'vegetable'],
      [/\b(ratatouille|tian de legumes|poelee de legumes|legumes cuisines|legumes grilles)\b/,'vegetable'],[/\b(omelette|oeufs brouilles?)\b/,'protein'],[/\b(houmous|hummus)\b/,'protein'],[/\b(taboule|tabbouleh)\b/,'starch'],
      [/\b(frites?|friture|pane|beignet|onions? rings?|oignons? frits?)\b/,'fried'],[/\b(soda|cola|limonade|jus|boisson sucree|energy drink)\b/,'sugary_drink'],
      [/\b(avocat|huile d'olive|huile|amandes?|noix|noix de cajou|graines?|chia|chanvre|lin)\b/,'nuts_seeds'],[/\b(dattes?|fruit|banane|pomme|poire|orange|fruits rouges|framboises?|myrtilles?|fraises?|mures?|cassis|mangue|ananas|peche)\b/,'fruit'],
      [/\b(muesli|granola|flocons? d'avoine|avoine|porridge)\b/,'wholegrain'],[/\b(miel|sirop|sucre vanille|sucre ajoute)\b/,'added_sugar'],
      [/\b(extrait de vanille|gousse de vanille|vanille en poudre|vanille)\b/,'aromatic']
    ];
    const sideDishRx=/\b(foutou|placali|eba|amala|pounded yam|banku|kenkey|atti[eé]k[eé]|chikwangue|kwanga|taro)\b/;

    function nutritionTotals(items){return (items||[]).reduce((a,x)=>{a.kcal+=Number(x.kcal)||0;a.protein+=Number(x.protein)||0;a.fiber+=Number(x.fiber)||0;a.carbs+=Number(x.carbs)||0;a.fat+=Number(x.fat)||0;a.salt+=Number(x.salt)||0;return a;},{kcal:0,protein:0,fiber:0,carbs:0,fat:0,salt:0});}
    function parseMeal(raw,knowledge=[],structured=[],answers=[],serverCtx=null){
      const base=structured.length?structured.map(x=>x.food_name||x.name).filter(Boolean).join(', '):raw,n=normalize(`${base} ${structured.length?raw:''}`),rawN=normalize(raw),found=[];
      const push=(label,category,source)=>{if(!found.some(x=>x.category===category&&normalize(x.label)===normalize(label)))found.push({label,category,source});};
      for(const [rx,cat] of lexicon)for(const m of n.matchAll(new RegExp(rx.source,'g')))push(m[0],cat,'local');
      knowledge.forEach(k=>(k.categories||[]).forEach(c=>push(c,c,'dictionary')));
      answers.forEach(a=>(a.categories||[]).forEach(c=>push(a.label,c,'confirmed')));
      const structuralRoles=[...new Set([...safeResolvedRoles(serverCtx),...(serverCtx?.current?.roles||[])])];
      structuralRoles.forEach(role=>{
        const category={protein:'protein',starch:'starch',vegetable:'vegetable',fruit:'fruit',fat:'nuts_seeds',composite:'composite_dish'}[role];
        if(category)push(`Bibliothèque Tee · ${role}`,category,'library_role');
      });
      const namedDish=knowledge.find(k=>k.__wholeDish===true)||null;
      const flags=namedDish?{...(namedDish.adapter_profile||{})}:{};
      const names=knowledge.map(k=>normalize(k.canonical_name)).join(' ');
      const knownCategories=new Set(knowledge.flatMap(k=>k.categories||[]));
      const explicitFound=found.filter(x=>x.source==='local'||x.source==='confirmed'||x.source==='library_role');
      const explicit={
        protein:explicitFound.some(x=>x.category==='protein'||x.category==='dairy_protein'),
        starch:explicitFound.some(x=>x.category==='starch'||x.category==='wholegrain'),
        plant:explicitFound.some(x=>x.category==='vegetable'||x.category==='fruit')
      };
      const genericSalad=/\bsalade\b/.test(rawN)&&explicit.plant&&!explicit.protein&&!explicit.starch;
      const hasSweetFruit=/framboise|myrtille|fraise|mure|cassis|fruit rouge|banane|mangue|ananas|peche|poire|pomme/.test(n),hasYogurt=/yaourt|skyr|fromage blanc/.test(n),hasSweetLiquid=/lait|boisson amande|boisson coco|boisson soja|boisson avoine/.test(n);
      const preparationKind=normalize(flags.preparation_kind||(/chia/.test(n)&&/lait de coco|boisson coco/.test(n)?'pudding':hasSweetFruit&&hasSweetLiquid?'smoothie':hasSweetFruit&&hasYogurt?'verrine':''));
      const sweetContext=!!preparationKind;
      const family=genericSalad?'simple_salad':(flags.adapter_family||(preparationKind==='pudding'?'sweet_dish':/muesli|granola|avoine|porridge/.test(`${n} ${names}`)||sweetContext?'sweet_bowl':/\b(burger|hamburger|cheeseburger)\b/.test(`${n} ${names}`)?'burger':sideDishRx.test(`${n} ${names}`)?'starch_side':flags.soup?'soup':flags.composite_complete?'complete_composite':flags.composition_variable?'variable_composite':knownCategories.has('fried')&&knownCategories.has('composite_dish')?'fried_snack':knownCategories.has('protein')&&!knownCategories.has('starch')?'protein_main':'general'));
      const variable=!!flags.composition_variable,recognized=knowledge.length>0;
      const intelligence=knowledge.map(k=>k?.adapter_profile?.tee_intelligence).filter(Boolean);
      const primary=namedDish||knowledge[0]||{};
      const dishName=namedDish?(namedDish.display_name||namedDish.canonical_name||''):'';
      const genericWord=/\b(salade|sandwich|bowl|assiette|plat|menu|soupe|wrap|burger)\b/.test(rawN);
      const simpleLocal=!genericWord&&explicitFound.length===1&&['fruit','vegetable','protein','dairy_protein','starch','wholegrain','nuts_seeds'].includes(explicitFound[0]?.category);
      const serverResolved=trustedResolvedSegments(serverCtx).some(x=>(x.roles||[]).length);
      const confidence=(recognized||serverResolved)?(namedDish&&variable?'variable':'recognized'):simpleLocal?'simple':found.length>=2?'probable':'ambiguous';
      return {normalized:n,rawNormalized:rawN,found,explicit,knowledge,flags,intelligence,family,preparationKind,dishName,typical:primary.typical_components||[],optional:primary.optional_components||[],nutrition:nutritionTotals(structured),confidence,structuralRoles};
    }
    function categoriesOf(p){return p.found.reduce((a,x)=>(a[x.category]=(a[x.category]||0)+1,a),{});}
    function mealQuestion(p){
      const cats=categoriesOf(p),has=c=>(cats[c]||0)>0,explicit=p.found.some(x=>x.source==='local'||x.source==='confirmed'),proteinEvidence=has('protein')||has('dairy_protein')||p.nutrition.protein>=12;
      const dish=p.dishName||'ce plat';
      if(p.family==='sweet_bowl'&&!proteinEvidence&&!smartAnswers.length){const isFruitBlend=/framboise|myrtille|fraise|mure|cassis|fruit rouge|banane|mangue|ananas|peche/.test(p.normalized);return {key:'sweet_bowl',title:isFruitBlend?'Quelle base accompagne tes fruits ?':'Ton bol est accompagné de quoi ?',text:'Choisis tout ce qui correspond pour que Tee ne suppose rien.',multiple:true,options:[['protein','Skyr, yaourt grec ou fromage blanc',['dairy_protein']],['soy','Alternative soja protéinée',['dairy_protein']],['plant','Boisson d’amande, coco ou avoine',['plant_drink']],['nuts','Amandes, noix ou graines',['nuts_seeds']],['alone','Rien d’autre',[]]]};}
      if(p.family==='flatbread'&&!smartAnswers.length)return {key:'flatbread',title:`Comment manges-tu ${dish} ?`,text:'Cette préparation peut être servie de plusieurs façons. Choisis ta version réelle.',multiple:true,options:[['plain','Nature',[]],['sweet','Avec miel, sucre ou pâte sucrée',['added_sugar']],['dairy','Avec lait, yaourt ou fromage',['dairy_protein']],['protein','Avec œuf, viande, poisson ou légumineuses',['protein']],['vegetable','Avec des légumes ou une farce végétale',['vegetable']]]};
      if(p.family==='starch_side'&&!proteinEvidence&&!has('vegetable')&&!smartAnswers.length)return {key:'starch_side',title:'Qu’est-ce qui accompagne ce féculent ?',text:'Le conseil dépend surtout de la sauce et de la protéine réellement présentes.',multiple:true,options:[['protein','Viande, poisson, œuf ou tofu',['protein']],['legume','Légumineuses',['protein','vegetable']],['vegetable','Sauce ou légumes',['vegetable']],['rich','Sauce riche / arachide / graine',['rich_sauce']],['alone','Rien d’autre',[]]]};
      if(p.family==='burger'&&!smartAnswers.length&&(!proteinEvidence||!has('vegetable')))return {key:'burger',title:'Que contient réellement ton burger ?',text:'Sélectionne ce qui est présent pour adapter le burger sans inventer sa garniture.',multiple:true,options:[['meat','Steak, poulet ou poisson',['protein']],['plant','Galette végétale ou légumineuses',['protein','vegetable']],['vegetable','Salade, tomate ou autres légumes',['vegetable']],['cheese','Du fromage',['cheese']],['unknown','Je ne sais pas précisément',[]]]};
      if((['variable_composite','soup','sauce_dish','noodle_dish','filled_dough'].includes(p.family)||p.flags.protein_is_variable)&&!proteinEvidence&&!smartAnswers.length)return {key:p.family,title:`Que contient ta version de ${dish} ?`,text:'La recette peut varier. Sélectionne uniquement ce qui est réellement présent.',multiple:true,options:[['protein','Viande, poisson, œuf, crevettes ou tofu',['protein']],['legume','Légumineuses',['protein','vegetable']],['vegetable','Des légumes ou feuilles',['vegetable']],['starch','Riz, pain, nouilles ou autre féculent',['starch']],['rich','Sauce riche / arachide / coco',['rich_sauce']],['unknown','Je ne sais pas précisément',[]]]};
      return null;
    }

    function goalLayer(p,goal,cats){
      const has=c=>(cats[c]||0)>0,dish=p.dishName||'ce repas',rich=has('rich_sauce')||has('fried')||has('cheese')||p.nutrition.fat>=25;
      const protein=has('protein')||has('dairy_protein')||p.nutrition.protein>=12,starch=has('starch')||has('wholegrain')||p.nutrition.carbs>=25,plant=has('vegetable')||has('fruit')||p.nutrition.fiber>=4;
      if(goal==='autre')return null;
      if(p.family==='sweet_dish'){
        const isSticky=/mango sticky|riz gluant/.test(p.normalized+' '+normalize(dish));
        if(goal==='digestion')return {title:`Garder ${dish} en portion confortable`,body:isSticky?'Conserve la recette et ajuste d’abord la portion de riz gluant ou de sauce coco selon ton confort, sans supprimer la mangue.':'Conserve la préparation et ajuste d’abord la portion ou la richesse de la base crémeuse selon ton confort.',reason:'Cette préparation sucrée est reconnue dans son propre contexte.'};
        if(goal==='energie')return {title:`Utiliser ${dish} comme apport énergétique`,body:isSticky?'Le riz gluant et la mangue apportent déjà une base glucidique. Évite simplement de cumuler une autre préparation sucrée au même moment.':'Les fruits ou la base céréalière apportent déjà une énergie disponible. Complète seulement si la collation doit être plus durable.',reason:'L’intention énergie est évaluée à partir des composants réellement décrits.'};
        if(goal==='prise_masse')return {title:`Renforcer ${dish} sans le dénaturer`,body:protein?'La base protéinée est déjà présente. Ajoute seulement des graines, des oléagineux ou de l’avoine si tu as besoin d’une collation plus dense.':'Associe un yaourt grec ou une alternative soja protéinée, sans transformer la recette en repas salé.',reason:'Le complément proposé reste cohérent avec une préparation sucrée.'};
        if(goal==='perte_poids')return {title:`Ajuster seulement la portion de ${dish}`,body:'Garde le dessert complet et choisis une portion satisfaisante. N’ajoute rien automatiquement si le fruit et la base crémeuse sont déjà présents.',reason:'L’intention légèreté appelle un ajustement ciblé, pas la suppression du dessert.'};
        return {title:`Conserver l’identité de ${dish}`,body:'Garde les fruits et la base crémeuse ensemble. Ajuste seulement leur proportion selon ta faim, sans ajouter automatiquement de légumes ou de protéine salée.',reason:'Il s’agit d’une préparation sucrée cohérente dans son propre contexte.'};
      }
      if(goal==='digestion'){
        if(rich)return {title:`Rendre ${dish} plus confortable`,body:`Conserve la recette et commence par ajuster uniquement la quantité de sauce, de friture ou de matière grasse. Mange lentement et observe la portion qui te convient, sans remplacer le plat.`,reason:`L’intention choisie est la digestion et ${dish} comporte un élément potentiellement riche.`};
        if(p.family==='soup'||p.family==='noodle_dish')return {title:`Adapter le bouillon de ${dish}`,body:`Garde les ingrédients du plat. Selon ta tolérance, choisis un bouillon moins gras ou moins relevé et évite simplement de multiplier les sauces à côté.`,reason:'Pour la digestion, le premier réglage concerne le bouillon et les condiments, pas l’identité du plat.'};
        return {title:'Observer le confort après le repas',body:`Garde ${dish} tel qu’il est, mange à un rythme calme et ajuste d’abord la portion si tu te sens trop lourd·e après.`,reason:'Aucun élément précis ne justifie de retirer automatiquement un aliment.'};
      }
      if(goal==='energie'){
        if(protein&&starch)return {title:`Préserver la base énergétique de ${dish}`,body:'La combinaison féculent + protéine est déjà présente. Conserve-la et ajuste surtout la portion au moment de la journée et à ton niveau d’activité.',reason:'L’intention énergie bénéficie déjà d’une base glucidique accompagnée d’une protéine.'};
        if(!starch)return {title:'Ajouter une énergie cohérente avec le plat',body:`Associe ${dish} à son féculent habituel ou à un fruit si c’est un petit-déjeuner ou une collation.`,reason:'Aucune source glucidique claire n’est confirmée pour l’intention énergie.'};
        return {title:'Stabiliser l’énergie du repas',body:`Garde la base féculente de ${dish} et associe-la à la protéine réellement prévue dans cette recette.`,reason:'Une source d’énergie est présente, mais son accompagnement protéiné reste à confirmer.'};
      }
      if(goal==='prise_masse'){
        if(protein&&starch)return {title:`Renforcer ${dish} sans le dénaturer`,body:'Conserve la protéine et le féculent déjà présents. Augmente progressivement la portion utile ou ajoute un complément énergétique cohérent avec la recette plutôt que d’empiler plusieurs protéines.',reason:'La structure protéine + féculent est adaptée à l’intention nourrir et construire.'};
        if(!protein)return {title:'Construire autour de la protéine du plat',body:`Ajoute ou augmente la protéine qui appartient naturellement à ${dish}, puis conserve son accompagnement féculent.`,reason:'L’intention nourrir et construire nécessite de confirmer la composante protéinée.'};
        return {title:'Conserver la protéine et compléter l’énergie',body:`Garde la protéine de ${dish} et ajoute son accompagnement féculent habituel ou une portion supplémentaire adaptée à ta faim.`,reason:'La protéine est présente mais la base énergétique n’est pas clairement identifiée.'};
      }
      if(goal==='perte_poids'){
        if(rich)return {title:`Alléger un seul élément de ${dish}`,body:'Garde le plat et choisis un seul levier : un peu moins de sauce, une portion de friture plus petite ou l’absence de sauce supplémentaire. Ne retire pas simultanément tous ses composants.',reason:'L’intention légèreté est mieux servie par un ajustement ciblé que par une transformation complète du plat.'};
        if(protein&&plant)return {title:`Garder la structure rassasiante de ${dish}`,body:'La protéine et la partie végétale sont déjà présentes. Ajuste principalement la quantité de féculent ou l’accompagnement selon ta faim.',reason:'Les repères protéiné et végétal sont déjà confirmés.'};
        if(protein&&!plant)return {title:'Ajouter du volume sans changer le plat',body:`Complète ${dish} avec le légume, les feuilles ou la garniture traditionnellement compatibles avec lui, si la recette n’en contient pas déjà.`,reason:'La protéine est présente mais aucun repère végétal n’est confirmé.'};
        return {title:'Préciser avant d’alléger',body:`Ne retire rien de ${dish} sur une supposition. Confirme d’abord sa protéine, sa sauce et son accompagnement, puis ajuste uniquement l’élément le plus concentré.`,reason:'La composition est encore trop incertaine pour proposer une réduction pertinente.'};
      }
      if(protein&&starch&&plant)return {title:p.dishName?`Conserver l’équilibre de ${dish}`:'Conserver l’équilibre du repas',body:'Les principaux repères sont déjà présents. Ne rajoute rien automatiquement et ajuste seulement les quantités selon ta faim.',reason:'La protéine, la base énergétique et la partie végétale sont confirmées.'};
      if(protein&&starch)return {title:`Compléter ${dish} sans le transformer`,body:'La protéine et le féculent sont présents. Vérifie seulement si la recette comporte déjà des légumes ou une garniture végétale avant d’en ajouter.',reason:'La structure principale est présente, mais la partie végétale n’est pas confirmée.'};
      return null;
    }

    function teeSpecificChoice(p,goal,cats){
      const has=c=>(cats[c]||0)>0,dish=p.dishName||'ce repas',n=p.normalized;
      const protein=has('protein')||has('dairy_protein')||p.nutrition.protein>=12,starch=has('starch')||has('wholegrain')||p.nutrition.carbs>=25,plant=has('vegetable')||has('fruit')||p.nutrition.fiber>=4;
      const salad=/\b(salade|tomates?|concombre|crudites?)\b/.test(n)&&plant&&!protein&&!starch;
      const byGoal=(choices)=>choices[goal]||choices.equilibre;
      const optional=(p.optional||[]).map(String),typical=(p.typical||[]).map(String),pick=(list,rx)=>list.find(x=>rx.test(normalize(x)));
      const optionalProtein=pick(optional,/crevette|poisson|thon|poulet|oeuf|boeuf|porc|viande|tofu|legumineuse|haricot|pois chiche|arachide/);
      const asIngredient=value=>{const v=normalize(value);if(/crevette/.test(v))return 'des crevettes';if(/thon/.test(v))return 'du thon';if(/poisson/.test(v))return 'du poisson grillé';if(/poulet/.test(v))return 'du poulet';if(/oeuf/.test(v))return 'un œuf';if(/boeuf/.test(v))return 'du bœuf';if(/porc/.test(v))return 'du porc';if(/tofu/.test(v))return 'du tofu';if(/arachide/.test(v))return 'une poignée d’arachides';if(/haricot|pois chiche|legumineuse/.test(v))return 'une portion de pois chiches';if(/viande/.test(v))return 'du poulet';return value;};
      const preciseOptional=optionalProtein?asIngredient(optionalProtein):'';
      const vegetableCandidate=pick([...typical,...optional],/tomate|oignon|poivron|carotte|courgette|champignon|chou|epinard|gombo|feuille|concombre|papaye verte|legume/);
      const preciseVegetable=vegetableCandidate?(()=>{const v=normalize(vegetableCandidate);if(/tomate/.test(v))return 'des tomates';if(/oignon/.test(v))return 'de l’oignon';if(/poivron/.test(v))return 'du poivron';if(/carotte/.test(v))return 'des carottes';if(/courgette/.test(v))return 'des courgettes';if(/champignon/.test(v))return 'des champignons';if(/chou/.test(v))return 'du chou émincé';if(/epinard|feuille/.test(v))return 'des feuilles vertes';if(/gombo/.test(v))return 'du gombo';if(/concombre/.test(v))return 'du concombre';if(/papaye verte/.test(v))return 'de la papaye verte';return '';})():'';

      if(salad){
        const ingredient=byGoal({equilibre:'une portion de pois chiches',digestion:'un œuf dur',energie:'une portion de quinoa',prise_masse:'une portion de lentilles',perte_poids:'du thon au naturel',autre:'une portion de pois chiches'});
        return `J’ajouterais ${ingredient} à cette salade. C’est l’ajout précis que je choisirais${intentionCopy(goal)}, sans modifier les tomates ni les oignons.`;
      }
      if(p.family==='sweet_bowl'){
        const ingredient=byGoal({equilibre:'un skyr nature',digestion:'un yaourt nature',energie:'une banane',prise_masse:'une cuillère de purée d’amandes',perte_poids:'une poignée de fruits rouges',autre:'un skyr nature'});
        const preparation=p.preparationKind==='smoothie'?'smoothie':p.preparationKind==='verrine'?'verrine':'bol',feminine=preparation==='verrine';
        return protein&&plant?`Je n’ajouterais aucun ingrédient : ${feminine?'la':'le'} ${preparation} possède déjà une base cohérente, une protéine et un repère fruit ou fibre.`:`J’ajouterais ${ingredient}. C’est l’ingrédient le plus cohérent avec ${feminine?'cette':'ce'} ${preparation}${intentionCopy(goal)}.`;
      }
      if(p.family==='sweet_dish'){
        if(goal==='prise_masse'&&!protein)return `J’ajouterais un yaourt grec ou une alternative soja protéinée à côté de ${dish}, sans modifier la recette.`;
        if(goal==='energie'&&!starch)return `J’ajouterais une banane ou une petite portion de flocons d’avoine à ${dish}.`;
        return `Je n’ajouterais aucun ingrédient salé à ${dish}. J’ajusterais uniquement la portion ou un accompagnement sucré cohérent${intentionCopy(goal)}.`;
      }
      if(p.family==='burger'){
        if(!protein)return 'Je préciserais d’abord le cœur du burger ; je n’ajouterais aucune protéine au hasard.';
        if(!plant)return 'J’ajouterais deux rondelles de tomate et quelques feuilles de salade directement dans le burger.';
        return 'Je n’ajouterais aucun ingrédient : le burger contient déjà sa protéine et sa garniture. J’ajusterais seulement la sauce ou les frites.';
      }
      if(p.family==='starch_side'){
        if(!protein){const ingredient=preciseOptional||byGoal({equilibre:'du poisson grillé',digestion:'du poisson blanc grillé',energie:'du poulet grillé',prise_masse:'du poulet et sa sauce',perte_poids:'du poisson grillé',autre:'du poisson grillé'});return `J’ajouterais ${ingredient} à ${dish}, en conservant la sauce ou l’accompagnement traditionnel réellement prévu.`;}
        if(!plant)return `J’ajouterais ${preciseVegetable||byGoal({equilibre:'des épinards',digestion:'des carottes cuites',energie:'des petits pois',prise_masse:'des petits pois',perte_poids:'des haricots verts',autre:'des épinards'})} dans la sauce servie avec ${dish}, sans remplacer le féculent.`;
        return `Je n’ajouterais aucun ingrédient à ${dish} : le féculent, la protéine et la partie végétale sont déjà confirmés.`;
      }
      if(['sauce_dish','soup','noodle_dish','filled_dough','variable_composite'].includes(p.family)){
        if(!protein){const ingredient=preciseOptional||byGoal({equilibre:'du tofu',digestion:'du poisson blanc',energie:'du poulet',prise_masse:'du poulet',perte_poids:'du poisson',autre:'du tofu'});return `J’ajouterais ${ingredient} dans cette version de ${dish}. C’est la variante protéinée précise que je privilégierais${intentionCopy(goal)}.`;}
        if(!plant&&!p.flags.already_contains_vegetable){const ingredient=preciseVegetable||(p.family==='noodle_dish'?'des champignons et du pak-choï':p.family==='filled_dough'?'du chou finement émincé':p.family==='soup'?'des carottes':'des courgettes');return `J’ajouterais ${ingredient} à ${dish}, sans modifier sa protéine ni sa base.`;}
        return `Je n’ajouterais aucun ingrédient à ${dish}. Sa protéine et sa partie végétale sont déjà présentes ; j’ajusterais seulement la sauce, le bouillon ou la portion selon l’intention.`;
      }
      if(p.family==='fried_snack'){
        if(!protein)return `J’ajouterais ${preciseOptional||byGoal({equilibre:'un œuf dur',digestion:'un œuf dur',energie:'une banane',prise_masse:'une portion de haricots',perte_poids:'un œuf dur',autre:'un œuf dur'})} à côté de ${dish}, sans ajouter une seconde friture.`;
        return `Je n’ajouterais aucune autre friture à ${dish}. Je choisirais des tomates et des oignons frais comme accompagnement précis.`;
      }
      if(p.family==='protein_main'){
        if(!starch){const ingredient=byGoal({equilibre:'une portion de riz',digestion:'une portion de riz basmati',energie:'une portion de patate douce',prise_masse:'une portion de riz',perte_poids:'une petite portion de quinoa',autre:'une portion de riz'});return `J’ajouterais ${ingredient} à ${dish}.` ;}
        if(!plant)return `J’ajouterais ${preciseVegetable||'des courgettes rôties'} à ${dish}, sans augmenter la quantité de protéine.`;
        return p.dishName?`Je n’ajouterais aucun ingrédient à ${dish} : ses accompagnements utiles sont déjà présents.`:'Je n’ajouterais rien automatiquement : les principaux repères du repas sont déjà présents.';
      }
      if(p.family==='complete_composite'){
        if(!protein){const ingredient=preciseOptional||byGoal({equilibre:'des pois chiches',digestion:'un œuf',energie:'du poulet',prise_masse:'du poulet',perte_poids:'du poisson',autre:'des pois chiches'});return `J’ajouterais ${ingredient} à cette version de ${dish}, uniquement si la recette servie n’en contient pas déjà.`;}
        if(!plant)return `J’ajouterais ${preciseVegetable||byGoal({equilibre:'des courgettes rôties',digestion:'des carottes cuites',energie:'des petits pois',prise_masse:'des petits pois',perte_poids:'des haricots verts',autre:'des courgettes rôties'})} à ${dish}, sans modifier la protéine ni le féculent.`;
        return `Je n’ajouterais aucun ingrédient à ${dish} : sa structure est déjà complète${intentionCopy(goal)}.`;
      }
      if(!protein){const ingredient=byGoal({equilibre:'une portion de pois chiches',digestion:'un œuf dur',energie:'du poulet',prise_masse:'une portion de lentilles',perte_poids:'du thon au naturel',autre:'une portion de pois chiches'});return `J’ajouterais ${ingredient} à ce repas. C’est mon choix précis${intentionCopy(goal)}.`;}
      if(!starch&&goal==='energie')return 'J’ajouterais une portion de quinoa pour apporter une base énergétique précise.';
      if(!starch&&goal==='prise_masse')return 'J’ajouterais une portion de riz pour compléter l’énergie du repas.';
      if(!plant)return 'J’ajouterais des courgettes rôties, sans modifier le reste du repas.';
      return 'Je n’ajouterais aucun ingrédient : les principaux repères du repas sont déjà présents.';
    }
    function mealMoment(type){
      const map={breakfast:{key:'breakfast',label:'petit-déjeuner',order:1},lunch:{key:'lunch',label:'déjeuner',order:2},snack:{key:'snack',label:'collation',order:3},dinner:{key:'dinner',label:'dîner',order:4}};
      return map[type]||{key:'meal',label:'repas',order:9};
    }
    function humanContextLabel(label){
      const raw=String(label||'').trim(),n=normalize(raw);
      if(n==='alimentation day'||n==='alimentation_day'||n==='food day')return 'Alimentation du jour';
      if(n==='activite quotidienne')return 'Activité quotidienne';
      return raw.replace(/\bday\b/gi,'du jour').replaceAll('_',' ');
    }
    function humanContextText(value){
      let text=String(value||'');
      const replacements=[
        ['Tes protéines documentées sont sous ton repère actuel : Tee priorise la proposition protéinée déjà cohérente avec ce plat.','Ton apport protéique renseigné est encore léger aujourd’hui. Tee met simplement en avant une option protéinée cohérente avec ce repas.'],
        ['Le repère protéique réordonne seulement une proposition culinaire déjà pertinente.','Comme ton apport protéique renseigné aujourd’hui reste léger, une option protéinée cohérente avec ce repas est mise en avant.'],
        ['Tes fibres documentées sont sous ton repère actuel : Tee met en avant l’option végétale déjà cohérente avec ce repas.','Tes fibres renseignées sont encore légères aujourd’hui. Tee met simplement en avant une option végétale cohérente avec ce repas.'],
        ['Le repère fibres influence l’ordre uniquement lorsqu’une proposition compatible existe déjà.','Comme tes fibres renseignées aujourd’hui restent légères, une option végétale cohérente avec ce repas est mise en avant.'],
        ['Ce conseil garde la précision du moteur alimentaire et utilise tes données du jour en priorité, puis tes tendances récentes seulement lorsqu’elles sont suffisamment documentées.','TEE s’appuie d’abord sur ce que tu as renseigné aujourd’hui, puis sur tes tendances récentes lorsqu’elles sont suffisamment documentées.']
      ];
      replacements.forEach(([from,to])=>{text=text.replace(from,to);});
      return text;
    }
    function humanizeAnalysis(analysis){
      if(!analysis)return analysis;
      analysis.personalContextLine=humanContextText(analysis.personalContextLine||'');
      analysis.why=(analysis.why||[]).map(humanContextText);
      const pc=analysis.parsed?.personal_context;
      if(pc)analysis.parsed={...(analysis.parsed||{}),personal_context:{...pc,line:humanContextText(pc.line||'')}};
      return analysis;
    }
    function proteinMentions(value){
      const n=normalize(value),rules=[
        [/\bpoulet\b/,'poulet'],[/\bdinde\b/,'dinde'],[/\bboeuf\b|\bbœuf\b/,'bœuf'],[/\bporc\b/,'porc'],[/\bagneau\b|\bmouton\b/,'agneau'],
        [/\bsaumon\b/,'saumon'],[/\bthon\b/,'thon'],[/\b(poisson|tilapia|dorade|maquereau|sardine)\b/,'poisson'],[/\b(crevette|gamba)\w*\b/,'crevettes'],
        [/\b(oeuf|œuf)\w*\b/,'œufs'],[/\btofu\b/,'tofu'],[/\btempeh\b/,'tempeh'],[/\blentille\w*\b/,'lentilles'],[/\bpois chiche\w*\b/,'pois chiches'],
        [/\bharicot\w*\b/,'haricots'],[/\b(skyr|yaourt grec|fromage blanc)\b/,'produit laitier protéiné']
      ];
      return [...new Set(rules.filter(([rx])=>rx.test(n)).map(([,label])=>label))];
    }
    async function loadDayMealContext(mealDate){
      try{
        const {data:meals,error}=await sb.from('food_meals').select('id,meal_type,meal_time,description,source_recipe_title').eq('user_id',user.id).eq('meal_date',mealDate).order('meal_time',{ascending:true});
        if(error)throw error;
        const current=linkedMeal,cm=mealMoment(current?.meal_type),ct=String(current?.meal_time||'').slice(0,5);
        const earlier=(meals||[]).filter(m=>{
          if(current?.id&&m.id===current.id)return false;
          const mt=String(m.meal_time||'').slice(0,5);
          if(ct&&mt)return mt<ct;
          return mealMoment(m.meal_type).order<cm.order;
        });
        if(!earlier.length)return {meal_count:0,proteins:[],meal_labels:[]};
        const ids=earlier.map(m=>m.id).filter(Boolean);let items=[];
        if(ids.length){const r=await sb.from('food_meal_items').select('meal_id,food_name').in('meal_id',ids);if(!r.error)items=r.data||[];}
        const textParts=[...earlier.flatMap(m=>[m.source_recipe_title,m.description]),...items.map(i=>i.food_name)].filter(Boolean);
        return {meal_count:earlier.length,proteins:[...new Set(textParts.flatMap(proteinMentions))],meal_labels:earlier.map(m=>m.source_recipe_title||m.description||mealMoment(m.meal_type).label).filter(Boolean).slice(0,4)};
      }catch(e){console.warn('day meal context',e);return {meal_count:null,proteins:[],meal_labels:[],unavailable:true};}
    }
    function applyMomentContext(analysis,mealType){
      const moment=mealMoment(mealType),recs=[...(analysis.recommendations||[])];
      analysis.parsed={...(analysis.parsed||{}),meal_moment:{key:moment.key,label:moment.label}};
      if(!recs.length)return analysis;
      const adaptProtein=(r)=>{
        const hay=normalize(`${r.title||''} ${r.body||''}`);
        if(!/proteine|protein/.test(hay))return r;
        if(moment.key==='breakfast'&&!analysis.parsed?.family?.includes?.('sweet'))return {...r,body:`Pour ce petit-déjeuner, garde le style réel du repas : œuf si c’est salé, ou skyr / yaourt riche en protéines / alternative soja protéinée si c’est sucré. Inutile de transformer le repas.`};
        if(moment.key==='snack')return {...r,title:'La compléter si tu en as besoin',body:`Ta collation peut rester telle quelle. Si tu veux qu’elle te tienne davantage aujourd’hui, associe-la simplement à une petite source protéinée cohérente avec ce que tu manges déjà, par exemple un skyr, un yaourt riche en protéines ou une alternative soja.`};
        return r;
      };
      analysis.recommendations=recs.map(r=>{
        let out=adaptProtein(r),hay=normalize(`${out.title||''} ${out.body||''}`);
        if(moment.key==='snack'&&/repere vegetal|legume|vegetal/.test(hay)&&!analysis.parsed?.family?.includes?.('sweet'))out={...out,body:`Une collation n’a pas besoin de reproduire une assiette complète. Ajoute un fruit ou un élément végétal seulement si cela correspond à ta faim et au type de collation.`};
        return out;
      });
      return analysis;
    }
    function applyDayMealContext(analysis,ctx){
      if(!analysis||!ctx||ctx.unavailable||!ctx.meal_count)return analysis;
      const proteins=[...new Set((ctx.proteins||[]).map(friendlyProteinLabel).filter(Boolean))],seenLabels=proteins.slice(0,2),seen=seenLabels.map(withArticle).join(' et ');
      if(seen){
        const recs=[...(analysis.recommendations||[])],idx=recs.findIndex(r=>/proteine|poulet|dinde|boeuf|bœuf|poisson|saumon|thon|oeuf|œuf|tofu|lentille|pois chiche/i.test(`${r.title||''} ${r.body||''}`));
        if(idx>=0)recs[idx]={...recs[idx],body:`${recs[idx].body} Tu as déjà eu ${seen} plus tôt aujourd’hui. Si tu veux varier, choisis simplement une autre source qui va avec ce repas plutôt que de reprendre automatiquement la même.`};
        analysis.recommendations=recs;
        const existing=analysis.parsed?.personal_context||{},line=`${existing.line?`${existing.line} `:''}TEE tient aussi compte de ce que tu as déjà mangé aujourd’hui : tu as déjà renseigné ${seen} plus tôt.`;
        analysis.parsed={...(analysis.parsed||{}),day_meal_context:{meal_count:ctx.meal_count,proteins:seenLabels},personal_context:{...existing,line}};
        analysis.personalContextLine=line;
      }else analysis.parsed={...(analysis.parsed||{}),day_meal_context:{meal_count:ctx.meal_count,proteins:[]}};
      return analysis;
    }
    function reconcileContextWithStructure(analysis,ctx,goal){
      if(!analysis)return analysis;
      const structure=mealStructure(analysis,ctx),main=['lunch','dinner'].includes(mealMoment(linkedMeal?.meal_type||ctx?.meal?.meal_type||'').key);
      if(structure.vegetable){
        const dayProteins=(analysis.parsed?.day_meal_context?.proteins||[]).map(friendlyProteinLabel).filter(Boolean).slice(0,2);
        const dayNote=dayProteins.length?` TEE tient aussi compte de ce que tu as déjà mangé aujourd’hui : tu as déjà renseigné ${dayProteins.map(withArticle).join(' et ')} plus tôt.`:'';
        const fiberNote=`Tes fibres documentées aujourd’hui restent peut-être encore légères, mais ce repas contient déjà une composante végétale. TEE n’ajoute pas un autre légume uniquement pour faire monter un chiffre.${dayNote}`;
        const rx=/fibres?.*(veget|legume)|option vegetale|repere vegetal/i;
        if(rx.test(normalize(analysis.personalContextLine||'')))analysis.personalContextLine=fiberNote;
        if(analysis.parsed?.personal_context&&rx.test(normalize(analysis.parsed.personal_context.line||'')))analysis.parsed={...(analysis.parsed||{}),personal_context:{...analysis.parsed.personal_context,line:fiberNote}};
        analysis.why=(analysis.why||[]).filter(x=>!rx.test(normalize(x)));
      }
      if(goal==='autre'&&main&&structure.protein&&structure.starch&&structure.vegetable){
        const current=analysis.parsed?.nutrition||{},quantified=[current.protein,current.carbs,current.fat,current.fiber,current.kcal].some(v=>Number(v)>0);
        const alreadyProteinPortion=(analysis.recommendations||[]).some(r=>/renforcer legerement la portion proteinee/.test(normalize(r.title)));
        if(!alreadyProteinPortion){
          analysis.recommendations=[{title:'Garde ton repas comme prévu',body:quantified?'Ton repas associe déjà une source de protéines, un féculent et une partie végétale. Aucun ajout n’est prioritaire avec les informations disponibles.':'Ton repas associe déjà une source de protéines, un féculent et une partie végétale. Les quantités ne sont pas toutes précisées, donc TEE ne juge pas ici les portions.'}];
          analysis.why=['Les principales composantes du repas sont réellement présentes.'];
          analysis._teeChoiceBody=analysis.recommendations[0].body;
          analysis._basePrimaryTitle=analysis.recommendations[0].title;analysis._basePrimaryBody=analysis.recommendations[0].body;
        }
      }
      return analysis;
    }

    function finalizeAdaptation(analysis){
      const candidates=[...(analysis.recommendations||[])].slice(0,3);
      const primary=candidates[0]||{title:'Ne change presque rien',body:'Ton repas peut rester tel quel. Ajuste seulement la quantité selon ta faim et ton ressenti.'};
      const complements=candidates.slice(1,3).filter(r=>normalize(r.title)!==normalize(primary.title)||normalize(r.body)!==normalize(primary.body));
      const keepSpecific=analysis._teeChoiceBody&&normalize(analysis._basePrimaryTitle)===normalize(primary.title)&&normalize(analysis._basePrimaryBody)===normalize(primary.body);
      analysis.signature={title:primary.title||'Le choix de Tee',body:keepSpecific?analysis._teeChoiceBody:(primary.body||'')};
      analysis.recommendations=complements;
      return analysis;
    }

    function n(value){if(value===null||value===undefined||value==='')return null;const x=Number(value);return Number.isFinite(x)?x:null;}
    async function loadAdapterContext(mealDate,raw){
      const args={p_meal_id:linkedMeal?.id||null,p_meal_date:mealDate,p_input_text:raw};
      try{
        const v2=await sb.rpc('mt_adapt_meal_context_v2',args);
        if(!v2.error&&v2.data&&typeof v2.data==='object')return v2.data;
        if(v2.error)console.warn('adapter context v2 fallback',v2.error);
        const v1=await sb.rpc('mt_adapt_meal_context_v1',args);
        if(v1.error)throw v1.error;
        return v1.data&&typeof v1.data==='object'?v1.data:null;
      }catch(e){console.warn('adapter compact context fallback',e);return null;}
    }
    function contextKnowledge(ctx,raw=''){
      const rows=[];
      trustedResolvedSegments(ctx).forEach(x=>{
        if(!x||x.source!=='dictionary'||!x.dictionary_id)return;
        const row={id:x.dictionary_id,canonical_name:x.matched_name,display_name:x.matched_name,categories:x.categories||[],typical_components:x.typical_components||[],optional_components:x.optional_components||[],adapter_profile:x.adapter_profile||{},ciqual_code:x.ciqual_code||null,confidence:'recognized'};
        row.__wholeDish=explicitNamedDish(raw,row);
        rows.push(row);
      });
      (ctx?.resolved?.dictionary_hits||[]).forEach(x=>{
        const row={...x,__wholeDish:explicitNamedDish(raw,x)};
        if(hasCompositeCategory(row)&&!row.__wholeDish)row.adapter_profile={};
        rows.push(row);
      });
      const seen=new Set();return rows.filter(x=>{const k=x.id||`${x.canonical_name}|${x.ciqual_code}`;if(seen.has(k))return false;seen.add(k);return true;});
    }
    function nutrientCoverage(ctx,key){
      const strict=ctx?.day_excluding_current?.coverage_strict?.nutrients?.[key];
      if(strict&&typeof strict==='object')return strict.complete===true;
      return ctx?.day_excluding_current?.coverage?.[key]===true;
    }
    function currentCoverage(ctx,key){
      const c=ctx?.current_quality?.nutrients?.[key];
      return !!(c&&c.complete===true);
    }
    function referenceWithoutCurrent(ctx){
      const ref=ctx?.reference_context;if(!ref||typeof ref!=='object')return null;
      const copy={...ref,today:{...(ref.today||{})}},day=ctx?.day_excluding_current||{},t=day.totals||{};
      const set=(key,value,nutrient)=>{copy.today[key]=nutrientCoverage(ctx,nutrient)?(n(value)??null):null;};
      set('food_kcal',t.kcal,'kcal');set('protein_g',t.protein,'protein');set('fat_g',t.fat,'fat');set('carbs_g',t.carbs,'carbs');set('fiber_g',t.fiber,'fiber');
      return copy;
    }
    function mealStructure(analysis,ctx){
      const roles=new Set([...(analysis?.parsed?.structuralRoles||[]),...safeResolvedRoles(ctx),...(ctx?.current?.roles||[])]);
      const has=r=>roles.has(r);
      return {roles:[...roles],protein:has('protein'),starch:has('starch'),vegetable:has('vegetable'),fruit:has('fruit'),fat:has('fat'),composite:has('composite')};
    }
    function remainingOpportunityCount(mealType,dayTypes=[],ctx=null){
      const rhythm=ctx?.meal_rhythm||{},expected=n(rhythm.expected_daily_meals),logged=Math.max(0,Number(ctx?.day_excluding_current?.meal_count)||0);
      if(rhythm.reliable===true&&expected!==null){
        return Math.max(1,Math.min(4,Math.round(expected-logged)));
      }
      const slots=['breakfast','lunch','snack','dinner'],idx=Math.max(0,slots.indexOf(mealType));
      const seen=new Set(dayTypes||[]);let count=1;
      slots.slice(idx+1).forEach(k=>{if(!seen.has(k))count++;});
      return Math.max(1,count);
    }
    function tieBreakTargets(goal){
      if(goal==='energie')return ['vitamin_b1_mg','vitamin_b6_mg','magnesium_mg'];
      if(goal==='equilibre'||goal==='autre')return ['magnesium_mg','iron_mg','vitamin_c_mg','vitamin_b9_ug'];
      if(goal==='prise_masse')return ['iron_mg','zinc_mg','vitamin_b12_ug','magnesium_mg'];
      return [];
    }
    function candidateHasRole(c,role){return Array.isArray(c?.roles)&&c.roles.includes(role);}
    function chooseFamiliarCandidate(ctx,role,goal){
      if(goal==='digestion'||goal==='perte_poids')return null;
      const pool=(ctx?.tie_break_candidates||[]).filter(c=>candidateHasRole(c,role));
      if(pool.length<2)return pool[0]||null;
      const targets=tieBreakTargets(goal),maxima={};
      targets.forEach(k=>{maxima[k]=Math.max(0,...pool.map(c=>n(c?.micronutrients?.[k]?.value)||0));});
      const pmax=Math.max(0,...pool.map(c=>n(c?.protein_100g)||0));
      const scored=pool.map(c=>{
        let score=0;
        targets.forEach(k=>{const m=maxima[k],v=n(c?.micronutrients?.[k]?.value)||0;if(m>0)score+=v/m;});
        if(role==='protein'&&goal==='prise_masse'&&pmax>0)score+=(n(c?.protein_100g)||0)/pmax*1.5;
        return {c,score};
      }).sort((a,b)=>b.score-a.score||String(a.c?.name||'').localeCompare(String(b.c?.name||'')));
      const best=scored[0];
      return best&&best.score>0?{...best.c,_tee_tiebreak:true}:pool[0];
    }
    function familiarProtein(ctx){
      const seen=normalize((ctx?.day_excluding_current?.protein_names||[]).join(' '));
      const tokens=(ctx?.food_memory?.dominant_tokens||[]).map(x=>normalize(x?.token)).filter(Boolean);
      const options=[['oeuf','œufs'],['pois','pois chiches'],['lentille','lentilles'],['tofu','tofu'],['saumon','saumon'],['thon','thon'],['poisson','poisson'],['skyr','skyr'],['yaourt','yaourt riche en protéines'],['poulet','poulet'],['dinde','dinde']];
      for(const [token,label] of options){if(tokens.some(t=>t===token||t.includes(token))&&!seen.includes(normalize(label)))return label;}
      return '';
    }
    function usableLearning(ctx,key){const m=ctx?.learning_models?.[key];return m?.status==='usable'?m:null;}
    function coefficient(model,key){return (model?.coefficients||[]).find(x=>x?.key===key&&x?.active);}
    function prioritizeRecommendation(analysis,rx){const recs=[...(analysis.recommendations||[])],i=recs.findIndex(r=>rx.test(normalize(`${r.title||''} ${r.body||''}`)));if(i>0){const [hit]=recs.splice(i,1);recs.unshift(hit);}analysis.recommendations=recs;return i>=0;}
    function addRecommendationFront(analysis,rec,reason){
      const recs=[...(analysis.recommendations||[])].filter(r=>normalize(r.title)!==normalize(rec.title));recs.unshift(rec);analysis.recommendations=recs.slice(0,3);
      if(reason)analysis.why=[reason,...(analysis.why||[]).filter(x=>normalize(x)!==normalize(reason))].slice(0,3);
    }
    function applyAdaptiveBrain(analysis,ctx,goal){
      if(!analysis||!ctx)return analysis;
      const structure=mealStructure(analysis,ctx),moment=mealMoment(linkedMeal?.meal_type||ctx?.meal?.meal_type||''),day=ctx.day_excluding_current||{},tot=day.totals||{},cov=day.coverage_strict||day.coverage||{};
      const ref=referenceWithoutCurrent(ctx),model=(window.MTReference&&ref)?window.MTReference.buildModel(ref):null;
      const slots=remainingOpportunityCount(moment.key,day.meal_types||[],ctx),current=analysis.parsed?.nutrition||{};
      const proteinGap=model?.protein&&nutrientCoverage(ctx,'protein')?Math.max(0,n(model.protein.low)-n(tot.protein)):null;
      const fiberGap=model?.fiber&&nutrientCoverage(ctx,'fiber')?Math.max(0,n(model.fiber.low)-n(tot.fiber)):null;
      const energyGap=model?.energy&&nutrientCoverage(ctx,'kcal')?Math.max(0,n(model.energy.low)-n(tot.kcal)):null;
      const proteinShare=proteinGap===null?null:proteinGap/slots,fiberShare=fiberGap===null?null:fiberGap/slots,energyShare=energyGap===null?null:energyGap/slots;
      const mainMeal=moment.key==='lunch'||moment.key==='dinner';
      const quantitiesKnown=currentCoverage(ctx,'protein')||currentCoverage(ctx,'carbs')||currentCoverage(ctx,'fat')||currentCoverage(ctx,'fiber')||currentCoverage(ctx,'kcal');
      const completeMain=mainMeal&&structure.protein&&structure.starch&&(structure.vegetable||structure.fruit);
      const familiar=familiarProtein(ctx);

      analysis.parsed={...(analysis.parsed||{}),tee_adapter_context:{version:ctx.version||'',roles:structure.roles,day_excluding_current:{totals:tot,coverage:day.coverage||{},coverage_strict:day.coverage_strict||{},meal_count:day.meal_count},remaining_opportunities:slots,target_share:{protein:proteinShare,fiber:fiberShare,energy:energyShare},memory_stage:ctx.food_memory?.strong?'strong':ctx.food_memory?.active?'active':'starting',micronutrients_documented:ctx.micronutrients_excluding_current||{},rules:ctx.rules||{}}};

      // Un repas principal structurellement complet ne doit pas être modifié pour le plaisir.
      if(completeMain&&goal==='autre'){
        if(!quantitiesKnown){
          analysis.recommendations=[{title:'Garde ton repas comme prévu',body:'Ton repas associe déjà une source de protéines, un féculent et un accompagnement végétal. Les quantités ne sont pas assez précisées pour juger les portions, donc Tee ne change pas sa composition.'}];
          analysis.why=['Les principales fonctions du repas sont déjà représentées.','Présence connue ne veut pas dire quantité connue : Tee ne transforme pas une portion non documentée en manque.'];
          analysis._teeChoiceBody='Ton repas est déjà bien structuré. Garde-le comme prévu ; Tee ne juge pas les portions tant que les quantités ne sont pas suffisamment documentées.';
          analysis._basePrimaryTitle=analysis.recommendations[0].title;analysis._basePrimaryBody=analysis.recommendations[0].body;
          return analysis;
        }
        const currentProtein=n(current.protein)||0;
        if(proteinShare!==null&&proteinShare>12&&currentProtein>0&&currentProtein<proteinShare*.65){
          addRecommendationFront(analysis,{title:'Renforcer légèrement la portion protéinée',body:`La structure du repas est déjà bonne. Si cette portion est bien celle que tu prévois, augmente seulement un peu la protéine déjà présente plutôt que d’ajouter un nouvel aliment.`},'Le repas est complet ; seul le repère protéique documenté peut justifier un petit réglage de portion.');
        }else{
          analysis.recommendations=[{title:'Garde ton repas comme prévu',body:'La structure est déjà cohérente. Aucun ajout n’est prioritaire à partir de ce qui est réellement renseigné.'}];
          analysis.why=['Protéine, féculent et végétaux sont déjà présents.'];
          analysis._teeChoiceBody='Je garderais ce repas tel quel. Les données disponibles ne justifient pas d’ajouter un aliment.';
          analysis._basePrimaryTitle=analysis.recommendations[0].title;analysis._basePrimaryBody=analysis.recommendations[0].body;
          return analysis;
        }
      }

      // La cible personnelle sert à dimensionner le manque, jamais à réclamer le besoin journalier entier.
      if(!structure.protein&&mainMeal&&proteinShare!==null&&proteinShare>=10){
        const example=familiar?` Une option déjà familière dans ton alimentation peut être ${familiar}, si elle s’accorde avec ce plat.`:'';
        addRecommendationFront(analysis,{title:'Compléter avec une protéine cohérente',body:`Garde le repas comme base et ajoute une portion protéinée adaptée à ce plat. Tee répartit le repère restant sur les occasions alimentaires encore possibles aujourd’hui, sans te demander de rattraper tout le besoin d’un coup.${example}`},'La protéine est absente du repas et le repère personnel restant rend ce complément pertinent.');
      }
      if(!structure.starch&&goal==='energie'&&energyShare!==null&&energyShare>=180){
        addRecommendationFront(analysis,{title:'Ajouter une énergie cohérente avec ce repas',body:moment.key==='snack'?'Si tu veux davantage d’énergie disponible, complète simplement cette collation avec un fruit ou une base céréalière adaptée.':'Le repas manque surtout d’une source glucidique claire. Ajoute le féculent qui s’accorde naturellement avec ce plat, sans reconstruire toute l’assiette.'},'L’intention énergie et le repère énergétique documenté font remonter la source glucidique déjà cohérente avec le repas.');
      }
      if(!structure.vegetable&&!structure.fruit&&mainMeal&&fiberShare!==null&&fiberShare>=3&&goal!=='digestion'){
        addRecommendationFront(analysis,{title:'Ajouter un repère végétal cohérent',body:'Ajoute simplement le légume, les feuilles ou la légumineuse qui vont naturellement avec ce repas. Tee n’ajoute rien si un accompagnement végétal est déjà reconnu.'},'Les fibres documentées restent sous le repère personnel et aucun végétal n’est identifié dans ce repas.');
      }

      if(goal==='digestion'){
        const learning=usableLearning(ctx,'digestion'),fiberCoef=coefficient(learning,'fiber_g');
        if(fiberCoef?.direction==='negative'){
          // Historique personnel : ne pas pousser automatiquement les fibres.
          analysis.recommendations=(analysis.recommendations||[]).filter(r=>!/ajouter.*(fibre|veget|legume)|repere vegetal/.test(normalize(`${r.title||''} ${r.body||''}`)));
          if(!analysis.recommendations.length)analysis.recommendations=[{title:'Garder une adaptation douce',body:'Ton historique personnel ne justifie pas d’augmenter automatiquement les fibres aujourd’hui. Garde la composition simple et privilégie ce que tu tolères bien.'}];
          analysis.why=['Pour la digestion, Tee privilégie ta tolérance documentée plutôt qu’une règle générale.'];
        }else if(fiberCoef?.direction==='positive'&&!structure.vegetable&&!structure.fruit){
          prioritizeRecommendation(analysis,/fibre|veget|legume|cuit|simple/);
        }
      }
      if(goal==='prise_masse'&&!structure.protein&&proteinShare!==null)prioritizeRecommendation(analysis,/protein|proteine|oeuf|tofu|poisson|legumineuse/);

      // Les micronutriments ne servent qu'en information de départage ; jamais de diagnostic de carence.
      analysis.parsed.tee_adapter_context.micronutrient_policy='documented_tie_break_only_no_deficiency_inference';
      return analysis;
    }

    function setUnifiedDecision(analysis,ctx,goal){
      if(!analysis)return analysis;
      const structure=mealStructure(analysis,ctx),moment=mealMoment(linkedMeal?.meal_type||ctx?.meal?.meal_type||''),main=['lunch','dinner'].includes(moment.key),family=analysis.parsed?.family||'';
      const day=ctx?.day_excluding_current||{},tot=day.totals||{},ref=referenceWithoutCurrent(ctx),model=(window.MTReference&&ref)?window.MTReference.buildModel(ref):null;
      const slots=remainingOpportunityCount(moment.key,day.meal_types||[],ctx);
      const pGap=model?.protein&&nutrientCoverage(ctx,'protein')?Math.max(0,(n(model.protein.low)||0)-(n(tot.protein)||0)):null;
      const fGap=model?.fiber&&nutrientCoverage(ctx,'fiber')?Math.max(0,(n(model.fiber.low)||0)-(n(tot.fiber)||0)):null;
      const eGap=model?.energy&&nutrientCoverage(ctx,'kcal')?Math.max(0,(n(model.energy.low)||0)-(n(tot.kcal)||0)):null;
      const pShare=pGap===null?null:pGap/slots,fShare=fGap===null?null:fGap/slots,eShare=eGap===null?null:eGap/slots;
      const completeMain=main&&structure.protein&&structure.starch&&(structure.vegetable||structure.fruit);
      const unknownAnswer=smartAnswers.some(a=>a.value==='unknown');
      const candidateProtein=chooseFamiliarCandidate(ctx,'protein',goal),candidatePlant=chooseFamiliarCandidate(ctx,'vegetable',goal);
      let primary={title:'Ne change presque rien',body:'Ton repas peut rester tel quel. TEE ne modifie que ce qui est suffisamment documenté.'},extras=[],why=[];
      const set=(title,body,reasons=[],more=[])=>{primary={title,body};why=reasons.filter(Boolean);extras=more.filter(Boolean).slice(0,2);};

      if(family==='burger'&&unknownAnswer){
        set('Ajuster seulement ce qui est certain','Tu as indiqué un burger avec des frites, mais pas sa garniture exacte. TEE n’invente donc ni la protéine ni les légumes du burger. Si tu veux l’adapter, joue seulement sur ce qui est confirmé : portion de frites, sauce, boisson ou ajout d’un élément végétal à côté.',[
          'La composition intérieure du burger n’est pas confirmée.',
          'TEE préfère une adaptation fiable à une supposition.'
        ]);
      }else if(completeMain&&goal==='autre'){
        const q=ctx?.current_quality||{};
        set('Garde ton repas comme prévu',q.quantity_complete===true?'Ton repas associe déjà une source de protéines, un féculent et une partie végétale. Aucun ajout n’est prioritaire avec les données disponibles.':'Ton repas associe déjà une source de protéines, un féculent et une partie végétale. Les quantités ne sont pas toutes précisées, donc TEE ne juge pas ici les portions.',[
          'Les principales composantes du repas sont réellement présentes.',
          q.quantity_complete===true?'Les quantités documentées ne font ressortir aucun changement prioritaire.':'Reconnaître les aliments ne signifie pas connaître leurs quantités.'
        ]);
      }else if(moment.key==='snack'){
        if(goal==='prise_masse'&&!structure.protein){
          const name=candidateProtein?.name||'une petite source protéinée que tu apprécies';
          set('La compléter si tu en as besoin',`Ta collation peut rester simple. Pour l’intention nourrir & construire, tu peux l’associer à ${name}, sans la transformer en repas complet.`,['Une collation n’a pas besoin de reproduire une assiette complète.']);
        }else if(goal==='energie'&&!structure.starch&&!structure.fruit){
          set('Ajouter une énergie simple si nécessaire','Si tu veux une collation plus soutenante, ajoute un fruit ou une petite base céréalière cohérente avec ce que tu manges déjà.',['L’intention énergie agit ici sur la disponibilité énergétique, pas sur un diagnostic de fatigue.']);
        }else{
          set('Garde cette collation simple','Cette collation peut rester telle quelle. Complète-la seulement si ta faim, ton activité ou ton intention du jour le justifient.',['Une collation n’a pas besoin de cocher tous les repères d’un repas principal.']);
        }
      }else if(goal==='digestion'){
        const learning=usableLearning(ctx,'digestion'),fiberCoef=coefficient(learning,'fiber_g');
        if(fiberCoef?.direction==='negative')set('Privilégier ce que tu tolères bien','Ton historique ne justifie pas d’augmenter automatiquement les fibres. Garde une composition simple et ajuste surtout la portion, la cuisson ou les aliments que tu sais bien tolérer.',['Pour la digestion, TEE privilégie ta tolérance documentée plutôt qu’une règle générale.']);
        else if(completeMain)set('Garder la structure et ajuster le confort','La structure du repas est déjà cohérente. Pour l’intention digestion, joue d’abord sur la portion, la cuisson et ta tolérance personnelle plutôt que d’ajouter des aliments.',['TEE ne déduit pas un trouble digestif d’un seul repas.']);
        else set('Adapter doucement sans surcharger','Complète uniquement ce qui manque réellement au repas, avec des aliments que tu tolères bien. TEE n’augmente pas automatiquement les fibres ni les micronutriments pour “corriger” la digestion.',['Digestion ne signifie pas automatiquement “plus de fibres”.']);
      }else if(goal==='energie'&&!structure.starch){
        set('Ajouter une source d’énergie cohérente',moment.key==='snack'?'Ajoute un fruit ou une petite base céréalière si tu veux plus d’énergie disponible.':'Ajoute le féculent qui s’accorde naturellement avec ce repas, sans reconstruire toute l’assiette.',[
          eShare!==null?'Le repère énergétique du jour est suffisamment documenté pour faire remonter ce besoin.':'L’intention énergie justifie ici une base glucidique claire, sans conclure à une carence.'
        ]);
      }else if(main&&!structure.protein){
        const name=candidateProtein?.name||'une source protéinée cohérente avec ce plat';
        set('Compléter avec une protéine cohérente',`Garde le repas comme base et ajoute ${name}. ${pShare!==null?'TEE répartit le repère restant entre les occasions alimentaires encore probables aujourd’hui, sans te demander de rattraper tout le besoin d’un coup.':'Comme la journée n’est pas entièrement chiffrée, TEE ne prétend pas calculer un déficit précis.'}`,[
          'Aucune source protéinée claire n’est confirmée dans ce repas.',
          candidateProtein?`Parmi les options déjà familières et compatibles, ${candidateProtein.name} ressort comme un choix possible.`:''
        ]);
      }else if(main&&!structure.vegetable&&!structure.fruit&&goal!=='digestion'){
        const name=candidatePlant?.name||'un accompagnement végétal cohérent avec ce plat';
        set('Compléter avec un repère végétal adapté',`Si ta version du repas n’en contient pas déjà, ajoute ${name}. ${fShare!==null?'Les fibres du jour sont suffisamment documentées pour que ce complément soit pertinent.':'TEE se base ici sur la structure du repas, pas sur un total de fibres incomplet.'}`,[
          'Aucun élément végétal n’est actuellement confirmé dans ce repas.'
        ]);
      }else if(goal==='prise_masse'&&structure.protein&&structure.starch){
        set('Renforcer sans empiler','La base protéine + féculent est déjà présente. Ajuste progressivement la portion utile selon ta faim et ton activité plutôt que d’ajouter une deuxième ou troisième protéine.',['L’intention nourrir & construire agit d’abord sur la quantité utile d’une structure déjà cohérente.']);
      }else if(goal==='perte_poids'){
        set('Alléger sans dénaturer','Garde la structure du repas et ajuste surtout la portion, la sauce ou l’accompagnement selon ta faim. TEE ne retire pas automatiquement un féculent ou une protéine.',['L’intention légèreté ne doit pas transformer le repas en restriction automatique.']);
      }else if(completeMain){
        set('Garde ton repas comme prévu','Les principaux repères du repas sont déjà présents. Aucun ajout n’est prioritaire avec ce que TEE peut réellement confirmer.',['Protéine, féculent et partie végétale sont déjà représentés.']);
      }else{
        set(primary.title,primary.body,['TEE ne dispose pas d’assez d’éléments fiables pour imposer un changement.']);
      }

      analysis.recommendations=[primary,...extras];
      analysis.why=why.slice(0,3);
      analysis._teeChoiceBody=primary.body;
      analysis._basePrimaryTitle=primary.title;analysis._basePrimaryBody=primary.body;
      analysis.parsed={...(analysis.parsed||{}),unified_decision:{version:'V4896571',goal,moment:moment.key,day_macro_coverage:{protein:nutrientCoverage(ctx,'protein'),fiber:nutrientCoverage(ctx,'fiber'),kcal:nutrientCoverage(ctx,'kcal')},remaining_opportunities:slots,micronutrient_tiebreak_used:!!(candidateProtein?._tee_tiebreak||candidatePlant?._tee_tiebreak)}};

      const prior=(analysis.parsed?.day_meal_context?.proteins||[]).map(friendlyProteinLabel).filter(Boolean).slice(0,2);
      let line='TEE utilise uniquement les données suffisamment documentées et n’assimile jamais une donnée absente à zéro.';
      if(prior.length)line+=` Tu as aussi renseigné ${prior.map(withArticle).join(' et ')} plus tôt aujourd’hui.`;
      analysis.personalContextLine=line;
      analysis.parsed={...(analysis.parsed||{}),personal_context:{...(analysis.parsed?.personal_context||{}),line}};
      return analysis;
    }

    function renderQuestion(q){
      questionKey=q.key;questionBox.hidden=false;questionBox.innerHTML=`<div class="kicker">Une précision utile</div><h2>${F.esc(q.title)}</h2><p>${F.esc(q.text)}</p><div class="mt-food-question-options">${q.options.map(([v,l])=>`<button type="button" class="mt-food-question-option" data-answer="${v}">${F.esc(l)}</button>`).join('')}</div>`;
      questionBox.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{const opt=q.options.find(x=>x[0]===b.dataset.answer),exclusive=['alone','unknown'].includes(opt[0]);if(exclusive){smartAnswers=[{value:opt[0],label:opt[1],categories:opt[2]}];questionBox.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));}else{smartAnswers=smartAnswers.filter(x=>!['alone','unknown'].includes(x.value));const i=smartAnswers.findIndex(x=>x.value===opt[0]);if(i>=0)smartAnswers.splice(i,1);else smartAnswers.push({value:opt[0],label:opt[1],categories:opt[2]});questionBox.querySelectorAll('[data-answer]').forEach(x=>x.classList.toggle('active',smartAnswers.some(a=>a.value===x.dataset.answer)));}document.getElementById('adapterAnalyze').textContent='Continuer avec ces précisions';});
      questionBox.scrollIntoView({behavior:'smooth',block:'center'});
    }
    text.addEventListener('input',()=>{smartAnswers=[];questionKey='';questionBox.hidden=true;questionBox.innerHTML='';document.getElementById('adapterAnalyze').textContent='Obtenir mes ajustements';});

    function buildRecommendations(raw,goal,knowledge=[],structured=[],answers=[],serverCtx=null){
      const p=parseMeal(raw,knowledge,structured,answers,serverCtx),cats=categoriesOf(p),recs=[],why=[],has=c=>(cats[c]||0)>0,count=c=>cats[c]||0;
      const proteinKnown=has('protein')||has('dairy_protein')||p.nutrition.protein>=12,fiberKnown=has('fruit')||has('vegetable')||has('wholegrain')||p.nutrition.fiber>=4,starchKnown=has('starch')||has('wholegrain')||p.nutrition.carbs>=25;
      const add=(title,body,reason)=>{if(recs.length<3){recs.push({title,body});if(reason)why.push(reason);}};
      let signature='Je garderais ce repas comme base et je modifierais seulement le point prioritaire indiqué ci-dessus.';
      const manual=(p.intelligence||[]).find(x=>x&&typeof x==='object')||null;
      if(manual){
        const specific=Array.isArray(manual.ahead_by_goal?.[goal])?manual.ahead_by_goal[goal]:[];
        const ahead=specific.length?specific:(Array.isArray(manual.ahead_default)?manual.ahead_default:[]);
        if(ahead.length)add('À prévoir',`Pour ce plat, Tee a prévu : ${ahead.join(', ')}. N’ajoute ces éléments que s’ils ne sont pas déjà présents dans ta version réelle.`,manual.mode==='priority'?'Règle culinaire définie directement dans le Studio Méthode Tee.':'Repère culinaire défini pour ce plat.');
        if(manual.advice)add('Conseil Tee',manual.advice,'Conseil spécifique enregistré pour ce plat.');
        if(manual.tee_choice)signature=manual.tee_choice;
      }

      if(p.family==='sweet_bowl'){
        const isSmoothie=p.preparationKind==='smoothie',isVerrine=p.preparationKind==='verrine',preparation=isSmoothie?'smoothie':isVerrine?'verrine':'bol',feminine=preparation==='verrine';
        if(!proteinKnown){add(`Associer une protéine adaptée ${feminine?'à la':'au'} ${preparation}`,`Garde ${feminine?'ta':'ton'} ${preparation}. Associe-${feminine?'la':'le'} à un skyr, un yaourt nature riche en protéines ou une alternative soja protéinée. Inutile d’ajouter une protéine salée.`,`Aucune source protéinée adaptée n’est confirmée dans ${feminine?'la':'le'} ${preparation}.`);signature=`Je garderais ${feminine?'la':'le'} ${preparation} et j’ajouterais seulement un skyr, un yaourt riche en protéines ou une alternative soja protéinée. Aucun légume, œuf, poulet ou poisson n’est nécessaire dans ce contexte.`;}
        if(!has('fruit')&&answers.some(x=>x.value!=='alone'))add('Ajouter un fruit seulement s’il n’y en a pas déjà',`Tu peux ajouter un fruit frais pour compléter ${feminine?'la':'le'} ${preparation}, sans le doubler s’il y en a déjà une vraie portion.`,'Aucun fruit n’a été confirmé dans la composition.');
        if(proteinKnown&&fiberKnown){add('Ne change presque rien',`${feminine?'Ta':'Ton'} ${preparation} possède déjà une base cohérente, une source protéinée et un repère fruit ou fibre. Ajuste surtout la quantité selon ta faim.`,'Les principaux repères utiles sont déjà présents.');signature=`Je garderais ${feminine?'cette':'ce'} ${preparation} ${feminine?'telle quelle':'tel quel'}. La meilleure adaptation est simplement d’ajuster la quantité selon ta faim et d’observer ta satiété.`;}
      }else if(p.family==='simple_salad'){
        const moment=mealMoment(linkedMeal?.meal_type||'');
        const explicitProtein=!!p.explicit?.protein||p.nutrition.protein>=12;
        if(!explicitProtein){
          const title=(moment.key==='lunch'||moment.key==='dinner')?'Compléter cette salade avec une protéine':'Ajouter une protéine seulement si tu en as besoin';
          const body=(moment.key==='lunch'||moment.key==='dinner')?'Garde ta salade, les tomates et le concombre comme base. Pour en faire un repas plus complet, ajoute simplement une source protéinée qui s’accorde avec elle, par exemple des pois chiches, des œufs, du tofu ou du poisson.':'Ta salade peut rester telle quelle. Ajoute une petite source protéinée uniquement si tu veux qu’elle te tienne davantage.';
          add(title,body,'La salade apporte déjà la partie végétale, mais aucune source protéinée n’est clairement renseignée.');
          signature=(moment.key==='lunch'||moment.key==='dinner')?'Je garderais entièrement ta salade et j’ajouterais seulement une source protéinée cohérente. Rien d’autre n’a besoin d’être changé.':'Je garderais cette salade telle quelle et je ne la compléterais que si ta faim le demande.';
        }else{
          add('Garder cette salade comme base','La partie végétale et la protéine sont déjà présentes. Ajuste seulement la quantité selon ta faim.','Les principaux éléments utiles de cette salade sont déjà renseignés.');
          signature='Je garderais cette salade telle quelle et j’ajusterais seulement la quantité selon ta faim.';
        }
      }else if(p.family==='burger'){
        if(answers.some(x=>x.value==='unknown')){add('Préciser la garniture avant de changer le repas','Le mot burger ne permet pas de savoir s’il contient une viande, une galette végétale ou des légumes. Garde-le comme prévu plutôt que d’ajouter quelque chose sur une supposition.','La composition exacte du burger n’est pas confirmée.');signature='Je garderais ce burger comme prévu et je préciserais simplement sa garniture une prochaine fois pour obtenir un conseil réellement ciblé.';}
        else if(!proteinKnown){add('Vérifier le cœur du burger','Confirme d’abord s’il contient un steak, du poulet, du poisson ou une galette végétale. N’ajoute pas une deuxième protéine tant que sa composition n’est pas connue.','Le pain, les frites et la sauce sont reconnus, mais pas le cœur du burger.');signature='Je ne rajouterais aucune protéine au hasard : je vérifierais d’abord ce que contient réellement le burger.';}
        else if(!has('vegetable')){add('Compléter la garniture du burger','Garde le burger et les frites. Si la garniture n’en contient pas déjà, ajoute simplement salade, tomate ou oignon dans le burger ou à côté.','La protéine est confirmée, mais aucune garniture végétale n’est décrite.');signature='Je garderais le burger comme base et j’ajouterais seulement une garniture végétale cohérente, sans fruit ni accompagnement sans rapport avec ce repas.';}
        else{add('Conserver la structure du burger','La protéine et la garniture végétale sont confirmées. Garde le repas et ajuste seulement la quantité de sauce ou de frites selon ta faim.','Les éléments principaux du burger sont déjà présents.');signature='Je garderais ce burger tel quel. Le seul réglage utile concerne éventuellement la quantité de sauce ou de frites, pas sa composition.';}
      }else if(p.family==='sweet_dish'){
        add(`Garder ${p.dishName||'cette préparation'} comme préparation sucrée`,'Ne transforme pas ce dessert en assiette salée. Les ajustements éventuels portent sur la portion ou l’accompagnement, selon ton intention.','Le contexte sucré du plat est reconnu.');
        signature=`Je respecterais la recette de ${p.dishName||'ce dessert'} et je n’ajouterais aucun légume, œuf, poulet ou poisson.`;
      }else if(p.family==='flatbread'){
        if(!proteinKnown&&has('added_sugar'))add('Garder la version sucrée simple','Conserve cette préparation telle qu’elle est. Si elle remplace un petit-déjeuner complet, accompagne-la d’un lait, yaourt ou équivalent soja protéiné plutôt que d’une protéine salée.','La version sucrée est confirmée et aucune protéine adaptée n’est identifiée.');
        else if(proteinKnown)add('Conserver la garniture réellement choisie','La composante protéinée est confirmée. Vérifie seulement si une garniture végétale est déjà présente avant d’en ajouter.','La manière de servir cette préparation a été précisée.');
        else add('Ne pas inventer de garniture','Garde cette préparation nature si c’est ainsi que tu la manges et adapte seulement ce qui l’accompagne.','Aucune garniture n’a été confirmée.');
        signature=`Je garderais ${p.dishName||'cette préparation'} dans sa version réellement choisie, sucrée, salée ou nature, sans lui appliquer un conseil standard.`;
      }else if(p.family==='starch_side'){
        if(!proteinKnown)add('Compléter l’accompagnement','Garde ce féculent et associe-le à la sauce ou à la protéine réellement prévue dans ton repas. Seul, il ne permet pas de lire l’ensemble de l’assiette.','Ce plat sert principalement de base ou d’accompagnement féculent.');
        if(proteinKnown&&!has('vegetable'))add('Compléter la sauce ou l’accompagnement','La base féculent + protéine est présente. Si la sauce ne contient pas déjà de légumes, ajoute un accompagnement végétal cohérent avec ce plat.','La protéine est confirmée, mais pas la partie végétale.');
        if(proteinKnown&&has('vegetable'))add('Conserver cet ensemble','La base féculente, la protéine et la sauce ou les légumes sont déjà identifiés. Ajuste surtout les quantités selon ta faim.','Les trois fonctions principales du repas sont représentées.');
        signature='Je raisonnerais sur l’ensemble féculent + sauce + protéine, jamais sur le foutou, l’eba, le placali ou le banku pris isolément.';
      }else if(['variable_composite','soup','sauce_dish','noodle_dish','filled_dough'].includes(p.family)){
        if(answers.some(x=>x.value==='unknown')){add('Ne rien inventer','Le plat est reconnu, mais sa recette exacte n’est pas connue. Garde-le tel quel et précise sa garniture une prochaine fois si tu souhaites un conseil plus ciblé.','La composition varie et aucun composant facultatif n’est considéré comme certain.');signature='Je préfère ne pas modifier ce plat sur une supposition. Sa recette réelle reste prioritaire sur sa description théorique.';}
        else if(!proteinKnown){add('Vérifier la protéine réellement présente','Le plat est reconnu, mais aucune protéine n’est confirmée dans ta version. Si elle est absente, choisis-en une qui appartient naturellement à cette recette.','La composition du plat varie selon la préparation.');signature='Je garderais l’identité du plat et je vérifierais uniquement la protéine réellement présente, sans le transformer en une autre assiette.';}
        else if(!has('vegetable')&&!p.flags.already_contains_vegetable){add('Regarder la garniture, pas remplacer le plat','La protéine est confirmée. Vérifie simplement si ta version contient déjà des légumes ou une garniture végétale avant d’en ajouter.','Le plat est composé et sa garniture varie.');signature='Je garderais ce plat tel qu’il est et j’ajusterais seulement sa garniture réelle, sans lui imposer automatiquement salade ou crudités.';}
        else{add('Conserver la structure du plat','La protéine et la partie végétale sont déjà confirmées dans ta version. Ajuste seulement l’accompagnement ou la portion selon ta faim.','Les éléments principaux du plat sont présents.');signature='Je garderais la structure traditionnelle de ce plat. Aucun ajout automatique n’est nécessaire.';}
      }else if(p.family==='complete_composite'){
        if(answers.some(x=>x.value==='unknown'))add('Ne rien ajouter sur une supposition','Le plat est reconnu, mais sa variante exacte ne l’est pas. Garde-le comme prévu et précise sa garniture une prochaine fois pour obtenir un conseil plus ciblé.','Les composants facultatifs ne sont pas considérés comme présents sans confirmation.');
        else if(proteinKnown&&starchKnown&&has('vegetable'))add(`Conserver la structure de ${p.dishName||'ce plat'}`,'La protéine, le féculent et la partie végétale sont déjà confirmés. Ajuste seulement les quantités selon ta faim et ton intention.','Les principales fonctions du repas sont réellement présentes.');
        else if(!proteinKnown)add('Confirmer uniquement l’accompagnement protéiné','La base du plat est reconnue, mais sa version peut être servie avec ou sans viande, poisson, œuf, tofu ou légumineuses. Ne rajoute rien avant de vérifier.','La protéine appartient aux variantes possibles, pas aux composants certains.');
        else if(!has('vegetable'))add('Vérifier la garniture réelle','La protéine et la base énergétique sont présentes. Vérifie seulement si la recette contient déjà des légumes avant d’en ajouter.','La partie végétale n’est pas confirmée dans cette version.');
        else add(`Garder ${p.dishName||'ce plat'} comme un ensemble`,'La composition décrite est cohérente. Aucun ajout automatique n’est nécessaire.','Les composants utiles déjà décrits doivent rester prioritaires sur la recette théorique.');
        signature=`Je garderais ${p.dishName||'ce plat'} comme un ensemble et je ne considérerais comme présent que ce qui a été décrit ou confirmé.`;
      }else if(p.family==='fried_snack'){
        if(!proteinKnown)add('Vérifier la farce ou la base','Confirme la farce ou l’ingrédient principal avant d’ajouter une protéine : ce type de préparation peut déjà en contenir.','La préparation est frite mais sa composition intérieure peut varier.');
        else add(`Garder ${p.dishName||'cette préparation'} comme élément principal`,'La protéine est déjà identifiée. Évite simplement de cumuler plusieurs autres éléments frits dans le même repas.','La préparation apporte déjà une composante protéinée et une cuisson frite.');
        signature=`Je conserverais ${p.dishName||'cette préparation'} et j’ajusterais son accompagnement, pas son identité.`;
      }else if(p.family==='protein_main'){
        if(!starchKnown)add('Choisir l’accompagnement énergétique du plat','Associe cette protéine au féculent ou à l’accompagnement qui correspond réellement au repas et à ton intention.','La protéine est reconnue mais pas son accompagnement énergétique.');
        if(!has('vegetable')&&!p.flags.already_contains_vegetable)add('Vérifier l’accompagnement végétal','Ajoute seulement un légume, des feuilles ou une sauce végétale compatible avec ce plat si aucun n’est déjà prévu.','Aucune composante végétale n’est confirmée.');
        signature=`Je garderais ${p.dishName||'cette protéine'} comme centre du repas et j’adapterais uniquement ses accompagnements.`;
      }else{
        const proteinCount=count('protein')+count('dairy_protein');
        if(proteinCount>=3){add('Éviter d’empiler les protéines','Garde les sources que tu préfères et choisis parmi les autres plutôt que de tout cumuler.','La partie protéinée est déjà largement représentée.');signature=/oeufs?.*poulet.*saucisse|oeufs?.*saucisse.*poulet/.test(p.normalized)?'Je garderais les œufs et le pain, puis je choisirais entre le poulet pané et la saucisse. Ensuite seulement, j’ajouterais un accompagnement adapté.':'Je garderais une source protéinée principale puis je choisirais parmi les autres, sans moraliser ni tout retirer.';}
        if(count('charcuterie')+count('cheese')+count('rich_sauce')>=2)add('Réduire une seule accumulation','Garde l’élément central et ajuste seulement une sauce, une charcuterie ou un fromage.','Plusieurs sources concentrées se superposent.');
        if(count('fried')>=2)add('Garder une seule friture','Choisis l’élément frit que tu préfères et garde le reste plus simple.','Deux éléments frits sont présents.');
        if(has('sugary_drink'))add('Changer seulement la boisson','Garde le repas et choisis une boisson non sucrée.','La boisson est l’ajustement le plus simple.');
        if(!proteinKnown&&!has('composite_dish'))add('Ajouter une protéine cohérente','Choisis une protéine qui s’accorde avec ce repas et son moment, sans appliquer la même proposition à tous les plats.','Aucune protéine claire n’est reconnue.');
        if(!fiberKnown&&!p.flags.do_not_auto_suggest_vegetables&&!has('composite_dish'))add('Compléter avec un repère végétal adapté','Ajoute un fruit, un légume ou une légumineuse selon la nature réelle du repas.','Aucun repère fruit, légume ou fibre n’est identifié.');
        if(!recs.length){add('Ne change presque rien','Les éléments décrits sont cohérents entre eux. Ajuste surtout les quantités selon ta faim et ton ressenti.','Aucun déséquilibre prioritaire n’est identifié.');signature='Je garderais ce repas tel quel et j’ajusterais seulement les quantités selon ta faim.';}
      }
      const intention=goalLayer(p,goal,cats);
      if(intention&&!recs.some(r=>normalize(r.title)===normalize(intention.title)))add(intention.title,intention.body,intention.reason);
      if(!manual?.tee_choice)signature=teeSpecificChoice(p,goal,cats);
      return {parsed:{...p,answers},recommendations:recs.slice(0,3),why:[...new Set(why)].slice(0,3),signature:{title:'Le choix de Tee',body:signature},_teeChoiceBody:signature,_basePrimaryTitle:recs[0]?.title||'',_basePrimaryBody:recs[0]?.body||''};
    }

    function renderGoals(){goalsBox.innerHTML=Object.entries(goalLabels).map(([k,l])=>`<button type="button" class="mt-food-goal ${k===selectedGoal?'active':''}" data-goal="${k}">${l}</button>`).join('');goalsBox.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedGoal=b.dataset.goal;renderGoals();});}
    renderGoals();

    async function loadMeal(){
      const id=F.qs('meal_id');if(!id)return;
      const {data}=await sb.from('food_meals').select('id,meal_date,meal_type,meal_time,description,photo_path,source_recipe_title,source_recipe_image_url').eq('id',id).eq('user_id',user.id).maybeSingle();if(!data)return;
      linkedMeal=data;text.value=data.description||data.source_recipe_title||'';photoPath=data.photo_path||'';
      if(photoPath){const url=await F.signedUrl(sb,photoPath,1800);if(url)preview.innerHTML=`<img src="${F.esc(url)}" alt="Photo du repas">`;}
      else if(data.source_recipe_image_url)preview.innerHTML=`<img src="${F.esc(data.source_recipe_image_url)}" alt="">`;
      const {data:items}=await sb.from('food_meal_items').select('food_name,ciqual_code,quantity_g,kcal,protein,fat,carbs,fiber,salt').eq('meal_id',id).order('sort_order');
      structuredItems=items||[];
      if(structuredItems.length&&!text.value.trim())text.value=structuredItems.map(x=>x.food_name).join(', ');
    }

    photoInput.onchange=()=>{const f=photoInput.files?.[0];if(!f)return;photoFile=f;preview.innerHTML=`<img src="${URL.createObjectURL(f)}" alt="Aperçu">`;};

    async function analyze(){
      const raw=text.value.trim();if(raw.length<3){F.toast('Décris d’abord ton repas.');return;}
      const btn=document.getElementById('adapterAnalyze');btn.disabled=true;
      try{
        const mealDate=linkedMeal?.meal_date||F.qs('date')||F.today();
        adapterContext=await loadAdapterContext(mealDate,raw);
        let knowledge=contextKnowledge(adapterContext,raw);
        if(!knowledge.length){try{knowledge=await F.resolveFoodText(sb,[raw,...structuredItems.map(x=>x.food_name)].join(', '),16);}catch(e){console.warn('food dictionary fallback',e);}}
        const preliminary=parseMeal(raw,knowledge,structuredItems,smartAnswers,adapterContext),question=mealQuestion(preliminary);
        if(question){renderQuestion(question);return;}
        questionBox.hidden=true;
        let analysis=buildRecommendations(raw,selectedGoal,knowledge,structuredItems,smartAnswers,adapterContext);
        analysis=applyMomentContext(analysis,linkedMeal?.meal_type||adapterContext?.meal?.meal_type||'');
        if(window.MTReference){
          try{
            const compactRef=referenceWithoutCurrent(adapterContext);
            const refContext=compactRef||await window.MTReference.context(mealDate,{sb,user});
            if(refContext)analysis=window.MTReference.applyMealContext(analysis,refContext,selectedGoal);
          }catch(e){console.warn('personal meal context',e);}
        }
        const fastDay=adapterContext?.day_excluding_current;
        const dayContext=fastDay?{meal_count:fastDay.meal_count,proteins:fastDay.protein_names||[],meal_labels:[]}:await loadDayMealContext(mealDate);
        analysis=applyDayMealContext(analysis,dayContext);
        analysis=applyAdaptiveBrain(analysis,adapterContext,selectedGoal);
        analysis=reconcileContextWithStructure(analysis,adapterContext,selectedGoal);
        // V4896571 : une seule décision autoritaire produit à la fois le choix, les compléments et les raisons.
        analysis=setUnifiedDecision(analysis,adapterContext,selectedGoal);
        analysis=humanizeAnalysis(analysis);analysis=finalizeAdaptation(analysis);
        const id=crypto.randomUUID();
        let storedPhoto=photoPath;
        if(photoFile)storedPhoto=await F.uploadMealPhoto(sb,user,photoFile,id,photoPath);
        const row={id,user_id:user.id,meal_id:linkedMeal?.id||null,meal_date:mealDate,input_text:raw,goal:selectedGoal,photo_path:storedPhoto||null,parsed_items:{...analysis.parsed,tee_signature:analysis.signature}, recommendations:analysis.recommendations,why:analysis.why,status:'proposed'};
        const {error}=await sb.from('food_adaptations').insert(row);if(error)throw error;
        renderResult(row,analysis,storedPhoto);
      }catch(e){console.warn('adapt save',e);F.toast(e.message||'Impossible de préparer les ajustements.');}finally{btn.disabled=false;}
    }
    document.getElementById('adapterAnalyze').onclick=analyze;

    function dayUrl(row){return `food-day.html?date=${linkedMeal?.meal_date||row?.meal_date||F.qs('date')||F.today()}`;}

    async function renderResult(row,analysis,storedPhoto,opts={}){
      let img='';if(storedPhoto)img=await F.signedUrl(sb,storedPhoto,1800);else if(linkedMeal?.source_recipe_image_url)img=linkedMeal.source_recipe_image_url;
      inputSection.hidden=true;resultSection.hidden=false;
      const confidence={recognized:'Composition reconnue',simple:'Aliment reconnu',variable:'Plat reconnu · sa composition peut varier selon la recette',probable:'Composition partiellement reconnue',ambiguous:'Description trop générale'}[analysis.parsed?.confidence]||'Lecture indicative';
      const isReview=!!opts.review;
      const statusBlock=isReview&&row.status==='adopted'
        ? `<div class="mt-food-adopted-review"><span>✶ Adaptation choisie</span><small>Enregistrée dans ton carnet</small></div>`
        : isReview&&row.status==='kept'
          ? `<div class="mt-food-adopted-review is-kept"><span>Repas conservé tel quel</span><small>Décision enregistrée</small></div>`
          : '';
      const keepOnly=/^(garde|ne change presque rien|conserver la structure)/.test(normalize(analysis.signature?.title||''));
      const actions=isReview
        ? `<div class="mt-food-result-actions"><button class="main-cta" id="foodBackDay">Retour à ma journée</button>${row.meal_id?'<button class="ghost-btn mt-food-outline" id="foodNewAdapt">Créer une nouvelle adaptation</button>':''}</div>`
        : keepOnly
          ? `<div class="mt-food-result-actions"><button class="main-cta" id="foodKeepOnly">Je garde mon repas comme prévu</button></div>`
          : `<div class="mt-food-result-actions"><button class="main-cta" id="foodAdopt">Je choisis cette adaptation</button><button class="ghost-btn mt-food-outline" id="foodKeep">Je garde mon repas comme prévu</button></div>`;
      ensureAdapterContextCSS();
      const personalLine=analysis.personalContextLine||analysis.parsed?.personal_context?.line||'';
      const contextItems=Array.isArray(analysis.parsed?.personal_context?.today_items)?analysis.parsed.personal_context.today_items:[];
      const contextChips=contextItems.length?`<div class="mt-food-context-grid">${contextItems.map(x=>`<span class="mt-food-context-chip"><b>${F.esc(humanContextLabel(x.label))}</b> · ${F.esc(x.value)}</span>`).join('')}</div>`:'';
      const personalBlock=(personalLine||contextItems.length)?`<section class="mt-food-personal-context"><small>TON CONTEXTE AUJOURD’HUI</small>${contextChips}${personalLine?`<p>${F.esc(personalLine)}</p>`:''}</section>`:'';
      const complements=Array.isArray(analysis.recommendations)?analysis.recommendations.slice(0,2):[];
      resultSection.innerHTML=`${statusBlock}<section class="mt-food-adapter-current ${img?'':'no-image'}">${img?`<img src="${F.esc(img)}" alt="Photo du repas" loading="lazy">`:''}<div><small>Ton repas actuel</small><h2>${F.esc(linkedMeal?.source_recipe_title||'Ton repas')}</h2><p>${F.esc(row.input_text)}</p><small>${F.esc(confidence)}</small></div></section>${personalBlock}<section class="mt-food-signature"><small>Le choix de Tee</small><h2>${F.esc(analysis.signature?.title||'Ne change presque rien')}</h2><p>${F.esc(analysis.signature?.body||'')}</p></section>${complements.length?`<section class="mt-food-adapter-list"><small>Si tu veux aller un peu plus loin</small><h2>${complements.length} ajustement${complements.length>1?'s':''} complémentaire${complements.length>1?'s':''}</h2>${complements.map((r,i)=>`<div class="mt-food-adjustment"><i>${i+1}</i><div><b>${F.esc(r.title)}</b><p>${F.esc(r.body)}</p></div></div>`).join('')}</section>`:''}<section class="mt-food-why"><small>Pourquoi ce choix ?</small><h2>Le minimum utile</h2><ul>${analysis.why.length?analysis.why.map(x=>`<li>${F.esc(x)}</li>`).join(''):'<li>Tee n’a détecté aucun changement prioritaire avec suffisamment de confiance.</li>'}</ul></section>${actions}`;
      if(window.MTPhytoSafety){
        const safetyText=[
          ...(analysis.recommendations||[]).flatMap(r=>[r.title,r.body]),
          analysis.signature?.title,analysis.signature?.body
        ].filter(Boolean).join(' · ');
        window.MTPhytoSafety.decorate(resultSection,safetyText,{position:'first'});
      }
      if(isReview){
        document.getElementById('foodBackDay').onclick=()=>location.href=dayUrl(row);
        const again=document.getElementById('foodNewAdapt');if(again)again.onclick=()=>location.href=`food-adapter.html?meal_id=${encodeURIComponent(row.meal_id)}`;
      }else{
        const keepOnlyBtn=document.getElementById('foodKeepOnly');
        if(keepOnlyBtn)keepOnlyBtn.onclick=()=>saveDecision(row,'kept');
        else{
          document.getElementById('foodAdopt').onclick=()=>saveDecision(row,'adopted');
          document.getElementById('foodKeep').onclick=()=>saveDecision(row,'kept');
        }
      }
      scrollTo({top:0,behavior:isReview?'auto':'smooth'});
    }

    async function saveDecision(row,status){
      const decidedAt=new Date().toISOString();
      const {error}=await sb.from('food_adaptations').update({status,decided_at:decidedAt}).eq('id',row.id).eq('user_id',user.id);
      if(error){console.warn('adapt decision',error);F.toast('Impossible d’enregistrer ce choix.');return;}
      row.status=status;row.decided_at=decidedAt;
      if(status==='adopted'){
        F.toast(linkedMeal?'Adaptation choisie · visible sur ce repas.':'Adaptation choisie pour cette journée.');
        await renderResult(row,{parsed:row.parsed_items||{},recommendations:row.recommendations||[],why:row.why||[],signature:row.parsed_items?.tee_signature||{}},row.photo_path,{review:true});
      }else{
        F.toast('Ton repas reste enregistré tel que prévu.');
        setTimeout(()=>location.href=dayUrl(row),500);
      }
    }

    async function loadSavedAdaptation(){
      const adaptationId=F.qs('adaptation_id');if(!adaptationId)return false;
      const {data:row,error}=await sb.from('food_adaptations').select('id,meal_id,meal_date,input_text,goal,photo_path,parsed_items,recommendations,why,status,decided_at').eq('id',adaptationId).eq('user_id',user.id).maybeSingle();
      if(error||!row){F.toast('Cet ajustement est introuvable.');return false;}
      if(row.meal_id){
        const {data:meal}=await sb.from('food_meals').select('id,meal_date,meal_type,meal_time,description,photo_path,source_recipe_title,source_recipe_image_url').eq('id',row.meal_id).eq('user_id',user.id).maybeSingle();
        if(meal)linkedMeal=meal;
      }
      const parsed=row.parsed_items||{};let analysis={parsed,recommendations:Array.isArray(row.recommendations)?row.recommendations:[],why:Array.isArray(row.why)?row.why:[],signature:parsed.tee_signature||{}};
      if(!analysis.signature?.title||analysis.signature.title==='Le choix de Tee')analysis=finalizeAdaptation(analysis);
      await renderResult(row,analysis,row.photo_path,{review:true});
      return true;
    }

    if(!(await loadSavedAdaptation())){await loadMeal();if(!linkedMeal&&F.qs('text'))text.value=F.qs('text');}
  });
})();
