# PATCH V445 — Nutrition complète · Favoris recettes · Routines propres

Base : `M-thode-TEE-wellness-main 400.zip`

## Ordre d'installation

1. Si V441 / V442 sont déjà appliqués dans Supabase, exécuter uniquement :
   `supabase/V445_NUTRITION_COMPLETE_FAVORIS_ROUTINES.sql`
2. Sinon, respecter l'ordre : V441 → V442 → V445.
3. Copier les fichiers du patch en conservant l'arborescence racine + `www/`.
4. Recharger la PWA / le site. Les cache-busters V445 sont inclus.

## 1. Nutrition complète, sans faux zéros

Le Carnet conserve toujours les macros de base déjà présentes : énergie, protéines, glucides, lipides, fibres et sel.
V445 ajoute un snapshot JSON complémentaire par aliment et par repas pour les données réellement disponibles, notamment :
- sucres ;
- acides gras saturés ;
- sodium ;
- acides gras trans ;
- mono-insaturés ;
- poly-insaturés ;
- amidon ;
- polyols ;
- cholestérol ;
- alcool ;
- oméga-3 / oméga-6 ;
- énergie kJ ;
- et les autres nutriments `*_100g` réellement fournis par Open Food Facts, conservés sous clé générique.

Le scanner Open Food Facts réutilise le même appel `nutriments` qu'avant : V445 exploite davantage de champs déjà renvoyés, sans ajouter une seconde requête réseau.

Les micronutriments documentés par Open Food Facts (fer, calcium, zinc, iode, magnésium, phosphore, potassium, sélénium, vitamines B/C/D/E, oméga-3 selon disponibilité) sont aussi convertis vers les clés micronutritionnelles Méthode Tee pour pouvoir alimenter les suivis existants.

Règle stricte : une valeur absente reste `null` / absente. Elle n'est jamais transformée en 0. Un total journalier détaillé n'est exposé que si tous les repas enregistrés disposent réellement de la donnée correspondante.

## 2. Studio alimentaire admin

Ajout de champs facultatifs pour les valeurs complémentaires : sucres, saturés, sodium, trans, mono/poly-insaturés, amidon, polyols, cholestérol et alcool.
Une case vide reste inconnue. Les valeurs personnalisées complémentaires ne sont exposées par la recherche qu'après validation `Valeurs vérifiées par Tee`, comme les macros personnalisées existantes.

## 3. Repères et tendances, cached egress protégé

Les faits quotidiens compacts peuvent maintenant porter, quand ils sont complets : lipides, glucides, sel, sucres, saturés, sodium, trans, mono/poly-insaturés, amidon, polyols, cholestérol et alcool.
Le détail complet reste au niveau du repas : il n'est pas téléchargé dans les vues 28 jours / 3 mois.

- 28 jours : toujours au maximum 28 faits journaliers compacts.
- 3 mois : toujours les agrégats mensuels V441 ; aucune lecture de 90 repas / 90 journées brutes.
- Les tendances 3 mois peuvent maintenant décrire sucres, graisses saturées ou sel si ces données sont suffisamment documentées.
- Aucun nouveau polling / Realtime.
- Le bootstrap existant est simplement invalidé une fois afin de reconstruire côté serveur les nouveaux champs.

## 4. Favoris recettes

Correction du bouton cœur compact des cartes recettes : après clic, il reste strictement `♥` / `♡` dans son cercle. Le libellé `Favori` n'est plus injecté dans ce petit bouton et ne peut plus chevaucher `Disponible`.
Un durcissement CSS empêche également tout débordement de la zone d'actions.

## 5. Routines créées depuis le Feed

Le contenu éditorial admin reste inchangé dans le Feed/admin (titres Markdown `#`, `##`, etc.).
Lorsqu'un post est ajouté à une routine utilisateur :
- l'intention publique est nettoyée des marqueurs Markdown et des balises techniques ;
- la liste `Mes routines` affiche une version courte et propre ;
- les anciennes routines déjà enregistrées avec du Markdown brut sont nettoyées à l'affichage et lors de leur prochaine édition.

## Contrôles réalisés

- syntaxe JS : `app.js`, `food-core.js`, `food-meal.js`, `admin.js`, `custom-trackers.js`, `v18-premium.js` ;
- parité racine / `www/` sur tous les fichiers modifiés ;
- SQL : blocs `$$` et parenthèses contrôlés statiquement ;
- aucun SQL n'a été exécuté sur la base de production depuis cet environnement.
