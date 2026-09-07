MÉTHODE TEE — PATCH V481 · BÉBÉ TEE PREND LE MICRO
===================================================

BASE DE DÉPART : ZIP 434 + SQL V477/V478B/V479/V479B/V480 déjà appliqués.

À FAIRE
-------
Uploader/remplacer UNIQUEMENT les fichiers présents dans ce patch, en conservant exactement leurs chemins.
Aucun SQL supplémentaire n'est nécessaire pour V481.

FICHIERS WEB RACINE
- index.html
- food-meal.html
- scripts/home-smart-cards.js              [NOUVEAU]
- scripts/v14-luxe.js
- scripts/food-meal.js

COPIES CAPACITOR / WWW
- www/index.html
- www/food-meal.html
- www/scripts/home-smart-cards.js          [NOUVEAU]
- www/scripts/v14-luxe.js
- www/scripts/food-meal.js

FICHIERS iOS NATIFS
- ios/App/App/SpeechRecognitionPlugin.swift [NOUVEAU]
- ios/App/App/MainViewController.swift
- ios/App/App/Info.plist
- ios/App/App.xcodeproj/project.pbxproj

CE QUE FAIT V481
----------------
1) INVITÉ / NON CONNECTÉ
   - Les 4 cartes actuelles restent Hydratation / Fuel du jour / Mouvement / Sweet switch.
   - Aucun changement de logique.

2) MEMBRE CONNECTÉ
   - Les mêmes 4 emplacements sont rendus directement, avant disparition du loader :
     Mon repas / Ton repère / Composer avec Tee / Mon expérience.
   - Aucun flash Hydratation -> Mon repas devant l'utilisateur.
   - Aucun appel Supabase supplémentaire au simple affichage des cartes.

3) MON REPAS
   - Photographier : ouvre directement la caméra via un input local ; la photo est transportée localement
     par IndexedDB jusqu'au formulaire de repas existant. La RECONNAISSANCE VISUELLE n'est PAS encore activée.
   - Le dire à TEE : micro iPhone + reconnaissance vocale locale uniquement quand disponible.
   - Rechercher / scanner : ouvre le moteur alimentaire et scanner existants.

4) VOIX
   - Le plugin iOS impose requiresOnDeviceRecognition=true.
   - Aucun appel OpenAI/Gemini/LLM.
   - Le TEXTE transcrit est envoyé uniquement à la fonction Supabase V480 déjà installée afin de le relier
     au catalogue Méthode TEE / CIQUAL. Aucun audio n'est envoyé à Supabase.
   - L'utilisateur choisit les précisions nécessaires et confirme toujours avant passage au Carnet.

5) CARNET
   - Le repas vocal est transmis comme BROUILLON au formulaire food-meal existant.
   - La fonction d'enregistrement historique du Carnet n'a PAS été réécrite.
   - L'utilisateur voit/corrige le repas puis utilise le bouton Enregistrer déjà existant.

6) TON REPÈRE / MON EXPÉRIENCE
   - Les moteurs personnels déjà présents ne se chargent qu'après un appui explicite.
   - L'ouverture de la Home n'interroge donc pas les historiques pour ces cartes.
   - Une expérience n'est démarrée qu'après le bouton explicite "Commencer cette expérience".

NON TOUCHÉ
----------
- v18-premium.js
- protocol-journey.js
- protocol_progress
- current_day
- completed_content
- XP
- déblocage 7 h
- validation / "contenu terminé"
- achats des protocoles
- SQL des protocoles
- logique d'enregistrement historique du Carnet

TESTS AVANT SOUMISSION APP STORE
--------------------------------
A. Accueil invité : les 4 anciennes cartes apparaissent directement.
B. Accueil membre : les 4 nouvelles cartes apparaissent directement après le loader, sans flash.
C. Mon repas > Le dire à TEE : accepter micro + reconnaissance vocale, dicter :
   "J'ai mangé 150 g de riz et 120 g de poulet".
D. Choisir riz cuit / nature + blanc/filet, confirmer, vérifier l'arrivée dans food-meal.html.
E. Enregistrer le repas et vérifier Ma journée alimentaire.
F. Photographier : vérifier que la caméra s'ouvre et que la photo arrive dans le formulaire.
G. Rechercher / scanner : vérifier recherche + scanner code-barres existants.
H. Protocoles : ancien compte + nouveau compte ; vérifier J1/Jn, contenus terminés, XP et déblocages inchangés.

IMPORTANT
---------
V481 nécessite un NOUVEAU BUILD iOS parce qu'elle ajoute un plugin Swift et les permissions Microphone / Speech.
La version web peut utiliser le champ texte de secours si le plugin iOS local n'est pas disponible.
