# Méthode Tee — patch cumulatif Scanner + XP

Base exacte : `M-thode-TEE-wellness-main 395(2).zip`.
Préparé le 31 août 2026. Version iOS proposée : **1.1.1, build 44**.

Cette archive contient uniquement les fichiers modifiés ou ajoutés, à replacer aux mêmes chemins dans le dépôt. Ce n’est pas un ZIP complet de l’application. Ne supprime aucun autre fichier du projet.

## Installation — dans cet ordre

### 1. Supabase : un seul SQL complémentaire

Le rattrapage `CORRECTIF_XP_SUPABASE_20260830.sql`, révision compatible texte/UUID, doit déjà être installé. C’est celui qui a produit ton tableau de rattrapage des XP. Il est conservé et n’est pas à relancer pour ce patch.

Dans SQL Editor, ouvre une nouvelle requête et exécute **tout** le fichier de cette archive :

`supabase/CORRECTIF_XP_COMPLEMENT_20260830.sql`

Résultat attendu :

```text
controle                     : OK_XP_COMPLEMENT_INSTALLE
validations_atomiques         : true
etat_xp_quotidiens             : true
```

Le script est transactionnel et réexécutable. Il vérifie ses prérequis avant toute modification. Si une erreur apparaît, arrête-toi et conserve le message exact ; ne supprime pas les contrôles pour forcer l’installation. Ne lance pas tous les anciens SQL du dépôt.

Ce complément conserve les soldes globaux déjà rattrapés. Il aligne les compteurs propres à chaque protocole sur les événements identifiables de ce protocole. Les soldes historiques signalés `A_VERIFIER` ne sont pas effacés ni retirés automatiquement. Le compteur d’un protocole reste un sous-total : il n’a pas à être identique au total du Profil, qui comprend aussi les autres activités.

Aucune Edge Function n’est modifiée : aucune fonction d’envoi push ni clé APNs n’est à redéployer pour ce correctif.

### 2. GitHub : remplacer les fichiers en conservant les dossiers

Décompresse cette archive, puis ajoute son contenu à la racine du dépôt. Il faut conserver notamment les dossiers `scripts/`, `www/`, `ios/` et `supabase/` ; n’aplatis pas les dossiers et n’uploade pas seulement le ZIP.

Les copies web et `www/` sont synchronisées. Les références des pages vers les scripts modifiés portent une nouvelle version de cache. Les pages HTML du patch ne changent pas de disposition : leurs changements concernent ces références.

### 3. Sur le Mac : reconstruire l’application iOS

Récupère le dépôt mis à jour sur ton Mac. Si tu utilises un clone Git, vérifie tes changements locaux avec `git status`, puis utilise `git pull --ff-only` si le dossier est prêt. En cas de conflit, conserve tes changements et ne force pas une remise à zéro.

Ouvre Terminal **à la racine du projet**, là où se trouvent `package.json` et `capacitor.config.json`, puis :

```bash
node -v
```

Il faut Node **22 ou plus**, exigé par la version de Capacitor déjà utilisée dans ce projet. Si ta version est plus ancienne, mets Node à jour avant la suite.

```bash
npm ci
npx cap sync ios
npx cap open ios
```

Le fichier de verrouillage inclut maintenant le paquet Push Notifications déjà déclaré dans `package.json`. Les autres versions verrouillées ne sont pas renouvelées. Aucun `npm run build` n’est nécessaire pour ce projet statique : les fichiers de `www/` sont fournis dans le patch.

Dans Xcode :

1. Garde ta signature, ton équipe et tes capacités existantes.
2. Vérifie Version **1.1.1** et Build **44**. Si 44 a déjà été envoyé, choisis un numéro supérieur.
3. Lance d’abord l’application sur un **vrai iPhone** et effectue les tests ci-dessous.
4. Après validation, crée l’archive et envoie la nouvelle version dans App Store Connect.

Le scanner utilise du code natif Swift : un SQL ou un déploiement web ne remplace pas ce code dans l’application déjà installée. Il faut donc reconstruire et distribuer un nouveau binaire pour ce correctif caméra.

