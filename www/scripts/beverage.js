(function(){
  'use strict';

  document.addEventListener('DOMContentLoaded',async()=>{
    const F=window.MTFood;
    if(!F)return;
    const ctx=await F.auth();
    if(!ctx)return;

    const {sb,user}=ctx;
    const date=F.qs('date')||F.today();
    const entryId=F.qs('id');
    const $=id=>document.getElementById(id);
    const selected=new Map();
    let searchRows=[];
    let searchTimer;
    let catalogBlend=null;
    let smoothieCatalog=[];
    const nutritionCache=new Map();
    let actualItems=[],actualSnapshot=null,actualConfirmed=false;

    const SMOOTHIE_SLUGS=[
      'smoothie-banane-fraise',
      'smoothie-mangue-passion-coco',
      'smoothie-myrtille-framboise-yaourt',
      'smoothie-banane-cacao-coco'
    ];

    const ingredientKinds={
      fresh_fruit:'Fruit frais',
      dried_fruit:'Fruit séché',
      plant:'Plante',
      tea:'Thé',
      herb:'Plante',
      spice:'Épice',
      flower:'Fleur',
      root:'Racine',
      citrus_peel:'Agrume',
      other:'Ingrédient'
    };

    const kindLabel=row=>{
      const label=ingredientKinds[row?.ingredient_kind]||'Plante / ingrédient';
      return row?.caffeine_level==='present'?label+' · caféiné':label;
    };

    const formatNumber=(value,digits=1)=>{
      const n=Number(value);
      return Number.isFinite(n)?n.toLocaleString('fr-FR',{maximumFractionDigits:digits,minimumFractionDigits:0}):'—';
    };

    $('beverageTime').value=new Date().toTimeString().slice(0,5);

    function renderSelected(){
      const box=$('selectedBotanicals');
      const rows=[...selected.values()];
      box.hidden=!rows.length;
      box.innerHTML=rows.map(row=>'<div class="mt-beverage-selected-row">'+
        '<span><b>'+F.esc(row.display_name)+'</b><small>'+F.esc(kindLabel(row))+'</small></span>'+ 
        '<button type="button" data-remove="'+F.esc(row.id)+'" aria-label="Retirer '+F.esc(row.display_name)+'">×</button>'+ 
      '</div>').join('');
    }

    function renderCatalog(){
      const card=$('smoothieCatalogCard');
      const options=$('smoothieCatalogOptions');
      if(!card||!options)return;
      const isSmoothie=$('beverageKind').value==='smoothie';
      card.hidden=!isSmoothie;
      if(!isSmoothie)return;

      if(!smoothieCatalog.length){
        options.innerHTML='<p class="mt-beverage-search-empty">Les recettes de référence sont momentanément indisponibles. La saisie libre reste disponible.</p>';
        return;
      }

      options.innerHTML=smoothieCatalog.map(row=>{
        const active=catalogBlend?.id===row.id?' is-active':'';
        return '<button type="button" class="mt-smoothie-catalog-option'+active+'" data-smoothie-id="'+F.esc(row.id)+'">'+
          '<span><b>'+F.esc(row.title)+'</b>'+(row.description?'<small>'+F.esc(row.description)+'</small>':'')+'</span><i>›</i>'+
        '</button>';
      }).join('');
      $('smoothieCatalogClear').hidden=!catalogBlend;
    }

    function clearNutrition(){
      const box=$('smoothieNutritionCard');
      if(!box)return;
      box.hidden=true;
      box.innerHTML='';
    }

    function renderNutrition(data){
      const box=$('smoothieNutritionCard');
      if(!box)return;
      const core=data?.core||{};
      if(!data||core.kcal==null){
        clearNutrition();
        return;
      }

      box.hidden=false;
      box.innerHTML='<div class="mt-smoothie-nutrition-head">'+
          '<div><small>NUTRITION ESTIMÉE</small><h2>Recette de référence</h2></div>'+ 
          '<strong>'+formatNumber(core.kcal,0)+'<span>kcal</span></strong>'+ 
        '</div>'+ 
        '<div class="mt-smoothie-nutrition-grid">'+
          '<div><small>Protéines</small><b>'+formatNumber(core.protein_g,1)+' g</b></div>'+ 
          '<div><small>Glucides</small><b>'+formatNumber(core.carbs_g,1)+' g</b></div>'+ 
          '<div><small>Lipides</small><b>'+formatNumber(core.fat_g,1)+' g</b></div>'+ 
          '<div><small>Fibres</small><b>'+formatNumber(core.fiber_g,1)+' g</b></div>'+ 
        '</div>'+ 
        '<div class="mt-smoothie-nutrition-meta"><span>1 verre</span>'+
          (data.reference_mass_g!=null?'<span>Référence '+formatNumber(data.reference_mass_g,0)+' g</span>':'')+
          (core.salt_g!=null?'<span>Sel '+formatNumber(core.salt_g,2)+' g</span>':'')+
        '</div>'+ 
        '<p>'+F.esc(data.nutrition_disclaimer||'Valeurs estimées pour la recette de référence Méthode Tee ; la composition réelle peut varier selon les options et quantités choisies.')+'</p>';
    }

    function resetActual(){
      actualItems=[];actualSnapshot=null;actualConfirmed=false;
      const card=$('smoothieActualCard'),out=$('smoothieActualNutrition');
      if(card)card.hidden=true;
      if(out){out.hidden=true;out.innerHTML='';}
    }

    function renderActualNutrition(){
      const out=$('smoothieActualNutrition');
      if(!out)return;
      const core=actualSnapshot?.core||{};
      if(!actualConfirmed||!actualSnapshot||core.kcal==null){
        out.hidden=true;out.innerHTML='';return;
      }
      out.hidden=false;
      out.innerHTML='<div class="mt-smoothie-nutrition-head">'+
        '<div><small>NUTRITION CALCULÉE</small><h2>Quantités saisies</h2></div>'+
        '<strong>'+formatNumber(core.kcal,0)+'<span>kcal</span></strong>'+
        '</div><div class="mt-smoothie-nutrition-grid">'+
        '<div><small>Protéines</small><b>'+formatNumber(core.protein_g,1)+' g</b></div>'+
        '<div><small>Glucides</small><b>'+formatNumber(core.carbs_g,1)+' g</b></div>'+
        '<div><small>Lipides</small><b>'+formatNumber(core.fat_g,1)+' g</b></div>'+
        '<div><small>Fibres</small><b>'+formatNumber(core.fiber_g,1)+' g</b></div>'+
        '</div><div class="mt-smoothie-nutrition-meta">'+
        (actualSnapshot.reference_mass_g!=null?'<span>Total '+formatNumber(actualSnapshot.reference_mass_g,0)+' g</span>':'')+
        (core.salt_g!=null?'<span>Sel '+formatNumber(core.salt_g,2)+' g</span>':'')+
        '</div><p>'+F.esc(actualSnapshot.nutrition_disclaimer||'Calcul fondé sur les quantités saisies.')+'</p>';
    }

    function renderActualItems(){
      const card=$('smoothieActualCard'),box=$('smoothieActualItems');
      if(!card||!box)return;
      card.hidden=!catalogBlend;
      if(!catalogBlend)return;
      box.innerHTML=actualItems.length?actualItems.map((row,index)=>'<label class="mt-beverage-actual-row"><span><b>'+F.esc(row.display_name||'Ingrédient')+'</b><small>'+F.esc(row.has_nutrition_reference===false?'Référence nutritionnelle indisponible':'Quantité utilisée')+'</small></span><span class="mt-beverage-actual-input"><input type="number" min="0.1" step="0.1" value="'+F.esc(row.quantity_g??'')+'" data-actual-index="'+index+'"><small>g</small></span></label>').join(''):'<p class="mt-beverage-search-empty">Composition de référence indisponible.</p>';
      box.querySelectorAll('[data-actual-index]').forEach(input=>input.addEventListener('input',()=>{
        const row=actualItems[Number(input.dataset.actualIndex)];
        if(row)row.quantity_g=Math.max(.1,Number(input.value)||.1);
        actualConfirmed=false;actualSnapshot=null;renderActualNutrition();
      }));
      renderActualNutrition();
    }

    async function loadActualReferenceItems(){
      actualItems=[];actualSnapshot=null;actualConfirmed=false;
      if(!catalogBlend){renderActualItems();return;}
      const {data,error}=await sb.rpc('mt_get_botanical_blend_reference_items',{p_blend_id:catalogBlend.id});
      if(!error&&Array.isArray(data))actualItems=data.map(row=>({...row,quantity_g:Number(row.quantity_g)||0}));
      renderActualItems();
    }

    async function calculateActual(){
      if(!catalogBlend||!actualItems.length)return;
      if(actualItems.some(row=>!Number.isFinite(Number(row.quantity_g))||Number(row.quantity_g)<=0)){
        F.toast('Vérifie les quantités saisies.');return;
      }
      const btn=$('smoothieActualCalculate');
      if(btn)btn.disabled=true;
      try{
        const payload=actualItems.map(row=>({ingredient_id:row.ingredient_id,quantity_g:Number(row.quantity_g)}));
        const {data,error}=await sb.rpc('mt_calculate_botanical_beverage_nutrition',{p_items:payload});
        if(error)throw error;
        if(!data||data.status==='empty')throw new Error('Calcul indisponible.');
        actualSnapshot=data;actualConfirmed=true;renderActualNutrition();
      }catch(e){
        console.warn('actual smoothie nutrition',e);
        F.toast('Le calcul précis est momentanément indisponible.');
      }finally{if(btn)btn.disabled=false;}
    }

    async function loadNutrition(slug){
      if(!slug){clearNutrition();return;}
      if(nutritionCache.has(slug)){
        renderNutrition(nutritionCache.get(slug));
        return;
      }
      const box=$('smoothieNutritionCard');
      box.hidden=false;
      box.innerHTML='<p class="mt-smoothie-nutrition-loading">Calcul du repère nutritionnel…</p>';
      const row=smoothieCatalog.find(item=>item.slug===slug);
      let data=null,error=null;
      if(row?.id){
        const resolved=await sb.rpc('mt_nutrition_resolve',{p_meal_item_id:null,p_recipe_id:null,p_blend_id:row.id,p_dictionary_id:null,p_ciqual_code:null});
        data=resolved.data;error=resolved.error;
      }
      // Fallback doux si le front est servi avant la migration V411.2.
      if((error||!data)&&slug){const legacy=await sb.rpc('get_botanical_blend_nutrition_by_slug',{p_slug:slug});data=legacy.data;error=legacy.error;}
      if(error||!data){
        box.innerHTML='<p class="mt-smoothie-nutrition-loading">Le repère nutritionnel est momentanément indisponible. Tu peux quand même enregistrer ta boisson.</p>';
        return;
      }
      nutritionCache.set(slug,data);
      renderNutrition(data);
    }

    function detachCatalog({keepName=true}={}){
      if(!catalogBlend)return;
      catalogBlend=null;
      if(!keepName)$('beverageName').value='';
      clearNutrition();
      resetActual();
      renderCatalog();
    }

    async function chooseCatalog(row){
      if(!row)return;
      selected.clear();
      renderSelected();
      catalogBlend=row;
      $('beverageKind').value='smoothie';
      $('beverageName').value=row.title||'';
      renderCatalog();
      await loadNutrition(row.slug);
      await loadActualReferenceItems();
    }

    async function loadCatalog(){
      const {data,error}=await sb.from('botanical_blends')
        .select('id,slug,title,description,serving_note,priority')
        .in('slug',SMOOTHIE_SLUGS)
        .eq('enabled',true)
        .order('priority',{ascending:true});
      if(!error&&Array.isArray(data)){
        smoothieCatalog=data.sort((a,b)=>SMOOTHIE_SLUGS.indexOf(a.slug)-SMOOTHIE_SLUGS.indexOf(b.slug));
      }
      renderCatalog();
    }

    $('selectedBotanicals').addEventListener('click',event=>{
      const button=event.target.closest('[data-remove]');
      if(!button)return;
      if(catalogBlend)detachCatalog({keepName:true});
      selected.delete(button.dataset.remove);
      renderSelected();
    });

    async function searchIngredients(){
      const query=$('botanicalSearch').value.trim();
      const box=$('botanicalResults');
      if(query.length<2){
        searchRows=[];
        box.hidden=true;
        box.innerHTML='';
        return;
      }

      const {data,error}=await sb.rpc('search_botanical_ingredients',{p_query:query,p_limit:12});
      searchRows=Array.isArray(data)?data:[];
      if(error){
        box.innerHTML='<p class="mt-beverage-search-empty">La recherche est momentanément indisponible. Tu peux tout de même enregistrer le nom de ta boisson.</p>';
      }else if(!searchRows.length){
        box.innerHTML='<p class="mt-beverage-search-empty">Aucun ingrédient trouvé. Le nom libre de ta boisson reste enregistrable.</p>';
      }else{
        box.innerHTML=searchRows.map((row,index)=>'<button type="button" class="mt-food-search-result mt-beverage-search-result" data-result-index="'+index+'">'+
          '<b>'+F.esc(row.display_name)+'</b><small>'+F.esc(kindLabel(row))+'</small>'+ 
        '</button>').join('');
      }
      box.hidden=false;
    }

    $('botanicalSearch').addEventListener('input',()=>{
      clearTimeout(searchTimer);
      searchTimer=setTimeout(searchIngredients,260);
    });

    $('botanicalResults').addEventListener('click',event=>{
      const button=event.target.closest('[data-result-index]');
      if(!button)return;
      const row=searchRows[Number(button.dataset.resultIndex)];
      if(!row?.id)return;
      if(catalogBlend)detachCatalog({keepName:true});
      selected.set(String(row.id),row);
      $('botanicalSearch').value='';
      $('botanicalResults').hidden=true;
      $('botanicalResults').innerHTML='';
      searchRows=[];
      renderSelected();
    });

    $('beverageKind').addEventListener('change',()=>{
      if($('beverageKind').value!=='smoothie')detachCatalog({keepName:true});
      renderCatalog();
    });

    $('beverageName').addEventListener('input',()=>{
      if(catalogBlend&&$('beverageName').value.trim()!==(catalogBlend.title||'')){
        detachCatalog({keepName:true});
      }
    });

    $('smoothieCatalogOptions').addEventListener('click',event=>{
      const button=event.target.closest('[data-smoothie-id]');
      if(!button)return;
      const row=smoothieCatalog.find(item=>String(item.id)===String(button.dataset.smoothieId));
      chooseCatalog(row);
    });

    $('smoothieCatalogClear').addEventListener('click',()=>detachCatalog({keepName:true}));
    $('smoothieActualCalculate')?.addEventListener('click',calculateActual);

    async function load(){
      if(!entryId)return;
      const {data,error}=await sb.from('user_beverage_entries')
        .select('*')
        .eq('id',entryId)
        .eq('user_id',user.id)
        .maybeSingle();
      if(error||!data){
        F.toast('Cette boisson ne peut pas être ouverte.');
        return;
      }

      $('beveragePageTitle').textContent='Modifier ma boisson';
      $('beverageName').value=data.display_name||'';
      $('beverageKind').value=data.beverage_kind||'other';
      $('beverageVolume').value=data.volume_ml||'';
      $('beverageTime').value=new Date(data.consumed_at).toTimeString().slice(0,5);
      $('beverageEnergy').value=data.energy_after||'';
      $('beverageDigestion').value=data.digestion_after||'';
      $('beverageNotes').value=data.notes||'';
      (data.ingredients_snapshot||[]).forEach(row=>{
        if(row?.id&&row.quantity_g==null)selected.set(String(row.id),row);
      });
      renderSelected();
      $('beverageDelete').hidden=false;

      if(data.catalog_blend_id){
        const row=smoothieCatalog.find(item=>String(item.id)===String(data.catalog_blend_id));
        if(row){
          catalogBlend=row;
          renderCatalog();
          await loadNutrition(row.slug);
          if(data.composition_quantified&&data.nutrition_snapshot){
            actualItems=(data.ingredients_snapshot||[]).filter(x=>x?.id&&x.quantity_g!=null).map(x=>({ingredient_id:x.id,display_name:x.display_name,quantity_g:Number(x.quantity_g),quantity_unit:x.quantity_unit||'g',has_nutrition_reference:true}));
            actualSnapshot=data.nutrition_snapshot;actualConfirmed=true;renderActualItems();
          }else{
            await loadActualReferenceItems();
          }
        }
      }else{
        renderCatalog();
      }
    }

    async function save(){
      const name=$('beverageName').value.trim();
      if(!name){
        F.toast('Indique le nom de la boisson.');
        $('beverageName').focus();
        return;
      }

      const kind=$('beverageKind').value;
      const volume=Number($('beverageVolume').value)||null;
      const payload={
        user_id:user.id,
        entry_date:date,
        consumed_at:new Date(date+'T'+($('beverageTime').value||'12:00')+':00').toISOString(),
        beverage_kind:kind,
        display_name:name,
        volume_ml:volume,
        hydration_ml:kind==='water'?volume:null,
        source_mode:catalogBlend?'catalog_blend':'manual',
        catalog_blend_id:catalogBlend?.id||null,
        ingredients_snapshot:catalogBlend&&actualConfirmed
          ?actualItems.map(row=>({id:row.ingredient_id,display_name:row.display_name,quantity_g:Number(row.quantity_g),quantity_unit:row.quantity_unit||'g'}))
          :[...selected.values()].map(row=>({
            id:row.id,
            display_name:row.display_name,
            ingredient_kind:row.ingredient_kind,
            caffeine_level:row.caffeine_level,
            caution_level:row.caution_level
          })),
        composition_known:Boolean(catalogBlend||selected.size>0),
        composition_quantified:Boolean(catalogBlend&&actualConfirmed&&actualSnapshot),
        nutrition_snapshot:catalogBlend&&actualConfirmed?actualSnapshot:null,
        nutrition_snapshot_version:catalogBlend&&actualConfirmed?'MT_BEVERAGE_ACTUAL_V1':null,
        nutrition_snapshot_calculated_at:catalogBlend&&actualConfirmed?new Date().toISOString():null,
        energy_after:Number($('beverageEnergy').value)||null,
        digestion_after:Number($('beverageDigestion').value)||null,
        notes:$('beverageNotes').value.trim()||null
      };

      const request=entryId
        ? sb.from('user_beverage_entries').update(payload).eq('id',entryId).eq('user_id',user.id)
        : sb.from('user_beverage_entries').insert(payload);
      const {error}=await request;
      if(error){
        F.toast('Enregistrement impossible. Vérifie la migration V392.');
        return;
      }
      window.dispatchEvent(new CustomEvent('mt:data-updated',{detail:{source:'beverage'}}));
      location.href='food-day.html?date='+date;
    }

    $('beverageSave').onclick=save;
    $('beverageBack').onclick=()=>location.href='food-day.html?date='+date;
    $('beverageDelete').onclick=async()=>{
      if(!confirm('Supprimer cette boisson ?'))return;
      await sb.from('user_beverage_entries').delete().eq('id',entryId).eq('user_id',user.id);
      location.href='food-day.html?date='+date;
    };

    await loadCatalog();
    await load();
  });
})();
