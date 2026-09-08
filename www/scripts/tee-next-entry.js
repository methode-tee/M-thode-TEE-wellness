/* V487.3.1 · HOTFIX Profil — Méthode TEE+ visible
   Cause V487.3 : la section était injectée APRÈS observeReveal(), donc elle
   gardait opacity:0 tout en occupant sa hauteur. Le grand espace vide venait de là.
*/
(function(){
  'use strict';

  function card(icon,kicker,title,copy,tool){
    return `<article class="trust-app-card mt-profile-tight-card" onclick="location.href='tee-next.html?tool=${tool}'">
      <div class="trust-app-icon">${icon}</div>
      <div>
        <div class="trust-app-kicker">${kicker}</div>
        <h2>${title}</h2>
        <p>${copy}</p>
      </div>
      <span class="trust-app-arrow">→</span>
    </article>`;
  }

  function revealInjected(wrap){
    if(typeof window.observeReveal==='function'){
      window.observeReveal();
      return;
    }
    // Fallback robuste : ne jamais laisser la section invisible en occupant l'espace.
    wrap.querySelectorAll('.reveal').forEach(el=>{
      el.classList.add('visible','observed');
    });
  }

  function mount(){
    const root=document.getElementById('dashboardSummary');
    if(!root||document.getElementById('mtTeeNextProfile'))return false;

    const headings=[...root.querySelectorAll('.mt-profile-section-heading')];
    const before=headings.find(x=>/Préférences et compte/i.test(x.textContent||''));
    if(!before)return false;

    const wrap=document.createElement('div');
    wrap.id='mtTeeNextProfile';
    wrap.innerHTML=`
      <div class="mt-profile-section-heading reveal mt-next-profile-section">
        <span>Méthode TEE+</span>
        <h2>Aller plus loin</h2>
      </div>
      <div class="mt-profile-trust-stack reveal mt-next-profile-stack">
        ${card('🥗','Planification','Planifier ma semaine','Placard, restes, budget et prix de référence.','planner')}
        ${card('🛡','Phytothérapie','Sécurité plantes','Des garde-fous avant une suggestion automatique.','safety')}
      </div>`;

    before.parentNode.insertBefore(wrap,before);
    revealInjected(wrap);
    return true;
  }

  document.addEventListener('DOMContentLoaded',()=>{
    if(mount())return;
    const root=document.getElementById('dashboardSummary');
    if(!root)return;

    const obs=new MutationObserver(()=>{
      if(mount())obs.disconnect();
    });
    obs.observe(root,{childList:true,subtree:true});
    setTimeout(()=>obs.disconnect(),10000);
  });
})();