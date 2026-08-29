#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/Table_Ciqual_2025_FR_2025_11_03.xlsx"
URL='https://entrepot.recherche.data.gouv.fr/api/access/datafile/:persistentId?persistentId=doi:10.57745/RPWYZD'
echo 'Téléchargement de la table officielle ANSES Ciqual 2025…'
curl -L --fail --retry 3 "$URL" -o "$TMP"
python3 "$ROOT/qa/build_ciqual_micronutrients.py" "$TMP" "$ROOT/supabase/CIQUAL_2025_MICRONUTRIENTS_V419.csv"
echo "CSV complet régénéré : $ROOT/supabase/CIQUAL_2025_MICRONUTRIENTS_V419.csv"
echo 'Importe ensuite ce CSV dans public.ciqual_food_nutrients après avoir exécuté V419_MICRONUTRITION_ANALYTICS.sql.'
