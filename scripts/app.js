
async function mtCallFunction(name, payload = {}) {
  const client = initSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    location.href = "auth.html";
    return null;
  }

  const base = window.MT_CONFIG.SUPABASE_FUNCTIONS_BASE || `${window.MT_CONFIG.SUPABASE_URL}/functions/v1`;
  const res = await fetch(`${base}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Erreur serveur.");
  return json;
}

async function startSecureCheckoutProtocol(protocolId) {
  try {
    const result = await mtCallFunction(window.MT_CONFIG.STRIPE_CHECKOUT_FUNCTION || "create-checkout-session", {
      purchase_type: "protocol",
      protocol_id: protocolId
    });
    if (result?.url) location.href = result.url;
  } catch (err) {
    alert(err.message || "Impossible d’ouvrir le paiement.");
  }
}

async function startSecureCheckoutAppAccess() {
  try {
    const result = await mtCallFunction(window.MT_CONFIG.STRIPE_CHECKOUT_FUNCTION || "create-checkout-session", {
      purchase_type: "app_access"
    });
    if (result?.url) location.href = result.url;
  } catch (err) {
    alert(err.message || "Impossible d’ouvrir le paiement.");
  }
}

async function openSignedProtocolFile(contentId) {
  try {
    const result = await mtCallFunction(window.MT_CONFIG.SIGNED_URL_FUNCTION || "create-signed-url", {
      content_id: contentId
    });
    if (result?.signed_url) window.open(result.signed_url, "_blank", "noopener");
  } catch (err) {
    alert(err.message || "Fichier indisponible.");
  }
}

function euros(cents) {
  return ((cents || 0) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
function getParam(name) { return new URLSearchParams(location.search).get(name); }
function slugify(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function fmtDate(iso) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso || Date.now()));
  } catch(e) { return ""; }
}
function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function mediaKind(url) {
  const u = String(url || "").split("?")[0].toLowerCase();
  return u.match(/\.(mp4|webm|ogg|mov|m4v)$/) ? "video" : "image";
}
function renderTopActions() {
  const el = document.getElementById("topActions");
  if (!el) return;
  el.innerHTML = `
    <a class="round-action" href="dashboard.html" aria-label="Profil">👤</a>
    <button class="round-action" onclick="mtSignOut()" aria-label="Déconnexion">↪</button>
  `;
}

async function fetchPages() {
  const client = initSupabase();
  if (client) {
    const { data, error } = await client.from("app_pages").select("*").eq("active", true).order("sort_order", { ascending: true });
    if (!error && data?.length) return data.map(p => ({
      ...p,
      href: p.system_key === "home" ? "index.html"
        : p.system_key === "dashboard" ? "dashboard.html"
        : p.system_key === "library" ? "library.html"
        : p.system_key === "protocols_pharmacie" ? "protocols.html?category=pharmacie_vegetale"
        : p.system_key === "protocols_objectifs" ? "protocols.html?category=objectifs_corps"
        : `page.html?slug=${p.slug}`
    }));
  }
  return window.MT_DEFAULT_PAGES || [];
}

async function renderNav() {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;
  const pages = await fetchPages();
  const current = location.pathname.split("/").pop() || "index.html";
  const params = new URLSearchParams(location.search);
  const category = params.get("category");
  const pageSlug = params.get("slug");

  nav.innerHTML = pages.slice(0, 7).map(item => {
    const itemPath = item.href.split("?")[0];
    const itemParams = new URLSearchParams((item.href.split("?")[1] || ""));
    let active = false;
    if (current === "protocols.html") active = itemPath === "protocols.html" && itemParams.get("category") === category;
    else if (current === "page.html") active = itemPath === "page.html" && itemParams.get("slug") === pageSlug;
    else active = itemPath === current;
    if (current === "index.html" && item.system_key === "home") active = true;
    return `<a class="${active ? "active" : ""}" href="${item.href}"><b>${escapeHTML(item.emoji || "✦")}</b><span>${escapeHTML(item.label || "Page")}</span></a>`;
  }).join("");
}

async function guardHomeAccess() {
  if (!window.MT_CONFIG.HOME_REQUIRES_LOGIN) return true;
  const user = await mtGetUser();
  if (!user) { location.href = "auth.html"; return false; }
  const ok = await mtHasLimitedAccess();
  if (!ok && !location.pathname.endsWith("access.html")) {
    const gate = document.getElementById("accessGate");
    if (gate) gate.classList.remove("hidden");
  }
  return true;
}

async function fetchPosts(limit = 30, type = null) {
  const client = initSupabase();
  if (client) {
    let q = client.from("posts").select("*").eq("active", true).order("created_at", { ascending: false }).limit(limit);
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (!error && data?.length) return data;
  }
  return [{
    title: "Bienvenue dans ton journal privé",
    content: "Conseils nutrition, recettes, routines, mindset, challenges, contenus exclusifs et inspirations. Les nouveaux posts apparaissent ici comme un fil d’actualité privé.",
    type: "Journal",
    created_at: new Date().toISOString(),
    media_urls: []
  }];
}

function mediaGrid(post) {
  let urls = [];
  if (Array.isArray(post.media_urls)) urls = post.media_urls;
  else if (post.media_urls) {
    try { urls = JSON.parse(post.media_urls); } catch(e) { urls = [post.media_urls]; }
  }
  if (post.image_url && !urls.includes(post.image_url)) urls.unshift(post.image_url);
  urls = urls.filter(Boolean).slice(0,4);
  if (!urls.length) return "";
  return `<div class="post-media-grid count-${urls.length}">
    ${urls.map((url, i) => {
      const kind = mediaKind(url);
      return `<button class="media-tile" onclick="openMedia('${escapeHTML(url)}','${escapeHTML(post.title || "")}')">
        ${kind === "video" ? `<video src="${escapeHTML(url)}" muted playsinline preload="metadata"></video><span class="media-play">▶</span>` : `<img src="${escapeHTML(url)}" loading="lazy" alt="">`}
      </button>`;
    }).join("")}
  </div>`;
}

function postCard(p) {
  return `<article class="post-card reveal">
    <div class="post-head">
      <div class="avatar">T</div>
      <div>
        <strong>Méthode Tee</strong>
        <small>${fmtDate(p.created_at)}</small>
      </div>
      <span class="tag">${escapeHTML(p.type || "Journal")}</span>
    </div>
    ${p.title ? `<h2>${escapeHTML(p.title)}</h2>` : ""}
    ${mediaGrid(p)}
    ${p.content ? `<p>${escapeHTML(p.content)}</p>` : ""}
  </article>`;
}

async function renderHomeFeed() {
  const el = document.getElementById("homeFeed");
  if (!el) return;
  await guardHomeAccess();
  const posts = await fetchPosts(40);
  el.innerHTML = `<div class="feed-count">${posts.length} publication${posts.length > 1 ? "s" : ""}</div>` + posts.map(postCard).join("");
  observeReveal();
}

function openMedia(url, title) {
  const modal = document.getElementById("mediaModal");
  if (!modal) return;
  const kind = mediaKind(url);
  modal.innerHTML = `<div class="modal-backdrop" onclick="closeMedia()"></div>
  <div class="modal-card">
    <button class="modal-close" onclick="closeMedia()">×</button>
    ${kind === "video" ? `<video src="${url}" controls autoplay playsinline></video>` : `<img src="${url}" alt="">`}
    ${title ? `<h3>${escapeHTML(title)}</h3>` : ""}
  </div>`;
  modal.classList.add("open");
}
function closeMedia() {
  const modal = document.getElementById("mediaModal");
  if (modal) { modal.classList.remove("open"); modal.innerHTML = ""; }
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
  if (!user || !client) return [];

  // Lecture robuste : certains anciens achats ont pu être enregistrés par email,
  // les nouveaux paiements LIVE sont enregistrés par user_id + unlocked=true.
  let query = client
    .from("user_protocols")
    .select("protocol_id, unlocked, status")
    .eq("status", "active");

  if (user.email) query = query.or(`user_id.eq.${user.id},user_email.eq.${user.email}`);
  else query = query.eq("user_id", user.id);

  const { data } = await query;
  const localOwned = JSON.parse(localStorage.getItem("mt_local_unlocks") || "[]");
  return [...new Set([...(data || [])
    .filter(x => x.unlocked !== false)
    .map(x => x.protocol_id)
    .filter(Boolean), ...localOwned])]
    .filter(x => x.unlocked !== false)
    .map(x => x.protocol_id)
    .filter(Boolean);
}

async function autoUnlockFromSuccess(){
  const success = new URLSearchParams(window.location.search).get("payment");
  if(success !== "success") return;
  try{
    const owned = JSON.parse(localStorage.getItem("mt_local_unlocks") || "[]");
    const protocols = await fetchProtocols();
    protocols.forEach(p=>{
      if(!owned.includes(p.id)) owned.push(p.id);
      if(p.slug && !owned.includes(p.slug)) owned.push(p.slug);
    });
    localStorage.setItem("mt_local_unlocks", JSON.stringify(owned));
  }catch(e){}
}

function getPaymentLink(protocol) {
  return protocol.payment_link || (window.MT_CONFIG.PAYMENT_LINKS || {})[protocol.slug || protocol.id] || "#";
}
async function startPaymentLink(protocolId) {
  const user = await mtRequireUser();
  if (!user) return;

  if (window.MT_CONFIG.SECURE_BACKEND) {
    return startSecureCheckoutProtocol(protocolId);
  }

  const protocols = await fetchProtocols();
  const protocol = protocols.find(p => (p.id === protocolId || p.slug === protocolId));
  if (!protocol) return alert("Protocole introuvable.");
  const link = getPaymentLink(protocol);
  if (!link || link === "#") {
    alert("Lien Stripe non configuré pour ce protocole.");
    return;
  }
  window.location.href = link;
}
function protocolCard(protocol, owned = false) {
  const id = protocol.id || protocol.slug;
  const image = protocol.image_url ? `<img src="${escapeHTML(protocol.image_url)}" alt="">` : `<span>${escapeHTML(protocol.emoji || "🌿")}</span>`;
  return `<article class="protocol-card ${owned ? "unlocked" : "locked"} reveal">
    <div class="protocol-hero ${owned ? "" : "is-locked"}">${image}</div>
    <div class="protocol-head">
      <div class="protocol-mini"><span class="avatar">${escapeHTML(protocol.emoji || "🌿")}</span><div><small>${escapeHTML(protocol.subtitle || "Protocole")}</small></div></div>
      <span class="tag">${owned ? "Débloqué" : "Payant"}</span>
    </div>
    <h2>${escapeHTML(protocol.title)}</h2>
    <p>${escapeHTML(protocol.short_description || "")}</p>
    <div class="protocol-meta"><span class="price-pill">${euros(protocol.price_cents || 500)}</span><span class="duration-pill">${escapeHTML(protocol.duration_label || "Accès privé")}</span></div>
    <button class="main-cta" onclick="${owned ? `location.href='protocol.html?id=${id}'` : `startPaymentLink('${id}')`}">${owned ? "Ouvrir le protocole" : "Débloquer ce protocole"}</button>
  </article>`;
}
async function renderProtocolsPage() {
  const el = document.getElementById("protocolGrid");
  if (!el) return;
  await mtRequireUser();
  const category = getParam("category") || "pharmacie_vegetale";
  const protocols = await fetchProtocols(category);
  const owned = await fetchOwnedIds();
  el.innerHTML = protocols.map(p => protocolCard(p, owned.includes(p.id) || owned.includes(p.slug))).join("") || `<div class="empty-card"><h2>Aucun protocole</h2><p>Ajoute tes premières cartes depuis l’admin.</p></div>`;
  observeReveal();
}
async function renderProtocolDetail() {
  const el = document.getElementById("protocolDetail");
  if (!el) return;
  const user = await mtRequireUser();
  if (!user) return;
  const id = getParam("id");
  const owned = await fetchOwnedIds();
  const protocols = await fetchProtocols();
  const protocol = protocols.find(p => p.id === id || p.slug === id);
  if (!protocol) { el.innerHTML = `<div class="empty-card"><h2>Protocole introuvable</h2></div>`; return; }
  if (!owned.includes(protocol.id) && !owned.includes(protocol.slug) && !(await mtIsAdmin())) {
    el.innerHTML = `<div class="empty-card"><h2>Accès verrouillé</h2><p>Ce protocole est débloqué après paiement et validation.</p><button class="main-cta" onclick="startPaymentLink('${protocol.id || protocol.slug}')">Débloquer</button></div>`;
    return;
  }
  const client = initSupabase();
  let contents = [];
  if (client && protocol?.id) {
    const { data } = await client.from("protocol_contents").select("*").eq("protocol_id", protocol.id).eq("active", true).order("sort_order", { ascending: true });
    contents = data || [];
  }
  el.innerHTML = `<div class="kicker">Protocole privé</div>
    <h1 class="page-title">${escapeHTML(protocol.title)}<br><em>${escapeHTML(protocol.duration_label || "")}</em></h1>
    <p class="lead">${escapeHTML(protocol.long_description || protocol.short_description || "")}</p>
    <section class="content-list">
      ${contents.map(c => {
        const file = c.public_url || c.file_url || c.video_url || "";
        return `<article class="content-card reveal">
          <span>${c.type === "video" ? "🎥" : c.type === "tracker" ? "📊" : c.type === "calendar" ? "🗓️" : "📄"}</span>
          <h2>${escapeHTML(c.title)}</h2>
          <p>${escapeHTML(c.description || c.content_text || "")}</p>
          ${file ? `<button class="download-link as-button" onclick="openSignedProtocolFile(\'${c.id}\')">${c.type === "video" ? "Ouvrir la vidéo" : "Télécharger / ouvrir"}</button>` : ""}
        </article>`;
      }).join("") || `<article class="content-card"><span>🤍</span><h2>Contenu à venir</h2><p>L’admin ajoutera ici ses fichiers, vidéos, checklists, calendriers, trackers et routines.</p></article>`}
    </section>`;
  observeReveal();
}

async function fetchCustomPage(slug) {
  const client = initSupabase();
  if (client) {
    const { data } = await client.from("app_pages").select("*").eq("slug", slug).maybeSingle();
    if (data) {
      const { data: sections } = await client.from("page_sections").select("*").eq("page_id", data.id).eq("active", true).order("sort_order", { ascending: true });
      data.sections = sections || [];
      return data;
    }
  }
  const page = (window.MT_DEFAULT_PAGES || []).find(p => p.slug === slug);
  return page ? { ...page, sections: (window.MT_DEFAULT_SECTIONS || {})[slug] || [] } : null;
}
async function renderCustomPage() {
  const el = document.getElementById("customPage");
  if (!el) return;
  await mtRequireUser();
  const slug = getParam("slug");
  const page = await fetchCustomPage(slug);
  if (!page) { el.innerHTML = `<div class="empty-card"><h2>Page introuvable</h2></div>`; return; }
  const sections = page.sections || [];
  el.innerHTML = `<div class="kicker">${escapeHTML(page.emoji || "✦")} Espace privé</div>
    <h1 class="page-title">${escapeHTML(page.label || page.title || "Page")}<br><em>Méthode Tee</em></h1>
    <p class="lead">${escapeHTML(page.description || "Contenus privés, conseils, recettes, routines et ressources ajoutés depuis l’admin.")}</p>
    ${sections.map(renderSection).join("") || `<div class="empty-card"><h2>Page à construire</h2><p>Ajoute tes rubriques depuis l’admin.</p></div>`}`;
  observeReveal();
}
function renderSection(s) {
  let payload = s.payload || {};
  if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch(e) { payload = {}; } }
  const items = payload.items || [];
  if (s.type === "text") {
    return `<section class="page-section reveal"><div class="kicker">${escapeHTML(s.kicker || "")}</div><h2>${escapeHTML(s.title || "")}</h2><p>${escapeHTML(payload.text || s.intro || "")}</p></section>`;
  }
  if (s.type === "cards") {
    return `<section class="page-section reveal"><div class="kicker">${escapeHTML(s.kicker || "")}</div><h2>${escapeHTML(s.title || "")}</h2><p>${escapeHTML(s.intro || "")}</p><div class="mini-grid">${items.map(i => `<article class="mini-editorial-card"><b>${escapeHTML(i.emoji || "✦")}</b><h3>${escapeHTML(i.title || "")}</h3><p>${escapeHTML(i.text || "")}</p></article>`).join("")}</div></section>`;
  }
  if (s.type === "feed") {
    return `<section class="page-section reveal"><div class="kicker">${escapeHTML(s.kicker || "")}</div><h2>${escapeHTML(s.title || "")}</h2><p>${escapeHTML(s.intro || "")}</p><div class="feed-list">${items.map(i => postCard({ title:i.title, content:i.text, type:i.type || "Contenu", created_at:i.date || new Date().toISOString(), media_urls:i.media_urls || [] })).join("")}</div></section>`;
  }
  return `<section class="page-section reveal"><h2>${escapeHTML(s.title || "Rubrique")}</h2><p>${escapeHTML(s.intro || "")}</p></section>`;
}
async function renderDashboard() {
  const el = document.getElementById("dashboardSummary");
  if (!el) return;
  const user = await mtRequireUser();
  if (!user) return;
  const owned = await fetchOwnedIds();
  const access = await mtHasLimitedAccess();
  el.innerHTML = `
    <article class="mini-card glass reveal"><b>🔐</b><h2>${access ? "Actif" : "Limité"}</h2><p>Accès général</p></article>
    <article class="mini-card glass reveal"><b>📚</b><h2>${owned.length}</h2><p>Protocoles débloqués</p></article>
    <article class="mini-card glass reveal"><b>✨</b><h2>V12</h2><p>Univers privé</p></article>`;
  observeReveal();
}
function observeReveal() {
  const items = document.querySelectorAll(".reveal:not(.observed)");
  const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }), { threshold: .08 });
  items.forEach(i => { i.classList.add("observed"); obs.observe(i); });
}

async function renderLibraryPage() {
  const el = document.getElementById("libraryPage");
  if (!el) return;

  const user = await mtRequireUser();
  if (!user) return;

  const owned = await fetchOwnedIds();
  const client = initSupabase();

  let contents = [];
  if (client && owned.length) {
    const { data, error } = await client
      .from("protocol_contents")
      .select("*, protocols(title, emoji, category)")
      .in("protocol_id", owned)
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (!error) contents = data || [];
  }

  const categories = [
    { key: "document", label: "PDF", emoji: "📄" },
    { key: "video", label: "Vidéos", emoji: "🎥" },
    { key: "recette", label: "Recettes", emoji: "🥣" },
    { key: "routine", label: "Routines", emoji: "🌙" },
    { key: "tracker", label: "Trackers", emoji: "📊" },
    { key: "calendar", label: "Calendriers", emoji: "🗓️" },
    { key: "checklist", label: "Checklists", emoji: "✅" },
    { key: "playlist", label: "Playlists", emoji: "🎧" }
  ];

  const categoryCards = categories.map(cat => {
    const count = contents.filter(c => String(c.type || "").toLowerCase() === cat.key).length;
    return `<article class="library-category reveal">
      <b>${cat.emoji}</b>
      <h2>${cat.label}</h2>
      <p>${count} contenu${count > 1 ? "s" : ""}</p>
    </article>`;
  }).join("");

  const contentCards = contents.map(c => {
    const url = c.public_url || c.file_url || c.video_url || c.file_path || "";
    const icon = c.type === "video" ? "🎥" : c.type === "routine" ? "🌙" : c.type === "tracker" ? "📊" : c.type === "calendar" ? "🗓️" : c.type === "checklist" ? "✅" : "📄";
    return `<article class="content-card reveal">
      <span>${icon}</span>
      <h2>${escapeHTML(c.title || "Contenu")}</h2>
      <p>${escapeHTML(c.description || c.content_text || "")}</p>
      <small>${escapeHTML(c.protocols?.title || "Protocole privé")}</small>
      ${url ? `<button class="download-link as-button" onclick="openSignedProtocolFile('${c.id}')">${c.type === "video" ? "Ouvrir la vidéo" : "Ouvrir / télécharger"}</button>` : ""}
    </article>`;
  }).join("");

  el.innerHTML = `
    <div class="kicker">Bibliothèque privée</div>
    <h1 class="page-title">Tes contenus<br><em>débloqués</em></h1>
    <p class="lead">Tous les PDFs, vidéos, recettes, routines, trackers et fichiers liés aux protocoles achetés.</p>
    <section class="library-grid">${categoryCards}</section>
    <section class="content-list">${contentCards || `<div class="empty-card"><h2>Aucun contenu débloqué</h2><p>Les contenus apparaîtront ici après achat et déblocage d’un protocole.</p></div>`}</section>
  `;
  observeReveal();
}


document.addEventListener("DOMContentLoaded", async () => {
  await autoUnlockFromSuccess();
  renderTopActions();
  await renderNav();
  renderHomeFeed();
  renderProtocolsPage();
  renderProtocolDetail();
  renderCustomPage();
  renderDashboard();
  renderLibraryPage();
});
