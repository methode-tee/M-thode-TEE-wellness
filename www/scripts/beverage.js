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

    const ingredientKinds={
      fresh_fruit:'Fruit frais',
      dried_fruit:'Fruit séché',
      tea:'Thé',
      herb:'Plante',
      spice:'Épice',
      flower:'Fleur',
      root:'Racine',
      other:'Ingrédient'
    };

    const kindLabel=row=>{
      const label=ingredientKinds[row?.ingredient_kind]||'Plante / ingrédient';
      return row?.caffeine_level==='present'?label+' · caféiné':label;
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

    $('selectedBotanicals').addEventListener('click',event=>{
      const button=event.target.closest('[data-remove]');
      if(!button)return;
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
      selected.set(String(row.id),row);
      $('botanicalSearch').value='';
      $('botanicalResults').hidden=true;
      $('botanicalResults').innerHTML='';
      searchRows=[];
      renderSelected();
    });

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
        if(row?.id)selected.set(String(row.id),row);
      });
      renderSelected();
      $('beverageDelete').hidden=false;
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
        source_mode:'manual',
        catalog_blend_id:null,
        ingredients_snapshot:[...selected.values()].map(row=>({
          id:row.id,
          display_name:row.display_name,
          ingredient_kind:row.ingredient_kind,
          caffeine_level:row.caffeine_level,
          caution_level:row.caution_level
        })),
        composition_known:selected.size>0,
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

    await load();
  });
})();
