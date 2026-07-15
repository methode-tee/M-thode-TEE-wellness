MÉTHODE TEE — PATCH V228

Objectif : corriger uniquement la page « Aucun achat en attente trouvé » sans modifier le mécanisme Apple StoreKit External Purchase Link du build 224.

Fichiers à remplacer/ajouter :
- checkout.html
- www/checkout.html
- supabase/functions/resolve-external-purchase-intent/index.ts

Après upload GitHub et git pull sur le Mac, déployer la fonction :
npx supabase functions deploy resolve-external-purchase-intent

Aucun fichier iOS, Info.plist, entitlement ou plugin Swift n'est modifié par ce patch.
