# Patch V379 — Profils culinaires et intentions

Ce patch remplace la logique de conseil générique par une lecture en trois niveaux :

1. identité et famille culinaire du plat ;
2. composants réellement décrits ou confirmés ;
3. intention choisie dans Adapter mon repas.

## Familles couvertes

- bols et petits-déjeuners sucrés ;
- desserts et préparations sucrées ;
- bases féculentes à accompagner ;
- soupes et bouillons ;
- plats en sauce ;
- nouilles et pâtes composées ;
- bouchées, pâtes et pains garnis ;
- galettes servies sucrées, salées ou nature ;
- préparations frites ;
- protéines principales ;
- plats composés complets ou variables ;
- burgers et sandwichs garnis.

Les 65 entrées initiales du dictionnaire V376 reçoivent une famille explicite ou une famille calculée. Les futures entrées de l’admin disposent des mêmes familles.

## Intentions

Chaque plat produit une orientation distincte pour :

- Équilibre ;
- Digestion ;
- Énergie ;
- Nourrir & construire ;
- Retrouver de la légèreté ;
- Sans intention particulière.

Les conseils conservent l’identité du plat et n’inventent jamais un composant facultatif. Lorsqu’une variante change réellement l’orientation, une question courte est posée avant le résultat.

## Références de données

- ANSES CIQUAL : https://ciqual.anses.fr/
- FAO/INFOODS Food Composition Table for Western Africa 2019 : https://www.fao.org/infoods/infoods/tables-and-databases/faoinfoods-databases/en/
- OMS — alimentation saine : https://www.who.int/news-room/fact-sheets/detail/healthy-diet
- Ministère japonais de l’Agriculture — Washoku et variantes de nouilles : https://www.maff.go.jp/j/shokusan/gaisyoku/pamphlet/pdf/washoku_english.pdf

## Installation

1. Installer d’abord V376 et V377 si elles ne sont pas déjà présentes.
2. Exécuter `supabase/V379_PROFILS_CULINAIRES_ET_INTENTIONS.sql`.
3. Téléverser les fichiers du patch en conservant leurs dossiers.

V378 est inclus dans le JavaScript V379.
