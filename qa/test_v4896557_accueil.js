const fs=require('fs');
const js=fs.readFileSync('scripts/home-smart-cards.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const checks=[
 ['universe preserved',js.includes('window.mtOpenHomeUniverse=async function')],
 ['parcours preview',js.includes('window.mtOpenHomeParcoursPreview=async function')],
 ['resources preview',js.includes('window.mtOpenHomeResourcesPreview=async function')],
 ['full parcours',js.includes('Voir tous mes parcours')],
 ['full library',js.includes('Ouvrir ma bibliothèque complète')],
 ['no member pharmaco duplicate',!js.includes("homeUniverseAction('leaf','Explorer la pharmacopée','Découvre les protocoles guidés autour des plantes.','pharmaco')" )],
 ['no payment code',!js.includes('startPaymentLink')&&!js.includes('stripe')&&!js.includes('checkout')],
 ['cache',html.includes('v4896557-parcours-ressources-preview-r1')]
];
for(const [name,ok] of checks){console.log(ok?'OK':'FAIL',name);if(!ok)process.exitCode=1;}
