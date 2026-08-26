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
  const includesIngredient=(haystack,ingredient)=>{const a=norm(haystack),b=norm(ingredient);return !!b&&(a.includes(b)||b.includes(a)||words(b).some(w=>w.length>3&&a.includes(w)));};
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
    'quelques amandes concassées, facultatives':'quelques amandes concassées, si tu en as envie'
  }[String(value||'').toLocaleLowerCase('fr')]||value);
  const favoriteKey=uid=>`mt_tee_inspired_favorites_v1_${uid}`;
  const readFavorites=uid=>{try{return JSON.parse(localStorage.getItem(favoriteKey(uid))||'[]');}catch(e){return [];}};
  const writeFavorites=(uid,rows)=>{try{localStorage.setItem(favoriteKey(uid),JSON.stringify(rows.slice(0,10)));}catch(e){}};
  let user=null,intent='equilibre',ranked=[],cursor=0,current=null,currentName='',lastIngredients='';

  function inputIngredients(value){
    const prepared=String(value||'')
      .replace(/[;\n]+/g,',')
      .replace(/\s+(?:et|avec|plus)\s+/gi,',')
      // « de la semoule du poulet » devient deux ingrédients sans casser
      // « côtes d'agneau », où l'article appartient au nom de l'aliment.
      .replace(/\s+(?=(?:du|des|de la|de l['’])\s*)/gi,',')
      // Quelques successions usuelles restent compréhensibles sans article
      // ni virgule : « pâtes saucisses », « riz poulet », « semoule agneau ».
      .replace(/\b(pâtes?|riz|semoule|couscous)\s+(?=(?:saucisses?|merguez|poulet|b[œo]uf|agneau|[œo]ufs?)\b)/gi,'$1,');
    return prepared.split(',').map(x=>x.trim()
      .replace(/^(?:j['’]ai|avec)\s+/i,'')
      .replace(/^(?:de la|de l['’]|du|des|la|le|les|un|une)\s+/i,'')
      .trim()).filter(Boolean).slice(0,12);
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
    const n=norm(input),hasFruit=/framboise|myrtille|fraise|mure|cassis|fruit rouge|banane|mangue|poire|pomme|peche|ananas/.test(n);
    const hasYogurt=/yaourt grec|skyr|fromage blanc|yaourt nature|yaourt soja/.test(n);
    const hasLiquid=/lait d amande|lait de coco|boisson amande|boisson coco|lait d avoine|lait de soja|lait/.test(n);
    if(/chia/.test(n)&&/lait de coco|boisson coco/.test(n))return 'pudding';
    if(hasFruit&&hasLiquid)return 'smoothie';
    if(hasFruit&&hasYogurt)return 'verrine';
    return '';
  }
  function detectedSweetParts(input){
    const raw=inputIngredients(input),findAll=re=>raw.filter(x=>re.test(norm(x)));
    return {
      fruits:findAll(/framboise|myrtille|fraise|mure|cassis|fruit rouge|banane|mangue|poire|pomme|peche|ananas/),
      yogurt:findAll(/yaourt grec|skyr|fromage blanc|yaourt nature|yaourt soja/)[0]||'',
      liquid:findAll(/lait d amande|lait de coco|boisson amande|boisson coco|lait d avoine|lait de soja|lait/)[0]||''
    };
  }
  function neutralTitle(input,item){
    const raw=inputIngredients(input),n=norm(input);
    const shape=sweetShape(input),sweet=detectedSweetParts(input),fruitLabel=frenchList(sweet.fruits.map(x=>x.toLocaleLowerCase('fr')));
    if(shape==='smoothie')return `Smoothie ${fruitLabel||'aux fruits'}${sweet.liquid?` au ${sweet.liquid.toLocaleLowerCase('fr').replace(/^lait /,'lait ')}`:''}`;
    if(shape==='verrine')return `Verrine de ${sweet.yogurt.toLocaleLowerCase('fr')||'yaourt'} ${fruitLabel?`aux ${fruitLabel}`:'aux fruits'}`;
    if(shape==='pudding')return `Pudding coco et graines de chia${fruitLabel?` aux ${fruitLabel}`:''}`;
    const find=re=>raw.find(x=>re.test(norm(x)))||'';
    const pasta=find(/\bpate|spaghetti|tagliatelle|penne|macaroni/),rice=find(/\briz\b/),semolina=find(/semoule|couscous/);
    const lamb=find(/agneau|cotelette|cotes? d agneau/),sausage=find(/saucisse|merguez/),egg=find(/\boeufs?\b/);
    const tomato=find(/tomate/),onion=find(/oignon/),veg=find(/courgette|epinard|brocoli|poivron|carotte|aubergine|haricot|champignon|salade|concombre/);
    if(pasta&&sausage&&egg)return `Pâtes sautées aux ${sausage.toLocaleLowerCase('fr')} et œuf`;
    if(pasta&&sausage)return `Pâtes sautées aux ${sausage.toLocaleLowerCase('fr')}`;
    if(pasta)return `Pâtes composées avec ${[lamb,egg,veg,tomato].filter(Boolean).slice(0,2).join(' et ')||'tes ingrédients'}`;
    if(rice&&lamb&&tomato)return `Côtes d’agneau et riz tomaté${onion?' aux oignons':''}`;
    if(rice&&lamb)return `Côtes d’agneau et riz parfumé`;
    if(rice)return `Riz composé avec ${[sausage,egg,veg,tomato].filter(Boolean).slice(0,2).join(' et ')||'tes ingrédients'}`;
    if(semolina&&/poulet/.test(n))return `Semoule parfumée au poulet${onion?', oignons':''}${/persil/.test(n)?' et persil':''}`;
    if(semolina)return `Semoule parfumée avec ${[lamb,sausage,egg,veg,tomato].filter(Boolean).slice(0,2).join(' et ')||'tes ingrédients'}`;
    const meaningful=raw.filter(x=>norm(x).length>2).slice(0,3);
    return meaningful.length?`Assiette de ${meaningful.join(', ').replace(/, ([^,]*)$/, ' et $1')}`:(item?.display_name||item?.canonical_name||'Une assiette à composer');
  }
  function suggestionTitle(item,input){return culturalNameAllowed(item,input)?title(item):neutralTitle(input,item);}

  function isDish(item){
    const cats=categories(item),fam=family(item),known=components(item,'typical_components').length;
    return known>=2&&(cats.includes('composite dish')||cats.includes('composite_dish')||fam!=='general'||known>=3);
  }
  function score(item,input){
    const cats=categories(item),fam=family(item),typ=components(item,'typical_components'),opt=components(item,'optional_components');
    const searchable=[title(item),...(item.aliases||[]),...typ,...opt].join(' ');
    const tokens=input.split(',').flatMap(words).filter(Boolean);
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
    const n=norm(lastIngredients),hasSemolina=/semoule|couscous/.test(n),hasPasta=/pate|spaghetti|tagliatelle|penne|macaroni/.test(n),hasRice=/\briz\b/.test(n);
    const hasChicken=/poulet/.test(n),hasLamb=/agneau|cotelette/.test(n),hasSausage=/saucisse|merguez/.test(n),hasEgg=/\boeufs?\b/.test(n);
    const hasVegetable=/tomate|courgette|epinard|brocoli|poivron|carotte|aubergine|haricot|champignon|salade|concombre|legume|chou|poireau|fenouil/.test(n);
    const shape=sweetShape(lastIngredients);
    if(shape==='smoothie')return intent==='energie'?'Les fruits apportent la base glucidique du smoothie. Tee conserve le lait végétal et propose seulement un complément plus rassasiant si l’intention demande davantage d’énergie.':intent==='construire'?'Le yaourt grec apporte déjà une base protéinée et les fruits complètent la préparation. Tee renforce seulement la densité du smoothie si cela reste utile.':'Les fruits rouges, le lait végétal et le yaourt forment déjà une préparation cohérente. Tee évite tout ajout automatique lorsqu’aucun repère ne manque.';
    if(shape==='verrine')return 'Le yaourt apporte la base crémeuse et protéinée, tandis que les fruits complètent la verrine. Tee ne propose qu’une texture ou un accompagnement cohérent avec ton intention.';
    if(shape==='pudding')return 'Le lait de coco et les graines de chia donnent déjà sa structure au dessert. Les fruits servent d’accompagnement et aucun ingrédient salé n’est proposé.';
    if(hasSemolina&&hasChicken&&!hasVegetable)return 'La semoule apporte la base énergétique et le poulet la partie protéinée. Tee complète uniquement avec un légume plus consistant.';
    if(hasPasta&&hasSausage&&hasEgg&&!hasVegetable)return 'Les pâtes apportent la base énergétique, tandis que les saucisses fumées et l’œuf couvrent déjà la partie protéinée. Tee complète uniquement avec un légume pour équilibrer l’ensemble.';
    if(hasRice&&hasLamb&&hasVegetable)return 'Le riz apporte la base énergétique et l’agneau la partie protéinée. Les légumes déjà présents complètent l’accompagnement du plat.';
    const base=[];
    if(hasSemolina||hasPasta||hasRice)base.push('une base énergétique');
    if(hasChicken||hasLamb||hasSausage||hasEgg||/poisson|boeuf|tofu|lentille|pois chiche/.test(n))base.push('une partie protéinée');
    if(hasVegetable)base.push('une partie végétale');
    const observed=base.length?`Tee reconnaît déjà ${frenchList(base)} dans tes ingrédients.`:`Tee part uniquement des ingrédients que tu as renseignés pour construire cette proposition.`;
    const reasons={equilibre:'La suggestion complète seulement le repère encore utile pour former un repas plus cohérent.',digestion:'La préparation reste lisible et privilégie un ajout facile à ajuster selon ton confort.',energie:'Tee conserve la base énergétique et complète sans surcharger inutilement le plat.',construire:'La partie protéinée reste clairement identifiable et s’intègre aux ingrédients déjà présents.',legerete:'Tee privilégie une préparation simple et donne davantage de place à l’accompagnement végétal.',gourmandise:'La proposition conserve les saveurs de départ tout en les transformant en un plat complet.'};
    return `${observed} ${reasons[intent]}`;
  }
  function preparation(item,owned,missing){
    const available=inputIngredients(lastIngredients);
    const n=norm(lastIngredients);
    const shape=sweetShape(lastIngredients),sweet=detectedSweetParts(lastIngredients),extra=missing[0]?addableLabel(missing[0]):'';
    if(shape==='smoothie')return `Mixe ${frenchList([...sweet.fruits,sweet.liquid,sweet.yogurt].filter(Boolean).map(x=>x.toLocaleLowerCase('fr')))} jusqu’à obtenir une texture homogène${extra?`, puis ajoute ${extra}`:''}. Ajuste seulement la quantité de liquide selon la texture souhaitée.`;
    if(shape==='verrine')return `Dépose ${sweet.yogurt.toLocaleLowerCase('fr')||'le yaourt'} dans un verre, ajoute ${frenchList(sweet.fruits.map(x=>x.toLocaleLowerCase('fr')))||'les fruits'}, puis termine${extra?` avec ${extra}`:' sans autre ajout obligatoire'}.`;
    if(shape==='pudding')return `Mélange le lait de coco avec les graines de chia, laisse épaissir au frais, puis ajoute ${frenchList(sweet.fruits.map(x=>x.toLocaleLowerCase('fr')))||'les fruits'} au moment de servir.`;
    if(/semoule|couscous/.test(n)&&/poulet/.test(n)){
      const vegetable=addableLabel(missing[0]||'les légumes choisis');
      return `Fais revenir les oignons avec le poulet, ajoute ${vegetable}, puis sers avec la semoule et termine avec le persil frais.`;
    }
    if(/pate/.test(n)&&/saucisse|merguez/.test(n)){
      const vegetable=addableLabel(missing[0]||'les légumes choisis');
      return `Fais revenir ${vegetable} avec les saucisses, ajoute les pâtes, puis termine avec l’œuf selon la cuisson que tu préfères.`;
    }
    if(/riz/.test(n)&&/agneau|cotelette/.test(n))return `Fais dorer les côtes d’agneau avec les oignons. Prépare une base tomatée, puis sers-la avec le riz et les herbes choisies.`;
    const have=available.length?`Pars de ${available.slice(0,4).join(', ').replace(/, ([^,]*)$/, ' et $1')}.`:'Pars de tes ingrédients disponibles.';
    const add=missing.length?` Complète avec ${missing.slice(0,3).join(', ')}.`:'';
    return `${have}${add} Prépare ensuite chaque composant selon ta recette habituelle, puis assemble et assaisonne au dernier moment.`;
  }
  function renderIntents(){
    const box=document.getElementById('inspirationIntents');
    box.innerHTML=Object.entries(INTENTS).map(([key,label])=>`<button type="button" class="mt-inspire-intent${key===intent?' is-active':''}" data-intent="${key}">${esc(label)}</button>`).join('');
    box.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{intent=btn.dataset.intent;renderIntents();});
  }
  function renderFavorites(){
    const box=document.getElementById('inspirationFavorites'),rows=readFavorites(user?.id);
    box.hidden=!rows.length;if(!rows.length)return;
    box.innerHTML=`<div class="mt-food-label">Mes idées enregistrées</div>${rows.map((x,i)=>`<div class="mt-inspire-favorite-row"><div><b>${esc(x.title)}</b><small>${esc(INTENTS[x.intent]||'Inspiration')}</small></div><button type="button" data-remove="${i}" aria-label="Supprimer">Retirer</button></div>`).join('')}`;
    box.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>{rows.splice(Number(btn.dataset.remove),1);writeFavorites(user.id,rows);renderFavorites();});
  }
  function renderResult(item){
    current=item;const input=lastIngredients;currentName=suggestionTitle(item,input);
    const typ=components(item,'typical_components'),opt=components(item,'optional_components'),cultural=culturalNameAllowed(item,input);
    const owned=inputIngredients(input);
    let missing=cultural?typ.filter(x=>!includesIngredient(input,x)).slice(0,2):[];
    const n=norm(input),hasVegetable=/tomate|courgette|epinard|brocoli|poivron|carotte|aubergine|haricot|champignon|salade|concombre|legume|chou|poireau|fenouil/.test(n);
    if(!cultural){
      const shape=sweetShape(input),hasNuts=/amande|noix|noisette|pistache|graine|chia|chanvre|lin|purée d amande/.test(n),hasYogurt=/yaourt grec|skyr|fromage blanc|yaourt soja/.test(n);
      if(shape){
        if(intent==='energie'&&!/banane|avoine/.test(n))missing.push('banane ou flocons d’avoine');
        else if(intent==='construire'&&!hasNuts)missing.push(hasYogurt?'purée d’amandes ou graines de chanvre':'yaourt grec ou alternative soja');
        else if(intent==='gourmandise'&&!/vanille|coco rape|copeaux de coco/.test(n))missing.push('vanille ou copeaux de coco');
        else if(intent==='digestion'&&!/gingembre|menthe/.test(n))missing.push('menthe fraîche ou gingembre');
        else if(shape==='verrine'&&!hasNuts&&intent==='equilibre')missing.push('quelques amandes concassées, facultatives');
      }else{
        if(!hasVegetable&&['equilibre','digestion','legerete','construire'].includes(intent))missing.push(/semoule|couscous/.test(n)?'tomates ou courgettes':'courgette ou épinards');
        if(/pate|riz/.test(n)&&!/oignon/.test(n))missing.push('oignon');
        if(!missing.length&&!/persil|coriandre|basilic|menthe|herbe/.test(n))missing.push('ail ou herbes fraîches');
      }
      missing=missing.slice(0,2);
    }
    const substitute=cultural?opt.find(x=>!includesIngredient(input,x)):'';
    const box=document.getElementById('foodInspirationResult');
    box.hidden=false;box.innerHTML=`<section class="mt-food-signature"><small>Le plat imaginé par Tee · ${esc(INTENTS[intent])}</small><h2>${esc(currentName)}</h2><div class="mt-inspire-section"><b>Tu as déjà</b><p>${esc(sentence(owned))}</p></div><div class="mt-inspire-section"><b>À prévoir</b><p>${esc(missing.length?sentence(missing):'Rien de plus pour cette proposition.')}</p></div><div class="mt-inspire-section"><b>Préparation courte</b><p>${esc(preparation(item,owned,missing))}</p></div><div class="mt-inspire-section"><b>Pourquoi ce choix ?</b><p>${esc(explanation(item,owned,currentName))}</p></div>${substitute?`<div class="mt-inspire-section"><b>Alternative possible</b><p>Tu peux aussi utiliser ${esc(substitute)}, selon ce que tu as et tes préférences.</p></div>`:''}<div class="mt-inspire-actions"><button type="button" id="saveInspiredMeal">Enregistrer cette idée</button><button type="button" id="anotherInspiredMeal">Une autre idée</button><button type="button" id="editInspiredMeal">Modifier mes ingrédients</button></div></section>`;
    document.getElementById('foodInspirationInput').hidden=true;
    document.getElementById('saveInspiredMeal').onclick=saveCurrent;
    document.getElementById('anotherInspiredMeal').onclick=()=>{if(!ranked.length)return;cursor=(cursor+1)%ranked.length;renderResult(ranked[cursor].item);};
    document.getElementById('editInspiredMeal').onclick=()=>{box.hidden=true;document.getElementById('foodInspirationInput').hidden=false;document.getElementById('inspirationIngredients').focus();};
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function saveCurrent(){
    if(!current||!user)return;const rows=readFavorites(user.id),name=currentName||title(current);
    const next=[{title:name,intent,ingredients:lastIngredients,saved_at:new Date().toISOString()},...rows.filter(x=>x.title!==name)];
    writeFavorites(user.id,next);renderFavorites();window.MTFood?.toast?.('Idée enregistrée sur cet appareil.');
  }
  async function compose(){
    const field=document.getElementById('inspirationIngredients'),input=field.value.trim();
    if(words(input).length<2){window.MTFood?.toast?.('Indique au moins deux ingrédients.');field.focus();return;}
    lastIngredients=input;const btn=document.getElementById('inspirationCompose');btn.disabled=true;btn.textContent='Tee compose…';
    try{
      const catalog=await (window.mtEnsureFoodCatalog?window.mtEnsureFoodCatalog():Promise.resolve([]));
      const pool=(Array.isArray(catalog)&&catalog.some(isDish)?catalog.filter(isDish):FALLBACK);
      ranked=pool.map(x=>score(x,input)).sort((a,b)=>b.score-a.score||b.overlap-a.overlap).slice(0,18);
      if(!ranked.length)throw new Error('catalogue vide');cursor=0;renderResult(ranked[0].item);
    }catch(e){ranked=FALLBACK.map(x=>score(x,input)).sort((a,b)=>b.score-a.score);cursor=0;renderResult(ranked[0].item);}
    finally{btn.disabled=false;btn.textContent='Composer avec Tee';}
  }
  async function init(){
    const auth=await window.MTFood?.auth?.();if(!auth)return;user=auth.user;renderIntents();renderFavorites();
    document.getElementById('inspirationCompose').onclick=compose;
  }
  document.addEventListener('DOMContentLoaded',init);
})();
