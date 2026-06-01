MÉTHODE TEE V10 — GITHUB PAGES ONLY + STRIPE PAYMENT LINKS

Cette version ne dépend PAS de Netlify.
Elle est prévue pour GitHub Pages + Supabase + Stripe Payment Links.

Fonctionnement paiement :
1. Tu crées un Stripe Payment Link pour chaque protocole.
2. Tu colles le lien dans config.js, dans PAYMENT_LINKS.
3. Le client clique sur “Débloquer ce protocole”.
4. Il est envoyé sur Stripe.
5. Après paiement, tu débloques manuellement le protocole dans Supabase :
   table user_protocols → ajouter user_id + protocol_id + status active.

Avantages :
- pas de Netlify
- pas de crédits Netlify
- pas de backend payant
- lancement simple
- tu gardes GitHub Pages

Limite :
- pas de déblocage automatique après paiement.
- le déblocage est manuel au début.

À faire :
1. Upload tout le ZIP à la racine GitHub.
2. Supabase > SQL Editor > coller le SQL du fichier supabase/SUPABASE_SQL_V10_GITHUB_PAGES.sql
3. Configurer tes liens Stripe dans config.js.
4. Activer GitHub Pages.

IMPORTANT :
Les contenus des protocoles sont uploadés par toi dans l’admin.
Aucune IA ne génère les protocoles à ta place.
