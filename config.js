window.MT_CONFIG = {

  // ================================
  // SUPABASE
  // ================================

  SUPABASE_URL:
    "https://tyuvlmmmyygqqhuetwoe.supabase.co",

  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dXZsbW1teXlncXFodWV0d29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDA5NTQsImV4cCI6MjA5NTg3Njk1NH0.zyyFmDqM96TjYSqJW8_bfG330E4jLBheQ_c6qmyQ7W4",


  // ================================
  // STRIPE
  // ================================

  STRIPE_CHECKOUT_ENDPOINT:
    "/.netlify/functions/create-checkout-session",


  // ================================
  // APP SETTINGS
  // ================================

  // Active la vraie connexion Supabase
  USE_SUPABASE: true,

  // Garde le mode démo tant que Stripe n'est pas branché
  DEMO_MODE: true,


  // ================================
  // ADMIN
  // ================================

  ADMIN_EMAILS: [
    "teayannaparis@gmail.com"
  ]

};
