# PATCH V482 — Voix premium & correctifs de compréhension

## Ce patch corrige

### 1) Bouton **« Modifier ma phrase »**
Le bouton ne faisait rien dans la modale de vérification.  
Cause : il appelait un rendu prévu pour un autre écran (`mtVoiceBody`).

**Correctif :**
- ajout d’un vrai mode d’édition directement dans la sheet courante ;
- conservation de la phrase déjà dictée ;
- possibilité de relancer immédiatement l’analyse ;
- bouton « Réessayer le micro » conservé.

### 2) Quantités saisies qui ne débloquent pas la suite
Quand un champ de grammes était rempli, l’interface ne relançait pas la résolution.

**Correctif :**
- écoute sur `input`, `change`, `blur` et `Enter` ;
- relance automatique (debounced) de la compréhension ;
- activation plus fluide du bouton de confirmation.

### 3) Doublons de reconnaissance trop faibles
Exemple remonté : **« taro sauce jaune »** qui affichait à la fois un item faible (`taro` / `tarot`) et le plat composite **Achu / Taro sauce jaune — Cameroun**.

**Correctif :**
- filtrage d’affichage des items faibles quand un item plus fort/résolu couvre déjà la même intention ;
- objectif : éviter les doublons parasites sans toucher aux vraies reconnaissances utiles.

### 4) Chargement plus premium pendant la compréhension
Le simple état texte de chargement a été remplacé par une présentation plus éditoriale.

**Ajouts :**
- carte premium animée ;
- logique « carnet vivant » ;
- progression visuelle ;
- rappel de la phrase analysée ;
- style cohérent avec l’univers Méthode Tee.

### 5) Cache-busting
`index.html` et `www/index.html` pointent désormais vers :

`scripts/home-smart-cards.js?v=v482-voix-premium-fix-r1`

---

## Fichiers à remplacer

- `index.html`
- `www/index.html`
- `scripts/home-smart-cards.js`
- `www/scripts/home-smart-cards.js`

---

## Vérification rapide conseillée

1. Accueil → **Mon repas** → **Le dire à TEE**.  
2. Dicter : `J'ai mangé deux oeufs, deux tartines d'avocat et un oeuf poché`.  
3. Vérifier que **Modifier ma phrase** ouvre bien un éditeur.  
4. Revenir et tester un cas demandant une quantité en grammes.  
5. Saisir une quantité → vérifier que l’écran se rafraîchit tout seul.  
6. Tester `taro sauce jaune` → l’affichage ne doit plus garder un doublon faible parasite si le plat composite a déjà été reconnu.

---

## Remarque produit / UX
Ce patch améliore le chargement du flux vocal.  
Si tu veux, je peux faire un **V483** dédié au loader des recettes/fiches privées pour lui donner exactement le même niveau premium (carnet, écriture, progression éditoriale, informations utiles pendant l’attente).
