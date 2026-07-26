# Méthode Tee — Cahier des modifications validées pour « Notre journée ensemble »

## 1. Rôle de ce document

Ce fichier constitue la référence de travail officielle pour la création de l’**Immersion Méthode Tee**, affichée côté utilisateur sous le nom :

> **Notre journée ensemble**

Il doit permettre à une autre discussion ChatGPT, à un développeur ou à un outil de modification de comprendre immédiatement :

- la vision exacte de l’accompagnement quotidien souhaité ;
- l’emplacement retenu dans l’accueil ;
- les éléments existants à conserver ;
- la nouvelle logique de données à créer ;
- le fonctionnement du bloc fermé sur l’accueil ;
- le fonctionnement du détail après le clic ;
- les règles de personnalisation depuis l’administration ;
- les contraintes visuelles et techniques à ne pas dépasser ;
- les éléments qui ne doivent surtout pas être modifiés.

L’objectif n’est pas d’ajouter un nouveau protocole ni un nouveau fil de publications. Il faut transformer le bloc actuel **« Échos du journal »** en un véritable chef d’orchestre de la journée collective, sans alourdir l’accueil et sans casser les fonctions existantes.

---

## 2. Vision générale

L’Immersion Méthode Tee doit créer un accompagnement quotidien très poussé, vivant et collectif.

L’utilisatrice ne doit plus avoir l’impression d’ouvrir uniquement une application contenant des articles, recettes, plantes ou protocoles. Elle doit ressentir que Tee et toute la communauté avancent ensemble au fil de la journée.

Exemples d’expériences possibles :

- « Voici la plante que nous allons consommer aujourd’hui. »
- « Préparons ensemble notre infusion à 18 h. »
- « Préparons maintenant notre collation de secours pour ce soir et pour plusieurs jours. »
- « Tu as faim ce soir ? Ne réagis pas automatiquement. Faisons le point ensemble. »
- « Ajoutons tous une vraie source de protéines à notre prochain repas. »
- « Fermons la journée sans chercher la perfection. »

Le sentiment recherché est :

> **Je ne suis pas seule. Toute la communauté Méthode Tee avance sur les mêmes gestes aujourd’hui.**

Cette Immersion est collective et continue. Elle ne remplace pas les protocoles individuels. Une utilisatrice peut suivre son propre protocole tout en participant aux rendez-vous communs de la journée.

---

## 3. Décision structurelle principale

### 3.1 Ne pas ajouter un nouveau bloc

Ne pas créer une nouvelle grande section entre les capsules et le bloc actuel.

Le bloc existant **« Échos du journal »** doit être réutilisé.

Son design, son emplacement et sa taille générale sont déjà adaptés.

### 3.2 Emplacement conservé

L’ordre de l’accueil doit rester :

1. Grande carte **Aujourd’hui** ;
2. Capsules **Hydratation / Fuel du jour / Mouvement / Sweet Switch** ;
3. Bloc transformé en **Notre journée ensemble** ;
4. Fil des publications.

### 3.3 Ne pas toucher aux autres fonctions

Ne pas détourner les fonctions actuelles des autres blocs :

- la grande carte **Aujourd’hui** reste l’espace personnel de l’utilisatrice ;
- les quatre capsules restent des raccourcis thématiques ;
- le fil reste le réservoir des publications complètes ;
- l’Immersion devient le système collectif quotidien.

---

## 4. Nom visible côté utilisateur

Le nom principal visible ne doit pas être « Immersion Méthode Tee » dans l’expérience quotidienne.

Utiliser :

> **Notre journée ensemble**

Le mot **Immersion** peut rester utilisé :

- dans l’administration ;
- dans les noms techniques ;
- dans la documentation ;
- dans la communication marketing si nécessaire.

Mais dans l’application, l’expérience doit rester humaine et naturelle.

### En-tête du bloc d’accueil

Surtitre possible à conserver :

> **ÉCHOS DU JOURNAL**

Titre :

> **Notre journée ensemble ✨**

Sous-titre :

> **Les rendez-vous de la communauté au rythme de ta journée.**

Badge à droite :

> **AUJOURD’HUI**

---

## 5. Contraintes visuelles à respecter

### 5.1 Conserver l’identité actuelle

Le bloc doit conserver le langage graphique actuel :

- fond crème ou blanc cassé ;
- bordures très légères ;
- coins arrondis ;
- ombres discrètes ;
- typographies actuelles ;
- texte vert profond ;
- touches dorées ;
- mêmes espacements généraux ;
- même cohérence avec les autres cartes de l’accueil.

### 5.2 Interdiction d’un grand bloc vert

Ne pas créer un fond vert foncé pour le bloc fermé ni pour la page ouverte.

Après le clic, l’utilisatrice doit avoir l’impression d’ouvrir le prolongement naturel du bloc actuel, pas d’entrer dans un autre module ou une autre application.

### 5.3 Ne pas augmenter la hauteur du bloc d’accueil

Le bloc fermé doit garder **pratiquement la même taille qu’aujourd’hui**.

Il doit conserver :

- une grille en 2 colonnes ;
- 2 lignes ;
- 4 cartes maximum visibles ;
- les pills en bas ;
- une zone de progression compacte.

Ne pas afficher de longs paragraphes dans les cartes.

---

## 6. Nouvelle source de données dédiée

Le bloc ne doit plus récupérer automatiquement les derniers posts selon les catégories « Routine active », « Conseil privé », « Drop exclusif » ou « Mood calme ».

