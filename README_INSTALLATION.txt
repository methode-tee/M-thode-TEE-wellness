À uploader :
1) api/generate-recipe-pdf.js -> remplace le fichier existant dans /api/
2) package.json -> remplace le package.json à la racine

Puis Commit changes, attendre Vercel Ready, retester le bouton Partager / PDF.

Ce patch remplace Playwright par Puppeteer Core, plus stable avec @sparticuz/chromium sur Vercel.
