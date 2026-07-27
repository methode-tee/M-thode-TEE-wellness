#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dry-run}"
if [[ "$MODE" != "dry-run" && "$MODE" != "--apply" ]]; then
  echo "Usage: $0 [--apply]" >&2
  exit 2
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ARCHIVE="$ROOT/docs/archive/patch-history"

remove_targets=(
  "$ROOT/DELETE_THIS_OLD_FILE.txt"
  "$ROOT/FICHIER_A_SUPPRIMER.txt"
  "$ROOT/www/DELETE_THIS_OLD_FILE.txt"
  "$ROOT/www_build20_incomplet"
  "$ROOT/Methode-Tee-V235-IAP-ONLY-FICHIERS-A-UPLOAD"
)

shopt -s nullglob
archive_targets=(
  "$ROOT"/README_PATCH*
  "$ROOT"/README_V*
  "$ROOT"/README_IMPORTANT.txt
  "$ROOT"/README_UPLOAD*
  "$ROOT"/FICHIERS_DU_PATCH.txt
)
shopt -u nullglob

if [[ "$MODE" == "dry-run" ]]; then
  echo "=== APERÇU : aucun fichier ne sera modifié ==="
  for path in "${remove_targets[@]}"; do
    [[ -e "$path" ]] && echo "SUPPRIMER : ${path#$ROOT/}"
  done
  for path in "${archive_targets[@]}"; do
    [[ -e "$path" ]] && echo "ARCHIVER  : ${path#$ROOT/} -> docs/archive/patch-history/"
  done
  echo
  echo "Relance avec --apply pour appliquer."
  exit 0
fi

mkdir -p "$ARCHIVE"
for path in "${remove_targets[@]}"; do
  [[ -e "$path" ]] && rm -rf "$path"
done
for path in "${archive_targets[@]}"; do
  [[ -e "$path" ]] && mv "$path" "$ARCHIVE/"
done

echo "Nettoyage terminé. Exécute maintenant : git status"
