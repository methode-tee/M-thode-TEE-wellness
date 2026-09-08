/* MÉTHODE TEE — V487 · Observabilité locale sans service payant.
   Aucun envoi réseau automatique. Ring buffer local, données sensibles neutralisées. */
(function(){'use strict';if(window.MTDiagnostics)return;const KEY='mt_diag_local_v1',MAX=30;
const clean=v=>String(v||'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]').replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,'[id]').replace(/https?:\/\/\S+/gi,'[url]').slice(0,260);
function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
function push(kind,message,source=''){try{const rows=read();rows.push({at:new Date().toISOString(),kind:clean(kind),message:clean(message),page:location.pathname.split('/').pop()||'index',source:clean(source)});localStorage.setItem(KEY,JSON.stringify(rows.slice(-MAX)))}catch(_){}}
window.addEventListener('error',e=>push('error',e?.message,e?.filename));window.addEventListener('unhandledrejection',e=>push('promise',e?.reason?.message||e?.reason||'rejection'));
window.MTDiagnostics={read,clear(){try{localStorage.removeItem(KEY)}catch(_){}},push,copy:async()=>{const text=JSON.stringify(read(),null,2);try{await navigator.clipboard.writeText(text);return true}catch(_){return false}}};})();