## Ce que le patch corrige

### Scanner

- Présentation et fermeture de l’écran caméra sur le thread principal.
- Configuration, démarrage et arrêt de la capture sur une seule file série.
- Vérification des types de codes-barres réellement disponibles avant leur activation.
- Une seule session de scan à la fois ; fermeture de la caméra avant le retour au Carnet.
- Gestion des permissions refusées, des erreurs de capture, de l’annulation et du retour d’arrière-plan.
- Accès à « Saisir le code-barres » depuis le scanner ; repli sur la saisie en cas d’échec contrôlé.
- Le navigateur web ne propose pas un faux scanner natif simplement parce qu’un proxy JavaScript existe.

La déclaration `NSCameraUsageDescription` était déjà présente dans le ZIP. Le code vérifie aussi sa présence avant d’ouvrir la caméra. Aucune permission microphone n’est ajoutée. Le flux vidéo n’est ni enregistré ni envoyé à Supabase.

La saisie manuelle, les résultats nutritionnels partiels, les portions de l’emballage et les unités g/ml restent dans le parcours existant.

Ces corrections traitent des risques constatés dans le code ; faute de rapport de crash de l’iPhone, elles ne prouvent pas à elles seules la cause exacte de la fermeture observée. La validation sur appareil reste indispensable.

### Protocoles et Profil

- La validation d’une journée ou d’un contenu passe par une action serveur atomique. Le bouton ne confirme plus une réussite sur la seule base d’une copie locale.
- L’erreur d’identifiant de protocole est supprimée.
- Les gains affichés viennent du serveur et du barème du contenu, pas d’un forfait local supposé de 5 XP.
- Deux validations identiques ne produisent pas deux crédits. Une journée et un contenu enregistrés en parallèle ne remplacent plus leurs tableaux respectifs.
- En cas d’échec, le bouton redevient utilisable. Si une réponse réseau se perd après l’enregistrement serveur, une nouvelle tentative ne recrédite pas l’action.
- La dernière date de validation reste renseignée pour « Continuer mon parcours ».
- Le Profil actualise son total depuis Supabase. Une réponse ancienne ne remplace pas une réponse plus récente déjà confirmée.
- Une lecture indisponible affiche un état de réessai ou le dernier total connu explicitement signalé, pas un faux zéro.
- Les XP propres au protocole, le total du Profil et les récoltes utilisent les données créditées. Les animations de niveau utilisent les icônes existantes.

Les anciens clients restent compatibles avec les RPC et le trigger de rattrapage déjà installés. Ils ne bénéficient toutefois des améliorations d’affichage et de gestion des erreurs qu’après leur mise à jour.

### Notre journée ensemble et XP quotidiens

- Le bonus collectif tient compte uniquement des rendez-vous actifs, publiés/programmés et validables. Une carte informative ou un brouillon ne bloque plus ce bonus.
- Le dernier geste collectif enregistré déclenche le contrôle du bonus côté serveur, même si l’ancien client manque son second appel d’attribution.
- Une réponse « 0 XP car pas encore éligible » ne bloque plus toute nouvelle tentative pour la journée.
- Une réponse « 0 XP car déjà attribué » confirme le crédit existant et permet d’actualiser le Profil sans doublon.
- Les tentatives quotidiennes interrompues peuvent être reprises à la réouverture ou au retour du réseau, avec une file locale bornée, sans interrogation périodique.

Le barème journal/hydratation/suivi personnel n’est pas changé. Le patch ne recrédite pas en masse toutes les anciennes journées collectives et ne modifie pas les missions définies dans l’admin.

### Transferts et cache

Les lectures simultanées du Profil sont regroupées ; seule une petite sélection de champs est demandée. La validation des contenus ne recharge pas tout le catalogue ni les médias. Aucun polling, préchargement massif ou abonnement Realtime n’est ajouté. Cela limite les transferts ajoutés, sans constituer une mesure de consommation réelle ni une garantie de quota.

