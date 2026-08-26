# Patch cumulatif V374 — Smoothies, desserts et lecture PDF fiable

Ce ZIP remplace entièrement les patchs V368 à V372 non installés.

## Documents PDF

- « Lire » ouvre de nouveau le lecteur PDF natif de l’iPhone ou du navigateur.
- Toutes les pages du document sont accessibles, avec le zoom et la navigation habituels.
- « Partager » et « Enregistrer » restent disponibles dans la fiche Méthode Tee.
- Aucun PDF n’est préchargé par ces trois actions : le fichier est demandé uniquement après une action de la personne.

## Nouvel outil

- `Carnet > Mes outils > Inspirer mon prochain repas`
- La personne indique les ingrédients disponibles et choisit une intention.
- Tee sélectionne une seule idée parmi le catalogue alimentaire activé.
- Le résultat distingue les ingrédients déjà présents et ceux à prévoir.
- Une autre idée peut être demandée sans relancer une lecture distante.
- Les idées enregistrées restent localement sur l'appareil.
- Une saisie d'ingrédients courants produit un intitulé neutre et précis.
- Un nom culturel n'est affiché que si le plat est saisi ou réellement caractérisé.
- Les composants des plats culturels peuvent inspirer la composition sans imposer leur nom.
- Les listes naturelles sans virgules sont découpées en ingrédients propres.
- Les articles « du », « de la » et « des » ne polluent plus les intitulés.
- Oignon, persil et autres aromates ne remplacent pas une portion végétale.
- Le résultat affiche clairement « Tu as déjà », « À prévoir », la préparation et « Pourquoi ce choix ? ».
- Les articles sont ajoutés naturellement dans les consignes de préparation.
- La justification explique les rôles des ingrédients réellement reconnus et varie avec l'intention choisie.

## Smoothies et desserts

- La forme est déduite automatiquement à partir des ingrédients : smoothie, verrine ou pudding de chia.
- Exemple : `yaourt grec + lait d’amande + framboises + myrtilles` devient un smoothie aux fruits rouges, sans demander de choisir un type de plat.
- Sans lait, `yaourt grec + fruits rouges` devient plutôt une verrine.
- `lait de coco + graines de chia + fruits` devient un pudding.
- L'intention modifie uniquement le complément utile : énergie, digestion, construction, légèreté ou gourmandise.
- « Adapter mon repas » reconnaît aussi ces préparations et ne propose jamais de légume, d'œuf, de poulet ou de poisson dans ce contexte.
- La migration SQL ajoute 17 smoothies et desserts activés au dictionnaire partagé par la saisie des repas, l'adaptation et l'inspiration.

## Données et performances

- Le catalogue léger existant est partagé avec Mon Équilibre.
- Il est conservé sept jours dans le cache local.
- Aucune nouvelle requête Supabase n'est ajoutée.
- La migration `supabase/V391_SMOOTHIES_DESSERTS_ADAPTABLES.sql` complète la table existante sans créer de table.
- Exécuter cette migration une seule fois dans l'éditeur SQL Supabase après avoir appliqué le patch. Elle est idempotente et peut être relancée sans doublon.
- Aucun média et aucun historique personnel ne sont chargés par cet outil.

Conserver l'arborescence lors du remplacement des fichiers.
