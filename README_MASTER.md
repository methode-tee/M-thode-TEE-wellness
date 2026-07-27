# Méthode Tee — Référence technique consolidée

## Source de vérité

La source active du projet est la **racine du dépôt**.

- Les pages web actives sont à la racine.
- Leur copie embarquée par Capacitor est dans `www/`.
- Le projet iOS actif est dans `ios/App/`.
- Les migrations Supabase restent dans `supabase/`.
- Les anciens dossiers de livraison partielle ne sont pas des sources actives.

## Règle de synchronisation

Après toute modification web validée :

```bash
npm install
npx cap sync ios
```

Puis ouvrir le projet iOS :

```bash
npx cap open ios
```

## Fichiers à ne pas confondre

- Racine : source web principale et version Git.
- `www/` : copie web utilisée par Capacitor après synchronisation.
- `ios/App/App/public/` : sortie générée par Capacitor, à ne pas éditer manuellement.
- `www_build20_incomplet/` : ancienne copie incomplète, à supprimer.
- `Methode-Tee-V235-IAP-ONLY-FICHIERS-A-UPLOAD/` : ancien paquet partiel, à supprimer.

## Confidentialité iOS

Le fichier actif est :

```text
ios/App/App/PrivacyInfo.xcprivacy
```

Il est ajouté à la cible iOS dans `ios/App/App.xcodeproj/project.pbxproj`.
Il déclare :

- absence de suivi publicitaire par l’application ;
- aucun domaine de tracking ;
- utilisation de `UserDefaults` uniquement pour les réglages et états propres à l’application (`CA92.1`).

Les déclarations de confidentialité dans App Store Connect doivent rester cohérentes avec les données réellement collectées par Supabase, l’authentification, les achats et les journaux utilisateur.

## Performance — règle absolue

Ne pas réintroduire :

- cache du HTML complet des cards ;
- images masquées avec `opacity: 0` en attente de JavaScript ;
- double rendu des grilles ;
- attente bloquante du préchargement des images ;
- modification globale des pages pour corriger une seule rubrique.

Les images doivent charger indépendamment du texte et des cards.

## Publication Git et iOS

```bash
git status
git add .
git commit -m "Description claire"
git pull --rebase origin main
git push origin main
npx cap sync ios
npx cap open ios
```

Dans Xcode : augmenter le numéro de build, sélectionner un appareil générique iOS, puis `Product > Archive`.

## Historique

Les anciens `README_PATCH_*` peuvent être archivés dans `docs/archive/patch-history/`. Ils ne doivent plus servir de source principale. Le présent fichier est la référence de départ pour toute nouvelle intervention.
