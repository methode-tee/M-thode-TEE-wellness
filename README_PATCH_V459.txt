PATCH V459 — RESTAURATION UPLOAD PROTOCOLE HISTORIQUE

But:
- Restaurer UNIQUEMENT le flux d'ajout/modification de contenu de protocole au comportement connu fonctionnel du ZIP 407(2) (identique au 389(1) sur ce flux).
- Aucun changement SQL.
- Aucun ajout de colonne file_path.
- Le fichier premium est envoyé via Supabase Storage SDK dans le bucket protocol-files puis le chemin interne est enregistré dans protocol_contents.file_url.

Fichiers fournis:
- admin.html
- scripts/admin.js
- www/admin.html
- www/scripts/admin.js

Important:
- Les fichiers proviennent du 407(2) fourni par l'utilisatrice, sauf le cache-busting de admin.js passé à v459-protocol-upload-historical-r1.
- Les autres zones de l'application ne sont pas modifiées.
- Pas de soumission App Store nécessaire: admin web uniquement.
