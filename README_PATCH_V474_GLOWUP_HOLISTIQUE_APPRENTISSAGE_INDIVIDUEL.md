# PATCH V474 — Glow up holistique + apprentissage statistique individuel

Base : **M-thode-TEE-wellness-main 426.zip**.

Ce patch est **cumulatif**. Il inclut tout ce qui était dans le patch V473 précédent :
- correctif critique V471 de validation des contenus de protocoles ;
- suivi complet **Fringales & envies** ;
- connexions holistiques ;
- baselines 7 / 28 / 90 jours ;
- confiance et concordance ;
- liens temporels ;
- cycle adaptatif 7 jours synchronisé au compte ;
- check-in réel du levier ;
- réévaluation à 7 jours ;
- feedback de fin de protocole simplifié ;
- garde-fous et nettoyage de l’UX.

**Tu n’as pas besoin d’installer V471 ou V473 séparément.**

---

## 1. Apprentissage statistique réellement individuel

V474 ajoute une couche d’apprentissage qui se recalcule à partir de l’historique propre à chaque compte.

Le moteur entraîne des modèles **ridge multivariés standardisés** sur l’historique individuel. Les coefficients ne sont donc plus des poids identiques pour tout le monde.

Modèles personnels actuellement entraînés :
- énergie ;
- fringales & envies ;
- digestion ;
- récupération ;
- satiété.

Chaque modèle apprend des poids différents selon la personne et réévalue notamment la contribution de :
- sommeil ;
- stress ;
- protéines ;
- fibres ;
- activité / énergie active ;
- apport énergétique documenté ;
- durée de jeûne ;
- appétit lié au cycle lorsque cette donnée existe.

Les variables manquantes ne deviennent jamais zéro. Pour l’apprentissage, une valeur prédictive manquante est neutralisée autour de la moyenne personnelle et la **couverture réelle** pénalise la fiabilité du modèle.

---

## 2. Poids auto-recalibrés par personne

Pour chaque modèle, V474 calcule notamment :
- nombre de journées exploitables ;
- couverture de chaque prédicteur ;
- coefficient standardisé individuel ;
- poids relatif ;
- qualité d’ajustement ;
- niveau de fiabilité ;
- direction du signal ;
- fenêtre réellement entraînée.

Le recalibrage est fait côté serveur puis mis en cache dans :

`user_holistic_learning_models`

Le modèle n’est pas recalculé inutilement à chaque écran : il est réentraîné lorsque les faits personnels ont évolué, puis réutilisé.

---

## 3. Modèle causal multivarié prudent

V474 introduit un **graphe causal pré-spécifié** plutôt que de laisser l’algorithme relier toutes les variables entre elles.

Exemples :
- sommeil de la veille → énergie du lendemain ;
- sommeil de la veille → fringales du lendemain ;
- stress → digestion ;
- protéines → satiété / contexte des fringales ;
- fibres → digestion ;
- activité → récupération ;
- jeûne → faim / énergie / digestion ;
- cycle → contexte des envies.

La temporalité est imposée quand elle est nécessaire (`lag = 1`). Les clics, routines ou validations comportementales ne peuvent toujours pas fabriquer artificiellement une donnée physiologique.

Important : **un modèle causal observationnel ne peut pas prouver une cause à lui seul**. V474 utilise donc cette structure pour mieux sélectionner et ajuster les variables, pas pour afficher des certitudes médicales.

---

## 4. Hiérarchie personnalisée des leviers

Les nouveaux poids individuels participent réellement à la hiérarchie du moteur adaptatif.

Ils peuvent renforcer :
- récupération & rythme ;
- protéines & structure des repas ;
- fibres & densité nutritionnelle.

Exemple : deux personnes avec exactement le même sommeil moyen ne recevront pas nécessairement la même priorité si leur historique individuel montre que le sommeil semble beaucoup plus lié à l’énergie / récupération chez l’une que chez l’autre.

Les règles de sécurité restent prioritaires : récupération avant restriction supplémentaire, pas de réduction calorique automatique, pas de conclusion sur une journée isolée.

---

## 5. Estimation mathématique avancée de l’effet d’une intervention

La réévaluation d’un levier ne repose plus uniquement sur un simple « avant / après ».

V474 ajoute une estimation de type **ATT apparié multivarié** :

