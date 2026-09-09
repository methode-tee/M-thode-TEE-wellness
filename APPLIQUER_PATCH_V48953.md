# Méthode TEE — V489.5.3

Correctif frontend ciblé, construit directement sur le ZIP 451.

## Corrige

1. **Auto-scroll réel dans le conteneur `.page`**
   - le shell de l'app a `overflow:hidden` et le scroll réel se fait dans `.page` ;
   - l'ancien code scrollait `window`, donc Safari iOS pouvait ne rien faire ;
   - V489.5.3 détecte le vrai conteneur scrollable et l'oriente vers `#mtPlanResult` dès le clic puis après le rendu final.

2. **Restes = préparation x2, pas nouvel achat le lendemain**
   - si mardi est `Restes` du repas de lundi, la liste de courses porte explicitement la quantité x2 sur lundi ;
   - mardi ajoute 0 nouvel achat ;
   - l'affichage indique « à préparer x2 » puis « 0 € d’achat supplémentaire ».

3. **Intégrité des très petits coûts éditoriaux**
   - chaque composant obligatoire d'un repas éditorial doit avoir un coût strictement positif ;
   - une ligne absente ou à 0 ne peut plus faire passer le repas pour entièrement chiffré ;
   - le coût complet des ingrédients de l'assiette est conservé séparément du coût d'achat restant après placard.

## Ne change pas

- animation de préparation V489.5.2 : **CSS strictement inchangé** ;
- moteur budget V489.5.2 ;
- catalogue SQL ;
- Supabase ;
- paiements, protocoles, voix, CIQUAL.

## Fichiers à remplacer

- `tee-next.html`
- `www/tee-next.html`
- `scripts/tee-next.js`
- `www/scripts/tee-next.js`

Aucun SQL à exécuter.
