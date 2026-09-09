# MÉTHODE TEE — V488.8.3.2 · MÉMOIRE DISCRIMINANTE + FIABILITÉ 100 %

Correctif **frontend uniquement**, cumulatif sur V488.8.3.1 déjà installé côté Supabase.

## Ce qui change
1. **Fiabilité avant mémoire, sur tous les budgets 30 / 45 / 70 €**
   - tant qu'un candidat à 100 % chiffrable est disponible, une fiche partielle n'est pas sélectionnée ;
   - la mémoire n'a plus le droit de faire remonter une fiche 75 % au-dessus d'un candidat 100 %.

2. **Mémoire réellement discriminante**
   - la mémoire active construit un sous-pool familier relatif au profil à partir des aliments, composants, catégories et cuisines réellement enregistrés ;
   - le signal personnel pèse nettement davantage dans le score ;
   - on évite toujours les repas exacts récents lorsqu'une alternative existe.

3. **Différence mesurable entre profils**
   - sur 7 choix frais : cible de 5 choix guidés par le profil + 2 choix ouverts ;
   - avec réutilisation/restes : cible ajustée à 4–5 choix guidés selon le nombre réel de choix frais ;
   - une seule nouveauté vraiment éloignée reste autorisée lorsque des alternatives familières existent.

4. **Culture**
   - les règles V488.8.3.1 restent intactes : Mafé / Yassa / Poulet DG spécifiques, maximum 1/semaine par défaut sauf familiarité réelle.

## Installation
Aucun SQL. Remplacer uniquement :
- `scripts/tee-next.js`
- `www/scripts/tee-next.js`
- `tee-next.html`
- `www/tee-next.html`

Pour tester le web : uploader ces 4 fichiers sur `methodetee.app`, puis ouvrir une navigation privée / rechargement propre.
Xcode n'est nécessaire qu'après validation web pour intégrer la même version au binaire iOS.

## Tests attendus
- Compte vierge : comportement mainstream, 100 % chiffrable si le pool 100 % existe.
- Compte avec mémoire active : semaine sensiblement différente du compte vierge, majoritairement proche de l'univers enregistré, sans répéter exactement les repas récents.
- Même budget + deux comptes différents : le debug `window.mtLastPlannerDebug.memory` expose `memoryGuidedUsed`, `memoryOpenUsed`, `reliableFallbackUsed` pour vérifier la discrimination.