Créer une source de données dédiée aux rendez-vous quotidiens.

Nom technique recommandé :

```text
daily_immersion_items
```

Une autre appellation est possible, mais elle doit clairement correspondre aux rendez-vous de l’Immersion.

### 6.1 Champs nécessaires pour chaque rendez-vous

Chaque rendez-vous doit pouvoir contenir :

- `id` ;
- `date` ;
- `time_slot` : tranche de journée prédéfinie ;
- `scheduled_time` : heure exacte libre ;
- `title` : titre principal ;
- `short_text` : texte très court affiché sur l’accueil ;
- `linked_post_id` : publication liée, facultative ;
- `linked_type` : type de destination, si nécessaire ;
- `display_order` : ordre d’affichage ;
- `show_on_home` : afficher ou non parmi les 4 cartes de l’accueil ;
- `validation_enabled` : validation activée ou non ;
- `validation_label` : texte personnalisé du bouton ;
- `status` : brouillon, programmé, publié, archivé ;
- `notification_enabled` ;
- `notification_time` ;
- `notification_title` ;
- `notification_body` ;
- `icon` ou `icon_type` ;
- `is_active` si nécessaire ;
- `created_at` ;
- `updated_at`.

### 6.2 Données de progression par utilisatrice

Créer une table séparée pour enregistrer les validations individuelles.

Nom recommandé :

```text
user_immersion_progress
```

Champs possibles :

- `id` ;
- `user_id` ;
- `immersion_item_id` ;
- `completed` ;
- `completed_at` ;
- `date` ;
- `created_at` ;
- `updated_at`.

La progression doit être liée au compte connecté, pas seulement au stockage local.

Un fallback local peut exister pour l’instant, mais Supabase doit rester la source principale afin que la progression soit conservée entre les appareils.

---

## 7. Les 6 tranches de journée prédéfinies

Ne jamais imposer des horaires fixes comme 8 h, 12 h, 16 h ou 18 h.

Créer 6 repères éditoriaux :

1. **Au réveil**
2. **Dans la matinée**
3. **Autour du déjeuner**
4. **Dans l’après-midi**
5. **Dans la soirée**
6. **Avant de dormir**

Ces tranches servent à organiser la journée, mais l’heure exacte reste libre dans l’administration.

Exemple :

| Tranche | Heure choisie | Contenu |
|---|---:|---|
| Au réveil | 10 h 15 | Hydratation douce |
| Dans la matinée | 11 h 30 | Plante du matin |
| Autour du déjeuner | 13 h 30 | Réflexe protéines |
| Dans l’après-midi | 17 h 30 | Préparation collective |
| Dans la soirée | 21 h 30 | Gestion de la fringale |
| Avant de dormir | 23 h 00 | Bilan du soir |

### Règles importantes

- Une tranche peut être vide.
- La plante peut être programmée le matin.
- La collation peut être programmée en fin d’après-midi ou le soir.
- Le dernier rendez-vous peut être à 21 h 30, 23 h ou une autre heure.
- L’administration ne doit jamais forcer Tee à respecter une heure standard.
- Les horaires doivent s’adapter à la réalité de la journée, aux vacances et au rythme de la communauté.

---

## 8. Fonctionnement du bloc fermé sur l’accueil

### 8.1 Grille 2 × 2 obligatoire

Le bloc fermé doit continuer à afficher exactement 4 cartes maximum, disposées en :

- 2 colonnes ;
- 2 lignes.

Même si 5 ou 6 rendez-vous existent dans la journée, seulement 4 sont visibles sur l’accueil.

### 8.2 Sélection des 4 cartes

Dans l’administration, chaque rendez-vous possède :

```text
Afficher sur l’accueil : Oui / Non
```

Tee choisit manuellement les 4 rendez-vous mis en avant.

Si plus de 4 rendez-vous sont marqués « Oui », l’interface admin doit afficher un avertissement ou empêcher l’enregistrement afin de protéger le rendu.

### 8.3 Contenu visible dans chaque carte

Chaque carte doit afficher uniquement :

- l’icône ;
- l’heure ;
- un petit repère de moment, si souhaité ;
- le titre ;
- le texte très court ;
- un statut visuel compact.

Exemple :

```text
10 H 30
PLANTE DU MATIN
Infusion de romarin
✓ Terminé
```

Autre exemple :

```text
21 H 30
RENDEZ-VOUS DU SOIR
On gère la fringale
À venir
```

### 8.4 Limites de texte

Pour préserver la taille actuelle :

- heure : une ligne ;
- titre : maximum 2 lignes ;
- texte court : 1 ligne, éventuellement tronquée avec `…` ;
- statut : petit label ou point ;
- aucun paragraphe complet ;
- aucun gros bouton dans la carte.

L’administration doit idéalement afficher :

- un compteur de caractères ;
- un aperçu mobile ;
- un avertissement si le texte dépasse.

### 8.5 Statuts visuels

Prévoir au minimum :

- **Terminé** : coche discrète, fond très léger ;
- **À faire** : accent doré ;
- **À venir** : ton crème ou beige ;
- **Indisponible** si nécessaire ;
- **Aucun rendez-vous** uniquement sur la page détaillée, jamais dans les 4 cartes principales de l’accueil.

---

## 9. Zone communautaire et progression dans le bloc fermé

