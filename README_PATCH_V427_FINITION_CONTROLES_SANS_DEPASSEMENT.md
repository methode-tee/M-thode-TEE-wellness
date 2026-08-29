# Méthode Tee — Patch V427 · finition contrôles sans dépassement

Base : `M-thode-TEE-wellness-main 384(2).zip`
Version iOS : 1.1.0 · build 43

## Correction unique

Ce patch corrige uniquement les contrôles de formulaire qui pouvaient dépasser visuellement de leur carte sur iPhone/Safari, en particulier les champs natifs `time`, `date` et `number` utilisés dans les suivis, ainsi que certains champs de l’admin.

La correction ajoute un confinement CSS standard (`min-width:0`, `max-width:100%`, `box-sizing:border-box`) aux contrôles et conteneurs concernés.

## Ce qui n’est pas modifié

- aucun comportement de saisie/clavier V426 ;
- aucun repositionnement après clavier ;
- aucun moteur alimentaire ;
- aucune logique protocole/suivi ;
- aucune donnée Supabase ;
- aucun SQL ;
- aucune performance/HealthKit ;
- aucune apparence volontaire des champs.

Les fichiers HTML présents dans le patch ne changent que le cache-busting de `styles/style.css` afin que la correction soit immédiatement chargée.

## Après upload

```bash
cd ~/methode-tee-capacitor
git status
git pull origin main
npx cap sync ios
npx cap open ios
```

Aucun SQL à exécuter.
