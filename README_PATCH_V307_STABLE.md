# Patch V307 stable — Mon Équilibre Tee + carnets recettes

Base obligatoire : `M-thode-TEE-wellness-main 304(6).zip`.

Ce patch a été reconstruit depuis la base stable, et non depuis la branche develop défectueuse.

## Corrections principales
- suppression totale du squelette et de toute hauteur réservée : aucun grand espace vide dans Profil ;
- carte Mon Équilibre rendue immédiatement avec le contexte déjà chargé ;
- une seule actualisation silencieuse, sans reconstruction de la page Profil ;
- journal relu uniquement si le cache a plus de 5 minutes ou après une vraie écriture du journal ;
- empreinte hebdomadaire chargée uniquement au clic ;
- contrat quotidien complet : date, complétude, lecture partielle, entrées disponibles/manquantes, progression détaillée et actions ;
- ouverture directe du formulaire Journal ;
- PDF : vrai titre, bouton Enregistrer, icône Partager et partage du fichier PDF plutôt que de l’URL Supabase ;
- aucune migration SQL nécessaire.

## Zones non modifiées
StoreKit 2, Stripe, Product IDs, restaurations, accès utilisateurs, déblocages quotidiens, authentification, recettes liées aux protocoles et fichiers iOS natifs.