Sous la grille 2 × 2, ajouter une zone compacte avec :

### À gauche

> **382 membres avancent avec toi**

Le chiffre doit être dynamique.

### À droite

Une petite jauge horizontale avec :

> **2 / 6 gestes réalisés**

La jauge doit rester discrète et reprendre les couleurs actuelles :

- fond beige clair ;
- progression vert profond et/ou doré ;
- aucun grand aplat coloré.

### Calcul de progression

Le dénominateur doit correspondre au nombre de rendez-vous réellement prévus ce jour-là.

Exemples :

- 2 rendez-vous sur 6 prévus : `2 / 6` ;
- 3 rendez-vous sur 5 prévus : `3 / 5` ;
- ne pas afficher `2 / 6` si seulement 4 rendez-vous sont réellement prévus.

Les tranches vides ne doivent pas compter comme un geste à réaliser.

---

## 10. Les pills sous le bloc

Conserver la présence des pills sous la zone de progression.

Elles participent fortement au rendu validé et donnent une sensation de routine vivante.

Elles peuvent servir de raccourcis ou de validations rapides.

Exemples :

- **Eau du matin** ;
- **Assiette complète** ;
- **Collation prête** ;
- **Plante prise** ;
- **Bilan du soir**.

### Règles

- Les pills doivent rester compactes.
- Elles peuvent se répartir sur plusieurs lignes selon la largeur.
- Une pill terminée affiche une coche.
- Une pill à venir conserve un cercle discret ou un état neutre.
- Les libellés doivent être personnalisables dans l’administration.
- Le nombre de pills peut correspondre aux rendez-vous de la journée, mais il faut éviter de surcharger le bloc.
- Si 6 pills ne tiennent pas proprement, prévoir un défilement horizontal doux ou afficher uniquement les plus importantes.

Ne pas supprimer les pills au profit d’une grosse timeline sur l’accueil.

---

## 11. Interaction au clic sur le bloc

Le clic sur le bloc doit ouvrir le détail complet de la journée.

Deux implémentations sont acceptables :

1. une page dédiée ;
2. une grande feuille coulissante ou modal plein écran cohérente avec l’application.

Préférence : une page ou une feuille plein écran qui conserve la navigation naturelle et le style actuel.

### Titre de la vue ouverte

> **Notre journée ensemble**

Sous-titre :

> **Les rendez-vous de la communauté au rythme de ta journée.**

Ne pas afficher une grande page verte.

---

## 12. Jauge détaillée après ouverture

La grande jauge des 6 tranches apparaît uniquement après le clic.

Elle ne doit pas être affichée en entier sur l’accueil.

### Les 6 repères

- Réveil ;
- Matin ;
- Déjeuner ;
- Après-midi ;
- Soir ;
- Nuit.

### États possibles

- `✓` terminé ;
- point ou accent doré : étape actuelle ;
- cercle vide : à venir ;
- tiret ou état estompé : aucune activité prévue dans cette tranche.

### Couleurs

- ligne beige très claire ;
- point actuel doré ;
- étape validée vert profond discret ;
- étape future gris-beige ;
- pas de fond vert global.

Sous la jauge, répéter la zone :

- **382 membres avancent avec toi** ;
- **2 / 6 gestes réalisés** ;
- petite barre de progression.

---

## 13. Liste complète des rendez-vous après ouverture

Sous la jauge, afficher tous les rendez-vous du jour, y compris ceux qui ne sont pas visibles dans les 4 cartes de l’accueil.

Chaque rendez-vous doit apparaître dans une carte cohérente avec le design actuel.

Exemple :

```text
10 H 30
Plante du matin
Infusion de romarin
✓ Terminé
```

```text
13 H 30
Réflexe déjeuner
Ajoute une vraie source de protéines
✓ Terminé
```

```text
18 H 00
Préparation collective
Préparons la collation de la semaine
À faire
```

```text
21 H 30
Rendez-vous du soir
On gère ensemble la fringale
À venir
```

```text
23 H 00
Bilan du soir
Fermons la journée sans chercher la perfection
À venir
```

### Tranche vide

Si une tranche ne contient rien :

- soit ne pas afficher de carte ;
- soit afficher un petit repère très discret « Moment libre » uniquement dans la jauge ou la page complète.

Ne pas utiliser une grande carte vide qui allonge inutilement la page.

---

## 14. Validation des rendez-vous

Chaque rendez-vous peut avoir ou non une validation.

### Paramètres administrables

- validation activée : Oui / Non ;
- texte du bouton ;
- validation directe ou après ouverture du contenu ;
- possibilité de modifier le statut manuellement si nécessaire.

### Exemples de textes

- **J’ai bu mon eau** ;
- **Je l’ai préparée** ;
- **Ma collation est prête** ;
- **J’ai ajouté ma protéine** ;
- **Terminé** ;
- **Je clôture ma journée**.

### Comportement

- la validation met à jour la progression ;
- le compteur passe automatiquement de `2 / 6` à `3 / 6` ;
- la jauge se met à jour ;
- la carte et la pill changent d’état ;
- la validation reste liée au compte ;
- elle reste conservée après fermeture et réouverture de l’application.

---

## 15. Publications liées

Chaque rendez-vous peut être relié à une publication existante du fil.

Exemple :

- carte : **18 h — Plante du soir** ;
- publication liée : **Préparons notre infusion de mélisse**.

Au clic sur le rendez-vous :

