const fs=require('fs');
const js=fs.readFileSync('scripts/v14-luxe.js','utf8');
const css=fs.readFileSync('styles/style.css','utf8');
const html=fs.readFileSync('index.html','utf8');
function ok(v,m){ if(!v){ console.error('FAIL:',m); process.exit(1); } }
ok(js.includes("const caption='Actions du jour';"),'caption exact missing');
ok(js.includes('<em>Continuer →</em>'),'Continuer copy missing');
ok(css.includes('.member-strip.member-strip-today em{margin-left:auto;font-size:12px;font-weight:800;color:var(--gold);'),'gold continue missing');
ok(html.includes('v4896555-today-micro-r1'),'cache buster missing');
console.log('OK V4896555');
