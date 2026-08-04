PATCH V309 — MON ÉQUILIBRE / PRÉPARATION DU CORPS

Base : M-thode-TEE-wellness-develop 3.zip

Ajouts :
- état général du jour : journée active, intensité modérée ou priorité récupération ;
- lecture fondée uniquement sur les données renseignées dans Méthode Tee ;
- explication des repères : sommeil, hydratation, énergie, stress, routine et missions ;
- trois conseils quotidiens générés localement ;
- état de découverte conservé sans faux score négatif ;
- empreinte hebdomadaire existante conservée ;
- aucun nouveau chargement au démarrage ;
- aucune nouvelle requête Supabase pour la lecture quotidienne ;
- StoreKit, Stripe, achats, restaurations, accès et protocoles non modifiés.

Fichiers à remplacer :
- scripts/tee-balance.js
- styles/style.css
- www/scripts/tee-balance.js
- www/styles/style.css

Aucun SQL Supabase à exécuter.
