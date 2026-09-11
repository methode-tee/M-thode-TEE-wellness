/* MÉTHODE TEE — V4896562 · Animations premium visibles + progression active exacte
   Couche additive : aucune écriture métier au simple affichage de l'Accueil.
   Les cartes ne déclenchent les lectures Supabase détaillées qu'après un appui explicite. */
(function(){
  'use strict';
  if(window.__MT_HOME_SMART_CARDS_V4896562__)return;
  window.__MT_HOME_SMART_CARDS_V4896562__=true;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>new Date().toLocaleDateString('sv-SE');
  const VOICE_DRAFT_KEY='mt_voice_meal_draft_v1';
  let memberId='';
  let homeMember=null;
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
    replacements:new Map(),
    initialAnalysisDone:false
  };
  const expState={model:null,raw:null};
  const homeResourceIndex=new Map();
  const homeSleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));
  const HOME_PREMIUM_LOADER_MIN_MS=750;
  async function homePremiumLoaderFloor(startedAt,minMs=HOME_PREMIUM_LOADER_MIN_MS){
    const elapsed=Math.max(0,performance.now()-Number(startedAt||0));
    const remaining=Math.max(0,Number(minMs||0)-elapsed);
    if(remaining>0)await homeSleep(remaining);
  }

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
      .mt-voice-items{display:grid;gap:11px}.mt-voice-item{border:1px solid rgba(31,72,61,.11);border-radius:20px;background:#fffdf8;padding:14px}.mt-voice-item-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px}.mt-voice-item-head b{color:#17483e;font-size:14px}.mt-voice-item-meta{display:flex;align-items:flex-start;justify-content:flex-end;gap:8px}.mt-voice-item-meta>span{color:#9b793b;font-size:11px;font-weight:850;text-align:right;max-width:118px;padding-top:6px}.mt-voice-item-tools{display:grid;gap:6px}.mt-voice-item-remove,.mt-voice-item-replace{width:27px;height:27px;flex:0 0 27px;border:1px solid rgba(177,138,67,.22);border-radius:50%;background:#f7f0e5;color:#6e776f;display:grid;place-items:center;padding:0;box-shadow:none}.mt-voice-item-remove{font:500 17px/1 Arial,sans-serif}.mt-voice-item-replace svg{width:13px;height:13px;fill:none;stroke:#8f713a;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.mt-voice-item-remove:active,.mt-voice-item-replace:active{transform:scale(.94);background:#efe4d4}.mt-voice-item.is-replaced{border-color:rgba(176,138,67,.34);background:linear-gradient(180deg,#fffdf8,#fdf9f1)}.mt-voice-replaced-note{display:inline-flex;align-items:center;gap:5px;margin-top:7px;color:#9b793b!important;font-size:9px!important;font-weight:850;letter-spacing:.02em}.mt-voice-replace-search{display:grid;gap:11px}.mt-voice-replace-input{width:100%;border:1px solid #ddcfb8;border-radius:18px;background:#fffdf9;padding:14px 15px;color:#17483e;font:inherit;font-size:16px;outline:none}.mt-voice-replace-input:focus{border-color:#b08a43}.mt-voice-replace-results{display:grid;gap:8px;max-height:44vh;overflow:auto}.mt-voice-replace-result{width:100%;border:1px solid rgba(31,72,61,.11);border-radius:16px;background:#fffdf8;padding:12px 13px;text-align:left;color:#17483e}.mt-voice-replace-result b{display:block;font-size:12px}.mt-voice-replace-result small{display:block;color:#8c7e70;font-size:9px;margin-top:3px}.mt-voice-replace-empty{padding:14px;border-radius:16px;background:#f4ecdf;color:#817266;font-size:11px;line-height:1.5}.mt-voice-item p{font-size:11px;line-height:1.45;color:#88796d;margin:6px 0 0}.mt-voice-options{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.mt-voice-options button{border:1px solid #d6c19a;border-radius:999px;background:#fffaf2;color:#17483e;padding:9px 11px;font-size:10px;font-weight:850}.mt-voice-options button.is-selected{background:#17483e;border-color:#17483e;color:#fff}.mt-voice-grams{display:flex;align-items:center;gap:8px;margin-top:11px}.mt-voice-grams input{min-width:0;flex:1;border:1px solid #dbcbae;border-radius:14px;background:#fff;padding:11px 12px;font-size:16px;color:#17483e}.mt-voice-grams span{font-size:11px;font-weight:900;color:#8b7b6d}.mt-voice-status{margin:12px 0;padding:12px 13px;border-radius:16px;background:#f4ecdf;font-size:11px;line-height:1.5;color:#75675b}.mt-voice-status.is-error{background:#f8ebe6;color:#8d4a3a}.mt-voice-status b{color:#17483e}
      .mt-voice-edit{display:grid;gap:12px}.mt-voice-edit textarea{width:100%;min-height:124px;resize:vertical;border:1px solid #dfd2bc;border-radius:20px;background:#fffdf9;padding:16px 15px;font:inherit;font-size:16px;line-height:1.45;color:#17483e;outline:none}.mt-voice-edit textarea:focus{border-color:#b08a43}.mt-voice-edit small{display:block;color:#8f8174;line-height:1.5}
      .mt-voice-loader{position:relative;overflow:hidden;border:1px solid rgba(208,191,160,.58);border-radius:24px;background:linear-gradient(180deg,#fffdf9,#faf5ec);padding:16px;margin-top:8px;box-shadow:0 12px 32px rgba(67,51,29,.06)}.mt-voice-loader-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.mt-voice-loader-badge{display:inline-flex;align-items:center;gap:7px;color:#a9833e;font-size:9px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}.mt-voice-loader-badge i{font-style:normal;font-size:12px}.mt-voice-loader-time{font-size:9px;color:#aa9d8f}.mt-voice-notebook{position:relative;margin-top:14px;padding:15px 14px 13px 24px;border-radius:18px;background:repeating-linear-gradient(180deg,#fffdf8 0,#fffdf8 27px,#eee4d4 28px);border:1px solid rgba(220,205,179,.68);min-height:138px}.mt-voice-notebook:before{content:'';position:absolute;left:13px;top:10px;bottom:10px;width:1px;background:rgba(176,138,67,.26)}.mt-voice-notebook-title{font-family:var(--font-serif,"Cormorant Garamond",Georgia,serif);font-size:23px;line-height:1;color:#17483e;margin-bottom:10px}.mt-voice-write-row{position:relative;height:22px;margin:0 0 5px;overflow:hidden}.mt-voice-write-row span{position:absolute;left:0;top:2px;height:2px;border-radius:999px;background:linear-gradient(90deg,#17483e,#8b7b5b);transform-origin:left center;animation:mtNotebookWrite 1.35s cubic-bezier(.22,.8,.25,1) infinite alternate}.mt-voice-write-row:nth-child(2) span{width:78%;animation-delay:.12s}.mt-voice-write-row:nth-child(3) span{width:61%;animation-delay:.24s}.mt-voice-write-row:nth-child(4) span{width:46%;animation-delay:.36s}.mt-voice-pen{position:absolute;right:17px;bottom:15px;width:58px;height:16px;transform:rotate(-9deg);animation:mtNotebookPen 1.65s ease-in-out infinite}.mt-voice-pen:before{content:'';position:absolute;left:0;top:6px;width:45px;height:5px;border-radius:999px;background:linear-gradient(90deg,#c3a15d,#8e6e34)}.mt-voice-pen:after{content:'';position:absolute;right:0;top:4px;border-left:10px solid #17483e;border-top:4px solid transparent;border-bottom:4px solid transparent}.mt-voice-loader-copy{margin-top:12px;display:flex;align-items:flex-start;gap:9px}.mt-voice-loader-copy i{width:24px;height:24px;flex:0 0 24px;border-radius:50%;display:grid;place-items:center;background:#f1e7d6;color:#a9833e;font-style:normal;font-size:11px}.mt-voice-loader-copy div{min-width:0}.mt-voice-loader-copy b{display:block;color:#17483e;font-size:11px;margin-bottom:3px}.mt-voice-loader-copy p{margin:0;color:#8d8074;font-size:10px;line-height:1.45}.mt-voice-loader-phrase{margin-top:11px;padding:10px 12px;border-radius:14px;background:#f5eee3;color:#75685d;font-size:10px;line-height:1.45}.mt-voice-loader-phrase b{color:#17483e;font-weight:850}.mt-voice-loader-dots{display:inline-flex;gap:4px;margin-left:5px;vertical-align:middle}.mt-voice-loader-dots i{width:4px;height:4px;border-radius:50%;background:#b08a43;animation:mtLoaderDot 1s ease-in-out infinite}.mt-voice-loader-dots i:nth-child(2){animation-delay:.14s}.mt-voice-loader-dots i:nth-child(3){animation-delay:.28s}
      @keyframes mtNotebookWrite{0%{transform:scaleX(.25);opacity:.42}100%{transform:scaleX(1);opacity:.92}}@keyframes mtNotebookPen{0%,100%{transform:translateX(-4px) rotate(-9deg)}50%{transform:translateX(7px) translateY(-2px) rotate(-6deg)}}@keyframes mtLoaderDot{0%,100%{opacity:.28;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}
      .mt-home-ref-box{padding:15px;border-radius:20px;background:#f5efe4;margin:14px 0}.mt-home-ref-box b{display:block;color:#17483e;font-family:var(--font-serif,"Cormorant Garamond",Georgia,serif);font-size:24px;font-weight:600;line-height:1.05}.mt-home-ref-box p{margin:7px 0 0;font-size:12px;line-height:1.5}.mt-home-ref-action{padding:13px 14px;border-radius:17px;background:#eaf0ec;color:#21483e;font-size:12px;line-height:1.5}.mt-home-ref-action b{display:block;margin-bottom:4px}.mt-home-ref-reasons{margin:12px 0 0;padding:0;list-style:none}.mt-home-ref-reasons li{position:relative;padding:4px 0 4px 16px;font-size:11px;line-height:1.4}.mt-home-ref-reasons li:before{content:'✷';position:absolute;left:0;color:#b08a43}.mt-home-exp-days{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin:13px 0}.mt-home-exp-days i{height:5px;border-radius:99px;background:#e5dbca}.mt-home-exp-days i.is-done{background:#91aa9f}.mt-home-exp-days i.is-current{background:#17483e}
      .mt-home-preview-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:12px 0 15px}.mt-home-preview-stat{padding:13px 14px;border-radius:18px;background:#f5efe4}.mt-home-preview-stat b{display:block;color:#17483e;font-size:18px;line-height:1.05}.mt-home-preview-stat span{display:block;color:#8b7d70;font-size:9px;line-height:1.35;margin-top:4px;text-transform:uppercase;letter-spacing:.08em}.mt-home-preview-list{display:grid;gap:8px;margin:10px 0 0}.mt-home-preview-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 13px;border:1px solid rgba(177,138,67,.21);border-radius:17px;background:#fffdf8;text-align:left;color:#17483e}.mt-home-preview-row b{display:block;font-size:12px;line-height:1.25}.mt-home-preview-row small{display:block;margin-top:4px;color:#8a7d71;font-size:9px;line-height:1.35}.mt-home-preview-row em{font-style:normal;color:#b08a43;font-size:11px;font-weight:900}.mt-home-preview-empty{padding:15px;border-radius:18px;background:#f5efe4;color:#7e7064;font-size:11px;line-height:1.5}.mt-home-preview-section{margin-top:14px}.mt-home-preview-section>small{display:block;color:#b08a43;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;margin-bottom:7px}.mt-home-preview-input{width:100%;min-height:82px;resize:vertical;border:1px solid #ddcfb8;border-radius:17px;background:#fffdf9;padding:12px 13px;color:#17483e;font:inherit;font-size:14px;line-height:1.4;outline:none}.mt-home-preview-input:focus{border-color:#b08a43}.mt-home-preview-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.mt-home-preview-chip{border:1px solid #d8c49d;border-radius:999px;background:#fffaf2;color:#17483e;padding:8px 10px;font-size:9px;font-weight:850}.mt-home-preview-balance{padding:14px;border-radius:20px;background:#eef2ee;margin:12px 0}.mt-home-preview-balance small{display:block;color:#8d7f72;font-size:9px;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.mt-home-preview-balance b{display:block;color:#17483e;font-family:var(--font-serif,"Cormorant Garamond",Georgia,serif);font-size:27px;line-height:1.05;margin-top:4px}.mt-home-preview-balance p{margin:7px 0 0;font-size:11px;line-height:1.45;color:#74685d}.mt-home-preview-feature{padding:16px;border:1px solid rgba(177,138,67,.22);border-radius:22px;background:linear-gradient(180deg,#fffdf8,#f7f0e5);margin:12px 0}.mt-home-preview-feature small{display:block;color:#b08a43;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.mt-home-preview-feature h3{margin:5px 0 5px;color:#17483e;font-size:17px;line-height:1.22}.mt-home-preview-feature p{margin:0;color:#7f7165;font-size:10px;line-height:1.45}.mt-home-preview-progress{height:6px;border-radius:999px;background:#e8dfd1;overflow:hidden;margin:11px 0 7px}.mt-home-preview-progress>i{display:block;height:100%;border-radius:inherit;background:#b08a43}.mt-home-preview-progress-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#8b7d70;font-size:9px}.mt-home-preview-inline-action{margin-top:12px;border:0;border-radius:999px;background:#17483e;color:#fff;padding:11px 14px;font-size:10px;font-weight:900}.mt-home-preview-subhead{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:16px 0 7px}.mt-home-preview-subhead b{color:#17483e;font-size:12px}.mt-home-preview-subhead span{color:#a58549;font-size:9px;font-weight:850}.mt-home-preview-static{width:100%;padding:12px 13px;border:1px solid rgba(177,138,67,.18);border-radius:17px;background:#fffdf8;text-align:left;color:#17483e;font:inherit;cursor:pointer}.mt-home-preview-static:active{transform:scale(.995);background:#fbf5eb}.mt-home-preview-static b{display:block;color:#17483e;font-size:12px;line-height:1.25}.mt-home-preview-static small{display:block;margin-top:4px;color:#8a7d71;font-size:9px;line-height:1.35}.mt-home-preview-static em{display:block;margin-top:7px;color:#b08a43;font-size:9px;font-style:normal;font-weight:900}.mt-home-preview-note{margin-top:10px;padding:11px 12px;border-radius:15px;background:#f5efe4;color:#7e7064;font-size:10px;line-height:1.45}.mt-home-preview-grid{display:grid;gap:8px}.mt-home-preview-back{display:block;margin:10px auto 0;border:0;background:transparent;color:#8f713a;font-size:10px;font-weight:850;padding:9px;text-decoration:underline;text-underline-offset:3px}@media(min-width:700px){.mt-home-preview-grid.is-two{grid-template-columns:repeat(2,minmax(0,1fr))}.mt-home-preview-feature{padding:18px}.mt-home-preview-feature h3{font-size:19px}}
      .mt-home-premium-loader{position:relative;overflow:hidden;margin:14px 0 4px;padding:16px 16px 15px;border:1px solid rgba(177,138,67,.18);border-radius:21px;background:linear-gradient(180deg,rgba(255,253,248,.96),rgba(246,239,228,.9));box-shadow:0 12px 30px rgba(54,43,27,.045)}
      .mt-home-premium-loader-head{display:flex;align-items:center;gap:11px}.mt-home-premium-loader-mark{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#f1e8d8;color:#a77f38;font-size:15px;flex:0 0 auto}.mt-home-premium-loader-copy{min-width:0}.mt-home-premium-loader-copy b{display:block;color:#17483e;font-size:11px;line-height:1.25}.mt-home-premium-loader-copy small{display:block;margin-top:3px;color:#918276;font-size:9px;line-height:1.35}
      .mt-home-premium-loader-track{height:5px;border-radius:999px;background:#e7dfd2;overflow:hidden;margin-top:13px;position:relative}.mt-home-premium-loader-track i{display:block;height:100%;width:42%;border-radius:inherit;background:linear-gradient(90deg,#b08a43,#17483e,#b08a43);animation:mtHomePremiumSweep 1.15s cubic-bezier(.45,0,.25,1) infinite}
      .mt-home-premium-loader.is-favorite .mt-home-premium-loader-mark{background:#f7eee1}.mt-home-premium-loader.is-favorite .mt-home-premium-loader-mark span{display:block;animation:mtHomeFavoritePulse 1s ease-in-out infinite}.mt-home-premium-loader.is-routine .mt-home-premium-loader-mark{background:#edf1eb}
      .mt-home-routine-steps{display:flex;gap:4px;align-items:center}.mt-home-routine-steps i{width:5px;height:5px;border-radius:50%;background:#17483e;opacity:.25;animation:mtHomeRoutineStep 1.05s ease-in-out infinite}.mt-home-routine-steps i:nth-child(2){animation-delay:.16s}.mt-home-routine-steps i:nth-child(3){animation-delay:.32s}
      html.mt-home-handoff-loading #ritualSignalDrawer,html.mt-home-handoff-loading #mtRoutineWorkspace{visibility:hidden!important}
      @keyframes mtHomePremiumSweep{0%{transform:translateX(-115%)}100%{transform:translateX(245%)}}@keyframes mtHomeFavoritePulse{0%,100%{transform:scale(.92);opacity:.68}50%{transform:scale(1.12);opacity:1}}@keyframes mtHomeRoutineStep{0%,100%{opacity:.22;transform:scale(.82)}45%{opacity:1;transform:scale(1.15)}}
      .mt-home-balance-gauges{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:3px 0 15px;padding:12px 10px;border:1px solid rgba(177,138,67,.16);border-radius:22px;background:linear-gradient(180deg,rgba(255,253,248,.9),rgba(247,241,231,.76))}
      .mt-home-balance-gauge{border:0;background:transparent;padding:0 2px;color:#17483e;text-align:center;display:grid;justify-items:center;gap:6px;cursor:pointer}
      .mt-home-balance-ring{--mt-gauge:0;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(#b08a43 calc(var(--mt-gauge)*1%),#e5e3dc 0);box-shadow:inset 0 0 0 1px rgba(21,61,57,.03)}
      .mt-home-balance-ring:after{content:'';position:absolute;inset:5px;border-radius:50%;background:#fffaf2}
      .mt-home-balance-ring b{position:relative;z-index:1;font-size:13px;line-height:1;color:#17483e}
      .mt-home-balance-gauge small{font-size:8px;line-height:1.15;color:#17483e;font-weight:900;max-width:82px}
      .mt-home-balance-gauge em{font-style:normal;font-size:7px;line-height:1.15;color:#95877a;min-height:16px}
      .mt-home-balance-gauge:active{transform:scale(.985)}
      @media(min-width:700px){.mt-home-balance-gauges{padding:14px 18px;gap:16px}.mt-home-balance-ring{width:66px;height:66px}.mt-home-balance-ring b{font-size:14px}.mt-home-balance-gauge small{font-size:9px}.mt-home-balance-gauge em{font-size:8px}}

      @media(max-width:430px){.mt-home-tool-sheet{padding-left:17px;padding-right:17px}.mt-home-tool-sheet h2{font-size:35px}.mt-voice-transcript{font-size:22px}}
      @media(prefers-reduced-motion:reduce){.mt-voice-orb.is-listening,.mt-home-premium-loader-track i,.mt-home-premium-loader-mark span,.mt-home-routine-steps i{animation:none}}
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

  function homeUniverseIcon(key,fallback){
    const map={alimentation:['bowl','◌'],equilibre:['chart','✦'],parcours:['target','◎'],ressources:['book','▦']};
    const pair=map[key]||['sparkle',fallback||'✦'];
    return icon(pair[0],pair[1]);
  }

  window.mtRenderHomeUniverseCards=function(rail,member){
    if(!rail)return false;
    homeMember=member||null;
    memberId=String(member?.user_id||member?.id||'');
    rail.classList.add('mt-home-universe-rail');
    rail.setAttribute('aria-label','Les espaces Méthode TEE');
    rail.innerHTML=`
      <button class="story-bubble mt-home-universe-card accent-green" type="button" onclick="mtOpenHomeUniverse('alimentation')"><span>${homeUniverseIcon('alimentation')}</span><b>Mon alimentation</b><small>Repas · idées · semaine</small></button>
      <button class="story-bubble mt-home-universe-card accent-gold" type="button" onclick="mtOpenHomeUniverse('equilibre')"><span>${homeUniverseIcon('equilibre')}</span><b>Mon équilibre</b><small>Repères · tendances</small></button>
      <button class="story-bubble mt-home-universe-card accent-sage" type="button" onclick="mtOpenHomeUniverse('parcours')"><span>${homeUniverseIcon('parcours')}</span><b>Mes parcours</b><small>Protocoles · suivi</small></button>
      <button class="story-bubble mt-home-universe-card accent-cream" type="button" onclick="mtOpenHomeUniverse('ressources')"><span>${homeUniverseIcon('ressources')}</span><b>Mes ressources</b><small>Favoris · bibliothèque</small></button>`;
    return true;
  };
  window.mtRenderMemberHomeCards=function(rail,member){return window.mtRenderHomeUniverseCards(rail,member);};

  function homeUniverseAction(iconKey,title,sub,action,disabled=false){
    return `<button class="mt-home-tool-action" type="button" data-mt-universe-action="${esc(action)}" ${disabled?'disabled':''}><span>${icon(iconKey,'✦')}</span><span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span><i>›</i></button>`;
  }
  function homeUniverseGuest(kind){
    const defs={
      alimentation:{mark:'bowl',kicker:'Mon alimentation',title:'Manger à ta façon.',lead:'Enregistre, adapte et organise ton alimentation sans changer toute ta vie.',actions:[
        ['bowl','Découvrir les recettes','Des idées concrètes déjà disponibles dans Méthode TEE.','guest-recipes'],
        ['profile','Créer mon espace','Débloque ton Carnet, tes repas et tes outils personnels.','auth']
      ]},
      equilibre:{mark:'chart',kicker:'Mon équilibre',title:'Comprendre avant de corriger.',lead:'Tes repères prennent du sens quand ils sont reliés dans le temps.',actions:[
        ['chart','Créer mon espace','Commence à construire tes repères personnels.','auth']
      ]},
      parcours:{mark:'target',kicker:'Mes parcours',title:'Avancer avec un fil clair.',lead:'Protocoles et parcours guidés restent accessibles sans encombrer ton quotidien.',actions:[
        ['target','Découvrir les objectifs','Explorer les parcours liés au corps et aux objectifs.','objectifs'],
        ['leaf','Découvrir la pharmacopée','Explorer les protocoles liés aux plantes.','pharmaco'],
        ['profile','Créer mon espace','Suis ensuite ta progression jour après jour.','auth']
      ]},
      ressources:{mark:'book',kicker:'Mes ressources',title:'Retrouver ce qui compte.',lead:'Favoris, routines et bibliothèque se rangent dans un même univers.',actions:[
        ['bowl','Découvrir les recettes','Explorer les idées repas Méthode TEE.','guest-recipes'],
        ['profile','Créer mon espace','Conserve ensuite tes favoris, routines et contenus.','auth']
      ]}
    };
    return defs[kind]||defs.ressources;
  }
  async function homeUserId(){
    if(memberId)return memberId;
    try{const sb=client(),r=await sb?.auth?.getUser?.();return String(r?.data?.user?.id||'');}catch(_){return '';}
  }
  const HOME_MEAL_LABELS={breakfast:'Petit-déjeuner',lunch:'Déjeuner',snack:'Collation',dinner:'Dîner'};
  function homePreviewBack(kind,label){return `<button class="mt-home-preview-back" type="button" data-mt-home-preview-back="${esc(kind)}">← ${esc(label)}</button>`;}
  function bindHomePreviewCommon(kind){
    document.querySelector('[data-mt-home-preview-back]')?.addEventListener('click',()=>window.mtOpenHomeUniverse(kind));
    document.querySelectorAll('[data-mt-home-full-url]').forEach(btn=>btn.addEventListener('click',()=>{const url=btn.dataset.mtHomeFullUrl;if(url)location.href=url;}));
  }
  function homePremiumLoader(kind='bar',label='Préparation…',detail='On relie les bonnes informations avant d’afficher la suite.'){
    const k=String(kind||'bar');
    const mark=k==='favorite'?'<span>♥</span>':k==='routine'?'<span class="mt-home-routine-steps"><i></i><i></i><i></i></span>':icon(k==='resources'?'book':k==='parcours'?'target':k==='equilibre'?'chart':'sparkle','✦');
    return `<div class="mt-home-premium-loader is-${esc(k)}" role="status" aria-live="polite"><div class="mt-home-premium-loader-head"><div class="mt-home-premium-loader-mark">${mark}</div><div class="mt-home-premium-loader-copy"><b>${esc(label)}</b><small>${esc(detail)}</small></div></div><div class="mt-home-premium-loader-track"><i></i></div></div>`;
  }
  function homeTransitionScreen(kind,kicker,title,lead,label,detail){
    const iconKind=kind==='favorite'?'resources':kind==='routine'?'resources':kind;
    openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon(iconKind,'✦')}</div><div class="mt-home-tool-kicker">${esc(kicker)}</div><h2>${esc(title)}</h2><p class="mt-home-tool-lead">${esc(lead)}</p>${homePremiumLoader(kind,label,detail)}`);
  }
  function homeSetHandoffLoading(active){document.documentElement.classList.toggle('mt-home-handoff-loading',!!active);}
  async function homeTodayMeals(){
    const sb=client(),uid=await homeUserId();if(!sb||!uid)return[];
    const {data,error}=await sb.from('food_meals').select('id,meal_date,meal_type,meal_time,description,source_recipe_title,kcal_total,protein_total,fiber_total').eq('user_id',uid).eq('meal_date',today()).order('meal_time',{ascending:true});
    if(error)throw error;return Array.isArray(data)?data:[];
  }
  function homeMealRowsHTML(meals,{adapter=false}={}){
    if(!meals.length)return '<div class="mt-home-preview-empty">Aucun repas n’est encore enregistré aujourd’hui. Tu peux commencer sans quitter cet espace.</div>';
    return `<div class="mt-home-preview-list">${meals.map(m=>{const label=HOME_MEAL_LABELS[m.meal_type]||'Repas',time=String(m.meal_time||'').slice(0,5),title=m.source_recipe_title||m.description||'Repas renseigné';return `<button class="mt-home-preview-row" type="button" ${adapter?`data-mt-home-adapt-meal="${esc(m.id)}"`:`data-mt-home-open-meal="${esc(m.id)}"`}><span><b>${esc(label)}${time?` · ${esc(time)}`:''}</b><small>${esc(title)}</small></span><em>${adapter?'Adapter':'Voir'} ›</em></button>`;}).join('')}</div>`;
  }

  window.mtOpenHomeFoodDayPreview=async function(){
    const premiumStarted=performance.now();
    openHTML(`<div class="mt-home-tool-mark">${icon('calendar','◌')}</div><div class="mt-home-tool-kicker">Ma journée alimentaire</div><h2>Ce que tu as déjà renseigné.</h2><p class="mt-home-tool-lead">Un aperçu utile ici, puis la journée complète seulement si tu veux aller plus loin.</p>${homePremiumLoader('bar','Lecture de tes repas d’aujourd’hui…','On rassemble uniquement ce qui est déjà enregistré dans ton Carnet.')} `);
    try{
      const meals=await homeTodayMeals(),documented=meals.filter(m=>m.kcal_total!==null&&m.kcal_total!==undefined).length;
      await homePremiumLoaderFloor(premiumStarted);
      openHTML(`<div class="mt-home-tool-mark">${icon('calendar','◌')}</div><div class="mt-home-tool-kicker">Ma journée alimentaire</div><h2>${meals.length?`${meals.length} repas renseigné${meals.length>1?'s':''}.`:'Ta journée est prête.'}</h2><p class="mt-home-tool-lead">Retrouve directement ce qui est déjà dans ton Carnet aujourd’hui.</p><div class="mt-home-preview-summary"><div class="mt-home-preview-stat"><b>${meals.length}</b><span>repas aujourd’hui</span></div><div class="mt-home-preview-stat"><b>${documented}</b><span>avec repères nutritionnels</span></div></div>${homeMealRowsHTML(meals)}${!meals.length?'<button class="mt-home-tool-secondary" type="button" data-mt-home-add-meal>Ajouter mon repas</button>':''}<button class="mt-home-tool-primary" type="button" data-mt-home-full-url="food-day.html">Ouvrir ma journée complète</button>${homePreviewBack('alimentation','Revenir à Mon alimentation')}`);
      document.querySelectorAll('[data-mt-home-open-meal]').forEach(btn=>btn.addEventListener('click',()=>location.href=`food-meal.html?meal_id=${encodeURIComponent(btn.dataset.mtHomeOpenMeal)}`));
      document.querySelector('[data-mt-home-add-meal]')?.addEventListener('click',()=>window.mtOpenHomeMealSheet());bindHomePreviewCommon('alimentation');
    }catch(e){await homePremiumLoaderFloor(premiumStarted);openHTML(`<div class="mt-home-tool-mark">${icon('calendar','◌')}</div><div class="mt-home-tool-kicker">Ma journée alimentaire</div><h2>Lecture momentanément indisponible.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'Réessaie dans un instant.'))}</p><button class="mt-home-tool-primary" type="button" data-mt-home-full-url="food-day.html">Ouvrir ma journée complète</button>${homePreviewBack('alimentation','Revenir à Mon alimentation')}`);bindHomePreviewCommon('alimentation');}
  };

  window.mtOpenHomeAdapterPreview=async function(){
    const premiumStarted=performance.now();
    openHTML(`<div class="mt-home-tool-mark">${icon('sparkle','✦')}</div><div class="mt-home-tool-kicker">Adapter mon repas</div><h2>Choisis d’abord le bon repas.</h2><p class="mt-home-tool-lead">TEE peut partir directement de ce que tu as enregistré aujourd’hui.</p>${homePremiumLoader('bar','Lecture de ta journée…','On retrouve tes repas avant de te proposer celui à adapter.')} `);
    try{
      const meals=await homeTodayMeals();
      await homePremiumLoaderFloor(premiumStarted);
      openHTML(`<div class="mt-home-tool-mark">${icon('sparkle','✦')}</div><div class="mt-home-tool-kicker">Adapter mon repas</div><h2>${meals.length?'Quel repas veux-tu ajuster ?':'Ajoute d’abord ton repas.'}</h2><p class="mt-home-tool-lead">Tu gardes ton alimentation telle qu’elle est : TEE travaille seulement sur le repas choisi.</p>${homeMealRowsHTML(meals,{adapter:true})}${!meals.length?'<button class="mt-home-tool-secondary" type="button" data-mt-home-add-meal>Ajouter mon repas</button>':''}<button class="mt-home-tool-primary" type="button" data-mt-home-full-url="food-adapter.html">Ouvrir Adapter mon repas en entier</button>${homePreviewBack('alimentation','Revenir à Mon alimentation')}`);
      document.querySelectorAll('[data-mt-home-adapt-meal]').forEach(btn=>btn.addEventListener('click',()=>location.href=`food-adapter.html?meal_id=${encodeURIComponent(btn.dataset.mtHomeAdaptMeal)}`));
      document.querySelector('[data-mt-home-add-meal]')?.addEventListener('click',()=>window.mtOpenHomeMealSheet());bindHomePreviewCommon('alimentation');
    }catch(e){await homePremiumLoaderFloor(premiumStarted);openHTML(`<div class="mt-home-tool-mark">${icon('sparkle','✦')}</div><div class="mt-home-tool-kicker">Adapter mon repas</div><h2>Ta version complète reste disponible.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'La journée n’a pas pu être relue maintenant.'))}</p><button class="mt-home-tool-primary" type="button" data-mt-home-full-url="food-adapter.html">Ouvrir Adapter mon repas</button>${homePreviewBack('alimentation','Revenir à Mon alimentation')}`);bindHomePreviewCommon('alimentation');}
  };

  function readComposerRows(){
    const uid=memberId||'member';let favorites=[],recent=[];try{favorites=JSON.parse(localStorage.getItem(`mt_tee_inspired_favorites_v1_${uid}`)||'[]')||[];}catch(_){}try{recent=JSON.parse(localStorage.getItem(`mt_tee_inspiration_recent_v1_${uid}`)||'[]')||[];}catch(_){}return {favorites:Array.isArray(favorites)?favorites:[],recent:Array.isArray(recent)?recent:[]};
  }
  window.mtOpenHomeComposerPreview=function(){
    const rows=readComposerRows(),ideas=[...rows.favorites,...rows.recent.filter(r=>!rows.favorites.some(f=>String(f.title||'')===String(r.title||'')))].slice(0,3);
    openHTML(`<div class="mt-home-tool-mark">${icon('leaf','✦')}</div><div class="mt-home-tool-kicker">Composer avec TEE</div><h2>Pars de ce que tu as déjà.</h2><p class="mt-home-tool-lead">Prépare ton point de départ ici ; la version complète servira seulement à composer et affiner l’idée.</p><div class="mt-home-preview-section"><small>Ce que j’ai sous la main</small><textarea class="mt-home-preview-input" id="mtHomeComposerSeed" placeholder="Ex. riz, poulet, tomates, citron"></textarea></div>${ideas.length?`<div class="mt-home-preview-section"><small>Idées déjà croisées</small><div class="mt-home-preview-list">${ideas.map(x=>`<button type="button" class="mt-home-preview-row" data-mt-home-composer-idea="${esc(x.ingredients||'')}"><span><b>${esc(x.title||'Idée TEE')}</b><small>${esc(x.ingredients||'À recomposer selon ce que tu as.')}</small></span><em>Reprendre ›</em></button>`).join('')}</div></div>`:''}<button class="mt-home-tool-primary" type="button" id="mtHomeOpenComposerFull">Ouvrir Composer avec TEE en entier</button>${homePreviewBack('alimentation','Revenir à Mon alimentation')}`);
    const input=document.getElementById('mtHomeComposerSeed');document.querySelectorAll('[data-mt-home-composer-idea]').forEach(btn=>btn.addEventListener('click',()=>{if(input)input.value=btn.dataset.mtHomeComposerIdea||'';}));
    document.getElementById('mtHomeOpenComposerFull')?.addEventListener('click',()=>{const ingredients=String(input?.value||'').trim();if(ingredients)try{sessionStorage.setItem('mtComposerSeedV1',JSON.stringify({ingredients,created_at:new Date().toISOString()}));}catch(_){}location.href='food-inspiration.html';});bindHomePreviewCommon('alimentation');
  };

  window.mtOpenHomePlannerPreview=async function(){
    const premiumStarted=performance.now();
    openHTML(`<div class="mt-home-tool-mark">${icon('calendar','◌')}</div><div class="mt-home-tool-kicker">Planifier ma semaine</div><h2>Ta base avant de construire.</h2><p class="mt-home-tool-lead">On relit seulement tes réglages essentiels ici. Le moteur complet reste dans le planificateur.</p>${homePremiumLoader('bar','Lecture de tes préférences…','Budget, placard, restes et contraintes se remettent en place.')} `);
    try{
      const sb=client(),uid=await homeUserId();let p={};if(sb&&uid){const {data,error}=await sb.from('mt_planner_preferences').select('pantry_terms,excluded_terms,weekly_budget_eur,budget_mode,servings,restaurant_day,use_leftovers').eq('user_id',uid).maybeSingle();if(error)throw error;p=data||{};}
      const pantry=Array.isArray(p.pantry_terms)?p.pantry_terms:[],excluded=Array.isArray(p.excluded_terms)?p.excluded_terms:[];
      await homePremiumLoaderFloor(premiumStarted);
      openHTML(`<div class="mt-home-tool-mark">${icon('calendar','◌')}</div><div class="mt-home-tool-kicker">Planifier ma semaine</div><h2>${Object.keys(p).length?'Tes réglages sont prêts.':'Commence avec une base simple.'}</h2><p class="mt-home-tool-lead">Placard, budget et personnes restent visibles avant d’ouvrir la construction complète.</p><div class="mt-home-preview-summary"><div class="mt-home-preview-stat"><b>${p.weekly_budget_eur??'—'}${p.weekly_budget_eur!=null?' €':''}</b><span>budget indicatif</span></div><div class="mt-home-preview-stat"><b>${Number(p.servings)||1}</b><span>personne${Number(p.servings)>1?'s':''}</span></div><div class="mt-home-preview-stat"><b>${pantry.length}</b><span>repère${pantry.length>1?'s':''} placard</span></div><div class="mt-home-preview-stat"><b>${p.use_leftovers===false?'Non':'Oui'}</b><span>réutiliser les restes</span></div></div>${pantry.length?`<div class="mt-home-preview-section"><small>Déjà dans ton placard</small><div class="mt-home-preview-chips">${pantry.slice(0,6).map(x=>`<span class="mt-home-preview-chip">${esc(x)}</span>`).join('')}</div></div>`:''}${excluded.length?`<div class="mt-home-preview-section"><small>Exclusions enregistrées</small><div class="mt-home-preview-chips">${excluded.slice(0,6).map(x=>`<span class="mt-home-preview-chip">${esc(x)}</span>`).join('')}</div></div>`:''}<button class="mt-home-tool-primary" type="button" data-mt-home-full-url="tee-next.html?tool=planner">Ouvrir le planificateur complet</button>${homePreviewBack('alimentation','Revenir à Mon alimentation')}`);bindHomePreviewCommon('alimentation');
    }catch(e){await homePremiumLoaderFloor(premiumStarted);openHTML(`<div class="mt-home-tool-mark">${icon('calendar','◌')}</div><div class="mt-home-tool-kicker">Planifier ma semaine</div><h2>Le planificateur reste disponible.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'Tes réglages n’ont pas pu être relus maintenant.'))}</p><button class="mt-home-tool-primary" type="button" data-mt-home-full-url="tee-next.html?tool=planner">Ouvrir le planificateur complet</button>${homePreviewBack('alimentation','Revenir à Mon alimentation')}`);bindHomePreviewCommon('alimentation');}
  };

  window.mtOpenHomeTrackersPreview=async function(){
    const premiumStarted=performance.now();
    openHTML(`<div class="mt-home-tool-mark">${icon('calendar','◌')}</div><div class="mt-home-tool-kicker">Mes suivis & tendances</div><h2>Je relie tes repères utiles.</h2><p class="mt-home-tool-lead">Tu vois d’abord l’essentiel ici ; le Carnet complet reste disponible ensuite.</p>${homePremiumLoader('equilibre','Lecture de tes suivis actifs…','Tes repères du Carnet se reconnectent à cette vue.')} `);
    try{
      await window.mtEnsureAdvancedTrackers?.();const cards=typeof window.mtCustomTrackersTodayCards==='function'?await window.mtCustomTrackersTodayCards():[],documented=cards.filter(x=>x.hasData).length;
      await homePremiumLoaderFloor(premiumStarted);
      openHTML(`<div class="mt-home-tool-mark">${icon('calendar','◌')}</div><div class="mt-home-tool-kicker">Mes suivis & tendances</div><h2>${cards.length?`${documented}/${cards.length} repères documentés aujourd’hui.`:'Choisis seulement ce qui t’aide.'}</h2><p class="mt-home-tool-lead">Tes suivis actifs et leur état du jour, sans t’envoyer d’abord au sommet du Carnet.</p>${cards.length?`<div class="mt-home-preview-list">${cards.slice(0,5).map(x=>`<button class="mt-home-preview-row" type="button" data-mt-home-tracker="${esc(x.key)}"><span><b>${esc(x.title)}</b><small>${esc(x.headline||'À renseigner aujourd’hui')}</small></span><em>${x.hasData?'Voir':'Renseigner'} ›</em></button>`).join('')}</div>`:'<div class="mt-home-preview-empty">Aucun suivi personnalisé actif pour le moment. Tu peux en choisir un seul pour commencer.</div>'}<button class="mt-home-tool-secondary" type="button" id="mtHomeOpenTrends">Voir mes tendances sur 28 jours</button>${!cards.length?'<button class="mt-home-tool-secondary" type="button" id="mtHomeChooseTrackers">Choisir mes suivis</button>':''}<button class="mt-home-tool-primary" type="button" data-mt-home-full-url="library.html?focus=trackers">Ouvrir Mes suivis dans le Carnet</button>${homePreviewBack('equilibre','Revenir à Mon équilibre')}`);
      document.querySelectorAll('[data-mt-home-tracker]').forEach(btn=>btn.addEventListener('click',async()=>{const key=btn.dataset.mtHomeTracker;await window.mtCloseHomeToolSheet?.();setTimeout(()=>window.mtOpenCarnetTrackingEntry?.(key),120);}));
      document.getElementById('mtHomeOpenTrends')?.addEventListener('click',async()=>{await window.mtCloseHomeToolSheet?.();setTimeout(()=>window.mtOpenCarnetGlobalTrends?.(),120);});document.getElementById('mtHomeChooseTrackers')?.addEventListener('click',async()=>{await window.mtCloseHomeToolSheet?.();setTimeout(()=>window.mtOpenCarnetAddTracking?.(),120);});bindHomePreviewCommon('equilibre');
    }catch(e){await homePremiumLoaderFloor(premiumStarted);openHTML(`<div class="mt-home-tool-mark">${icon('calendar','◌')}</div><div class="mt-home-tool-kicker">Mes suivis & tendances</div><h2>Ton Carnet reste accessible.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'Les suivis n’ont pas pu être relus maintenant.'))}</p><button class="mt-home-tool-primary" type="button" data-mt-home-full-url="library.html?focus=trackers">Ouvrir Mes suivis dans le Carnet</button>${homePreviewBack('equilibre','Revenir à Mon équilibre')}`);bindHomePreviewCommon('equilibre');}
  };

  function homeCompletedDaysCount(value){
    let rows=value;
    if(typeof rows==='string'){
      try{rows=JSON.parse(rows);}catch(_){rows=rows.split(',').map(v=>v.trim()).filter(Boolean);}
    }
    if(!Array.isArray(rows))return 0;
    return new Set(rows.map(v=>String(v&&typeof v==='object'?(v.date||v.day||v.entry_date||''):v||'')).filter(Boolean)).size;
  }
  function homeProtocolTotal(protocol,row){
    const fromLabel=String(protocol?.duration_label||'').match(/\d+/)?.[0];
    return Math.max(1,Number(row?.total_days||protocol?.total_days||fromLabel||7));
  }
  function homeShortDate(value){
    const d=value?new Date(value):null;if(!d||Number.isNaN(d.getTime()))return 'Pas encore validé';
    return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}).replace('.','');
  }
  async function homeLoadParcoursPreview(){
    const state=window.__MT_TODAY_STATE__?.user?window.__MT_TODAY_STATE__:(window.mtBuildTodayState?await window.mtBuildTodayState():null);
    if(state?.user)window.__MT_TODAY_STATE__=state;
    const active=state?.active||null,uid=state?.user?.id||await homeUserId(),sb=client();
    let rows=[],protocols=[],progressAvailable=true,activeProgressAvailable=true,protocolMetaAvailable=true;
    if(sb&&uid){
      const progressSelect='protocol_id,current_day,total_days,completed_days,last_validated_at,updated_at,certificate_unlocked';
      const r=await sb.from('protocol_progress').select(progressSelect).eq('user_id',uid).order('updated_at',{ascending:false}).limit(6);
      if(r.error){progressAvailable=false;activeProgressAvailable=false;}else if(Array.isArray(r.data)){rows=r.data;}
      if(active?.id&&!rows.some(x=>String(x?.protocol_id||'')===String(active.id))){
        const exact=await sb.from('protocol_progress').select(progressSelect).eq('user_id',uid).eq('protocol_id',active.id).limit(1);
        if(exact.error){activeProgressAvailable=false;}
        else{
          activeProgressAvailable=true;
          const exactRow=Array.isArray(exact.data)?exact.data[0]:null;
          if(exactRow)rows=[exactRow,...rows.filter(x=>String(x?.protocol_id||'')!==String(active.id))];
        }
      }
      const ids=[...new Set(rows.map(x=>x.protocol_id).filter(Boolean).map(String))];
      if(active?.id&&!ids.includes(String(active.id)))ids.unshift(String(active.id));
      if(ids.length){
        const p=await sb.from('protocols').select('id,title,duration_label,total_days').in('id',ids);
        if(p.error){protocolMetaAvailable=false;}else if(Array.isArray(p.data)){protocols=p.data;}
      }
    }
    const byId=new Map(protocols.map(p=>[String(p.id),p])),rowById=new Map(rows.map(r=>[String(r.protocol_id),r]));
    let activeCard=null;
    if(active){
      const row=rowById.get(String(active.id))||null;
      const protocol=byId.get(String(active.id))||{id:active.id,title:active.title,total_days:active.total};
      const total=homeProtocolTotal(protocol,row),day=Math.min(total,Math.max(1,Number(row?.current_day||active.day||1)));
      if(activeProgressAvailable){
        const completed=Math.min(total,homeCompletedDaysCount(row?.completed_days)),pct=Math.min(100,Math.round((completed/total)*100));
        activeCard={id:active.id,title:active.title||protocol.title||'Mon parcours',day,total,completed,pct,last:row?.last_validated_at||row?.updated_at||null,finished:!!row?.certificate_unlocked||completed>=total,progressAvailable:true};
      }else{
        activeCard={id:active.id,title:active.title||protocol.title||'Mon parcours',day,total,completed:null,pct:null,last:null,finished:false,progressAvailable:false};
      }
    }
    const recent=progressAvailable?rows.map(row=>{
      const id=String(row.protocol_id||'');if(!id||String(active?.id||'')===id)return null;
      const protocol=byId.get(id)||{id,title:'Parcours Méthode TEE'};
      const total=homeProtocolTotal(protocol,row),completed=Math.min(total,homeCompletedDaysCount(row.completed_days)),day=Math.min(total,Math.max(1,Number(row.current_day||1)));
      return {id,title:protocol.title||'Parcours Méthode TEE',day,total,completed,pct:Math.min(100,Math.round((completed/total)*100)),last:row.last_validated_at||row.updated_at||null,finished:!!row.certificate_unlocked||completed>=total};
    }).filter(Boolean).slice(0,2):[];
    return {active:activeCard,recent,progressAvailable,activeProgressAvailable,protocolMetaAvailable};
  }
  function homeParcoursRecentHTML(rows){
    if(!rows.length)return '';
    return `<div class="mt-home-preview-subhead"><b>Mes derniers parcours</b><span>${rows.length} récent${rows.length>1?'s':''}</span></div><div class="mt-home-preview-grid is-two">${rows.map(x=>`<button class="mt-home-preview-row" type="button" data-mt-home-protocol="${esc(x.id)}"><span><b>${esc(x.title)}</b><small>${x.finished?'Terminé':`Jour ${x.day} sur ${x.total}`} · ${esc(homeShortDate(x.last))}</small></span><em>${x.finished?'Revoir':'Ouvrir'} ›</em></button>`).join('')}</div>`;
  }
  window.mtOpenHomeParcoursPreview=async function(){
    const premiumStarted=performance.now();
    openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('parcours')}</div><div class="mt-home-tool-kicker">Mes parcours</div><h2>Ta progression, ici d’abord.</h2><p class="mt-home-tool-lead">Tes actions du jour restent dans Aujourd’hui. Ici, tu vois où tu en es avant d’ouvrir ton espace complet.</p>${homePremiumLoader('parcours','Lecture de ta progression…','On retrouve précisément ton parcours actif et ses validations.')} `);
    try{
      const data=await homeLoadParcoursPreview(),a=data.active;
      await homePremiumLoaderFloor(premiumStarted);
      const activeHTML=a?`<div class="mt-home-preview-feature"><small>${a.finished?'Parcours terminé':'Parcours en cours'}</small><h3>${esc(a.title)}</h3><p>${a.finished?'Ton parcours est terminé. Tu peux le revoir quand tu veux.':`Prochaine étape · Jour ${a.day} sur ${a.total}`}</p>${a.progressAvailable?`<div class="mt-home-preview-progress"><i style="width:${a.pct}%"></i></div><div class="mt-home-preview-progress-meta"><span>${a.completed} journée${a.completed>1?'s':''} validée${a.completed>1?'s':''}</span><b>${a.pct}%</b></div>`:`<div class="mt-home-preview-note">Ta progression n’a pas pu être relue pour le moment. Tes validations restent enregistrées et ne sont pas remplacées par un faux 0.</div>`}<button class="mt-home-preview-inline-action" type="button" data-mt-home-protocol="${esc(a.id)}">${a.finished?'Revoir ce parcours':'Continuer ce parcours'} →</button></div>`:(data.progressAvailable===false?`<div class="mt-home-preview-empty">Ta progression est momentanément indisponible. Réessaie dans un instant ou ouvre ton espace complet.</div>`:`<div class="mt-home-preview-empty">Aucun parcours actif pour le moment. Tu peux en choisir un sans quitter cet univers.</div>`);
      openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('parcours')}</div><div class="mt-home-tool-kicker">Mes parcours</div><h2>${a?'Continue ton fil.':'Choisis ton prochain fil.'}</h2><p class="mt-home-tool-lead">Progression et historique restent visibles ici ; les actions immédiates restent dans Aujourd’hui.</p>${activeHTML}${homeParcoursRecentHTML(data.recent)}<button class="mt-home-tool-primary" type="button" id="mtHomeParcoursFull">Voir tous mes parcours</button><button class="mt-home-tool-secondary" type="button" data-mt-home-full-url="protocols.html?category=objectifs_corps">Explorer les objectifs</button>`);
      document.querySelectorAll('[data-mt-home-protocol]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.mtHomeProtocol;if(id)location.href=`protocol-journey.html?id=${encodeURIComponent(id)}`;}));
      document.getElementById('mtHomeParcoursFull')?.addEventListener('click',async()=>{await window.mtCloseHomeToolSheet?.();setTimeout(()=>window.mtOpenParcoursSheet?.(),120);});
      bindHomePreviewCommon('parcours');
    }catch(e){
      await homePremiumLoaderFloor(premiumStarted);
      openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('parcours')}</div><div class="mt-home-tool-kicker">Mes parcours</div><h2>Ta progression reste accessible.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'La progression n’a pas pu être relue maintenant.'))}</p><button class="mt-home-tool-primary" type="button" id="mtHomeParcoursFull">Voir tous mes parcours</button><button class="mt-home-tool-secondary" type="button" data-mt-home-full-url="protocols.html?category=objectifs_corps">Explorer les objectifs</button>`);
      document.getElementById('mtHomeParcoursFull')?.addEventListener('click',async()=>{await window.mtCloseHomeToolSheet?.();setTimeout(()=>window.mtOpenParcoursSheet?.(),120);});
      bindHomePreviewCommon('parcours');
    }
  };

  function homeReadSavedSpace(uid){
    try{const x=JSON.parse(localStorage.getItem(`mt_saved_space_${uid||'guest'}`)||'null');return {favorites:Array.isArray(x?.favorites)?x.favorites:[]};}catch(_){return {favorites:[]};}
  }
  function homeReadRoutineCache(uid){
    try{const x=JSON.parse(localStorage.getItem(`mt_user_routines_v372_${uid||'guest'}`)||'[]');return Array.isArray(x)?x.filter(r=>String(r?.status||'active')==='active'):[];}catch(_){return [];}
  }
  function homeFavoriteFromCloud(row){
    const p=row?.payload&&typeof row.payload==='object'?row.payload:{};
    return {...p,id:p.id||row.item_id,title:p.title||row.title||'Contenu sauvegardé',content:p.content||p.description||row.description||'',type:p.type||row.item_type||'Contenu',source:p.source||row.source||'',saved_at:p.saved_at||row.updated_at||row.created_at||''};
  }
  function homeResourceItemId(item){return String(item?.id||item?.item_ref||item?.recipe_id||'').trim();}
  function homeCleanResourceExcerpt(value,max=118){
    let s=String(value||'').replace(/(^|\s)#{1,6}\s*/g,' ').replace(/[>*_`]+/g,' ').replace(/\s+/g,' ').trim();
    if(!s)return 'À retrouver dans ton espace.';
    if(s.length<=max)return s;
    let cut=s.slice(0,max+1),last=cut.lastIndexOf(' ');
    if(last>Math.floor(max*.62))cut=cut.slice(0,last);else cut=cut.slice(0,max);
    return cut.replace(/[\s,;:.!?…-]+$/,'')+'…';
  }
  async function homeLoadResourcesPreview(){
    const uid=await homeUserId(),sb=client(),local=homeReadSavedSpace(uid);
    let favorites=local.favorites||[],routines=homeReadRoutineCache(uid),totalFavorites=favorites.length,totalRoutines=routines.length,countsExact=!sb||!uid;
    if(sb&&uid){
      const [f,r,fc,rc]=await Promise.all([
        sb.from('user_favorites').select('item_type,item_id,title,description,source,payload,created_at,updated_at').eq('user_id',uid).order('updated_at',{ascending:false}).limit(8),
        sb.from('user_routines').select('id,title,description,status,daypart,frequency,updated_at').eq('user_id',uid).eq('status','active').order('updated_at',{ascending:false}).limit(6),
        sb.from('user_favorites').select('item_id',{count:'exact',head:true}).eq('user_id',uid),
        sb.from('user_routines').select('id',{count:'exact',head:true}).eq('user_id',uid).eq('status','active')
      ]);
      if(f.error)throw f.error;if(r.error)throw r.error;
      favorites=Array.isArray(f.data)?f.data.map(homeFavoriteFromCloud):[];
      routines=Array.isArray(r.data)?r.data:[];
      const nullableCount=value=>value===null||value===undefined||value===''?null:(Number.isFinite(Number(value))?Number(value):null);
      totalFavorites=!fc.error?nullableCount(fc.count):null;
      totalRoutines=!rc.error?nullableCount(rc.count):null;
      countsExact=totalFavorites!==null&&totalRoutines!==null;
    }
    favorites=[...favorites].sort((a,b)=>(Date.parse(b.saved_at||b.updated_at||0)||0)-(Date.parse(a.saved_at||a.updated_at||0)||0));
    const library=favorites.filter(x=>String(x.source||'').toLowerCase()==='library_content_favorite').slice(0,2);
    homeResourceIndex.clear();
    favorites.forEach(item=>{const id=homeResourceItemId(item);if(id)homeResourceIndex.set(id,item);});
    routines.forEach(item=>{const id=homeResourceItemId(item);if(id)homeResourceIndex.set(`routine:${id}`,item);});
    return {favorites:favorites.slice(0,3),routines:routines.slice(0,2),library,totalFavorites,totalRoutines,countsExact};
  }
  function homeResourceRows(items,empty,kind){
    if(!items.length)return `<div class="mt-home-preview-empty">${esc(empty)}</div>`;
    return `<div class="mt-home-preview-grid is-two">${items.map(x=>{const id=homeResourceItemId(x),excerpt=homeCleanResourceExcerpt(x.description||x.content||x.type||'');return `<button class="mt-home-preview-static" type="button" ${kind==='routine'?`data-mt-home-routine-id="${esc(id)}"`:`data-mt-home-favorite-id="${esc(id)}"`}><b>${esc(x.title||'Contenu Méthode TEE')}</b><small>${esc(excerpt)}</small><em>Ouvrir ›</em></button>`;}).join('')}</div>`;
  }
  function homeResourceCountStat(total,label){
    if(total===null||total===undefined||total==='')return `<div class="mt-home-preview-stat"><b>Aperçu</b><span>${esc(label)} récents</span></div>`;
    const parsed=Number(total);
    if(!Number.isFinite(parsed))return `<div class="mt-home-preview-stat"><b>Aperçu</b><span>${esc(label)} récents</span></div>`;
    const n=Math.max(0,Math.trunc(parsed));return `<div class="mt-home-preview-stat"><b>${n}</b><span>${esc(label)}${n>1?'s':''}</span></div>`;
  }
  async function homeOpenFavoritePreview(id){
    if(!id)return;
    const item=homeResourceIndex.get(String(id))||null;
    homeTransitionScreen('favorite','Mes favoris','Ton contenu arrive.','On le prépare ici, sans afficher les écrans intermédiaires.','Ouverture de ton favori…','Le contenu se charge directement derrière cette transition.');
    homeSetHandoffLoading(true);
    try{
      if(item?.source==='recipe_favorite'&&item?.recipe_id&&typeof window.openRecipeViewer==='function'){
        await window.openRecipeViewer(item.recipe_id);
        await homeSleep(40);
        await window.mtCloseHomeToolSheet?.();homeSetHandoffLoading(false);return;
      }
      if(item?.source==='library_content_favorite'&&typeof window.mtOpenSavedLibraryFavorite==='function'){
        await window.mtOpenSavedLibraryFavorite(item);
        await homeSleep(80);
        await window.mtCloseHomeToolSheet?.();homeSetHandoffLoading(false);return;
      }
      if(typeof window.mtOpenSavedCollection==='function'){
        await window.mtOpenSavedCollection('favorites');
        await window.mtOpenSavedDetail?.(id);
        await homeSleep(120);
        await window.mtCloseHomeToolSheet?.();homeSetHandoffLoading(false);return;
      }
      throw new Error('Ce favori ne peut pas être ouvert pour le moment.');
    }catch(e){
      homeSetHandoffLoading(false);
      openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('ressources')}</div><div class="mt-home-tool-kicker">Mes favoris</div><h2>Ce contenu reste dans tes favoris.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'Impossible de l’ouvrir maintenant.'))}</p><button class="mt-home-tool-secondary" type="button" id="mtHomeFavoritesFull">Voir tous mes favoris</button>${homePreviewBack('ressources','Revenir à Mes ressources')}`);
      document.getElementById('mtHomeFavoritesFull')?.addEventListener('click',()=>homeOpenFavoritesFull());bindHomePreviewCommon('ressources');
    }
  }
  async function homeOpenRoutinePreview(id){
    if(!id)return;
    homeTransitionScreen('routine','Mes routines','Ta routine arrive.','On ouvre directement la routine choisie, sans détour par la liste complète.','Préparation de ta routine…','Tes étapes se remettent en place.');
    homeSetHandoffLoading(true);
    try{
      if(typeof window.mtOpenMyRoutines!=='function'||typeof window.mtOpenRoutineDay!=='function')throw new Error('Tes routines sont momentanément indisponibles.');
      await window.mtOpenMyRoutines('profile');
      await window.mtOpenRoutineDay(id);
      await homeSleep(40);
      await window.mtCloseHomeToolSheet?.();homeSetHandoffLoading(false);
    }catch(e){
      homeSetHandoffLoading(false);
      openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('ressources')}</div><div class="mt-home-tool-kicker">Mes routines</div><h2>Ta routine reste enregistrée.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'Impossible de l’ouvrir maintenant.'))}</p><button class="mt-home-tool-secondary" type="button" id="mtHomeRoutinesFull">Ouvrir Mes routines</button>${homePreviewBack('ressources','Revenir à Mes ressources')}`);
      document.getElementById('mtHomeRoutinesFull')?.addEventListener('click',()=>homeOpenRoutinesFull());bindHomePreviewCommon('ressources');
    }
  }
  async function homeOpenFavoritesFull(){
    homeTransitionScreen('favorite','Mes favoris','Je retrouve tout ton espace.','La collection complète s’ouvre directement dès qu’elle est prête.','Ouverture de tes favoris…','Tes contenus sauvegardés se synchronisent.');
    homeSetHandoffLoading(true);
    try{await window.mtOpenSavedCollection?.('favorites');await window.mtCloseHomeToolSheet?.();homeSetHandoffLoading(false);}catch(e){homeSetHandoffLoading(false);window.mtOpenHomeResourcesPreview?.();}
  }
  async function homeOpenRoutinesFull(){
    homeTransitionScreen('routine','Mes routines','Je retrouve tes repères.','La liste complète s’ouvre directement dès qu’elle est prête.','Ouverture de tes routines…','Tes routines actives se synchronisent.');
    homeSetHandoffLoading(true);
    try{await window.mtOpenMyRoutines?.('profile');await window.mtCloseHomeToolSheet?.();homeSetHandoffLoading(false);}catch(e){homeSetHandoffLoading(false);window.mtOpenHomeResourcesPreview?.();}
  }
  window.mtOpenHomeResourcesPreview=async function(){
    const premiumStarted=performance.now();
    openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('ressources')}</div><div class="mt-home-tool-kicker">Mes ressources</div><h2>Retrouve déjà l’essentiel.</h2><p class="mt-home-tool-lead">Favoris, routines et contenus sauvegardés apparaissent ici avant d’ouvrir ta bibliothèque complète.</p>${homePremiumLoader('resources','Lecture de tes ressources…','Favoris, routines et contenus sauvegardés se remettent en place.')} `);
    try{
      const d=await homeLoadResourcesPreview();
      await homePremiumLoaderFloor(premiumStarted);
      openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('ressources')}</div><div class="mt-home-tool-kicker">Mes ressources</div><h2>Tout ce que tu veux retrouver.</h2><p class="mt-home-tool-lead">Tes favoris, tes routines et tes contenus sauvegardés, prêts à retrouver en un geste.</p><div class="mt-home-preview-summary">${homeResourceCountStat(d.totalFavorites,'favori')}${homeResourceCountStat(d.totalRoutines,'routine')}</div><div class="mt-home-preview-subhead"><b>Favoris récents</b><span>${d.favorites.length?'Les derniers':'Aucun pour le moment'}</span></div>${homeResourceRows(d.favorites,'Ajoute un contenu en favori pour le retrouver ici.','favorite')}<button class="mt-home-tool-secondary" type="button" id="mtHomeFavoritesFull">Voir tous mes favoris</button><div class="mt-home-preview-subhead"><b>Mes routines</b><span>${d.routines.length?'En cours':'À créer'}</span></div>${homeResourceRows(d.routines,'Crée une routine quand tu veux garder un repère dans ton quotidien.','routine')}<button class="mt-home-tool-secondary" type="button" id="mtHomeRoutinesFull">Ouvrir Mes routines</button><div class="mt-home-preview-subhead"><b>Dans ma bibliothèque</b><span>${d.library.length?'À retrouver':'Contenus sauvegardés'}</span></div>${homeResourceRows(d.library,'Tes PDF, audios et contenus accessibles restent disponibles dans ta bibliothèque.','favorite')}<button class="mt-home-tool-primary" type="button" data-mt-home-full-url="library.html">Ouvrir ma bibliothèque complète</button>`);
      document.querySelectorAll('[data-mt-home-favorite-id]').forEach(btn=>btn.addEventListener('click',()=>homeOpenFavoritePreview(btn.dataset.mtHomeFavoriteId)));
      document.querySelectorAll('[data-mt-home-routine-id]').forEach(btn=>btn.addEventListener('click',()=>homeOpenRoutinePreview(btn.dataset.mtHomeRoutineId)));
      document.getElementById('mtHomeFavoritesFull')?.addEventListener('click',()=>homeOpenFavoritesFull());
      document.getElementById('mtHomeRoutinesFull')?.addEventListener('click',()=>homeOpenRoutinesFull());
      bindHomePreviewCommon('ressources');
    }catch(e){
      await homePremiumLoaderFloor(premiumStarted);
      openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('ressources')}</div><div class="mt-home-tool-kicker">Mes ressources</div><h2>Ton espace reste disponible.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'Tes ressources n’ont pas pu être relues maintenant.'))}</p><button class="mt-home-tool-primary" type="button" data-mt-home-full-url="library.html">Ouvrir ma bibliothèque complète</button>`);
      bindHomePreviewCommon('ressources');
    }
  };

  function bindUniverseActions(){
    document.querySelectorAll('[data-mt-universe-action]').forEach(btn=>btn.addEventListener('click',async()=>{
      const action=btn.dataset.mtUniverseAction;
      if(!action)return;
      if(action==='meal'){window.mtOpenHomeMealSheet();return;}
      if(action==='food-day'){window.mtOpenHomeFoodDayPreview();return;}
      if(action==='food-adapter'){window.mtOpenHomeAdapterPreview();return;}
      if(action==='composer'){window.mtOpenHomeComposerPreview();return;}
      if(action==='planner'){window.mtOpenHomePlannerPreview();return;}
      if(action==='reference'){window.mtOpenHomeReference();return;}
      if(action==='experience'){window.mtOpenHomeExperiences();return;}
      if(action==='balance'){window.mtOpenHomeBalance();return;}
      if(action==='trackers'){window.mtOpenHomeTrackersPreview();return;}
      if(action==='parcours-preview'){window.mtOpenHomeParcoursPreview();return;}
      if(action==='resources-preview'){window.mtOpenHomeResourcesPreview();return;}
      if(action==='active-protocol'){
        const id=btn.dataset.protocolId;if(id)location.href=`protocol-journey.html?id=${encodeURIComponent(id)}`;return;
      }
      if(action==='my-parcours'){
        await window.mtCloseHomeToolSheet?.();setTimeout(()=>window.mtOpenParcoursSheet?.(),120);return;
      }
      if(action==='objectifs'){location.href='protocols.html?category=objectifs_corps';return;}
      if(action==='pharmaco'){location.href='protocols.html?category=pharmacie_vegetale';return;}
      if(action==='favorites'){homeOpenFavoritesFull();return;}
      if(action==='routines'){homeOpenRoutinesFull();return;}
      if(action==='library'){location.href='library.html';return;}
      if(action==='guest-recipes'){location.href='page.html?slug=recettes';return;}
      if(action==='auth'){location.href='auth.html?next=index.html';return;}
    }));
  }

  function mtHomeBalanceGaugeLabel(value){
    const n=Number(value);
    return Number.isFinite(n)?`${Math.round(n)}%`:'—';
  }
  function mtHomeBalanceGaugeValue(value){
    const n=Number(value);
    return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):0;
  }
  function mtHomeBalanceGaugesHTML(data){
    const defs=[
      ['vitality','Vitalité',data?.vitality?.value??data?.vitality,data?.vitality?.label||'À renseigner'],
      ['inner','Équilibre intérieur',data?.innerBalance?.value??data?.innerBalance,data?.innerBalance?.label||'À renseigner'],
      ['consistency','Régularité',data?.consistency?.value??data?.consistency,data?.consistency?.label||'À construire']
    ];
    return defs.map(([key,label,value,sub])=>`<button class="mt-home-balance-gauge" type="button" data-mt-home-gauge="${key}" aria-label="${esc(label)}"><span class="mt-home-balance-ring" style="--mt-gauge:${mtHomeBalanceGaugeValue(value)}"><b>${mtHomeBalanceGaugeLabel(value)}</b></span><small>${esc(label)}</small><em>${esc(sub)}</em></button>`).join('');
  }
  async function mtHydrateHomeBalanceGauges(){
    const host=document.getElementById('mtHomeBalanceGauges');
    if(!host)return;
    try{
      await loadScriptOnce('scripts/tee-balance.js?v=v4896558-home-gauges-r1','mtHomeTeeBalanceScript');
      const todayState=window.__MT_TODAY_STATE__?.user?window.__MT_TODAY_STATE__:(window.mtBuildTodayState?await window.mtBuildTodayState():null);
      const context={...(window.__MT_TEE_BALANCE_CONTEXT__||{}),todayState};window.__MT_TEE_BALANCE_CONTEXT__=context;
      if(window.mtRefreshTeeBalance)await window.mtRefreshTeeBalance({context,silent:true});
      const d=window.__MT_TEE_BALANCE_RESULT__||null;
      host.innerHTML=mtHomeBalanceGaugesHTML(d);
    }catch(_){
      host.innerHTML=mtHomeBalanceGaugesHTML(null);
    }
    host.querySelectorAll('[data-mt-home-gauge]').forEach(btn=>btn.addEventListener('click',()=>window.mtOpenHomeBalance?.()));
  }

  window.mtOpenHomeUniverse=async function(kind){
    const key=String(kind||'').toLowerCase();
    if(!homeMember){
      const d=homeUniverseGuest(key);
      openHTML(`<div class="mt-home-tool-mark">${icon(d.mark,'✦')}</div><div class="mt-home-tool-kicker">${esc(d.kicker)}</div><h2>${esc(d.title)}</h2><p class="mt-home-tool-lead">${esc(d.lead)}</p><div class="mt-home-tool-actions">${d.actions.map(a=>homeUniverseAction(...a)).join('')}</div>`);
      bindUniverseActions();return;
    }
    if(key==='alimentation'){
      openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('alimentation')}</div><div class="mt-home-tool-kicker">Mon alimentation</div><h2>Tout ce qui concerne tes repas.</h2><p class="mt-home-tool-lead">Enregistre, adapte, compose ou organise ta semaine depuis le même univers.</p><div class="mt-home-tool-actions">
        ${homeUniverseAction('bowl','Ajouter mon repas','Photo, voix, recherche ou scan.','meal')}
        ${homeUniverseAction('calendar','Ma journée alimentaire','Retrouve ce que tu as enregistré aujourd’hui.','food-day')}
        ${homeUniverseAction('sparkle','Adapter mon repas','Améliore un repas sans changer toute ton alimentation.','food-adapter')}
        ${homeUniverseAction('leaf','Composer avec TEE','Construis une idée avec ce que tu as déjà.','composer')}
        ${homeUniverseAction('calendar','Planifier ma semaine','Placard, restes, contraintes et repas de la semaine.','planner')}
      </div>`);bindUniverseActions();return;
    }
    if(key==='equilibre'){
      openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('equilibre')}</div><div class="mt-home-tool-kicker">Mon équilibre</div><h2>Comprendre ce que tes repères racontent.</h2><p class="mt-home-tool-lead">Ici, tu consultes et comprends. Les saisies quotidiennes restent dans Aujourd’hui.</p>
      <div class="mt-home-balance-gauges" id="mtHomeBalanceGauges" aria-label="Aperçu de mon équilibre">${mtHomeBalanceGaugesHTML(null)}</div>
      <div class="mt-home-tool-actions">
        ${homeUniverseAction('chart','Mon équilibre aujourd’hui','Relie énergie, sommeil, habitudes et régularité.','balance')}
        ${homeUniverseAction('sparkle','Ton repère','Un seul repère utile à partir de ce que tu as réellement renseigné.','reference')}
        ${homeUniverseAction('chart','Mes expériences','Teste un levier pendant plusieurs jours et observe ce qui te réussit.','experience')}
        ${homeUniverseAction('calendar','Mes suivis & tendances','Retrouve tes suivis et leur évolution dans ton Carnet.','trackers')}
      </div>`);
      bindUniverseActions();
      mtHydrateHomeBalanceGauges();
      return;
    }
    if(key==='parcours'){window.mtOpenHomeParcoursPreview();return;}
    window.mtOpenHomeResourcesPreview();
  };

  window.mtOpenHomeBalance=async function(){
    const premiumStarted=performance.now();
    openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('equilibre')}</div><div class="mt-home-tool-kicker">Mon équilibre aujourd’hui</div><h2>Je relie tes repères.</h2><p class="mt-home-tool-lead">Un aperçu ici d’abord ; la lecture complète reste disponible juste en dessous.</p>${homePremiumLoader('equilibre','Préparation de ton équilibre…','Tes repères sont reliés avant d’afficher la lecture du jour.')} `);
    try{
      await loadScriptOnce('scripts/tee-balance.js?v=v4896558-home-balance-preview-r1','mtHomeTeeBalanceScript');
      const todayState=window.__MT_TODAY_STATE__?.user?window.__MT_TODAY_STATE__:(window.mtBuildTodayState?await window.mtBuildTodayState():null),context={...(window.__MT_TEE_BALANCE_CONTEXT__||{}),todayState};window.__MT_TEE_BALANCE_CONTEXT__=context;
      if(window.mtRefreshTeeBalance)await window.mtRefreshTeeBalance({context,silent:true});const d=window.__MT_TEE_BALANCE_RESULT__||null;if(!d)throw new Error('Ton équilibre se construit encore.');
      const score=v=>Number.isFinite(Number(v?.value??v))?`${Math.round(Number(v?.value??v))}%`:'—',readiness=d.readiness||{},priority=d.priorityInsight?.message||d.priority?.message||'';
      await homePremiumLoaderFloor(premiumStarted);
      openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('equilibre')}</div><div class="mt-home-tool-kicker">Mon équilibre aujourd’hui</div><h2>${esc(readiness.label||'Comprendre ma journée')}</h2><p class="mt-home-tool-lead">${esc(readiness.message||'Tes repères prennent du sens quand ils sont reliés entre eux.')}</p><div class="mt-home-preview-summary"><div class="mt-home-preview-stat"><b>${score(d.vitality)}</b><span>vitalité</span></div><div class="mt-home-preview-stat"><b>${score(d.innerBalance)}</b><span>équilibre intérieur</span></div><div class="mt-home-preview-stat"><b>${score(d.consistency)}</b><span>régularité</span></div><div class="mt-home-preview-stat"><b>${Array.isArray(d.markers)?d.markers.length:0}</b><span>repères reliés</span></div></div>${priority?`<div class="mt-home-preview-balance"><small>Ce qui compte aujourd’hui</small><b>${esc(d.priorityInsight?.title||'Ton repère')}</b><p>${esc(priority)}</p></div>`:''}<button class="mt-home-tool-primary" type="button" id="mtHomeBalanceFull">Ouvrir mon équilibre complet</button>${homePreviewBack('equilibre','Revenir à Mon équilibre')}`);
      document.getElementById('mtHomeBalanceFull')?.addEventListener('click',async()=>{await window.mtCloseHomeToolSheet?.();setTimeout(()=>window.mtOpenTeeBalance?.(),120);});bindHomePreviewCommon('equilibre');
    }catch(e){await homePremiumLoaderFloor(premiumStarted);openHTML(`<div class="mt-home-tool-mark">${homeUniverseIcon('equilibre')}</div><div class="mt-home-tool-kicker">Mon équilibre aujourd’hui</div><h2>Ton historique se construit.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'Continue simplement à renseigner quelques repères.'))}</p><button class="mt-home-tool-primary" type="button" data-mt-home-full-url="library.html?focus=trackers">Voir mes repères dans le Carnet</button>${homePreviewBack('equilibre','Revenir à Mon équilibre')}`);bindHomePreviewCommon('equilibre');}
  };

  document.addEventListener('mt:community-journey-home',e=>{
    const hint=e?.detail||{};
    window.__MT_HOME_JOURNEY_HINT__=hint;
    const caption=document.getElementById('mtHomeTodayCaption');
    if(!caption||!homeMember)return;
    caption.textContent='Actions du jour';
  });

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
    homeSetHandoffLoading(false);
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
    voiceState.replacements=new Map();
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
    sheet.querySelector('#mtVoiceEditGo')?.addEventListener('click',()=>{const text=String(sheet.querySelector('#mtVoiceEditText')?.value||'').trim();if(text.length<3){window.mtToast?.('Décris simplement ce que tu as mangé.');return;}voiceState.text=text;voiceState.choices=[];voiceState.removedIndexes=new Set();voiceState.replacements=new Map();resolveVoicePhrase(text,[],0);});
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
  function replacementFor(index){return voiceState.replacements?.get?.(Number(index))||null;}
  function effectiveVoiceItem(item){
    const repl=replacementFor(item?.item_index);if(!repl)return item;
    const current=choiceFor(item?.item_index),grams=Number(repl.grams||current?.grams_override)||null;
    const confirmed=!!item?.confirmed||!!current?.confirmed;
    const basePortion=repl.portion||{status:grams?'resolved_manual':'needs_quantity',grams,estimated:false,verified:false,requires_confirmation:true,source:'manual_library_replace'};
    const portion=grams?{...basePortion,grams}:basePortion;
    return {...item,
      final_food:repl.final_food,
      final_grams:grams,
      portion,
      confirmed,
      status:grams?(confirmed?'ready_to_add':'awaiting_confirmation'):'needs_quantity',
      ready_for_confirmation:!!grams,
      ready_to_add:!!grams&&confirmed,
      alternatives:[],
      selected_option:{status:'resolved',option_key:'manual_library_replace',display_name:repl.final_food?.display_name||'Remplacement'},
      _manualReplacement:true
    };
  }
  function effectiveVoiceItems(items){return displayVoiceItems(items).map(effectiveVoiceItem);}
  async function mtVoiceReplacementFromSearchRow(item,row){
    const name=String(row?.display_name||row?.name||'Aliment').trim();
    const dictionaryId=row?.dictionary_id||null,code=row?.code||null;
    let grams=null,portion=null;
    const spokenExact=String(item?.portion?.source||'')==='spoken_metric'||String(item?.heard_quantity?.base_unit||'').toLowerCase()==='g';
    if(spokenExact&&Number(item?.final_grams)>0){
      grams=Number(item.final_grams);portion={status:'resolved_exact',grams,estimated:false,verified:true,requires_confirmation:true,source:'spoken_metric_preserved'};
    }else{
      try{
        const sb=client();
        const {data}=await sb.rpc('mt_portion_profile',{p_name:name,p_ciqual_code:code,p_dictionary_id:dictionaryId});
        const g=Number(data?.grams_per_unit),a=Number(data?.default_amount);
        if(Number.isFinite(g)&&g>0&&Number.isFinite(a)&&a>0){grams=g*a;portion={status:data?.estimated?'resolved_estimated':'resolved_verified',grams,estimated:data?.estimated!==false,verified:!!data?.verified,requires_confirmation:true,source:'mt_portion_profile',source_label:data?.source_label||null,notes:data?.notes||null};}
      }catch(_){ }
      if(!grams&&Number(item?.final_grams)>0){grams=Number(item.final_grams);portion={status:'resolved_estimated',grams,estimated:true,verified:false,requires_confirmation:true,source:'previous_quantity_preserved'};}
    }
    return {final_food:{food_ref:dictionaryId?`dict:${dictionaryId}`:`ciqual:${code||''}`,ciqual_code:code,dictionary_id:dictionaryId,source_kind:dictionaryId?'dictionary':'ciqual',display_name:name,canonical_name:row?.name||name,multimodal_key:null},grams,portion,search_row:row};
  }
  function renderVoiceReplacePicker(index){
    const raw=(Array.isArray(voiceState.payload?.items)?voiceState.payload.items:[]).find(x=>Number(x?.item_index)===Number(index));if(!raw)return;
    const current=effectiveVoiceItem(raw),modal=ensureModal(),sheet=modal.querySelector('.mt-home-tool-sheet');if(!sheet)return;
    const oldName=current?.final_food?.display_name||current?.original_resolution?.display_name||current?.food_text||'ce repère';
    sheet.innerHTML=`<div class="mt-home-tool-grip"></div><button type="button" class="mt-home-tool-close" data-mt-home-close aria-label="Fermer">×</button><div class="mt-home-tool-mark" aria-hidden="true"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"><path d="M20 7h-7a4 4 0 0 0-4 4v1"/><path d="m17 4 3 3-3 3"/><path d="M4 17h7a4 4 0 0 0 4-4v-1"/><path d="m7 20-3-3 3-3"/></svg></div><div class="mt-home-tool-kicker">Remplacer ce repère</div><h2>Choisis dans ta bibliothèque.</h2><p class="mt-home-tool-lead">TEE remplacera seulement <b>${esc(oldName)}</b>. Le reste de ton repas ne bouge pas.</p><div class="mt-voice-replace-search"><input class="mt-voice-replace-input" id="mtVoiceReplaceInput" value="${esc(raw?.food_text||'')}" placeholder="Rechercher un aliment ou un plat"><div class="mt-voice-replace-results" id="mtVoiceReplaceResults"><div class="mt-voice-replace-empty">Écris au moins 2 lettres.</div></div><button class="mt-home-tool-secondary" type="button" id="mtVoiceReplaceBack">Retour à mon repas</button></div>`;
    sheet.querySelector('[data-mt-home-close]')?.addEventListener('click',()=>window.mtCloseHomeToolSheet());
    sheet.querySelector('#mtVoiceReplaceBack')?.addEventListener('click',renderVoiceResolution);
    const input=sheet.querySelector('#mtVoiceReplaceInput'),box=sheet.querySelector('#mtVoiceReplaceResults');let seq=0,timer=0;
    const run=async()=>{const q=String(input?.value||'').trim();if(q.length<2){box.innerHTML='<div class="mt-voice-replace-empty">Écris au moins 2 lettres.</div>';return;}const own=++seq;box.innerHTML='<div class="mt-voice-replace-empty">Recherche dans la bibliothèque…</div>';try{const sb=client();const {data,error}=await sb.rpc('search_foods_v4',{p_query:q,p_limit:12});if(error)throw error;if(own!==seq)return;const rows=Array.isArray(data)?data:[];box.innerHTML=rows.length?rows.map((r,i)=>`<button type="button" class="mt-voice-replace-result" data-mt-replace-result="${i}"><b>${esc(r.display_name||r.name||'Aliment')}</b><small>${esc(r.country||r.source||'Bibliothèque Méthode TEE')}</small></button>`).join(''):'<div class="mt-voice-replace-empty">Aucun résultat. Essaie un autre nom.</div>';box.querySelectorAll('[data-mt-replace-result]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const repl=await mtVoiceReplacementFromSearchRow(raw,rows[Number(btn.dataset.mtReplaceResult)]);voiceState.replacements.set(Number(index),repl);voiceState.choices=voiceState.choices.filter(x=>Number(x?.item_index)!==Number(index));renderVoiceResolution();window.mtToast?.('Repère remplacé.');}));}catch(e){box.innerHTML=`<div class="mt-voice-replace-empty">${esc(e?.message||'Recherche momentanément indisponible.')}</div>`;}};
    input?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(run,180);});
    setTimeout(()=>{input?.focus();run();},80);
  }
  function renderVoiceResolution(){
    const payload=voiceState.payload||{},rawItems=Array.isArray(payload.items)?payload.items:[],items=effectiveVoiceItems(rawItems),modal=ensureModal(),sheet=modal.querySelector('.mt-home-tool-sheet');if(!sheet)return;
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
      return `<article class="mt-voice-item${item?._manualReplacement?' is-replaced':''}"><div class="mt-voice-item-head"><b>${esc(name)}${item?._manualReplacement?'<span class="mt-voice-replaced-note">Remplacé par toi</span>':''}</b><div class="mt-voice-item-meta"><span>${esc(quantityLabel(item))}</span><div class="mt-voice-item-tools"><button type="button" class="mt-voice-item-remove" data-mt-voice-remove="${esc(item.item_index)}" aria-label="Retirer ${esc(name)}">×</button><button type="button" class="mt-voice-item-replace" data-mt-voice-replace="${esc(item.item_index)}" aria-label="Remplacer ${esc(name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7h-7a4 4 0 0 0-4 4v1"/><path d="m17 4 3 3-3 3"/><path d="M4 17h7a4 4 0 0 0 4-4v-1"/><path d="m7 20-3-3 3-3"/></svg></button></div></div></div>${detail?`<p>${esc(detail)}</p>`:''}${estimated}${helper}${optionHTML}${gramsHTML}${item?.status==='needs_search'?`<button class="mt-home-tool-secondary" type="button" data-mt-voice-search-item="${esc(item.item_index)}">Rechercher cet aliment</button>`:''}</article>`;
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
      voiceState.replacements?.delete?.(index);
      voiceState.choices=voiceState.choices.filter(x=>Number(x?.item_index)!==index);
      renderVoiceResolution();
      window.mtToast?.('Repère retiré.');
    }));
    sheet.querySelectorAll('[data-mt-voice-replace]').forEach(btn=>btn.addEventListener('click',()=>renderVoiceReplacePicker(Number(btn.dataset.mtVoiceReplace))));
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
    const visibleItems=effectiveVoiceItems(Array.isArray(voiceState.payload?.items)?voiceState.payload.items:[]);
    visibleItems.forEach(item=>setChoice(item.item_index,{confirmed:true}));
    const button=document.getElementById('mtVoiceConfirm');if(button){button.disabled=true;button.textContent='Préparation du Carnet…';}
    try{
      const sb=client();if(!sb)throw new Error('Connexion au Carnet indisponible.');
      const {data,error}=await sb.rpc('resolve_food_speech_phrase_v8_json',{p_text:prepareVoiceRpcText(voiceState.text),p_choices:voiceState.choices,p_limit_items:12});if(error)throw error;
      voiceState.payload=data||{};
      const resolvedVisible=effectiveVoiceItems(Array.isArray(data?.items)?data.items:[]);
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
    const premiumStarted=performance.now();
    openHTML(`<div class="mt-home-tool-mark">✦</div><div class="mt-home-tool-kicker">Ton repère aujourd’hui</div><h2>Je relie tes repères.</h2><p class="mt-home-tool-lead">Cette lecture ne se charge qu’au toucher : l’Accueil reste léger.</p>${homePremiumLoader('equilibre','Préparation de ton repère personnel…','TEE relie uniquement les informations réellement renseignées.')} `);
    try{
      const {decision}=await getPersonalDecision(true);
      await homePremiumLoaderFloor(premiumStarted);writeSnapshot('reference',{short:shortLabel(decision.title,'Voir aujourd’hui')});
      const caption=document.getElementById('mtHomeReferenceCaption');if(caption)caption.textContent=shortLabel(decision.title,'Voir aujourd’hui');
      openHTML(`<div class="mt-home-tool-mark">✦</div><div class="mt-home-tool-kicker">Ton repère aujourd’hui</div><h2>Voilà ce qui compte maintenant.</h2><p class="mt-home-tool-lead">Un seul repère à la fois, à partir de ce que tu as réellement renseigné.</p>${decisionHTML(decision,false)}<button class="mt-home-tool-footer" type="button" data-mt-open-today>Ouvrir Aujourd’hui →</button>`);
      document.querySelector('[data-mt-open-today]')?.addEventListener('click',()=>{window.mtCloseHomeToolSheet();setTimeout(()=>window.mtOpenTodaySheet?.(),150);});
    }catch(e){await homePremiumLoaderFloor(premiumStarted);openHTML(`<div class="mt-home-tool-mark">✦</div><div class="mt-home-tool-kicker">Ton repère aujourd’hui</div><h2>Ton historique se construit.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'Continue simplement à renseigner tes journées.'))}</p><div class="mt-home-ref-action"><b>Aujourd’hui</b>Renseigne seulement ce qui t’aide réellement. Méthode TEE évite d’inventer une priorité quand elle n’a pas assez de données.</div>`);}
  };

  window.mtOpenHomeExperiences=async function(){
    const premiumStarted=performance.now();
    openHTML(`<div class="mt-home-tool-mark">↻</div><div class="mt-home-tool-kicker">Mes expériences</div><h2>Découvrir ce qui te réussit.</h2><p class="mt-home-tool-lead">TEE cherche un seul levier pertinent à tester plusieurs jours, puis le réévalue.</p>${homePremiumLoader('equilibre','Lecture de tes repères comparables…','On cherche un levier pertinent sans forcer de conclusion.')} `);
    try{
      const {model,decision}=await getPersonalDecision(true);
      await homePremiumLoaderFloor(premiumStarted);expState.model=model;expState.raw=decision;
      const actionable=['recovery','protein','density','energy_review'].includes(String(decision.key||''));
      writeSnapshot('experience',{short:actionable?shortLabel(decision.title,'Expérience proposée'):'À construire'});const caption=document.getElementById('mtHomeExperienceCaption');if(caption)caption.textContent=actionable?shortLabel(decision.title,'Expérience proposée'):'À construire';
      openHTML(`<div class="mt-home-tool-mark">↻</div><div class="mt-home-tool-kicker">Mes expériences</div><h2>${actionable?'Une expérience se dessine.':'On ne force pas une expérience.'}</h2><p class="mt-home-tool-lead">${actionable?'Teste un seul geste pendant 7 jours puis compare avec tes journées précédentes.':'Quand les données ne racontent pas encore une histoire assez claire, Méthode TEE continue simplement d’observer.'}</p>${decisionHTML(decision,true)}${actionable?'<button class="mt-home-tool-primary" type="button" id="mtHomeStartExperience">Commencer cette expérience</button>':''}`);
      document.getElementById('mtHomeStartExperience')?.addEventListener('click',startHomeExperience);
    }catch(e){await homePremiumLoaderFloor(premiumStarted);openHTML(`<div class="mt-home-tool-mark">↻</div><div class="mt-home-tool-kicker">Mes expériences</div><h2>Pas encore assez de journées comparables.</h2><p class="mt-home-tool-lead">${esc(String(e?.message||'Continue à documenter tes repères.'))}</p>`);}
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
