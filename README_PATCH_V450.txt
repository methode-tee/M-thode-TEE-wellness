PATCH V450 — REPÈRES CLIQUABLES / SHEET TOUJOURS ACCESSIBLE

Correctif ciblé sur V449.

1. Le lien sous « Résumé de ma journée » ouvre toujours un sheet au premier tap.
2. Si mt_reference_context répond, le sheet est immédiatement remplacé par les vrais repères personnels.
3. Si le RPC est indisponible, le sheet reste visible en état « Repères en mise à jour », sans faux zéro ni faux verdict, avec « Réessayer maintenant » et « Ouvrir Mon profil ».
4. Le sheet est scrollable avec 100dvh + safe areas iOS.
5. Cache-busters mis à jour pour forcer le nouveau JS sur web et bundle natif.

IMPORTANT : si V447 n'a pas encore été exécuté dans Supabase, exécuter supabase/V447_CORRECTIF_ENREGISTREMENT_REPAS_100_ARGUMENTS.sql. Sans ce SQL, le moteur serveur peut rester indisponible, mais V450 empêche désormais le bouton de sembler mort.

Aucun nouveau SQL V450.
