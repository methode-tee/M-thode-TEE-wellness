# PATCH V482E — UI voix : choix fiables + bouton discret

## Corrige

1. **"Modifier ma phrase" n'est plus affiché comme gros bouton permanent**.
   - le bouton devient un lien discret **"Reformuler ma phrase"** ;
   - il n'apparaît que quand il reste réellement quelque chose à corriger.

2. **Les variantes sans `option_key` exploitable ne sont plus rendues comme des choix cliquables**.
   - cela évite le bug visuel où plusieurs pastilles deviennent vertes en même temps ;
   - cela évite aussi de bloquer l'écran sur une pseudo-précision impossible à valider.

3. **La logique de validation a été durcie**.
   - un aliment n'est bloquant que s'il attend une vraie précision, une vraie quantité, ou une vraie recherche ;
   - les faux choix non exploitables ne gardent plus le message *"Il reste au moins une précision..."* à tort.

4. **Le comportement des loaders existants n'est pas modifié**.
   - première compréhension : **2 s** minimum ;
   - chargements suivants : **1,30 s** minimum.

## Fichiers inclus
- `scripts/home-smart-cards.js`
- `www/scripts/home-smart-cards.js`
- `index.html`
- `www/index.html`

## À tester
1. Dire une phrase complexe.
2. Vérifier qu'une seule option devient verte à la fois.
3. Vérifier que **Reformuler ma phrase** n'apparaît plus comme un gros bouton permanent.
4. Vérifier que **Confirmer et continuer** s'affiche dès que tout est réellement prêt.
