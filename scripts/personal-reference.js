// MÉTHODE TEE — V442 · Repères personnels évolutifs sécurisés
// Estimation adulte + contexte observé. Aucune donnée inconnue n'est convertie en zéro.
(function(){
  'use strict';
  if(window.MTReference)return;

  const CACHE=new Map();
  const TTL=5*60*1000;
  const today=()=>new Date().toLocaleDateString('sv-SE');
  const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
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
      const q=auth.sb.rpc(name,args||{});
      const result=await Promise.race([q,new Promise(resolve=>setTimeout(()=>resolve({data:null,error:{message:'timeout'}}),6500))]);
      if(result?.error){console.warn(`[Repères V442] ${name} indisponible`,result.error);return null;}
      CACHE.set(key,{at:Date.now(),data:result?.data??null});return result?.data??null;
    }catch(e){console.warn(`[Repères V442] ${name}`,e);return null;}
  }

  async function context(date=today(),opts={}){return rpc('mt_reference_context',{target_date:date},opts);}
  async function overview(mode='28d',opts={}){return rpc('mt_reference_overview',{p_mode:mode},opts);}
  async function protocol(protocolId,opts={}){if(!protocolId)return null;return rpc('mt_protocol_reference_comparison',{p_protocol_id:protocolId},opts);}
  function invalidate(){CACHE.clear();}

  function birthInfo(value){
    if(!value)return {age:null,valid:false,isMinor:false,isAdult:false};
    const d=new Date(`${value}T12:00:00`);if(Number.isNaN(d.getTime()))return {age:null,valid:false,isMinor:false,isAdult:false};
    const now=new Date();let age=now.getFullYear()-d.getFullYear();
    const before=now.getMonth()<d.getMonth()||(now.getMonth()===d.getMonth()&&now.getDate()<d.getDate());if(before)age--;
    if(age<0||age>120)return {age:null,valid:false,isMinor:false,isAdult:false};
    return {age,valid:true,isMinor:age<18,isAdult:age>=18};
  }
  function profileSettings(ctx){const v=ctx?.profile?.settings;return v&&typeof v==='object'?v:{};}
  function intent(ctx){
    const tracker=String(ctx?.preferences?.evolution_corporelle?.body_intention||'').trim();
    if(tracker)return tracker;
    return String(profileSettings(ctx).body_intention||'Observer sans objectif chiffré');
  }
  function practice(ctx){return String(ctx?.preferences?.performance_recuperation?.level||'');}
  function currentWeight(ctx){
    return n(ctx?.today?.weight_kg)??n(ctx?.summary28?.weight_last)??n(ctx?.profile?.reference_weight_kg)??n(ctx?.summary28?.avg_weight_kg);
  }
  function declaredActivity(ctx){
    const s=profileSettings(ctx),main=String(s.activity_main||''),commute=String(s.activity_commute||''),sport=String(s.sport_frequency||''),duration=String(s.sport_duration||'');
    const has=!!(main||commute||sport||duration);if(!has)return null;
    const mainScore={seated:0,standing:1,mobile:2,physical:3}[main]??0;
    const commuteScore={motorized:0,some_walk:1,active:2}[commute]??0;
    const sportScore={none:0,occasional:0.5,'1_2':1,'3_4':2,'5_plus':3}[sport]??0;
    const durationScore={'lt30':0,'30_60':0.5,'60_plus':1}[duration]??0;
    const score=mainScore+commuteScore+sportScore+durationScore;
    const pal=score<=1.5?1.4:score<=4?1.6:score<=6.5?1.8:2.0;
    const labels={1.4:'Peu actif',1.6:'Modérément actif',1.8:'Actif',2:'Très actif'};
    return {pal,label:labels[pal]||'À préciser',source:'déclaré'};
  }
  function observedActivity(ctx){
    const s=ctx?.summary28||{},steps=n(s.avg_steps),stepsDays=n(s.steps_days)||Math.max(n(ctx?.tracker_days?.pas_marche)||0,n(ctx?.tracker_days?.performance_recuperation)||0);
    if(steps===null||stepsDays<7)return null;
    let pal=steps<4500?1.4:steps<8000?1.6:steps<12000?1.8:2.0;
    const p=practice(ctx);if(/Intensive|Compétition/i.test(p))pal=Math.max(pal,1.8);else if(/Régulière/i.test(p))pal=Math.max(pal,1.6);
    return {pal,days:stepsDays,source:'observé'};
  }
  function activityProfile(ctx){
    const declared=declaredActivity(ctx),observed=observedActivity(ctx);
    if(declared&&observed){
      const center=clamp(declared.pal*.45+observed.pal*.55,1.4,2.0);
      return {low:clamp(center-.08,1.35,2),high:clamp(center+.08,1.4,2),center,label:'Rythme affiné',source:'déclaré + observé',declared,observed,known:true};
    }
    if(observed){const center=observed.pal;return {low:clamp(center-.08,1.35,2),high:clamp(center+.08,1.4,2),center,label:'Rythme observé',source:'observé',observed,known:true};}
    if(declared){const center=declared.pal;return {low:clamp(center-.05,1.35,2),high:clamp(center+.05,1.4,2),center,label:declared.label,source:'déclaré',declared,known:true};}
    return {low:1.4,high:1.6,center:1.5,label:'À préciser',source:'provisoire',known:false};
  }
  function intentionFactor(label){if(/perdre.*graisse/i.test(label))return .90;if(/prise|masse/i.test(label))return 1.08;return 1.0;}

  function buildModel(ctx){
    ctx=ctx||{};const profile=ctx.profile||{},s=ctx.summary28||{},birth=birthInfo(profile.birth_date);
    const age=birth.age,height=n(profile.height_cm),referenceSex=String(profile.reference_sex||''),weight=currentWeight(ctx),bodyIntent=intent(ctx),activity=activityProfile(ctx);
    const nutritionDays=n(s.nutrition_days)||0,recalibrationDays=n(s.recalibration_days)||0,documentedDays=n(s.documented_days)||0;
    const bmi=height&&weight?weight/Math.pow(height/100,2):null;
    const adultEligible=birth.isAdult;
    let theoryMaintenance=null,theoryLow=null,theoryHigh=null,observedMaintenance=null,blend=0;

    if(adultEligible&&height&&weight&&weight>=35&&weight<=250){
      const base=10*weight+6.25*height-5*age;
      let bmrLow,bmrHigh;
      if(referenceSex==='male'){bmrLow=bmrHigh=base+5;}
      else if(referenceSex==='female'){bmrLow=bmrHigh=base-161;}
      else {bmrLow=base-161;bmrHigh=base+5;}
      if(bmrLow>700&&bmrHigh<3600){
        theoryLow=bmrLow*activity.low;
        theoryHigh=bmrHigh*activity.high;
        theoryMaintenance=(theoryLow+theoryHigh)/2;
      }
    }

    const oldW=n(s.weight_older_avg),recentW=n(s.weight_recent_avg),oldN=n(s.weight_older_count)||0,recentN=n(s.weight_recent_count)||0,avgKcal=n(s.avg_food_kcal_recalibration);
    // Recalibrage strict : adulte + estimation théorique existante + >=10 journées
    // complètes/éligibles + tendances corporelles répétées. L'observé ne crée jamais
    // à lui seul un besoin calorique si le profil de base n'est pas admissible.
    if(adultEligible&&theoryMaintenance&&recalibrationDays>=10&&oldN>=3&&recentN>=3&&avgKcal&&avgKcal>=900&&oldW&&recentW){
      const delta=recentW-oldW,relative=Math.abs(delta)/Math.max(oldW,1);
      if(relative<=.03&&Math.abs(delta)<=2){
        const candidate=avgKcal-(delta*7700/14);
        if(candidate>=1000&&candidate<=5000&&candidate>=theoryMaintenance*.80&&candidate<=theoryMaintenance*1.20)observedMaintenance=candidate;
      }
    }

    let maintenance=theoryMaintenance;
    if(observedMaintenance&&theoryMaintenance){
      blend=clamp(.12+(recalibrationDays-10)*.012,.12,.35);
      maintenance=theoryMaintenance*(1-blend)+observedMaintenance*blend;
    }

    let energy=null;
    if(maintenance&&theoryLow&&theoryHigh){
      const factor=intentionFactor(bodyIntent),center=maintenance*factor;
      const baseLow=theoryLow*factor,baseHigh=theoryHigh*factor;
      const uncertainty=Math.max(.075,(baseHigh-baseLow)/(Math.max(center,1)*2));
      energy={low:roundTo(center*(1-uncertainty),25),high:roundTo(center*(1+uncertainty),25),center:roundTo(center,25),source:observedMaintenance?'estimé + observé':referenceSex?'estimé':'provisoire',activity};
    }

    let protein=null;
    if(adultEligible&&weight){
      let lowFactor=1.2,highFactor=1.6;
      if(/recomposition|perdre.*graisse|prise|masse/i.test(bodyIntent)){lowFactor=1.6;highFactor=2.0;}
      else if(activity.center>=1.75){lowFactor=1.4;highFactor=1.8;}
      protein={low:roundTo(weight*lowFactor,5),high:roundTo(weight*highFactor,5)};
    }

    let fiber=null;
    if(adultEligible){
      const avgFiber=n(s.avg_fiber_g),avgDig=n(s.avg_digestion);fiber={low:25,high:30,progressive:false};
      if(avgFiber!==null&&nutritionDays>=4&&avgFiber<24){const gentle=avgDig!==null&&avgDig<5,addLow=gentle?1:2,addHigh=gentle?3:5;fiber={low:roundTo(clamp(avgFiber+addLow,15,25),1),high:roundTo(clamp(avgFiber+addHigh,18,30),1),progressive:true};if(fiber.high<=fiber.low)fiber.high=fiber.low+3;}
    }

    const profileReady=!!(adultEligible&&age&&height&&weight),historyStrong=documentedDays>=21&&recalibrationDays>=10;
    let status=birth.isMinor?'minor':historyStrong&&profileReady?'established':(documentedDays>=10||nutritionDays>=7)?'evolving':'building';
    const confidence=birth.isMinor?0:clamp((profileReady?35:10)+Math.min(35,documentedDays*1.5)+Math.min(30,recalibrationDays*2.2),10,100);
    const missing=[];
    if(!birth.valid)missing.push('date de naissance');
    if(!height)missing.push('taille');
    if(!weight)missing.push('poids actuel');
    if(!activity.known)missing.push('rythme quotidien');
    const activeProtocols=Array.isArray(ctx.active_protocols)?ctx.active_protocols:[];
    const nutritionContext={today:{kcal:n(ctx.today?.food_kcal),protein_g:n(ctx.today?.protein_g),fiber_g:n(ctx.today?.fiber_g),fat_g:n(ctx.today?.fat_g),carbs_g:n(ctx.today?.carbs_g),salt_g:n(ctx.today?.salt_g),sugars_g:n(ctx.today?.sugars_g),saturated_fat_g:n(ctx.today?.saturated_fat_g),omega3_g:n(ctx.today?.omega3_g),micronutrient_coverage_count:n(ctx.today?.micronutrient_coverage_count)},recent:{kcal:n(s.avg_food_kcal),protein_g:n(s.avg_protein_g),fiber_g:n(s.avg_fiber_g),fat_g:n(s.avg_fat_g),carbs_g:n(s.avg_carbs_g),salt_g:n(s.avg_salt_g),sugars_g:n(s.avg_sugars_g),saturated_fat_g:n(s.avg_saturated_fat_g),omega3_g:n(s.avg_omega3_g)}};
    const beverageContext={today:{count:n(ctx.today?.beverage_count),hydration_liters:n(ctx.today?.beverage_hydration_liters),energy:n(ctx.today?.beverage_energy),digestion:n(ctx.today?.beverage_digestion)},recent:{count:n(s.avg_beverage_count),energy:n(s.avg_beverage_energy),digestion:n(s.avg_beverage_digestion)}};
    return {status,confidence,profileReady,missing,age,isMinor:birth.isMinor,adultEligible,height,weight,bmi,bmiAdultEligible:adultEligible,referenceSex,bodyIntent,activity,energy,protein,fiber,observedMaintenance,theoryMaintenance,blend,summary:s,today:ctx.today||{},trackerDays:ctx.tracker_days||{},context:ctx,recalibrationDays,nutritionDays,activeProtocols,nutritionContext,beverageContext};
  }

  function statusLabel(model){if(model.status==='minor')return 'Repères adultes non calculés';return model.status==='established'?'Repère personnel établi':model.status==='evolving'?'Repère personnel évolutif':'Repère en construction';}
  function compare(value,range){if(value===null||!range)return null;if(value<range.low)return 'below';if(value>range.high)return 'above';return 'inside';}
  function dayEditorial(model,totals={}){
    if(model.isMinor)return 'Les repères énergétiques adultes ne sont pas calculés pour ce profil. Ton Carnet reste disponible sans interprétation calorique personnalisée.';
    const kcal=n(totals.kcal),protein=n(totals.protein),fiber=n(totals.fiber),parts=[];
    const coverage=totals.coverage||{},mealCount=n(totals.mealCount)||0,calc=n(totals.calculatedMeals)||0;
    const anyKnown=coverage.kcal||coverage.protein||coverage.fiber;
    if(!anyKnown||calc===0)return 'Tes repas sont enregistrés, mais leurs valeurs nutritionnelles ne sont pas assez connues pour les comparer à tes repères. Une donnée inconnue reste inconnue, jamais zéro.';
    if(totals.nutritionState==='partial')return 'Certaines valeurs nutritionnelles sont encore partielles. Méthode Tee les affiche sans conclure que tu es sous ou au-dessus d’un repère.';
    const enoughForLow=mealCount>=2&&calc>=2;
    if(model.energy&&kcal!==null&&coverage.kcal){const c=compare(kcal,model.energy);if(c==='inside')parts.push('Tes apports renseignés se situent dans ton repère énergétique actuel.');else if(c==='above')parts.push('Ta journée se situe au-dessus de ta zone habituelle estimée : une journée isolée ne change pas ton repère.');else if(enoughForLow)parts.push('Tes apports renseignés restent pour l’instant sous ton repère énergétique estimé.');}
    if(model.protein&&protein!==null&&coverage.protein){const c=compare(protein,model.protein);if(c==='inside')parts.push('Tes protéines sont bien représentées aujourd’hui.');else if(c==='below'&&enoughForLow)parts.push('Les protéines peuvent encore être renforcées sur la suite de la journée, si cela correspond à tes repas.');}
    if(model.fiber&&fiber!==null&&coverage.fiber){const c=compare(fiber,model.fiber);if(c==='below'&&enoughForLow)parts.push(model.fiber.progressive?'Les fibres peuvent progresser doucement, en tenant compte de ton confort digestif.':'Les fibres pourraient prendre davantage de place dans tes repas.');}
    if(!parts.length){if(mealCount<2)return 'Ton repère du jour se précisera avec la suite de tes repas. Méthode Tee évite d’interpréter une seule saisie comme une journée complète.';if(model.missing.length)return `Tes repères commencent à se construire. Complète ${model.missing.slice(0,2).join(' et ')} dans Mon profil pour affiner l’estimation.`;return 'Méthode Tee apprend ton rythme à partir de tes journées réellement renseignées.';}
    return parts.slice(0,2).join(' ');
  }

  function injectCSS(){if(document.getElementById('mtReferenceCSS'))return;const s=document.createElement('style');s.id='mtReferenceCSS';s.textContent=`
  .mt-ref-modal{position:fixed;inset:0;z-index:10050;display:none}.mt-ref-modal.open{display:block}.mt-ref-bg{position:absolute;inset:0;background:rgba(15,45,31,.28);backdrop-filter:blur(5px)}
  .mt-ref-sheet{position:absolute;left:0;right:0;bottom:0;margin:auto;max-width:720px;max-height:min(calc(100dvh - max(16px, env(safe-area-inset-top))),900px);overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#fffaf2;border:1px solid #e4d8c3;border-radius:30px 30px 0 0;padding:18px 22px calc(28px + env(safe-area-inset-bottom));box-shadow:0 -22px 60px rgba(41,55,45,.16);color:#6f6257}
  .mt-ref-grip{width:44px;height:4px;border-radius:99px;background:#d8cdbd;margin:0 auto 14px}.mt-ref-close{position:absolute;right:18px;top:18px;border:0;background:#f3eee5;width:38px;height:38px;border-radius:50%;font-size:22px;color:#164b3f}
  .mt-ref-kicker{font-size:11px;font-weight:800;letter-spacing:.22em;color:#b08b45;text-transform:uppercase;margin-top:6px}.mt-ref-sheet h2{font-family:Georgia,serif;font-size:34px;font-weight:400;color:#164b3f;margin:8px 42px 8px 0}.mt-ref-lead{line-height:1.55;margin:0 0 18px}
  .mt-ref-state{background:#f5efe4;border-radius:18px;padding:13px 15px;margin:12px 0 18px}.mt-ref-state b{display:block;color:#21473e}.mt-ref-state small{display:block;margin-top:4px;line-height:1.4}
  .mt-ref-row{padding:16px 0;border-top:1px solid #e8ddcb}.mt-ref-row-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.mt-ref-row-head b{color:#23483f}.mt-ref-row-head strong{color:#164b3f}.mt-ref-row p{font-size:13px;line-height:1.45;margin:7px 0 0}.mt-ref-track{height:7px;background:#e9e0d2;border-radius:99px;margin:10px 0 4px;overflow:hidden}.mt-ref-track i{display:block;height:100%;background:#164b3f;border-radius:99px}.mt-ref-sources{font-size:12px;line-height:1.5;padding:14px;border-radius:16px;background:#f8f3ea;margin-top:14px}.mt-ref-profile-link{width:100%;border:1px solid #d5b66b;background:transparent;color:#164b3f;border-radius:999px;padding:13px;margin-top:14px;font-weight:800}
  `;document.head.appendChild(s);}

  function rowHTML(label,current,range,unit,copy,available=true){
    if(!range)return `<div class="mt-ref-row"><div class="mt-ref-row-head"><b>${esc(label)}</b><strong>En construction</strong></div><p>${esc(copy||'Encore quelques repères sont nécessaires.')}</p></div>`;
    let pct=50;if(current!==null&&available){const span=Math.max(1,range.high-range.low),outerLow=range.low-span,outerHigh=range.high+span;pct=clamp((current-outerLow)/(outerHigh-outerLow)*100,5,95);}
    return `<div class="mt-ref-row"><div class="mt-ref-row-head"><b>${esc(label)}</b><strong>${fmt(range.low,0)}–${fmt(range.high,0)} ${esc(unit)}</strong></div>${current!==null&&available?`<p>Aujourd’hui : <b>${fmt(current,1)} ${esc(unit)}</b></p>`:`<p>Valeur du jour insuffisamment documentée pour être comparée.</p>`}<div class="mt-ref-track">${current!==null&&available?`<i style="width:${pct}%"></i>`:''}</div><p>${esc(copy||'Zone indicative, jamais une obligation quotidienne.')}</p></div>`;
  }

  function openSheet(model,totals={}){
    injectCSS();let modal=document.getElementById('mtReferenceModal');if(!modal){modal=document.createElement('div');modal.id='mtReferenceModal';modal.className='mt-ref-modal';document.body.appendChild(modal);}
    const s=model.summary||{},documented=n(s.documented_days)||0,nutrition=n(s.nutrition_days)||0,recal=n(s.recalibration_days)||0,coverage=totals.coverage||{};
    const sourceCopy=model.isMinor?'Les formules énergétiques adultes restent désactivées pour ce profil.':model.status==='building'?`${documented} journée${documented>1?'s':''} documentée${documented>1?'s':''}. Le repère se précisera sans transformer une journée isolée en règle.`:`${documented} journées documentées sur 28 jours · ${nutrition} avec données nutritionnelles connues · ${recal} suffisamment complètes pour un éventuel recalibrage.`;
    const activityCopy=model.activity?.source==='provisoire'?'Ton niveau d’activité est encore provisoire. Complète Mon profil pour resserrer la fourchette.':`Niveau d’activité utilisé : ${model.activity?.label||'personnalisé'} · ${model.activity?.source||'estimé'}. Les calories d’Apple Santé ne sont pas ajoutées une seconde fois.`;
    modal.innerHTML=`<div class="mt-ref-bg" onclick="MTReference.closeSheet()"></div><section class="mt-ref-sheet"><div class="mt-ref-grip"></div><button class="mt-ref-close" onclick="MTReference.closeSheet()">×</button><div class="mt-ref-kicker">Mes repères personnels</div><h2>Comment se situe ma journée ?</h2><p class="mt-ref-lead">Des zones estimées qui évoluent avec ton profil, ton activité et tes propres tendances — sans transformer ton Carnet en compteur rigide.</p><div class="mt-ref-state"><b>✷ ${esc(statusLabel(model))}</b><small>${esc(sourceCopy)}</small></div>${model.isMinor?'':`${rowHTML('Énergie',n(totals.kcal),model.energy,'kcal',model.energy?.source==='estimé + observé'?'Le calcul initial est légèrement nuancé par plusieurs journées comparables et une évolution corporelle répétée.':activityCopy,!!coverage.kcal)}${rowHTML('Protéines',n(totals.protein),model.protein,'g','Repère lié au poids récent, au contexte adulte, à l’activité et à l’intention actuelle.',!!coverage.protein)}${rowHTML('Fibres',n(totals.fiber),model.fiber,'g',model.fiber?.progressive?'La progression est volontairement graduelle et tient compte du confort digestif renseigné.':'Repère de référence, à adapter à la tolérance et à la journée.',!!coverage.fiber)}`}<div class="mt-ref-sources"><b>Ce qui nourrit ce repère</b><br>Profil de départ · alimentation · évolution corporelle · activité/marche · sommeil · stress · digestion · cycle et autres suivis quand ils sont réellement renseignés. Une donnée absente reste absente et n’est jamais interprétée comme zéro.</div>${model.missing.length&&!model.isMinor?`<button class="mt-ref-profile-link" onclick="location.href='dashboard.html?open=profile'">Compléter Mon profil · ${esc(model.missing.join(', '))}</button>`:''}</section>`;
    modal.classList.add('open');
  }
  function openPendingSheet(totals={},opts={}){
    injectCSS();let modal=document.getElementById('mtReferenceModal');if(!modal){modal=document.createElement('div');modal.id='mtReferenceModal';modal.className='mt-ref-modal';document.body.appendChild(modal);}
    const coverage=totals.coverage||{},current=(label,key,unit)=>{
      const value=n(totals[key]);
      return `<div class="mt-ref-row"><div class="mt-ref-row-head"><b>${esc(label)}</b><strong>Repère en mise à jour</strong></div><p>${value!==null&&coverage[key==='kcal'?'kcal':key]?`Aujourd’hui : <b>${fmt(value,1)} ${esc(unit)}</b>`:'Valeur du jour non comparée tant que le repère personnel n’est pas disponible.'}</p></div>`;
    };
    const message=opts.message||'Tes repères personnels ne répondent pas encore. Ton résumé de journée reste disponible et aucune valeur inconnue n’est interprétée comme zéro.';
    modal.innerHTML=`<div class="mt-ref-bg"></div><section class="mt-ref-sheet"><div class="mt-ref-grip"></div><button class="mt-ref-close" type="button">×</button><div class="mt-ref-kicker">Mes repères personnels</div><h2>Comment se situe ma journée ?</h2><p class="mt-ref-lead">${esc(message)}</p><div class="mt-ref-state"><b>✷ Repères en mise à jour</b><small>Le moteur ne produit aucun verdict tant que les données nécessaires ne sont pas disponibles.</small></div>${current('Énergie','kcal','kcal')}${current('Protéines','protein','g')}${current('Fibres','fiber','g')}<div class="mt-ref-sources"><b>Ce qui nourrit ce repère</b><br>Profil de départ · alimentation · évolution corporelle · activité/marche · sommeil · stress · digestion · cycle et autres suivis réellement renseignés.</div><button type="button" class="mt-ref-profile-link mt-ref-retry">Réessayer maintenant</button><button type="button" class="mt-ref-profile-link mt-ref-open-profile">Ouvrir Mon profil</button></section>`;
    modal.classList.add('open');
    modal.querySelector('.mt-ref-bg').onclick=closeSheet;
    modal.querySelector('.mt-ref-close').onclick=closeSheet;
    modal.querySelector('.mt-ref-open-profile').onclick=()=>{location.href='dashboard.html?open=profile';};
    modal.querySelector('.mt-ref-retry').onclick=()=>{if(typeof opts.onRetry==='function')opts.onRetry();};
  }
  function closeSheet(){document.getElementById('mtReferenceModal')?.classList.remove('open');}

  function compactSnapshot(model,line){return {status:model.status,line,energy:model.energy?{low:model.energy.low,high:model.energy.high}:null,protein:model.protein?{low:model.protein.low,high:model.protein.high}:null,fiber:model.fiber?{low:model.fiber.low,high:model.fiber.high,progressive:model.fiber.progressive}:null,documented_days:n(model.summary?.documented_days)||0,nutrition_days:n(model.summary?.nutrition_days)||0,recalibration_days:n(model.summary?.recalibration_days)||0};}

  function applyMealContext(analysis,ctx,goal='equilibre'){
    if(!analysis||!ctx)return analysis;
    const model=buildModel(ctx),s=model.summary||{},baseRecs=[...(analysis.recommendations||[])].slice(0,3),recs=[...baseRecs],baseWhy=[...(analysis.why||[])],contextWhy=[];let line='';
    const stress=n(s.avg_stress),sleep=n(s.avg_sleep_hours),dig=n(s.avg_digestion),steps=n(s.avg_steps),recentSatiety=n(s.avg_food_satiety),todayFiber=n(ctx.today?.fiber_g),todayProtein=n(ctx.today?.protein_g),recovery=n(ctx.today?.recovery)??n(s.avg_recovery),hydration=n(ctx.today?.hydration_liters)??n(s.avg_hydration_liters);
    const todayHunger=n(ctx.today?.['equilibre_alimentaire.hunger'])??n(ctx.today?.['evolution_corporelle.hunger'])??n(ctx.today?.['cycle.appetite']);
    const todayBloating=n(ctx.today?.['digestion.bloating'])??n(ctx.today?.['cycle.bloating'])??n(ctx.today?.['evolution_corporelle.bloating']);
    const prioritize=rx=>{const i=recs.findIndex(r=>rx.test(`${r.title||''} ${r.body||''}`));if(i>0){const [hit]=recs.splice(i,1);recs.unshift(hit);return true;}return i===0;};
    const deprioritize=rx=>{const i=recs.findIndex(r=>rx.test(`${r.title||''} ${r.body||''}`));if(i>=0&&i<recs.length-1){const [hit]=recs.splice(i,1);recs.push(hit);return true;}return i>=0;};

    // Le contexte personnel réordonne au maximum les propositions culinaires du moteur.
    // Il ne les remplace plus par trois conseils généraux.
    if((stress!==null&&stress>=7)||(sleep!==null&&sleep<6.5)){
      line='Ton contexte récent montre davantage de charge ou moins de récupération : Tee garde les propositions propres à ton repas et évite aujourd’hui de prioriser une restriction supplémentaire.';
      if(goal==='perte_poids')deprioritize(/réduire|retirer|diminuer|alléger|supprimer/i);
      contextWhy.push('Le contexte récent de sommeil / stress nuance l’ordre des propositions sans effacer l’identité culinaire du repas.');
    }
    if((todayHunger!==null&&todayHunger>=7)||(recentSatiety!==null&&recentSatiety<5)){
      line=line||'Ta faim ou ta satiété récemment renseignée invite à privilégier, parmi les propositions du repas, celles qui soutiennent sa structure et sa satiété.';
      prioritize(/protéin|fibre|végét|fécul|accompagnement|structure|sati/i);
      contextWhy.push('La faim / satiété réellement renseignée peut faire remonter une proposition déjà adaptée au plat, sans en inventer une nouvelle.');
    }
    if(recovery!==null&&recovery<=4){
      line=line||'Ta récupération récemment renseignée est basse : Tee conserve les ajustements culinaires précis et évite de faire passer une réduction générale en priorité.';
      if(goal==='perte_poids')deprioritize(/réduire|retirer|diminuer|alléger|supprimer/i);
      contextWhy.push('La récupération récente sert de contexte, sans être présentée comme une cause alimentaire.');
    }
    if(todayBloating!==null&&todayBloating>=7&&dig!==null&&dig<5){
      line=line||'Ton confort digestif du jour semble plus fragile : si une proposition du repas est plus simple ou progressive, Tee la fait passer devant.';
      prioritize(/digesti|tolér|cuit|progress|simple/i);
      contextWhy.push('Le confort digestif et les ballonnements réellement renseignés modulent la priorité, pas le contenu culinaire de base.');
    }
    if(model.fiber&&todayFiber!==null&&todayFiber<model.fiber.low){
      if(prioritize(/fibre|végét|légume|fruit|légumineuse|complet/i)){line=line||'Tes fibres sont sous ton repère actuel : Tee met en avant l’option végétale déjà cohérente avec ce repas.';contextWhy.push('Le repère fibres influence l’ordre seulement lorsqu’une proposition compatible avec le plat existe déjà.');}
    }
    if(model.protein&&todayProtein!==null&&todayProtein<model.protein.low){
      if(prioritize(/protéin|œuf|oeuf|poisson|poulet|tofu|yaourt|skyr|légumineuse/i)){line=line||'Tes protéines sont sous ton repère actuel : Tee priorise la proposition protéinée déjà cohérente avec ce plat.';contextWhy.push('Le repère protéique ne remplace pas les propositions culinaires : il peut seulement en faire remonter une pertinente.');}
    }
    if(steps!==null&&steps>=9500&&/energie|prise_masse/.test(String(goal))){
      if(prioritize(/fécul|riz|quinoa|pain|pomme de terre|énerg|accompagnement/i)){line=line||'Ton rythme de mouvement récent est soutenu : Tee fait remonter l’accompagnement énergétique déjà adapté au repas.';contextWhy.push('L’activité récente affine la priorité sans additionner les calories d’Apple Santé au besoin théorique.');}
    }
    // V446 : un protocole EN COURS peut seulement réordonner une proposition culinaire
    // déjà pertinente. Il ne fabrique pas de règle alimentaire et n'efface jamais le moteur du repas.
    const protocolText=model.activeProtocols.map(p=>`${p.title||''} ${p.slug||''}`).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(protocolText){
      if(/stop sucre|sucre/.test(protocolText)&&prioritize(/sucre|sucré|dessert|boisson sucrée/i)){line=line||'Ton protocole en cours fait remonter l’option déjà pertinente autour du sucre, sans transformer les sucres totaux en sucres ajoutés.';contextWhy.push('Le protocole actif peut réordonner une proposition compatible, jamais inventer une restriction.');}
      else if(/ventre|digest|reflux|aigreur|estomac/.test(protocolText)&&prioritize(/digesti|tolér|cuit|progress|simple|sauce/i)){line=line||'Ton protocole digestif en cours fait remonter l’ajustement le plus simple déjà cohérent avec ce repas.';contextWhy.push('Le protocole actif contextualise l’ordre des propositions sans attribuer une cause alimentaire.');}
      else if(/recomposition|definition|prise de masse|masse saine|silhouette/.test(protocolText)&&prioritize(/protéin|structure|fécul|accompagnement/i)){line=line||'Ton protocole corporel en cours fait remonter une proposition de structure déjà adaptée au repas.';contextWhy.push('Le protocole actif oriente la priorité sans transformer le poids ou les calories en note.');}
      else if(/sommeil|stress|anxi|cortisol/.test(protocolText)&&goal==='perte_poids'){deprioritize(/réduire|retirer|diminuer|alléger|supprimer/i);line=line||'Ton protocole de récupération en cours reste un contexte : Tee évite aujourd’hui de placer une restriction générale devant les propositions propres au repas.';}
    }
    if(hydration!==null&&hydration<1&&!line)line='Ton hydratation renseignée est encore légère aujourd’hui. Les propositions culinaires restent inchangées ; ce signal reste simplement visible dans ton contexte.';

    const uniqueWhy=[...new Set([...baseWhy.slice(0,2),...contextWhy.slice(0,1)])].slice(0,3);
    analysis.recommendations=recs.slice(0,3);
    analysis.why=uniqueWhy.length?uniqueWhy:baseWhy.slice(0,3);
    analysis.personalContextLine=line||'Ce conseil garde la précision du moteur alimentaire et utilise tes repères récents seulement lorsqu’ils sont suffisamment documentés.';
    analysis.parsed={...(analysis.parsed||{}),personal_context:compactSnapshot(model,analysis.personalContextLine)};
    return analysis;
  }

  window.MTReference={context,overview,protocol,invalidate,buildModel,dayEditorial,statusLabel,openSheet,openPendingSheet,closeSheet,applyMealContext,compactSnapshot,activityProfile,birthInfo};
})();
