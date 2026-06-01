window.MT_FALLBACK = {
  sections: [
    { id:"journal", label:"Accueil", emoji:"🏠" },
    { id:"pharmacie", label:"Pharmacie végétale", emoji:"🌿" },
    { id:"objectifs", label:"Objectifs Corps", emoji:"🔥" },
    { id:"bibliotheque", label:"Bibliothèque privée", emoji:"📖" },
    { id:"profil", label:"Profil", emoji:"👤" }
  ],
  posts: [{
    title:"Bienvenue dans ton journal Méthode Tee",
    body:"Ici, je partage les routines, tips, notes terrain, contenus exclusifs, inspirations et posts privés pour t’accompagner au quotidien.",
    category:"journal",
    created_at:new Date().toISOString(),
    media_urls:[]
  }],
  protocols: [
    {id:"maux-de-ventre",title:"Maux de ventre",category:"pharmacie",emoji:"🤢",price:5,duration_label:"5 jours",duration_days:5,short:"Digestion lourde, ventre gonflé, inconfort après repas.",description:"Un espace de soutien avec protocole, routine, plantes, PDF et conseils ciblés.",image_url:""},
    {id:"regles-douloureuses",title:"Règles douloureuses",category:"pharmacie",emoji:"🌸",price:7,duration_label:"5 jours",duration_days:5,short:"Crampes, bas du dos, nausées, fatigue hormonale.",description:"Un protocole de confort du cycle avec nutrition, plantes et gestes de soutien.",image_url:""},
    {id:"flat-belly-reset",title:"Flat Belly Reset",category:"objectifs",emoji:"🔥",price:24,duration_label:"28 jours",duration_days:28,short:"Digestion, ventre plat, discipline et routine silhouette.",description:"Un protocole complet sur 28 jours pour accompagner le terrain digestif.",image_url:""}
  ]
};