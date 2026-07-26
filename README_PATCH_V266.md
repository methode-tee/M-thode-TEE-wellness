# PATCH V266 — Compléments des types + titre de l’accueil

Base utilisée : `M-thode-TEE-wellness-main 265(2).zip`

## Modifications strictement incluses

- Suivi : historique visible sur 7 jours, moyenne des valeurs numériques, consultation et correction d’une ancienne date, synchronisation cloud des 7 derniers jours.
- Plan du parcours : jours passés et jour actuel désormais ouvrables depuis la chronologie ; jours futurs visuellement verrouillés.
- Routine : bouton de démarrage, durée estimée, minuteur manuel, mode « Tout afficher », progression enregistrée avec la date, état terminé conservé. Une routine quotidienne peut être déclarée avec `[[routine_repeat:daily]]`.
- Guide terrain : rendu botanique structuré par intertitres `##`, avec styles dédiés pour « Anecdote méconnue » et « Note de Tee ».
- PDF premium, Ebook, Document et Document privé : rendus distincts au lieu d’un lecteur générique unique.
- Accueil : remplacement exact de `Rituel collectif` par `Notre journée ensemble`, sans emoji ajouté.

## Performance préservée

- Aucun script supplémentaire chargé.
- Aucun appel réseau au chargement général de l’accueil.
- L’historique du Suivi utilise une seule requête bornée aux 7 derniers jours, uniquement à l’ouverture du contenu.
- Le minuteur ne démarre qu’après action de l’utilisateur et s’arrête automatiquement lorsque le panneau est fermé.
- Les iframes PDF/Ebook utilisent `loading="lazy"`.
- Aucune modification de Stripe, Supabase Auth, achats, déblocages, navbar, notifications ou progression générale.

## Contrôles effectués

- `node --check` réussi sur les 4 fichiers JavaScript modifiés.
- Copies racine et `www/` synchronisées.
- Recherche confirmant l’absence de l’ancien libellé `Rituel collectif` dans les fichiers modifiés.
- Aucun nouveau listener global ajouté.

## Fichiers à uploader

Conserver exactement l’arborescence du ZIP et remplacer uniquement les fichiers présents dans ce patch.
