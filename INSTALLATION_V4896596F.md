# V4896596F — V exacts uniquement

Ce correctif retire complètement l'héritage de groupes V par `profile_code`.

## À faire

Dans Supabase SQL Editor, exécuter **un seul fichier** :

`supabase/00_FIX_V4896596F_EXACT_V_ONLY.sql`

Puis envoyer le JSON `V4896596F_AUDIT` et la petite liste de repères affichée ensuite.

## Ce que cette version garantit

- aucun `V_MAIN`, `V_COMP` ou `V_KNOW` n'est attribué à un aliment juste parce qu'il partage un profil générique ;
- `V_MAIN` vient uniquement d'un composant exact CIQUAL résolu dans le catalogue culinaire TEE ;
- `V_KNOW` vient uniquement d'un `exact_profile_key` déjà documenté ;
- les groupes `compatibility` génériques sont désactivés pour Adapter mon repas ;
- si aucun V exact commun n'existe, TEE n'invente aucun assemblage.

## Important

Cette version privilégie la justesse à la couverture : un aliment non encore documenté dans un V exact peut avoir `v_count = 0`.
C'est volontaire. La couverture complète du catalogue doit ensuite être enrichie avec de vrais V documentés, pas avec un héritage générique.

Les fichiers web inclus sont les fichiers V-engine-only déjà préparés. Ne les remplace qu'après validation de l'audit si ce n'est pas déjà fait.
