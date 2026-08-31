MÉTHODE TEE — PATCH V451 · REPÈRES INSTANTANÉS

Base : 404(1) / V450 déjà appliqué.

PROBLÈME CORRIGÉ
- mt_reference_context() lançait mt_reference_bootstrap(28) de manière synchrone.
- Le client abandonnait l'attente au bout de 6,5 s et affichait « Repères en mise à jour ».
- Un profil pourtant complet pouvait donc ne jamais afficher son premier repère.

V451
1. Le contexte Résumé / Adapter mon repas ne lance plus de bootstrap 28 jours.
2. Mon profil est renvoyé immédiatement et suffit à construire le premier repère.
3. Les faits quotidiens compacts déjà présents continuent d'affiner le repère.
4. Les vues Mes tendances 28 j / 3 mois gardent leur bootstrap serveur à la demande.
5. Si une couche optionnelle (historique, trackers, protocoles) échoue, le profil reste utilisable.
6. Côté client, après 2,2 s sans contexte complet, un fallback ne lit qu'UNE ligne profiles.
   Il n'ajoute aucun historique brut et ne dégrade pas le cached egress.
7. Le contexte serveur complet peut finir en arrière-plan et sera utilisé au prochain appel.
8. Les cache-busters de personal-reference.js sont harmonisés sur les pages concernées.

SQL À EXÉCUTER
- supabase/V451_REPERES_INSTANTANES_CONTEXTE_ROBUSTE.sql
- V447 doit déjà avoir été exécuté.

FICHIERS À REMPLACER
- scripts/personal-reference.js
- dashboard.html
- food-adapter.html
- food-day.html
- library.html
- protocol-journey.html
- mêmes fichiers sous www/
- supabase/V451_REPERES_INSTANTANES_CONTEXTE_ROBUSTE.sql
- même SQL sous www/supabase/

ATTENDU APRÈS V451
- Profil complet + peu d'historique : « Repère en construction » avec fourchettes énergie/protéines/fibres.
- Historique disponible : les mêmes repères sont affinés par les faits compacts existants.
- Plus d'écran bloqué « Repères en mise à jour » uniquement parce que le bootstrap 28 j est lent.