- ouvrir directement la publication concernée ;
- ou afficher d’abord un aperçu, puis un bouton vers la publication.

Le but est d’éviter de dupliquer les contenus.

Le bloc organise la journée ; le fil contient le contenu complet.

### Destination possible

Prévoir la possibilité de lier un rendez-vous à :

- une publication ;
- une recette ;
- une plante ;
- un audio ;
- une page ;
- un protocole ;
- une URL interne ;
- aucun contenu, si le rendez-vous est uniquement une action rapide.

---

## 16. Notifications

Chaque rendez-vous peut envoyer une notification facultative.

### Champs administrables

- notification activée : Oui / Non ;
- heure d’envoi ;
- titre ;
- message ;
- destination au clic.

### Exemples

Titre :

> **Notre rendez-vous du soir 🌙**

Message :

> **Tu as faim ? Faisons le point ensemble avant de choisir.**

Ou :

Titre :

> **La communauté prépare sa mélisse 🌿**

Message :

> **Retrouve-nous maintenant pour l’infusion du jour.**

### Règles

- la notification ne doit pas être obligatoire ;
- elle doit respecter l’heure exacte définie par Tee ;
- elle doit ouvrir directement le bon rendez-vous ou son contenu lié ;
- ne pas envoyer une notification pour un rendez-vous en brouillon ou archivé ;
- éviter les doublons si un rendez-vous est modifié.

---

## 17. Administration complète

Créer une rubrique dédiée dans l’admin, par exemple :

> **Immersion / Notre journée ensemble**

### 17.1 Vue liste

Afficher les journées programmées avec :

- date ;
- nombre de rendez-vous ;
- nombre visible sur l’accueil ;
- statut ;
- notifications actives ;
- bouton modifier ;
- bouton dupliquer ;
- bouton archiver.

### 17.2 Vue édition d’une journée

Afficher les 6 tranches dans l’ordre :

1. Au réveil ;
2. Dans la matinée ;
3. Autour du déjeuner ;
4. Dans l’après-midi ;
5. Dans la soirée ;
6. Avant de dormir.

Pour chaque tranche, permettre :

- d’ajouter un rendez-vous ;
- de laisser la tranche vide ;
- de choisir l’heure exacte ;
- de choisir l’icône ;
- de saisir le titre ;
- de saisir le texte court ;
- de relier un contenu ;
- de définir l’ordre ;
- de choisir si la carte apparaît sur l’accueil ;
- d’activer la validation ;
- de personnaliser le bouton ;
- d’activer la notification ;
- de personnaliser la notification ;
- de définir le statut.

### 17.3 Aperçu mobile

Ajouter un aperçu fidèle du bloc d’accueil en 2 × 2.

L’aperçu doit permettre de vérifier :

- les 4 cartes sélectionnées ;
- le dépassement des textes ;
- la répartition des pills ;
- la progression ;
- la cohérence visuelle.

### 17.4 Duplication

Pouvoir dupliquer :

- une journée complète ;
- un rendez-vous ;
- une semaine type si possible.

Cela permettra de préparer plusieurs jours sans tout recréer.

---

## 18. Compteur de membres

Le texte validé est :

> **382 membres avancent avec toi**

Le nombre doit être dynamique.

### Recommandation de calcul

Le compteur peut correspondre au nombre d’utilisatrices ayant :

- ouvert l’Immersion du jour ;
- ou validé au moins un rendez-vous ;
- ou participé à la journée selon une règle claire.

La règle exacte doit être définie une seule fois et rester cohérente.

Ne pas afficher un faux chiffre généré aléatoirement.

Si le vrai compteur n’est pas encore disponible au lancement, utiliser temporairement un libellé sans chiffre :

> **La communauté avance avec toi aujourd’hui**

Mais l’objectif final reste un compteur réel.

---

## 19. Comportement selon l’heure

L’heure sert à déterminer les états, mais ne doit pas empêcher l’utilisatrice de participer.

### Recommandation

- avant l’heure : **À venir** ;
- à partir de l’heure : **À faire** ;
- après validation : **Terminé** ;
- après la fin de journée, un rendez-vous non validé peut rester consultable jusqu’à minuit ;
- ne pas verrouiller définitivement un contenu simplement parce que son heure est passée.

Une utilisatrice qui se réveille tard doit pouvoir retrouver les rendez-vous précédents.

L’application ne doit pas culpabiliser ni afficher « manqué » de façon agressive.

Préférer :

- **Disponible** ;
- **À faire** ;
- **À venir** ;
- **Terminé**.

---

## 20. Fuseau horaire

Les heures doivent être interprétées selon le fuseau local de l’utilisatrice ou selon la règle actuelle de l’application.

Éviter une logique UTC affichant un rendez-vous à la mauvaise heure.

Si toute la communauté doit réellement recevoir le rendez-vous au même moment français, prévoir une option claire dans l’admin :

- heure locale de chaque utilisatrice ;
- ou heure Europe/Paris pour toute la communauté.

Pour la première version, privilégier une logique simple et cohérente avec les notifications existantes de l’application.

---

## 21. Compatibilité avec le fil

Le fil des publications reste inchangé.

Ne pas supprimer :

- le nombre de publications ;
- les cartes de posts ;
- le chargement progressif ;
- les interactions existantes ;
- les liens profonds ;
- les favoris ;
- les contenus privés.

Le bloc « Notre journée ensemble » doit simplement pointer vers les publications choisies.

