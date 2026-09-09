# Méthode TEE — V489.2.2

Correctif à appliquer **après V489.2.1**.

## Pourquoi cette version

Le test réel a montré deux problèmes restants :

1. appuyer plusieurs fois sur « Construire ma semaine » pouvait remettre presque les mêmes plats ;
2. un libellé CIQUAL comme « Mélange de fromages râpés (spécial pâtes...) » pouvait encore être mal classé comme féculent à cause du mot « pâtes » présent dans sa description.

## Ce que corrige V489.2.2

- la génération immédiatement précédente devient une vraie contrainte de rotation :
  - **maximum 2 plats identiques** avec la génération précédente quand le pool fiable le permet ;
  - relâchement automatique seulement si le pool devient trop étroit ;
- la mémoire persistante conserve désormais les **composants CIQUAL** utilisés ;
- une nouvelle assiette CIQUAL ne recycle pas simplement le même duo féculent + légume en changeant seulement la protéine ;
- deux assiettes CIQUAL de la même semaine ne réutilisent pas le même composant principal quand assez d'alternatives existent ;
- seuil d'assemblage CIQUAL relevé de **0,72 à 0,78** ;
- fromages/laitages pluriels sont bloqués comme piliers protéine/féculent/légume ;
- les longues précisions industrielles CIQUAL restent dans la donnée source mais sont raccourcies dans le titre visible ;
- la règle **1 plat culturel spécifique maximum/semaine** de V489.2.1 reste intacte ;
- priorité aux candidats **100 % chiffrables** inchangée ;
- aucun prix inconnu n'est transformé en 0 € ;
- aucune IA externe.

## Ordre

1. Exécuter seulement `supabase/V48922_ROTATION_FORTE_CIQUAL_CULINAIRE.sql`.
2. Envoyer le JSON `v48922_result`.
3. Si les deux RPC V2 sont `true`, remplacer ensuite les 4 fichiers frontend :
   - `tee-next.html`
   - `www/tee-next.html`
   - `scripts/tee-next.js`
   - `www/scripts/tee-next.js`
4. Tester sur methodetee.app avant Xcode.

## Test attendu

Avec le même compte, même budget et même mode :

- Génération A : 7 plats.
- Génération B juste après : idéalement **0 à 2 plats communs**, et jamais seulement un réordonnancement quand le pool fiable dispose d'alternatives.
- Génération C : nouvelle rotation, sans recycler systématiquement les mêmes composants CIQUAL.
