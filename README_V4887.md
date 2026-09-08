# MÉTHODE TEE — V488.7
## Fiabilité du scoring + lot 1 de plats culturels stricts

### Pourquoi ce patch
Les tests V488.6.2 ont validé le pont externe : 9 plats CIQUAL stricts sont bien pris par le planificateur. Les captures 30/45/70 ont toutefois montré deux points à corriger :

1. en budget flexible (>55 €), certaines recettes à faible couverture prix pouvaient remonter trop facilement ;
2. un plat externe complet répété était affiché comme « Restes », alors qu'il s'agit en réalité d'une nouvelle portion/boîte à prévoir.

V488.7 corrige ces deux points et ajoute un premier lot culturel dont le prix du plat entier est actuellement documentable sans fallback ingrédient.

## Lot culturel activé
- Ramen — Japon — 350 g — 4,49 €
- Pad thaï — Thaïlande — 350 g — 5,70 €
- Soupe wonton — Chine — 350 g — 4,59 €
- Tom kha gai — Thaïlande — 350 g — 4,60 €

Les 4 entrées existaient déjà dans `food_dictionary`. Le SQL ne réécrit pas leur nutrition ni leurs composants facultatifs. Il ajoute uniquement l'autorisation planner « repas complet », une portion 1 part documentée et un prix whole-dish lié exactement au `food_dictionary_id`.

### Pourquoi pas encore Poulet DG / Ndolè / Mafé / Yassa ?
Ils restent dans `food_dictionary`, mais on ne leur donne pas un faux prix à partir de « poulet », « riz », « arachide », etc. Les anciennes références Picard pour Mafé/Yassa/Poulet DG ne fournissent pas toutes un prix retail actuel et exploitable au 08/09/2026. Les prix de restaurants trouvés sur le web ne sont pas injectés dans le budget courses. Ils pourront être ajoutés dès qu'une référence comparable récente et suffisamment précise est disponible.

## Correction scoring frontend
La couverture prix devient un signal de fiabilité indépendant du niveau de budget :
- 100 % chiffrable reçoit le meilleur bonus ;
- 80–99 % reste exploitable ;
- 50–79 % est pénalisé progressivement ;
- <50 % est fortement pénalisé même avec un budget de 70 €.

Le mode flexible autorise toujours davantage de coût et de variété, mais ne confond plus « budget élevé » et « coût mal documenté ».

Pour les plats whole-dish externes répétés, le libellé devient `À nouveau · ...` au lieu de `Restes · ...`. Les quantités/couts restent cumulés dans « À prévoir ».

## Ordre d'application
1. Exécuter `supabase/V4887_LOT1_PLATS_CULTURELS_STRICTS.sql` en entier dans Supabase.
2. Vérifier le JSON `v4887_result`. Attendu : `v4887_strict_ready_cultural = 4`.
3. Uploader ensuite ces 4 fichiers frontend aux mêmes emplacements :
   - `scripts/tee-next.js`
   - `www/scripts/tee-next.js`
   - `tee-next.html`
   - `www/tee-next.html`
4. Recharger complètement l'app.
5. Régénérer 30 €, 45 €, 70 €.

## Sécurité / périmètre
- recipes : inchangé
- CIQUAL : inchangé
- voice : inchangé
- protocoles : inchangé
- droits premium : inchangés
- signature RPC frontend : inchangée
- food_dictionary : uniquement `adapter_profile` des 4 plats du lot
- portions : 4 lignes dédiées V488.7
- prix : 4 lignes exactes V488.7