---

## 22. Compatibilité avec les capsules

Les capsules actuelles restent indépendantes :

- Hydratation ;
- Fuel du jour ;
- Mouvement ;
- Sweet Switch.

Ne pas les transformer en tranches horaires de l’Immersion.

Elles peuvent afficher un contenu également utilisé dans l’Immersion si les règles actuelles le permettent, mais leur logique ne doit pas être cassée.

---

## 23. Compatibilité avec la grande carte « Aujourd’hui »

La grande carte **Aujourd’hui** reste l’espace personnel.

Elle continue de gérer :

- les missions du jour ;
- le protocole actif ;
- l’hydratation personnelle ;
- la routine ;
- le sommeil ;
- les validations personnelles.

Ne pas remplacer son action par l’Immersion.

La distinction doit rester claire :

- **Aujourd’hui** = mon suivi personnel ;
- **Notre journée ensemble** = les rendez-vous collectifs.

---

## 24. Fichiers et logique existante à auditer

Le bloc actuel est géré par la logique premium des « Échos du journal ».

Avant modification, identifier précisément :

- le fichier qui génère le bloc ;
- les classes CSS utilisées ;
- les fonctions de clic ;
- les fonctions de scroll vers les posts ;
- le stockage des micro-actions ;
- les copies éventuelles dans `www/` ;
- les versions web et Capacitor.

La refonte doit remplacer la source de données et la logique, tout en réutilisant autant que possible :

- le conteneur ;
- la grille 2 × 2 ;
- les styles ;
- les pills ;
- les états visuels ;
- les animations légères.

Ne pas laisser deux implémentations concurrentes actives.

---

## 25. Sécurité et droits Supabase

Prévoir des règles RLS adaptées :

### Rendez-vous

- lecture autorisée aux utilisatrices concernées ;
- écriture réservée à l’administration.

### Progression

- une utilisatrice peut lire et modifier uniquement sa propre progression ;
- l’administration peut consulter les données agrégées nécessaires au compteur ;
- ne jamais exposer la progression individuelle des autres membres.

### Compteur collectif

Afficher uniquement un nombre agrégé.

Ne pas exposer les noms ou identifiants des participantes sans consentement.

---

## 26. États vides et erreurs

### Aucun rendez-vous prévu

Afficher une version élégante :

> **La journée se vit plus librement aujourd’hui.**

Ou :

> **Aucun rendez-vous collectif programmé pour le moment.**

Le bloc doit rester beau et ne pas disparaître brutalement si l’Immersion fait partie de l’expérience principale.

### Erreur de chargement

Afficher un fallback discret et ne pas bloquer le reste de l’accueil.

### Utilisatrice non connectée

Définir si le bloc est visible en aperçu ou réservé aux membres connectés.

Recommandation : afficher l’en-tête et un aperçu, puis demander la connexion pour participer et enregistrer la progression.

---

## 27. Critères de validation fonctionnelle

La modification est validée uniquement si :

1. le bloc garde pratiquement la même hauteur qu’avant ;
2. il reste en grille 2 × 2 sur mobile ;
3. 4 cartes maximum apparaissent sur l’accueil ;
4. Tee peut programmer jusqu’à 6 tranches ;
5. les heures sont entièrement libres ;
6. une tranche peut rester vide ;
7. la plante peut être programmée le matin ;
8. le dernier rendez-vous peut être programmé à 21 h 30 ou plus tard ;
9. les 4 cartes visibles sont choisies depuis l’admin ;
10. le clic ouvre la journée complète ;
11. la grande jauge n’apparaît qu’après le clic ;
12. la page ouverte reste crème, pas verte ;
13. le compteur de membres apparaît ;
14. la progression `x / y` se met à jour ;
15. les pills restent visibles ;
16. les validations persistent ;
17. les notifications ouvrent le bon contenu ;
18. les publications liées restent dans le fil ;
19. les autres blocs de l’accueil continuent de fonctionner ;
20. la version web et la version embarquée restent synchronisées.

---

## 28. Critères de validation visuelle

Le rendu est validé uniquement si :

- le bloc paraît être une évolution naturelle de « Échos du journal » ;
- il ne donne pas l’impression d’un module ajouté après coup ;
- il n’utilise pas un grand fond vert ;
- les cartes ne contiennent pas trop de texte ;
- les 4 cartes restent équilibrées ;
- la zone « membres + jauge » reste compacte ;
- les pills ne débordent pas ;
- la page ouverte reprend exactement la palette actuelle ;
- la jauge reste fine et premium ;
- aucune zone n’est coupée sur iPhone ;
- la navbar ne recouvre pas le dernier contenu ;
- le fil des publications reste visible rapidement après le bloc.

---

## 29. Éléments à ne surtout pas faire

Ne pas :

- ajouter un nouveau gros bloc Immersion en plus d’Échos du journal ;
- créer une nouvelle icône dans la navbar ;
- transformer l’Immersion en protocole classique ;
- remplacer la grande carte Aujourd’hui ;
- supprimer les capsules ;
- supprimer le fil ;
- créer un deuxième fil de posts ;
- imposer 8 h comme heure de réveil ;
- imposer des horaires fixes ;
- obliger les 6 tranches à être remplies ;
- afficher les 6 grandes cartes sur l’accueil ;
- augmenter fortement la hauteur du bloc ;
- utiliser un gros fond vert après le clic ;
- afficher de longs textes dans les cartes ;
- afficher un faux compteur aléatoire ;
- perdre la progression au changement d’appareil ;
- casser Stripe, Supabase, les protocoles, l’authentification, la navbar ou les notifications existantes.

