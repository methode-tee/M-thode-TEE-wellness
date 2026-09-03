# PATCH V467 — Alignement des ressources « Offert par Tee »

Base : **M-thode-TEE-wellness-main 420.zip**.

## Correctif unique

Dans **Carnet → Bibliothèque → Offert par Tee**, les cartes du carrousel gardent maintenant la même hauteur visible dans une rangée et le bouton **« Ajouter à ma bibliothèque → »** reste aligné en bas de la carte, même lorsque le titre, la description ou les métadonnées occupent davantage de lignes sur une ressource.

Le même alignement est appliqué à l'état **« Dans ma bibliothèque · Ouvrir »**.

## Ce qui ne change pas

- aucun JavaScript ;
- aucune donnée Supabase ;
- aucun SQL ;
- aucun comportement d'ajout à la bibliothèque ;
- aucun contenu ni texte ;
- aucune taille de police ou largeur de carte.

Le patch touche uniquement le layout CSS des cartes offertes et incrémente le cache CSS de `library.html` afin que Safari/iPhone récupère immédiatement le correctif.

## Fichiers

- `styles/style.css`
- `www/styles/style.css`
- `library.html`
- `www/library.html`
