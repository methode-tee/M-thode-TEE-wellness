PATCH V372 — MES FAVORIS & MES ROUTINES

Base : M-thode-TEE-wellness-main 346.zip

IMPORTANT
Exécuter AVANT le test du patch :
  supabase/V372_FAVORIS_ROUTINES_PERSONNELLES.sql

AUCUNE animation existante n’a été modifiée.

============================================================
1. MES FAVORIS = « JE VEUX LE RETROUVER »
============================================================

- Mes favoris n’est plus mélangé à Mes routines.
- Suppression de la limite locale silencieuse de 80 favoris.
- Favoris local-first :
  • le bouton réagit immédiatement sur l’appareil ;
  • l’ajout/suppression est synchronisé dans public.user_favorites.
- Aucune lecture Favoris supplémentaire au démarrage.
- La synchronisation cloud se fait :
  • lorsqu’on ajoute/retire un favori ;
  • lorsqu’on ouvre Mes favoris.
- À la première ouverture V372, les anciens favoris locaux sont envoyés une fois
  vers Supabase avant que le cloud devienne la référence.
- Changement d’appareil : ouvrir Mes favoris restaure la collection.
- Suppression depuis un autre appareil : la suppression reste supprimée au prochain
  chargement cloud, l’ancien cache ne la recrée pas.
- Bouton ♥ directement dans la liste Mes favoris pour retirer un élément.

Favoris désormais pris en charge :
- Posts du Feed
- Recettes accessibles
- Contenus de Bibliothèque déjà accessibles :
  PDF / documents, audio, pharmacopée, routines, rituels, contenus de protocole, etc.

SÉCURITÉ DES CONTENUS PREMIUM
- Un favori ne crée JAMAIS de droit d’accès.
- Une recette premium est revérifiée avant réouverture.
- Un favori Bibliothèque ne réutilise jamais son payload pour contourner un accès :
  l’app reconstruit d’abord la Bibliothèque réellement accessible, puis ouvre le contenu.
- Si le droit n’existe plus, le contenu ne s’ouvre pas.

============================================================
2. MES ROUTINES = « JE VEUX LE PRATIQUER »
============================================================

Mes routines n’est plus un deuxième dossier de favoris.

Nouvelle logique :
- créer une routine personnelle ;
- lui donner un nom et une intention ;
- choisir le moment :
  Matin / Dans la journée / Soir / À tout moment ;
- choisir la fréquence :
  Tous les jours / Lun-Ven / Week-end / Jours choisis / À la demande ;
- écrire de vraies étapes ;
- modifier ou retirer une routine ;
- réaliser les étapes chaque jour.

Exemples possibles :
- Routine du matin
- Retour au calme
- Récupération après entraînement
- Mobilité
- Préparation du sommeil

============================================================
3. FEED ET BIBLIOTHÈQUE
============================================================

FEED
Ancien bouton :
  + Routine

Nouveau :
  + À une routine

Appuyer dessus n’ajoute plus arbitrairement le post dans un deuxième dossier.
L’utilisateur choisit :
- une routine existante ;
- ou « Créer une routine avec ce contenu ».

Les anciens éléments enregistrés dans l’ancien bucket « routines » ne sont pas perdus :
à la première ouverture de Mes routines, ils sont transférés vers Mes favoris.

BIBLIOTHÈQUE
Ancien rayon :
  Tes routines

Nouveau rayon :
  Routines & rituels

Il représente les contenus Méthode TEE disponibles.

Lorsqu’un vrai contenu de type routine est ouvert :
- ♡ Favori
- + Ajouter à une routine

« Routines & rituels » = contenus Méthode TEE.
« Mes routines » = pratiques personnelles choisies par l’utilisateur.

============================================================
4. AUJOURD’HUI
============================================================

Suppression de la fausse mission générique « Routine du matin ».

Aujourd’hui utilise maintenant les routines PERSONNELLES réellement programmées.

Exemple, si une seule routine est prévue :
  Retour au calme
  3 étapes · À faire

Si plusieurs routines sont prévues :
  Mes routines
  1 / 2 complétée

Quand aucune routine n’est programmée :
- elle ne crée pas artificiellement une mission dans le calcul ;
- un bouton discret « Configurer mes routines » reste accessible.

Une routine « À la demande » reste disponible dans Mes routines mais n’est pas imposée
comme mission quotidienne.

============================================================
5. MON PARCOURS
============================================================

Quand une routine est réellement complétée :
- daily_activity.has_routine est mis à jour ;
- today_checks.routine est cohérent ;
- Mon parcours enregistre la routine de la journée.

Quand on ouvre le détail d’une journée dans Mon parcours, le nom réel des routines
complétées peut maintenant apparaître, par exemple :
  Routine
  Retour au calme

ou :
  Routines
  Routine du matin · Récupération

La lecture détaillée user_routine_entries n’est effectuée que lorsqu’une date est ouverte,
jamais au démarrage du calendrier.

============================================================
6. MON ÉQUILIBRE
============================================================

Le signal Routine déjà utilisé par Régularité n’est plus une coche générique.

Il correspond maintenant à une routine réellement accomplie :
- si une seule routine est programmée : elle doit être complétée ;
- si plusieurs routines sont programmées : toutes les routines programmées doivent être
  complétées pour valider la mission Routine de la journée.

Les routines « À la demande » ne créent pas une obligation quotidienne.

Aucun nouveau système de score parallèle n’a été ajouté.

============================================================
7. SUPABASE / PERFORMANCE
============================================================

Nouvelles données :
- user_favorites enrichie avec métadonnées/payload ;
- user_routines enrichie avec étapes, moment, fréquence, jours ;
- nouvelle table user_routine_entries.

RLS :
- chaque utilisateur ne voit/modifie que ses propres favoris/routines/entrées.

Performance :
- AUCUNE lecture Favoris ajoutée au démarrage ;
- Aujourd’hui ne gagne AUCUNE requête réseau :
  l’ancienne lecture directe daily_activity est remplacée par
  today_activity_summary(), qui renvoie le même état + le petit résumé des routines ;
- les détails de routine de Mon parcours sont chargés uniquement au clic sur une date ;
- aucun Realtime ajouté.

============================================================
8. COMPATIBILITÉ
============================================================

Le SQL :
- crée les tables si elles n’existent pas ;
- ajoute uniquement les colonnes manquantes ;
- conserve les anciennes user_routines ;
- transforme une ancienne routine sans étapes en routine avec une étape minimale ;
- contient les colonnes daily_activity historiques nécessaires afin d’éviter les problèmes
  de migrations manquantes rencontrés précédemment.

============================================================
9. CACHE
============================================================

- app.js            → v372-favoris-routines
- v14-luxe.js       → v372-favoris-routines
- v18-premium.js    → v372-favoris-routines
- journal.js        → v372-favoris-routines
- styles/style.css  → v372-favoris-routines

============================================================
10. VÉRIFICATIONS
============================================================

- node --check OK sur app.js, v14-luxe.js, v18-premium.js et journal.js.
- copies root/www identiques.
- aucun ancien « + Routine » actif.
- aucune limite .slice(0,80) dans le nouveau moteur Favoris.
- aucun « Routine du matin » générique dans le nouveau app.js.
- aucun changement d’animation existante.
