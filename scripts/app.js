function euros(cents) {
  return ((cents || 0) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

function renderTopActions() {
  const el = document.getElementById("topActions");
  if (!el) return;
  el.innerHTML = `
    <a class="round-action" href="dashboard.html">👤</a>
    <button class="round-action" onclick="mtSignOut()">↪️</button>
  `;
}

function renderNav() {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;

  const current = location.pathname.split("/").pop() || "index.html";
  const params = new URLSearchParams(location.search);
  const category = params.get("category");

  nav.innerHTML = (window.MT_NAV || []).map(item => {
    const itemPath = item.href.split("?")[0];
    const itemParams = new URLSearchParams((item.href.split("?")[1] || ""));
    const itemCategory = itemParams.get("category");

    let active = false;

    if (current === "protocols.html") {
      active = itemPath === "protocols.html" && itemCategory === category;
      if (!category && itemCategory === "pharmacie_vegetale") active = true;
    } else {
      active = itemPath === current;
    }

    return `<a class="${active ? "active" : ""}" href="${item.href}">
      <b>${item.emoji}</b>
      <span>${item.label}</span>
    </a>`;
  }).join("");
}

async function fetchProtocols(category = null) {
  const client = initSupabase();
  if (client) {
    let q = client.from("protocols").select("*").eq("active", true).order("created_at", { ascending: false });
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (!error && data?.length) return data;
  }
  return (window.MT_PROTOCOLS || []).filter(p => !category || p.category === category);
}

async function fetchOwnedIds() {
  const user = await mtGetUser();
  const client = initSupabase();
  if (!user || !client) return JSON.parse(localStorage.getItem("MT_MANUAL_UNLOCKS") || "[]");
  const { data } = await client.from("user_protocols").select("protocol_id").eq("user_id", user.id).eq("status", "active");
  return data?.map(x => x.protocol_id) || [];
}

function getPaymentLink(protocol) {
  return (window.MT_CONFIG.PAYMENT_LINKS || {})[protocol.slug || protocol.id] || "#";
}

async function startPaymentLink(protocolId) {
  const user = await mtRequireUser();
  if (!user) return;

  const protocols = await fetchProtocols();
  const protocol = protocols.find(p => (p.id === protocolId || p.slug === protocolId));
  if (!protocol) return alert("Protocole introuvable.");

  const link = getPaymentLink(protocol);
  if (!link || link === "#") {
    alert("Lien Stripe non configuré pour ce protocole. Ajoute le Payment Link dans config.js.");
    return;
  }

  // Phase gratuite / GitHub Pages : paiement via Stripe Payment Link.
  // Après paiement, tu débloques manuellement depuis Supabase/Admin.
  window.location.href = link;
}

function protocolCard(protocol, owned = false) {
  const id = protocol.id || protocol.slug;
  return `
    <article class="protocol-card ${owned ? "unlocked" : "locked"} reveal">
      <div class="protocol-hero"><span>${protocol.emoji || "🌿"}</span></div>
      <div class="protocol-head">
        <div class="protocol-mini"><span class="avatar">${protocol.emoji || "🌿"}</span><div><small>${protocol.subtitle || "Protocole"}</small></div></div>
        <span class="tag">${owned ? "Débloqué" : "Payant"}</span>
      </div>
      <h2>${protocol.title}</h2>
      <p>${protocol.short_description || ""}</p>
      <div class="protocol-meta">
        <span class="price-pill">${euros(protocol.price_cents || 500)}</span>
        <span class="duration-pill">${protocol.duration_label || "Accès privé"}</span>
      </div>
      <button class="main-cta" onclick="${owned ? `location.href='protocol.html?id=${id}'` : `startPaymentLink('${id}')`}">
        ${owned ? "Ouvrir le protocole" : "Débloquer ce protocole"}
      </button>
    </article>
  `;
}

async function renderProtocolsPage() {
  const el = document.getElementById("protocolGrid");
  if (!el) return;
  const protocols = await fetchProtocols(getParam("category"));
  const owned = await fetchOwnedIds();
  el.innerHTML = protocols.map(p => protocolCard(p, owned.includes(p.id) || owned.includes(p.slug))).join("");
  observeReveal();
}

async function renderHomeFeed() {
  const el = document.getElementById("homeFeed");
  if (!el) return;
  const client = initSupabase();
  let posts = [];
  if (client) {
    const { data } = await client.from("posts").select("*").eq("active", true).order("created_at", { ascending: false }).limit(12);
    posts = data || [];
  }
  if (!posts.length) {
    posts = [{ title: "Bienvenue dans ton journal privé", content: "Posts du jour, routines, tips, mindset, challenges, contenus exclusifs et inspirations.", type: "Journal", created_at: new Date().toISOString() }];
  }
  el.innerHTML = posts.map(p => `
    <article class="post-card reveal">
      <div class="post-head"><span class="avatar">T</span><div><strong>Méthode<br>Tee</strong><small>${new Date(p.created_at).toLocaleDateString("fr-FR", {day:"2-digit", month:"short", year:"numeric"})}</small></div><span class="tag">${p.type || "Journal"}</span></div>
      ${p.image_url ? `<img class="post-image" src="${p.image_url}" alt="">` : ""}
      <h2>${p.title || ""}</h2>
      <p>${p.content || ""}</p>
    </article>
  `).join("");
  observeReveal();
}

async function renderDashboard() {
  const el = document.getElementById("dashboardSummary");
  if (!el) return;
  const user = await mtRequireUser();
  if (!user) return;
  const owned = await fetchOwnedIds();
  el.innerHTML = `
    <article class="mini-card glass reveal"><b>📚</b><h2>${owned.length}</h2><p>Protocoles débloqués</p></article>
    <article class="mini-card glass reveal"><b>🔥</b><h2>0</h2><p>Streak actuel</p></article>
    <article class="mini-card glass reveal"><b>✨</b><h2>V10</h2><p>Mode premium</p></article>
  `;
  observeReveal();
}

async function renderProtocolDetail() {
  const el = document.getElementById("protocolDetail");
  if (!el) return;
  const user = await mtRequireUser();
  if (!user) return;
  const id = getParam("id");
  const owned = await fetchOwnedIds();
  if (!owned.includes(id)) {
    el.innerHTML = `<div class="empty-card"><h1>Accès verrouillé</h1><p>Ce protocole sera accessible après paiement et validation admin.</p><a class="main-cta link" href="protocols.html">Retour</a></div>`;
    return;
  }
  const protocols = await fetchProtocols();
  const protocol = protocols.find(p => p.id === id || p.slug === id);
  const client = initSupabase();
  let contents = [];
  if (client && protocol?.id) {
    const { data } = await client.from("protocol_contents").select("*").eq("protocol_id", protocol.id).eq("active", true).order("sort_order", { ascending: true });
    contents = data || [];
  }
  el.innerHTML = `
    <div class="kicker">Protocole débloqué</div>
    <h1 class="page-title">${protocol?.title || "Protocole"}<br><em>${protocol?.duration_label || ""}</em></h1>
    <p class="lead">${protocol?.long_description || ""}</p>
    <section class="content-list">
      ${contents.map(c => `<article class="content-card reveal"><span>${c.type === "video" ? "🎥" : "📄"}</span><h2>${c.title}</h2><p>${c.description || c.content_text || ""}</p></article>`).join("") || `<article class="content-card"><span>🤍</span><h2>Contenu à venir</h2><p>L’admin ajoutera ici ses fichiers, vidéos, checklists et routines.</p></article>`}
    </section>
  `;
  observeReveal();
}

function observeReveal() {
  const items = document.querySelectorAll(".reveal:not(.observed)");
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); });
  }, { threshold: .12 });
  items.forEach(i => { i.classList.add("observed"); obs.observe(i); });
}

document.addEventListener("DOMContentLoaded", () => {
  renderTopActions();
  renderNav();
  renderHomeFeed();
  renderProtocolsPage();
  renderDashboard();
  renderProtocolDetail();
});
