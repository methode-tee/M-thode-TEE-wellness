# Méthode TEE — V489.0 · moteur de recommandation déterministe ultra

V489.0 remplace la logique gloutonne du planificateur par une optimisation de **la semaine entière**. Aucun LLM, Gemini, ChatGPT ou API IA n'est requis au runtime.

## Pourquoi V488.8.3.x finissait par tourner en rond

Le moteur précédent classait les candidats puis prenait le meilleur plat jour après jour. Avec un noyau de plats à 100 % chiffrables autour de 2–5 €, 30 € et 45 € finissaient donc par choisir presque les mêmes gagnants dans un ordre différent. La mémoire ne pouvait agir qu'à l'intérieur de ce noyau.

## Ce que V489.0 change

### 1. Le budget devient une vraie intention

Un nouveau champ propose trois stratégies :

- **Économiser au maximum** : rester volontairement loin du plafond.
- **Utiliser raisonnablement mon budget** : viser environ 86 % de l'enveloppe hebdomadaire.
- **Privilégier la variété dans cette enveloppe** : viser environ 94 % sans dépasser le budget.

Le montant et l'intention ne sont donc plus confondus.

### 2. Optimisation globale de la semaine

Le frontend utilise une recherche combinatoire bornée de type **beam search**. Il compare des semaines complètes au lieu de choisir lundi puis mardi puis mercredi.

Le score final combine :

- enveloppe budgétaire ;
- fiabilité prix ;
- familiarité personnelle ;
- répétitions alimentaires récentes ;
- historique des recommandations TEE ;
- diversité des protéines ;
- diversité des féculents ;
- diversité des techniques de cuisson ;
- diversité des formats de plat ;
- diversité des cuisines ;
- placard ;
- contraintes culturelles de découverte ;
- restes réels uniquement.

### 3. Contraintes de variété

Le moteur empêche notamment :

- plus de 2 plats de bœuf dans une semaine ;
- plus de 2 occurrences du même féculent principal ;
- deux mijotés consécutifs ;
- la surconcentration d'une même cuisine ;
- plus d'un plat culturel spécifique par défaut, sauf familiarité réelle ;
- plus d'une nouveauté très éloignée des habitudes lorsque la mémoire est active.

Si le pool fiable le permet, poisson et végétal reçoivent aussi un bonus de couverture hebdomadaire. Ce sont des garde-fous de diversité, pas des prescriptions médicales.

### 4. Mémoire des recommandations

Nouvelle table `mt_planner_recommendation_history`.

TEE mémorise les plats **qu'elle vient de proposer**, séparément de ce que l'utilisateur a réellement mangé. Une proposition récente reçoit ensuite une forte pénalité temporaire. Appuyer à nouveau sur « Construire ma semaine » fait donc explorer une autre zone du profil au lieu de seulement mélanger l'ordre.

L'historique est strictement lié à `auth.uid()` et purgé au-delà de 180 jours.

### 5. Fiabilité avant mémoire

Si le catalogue contient assez de candidats **100 % chiffrables pour remplir la semaine**, le beam search travaille uniquement dans ce pool. Un plat à 75 % ne peut pas être sauvé par un score mémoire élevé.

### 6. Tous les candidats sont enfin chiffrés

Le V1 historique limitait un batch à 60 IDs. V489.0 ajoute `mt_recipe_cost_batch_v2`, qui réutilise le V1 strict par tranches de 60. Le frontend peut donc chiffrer **tout le catalogue unifié**, jusqu'à la limite actuelle de 500 candidats, sans modifier le dispatch strict des plats externes V488.5.

### 7. Métadonnées de variété

`mt_planner_candidate_traits_v1()` fournit pour chaque candidat :

- famille protéique ;
- famille de féculent ;
- présence/famille végétale ;
- format du plat ;
- technique de cuisson ;
- famille de cuisine ;
- statut repas complet ;
- compatibilité avec de vrais restes.

Une table d'override admin permet de corriger les heuristiques sans nouvelle version iOS.

### 8. Coût consommé vs ticket de caisse

V489.0 ajoute `mt_food_purchase_format_reference` et `mt_planner_purchase_quote_v1()`.

Seuls les formats **exactement documentés et vérifiés** sont convertis en paquets à acheter. Les références whole-dish déjà enregistrées en `price_basis='package'` sont importées automatiquement.

Pour les ingrédients sans format magasin vérifié, TEE conserve le coût de la quantité consommée et l'interface indique clairement le pourcentage de lignes dont le format magasin est réellement documenté. Un coût inconnu n'est jamais 0 €.

## Source de vérité Supabase restaurée

Le ZIP 445 ne contenait pas certaines migrations qui avaient pourtant construit l'état live de Supabase. Le dossier `supabase/baseline_history/` réintègre désormais les fichiers historiques exacts disponibles : V488.5, V488.6.2, V488.7 et V488.8.

**Ne pas réexécuter ces fichiers sur la production actuelle.** Ils servent à l'audit et à la reconstruction d'une future base propre.

## Installation sur la production actuelle

1. Exécuter uniquement :
   `supabase/V4890_MOTEUR_RECOMMANDATION_DETERMINISTE_ULTRA.sql`
2. Envoyer le JSON `v4890_result`.
3. Si les cinq briques d'architecture sont `true`, remplacer :
   - `scripts/tee-next.js`
   - `www/scripts/tee-next.js`
   - `tee-next.html`
   - `www/tee-next.html`
4. Tester d'abord `methodetee.app` en navigation privée.
5. Xcode uniquement après validation web.

## Tests inclus

`qa/test_v4890_optimizer.js` charge réellement le moteur du patch et vérifie hors navigateur :

- 30 € et 45 € ne donnent pas la même semaine ;
- 45 € exploite davantage l'enveloppe ;
- un candidat 75 % n'entre pas si 7+ candidats 100 % sont disponibles ;
- maximum 2 plats de bœuf ;
- maximum 1 découverte spécifique ;
- une régénération après historique change réellement la composition.

Test exécuté lors de la création du patch : **OK**.

## Ce que V489.0 ne fait volontairement pas

- aucune nouvelle règle médicale/phyto n'est inventée ;
- aucun prix magasin n'est inventé ;
- aucun paquet générique n'est supposé sans source ;
- aucun apprentissage entre utilisateurs ;
- aucune IA externe ;
- aucune modification paiements, droits, protocoles, CIQUAL ou voix.
