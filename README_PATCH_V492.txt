PATCH V492 — LECTEUR PDF PREMIUM GLOBAL · BIBLIOTHÈQUE + PROTOCOLES
Base exacte : M-thode-TEE-wellness-main 223.zip
Cumulatif : inclut le correctif V491 « Offert par Tee ».

Périmètre strict : AFFICHAGE uniquement.
- applique le même cadrage PDF mobile aux ressources Offert par Tee ET aux contenus de protocoles ;
- couvre les types PDF premium, Fichier téléchargeable, Ebook, Document privé et tout PDF joint rendu dans le viewer ;
- couvre aussi les PDF joints aux Guides terrain et aux Recettes via le rendu éditorial premium ;
- ouverture demandée en largeur de page (FitH / page-width) ;
- conteneur verrouillé en largeur et scroll horizontal limité sur iPhone/Safari ;
- ajoute un repère de lecture au-dessus de chaque PDF : « X pages » si le nombre est renseigné, sinon « Document PDF » / libellé du type ;
- affiche « Fais défiler verticalement pour parcourir le document » ;
- les images simples restent inchangées ;
- les fichiers non PDF restent inchangés.

Fichiers fonctionnels modifiés :
- scripts/v18-premium.js
- styles/style.css
- www/scripts/v18-premium.js
- www/styles/style.css

Cache-buster uniquement (aucune logique métier modifiée) :
- library.html / www/library.html
- protocol-journey.html / www/protocol-journey.html
- protocol.html / www/protocol.html
- protocols.html / www/protocols.html
- dashboard.html / www/dashboard.html
- index.html / www/index.html
- page.html / www/page.html

NON MODIFIÉ :
- aucun SQL / Supabase ;
- aucun paiement Stripe ;
- aucun Apple IAP ;
- aucun Product ID ;
- aucun déblocage de protocole ;
- aucune règle des 7 h ;
- aucune progression de protocole ;
- aucun contenu de protocole en base ;
- aucun admin ;
- aucun Feed ;
- aucune logique d'achat, d'accès ou de droits.
