# Audit diff V488.7.1

- Backend / Supabase : **inchangé**
- Prix : **inchangés**
- CIQUAL : **inchangé**
- `food_dictionary` : **inchangé**
- Recettes : **inchangées**
- Voice : **inchangée**
- Protocoles : **inchangés**
- Frontend : 4 fichiers ciblés

## Garde-fous
- seuil >=75 % appliqué uniquement au tier `flexible` (>55 €), et uniquement s'il reste au moins un candidat satisfaisant ce seuil ;
- fallback sur le pool complet si aucun candidat >=75 % n'est disponible ;
- aucune valeur manquante n'est transformée en 0 € ;
- détection whole-dish renforcée sans nouvelle requête Supabase.
