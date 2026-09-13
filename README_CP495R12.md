# CP495R12 — Intégrité globale resolver / formules / texte public

Base : ZIP 496.

## Ce que corrige R12

1. **Résolution préparation généralisée**
   - le cas `saumon grillé` est inclus ;
   - des alias de préparation sont générés pour les autres profils (`grillé`, `poêlé`, `rôti`, `vapeur`, `bouilli`, `sauté`, `fumé`, `cru`, etc.) ;
   - un alias automatique n'est publié que s'il pointe vers **une seule fiche exacte** ; s'il est ambigu, TEE conserve la désambiguïsation.

2. **Une mauvaise forme de plat ne peut plus être maquillée**
   - la garde serveur lit aussi le vrai libellé de la formule, pas uniquement `base_formula_code` ;
   - `salade`, `wrap`, `sandwich`, `bowl`, `soupe`, `smoothie`, `porridge`, `pizza` ne sont éligibles que si l'utilisateur ou la fiche d'ancrage demande réellement cette forme ;
   - le frontend n'échange plus un libellé réel comme `salade protéinée & céréale` contre un libellé plus convaincant.

3. **Les raisons ne sont plus inventées depuis le nom de l'aliment**
   - plus de `sésame -> légèrement grillé` sans preuve ;
   - les explications reposent uniquement sur le slot réel de la formule : végétal, féculent, aromatique, etc.

4. **La simplification des noms devient conservatrice**
   - `Saumon, cru` reste `Saumon, cru` ;
   - le fallback ne coupe plus tous les noms à la première virgule ;
   - les simplifications ciblées déjà propres restent disponibles pour quelques libellés CIQUAL connus.

5. **Un aliment sans `source_input` ne disparaît plus du texte**
   - les `source_input` disponibles sont conservés ;
   - ils sont complétés par les segments réellement tapés ;
   - le fait qu'un autre aliment possède `source_input` ne masque plus les autres aliments du repas.

## Installation

### 1. Supabase
Exécuter `CP495R12_SQL_A_EXECUTER.sql`.

R12 remplace le besoin d'exécuter CP495R11.2 séparément.

### 2. Audit
Vérifier notamment :
- `status = CP495R12_RESOLUTION_FORMULA_INTEGRITY_INSTALLED`
- `salmon_grilled_alias_target = true`
- `salmon_grilled_alias_best = true`
- `global_preparation_alias_rows > 0`
- `resolver_reads_profile_aliases = true`
- `formula_guard_reads_real_labels = true`
- `formula_guard_blocks_salad_by_label = true`
- `memory_preserved = true`
- `frontend_patch_required = true`

### 3. GitHub
Une fois l'audit SQL validé, remplacer :
- `scripts/adapter-v-engine.js`
- `scripts/food-adapter.js`
- `www/scripts/adapter-v-engine.js`
- `www/scripts/food-adapter.js`

## Tests conseillés après déploiement
- `saumon grillé` : la fiche `Saumon, grillé/poêlé` doit être prioritaire.
- `saumon cru` : l'état `cru` doit rester visible dans les textes publics.
- formule incorrecte de type `salade` sur une omelette sans mot `salade` : elle doit être écartée serveur.
- graines de sésame non grillées : aucune phrase ne doit inventer une torréfaction.
- repas avec 2 aliments dont un seul segment a `source_input` : les 2 doivent rester visibles dans `Tu peux garder...`.
