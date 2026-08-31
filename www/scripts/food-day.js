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
        .select('id,meal_date,meal_type,meal_time,description,photo_path,source_recipe_id,source_recipe_title,source_recipe_image_url,kcal_total,protein_total,fat_total,carbs_total,fiber_total,satiety_after,digestion_after,energy_after,created_at,food_meal_items(id),food_adaptations!food_adaptations_meal_id_fkey(id,status,goal,decided_at,created_at)')
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
          cards.push(`<article class="mt-food-meal-card ${mediaClass}">${img?`<img class="mt-food-meal-img" src="${F.esc(img)}" alt="" loading="lazy" decoding="async">`:''}<div class="mt-food-meal-body"><div class="mt-food-meal-top"><b>${meta.label}</b><time>${F.esc((m.meal_time||meta.time).slice(0,5))}</time></div><p>${F.esc(desc)}</p><div class="mt-food-meal-meta ${calculated?'':'is-uncomputed'}">${metaParts.map(value=>`<span>${F.esc(value)}</span>`).join('')}</div>${adaptedMark}<div class="mt-food-card-actions"><button onclick="location.href='food-meal.html?meal_id=${m.id}'">Modifier</button><button onclick="location.href='food-adapter.html?meal_id=${m.id}'">Adapter ce repas</button></div></div></article>`);
        }
      }
      list.innerHTML=cards.join('');
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
      summary.innerHTML=`<h2>Résumé de ma journée</h2><div class="mt-food-summary-grid">${metric('kcal_total','','kcal')}${metric('protein_total',' g','Protéines')}${metric('fiber_total',' g','Fibres')}<div><b>${meals.length}</b><small>Repas renseignés</small></div></div>${f.length?`<div class="mt-food-feeling-summary">${f.map(([k,v])=>`<span>${k} · ${v}/10</span>`).join('')}</div>`:''}<p class="mt-food-summary-note">${F.esc(note)}</p><div class="mt-food-personal-reference" id="foodPersonalReference" hidden></div>`;
      summary.hidden=false;
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

    async function renderPersonalReference(totals){
      const host=document.getElementById('foodPersonalReference');if(!host||!window.MTReference)return;
      // Le repère évolutif décrit le présent. Les journées passées gardent leur
      // résumé historique sans lancer une nouvelle lecture serveur.
      if(currentDate!==F.today()){host.hidden=true;return;}
      try{
        const ctx=await window.MTReference.context(currentDate,{sb,user});if(!ctx||currentDate!==String(ctx.date||currentDate))return;
        const model=window.MTReference.buildModel(ctx),copy=window.MTReference.dayEditorial(model,totals),linkLabel=model.status==='building'?'Voir mes repères estimés':'Voir mes repères personnels';
        host.innerHTML=`<div class="mt-food-ref-kicker">Mes repères personnels</div><h3>Comment se situe ma journée ?</h3><p>${F.esc(copy)}</p><button type="button" class="mt-food-ref-link">${F.esc(linkLabel)} <span>›</span></button>`;
        host.hidden=false;
        host.querySelector('.mt-food-ref-link').onclick=()=>window.MTReference.openSheet(model,totals);
      }catch(e){console.warn('personal reference',e);host.hidden=true;}
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