---

## 30. Résultat final attendu

L’accueil doit conserver son élégance actuelle.

Le bloc « Échos du journal » devient :

> **Notre journée ensemble ✨**

Il affiche :

- 4 rendez-vous maximum en grille 2 × 2 ;
- des horaires libres ;
- des statuts ;
- **382 membres avancent avec toi** ;
- une petite jauge du type **2 / 6 gestes réalisés** ;
- des pills de validation.

Au clic, l’utilisatrice découvre :

- la jauge complète des 6 moments ;
- tous les rendez-vous de la journée ;
- les contenus liés ;
- les validations ;
- la progression personnelle ;
- le sentiment que toute la communauté avance ensemble.

L’administration doit permettre à Tee de tout personnaliser sans toucher au code : date, tranche, heure, contenu, texte, ordre, visibilité accueil, validation, statut, publication liée et notification.

La transformation recherchée est claire :

> **Méthode Tee ne doit plus seulement proposer des contenus. L’application doit accompagner la communauté aux moments où les habitudes se jouent réellement, tout au long de la journée.**

---

# 31. ADDENDUM CORRECTIF OBLIGATOIRE — éléments manquants à intégrer

Cette section complète et précise les exigences précédentes. Elle est **obligatoire** et doit être traitée comme prioritaire lors de la prochaine modification du projet.

## 31.1 Table indépendante : interdiction d’utiliser `daily_rituals`

Le système **Notre journée ensemble** ne doit jamais utiliser, vider, remplacer ni détourner la table existante :

```text
daily_rituals
```

Cette table alimente déjà les missions et rituels personnels du bloc **Aujourd’hui**. L’Immersion collective doit être totalement indépendante.

Créer une nouvelle table dédiée, par exemple :

```text
community_journey_items
```

ou :

```text
daily_immersion_items
```

Une seule appellation doit être retenue dans tout le projet.

### Interdiction absolue

Ne jamais exécuter une suppression globale du type :

```js
supabase.from('daily_rituals').delete()
```

ou :

```js
supabase.from('community_journey_items').delete().gte('position', 0)
```

La sauvegarde d’une journée ne doit jamais supprimer les autres journées, les rituels personnels ni l’historique.

Chaque rendez-vous doit être créé, modifié, archivé ou supprimé individuellement grâce à son propre `id`.

---

## 31.2 Schéma de données recommandé pour les rendez-vous

La table dédiée doit au minimum contenir :

```text
id uuid primary key
journey_date date
slot_key text
scheduled_time time
title text
short_text text
linked_content_type text nullable
linked_content_id uuid nullable
linked_url text nullable
display_order integer
show_on_home boolean default false
show_as_pill boolean default false
pill_label text nullable
validation_enabled boolean default true
validation_label text nullable
completed_label text nullable
status text
notification_enabled boolean default false
notification_time time nullable
notification_title text nullable
notification_body text nullable
notification_target_type text nullable
notification_target_id uuid nullable
notification_sent_at timestamptz nullable
icon_key text nullable
is_active boolean default true
created_at timestamptz
updated_at timestamptz
```

### Valeurs autorisées pour `slot_key`

Utiliser exactement 6 tranches choisies manuellement dans l’admin :

```text
wake_up
morning
lunch
afternoon
evening
before_sleep
```

Libellés visibles :

1. Au réveil
2. Dans la matinée
3. Autour du déjeuner
4. Dans l’après-midi
5. Dans la soirée
6. Avant de dormir

La tranche ne doit jamais être calculée automatiquement à partir de l’heure.

Exemple valide :

```text
slot_key = wake_up
scheduled_time = 10:30
```

Même à 10 h 30, Tee doit pouvoir considérer ce rendez-vous comme **Au réveil**.

---

## 31.3 Gestion des dates : journée ponctuelle et programmation à l’avance

Le cas principal est la création d’une journée précise.

L’admin doit obligatoirement contenir :

```text
journey_date
```

Exemple :

```text
27 juillet 2026
```

Ajouter une navigation claire :

```text
← Jour précédent | 27 juillet 2026 | Jour suivant →
```

Tee doit pouvoir :

- préparer demain ;
- préparer plusieurs jours à l’avance ;
- revenir modifier une ancienne journée ;
- dupliquer une journée ;
- consulter les journées archivées ;
- modifier une journée sans toucher aux autres.

Un mode récurrent peut être ajouté en complément, mais il ne doit pas remplacer le mode ponctuel.

Modes possibles :

```text
Ponctuel
Récurrent
```

En mode récurrent, on peut utiliser :

- date de début ;
- date de fin ;
- jours de la semaine.

Mais chaque occurrence générée doit rester identifiable et modifiable sans effacer les autres.

---

## 31.4 Sélection manuelle des 4 cartes d’accueil

L’accueil affiche maximum 4 cartes en grille 2 × 2.

Ne pas utiliser uniquement :

```js
items.slice(0, 4)
```

Le choix doit provenir du champ :

```text
show_on_home
```

Logique attendue :

```js
const homeItems = items
  .filter(item => item.show_on_home)
  .sort((a, b) => a.display_order - b.display_order)
  .slice(0, 4)
```

Dans l’admin :

