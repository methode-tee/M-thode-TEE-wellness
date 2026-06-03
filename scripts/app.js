
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
  const localOwned = JSON.parse(localStorage.getItem("mt_local_unlocks") || "[]").filter(Boolean);
  if (!user || !client) return [...new Set(localOwned)];

  const ids = new Set(localOwned);

  async function collect(query) {
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      data.forEach(row => {
        const active = !row.status || row.status === "active";
        const unlocked = row.unlocked !== false;
        if (active && unlocked && row.protocol_id) ids.add(row.protocol_id);
      });
    }
  }

  // 1) Accès normal : user_id = auth.uid()
  await collect(
    client.from("user_protocols")
      .select("protocol_id, unlocked, status")
      .eq("user_id", user.id)
  );

  // 2) Accès de secours : anciennes lignes créées par email uniquement
  if (user.email) {
    await collect(
      client.from("user_protocols")
        .select("protocol_id, unlocked, status")
        .ilike("user_email", user.email)
    );
  }

  return [...ids];
}


async function autoUnlockFromSuccess(){
  // Après retour Stripe, on force juste la relecture Supabase.
  // On ne débloque plus tous les protocoles en local pour éviter de fausser l'app.
  const success = new URLSearchParams(window.location.search).get("payment");
  if (success === "success") {
    localStorage.removeItem("mt_protocols_cache");
  }
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
  el.innerHTML  const typeIcon = { video:"🎥", audio:"🎧", recette:"🥣", routine:"🌙", tracker:"📊",
    calendar:"🗓️", checklist:"✅", playlist:"🎧", ebook:"📖", guide:"🌿",
    tableau:"📊", suivi:"📈", document:"📄" };

  el.innerHTML = `<div class="kicker">Protocole privé</div>
    <h1 class="page-title">${escapeHTML(protocol.title)}<br><em>${escapeHTML(protocol.duration_label || "")}</em></h1>
    <p class="lead">${escapeHTML(protocol.long_description || protocol.short_description || "")}</p>
    <section class="content-list">
      ${contents.map(c => {
        const t = (c.type || "document").toLowerCase();
        const icon = typeIcon[t] || "📄";
        const cData = JSON.stringify(c).replace(/`/g,"\`").replace(/\\/g,"\\\\");
        return "<article class=\"content-card immersive-card reveal\" onclick=\"openContentViewer(" + cData + ")\">" +
          "<div class=\"icard-top\"><span class=\"icard-icon\">" + icon + "</span><span class=\"icard-type\">" + getTypeLabel(t) + "</span></div>" +
          "<h2 class=\"icard-title\">" + escapeHTML(c.title) + "</h2>" +
          (c.description ? "<p class=\"icard-desc\">" + escapeHTML(c.description) + "</p>" : "") +
          "<div class=\"icard-cta\">Ouvrir \u2192</div>" +
          "</article>";
      }).join("") || `<article class="content-card"><span>🤍</span><h2>Contenu à venir</h2><p>Les fichiers, vidéos, recettes et routines apparaîtront ici.</p></article>`}
    </section>`;
  observeReveal();
  await renderProgressBar(protocol, el);
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

/* ============================================================
   V18 — IMMERSIVE VIEWER + PROGRESSION
   ============================================================ */

/* --- Viewer immersif --- */
function openContentViewer(c) {
  const existing = document.getElementById("mtViewer");
  if (existing) existing.remove();

  const url = c.public_url || c.file_url || c.video_url || "";
  const type = (c.type || "document").toLowerCase();
  let body = "";

  if (type === "video") {
    // YouTube / Vimeo embed ou video directe
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (ytMatch) {
      body = `<div class="viewer-video-wrap"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
    } else if (vimeoMatch) {
      body = `<div class="viewer-video-wrap"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
    } else if (url) {
      body = `<div class="viewer-video-wrap"><video controls autoplay playsinline src="${escapeHTML(url)}"></video></div>`;
    }

  } else if (type === "audio") {
    body = `<div class="viewer-audio-wrap">
      <div class="audio-cover">🎧</div>
      <h3 class="audio-title">${escapeHTML(c.title || "Audio")}</h3>
      <p class="audio-desc">${escapeHTML(c.description || "")}</p>
      <audio controls autoplay src="${escapeHTML(url)}" class="audio-player"></audio>
    </div>`;

  } else if (type === "document" || type === "ebook" || type === "guide") {
    if (url.toLowerCase().endsWith(".pdf") || url.includes("/pdf") || url.includes("application/pdf")) {
      body = `<div class="viewer-pdf-wrap">
        <iframe src="${escapeHTML(url)}#view=FitH" class="pdf-frame" title="${escapeHTML(c.title || 'PDF')}"></iframe>
        <a class="viewer-dl-btn" href="${escapeHTML(url)}" target="_blank" download>⬇ Télécharger le PDF</a>
      </div>`;
    } else if (url) {
      body = `<div class="viewer-doc-wrap">
        <div class="doc-icon">📄</div>
        <p>${escapeHTML(c.description || "")}</p>
        <a class="viewer-dl-btn" href="${escapeHTML(url)}" target="_blank">Ouvrir le fichier</a>
      </div>`;
    }

  } else if (type === "recette") {
    let steps = [];
    let ingredients = [];
    try {
      const p = typeof c.payload === "string" ? JSON.parse(c.payload) : (c.payload || {});
      steps = p.steps || [];
      ingredients = p.ingredients || [];
    } catch(e) {}
    body = `<div class="viewer-recette-wrap">
      ${c.image_url || url.match(/\.(jpg|jpeg|png|webp)$/i) ? `<img src="${escapeHTML(c.image_url || url)}" class="recette-hero" alt="">` : "<div class='recette-emoji'>🥣</div>"}
      <div class="recette-body">
        ${ingredients.length ? `<div class="recette-section"><h4>Ingrédients</h4><ul>${ingredients.map(i => `<li>${escapeHTML(i)}</li>`).join("")}</ul></div>` : ""}
        ${steps.length ? `<div class="recette-section"><h4>Préparation</h4><ol>${steps.map(s => `<li>${escapeHTML(s)}</li>`).join("")}</ol></div>` : ""}
        ${!ingredients.length && !steps.length ? `<p class="recette-text">${escapeHTML(c.description || c.content_text || "")}</p>` : ""}
        ${url && !url.match(/\.(jpg|jpeg|png|webp)$/i) ? `<a class="viewer-dl-btn" href="${escapeHTML(url)}" target="_blank">Voir la recette complète</a>` : ""}
      </div>
    </div>`;

  } else if (type === "checklist") {
    let items = [];
    try {
      const p = typeof c.payload === "string" ? JSON.parse(c.payload) : (c.payload || {});
      items = p.items || [];
    } catch(e) {}
    const storageKey = `checklist_${c.id}`;
    let checked = [];
    try { checked = JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch(e) {}
    body = `<div class="viewer-checklist-wrap">
      <p class="checklist-desc">${escapeHTML(c.description || "")}</p>
      <ul class="checklist-list" id="checklistItems_${c.id}">
        ${items.map((item, i) => `
          <li class="checklist-item ${checked.includes(i) ? "checked" : ""}" onclick="toggleChecklistItem('${c.id}',${i},${items.length})">
            <span class="check-box">${checked.includes(i) ? "✓" : ""}</span>
            <span class="check-label">${escapeHTML(item)}</span>
          </li>`).join("")}
      </ul>
      ${items.length ? `<p class="checklist-progress" id="checkProg_${c.id}">${checked.length}/${items.length} complété${checked.length > 1 ? "s" : ""}</p>` : ""}
    </div>`;

  } else if (type === "playlist") {
    body = `<div class="viewer-playlist-wrap">
      <div class="playlist-icon">🎧</div>
      <p>${escapeHTML(c.description || "")}</p>
      ${url ? `<a class="viewer-dl-btn" href="${escapeHTML(url)}" target="_blank">Ouvrir la playlist</a>` : ""}
    </div>`;

  } else if (type === "routine") {
    let steps = [];
    try {
      const p = typeof c.payload === "string" ? JSON.parse(c.payload) : (c.payload || {});
      steps = p.steps || [];
    } catch(e) {}
    body = `<div class="viewer-routine-wrap">
      <p>${escapeHTML(c.description || "")}</p>
      ${steps.length ? `<ol class="routine-steps">${steps.map(s => `<li>${escapeHTML(s)}</li>`).join("")}</ol>` : ""}
      ${url ? `<a class="viewer-dl-btn" href="${escapeHTML(url)}" target="_blank">Télécharger la routine</a>` : ""}
    </div>`;

  } else if (type === "tracker" || type === "tableau" || type === "suivi") {
    body = `<div class="viewer-tracker-wrap">
      <div class="tracker-icon">📊</div>
      <p>${escapeHTML(c.description || "")}</p>
      ${url ? `<a class="viewer-dl-btn" href="${escapeHTML(url)}" target="_blank">Ouvrir / télécharger</a>` : ""}
    </div>`;

  } else if (type === "calendar") {
    body = `<div class="viewer-calendar-wrap">
      <div class="calendar-icon">🗓️</div>
      <p>${escapeHTML(c.description || "")}</p>
      ${url ? `<a class="viewer-dl-btn" href="${escapeHTML(url)}" target="_blank">Voir le calendrier</a>` : ""}
    </div>`;

  } else {
    body = `<div class="viewer-doc-wrap">
      <p>${escapeHTML(c.description || c.content_text || "")}</p>
      ${url ? `<a class="viewer-dl-btn" href="${escapeHTML(url)}" target="_blank">Ouvrir le fichier</a>` : ""}
    </div>`;
  }

  const modal = document.createElement("div");
  modal.id = "mtViewer";
  modal.className = "mt-viewer-overlay";
  modal.innerHTML = `
    <div class="mt-viewer-panel">
      <div class="viewer-header">
        <div class="viewer-header-left">
          <span class="viewer-type-badge">${getTypeLabel(type)}</span>
          <h2 class="viewer-title">${escapeHTML(c.title || "Contenu")}</h2>
        </div>
        <button class="viewer-close" onclick="document.getElementById('mtViewer').remove()">✕</button>
      </div>
      <div class="viewer-body">${body || "<p class='viewer-empty'>Aucun contenu à afficher.</p>"}</div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("open"));
}

