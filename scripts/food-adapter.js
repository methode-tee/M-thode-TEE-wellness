(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded',async()=>{
    const F=window.MTFood;if(!F)return;const ctx=await F.auth();if(!ctx)return;const {sb,user}=ctx;
    const inputSection=document.getElementById('foodAdapterInput'),resultSection=document.getElementById('foodAdapterResult'),text=document.getElementById('adapterText');
    const goalsBox=document.getElementById('adapterGoals'),preview=document.getElementById('adapterPhotoPreview'),photoInput=document.getElementById('adapterPhotoInput'),questionBox=document.getElementById('adapterSmartQuestion');
    let selectedGoal='equilibre',linkedMeal=null,structuredItems=[],smartAnswers=[],questionKey='',photoFile=null,photoPath='';
    const goalLabels={equilibre:'Équilibre',digestion:'Digestion',energie:'Énergie',prise_masse:'Nourrir & construire',perte_poids:'Retrouver de la légèreté',autre:'Sans intention particulière'};

    const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[’']/g,"'");
    const lexicon=[
      [/\b(pain|baguette|bun|brioche|tortilla|wrap|riz|quinoa|pates?|nouilles?|semoule|couscous|mil|fonio|manioc|igname|plantain|pomme de terre|patate|frites?)\b/,'starch'],
      [/\b(steak|boeuf|porc|agneau|mouton|chevre|cabri|poulet|dinde|canard|escalope|thon|saumon|poisson|tilapia|dorade|maquereau|sardines?|crevettes?|gambas?|crabe|oeufs?|saucisses?|merguez|tofu|tempeh|lentilles?|pois chiches?|pois casses?|feves?|haricots?)\b/,'protein'],
      [/\b(yaourt grec|skyr|fromage blanc|yaourt soja|lait|boisson soja|petit suisse)\b/,'dairy_protein'],
      [/\b(cheddar|fromage|mozzarella|emmental|parmesan|raclette)\b/,'cheese'],[/\b(bacon|lardons?|charcuterie|jambon sec|saucisson|saucisses?|merguez)\b/,'charcuterie'],
      [/\b(mayonnaise|mayo|sauce burger|sauce fromagere|creme|creme fraiche|aioli|arachide|cacahuete|graine de palme|huile de palme|lait de coco|creme de coco)\b/,'rich_sauce'],[/\b(ketchup|sauce barbecue|bbq|sauce sucree)\b/,'sweet_sauce'],
      [/\b(salade|tomates?|courgettes?|carottes?|brocolis?|epinards?|haricots verts|concombre|poivrons?|aubergines?|crudites?|legumes?|gombo|feuilles)\b/,'vegetable'],
      [/\b(frites?|friture|pane|beignet|onions? rings?|oignons? frits?)\b/,'fried'],[/\b(soda|cola|limonade|jus|boisson sucree|energy drink)\b/,'sugary_drink'],
      [/\b(avocat|huile d'olive|huile|amandes?|noix|noix de cajou|graines?)\b/,'nuts_seeds'],[/\b(dattes?|fruit|banane|pomme|poire|orange|fruits rouges|myrtilles?|mangue)\b/,'fruit'],
      [/\b(muesli|granola|flocons? d'avoine|avoine|porridge)\b/,'wholegrain'],[/\b(miel|sirop|sucre vanille|sucre ajoute)\b/,'added_sugar'],
      [/\b(extrait de vanille|gousse de vanille|vanille en poudre|vanille)\b/,'aromatic']
    ];
    const sideDishRx=/\b(foutou|placali|eba|amala|pounded yam|banku|kenkey|atti[eé]k[eé]|chikwangue|kwanga|taro)\b/;

    function nutritionTotals(items){return (items||[]).reduce((a,x)=>{a.kcal+=Number(x.kcal)||0;a.protein+=Number(x.protein)||0;a.fiber+=Number(x.fiber)||0;a.carbs+=Number(x.carbs)||0;a.fat+=Number(x.fat)||0;a.salt+=Number(x.salt)||0;return a;},{kcal:0,protein:0,fiber:0,carbs:0,fat:0,salt:0});}
    function parseMeal(raw,knowledge=[],structured=[],answers=[]){
      const base=structured.length?structured.map(x=>x.food_name||x.name).filter(Boolean).join(', '):raw,n=normalize(`${base} ${structured.length?raw:''}`),found=[];
      const push=(label,category,source)=>{if(!found.some(x=>x.category===category&&normalize(x.label)===normalize(label)))found.push({label,category,source});};
      for(const [rx,cat] of lexicon)for(const m of n.matchAll(new RegExp(rx.source,'g')))push(m[0],cat,'local');
      knowledge.forEach(k=>(k.categories||[]).forEach(c=>push(c,c,'dictionary')));
      answers.forEach(a=>(a.categories||[]).forEach(c=>push(a.label,c,'confirmed')));
      const flags=Object.assign({},...knowledge.map(k=>k.adapter_profile||{}));
      const names=knowledge.map(k=>normalize(k.canonical_name)).join(' ');
      const knownCategories=new Set(knowledge.flatMap(k=>k.categories||[]));
      const family=flags.adapter_family||(/muesli|granola|avoine|porridge/.test(`${n} ${names}`)?'sweet_bowl':/\b(burger|hamburger|cheeseburger)\b/.test(`${n} ${names}`)?'burger':sideDishRx.test(`${n} ${names}`)?'starch_side':flags.soup?'soup':flags.composite_complete?'complete_composite':flags.composition_variable?'variable_composite':knownCategories.has('fried')&&knownCategories.has('composite_dish')?'fried_snack':knownCategories.has('protein')&&!knownCategories.has('starch')?'protein_main':'general');
      const variable=!!flags.composition_variable,recognized=knowledge.length>0;
      const primary=knowledge[0]||{};
      return {normalized:n,found,knowledge,flags,family,dishName:primary.display_name||primary.canonical_name||'',typical:primary.typical_components||[],optional:primary.optional_components||[],nutrition:nutritionTotals(structured),confidence:recognized?(variable?'variable':'recognized'):found.length>=2?'probable':'ambiguous'};
    }
    function categoriesOf(p){return p.found.reduce((a,x)=>(a[x.category]=(a[x.category]||0)+1,a),{});}
    function mealQuestion(p){
      const cats=categoriesOf(p),has=c=>(cats[c]||0)>0,explicit=p.found.some(x=>x.source==='local'||x.source==='confirmed'),proteinEvidence=has('protein')||has('dairy_protein')||p.nutrition.protein>=12;
      const dish=p.dishName||'ce plat';
      if(p.family==='sweet_bowl'&&!proteinEvidence&&!smartAnswers.length)return {key:'sweet_bowl',title:'Ton muesli est accompagné de quoi ?',text:'Choisis tout ce qui correspond pour que Tee ne suppose rien.',multiple:true,options:[['protein','Lait, skyr ou yaourt',['dairy_protein']],['soy','Alternative soja protéinée',['dairy_protein']],['fruit','Un fruit',['fruit']],['nuts','Amandes, noix ou graines',['nuts_seeds']],['alone','Je le mange seul',[]]]};
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
        if(goal==='digestion')return {title:`Garder ${dish} en portion confortable`,body:'Conserve la recette et ajuste d’abord la portion de riz gluant ou de sauce coco selon ton confort, sans supprimer la mangue.',reason:'Cette préparation sucrée associe une base féculente, un fruit et une sauce riche.'};
        if(goal==='energie')return {title:`Utiliser ${dish} comme apport énergétique`,body:'Le riz gluant et la mangue apportent déjà une base glucidique. Évite simplement d’ajouter une autre boisson ou un dessert sucré au même moment.',reason:'L’intention énergie est déjà couverte par les glucides du plat.'};
        if(goal==='prise_masse')return {title:`Conserver l’énergie de ${dish}`,body:'Garde le riz, la mangue et la sauce coco. Si cela constitue une vraie collation, ajoute à côté un yaourt ou une alternative soja protéinée plutôt que de modifier la recette.',reason:'Le plat est énergétique mais sa composante protéinée reste faible.'};
        if(goal==='perte_poids')return {title:`Ajuster seulement la portion de ${dish}`,body:'Garde le dessert complet et choisis une portion satisfaisante. Le levier prioritaire est la quantité de riz gluant ou de sauce coco, pas la suppression de la mangue.',reason:'L’intention légèreté appelle un ajustement ciblé sur les éléments les plus concentrés.'};
        return {title:`Conserver l’identité de ${dish}`,body:'Garde le riz gluant, la mangue et la sauce coco ensemble. Ajuste seulement leur proportion selon ta faim, sans ajouter automatiquement de légumes ou de protéine salée.',reason:'Il s’agit d’une préparation sucrée cohérente dans son propre contexte.'};
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
      if(protein&&starch&&plant)return {title:`Conserver l’équilibre de ${dish}`,body:'Les principaux repères sont déjà présents. Ne rajoute rien automatiquement et ajuste seulement les quantités selon ta faim.',reason:'La protéine, la base énergétique et la partie végétale sont confirmées.'};
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
        return `J’ajouterais ${ingredient} à cette salade. C’est l’ajout précis que je choisirais pour l’intention « ${goalLabels[goal]||goal} », sans modifier les tomates ni les oignons.`;
      }
      if(p.family==='sweet_bowl'){
        const ingredient=byGoal({equilibre:'un skyr nature',digestion:'un yaourt nature',energie:'une banane',prise_masse:'une cuillère de purée d’amandes',perte_poids:'une poignée de fruits rouges',autre:'un skyr nature'});
        return protein&&plant?'Je n’ajouterais aucun ingrédient : le bol possède déjà sa base céréalière, sa protéine et son repère fruit ou fibre.':`J’ajouterais ${ingredient}. C’est l’ingrédient le plus cohérent avec ce bol et l’intention « ${goalLabels[goal]||goal} ».`;
      }
      if(p.family==='sweet_dish'){
        if(goal==='prise_masse')return `J’ajouterais un yaourt nature riche en protéines à côté de ${dish}, sans modifier la recette.`;
        return `Je n’ajouterais aucun ingrédient à ${dish}. J’ajusterais seulement la portion de riz gluant ou de sauce coco selon l’intention « ${goalLabels[goal]||goal} ».`;
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
        if(!protein){const ingredient=preciseOptional||byGoal({equilibre:'du tofu',digestion:'du poisson blanc',energie:'du poulet',prise_masse:'du poulet',perte_poids:'du poisson',autre:'du tofu'});return `J’ajouterais ${ingredient} dans cette version de ${dish}. C’est la variante protéinée précise que je privilégierais pour « ${goalLabels[goal]||goal} ».`;}
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
        return `Je n’ajouterais aucun ingrédient à ${dish} : ses accompagnements utiles sont déjà présents.`;
      }
      if(p.family==='complete_composite'){
        if(!protein){const ingredient=preciseOptional||byGoal({equilibre:'des pois chiches',digestion:'un œuf',energie:'du poulet',prise_masse:'du poulet',perte_poids:'du poisson',autre:'des pois chiches'});return `J’ajouterais ${ingredient} à cette version de ${dish}, uniquement si la recette servie n’en contient pas déjà.`;}
        if(!plant)return `J’ajouterais ${preciseVegetable||byGoal({equilibre:'des courgettes rôties',digestion:'des carottes cuites',energie:'des petits pois',prise_masse:'des petits pois',perte_poids:'des haricots verts',autre:'des courgettes rôties'})} à ${dish}, sans modifier la protéine ni le féculent.`;
        return `Je n’ajouterais aucun ingrédient à ${dish} : sa structure est déjà complète pour l’intention « ${goalLabels[goal]||goal} ».`;
      }
      if(!protein){const ingredient=byGoal({equilibre:'une portion de pois chiches',digestion:'un œuf dur',energie:'du poulet',prise_masse:'une portion de lentilles',perte_poids:'du thon au naturel',autre:'une portion de pois chiches'});return `J’ajouterais ${ingredient} à ce repas. C’est mon choix précis pour l’intention « ${goalLabels[goal]||goal} ».`;}
      if(!starch&&goal==='energie')return 'J’ajouterais une portion de quinoa pour apporter une base énergétique précise.';
      if(!starch&&goal==='prise_masse')return 'J’ajouterais une portion de riz pour compléter l’énergie du repas.';
      if(!plant)return 'J’ajouterais des courgettes rôties, sans modifier le reste du repas.';
      return 'Je n’ajouterais aucun ingrédient : les principaux repères du repas sont déjà présents.';
    }
    function renderQuestion(q){
      questionKey=q.key;questionBox.hidden=false;questionBox.innerHTML=`<div class="kicker">Une précision utile</div><h2>${F.esc(q.title)}</h2><p>${F.esc(q.text)}</p><div class="mt-food-question-options">${q.options.map(([v,l])=>`<button type="button" class="mt-food-question-option" data-answer="${v}">${F.esc(l)}</button>`).join('')}</div>`;
      questionBox.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{const opt=q.options.find(x=>x[0]===b.dataset.answer),exclusive=['alone','unknown'].includes(opt[0]);if(exclusive){smartAnswers=[{value:opt[0],label:opt[1],categories:opt[2]}];questionBox.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));}else{smartAnswers=smartAnswers.filter(x=>!['alone','unknown'].includes(x.value));const i=smartAnswers.findIndex(x=>x.value===opt[0]);if(i>=0)smartAnswers.splice(i,1);else smartAnswers.push({value:opt[0],label:opt[1],categories:opt[2]});questionBox.querySelectorAll('[data-answer]').forEach(x=>x.classList.toggle('active',smartAnswers.some(a=>a.value===x.dataset.answer)));}document.getElementById('adapterAnalyze').textContent='Continuer avec ces précisions';});
      questionBox.scrollIntoView({behavior:'smooth',block:'center'});
    }
    text.addEventListener('input',()=>{smartAnswers=[];questionKey='';questionBox.hidden=true;questionBox.innerHTML='';document.getElementById('adapterAnalyze').textContent='Obtenir mes ajustements';});

    function buildRecommendations(raw,goal,knowledge=[],structured=[],answers=[]){
      const p=parseMeal(raw,knowledge,structured,answers),cats=categoriesOf(p),recs=[],why=[],has=c=>(cats[c]||0)>0,count=c=>cats[c]||0;
      const proteinKnown=has('protein')||has('dairy_protein')||p.nutrition.protein>=12,fiberKnown=has('fruit')||has('vegetable')||has('wholegrain')||p.nutrition.fiber>=4,starchKnown=has('starch')||has('wholegrain')||p.nutrition.carbs>=25;
      const add=(title,body,reason)=>{if(recs.length<3){recs.push({title,body});if(reason)why.push(reason);}};
      let signature='Je garderais ce repas comme base et je modifierais seulement le point prioritaire indiqué ci-dessus.';

      if(p.family==='sweet_bowl'){
        if(!proteinKnown){add('Associer une protéine adaptée au bol','Garde ton muesli. Associe-le à un skyr, un yaourt nature riche en protéines ou une alternative soja protéinée. Inutile d’ajouter une protéine salée.','Le muesli constitue surtout une base céréalière et aucune source protéinée adaptée n’est confirmée.');signature='Je garderais le muesli et j’ajouterais seulement un skyr, un yaourt riche en protéines ou une alternative soja protéinée. Aucun légume, œuf, poulet ou poisson n’est nécessaire dans ce contexte.';}
        if(!has('fruit')&&answers.some(x=>x.value!=='alone'))add('Ajouter un fruit seulement s’il n’y en a pas déjà','Tu peux ajouter un fruit frais pour compléter le bol, mais ne le double pas si ton muesli en contient déjà une vraie portion.','Aucun fruit n’a été confirmé dans la composition.');
        if(proteinKnown&&fiberKnown){add('Ne change presque rien','Ton bol possède déjà une base céréalière, une source protéinée et un repère fruit ou fibre. Ajuste surtout la quantité selon ta faim.','Les principaux repères utiles sont déjà présents.');signature='Je garderais ce bol tel quel. La meilleure adaptation est simplement d’ajuster la quantité de muesli selon ta faim et d’observer ta satiété.';}
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
      signature=teeSpecificChoice(p,goal,cats);
      return {parsed:{...p,answers},recommendations:recs.slice(0,3),why:[...new Set(why)].slice(0,3),signature:{title:'Le choix de Tee',body:signature}};
    }

    function renderGoals(){goalsBox.innerHTML=Object.entries(goalLabels).map(([k,l])=>`<button type="button" class="mt-food-goal ${k===selectedGoal?'active':''}" data-goal="${k}">${l}</button>`).join('');goalsBox.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedGoal=b.dataset.goal;renderGoals();});}
    renderGoals();

    async function loadMeal(){
      const id=F.qs('meal_id');if(!id)return;
      const {data}=await sb.from('food_meals').select('id,meal_date,meal_type,description,photo_path,source_recipe_title,source_recipe_image_url').eq('id',id).eq('user_id',user.id).maybeSingle();if(!data)return;
      linkedMeal=data;text.value=data.description||data.source_recipe_title||'';photoPath=data.photo_path||'';
      if(photoPath){const url=await F.signedUrl(sb,photoPath,1800);if(url)preview.innerHTML=`<img src="${F.esc(url)}" alt="Photo du repas">`;}
      else if(data.source_recipe_image_url)preview.innerHTML=`<img src="${F.esc(data.source_recipe_image_url)}" alt="">`;
      const {data:items}=await sb.from('food_meal_items').select('food_name,ciqual_code,quantity_g,kcal,protein,fat,carbs,fiber,salt').eq('meal_id',id).order('sort_order');
      structuredItems=items||[];
      if(structuredItems.length){text.value=(data.description?data.description+'\n':'')+structuredItems.map(x=>x.food_name).join(', ');}
    }

    photoInput.onchange=()=>{const f=photoInput.files?.[0];if(!f)return;photoFile=f;preview.innerHTML=`<img src="${URL.createObjectURL(f)}" alt="Aperçu">`;};

    async function analyze(){
      const raw=text.value.trim();if(raw.length<3){F.toast('Décris d’abord ton repas.');return;}
      const btn=document.getElementById('adapterAnalyze');btn.disabled=true;
      try{
        let knowledge=[];try{knowledge=await F.resolveFoodText(sb,[raw,...structuredItems.map(x=>x.food_name)].join(', '),16);}catch(e){console.warn('food dictionary fallback',e);}
        const preliminary=parseMeal(raw,knowledge,structuredItems,smartAnswers),question=mealQuestion(preliminary);
        if(question){renderQuestion(question);return;}
        questionBox.hidden=true;
        const analysis=buildRecommendations(raw,selectedGoal,knowledge,structuredItems,smartAnswers);
        const id=crypto.randomUUID();
        let storedPhoto=photoPath;
        if(photoFile)storedPhoto=await F.uploadMealPhoto(sb,user,photoFile,id,photoPath);
        const row={id,user_id:user.id,meal_id:linkedMeal?.id||null,meal_date:linkedMeal?.meal_date||F.qs('date')||F.today(),input_text:raw,goal:selectedGoal,photo_path:storedPhoto||null,parsed_items:{...analysis.parsed,tee_signature:analysis.signature}, recommendations:analysis.recommendations,why:analysis.why,status:'proposed'};
        const {error}=await sb.from('food_adaptations').insert(row);if(error)throw error;
        renderResult(row,analysis,storedPhoto);
      }catch(e){console.warn('adapt save',e);F.toast(e.message||'Impossible de préparer les ajustements.');}finally{btn.disabled=false;}
    }
    document.getElementById('adapterAnalyze').onclick=analyze;

    function dayUrl(row){return `food-day.html?date=${linkedMeal?.meal_date||row?.meal_date||F.qs('date')||F.today()}`;}

    async function renderResult(row,analysis,storedPhoto,opts={}){
      let img='';if(storedPhoto)img=await F.signedUrl(sb,storedPhoto,1800);else if(linkedMeal?.source_recipe_image_url)img=linkedMeal.source_recipe_image_url;
      inputSection.hidden=true;resultSection.hidden=false;
      const confidence={recognized:'Composition reconnue',variable:'Plat reconnu · sa composition peut varier selon la recette',probable:'Composition partiellement reconnue',ambiguous:'Description trop générale'}[analysis.parsed?.confidence]||'Lecture indicative';
      const isReview=!!opts.review;
      const statusBlock=isReview&&row.status==='adopted'
        ? `<div class="mt-food-adopted-review"><span>✶ Ajustement adopté</span><small>Enregistré dans ton carnet</small></div>`
        : isReview&&row.status==='kept'
          ? `<div class="mt-food-adopted-review is-kept"><span>Repas conservé tel quel</span><small>Décision enregistrée</small></div>`
          : '';
      const actions=isReview
        ? `<div class="mt-food-result-actions"><button class="main-cta" id="foodBackDay">Retour à ma journée</button>${row.meal_id?'<button class="ghost-btn mt-food-outline" id="foodNewAdapt">Créer un nouvel ajustement</button>':''}</div>`
        : `<div class="mt-food-result-actions"><button class="main-cta" id="foodAdopt">J’adopte ces changements</button><button class="ghost-btn mt-food-outline" id="foodKeep">Je garde mon repas comme prévu</button></div>`;
      resultSection.innerHTML=`${statusBlock}<section class="mt-food-adapter-current ${img?'':'no-image'}">${img?`<img src="${F.esc(img)}" alt="Photo du repas" loading="lazy">`:''}<div><small>Ton repas actuel</small><h2>${F.esc(linkedMeal?.source_recipe_title||'Ton repas')}</h2><p>${F.esc(row.input_text)}</p><small>${F.esc(confidence)}</small></div></section><section class="mt-food-adapter-list"><small>Tee te propose · suggestions indicatives</small><h2>${analysis.recommendations.length} ajustement${analysis.recommendations.length>1?'s':''} simple${analysis.recommendations.length>1?'s':''}</h2>${analysis.recommendations.map((r,i)=>`<div class="mt-food-adjustment"><i>${i+1}</i><div><b>${F.esc(r.title)}</b><p>${F.esc(r.body)}</p></div></div>`).join('')}</section><section class="mt-food-signature"><small>Le choix de Tee</small><h2>${F.esc(analysis.signature?.title||'Le choix de Tee')}</h2><p>${F.esc(analysis.signature?.body||'')}</p></section><section class="mt-food-why"><small>Pourquoi ces changements ?</small><h2>Le minimum utile</h2><ul>${analysis.why.length?analysis.why.map(x=>`<li>${F.esc(x)}</li>`).join(''):'<li>Tee n’a détecté aucun changement prioritaire avec suffisamment de confiance.</li>'}</ul></section>${actions}`;
      if(isReview){
        document.getElementById('foodBackDay').onclick=()=>location.href=dayUrl(row);
        const again=document.getElementById('foodNewAdapt');if(again)again.onclick=()=>location.href=`food-adapter.html?meal_id=${encodeURIComponent(row.meal_id)}`;
      }else{
        document.getElementById('foodAdopt').onclick=()=>saveDecision(row,'adopted');
        document.getElementById('foodKeep').onclick=()=>saveDecision(row,'kept');
      }
      scrollTo({top:0,behavior:isReview?'auto':'smooth'});
    }

    async function saveDecision(row,status){
      const decidedAt=new Date().toISOString();
      const {error}=await sb.from('food_adaptations').update({status,decided_at:decidedAt}).eq('id',row.id).eq('user_id',user.id);
      if(error){console.warn('adapt decision',error);F.toast('Impossible d’enregistrer ce choix.');return;}
      row.status=status;row.decided_at=decidedAt;
      if(status==='adopted'){
        F.toast(linkedMeal?'Ajustement adopté · visible sur ce repas.':'Ajustement adopté pour cette journée.');
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
        const {data:meal}=await sb.from('food_meals').select('id,meal_date,meal_type,description,photo_path,source_recipe_title,source_recipe_image_url').eq('id',row.meal_id).eq('user_id',user.id).maybeSingle();
        if(meal)linkedMeal=meal;
      }
      const parsed=row.parsed_items||{},analysis={parsed,recommendations:Array.isArray(row.recommendations)?row.recommendations:[],why:Array.isArray(row.why)?row.why:[],signature:parsed.tee_signature||{}};
      await renderResult(row,analysis,row.photo_path,{review:true});
      return true;
    }

    if(!(await loadSavedAdaptation())){await loadMeal();if(!linkedMeal&&F.qs('text'))text.value=F.qs('text');}
  });
})();
