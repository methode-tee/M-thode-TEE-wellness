window.MT_CONFIG = {
  // SUPABASE
  SUPABASE_URL: "https://tyuvlmmmyygqqhuetwoe.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dXZsbW1teXlncXFodWV0d29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDA5NTQsImV4cCI6MjA5NTg3Njk1NH0.zyyFmDqM96TjYSqJW8_bfG330E4jLBheQ_c6qmyQ7W4",

  USE_SUPABASE: true,

  // MODE GITHUB PAGES ONLY
  // Pas de Netlify, pas de backend, pas de webhook.
  PAYMENT_MODE: "stripe_payment_links",

  // Accès app à 5€ si tu veux vendre l'entrée générale.
  // Remplace # par ton vrai lien Stripe Payment Link.
  APP_ACCESS_PAYMENT_LINK: "#",

  // Liens Stripe par protocole.
  // Tu peux les modifier directement ici sans changer l'app.
  PAYMENT_LINKS: {
    "maux-de-ventre": "#",
    "sommeil-profond": "#",
    "energie-douce": "#"
  },

  ADMIN_EMAILS: ["teayannaparis@gmail.com"],
  ADMIN_ACCESS_CODE: "OUTITA"
};
