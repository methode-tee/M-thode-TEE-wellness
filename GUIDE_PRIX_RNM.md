# Couche prix Méthode TEE — RNM + administration

## Principe
L'app ne contacte pas RNM à chaque utilisation. Les prix utiles sont importés / administrés
dans Supabase puis réutilisés localement par les RPC du planificateur.

Cela évite :
- une API payante ;
- une dépendance réseau RNM au moment où une utilisatrice planifie ;
- de stocker tout l'historique RNM.

## Sources prévues
- RNM_DETAIL_FR : prix de détail FranceAgriMer / RNM.
- TEE_ADMIN : prix que nous ajoutons nous-mêmes pour les aliments sans référence RNM.

## Ajouter un prix manuellement / après recherche
Exemple de forme SQL (remplacer les valeurs) :

select public.mt_admin_upsert_food_price_v1(
  p_source_code := 'TEE_ADMIN',
  p_source_item_label := 'Nom du produit ou aliment',
  p_price_eur := 0.00,
  p_price_basis := 'kg',
  p_food_dictionary_id := null,
  p_ciqual_code := null,
  p_match_term := 'nom de l aliment',
  p_country_code := 'FR',
  p_observed_on := current_date,
  p_verified := true,
  p_confidence := 'manual_verified',
  p_note := 'Source vérifiée le ...'
);

## RNM
Quand tu me fournis un export RNM .xls ou quand nous recherchons une série de cotations,
je peux générer les appels SQL de mapping vers food_dictionary/CIQUAL.

On privilégie le stade « détail » pour approcher le prix payé en magasin.

## Affichage
- Planifier ma semaine : coût documenté des ingrédients manquants + couverture prix.
- Composer avec TEE : repère €/kg, €/L ou €/unité pour les compléments proposés,
  sans inventer un coût total puisque les quantités exactes ne sont pas encore connues.