## Tests à faire avant soumission

Utilise un compte de test : une vraie validation crédite réellement des XP.

### Caméra — iPhone physique

1. Carnet → Ma journée alimentaire → Ajouter un repas → Scanner un produit → Appareil photo. Vérifie l’affichage du flux caméra sans fermeture de l’app.
2. Au premier accès, accepte la permission ; recommence ensuite avec la permission déjà accordée.
3. Scanne un produit à code EAN connu : un seul produit doit être ajouté. Vérifie aussi une portion et une boisson en ml lorsque l’étiquette les fournit.
4. Ferme le scanner, puis rouvre-le plusieurs fois. Essaie aussi deux pressions rapides.
5. Passe l’app en arrière-plan pendant le scan, puis reviens.
6. Refuse la permission caméra dans les réglages iOS, puis réessaie : un message et la saisie manuelle doivent rester disponibles, sans fermer l’app.
7. Teste le bouton de saisie manuelle du scanner et la saisie proposée dans le choix initial.
8. Vérifie que « Prendre / choisir une photo » du repas fonctionne encore.

Si un crash subsiste, récupère son rapport dans Xcode (Devices and Simulators / journaux de l’app) avant la soumission. La capture de l’écran précédent ne donne pas la cause native du crash.

### XP — protocole gratuit et protocole payant déjà débloqué

1. Note le total du Profil. Termine un contenu dont le barème admin est connu : son gain doit correspondre au barème serveur et être présent dans le total global.
2. Valide une journée : +10 XP hors bonus de série ou de fin. Rouvre le Profil puis relance l’app : le total doit rester cohérent.
3. Une seconde validation de la même action ne doit rien ajouter.
4. Coupe le réseau avant une validation : aucune confirmation trompeuse. Rétablis-le puis réessaie.
5. Ouvre le Profil hors ligne : dernier total connu signalé, ou état indisponible. Le bouton Réessayer doit retrouver le total après reconnexion.
6. Sur une journée collective de test comportant un rendez-vous validable et une carte informative, termine le rendez-vous : la carte informative ne doit pas empêcher le bonus.
7. Vérifie « Continuer mon parcours », les récoltes et les changements de niveau.

## Vérifications réalisées et limites

- Exécution locale des migrations et de leurs réexécutions sur PostgreSQL via PGlite, sur sept variantes d’identifiants (UUID, texte, VARCHAR, slugs et anciennes RPC absentes) : 40 à 42 contrôles par variante, réussis.
- Contrôles JavaScript avec services simulés : cache, réponses tardives, session, erreur/réessai, double validation, contenu à 10 XP, bonus quotidien et repli caméra. Ils ne remplacent pas des essais réseau réels.
- Vérification de syntaxe des scripts et comparaison des copies racine/`www/`.
- Vérification du différentiel avec le ZIP source : seuls les fichiers de ce patch sont remplacés ou ajoutés.

Non réalisés ici : compilation avec Xcode/SDK iOS, scan réel, tests TestFlight et validation visuelle sur téléphone. L’essai graphique automatisé n’a pas pu être lancé faute de navigateur disponible dans l’environnement. Aucune modification n’a été exécutée dans ton Supabase de production ni publiée sur GitHub ou App Store Connect.

## Références techniques

La présentation d’une interface depuis un plugin iOS est effectuée sur la file principale, comme dans l’exemple officiel [Capacitor — iOS API](https://capacitorjs.com/docs/core-apis/ios).

Le cycle de capture est sérialisé conformément aux contraintes de [AVCaptureSession](https://developer.apple.com/documentation/avfoundation/avcapturesession). Les types activés sont filtrés à partir de [availableMetadataObjectTypes](https://developer.apple.com/documentation/avfoundation/avcapturemetadataoutput/availablemetadataobjecttypes), avant d’affecter [metadataObjectTypes](https://developer.apple.com/documentation/avfoundation/avcapturemetadataoutput/metadataobjecttypes).
