# Audit diff V488.8.3.3

- SQL : **aucun**
- Backend / Supabase : **inchangé**
- Prix : **inchangés**
- Nutrition / CIQUAL : **inchangés**
- Recettes : **inchangées**
- Protocoles / paiements / voix : **inchangés**
- Frontend : 4 fichiers du planificateur uniquement

## Garde-fous préservés
- priorité aux candidats 100 % chiffrables ;
- coût inconnu jamais converti en 0 € ;
- plats whole-dish non traités comme restes ;
- max 1 découverte culturelle spécifique/semaine par défaut ;
- mémoire uniquement à partir de l'historique du compte connecté ;
- repas exacts récents évités quand des alternatives existent.

## Régression ciblée
V488.8.3.2 pouvait produire 30 € et 45 € avec 6/7 plats identiques.
V488.8.3.3 ajoute un band budgétaire AVANT la sélection mémoire et normalise le signal personnel pour modifier la composition, pas seulement l'ordre.
