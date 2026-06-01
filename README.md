# Méthode Tee V5 — Cœur Vital

Cette version ajoute la base sérieuse pour :

1. Comptes utilisateurs Supabase
2. Connexion / inscription / sessions
3. Profils utilisateurs
4. Onboarding intelligent
5. Dashboard personnalisé
6. Catalogue de guides payants
7. Achats sauvegardés dans Supabase
8. Upload PDF côté admin
9. Stockage PDF privé Supabase
10. Préparation Stripe via fonctions serverless

## Important

Cette V5 est prête à être reliée à un vrai projet Supabase + Stripe, mais les clés doivent être ajoutées dans `config.js`.

## Fichiers principaux

- `landing.html` : page vitrine
- `auth.html` : inscription / connexion
- `index.html` : dashboard intelligent
- `onboarding.html` : questionnaire utilisateur
- `catalogue.html` : catalogue des guides
- `guide.html` : page détail / achat / accès PDF
- `admin.html` : espace admin pour créer un guide + uploader PDF
- `profile.html` : profil utilisateur + achats
- `style.css` : design global
- `data.js` : guides de départ
- `config.js` : configuration Supabase / Stripe à remplir
- `supabaseClient.js` : client Supabase + fonctions auth / data
- `app.js` : logique app
- `schema.sql` : tables Supabase + RLS
- `functions/create-checkout-session.js` : fonction Stripe à brancher
- `functions/stripe-webhook.js` : webhook Stripe pour valider les achats

## À faire pour mise en production

1. Créer un projet Supabase
2. Copier `schema.sql` dans Supabase SQL Editor
3. Créer un bucket Storage privé nommé `guide-pdfs`
4. Remplir `config.js`
5. Déployer les fonctions Stripe sur Netlify/Vercel
6. Ajouter tes vrais produits Stripe
7. Mettre ton domaine final

## Mode démo

Si Supabase n'est pas configuré, l'app fonctionne en mode démo avec localStorage pour ne pas bloquer l'aperçu.
