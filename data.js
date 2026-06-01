window.MT_DATA = {
  guides: [
    {
      id: "regles-douloureuses",
      title: "Règles douloureuses",
      category: "comptoir",
      emoji: "🌸",
      price: 6,
      currency: "EUR",
      durationDays: 5,
      stripePriceId: "price_A_REMPLACER_REGLES",
      short: "Crampes, bas du dos, nausées, fatigue hormonale.",
      promise: "Un rituel complet pour accompagner le confort du cycle avec plantes, nutrition et gestes simples.",
      tags: ["cycle", "douleur", "femme", "confort"],
      products: ["Camomille", "Gingembre", "Reine des prés", "Lune Céleste"],
      pdfPath: null
    },
    {
      id: "digestion-difficile",
      title: "Digestion difficile",
      category: "comptoir",
      emoji: "🤢",
      price: 5,
      currency: "EUR",
      durationDays: 4,
      stripePriceId: "price_A_REMPLACER_DIGESTION",
      short: "Ballonnements, ventre gonflé, lourdeur après repas.",
      promise: "Un protocole express pour apaiser le terrain digestif et retrouver de la légèreté.",
      tags: ["digestion", "ventre", "ballonnements"],
      products: ["Fenouil", "Menthe", "Gingembre", "Bye Bye Tox"],
      pdfPath: null
    },
    {
      id: "sommeil-agite",
      title: "Sommeil agité",
      category: "comptoir",
      emoji: "😴",
      price: 7,
      currency: "EUR",
      durationDays: 7,
      stripePriceId: "price_A_REMPLACER_SOMMEIL",
      short: "Endormissement difficile, réveils nocturnes, fatigue.",
      promise: "Un rituel du soir en douceur pour soutenir le relâchement et le retour au calme.",
      tags: ["sommeil", "stress", "nuit"],
      products: ["Passiflore", "Verveine", "Camomille", "Ashwagandha"],
      pdfPath: null
    },
    {
      id: "apres-exces",
      title: "Après excès alimentaire",
      category: "comptoir",
      emoji: "🍽️",
      price: 5,
      currency: "EUR",
      durationDays: 3,
      stripePriceId: "price_A_REMPLACER_EXCES",
      short: "Repas gras, lourdeur, envie de reset sans restriction.",
      promise: "Un accompagnement doux pour relancer la légèreté sans tomber dans la punition alimentaire.",
      tags: ["digestion", "reset", "foie"],
      products: ["Thé Vert Détox", "Romarin", "Citronnelle"],
      pdfPath: null
    },
    {
      id: "flat-belly-reset",
      title: "Flat Belly Reset",
      category: "objectifs",
      emoji: "🔥",
      price: 24,
      currency: "EUR",
      durationDays: 28,
      stripePriceId: "price_A_REMPLACER_FLATBELLY",
      short: "Digestion, ventre gonflé, routine silhouette.",
      promise: "Un protocole complet pour travailler le terrain digestif, la régularité et la discipline alimentaire.",
      tags: ["silhouette", "digestion", "ventre"],
      products: ["Fenouil", "Thé Vert Détox", "Maté Boost"],
      pdfPath: null
    },
    {
      id: "poids-de-forme",
      title: "Poids de Forme",
      category: "objectifs",
      emoji: "⚖️",
      price: 29,
      currency: "EUR",
      durationDays: 28,
      stripePriceId: "price_A_REMPLACER_POIDS",
      short: "Perte de poids douce, discipline, équilibre.",
      promise: "Une méthode progressive pour revenir à ton poids de forme sans régime violent.",
      tags: ["poids", "silhouette", "discipline"],
      products: ["Maté Boost", "Thé Vert Détox", "Protéine Chanvre"],
      pdfPath: null
    },
    {
      id: "prise-de-masse",
      title: "Prise de Masse",
      category: "objectifs",
      emoji: "💪",
      price: 29,
      currency: "EUR",
      durationDays: 28,
      stripePriceId: "price_A_REMPLACER_MASSE",
      short: "Muscle propre, calories utiles, récupération.",
      promise: "Un protocole pour augmenter les apports intelligemment et soutenir la progression.",
      tags: ["masse", "sport", "calories"],
      products: ["Granola protéiné", "Protéine Vanilla", "Noix de cajou"],
      pdfPath: null
    },
    {
      id: "pousse-cheveux",
      title: "Pousse cheveux",
      category: "beaute",
      emoji: "💆🏾‍♀️",
      price: 7,
      currency: "EUR",
      durationDays: 14,
      stripePriceId: "price_A_REMPLACER_CHEVEUX",
      short: "Terrain, nutrition, plantes, routine interne.",
      promise: "Un accompagnement végétal et nutritionnel pour soutenir la vitalité capillaire.",
      tags: ["cheveux", "beaute", "terrain"],
      products: ["Ortie", "Moringa", "Protéine Chanvre"],
      pdfPath: null
    }
  ],

  categories: [
    { id: "all", label: "Tout", emoji: "◆" },
    { id: "comptoir", label: "Comptoir Végétal", emoji: "🌿" },
    { id: "objectifs", label: "Objectifs Corps", emoji: "✨" },
    { id: "beaute", label: "Beauté & Glow", emoji: "🌸" },
    { id: "club", label: "Bibliothèque Club", emoji: "📖" }
  ],

  onboardingQuestions: [
    {
      id: "main_goal",
      title: "Qu’est-ce que tu veux améliorer en priorité ?",
      type: "single",
      options: [
        { value:"digestion", label:"Digestion / ventre", emoji:"🤢" },
        { value:"energy", label:"Énergie", emoji:"⚡" },
        { value:"cycle", label:"Cycle / règles", emoji:"🌸" },
        { value:"sleep", label:"Sommeil", emoji:"🌙" },
        { value:"stress", label:"Stress", emoji:"🌪️" },
        { value:"body", label:"Silhouette", emoji:"🔥" },
        { value:"beauty", label:"Peau / cheveux", emoji:"✨" }
      ]
    },
    {
      id: "current_state",
      title: "Aujourd’hui, ton corps se sent plutôt…",
      type: "single",
      options: [
        { value:"bloated", label:"Gonflé / lourd", emoji:"🎈" },
        { value:"tired", label:"Fatigué", emoji:"😴" },
        { value:"tense", label:"Tendu", emoji:"🌪️" },
        { value:"pain", label:"En inconfort", emoji:"🌡️" },
        { value:"motivated", label:"Motivé", emoji:"🔥" }
      ]
    },
    {
      id: "routine_level",
      title: "Tu préfères recevoir des recommandations…",
      type: "single",
      options: [
        { value:"soft", label:"Douces et simples", emoji:"🌿" },
        { value:"structured", label:"Structurées", emoji:"📋" },
        { value:"intense", label:"Très cadrées", emoji:"⚡" }
      ]
    }
  ]
};