function getTypeLabel(type) {
  const map = { document:"PDF", video:"Vidéo", audio:"Audio", recette:"Recette", checklist:"Checklist",
    routine:"Routine", tracker:"Tracker", calendar:"Calendrier", playlist:"Playlist",
    ebook:"Ebook", guide:"Guide", tableau:"Tableau", suivi:"Suivi" };
  return map[type] || type;
}

function toggleChecklistItem(contentId, idx, total) {
  const key = `checklist_${contentId}`;
  let checked = [];
  try { checked = JSON.parse(localStorage.getItem(key) || "[]"); } catch(e) {}
  if (checked.includes(idx)) checked = checked.filter(i => i !== idx);
  else checked.push(idx);
  localStorage.setItem(key, JSON.stringify(checked));
  // Update UI
  const list = document.getElementById(`checklistItems_${contentId}`);
  if (list) {
    list.querySelectorAll(".checklist-item").forEach((li, i) => {
      li.classList.toggle("checked", checked.includes(i));
      li.querySelector(".check-box").textContent = checked.includes(i) ? "✓" : "";
    });
  }
  const prog = document.getElementById(`checkProg_${contentId}`);
  if (prog) prog.textContent = `${checked.length}/${total} complété${checked.length > 1 ? "s" : ""}`;
}

