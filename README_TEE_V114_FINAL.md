# Méthode TEE — 1.1.4 FINAL

Base : `M-thode-TEE-wellness-main 500 8.zip`

- Sécurité plantes reliée au catalogue botanique réel + règles du profil.
- `high` forcé hors suggestions automatiques.
- Précautions visibles lors de la sélection d'une plante/boisson et app-wide.
- Admin botanique : ajout/modification/alias/précaution sans nouvelle build.
- Formules Adapter : toujours publiées côté serveur sans nouvelle build.
- Nouveau lien optionnel Formule → vraie fiche alimentaire + alias Voice.
- Voice n'accepte ce lien que s'il pointe vers une vraie identité alimentaire.
- Version iOS/Profil : 1.1.4 ; build Xcode : 47.

Ordre :
1. Exécuter `TEE_V114_FINAL_PHYTO_ADMIN_RUNTIME_SQL_A_EXECUTER.sql`.
2. Vérifier `TEE_1_1_4_FINAL_PHYTO_ADMIN_RUNTIME_INSTALLED`.
3. Uploader les fichiers app.
4. `git pull --rebase origin main`
5. `npx cap sync ios`
6. `npx cap open ios`

Fichiers modifiés/créés : 46