1. seuls les jours où l’utilisatrice a explicitement indiqué **« J’ai appliqué ce repère aujourd’hui »** sont considérés comme jours d’application certains ;
2. les jours sans check-in restent **inconnus**, ils ne sont pas transformés en « non appliqué » ;
3. chaque journée appliquée est comparée à des journées pré-intervention personnelles proches ;
4. l’appariement tient compte de covariables de la veille pour éviter au maximum de comparer des journées incomparables ;
5. le moteur estime un effet moyen ajusté, un effet standardisé, une dispersion, un intervalle de confiance indicatif et une fiabilité ;
6. l’interface n’affiche pas cette mécanique statistique brute.

Les leviers évaluables directement actuellement :
- **Récupération & rythme** → récupération ;
- **Protéines & structure** → satiété ;
- **Fibres & densité** → confort digestif.

Pour `maintain` ou `energy_review`, aucune pseudo-estimation n’est inventée.

---

## 6. La réévaluation J7 devient plus intelligente

V474 demande au moins **4 jours d’application explicitement documentés** avant de prétendre évaluer l’effet du levier.

Ensuite :
- si la réponse ajustée est favorable, la réévaluation peut renforcer le levier ;
- si l’effet reste neutre, l’app le dit sans inventer une réussite ;
- si les journées comparables ne montrent pas une évolution favorable suffisamment nette, le moteur n’intensifie pas le levier et peut revenir à **Observer** ;
- si les données sont insuffisantes, il demande davantage de recul.

Cette logique évite de confondre :
- « le conseil n’a pas aidé » ;
- « le conseil n’a pas été assez appliqué » ;
- « les données ne permettent pas encore de savoir ».

---

## 7. Mécanique invisible pour l’utilisateur

L’utilisatrice ne voit jamais :
- coefficients ridge ;
- matrices ;
- poids statistiques ;
- `R²` ;
- distance d’appariement ;
- SQL ;
- RPC ;
- nom des tables ;
- graphe causal technique.

Elle voit uniquement :
- son repère ;
- la conclusion utile ;
- une priorité ;
- une explication courte ;
- une action ;
- la progression du cycle ;
- la réévaluation.

---

## 8. Fringales & envies — version complète incluse

Le patch contient toujours le suivi complet décidé précédemment :
- présence des envies /5 ;
- faim physique /5 ;
- intensité /5 ;
- apaisement après avoir mangé /5 ;
- heure ;
- contexte principal ;
- distinction collation structurée / prise spontanée / envie sans manger ;
- note facultative ;
- connexions avec repas, protéines, fibres, sommeil précédent, stress, activité, récupération, cycle et jeûne.

Les modèles personnels V474 peuvent maintenant apprendre progressivement quelles dimensions semblent réellement les plus informatives **chez cette personne**.

---

## 9. Correctif critique validation protocoles inclus

Le patch conserve le correctif V471 : `completed_content` est traité comme une liste d’identifiants de contenus et non comme une liste de dates.

Donc :

`Marquer comme fait → Enregistrement… → ✓ Contenu terminé`

sans faux message « Validation non confirmée ».

---

## 10. Performance / egress

Pour éviter de transformer le moteur en gouffre réseau :
- les faits restent agrégés côté serveur ;
- aucun historique brut supplémentaire n’est envoyé au client ;
- les modèles sont mis en cache par utilisateur ;
- le recalibrage utilise au maximum 90 jours ;
- les modèles comptent au plus quelques prédicteurs prédéfinis ;
- la régression est régularisée ;
- la vue utilisateur reçoit uniquement le contexte JSON compact ;
- le timeout du premier chargement holistique est légèrement assoupli, puis les appels suivants bénéficient du cache.

---

## 11. Garde-fous méthodologiques conservés

- absence ≠ zéro ;
- association ≠ causalité ;
- une estimation d’effet observationnelle ≠ preuve médicale ;
- pas d’inférence depuis du texte libre ;
- pas de tracker fabriqué ;
- pas de clic transformé en physiologie ;
- pas de baisse calorique automatique ;
- récupération / sommeil / structure avant énergie ;
- mineurs : garde-fous adultes conservés ;
- Apple Santé complète uniquement les mesures compatibles selon les règles existantes ;
- si la fiabilité statistique est insuffisante, l’apprentissage reste en construction et ne prend pas la main.