/* --- Progression protocole --- */
async function fetchProtocolProgress(protocolId) {
  const client = initSupabase();
  if (!client) return null;
  const user = await mtGetUser();
  if (!user) return null;
  const { data } = await client.from("protocol_progress")
    .select("*").eq("user_id", user.id).eq("protocol_id", protocolId).maybeSingle();
  return data || null;
}

async function saveProtocolProgress(protocolId, daysCurrent) {
  const client = initSupabase();
  if (!client) return;
  const user = await mtGetUser();
  if (!user) return;
  const today = new Date().toISOString().split("T")[0];
  const existing = await fetchProtocolProgress(protocolId);
  let streak = 1;
  if (existing) {
    const lastDate = existing.last_check_date;
    const diff = lastDate ? Math.round((new Date(today) - new Date(lastDate)) / 86400000) : 99;
    streak = diff === 1 ? (existing.streak || 0) + 1 : diff === 0 ? (existing.streak || 1) : 1;
  }
  await client.from("protocol_progress").upsert({
    user_id: user.id, protocol_id: protocolId,
    days_current: daysCurrent, last_check_date: today,
    streak, updated_at: new Date().toISOString()
  }, { onConflict: "user_id,protocol_id" });
}

async function renderProgressBar(protocol, containerEl) {
  const totalDays = protocol.total_days || 0;
  if (!totalDays) return;
  const progress = await fetchProtocolProgress(protocol.id);
  const daysCurrent = progress?.days_current || 0;
  const streak = progress?.streak || 0;
  const pct = Math.min(100, Math.round((daysCurrent / totalDays) * 100));

  const bar = document.createElement("div");
  bar.className = "protocol-progress-block reveal";
  bar.innerHTML = `
    <div class="progress-header">
      <span class="progress-label">Progression</span>
      <span class="progress-days">Jour <strong>${daysCurrent}</strong> / ${totalDays}</span>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="progress-footer">
      <span class="streak-badge">🔥 ${streak} jour${streak > 1 ? "s" : ""} de suite</span>
      ${daysCurrent < totalDays ? `<button class="progress-checkin-btn" onclick="checkInDay('${protocol.id}',${daysCurrent + 1},${totalDays},this)">✓ Valider aujourd'hui</button>` : `<span class="progress-done">✨ Programme terminé !</span>`}
    </div>`;
  containerEl.insertBefore(bar, containerEl.querySelector(".content-list") || containerEl.firstChild);
  observeReveal();
}

async function checkInDay(protocolId, nextDay, totalDays, btn) {
  btn.disabled = true;
  btn.textContent = "Enregistrement…";
  await saveProtocolProgress(protocolId, nextDay);
  // Refresh progress block
  const el = document.getElementById("protocolDetail");
  if (el) {
    const old = el.querySelector(".protocol-progress-block");
    if (old) old.remove();
    const protocols = await fetchProtocols();
    const protocol = protocols.find(p => p.id === protocolId);
    if (protocol) await renderProgressBar(protocol, el);
  }
}
