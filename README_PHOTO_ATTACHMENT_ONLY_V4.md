# PATCH TEE — PHOTO EN PIÈCE JOINTE / FOCUS VOICE

Base : `M-thode-TEE-wellness-main 500 5.zip`

## Décision appliquée
La reconnaissance visuelle automatique du repas est mise en pause.
La photo reste disponible partout comme **pièce jointe au repas**.

### Ce qui change pour l'utilisateur
- Accueil : `Photographier` devient `Joindre une photo`.
- Depuis l'accueil, l'utilisateur peut prendre OU choisir une photo puis elle est jointe au formulaire du repas.
- Dans le repas : `Joindre une photo au repas · facultatif`.
- Dans `Ajouter avec TEE` : `Joindre une photo`.
- Plus de bloc `TEE pense reconnaître...`.
- Plus de choix automatiques issus de la photo.
- Plus de case `Aider TEE à mieux reconnaître les repas`.
- Recherche alimentaire, code-barres et Voice restent inchangés.

## Retrait technique de Photo Vision
- plus aucun appel JS à `FoodVision`
- plus de feedback / consentement Photo Vision côté app
- plugin iOS `FoodVision` non enregistré
- `FoodVisionPlugin.swift` neutralisé (fichier vide/commenté pour ne pas casser le projet Xcode existant)
- CSS Photo Vision supprimé
- les tables SQL V3 déjà créées peuvent rester : elles ne sont plus appelées et ne coûtent rien en usage

## Fichiers à remplacer
12 fichiers, exactement ceux présents dans ce ZIP.

## Après upload GitHub
Depuis la racine du projet :
```bash
git pull --rebase origin main
npx cap sync ios
npx cap open ios
```

Puis relancer le build Xcode.

Aucun nouveau SQL n'est nécessaire pour ce patch.
