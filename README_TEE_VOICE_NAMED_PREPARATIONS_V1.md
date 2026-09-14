# MÉTHODE TEE — VOICE NAMED PREPARATIONS V1

Base : `M-thode-TEE-wellness-main 500 7.zip`

## Décision
Voice ne fusionne plus des aliments simplement parce que la recherche les trouve proches.

Le SQL construit une vue dynamique de TOUT `food_dictionary` et n'autorise le
regroupement que pour de vraies préparations nommées.

### Autorisés
- Pizza Margherita
- Wrap thon avocat
- Sandwich jambon-fromage
- Burger...
- Quiche / tarte / tourte
- Ravioli / lasagnes / cannelloni
- Pâtes carbonara / bolognaise / pesto...
- Riz gras / riz cantonais / jollof / biryani / risotto / paella
- Salade César / niçoise / grecque...
- Smoothies / lassi
- plats culturels déjà marqués `composite_dish` et non génériques

### Refusés volontairement
- riz + poulet
- riz + saumon
- omelette + jambon + fromage
- salade + poulet + avocat
- pâtes + poulet + brocoli

## Pourquoi cela couvre l'immense bibliothèque
`mt_voice_named_compounds_v1` est une VUE sur `food_dictionary`.
Elle rescane automatiquement la bibliothèque actuelle et future.
On ne maintient pas une liste de milliers de plats dans le JavaScript.

Les alias exacts de la bibliothèque sont pris en compte, mais une recherche
approximative ne suffit plus à fusionner des aliments.

## Ordre d'installation
1. Exécuter `TEE_VOICE_NAMED_PREPARATIONS_V1_SQL_A_EXECUTER.sql`.
2. Vérifier l'audit `TEE_VOICE_NAMED_PREPARATIONS_V1_INSTALLED`.
3. Uploader les 6 fichiers app de ce ZIP.
4. Puis :
```bash
git pull --rebase origin main
npx cap sync ios
npx cap open ios
```

## Test
- `J'ai mangé un wrap thon et avocat` : fusion uniquement si cette vraie préparation/alias existe dans la bibliothèque.
- `J'ai mangé du riz, du poulet et de l'avocat` : doit rester 3 aliments.
- `J'ai mangé une omelette, du jambon et du fromage` : doit rester 3 aliments.
- `J'ai mangé des pâtes carbonara` : une seule préparation si elle existe.
