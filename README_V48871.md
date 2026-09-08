# MÉTHODE TEE — V488.7.1
## Correctif ciblé après test 30 / 45 / 70 €

Pré-requis : backend V488.7 déjà validé (`v4887_strict_ready_cultural = 4`).

### Ce que corrige ce patch

1. **Budget 70 € / mode flexible**
   - La liberté budgétaire ne doit plus autoriser une fiche très mal chiffrée.
   - Tant qu'au moins un candidat frais avec **>= 75 % de couverture prix** existe, les candidats sous 75 % ne sont pas sélectionnés.
   - Le mode 30 € et le mode 45 € conservent leur logique actuelle.
   - Le budget reste un repère / plafond : le moteur n'essaie pas de dépenser artificiellement toute l'enveloppe.

2. **Plats externes / whole-dish répétés**
   - Détection renforcée : `status = planner_food_whole_dish_v1` OU item `resolution_status = whole_dish_strict` OU `strict_match_mode = dictionary_id`.
   - Une deuxième portion achetée d'un plat CIQUAL/culturel est affichée **« À nouveau · … »**, pas « Restes · … ».
   - Les vraies recettes préparées en double gardent **« Restes · … »**.

### Aucun SQL à exécuter
Le backend V488.7 est déjà correct. Ne pas rejouer V488.7.

### Fichiers à uploader
- `tee-next.html`
- `www/tee-next.html`
- `scripts/tee-next.js`
- `www/scripts/tee-next.js`

Puis recharger complètement l'application et refaire 30 €, 45 €, 70 €.
