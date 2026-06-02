MÉTHODE TEE — V14.1 ADMIN CODE MASQUÉ

Correction :
- Le champ code admin est maintenant type="password".
- Le code OUTITA n’apparaît plus en placeholder ni en value.
- Le champ affiche seulement “Code admin”.
- Si le code est faux, le champ se vide.

Important :
Le code est toujours défini côté config/admin JS pour fonctionner sur GitHub Pages.
Pour une sécurité forte réelle, il faudra plus tard un rôle admin Supabase + règles RLS strictes.
