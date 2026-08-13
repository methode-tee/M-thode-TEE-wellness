# Patch V342 — Système central connecté

Ce patch remplace V341. Il relie désormais **Carnet → Mon parcours → Mon Équilibre** au lieu d’ajouter de simples formulaires isolés.

## Installation

1. Décompresser l’archive à la racine du dépôt Méthode Tee.
2. Accepter le remplacement des fichiers inclus.
3. Déployer normalement la version web et/ou reconstruire l’application Capacitor.

Les fichiers miroirs `www/` sont inclus. Aucune nouvelle migration SQL n’est nécessaire si les migrations V331 (Carnet alimentaire) et V338 (suivis personnalisés) ont déjà été exécutées. Si V338 n’a jamais été appliquée, exécuter une seule fois `supabase/V338_SUIVIS_PERSONNALISES.sql` depuis le projet complet.

## Ce qui est corrigé

### Carnet

- **Mes suivis** apparaît au-dessus de `+ Ajouter un suivi`.
- Chaque suivi activé reste directement accessible dans Carnet ; le catalogue sert seulement à personnaliser ou masquer les modules.
- Une seule entrée universelle **Performance & récupération** remplace Football dans la liste principale.
- Le formulaire sportif demande d’abord la discipline (Football, Musculation, Course, Boxe, Danse, Basketball, Tennis, Natation, Cyclisme ou Autre), puis adapte ses champs.
- Le cycle utilise un mini-onboarding : dernières règles, durée des règles, durée habituelle et régularité du cycle. Le jour et la phase sont ensuite calculés automatiquement et restent clairement présentés comme des estimations.

### Mon parcours

- Chaque repère est placé sur sa date avec des pills dynamiques.
- Le détail d’une journée affiche les résumés compacts des suivis, du sport et de l’alimentation.
- Une ancienne date recharge uniquement le détail de cette date, pas tout l’historique.
- L’alimentation affiche un résumé utile (nombre de repas, protéines, végétaux/fibres, énergie, digestion, satiété) sans recopier les lignes CIQUAL dans le calendrier.

### Mon Équilibre

- Les trois anneaux d’origine sont conservés : **Vitalité**, **Équilibre intérieur** et **Régularité**.
- Le moteur reçoit un résumé quotidien compact (`sleep_minutes`, `hydration_ml`, `nutrition_meals`, `nutrition_balance`, `sport_intensity`, `recovery`, `cycle_day`, `cycle_phase`, `digestion`, `stress`, etc.).
- Il croise maintenant les repères utiles. Exemples couverts :
  - sommeil court + séance intense + récupération basse → **Besoin de douceur** ;
  - énergie basse + phase lutéale estimée → adaptation prudente du rythme ;
  - digestion confortable + alimentation renseignée + hydratation basse → conseil d’hydratation contextualisé.
- Ces lectures restent informatives : aucun diagnostic médical ni certitude sur le cycle.

### Journal et performances

- Le Journal privé affiche immédiatement un mini état d’ouverture et reste un singleton : aucun écran blanc, y compris après plusieurs ouvertures/fermetures.
- Aucun historique de suivi, aucun détail CIQUAL et aucun historique de cycle n’est chargé au lancement.
- Le calendrier ne demande que le mois ouvert ; Mon Équilibre ne demande que les résumés du jour ; le détail complet reste chargé à la demande.
- StoreKit 2, Stripe, validation/restauration Apple, Product IDs, déblocages, CIQUAL, service worker, préchauffage et « Notre journée ensemble » ne sont pas modifiés.

## Fichiers remplacés

- `index.html`, `library.html`, `dashboard.html`
- `scripts/app.js`
- `scripts/custom-trackers.js`
- `scripts/journal.js`
- `scripts/tee-balance.js`
- `scripts/v18-premium.js`
- les mêmes fichiers sous `www/`

## Vérification rapide après upload

1. Dans Carnet, activer un suivi et vérifier que sa carte apparaît dans **Mes suivis**.
2. Tester plusieurs disciplines dans **Performance & récupération** et vérifier que seuls les champs adaptés apparaissent.
3. Configurer Cycle puis vérifier que la phase est calculée, jamais choisie manuellement.
4. Enregistrer un suivi et un repas ; ouvrir la même date dans **Mon parcours** et vérifier les pills et résumés.
5. Ouvrir/fermer le Journal privé plusieurs fois depuis Profil et Carnet : le mini état doit apparaître immédiatement, sans écran blanc.
6. Vérifier que **Mon Équilibre** conserve exactement trois anneaux et affiche une lecture croisée après avoir renseigné plusieurs repères.
