# Patch 329 final — Pré‑Apple cumulatif

Base attendue : `M-thode-TEE-wellness-main 328.zip`.

Ce correctif **remplace le précédent patch 329 non uploadé**. Il contient uniquement les fichiers à remplacer ou à ajouter, en conservant leur arborescence à la racine du dépôt. Les copies présentes dans `www/` sont volontaires afin que la version préparée pour Capacitor/Xcode reste identique à la version web.

## Ajout final intégré

- une seule priorité quotidienne dans **Mon Équilibre** lorsque les données réellement renseignées suffisent ;
- aucun conseil si la journée est vide ou si le seul repère disponible est une projection automatique du cycle ;
- un bloc **Pourquoi cette suggestion ?** qui explique la lecture sans revendiquer de causalité médicale ;
- les **repères utilisés** sont affichés explicitement et limités aux données effectivement présentes ;
- le choix **Cette lecture ne me correspond pas** masque la lecture uniquement pour la journée en cours ;
- aucun apprentissage automatique n’est affirmé et aucune donnée supplémentaire n’est envoyée ;
- aucune nouvelle requête Supabase n’est ajoutée : la fonction réutilise le résumé quotidien compact déjà chargé.

## Correctifs cumulatifs inclus

- suppression du clignotement `—` / faux `0 %` : les trois anneaux apparaissent ensemble une fois les vraies données prêtes ;
- formulaires de suivis contextualisés, champs facultatifs et suppression des faux scores préremplis à `5/10` ou `7/10` ;
- synchronisation des suivis avec le résumé quotidien, le calendrier et Mon Équilibre ;
- activité physique plus inclusive (Pilates, yoga, fitness, marche, mobilité, etc.) et niveaux moins orientés sport professionnel ;
- ménopause, cycle, nutrition et ressentis formulés sans supposer un symptôme ni un diagnostic ;
- repas vides refusés et ressentis alimentaires réellement facultatifs ;
- suppression de compte renforcée : médias privés Supabase supprimés, données locales/IndexedDB effacées à la déconnexion et à la suppression ;
- confirmation d’e-mail d’inscription mieux gérée et mots de passe portés à 8 caractères minimum ;
- retrait des catégories, cartes et signaux fictifs ou vides ;
- préchargement allégé pour réduire le Cached Egress et les requêtes inutiles ;
- zoom/accessibilité rétabli et informations de confidentialité complétées ;
- descriptions iOS d’accès à l’appareil photo et à la photothèque ajoutées.

HealthKit, le profil alimentaire complet, l’export avancé et l’apprentissage des préférences ne sont pas ajoutés par ce patch.

## Fonction Supabase

Le bon chemin ajouté est `supabase/functions/delete-account/index.ts`.

L’ancien dossier mal nommé `supabase/functions/    delete-account/` (avec des espaces au début) peut être supprimé du dépôt après vérification du nouveau chemin. Il n’est pas inclus dans ce patch.

## Vérifications effectuées

- syntaxe JavaScript des sources et de leurs copies `www` ;
- validité du fichier `Info.plist` ;
- identité des fichiers web et `www` concernés ;
- absence de blocage du zoom ;
- présence des connexions suivis → résumé du jour → calendrier → Mon Équilibre ;
- absence de valeurs de ressenti inventées quand aucun choix n’a été fait ;
- tests ciblés : journée vide, cycle projeté seul, hydratation, énergie et repas ;
- absence de nouvelle lecture réseau pour la priorité quotidienne.