- afficher un compteur `3 / 4 sélectionnés pour l’accueil` ;
- empêcher ou avertir si plus de 4 rendez-vous sont cochés ;
- permettre de réordonner les 4 cartes par glisser-déposer ou champ d’ordre ;
- afficher un aperçu mobile fidèle au bloc réel.

Les rendez-vous non cochés restent visibles dans la page complète.

---

## 31.5 Pills entièrement personnalisables et synchronisées

Les anciennes pills fixes :

- + Eau ;
- Mood calme ;
- Note gratitude ;

ne doivent pas rester figées si le bloc devient **Notre journée ensemble**.

Chaque rendez-vous peut avoir :

```text
Afficher comme pill : Oui / Non
Libellé de la pill
```

Champs techniques :

```text
show_as_pill
pill_label
```

Exemples :

- Eau du matin ;
- Assiette complète ;
- Collation prête ;
- Plante prise ;
- Bilan du soir.

La pill doit utiliser exactement le même état de validation que la carte associée.

Exemple :

- validation depuis la page complète → pill cochée immédiatement sur l’accueil ;
- validation depuis la pill → carte marquée terminée dans la page complète ;
- actualisation de la jauge et du compteur en temps réel.

Aucune double source de vérité.

---

## 31.6 Validation personnalisable

Chaque rendez-vous doit permettre :

```text
Validation activée : Oui / Non
Texte avant validation
Texte après validation
```

Champs :

```text
validation_enabled
validation_label
completed_label
```

Exemples :

```text
Je l’ai préparée
J’ai bu mon eau
Ma collation est prête
J’ai ajouté ma protéine
J’ai fait le point
Je clôture ma journée
```

Après validation :

- la carte change d’état ;
- la pill change d’état ;
- la petite jauge de l’accueil se met à jour ;
- la grande jauge de la page complète se met à jour ;
- le compteur `x / y gestes réalisés` se met à jour ;
- la donnée est enregistrée dans Supabase.

---

## 31.7 Table de progression et synchronisation multi-appareils

Créer une table dédiée, par exemple :

```text
community_journey_completions
```

Champs minimum :

```text
id uuid primary key
user_id uuid
journey_item_id uuid
journey_date date
completed boolean
completed_at timestamptz
created_at timestamptz
updated_at timestamptz
```

Ajouter une contrainte unique :

```text
unique(user_id, journey_item_id, journey_date)
```

### Source de vérité

Supabase doit être la source principale.

Au chargement :

1. récupérer les rendez-vous du jour ;
2. récupérer les validations Supabase de l’utilisatrice connectée ;
3. fusionner éventuellement avec le cache local ;
4. afficher l’état réel ;
5. corriger le cache local si Supabase contient une version plus récente.

Ne jamais dépendre uniquement de `localStorage`.

La progression doit rester identique sur plusieurs appareils.

---

## 31.8 Jauge complète des 6 tranches après le clic

La barre `2 / 6 gestes réalisés` ne remplace pas la jauge détaillée.

Dans la page **Notre journée ensemble**, afficher obligatoirement les 6 moments :

```text
Réveil — Matin — Déjeuner — Après-midi — Soir — Nuit
```

Chaque tranche doit avoir un état :

```text
✓ terminé
● actuel
○ à venir
— aucun rendez-vous prévu
```

La jauge doit être calculée à partir du `slot_key`, pas uniquement à partir de l’heure.

Une tranche vide reste visible dans la jauge sous forme estompée ou avec un tiret, mais ne compte pas dans le dénominateur des gestes.

Exemple :

- 6 tranches visibles ;
- 5 rendez-vous réellement programmés ;
- progression affichée : `2 / 5 gestes réalisés`.

Cette grande jauge apparaît uniquement après le clic, jamais en entier sur l’accueil.

---

## 31.9 Compteur communautaire réel

Le texte validé est :

> **382 membres avancent avec toi**

Le chiffre doit être réel et non aléatoire.

Créer une table ou un mécanisme de présence quotidienne, par exemple :

```text
community_journey_participation
```

Champs possibles :

```text
id
user_id
journey_date
first_opened_at
last_opened_at
first_completed_at
```

Une personne peut être comptée dès qu’elle ouvre **Notre journée ensemble** pour la première fois ce jour-là.

Utiliser une contrainte unique :

```text
unique(user_id, journey_date)
```

Le compteur affiché correspond au nombre de participantes uniques de la journée.

Ne pas doubler le compteur à chaque ouverture.

Si l’utilisatrice n’est pas connectée, ne pas créer de faux participant.

---

## 31.10 Notifications réellement administrables

Les notifications ne doivent pas être seulement prévues dans le design : elles doivent être gérées depuis l’admin.

Pour chaque rendez-vous :

```text
Notification activée : Oui / Non
Heure d’envoi
Titre
Message
Destination au clic
```

Champs minimum :

```text
notification_enabled
notification_time
notification_title
notification_body
notification_target_type
notification_target_id
notification_sent_at
```

Règles :

- ne jamais envoyer une notification pour un brouillon ;
- ne pas envoyer deux fois la même notification ;
- si l’heure est modifiée avant l’envoi, utiliser la nouvelle heure ;
- si le rendez-vous est archivé, annuler l’envoi ;
- au clic, ouvrir le bon rendez-vous ou le contenu lié ;
- conserver les systèmes de notifications existants sans les casser ;
- respecter le fuseau choisi pour la journée.

