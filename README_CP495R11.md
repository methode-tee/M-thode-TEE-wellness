# CP495R11 — Admin formules automatiques

Base : **M-thode-TEE-wellness-main 495.zip** + SQL CP495R10 / R10.1 déjà installés.

## Ce que change R11

Le mode normal de création d'une formule ne demande plus de saisir :

- `slot_code`
- `protein`, `starch`, `vegetable`, etc.
- les `profile_key`
- les whitelists techniques

Dans l'admin, Tee choisit seulement :

1. le ou les **aliments déclencheurs** avec leur vrai nom ;
2. l'intention de la variante ;
3. les **aliments exacts** de cette variante avec leur vrai nom.

Le serveur fait ensuite automatiquement :

- résolution vers les `profile_key` exacts ;
- lecture des capacités CP495 de chaque aliment ;
- déduction des rôles humains (protéine, féculent, végétal, aromatique, etc.) ;
- création des slots ;
- alignement des variantes même si les aliments ont été sélectionnés dans un ordre différent ;
- création de whitelists exactes par slot ;
- génération des bundles par intention ;
- publication dans `mt_adapter_profile_formulas_v5` ;
- connexion immédiate à Adapter sans nouvelle version de l'app.

Si un aliment possède plusieurs fonctions possibles, l'admin affiche un petit choix en français. Exemple : une lentille peut être utilisée comme **Protéine** ou **Féculent / base glucidique**. C'est le seul cas où Tee peut avoir à préciser le rôle.

Le mode technique historique est conservé dans **Réglages avancés**.

## Exemple

Déclencheur : **Saumon grillé**

Variante Équilibre 1 :
- Riz basmati cuit
- Courgettes
- Citron

Variante Équilibre 2 :
- Pommes de terre cuites
- Épinards
- Aneth

TEE construit automatiquement :
- Féculent / base glucidique
- Végétal
- Assaisonnement / aromatique

Puis chaque slot reçoit une **whitelist de profile_key exacts** issue uniquement des aliments choisis dans les variantes.

## Sécurité ajoutée

`mt_adapter_profile_formula_slots_v5` reçoit `allowed_profile_keys`.

Pour les nouvelles formules créées en mode simple :
- un aliment présent dans le repas ne valide un slot que s'il a la bonne capacité **ET** fait partie de la whitelist exacte du slot ;
- les formules historiques gardent `allowed_profile_keys = {}` et continuent à fonctionner comme avant.

La mémoire n'est pas modifiée. Elle reste utilisée uniquement pour classer les variantes après qu'une formule valide a été trouvée.

## Installation

### 1. Supabase
Exécuter :

`CP495R11_SQL_A_EXECUTER.sql`

L'audit final doit retourner :

`CP495R11_ADMIN_SIMPLE_FORMULA_BUILDER_INSTALLED`

avec notamment :
- `simple_builder_rpc = true`
- `simple_inference_rpc = true`
- `profile_search_v2 = true`
- `runtime_slot_whitelist_column = true`
- `formula_match_uses_exact_whitelist = true`
- `memory_preserved = true`

### 2. GitHub
Remplacer :

- `admin.html`
- `scripts/admin-adapter-formulas.js`
- `www/admin.html`
- `www/scripts/admin-adapter-formulas.js`

Aucun autre fichier n'est nécessaire pour R11.

## Utilisation

Dans l'admin :

**Nutrition & recettes → Adapter · Formules dynamiques**

Le **mode simple** est le mode par défaut.

Le bouton **Vérifier la structure** permet de voir ce que TEE a compris avant de publier.

Si deux variantes n'ont pas la même structure, la publication est refusée proprement. Exemple :
- variante 1 = féculent + végétal + aromatique
- variante 2 = féculent + laitage

Dans ce cas, ce sont deux formules différentes et il faut créer une deuxième formule.
