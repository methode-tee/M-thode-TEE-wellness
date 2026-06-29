const chromium = require('@sparticuz/chromium');
const playwright = require('playwright-core');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function listItems(items = []) {
  return items.map((item, index) => `
    <div class="line-item">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <p>${escapeHtml(item)}</p>
    </div>`).join('');
}

function stepsItems(steps = []) {
  return steps.map((step, index) => `
    <div class="step-item">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <p>${escapeHtml(step)}</p>
    </div>`).join('');
}

function buildHtml(recipe) {
  const title = recipe.title || 'Recette Méthode Tee';
  const image = recipe.image || recipe.imageUrl || '';
  const intention = recipe.intention || recipe.subtitle || '';
  const universe = recipe.universe || recipe.category || 'Recette';
  const access = recipe.access || 'Débloquée';
  const carnetNumber = String(recipe.carnetNumber || recipe.id || '001').padStart(3, '0');
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : (Array.isArray(recipe.preparation) ? recipe.preparation : []);
  const note = recipe.note || recipe.coachNote || recipe.noteDeTee || '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f7f2e8; color:#111; font-family: Inter, Arial, sans-serif; }
  .page { width:210mm; height:297mm; padding:14mm; page-break-after: always; background:#f7f2e8; position:relative; overflow:hidden; }
  .sheet { height:100%; border:1px solid rgba(190,154,80,.35); border-radius:26px; padding:14mm; position:relative; overflow:hidden; background:#fbf7ed; }
  .black { background:#050504; color:#f7f2e8; }
  .gold-circle { position:absolute; width:170mm; height:170mm; border-radius:50%; background:#bd9744; opacity:.95; }
  .gold-a { left:-55mm; top:-48mm; }
  .gold-b { right:-58mm; top:-40mm; }
  .gold-c { right:-65mm; bottom:-70mm; }
  .green-corner { position:absolute; right:-30mm; bottom:-18mm; width:125mm; height:125mm; background:#0d4b3f; transform:rotate(38deg); opacity:.9; }
  .brand { position:relative; z-index:2; color:#0d4b3f; font-family: Georgia, serif; font-style:italic; font-size:22pt; }
  .micro { position:relative; z-index:2; letter-spacing:4px; text-transform:uppercase; font-size:7pt; font-weight:700; color:#8b7564; margin-top:2mm; }
  .badge { position:absolute; right:14mm; top:15mm; z-index:2; border:1px solid rgba(13,75,63,.25); border-radius:999px; padding:4mm 8mm; font-size:8pt; letter-spacing:2px; font-weight:800; text-transform:uppercase; color:#0d4b3f; background:rgba(255,255,255,.7); }
  h1 { position:relative; z-index:2; font-family: Georgia, serif; font-size:42pt; line-height:.88; margin:34mm 0 3mm; max-width:150mm; }
  h1 em, .green { color:#0d4b3f; font-style:italic; }
  .subtitle { position:relative; z-index:2; color:#0d4b3f; font-family: Georgia, serif; font-style:italic; font-size:24pt; line-height:1; }
  .desc { position:relative; z-index:2; margin-top:8mm; color:#73695f; font-size:9pt; }
  .hero { position:relative; z-index:2; width:100%; height:72mm; object-fit:cover; border-radius:14px; margin-top:14mm; box-shadow:0 18px 45px rgba(0,0,0,.18); }
  .meta { position:relative; z-index:2; display:grid; grid-template-columns:1fr 1fr 1fr; gap:5mm; margin-top:9mm; }
  .pill { background:rgba(255,255,255,.76); border:1px solid rgba(13,75,63,.08); border-radius:10px; text-align:center; padding:8mm 2mm; color:#0d4b3f; font-family:Georgia,serif; font-size:12pt; }
  .pill small { display:block; margin-top:1mm; font-family:Inter,Arial,sans-serif; font-size:6pt; letter-spacing:2px; text-transform:uppercase; font-weight:800; color:#8b7564; }
  .quote { position:absolute; left:14mm; right:14mm; bottom:14mm; z-index:2; background:#0d4b3f; color:white; border-radius:12px; padding:8mm 10mm; font-family:Georgia,serif; font-style:italic; font-size:14pt; line-height:1.35; }
  .section-label { position:relative; z-index:2; text-transform:uppercase; letter-spacing:4px; font-weight:800; color:#bd9744; font-size:8pt; }
  h2 { position:relative; z-index:2; font-family:Georgia,serif; color:#0d4b3f; font-size:36pt; line-height:1; margin:7mm 0 10mm; }
  h2 em { font-style:italic; }
  .wide-img { position:relative; z-index:2; width:100%; height:46mm; object-fit:cover; border-radius:10px; margin:2mm 0 9mm; }
  .card { position:relative; z-index:2; background:rgba(255,255,255,.88); border-radius:14px; padding:10mm 13mm; box-shadow:0 12px 35px rgba(0,0,0,.10); }
  .line-item, .step-item { display:grid; grid-template-columns:14mm 1fr; gap:9mm; align-items:start; margin:6mm 0; }
  .line-item span, .step-item span { width:10mm; height:10mm; display:grid; place-items:center; border-radius:999px; background:#edf0e9; color:#0d4b3f; font-size:7pt; font-weight:800; }
  .step-item span { background:#0d4b3f; color:white; }
  .line-item p, .step-item p { margin:0; font-size:11pt; line-height:1.45; }
  .note { font-family:Georgia,serif; font-style:italic; color:#6c5c52; font-size:13pt; line-height:1.45; }
  .final { background:#0d4b3f; color:white; border-radius:18px; padding:17mm; margin-top:18mm; }
  .final .micro { color:#d7b76a; }
  .final h2 { color:white; margin-bottom:8mm; }
  .footer { position:absolute; left:14mm; right:14mm; bottom:8mm; display:flex; justify-content:space-between; font-size:7pt; color:#948a7e; }
</style>
</head>
<body>
  <section class="page"><div class="sheet">
    <div class="gold-circle gold-a"></div><div class="green-corner"></div>
    <div class="brand">Teeyana</div><div class="micro">Nutrition · Plantes · Bien-être</div><div class="badge">Recette privée</div>
    <div class="micro" style="margin-top:22mm;">Carnet signature n°${carnetNumber} · ${escapeHtml(universe)}</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="subtitle">${escapeHtml(intention)}</div>
    <div class="desc">Apaisantes · réconfortantes · faciles à réaliser</div>
    ${image ? `<img class="hero" src="${escapeHtml(image)}" />` : ''}
    <div class="meta"><div class="pill">${escapeHtml(universe)}<small>Univers</small></div><div class="pill">${escapeHtml(intention)}<small>Intention</small></div><div class="pill">${escapeHtml(access)}<small>Accès</small></div></div>
    <div class="quote">“Une recette comme un rituel : simple, douce, précise, et pensée pour accompagner ton équilibre au quotidien.”</div>
  </div><div class="footer"><span>https://methodetee.app</span><span>Page 1</span></div></section>

  <section class="page black"><div class="sheet black">
    <div class="gold-circle gold-b"></div>
    <div class="section-label">Ingrédients</div><h2>La sélection</h2>
    ${image ? `<img class="wide-img" src="${escapeHtml(image)}" />` : ''}
    <div class="card">${listItems(ingredients)}</div>
  </div><div class="footer"><span>${escapeHtml(title)}</span><span>Page 2</span></div></section>

  <section class="page black"><div class="sheet black">
    <div class="gold-circle gold-c"></div>
    <div class="section-label">Préparation</div><h2>Le rituel</h2>
    <div class="card">${stepsItems(steps.slice(0, 4))}</div>
    ${steps.length > 4 ? `<div class="card" style="margin-top:10mm">${stepsItems(steps.slice(4))}</div>` : ''}
  </div><div class="footer"><span>${escapeHtml(title)}</span><span>Page 3</span></div></section>

  <section class="page"><div class="sheet">
    <div class="section-label">Note de Tee</div><h2>À garder près de toi</h2>
    <div class="card note">${escapeHtml(note || 'Savoure cette recette lentement, dans un moment calme. Elle est pensée comme un petit rituel de soin à intégrer à ton quotidien.')}</div>
    <div class="final"><div class="micro">Carnet signature n°${carnetNumber}</div><h2>Ta fiche est prête.</h2><p>Merci d’avoir choisi Méthode Tee. Cette fiche fait désormais partie de ta bibliothèque privée.</p></div>
  </div><div class="footer"><span>PDF généré depuis ton espace privé</span><span>Page 4</span></div></section>
</body></html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let browser;
  try {
    const recipe = req.body || {};
    browser = await playwright.chromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(buildHtml(recipe), { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${String(recipe.slug || 'recette-methodetee').replace(/[^a-z0-9-_]/gi, '-')}.pdf"`);
    res.status(200).send(pdf);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'PDF generation failed', detail: String(error?.message || error) });
  } finally {
    if (browser) await browser.close();
  }
};
