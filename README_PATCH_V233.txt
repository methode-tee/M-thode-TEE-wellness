MÉTHODE TEE — V233 APPLE EXTERNAL PURCHASE SERVER REPORTING

PRÉREQUIS
- Appliquer le patch V232 (récupération ACQUISITION + SERVICES).
- Exécuter supabase/V233_apple_external_purchase_reporting.sql.
- Créer une clé In-App Purchase dans App Store Connect > Users and Access > Integrations > In-App Purchase.

SECRETS SUPABASE À AJOUTER
APPLE_IAP_ISSUER_ID=<Issuer ID Apple>
APPLE_IAP_KEY_ID=<Key ID Apple>
APPLE_IAP_PRIVATE_KEY=<contenu intégral du fichier .p8>
APPLE_BUNDLE_ID=com.methodetee.app
APPLE_REPORT_CRON_SECRET=<long secret aléatoire>
APPLE_TAX_COUNTRY=FRA

DÉPLOIEMENT
npx supabase functions deploy store-external-purchase-tokens
npx supabase functions deploy report-apple-external-purchases --no-verify-jwt
npx supabase functions deploy create-checkout-session
npx supabase functions deploy create-recipe-checkout-session
npx supabase functions deploy stripe-webhook --no-verify-jwt
npx supabase functions deploy stripe-webhook-recipes --no-verify-jwt

ÉVÉNEMENTS STRIPE À ACTIVER SUR LES WEBHOOKS
- checkout.session.completed
- checkout.session.expired
- charge.refunded

EXÉCUTION DU WORKER
Le worker doit être appelé périodiquement en POST avec l'en-tête :
x-cron-secret: valeur de APPLE_REPORT_CRON_SECRET

URL :
https://tyuvlmmmyygqqhuetwoe.supabase.co/functions/v1/report-apple-external-purchases

Exemple manuel :
curl -X POST \
  -H "x-cron-secret: TON_SECRET" \
  https://tyuvlmmmyygqqhuetwoe.supabase.co/functions/v1/report-apple-external-purchases

COMPORTEMENT
- Achat réussi : transaction déclarée une seule fois avec le jeton SERVICES (ou ACQUISITION en repli).
- ACQUISITION restant : NO_LINE_ITEM lorsque SERVICES porte la transaction.
- Checkout expiré / jeton expiré sans achat : NO_LINE_ITEM.
- Jeton rafraîchi de la même période : DUPLICATE_TOKEN.
- Remboursement Stripe : REFUND référençant la ligne BUY initiale.
- Sandbox Apple : détection automatique via externalPurchaseId commençant par SANDBOX_.
- Les erreurs Apple sont conservées et réessayées avec attente progressive.

IMPORTANT
Le reporting Apple est séparé du déblocage : une panne Apple ne bloque jamais l'accès payé.
Le fichier .p8 ne doit jamais être ajouté dans GitHub ou dans l'application.
