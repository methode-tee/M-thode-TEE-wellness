PATCH V19.1 — Immersif automatique client

Remplacer uniquement :
- scripts/protocol-journey.js
- styles/journey.css

Effets :
- supprime l'écran bloquant 'Milestone débloqué / Continuer' à l'ouverture
- supprime le lien visible 'Vue classique' pour les clients
- garde le parcours immersif comme expérience principale
- ne touche pas à Stripe, Supabase, webhook, auth, paiement, déblocage, navbar
