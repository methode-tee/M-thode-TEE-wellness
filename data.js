window.MT_PROTOCOLS = [
  {
    id: "maux-de-ventre",
    slug: "maux-de-ventre",
    title: "Maux de ventre",
    subtitle: "Digestion lourde",
    category: "pharmacie_vegetale",
    emoji: "🤢",
    short_description: "Digestion lourde, ventre gonflé, inconfort après repas.",
    long_description: "PDFs, vidéos, checklists, tracker et routines à ajouter depuis l’admin.",
    price_cents: 500,
    duration_label: "5 jours",
    active: true,
    featured: true,
    image_url: "",
    payment_link: ""
  },
  {
    id: "sommeil-profond",
    slug: "sommeil-profond",
    title: "Sommeil profond",
    subtitle: "Nuits calmes",
    category: "pharmacie_vegetale",
    emoji: "🌙",
    short_description: "Rituel du soir, plantes apaisantes, routine de décompression.",
    long_description: "Contenus privés à ajouter depuis l’admin.",
    price_cents: 500,
    duration_label: "7 jours",
    active: true,
    featured: false,
    image_url: "",
    payment_link: ""
  }
];

window.MT_DEFAULT_PAGES = [
  { id: "home", slug: "index", href: "index.html", label: "Accueil", emoji: "🏠", system_key: "home", sort_order: 1, active: true },
  { id: "pharmacie", slug: "pharmacie", href: "protocols.html?category=pharmacie_vegetale", label: "Pharmacie", emoji: "🌿", system_key: "protocols_pharmacie", sort_order: 2, active: true },
  { id: "objectifs", slug: "objectifs", href: "protocols.html?category=objectifs_corps", label: "Objectifs", emoji: "🔥", system_key: "protocols_objectifs", sort_order: 3, active: true },
  { id: "recettes", slug: "recettes", href: "page.html?slug=recettes", label: "Recettes", emoji: "🥣", system_key: "custom", sort_order: 4, active: true },
  { id: "bibliotheque", slug: "bibliotheque", href: "library.html", label: "Biblio", emoji: "📚", system_key: "library", sort_order: 5, active: true },
  { id: "profil", slug: "profil", href: "dashboard.html", label: "Profil", emoji: "👤", system_key: "dashboard", sort_order: 6, active: true }
];

window.MT_DEFAULT_SECTIONS = {
  recettes: [
    {
      id: "default-recettes",
      type: "feed",
      title: "Recettes privées",
      intro: "Ajoute ici tes recettes, routines nutrition, idées repas et contenus exclusifs.",
      items: []
    }
  ]
};
