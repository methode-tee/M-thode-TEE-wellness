(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MTFoodUniversalEngine=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const INTENT_LABELS={
    equilibre:'équilibre',digestion:'digestion',energie:'énergie',
    construire:'nourrir et construire',legerete:'légèreté',gourmandise:'gourmandise'
  };
  const norm=value=>String(value||'').toLocaleLowerCase('fr').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[^a-z0-9]+/g,' ').trim();
  const words=value=>norm(value).split(/\s+/).filter(Boolean);
  const has=(value,pattern)=>pattern.test(` ${norm(value)} `);
  const unique=rows=>[...new Set((rows||[]).filter(Boolean))];
  const list=rows=>{const x=unique(rows);return x.length<2?(x[0]||''):`${x.slice(0,-1).join(', ')} et ${x.at(-1)}`;};
  const titleCase=value=>String(value||'').replace(/^./,c=>c.toLocaleUpperCase('fr'));
  const choose=(rows,seed)=>Array.isArray(rows)&&rows.length?rows[Math.abs(seed)%rows.length]:'';
  const hash=value=>{let h=2166136261;for(const c of String(value||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  const contains=(input,ingredient)=>{
    const a=` ${norm(input)} `,b=norm(ingredient);if(!b)return false;
    if(a.includes(` ${b} `))return true;
    const bw=words(b).filter(x=>x.length>3),aw=new Set(words(a));
    return bw.length>0&&bw.every(w=>aw.has(w)||[...aw].some(x=>x.length>4&&(x.startsWith(w)||w.startsWith(x))));
  };

  const RX={
    grain:/\b(riz|pates?|spaghetti|tagliatelle|linguine|nouilles?|vermicelles?|soba|udon|ramen|semoule|couscous|quinoa|boulgour|fonio|millet|mil|sorgho|orge|avoine|polenta|mais|ble|sarrasin|ebly)\b/,
    tuber:/\b(pommes? de terre|patates? douces?|manioc|igname|taro|macabo|plantain|bananes? plantain|chikwangue|atti[eé]k[eé]|foufou)\b/,
    bread:/\b(pain|baguette|pain de mie|brioche|wrap|tortilla|galette|naan|pita|chapati|msemen|mhadjeb)\b/,
    flour:/\b(farine|fecule|maizena|poudre d amande)\b/,
    legume:/\b(lentilles?|pois chiches?|haricots? (?:rouges?|blancs?|noirs?|secs?)|flageolets?|feves?|soja|edamame|pois casses?|moi moi|koki|tofu|tempeh)\b/,
    poultry:/\b(poulet|dinde|canard|pintade|caille)\b/,
    redMeat:/\b(boeuf|rumsteck|steak|viande hachee|veau|agneau|mouton|chevre|ntaba|kefta|kofta)\b/,
    pork:/\b(porc|jambon|lardons?|bacon|saucisses?|merguez|charcuterie|chorizo|andouille|cervelas|mortadelle|salami|coppa|pancetta)\b/,
    fish:/\b(poisson|saumon|thon|dorade|daurade|cabillaud|colin|merlu|merlan|sole|truite|tilapia|capitaine|vivaneau|sardines?|maquereau|anchois|morue|lieu|bar|loup de mer|hareng|haddock|eglefin|espadon|rouget|turbot|lotte)\b/,
    seafood:/\b(crevettes?|gambas|crabe|homard|langoustines?|moules?|huitres?|calamar|encornet|poulpe|seiche|coquilles? saint jacques)\b/,
    egg:/\b(oeufs?|omelette)\b/,
    dairy:/\b(yaourt|yogourt|fromage blanc|skyr|petit suisse|kefir|lait|boisson d amande|lait d amande|lait de coco|boisson de soja)\b/,
    cheese:/\b(fromage|emmental|mozzarella|parmesan|feta|chevre|comte|gruyere|ricotta|mascarpone|caprice des dieux|camembert|brie|cheddar|gouda|halloumi)\b/,
    cream:/\b(creme|creme liquide|creme fraiche|creme de coco)\b/,
    fat:/\b(beurre|huile|margarine|ghee|saindoux)\b/,
    leaf:/\b(salade|laitue|roquette|mache|endive|epinards?|feuilles? de manioc|pondu|saka saka|ndole|eru|fumbwa|oseille|chou kale|pak choi|bok choy)\b/,
    vegetable:/\b(tomates?|courgettes?|carottes?|oignons?|poireaux?|poivrons?|aubergines?|brocolis?|chou(?:x| fleur)?|concombres?|champignons?|fenouil|asperges?|artichauts?|betteraves?|celeri|radis|potiron|courges?|gombo|okra|navets?|haricots? verts?|petits? pois|avocat|manioc feuille|kpem|sanga)\b/,
    fruit:/\b(pommes?|poires?|bananes?|fraises?|framboises?|myrtilles?|mures?|cassis|mangues?|ananas|papaye|kiwi|orange|mandarine|clementine|citron|peches?|nectarines?|abricots?|prunes?|raisins?|dattes?|figues?|grenade|fruit de la passion|litchi|goyave|past[eè]que|melon)\b/,
    nut:/\b(amandes?|noisettes?|noix|cacahuetes?|arachides?|pistaches?|cajou|pecan|sesame|chia|lin|chanvre|graines? de courge|tournesol)\b/,
    aromatic:/\b(ail|oignons?|echalote|gingembre|persil|coriandre|menthe|basilic|ciboulette|thym|romarin|aneth|estragon|sauge|citronnelle|curcuma|cumin|paprika|curry|colombo|ras el hanout|cannelle|cardamome|vanille|muscade|piment|harissa|poivre)\b/,
    sauce:/\b(coulis|sauce|pesto|moutarde|miso|soja|tamari|vinaigre|mayonnaise|ketchup|bouillon|concentre de tomate)\b/,
    sweetener:/\b(sucre|miel|sirop d erable|sirop d agave|cassonade)\b/,
    chocolate:/\b(chocolat|cacao|praline|caramel|speculoos)\b/,
    drink:/\b(eau|jus|the|cafe|infusion|tisane|soda|limonade|kombucha|biere|vin|cidre|boisson)\b/
  };

  let ciqualMap=null,ciqualRows=null;
  function ensureCiqual(){
    if(ciqualMap)return;
    const source=(typeof window!=='undefined'&&Array.isArray(window.MT_CIQUAL_INDEX))?window.MT_CIQUAL_INDEX:[];
    ciqualRows=source;ciqualMap=new Map(source.map(row=>[row[0],row[1]]));
  }
  const ciqualCategory=value=>{
    ensureCiqual();const key=norm(value);if(!key)return '';
    if(ciqualMap.has(key))return ciqualMap.get(key);
    let best='',score=0;
    for(const row of ciqualRows){
      const name=row[0];
      if(name.includes(key)||key.includes(name)){
        const next=Math.min(name.length,key.length)/Math.max(name.length,key.length);
        if(next>score){score=next;best=row[1];}
      }
    }
    return score>=.46?best:'';
  };

  function classify(name){
    const n=norm(name),roles=[],traits=[];
    const add=(role,trait)=>{if(role&&!roles.includes(role))roles.push(role);if(trait&&!traits.includes(trait))traits.push(trait);};
    if(has(n,RX.grain))add('starch','grain');
    if(has(n,RX.tuber))add('starch','tuber');
    if(has(n,RX.bread))add('starch','bread');
    if(has(n,RX.flour))add('starch','flour');
    if(has(n,RX.legume))add('protein','legume');
    if(has(n,RX.poultry))add('protein','poultry');
    if(has(n,RX.redMeat))add('protein','red_meat');
    if(has(n,RX.pork))add('protein','pork');
    if(has(n,RX.fish))add('protein','fish');
    if(has(n,RX.seafood))add('protein','seafood');
    if(has(n,RX.egg))add('protein','egg');
    if(has(n,RX.dairy)){add('dairy','dairy');if(/yaourt|yogourt|skyr|fromage blanc/.test(n))add('protein','cultured_dairy');}
    if(has(n,RX.cheese)){add('dairy','cheese');add('fat','cheese');}
    if(has(n,RX.cream)){add('dairy','cream');add('fat','cream');}
    if(has(n,RX.fat))add('fat','fat');
    if(has(n,RX.leaf))add('vegetable','leaf');
    if(has(n,RX.vegetable))add('vegetable','vegetable');
    if(has(n,RX.fruit))add('fruit','fruit');
    if(has(n,RX.nut)){add('fat','nut_seed');add('protein','nut_seed');}
    if(has(n,RX.aromatic))add('aromatic','aromatic');
    if(has(n,RX.sauce))add('sauce','sauce');
    if(has(n,RX.sweetener))add('sweetener','sweetener');
    if(has(n,RX.chocolate)){add('sweet','chocolate');add('fat','chocolate');}
    if(has(n,RX.drink))add('drink','drink');
    const category=ciqualCategory(n);
    ({fish:()=>add('protein','fish'),seafood:()=>add('protein','seafood'),egg:()=>add('protein','egg'),meat:()=>add('protein','meat'),plant_protein:()=>add('protein','plant_protein'),pulse:()=>add('protein','legume'),nut_seed:()=>{add('protein','nut_seed');add('fat','nut_seed');},fruit:()=>add('fruit','fruit'),vegetable:()=>add('vegetable','vegetable'),herb_spice:()=>add('aromatic','aromatic'),binder:()=>add('binder','binder'),pasta_rice_grain:()=>add('starch','grain'),bread:()=>add('starch','bread'),tuber:()=>add('starch','tuber'),flour:()=>add('starch','flour'),breakfast_cereal:()=>add('starch','breakfast_cereal'),yogurt:()=>{add('dairy','dairy');add('protein','cultured_dairy');},cheese:()=>{add('dairy','cheese');add('fat','cheese');},milk:()=>add('dairy','dairy'),cream:()=>{add('dairy','cream');add('fat','cream');},fat:()=>add('fat','fat'),soup:()=>add('composite','soup'),salad:()=>add('vegetable','salad'),pizza_tart:()=>add('composite','pizza_tart'),sandwich:()=>add('composite','sandwich'),composite:()=>add('composite','composite'),chocolate:()=>add('sweet','chocolate'),cake_pastry:()=>add('sweet','pastry'),sweet:()=>add('sweet','sweet'),sauce:()=>add('sauce','sauce'),drink:()=>add('drink','drink')}[category]||(()=>{}))();
    return {name:String(name||'').trim(),norm:n,roles,traits,category:ciqualCategory(n)};
  }

  const INTENT_ADDITIONS={
    equilibre:{
      vegetable:['poivron rôti','fenouil citronné','aubergine grillée','haricots verts persillés','chou rouge émincé','carottes au cumin','brocoli au sésame','gombo tomate','pak choï sauté','betterave rôtie','courge aux herbes','crudités croquantes'],
      protein:['lentilles corail','pois chiches rôtis','œuf mollet','tofu mariné','haricots blancs citronnés','filet de poisson','poulet aux herbes','yaourt grec salé'],
      starch:['boulgour aux herbes','riz parfumé','patate douce rôtie','fonio pilaf','quinoa citronné','pommes de terre grenaille','semoule aux épices douces','pain complet grillé'],
      finish:['sauce yaourt-citron','chimichurri doux','gremolata','sésame grillé','pickles d’oignon','pesto d’herbes','vinaigrette agrumes-cumin','dukkah douce']},
    digestion:{
      vegetable:['fenouil fondant','carottes rôties','courgette compotée','potimarron rôti','épinards tombés','poireau fondant','aubergine confite','gombo mijoté'],
      protein:['poisson en papillote','œuf poché','lentilles corail bien cuites','tofu soyeux assaisonné','poulet poché au gingembre','yaourt nature aux herbes'],
      starch:['riz basmati','polenta crémeuse','pommes de terre vapeur','semoule fine','nouilles de riz','patate douce rôtie'],
      finish:['gingembre frais et citron','cumin doux','menthe fraîche','bouillon léger au miso','aneth et citron','coriandre fraîche','sauce yaourt-fenouil','huile infusée au thym']},
    energie:{
      vegetable:['poivron rôti','petits pois à la menthe','maïs grillé','patate douce épicée','betterave rôtie','courge au paprika'],
      protein:['œufs marinés','poulet tandoori doux','pois chiches croustillants','thon citronné','tempeh laqué','haricots rouges épicés','skyr aux herbes'],
      starch:['riz pilaf','boulgour aux raisins','patate douce rôtie','pain de seigle grillé','nouilles soba','fonio aux herbes','polenta dorée','avoine salée'],
      finish:['tahin citronné','pesto de coriandre','cacahuètes grillées','salsa mangue-citron vert','sésame et ciboule','chermoula douce','yaourt au cumin','gremolata orange-persil']},
    construire:{
      vegetable:['brocoli rôti','petits pois à la menthe','épinards à l’ail','poivrons grillés','chou kale croustillant','haricots verts au sésame'],
      protein:['poulet grillé au paprika','œufs mollets','saumon émietté','lentilles beluga','haricots blancs au citron','tofu croustillant','skyr aux herbes','pois chiches rôtis'],
      starch:['quinoa aux herbes','riz complet pilaf','pommes de terre grenaille','boulgour aux épices','pain au levain grillé','patate douce rôtie','fonio aux graines'],
      finish:['tahin au citron','graines de chanvre','dukkah aux graines','yaourt grec aux herbes','pesto de noix','sésame grillé','purée de haricots blancs','sauce cacahuète légère']},
    legerete:{
      vegetable:['concombre aux herbes','fenouil-orange','courgettes en rubans','radis croquants','chou rouge citronné','asperges rôties','tomates au basilic','pak choï vapeur','salade de gombo citronnée'],
      protein:['crevettes citronnées','poisson vapeur aux herbes','œuf poché','tofu grillé','pois chiches citronnés','poulet froid aux herbes'],
      starch:['pommes de terre tièdes','quinoa citronné','nouilles de riz','semoule aux herbes','riz vinaigré','pain pita grillé'],
      finish:['salsa verde','citron vert et coriandre','ponzu doux','yaourt-menthe','vinaigrette framboise','gingembre-ciboule','pickles de concombre','sumac et persil']},
    gourmandise:{
      vegetable:['aubergine confite','champignons persillés','tomates rôties','poivrons caramélisés','courge au thym','oignons fondants','maïs grillé au paprika'],
      protein:['halloumi doré','œuf coulant','poulet croustillant au four','saumon laqué','tofu caramélisé','pois chiches épicés','bœuf sauté au sésame'],
      starch:['polenta gratinée','pommes de terre écrasées','riz croustillant','pain à l’ail','gnocchi poêlés','boulgour aux fruits secs','semoule toastée'],
      finish:['pesto de pistache','crème de feta','beurre citronné aux herbes','sauce cacahuète-sésame','parmesan croustillant','chutney d’oignon','tahin au miel et citron','noisettes torréfiées']}
  };

  const SWEET_ADDITIONS={
    equilibre:['pistaches concassées','coulis de fruits rouges','poire rôtie à la cannelle','graines de chia','amandes au cacao','compotée de mangue-citron vert'],
    digestion:['poire pochée','compote pomme-gingembre','banane rôtie à la cannelle','coulis de myrtilles','zeste de citron et menthe','ananas poêlé au gingembre'],
    energie:['granola sarrasin-amandes','banane et purée de cacahuète','dattes et cacao','mangue et citron vert','avoine toastée','pistaches et abricots'],
    construire:['skyr vanillé','graines de chanvre','purée d’amande','yaourt grec','tofu soyeux cacao','pistaches et graines de courge'],
    legerete:['framboises au citron','agrumes à la menthe','coulis de mangue','pomme râpée à la cannelle','ananas-citron vert','granité de fruits sans ajout automatique de sucre'],
    gourmandise:['ganache chocolat noir','praliné noisette','caramel au sésame','pistaches et fleur d’oranger','coco grillée','poire chocolat-cardamome','crumble d’amande','coulis passion']
  };
  const SMOOTHIE_ADDITIONS={
    equilibre:['flocons d’avoine toastés','graines de chia','purée d’amande','pistaches concassées','coco grillée','zeste de citron vert'],
    digestion:['gingembre frais','menthe et citron vert','poire bien mûre','banane','cannelle','graines de chia préalablement hydratées'],
    energie:['banane et purée de cacahuète','dattes et cacao','avoine toastée','mangue','café et cacao','pistaches et abricots'],
    construire:['skyr','yaourt grec','tofu soyeux','graines de chanvre','purée de cacahuète','boisson de soja'],
    legerete:['menthe fraîche','citron vert et basilic','hibiscus et fruits rouges','ananas et gingembre','agrumes','glaçons aux fruits rouges'],
    gourmandise:['cacao et noisette','pistache et fleur d’oranger','coco grillée','vanille et praliné','chocolat noir râpé','caramel au sésame']
  };
  const BEVERAGE_ADDITIONS={
    equilibre:['concombre et basilic','agrumes et romarin','fruits rouges et menthe','pomme et cannelle','gingembre et citron vert','hibiscus et orange'],
    digestion:['gingembre et citron','fenouil et menthe','camomille et orange','verveine et citron','cannelle et pomme','menthe et concombre'],
    energie:['citron vert et gingembre','hibiscus et fruits rouges','thé vert et pêche','café frappé et cacao','orange et romarin','mangue et citron vert'],
    construire:['lait ou boisson de soja','yaourt grec à mixer','purée d’amande','cacao et boisson de soja','banane','graines de chanvre'],
    legerete:['concombre et menthe','citron vert et basilic','pamplemousse et romarin','pastèque et menthe','hibiscus et citron','ananas et gingembre'],
    gourmandise:['vanille et cardamome','cacao et noisette','café et cannelle','fleur d’oranger et pistache','coco et mangue','chocolat noir et orange']
  };
  const MODE_FINISH={
    tartine:['basilic et roquette','pickles d’oignon rouge','pesto de pistache','champignons persillés','poivrons marinés','chutney de tomate','salade de fenouil','olives et thym'],
    pasta:['gremolata citron-persil','champignons rôtis','brocoli au citron','pesto de roquette','courge rôtie','poivrons grillés','aubergine confite','petits pois à la menthe'],
    grain:['chermoula douce','salsa mangue-citron vert','gombo tomate','aubergine rôtie','carottes au cumin','pak choï au sésame','courge aux épices','fenouil citronné'],
    tuber_meal:['salade de chou citronnée','haricots verts persillés','pickles de légumes','champignons au thym','gombo tomate','poireaux fondants','betteraves vinaigrées','roquette moutardée'],
    batter:['poireaux fondants','champignons persillés','épinards à la muscade','tomates confites','poivrons rôtis','courge au thym','fenouil citronné','salade d’herbes'],
    fish:['fenouil-orange','salsa tomate-coriandre','poireaux fondants','gombo tomate','pak choï au gingembre','chermoula','salade de mangue verte','purée de petits pois'],
    salad:['pois chiches croustillants','œuf mollet','feta marinée','thon citronné','tofu au sésame','lentilles beluga','poulet aux herbes','graines torréfiées'],
    mixed:['aubergine confite','fenouil citronné','gombo tomate','champignons persillés','poivrons grillés','chou rouge aux agrumes','pak choï au sésame','courge rôtie']
  };
  const AFFINITY_FINISH={
    east_asia:['gingembre, ciboule et sésame','sauce soja-citron vert','bouillon miso','champignons shiitakés','pak choï à l’ail','vinaigre de riz et concombre','cacahuètes et coriandre','huile de sésame et piment doux'],
    west_central_africa:['gombo à la tomate','sauce tomate-oignon au gingembre','feuilles vertes mijotées','arachides grillées et citron vert','poivron, tomate et oignon','haricots relevés aux aromates','salsa mangue-piment doux','aubergine et gombo mijotés'],
    maghreb:['carottes au cumin','courgettes au ras-el-hanout','pois chiches à la coriandre','poivrons grillés à l’harissa douce','citron confit et persil','aubergine à la chermoula','tomate-oignon au paprika','fenouil à l’orange'],
    mediterranean:['tomates rôties et basilic','aubergine confite','champignons persillés','fenouil citronné','pesto de roquette','poivrons grillés','olives, citron et thym','courge rôtie au romarin'],
    south_asia:['raïta concombre-menthe','épinards aux épices','chutney coriandre-menthe','lentilles corail','chou-fleur rôti au cumin','tomate-oignon au garam masala','mangue et citron vert','aubergine au curry doux'],
    latin:['salsa tomate-coriandre','haricots noirs citronnés','maïs grillé au paprika','avocat et citron vert','pickles d’oignon rouge','poivrons et oignons rôtis','sauce yaourt-coriandre','mangue et piment doux']
  };
  const GENTLE_AFFINITY_FINISH={
    east_asia:['gingembre et ciboule','bouillon miso doux','pak choï vapeur','concombre au vinaigre de riz','champignons mijotés'],
    west_central_africa:['sauce tomate-oignon au gingembre','feuilles vertes mijotées','gombo à la tomate','aubergine et gombo mijotés','poivron, tomate et oignon fondants'],
    maghreb:['carottes au cumin','fenouil à l’orange','aubergine à la chermoula douce','tomate-oignon au paprika doux','courgettes aux épices douces'],
    mediterranean:['fenouil citronné','aubergine confite','courge rôtie au romarin','tomates fondantes et basilic','poireaux aux herbes'],
    south_asia:['raïta concombre-menthe','lentilles corail bien cuites','épinards aux épices douces','aubergine au curry doux','chou-fleur rôti au cumin'],
    latin:['salsa tomate-coriandre douce','avocat et citron vert','poivrons et oignons fondants','haricots noirs citronnés','maïs rôti au paprika doux']
  };

  function affinity(a){
    const n=a.text;
    if(/soba|udon|ramen|pak choi|bok choy|miso|tamari|sauce soja|tofu|tempeh|riz cantonais|wonton|jiaozi|chow mein|khao pad|gyudon/.test(n))return 'east_asia';
    if(/attieke|plantain|fonio|millet|foufou|manioc|igname|taro|macabo|ndole|eru|pondu|saka saka|gombo|okra|jollof|yassa|thieb|waakye|koki|kpem|sanga|chikwangue|liboke/.test(n))return 'west_central_africa';
    if(/semoule|couscous|harissa|ras el hanout|tajine|chakchouka|chakhchoukha|mhadjeb|karantika|kafteji|ojja/.test(n))return 'maghreb';
    if(/tandoori|garam masala|naan|chapati|dal|curry|curcuma|biryani|raita/.test(n))return 'south_asia';
    if(/tortilla|haricots noirs|mais|avocat|citron vert|chili|coriandre/.test(n))return 'latin';
    if(/pates|spaghetti|mozzarella|parmesan|feta|basilic|pesto|polenta|olive|couscous poisson/.test(n))return 'mediterranean';
    return '';
  }

  function preferenceChoose(rows,history,seed,variant=0){
    const counts=history?.tokenCounts||{};
    const ranked=(rows||[]).map((row,index)=>({row,index,score:words(row).reduce((sum,w)=>sum+Number(counts[w]||0),0)*10+((hash(row)^seed)%97)/100})).sort((a,b)=>b.score-a.score||a.index-b.index);
    return ranked.length?ranked[Math.abs(variant)%ranked.length].row:'';
  }

  function analyze(ingredients){
    const items=(ingredients||[]).map(classify),byRole={};
    items.forEach(item=>item.roles.forEach(role=>(byRole[role]||(byRole[role]=[])).push(item)));
    const text=items.map(x=>x.norm).join(' '),traits=new Set(items.flatMap(x=>x.traits));
    const sweet=!!(byRole.sweet?.length||byRole.sweetener?.length||traits.has('chocolate')||(byRole.fruit?.length&&byRole.dairy?.length)||(traits.has('flour')&&traits.has('egg')&&byRole.sweetener?.length));
    const drink=!!(byRole.drink?.length||(byRole.dairy?.length&&byRole.fruit?.length&&!traits.has('flour')));
    return {items,byRole,text,traits,sweet,drink};
  }

  const absent=(owned,options)=>options.filter(x=>!owned.some(y=>contains(y,x)||contains(x,y)));
  function additionFor(role,intent,owned,seed){
    const palette=INTENT_ADDITIONS[intent]||INTENT_ADDITIONS.equilibre;
    const rows=absent(owned,palette[role]||palette.finish);
    return choose(rows.length?rows:palette.finish,seed);
  }
  function sweetAddition(intent,owned,seed){
    const rows=absent(owned,SWEET_ADDITIONS[intent]||SWEET_ADDITIONS.equilibre);
    return choose(rows.length?rows:SWEET_ADDITIONS.equilibre,seed);
  }
  function missingRole(a,intent){
    if(a.sweet)return 'finish';
    if(!a.byRole.protein?.length)return 'protein';
    if(!a.byRole.vegetable?.length)return 'vegetable';
    if(!a.byRole.starch?.length&&intent!=='legerete')return 'starch';
    return 'finish';
  }

  function mode(a){
    const t=a.traits;
    if(a.byRole.drink?.length&&!a.byRole.starch?.length&&!a.byRole.protein?.length&&!a.byRole.vegetable?.length)return 'beverage';
    if(a.sweet&&a.drink)return 'smoothie';
    if(a.sweet&&t.has('flour')&&t.has('egg'))return 'bake';
    if(a.sweet)return 'dessert';
    if(t.has('bread')&&(a.byRole.sauce?.length||a.byRole.cheese?.length||a.byRole.dairy?.some(x=>x.traits.includes('cheese'))))return 'tartine';
    if(t.has('flour')&&t.has('egg'))return 'batter';
    if(t.has('grain')&&/pate|spaghetti|nouille|vermicelle|linguine|tagliatelle|soba|udon|ramen/.test(a.text))return 'pasta';
    if(t.has('grain')&&/riz|fonio|millet|boulgour|quinoa|semoule|couscous/.test(a.text))return 'grain';
    if(t.has('tuber')&&a.byRole.protein?.length)return 'tuber_meal';
    if(a.byRole.leaf?.length||/salade|crudite/.test(a.text))return 'salad';
    if(a.byRole.protein?.some(x=>x.traits.includes('fish')||x.traits.includes('seafood')))return 'fish';
    if(a.byRole.vegetable?.length>=2&&!a.byRole.starch?.length)return 'vegetable';
    return 'mixed';
  }

  const FORMS={
    tartine:['Tartines gratinées','Croques ouverts','Bruschettas minute','Petites pizzas sur pain'],
    batter:['Galettes salées','Crêpes garnies','Pancakes salés','Clafoutis salé'],
    pasta:['Pâtes poêlées','Gratin de pâtes','Pâtes en sauce liée','Salade de pâtes tiède'],
    grain:['Pilaf parfumé','Bowl chaud-froid','Poêlée de grains','Galettes de céréales'],
    tuber_meal:['Hachis parfumé','Pommes de terre farcies','Poêlée rustique','Parmentier revisité'],
    salad:['Salade composée','Bowl croquant','Wraps de feuilles','Assiette fraîche'],
    fish:['Papillote parfumée','Bowl marin','Brochettes et garniture','Poisson rôti et condiment'],
    vegetable:['Légumes farcis','Velouté garni','Poêlée aux épices','Tian revisité'],
    mixed:['Poêlée complète','Bowl composé','Brochettes et accompagnement','Mijoté court','Gratin minute','Assiette chaude-froide'],
    smoothie:['Smoothie onctueux','Lassi fruité','Smoothie bowl','Boisson frappée'],
    bake:['Gâteau moelleux','Fondant','Clafoutis','Petits muffins','Crêpes dessert'],
    dessert:['Verrine','Parfait glacé','Pudding','Crumble minute','Compotée garnie','Mousse légère']
    ,beverage:['Eau aromatisée','Infusion fraîche','Boisson frappée','Thé glacé maison','Mocktail sans alcool','Boisson chaude parfumée']
  };

  function formFor(a,intent,variant,seed){
    const m=mode(a),forms=FORMS[m]||FORMS.mixed;
    const flavor=affinity(a);
    if(intent==='digestion'&&m==='pasta'&&flavor==='east_asia')return choose(['Bouillon de nouilles au gingembre','Nouilles et légumes fondants','Salade tiède de nouilles au sésame','Nouilles en sauce miso douce'],seed+variant);
    if(intent==='digestion'&&m==='pasta')return choose(['Pâtes en sauce douce','Pâtes et légumes fondants','Bouillon garni de pâtes','Salade de pâtes tiède aux herbes'],seed+variant);
    if(intent==='legerete'&&m==='pasta'&&flavor==='east_asia')return choose(['Salade de nouilles aux herbes','Bouillon clair garni','Nouilles sautées aux légumes croquants','Bowl de nouilles au citron vert'],seed+variant);
    if(intent==='legerete'&&m==='pasta')return choose(['Salade de pâtes aux herbes','Pâtes aux légumes rôtis','Pâtes citronnées et garniture fraîche','Assiette tiède de pâtes et crudités'],seed+variant);
    if(flavor==='east_asia'&&m==='pasta')return choose(['Nouilles sautées','Bouillon de nouilles garni','Salade de nouilles au sésame','Nouilles en sauce courte','Bowl de nouilles chaud-froid'],seed+variant);
    if(flavor==='east_asia'&&['grain','mixed'].includes(m))return choose(['Riz sauté garni','Bowl au sésame','Bouillon garni','Poêlée gingembre-ciboule','Galettes de riz croustillantes'],seed+variant);
    if(flavor==='west_central_africa'&&['grain','tuber_meal','mixed'].includes(m))return choose(['Bowl chaud sauce courte','Mijoté tomate-aromates','Galettes dorées et condiment','Assiette braisée et garniture','Poêlée de base et légumes'],seed+variant);
    if(flavor==='maghreb'&&['grain','mixed'].includes(m))return choose(['Semoule aux légumes épicés','Bowl chermoula','Galettes garnies','Mijoté tomate-cumin','Assiette rôtie au ras-el-hanout'],seed+variant);
    if(flavor==='south_asia'&&['grain','mixed'].includes(m))return choose(['Pilaf parfumé','Curry court','Bowl tandoori','Galettes épicées','Poêlée masala douce'],seed+variant);
    let index=(variant+seed)%forms.length;
    if(intent==='digestion'&&['mixed','fish','vegetable'].includes(m)){
      const gentle=m==='fish'?['Papillote aux herbes','Poisson poché et bouillon parfumé','Bowl marin tiède']:['Mijoté doux','Velouté garni','Cuisson vapeur et condiment','Poêlée fondante'];
      return choose(gentle,seed+variant);
    }
    if(intent==='gourmandise'&&m==='mixed')return choose(['Gratin doré','Poêlée laquée','Parmentier croustillant','Brochettes caramélisées','Cocotte crémeuse'],seed+variant);
    return forms[index];
  }

  function contextualAddition(a,m,intent,owned,seed,history,variant){
    if(m==='beverage'){
      const lightBase=/\b(eau|the|infusion|tisane)\b/.test(a.text)&&!a.byRole.dairy?.length&&!a.byRole.protein?.length&&!a.byRole.starch?.length&&!a.byRole.sweet?.length;
      const safeIntent=lightBase&&['construire','gourmandise'].includes(intent)?'equilibre':intent;
      return preferenceChoose(absent(owned,BEVERAGE_ADDITIONS[safeIntent]||BEVERAGE_ADDITIONS.equilibre),history,seed,variant);
    }
    if(m==='smoothie')return preferenceChoose(absent(owned,SMOOTHIE_ADDITIONS[intent]||SMOOTHIE_ADDITIONS.equilibre),history,seed,variant);
    if(m==='batter'&&!a.traits.has('dairy')&&!a.traits.has('cream'))return preferenceChoose(['lait','boisson de soja','boisson d’avoine'],history,seed,variant);
    if(m==='bake'&&!a.byRole.fat?.length)return choose(['beurre','huile neutre','purée d’amande'],seed);
    const flavor=affinity(a),affinityRows=['digestion','legerete'].includes(intent)?GENTLE_AFFINITY_FINISH[flavor]:AFFINITY_FINISH[flavor];
    if(affinityRows&&missingRole(a,intent)==='finish')return preferenceChoose(absent(owned,affinityRows),history,seed,variant);
    const rows=MODE_FINISH[m];
    if(rows&&missingRole(a,intent)==='finish')return preferenceChoose(absent(owned,rows),history,seed,variant);
    return null;
  }

  function preparationFor(a,form,addition,intent){
    const owned=list(a.items.map(x=>x.name));
    const lower=norm(form);
    if(/eau aromatisee/.test(lower))return `Ajoute ${addition} à ${owned}, laisse infuser au frais puis goûte avant d’ajuster l’intensité.`;
    if(/infusion|the glace|boisson chaude/.test(lower))return `Fais infuser les éléments adaptés, ajoute ${addition}, puis sers chaud ou laisse refroidir selon la proposition.`;
    if(/mocktail/.test(lower))return `Écrase ou presse les aromates et fruits, ajoute ${owned}, complète avec ${addition} puis sers bien frais.`;
    if(/smoothie|boisson frappee|lassi/.test(lower))return `Mixe ${owned} avec quelques glaçons jusqu’à la texture souhaitée, puis ajoute ${addition} au dernier moment.`;
    if(/smoothie bowl/.test(lower))return `Mixe une partie de ${owned}, verse dans un bol et garde quelques éléments entiers avant de terminer avec ${addition}.`;
    if(/verrine|parfait|pudding|mousse/.test(lower))return `Travaille ${owned} en couches ou en crème, laisse prendre au frais si nécessaire, puis termine avec ${addition}.`;
    if(/gateau|fondant|clafoutis|muffin|crepe dessert/.test(lower))return `Prépare l’appareil avec ${owned}, cuis jusqu’à obtenir la texture recherchée et apporte le contraste final avec ${addition}.`;
    if(/tartine|croque|bruschetta|pizza/.test(lower))return `Garnis le pain avec ${owned}, passe au four jusqu’à ce que le dessus soit doré, puis ajoute ${addition}.`;
    if(/galette|crepe|pancake/.test(lower))return `Forme un appareil avec ${owned}, cuis en portions à la poêle et sers avec ${addition}.`;
    if(/papillote|poche|vapeur/.test(lower))return `Réunis les éléments adaptés à la cuisson avec les aromates, cuis doucement et ajoute ${addition} seulement au service.`;
    if(/salade|bowl|assiette|wrap/.test(lower))return `Prépare séparément les éléments qui demandent une cuisson, assemble-les avec les ingrédients frais, puis termine avec ${addition}.`;
    if(/gratin|parmentier|farc/.test(lower))return `Prépare les éléments, assemble-les dans un plat, fais dorer au four et sers avec ${addition} pour apporter du contraste.`;
    if(/brochette/.test(lower))return `Monte les éléments qui supportent la cuisson sur des brochettes, cuis-les au four ou à la poêle et accompagne de ${addition}.`;
    if(/mijote|cocotte|veloute/.test(lower))return `Fais revenir les aromates, ajoute les éléments selon leur temps de cuisson et laisse mijoter doucement avant de servir avec ${addition}.`;
    return `Prépare ${owned} selon leur temps de cuisson, réunis-les sans surcuire les éléments fragiles et termine avec ${addition}.`;
  }

  function explanationFor(a,role,addition,intent){
    const present=[];
    if(a.byRole.starch?.length)present.push('une base énergétique');
    if(a.byRole.protein?.length)present.push('une source protéinée');
    if(a.byRole.vegetable?.length)present.push('une partie végétale');
    if(a.byRole.fruit?.length)present.push('une base fruitée');
    if(a.byRole.dairy?.length)present.push('une base crémeuse');
    const purpose={
      equilibre:'complète seulement le repère le moins présent, sans reconstruire tout le repas',
      digestion:'privilégie ici une cuisson douce, une texture souple et un assaisonnement mesuré ; adapte selon ton confort personnel',
      energie:'ajoute un élément qui rend la proposition plus soutenante et pratique pour une journée active',
      construire:'renforce la densité du repas, notamment avec une source protéinée ou une base plus consistante',
      legerete:'joue sur la fraîcheur, les herbes, l’acidité et les textures plutôt que sur une sauce lourde',
      gourmandise:'apporte du contraste, du doré ou de l’onctuosité tout en gardant les ingrédients de départ'
    }[intent]||'reste cohérent avec les ingrédients présents';
    return `${present.length?`Tu as déjà ${list(present)}. `:''}${titleCase(addition)} ${purpose}.`;
  }

  function catalogDish(a,catalog,intent,recentTitles,variant){
    if(!Array.isArray(catalog)||!catalog.length)return null;
    const owned=a.items.map(x=>x.name),ownedText=owned.join(' '),recent=new Set([...recentTitles].map(norm));
    const scored=catalog.map(item=>{
      const name=item.display_name||item.canonical_name||'',typ=(item.typical_components||[]).map(x=>typeof x==='string'?x:(x?.name||'')),opt=(item.optional_components||[]).map(x=>typeof x==='string'?x:(x?.name||''));
      const overlap=typ.filter(x=>contains(ownedText,x)||owned.some(y=>contains(x,y))).length;
      const missing=typ.filter(x=>!contains(ownedText,x)&&!owned.some(y=>contains(x,y)));
      const categories=(item.categories||[]).map(norm),profile=item.adapter_profile||{};
      let score=overlap*7-missing.length*1.5;
      if(intent==='construire'&&(categories.includes('protein')||profile.protein_present))score+=2;
      if(intent==='legerete'&&(categories.includes('vegetable')||profile.vegetable_present))score+=2;
      if(intent==='gourmandise'&&/sweet|dessert|filled|fried/.test(norm(profile.adapter_family)))score+=1;
      if(recent.has(norm(name)))score-=12;
      return {item,name,typ,opt,overlap,missing,score};
    }).filter(x=>x.overlap>=2&&x.missing.length<=2&&x.score>4).sort((x,y)=>y.score-x.score);
    if(!scored.length)return null;
    return scored[Math.abs(variant)%Math.min(scored.length,6)];
  }

  function suggest({ingredients=[],intent='equilibre',variant=0,history=null,catalog=[]}={}){
    const owned=unique((ingredients||[]).map(x=>String(x||'').trim()).filter(Boolean));
    if(!owned.length)return null;
    const a=analyze(owned),seed=hash(`${owned.map(norm).sort().join('|')}|${intent}`),recentTitles=history?.recentTitles instanceof Set?history.recentTitles:new Set(history?.recentTitles||[]);
    const dish=catalogDish(a,catalog,intent,recentTitles,variant);
    const role=missingRole(a,intent),m=mode(a),form=formFor(a,intent,variant,seed);
    const contextual=contextualAddition(a,m,intent,owned,seed+variant*17,history,variant);
    const addition=contextual||(a.sweet?sweetAddition(intent,owned,seed+variant*17):additionFor(role,intent,owned,seed+variant*17));
    const main=owned.slice(0,3).join(', '),dishTitle=dish?.name||'';
    const title=dishTitle&&variant%3===2?`Interprétation libre · ${dishTitle}`:`${form} · ${main}`;
    const catalogMissing=dish&&variant%3===2?dish.missing.slice(0,2):[];
    const missing=unique([...catalogMissing,addition]).filter(x=>!owned.some(y=>contains(y,x)||contains(x,y))).slice(0,2);
    return {
      title,owned,missing,
      preparation:preparationFor(a,form,missing[0]||addition,intent),
      explanation:explanationFor(a,role,missing[0]||addition,intent),
      substitute:variant>0?choose((a.sweet?SWEET_ADDITIONS[intent]:INTENT_ADDITIONS[intent]?.finish)||[],seed+variant+5):'',
      family:`universal_${m}`,
      confidence:a.items.filter(x=>x.roles.length).length/a.items.length,
      recognized:a.items.map(x=>({name:x.name,roles:x.roles,category:x.category})),
      source:dishTitle?'catalogue_et_structure':'structure_ciqual'
    };
  }

  return {suggest,classify,analyze,normalize:norm,version:'1.0.0'};
});
