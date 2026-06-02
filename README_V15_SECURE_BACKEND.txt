MÉTHODE TEE — V15 SECURE BACKEND SUPABASE EDGE

Cette version ajoute ce que tu as demandé :

- vrai backend privé via Supabase Edge Functions
- Stripe Checkout côté serveur
- webhooks Stripe
- déblocage automatique après paiement
- rôles serveur/service role uniquement côté backend
- admin séparé par Supabase Auth/RLS
- JWT côté fonctions
- rate limiting basique
- anti abuse via logs sécurité
- storage privé pour fichiers de protocoles
- URLs signées temporaires
- logs sécurité
- SQL de durcissement

Fichiers importants :
- supabase/functions/create-checkout-session/index.ts
- supabase/functions/stripe-webhook/index.ts
- supabase/functions/create-signed-url/index.ts
- supabase/functions/admin-check/index.ts
- supabase/SUPABASE_SQL_V15_SECURE_BACKEND.sql
- docs/DEPLOIEMENT_V15_BACKEND_SECURISÉ.md

À noter :
Cette V15 ne sera pleinement active qu’après déploiement des Edge Functions et configuration des secrets Stripe/Supabase.
