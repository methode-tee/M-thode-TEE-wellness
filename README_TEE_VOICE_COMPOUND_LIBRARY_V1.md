# MÉTHODE TEE — VOICE COMPOUND LIBRARY V1

## Ce patch est cumulatif
Il contient les correctifs Voice précédents :
- même `MTFood.searchFoods()` que Ma journée alimentaire / Adapter ;
- pas de CIQUAL/ANSES affiché dans l'interface ;
- `œuf/oeuf` normalisés ;
- aucune quantité inventée si elle n'a pas été prononcée ;
- titre générique tant que la fiche exacte n'est pas choisie.

## Nouveau : « plat composé d'abord »
TEE ne possède AUCUNE liste codée en dur de plats composés.

Après la transcription, elle prend les repères adjacents et teste dynamiquement,
du groupe le plus long au plus court (jusqu'à 5 repères), contre
`MTFood.searchFoods()` — la même bibliothèque que Ma journée alimentaire.

Exemple :
`J'ai mangé un wrap thon et avocat`

TEE essaie dans cet ordre :
1. `wrap thon et avocat` / `wrap thon avocat`
2. si aucun plat fort : `wrap thon`
3. sinon les aliments restent séparés.

Si la bibliothèque possède un plat correspondant, TEE crée UN seul repère composé
et affiche « Lequel ? » avec les fiches de la bibliothèque.

Si elle ne possède pas de plat assez proche, elle ne force rien et garde les aliments séparés.

## Pourquoi cela couvre toute la bibliothèque
Le moteur n'énumère ni wrap, ni salade, ni omelette, ni couscous, ni plats culturels.
Il interroge la bibliothèque en temps réel. Un futur plat ajouté à la bibliothèque
devient donc automatiquement reconnaissable comme composé si la recherche TEE le retrouve.

## Sécurité quantités
Un groupe n'est pas fusionné si plusieurs ingrédients ont chacun une quantité prononcée.
Exemple : `100 g de riz et 150 g de poulet` reste deux aliments.

## Aucun SQL
Aucun SQL supplémentaire.

## Après upload
```bash
git pull --rebase origin main
npx cap sync ios
npx cap open ios
```

## Test prioritaire
Dire exactement :
`J'ai mangé un wrap thon et avocat.`

Attendu :
- si la bibliothèque possède `wrap thon avocat` (ou alias fort) : un seul repère composé ;
- sinon, si elle possède un `wrap thon...` : `Wrap thon` + `Avocat` ;
- sinon : `Wrap` + `Thon` + `Avocat`.
Aucune variante jambon/huile/etc. ne doit devenir le titre avant sélection.
