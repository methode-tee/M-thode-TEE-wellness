# V487.4 — Réintégration UI native / patch chirurgical

Base de travail : ZIP 441 actuel. Le ZIP 434(2) a servi uniquement de référence
pour vérifier le contrat historique de mise en page (shell + main.page + navbar).

## Corrigé
- La navbar ne remonte plus : `tee-next.html` utilise maintenant `main.page`, comme
  les pages existantes de l'app. Le scroll reste dans la zone centrale et la navbar
  conserve sa place dans le shell.
- Sécurité plantes est entièrement scrollable, y compris les derniers champs et boutons.
- Le statut « Ouverture… » ne peut plus rester indéfiniment : authentification,
  préférences, catalogue et prix ont des délais bornés et une erreur lisible + Réessayer.
- `planner()` et `safety()` sont maintenant réellement `await` par l'initialisation.

## Profil
- Suppression de l'injection tardive par `tee-next-entry.js`.
- Suppression du CSS TEE+ sur `dashboard.html`.
- Méthode TEE+ est rendue directement dans `renderDashboard()` AVANT `observeReveal()`.
- Elle utilise uniquement les composants déjà existants du Profil :
  `mt-profile-section-heading`, `mt-profile-main-stack`, `mini-card`, `mtIconHTML`.
- Seulement 2 cartes : Planifier ma semaine + Sécurité plantes.

## Carnet / sécurité globale / prix
Aucun changement de logique :
- aucune 5e card Sécurité plantes dans Carnet ;
- couche phytothérapie invisible V487.3 conservée ;
- prix RNM / TEE_ADMIN conservés ;
- Composer avec Tee connecté aux prix conservé ;
- voice V485.3/V486.x non touché.

## SQL
Aucun SQL à exécuter. Le backend V487.3 déjà validé reste inchangé.

## Fichiers touchés
- dashboard.html + www/dashboard.html
- scripts/app.js + www/scripts/app.js
- tee-next.html + www/tee-next.html
- scripts/tee-next.js + www/scripts/tee-next.js
- styles/tee-next.css + www/styles/tee-next.css
