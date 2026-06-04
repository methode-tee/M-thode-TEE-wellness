MÉTHODE TEE V19.4 — PWA PUSH SAFE

À uploader/remplacer côté GitHub :
- protocol-journey.html
- manifest.json
- sw.js
- scripts/protocol-journey.js
- scripts/pwa-push.js
- styles/journey.css

À lancer dans Supabase SQL Editor :
- supabase/SUPABASE_SQL_V19_4_PWA_PUSH.sql

Important :
Pour que les vraies notifications push partent, il faut créer des clés VAPID :
npx web-push generate-vapid-keys

Puis ajouter la clé publique dans config.js :
VAPID_PUBLIC_KEY: "TA_CLE_PUBLIC_VAPID",

Et mettre les secrets Supabase :
supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:hello@methodetee.app" SUPABASE_SERVICE_ROLE_KEY="..."

Puis déployer la fonction :
supabase functions deploy send-push-notifications

Sans clé VAPID, le bouton sera visible mais dira que les rappels seront bientôt prêts.
