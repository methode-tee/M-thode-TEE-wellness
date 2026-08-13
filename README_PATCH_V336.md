# PATCH V336 — Carnet : clavier iOS + Journal/Trackers sans redirection

Base : ZIP 319(1) fourni par l'utilisatrice.

## 1. Clavier iPhone/Safari
- La navbar Carnet est masquée pendant la saisie texte sur toutes les pages alimentaires.
- Suppression du `scrollIntoView(... block:center)` qui créait le grand espace vide.
- Aucun changement global de viewport/AppHeight.
- Versions `food.css` / `food-core.js` passées à `v336-keyboard` pour éviter que Safari réutilise l'ancien cache.

## 2. Journal privé depuis Carnet
- Plus de redirection vers `dashboard.html` / Profil.
- `library.html` charge le moteur `journal.js` existant.
- Le Journal s'ouvre directement en sheet au-dessus de Carnet.

## 3. Trackers & checklists depuis Carnet
- Plus de redirection vers Profil.
- Le moteur Mon parcours existant s'ouvre directement en overlay au-dessus de Carnet.

## Inchangé
- StoreKit / IAP / Stripe
- achats et restaurations
- Supabase achats
- protocoles et déblocages
- CIQUAL et calculs nutritionnels
- prewarm.js / service worker
