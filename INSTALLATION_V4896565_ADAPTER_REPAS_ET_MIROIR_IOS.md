# V4896565 — Adapter mon repas + miroir iOS

Base : **M-thode-TEE-wellness-main 472.zip**.

## Ce patch change

### Adapter mon repas
1. **Intention réellement facultative** : `Sans intention particulière` devient la valeur neutre par défaut. `Équilibre` n'est plus imposé silencieusement.
2. **Contexte de la journée** : au moment de préparer l'adaptation, TEE regarde les repas déjà renseignés plus tôt le même jour. Si une protéine a déjà été utilisée, elle n'est pas répétée automatiquement : la variété reste une option, pas une obligation.
3. **Hiérarchie simplifiée** : un seul bloc **Le choix de Tee** devient l'adaptation prioritaire. Au maximum deux ajustements complémentaires apparaissent ensuite sous **Si tu veux aller un peu plus loin**.
4. **Décision explicite** : le bouton devient **Je choisis cette adaptation**. Le statut affiché est **Adaptation choisie**. Les aliments/nutriments enregistrés ne sont jamais modifiés silencieusement.
5. **Moment du repas** : petit-déjeuner et collation sont traités comme tels. Une collation n'est plus poussée à ressembler à une assiette complète et une suggestion protéinée au petit-déjeuner reste cohérente avec un petit-déjeuner.

### Correctif Capacitor / iOS
- `www/scripts/food-day.js` n'est plus vide.
- Il est restauré depuis `scripts/food-day.js` et les deux miroirs sont identiques.
- Le libellé lié aux adaptations dans Ma journée alimentaire devient lui aussi **Adaptation choisie**.
- Cache-busters mis à jour sur `food-adapter.html` et `food-day.html` (racine + `www`).

## Fichiers à remplacer
- `food-adapter.html`
- `scripts/food-adapter.js`
- `food-day.html`
- `scripts/food-day.js`
- `www/food-adapter.html`
- `www/scripts/food-adapter.js`
- `www/food-day.html`
- `www/scripts/food-day.js`

## Non modifié
Aucun SQL. Aucun paiement, Apple IAP, checkout, déblocage ou droit premium. Aucun changement du moteur voix, photo ou scan.