---

## 31.11 Sauvegarde sans suppression globale

La sauvegarde doit fonctionner par opérations ciblées :

```text
INSERT pour un nouveau rendez-vous
UPDATE pour un rendez-vous existant
DELETE uniquement pour l’élément explicitement supprimé
ARCHIVE pour conserver l’historique si souhaité
```

Ne jamais :

- vider toute la table ;
- supprimer tous les rendez-vous d’une date pour les recréer ;
- supprimer les jours précédents ;
- supprimer les jours futurs ;
- toucher à `daily_rituals` ;
- perdre les validations associées.

Lorsqu’un rendez-vous déjà validé est modifié, conserver sa progression si son `id` reste identique.

---

## 31.12 Comportement attendu dans l’admin

Créer une vraie rubrique dédiée :

> **Immersion — Notre journée ensemble**

### Écran principal

Afficher :

- calendrier ou liste des dates ;
- nombre de rendez-vous par date ;
- nombre visible sur l’accueil ;
- statut global de la journée ;
- nombre de notifications programmées ;
- boutons Modifier / Dupliquer / Archiver.

### Écran d’édition

Afficher les 6 tranches dans l’ordre, avec pour chacune :

- tranche manuelle ;
- heure exacte ;
- icône ;
- titre ;
- texte court ;
- contenu lié ;
- ordre ;
- affichage accueil ;
- affichage pill ;
- libellé pill ;
- validation activée ;
- texte du bouton ;
- texte après validation ;
- notification ;
- titre et message notification ;
- destination ;
- statut.

### Aides visuelles

Ajouter :

- aperçu mobile 2 × 2 ;
- compteur de caractères ;
- alerte si plus de 4 cartes sont cochées ;
- alerte si un rendez-vous n’a ni contenu ni action ;
- alerte si notification activée sans heure ou message ;
- aperçu de la grande jauge ;
- possibilité de dupliquer un rendez-vous ou une journée entière.

---

## 31.13 Règles de calcul des états

États recommandés :

```text
Brouillon
Programmé
Disponible
À venir
Terminé
Archivé
```

Côté utilisatrice :

- avant l’heure : `À venir` ;
- à partir de l’heure : `À faire` ou `Disponible` ;
- après validation : `Terminé` ;
- après l’heure mais non validé : rester disponible jusqu’à minuit ;
- ne pas afficher `Manqué` de manière culpabilisante.

La tranche sélectionnée dans l’admin reste indépendante de l’heure réelle.

---

## 31.14 Critères de validation supplémentaires

La fonctionnalité ne sera considérée comme terminée que si :

1. aucune requête d’Immersion ne lit ou n’écrit dans `daily_rituals` ;
2. aucune sauvegarde ne supprime globalement une table ;
3. chaque rendez-vous possède sa propre date ;
4. Tee choisit manuellement la tranche parmi les 6 ;
5. l’heure exacte est libre ;
6. les 4 cartes d’accueil sont choisies par `show_on_home` ;
7. les pills sont personnalisables et synchronisées ;
8. les textes de validation sont personnalisables ;
9. les validations sont relues depuis Supabase au chargement ;
10. la progression est identique sur plusieurs appareils ;
11. la grande jauge des 6 tranches apparaît dans la vue ouverte ;
12. les tranches vides ne comptent pas comme gestes ;
13. les notifications sont gérables dans l’admin ;
14. le compteur communautaire repose sur des participantes uniques réelles ;
15. une journée peut être modifiée sans affecter les autres dates ;
16. la grande carte Aujourd’hui, les capsules, le fil, les protocoles, Stripe, l’authentification et la navbar restent intacts.

---

## 32. Priorité d’implémentation recommandée

### Priorité 1 — sécurité des données

- créer la table dédiée ;
- supprimer toute dépendance à `daily_rituals` ;
- supprimer toute logique de suppression globale ;
- créer la table de progression ;
- charger les validations depuis Supabase.

### Priorité 2 — admin complet

- date précise ;
- tranche manuelle ;
- heure libre ;
- sélection des 4 cartes ;
- pills ;
- libellés de validation ;
- publication liée ;
- duplication.

### Priorité 3 — expérience utilisateur

- bloc 2 × 2 inchangé en taille ;
- compteur communautaire ;
- petite jauge ;
- pills ;
- page complète ;
- grande jauge des 6 tranches.

### Priorité 4 — notifications et finitions

- notifications administrables ;
- deep links ;
- gestion du fuseau ;
- tests iPhone / PWA / Capacitor ;
- états vides ;
- tests multi-appareils.

---

# Conclusion finale mise à jour

Le système final doit être un module collectif totalement indépendant des rituels personnels.

Il doit permettre à Tee de scénariser chaque journée depuis l’admin, avec :

- jusqu’à 6 tranches choisies manuellement ;
- des heures totalement libres ;
- 4 cartes sélectionnées pour l’accueil ;
- des pills personnalisables ;
- des validations personnalisables ;
- des notifications ;
- des contenus liés ;
- une progression synchronisée ;
- un vrai compteur communautaire ;
- une page complète avec jauge des 6 moments ;
- aucune suppression de données existantes ;
- aucun impact sur `daily_rituals` ni sur le bloc Aujourd’hui.

Le rendu doit rester exactement dans l’univers crème, vert profond et doré actuel, sans grand fond vert et sans agrandir sensiblement le bloc fermé de l’accueil.
