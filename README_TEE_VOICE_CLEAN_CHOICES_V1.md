# TEE VOICE — CLEAN CHOICES V1

Base : `M-thode-TEE-wellness-main 500 6.zip`

## Corrige
- retire les mentions techniques `ANSES - Table Ciqual 2025` / `source` dans les propositions Voice ;
- affiche seulement le nom de l’aliment, et éventuellement le pays s’il existe réellement ;
- corrige `œuf / oeuf` et `Œufs / oeufs` pour éviter un faux « Lequel ? » ;
- met `Bibliothèque TEE` sur sa propre ligne au lieu de le coller au nom.

## Inchangé
- Voice continue d’utiliser `MTFood.searchFoods()` comme Ma journée alimentaire et Adapter ;
- quantités naturelles conservées ;
- aucun SQL ;
- Photo Vision reste désactivé.

## Après upload
```bash
git pull --rebase origin main
npx cap sync ios
npx cap open ios
```
