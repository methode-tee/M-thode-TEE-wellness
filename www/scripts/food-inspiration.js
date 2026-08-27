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
    'roquette ou tomates cerises':'de la roquette ou des tomates cerises',
    'courgette ou roquette':'de la courgette ou de la roquette',
    'champignons ou oignon':'des champignons ou de l’oignon',
    'avocat ou tomates cerises':'de l’avocat ou des tomates cerises',
    'feta ou pois chiches':'de la feta ou des pois chiches',
    'menthe fraîche ou glaçons':'de la menthe fraîche ou des glaçons',
    'glaçons ou menthe fraîche':'des glaçons ou de la menthe fraîche',
    'mozzarella ou tomates':'de la mozzarella ou des tomates',
    'olives ou thym':'des olives ou du thym',
    'concombre ou avocat':'du concombre ou de l’avocat',
    'ciboulette ou persil':'de la ciboulette ou du persil',
    'riz ou semoule':'du riz ou de la semoule',
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
    'ail ou persil':'de l’ail ou du persil',
    'épinards ou courgette':'des épinards ou de la courgette',
    'lait de coco ou tomates':'du lait de coco ou des tomates',
    'tomates ou citron vert':'des tomates ou un trait de citron vert',
    'coriandre ou oignon':'de la coriandre ou un peu d’oignon',
    'salade ou tomates':'de la salade ou des tomates',
    'salade ou concombre':'de la salade ou du concombre',
    'tomates ou avocat':'des tomates ou de l’avocat',
    'tomates ou pesto':'des tomates ou un peu de pesto',
    'cacao non sucré ou amandes effilées':'du cacao non sucré ou quelques amandes effilées',
    'copeaux de chocolat noir ou amandes grillées':'quelques copeaux de chocolat noir ou des amandes grillées',
    'cannelle ou éclats d’amande':'de la cannelle ou quelques éclats d’amande',
    'lait ou boisson végétale':'un peu de lait ou de boisson végétale',
    'glaçons ou cacao non sucré':'quelques glaçons ou du cacao non sucré',
    'œufs':'des œufs',
    'œufs ou lait':'des œufs ou du lait',
    'lait':'du lait',
    'beurre ou huile neutre':'du beurre ou un peu d’huile neutre',
    'oignon ou poireau':'de l’oignon ou du poireau',
    'salade verte ou roquette':'de la salade verte ou de la roquette',
    'basilic ou pain grillé':'du basilic ou du pain grillé',
    'basilic ou herbes fraîches':'du basilic ou des herbes fraîches',
    'échalote ou champignons':'de l’échalote ou des champignons',
    'champignons ou épinards':'des champignons ou des épinards',
    'pois chiches ou feta':'des pois chiches ou un peu de feta',
    'semoule ou quinoa':'de la semoule ou du quinoa',
    'persil ou romarin':'du persil ou du romarin',
    'ail ou romarin':'de l’ail ou du romarin',
    'œufs ou thon':'des œufs ou du thon',
    'œufs ou poulet':'des œufs ou du poulet',
    'thon ou pois chiches':'du thon ou des pois chiches',
    'légumes verts ou tomates':'des légumes verts ou des tomates',
    'ail ou muscade':'de l’ail ou un peu de muscade',
    'muscade ou ail':'un peu de muscade ou de l’ail',
    'framboises ou noisettes':'des framboises ou quelques noisettes',
    'fleur de sel ou noisettes':'une pointe de fleur de sel ou quelques noisettes',
    'zeste d’orange ou cardamome':'du zeste d’orange ou de la cardamome',
    'salade ou haricots verts':'de la salade ou des haricots verts',
    'tomates ou brocoli':'des tomates ou du brocoli',
    'paprika ou herbes fraîches':'du paprika ou des herbes fraîches',
    'moutarde ou yaourt nature':'un peu de moutarde ou du yaourt nature',
    'parmesan ou chapelure':'un peu de parmesan ou de chapelure'
  }[String(value||'').toLocaleLowerCase('fr')]||value);
  const favoriteKey=uid=>`mt_tee_inspired_favorites_v1_${uid}`;
  const readFavorites=uid=>{try{return JSON.parse(localStorage.getItem(favoriteKey(uid))||'[]');}catch(e){return [];}};
  const writeFavorites=(uid,rows)=>{try{localStorage.setItem(favoriteKey(uid),JSON.stringify(rows.slice(0,10)));}catch(e){}};
  const recentKey=uid=>`mt_tee_inspiration_recent_v1_${uid}`;
  const readRecent=uid=>{try{return JSON.parse(localStorage.getItem(recentKey(uid))||'[]');}catch(e){return [];}};
  const writeRecent=(uid,rows)=>{try{localStorage.setItem(recentKey(uid),JSON.stringify(rows.slice(0,20)));}catch(e){}};
  const preferenceProfile=uid=>{
    const rows=[...readRecent(uid),...readFavorites(uid)];
    const tokenCounts={},familyCounts={},recentTitles=new Set();
    rows.forEach(row=>{
      inputIngredients(row.ingredients||row.snapshot?.ingredients||'').flatMap(words).forEach(token=>{if(token.length>2)tokenCounts[token]=(tokenCounts[token]||0)+1;});
      const fam=norm(row.family||row.snapshot?.family||'');if(fam)familyCounts[fam]=(familyCounts[fam]||0)+1;
      if(row.title)recentTitles.add(norm(row.title));
    });
    // Réutilise seulement les bilans déjà présents dans le cache local de
    // Mon Équilibre. Cette lecture ne déclenche aucune requête Supabase.
    try{
      const prefix=`mt_tee_balance_week_v11_${uid}_`,cached=[];
      for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(prefix))cached.push(key);}
      cached.sort().slice(-2).forEach(key=>{
        const payload=JSON.parse(localStorage.getItem(key)||'{}'),data=payload.data||payload;
        (data.monthSnapshots||[]).slice(-10).forEach(day=>(day?.signals?.food_context||[]).forEach(food=>{
          const label=String(food?.canonical_name||food?.display_name||food?.name||'');
          words(label).forEach(token=>{if(token.length>2)tokenCounts[token]=(tokenCounts[token]||0)+2;});
          const fam=norm(food?.adapter_family||food?.family||'');if(fam)familyCounts[fam]=(familyCounts[fam]||0)+1;
          if(label)recentTitles.add(norm(label));
        }));
      });
    }catch(e){}
    return {tokenCounts,familyCounts,recentTitles,rows:rows.slice(0,20)};
  };
  let user=null,intent='equilibre',ranked=[],cursor=0,current=null,currentName='',lastIngredients='',variationIndex=0,currentSnapshot=null,preferences=null;

  function inputIngredients(value){
    const prepared=String(value||'')
      .replace(/^\s*j['’]ai\s+/i,'')
      .replace(/[;\n]+/g,',')
      .replace(/\s*\+\s*/g,',')
      .replace(/\s+(?:et|avec|plus)\s+/gi,',')
      // « de la semoule du poulet » devient deux ingrédients sans casser
      // « côtes d'agneau », où l'article appartient au nom de l'aliment.
      .replace(/\b(riz|p[âa]tes?|semoule|couscous|quinoa|boulgour|pommes?\s+de\s+terre|manioc|igname|plantain|poulet|dinde|b(?:œu|oeu)f|agneau|porc|saumon|thon|dorade|tofu|œufs?|oeufs?|tomates?|courgettes?|carottes?|oignons?)\s+(?=(?:du|des|de la|de l['’])\s+)/gi,'$1,')
      // Quelques successions usuelles restent compréhensibles sans article
      // ni virgule : « pâtes saucisses », « riz poulet », « semoule agneau ».
      .replace(/\b(pâtes?|riz|semoule|couscous|quinoa|boulgour|manioc|igname|plantain|fonio|millet|mil|atti[eé]k[eé])\s+(?=(?:saucisses?|merguez|poulet|dinde|steak(?:\s+hach[ée])?|b[œo]uf|agneau|saumon|thon|dorade|daurade|tilapia|bar|loup\s+de\s+mer|merlu|merlan|lieu(?:\s+(?:noir|jaune))?|sole|truite|capitaine|vivaneau|rouget|turbot|lotte|haddock|[ée]glefin|aiglefin|hareng|espadon|cabillaud|colin|sardines?|maquereau|anchois|morue|tofu|[œo]ufs?)\b)/gi,'$1,')
      // Accepte aussi « riz steak haché laitue » ou « manioc dorade gombo ».
      .replace(/\b(steak(?:\s+hach[ée])?|viande\s+hach[ée]e?|b[œo]uf|veau|poulet|dinde|canard|agneau|mouton|porc|saucisses?|merguez|kefta|kofta|[œo]ufs?|saumon|thon|dorade|daurade|tilapia|bar|merlu|merlan|lieu(?:\s+(?:noir|jaune))?|sole|truite|capitaine|vivaneau|rouget|turbot|lotte|haddock|[ée]glefin|aiglefin|hareng|espadon|cabillaud|colin|sardines?|maquereau|anchois|morue|crevettes?|gambas|tofu|tempeh|seitan|lentilles?|pois\s+chiches?)\s+(?=(?:laitue|salade|iceberg|romaine|sucrine|roquette|m[âa]che|endive|[ée]pinards?|tomates?|concombres?|courgettes?|poivrons?|carottes?|brocolis?|chou(?:x|\s+fleur)?|aubergines?|haricots?\s+verts?|champignons?|poireaux?|fenouil|asperges?|artichauts?|betteraves?|c[ée]leri|radis|potiron|courges?|avocat|ma[ïi]s|petits?\s+pois|gombo|okra|pak\s+choi|bok\s+choy)\b)/gi,'$1,')
      // Les sauces et marinades usuelles sont aussi séparées quand l'utilisateur
      // écrit naturellement « poulet citron moutarde » sans virgules ni « + ».
      .replace(/\b(poulet|dinde|canard|steak(?:\s+hach[ée])?|b[œo]uf|veau|agneau|mouton|porc|saumon|thon|dorade|daurade|tilapia|bar|merlu|sole|truite|cabillaud|tofu)\s+(?=(?:citron(?:\s+(?:jaune|vert))?|moutarde|ail|gingembre|sauce\s+soja|tamari|curry|colombo|lait\s+de\s+coco|cr[èe]me\s+de\s+coco|tomates?|oignons?|miel)\b)/gi,'$1,')
      .replace(/\b(citron(?:\s+(?:jaune|vert))?|moutarde|ail|gingembre|sauce\s+soja|tamari|curry|colombo|lait\s+de\s+coco|cr[èe]me\s+de\s+coco|tomates?|oignons?|miel)\s+(?=(?:citron(?:\s+(?:jaune|vert))?|moutarde|ail|gingembre|sauce\s+soja|tamari|curry|colombo|lait\s+de\s+coco|cr[èe]me\s+de\s+coco|tomates?|oignons?|miel)\b)/gi,'$1,')
      // Même tolérance pour une boisson écrite sans séparateurs :
      // « lait d’avoine vanille miel » -> trois ingrédients distincts.
      .replace(/\b(lait\s+d[’']?avoine|lait\s+d[’']?amande|lait\s+de\s+coco|lait\s+de\s+soja|boisson\s+(?:avoine|amande|coco|soja)|lait)\s+(?=(?:vanille|cannelle|cardamome|cacao|miel|sirop\s+d[’']?[ée]rable|sirop\s+d[’']?agave|gingembre|muscade|fleur\s+d[’']?oranger)\b)/gi,'$1,')
      .replace(/\b(vanille|cannelle|cardamome|cacao|miel|sirop\s+d[’']?[ée]rable|sirop\s+d[’']?agave|gingembre|muscade|fleur\s+d[’']?oranger)\s+(?=(?:vanille|cannelle|cardamome|cacao|miel|sirop\s+d[’']?[ée]rable|sirop\s+d[’']?agave|gingembre|muscade|fleur\s+d[’']?oranger)\b)/gi,'$1,')
      // V401 · Cas culinaires fréquemment écrits sans séparateurs.
      .replace(/\b(riz|pâtes?|semoule|quinoa|boulgour)\s+(?=(?:curry|colombo|garam\s+masala)\b)/gi,'$1,')
      .replace(/\b(curry|colombo|garam\s+masala)\s+(?=(?:thon|poulet|dinde|saumon|dorade|tofu|crevettes?|pois\s+chiches?)\b)/gi,'$1,')
      .replace(/\b(glace(?:\s+à\s+la)?\s+vanille|glace\s+vanille|crème\s+glacée(?:\s+vanille)?|boules?\s+(?:de\s+)?glace(?:\s+vanille)?)\s+(?=(?:café|espresso|amaretto)(?:\s|$))/gi,'$1,')
      .replace(/(café|espresso)\s+(?=(?:amaretto|glace|crème\s+glacée)(?:\s|$))/gi,'$1,')
      .replace(/\b(petits?\s+pains?(?:\s+précuits?)?|pains?\s+précuits?|baguette|bagel|ciabatta|panini|pita)\s+(?=(?:st\.?\s*m[ôo]ret|saint\s+m[ôo]ret|philadelphia|cream\s+cheese|fromage\s+frais)(?:\s|$))/gi,'$1,')
      .replace(/\b(st\.?\s*m[ôo]ret|saint\s+m[ôo]ret|philadelphia|cream\s+cheese|fromage\s+frais)\s+(?=(?:blancs?\s+de\s+poulet|poulet|dinde|saumon|thon|jambon)(?:\s|$))/gi,'$1,')
      // V402 · pâtisserie, tartes, pommes de terre et associations culinaires sans séparateurs.
      .replace(/\b(farine(?:\s+de\s+bl[eé]\s+noir)?)\s+(?=(?:sucre(?:\s+en\s+poudre)?|cacao(?:\s+en\s+poudre)?|chocolat)(?:\s|$))/gi,'$1,')
      .replace(/\b(sucre(?:\s+en\s+poudre)?)\s+(?=(?:cacao(?:\s+en\s+poudre(?:\s+non\s+sucr[eé])?)?|chocolat(?:\s+p[âa]tissier)?)(?:\s|$))/gi,'$1,')
      .replace(/\b(p[âa]te\s+(?:feuillet[eé]e|bris[eé]e|sabl[eé]e))\s+(?=(?:cr[eè]me\s+(?:fra[îi]che|liquide)|lardons?|chocolat(?:\s+p[âa]tissier)?)(?:\s|$))/gi,'$1,')
      .replace(/\b(cr[eè]me\s+(?:fra[îi]che|liquide))\s+(?=(?:lardons?|chocolat(?:\s+p[âa]tissier)?|lait)(?:\s|$))/gi,'$1,')
      .replace(/\b(burrata)\s+(?=(?:avocat|tomates?)(?:\s|$))/gi,'$1,')
      .replace(/\b(avocat)\s+(?=(?:tomates?\s+cerises?|burrata)(?:\s|$))/gi,'$1,')
      .replace(/\b(coquillettes?|macaronis?|penne|spaghetti|tagliatelles?)\s+(?=(?:vin\s+blanc(?:\s+sec)?|fromage\s+de\s+ch[eè]vre|ch[eè]vre)(?:\s|$))/gi,'$1,')
      .replace(/\b(vin\s+blanc(?:\s+sec)?)\s+(?=(?:fromage\s+de\s+ch[eè]vre|ch[eè]vre|parmesan|comt[eé])(?:\s|$))/gi,'$1,')
      .replace(/\b(oignons?)\s+(?=(?:ail|aubergines?)(?:\s|$))/gi,'$1,')
      .replace(/\b(ail)\s+(?=(?:aubergines?|courgettes?|pommes?\s+de\s+terre)(?:\s|$))/gi,'$1,')
      .replace(/\b(b[œo]uf\s+hach[eé]|steak\s+hach[eé])\s+(?=(?:pommes?\s+de\s+terre)(?:\s|$))/gi,'$1,')
      .replace(/\b(pommes?\s+de\s+terre(?:\s+grenailles?)?)\s+(?=(?:huile\s+d[’']olive|huile\s+de\s+tournesol|beurre|cr[eè]me\s+fra[îi]che|lait|salade|iceberg|tomates?|oignons?|ail|courgettes?)(?:\s|$))/gi,'$1,')
      .replace(/\b(ailes?\s+de\s+poulet)\s+(?=(?:p[âa]tes?|coquillettes?|riz)(?:\s|$))/gi,'$1,')
      .replace(/\b(p[âa]tes?|coquillettes?)\s+(?=(?:huile\s+de\s+tournesol|huile\s+d[’']olive)(?:\s|$))/gi,'$1,')
      // V403 · nouvelles associations culinaires fréquentes sans séparateurs.
      .replace(/\b(riz(?:\s+basmati)?)\s+(?=(?:œufs?|oeufs?)(?:\s|$))/gi,'$1,')
      .replace(/\b(œufs?|oeufs?)\s+(?=(?:oignons?|[ée]chalotes?)(?:\s|$))/gi,'$1,')
      .replace(/\b(thon)\s+(?=(?:citron\s+vert|citron|cr[eè]me\s+fra[îi]che)(?:\s|$))/gi,'$1,')
      .replace(/\b(citron\s+vert|citron)\s+(?=(?:cr[eè]me\s+fra[îi]che)(?:\s|$))/gi,'$1,')
      .replace(/\b(b(?:œu|oeu)f(?:\s+hach[eé])?)\s+(?=(?:oignons?|poivrons?)(?:\s|$))/gi,'$1,')
      .replace(/\b(oignons?)\s+(?=(?:poivrons?|tomates?|chou(?:x)?)(?:\s|$))/gi,'$1,')
      .replace(/\b(pav[eé]s?\s+de\s+saumon|filets?\s+de\s+saumon|saumon)\s+(?=(?:carottes?|brocolis?)(?:\s|$))/gi,'$1,')
      .replace(/\b(carottes?)\s+(?=(?:brocolis?)(?:\s|$))/gi,'$1,')
      .replace(/\b(poudre\s+d[’']amandes?|amandes?\s+en\s+poudre)\s+(?=(?:beurre|farine)(?:\s|$))/gi,'$1,')
      .replace(/\b(beurre)\s+(?=(?:farine|poudre\s+d[’']amandes?|amandes?\s+en\s+poudre)(?:\s|$))/gi,'$1,')
      .replace(/\b(courgettes?)\s+(?=(?:ricotta|lardons?)(?:\s|$))/gi,'$1,')
      .replace(/\b(ricotta)\s+(?=(?:lardons?|courgettes?)(?:\s|$))/gi,'$1,')
      .replace(/\b(chou(?:x)?(?:\s+vert|\s+blanc|\s+rouge)?)\s+(?=(?:tomates?|oignons?)(?:\s|$))/gi,'$1,')
      .replace(/\b(tomates?)\s+(?=(?:oignons?|chou(?:x)?)(?:\s|$))/gi,'$1,')
      .replace(/\b(chou(?:x)?(?:\s+(?:vert|blanc|rouge))?)\s+(tomates?)/gi,'$1,$2')
      // V404 · bases type pinsa/pizza, salades fraîches, boissons, marinades et mijotés sans séparateurs.
      .replace(/\b(pinsa(?:\s+romana)?|pizza|focaccia|naan|flatbread|bruschetta)\s+(?=(?:st\.?\s*m[ôo]ret|saint\s+m[ôo]ret|philadelphia|cream\s+cheese|fromage\s+frais|ricotta|cr[eè]me\s+fra[îi]che)(?:\s|$))/gi,'$1,')
      .replace(/\b(st\.?\s*m[ôo]ret|saint\s+m[ôo]ret|philadelphia|cream\s+cheese|fromage\s+frais|ricotta)\s+(?=(?:cr[eè]me\s+fra[îi]che|roquette|tomates?\s+cerises?|courgettes?|saumon|poulet)(?:\s|$))/gi,'$1,')
      .replace(/\b(concombres?)\s+(?=(?:ma[ïi]s|oignons?\s+rouges?)(?:\s|$))/gi,'$1,')
      .replace(/\b(ma[ïi]s)\s+(?=(?:oignons?\s+rouges?|concombres?)(?:\s|$))/gi,'$1,')
      .replace(/\b(sirop\s+(?:de\s+|d[’']\s*)?(?:fraise|framboise|grenadine|p[êe]che|mangue|passion|menthe|citron|cerise))\s+(?=(?:sprite|7\s*up|seven\s*up|limonade|soda(?:\s+citron)?|eau\s+p[ée]tillante)(?:\s|$))/gi,'$1,')
      .replace(/\b(sprite|7\s*up|seven\s*up|limonade|soda(?:\s+citron)?|eau\s+p[ée]tillante)\s+(?=(?:citron\s+vert|citron|menthe|gla[çc]ons?)(?:\s|$))/gi,'$1,')
      .replace(/\b(p[âa]te\s+(?:[àa]\s+)?(?:pizza|pinsa|focaccia|naan))\s+(?=(?:huile\s+(?:de\s+tournesol|d[’']olive)|oignons?|tomates?|mozzarella)(?:\s|$))/gi,'$1,')
      .replace(/\b(huile\s+(?:de\s+tournesol|d[’']olive))\s+(?=(?:oignons?|tomates?|mozzarella)(?:\s|$))/gi,'$1,')
      .replace(/\b(c[œo]ur\s+de\s+saumon|dos\s+de\s+saumon|pav[eé]s?\s+de\s+saumon|filets?\s+de\s+saumon|saumon)\s+(?=(?:citron\s+vert|citron|vinaigre)(?:\s|$))/gi,'$1,')
      .replace(/\b(citron\s+vert|citron)\s+(?=(?:vinaigre(?:\s+de\s+(?:cidre|riz|vin)|\s+balsamique)?)(?:\s|$))/gi,'$1,')
      .replace(/\b(b(?:œu|oeu)f\s+hach[eé]|steak\s+hach[eé]|viande\s+hach[eé]e?)\s+(?=(?:[ée]chalotes?|ciboulette)(?:\s|$))/gi,'$1,')
      .replace(/([ée]chalotes?)\s+(?=(?:ciboulette|persil|ail)(?:\s|$))/gi,'$1,')
      .replace(/\b(poulet|blancs?\s+de\s+poulet|cuisses?\s+de\s+poulet|pilons?\s+de\s+poulet|ailes?\s+de\s+poulet)\s+(?=(?:olives?\s+(?:vertes?|noires?)|tomates?\s+pel[eé]es?)(?:\s|$))/gi,'$1,')
      .replace(/\b(olives?\s+(?:vertes?|noires?))\s+(?=(?:tomates?\s+pel[eé]es?|tomates?|oignons?)(?:\s|$))/gi,'$1,')
      // V405 · volailles entières, bruschetta béchamel, laquages asiatiques,
      // panures maison, légumes frais et quenelles sans séparateurs.
      .replace(/\b(poulet\s+entier|poulet\s+fermier(?:\s+entier)?|coquelet|pintade(?:\s+enti[eè]re)?)\s+(?=(?:moutarde|concentr[eé]\s+de\s+tomate|double\s+concentr[eé]\s+de\s+tomate|pur[eé]e\s+de\s+tomate|tomate\s+concentr[eé]e)(?:,|\s|$))/gi,'$1,')
      .replace(/\b(moutarde)\s+(?=(?:concentr[eé]\s+de\s+tomate|double\s+concentr[eé]\s+de\s+tomate|pur[eé]e\s+de\s+tomate|tomate\s+concentr[eé]e)(?:\s|$))/gi,'$1,')
      .replace(/\b(pain\s+(?:[àa]\s+)?bruschetta|bruschetta|tartines?\s+de\s+pain)\s+(?=(?:b[eé]chamel|sauce\s+b[eé]chamel)(?:\s|$))/gi,'$1,')
      .replace(/\b(b[eé]chamel|sauce\s+b[eé]chamel)\s+(?=(?:jambon(?:\s+blanc|\s+de\s+dinde|\s+de\s+poulet)?)(?:\s|$))/gi,'$1,')
      .replace(/\b(pav[eé]s?\s+de\s+saumon|filets?\s+de\s+saumon|c[œo]ur\s+de\s+saumon|dos\s+de\s+saumon|saumon)\s+(?=(?:huile\s+d[’']olive|huile\s+olive|beurre)(?:\s|$))/gi,'$1,')
      .replace(/\b(huile\s+d[’']olive|huile\s+olive)\s+(?=(?:beurre)(?:\s|$))/gi,'$1,')
      .replace(/\b(pilons?\s+de\s+poulet|cuisses?\s+de\s+poulet|hauts?\s+de\s+cuisses?\s+de\s+poulet|ailes?\s+de\s+poulet)\s+(?=(?:sauce\s+sweet\s+chili|sweet\s+chili|sweet\s+chilli|sauce\s+chili\s+sucr[eé]e|sauce\s+aigre[- ]douce)(?:\s|$))/gi,'$1,')
      .replace(/\b(sauce\s+sweet\s+chili|sweet\s+chili|sweet\s+chilli|sauce\s+chili\s+sucr[eé]e|sauce\s+aigre[- ]douce)\s+(?=(?:sauce\s+soja\s+sucr[eé]e|soja\s+sucr[eé]e|sweet\s+soy|kecap\s+manis)(?:\s|$))/gi,'$1,')
      .replace(/\b(tomates?(?:\s+cerises?)?)\s+(?=(?:concombres?|poivrons?\s+(?:verts?|rouges?|jaunes?))(?:\s|$))/gi,'$1,')
      .replace(/\b(concombres?)\s+(?=(?:poivrons?\s+(?:verts?|rouges?|jaunes?))(?:\s|$))/gi,'$1,')
      .replace(/\b(fruits?\s+de\s+mer|cocktail\s+de\s+fruits?\s+de\s+mer|m[eé]lange\s+de\s+fruits?\s+de\s+mer)\s+(?=(?:quenelles?)(?:\s|$))/gi,'$1,')
      .replace(/\b(quenelles?(?:\s+de\s+(?:brochet|poisson))?)\s+(?=(?:beurre)(?:\s|$))/gi,'$1,')
      .replace(/\b(escalopes?\s+(?:de\s+)?poulet|escalopes?\s+de\s+dinde|aiguillettes?\s+de\s+poulet)\s+(?=(?:biscottes?|chapelure|panko|mie\s+de\s+pain)(?:\s|$))/gi,'$1,')
      .replace(/\b(biscottes?|chapelure|panko|mie\s+de\s+pain)\s+(?=(?:farine)(?:\s|$))/gi,'$1,')
      // V406 · pains crémeux, rôtis, bases sucrées et pâtisserie sans séparateurs.
      .replace(/\b(pain\s+(?:[àa]\s+)?panini|panini|ciabatta|baguette|petits?\s+pains?|mini\s+pains?|buns?)\s+(?=(?:cr[eè]me\s+(?:fra[îi]che|liquide|[ée]paisse)|parmesan|emmental|comt[eé]|mozzarella|ch[eè]vre|ricotta)(?:\s|$))/gi,'$1,')
      .replace(/\b(cr[eè]me\s+(?:fra[îi]che|liquide|[ée]paisse))\s+(?=(?:parmesan|emmental|comt[eé]|mozzarella|ch[eè]vre|ricotta)(?:\s|$))/gi,'$1,')
      .replace(/\b(mini\s+pains?|petits?\s+pains?)\s+(?=(?:huile\s+d[’']olive|huile\s+olive|huile\s+de\s+tournesol|oignons?)(?:\s|$))/gi,'$1,')
      .replace(/\b(huile\s+d[’']olive|huile\s+olive|huile\s+de\s+tournesol)\s+(?=(?:oignons?)(?:\s|$))/gi,'$1,')
      .replace(/\b(ailes?\s+de\s+poulet)\s+(?=(?:moutarde|huile\s+de\s+tournesol|huile\s+d[’']olive)(?:\s|$))/gi,'$1,')
      .replace(/\b(moutarde(?:\s+[àa]\s+l['’]ancienne|\s+de\s+dijon)?)\s+(?=(?:huile\s+de\s+tournesol|huile\s+d[’']olive)(?:\s|$))/gi,'$1,')
      .replace(/\b(r[ôo]ti\s+de\s+b(?:œu|oeu)f|rosbif|roast\s+beef)\s+(?=(?:pommes?\s+de\s+terre\s+grenailles?|grenailles?|huile\s+d[’']olive)(?:\s|$))/gi,'$1,')
      .replace(/\b(pommes?\s+de\s+terre\s+grenailles?|grenailles?)\s+(?=(?:huile\s+d[’']olive|huile\s+olive)(?:\s|$))/gi,'$1,')
      .replace(/\b(chocolat\s+(?:noir|p[âa]tissier|dessert|de\s+couverture))\s+(?=(?:[œo]ufs?|oeufs?|sucre)(?:\s|$))/gi,'$1,')
      .replace(/\b([œo]ufs?|oeufs?)\s+(?=(?:sucre(?:\s+en\s+poudre|\s+semoule)?|lait(?:\s+entier|\s+demi[- ]?[ée]cr[eé]m[eé]|\s+[ée]cr[eé]m[eé])?)(?:\s|$))/gi,'$1,')
      .replace(/\b(lait(?:\s+entier|\s+demi[- ]?[ée]cr[eé]m[eé]|\s+[ée]cr[eé]m[eé])?|lait\s+d[’']avoine|lait\s+d[’']amande|lait\s+de\s+soja)\s+(?=(?:sucre(?:\s+en\s+poudre|\s+semoule)?)(?:\s|$))/gi,'$1,')
      .replace(/\b(sucre(?:\s+en\s+poudre|\s+semoule)?)\s+(?=(?:farine|levure(?:\s+chimique|\s+de\s+boulanger|\s+boulang[eè]re)?|poudre\s+[àa]\s+lever)(?:\s|$))/gi,'$1,')
      .replace(/\b(farine(?:\s+de\s+bl[eé]|\s+d['’][ée]peautre|\s+d['’]avoine)?)\s+(?=(?:levure(?:\s+chimique|\s+de\s+boulanger|\s+boulang[eè]re)?|poudre\s+[àa]\s+lever|baking\s+powder)(?:\s|$))/gi,'$1,')
      // V407 · Découpage tolérant des saisies naturelles sans virgule.
      // Ces règles portent sur les frontières entre ingrédients et conservent
      // les noms composés (« lait de coco », « rôti de bœuf », etc.).
      .replace(/\b(r[ôo]ti\s+de\s+b(?:œu|oeu)f|rosbif|roast\s+beef)\s+(?=(?:pommes?\s+de\s+terre\s+grenailles?|grenailles?)(?:\s|,|$))/gi,'$1,')
      .replace(/\b(p[âa]tes?|spaghetti|tagliatelles?|penne|macaronis?|coquillettes?)\s+(?=(?:morceaux?|blancs?|filets?|aiguillettes?)\s+de\s+poulet(?:\s|$))/gi,'$1,')
      .replace(/\b((?:morceaux?|blancs?|filets?|aiguillettes?)\s+de\s+poulet)\s+(?=(?:feuilles?\s+de\s+salade|salade|laitue|roquette|m[âa]che)(?:\s|$))/gi,'$1,')
      .replace(/\b(chocolat\s+(?:noir|p[âa]tissier|dessert|de\s+couverture))\s+(?=(?:œufs?|oeufs?)(?:\s|$))/gi,'$1,')
      .replace(/(œufs?|oeufs?)\s+(?=(?:lait|sucre)(?:\s|,|$))/gi,'$1,')
      .replace(/\b(lait(?:\s+entier|\s+demi[- ]?[ée]cr[eé]m[eé]|\s+[ée]cr[eé]m[eé]|\s+d['’]amande|\s+d['’]avoine|\s+de\s+coco|\s+de\s+soja)?)\s+(?=(?:framboises?|myrtilles?|fraises?|m[ûu]res?|cassis|bananes?|mangues?|poires?|pommes?|p[êe]ches?|kiwis?|ananas|sucre)(?:\s|$))/gi,'$1,')
      .replace(/\b(yaourt\s+grec|yaourt\s+nature|skyr|fromage\s+blanc)\s+(?=(?:framboises?|myrtilles?|fraises?|m[ûu]res?|cassis|bananes?|mangues?|poires?|pommes?|p[êe]ches?|kiwis?|ananas)(?:\s|$))/gi,'$1,')
      .replace(/\b(framboises?|myrtilles?|fraises?|m[ûu]res?|cassis|bananes?|mangues?|poires?|pommes?|p[êe]ches?|kiwis?|ananas)\s+(?=(?:framboises?|myrtilles?|fraises?|m[ûu]res?|cassis|bananes?|mangues?|poires?|pommes?|p[êe]ches?|kiwis?|ananas)(?:\s|$))/gi,'$1,');
    return prepared.split(',').map(x=>x.trim()
      .replace(/^(?:j['’]ai|avec)\s+/i,'')
      .replace(/^(?:de la|de l['’]|du|des|la|le|les|un|une)\s+/i,'')
      .trim()).filter(Boolean).slice(0,12);
  }

  // V395 · Lecture locale des ingrédients : les catégories sont déduites à partir
  // de ce que la personne a réellement écrit. Cela évite par exemple de traiter
  // « laitue » comme « lait », ou d'oublier qu'un steak haché est une protéine.
  const FOOD_RX={
    starch:/\b(pinsa(?: romana)?|pizza|focaccia|naan|flatbread|pain(?: a)? bruschetta|bruschetta|riz|pates?|spaghetti|tagliatelles?|penne|macaronis?|coquillettes?|nouilles?|vermicelles?|udon|soba|semoule|couscous|quinoa|boulgour|ble|epeautre|orge|polenta|pommes? de terre|puree de pommes? de terre|patates? douces?|gnocchis?|pains?|petits? pains?|pains? precuits?|petits? pains? precuits?|baguette|bagel|buns?|ciabatta|panini|pita|muffins? anglais?|wrap|tortilla|galette|flocons? d avoine|avoine|manioc|igname|plantain|bananes? plantain|fonio|millet|mil|attieke|frites?)\b/,
    flour:/\b(farine|fecule|maizena)\b/,
    pastryDough:/\b(pate\s+(?:feuilletee|brisee|sablee)|pate\s+filo|feuilles?\s+de\s+brick)\b/,
    flatbreadBase:/\b(pinsa(?: romana)?|pizza|focaccia|naan|flatbread|pain(?: a)? bruschetta|bruschetta)\b/,
    pizzaDough:/\b(pate\s+(?:a\s+)?(?:pizza|pinsa|focaccia|naan))\b/,
    dairyCream:/\b(creme\s+(?:fraiche|liquide|epaisse|fleurette))\b/,
    bechamel:/\b(?:bechamel|sauce\s+bechamel)\b/,
    tomatoPaste:/\b(?:concentre\s+de\s+tomate|double\s+concentre\s+de\s+tomate|puree\s+de\s+tomate|tomate\s+concentree)\b/,
    sweetChili:/\b(?:sauce\s+sweet\s+chili|sweet\s+chili|sweet\s+chilli|sauce\s+chili\s+sucree|sauce\s+aigre\s+douce)\b/,
    sweetSoy:/\b(?:sauce\s+soja\s+sucree|soja\s+sucree|sweet\s+soy|kecap\s+manis)\b/,
    breadcrumb:/\b(?:biscottes?|chapelure|panko|mie\s+de\s+pain|pain\s+rassis)\b/,
    quenelle:/\b(?:quenelles?(?:\s+de\s+(?:brochet|poisson)|\s+nature)?)\b/,
    cookingAlcohol:/\b(vin\s+blanc(?:\s+sec)?|vin\s+rouge|marsala|porto|cognac|armagnac)\b/,
    chocolate:/\b(cacao(?:\s+en\s+poudre(?:\s+non\s+sucre)?)?|chocolat(?:\s+patissier|\s+noir|\s+dessert|\s+de\s+couverture|\s+au\s+lait)?|pepites?\s+de\s+chocolat)\b/,
    sugar:/\b(sucre(?:\s+en\s+poudre|\s+semoule|\s+glace|\s+roux|\s+complet|\s+de\s+coco)?)\b/,
    leavener:/\b(levure(?:\s+chimique)?|poudre\s+a\s+lever|baking\s+powder)\b/,
    bakerYeast:/\b(levure\s+(?:de\s+boulanger|boulangere|seche\s+de\s+boulanger|fraiche\s+de\s+boulanger))\b/,
    protein:/\b(roti de boeuf|rosbif|roast beef|steak(?: hache)?|viande hachee?|boeuf|veau|poulet|dinde|canard|agneau|mouton|porc|jambon|bacon|lardons?|pancetta|charcuterie|saucisses?|merguez|kefta|kofta|oeufs?|saumon|thon|dorades?|daurades?|tilapias?|bar|bars|loup de mer|loups de mer|merlus?|merlans?|lieu(?: noir| jaune)?|lieux(?: noirs?| jaunes?)?|soles?|truites?|capitaines?|vivaneaux?|rougets?|turbots?|lottes?|haddocks?|eglefins?|aiglefins?|harengs?|espadons?|cabillauds?|colins?|sardines?|maquereaux?|anchois|morue|morues|brochets?|perches?|carpes?|mulets?|pagres?|pageots?|poisson|poissons|crevettes?|gambas|moules?|palourdes?|coques?|huitres?|calamars?|encornets?|seiches?|poulpes?|crabes?|homards?|langoustes?|langoustines?|saint jacques|noix de saint jacques|fruits? de mer|tofu|tempeh|seitan|lentilles?|pois chiches?|haricots? (?:rouges?|blancs?|noirs?|secs?)|flageolets?|edamame|falafels?|feta|mozzarella|burrata|halloumi|fromage(?: de)? chevre|chevre|fromage|skyr|yaourt grec|fromage blanc)\b/,
    savoryProtein:/\b(roti de boeuf|rosbif|roast beef|steak(?: hache)?|viande hachee?|boeuf|veau|poulet|dinde|canard|agneau|mouton|porc|jambon|bacon|lardons?|pancetta|charcuterie|saucisses?|merguez|kefta|kofta|oeufs?|saumon|thon|dorades?|daurades?|tilapias?|bar|bars|loup de mer|loups de mer|merlus?|merlans?|lieu(?: noir| jaune)?|lieux(?: noirs?| jaunes?)?|soles?|truites?|capitaines?|vivaneaux?|rougets?|turbots?|lottes?|haddocks?|eglefins?|aiglefins?|harengs?|espadons?|cabillauds?|colins?|sardines?|maquereaux?|anchois|morue|morues|brochets?|perches?|carpes?|mulets?|pagres?|pageots?|poisson|poissons|crevettes?|gambas|moules?|palourdes?|coques?|huitres?|calamars?|encornets?|seiches?|poulpes?|crabes?|homards?|langoustes?|langoustines?|saint jacques|noix de saint jacques|fruits? de mer|tofu|tempeh|seitan|lentilles?|pois chiches?|haricots? (?:rouges?|blancs?|noirs?|secs?)|flageolets?|edamame|falafels?)\b/,
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
    sweetAromatic:/\b(vanille|cannelle|cardamome|cacao|chocolat|cafe|cafeine|matcha|muscade|fleur d oranger)\b/,
    sweetener:/\b(miel|sirop d erable|sirop d agave|sirop de fraise|sirop de framboise|grenadine|sirop de peche|sirop de mangue|sirop de passion|sirop de menthe|sirop de citron|sirop de cerise|sucre(?: en poudre| semoule| glace| complet| roux| de coco)?|dattes?|sirop de dattes)\b/,
    fat:/\b(huile d olive|huile|beurre|avocat|amandes?|noix|noisettes?|pistaches?|graines?|chia|chanvre|lin|puree d amande|purée d amande|beurre de cacahuete|cacahuetes?)\b/,
    cheese:/\b(feta|mozzarella|burrata|parmesan|emmental|comte|chevre|fromage de chevre|gorgonzola|roquefort|fromage|st\.? moret|saint moret|philadelphia|cream cheese|fromage frais|ricotta|cottage cheese)\b/,
    freshCheese:/\b(st\.? moret|saint moret|philadelphia|cream cheese|fromage frais|ricotta|cottage cheese)\b/,
    frozenDessert:/\b(glace(?: a la)?(?: vanille| chocolat| cafe| caramel| fraise)?|creme glacee(?: vanille| chocolat| cafe| caramel| fraise)?|boules? (?:de )?glace(?: vanille| chocolat| cafe| caramel| fraise)?|gelato)\b/,
    coffee:/\b(cafe|espresso|ristretto|expresso)\b/,
    liqueur:/\b(amaretto|marsala|baileys|kahlua|liqueur de cafe|liqueur d amande)\b/,
    fruitSyrup:/\b(sirop de fraise|sirop de framboise|grenadine|sirop de peche|sirop de mangue|sirop de passion|sirop de menthe|sirop de citron|sirop de cerise)\b/,
    softDrink:/\b(sprite|7 ?up|seven up|limonade|soda(?: citron)?|eau petillante)\b/,
    olive:/\b(olives?(?: vertes?| noires?)?)\b/,
    sauce:/\b(sauce|moutarde|bechamel|concentre de tomate|puree de tomate|sweet chili|sweet chilli|kecap manis|mayonnaise|pesto|houmous|vinaigre(?: de cidre| de riz| de vin| balsamique)?|citron|citron vert|soja|tamari)\b/,
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
    const pastryDoughs=by('pastryDough');
    const starches=by('starch').filter(x=>!pastryDoughs.some(y=>norm(y)===norm(x))),proteins=by('protein'),savoryProteins=by('savoryProtein'),vegetables=by('vegetable').filter(x=>!FOOD_RX.tomatoPaste.test(norm(x)));
    return {raw,rows,starches,proteins,savoryProteins,vegetables,fishes:by('fish'),seafood:by('seafood'),pulses:by('pulse'),leafy:by('leafy'),freshLeafy:by('freshLeaf'),cupLeaf:by('cupLeaf'),aromatics:by('aromatic'),fruits:by('fruit'),yogurts:by('yogurt'),sweetLiquids:by('sweetLiquid'),fats:by('fat'),cheeses:by('cheese'),freshCheeses:by('freshCheese'),frozenDesserts:by('frozenDessert'),coffees:by('coffee'),liqueurs:by('liqueur'),fruitSyrups:by('fruitSyrup'),softDrinks:by('softDrink'),olives:by('olive'),flatbreadBases:by('flatbreadBase'),pizzaDoughs:by('pizzaDough'),sauces:by('sauce'),herbs:by('herb'),flours:by('flour'),pastryDoughs,dairyCreams:by('dairyCream'),bechamels:by('bechamel'),tomatoPastes:by('tomatoPaste'),sweetChilis:by('sweetChili'),sweetSoys:by('sweetSoy'),breadcrumbs:by('breadcrumb'),quenelles:by('quenelle'),cookingAlcohols:by('cookingAlcohol'),chocolates:by('chocolate'),sugars:by('sugar'),leaveners:by('leavener'),bakerYeasts:by('bakerYeast'),chia:by('chia'),oats:by('oats'),buckwheat:by('buckwheat')};
  }
  const lower=v=>String(v||'').toLocaleLowerCase('fr');
  const cap=v=>{const x=String(v||'');return x?x.charAt(0).toLocaleUpperCase('fr')+x.slice(1):'';};
  const first=(rows)=>rows?.[0]||'';
  const titleJoin=rows=>frenchList((rows||[]).filter(Boolean).map(lower));
  function withArticle(value){
    const v=lower(value),n=norm(value);if(!v)return '';
    if(/^(oeufs|pates|nouilles|lentilles|pois chiches|haricots|crevettes|gambas|tomates|carottes|courgettes|epinards|champignons|pommes de terre|patates douces|frites|pilons|ailes|cuisses|hauts de cuisse|quenelles|biscottes|framboises|myrtilles|fraises|mures|bananes|mangues|poires|pommes|peches|kiwis|oranges|raisins|cerises|boules|morceaux|blancs|filets|paves|escalopes|aiguillettes|tranches|lamelles|cubes|medaillons|feuilles|jeunes pousses)\b/.test(n))return `les ${v}`;
    if(/^(yaourt|skyr|fromage blanc|lait|riz|pain|steak|poulet|boeuf|saumon|thon|tilapia|bar|loup de mer|merlu|merlan|lieu|capitaine|vivaneau|rouget|turbot|haddock|eglefin|aiglefin|hareng|espadon|cabillaud|colin|maquereau|anchois|brochet|mulet|pagre|pageot|poisson|tofu|beurre|cassis|kiwi|raisin|fromage)\b/.test(n))return `le ${v}`;
    if(/^(laitue|salade|roquette|mache|endive|semoule|courgette|tomate|carotte|viande|pate|burrata|creme|feta|mozzarella|dorade|daurade|sole|truite|lotte|sardine|morue|perche|carpe|crevette|palourde|coque|seiche|langouste|langoustine|banane|mangue|poire|pomme|peche|farine|fraise|framboise|myrtille|mure|cerise|glace|creme glacee|vanille|cannelle|cardamome|muscade|fleur d oranger)\b/.test(n))return `la ${v}`;
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
  function breadDisplay(value){
    const n=norm(value);
    if(/bagel/.test(n))return 'Bagel';
    if(/ciabatta/.test(n))return 'Ciabatta';
    if(/panini/.test(n))return 'Panini';
    if(/pita/.test(n))return 'Pain pita';
    if(/baguette/.test(n))return 'Baguette garnie';
    if(/(?:petits? pains?|pains? precuits?)/.test(n))return 'Petit pain chaud';
    return 'Sandwich';
  }
  function freshCheeseDisplay(value){
    const n=norm(value);
    if(/(?:st moret|saint moret)/.test(n))return 'St Môret';
    if(/philadelphia/.test(n))return 'Philadelphia';
    if(/cream cheese/.test(n))return 'cream cheese';
    if(/ricotta/.test(n))return 'ricotta';
    if(/cottage/.test(n))return 'cottage cheese';
    return 'fromage frais';
  }
  function flatbreadDisplay(value){
    const n=norm(value);
    if(/pinsa/.test(n))return 'Pinsa';
    if(/focaccia/.test(n))return 'Focaccia';
    if(/naan/.test(n))return 'Naan';
    if(/flatbread/.test(n))return 'Flatbread';
    if(/bruschetta/.test(n))return 'Bruschetta';
    return 'Pizza';
  }
  function syrupFlavour(value){
    const n=norm(value),pairs=[['fraise','fraise'],['framboise','framboise'],['grenadine','grenadine'],['peche','pêche'],['mangue','mangue'],['passion','passion'],['menthe','menthe'],['citron','citron'],['cerise','cerise']];
    return (pairs.find(([k])=>n.includes(k))||['','fruit'])[1];
  }
  function softDrinkDisplay(value){
    const n=norm(value);
    if(/sprite/.test(n))return 'Sprite';
    if(/7 ?up|seven up/.test(n))return '7UP';
    if(/eau petillante/.test(n))return 'eau pétillante';
    if(/limonade/.test(n))return 'limonade';
    return 'soda citron';
  }
  function affogatoTitle(input){
    const a=analyzeIngredients(input),frozen=first(a.frozenDesserts),liqueur=first(a.liqueurs),n=norm(frozen);
    const flavour=/chocolat/.test(n)?'chocolat':/caramel/.test(n)?'caramel':/cafe/.test(n)?'café':/fraise/.test(n)?'fraise':'vanille';
    return `Affogato ${flavour}${liqueur?` à l’${lower(liqueur)}`:''}`;
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
    if(/fromage frais|st moret|philadelphia|cream cheese/.test(s)&&FOOD_RX.freshCheese.test(n))return true;
    if(/cacao/.test(s)&&/\bcacao\b/.test(n))return true;
    if(/amande/.test(s)&&/\bamandes?\b/.test(n))return true;
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
    if(/\bpoulet entier\b/.test(n))return 'poulet entier';
    if(/\bailes? de poulet\b/.test(n))return 'ailes de poulet';
    if(/\bhauts? de cuisses? de poulet\b/.test(n))return 'hauts de cuisse de poulet';
    if(/\b(?:cuisses?|pilons?) de poulet\b/.test(n))return /pilon/.test(n)?'pilons de poulet':'cuisses de poulet';
    if(/\bescalopes? (?:de )?poulet\b/.test(n))return 'escalopes de poulet';
    if(/\baiguillettes? de poulet\b/.test(n))return 'aiguillettes de poulet';
    if(/\bpav[eé]s? de saumon\b/.test(n))return 'pavés de saumon';
    if(/\bc[oe]ur de saumon\b/.test(n))return 'cœur de saumon';
    if(/\bpoulet\b/.test(n))return 'poulet';
    if(/\blardons?\b/.test(n))return 'lardons';
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
  // V408 · Sept familles précises et leurs synonymes. Cette couche passe avant
  // les familles génériques afin que « Une autre idée » change vraiment de plat.
  function v408Combination(input){
    const n=norm(input),has=re=>re.test(n),miss=rows=>ensureMissingSuggestions(input,rows);
    const pack=(kind,title,missing,preparation,explanation,variants)=>({kind,title,missing:miss(missing),preparation,explanation,variants});
    const flour=has(/\bfarines?\b/),eggs=has(/\b(?:oeufs?|œufs?)\b/),onion=has(/\boignons?\b/);
    if(has(/\b(?:pain de mie|toast|pain complet tranche)\b/)&&has(/\b(?:coulis|sauce|puree|concentre) de tomates?\b/)&&has(/\b(?:mozzarella|emmental|gruyere|comte)(?: rapee?s?)?\b/)&&has(/\b(?:jambon|blanc de dinde|blanc de poulet)\b/)){
      const by={equilibre:['roquette ou salade','champignons ou courgette'],digestion:['courgette ou champignons','basilic ou origan'],energie:['champignons ou maïs','salade ou roquette'],construire:['champignons ou courgette','salade ou roquette'],legerete:['roquette ou salade','courgette ou champignons'],gourmandise:['olives ou champignons','basilic ou origan']};
      return pack('pizza_toast_ham','Pizza-toast jambon, tomate & mozzarella',by[intent]||by.equilibre,'Toaste légèrement le pain, étale une fine couche de coulis, ajoute le jambon puis les fromages. Gratine et ajoute les éléments frais seulement au service.','Cette base correspond à une pizza-toast : Tee ne rajoute ni protéine ni fromage et propose seulement un végétal ou une finition selon ton intention.',[
        {title:'Croque-pizza jambon, tomate & mozzarella',missing:miss(['champignons ou courgette','roquette ou salade']),preparation:'Garnis deux tranches de tomate, jambon et fromage, referme puis fais dorer au four, à la poêle couverte ou dans un appareil à croque.',explanation:`Le format fermé donne un cœur fondant. ${intentReason()}`},
        {title:'Roulés de pain de mie façon pizza',missing:miss(['poivron ou champignons','basilic ou origan']),preparation:'Aplatis les tranches, garnis-les finement, roule-les puis fais-les dorer jointure dessous.',explanation:`Les mêmes ingrédients deviennent des bouchées roulées. ${intentReason()}`},
        {title:'Mini pizzas de pain de mie',missing:miss(['olives ou champignons','salade ou roquette']),preparation:'Découpe le pain en carrés, ajoute coulis, jambon et fromage puis gratine quelques minutes.',explanation:`Le format mini crée une autre proposition. ${intentReason()}`},
        {title:'Croque gratiné jambon-tomate',missing:miss(['courgette ou champignons','salade ou roquette']),preparation:'Monte un croque, couvre le dessus d’un peu de fromage puis gratine. Sers avec le végétal proposé.',explanation:`Le dessus gratiné et le cœur moelleux changent la texture. ${intentReason()}`}
      ]);
    }
    if(has(/\b(?:rumsteck|rumsteak|bavette|faux filet|entrecote|steak|viande de boeuf)\b/)&&has(/\bpetits? pois\b/)&&onion){
      const by={equilibre:['carottes ou champignons','pommes de terre ou riz'],digestion:['carottes ou courgette','riz basmati ou pommes de terre'],energie:['riz ou pommes de terre','champignons ou carottes'],construire:['riz ou quinoa','brocoli ou carottes'],legerete:['champignons ou courgette','salade ou herbes fraîches'],gourmandise:['pommes de terre ou purée','moutarde ou champignons']};
      return pack('steak_peas_onion','Rumsteck poêlé · petits pois aux oignons',by[intent]||by.equilibre,'Saisis le rumsteck à feu vif puis laisse-le reposer. Fais fondre l’oignon et réchauffe les petits pois dans la même poêle. Ajoute le complément à côté sans recuire longuement la viande.','Le rumsteck apporte déjà la protéine et les petits pois avec l’oignon un accompagnement cohérent.',[
        {title:'Émincé de rumsteck · petits pois & oignons',missing:miss(['champignons ou carottes','riz ou pommes de terre']),preparation:'Saisis les fines lamelles, réserve-les, cuis oignon et petits pois puis remets la viande seulement à la fin.',explanation:`La cuisson courte préserve le rumsteck. ${intentReason()}`},
        {title:'Wok de bœuf aux petits pois',missing:miss(['carottes ou champignons','riz ou nouilles']),preparation:'Saisis le bœuf à feu vif, ajoute oignon, petits pois et le végétal proposé puis sers immédiatement.',explanation:`Le wok donne une version vive et croquante. ${intentReason()}`},
        {title:'Bowl rumsteck, petits pois & oignons',missing:miss(['riz ou quinoa','carottes ou concombre']),preparation:'Prépare la base, ajoute oignons et petits pois puis le rumsteck tranché au dernier moment.',explanation:`Le bowl garde les textures séparées. ${intentReason()}`},
        {title:'Rumsteck sauce courte aux oignons',missing:miss(['moutarde ou champignons','pommes de terre ou riz']),preparation:'Saisis et réserve la viande, déglace les oignons avec un peu d’eau et la finition proposée puis remets la viande brièvement.',explanation:`L’oignon devient une sauce courte. ${intentReason()}`}
      ]);
    }
    if(has(/\b(?:caprice des dieux|brie|camembert|coulommiers?|fromage a pate molle)\b/)&&flour&&eggs){
      const by={equilibre:['salade ou épinards','herbes fraîches ou poireau'],digestion:['courgette ou épinards','herbes fraîches'],energie:['lait ou crème','levure chimique'],construire:['épinards ou poireau','lait ou yaourt nature'],legerete:['salade ou courgette','herbes fraîches'],gourmandise:['lait ou crème','noix ou miel']};
      return pack('soft_cheese_flour_eggs','Galettes fondantes au Caprice des Dieux',by[intent]||by.equilibre,'Mélange œufs et farine avec juste assez du liquide proposé. Ajoute le fromage en morceaux, forme de petites galettes puis cuis à feu modéré.','Fromage à pâte molle, farine et œufs peuvent former une vraie préparation salée ; Tee propose ce qui la rend réalisable.',[
        {title:'Cake salé au Caprice des Dieux',missing:miss(['levure chimique','lait ou crème']),preparation:'Mélange farine, levure, œufs et liquide, incorpore le fromage en dés puis cuis dans un moule à cake.',explanation:`Avec liquide et levure, la base devient un cake. ${intentReason()}`},
        {title:'Muffins salés cœur fondant',missing:miss(['levure chimique','épinards ou herbes fraîches']),preparation:'Prépare une pâte salée, ajoute le végétal puis place un morceau de fromage au cœur de chaque muffin.',explanation:`Le fromage devient un cœur coulant individuel. ${intentReason()}`},
        {title:'Croquettes de fromage',missing:miss(['chapelure','salade ou crudités']),preparation:'Passe les bouchées de fromage dans farine, œuf puis chapelure et fais-les dorer.',explanation:`Farine et œuf servent ici de panure. ${intentReason()}`},
        {title:'Quiche sans pâte au fromage',missing:miss(['crème ou lait','poireau ou épinards']),preparation:'Bats œufs, farine et liquide, ajoute le végétal et le fromage puis cuis jusqu’à prise.',explanation:`La base permet une quiche sans fond de tarte. ${intentReason()}`}
      ]);
    }
    if(has(/\b(?:pommes? de terre|patates?)\b/)&&has(/\b(?:viande|boeuf|porc|veau|poulet) hachee?\b|\bsteaks? haches?\b/)&&onion){
      const by={equilibre:['carottes ou courgette','salade ou haricots verts'],digestion:['carottes ou courgette','herbes fraîches'],energie:['petits pois ou carottes','fromage râpé ou herbes fraîches'],construire:['petits pois ou haricots verts','salade ou brocoli'],legerete:['courgette ou salade','herbes fraîches'],gourmandise:['fromage râpé','champignons ou moutarde']};
      return pack('potato_minced_onion','Hachis parmentier · viande hachée & oignon',by[intent]||by.equilibre,'Prépare une purée. Fais revenir l’oignon et la viande jusqu’à cuisson complète, ajoute le végétal choisi, couvre de purée puis gratine.','Pommes de terre, viande hachée et oignon composent déjà un parmentier : Tee complète la garniture sans ajouter une deuxième protéine.',[
        {title:'Poêlée pommes de terre, bœuf & oignon',missing:miss(['courgette ou poivron','herbes fraîches ou moutarde']),preparation:'Dore les pommes de terre, cuis complètement la viande avec l’oignon puis réunis le tout.',explanation:`La poêlée donne une version rapide et texturée. ${intentReason()}`},
        {title:'Pommes de terre farcies à la viande',missing:miss(['champignons ou carottes','salade ou haricots verts']),preparation:'Précuis et évide les pommes de terre, garnis-les de viande cuite à l’oignon puis repasse au four.',explanation:`La pomme de terre devient le contenant. ${intentReason()}`},
        {title:'Boulettes & pommes de terre rôties',missing:miss(['herbes fraîches ou moutarde','carottes ou courgette']),preparation:'Forme et cuis complètement les boulettes, puis sers-les avec pommes de terre et légumes rôtis.',explanation:`Cette variante sépare boulettes et garniture. ${intentReason()}`},
        {title:'Gratin pommes de terre & viande hachée',missing:miss(['crème ou coulis de tomate','courgette ou salade']),preparation:'Alterne pommes de terre et viande cuite à l’oignon, ajoute la liaison proposée puis cuis jusqu’à tendreté.',explanation:`Le gratin donne une version fondante. ${intentReason()}`}
      ]);
    }
    if(has(/\b(?:blancs?|filets?|escalopes?|aiguillettes?) de poulet\b/)&&flour&&eggs&&has(/\bbeurre\b/)&&has(/\bcreme liquide\b/)){
      const by={equilibre:['épinards ou poireau','salade ou tomates'],digestion:['courgette ou épinards','herbes fraîches'],energie:['poireau ou champignons','fromage râpé ou salade'],construire:['épinards ou brocoli','salade ou tomates'],legerete:['courgette ou épinards','salade ou herbes fraîches'],gourmandise:['champignons ou poireau','parmesan ou fromage râpé']};
      return pack('chicken_quiche_base','Quiche sans pâte au poulet',by[intent]||by.equilibre,'Cuis complètement le poulet. Bats œufs, farine et crème, ajoute le poulet et le végétal proposé, verse dans un moule beurré puis cuis jusqu’à prise.','Œufs, farine, crème et beurre forment déjà un appareil salé, et le poulet apporte la protéine.',[
        {title:'Clafoutis salé poulet & légumes',missing:miss(['courgette ou tomates','herbes fraîches']),preparation:'Dispose poulet cuit et végétal dans un plat beurré, couvre d’appareil puis cuis jusqu’à coloration.',explanation:`Une couche fine donne un clafoutis salé. ${intentReason()}`},
        {title:'Mini flans de poulet',missing:miss(['épinards ou poireau','salade ou crudités']),preparation:'Répartis poulet et végétal dans de petits moules, verse l’appareil puis cuis jusqu’à tenue.',explanation:`Le format individuel change la présentation. ${intentReason()}`},
        {title:'Cake salé au poulet',missing:miss(['levure chimique','champignons ou poivron']),preparation:'Ajoute de la levure à la pâte, incorpore poulet cuit et végétal puis cuis en moule à cake.',explanation:`Avec levure, la base devient un cake. ${intentReason()}`},
        {title:'Crêpes salées au poulet crémeux',missing:miss(['lait','champignons ou épinards']),preparation:'Prépare des crêpes puis garnis-les de poulet cuit lié avec crème et végétal.',explanation:`La pâte devient une enveloppe plutôt qu’un appareil au four. ${intentReason()}`}
      ]);
    }
    if(has(/\bchocolat(?: noir)? (?:patissier|dessert|a cuire|de couverture)\b/)&&has(/\bbeurre\b/)&&has(/\bsucre\b/)&&flour&&eggs){
      const by={equilibre:['framboises ou poire','yaourt nature ou fruits frais'],digestion:['poire ou compote','vanille ou cannelle'],energie:['banane ou noix','café ou vanille'],construire:['yaourt grec ou skyr','noisettes ou amandes'],legerete:['framboises ou compote','zeste d’orange ou vanille'],gourmandise:['noisettes ou pépites de chocolat','fleur de sel ou vanille']};
      return pack('chocolate_baking_base','Fondant au chocolat',by[intent]||by.equilibre,'Fais fondre chocolat et beurre. Mélange œufs et sucre, incorpore le chocolat puis la farine sans trop travailler. Adapte la cuisson à la texture souhaitée.','Ces cinq ingrédients forment déjà une base complète de dessert ; Tee varie le format ou l’accompagnement sans promesse nutritionnelle.',[
        {title:'Brownie au chocolat',missing:miss(['noix ou noisettes','fleur de sel ou vanille']),preparation:'Ajoute les noix, étale dans un moule bas et cuis jusqu’à bords pris et centre moelleux.',explanation:`Le moule bas et les fruits à coque orientent vers un brownie. ${intentReason()}`},
        {title:'Moelleux chocolat & poire',missing:miss(['poire','vanille ou cannelle']),preparation:'Ajoute des dés de poire à la pâte puis cuis jusqu’à ce que le centre reste souple.',explanation:`La poire maintient une texture moelleuse. ${intentReason()}`},
        {title:'Cookies tout chocolat',missing:miss(['levure chimique','noisettes ou pépites de chocolat']),preparation:'Travaille beurre et sucre, ajoute œuf, farine, chocolat et levure puis forme et cuis brièvement les cookies.',explanation:`Une pâte plus ferme donne des cookies. ${intentReason()}`},
        {title:'Muffins au chocolat',missing:miss(['levure chimique','framboises ou banane']),preparation:'Ajoute levure et fruit, répartis en moules puis cuis jusqu’à prise.',explanation:`Le format muffin apporte une autre texture. ${intentReason()}`}
      ]);
    }
    if(has(/\bthon\b/)&&onion&&has(/\bpoivrons?\b/)){
      const by={equilibre:['tomates ou courgette','riz ou pommes de terre'],digestion:['courgette ou tomates','riz basmati ou pommes de terre'],energie:['riz ou pâtes','maïs ou tomates'],construire:['riz ou quinoa','haricots rouges ou tomates'],legerete:['tomates ou concombre','herbes fraîches ou citron'],gourmandise:['pâtes ou pommes de terre','olives ou fromage râpé']};
      return pack('tuna_onion_pepper','Poêlée de thon · poivron & oignon',by[intent]||by.equilibre,'Fais revenir oignon puis poivron. Ajoute le végétal ou la sauce choisi, puis incorpore le thon égoutté seulement à la fin pour ne pas le dessécher.','Ce trio forme déjà une base identifiable ; Tee choisit ensuite féculent, végétal ou finition sans proposer une autre protéine.',[
        {title:'Poivrons farcis au thon',missing:miss(['riz ou quinoa','tomates ou herbes fraîches']),preparation:'Mélange thon, oignon revenu, base et tomate, garnis les demi-poivrons puis cuis au four.',explanation:`Le poivron devient le contenant. ${intentReason()}`},
        {title:'Bowl de riz au thon & poivrons',missing:miss(['riz ou quinoa','avocat ou tomates']),preparation:'Fais revenir oignon et poivron, dispose sur la base puis ajoute thon et finition fraîche.',explanation:`Le bowl garde le thon moelleux. ${intentReason()}`},
        {title:'Pâtes au thon, poivron & oignon',missing:miss(['pâtes ou coquillettes','coulis de tomate ou crème']),preparation:'Transforme oignon et poivron en sauce, mélange aux pâtes puis incorpore le thon à la fin.',explanation:`La poêlée devient une sauce pour pâtes. ${intentReason()}`},
        {title:'Salade tiède thon-poivron',missing:miss(['tomates ou concombre','pommes de terre ou pois chiches']),preparation:'Laisse tiédir oignon et poivron, ajoute thon, crudités et base puis termine avec citron ou herbes.',explanation:`Cette version évite une cuisson prolongée du thon. ${intentReason()}`}
      ]);
    }
    return null;
  }
  function ingredientFamilyCombination(input){
    const v408=v408Combination(input);if(v408)return v408;
    const a=analyzeIngredients(input),n=norm(input);
    const has=re=>re.test(n),miss=rows=>ensureMissingSuggestions(input,rows),firstBy=(rows,re)=>first((rows||[]).filter(x=>re.test(norm(x))));
    const potato=firstBy(a.starches,/pommes? de terre|patates?/),pasta=firstBy(a.starches,/pates?|spaghetti|tagliatelle|penne|macaroni|coquillette/);
    const pastry=first(a.pastryDoughs),cream=first(a.dairyCreams),wine=first(a.cookingAlcohols),cheese=first(a.cheeses);
    const groundBeef=first(a.raw.filter(x=>/boeuf hache|steak hache|viande hachee/.test(norm(x))));
    const wings=first(a.raw.filter(x=>/ailes? de poulet/.test(norm(x))));
    const hasOnion=has(/\boignons?\b/),hasGarlic=has(/\bail\b/),hasTomato=has(/\btomates?\b/),hasAvocado=has(/\bavocat\b/),hasBurrata=has(/\bburrata\b/),hasEggplant=has(/\baubergines?\b/),hasZucchini=has(/\bcourgettes?\b/);
    const hasLardons=has(/\b(?:lardons?|bacon|pancetta)\b/),hasCocoa=a.chocolates.length&&has(/\b(?:cacao|chocolat)\b/),hasSugar=a.sugars.length>0;
    const hasOliveOil=has(/\bhuile d olive\b/),hasSunflower=has(/\bhuile de tournesol\b/),hasButter=has(/\bbeurre\b/),hasMilk=has(/\blait(?: entier| demi ecreme| ecreme)?\b/);
    const isFeuilletee=pastry&&/feuilletee/.test(norm(pastry)),isBrisee=pastry&&/brisee/.test(norm(pastry)),isSablee=pastry&&/sablee/.test(norm(pastry));
    const flatbread=first(a.flatbreadBases),pizzaDough=first(a.pizzaDoughs),fruitSyrup=first(a.fruitSyrups),softDrink=first(a.softDrinks),olive=first(a.olives);
    const cucumber=first(a.raw.filter(x=>/\bconcombres?\b/.test(norm(x)))),corn=first(a.raw.filter(x=>/\bmais\b/.test(norm(x))));
    const hasRedOnion=has(/\boignons? rouges?\b/),hasShallot=has(/\bechalotes?\b/),hasChives=has(/\bciboulette\b/),hasVinegar=has(/\bvinaigre\b/),hasOlives=a.olives.length>0;
    const chicken=first(a.raw.filter(x=>/\bpoulet\b/.test(norm(x))));
    // V405 · familles et ingrédients structurants supplémentaires.
    const wholeChicken=first(a.raw.filter(x=>/\b(?:poulet entier|poulet fermier(?: entier)?|coquelet|pintade entiere)\b/.test(norm(x))));
    const tomatoPaste=first(a.tomatoPastes),bechamel=first(a.bechamels),breadcrumbs=first(a.breadcrumbs),quenelle=first(a.quenelles);
    const ham=first(a.raw.filter(x=>/\bjambon(?: blanc| de dinde| de poulet)?\b/.test(norm(x))));
    const salmonPiece=first(a.raw.filter(x=>/\b(?:paves? de saumon|filets? de saumon|coeur de saumon|dos de saumon|saumon)\b/.test(norm(x))));
    const stickyChicken=first(a.raw.filter(x=>/\b(?:pilons? de poulet|cuisses? de poulet|hauts? de cuisses? de poulet|ailes? de poulet)\b/.test(norm(x))));
    const tomatoFresh=first(a.raw.filter(x=>/\btomates?(?: cerises?)?\b/.test(norm(x))&&!FOOD_RX.tomatoPaste.test(norm(x))));
    const cucumberFresh=first(a.raw.filter(x=>/\bconcombres?\b/.test(norm(x))));
    const greenPepper=first(a.raw.filter(x=>/\bpoivrons? vert(?:s)?\b/.test(norm(x))));
    const anyPepperFresh=first(a.raw.filter(x=>/\bpoivrons?(?: verts?| rouges?| jaunes?)?\b/.test(norm(x))));
    const seafoodMix=first(a.raw.filter(x=>/\b(?:fruits? de mer|cocktail de fruits? de mer|melange de fruits? de mer)\b/.test(norm(x))));
    const chickenEscalope=first(a.raw.filter(x=>/\b(?:escalopes? (?:de )?poulet|aiguillettes? de poulet)\b/.test(norm(x))));
    // V406 · pains crémeux, mini pains, ailes moutarde, rôti de bœuf et bases sucrées.
    const breadCreamBase=first(a.raw.filter(x=>/\b(?:pain (?:a )?panini|panini|ciabatta|baguette|petits? pains?|mini pains?|buns?)\b/.test(norm(x))));
    const parmesanLike=first(a.cheeses.filter(x=>/\b(?:parmesan|emmental|comte|mozzarella|chevre|ricotta)\b/.test(norm(x))));
    const miniBread=first(a.raw.filter(x=>/\b(?:mini pains?|petits? pains?)\b/.test(norm(x))));
    const mustardWings=first(a.raw.filter(x=>/\bailes? de poulet\b/.test(norm(x))));
    const roastBeef=first(a.raw.filter(x=>/\b(?:roti de boeuf|rosbif|roast beef)\b/.test(norm(x))));
    const darkChocolate=first(a.raw.filter(x=>/\bchocolat (?:noir|patissier|dessert|de couverture)\b/.test(norm(x))));
    const leavener=first(a.leaveners),bakerYeast=first(a.bakerYeasts);

    const rice=firstBy(a.starches,/\briz(?: basmati)?\b/),eggs=first(a.raw.filter(x=>/\b(?:oeufs?|œufs?)\b/.test(norm(x))));
    const tuna=first(a.raw.filter(x=>/\bthon\b/.test(norm(x)))),lime=first(a.raw.filter(x=>/\bcitron vert\b/.test(norm(x))));
    const beef=first(a.raw.filter(x=>/\b(?:boeuf|bœuf|steak)\b/.test(norm(x)))),pepper=first(a.raw.filter(x=>/\bpoivrons?\b/.test(norm(x))));
    const salmon=first(a.raw.filter(x=>/\bsaumon\b/.test(norm(x)))),carrot=first(a.raw.filter(x=>/\bcarottes?\b/.test(norm(x)))),broccoli=first(a.raw.filter(x=>/\bbrocolis?\b/.test(norm(x))));
    const almondPowder=first(a.raw.filter(x=>/\b(?:poudre d amandes?|amandes? en poudre|poudre d amande)\b/.test(norm(x))));
    const ricotta=first(a.raw.filter(x=>/\bricotta\b/.test(norm(x)))),cabbage=first(a.raw.filter(x=>/\b(?:chou|choux)(?: vert| blanc| rouge)?\b/.test(norm(x))));

    // V406 · Pain/panini + crème fraîche + fromage : vraie base blanche chaude.
    if(breadCreamBase&&cream&&parmesanLike){
      const breadN=norm(breadCreamBase),breadTitle=/panini/.test(breadN)?'Panini':/ciabatta/.test(breadN)?'Ciabatta':/baguette/.test(breadN)?'Baguette chaude':/mini|petit/.test(breadN)?'Petit pain chaud':'Pain chaud';
      const cheeseName=/parmesan/.test(norm(parmesanLike))?'parmesan':/emmental/.test(norm(parmesanLike))?'emmental':/comte/.test(norm(parmesanLike))?'comté':/mozzarella/.test(norm(parmesanLike))?'mozzarella':/ricotta/.test(norm(parmesanLike))?'ricotta':'chèvre';
      const missingBy={equilibre:['champignons ou roquette','tomates ou salade'],digestion:['courgette ou roquette','herbes fraîches ou citron'],energie:['poulet ou jambon','tomates ou champignons'],construire:['poulet ou jambon','salade ou tomates'],legerete:['roquette ou tomates','courgette ou champignons'],gourmandise:['champignons ou oignon','pesto ou tomates cerises']};
      const variants=[
        {title:`${breadTitle} crème-${cheeseName} & champignons`,missing:miss(['champignons','roquette ou salade']),preparation:`Étale une fine couche de crème fraîche sur ${withArticle(breadCreamBase)}, ajoute les champignons poêlés puis le ${cheeseName}. Passe au four ou au grill jusqu’à ce que le pain soit croustillant et ajoute les feuilles seulement au service.`,explanation:`Crème et ${cheeseName} forment déjà une garniture blanche. Les champignons donnent une version chaude plus complète. ${intentReason()}`},
        {title:`${breadTitle} blanc · courgette & ${cheeseName}`,missing:miss(['courgette','herbes fraîches ou citron']),preparation:`Dépose une fine couche de crème, ajoute de fines lamelles de courgette puis le ${cheeseName}. Gratine et termine avec les herbes proposées.`,explanation:`La courgette apporte une garniture végétale légère sans changer la base blanche. ${intentReason()}`},
        {title:`${breadTitle} poulet · crème & ${cheeseName}`,missing:miss(['poulet','roquette ou tomates']),preparation:`Garnis le pain de crème, de poulet déjà cuit et de ${cheeseName}, puis chauffe jusqu’à ce que le fromage fonde. Ajoute roquette ou tomates après cuisson.`,explanation:`Cette variante transforme la base en sandwich chaud plus rassasiant. ${intentReason()}`},
        {title:`${breadTitle} tomate-${cheeseName}`,missing:miss(['tomates ou tomates cerises','basilic ou herbes fraîches']),preparation:`Étale très peu de crème, ajoute les tomates et le ${cheeseName}, puis gratine. Termine avec le basilic ou les herbes hors du four.`,explanation:`La tomate donne une version plus fraîche et acidulée de la garniture blanche. ${intentReason()}`},
        {title:`${breadTitle} façon garlic bread au ${cheeseName}`,missing:miss(['ail','persil ou ciboulette']),preparation:`Mélange un peu de crème avec l’ail proposé, étale sur le pain, parsème de ${cheeseName} puis gratine. Termine avec les herbes fraîches.`,explanation:`Le pain devient une version garlic bread gratinée, réellement différente du panini garni. ${intentReason()}`}
      ];
      return {kind:'bread_cream_cheese',title:`${breadTitle} blanc · crème & ${cheeseName}`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Étale une couche fine de crème fraîche sur ${withArticle(breadCreamBase)}, ajoute le ${cheeseName} puis chauffe au four, au grill ou dans un appareil à panini jusqu’à ce que le pain soit croustillant. Ajoute les éléments frais proposés seulement après la chauffe.`,explanation:`Tee reconnaît une base de pain chaud avec une garniture blanche crème-fromage. « À prévoir » sert donc à ajouter végétal, fraîcheur ou protéine selon l’intention, sans proposer un nouveau féculent.`,variants};
    }

    // V406 · Mini pains + huile + oignon : tartines/focaccia mini plutôt qu'assiette générique.
    if(miniBread&&(hasOliveOil||hasSunflower)&&hasOnion){
      const oilName=hasOliveOil?'huile d’olive':'huile de tournesol';
      const missingBy={equilibre:['tomates ou roquette','herbes fraîches ou citron'],digestion:['herbes fraîches ou citron','courgette ou tomates'],energie:['mozzarella ou feta','tomates ou poivron'],construire:['poulet ou thon','tomates ou salade'],legerete:['tomates ou salade','herbes fraîches ou citron'],gourmandise:['mozzarella ou parmesan','ail ou herbes fraîches']};
      const variants=[
        {title:'Mini pains oignon & herbes',missing:miss(['thym ou romarin','tomates ou salade']),preparation:`Badigeonne très légèrement les mini pains de ${oilName}, ajoute l’oignon finement émincé et les herbes puis passe au four jusqu’à ce que les bords soient croustillants.`,explanation:`Les herbes renforcent la version oignon sans surcharger les pains. ${intentReason()}`},
        {title:'Mini bruschettas oignon & tomate',missing:miss(['tomates','basilic ou herbes fraîches']),preparation:`Toaste les mini pains avec un filet de ${oilName}, ajoute l’oignon puis les tomates en petits dés. Remets quelques minutes au four et termine avec le basilic.`,explanation:`Le même pain devient une mini bruschetta grâce à la tomate. ${intentReason()}`},
        {title:'Mini pains ail-oignon croustillants',missing:miss(['ail','persil ou ciboulette']),preparation:`Mélange un filet de ${oilName} avec l’ail, répartis sur les mini pains puis ajoute l’oignon. Fais griller et termine avec les herbes.`,explanation:`L’ail transforme la base en mini garlic breads à l’oignon. ${intentReason()}`},
        {title:'Mini pains gratinés oignon & fromage',missing:miss(['mozzarella ou parmesan','salade ou tomates']),preparation:`Ajoute l’oignon sur les mini pains légèrement huilés, parsème du fromage proposé puis gratine. Sers les crudités à côté ou après cuisson.`,explanation:`Cette variante mise sur une finition gratinée et plus gourmande. ${intentReason()}`},
        {title:'Mini pains façon sandwich oignon & poulet',missing:miss(['poulet ou jambon','salade ou tomates']),preparation:`Réchauffe les mini pains avec l’oignon, puis garnis-les avec la protéine proposée et les crudités seulement après la chauffe.`,explanation:`Les mini pains deviennent de petits sandwichs complets plutôt qu’un simple accompagnement. ${intentReason()}`}
      ];
      return {kind:'mini_bread_onion_oil',title:`Mini pains à l’oignon & ${oilName}`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Badigeonne très légèrement les mini pains de ${oilName}, ajoute l’oignon finement émincé puis fais-les dorer au four. Ajoute la finition proposée au moment adapté, en gardant salade et herbes fraîches hors cuisson.`,explanation:`Mini pains, huile et oignon forment déjà une base de pain chaud aromatisé. Tee complète la garniture au lieu de traiter l’huile comme un ingrédient principal.`,variants};
    }

    // V406 · Ailes de poulet + moutarde + huile : marinade/rôtissage en conservant la pièce exacte.
    if(mustardWings&&has(/\bmoutarde\b/)&&(hasSunflower||hasOliveOil)){
      const oilName=hasSunflower?'huile de tournesol':'huile d’olive';
      const missingBy={equilibre:['salade ou légumes rôtis','pommes de terre ou riz'],digestion:['courgette ou fenouil','citron ou herbes fraîches'],energie:['pommes de terre ou riz','poivron ou courgette'],construire:['riz ou quinoa','brocoli ou haricots verts'],legerete:['salade ou concombre','citron ou herbes fraîches'],gourmandise:['pommes de terre grenailles ou frites au four','miel ou paprika']};
      const variants=[
        {title:'Ailes de poulet moutarde-citron',missing:miss(['citron','salade ou courgette']),preparation:`Mélange moutarde, citron et un petit filet de ${oilName}, enrobe les ailes puis rôtis-les jusqu’à cuisson complète et peau bien dorée.`,explanation:`Le citron allège la marinade moutardée et donne une version plus vive. ${intentReason()}`},
        {title:'Ailes de poulet moutarde & paprika',missing:miss(['paprika','pommes de terre ou salade']),preparation:`Mélange moutarde, paprika et ${oilName}, enrobe les ailes puis cuis-les au four en les retournant à mi-cuisson.`,explanation:`Le paprika donne une version plus rôtie et épicée sans changer la base. ${intentReason()}`},
        {title:'Ailes de poulet moutarde-miel',missing:miss(['miel','salade ou crudités']),preparation:`Mélange moutarde avec une petite quantité de miel et un filet de ${oilName}. Badigeonne les ailes et surveille la fin de cuisson pour éviter que le glaçage ne brûle.`,explanation:`Le miel transforme la moutarde en laquage sucré-salé. ${intentReason()}`},
        {title:'Ailes de poulet ail & moutarde',missing:miss(['ail','herbes fraîches ou citron']),preparation:`Mélange moutarde, ail et ${oilName}, enrobe les ailes puis rôtis-les jusqu’à cuisson complète. Termine avec les herbes proposées.`,explanation:`L’ail donne une marinade plus aromatique et très différente de la version miel. ${intentReason()}`},
        {title:'Ailes de poulet moutarde & pommes grenailles',missing:miss(['pommes de terre grenailles','romarin ou thym']),preparation:`Enrobe les ailes de moutarde et ${oilName}. Ajoute les grenailles assaisonnées sur la plaque et rôtis en tenant compte du temps de cuisson de chaque élément.`,explanation:`La plaque de grenailles transforme la préparation en repas au four complet. ${intentReason()}`}
      ];
      return {kind:'mustard_wings_oil',title:'Ailes de poulet rôties à la moutarde',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Mélange la moutarde avec un petit filet de ${oilName}, enrobe les ailes de poulet puis cuis-les au four jusqu’à ce qu’elles soient bien dorées et complètement cuites à cœur. Ajoute l’accompagnement proposé selon son temps de cuisson.`,explanation:`La moutarde et l’huile constituent déjà une marinade de cuisson. Tee conserve « ailes de poulet » comme pièce exacte et utilise « À prévoir » pour compléter le repas.`,variants};
    }

    // V406 · Rôti de bœuf + grenailles + huile d'olive : plat rôti complet.
    if(roastBeef&&potato&&/grenaille/.test(norm(potato))&&hasOliveOil){
      const missingBy={equilibre:['haricots verts ou salade','ail ou romarin'],digestion:['carottes ou courgette','thym ou romarin'],energie:['poivron ou carottes','ail ou thym'],construire:['brocoli ou haricots verts','moutarde ou herbes fraîches'],legerete:['salade ou haricots verts','citron ou herbes fraîches'],gourmandise:['moutarde ou sauce au poivre','ail ou romarin']};
      const variants=[
        {title:'Rôti de bœuf & grenailles ail-romarin',missing:miss(['ail ou romarin','haricots verts ou salade']),preparation:'Assaisonne le rôti, dispose les grenailles autour avec l’huile d’olive, l’ail et le romarin puis cuis au four. Laisse reposer la viande avant de la trancher.',explanation:`Ail et romarin donnent une version très classique et aromatique du rôti. ${intentReason()}`},
        {title:'Rôti de bœuf moutardé & pommes grenailles',missing:miss(['moutarde','salade ou haricots verts']),preparation:'Badigeonne légèrement le rôti de moutarde, huile les grenailles puis cuis au four. Laisse reposer la viande avant découpe et sers avec le végétal proposé.',explanation:`La moutarde crée une croûte aromatique différente de la version simple à l’huile. ${intentReason()}`},
        {title:'Rôti de bœuf, grenailles & légumes rôtis',missing:miss(['carottes ou courgette','thym ou romarin']),preparation:'Ajoute les légumes proposés aux grenailles en tenant compte de leur temps de cuisson, puis cuis le rôti et les accompagnements au four. Laisse reposer la viande avant de servir.',explanation:`Cette variante transforme la plaque en repas complet avec davantage de légumes. ${intentReason()}`},
        {title:'Salade tiède de grenailles & rôti de bœuf',missing:miss(['salade ou roquette','moutarde ou citron']),preparation:'Rôtis les grenailles à l’huile d’olive. Tranche finement le rôti cuit et reposé, puis assemble avec les feuilles et l’assaisonnement proposés quand les pommes de terre sont tièdes.',explanation:`Le rôti et les grenailles deviennent une salade tiède, très différente du plat au four. ${intentReason()}`},
        {title:'Rôti de bœuf & grenailles sauce herbes',missing:miss(['persil ou ciboulette','moutarde ou citron']),preparation:'Fais cuire le rôti et les grenailles à l’huile d’olive. Prépare une finition aux herbes avec la moutarde ou le citron proposé et ajoute-la au service.',explanation:`La sauce d’herbes change la finition sans ajouter de nouvelle base. ${intentReason()}`}
      ];
      return {kind:'roast_beef_grenaille',title:'Rôti de bœuf & pommes grenailles rôties',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Assaisonne le rôti de bœuf. Mélange les pommes grenailles avec un filet d’huile d’olive, dispose-les autour ou sur une plaque séparée selon la cuisson voulue, puis cuis. Laisse toujours reposer le rôti avant de le trancher.',explanation:'Tee reconnaît ici un plat de rôti complet : le bœuf apporte la protéine, les grenailles la base énergétique et l’huile d’olive sert à la cuisson. « À prévoir » vise donc surtout les légumes et aromates.',variants};
    }

    // V406 · Chocolat noir/pâtissier + œufs + sucre : dessert chocolaté identifiable.
    if(darkChocolate&&eggs&&hasSugar){
      const missingBy={equilibre:['fruits rouges ou poire','vanille ou cannelle'],digestion:['vanille ou cardamome','fruits rouges ou poire'],energie:['banane ou amandes','vanille ou cannelle'],construire:['skyr ou yaourt grec à côté','amandes ou noisettes'],legerete:['fruits rouges ou orange','vanille ou cannelle'],gourmandise:['noisettes ou amandes','crème fouettée ou caramel']};
      const variants=[
        {title:'Mousse au chocolat noir & vanille',missing:miss(['vanille','fruits rouges ou poire']),preparation:'Fais fondre le chocolat et laisse-le tiédir. Sépare les œufs, mélange les jaunes avec le chocolat et une partie du sucre, monte les blancs puis incorpore-les délicatement. Ajoute la vanille et réserve au frais.',explanation:`La vanille parfume la mousse sans changer sa structure. ${intentReason()}`},
        {title:'Fondant au chocolat noir',missing:miss(['beurre','farine']),preparation:'Fais fondre le chocolat avec le beurre proposé, ajoute les œufs et le sucre puis une petite quantité de farine. Verse dans un moule et cuis juste assez pour garder le cœur fondant.',explanation:`Avec beurre et farine, le trio devient un fondant cuit plutôt qu’une mousse. ${intentReason()}`},
        {title:'Brownie au chocolat noir',missing:miss(['beurre ou huile neutre','farine ou poudre d’amande']),preparation:'Mélange chocolat fondu, matière grasse, œufs et sucre, puis incorpore la farine ou la poudre d’amande proposée. Cuis en couche épaisse puis laisse refroidir avant découpe.',explanation:`La matière grasse et la farine transforment la base en brownie dense. ${intentReason()}`},
        {title:'Crème chocolat noir',missing:miss(['lait ou crème liquide','vanille ou cannelle']),preparation:'Fais chauffer le lait ou la crème, verse sur le chocolat puis incorpore doucement les œufs battus avec le sucre. Fais épaissir à feu doux sans faire bouillir.',explanation:`Le lait ou la crème transforme le trio en dessert à la cuillère. ${intentReason()}`},
        {title:'Soufflé chocolat noir',missing:miss(['beurre','farine ou maïzena']),preparation:'Prépare une base chocolatée liée avec le beurre et la farine proposés, ajoute les jaunes puis incorpore délicatement les blancs montés. Enfourne et sers dès la sortie du four.',explanation:`Le soufflé utilise les mêmes œufs autrement et donne une texture aérienne servie chaude. ${intentReason()}`}
      ];
      return {kind:'dark_chocolate_egg_sugar',title:'Mousse au chocolat noir',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Fais fondre le chocolat noir puis laisse-le tiédir. Sépare les œufs : mélange les jaunes avec le chocolat et le sucre, monte les blancs en neige puis incorpore-les délicatement. Réserve au froid et utilise des œufs très frais ; choisis une variante cuite si tu préfères éviter les œufs crus.',explanation:'Chocolat noir, œufs et sucre constituent déjà une mousse au chocolat complète. Tee reste donc dans l’univers dessert et utilise « À prévoir » pour une finition ou une autre transformation.',variants};
    }

    // V406 · Œufs + lait + sucre : crème/flan, pas assiette protéinée salée.
    if(eggs&&a.sweetLiquids.length&&hasSugar&&!a.flours.length&&!darkChocolate){
      const milkBase=first(a.sweetLiquids),milkName=/avoine/.test(norm(milkBase))?'lait d’avoine':/amande/.test(norm(milkBase))?'lait d’amande':/soja/.test(norm(milkBase))?'lait de soja':'lait';
      const missingBy={equilibre:['vanille ou cannelle','fruits rouges ou poire'],digestion:['vanille ou cardamome','cannelle ou muscade'],energie:['banane ou raisins secs','vanille ou cannelle'],construire:['amandes ou noisettes','skyr ou yaourt grec à côté'],legerete:['fruits rouges ou orange','vanille ou cannelle'],gourmandise:['vanille ou caramel','noix de coco ou amandes']};
      const variants=[
        {title:'Œufs au lait vanillés',missing:miss(['vanille','cannelle ou muscade']),preparation:`Fais chauffer le ${milkName} avec la vanille, bats les œufs avec le sucre puis verse le lait chaud progressivement. Répartis dans des ramequins et cuis doucement au bain-marie.`,explanation:`La vanille donne la version la plus classique des œufs au lait. ${intentReason()}`},
        {title:'Flan aux œufs maison',missing:miss(['vanille','maïzena ou farine']),preparation:`Bats les œufs avec le sucre, ajoute le ${milkName} puis la vanille. Pour un flan plus ferme, incorpore un peu de maïzena ou farine et cuis au four jusqu’à prise.`,explanation:`La cuisson plus ferme transforme la crème en flan. ${intentReason()}`},
        {title:'Crème caramel aux œufs',missing:miss(['sucre pour caramel ou sirop d’érable','vanille']),preparation:`Prépare un caramel au fond des ramequins, puis verse dessus le mélange œufs, sucre et ${milkName}. Cuis au bain-marie et laisse refroidir avant de démouler.`,explanation:`Le caramel change la finition et la présentation du dessert. ${intentReason()}`},
        {title:'Pain perdu sucré',missing:miss(['pain ou brioche','cannelle ou vanille']),preparation:`Bats les œufs avec le ${milkName}, le sucre et l’arôme proposé. Trempe le pain puis fais-le dorer à la poêle.`,explanation:`Le même mélange devient un appareil à pain perdu dès qu’on ajoute une base de pain. ${intentReason()}`},
        {title:'Crêpes sucrées',missing:miss(['farine','vanille ou fleur d’oranger']),preparation:`Ajoute la farine proposée au mélange œufs, ${milkName} et sucre jusqu’à obtenir une pâte fluide. Laisse reposer brièvement puis cuis en crêpes fines.`,explanation:`L’ajout de farine transforme complètement la base en pâte à crêpes. ${intentReason()}`}
      ];
      return {kind:'egg_milk_sugar',title:'Crème aux œufs maison',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Bats les œufs avec le sucre. Fais chauffer doucement le ${milkName}, verse-le progressivement sur les œufs en mélangeant puis répartis dans des ramequins. Cuis doucement au bain-marie jusqu’à prise, puis laisse refroidir.`,explanation:'Œufs, lait et sucre forment déjà un appareil de crème/flan. Tee évite donc de classer les œufs comme une protéine salée et reste dans une préparation dessert.',variants};
    }

    // V406 · Farine + sucre + levure : base de gâteau ou brioche selon le type de levure.
    if(a.flours.length&&hasSugar&&leavener){
      const isBaker=!!bakerYeast||/boulanger/.test(norm(leavener));
      if(isBaker){
        const missingBy={equilibre:['lait ou boisson végétale','œufs ou yaourt'],digestion:['lait ou boisson végétale','fleur d’oranger ou vanille'],energie:['lait','beurre ou huile neutre'],construire:['œufs','lait ou yaourt'],legerete:['lait ou boisson végétale','compote sans sucre ou yaourt'],gourmandise:['beurre','œufs ou lait']};
        const variants=[
          {title:'Brioche maison',missing:miss(['lait','beurre et œufs']),preparation:'Mélange farine, sucre et levure boulangère. Ajoute le lait tiède, les œufs puis le beurre, pétris et laisse lever avant façonnage et cuisson.',explanation:`La levure boulangère oriente clairement vers une pâte levée. ${intentReason()}`},
          {title:'Petits pains briochés',missing:miss(['lait','beurre ou huile neutre']),preparation:'Prépare une pâte souple avec farine, sucre, levure, lait et matière grasse. Laisse lever, façonne de petits pains puis cuis jusqu’à coloration.',explanation:`Le façonnage en petits pains donne une variante individuelle de la pâte levée. ${intentReason()}`},
          {title:'Brioche roulée cannelle',missing:miss(['beurre','cannelle']),preparation:'Prépare et laisse lever la pâte briochée, étale-la puis ajoute beurre et cannelle avant de rouler, découper et laisser lever une seconde fois.',explanation:`Le roulage et la cannelle donnent une utilisation totalement différente de la même pâte. ${intentReason()}`},
          {title:'Pain au lait sucré',missing:miss(['lait','beurre']),preparation:'Ajoute lait et beurre à la base farine-sucre-levure, pétris puis laisse lever. Façonne en petits pains et cuis jusqu’à ce qu’ils soient dorés.',explanation:`Cette variante reste simple et mise sur une mie souple. ${intentReason()}`}
        ];
        return {kind:'flour_sugar_baker_yeast',title:'Pâte briochée à compléter',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Mélange farine, sucre et levure boulangère. Ajoute ensuite le liquide et les éléments enrichissants proposés, pétris puis laisse lever avant façonnage et cuisson.',explanation:'Tee distingue la levure boulangère d’une levure chimique : cette combinaison devient donc une pâte levée plutôt qu’un gâteau minute.',variants};
      }
      const missingBy={equilibre:['œufs','lait ou yaourt + beurre ou huile neutre'],digestion:['œufs','yaourt ou compote + huile neutre'],energie:['œufs','lait + beurre ou huile neutre'],construire:['œufs','yaourt grec ou lait + huile neutre'],legerete:['œufs','compote sans sucre ou yaourt'],gourmandise:['œufs','beurre + lait ou crème']};
      const variants=[
        {title:'Gâteau moelleux nature',missing:miss(['œufs','lait ou yaourt + beurre ou huile neutre']),preparation:'Mélange farine, sucre et levure. Ajoute les œufs puis le lait ou yaourt et la matière grasse proposés, verse dans un moule et cuis jusqu’à ce que le centre soit pris.',explanation:`Les ingrédients secs deviennent un appareil à gâteau dès que les éléments humides sont ajoutés. ${intentReason()}`},
        {title:'Muffins nature',missing:miss(['œufs','lait ou yaourt + huile neutre']),preparation:'Mélange séparément les ingrédients secs et humides, réunis-les sans trop travailler puis répartis dans des moules à muffins et cuis.',explanation:`La même base devient des portions individuelles et plus rapides à cuire. ${intentReason()}`},
        {title:'Pancakes moelleux',missing:miss(['œufs','lait ou yaourt']),preparation:'Ajoute œufs et lait ou yaourt à la farine, au sucre et à la levure pour obtenir une pâte épaisse. Fais cuire de petits pancakes à la poêle.',explanation:`Avec un appareil plus épais et une cuisson à la poêle, la base devient des pancakes. ${intentReason()}`},
        {title:'Cake vanillé',missing:miss(['œufs','beurre ou huile neutre + vanille']),preparation:'Ajoute œufs, matière grasse et vanille à la base sèche, détends avec un peu de lait si nécessaire puis cuis dans un moule à cake.',explanation:`La vanille et la cuisson en moule allongé donnent une variante de cake. ${intentReason()}`},
        {title:'Petits biscuits levés',missing:miss(['beurre','œufs ou lait']),preparation:'Sable la farine, le sucre et la levure avec le beurre, ajoute juste assez d’œuf ou de lait pour lier, puis forme de petits biscuits et cuis jusqu’à légère coloration.',explanation:`Une pâte plus ferme transforme la même base sèche en biscuits. ${intentReason()}`}
      ];
      return {kind:'flour_sugar_leavener',title:'Base de gâteau moelleux à compléter',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Mélange la farine, le sucre et la levure. Ajoute ensuite les éléments humides proposés pour former une pâte homogène, puis choisis une cuisson en gâteau, muffins ou pancakes selon la texture voulue.',explanation:'Farine, sucre et levure constituent déjà une base pâtissière sèche. Tee reste donc dans l’univers dessert et propose les éléments humides réellement nécessaires au lieu d’une assiette salée.',variants};
    }

    // V405 · Volaille entière + moutarde + concentré/purée de tomate.
    if(wholeChicken&&has(/\bmoutarde\b/)&&tomatoPaste){
      const nWhole=norm(wholeChicken),bird=/coquelet/.test(nWhole)?'Coquelet':/pintade/.test(nWhole)?'Pintade':'Poulet entier';
      const birdLower=lower(bird),birdArt=/pintade/.test(nWhole)?`la ${birdLower}`:`le ${birdLower}`;
      const missingBy={equilibre:['pommes de terre ou légumes rôtis','ail ou thym'],digestion:['courgette ou fenouil','thym ou romarin'],energie:['pommes de terre ou riz','oignon ou poivron'],construire:['pommes de terre ou quinoa','légumes verts ou tomates'],legerete:['courgette ou salade','herbes fraîches ou citron'],gourmandise:['pommes de terre grenailles ou pain','ail ou romarin']};
      const variants=[
        {title:`${bird} rôti · moutarde, tomate & oignons`,missing:miss(['oignon','pommes de terre ou légumes rôtis']),preparation:`Mélange moutarde et concentré de tomate avec un petit trait d’eau ou d’huile. Badigeonne ${birdArt}, ajoute l’oignon autour puis rôtis jusqu’à cuisson complète à cœur. Sers avec l’accompagnement proposé.`,explanation:`L’oignon transforme la marinade tomate-moutarde en jus de rôti parfumé. ${intentReason()}`},
        {title:`${bird} rôti paprika-tomate`,missing:miss(['paprika ou thym','pommes de terre ou courgette']),preparation:`Détends le concentré de tomate avec la moutarde, ajoute le paprika ou le thym proposé puis badigeonne ${birdArt}. Rôtis jusqu’à cuisson complète et ajoute l’accompagnement au bon moment.`,explanation:`Le paprika renforce la direction rôtie sans masquer la base tomate-moutarde. ${intentReason()}`},
        {title:`${bird} aux herbes · tomate & moutarde`,missing:miss(['thym ou romarin','ail ou oignon']),preparation:`Mélange moutarde, concentré de tomate et herbes. Masse ${birdArt} avec cette préparation, ajoute ail ou oignon si proposé puis rôtis jusqu’à cuisson complète.`,explanation:`Cette variante met les herbes au premier plan et garde la sauce courte. ${intentReason()}`},
        {title:`${bird} tomate-moutarde & légumes rôtis`,missing:miss(['courgette ou carottes','pommes de terre ou patate douce']),preparation:`Badigeonne ${birdArt} avec moutarde et tomate. Dispose les légumes proposés autour en morceaux puis rôtis l’ensemble, en retirant les légumes plus tôt s’ils sont cuits avant la volaille.`,explanation:`La plaque de légumes récupère les sucs tout en transformant le plat en repas complet. ${intentReason()}`},
        {title:`${bird} en cocotte · sauce tomate-moutarde`,missing:miss(['oignon ou échalote','carottes ou champignons']),preparation:`Fais colorer ${birdArt}, ajoute oignon ou échalote puis déglace avec un peu d’eau. Incorpore moutarde et concentré de tomate, couvre et poursuis doucement jusqu’à cuisson complète.`,explanation:`La cocotte donne une sauce plus liée et un résultat différent du poulet rôti. ${intentReason()}`}
      ];
      return {kind:'whole_chicken_mustard_tomato',title:`${bird} rôti · moutarde & tomate`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Mélange la moutarde avec le concentré ou la purée de tomate et un petit trait d’eau ou d’huile pour obtenir une marinade épaisse. Badigeonne ${birdArt}, assaisonne puis rôtis jusqu’à cuisson complète à cœur. Ajoute l’accompagnement proposé selon son temps de cuisson.`,explanation:`Tee reconnaît ici une volaille entière et une vraie base de marinade moutarde-tomate. Le concentré de tomate n’est pas compté comme une portion de légumes : « À prévoir » sert donc à compléter le repas.`,variants};
    }

    // V405 · Bruschetta / pain à bruschetta + béchamel + jambon.
    if(flatbread&&/bruschetta/.test(norm(flatbread))&&bechamel&&ham){
      const missingBy={equilibre:['tomates ou salade','mozzarella ou emmental'],digestion:['salade ou courgette','herbes fraîches ou citron'],energie:['mozzarella ou emmental','tomates ou champignons'],construire:['mozzarella ou emmental','salade ou tomates'],legerete:['salade ou tomates','champignons ou courgette'],gourmandise:['emmental ou mozzarella','champignons ou oignon']};
      const variants=[
        {title:'Croque-bruschetta · jambon & béchamel',missing:miss(['emmental ou mozzarella','salade ou tomates']),preparation:'Étale une fine couche de béchamel sur le pain à bruschetta, ajoute le jambon puis le fromage proposé. Gratine jusqu’à coloration et sers les crudités à côté.',explanation:`La base devient un croque ouvert, très cohérent avec jambon et béchamel. ${intentReason()}`},
        {title:'Bruschetta gratinée · jambon & champignons',missing:miss(['champignons','emmental ou mozzarella']),preparation:'Fais revenir rapidement les champignons, étale la béchamel, ajoute jambon et champignons puis gratine avec le fromage proposé.',explanation:`Les champignons apportent une garniture chaude supplémentaire sans changer la base. ${intentReason()}`},
        {title:'Bruschetta jambon · tomate & béchamel',missing:miss(['tomates','basilic ou herbes fraîches']),preparation:'Étale la béchamel, ajoute le jambon et de fines rondelles de tomate puis enfourne. Termine avec le basilic ou les herbes après cuisson.',explanation:`La tomate apporte de la fraîcheur et de l’acidité à la garniture crémeuse. ${intentReason()}`},
        {title:'Bruschetta façon croque-monsieur',missing:miss(['emmental ou comté','moutarde ou salade']),preparation:'Ajoute une très fine couche de moutarde si proposée, puis béchamel, jambon et fromage. Gratine jusqu’à ce que le dessus soit doré.',explanation:`Cette variante assume clairement l’esprit croque-monsieur en version ouverte. ${intentReason()}`},
        {title:'Bruschetta jambon & poireaux crémeux',missing:miss(['poireau','emmental ou parmesan']),preparation:'Fais fondre le poireau émincé, mélange-le avec un peu de béchamel puis répartis sur la bruschetta avec le jambon. Termine par le fromage proposé et gratine.',explanation:`Le poireau transforme la béchamel en garniture végétale liée. ${intentReason()}`}
      ];
      return {kind:'bruschetta_bechamel_ham',title:'Bruschetta gratinée · béchamel & jambon',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Étale une couche fine de béchamel sur le pain à bruschetta, ajoute le jambon puis le complément proposé. Enfourne jusqu’à ce que le pain soit croustillant et la garniture chaude ; ajoute les feuilles ou crudités seulement au service.',explanation:'Pain à bruschetta, béchamel et jambon correspondent déjà à une tartine chaude gratinée. Tee construit donc autour de cette base au lieu de proposer une assiette générique.',variants};
    }

    // V405 · Saumon + huile d’olive + beurre : cuisson, pas triple ingrédient principal.
    if(salmonPiece&&hasOliveOil&&hasButter){
      const sN=norm(salmonPiece),sLabel=/paves?/.test(sN)?'Pavés de saumon':/filets?/.test(sN)?'Filets de saumon':/coeur/.test(sN)?'Cœur de saumon':/dos/.test(sN)?'Dos de saumon':'Saumon';
      const missingBy={equilibre:['brocoli ou haricots verts','pommes de terre ou riz'],digestion:['courgette ou fenouil','riz ou pommes de terre'],energie:['pommes de terre ou quinoa','brocoli ou carottes'],construire:['quinoa ou pommes de terre','brocoli ou épinards'],legerete:['courgette ou salade','citron ou herbes fraîches'],gourmandise:['pommes grenailles ou purée','citron ou aneth']};
      const variants=[
        {title:`${sLabel} poêlés · beurre, citron & herbes`,missing:miss(['citron ou herbes fraîches','brocoli ou haricots verts']),preparation:'Saisis le saumon dans un filet d’huile d’olive, baisse le feu puis ajoute une petite noix de beurre en fin de cuisson. Arrose avec le beurre mousseux et termine avec citron ou herbes.',explanation:`L’huile sécurise la saisie et le beurre sert de finition aromatique. ${intentReason()}`},
        {title:`${sLabel} rôtis & légumes au four`,missing:miss(['courgette ou carottes','pommes de terre ou patate douce']),preparation:'Mélange les légumes proposés avec un peu d’huile d’olive et enfourne-les en premier. Ajoute le saumon plus tard, puis termine avec une petite noix de beurre après cuisson.',explanation:`Les deux matières grasses sont utilisées à des moments différents plutôt qu’en excès. ${intentReason()}`},
        {title:`${sLabel} en papillote · herbes & citron`,missing:miss(['citron ou aneth','courgette ou fenouil']),preparation:'Pose le saumon sur une feuille de cuisson avec le légume et les herbes proposés, ajoute un filet d’huile puis ferme la papillote. Termine avec une noisette de beurre après cuisson si souhaité.',explanation:`La papillote donne une cuisson plus douce et juteuse. ${intentReason()}`},
        {title:`Bowl de saumon poêlé & légumes`,missing:miss(['riz ou quinoa','concombre ou brocoli']),preparation:'Poêle le saumon avec un filet d’huile, termine avec un peu de beurre puis coupe-le en morceaux. Assemble avec la base et les légumes proposés.',explanation:`Le saumon devient l’élément chaud d’un bowl structuré. ${intentReason()}`},
        {title:`${sLabel} beurre noisette & câpres`,missing:miss(['câpres ou citron','haricots verts ou épinards']),preparation:'Saisis le saumon à l’huile. Dans la même poêle, fais mousser une petite quantité de beurre jusqu’à légère coloration puis ajoute câpres ou citron avant d’en napper le poisson.',explanation:`Cette variante utilise le beurre comme vraie sauce de finition. ${intentReason()}`}
      ];
      return {kind:'salmon_oliveoil_butter',title:`${sLabel} poêlés · huile d’olive & beurre`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Chauffe un filet d’huile d’olive et saisis le saumon. Quand il approche de la cuisson souhaitée, baisse le feu et ajoute une petite noix de beurre pour l’arroser brièvement. Sers avec le végétal et/ou la base proposés.',explanation:'Tee comprend que l’huile d’olive et le beurre sont ici des matières grasses de cuisson, pas deux éléments à compléter. « À prévoir » se concentre donc sur l’accompagnement et les aromates.',variants};
    }

    // V405 · Pièces de poulet + sweet chili + soja sucré : laquage identifiable.
    if(stickyChicken&&a.sweetChilis.length&&a.sweetSoys.length){
      const p=canonicalProteinLabel(stickyChicken),P=cap(p),art=withArticle(p);
      const missingBy={equilibre:['brocoli ou poivron','riz basmati ou nouilles'],digestion:['courgette ou carottes','gingembre ou citron vert'],energie:['riz basmati ou nouilles','maïs ou poivron'],construire:['riz ou nouilles','brocoli ou edamame'],legerete:['salade croquante ou concombre','citron vert ou coriandre'],gourmandise:['riz parfumé ou nouilles','sésame ou cacahuètes']};
      const variants=[
        {title:`${P} laqués au four · sweet chili & soja`,missing:miss(['brocoli ou poivron','riz basmati ou nouilles']),preparation:`Mélange sweet chili et soja sucré, enrobe ${art} puis cuis au four jusqu’à cuisson complète. Badigeonne une seconde fois en fin de cuisson pour obtenir un glaçage brillant.`,explanation:`Le four permet de concentrer le laquage sans brûler trop vite les sucres. ${intentReason()}`},
        {title:`${P} sticky · sésame & citron vert`,missing:miss(['sésame ou cacahuètes','citron vert ou coriandre']),preparation:`Cuis ${art} complètement, puis badigeonne de sauce sweet chili-soja dans les dernières minutes. Termine avec sésame et citron vert ou coriandre.`,explanation:`La finition fraîche équilibre le côté sucré-salé du glaçage. ${intentReason()}`},
        {title:`Bowl asiatique · ${lower(p)} laqué`,missing:miss(['riz basmati ou nouilles','concombre ou brocoli']),preparation:`Prépare ${art} laqué jusqu’à cuisson complète. Dispose la base proposée dans un bol puis ajoute le poulet et les légumes, avec un peu de sauce restante seulement si elle a été cuite.`,explanation:`Le laquage devient le fil conducteur d’un bowl complet. ${intentReason()}`},
        {title:`${P} soja-gingembre & sweet chili`,missing:miss(['gingembre','brocoli ou carottes']),preparation:`Ajoute du gingembre au mélange sweet chili-soja, enrobe ${art} puis cuis jusqu’à cuisson complète. Fais sauter ou cuire les légumes séparément pour garder leur texture.`,explanation:`Le gingembre apporte une direction plus aromatique et moins seulement sucrée. ${intentReason()}`},
        {title:`${P} grillés & salade croquante`,missing:miss(['salade ou concombre','citron vert ou coriandre']),preparation:`Cuis ${art} au four, à la poêle ou au gril jusqu’à cuisson complète, puis ajoute le laquage en fin de cuisson. Sers avec la salade croquante proposée.`,explanation:`Le contraste chaud-froid allège la sensation du glaçage. ${intentReason()}`}
      ];
      return {kind:'sticky_chicken_sweet_chili_soy',title:`${P} laqués · sweet chili & soja sucré`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Mélange la sauce sweet chili et la sauce soja sucrée. Enrobe ${art}, puis cuis jusqu’à cuisson complète en surveillant la coloration car les sauces sucrées caramélisent vite. Badigeonne à nouveau seulement avec une sauce propre ou ayant été portée à cuisson.`,explanation:'Sweet chili + soja sucré constituent déjà un laquage sucré-salé identifiable. Tee garde la pièce de poulet exacte et utilise « À prévoir » pour apporter un accompagnement ou une finition fraîche.',variants};
    }

    // V405 · Tomates + concombre + poivron (vert ou autre) : vraie base de salade fraîche.
    if(tomatoFresh&&cucumberFresh&&anyPepperFresh){
      const pep=/vert/.test(norm(anyPepperFresh))?'poivron vert':/rouge/.test(norm(anyPepperFresh))?'poivron rouge':/jaune/.test(norm(anyPepperFresh))?'poivron jaune':'poivron';
      const missingBy={equilibre:['feta ou pois chiches','citron ou herbes fraîches'],digestion:['menthe fraîche ou citron','yaourt aux herbes ou feta'],energie:['avocat ou maïs','pain complet ou quinoa'],construire:['thon ou poulet','feta ou pois chiches'],legerete:['citron ou herbes fraîches','radis ou salade'],gourmandise:['burrata ou feta','pain grillé ou olives']};
      const variants=[
        {title:`Salade méditerranéenne · tomates, concombre & ${pep}`,missing:miss(['feta ou olives','basilic ou herbes fraîches']),preparation:'Coupe les légumes en morceaux, ajoute feta ou olives si proposé puis assaisonne au dernier moment avec les herbes.',explanation:`Le trio se prête directement à une salade méditerranéenne. ${intentReason()}`},
        {title:`Salsa croquante · tomate, concombre & ${pep}`,missing:miss(['citron vert ou vinaigre doux','coriandre ou oignon rouge']),preparation:'Coupe les trois légumes en très petits dés, ajoute l’assaisonnement proposé puis laisse reposer quelques minutes au frais.',explanation:`La découpe fine transforme la salade en salsa fraîche. ${intentReason()}`},
        {title:'Gazpacho express · tomate, concombre & poivron',missing:miss(['ail ou basilic','vinaigre ou citron']),preparation:'Mixe tomates, concombre et poivron avec un peu d’eau froide. Ajoute ail, herbes et acidité selon la suggestion puis sers bien frais.',explanation:`Les mêmes légumes deviennent une soupe froide, donc une forme complètement différente. ${intentReason()}`},
        {title:`Bowl frais · tomates, concombre & ${pep}`,missing:miss(['quinoa ou pois chiches','feta ou thon']),preparation:'Prépare la base ou la protéine proposée, laisse-la tiédir si nécessaire puis ajoute les légumes crus au dernier moment.',explanation:`Le trio sert ici de garniture fraîche à un bowl plus complet. ${intentReason()}`},
        {title:'Bruschetta fraîche · tomate, concombre & poivron',missing:miss(['pain grillé','basilic ou feta']),preparation:'Coupe les légumes en petits dés, assaisonne puis dépose-les sur du pain grillé. Ajoute basilic ou feta juste avant de servir.',explanation:`Le mélange devient une garniture de tartine plutôt qu’une salade en bol. ${intentReason()}`}
      ];
      return {kind:'tomato_cucumber_pepper',title:`Salade croquante · tomates, concombre & ${pep}`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Coupe les tomates, le concombre et le poivron en morceaux réguliers. Mélange délicatement et ajoute seulement au dernier moment l’assaisonnement et le complément proposés pour garder le croquant.',explanation:'Tomates, concombre et poivron constituent déjà une vraie base de salade fraîche. Tee propose donc ce qui peut la compléter au lieu d’inventer un légume supplémentaire.',variants};
    }

    // V405 · Fruits de mer + quenelles + beurre.
    if(seafoodMix&&quenelle&&hasButter){
      const missingBy={equilibre:['crème fraîche ou béchamel','poireau ou épinards'],digestion:['poireau ou courgette','crème légère ou bouillon'],energie:['crème fraîche ou béchamel','riz ou pain'],construire:['poireau ou épinards','parmesan ou fromage râpé'],legerete:['courgette ou poireau','tomates ou herbes fraîches'],gourmandise:['béchamel ou crème fraîche','parmesan ou emmental']};
      const variants=[
        {title:'Quenelles gratinées aux fruits de mer',missing:miss(['béchamel ou crème fraîche','parmesan ou emmental']),preparation:'Fais revenir brièvement les fruits de mer au beurre, dispose les quenelles dans un plat, ajoute la sauce proposée puis les fruits de mer. Termine avec le fromage et gratine.',explanation:`Le gratin est la transformation la plus naturelle de ce trio. ${intentReason()}`},
        {title:'Quenelles sauce fruits de mer',missing:miss(['crème fraîche ou bouillon','poireau ou échalote']),preparation:'Fais fondre poireau ou échalote dans un peu de beurre, ajoute les fruits de mer puis la crème ou le bouillon proposé. Nappe les quenelles et chauffe doucement.',explanation:`Ici la garniture devient une sauce courte plutôt qu’un gratin. ${intentReason()}`},
        {title:'Poêlée de fruits de mer & quenelles dorées',missing:miss(['persil ou ciboulette','courgette ou épinards']),preparation:'Coupe les quenelles en rondelles et fais-les dorer dans une petite quantité de beurre. Saisis les fruits de mer séparément puis réunis le tout brièvement avec les herbes.',explanation:`Les quenelles deviennent croustillantes au lieu d’être nappées. ${intentReason()}`},
        {title:'Cassolette de fruits de mer & quenelles',missing:miss(['crème fraîche ou béchamel','champignons ou poireau']),preparation:'Fais revenir les champignons ou le poireau, ajoute les fruits de mer puis un peu de sauce. Répartis avec les quenelles dans de petites cassolettes et enfourne.',explanation:`Le format cassolette donne une version plus individuelle et crémeuse. ${intentReason()}`},
        {title:'Quenelles tomate & fruits de mer',missing:miss(['tomates ou coulis de tomate','ail ou basilic']),preparation:'Prépare une sauce tomate courte avec ail ou basilic, ajoute les fruits de mer en fin de cuisson puis nappe les quenelles et chauffe au four.',explanation:`La sauce tomate apporte une alternative plus vive à la béchamel ou à la crème. ${intentReason()}`}
      ];
      return {kind:'seafood_quenelle_butter',title:'Quenelles gratinées aux fruits de mer',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Fais revenir rapidement les fruits de mer dans une petite quantité de beurre. Dispose les quenelles dans un plat, ajoute les fruits de mer puis la sauce ou les légumes proposés et chauffe au four jusqu’à ce que l’ensemble soit bien chaud.',explanation:'Tee reconnaît les quenelles comme la base du plat et les fruits de mer comme la garniture principale. Le beurre sert à la cuisson ; « À prévoir » complète surtout la sauce ou la partie végétale.',variants};
    }

    // V405 · Escalopes de poulet + biscottes/chapelure + farine : panure incomplète.
    if(chickenEscalope&&breadcrumbs&&a.flours.length){
      const piece=/aiguillette/.test(norm(chickenEscalope))?'Aiguillettes de poulet':'Escalopes de poulet';
      const crumb=/biscotte/.test(norm(breadcrumbs))?'biscottes écrasées':/panko/.test(norm(breadcrumbs))?'panko':'chapelure';
      const missingBy={equilibre:['œufs','salade ou tomates'],digestion:['œufs','courgette ou salade'],energie:['œufs','pommes de terre ou pâtes'],construire:['œufs','parmesan ou graines'],legerete:['œufs','salade ou concombre'],gourmandise:['œufs','parmesan ou herbes fraîches']};
      const variants=[
        {title:`${piece} façon schnitzel`,missing:miss(['œufs','citron ou salade']),preparation:`Passe le poulet dans la farine, puis dans l’œuf battu et enfin dans les ${crumb}. Fais cuire à la poêle ou au four jusqu’à cuisson complète et croustillante.`,explanation:`La farine et la chapelure appellent naturellement l’œuf pour créer une vraie panure. ${intentReason()}`},
        {title:'Aiguillettes de poulet croustillantes',missing:miss(['œufs','paprika ou herbes fraîches']),preparation:`Coupe les escalopes en lanières si nécessaire, farine-les, passe-les dans l’œuf puis dans les ${crumb} assaisonnées. Fais cuire jusqu’à cuisson complète.`,explanation:`La découpe en lanières transforme l’escalope en tenders maison. ${intentReason()}`},
        {title:`${piece} panées au four`,missing:miss(['œufs','courgette ou tomates']),preparation:`Prépare la panure farine-œuf-${crumb}, dépose le poulet sur une plaque et cuis au four en retournant à mi-cuisson jusqu’à cuisson complète.`,explanation:`La cuisson au four donne une alternative à la friture ou à la poêle. ${intentReason()}`},
        {title:`${piece} croûte parmesan & herbes`,missing:miss(['œufs','parmesan ou herbes fraîches']),preparation:`Mélange parmesan ou herbes aux ${crumb}, puis pane le poulet après la farine et l’œuf. Fais cuire jusqu’à ce que la croûte soit dorée et le poulet complètement cuit.`,explanation:`La chapelure devient une croûte aromatique plus gourmande. ${intentReason()}`},
        {title:'Burger de poulet pané maison',missing:miss(['œufs','pain ou salade']),preparation:`Pane le poulet avec farine, œuf et ${crumb}, cuis-le complètement puis glisse-le dans le pain proposé ou sers-le avec une grande salade.`,explanation:`La même panure devient la base d’un sandwich ou d’une assiette croustillante. ${intentReason()}`}
      ];
      return {kind:'chicken_breading',title:`${piece} panées maison`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Écrase les biscottes si nécessaire pour obtenir une chapelure. Passe ${withArticle(piece)} dans la farine, puis dans l’œuf battu proposé, puis dans les ${crumb}. Fais cuire jusqu’à ce que la panure soit dorée et le poulet complètement cuit.`,explanation:'Farine + biscottes/chapelure indiquent une panure, mais il manque normalement un liant. Tee propose donc l’œuf plutôt qu’un ingrédient sans rapport, puis adapte l’accompagnement à ton intention.',variants};
    }

    // V404 · Pinsa / pizza / focaccia + fromage frais + crème.
    if(flatbread&&first(a.freshCheeses)&&cream){
      const base=flatbreadDisplay(flatbread),fresh=freshCheeseDisplay(first(a.freshCheeses));
      const missingBy={equilibre:['roquette ou tomates cerises','herbes fraîches ou citron'],digestion:['courgette ou roquette','herbes fraîches ou citron'],energie:['poulet ou saumon','tomates cerises ou poivron'],construire:['poulet ou saumon','roquette ou tomates cerises'],legerete:['roquette ou tomates cerises','courgette ou champignons'],gourmandise:['champignons ou oignon','mozzarella ou parmesan']};
      const variants=[
        {title:`${base} blanche · ${fresh} & roquette`,missing:miss(['roquette','tomates cerises ou citron']),preparation:`Étale une fine couche de ${lower(fresh)} détendu avec un peu de crème sur ${withArticle(flatbread)}. Enfourne puis ajoute la roquette et les tomates seulement après cuisson.`,explanation:`La base blanche reste crémeuse mais la finition devient fraîche et végétale. ${intentReason()}`},
        {title:`${base} · ${fresh} & courgettes`,missing:miss(['courgette','herbes fraîches ou citron']),preparation:`Étale le mélange ${lower(fresh)}-crème, ajoute de fines lamelles de courgette puis cuis jusqu’à ce que la base soit croustillante.`,explanation:`La courgette donne une variante plus végétale. ${intentReason()}`},
        {title:`${base} · saumon, ${fresh} & citron`,missing:miss(['saumon fumé ou saumon cuit','citron ou aneth']),preparation:`Cuis d’abord la base avec la couche ${lower(fresh)}-crème. Ajoute ensuite le saumon déjà cuit ou fumé et le citron après cuisson.`,explanation:`Le saumon est ajouté au bon moment pour éviter de dessécher la garniture. ${intentReason()}`},
        {title:`${base} crémeuse · champignons & oignon`,missing:miss(['champignons ou oignon','thym ou persil']),preparation:'Fais revenir champignons et oignon, étale la base crémeuse puis répartis la garniture avant d’enfourner.',explanation:`Champignons et oignon donnent une version chaude et plus profonde en goût. ${intentReason()}`},
        {title:`${base} fraîche · avocat, tomates & ${fresh}`,missing:miss(['avocat ou tomates cerises','roquette ou basilic']),preparation:`Cuis la base avec une fine couche de ${lower(fresh)} et de crème, laisse tiédir puis ajoute avocat et tomates au dernier moment.`,explanation:`Cette variante joue sur le contraste chaud-froid. ${intentReason()}`},
        {title:`${base} · poulet, ${fresh} & roquette`,missing:miss(['poulet','roquette ou tomates cerises']),preparation:'Cuis la base crémeuse, ajoute le poulet déjà cuit puis termine avec la roquette ou les tomates après cuisson.',explanation:`Le poulet transforme la base blanche en repas plus complet. ${intentReason()}`}
      ];
      return {kind:'flatbread_fresh_cheese_cream',title:`${base} blanche · ${fresh} & crème`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Mélange une petite quantité de crème fraîche avec ${withArticle(first(a.freshCheeses))}, étale une couche fine sur ${withArticle(flatbread)} puis enfourne jusqu’à ce que la base soit croustillante. Ajoute les éléments frais proposés seulement après cuisson.`,explanation:`Tee reconnaît ${lower(base)} comme une vraie base de pizza/flatbread et ${lower(fresh)} + crème comme une garniture blanche.`,variants};
    }

    // V404 · Concombre + maïs + oignon rouge.
    if(cucumber&&corn&&hasRedOnion){
      const missingBy={equilibre:['feta ou pois chiches','citron ou herbes fraîches'],digestion:['yaourt aux herbes ou citron','menthe fraîche ou citron vert'],energie:['avocat ou pois chiches','riz ou quinoa'],construire:['thon ou poulet','avocat ou graines'],legerete:['tomates ou radis','citron ou herbes fraîches'],gourmandise:['feta ou avocat','sauce au yaourt ou citron']};
      const variants=[
        {title:'Salsa fraîche · concombre, maïs & oignon rouge',missing:miss(['citron vert ou vinaigre doux','coriandre ou menthe']),preparation:'Coupe le concombre et l’oignon rouge très finement, ajoute le maïs puis assaisonne au dernier moment.',explanation:`Le trio devient une salsa croquante. ${intentReason()}`},
        {title:'Salade concombre-maïs · feta & oignon rouge',missing:miss(['feta','citron ou herbes fraîches']),preparation:'Mélange concombre, maïs et oignon rouge avec la feta proposée puis assaisonne juste avant de servir.',explanation:`La feta apporte une composante plus nourrissante. ${intentReason()}`},
        {title:'Bowl frais · concombre, maïs & oignon rouge',missing:miss(['riz ou quinoa','thon ou pois chiches']),preparation:'Prépare la base proposée, laisse-la tiédir puis ajoute les trois ingrédients crus et la protéine proposée.',explanation:`Le trio frais devient la garniture d’un bowl. ${intentReason()}`},
        {title:'Verrines salées concombre & maïs',missing:miss(['yaourt aux herbes ou citron','ciboulette ou menthe']),preparation:'Mélange concombre et maïs avec une petite sauce au yaourt, répartis en verrines puis termine avec l’oignon rouge.',explanation:`Le format verrine change la texture et la présentation. ${intentReason()}`},
        {title:'Garniture fraîche pour wraps · concombre & maïs',missing:miss(['wrap ou pain pita','poulet ou pois chiches']),preparation:'Mélange les trois ingrédients frais puis utilise-les comme garniture de wrap ou de pita avec la protéine proposée.',explanation:`La salade devient une garniture croquante. ${intentReason()}`}
      ];
      return {kind:'cucumber_corn_redonion',title:'Salade fraîche · concombre, maïs & oignon rouge',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Coupe le concombre et l’oignon rouge, ajoute le maïs puis mélange délicatement. Assaisonne seulement au moment de servir.',explanation:'Concombre, maïs et oignon rouge forment déjà une vraie salade fraîche.',variants};
    }

    // V404 · Sirop fruité + soda/limonade + citron vert : mocktail sans alcool.
    if(fruitSyrup&&softDrink&&lime){
      const flavour=syrupFlavour(fruitSyrup),sodaName=softDrinkDisplay(softDrink);
      const missingBy={equilibre:['menthe fraîche ou glaçons','eau pétillante ou rondelles de citron'],digestion:['menthe fraîche ou gingembre','glaçons ou citron'],energie:['glaçons ou menthe fraîche','fruits rouges ou citron'],construire:['glaçons ou menthe fraîche','fruits frais ou citron'],legerete:['eau pétillante ou glaçons','menthe fraîche ou citron'],gourmandise:['fraises fraîches ou fruits rouges','glaçons ou menthe fraîche']};
      const variants=[
        {title:`Fizz ${flavour} · citron vert & menthe`,missing:miss(['menthe fraîche','glaçons']),preparation:`Verse un petit trait de sirop de ${flavour}, ajoute citron vert et glaçons, complète avec ${lower(sodaName)} puis ajoute la menthe.`,explanation:`La menthe transforme la boisson en fizz très frais. ${intentReason()}`},
        {title:`Granité ${flavour} · citron vert`,missing:miss(['glaçons','menthe ou fruits frais']),preparation:`Mixe les glaçons avec un peu de sirop de ${flavour} et du citron vert. Ajoute seulement un petit trait de ${lower(sodaName)} au service.`,explanation:`La texture devient granitée. ${intentReason()}`},
        {title:`Slush ${flavour} & ${lower(sodaName)}`,missing:miss(['glaçons','fraises ou framboises']),preparation:`Mixe glaçons, sirop et fruits proposés, puis ajoute ${lower(sodaName)} en dernier.`,explanation:`Les fruits donnent une boisson-dessert plus épaisse. ${intentReason()}`},
        {title:`Spritz sans alcool ${flavour} · citron vert`,missing:miss(['eau pétillante','rondelles de citron ou menthe']),preparation:`Mélange sirop et citron vert, ajoute beaucoup de glace puis ${lower(sodaName)} et un peu d’eau pétillante.`,explanation:`Cette version allonge la boisson. ${intentReason()}`},
        {title:`Soda ${flavour}-citron vert aux fruits`,missing:miss(['fraises ou fruits rouges','menthe fraîche ou basilic']),preparation:`Écrase légèrement les fruits proposés, ajoute sirop et citron vert puis complète avec ${lower(sodaName)}.`,explanation:`Les fruits frais apportent une vraie texture. ${intentReason()}`}
      ];
      return {kind:'fruit_syrup_soda_lime',title:`Fizz ${flavour} · ${sodaName} & citron vert`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Remplis un grand verre de glaçons si tu en as, verse un petit trait de sirop de ${flavour}, ajoute le citron vert puis complète doucement avec ${lower(sodaName)}.`,explanation:'Tee reconnaît une boisson pétillante sans alcool et reste dans une logique de mocktail.',variants};
    }

    // V404 · Pâte à pizza + huile + oignon.
    if(pizzaDough&&hasOnion&&(hasSunflower||hasOliveOil||a.fats.length)){
      const missingBy={equilibre:['mozzarella ou tomates','salade ou roquette'],digestion:['courgette ou tomates','herbes fraîches ou citron'],energie:['mozzarella ou poulet','tomates ou poivron'],construire:['poulet ou thon','mozzarella ou fromage frais'],legerete:['tomates ou courgette','roquette ou salade'],gourmandise:['mozzarella ou parmesan','olives ou thym']};
      const oilName=hasSunflower?'huile de tournesol':hasOliveOil?'huile d’olive':'huile';
      const variants=[
        {title:'Focaccia fine aux oignons',missing:miss(['romarin ou thym','tomates cerises ou olives']),preparation:`Étale la pâte un peu plus épaisse, badigeonne-la très légèrement de ${oilName}, ajoute les oignons et les herbes puis cuis jusqu’à dorure.`,explanation:`La pâte devient une focaccia plus moelleuse. ${intentReason()}`},
        {title:'Pizza tomate & oignon',missing:miss(['tomates ou sauce tomate','mozzarella ou basilic']),preparation:'Étale la pâte, ajoute une fine couche de tomate, les oignons puis la mozzarella si tu la choisis. Enfourne à four bien chaud.',explanation:`La tomate transforme la base blanche en pizza rouge. ${intentReason()}`},
        {title:'Pizza blanche oignon & fromage',missing:miss(['mozzarella ou fromage frais','roquette ou champignons']),preparation:'Étale la pâte, ajoute les oignons et le fromage proposé, puis cuis à four très chaud. Ajoute la roquette après cuisson.',explanation:`Le fromage apporte le liant d’une vraie pizza blanche. ${intentReason()}`},
        {title:'Pissaladière express aux oignons',missing:miss(['olives ou thym','anchois facultatifs ou tomates']),preparation:'Fais fondre les oignons, étale-les sur la pâte légèrement huilée puis ajoute olives et thym avant cuisson.',explanation:`Cette variante met l’oignon au centre. ${intentReason()}`},
        {title:'Roulés de pizza aux oignons',missing:miss(['fromage râpé ou mozzarella','herbes fraîches ou tomates']),preparation:'Étale la pâte, répartis oignons et fromage, roule en boudin puis coupe en tronçons avant d’enfourner.',explanation:`La même pâte devient des roulés individuels. ${intentReason()}`}
      ];
      return {kind:'pizza_dough_onion',title:'Pizza blanche aux oignons',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Étale la pâte à pizza, badigeonne-la très légèrement de ${oilName}, répartis l’oignon finement émincé puis ajoute le complément proposé. Enfourne à four bien chaud.`,explanation:'Pâte à pizza, huile et oignon indiquent déjà une vraie base à garnir.',variants};
    }

    // V404 · Saumon + citron + vinaigre : marinade acide, cuite par défaut.
    if(salmon&&hasVinegar&&has(/\bcitron(?: vert)?\b/)){
      const citrus=lime?'citron vert':'citron';
      const missingBy={equilibre:['concombre ou avocat','riz ou quinoa'],digestion:['concombre ou fenouil','gingembre ou herbes fraîches'],energie:['riz ou pommes de terre','avocat ou maïs'],construire:['riz ou quinoa','avocat ou graines'],legerete:['concombre ou salade','herbes fraîches ou radis'],gourmandise:['avocat ou mangue','sésame ou ciboulette']};
      const variants=[
        {title:`Saumon grillé mariné au ${citrus}`,missing:miss(['riz ou pommes de terre','brocoli ou courgette']),preparation:`Fais mariner brièvement le saumon avec le ${citrus} et un peu de vinaigre, égoutte-le puis saisis-le ou grille-le.`,explanation:`L’acidité sert de marinade avant cuisson. ${intentReason()}`},
        {title:`Bowl de saumon au ${citrus} & vinaigre`,missing:miss(['riz ou quinoa','concombre ou avocat']),preparation:'Fais cuire le saumon après une courte marinade, prépare la base proposée puis assemble avec les éléments frais. Utilise un assaisonnement frais séparé de la marinade ayant touché le poisson cru.',explanation:`Le saumon mariné devient la protéine d’un bowl. ${intentReason()}`},
        {title:'Salade de saumon citronné',missing:miss(['salade ou concombre','avocat ou tomates']),preparation:'Fais cuire le saumon après la marinade, laisse-le tiédir puis émiette-le sur la salade et les crudités proposées.',explanation:`Le saumon devient une garniture de salade. ${intentReason()}`},
        {title:`Saumon façon ceviche au ${citrus}`,missing:miss(['avocat ou concombre','coriandre ou oignon rouge']),preparation:`Utilise cette version uniquement avec un saumon prévu pour être consommé cru et maintenu bien froid. Sinon, cuis le saumon et garde le même assaisonnement.`,explanation:`Le format ceviche exige un saumon adapté à une consommation crue. ${intentReason()}`},
        {title:`Saumon laqué acidulé · ${citrus}`,missing:miss(['miel ou sirop d’érable','sésame ou ciboulette']),preparation:`Mélange un peu de ${citrus}, de vinaigre et la touche sucrée proposée. Badigeonne le saumon en fin de cuisson.`,explanation:`La touche sucrée transforme la marinade acide en glaçage. ${intentReason()}`}
      ];
      return {kind:'salmon_citrus_vinegar',title:`Saumon mariné · ${citrus} & vinaigre`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Mélange le ${citrus} avec une petite quantité de vinaigre et fais mariner le saumon brièvement. Égoutte-le puis cuis-le à la poêle ou au four pour la proposition principale.`,explanation:`Le ${citrus} et le vinaigre forment déjà une marinade cohérente ; Tee ne suppose pas que le poisson sera mangé cru.`,variants};
    }

    // V404 · Bœuf haché + échalote + ciboulette.
    if(groundBeef&&hasShallot&&hasChives){
      const missingBy={equilibre:['pommes de terre ou riz','salade ou tomates'],digestion:['riz ou pommes de terre','courgette ou carottes'],energie:['pommes de terre ou pain complet','tomates ou poivron'],construire:['riz ou quinoa','haricots verts ou brocoli'],legerete:['salade ou courgette','tomates ou concombre'],gourmandise:['pommes de terre ou pain','fromage ou sauce au yaourt']};
      const variants=[
        {title:'Steak haché · échalote & ciboulette',missing:miss(['pommes de terre ou riz','salade ou haricots verts']),preparation:'Mélange le bœuf haché avec l’échalote finement coupée et la ciboulette, forme un steak puis cuis-le complètement.',explanation:`La farce devient un steak aromatique. ${intentReason()}`},
        {title:'Boulettes de bœuf · échalote & ciboulette',missing:miss(['riz ou semoule','courgette ou tomates']),preparation:'Mélange le bœuf avec l’échalote et la ciboulette, forme de petites boulettes puis fais-les dorer et cuire à cœur.',explanation:`Les aromates sont intégrés à la viande. ${intentReason()}`},
        {title:'Kefta douce de bœuf aux herbes',missing:miss(['cumin ou paprika','semoule ou salade']),preparation:'Mélange bœuf, échalote, ciboulette et l’épice proposée. Forme des petits boudins puis cuis-les.',explanation:`La forme et les épices changent la direction du plat. ${intentReason()}`},
        {title:'Burger de bœuf · échalote & ciboulette',missing:miss(['pain burger ou petit pain','salade ou tomates']),preparation:'Forme un steak aromatique, cuis-le puis glisse-le dans le pain proposé avec les crudités.',explanation:`La préparation devient un burger complet. ${intentReason()}`},
        {title:'Pommes de terre farcies au bœuf aux herbes',missing:miss(['pommes de terre','fromage ou tomates']),preparation:'Fais cuire les pommes de terre, creuse-les puis garnis-les de bœuf haché revenu avec échalote et ciboulette. Termine au four.',explanation:`Le mélange de bœuf devient une farce. ${intentReason()}`}
      ];
      return {kind:'ground_beef_shallot_chives',title:'Boulettes de bœuf · échalote & ciboulette',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Mélange le bœuf haché avec l’échalote finement coupée et la ciboulette. Forme des boulettes ou petits palets puis cuis-les complètement.',explanation:'Bœuf haché, échalote et ciboulette constituent déjà une farce aromatique.',variants};
    }

    // V404 · Poulet + olives + tomates pelées.
    if(chicken&&hasOlives&&hasTomato){
      const p=canonicalProteinLabel(chicken),oliveLabel=/noires?/.test(norm(olive))?'olives noires':'olives vertes';
      const missingBy={equilibre:['riz ou semoule','courgette ou carottes'],digestion:['riz basmati ou pommes de terre','courgette ou carottes'],energie:['riz ou pâtes','poivron ou courgette'],construire:['riz ou quinoa','pois chiches ou courgette'],legerete:['courgette ou poivron','herbes fraîches ou citron'],gourmandise:['pâtes ou pommes de terre','parmesan ou herbes fraîches']};
      const variants=[
        {title:`${cap(p)} mijoté tomate & ${oliveLabel}`,missing:miss(['riz ou semoule','courgette ou poivron']),preparation:`Fais dorer ${withArticle(chicken)}, ajoute les tomates pelées puis les ${oliveLabel}. Laisse mijoter jusqu’à cuisson complète.`,explanation:`Le trio devient un mijoté méditerranéen. ${intentReason()}`},
        {title:`${cap(p)} façon tajine tomate & olives`,missing:miss(['semoule ou pois chiches','cumin ou coriandre']),preparation:`Fais revenir ${withArticle(chicken)}, ajoute les épices proposées, les tomates pelées et les olives puis laisse mijoter.`,explanation:`Les épices donnent une direction plus proche d’un tajine. ${intentReason()}`},
        {title:`Pâtes au ${p} · tomate & olives`,missing:miss(['pâtes ou coquillettes','courgette ou épinards']),preparation:`Fais mijoter ${withArticle(chicken)} avec tomates et olives, puis mélange la sauce aux pâtes cuites.`,explanation:`Le mijoté devient une sauce pour pâtes. ${intentReason()}`},
        {title:`Bowl méditerranéen · ${p}, tomate & olives`,missing:miss(['riz ou quinoa','concombre ou salade']),preparation:'Prépare le poulet mijoté, dépose-le sur la base proposée puis ajoute les éléments frais au dernier moment.',explanation:`Le plat devient un bowl chaud-froid. ${intentReason()}`},
        {title:`${cap(p)} rôti tomate & olives`,missing:miss(['pommes de terre ou courgette','thym ou romarin']),preparation:`Dispose ${withArticle(chicken)} dans un plat avec les tomates pelées, les olives et les herbes proposées. Rôtis jusqu’à cuisson complète.`,explanation:`La cuisson au four concentre davantage la sauce. ${intentReason()}`}
      ];
      return {kind:'chicken_tomato_olives',title:`${cap(p)} mijoté · tomates & ${oliveLabel}`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Fais dorer ${withArticle(chicken)}, ajoute les tomates pelées puis les ${oliveLabel}. Laisse mijoter doucement jusqu’à cuisson complète du poulet et légère réduction de la sauce.`,explanation:`Poulet, tomates pelées et ${oliveLabel} forment déjà une sauce mijotée identifiable.`,variants};
    }

    // Riz + œufs + oignon : vraie famille « riz sauté / fried rice ».
    if(rice&&eggs&&hasOnion){
      const riceName=/basmati/.test(norm(rice))?'Riz basmati':'Riz';
      const missingBy={
        equilibre:['petits pois ou épinards','sauce soja ou herbes fraîches'],digestion:['courgette ou carottes','gingembre ou herbes fraîches'],energie:['petits pois ou maïs','avocat ou graines'],
        construire:['petits pois ou edamame','graines de sésame ou herbes fraîches'],legerete:['courgette ou épinards','herbes fraîches ou citron'],gourmandise:['champignons ou petits pois','parmesan ou fromage râpé']
      };
      const variants=[
        {title:`${riceName} façon fried rice · œufs & oignon`,missing:miss(['petits pois ou épinards','sauce soja ou gingembre']),preparation:'Fais revenir l’oignon, ajoute le riz déjà cuit puis pousse-le sur le côté de la poêle. Brouille les œufs dans l’espace libre, mélange ensuite l’ensemble et ajoute le légume ou l’assaisonnement proposé.',explanation:`Le trio riz, œufs et oignon correspond directement à une base de fried rice. ${intentReason()}`},
        {title:`Bowl de ${lower(riceName)} · œufs & oignons fondants`,missing:miss(['épinards ou courgette','herbes fraîches ou sésame']),preparation:'Fais fondre l’oignon doucement, réchauffe le riz et prépare les œufs mollets, pochés ou au plat. Assemble en bowl avec le végétal proposé et termine avec les herbes ou graines.',explanation:`Cette variante garde les éléments séparés et change complètement la texture par rapport au riz sauté. ${intentReason()}`},
        {title:`${riceName} pilaf aux oignons & œufs`,missing:miss(['carottes ou petits pois','herbes fraîches ou citron']),preparation:'Fais revenir l’oignon, ajoute le riz et laisse-le s’imprégner des arômes. Ajoute ensuite les œufs cuits au dernier moment et le légume proposé.',explanation:`La cuisson façon pilaf donne un riz plus parfumé et moins sauté. ${intentReason()}`},
        {title:'Galettes de riz aux œufs & oignon',missing:miss(['herbes fraîches ou épinards','yaourt aux herbes ou citron']),preparation:'Mélange le riz cuit avec les œufs et l’oignon finement émincé. Forme de petites galettes, tasse-les bien puis fais-les dorer sur les deux faces.',explanation:`Le riz et les œufs deviennent ici des galettes croustillantes : la forme et la texture changent réellement. ${intentReason()}`},
        {title:`Omelette garnie au ${lower(riceName)} & oignon`,missing:miss(['épinards ou champignons','herbes fraîches ou tomates']),preparation:'Fais revenir l’oignon et un peu de riz. Verse les œufs battus par-dessus, ajoute le complément proposé puis cuis doucement jusqu’à prise de l’omelette.',explanation:`Cette fois les œufs deviennent la structure principale et le riz la garniture. ${intentReason()}`}
      ];
      return {kind:'rice_egg_onion',title:`${riceName} sauté aux œufs & oignon`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Fais revenir l’oignon dans une poêle. Ajoute le riz déjà cuit et fais-le sauter quelques minutes. Pousse le riz sur le côté, brouille les œufs dans la même poêle puis mélange le tout. Ajoute le complément proposé au moment adapté.',explanation:'Riz, œufs et oignon forment déjà une préparation identifiable. Tee propose donc un riz sauté plutôt qu’un bowl générique et utilise « À prévoir » pour apporter surtout un végétal ou une finition.',variants};
    }

    // Thon + citron vert + crème fraîche : base crémeuse / rillettes / sauce.
    if(tuna&&lime&&cream){
      const missingBy={
        equilibre:['pain complet ou pommes de terre','concombre ou salade'],digestion:['concombre ou herbes fraîches','pain complet ou riz'],energie:['pain complet ou riz','avocat ou tomates'],
        construire:['pain complet ou quinoa','avocat ou graines'],legerete:['concombre ou salade','ciboulette ou herbes fraîches'],gourmandise:['pain grillé ou crackers','ciboulette ou échalote']
      };
      const variants=[
        {title:'Rillettes de thon · citron vert & crème',missing:miss(['ciboulette ou échalote','pain complet ou crackers']),preparation:'Émiette le thon, mélange-le avec une petite quantité de crème fraîche et le jus de citron vert. Ajoute la ciboulette ou l’échalote proposée et sers bien frais.',explanation:`Le trio devient naturellement une tartinade fraîche, sans cuisson supplémentaire. ${intentReason()}`},
        {title:'Pâtes crémeuses au thon & citron vert',missing:miss(['pâtes ou coquillettes','courgette ou épinards']),preparation:'Fais cuire les pâtes proposées. Détends la crème avec un peu d’eau de cuisson, ajoute le thon puis le citron vert hors du feu et mélange avec les pâtes.',explanation:`La crème et le citron vert deviennent ici une sauce courte pour les pâtes. ${intentReason()}`},
        {title:'Avocat farci au thon citron vert',missing:miss(['avocat','tomates ou concombre']),preparation:'Mélange le thon avec la crème et le citron vert. Garnis un avocat coupé en deux et ajoute les crudités proposées autour.',explanation:`Le mélange crémeux devient une farce fraîche plutôt qu’une sauce. ${intentReason()}`},
        {title:'Tartines thon crémeux & citron vert',missing:miss(['pain complet ou pain grillé','concombre ou tomates']),preparation:'Prépare le thon crémeux au citron vert, étale-le sur le pain grillé puis ajoute les crudités proposées au dernier moment.',explanation:`Cette variante transforme le mélange en tartine complète et croustillante. ${intentReason()}`},
        {title:'Bowl frais thon · citron vert & crème',missing:miss(['riz ou quinoa','concombre ou avocat']),preparation:'Prépare la base proposée, laisse-la tiédir puis ajoute le thon mélangé à la crème et au citron vert. Termine avec les éléments frais.',explanation:`La préparation devient un bowl frais avec une base énergétique et des textures séparées. ${intentReason()}`}
      ];
      return {kind:'tuna_lime_cream',title:'Thon crémeux · citron vert & crème fraîche',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Émiette le thon puis mélange-le avec une petite quantité de crème fraîche et du citron vert. Garde une texture épaisse et fraîche, puis utilise le complément proposé comme accompagnement ou garniture.',explanation:'Thon, citron vert et crème fraîche forment déjà une base crémeuse cohérente. Tee ne propose pas une autre protéine : il transforme ce trio en tartinade, sauce ou bowl selon la variante.',variants};
    }

    // Bœuf + oignon + poivron : sauté / wok / fajitas.
    if(beef&&hasOnion&&pepper){
      const isGround=/hach/.test(norm(beef));
      const missingBy={equilibre:['riz ou quinoa','herbes fraîches ou citron'],digestion:['riz basmati ou quinoa','gingembre ou herbes fraîches'],energie:['riz ou nouilles','maïs ou avocat'],construire:['riz ou quinoa','haricots rouges ou maïs'],legerete:['quinoa ou salade','herbes fraîches ou citron'],gourmandise:['tortillas ou pommes de terre','fromage râpé ou avocat']};
      const variants=[
        {title:`Wok de bœuf · poivron & oignon`,missing:miss(['riz ou nouilles','sauce soja ou gingembre']),preparation:`Fais saisir ${isGround?'le bœuf haché':'le bœuf en fines lamelles'} à feu vif, ajoute l’oignon puis le poivron en gardant un peu de croquant. Sers avec la base et l’assaisonnement proposés.`,explanation:`Le trio se prête naturellement à une cuisson rapide au wok. ${intentReason()}`},
        {title:'Fajitas de bœuf · oignon & poivron',missing:miss(['tortillas ou pain pita','avocat ou tomates']),preparation:'Fais revenir le bœuf avec l’oignon et le poivron, assaisonne puis garnis les tortillas ou pains proposés avec le mélange et les éléments frais.',explanation:`La même poêlée devient une garniture de fajitas, donc un format très différent. ${intentReason()}`},
        {title:'Bowl bœuf, poivron & oignon',missing:miss(['riz ou quinoa','avocat ou herbes fraîches']),preparation:'Fais revenir le bœuf, l’oignon et le poivron puis dispose-les sur la base proposée. Ajoute la finition fraîche au moment de servir.',explanation:`Le bowl sépare la base, la poêlée et la finition pour une autre expérience. ${intentReason()}`},
        {title:'Brochettes de bœuf & poivron',missing:miss(['riz ou pommes de terre','herbes fraîches ou citron']),preparation:'Coupe le bœuf et le poivron en morceaux, alterne-les sur des brochettes avec l’oignon puis grille en retournant régulièrement. Sers avec l’accompagnement proposé.',explanation:`La découpe en brochettes modifie la cuisson et la présentation. ${intentReason()}`},
        {title:'Bœuf mijoté tomate, poivron & oignon',missing:miss(['tomates ou coulis de tomate','riz ou pommes de terre']),preparation:'Fais revenir le bœuf et l’oignon, ajoute le poivron puis la tomate proposée. Laisse mijoter doucement jusqu’à obtenir une sauce courte.',explanation:`Cette version passe d’une poêlée rapide à un plat en sauce plus fondant. ${intentReason()}`}
      ];
      return {kind:'beef_onion_pepper',title:`${isGround?'Poêlée':'Sauté'} de bœuf · oignon & poivron`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Fais saisir ${isGround?'le bœuf haché':'le bœuf en lamelles'}, ajoute l’oignon puis le poivron et cuis jusqu’à ce que le bœuf soit complètement cuit tout en gardant le poivron légèrement croquant. Sers avec le complément proposé.`,explanation:'Bœuf, oignon et poivron constituent déjà une vraie base de sauté. Tee construit donc autour de cette association au lieu de proposer un légume supplémentaire au hasard.',variants};
    }

    // Pavé/filet de saumon + carottes + brocolis : assiette rôtie complète côté protéine/légumes.
    if(salmon&&carrot&&broccoli){
      const salmonLabel=/pave/.test(norm(salmon))?'Pavé de saumon':/filet/.test(norm(salmon))?'Filet de saumon':'Saumon';
      const missingBy={equilibre:['riz ou quinoa','citron ou herbes fraîches'],digestion:['riz basmati ou pommes de terre','fenouil ou herbes fraîches'],energie:['riz ou patate douce','graines de sésame ou citron'],construire:['quinoa ou pommes de terre','avocat ou graines'],legerete:['quinoa ou salade','citron ou herbes fraîches'],gourmandise:['pommes de terre ou riz','sauce au yaourt ou parmesan']};
      const variants=[
        {title:`${salmonLabel} en papillote · carottes & brocolis`,missing:miss(['citron ou herbes fraîches','riz ou quinoa']),preparation:'Dépose le saumon sur du papier cuisson avec de fines lamelles de carotte et de petits bouquets de brocoli. Ajoute le citron ou les herbes puis ferme la papillote et cuis jusqu’à ce que le saumon soit juste cuit.',explanation:`La papillote garde le saumon moelleux et parfume les légumes en même temps. ${intentReason()}`},
        {title:`Plaque rôtie · ${lower(salmonLabel)}, carottes & brocolis`,missing:miss(['pommes de terre ou patate douce','herbes fraîches ou citron']),preparation:'Commence par rôtir les carottes et le féculent proposé, ajoute le brocoli puis le saumon plus tard pour respecter son temps de cuisson. Termine avec les herbes ou le citron.',explanation:`Tout se prépare sur une seule plaque en respectant des temps de cuisson différents. ${intentReason()}`},
        {title:'Bowl saumon · carottes & brocolis',missing:miss(['riz ou quinoa','sésame ou avocat']),preparation:'Fais cuire le saumon, les carottes et le brocoli séparément ou sur la même plaque, puis dispose-les sur la base proposée. Ajoute la finition fraîche.',explanation:`Le bowl structure les trois ingrédients autour d’une base énergétique. ${intentReason()}`},
        {title:'Saumon vapeur & légumes croquants',missing:miss(['riz basmati ou pommes de terre','citron ou herbes fraîches']),preparation:'Cuis le saumon doucement à la vapeur ou en papillote. Garde les carottes et le brocoli légèrement croquants puis sers avec la base et la finition proposées.',explanation:`Cette variante privilégie une cuisson douce et une texture végétale plus croquante. ${intentReason()}`},
        {title:'Saumon rôti · carottes glacées & brocolis',missing:miss(['miel ou moutarde','riz ou quinoa']),preparation:'Rôtis le saumon et le brocoli. Fais revenir les carottes avec une petite touche de miel ou de moutarde si tu l’ajoutes, puis assemble avec la base proposée.',explanation:`Le traitement séparé des carottes donne une variante plus contrastée et gourmande. ${intentReason()}`}
      ];
      return {kind:'salmon_carrot_broccoli',title:`${salmonLabel} rôti · carottes & brocolis`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Commence la cuisson des carottes, ajoute ensuite le brocoli puis le saumon afin de respecter leurs temps de cuisson. Le saumon doit être cuit à cœur selon ton degré de cuisson habituel. Termine avec le complément proposé.',explanation:'Le saumon apporte déjà la protéine et carottes + brocolis la partie végétale. Tee propose surtout une base énergétique ou une finition adaptée plutôt qu’une deuxième protéine.',variants};
    }

    // Poudre d’amandes + beurre + farine : base de pâte/biscuits aux amandes.
    if(almondPowder&&hasButter&&a.flours.length&&!hasSugar){
      const missingBy={equilibre:['œuf','sucre ou sirop d’érable'],digestion:['œuf','sucre ou compote'],energie:['œuf','banane ou sucre'],construire:['œuf','yaourt grec ou sucre'],legerete:['œuf','compote ou sucre'],gourmandise:['sucre','vanille ou chocolat']};
      const variants=[
        {title:'Sablés aux amandes',missing:miss(['sucre','œuf']),preparation:'Mélange farine, poudre d’amandes et beurre sablé du bout des doigts. Ajoute le sucre puis juste assez d’œuf pour lier, forme des biscuits et cuis jusqu’à légère coloration.',explanation:`La matière grasse et la poudre d’amandes indiquent directement une pâte sablée. ${intentReason()}`},
        {title:'Financiers aux amandes',missing:miss(['blancs d’œufs','sucre']),preparation:'Fais fondre le beurre jusqu’à légère coloration, mélange farine, poudre d’amandes et sucre puis incorpore les blancs d’œufs et le beurre. Répartis dans de petits moules et cuis jusqu’à dorure.',explanation:`Avec des blancs d’œufs, la même base devient un financier moelleux. ${intentReason()}`},
        {title:'Crumble aux amandes',missing:miss(['pommes ou poires','sucre']),preparation:'Sable farine, poudre d’amandes, beurre et sucre. Répartis sur les fruits proposés puis cuis jusqu’à obtenir un dessus doré et croustillant.',explanation:`La base sèche devient ici une pâte à crumble plutôt qu’un biscuit. ${intentReason()}`},
        {title:'Gâteau moelleux aux amandes',missing:miss(['œufs','sucre ou miel']),preparation:'Mélange farine et poudre d’amandes, ajoute le beurre fondu puis les œufs et le sucre proposés. Verse dans un moule et cuis jusqu’à ce que le centre soit pris.',explanation:`En augmentant la part d’œufs, la même base devient un gâteau moelleux. ${intentReason()}`},
        {title:'Fond de tarte sablé aux amandes',missing:miss(['œuf','fruits ou chocolat']),preparation:'Sable farine, poudre d’amandes et beurre, ajoute l’œuf pour lier puis étale la pâte dans un moule. Précuis-la avant d’ajouter la garniture proposée.',explanation:`Cette variante transforme les ingrédients en fond de tarte à garnir. ${intentReason()}`}
      ];
      return {kind:'almond_butter_flour',title:'Pâte sablée aux amandes',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Mélange la farine et la poudre d’amandes avec le beurre froid jusqu’à obtenir une texture sableuse. Ajoute le liant et la touche sucrée proposés, rassemble sans trop travailler puis utilise la pâte en biscuits ou en fond de tarte.',explanation:'Farine, poudre d’amandes et beurre forment déjà une base de pâte sablée. Tee propose donc le liant et la touche sucrée nécessaires au lieu de partir vers une recette salée.',variants};
    }

    // Courgettes + ricotta + lardons : gratin/farce crémeuse.
    if(hasZucchini&&ricotta&&hasLardons){
      const missingBy={equilibre:['quinoa ou pain complet','herbes fraîches ou tomates'],digestion:['herbes fraîches ou tomates','riz ou quinoa'],energie:['pâtes ou pommes de terre','tomates ou herbes fraîches'],construire:['quinoa ou pâtes','parmesan ou graines'],legerete:['salade ou tomates','herbes fraîches ou citron'],gourmandise:['parmesan ou mozzarella','pâtes ou pain grillé']};
      const variants=[
        {title:'Courgettes farcies ricotta & lardons',missing:miss(['herbes fraîches ou tomates','quinoa ou salade']),preparation:'Coupe les courgettes en deux et évide-les légèrement. Fais revenir les lardons, mélange-les avec la ricotta et la chair de courgette, garnis puis enfourne jusqu’à ce que les courgettes soient tendres.',explanation:`Le trio devient naturellement une courgette farcie. ${intentReason()}`},
        {title:'Gratin courgettes · ricotta & lardons',missing:miss(['parmesan ou chapelure','salade ou tomates']),preparation:'Fais revenir brièvement les courgettes et les lardons, dispose-les dans un plat avec la ricotta puis ajoute la finition proposée et gratine.',explanation:`La ricotta sert ici de liant crémeux dans un gratin. ${intentReason()}`},
        {title:'Poêlée de courgettes à la ricotta & lardons',missing:miss(['pâtes ou pommes de terre','herbes fraîches ou citron']),preparation:'Fais dorer les lardons, ajoute les courgettes puis baisse le feu et incorpore la ricotta hors du feu ou à feu très doux. Sers avec la base proposée.',explanation:`Cette version reste à la poêle et donne une sauce crémeuse rapide. ${intentReason()}`},
        {title:'Pâtes courgette, ricotta & lardons',missing:miss(['pâtes ou coquillettes','tomates ou épinards']),preparation:'Fais cuire les pâtes proposées, fais revenir lardons et courgettes puis détends la ricotta avec un peu d’eau de cuisson avant de tout mélanger.',explanation:`La ricotta devient une sauce pour pâtes et la courgette apporte la partie végétale. ${intentReason()}`},
        {title:'Roulés de courgette · ricotta & lardons',missing:miss(['parmesan ou herbes fraîches','tomates ou salade']),preparation:'Coupe les courgettes en longues lamelles, grille-les brièvement, garnis-les d’un mélange ricotta-lardons puis roule et passe quelques minutes au four.',explanation:`Les mêmes ingrédients deviennent de petits roulés individuels, très différents d’un gratin. ${intentReason()}`}
      ];
      return {kind:'zucchini_ricotta_lardons',title:'Courgettes gratinées · ricotta & lardons',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Fais revenir les lardons puis ajoute les courgettes sans trop les cuire. Dispose dans un plat, répartis la ricotta et ajoute la finition proposée avant de gratiner quelques minutes.',explanation:'Courgettes, ricotta et lardons constituent déjà une base crémeuse et salée cohérente. Tee ne propose pas une autre protéine et varie plutôt le format : gratin, farce, poêlée ou pâtes.',variants};
    }

    // Chou + tomates + oignon : base mijotée identifiable.
    if(cabbage&&hasTomato&&hasOnion){
      const cabbageName=/rouge/.test(norm(cabbage))?'chou rouge':/vert/.test(norm(cabbage))?'chou vert':/blanc/.test(norm(cabbage))?'chou blanc':'chou';
      const missingBy={equilibre:['pois chiches ou œufs','riz ou pommes de terre'],digestion:['lentilles ou pois chiches','riz basmati ou pommes de terre'],energie:['bœuf haché ou pois chiches','riz ou pain complet'],construire:['bœuf haché ou lentilles','riz ou quinoa'],legerete:['pois chiches ou haricots blancs','herbes fraîches ou citron'],gourmandise:['bœuf haché ou saucisse','pommes de terre ou pain']};
      const variants=[
        {title:`${cap(cabbageName)} braisé tomate & oignon`,missing:miss(['pois chiches ou lentilles','riz ou pommes de terre']),preparation:'Fais fondre l’oignon, ajoute le chou émincé puis les tomates. Couvre et laisse braiser doucement jusqu’à ce que le chou soit tendre, puis ajoute la protéine ou la base proposée.',explanation:`La cuisson braisée concentre tomate et oignon autour du chou. ${intentReason()}`},
        {title:`Poêlée de ${cabbageName} · tomate & oignon`,missing:miss(['œufs ou pois chiches','riz ou quinoa']),preparation:'Fais revenir l’oignon, ajoute le chou finement émincé puis les tomates en fin de cuisson pour garder plus de texture. Complète avec les éléments proposés.',explanation:`La version poêlée reste plus rapide et légèrement croquante. ${intentReason()}`},
        {title:`Soupe rustique de ${cabbageName} à la tomate`,missing:miss(['haricots blancs ou lentilles','pommes de terre ou pain complet']),preparation:'Fais revenir l’oignon, ajoute chou et tomates puis couvre d’eau ou de bouillon. Ajoute les légumineuses ou pommes de terre proposées et laisse mijoter.',explanation:`Les mêmes légumes deviennent une soupe-repas plus réconfortante. ${intentReason()}`},
        {title:'Chou farci express tomate & oignon',missing:miss(['bœuf haché ou lentilles','riz ou quinoa']),preparation:'Fais blanchir quelques grandes feuilles de chou. Prépare une farce avec l’oignon, la tomate, la protéine et un peu de riz ou quinoa proposés, roule puis cuis doucement en sauce.',explanation:`Les feuilles de chou deviennent ici l’enveloppe d’une farce, donc une vraie transformation. ${intentReason()}`},
        {title:`Curry de ${cabbageName} à la tomate`,missing:miss(['curry ou cumin','pois chiches ou lentilles']),preparation:'Fais revenir l’oignon avec les épices proposées, ajoute le chou puis les tomates et laisse mijoter. Ajoute les légumineuses si tu les choisis.',explanation:`L’ajout d’épices transforme la base tomate-oignon en curry végétal. ${intentReason()}`}
      ];
      return {kind:'cabbage_tomato_onion',title:`${cap(cabbageName)} mijoté · tomate & oignon`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Fais fondre l’oignon, ajoute le chou finement émincé puis les tomates. Laisse mijoter à couvert jusqu’à ce que le chou soit tendre, puis ajoute le complément proposé pour structurer le repas.',explanation:'Chou, tomates et oignon forment déjà une base mijotée identifiable. Comme elle est surtout végétale, Tee propose selon l’intention une protéine ou une base énergétique plutôt qu’un autre légume au hasard.',variants};
    }

    // Base pâtissière incomplète : farine + sucre + cacao/chocolat.
    if(a.flours.length&&hasSugar&&hasCocoa&&!pastry){
      const missingBy={
        equilibre:['œufs','lait ou boisson végétale'],digestion:['œufs','lait ou boisson végétale'],energie:['œufs','banane ou flocons d’avoine'],
        construire:['œufs','yaourt grec ou fromage blanc'],legerete:['œufs','lait ou boisson végétale'],gourmandise:['œufs','beurre ou huile neutre']
      };
      const variants=[
        {title:'Brownie cacao maison',missing:miss(['œufs','beurre ou huile neutre']),preparation:'Mélange la farine, le sucre et le cacao. Ajoute les œufs puis un peu de beurre fondu ou d’huile neutre, verse dans un petit moule et cuis jusqu’à garder un cœur légèrement fondant.',explanation:`La même base sèche devient un brownie en ajoutant le liant et la matière grasse nécessaires. ${intentReason()}`},
        {title:'Muffins cacao',missing:miss(['œufs','lait ou boisson végétale']),preparation:'Mélange les ingrédients secs, ajoute les œufs puis juste assez de lait pour obtenir une pâte souple. Répartis dans des moules et cuis jusqu’à ce que les muffins soient pris.',explanation:`La cuisson en portions individuelles transforme la base en muffins plutôt qu’en gâteau unique. ${intentReason()}`},
        {title:'Pancakes cacao',missing:miss(['œufs','lait ou boisson végétale']),preparation:'Mélange farine, cacao et une petite partie du sucre. Ajoute les œufs puis le lait progressivement et cuis de petites louches à la poêle.',explanation:`La base cacao devient ici une pâte minute cuite à la poêle, donc une texture très différente. ${intentReason()}`},
        {title:'Cookies cacao',missing:miss(['beurre ou huile neutre','œufs']),preparation:'Mélange farine, cacao et sucre avec le beurre ramolli, puis ajoute un œuf pour lier. Forme de petites boules, aplatis-les légèrement et cuis jusqu’à ce que les bords soient pris.',explanation:`Le rapport plus riche en matière grasse transforme la base en biscuits cacao. ${intentReason()}`},
        {title:'Gâteau cacao moelleux',missing:miss(['œufs','lait ou boisson végétale']),preparation:'Mélange les ingrédients secs, ajoute les œufs puis le lait progressivement. Verse dans un moule et cuis jusqu’à ce que la lame ressorte avec quelques miettes humides.',explanation:`C’est la version la plus simple pour transformer les trois ingrédients secs en vrai gâteau moelleux. ${intentReason()}`}
      ];
      return {kind:'cocoa_baking_base',title:'Gâteau cacao express',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Mélange la farine, le sucre et le cacao non sucré. Ajoute les œufs puis le liquide proposé jusqu’à obtenir une pâte homogène, verse dans un petit moule et cuis jusqu’à ce que le centre soit juste pris.',explanation:'Tee reconnaît ici une base sèche de pâtisserie chocolatée. Il ne propose donc aucun ingrédient salé : « À prévoir » sert uniquement à apporter le liant et l’humidité indispensables.',variants};
    }

    // Tarte chocolat / pâte sablée + chocolat + crème.
    if(pastry&&isSablee&&hasCocoa&&cream){
      const missingBy={equilibre:['framboises ou noisettes'],digestion:['zeste d’orange ou cardamome'],energie:['banane ou flocons d’avoine'],construire:['yaourt grec ou fromage blanc'],legerete:['framboises ou noisettes'],gourmandise:['fleur de sel ou noisettes']};
      const variants=[
        {title:'Tartelettes chocolat',missing:miss(['framboises ou noisettes']),preparation:'Découpe la pâte sablée en petits disques, fonce des moules et cuis-les à blanc. Verse ensuite une ganache faite avec le chocolat et la crème chaude, puis laisse prendre au frais.',explanation:`Le format individuel transforme la tarte en tartelettes faciles à servir. ${intentReason()}`},
        {title:'Tarte chocolat & noisettes',missing:miss(['framboises ou noisettes']),preparation:'Cuis la pâte sablée à blanc. Prépare la ganache chocolat-crème, verse-la dans le fond puis ajoute quelques noisettes concassées avant refroidissement.',explanation:`Le croquant des noisettes change la texture de la tarte tout en conservant les mêmes ingrédients principaux. ${intentReason()}`},
        {title:'Carrés sablés ganache chocolat',missing:miss(['fleur de sel ou noisettes']),preparation:'Cuis la pâte sablée dans un moule carré, verse la ganache chocolat-crème dessus puis laisse figer. Coupe en petits carrés une fois bien froid.',explanation:`La présentation en carrés donne une bouchée plus dense et différente d’une tarte classique. ${intentReason()}`},
        {title:'Tarte chocolat & fruits rouges',missing:miss(['framboises ou noisettes']),preparation:'Cuis le fond sablé, verse la ganache puis laisse légèrement prendre avant d’ajouter les fruits rouges frais sur le dessus.',explanation:`L’ajout fruité apporte fraîcheur et acidité à la ganache. ${intentReason()}`}
      ];
      return {kind:'sweet_chocolate_tart',title:'Tarte au chocolat · ganache minute',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Fonce la pâte sablée dans un moule et cuis-la à blanc. Chauffe la crème liquide, verse-la sur le chocolat pâtissier, mélange jusqu’à obtenir une ganache lisse puis verse-la sur le fond refroidi. Laisse prendre au frais.',explanation:'La pâte sablée, le chocolat pâtissier et la crème liquide forment déjà une tarte au chocolat complète. « À prévoir » sert seulement à ajouter une finition adaptée à ton intention.',variants};
    }

    // Tarte/quiche autour d’une pâte feuilletée ou brisée et de lardons.
    if(pastry&&(isFeuilletee||isBrisee)&&hasLardons){
      const missingBy={equilibre:['oignon ou poireau','salade verte ou roquette'],digestion:['poireau ou courgette','salade verte ou roquette'],energie:['oignon ou poireau','tomates ou brocoli'],construire:['œufs','salade verte ou roquette'],legerete:['poireau ou courgette','salade verte ou roquette'],gourmandise:['oignon ou poireau','parmesan ou chapelure']};
      const baseTitle=isFeuilletee?'Tarte fine crème & lardons':'Quiche crème & lardons';
      const variants=[
        {title:isFeuilletee?'Quiche feuilletée aux lardons':'Quiche aux lardons',missing:miss(['œufs','oignon ou poireau']),preparation:'Dispose la pâte dans le moule. Fais revenir les lardons, mélange-les avec la crème et les œufs proposés, ajoute l’oignon ou le poireau puis cuis jusqu’à ce que l’appareil soit pris.',explanation:`L’ajout d’œufs transforme la tarte fine en véritable quiche. ${intentReason()}`},
        {title:'Tarte fine lardons & oignons',missing:miss(['oignon ou poireau','salade verte ou roquette']),preparation:'Étale la pâte, ajoute une fine couche de crème, les lardons revenus et l’oignon émincé, puis cuis au four jusqu’à ce que les bords soient bien dorés.',explanation:`Cette variante reste fine et croustillante, sans appareil épais. ${intentReason()}`},
        {title:'Tartelettes crème & lardons',missing:miss(['oignon ou poireau','herbes fraîches ou citron']),preparation:'Découpe la pâte en petits cercles, garnis-les de crème, lardons et aromates puis cuis en portions individuelles.',explanation:`Le format tartelette change réellement la présentation et la texture des bords. ${intentReason()}`},
        {title:'Feuilletés lardons & fromage',missing:miss(['feta ou parmesan','herbes fraîches ou citron']),preparation:'Découpe la pâte en rectangles, ajoute les lardons, une pointe de crème et le fromage proposé, replie puis cuis jusqu’à obtenir un feuilletage doré.',explanation:`La pâte devient ici un feuilleté fermé plutôt qu’une tarte ouverte. ${intentReason()}`},
        {title:'Torsades feuilletées aux lardons',missing:miss(['parmesan ou chapelure','herbes fraîches ou citron']),preparation:'Répartis une très fine couche de crème et les lardons hachés sur la pâte, découpe des bandes, torsade-les puis cuis au four.',explanation:`La même base devient une bouchée croustillante à partager. ${intentReason()}`}
      ];
      return {kind:'savory_pastry_lardons',title:baseTitle,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Étale ${withArticle(pastry)}, ajoute une fine couche de ${cream?lower(cream):'crème fraîche'}, répartis les lardons puis ajoute le complément proposé. Enfourne jusqu’à ce que la pâte soit bien dorée et croustillante.`,explanation:'Tee reconnaît une vraie base de tarte salée : pâte + crème + lardons. Il n’interprète plus « pâte feuilletée » comme des pâtes alimentaires.',variants};
    }

    // Burrata + avocat + tomates.
    if(hasBurrata&&hasAvocado&&hasTomato){
      const missingBy={equilibre:['basilic ou pain grillé'],digestion:['basilic ou herbes fraîches'],energie:['pain complet ou semoule'],construire:['pain complet ou semoule'],legerete:['basilic ou herbes fraîches'],gourmandise:['basilic ou pain grillé']};
      const variants=[
        {title:'Bruschetta burrata · avocat & tomates cerises',missing:miss(['pain complet ou semoule','basilic ou herbes fraîches']),preparation:'Fais griller le pain proposé, écrase ou tranche l’avocat, ajoute les tomates cerises puis dépose la burrata au-dessus. Termine avec du basilic.',explanation:`Le pain transforme l’assiette fraîche en bruschetta complète et croustillante. ${intentReason()}`},
        {title:'Salade burrata, avocat & tomates cerises',missing:miss(['basilic ou herbes fraîches','graines de courge ou sésame']),preparation:'Coupe l’avocat et les tomates cerises, dispose-les autour de la burrata puis assaisonne simplement avec les herbes ou graines proposées.',explanation:`Cette variante conserve tout à froid et met la fraîcheur au centre. ${intentReason()}`},
        {title:'Bowl méditerranéen · burrata & avocat',missing:miss(['quinoa ou pois chiches','basilic ou herbes fraîches']),preparation:'Ajoute la base proposée dans un bol, puis répartis avocat, tomates cerises et burrata. Termine avec les herbes fraîches.',explanation:`L’ajout d’une base ou de légumineuses transforme l’ensemble en bowl plus structuré. ${intentReason()}`},
        {title:'Tartines avocat, burrata & tomates',missing:miss(['pain complet ou semoule','basilic ou herbes fraîches']),preparation:'Fais griller le pain, étale l’avocat, ajoute les tomates puis des morceaux de burrata. Termine avec les herbes fraîches.',explanation:`Le même trio devient une tartine ouverte, différente de la salade. ${intentReason()}`}
      ];
      return {kind:'burrata_avocado_tomato',title:'Burrata · avocat & tomates cerises',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Coupe l’avocat et les tomates cerises. Dispose-les autour de la burrata, puis ajoute la finition proposée juste avant de servir. Garde l’ensemble frais.',explanation:'Burrata, avocat et tomates cerises forment déjà une assiette fraîche cohérente. Tee ne propose pas une autre protéine : « À prévoir » sert à apporter des herbes, du croquant ou une base selon ton intention.',variants};
    }

    // Pâtes/coquillettes + vin blanc + fromage.
    if(pasta&&wine&&cheese){
      const cheeseName=/chevre/.test(norm(cheese))?'chèvre':lower(cheese);
      const pastaName=/coquillette/.test(norm(pasta))?'Coquillettes':cap(lower(pasta));
      const missingBy={equilibre:['échalote ou champignons'],digestion:['courgette ou champignons'],energie:['champignons ou épinards'],construire:['champignons ou épinards'],legerete:['courgette ou champignons'],gourmandise:['échalote ou champignons']};
      const variants=[
        {title:`${pastaName} risottées au ${cheeseName}`,missing:miss(['échalote ou champignons','bouillon ou miso']),preparation:`Fais revenir l’échalote, ajoute les ${lower(pasta)} puis mouille progressivement avec un peu de bouillon et de vin blanc. Termine avec le ${cheeseName} hors du feu.`,explanation:`La cuisson façon risotto rend les pâtes plus crémeuses sans ajouter une sauce lourde. ${intentReason()}`},
        {title:`Gratin de ${lower(pasta)} au ${cheeseName}`,missing:miss(['champignons ou épinards','parmesan ou chapelure']),preparation:`Fais cuire les pâtes légèrement fermes. Réduis le vin blanc quelques instants, ajoute le fromage, mélange aux pâtes puis gratine avec la finition proposée.`,explanation:`Le passage au four transforme la sauce crémeuse en gratin. ${intentReason()}`},
        {title:`${pastaName} au ${cheeseName} & champignons`,missing:miss(['échalote ou champignons','herbes fraîches ou citron']),preparation:`Fais revenir les champignons et l’échalote, déglace au vin blanc puis ajoute le fromage. Mélange aux pâtes juste avant de servir.`,explanation:`Les champignons donnent une version plus végétale et très différente de la sauce seule. ${intentReason()}`},
        {title:`Poêlée de ${lower(pasta)} · ${cheeseName} & vin blanc`,missing:miss(['épinards ou courgette','herbes fraîches ou citron']),preparation:`Fais sauter les pâtes déjà cuites avec le légume proposé, déglace rapidement au vin blanc puis ajoute le fromage à feu doux.`,explanation:`La sauce devient plus courte et enrobante dans une poêlée plutôt qu’une préparation très crémeuse. ${intentReason()}`}
      ];
      return {kind:'pasta_wine_cheese',title:`${pastaName} crémeuses au ${cheeseName} & vin blanc`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Fais cuire les ${lower(pasta)}. Fais réduire un petit trait de vin blanc avec l’aromate proposé, baisse le feu puis ajoute le ${cheeseName} pour obtenir une sauce courte. Mélange avec les pâtes et ajoute le légume proposé si tu le choisis.`,explanation:'Tee reconnaît ici le vin blanc comme élément de cuisson et le fromage comme base de sauce. Il ne traite plus les coquillettes comme un ingrédient inconnu.',variants};
    }

    // Aubergines + ail + oignon.
    if(hasEggplant&&hasOnion&&hasGarlic&&!a.savoryProteins.length&&!a.starches.length){
      const missingBy={equilibre:['pois chiches ou feta','semoule ou quinoa'],digestion:['tomates ou courgette','herbes fraîches ou citron'],energie:['semoule ou quinoa','pois chiches ou feta'],construire:['pois chiches ou feta','semoule ou quinoa'],legerete:['tomates ou courgette','herbes fraîches ou citron'],gourmandise:['feta ou parmesan','tomates ou herbes fraîches']};
      const variants=[
        {title:'Caviar d’aubergine ail & oignon',missing:miss(['citron ou herbes fraîches','pain complet ou semoule']),preparation:'Rôtis les aubergines jusqu’à ce qu’elles soient très fondantes. Écrase la chair avec l’ail et l’oignon cuits, puis termine avec le citron ou les herbes proposés.',explanation:`La texture devient crémeuse et tartinable, très différente d’une poêlée. ${intentReason()}`},
        {title:'Aubergines rôties ail & oignon',missing:miss(['feta ou graines','semoule ou quinoa']),preparation:'Coupe les aubergines, mélange-les avec l’ail et l’oignon puis rôtis-les jusqu’à coloration. Ajoute la finition proposée après cuisson.',explanation:`Le four concentre les saveurs et donne des bords dorés. ${intentReason()}`},
        {title:'Poêlée aubergine, tomate & ail',missing:miss(['tomates ou herbes fraîches','pois chiches ou feta']),preparation:'Fais fondre l’oignon, ajoute l’ail puis les aubergines. Incorpore les tomates proposées et laisse compoter doucement.',explanation:`La tomate transforme le trio en poêlée fondante et légèrement saucée. ${intentReason()}`},
        {title:'Aubergines farcies express',missing:miss(['pois chiches ou feta','tomates ou herbes fraîches']),preparation:'Précuis les demi-aubergines, récupère un peu de chair et mélange-la avec ail, oignon et la garniture proposée. Replace dans les coques puis gratine.',explanation:`Le même légume devient un plat farci plutôt qu’un simple accompagnement. ${intentReason()}`}
      ];
      return {kind:'eggplant_onion_garlic',title:'Aubergines fondantes · ail & oignon',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Fais fondre l’oignon, ajoute l’ail puis les aubergines en dés. Cuis doucement jusqu’à ce qu’elles soient bien fondantes, puis ajoute le complément proposé selon ton intention.',explanation:'Aubergine, ail et oignon constituent déjà une vraie base culinaire. Tee construit donc une préparation autour de ce trio au lieu de répondre par une simple « assiette végétale ».',variants};
    }

    // Bœuf haché + pommes de terre + oignon.
    if(groundBeef&&potato&&hasOnion){
      const missingBy={equilibre:['tomates ou courgette'],digestion:['courgette ou carottes'],energie:['tomates ou brocoli'],construire:['épinards ou courgette'],legerete:['salade ou courgette'],gourmandise:['feta ou parmesan']};
      const variants=[
        {title:'Hachis express bœuf & pommes de terre',missing:miss(['lait','muscade ou ail']),preparation:'Fais cuire les pommes de terre puis écrase-les avec un peu de lait. Fais revenir le bœuf haché avec l’oignon, couvre de purée et gratine quelques minutes.',explanation:`Le trio devient un hachis en superposant viande et purée. ${intentReason()}`},
        {title:'Pommes de terre farcies au bœuf',missing:miss(['herbes fraîches ou citron','feta ou parmesan']),preparation:'Précuis les pommes de terre, creuse-les légèrement puis garnis-les de bœuf haché revenu avec l’oignon. Termine avec la finition proposée et repasse au four.',explanation:`La pomme de terre devient le contenant du plat, ce qui change complètement la présentation. ${intentReason()}`},
        {title:'Skillet bœuf · pommes de terre & oignon',missing:miss(['tomates ou courgette','paprika ou herbes fraîches']),preparation:'Fais dorer les pommes de terre en dés, ajoute l’oignon puis le bœuf haché. Termine avec le légume et les épices proposés.',explanation:`Cette version tout-en-un mise sur le croustillant des pommes de terre. ${intentReason()}`},
        {title:'Boulettes de bœuf & pommes sautées',missing:miss(['herbes fraîches ou citron','salade ou courgette']),preparation:'Assaisonne le bœuf, forme de petites boulettes et fais-les dorer. Sers-les avec les pommes de terre sautées et l’oignon fondant.',explanation:`Le bœuf change de forme en boulettes tandis que les pommes de terre restent sautées. ${intentReason()}`}
      ];
      return {kind:'beef_potato_onion',title:'Poêlée de pommes de terre · bœuf & oignon',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Fais dorer les pommes de terre en dés. Ajoute l’oignon puis le bœuf haché et cuis jusqu’à coloration complète. Incorpore le légume proposé au moment adapté.',explanation:'Pommes de terre, bœuf haché et oignon forment déjà une base complète et identifiable. Tee les exploite ensemble au lieu de produire une poêlée générique.',variants};
    }

    // Pommes grenailles + huile d’olive + beurre.
    if(potato&&/grenaille/.test(norm(potato))&&hasOliveOil&&hasButter){
      const missingBy={equilibre:['persil ou romarin'],digestion:['romarin ou herbes fraîches'],energie:['ail ou romarin'],construire:['œufs ou poulet'],legerete:['herbes fraîches ou citron'],gourmandise:['ail ou romarin']};
      const variants=[
        {title:'Pommes grenailles écrasées & rôties',missing:miss(['ail ou romarin','herbes fraîches ou citron']),preparation:'Précuis les grenailles, écrase-les légèrement sur une plaque, ajoute un filet d’huile d’olive et quelques noisettes de beurre puis rôtis jusqu’à ce que les bords soient croustillants.',explanation:`Les pommes de terre deviennent plus croustillantes grâce à l’écrasement. ${intentReason()}`},
        {title:'Grenailles sautées ail & herbes',missing:miss(['ail ou romarin','persil ou romarin']),preparation:'Fais dorer les grenailles à la poêle avec l’huile, ajoute un peu de beurre en fin de cuisson puis l’ail et les herbes.',explanation:`La cuisson à la poêle donne une croûte différente du rôtissage au four. ${intentReason()}`},
        {title:'Grenailles rôties au romarin',missing:miss(['persil ou romarin','ail ou herbes fraîches']),preparation:'Mélange les grenailles avec l’huile d’olive et le romarin, rôtis-les puis ajoute le beurre seulement en fin de cuisson pour les enrober.',explanation:`Le romarin donne une version très aromatique et simple. ${intentReason()}`},
        {title:'Salade tiède de pommes grenailles',missing:miss(['salade ou herbes fraîches','moutarde ou citron']),preparation:'Rôtis les grenailles avec l’huile et une petite noix de beurre. Laisse-les tiédir puis mélange-les avec la salade et l’assaisonnement proposés.',explanation:`Le même accompagnement devient une salade tiède avec contraste chaud-frais. ${intentReason()}`}
      ];
      return {kind:'grenaille_fats',title:'Pommes grenailles rôties · huile d’olive & beurre',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Mélange les pommes grenailles avec un filet d’huile d’olive, rôtis-les jusqu’à ce qu’elles soient dorées puis ajoute une petite noix de beurre en fin de cuisson. Termine avec les herbes proposées.',explanation:'Les pommes grenailles, l’huile d’olive et le beurre indiquent déjà une cuisson rôtie ou sautée. Tee utilise les matières grasses présentes plutôt que d’en proposer une autre.',variants};
    }

    // Pommes de terre + salade iceberg + tomates.
    if(potato&&a.freshLeafy.length&&hasTomato&&!a.savoryProteins.length){
      const leaf=first(a.freshLeafy);
      const missingBy={equilibre:['œufs ou thon','moutarde ou yaourt nature'],digestion:['œufs ou pois chiches','herbes fraîches ou citron'],energie:['œufs ou thon','avocat ou graines'],construire:['thon ou pois chiches','œufs ou feta'],legerete:['œufs ou pois chiches','citron ou herbes fraîches'],gourmandise:['feta ou parmesan','moutarde ou yaourt nature']};
      const variants=[
        {title:'Salade tiède pommes de terre & iceberg',missing:miss(['œufs ou thon','moutarde ou yaourt nature']),preparation:`Fais cuire les pommes de terre, laisse-les tiédir puis ajoute ${withArticle(leaf)} et les tomates. Termine avec la protéine et la sauce proposées.`,explanation:`La base reste fraîche mais les pommes de terre sont servies tièdes pour créer un contraste de températures. ${intentReason()}`},
        {title:'Bowl pommes de terre · iceberg & tomates',missing:miss(['thon ou pois chiches','avocat ou graines']),preparation:'Dispose les pommes de terre en base du bol, ajoute l’iceberg et les tomates fraîches puis la garniture proposée.',explanation:`Le bowl garde chaque élément visible et permet d’ajouter facilement la protéine proposée. ${intentReason()}`},
        {title:'Pommes de terre écrasées & salade fraîche',missing:miss(['œufs ou feta','herbes fraîches ou citron']),preparation:'Écrase légèrement les pommes de terre encore chaudes, assaisonne-les puis sers-les avec l’iceberg et les tomates bien fraîches.',explanation:`La texture des pommes de terre change complètement tandis que les crudités restent intactes. ${intentReason()}`},
        {title:'Salade de pommes de terre sauce légère',missing:miss(['moutarde ou yaourt nature','œufs ou thon']),preparation:'Laisse refroidir les pommes de terre, mélange-les avec une sauce légère à la moutarde ou au yaourt puis ajoute iceberg et tomates juste avant de servir.',explanation:`Cette version lie les pommes de terre avec une sauce légère au lieu de les servir séparément. ${intentReason()}`}
      ];
      return {kind:'potato_fresh_salad',title:`Salade de pommes de terre · ${lower(leaf)} & tomates`,missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Fais cuire les pommes de terre puis laisse-les tiédir. Ajoute ${withArticle(leaf)} et les tomates seulement au moment de servir pour conserver leur fraîcheur, puis complète avec les éléments proposés.`,explanation:'Les pommes de terre apportent la base énergétique et l’iceberg avec les tomates constitue déjà la partie végétale fraîche. Tee propose donc surtout une protéine ou une sauce cohérente.',variants};
    }

    // Ailes de poulet + pâtes + huile.
    if(wings&&pasta){
      const missingBy={equilibre:['tomates ou brocoli'],digestion:['courgette ou carottes'],energie:['tomates ou brocoli'],construire:['épinards ou courgette'],legerete:['salade ou courgette'],gourmandise:['parmesan ou chapelure']};
      const variants=[
        {title:'Ailes de poulet épicées & pâtes',missing:miss(['paprika ou herbes fraîches','tomates ou brocoli']),preparation:'Assaisonne les ailes avec le paprika ou les herbes, cuis-les au four jusqu’à ce qu’elles soient bien dorées et sers-les avec les pâtes et le légume proposé.',explanation:`Les ailes restent au centre mais l’assaisonnement change la direction du plat. ${intentReason()}`},
        {title:'Pâtes tomate & ailes de poulet rôties',missing:miss(['tomates ou brocoli','herbes fraîches ou citron']),preparation:'Rôtis les ailes avec l’huile déjà présente. Prépare une sauce tomate courte pour les pâtes puis sers les ailes à côté.',explanation:`Les pâtes deviennent saucées tandis que les ailes gardent leur texture rôtie. ${intentReason()}`},
        {title:'Salade de pâtes & ailes de poulet',missing:miss(['salade ou tomates','moutarde ou citron']),preparation:'Rôtis les ailes, cuis les pâtes puis laisse-les refroidir. Mélange les pâtes avec les crudités et l’assaisonnement proposés, et sers les ailes à côté.',explanation:`Cette version transforme les pâtes en salade froide, très différente de l’assiette chaude. ${intentReason()}`},
        {title:'Ailes de poulet & pâtes gratinées',missing:miss(['parmesan ou chapelure','épinards ou courgette']),preparation:'Rôtis les ailes séparément. Mélange les pâtes avec le légume proposé, ajoute la finition gratinée puis passe-les au four quelques minutes.',explanation:`Le gratin change la texture des pâtes sans ramollir les ailes. ${intentReason()}`}
      ];
      return {kind:'wings_pasta',title:'Ailes de poulet rôties & pâtes',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:`Enrobe les ailes de poulet avec ${hasSunflower?'un peu d’huile de tournesol':'la matière grasse que tu as'} et cuis-les au four jusqu’à ce qu’elles soient bien dorées et complètement cuites. Fais cuire les pâtes à part puis ajoute le légume proposé au moment adapté.`,explanation:'Tee reconnaît les ailes de poulet comme la protéine et les pâtes comme la base énergétique. L’huile sert à la cuisson : elle n’est pas traitée comme un ingrédient principal.',variants};
    }

    // Pommes de terre + crème fraîche + lait.
    if(potato&&cream&&hasMilk&&!a.savoryProteins.length){
      const missingBy={equilibre:['ail ou muscade','salade verte ou roquette'],digestion:['muscade ou ail','salade ou haricots verts'],energie:['ail ou muscade','œufs ou poulet'],construire:['œufs ou poulet','légumes verts ou tomates'],legerete:['salade ou haricots verts','muscade ou ail'],gourmandise:['ail ou muscade','feta ou parmesan']};
      const variants=[
        {title:'Gratin dauphinois façon maison',missing:miss(['ail ou muscade','salade verte ou roquette']),preparation:'Coupe les pommes de terre en fines rondelles, frotte le plat avec l’ail si tu l’ajoutes, couvre avec le mélange lait-crème et cuis doucement jusqu’à fondant.',explanation:`La cuisson lente dans le lait et la crème donne la version gratin la plus évidente. ${intentReason()}`},
        {title:'Purée crémeuse de pommes de terre',missing:miss(['muscade ou ail','œufs ou poulet']),preparation:'Fais cuire les pommes de terre, écrase-les puis incorpore progressivement le lait chaud et une petite quantité de crème. Termine avec la muscade.',explanation:`Les mêmes produits laitiers servent ici à une purée plutôt qu’à un gratin. ${intentReason()}`},
        {title:'Pommes de terre fondantes à la crème',missing:miss(['ail ou herbes fraîches','légumes verts ou tomates']),preparation:'Fais précuire les pommes de terre en rondelles puis termine-les à feu doux avec lait, crème et aromates jusqu’à obtenir une sauce courte.',explanation:`La cuisson en casserole donne une texture fondante sans passer par le gratin. ${intentReason()}`},
        {title:'Velouté de pommes de terre crémeux',missing:miss(['poireau ou courgette','herbes fraîches ou citron']),preparation:'Fais cuire les pommes de terre avec le légume proposé dans de l’eau ou du bouillon, mixe puis ajoute un peu de lait et de crème en fin de cuisson.',explanation:`Le trio devient un velouté, donc une forme complètement différente. ${intentReason()}`}
      ];
      return {kind:'potato_cream_milk',title:'Gratin de pommes de terre crémeux',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Coupe les pommes de terre en fines rondelles, dispose-les dans un plat puis verse un mélange de lait et de crème fraîche assaisonné. Ajoute l’ail ou la muscade proposés et cuis doucement jusqu’à ce que les pommes de terre soient fondantes.',explanation:'Pommes de terre, crème fraîche et lait forment déjà une base de gratin ou de préparation crémeuse. Tee oriente donc « À prévoir » vers l’assaisonnement et l’accompagnement.',variants};
    }

    // Courgettes + pommes de terre + ail.
    if(potato&&hasZucchini&&hasGarlic&&!a.savoryProteins.length){
      const missingBy={equilibre:['œufs ou poulet','herbes fraîches ou citron'],digestion:['herbes fraîches ou citron','œufs ou pois chiches'],energie:['œufs ou poulet','feta ou parmesan'],construire:['œufs ou poulet','feta ou parmesan'],legerete:['herbes fraîches ou citron','œufs ou pois chiches'],gourmandise:['feta ou parmesan','herbes fraîches ou citron']};
      const variants=[
        {title:'Courgettes & pommes de terre rôties à l’ail',missing:miss(['herbes fraîches ou citron','œufs ou poulet']),preparation:'Coupe les légumes en morceaux, mélange-les avec l’ail et un filet d’huile si tu en as puis rôtis jusqu’à ce que les pommes de terre soient dorées et les courgettes tendres.',explanation:`Le four donne une texture rôtie et concentre l’ail. ${intentReason()}`},
        {title:'Gratin courgettes & pommes de terre',missing:miss(['feta ou parmesan','ail ou muscade']),preparation:'Précuis légèrement les pommes de terre, alterne-les avec les courgettes et l’ail dans un plat, ajoute la finition proposée puis gratine.',explanation:`Le passage au four et le fromage éventuel donnent une préparation liée et gratinée. ${intentReason()}`},
        {title:'Galettes courgette-pomme de terre',missing:miss(['œufs','herbes fraîches ou citron']),preparation:'Râpe courgettes et pommes de terre, presse-les bien, ajoute l’ail et l’œuf proposé puis forme de petites galettes et fais-les dorer.',explanation:`Les légumes changent totalement de forme en devenant des galettes croustillantes. ${intentReason()}`},
        {title:'Velouté courgette-pomme de terre à l’ail',missing:miss(['herbes fraîches ou citron','yaourt aux herbes ou citron']),preparation:'Fais cuire courgettes, pommes de terre et ail dans un peu d’eau ou de bouillon puis mixe jusqu’à texture lisse. Termine avec la finition proposée.',explanation:`Les mêmes légumes deviennent un velouté doux et homogène. ${intentReason()}`}
      ];
      return {kind:'zucchini_potato_garlic',title:'Poêlée courgettes & pommes de terre à l’ail',missing:miss(missingBy[intent]||missingBy.equilibre),preparation:'Fais dorer les pommes de terre en petits dés, ajoute les courgettes quand elles ont déjà commencé à colorer puis ajoute l’ail en fin de cuisson pour éviter qu’il ne brûle. Complète avec la suggestion proposée.',explanation:'Courgettes, pommes de terre et ail constituent déjà une vraie poêlée. Tee respecte leurs temps de cuisson différents et propose seulement ce qui peut compléter le plat.',variants};
    }
    return null;
  }
  function culinaryCombination(input){
    const familyCombo=ingredientFamilyCombination(input);if(familyCombo)return familyCombo;
    const a=analyzeIngredients(input),n=norm(input),rawProtein=first(a.savoryProteins);
    if(!rawProtein)return null;
    const protein=canonicalProteinLabel(rawProtein),P=cap(protein),article=withArticle(protein);
    const hasMustard=/\bmoutarde\b/.test(n),hasLemon=/\bcitron(?: jaune| vert)?\b/.test(n),hasGarlic=/\bail\b/.test(n),hasGinger=/\bgingembre\b/.test(n);
    const hasSoy=/\b(?:sauce soja|tamari)\b/.test(n),hasCurry=/\b(?:curry|colombo)\b/.test(n),hasCoconut=/\b(?:lait de coco|creme de coco)\b/.test(n);
    const hasTomato=/\btomates?\b/.test(n),hasOnion=/\boignons?\b/.test(n),hasHerbs=FOOD_RX.herb.test(n);
    const bread=first(a.starches.filter(x=>/\b(?:pains?|petits? pains?|baguette|bagel|buns?|ciabatta|panini|pita|muffins? anglais?)\b/.test(norm(x))));
    const freshCheese=first(a.freshCheeses);
    const completeCook=`Fais cuire ${article} jusqu’à cuisson complète.`;
    if(bread&&freshCheese){
      const breadName=breadDisplay(bread),cheeseName=freshCheeseDisplay(freshCheese);
      const missingByIntent={
        equilibre:['salade ou tomates','concombre ou tomates'],
        digestion:['salade ou concombre','herbes fraîches ou citron'],
        energie:['tomates ou avocat','salade ou tomates'],
        construire:['salade ou tomates','avocat ou graines'],
        legerete:['salade ou concombre','tomates ou herbes fraîches'],
        gourmandise:['tomates ou pesto','salade ou tomates']
      };
      const missing=[firstAbsentSuggestion(input,missingByIntent[intent]||missingByIntent.equilibre)];
      const variants=[
        {title:`Sandwich chaud · ${protein} & ${cheeseName}`,missing:[firstAbsentSuggestion(input,['salade ou tomates','tomates ou avocat'])],preparation:`Ouvre le pain, tartine ${lower(cheeseName)}, ajoute ${article} cuit et réchauffe quelques minutes. Ajoute les feuilles, tomates ou autres crudités seulement après la chauffe.`,explanation:`Le pain, ${lower(cheeseName)} et ${article} forment déjà une base de sandwich. Tee utilise cette structure au lieu de proposer une assiette séparée. ${intentReason()}`},
        {title:`${breadName} · ${protein}, ${cheeseName} & crudités`,missing:[firstAbsentSuggestion(input,['salade ou tomates','concombre ou tomates'])],preparation:`Réchauffe le pain si nécessaire, tartine ${lower(cheeseName)}, ajoute ${article} puis les crudités proposées au dernier moment pour garder leur fraîcheur.`,explanation:`Cette variante garde le pain chaud et transforme la finition avec des crudités fraîches. ${intentReason()}`},
        {title:`Tartine chaude · ${protein} & ${cheeseName}`,missing:[firstAbsentSuggestion(input,['tomates ou pesto','herbes fraîches ou citron'])],preparation:`Ouvre le pain ou coupe-le en deux, tartine ${lower(cheeseName)}, ajoute ${article} et passe brièvement au four ou sous le gril. Termine avec les éléments frais après cuisson.`,explanation:`La même base devient une tartine ouverte, plus croustillante et différente du sandwich fermé. ${intentReason()}`},
        {title:`Sandwich frais · ${protein}, ${cheeseName} & salade`,missing:[firstAbsentSuggestion(input,['salade ou concombre','tomates ou herbes fraîches'])],preparation:`Laisse le pain refroidir s’il a été précuit, tartine ${lower(cheeseName)}, ajoute ${article} froid ou tiède puis les crudités. Referme juste avant de servir.`,explanation:`Cette version privilégie une préparation froide et fraîche avec les mêmes trois ingrédients de départ. ${intentReason()}`}
      ];
      return {kind:'bread_fresh_cheese',title:`${breadName} · ${protein} & ${cheeseName}`,missing,preparation:`Réchauffe ou termine la cuisson du pain. Tartine ${lower(cheeseName)}, ajoute ${article} déjà cuit ou saisi, puis complète avec ${addableLabel(missing[0])}. Garde les crudités hors du four et ajoute-les seulement au moment de servir.`,explanation:`Tee reconnaît ici une base de petit pain garni : pain + ${article} + ${lower(cheeseName)}. « À prévoir » sert donc à apporter de la fraîcheur ou une finition, sans proposer une deuxième protéine ni un autre féculent.`,variants};
    }
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
      const hasRice=a.starches.some(x=>/\briz\b/.test(norm(x)));
      const variants=[
        {title:`Curry coco de ${protein}${hasRice?' & riz':''}`,missing:[firstAbsentSuggestion(input,['épinards ou courgette','poivron ou courgette'])],preparation:`Fais revenir le curry, ajoute ${article}, puis verse le lait ou la crème de coco. Ajoute le légume proposé et laisse mijoter doucement jusqu’à cuisson complète${hasRice?', puis sers avec le riz':''}.`,explanation:`Cette version assume pleinement la sauce curry-coco et ajoute seulement une partie végétale utile. ${intentReason()}`},
        {title:`Bowl curry coco · ${protein}${hasRice?' & riz':''}`,missing:[firstAbsentSuggestion(input,hasRice?['salade ou concombre','tomates ou avocat']:['riz ou quinoa','salade ou concombre'])],preparation:`Prépare ${article} au curry et au coco, puis dispose-le dans un bol${hasRice?' avec le riz':' avec la base proposée'}. Ajoute les éléments frais au dernier moment.`,explanation:`La même sauce devient un bowl plus structuré, avec un contraste entre la base chaude et les garnitures fraîches. ${intentReason()}`},
        {title:`${P} coco-curry & légumes`,missing:[firstAbsentSuggestion(input,['poivron ou courgette','épinards ou courgette'])],preparation:`Saisis ${article}, ajoute le curry puis le lait de coco. Incorpore le légume proposé et cuis juste assez pour garder une belle texture.`,explanation:`Cette variante met davantage les légumes au centre et peut se servir telle quelle ou avec la base déjà présente. ${intentReason()}`},
        {title:`Poêlée curry coco · ${protein}`,missing:[firstAbsentSuggestion(input,['coriandre ou oignon','gingembre ou cumin doux'])],preparation:`Fais revenir les aromates proposés, ajoute le curry puis ${article}. Verse juste assez de lait de coco pour enrober plutôt que créer une sauce longue.`,explanation:`Ici, la sauce est volontairement plus courte : on obtient une poêlée crémeuse plutôt qu’un curry mijoté. ${intentReason()}`}
      ];
      return {kind:'curry_coconut',title:`${P} curry coco`,missing:culinaryComplementSuggestions(input,a),preparation:`Fais revenir les aromates si tu en as, ajoute le curry puis ${article}. Verse le lait ou la crème de coco et laisse mijoter doucement jusqu’à cuisson complète. Ajoute l’accompagnement proposé selon ton intention.`,explanation:`Le curry et le coco forment déjà une sauce identifiable. Tee les utilise comme base de la recette et réserve « À prévoir » aux éléments qui structurent ou complètent le repas.`,variants};
    }
    if(hasCurry){
      const rice=first(a.starches.filter(x=>/\briz\b/.test(norm(x))));
      const curryMissing={
        equilibre:['épinards ou courgette','lait de coco ou tomates'],
        digestion:['courgette ou carottes','gingembre ou cumin doux'],
        energie:['poivron ou courgette','lait de coco ou tomates'],
        construire:['épinards ou courgette','lait de coco ou tomates'],
        legerete:['épinards ou courgette','tomates ou citron vert'],
        gourmandise:['lait de coco ou tomates','coriandre ou oignon']
      };
      const missing=(curryMissing[intent]||curryMissing.equilibre).filter(x=>!suggestionCovered(input,x)).slice(0,2);
      const title=rice?`Riz au ${protein} curry`:`${P} au curry`;
      const variants=[
        {title:`Curry de ${protein}${rice?' & riz':''}`,missing:[firstAbsentSuggestion(input,['lait de coco ou tomates','épinards ou courgette'])],preparation:`Fais revenir les aromates si tu en as, ajoute le curry puis ${article}. Ajoute le complément proposé pour former une sauce courte, puis sers${rice?' avec le riz déjà cuit':' avec la base que tu as'}.`,explanation:`Le curry donne déjà une direction culinaire nette. Cette variante l’utilise en sauce plutôt que comme simple épice de finition. ${intentReason()}`},
        {title:`${rice?'Riz sauté':'Poêlée'} curry & ${protein}`,missing:[firstAbsentSuggestion(input,['poivron ou courgette','épinards ou courgette'])],preparation:`${rice?'Fais sauter le riz bien égoutté':'Fais revenir le légume proposé'} avec le curry. Ajoute ${article} en morceaux ou émietté au bon moment et chauffe juste assez pour réunir les saveurs.`,explanation:`Le riz devient ici sauté et épicé : la forme du plat change réellement sans ajouter une deuxième protéine. ${intentReason()}`},
        {title:`Bowl curry · ${protein}${rice?' & riz':''}`,missing:[firstAbsentSuggestion(input,['salade ou concombre','tomates ou avocat'])],preparation:`Dispose ${rice?'le riz':'ta base'} dans un bol, ajoute ${article} assaisonné au curry puis les éléments frais proposés. Termine avec un filet de citron ou les herbes que tu as.`,explanation:`Le curry reste le fil conducteur mais le plat devient un bowl avec un contraste chaud-froid. ${intentReason()}`},
        {title:`${P} curry tomate${rice?' · riz':''}`,missing:[firstAbsentSuggestion(input,['tomates ou oignon rouge','coriandre ou oignon'])],preparation:`Fais revenir l’oignon si tu l’ajoutes, incorpore le curry puis la tomate. Ajoute ${article} et laisse mijoter brièvement avant de servir${rice?' avec le riz':''}.`,explanation:`Cette variante transforme le curry en sauce tomate épicée, différente de la version coco ou du riz sauté. ${intentReason()}`}
      ];
      return {kind:'curry',title,missing:missing.length?missing:[genericFinishingSuggestion(input,a)],preparation:`Fais chauffer le curry quelques secondes avec un peu de matière grasse ou un trait d’eau, ajoute ${article} puis ${rice?'le riz':'ta base'}. Incorpore ${missing[0]?addableLabel(missing[0]):'un légume ou une sauce légère'} au moment adapté et mélange jusqu’à ce que les saveurs soient bien réparties.`,explanation:`Tee reconnaît le curry comme une vraie direction culinaire. Avec ${article}${rice?' et le riz':''}, l’app construit donc un plat au curry et utilise « À prévoir » pour compléter la sauce ou la partie végétale, sans proposer une autre protéine.`,variants};
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
    if(a.frozenDesserts.length&&a.coffees.length)return 'affogato';
    if(a.chia.length&&a.sweetLiquids.length)return 'pudding';
    if(a.fruits.length&&a.sweetLiquids.length)return 'smoothie';
    if(a.fruits.length&&a.yogurts.length)return 'verrine';
    // Une boisson végétale/lactée déjà aromatisée (ex. lait d’avoine + vanille + miel)
    // doit rester dans l’univers boisson et ne jamais tomber sur une « assiette » salée.
    if(a.sweetLiquids.length&&(FOOD_RX.sweetAromatic.test(n)||FOOD_RX.sweetener.test(n)))return 'latte';
    return '';
  }
  function detectedSweetParts(input){
    const a=analyzeIngredients(input);
    const used=new Set([...a.fruits,...a.yogurts,...a.sweetLiquids].map(norm));
    const extras=a.raw.filter(x=>!used.has(norm(x))&&!FOOD_RX.savoryProtein.test(norm(x))&&!FOOD_RX.vegetable.test(norm(x))&&(!FOOD_RX.starch.test(norm(x))||FOOD_RX.oats.test(norm(x))));
    return {fruits:a.fruits,yogurt:first(a.yogurts),liquid:first(a.sweetLiquids),frozen:first(a.frozenDesserts),coffee:first(a.coffees),liqueur:first(a.liqueurs),extras};
  }
  function sweetSuggestedExtra(input,shape){
    const n=norm(input),sweet=detectedSweetParts(input),hasYogurt=!!sweet.yogurt;
    const hasNuts=/amande|noix|noisette|pistache|graine|chia|chanvre|lin|puree d amande/.test(n);
    if(shape==='affogato'){
      const dessertExtras={
        equilibre:['cacao non sucré ou amandes effilées','cannelle ou éclats d’amande'],
        digestion:['cannelle ou cardamome','cacao non sucré ou cannelle'],
        energie:['amandes effilées','cacao non sucré ou amandes effilées'],
        construire:['amandes effilées','yaourt grec ou fromage blanc'],
        legerete:['cacao non sucré ou cannelle','cannelle ou cardamome'],
        gourmandise:['copeaux de chocolat noir ou amandes grillées','cacao non sucré ou amandes effilées']
      };
      return firstAbsentSuggestion(input,dessertExtras[intent]||dessertExtras.equilibre);
    }
    if(shape==='latte'){
      const drinkExtras={
        equilibre:['cannelle ou cardamome','cacao non sucré ou cannelle','muscade ou cardamome'],
        digestion:['gingembre ou cardamome','cannelle ou cardamome','fleur d’oranger ou cannelle'],
        energie:['cacao non sucré ou cannelle','matcha ou cacao non sucré','purée d’amandes ou graines de chanvre moulues'],
        construire:['graines de chanvre moulues ou purée d’amandes','yaourt soja ou skyr à côté','cacao non sucré ou cannelle'],
        legerete:['cannelle ou gingembre','quelques glaçons ou cannelle','cardamome ou fleur d’oranger'],
        gourmandise:['cacao non sucré ou copeaux de coco','cannelle ou muscade','amandes effilées ou cacao non sucré']
      };
      return firstAbsentSuggestion(input,drinkExtras[intent]||drinkExtras.equilibre);
    }
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
  function sweetDrinkBase(value){
    const n=norm(value);
    if(/(?:lait d avoine|boisson avoine)/.test(n))return 'avoine';
    if(/(?:lait d amande|boisson amande)/.test(n))return 'amande';
    if(/(?:lait de coco|boisson coco|creme de coco)/.test(n))return 'coco';
    if(/(?:lait de soja|boisson soja)/.test(n))return 'soja';
    if(/eau de coco/.test(n))return 'coco';
    return '';
  }
  function sweetDrinkAccents(input){
    const a=analyzeIngredients(input),liquid=first(a.sweetLiquids),skip=new Set([norm(liquid)]);
    return a.raw.filter(x=>!skip.has(norm(x))&&!FOOD_RX.fruit.test(norm(x))&&!FOOD_RX.yogurt.test(norm(x))&&!FOOD_RX.chia.test(norm(x))).map(lower);
  }
  function sweetDrinkTitle(input){
    const a=analyzeIngredients(input),liquid=first(a.sweetLiquids),base=sweetDrinkBase(liquid),accentRows=sweetDrinkAccents(input),accents=accentRows.length===2?`${accentRows[0]} & ${accentRows[1]}`:frenchList(accentRows);
    const head=base?`Latte ${base}`:`Boisson ${lower(liquid)||'douce'}`;
    return accents?`${head} · ${accents}`:head;
  }
  function neutralTitle(input,item){
    const a=analyzeIngredients(input),n=norm(input);
    const shape=sweetShape(input),sweet=detectedSweetParts(input),fruitLabel=frenchList(sweet.fruits.map(titleFruit));
    if(shape==='affogato')return affogatoTitle(input);
    if(shape==='smoothie')return `Smoothie ${fruitLabel||'aux fruits'}${sweet.liquid?` au ${lower(sweet.liquid)}`:''}`;
    if(shape==='verrine')return `Verrine de ${lower(sweet.yogurt)||'yaourt'}${fruitLabel?` aux ${fruitLabel}`:' aux fruits'}`;
    if(shape==='pudding')return `Pudding ${sweet.liquid?`au ${lower(sweet.liquid)}`:'aux graines de chia'}${fruitLabel?` · ${fruitLabel}`:''}`;
    if(shape==='latte')return sweetDrinkTitle(input);
    if(isBatterBase(input))return a.buckwheat.length?'Galettes de sarrasin maison':'Crêpes maison';
    if(a.pastryDoughs.length)return /sablee/.test(norm(first(a.pastryDoughs)))?'Tarte sucrée à composer':'Tarte salée à composer';
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
    if(starch&&/pain|baguette|bagel|bun|ciabatta|panini|pita|muffin anglais/.test(norm(starch)))return `Tartine composée${extras?` · ${extras}`:''}`;
    if(starch&&a.fishes.length&&/manioc|igname|plantain|fonio|millet|\bmil\b|attieke/.test(norm(starch)))return `${cap(protein)} & ${lower(starch)}${veg?` · ${lower(veg)}`:''}`;
    if(starch)return `Assiette ${/^(attieke|igname)/.test(norm(starch))?'d’':'de '}${lower(starch)}${extras?` · ${extras}`:''}`;
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
    // Les préférences sont déduites uniquement des idées récemment composées
    // ou enregistrées sur cet appareil. Aucun appel réseau supplémentaire.
    if(preferences){
      const seenTokens=words(searchable).filter((token,pos,all)=>token.length>2&&all.indexOf(token)===pos);
      const affinity=seenTokens.reduce((sum,token)=>sum+Math.min(3,preferences.tokenCounts[token]||0),0);
      s+=Math.min(18,affinity*2)+Math.min(10,(preferences.familyCounts[norm(fam)]||0)*3);
      if(preferences.recentTitles.has(norm(title(item))))s-=24;
    }
    if(fam==='variable_composite'&&typ.length<3)s-=12;
    if(!overlap)s-=16;
    return {item,score:s,overlap};
  }
  function explanation(item,owned,name){
    const shape=sweetShape(lastIngredients),a=analyzeIngredients(lastIngredients);
    if(shape==='affogato'){
      const sweet=detectedSweetParts(lastIngredients),liqueur=sweet.liqueur?` et ${lower(sweet.liqueur)}`:'';
      return `Tee reconnaît la combinaison glace + café comme un affogato${liqueur}. La glace reste la base dessert, le café chaud crée le contraste, et « À prévoir » sert seulement de finition cohérente avec ton intention.`;
    }
    if(shape==='smoothie'){
      const sweet=detectedSweetParts(lastIngredients),liquid=lower(sweet.liquid)||'liquide choisi',yogurt=lower(sweet.yogurt);
      if(yogurt)return `Les fruits apportent la base fruitée, tandis que le ${yogurt} donne de l’onctuosité et une composante protéinée${sweet.liquid?` ; le ${liquid} ajuste la texture`:''}. Tee ajoute seulement le complément cohérent avec ton intention.`;
      if(['equilibre','construire'].includes(intent))return `Les fruits apportent la base fruitée et le ${liquid} donne la texture du smoothie. Comme aucune base protéinée n’est présente, Tee propose un complément de ce type pour rendre la préparation plus cohérente avec ton intention.`;
      return `Les fruits apportent la base fruitée et le ${liquid} donne la texture du smoothie. L’ajout proposé sert uniquement à orienter la préparation vers ton intention.`;
    }
    if(shape==='verrine')return `Le ${lower(first(a.yogurts))||'yaourt'} apporte la base crémeuse et protéinée, tandis que les fruits complètent la verrine. Tee propose seulement une finition cohérente avec ton intention.`;
    if(shape==='pudding')return `Les graines de chia et le ${lower(first(a.sweetLiquids))||'liquide choisi'} structurent déjà le pudding. Les fruits et la finition proposée permettent de varier le résultat sans ajouter d’ingrédient salé.`;
    if(shape==='latte'){
      const liquid=lower(first(a.sweetLiquids))||'lait choisi',accents=frenchList(sweetDrinkAccents(lastIngredients));
      return `Tee reconnaît une boisson aromatisée autour du ${liquid}${accents?` avec ${accents}`:''}. La suggestion dans « À prévoir » sert uniquement à compléter l’arôme ou la texture selon ton intention, sans transformer cette base en plat salé.`;
    }
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
    if(shape==='affogato'){
      const frozen=sweet.frozen||'glace vanille',coffee=sweet.coffee||'espresso',liqueur=sweet.liqueur;
      return `Dépose ${withArticle(frozen)} dans un petit verre ou une coupe. Verse ${withArticle(coffee)} chaud juste au moment de servir${liqueur?`, puis ajoute ${withArticle(liqueur)} en petite quantité`:''}${extra?`. Termine avec ${extra}`:''}. Sers immédiatement pour garder le contraste chaud-froid.`;
    }
    if(shape==='smoothie')return `Mixe ${frenchList([...sweet.fruits,sweet.liquid,sweet.yogurt,...(sweet.extras||[])].filter(Boolean).map(withArticle))} jusqu’à obtenir une texture homogène${extra?`, puis ajoute ${extra}`:''}. Ajuste seulement la quantité de liquide selon la texture souhaitée.`;
    if(shape==='verrine')return `Dépose ${sweet.yogurt?withArticle(sweet.yogurt):'le yaourt'} dans un verre, ajoute ${frenchList(sweet.fruits.map(withArticle))||'les fruits'}${sweet.extras?.length?`, puis ${frenchList(sweet.extras.map(withArticle))}`:''}, puis termine${extra?` avec ${extra}`:' avec la finition de ton choix'}.`;
    if(shape==='pudding'){const other=(sweet.extras||[]).filter(x=>!FOOD_RX.chia.test(norm(x)));return `Mélange ${first(a.sweetLiquids)?withArticle(first(a.sweetLiquids)):'le liquide choisi'} avec les graines de chia, laisse épaissir au frais, puis ajoute ${frenchList(sweet.fruits.map(withArticle))||'les fruits'}${other.length?` et ${frenchList(other.map(withArticle))}`:''}${extra?`. Termine avec ${extra}`:''}.`;}
    if(shape==='latte'){
      const liquid=first(a.sweetLiquids),n=norm(lastIngredients),accents=sweetDrinkAccents(lastIngredients).filter(x=>!/\bmiel\b/.test(norm(x)));
      const hasHoney=/\bmiel\b/.test(n);
      return `Chauffe doucement ${liquid?withArticle(liquid):'le lait choisi'} sans le faire bouillir${accents.length?`, puis ajoute ${frenchList(accents.map(withArticle))}`:''}. ${hasHoney?'Ajoute le miel hors du feu pour conserver son goût. ':''}${extra?`Termine avec ${extra}.`:'Mélange puis sers chaud ou tiède.'}`;
    }
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
    if(starch&&/pain|baguette|bagel|bun|ciabatta|panini|pita|muffin anglais/.test(norm(starch)))return `Toaste légèrement ${withArticle(starch)}, dispose ${titleJoin([protein,veg])||'tes ingrédients'} dessus et termine avec ${extra||'une finition simple'}.`;
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
    if(shape==='affogato'&&sweet.frozen&&sweet.coffee){
      const liqueur=sweet.liqueur,flavour=/chocolat/.test(norm(sweet.frozen))?'chocolat':/caramel/.test(norm(sweet.frozen))?'caramel':'vanille';
      const variants=[
        {key:'affogato-crunch',title:`Coupe glacée café-${flavour} & croquant`,missing:[firstAbsentSuggestion(input,['amandes effilées','cacao non sucré ou amandes effilées'])],preparation:`Dépose la glace dans une coupe, verse le café chaud${liqueur?` puis ${lower(liqueur)}`:''}, et ajoute la finition croquante proposée juste avant de servir.`,explanation:`La même base devient une coupe plus texturée grâce au croquant, tout en gardant le contraste café chaud / glace froide. ${intentReason()}`},
        {key:'affogato-cocoa',title:`Affogato cacao · ${flavour}${liqueur?' & amaretto':''}`,missing:[firstAbsentSuggestion(input,['cacao non sucré ou cannelle','copeaux de chocolat noir ou amandes grillées'])],preparation:`Dépose la glace dans le verre, saupoudre légèrement la finition proposée, puis verse le café chaud${liqueur?` et termine par ${lower(liqueur)}`:''}.`,explanation:`Cette variante garde l’affogato mais change son profil avec une finition cacao ou chocolat. ${intentReason()}`},
        {key:'coffee-shake',title:`Café frappé dessert · ${flavour}`,missing:[firstAbsentSuggestion(input,['lait ou boisson végétale','glaçons ou cacao non sucré'])],preparation:`Mixe brièvement une partie de la glace avec le café refroidi et le complément proposé. Garde un peu de glace entière au-dessus pour conserver une vraie texture dessert.`,explanation:`Le café et la glace sont ici mixés : on passe de l’affogato à une boisson-dessert frappée, donc à une préparation réellement différente. ${intentReason()}`},
        {key:'coffee-verrine',title:`Verrine café-${flavour} croquante`,missing:[firstAbsentSuggestion(input,['amandes effilées','cannelle ou éclats d’amande'])],preparation:`Laisse le café refroidir, alterne petites couches de glace et quelques cuillerées de café dans un verre, puis ajoute la finition croquante proposée${liqueur?' et un trait d’amaretto':''}.`,explanation:`La présentation en couches transforme l’affogato en verrine froide et croquante. ${intentReason()}`}
      ];
      return variants[(index-1)%variants.length];
    }
    if(shape==='latte'&&sweet.liquid){
      const liquid=lower(sweet.liquid),base=sweetDrinkBase(sweet.liquid),accents=frenchList(sweetDrinkAccents(input)),label=base||liquid;
      const variants=[
        {key:'iced-latte',title:`Latte glacé ${label}${accents?` · ${accents}`:''}`,missing:[firstAbsentSuggestion(input,['quelques glaçons ou cannelle','cardamome ou cacao non sucré','zeste d’orange ou cannelle'])],preparation:`Verse ${withArticle(sweet.liquid)} bien froid dans un grand verre, ajoute ${accents||'les arômes déjà présents'}, puis la finition proposée. Mélange avec des glaçons pour obtenir une vraie version glacée.`,explanation:`La même base devient une boisson froide et plus fraîche, sans basculer vers une recette salée. ${intentReason()}`},
        {key:'chai-soft',title:`${cap(label)} façon chaï doux${accents?` · ${accents}`:''}`,missing:[firstAbsentSuggestion(input,['cannelle ou cardamome','gingembre ou cannelle','muscade ou cardamome'])],preparation:`Chauffe doucement ${withArticle(sweet.liquid)} avec la finition épicée proposée. Ajoute ${accents||'les arômes déjà présents'} en fin de chauffe et mélange quelques secondes avant de servir.`,explanation:`Les mêmes ingrédients prennent ici une direction plus épicée et enveloppante grâce à une finition type chaï. ${intentReason()}`},
        {key:'cocoa-latte',title:`Latte cacao-${/vanille/.test(norm(input))?'vanille':'doux'} au ${liquid}`,missing:[firstAbsentSuggestion(input,['cacao non sucré','cannelle ou cacao non sucré','copeaux de coco ou cacao non sucré'])],preparation:`Fais chauffer ${withArticle(sweet.liquid)}, incorpore le cacao ou la finition proposée au fouet, puis ajoute ${accents||'les arômes déjà présents'} et sers bien lisse.`,explanation:`L’ajout de cacao transforme la boisson en latte plus corsé et gourmand tout en gardant la même base. ${intentReason()}`},
        {key:'oat-cream',title:`Crème minute ${label}${/vanille/.test(norm(input))?' vanillée':''}`,missing:[firstAbsentSuggestion(input,['flocons d’avoine ou graines de chia','fécule de maïs ou graines de chia','amandes effilées ou graines de chia'])],preparation:`Chauffe ${withArticle(sweet.liquid)} avec ${accents||'les arômes déjà présents'} et l’épaississant proposé. Remue jusqu’à obtenir une texture de crème, puis laisse tiédir avant de servir à la cuillère.`,explanation:`Cette variante change réellement la texture : la boisson devient une crème à la cuillère grâce au complément proposé. ${intentReason()}`}
      ];
      return variants[(index-1)%variants.length];
    }
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
    }else if(starch&&/pain|baguette|bagel|bun|ciabatta|panini|pita|muffin anglais/.test(norm(starch))){
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
  function alternateSuggestion(input,index){
    const combo=culinaryCombination(input);
    if(index>0&&combo?.variants?.length)return combo.variants[(index-1)%combo.variants.length];
    return sweetAlternative(input,index)||savoryAlternative(input,index);
  }
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
      family:family(item),
      variation_index:index
    };
    currentName=snapshot.title;renderSnapshot(snapshot);rememberCurrent(snapshot);
  }
  function rememberCurrent(snapshot){
    if(!snapshot||!user)return;
    const rows=readRecent(user.id),key=`${norm(snapshot.title)}|${norm(snapshot.ingredients)}|${snapshot.intent}`;
    const next=[{title:snapshot.title,intent:snapshot.intent,ingredients:snapshot.ingredients,family:snapshot.family||'',seen_at:new Date().toISOString()},...rows.filter(row=>`${norm(row.title)}|${norm(row.ingredients)}|${row.intent}`!==key)];
    writeRecent(user.id,next);preferences=preferenceProfile(user.id);
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
    if(!inputIngredients(input).length){window.MTFood?.toast?.('Indique au moins un aliment ou un ingrédient.');field.focus();return;}
    lastIngredients=input;variationIndex=0;currentSnapshot=null;preferences=preferenceProfile(user?.id);const btn=document.getElementById('inspirationCompose');btn.disabled=true;btn.textContent='Tee compose…';
    try{await loadRanked(input);cursor=0;if(!ranked.length)throw new Error('catalogue vide');renderResult(ranked[0].item,0);}
    catch(e){ranked=FALLBACK.map(x=>score(x,input)).sort((a,b)=>b.score-a.score);cursor=0;renderResult(ranked[0].item,0);}
    finally{btn.disabled=false;btn.textContent='Composer avec Tee';}
  }
  async function init(){
    const auth=await window.MTFood?.auth?.();if(!auth)return;user=auth.user;preferences=preferenceProfile(user.id);renderIntents();renderFavorites();
    document.getElementById('inspirationCompose').onclick=compose;
  }
  document.addEventListener('DOMContentLoaded',init);
})();
