# V486.4 — Correctif voice McDo / contexte de dictée

## Bug corrigé

Cas réel :
`J'ai mangé un burger Chicago, des frites grande portions des nuggets et ice tea`

Ce patch corrige deux familles de problème :

1. **Dictée / segmentation de contexte**
   - `burger Chicago` est traité comme une seule intention `Chicago` ;
   - `grande(s) portion(s)` après `frites` n'est plus créée comme aliment fantôme ;
   - une formulation sans `et` comme `frites grande portions des nuggets` est réparée avant V7 ;
   - `boisson ice tea` est recherché comme `ice tea`.

2. **Boucle de choix des frites**
   - la taille déjà prononcée est conservée (`spoken_size_hint`) ;
   - si l'utilisateur a dit `grande portion`, le bouton `McDonald's` envoie directement
     `mcdo_grande` ;
   - une fois la grande portion résolue, les anciennes options `McDonald's / Autres`
     ne réapparaissent plus.

## Non-régression

V485.3/V4, V486.1, V486.2 et V486.3 ne sont pas remplacés.
V486.4 crée `resolve_food_speech_phrase_v8_json`.

## Ordre SQL

1. `V4864_CORRECTIF_VOICE_MCDO_CONTEXT.sql`
2. `V4864_INSTALL_SHADOW_GATE_139.sql`
3. `V4864_RUN_GATE_V4853_INCHANGE_LECTURE_SEULE.sql`
4. `V4864_RUN_SHADOW_GATE_V8_LECTURE_SEULE.sql`
5. `V4864_SMOKE_CAS_REEL_LECTURE_SEULE.sql`

Attendu avant validation frontend :
- baseline V485.3 : 139/139 ;
- shadow V8 : 139/139 ;
- `burger Chicago` : un seul repère ;
- le smoke frites doit finir sur la grande portion McDonald's, avec
  `stale_alternatives = 0`.

## Frontend

Le frontend appelle désormais V8 et contient aussi un garde-fou local :
si `selected_option.status = resolved`, il ne réaffiche jamais les anciennes
alternatives du concept parent.

Le patch ne touche ni protocoles, ni XP, ni achats, ni validation de contenu.
