# Patch V308 — Mon Équilibre : état de découverte

Base : branche `develop` fournie par l’utilisatrice.

## Corrections

- aucun score `0` n’est affiché lorsqu’aucune donnée réelle n’a encore été renseignée ;
- Vitalité affiche `— / À découvrir` ;
- Équilibre intérieur affiche `— / En construction` ;
- Régularité affiche `— / Premier jour` ;
- message d’accueil progressif, sans jugement ni faux mauvais score ;
- les vrais scores apparaissent dès qu’un premier repère réel est renseigné ;
- l’empreinte hebdomadaire affiche un état vide premium tant qu’aucune donnée n’existe ;
- le cache du module passe en version 4 afin de ne pas réafficher les anciens zéros.

## Performance

- aucune nouvelle requête ;
- aucun timer, polling ou observer ajouté ;
- aucune hauteur réservée ni squelette ajouté ;
- mêmes points d’actualisation qu’en V307 ;
- aucun fichier StoreKit, Stripe, Supabase, iOS, achats, accès ou protocoles modifié.

## Fichiers modifiés

- `scripts/tee-balance.js`
- `www/scripts/tee-balance.js`
- `styles/style.css`
- `www/styles/style.css`
