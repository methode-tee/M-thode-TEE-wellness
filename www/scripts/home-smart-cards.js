/* MÉTHODE TEE — V481 · Accueil membre + "Le dire à TEE" local
   Couche additive : aucune écriture métier au simple affichage de l'Accueil.
   Les cartes ne déclenchent les lectures Supabase détaillées qu'après un appui explicite. */
(function(){
  'use strict';
  if(window.__MT_HOME_SMART_CARDS_V481__)return;
  window.__MT_HOME_SMART_CARDS_V481__=true;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>new Date().toLocaleDateString('sv-SE');
  const VOICE_DRAFT_KEY='mt_voice_meal_draft_v1';
  let memberId='';
  let speechPluginInstance=null;
  let speechHandles=[];
  let speechListening=false;
  const voiceState={text:'',choices:[],payload:null,busy:false};
  const expState={model:null,raw:null};

  function injectCSS(){
    if(document.getElementById('mtHomeSmartCSS'))return;
    const s=document.createElement('style');
    s.id='mtHomeSmartCSS';
    s.textContent=`
      .mt-home-tool-modal{position:fixed;inset:0;z-index:12050;display:none}.mt-home-tool-modal.open{display:block}.mt-home-tool-bg{position:absolute;inset:0;background:rgba(16,47,37,.27);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
      .mt-home-tool-sheet{position:absolute;left:0;right:0;bottom:0;margin:auto;max-width:720px;max-height:min(calc(100dvh - max(14px,env(safe-area-inset-top))),900px);overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#fffaf2;border:1px solid rgba(201,184,153,.55);border-radius:31px 31px 0 0;padding:17px 20px calc(26px + env(safe-area-inset-bottom));box-shadow:0 -24px 70px rgba(39,48,39,.18);color:#74675c}
      .mt-home-tool-grip{width:43px;height:4px;border-radius:99px;background:#d7ccbc;margin:0 auto 15px}.mt-home-tool-close{position:absolute;right:18px;top:18px;width:38px;height:38px;border:0;border-radius:50%;background:#f1ebdf;color:#17483e;font-size:22px;display:grid;place-items:center}
      .mt-home-tool-mark{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:#f2eadc;color:#b08a43;margin:2px 0 10px;font-size:20px}.mt-home-tool-kicker{font-size:10px;font-weight:900;letter-spacing:.19em;text-transform:uppercase;color:#b08a43}.mt-home-tool-sheet h2{font-family:var(--font-serif,"Cormorant Garamond",Georgia,serif);font-weight:500;font-size:clamp(31px,8vw,43px);line-height:.98;color:#17483e;margin:7px 42px 9px 0}.mt-home-tool-lead{font-size:13px;line-height:1.55;color:#817266;margin:0 0 18px}
      .mt-home-tool-actions{display:grid;gap:10px}.mt-home-tool-action{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;border:1px solid rgba(177,138,67,.24);border-radius:20px;background:rgba(255,253,248,.86);padding:14px 14px;text-align:left;color:#17483e}.mt-home-tool-action>span:first-child{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#f2eadc;color:#b08a43;font-size:17px}.mt-home-tool-action strong{display:block;font-size:13px}.mt-home-tool-action small{display:block;margin-top:3px;font-size:10px;line-height:1.35;color:#8a7d71}.mt-home-tool-action i{font-family:serif;font-style:normal;font-size:24px;color:#b08a43}.mt-home-tool-action[disabled]{opacity:.55}
      .mt-home-tool-footer{width:100%;margin-top:15px;border:0;background:transparent;color:#8f713a;font-size:11px;font-weight:850;padding:11px}.mt-home-tool-primary{width:100%;border:0;border-radius:999px;background:#17483e;color:#fff;padding:15px 18px;font-weight:900;font-size:12px;letter-spacing:.035em;margin-top:15px}.mt-home-tool-primary:disabled{opacity:.48}.mt-home-tool-secondary{width:100%;border:1px solid #cfb77f;border-radius:999px;background:transparent;color:#17483e;padding:13px 16px;font-weight:850;margin-top:9px}
      .mt-voice-stage{text-align:center;padding:8px 0 2px}.mt-voice-orb{width:84px;height:84px;border-radius:50%;margin:6px auto 14px;display:grid;place-items:center;background:radial-gradient(circle at 38% 30%,#fff9ea,#e9d9b9);border:1px solid rgba(177,138,67,.32);color:#17483e;font-size:28px;box-shadow:0 12px 34px rgba(88,68,38,.09)}.mt-voice-orb.is-listening{animation:mtVoicePulse 1.4s ease-in-out infinite}.mt-voice-transcript{min-height:74px;padding:14px;border-radius:18px;background:#f6efe4;color:#17483e;font-family:var(--font-serif,"Cormorant Garamond",Georgia,serif);font-size:24px;line-height:1.15;text-align:left}.mt-voice-hint{font-size:10px;line-height:1.45;color:#928578;margin:10px 2px}.mt-voice-fallback{width:100%;min-height:105px;resize:vertical;border:1px solid #dfd2bc;border-radius:18px;background:#fffdf9;padding:14px;font:inherit;font-size:16px;color:#17483e;outline:none}.mt-voice-fallback:focus{border-color:#b08a43}
      @keyframes mtVoicePulse{0%,100%{transform:scale(1);box-shadow:0 12px 34px rgba(88,68,38,.09)}50%{transform:scale(1.035);box-shadow:0 12px 42px rgba(176,138,67,.23)}}
      .mt-voice-items{display:grid;gap:11px}.mt-voice-item{border:1px solid rgba(31,72,61,.11);border-radius:20px;background:#fffdf8;padding:14px}.mt-voice-item-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mt-voice-item-head b{color:#17483e;font-size:14px}.mt-voice-item-head span{color:#9b793b;font-size:11px;font-weight:850;text-align:right}.mt-voice-item p{font-size:11px;line-height:1.45;color:#88796d;margin:6px 0 0}.mt-voice-options{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.mt-voice-options button{border:1px solid #d6c19a;border-radius:999px;background:#fffaf2;color:#17483e;padding:9px 11px;font-size:10px;font-weight:850}.mt-voice-options button.is-selected{background:#17483e;border-color:#17483e;color:#fff}.mt-voice-grams{display:flex;align-items:center;gap:8px;margin-top:11px}.mt-voice-grams input{min-width:0;flex:1;border:1px solid #dbcbae;border-radius:14px;background:#fff;padding:11px 12px;font-size:16px;color:#17483e}.mt-voice-grams span{font-size:11px;font-weight:900;color:#8b7b6d}.mt-voice-status{margin:12px 0;padding:12px 13px;border-radius:16px;background:#f4ecdf;font-size:11px;line-height:1.5;color:#75675b}.mt-voice-status.is-error{background:#f8ebe6;color:#8d4a3a}.mt-voice-status b{color:#17483e}
      .mt-voice-edit{display:grid;gap:12px}.mt-voice-edit textarea{width:100%;min-height:124px;resize:vertical;border:1px solid #dfd2bc;border-radius:20px;background:#fffdf9;padding:16px 15px;font:inherit;font-size:16px;line-height:1.45;color:#17483e;outline:none}.mt-voice-edit textarea:focus{border-color:#b08a43}.mt-voice-edit small{display:block;color:#8f8174;line-height:1.5}
      .mt-voice-loader{position:relative;overflow:hidden;border:1px solid rgba(208,191,160,.6);border-radius:28px;background:linear-gradient(180deg,#fffdf9,#f7f0e4);padding:18px 16px;margin-top:10px;box-shadow:0 16px 40px rgba(88,68,38,.08)}.mt-voice-loader-badge{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:#f5ecde;color:#b08a43;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.mt-voice-loader-badge i{font-style:normal;font-size:13px}.mt-voice-loader-title{margin:14px 0 5px;color:#17483e;font-family:var(--font-serif,"Cormorant Garamond",Georgia,serif);font-size:40px;line-height:.95}.mt-voice-loader-sub{margin:0;color:#9a8366;font-size:13px}.mt-voice-loader-card{margin:18px 0 14px;padding:18px;border-radius:22px;background:#fffdf8;border:1px solid rgba(213,196,163,.65)}.mt-voice-loader-book{display:grid;grid-template-columns:88px 1fr;gap:16px;align-items:center}.mt-voice-loader-plate{width:88px;height:88px;border-radius:50%;background:radial-gradient(circle at 30% 28%,#fffdf6,#eee1c6);border:1px solid rgba(191,158,97,.35);position:relative;box-shadow:inset 0 0 0 10px rgba(255,250,242,.8)}.mt-voice-loader-plate:before{content:'';position:absolute;inset:20px;border-radius:50%;background:radial-gradient(circle at 30% 28%,#f4dfb8 0 12px,transparent 13px),radial-gradient(circle at 67% 40%,#bdd4b0 0 10px,transparent 11px),radial-gradient(circle at 53% 63%,#d88d65 0 15px,transparent 16px),radial-gradient(circle at 40% 48%,#e9b65b 0 12px,transparent 13px),radial-gradient(circle at 64% 64%,#f1e9d7 0 17px,transparent 18px),#f8f2e7;box-shadow:0 6px 18px rgba(115,84,39,.12)}.mt-voice-loader-copy b{display:block;color:#b08a43;font-size:10px;letter-spacing:.16em;text-transform:uppercase}.mt-voice-loader-copy h3{margin:7px 0 7px;color:#17483e;font-family:var(--font-serif,"Cormorant Garamond",Georgia,serif);font-size:28px;line-height:1}.mt-voice-loader-copy p{margin:0;color:#8f8174;font-size:12px;line-height:1.5}.mt-voice-loader-lines{display:grid;gap:10px;margin-top:13px}.mt-voice-loader-lines i{display:block;height:8px;border-radius:999px;background:linear-gradient(90deg,#17483e 0 32%,#b08a43 58%,#eadfc9 86%);background-size:220% 100%;animation:mtVoiceLoaderLine 1.45s ease-in-out infinite}.mt-voice-loader-lines i:nth-child(2){width:84%;animation-delay:.18s}.mt-voice-loader-lines i:nth-child(3){width:68%;animation-delay:.34s}.mt-voice-loader-progress{height:8px;border-radius:999px;background:#eadfc9;overflow:hidden;margin:14px 0 10px}.mt-voice-loader-progress span{display:block;height:100%;width:56%;border-radius:999px;background:linear-gradient(90deg,#17483e,#b08a43);background-size:180% 100%;animation:mtVoiceLoaderBar 1.35s linear infinite}.mt-voice-loader-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.mt-voice-loader-step{display:grid;justify-items:center;gap:7px;text-align:center;color:#7d7165;font-size:10px;line-height:1.4}.mt-voice-loader-step em{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 25%,#6a8f77,#a68a45);box-shadow:0 6px 18px rgba(84,72,42,.2);color:#fff;font-style:normal;font-weight:900}.mt-voice-loader-foot{margin-top:13px;text-align:center;color:#9a8366;font-family:var(--font-serif,"Cormorant Garamond",Georgia,serif);font-size:17px}.mt-voice-loader-text{margin-top:12px;padding:12px 13px;border-radius:16px;background:#f4ecdf;font-size:11px;line-height:1.5;color:#75675b}.mt-voice-loader-text b{display:block;color:#17483e;margin-bottom:4px}
      @keyframes mtVoiceLoaderLine{0%{background-position:120% 0;opacity:.72}50%{opacity:1}100%{background-position:-20% 0;opacity:.72}}@keyframes mtVoiceLoaderBar{0%{background-position:100% 0}100%{background-position:-100% 0}}
      .mt-home-ref-box{padding:15px;border-radius:20px;background:#f5efe4;margin:14px 0}.mt-home-ref-box b{display:block;color:#17483e;font-family:var(--font-serif,"Cormorant Garamond",Georgia,serif);font-size:24px;font-weight:600;line-height:1.05}.mt-home-ref-box p{margin:7px 0 0;font-size:12px;line-height:1.5}.mt-home-ref-action{padding:13px 14px;border-radius:17px;background:#eaf0ec;color:#21483e;font-size:12px;line-height:1.5}.mt-home-ref-action b{display:block;margin-bottom:4px}.mt-home-ref-reasons{margin:12px 0 0;padding:0;list-style:none}.mt-home-ref-reasons li{position:relative;padding:4px 0 4px 16px;font-size:11px;line-height:1.4}.mt-home-ref-reasons li:before{content:'✷';position:absolute;left:0;color:#b08a43}.mt-home-exp-days{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin:13px 0}.mt-home-exp-days i{height:5px;border-radius:99px;background:#e5dbca}.mt-home-exp-days i.is-done{background:#91aa9f}.mt-home-exp-days i.is-current{background:#17483e}
      @media(max-width:430px){.mt-home-tool-sheet{padding-left:17px;padding-right:17px}.mt-home-tool-sheet h2{font-size:35px}.mt-voice-transcript{font-size:22px}}
      @media(prefers-reduced-motion:reduce){.mt-voice-orb.is-listening{animation:none}}
    `;
    document.head.appendChild(s);
  }

  function icon(key,fallback){
    try{return window.mtIconHTML?window.mtIconHTML(key,'story-icon'):fallback;}catch(_){return fallback;}
  }
  function openMealDraftDB(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(new Error('Stockage local indisponible.'));return;}
      const req=indexedDB.open('mt_meal_capture_v1',1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('drafts'))db.createObjectStore('drafts');};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Stockage local indisponible.'));
    });
  }
  async function storeMealPhotoDraft(file){
    const db=await openMealDraftDB();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('drafts','readwrite');
      tx.objectStore('drafts').put({blob:file,name:file.name||'repas.jpg',type:file.type||'image/jpeg',lastModified:file.lastModified||Date.now(),createdAt:Date.now()},'photo');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Impossible de préparer la photo.'));tx.onabort=()=>reject(tx.error||new Error('Impossible de préparer la photo.'));
    });
    db.close();
  }
  async function captureMealPhoto(){
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('capture','environment');input.hidden=true;document.body.appendChild(input);
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];input.remove();if(!file)return;
      try{await storeMealPhotoDraft(file);location.href='food-meal.html?source=photo';}
      catch(e){window.mtToast?.(String(e?.message||'Impossible de préparer cette photo.'),'error');}
    },{once:true});
    input.click();
  }

  function readSnapshot(kind){
    try{
      const x=JSON.parse(localStorage.getItem(`mt_home_${kind}_v1_${memberId||'member'}`)||'null');
      return x&&x.date===today()?x:null;
    }catch(_){return null;}
  }
  function writeSnapshot(kind,data){try{localStorage.setItem(`mt_home_${kind}_v1_${memberId||'member'}`,JSON.stringify({date:today(),...data}));}catch(_){}}
  function shortLabel(value,fallback){const s=String(value||'').replace(/^Priorité\s+/i,'').trim();return s?(s.length>22?s.slice(0,21).trim()+'…':s):fallback;}

  window.mtRenderMemberHomeCards=function(rail,member){
    if(!rail)return false;
    memberId=String(member?.user_id||member?.id||'');
    const ref=readSnapshot('reference'),exp=readSnapshot('experience');
    rail.setAttribute('aria-label','Raccourcis personnels');
    rail.innerHTML=`
      <button class="story-bubble accent-green" type="button" onclick="mtOpenHomeMealSheet()"><span>${icon('fuel','🍽️')}</span><b>Mon repas</b><small>Ajouter maintenant</small></button>
      <button class="story-bubble accent-gold" type="button" onclick="mtOpenHomeReference()"><span>${icon('sparkle','✦')}</span><b>Ton repère</b><small id="mtHomeReferenceCaption">${esc(ref?.short||'Voir aujourd’hui')}</small></button>
      <button class="story-bubble accent-sage" type="button" onclick="mtGoHomeComposer()"><span>${icon('leaf','✷')}</span><b>Composer avec Tee</b><small>Avec ce que j’ai</small></button>
      <button class="story-bubble accent-cream" type="button" onclick="mtOpenHomeExperiences()"><span>${icon('chart','↻')}</span><b>Mon expérience</b><small id="mtHomeExperienceCaption">${esc(exp?.short||'Ce qui me réussit')}</small></button>`;
    return true;
  };

  function ensureModal(){
    injectCSS();
    let modal=document.getElementById('mtHomeToolModal');
    if(!modal){modal=document.createElement('div');modal.id='mtHomeToolModal';modal.className='mt-home-tool-modal';document.body.appendChild(modal);}
    return modal;
  }
  function openHTML(html){
    const modal=ensureModal();
    modal.innerHTML=`<div class="mt-home-tool-bg" data-mt-home-close></div><section class="mt-home-tool-sheet" role="dialog" aria-modal="true"><div class="mt-home-tool-grip"></div><button type="button" class="mt-home-tool-close" data-mt-home-close aria-label="Fermer">×</button>${html}</section>`;
    modal.querySelectorAll('[data-mt-home-close]').forEach(x=>x.addEventListener('click',()=>window.mtCloseHomeToolSheet()));
    modal.classList.add('open');
    return modal;
  }
  async function clearSpeechListeners(){
    const handles=speechHandles.splice(0);
    for(const h of handles){try{await h?.remove?.();}catch(_){}}
  }
  window.mtCloseHomeToolSheet=async function(){
    if(speechListening){try{await speechPluginInstance?.cancel?.();}catch(_){}}
    speechListening=false;await clearSpeechListeners();
    document.getElementById('mtHomeToolModal')?.classList.remove('open');
  };

  window.mtOpenHomeMealSheet=function(){
    openHTML(`<div class="mt-home-tool-mark">${icon('fuel','🍽️')}</div><div class="mt-home-tool-kicker">Repas du jour</div><h2>Qu’est-ce que tu as mangé ?</h2><p class="mt-home-tool-lead">Ajoute ton repas de la façon la plus simple pour toi. Tout finit dans le même Carnet Méthode TEE.</p><div class="mt-home-tool-actions">
      <button class="mt-home-tool-action" type="button" data-mt-meal-photo><span>⌁</span><span><strong>Photographier</strong><small>Ouvre directement l’appareil photo pour ajouter ton assiette au repas.</small></span><i>›</i></button>
      <button class="mt-home-tool-action" type="button" data-mt-meal-voice><span>◉</span><span><strong>Le dire à TEE</strong><small>Parle naturellement : « deux œufs, du pain complet et un demi-avocat ».</small></span><i>›</i></button>
      <button class="mt-home-tool-action" type="button" data-mt-meal-search><span>⌕</span><span><strong>Rechercher / scanner</strong><small>Retrouve la recherche alimentaire et le code-barres déjà présents dans ton Carnet.</small></span><i>›</i></button>
    </div><button class="mt-home-tool-footer" type="button" data-mt-meal-day>Voir ma journée alimentaire →</button>`);
    document.querySelector('[data-mt-meal-photo]')?.addEventListener('click',captureMealPhoto);
    document.querySelector('[data-mt-meal-voice]')?.addEventListener('click',()=>window.mtOpenHomeVoiceMeal());
    document.querySelector('[data-mt-meal-search]')?.addEventListener('click',()=>location.href='food-meal.html?action=search&source=home');
    document.querySelector('[data-mt-meal-day]')?.addEventListener('click',()=>location.href='food-day.html');
  };

  window.mtGoHomeComposer=function(){location.href='food-inspiration.html';};

  function nativeSpeechPlugin(){
    if(speechPluginInstance)return speechPluginInstance;
    try{
      const cap=window.Capacitor;
      const native=typeof cap?.isNativePlatform==='function'?cap.isNativePlatform():['ios','android'].includes(cap?.getPlatform?.());
      if(!native)return null;
      if(typeof cap?.isPluginAvailable==='function'&&!cap.isPluginAvailable('SpeechRecognition'))return null;
      speechPluginInstance=cap?.Plugins?.SpeechRecognition||(typeof cap?.registerPlugin==='function'?cap.registerPlugin('SpeechRecognition'):null);
      return speechPluginInstance;
    }catch(_){return null;}
  }

  async function setupSpeechListeners(plugin){
    await clearSpeechListeners();
    if(!plugin?.addListener)return;
    speechHandles.push(await plugin.addListener('speechPartial',event=>{
      const text=String(event?.text||'').trim();if(!text)return;voiceState.text=text;
      const box=document.getElementById('mtVoiceTranscript');if(box)box.textContent=text;
    }));
    speechHandles.push(await plugin.addListener('speechFinal',event=>{
      speechListening=false;
      const text=String(event?.text||voiceState.text||'').trim();
      voiceState.text=text;
      if(!text){renderVoiceFallback('Je n’ai pas réussi à entendre une phrase complète. Tu peux réessayer ou l’écrire.');return;}
      resolveVoicePhrase(text,[]);
    }));
    speechHandles.push(await plugin.addListener('speechError',event=>{
      speechListening=false;renderVoiceFallback(String(event?.message||'Le micro local est momentanément indisponible.'));
    }));
  }

  window.mtOpenHomeVoiceMeal=async function(){
    voiceState.text='';voiceState.choices=[];voiceState.payload=null;voiceState.busy=false;
    openHTML(`<div class="mt-home-tool-mark">◉</div><div class="mt-home-tool-kicker">Le dire à TEE</div><h2>Je t’écoute.</h2><p class="mt-home-tool-lead">Parle comme tu le ferais naturellement. La transcription reste sur l’iPhone lorsque la reconnaissance locale est disponible.</p><div id="mtVoiceBody"><div class="mt-voice-stage"><div class="mt-voice-orb" id="mtVoiceOrb">◉</div><div class="mt-voice-transcript" id="mtVoiceTranscript">« J’ai mangé… »</div><p class="mt-voice-hint">TEE ne remplit jamais ton Carnet sans te montrer ce qu’elle a compris.</p><button class="mt-home-tool-primary" type="button" id="mtVoiceStart">Commencer à parler</button></div></div>`);
    const start=document.getElementById('mtVoiceStart');if(start)start.onclick=startNativeSpeech;
  };

  async function startNativeSpeech(){
    const button=document.getElementById('mtVoiceStart');if(button){button.disabled=true;button.textContent='Préparation du micro…';}
    const plugin=nativeSpeechPlugin();
    if(!plugin){renderVoiceFallback('Sur cet écran, le micro local n’est pas disponible. Écris simplement ta phrase : le moteur TEE qui la comprend reste le même.');return;}
    try{
      const availability=await plugin.isAvailable({locale:'fr-FR'});
      if(!availability?.onDeviceSupported){renderVoiceFallback('La dictée locale n’est pas disponible sur cet iPhone. Aucun service IA payant ne sera utilisé : tu peux écrire la même phrase ci-dessous.');return;}
      const permissions=await plugin.requestPermissions();
      if(!permissions?.granted){renderVoiceFallback('Le microphone ou la reconnaissance vocale n’est pas autorisé. Tu peux modifier ces autorisations dans Réglages, ou écrire ta phrase.');return;}
      await setupSpeechListeners(plugin);
      await plugin.start({locale:'fr-FR',onDeviceOnly:true});
      speechListening=true;
      const orb=document.getElementById('mtVoiceOrb');orb?.classList.add('is-listening');
      const transcript=document.getElementById('mtVoiceTranscript');if(transcript)transcript.textContent='Je t’écoute…';
      if(button){button.disabled=false;button.textContent='J’ai terminé';button.onclick=async()=>{button.disabled=true;button.textContent='Compréhension…';try{await plugin.stop();}catch(_){renderVoiceFallback('La dictée s’est interrompue. Tu peux écrire ta phrase.');}};}
    }catch(e){renderVoiceFallback(String(e?.message||'Le micro local n’a pas pu démarrer.'));}
  }

  function renderVoiceFallback(message=''){
    speechListening=false;clearSpeechListeners();
    const body=document.getElementById('mtVoiceBody');if(!body)return;
    body.innerHTML=`${message?`<div class="mt-voice-status">${esc(message)}</div>`:''}<textarea class="mt-voice-fallback" id="mtVoiceFallbackText" placeholder="Ex. J’ai mangé deux œufs, deux tartines de pain complet et un demi-avocat.">${esc(voiceState.text)}</textarea><button class="mt-home-tool-primary" type="button" id="mtVoiceFallbackGo">Comprendre cette phrase</button><button class="mt-home-tool-secondary" type="button" id="mtVoiceFallbackRetry">Réessayer le micro</button>`;
    document.getElementById('mtVoiceFallbackGo')?.addEventListener('click',()=>{const text=String(document.getElementById('mtVoiceFallbackText')?.value||'').trim();if(text.length<3){window.mtToast?.('Décris simplement ce que tu as mangé.');return;}voiceState.text=text;resolveVoicePhrase(text,[]);});
    document.getElementById('mtVoiceFallbackRetry')?.addEventListener('click',()=>window.mtOpenHomeVoiceMeal());
  }

  function normalizeVoiceText(value){
    return String(value||'').toLocaleLowerCase('fr').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function voiceItemText(item){
    return String(item?.raw_segment||item?.food_text||item?.final_food?.display_name||item?.original_resolution?.display_name||'').trim();
  }
  function shouldSuppressVoiceItem(item,all){
    const own=normalizeVoiceText(voiceItemText(item));
    if(!own||own.length<3)return false;
    const weak=!item?.final_food||String(item?.status||'').startsWith('needs_');
    if(!weak)return false;
    return all.some(other=>{
      if(!other||other===item||other.item_index===item.item_index||!other.final_food)return false;
      const otherText=normalizeVoiceText(voiceItemText(other));
      if(!otherText||otherText===own)return false;
      return otherText.includes(own)&&otherText.length>=own.length+4;
    });
  }
  function displayVoiceItems(items){
    return (Array.isArray(items)?items:[]).filter(item=>!shouldSuppressVoiceItem(item,items));
  }
  function renderVoiceEditor(message=''){
    const modal=ensureModal(),sheet=modal.querySelector('.mt-home-tool-sheet');if(!sheet)return;
    sheet.innerHTML=`<div class="mt-home-tool-grip"></div><button type="button" class="mt-home-tool-close" data-mt-home-close aria-label="Fermer">×</button><div class="mt-home-tool-mark">◉</div><div class="mt-home-tool-kicker">Corriger ma phrase</div><h2>On garde ton intention.</h2><p class="mt-home-tool-lead">Réécris simplement la phrase si besoin. Rien n’est ajouté tant que tu n’as pas confirmé.</p><div class="mt-voice-edit">${message?`<div class="mt-voice-status">${esc(message)}</div>`:''}<textarea id="mtVoiceEditText" placeholder="Ex. J’ai mangé deux œufs, deux tartines de pain complet et un demi-avocat.">${esc(voiceState.text)}</textarea><small>Astuce : sépare les éléments avec « et », puis précise les grammes seulement quand tu les connais vraiment.</small><button class="mt-home-tool-primary" type="button" id="mtVoiceEditGo">Comprendre cette phrase</button><button class="mt-home-tool-secondary" type="button" id="mtVoiceEditRetry">Réessayer le micro</button></div>`;
    sheet.querySelector('[data-mt-home-close]')?.addEventListener('click',()=>window.mtCloseHomeToolSheet());
    sheet.querySelector('#mtVoiceEditGo')?.addEventListener('click',()=>{const text=String(sheet.querySelector('#mtVoiceEditText')?.value||'').trim();if(text.length<3){window.mtToast?.('Décris simplement ce que tu as mangé.');return;}voiceState.text=text;voiceState.choices=[];resolveVoicePhrase(text,[]);});
    sheet.querySelector('#mtVoiceEditRetry')?.addEventListener('click',()=>window.mtOpenHomeVoiceMeal());
  }
  function renderVoiceLoader(text){
    return `<div class="mt-home-tool-grip"></div><button type="button" class="mt-home-tool-close" data-mt-home-close aria-label="Fermer">×</button><div class="mt-home-tool-mark">✷</div><div class="mt-home-tool-kicker">Compréhension Méthode TEE</div><h2>Je regarde ce que j’ai compris.</h2><p class="mt-home-tool-lead">Aucun aliment ni aucune quantité n’est ajouté sans ta confirmation.</p><section class="mt-voice-loader"><span class="mt-voice-loader-badge"><i>✦</i> analyse en cours</span><div class="mt-voice-loader-title">Carnet<br>vivant</div><p class="mt-voice-loader-sub">TEE relie ta phrase, tes repères alimentaires et les quantités déjà reconnues.</p><div class="mt-voice-loader-card"><div class="mt-voice-loader-book"><div class="mt-voice-loader-plate" aria-hidden="true"></div><div class="mt-voice-loader-copy"><b>Préparation du repas</b><h3>Écriture en cours…</h3><p>Nous mettons en forme ton repas avant de te le faire vérifier, sans rien ajouter automatiquement.</p><div class="mt-voice-loader-lines" aria-hidden="true"><i></i><i></i><i></i></div></div></div><div class="mt-voice-loader-progress" aria-hidden="true"><span></span></div><div class="mt-voice-loader-steps"><div class="mt-voice-loader-step"><em>✓</em><span>Phrase reçue</span></div><div class="mt-voice-loader-step"><em>•</em><span>Lecture des repères</span></div><div class="mt-voice-loader-step"><em>✦</em><span>Vérification à venir</span></div></div><div class="mt-voice-loader-foot">Merci pour ta confiance.</div></div><div class="mt-voice-loader-text"><b>${esc(text)}</b>Recherche dans ta bibliothèque Méthode TEE…</div></section>`;
  }

  function client(){try{return typeof initSupabase==='function'?initSupabase():window.supabaseClient||null;}catch(_){return null;}}
  async function resolveVoicePhrase(text,choices){
    if(voiceState.busy)return;voiceState.busy=true;
    const modal=ensureModal(),sheet=modal.querySelector('.mt-home-tool-sheet');
    if(sheet)sheet.innerHTML=renderVoiceLoader(text);
    sheet?.querySelector('[data-mt-home-close]')?.addEventListener('click',()=>window.mtCloseHomeToolSheet());
    try{
      const sb=client();if(!sb)throw new Error('Connexion au Carnet indisponible.');
      const {data,error}=await sb.rpc('resolve_food_speech_phrase_v4_json',{p_text:text,p_choices:Array.isArray(choices)?choices:[],p_limit_items:12});
      if(error)throw error;
      voiceState.text=text;voiceState.choices=Array.isArray(choices)?choices:[];voiceState.payload=data||{};
      renderVoiceResolution();
    }catch(e){
      const msg=String(e?.message||'TEE n’a pas pu analyser cette phrase pour le moment.');
      if(sheet)sheet.innerHTML=`<div class="mt-home-tool-grip"></div><button type="button" class="mt-home-tool-close" data-mt-home-close aria-label="Fermer">×</button><div class="mt-home-tool-mark">◉</div><div class="mt-home-tool-kicker">Le dire à TEE</div><h2>On garde ta phrase.</h2><div class="mt-voice-status is-error">${esc(msg)}</div><button class="mt-home-tool-primary" type="button" data-mt-voice-write>Corriger / réessayer</button><button class="mt-home-tool-secondary" type="button" data-mt-voice-search>Ajouter autrement dans le Carnet</button>`;
      sheet?.querySelector('[data-mt-home-close]')?.addEventListener('click',()=>window.mtCloseHomeToolSheet());
      sheet?.querySelector('[data-mt-voice-write]')?.addEventListener('click',()=>renderVoiceEditor('Ta phrase est conservée. Corrige-la si besoin.'));
      sheet?.querySelector('[data-mt-voice-search]')?.addEventListener('click',()=>location.href='food-meal.html?action=search&source=voice');
    }finally{voiceState.busy=false;}
  }

  function choiceFor(index){return voiceState.choices.find(x=>Number(x?.item_index)===Number(index))||null;}
  function setChoice(index,patch){
    const current=choiceFor(index)||{item_index:Number(index)};
    const next={...current,...patch,item_index:Number(index)};
    voiceState.choices=[...voiceState.choices.filter(x=>Number(x?.item_index)!==Number(index)),next].sort((a,b)=>a.item_index-b.item_index);
  }
  function quantityLabel(item){
    const h=item?.heard_quantity||{},portion=item?.portion||{};
    if(h.value!==null&&h.value!==undefined&&h.value!==''){
      const unit=h.unit_label||h.unit_code||'';return `${h.text||h.value}${unit?` ${unit}`:''}`;
    }
    if(item?.final_grams){return `${portion?.estimated?'≈ ':''}${Number(item.final_grams).toLocaleString('fr-FR',{maximumFractionDigits:1})} g`;}
    return 'Quantité à préciser';
  }
  function detailOptions(item){
    const follow=Array.isArray(item?.selected_option?.followup_options)?item.selected_option.followup_options:[];
    if(follow.length)return follow;
    return Array.isArray(item?.alternatives)?item.alternatives:[];
  }
  function renderVoiceResolution(){
    const payload=voiceState.payload||{},rawItems=Array.isArray(payload.items)?payload.items:[],items=displayVoiceItems(rawItems),modal=ensureModal(),sheet=modal.querySelector('.mt-home-tool-sheet');if(!sheet)return;
    const itemHTML=items.map(item=>{
      const name=item?.final_food?.display_name||item?.original_resolution?.display_name||item?.food_text||'Aliment';
      const current=choiceFor(item.item_index),options=detailOptions(item);
      const optionHTML=options.length?`<div class="mt-voice-options">${options.map(o=>{const key=o.option_key||o.key||'';const selected=String(current?.option_key||'')===String(key);return `<button type="button" class="${selected?'is-selected':''}" data-mt-voice-option="${esc(item.item_index)}" data-mt-voice-key="${esc(key)}">${esc(o.display_name||o.label||key)}</button>`;}).join('')}</div>`:'';
      const portionStatus=String(item?.portion?.status||'');
      const needGrams=!item?.ready_for_confirmation&&item?.final_food&&(portionStatus.includes('needs_quantity')||!item?.final_grams);
      const gramsHTML=needGrams?`<div class="mt-voice-grams"><input type="number" min="1" max="2000" step="1" inputmode="decimal" placeholder="Quantité en g" data-mt-voice-grams="${esc(item.item_index)}" value="${esc(current?.grams_override||'')}"><span>g</span></div>`:'';
      const detail=item?.selected_option?.followup_prompt||(!item?.final_food&&item?.status==='needs_detail'?'Précise simplement la préparation.':'');
      const estimated=item?.portion?.estimated?'<p>Quantité estimée à partir de tes repères de portion · à confirmer.</p>':'';
      return `<article class="mt-voice-item"><div class="mt-voice-item-head"><b>${esc(name)}</b><span>${esc(quantityLabel(item))}</span></div>${detail?`<p>${esc(detail)}</p>`:''}${estimated}${optionHTML}${gramsHTML}${item?.status==='needs_search'?`<button class="mt-home-tool-secondary" type="button" data-mt-voice-search-item="${esc(item.item_index)}">Rechercher cet aliment</button>`:''}</article>`;
    }).join('');
    const ready=items.length?items.every(item=>{
      const current=choiceFor(item.item_index),portionStatus=String(item?.portion?.status||'');
      const needGrams=!item?.ready_for_confirmation&&item?.final_food&&(portionStatus.includes('needs_quantity')||!item?.final_grams);
      if(needGrams)return Number.isFinite(Number(current?.grams_override))&&Number(current?.grams_override)>0;
      if(item?.status==='needs_search')return false;
      const options=detailOptions(item);
      if(options.length)return String(current?.option_key||'').trim().length>0;
      return !!item?.ready_for_confirmation||!!item?.ready_to_add;
    }):false;
    sheet.innerHTML=`<div class="mt-home-tool-grip"></div><button type="button" class="mt-home-tool-close" data-mt-home-close aria-label="Fermer">×</button><div class="mt-home-tool-mark">✷</div><div class="mt-home-tool-kicker">Vérifie ce que j’ai compris</div><h2>${items.length?`${items.length} repère${items.length>1?'s':''} dans ton repas.`:'Je n’ai pas encore assez compris.'}</h2><p class="mt-home-tool-lead">Corrige seulement ce qui en a besoin. Les grammes prononcés restent exacts ; les portions estimées restent clairement indiquées.</p><div class="mt-voice-items">${itemHTML||'<div class="mt-voice-status">Aucun aliment n’a été résolu. Utilise la recherche du Carnet pour ce repas.</div>'}</div>${ready?'<button class="mt-home-tool-primary" type="button" id="mtVoiceConfirm">Confirmer et continuer</button>':'<div class="mt-voice-status">Il reste au moins une précision à choisir avant de continuer.</div>'}<button class="mt-home-tool-secondary" type="button" id="mtVoiceEditPhrase">Modifier ma phrase</button>`;
    sheet.querySelector('[data-mt-home-close]')?.addEventListener('click',()=>window.mtCloseHomeToolSheet());
    sheet.querySelectorAll('[data-mt-voice-option]').forEach(btn=>btn.addEventListener('click',()=>{setChoice(Number(btn.dataset.mtVoiceOption),{option_key:btn.dataset.mtVoiceKey,confirmed:false});resolveVoicePhrase(voiceState.text,voiceState.choices);}));
    let voiceGramTimer=0;
    const scheduleRefresh=()=>{clearTimeout(voiceGramTimer);voiceGramTimer=setTimeout(()=>resolveVoicePhrase(voiceState.text,voiceState.choices),260);};
    sheet.querySelectorAll('[data-mt-voice-grams]').forEach(inp=>{
      const sync=()=>{const grams=Number(inp.value);if(Number.isFinite(grams)&&grams>0){setChoice(Number(inp.dataset.mtVoiceGrams),{grams_override:grams,confirmed:false});scheduleRefresh();}};
      inp.addEventListener('input',sync);inp.addEventListener('change',sync);inp.addEventListener('blur',sync);inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sync();}});
    });
    sheet.querySelectorAll('[data-mt-voice-search-item]').forEach(btn=>btn.addEventListener('click',()=>{sessionStorage.setItem('mt_voice_search_hint_v1',String(items.find(x=>Number(x.item_index)===Number(btn.dataset.mtVoiceSearchItem))?.food_text||''));location.href='food-meal.html?action=search&source=voice';}));
    sheet.querySelector('#mtVoiceEditPhrase')?.addEventListener('click',()=>renderVoiceEditor('Corrige simplement ta phrase puis relance la compréhension.'));
    sheet.querySelector('#mtVoiceConfirm')?.addEventListener('click',confirmVoiceMeal);
  }

  async function confirmVoiceMeal(){
    // Récupère aussi les éventuelles quantités tapées mais pas encore sorties du champ.
    document.querySelectorAll('[data-mt-voice-grams]').forEach(inp=>{const grams=Number(inp.value);if(Number.isFinite(grams)&&grams>0)setChoice(Number(inp.dataset.mtVoiceGrams),{grams_override:grams});});
    const items=Array.isArray(voiceState.payload?.items)?voiceState.payload.items:[];
    items.forEach(item=>setChoice(item.item_index,{confirmed:true}));
    const button=document.getElementById('mtVoiceConfirm');if(button){button.disabled=true;button.textContent='Préparation du Carnet…';}
    try{
      const sb=client();if(!sb)throw new Error('Connexion au Carnet indisponible.');
      const {data,error}=await sb.rpc('resolve_food_speech_phrase_v4_json',{p_text:voiceState.text,p_choices:voiceState.choices,p_limit_items:12});if(error)throw error;
      voiceState.payload=data||{};
      if(!data?.ready_to_add){renderVoiceResolution();window.mtToast?.('Il reste une précision à confirmer.');return;}
      const draftItems=(data.items||[]).filter(x=>x?.ready_to_add&&x?.final_food).map(x=>({
        ciqual_code:x.final_food.ciqual_code||null,
        dictionary_id:x.final_food.dictionary_id||null,
        name:x.final_food.display_name||x.final_food.canonical_name||x.food_text||'Aliment',
        grams:Number(x.final_grams)||null,
        source_kind:x.final_food.source_kind||null,
        estimated:!!x.portion?.estimated,
        voice_item_index:x.item_index
      })).filter(x=>x.grams>0);
      if(!draftItems.length)throw new Error('Aucun aliment prêt à transmettre au Carnet.');
      sessionStorage.setItem(VOICE_DRAFT_KEY,JSON.stringify({version:1,input:voiceState.text,created_at:new Date().toISOString(),items:draftItems}));
      location.href='food-meal.html?source=voice';
    }catch(e){window.mtToast?.(String(e?.message||'Impossible de préparer ce repas.'),'error');if(button){button.disabled=false;button.textContent='Confirmer et continuer';}}
  }

  async function loadScriptOnce(src,id){
    if(id&&document.getElementById(id))return;
    await new Promise((resolve,reject)=>{const s=document.createElement('script');if(id)s.id=id;s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
  }
  async function getPersonalDecision(rawOnly=true){
    await loadScriptOnce('scripts/personal-reference.js?v=v476-learning-15-r1','mtHomePersonalReferenceScript');
    await loadScriptOnce('scripts/adaptive-reference.js?v=v476-learning-15-r1','mtHomeAdaptiveReferenceScript');
    const ctx=await window.MTReference?.context?.();if(!ctx)throw new Error('Tes repères ne sont pas encore disponibles.');
    const model=window.MTReference.buildModel(ctx);const decision=rawOnly?window.MTAdaptive?.buildRaw?.(model):window.MTAdaptive?.build?.(model);
    if(!decision)throw new Error('Ton repère est encore en construction.');
    return {model,decision};
  }
  function decisionHTML(decision,experience=false){
    const reasons=Array.isArray(decision?.reasons)?decision.reasons:[];
    const cycle=decision?.cycle,day=Math.max(1,Math.min(7,Number(cycle?.day)||1));
    return `<div class="mt-home-ref-box"><b>${esc(decision?.title||'Ton repère se construit')}</b><p>${esc(decision?.summary||'Méthode TEE continue d’observer tes journées sans forcer de conclusion.')}</p></div>${cycle?`<div class="mt-home-exp-days">${Array.from({length:7},(_,i)=>`<i class="${i+1<day?'is-done':i+1===day?'is-current':''}"></i>`).join('')}</div>`:''}<div class="mt-home-ref-action"><b>${experience?'Le geste testé':'Ton geste aujourd’hui'}</b>${esc(decision?.action||'Continue simplement à documenter les repères qui comptent pour toi.')}</div>${reasons.length?`<ul class="mt-home-ref-reasons">${reasons.slice(0,3).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}`;
  }

  window.mtOpenHomeReference=async function(){
    openHTML(`<div class="mt-home-tool-mark">✦</div><div class="mt-home-tool-kicker">Ton repère aujourd’hui</div><h2>Je relie tes repères.</h2><p class="mt-home-tool-lead">Cette lecture ne se charge qu’au toucher : l’Accueil reste léger.</p><div class="mt-voice-status">Préparation de ton repère personnel…</div>`);
    try{
      const {decision}=await getPersonalDecision(true);writeSnapshot('reference',{short:shortLabel(decision.title,'Voir aujourd’hui')});
      const caption=document.getElementById('mtHomeReferenceCaption');if(caption)caption.textContent=shortLabel(decision.title,'Voir aujourd’hui');
      openHTML(`<div class="mt-home-tool-mark">✦</div><div class="mt-home-tool-kicker">Ton repère aujourd’hui</div><h2>Voilà ce qui compte maintenant.</h2><p class="mt-home-tool-lead">Un seul repère à la fois, à partir de ce que tu as réellement renseigné.</p>${decisionHTML(decision,false)}<button class="mt-home-tool-footer" type="button" data-mt-open-today>Ouvrir Aujourd’hui →</button>`);
      document.querySelector('[data-mt-open-today]')?.addEventListener('click',()=>{window.mtCloseHomeToolSheet();setTimeout(()=>window.mtOpenTodaySheet?.(),150);});
    }catch(e){openHTML(`<div class="mt-home-tool-mark">✦</div><div class="mt-home-tool-kicker">Ton repère aujourd’hui</div><h2>Ton historique se construit.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'Continue simplement à renseigner tes journées.'))}</p><div class="mt-home-ref-action"><b>Aujourd’hui</b>Renseigne seulement ce qui t’aide réellement. Méthode TEE évite d’inventer une priorité quand elle n’a pas assez de données.</div>`);}
  };

  window.mtOpenHomeExperiences=async function(){
    openHTML(`<div class="mt-home-tool-mark">↻</div><div class="mt-home-tool-kicker">Mes expériences</div><h2>Découvrir ce qui te réussit.</h2><p class="mt-home-tool-lead">TEE cherche un seul levier pertinent à tester plusieurs jours, puis le réévalue.</p><div class="mt-voice-status">Lecture de tes repères comparables…</div>`);
    try{
      const {model,decision}=await getPersonalDecision(true);expState.model=model;expState.raw=decision;
      const actionable=['recovery','protein','density','energy_review'].includes(String(decision.key||''));
      writeSnapshot('experience',{short:actionable?shortLabel(decision.title,'Expérience proposée'):'À construire'});const caption=document.getElementById('mtHomeExperienceCaption');if(caption)caption.textContent=actionable?shortLabel(decision.title,'Expérience proposée'):'À construire';
      openHTML(`<div class="mt-home-tool-mark">↻</div><div class="mt-home-tool-kicker">Mes expériences</div><h2>${actionable?'Une expérience se dessine.':'On ne force pas une expérience.'}</h2><p class="mt-home-tool-lead">${actionable?'Teste un seul geste pendant 7 jours puis compare avec tes journées précédentes.':'Quand les données ne racontent pas encore une histoire assez claire, Méthode TEE continue simplement d’observer.'}</p>${decisionHTML(decision,true)}${actionable?'<button class="mt-home-tool-primary" type="button" id="mtHomeStartExperience">Commencer cette expérience</button>':''}`);
      document.getElementById('mtHomeStartExperience')?.addEventListener('click',startHomeExperience);
    }catch(e){openHTML(`<div class="mt-home-tool-mark">↻</div><div class="mt-home-tool-kicker">Mes expériences</div><h2>Pas encore assez de journées comparables.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'Continue à documenter tes repères.'))}</p>`);}
  };
  async function startHomeExperience(){
    try{
      const decision=window.MTAdaptive?.build?.(expState.model);if(!decision)throw new Error('Impossible de démarrer cette expérience.');
      writeSnapshot('experience',{short:`${shortLabel(decision.title,'Expérience')} · J${Number(decision?.cycle?.day)||1}/7`});const caption=document.getElementById('mtHomeExperienceCaption');if(caption)caption.textContent=`${shortLabel(decision.title,'Expérience')} · J${Number(decision?.cycle?.day)||1}/7`;
      openHTML(`<div class="mt-home-tool-mark">↻</div><div class="mt-home-tool-kicker">Expérience en cours</div><h2>On observe pendant 7 jours.</h2><p class="mt-home-tool-lead">Rien n’est modifié automatiquement. Tu notes simplement si tu as appliqué le repère, puis TEE réévalue.</p>${decisionHTML(decision,true)}${decision?.cycle?.startedOn?`<button class="mt-home-tool-primary" type="button" id="mtHomeExperimentCheckin" ${decision?.cycle?.appliedToday?'disabled':''}>${decision?.cycle?.appliedToday?'✓ Repère appliqué aujourd’hui':'J’ai appliqué ce repère aujourd’hui'}</button>`:''}`);
      const btn=document.getElementById('mtHomeExperimentCheckin');if(btn&&!decision?.cycle?.appliedToday)btn.addEventListener('click',async()=>{btn.disabled=true;btn.textContent='Enregistrement…';try{const sb=client();const {error}=await sb.rpc('mt_adaptive_cycle_checkin',{p_cycle_started_on:decision.cycle.startedOn,p_lever_key:decision.key,p_applied:true});if(error)throw error;btn.textContent='✓ Repère appliqué aujourd’hui';window.MTReference?.invalidate?.();}catch(_){btn.disabled=false;btn.textContent='Réessayer';}});
    }catch(e){window.mtToast?.(String(e?.message||'Impossible de démarrer cette expérience.'),'error');}
  }

  injectCSS();
})();
