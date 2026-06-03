MÉTHODE TEE — PATCH V16.2 NAVBAR NYSSCIOUS

Correction ciblée : navbar uniquement.

Ce patch :
- garde le header/topbar actuel intact ;
- garde la navbar en bas ;
- la rend fixed dès l'entrée de page ;
- conserve le swipe horizontal ;
- affiche environ 5 items avec aperçu du suivant, comme Nysscious ;
- supprime l'effet navbar trop haute / trop éloignée ;
- force le cache en v=162.

Fichiers modifiés :
- styles/style.css
- fichiers HTML pour le cache bust v=162

Pas besoin de relancer SQL.
Pas besoin de redéployer Stripe.
