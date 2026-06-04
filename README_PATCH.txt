PATCH V18.2 — Redirection après paiement + prix masqué si débloqué

Fichiers modifiés uniquement :
1) scripts/app.js
   - Quand un protocole est déjà débloqué, le prix n'est plus affiché sur la carte.
   - Rien n'est changé sur Stripe/Supabase/navigation.

2) supabase/functions/create-checkout-session/index.ts
   - Après paiement d'un protocole, Stripe redirige vers protocol.html?id=<protocol_id>&payment=success
   - Après paiement accès app, Stripe redirige toujours vers dashboard.html?payment=success

Instructions :
- Sur GitHub : remplace uniquement scripts/app.js par celui du dossier patch.
- Sur Supabase Edge Function : remplace uniquement supabase/functions/create-checkout-session/index.ts puis redeploie la fonction.
- Vérifie/ajoute aussi le secret APP_URL = https://methodetee.app dans Supabase Function secrets.
