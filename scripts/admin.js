let MT_ADMIN_PROTOCOLS = [];
let MT_ADMIN_PROTOCOL_SEARCH = '';
let MT_ADMIN_RECIPE_SEARCH = '';
let MT_ADMIN_POST_SEARCH = '';
let MT_ADMIN_PAGES = [];
let MT_ADMIN_RECIPES = [];
let MT_ADMIN_CONTENTS = [];
let MT_ADMIN_CONTENT_SEARCH = '';

function slugify(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function escapeHTML(value) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function mtNormalizePostType(postType) {
  return String(postType || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mtPostNotificationRoute(postType) {
  const key = mtNormalizePostType(postType);
  const routes = {
    "journal": "journal",
    "hydratation": "hydratation",
    "fuel du jour": "fuel",
    "fuel": "fuel",
    "routine": "routine",
    "conseil": "conseil",
    "conseil prive": "conseil",
    "drop exclusif": "drop",
    "mindset": "mindset",
    "mouvement": "mouvement",
    "sweet switch": "sweet-switch",
    "recette": "recettes",
    "contenu prive": "contenu-prive",
    "challenge": "challenge"
  };
  return routes[key] || "journal";
}

function mtPostDomIdFromValue(value) {
  const raw = String(value || "post");
  const clean = raw.normalize ? raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : raw;
  return "post-" + clean.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function mtPostNotificationUrl(postType, postId) {
  const route = mtPostNotificationRoute(postType);
  // Deep-link robuste : query + hash.
  // Le hash seul peut parfois être perdu au retour depuis une notification.
  if (postId) {
    const domId = mtPostDomIdFromValue(postId);
    return `/index.html?mt_post=${encodeURIComponent(domId)}&mt_route=${encodeURIComponent(route)}#${domId}`;
  }
  return `/index.html?mt_route=${encodeURIComponent(route)}#${route}`;
}

function mtPostNotificationBody(postType, postTitle) {
  const title = String(postTitle || "Nouveau contenu").trim();
  const key = mtNormalizePostType(postType);
  const premium = {
    "journal": `Ton journal privé vient d’être enrichi ✨`,
    "hydratation": `Un rappel douceur t’attend 💧`,
    "fuel du jour": `Ton fuel du jour est prêt 🌿`,
    "fuel": `Ton fuel du jour est prêt 🌿`,
    "routine": `Un nouveau rituel t’attend 🌙`,
    "conseil": `Un conseil privé vient d’être ajouté ✨`,
    "conseil prive": `Un conseil privé vient d’être ajouté ✨`,
    "drop exclusif": `Un drop exclusif vient d’arriver ✦`,
    "mindset": `Une note mindset t’attend 🕊️`,
    "mouvement": `Un geste mouvement t’attend 🚶🏽‍♀️`,
    "sweet switch": `Ton sweet switch du jour est prêt 🍫`,
    "recette": `Une nouvelle recette est disponible 🥣`,
    "contenu prive": `Un contenu privé vient d’être ajouté ✦`,
    "challenge": `Un nouveau challenge t’attend ✨`
  };
  return `${premium[key] || "Un nouveau contenu t’attend ✨"}
${title}`;
}


// ── Push helper : envoie une notif à tous les abonnés via Edge Function ──
async function mtSendPushToAll({ title, body, url }) {
  const supabaseUrl = window.MT_CONFIG?.SUPABASE_URL || "";
  const anonKey = window.MT_CONFIG?.SUPABASE_ANON_KEY || "";
  if (!supabaseUrl) throw new Error("SUPABASE_URL manquant dans config.js");
  if (!anonKey) throw new Error("SUPABASE_ANON_KEY manquant dans config.js");

  const endpoint = supabaseUrl.replace(/\/$/, "") + "/functions/v1/send-push-notifications";

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
      "Authorization": "Bearer " + anonKey
    },
    body: JSON.stringify({ title, body, url })
  });

  const text = await resp.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }

  console.log("[MT Push] HTTP", resp.status, data);

  if (!resp.ok || data.ok === false) {
    throw new Error(data.error || data.message || ("Erreur Edge Function HTTP " + resp.status));
  }

  return data;
}

async function unlockAdmin() {
  const msg = document.getElementById("adminMsg");
  if (msg) msg.textContent = "Vérification de ton accès admin...";

  const user = await mtGetUser();
  if (!user) {
    if (msg) msg.textContent = "Connecte-toi d’abord avec ton email admin.";
    setTimeout(() => location.href = "auth.html", 900);
    return;
  }

  const ok = await mtIsAdmin();
  if (!ok) {
    if (msg) msg.textContent = "Accès refusé : cet email n’est pas autorisé comme admin.";
    return;
  }

  document.getElementById("adminGate").classList.add("hidden");
  document.getElementById("adminPanel").classList.remove("hidden");
  await refreshAdmin();
}

async function refreshAdmin() {
  await loadProtocols();
  await loadPages();
  await loadPosts();
  await loadContents();
  await loadRecipes();
  fillSelects();
  if (typeof loadClubSettingsAdmin === "function") await loadClubSettingsAdmin();
  if (typeof loadCapsulesAdmin === "function") await loadCapsulesAdmin();
  if (typeof loadDropsAdmin === "function") await loadDropsAdmin();
  if (typeof loadDailyRitualsAdmin === "function") await loadDailyRitualsAdmin();
}

