# PATCH V437 — Premium intégré · connexions globales · egress prudent

Base : **M-thode-TEE-wellness-main 391(3).zip**

## Correction visuelle principale
- Le bloc **Ajouter des aliments** conserve la hiérarchie premium déjà présente : **la recherche reste en premier et inchangée**.
- Le scan code-barres devient une **action secondaire discrète** sous le champ de recherche : même carte, mêmes rayons, mêmes couleurs, aucune grosse CTA verte ajoutée.
- Aucun libellé technique de base alimentaire n'est montré dans l'interface. La base nutritionnelle reste une infrastructure interne.
- Les messages de scan utilisent un vocabulaire utilisateur : « produit », « repères nutritionnels », « portion ».
- Les raccourcis repas n'affichent plus de jargon Supabase.
- Les décorations actives concernées utilisent **✦** et non des losanges.

## Contenu cumulatif conservé
Ce patch reprend les briques V434–V436 : scan produit, HealthKit enrichi, Stress & régulation, Mes tendances, tendances Cycle, tendance corporelle lissée, récupération par baseline personnelle, jeûne, habitudes, périménopause, liens temporels Carnet/reflux et connexions Mon Équilibre/calendrier.

## Cached egress
- aucune nouvelle table ni migration SQL ;
- aucun miroir du catalogue produits dans Supabase ;
- cache produit local 7 jours, borné à 40 produits ;
- Mes tendances : lecture uniquement à l'ouverture volontaire, bornée, avec cache ;
- aucun polling ajouté ;
- photos Peau restent locales ;
- HealthKit reste lecture seule et ne synchronise pas l'historique brut vers Supabase.

## Vérifications effectuées
- syntaxe JS des fichiers principaux modifiés : OK ;
- parité root/www des fichiers web du patch : contrôlée ;
- recherche alimentaire placée avant le scan : OK ;
- absence de « CIQUAL » dans le rendu ajouté V437 : OK ;
- aucun ◆ / ◇ dans les fichiers applicatifs actifs corrigés par ce patch ;
- capacité caméra iOS déjà présente ; scanner natif inclus dans le target iOS.

## SQL
**Aucun SQL à exécuter.**
