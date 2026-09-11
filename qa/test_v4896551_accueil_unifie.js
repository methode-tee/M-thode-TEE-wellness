const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const assert = (ok,msg)=>{ if(!ok){ console.error('FAIL:',msg); process.exitCode=1; } else console.log('OK:',msg); };

const index=read('index.html');
const smart=read('scripts/home-smart-cards.js');
const luxe=read('scripts/v14-luxe.js');
const journey=read('scripts/community-journey.js');
const app=read('scripts/app.js');
const css=read('styles/style.css');

['Mon alimentation','Mon équilibre','Mes parcours','Mes ressources'].forEach(label=>assert(index.includes(label),`index contient ${label}`));
assert(smart.includes('mtRenderHomeUniverseCards'), 'rendu des 4 univers exporté');
assert(luxe.includes('mtRenderHomeUniverseCards(r,m)'), 'même architecture visiteurs/membres');
assert(smart.includes("tee-next.html?tool=planner"), 'Planifier ma semaine reste relié à Mon alimentation');
assert(smart.includes('mtOpenHomeBalance'), 'Mon équilibre se charge à la demande');
assert(smart.includes("mtOpenSavedCollection?.('favorites')"), 'Mes favoris relié à Mes ressources');
assert(smart.includes("mtOpenMyRoutines?.('profile')"), 'Mes routines relié à Mes ressources');

// Notre journée ensemble : le gabarit éditorial historique reste intact.
assert(journey.includes('<div class="club-v18-grid">'), 'grille éditoriale de Notre journée ensemble conservée');
assert(journey.includes('<div class="journey-home-progress"'), 'progression communautaire conservée');
assert(journey.includes("return '<button type=\"button\">+ Eau</button><button type=\"button\">Mood calme</button><button type=\"button\">Note gratitude</button>';"), 'actions historiques du bloc conservées');
assert(!journey.includes('journey-home-empty'), 'aucun état compact ajouté à Notre journée ensemble');
assert(!journey.includes('is-empty-day'), 'aucune classe compacte de journée vide');
assert(journey.includes("Ton matin, à ton rythme"), 'wording éditorial matin vide présent');
assert(journey.includes("Ton déjeuner, à ta façon"), 'wording éditorial déjeuner vide présent');
assert(journey.includes("Un temps pour toi"), 'wording éditorial après-midi vide présent');
assert(journey.includes("Ta soirée, comme tu l’aimes"), 'wording éditorial soir vide présent');
assert(journey.includes("emptyDay?'À ton rythme':'À venir'"), 'statut vide À ton rythme présent');
assert(journey.includes('publishHomeJourneyHint'), 'prochain rendez-vous peut remonter vers Aujourd’hui');

assert(app.includes('<h2>À découvrir</h2>'), 'Feed renommé À découvrir');
assert(css.includes('mt-home-universe-rail'), 'mise en page 4 univers présente');
assert(!css.includes('.community-journey-home.is-empty-day'), 'aucun style compact du bloc collectif');

for(const rel of ['index.html','scripts/home-smart-cards.js','scripts/v14-luxe.js','scripts/community-journey.js','scripts/app.js','styles/style.css']){
  const a=read(rel), b=read('www/'+rel);
  assert(a===b,`${rel} synchronisé avec www/`);
}

if(process.exitCode) process.exit(process.exitCode);
