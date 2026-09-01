V456 — Upload contenu protocole robuste

Corrige le formulaire Bibliothèque / fichiers de l'admin :
- feedback immédiat Téléversement… puis Enregistrement… ;
- erreur Supabase/Storage visible au lieu d'un clic silencieux ;
- conservation du fichier existant lors d'une simple modification ;
- stockage cohérent dans file_path + file_url pour les fichiers privés ;
- nettoyage d'un fichier orphelin si l'écriture DB échoue ;
- remplacement sûr d'un ancien fichier après sauvegarde réussie ;
- session expirée détectée clairement ;
- racine et www synchronisés.

Aucun SQL requis par ce patch.
