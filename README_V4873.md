# V487.3 — Sécurité plantes invisible dans l’app

## Carnet
La ligne/card « Sécurité plantes » ajoutée par V487.2 est supprimée.
Aucune 5e card n'est ajoutée au Carnet.

## Profil
Profil → Méthode TEE+ → Sécurité plantes reste l'endroit où l'utilisatrice
renseigne/modifie ses garde-fous et peut faire une vérification manuelle.

## Connexion invisible
Une couche globale MTPhytoSafety est chargée par app.js et vérifie automatiquement
les surfaces où TEE propose/affiche du contenu :
- Composer avec Tee
- Adapter mon repas
- Ton repère / guidance TEE
- protocoles et contenus
- parcours jour par jour / plante du jour
- futures surfaces marquées data-mt-phyto-safety

Si rien dans le profil ne déclenche une règle : rien n'est affiché.
Si une plante concernée apparaît : un avertissement compact est injecté dans
la suggestion concernée.

## Coût
Pas un RPC par résultat.
La page récupère une seule fois les règles actives du profil quand une surface
compatible apparaît, puis toutes les vérifications de cette page sont locales.

## Prix / RNM
Toute la V487.2 prix est conservée :
- RNM_DETAIL_FR
- TEE_ADMIN
- planificateur budget/prix
- Composer avec Tee relié aux prix et au planificateur.

## SQL
V487.3 est cumulatif :
1. V4873_TEE_PLUS_PRIX_RNM_SECURITE_INVISIBLE.sql
2. V4873_QA_LECTURE_SEULE.sql
