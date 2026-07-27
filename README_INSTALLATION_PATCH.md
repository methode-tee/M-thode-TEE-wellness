# Installation du patch V301

## Fichiers à copier

```text
ios/App/App/PrivacyInfo.xcprivacy
ios/App/App.xcodeproj/project.pbxproj
README_MASTER.md
docs/NETTOYAGE_PROJET.md
scripts/maintenance/cleanup-project.sh
```

## Après copie

Fermer puis rouvrir Xcode, ou choisir **Use Version on Disk** si Xcode indique que le projet a été modifié à l’extérieur.

Vérifier dans Xcode :

1. cible `App` ;
2. onglet **Build Phases** ;
3. section **Copy Bundle Resources** ;
4. `PrivacyInfo.xcprivacy` doit être présent.

Puis lancer :

```bash
npx cap sync ios
```

Le fichier de confidentialité est natif et ne modifie pas les performances web.

## Nettoyage facultatif

Commencer par l’aperçu :

```bash
bash scripts/maintenance/cleanup-project.sh
```

Puis seulement après contrôle :

```bash
bash scripts/maintenance/cleanup-project.sh --apply
```
