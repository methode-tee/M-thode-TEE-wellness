# V233 — Apple External Purchase Server API

Base utilisée : projet complet fourni + webhook protocoles externe `stripe-webhook(16).zip`.

Ce patch conserve le déblocage existant et ajoute : stockage/décodage des jetons Apple, association de l'intention à Stripe, mise en file des achats et remboursements, et envoi serveur vers Apple avec reprise sur erreur.

Secrets requis dans Supabase :
- APPLE_IAP_ISSUER_ID
- APPLE_IAP_KEY_ID
- APPLE_IAP_PRIVATE_KEY
- APPLE_BUNDLE_ID=com.methodetee.app
- APPLE_TAX_COUNTRY=FRA
- APPLE_REPORT_CRON_SECRET

Le fichier `.p8` et toutes les valeurs de secrets ne doivent jamais être mis sur GitHub.
