# V482D — Quantité : ne plus lancer l’analyse au premier chiffre

Correctif ciblé sur le flux vocal Méthode TEE.

## Corrigé
- La saisie d'une quantité en grammes ne relance plus l'analyse sur chaque frappe.
- Exemple : pour saisir `10 g`, taper `1` puis `0` ne déclenche plus le loader entre les deux chiffres.
- La valeur est mémorisée pendant la frappe, puis l'analyse repart seulement quand la saisie est validée (fin de saisie / sortie du champ / Entrée).
- Le loader initial de compréhension reste à **2 secondes minimum**.
- Les recalculs après un choix ou une quantité passent à **1 seconde minimum** pour rester fluides.

## Fichiers à remplacer
- `index.html`
- `www/index.html`
- `scripts/home-smart-cards.js`
- `www/scripts/home-smart-cards.js`

## Non touché
- Aucun SQL
- Aucun protocole
- Aucun XP / progression
- Aucun enregistrement historique du Carnet
- Aucun moteur nutritionnel
- Aucun plugin iOS
