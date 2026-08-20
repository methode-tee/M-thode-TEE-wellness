(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded',async()=>{
    const F=window.MTFood;if(!F)return;const ctx=await F.auth();if(!ctx)return;const {sb,user}=ctx;
    const inputSection=document.getElementById('foodAdapterInput'),resultSection=document.getElementById('foodAdapterResult'),text=document.getElementById('adapterText');
    const goalsBox=document.getElementById('adapterGoals'),preview=document.getElementById('adapterPhotoPreview'),photoInput=document.getElementById('adapterPhotoInput');
    let selectedGoal='equilibre',linkedMeal=null,structuredItems=[],photoFile=null,photoPath='';
    const goalLabels={equilibre:'Équilibre',digestion:'Digestion',energie:'Énergie',prise_masse:'Nourrir & construire',perte_poids:'Retrouver de la légèreté',autre:'Sans intention particulière'};

    const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,"'");
    const lexicon=[
      [/\b(pain|baguette|bun|brioche|tortilla|wrap)\b/,'feculent'],[/\b(riz|quinoa|pates?|semoule|couscous|pomme de terre|patate|frites?)\b/,'feculent'],
      [/\b(steak|boeuf|poulet|dinde|escalope|thon|saumon|poisson|oeufs?|saucisses?|merguez|tofu|tempeh|lentilles?|pois chiches?)\b/,'protein'],
      [/\b(yaourt grec|skyr|fromage blanc|yaourt soja|lait|boisson soja)\b/,'dairy_protein'],
      [/\b(cheddar|fromage|mozzarella|emmental|parmesan|raclette)\b/,'cheese'],[/\b(bacon|lardons?|charcuterie|jambon sec|saucisson|saucisses?|merguez)\b/,'charcuterie'],
      [/\b(mayonnaise|mayo|sauce burger|sauce fromagere|creme|creme fraiche|aioli)\b/,'rich_sauce'],[/\b(ketchup|sauce barbecue|bbq|sauce sucree)\b/,'sweet_sauce'],
      [/\b(salade|tomates?|courgettes?|carottes?|brocolis?|epinards?|haricots verts|concombre|poivrons?|aubergines?|crudites?|legumes?)\b/,'vegetable'],
      [/\b(frites?|friture|pan[eé]|beignet|onions? rings?|oignons? frits?)\b/,'fried'],[/\b(soda|cola|limonade|jus|boisson sucree|energy drink)\b/,'sugary_drink'],
      [/\b(avocat|huile d'olive|huile|amandes?|noix|noix de cajou|graines?)\b/,'nuts_seeds'],[/\b(dattes?|fruit|banane|pomme|poire|orange|fruits rouges|myrtilles?)\b/,'fruit'],
      [/\b(muesli|granola|flocons? d'avoine|avoine|porridge)\b/,'wholegrain'],[/\b(miel|sirop|sucre vanille)\b/,'added_sugar'],
      [/\b(extrait de vanille|gousse de vanille|vanille en poudre|vanille)\b/,'aromatic']
    ];
    const knownPhrases=['pain brioché','steak haché','sauce burger','oignons frits','huile d\'olive','pâtes carbonara','yaourt grec','fruits rouges','pois chiches'];

    function parseMeal(raw,knowledge=[],structured=[]){
      const base=structured.length?structured.map(x=>x.food_name||x.name).filter(Boolean).join(', '):raw;
      const n=normalize(`${base} ${structured.length?raw:''}`),found=[];
      for(const [rx,cat] of lexicon){for(const m of n.matchAll(new RegExp(rx.source,'g'))){if(!found.some(x=>x.category===cat&&normalize(x.label)===m[0]))found.push({label:m[0],category:cat,source:'local'});}}
      knowledge.forEach(k=>(k.categories||[]).forEach(category=>found.push({label:k.display_name,category,source:'dictionary'})));
      knownPhrases.forEach(p=>{const pn=normalize(p);if(n.includes(pn)&&!found.some(x=>normalize(x.label)===pn)){let cat='other';for(const [rx,c] of lexicon){if(rx.test(pn)){cat=c;break;}}found.push({label:p,category:cat});}});
      const chunks=raw.split(/[,;\n+]/).map(x=>x.trim()).filter(Boolean).slice(0,16);
      const profiles=knowledge.map(k=>k.adapter_profile||{}),variable=profiles.some(x=>x.composition_variable),recognized=knowledge.length>0;
      return {normalized:n,found,chunks,knowledge,flags:Object.assign({},...profiles),confidence:recognized?(variable?'variable':'recognized'):found.length>=2?'probable':'ambiguous'};
    }

    function buildTeeSignature(raw,goal,parsed,cats){
      const n=parsed.normalized;
      const has=c=>(cats[c]||0)>0;
      const isBurger=/\b(burger|hamburger|cheeseburger|bun)\b/.test(n);
      const isPasta=/\bpates?\b|\bcarbonara\b|\bspaghetti\b|\btagliatelle\b/.test(n);
      const isPizza=/\bpizza\b/.test(n);
      const isRiceBowl=/\briz\b/.test(n)&&has('protein');
      const isSalad=/\bsalade\b/.test(n)&&has('vegetable');
      const sweetContext=['breakfast','snack'].includes(linkedMeal?.meal_type||F.qs('type'))&&((has('wholegrain')&&has('fruit'))||parsed.flags?.sweet_breakfast);
      const composite=has('composite_dish');
      const proteinCount=(cats.protein||0)+(cats.dairy_protein||0);
      let title='Le choix de Tee';
      let body='Garde le cœur de ton repas. Pour le rendre plus complet et gourmand, ajoute un élément frais ou végétal qui apporte du contraste, sans multiplier les changements.';
      if(proteinCount>=3){
        body=/oeufs?.*poulet.*saucisse|oeufs?.*saucisse.*poulet/.test(n)?"Je garderais les œufs et le pain, puis je choisirais entre le poulet pané et la saucisse pour éviter d’empiler trois sources protéinées dans le même repas. Ajoute ensuite un accompagnement végétal simple qui va avec ce que tu gardes.":"Je garderais la source protéinée principale que tu préfères, puis je choisirais parmi les autres plutôt que de toutes les empiler. L’accompagnement peut ensuite être ajusté simplement selon le moment du repas.";
      }else if(isBurger){
        body="Garde ton burger. Ajoute à côté une salade croquante avec tomates, concombre et citron, garde les frites si tu en as envie, et choisis une seule sauce que tu aimes vraiment. Tu conserves le plaisir du burger avec une assiette plus fraîche et plus équilibrée.";
        if(goal==='digestion') body="Garde ton burger, mais accompagne-le d’une salade croquante citronnée. Choisis une seule sauce plutôt légère et garde les frites en portion confortable : le repas reste gourmand, avec moins d’accumulation pour la digestion.";
        if(goal==='energie') body="Garde ton burger et tes frites. Ajoute une salade fraîche et une boisson non sucrée : tu conserves une base nourrissante et plaisante, avec davantage de fraîcheur sans alléger inutilement le repas.";
        if(goal==='prise_masse') body="Garde ton burger et sa base généreuse. Ajoute une portion de crudités ou une salade fraîche et, si besoin, renforce surtout la protéine plutôt que d’empiler fromage, bacon et sauces. Le repas reste gourmand et réellement nourrissant.";
        if(goal==='perte_poids') body="Garde ton burger tel que tu l’aimes. Ajoute une grande salade croquante, choisis une seule sauce et garde les frites en accompagnement plutôt qu’en deuxième élément central. Tu gardes le plaisir avec une assiette plus légère, sans dénaturer ce que tu avais envie de manger.";
      }else if(isPasta){
        body="Garde tes pâtes comme plat central. Ajoute une poêlée de courgettes ou champignons et une petite salade citronnée à côté ; si la sauce est riche, garde-la mais évite simplement d’ajouter une seconde source très crémeuse ou fromagée.";
      }else if(isPizza){
        body="Garde ta pizza. Accompagne-la d’une salade de roquette, tomates et citron, et évite seulement de cumuler une sauce crémeuse ou une charcuterie supplémentaire. Le contraste chaud/frais rend l’ensemble plus agréable sans toucher au plat que tu voulais.";
      }else if(isRiceBowl){
        body="Garde ta base riz + protéine. Ajoute un vrai duo de légumes — par exemple courgette et carotte, ou brocoli et poivron — puis une sauce simple citron-herbes ou yaourt-citron selon le plat. C’est l’ajustement le plus complet sans changer ta base.";
      }else if(isSalad){
        body="Garde ta salade et rends-la plus satisfaisante avec une vraie source de protéines et un élément de texture — graines, noix ou pain grillé selon tes envies. L’objectif est qu’elle reste fraîche mais aussi suffisamment nourrissante.";
      }else if(sweetContext){
        body=has('dairy_protein')?"Je garderais ce bol tel quel. La base céréales, fruits, oléagineux et protéine est déjà cohérente ; ajuste surtout les quantités selon ta faim.":"Garde ton bol tel quel. Si tu veux le rendre plus rassasiant, ajoute simplement un yaourt nature riche en protéines, un skyr ou une alternative soja adaptée.";
      }else if(composite&&parsed.flags?.composition_variable){
        body="Je garderais ce plat comme base. Sa composition peut varier selon la recette : ajuste seulement ce que tu sais réellement présent, sans lui imposer un modèle d’assiette qui ne lui correspond pas.";
      }else if(!has('vegetable')&&!parsed.flags?.do_not_auto_suggest_vegetables){
        body="Garde ton plat tel qu’il est et ajoute un accompagnement végétal précis qui va avec : légumes rôtis si le plat est chaud, crudités citronnées s’il est riche, ou une salade d’herbes si tu veux quelque chose de très léger. C’est le changement que Tee privilégierait en premier.";
      }else if(!has('protein')){
        body="Garde ton repas et ajoute une protéine qui s’accorde vraiment avec lui : œuf pour une assiette végétale, poulet ou poisson pour un bowl, tofu ou légumineuses pour une option végétale. Un seul ajout suffit.";
      }
      return {title,body};
    }

    function buildRecommendations(raw,goal,knowledge=[],structured=[]){
      const p=parseMeal(raw,knowledge,structured),cats=p.found.reduce((a,x)=>(a[x.category]=(a[x.category]||0)+1,a),{}),recs=[],why=[];
      const has=c=>(cats[c]||0)>0, count=c=>cats[c]||0;
      const add=(title,body,reason)=>{if(recs.length<3){recs.push({title,body});if(reason)why.push(reason);}};
      const sweetContext=['breakfast','snack'].includes(linkedMeal?.meal_type||F.qs('type'))&&((has('wholegrain')&&has('fruit'))||p.flags?.sweet_breakfast);
      const proteinCount=count('protein')+count('dairy_protein');
      if(proteinCount>=3)add('Éviter d’empiler les protéines','Tu as déjà plusieurs sources protéinées. Garde celles qui te font le plus envie — par exemple les œufs puis soit le poulet, soit la saucisse — sans devoir tout supprimer.','La partie protéinée est déjà largement représentée dans ce repas.');
      if(sweetContext&&!has('dairy_protein'))add('Renforcer doucement la partie protéinée','Garde ton bol tel quel. Si tu veux davantage de satiété, ajoute un yaourt nature riche en protéines, un skyr ou une alternative soja adaptée.','Ce petit-déjeuner ou cette collation contient déjà céréales, fruits et oléagineux ; seule la protéine peut éventuellement être renforcée.');
      if(!sweetContext&&!p.flags?.do_not_auto_suggest_vegetables&&!has('vegetable')&&proteinCount<3)add('Ajouter du végétal','Garde ton repas tel qu’il est et ajoute simplement un accompagnement végétal qui s’accorde avec lui.','La place des végétaux est faible dans la composition décrite.');
      if(count('charcuterie')+count('cheese')+count('rich_sauce')>=2)add('Alléger une seule source concentrée',has('charcuterie')?'Garde l’élément central du repas et retire seulement la charcuterie, ou réduis la sauce.':'Garde ton repas et réduis simplement la sauce ou une portion de fromage.','Plusieurs sources grasses ou salées sont concentrées dans le même repas.');
      if(has('sugary_drink'))add('Changer uniquement la boisson','Garde tout le reste et remplace seulement la boisson sucrée par de l’eau, une eau pétillante ou une boisson non sucrée.','La boisson est le changement le plus simple sans toucher au repas.');
      if(count('fried')>=2)add('Garder une seule friture','Choisis la friture que tu préfères et garde l’autre accompagnement plus simple.','Deux éléments frits se cumulent dans le même repas.');
      if(!has('protein')&&!has('dairy_protein')&&!sweetContext&&!has('composite_dish'))add('Renforcer la partie rassasiante','Ajoute une source de protéines qui s’accorde avec ce repas.','Aucune source protéique claire n’a été reconnue.');
      if(has('composite_dish')&&p.flags?.composition_variable&&recs.length===0)add('Ajuster seulement ce qui est certain','Ce plat est reconnu, mais sa composition varie selon la recette. Garde-le comme base et précise si besoin la protéine ou l’accompagnement réellement présents.','Les composants facultatifs du plat ne sont pas considérés comme certains.');
      if(sweetContext&&has('dairy_protein')&&recs.length===0)add('Ne change presque rien','La base céréales, fruits, oléagineux et protéine est déjà cohérente. Ajuste surtout les quantités selon ta faim.','Aucun ajout prioritaire n’est nécessaire dans ce contexte.');
      if(goal==='digestion'&&has('rich_sauce'))add('Rendre la sauce plus légère','Garde la saveur du repas mais réduis la quantité de sauce crémeuse ou remplace-la par une version yaourt, citron ou moutarde.','Ton intention du jour est le confort digestif.');
      if(goal==='prise_masse'&&has('protein')&&has('feculent'))add('Conserver la base du repas','Ta base protéines + féculent est intéressante pour ton objectif. Ajuste surtout les à-côtés plutôt que de réduire la portion centrale.','Ton intention est de nourrir et construire : on préserve la base réellement nourrissante du repas.');
      if(goal==='energie'&&!has('feculent')&&!has('fruit'))add('Ajouter une source d’énergie simple','Ajoute un féculent ou un fruit selon ton repas, sans modifier le reste.','Ton intention du jour est l’énergie.');
      if(goal==='perte_poids'&&has('fried'))add('Garder le plaisir, ajuster la portion','Garde l’élément frit que tu préfères et réduis seulement sa portion, sans transformer tout le repas.','Tu recherches davantage de légèreté aujourd’hui : on ajuste un seul élément sans rendre le repas frustrant.');
      if(recs.length===0)add('Ne change presque rien','La composition décrite paraît déjà assez simple. Garde ton repas et observe surtout ta satiété, ta digestion et ton énergie après.','Aucun déséquilibre évident n’a été détecté avec suffisamment de confiance.');
      while(recs.length<2){if(!has('vegetable'))break;add('Observer plutôt que modifier','Mange ton repas comme prévu et note simplement comment tu te sens après.','Le minimum utile est parfois de ne rien changer.');break;}
      return {parsed:p,recommendations:recs.slice(0,3),why:[...new Set(why)].slice(0,3),signature:buildTeeSignature(raw,goal,p,cats)};
    }

    function renderGoals(){goalsBox.innerHTML=Object.entries(goalLabels).map(([k,l])=>`<button type="button" class="mt-food-goal ${k===selectedGoal?'active':''}" data-goal="${k}">${l}</button>`).join('');goalsBox.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedGoal=b.dataset.goal;renderGoals();});}
    renderGoals();

    async function loadMeal(){
      const id=F.qs('meal_id');if(!id)return;
      const {data}=await sb.from('food_meals').select('id,meal_date,meal_type,description,photo_path,source_recipe_title,source_recipe_image_url').eq('id',id).eq('user_id',user.id).maybeSingle();if(!data)return;
      linkedMeal=data;text.value=data.description||data.source_recipe_title||'';photoPath=data.photo_path||'';
      if(photoPath){const url=await F.signedUrl(sb,photoPath,1800);if(url)preview.innerHTML=`<img src="${F.esc(url)}" alt="Photo du repas">`;}
      else if(data.source_recipe_image_url)preview.innerHTML=`<img src="${F.esc(data.source_recipe_image_url)}" alt="">`;
      const {data:items}=await sb.from('food_meal_items').select('food_name,ciqual_code,quantity_g').eq('meal_id',id).order('sort_order');
      structuredItems=items||[];
      if(structuredItems.length){text.value=(data.description?data.description+'\n':'')+structuredItems.map(x=>x.food_name).join(', ');}
    }

    photoInput.onchange=()=>{const f=photoInput.files?.[0];if(!f)return;photoFile=f;preview.innerHTML=`<img src="${URL.createObjectURL(f)}" alt="Aperçu">`;};

    async function analyze(){
      const raw=text.value.trim();if(raw.length<3){F.toast('Décris d’abord ton repas.');return;}
      const btn=document.getElementById('adapterAnalyze');btn.disabled=true;
      try{
        let knowledge=[];try{knowledge=await F.resolveFoodText(sb,[raw,...structuredItems.map(x=>x.food_name)].join(', '),16);}catch(e){console.warn('food dictionary fallback',e);}
        const analysis=buildRecommendations(raw,selectedGoal,knowledge,structuredItems);
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
