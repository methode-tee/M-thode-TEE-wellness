/* MÉTHODE TEE — V486.5.1 · Voice UX fluide + suppression + pauses
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
  let speechStopRequested=false;
  let speechRestartTimer=0;
  let speechPermissionReady=false;
  const voiceState={
    text:'',
    choices:[],
    payload:null,
    busy:false,
    committedText:'',
    currentChunk:'',
    removedIndexes:new Set(),
    initialAnalysisDone:false
  };
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
      .mt-home-tool-footer{width:100%;margin-top:15px;border:0;background:transparent;color:#8f713a;font-size:11px;font-weight:850;padding:11px}.mt-home-tool-primary{width:100%;border:0;border-radius:999px;background:#17483e;color:#fff;padding:15px 18px;font-weight:900;font-size:12px;letter-spacing:.035em;margin-top:15px}.mt-home-tool-primary:disabled{opacity:.48}.mt-home-tool-secondary{width:100%;border:1px solid #cfb77f;border-radius:999px;background:transparent;color:#17483e;padding:13px 16px;font-weight:850;margin-top:9px}.mt-home-tool-tertiary{display:inline-flex;align-items:center;justify-content:center;gap:6px;margin:12px auto 0;padding:6px 10px;border:0;background:transparent;color:#8f713a;font-size:11px;font-weight:850;text-decoration:underline;text-underline-offset:2px}
      .mt-voice-stage{text-align:center;padding:8px 0 2px}.mt-voice-orb{width:84px;height:84px;border-radius:50%;margin:6px auto 14px;display:grid;place-items:center;background:radial-gradient(circle at 38% 30%,#fff9ea,#e9d9b9);border:1px solid rgba(177,138,67,.32);color:#17483e;font-size:28px;box-shadow:0 12px 34px rgba(88,68,38,.09)}.mt-voice-orb.is-listening{animation:mtVoicePulse 1.4s ease-in-out infinite}.mt-voice-transcript{min-height:74px;padding:14px;border-radius:18px;background:#f6efe4;color:#17483e;font-family:var(--font-serif,"Cormorant Garamond",Georgia,serif);font-size:24px;line-height:1.15;text-align:left}.mt-voice-hint{font-size:10px;line-height:1.45;color:#928578;margin:10px 2px}.mt-voice-fallback{width:100%;min-height:105px;resize:vertical;border:1px solid #dfd2bc;border-radius:18px;background:#fffdf9;padding:14px;font:inherit;font-size:16px;color:#17483e;outline:none}.mt-voice-fallback:focus{border-color:#b08a43}
      @keyframes mtVoicePulse{0%,100%{transform:scale(1);box-shadow:0 12px 34px rgba(88,68,38,.09)}50%{transform:scale(1.035);box-shadow:0 12px 42px rgba(176,138,67,.23)}}
      .mt-voice-items{display:grid;gap:11px}.mt-voice-item{border:1px solid rgba(31,72,61,.11);border-radius:20px;background:#fffdf8;padding:14px}.mt-voice-item-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px}.mt-voice-item-head b{color:#17483e;font-size:14px}.mt-voice-item-meta{display:flex;align-items:center;justify-content:flex-end;gap:8px}.mt-voice-item-meta>span{color:#9b793b;font-size:11px;font-weight:850;text-align:right;max-width:118px}.mt-voice-item-remove{width:27px;height:27px;flex:0 0 27px;border:1px solid rgba(177,138,67,.22);border-radius:50%;background:#f7f0e5;color:#6e776f;display:grid;place-items:center;padding:0;font:500 17px/1 Arial,sans-serif;box-shadow:none}.mt-voice-item-remove:active{transform:scale(.94);background:#efe4d4}.mt-voice-item p{font-size:11px;line-height:1.45;color:#88796d;margin:6px 0 0}.mt-voice-options{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.mt-voice-options button{border:1px solid #d6c19a;border-radius:999px;background:#fffaf2;color:#17483e;padding:9px 11px;font-size:10px;font-weight:850}.mt-voice-options button.is-selected{background:#17483e;border-color:#17483e;color:#fff}.mt-voice-grams{display:flex;align-items:center;gap:8px;margin-top:11px}.mt-voice-grams input{min-width:0;flex:1;border:1px solid #dbcbae;border-radius:14px;background:#fff;padding:11px 12px;font-size:16px;color:#17483e}.mt-voice-grams span{font-size:11px;font-weight:900;color:#8b7b6d}.mt-voice-status{margin:12px 0;padding:12px 13px;border-radius:16px;background:#f4ecdf;font-size:11px;line-height:1.5;color:#75675b}.mt-voice-status.is-error{background:#f8ebe6;color:#8d4a3a}.mt-voice-status b{color:#17483e}
      .mt-voice-edit{display:grid;gap:12px}.mt-voice-edit textarea{width:100%;min-height:124px;resize:vertical;border:1px solid #dfd2bc;border-radius:20px;background:#fffdf9;padding:16px 15px;font:inherit;font-size:16px;line-height:1.45;color:#17483e;outline:none}.mt-voice-edit textarea:focus{border-color:#b08a43}.mt-voice-edit small{display:block;color:#8f8174;line-height:1.5}
      .mt-voice-loader{position:relative;overflow:hidden;border:1px solid rgba(208,191,160,.58);border-radius:24px;background:linear-gradient(180deg,#fffdf9,#faf5ec);padding:16px;margin-top:8px;box-shadow:0 12px 32px rgba(67,51,29,.06)}.mt-voice-loader-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.mt-voice-loader-badge{display:inline-flex;align-items:center;gap:7px;color:#a9833e;font-size:9px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}.mt-voice-loader-badge i{font-style:normal;font-size:12px}.mt-voice-loader-time{font-size:9px;color:#aa9d8f}.mt-voice-notebook{position:relative;margin-top:14px;padding:15px 14px 13px 24px;border-radius:18px;background:repeating-linear-gradient(180deg,#fffdf8 0,#fffdf8 27px,#eee4d4 28px);border:1px solid rgba(220,205,179,.68);min-height:138px}.mt-voice-notebook:before{content:'';position:absolute;left:13px;top:10px;bottom:10px;width:1px;background:rgba(176,138,67,.26)}.mt-voice-notebook-title{font-family:var(--font-serif,"Cormorant Garamond",Georgia,serif);font-size:23px;line-height:1;color:#17483e;margin-bottom:10px}.mt-voice-write-row{position:relative;height:22px;margin:0 0 5px;overflow:hidden}.mt-voice-write-row span{position:absolute;left:0;top:2px;height:2px;border-radius:999px;background:linear-gradient(90deg,#17483e,#8b7b5b);transform-origin:left center;animation:mtNotebookWrite 1.35s cubic-bezier(.22,.8,.25,1) infinite alternate}.mt-voice-write-row:nth-child(2) span{width:78%;animation-delay:.12s}.mt-voice-write-row:nth-child(3) span{width:61%;animation-delay:.24s}.mt-voice-write-row:nth-child(4) span{width:46%;animation-delay:.36s}.mt-voice-pen{position:absolute;right:17px;bottom:15px;width:58px;height:16px;transform:rotate(-9deg);animation:mtNotebookPen 1.65s ease-in-out infinite}.mt-voice-pen:before{content:'';position:absolute;left:0;top:6px;width:45px;height:5px;border-radius:999px;background:linear-gradient(90deg,#c3a15d,#8e6e34)}.mt-voice-pen:after{content:'';position:absolute;right:0;top:4px;border-left:10px solid #17483e;border-top:4px solid transparent;border-bottom:4px solid transparent}.mt-voice-loader-copy{margin-top:12px;display:flex;align-items:flex-start;gap:9px}.mt-voice-loader-copy i{width:24px;height:24px;flex:0 0 24px;border-radius:50%;display:grid;place-items:center;background:#f1e7d6;color:#a9833e;font-style:normal;font-size:11px}.mt-voice-loader-copy div{min-width:0}.mt-voice-loader-copy b{display:block;color:#17483e;font-size:11px;margin-bottom:3px}.mt-voice-loader-copy p{margin:0;color:#8d8074;font-size:10px;line-height:1.45}.mt-voice-loader-phrase{margin-top:11px;padding:10px 12px;border-radius:14px;background:#f5eee3;color:#75685d;font-size:10px;line-height:1.45}.mt-voice-loader-phrase b{color:#17483e;font-weight:850}.mt-voice-loader-dots{display:inline-flex;gap:4px;margin-left:5px;vertical-align:middle}.mt-voice-loader-dots i{width:4px;height:4px;border-radius:50%;background:#b08a43;animation:mtLoaderDot 1s ease-in-out infinite}.mt-voice-loader-dots i:nth-child(2){animation-delay:.14s}.mt-voice-loader-dots i:nth-child(3){animation-delay:.28s}
      @keyframes mtNotebookWrite{0%{transform:scaleX(.25);opacity:.42}100%{transform:scaleX(1);opacity:.92}}@keyframes mtNotebookPen{0%,100%{transform:translateX(-4px) rotate(-9deg)}50%{transform:translateX(7px) translateY(-2px) rotate(-6deg)}}@keyframes mtLoaderDot{0%,100%{opacity:.28;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}
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
    clearTimeout(speechRestartTimer);speechRestartTimer=0;speechStopRequested=true;
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

  function joinedSpeechText(chunk=''){
    return [String(voiceState.committedText||'').trim(),String(chunk||'').trim()].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  }
  function resetVoiceCaptureState(){
    clearTimeout(speechRestartTimer);speechRestartTimer=0;
    speechStopRequested=false;speechListening=false;
    voiceState.text='';voiceState.choices=[];voiceState.payload=null;voiceState.busy=false;
    voiceState.committedText='';voiceState.currentChunk='';
    voiceState.removedIndexes=new Set();
    voiceState.initialAnalysisDone=false;
  }
  async function restartSpeechAfterPause(plugin){
    clearTimeout(speechRestartTimer);
    speechRestartTimer=setTimeout(async()=>{
      if(speechStopRequested||!document.getElementById('mtVoiceBody'))return;
      try{
        await plugin.start({locale:'fr-FR',onDeviceOnly:true});
        speechListening=true;
        const orb=document.getElementById('mtVoiceOrb');orb?.classList.add('is-listening');
        const box=document.getElementById('mtVoiceTranscript');
        if(box)box.textContent=voiceState.text?`${voiceState.text} …`:'Je t’écoute…';
        const button=document.getElementById('mtVoiceStart');
        if(button){button.disabled=false;button.textContent='J’ai terminé';}
      }catch(e){
        renderVoiceFallback(String(e?.message||'La dictée s’est interrompue. Ta phrase est conservée.'));
      }
    },180);
  }
  async function finishNativeSpeech(plugin){
    const button=document.getElementById('mtVoiceStart');
    if(button){button.disabled=true;button.textContent='Compréhension…';}
    speechStopRequested=true;
    clearTimeout(speechRestartTimer);speechRestartTimer=0;
    if(speechListening){
      try{await plugin.stop();}
      catch(_){
        speechListening=false;
        const text=String(voiceState.text||voiceState.committedText||'').trim();
        if(text)resolveVoicePhrase(text,[],2000);
        else renderVoiceFallback('La dictée s’est interrompue. Tu peux écrire ta phrase.');
      }
    }else{
      const text=String(voiceState.text||voiceState.committedText||'').trim();
      if(text)resolveVoicePhrase(text,[],2000);
      else renderVoiceFallback('Je n’ai pas réussi à entendre une phrase complète. Tu peux réessayer ou l’écrire.');
    }
  }
  async function setupSpeechListeners(plugin){
    await clearSpeechListeners();
    if(!plugin?.addListener)return;
    speechHandles.push(await plugin.addListener('speechPartial',event=>{
      const chunk=String(event?.text||'').trim();if(!chunk)return;
      voiceState.currentChunk=chunk;voiceState.text=joinedSpeechText(chunk);
      const box=document.getElementById('mtVoiceTranscript');if(box)box.textContent=voiceState.text;
    }));
    speechHandles.push(await plugin.addListener('speechFinal',event=>{
      const segment=String(event?.text||voiceState.currentChunk||'').trim();
      if(segment)voiceState.committedText=joinedSpeechText(segment);
      voiceState.currentChunk='';voiceState.text=String(voiceState.committedText||'').trim();
      speechListening=false;
      if(speechStopRequested){
        const text=voiceState.text;
        speechStopRequested=false;
        if(!text){renderVoiceFallback('Je n’ai pas réussi à entendre une phrase complète. Tu peux réessayer ou l’écrire.');return;}
        resolveVoicePhrase(text,[],2000);
        return;
      }
      // iOS peut finaliser un segment après une pause naturelle. On garde la phrase
      // déjà dite puis on rouvre automatiquement l'écoute au lieu de lancer l'analyse.
      const box=document.getElementById('mtVoiceTranscript');if(box&&voiceState.text)box.textContent=`${voiceState.text} …`;
      restartSpeechAfterPause(plugin);
    }));
    speechHandles.push(await plugin.addListener('speechError',event=>{
      speechListening=false;
      const kept=String(voiceState.text||voiceState.committedText||'').trim();
      if(!speechStopRequested&&kept){
        // Une petite coupure après une phrase déjà entendue ne fait plus perdre la dictée.
        restartSpeechAfterPause(plugin);
        return;
      }
      speechStopRequested=false;
      renderVoiceFallback(String(event?.message||'Le micro local est momentanément indisponible.'));
    }));
  }

  window.mtOpenHomeVoiceMeal=async function(){
    resetVoiceCaptureState();
    try{speechPermissionReady=sessionStorage.getItem('mt_speech_permission_ready_v1')==='1';}catch(_){}
    openHTML(`<div class="mt-home-tool-mark">◉</div><div class="mt-home-tool-kicker">Le dire à TEE</div><h2>Je t’écoute.</h2><p class="mt-home-tool-lead">Parle comme tu le ferais naturellement. La transcription reste sur l’iPhone lorsque la reconnaissance locale est disponible.</p><div id="mtVoiceBody"><div class="mt-voice-stage"><div class="mt-voice-orb" id="mtVoiceOrb">◉</div><div class="mt-voice-transcript" id="mtVoiceTranscript">« J’ai mangé… »</div><p class="mt-voice-hint">Tu peux réfléchir quelques secondes : TEE garde ce que tu as déjà dit. Rien n’est ajouté sans confirmation.</p><button class="mt-home-tool-primary" type="button" id="mtVoiceStart">Commencer à parler</button></div></div>`);
    const start=document.getElementById('mtVoiceStart');if(start)start.onclick=startNativeSpeech;
  };

  async function startNativeSpeech(){
    const button=document.getElementById('mtVoiceStart');
    if(button){button.disabled=true;button.textContent='Ouverture du micro…';}
    const plugin=nativeSpeechPlugin();
    if(!plugin){renderVoiceFallback('Sur cet écran, le micro local n’est pas disponible. Écris simplement ta phrase : le moteur TEE qui la comprend reste le même.');return;}
    speechStopRequested=false;
    try{
      // V486.5.1 : le plugin natif revalide lui-même disponibilité + mode local.
      // On évite donc l'ancien double aller-retour isAvailable + permissions à chaque essai.
      if(!speechPermissionReady){
        const permissions=await plugin.requestPermissions();
        if(!permissions?.granted){renderVoiceFallback('Le microphone ou la reconnaissance vocale n’est pas autorisé. Tu peux modifier ces autorisations dans Réglages, ou écrire ta phrase.');return;}
        speechPermissionReady=true;
        try{sessionStorage.setItem('mt_speech_permission_ready_v1','1');}catch(_){}
      }
      await setupSpeechListeners(plugin);
      await plugin.start({locale:'fr-FR',onDeviceOnly:true});
      speechListening=true;
      const orb=document.getElementById('mtVoiceOrb');orb?.classList.add('is-listening');
      const transcript=document.getElementById('mtVoiceTranscript');if(transcript)transcript.textContent=voiceState.text||'Je t’écoute…';
      if(button){button.disabled=false;button.textContent='J’ai terminé';button.onclick=()=>finishNativeSpeech(plugin);}
    }catch(e){
      speechPermissionReady=false;
      try{sessionStorage.removeItem('mt_speech_permission_ready_v1');}catch(_){}
      renderVoiceFallback(String(e?.message||'Le micro local n’a pas pu démarrer.'));
    }
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
  const MT_VOICE_CONTEXT_ONLY_TERMS=new Set([
    // Marques / enseignes qui décrivent le contexte du repas, pas un aliment.
    'mcdo','mcdonalds','mcdonald s','mcdonald',
    // Origines réellement présentes dans la bibliothèque culturelle Méthode TEE.
    'cameroun','maroc','japon','thailande','senegal','nigeria','ghana','algerie',
    'tunisie','chine','cote d ivoire','maghreb','afrique de l ouest','france',
    // Fragments de portion/service que la dictée iOS peut isoler autour d'une pause.
    'portion','portions','petite portion','petites portions','moyenne portion',
    'moyennes portions','grande portion','grandes portions',
    'assiette','assiettes','bol','bols','verre','verres','bouteille','bouteilles',
    'canette','canettes','barquette','barquettes',
    // Modificateurs : utiles accolés à un aliment, jamais comme repère autonome.
    'nature','maison','fait maison','sans sucre','sans sucres','sans sauce',
    'grille','grillee','grilles','grillees','cuit','cuite','cuits','cuites',
    'cru','crue','crus','crues','frit','fritee','frits','fritees',
    // Hésitations / connecteurs fréquemment produits par une dictée naturelle.
    'euh','heu','hum','bah','ben','genre','du coup','ensuite','puis','aussi'
  ]);
  function voiceResolvedTexts(item){
    return [
      item?.raw_segment,
      item?.food_text,
      item?.final_food?.display_name,
      item?.final_food?.canonical_name,
      item?.original_resolution?.display_name
    ].map(normalizeVoiceText).filter(Boolean);
  }
  function voiceWholeContains(haystack,needle){
    const h=` ${normalizeVoiceText(haystack)} `,n=` ${normalizeVoiceText(needle)} `;
    return n.trim().length>=3&&h.includes(n);
  }
  function isVoiceQuantityOrUnitFragment(own){
    if(!own)return false;
    if(/^(?:un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|\d+(?:[.,]\d+)?)$/.test(own))return true;
    if(/^(?:\d+(?:[.,]\d+)?|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt)\s+(?:g|gr|gramme|grammes|kg|ml|cl|l|litre|litres|piece|pieces|part|parts|portion|portions)$/.test(own))return true;
    return false;
  }
  function prepareVoiceRpcText(text){
    let s=String(text||'');
    const brand="(?:mcdo|mcdonald(?:['’]s|s)?)";
    // Quand Siri ponctue « frites, McDo », la marque appartient encore aux frites.
    s=s.replace(new RegExp(`\\b(frites?)\\s*[,;:]\\s*(${brand})\\b`,'gi'),'$1 $2');
    s=s.replace(new RegExp(`\\b(${brand})\\s*[,;:]\\s*(?:des?\\s+)?(frites?)\\b`,'gi'),'$2 $1');
    // Même logique pour les burgers génériques.
    s=s.replace(new RegExp(`\\b(cheeseburger|hamburger|burger)\\s*[,;:]\\s*(${brand})\\b`,'gi'),'$1 $2');
    s=s.replace(new RegExp(`\\b(${brand})\\s*[,;:]\\s*(?:un(?:e)?\\s+)?(cheeseburger|hamburger|burger)\\b`,'gi'),'$2 $1');
    // Pour les nuggets on ne propage la marque que si le nombre a été réellement dit.
    // Sans nombre, TEE doit encore demander la quantité au lieu d'inventer 4/6/9/20.
    const counted="(?:4|quatre|6|six|9|neuf|20|vingt)\\s+nuggets?";
    s=s.replace(new RegExp(`\\b(${counted})\\s*[,;:]\\s*(${brand})\\b`,'gi'),'$1 $2');
    s=s.replace(new RegExp(`\\b(${brand})\\s*[,;:]\\s*(?:des?\\s+)?(${counted})\\b`,'gi'),'$2 $1');
    // Ice Tea peut être une référence produit lorsqu'une enseigne est explicitement dite.
    s=s.replace(new RegExp(`\\b(ice[ -]?tea)\\s*[,;:]\\s*(${brand})\\b`,'gi'),'$1 $2');
    s=s.replace(new RegExp(`\\b(${brand})\\s*[,;:]\\s*(?:un(?:e)?\\s+)?(ice[ -]?tea)\\b`,'gi'),'$2 $1');
    return s;
  }
  function shouldSuppressVoiceItem(item,all){
    const own=normalizeVoiceText(voiceItemText(item));
    if(!own||own.length<3)return false;
    const weak=!item?.final_food||String(item?.status||'').startsWith('needs_');
    if(!weak)return false;
    const many=Array.isArray(all)&&all.length>=2;
    if(!many)return false;

    // 1) Contexte pur / unité / hésitation : jamais un repère autonome dans un repas multi-items.
    if(MT_VOICE_CONTEXT_ONLY_TERMS.has(own)||isVoiceQuantityOrUnitFragment(own))return true;

    // 2) Blindage générique lié à la bibliothèque :
    // si le fragment faible (« Maroc », « nature », « grande portion », « pêche »...)
    // est déjà contenu comme mot entier dans l'identité d'un AUTRE aliment résolu,
    // il s'agit d'un qualificatif détaché par la dictée, pas d'un nouvel aliment.
    return all.some(other=>{
      if(!other||other===item||other.item_index===item.item_index||!other.final_food)return false;
      return voiceResolvedTexts(other).some(t=>t!==own&&voiceWholeContains(t,own));
    });
  }
  function displayVoiceItems(items){
    return (Array.isArray(items)?items:[]).filter(item=>{
      if(voiceState.removedIndexes?.has?.(Number(item?.item_index)))return false;
      return !shouldSuppressVoiceItem(item,items);
    });
  }
  function renderVoiceEditor(message=''){
    const modal=ensureModal(),sheet=modal.querySelector('.mt-home-tool-sheet');if(!sheet)return;
    sheet.innerHTML=`<div class="mt-home-tool-grip"></div><button type="button" class="mt-home-tool-close" data-mt-home-close aria-label="Fermer">×</button><div class="mt-home-tool-mark">◉</div><div class="mt-home-tool-kicker">Corriger ma phrase</div><h2>On garde ton intention.</h2><p class="mt-home-tool-lead">Réécris simplement la phrase si besoin. Rien n’est ajouté tant que tu n’as pas confirmé.</p><div class="mt-voice-edit">${message?`<div class="mt-voice-status">${esc(message)}</div>`:''}<textarea id="mtVoiceEditText" placeholder="Ex. J’ai mangé deux œufs, deux tartines de pain complet et un demi-avocat.">${esc(voiceState.text)}</textarea><small>Astuce : sépare les éléments avec « et », puis précise les grammes seulement quand tu les connais vraiment.</small><button class="mt-home-tool-primary" type="button" id="mtVoiceEditGo">Comprendre cette phrase</button><button class="mt-home-tool-secondary" type="button" id="mtVoiceEditRetry">Réessayer le micro</button></div>`;
    sheet.querySelector('[data-mt-home-close]')?.addEventListener('click',()=>window.mtCloseHomeToolSheet());
    sheet.querySelector('#mtVoiceEditGo')?.addEventListener('click',()=>{const text=String(sheet.querySelector('#mtVoiceEditText')?.value||'').trim();if(text.length<3){window.mtToast?.('Décris simplement ce que tu as mangé.');return;}voiceState.text=text;voiceState.choices=[];voiceState.removedIndexes=new Set();resolveVoicePhrase(text,[],0);});
    sheet.querySelector('#mtVoiceEditRetry')?.addEventListener('click',()=>window.mtOpenHomeVoiceMeal());
  }
  function renderVoiceLoader(text){
    return `<div class="mt-home-tool-grip"></div><button type="button" class="mt-home-tool-close" data-mt-home-close aria-label="Fermer">×</button><div class="mt-home-tool-mark">✷</div><div class="mt-home-tool-kicker">Compréhension Méthode TEE</div><h2>Je mets ton repas au propre.</h2><p class="mt-home-tool-lead">Quelques secondes pour relier ta phrase aux bons repères — rien n’est ajouté sans ta confirmation.</p><section class="mt-voice-loader"><div class="mt-voice-loader-head"><span class="mt-voice-loader-badge"><i>✦</i> carnet en cours</span><span class="mt-voice-loader-time">TEE prépare la vérification</span></div><div class="mt-voice-notebook" aria-hidden="true"><div class="mt-voice-notebook-title">Ton repas se dessine…</div><div class="mt-voice-write-row"><span></span></div><div class="mt-voice-write-row"><span></span></div><div class="mt-voice-write-row"><span></span></div><div class="mt-voice-pen"></div></div><div class="mt-voice-loader-copy"><i>✦</i><div><b>Je relie les bons aliments</b><p>Nom, préparation, quantité et éventuelles ambiguïtés sont vérifiés avant de te les montrer.</p></div></div><div class="mt-voice-loader-phrase"><b>${esc(text)}</b><span class="mt-voice-loader-dots"><i></i><i></i><i></i></span></div></section>`;
  }

  function client(){try{return typeof initSupabase==='function'?initSupabase():window.supabaseClient||null;}catch(_){return null;}}
  async function resolveVoicePhrase(text,choices,minLoaderMs=null){
    if(voiceState.busy)return;voiceState.busy=true;
    const modal=ensureModal(),sheet=modal.querySelector('.mt-home-tool-sheet');
    const loaderStarted=performance.now();
    const isFirstAnalysis=!voiceState.initialAnalysisDone;
    if(sheet)sheet.innerHTML=renderVoiceLoader(text);
    sheet?.querySelector('[data-mt-home-close]')?.addEventListener('click',()=>window.mtCloseHomeToolSheet());
    try{
      const sb=client();if(!sb)throw new Error('Connexion au Carnet indisponible.');
      const rpcText=prepareVoiceRpcText(text);
      const {data,error}=await sb.rpc('resolve_food_speech_phrase_v8_json',{p_text:rpcText,p_choices:Array.isArray(choices)?choices:[],p_limit_items:12});
      if(error)throw error;
      // 2 s premium uniquement pour la toute première compréhension.
      // Tous les ajustements suivants affichent le loader uniquement le temps réel du RPC.
      const requestedFloor=minLoaderMs===null||minLoaderMs===undefined?(isFirstAnalysis?2000:0):Math.max(0,Number(minLoaderMs)||0);
      const remaining=Math.max(0,requestedFloor-(performance.now()-loaderStarted));
      if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
      voiceState.initialAnalysisDone=true;
      voiceState.text=text;voiceState.choices=Array.isArray(choices)?choices:[];voiceState.payload=data||{};
      renderVoiceResolution();
    }catch(e){
      const msg=String(e?.message||'TEE n’a pas pu analyser cette phrase pour le moment.');
      if(sheet)sheet.innerHTML=`<div class="mt-home-tool-grip"></div><button type="button" class="mt-home-tool-close" data-mt-home-close aria-label="Fermer">×</button><div class="mt-home-tool-mark">◉</div><div class="mt-home-tool-kicker">Le dire à TEE</div><h2>On garde ta phrase.</h2><div class="mt-voice-status is-error">${esc(msg)}</div><button class="mt-home-tool-primary" type="button" data-mt-voice-write>Corriger / réessayer</button><button class="mt-home-tool-secondary" type="button" data-mt-voice-search>Ajouter autrement dans le Carnet</button>`;
      sheet?.querySelector('[data-mt-home-close]')?.addEventListener('click',()=>window.mtCloseHomeToolSheet());
      sheet?.querySelector('[data-mt-voice-write]')?.addEventListener('click',()=>renderVoiceEditor('Ta phrase est conservée. Corrige-la si besoin.'));
      sheet?.querySelector('[data-mt-voice-search]')?.addEventListener('click',()=>{
        const localSearch=document.getElementById('foodSearchInput');
        if(document.getElementById('foodMealPage')&&localSearch){window.mtCloseHomeToolSheet();localSearch.value=voiceState.text||'';localSearch.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>localSearch.focus(),160);}
        else location.href='food-meal.html?action=search&source=voice';
      });
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
    const size=String(item?.spoken_size_hint||'').trim().toLowerCase();
    if(['petite','moyenne','grande'].includes(size))return `${size.charAt(0).toUpperCase()+size.slice(1)} portion`;
    return 'Quantité à préciser';
  }
  function detailOptions(item){
    // V486.4 : lorsqu'un choix a déjà résolu l'aliment, on ne ré-affiche jamais
    // les anciennes alternatives du concept générique. Cela évite la boucle
    // « grande portion -> McDonald's -> frites McDonald's/autres -> ... ».
    const selectedStatus=String(item?.selected_option?.status||'');
    if(item?.final_food&&selectedStatus==='resolved')return [];

    const follow=Array.isArray(item?.selected_option?.followup_options)?item.selected_option.followup_options:[];
    const raw=follow.length?follow:(Array.isArray(item?.alternatives)?item.alternatives:[]);
    const seen=new Set();
    const size=String(item?.spoken_size_hint||'').trim().toLowerCase();
    const originalRef=String(item?.original_resolution?.food_ref||'');
    const foodText=normalizeVoiceText(item?.food_text||'');
    const isFries=originalRef.includes('generic_frites')||foodText==='frite'||foodText==='frites';

    return raw.reduce((list,o)=>{
      let key=String(o?.option_key||o?.key||'').trim();
      if(!key)return list;

      // Si la personne a déjà dit « grande portion de frites », le choix de marque
      // suffit : on envoie directement la clé finale mcdo_grande.
      if(isFries&&['petite','moyenne','grande'].includes(size)&&key==='mcdo'){
        key=`mcdo_${size}`;
      }

      // Pour « frites McDo grande portion », ne garder que la taille déjà prononcée.
      if(isFries&&['petite','moyenne','grande'].includes(size)
         &&['petite','moyenne','grande'].includes(key) && key!==size){
        return list;
      }

      if(seen.has(key))return list;
      seen.add(key);
      list.push({...o,_voiceOptionKey:key,_voiceOptionLabel:String(o?.display_name||o?.label||key)});
      return list;
    },[]);
  }
  function renderVoiceResolution(){
    const payload=voiceState.payload||{},rawItems=Array.isArray(payload.items)?payload.items:[],items=displayVoiceItems(rawItems),modal=ensureModal(),sheet=modal.querySelector('.mt-home-tool-sheet');if(!sheet)return;
    const itemHTML=items.map(item=>{
      const name=item?.final_food?.display_name||item?.original_resolution?.display_name||item?.food_text||'Aliment';
      const current=choiceFor(item.item_index),options=detailOptions(item);
      const optionHTML=options.length?`<div class="mt-voice-options">${options.map(o=>{const key=o._voiceOptionKey;const selected=key&&String(current?.option_key||'')===String(key);return `<button type="button" class="${selected?'is-selected':''}" data-mt-voice-option="${esc(item.item_index)}" data-mt-voice-key="${esc(key)}">${esc(o._voiceOptionLabel)}</button>`;}).join('')}</div>`:'';
      const portionStatus=String(item?.portion?.status||'');
      const needGrams=!item?.ready_for_confirmation&&item?.final_food&&(portionStatus.includes('needs_quantity')||!item?.final_grams);
      const gramsHTML=needGrams?`<div class="mt-voice-grams"><input type="number" min="1" max="2000" step="1" inputmode="decimal" placeholder="Quantité en g" data-mt-voice-grams="${esc(item.item_index)}" value="${esc(current?.grams_override||'')}"><span>g</span></div>`:'';
      const status=String(item?.status||'');
      const detail=item?.selected_option?.followup_prompt||(!item?.final_food&&status==='needs_detail'?'Précise simplement la préparation.':'');
      const estimated=item?.portion?.estimated?'<p>Quantité estimée à partir de tes repères de portion · à confirmer.</p>':'';
      const needsManualRephrase=!item?.final_food&&['needs_detail','needs_subdetail','unknown_option','target_not_found'].includes(status)&&!options.length;
      const helper=needsManualRephrase?'<p>Si le bon repère n’apparaît pas ici, reformule simplement la phrase ou utilise la recherche du Carnet.</p>':'';
      return `<article class="mt-voice-item"><div class="mt-voice-item-head"><b>${esc(name)}</b><div class="mt-voice-item-meta"><span>${esc(quantityLabel(item))}</span><button type="button" class="mt-voice-item-remove" data-mt-voice-remove="${esc(item.item_index)}" aria-label="Retirer ${esc(name)}">×</button></div></div>${detail?`<p>${esc(detail)}</p>`:''}${estimated}${helper}${optionHTML}${gramsHTML}${item?.status==='needs_search'?`<button class="mt-home-tool-secondary" type="button" data-mt-voice-search-item="${esc(item.item_index)}">Rechercher cet aliment</button>`:''}</article>`;
    }).join('');
    const ready=items.length?items.every(item=>{
      const current=choiceFor(item.item_index),portionStatus=String(item?.portion?.status||''),status=String(item?.status||'');
      const needGrams=!item?.ready_for_confirmation&&item?.final_food&&(portionStatus.includes('needs_quantity')||!item?.final_grams);
      if(needGrams)return Number.isFinite(Number(current?.grams_override))&&Number(current?.grams_override)>0;
      if(status==='needs_search')return false;
      const options=detailOptions(item);
      if(options.length)return String(current?.option_key||'').trim().length>0;
      if(['needs_detail','needs_subdetail','unknown_option','target_not_found'].includes(status))return false;
      return !!item?.ready_for_confirmation||!!item?.ready_to_add;
    }):false;
    const showEditPhrase=!ready;
    sheet.innerHTML=`<div class="mt-home-tool-grip"></div><button type="button" class="mt-home-tool-close" data-mt-home-close aria-label="Fermer">×</button><div class="mt-home-tool-mark">✷</div><div class="mt-home-tool-kicker">Vérifie ce que j’ai compris</div><h2>${items.length?`${items.length} repère${items.length>1?'s':''} dans ton repas.`:'Je n’ai pas encore assez compris.'}</h2><p class="mt-home-tool-lead">Corrige seulement ce qui en a besoin. Les grammes prononcés restent exacts ; les portions estimées restent clairement indiquées.</p><div class="mt-voice-items">${itemHTML||'<div class="mt-voice-status">Aucun aliment n’a été résolu. Utilise la recherche du Carnet pour ce repas.</div>'}</div>${ready?'<button class="mt-home-tool-primary" type="button" id="mtVoiceConfirm">Confirmer et continuer</button>':'<div class="mt-voice-status">Il reste au moins une précision à choisir avant de continuer.</div>'}${showEditPhrase?'<button class="mt-home-tool-tertiary" type="button" id="mtVoiceEditPhrase">Reformuler ma phrase</button>':''}`;
    sheet.querySelector('[data-mt-home-close]')?.addEventListener('click',()=>window.mtCloseHomeToolSheet());
    sheet.querySelectorAll('[data-mt-voice-remove]').forEach(btn=>btn.addEventListener('click',()=>{
      const index=Number(btn.dataset.mtVoiceRemove);if(!Number.isFinite(index))return;
      voiceState.removedIndexes.add(index);
      voiceState.choices=voiceState.choices.filter(x=>Number(x?.item_index)!==index);
      renderVoiceResolution();
      window.mtToast?.('Repère retiré.');
    }));
    sheet.querySelectorAll('[data-mt-voice-option]').forEach(btn=>btn.addEventListener('click',()=>{const key=String(btn.dataset.mtVoiceKey||'').trim();if(!key)return;setChoice(Number(btn.dataset.mtVoiceOption),{option_key:key,confirmed:false});resolveVoicePhrase(voiceState.text,voiceState.choices,0);}));
    let voiceGramTimer=0;
    const scheduleGramRefresh=()=>{clearTimeout(voiceGramTimer);voiceGramTimer=setTimeout(()=>resolveVoicePhrase(voiceState.text,voiceState.choices,0),180);};
    sheet.querySelectorAll('[data-mt-voice-grams]').forEach(inp=>{
      const capture=()=>{
        const index=Number(inp.dataset.mtVoiceGrams),raw=String(inp.value||'').trim();
        if(!raw){setChoice(index,{grams_override:null,confirmed:false});return true;}
        const grams=Number(raw);if(!Number.isFinite(grams)||grams<=0)return false;
        setChoice(index,{grams_override:grams,confirmed:false});return true;
      };
      const markTyping=()=>{if(capture())inp.dataset.mtVoiceDirty='1';};
      const commit=()=>{if(inp.dataset.mtVoiceDirty!=='1')return;capture();inp.dataset.mtVoiceDirty='0';scheduleGramRefresh();};
      // Pendant la frappe on mémorise la valeur, mais on ne relance JAMAIS l'analyse.
      // Sur iPhone, l'utilisateur peut ainsi taper 10, 100, 150... sans que le loader parte au premier chiffre.
      inp.addEventListener('input',markTyping);
      inp.addEventListener('change',commit);
      inp.addEventListener('blur',commit);
      inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit();try{inp.blur();}catch(_){}}});
    });
    sheet.querySelectorAll('[data-mt-voice-search-item]').forEach(btn=>btn.addEventListener('click',()=>{
      const hint=String(items.find(x=>Number(x.item_index)===Number(btn.dataset.mtVoiceSearchItem))?.food_text||'');
      const localSearch=document.getElementById('foodSearchInput');
      if(document.getElementById('foodMealPage')&&localSearch){
        window.mtCloseHomeToolSheet();
        localSearch.value=hint;localSearch.dispatchEvent(new Event('input',{bubbles:true}));
        setTimeout(()=>{localSearch.focus();localSearch.scrollIntoView({behavior:'smooth',block:'center'});},180);
      }else{
        sessionStorage.setItem('mt_voice_search_hint_v1',hint);location.href='food-meal.html?action=search&source=voice';
      }
    }));
    sheet.querySelector('#mtVoiceEditPhrase')?.addEventListener('click',()=>renderVoiceEditor('Corrige simplement ta phrase puis relance la compréhension.'));
    sheet.querySelector('#mtVoiceConfirm')?.addEventListener('click',confirmVoiceMeal);
  }

  async function confirmVoiceMeal(){
    // Récupère aussi les éventuelles quantités tapées mais pas encore sorties du champ.
    document.querySelectorAll('[data-mt-voice-grams]').forEach(inp=>{const grams=Number(inp.value);if(Number.isFinite(grams)&&grams>0)setChoice(Number(inp.dataset.mtVoiceGrams),{grams_override:grams});});
    const visibleItems=displayVoiceItems(Array.isArray(voiceState.payload?.items)?voiceState.payload.items:[]);
    visibleItems.forEach(item=>setChoice(item.item_index,{confirmed:true}));
    const button=document.getElementById('mtVoiceConfirm');if(button){button.disabled=true;button.textContent='Préparation du Carnet…';}
    try{
      const sb=client();if(!sb)throw new Error('Connexion au Carnet indisponible.');
      const {data,error}=await sb.rpc('resolve_food_speech_phrase_v8_json',{p_text:prepareVoiceRpcText(voiceState.text),p_choices:voiceState.choices,p_limit_items:12});if(error)throw error;
      voiceState.payload=data||{};
      const resolvedVisible=displayVoiceItems(Array.isArray(data?.items)?data.items:[]);
      const visibleReady=resolvedVisible.length>0&&resolvedVisible.every(x=>x?.ready_to_add&&x?.final_food&&Number(x?.final_grams)>0);
      if(!visibleReady){renderVoiceResolution();window.mtToast?.('Il reste une précision à confirmer.');return;}
      const draftItems=resolvedVisible.filter(x=>x?.ready_to_add&&x?.final_food).map(x=>({
        ciqual_code:x.final_food.ciqual_code||null,
        dictionary_id:x.final_food.dictionary_id||null,
        name:x.final_food.display_name||x.final_food.canonical_name||x.food_text||'Aliment',
        grams:Number(x.final_grams)||null,
        source_kind:x.final_food.source_kind||null,
        estimated:!!x.portion?.estimated,
        voice_item_index:x.item_index
      })).filter(x=>x.grams>0);
      if(!draftItems.length)throw new Error('Aucun aliment prêt à transmettre au Carnet.');
      const draft={version:1,input:voiceState.text,created_at:new Date().toISOString(),items:draftItems};
      // V486.1 : si la voix est utilisée depuis la fiche repas elle-même, on injecte
      // le brouillon dans le formulaire courant sans recharger la page ni perdre
      // les aliments/photos/ressentis déjà saisis.
      if(document.getElementById('foodMealPage')){
        window.dispatchEvent(new CustomEvent('mt:voice-meal-draft',{detail:draft}));
        await window.mtCloseHomeToolSheet?.();
        window.mtToast?.('Repas ajouté au brouillon. Vérifie puis enregistre.');
        return;
      }
      sessionStorage.setItem(VOICE_DRAFT_KEY,JSON.stringify(draft));
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
