(function(){
  'use strict';
  const INTENTS={
    equilibre:'Équilibre',digestion:'Digestion',energie:'Énergie',
    construire:'Nourrir & construire',legerete:'Retrouver de la légèreté',gourmandise:'Gourmandise'
  };
  const FALLBACK=[
    {canonical_name:'Bowl de riz, poulet et légumes',display_name:'Bowl de riz, poulet et légumes',categories:['starch','protein','vegetable','composite_dish'],typical_components:['riz','poulet','légumes'],optional_components:['citron','yaourt'],adapter_profile:{adapter_family:'complete_composite'}},
    {canonical_name:'Salade de pois chiches et bœuf',display_name:'Salade de pois chiches et bœuf',categories:['protein','vegetable','composite_dish'],typical_components:['pois chiches','bœuf','tomates','concombre'],optional_components:['citron'],adapter_profile:{adapter_family:'complete_composite'}},
    {canonical_name:'Pâtes au poulet et aux champignons',display_name:'Pâtes au poulet et aux champignons',categories:['starch','protein','composite_dish'],typical_components:['pâtes','poulet','champignons'],optional_components:['herbes'],adapter_profile:{adapter_family:'noodle_dish'}},
    {canonical_name:'Soupe de lentilles et carottes',display_name:'Soupe de lentilles et carottes',categories:['protein','vegetable','soup'],typical_components:['lentilles','carottes','oignon'],optional_components:['citron'],adapter_profile:{adapter_family:'soup'}},
    {canonical_name:'Omelette aux légumes et pommes de terre',display_name:'Omelette aux légumes et pommes de terre',categories:['protein','vegetable','starch','composite_dish'],typical_components:['œufs','légumes','pommes de terre'],optional_components:['herbes'],adapter_profile:{adapter_family:'complete_composite'}},
    {canonical_name:'Curry de pois chiches et riz',display_name:'Curry de pois chiches et riz',categories:['protein','starch','composite_dish'],typical_components:['pois chiches','riz','tomates'],optional_components:['épinards'],adapter_profile:{adapter_family:'sauce_dish'}},
    {canonical_name:'Wrap de poulet et crudités',display_name:'Wrap de poulet et crudités',categories:['protein','vegetable','starch','composite_dish'],typical_components:['galette','poulet','crudités'],optional_components:['yaourt'],adapter_profile:{adapter_family:'filled_dough'}},
    {canonical_name:'Smoothie fruits rouges et yaourt grec',display_name:'Smoothie fruits rouges et yaourt grec',categories:['fruit','dairy_protein','composite_dish'],typical_components:['framboises','myrtilles','yaourt grec','lait d’amande'],optional_components:['vanille','graines de chia'],adapter_profile:{adapter_family:'sweet_bowl',preparation_kind:'smoothie',do_not_auto_suggest_vegetables:true}},
    {canonical_name:'Verrine de yaourt grec aux fruits rouges',display_name:'Verrine de yaourt grec aux fruits rouges',categories:['fruit','dairy_protein','composite_dish'],typical_components:['yaourt grec','framboises','myrtilles'],optional_components:['amandes','vanille'],adapter_profile:{adapter_family:'sweet_bowl',preparation_kind:'verrine',do_not_auto_suggest_vegetables:true}},
    {canonical_name:'Pudding coco et graines de chia',display_name:'Pudding coco et graines de chia',categories:['fruit','nuts_seeds','composite_dish'],typical_components:['lait de coco','graines de chia'],optional_components:['framboises','myrtilles','vanille'],adapter_profile:{adapter_family:'sweet_dish',preparation_kind:'pudding',do_not_auto_suggest_vegetables:true}}
  ];
  const norm=v=>String(v||'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[^a-z0-9]+/g,' ').trim();
  const esc=v=>window.MTFood?.esc?window.MTFood.esc(v):String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const componentName=v=>typeof v==='string'?v:(v?.name||v?.label||v?.ingredient||'');
  const components=(item,key)=>Array.isArray(item?.[key])?item[key].map(componentName).filter(Boolean):[];
  const words=v=>norm(v).split(/\s+/).filter(x=>x.length>1);
  const includesIngredient=(haystack,ingredient)=>{
    const a=norm(haystack),b=norm(ingredient);if(!b)return false;
    const pad=v=>` ${v} `;
    if(a===b||pad(a).includes(` ${b} `))return true;
    if(b.length>=6&&pad(b).includes(` ${a} `))return true;
    const aw=new Set(words(a)),bw=words(b).filter(w=>w.length>3);
    return !!bw.length&&bw.every(w=>aw.has(w)||[...aw].some(x=>x.length>4&&(x.startsWith(w)||w.startsWith(x))));
  };
  const family=item=>norm(item?.adapter_profile?.adapter_family||'general').replace(/ /g,'_');
  const categories=item=>(item?.categories||[]).map(norm);
  const title=item=>item?.display_name||item?.canonical_name||'Une idée à composer';
  const nutrition=item=>item?.ciqual||{};
  const frenchList=items=>{
    const rows=(items||[]).map(x=>String(x||'').trim()).filter(Boolean);
    if(rows.length<2)return rows[0]||'';
    return `${rows.slice(0,-1).join(', ')} et ${rows.at(-1)}`;
  };
  const sentence=items=>{const value=frenchList(items);return value?`${value.charAt(0).toLocaleUpperCase('fr')}${value.slice(1)}.`:'';};
  const addableLabel=value=>({
    'tomates ou courgettes':'les tomates ou les courgettes',
    'courgette ou épinards':'la courgette ou les épinards',
    'ail ou herbes fraîches':'de l’ail ou des herbes fraîches',
    'banane ou flocons d’avoine':'une banane ou des flocons d’avoine',
    'purée d’amandes ou graines de chanvre':'une cuillère de purée d’amandes ou des graines de chanvre',
    'yaourt grec ou alternative soja':'un yaourt grec ou une alternative soja',
    'vanille ou copeaux de coco':'de la vanille ou des copeaux de coco',
    'menthe fraîche ou gingembre':'de la menthe fraîche ou du gingembre',
    'quelques amandes concassées, facultatives':'quelques amandes concassées, si tu en as envie',
    'graines de chia ou amandes concassées':'des graines de chia ou quelques amandes concassées',
    'cannelle ou vanille':'de la cannelle ou de la vanille',
    'cannelle ou cardamome':'de la cannelle ou de la cardamome',
    'zeste de citron':'un peu de zeste de citron',
    'cannelle ou cacao non sucré':'de la cannelle ou du cacao non sucré',
    'flocons d’avoine':'quelques flocons d’avoine',
    'menthe fraîche ou citron vert':'de la menthe fraîche ou un peu de citron vert',
    'gingembre frais':'un peu de gingembre frais',
    'quelques glaçons':'quelques glaçons',
    'cacao non sucré ou cannelle':'du cacao non sucré ou de la cannelle',
    'amandes effilées':'quelques amandes effilées',
    'graines de chia':'des graines de chia',
    'tomates ou oignon rouge':'des tomates ou un peu d’oignon rouge',
    'herbes fraîches ou citron':'des herbes fraîches ou un trait de citron',
    'graines de courge ou sésame':'des graines de courge ou de sésame',
    'tomates ou concombre':'des tomates ou du concombre',
    'gingembre ou cumin doux':'un peu de gingembre ou de cumin doux',
    'fenouil ou menthe fraîche':'du fenouil ou de la menthe fraîche',
    'huile d’olive ou avocat':'un filet d’huile d’olive ou de l’avocat',
    'graines de courge ou feta':'des graines de courge ou un peu de feta',
    'yaourt aux herbes ou citron':'une sauce au yaourt et aux herbes ou un trait de citron',
    'herbes fraîches ou oignon rouge':'des herbes fraîches ou un peu d’oignon rouge',
    'concombre ou radis':'du concombre ou quelques radis',
    'feta ou parmesan':'un peu de feta ou de parmesan',
    'sauce au yaourt ou pesto':'une sauce au yaourt ou un peu de pesto',
    'graines grillées ou herbes fraîches':'quelques graines grillées ou des herbes fraîches',
    'courgette ou carottes':'de la courgette ou des carottes',
    'épinards ou fenouil':'des épinards ou du fenouil',
    'concombre, tomates ou courgette':'du concombre, des tomates ou de la courgette',
    'épinards ou salade':'des épinards ou de la salade',
    'tomates, courgette ou épinards':'des tomates, de la courgette ou des épinards',
    'brocoli ou poivron':'du brocoli ou du poivron',
    'riz, quinoa ou pommes de terre':'du riz, du quinoa ou des pommes de terre',
    'pain complet ou semoule':'du pain complet ou de la semoule',
    'œufs, poulet ou pois chiches':'des œufs, du poulet ou des pois chiches',
    'poulet, œufs ou tofu':'du poulet, des œufs ou du tofu',
    'thon ou tofu':'du thon ou du tofu',
    'thon ou pois chiches':'du thon ou des pois chiches',
    'ail ou gingembre':'de l’ail ou du gingembre',
    'citron ou vinaigre doux':'un trait de citron ou de vinaigre doux',
    'oignon rouge ou herbes fraîches':'un peu d’oignon rouge ou des herbes fraîches',
    'sauce au yaourt ou citron':'une sauce au yaourt ou un trait de citron',
    'oignon ou épices douces':'de l’oignon ou des épices douces',
    'parmesan ou chapelure':'un peu de parmesan ou de chapelure',
    'moutarde ou citron':'un peu de moutarde ou un trait de citron',
    'moutarde ou sauce au yaourt':'un peu de moutarde ou une sauce au yaourt',
    'épinards ou champignons':'des épinards ou des champignons',
    'tomates ou herbes fraîches':'des tomates ou des herbes fraîches',
    'fruits frais ou cacao non sucré':'des fruits frais ou un peu de cacao non sucré',
    'fruits frais ou graines':'des fruits frais ou quelques graines',
    'fruits frais ou compote sans sucre':'des fruits frais ou une compote sans sucre ajouté',
    'yaourt grec ou fromage blanc':'un yaourt grec ou du fromage blanc',
    'banane congelée':'une banane congelée',
    'sauce soja ou citron vert':'un peu de sauce soja ou un trait de citron vert',
    'bouillon ou miso':'un bouillon léger ou un peu de miso',
    'citron vert ou vinaigre de riz':'du citron vert ou un peu de vinaigre de riz',
    'herbes fraîches ou sésame':'des herbes fraîches ou du sésame',
    'sésame ou herbes fraîches':'du sésame ou des herbes fraîches',
    'sauce légère ou citron vert':'une sauce légère ou un trait de citron vert',
    'quinoa ou pois chiches':'du quinoa ou des pois chiches',
    'avocat ou graines':'de l’avocat ou quelques graines',
    'thon, poulet ou tofu':'du thon, du poulet ou du tofu',
    'œufs ou feta':'des œufs ou un peu de feta',
    'feta ou graines':'un peu de feta ou quelques graines',
    'ail ou épices douces':'de l’ail ou des épices douces',
    'flocons d’avoine ou farine':'des flocons d’avoine ou un peu de farine',
    'herbes fraîches ou épices':'des herbes fraîches ou des épices douces',
    'oignon':'un oignon',
    'riz ou pommes de terre':'du riz ou des pommes de terre',
    'riz ou quinoa':'du riz ou du quinoa',
    'semoule ou riz':'de la semoule ou du riz',
    'salade ou courgette':'de la salade ou de la courgette',
    'courgette ou haricots verts':'de la courgette ou des haricots verts',
    'concombre ou tomates':'du concombre ou des tomates',
    'poivron ou courgette':'du poivron ou de la courgette',
    'pommes de terre ou pain complet':'des pommes de terre ou du pain complet',
    'citron ou herbes fraîches':'un trait de citron ou des herbes fraîches',
    'ail ou persil':'de l’ail ou du persil'
  }[String(value||'').toLocaleLowerCase('fr')]||value);
  const favoriteKey=uid=>`mt_tee_inspired_favorites_v1_${uid}`;
  const readFavorites=uid=>{try{return JSON.parse(localStorage.getItem(favoriteKey(uid))||'[]');}catch(e){return [];}};
  const writeFavorites=(uid,rows)=>{try{localStorage.setItem(favoriteKey(uid),JSON.stringify(rows.slice(0,10)));}catch(e){}};
  let user=null,intent='equilibre',ranked=[],cursor=0,current=null,currentName='',lastIngredients='',variationIndex=0,currentSnapshot=null;

  function inputIngredients(value){
    const prepared=String(value||'')
      .replace(/^\s*j['’]ai\s+/i,'')
      .replace(/[;\n]+/g,',')
      .replace(/\s*\+\s*/g,',')
      .replace(/\s+(?:et|avec|plus)\s+/gi,',')
      // « de la semoule du poulet » devient deux ingrédients sans casser
      // « côtes d'agneau », où l'article appartient au nom de l'aliment.
      .replace(/\s+(?=(?:du|des|de la|de l['’])\s*)/gi,',')
      // Quelques successions usuelles restent compréhensibles sans article
      // ni virgule : « pâtes saucisses », « riz poulet », « semoule agneau ».
      .replace(/\b(pâtes?|riz|semoule|couscous|quinoa|boulgour|manioc|igname|plantain|fonio|millet|mil|atti[eé]k[eé])\s+(?=(?:saucisses?|merguez|poulet|dinde|steak(?:\s+hach[ée])?|b[œo]uf|agneau|saumon|thon|dorade|daurade|tilapia|bar|loup\s+de\s+mer|merlu|merlan|lieu(?:\s+(?:noir|jaune))?|sole|truite|capitaine|vivaneau|rouget|turbot|lotte|haddock|[ée]glefin|aiglefin|hareng|espadon|cabillaud|colin|sardines?|maquereau|anchois|morue|tofu|[œo]ufs?)\b)/gi,'$1,')
      // Accepte aussi « riz steak haché laitue » ou « manioc dorade gombo ».
      .replace(/\b(steak(?:\s+hach[ée])?|viande\s+hach[ée]e?|b[œo]uf|veau|poulet|dinde|canard|agneau|mouton|porc|saucisses?|merguez|kefta|kofta|[œo]ufs?|saumon|thon|dorade|daurade|tilapia|bar|merlu|merlan|lieu(?:\s+(?:noir|jaune))?|sole|truite|capitaine|vivaneau|rouget|turbot|lotte|haddock|[ée]glefin|aiglefin|hareng|espadon|cabillaud|colin|sardines?|maquereau|anchois|morue|crevettes?|gambas|tofu|tempeh|seitan|lentilles?|pois\s+chiches?)\s+(?=(?:laitue|salade|iceberg|romaine|sucrine|roquette|m[âa]che|endive|[ée]pinards?|tomates?|concombres?|courgettes?|poivrons?|carottes?|brocolis?|chou(?:x|\s+fleur)?|aubergines?|haricots?\s+verts?|champignons?|poireaux?|fenouil|asperges?|artichauts?|betteraves?|c[ée]leri|radis|potiron|courges?|avocat|ma[ïi]s|petits?\s+pois|gombo|okra|pak\s+choi|bok\s+choy)\b)/gi,'$1,')
      // Les sauces et marinades usuelles sont aussi séparées quand l'utilisateur
      // écrit naturellement « poulet citron moutarde » sans virgules ni « + ».
      .replace(/\b(poulet|dinde|canard|steak(?:\s+hach[ée])?|b[œo]uf|veau|agneau|mouton|porc|saumon|thon|dorade|daurade|tilapia|bar|merlu|sole|truite|cabillaud|tofu)\s+(?=(?:citron(?:\s+(?:jaune|vert))?|moutarde|ail|gingembre|sauce\s+soja|tamari|curry|colombo|lait\s+de\s+coco|cr[èe]me\s+de\s+coco|tomates?|oignons?|miel)\b)/gi,'$1,')
      .replace(/\b(citron(?:\s+(?:jaune|vert))?|moutarde|ail|gingembre|sauce\s+soja|tamari|curry|colombo|lait\s+de\s+coco|cr[èe]me\s+de\s+coco|tomates?|oignons?|miel)\s+(?=(?:citron(?:\s+(?:jaune|vert))?|moutarde|ail|gingembre|sauce\s+soja|tamari|curry|colombo|lait\s+de\s+coco|cr[èe]me\s+de\s+coco|tomates?|oignons?|miel)\b)/gi,'$1,');
    return prepared.split(',').map(x=>x.trim()
      .replace(/^(?:j['’]ai|avec)\s+/i,'')
      .replace(/^(?:de la|de l['’]|du|des|la|le|les|un|une)\s+/i,'')
      .trim()).filter(Boolean).slice(0,12);
  }

  // V395 · Lecture locale des ingrédients : les catégories sont déduites à partir
  // de ce que la personne a réellement écrit. Cela évite par exemple de traiter
  // « laitue » comme « lait », ou d'oublier qu'un steak haché est une protéine.
  const FOOD_RX={
    starch:/\b(riz|pates?|spaghetti|tagliatelles?|penne|macaronis?|nouilles?|vermicelles?|udon|soba|semoule|couscous|quinoa|boulgour|ble|epeautre|orge|polenta|pommes? de terre|puree de pommes? de terre|patates? douces?|gnocchis?|pain|baguette|wrap|tortilla|galette|flocons? d avoine|avoine|manioc|igname|plantain|bananes? plantain|fonio|millet|mil|attieke|frites?)\b/,
    flour:/\b(farine|fecule|maizena)\b/,
    protein:/\b(steak(?: hache)?|viande hachee?|boeuf|veau|poulet|dinde|canard|agneau|mouton|porc|jambon|bacon|saucisses?|merguez|kefta|kofta|oeufs?|saumon|thon|dorades?|daurades?|tilapias?|bar|bars|loup de mer|loups de mer|merlus?|merlans?|lieu(?: noir| jaune)?|lieux(?: noirs?| jaunes?)?|soles?|truites?|capitaines?|vivaneaux?|rougets?|turbots?|lottes?|haddocks?|eglefins?|aiglefins?|harengs?|espadons?|cabillauds?|colins?|sardines?|maquereaux?|anchois|morue|morues|brochets?|perches?|carpes?|mulets?|pagres?|pageots?|poisson|poissons|crevettes?|gambas|moules?|palourdes?|coques?|huitres?|calamars?|encornets?|seiches?|poulpes?|crabes?|homards?|langoustes?|langoustines?|saint jacques|noix de saint jacques|fruits? de mer|tofu|tempeh|seitan|lentilles?|pois chiches?|haricots? (?:rouges?|blancs?|noirs?|secs?)|flageolets?|edamame|falafels?|feta|mozzarella|halloumi|fromage|skyr|yaourt grec|fromage blanc)\b/,
    savoryProtein:/\b(steak(?: hache)?|viande hachee?|boeuf|veau|poulet|dinde|canard|agneau|mouton|porc|jambon|bacon|saucisses?|merguez|kefta|kofta|oeufs?|saumon|thon|dorades?|daurades?|tilapias?|bar|bars|loup de mer|loups de mer|merlus?|merlans?|lieu(?: noir| jaune)?|lieux(?: noirs?| jaunes?)?|soles?|truites?|capitaines?|vivaneaux?|rougets?|turbots?|lottes?|haddocks?|eglefins?|aiglefins?|harengs?|espadons?|cabillauds?|colins?|sardines?|maquereaux?|anchois|morue|morues|brochets?|perches?|carpes?|mulets?|pagres?|pageots?|poisson|poissons|crevettes?|gambas|moules?|palourdes?|coques?|huitres?|calamars?|encornets?|seiches?|poulpes?|crabes?|homards?|langoustes?|langoustines?|saint jacques|noix de saint jacques|fruits? de mer|tofu|tempeh|seitan|lentilles?|pois chiches?|haricots? (?:rouges?|blancs?|noirs?|secs?)|flageolets?|edamame|falafels?)\b/,
    fish:/\b(saumon|thon|dorades?|daurades?|tilapias?|bar|bars|loup de mer|loups de mer|merlus?|merlans?|lieu(?: noir| jaune)?|lieux(?: noirs?| jaunes?)?|soles?|truites?|capitaines?|vivaneaux?|rougets?|turbots?|lottes?|haddocks?|eglefins?|aiglefins?|harengs?|espadons?|cabillauds?|colins?|sardines?|maquereaux?|anchois|morue|morues|brochets?|perches?|carpes?|mulets?|pagres?|pageots?|poisson|poissons)\b/,
    seafood:/\b(crevettes?|gambas|moules?|palourdes?|coques?|huitres?|calamars?|encornets?|seiches?|poulpes?|crabes?|homards?|langoustes?|langoustines?|saint jacques|noix de saint jacques|fruits? de mer)\b/,
    vegetable:/\b(laitue|salade|iceberg|romaine|sucrine|roquette|mache|endive|epinards?|tomates?|concombres?|courgettes?|poivrons?|carottes?|brocolis?|chou fleur|choux?|aubergines?|haricots? verts?|champignons?|poireaux?|fenouil|asperges?|artichauts?|betteraves?|celeri|radis|potiron|courges?|avocat|mais|petits? pois|gombo|okra|pak choi|bok choy|pousses? de soja|pousses? de bambou)\b/,
    leafy:/\b(laitue|salade|iceberg|romaine|sucrine|roquette|mache|endive|epinards?|chou kale|kale|mesclun|jeunes? pousses?)\b/,
    freshLeaf:/\b(laitue|salade|iceberg|romaine|sucrine|roquette|mache|endive|mesclun|jeunes? pousses?)\b/,
    cupLeaf:/\b(laitue|romaine|sucrine|iceberg)\b/,
    aromatic:/\b(oignons?|echalotes?|ail|gingembre|ciboulette|persil|coriandre|basilic|menthe|aneth|thym|romarin|herbes?)\b/,
    fruit:/\b(framboises?|myrtilles?|fraises?|mures?|cassis|bananes?(?! plantain)|mangues?|poires?|pommes?(?! de terre)|peches?|nectarines?|abricots?|ananas|kiwis?|oranges?|clementines?|raisins?|cerises?|grenade|papaye|fruit de la passion|passion|goyave|litchis?|fruits? rouges?)\b/,
    pulse:/\b(lentilles?|pois chiches?|haricots? (?:rouges?|blancs?|noirs?|secs?)|flageolets?|edamame)\b/,
    yogurt:/\b(yaourt grec|yaourt nature|yaourt soja|skyr|fromage blanc|petit suisse)\b/,
    sweetLiquid:/\b(lait(?: entier| demi ecreme| ecreme)?|lait d amande|lait de coco|lait d avoine|lait de soja|boisson amande|boisson coco|boisson avoine|boisson soja|eau de coco|kefir|creme de coco)\b/,
    fat:/\b(huile d olive|huile|beurre|avocat|amandes?|noix|noisettes?|pistaches?|graines?|chia|chanvre|lin|puree d amande|purée d amande|beurre de cacahuete|cacahuetes?)\b/,
    cheese:/\b(feta|mozzarella|parmesan|emmental|comte|chevre|fromage)\b/,
    sauce:/\b(sauce|moutarde|mayonnaise|pesto|houmous|vinaigre|citron|citron vert|soja|tamari)\b/,
    herb:/\b(persil|coriandre|basilic|menthe|ciboulette|aneth|thym|romarin|herbes?)\b/,
    chia:/\b(chia|graines? de chia)\b/,
    oats:/\b(avoine|flocons? d avoine)\b/,
    buckwheat:/\b(sarrasin|ble noir|farine de ble noir)\b/
  };
  const rxTest=(re,value)=>re.test(norm(value));
  function analyzeIngredients(input){
    const raw=inputIngredients(input);
    const rows=raw.map(label=>{
      const n=norm(label),kinds=[];
      Object.entries(FOOD_RX).forEach(([key,re])=>{if(re.test(n))kinds.push(key);});
      return {label,n,kinds};
    });
    const by=key=>rows.filter(x=>x.kinds.includes(key)).map(x=>x.label);
    const starches=by('starch'),proteins=by('protein'),savoryProteins=by('savoryProtein'),vegetables=by('vegetable');
    return {raw,rows,starches,proteins,savoryProteins,vegetables,fishes:by('fish'),seafood:by('seafood'),pulses:by('pulse'),leafy:by('leafy'),freshLeafy:by('freshLeaf'),cupLeaf:by('cupLeaf'),aromatics:by('aromatic'),fruits:by('fruit'),yogurts:by('yogurt'),sweetLiquids:by('sweetLiquid'),fats:by('fat'),cheeses:by('cheese'),sauces:by('sauce'),herbs:by('herb'),flours:by('flour'),chia:by('chia'),oats:by('oats'),buckwheat:by('buckwheat')};
  }
  const lower=v=>String(v||'').toLocaleLowerCase('fr');
  const cap=v=>{const x=String(v||'');return x?x.charAt(0).toLocaleUpperCase('fr')+x.slice(1):'';};
  const first=(rows)=>rows?.[0]||'';
  const titleJoin=rows=>frenchList((rows||[]).filter(Boolean).map(lower));
  function withArticle(value){
    const v=lower(value),n=norm(value);if(!v)return '';
    if(/^(oeufs|pates|nouilles|lentilles|pois chiches|haricots|crevettes|gambas|tomates|carottes|courgettes|epinards|champignons|pommes de terre|patates douces|frites|framboises|myrtilles|fraises|mures|bananes|mangues|poires|pommes|peches|kiwis|oranges|raisins|cerises|morceaux|blancs|filets|paves|escalopes|aiguillettes|tranches|lamelles|cubes|medaillons|feuilles|jeunes pousses)\b/.test(n))return `les ${v}`;
    if(/^(yaourt|skyr|fromage blanc|lait|riz|pain|steak|poulet|boeuf|saumon|thon|tilapia|bar|loup de mer|merlu|merlan|lieu|capitaine|vivaneau|rouget|turbot|haddock|eglefin|aiglefin|hareng|espadon|cabillaud|colin|maquereau|anchois|brochet|mulet|pagre|pageot|poisson|tofu|beurre|cassis|kiwi|raisin|fromage)\b/.test(n))return `le ${v}`;
    if(/^(laitue|salade|roquette|mache|endive|semoule|courgette|tomate|carotte|viande|feta|mozzarella|dorade|daurade|sole|truite|lotte|sardine|morue|perche|carpe|crevette|palourde|coque|seiche|langouste|langoustine|banane|mangue|poire|pomme|peche|farine|fraise|framboise|myrtille|mure|cerise)\b/.test(n))return `la ${v}`;
    if(/^[aeiouh]/.test(n))return `l’${v}`;
    return `le ${v}`;
  }
  function withA(value){
    const article=withArticle(value);
    if(article.startsWith('le '))return `au ${article.slice(3)}`;
    if(article.startsWith('la '))return `à la ${article.slice(3)}`;
    if(article.startsWith('les '))return `aux ${article.slice(4)}`;
    if(article.startsWith('l’'))return `à ${article}`;
    return `avec ${lower(value)}`;
  }
  function freshLeafTitle(value){
    const n=norm(value);
    if(/roquette/.test(n))return 'roquette fraîche';
    if(/mache/.test(n))return 'mâche fraîche';
    if(/endive/.test(n))return 'endive fraîche';
    if(/mesclun/.test(n))return 'mesclun frais';
    if(/jeunes? pousses?/.test(n))return 'jeunes pousses';
    return 'salade fraîche';
  }
  function suggestionCovered(input,value){
    const n=norm(input),s=norm(value);
    if(/herbe/.test(s)&&FOOD_RX.herb.test(n))return true;
    if(/sauce au yaourt|yaourt grec|alternative soja/.test(s)&&FOOD_RX.yogurt.test(n))return true;
    if(/oignon/.test(s)&&/\boignon/.test(n))return true;
    if(/citron/.test(s)&&/\bcitron/.test(n))return true;
    if(/tomate/.test(s)&&/\btomate/.test(n))return true;
    if(/chia/.test(s)&&FOOD_RX.chia.test(n))return true;
    if(/avoine/.test(s)&&FOOD_RX.oats.test(n))return true;
    if(/banane/.test(s)&&/\bbanane/.test(n))return true;
    return s.split(/\bou\b|\bet\b|,|\//).map(x=>x.trim()).filter(x=>x.length>2).some(x=>includesIngredient(input,x));
  }
  function firstAbsentSuggestion(input,candidates){
    return (candidates||[]).find(x=>!suggestionCovered(input,x))||(candidates||[]).at(-1)||'herbes fraîches ou citron';
  }
  function ensureMissingSuggestions(input,rows){
    const clean=(rows||[]).filter(Boolean).filter((x,i,r)=>r.indexOf(x)===i&&!suggestionCovered(input,x));
    if(clean.length)return clean.slice(0,2);
    const fallbacks=[genericFinishingSuggestion(input),'herbes fraîches ou citron','graines de courge ou sésame','oignon rouge ou herbes fraîches','épices douces selon ton goût'];
    const next=fallbacks.find(x=>x&&!suggestionCovered(input,x));
    return [next||'épices douces selon ton goût'];
  }
  function canonicalProteinLabel(value){
    const n=norm(value),v=lower(value);
    if(/\bpoulet\b/.test(n))return 'poulet';
    if(/\bdinde\b/.test(n))return 'dinde';
    if(/\b(?:steak|boeuf|viande hachee)\b/.test(n))return 'bœuf';
    if(/\bveau\b/.test(n))return 'veau';
    if(/\b(?:agneau|mouton)\b/.test(n))return /mouton/.test(n)?'mouton':'agneau';
    if(/\bporc\b/.test(n))return 'porc';
    if(/\btofu\b/.test(n))return 'tofu';
    if(/\btempeh\b/.test(n))return 'tempeh';
    const known=['saumon','thon','dorade','daurade','tilapia','bar','loup de mer','merlu','merlan','lieu noir','lieu jaune','sole','truite','capitaine','vivaneau','rouget','turbot','lotte','haddock','églefin','aiglefin','hareng','espadon','cabillaud','colin','sardine','maquereau','anchois','morue','crevette','gambas'];
    const found=known.find(x=>n.includes(norm(x)));if(found)return found;
    return v.replace(/^(?:blancs?|filets?|escalopes?|pavés?)\s+(?:de|du|d['’])?\s*/i,'').trim()||v;
  }
  function culinaryComplementSuggestions(input,a,{preferOnion=false}={}){
    const out=[],n=norm(input);
    const push=value=>{if(value&&!suggestionCovered(input,value)&&!out.includes(value))out.push(value);};
    const hasBase=a.starches.some(x=>!FOOD_RX.oats.test(norm(x)))||a.pulses.length||a.flours.length;
    const hasVeg=a.vegetables.length>0;
    const hasOnion=/\boignons?\b/.test(n);
    if(intent==='digestion'){
      if(!hasVeg)push('courgette ou carottes');
      if(!hasBase)push('riz ou pommes de terre');
      push('herbes fraîches ou citron');
    }else if(intent==='legerete'){
      if(!hasVeg)push('salade ou courgette');
      if(preferOnion&&!hasOnion)push('oignon');
      push('herbes fraîches ou citron');
    }else if(intent==='energie'){
      if(!hasBase)push('riz ou pommes de terre');
      if(preferOnion&&!hasOnion)push('oignon');
      if(!hasVeg)push('courgette ou haricots verts');
    }else if(intent==='construire'){
      if(!hasBase)push('riz ou quinoa');
      if(!hasVeg)push('courgette ou haricots verts');
      if(preferOnion&&!hasOnion)push('oignon');
    }else if(intent==='gourmandise'){
      if(preferOnion&&!hasOnion)push('oignon');
      if(!hasBase)push('pommes de terre ou pain complet');
      if(!hasVeg)push('courgette ou haricots verts');
    }else{
      if(preferOnion&&!hasOnion)push('oignon');
      if(!hasBase)push('riz ou pommes de terre');
      if(!hasVeg)push('salade ou courgette');
      push('herbes fraîches ou citron');
    }
    if(!out.length)push(genericFinishingSuggestion(input,a));
    return out.slice(0,2);
  }
  function culinaryCombination(input){
    const a=analyzeIngredients(input),n=norm(input),rawProtein=first(a.savoryProteins);
    if(!rawProtein)return null;
    const protein=canonicalProteinLabel(rawProtein),P=cap(protein),article=withArticle(protein);
    const hasMustard=/\bmoutarde\b/.test(n),hasLemon=/\bcitron(?: jaune| vert)?\b/.test(n),hasGarlic=/\bail\b/.test(n),hasGinger=/\bgingembre\b/.test(n);
    const hasSoy=/\b(?:sauce soja|tamari)\b/.test(n),hasCurry=/\b(?:curry|colombo)\b/.test(n),hasCoconut=/\b(?:lait de coco|creme de coco)\b/.test(n);
    const hasTomato=/\btomates?\b/.test(n),hasOnion=/\boignons?\b/.test(n),hasHerbs=FOOD_RX.herb.test(n);
    const completeCook=`Fais cuire ${article} jusqu’à cuisson complète.`;
    if(hasMustard&&hasLemon){
      let missing=culinaryComplementSuggestions(input,a,{preferOnion:true});
      if(intent==='equilibre'){
        const exact=[];
        if(!hasOnion)exact.push('oignon');
        const hasBase=a.starches.some(x=>!FOOD_RX.oats.test(norm(x)))||a.pulses.length||a.flours.length;
        if(!hasBase)exact.push('riz');
        if(!a.vegetables.length)exact.push('salade ou courgette');
        missing=ensureMissingSuggestions(input,exact).slice(0,2);
      }
      const variants=[
        {title:`${P} grillé citron-moutarde & légumes`,missing:[firstAbsentSuggestion(input,['courgette ou haricots verts','salade ou courgette']),firstAbsentSuggestion(input,['riz ou pommes de terre','semoule ou riz'])].filter((x,i,r)=>x&&!suggestionCovered(input,x)&&r.indexOf(x)===i).slice(0,2),preparation:`Mélange la moutarde et le citron, enrobe ${article}, puis grille ou saisis-le. Ajoute le légume proposé à côté ou dans la poêle selon sa cuisson, et sers avec la base proposée si tu la choisis. ${completeCook}`,explanation:`Le citron et la moutarde forment déjà une marinade. Cette variante mise sur une cuisson grillée et un accompagnement végétal plutôt que sur une assiette générique. ${intentReason()}`},
        {title:`Bowl de ${protein} moutarde-citron`,missing:[firstAbsentSuggestion(input,['riz ou quinoa','semoule ou riz']),firstAbsentSuggestion(input,['concombre ou tomates','salade ou courgette'])].filter((x,i,r)=>x&&!suggestionCovered(input,x)&&r.indexOf(x)===i).slice(0,2),preparation:`Prépare ${article} avec la moutarde et le citron, puis coupe-le en morceaux. Dispose la base et les végétaux proposés dans un bol, ajoute ${article} et termine avec le jus de cuisson ou un trait de citron frais. ${completeCook}`,explanation:`La même association moutarde-citron devient ici un bowl complet, avec des éléments bien séparés et faciles à ajuster. ${intentReason()}`},
        {title:`${P} aux oignons · citron & moutarde`,missing:[firstAbsentSuggestion(input,['oignon','échalote']),firstAbsentSuggestion(input,['riz ou pommes de terre','semoule ou riz'])].filter((x,i,r)=>x&&!suggestionCovered(input,x)&&r.indexOf(x)===i).slice(0,2),preparation:`Mélange moutarde et citron, puis enrobe ${article}. Fais fondre l’oignon si tu l’ajoutes, cuis ${article} dans la même poêle et laisse les saveurs se lier quelques minutes. Sers avec la base proposée. ${completeCook}`,explanation:`Cette version exploite pleinement le duo citron-moutarde avec l’oignon, dans un esprit de sauce courte plutôt que de simple marinade. ${intentReason()}`},
        {title:`Brochettes de ${protein} citron-moutarde`,missing:[firstAbsentSuggestion(input,['poivron ou courgette','courgette ou haricots verts']),firstAbsentSuggestion(input,['semoule ou riz','riz ou pommes de terre'])].filter((x,i,r)=>x&&!suggestionCovered(input,x)&&r.indexOf(x)===i).slice(0,2),preparation:`Coupe ${article} en morceaux, enrobe-les de moutarde et de citron puis monte des brochettes, avec le légume proposé si tu l’ajoutes. Fais cuire en retournant régulièrement, puis sers avec l’accompagnement choisi. ${completeCook}`,explanation:`La marinade reste la même, mais la découpe en brochettes change réellement la forme et la cuisson de la préparation. ${intentReason()}`}
      ];
      return {kind:'mustard_lemon',title:`${P} moutarde & citron`,missing,preparation:`Mélange la moutarde et le citron pour former une marinade. Enrobe ${article}, laisse reposer quelques minutes si tu as le temps, puis saisis ou grille ${article}. ${!hasOnion&&missing.includes('oignon')?'Si tu ajoutes l’oignon, fais-le fondre dans la même poêle. ':''}${completeCook} Sers avec l’accompagnement proposé.`,explanation:`Tee reconnaît que le citron et la moutarde forment déjà une marinade cohérente avec ${article} comme base. L’app exploite donc cette combinaison au lieu de proposer une seconde protéine ou une assiette générique ; « À prévoir » sert à compléter la préparation selon ton intention.`,variants};
    }
    if(hasMustard){
      const missing=culinaryComplementSuggestions(input,a,{preferOnion:true});
      if(!hasLemon&&!suggestionCovered(input,'citron ou herbes fraîches'))missing.unshift('citron ou herbes fraîches');
      return {kind:'mustard',title:`${P} à la moutarde`,missing:[...new Set(missing)].slice(0,2),preparation:`Détends la moutarde avec un petit trait d’eau ou le complément proposé, enrobe ${article}, puis saisis ou cuis doucement jusqu’à cuisson complète. Ajoute l’accompagnement au moment adapté.`,explanation:`La moutarde est déjà un fil conducteur culinaire : Tee construit donc la préparation autour d’elle et de ${article}, plutôt que d’ajouter une autre protéine.`};
    }
    if(hasLemon&&(hasGarlic||hasHerbs)){
      const accent=hasGarlic?'ail':'herbes';
      return {kind:'lemon_aromatic',title:`${P} citron & ${accent}`,missing:culinaryComplementSuggestions(input,a),preparation:`Mélange le citron avec ${hasGarlic?'l’ail':'les herbes'}, enrobe ${article}, puis saisis ou grille jusqu’à cuisson complète. Complète avec l’accompagnement proposé.`,explanation:`Le citron et ${hasGarlic?'l’ail':'les herbes'} forment déjà un assaisonnement identifiable autour de ${article}. Tee conserve cette direction culinaire et complète seulement ce qui manque.`};
    }
    if(hasSoy&&(hasGinger||hasGarlic)){
      const accent=hasGinger?'gingembre':'ail';
      return {kind:'soy_aromatic',title:`${P} soja & ${accent}`,missing:culinaryComplementSuggestions(input,a),preparation:`Mélange la sauce soja avec ${hasGinger?'le gingembre':'l’ail'}, enrobe ${article}, puis saisis à feu vif. Ajoute les légumes au bon moment et sers avec la base proposée si nécessaire.`,explanation:`La sauce soja et ${accent} donnent déjà une direction claire à la préparation. Tee complète l’assiette sans remplacer les ingrédients que tu as.`};
    }
    if(hasCurry&&hasCoconut){
      return {kind:'curry_coconut',title:`${P} curry coco`,missing:culinaryComplementSuggestions(input,a),preparation:`Fais revenir les aromates si tu en as, ajoute le curry puis ${article}. Verse le lait ou la crème de coco et laisse mijoter doucement jusqu’à cuisson complète. Ajoute l’accompagnement proposé selon ton intention.`,explanation:`Le curry et le coco forment déjà une sauce identifiable. Tee les utilise comme base de la recette et réserve « À prévoir » aux éléments qui structurent ou complètent le repas.`};
    }
    if(hasTomato&&hasOnion){
      return {kind:'tomato_onion',title:`${P} tomate & oignon`,missing:culinaryComplementSuggestions(input,a),preparation:`Fais fondre l’oignon, ajoute la tomate puis ${article}. Laisse cuire doucement pour créer une sauce courte, puis ajoute l’accompagnement proposé si nécessaire.`,explanation:`Tomate et oignon forment déjà une base de sauce. Tee construit la préparation autour de ${article} et ne propose que les compléments encore utiles.`};
    }
    if(hasLemon){
      const missing=culinaryComplementSuggestions(input,a);
      if(!hasHerbs&&!hasGarlic)missing.unshift(firstAbsentSuggestion(input,['herbes fraîches ou citron','ail ou persil']));
      return {kind:'lemon',title:`${P} citronné`,missing:[...new Set(missing)].filter(x=>!suggestionCovered(input,x)).slice(0,2),preparation:`Assaisonne ${article} avec le citron, ajoute les aromates proposés si tu les choisis, puis saisis ou grille jusqu’à cuisson complète. Sers avec l’accompagnement proposé.`,explanation:`Le citron donne déjà une direction nette à ${article}. Tee part de cet assaisonnement et complète le repas sans inventer une autre protéine.`};
    }
    return null;
  }
  function isBatterBase(input){
    const a=analyzeIngredients(input),n=norm(input);
    return !!a.flours.length&&/\boeufs?\b/.test(n)&&FOOD_RX.sweetLiquid.test(n);
  }
  function genericFinishingSuggestion(input,a=analyzeIngredients(input)){
    const lists={
      equilibre:a.leafy.length?['tomates ou oignon rouge','herbes fraîches ou citron','graines de courge ou sésame']:['herbes fraîches ou citron','tomates ou concombre','graines de courge ou sésame'],
      digestion:['herbes fraîches ou citron','gingembre ou cumin doux','fenouil ou menthe fraîche'],
      energie:['huile d’olive ou avocat','graines de courge ou sésame','herbes fraîches ou citron'],
      construire:['graines de courge ou feta','yaourt aux herbes ou citron','herbes fraîches ou oignon rouge'],
      legerete:['citron ou herbes fraîches','concombre ou radis','menthe fraîche ou citron vert'],
      gourmandise:['feta ou parmesan','sauce au yaourt ou pesto','graines grillées ou herbes fraîches']
    };
    return firstAbsentSuggestion(input,lists[intent]||lists.equilibre);
  }
  function savoryMissingSuggestions(input){
    const a=analyzeIngredients(input),out=[];
    const hasBase=a.starches.some(x=>!FOOD_RX.oats.test(norm(x)))||a.pulses.length||a.flours.length;
    const hasProtein=a.savoryProteins.length>0;
    const hasVeg=a.vegetables.length>0;
    if(!hasProtein&&(hasBase||hasVeg))out.push(firstAbsentSuggestion(input,intent==='construire'?['poulet, œufs ou tofu','thon ou pois chiches']:['œufs, poulet ou pois chiches','thon ou tofu']));
    if(!hasVeg)out.push(firstAbsentSuggestion(input,intent==='digestion'?['courgette ou carottes','épinards ou fenouil']:intent==='legerete'?['concombre, tomates ou courgette','épinards ou salade']:['tomates, courgette ou épinards','brocoli ou poivron']));
    if(!hasBase&&hasProtein&&hasVeg&&['energie','equilibre','construire'].includes(intent))out.push(firstAbsentSuggestion(input,['riz, quinoa ou pommes de terre','pain complet ou semoule']));
    if(!out.length)out.push(genericFinishingSuggestion(input,a));
    return [...new Set(out)].slice(0,2);
  }

  function culturalNameAllowed(item,input){
    const n=norm(input),names=[item?.canonical_name,item?.display_name,...(item?.aliases||[])].map(norm).filter(x=>x.length>3);
    // Le nom culturel reste exact quand la personne l'a réellement saisi.
    if(names.some(x=>n.includes(x)||x.includes(n)&&n.length>4))return true;
    const matched=components(item,'typical_components').filter(x=>includesIngredient(input,x));
    const common=/^(riz|pates?|tomates?|oignons?|oeufs?|poulet|boeuf|agneau|poisson|legumes?|pommes? de terre|ail|salade)$/;
    const distinctive=matched.some(x=>!common.test(norm(x)));
    // Une inférence culturelle exige plusieurs marqueurs, dont un réellement distinctif.
    return matched.length>=3&&distinctive;
  }
  function sweetShape(input){
    const a=analyzeIngredients(input),n=norm(input);
    const savoryStarches=a.starches.filter(x=>!FOOD_RX.oats.test(norm(x)));
    const hasSavoryAnchor=savoryStarches.length||a.savoryProteins.length||a.vegetables.length;
    if(hasSavoryAnchor)return '';
    if(a.chia.length&&a.sweetLiquids.length)return 'pudding';
    if(a.fruits.length&&a.sweetLiquids.length)return 'smoothie';
    if(a.fruits.length&&a.yogurts.length)return 'verrine';
    return '';
  }
  function detectedSweetParts(input){
    const a=analyzeIngredients(input);
    const used=new Set([...a.fruits,...a.yogurts,...a.sweetLiquids].map(norm));
    const extras=a.raw.filter(x=>!used.has(norm(x))&&!FOOD_RX.savoryProtein.test(norm(x))&&!FOOD_RX.vegetable.test(norm(x))&&(!FOOD_RX.starch.test(norm(x))||FOOD_RX.oats.test(norm(x))));
    return {fruits:a.fruits,yogurt:first(a.yogurts),liquid:first(a.sweetLiquids),extras};
  }
  function sweetSuggestedExtra(input,shape){
    const n=norm(input),sweet=detectedSweetParts(input),hasYogurt=!!sweet.yogurt;
    const hasNuts=/amande|noix|noisette|pistache|graine|chia|chanvre|lin|puree d amande/.test(n);
    if(intent==='energie'){
      if(!/banane|avoine/.test(n))return 'banane ou flocons d’avoine';
      if(!/puree d amande|chanvre/.test(n))return 'purée d’amandes ou graines de chanvre';
      return 'cannelle ou cacao non sucré';
    }
    if(intent==='construire'){
      if(!hasYogurt)return 'yaourt grec ou alternative soja';
      if(!hasNuts)return 'purée d’amandes ou graines de chanvre';
      if(!/chia/.test(n))return 'graines de chia';
      return 'flocons d’avoine';
    }
    if(intent==='gourmandise'){
      if(!/vanille|coco rape|copeaux de coco/.test(n))return 'vanille ou copeaux de coco';
      if(!/cacao/.test(n))return 'cacao non sucré ou cannelle';
      return 'amandes effilées';
    }
    if(intent==='digestion'){
      if(!/gingembre|menthe/.test(n))return 'menthe fraîche ou gingembre';
      if(!/cannelle|cardamome/.test(n))return 'cannelle ou cardamome';
      return 'zeste de citron';
    }
    if(intent==='legerete'){
      if(!/menthe|citron vert|citron/.test(n))return 'menthe fraîche ou citron vert';
      if(!/gingembre/.test(n))return 'gingembre frais';
      return 'quelques glaçons';
    }
    if(shape==='smoothie'&&!hasYogurt)return 'yaourt grec ou alternative soja';
    if(!hasNuts)return shape==='verrine'?'quelques amandes concassées, facultatives':'graines de chia ou amandes concassées';
    if(!/cannelle|vanille/.test(n))return 'cannelle ou vanille';
    return 'zeste de citron';
  }
  const titleFruit=value=>({fraise:'fraises',framboise:'framboises',myrtille:'myrtilles',mure:'mûres',cassis:'cassis',banane:'banane',mangue:'mangue',poire:'poire',pomme:'pomme',peche:'pêche',ananas:'ananas'}[norm(value)]||String(value||'').toLocaleLowerCase('fr'));
  function neutralTitle(input,item){
    const a=analyzeIngredients(input),n=norm(input);
    const shape=sweetShape(input),sweet=detectedSweetParts(input),fruitLabel=frenchList(sweet.fruits.map(titleFruit));
    if(shape==='smoothie')return `Smoothie ${fruitLabel||'aux fruits'}${sweet.liquid?` au ${lower(sweet.liquid)}`:''}`;
    if(shape==='verrine')return `Verrine de ${lower(sweet.yogurt)||'yaourt'}${fruitLabel?` aux ${fruitLabel}`:' aux fruits'}`;
    if(shape==='pudding')return `Pudding ${sweet.liquid?`au ${lower(sweet.liquid)}`:'aux graines de chia'}${fruitLabel?` · ${fruitLabel}`:''}`;
    if(isBatterBase(input))return a.buckwheat.length?'Galettes de sarrasin maison':'Crêpes maison';
    const starch=first(a.starches),rawProtein=first(a.savoryProteins),protein=rawProtein?canonicalProteinLabel(rawProtein):'',veg=first(a.vegetables),leaf=first(a.leafy),freshLeaf=first(a.freshLeafy);
    const displayVeg=freshLeaf?freshLeafTitle(freshLeaf):veg;
    const extras=titleJoin([protein,displayVeg]);
    if(starch&&/\briz\b/.test(norm(starch)))return extras?`Bowl de riz · ${extras}`:'Riz composé avec tes ingrédients';
    if(starch&&/nouille|vermicelle|udon|soba/.test(norm(starch)))return extras?`Nouilles composées · ${extras}`:'Nouilles composées avec tes ingrédients';
    if(starch&&/pate|spaghetti|tagliatelle|penne|macaroni/.test(norm(starch))){
      if(protein&&freshLeaf)return `Pâtes ${withA(protein)} & ${freshLeafTitle(freshLeaf)}`;
      return extras?`Pâtes composées · ${extras}`:'Pâtes composées avec tes ingrédients';
    }
    if(starch&&/semoule|couscous|boulgour|quinoa/.test(norm(starch)))return extras?`${/quinoa/.test(norm(starch))?'Bowl de quinoa':'Semoule composée'} · ${extras}`:`${lower(starch)} composé avec tes ingrédients`;
    if(starch&&/pommes? de terre|patates? douces?|gnocchi/.test(norm(starch)))return extras?`Poêlée de ${lower(starch)} · ${extras}`:`${lower(starch)} composées`;
    if(starch&&/wrap|tortilla|galette/.test(norm(starch)))return `Wrap garni${extras?` · ${extras}`:''}`;
    if(starch&&/pain|baguette/.test(norm(starch)))return `Tartine composée${extras?` · ${extras}`:''}`;
    if(starch&&a.fishes.length&&/manioc|igname|plantain|fonio|millet|\bmil\b|attieke/.test(norm(starch)))return `${cap(protein)} & ${lower(starch)}${veg?` · ${lower(veg)}`:''}`;
    if(starch)return `Assiette de ${lower(starch)}${extras?` · ${extras}`:''}`;
    if(protein&&/\boeufs?\b/.test(norm(protein))&&veg)return `Omelette · ${titleJoin(a.vegetables.slice(0,2))}`;
    if(a.pulses.length&&veg)return `Bowl de ${lower(first(a.pulses))} · ${titleJoin(a.vegetables.slice(0,2))}`;
    if(protein&&leaf)return `Salade composée · ${titleJoin([protein,leaf])}`;
    if(protein&&veg)return `Assiette composée · ${titleJoin([protein,veg])}`;
    if(protein)return `Assiette autour de ${lower(protein)}`;
    if(veg)return `Assiette végétale · ${titleJoin(a.vegetables.slice(0,2))}`;
    const meaningful=a.raw.filter(x=>norm(x).length>2).slice(0,3);
    return meaningful.length?`Assiette de ${titleJoin(meaningful)}`:(item?.display_name||item?.canonical_name||'Une assiette à composer');
  }
  function suggestionTitle(item,input){return culturalNameAllowed(item,input)?title(item):neutralTitle(input,item);}

  function isDish(item){
    const cats=categories(item),fam=family(item),known=components(item,'typical_components').length;
    return known>=2&&(cats.includes('composite dish')||cats.includes('composite_dish')||fam!=='general'||known>=3);
  }
  function score(item,input){
    const cats=categories(item),fam=family(item),typ=components(item,'typical_components'),opt=components(item,'optional_components');
    const searchable=[title(item),...(item.aliases||[]),...typ,...opt].join(' ');
    const tokens=inputIngredients(input).flatMap(words).filter(Boolean);
    const overlap=tokens.filter((w,i)=>tokens.indexOf(w)===i&&includesIngredient(searchable,w)).length;
    let s=overlap*22+Math.min(8,typ.length*2)+Math.max(0,8-Number(item.priority||8));
    const shape=sweetShape(input),kind=norm(item?.adapter_profile?.preparation_kind);
    if(shape)s+=(kind===shape?55:0)+(['sweet_bowl','sweet_dish'].includes(fam)?24:-24);
    const n=nutrition(item),fried=/fried|frit/.test(fam+' '+cats.join(' ')),rich=/rich|burger|sweet/.test(fam+' '+cats.join(' '));
    if(intent==='equilibre')s+=(cats.some(c=>/protein/.test(c))?7:0)+(cats.some(c=>/vegetable/.test(c))?7:0)+(fam==='complete_composite'?10:0);
    if(intent==='digestion')s+=(fam==='soup'?15:0)+(cats.some(c=>/vegetable/.test(c))?8:0)+(Number(n.fiber_100g)>=2.5?5:0)-(fried?18:0)-(rich?8:0);
    if(intent==='energie')s+=(cats.some(c=>/starch/.test(c))?12:0)+(Number(n.carbs_100g)>=15?7:0)+(fam==='complete_composite'?6:0);
    if(intent==='construire')s+=(cats.some(c=>/protein/.test(c))?14:0)+(Number(n.protein_100g)>=8?10:0)+(fam==='protein_main'?8:0);
    if(intent==='legerete')s+=(cats.some(c=>/vegetable/.test(c))?13:0)+(fam==='soup'?10:0)+(Number(n.fiber_100g)>=2.5?7:0)-(fried?22:0)-(rich?12:0);
    if(intent==='gourmandise')s+=(/filled_dough|burger|sweet|sauce_dish/.test(fam)?14:0)+overlap*4;
    if(fam==='variable_composite'&&typ.length<3)s-=12;
    if(!overlap)s-=16;
    return {item,score:s,overlap};
  }
  function explanation(item,owned,name){
    const shape=sweetShape(lastIngredients),a=analyzeIngredients(lastIngredients);
    if(shape==='smoothie'){
      const sweet=detectedSweetParts(lastIngredients),liquid=lower(sweet.liquid)||'liquide choisi',yogurt=lower(sweet.yogurt);
      if(yogurt)return `Les fruits apportent la base fruitée, tandis que le ${yogurt} donne de l’onctuosité et une composante protéinée${sweet.liquid?` ; le ${liquid} ajuste la texture`:''}. Tee ajoute seulement le complément cohérent avec ton intention.`;
      if(['equilibre','construire'].includes(intent))return `Les fruits apportent la base fruitée et le ${liquid} donne la texture du smoothie. Comme aucune base protéinée n’est présente, Tee propose un complément de ce type pour rendre la préparation plus cohérente avec ton intention.`;
      return `Les fruits apportent la base fruitée et le ${liquid} donne la texture du smoothie. L’ajout proposé sert uniquement à orienter la préparation vers ton intention.`;
    }
    if(shape==='verrine')return `Le ${lower(first(a.yogurts))||'yaourt'} apporte la base crémeuse et protéinée, tandis que les fruits complètent la verrine. Tee propose seulement une finition cohérente avec ton intention.`;
    if(shape==='pudding')return `Les graines de chia et le ${lower(first(a.sweetLiquids))||'liquide choisi'} structurent déjà le pudding. Les fruits et la finition proposée permettent de varier le résultat sans ajouter d’ingrédient salé.`;
    if(isBatterBase(lastIngredients))return `La farine, les œufs et le lait forment déjà une pâte complète. Tee utilise cette base telle quelle et réserve « À prévoir » à une garniture ou une finition adaptée à ton intention.`;
    const observed=[];
    const starch=first(a.starches),protein=first(a.savoryProteins),veg=first(a.vegetables);
    if(starch)observed.push(`une base énergétique (${lower(starch)})`);
    if(protein)observed.push(`une source protéinée (${lower(protein)})`);
    if(veg)observed.push(`une partie végétale (${lower(veg)})`);
    let intro=observed.length?`Tee reconnaît déjà ${frenchList(observed)} dans tes ingrédients.`:`Tee part uniquement des ingrédients que tu as renseignés pour construire cette proposition.`;
    if(starch&&protein&&veg)intro+=` Le repas est déjà structuré : « À prévoir » sert donc de finition, pas à remplacer un élément que tu possèdes déjà.`;
    const reasons={equilibre:'La suggestion conserve cet équilibre et n’ajoute qu’un complément utile.',digestion:'La préparation reste simple et privilégie un ajout facile à ajuster selon ton confort.',energie:'Tee garde la base énergétique identifiable et évite les ajouts inutiles.',construire:'La source protéinée reste au centre de l’assiette et l’ajout proposé complète sans la masquer.',legerete:'Tee garde une construction simple et donne de la place aux végétaux déjà présents.',gourmandise:'La proposition conserve les ingrédients de départ et joue surtout sur la finition et la texture.'};
    return `${intro} ${reasons[intent]}`;
  }
  function preparation(item,owned,missing){
    const a=analyzeIngredients(lastIngredients),shape=sweetShape(lastIngredients),sweet=detectedSweetParts(lastIngredients),extra=missing[0]?addableLabel(missing[0]):'';
    if(shape==='smoothie')return `Mixe ${frenchList([...sweet.fruits,sweet.liquid,sweet.yogurt,...(sweet.extras||[])].filter(Boolean).map(withArticle))} jusqu’à obtenir une texture homogène${extra?`, puis ajoute ${extra}`:''}. Ajuste seulement la quantité de liquide selon la texture souhaitée.`;
    if(shape==='verrine')return `Dépose ${sweet.yogurt?withArticle(sweet.yogurt):'le yaourt'} dans un verre, ajoute ${frenchList(sweet.fruits.map(withArticle))||'les fruits'}${sweet.extras?.length?`, puis ${frenchList(sweet.extras.map(withArticle))}`:''}, puis termine${extra?` avec ${extra}`:' avec la finition de ton choix'}.`;
    if(shape==='pudding'){const other=(sweet.extras||[]).filter(x=>!FOOD_RX.chia.test(norm(x)));return `Mélange ${first(a.sweetLiquids)?withArticle(first(a.sweetLiquids)):'le liquide choisi'} avec les graines de chia, laisse épaissir au frais, puis ajoute ${frenchList(sweet.fruits.map(withArticle))||'les fruits'}${other.length?` et ${frenchList(other.map(withArticle))}`:''}${extra?`. Termine avec ${extra}`:''}.`;}
    if(isBatterBase(lastIngredients)){
      const flour=lower(first(a.flours))||'la farine',milk=lower(first(a.sweetLiquids))||'le lait';
      return `Mélange ${flour} avec les œufs, verse progressivement ${milk}, puis incorpore le beurre fondu si tu l’as prévu. Laisse reposer quelques minutes et cuis en galettes ou crêpes fines. Termine avec ${extra||'une garniture adaptée à ton envie'}.`;
    }
    const starch=first(a.starches),rawProtein=first(a.savoryProteins),protein=rawProtein?canonicalProteinLabel(rawProtein):'',veg=first(a.vegetables),leaf=first(a.leafy),freshLeaf=first(a.freshLeafy);
    if(starch&&/\briz\b/.test(norm(starch))){
      if(leaf)return `Fais cuire ou réchauffe le riz. Fais dorer ${protein?withArticle(protein):'la partie protéinée'} à part. Garde ${leaf?withArticle(leaf):'la garniture fraîche'} fraîche, puis assemble le tout dans un bol${extra?` et termine avec ${extra}`:''}.`;
      return `Fais cuire ou réchauffe le riz. Prépare ${titleJoin([protein,veg])||'les autres ingrédients'} selon leur temps de cuisson, réunis-les avec le riz puis assaisonne${extra?` avec ${extra}`:''}.`;
    }
    if(starch&&/nouille|vermicelle|udon|soba/.test(norm(starch))){
      if(freshLeaf)return `Fais cuire les nouilles et prépare ${protein?withArticle(protein):'la partie protéinée'} à part. Réunis les éléments chauds, puis ajoute ${withArticle(freshLeaf)} seulement hors du feu ou au moment de servir pour qu’elle reste fraîche${extra?`. Termine avec ${extra}`:''}.`;
      return `Fais cuire les nouilles. Prépare ${protein?withArticle(protein):'la partie protéinée'} et ${veg?withArticle(veg):'les autres ingrédients'} à part, ajoute les nouilles puis termine avec ${extra||'un assaisonnement simple'}.`;
    }
    if(starch&&/pate|spaghetti|tagliatelle|penne|macaroni/.test(norm(starch))){
      if(freshLeaf)return `Fais cuire les pâtes et fais dorer ${protein?withArticle(protein):'la partie protéinée'} à part. Égoutte les pâtes et laisse-les tiédir quelques minutes si tu veux les mélanger aux feuilles. Ajoute ${withArticle(freshLeaf)} seulement au moment de servir pour conserver toute la fraîcheur et le croquant${extra?`, puis termine avec ${extra}`:''}.`;
      return `Fais cuire les pâtes. Prépare ${protein?withArticle(protein):'la partie protéinée'} et ${veg?withArticle(veg):'les autres ingrédients'} à part, ajoute les pâtes puis mélange quelques minutes${extra?`. Termine avec ${extra}`:''}.`;
    }
    if(starch&&/semoule|couscous|quinoa|boulgour/.test(norm(starch)))return `Prépare ${lower(starch)}, cuis ${lower(protein)||'la partie protéinée'} si nécessaire et garde ${lower(leaf||veg)||'les végétaux'} à la texture qui leur convient. Assemble puis termine${extra?` avec ${extra}`:' simplement'}.`;
    if(starch&&/pommes? de terre|patates? douces?|gnocchi/.test(norm(starch))){
      if(freshLeaf)return `Fais dorer ${lower(starch)} avec ${lower(protein)||'les ingrédients qui demandent une cuisson'}. Garde ${withArticle(freshLeaf)} crue et ajoute-la seulement au moment de servir${extra?`, puis termine avec ${extra}`:''}.`;
      return `Fais dorer ${lower(starch)} avec ${lower(protein)||'les ingrédients qui demandent une cuisson'}, ajoute ${lower(veg)||'les végétaux'} au bon moment puis termine${extra?` avec ${extra}`:' avec un assaisonnement simple'}.`;
    }
    if(starch&&/manioc|igname|plantain|fonio|millet|\bmil\b|attieke/.test(norm(starch))){
      return `Prépare ${withArticle(starch)} selon la cuisson qui lui convient. ${protein?`Cuis ${withArticle(protein)} à part en respectant sa texture.`:'Prépare la partie protéinée à part.'} ${freshLeaf?`Garde ${withArticle(freshLeaf)} fraîche et ajoute-la seulement au moment de servir.`:veg?`Prépare ${withArticle(veg)} sans la surcuire puis assemble l’ensemble.`:'Ajoute les végétaux au moment adapté.'}${extra?` Termine avec ${extra}.`:''}`;
    }
    if(starch&&/wrap|tortilla|galette/.test(norm(starch)))return `Réchauffe légèrement ${lower(starch)}, ajoute ${titleJoin([protein,veg])||'tes garnitures'} puis termine avec ${extra||'un assaisonnement simple'} avant de rouler.`;
    if(starch&&/pain|baguette/.test(norm(starch)))return `Toaste légèrement ${withArticle(starch)}, dispose ${titleJoin([protein,veg])||'tes ingrédients'} dessus et termine avec ${extra||'une finition simple'}.`;
    if(protein&&leaf)return `Prépare ${withArticle(protein)} selon la cuisson adaptée, garde ${withArticle(leaf)} fraîche puis assemble en salade composée${extra?` avec ${extra}`:''}.`;
    if(/\boeufs?\b/.test(norm(lastIngredients)))return `Prépare les œufs selon la forme choisie, ajoute les autres ingrédients au bon moment puis termine avec ${extra||'des herbes ou un assaisonnement simple'}.`;
    const have=a.raw.length?`Pars de ${titleJoin(a.raw.slice(0,4))}.`:'Pars de tes ingrédients disponibles.';
    return `${have}${extra?` Complète avec ${extra}.`:''} Prépare chaque composant selon son besoin puis assemble et assaisonne au dernier moment.`;
  }
  const intentReason=()=>({
    equilibre:'Cette forme garde des repères simples et transforme les mêmes ingrédients sans charger inutilement la préparation.',
    digestion:'Cette version reste simple à ajuster et limite les ajouts superflus pour conserver une préparation lisible.',
    energie:'Cette version conserve une base énergétique claire et propose seulement l’ajout utile à la texture ou à la tenue.',
    construire:'Cette version veille à garder ou à compléter clairement la composante protéinée selon les ingrédients disponibles.',
    legerete:'Cette version mise sur une préparation plus fraîche ou plus légère, avec peu d’ajouts.',
    gourmandise:'Cette version change surtout la texture et la présentation pour créer une vraie alternative gourmande.'
  }[intent]||'Tee transforme les mêmes ingrédients en une préparation réellement différente.');
  function sweetAlternative(input,index){
    if(index<=0)return null;
    const sweet=detectedSweetParts(input),shape=sweetShape(input);
    if(!sweet.fruits.length)return null;
    const fruits=frenchList(sweet.fruits.map(titleFruit))||'fruits rouges';
    const yogurt=lower(sweet.yogurt),liquid=lower(sweet.liquid);
    if(yogurt){
      const variants=[
        {key:'frozen',title:`Frozen yogurt ${fruits}`,missing:[firstAbsentSuggestion(input,['vanille ou copeaux de coco','amandes effilées','cacao non sucré ou cannelle'])],preparation:`Écrase légèrement ${fruits}, mélange-les avec ${yogurt}, dépose la préparation dans un petit contenant puis place au congélateur jusqu’à obtenir une texture glacée mais encore crémeuse.`,explanation:`Le ${yogurt} reste la base crémeuse et protéinée, mais le passage au froid transforme complètement la texture. ${intentReason()}`},
        {key:'bowl',title:`Bowl crémeux ${fruits} & croquant`,missing:[firstAbsentSuggestion(input,['granola ou amandes concassées','graines de chia','copeaux de coco'])],preparation:`Verse ${yogurt} dans un bol, ajoute ${fruits}, puis termine avec la finition proposée. Garde les fruits entiers pour obtenir une vraie texture de bowl plutôt qu’une verrine.`,explanation:`Les mêmes ingrédients deviennent ici un bowl à manger à la cuillère, avec un contraste crémeux, fruité et croquant. ${intentReason()}`},
        {key:'smoothie',title:`Smoothie protéiné ${fruits}`,missing:[firstAbsentSuggestion(input,['lait ou boisson végétale','quelques glaçons','cannelle ou vanille'])],preparation:`Mixe ${yogurt} avec ${fruits} et un petit trait de liquide. Ajoute-le progressivement pour garder une texture épaisse et crémeuse.`,explanation:`Le mixage change la préparation en boisson épaisse tout en conservant la base protéinée du ${yogurt} et les fruits. ${intentReason()}`},
        {key:'bark',title:`Bark glacé au ${yogurt} & ${fruits}`,missing:[firstAbsentSuggestion(input,['copeaux de coco ou amandes','pistaches concassées','cacao non sucré'])],preparation:`Étale ${yogurt} en couche fine, répartis ${fruits} dessus, ajoute la finition proposée puis congèle. Casse ensuite la plaque en éclats.`,explanation:`La congélation en couche fine crée un dessert à casser et à grignoter, très différent d’une verrine. ${intentReason()}`}
      ];
      return variants[(index-1)%variants.length];
    }
    if(liquid){
      let variants=[
        {key:'chia-pudding',title:`Pudding de chia au ${liquid} · ${fruits}`,missing:[firstAbsentSuggestion(input,['graines de chia','vanille ou cannelle','amandes effilées'])],preparation:`Mélange le ${liquid} avec des graines de chia, laisse épaissir au frais, puis ajoute ${fruits} au moment de servir.`,explanation:`Au lieu de mixer les fruits, Tee transforme la même base liquide en dessert à la cuillère grâce aux graines de chia. ${intentReason()}`},
        {key:'smoothie-bowl',title:`Smoothie bowl ${fruits} au ${liquid}`,missing:[firstAbsentSuggestion(input,['banane ou flocons d’avoine','graines de chia','purée d’amandes'])],preparation:`Mixe ${fruits} avec juste assez de ${liquid} et la finition proposée pour obtenir une texture très épaisse. Verse dans un bol et garde une partie des fruits en garniture.`,explanation:`La texture devient beaucoup plus épaisse qu’un smoothie à boire : la préparation se mange à la cuillère. ${intentReason()}`},
        {key:'overnight',title:`Overnight oats ${fruits} au ${liquid}`,missing:[firstAbsentSuggestion(input,['flocons d’avoine','graines de chia','cannelle ou vanille'])],preparation:`Mélange des flocons d’avoine avec le ${liquid}, laisse reposer au frais plusieurs heures puis ajoute ${fruits} au moment de servir.`,explanation:`Les mêmes fruits et le ${liquid} deviennent ici un petit-déjeuner ou dessert à la cuillère, avec une texture complètement différente du smoothie. ${intentReason()}`},
        {key:'pops',title:`Esquimaux ${fruits} au ${liquid}`,missing:[firstAbsentSuggestion(input,['vanille ou copeaux de coco','cacao non sucré','amandes concassées'])],preparation:`Mixe rapidement ${fruits} avec le ${liquid}, ajoute la finition proposée, verse dans de petits moules puis congèle jusqu’à prise complète.`,explanation:`Le passage au congélateur transforme le mélange en bouchée glacée individuelle plutôt qu’en boisson. ${intentReason()}`},
        {key:'ice-cream',title:`Crème glacée minute ${fruits}`,missing:[firstAbsentSuggestion(input,['banane congelée','yaourt grec ou alternative soja','vanille ou cannelle'])],preparation:`Mixe ${fruits} bien froids avec juste assez de ${liquid} et la finition proposée pour obtenir une texture très épaisse, puis sers immédiatement ou place quelques minutes au congélateur.`,explanation:`La quantité réduite de liquide transforme la base en texture glacée à la cuillère plutôt qu’en boisson. ${intentReason()}`}
      ];
      if(shape==='pudding')variants=variants.filter(v=>v.key!=='chia-pudding');
      return variants[(index-1)%variants.length];
    }
    return null;
  }
  function savoryAlternative(input,index){
    if(index<=0)return null;
    const combination=culinaryCombination(input);
    if(combination?.variants?.length)return combination.variants[(index-1)%combination.variants.length];
    const a=analyzeIngredients(input),main=titleJoin(a.raw.slice(0,4))||'tes ingrédients';
    const starch=first(a.starches),rawProtein=first(a.savoryProteins),protein=rawProtein?canonicalProteinLabel(rawProtein):'',veg=first(a.vegetables),leaf=first(a.leafy),freshLeaf=first(a.freshLeafy),cupLeaf=first(a.cupLeaf);
    const displayVeg=freshLeaf?freshLeafTitle(freshLeaf):veg;
    const p=lower(protein)||lower(displayVeg)||'tes ingrédients',v=lower(displayVeg)||'tes végétaux';
    const miss=(rows)=>[firstAbsentSuggestion(input,rows)];
    let variants=[];
    if(isBatterBase(input)){
      variants=[
        {title:a.buckwheat.length?'Crêpes fines de sarrasin':'Crêpes fines maison',missing:miss(intent==='gourmandise'?['vanille ou cannelle','fruits frais ou cacao non sucré']:['épinards ou champignons','tomates ou herbes fraîches']),preparation:`Prépare la pâte avec la farine, les œufs et le lait, puis cuis-la en crêpes fines. Utilise la finition proposée en garniture ou en accompagnement.`,explanation:`La même pâte devient une crêpe fine et souple. ${intentReason()}`},
        {title:a.buckwheat.length?'Pancakes de sarrasin':'Pancakes maison',missing:miss(intent==='gourmandise'?['banane ou fruits rouges','cannelle ou vanille']:['yaourt grec ou fromage blanc','fruits frais ou graines']),preparation:`Garde la même base mais cuis de petites portions plus épaisses à feu doux pour obtenir des pancakes.`,explanation:`La cuisson en petites portions change l’épaisseur et la texture sans changer la base de pâte. ${intentReason()}`},
        {title:a.buckwheat.length?'Blinis de sarrasin':'Mini blinis maison',missing:miss(['herbes fraîches ou yaourt','saumon fumé ou concombre']),preparation:`Dépose de petites cuillerées de pâte dans la poêle et cuis-les des deux côtés. Sers-les en petites bouchées avec la finition proposée.`,explanation:`Les mêmes ingrédients deviennent de petites bouchées à garnir. ${intentReason()}`},
        {title:a.buckwheat.length?'Galette de sarrasin roulée':'Crêpe roulée garnie',missing:miss(['épinards ou champignons','feta ou fromage râpé','herbes fraîches']),preparation:`Cuis une grande galette fine, ajoute la garniture proposée au centre puis replie ou roule avant de servir.`,explanation:`Le roulage transforme la pâte en plat garni plutôt qu’en simple crêpe. ${intentReason()}`}
      ];
    }else if(starch&&/\briz\b/.test(norm(starch))){
      variants=[
        {title:`Riz sauté · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['ail ou gingembre','oignon ou sauce soja','herbes fraîches']),preparation:leaf?`Fais dorer ${p}, ajoute le riz déjà cuit et saute l’ensemble quelques minutes. Garde ${lower(leaf)} hors du feu et ajoute-la au moment de servir pour qu’elle reste fraîche.`:`Fais revenir ${titleJoin([protein,veg])||'les garnitures'}, ajoute le riz déjà cuit puis saute l’ensemble quelques minutes.`,explanation:`Le riz sauté transforme les mêmes éléments en préparation chaude tout en respectant la texture des végétaux frais. ${intentReason()}`},
        {title:`Salade de riz · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['citron ou vinaigre doux','herbes fraîches ou oignon rouge']),preparation:`Laisse le riz refroidir, cuis ${p} si nécessaire, puis ajoute ${v} et les autres ingrédients. Assaisonne avec la finition proposée.`,explanation:`Cette version froide change complètement le rendu tout en conservant la même base. ${intentReason()}`},
        cupLeaf?{title:`Cups de ${lower(cupLeaf)} · riz & ${p}`,missing:miss(['oignon rouge ou herbes fraîches','tomates ou concombre','sauce au yaourt ou citron']),preparation:`Utilise les grandes feuilles de ${lower(cupLeaf)} comme petites coupelles. Garnis-les de riz et de ${p}, puis ajoute la finition proposée.`,explanation:`La laitue devient ici le contenant du plat : la forme est réellement différente d’un bowl. ${intentReason()}`}:{title:`Bowl chaud-froid de riz · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['sauce au yaourt ou citron','herbes fraîches ou graines de sésame']),preparation:`Garde le riz et ${p} tièdes, ajoute ${v} à la texture qui lui convient puis assemble en contrastant chaud et frais.`,explanation:`Le contraste de températures donne une autre expérience avec les mêmes ingrédients. ${intentReason()}`},
        {title:`Riz façon pilaf · ${p}`,missing:miss(['oignon ou épices douces','herbes fraîches ou citron']),preparation:`Fais revenir un aromate, ajoute le riz puis cuis-le ou réchauffe-le doucement avec ${p}. Sers ${v} à côté ou au dernier moment si elle doit rester fraîche.`,explanation:`La cuisson façon pilaf parfume davantage le riz tout en gardant les ingrédients reconnaissables. ${intentReason()}`}
      ];
    }else if(starch&&/nouille|vermicelle|udon|soba/.test(norm(starch))){
      variants=[
        {title:`Nouilles sautées · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['ail ou gingembre','sauce soja ou citron vert']),preparation:freshLeaf?`Fais revenir ${protein?withArticle(protein):'la partie protéinée'}, ajoute les nouilles puis retire du feu. Ajoute ${withArticle(freshLeaf)} seulement au moment de servir pour garder les feuilles fraîches.`:`Fais revenir ${p} et les légumes qui supportent la cuisson, ajoute les nouilles puis termine avec les éléments frais hors du feu.`,explanation:`Le wok donne une version chaude et rapide adaptée à cette base. ${intentReason()}`},
        {title:`Bouillon de nouilles · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['bouillon ou miso','gingembre ou herbes fraîches']),preparation:freshLeaf?`Prépare un bouillon léger, cuis les nouilles et ${protein?withArticle(protein):'la partie protéinée'} dans le bouillon selon leur besoin. Ajoute ${withArticle(freshLeaf)} seulement dans le bol au moment de servir, sans la faire bouillir.`:`Prépare un bouillon léger, ajoute les nouilles puis ${p} et ${v} selon leur temps de cuisson.`,explanation:`La même base devient un plat en bouillon plutôt qu’une poêlée. ${intentReason()}`},
        {title:`Salade de nouilles fraîche · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['citron vert ou vinaigre de riz','herbes fraîches ou sésame']),preparation:freshLeaf?`Rafraîchis les nouilles après cuisson, ajoute ${protein?withArticle(protein):'la partie protéinée'} puis ${withArticle(freshLeaf)} au dernier moment. Assaisonne avec la finition proposée.`:`Rafraîchis les nouilles après cuisson, ajoute ${p} et ${v}, puis assaisonne avec la finition proposée.`,explanation:`Cette version froide change nettement la texture et le service. ${intentReason()}`},
        {title:`Bowl de nouilles · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['sésame ou herbes fraîches','sauce légère ou citron vert']),preparation:freshLeaf?`Dispose les nouilles en base, ajoute ${protein?withArticle(protein):'la partie protéinée'} puis ${withArticle(freshLeaf)} fraîche au moment de servir. Termine avec la finition proposée.`:`Dispose les nouilles en base, ajoute ${p} et ${v} en garnitures puis termine avec la finition proposée.`,explanation:`Le bowl garde les composants séparés et permet une autre expérience avec les mêmes ingrédients. ${intentReason()}`}
      ];
    }else if(starch&&/pate|spaghetti|tagliatelle|penne|macaroni/.test(norm(starch))){
      variants=[
        {title:`Salade de pâtes · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['citron ou vinaigre doux','herbes fraîches ou oignon rouge']),preparation:freshLeaf?`Laisse refroidir les pâtes, prépare ${protein?withArticle(protein):'la partie protéinée'} si nécessaire puis ajoute ${withArticle(freshLeaf)} au dernier moment. Mélange avec la finition proposée.`:`Laisse refroidir les pâtes, prépare ${protein?withArticle(protein):'la partie protéinée'} si nécessaire puis ajoute ${veg?withArticle(veg):'les végétaux'}. Mélange avec la finition proposée.`,explanation:`Au lieu d’une préparation chaude, Tee transforme la base en salade composée. ${intentReason()}`},
        {title:`Poêlée de pâtes · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['ail ou herbes fraîches','tomates ou pesto']),preparation:freshLeaf?`Fais revenir ${protein?withArticle(protein):'la partie protéinée'}, ajoute les pâtes puis retire du feu. Ajoute ${withArticle(freshLeaf)} seulement au service pour la garder fraîche.`:`Fais revenir ${p} et les éléments qui supportent la cuisson, ajoute les pâtes puis termine avec les éléments frais hors du feu.`,explanation:`La poêle donne une texture et une organisation différentes avec les mêmes ingrédients. ${intentReason()}`},
        {title:`Pâtes gratinées · ${p}`,missing:miss(['parmesan ou chapelure','mozzarella ou herbes']),preparation:`Réunis les pâtes et les ingrédients cuits dans un petit plat, ajoute la finition proposée puis gratine quelques minutes.${freshLeaf?` Sers ${withArticle(freshLeaf)} à côté, sans cuisson, ou ajoute les feuilles après cuisson.`:''}`,explanation:`Le passage au four crée une version fondante et gratinée sans cuire inutilement les végétaux fragiles. ${intentReason()}`},
        {title:`Pâtes façon bowl · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['sauce au yaourt ou pesto','herbes fraîches ou citron']),preparation:freshLeaf?`Dispose les pâtes en base, ajoute ${protein?withArticle(protein):'la partie protéinée'} puis ${withArticle(freshLeaf)} fraîche au dernier moment. Termine avec la finition proposée.`:`Dispose les pâtes en base, ajoute ${p} puis ${v} en garniture et termine avec la finition proposée.`,explanation:`Le bowl garde chaque composant identifiable et change surtout l’assemblage. ${intentReason()}`}
      ];
    }else if(starch&&/semoule|couscous|quinoa|boulgour/.test(norm(starch))){
      variants=[
        {title:`Taboulé express · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['citron et herbes fraîches','concombre ou tomates']),preparation:`Laisse ${lower(starch)} refroidir, ajoute les ingrédients coupés finement et termine avec la finition proposée.`,explanation:`La base devient une préparation froide et fraîche, très différente d’une assiette chaude. ${intentReason()}`},
        {title:/quinoa/.test(norm(starch))?`Salade tiède de quinoa · ${titleJoin([protein,displayVeg])||main}`:`Bowl de ${lower(starch)} · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['sauce au yaourt ou citron','herbes fraîches']),preparation:/quinoa/.test(norm(starch))?`Garde le quinoa tiède, ajoute ${p} et ${v} puis termine avec la finition proposée.`:`Dispose ${lower(starch)} en base, ajoute ${p} et ${v} en garnitures puis termine avec la finition proposée.`,explanation:`L’assemblage change tout en gardant les mêmes ingrédients identifiables. ${intentReason()}`},
        {title:`Poêlée de ${lower(starch)} · ${p}`,missing:miss(['épices douces ou herbes','ail ou gingembre']),preparation:`Fais revenir ${p}, ajoute ${lower(starch)} déjà préparé puis les légumes qui supportent la cuisson. Garde les feuilles fraîches pour la fin.`,explanation:`Le passage à la poêle donne une version chaude et légèrement toastée. ${intentReason()}`},
        {title:`Assiette chaude-froide · ${lower(starch)} & ${p}`,missing:miss(['citron ou herbes fraîches','graines de sésame ou courge']),preparation:`Sers ${lower(starch)} et ${p} tièdes, ajoute ${v} fraîche ou juste cuite puis termine avec la finition proposée.`,explanation:`Le contraste chaud-froid crée une vraie alternative sans imposer de nouvel ingrédient principal. ${intentReason()}`}
      ];
    }else if(starch&&/pommes? de terre|patates? douces?|gnocchi/.test(norm(starch))){
      variants=[
        {title:`Poêlée dorée de ${lower(starch)} · ${p}`,missing:miss(['ail ou herbes fraîches','paprika ou thym']),preparation:freshLeaf?`Fais dorer ${lower(starch)} avec ${protein?withArticle(protein):'la partie protéinée'}. Ajoute ${withArticle(freshLeaf)} seulement au moment de servir.`:`Fais dorer ${lower(starch)} avec ${p}, ajoute les légumes adaptés à la cuisson puis termine avec les éléments frais.`,explanation:`La poêle crée une texture dorée et plus croustillante. ${intentReason()}`},
        {title:`Salade de ${lower(starch)} · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['moutarde ou citron','herbes fraîches ou oignon rouge']),preparation:freshLeaf?`Laisse ${lower(starch)} refroidir, ajoute ${protein?withArticle(protein):'la partie protéinée'} puis ${withArticle(freshLeaf)} fraîche. Assaisonne avec la finition proposée.`:`Laisse ${lower(starch)} refroidir, ajoute ${p} et ${v} puis assaisonne avec la finition proposée.`,explanation:`La même base devient une salade complète servie fraîche. ${intentReason()}`},
        {title:`${/patate douce/.test(norm(starch))?'Patate douce rôtie':/pomme de terre/.test(norm(starch))?'Pommes de terre rôties':`${lower(starch).charAt(0).toLocaleUpperCase('fr')+lower(starch).slice(1)} rôti`} & garnitures`,missing:miss(['herbes fraîches ou paprika','sauce au yaourt ou citron']),preparation:freshLeaf?`Rôtis la base au four jusqu’à ce qu’elle soit dorée, cuis ${protein?withArticle(protein):'la partie protéinée'} à part puis ajoute ${withArticle(freshLeaf)} fraîche au service.`:`Rôtis la base au four jusqu’à ce qu’elle soit dorée, cuis ${p} à part et ajoute ${v} au moment approprié.`,explanation:`Le rôtissage change nettement la texture de la base. ${intentReason()}`},
        {title:`Écrasé de ${lower(starch)} · ${p}`,missing:miss(['huile d’olive ou herbes','feta ou yaourt']),preparation:freshLeaf?`Écrase grossièrement ${lower(starch)} après cuisson, ajoute la finition proposée et sers avec ${protein?withArticle(protein):'la partie protéinée'} et ${withArticle(freshLeaf)} fraîche.`:`Écrase grossièrement ${lower(starch)} après cuisson, ajoute la finition proposée et sers avec ${p} et ${v}.`,explanation:`L’écrasé transforme la texture tout en conservant les mêmes composants du repas. ${intentReason()}`}
      ];
    }else if(starch&&/wrap|tortilla|galette/.test(norm(starch))){
      variants=[
        {title:`Wrap minute · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['sauce au yaourt ou moutarde','herbes fraîches']),preparation:`Garnis ${lower(starch)} avec ${p} et ${v}, ajoute la finition proposée puis roule ou replie.`,explanation:`La même garniture devient un repas à tenir en main. ${intentReason()}`},
        {title:`Wrap toasté · ${p}`,missing:miss(['fromage ou pesto','herbes fraîches']),preparation:`Garnis la galette, replie-la puis fais-la dorer quelques minutes à la poêle. Ajoute les feuilles fraîches après cuisson.`,explanation:`Le passage à la poêle donne une enveloppe croustillante et une garniture chaude. ${intentReason()}`},
        {title:`Rouleaux froids · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['concombre ou oignon rouge','sauce au yaourt ou citron']),preparation:`Garnis la galette avec les ingrédients froids ou refroidis, roule serré puis coupe en tronçons.`,explanation:`La découpe en petits rouleaux crée une présentation vraiment différente. ${intentReason()}`},
        {title:`Wrap façon bowl · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['herbes fraîches ou citron','graines ou sauce légère']),preparation:`Coupe la galette en lanières toastées et sers-la dans un bol avec ${p} et ${v}.`,explanation:`La galette devient ici un élément croustillant du bowl au lieu de servir d’enveloppe. ${intentReason()}`}
      ];
    }else if(starch&&/pain|baguette/.test(norm(starch))){
      variants=[
        {title:`Tartine fraîche · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['herbes fraîches ou citron','tomates ou concombre']),preparation:`Toaste légèrement le pain, ajoute ${p} puis ${v} et termine avec la finition proposée.`,explanation:`La tartine ouverte garde chaque ingrédient visible et apporte du croustillant. ${intentReason()}`},
        {title:`Sandwich frais · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['moutarde ou sauce au yaourt','concombre ou oignon rouge']),preparation:`Assemble les ingrédients entre deux tranches ou dans la baguette et ajoute la finition proposée.`,explanation:`Cette version transforme les mêmes ingrédients en repas facile à emporter. ${intentReason()}`},
        {title:`Tartine chaude · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['feta ou fromage râpé','herbes fraîches ou pesto']),preparation:`Toaste le pain avec les éléments qui supportent la chaleur puis ajoute les végétaux frais après cuisson.`,explanation:`La version chaude joue sur le contraste croustillant et fondant. ${intentReason()}`},
        {title:`Bruschetta composée · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['tomates ou herbes fraîches','huile d’olive ou citron']),preparation:`Fais griller le pain, coupe les garnitures en petits morceaux puis répartis-les dessus au dernier moment.`,explanation:`La découpe fine et le pain grillé donnent une autre forme au même assemblage. ${intentReason()}`}
      ];
    }else if(starch&&/manioc|igname|plantain|fonio|millet|\bmil\b|attieke/.test(norm(starch))){
      variants=[
        {title:`${protein?`${cap(protein)} grillé${/dorade|daurade|sole|truite|lotte|sardine|morue|perche|carpe/.test(norm(protein))?'e':''}`:'Assiette grillée'} · ${lower(starch)} & ${v}`,missing:miss(['herbes fraîches ou citron','gingembre ou cumin doux']),preparation:freshLeaf?`Prépare ${withArticle(starch)} selon sa cuisson habituelle, grille ou saisis ${protein?withArticle(protein):'la partie protéinée'} puis sers ${withArticle(freshLeaf)} fraîche à côté. Termine avec la finition proposée.`:`Prépare ${withArticle(starch)} selon sa cuisson habituelle, grille ou saisis ${protein?withArticle(protein):'la partie protéinée'} puis sers ${veg?withArticle(veg):'les végétaux'} à la texture adaptée. Termine avec la finition proposée.`,explanation:`Cette version garde les trois repères déjà présents et change surtout la cuisson et la finition. ${intentReason()}`},
        {title:`Bowl de ${lower(starch)} · ${titleJoin([protein,displayVeg])||main}`,missing:miss(['herbes fraîches ou citron','tomates ou oignon rouge']),preparation:`Dispose ${lower(starch)} en base, ajoute ${p} puis ${v} et termine avec la finition proposée.`,explanation:`Le bowl réorganise les mêmes ingrédients sans ajouter une seconde protéine ni un second féculent. ${intentReason()}`},
        freshLeaf?{title:`${cap(protein||'Protéine')} poêlé${/dorade|daurade|sole|truite|lotte|sardine|morue|perche|carpe/.test(norm(protein))?'e':''} · ${lower(starch)} & ${freshLeafTitle(freshLeaf)}`,missing:miss(['citron ou herbes fraîches','oignon rouge ou tomates']),preparation:`Prépare ${withArticle(starch)}, saisis ${protein?withArticle(protein):'la partie protéinée'} puis sers avec ${withArticle(freshLeaf)} fraîche. Termine avec la finition proposée.`,explanation:`Cette variante garde les feuilles fraîches et change la cuisson de la protéine sans transformer la salade en sauce. ${intentReason()}`}:{title:veg?`${cap(protein||'Protéine')} en sauce légère au ${lower(veg)} · ${lower(starch)}`:`Assiette en sauce légère · ${lower(starch)} & ${p}`,missing:miss(['oignon ou épices douces','herbes fraîches ou citron']),preparation:`Prépare une sauce légère autour de ${veg?withArticle(veg):'tes aromates'}, cuis ${protein?withArticle(protein):'la partie protéinée'} sans la surcuire puis sers avec ${withArticle(starch)}.`,explanation:`La sauce transforme réellement la forme du plat tout en conservant les ingrédients principaux déjà présents. ${intentReason()}`},
        {title:`Assiette chaude-froide · ${lower(starch)}, ${p} & ${v}`,missing:miss(['citron ou herbes fraîches','graines de sésame ou courge']),preparation:`Garde ${lower(starch)} et ${p} chauds ou tièdes, puis ajoute ${v} selon la texture qui lui convient et termine avec la finition proposée.`,explanation:`Le contraste de textures et de températures donne une autre proposition avec la même base. ${intentReason()}`}
      ];
    }else if(/\boeufs?\b/.test(norm(input))){
      variants=[
        {title:`Omelette composée · ${v}`,missing:miss(['herbes fraîches','feta ou fromage']),preparation:`Bats les œufs, ajoute les ingrédients qui supportent la cuisson puis cuis doucement en omelette. Termine avec les éléments frais.`,explanation:`Les mêmes ingrédients sont regroupés dans une omelette plutôt que servis séparément. ${intentReason()}`},
        {title:`Œufs brouillés & garnitures`,missing:miss(['herbes ou épices douces','avocat ou tomates']),preparation:`Prépare des œufs brouillés crémeux puis ajoute ou sers les autres ingrédients autour.`,explanation:`La cuisson brouillée change la texture et permet un assemblage plus souple. ${intentReason()}`},
        {title:`Frittata express · ${v}`,missing:miss(['herbes fraîches ou un peu de fromage','tomates ou champignons']),preparation:`Mélange les œufs avec les ingrédients qui supportent la cuisson, verse dans une petite poêle puis termine doucement, éventuellement au four.`,explanation:`La frittata transforme la même base en préparation plus épaisse et découpable. ${intentReason()}`},
        {title:`Bowl salé aux œufs · ${v}`,missing:miss(['sauce au yaourt ou citron','herbes fraîches']),preparation:`Prépare les œufs à ton goût, dispose les autres ingrédients en garnitures et termine avec la finition proposée.`,explanation:`Le bowl change l’assemblage et garde chaque composant visible. ${intentReason()}`}
      ];
    }else if(protein&&leaf){
      variants=[
        {title:`Salade repas · ${titleJoin([protein,leaf])}`,missing:miss(['tomates ou oignon rouge','citron ou herbes fraîches']),preparation:`Prépare ${p}, garde ${lower(leaf)} fraîche puis assemble en salade avec la finition proposée.`,explanation:`Cette version garde la fraîcheur du végétal et fait de la protéine le centre de la salade. ${intentReason()}`},
        cupLeaf?{title:`Cups de ${lower(cupLeaf)} · ${p}`,missing:miss(['tomates ou concombre','sauce au yaourt ou citron']),preparation:`Utilise les grandes feuilles comme coupelles, ajoute ${p} et les autres ingrédients puis termine avec la finition proposée.`,explanation:`La feuille devient le contenant et transforme réellement la présentation. ${intentReason()}`}:{title:`Assiette fraîche · ${titleJoin([protein,leaf])}`,missing:miss(['concombre ou radis','citron ou herbes fraîches']),preparation:`Dispose ${lower(leaf)} en base, ajoute ${p} puis la finition proposée.`,explanation:`La préparation reste fraîche tout en changeant l’assemblage. ${intentReason()}`},
        {title:`Assiette chaude-froide · ${p} & ${lower(leaf)}`,missing:miss(['herbes fraîches ou citron','graines de sésame ou courge']),preparation:`Sers ${p} chaud ou tiède sur ${lower(leaf)} fraîche et ajoute la finition proposée au dernier moment.`,explanation:`Le contraste chaud-froid change l’expérience sans cuire la salade. ${intentReason()}`},
        {title:`Bowl croquant · ${p} & ${lower(leaf)}`,missing:miss(['avocat ou concombre','graines ou herbes fraîches']),preparation:`Dispose ${lower(leaf)} et ${p} dans un bol, ajoute les autres ingrédients puis la finition proposée.`,explanation:`Le bowl joue sur les textures et garde chaque ingrédient bien identifiable. ${intentReason()}`}
      ];
    }else if(a.pulses.length){
      const pulse=lower(first(a.pulses));
      variants=[
        {title:`Salade de ${pulse} · ${titleJoin(a.vegetables.slice(0,2))||'crudités'}`,missing:miss(['citron ou vinaigre doux','herbes fraîches ou oignon rouge']),preparation:`Garde les crudités fraîches, ajoute ${pulse} puis la finition proposée. Si les légumineuses sont chaudes, laisse-les tiédir avant d’assembler.`,explanation:`Cette version met les légumineuses au centre d’une salade fraîche. ${intentReason()}`},
        {title:`${/^lentilles/.test(norm(pulse))?'Lentilles poêlées':`${pulse.charAt(0).toLocaleUpperCase('fr')+pulse.slice(1)} poêlés`} & crudités`,missing:miss(['ail ou épices douces','citron ou herbes fraîches']),preparation:`Fais revenir ${pulse} avec les aromates ou épices proposés. Sers les crudités et feuilles à côté ou ajoute-les seulement hors du feu.`,explanation:`La légumineuse devient chaude et légèrement dorée tandis que les végétaux fragiles restent frais. ${intentReason()}`},
        {title:`Bowl de ${pulse} · ${titleJoin(a.vegetables.slice(0,2))||main}`,missing:miss(['sauce au yaourt ou citron','graines ou herbes fraîches']),preparation:`Dispose ${pulse} en base, ajoute les légumes en garnitures puis termine avec la finition proposée.`,explanation:`Le bowl garde chaque composant identifiable et change l’assemblage. ${intentReason()}`},
        {title:`Galettes de ${pulse} & salade`,missing:miss(['flocons d’avoine ou farine','herbes fraîches ou épices']),preparation:`Écrase grossièrement ${pulse}, ajoute juste assez de liant proposé, forme de petites galettes puis fais-les dorer. Sers les végétaux frais à côté.`,explanation:`Les légumineuses changent complètement de forme et de texture en devenant des galettes. ${intentReason()}`}
      ];
    }else if(leaf&&!protein){
      variants=[
        {title:`Salade croquante · ${titleJoin(a.vegetables.slice(0,3))||main}`,missing:miss(['œufs, poulet ou pois chiches','feta ou graines']),preparation:`Garde les feuilles et crudités fraîches, ajoute la source protéinée proposée puis assaisonne simplement.`,explanation:`Cette version complète la base végétale sans la cuire. ${intentReason()}`},
        {title:`Bowl végétal · ${titleJoin(a.vegetables.slice(0,3))||main}`,missing:miss(['quinoa ou pois chiches','avocat ou graines']),preparation:`Dispose les végétaux dans un bol, ajoute la finition proposée puis assaisonne au dernier moment.`,explanation:`Le bowl apporte une autre présentation en gardant les végétaux frais. ${intentReason()}`},
        {title:`Wraps de laitue · garniture minute`,missing:miss(['thon, poulet ou tofu','tomates ou concombre']),preparation:`Utilise les grandes feuilles comme enveloppes et ajoute la garniture proposée avec les autres crudités.`,explanation:`Les feuilles deviennent le contenant du repas, ce qui change réellement la forme. ${intentReason()}`},
        {title:`Assiette fraîche composée · ${titleJoin(a.vegetables.slice(0,3))||main}`,missing:miss(['œufs ou feta','graines ou herbes fraîches']),preparation:`Répartis les végétaux sur l’assiette et ajoute la finition proposée pour compléter l’ensemble.`,explanation:`Cette version reste entièrement fraîche et joue sur les textures. ${intentReason()}`}
      ];
    }else{
      variants=[
        {title:`Poêlée minute · ${main}`,missing:miss(['ail ou herbes fraîches','épices douces ou citron']),preparation:`Prépare les ingrédients selon leur temps de cuisson puis réunis seulement ceux qui supportent la chaleur à la poêle. Garde les feuilles et crudités pour la fin.`,explanation:`Cette version privilégie une préparation chaude et rapide sans maltraiter les ingrédients fragiles. ${intentReason()}`},
        {title:`Bowl composé · ${main}`,missing:miss(['herbes fraîches ou citron','sauce au yaourt ou graines']),preparation:`Dispose les ingrédients en plusieurs zones dans un bol, puis termine avec la finition proposée.`,explanation:`Le bowl change l’assemblage sans imposer un nouvel ingrédient principal. ${intentReason()}`},
        {title:`Assiette fraîche · ${main}`,missing:miss(['citron ou vinaigre doux','herbes fraîches ou oignon rouge']),preparation:`Prépare les ingrédients, laisse refroidir ceux qui le nécessitent puis assemble le tout avec un assaisonnement simple.`,explanation:`Cette version froide propose une utilisation différente des mêmes ingrédients. ${intentReason()}`},
        {title:`Assiette chaude-froide · ${main}`,missing:miss(['herbes fraîches ou sauce légère','graines de sésame ou citron']),preparation:`Garde chauds les éléments cuits et ajoute les ingrédients frais au dernier moment, puis termine avec la finition proposée.`,explanation:`Le contraste des températures donne une autre forme au repas sans inventer de nouvelle base. ${intentReason()}`}
      ];
    }
    return variants[(index-1)%variants.length];
  }
  function alternateSuggestion(input,index){return sweetAlternative(input,index)||savoryAlternative(input,index);}
  function renderSnapshot(snapshot){
    if(!snapshot)return;
    currentSnapshot=snapshot;currentName=snapshot.title||'Une idée à composer';lastIngredients=snapshot.ingredients||lastIngredients;intent=snapshot.intent||intent;
    const owned=Array.isArray(snapshot.owned)?snapshot.owned:inputIngredients(lastIngredients);
    const missing=ensureMissingSuggestions(lastIngredients,Array.isArray(snapshot.missing)?snapshot.missing:[]);
    const box=document.getElementById('foodInspirationResult');
    box.hidden=false;box.innerHTML=`<section class="mt-food-signature"><small>Le plat imaginé par Tee · ${esc(INTENTS[intent])}</small><h2>${esc(currentName)}</h2><div class="mt-inspire-section"><b>Tu as déjà</b><p>${esc(sentence(owned))}</p></div><div class="mt-inspire-section"><b>À prévoir</b><p>${esc(missing.length?sentence(missing):'Rien de plus pour cette proposition.')}</p></div><div class="mt-inspire-section"><b>Préparation courte</b><p>${esc(snapshot.preparation||'Prépare les ingrédients puis assemble-les selon cette idée.')}</p></div><div class="mt-inspire-section"><b>Pourquoi ce choix ?</b><p>${esc(snapshot.explanation||intentReason())}</p></div>${snapshot.substitute?`<div class="mt-inspire-section"><b>Alternative possible</b><p>Tu peux aussi utiliser ${esc(snapshot.substitute)}, selon ce que tu as et tes préférences.</p></div>`:''}<div class="mt-inspire-actions"><button type="button" id="saveInspiredMeal">Enregistrer cette idée</button><button type="button" id="anotherInspiredMeal">Une autre idée</button><button type="button" id="editInspiredMeal">Modifier mes ingrédients</button></div></section>`;
    document.getElementById('foodInspirationInput').hidden=true;
    document.getElementById('saveInspiredMeal').onclick=saveCurrent;
    document.getElementById('anotherInspiredMeal').onclick=nextIdea;
    document.getElementById('editInspiredMeal').onclick=()=>{box.hidden=true;document.getElementById('foodInspirationInput').hidden=false;document.getElementById('inspirationIngredients').value=lastIngredients;renderIntents();renderFavorites();document.getElementById('inspirationIngredients').focus();};
    window.scrollTo({top:0,behavior:'smooth'});
  }
  async function openFavorite(row){
    if(!row)return;
    if(row.snapshot){variationIndex=Number(row.snapshot.variation_index||0);ranked=[];cursor=0;renderSnapshot(row.snapshot);return;}
    intent=row.intent||'equilibre';variationIndex=0;ranked=[];cursor=0;
    const field=document.getElementById('inspirationIngredients');field.value=row.ingredients||'';renderIntents();
    await compose();
  }
  function renderIntents(){
    const box=document.getElementById('inspirationIntents');
    box.innerHTML=Object.entries(INTENTS).map(([key,label])=>`<button type="button" class="mt-inspire-intent${key===intent?' is-active':''}" data-intent="${key}">${esc(label)}</button>`).join('');
    box.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{intent=btn.dataset.intent;renderIntents();});
  }
  function renderFavorites(){
    const box=document.getElementById('inspirationFavorites'),rows=readFavorites(user?.id);
    box.hidden=!rows.length;if(!rows.length)return;
    box.innerHTML=`<div class="mt-food-label">Mes idées enregistrées</div>${rows.map((x,i)=>`<div class="mt-inspire-favorite-row"><button type="button" class="mt-inspire-favorite-open" data-open="${i}" aria-label="Rouvrir ${esc(x.title)}"><b>${esc(x.title)}</b><small>${esc(INTENTS[x.intent]||'Inspiration')}</small></button><button type="button" class="mt-inspire-favorite-remove" data-remove="${i}" aria-label="Supprimer ${esc(x.title)}">Retirer</button></div>`).join('')}`;
    box.querySelectorAll('[data-open]').forEach(btn=>btn.onclick=()=>openFavorite(rows[Number(btn.dataset.open)]));
    box.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>{rows.splice(Number(btn.dataset.remove),1);writeFavorites(user.id,rows);renderFavorites();});
  }
  function renderResult(item,index=0){
    current=item;const input=lastIngredients;currentName=suggestionTitle(item,input);
    const typ=components(item,'typical_components'),opt=components(item,'optional_components'),cultural=culturalNameAllowed(item,input);
    const combination=!cultural?culinaryCombination(input):null;
    const owned=inputIngredients(input);
    let missing=cultural?typ.filter(x=>!includesIngredient(input,x)).slice(0,2):[];
    if(!cultural){
      const shape=sweetShape(input);
      if(combination){
        missing=[...(combination.missing||[])];
      }else if(shape){
        const sweetExtra=sweetSuggestedExtra(input,shape);
        if(sweetExtra)missing.push(sweetExtra);
      }else if(isBatterBase(input)){
        const batterSuggestions=intent==='gourmandise'?['vanille ou cannelle','fruits frais ou cacao non sucré']:intent==='construire'?['yaourt grec ou fromage blanc','saumon ou œuf supplémentaire']:intent==='legerete'?['fruits frais ou compote sans sucre','épinards ou champignons']:['épinards ou champignons','tomates ou herbes fraîches'];
        missing.push(firstAbsentSuggestion(input,batterSuggestions));
      }else missing=savoryMissingSuggestions(input);
      missing=missing.filter(Boolean).slice(0,2);
    }
    if(!missing.length)missing=[sweetShape(input)?sweetSuggestedExtra(input,sweetShape(input)):genericFinishingSuggestion(input)];
    const substitute=cultural?opt.find(x=>!includesIngredient(input,x)):'';
    const alternate=alternateSuggestion(input,index);
    const resolvedMissing=ensureMissingSuggestions(input,alternate?.missing||missing);
    const snapshot={
      title:alternate?.title||combination?.title||currentName,
      intent,
      ingredients:input,
      owned,
      missing:resolvedMissing,
      preparation:alternate?.preparation||combination?.preparation||preparation(item,owned,resolvedMissing),
      explanation:alternate?.explanation||combination?.explanation||explanation(item,owned,currentName),
      substitute:alternate?'':substitute,
      variation_index:index
    };
    currentName=snapshot.title;renderSnapshot(snapshot);
  }
  function saveCurrent(){
    if(!currentSnapshot||!user)return;
    const rows=readFavorites(user.id),name=currentSnapshot.title||currentName||'Idée de Tee';
    const snapshot={...currentSnapshot,owned:[...(currentSnapshot.owned||[])],missing:[...(currentSnapshot.missing||[])]};
    const key=`${norm(name)}|${norm(snapshot.ingredients)}|${snapshot.intent}`;
    const next=[{title:name,intent:snapshot.intent,ingredients:snapshot.ingredients,saved_at:new Date().toISOString(),snapshot},...rows.filter(x=>`${norm(x.title)}|${norm(x.ingredients)}|${x.intent}`!==key)];
    writeFavorites(user.id,next);renderFavorites();window.MTFood?.toast?.('Idée enregistrée. Tu peux la rouvrir depuis « Mes idées enregistrées ».');
  }
  async function loadRanked(input){
    try{
      const catalog=await (window.mtEnsureFoodCatalog?window.mtEnsureFoodCatalog():Promise.resolve([]));
      const pool=(Array.isArray(catalog)&&catalog.some(isDish)?catalog.filter(isDish):FALLBACK);
      ranked=pool.map(x=>score(x,input)).sort((a,b)=>b.score-a.score||b.overlap-a.overlap).slice(0,18);
      if(!ranked.length)throw new Error('catalogue vide');
    }catch(e){ranked=FALLBACK.map(x=>score(x,input)).sort((a,b)=>b.score-a.score);}
  }
  async function nextIdea(){
    if(!lastIngredients)return;
    variationIndex+=1;
    if(!ranked.length)await loadRanked(lastIngredients);
    if(!ranked.length)return;
    cursor=variationIndex%ranked.length;
    renderResult(ranked[cursor].item,variationIndex);
  }
  async function compose(){
    const field=document.getElementById('inspirationIngredients'),input=field.value.trim();
    if(words(input).length<2){window.MTFood?.toast?.('Indique au moins deux ingrédients.');field.focus();return;}
    lastIngredients=input;variationIndex=0;currentSnapshot=null;const btn=document.getElementById('inspirationCompose');btn.disabled=true;btn.textContent='Tee compose…';
    try{await loadRanked(input);cursor=0;if(!ranked.length)throw new Error('catalogue vide');renderResult(ranked[0].item,0);}
    catch(e){ranked=FALLBACK.map(x=>score(x,input)).sort((a,b)=>b.score-a.score);cursor=0;renderResult(ranked[0].item,0);}
    finally{btn.disabled=false;btn.textContent='Composer avec Tee';}
  }
  async function init(){
    const auth=await window.MTFood?.auth?.();if(!auth)return;user=auth.user;renderIntents();renderFavorites();
    document.getElementById('inspirationCompose').onclick=compose;
  }
  document.addEventListener('DOMContentLoaded',init);
})();
