(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded',async()=>{
    const F=window.MTFood; if(!F)return;
    const ctx=await F.auth(); if(!ctx)return;
    const {sb,user}=ctx;
    const initial=F.qs('date')||F.today();
    let currentDate=initial,currentMeals=[];

    const list=document.getElementById('foodMealsList');
    const summary=document.getElementById('foodDaySummary');
    const history=document.getElementById('foodHistory');
    const label=document.getElementById('foodDayLabel');
    const next=document.getElementById('foodNextDay');
    const beverages=document.getElementById('foodBeveragesList');

    const typeMeta={
      breakfast:{label:'Petit-déjeuner',time:'08:30'},
      lunch:{label:'Déjeuner',time:'13:00'},
      snack:{label:'Collation',time:'16:30'},
      dinner:{label:'Dîner',time:'20:00'}
    };

    const shiftDate=(iso,days)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);return d.toLocaleDateString('sv-SE');};
    const compact=n=>Number(n).toLocaleString('fr-FR',{maximumFractionDigits:1});

    async function mealImage(meal){
      if(meal.photo_path)return await F.signedUrl(sb,meal.photo_path,1800);
      return meal.source_recipe_image_url||'';
    }

    async function loadDay(){
      label.textContent=currentDate===F.today()?'Aujourd’hui · '+F.fmtDate(currentDate):F.fmtDate(currentDate);
      next.disabled=currentDate>=F.today(); next.style.opacity=next.disabled?'.3':'1';
      list.innerHTML='<div class="mt-food-loading">Lecture de ta journée…</div>';
      summary.hidden=true;
      const {data,error}=await sb.from('food_meals')
        .select('id,meal_date,meal_type,meal_time,description,photo_path,source_recipe_id,source_recipe_title,source_recipe_image_url,kcal_total,protein_total,fat_total,carbs_total,fiber_total,salt_total,nutrition_extra_total,satiety_after,digestion_after,energy_after,created_at,food_meal_items(id),food_adaptations!food_adaptations_meal_id_fkey(id,status,goal,decided_at,created_at)')
        .eq('user_id',user.id).eq('meal_date',currentDate).order('meal_time',{ascending:true});
      if(error){console.warn('food day read',error);list.innerHTML='<div class="empty-card"><h2>Ton carnet alimentaire est prêt</h2><p>Exécute d’abord la migration V331 dans Supabase pour activer l’enregistrement.</p></div>';return;}
      const meals=data||[];currentMeals=meals;
      const hasNutrition=(meal)=>Array.isArray(meal?.food_meal_items)&&meal.food_meal_items.length>0&&meal.kcal_total!==null&&meal.kcal_total!==undefined&&Number(meal.kcal_total)>0;
      const cards=[];
      for(const type of F.mealOrder){
        const meta=typeMeta[type];
        const typeMeals=meals.filter(m=>m.meal_type===type);
        if(!typeMeals.length){
          cards.push(`<article class="mt-food-meal-card is-empty no-image"><div class="mt-food-meal-body"><div class="mt-food-meal-top"><b>${meta.label}</b><time>${meta.time}</time></div><p>Non renseigné</p><button class="mt-food-empty-add" onclick="location.href='food-meal.html?date=${currentDate}&type=${type}'">+ Ajouter</button></div></article>`);
          continue;
        }
        for(const m of typeMeals){
          const img=await mealImage(m);
          const desc=m.source_recipe_title||m.description||'Repas renseigné';
          const calculated=hasNutrition(m);
          const metaParts=calculated
            ? [[m.kcal_total,'kcal'],[m.protein_total,'P',' g'],[m.fiber_total,'Fibres',' g']].map(([value,label,unit=''])=>value===null||value===undefined?`${label} non renseigné`:(label==='kcal'?`${compact(value)} kcal`:`${label} ${compact(value)}${unit}`))
            : ['Repères non calculés'];
          const mediaClass=img?'has-image':'no-image';
          const adopted=(Array.isArray(m.food_adaptations)?m.food_adaptations:[]).filter(a=>a.status==='adopted').sort((a,b)=>new Date(b.decided_at||b.created_at||0)-new Date(a.decided_at||a.created_at||0))[0]||null;
          const adaptedMark=adopted?`<div class="mt-food-adopted-mark"><span>✶ Ajustement adopté</span><a href="food-adapter.html?adaptation_id=${encodeURIComponent(adopted.id)}">Revoir</a></div>`:'';
          cards.push(`<article class="mt-food-meal-card ${mediaClass}">${img?`<img class="mt-food-meal-img" src="${F.esc(img)}" alt="" loading="lazy" decoding="async">`:''}<div class="mt-food-meal-body"><div class="mt-food-meal-top"><b>${meta.label}</b><time>${F.esc((m.meal_time||meta.time).slice(0,5))}</time></div><p>${F.esc(desc)}</p><div class="mt-food-meal-meta ${calculated?'':'is-uncomputed'}">${metaParts.map(value=>`<span>${F.esc(value)}</span>`).join('')}</div>${adaptedMark}<div class="mt-food-card-actions"><button onclick="location.href='food-meal.html?meal_id=${m.id}'">Modifier</button>${calculated?`<button class="mt-food-detail-btn" type="button" data-nutrition-meal="${F.esc(m.id)}">Détail nutritionnel</button>`:''}<button onclick="location.href='food-adapter.html?meal_id=${m.id}'">Adapter ce repas</button></div></div></article>`);
        }
      }
      list.innerHTML=cards.join('');
      list.querySelectorAll('[data-nutrition-meal]').forEach(btn=>btn.onclick=()=>openNutritionDetail(btn.dataset.nutritionMeal));
      const summaryData=renderSummary(meals,hasNutrition);
      if(summaryData) void renderPersonalReference(summaryData);
      await loadBeverages();
    }

    async function loadBeverages(){
      if(!beverages)return;
      document.getElementById('foodAddBeverage').href=`beverage.html?date=${encodeURIComponent(currentDate)}`;
      const {data,error}=await sb.from('user_beverage_entries').select('id,display_name,beverage_kind,volume_ml,consumed_at,composition_known').eq('user_id',user.id).eq('entry_date',currentDate).order('consumed_at',{ascending:true});
      if(error){beverages.innerHTML='<p class="mt-food-muted">Les boissons seront disponibles après l’installation de la bibliothèque.</p>';return;}
      const rows=data||[];
      beverages.innerHTML=rows.length?rows.map(row=>`<a class="mt-food-beverage-row" href="beverage.html?id=${encodeURIComponent(row.id)}&date=${encodeURIComponent(currentDate)}"><span><b>${F.esc(row.display_name)}</b><small>${F.esc(new Date(row.consumed_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}))}${row.volume_ml?` · ${Number(row.volume_ml)} ml`:''}</small></span><i>›</i></a>`).join(''):'<p class="mt-food-muted">Aucune boisson renseignée.</p>';
    }

    function renderSummary(meals,hasNutrition){
      if(!meals.length){summary.hidden=true;return;}
      const calculatedMeals=meals.filter(hasNutrition),keys=['kcal_total','protein_total','fat_total','carbs_total','fiber_total'];
      const totals={},knownCounts={};keys.forEach(key=>{const known=calculatedMeals.map(m=>m[key]).filter(value=>value!==null&&value!==undefined&&value!=='');knownCounts[key]=known.length;totals[key]=known.length?known.reduce((sum,value)=>sum+Number(value),0):null;});
      const nutritionState=!calculatedMeals.length?'none':calculatedMeals.length===meals.length?'full':'partial';
      const metric=(key,unit,label)=>{
        const value=totals[key],known=knownCounts[key]||0;if(value===null)return `<div><b>—</b><small>${label} · non renseigné</small></div>`;
        return `<div><b>${compact(value)}${unit}</b><small>${label}${known<calculatedMeals.length?' · partiel':''}</small></div>`;
      };
      const avg=(key)=>{const a=meals.map(m=>Number(m[key])).filter(n=>n>0);return a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:null;};
      const f=[['Énergie',avg('energy_after')],['Digestion',avg('digestion_after')],['Satiété',avg('satiety_after')]].filter(x=>x[1]!=null);
      let note=meals.length>=3?'Tes repas sont bien renseignés aujourd’hui. Observe surtout comment ton énergie, ta digestion et ta satiété évoluent.':`Tu as renseigné ${meals.length} repas aujourd’hui. Ton résumé se précisera au fil de la journée.`;
      if(nutritionState==='none')note+=' Les repères nutritionnels apparaîtront lorsque tu ajouteras au moins un aliment au repas.';
      else if(nutritionState==='partial')note+=` Repères nutritionnels partiels : ${calculatedMeals.length} repas sur ${meals.length} comporte${calculatedMeals.length>1?'nt':''} des aliments renseignés.`;
      summary.innerHTML=`<h2>Résumé de ma journée</h2><div class="mt-food-summary-grid">${metric('kcal_total','','kcal')}${metric('protein_total',' g','Protéines')}${metric('fiber_total',' g','Fibres')}<div><b>${meals.length}</b><small>Repas renseignés</small></div></div>${f.length?`<div class="mt-food-feeling-summary">${f.map(([k,v])=>`<span>${k} · ${v}/10</span>`).join('')}</div>`:''}<p class="mt-food-summary-note">${F.esc(note)}</p><button type="button" class="mt-food-nutrition-detail-link" id="foodNutritionDetail">Voir le détail nutritionnel <span>›</span></button><div class="mt-food-personal-reference" id="foodPersonalReference" hidden></div>`;
      summary.hidden=false;
      const nutritionButton=document.getElementById('foodNutritionDetail');if(nutritionButton)nutritionButton.onclick=()=>openNutritionDetail();
      return {
        kcal:totals.kcal_total,protein:totals.protein_total,fiber:totals.fiber_total,
        mealCount:meals.length,calculatedMeals:calculatedMeals.length,nutritionState,
        coverage:{
          kcal:meals.length>0&&knownCounts.kcal_total===meals.length,
          protein:meals.length>0&&knownCounts.protein_total===meals.length,
          fiber:meals.length>0&&knownCounts.fiber_total===meals.length
        }
      };
    }

    async function renderPersonalReference(totals,opts={}){
      const host=document.getElementById('foodPersonalReference');if(!host)return;
      // Le repère évolutif décrit le présent. Les journées passées gardent leur
      // résumé historique sans lancer une nouvelle lecture serveur.
      if(currentDate!==F.today()){host.hidden=true;return;}

      const refreshAndOpen=async(message='Tes repères personnels se mettent à jour. Ton résumé de journée reste disponible pendant ce temps.')=>{
        // Le premier tap doit toujours produire une réaction visible. On ouvre le sheet
        // immédiatement, puis on tente la vraie lecture en arrière-plan.
        if(window.MTReference?.openPendingSheet){
          window.MTReference.openPendingSheet(totals,{message,onRetry:()=>refreshAndOpen(message)});
        }
        if(!window.MTReference){location.href='dashboard.html?open=profile';return;}
        try{
          const fresh=await window.MTReference.context(currentDate,{sb,user,force:true});
          if(!fresh||currentDate!==String(fresh.date||currentDate))return;
          const model=window.MTReference.buildModel(fresh),copy=window.MTReference.dayEditorial(model,totals),linkLabel=model.status==='building'?'Voir mes repères estimés':'Voir mes repères personnels';
          host.innerHTML=`<div class="mt-food-ref-kicker">Mes repères personnels</div><h3>Comment se situe ma journée ?</h3><p>${F.esc(copy)}</p><button type="button" class="mt-food-ref-link">${F.esc(linkLabel)} <span>›</span></button>`;
          host.hidden=false;
          host.querySelector('.mt-food-ref-link').onclick=()=>window.MTReference.openSheet(model,totals);
          window.MTReference.openSheet(model,totals);
        }catch(e){console.warn('personal reference refresh',e);}
      };
      const showFallback=(message='Tes repères personnels se mettent à jour. Ton résumé de journée reste disponible pendant ce temps.')=>{
        host.innerHTML=`<div class="mt-food-ref-kicker">Mes repères personnels</div><h3>Comment se situe ma journée ?</h3><p>${F.esc(message)}</p><button type="button" class="mt-food-ref-link">Voir mes repères <span>›</span></button>`;
        host.hidden=false;
        host.querySelector('.mt-food-ref-link').onclick=()=>refreshAndOpen(message);
      };

      // Une indisponibilité temporaire du moteur ne doit plus faire disparaître
      // silencieusement l'entrée « Mes repères personnels ».
      if(!window.MTReference){showFallback();return;}
      try{
        const ctx=await window.MTReference.context(currentDate,{sb,user,force:!!opts.force});
        if(!ctx||currentDate!==String(ctx.date||currentDate)){showFallback();return;}
        const model=window.MTReference.buildModel(ctx),copy=window.MTReference.dayEditorial(model,totals),linkLabel=model.status==='building'?'Voir mes repères estimés':'Voir mes repères personnels';
        host.innerHTML=`<div class="mt-food-ref-kicker">Mes repères personnels</div><h3>Comment se situe ma journée ?</h3><p>${F.esc(copy)}</p><button type="button" class="mt-food-ref-link">${F.esc(linkLabel)} <span>›</span></button>`;
        host.hidden=false;
        host.querySelector('.mt-food-ref-link').onclick=()=>window.MTReference.openSheet(model,totals);
      }catch(e){console.warn('personal reference',e);showFallback();}
    }

    const EXTRA_LABELS={
      sugars_g:['Sucres','g'],saturated_fat_g:['Graisses saturées','g'],sodium_g:['Sodium','g'],trans_fat_g:['Acides gras trans','g'],
      monounsaturated_fat_g:['Graisses mono-insaturées','g'],polyunsaturated_fat_g:['Graisses poly-insaturées','g'],starch_g:['Amidon','g'],
      polyols_g:['Polyols','g'],cholesterol_g:['Cholestérol','g'],alcohol_g:['Alcool','g'],omega3_g:['Oméga-3','g'],omega6_g:['Oméga-6','g'],energy_kj:['Énergie','kJ']
    };
    const MICRO_LABELS={iron_mg:['Fer','mg'],calcium_mg:['Calcium','mg'],zinc_mg:['Zinc','mg'],iodine_ug:['Iode','µg'],magnesium_mg:['Magnésium','mg'],phosphorus_mg:['Phosphore','mg'],potassium_mg:['Potassium','mg'],selenium_ug:['Sélénium','µg'],vitamin_b1_mg:['Vitamine B1','mg'],vitamin_b2_mg:['Vitamine B2','mg'],vitamin_b3_mg:['Vitamine B3','mg'],vitamin_b6_mg:['Vitamine B6','mg'],vitamin_b9_ug:['Vitamine B9','µg'],vitamin_b12_ug:['Vitamine B12','µg'],vitamin_c_mg:['Vitamine C','mg'],vitamin_d_ug:['Vitamine D','µg'],vitamin_e_mg:['Vitamine E','mg'],omega3_g:['Oméga-3','g']};
    const extraValue=(obj,key)=>{const raw=obj?.[key];if(raw===null||raw===undefined)return null;const value=Number(raw?.value??raw);return Number.isFinite(value)?value:null;};
    const detailFmt=(value,unit)=>{if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';const d=Math.abs(Number(value))<10?2:1;return `${Number(value).toLocaleString('fr-FR',{maximumFractionDigits:d})}${unit?` ${unit}`:''}`;};
    function ensureNutritionModal(){
      let modal=document.getElementById('mtNutritionDetailModal');if(modal)return modal;
      modal=document.createElement('div');modal.id='mtNutritionDetailModal';modal.className='mt-nutrition-modal';document.body.appendChild(modal);return modal;
    }
    function closeNutritionDetail(){document.getElementById('mtNutritionDetailModal')?.classList.remove('open');}
    function nutritionMetric(label,value,unit,state='known'){
      const display=state==='known'?detailFmt(value,unit):state==='partial'?'Données partielles':'Non documenté';
      return `<div class="mt-nutrition-metric ${state!=='known'?'is-muted':''}"><span>${F.esc(label)}</span><b>${F.esc(display)}</b></div>`;
    }
    function completenessFor(meals,key,kind='field'){
      const rows=meals.filter(m=>Array.isArray(m?.food_meal_items)&&m.food_meal_items.length>0);if(!rows.length)return {state:'unknown',value:null};
      const vals=rows.map(m=>kind==='extra'?extraValue(m.nutrition_extra_total,key):(m[key]===null||m[key]===undefined||m[key]===''?null:Number(m[key])));
      const known=vals.filter(v=>v!==null&&Number.isFinite(Number(v)));
      if(!known.length)return {state:'unknown',value:null};
      if(known.length!==rows.length)return {state:'partial',value:null};
      return {state:'known',value:known.reduce((a,b)=>a+Number(b),0)};
    }
    async function openNutritionDetail(mealId=null){
      const modal=ensureNutritionModal();modal.innerHTML=`<div class="mt-nutrition-bg"></div><section class="mt-nutrition-sheet"><div class="mt-nutrition-grip"></div><button type="button" class="mt-nutrition-close">×</button><div class="mt-nutrition-kicker">Carnet nutritionnel</div><h2>${mealId?'Détail de ce repas':'Détail de ma journée'}</h2><p class="mt-nutrition-lead">Seules les valeurs réellement documentées sont affichées. Une donnée absente reste inconnue, jamais zéro.</p><div class="mt-nutrition-loading">Lecture des données nutritionnelles…</div></section>`;modal.classList.add('open');modal.querySelector('.mt-nutrition-bg').onclick=closeNutritionDetail;modal.querySelector('.mt-nutrition-close').onclick=closeNutritionDetail;
      try{
        let meals=mealId?currentMeals.filter(m=>String(m.id)===String(mealId)):currentMeals;
        if(mealId&&!meals.length){const {data}=await sb.from('food_meals').select('id,meal_date,meal_type,kcal_total,protein_total,fat_total,carbs_total,fiber_total,salt_total,nutrition_extra_total,food_meal_items(id)').eq('user_id',user.id).eq('id',mealId).maybeSingle();meals=data?[data]:[];}
        const base=[['Énergie','kcal_total','kcal'],['Protéines','protein_total','g'],['Glucides','carbs_total','g'],['Lipides','fat_total','g'],['Fibres','fiber_total','g'],['Sel','salt_total','g']];
        const macroHTML=base.map(([label,key,unit])=>{const x=completenessFor(meals,key);return nutritionMetric(label,x.value,unit,x.state);}).join('');
        const extraHTML=Object.entries(EXTRA_LABELS).map(([key,[label,unit]])=>{const x=completenessFor(meals,key,'extra');return nutritionMetric(label,x.value,unit,x.state);}).join('');
        let micros={};
        try{
          if(mealId){
            const {data,error}=await sb.from('food_meal_items').select('micronutrients').eq('meal_id',mealId);if(!error&&Array.isArray(data)&&data.length){
              const keys=[...new Set(data.flatMap(r=>Object.keys(r.micronutrients||{}).filter(k=>!k.startsWith('_'))))];
              keys.forEach(key=>{const vals=data.map(r=>{const raw=r.micronutrients?.[key];const v=Number(raw?.value??raw);return Number.isFinite(v)?v:null;});if(vals.length&&vals.every(v=>v!==null))micros[key]=vals.reduce((a,b)=>a+b,0);});
            }
          }else{
            // Lecture à la demande de la seule journée visible, y compris les produits
            // scannés sans code CIQUAL. Aucun historique n'est téléchargé ici.
            const ids=meals.map(m=>m.id).filter(Boolean);
            if(ids.length){
              const {data,error}=await sb.from('food_meal_items').select('micronutrients').in('meal_id',ids);
              if(!error&&Array.isArray(data)&&data.length){
                const keys=[...new Set(data.flatMap(r=>Object.keys(r.micronutrients||{}).filter(k=>!k.startsWith('_'))))];
                keys.forEach(key=>{const vals=data.map(r=>{const raw=r.micronutrients?.[key];const v=Number(raw?.value??raw);return Number.isFinite(v)?v:null;});if(vals.length&&vals.every(v=>v!==null))micros[key]=vals.reduce((a,b)=>a+b,0);});
              }
            }
          }
        }catch(e){console.warn('nutrition micros detail',e);}
        const microEntries=Object.entries(micros||{}).filter(([,v])=>Number.isFinite(Number(v?.value??v)));
        const microHTML=microEntries.length?microEntries.map(([key,raw])=>{const meta=MICRO_LABELS[key]||[key.replaceAll('_',' '),raw?.unit||''];return nutritionMetric(meta[0],Number(raw?.value??raw),meta[1]||raw?.unit||'','known');}).join(''):'<p class="mt-nutrition-empty">Aucun micronutriment suffisamment documenté pour cette sélection.</p>';
        const title=mealId?'Détail nutritionnel du repas':'Détail nutritionnel de ma journée';
        modal.querySelector('.mt-nutrition-sheet').innerHTML=`<div class="mt-nutrition-grip"></div><button type="button" class="mt-nutrition-close">×</button><div class="mt-nutrition-kicker">Carnet nutritionnel</div><h2>${title}</h2><p class="mt-nutrition-lead">Les totaux ne sont affichés que lorsqu’ils sont calculables sur toute la sélection. « Données partielles » signifie qu’au moins une valeur manque : Méthode Tee ne complète jamais par zéro.</p><h3>Repères principaux</h3><div class="mt-nutrition-grid">${macroHTML}</div><h3>Nutrition complémentaire</h3><div class="mt-nutrition-grid">${extraHTML}</div><h3>Micronutriments documentés</h3><div class="mt-nutrition-grid">${microHTML}</div>`;
        modal.querySelector('.mt-nutrition-close').onclick=closeNutritionDetail;
      }catch(e){console.warn('nutrition detail',e);modal.querySelector('.mt-nutrition-loading').textContent='Le détail nutritionnel est momentanément indisponible.';}
    }

    async function loadHistory(){
      history.hidden=false; history.innerHTML='<div class="mt-food-loading">Chargement de tes journées…</div>';
      const from=shiftDate(F.today(),-60);
      const {data,error}=await sb.from('food_meals').select('meal_date,id').eq('user_id',user.id).gte('meal_date',from).lte('meal_date',F.today()).order('meal_date',{ascending:false});
      if(error){history.innerHTML='<p>Historique indisponible.</p>';return;}
      const counts={};(data||[]).forEach(r=>counts[r.meal_date]=(counts[r.meal_date]||0)+1);
      const dates=Object.keys(counts).sort().reverse();
      history.innerHTML=`<h2>Mes journées précédentes</h2><div class="mt-food-history-list">${dates.length?dates.map(d=>`<a class="mt-food-history-row" href="food-day.html?date=${d}"><span>${d===F.today()?'Aujourd’hui':F.fmtDate(d)}</span><small>${counts[d]} repas</small></a>`).join(''):'<p>Aucune journée enregistrée pour le moment.</p>'}</div>`;
    }

    document.getElementById('foodPrevDay').onclick=()=>{currentDate=shiftDate(currentDate,-1);history.hidden=true;loadDay();};
    document.getElementById('foodNextDay').onclick=()=>{if(currentDate<F.today()){currentDate=shiftDate(currentDate,1);history.hidden=true;loadDay();}};
    document.getElementById('foodHistoryToggle').onclick=()=>history.hidden?loadHistory():(history.hidden=true);
    function openAdapterPicker(){
      if(!currentMeals.length){F.toast('Ajoute d’abord le repas que tu souhaites adapter.');setTimeout(()=>location.href=`food-meal.html?date=${currentDate}`,450);return;}
      if(currentMeals.length===1){location.href=`food-adapter.html?meal_id=${encodeURIComponent(currentMeals[0].id)}`;return;}
      document.getElementById('mtFoodAdapterPicker')?.remove();
      const overlay=document.createElement('div');overlay.id='mtFoodAdapterPicker';overlay.className='mt-food-picker-overlay';
      overlay.innerHTML=`<div class="mt-food-picker-sheet" role="dialog" aria-modal="true" aria-label="Choisir un repas à adapter"><div class="mt-food-picker-handle"></div><small>CARNET PERSONNEL</small><h2>Quel repas veux-tu adapter ?</h2><p>Choisis simplement le repas concerné. Ton ajustement restera ensuite relié à cette carte.</p><div class="mt-food-picker-list">${currentMeals.map(m=>`<button type="button" data-meal-id="${F.esc(m.id)}"><span><b>${F.esc(typeMeta[m.meal_type]?.label||'Repas')}</b><small>${F.esc((m.meal_time||typeMeta[m.meal_type]?.time||'').slice(0,5))}</small></span><em>${F.esc(m.source_recipe_title||m.description||'Repas renseigné')}</em><i>›</i></button>`).join('')}</div><button type="button" class="mt-food-picker-close">Fermer</button></div>`;
      document.body.appendChild(overlay);
      const close=()=>overlay.remove();
      overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
      overlay.querySelector('.mt-food-picker-close').onclick=close;
      overlay.querySelectorAll('[data-meal-id]').forEach(btn=>btn.onclick=()=>location.href=`food-adapter.html?meal_id=${encodeURIComponent(btn.dataset.mealId)}`);
    }

    document.getElementById('foodAddMeal').onclick=()=>location.href=`food-meal.html?date=${currentDate}`;
    document.getElementById('foodAdaptMeal').onclick=openAdapterPicker;
    await loadDay();
  });
})();
