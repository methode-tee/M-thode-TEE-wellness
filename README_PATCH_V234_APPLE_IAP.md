# PATCH V234 — Migration Apple In-App Purchase (StoreKit 2)

Ce patch retire le mécanisme External Purchase du build iOS et branche les protocoles/recettes premium sur des achats intégrés Apple non consommables. Stripe reste disponible uniquement sur le web.

## À faire dans Supabase
1. Exécuter `supabase/V234_apple_in_app_purchase.sql`.
2. Déployer : `npx supabase functions deploy validate-apple-iap`.
3. Conserver/configurer les secrets : `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_PRIVATE_KEY`, `APPLE_BUNDLE_ID`.

## À faire dans App Store Connect
1. Créer un achat intégré **non consommable** pour chaque protocole/pack de recettes vendu dans l’app.
2. Utiliser un Product ID stable, par exemple `com.methodetee.protocol.sommeilprofond`.
3. Dans le studio admin Méthode Tee, copier ce Product ID dans le nouveau champ **Product ID Apple (IAP)** du contenu correspondant.
4. Pour le premier IAP, l’associer à la nouvelle version de l’app lors de la soumission.

## Xcode
- `npx cap sync ios` puis `npx cap open ios`.
- Target App → Signing & Capabilities : supprimer External Purchase Link si encore visible et ajouter **In-App Purchase**.
- Product → Clean Build Folder, puis Build.

## Test
Tester avec un compte Sandbox Apple : achat, annulation, achat en attente et bouton **Restaurer mes achats Apple**. Le déblocage n’est écrit dans Supabase qu’après validation de la transaction auprès d’Apple.
