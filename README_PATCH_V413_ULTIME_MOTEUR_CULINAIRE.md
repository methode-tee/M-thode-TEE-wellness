# Méthode TEE — PATCH V413 ULTIME Moteur Culinaire

Version iOS : **1.0.4**  
Build : **37**  
Base attendue : projet actuel **build 36** (`M-thode-TEE-wellness-main 367.zip`).  
SQL : **aucun**.

## Installation

Ce ZIP est un **patch cumulatif**, pas le projet complet.

Copier son contenu à la racine du projet en conservant exactement les chemins et en remplaçant les fichiers existants.

Fichiers de production modifiés/ajoutés :

- `food-inspiration.html`
- `scripts/food-inspiration.js`
- `scripts/food-universal-engine.js`
- `scripts/food-inspiration-kb.js`
- `scripts/food-inspiration-affinities.js` **(nouveau)**
- `www/food-inspiration.html`
- `www/scripts/food-inspiration.js`
- `www/scripts/food-universal-engine.js`
- `www/scripts/food-inspiration-kb.js`
- `www/scripts/food-inspiration-affinities.js` **(nouveau)**
- `ios/App/App.xcodeproj/project.pbxproj`

Fichier QA facultatif :

- `qa/food-inspiration-regression.js`

## Ce que V413 corrige

### 1. Pâtes + lardons + haricots

Le mot `haricots` est traité comme ambigu : il peut désigner des haricots verts ou des haricots secs/légumineuses. La proposition ne force plus une seule interprétation et conserve les trois ingrédients dans le titre.

Variantes testées :

- Pâtes poêlées · lardons & haricots
- Pâtes en sauce courte · lardons & haricots
- Salade tiède de pâtes · lardons & haricots
- Pâtes façon risottata · lardons & haricots
- Pâtes rôties au four · lardons & haricots
- Pâtes citron-herbes · lardons & haricots

Les compléments proviennent maintenant de pools d'affinités culinaires et varient selon l'intention, l'historique et la variante au lieu de retomber mécaniquement sur courgette/épinards.

### 2. Fraise + menthe + eau

Une base `eau + fruit + herbe` est verrouillée dans la famille des boissons froides/non lactées. Elle ne peut plus devenir latte, chai, café au lait ou boisson chaude.

Variantes testées :

- Eau infusée fraise & menthe
- Eau fraîche fraise-menthe
- Citronnade fraise-menthe
- Mocktail fraise-menthe sans alcool
- Granité fraise-menthe
- Eau pétillante fraise-menthe

Compléments possibles : citron vert, glaçons, eau pétillante, zeste d'agrume, gingembre léger, etc., selon l'intention.

### 3. Banane plantain + riz cantonais + saumon

`Riz cantonais` est maintenant reconnu comme **plat déjà composé** et non comme simple féculent. Le titre doit conserver le riz cantonais, le saumon et le plantain.

Variantes testées :

- Saumon rôti · riz cantonais & plantain doré
- Bowl saumon · riz cantonais & plantain
- Saumon laqué soja-gingembre · riz cantonais & plantain rôti
- Plantain poêlé & saumon · riz cantonais aux légumes
- Assiette fusion · riz cantonais, saumon & plantain
- Saumon grillé · riz cantonais & plantain citronné

### 4. Moteur généralisé

V413 ajoute une couche d'affinités culinaires structurées et renforce :

- les rôles culinaires (féculent, protéine, légumineuse, végétal, fruit, matière grasse, condiment, dessert, boisson, pâte, plat préparé...) ;
- les plats déjà composés (riz cantonais/fried rice, taboulé, ratatouille, risotto, paella, bibimbap, japchae, nasi goreng, pho, laksa, biryani, dal, jollof, waakye, thiéboudiène, garba, yassa, mafé, ndolè, poulet DG, pondu, couscous garni...) ;
- les familles Afrique, Afrique centrale, Afrique de l'Est, Maghreb/Méditerranée, Asie de l'Est, Asie du Sud-Est et Asie du Sud ;
- les feuilles fraîches, pains/pinsa, pâtes alimentaires vs pâtes feuilletées/brisées/sablées, poissons, morceaux de viande/volaille, fromages frais, boissons, desserts et préparations pâtissières ;
- la conservation des ingrédients principaux dans les titres ;
- le contrôle anti-contradiction et anti-complément déjà possédé ;
- la variété des explications et des compléments par intention ;
- la distinction entre une idée simplement affichée et une préférence positive réellement enregistrée.

### 5. Garde-fous ajoutés

Le validateur pénalise ou rejette notamment :

- feuille fraîche cuite par erreur ;
- pâte feuilletée confondue avec des pâtes ;
- boisson eau/fruit transformée en latte ;
- pommes de terre + lait/crème transformées en boisson ;
- ajout d'une seconde protéine/féculent déjà présent sans raison ;
- yaourt inventé ;
- conflit dessert/salé ;
- identité d'un plat préparé perdue ;
- complément qui répète un ingrédient déjà possédé.

## Validation effectuée avant ZIP

- syntaxe JS : OK ;
- versions racine / `www` synchronisées : OK ;
- build iOS : **37** dans Debug et Release ;
- test ciblé 3 cas × 6 intentions × 6 variantes = **108 générations, 0 invalide** ;
- ZIP testé avec `unzip -t` : OK.

Le fichier `qa/food-inspiration-regression.js` contient aussi la matrice de non-régression élargie. La matrice CIQUAL exhaustive est volontairement séparée (`QA_FULL=1`) car son temps d'exécution est beaucoup plus long.
