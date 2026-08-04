# Patch V306 — Mon Équilibre complet + carnets PDF natifs

Base : `M-thode-TEE-wellness-main 304(4)`.

## Mon Équilibre Tee

- contrat quotidien complet : date, complétude, lecture partielle, statuts, entrées disponibles/manquantes, régularité terminée/total, priorité et actions ;
- historique hebdomadaire glissant sur 7 jours, chargé uniquement au clic ;
- une lecture groupée de `daily_activity` et `journal_entries` en parallèle ;
- cache quotidien et cache hebdomadaire de 5 minutes ;
- aucune nouvelle table Supabase et aucun SQL ;
- bouton Journal ouvrant directement le formulaire du jour ;
- pas de nouvelle lecture du journal après une action sans rapport avec le journal lorsque les données sont déjà en mémoire.

## Carnets recettes PDF

- le fichier PDF est téléchargé une seule fois par ouverture et réutilisé pour Enregistrer/Partager ;
- sur iPhone, Enregistrer ouvre la feuille native avec l’action « Enregistrer dans Fichiers » ;
- Partager transmet le véritable fichier PDF ;
- aucune URL Supabase n’est partagée en fallback ;
- fallback navigateur : téléchargement local du fichier.

## Sécurité

Aucune modification de StoreKit 2, Stripe, Product IDs, restauration d’achats, `user_protocols`, accès protocoles, déblocages quotidiens ou authentification.

## Supabase

Aucun SQL à exécuter.
