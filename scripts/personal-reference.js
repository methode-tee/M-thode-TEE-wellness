// MÉTHODE TEE — V441 · Repères personnels évolutifs
// Une couche légère : le calcul part d'une estimation, puis s'affine avec les
// données réellement renseignées. Les lectures historiques restent compactes.
(function(){
  'use strict';
  if(window.MTReference)return;

  const CACHE=new Map();
  const TTL=5*60*1000;
  const today=()=>new Date().toLocaleDateString('sv-SE');
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const roundTo=(v,step=1)=>Math.round(v/step)*step;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,d=0)=>Number(v).toLocaleString('fr-FR',{maximumFractionDigits:d,minimumFractionDigits:0});

  function client(){try{return typeof initSupabase==='function'?initSupabase():window.supabaseClient||null;}catch(_){return null;}}
  async function authContext(opts={}){
    if(opts.sb&&opts.user)return {sb:opts.sb,user:opts.user};
    const sb=opts.sb||client();if(!sb)return null;
    try{const {data}=await sb.auth.getSession();const user=data?.session?.user||null;return user?{sb,user}:null;}catch(_){return null;}
  }
  async function rpc(name,args,opts={}){
    const auth=await authContext(opts);if(!auth)return null;
    const key=`${auth.user.id}:${name}:${JSON.stringify(args||{})}`;const cached=CACHE.get(key);
    if(!opts.force&&cached&&Date.now()-cached.at<TTL)return cached.data;
    try{
      const q=auth.sb.rpc(name,args||{});const result=await Promise.race([q,new Promise(resolve=>setTimeout(()=>resolve({data:null,error:{message:'timeout'}}),6500))]);
      if(result?.error){console.warn(`[Repères V441] ${name} indisponible`,result.error);return null;}
      CACHE.set(key,{at:Date.now(),data:result?.data??null});return result?.data??null;
    }catch(e){console.warn(`[Repères V441] ${name}`,e);return null;}
  }

  async function context(date=today(),opts={}){return rpc('mt_reference_context',{target_date:date},opts);}
  async function overview(mode='28d',opts={}){return rpc('mt_reference_overview',{p_mode:mode},opts);}
  async function protocol(protocolId,opts={}){if(!protocolId)return null;return rpc('mt_protocol_reference_comparison',{p_protocol_id:protocolId},opts);}
  function invalidate(){CACHE.clear();}

  function ageFromBirth(value){if(!value)return null;const d=new Date(`${value}T12:00:00`);if(Number.isNaN(d.getTime()))return null;const now=new Date();let a=now.getFullYear()-d.getFullYear();const before=now.getMonth()<d.getMonth()||(now.getMonth()===d.getMonth()&&now.getDate()<d.getDate());if(before)a--;return a>=18&&a<=100?a:null;}
  function intent(ctx){return String(ctx?.preferences?.evolution_corporelle?.body_intention||'Observer sans objectif chiffré');}
  function practice(ctx){return String(ctx?.preferences?.performance_recuperation?.level||'');}
  function activityFactor(ctx){
    const steps=n(ctx?.summary28?.avg_steps);let f=1.35;
    if(steps!==null){if(steps<4000)f=1.3;else if(steps<7000)f=1.4;else if(steps<10000)f=1.5;else if(steps<13000)f=1.6;else f=1.68;}
    const p=practice(ctx);if(/Intensive|Compétition/i.test(p))f=Math.max(f,1.62);else if(/Régulière/i.test(p))f=Math.max(f,1.48);
    return clamp(f,1.25,1.75);
  }
  function intentionFactor(label){if(/perdre.*graisse/i.test(label))return .90;if(/prise|masse/i.test(label))return 1.08;if(/recomposition/i.test(label))return 1.0;return 1.0;}
  function currentWeight(ctx){return n(ctx?.today?.weight_kg)??n(ctx?.summary28?.weight_last)??n(ctx?.summary28?.avg_weight_kg);}

  function buildModel(ctx){
    ctx=ctx||{};const profile=ctx.profile||{},s=ctx.summary28||{};
    const age=ageFromBirth(profile.birth_date),height=n(profile.height_cm),gender=String(profile.reference_gender||''),weight=currentWeight(ctx),bodyIntent=intent(ctx);
    const nutritionDays=n(s.nutrition_days)||0,documentedDays=n(s.documented_days)||0;
    let theoryMaintenance=null,observedMaintenance=null,blend=0;
    if(age&&height&&weight&&weight>=35&&weight<=250){
      const constant=gender==='masculin'?5:gender==='feminin'?-161:-78;
      const bmr=10*weight+6.25*height-5*age+constant;
      if(bmr>900&&bmr<3500)theoryMaintenance=bmr*activityFactor(ctx);
    }
    const oldW=n(s.weight_older_avg),recentW=n(s.weight_recent_avg),oldN=n(s.weight_older_count)||0,recentN=n(s.weight_recent_count)||0,avgKcal=n(s.avg_food_kcal);
    if(nutritionDays>=10&&oldN>=2&&recentN>=2&&avgKcal&&avgKcal>=900&&oldW&&recentW){
      const delta=recentW-oldW,relative=Math.abs(delta)/Math.max(oldW,1);
      if(relative<=.05){const candidate=avgKcal-(delta*7700/14);if(candidate>=1000&&candidate<=5000&&(!theoryMaintenance||candidate>=theoryMaintenance*.65&&candidate<=theoryMaintenance*1.35))observedMaintenance=candidate;}
    }
    let maintenance=theoryMaintenance;
    if(observedMaintenance){blend=theoryMaintenance?clamp(.18+(nutritionDays-10)*.018,.18,.5):1;maintenance=theoryMaintenance?theoryMaintenance*(1-blend)+observedMaintenance*blend:observedMaintenance;}
    let energy=null;
    if(maintenance){const center=maintenance*intentionFactor(bodyIntent),spread=.075;energy={low:roundTo(center*(1-spread),25),high:roundTo(center*(1+spread),25),center:roundTo(center,25),source:observedMaintenance?(theoryMaintenance?'estimé + observé':'observé'):'estimé'};}

    let protein=null;
    if(weight){let lowFactor=1.2,highFactor=1.6;if(/recomposition|perdre.*graisse|prise|masse/i.test(bodyIntent)){lowFactor=1.6;highFactor=2.0;}else if(activityFactor(ctx)>=1.58){lowFactor=1.4;highFactor=1.8;}protein={low:roundTo(weight*lowFactor,5),high:roundTo(weight*highFactor,5)};}

    const avgFiber=n(s.avg_fiber_g),avgDig=n(s.avg_digestion);let fiber={low:25,high:30,progressive:false};
    if(avgFiber!==null&&nutritionDays>=4&&avgFiber<24){const gentle=avgDig!==null&&avgDig<5;const addLow=gentle?1:2,addHigh=gentle?3:5;fiber={low:roundTo(clamp(avgFiber+addLow,15,25),1),high:roundTo(clamp(avgFiber+addHigh,18,30),1),progressive:true};if(fiber.high<=fiber.low)fiber.high=fiber.low+3;}

    const profileReady=!!(age&&height&&weight),historyStrong=documentedDays>=21&&nutritionDays>=14;
    const status=historyStrong&&profileReady?'established':(documentedDays>=10||nutritionDays>=7)?'evolving':'building';
    const confidence=clamp((profileReady?35:10)+Math.min(35,documentedDays*1.5)+Math.min(30,nutritionDays*2),10,100);
    const missing=[];if(!age)missing.push('date de naissance');if(!height)missing.push('taille');if(!weight)missing.push('poids récent');
    return {status,confidence,profileReady,missing,age,height,weight,bodyIntent,energy,protein,fiber,observedMaintenance,theoryMaintenance,blend,summary:s,today:ctx.today||{},trackerDays:ctx.tracker_days||{},context:ctx};
  }

  function statusLabel(model){return model.status==='established'?'Repère personnel établi':model.status==='evolving'?'Repère personnel évolutif':'Repère en construction';}
  function compare(value,range){if(value===null||!range)return null;if(value<range.low)return 'below';if(value>range.high)return 'above';return 'inside';}
  function dayEditorial(model,totals={}){
    const kcal=n(totals.kcal),protein=n(totals.protein),fiber=n(totals.fiber),parts=[];
    if(model.energy&&kcal!==null){const c=compare(kcal,model.energy);parts.push(c==='inside'?'Tes apports renseignés se situent dans ton repère énergétique actuel.':c==='below'?'Ta journée reste pour l’instant sous ton repère énergétique estimé.':'Ta journée se situe au-dessus de ta zone habituelle estimée : une journée isolée ne change pas ton repère.');}
    if(model.protein&&protein!==null){const c=compare(protein,model.protein);if(c==='inside')parts.push('Tes protéines sont bien représentées aujourd’hui.');else if(c==='below')parts.push('Les protéines sont le repère le plus simple à renforcer sur la suite de la journée.');}
    if(model.fiber&&fiber!==null){const c=compare(fiber,model.fiber);if(c==='below')parts.push(model.fiber.progressive?'Les fibres peuvent progresser doucement, en tenant compte de ton confort digestif.':'Les fibres pourraient prendre davantage de place dans tes repas.');}
    if(!parts.length){if(model.missing.length)return `Tes repères commencent à se construire. Complète ${model.missing.slice(0,2).join(' et ')} dans ton Profil pour affiner l’estimation.`;return 'Méthode Tee apprend ton rythme à partir de tes journées réellement renseignées.';}
    return parts.slice(0,2).join(' ');
  }

  function injectCSS(){if(document.getElementById('mtReferenceCSS'))return;const s=document.createElement('style');s.id='mtReferenceCSS';s.textContent=`
  .mt-ref-modal{position:fixed;inset:0;z-index:10050;display:none}.mt-ref-modal.open{display:block}.mt-ref-bg{position:absolute;inset:0;background:rgba(15,45,31,.28);backdrop-filter:blur(5px)}
  .mt-ref-sheet{position:absolute;left:0;right:0;bottom:0;margin:auto;max-width:720px;max-height:min(88vh,900px);overflow:auto;background:#fffaf2;border:1px solid #e4d8c3;border-radius:30px 30px 0 0;padding:18px 22px calc(28px + env(safe-area-inset-bottom));box-shadow:0 -22px 60px rgba(41,55,45,.16);color:#6f6257}
  .mt-ref-grip{width:44px;height:4px;border-radius:99px;background:#d8cdbd;margin:0 auto 14px}.mt-ref-close{position:absolute;right:18px;top:18px;border:0;background:#f3eee5;width:38px;height:38px;border-radius:50%;font-size:22px;color:#164b3f}
  .mt-ref-kicker{font-size:11px;font-weight:800;letter-spacing:.22em;color:#b08b45;text-transform:uppercase;margin-top:6px}.mt-ref-sheet h2{font-family:Georgia,serif;font-size:34px;font-weight:400;color:#164b3f;margin:8px 42px 8px 0}.mt-ref-lead{line-height:1.55;margin:0 0 18px}
  .mt-ref-state{background:#f5efe4;border-radius:18px;padding:13px 15px;margin:12px 0 18px}.mt-ref-state b{display:block;color:#21473e}.mt-ref-state small{display:block;margin-top:4px;line-height:1.4}
  .mt-ref-row{padding:16px 0;border-top:1px solid #e8ddcb}.mt-ref-row-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.mt-ref-row-head b{font-size:16px;color:#244139}.mt-ref-row-head strong{font-size:18px;color:#164b3f}.mt-ref-row p{font-size:12px;line-height:1.5;margin:7px 0 0}.mt-ref-track{height:7px;background:#eee6da;border-radius:99px;margin-top:10px;overflow:hidden}.mt-ref-track i{display:block;height:100%;background:linear-gradient(90deg,#c9ad72,#315e50);border-radius:99px}
  .mt-ref-sources{margin:16px 0 0;padding:14px;border:1px solid #e8ddcb;border-radius:18px;font-size:12px;line-height:1.5}.mt-ref-profile-link{width:100%;margin-top:14px;border:0;border-radius:999px;background:#164b3f;color:#fff;padding:13px 16px;font-weight:800;letter-spacing:.04em}
  .mt-ref-context-card{margin:14px 0;background:#f7f1e7;border-radius:18px;padding:13px 15px}.mt-ref-context-card small{display:block;color:#aa884c;font-weight:800;letter-spacing:.14em}.mt-ref-context-card p{margin:6px 0 0;line-height:1.45;color:#62574f}
  `;document.head.appendChild(s);}

  function rowHTML(label,current,range,unit,copy){if(!range)return `<div class="mt-ref-row"><div class="mt-ref-row-head"><b>${esc(label)}</b><strong>En construction</strong></div><p>${esc(copy||'Encore quelques repères sont nécessaires.')}</p></div>`;let pct=50;if(current!==null){const span=Math.max(1,range.high-range.low),outerLow=range.low-span,outerHigh=range.high+span;pct=clamp((current-outerLow)/(outerHigh-outerLow)*100,5,95);}return `<div class="mt-ref-row"><div class="mt-ref-row-head"><b>${esc(label)}</b><strong>${fmt(range.low,0)}–${fmt(range.high,0)} ${esc(unit)}</strong></div>${current!==null?`<p>Aujourd’hui : <b>${fmt(current,1)} ${esc(unit)}</b></p>`:''}<div class="mt-ref-track"><i style="width:${pct}%"></i></div><p>${esc(copy||'Zone indicative, jamais une obligation quotidienne.')}</p></div>`;}

  function openSheet(model,totals={}){injectCSS();let modal=document.getElementById('mtReferenceModal');if(!modal){modal=document.createElement('div');modal.id='mtReferenceModal';modal.className='mt-ref-modal';document.body.appendChild(modal);}const s=model.summary||{},documented=n(s.documented_days)||0,nutrition=n(s.nutrition_days)||0;const sourceCopy=model.status==='building'?`${documented} journée${documented>1?'s':''} documentée${documented>1?'s':''}. Le repère se précisera sans transformer une journée isolée en règle.`:`${documented} journées documentées sur les 28 derniers jours · ${nutrition} avec données alimentaires calculables.`;
    modal.innerHTML=`<div class="mt-ref-bg" onclick="MTReference.closeSheet()"></div><section class="mt-ref-sheet"><div class="mt-ref-grip"></div><button class="mt-ref-close" onclick="MTReference.closeSheet()">×</button><div class="mt-ref-kicker">Mes repères personnels</div><h2>Comment se situe ma journée ?</h2><p class="mt-ref-lead">Des zones estimées qui évoluent avec ton profil, ton activité et tes propres tendances — sans transformer ton Carnet en compteur rigide.</p><div class="mt-ref-state"><b>✷ ${esc(statusLabel(model))}</b><small>${esc(sourceCopy)}</small></div>${rowHTML('Énergie',n(totals.kcal),model.energy,'kcal',model.energy?.source==='estimé + observé'?'Le calcul initial est déjà nuancé par tes dernières semaines observées.':'Première estimation : elle s’affinera avec tes données comparables.')}${rowHTML('Protéines',n(totals.protein),model.protein,'g','Repère lié à ton poids récent, ton activité et ton intention actuelle.')}${rowHTML('Fibres',n(totals.fiber),model.fiber,'g',model.fiber?.progressive?'La progression est volontairement graduelle et tient compte du confort digestif renseigné.':'Repère de référence, à adapter à ta tolérance et à ta journée.')}<div class="mt-ref-sources"><b>Ce qui nourrit ce repère</b><br>Alimentation · évolution corporelle · activité/marche · sommeil · stress · digestion · cycle et autres suivis quand ils sont réellement renseignés. Une donnée absente reste absente et n’est jamais interprétée comme zéro.</div>${model.missing.length?`<button class="mt-ref-profile-link" onclick="location.href='dashboard.html'">Compléter mon profil · ${esc(model.missing.join(', '))}</button>`:''}</section>`;modal.classList.add('open');}
  function closeSheet(){document.getElementById('mtReferenceModal')?.classList.remove('open');}

  function compactSnapshot(model,line){return {status:model.status,line,energy:model.energy?{low:model.energy.low,high:model.energy.high}:null,protein:model.protein?{low:model.protein.low,high:model.protein.high}:null,fiber:model.fiber?{low:model.fiber.low,high:model.fiber.high,progressive:model.fiber.progressive}:null,documented_days:n(model.summary?.documented_days)||0,nutrition_days:n(model.summary?.nutrition_days)||0};}

  function applyMealContext(analysis,ctx,goal='equilibre'){
    if(!analysis||!ctx)return analysis;const model=buildModel(ctx),s=model.summary||{},recs=[...(analysis.recommendations||[])],why=[...(analysis.why||[])];let line='';
    const stress=n(s.avg_stress),sleep=n(s.avg_sleep_hours),dig=n(s.avg_digestion),steps=n(s.avg_steps),recentSatiety=n(s.avg_food_satiety),todayFiber=n(ctx.today?.fiber_g),todayProtein=n(ctx.today?.protein_g),recovery=n(ctx.today?.recovery)??n(s.avg_recovery),hydration=n(ctx.today?.hydration_liters)??n(s.avg_hydration_liters);
    // Les suivis du jour restent des signaux personnels, jamais des règles biologiques.
    // Exemple : l'appétit renseigné dans Cycle peut modifier le conseil sans supposer
    // qu'une phase donnée provoque systématiquement plus ou moins de faim.
    const todayHunger=n(ctx.today?.['equilibre_alimentaire.hunger'])??n(ctx.today?.['evolution_corporelle.hunger'])??n(ctx.today?.['cycle.appetite']);
    const todayBloating=n(ctx.today?.['digestion.bloating'])??n(ctx.today?.['cycle.bloating'])??n(ctx.today?.['evolution_corporelle.bloating']);
    const addFirst=(title,body,reason)=>{if(!recs.some(r=>String(r.title).toLowerCase()===title.toLowerCase()))recs.unshift({title,body});if(reason)why.unshift(reason);};
    if((stress!==null&&stress>=7)||(sleep!==null&&sleep<6.5)){
      line='Ton contexte récent montre davantage de charge ou moins de récupération : Tee privilégie aujourd’hui un repas structuré et rassasiant plutôt qu’une restriction supplémentaire.';
      if(goal==='perte_poids')addFirst('Préserver la satiété aujourd’hui','Garde une vraie source de protéines, un accompagnement qui te rassasie et ajuste seulement ce qui est réellement superflu. Une journée plus chargée n’appelle pas automatiquement une assiette plus petite.','Le conseil tient compte du sommeil / stress récemment renseigné, sans en faire une cause unique.');
    }
    if((todayHunger!==null&&todayHunger>=7)||(recentSatiety!==null&&recentSatiety<5)){
      line=line||'Ta faim ou ta satiété récemment renseignée invite à privilégier un repas vraiment structuré plutôt qu’un ajustement uniquement centré sur les calories.';
      if(goal==='perte_poids')addFirst('Construire d’abord la satiété','Conserve une source de protéines, un végétal ou un accompagnement riche en fibres bien toléré, et une portion énergétique cohérente avec ta faim. Tee évite de réduire mécaniquement l’assiette lorsque tes propres repères montrent déjà une satiété basse.','Le conseil tient compte de ta faim / satiété réellement renseignée, y compris lorsqu’elle vient d’un autre suivi du Carnet.');
    }
    if(recovery!==null&&recovery<=4){
      line=line||'Ta récupération récemment renseignée est basse : Tee évite aujourd’hui les ajustements trop restrictifs et privilégie une assiette structurée.';
      if(goal==='perte_poids')addFirst('Ne pas sur-réduire un jour de faible récupération','Garde la structure du repas et ajuste seulement ce qui est réellement superflu. Une récupération basse n’est pas une raison pour compenser par une restriction plus forte.','Le conseil tient compte de ta récupération récente, sans supposer qu’elle est causée par ton alimentation.');
    }
    if(hydration!==null&&hydration<1&& !line){
      line='Ton hydratation renseignée est encore légère aujourd’hui. Tee garde le repas simple et te rappelle seulement d’accompagner la journée d’une hydratation régulière.';
    }
    if(todayBloating!==null&&todayBloating>=7&&dig!==null&&dig<5){
      line=line||'Ton confort digestif du jour semble plus fragile : Tee privilégie des ajustements simples et progressifs plutôt qu’un empilement d’aliments.';
      if(!recs.some(r=>/digesti|tolér|cuit|progress/i.test(`${r.title} ${r.body}`)))addFirst('Garder l’ajustement digestif simple','Évite de multiplier les ajouts d’un coup. Si tu renforces les végétaux ou les fibres, choisis une option que tu tolères déjà et avance progressivement.','Le conseil relie le confort digestif et les ballonnements que tu as réellement renseignés aujourd’hui.');
    }
    if(model.fiber&&todayFiber!==null&&todayFiber<model.fiber.low){
      if(dig!==null&&dig<5){line=line||'Tes fibres restent sous ton repère progressif, mais ton confort digestif récent invite à avancer doucement.';addFirst('Faire progresser les fibres sans brusquer','Si cela convient à ce repas, préfère une petite portion de légumes cuits ou un accompagnement complet que tu tolères déjà, plutôt qu’un gros ajout brutal.','La progression des fibres est modulée par le confort digestif récemment renseigné.');}
      else {line=line||'Tes fibres sont encore sous ton repère actuel : Tee privilégie un renfort végétal cohérent avec ce repas.';if(!recs.some(r=>/fibre|végét|légume|fruit/i.test(`${r.title} ${r.body}`)))addFirst('Renforcer doucement le repère végétal','Ajoute seulement un végétal, une légumineuse ou un accompagnement complet qui appartient naturellement à ce repas.','Le Carnet montre aujourd’hui des fibres encore sous ton repère progressif.');}
    }
    if(model.protein&&todayProtein!==null&&todayProtein<model.protein.low&&!recs.some(r=>/protéin/i.test(`${r.title} ${r.body}`))){line=line||'Tes protéines sont encore sous ton repère actuel : ce repas peut être l’occasion d’en renforcer une source cohérente.';addFirst('Renforcer la protéine si elle manque réellement','Choisis une seule source protéinée cohérente avec ce plat, sans empiler plusieurs ajouts.','Le conseil s’appuie sur ton repère protéique personnel et sur ce qui est déjà renseigné aujourd’hui.');}
    if((steps!==null&&steps>=9500)&&/energie|prise_masse/.test(String(goal))&&!recs.some(r=>/énerg|fécul|riz|quinoa|pain|pomme de terre/i.test(`${r.title} ${r.body}`))){line=line||'Ton rythme de mouvement récent est soutenu : Tee évite de sous-dimensionner systématiquement l’accompagnement énergétique.';addFirst('Soutenir ton rythme de mouvement','Si ce repas est pauvre en féculent, garde une portion adaptée de riz, pommes de terre, pain ou autre base énergétique cohérente avec le plat.','Le contexte d’activité récent est plus soutenu que ton simple contenu d’assiette ne le montre.');}
    recs.splice(3);const uniqueWhy=[...new Set(why)].slice(0,3);analysis.recommendations=recs;analysis.why=uniqueWhy;analysis.personalContextLine=line||'Ce conseil tient compte de tes repères récents lorsqu’ils sont suffisamment documentés.';analysis.parsed={...(analysis.parsed||{}),personal_context:compactSnapshot(model,analysis.personalContextLine)};return analysis;
  }

  window.MTReference={context,overview,protocol,invalidate,buildModel,dayEditorial,statusLabel,openSheet,closeSheet,applyMealContext,compactSnapshot};
})();
