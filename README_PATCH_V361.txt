PATCH V361 — Cache-busting v18-premium.js

Correction uniquement technique :
- remplace le suffixe de cache v358-stabilisation par v361-mes-suivis-history
  sur toutes les pages actives qui chargent scripts/v18-premium.js ;
- garantit que les appareils chargent bien la version V360/V361 de Mes suivis
  avec la navigation des jours précédents ;
- aucune logique métier modifiée ;
- aucun SQL à exécuter.
