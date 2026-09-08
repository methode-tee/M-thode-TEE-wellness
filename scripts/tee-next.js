/* MÉTHODE TEE — V487.4 · Planification + Sécurité plantes · shell natif + chargements bornés */
(function(){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=k=>new URLSearchParams(location.search).get(k);
const tool=q('tool')||'planner';
let sb,user;
const tools=[['planner','Planifier'],['safety','Sécurité plantes']];
const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

function list(v){return String(v||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean)}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function tokens(v){return new Set(norm(v).split(' ').filter(x=>x.length>2))}
function euro(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}):''}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function withTimeout(value,ms=9000,label='Chargement'){
  return Promise.race([
    Promise.resolve(value),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} prend plus de temps que prévu.`)),ms))
  ]);
}
async function safeCall(value,ms=9000,label='Chargement'){
  try{return await withTimeout(value,ms,label)}catch(error){return {data:null,error}}
}
function showOpenError(error){
  const message=error?.message||'Impossible d’ouvrir cet outil pour le moment.';
  body(`<div class="mt-next-result is-alert"><b>Ouverture impossible</b><p>${esc(message)}</p><button type="button" class="mt-next-secondary" id="mtNextRetry">Réessayer</button></div>`);
  document.getElementById('mtNextRetry')?.addEventListener('click',()=>location.reload());
}
function ingredientIsOwned(name,pTok){
  const t=[...tokens(name)];
  return t.length>0&&t.some(x=>pTok.has(x));
}
async function auth(){
  sb=typeof initSupabase==='function'?initSupabase():null;
  if(!sb)throw Error('Connexion indisponible.');
  const {data}=await withTimeout(sb.auth.getUser(),8000,'La connexion');
  user=data?.user;
  if(!user){location.href='auth.html';throw Error('Connexion requise.')}
}
function tabs(){
  const e=document.getElementById('mtNextTabs');
  e.innerHTML=tools.map(([k,l])=>`<a class="${k===tool?'active':''}" href="tee-next.html?tool=${k}">${esc(l)}</a>`).join('');
}
function body(html){document.getElementById('mtNextBody').innerHTML=html}

async function safety(){
  body('<div class="mt-next-status">Préparation de tes garde-fous…</div>');
  const profileRes=await safeCall(sb.from('mt_phyto_user_profile').select('*').eq('user_id',user.id).maybeSingle(),8000,'Le profil plantes');
  if(profileRes?.error) throw profileRes.error;
  const f=profileRes?.data||{};
  const flags=[
    ['regular_medication','Je prends un traitement régulier'],
    ['anticoagulants','Traitement anticoagulant / antiagrégant'],
    ['sedatives','Traitement sédatif / somnifère'],
    ['hypertension','Hypertension connue'],
    ['pregnancy','Grossesse'],
    ['breastfeeding','Allaitement'],
    ['caffeine_sensitive','Sensibilité forte à la caféine'],
    ['allergy_asteraceae','Allergie connue aux Astéracées'],
    ['hormone_sensitive','Situation hormono-sensible à vérifier']
  ];
  body(`<article class="mt-next-card">
    <div class="mt-next-kicker">Sécurité phytothérapie</div>
    <h2>Vérifier avant de suggérer.</h2>
    <p>Ce profil sert uniquement de garde-fou. L’absence d’alerte ne signifie jamais qu’une plante est garantie compatible.</p>
    <div class="mt-next-grid">${flags.map(([k,l])=>`<label class="mt-next-choice"><input type="checkbox" data-phyto-flag="${k}" ${f[k]?'checked':''}><span>${esc(l)}</span></label>`).join('')}</div>
    <button class="mt-next-primary" id="mtPhytoSave">Enregistrer mes garde-fous</button>
  </article>
  <article class="mt-next-card">
    <h2>Vérifier une plante</h2>
    <div class="mt-next-field"><label>Plante</label><input id="mtPhytoPlant" placeholder="Ex. millepertuis, réglisse, sauge…"></div>
    <button class="mt-next-primary" id="mtPhytoCheck">Vérifier avec mon profil</button>
    <div id="mtPhytoResult"></div>
  </article>`);
  document.getElementById('mtPhytoSave').onclick=async()=>{
    const flags={};
    document.querySelectorAll('[data-phyto-flag]').forEach(x=>flags[x.dataset.phytoFlag]=x.checked);
    const {error}=await withTimeout(sb.rpc('mt_phyto_save_profile',{p_flags:flags}),8000,'L’enregistrement');
    if(error)alert(error.message);else alert('Garde-fous enregistrés.');
  };
  document.getElementById('mtPhytoCheck').onclick=async()=>{
    const plant=document.getElementById('mtPhytoPlant').value.trim(),box=document.getElementById('mtPhytoResult');
    if(!plant)return;
    box.innerHTML='<div class="mt-next-status">Vérification…</div>';
    const {data,error}=await withTimeout(sb.rpc('mt_phyto_safety_check',{p_plant:plant}),8000,'La vérification');
    if(error){box.innerHTML=`<div class="mt-next-result is-alert">${esc(error.message)}</div>`;return;}
    const rules=Array.isArray(data?.matches)?data.matches:[];
    box.innerHTML=`<div class="mt-next-result ${rules.length?'is-alert':'is-ok'}"><b>${esc(data?.headline||'Vérification terminée')}</b>${rules.length?rules.map(r=>`<p>${esc(r.message)}</p>`).join(''):`<p>Aucun garde-fou renseigné dans ton profil n’a déclenché de règle pour cette plante. Cela ne remplace pas une vérification professionnelle en cas de traitement, grossesse, maladie ou doute.</p>`}</div>`;
  };
}

function priceSourceLine(status){
  const total=Number(status?.price_reference_count||0);
  const rnm=Number(status?.rnm_reference_count||0);
  const manual=Number(status?.manual_reference_count||0);
  if(!total)return `<div class="mt-next-price-source is-empty"><b>Couche prix prête</b><span>Aucun prix n’a encore été importé. Tu peux déjà planifier ; les estimations apparaîtront au fur et à mesure.</span></div>`;
  return `<div class="mt-next-price-source"><b>${total} référence${total>1?'s':''} prix disponible${total>1?'s':''}</b><span>${rnm?`${rnm} RNM FranceAgriMer`:''}${rnm&&manual?' · ':''}${manual?`${manual} administrée${manual>1?'s':''} TEE`:''}</span></div>`;
}

async function planner(){
  const seedRaw=sessionStorage.getItem('mtPlannerPantrySeedV1')||'';
  if(seedRaw)sessionStorage.removeItem('mtPlannerPantrySeedV1');
  body('<div class="mt-next-status">Préparation de ta semaine…</div>');

  const [prefsRes,catalogRes,priceRes]=await Promise.all([
    safeCall(sb.from('mt_planner_preferences').select('*').eq('user_id',user.id).maybeSingle(),8000,'Tes préférences'),
    safeCall(sb.rpc('mt_planner_recipe_catalog'),9000,'Tes recettes'),
    safeCall(sb.rpc('mt_price_status_v1'),6000,'Les repères de prix')
  ]);
  if(catalogRes?.error) throw catalogRes.error;

  const prefs=prefsRes?.error?null:prefsRes?.data;
  const catalog=catalogRes?.data;
  const priceStatus=priceRes?.error?null:priceRes?.data;
  const p=prefs||{},rows=Array.isArray(catalog)?catalog:[];
  const seedTerms=list(seedRaw);
  const pantryInitial=[...new Set([...(seedTerms||[]),...(p.pantry_terms||[])])];

  body(`<article class="mt-next-card">
    <div class="mt-next-kicker">Planification adaptative</div>
    <h2>Partir de la vraie vie.</h2>
    <p>TEE réutilise tes recettes, ton placard et les prix que nous avons réellement documentés. Aucun menu n’est généré par une API externe.</p>
    ${priceSourceLine(priceStatus||{})}
    <div class="mt-next-field"><label>Ce que j’ai déjà</label><textarea id="mtPlanPantry" placeholder="saumon, riz, courgettes…">${esc(pantryInitial.join(', '))}</textarea></div>
    <div class="mt-next-field"><label>Je ne veux pas</label><input id="mtPlanExclude" value="${esc((p.excluded_terms||[]).join(', '))}" placeholder="œufs, porc…"></div>
    <div class="mt-next-grid">
      <div class="mt-next-field"><label>Budget indicatif semaine</label><input id="mtPlanBudget" type="number" min="0" step="1" value="${esc(p.weekly_budget_eur??45)}"></div>
      <div class="mt-next-field"><label>Personnes</label><input id="mtPlanServings" type="number" min="1" max="8" value="${esc(p.servings||1)}"></div>
    </div>
    <div class="mt-next-grid">
      <div class="mt-next-field"><label>Restaurant</label><select id="mtPlanRestaurant"><option value="">Aucun jour prévu</option>${DAYS.map((d,i)=>`<option value="${i}" ${String(p.restaurant_day??'')===String(i)?'selected':''}>${d}</option>`).join('')}</select></div>
      <label class="mt-next-choice" style="margin-top:28px"><input id="mtPlanLeftovers" type="checkbox" ${p.use_leftovers!==false?'checked':''}><span>Réutiliser les restes</span></label>
    </div>
    <button class="mt-next-primary" id="mtPlanGo">Construire ma semaine</button>
    <p class="mt-next-mini">Les montants sont des estimations de référence. RNM est utilisé au stade détail quand il est disponible ; les aliments sans prix restent signalés au lieu d’être inventés.</p>
  </article><section id="mtPlanResult"></section>`);

  document.getElementById('mtPlanGo').onclick=async()=>{
    const result=document.getElementById('mtPlanResult');
    result.innerHTML='<div class="mt-next-status">TEE organise ta semaine…</div>';
    try{

    const pantry=list(document.getElementById('mtPlanPantry').value);
    const exclude=list(document.getElementById('mtPlanExclude').value);
    const budget=Number(document.getElementById('mtPlanBudget').value)||0;
    const servings=Math.max(1,Math.min(8,Number(document.getElementById('mtPlanServings').value)||1));
    const restaurant=document.getElementById('mtPlanRestaurant').value;
    const leftovers=document.getElementById('mtPlanLeftovers').checked;

    const prefSave=await withTimeout(sb.from('mt_planner_preferences').upsert({
      user_id:user.id,pantry_terms:pantry,excluded_terms:exclude,
      weekly_budget_eur:budget||null,servings,
      restaurant_day:restaurant===''?null:Number(restaurant),
      use_leftovers:leftovers,updated_at:new Date().toISOString()
    }),8000,'L’enregistrement de ta planification');
    if(prefSave?.error)throw prefSave.error;

    const pTok=tokens(pantry.join(' ')),eTok=[...tokens(exclude.join(' '))];

    let candidates=rows.map(r=>{
      const ing=Array.isArray(r.ingredients)?r.ingredients:[];
      const all=norm([r.title,r.subtitle,...ing].join(' '));
      if(eTok.some(x=>all.includes(x)))return null;
      let have=0;
      ing.forEach(i=>{if(ingredientIsOwned(i,pTok))have++});
      const missing=ing.filter(i=>!ingredientIsOwned(i,pTok));
      let score=have*5-missing.length*(budget&&budget<=50?1.1:.45)+(r.meal_type==='dinner'?1:0);
      if(!ing.length)score-=8;
      return {...r,_baseScore:score,_score:score,_missing:missing,_price:null,_missingPriceItems:[]};
    }).filter(Boolean).sort((a,b)=>b._score-a._score);

    // Prix uniquement sur les meilleurs candidats : pas de requête lourde au chargement du Profil.
    const priceIds=candidates.slice(0,45).map(x=>x.recipe_id);
    if(priceIds.length){
      try{
        const {data:priced,error:priceErr}=await withTimeout(sb.rpc('mt_recipe_cost_batch_v1',{
          p_recipe_ids:priceIds,p_servings:servings,p_country:'FR',p_region:null
        }),10000,'Le calcul des prix');
        if(priceErr)throw priceErr;
        const priceMap=new Map((priced||[]).map(x=>[x.recipe_id,x.cost]));
        candidates=candidates.map(r=>{
          const price=priceMap.get(r.recipe_id)||null;
          const items=Array.isArray(price?.items)?price.items:[];
          const missingItems=items.filter(i=>!ingredientIsOwned(i.ingredient_name,pTok));
          const known=missingItems.filter(i=>num(i.cost_eur)!==null);
          const missingCost=known.reduce((s,i)=>s+Number(i.cost_eur),0);
          const missCount=missingItems.length;
          const coverage=missCount?Math.round(known.length/missCount*100):100;
          const availableDays=restaurant===''?7:6;
          const target=budget>0?budget/Math.max(1,availableDays):0;
          let pricePenalty=0;
          if(target&&known.length){
            const ratio=missingCost/target;
            pricePenalty=Math.max(0,ratio-0.55)*3.8;
            if(ratio<0.55)pricePenalty-=0.7;
          }
          return {...r,_price:price,_missingPriceItems:missingItems,_missingDocumentedCost:missingCost,_missingPriceCoverage:coverage,_score:r._baseScore-pricePenalty};
        }).sort((a,b)=>b._score-a._score);
      }catch(e){console.warn('[TEE planner] prix indisponibles, plan sans coût',e);}
    }

    const plan=[],used=new Map();
    for(let i=0;i<7;i++){
      if(String(i)===String(restaurant)){plan.push({day:DAYS[i],restaurant:true});continue;}
      if(leftovers&&i>0&&plan[i-1]?.recipe&&!plan[i-1].leftover&&(budget<=55||i%3===1)){
        plan.push({day:DAYS[i],recipe:plan[i-1].recipe,leftover:true});
        continue;
      }
      const pick=candidates.find(r=>(used.get(r.recipe_id)||0)<2)||candidates[0];
      if(pick){
        used.set(pick.recipe_id,(used.get(pick.recipe_id)||0)+1);
        plan.push({day:DAYS[i],recipe:pick});
      }else plan.push({day:DAYS[i]});
    }

    const shop=new Map();
    let pricedOccurrences=0,totalOccurrences=0,totalDocumented=0;
    plan.forEach(day=>{
      if(!day.recipe)return;
      const items=Array.isArray(day.recipe._price?.items)?day.recipe._price.items:[];
      if(items.length){
        items.forEach(i=>{
          if(ingredientIsOwned(i.ingredient_name,pTok))return;
          totalOccurrences++;
          const key=norm(i.ingredient_name)||String(i.ingredient_name);
          const prev=shop.get(key)||{name:i.ingredient_name,quantity_g:0,cost_eur:0,priced:false,source:i.source_label||'',occurrences:0};
          prev.quantity_g+=Number(i.quantity_g)||0;
          prev.occurrences++;
          if(num(i.cost_eur)!==null){
            prev.cost_eur+=Number(i.cost_eur);
            prev.priced=true;
            pricedOccurrences++;
            totalDocumented+=Number(i.cost_eur);
          }
          if(!prev.source&&i.source_label)prev.source=i.source_label;
          shop.set(key,prev);
        });
      }else{
        (day.recipe._missing||[]).forEach(name=>{
          totalOccurrences++;
          const key=norm(name)||name;
          const prev=shop.get(key)||{name,quantity_g:0,cost_eur:0,priced:false,source:'',occurrences:0};
          prev.occurrences++;
          shop.set(key,prev);
        });
      }
    });

    const coverage=totalOccurrences?Math.round(pricedOccurrences/totalOccurrences*100):100;
    const shopRows=[...shop.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    const complete=totalOccurrences>0&&coverage===100;
    const budgetState=complete&&budget>0
      ?(totalDocumented<=budget?'Dans ton budget indicatif':'Au-dessus du budget indicatif')
      :'Budget à confirmer';
    const costLabel=totalOccurrences
      ?(pricedOccurrences?`${euro(totalDocumented)} ${complete?'estimés':'documentés'}`:'Prix encore à documenter')
      :'Aucun achat structuré détecté';

    result.innerHTML=`<article class="mt-next-card">
      <div class="mt-next-kicker">Ta semaine</div>
      <h2>Une base qui s’adapte.</h2>
      <div class="mt-next-budget-summary">
        <div><small>Achats à prévoir</small><b>${esc(costLabel)}</b></div>
        <div><small>Couverture prix</small><b>${coverage}%</b></div>
        ${budget?`<div><small>Repère budget</small><b>${esc(budgetState)}</b></div>`:''}
      </div>
      ${plan.map(x=>`<div class="mt-next-plan-day">
        <small>${x.day}</small>
        <b>${x.restaurant?'Restaurant · journée libre':x.recipe?`${x.leftover?'Restes · ':''}${esc(x.recipe.title)}`:'Repas libre'}</b>
        ${x.recipe?`<span class="mt-next-mini">${x.recipe._missingDocumentedCost?`≈ ${euro(x.recipe._missingDocumentedCost)} d’ingrédients manquants documentés`:x.recipe._missing.length?`${x.recipe._missing.length} ingrédient(s) à prévoir`:'Priorité au placard'}</span>`:''}
      </div>`).join('')}
      ${coverage<100&&totalOccurrences?`<p class="mt-next-mini">Le total est partiel : ${100-coverage}% des occurrences d’ingrédients n’ont pas encore de prix exploitable. TEE ne les remplace pas par zéro.</p>`:''}
    </article>
    <article class="mt-next-card">
      <h2>À prévoir</h2>
      <div class="mt-next-shopping mt-next-shopping-priced">${shopRows.length?shopRows.map(x=>`<span>
        <b>${esc(x.name)}</b>
        <small>${x.quantity_g?`${Math.round(x.quantity_g)} g · `:''}${x.priced?`≈ ${euro(x.cost_eur)}`:'prix à compléter'}${x.source?` · ${esc(x.source)}`:''}</small>
      </span>`).join(''):'<p>Rien de structuré à ajouter depuis les recettes sélectionnées.</p>'}</div>
    </article>`;
    }catch(e){
      result.innerHTML=`<div class="mt-next-result is-alert"><b>Planification interrompue</b><p>${esc(e?.message||'Impossible de construire la semaine pour le moment.')}</p><button type="button" class="mt-next-secondary" onclick="location.reload()">Réessayer</button></div>`;
    }
  };
}

async function init(){
  try{
    tabs();
    await auth();
    await (({planner,safety}[tool]||planner)());
  }catch(e){
    showOpenError(e);
  }
}
document.addEventListener('DOMContentLoaded',init);
})();