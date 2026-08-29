#!/usr/bin/env python3
"""Transforme la feuille officielle CIQUAL 2025 en import long Supabase.

Les valeurs qualifiées (<, traces, tirets) ne sont jamais converties en nombres :
le moteur préfère une donnée absente à une quantité inventée.
"""
import csv, re, sys
from pathlib import Path
from openpyxl import load_workbook

SPECS = {
    "calcium_mg": (51, "mg"), "iron_mg": (54, "mg"), "iodine_ug": (55, "µg"),
    "magnesium_mg": (56, "mg"), "potassium_mg": (59, "mg"), "selenium_ug": (60, "µg"),
    "zinc_mg": (62, "mg"), "vitamin_d_ug": (66, "µg"), "vitamin_c_mg": (73, "mg"),
    "vitamin_b9_ug": (79, "µg"), "vitamin_b12_ug": (83, "µg"),
}
EXACT = re.compile(r"^[+-]?\d+(?:[,.]\d+)?$")

def number(value):
    if isinstance(value, (int, float)): return float(value)
    text = str(value or "").strip().replace(" ", "")
    return float(text.replace(",", ".")) if EXACT.match(text) else None

def main(source, output):
    ws = load_workbook(source, read_only=True, data_only=True)["composition nutritionnelle"]
    output = Path(output); output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["ciqual_code","nutrient_key","value_100g","unit","source","source_version"])
        writer.writeheader()
        for row in ws.iter_rows(min_row=2, values_only=True):
            code = str(row[6] or "").strip()
            if not code: continue
            values = {}
            for key, (column, unit) in SPECS.items():
                value = number(row[column - 1]);
                if value is not None and value >= 0: values[key] = (value, unit)
            omega3 = [number(row[index - 1]) for index in (45, 47, 48)]
            if any(value is not None for value in omega3): values["omega3_g"] = (sum(value or 0 for value in omega3), "g")
            for key, (value, unit) in values.items():
                writer.writerow({"ciqual_code":code,"nutrient_key":key,"value_100g":format(value,".10g"),"unit":unit,"source":"ANSES - Table Ciqual 2025","source_version":"2025-11-03"})

if __name__ == "__main__":
    if len(sys.argv) != 3: raise SystemExit("usage: build_ciqual_micronutrients.py SOURCE.xlsx OUTPUT.csv")
    main(sys.argv[1], sys.argv[2])
