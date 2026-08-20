# Patch V384 — État « Contenu terminé » persistant

Correctif construit depuis le ZIP 356.

## Correction

- Un contenu de protocole déjà terminé conserve son bouton vert « ✓ Contenu terminé » lorsqu'il est rouvert.
- Le bouton reste désactivé : la personne ne peut pas valider deux fois le même contenu.
- L'état est lu dans `protocol_progress.completed_content`.
- Une copie locale sert de secours sur le même appareil lorsque la connexion est momentanément indisponible.
- Après une nouvelle validation, l'état distant et le cache local sont actualisés ensemble.
- Les cartes du protocole continuent d'afficher « Terminé » et « Revoir ».
- Le calcul des XP existant reste inchangé et ne peut pas être déclenché une seconde fois.

Tous les types de contenus rattachés à un protocole sont concernés.

Aucune migration SQL n'est nécessaire et aucun style existant n'est modifié.
