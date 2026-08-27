(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MTFoodInspirationKB=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const STOPWORDS=['de','du','des','la','le','les','un','une','au','aux','avec','sans','pour','et','ou','a','à','en','type','façon','facon','preemballe','preemballee','cuit','cuite','cru','crue','aliment','moyen'];

  const PHRASE_RULES=[
    {id:'pastry_dough',re:/\b(pate|pâte)\s+(feuilletee|feuilletée|brisee|brisée|sablee|sablée)\b/,roles:['starch'],traits:['pastry_dough','dough']},
    {id:'pizza_dough',re:/\b(pate|pâte)\s+(a|à)\s+pizza\b/,roles:['starch'],traits:['pizza_dough','dough','bread']},
    {id:'pinsa',re:/\b(pinsa|focaccia|fougasse|flatbread|pain\s+bruschetta|pain\s+a\s+bruschetta|bruschetta)\b/,roles:['starch'],traits:['bread','flatbread','pizza_base']},
    {id:'panini',re:/\b(panini|pain\s+panini|ciabatta|bagel|bun|petits?\s+pains?|mini\s+pains?|baguette|pita|naan|chapati|msemen|mhadjeb|wrap|tortilla)\b/,roles:['starch'],traits:['bread']},
    {id:'fresh_cheese',re:/\b(st\.?\s*moret|saint\s*moret|philadelphia|cream\s+cheese|fromage\s+frais|cottage\s+cheese|ricotta|burrata|mascarpone)\b/,roles:['dairy','protein'],traits:['cheese','fresh_cheese','soft']},
    {id:'goat_cheese',re:/\b(fromage\s+(de\s+)?chevre|chevre\s+frais|buche\s+de\s+chevre|crottin)\b/,roles:['dairy','protein'],traits:['cheese','goat_cheese']},
    {id:'cheese',re:/\b(mozzarella|parmesan|feta|emmental|comte|gruyere|cheddar|gouda|halloumi|camembert|brie|reblochon|roquefort|gorgonzola|pecorino|tomme)\b/,roles:['dairy','protein'],traits:['cheese']},
    {id:'cream',re:/\b(creme\s+fraiche|creme\s+liquide|creme\s+epaisse|creme\s+de\s+coco|crème\s+fraîche|crème\s+liquide|crème\s+épaisse)\b/,roles:['dairy','fat'],traits:['cream']},
    {id:'bechamel',re:/\b(bechamel|béchamel)\b/,roles:['sauce','dairy'],traits:['cream_sauce','sauce']},
    {id:'tomato_paste',re:/\b(concentre\s+de\s+tomate|concentré\s+de\s+tomate|double\s+concentre\s+de\s+tomate|tomate\s+concentree|tomates?\s+concentrees?|puree\s+de\s+tomate|purée\s+de\s+tomate)\b/,roles:['sauce'],traits:['tomato_sauce','condiment']},
    {id:'sweet_chili',re:/\b(sweet\s*chili|sweet\s*chilli|sauce\s+aigre[- ]?douce|sauce\s+chili\s+sucree)\b/,roles:['sauce'],traits:['asian_sauce','sweet_sauce']},
    {id:'soy_sauce',re:/\b(sauce\s+soja|soja\s+sucree|soja\s+sucré|tamari|kecap\s+manis|shoyu)\b/,roles:['sauce'],traits:['soy_sauce','umami']},
    {id:'mustard',re:/\b(moutarde)\b/,roles:['sauce'],traits:['mustard','condiment']},
    {id:'vinegar',re:/\b(vinaigre|vinaigrette)\b/,roles:['sauce'],traits:['acid','condiment']},
    {id:'alcohol_wine',re:/\b(vin\s+blanc|vin\s+rouge|vin\s+sec|sak[eé]|mirin)\b/,roles:['sauce'],traits:['cooking_alcohol','liquid']},
    {id:'liqueur',re:/\b(amaretto|rhum|rum|cognac|grand\s+marnier|cointreau|baileys|liqueur)\b/,roles:['drink'],traits:['liqueur','alcohol']},
    {id:'soda',re:/\b(sprite|7\s*up|seven\s*up|limonade|soda|tonic|ginger\s+ale)\b/,roles:['drink'],traits:['cold_drink','carbonated']},
    {id:'water_drink',re:/\b(eau(?:\s+(?:petillante|pétillante|gazeuse|plate|minerale|minérale))?|sparkling\s+water)\b/,roles:['drink'],traits:['water','cold_drink']},
    {id:'fruit_syrup',re:/\b(sirop\s+de\s+(fraise|framboise|grenadine|peche|pêche|mangue|passion|menthe|cerise)|grenadine)\b/,roles:['sweetener'],traits:['fruit_syrup','drink_flavor']},
    {id:'milk_drink',re:/\b(lait\s+d['’]?avoine|lait\s+d['’]?amande|lait\s+de\s+soja|lait\s+de\s+coco|boisson\s+(d['’]?)?(avoine|amande|soja|coco)|lait)\b/,roles:['dairy','drink'],traits:['milk','liquid']},
    {id:'yogurt',re:/\b(yaourt|yogourt|skyr|fromage\s+blanc|petit\s+suisse|kefir|kéfir)\b/,roles:['dairy','protein'],traits:['cultured_dairy','soft']},
    {id:'ice_cream',re:/\b(glace|creme\s+glacee|crème\s+glacée|gelato|sorbet|boules?\s+de\s+glace)\b/,roles:['sweet'],traits:['frozen_dessert']},
    {id:'coffee',re:/\b(cafe|café|espresso|ristretto|cold\s+brew)\b/,roles:['drink'],traits:['coffee']},
    {id:'tea',re:/\b(the|thé|matcha|infusion|tisane|rooibos|hibiscus|bissap)\b/,roles:['drink'],traits:['tea']},
    {id:'chocolate',re:/\b(chocolat\s+(noir|au\s+lait|blanc|patissier|pâtissier|dessert)?|cacao|praline|praliné)\b/,roles:['sweet','fat'],traits:['chocolate']},
    {id:'sweetener',re:/\b(sucre|cassonade|miel|sirop\s+d['’]?(erable|érable|agave)|sucre\s+glace|sucre\s+en\s+poudre)\b/,roles:['sweetener'],traits:['sweetener']},
    {id:'leavening',re:/\b(levure\s+chimique|poudre\s+a\s+lever|bicarbonate|levure(?!\s+(boulangere|de\s+boulanger|fraiche|seche)))\b/,roles:['binder'],traits:['leavening']},
    {id:'yeast',re:/\b(levure\s+boulangere|levure\s+de\s+boulanger|levure\s+fraiche|levure\s+sèche)\b/,roles:['binder'],traits:['yeast']},
    {id:'buckwheat_flour',re:/\b(farine\s+(?:de\s+)?(?:ble|blé)\s+noir|farine\s+de\s+sarrasin|sarrasin)\b/,roles:['starch'],traits:['flour','buckwheat_flour']},
    {id:'almond_flour',re:/\b(poudre\s+d['’]?amande|amandes?\s+en\s+poudre|farine\s+d['’]?amande)\b/,roles:['starch','fat','protein'],traits:['flour','almond_flour','nut_seed']},
    {id:'flour',re:/\b(farine|fecule|fécule|maizena|maïzena|amidon)\b/,roles:['starch'],traits:['flour']},
    {id:'pasta',re:/\b(pates?|pâtes?|coquillettes?|spaghetti|tagliatelles?|linguine|penne|macaronis?|fusilli|farfalle|orecchiette|rigatoni|lasagnes?|gnocchi)\b/,roles:['starch'],traits:['pasta']},
    {id:'noodle',re:/\b(nouilles?|ramen|udon|soba|vermicelles?|mie|rice\s+noodles|nouilles?\s+de\s+riz)\b/,roles:['starch'],traits:['noodle']},
    {id:'grain',re:/\b(riz|riz\s+basmati|riz\s+thai|riz\s+tha[iï]|riz\s+jasmin|quinoa|boulgour|semoule|couscous|fonio|millet|mil|sorgho|orge|avoine|polenta|ble|blé|sarrasin|mais|maïs)\b/,roles:['starch'],traits:['grain']},
    {id:'tuber',re:/\b(pommes?\s+de\s+terre|grenailles?|patates?\s+douces?|manioc|igname|taro|macabo|plantain|bananes?\s+plantain|chikwangue|kwanga|attieke|attiéké|foufou|foutou|placali|eba|amala|pounded\s+yam)\b/,roles:['starch'],traits:['tuber']},
    {id:'egg',re:/\b(oeufs?|œufs?|omelette)\b/,roles:['protein'],traits:['egg']},
    {id:'poultry_piece',re:/\b(poulet\s+entier|coquelet|ailes?\s+de\s+poulet|pilons?\s+de\s+poulet|cuisses?\s+de\s+poulet|hauts?\s+de\s+cuisse|escalopes?\s+de\s+poulet|blancs?\s+de\s+poulet|filets?\s+de\s+poulet|morceaux?\s+de\s+poulet)\b/,roles:['protein'],traits:['poultry','piece_specific']},
    {id:'poultry',re:/\b(poulet|dinde|canard|pintade|caille)\b/,roles:['protein'],traits:['poultry']},
    {id:'beef_piece',re:/\b(boeuf|bœuf|rumsteck|faux[- ]?filet|entrecote|entrecôte|bavette|roti\s+de\s+boeuf|rôti\s+de\s+bœuf|rosbif|roast\s+beef|steak|boeuf\s+hache|bœuf\s+haché|viande\s+hachee|viande\s+hachée)\b/,roles:['protein'],traits:['red_meat']},
    {id:'other_meat',re:/\b(veau|agneau|mouton|chevre(?!\s+(frais|fromage))|chèvre(?!\s+(frais|fromage))|porc|jambon|lardons?|bacon|saucisses?|merguez|chorizo|pancetta|kefta|kofta|ntaba)\b/,roles:['protein'],traits:['meat']},
    {id:'fish_piece',re:/\b(coeur\s+de\s+saumon|cœur\s+de\s+saumon|paves?\s+de\s+saumon|pavés?\s+de\s+saumon|filets?\s+de\s+poisson|dos\s+de\s+cabillaud)\b/,roles:['protein'],traits:['fish','piece_specific']},
    {id:'fish',re:/\b(poisson|saumon|thon|dorade|daurade|cabillaud|colin|merlu|merlan|sole|truite|tilapia|capitaine|vivaneau|sardines?|maquereau|anchois|morue|lieu|bar|loup\s+de\s+mer|hareng|haddock|eglefin|églefin|espadon|rouget|turbot|lotte|hoki)\b/,roles:['protein'],traits:['fish']},
    {id:'seafood',re:/\b(fruits?\s+de\s+mer|crevettes?|gambas|crabe|homard|langoustines?|moules?|huitres?|huîtres?|calamar|encornet|poulpe|seiche|saint[- ]?jacques|coquilles?\s+saint[- ]?jacques)\b/,roles:['protein'],traits:['seafood']},
    {id:'pulse',re:/\b(lentilles?|pois\s+chiches?|haricots?\s+(rouges?|blancs?|noirs?|secs?)|flageolets?|feves?|fèves?|pois\s+casses?|niebe|niébé|cowpea|bambara|edamame|soja|tofu|tempeh|seitan)\b/,roles:['protein'],traits:['plant_protein','pulse']},
    {id:'leaf',re:/\b(salade\s+(sucrine|iceberg|romaine|batavia)|feuilles?\s+de\s+salade|salade\s+verte|salade(?!\s+de\s+fruits?)|sucrine|iceberg|romaine|batavia|laitue|roquette|mache|mâche|endive|jeunes?\s+pousses?|mesclun|chou\s+kale|kale|pak\s+choi|bok\s+choy|feuilles?\s+de\s+manioc|pondu|saka[- ]?saka|ndole|ndolé|ndolè|eru|fumbwa|oseille)\b/,roles:['vegetable'],traits:['leaf','fresh_leaf']},
    {id:'fresh_raw_veg',re:/\b(tomates?\s+cerises?|tomates?\s+pelees?|tomates?|concombres?|poivrons?(?:\s+(?:verts?|rouges?|jaunes?))?|radis|avocat|mais|maïs|celeri|céleri)\b/,roles:['vegetable'],traits:['fresh_raw']},
    {id:'veg',re:/\b(tomates?\s+cerises?|tomates?|courgettes?|carottes?|oignons?\s+rouges?|oignons?|poireaux?|poivrons?\s+(verts?|rouges?|jaunes?)?|poivrons?|aubergines?|brocolis?|chou(?:x|\s+fleur|\s+rouge|\s+blanc)?|concombres?|champignons?|fenouil|asperges?|artichauts?|betteraves?|celeri|céleri|radis|potiron|courges?|gombo|okra|navets?|haricots?\s+verts?|petits?\s+pois|avocat|mais|maïs|papaye\s+verte)\b/,roles:['vegetable'],traits:['vegetable']},
    {id:'olive',re:/\b(olives?\s+(vertes?|noires?)|olives?)\b/,roles:['sauce','fat'],traits:['olive','condiment']},
    {id:'aromatic',re:/\b(ail|echalotes?|échalotes?|oignons?|gingembre|persil|coriandre|menthe|basilic|ciboulette|thym|romarin|aneth|estragon|sauge|citronnelle|curcuma|cumin|paprika|curry|colombo|ras\s+el\s+hanout|garam\s+masala|cannelle|cardamome|vanille|muscade|piment|harissa|poivre|sumac|zaatar|za['’]?atar)\b/,roles:['aromatic'],traits:['aromatic']},
    {id:'acid',re:/\b(citron\s+vert|citron\s+jaune|citron|lime|orange|pamplemousse)\b/,roles:['fruit'],traits:['acid_fruit']},
    {id:'fruit',re:/\b(pommes?(?!\s+de\s+terre)|poires?|bananes?(?!\s+plantain)|fraises?|framboises?|myrtilles?|mures?|mûres?|cassis|mangues?|ananas|papaye(?!\s+verte)|kiwi|oranges?|mandarines?|clementines?|clémentines?|peches?|pêches?|nectarines?|abricots?|prunes?|raisins?|dattes?|figues?|grenade|fruit\s+de\s+la\s+passion|litchi|goyave|pasteque|pastèque|melon|cerises?)\b/,roles:['fruit'],traits:['fruit']},
    {id:'nut_seed',re:/\b(amandes?|noisettes?|noix|cacahuetes?|cacahuètes?|arachides?|pistaches?|cajou|pecan|pécan|sesame|sésame|chia|lin|chanvre|graines?\s+de\s+courge|graines?\s+de\s+tournesol|egusi|ogbono)\b/,roles:['fat','protein'],traits:['nut_seed']},
    {id:'fat',re:/\b(beurre|huile\s+d['’]?olive|huile\s+de\s+tournesol|huile\s+de\s+colza|huile\s+de\s+sesame|huile\s+de\s+sésame|huile|margarine|ghee|saindoux)\b/,roles:['fat'],traits:['fat']},
    {id:'crumb',re:/\b(biscottes?|chapelure|panko|croutons?|croûtons?)\b/,roles:['starch'],traits:['crumb']},
    {id:'quenelle',re:/\b(quenelles?)\b/,roles:['starch'],traits:['quenelle','composite']}
  ];

  const CIQUAL_ROLE_MAP={
    fish:{roles:['protein'],traits:['fish']},seafood:{roles:['protein'],traits:['seafood']},egg:{roles:['protein'],traits:['egg']},meat:{roles:['protein'],traits:['meat']},
    plant_protein:{roles:['protein'],traits:['plant_protein']},pulse:{roles:['protein'],traits:['pulse']},nut_seed:{roles:['protein','fat'],traits:['nut_seed']},
    fruit:{roles:['fruit'],traits:['fruit']},vegetable:{roles:['vegetable'],traits:['vegetable']},herb_spice:{roles:['aromatic'],traits:['aromatic']},
    binder:{roles:['binder'],traits:['binder']},pasta_rice_grain:{roles:['starch'],traits:['grain']},bread:{roles:['starch'],traits:['bread']},tuber:{roles:['starch'],traits:['tuber']},flour:{roles:['starch'],traits:['flour']},breakfast_cereal:{roles:['starch'],traits:['breakfast_cereal']},
    yogurt:{roles:['dairy','protein'],traits:['cultured_dairy']},cheese:{roles:['dairy','protein'],traits:['cheese']},milk:{roles:['dairy','drink'],traits:['milk']},cream:{roles:['dairy','fat'],traits:['cream']},fat:{roles:['fat'],traits:['fat']},
    soup:{roles:['composite'],traits:['soup']},salad:{roles:['vegetable','composite'],traits:['salad']},pizza_tart:{roles:['composite','starch'],traits:['pizza_tart']},sandwich:{roles:['composite','starch'],traits:['sandwich']},composite:{roles:['composite'],traits:['composite']},
    chocolate:{roles:['sweet','fat'],traits:['chocolate']},cake_pastry:{roles:['sweet','starch'],traits:['pastry']},sweet:{roles:['sweet'],traits:['sweet']},sauce:{roles:['sauce'],traits:['sauce']},drink:{roles:['drink'],traits:['drink']}
  };

  const CULTURES={
    west_africa:{label:'Afrique de l’Ouest',signals:/\b(attieke|attiéké|alloco|fonio|millet|mil|igname|manioc|plantain|gombo|okra|jollof|thieb|thiéb|ceebu|yassa|mafe|mafé|domoda|waakye|kelewele|suya|akara|moi[- ]?moi|moin[- ]?moin|egusi|ogbono|banku|kenkey|amala|eba|pounded\s+yam|garba|arachide)\b/,
      forms:{grain:['Riz parfumé façon pilaf','Riz tomate-aromates','Bowl de céréales & sauce courte','Galettes de céréales et condiment'],tuber:['Base de tubercule & sauce tomate-oignon','Tubercules rôtis & condiment relevé','Écrasé de tubercule & sauce végétale','Bowl plantain/tubercule & garniture'],mixed:['Mijoté tomate-oignon','Assiette braisée & garniture','Sauce courte aux aromates','Bowl chaud aux légumes et condiment']},
      finish:['gombo tomate','sauce tomate-oignon au gingembre','feuilles vertes mijotées','arachides grillées et citron vert','poivron, tomate et oignon','salsa mangue-citron vert','piment doux et citron','oignons citronnés']},
    central_africa:{label:'Afrique centrale',signals:/\b(ndole|ndolé|ndolè|eru|pondu|saka[- ]?saka|fumbwa|chikwangue|kwanga|liboke|liboké|makayabu|ntaba|koki|kpem|sanga|achu|mbongo|plantain|manioc|taro|macabo)\b/,
      forms:{tuber:['Tubercule & sauce de feuilles','Base de manioc et sauce mijotée','Plantain/tubercule rôti & condiment','Assiette braisée & légumes'],mixed:['Mijoté de feuilles et aromates','Papillote parfumée façon liboké','Sauce tomate-aromates & base locale','Bowl chaud manioc/plantain & garniture']},
      finish:['feuilles vertes mijotées','gombo tomate','sauce tomate-oignon au gingembre','arachides pilées et citron','aubergine et gombo','piment doux et oignon','poivron-tomate-oignon','herbes fraîches et citron']},
    maghreb:{label:'Maghreb',signals:/\b(couscous|semoule|msemen|mhadjeb|mahjouba|chakhchoukha|rechta|karantika|garantita|harira|chorba|tajine|chakchouka|chermoula|harissa|ras\s+el\s+hanout|cumin|brik|lablabi|bissara|rfissa|kafteji|ojja)\b/,
      forms:{grain:['Semoule aux légumes épicés','Pilaf aux épices douces','Bowl chermoula','Galettes de semoule garnies'],mixed:['Mijoté tomate-cumin','Tajine court aux légumes','Assiette rôtie au ras-el-hanout','Poêlée chermoula']},
      finish:['carottes au cumin','courgettes au ras-el-hanout','pois chiches à la coriandre','poivrons grillés à l’harissa douce','citron confit et persil','aubergine à la chermoula','tomate-oignon au paprika','fenouil à l’orange']},
    east_asia:{label:'Asie de l’Est',signals:/\b(ramen|udon|soba|yakisoba|gyudon|onigiri|miso|shoyu|tamari|tofu|tempeh|jiaozi|baozi|wonton|chow\s+mein|riz\s+cantonais|pak\s+choi|bok\s+choy|kimchi|bibimbap|bulgogi|gochujang|doenjang|nori|edamame)\b/,
      forms:{pasta:['Nouilles sautées au gingembre','Bouillon de nouilles garni','Salade de nouilles au sésame','Bowl de nouilles chaud-froid'],grain:['Riz sauté garni','Bowl au sésame','Donburi inspiré','Riz & légumes façon bibimbap'],mixed:['Poêlée gingembre-ciboule','Bouillon garni','Cuisson vapeur & sauce soja-citron','Bowl umami aux légumes']},
      finish:['gingembre, ciboule et sésame','sauce soja-citron vert','bouillon miso','champignons shiitakés','pak choï à l’ail','vinaigre de riz et concombre','cacahuètes et coriandre','huile de sésame et piment doux']},
    southeast_asia:{label:'Asie du Sud-Est',signals:/\b(pad\s+thai|pad\s+thaï|tom\s+yum|tom\s+kha|som\s+tam|khao\s+pad|curry\s+(vert|rouge)|citronnelle|galanga|nuoc\s+mam|fish\s+sauce|basilic\s+thai|basilic\s+thaï|coco|satay)\b/,
      forms:{pasta:['Nouilles sautées citron vert-herbes','Nouilles coco-curry','Salade de nouilles aux herbes','Bouillon parfumé citronnelle'],grain:['Riz sauté aux herbes','Bowl coco-citron vert','Riz parfumé & légumes croquants','Curry court & riz'],mixed:['Curry coco court','Poêlée citronnelle-gingembre','Bowl frais herbes-citron vert','Brochettes & sauce cacahuète']},
      finish:['citron vert et coriandre','menthe et basilic','cacahuètes grillées','concombre au vinaigre de riz','gingembre et citronnelle','sauce coco-citron vert','mangue verte et herbes','piment doux et sésame']},
    south_asia:{label:'Asie du Sud',signals:/\b(curry|garam\s+masala|tandoori|biryani|dal|dhal|chapati|naan|raita|curcuma|cardamome|cumin|masala|chutney)\b/,
      forms:{grain:['Pilaf parfumé','Biryani inspiré','Riz aux épices & légumes','Bowl curry & riz'],mixed:['Curry court','Poêlée masala douce','Assiette tandoori inspirée','Mijoté tomate-épices']},
      finish:['raïta concombre-menthe','épinards aux épices','chutney coriandre-menthe','lentilles corail','chou-fleur rôti au cumin','tomate-oignon au garam masala','mangue et citron vert','aubergine au curry doux']},
    mediterranean:{label:'Méditerranée',signals:/\b(pates?|pâtes?|spaghetti|parmesan|mozzarella|feta|burrata|basilic|pesto|olive|polenta|pinsa|focaccia|bruschetta|ricotta|courgette|aubergine|tomate)\b/,
      forms:{pasta:['Pâtes poêlées aux légumes','Pâtes crémeuses & herbes','Pâtes rôties au four','Salade de pâtes aux herbes'],grain:['Bowl méditerranéen','Pilaf citron-herbes','Céréales & légumes rôtis','Galettes de céréales & feta'],mixed:['Poêlée méditerranéenne','Plaque rôtie aux herbes','Bruschetta composée','Bowl tomate-herbes']},
      finish:['tomates rôties et basilic','aubergine confite','champignons persillés','fenouil citronné','pesto de roquette','poivrons grillés','olives, citron et thym','courge rôtie au romarin']},
    latin:{label:'Amérique latine',signals:/\b(tortilla|haricots\s+noirs|mais|maïs|avocat|citron\s+vert|chili|coriandre|salsa|fajita|quesadilla|taco)\b/,
      forms:{grain:['Bowl riz-haricots','Riz sauté tomate-coriandre','Galettes garnies','Bowl maïs-avocat'],mixed:['Fajitas inspirées','Poêlée poivron-oignon','Bowl salsa-citron vert','Tacos/galettes garnies']},
      finish:['salsa tomate-coriandre','haricots noirs citronnés','maïs grillé au paprika','avocat et citron vert','pickles d’oignon rouge','poivrons et oignons rôtis','sauce yaourt-coriandre','mangue et piment doux']}
  };

  const FORMS={
    salad:['Salade croquante','Salade composée','Bowl frais','Salade tiède','Cups de feuilles garnies','Salsa-bowl croquant','Assiette fraîche aux herbes','Salade façon mezze'],
    pasta:['Pâtes poêlées','Pâtes en sauce courte','Pâtes rôties au four','Salade de pâtes tiède','Pâtes façon risottata','Gratin de pâtes','Pâtes citron-herbes','Pâtes & légumes confits'],
    noodle:['Nouilles sautées','Bouillon de nouilles garni','Salade de nouilles','Bowl de nouilles','Nouilles coco-curry','Nouilles sauce courte','Nouilles gingembre-sésame','Nouilles & légumes croquants'],
    grain:['Pilaf parfumé','Riz/céréales sautés','Bowl chaud-froid','Galettes de céréales','Céréales aux légumes rôtis','Riz tomate-aromates','Bowl herbes-citron','Céréales façon one-pot'],
    tuber:['Plaque de tubercules rôtis','Poêlée rustique','Écrasé garni','Gratin de tubercules','Tubercules farcis','Parmentier revisité','Salade tiède de pommes de terre','Cocotte de tubercules & légumes'],
    bread:['Tartines gratinées','Panini garni','Bruschettas minute','Croques ouverts','Pinsa/pizza blanche','Flatbread garni','Petits pains farcis','Pain grillé & garniture fraîche'],
    pizza_dough:['Pizza fine','Focaccia garnie','Pizza blanche','Pizza tomate-herbes','Calzone minute','Roulés de pizza','Pizzettes individuelles','Flatbread au four'],
    pastry_dough:['Tarte fine','Quiche/tarte salée','Feuilletés garnis','Tartelettes','Torsades salées','Chaussons garnis','Tarte rustique','Carrés feuilletés'],
    fish:['Poisson rôti & condiment','Papillote parfumée','Poisson poêlé & légumes','Bowl marin cuit','Brochettes de poisson','Cocotte tomate-herbes','Poisson vapeur & sauce légère','Plaque poisson-légumes'],
    protein:['Poêlée de protéine & légumes','Brochettes & accompagnement','Cocotte courte','Rôti au four & garniture','Bowl protéiné','Mijoté tomate-aromates','Poêlée sauce courte','Assiette grillée & condiment'],
    vegetable:['Légumes rôtis & condiment','Poêlée de légumes','Velouté garni','Légumes farcis','Tian/gratin de légumes','Galettes de légumes','Mijoté tomate-aromates','Caviar/tartinade de légumes'],
    pulse:['Curry de légumineuses','Bowl de légumineuses','Galettes de légumineuses','Salade de légumineuses','Mijoté tomate-aromates','Tartinade & crudités','Soupe épaisse','Poêlée épicée'],
    mixed:['Poêlée complète','Plaque rôtie complète','Bowl composé','Mijoté court','Gratin complet','Brochettes & garniture','Cocotte tomate-herbes','Assiette chaude-froide'],
    bake_sweet:['Gâteau moelleux','Fondant','Muffins','Pancakes sucrés','Cake','Cookies moelleux','Clafoutis','Crumble-gâteau'],
    custard:['Crème aux œufs','Flan','Crème caramel','Œufs au lait','Clafoutis doux','Pain perdu','Crème vanillée','Petits pots dessert'],
    chocolate_egg:['Mousse au chocolat','Fondant chocolat','Brownie','Crème chocolat','Soufflé chocolat','Moelleux chocolat','Petits pots chocolat','Pancakes chocolat'],
    dessert:['Verrine','Parfait fruité','Pudding','Crumble minute','Compotée garnie','Mousse fruitée','Dessert glacé','Bowl dessert'],
    smoothie:['Smoothie onctueux','Smoothie bowl','Lassi fruité','Boisson frappée','Shake fruité','Smoothie cacao-fruit','Smoothie vert fruité','Bowl glacé'],
    beverage:['Eau aromatisée','Infusion fraîche','Thé glacé maison','Mocktail sans alcool','Boisson chaude parfumée','Latte parfumé','Fizz fruité','Boisson frappée'],
    condiments_only:['Poulet/poisson rôti sauce courte','Légumes rôtis & condiment','Pâtes sauce aromatique','Bowl céréales & sauce maison','Tartines garnies','Poêlée de légumineuses','Plaque complète au four','Brochettes & sauce minute'],
    tuber_salad:['Salade de pommes de terre aux herbes','Salade tiède de pommes de terre','Bowl pommes de terre & crudités','Pommes de terre, feuilles & vinaigrette','Salade rustique pomme de terre-légumes','Pommes de terre citron-herbes'],
    breaded_protein:['Escalope panée maison','Aiguillettes croustillantes','Poulet pané au four','Schnitzel maison','Filets croustillants','Bouchées panées maison'],
    almond_dough:['Pâte sablée aux amandes','Sablés aux amandes','Fond de tarte amande','Crumble aux amandes','Biscuits sablés amande','Base de tarte amandine'],
    sticky_rice_dessert:['Riz gluant coco & fruit','Mango sticky rice inspiré','Riz coco aux fruits','Bowl de riz gluant fruité','Riz gluant vanille-coco'],
    batter_savory:['Galettes salées','Crêpes garnies','Pancakes salés','Clafoutis salé','Blinis garnis','Gaufres salées','Frittata enrichie','Beignets au four']
  };

  FORMS.yogurt_fruit=['Verrine de yaourt & fruits','Frozen yogurt fruité','Bowl crémeux aux fruits','Smoothie protéiné fruité','Bark glacé au yaourt','Parfait yaourt-fruits','Overnight bowl au yaourt','Esquimaux yaourt-fruits'];
  FORMS.smoothie=['Smoothie onctueux','Smoothie bowl','Lassi fruité','Boisson frappée','Pudding fruité','Overnight bowl fruité','Esquimaux fruités','Bowl glacé'];

  const TARGETS={
    equilibre:{meal:['protein','starch','vegetable'],salad:['protein','starch'],max:2},
    digestion:{meal:['protein','starch','vegetable'],salad:['protein'],max:2},
    energie:{meal:['starch','protein','vegetable'],salad:['starch','protein'],max:2},
    construire:{meal:['protein','starch'],salad:['protein','starch'],max:2},
    legerete:{meal:['vegetable','protein'],salad:['protein'],max:2},
    gourmandise:{meal:['finish'],salad:['finish','protein'],max:2}
  };

  const COMPLEMENTS={
    protein:[
      {name:'œufs mollets',tags:['salad','grain','tuber','bread'],intents:['equilibre','energie']},{name:'thon citronné',tags:['salad','bread','pasta'],intents:['equilibre','legerete']},{name:'poulet aux herbes',tags:['salad','grain','pasta','tuber'],intents:['equilibre','energie','construire']},{name:'saumon rôti',tags:['grain','tuber','salad'],intents:['construire','gourmandise']},{name:'tofu mariné au sésame',tags:['salad','grain','noodle'],cultures:['east_asia','southeast_asia'],intents:['equilibre','construire']},{name:'pois chiches rôtis',tags:['salad','grain','vegetable'],intents:['equilibre','energie']},{name:'lentilles corail',tags:['grain','vegetable','mixed'],cultures:['south_asia','west_africa'],intents:['equilibre','digestion']},{name:'haricots blancs citronnés',tags:['salad','tuber','vegetable'],intents:['equilibre','construire']},{name:'feta marinée',tags:['salad','bread','grain'],cultures:['mediterranean','maghreb'],intents:['equilibre','gourmandise']},{name:'halloumi doré',tags:['salad','grain','bread'],intents:['gourmandise','construire']},{name:'crevettes citron-ail',tags:['pasta','grain','salad'],intents:['equilibre','gourmandise']},{name:'bœuf sauté au sésame',tags:['grain','noodle'],cultures:['east_asia'],intents:['energie','construire']},{name:'haricots noirs citronnés',tags:['grain','salad'],cultures:['latin'],intents:['equilibre','energie']},{name:'niébé/haricots aux aromates',tags:['grain','tuber'],cultures:['west_africa','central_africa'],intents:['equilibre','construire']},{name:'yaourt grec salé aux herbes',tags:['salad','grain','tuber'],intents:['equilibre','legerete']}
    ],
    starch:[
      {name:'riz basmati parfumé',tags:['protein','vegetable','fish'],intents:['equilibre','energie','construire']},{name:'riz jasmin aux herbes',tags:['fish','protein'],cultures:['southeast_asia','east_asia']},{name:'boulgour citron-herbes',tags:['salad','protein'],cultures:['mediterranean','maghreb']},{name:'quinoa aux herbes',tags:['salad','protein'],intents:['equilibre','legerete']},{name:'fonio pilaf',tags:['protein','vegetable'],cultures:['west_africa'],intents:['equilibre','energie']},{name:'semoule aux épices douces',tags:['protein','vegetable'],cultures:['maghreb']},{name:'pommes grenailles rôties',tags:['protein','fish','vegetable'],intents:['gourmandise','energie']},{name:'patate douce rôtie',tags:['protein','vegetable'],intents:['equilibre','energie']},{name:'pain complet grillé',tags:['salad','protein'],intents:['equilibre','energie']},{name:'polenta crémeuse',tags:['protein','vegetable'],cultures:['mediterranean'],intents:['gourmandise']},{name:'plantain rôti',tags:['protein','vegetable'],cultures:['west_africa','central_africa']},{name:'attiéké citron-herbes',tags:['fish','protein'],cultures:['west_africa']},{name:'igname rôtie',tags:['protein','vegetable'],cultures:['west_africa','central_africa']},{name:'nouilles de riz',tags:['protein','vegetable'],cultures:['southeast_asia','east_asia']},{name:'orge façon pilaf',tags:['protein','vegetable'],intents:['equilibre']}
    ],
    vegetable:[
      {name:'courgettes rôties au thym',tags:['pasta','grain','protein'],cultures:['mediterranean']},{name:'aubergine confite',tags:['pasta','grain','bread','protein'],cultures:['mediterranean','maghreb']},{name:'fenouil citronné',tags:['fish','salad','grain'],intents:['digestion','legerete']},{name:'brocoli au sésame',tags:['grain','noodle','protein'],cultures:['east_asia']},{name:'pak choï à l’ail',tags:['grain','noodle','fish'],cultures:['east_asia']},{name:'gombo tomate',tags:['grain','tuber','protein'],cultures:['west_africa','central_africa']},{name:'poivrons grillés',tags:['pasta','grain','bread','protein'],cultures:['mediterranean','maghreb','latin']},{name:'carottes au cumin',tags:['grain','protein'],cultures:['maghreb','south_asia']},{name:'haricots verts persillés',tags:['protein','tuber'],intents:['equilibre','legerete']},{name:'chou rouge aux agrumes',tags:['salad','grain','protein'],intents:['legerete']},{name:'tomates rôties au basilic',tags:['pasta','bread','grain'],cultures:['mediterranean']},{name:'champignons persillés',tags:['pasta','bread','protein'],intents:['gourmandise','equilibre']},{name:'épinards aux épices douces',tags:['grain','protein'],cultures:['south_asia','maghreb']},{name:'poireaux fondants',tags:['fish','tuber','pasta'],intents:['digestion','gourmandise']},{name:'courge rôtie aux herbes',tags:['grain','protein'],intents:['equilibre','digestion']},{name:'crudités concombre-tomate',tags:['grain','bread','protein'],intents:['legerete','equilibre']},{name:'salade de mangue verte',tags:['fish','grain'],cultures:['southeast_asia']},{name:'feuilles vertes mijotées',tags:['tuber','grain','protein'],cultures:['west_africa','central_africa']},{name:'chou-fleur rôti au cumin',tags:['grain','protein'],cultures:['south_asia','maghreb']},{name:'betterave rôtie & herbes',tags:['salad','grain'],intents:['equilibre']}
    ],
    finish:[
      {name:'gremolata citron-persil',tags:['pasta','fish','protein','tuber'],intents:['equilibre','legerete']},{name:'pesto de roquette',tags:['pasta','bread','grain'],cultures:['mediterranean']},{name:'sauce yaourt-citron',tags:['grain','tuber','salad','protein'],intents:['equilibre','legerete']},{name:'chermoula douce',tags:['fish','grain','protein'],cultures:['maghreb']},{name:'gingembre, ciboule & sésame',tags:['grain','noodle','protein'],cultures:['east_asia']},{name:'citron vert, coriandre & menthe',tags:['grain','salad','fish'],cultures:['southeast_asia','latin']},{name:'pickles d’oignon rouge',tags:['salad','bread','grain','protein']},{name:'dukkah douce',tags:['salad','grain','vegetable'],cultures:['maghreb']},{name:'tahin citronné',tags:['salad','grain','vegetable'],cultures:['maghreb','mediterranean']},{name:'chimichurri doux',tags:['protein','tuber'],cultures:['latin']},{name:'salsa tomate-coriandre',tags:['grain','protein','salad'],cultures:['latin']},{name:'oignons citronnés',tags:['fish','protein','grain'],cultures:['west_africa']},{name:'pesto de pistache',tags:['pasta','bread'],intents:['gourmandise']},{name:'crème de feta',tags:['bread','grain','salad'],intents:['gourmandise']},{name:'beurre citronné aux herbes',tags:['fish','protein','tuber'],intents:['gourmandise']},{name:'sauce cacahuète-sésame',tags:['noodle','grain','protein'],cultures:['east_asia','southeast_asia'],intents:['gourmandise','energie']},{name:'parmesan croustillant',tags:['pasta','bread'],intents:['gourmandise']},{name:'noisettes torréfiées',tags:['salad','vegetable','dessert'],intents:['gourmandise']},{name:'herbes fraîches & citron',tags:['fish','salad','protein','grain'],intents:['legerete','digestion']},{name:'paprika fumé & ail',tags:['protein','tuber','vegetable'],intents:['gourmandise','energie']}
    ],
    sweet_finish:[
      {name:'pistaches concassées',tags:['dessert','smoothie']},{name:'coulis de fruits rouges',tags:['dessert']},{name:'poire rôtie à la cannelle',tags:['dessert']},{name:'graines de chia',tags:['smoothie','dessert'],intents:['equilibre']},{name:'amandes au cacao',tags:['dessert'],intents:['equilibre','gourmandise']},{name:'compotée mangue-citron vert',tags:['dessert','smoothie']},{name:'granola sarrasin-amandes',tags:['dessert','smoothie'],intents:['energie']},{name:'banane & purée de cacahuète',tags:['smoothie','dessert'],intents:['energie']},{name:'dattes & cacao',tags:['smoothie','dessert'],intents:['energie']},{name:'skyr vanillé',tags:['dessert','smoothie'],intents:['construire']},{name:'tofu soyeux cacao',tags:['dessert','smoothie'],intents:['construire']},{name:'framboises au citron',tags:['dessert'],intents:['legerete']},{name:'agrumes à la menthe',tags:['dessert'],intents:['legerete']},{name:'ganache chocolat noir',tags:['dessert'],intents:['gourmandise']},{name:'praliné noisette',tags:['dessert'],intents:['gourmandise']},{name:'coco grillée',tags:['dessert','smoothie'],intents:['gourmandise']},{name:'crumble d’amande',tags:['dessert'],intents:['gourmandise']},{name:'coulis passion',tags:['dessert'],intents:['gourmandise']}
    ],
    beverage_finish:[
      {name:'concombre & basilic',tags:['beverage'],intents:['equilibre','legerete']},{name:'agrumes & romarin',tags:['beverage'],intents:['equilibre']},{name:'fruits rouges & menthe',tags:['beverage'],intents:['equilibre','gourmandise']},{name:'gingembre & citron vert',tags:['beverage'],intents:['digestion','energie']},{name:'hibiscus & orange',tags:['beverage'],intents:['equilibre','energie']},{name:'fenouil & menthe',tags:['beverage'],intents:['digestion']},{name:'verveine & citron',tags:['beverage'],intents:['digestion']},{name:'thé vert & pêche',tags:['beverage'],intents:['energie']},{name:'mangue & citron vert',tags:['beverage'],intents:['energie','gourmandise']},{name:'concombre & menthe',tags:['beverage'],intents:['legerete']},{name:'pastèque & menthe',tags:['beverage'],intents:['legerete']},{name:'vanille & cardamome',tags:['beverage'],intents:['gourmandise']},{name:'cacao & noisette',tags:['beverage'],intents:['gourmandise']},{name:'café & cannelle',tags:['beverage'],intents:['gourmandise','energie']},{name:'fleur d’oranger & pistache',tags:['beverage'],intents:['gourmandise']}
    ]
  };

  // EXTENDED_COMPLEMENTS_V410 — pools data-driven pour éviter les compléments répétitifs.
  COMPLEMENTS.protein.push(
    {name:'œufs marinés soja-gingembre',tags:['grain','noodle'],cultures:['east_asia'],intents:['energie','construire']},
    {name:'omelette fine aux herbes',tags:['grain','salad','tuber'],intents:['equilibre','construire']},
    {name:'thon citronné aux herbes',tags:['salad','bread','tuber'],intents:['equilibre','legerete']},
    {name:'sardines rôties au citron',tags:['tuber','grain'],cultures:['mediterranean','west_africa'],intents:['equilibre']},
    {name:'poulet gingembre-coriandre',tags:['grain','noodle'],cultures:['southeast_asia'],intents:['energie','construire']},
    {name:'poulet yassa express',tags:['grain','tuber'],cultures:['west_africa'],intents:['gourmandise','equilibre']},
    {name:'tofu miso-sésame',tags:['grain','noodle','salad'],cultures:['east_asia'],intents:['equilibre','construire']},
    {name:'tempeh laqué citron vert',tags:['grain','noodle'],cultures:['southeast_asia'],intents:['energie','construire']},
    {name:'dhal de lentilles corail',tags:['grain','vegetable'],cultures:['south_asia'],intents:['digestion','equilibre']},
    {name:'niébé tomate-oignon',tags:['grain','tuber'],cultures:['west_africa'],intents:['equilibre','construire']},
    {name:'haricots rouges paprika-cumin',tags:['grain','salad'],cultures:['latin'],intents:['energie','construire']},
    {name:'pois chiches chermoula',tags:['grain','salad','vegetable'],cultures:['maghreb'],intents:['equilibre']},
    {name:'œufs durs & sauce herbes-citron',tags:['salad','tuber','grain'],intents:['equilibre','legerete']},
    {name:'saumon émietté citron-aneth',tags:['salad','grain','bread'],intents:['equilibre','construire']},
    {name:'crevettes gingembre-citronnelle',tags:['noodle','grain'],cultures:['southeast_asia'],intents:['gourmandise','energie']},
    {name:'bœuf poivron-oignon',tags:['grain','tuber'],cultures:['latin'],intents:['energie','construire']},
    {name:'kefta aux herbes',tags:['grain','salad','tuber'],cultures:['maghreb'],intents:['gourmandise','construire']},
    {name:'feta & pois chiches',tags:['salad','grain'],cultures:['mediterranean'],intents:['equilibre','construire']},
    {name:'fromage frais aux herbes',tags:['bread','tuber','salad'],intents:['legerete','equilibre']},
    {name:'edamame au sésame',tags:['grain','noodle','salad'],cultures:['east_asia'],intents:['equilibre','energie']}
  );
  COMPLEMENTS.starch.push(
    {name:'riz complet aux herbes',tags:['protein','fish','vegetable'],intents:['equilibre']},
    {name:'riz coco-citron vert',tags:['fish','protein'],cultures:['southeast_asia'],intents:['gourmandise','energie']},
    {name:'riz tomate-oignon',tags:['protein','fish'],cultures:['west_africa'],intents:['energie','gourmandise']},
    {name:'millet aux légumes',tags:['protein','vegetable'],cultures:['west_africa'],intents:['equilibre','energie']},
    {name:'semoule citron-coriandre',tags:['protein','vegetable'],cultures:['maghreb'],intents:['equilibre','legerete']},
    {name:'couscous de mil parfumé',tags:['protein','vegetable'],cultures:['west_africa'],intents:['energie']},
    {name:'manioc vapeur & citron',tags:['protein','fish'],cultures:['central_africa','west_africa'],intents:['equilibre']},
    {name:'foutou/plantain en petite portion',tags:['protein','vegetable'],cultures:['west_africa'],intents:['energie','gourmandise']},
    {name:'chikwangue grillée',tags:['protein','fish'],cultures:['central_africa'],intents:['gourmandise','energie']},
    {name:'pommes de terre vapeur aux herbes',tags:['fish','protein'],intents:['digestion','equilibre']},
    {name:'écrasé de patate douce',tags:['protein','vegetable'],intents:['digestion','gourmandise']},
    {name:'nouilles soba',tags:['protein','vegetable'],cultures:['east_asia'],intents:['energie','equilibre']},
    {name:'vermicelles de riz',tags:['protein','vegetable'],cultures:['southeast_asia'],intents:['digestion','legerete']},
    {name:'orge perlé façon risotto',tags:['protein','vegetable'],intents:['gourmandise','equilibre']},
    {name:'polenta grillée',tags:['protein','vegetable'],cultures:['mediterranean'],intents:['gourmandise']},
    {name:'pain pita grillé',tags:['salad','protein'],cultures:['mediterranean','maghreb'],intents:['equilibre']},
    {name:'galette de sarrasin',tags:['protein','vegetable'],intents:['equilibre','gourmandise']},
    {name:'plantain rôti au four',tags:['protein','vegetable'],cultures:['west_africa','central_africa'],intents:['energie','gourmandise']},
    {name:'attiéké aux herbes & citron',tags:['fish','protein'],cultures:['west_africa'],intents:['equilibre','legerete']},
    {name:'fonio tomate-herbes',tags:['protein','vegetable'],cultures:['west_africa'],intents:['equilibre','energie']}
  );
  COMPLEMENTS.vegetable.push(
    {name:'champignons crème-thym',tags:['pastry_dough','bread','pasta'],intents:['gourmandise']},
    {name:'poireaux fondants à la muscade',tags:['pastry_dough','pasta'],intents:['digestion','gourmandise']},
    {name:'épinards ail-muscade',tags:['pastry_dough','bread','pasta'],intents:['equilibre']},
    {name:'oignons fondants au thym',tags:['pastry_dough','bread','protein'],intents:['gourmandise','equilibre']},
    {name:'courgette en fines lamelles',tags:['pastry_dough','bread'],intents:['legerete','equilibre']},
    {name:'tomate-concombre-oignon rouge',tags:['grain','bread','protein','fish'],intents:['equilibre','legerete']},
    {name:'roquette & tomates cerises',tags:['bread','pasta','protein'],cultures:['mediterranean'],intents:['legerete','gourmandise']},
    {name:'sucrine, concombre & herbes',tags:['protein','tuber','grain'],intents:['legerete','equilibre']},
    {name:'courgette citron-basilic',tags:['pasta','fish','grain'],cultures:['mediterranean'],intents:['digestion','legerete']},
    {name:'aubergine tomate-oignon',tags:['grain','tuber','protein'],cultures:['maghreb','west_africa'],intents:['gourmandise','equilibre']},
    {name:'gombo aux aromates',tags:['grain','tuber','protein'],cultures:['west_africa','central_africa'],intents:['equilibre']},
    {name:'feuilles de manioc mijotées',tags:['tuber','grain','protein'],cultures:['central_africa'],intents:['equilibre','construire']},
    {name:'ndolè/feuilles vertes sans sauce lourde',tags:['tuber','grain','protein'],cultures:['central_africa'],intents:['equilibre']},
    {name:'chou braisé tomate-oignon',tags:['grain','protein'],cultures:['west_africa','central_africa'],intents:['equilibre','gourmandise']},
    {name:'poivron-oignon façon piperade',tags:['protein','tuber','grain'],intents:['gourmandise','equilibre']},
    {name:'carottes gingembre-sésame',tags:['grain','noodle','fish'],cultures:['east_asia'],intents:['digestion','equilibre']},
    {name:'concombre vinaigre de riz-sésame',tags:['grain','noodle','fish'],cultures:['east_asia'],intents:['legerete']},
    {name:'brocoli ail-citron',tags:['protein','pasta','grain'],intents:['equilibre','construire']},
    {name:'chou-fleur curcuma-cumin',tags:['grain','protein'],cultures:['south_asia'],intents:['digestion','equilibre']},
    {name:'fenouil orange-aneth',tags:['fish','salad'],intents:['digestion','legerete']},
    {name:'champignons soja-gingembre',tags:['grain','noodle','protein'],cultures:['east_asia'],intents:['gourmandise']},
    {name:'betterave-feta-herbes',tags:['salad','grain'],intents:['equilibre','gourmandise']},
    {name:'maïs, tomate & avocat',tags:['grain','protein','salad'],cultures:['latin'],intents:['energie','equilibre']},
    {name:'courge paprika-romarin',tags:['protein','grain'],intents:['gourmandise','equilibre']},
    {name:'haricots verts citron-amandes',tags:['fish','protein','tuber'],intents:['equilibre','gourmandise']}
  );
  COMPLEMENTS.finish.push(
    {name:'sauce verte coriandre-menthe',tags:['grain','protein','salad'],intents:['legerete','equilibre']},
    {name:'citron confit & coriandre',tags:['grain','fish','protein'],cultures:['maghreb'],intents:['gourmandise']},
    {name:'sauce tomate-oignon courte',tags:['grain','tuber','protein'],cultures:['west_africa','central_africa'],intents:['equilibre']},
    {name:'arachide-citron-piment doux',tags:['grain','tuber','protein'],cultures:['west_africa'],intents:['energie','gourmandise']},
    {name:'miso-citron-sésame',tags:['grain','noodle','fish'],cultures:['east_asia'],intents:['equilibre']},
    {name:'coco-curry-citron vert',tags:['grain','fish','protein'],cultures:['southeast_asia','south_asia'],intents:['gourmandise','energie']},
    {name:'raïta concombre-menthe',tags:['grain','protein'],cultures:['south_asia'],intents:['digestion','legerete']},
    {name:'harissa douce & citron',tags:['grain','protein','tuber'],cultures:['maghreb'],intents:['energie','gourmandise']},
    {name:'salsa avocat-citron vert',tags:['grain','protein','bread'],cultures:['latin'],intents:['gourmandise','equilibre']},
    {name:'jus de cuisson moutarde-herbes',tags:['protein','tuber'],intents:['gourmandise','equilibre']},
    {name:'crème citron-aneth',tags:['fish','pasta'],intents:['gourmandise']},
    {name:'ricotta citronnée & poivre',tags:['pasta','bread'],intents:['gourmandise','equilibre']},
    {name:'oignons fondants au cumin',tags:['grain','tuber','protein'],intents:['gourmandise','digestion']},
    {name:'tomates cerises rôties',tags:['pasta','bread','grain'],intents:['gourmandise']},
    {name:'pickles concombre-oignon',tags:['grain','bread','protein'],intents:['legerete']}
  );
  COMPLEMENTS.sweet_finish.push(
    {name:'vanille & cannelle',tags:['dessert','smoothie'],intents:['equilibre','digestion']},
    {name:'cardamome & pistache',tags:['dessert','smoothie'],intents:['gourmandise']},
    {name:'café & cacao',tags:['dessert'],intents:['gourmandise','energie']},
    {name:'fruits rouges frais',tags:['dessert','smoothie'],intents:['equilibre','legerete']},
    {name:'mangue & citron vert',tags:['dessert','smoothie'],intents:['energie','gourmandise']},
    {name:'poire & cannelle',tags:['dessert'],intents:['digestion','gourmandise']},
    {name:'flocons d’avoine grillés',tags:['smoothie','dessert'],intents:['energie','construire']},
    {name:'purée d’amande & cacao',tags:['smoothie','dessert'],intents:['construire','gourmandise']},
    {name:'graines de chanvre & fruits rouges',tags:['smoothie'],intents:['construire','equilibre']},
    {name:'menthe & agrumes',tags:['dessert','smoothie'],intents:['legerete','digestion']}
  );
  COMPLEMENTS.beverage_finish.push(
    {name:'cannelle & cardamome',tags:['beverage'],intents:['equilibre','gourmandise']},
    {name:'vanille & cannelle',tags:['beverage'],intents:['digestion','gourmandise']},
    {name:'cacao non sucré',tags:['beverage'],intents:['gourmandise','construire']},
    {name:'matcha & vanille',tags:['beverage'],intents:['energie']},
    {name:'café & cannelle',tags:['beverage'],intents:['energie','gourmandise']},
    {name:'gingembre & citron',tags:['beverage'],intents:['digestion','energie']},
    {name:'menthe & citron vert',tags:['beverage'],intents:['legerete']},
    {name:'framboise & basilic',tags:['beverage'],intents:['equilibre','gourmandise']},
    {name:'hibiscus & gingembre',tags:['beverage'],intents:['energie','equilibre']},
    {name:'fleur d’oranger & cannelle',tags:['beverage'],intents:['gourmandise','digestion']}
  );

  const INTENT_EXPLANATIONS={
    equilibre:[
      'La proposition garde ce que tu as déjà et ajoute seulement les repères manquants pour former un ensemble plus complet.',
      'Tee conserve la structure naturelle de tes ingrédients et complète le plat sans ajouter une deuxième base inutile.',
      'L’idée équilibre les rôles présents — base, protéine et végétaux — tout en gardant une préparation culinaire cohérente.',
      'Le complément choisi sert à finir le repas, pas à le reconstruire : les ingrédients disponibles restent au centre.'
    ],
    digestion:[
      'La variante privilégie une cuisson lisible, des textures souples et un assaisonnement modéré ; adapte toujours selon ton confort personnel.',
      'Tee évite ici d’empiler les sauces et préfère une préparation simple, avec les ingrédients fragiles ajoutés au bon moment.',
      'Cette proposition mise sur une cuisson douce ou un assemblage frais et laisse les condiments puissants faciles à doser.',
      'La structure reste complète mais volontairement simple, afin que tu puisses ajuster les quantités et l’assaisonnement à ton ressenti.'
    ],
    energie:[
      'La suggestion sécurise une base énergétique claire et l’associe à un élément protéiné ou végétal qui rend le plat plus soutenant.',
      'Tee transforme tes ingrédients en repas pratique pour une journée active, sans multiplier les ajouts inutiles.',
      'La base glucidique est valorisée et accompagnée d’un complément qui améliore la tenue du repas.',
      'Cette version cherche une assiette soutenante : base, garniture et finition sont pensées pour fonctionner ensemble.'
    ],
    construire:[
      'La proposition renforce en priorité la densité du repas et la présence d’une source protéinée cohérente avec la préparation.',
      'Tee vérifie d’abord que la composante protéinée est suffisante, puis complète la base si nécessaire.',
      'Cette variante garde les ingrédients déjà présents et oriente les ajouts vers une assiette plus consistante.',
      'Le complément n’est pas décoratif : il sert à rendre la préparation plus nourrissante et structurée.'
    ],
    legerete:[
      'La proposition privilégie les végétaux, les herbes, l’acidité et les contrastes de texture plutôt qu’une sauce lourde.',
      'Tee conserve une vraie assiette tout en donnant davantage de place aux éléments frais ou rôtis simplement.',
      'Cette variante allège surtout la forme du plat : plus de fraîcheur, une sauce courte et des ajouts ciblés.',
      'Le repas reste structuré, mais la finition mise sur les herbes, les crudités ou une cuisson simple.'
    ],
    gourmandise:[
      'La variante joue sur le doré, le crémeux, le croustillant ou le contraste chaud-froid pour créer une vraie différence.',
      'Tee garde tes ingrédients principaux mais change la technique et la finition pour une proposition plus généreuse.',
      'Le plaisir vient ici de la texture et de la cuisson : gratiné, rôti, laqué ou crémeux selon ce qui fonctionne avec tes ingrédients.',
      'Cette version ne se contente pas d’ajouter du fromage : elle transforme réellement la forme, la cuisson ou la sauce du plat.'
    ]
  };

  const SAFETY={rawFish:'Pour une version crue ou marinée, utilise uniquement un poisson adapté à cet usage et respecte la chaîne du froid ; sinon cuis-le.'};

  return {STOPWORDS,PHRASE_RULES,CIQUAL_ROLE_MAP,CULTURES,FORMS,TARGETS,COMPLEMENTS,INTENT_EXPLANATIONS,SAFETY,version:'2.0.0'};
});
