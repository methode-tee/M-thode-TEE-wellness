PATCH V242 — iOS notifications natives + chargement premium + profil compact

Base ciblée :
M-thode-TEE-wellness-main 241.zip

Corrections :
1. Notifications locales natives iPhone via @capacitor/local-notifications.
2. Le bouton Notifications demande désormais l'autorisation iOS dans l'app native.
3. Un rappel doux quotidien est programmé à 19 h et peut être désactivé avec le même bouton.
4. La logique PWA reste inchangée sur le web.
5. Suppression du faux message « ajoute l'app à l'écran d'accueil » dans TestFlight.
6. Suppression du double toast.
7. Le logo d'ouverture reste visible jusqu'à ce que l'état membre de l'accueil soit réellement chargé.
8. L'état temporaire « Bienvenue / losange » n'est plus affiché à une membre connectée.
9. Le bouton Restaurer mes achats Apple est rapproché de la version.
10. Réduction du grand espace vide du bas du profil.

INSTALLATION
- Copier les fichiers du patch dans la racine du projet en remplaçant les fichiers existants.
- Puis dans Terminal, à la racine du projet :

npm install
npx cap sync ios
npx cap open ios

TEST OBLIGATOIRE AVANT SOUMISSION
- Supprimer l'ancienne app de l'iPhone puis relancer depuis Xcode/TestFlight.
- Profil > Notifications > activer.
- Vérifier que la fenêtre native iOS « Autoriser les notifications » apparaît.
- Accepter puis vérifier dans Réglages > Notifications > Méthode Tee.
- Désactiver/réactiver une fois pour contrôler le bouton.
- Fermer et rouvrir l'app : aucun flash « Bienvenue » ne doit être visible.
- Vérifier que Restaurer mes achats Apple est juste au-dessus de la version.

La validation Apple IAP et Supabase n'est pas modifiée.
