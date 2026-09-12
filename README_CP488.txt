MÉTHODE TEE — CP488 · MASQUAGE DES DÉTAILS TECHNIQUES

Patch frontend uniquement. Aucun SQL.

À glisser à la racine du projet 488 en conservant l'arborescence :
- scripts/adapter-v-engine.js
- scripts/food-adapter.js
- www/scripts/adapter-v-engine.js
- www/scripts/food-adapter.js

Correction :
- les identifiants V_EXACT / V_MAIN / V_KNOW / V_SELF ne sont jamais affichés ;
- aucune mention « moteur », « IA », « RPC », « profil », « membership », etc. n'est affichée dans « Pourquoi ce choix ? » ;
- les explications CP487 restent internes et ne sont plus injectées dans l'UI ;
- « Pourquoi ce choix ? » n'affiche que des raisons alimentaires simples et compréhensibles ;
- filtre de sécurité final côté rendu pour empêcher une fuite technique future.
