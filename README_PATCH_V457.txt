V457 — Upload protocole ciblé Safari/iOS

Comparaison directe 389(1) ↔ 407(2) :
- le formulaire « Contenu du protocole » est identique ;
- le code historique d'upload du protocole est identique ;
- aucune migration récente V441/V442/V445/V446/V447/V451/V453 ne modifie le bucket protocol-files.

Donc les améliorations récentes n'ont pas remplacé ce mécanisme. Comme Ressources offertes / Notre journée ensemble / Missions continuent de téléverser correctement via leurs autres buckets, V457 ne touche PAS au helper partagé.

V457 est construit au-dessus de V456 et conserve :
- Téléversement… / Enregistrement… ;
- affichage exact des erreurs ;
- préservation d'un fichier existant lors d'une modification ;
- file_path + file_url cohérents.

Seule correction ajoutée : le fichier premium du protocole est lu réellement en ArrayBuffer sur Safari/iOS, byteLength est vérifié, puis les octets sont envoyés au bucket privé protocol-files avec MIME explicite.

Aucun autre upload admin n'est modifié.
Aucun SQL.
Aucune resoumission Apple : admin web uniquement.
