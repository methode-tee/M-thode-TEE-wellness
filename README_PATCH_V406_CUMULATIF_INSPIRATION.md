# PATCH V406 — Inspire-moi avec ce que j’ai

Version app : **1.0.4**  
Build iOS : **34 (inchangé)**  
SQL Supabase : **aucun**

Ce patch est **cumulatif** : il est construit à partir du V405 et conserve les familles/corrections précédentes V399 → V405.

## Fichiers à remplacer

- `food-inspiration.html`
- `scripts/food-inspiration.js`
- `www/food-inspiration.html`
- `www/scripts/food-inspiration.js`

## Ajouts V406

### Pain/panini + crème + fromage
Reconnaît notamment panini, pain panini, ciabatta, baguette, petits pains/buns avec crème fraîche/liquide/épaisse et parmesan, emmental, comté, mozzarella, chèvre ou ricotta.

Exemple : `pain panini + crème fraîche + parmesan` → **Panini blanc · crème & parmesan**.
Variantes : champignons, courgette, poulet, tomate, garlic bread parmesan.

### Mini pains + huile + oignon
Exemple : `mini pains + huile d’olive + oignon` → **Mini pains à l’oignon & huile d’olive**.
Variantes : herbes, mini bruschettas, ail-oignon, gratinés fromage, mini sandwichs.

### Ailes de poulet + moutarde + huile
Exemple : `ailes de poulet + moutarde + huile de tournesol` → **Ailes de poulet rôties à la moutarde**.
Variantes : citron, paprika, miel, ail, pommes grenailles. La pièce « ailes de poulet » est conservée dans les titres.

### Rôti de bœuf + grenailles + huile d’olive
Reconnaît `rôti de bœuf`, `rosbif`, `roast beef` et les formulations autour des pommes grenailles.
Exemple → **Rôti de bœuf & pommes grenailles rôties**.
Variantes : ail-romarin, moutarde, légumes rôtis, salade tiède, sauce aux herbes.

### Chocolat noir + œufs + sucre
Reconnaît chocolat noir, pâtissier, dessert ou de couverture.
Exemple → **Mousse au chocolat noir**.
Variantes : mousse vanille, fondant, brownie, crème chocolat, soufflé.

### Œufs + lait + sucre
Cette combinaison reste désormais dans l’univers dessert et ne tombe plus dans une assiette salée.
Exemple → **Crème aux œufs maison**.
Variantes : œufs au lait, flan, crème caramel, pain perdu, crêpes sucrées.

### Farine + sucre + levure
- `levure` / `levure chimique` / poudre à lever / baking powder → **Base de gâteau moelleux à compléter**.
- `levure boulangère` / de boulanger → **Pâte briochée à compléter**.

Variantes gâteau : gâteau moelleux, muffins, pancakes, cake, biscuits.
Variantes levure boulangère : brioche, petits pains briochés, brioche cannelle, pains au lait.

## Saisie naturelle
Les nouvelles familles acceptent aussi de nombreuses saisies sans `+` ni virgules, par exemple :

- `panini crème fraîche parmesan`
- `oeufs lait sucre`
- `sucre farine levure chimique`
- `farine sucre levure boulangère`

## Vérifications effectuées

- syntaxe JavaScript : OK (`node --check`)
- JS racine = JS `www/` : OK
- HTML racine = HTML `www/` : OK
- cache-busting : `v406-cumulative-families`
- tests des nouvelles familles sur les 6 intentions : OK
- non-régression des familles V402–V405 testées : OK
- aucun changement de version/build requis
