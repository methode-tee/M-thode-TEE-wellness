(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MTFoodAffinities=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  // Data-driven knowledge added after V412. The goal is to keep culinary logic
  // out of one giant if/else chain: the engine matches semantic traits and then
  // rotates inside compatible forms/complements.

  const PREPARED_DISHES=[
    {id:'cantonese_rice',re:/\b(riz\s+cantonais|cantonese\s+fried\s+rice|fried\s+rice)\b/,label:'riz cantonais',roles:['starch','protein','vegetable'],traits:['prepared_dish','fried_rice','composite_complete'],culture:'east_asia'},
    {id:'tabbouleh',re:/\b(taboule|taboul[eé]|tabbouleh)\b/,label:'taboulé',roles:['starch','vegetable'],traits:['prepared_dish','cold_composite'],culture:'mediterranean'},
    {id:'ratatouille',re:/\bratatouille\b/,label:'ratatouille',roles:['vegetable'],traits:['prepared_dish','vegetable_composite'],culture:'mediterranean'},
    {id:'risotto',re:/\brisotto\b/,label:'risotto',roles:['starch'],traits:['prepared_dish','creamy_grain'],culture:'mediterranean'},
    {id:'paella',re:/\bpaella\b/,label:'paella',roles:['starch','protein','vegetable'],traits:['prepared_dish','composite_complete'],culture:'mediterranean'},
    {id:'nicoise',re:/\bsalade\s+ni[cç]oise\b/,label:'salade niçoise',roles:['protein','vegetable','starch'],traits:['prepared_dish','cold_composite','composite_complete'],culture:'mediterranean'},
    {id:'greek_salad',re:/\bsalade\s+grecque\b/,label:'salade grecque',roles:['protein','vegetable'],traits:['prepared_dish','cold_composite'],culture:'mediterranean'},
    {id:'caesar',re:/\bsalade\s+c[eé]sar\b/,label:'salade César',roles:['protein','vegetable','starch'],traits:['prepared_dish','cold_composite'],culture:'mediterranean'},
    {id:'dauphinois',re:/\b(gratin\s+dauphinois|dauphinois)\b/,label:'gratin dauphinois',roles:['starch','dairy'],traits:['prepared_dish','potato_composite'],culture:'mediterranean'},
    {id:'parmentier',re:/\b(hachis\s+parmentier|parmentier)\b/,label:'hachis parmentier',roles:['starch','protein'],traits:['prepared_dish','composite_complete'],culture:'mediterranean'},
    {id:'moussaka',re:/\bmoussaka\b/,label:'moussaka',roles:['protein','vegetable','starch'],traits:['prepared_dish','composite_complete'],culture:'mediterranean'},
    {id:'cassoulet',re:/\bcassoulet\b/,label:'cassoulet',roles:['protein','starch'],traits:['prepared_dish','composite_complete'],culture:'mediterranean'},
    {id:'chili',re:/\bchili\s+con\s+carne\b/,label:'chili con carne',roles:['protein','vegetable','starch'],traits:['prepared_dish','composite_complete'],culture:'latin'},
    {id:'poke',re:/\bpoke(?:\s+bowl)?\b/,label:'poke bowl',roles:['starch','protein','vegetable'],traits:['prepared_dish','cold_composite','composite_complete']},
    {id:'bibimbap',re:/\bbibimbap\b/,label:'bibimbap',roles:['starch','protein','vegetable'],traits:['prepared_dish','composite_complete'],culture:'east_asia'},
    {id:'kimchi_fried_rice',re:/\b(riz\s+saute\s+au\s+kimchi|kimchi\s+fried\s+rice)\b/,label:'riz sauté au kimchi',roles:['starch','vegetable'],traits:['prepared_dish','fried_rice'],culture:'east_asia'},
    {id:'japchae',re:/\bjapchae\b/,label:'japchae',roles:['starch','vegetable'],traits:['prepared_dish','noodle_composite'],culture:'east_asia'},
    {id:'nasi_goreng',re:/\bnasi\s+goreng\b/,label:'nasi goreng',roles:['starch','protein','vegetable'],traits:['prepared_dish','fried_rice','composite_complete'],culture:'southeast_asia'},
    {id:'mee_goreng',re:/\bmee\s+goreng\b/,label:'mee goreng',roles:['starch','protein','vegetable'],traits:['prepared_dish','noodle_composite','composite_complete'],culture:'southeast_asia'},
    {id:'pho',re:/\bpho\b/,label:'pho',roles:['starch','protein','vegetable'],traits:['prepared_dish','soup_composite'],culture:'southeast_asia'},
    {id:'laksa',re:/\blaksa\b/,label:'laksa',roles:['starch','protein','vegetable'],traits:['prepared_dish','soup_composite'],culture:'southeast_asia'},
    {id:'gado_gado',re:/\bgado[- ]?gado\b/,label:'gado-gado',roles:['protein','vegetable','starch'],traits:['prepared_dish','composite_complete'],culture:'southeast_asia'},
    {id:'biryani',re:/\bbiryani\b/,label:'biryani',roles:['starch','protein','vegetable'],traits:['prepared_dish','composite_complete'],culture:'south_asia'},
    {id:'dal',re:/\b(dal|dhal)\b/,label:'dal',roles:['protein'],traits:['prepared_dish','pulse_composite'],culture:'south_asia'},
    {id:'chana_masala',re:/\bchana\s+masala\b/,label:'chana masala',roles:['protein','vegetable'],traits:['prepared_dish','pulse_composite'],culture:'south_asia'},
    {id:'rajma',re:/\brajma\b/,label:'rajma',roles:['protein','vegetable'],traits:['prepared_dish','pulse_composite'],culture:'south_asia'},
    {id:'khichdi',re:/\b(khichdi|khichri)\b/,label:'khichdi',roles:['starch','protein'],traits:['prepared_dish','composite_complete'],culture:'south_asia'},
    {id:'palak_paneer',re:/\bpalak\s+paneer\b/,label:'palak paneer',roles:['protein','vegetable'],traits:['prepared_dish','composite_complete'],culture:'south_asia'},
    {id:'jollof',re:/\bjollof(?:\s+rice)?\b/,label:'jollof rice',roles:['starch','vegetable'],traits:['prepared_dish','rice_composite'],culture:'west_africa'},
    {id:'waakye',re:/\bwaakye\b/,label:'waakye',roles:['starch','protein'],traits:['prepared_dish','composite_complete'],culture:'west_africa'},
    {id:'thieb',re:/\b(thieboudienne|thi[eé]boudi[eè]ne|ceebu\s+j[eë]n)\b/,label:'thiéboudiène',roles:['starch','protein','vegetable'],traits:['prepared_dish','composite_complete'],culture:'west_africa'},
    {id:'garba',re:/\bgarba\b/,label:'garba',roles:['starch','protein','vegetable'],traits:['prepared_dish','composite_complete'],culture:'west_africa'},
    {id:'yassa',re:/\byassa\b/,label:'yassa',roles:['protein','vegetable'],traits:['prepared_dish','sauce_composite'],culture:'west_africa'},
    {id:'mafe',re:/\bmafe|mafé\b/,label:'mafé',roles:['protein','vegetable'],traits:['prepared_dish','sauce_composite'],culture:'west_africa'},
    {id:'poulet_dg',re:/\bpoulet\s+dg\b/,label:'Poulet DG',roles:['starch','protein','vegetable'],traits:['prepared_dish','composite_complete'],culture:'central_africa'},
    {id:'ndole',re:/\bndol[eèé]\b/,label:'Ndolè',roles:['protein','vegetable'],traits:['prepared_dish','sauce_composite'],culture:'central_africa'},
    {id:'pondu',re:/\b(pondu|saka[- ]?saka)\b/,label:'pondu',roles:['vegetable'],traits:['prepared_dish','sauce_composite'],culture:'central_africa'},
    {id:'harira',re:/\bharira\b/,label:'harira',roles:['protein','vegetable','starch'],traits:['prepared_dish','soup_composite'],culture:'maghreb'},
    {id:'chakchouka',re:/\b(chakchouka|shakshuka)\b/,label:'chakchouka',roles:['protein','vegetable'],traits:['prepared_dish','composite_complete'],culture:'maghreb'},
    {id:'lablabi',re:/\blablabi\b/,label:'lablabi',roles:['protein','starch'],traits:['prepared_dish','composite_complete'],culture:'maghreb'},
    {id:'couscous_complete',re:/\bcouscous\s+(royal|au\s+poulet|a\s+la\s+viande|aux\s+legumes|aux\s+l[eé]gumes)\b/,label:'couscous garni',roles:['starch','protein','vegetable'],traits:['prepared_dish','composite_complete'],culture:'maghreb'}
  ];

  const COMBO_RULES=[
    {
      id:'prepared_east_asia_fish_starch',modes:['grain','mixed'],allTraits:['prepared_dish','fish'],culture:'east_asia',minStarches:2,
      additions:{
        equilibre:['concombre citronné ou légumes sautés au gingembre','pak choï à l’ail ou concombre au sésame','carottes gingembre-sésame ou chou croquant','edamame au sésame ou salade de concombre'],
        digestion:['concombre au vinaigre de riz ou carottes au gingembre doux','bouillon miso léger ou courgette vapeur','pak choï juste tombé ou chou émincé','gingembre doux & citron vert'],
        energie:['mangue verte & citron vert ou chou croquant','pak choï au gingembre ou carottes sésame','sauce soja-citron vert & cébette','poivron sauté & sésame','concombre croquant & citron vert','champignons soja-gingembre'],
        construire:['edamame ou tofu miso-sésame','œuf mollet & cébette','tofu grillé au sésame','salade de chou & edamame'],
        legerete:['concombre vinaigre de riz-sésame','chou croquant & citron vert','radis, concombre & cébette','pak choï vapeur & citron'],
        gourmandise:['miso-citron-sésame','champignons soja-gingembre','sauce soja-citron vert & sésame','cacahuètes, coriandre & citron vert']
      },
      prepKind:'prepared_fusion'
    },
    {
      id:'pasta_cured_bean',modes:['pasta'],allTraits:['cured_meat'],anyTraits:['ambiguous_bean','pulse'],
      forms:['Pâtes poêlées · lardons & haricots','Pâtes en sauce courte · lardons & haricots','Salade tiède de pâtes · lardons & haricots','Pâtes façon risottata · lardons & haricots','Pâtes rôties au four · lardons & haricots','Pâtes citron-herbes · lardons & haricots','Gratin léger de pâtes · lardons & haricots','Pâtes tomate-oignon · lardons & haricots'],
      additions:{
        equilibre:['persil, ail & citron','tomates cerises & basilic','oignon rouge & herbes fraîches','brocoli ail-citron','poivron rôti & persil','courgette citron-basilic'],
        digestion:['courgette fondante & persil','fenouil citronné & aneth','carottes douces & ciboulette','bouillon léger ail-persil','poireau fondant & muscade','citron & herbes fraîches'],
        energie:['tomates rôties & parmesan','poivron-oignon & paprika','pesto de roquette & citron','olives & tomates cerises','ricotta citronnée & poivre','sauce tomate courte & basilic'],
        construire:['parmesan & graines de courge','ricotta & ciboulette','œuf mollet & persil','skyr salé citron-herbes','feta & herbes fraîches','fromage frais & ciboulette'],
        legerete:['tomates, persil & citron','roquette & tomates cerises','concombre citronné à côté','fenouil cru & herbes','courgette en rubans & citron','persil, citron & poivre'],
        gourmandise:['crème moutarde & ciboulette','parmesan & champignons persillés','ricotta citronnée & poivre','pesto basilic & tomates rôties','oignons fondants & parmesan','crème légère au chèvre & thym']
      },
      prepKind:'pasta_cured_bean'
    },
    {
      id:'fresh_water_fruit_herb',modes:['beverage'],allTraits:['water'],allRoles:['fruit'],anyText:[/menthe|basilic|romarin|thym|verveine|coriandre/],
      forms:['Eau infusée','Eau fraîche aromatisée','Citronnade fruitée','Mocktail sans alcool','Granité fruit-herbes','Eau pétillante fruit-herbes','Infusion froide fruitée','Eau glacée aux fruits écrasés'],
      additions:{
        equilibre:['citron vert ou glaçons','zeste de citron jaune','eau pétillante pour une version fizz','quelques glaçons pilés','citron vert & glaçons','un trait de citron jaune'],
        digestion:['gingembre frais ou citron jaune','citron vert & menthe supplémentaire','verveine ou gingembre doux','zeste de citron & glaçons','concombre en fines rondelles','fenouil très fin & citron'],
        energie:['citron vert & eau pétillante','gingembre frais & glaçons','hibiscus froid & citron','orange & menthe','ananas en petits dés','eau de coco pour remplacer une partie de l’eau'],
        construire:['graines de chia bien hydratées','eau de coco pour remplacer une partie de l’eau','fruits rouges supplémentaires','yaourt à part si tu veux en faire une collation','glaçons & citron vert','orange fraîche'],
        legerete:['citron vert ou glaçons','concombre & citron vert','pamplemousse & menthe','pastèque & menthe','glaçons pilés & citron','basilic frais & citron'],
        gourmandise:['eau pétillante & citron vert','framboises écrasées','sirop maison léger de fraise','basilic & citron vert','pêche fraîche & menthe','glaçons pilés façon granité']
      },
      prepKind:'water_fruit_herb'
    }
  ];

  const MODE_FINISHES={
    pasta:{
      equilibre:['ail, persil & citron','tomates cerises & basilic','brocoli ail-citron','courgette citron-basilic','poivron rôti & persil','champignons persillés','roquette & tomates cerises','petits pois & menthe','fenouil citronné','aubergine tomate-oignon'],
      digestion:['courgette fondante','fenouil citronné','poireau fondant','carottes douces','persil & citron','épinards juste tombés','bouillon léger aux herbes','champignons doux & persil'],
      energie:['tomates rôties & parmesan','pesto basilic','poivron-oignon','olives & citron','ricotta citronnée','aubergine confite','champignons & parmesan','sauce tomate courte'],
      construire:['parmesan & graines','ricotta & herbes','œuf mollet','feta & pois chiches','thon citronné','poulet grillé en lamelles','skyr salé aux herbes','tofu grillé au sésame'],
      legerete:['roquette & citron','tomates fraîches & basilic','courgette en rubans','fenouil cru & herbes','concombre citronné à côté','épinards & citron','persil & zeste de citron','poivron cru & herbes'],
      gourmandise:['crème moutarde & ciboulette','parmesan & champignons','pesto & tomates rôties','ricotta citron-poivre','chèvre & thym','gorgonzola & noix','aubergine confite & parmesan','beurre noisette & sauge']
    },
    grain:{
      equilibre:['concombre citronné & herbes','carottes gingembre-sésame','brocoli ail-citron','tomate-oignon-coriandre','gombo aux aromates','poivron-oignon & persil','chou croquant & citron','aubergine tomate-oignon'],
      digestion:['carottes & gingembre doux','courgette & menthe','fenouil citronné','bouillon léger aux herbes','concombre & menthe','épinards juste tombés','courge rôtie douce','poireau fondant'],
      energie:['avocat & citron vert','plantain rôti','mangue verte & herbes','cacahuètes & coriandre','œuf mollet & ciboule','maïs-tomate-avocat','patate douce rôtie','sauce tomate-oignon'],
      construire:['œufs & ciboule','tofu miso-sésame','poulet grillé','saumon émietté citron-aneth','niébé tomate-oignon','lentilles corail','edamame sésame','feta & pois chiches'],
      legerete:['concombre vinaigre de riz-sésame','chou émincé & citron','tomate-concombre-oignon','herbes fraîches & citron','radis & concombre','roquette & citron','pickles concombre-oignon','fenouil & agrumes'],
      gourmandise:['coco-curry-citron vert','oignons fondants au cumin','tomates rôties & feta','champignons soja-gingembre','aubergine confite','arachide-citron-piment doux','miso-citron-sésame','poivrons grillés & olives']
    },
    tuber:{
      equilibre:['salade tomate-concombre-oignon','brocoli ail-citron','gombo tomate-oignon','feuilles vertes mijotées','poivron-oignon','chou braisé tomate','courgette citron-basilic','herbes fraîches & citron'],
      digestion:['fenouil & herbes','courgette fondante','carottes douces','épinards juste tombés','poireau fondant','concombre citronné','bouillon léger aux herbes','courge rôtie douce'],
      energie:['œuf mollet & herbes','poulet grillé','thon citronné','sauce tomate-oignon','avocat & citron','plantain rôti si la base n’en contient pas','arachides grillées & herbes','feta & tomate'],
      construire:['poulet grillé','œufs & herbes','poisson grillé','tofu mariné','niébé tomate-oignon','lentilles épicées douces','feta & pois chiches','skyr salé aux herbes'],
      legerete:['sucrine & concombre','roquette & citron','tomates fraîches & herbes','fenouil cru','concombre-oignon rouge','chou croquant','radis & herbes','salade verte citronnée'],
      gourmandise:['jus de cuisson moutarde-herbes','champignons persillés','oignons fondants','crème citron-aneth','parmesan & herbes','chèvre & thym','sauce tomate courte','beurre noisette & sauge']
    },
    fish:{
      equilibre:['concombre citronné & aneth','brocoli ail-citron','fenouil orange-aneth','tomates rôties & basilic','carottes gingembre-sésame','gombo tomate-oignon','courgette citron-basilic','chou croquant & citron'],
      digestion:['fenouil & aneth','courgette vapeur citronnée','carottes douces & gingembre','concombre & menthe','poireau fondant','bouillon léger citronné','épinards juste tombés','herbes fraîches & citron'],
      energie:['riz coco-citron vert','patate douce rôtie','semoule citron-coriandre','avocat & citron vert','nouilles soba','plantain rôti','fonio tomate-herbes','pommes de terre aux herbes'],
      construire:['riz complet aux herbes','quinoa & herbes','lentilles & citron','pois chiches chermoula','edamame sésame','œuf mollet','semoule & pois chiches','pain pita grillé'],
      legerete:['concombre vinaigre de riz','fenouil & agrumes','roquette & citron','tomate-concombre','chou émincé','radis & herbes','salade verte citronnée','pickles concombre-oignon'],
      gourmandise:['crème citron-aneth','beurre noisette & citron','miso-citron-sésame','coco-curry-citron vert','tomates confites & olives','champignons crème-thym','pesto de roquette','sauce vierge tomate-herbes']
    },
    protein:{
      equilibre:['tomate-concombre-oignon','brocoli ail-citron','courgette citron-basilic','carottes gingembre','poivron-oignon','gombo aux aromates','chou braisé tomate','roquette & tomates'],
      digestion:['courgette fondante','fenouil citronné','carottes douces','poireau fondant','épinards juste tombés','bouillon léger','concombre & menthe','courge rôtie douce'],
      energie:['riz aux herbes','semoule citron-coriandre','patate douce rôtie','plantain rôti','fonio tomate-herbes','quinoa aux herbes','pain pita grillé','pommes de terre rôties'],
      construire:['lentilles & herbes','pois chiches chermoula','œufs & herbes','tofu grillé','feta & pois chiches','quinoa & graines','edamame sésame','skyr salé aux herbes'],
      legerete:['sucrine & concombre','roquette & citron','tomates fraîches','fenouil cru','chou croquant','radis & herbes','concombre-oignon rouge','herbes fraîches & citron'],
      gourmandise:['jus de cuisson moutarde-herbes','champignons persillés','oignons fondants','crème citronnée','tomates confites','pesto & parmesan','poivrons grillés','beurre noisette & thym']
    },
    salad:{
      equilibre:['feta & pois chiches','œufs durs & herbes','thon citronné','poulet grillé','pain pita grillé','quinoa aux herbes','avocat & graines','fromage frais aux herbes'],
      digestion:['œuf mollet','riz blanc ou quinoa en petite portion','fenouil & menthe','carottes douces','yaourt aux herbes','pain grillé léger','tofu nature citronné','pois chiches rincés & herbes'],
      energie:['quinoa & avocat','riz aux herbes','patate douce rôtie','pain pita grillé','maïs & avocat','poulet grillé','œufs & graines','pois chiches paprika-cumin'],
      construire:['poulet grillé','thon ou saumon','œufs & graines','tofu ou tempeh','feta & pois chiches','lentilles & herbes','skyr salé','quinoa & edamame'],
      legerete:['citron & herbes fraîches','radis & concombre','fenouil & agrumes','pickles oignon-concombre','menthe & citron vert','vinaigre balsamique & basilic','sumac & persil','aneth & citron'],
      gourmandise:['burrata & basilic','chèvre & noix','feta & olives','avocat & graines grillées','pesto de roquette','champignons rôtis','tomates confites','pain grillé à l’ail']
    }
  };

  const EXTRA_CULTURAL_DISHES=[
    {name:'Bibimbap',aliases:['bibimbap'],typical:['riz','légumes','œuf'],optional:['bœuf','tofu','kimchi','gochujang'],family:'complete_composite',culture:'east_asia'},
    {name:'Bulgogi',aliases:['bulgogi'],typical:['bœuf','sauce soja','ail'],optional:['sésame','poire','riz','légumes'],family:'protein_main',culture:'east_asia'},
    {name:'Japchae',aliases:['japchae'],typical:['nouilles de patate douce','légumes'],optional:['bœuf','tofu','sésame'],family:'noodle_dish',culture:'east_asia'},
    {name:'Kimchi fried rice',aliases:['kimchi fried rice','riz sauté au kimchi'],typical:['riz','kimchi'],optional:['œuf','porc','tofu','cébette'],family:'complete_composite',culture:'east_asia'},
    {name:'Nasi goreng',aliases:['nasi goreng'],typical:['riz sauté','œuf','légumes'],optional:['poulet','crevettes','tofu'],family:'complete_composite',culture:'southeast_asia'},
    {name:'Pho',aliases:['pho'],typical:['bouillon','nouilles de riz','herbes'],optional:['bœuf','poulet','tofu'],family:'soup',culture:'southeast_asia'},
    {name:'Laksa',aliases:['laksa'],typical:['nouilles','bouillon coco épicé'],optional:['crevettes','poulet','tofu','œuf'],family:'soup',culture:'southeast_asia'},
    {name:'Gado-gado',aliases:['gado gado','gado-gado'],typical:['légumes','sauce arachide'],optional:['tofu','tempeh','œuf','pomme de terre'],family:'complete_composite',culture:'southeast_asia'},
    {name:'Biryani',aliases:['biryani'],typical:['riz','épices'],optional:['poulet','agneau','légumes','œuf'],family:'complete_composite',culture:'south_asia'},
    {name:'Dal',aliases:['dal','dhal'],typical:['lentilles','épices'],optional:['tomate','épinards','riz','chapati'],family:'sauce_dish',culture:'south_asia'},
    {name:'Chana masala',aliases:['chana masala'],typical:['pois chiches','tomate','épices'],optional:['riz','chapati','coriandre'],family:'sauce_dish',culture:'south_asia'},
    {name:'Rajma',aliases:['rajma'],typical:['haricots rouges','tomate','épices'],optional:['riz','coriandre'],family:'sauce_dish',culture:'south_asia'},
    {name:'Khichdi',aliases:['khichdi','khichri'],typical:['riz','lentilles'],optional:['légumes','ghee','épices'],family:'complete_composite',culture:'south_asia'},
    {name:'Injera & wat',aliases:['injera','doro wat','misir wat','shiro wat'],typical:['injera','ragoût épicé'],optional:['poulet','lentilles','pois chiches','légumes'],family:'complete_composite',culture:'east_africa'},
    {name:'Ugali',aliases:['ugali'],typical:['farine de maïs'],optional:['légumes','sauce','viande','poisson'],family:'starch_side',culture:'east_africa'},
    {name:'Pilau est-africain',aliases:['pilau','pilaf est africain'],typical:['riz','épices'],optional:['bœuf','poulet','légumes'],family:'complete_composite',culture:'east_africa'},
    {name:'Matoke',aliases:['matoke'],typical:['banane plantain verte'],optional:['tomate','oignon','viande','haricots'],family:'starch_side',culture:'east_africa'}
  ];

  return {PREPARED_DISHES,COMBO_RULES,MODE_FINISHES,EXTRA_CULTURAL_DISHES,version:'3.0.0'};
});
