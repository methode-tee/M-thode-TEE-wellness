module.exports.config = {
  maxDuration: 60
};

function shortError(err) {
  const msg = String(err?.message || err || 'Erreur inconnue');
  return msg.split('\n').slice(0, 6).join('\n').slice(0, 1200);
}

function esc(v = '') {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function toBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get('content-type') || 'image/jpeg';
    const b64 = Buffer.from(buf).toString('base64');
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

function ingredientsList(items = []) {
  return items.map((item, i) => `
    <div class="list-row">
      <span class="num cream">${String(i + 1).padStart(2, '0')}</span>
      <p>${esc(item)}</p>
    </div>`).join('');
}

function stepsList(steps = []) {
  return steps.map((step, i) => `
    <div class="list-row">
      <span class="num green">${String(i + 1).padStart(2, '0')}</span>
      <p>${esc(step)}</p>
    </div>`).join('');
}

function buildHtml(recipe, imgData) {
  const title      = recipe.title || 'Recette Méthode Tee';
  const intention  = recipe.intention || recipe.mood || recipe.subtitle || '';
  const universe   = recipe.universe || recipe.category || 'Recette';
  const access     = recipe.access || 'Libre';
  const carnet     = String(recipe.carnetNumber || recipe.id || '001').padStart(3, '0');
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps      = Array.isArray(recipe.steps) ? recipe.steps : (Array.isArray(recipe.preparation) ? recipe.preparation : []);
  const note       = recipe.note || recipe.noteDeTee || recipe.coachNote || 'Savoure cette recette lentement, dans un moment calme. Elle est pensée comme un petit rituel de soin à intégrer à ton quotidien.';

  const imgTag = imgData ? `<img src="${imgData}" alt="" />` : '';
  const imgWide = imgData ? `<img class="wide-img" src="${imgData}" alt="" />` : '';

  // Split steps into chunks of 5 per page
  const stepChunks = [];
  for (let i = 0; i < steps.length; i += 5) stepChunks.push(steps.slice(i, i + 5));
  if (!stepChunks.length) stepChunks.push([]);

  const prepPages = stepChunks.map((chunk, pi) => `
  <section class="page">
    <div class="page-inner">
      <div class="gold-blob ${pi % 2 === 0 ? 'blob-tr' : 'blob-bl'}"></div>
      <div class="section-label">Préparation</div>
      <h2>${pi === 0 ? 'Le rituel' : 'La suite'}</h2>
      <div class="card">
        ${stepsList(chunk)}
        ${pi === stepChunks.length - 1 && note ? `<div class="note-inline"><div class="section-label" style="margin-bottom:4mm;">Note de Tee</div><p class="note-text">${esc(note)}</p></div>` : ''}
      </div>
    </div>
    <div class="footer"><span>${esc(title)}</span><span>Page ${pi + 3}</span></div>
  </section>`).join('');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Jost:wght@300;400;700&display=swap');
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #f4f1ea; font-family: 'Jost', sans-serif; }

.page {
  width: 210mm;
  height: 297mm;
  padding: 12mm;
  page-break-after: always;
  background: #f4f1ea;
  position: relative;
  overflow: hidden;
}
.page:last-child { page-break-after: auto; }
.page-inner {
  height: 100%;
  border: 1px solid rgba(184,146,74,.22);
  border-radius: 24px;
  padding: 14mm 14mm 10mm;
  background: #faf7f0;
  position: relative;
  overflow: hidden;
}

/* Gold blob decoration */
.gold-blob {
  position: absolute;
  width: 140mm;
  height: 140mm;
  border-radius: 50%;
  background: #bd9445;
  opacity: .88;
  z-index: 0;
}
.blob-tl { left: -50mm; top: -50mm; }
.blob-tr { right: -52mm; top: -45mm; }
.blob-bl { left: -52mm; bottom: -55mm; }
.blob-br { right: -50mm; bottom: -52mm; }

/* Green corner */
.green-corner {
  position: absolute;
  right: -28mm;
  bottom: -20mm;
  width: 110mm;
  height: 110mm;
  background: #173f35;
  transform: rotate(40deg);
  z-index: 0;
}

/* Typography */
.section-label {
  position: relative; z-index: 2;
  font-family: 'Jost', sans-serif;
  font-weight: 700;
  font-size: 8pt;
  letter-spacing: .32em;
  text-transform: uppercase;
  color: #b8924a;
  margin-bottom: 4mm;
}
h1 {
  position: relative; z-index: 2;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 38pt;
  line-height: .9;
  font-weight: 400;
  color: #1a1612;
  max-width: 148mm;
  margin: 0 0 3mm;
}
h1 em { color: #173f35; font-style: italic; }
h2 {
  position: relative; z-index: 2;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 34pt;
  font-weight: 400;
  color: #173f35;
  line-height: 1;
  margin-bottom: 8mm;
}

/* Cover specific */
.brand-name {
  position: relative; z-index: 2;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 24pt;
  color: #173f35;
  line-height: 1;
}
.brand-sub {
  position: relative; z-index: 2;
  font-family: 'Jost', sans-serif;
  font-weight: 300;
  font-size: 7pt;
  letter-spacing: .4em;
  text-transform: uppercase;
  color: #8c7561;
  margin-top: 2mm;
}
.badge {
  position: absolute; right: 14mm; top: 15mm; z-index: 3;
  border: 1px solid rgba(23,63,53,.2);
  border-radius: 999px;
  padding: 3.5mm 8mm;
  font-family: 'Jost', sans-serif;
  font-size: 7.5pt;
  letter-spacing: .2em;
  font-weight: 700;
  text-transform: uppercase;
  color: #173f35;
  background: rgba(255,255,255,.75);
}
.carnet-line {
  position: relative; z-index: 2;
  font-family: 'Jost', sans-serif;
  font-size: 7.5pt;
  letter-spacing: .3em;
  text-transform: uppercase;
  color: #8c7561;
  margin: 22mm 0 4mm;
}
.subtitle-italic {
  position: relative; z-index: 2;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 20pt;
  color: #173f35;
  line-height: 1.1;
  margin-top: 3mm;
}
.hero-wrap {
  position: relative; z-index: 2;
  height: 68mm;
  border-radius: 14px;
  overflow: hidden;
  margin: 8mm 0;
  border: 1px solid rgba(255,255,255,.3);
  box-shadow: 0 14px 36px rgba(0,0,0,.18);
  background: #e8e0d0;
}
.hero-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.meta-grid {
  position: relative; z-index: 2;
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 4mm;
  margin-bottom: 7mm;
}
.meta-pill {
  background: rgba(255,255,255,.8);
  border: 1px solid rgba(184,146,74,.2);
  border-radius: 12px;
  padding: 5mm 3mm;
  text-align: center;
}
.meta-pill strong {
  display: block;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 12pt;
  color: #173f35;
  font-weight: 400;
  line-height: 1.1;
}
.meta-pill small {
  display: block;
  font-family: 'Jost', sans-serif;
  font-size: 6.5pt;
  letter-spacing: .22em;
  text-transform: uppercase;
  font-weight: 700;
  color: #8c7561;
  margin-top: 2mm;
}
.quote-block {
  position: absolute;
  left: 14mm; right: 14mm; bottom: 14mm;
  z-index: 2;
  background: #173f35;
  border-radius: 14px;
  padding: 7mm 10mm;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 14pt;
  color: #faf7f0;
  line-height: 1.4;
}

/* Ingredients page */
.wide-img {
  position: relative; z-index: 2;
  width: 100%;
  height: 52mm;
  object-fit: cover;
  border-radius: 12px;
  margin: 3mm 0 7mm;
  display: block;
}
.card {
  position: relative; z-index: 2;
  background: rgba(255,255,255,.88);
  border: 1px solid rgba(23,63,53,.08);
  border-radius: 16px;
  padding: 9mm 11mm;
  box-shadow: 0 10px 30px rgba(23,63,53,.06);
}
.list-row {
  display: grid;
  grid-template-columns: 12mm 1fr;
  gap: 5mm;
  align-items: start;
  margin-bottom: 5.5mm;
  break-inside: avoid;
}
.list-row:last-child { margin-bottom: 0; }
.num {
  width: 9mm; height: 9mm;
  display: grid; place-items: center;
  border-radius: 999px;
  font-family: 'Jost', sans-serif;
  font-size: 7pt;
  font-weight: 800;
  margin-top: 1mm;
}
.num.cream { background: #e8ebe5; color: #173f35; }
.num.green { background: #173f35; color: #faf7f0; }
.list-row p {
  font-family: 'Jost', sans-serif;
  font-size: 11pt;
  line-height: 1.5;
  color: #201c18;
}

/* Note inline */
.note-inline {
  margin-top: 8mm;
  padding-top: 8mm;
  border-top: 1px solid rgba(23,63,53,.1);
}
.note-text {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 14pt;
  color: #6c5c52;
  line-height: 1.5;
}

/* Closing */
.closing-block {
  position: relative; z-index: 2;
  background: #173f35;
  border-radius: 18px;
  padding: 10mm 12mm;
  margin-top: auto;
  color: #faf7f0;
}
.closing-block .micro {
  font-family: 'Jost', sans-serif;
  font-size: 7.5pt;
  letter-spacing: .3em;
  text-transform: uppercase;
  color: #d7bd7a;
  margin-bottom: 4mm;
}
.closing-block h2 {
  color: #faf7f0;
  margin-bottom: 4mm;
}
.closing-block p {
  font-family: 'Jost', sans-serif;
  font-size: 10.5pt;
  line-height: 1.6;
  color: rgba(250,247,240,.78);
}

/* Footer */
.footer {
  position: absolute;
  left: 12mm; right: 12mm; bottom: 6mm;
  display: flex;
  justify-content: space-between;
  font-family: 'Jost', sans-serif;
  font-size: 7pt;
  color: #a09488;
  z-index: 5;
}
</style>
</head>
<body>

<!-- PAGE 1 : COVER -->
<section class="page">
  <div class="page-inner">
    <div class="gold-blob blob-tl"></div>
    <div class="green-corner"></div>
    <div class="brand-name">Teeyana</div>
    <div class="brand-sub">Nutrition · Plantes · Bien-être</div>
    <div class="badge">Recette privée</div>
    <div class="carnet-line">Carnet Signature N°${carnet} · Recette</div>
    <h1>${esc(title)}<em>${esc(intention)}</em></h1>
    ${imgData ? `<div class="hero-wrap">${imgTag}</div>` : '<div style="height:12mm"></div>'}
    <div class="meta-grid">
      <div class="meta-pill"><strong>${esc(universe)}</strong><small>Univers</small></div>
      <div class="meta-pill"><strong>${esc(intention || 'Rituel')}</strong><small>Intention</small></div>
      <div class="meta-pill"><strong>${esc(access)}</strong><small>Accès</small></div>
    </div>
    <div class="quote-block">"Une recette comme un rituel : simple, douce, précise, et pensée pour accompagner ton équilibre au quotidien."</div>
  </div>
  <div class="footer"><span>https://methodetee.app</span><span>Page 1</span></div>
</section>

<!-- PAGE 2 : INGRÉDIENTS -->
<section class="page">
  <div class="page-inner">
    <div class="gold-blob blob-tr"></div>
    <div class="section-label">Ingrédients</div>
    <h2>La sélection</h2>
    ${imgData ? imgWide : ''}
    <div class="card">${ingredientsList(ingredients)}</div>
  </div>
  <div class="footer"><span>${esc(title)}</span><span>Page 2</span></div>
</section>

<!-- PAGES PRÉPARATION -->
${prepPages}

<!-- PAGE FINALE -->
<section class="page">
  <div class="page-inner" style="display:flex;flex-direction:column;">
    <div class="gold-blob blob-br"></div>
    ${imgData ? `<div style="position:relative;z-index:2;height:55mm;border-radius:14px;overflow:hidden;margin-bottom:8mm;"><img src="${imgData}" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>` : ''}
    <div class="closing-block">
      <div class="micro">Carnet Signature N°${carnet}</div>
      <h2>Ta fiche est prête.</h2>
      <p>Merci d'avoir choisi Méthode Tee. Cette fiche fait désormais partie de ta bibliothèque privée.</p>
    </div>
  </div>
  <div class="footer"><span>PDF généré depuis ton espace privé · methodetee.app</span><span>Page ${stepChunks.length + 3}</span></div>
</section>

</body>
</html>`;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let browser;
  try {
    // Important for Vercel Node 22 + Sparticuz Chromium.
    // Put this BEFORE requiring chromium so the package extracts the right files.
    process.env.AWS_LAMBDA_JS_RUNTIME = process.env.AWS_LAMBDA_JS_RUNTIME || 'nodejs22.x';

    const path = require('path');
    const chromium = require('@sparticuz/chromium-min');
    const puppeteer = require('puppeteer-core');

    const recipe = req.body || {};

    // Convert image to base64 so Chromium can load it (no external requests in serverless)
    const imageUrl = recipe.image || recipe.imageUrl || recipe.image_url || '';
    const imgData = imageUrl ? await toBase64(imageUrl) : null;

    const html = buildHtml(recipe, imgData);

    const chromiumPack = process.env.CHROMIUM_PACK_URL || 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';
    const executablePath = await chromium.executablePath(chromiumPack);

    // Critical fix: Chromium extracts NSS/NSPR shared libraries beside /tmp/chromium.
    // Vercel does not always search that folder automatically, so libnss3.so is not found
    // unless we explicitly expose the folder through LD_LIBRARY_PATH.
    const chromiumDir = path.dirname(executablePath);
    process.env.LD_LIBRARY_PATH = [chromiumDir, '/tmp', process.env.LD_LIBRARY_PATH || '']
      .filter(Boolean)
      .join(':');

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 1 },
      executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 45000 });

    // Fonts/images are embedded; this small wait stabilizes the final paint.
    await new Promise(resolve => setTimeout(resolve, 800));

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });

    const slug = String(recipe.slug || recipe.id || 'recette-methodetee').replace(/[^a-z0-9-_]/gi, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Methode_Tee_${slug}.pdf"`);
    res.status(200).send(pdf);
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({
      error: 'PDF generation failed',
      detail: shortError(err)
    });
  } finally {
    if (browser) await browser.close();
  }
};
