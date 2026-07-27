# Nettoyage sûr du dépôt

Le nettoyage proposé ne change aucun fichier d’exécution actif et n’affecte ni les performances, ni Stripe, ni Supabase, ni les protocoles.

## Éléments obsolètes ciblés

- `DELETE_THIS_OLD_FILE.txt`
- `FICHIER_A_SUPPRIMER.txt`
- `www/DELETE_THIS_OLD_FILE.txt`
- `www_build20_incomplet/`
- `Methode-Tee-V235-IAP-ONLY-FICHIERS-A-UPLOAD/`

## Documentation historique

Les fichiers `README_PATCH*`, `README_V*`, `README_IMPORTANT.txt`, `README_UPLOAD*` et `FICHIERS_DU_PATCH.txt` sont déplacés vers :

```text
docs/archive/patch-history/
```

Ils ne sont pas effacés : ils restent consultables dans Git, mais ne polluent plus la racine.

## Utilisation du script

Aperçu sans modification :

```bash
bash scripts/maintenance/cleanup-project.sh
```

Application réelle :

```bash
bash scripts/maintenance/cleanup-project.sh --apply
```

Ensuite :

```bash
git status
```

Contrôler la liste avant de commit.
