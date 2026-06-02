MÉTHODE TEE — V12 UNIVERS + ADMIN COMPLET

Cette version s’inspire du fonctionnement Nysscious, mais tout est adapté à Méthode Tee :
- nutrition
- plantes
- bien-être
- fil d’actualité privé
- protocoles payants
- contenus téléchargeables
- Supabase
- Stripe Payment Links
- admin complet

CE QUE TU PEUX FAIRE DEPUIS ADMIN.HTML

1. Poster sur l’accueil comme un fil d’actualité :
- conseils
- recettes
- routines
- mindset
- challenges
- contenu privé
- photos
- vidéos
- jusqu’à 4 médias par post

2. Créer / renommer les pages :
- changer les titres
- changer les emojis
- créer de nouvelles pages
- choisir l’ordre d’affichage
- créer des pages libres

3. Ajouter des rubriques dans les pages :
- texte éditorial
- cartes / mini rubriques
- fil de posts interne via JSON

4. Créer des protocoles payants :
- titre
- prix
- durée
- image
- description
- catégorie
- lien Stripe Payment Link

5. Ajouter les contenus dans chaque protocole :
- PDF
- vidéos
- checklists
- calendrier
- tracker
- routines
- playlist
- liens ou fichiers uploadés

6. Débloquer l’accès général à 5€ :
- après paiement Stripe Payment Link
- tu entres l’email client
- l’accès au fil privé est activé

IMPORTANT STRIPE
Cette version reste sans Netlify.
Donc :
- le paiement se fait via Stripe Payment Links
- le déblocage automatique n’est pas encore inclus
- tu débloques l’accès manuellement depuis admin/Supabase

UPLOAD
1. Remplace tout ton repo GitHub par ce ZIP.
2. Supabase > SQL Editor > colle et exécute :
   supabase/SUPABASE_SQL_V12_UNIVERSE.sql
3. Va sur /admin.html
4. Connecte-toi avec teayannaparis@gmail.com
5. Code admin : OUTITA

EXEMPLES JSON POUR RUBRIQUES

Type texte :
{"text":"Ton texte ici"}

Type cartes :
{"items":[{"emoji":"🌿","title":"Digestion","text":"Conseils et plantes du terrain."}]}

Type feed interne :
{"items":[{"title":"Recette ventre léger","text":"Ton contenu...","type":"Recette","media_urls":["https://..."]}]}
