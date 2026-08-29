# MÉTHODE TEE — PATCH V418 · CLAVIER SAFARI/iOS STABLE

Version : **1.1.0** — Build : **42**

## Correctif

V417 recalait la hauteur de `.shell` sur `visualViewport.height` pendant l’ouverture du clavier. Sur Safari iOS, cette hauteur correspond précisément à la zone visible réduite par le clavier et pouvait donc raccourcir brutalement l’application, laissant apparaître une grande zone beige vide.

V418 retire entièrement cette stratégie.

- `--mt-app-height` est gelé à la dernière hauteur stable tant qu’un champ texte est actif.
- Aucun `height`, `min-height` ou `max-height` de `.shell` n’est modifié lors de la saisie.
- La navbar est masquée uniquement avec `opacity/visibility`; elle reste dans le flux et ne provoque aucun reflow.
- `.page` reste le seul scroller. Le champ actif est repositionné juste au-dessus du clavier via `visualViewport`, sans redimensionner la page.
- Après fermeture du clavier, la hauteur globale n’est réévaluée qu’après récupération du viewport.
- Correctif appliqué à Ajouter une boisson, Journée alimentaire, Ajouter/modifier un repas, Adapter mon repas et Inspire-moi.
- Le correctif global de `app.js` protège également les autres champs de saisie de l’application contre un effondrement de hauteur lié au clavier.

Aucun changement HealthKit, APNs, Supabase ou données utilisateur.
