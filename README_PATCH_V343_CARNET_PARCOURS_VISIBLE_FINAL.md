# Patch V343 final — Mon parcours directement dans Carnet

Ce patch part du ZIP **M-thode-TEE-wellness-main 323.zip** et réunit les corrections V343 du cycle avec le nouveau calendrier directement visible dans Carnet.

## Installation

Décompresser l’archive à la racine du dépôt Méthode Tee puis accepter le remplacement des fichiers. Les miroirs `www/` sont inclus.

Aucune nouvelle migration SQL n’est requise si V331 et V338 ont déjà été exécutées.

## Nouvelle organisation de Carnet

L’ordre est désormais :

1. **Mon carnet & mes repères**
2. Texte d’introduction « Retrouve tes outils… sans te perdre. »
3. **Mon parcours** directement visible : légende, Mon rythme collectif, calendrier et pills
4. **Mes outils**
5. **Mes suivis**
6. Bibliothèque et contenus personnels

Le calendrier n’est pas enfermé dans une nouvelle card d’accès. Il est rendu directement dans la page avec sa présentation premium. Chaque jour reste cliquable pour ouvrir son détail complet.

Le raccourci **Trackers & checklists** a été retiré de Mes outils puisqu’il faisait doublon avec le calendrier désormais visible.

## Calendrier toujours à jour

Le calendrier intégré affiche les repères du mois ouvert :

- protocole ;
- hydratation ;
- sommeil ;
- checklist ;
- trackers et suivis personnels ;
- Journal privé ;
- photos ;
- routines et rituels ;
- alimentation ;
- Mon rythme collectif ;
- cycle estimé.

Les changements enregistrés dans un suivi, le Journal ou les autres repères rafraîchissent aussi le calendrier directement présent dans Carnet.

## Cycle corrigé

- « Mes règles ont commencé aujourd’hui » n’est plus demandé chaque jour.
- L’action ponctuelle de signalement apparaît seulement près de la prochaine période estimée ou sur une date déjà signalée.
- Le Jour du cycle est projeté automatiquement chaque jour dans Mon parcours sans saisie obligatoire.
- Pendant la **période menstruelle estimée**, la pill `Cycle J…` devient exceptionnellement rouge.
- Les autres phases gardent la couleur premium dorée/verte habituelle.
- Le détail d’une date affiche le jour et la phase estimée.

## Connexion des suivis

Les douze suivis produisent tous des pills et résumés datés compatibles avec Mon parcours : sommeil approfondi, digestion, reflux, équilibre alimentaire, évolution corporelle, peau, performance & récupération, cycle, périménopause, jeûne intermittent, réduction du sucre et changement d’habitude.

Pour onze suivis, une pill apparaît lorsqu’une donnée est enregistrée. Le cycle est continu : son jour estimé apparaît automatiquement tant que le suivi est actif.

## Performance et éléments préservés

- Le contenu principal de Carnet s’affiche d’abord ; le mois du calendrier est chargé ensuite.
- Seul le mois ouvert est demandé, jamais tout l’historique.
- Le détail complet d’une date reste chargé au toucher.
- StoreKit 2, Stripe, achats et restauration Apple, Product IDs, déblocages, CIQUAL, service worker, préchauffage et « Notre journée ensemble » ne sont pas modifiés.

## Vérification rapide

1. Ouvrir Carnet et vérifier que Mon parcours apparaît sous l’introduction, avant Mes outils.
2. Vérifier la présence de la légende, de Mon rythme collectif, du calendrier et des pills.
3. Toucher une date et vérifier que son détail s’ouvre.
4. Vérifier qu’une période menstruelle estimée utilise une pill rouge et que les autres phases ne sont pas rouges.
5. Sur un Jour 11 folliculaire, vérifier que la question quotidienne sur le début des règles n’apparaît pas.
6. Enregistrer un suivi puis vérifier que la date correspondante se met à jour dans le calendrier de Carnet.
