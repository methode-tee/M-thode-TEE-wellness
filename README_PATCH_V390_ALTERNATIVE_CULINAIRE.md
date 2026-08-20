# Patch V390 — ajustement ou alternative culinaire

Base : ZIP 358. Ce patch cumulatif remplace les patchs V387, V388 et V389.

## Résultat

- Une seule priorité nutritionnelle est affichée lorsqu'au moins 5 repas calculables sont répartis sur 3 jours.
- Tee propose deux manières de répondre à cette priorité : ajuster un repas habituel ou choisir une autre préparation précise pour varier.
- L'alternative tient compte des plats, ingrédients, familles culinaires et pays récemment reconnus.
- Une préparation déjà repérée récemment est évitée lorsqu'une autre option cohérente est disponible.
- Les propositions distinguent notamment les bols sucrés, cuisines d'Afrique subsaharienne, du Maghreb et d'Asie, soupes, nouilles, fritures et plats complets.
- Les ingrédients seulement facultatifs restent présentés avec « si ton plat n'en contient pas déjà ».
- CIQUAL reste la source des calculs nutritionnels ; le dictionnaire sert au contexte culinaire. Aucune composition inconnue n'est inventée.

## Performance

- Aucune requête Supabase supplémentaire.
- Maximum 8 contextes compacts par jour et 32 sur la période analysée.
- Cache local renouvelé.
- Aucun changement du fonctionnement des protocoles.

## Installation

1. Remplacer les fichiers en conservant leur arborescence.
2. Exécuter une seule fois `supabase/V389_CONTEXTE_CULINAIRE_UNIVERSEL.sql` dans Supabase SQL Editor.
3. Effectuer ensuite la synchronisation iOS habituelle.

Le SQL est idempotent et peut être relancé sans duplication.
