PATCH V373 — FEED / PUBLICATIONS OPTIMISÉ

Base : M-thode-TEE-wellness-main 347.zip

CONTRAINTES RESPECTÉES
- Le compteur brut du Feed est conservé visuellement tel quel.
- Aucun bloc « Relier cette publication à… » n’a été créé.
- Aucun lien automatique vers protocoles / PDF / contenus premium.
- Aucune animation du Feed ou du reste de l’app n’a été modifiée.

1) PAGINATION RÉELLE 5 PAR 5
Avant :
- l’accueil téléchargeait jusqu’à 40 posts complets ;
- seuls 5 étaient affichés ;
- « voir plus » ne faisait qu’afficher des données déjà téléchargées.

V373 :
- ouverture = 5 posts seulement ;
- le compteur brut garde le vrai nombre total de publications ;
- « Voir plus de publications » demande les 5 suivantes à Supabase ;
- puis 5 suivantes, etc.
- la mise en avant temporaire est respectée par l’ordre serveur.

2) PLUS DE DOUBLE/TRIPLE CHARGEMENT LOURD
Avant :
- Feed : jusqu’à 40 posts complets ;
- Capsules du jour : jusqu’à 40 posts complets ;
- Échos du journal : jusqu’à 30 posts complets.

V373 :
- Feed = 5 posts complets par page ;
- Capsules + Échos partagent UNE seule requête légère ;
- cette requête ne télécharge aucun média ;
- elle limite le texte à un extrait serveur ;
- si un signal pointe vers un post plus ancien que les 5 affichés,
  le post complet n’est récupéré qu’au clic.

3) WORDING
Le bouton après les 5 premières cartes ne dit plus :
- « Journal privé »
- « Continuer le journal »

Il affiche :
- « Le fil Méthode Tee »
- « Voir plus de publications »

Le compteur brut au-dessus n’est PAS modifié.

4) CATÉGORIES ADMIN PLUS LISIBLES
Catégories éditoriales mises en avant :
- Nutrition
- Pharmacopée
- Bien-être
- Mouvement
- Mindset
- Recette
- Méthode TEE
- Conseil du jour

Les catégories nécessaires aux Capsules restent disponibles :
- Hydratation
- Fuel du jour
- Sweet switch

Les anciennes catégories restent également disponibles pour ne casser aucun post existant.

5) PUBLICATION PROGRAMMÉE
Dans l’admin :
- champ « Programmer la publication »
- vide = immédiatement
- date future = invisible avant l’heure choisie
- devient visible automatiquement à l’heure prévue

La date affichée dans le Feed est la date réelle de publication,
pas la date à laquelle le brouillon a été créé.

6) MISE EN AVANT
Nouvelle option :
- « Mettre en avant en première position »
- possibilité de choisir une date de fin
- sans date : 3 jours automatiquement
- une mise en avant expirée cesse automatiquement de remonter en tête

7) NOTIFICATION PUSH FACULTATIVE
Nouvelle case admin :
- « Envoyer une notification à la publication »
- cochée par défaut pour conserver le comportement historique
- tu peux la décocher pour publier silencieusement

Publication immédiate :
- push envoyé immédiatement si la case est cochée.

Publication programmée :
- push envoyé automatiquement dans les minutes qui suivent l’heure prévue.
- dispatcher SQL toutes les 5 minutes.
- aucun appel réseau n’est effectué par le dispatcher quand aucun post n’est dû.

8) SUPABASE / CACHED EGRESS
- RPC feed_posts_page : 5 cartes + total dans la même réponse
- RPC feed_support_posts : petit lot texte partagé Capsules / Échos
- index de publication
- RLS empêche les posts programmés d’être visibles avant l’heure prévue
- aucun Realtime

SQL
Exécuter AVANT de tester :
supabase/V373_FEED_PUBLICATIONS_OPTIMISE.sql

FICHIERS PRINCIPAUX MODIFIÉS
- scripts/app.js + www/
- scripts/v14-luxe.js + www/
- scripts/v18-premium.js + www/
- scripts/admin.js + www/
- admin.html + www/
- pages HTML nécessaires au cache-busting