---

## 12. SQL À EXÉCUTER

Après avoir uploadé ce patch sur GitHub, exécute **UN SEUL SQL** dans Supabase SQL Editor :

`supabase/V474_GLOWUP_HOLISTIQUE_APPRENTISSAGE_INDIVIDUEL.sql`

**N’exécute pas V473 séparément.** Le fichier V474 contient d’abord tout le SQL V473 puis la couche V474.

Le script est conçu pour être ré-exécutable : créations `if not exists`, fonctions `create or replace`, policies recréées proprement et wrapper V474 reconstruit à la fin.

---

## 13. Fichiers fonctionnels principaux

- `scripts/v18-premium.js` — correctif protocoles + feedback ;
- `scripts/custom-trackers.js` — Fringales & envies ;
- `scripts/personal-reference.js` — contexte holistique + timeout/cache adapté ;
- `scripts/adaptive-reference.js` — apprentissage individuel utilisé dans les priorités + réévaluation par effet ;
- miroirs `www/scripts/` ;
- `supabase/V474_GLOWUP_HOLISTIQUE_APPRENTISSAGE_INDIVIDUEL.sql` ;
- miroir `www/supabase/` ;
- HTML root + `www` avec cache-bust V474.

---

## 14. Tests indispensables avant soumission Apple

1. **Protocoles** : Marquer comme fait → terminé → fermeture/réouverture → toujours terminé → aucun double XP.
2. **Valider aujourd’hui** : toujours fonctionnel.
3. **Fringales & envies** : ajouter, renseigner les quatre échelles + contexte, sauvegarder, rouvrir.
4. Vérifier qu’une collation structurée n’est pas cataloguée automatiquement comme un problème.
5. Vérifier que le tracker n’est pas prérempli artificiellement par Apple Santé ou les repas.
6. **Historique < 12 jours** : les modèles restent en construction, aucune conclusion statistique forte.
7. **Historique suffisant** : le contexte holistique doit contenir `holistic.learning.version = 474`.
8. Vérifier que plusieurs modèles ont `status = usable` seulement lorsque leur couverture le permet.
9. Vérifier qu’un signal appris peut renforcer une priorité sans modifier automatiquement les objectifs.
10. Vérifier qu’un terrain contradictoire reste prudent.
11. Démarrer un cycle adaptatif et documenter moins de 4 jours d’application → l’app ne juge pas l’effet.
12. Documenter au moins 4 jours d’application + assez d’historique pré-cycle → `intervention_effect` doit devenir exploitable si les données le permettent.
13. Vérifier qu’une estimation défavorable n’intensifie pas automatiquement le même levier.
14. Vérifier qu’une estimation favorable reste formulée comme une réponse observée, jamais comme une causalité certaine.
15. Tester avec Apple Santé désactivé puis activé.
16. Tester déconnexion / reconnexion / autre appareil : cycle serveur conservé.
17. Vérifier que l’UI ne montre aucun coefficient, `R²`, SQL, RPC ou détail technique.

---

## 15. Ce que V474 signifie réellement

V474 fait passer la logique de :

**Observer → Relier → Prioriser → Réévaluer**

à :

**Observer → construire une baseline personnelle → apprendre des poids individuels → respecter un graphe causal prédéfini → hiérarchiser les signaux → proposer un seul levier → mesurer l’application réelle → comparer à des journées personnelles similaires → réévaluer → recalibrer le modèle.**

C’est une vraie couche statistique individualisée. Elle est volontairement prudente : plus l’analyse devient mathématiquement avancée, plus les garde-fous contre la fausse précision deviennent importants.

## Correctif V474.1 — SQL Supabase

Le SQL cumulatif a été corrigé pour PostgreSQL/PLpgSQL : une clause `SELECT ... INTO` ne peut pas cibler directement des éléments de tableau comme `counts[j]`. La version corrigée passe par trois variables scalaires (`stat_count`, `stat_mean`, `stat_sd`) puis affecte les tableaux.

Si l’ancienne version a affiché `ERROR 42601` à la ligne 567, l’erreur est intervenue au parsing SQL : exécute simplement **le SQL complet corrigé de ce ZIP**.
