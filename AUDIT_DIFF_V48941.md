# Audit V489.4.1

## Corrections structurelles par rapport à V489.4

1. Nouvelle source de vérité relationnelle :
   - `mt_curated_meals_v2`
   - `mt_curated_meal_components_v2`
   - `mt_curated_meal_sources_v2`

2. Chaque composant publié porte un `ciqual_code` matérialisé.
   Le frontend ne fait plus de fuzzy matching libre à chaque génération.

3. Publication conservatrice :
   - score de résolution élevé ;
   - structure repas complète ;
   - sources valides ;
   - niveau 2 non auto-publié ;
   - doublons whole-dish strict désactivés.

4. Suppression du fallback d'assemblage libre.
   Le frontend n'appelle plus `buildDynamicCiqualCandidatesV4891()`.

5. Le fallback acceptable est :
   - recettes TEE existantes ;
   - whole-dishes stricts existants ;
   - plats composés CIQUAL existants et chiffrables.

6. Corrections éditoriales incluses :
   - haricots verts = légume dans Gado-gado / salade niçoise ;
   - paneer = `dairy_protein` uniquement en contexte éditorial ;
   - taboulé : persil replacé en assaisonnement, tomate comme légume ;
   - ceviche : oignon retiré comme « légume principal », ajout d'une salade explicite ;
   - moussaka : variante bœuf explicite, plus de « bœuf ou agneau » ambigu ;
   - doublons whole-dish connus désactivés ;
   - plats africains spécifiques maintenus au niveau 2 par défaut.

## État éditorial du fichier livré

- 300 repas chargés ;
- 240 assiettes TEE whitelistées ;
- 258 niveau 0 ;
- 28 niveau 1 ;
- 14 niveau 2 ;
- 9 doublons whole-dish strict désactivés.

Le nombre réellement `published` dépend du contenu vivant de `ciqual_foods` et de la qualité de résolution dans Supabase au moment de la migration.
