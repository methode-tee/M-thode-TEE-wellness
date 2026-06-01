window.MT_CONFIG = {
  // Remplir après création du projet Supabase
  SUPABASE_URL: "https://TON-PROJET.supabase.co",
  SUPABASE_ANON_KEY: "TON_ANON_KEY",

  // URL de tes fonctions serverless Stripe
  STRIPE_CHECKOUT_ENDPOINT: "/.netlify/functions/create-checkout-session",

  // Active la vraie connexion Supabase quand les clés sont renseignées
  USE_SUPABASE: false,

  // Mode démo : faux achat localStorage si Stripe/Supabase pas encore branchés
  DEMO_MODE: true,

  // Email admin autorisé à voir admin.html
  ADMIN_EMAILS: [
    "ton-email-admin@example.com"
  ]
};
