# V489.1.1 — Correctif rôles culinaires CIQUAL

V489.1 a correctement ouvert les 3 585 références CIQUAL au cerveau TEE, mais son classifieur de **rôle culinaire** était trop permissif. Une règle macro pouvait par exemple classer un fromage riche en protéines comme `protein`, ou un aromate riche en glucides comme `starch`.

Résultat observé : des assemblages absurdes du type **fromage bleu · abricot · oignon au vinaigre** ou **basilic · ail · oignon au vinaigre**.

V489.1.1 conserve l'univers CIQUAL complet mais sépare strictement :

- ce que le cerveau **connaît** ;
- ce que l'assembleur peut utiliser comme **protéine principale** ;
- **féculent principal** ;
- **légume principal** ;
- **plat composé complet** ;
- ce qui reste laitier, fruit, aromate, condiment, boisson, dessert ou autre.

Les fallbacks `protéines élevées => protein`, `glucides élevés => starch`, `kcal faibles => vegetable` sont supprimés pour la construction de repas. Une seconde barrière de cohérence est ajoutée dans le frontend.

## Installation

1. Exécuter `supabase/V48911_CORRECTIF_ROLES_CULINAIRES_CIQUAL.sql`.
2. Vérifier le JSON `v48911_result`.
3. Remplacer ensuite les 4 fichiers frontend du patch.
4. Tester sur methodetee.app en navigation privée.

Aucune ligne CIQUAL n'est modifiée.
