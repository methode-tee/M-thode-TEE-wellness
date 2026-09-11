const fs=require('fs');
const s=fs.readFileSync(require('path').join(__dirname,'../scripts/home-smart-cards.js'),'utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(s.includes('HOME_PREMIUM_LOADER_MIN_MS=750'),'minimum loader 750 ms absent');
ok((s.match(/const premiumStarted=performance\.now\(\);/g)||[]).length===9,'les 9 vues premium ne sont pas toutes chronométrées');
ok((s.match(/await homePremiumLoaderFloor\(premiumStarted\);/g)||[]).length>=18,'plancher non appliqué aux succès + erreurs');
ok(s.includes("homeTransitionScreen('favorite'"),'transition favori supprimée par erreur');
ok(s.includes("homeTransitionScreen('routine'"),'transition routine supprimée par erreur');
console.log('V4896562 QA OK');
