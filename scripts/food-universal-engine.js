(function(root,factory){
  const api=factory(root||globalThis);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MTFoodUniversalEngine=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const KB=()=>root.MTFoodInspirationKB||{};
  const norm=value=>String(value||'').toLocaleLowerCase('fr').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[’']/g,' ')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const words=value=>norm(value).split(/\s+/).filter(Boolean);
  const hash=value=>{let h=2166136261;for(const c of String(value||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  const unique=rows=>[...new Set((rows||[]).map(x=>String(x||'').trim()).filter(Boolean))];
  const choose=(rows,seed)=>Array.isArray(rows)&&rows.length?rows[Math.abs(seed)%rows.length]:'';
  const cap=value=>String(value||'').replace(/^./,x=>x.toLocaleUpperCase('fr'));
  const lower=value=>String(value||'').replace(/^./,x=>x.toLocaleLowerCase('fr'));
  const list=rows=>{const x=unique(rows);if(!x.length)return '';if(x.length===1)return x[0];return `${x.slice(0,-1).join(', ')} & ${x.at(-1)}`;};
  const includesWord=(text,part)=>{const a=` ${norm(text)} `,b=norm(part);return b&&a.includes(` ${b} `);};
  const stemToken=x=>{let t=String(x||'');if(t.length>4&&/(s|x)$/.test(t)&&!/(mais|pois|riz)$/.test(t))t=t.slice(0,-1);return t;};
  const matchWords=value=>words(value).filter(x=>x.length>2).map(stemToken);
  const overlapTokens=(a,b)=>{const A=new Set(matchWords(a)),B=matchWords(b);return B.length?B.filter(x=>A.has(x)).length/B.length:0;};
  const contains=(input,ingredient)=>{
    const a=norm(input),b=norm(ingredient);if(!a||!b)return false;
    if(a===b||` ${a} `.includes(` ${b} `)||` ${b} `.includes(` ${a} `))return true;
    return overlapTokens(a,b)>=0.8||overlapTokens(b,a)>=0.8;
  };
  const ownText=rows=>unique(rows).map(norm).join(' ');
  const textHas=(text,re)=>{try{return re.test(norm(text));}catch(_){return false;}};
  const safeArray=x=>Array.isArray(x)?x:[];

  let ciqualExact=null,ciqualRows=[];
  function ensureCiqual(){
    if(ciqualExact)return;
    const source=Array.isArray(root.MT_CIQUAL_INDEX)?root.MT_CIQUAL_INDEX:[];
    ciqualRows=source.map(row=>[norm(row[0]),row[1],row[0]]).filter(row=>row[0]);
    ciqualExact=new Map(ciqualRows.map(row=>[row[0],row[1]]));
  }
  function ciqualCategory(value){
    ensureCiqual();const key=norm(value);if(!key)return '';
    if(ciqualExact.has(key))return ciqualExact.get(key);
    const keyWords=new Set(words(key).filter(x=>x.length>2));
    if(!keyWords.size)return '';
    let best='',bestScore=0;
    for(const [name,category] of ciqualRows){
      if(Math.abs(name.length-key.length)>Math.max(36,key.length*1.7))continue;
      const nw=words(name).filter(x=>x.length>2);if(!nw.length)continue;
      const common=nw.filter(x=>keyWords.has(x)).length;
      if(!common)continue;
      const precision=common/nw.length,recall=common/keyWords.size;
      let score=(2*precision*recall)/(precision+recall||1);
      if(name.startsWith(key)||key.startsWith(name))score+=.12;
      if(score>bestScore){bestScore=score;best=category;}
    }
    return bestScore>=.58?best:'';
  }

  function addRole(out,role){if(role&&!out.roles.includes(role))out.roles.push(role);}
  function addTrait(out,trait){if(trait&&!out.traits.includes(trait))out.traits.push(trait);}
  function applyCiqual(out,category){
    const map=KB().CIQUAL_ROLE_MAP||{};const cfg=map[category];
    if(!cfg)return;
    safeArray(cfg.roles).forEach(x=>addRole(out,x));safeArray(cfg.traits).forEach(x=>addTrait(out,x));
  }
  function classify(name){
    const out={name:String(name||'').trim(),norm:norm(name),roles:[],traits:[],category:'',matchedRules:[]};
    if(!out.norm)return out;
    const rules=KB().PHRASE_RULES||[];
    for(const rule of rules){
      if(!rule?.re)continue;
      rule.re.lastIndex=0;
      if(!rule.re.test(out.norm))continue;
      if(rule.id==='other_meat'&&(out.traits.includes('cheese')||/fromage\s+(de\s+)?chevre|chevre\s+frais/.test(out.norm)))continue;
      out.matchedRules.push(rule.id);
      safeArray(rule.roles).forEach(x=>addRole(out,x));safeArray(rule.traits).forEach(x=>addTrait(out,x));
    }
    out.category=ciqualCategory(out.norm);
    // A precise local phrase rule is more trustworthy than a broad CIQUAL-name guess.
    // CIQUAL becomes the fallback for unknown foods; composite categories may still enrich a known item.
    if(!out.matchedRules.length) applyCiqual(out,out.category);
    else if(['composite','pizza_tart','sandwich','soup'].includes(out.category)) applyCiqual(out,out.category);
    // Contextual correction: a cheese name never becomes red meat merely because CIQUAL/name contains "chèvre".
    if(out.traits.includes('cheese')){
      out.roles=out.roles.filter(r=>r!=='meat');
      out.traits=out.traits.filter(t=>t!=='red_meat'&&t!=='meat');
    }
    // Tomato concentrate is a condiment/sauce, not a vegetable portion.
    if(out.traits.includes('tomato_sauce'))out.roles=out.roles.filter(r=>r!=='vegetable');
    // Sauce soja is a condiment, not a serving of soy/tofu.
    if(out.traits.includes('soy_sauce')){out.roles=out.roles.filter(r=>r!=='protein');out.traits=out.traits.filter(t=>t!=='pulse'&&t!=='plant_protein');}
    // Context traits used by the structural engine. These are ingredient-family markers,
    // not one-off recipes, so spelling/brand variants still generalise.
    if(/\bpinsa\b/.test(out.norm))addTrait(out,'pinsa_base');
    if(/\bbruschetta\b/.test(out.norm))addTrait(out,'bruschetta_base');
    if(/\bpanini\b/.test(out.norm))addTrait(out,'panini_base');
    if(/\b(?:mini|petits?)\s+pains?\b/.test(out.norm))addTrait(out,'mini_bread');
    if(/\bfocaccia|fougasse\b/.test(out.norm))addTrait(out,'focaccia_base');
    if(/\bfarine\s+(?:de\s+)?(?:ble\s+noir|sarrasin)|\bsarrasin\b/.test(out.norm))addTrait(out,'buckwheat_flour');
    if(/\b(?:poudre\s+d\s*amande|amandes?\s+en\s+poudre|farine\s+d\s*amande)\b/.test(out.norm))addTrait(out,'almond_flour');
    if(/\briz\s+(?:gluant|sticky)\b/.test(out.norm))addTrait(out,'sticky_rice');
    if(/\bpommes?\s+de\s+terre\s+grenailles?|\bgrenailles?\b/.test(out.norm))addTrait(out,'grenaille');
    if(/\b(?:boeuf|bœuf|viande)\s+hache|steak\s+hache/.test(out.norm))addTrait(out,'minced_meat');
    if(/\b(?:pilons?|ailes?|cuisses?|escalopes?|blancs?|filets?|paves?|pavés?|coeur|cœur|roti|rôti)\b/.test(out.norm))addTrait(out,'piece_specific');
    if(/\btomates?\s+pelees?\b/.test(out.norm))addTrait(out,'peeled_tomato');
    if(/\b(?:sauce\s+soja\s+sucree|soja\s+sucree|kecap\s+manis)\b/.test(out.norm))addTrait(out,'sweet_soy');
    if(/\beau\s+(?:petillante|gazeuse)\b/.test(out.norm))addTrait(out,'carbonated');
    return out;
  }

  function analyze(ingredients){
    const items=unique(ingredients).map(classify);
    const byRole={};const traits=new Set();
    for(const item of items){
      item.roles.forEach(role=>(byRole[role]||(byRole[role]=[])).push(item));
      item.traits.forEach(t=>traits.add(t));
    }
    const text=items.map(x=>x.norm).join(' ');
    const recognized=items.filter(x=>x.roles.length||x.category).length;
    return {items,byRole,traits,text,recognized,confidence:items.length?recognized/items.length:0};
  }

  const itemsOf=(a,role)=>safeArray(a.byRole[role]);
  const hasRole=(a,role)=>itemsOf(a,role).length>0;
  const hasTrait=(a,trait)=>a.traits.has(trait);
  const firstName=(a,role,trait)=>{
    const rows=role?itemsOf(a,role):a.items;
    const hit=trait?rows.find(x=>x.traits.includes(trait)):rows[0];return hit?.name||'';
  };
  const allNames=(a,role)=>itemsOf(a,role).map(x=>x.name);
  const savoryProteinItems=a=>itemsOf(a,'protein').filter(x=>!x.traits.includes('cheese')&&!x.traits.includes('cultured_dairy')&&!x.traits.includes('nut_seed'));
  const firstSavoryProtein=a=>savoryProteinItems(a)[0]?.name||firstName(a,'protein');
  const meaningfulStarches=a=>itemsOf(a,'starch').filter(x=>!(/\b(?:mais|maïs)\b/.test(x.norm)&&x.traits.includes('fresh_raw')));
  const freshRawItems=a=>a.items.filter(x=>x.traits.includes('fresh_raw'));
  const savoryAnchors=a=>a.items.filter(x=>x.traits.includes('meat')||x.traits.includes('red_meat')||x.traits.includes('poultry')||x.traits.includes('fish')||x.traits.includes('seafood')||x.traits.includes('plant_protein')||x.traits.includes('pulse')||x.traits.includes('vegetable')).length;
  const isSweetContext=a=>{
    if(hasTrait(a,'frozen_dessert')||hasTrait(a,'chocolate'))return true;
    if(savoryAnchors(a))return false;
    if(hasRole(a,'fruit')&&(hasTrait(a,'cultured_dairy')||hasTrait(a,'milk')||hasRole(a,'drink')))return true;
    if(hasRole(a,'sweetener')&&(hasTrait(a,'flour')||hasTrait(a,'egg')||hasTrait(a,'milk')||hasRole(a,'fruit')||hasRole(a,'dairy')))return true;
    if(hasRole(a,'sweet')&&!hasRole(a,'protein')&&!hasRole(a,'vegetable'))return true;
    return false;
  };
  const isDrinkContext=a=>hasRole(a,'drink')&&(hasTrait(a,'carbonated')||hasTrait(a,'coffee')||hasTrait(a,'tea')||hasTrait(a,'milk')||hasTrait(a,'drink_flavor')||hasTrait(a,'water'));
  const leafItems=a=>a.items.filter(x=>x.traits.includes('leaf')||x.traits.includes('fresh_leaf'));
  const cookedVegetables=a=>itemsOf(a,'vegetable').filter(x=>!x.traits.includes('leaf')&&!x.traits.includes('fresh_leaf'));

  function mode(a){
    const sweet=isSweetContext(a),leaf=leafItems(a),veg=cookedVegetables(a),fresh=freshRawItems(a),starches=meaningfulStarches(a);
    if(hasRole(a,'protein')&&hasTrait(a,'crumb')&&(hasTrait(a,'flour')||hasRole(a,'starch')))return 'breaded_protein';
    if(hasTrait(a,'almond_flour')&&hasTrait(a,'flour')&&hasRole(a,'fat')&&!hasRole(a,'vegetable')&&!hasTrait(a,'meat')&&!hasTrait(a,'fish'))return 'almond_dough';
    if(hasTrait(a,'sticky_rice')&&hasRole(a,'fruit')&&hasTrait(a,'milk'))return 'sticky_rice_dessert';
    if(hasTrait(a,'pastry_dough'))return sweet?'pastry_sweet':'pastry_dough';
    if(hasTrait(a,'pizza_dough'))return 'pizza_dough';
    if(hasTrait(a,'frozen_dessert')&&hasTrait(a,'coffee'))return 'affogato';
    if(hasTrait(a,'chocolate')&&hasTrait(a,'egg')&&hasRole(a,'sweetener'))return 'chocolate_egg';
    if(hasTrait(a,'egg')&&hasTrait(a,'milk')&&hasRole(a,'sweetener')&&!hasTrait(a,'flour'))return 'custard';
    if(hasTrait(a,'flour')&&hasRole(a,'sweetener'))return 'bake_sweet';
    if(hasTrait(a,'flour')&&hasTrait(a,'egg')&&(hasTrait(a,'milk')||hasRole(a,'dairy'))&&!hasRole(a,'sweetener'))return 'batter_savory';
    if(hasRole(a,'fruit')&&hasTrait(a,'cultured_dairy'))return 'yogurt_fruit';
    const smoothieStarches=starches.filter(x=>!/avoine|flocons/.test(x.norm));
    if(hasRole(a,'fruit')&&hasTrait(a,'milk')&&!savoryAnchors(a)&&!smoothieStarches.length)return 'smoothie';
    // A real drink base stays a beverage before the generic sweet-dessert fallback.
    if(isDrinkContext(a)||hasTrait(a,'fruit_syrup'))return 'beverage';
    // A real drink base (water/soda/tea/coffee/milk beverage) stays a beverage even when
    // lemon, mint, syrup or another flavouring is present. This must run before the
    // generic sweet-dessert fallback so "eau pétillante + citron + menthe" never
    // becomes a frozen dessert.
    if(sweet)return 'dessert';
    if(hasTrait(a,'bread')||hasTrait(a,'flatbread')||hasTrait(a,'pizza_base'))return 'bread';
    if(hasTrait(a,'pasta'))return 'pasta';
    if(hasTrait(a,'noodle'))return 'noodle';
    // Potatoes + fresh leaves/raw vegetables should become a potato salad, not a gratin that cooks the leaves.
    if(hasTrait(a,'tuber')&&leaf.length&&itemsOf(a,'vegetable').length>=2)return 'tuber_salad';
    // Three raw-suitable vegetables (or cucumber/tomato/pepper style sets) start as a fresh salad/salsa.
    if(!hasRole(a,'protein')&&!starches.length&&fresh.length>=2)return 'salad';
    if((leaf.length>=1&&(!starches.length||leaf.length+veg.length>=2))||(hasTrait(a,'fresh_cheese')&&itemsOf(a,'vegetable').length>=2&&!starches.length))return 'salad';
    if(hasTrait(a,'grain'))return 'grain';
    if(hasTrait(a,'tuber'))return 'tuber';
    if(hasTrait(a,'fish')||hasTrait(a,'seafood'))return 'fish';
    if(hasTrait(a,'pulse')||hasTrait(a,'plant_protein'))return 'pulse';
    const major=['starch','protein','vegetable'].filter(r=>hasRole(a,r)).length;
    if(major>=2)return 'mixed';
    if(hasRole(a,'vegetable'))return 'vegetable';
    if(hasRole(a,'protein'))return 'protein';
    if(a.items.every(x=>x.roles.every(r=>['sauce','aromatic','fat','sweetener','drink'].includes(r))))return 'condiments_only';
    return 'mixed';
  }

  function distinctComponentMatches(a,components){
    const comps=unique(components).map(norm).filter(Boolean);const used=new Set();let count=0;
    for(const item of a.items){
      let best=-1,bestScore=0;
      for(let i=0;i<comps.length;i++){
        if(used.has(i))continue;const c=comps[i];
        if(contains(item.name,c)||contains(c,item.name)){
          const sc=Math.max(overlapTokens(item.name,c),overlapTokens(c,item.name));
          if(sc>bestScore){bestScore=sc;best=i;}
        }
      }
      if(best>=0){used.add(best);count++;}
    }
    return count;
  }
  function cultureScores(a,catalog=[]){
    const scores={};
    for(const [id,cfg] of Object.entries(KB().CULTURES||{})){
      let s=0;const re=cfg.signals;if(re){
        re.lastIndex=0;if(re.test(a.text)){
          // Named dishes/seasonings are strong signals; common produce alone is not.
          if(id==='mediterranean')s+=/pates?|spaghetti|parmesan|mozzarella|feta|burrata|basilic|pesto|olive|polenta|pinsa|focaccia|bruschetta|ricotta/.test(a.text)?4:1;
          else if(id==='latin'){const asianSauce=/sweet\s*chili|sweet\s*chilli|sauce\s+soja|kecap|teriyaki|nuoc mam/.test(a.text);s+=(!asianSauce&&/tortilla|haricots noirs|salsa|fajita|quesadilla|taco|chili con carne/.test(a.text))?4:(!asianSauce?1:0);}
          else if(id==='southeast_asia')s+=/pad thai|tom yum|tom kha|som tam|khao pad|citronnelle|galanga|nuoc mam|basilic thai|satay/.test(a.text)?4:(/curry/.test(a.text)&&/coco/.test(a.text)?3.5:1.4);
          else if(id==='south_asia')s+=/garam masala|tandoori|biryani|dal|dhal|chapati|naan|raita|masala|chutney/.test(a.text)?4:(/curry/.test(a.text)?2.6:1.3);
          else if(id==='west_africa'){const strong=/jollof|thieb|ceebu|yassa|mafe|domoda|waakye|kelewele|suya|akara|egusi|ogbono|banku|kenkey|garba|attieke|attiéké/.test(a.text);const local=(a.text.match(/manioc|plantain|gombo|fonio|millet|mil|igname/g)||[]).length;s+=strong?4:(local>=2?3.4:local?1.7:1);}
          else if(id==='central_africa'){const strong=/ndole|ndolé|ndolè|eru|pondu|saka saka|fumbwa|chikwangue|kwanga|liboke|liboké|ntaba|koki|achu|mbongo/.test(a.text);const local=(a.text.match(/manioc|plantain|taro|macabo|feuilles de manioc/g)||[]).length;s+=strong?4:(local>=2?3.2:local?1.5:1);}
          else s+=4;
        }
      }
      scores[id]=s;
    }
    const cat=[...safeArray(root.MT_FOOD_CULTURAL_INDEX),...safeArray(catalog)];
    for(const row of cat){
      const culture=row.culture||countryCulture(row.country);if(!culture)continue;
      const typical=safeArray(row.typical||row.typical_components).map(x=>typeof x==='string'?x:(x?.name||''));
      const distinct=distinctComponentMatches(a,typical);
      const coverage=typical.length?distinct/typical.length:0;
      // Culture inference from a catalogue requires at least three *typical* components.
      // Optional garnishes never create a cuisine label on their own.
      if(distinct>=3&&coverage>=.8)scores[culture]=(scores[culture]||0)+Math.min(4.5,distinct*1.25);
    }
    return scores;
  }
  function countryCulture(country){
    const n=norm(country);
    if(/cameroun|congo|gabon|afrique centrale/.test(n))return 'central_africa';
    if(/senegal|cote d ivoire|nigeria|ghana|mali|guinee|burkina|benin|togo|afrique de l ouest/.test(n))return 'west_africa';
    if(/alger|maroc|tunisie|maghreb/.test(n))return 'maghreb';
    if(/japon|chine|coree/.test(n))return 'east_asia';
    if(/thailande|vietnam|laos|cambodge|indones|malaisie|philipp/.test(n))return 'southeast_asia';
    if(/inde|pakistan|bangladesh|sri lanka|nepal/.test(n))return 'south_asia';
    return '';
  }
  function detectCulture(a,catalog=[]){
    const scores=cultureScores(a,catalog);const rows=Object.entries(scores).sort((x,y)=>y[1]-x[1]);
    if(!rows.length||rows[0][1]<3)return '';
    // Ambiguous ties are deliberately left neutral rather than forcing a cuisine label.
    if(rows[1]&&rows[0][1]-rows[1][1]<.55&&rows[0][1]<5)return '';
    return rows[0][0];
  }

  function targetRoles(a,m,intent){
    if(['beverage','smoothie','yogurt_fruit','dessert','bake_sweet','custard','chocolate_egg','affogato','pastry_sweet','sticky_rice_dessert','almond_dough'].includes(m))return [];
    if(m==='condiments_only')return intent==='legerete'?['vegetable','protein','starch']:['protein','starch','vegetable'];
    const have={starch:meaningfulStarches(a).length>0,protein:hasRole(a,'protein'),vegetable:hasRole(a,'vegetable')};
    const orders={
      salad:['protein','starch','vegetable'],tuber_salad:['protein','vegetable','starch'],
      protein:['vegetable','starch','protein'],fish:['vegetable','starch','protein'],
      pasta:['protein','vegetable','starch'],noodle:['protein','vegetable','starch'],grain:['protein','vegetable','starch'],tuber:['protein','vegetable','starch'],
      bread:['protein','vegetable','starch'],pizza_dough:['protein','vegetable','starch'],pastry_dough:['vegetable','protein','starch'],breaded_protein:['vegetable','starch','protein'],
      vegetable:['protein','starch','vegetable'],pulse:['vegetable','starch','protein'],mixed:['vegetable','starch','protein']
    };
    let order=orders[m]||['protein','vegetable','starch'];
    if(intent==='legerete')order=['vegetable','protein','starch'];
    if(intent==='construire')order=['protein','starch','vegetable'];
    if(intent==='energie')order=m==='salad'?['starch','protein','vegetable']:['starch','protein','vegetable'];
    const need=order.filter(role=>!have[role]);
    // A pastry/bread base already supplies the starch role even if no generic starch role is wanted as an addition.
    return need.slice(0,3);
  }

  function specialRequirements(a,m,intent){
    const req=[];
    const text=a.text;
    // Technique-driven completions: add what the recognizable culinary direction actually needs.
    if(hasTrait(a,'poultry')&&hasTrait(a,'mustard')&&hasTrait(a,'acid_fruit')){
      if(!/oignon/.test(text))req.push('oignon');
      return req;
    }
    if(m==='grain'&&/curry/.test(text)&&hasRole(a,'protein')){
      if(!hasTrait(a,'cream')&&!/coco|tomate/.test(text))req.push('lait de coco ou tomates');
      if(itemsOf(a,'vegetable').length===0)req.push(intent==='digestion'?'carottes ou courgette':'épinards, courgette ou poivron');
      return req.slice(0,2);
    }
    if(m==='grain'&&hasTrait(a,'egg')&&/oignon/.test(text)&&itemsOf(a,'vegetable').length<=1){
      req.push(intent==='legerete'?'concombre ou chou émincé':'petits pois, épinards ou carottes');
      return req;
    }
    if(m==='pasta'&&hasTrait(a,'poultry')&&leafItems(a).length){
      req.push(intent==='gourmandise'?'parmesan ou pesto':'tomates ou oignon rouge');
      return req;
    }
    if(m==='bake_sweet'){
      if(!hasTrait(a,'egg'))req.push('œufs');
      if(!hasTrait(a,'milk')&&!hasRole(a,'dairy'))req.push('lait ou boisson végétale');
      if(!hasRole(a,'fat'))req.push('beurre ou huile neutre');
      return req.slice(0,3);
    }
    if(m==='almond_dough'){
      if(!hasRole(a,'sweetener'))req.push('sucre glace ou sucre fin');
      if(!hasTrait(a,'egg'))req.push('œuf ou jaune d’œuf');
      return req.slice(0,2);
    }
    if(m==='breaded_protein'){
      if(!hasTrait(a,'egg'))req.push('œuf pour la panure');
      return req;
    }
    if(m==='sticky_rice_dessert'){
      if(!hasRole(a,'sweetener'))req.push('un peu de miel ou sucre de coco');
      return req.slice(0,1);
    }
    if(m==='pastry_sweet'){
      if(hasTrait(a,'chocolate')&&!hasRole(a,'dairy'))req.push('crème liquide');
      if(!hasTrait(a,'chocolate')&&!hasRole(a,'fruit'))req.push('fruits de saison ou chocolat noir');
      return req.slice(0,2);
    }
    if(m==='pizza_dough'){
      if(!hasRole(a,'vegetable')&&!hasTrait(a,'tomato_sauce'))req.push('tomates ou légumes rôtis');
      if(!hasTrait(a,'cheese'))req.push('mozzarella, ricotta ou autre fromage');
      return req.slice(0,2);
    }
    if(m==='bread'){
      if(!hasRole(a,'protein')&&!hasTrait(a,'cheese'))req.push('œufs, poulet, thon ou légumineuses');
      if(!hasRole(a,'vegetable'))req.push('tomates, feuilles fraîches ou légumes grillés');
      return req.slice(0,2);
    }
    if(m==='custard')return [hasTrait(a,'aromatic')?'caramel léger ou agrumes':'vanille ou fleur d’oranger'];
    if(m==='chocolate_egg')return [intent==='gourmandise'?'noisettes, fleur de sel ou café':'fruits rouges ou amandes'];
    if(m==='affogato')return [intent==='gourmandise'?'amandes grillées ou cacao':'cacao non sucré ou amandes'];
    if(m==='beverage'||m==='smoothie')return [];
    return [];
  }

  function historyPreferenceScore(name,history){
    const counts=history?.favoriteTokenCounts||{};let s=0;
    for(const w of words(name)){if(w.length>3)s+=Math.min(2,Number(counts[w]||0)*.2);}
    return Math.min(3,s);
  }
  function recentRepetition(name,history){
    const rows=history?.recentTitles instanceof Set?[...history.recentTitles]:safeArray(history?.recentTitles);
    const n=norm(name);if(!n||!rows.length)return 0;
    return rows.some(x=>overlapTokens(n,x)>=.5||overlapTokens(x,n)>=.5)?1:0;
  }
  function complementRank(row,{role,m,intent,culture,owned,history,seed,index}){
    if(unique(owned).some(x=>contains(x,row.name)||contains(row.name,x)))return null;
    const tags=safeArray(row.tags),intents=safeArray(row.intents),cultures=safeArray(row.cultures);
    const tagFit=(tags.includes(m)?2:0)+(tags.includes(role)?1:0)+(tags.length===0?1:0);
    const intentFit=intents.length?(intents.includes(intent)?2:0):1;
    const cultureFit=culture?(cultures.length?(cultures.includes(culture)?2:0):1):(cultures.length?0:1);
    const favoriteFit=historyPreferenceScore(row.name,history);
    const freshFit=recentRepetition(row.name,history)?0:1;
    const tie=(hash(`${row.name}|${seed}|${index}`)%10000)/10000;
    return {row,tuple:[tagFit,intentFit,cultureFit,freshFit,favoriteFit,tie]};
  }
  function compareTuple(a,b){
    for(let i=0;i<Math.max(a.length,b.length);i++){const d=(b[i]||0)-(a[i]||0);if(d)return d;}
    return 0;
  }
  function pickComplement(role,ctx,index=0){
    const pool=safeArray((KB().COMPLEMENTS||{})[role]);if(!pool.length)return '';
    const ranked=pool.map(row=>complementRank(row,{...ctx,role,index})).filter(Boolean)
      .sort((a,b)=>compareTuple(a.tuple,b.tuple)||a.row.name.localeCompare(b.row.name,'fr'));
    if(!ranked.length)return '';
    // Rotate only inside a compatibility-equivalent top window; a variant never jumps to an incoherent family.
    const best=ranked[0].tuple.slice(0,4).join('|');
    const window=ranked.filter(x=>x.tuple.slice(0,4).join('|')===best).slice(0,10);
    return (window[(ctx.variant+index)%window.length]||ranked[0]).row.name;
  }

  function finishRole(m,a){
    if(['beverage'].includes(m))return 'beverage_finish';
    if(['smoothie','yogurt_fruit','dessert','bake_sweet','custard','chocolate_egg','affogato','pastry_sweet','sticky_rice_dessert','almond_dough'].includes(m))return 'sweet_finish';
    return 'finish';
  }

  const MILK_FINISH={
    equilibre:['cannelle & cardamome','vanille & cannelle','cacao non sucré & cannelle','amandes concassées'],
    digestion:['cannelle & vanille','cardamome & gingembre doux','fleur d’oranger & cannelle','vanille seule'],
    energie:['café & cannelle','matcha & vanille','banane mixée & cannelle','flocons d’avoine fins'],
    construire:['skyr ou soja nature','purée d’amande','flocons d’avoine fins','graines de chanvre'],
    legerete:['cannelle & vanille','menthe & cacao léger','zeste d’orange & cannelle','cardamome'],
    gourmandise:['cacao & noisette','vanille & cardamome','café & cacao','praliné noisette en petite touche']
  };
  const SODA_FINISH={
    equilibre:['fruits rouges & menthe','concombre & basilic','agrumes & romarin','hibiscus & citron'],
    digestion:['gingembre & citron vert','menthe & citron','fenouil & agrumes','verveine & citron'],
    energie:['gingembre & citron vert','mangue & citron vert','thé vert & pêche','hibiscus & orange'],
    construire:['fruits rouges & citron','mangue & gingembre','agrumes & menthe','ananas & citron vert'],
    legerete:['concombre & menthe','pastèque & menthe','citron vert & basilic','pamplemousse & romarin'],
    gourmandise:['framboise & basilic','mangue & passion','cerise & citron vert','pêche & vanille']
  };
  const SMOOTHIE_FINISH={
    equilibre:['graines de chia','yaourt grec ou alternative soja','amandes & cannelle','flocons d’avoine grillés'],
    digestion:['gingembre & menthe','poire & cannelle','citron vert & menthe','graines de chia'],
    energie:['banane & flocons d’avoine','dattes & cacao','mangue & citron vert','purée de cacahuète'],
    construire:['skyr ou alternative soja','graines de chanvre','purée d’amande & avoine','tofu soyeux cacao'],
    legerete:['menthe & citron vert','framboises fraîches','agrumes & menthe','graines de chia'],
    gourmandise:['vanille & coco grillée','cacao & noisette','pistaches & cardamome','coulis passion']
  };

  function chooseAbsent(pool,owned,seed){
    const rows=safeArray(pool);if(!rows.length)return '';
    for(let k=0;k<rows.length;k++){const x=rows[(Math.abs(seed)+k)%rows.length];if(x&&!owned.some(y=>contains(y,x)||contains(x,y)))return x;}
    return '';
  }

  function completeMeal(a,m,intent,culture,owned,history,variant,seed){
    if(m==='beverage'){
      const pool=hasTrait(a,'milk')?(MILK_FINISH[intent]||MILK_FINISH.equilibre):(SODA_FINISH[intent]||SODA_FINISH.equilibre);
      return [chooseAbsent(pool,owned,seed+variant*5)].filter(Boolean);
    }
    if(m==='smoothie'||m==='yogurt_fruit'){
      return [chooseAbsent(SMOOTHIE_FINISH[intent]||SMOOTHIE_FINISH.equilibre,owned,seed+variant*5)].filter(Boolean);
    }
    const special=specialRequirements(a,m,intent).filter(x=>!owned.some(y=>contains(y,x)||contains(x,y)));
    const targets=targetRoles(a,m,intent);
    const ctx={m,intent,culture,owned,history,variant,seed};const out=[];
    special.forEach(x=>{if(out.length<3)out.push(x);});
    const specialRoles=new Set(special.flatMap(x=>classify(x).roles));
    for(const role of targets){if(out.length>=3)break;if(specialRoles.has(role))continue;const x=pickComplement(role,ctx,out.length);if(x)out.push(x);}
    if(out.length<1){const x=pickComplement(finishRole(m,a),ctx,0);if(x)out.push(x);}
    else if(out.length<3&&['gourmandise','digestion','legerete'].includes(intent)){
      const x=pickComplement(finishRole(m,a),ctx,out.length);if(x)out.push(x);
    }
    return unique(out).filter(x=>!owned.some(y=>contains(y,x)||contains(x,y))).slice(0,3);
  }

  function formPool(m,culture){
    const base=safeArray((KB().FORMS||{})[m]);const cfg=(KB().CULTURES||{})[culture];
    const cultural=safeArray(cfg?.forms?.[m]||cfg?.forms?.[m==='noodle'?'pasta':m==='tuber'?'tuber':m]);
    return unique([...cultural,...base]);
  }
  function chooseForm(a,m,intent,culture,variant,seed){
    let pool=formPool(m,culture);const t=a.text;
    if(m==='bread'){
      if(hasTrait(a,'pinsa_base'))pool=['Pinsa blanche','Pinsa tomate-herbes','Pinsa légumes rôtis','Pinsa champignons & herbes','Pinsa fraîche après cuisson','Pinsa gratinée','Pinsa façon bruschetta','Pinsa garnie'];
      else if(hasTrait(a,'bruschetta_base'))pool=['Bruschetta gratinée','Bruschetta tomate-herbes','Bruschetta légumes rôtis','Croque-bruschetta','Bruschetta fraîche','Bruschetta champignons','Bruschetta poulet-herbes','Bruschetta façon tartine'];
      else if(hasTrait(a,'panini_base'))pool=['Panini blanc','Panini grillé','Panini tomate-fromage','Panini légumes grillés','Panini poulet-herbes','Panini champignons','Panini roquette-tomate','Panini façon croque'];
      else if(hasTrait(a,'mini_bread'))pool=['Mini pains garnis','Mini pains à l’oignon','Mini bruschettas','Mini pains gratinés','Mini sandwichs chauds','Petits pains aux herbes','Mini pains tomate-fromage','Petits pains farcis'];
    }
    if(!pool.length)pool=formPool(m==='affogato'?'dessert':m==='pastry_sweet'?'bake_sweet':'mixed',culture);
    if(m==='salad'||m==='tuber_salad')pool=pool.filter(x=>!/farc|gratin|mijot|veloute/.test(norm(x)));
    if(intent==='digestion'){
      const gentle=pool.filter(x=>/papillote|vapeur|bouillon|mijote|veloute|salade|bowl|pilaf|poele|four|roti/.test(norm(x)));if(gentle.length>=3)pool=gentle;
    }
    if(intent==='gourmandise'){
      const rich=pool.filter(x=>/gratin|roti|laque|creme|poele|tarte|croque|fondant|mousse|pizza|focaccia|croustill|panini/.test(norm(x)));if(rich.length>=3)pool=rich;
    }
    if(variant===0){
      if(m==='salad'&&freshRawItems(a).length>=2)return 'Salade croquante';
      if(m==='tuber_salad')return 'Salade de pommes de terre aux herbes';
      if(m==='breaded_protein')return 'Escalope panée maison';
      if(m==='almond_dough')return 'Pâte sablée aux amandes';
      if(m==='sticky_rice_dessert')return /mangue/.test(t)?'Mango sticky rice inspiré':'Riz gluant coco & fruit';
      if(m==='bread'&&hasTrait(a,'pinsa_base'))return 'Pinsa blanche';
      if(m==='bread'&&hasTrait(a,'bruschetta_base'))return 'Bruschetta gratinée';
      if(m==='bread'&&hasTrait(a,'panini_base'))return 'Panini blanc';
      if(m==='bread'&&hasTrait(a,'mini_bread'))return 'Mini pains garnis';
      if(m==='pasta'&&leafItems(a).length)return 'Salade de pâtes tiède';
      if(m==='tuber'&&hasTrait(a,'grenaille')&&hasRole(a,'fat'))return 'Plaque de tubercules rôtis';
      if(m==='grain'&&hasTrait(a,'egg')&&/oignon/.test(t))return 'Riz/céréales sautés';
      if(m==='protein'&&hasTrait(a,'poultry')&&/entier/.test(t))return 'Rôti au four & garniture';
      if(m==='fish'&&hasTrait(a,'piece_specific'))return 'Poisson rôti & condiment';
    }
    return choose(pool,seed+variant*7)||'Assiette composée';
  }

  function relevantNames(a,m){
    const leaf=leafItems(a).map(x=>x.name),veg=cookedVegetables(a).map(x=>x.name),protein=allNames(a,'protein'),starch=allNames(a,'starch'),fruit=allNames(a,'fruit'),dairy=allNames(a,'dairy'),sweet=allNames(a,'sweet');
    if(m==='salad'||m==='tuber_salad')return unique([...leaf,...veg,...protein,...starch]).slice(0,4);
    if(['pasta','noodle','grain','tuber'].includes(m))return unique([...starch,...protein,...veg,...leaf,...itemsOf(a,'aromatic').map(x=>x.name)]).slice(0,4);
    if(['fish','protein','mixed','breaded_protein'].includes(m))return unique([...protein,...starch,...veg,...leaf,...itemsOf(a,'aromatic').map(x=>x.name)]).slice(0,4);
    if(['bread','pizza_dough','pastry_dough'].includes(m))return unique([...starch,...protein,...dairy,...veg,...leaf,...itemsOf(a,'sauce').map(x=>x.name)]).slice(0,4);
    if(['smoothie','yogurt_fruit','dessert','bake_sweet','custard','chocolate_egg','affogato','pastry_sweet','beverage','sticky_rice_dessert','almond_dough'].includes(m))return unique([...fruit,...dairy,...sweet,...allNames(a,'drink'),...allNames(a,'sweetener'),...itemsOf(a,'aromatic').map(x=>x.name),...starch,...allNames(a,'fat')]).slice(0,4);
    return a.items.map(x=>x.name).slice(0,4);
  }
  function shortIngredient(name){
    return String(name||'').replace(/\b(morceaux? de|paves? de|pavés? de|filets? de|blancs? de)\b/gi,'').replace(/\s+/g,' ').trim();
  }
  function agreeAdj(name,base){
    const n=norm(name),plural=/\b(ailes|cuisses|escalopes|aiguillettes|paves|pavés|filets|pilons|blancs|morceaux|quenelles)\b/.test(n),fem=/\b(ailes|cuisses|escalopes|aiguillettes|quenelles)\b/.test(n);
    return `${base}${fem?'e':''}${plural?'s':''}`;
  }
  function buildTitle(a,m,form,missing,variant){
    const names=relevantNames(a,m).map(shortIngredient),text=a.text;
    const exactProtein=firstSavoryProtein(a),protein=shortIngredient(exactProtein),starch=shortIngredient(firstName(a,'starch'));
    const leaf=(leafItems(a)[0]||{}).name||'',veg=(cookedVegetables(a)[0]||{}).name||'';
    const nameLike=re=>a.items.find(x=>re.test(x.norm))?.name||'';
    const hasAll=(...rx)=>rx.every(re=>re.test(text));

    if(m==='beverage'){
      if(hasTrait(a,'carbonated')&&hasTrait(a,'acid_fruit')&&/menthe/.test(text)){
        const forms=['Eau pétillante citron & menthe','Fizz citron-menthe','Mocktail pétillant citron & menthe','Citronnade pétillante à la menthe','Eau fraîche citron-menthe','Soda maison citron & menthe'];
        return forms[Math.abs(variant)%forms.length];
      }
      if(hasTrait(a,'milk')&&/vanille/.test(text)&&hasRole(a,'sweetener')){
        const forms=['Latte vanille & miel','Latte glacé vanille-miel','Boisson chaude vanille-cannelle','Avoine/boisson végétale façon chaï doux','Boisson frappée vanille-miel','Latte cacao-vanille'];
        return forms[Math.abs(variant)%forms.length];
      }
      return `${form} · ${list(names.slice(0,3))||'boisson maison'}`;
    }
    if((m==='mixed'||m==='salad')&&/mozzarella/.test(text)&&/tomate/.test(text)&&/basilic/.test(text)){
      const forms=['Salade caprese · tomate, mozzarella & basilic','Caprese en assiette fraîche','Bruschetta caprese','Bowl caprese aux herbes','Tomates & mozzarella marinées au basilic','Caprese sur pain grillé'];
      return forms[Math.abs(variant)%forms.length];
    }

    // Structural signatures. They describe culinary families, not one exact ingredient tuple.
    if(m==='breaded_protein')return `${cap(exactProtein||'Escalope')} ${agreeAdj(exactProtein||'Escalope','pané')} maison`;
    if(m==='almond_dough')return variant===0?'Pâte sablée aux amandes':form;
    if(m==='sticky_rice_dessert')return /mangue/.test(text)?(variant===0?'Riz gluant coco & mangue':form):form;
    if(m==='batter_savory'&&hasTrait(a,'buckwheat_flour'))return variant===0?'Galettes de sarrasin maison':form;
    if(m==='tuber_salad'){
      const extras=unique([...leafItems(a).map(x=>x.name),...freshRawItems(a).map(x=>x.name)]).filter(x=>!contains(x,starch));
      const baseName=starch||'pommes de terre';
      const firstForm=/pomme.*terre/.test(norm(baseName))?'Salade de pommes de terre':`Salade tiède de ${lower(baseName)}`;
      return `${variant===0?firstForm:form.replace(/pommes de terre/gi,baseName)} · ${list(extras.slice(0,2))||'herbes fraîches'}`;
    }

    if(m==='bread'){
      const freshCheese=a.items.find(x=>x.traits.includes('fresh_cheese'))?.name||'';
      const cheese=a.items.find(x=>x.traits.includes('cheese'))?.name||'';
      if(hasTrait(a,'pinsa_base')&&freshCheese&&hasTrait(a,'cream')){
        const forms=['Pinsa blanche','Pinsa tomate-herbes','Pinsa légumes rôtis','Pinsa champignons & herbes','Pinsa fraîche après cuisson','Pinsa gratinée','Pinsa façon bruschetta','Pinsa garnie'];
        return `${forms[Math.abs(variant)%forms.length]} · ${freshCheese} & crème`;
      }
      if(hasTrait(a,'panini_base')&&hasTrait(a,'cream')&&cheese)return `${variant===0?'Panini blanc':form} · crème & ${lower(cheese)}`;
      if(hasTrait(a,'bruschetta_base')&&hasTrait(a,'cream_sauce')&&/jambon/.test(text))return `${variant===0?'Bruschetta gratinée':form} · béchamel & jambon`;
      if(hasTrait(a,'mini_bread')&&hasRole(a,'fat')&&/oignon/.test(text))return `${variant===0?'Mini pains à l’oignon':form} & huile d’olive`;
      if(freshCheese&&protein)return `${form} · ${protein} & ${freshCheese}`;
    }
    if(m==='pizza_dough'){
      if(variant===0&&/oignon/.test(text)&&hasRole(a,'fat')&&!/tomate|mozzarella|fromage/.test(text))return `Pizza blanche aux oignons`;
      return `${form} · ${list(names.filter(x=>!x.toLocaleLowerCase('fr').includes('pâte')).slice(0,3))||'garniture maison'}`;
    }

    if(m==='pastry_dough'&&hasTrait(a,'cream')&&/lardon/.test(text))return variant===0?'Tarte fine crème & lardons':`${form} · lardons & crème`;
    if(m==='pastry_sweet'&&hasTrait(a,'chocolate'))return variant===0?'Tarte au chocolat · ganache minute':form;

    if(m==='pasta'){
      if(hasTrait(a,'cooking_alcohol')&&hasTrait(a,'cheese')){
        const pasta=a.items.find(x=>x.traits.includes('pasta'))?.name||'pâtes';const cheese=a.items.find(x=>x.traits.includes('cheese'))?.name||'fromage';const wine=a.items.find(x=>x.traits.includes('cooking_alcohol'))?.name||'vin blanc';
        return `${cap(pasta)} crémeuses au ${lower(cheese).replace(/^fromage de /,'')} & ${lower(wine)}`;
      }
      if(/lardon/.test(text)&&/tomate/.test(text)){
        const forms=['Pâtes poêlées aux tomates & lardons','Gratin de pâtes tomate-lardons','Pâtes façon risottata tomate-lardons','Salade de pâtes tiède tomate-lardons','Pâtes rôties au four tomate-lardons','Pâtes en sauce courte tomate-lardons','Pâtes aux légumes confits & lardons','Pâtes citron-herbes, tomates & lardons'];
        return forms[Math.abs(variant)%forms.length];
      }
      if(hasTrait(a,'poultry')&&leafItems(a).length)return `${variant===0?'Pâtes au poulet & salade fraîche':form} · ${variant===0?'':list(names.filter(x=>norm(x)!==norm(starch)).slice(0,2))}`.replace(/ · $/,'');
      return `${form} · ${list(names.filter(x=>norm(x)!==norm(starch)).slice(0,3))||starch}`;
    }
    if(m==='noodle')return `${form} · ${list(names.filter(x=>norm(x)!==norm(starch)).slice(0,3))||starch}`;
    if(m==='grain'){
      if(variant===0&&/couscous/.test(text)&&/(agneau|mouton)/.test(text)&&itemsOf(a,'vegetable').length>=2)return `Couscous · agneau & légumes`;
      if(variant===0&&/fonio/.test(text)&&hasTrait(a,'poultry')&&/gombo|okra/.test(text))return `Fonio pilaf · poulet & gombo`;
      if(variant===0&&hasTrait(a,'egg')&&/oignon/.test(text))return `${cap(starch||'Riz')} sauté · œufs & oignon`;
      if(variant===0&&/curry/.test(text)&&protein)return `${cap(starch||'Riz')} curry · ${protein}`;
      return `${form} · ${list(names.filter(x=>norm(x)!==norm(starch)).slice(0,3))||starch}`;
    }
    if(m==='tuber'){
      // Non-potato staples keep their own culinary identity in every variant.
      if(/plantain/.test(text)){
        const forms=['Plantain rôti','Plantain poêlé','Bowl de plantain','Plantain braisé','Plantain écrasé & garniture','Plantain au four','Salade tiède de plantain','Plantain façon plaque complète'];
        const extras=unique([...allNames(a,'protein'),...allNames(a,'vegetable'),...itemsOf(a,'aromatic').map(x=>x.name)]).filter(x=>!/plantain/.test(norm(x))).slice(0,3);
        return `${forms[Math.abs(variant)%forms.length]}${extras.length?` · ${list(extras)}`:''}`;
      }
      if(/attieke|attiéké/.test(text)){
        const forms=['Bowl d’attiéké','Attiéké citron-herbes','Attiéké & garniture braisée','Salade tiède d’attiéké','Attiéké tomate-oignon','Attiéké façon assiette complète'];
        const extras=unique([...allNames(a,'protein'),...allNames(a,'vegetable'),...leafItems(a).map(x=>x.name)]).filter(x=>!/attieke|attiéké/.test(norm(x))).slice(0,3);
        return `${forms[Math.abs(variant)%forms.length]}${extras.length?` · ${list(extras)}`:''}`;
      }
      if(/manioc|chikwangue|kwanga/.test(text)){
        const base=/chikwangue|kwanga/.test(text)?'Chikwangue':'Manioc';
        const proteinName=shortIngredient(firstSavoryProtein(a));
        if(variant===0&&base==='Chikwangue'&&proteinName&&/feuilles? de manioc|pondu|saka/.test(text))return `Chikwangue · ${proteinName} & feuilles de manioc`;
        if(variant===0&&base==='Manioc'&&proteinName&&/gombo|okra/.test(text))return `${cap(proteinName)} & manioc · gombo`;
        const forms=[`${base} & garniture`,`${base} rôti & condiment`,`${base} en bowl chaud`,`${base} & sauce tomate-oignon`,`${base} façon assiette braisée`,`${base} & légumes mijotés`];
        const extras=unique([...allNames(a,'protein'),...allNames(a,'vegetable'),...leafItems(a).map(x=>x.name)]).filter(x=>!/manioc|chikwangue|kwanga/.test(norm(x))).slice(0,3);
        return `${forms[Math.abs(variant)%forms.length]}${extras.length?` · ${list(extras)}`:''}`;
      }
      if(variant===0&&/attieke|attiéké/.test(text)&&hasTrait(a,'poultry')&&leafItems(a).length)return `Bowl d’attiéké · poulet & salade fraîche`;
      if(variant===0&&/chikwangue|kwanga/.test(text)&&hasTrait(a,'fish')&&/feuilles? de manioc|pondu|saka/.test(text))return `Chikwangue · poisson & feuilles de manioc`;
      if(variant===0&&/plantain/.test(text)&&protein&&/tomate/.test(text)&&/oignon/.test(text))return `Plantain rôti · ${protein} & tomate-oignon`;
      if(variant===0&&hasTrait(a,'grenaille')&&/roti de boeuf|roti de bœuf|rosbif|roast beef/.test(text))return `Rôti de bœuf & pommes grenailles rôties`;
      if(variant===0&&hasTrait(a,'fish')&&/gombo/.test(text))return `${cap(protein||'Poisson')} & ${lower(starch||'tubercule')} · gombo`;
      if(variant===0&&hasTrait(a,'grenaille')&&hasRole(a,'fat')&&!protein&&!veg)return `Pommes grenailles rôties · huile & beurre`;
      if(variant===0&&/pomme.*terre/.test(text)&&hasTrait(a,'cream')&&hasTrait(a,'milk'))return `Gratin de pommes de terre crémeux`;
      if(variant===0&&/pomme.*terre/.test(text)&&/courgette/.test(text)&&/ail/.test(text))return `Poêlée courgettes & pommes de terre à l’ail`;
      if(variant===0&&hasTrait(a,'minced_meat')&&/pomme.*terre/.test(text)&&/oignon/.test(text))return `Poêlée pommes de terre · bœuf & oignon`;
      return `${form} · ${list(names.filter(x=>norm(x)!==norm(starch)).slice(0,3))||starch}`;
    }

    if(m==='protein'||m==='mixed'){
      if(variant===0&&hasTrait(a,'poultry')&&hasTrait(a,'mustard')&&hasTrait(a,'tomato_sauce'))return `${cap(exactProtein||'Poulet')} ${agreeAdj(exactProtein||'Poulet','rôti')} · moutarde & tomate`;
      if(variant===0&&hasTrait(a,'poultry')&&hasTrait(a,'mustard')&&hasTrait(a,'acid_fruit'))return `${cap(exactProtein||'Poulet')} · moutarde & citron`;
      if(variant===0&&hasTrait(a,'poultry')&&hasTrait(a,'mustard')&&hasRole(a,'fat'))return `${cap(exactProtein||'Poulet')} ${agreeAdj(exactProtein||'Poulet','rôti')} à la moutarde`;
      if(variant===0&&hasTrait(a,'poultry')&&hasTrait(a,'sweet_sauce')&&(hasTrait(a,'soy_sauce')||hasTrait(a,'sweet_soy')))return `${cap(exactProtein||'Poulet')} ${agreeAdj(exactProtein||'Poulet','laqué')} · sweet chili & soja`;
      if(variant===0&&hasTrait(a,'minced_meat')&&(hasAll(/echalote/,/ciboulette/)))return `Boulettes de bœuf · échalote & ciboulette`;
      if(variant===0&&hasTrait(a,'red_meat')&&hasAll(/oignon/,/poivron/))return `Sauté de bœuf · oignon & poivron`;
      if(variant===0&&hasTrait(a,'poultry')&&/olive/.test(text)&&/tomate/.test(text))return `Poulet mijoté · tomates & olives vertes`;
      if(variant===0&&/courgette/.test(text)&&/ricotta/.test(text)&&/lardon/.test(text))return `Courgettes gratinées · ricotta & lardons`;
      return `${form} · ${list(names.filter(x=>norm(x)!==norm(protein)).slice(0,3))||protein}`;
    }

    if(m==='fish'){
      if(variant===0&&hasTrait(a,'cream')&&hasTrait(a,'acid_fruit'))return `${cap(exactProtein||'Poisson')} crémeux · citron vert & crème`;
      if(variant===0&&hasTrait(a,'acid_fruit')&&hasTrait(a,'acid')&&/vinaigre/.test(text))return `${cap(exactProtein||'Poisson')} mariné · citron vert & vinaigre`;
      if(variant===0&&hasTrait(a,'seafood')&&hasTrait(a,'quenelle'))return `Quenelles gratinées aux fruits de mer`;
      if(variant===0&&hasTrait(a,'piece_specific')&&hasRole(a,'fat')&&itemsOf(a,'vegetable').length===0)return `${cap(exactProtein||'Poisson')} ${agreeAdj(exactProtein||'Poisson','poêlé')} · huile & beurre`;
      if(variant===0&&hasTrait(a,'piece_specific')&&itemsOf(a,'vegetable').length>=2)return `${cap(exactProtein||'Poisson')} ${agreeAdj(exactProtein||'Poisson','rôti')} · ${list(itemsOf(a,'vegetable').map(x=>x.name).slice(0,2))}`;
      return `${form} · ${list(names.filter(x=>norm(x)!==norm(protein)).slice(0,3))||protein}`;
    }

    if(m==='salad'){
      if(variant===0&&hasTrait(a,'fresh_cheese')&&/avocat/.test(text)&&/tomate/.test(text)){
        const cheese=a.items.find(x=>x.traits.includes('fresh_cheese'))?.name||'fromage frais';return `${cap(cheese)} · avocat & tomates cerises`;
      }
      if(variant===0&&/concombre/.test(text)&&/(?:mais|maïs)/.test(text)&&/oignon/.test(text))return `Salade fraîche · concombre, maïs & oignon rouge`;
      return `${form} · ${list(names.slice(0,3))}`;
    }
    if(m==='vegetable'){
      if(variant===0&&/aubergine/.test(text)&&/ail/.test(text)&&/oignon/.test(text))return `Aubergines fondantes · ail & oignon`;
      if(variant===0&&/chou/.test(text)&&/tomate/.test(text)&&/oignon/.test(text))return `Chou mijoté · tomate & oignon`;
      return `${form} · ${list(names.slice(0,3))}`;
    }
    if(m==='pulse')return `${form} · ${list(names.slice(0,3))}`;

    if(m==='beverage'){
      if(hasTrait(a,'milk')){
        const milk=a.items.find(x=>x.traits.includes('milk'))?.name||'lait';const flav=a.items.filter(x=>x!==a.items.find(y=>y.traits.includes('milk'))).map(x=>x.name);
        return `${variant%2?'Latte glacé':'Latte'} ${lower(milk).replace(/^lait /,'').replace(/^d /,'')} · ${list(flav.slice(0,2))||'épices douces'}`;
      }
      if(hasTrait(a,'carbonated')&&hasTrait(a,'fruit_syrup')){
        const syrup=nameLike(/sirop|grenadine/),soda=nameLike(/sprite|7 up|seven up|limonade|soda/),acid=nameLike(/citron|lime/);
        return `${variant%2?'Spritz sans alcool':'Fizz'} ${syrup?lower(syrup).replace(/^sirop de /,''):''} · ${list([soda,acid].filter(Boolean))}`.replace(/\s+·/,' ·');
      }
      return `${form} · ${list(names.slice(0,3))}`;
    }
    if(m==='chocolate_egg')return choose(['Mousse au chocolat noir','Fondant chocolat express','Brownie chocolat minute','Crème chocolat intense','Soufflé chocolat minute','Moelleux chocolat'],variant);
    if(m==='custard')return choose(['Crème aux œufs maison','Œufs au lait vanillés','Flan maison','Crème caramel','Petits pots vanillés','Pain perdu crémeux'],variant);
    if(m==='affogato'){const x=/amaretto/.test(text)?' à l’amaretto':'';return choose([`Affogato vanille${x}`,`Coupe glacée café-vanille${x}`,`Affogato cacao${x}`,`Café frappé dessert vanille${x}`,`Verrine café-vanille croquante${x}`,`Dessert glacé espresso${x}`],variant);}
    if(m==='bake_sweet'){
      if(hasTrait(a,'chocolate'))return choose(['Gâteau cacao express','Brownie cacao','Muffins cacao','Cake chocolat','Cookies cacao','Pancakes cacao'],variant);
      return choose(['Base de gâteau moelleux à compléter','Muffins maison à compléter','Cake maison à compléter','Pancakes moelleux à compléter','Biscuits maison à compléter','Gaufres moelleuses à compléter'],variant);
    }
    if(m==='yogurt_fruit'){
      const yogurt=a.items.find(x=>x.traits.includes('cultured_dairy'))?.name||'yaourt',fruits=allNames(a,'fruit').filter(x=>!x.toLocaleLowerCase('fr').includes('citron'));
      return `${form} · ${list([yogurt,...fruits.slice(0,2)])}`;
    }
    if(m==='smoothie'){
      const milk=a.items.find(x=>x.traits.includes('milk'))?.name||'',fruits=allNames(a,'fruit').filter(x=>!x.toLocaleLowerCase('fr').includes('citron'));
      if(variant===0&&milk&&fruits.length)return `Smoothie ${list(fruits.slice(0,2))} au ${lower(milk)}`;
      return `${form} · ${list([...fruits.slice(0,2),milk].filter(Boolean))}`;
    }
    if(m==='dessert')return `${form} · ${list(names.slice(0,3))}`;
    if(m==='batter_savory')return `${form} · ${list(names.slice(0,3))}`;
    if(m==='condiments_only')return `${form} · avec ${list(missing.slice(0,2))}`;
    return `${form} · ${list(names.slice(0,3))}`;
  }

  function prepFor(a,m,form,missing,intent,culture){
    const add=missing.length?list(missing):'la finition choisie',leaf=leafItems(a).map(x=>x.name),text=a.text;
    const rawFish=hasTrait(a,'fish')&&/marin|ceviche|tartare|cru/.test(norm(form));
    const exactProtein=firstSavoryProtein(a);
    if(m==='salad')return `Garde ${list(leaf.length?leaf:freshRawItems(a).map(x=>x.name).length?freshRawItems(a).map(x=>x.name):itemsOf(a,'vegetable').map(x=>x.name))} frais. Prépare séparément ce qui demande une cuisson, ajoute ${add}, puis assaisonne seulement au moment de servir.`;
    if(m==='tuber_salad')return `Fais cuire les pommes de terre jusqu’à ce qu’elles soient tendres puis laisse-les tiédir. Ajoute les feuilles et crudités seulement hors du feu, complète avec ${add} et assaisonne au dernier moment.`;
    if(m==='pasta')return `Fais cuire les pâtes al dente. Prépare la garniture à part, lie-la brièvement avec un peu d’eau de cuisson si nécessaire, puis ajoute ${leaf.length?`${list(leaf)} hors du feu et `:''}${add} au service.`;
    if(m==='noodle')return `Fais une cuisson courte des nouilles. Saute les éléments qui doivent cuire, garde les crudités croquantes, puis termine avec ${add}.`;
    if(m==='grain')return `Prépare ${firstName(a,'starch')||'la céréale'} puis cuis protéines, légumes et aromates selon leur propre temps de cuisson. Réunis le tout sans surcuire et complète avec ${add}.`;
    if(m==='tuber'){
      if(/pomme.*terre/.test(text)&&hasTrait(a,'cream')&&hasTrait(a,'milk'))return `Tranche finement les pommes de terre, dispose-les dans un plat et couvre d’un mélange lait-crème assaisonné. Enfourne jusqu’à texture fondante et surface dorée; ajoute ${add} seulement si tu veux compléter le repas.`;
      if(/pomme.*terre/.test(text)&&/courgette/.test(text)&&/ail/.test(text))return `Précuis légèrement les pommes de terre, puis fais-les dorer avec les courgettes et l’ail. Garde les courgettes encore légèrement fermes et sers avec ${add}.`;
      if(hasTrait(a,'grenaille')&&hasRole(a,'fat')&&!hasRole(a,'protein'))return `Enrobe les grenailles d’un peu d’huile, rôtis-les jusqu’à ce qu’elles soient dorées puis ajoute une petite noisette de beurre en fin de cuisson. Complète le repas avec ${add}.`;
      return `Précuis ${firstName(a,'starch')||'les tubercules'} si nécessaire, puis rôtis, poêle ou écrase selon la forme choisie. Ajoute les éléments fragiles au dernier moment et complète avec ${add}.`;
    }
    if(m==='breaded_protein')return `Passe ${exactProtein||'la protéine'} dans la farine, puis dans ${hasTrait(a,'egg')?'l’œuf':'l’œuf proposé'}, puis dans les biscottes émiettées/chapelure. Poêle avec peu de matière grasse ou cuis au four jusqu’à cuisson complète, puis sers avec ${add}.`;
    if(m==='bread'){
      if(hasTrait(a,'bruschetta_base')&&hasTrait(a,'cream_sauce')&&/jambon/.test(text))return `Étale une fine couche de béchamel sur le pain à bruschetta, ajoute le jambon et gratine. Termine avec ${add} après cuisson si le complément est frais.`;
      if(hasTrait(a,'panini_base')&&hasTrait(a,'cream')&&hasTrait(a,'cheese'))return `Étale une fine couche de crème, ajoute le fromage puis grille le panini jusqu’à ce que le pain soit croustillant. Ajoute ${add} après cuisson si ce sont des feuilles ou crudités.`;
      if(hasTrait(a,'pinsa_base'))return `Étale la garniture en couche fine sur la pinsa, enfourne à four chaud puis ajoute les feuilles, crudités ou herbes seulement après cuisson. Complète avec ${add}.`;
      return `Garnis le pain sans trop le charger, chauffe seulement ce qui gagne à fondre ou dorer, puis ajoute les feuilles, crudités ou herbes après cuisson. Complète avec ${add}.`;
    }
    if(m==='pizza_dough')return `Étale la pâte, ajoute une garniture peu humide et l’oignon en fines lamelles, puis cuis à four bien chaud. Termine avec les éléments frais après cuisson et complète avec ${add}.`;
    if(m==='pastry_dough')return `Déroule ou fonce la pâte, ajoute la garniture en limitant l’excès de liquide, puis cuis jusqu’à pâte bien dorée. Sers avec ${add}.`;
    if(m==='pastry_sweet')return `Fonce la pâte sablée. Chauffe la crème puis verse-la sur le chocolat pour former une ganache, garnis le fond de tarte et laisse prendre; termine avec ${add}.`;
    if(m==='almond_dough')return `Sable farine, poudre d’amande et beurre froid. Ajoute ${add} juste assez pour lier la pâte, repose-la au frais puis utilise-la en sablés, fond de tarte ou crumble selon la variante.`;
    if(m==='bake_sweet')return `Mélange d’abord les ingrédients secs, puis ajoute progressivement ${add}. Travaille juste assez pour obtenir une pâte homogène et cuis selon la forme choisie.`;
    if(m==='batter_savory'){
      if(hasTrait(a,'buckwheat_flour'))return `Mélange la farine de sarrasin avec les œufs puis détends progressivement avec le lait jusqu’à obtenir une pâte fluide. Laisse reposer si possible, cuis en galettes fines puis garnis avec ${add}.`;
      return `Mélange la farine et les œufs, détends avec le lait jusqu’à la texture voulue puis cuis en galettes, crêpes ou pancakes salés. Complète avec ${add}.`;
    }
    if(m==='custard')return `Fouette les œufs avec le sucre sans trop faire mousser, ajoute le lait progressivement, parfume avec ${add}, puis cuis doucement au bain-marie ou au four jusqu’à prise.`;
    if(m==='chocolate_egg')return `Fais fondre le chocolat doucement. Incorpore les œufs selon la variante choisie, ajoute le sucre puis termine avec ${add}; adapte ensuite la cuisson ou le repos au type de dessert.`;
    if(m==='sticky_rice_dessert')return `Fais cuire le riz gluant, puis laisse-le absorber une partie du lait de coco légèrement sucré. Sers tiède ou froid avec le fruit frais et ${add}.`;
    if(m==='affogato')return `Dépose la glace dans un verre, verse le café chaud juste au service${/amaretto/.test(text)?' puis ajoute l’amaretto en petite quantité':''}. Termine avec ${add}.`;
    if(m==='beverage')return hasTrait(a,'milk')?`Chauffe ou refroidis la base selon la variante, ajoute les arômes et le sucrant progressivement, puis termine avec ${add}.`:`Mélange la base bien froide avec les arômes; ajoute agrumes et herbes au dernier moment puis complète avec ${add}.`;
    if(m==='yogurt_fruit')return /frozen|glace|esquimaux|bark/.test(norm(form))?`Mélange le yaourt et les fruits, étale ou moule selon la variante puis congèle. Termine avec ${add} au service.`:/smoothie/.test(norm(form))?`Mixe le yaourt et les fruits avec un peu de liquide si nécessaire, puis termine avec ${add}.`:`Assemble le yaourt et les fruits en couches ou dans un bol, garde une partie des fruits entiers et termine avec ${add}.`;
    if(m==='smoothie')return `Mixe la boisson/lait et les fruits jusqu’à la texture voulue. Ajuste l’épaisseur avec ${add} et garde une petite garniture pour le service.`;
    if(m==='dessert')return `Travaille les ingrédients en dessert froid ou cuit selon la forme choisie, garde les fruits fragiles pour la fin et termine avec ${add}.`;
    if(m==='fish'){
      if(hasTrait(a,'acid_fruit')&&/vinaigre/.test(text)){
        const safety=KB().SAFETY?.rawFish||'';
        return `Mélange citron vert, vinaigre et aromates, puis utilise cette base comme marinade courte. Pour une version crue, respecte strictement les conditions adaptées; sinon saisis ou cuis le poisson avant de l’assaisonner. Complète avec ${add}. ${safety}`.trim();
      }
      if(hasTrait(a,'seafood')&&hasTrait(a,'quenelle'))return `Dispose les quenelles et les fruits de mer dans un plat, ajoute une sauce courte ou un peu de crème si tu en choisis, parsème d’une petite noisette de beurre puis gratine. Sers avec ${add}.`;
      if(hasTrait(a,'piece_specific')&&hasRole(a,'fat')&&itemsOf(a,'vegetable').length===0)return `Saisis ${exactProtein||'le poisson'} dans un peu d’huile, ajoute le beurre en fin de cuisson pour l’arroser sans le brûler, puis sers avec ${add}.`;
      const safety=rawFish?` ${KB().SAFETY?.rawFish||''}`:'';
      return `Assaisonne ${exactProtein||'le poisson'}, cuis-le selon la forme choisie sans prolonger inutilement la cuisson, prépare les accompagnements séparément puis termine avec ${add}.${safety}`.trim();
    }
    if(m==='protein'||m==='mixed'){
      if(hasTrait(a,'poultry')&&hasTrait(a,'sweet_sauce')&&(hasTrait(a,'soy_sauce')||hasTrait(a,'sweet_soy')))return `Mélange sweet chili et sauce soja, enrobe ${exactProtein||'le poulet'} puis cuis au four ou à la poêle en laquant plusieurs fois jusqu’à cuisson complète. Sers avec ${add}.`;
      if(hasTrait(a,'poultry')&&hasTrait(a,'mustard')&&hasTrait(a,'tomato_sauce'))return `Mélange moutarde et concentré de tomate avec un peu d’eau ou d’huile, badigeonne ${exactProtein||'le poulet'} puis rôtis jusqu’à cuisson complète. Ajoute ${add} comme accompagnement.`;
      if(hasTrait(a,'poultry')&&hasTrait(a,'mustard'))return `Enrobe ${exactProtein||'le poulet'} de moutarde et d’un peu d’huile, puis rôtis ou saisis jusqu’à cuisson complète. Termine avec ${add}.`;
      if(hasTrait(a,'minced_meat')&&/echalote/.test(text)&&/ciboulette/.test(text))return `Mélange le bœuf haché avec échalote et ciboulette, façonne des boulettes ou steaks puis saisis-les. Complète avec ${add}.`;
      if(hasTrait(a,'red_meat')&&/oignon/.test(text)&&/poivron/.test(text))return `Saisis le bœuf à feu vif, réserve-le, fais revenir oignon et poivron puis réunis le tout brièvement pour garder une viande tendre. Sers avec ${add}.`;
      if(hasTrait(a,'poultry')&&/olive/.test(text)&&/tomate/.test(text))return `Fais dorer le poulet, ajoute tomates et olives puis laisse mijoter doucement jusqu’à cuisson complète. Termine avec ${add}.`;
      return `Saisis, rôtis ou mijote la protéine selon le morceau. Prépare les garnitures pendant la cuisson et assemble avec ${add} pour obtenir un plat complet.`;
    }
    if(m==='vegetable')return `Travaille les légumes selon leur texture : rôtis pour concentrer, poêlés pour garder du croquant ou mijotés pour une version fondante. Complète avec ${add}.`;
    if(m==='pulse')return `Réchauffe ou cuis les légumineuses avec les aromates, garde les éléments frais séparés et complète avec ${add} selon la forme choisie.`;
    if(m==='condiments_only')return `Tes ingrédients actuels forment surtout une base d’assaisonnement. Utilise-les comme marinade ou sauce courte, puis ajoute ${add} pour construire un vrai plat.`;
    return `Prépare chaque élément selon son temps de cuisson, garde les ingrédients frais hors du feu et complète l’ensemble avec ${add}.`;
  }

  function explanationFor(a,m,intent,missing,variant,seed,culture){
    const base=safeArray((KB().INTENT_EXPLANATIONS||{})[intent]);const phrase=choose(base,seed+variant*11)||'La proposition conserve tes ingrédients et complète seulement ce qui manque.';
    const present=[];if(hasRole(a,'starch'))present.push('une base');if(hasRole(a,'protein'))present.push('une protéine');if(hasRole(a,'vegetable'))present.push('des végétaux');if(hasRole(a,'fruit'))present.push('des fruits');
    const detail=present.length?`Tes ingrédients apportent déjà ${list(present)}.`:'Tee a d’abord identifié le rôle culinaire de chaque ingrédient.';
    const completion=missing.length?` À prévoir complète avec ${list(missing)}.`:'';
    const cultural=culture?` La forme choisie s’inspire de repères ${KB().CULTURES?.[culture]?.label||culture} sans prétendre reproduire une recette traditionnelle exacte.`:'';
    return `${detail} ${phrase}${completion}${cultural}`.replace(/\s+/g,' ').trim();
  }

  function catalogRows(catalog){return [...safeArray(root.MT_FOOD_CULTURAL_INDEX),...safeArray(catalog)];}
  function componentNames(row,key){return safeArray(row[key]).map(x=>typeof x==='string'?x:(x?.name||'')).filter(Boolean);}
  function exactDishMatch(a,row){
    const names=[row.name,row.display_name,row.canonical_name,...safeArray(row.aliases)].filter(Boolean).map(norm);
    const exactInput=a.items.find(i=>names.includes(norm(i.name)));
    if(!exactInput)return false;
    if(a.items.length===1)return true;
    const family=norm(row.family||'');
    // A base ingredient such as attiéké, soba or udon must not rename a whole composed meal.
    if(/starch side|starch_side/.test(family))return false;
    const typical=componentNames(row,'typical').concat(componentNames(row,'typical_components'));
    const matched=distinctComponentMatches(a,typical);
    return ['complete_composite','sauce_dish','soup','protein_main','fried_snack','filled_dough'].includes(row.family)&&matched>=2;
  }
  function culturalMatch(a,catalog,intent,variant){
    const rows=catalogRows(catalog);if(!rows.length)return null;
    const scored=[];
    for(const row of rows){
      const name=row.display_name||row.name||row.canonical_name||'';if(!name)continue;
      const typical=componentNames(row,'typical').concat(componentNames(row,'typical_components'));
      const optional=componentNames(row,'optional').concat(componentNames(row,'optional_components'));
      const overlap=distinctComponentMatches(a,typical),optionalOverlap=distinctComponentMatches(a,optional),exact=exactDishMatch(a,row);
      let score=(exact?20:0)+overlap*5+optionalOverlap*1.2-Math.max(0,typical.length-overlap)*.55;
      if(score<8&&!exact)continue;
      scored.push({row,name,typical,optional,overlap,optionalOverlap,exact,score});
    }
    scored.sort((x,y)=>y.score-x.score||x.name.localeCompare(y.name,'fr'));
    return scored[Math.min(variant,Math.max(0,Math.min(4,scored.length)-1))]||null;
  }

  function validateProposal({ingredients=[],proposal=null}={}){
    if(!proposal)return {valid:false,score:0,reasons:['missing_proposal']};
    const a=analyze(ingredients),title=norm(proposal.title),prep=norm(proposal.preparation),expl=norm(proposal.explanation),missing=unique(proposal.missing||[]),m=mode(a);let score=100;const reasons=[];
    const penalize=(n,r)=>{score-=n;reasons.push(r);};
    if(!proposal.title||!proposal.preparation)penalize(35,'empty_fields');
    if(/assiette (?:de|autour de)|avec tes ingredients|assiette composee/.test(title))penalize(12,'generic_title');
    if(/assiette de pate feuilletee|pates? composees/.test(title)&&hasTrait(a,'pastry_dough'))penalize(50,'pastry_confused_with_pasta');
    if(leafItems(a).length&&/poele|mijote|gratin|four/.test(prep)&&!/hors du feu|au service|fraich|cru|dernier moment/.test(prep))penalize(35,'fresh_leaf_cooked');
    if(freshRawItems(a).length>=2&&!hasRole(a,'protein')&&!meaningfulStarches(a).length&&!/salade|bowl|salsa|gazpacho|fraich/.test(title))penalize(28,'raw_vegetables_not_fresh_form');
    if(hasTrait(a,'fresh_cheese')&&/oeufs poulet pois chiches/.test(norm(missing.join(' ')))&&hasRole(a,'protein'))penalize(20,'redundant_protein');
    if(hasRole(a,'protein')&&missing.some(x=>/poulet|oeuf|thon|poisson|tofu|lentille|pois chiche|boeuf/.test(norm(x)))&&!['construire'].includes(proposal.intent)&&!['almond_dough','breaded_protein','bake_sweet','pastry_sweet','custard','chocolate_egg'].includes(m))penalize(15,'duplicate_protein_role');
    if(meaningfulStarches(a).length&&missing.some(x=>/riz|pates|semoule|quinoa|pomme de terre|pain|fonio|millet|plantain|manioc/.test(norm(x))))penalize(12,'duplicate_starch_role');
    if(hasRole(a,'vegetable')&&missing.length&&missing.every(x=>/courgette|epinard/.test(norm(x))))penalize(10,'repetitive_default_vegetable');
    if(/yaourt/.test(expl)&&!hasTrait(a,'cultured_dairy')&&!missing.some(x=>/yaourt/.test(norm(x))))penalize(25,'invented_yogurt');
    if(isSweetContext(a)&&/salade|legume|poulet|pois chiche/.test(norm(missing.join(' ')))&&!/salade de fruits/.test(title))penalize(45,'sweet_savory_conflict');
    if(!isSweetContext(a)&&/mousse au chocolat|gateau cacao|dessert glace|smoothie/.test(title)&&!hasTrait(a,'chocolate')&&!hasRole(a,'fruit'))penalize(45,'savory_sweet_conflict');
    if(hasTrait(a,'sweet_sauce')&&hasRole(a,'protein')&&/mousse|dessert|smoothie|glace/.test(title))penalize(60,'sweet_sauce_misread_as_dessert');
    if(/pomme.*terre/.test(a.text)&&hasTrait(a,'milk')&&hasTrait(a,'cream')&&/smoothie|boisson|latte/.test(title))penalize(70,'potato_dairy_misread_as_drink');
    if(hasTrait(a,'crumb')&&hasRole(a,'protein')&&/panini|bruschetta|pain grille/.test(title))penalize(45,'breadcrumb_misread_as_bread_base');
    if(hasTrait(a,'almond_flour')&&hasTrait(a,'flour')&&hasRole(a,'fat')&&/bowl|poelee|salade/.test(title))penalize(55,'almond_dough_misread_savory');
    if(missing.some(x=>ingredients.some(y=>contains(x,y)||contains(y,x))))penalize(20,'missing_duplicates_owned');
    if(proposal.intent==='construire'&&!hasRole(a,'protein')&&!missing.some(x=>/oeuf|poulet|thon|poisson|tofu|lentille|pois chiche|haricot|yaourt|skyr|feta|fromage/.test(norm(x))))penalize(15,'build_without_protein');
    return {valid:score>=72,score:Math.max(0,score),reasons};
  }

  function suggest({ingredients=[],intent='equilibre',variant=0,history=null,catalog=[]}={}){
    const owned=unique(ingredients);if(!owned.length)return null;
    const a=analyze(owned),m=mode(a),seed=hash(`${owned.map(norm).sort().join('|')}|${intent}`),culture=detectCulture(a,catalog);
    const form=chooseForm(a,m,intent,culture,variant,seed);
    const missing=completeMeal(a,m,intent,culture,owned,history,variant,seed);
    const cultural=culturalMatch(a,catalog,intent,variant);
    let title=buildTitle(a,m,form,missing,variant);
    // Only use an exact named dish as the title. A component overlap is inspiration, not identification.
    if(cultural?.exact)title=cultural.name;
    const preparation=prepFor(a,m,form,missing,intent,culture);
    const explanation=explanationFor(a,m,intent,missing,variant,seed,culture);
    const proposal={title,owned,missing,preparation,explanation,intent,family:`universal_${m}`,culture,confidence:a.confidence,recognized:a.items.map(x=>({name:x.name,roles:x.roles,traits:x.traits,category:x.category,rules:x.matchedRules})),source:cultural?.exact?'catalogue_exact':'structure_ciqual_culture',diagnostics:{mode:m,culturalMatch:cultural?{name:cultural.name,exact:cultural.exact,score:cultural.score}:null}};
    proposal.validation=validateProposal({ingredients:owned,proposal});
    return proposal;
  }

  return {suggest,classify,analyze,validateProposal,normalize:norm,mode,detectCulture,version:'2.2.0'};
});