async function uploadToBucket(bucket, file, folder = "admin") {
  if (!file || !file.name) return null;
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${folder}/${Date.now()}-${safe}`;
  const client = initSupabase();
  const { error } = await client.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;

  // Buckets privés : on sauvegarde le chemin interne.
  // L'ouverture côté client passera ensuite par l'Edge Function create-signed-url.
  if (bucket === (window.MT_CONFIG.PROTOCOL_FILES_BUCKET || "protocol-files")) {
    return path;
  }

  // Buckets publics : on garde l'URL publique.
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}


/* ADMIN GROUPED LIBRARY HELPERS */
function mtAdminNorm(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mtAdminCategoryLabel(value) {
  const raw = String(value || "non_classe");
  const map = {
    pharmacie_vegetale: "Pharmacopée végétale",
    objectifs_corps: "Objectifs corps",
    recipes: "Recettes",
    recette: "Recettes",
    journal: "Journal",
    mindset: "Mindset",
    nutrition: "Nutrition",
    plantes: "Plantes",
    phytotherapie: "Phytothérapie",
    annonce: "Annonces",
    actualite: "Actualités",
    conseil: "Conseils",
    non_classe: "Non classé"
  };
  return map[raw] || raw.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

function mtAdminCategoryEmoji(value) {
  const raw = String(value || "");
  const map = {
    pharmacie_vegetale: "🌿",
    objectifs_corps: "🔥",
    recipes: "🥣",
    recette: "🥣",
    journal: "📝",
    mindset: "✨",
    nutrition: "🥑",
    plantes: "🌱",
    phytotherapie: "🌿",
    annonce: "📣",
    actualite: "🗞️",
    conseil: "💡",
    non_classe: "📁"
  };
  return map[raw] || "📁";
}

function mtAdminEnsureGroupedControls(list, id, title, subtitle, placeholder, onSearch, onClose) {
  if (document.getElementById(id)) return;
  const wrap = document.createElement("div");
  wrap.id = id;
  wrap.className = "admin-grouped-controls admin-compact-grouped-controls";
  wrap.innerHTML = `
    <div class="admin-library-head">
      <div>
        <div class="kicker">${escapeHTML(title)}</div>
        <h2>Bibliothèque organisée</h2>
        <p>${escapeHTML(subtitle)}</p>
      </div>
      <button type="button" class="ghost-btn" onclick="${onClose}">Tout fermer</button>
    </div>
    <div class="admin-search-row">
      <input type="search" placeholder="${escapeHTML(placeholder)}" autocomplete="off">
    </div>
    <div class="admin-filter-summary"></div>
  `;
  list.parentNode.insertBefore(wrap, list);
  const input = wrap.querySelector("input");
  input.addEventListener("input", e => onSearch(e.target.value || ""));
}

function mtAdminGroupBy(items, getKey, getTitle) {
  const map = new Map();
  items.forEach(item => {
    const key = getKey(item);
    if (!map.has(key)) map.set(key, { key, title: getTitle(item), items: [] });
    map.get(key).items.push(item);
  });
  return [...map.values()].sort((a,b) => String(a.title).localeCompare(String(b.title), "fr"));
}


/* POSTS */
function renderPostsList(posts) {
  const list = document.getElementById("postsList");
  if (!list) return;
  const q = mtAdminNorm(MT_ADMIN_POST_SEARCH);
  const filtered = (posts || []).filter(p => !q || mtAdminNorm([p.title, p.type, p.category, p.content, p.excerpt].join(" ")).includes(q));
  const groups = mtAdminGroupBy(filtered, p => String(p.type || p.category || "journal"), p => mtAdminCategoryLabel(p.type || p.category || "journal"));
  const controls = document.getElementById("adminPostsGroupedControls");
  const summary = controls?.querySelector(".admin-filter-summary");
  if (summary) summary.innerHTML = `<strong>${filtered.length}</strong> post${filtered.length>1?"s":""} affiché${filtered.length>1?"s":""} sur ${(posts || []).length} · <strong>${groups.length}</strong> dossier${groups.length>1?"s":""}`;

  list.innerHTML = groups.map(g => `
    <details class="admin-protocol-group admin-simple-group">
      <summary>
        <div>
          <strong>${mtAdminCategoryEmoji(g.key)} ${escapeHTML(g.title)}</strong>
          <small>${g.items.length} post${g.items.length>1?"s":""}</small>
        </div>
        <span>Ouvrir</span>
      </summary>
      <div class="admin-day-contents">
        ${g.items.map(p => `<article class="admin-content-item">
          <div class="admin-content-icon">${escapeHTML(p.emoji || mtAdminCategoryEmoji(p.type || p.category || "journal"))}</div>
          <div class="admin-content-main">
            <strong>${escapeHTML(p.title || "Sans titre")}</strong>
            <small>${escapeHTML(p.type || "Journal")} · ${p.active ? "visible" : "masqué"}</small>
          </div>
          <div class="admin-content-actions">
            <button type="button" onclick="editPost('${p.id}')">Modifier</button>
            <button type="button" onclick="togglePost('${p.id}', ${p.active ? "false" : "true"})">${p.active ? "Masquer" : "Afficher"}</button>
            <button type="button" class="danger" onclick="deletePost('${p.id}')">Supprimer</button>
          </div>
        </article>`).join("")}
      </div>
    </details>
  `).join("") || `<p class="admin-empty">Aucun post trouvé.</p>`;
}

window.mtAdminCollapsePosts = function() {
  document.querySelectorAll("#postsList details").forEach(d => d.open = false);
};

async function loadPosts() {
  const list = document.getElementById("postsList");
  if (!list) return;
  mtAdminEnsureGroupedControls(
    list,
    "adminPostsGroupedControls",
    "Posts publiés",
    "Retrouve tes posts par type, avec recherche instantanée.",
    "Rechercher un post...",
    value => { MT_ADMIN_POST_SEARCH = value; renderPostsList(window.MT_ADMIN_POSTS || []); },
    "mtAdminCollapsePosts()"
  );

  const { data, error } = await initSupabase()
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    list.innerHTML = `<p class="admin-error">${escapeHTML(error.message)}</p>`;
    return;
  }
  window.MT_ADMIN_POSTS = data || [];
  renderPostsList(window.MT_ADMIN_POSTS);
}

async function editPost(id) {
  const { data, error } = await initSupabase().from("posts").select("*").eq("id", id).maybeSingle();
  if (error || !data) return alert("Post introuvable.");
  document.getElementById("postId").value = data.id;
  document.getElementById("postTitle").value = data.title || "";
  document.getElementById("postType").value = data.type || "Journal";
  const rawPostContent = String(data.content || "");
  const excerptMatch = rawPostContent.match(/^\s*\[\[EXTRAIT:(.*?)\]\]\s*/s);
  document.getElementById("postExcerpt").value = excerptMatch ? String(excerptMatch[1] || "").trim() : (data.excerpt || data.feed_excerpt || "");
  document.getElementById("postContent").value = excerptMatch ? rawPostContent.slice(excerptMatch[0].length).trim() : rawPostContent;
  let urls = [];
  if (Array.isArray(data.media_urls)) urls = data.media_urls;
  else if (data.media_urls) {
    try { urls = JSON.parse(data.media_urls); } catch(e) { urls = [data.media_urls]; }
  }
  if (data.image_url && !urls.includes(data.image_url)) urls.unshift(data.image_url);
  document.getElementById("postMediaUrls").value = urls.filter(Boolean).join("\n");
  window.scrollTo({ top: document.getElementById("postForm").offsetTop - 90, behavior: "smooth" });
}

async function togglePost(id, active) {
  const { error } = await initSupabase().from("posts").update({ active }).eq("id", id);
  if (error) return alert(error.message);
  loadPosts();
}

async function deletePost(id) {
  if (!confirm("Supprimer ce post ?")) return;
  const { error } = await initSupabase().from("posts").delete().eq("id", id);
  if (error) return alert(error.message);
  loadPosts();
}

function resetPostForm() {
  ["postId","postTitle","postExcerpt","postContent","postMediaUrls","postMediaFiles"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const type = document.getElementById("postType");
  if (type) type.value = "Journal";
}

/* PAGES */
async function loadPages() {
  const list = document.getElementById("pagesList");
  const { data, error } = await initSupabase().from("app_pages").select("*").order("sort_order", { ascending:true });
  MT_ADMIN_PAGES = !error && data?.length ? data : [];
  if (!list) return;
  list.innerHTML = MT_ADMIN_PAGES.map(p => `<article class="admin-row-card">
    <div><strong>${escapeHTML(p.emoji || "✦")} ${escapeHTML(p.label || p.title || "Page")}</strong><small>${escapeHTML(p.slug || "")} · ${escapeHTML(p.system_key || "custom")}</small></div>
    <button type="button" onclick="editPage('${p.id}')">Modifier</button>
    ${p.system_key === "custom" || p.system_key === "library" ? `<button type="button" class="danger" onclick="deletePage('${p.id}')">Supprimer</button>` : `<button type="button" disabled>Fixe</button>`}
  </article>`).join("") || `<p class="admin-empty">Aucune page.</p>`;
}

function editPage(id) {
  const p = MT_ADMIN_PAGES.find(x => x.id === id);
  if (!p) return;
  document.getElementById("pageId").value = p.id;
  document.getElementById("pageLabel").value = p.label || p.title || "";
  document.getElementById("pageEmoji").value = p.emoji || "";
  document.getElementById("pageSlug").value = p.slug || "";
  document.getElementById("pageDescription").value = p.description || "";
  document.getElementById("pageOrder").value = p.sort_order || 10;
  document.getElementById("pageSystemKey").value = p.system_key || "custom";
}

async function deletePage(id) {
  if (!confirm("Supprimer cette page ?")) return;
  const { error } = await initSupabase().from("app_pages").delete().eq("id", id);
  if (error) return alert(error.message);
  refreshAdmin();
}

function resetPageForm() {
  ["pageId","pageLabel","pageEmoji","pageSlug","pageDescription"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("pageOrder").value = 10;
  document.getElementById("pageSystemKey").value = "custom";
}

/* PROTOCOLS */
function renderProtocolsList() {
  const list = document.getElementById("protocolsList");
  if (!list) return;
  const q = mtAdminNorm(MT_ADMIN_PROTOCOL_SEARCH);
  const filtered = (MT_ADMIN_PROTOCOLS || []).filter(p => !q || mtAdminNorm([p.title, p.category, p.subtitle, p.short_description, p.long_description].join(" ")).includes(q));
  const groups = mtAdminGroupBy(filtered, p => String(p.category || "pharmacie_vegetale"), p => mtAdminCategoryLabel(p.category || "pharmacie_vegetale"));
  const controls = document.getElementById("adminProtocolsGroupedControls");
  const summary = controls?.querySelector(".admin-filter-summary");
  if (summary) summary.innerHTML = `<strong>${filtered.length}</strong> protocole${filtered.length>1?"s":""} affiché${filtered.length>1?"s":""} sur ${(MT_ADMIN_PROTOCOLS || []).length} · <strong>${groups.length}</strong> catégorie${groups.length>1?"s":""}`;

  list.innerHTML = groups.map(g => `
    <details class="admin-protocol-group admin-simple-group">
      <summary>
        <div>
          <strong>${mtAdminCategoryEmoji(g.key)} ${escapeHTML(g.title)}</strong>
          <small>${g.items.length} protocole${g.items.length>1?"s":""}</small>
        </div>
        <span>Ouvrir</span>
      </summary>
      <div class="admin-day-contents">
        ${g.items.map(p => `<article class="admin-content-item">
          <div class="admin-content-icon">${escapeHTML(p.emoji || mtAdminCategoryEmoji(p.category))}</div>
          <div class="admin-content-main">
            <strong>${escapeHTML(p.title || "Sans titre")}</strong>
            <small>${escapeHTML(mtAdminCategoryLabel(p.category))} · ${((p.price_cents || 0)/100).toFixed(2)}€ · ${p.active ? "visible" : "masqué"}</small>
          </div>
          <div class="admin-content-actions">
            <button type="button" onclick="editProtocol('${p.id}')">Modifier</button>
            <button type="button" onclick="toggleProtocol('${p.id}', ${p.active ? "false" : "true"})">${p.active ? "Masquer" : "Afficher"}</button>
            <button type="button" class="danger" onclick="deleteProtocol('${p.id}')">Supprimer</button>
          </div>
        </article>`).join("")}
      </div>
    </details>
  `).join("") || `<p class="admin-empty">Aucun protocole trouvé.</p>`;
}

window.mtAdminCollapseProtocols = function() {
  document.querySelectorAll("#protocolsList details").forEach(d => d.open = false);
};

async function loadProtocols() {
  const list = document.getElementById("protocolsList");
  if (list) {
    mtAdminEnsureGroupedControls(
      list,
      "adminProtocolsGroupedControls",
      "Protocoles",
      "Classés par catégorie : Pharmacopée végétale et Objectifs corps.",
      "Rechercher un protocole...",
      value => { MT_ADMIN_PROTOCOL_SEARCH = value; renderProtocolsList(); },
      "mtAdminCollapseProtocols()"
    );
  }

  const { data, error } = await initSupabase().from("protocols").select("*").order("created_at", { ascending:false });
  MT_ADMIN_PROTOCOLS = !error && data?.length ? data : [];
  if (!list) return;
  if (error) {
    list.innerHTML = `<p class="admin-error">${escapeHTML(error.message)}</p>`;
    return;
  }
  renderProtocolsList();
}

function editProtocol(id) {
  const p = MT_ADMIN_PROTOCOLS.find(x => x.id === id);
  if (!p) return;
  document.getElementById("protocolId").value = p.id;
  document.getElementById("protocolTitle").value = p.title || "";
  document.getElementById("protocolSubtitle").value = p.subtitle || "";
  document.getElementById("protocolCategory").value = p.category || "pharmacie_vegetale";
  if (document.getElementById("protocolFilterKey")) document.getElementById("protocolFilterKey").value = p.filter_key || "";
  document.getElementById("protocolEmoji").value = p.emoji || "";
  document.getElementById("protocolShort").value = p.short_description || "";
  document.getElementById("protocolLong").value = p.long_description || "";
  document.getElementById("protocolPrice").value = p.price_cents || 500;
  document.getElementById("protocolDuration").value = p.duration_label || "";
  if (document.getElementById("protocolTotalDays")) document.getElementById("protocolTotalDays").value = p.total_days || 21;
  if (document.getElementById("protocolLevelLabel")) document.getElementById("protocolLevelLabel").value = p.level_label || "";
  if (document.getElementById("protocolCertificate")) document.getElementById("protocolCertificate").checked = p.certificate_enabled !== false;
  document.getElementById("protocolPayment").value = p.payment_link || "";
  if(document.getElementById("protocolAppleProduct")) document.getElementById("protocolAppleProduct").value = p.apple_product_id || "";
  document.getElementById("protocolImageUrl").value = p.image_url || "";
  window.scrollTo({ top: document.getElementById("protocolForm").offsetTop - 90, behavior: "smooth" });
}

async function toggleProtocol(id, active) {
  const { error } = await initSupabase().from("protocols").update({ active }).eq("id", id);
  if (error) return alert(error.message);
  loadProtocols();
}

async function deleteProtocol(id) {
  const p = MT_ADMIN_PROTOCOLS.find(x => x.id === id);
  const name = p?.title || "ce protocole";
  if (!confirm(`Supprimer définitivement "${name}" ?\n\nLes contenus liés, accès clients et progressions associés seront aussi supprimés.`)) return;

  const client = initSupabase();

  // Suppression des tables liées avant le protocole, pour éviter les blocages de clé étrangère.
  const linkedTables = [
    ["protocol_contents", "protocol_id"],
    ["protocol_progress", "protocol_id"],
    ["user_protocols", "protocol_id"]
  ];

  for (const [table, column] of linkedTables) {
    const { error } = await client.from(table).delete().eq(column, id);
    // On ne bloque pas si une table n’existe pas ou si aucun élément n’est lié.
    if (error && !String(error.message || "").toLowerCase().includes("does not exist")) {
      console.warn(`Suppression liée ${table}:`, error.message);
    }
  }

  const { error } = await client.from("protocols").delete().eq("id", id);
  if (error) return alert(error.message);

  alert("Protocole supprimé.");
  resetProtocolForm();
  await refreshAdmin();
}

function resetProtocolForm() {
  ["protocolId","protocolTitle","protocolSubtitle","protocolEmoji","protocolShort","protocolLong","protocolDuration","protocolPayment","protocolImageUrl","protocolImageFile","protocolLevelLabel","protocolFilterKey"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("protocolPrice").value = 500;
  document.getElementById("protocolCategory").value = "pharmacie_vegetale";
  if (document.getElementById("protocolTotalDays")) document.getElementById("protocolTotalDays").value = 21;
  if (document.getElementById("protocolCertificate")) document.getElementById("protocolCertificate").checked = true;
}


/* RECIPES MARKETPLACE */
function mtAdminRecipeGroupKey(r) {
  const cat = String(r.category || r.meal_type || "recette").toLowerCase();
  const meal = String(r.meal_type || "").toLowerCase();
  const combined = `${cat} ${meal} ${r.title || ""}`.toLowerCase();

  if (/drink|boisson|latte|matcha|smoothie|tisane|thé|tea|juice|jus/.test(combined)) return "drinks";
  if (/sweet|dessert|gourmand|cookie|brownie|cake|pancake|sucré|sucree|choco|cacao/.test(combined)) return "sweet";
  if (/snack|pause|collation/.test(combined)) return "snack";
  if (/morning|breakfast|petit.?dej|réveil|reveil|granola|muesli/.test(combined)) return "morning";
  if (/dinner|dîner|diner|soir|réconfort|reconfort/.test(combined)) return "dinner";
  return "daily";
}

function mtAdminRecipeGroupLabel(key) {
  const map = { morning:"Morning · Réveil", daily:"Meals · Cuisine", snack:"Snack · Pause", dinner:"Dinner · Réconfort", sweet:"Sweet · Gourmand", drinks:"Drinks · Smooth" };
  return map[key] || mtAdminCategoryLabel(key);
}

function renderRecipesList() {
  const list = document.getElementById("recipesList");
  if (!list) return;
  const q = mtAdminNorm(MT_ADMIN_RECIPE_SEARCH);
  const filtered = (MT_ADMIN_RECIPES || []).filter(r => !q || mtAdminNorm([r.title, r.category, r.meal_type, r.tags, r.benefits, r.description, r.subtitle].join(" ")).includes(q));
  const groups = mtAdminGroupBy(filtered, mtAdminRecipeGroupKey, r => mtAdminRecipeGroupLabel(mtAdminRecipeGroupKey(r)));
  const order = ["morning","daily","snack","dinner","sweet","drinks"];
  groups.sort((a,b) => order.indexOf(a.key) - order.indexOf(b.key));
  const controls = document.getElementById("adminRecipesGroupedControls");
  const summary = controls?.querySelector(".admin-filter-summary");
  if (summary) summary.innerHTML = `<strong>${filtered.length}</strong> recette${filtered.length>1?"s":""} affichée${filtered.length>1?"s":""} sur ${(MT_ADMIN_RECIPES || []).length} · <strong>${groups.length}</strong> dossier${groups.length>1?"s":""}`;

  list.innerHTML = groups.map(g => `
    <details class="admin-protocol-group admin-simple-group">
      <summary>
        <div>
          <strong>${mtAdminCategoryEmoji(g.key)} ${escapeHTML(g.title)}</strong>
          <small>${g.items.length} recette${g.items.length>1?"s":""}</small>
        </div>
        <span>Ouvrir</span>
      </summary>
      <div class="admin-day-contents">
        ${g.items.map(r => `<article class="admin-content-item">
          <div class="admin-content-icon">${escapeHTML(r.emoji || mtAdminCategoryEmoji(g.key))}</div>
          <div class="admin-content-main">
            <strong>${escapeHTML(r.title || "Sans titre")}</strong>
            <small>${escapeHTML(r.category || r.meal_type || "Recette")} · ${r.is_premium ? (((r.price_cents || 0)/100).toFixed(2) + "€") : "gratuite"} · ${r.active ? "visible" : "masquée"}</small>
          </div>
          <div class="admin-content-actions">
            <button type="button" onclick="editRecipe('${r.id}')">Modifier</button>
            <button type="button" onclick="toggleRecipe('${r.id}', ${r.active ? "false" : "true"})">${r.active ? "Masquer" : "Afficher"}</button>
            <button type="button" class="danger" onclick="deleteRecipe('${r.id}')">Supprimer</button>
          </div>
        </article>`).join("")}
      </div>
    </details>
  `).join("") || `<p class="admin-empty">Aucune recette trouvée.</p>`;
}

window.mtAdminCollapseRecipes = function() {
  document.querySelectorAll("#recipesList details").forEach(d => d.open = false);
};

async function loadRecipes() {
  const list = document.getElementById("recipesList");
  if (!list) return;
  mtAdminEnsureGroupedControls(
    list,
    "adminRecipesGroupedControls",
    "Recettes",
    "Classées selon les types visibles dans l’app : Morning, Meals, Snack, Dinner, Sweet, Drinks.",
    "Rechercher une recette...",
    value => { MT_ADMIN_RECIPE_SEARCH = value; renderRecipesList(); },
    "mtAdminCollapseRecipes()"
  );

  const { data, error } = await initSupabase()
    .from("recipes")
    .select("*")
    .order("sort_order", { ascending:true })
    .order("created_at", { ascending:false })
    .limit(1000);

  MT_ADMIN_RECIPES = !error && data?.length ? data : [];
  if (error) {
    list.innerHTML = `<p class="admin-error">${escapeHTML(error.message)}</p>`;
    return;
  }
  renderRecipesList();
}

function editRecipe(id) {
  const r = MT_ADMIN_RECIPES.find(x => x.id === id);
  if (!r) return;
  document.getElementById("recipeId").value = r.id;
  document.getElementById("recipeTitle").value = r.title || "";
  document.getElementById("recipeSubtitle").value = r.subtitle || "";
  document.getElementById("recipeDescription").value = r.description || "";
  document.getElementById("recipeCategory").value = r.category || "Recette";
  if (document.getElementById("recipeMealType")) document.getElementById("recipeMealType").value = r.meal_type || "";
  if (document.getElementById("recipeRelatedProtocol")) document.getElementById("recipeRelatedProtocol").value = r.related_protocol_id || "";
  document.getElementById("recipeMood").value = r.mood || "";
  document.getElementById("recipeEmoji").value = r.emoji || "🥣";
  document.getElementById("recipeImageUrl").value = r.image_url || "";
  if (document.getElementById("recipePdfUrl")) document.getElementById("recipePdfUrl").value = r.pdf_url || "";
  document.getElementById("recipeContentText").value = r.content_text || "";
  document.getElementById("recipeFullContent").value = r.full_content || "";
  document.getElementById("recipePremium").checked = !!r.is_premium;
  document.getElementById("recipePrice").value = r.price_cents || 0;
  document.getElementById("recipeStripePrice").value = r.stripe_price_id || "";
  if(document.getElementById("recipeAppleProduct")) document.getElementById("recipeAppleProduct").value = r.apple_product_id || "";
  document.getElementById("recipeOrder").value = r.sort_order || 100;
  document.getElementById("recipeActive").checked = r.active !== false;
  window.scrollTo({ top: document.getElementById("recipeForm").offsetTop - 90, behavior: "smooth" });
}

async function toggleRecipe(id, active) {
  const { error } = await initSupabase().from("recipes").update({ active }).eq("id", id);
  if (error) return alert(error.message);
  loadRecipes();
}

async function deleteRecipe(id) {
  if (!confirm("Supprimer cette recette ?")) return;
  const { error } = await initSupabase().from("recipes").delete().eq("id", id);
  if (error) return alert(error.message);
  loadRecipes();
}

function resetRecipeForm() {
  ["recipeId","recipeTitle","recipeSubtitle","recipeDescription","recipeCategory","recipeMealType","recipeRelatedProtocol","recipeMood","recipeEmoji","recipeImageUrl","recipeImageFile","recipePdfUrl","recipePdfFile","recipeContentText","recipeFullContent","recipeStripePrice"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  if (document.getElementById("recipePremium")) document.getElementById("recipePremium").checked = false;
  if (document.getElementById("recipeActive")) document.getElementById("recipeActive").checked = true;
  if (document.getElementById("recipePrice")) document.getElementById("recipePrice").value = 100;
  if (document.getElementById("recipeOrder")) document.getElementById("recipeOrder").value = 100;
  if (document.getElementById("recipeCategory")) document.getElementById("recipeCategory").value = "Recette";
  if (document.getElementById("recipeEmoji")) document.getElementById("recipeEmoji").value = "🥣";
}

/* CONTENTS */
function mtAdminContentTypeLabel(type) {
  const map = {
    pdf:"PDF", document:"Document", private_doc:"Journal privé", journal_private:"Journal privé", journal:"Journal privé",
    guide_plantes:"Plante", recette:"Recette", routine:"Routine", checklist:"Checklist", tracker:"Tracker",
    audio:"Audio", video:"Vidéo", calendar:"Calendrier", calendrier:"Calendrier", photo:"Photo", tableau:"Tableau"
  };
  return map[String(type || "document")] || String(type || "document").replaceAll("_"," ");
}

function mtAdminContentIcon(type) {
  const map = {
    pdf:"📄", document:"📄", private_doc:"📝", journal_private:"📝", journal:"📝",
    guide_plantes:"🌿", recette:"🥣", routine:"🌙", checklist:"✅", tracker:"📊",
    audio:"🎧", video:"🎥", calendar:"🗓️", calendrier:"🗓️", photo:"🖼️", tableau:"📋"
  };
  return map[String(type || "document")] || "✦";
}

function mtAdminNormalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mtAdminContentMeta(c) {
  const protocolTitle = c.protocols?.title || "Sans protocole";
  const day = Number(c.day_number || 0);
  return {
    protocolTitle,
    day,
    dayLabel: day ? `Jour ${day}` : "Sans jour",
    typeLabel: mtAdminContentTypeLabel(c.type),
    icon: mtAdminContentIcon(c.type),
    searchable: mtAdminNormalizeText([c.title, c.description, c.content_text, c.type, c.access_level, protocolTitle, day ? `jour ${day}` : "sans jour"].join(" "))
  };
}

function mtAdminEnsureGroupedLibrary(list) {
  if (document.getElementById("adminGroupedContentControls")) return;

  const wrap = document.createElement("div");
  wrap.id = "adminGroupedContentControls";
  wrap.className = "admin-grouped-controls";
  wrap.innerHTML = `
    <div class="admin-library-head">
      <div>
        <div class="kicker">Bibliothèque des contenus</div>
        <h2>Classée par protocole</h2>
        <p>Ouvre un protocole, puis un jour, pour retrouver rapidement un fichier à modifier.</p>
      </div>
      <button type="button" class="ghost-btn" onclick="mtAdminCollapseAllContents()">Tout fermer</button>
    </div>
    <div class="admin-search-row">
      <input id="adminContentSearch" type="search" placeholder="Rechercher : gingembre, jour 3, tracker, recette..." autocomplete="off">
    </div>
    <div id="adminContentStats" class="admin-filter-summary"></div>
  `;
  list.parentNode.insertBefore(wrap, list);

  document.getElementById("adminContentSearch").addEventListener("input", e => {
    MT_ADMIN_CONTENT_SEARCH = e.target.value || "";
    renderContentsList();
  });
}

function mtAdminGroupedContents() {
  const q = mtAdminNormalizeText(MT_ADMIN_CONTENT_SEARCH);
  const filtered = MT_ADMIN_CONTENTS.filter(c => !q || mtAdminContentMeta(c).searchable.includes(q));

  const groups = new Map();
  filtered.forEach(c => {
    const protocolId = String(c.protocol_id || "no-protocol");
    const meta = mtAdminContentMeta(c);
    if (!groups.has(protocolId)) {
      groups.set(protocolId, {
        id: protocolId,
        title: meta.protocolTitle,
        contents: [],
        days: new Map()
      });
    }
    const group = groups.get(protocolId);
    group.contents.push(c);
    const dayKey = meta.day ? String(meta.day) : "sans-jour";
    if (!group.days.has(dayKey)) {
      group.days.set(dayKey, { key: dayKey, day: meta.day, title: meta.dayLabel, contents: [] });
    }
    group.days.get(dayKey).contents.push(c);
  });

  return [...groups.values()].sort((a,b) => a.title.localeCompare(b.title, "fr"));
}

function mtAdminContentRow(c) {
  const meta = mtAdminContentMeta(c);
  return `<article class="admin-content-item">
    <div class="admin-content-icon">${escapeHTML(meta.icon)}</div>
    <div class="admin-content-main">
      <strong>${escapeHTML(c.title || "Sans titre")}</strong>
      <small>${escapeHTML(meta.typeLabel)} · ${escapeHTML(c.access_level || "protocol")} · ${c.xp_points ? `${Number(c.xp_points)} XP · ` : ""}${escapeHTML(meta.protocolTitle)}</small>
    </div>
    <div class="admin-content-actions">
      <button type="button" onclick="editContent('${c.id}')">Modifier</button>
      <button type="button" class="danger" onclick="deleteContent('${c.id}')">Supprimer</button>
    </div>
  </article>`;
}

function renderContentsList() {
  const list = document.getElementById("contentsList");
  if (!list) return;

  const groups = mtAdminGroupedContents();
  const filteredCount = groups.reduce((sum,g)=>sum+g.contents.length,0);
  const stats = document.getElementById("adminContentStats");
  if (stats) {
    stats.innerHTML = `<strong>${filteredCount}</strong> contenu${filteredCount>1?"s":""} affiché${filteredCount>1?"s":""} sur ${MT_ADMIN_CONTENTS.length} · <strong>${groups.length}</strong> protocole${groups.length>1?"s":""}`;
  }

  if (!groups.length) {
    list.innerHTML = `<p class="admin-empty">Aucun contenu trouvé.</p>`;
    return;
  }

  list.innerHTML = groups.map(group => {
    const days = [...group.days.values()].sort((a,b) => {
      if (!a.day && b.day) return 1;
      if (a.day && !b.day) return -1;
      return (a.day || 9999) - (b.day || 9999);
    });
    const typeCount = new Set(group.contents.map(c => c.type || "document")).size;

    return `<details class="admin-protocol-group">
      <summary>
        <div>
          <strong>${escapeHTML(group.title)}</strong>
          <small>${group.contents.length} contenu${group.contents.length>1?"s":""} · ${days.length} jour${days.length>1?"s":""} · ${typeCount} type${typeCount>1?"s":""}</small>
        </div>
        <span>Ouvrir</span>
      </summary>
      <div class="admin-days-list">
        ${days.map(day => `<details class="admin-day-group">
          <summary>
            <strong>${escapeHTML(day.title)}</strong>
            <small>${day.contents.length} contenu${day.contents.length>1?"s":""}</small>
          </summary>
          <div class="admin-day-contents">
            ${day.contents
              .sort((a,b)=>Number(a.sort_order||10)-Number(b.sort_order||10) || String(a.title||"").localeCompare(String(b.title||""),"fr"))
              .map(mtAdminContentRow).join("")}
          </div>
        </details>`).join("")}
      </div>
    </details>`;
  }).join("");
}

window.mtAdminCollapseAllContents = function() {
  document.querySelectorAll("#contentsList details").forEach(d => d.open = false);
};

async function loadContents() {
  const list = document.getElementById("contentsList");
  if (!list) return;
  mtAdminEnsureGroupedLibrary(list);
  list.innerHTML = `<p class="admin-empty">Chargement de la bibliothèque...</p>`;

  const { data, error } = await initSupabase()
    .from("protocol_contents")
    .select("*, protocols(title)")
    .order("created_at", { ascending:false })
    .limit(1000);

  if (error) {
    list.innerHTML = `<p class="admin-error">${escapeHTML(error.message)}</p>`;
    return;
  }

  MT_ADMIN_CONTENTS = data || [];
  renderContentsList();
}

async function editContent(id) {
  const { data, error } = await initSupabase().from("protocol_contents").select("*").eq("id", id).maybeSingle();
  if (error || !data) return alert("Contenu introuvable.");
  document.getElementById("contentId").value = data.id;
  document.getElementById("protocolSelect").value = data.protocol_id;
  document.getElementById("contentType").value = data.type || "document";
  document.getElementById("contentTitle").value = data.title || "";
  document.getElementById("contentDescription").value = data.description || "";
  if (document.getElementById("contentText")) document.getElementById("contentText").value = data.content_text || "";
  if (document.getElementById("contentAccessLevel")) document.getElementById("contentAccessLevel").value = data.access_level || "protocol";
  if (document.getElementById("contentDayNumber")) document.getElementById("contentDayNumber").value = data.day_number || "";
  if (document.getElementById("contentThumbnail")) document.getElementById("contentThumbnail").value = data.thumbnail_url || "";
  if (document.getElementById("contentAudioUrl")) document.getElementById("contentAudioUrl").value = data.audio_url || "";
  if (document.getElementById("contentXp")) document.getElementById("contentXp").value = data.xp_points || 0;
  if (document.getElementById("contentPreview")) document.getElementById("contentPreview").checked = !!data.is_preview;
  document.getElementById("contentVideo").value = data.video_url || data.embed_url || "";
  document.getElementById("contentPublicUrl").value = data.public_url || data.file_url || "";
  document.getElementById("contentOrder").value = data.sort_order || 10;
  window.scrollTo({ top: document.getElementById("contentForm").offsetTop - 90, behavior: "smooth" });
}

async function deleteContent(id) {
  if (!confirm("Supprimer ce contenu ?")) return;
  const { error } = await initSupabase().from("protocol_contents").delete().eq("id", id);
  if (error) return alert(error.message);
  loadContents();
}

function resetContentForm() {
  ["contentId","contentTitle","contentDescription","contentVideo","contentPublicUrl","contentFile","contentText","contentDayNumber","contentThumbnail","contentAudioUrl"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("contentOrder").value = 10;
  document.getElementById("contentType").value = "pdf";
  if (document.getElementById("contentAccessLevel")) document.getElementById("contentAccessLevel").value = "protocol";
  if (document.getElementById("contentXp")) document.getElementById("contentXp").value = 0;
  if (document.getElementById("contentPreview")) document.getElementById("contentPreview").checked = false;
}

/* UNLOCK */
async function unlockProtocolForClient(email, protocolId) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !protocolId) return alert("Email client et protocole obligatoires.");

  const client = initSupabase();
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("*")
    .ilike("email", cleanEmail)
    .maybeSingle();

  if (profileError || !profile) return alert("Profil introuvable. Le client doit d’abord créer un compte avec cet email.");

  const { error } = await client.from("user_protocols").upsert({
    user_id: profile.id,
    user_email: profile.email || cleanEmail,
    protocol_id: protocolId,
    status: "active",
    unlocked: true,
    purchased_at: new Date().toISOString()
  }, { onConflict: "user_id,protocol_id" });

  if (error) return alert(error.message);
  alert("Protocole débloqué pour ce client.");
}

async function unlockGeneralAccess(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return alert("Email obligatoire.");

  const client = initSupabase();
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("*")
    .ilike("email", cleanEmail)
    .maybeSingle();

  if (profileError || !profile) return alert("Profil introuvable. Le client doit d’abord créer un compte.");

  const { error } = await client.from("profiles").update({ has_app_access: true }).eq("id", profile.id);
  if (error) return alert(error.message);
  alert("Accès général activé.");
}

function fillSelects() {
  const protocolSelects = document.querySelectorAll(".protocol-select");
  protocolSelects.forEach(select => {
    select.innerHTML = MT_ADMIN_PROTOCOLS.map(p => `<option value="${p.id}">${escapeHTML(p.title || "Protocole")}</option>`).join("");
  });

  const recipeRelatedProtocol = document.getElementById("recipeRelatedProtocol");
  if (recipeRelatedProtocol) {
    const current = recipeRelatedProtocol.value || "";
    recipeRelatedProtocol.innerHTML = `<option value="">Aucun</option>` + MT_ADMIN_PROTOCOLS.map(p => `<option value="${p.id}">${escapeHTML(p.title || "Protocole")}</option>`).join("");
    recipeRelatedProtocol.value = current;
  }

  const pageSelect = document.getElementById("sectionPageId");
  if (pageSelect) pageSelect.innerHTML = MT_ADMIN_PAGES.map(p => `<option value="${p.id}">${escapeHTML(p.emoji || "")} ${escapeHTML(p.label || p.title || p.slug)}</option>`).join("");
}

/* FORMS */
document.addEventListener("DOMContentLoaded", () => {

  const recipeForm = document.getElementById("recipeForm");
  if (recipeForm) recipeForm.addEventListener("submit", async e => {
    e.preventDefault();
    const user = await mtRequireUser();
    const fd = new FormData(recipeForm);
    const id = fd.get("id");
    const title = fd.get("title");
    let image_url = fd.get("image_url") || null;
    let pdf_url = fd.get("pdf_url") || null;
    const file = fd.get("image_file");
    const pdfFile = fd.get("pdf_file");

    if (file && file.name) image_url = await uploadToBucket(window.MT_CONFIG.POST_MEDIA_BUCKET || "post-media", file, `recipes/${user.id}`);
    if (pdfFile && pdfFile.name) pdf_url = await uploadToBucket(window.MT_CONFIG.POST_MEDIA_BUCKET || "post-media", pdfFile, `recipes-pdf/${user.id}`);

    const isPremium = fd.get("is_premium") === "on";
    const row = {
      title,
      subtitle: fd.get("subtitle") || null,
      description: fd.get("description") || null,
      category: fd.get("category") || "Recette",
      meal_type: fd.get("meal_type") || null,
      related_protocol_id: fd.get("related_protocol_id") || null,
      mood: fd.get("mood") || null,
      emoji: fd.get("emoji") || "🥣",
      image_url,
      pdf_url,
      content_text: fd.get("content_text") || null,
      full_content: fd.get("full_content") || null,
      is_premium: isPremium,
      price_cents: isPremium ? Number(fd.get("price_cents") || 100) : 0,
      stripe_price_id: fd.get("stripe_price_id") || null,
      apple_product_id: fd.get("apple_product_id") || null,
      sort_order: Number(fd.get("sort_order") || 100),
      active: fd.get("active") === "on"
    };

    const q = id ? initSupabase().from("recipes").update(row).eq("id", id) : initSupabase().from("recipes").insert(row);
    const { error } = await q;
    if (error) return alert(error.message);

    alert(id ? "Recette modifiée." : "Recette créée.");
    resetRecipeForm();
    loadRecipes();
  });

  const postForm = document.getElementById("postForm");
  if (postForm) postForm.addEventListener("submit", async e => {
    e.preventDefault();
    const user = await mtRequireUser();
    const fd = new FormData(postForm);
    const id = fd.get("id");
    let urls = String(fd.get("media_urls") || "").split("\n").map(x => x.trim()).filter(Boolean);

    for (const file of fd.getAll("media_files")) {
      if (file && file.name) {
        const uploaded = await uploadToBucket(window.MT_CONFIG.POST_MEDIA_BUCKET || "post-media", file, user.id);
        if (uploaded) urls.push(uploaded);
      }
    }

    urls = urls.filter(Boolean).slice(0,4);
    const excerpt = String(fd.get("excerpt") || "").trim().replace(/\]\]/g, "] ]");
    const bodyContent = String(fd.get("content") || "").trim();
    const row = {
      title: fd.get("title"),
      content: excerpt ? `[[EXTRAIT:${excerpt}]]\n\n${bodyContent}` : bodyContent,
      type: fd.get("type") || "Journal",
      media_urls: urls,
      image_url: urls[0] || null,
      active: true,
      created_by: user.id
    };

    let savedPost = null;
    let error = null;

    if (id) {
      const res = await initSupabase().from("posts").update(row).eq("id", id);
      error = res.error;
    } else {
      const res = await initSupabase().from("posts").insert(row).select("id,type,title").single();
      error = res.error;
      savedPost = res.data;
    }

    if (error) return alert(error.message);

    // ── Push notification automatique sur nouveau post ──
    // Le lien pointe vers le post exact quand l'id est disponible.
    if (!id) {
      try {
        const postType = row.type || "Journal";
        const postTitle = row.title || "Nouveau contenu";
        const typeEmojis = {
          "Journal": "✨", "Hydratation": "💧", "Fuel du jour": "🌿",
          "Routine": "🌸", "Mindset": "🕊️", "Conseil privé": "🌱",
          "Drop exclusif": "✦", "Tip": "💡", "Mouvement": "🚶🏽‍♀️",
          "Sweet switch": "🍫", "Recette": "🥣"
        };
        const emoji = typeEmojis[postType] || "✨";
        const pushResult = await mtSendPushToAll({
          title: `${emoji} Méthode Tee`,
          body: mtPostNotificationBody(postType, postTitle),
          url: mtPostNotificationUrl(postType, savedPost?.id)
        });
        console.log("[MT Push] Notifications envoyées :", pushResult);
      } catch(pushErr) {
        console.warn("[MT Push] Notification non envoyée :", pushErr);
        alert("Post publié, mais notification non envoyée : " + (pushErr?.message || pushErr));
      }
    }

    alert(id ? "Post modifié." : "Post publié.");
    resetPostForm();
    loadPosts();
  });

  const pageForm = document.getElementById("pageForm");
  if (pageForm) pageForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(pageForm);
    const id = fd.get("id");
    const label = fd.get("label");
    const systemKey = fd.get("system_key") || "custom";
    const slug = systemKey === "library" ? "bibliotheque" : (fd.get("slug") || slugify(label));
    const row = {
      label,
      title: label,
      emoji: fd.get("emoji") || "✦",
      slug,
      description: fd.get("description"),
      sort_order: Number(fd.get("sort_order") || 10),
      system_key: systemKey,
      active: true
    };

    const q = id ? initSupabase().from("app_pages").update(row).eq("id", id) : initSupabase().from("app_pages").insert(row);
    const { error } = await q;
    if (error) return alert(error.message);

    alert("Page sauvegardée.");
    resetPageForm();
    refreshAdmin();
  });

  const protocolForm = document.getElementById("protocolForm");
  if (protocolForm) protocolForm.addEventListener("submit", async e => {
    e.preventDefault();

    const user = await mtRequireUser();
    const fd = new FormData(protocolForm);
    const id = String(fd.get("id") || "").trim();
    const title = String(fd.get("title") || "").trim();

    if (!title) return alert("Le titre du protocole est obligatoire.");

    let image_url = fd.get("image_url") || null;
    const file = fd.get("image_file");

    if (file && file.name) {
      image_url = await uploadToBucket(window.MT_CONFIG.PROTOCOL_MEDIA_BUCKET || "protocol-media", file, user.id);
    }

    const existing = id ? MT_ADMIN_PROTOCOLS.find(p => String(p.id) === String(id)) : null;

    const row = {
      title,
      // On garde le slug existant en modification pour éviter de casser les liens déjà partagés.
      slug: existing?.slug || slugify(title),
      subtitle: fd.get("subtitle") || null,
      category: fd.get("category") || "pharmacie_vegetale",
      filter_key: fd.get("filter_key") || null,
      emoji: fd.get("emoji") || "🌿",
      short_description: fd.get("short_description") || null,
      long_description: fd.get("long_description") || null,
      price_cents: Number(fd.get("price_cents") || 500),
      duration_label: fd.get("duration_label") || null,
      total_days: Number(fd.get("total_days") || String(fd.get("duration_label") || "").match(/\d+/)?.[0] || existing?.total_days || 21),
      level_label: fd.get("level_label") || existing?.level_label || "Exploration",
      certificate_enabled: fd.get("certificate_enabled") === "on",
      payment_link: fd.get("payment_link") || null,
      apple_product_id: fd.get("apple_product_id") || null,
      image_url,
      active: existing ? existing.active !== false : true
    };

    // created_by seulement à la création : en modification, ça évite de bloquer certaines politiques Supabase/RLS.
    if (!id) row.created_by = user.id;

    let result;
    if (id) {
      result = await initSupabase()
        .from("protocols")
        .update(row)
        .eq("id", id)
        .select("*")
        .maybeSingle();
    } else {
      result = await initSupabase()
        .from("protocols")
        .insert(row)
        .select("*")
        .maybeSingle();
    }

    if (result.error) return alert(result.error.message);

    alert(id ? "Protocole modifié et enregistré." : "Protocole créé.");
    resetProtocolForm();
    await refreshAdmin();
  });

  const contentForm = document.getElementById("contentForm");
  if (contentForm) contentForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(contentForm);
    const id = fd.get("id");
    const file = fd.get("file");
    const manual_url = fd.get("public_url") || fd.get("video_url") || null;
    let public_url = manual_url;
    let file_url = manual_url;

    if (file && file.name) {
      // Pour les fichiers premium, on stocke seulement le chemin interne du bucket privé.
      // Exemple : protocol_id/nom-du-fichier.pdf
      // L'utilisateur reçoit ensuite une URL signée temporaire.
      file_url = await uploadToBucket(window.MT_CONFIG.PROTOCOL_FILES_BUCKET || "protocol-files", file, fd.get("protocol_id"));
      public_url = null;
    }

    const row = {
      protocol_id: fd.get("protocol_id"),
      type: fd.get("type"),
      title: fd.get("title"),
      description: fd.get("description"),
      content_text: fd.get("content_text"),
      access_level: fd.get("access_level") || "protocol",
      day_number: fd.get("day_number") ? Number(fd.get("day_number")) : null,
      thumbnail_url: fd.get("thumbnail_url") || null,
      audio_url: fd.get("audio_url") || null,
      embed_url: fd.get("video_url") || null,
      xp_points: Number(fd.get("xp_points") || 0),
      is_preview: fd.get("is_preview") === "on",
      video_url: fd.get("video_url"),
      public_url,
      file_url,
      active: true,
      sort_order: Number(fd.get("sort_order") || 10)
    };

    const q = id ? initSupabase().from("protocol_contents").update(row).eq("id", id) : initSupabase().from("protocol_contents").insert(row);
    const { error } = await q;
    if (error) return alert(error.message);

    alert(id ? "Contenu modifié." : "Contenu ajouté.");
    resetContentForm();
    loadContents();
  });

  const unlockForm = document.getElementById("unlockForm");
  if (unlockForm) unlockForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(unlockForm);
    await unlockProtocolForClient(fd.get("email"), fd.get("protocol_id"));
    unlockForm.reset();
  });

  const accessForm = document.getElementById("accessForm");
  if (accessForm) accessForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(accessForm);
    await unlockGeneralAccess(fd.get("email"));
    accessForm.reset();
  });
});



/* V156 ADMIN — Rituels universels du jour */
function mtAdminDailyRitualDefaults(){
  return [
    {icon:'hydration', title:'Boire un grand verre d’eau', sub:'Le premier geste du jour', target_type:'none', target_id:'', url:''},
    {icon:'leaf', title:'Prendre 2 minutes pour respirer', sub:'Revenir doucement à soi', target_type:'none', target_id:'', url:''}
  ];
}
function mtAdminDailyRitualIconOptions(selected){
  const opts=[['seed','🌱 Graine'],['hydration','💧 Hydratation'],['fuel','🥣 Fuel'],['movement','🚶 Mouvement'],['leaf','🌿 Plante'],['journal','📖 Journal'],['sparkle','✨ Mindset'],['calendar','📅 Calendrier'],['checklist','☑️ Checklist'],['recipe','🥣 Recette'],['lock','🔒 Privé']];
  return opts.map(([v,l])=>`<option value="${escapeHTML(v)}" ${String(selected||'')===v?'selected':''}>${escapeHTML(l)}</option>`).join('');
}
function mtAdminNormalizeDailyRituals(value){
  let raw=value;
  if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch(e){raw=[]}}
  if(!Array.isArray(raw)) raw=[];
  return raw.slice(0,5).map(r=>({
    icon:r?.icon||'seed',
    title:r?.title||'',
    sub:r?.sub||r?.subtitle||r?.description||'',
    target_type:r?.target_type||r?.targetType||'none',
    target_id:r?.target_id||r?.targetId||'',
    url:r?.url||r?.action||''
  }));
}
function mtAdminDailyRitualTargetOptions(selected){
  const opts=[['none','Aucun lien'],['recipe','Recette'],['protocol','Protocole'],['page','Page'],['post','Post'],['pdf','PDF'],['audio','Audio'],['url','Lien URL']];
  return opts.map(([v,l])=>`<option value="${escapeHTML(v)}" ${String(selected||'none')===v?'selected':''}>${escapeHTML(l)}</option>`).join('');
}
function mtAdminRenderDailyRitualSlots(rituals){
  const box=document.getElementById('dailyRitualsSlots');
  if(!box) return;
  const list=[...mtAdminNormalizeDailyRituals(rituals)];
  while(list.length<5) list.push({icon:'seed',title:'',sub:'',target_type:'none',target_id:'',url:''});
  box.innerHTML=list.map((r,i)=>`<div class="admin-row-card admin-ritual-slot">
    <div style="width:100%">
      <strong>Rituel ${i+1}</strong>
      <label>Icône</label><select name="ritual_icon_${i}">${mtAdminDailyRitualIconOptions(r.icon)}</select>
      <label>Titre</label><input name="ritual_title_${i}" value="${escapeHTML(r.title)}" placeholder="Boire un grand verre d’eau">
      <label>Sous-titre</label><input name="ritual_sub_${i}" value="${escapeHTML(r.sub)}" placeholder="Le premier geste du jour">
      <label>Type de lien optionnel</label><select name="ritual_target_type_${i}">${mtAdminDailyRitualTargetOptions(r.target_type)}</select>
      <label>ID / slug du contenu</label><input name="ritual_target_id_${i}" value="${escapeHTML(r.target_id)}" placeholder="ID recette, slug page, ID protocole…">
      <label>URL directe optionnelle</label><input name="ritual_url_${i}" value="${escapeHTML(r.url)}" placeholder="https://… ou page.html?slug=…">
    </div>
  </div>`).join('');
}
async function loadDailyRitualsAdmin(){
  const status=document.getElementById('dailyRitualsStatus');
  if(!document.getElementById('dailyRitualsSlots')) return;
  try{
    const {data,error}=await initSupabase()
      .from('daily_rituals')
      .select('icon,title,sub,url,target_type,target_id,position,active')
      .eq('active',true)
      .order('position',{ascending:true});
    if(error) throw error;
    const rituals=mtAdminNormalizeDailyRituals((data||[]).map(r=>({icon:r.icon,title:r.title,sub:r.sub,url:r.url,target_type:r.target_type,target_id:r.target_id})));
    mtAdminRenderDailyRitualSlots(rituals.length?rituals:mtAdminDailyRitualDefaults());
    if(status) status.textContent='Rituels chargés.';
  }catch(e){
    mtAdminRenderDailyRitualSlots(mtAdminDailyRitualDefaults());
    if(status) status.textContent='Si la sauvegarde échoue, lance le SQL V159_daily_rituals_targets.sql dans Supabase.';
  }
}
async function saveDailyRitualsAdmin(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const rituals=[];
  for(let i=0;i<5;i++){
    const title=String(fd.get(`ritual_title_${i}`)||'').trim();
    if(!title) continue;
    rituals.push({
      icon:String(fd.get(`ritual_icon_${i}`)||'seed').trim(),
      title,
      sub:String(fd.get(`ritual_sub_${i}`)||'').trim(),
      target_type:String(fd.get(`ritual_target_type_${i}`)||'none').trim(),
      target_id:String(fd.get(`ritual_target_id_${i}`)||'').trim(),
      url:String(fd.get(`ritual_url_${i}`)||'').trim()
    });
  }
  const status=document.getElementById('dailyRitualsStatus');
  const client=initSupabase();
  const {error:deleteError}=await client.from('daily_rituals').delete().gte('position',0);
  if(deleteError){ if(status) status.textContent=deleteError.message; return alert(deleteError.message); }
  const rows=rituals.map((r,i)=>({
    position:i+1,
    icon:r.icon||'seed',
    title:r.title,
    sub:r.sub||'',
    target_type:r.target_type||'none',
    target_id:r.target_id||'',
    url:r.url||'',
    active:true,
    updated_at:new Date().toISOString()
  }));
  if(rows.length){
    const {error:insertError}=await client.from('daily_rituals').insert(rows);
    if(insertError){ if(status) status.textContent=insertError.message; return alert(insertError.message); }
  }
  if(status) status.textContent='Rituels du jour sauvegardés.';
  alert('Rituels du jour sauvegardés.');
}

/* V14 ADMIN — Club settings, capsules, drops, member levels */
async function loadClubSettingsAdmin(){const w=document.getElementById('clubSettingsStatus');try{const {data}=await initSupabase().from('club_settings').select('*').limit(1).maybeSingle(); if(data){clubName.value=data.club_name||''; clubSubtitle.value=data.hero_subtitle||''; clubQuote.value=data.quote||''; clubAmbiance.value=data.ambiance||'botanical'; clubStories.checked=data.show_stories!==false; clubDrops.checked=data.show_private_drops!==false;} if(w)w.textContent='Réglages chargés.';}catch(e){if(w)w.textContent=e.message}}
async function saveClubSettings(e){e.preventDefault();const payload={id:1,club_name:clubName.value||'Méthode Tee Club',hero_subtitle:clubSubtitle.value||'',quote:clubQuote.value||'',ambiance:clubAmbiance.value||'botanical',show_stories:clubStories.checked,show_private_drops:clubDrops.checked,updated_at:new Date().toISOString()}; const {error}=await initSupabase().from('club_settings').upsert(payload); if(error)return alert(error.message); alert('Ambiance du club sauvegardée.')}
async function loadCapsulesAdmin(){const list=document.getElementById('capsulesList'); if(!list)return; const {data,error}=await initSupabase().from('club_capsules').select('*').order('sort_order',{ascending:true}); if(error){list.innerHTML='<p>'+error.message+'</p>';return} list.innerHTML=(data||[]).map(c=>`<article class="admin-row-card"><div><strong>${escapeHTML(c.emoji||'✦')} ${escapeHTML(c.title||'Capsule')}</strong><small>${escapeHTML(c.type||'Privé')} · ${c.active?'visible':'masquée'}</small></div><button onclick="deleteCapsule('${c.id}')" class="danger">Supprimer</button></article>`).join('')||'<p class="admin-empty">Aucune capsule.</p>'}
async function deleteCapsule(id){if(!confirm('Supprimer cette capsule ?'))return; const {error}=await initSupabase().from('club_capsules').delete().eq('id',id); if(error)return alert(error.message); loadCapsulesAdmin()}
async function loadDropsAdmin(){const list=document.getElementById('dropsList'); if(!list)return; const {data,error}=await initSupabase().from('private_drops').select('*').order('created_at',{ascending:false}); if(error){list.innerHTML='<p>'+error.message+'</p>';return} list.innerHTML=(data||[]).map(d=>`<article class="admin-row-card"><div><strong>${escapeHTML(d.emoji||'🔒')} ${escapeHTML(d.title||'Drop')}</strong><small>${d.active?'visible':'masqué'}</small></div><button onclick="deleteDrop('${d.id}')" class="danger">Supprimer</button></article>`).join('')||'<p class="admin-empty">Aucun drop privé.</p>'}
async function deleteDrop(id){if(!confirm('Supprimer ce drop ?'))return; const {error}=await initSupabase().from('private_drops').delete().eq('id',id); if(error)return alert(error.message); loadDropsAdmin()}
async function assignMemberLevel(email,level,points,streak){const clean=String(email||'').trim().toLowerCase(); const {data:profile}=await initSupabase().from('profiles').select('*').ilike('email',clean).maybeSingle(); if(!profile)return alert('Profil introuvable.'); const badge=level==='Prestige'?'👑':level==='Gold'?'✨':level==='Silver'?'🤍':'🌿'; const {error}=await initSupabase().from('member_profiles').upsert({user_id:profile.id,level,badge,points:Number(points||0),streak:Number(streak||0),updated_at:new Date().toISOString()},{onConflict:'user_id'}); if(error)return alert(error.message); alert('Niveau membre sauvegardé.')}
document.addEventListener('DOMContentLoaded',()=>{const dr=document.getElementById('dailyRitualsForm'); if(dr)dr.addEventListener('submit',saveDailyRitualsAdmin); const f=document.getElementById('clubSettingsForm'); if(f)f.addEventListener('submit',saveClubSettings); const cf=document.getElementById('capsuleForm'); if(cf)cf.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(cf); const {error}=await initSupabase().from('club_capsules').insert({title:fd.get('title'),emoji:fd.get('emoji'),type:fd.get('type'),accent:fd.get('accent'),sort_order:Number(fd.get('sort_order')||10),active:true}); if(error)return alert(error.message); cf.reset(); loadCapsulesAdmin()}); const df=document.getElementById('dropForm'); if(df)df.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(df); const {error}=await initSupabase().from('private_drops').insert({title:fd.get('title'),description:fd.get('description'),emoji:fd.get('emoji'),url:fd.get('url'),active:true}); if(error)return alert(error.message); df.reset(); loadDropsAdmin()}); const mf=document.getElementById('memberLevelForm'); if(mf)mf.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(mf); await assignMemberLevel(fd.get('email'),fd.get('level'),fd.get('points'),fd.get('streak')); mf.reset()});});
