# Patch PDF Vercel Chromium V1

À copier à la racine du projet :
- package.json
- vercel.json
- api/generate-recipe-pdf.js

Ensuite commit/push sur GitHub. Vercel redéploiera automatiquement.

Route créée :
POST /api/generate-recipe-pdf

Body JSON attendu :
{
  "title": "Pastilles miel citron gingembre",
  "image": "https://...",
  "intention": "Gorge apaisée · Immunité · Hiver",
  "universe": "Recette",
  "access": "Libre",
  "ingredients": ["100 g de miel"],
  "steps": ["Cuire le miel"],
  "note": "Note de Tee...",
  "carnetNumber": "001"
}
