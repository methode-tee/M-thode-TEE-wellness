MÉTHODE TEE — PATCH V374
OFFERT PAR TEE · BIBLIOTHÈQUE PERSONNELLE
Base : M-thode-TEE-wellness-main 348.zip

IMPORTANT
=========
1. Exécuter d'abord : supabase/V374_OFFERT_PAR_TEE_BIBLIOTHEQUE.sql
2. Attendre "Success. No rows returned".
3. Ensuite seulement uploader les fichiers du patch.

AUCUNE animation existante n'a été modifiée.
Aucun droit de protocole premium, paiement, Jardin ou Feed n'a été modifié.

CE QUE V374 AJOUTE
==================

1) SÉPARATION PREMIUM DANS CARNET
Juste après « + Ajouter un suivi » :
    ───── ✶ ─────
    TA BIBLIOTHÈQUE MÉTHODE TEE
    Des ressources à découvrir, garder et retrouver.

La partie personnelle du Carnet est donc visuellement séparée de la Bibliothèque.

2) « OFFERT PAR TEE ✶ » JUSTE SOUS LA SÉPARATION
- Les nouveautés les plus récentes apparaissent en premier.
- Jusqu'à 6 cartes légères sont affichées sur le Carnet.
- Filtres horizontaux par vrai type de contenu.
- « Voir toutes les ressources » ouvre l'historique complet.
- La page complète charge 12 ressources par 12.
- Filtres : type + Tout / À ajouter / Dans ma bibliothèque.

Une nouvelle ressource publiée 3 jours plus tard remonte automatiquement devant les précédentes au prochain chargement du Carnet. Aucun Realtime n'est utilisé.

3) « AJOUTER À MA BIBLIOTHÈQUE » = VRAI DÉBLOCAGE PERSONNEL
Au clic :
- l'ajout est enregistré dans Supabase pour ce compte ;
- la ressource est gardée définitivement par l'utilisateur ;
- elle rejoint immédiatement « Récemment disponibles » ;
- elle rejoint sa vraie catégorie et son compteur : PDF, Audio, Routine, Checklist, Tracker, Suivi, etc. ;
- sur un autre appareil, elle revient dans sa bibliothèque après connexion.

Si Tee retire ensuite la ressource des offres, les personnes qui l'avaient déjà ajoutée la conservent.

4) TYPES DE CONTENU : PAS DE RENDU GÉNÉRIQUE
V374 réutilise les vrais rendus déjà présents dans Méthode Tee :
- PDF / Document / Ebook : lecteur de document existant.
- Guide terrain : rendu éditorial existant.
- Audio : lecteur audio immersif existant.
- Vidéo : lecteur vidéo existant.
- Recette : rendu recette structuré existant.
- Routine : routine guidée étape par étape + ajout possible à Mes routines.
- Checklist : checklist interactive ; pour une ressource offerte, son état est isolé du protocol_progress.
- Tracker : vrai tracker à curseurs ; pour une ressource offerte, il reste autonome et local afin de ne pas créer de faux protocol_progress / lectures Supabase inutiles.
- Tableau : tableau mobile existant.
- Plan du parcours : timeline existante.
- Playlist : lecteur/liste existant.
- Suivi : formulaire structuré existant.

Les types personnels/confidentiels (Journal privé, Photo privée) ne sont volontairement pas proposés dans « Offert par Tee » : ils restent dans leurs systèmes personnels actuels.

5) ADMIN SÉPARÉ DES CONTENUS DE PROTOCOLE
Nouveau bloc :
    Bibliothèque · Offert par Tee
    Ajouter / modifier une ressource offerte

Il n'est PAS mélangé avec « Ajouter / modifier un contenu » d'un protocole.

L'admin adapte son aide selon le type :
- Routine = une étape par ligne.
- Checklist = actions / sections.
- Tracker = Indicateur|Min|Max|Bas|Haut.
- Suivi = Champ|Type|Unité/options.
- Tableau = colonnes séparées par |.
- Playlist = Titre|Durée|URL.
- etc.

Options admin :
- publication immédiate ou programmée ;
- date facultative de retrait de la sélection ;
- masquer/remettre en avant sans supprimer les accès déjà récoltés ;
- fichier, couverture, audio, vidéo, contenu texte, durée.

Les fichiers offerts utilisent le bucket public déjà utilisé par les recettes (post-media). Les fichiers de protocoles premium continuent d'utiliser leur système privé et leurs URLs signées : aucun mélange.

CACHED EGRESS
=============
Le V374 a été construit spécifiquement pour ne pas charger 50 ressources complètes à l'ouverture :

- 1 seule RPC compacte supplémentaire à l'ouverture du Carnet : library_offers_home().
- Elle renvoie uniquement les métadonnées des 6 offres récentes + les métadonnées légères des ressources déjà possédées.
- Aucun content_text complet, PDF, audio ou URL de fichier lourd dans cette lecture.
- Le contenu complet d'une ressource est récupéré UNIQUEMENT quand l'utilisateur appuie sur « Ouvrir » : library_offered_item(id).
- Les filtres font une requête seulement quand l'utilisateur les touche.
- « Voir toutes » = pagination 12 par 12.
- Aucun Realtime.
- L'admin charge une liste compacte ; le contenu complet n'est lu que lorsqu'on appuie sur Modifier.

SQL V374
========
Tables :
- library_offered_resources
- library_resource_claims

RPC :
- library_offers_home()
- library_offers_page(...)
- library_claim_offer(uuid)
- library_offered_item(uuid)

RLS :
- catalogue modifiable uniquement par l'admin ;
- claims consultables par leur propriétaire ;
- ajout d'une offre via RPC contrôlée ;
- aucune ouverture des protocoles payants.

FICHIERS MODIFIÉS
=================
admin.html
library.html
scripts/admin.js
scripts/v18-premium.js
styles/style.css
www/admin.html
www/library.html
www/scripts/admin.js
www/scripts/v18-premium.js
www/styles/style.css
supabase/V374_OFFERT_PAR_TEE_BIBLIOTHEQUE.sql

VALIDATIONS
===========
- node --check sur scripts/admin.js et scripts/v18-premium.js.
- copies root/www identiques.
- cache-busting V374 sur admin.html et library.html.
- aucun Realtime ajouté.
- aucun changement d'animation Jardin.
