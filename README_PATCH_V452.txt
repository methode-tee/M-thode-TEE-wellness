MÉTHODE TEE — PATCH V452

Base: ZIP 405.

Corrections:
- Jauges Mes repères: proportion réelle de la valeur du jour vers le haut de la zone. 1678/2650 = ~63%, plus de faux trait bloqué à 5%.
- Début de zone personnelle matérialisé discrètement dans la jauge.
- Nouveau accès « Voir le détail nutritionnel » depuis Résumé de ma journée.
- Nouveau accès « Détail nutritionnel » sur chaque repas calculable.
- Détail: kcal, protéines, glucides, lipides, fibres, sel + sucres, saturés, sodium, trans, mono/poly-insaturés, amidon, polyols, cholestérol, alcool, oméga-3/6, kJ et micronutriments documentés.
- Une donnée absente reste « Non documenté »; un ensemble incomplet affiche « Données partielles » et aucun faux total.
- Micronutriments chargés uniquement à l'ouverture du détail: pas de requête supplémentaire permanente, donc protection du cached egress.
- Sheet mobile scrollable avec 100dvh / safe areas.
- Racine et www synchronisés, cache-busters V452.

AUCUN NOUVEAU SQL V452. Les migrations V441/V442/V445/V446/V447/V451 doivent déjà être installées comme dans le projet 405.
