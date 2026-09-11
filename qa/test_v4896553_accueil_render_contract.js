const fs=require('fs');
const assert=require('assert');
const root=__dirname+'/..';
const idx=fs.readFileSync(root+'/index.html','utf8');
const css=fs.readFileSync(root+'/styles/style.css','utf8');
const smart=fs.readFileSync(root+'/scripts/home-smart-cards.js','utf8');
const shell=fs.readFileSync(root+'/scripts/v14-luxe.js','utf8');

assert(shell.includes('<strong>Aujourd’hui</strong><small>Voir ton rituel du jour</small></div><em>Ouvrir →</em>'));
assert(shell.includes('<strong>Bienvenue</strong><small>Crée ton espace gratuitement</small></div><em>Commencer →</em>'));
assert(!shell.includes('mt-home-today-card'));
assert(!shell.includes('Actions du jour · hydratation · suivis'));
assert(!shell.includes('Continuer →</em></button>'));
assert(!css.includes('.member-strip.member-strip-today.mt-home-today-card'));

for(const txt of ['Repas · idées · semaine','Repères · tendances','Protocoles · suivi','Favoris · bibliothèque']){
  assert(idx.includes(txt), 'index manque '+txt);
  assert(smart.includes(txt), 'smart cards manque '+txt);
}
assert(!idx.includes('Protocoles · progression'));
assert(!idx.includes('Favoris · routines · bibliothèque'));
assert(!css.includes('.mt-home-universe-rail{display:grid'));

for(const pair of [
  ['index.html','www/index.html'],
  ['styles/style.css','www/styles/style.css'],
  ['scripts/home-smart-cards.js','www/scripts/home-smart-cards.js'],
  ['scripts/v14-luxe.js','www/scripts/v14-luxe.js'],
]){
  assert.strictEqual(fs.readFileSync(root+'/'+pair[0],'utf8'),fs.readFileSync(root+'/'+pair[1],'utf8'),pair.join(' != '));
}
console.log('V4896553 accueil render contract: OK');
