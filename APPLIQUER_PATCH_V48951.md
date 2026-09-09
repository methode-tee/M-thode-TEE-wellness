# Méthode TEE — Patch V489.5.1

Correctif frontend cumulatif au-dessus de V489.4.3.1 / V489.5.

## Corrections

- second passage budget dédié lorsqu'un premier plan « équilibré » termine sous le plancher de 78 % ;
- le second passage cherche uniquement une semaine complète entre le plancher et l'enveloppe, avec un faisceau élargi ;
- il ne relâche pas la variété uniquement pour dépenser davantage ;
- normalisation canonique des familles de protéines et féculents avant les compteurs de diversité ;
- `pasta` et `pasta_noodle` comptent désormais comme une seule famille ;
- `semolina` et `semolina_bulgur` comptent désormais comme une seule famille ;
- garde max 2 d'une même famille dominante par défaut conservée ;
- orientation/chargement UX V489.5 conservés.

## À uploader

Remplacer à la racine du dépôt en conservant les dossiers :

- `tee-next.html`
- `scripts/tee-next.js`
- `styles/tee-next.css`
- `www/tee-next.html`
- `www/scripts/tee-next.js`
- `www/styles/tee-next.css`

Aucune migration SQL n'est nécessaire.

## QA

```bash
node qa/test_v48951_budget_floor_variety.js
```
