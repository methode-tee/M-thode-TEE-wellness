
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


function mtPostDomId(p) {
  const raw = String((p && (p.id || p.slug || p.title)) || "post");
  const safe = raw
    .normalize ? raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : raw;
  return "post-" + safe.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function postCard(p) {
  const domId = mtPostDomId(p);
  return `<article id="${escapeHTML(domId)}" class="post-card reveal"
    data-post-id="${escapeHTML(domId)}"
    data-post-title="${escapeHTML(p.title || "")}"
    data-post-content="${escapeHTML(p.content || "")}"
    data-post-type="${escapeHTML(p.type || "Journal")}"
    data-post-date="${escapeHTML(p.created_at || new Date().toISOString())}">
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

window.mtPostDomId = mtPostDomId;
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

  // ADMIN PREVIEW SAFE:
  // Si l'email connecté est dans MT_CONFIG.ADMIN_EMAILS,
  // l'admin voit tous les protocoles comme débloqués pour vérifier les rendus.
  // Ça ne crée aucun achat, ne modifie pas Stripe, ne modifie pas Supabase.
  const admin = typeof mtIsAdmin === "function" ? await mtIsAdmin() : false;
  if (admin) {
    const protocols = await fetchProtocols();
    protocols.forEach(p => {
      if (p.id) ids.add(p.id);
      if (p.slug) ids.add(p.slug);
    });
    return [...ids];
  }

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


function mtSmartText(item) {
  return [
    item?.title,
    item?.subtitle,
    item?.short_description,
    item?.description,
    item?.lead,
    item?.content,
    item?.content_text,
    item?.full_content,
    item?.category,
    item?.mood,
    item?.tags,
    item?.benefits,
    item?.keywords,
    item?.duration_label,
    item?.emoji
  ].flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean).join(" ").toLowerCase();
}

function mtItemMatchesChip(item, chip) {
  if (!chip || chip.key === "all") return true;
  const text = mtSmartText(item);
  const words = chip.words || [chip.key, chip.label];
  return words.some(w => text.includes(String(w).toLowerCase()));
}

function mtChipFilterBar(idPrefix, chips = []) {
  const chipHTML = chips.map((chip, idx) => `<button type="button" class="mt-smart-chip ${idx === 0 ? "active" : ""}" data-smart-chip="${escapeHTML(chip.key)}">${escapeHTML(chip.label)}${chip.sub ? `<small>${escapeHTML(chip.sub)}</small>` : ""}</button>`).join("");
  return `<section class="mt-chip-filter reveal" data-chip-filter="${idPrefix}">
    <div class="mt-chip-row" id="${idPrefix}Chips">${chipHTML}</div>
  </section>`;
}

function mtApplyChipFilter({ items, chipBoxId, targetId, chips = [], render, emptyHTML }) {
  const chipBox = document.getElementById(chipBoxId);
  const target = document.getElementById(targetId);
  let activeChip = chips[0] || { key: "all" };
  if (!target) return;

  function draw() {
    const list = items.filter(item => mtItemMatchesChip(item, activeChip));
    target.innerHTML = list.map(render).join("") || emptyHTML || `<div class="empty-card"><h2>Aucun résultat</h2><p>Essaie un autre filtre.</p></div>`;
    observeReveal();
  }

  chipBox?.querySelectorAll("[data-smart-chip]").forEach(btn => {
    btn.addEventListener("click", () => {
      chipBox.querySelectorAll("[data-smart-chip]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.getAttribute("data-smart-chip");
      activeChip = chips.find(c => c.key === key) || chips[0] || { key: "all" };
      draw();
    });
  });
  draw();
}

function protocolCard(protocol, owned = false) {
  const id = protocol.id || protocol.slug;
  const image = protocol.image_url ? `<img src="${escapeHTML(protocol.image_url)}" alt="">` : `<span>${escapeHTML(protocol.emoji || "🌿")}</span>`;
  const duration = escapeHTML(protocol.duration_label || "Accès privé");
  const meta = owned
    ? `<div class="protocol-meta unlocked-meta"><span class="duration-pill">Débloqué</span><span class="duration-pill">${duration}</span></div>`
    : `<div class="protocol-meta"><span class="price-pill">${euros(protocol.price_cents || 500)}</span><span class="duration-pill">${duration}</span></div>`;

  return `<article class="protocol-card ${owned ? "unlocked" : "locked"} reveal">
    <div class="protocol-hero ${owned ? "" : "is-locked"}">${image}</div>
    <div class="protocol-head">
      <div class="protocol-mini"><span class="avatar">${escapeHTML(protocol.emoji || "🌿")}</span><div><small>${escapeHTML(protocol.subtitle || "Protocole")}</small></div></div>
      <span class="tag">${owned ? "Débloqué" : "Payant"}</span>
    </div>
    <h2>${escapeHTML(protocol.title)}</h2>
    <p>${escapeHTML(protocol.short_description || "")}</p>
    ${meta}
    <button class="main-cta" onclick="${owned ? `location.href='protocol-journey.html?id=${id}'` : `startPaymentLink('${id}')`}">${owned ? "Ouvrir le protocole" : "Débloquer ce protocole"}</button>
  </article>`;
}
async function renderProtocolsPage() {
  const el = document.getElementById("protocolGrid");
  if (!el) return;
  await mtRequireUser();
  const category = getParam("category") || "pharmacie_vegetale";

  const PAGE_META = {
    pharmacie_vegetale: {
      kicker: 'Protocoles payants',
      title: 'Pharmacie<br><em>végétale</em>',
      lead: 'Cartes privées pour besoins ciblés, routines, protocoles, fichiers et accompagnement du terrain.',
      chips: [
        { key:'all', label:'Tout' },
        { key:'digestion', label:'Digestion', words:['digestion','ventre','ballonnement','ballonnements','transit','intestin','lourdeur','mal au ventre','confort digestif','foie','reflux'] },
        { key:'sommeil', label:'Sommeil', words:['sommeil','dormir','nuit','endormissement','réveil','relaxation','calme','apaisement','passiflore','camomille','verveine'] },
        { key:'energie', label:'Énergie', words:['énergie','fatigue','vitalité','tonus','boost','concentration','maté','matcha','moringa'] },
        { key:'femme', label:'Femme', words:['femme','cycle','règles','regles','menstrues','menstruel','hormone','hormonal','spm','khamaré','framboisier','douleurs règles'] },
        { key:'circulation', label:'Circulation', words:['circulation','jambes lourdes','jambes','lourdes','rétention','retention','gonflement','drainage','œdème','oedeme'] },
        { key:'detox', label:'Détox', words:['détox','detox','drainage','élimination','elimination','toxines','sucre','sel','reset','excès','exces','surcharge'] }
      ]
    },
    objectifs_corps: {
      kicker: 'Protocoles corps',
      title: 'Objectifs<br><em>physiques</em>',
      lead: 'Programmes ciblés pour accompagner ta silhouette et ton bien-être physique, avec une approche douce, progressive et personnalisée.',
      chips: [
        { key:'all', label:'Tout' },
        { key:'silhouette', label:'Silhouette', words:['silhouette','corps','taille','jambes','ventre','posture','harmonie','affiner','équilibre corporel'] },
        { key:'tonus', label:'Tonus', words:['tonus','tonicité','tonicite','raffermir','raffermissement','activation','maintien','forme'] },
        { key:'force', label:'Force', words:['force','muscle','muscles','puissance','protéine','proteine','prise de masse','masse musculaire','sport'] },
        { key:'routine', label:'Routine', words:['routine','habitude','constance','programme','discipline','marche','entraînement','entrainement','rituel'] }
      ]
    }
  };
  const meta = PAGE_META[category] || PAGE_META.pharmacie_vegetale;
  const kEl = document.getElementById('pageKicker');
  const tEl = document.getElementById('pageTitle');
  const lEl = document.getElementById('pageLead');
  if (kEl) kEl.textContent = meta.kicker;
  if (tEl) tEl.innerHTML = meta.title;
  if (lEl) lEl.textContent = meta.lead;

  const protocols = await fetchProtocols(category);
  const owned = await fetchOwnedIds();

  document.querySelectorAll(".mt-protocol-chip-filter, .mt-protocol-smart-filter, .mt-smart-filter, .premium-filter-bar, .protocol-filter-bar").forEach(n => n.remove());
  const filterMount = document.createElement("div");
  filterMount.className = "mt-protocol-chip-filter";
  filterMount.innerHTML = `<div class="mt-filter-kicker">Explorer</div>` + mtChipFilterBar("protocol", meta.chips);
  el.parentNode.insertBefore(filterMount, el);

  mtApplyChipFilter({
    items: protocols,
    chipBoxId: "protocolChips",
    targetId: "protocolGrid",
    chips: meta.chips,
    render: (p) => protocolCard(p, owned.includes(p.id) || owned.includes(p.slug)),
    emptyHTML: `<div class="empty-card"><h2>Aucun protocole trouvé</h2><p>Essaie un autre filtre.</p></div>`
  });
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
  if (slug === "recettes" && typeof renderRecipesMarketplace === "function") {
    await renderRecipesMarketplace();
    return;
  }
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

function mtSavedKey(userId) {
  return `mt_saved_space_${userId || "guest"}`;
}
function mtReadSavedLocal(userId) {
  try {
    const raw = localStorage.getItem(mtSavedKey(userId));
    const parsed = raw ? JSON.parse(raw) : { favorites: [], routines: [] };
    return { favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [], routines: Array.isArray(parsed.routines) ? parsed.routines : [] };
  } catch(e) { return { favorites: [], routines: [] }; }
}
function mtWriteSavedLocal(userId, data) {
  localStorage.setItem(mtSavedKey(userId), JSON.stringify({ favorites: data.favorites || [], routines: data.routines || [] }));
}
function mtSavedItemFromCard(card) {
  return {
    id: card?.dataset?.postId || card?.id || `post-${Date.now()}`,
    title: card?.dataset?.postTitle || card?.querySelector("h2")?.textContent?.trim() || "Post Méthode Tee",
    content: card?.dataset?.postContent || card?.querySelector("p")?.textContent?.trim() || "",
    type: card?.dataset?.postType || card?.querySelector(".tag")?.textContent?.trim() || "Journal",
    created_at: card?.dataset?.postDate || new Date().toISOString(),
    saved_at: new Date().toISOString()
  };
}
async function mtRequireAuthForSave() {
  const user = await mtGetUser();
  if (user) return user;
  if (window.mtToast) mtToast("Connecte-toi pour sauvegarder dans ton espace personnel.", "error");
  setTimeout(() => { location.href = "auth.html"; }, 650);
  return null;
}
window.mtTogglePostSave = async function(kind, btn) {
  const user = await mtRequireAuthForSave();
  if (!user) return;
  const card = btn?.closest?.(".post-card");
  if (!card) return;
  const bucket = kind === "routine" ? "routines" : "favorites";
  const data = mtReadSavedLocal(user.id);
  const item = mtSavedItemFromCard(card);
  const exists = data[bucket].some(x => x.id === item.id);
  data[bucket] = exists ? data[bucket].filter(x => x.id !== item.id) : [item, ...data[bucket].filter(x => x.id !== item.id)].slice(0, 80);
  mtWriteSavedLocal(user.id, data);
  btn.classList.toggle("is-saved", !exists);
  btn.innerHTML = bucket === "favorites" ? (!exists ? "♥ Favori" : "♡ Favori") : (!exists ? "✓ Routine" : "＋ Routine");
  if (window.mtToast) mtToast(!exists ? (bucket === "favorites" ? "Ajouté à Mes favoris" : "Ajouté à Mes routines") : "Retiré de ton espace");
  window.mtRefreshSavedButtons && window.mtRefreshSavedButtons();
};
window.mtSavedCollectionState = window.mtSavedCollectionState || { bucket: 'favorites', filter: 'all', sort: 'recent', query: '' };

function mtSavedLabelFor(bucket) {
  return bucket === "routines"
    ? { title: "Mes routines", icon: "🌿", empty: "Aucune routine encore. Ajoute un post avec le bouton + Routine pour le retrouver ici." }
    : { title: "Mes favoris", icon: "♡", empty: "Aucun favori encore. Sauvegarde un post depuis l’accueil pour créer ta bibliothèque personnelle." };
}
function mtSavedTypes(items) {
  const list = [...new Set((items || []).map(x => String(x.type || "Journal").trim()).filter(Boolean))];
  return ["all", ...list.slice(0, 8)];
}
function mtSavedFilteredItems(items, state) {
  let out = Array.isArray(items) ? [...items] : [];
  if (state.filter && state.filter !== "all") out = out.filter(x => String(x.type || "Journal") === state.filter);
  const q = String(state.query || "").trim().toLowerCase();
  if (q) out = out.filter(x => `${x.title || ""} ${x.content || ""} ${x.type || ""}`.toLowerCase().includes(q));
  out.sort((a,b) => {
    const da = new Date(a.saved_at || a.created_at || 0).getTime();
    const db = new Date(b.saved_at || b.created_at || 0).getTime();
    return state.sort === "old" ? da - db : db - da;
  });
  return out;
}
function mtSavedCardHTML(it) {
  const type = escapeHTML(it.type || "Journal");
  const title = escapeHTML(it.title || "Post sauvegardé");
  const text = escapeHTML(mtShortSaved(it.content || "", 150));
  const date = it.saved_at ? fmtDate(it.saved_at) : "Sauvegardé";
  const initial = type.toLowerCase().includes("recette") ? "🍵" : type.toLowerCase().includes("routine") ? "🌿" : type.toLowerCase().includes("audio") ? "🎧" : type.toLowerCase().includes("hydratation") ? "💧" : "✦";
  return `<article class="saved-editorial-card" onclick="mtOpenSavedDetail('${escapeHTML(it.id || '')}')">
    <div class="saved-editorial-top"><span class="saved-editorial-icon">${initial}</span><small>${type}</small></div>
    <h4>${title}</h4>
    ${text ? `<p>${text}</p>` : ""}
    <div class="saved-editorial-foot"><span>${escapeHTML(date)}</span><b>Ouvrir →</b></div>
  </article>`;
}
function mtRenderSavedCollectionContent() {
  const userId = window.mtSavedCollectionUserId;
  const state = window.mtSavedCollectionState || { bucket: 'favorites', filter: 'all', sort: 'recent', query: '' };
  const data = mtReadSavedLocal(userId);
  const items = state.bucket === "routines" ? data.routines : data.favorites;
  const meta = mtSavedLabelFor(state.bucket);
  const filtered = mtSavedFilteredItems(items, state);
  const types = mtSavedTypes(items);
  const target = document.getElementById("savedCollectionBody");
  if (!target) return;
  target.innerHTML = `
    <div class="saved-library-head">
      <div class="saved-library-count">${items.length} élément${items.length > 1 ? "s" : ""}</div>
      <div class="saved-library-switch">
        <button class="${state.bucket === "favorites" ? "active" : ""}" onclick="mtSwitchSavedBucket('favorites')">♡ Favoris</button>
        <button class="${state.bucket === "routines" ? "active" : ""}" onclick="mtSwitchSavedBucket('routines')">🌿 Routines</button>
      </div>
    </div>
    <div class="saved-library-tools">
      <input type="search" placeholder="Rechercher…" value="${escapeHTML(state.query || "")}" oninput="mtSetSavedQuery(this.value)">
      <select onchange="mtSetSavedSort(this.value)">
        <option value="recent" ${state.sort !== "old" ? "selected" : ""}>Plus récent</option>
        <option value="old" ${state.sort === "old" ? "selected" : ""}>Plus ancien</option>
      </select>
    </div>
    <div class="saved-library-filters">
      ${types.map(t => `<button class="${state.filter === t ? "active" : ""}" onclick="mtSetSavedFilter('${escapeHTML(t)}')">${t === "all" ? "Tout" : escapeHTML(t)}</button>`).join("")}
    </div>
    ${filtered.length ? `<div class="saved-editorial-list">${filtered.map(mtSavedCardHTML).join("")}</div>` : `<div class="saved-empty"><b>${meta.icon}</b><h4>${meta.title}</h4><p>${items.length ? "Aucun contenu ne correspond à cette recherche." : meta.empty}</p></div>`}
  `;
}
window.mtSwitchSavedBucket = function(bucket){ window.mtSavedCollectionState.bucket = bucket; window.mtSavedCollectionState.filter = 'all'; mtRenderSavedCollectionContent(); };
window.mtSetSavedFilter = function(filter){ window.mtSavedCollectionState.filter = filter; mtRenderSavedCollectionContent(); };
window.mtSetSavedSort = function(sort){ window.mtSavedCollectionState.sort = sort; mtRenderSavedCollectionContent(); };
window.mtSetSavedQuery = function(query){ window.mtSavedCollectionState.query = query; mtRenderSavedCollectionContent(); };
window.mtOpenSavedDetail = function(id){
  if (!id) return;
  const userId = window.mtSavedCollectionUserId;
  const state = window.mtSavedCollectionState || { bucket:'favorites' };
  const data = mtReadSavedLocal(userId);
  const all = [...(data.favorites || []), ...(data.routines || [])];
  const it = all.find(x => x.id === id);
  if (!it) return;
  const modal = document.getElementById("savedDetailPreview") || document.createElement("div");
  modal.id = "savedDetailPreview";
  modal.className = "saved-detail-preview open";
  modal.innerHTML = `<div class="saved-detail-backdrop" onclick="mtCloseSavedDetail()"></div>
    <article class="saved-detail-card">
      <button onclick="mtCloseSavedDetail()">×</button>
      <small>${escapeHTML(it.type || "Journal")}</small>
      <h3>${escapeHTML(it.title || "Post sauvegardé")}</h3>
      <p>${escapeHTML(it.content || "")}</p>
      <div class="saved-detail-actions"><button onclick="mtCloseSavedDetail()">Fermer</button></div>
    </article>`;
  document.body.appendChild(modal);
};
window.mtCloseSavedDetail = function(){ const modal=document.getElementById("savedDetailPreview"); if(modal) modal.remove(); };

window.mtOpenSavedCollection = async function(bucket) {
  const user = await mtRequireAuthForSave();
  if (!user) return;
  window.mtSavedCollectionUserId = user.id;
  window.mtSavedCollectionState = { bucket: bucket === "routines" ? "routines" : "favorites", filter: "all", sort: "recent", query: "" };
  let modal = document.getElementById("ritualSignalDrawer");
  if(!modal){ modal=document.createElement("div"); modal.id="ritualSignalDrawer"; modal.className="ritual-signal-drawer"; document.body.appendChild(modal); }
  const meta = mtSavedLabelFor(window.mtSavedCollectionState.bucket);
  modal.innerHTML = `<div class="ritual-signal-backdrop" onclick="mtCloseSavedCollection()"></div>
    <div class="ritual-signal-sheet saved-sheet saved-library-sheet">
      <div class="ritual-signal-grip"></div>
      <button class="ritual-signal-close" onclick="mtCloseSavedCollection()">×</button>
      <div class="ritual-signal-icon">${meta.icon}</div>
      <div class="ritual-signal-kicker">Espace personnel</div>
      <h3>${meta.title}</h3>
      <p class="saved-library-intro">Tes contenus enregistrés depuis le journal, rangés dans une bibliothèque privée et facile à retrouver.</p>
      <div id="savedCollectionBody"></div>
    </div>`;
  modal.classList.add("open");
  mtRenderSavedCollectionContent();
};
window.mtCloseSavedCollection = function(){ const modal=document.getElementById("ritualSignalDrawer"); if(modal) modal.classList.remove("open"); };
function mtShortSaved(str, max=110){ str=String(str||"").replace(/\s+/g," ").trim(); return str.length>max ? str.slice(0,max-1).trim()+"…" : str; }
async function mtSavedCounts() {
  const user = await mtGetUser();
  if (!user) return { favorites: 0, routines: 0 };
  const data = mtReadSavedLocal(user.id);
  return { favorites: data.favorites.length, routines: data.routines.length };
}

async function renderDashboard() {
  const el = document.getElementById("dashboardSummary");
  if (!el) return;
  const user = await mtRequireUser();
  if (!user) return;
  const owned = await fetchOwnedIds();
  const access = await mtHasLimitedAccess();
  const saved = await mtSavedCounts();
  el.innerHTML = `
    <article class="mini-card glass reveal"><b>🔐</b><h2>${access ? "Actif" : "Limité"}</h2><p>Accès général</p></article>
    <article class="mini-card glass reveal"><b>📚</b><h2>${owned.length}</h2><p>Protocoles débloqués</p></article>
    <article class="mini-card glass reveal"><b>✨</b><h2>V19</h2><p>Univers privé</p></article>

    <article class="mini-card glass reveal saved-profile-card" onclick="mtOpenSavedCollection('favorites')"><b>♡</b><h2>Mes favoris</h2><p>${saved.favorites} contenu${saved.favorites > 1 ? "s" : ""} sauvegardé${saved.favorites > 1 ? "s" : ""}</p></article>
    <article class="mini-card glass reveal saved-profile-card" onclick="mtOpenSavedCollection('routines')"><b>🌿</b><h2>Mes routines</h2><p>${saved.routines} rituel${saved.routines > 1 ? "s" : ""} ajouté${saved.routines > 1 ? "s" : ""}</p></article>

    <article class="install-app-card reveal">
      <div class="install-app-kicker">Expérience immersive</div>
      <h2>Installer Méthode Tee</h2>
      <p>
        Ajoute l’app à ton écran d’accueil pour vivre Méthode Tee de manière plus fluide,
        immersive et complète. Les parcours, les rappels doux et ton espace privé sont pensés
        pour être utilisés comme une vraie application.
      </p>
      <div class="install-app-steps">
        <div><b>iPhone</b><span>Safari → Partager → Sur l’écran d’accueil</span></div>
        <div><b>Android</b><span>Menu navigateur → Installer l’application</span></div>
      </div>
      <p class="install-app-note">🌿 Pour recevoir les rappels doux, ouvre toujours Méthode Tee depuis l’icône installée sur ton téléphone.</p>
    </article>

    <article class="trust-app-card reveal" onclick="location.href='confiance.html'">
      <div class="trust-app-icon">🔒</div>
      <div>
        <div class="trust-app-kicker">Espace confiance</div>
        <h2>Confiance & Confidentialité</h2>
        <p>Protection des données, paiements sécurisés, contenus privés et cadre bien-être.</p>
      </div>
      <span class="trust-app-arrow">→</span>
    </article>

    <article class="push-notif-card reveal" id="pushNotifCard">
      <div class="push-notif-icon">&#x1F514;</div>
      <div class="push-notif-body">
        <div class="push-notif-kicker">Rappels doux</div>
        <h2>Notifications</h2>
        <p id="pushNotifDesc">Reçois ton rappel rituel chaque matin &mdash; nouveau contenu, intention du jour, déblocage de protocole.</p>
      </div>
      <button class="push-notif-btn journey-push-btn" id="pushNotifBtn"
        onclick="window.mtEnablePushNotifications && window.mtEnablePushNotifications()">
        Activer
      </button>
    </article>`;
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

  let purchasedRecipes = [];
  if (client) {
    const email = user.email || "";
    let recipePurchaseQuery = client
      .from("recipe_purchases")
      .select("recipe_id, purchased_at, recipes(*)")
      .eq("status", "active");

    if (email) {
      recipePurchaseQuery = recipePurchaseQuery.or(`user_id.eq.${user.id},user_email.eq.${email}`);
    } else {
      recipePurchaseQuery = recipePurchaseQuery.eq("user_id", user.id);
    }

    const { data: recipeRows, error: recipeRowsError } = await recipePurchaseQuery
      .order("purchased_at", { ascending: false });

    if (recipeRowsError) console.warn("recipe library read error", recipeRowsError);
    purchasedRecipes = (recipeRows || []).map(r => ({ ...(r.recipes || {}), purchased_at: r.purchased_at })).filter(r => r.id);
  }

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
    const baseCount = contents.filter(c => String(c.type || "").toLowerCase() === cat.key).length;
    const count = cat.key === "recette" ? baseCount + purchasedRecipes.length : baseCount;
    return `<article class="library-category reveal">
      <b>${cat.emoji}</b>
      <h2>${cat.label}</h2>
      <p>${count} contenu${count > 1 ? "s" : ""}</p>
    </article>`;
  }).join("");

  const recipeCards = purchasedRecipes.map(r => `<article class="content-card reveal recipe-owned-card">
      <span>${escapeHTML(r.emoji || "🥣")}</span>
      <h2>${escapeHTML(r.title || "Recette")}</h2>
      <p>${escapeHTML(r.description || r.subtitle || "Recette premium débloquée.")}</p>
      <small>Recette achetée</small>
      <button class="download-link as-button" onclick="openRecipeViewer('${escapeHTML(r.id)}')">Ouvrir la recette</button>
    </article>`).join("");

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
    <section class="content-list">${recipeCards}${contentCards || (recipeCards ? "" : `<div class="empty-card"><h2>Aucun contenu débloqué</h2><p>Les contenus apparaîtront ici après achat et déblocage d’un protocole ou d’une recette.</p></div>`)}</section>
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
  await renderDashboard();
  renderLibraryPage();
  setTimeout(() => {
    if (typeof window.mtRefreshPushButtons === 'function') window.mtRefreshPushButtons();
    if ('Notification' in window && Notification.permission === 'granted') {
      const btn = document.getElementById('pushNotifBtn');
      const desc = document.getElementById('pushNotifDesc');
      if (btn) { btn.classList.add('is-on'); btn.textContent = 'Rappels activés ✓'; btn.disabled = true; }
      if (desc) desc.textContent = 'Tu recevras un rappel doux chaque matin. Merci d’être là 🌿';
    }
  }, 800);
});

/* =========================================================
   V20 — RECETTES MARKETPLACE SAFE
   Page Recettes = découverte + vente
   Biblio > Recette = recettes déjà achetées
   ========================================================= */

async function mtGetPurchasedRecipeIds() {
  const user = await mtGetUser();
  if (!user) return [];
  const client = initSupabase();
  if (!client) return [];

  // Lecture renforcée :
  // 1) user_id = compte connecté
  // 2) fallback user_email = email du compte connecté
  // Cela évite qu'une recette payée reste visuellement verrouillée
  // si Stripe renvoie surtout l'email client.
  const email = user.email || "";
  let query = client
    .from("recipe_purchases")
    .select("recipe_id")
    .eq("status", "active");

  if (email) {
    query = query.or(`user_id.eq.${user.id},user_email.eq.${email}`);
  } else {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("recipe_purchases read error", error);
    return [];
  }

  return [...new Set((data || []).map(r => String(r.recipe_id)).filter(Boolean))];
}

async function mtFetchRecipes() {
  const client = initSupabase();
  if (client) {
    const { data, error } = await client
      .from("recipes")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (!error && data?.length) return data;
  }
  return [
    {
      id: "smoothie-glow-demo",
      title: "Smoothie Glow Rouge",
      subtitle: "Peau, énergie douce, envie sucrée apaisée",
      description: "Une recette fruitée, fraîche et simple pour nourrir le glow sans tomber dans le sucre lourd.",
      category: "Glow peau",
      mood: "Énergie douce",
      emoji: "🍓",
      image_url: "",
      is_premium: false,
      price_cents: 0,
      content_text: "Ingrédients : fruits rouges, banane, yaourt végétal ou lait, graines de chia.\nPréparation : mixer, servir frais, ajouter quelques fruits secs Maison Yanna en topping."
    },
    {
      id: "latte-sommeil-demo",
      title: "Latte Sommeil Velours",
      subtitle: "Routine du soir, douceur, détente",
      description: "Un latte chaud et réconfortant pensé comme un rituel du soir.",
      category: "Sommeil",
      mood: "Soir calme",
      emoji: "🌙",
      image_url: "",
      is_premium: true,
      price_cents: 500,
      content_text: "Preview : une base végétale chaude, des notes douces, une préparation lente et apaisante."
    }
  ];
}

async function startSecureCheckoutRecipe(recipeId) {
  try {
    // Paiement recettes séparé : ne pas utiliser create-checkout-session,
    // qui reste réservé aux protocoles et à l'accès app.
    const result = await mtCallFunction("create-recipe-checkout-session", {
      recipe_id: recipeId
    });
    if (result?.url) location.href = result.url;
  } catch (err) {
    alert(err.message || "Impossible d’ouvrir le paiement de la recette.");
  }
}

function mtRecipeCard(recipe, purchasedIds = []) {
  const owned = !recipe.is_premium || purchasedIds.includes(recipe.id);
  const price = recipe.is_premium ? euros(recipe.price_cents || 500) : "Gratuit";
  const badge = owned ? "Débloqué" : (recipe.is_premium ? price : "Gratuit");
  const img = recipe.image_url
    ? `<div class="recipe-img"><img src="${escapeHTML(recipe.image_url)}" alt=""></div>`
    : `<div class="recipe-img recipe-img-placeholder"><span>${escapeHTML(recipe.emoji || "🥣")}</span></div>`;
  return `<article class="recipe-market-card reveal ${recipe.is_premium ? "is-premium" : "is-free"}">
    ${img}
    <div class="recipe-market-body">
      <div class="recipe-market-top"><span>${escapeHTML(recipe.category || "Recette")}</span><b>${escapeHTML(badge)}</b></div>
      <h2>${escapeHTML(recipe.title || "Recette")}</h2>
      <p>${escapeHTML(recipe.subtitle || recipe.description || "")}</p>
      <div class="recipe-market-meta">
        <span>${escapeHTML(recipe.mood || "Rituel nutrition")}</span>
        ${recipe.is_premium && !owned ? `<span>🔒 Premium</span>` : `<span>✓ Disponible</span>`}
      </div>
      ${owned
        ? `<button class="download-link as-button" onclick="openRecipeViewer('${escapeHTML(recipe.id)}')">Voir la recette</button>`
        : `<button class="download-link as-button" onclick="startSecureCheckoutRecipe('${escapeHTML(recipe.id)}')">Débloquer la recette</button>`}
    </div>
  </article>`;
}

async function renderRecipesMarketplace() {
  const el = document.getElementById("customPage");
  if (!el) return;
  const user = await mtRequireUser();
  if (!user) return;

  const [recipes, purchasedIds] = await Promise.all([mtFetchRecipes(), mtGetPurchasedRecipeIds()]);
  const freeCount = recipes.filter(r => !r.is_premium).length;
  const premiumCount = recipes.filter(r => r.is_premium).length;
  const recipeChips = [
    { key:'all', label:'Tout' },
    { key:'morning', label:'Morning', words:['morning','matin','petit-déjeuner','breakfast','granola','muesli','pancake','latte matin','bowl'] },
    { key:'daily', label:'Daily', words:['daily','quotidien','déjeuner','lunch','repas','salé','sale','assiette','bowl','lunchbox'] },
    { key:'snack', label:'Snack', words:['snack','collation','goûter','gouter','petite faim','energy balls','barre','bouchée'] },
    { key:'dinner', label:'Dinner', words:['dinner','soir','dîner','diner','repas du soir','léger','light','souper'] },
    { key:'sweet', label:'Sweet', words:['sweet','sucré','sucre','dessert','chocolat','brownie','cookie','gourmand','craving','envie sucrée'] },
    { key:'drinks', label:'Drinks', words:['drinks','drink','boisson','smoothie','latte','matcha','kombucha','iced tea','thé glacé','infusion glacée','jus'] }
  ];

  el.innerHTML = `<div class="kicker">🥣 Espace privé</div>
    <h1 class="page-title">Recettes<br><em>Méthode Tee</em></h1>
    <p class="lead">Découvre des idées repas, boissons, bowls, lattes et routines nutrition. Les recettes premium se débloquent ici puis se rangent automatiquement dans ta bibliothèque.</p>

    <section class="recipes-hero reveal editorial-recipes-hero">
      <div class="recipes-hero-copy">
        <span>Collection nutrition</span>
        <h2>Recettes<br><em>& alternatives gourmandes</em></h2>
        <p>Une collection de recettes et boissons revisitées dans une version plus douce, plus équilibrée et toujours gourmande.</p>
      </div>

      <div class="recipes-editorial-panel">
        <div class="recipes-editorial-row">
          <label>Collection ouverte</label>
          <strong>${freeCount}</strong>
        </div>

        <div class="recipes-editorial-row">
          <label>Recettes réservées</label>
          <strong>${premiumCount}</strong>
        </div>

        <div class="recipes-editorial-divider"></div>

        <div class="recipes-editorial-unlocked">
          ✦ ${premiumCount} expériences débloquées
        </div>
      </div>
    </section>

    <div class="mt-recipes-chip-filter">
      <div class="mt-filter-kicker">Explorer</div>
      ${mtChipFilterBar("recipe", recipeChips)}
    </div>

    <section id="recipeMarketGrid" class="recipe-market-grid"></section>
  `;

  mtApplyChipFilter({
    items: recipes,
    chipBoxId: "recipeChips",
    targetId: "recipeMarketGrid",
    chips: recipeChips,
    render: (r) => mtRecipeCard(r, purchasedIds),
    emptyHTML: `<div class="empty-card"><h2>Aucune recette trouvée</h2><p>Essaie un autre filtre.</p></div>`
  });
  observeReveal();
}


function mtRecipeSplitLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
}

function mtRecipeSectionFromLines(title, lines, mode = "bullet") {
  if (!lines || !lines.length) return "";
  const items = lines.map((line, idx) => {
    const clean = line.replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, "");
    if (mode === "steps") {
      return `<li class="mt-recipe-step"><span>${idx + 1}</span><p>${escapeHTML(clean)}</p></li>`;
    }
    return `<li class="mt-recipe-ingredient"><span>✦</span><p>${escapeHTML(clean)}</p></li>`;
  }).join("");
  return `<section class="mt-recipe-editorial-section">
    <div class="mt-recipe-section-kicker">${escapeHTML(title)}</div>
    <ul class="${mode === "steps" ? "mt-recipe-steps" : "mt-recipe-ingredients"}">${items}</ul>
  </section>`;
}

function mtRecipeBuildEditorialContent(recipe) {
  const raw = recipe.full_content || recipe.content_text || "";
  const lines = mtRecipeSplitLines(raw);

  let ingredients = [];
  let preparation = [];
  let notes = [];
  let current = "notes";

  lines.forEach(line => {
    const low = line.toLowerCase();
    if (low.includes("ingrédient") || low.includes("ingredient")) {
      current = "ingredients";
      return;
    }
    if (low.includes("préparation") || low.includes("preparation") || low.includes("étape") || low.includes("etape")) {
      current = "preparation";
      return;
    }
    if (low.includes("conseil") || low.includes("rituel") || low.includes("note")) {
      current = "notes";
      return;
    }
    if (current === "ingredients") ingredients.push(line);
    else if (current === "preparation") preparation.push(line);
    else notes.push(line);
  });

  if (!ingredients.length && !preparation.length && lines.length) {
    preparation = lines;
  }

  const intro = recipe.description || recipe.subtitle || "";
  return `
    ${intro ? `<section class="mt-recipe-intro-card"><p>${escapeHTML(intro)}</p></section>` : ""}
    <section class="mt-recipe-meta-grid">
      <div><strong>${escapeHTML(recipe.category || "Recette")}</strong><span>Univers</span></div>
      <div><strong>${escapeHTML(recipe.mood || "Rituel")}</strong><span>Intention</span></div>
      <div><strong>${recipe.is_premium ? "Débloquée" : "Libre"}</strong><span>Accès</span></div>
    </section>
    ${mtRecipeSectionFromLines("Ingrédients", ingredients, "bullet")}
    ${mtRecipeSectionFromLines("Préparation", preparation, "steps")}
    ${mtRecipeSectionFromLines("Note du coach", notes, "bullet")}
  `;
}

function mtRecipePlainSections(recipe) {
  const raw = recipe.full_content || recipe.content_text || recipe.description || "";
  const lines = mtRecipeSplitLines(raw);
  let ingredients = [];
  let preparation = [];
  let notes = [];
  let current = "notes";

  lines.forEach(line => {
    const low = line.toLowerCase();
    if (low.includes("ingrédient") || low.includes("ingredient")) {
      current = "ingredients";
      return;
    }
    if (low.includes("préparation") || low.includes("preparation") || low.includes("étape") || low.includes("etape")) {
      current = "preparation";
      return;
    }
    if (low.includes("conseil") || low.includes("rituel") || low.includes("note")) {
      current = "notes";
      return;
    }
    if (current === "ingredients") ingredients.push(line);
    else if (current === "preparation") preparation.push(line);
    else notes.push(line);
  });

  if (!ingredients.length && !preparation.length && lines.length) {
    preparation = lines;
  }

  return { ingredients, preparation, notes };
}

function mtRecipePdfSection(title, items, ordered = false) {
  if (!items || !items.length) return "";
  const tag = ordered ? "ol" : "ul";
  const body = items.map(i => `<li>${escapeHTML(String(i).replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, ""))}</li>`).join("");
  return `<section class="pdf-section"><h2>${escapeHTML(title)}</h2><${tag}>${body}</${tag}></section>`;
}

function mtRecipeEnsurePdfModal() {
  let modal = document.getElementById("mtRecipePdfModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "mtRecipePdfModal";
  modal.className = "mt-pdf-modal";
  modal.innerHTML = `
    <div class="mt-pdf-backdrop" onclick="closeRecipePDFViewer()"></div>
    <div class="mt-pdf-shell">
      <div class="mt-pdf-topbar">
        <div>
          <small>FICHE ÉDITORIALE</small>
          <strong>Recette Méthode Tee</strong>
        </div>
        <button class="mt-pdf-close" type="button" onclick="closeRecipePDFViewer()">×</button>
      </div>

      <div class="mt-pdf-loader">
        <div class="mt-pdf-loader-orb"></div>
        <p>Préparation du rituel…</p>
      </div>

      <div class="mt-pdf-preview-wrap">
        <iframe id="mtRecipePdfFrame" class="mt-pdf-frame" title="Aperçu PDF recette"></iframe>
      </div>

      <div class="mt-pdf-actions">
        <button type="button" class="mt-pdf-secondary" onclick="closeRecipePDFViewer()">Fermer</button>
        <button type="button" class="mt-pdf-primary" onclick="shareRecipePDF()">Partager / PDF</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function closeRecipePDFViewer() {
  const modal = document.getElementById("mtRecipePdfModal");
  if (modal) {
    modal.classList.remove("is-open", "is-ready");
    setTimeout(() => {
      const frame = document.getElementById("mtRecipePdfFrame");
      if (frame) frame.srcdoc = "";
      modal.style.display = "none";
      document.body.classList.remove("mt-pdf-open");
    }, 220);
  }
}

function shareRecipePDF() {
  const frame = document.getElementById("mtRecipePdfFrame");
  if (!frame || !frame.contentWindow) {
    alert("L’aperçu n’est pas encore prêt.");
    return;
  }

  try {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  } catch (e) {
    alert("Utilise le bouton de partage/impression de ton navigateur pour enregistrer en PDF.");
  }
}

async function downloadRecipePDF(recipeId) {
  const modal = mtRecipeEnsurePdfModal();
  modal.style.display = "block";
  document.body.classList.add("mt-pdf-open");

  requestAnimationFrame(() => {
    modal.classList.add("is-open");
    modal.classList.remove("is-ready");
  });

  try {
    const recipes = await mtFetchRecipes();
    const recipe = recipes.find(r => String(r.id) === String(recipeId));
    if (!recipe) throw new Error("Recette introuvable.");

    const purchasedIds = await mtGetPurchasedRecipeIds();
    const owned = !recipe.is_premium || purchasedIds.includes(String(recipe.id));
    if (!owned) {
      closeRecipePDFViewer();
      return startSecureCheckoutRecipe(recipe.id);
    }

    const { ingredients, preparation, notes } = mtRecipePlainSections(recipe);
    const title = recipe.title || "Recette Méthode Tee";
    const subtitle = recipe.subtitle || recipe.description || "Une recette privée pensée comme un rituel simple, doux et intentionnel.";
    const category = recipe.category || "Recette";
    const mood = recipe.mood || "Rituel";
    const emoji = recipe.emoji || "🥣";

    const image = recipe.image_url
      ? `<figure class="cover-visual"><img src="${escapeHTML(recipe.image_url)}" alt=""></figure>`
      : `<figure class="cover-visual fallback"><span>${escapeHTML(emoji)}</span></figure>`;

    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)} · Méthode Tee</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #F4F0E7;
    color: #1F1B17;
    font-family: "Helvetica Neue", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background:
      radial-gradient(circle at 18% 10%, rgba(184,146,74,.13), transparent 28%),
      radial-gradient(circle at 86% 6%, rgba(23,63,53,.10), transparent 24%),
      linear-gradient(180deg, #FFFDF7 0%, #F8F3EA 100%);
    padding: 16mm;
    position: relative;
    overflow: hidden;
  }
  .sheet:before {
    content: "";
    position: absolute;
    inset: 8mm;
    border: 1px solid rgba(184,146,74,.26);
    border-radius: 30px;
    pointer-events: none;
  }
  .brand-row {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10mm;
  }
  .brand-mark {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 27px;
    color: #173F35;
    font-style: italic;
    line-height: 1;
  }
  .brand-sub {
    margin-top: 5px;
    font-size: 8px;
    letter-spacing: .34em;
    text-transform: uppercase;
    color: #8C7561;
    font-weight: 700;
  }
  .private-pill {
    border: 1px solid rgba(23,63,53,.18);
    border-radius: 999px;
    padding: 10px 15px;
    color: #173F35;
    background: rgba(255,255,255,.52);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .22em;
    text-transform: uppercase;
  }
  .cover {
    position: relative;
    z-index: 1;
    display: block;
    margin-bottom: 10mm;
  }
  .eyebrow {
    font-size: 10px;
    letter-spacing: .42em;
    text-transform: uppercase;
    color: #B8924A;
    font-weight: 800;
    margin-bottom: 9mm;
  }
  h1 {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 54px;
    line-height: .9;
    letter-spacing: -.045em;
    font-weight: 400;
    color: #201C18;
  }
  .title-soft {
    display: block;
    color: #173F35;
    font-style: italic;
  }
  .subtitle {
    margin: 8mm 0;
    color: #8C7561;
    font-size: 15px;
    line-height: 1.75;
  }
  .cover-visual {
    margin: 0;
    height: 92mm;
    border-radius: 30px;
    overflow: hidden;
    border: 1px solid rgba(184,146,74,.18);
    box-shadow: 0 22px 60px rgba(23,63,53,.12);
    background: #EDE6DA;
  }
  .cover-visual img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .cover-visual.fallback {
    display: grid;
    place-items: center;
  }
  .cover-visual.fallback span {
    font-size: 62px;
  }
  .ritual-grid {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4mm;
    margin-bottom: 8mm;
  }
  .ritual-cell {
    border: 1px solid rgba(184,146,74,.22);
    background: rgba(255,255,255,.62);
    border-radius: 22px;
    padding: 5mm 3mm;
    text-align: center;
  }
  .ritual-cell strong {
    display: block;
    color: #173F35;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    font-weight: 400;
    line-height: 1;
  }
  .ritual-cell span {
    display: block;
    margin-top: 5px;
    color: #8C7561;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .22em;
    text-transform: uppercase;
  }
  .intention {
    position: relative;
    z-index: 1;
    border: 1px solid rgba(184,146,74,.18);
    border-radius: 28px;
    background: rgba(255,255,255,.72);
    padding: 7mm 8mm;
    margin-bottom: 8mm;
  }
  .quote {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    line-height: 1.42;
    color: #201C18;
    font-style: italic;
  }
  .quote:before {
    content: "“";
    color: rgba(184,146,74,.36);
    font-size: 42px;
    line-height: 0;
    vertical-align: -14px;
    margin-right: 4px;
  }
  .content-grid {
    position: relative;
    z-index: 1;
    display: block;
  }
  .panel {
    background: rgba(255,255,255,.78);
    border: 1px solid rgba(23,63,53,.09);
    border-radius: 26px;
    padding: 7mm;
    box-shadow: 0 15px 36px rgba(23,63,53,.055);
    break-inside: avoid;
    margin-top: 6mm;
  }
  h2 {
    margin: 0 0 6mm;
    color: #B8924A;
    font-size: 10px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: .34em;
    text-transform: uppercase;
  }
  ul, ol { margin: 0; padding: 0; list-style: none; }
  li {
    position: relative;
    color: #2C2C2C;
    font-size: 14px;
    line-height: 1.55;
    margin: 0 0 5mm;
    padding-left: 13mm;
  }
  ul li:before {
    content: "✦";
    position: absolute;
    left: 0;
    top: -1px;
    width: 8mm;
    height: 8mm;
    border-radius: 999px;
    background: #EDF0EA;
    color: #173F35;
    display: grid;
    place-items: center;
    font-size: 11px;
  }
  ol { counter-reset: step; }
  ol li { padding-left: 15mm; }
  ol li:before {
    counter-increment: step;
    content: counter(step);
    position: absolute;
    left: 0;
    top: -1px;
    width: 9mm;
    height: 9mm;
    border-radius: 999px;
    background: #173F35;
    color: #FFFDF7;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 900;
  }
  .note-text {
    color: #8C7561;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    line-height: 1.55;
    font-style: italic;
  }
  .signature {
    margin-top: 8mm;
    padding-top: 6mm;
    border-top: 1px solid rgba(184,146,74,.22);
    display: flex;
    justify-content: space-between;
    gap: 5mm;
    align-items: end;
    color: #8C7561;
  }
  .signature strong {
    display: block;
    font-family: Georgia, "Times New Roman", serif;
    color: #173F35;
    font-size: 24px;
    font-style: italic;
    font-weight: 400;
  }
  .signature span {
    display: block;
    margin-top: 4px;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .28em;
    text-transform: uppercase;
  }
  @media screen {
    body { padding: 14px; overflow-x: hidden; }
    .sheet {
      width: 100%;
      max-width: 820px;
      min-height: auto;
      border-radius: 34px;
      padding: 26px;
      box-shadow: 0 24px 70px rgba(23,63,53,.12);
    }
    .sheet:before { inset: 10px; border-radius: 26px; }
    .ritual-grid { grid-template-columns: 1fr; gap: 12px; }
  }
  @media screen and (max-width: 760px) {
    .sheet { padding: 22px 18px 54px; border-radius: 28px; }
    .brand-row { align-items: flex-start; gap: 12px; }
    .brand-mark { font-size: 24px; }
    .private-pill { font-size: 8px; padding: 9px 11px; white-space: nowrap; }
    .eyebrow { margin-bottom: 18px; font-size: 9px; letter-spacing: .32em; }
    h1 { font-size: clamp(48px, 16vw, 78px); line-height: .88; overflow-wrap: anywhere; }
    .subtitle { font-size: 16px; line-height: 1.65; margin-top: 20px; }
    .cover-visual { height: 240px; border-radius: 28px; }
    .ritual-cell { padding: 18px; }
    .ritual-cell strong { font-size: 24px; }
    .intention { padding: 24px; border-radius: 28px; }
    .quote { font-size: 28px; line-height: 1.35; }
    .panel { padding: 24px; border-radius: 28px; margin-top: 18px; }
    h2 { font-size: 10px; letter-spacing: .30em; line-height: 1.55; }
    li { font-size: 17px; line-height: 1.55; padding-left: 48px; margin-bottom: 20px; }
    ul li:before { width: 34px; height: 34px; }
    ol li { padding-left: 52px; }
    ol li:before { width: 38px; height: 38px; }
    .note-text { font-size: 23px; line-height: 1.45; }
    .signature { display: block; font-size: 12px; }
    .signature strong { font-size: 26px; }
  }
  @media print {
    body { background: white; }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      box-shadow: none;
      border-radius: 0;
      padding: 16mm;
    }
    .ritual-grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
</head>
<body>
  <main class="sheet">
    <header class="brand-row">
      <div>
        <div class="brand-mark">Teeyana</div>
        <div class="brand-sub">Nutrition · Plantes · Bien-être</div>
      </div>
      <div class="private-pill">Recette privée</div>
    </header>

    <section class="cover">
      <div class="eyebrow">${escapeHTML(category)}</div>
      <h1>${escapeHTML(title)}<span class="title-soft">${escapeHTML(mood)}</span></h1>
      <p class="subtitle">${escapeHTML(subtitle)}</p>
      ${image}
    </section>

    <section class="ritual-grid">
      <div class="ritual-cell"><strong>${escapeHTML(category)}</strong><span>Univers</span></div>
      <div class="ritual-cell"><strong>${escapeHTML(mood)}</strong><span>Intention</span></div>
      <div class="ritual-cell"><strong>Débloquée</strong><span>Accès</span></div>
    </section>

    <section class="intention">
      <div class="quote">Une recette comme un rituel : simple, douce, précise, et pensée pour accompagner ton équilibre au quotidien.</div>
    </section>

    <section class="content-grid">
      ${mtRecipePdfSection("Ingrédients", ingredients, false)}
      ${mtRecipePdfSection("Préparation", preparation, true)}
      <section class="panel">
        <h2>Note Maison</h2>
        <div class="note-text">${escapeHTML((notes && notes.length ? notes.join(" ") : "À savourer lentement, comme une pause. L’intention compte autant que la recette."))}</div>
      </section>
      <section class="panel">
        <h2>Rituel de dégustation</h2>
        <ul>
          <li>Installe-toi dans un moment calme.</li>
          <li>Respire avant de commencer.</li>
          <li>Savoure sans te presser.</li>
        </ul>
        <div class="signature">
          <div>
            <strong>Méthode Tee</strong>
            <span>Recette privée</span>
          </div>
          <div>PDF généré depuis ton espace</div>
        </div>
      </section>
    </section>
  </main>
</body>
</html>`;

    const frame = document.getElementById("mtRecipePdfFrame");
    if (!frame) throw new Error("Aperçu indisponible.");

    frame.srcdoc = html;

    frame.onload = () => {
      setTimeout(() => {
        modal.classList.add("is-ready");
      }, 450);
    };
  } catch (err) {
    closeRecipePDFViewer();
    alert(err.message || "Impossible de préparer le PDF.");
  }
}


async function openRecipeViewer(recipeId) {
  const recipes = await mtFetchRecipes();
  const recipe = recipes.find(r => String(r.id) === String(recipeId));
  if (!recipe) return alert("Recette introuvable.");

  const purchasedIds = await mtGetPurchasedRecipeIds();
  const owned = !recipe.is_premium || purchasedIds.includes(String(recipe.id));
  if (!owned) return startSecureCheckoutRecipe(recipe.id);

  const modal = document.getElementById("mediaModal") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "mediaModal", className: "media-modal" }));
  const hero = recipe.image_url
    ? `<div class="mt-recipe-hero-image"><img src="${escapeHTML(recipe.image_url)}" alt="${escapeHTML(recipe.title || "Recette")}"></div>`
    : `<div class="mt-recipe-hero-image mt-recipe-hero-fallback"><span>${escapeHTML(recipe.emoji || "🥣")}</span></div>`;

  modal.innerHTML = `
    <div class="modal-backdrop mt-recipe-backdrop" onclick="closeMedia()"></div>
    <article class="modal-card mt-recipe-sheet">
      <button class="modal-close mt-recipe-close" onclick="closeMedia()">×</button>
      ${hero}
      <div class="mt-recipe-sheet-body">
        <div class="mt-recipe-topline">
          <span>${escapeHTML(recipe.category || "Recette privée")}</span>
          <b>✓ Disponible</b>
        </div>
        <h1>${escapeHTML(recipe.title || "Recette")}</h1>
        ${recipe.subtitle ? `<p class="mt-recipe-subtitle">${escapeHTML(recipe.subtitle)}</p>` : ""}
        ${mtRecipeBuildEditorialContent(recipe)}
        <div class="mt-recipe-download-zone">
          <button class="mt-recipe-download-btn" onclick="downloadRecipePDF('${escapeHTML(recipe.id)}')">
            <span>↓</span>
            Télécharger la recette en PDF
          </button>
          <small>Une fiche propre s’ouvre pour l’enregistrer ou l’imprimer en PDF.</small>
        </div>
      </div>
    </article>`;
  modal.classList.add("open", "recipe-open");
}
window.renderRecipesMarketplace = renderRecipesMarketplace;
window.startSecureCheckoutRecipe = startSecureCheckoutRecipe;
window.openRecipeViewer = openRecipeViewer;
window.downloadRecipePDF = downloadRecipePDF;
