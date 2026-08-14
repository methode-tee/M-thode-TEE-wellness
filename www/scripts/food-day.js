(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded',async()=>{
    const F=window.MTFood; if(!F)return;
    const ctx=await F.auth(); if(!ctx)return;
    const {sb,user}=ctx;
    const initial=F.qs('date')||F.today();
    let currentDate=initial;

    const list=document.getElementById('foodMealsList');
    const summary=document.getElementById('foodDaySummary');
    const history=document.getElementById('foodHistory');
    const label=document.getElementById('foodDayLabel');
    const next=document.getElementById('foodNextDay');

    const typeMeta={
      breakfast:{label:'Petit-déjeuner',time:'08:30'},
      lunch:{label:'Déjeuner',time:'13:00'},
      snack:{label:'Collation',time:'16:30'},
      dinner:{label:'Dîner',time:'20:00'}
    };

    const shiftDate=(iso,days)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);return d.toLocaleDateString('sv-SE');};
    const compact=n=>Number(n||0).toLocaleString('fr-FR',{maximumFractionDigits:1});

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
        .select('id,meal_date,meal_type,meal_time,description,photo_path,source_recipe_id,source_recipe_title,source_recipe_image_url,kcal_total,protein_total,fat_total,carbs_total,fiber_total,satiety_after,digestion_after,energy_after,created_at')
        .eq('user_id',user.id).eq('meal_date',currentDate).order('meal_time',{ascending:true});
      if(error){console.warn('food day read',error);list.innerHTML='<div class="empty-card"><h2>Ton carnet alimentaire est prêt</h2><p>Exécute d’abord la migration V331 dans Supabase pour activer l’enregistrement.</p></div>';return;}
      const meals=data||[],byType=new Map(meals.map(m=>[m.meal_type,m]));
      const cards=[];
      for(const type of F.mealOrder){
        const m=byType.get(type),meta=typeMeta[type];
        if(!m){
          cards.push(`<article class="mt-food-meal-card is-empty no-image"><div class="mt-food-meal-body"><div class="mt-food-meal-top"><b>${meta.label}</b><time>${meta.time}</time></div><p>Non renseigné</p><button class="mt-food-empty-add" onclick="location.href='food-meal.html?date=${currentDate}&type=${type}'">+ Ajouter</button></div></article>`);
          continue;
        }
        const img=await mealImage(m);
        const desc=m.source_recipe_title||m.description||'Repas renseigné';
        const metaParts=[Number(m.kcal_total)>0?`${compact(m.kcal_total)} kcal`:'',Number(m.protein_total)>0?`P ${compact(m.protein_total)} g`:'',Number(m.fiber_total)>0?`Fibres ${compact(m.fiber_total)} g`:''].filter(Boolean);
        const mediaClass=img?'has-image':'no-image';
        cards.push(`<article class="mt-food-meal-card ${mediaClass}">${img?`<img class="mt-food-meal-img" src="${F.esc(img)}" alt="" loading="lazy" decoding="async">`:''}<div class="mt-food-meal-body"><div class="mt-food-meal-top"><b>${meta.label}</b><time>${F.esc((m.meal_time||meta.time).slice(0,5))}</time></div><p>${F.esc(desc)}</p>${metaParts.length?`<div class="mt-food-meal-meta">${metaParts.map(value=>`<span>${F.esc(value)}</span>`).join('')}</div>`:''}<div class="mt-food-card-actions"><button onclick="location.href='food-meal.html?meal_id=${m.id}'">Modifier</button><button onclick="location.href='food-adapter.html?meal_id=${m.id}'">Adapter ce repas</button></div></div></article>`);
      }
      list.innerHTML=cards.join('');
      renderSummary(meals);
    }

    function renderSummary(meals){
      if(!meals.length){summary.hidden=true;return;}
      const totals=meals.reduce((a,m)=>{['kcal_total','protein_total','fat_total','carbs_total','fiber_total'].forEach(k=>a[k]+=Number(m[k])||0);return a;},{kcal_total:0,protein_total:0,fat_total:0,carbs_total:0,fiber_total:0});
      const avg=(key)=>{const a=meals.map(m=>Number(m[key])).filter(n=>n>0);return a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:null;};
      const f=[['Énergie',avg('energy_after')],['Digestion',avg('digestion_after')],['Satiété',avg('satiety_after')]].filter(x=>x[1]!=null);
      const note=meals.length>=3?'Tes repas sont bien renseignés aujourd’hui. Observe surtout comment ton énergie, ta digestion et ta satiété évoluent.':`Tu as renseigné ${meals.length} repas aujourd’hui. Ton résumé se précisera au fil de la journée.`;
      summary.innerHTML=`<h2>Résumé de ma journée</h2><div class="mt-food-summary-grid"><div><b>${compact(totals.kcal_total)}</b><small>kcal</small></div><div><b>${compact(totals.protein_total)} g</b><small>Protéines</small></div><div><b>${compact(totals.fiber_total)} g</b><small>Fibres</small></div><div><b>${meals.length}</b><small>Repas renseignés</small></div></div>${f.length?`<div class="mt-food-feeling-summary">${f.map(([k,v])=>`<span>${k} · ${v}/10</span>`).join('')}</div>`:''}<p class="mt-food-summary-note">${F.esc(note)}</p>`;
      summary.hidden=false;
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
    document.getElementById('foodAddMeal').onclick=()=>location.href=`food-meal.html?date=${currentDate}`;
    document.getElementById('foodAdaptMeal').onclick=()=>location.href=`food-adapter.html?date=${currentDate}`;
    await loadDay();
  });
})();
