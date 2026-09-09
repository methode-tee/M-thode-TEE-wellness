# MÉTHODE TEE — V488.8.2 CUMULATIF

## Contenu
Cette version part du ZIP `M-thode-TEE-wellness-main 443.zip` et **inclut V488.8.1 qui n'avait pas encore été uploadé**.

Elle ajoute 3 briques :

1. **Fiabilité V488.8.1 cumulée**
   - budget `flexible` : TEE reste sur le pool **100 % chiffrable** tant qu'il existe ;
   - un plat externe/whole-dish acheté n'est plus transformé en faux « reste » ;
   - seuls les vrais plats cuisinés/recettes peuvent être réutilisés comme restes.

2. **Hiérarchie culturelle**
   - niveau 0 : premier plan / familier grand public ;
   - niveau 1 : découverte accessible, secondaire ;
   - niveau 2 : découverte culturelle spécifique/complexe, secondaire forte ;
   - Ramen, Pad thaï et Soupe wonton restent niveau 0 ;
   - Tom kha gai, Harira, Mafé poulet & riz et Poulet yassa & boulgour passent niveau 1 ;
   - Poulet DG passe niveau 2.
   - un niveau 1 est limité à 2 occurrences fraîches/semaine par défaut ; un niveau 2 à 1, sauf si la mémoire alimentaire démontre une vraie familiarité.

3. **Mémoire alimentaire Bébé TEE**
   - lit les repas réellement enregistrés dans `food_meals` / `food_meal_items` ;
   - fenêtre par défaut : 60 jours ;
   - active après au moins 8 déjeuners/dîners répartis sur 4 jours ;
   - utilise récence + ingrédients/tokens + catégories + pays déjà réellement consommés ;
   - favorise des plats **proches/similaires** ;
   - évite le **même plat exact** mangé récemment quand une alternative existe ;
   - autorise au maximum **1 vraie nouveauté éloignée** si des alternatives familières restent disponibles ;
   - une culture spécifique peut remonter naturellement si l'utilisateur en consomme réellement souvent.

### Important
Aucune origine, couleur de peau ou ethnicité n'est déduite. La familiarité culturelle vient uniquement des repas que l'utilisateur a lui-même enregistrés.

## Ordre d'installation
1. Exécuter dans Supabase :
   `supabase/V48882_HIERARCHIE_CULTURELLE_MEMOIRE_ALIMENTAIRE.sql`
2. Envoyer le JSON `v48882_result`.
3. Si `candidate_meta=true` et `personal_memory=true`, uploader :
   - `scripts/tee-next.js`
   - `www/scripts/tee-next.js`
4. Pour l'app native iOS : faire ensuite le même sync/build Terminal + Xcode que pour V488.7.1.

## Ce qui ne change pas
- prix existants ;
- valeurs nutritionnelles ;
- recettes ;
- CIQUAL ;
- voix ;
- protocoles ;
- paiements / droits premium ;
- signatures des RPC historiques du planificateur.

## Test après build
Tester 30 / 45 / 70 € avec :
- un compte peu rempli : hiérarchie générale, culturel spécifique secondaire ;
- un compte ayant un historique fourni : vérifier `Mémoire alimentaire active` ;
- vérifier que les plats ressemblent davantage aux habitudes sans répéter exactement les derniers plats ;
- vérifier qu'une cuisine culturellement spécifique remonte uniquement si l'historique la rend familière, ou ponctuellement comme découverte.
