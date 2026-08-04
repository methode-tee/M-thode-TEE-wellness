# PATCH V313 — Mon Équilibre personnalisé

Base : M-thode-TEE-wellness-develop 9(1)

## Ajouts
- lecture quotidienne personnalisée à partir des repères déjà renseignés ;
- facteurs qui influencent le plus la journée ;
- phrase Tee quotidienne ;
- projection douce pour le lendemain ;
- lecture adaptée au protocole actif ;
- comparaison avec la moyenne personnelle des 7 derniers jours ;
- tendances entre les 7 derniers jours et les 7 jours précédents ;
- score de constance hebdomadaire ;
- petites victoires ;
- observations de rythme par jour de la semaine lorsque suffisamment de données existent ;
- empreinte hebdomadaire enrichie.

## Performance
- aucune requête supplémentaire au démarrage ;
- aucune requête supplémentaire sur l’accueil ou le Profil ;
- l’historique étendu est chargé uniquement au clic sur « Voir mon empreinte de la semaine » ;
- deux requêtes Supabase groupées et parallèles, limitées aux 28 derniers jours ;
- cache local de 10 minutes ;
- aucun polling, setInterval ou MutationObserver.

## Fichiers modifiés
- scripts/tee-balance.js
- www/scripts/tee-balance.js
- styles/style.css
- www/styles/style.css

## Sécurité fonctionnelle
Aucun fichier StoreKit 2, Stripe, restauration d’achats, Product ID, user_protocols,
authentification, déblocage quotidien, protocole ou recette n’est modifié.

## Version
Aucun fichier de version n’est modifié : la version 1.0.1 reste inchangée.

## Supabase
Aucun SQL à exécuter.
