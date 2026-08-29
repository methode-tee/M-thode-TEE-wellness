# Correctif V397 — à appliquer sur le ZIP 370

Ce dossier contient uniquement les fichiers modifiés. Dépose son contenu à la racine du dépôt GitHub et accepte le remplacement des fichiers existants.

Corrections incluses :

- suppression du compositeur de boissons, de ses intentions et de ses précautions ;
- ajout et modification d’une boisson uniquement depuis Ma journée alimentaire ;
- résultats de recherche des ingrédients présentés comme la recherche alimentaire, en lignes lisibles ;
- conservation du nom libre lorsque l’ingrédient n’existe pas dans la bibliothèque ;
- remplacement de Inspirer mon prochain repas par Composer avec Tee ;
- retour automatique au titre Notre journée ensemble et à son sous-titre par défaut lorsque la journée ne contient aucun rendez-vous ;
- synchronisation stricte des fichiers racine et www.

Aucun nouveau SQL n’est nécessaire pour ce correctif. Les migrations V392 et V393 déjà installées restent utilisées.
