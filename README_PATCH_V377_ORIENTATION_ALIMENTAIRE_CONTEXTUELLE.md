# MÉTHODE TEE — PATCH V377
## Adapter mon repas · orientation contextuelle

Base : `M-thode-TEE-wellness-main 354.zip`

## Installation

1. Exécuter `supabase/V377_ORIENTATION_ALIMENTAIRE_CONTEXTUELLE.sql`.
2. Uploader ensuite les fichiers du patch en conservant leurs dossiers.

## Corrections

- Le profil `sweet_breakfast` fonctionne même sans `type=breakfast` dans l’URL.
- « Muesli vanille » ne produit plus « Ne change presque rien » puis une signature générique conseillant œuf, poulet ou poisson.
- La recommandation et « Le choix de Tee » suivent désormais la même décision centrale.
- Les aliments structurés utilisent leurs totaux réels de protéines et fibres lorsqu’ils sont disponibles.

## Questions intelligentes

Une seule question apparaît uniquement lorsque la réponse change réellement le conseil :

- bol sucré : lait/skyr/yaourt, soja protéiné, fruit, oléagineux ou mangé seul ;
- base féculente culturelle : protéine, légumineuses, sauce/légumes, sauce riche ou rien ;
- plat composé variable / soupe : protéine, légumes, féculent, sauce riche ou composition inconnue.

Le texte de l’utilisateur n’est jamais modifié et aucun composant facultatif n’est inventé.

## Familles de conseils

- `sweet_bowl`
- `starch_side`
- `soup`
- `variable_composite`
- `general`

L’admin permet de choisir cette famille pour tout futur plat ajouté au dictionnaire, sans nouvelle version iOS.

## Conservé

- design général et cartes existantes ;
- photos, objectifs et décisions adoptées ;
- calculs nutritionnels actuels ;
- V373 à V376 ;
- aucune nouvelle lecture globale, aucun Realtime.
