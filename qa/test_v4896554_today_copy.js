const fs=require('fs');
const js=fs.readFileSync('scripts/v14-luxe.js','utf8');
const html=fs.readFileSync('index.html','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(js.includes("'Actions du jour · hydratation · suivis'"),'caption default missing');
ok(js.includes('<strong>Aujourd’hui</strong><small id="mtHomeTodayCaption">'), 'today caption id missing');
ok(js.includes('<em>Continuer →</em>'), 'Continuer missing');
ok(!js.includes('member-strip member-strip-today mt-home-today-card"'), 'layout-changing today class reintroduced');
ok(html.includes('scripts/v14-luxe.js?v=v4896554-home-today-copy-r1'),'cache-buster missing');
console.log('V4896554 OK');
