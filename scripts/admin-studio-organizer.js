(function(){
  'use strict';
  const GROUPS=[
    {id:'community',label:'Aujourd’hui & communauté',match:['dailyRitualsForm','communityJourneyAdmin','clubSettingsForm','capsuleForm','Capsules','dropForm','Drops']},
    {id:'content',label:'Posts & pages',match:['postForm','Posts publiés','pageForm','Pages existantes']},
    {id:'protocols',label:'Protocoles',match:['protocolForm','Protocoles','freeIntroProtocolTool']},
    {id:'nutrition',label:'Nutrition & recettes',match:['recipeForm','Recettes','foodDictionaryForm','Dictionnaire alimentaire']},
    {id:'library',label:'Bibliothèque',match:['libraryOfferForm','Offert par Tee','contentForm','Contenus existants','photoMigrationTool']},
    {id:'clients',label:'Clients & accès',match:['unlockForm','accessForm','memberLevelForm']}
  ];
  const identity=el=>{
    const kicker=el.querySelector?.('.kicker')?.textContent?.trim()||'';
    const h2=el.querySelector?.('h2')?.textContent?.trim()||'';
    return [el.id||'',kicker,h2].join('|');
  };
  function install(){
    const panel=document.getElementById('adminPanel'),nav=document.getElementById('adminStudioNav');
    if(!panel||panel.dataset.organized==='1')return;
    panel.dataset.organized='1';
    const blocks=[...panel.children].filter(el=>el.classList?.contains('admin-block'));
    const assigned=new Set();
    const wrappers=[];
    GROUPS.forEach((g,idx)=>{
      const members=blocks.filter(el=>!assigned.has(el)&&g.match.some(m=>identity(el).includes(m)));
      if(!members.length)return;
      const details=document.createElement('details');
      details.className='admin-studio-group';details.id=`admin-group-${g.id}`;
      if(idx===0)details.open=true;
      details.innerHTML=`<summary><span>${g.label}</span><small>${members.length} module${members.length>1?'s':''}</small></summary><div class="admin-studio-group-grid"></div>`;
      const grid=details.querySelector('.admin-studio-group-grid');
      members.forEach(el=>{assigned.add(el);grid.appendChild(el);});
      wrappers.push({g,details});panel.appendChild(details);
    });
    const leftovers=blocks.filter(el=>!assigned.has(el));
    if(leftovers.length){
      const details=document.createElement('details');details.className='admin-studio-group';details.id='admin-group-tools';
      details.innerHTML=`<summary><span>Outils & réglages</span><small>${leftovers.length} module${leftovers.length>1?'s':''}</small></summary><div class="admin-studio-group-grid"></div>`;
      const grid=details.querySelector('.admin-studio-group-grid');leftovers.forEach(el=>grid.appendChild(el));panel.appendChild(details);
      wrappers.push({g:{id:'tools',label:'Outils & réglages'},details});
    }
    // V426 : on conserve uniquement les dossiers/accordéons.
    // L'ancien ruban horizontal sticky suivait le scroll et surchargeait l'admin mobile.
    // Le script reste compatible si un ancien HTML contient encore le nav : on le vide et on le masque.
    if(nav){ nav.innerHTML=''; nav.hidden=true; }
  }
  document.addEventListener('DOMContentLoaded',install);
})();
