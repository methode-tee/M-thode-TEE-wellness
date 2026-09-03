# PATCH V470 — Nettoyage final des textes techniques visibles

Base : **M-thode-TEE-wellness-main 423.zip**.

## But

Dernier nettoyage éditorial avant soumission Apple. Aucun calcul, aucune donnée, aucun SQL et aucune logique métier ne sont modifiés.

## Nettoyages visibles

- Carnet alimentaire : suppression de la mention de migration V331 / Supabase dans l'erreur.
- Boissons : suppression de la mention de migration V392.
- Tracker protocole : suppression de « active la migration Supabase ».
- Profil / compte : suppression de « Connexion Supabase indisponible » et de « Installe le SQL V442 ».
- Notifications : les erreurs techniques Supabase deviennent des messages utilisateur génériques.
- Notre journée ensemble : les erreurs techniques Supabase deviennent un message fonctionnel.
- Mon Équilibre : les erreurs techniques Supabase deviennent un message fonctionnel.
- Mes suivis : « comme dans Santé » devient « Dernière donnée enregistrée · touche un repère pour voir son évolution ».
- Loader historique : « Ouverture du club privé » devient « Ouverture de ton espace ».

## Ce qui ne change pas

- aucune requête, table ou RPC Supabase ;
- aucune priorité de source ;
- aucun calcul de jauge ou de suivi ;
- aucune sauvegarde ;
- aucune synchronisation ;
- aucune règle protocole ;
- aucune mention légale de Supabase dans la politique de confidentialité ou les mentions légales.

Les paramètres de cache des scripts concernés sont simplement passés à `v470-nettoyage-final-r1` afin que le build iOS charge immédiatement les textes nettoyés.
