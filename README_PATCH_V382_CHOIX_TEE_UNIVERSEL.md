# Patch V382 — Choix de Tee universel

Ce patch cumulatif remplace le patch V381 non installé.

## Fonctionnement

- conserve les 115 entrées actuellement présentes dans `food_dictionary` ;
- connecte automatiquement les plats composés de la table CIQUAL au dictionnaire ;
- reconnaît les variantes sans compter plusieurs résultats CIQUAL comme plusieurs ingrédients ;
- demande une précision lorsque la recette d'un plat peut varier ;
- donne dans « Le choix de Tee » un aliment précis adapté à l'intention ;
- n'impose aucun ajout lorsque le plat est déjà cohérent ;
- conserve les variantes culturelles et leurs accompagnements ;
- corrige notamment les lectures du muesli, des salades, du ndolé, du yassa, du cassoulet, du couscous et des nems.

## Installation

1. Remplacer les fichiers du patch en conservant leurs dossiers.
2. Exécuter `supabase/V382_CONNEXION_PLATS_COMPOSES_CIQUAL.sql` dans l'éditeur SQL Supabase.
3. Vérifier que la requête de contrôle finale renvoie des plats CIQUAL connectés.

La migration est idempotente : elle peut être relancée sans créer de doublons.

## Important

CIQUAL décrit des aliments et des plats types, mais ne permet pas de deviner avec certitude la recette réellement servie. Les composants facultatifs ne sont donc jamais considérés comme présents sans confirmation de la personne.
