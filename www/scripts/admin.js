let MT_ADMIN_PROTOCOLS = [];
let MT_ADMIN_PROTOCOL_SEARCH = '';
let MT_ADMIN_RECIPE_SEARCH = '';
let MT_ADMIN_POST_SEARCH = '';
let MT_ADMIN_PAGES = [];
let MT_ADMIN_RECIPES = [];
let MT_ADMIN_CONTENTS = [];
let MT_ADMIN_CONTENT_SEARCH = '';
// Bibliothèque admin : les contenus sont chargés protocole par protocole.
// Cela évite la limite globale des 1 000 lignes et réduit l'egress côté admin.
let MT_ADMIN_CONTENTS_BY_PROTOCOL = new Map();
let MT_ADMIN_CONTENT_LOADING_PROTOCOLS = new Set();
let MT_ADMIN_CONTENT_ERRORS = new Map();
let MT_ADMIN_CONTENT_OPEN_PROTOCOLS = new Set();
let MT_ADMIN_CONTENT_SEARCH_RESULTS = [];
let MT_ADMIN_CONTENT_SEARCH_PENDING = false;
let MT_ADMIN_CONTENT_SEARCH_ERROR = '';
let MT_ADMIN_CONTENT_SEARCH_TIMER = null;
let MT_ADMIN_CONTENT_SEARCH_SEQ = 0;
let MT_ADMIN_FOOD_DICTIONARY = [];

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
    "challenge": "challenge",
    "nutrition": "nutrition",
    "pharmacopee": "pharmacopee",
    "pharmacopée": "pharmacopee",
    "bien etre": "bien-etre",
    "bien-être": "bien-etre",
    "methode tee": "methode-tee",
    "méthode tee": "methode-tee",
    "conseil du jour": "conseil"
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
    "challenge": `Un nouveau challenge t’attend ✨`,
    "nutrition": `Un nouveau repère nutrition t’attend 🥑`,
    "pharmacopee": `Une nouvelle note de pharmacopée t’attend 🌿`,
    "pharmacopée": `Une nouvelle note de pharmacopée t’attend 🌿`,
    "bien etre": `Un nouveau repère bien-être t’attend ✨`,
    "bien-être": `Un nouveau repère bien-être t’attend ✨`,
    "methode tee": `Une nouvelle publication Méthode Tee t’attend ✶`,
    "méthode tee": `Une nouvelle publication Méthode Tee t’attend ✶`,
    "conseil du jour": `Un conseil du jour t’attend ✨`
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
  const { data: { session } } = await initSupabase().auth.getSession();
  const accessToken = session?.access_token || "";
  if (!accessToken) throw new Error("Session administratrice expirée. Reconnecte-toi avant l’envoi.");

  const endpoint = supabaseUrl.replace(/\/$/, "") + "/functions/v1/send-push-notifications";

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
      "Authorization": "Bearer " + accessToken
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
  if (typeof loadLibraryOffersAdmin === "function") await loadLibraryOffersAdmin();
  if (typeof loadFoodDictionaryAdmin === "function") await loadFoodDictionaryAdmin();
  await loadContents();
  await loadRecipes();
  fillSelects();
  if (typeof loadClubSettingsAdmin === "function") await loadClubSettingsAdmin();
  if (typeof loadCapsulesAdmin === "function") await loadCapsulesAdmin();
  if (typeof loadDropsAdmin === "function") await loadDropsAdmin();
  if (typeof loadDailyRitualsAdmin === "function") await loadDailyRitualsAdmin();
  if (typeof loadCommunityJourneyAdmin === "function") await loadCommunityJourneyAdmin();
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

// V407.1 — Upload robuste des ressources « Offert par Tee » sur iOS/Safari.
// On ne modifie pas l'uploader global : seuls les fichiers de cette rubrique
// sont convertis explicitement en octets avant l'envoi à Supabase.
async function mtUploadLibraryOfferFile(bucket, file, folder) {
  if (!file || !file.name) return null;

  const declaredSize = Number(file.size || 0);
  if (!declaredSize) {
    throw new Error("Le fichier sélectionné est vide ou n’est pas encore disponible sur l’iPhone. Enregistre-le d’abord dans ‘Sur mon iPhone’ ou Téléchargements, puis sélectionne-le à nouveau.");
  }

  let buffer;
  try {
    if (typeof file.arrayBuffer === "function") buffer = await file.arrayBuffer();
    else buffer = await new Response(file).arrayBuffer();
  } catch (_) {
    throw new Error("Impossible de lire le fichier sélectionné. Enregistre-le localement sur l’iPhone puis sélectionne-le à nouveau.");
  }

  if (!buffer || !buffer.byteLength) {
    throw new Error("Le fichier sélectionné ne contient aucune donnée lisible. Enregistre-le localement sur l’iPhone puis sélectionne-le à nouveau.");
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${folder}/${Date.now()}-${safe}`;
  const client = initSupabase();
  const { error } = await client.storage.from(bucket).upload(path, new Uint8Array(buffer), {
    upsert: false,
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600"
  });

  if (error) {
    if (/no content provided/i.test(String(error.message || ""))) {
      throw new Error("Le fichier est sélectionné mais iOS n’a pas transmis son contenu. Enregistre-le dans ‘Sur mon iPhone’ ou Téléchargements, puis sélectionne cette copie locale.");
    }
    throw error;
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}


// V460 — Même correctif iOS/Safari validé sur « Offert par Tee »,
// appliqué UNIQUEMENT à l’upload des contenus de protocole.
// Le bucket protocol-files est privé : on retourne le chemin interne,
// qui continue d’être enregistré dans protocol_contents.file_url.
async function mtUploadProtocolFileIOS(bucket, file, folder) {
  if (!file || !file.name) return null;

  const declaredSize = Number(file.size || 0);
  if (!declaredSize) {
    throw new Error("Le fichier sélectionné est vide ou n’est pas encore disponible sur l’iPhone. Enregistre-le d’abord dans ‘Sur mon iPhone’ ou Téléchargements, puis sélectionne-le à nouveau.");
  }

  let buffer;
  try {
    if (typeof file.arrayBuffer === "function") buffer = await file.arrayBuffer();
    else buffer = await new Response(file).arrayBuffer();
  } catch (_) {
    throw new Error("Impossible de lire le fichier sélectionné. Enregistre-le localement sur l’iPhone puis sélectionne-le à nouveau.");
  }

  if (!buffer || !buffer.byteLength) {
    throw new Error("Le fichier sélectionné ne contient aucune donnée lisible. Enregistre-le localement sur l’iPhone puis sélectionne-le à nouveau.");
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const cleanFolder = String(folder || "admin").replace(/^\/+|\/+$/g, "") || "admin";
  const path = `${cleanFolder}/${Date.now()}-${safe}`;
  const client = initSupabase();
  const { error } = await client.storage.from(bucket).upload(path, new Uint8Array(buffer), {
    upsert: false,
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600"
  });

  if (error) {
    if (/no content provided/i.test(String(error.message || ""))) {
      throw new Error("Le fichier est sélectionné mais iOS n’a pas transmis son contenu. Enregistre-le dans ‘Sur mon iPhone’ ou Téléchargements, puis sélectionne cette copie locale.");
    }
    throw error;
  }

  return path;
}


// V461 — Upload robuste des médias du Feed sur iOS/Safari.
// Même stratégie que les correctifs validés pour « Offert par Tee » et les protocoles :
// lecture réelle du File en octets avant l'envoi à Supabase, sans toucher aux autres logiques du Feed.
async function mtUploadFeedFileIOS(bucket, file, folder) {
  if (!file || !file.name) return null;

  const declaredSize = Number(file.size || 0);
  if (!declaredSize) {
    throw new Error("Le média sélectionné est vide ou n’est pas encore disponible sur l’iPhone. Enregistre-le d’abord dans ‘Sur mon iPhone’ ou Téléchargements, puis sélectionne-le à nouveau.");
  }

  let buffer;
  try {
    if (typeof file.arrayBuffer === "function") buffer = await file.arrayBuffer();
    else buffer = await new Response(file).arrayBuffer();
  } catch (_) {
    throw new Error("Impossible de lire le média sélectionné. Enregistre-le localement sur l’iPhone puis sélectionne-le à nouveau.");
  }

  if (!buffer || !buffer.byteLength) {
    throw new Error("Le média sélectionné ne contient aucune donnée lisible. Enregistre-le localement sur l’iPhone puis sélectionne-le à nouveau.");
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const cleanFolder = String(folder || "admin").replace(/^\/+|\/+$/g, "") || "admin";
  const path = `${cleanFolder}/${Date.now()}-${safe}`;
  const client = initSupabase();
  const { error } = await client.storage.from(bucket).upload(path, new Uint8Array(buffer), {
    upsert: false,
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600"
  });

  if (error) {
    if (/no content provided/i.test(String(error.message || ""))) {
      throw new Error("Le média est sélectionné mais iOS n’a pas transmis son contenu. Enregistre-le dans ‘Sur mon iPhone’ ou Téléchargements, puis sélectionne cette copie locale.");
    }
    throw error;
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}


// V472 — Upload robuste de l’image de couverture d’un protocole sur iOS/Safari.
// Correctif volontairement limité au formulaire de création/modification des protocoles :
// on lit réellement le File en octets avant l’envoi à Supabase, comme pour les autres
// uploaders admin déjà sécurisés. Aucun changement sur paiements, IAP, déblocage ou contenu protocole.
async function mtUploadProtocolCoverIOS(bucket, file, folder) {
  if (!file || !file.name) return null;

  const declaredSize = Number(file.size || 0);
  if (!declaredSize) {
    throw new Error("L’image sélectionnée est vide ou n’est pas encore disponible sur l’iPhone. Enregistre-la d’abord dans ‘Sur mon iPhone’ ou Téléchargements, puis sélectionne-la à nouveau.");
  }

  let buffer;
  try {
    if (typeof file.arrayBuffer === "function") buffer = await file.arrayBuffer();
    else buffer = await new Response(file).arrayBuffer();
  } catch (_) {
    throw new Error("Impossible de lire l’image sélectionnée. Enregistre-la localement sur l’iPhone puis sélectionne-la à nouveau.");
  }

  if (!buffer || !buffer.byteLength) {
    throw new Error("L’image sélectionnée ne contient aucune donnée lisible. Enregistre-la localement sur l’iPhone puis sélectionne-la à nouveau.");
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const cleanFolder = String(folder || "admin").replace(/^\/+|\/+$/g, "") || "admin";
  const path = `${cleanFolder}/${Date.now()}-${safe}`;
  const client = initSupabase();
  const { error } = await client.storage.from(bucket).upload(path, new Uint8Array(buffer), {
    upsert: false,
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600"
  });

  if (error) {
    if (/no content provided/i.test(String(error.message || ""))) {
      throw new Error("L’image est sélectionnée mais iOS n’a pas transmis son contenu. Enregistre-la dans ‘Sur mon iPhone’ ou Téléchargements, puis sélectionne cette copie locale.");
    }
    throw error;
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}


/* ADMIN GROUPED LIBRARY HELPERS */
function mtAdminNorm(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mtAdminCategoryLabel(value) {
  const raw = String(value || "non_classe").toLowerCase();
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
    "conseil du jour": "Conseil du jour",
    "pharmacopée": "Pharmacopée",
    "bien-être": "Bien-être",
    "méthode tee": "Méthode TEE",
    hydratation: "Hydratation",
    "fuel du jour": "Fuel du jour",
    mouvement: "Mouvement",
    "sweet switch": "Sweet switch",
    routine: "Routine",
    challenge: "Challenge",
    "contenu privé": "Contenu privé",
    non_classe: "Non classé"
  };
  return map[raw] || raw.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

function mtAdminCategoryEmoji(value) {
  const raw = String(value || "").toLowerCase();
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
    "conseil du jour": "💡",
    "pharmacopée": "🌿",
    "bien-être": "✨",
    "méthode tee": "✶",
    hydratation: "💧",
    "fuel du jour": "🥣",
    mouvement: "🚶🏽‍♀️",
    "sweet switch": "🍫",
    routine: "🌿",
    challenge: "✶",
    "contenu privé": "✶",
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


function mtAdminDatetimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0,16);
}

function mtAdminPostStatus(post) {
  const now = Date.now();
  const publishAt = Date.parse(post?.published_at || post?.created_at || 0) || 0;
  const featuredUntil = Date.parse(post?.featured_until || 0) || 0;
  const parts = [];
  if (!post?.active) parts.push("masqué");
  else if (publishAt > now) parts.push(`programmé · ${new Date(publishAt).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}`);
  else parts.push("visible");
  if (featuredUntil > now) parts.push(`mis en avant jusqu’au ${new Date(featuredUntil).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})}`);
  if (post?.notify_on_publish && !post?.notification_sent_at) parts.push(publishAt > now ? "notification prévue" : "notification en attente");
  if (post?.notification_sent_at) parts.push("notification envoyée");
  return parts.join(" · ");
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
            <small>${escapeHTML(p.type || "Journal")} · ${escapeHTML(mtAdminPostStatus(p))}</small>
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
  const publishedAt = document.getElementById("postPublishedAt");
  if (publishedAt) publishedAt.value = mtAdminDatetimeLocal(data.published_at);
  const featuredUntil = document.getElementById("postFeaturedUntil");
  if (featuredUntil) featuredUntil.value = mtAdminDatetimeLocal(data.featured_until);
  const featured = document.getElementById("postFeatured");
  if (featured) featured.checked = !!data.featured_until && Date.parse(data.featured_until) > Date.now();
  const notify = document.getElementById("postNotify");
  if (notify) notify.checked = !!data.notify_on_publish;
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
  ["postId","postTitle","postExcerpt","postContent","postMediaUrls","postMediaFiles","postPublishedAt","postFeaturedUntil"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const type = document.getElementById("postType");
  if (type) type.value = "Nutrition";
  const featured = document.getElementById("postFeatured");
  if (featured) featured.checked = false;
  const notify = document.getElementById("postNotify");
  if (notify) notify.checked = true;
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

function mtAdminRecipeExtractMeta(fullContent) {
  const raw = String(fullContent || "");
  const match = raw.match(/^\s*\[MT_META\]([\s\S]*?)\[\/MT_META\]\s*/i);
  let meta = {};
  if (match) { try { meta = JSON.parse(match[1]); } catch(e) {} }
  return { meta, content: match ? raw.slice(match[0].length) : raw };
}
function mtAdminRecipeWithMeta(content, meta) {
  const clean = Object.fromEntries(Object.entries(meta || {}).filter(([,v]) => String(v || "").trim()));
  return Object.keys(clean).length ? `[MT_META]${JSON.stringify(clean)}[/MT_META]\n\n${String(content || "").trim()}` : String(content || "").trim();
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
  const recipeMetaData = mtAdminRecipeExtractMeta(r.full_content || "");
  document.getElementById("recipeFullContent").value = recipeMetaData.content || "";
  const metaMap = { recipeTime:"time", recipePortions:"portions", recipeCalories:"calories", recipeProteins:"proteins", recipeCarbs:"carbs", recipeFats:"fats" };
  Object.entries(metaMap).forEach(([id,key]) => { const el=document.getElementById(id); if(el) el.value=recipeMetaData.meta?.[key] || ""; });
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
  ["recipeId","recipeTitle","recipeSubtitle","recipeDescription","recipeCategory","recipeMealType","recipeRelatedProtocol","recipeMood","recipeEmoji","recipeImageUrl","recipeImageFile","recipePdfUrl","recipePdfFile","recipeContentText","recipeFullContent","recipeTime","recipePortions","recipeCalories","recipeProteins","recipeCarbs","recipeFats","recipeStripePrice"].forEach(id => {
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


/* V376 — DICTIONNAIRE ALIMENTAIRE · catalogue extensible sans rebuild */
function mtFoodList(value){return String(value||'').split(/[,\n;]/).map(x=>x.trim()).filter(Boolean);}
function mtFoodJsonList(value){return mtFoodList(value);}
function resetFoodDictionaryForm(){
  const f=document.getElementById('foodDictionaryForm');if(!f)return;f.reset();
  document.getElementById('foodDictionaryId').value='';
  document.getElementById('foodDictionaryPriority').value='100';
  document.getElementById('foodDictionaryEnabled').checked=true;
  const basis=document.getElementById('foodDictionaryNutritionBasis');if(basis)basis.value='100g';
  const mode=document.getElementById('foodDictionaryManualMode');if(mode)mode.value='complete';
}
async function previewFoodDictionarySearch(){
  const q=document.getElementById('foodDictionaryName')?.value.trim(),box=document.getElementById('foodDictionaryPreview');if(!q||!box)return;
  box.textContent='Prévisualisation…';const {data,error}=await initSupabase().rpc('search_foods_v2',{p_query:q,p_limit:10});
  box.innerHTML=error?escapeHTML(error.message):(data||[]).map((x,i)=>`${i+1}. ${escapeHTML(x.display_name||x.name)}`).join('<br>')||'Aucun résultat.';
}
function previewFoodDictionaryAdaptation(){
  const q=document.getElementById('foodDictionaryName')?.value.trim();if(!q)return alert('Renseigne d’abord le nom du plat.');
  window.open(`food-adapter.html?text=${encodeURIComponent(q)}&type=lunch`,'_blank','noopener');
}
async function loadFoodDictionaryAdmin(){
  const box=document.getElementById('foodDictionaryAdminList');if(!box)return;
  const q=String(document.getElementById('foodDictionaryAdminSearch')?.value||'').trim();
  let req=initSupabase().from('food_dictionary').select('id,canonical_name,display_name,country,categories,enabled,priority,updated_at').order('priority').order('canonical_name').limit(60);
  if(q.length>=2)req=req.or(`canonical_name.ilike.%${q.replace(/[%_,]/g,'')}%,display_name.ilike.%${q.replace(/[%_,]/g,'')}%,country.ilike.%${q.replace(/[%_,]/g,'')}%`);
  const {data,error}=await req;
  if(error){box.innerHTML=`<p>${escapeHTML(error.message)}</p>`;return;}
  MT_ADMIN_FOOD_DICTIONARY=data||[];
  box.innerHTML=MT_ADMIN_FOOD_DICTIONARY.length?MT_ADMIN_FOOD_DICTIONARY.map(x=>`<article class="admin-item"><div><b>${escapeHTML(x.display_name)}</b><small>${escapeHTML(x.country||'Origine non renseignée')} · ${(x.categories||[]).map(escapeHTML).join(', ')||'catégories à préciser'} · ${x.enabled?'Actif':'Masqué'}</small></div><button type="button" onclick="editFoodDictionaryItem('${x.id}')">Modifier</button></article>`).join(''):'<p>Aucun résultat.</p>';
}
async function editFoodDictionaryItem(id){
  const {data:x,error}=await initSupabase().from('food_dictionary').select('id,canonical_name,display_name,aliases,country,region,culture,ciqual_code,enabled,priority,meal_contexts,categories,typical_components,optional_components,adapter_profile,custom_kcal_100g,custom_protein_100g,custom_fat_100g,custom_carbs_100g,custom_fiber_100g,custom_salt_100g,custom_nutrition_extra_100g,custom_micronutrients_100g,nutrition_basis,nutrition_source_label,nutrition_verified').eq('id',id).maybeSingle();
  if(error||!x){alert(error?.message||'Entrée introuvable');return;}
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??'';};
  set('foodDictionaryId',x.id);set('foodDictionaryName',x.canonical_name);set('foodDictionaryDisplay',x.display_name);set('foodDictionaryAliases',(x.aliases||[]).join(', '));set('foodDictionaryCountry',x.country);set('foodDictionaryRegion',x.region);set('foodDictionaryCulture',x.culture);set('foodDictionaryCiqual',x.ciqual_code);set('foodDictionaryContexts',(x.meal_contexts||[]).join(', '));set('foodDictionaryCategories',(x.categories||[]).join(', '));set('foodDictionaryTypical',(x.typical_components||[]).join(', '));set('foodDictionaryOptional',(x.optional_components||[]).join(', '));set('foodDictionaryPriority',x.priority);
  document.getElementById('foodDictionaryEnabled').checked=!!x.enabled;
  const p=x.adapter_profile||{};set('foodDictionaryFamily',p.adapter_family||'');document.getElementById('foodDictionaryVegetable').checked=!!p.already_contains_vegetable;document.getElementById('foodDictionaryProteinVariable').checked=!!p.protein_is_variable;document.getElementById('foodDictionaryNoVeg').checked=!!p.do_not_auto_suggest_vegetables;document.getElementById('foodDictionaryVariable').checked=!!p.composition_variable;document.getElementById('foodDictionarySoup').checked=!!p.soup;document.getElementById('foodDictionarySweet').checked=!!p.sweet_breakfast;
  set('foodDictionaryKcal',x.custom_kcal_100g);set('foodDictionaryProtein',x.custom_protein_100g);set('foodDictionaryFat',x.custom_fat_100g);set('foodDictionaryCarbs',x.custom_carbs_100g);set('foodDictionaryFiber',x.custom_fiber_100g);set('foodDictionarySalt',x.custom_salt_100g);set('foodDictionaryNutritionBasis',x.nutrition_basis||'100g');set('foodDictionaryNutritionSource',x.nutrition_source_label||'');document.getElementById('foodDictionaryNutritionVerified').checked=!!x.nutrition_verified;
  const extra=x.custom_nutrition_extra_100g||{};const xv=k=>extra?.[k]?.value??extra?.[k]??'';set('foodDictionarySugars',xv('sugars_g'));set('foodDictionarySaturatedFat',xv('saturated_fat_g'));set('foodDictionarySodium',xv('sodium_g'));set('foodDictionaryTransFat',xv('trans_fat_g'));set('foodDictionaryMonoFat',xv('monounsaturated_fat_g'));set('foodDictionaryPolyFat',xv('polyunsaturated_fat_g'));set('foodDictionaryStarch',xv('starch_g'));set('foodDictionaryPolyols',xv('polyols_g'));set('foodDictionaryCholesterol',xv('cholesterol_g'));set('foodDictionaryAlcohol',xv('alcohol_g'));
  const micro=x.custom_micronutrients_100g||{};const mv=k=>micro?.[k]?.value??micro?.[k]??'';set('foodDictionaryIron',mv('iron_mg'));set('foodDictionaryCalcium',mv('calcium_mg'));set('foodDictionaryMagnesium',mv('magnesium_mg'));set('foodDictionaryPotassium',mv('potassium_mg'));set('foodDictionaryZinc',mv('zinc_mg'));set('foodDictionaryVitaminC',mv('vitamin_c_mg'));set('foodDictionaryVitaminB9',mv('vitamin_b9_ug'));set('foodDictionaryVitaminB12',mv('vitamin_b12_ug'));set('foodDictionaryVitaminD',mv('vitamin_d_ug'));set('foodDictionaryOmega3',mv('omega3_g'));
  const intel=p.tee_intelligence||{};set('foodDictionaryAheadDefault',(intel.ahead_default||[]).join(', '));set('foodDictionaryAheadEquilibre',(intel.ahead_by_goal?.equilibre||[]).join(', '));set('foodDictionaryAheadDigestion',(intel.ahead_by_goal?.digestion||[]).join(', '));set('foodDictionaryAheadEnergie',(intel.ahead_by_goal?.energie||[]).join(', '));set('foodDictionaryAheadMasse',(intel.ahead_by_goal?.prise_masse||[]).join(', '));set('foodDictionaryAheadLegerete',(intel.ahead_by_goal?.perte_poids||[]).join(', '));set('foodDictionaryTeeAdvice',intel.advice||'');set('foodDictionaryPreparation',intel.preparation||'');set('foodDictionaryTeeChoice',intel.tee_choice||'');set('foodDictionaryManualMode',intel.mode||'complete');
  const group=document.getElementById('admin-group-nutrition');if(group)group.open=true;window.scrollTo({top:document.getElementById('foodDictionaryForm').offsetTop-80,behavior:'smooth'});
}

/* V374 — OFFERT PAR TEE · ressources autonomes de Bibliothèque */
let MT_ADMIN_LIBRARY_OFFERS = [];

function mtAdminLibraryOfferTypeGuide(){
  const type=document.getElementById('libraryOfferType')?.value||'pdf';
  const guide=document.getElementById('libraryOfferTypeGuide');
  const text=document.getElementById('libraryOfferText');
  const label=document.getElementById('libraryOfferTextLabel');
  const map={
    pdf:['PDF premium','Le PDF s’affiche comme un document. Ajoute le fichier ou un lien direct.','## À retenir\nTexte facultatif...','Notes / introduction'],
    document:['Fichier téléchargeable','Ressource classique. Le fichier reste facultatif si le contenu texte suffit.','Notes facultatives...','Contenu texte'],
    ebook:['Ebook','Ajoute le fichier et, si tu veux, une introduction ou un sommaire.','## Sommaire\nChapitre 1','Introduction / sommaire'],
    guide_plantes:['Guide terrain','Même rendu que les guides de protocole. Utilise des sections claires.','## Origine et tradition\nTexte...\n## Préparation\nTexte...','Contenu du guide'],
    video:['Vidéo','Ajoute un lien vidéo et les points clés dans le texte.','Point clé 1\nPoint clé 2','Notes de la vidéo'],
    audio:['Audio','Le lecteur immersif est utilisé. Ajoute le fichier audio ou son lien.','Introduction de l’audio...','Introduction / notes'],
    recette:['Recette','Le rendu recette interprète les sections et étapes comme dans les protocoles.','[INGRÉDIENTS]\n1 banane\n\n[PRÉPARATION]\nMixer les ingrédients','Recette structurée'],
    routine:['Routine guidée','Une étape par ligne. La routine possède son propre parcours étape par étape.','Pose les pieds au sol\nPrends trois respirations lentes\nBois un verre d’eau','Étapes de la routine'],
    checklist:['Checklist','Une action par ligne. Utilise ## Titre pour créer des sections. Les cases sont mémorisées localement pour cette ressource offerte.','## Au réveil\nBoire un verre d’eau\nOuvrir les rideaux','Étapes de la checklist'],
    tracker:['Tracker','Format : Indicateur | Minimum | Maximum | Libellé bas | Libellé haut. Le tracker offert reste autonome du tracker personnel choisi dans Mes suivis.','Énergie|1|10|Très basse|Excellente\nStress|1|10|Très calme|Très élevé','Échelles du tracker'],
    tableau:['Tableau éditorial','Première ligne = en-têtes. Sépare chaque colonne avec |.','Moment|Action|Conseil\nRéveil|Boire 300 ml d’eau|Avant le café','Données du tableau'],
    calendar:['Plan du parcours','Format : Jour | Intention | Description.','Jour 1|Observer|Comprendre les signaux du corps','Étapes du parcours'],
    playlist:['Playlist','Format : Titre | Durée | URL.','Respiration lente|4 min|https://...','Pistes de la playlist'],
    suivi:['Suivi','Format : Nom du champ | Type | Unité ou options. Types : nombre, choix, texte, texte_long, oui_non, date.','Eau|nombre|verres\nDigestion|choix|Confortable,Variable,Difficile','Champs du suivi']
  };
  const cfg=map[type]||map.pdf;
  if(guide)guide.innerHTML=`<strong>${cfg[0]}</strong><p>${cfg[1]}</p><code>${String(cfg[2]).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</code>`;
  if(text)text.placeholder=cfg[2]||'';
  if(label)label.textContent=cfg[3]||'Contenu texte';
}

function mtAdminLibraryOfferStatus(r){
  const now=Date.now();
  const start=Date.parse(r?.published_at||0)||0;
  const end=Date.parse(r?.expires_at||0)||0;
  if(r?.active===false)return 'Masquée';
  if(start && start>now)return 'Programmée';
  if(end && end<=now)return 'Retirée de la sélection';
  return 'Disponible';
}

function mtAdminRenderLibraryOffers(){
  const list=document.getElementById('libraryOffersAdminList');
  if(!list)return;
  const rows=MT_ADMIN_LIBRARY_OFFERS||[];
  if(!rows.length){
    list.innerHTML='<p class="admin-empty">Aucune ressource offerte pour le moment.</p>';
    return;
  }
  list.innerHTML=rows.map(r=>`
    <article class="admin-content-item">
      <div class="admin-content-icon">${escapeHTML(mtAdminContentIcon(r.type))}</div>
      <div class="admin-content-main">
        <strong>${escapeHTML(r.title||'Sans titre')}</strong>
        <small>${escapeHTML(mtAdminContentTypeLabel(r.type))} · ${escapeHTML(mtAdminLibraryOfferStatus(r))}${r.duration_label?` · ${escapeHTML(r.duration_label)}`:''}</small>
      </div>
      <div class="admin-content-actions">
        <button type="button" onclick="editLibraryOffer('${r.id}')">Modifier</button>
        <button type="button" onclick="toggleLibraryOffer('${r.id}',${r.active===false?'true':'false'})">${r.active===false?'Remettre en avant':'Retirer des offres'}</button>
      </div>
    </article>`).join('');
}

async function loadLibraryOffersAdmin(){
  const list=document.getElementById('libraryOffersAdminList');
  if(!list)return;
  const {data,error}=await initSupabase()
    .from('library_offered_resources')
    .select('id,type,title,duration_label,active,published_at,expires_at,created_at')
    .order('published_at',{ascending:false})
    .limit(120);
  if(error){
    list.innerHTML=`<p class="admin-error">${escapeHTML(error.message)}</p>`;
    MT_ADMIN_LIBRARY_OFFERS=[];
    return;
  }
  MT_ADMIN_LIBRARY_OFFERS=data||[];
  mtAdminRenderLibraryOffers();
}

async function editLibraryOffer(id){
  const {data,error}=await initSupabase()
    .from('library_offered_resources')
    .select('*')
    .eq('id',id)
    .maybeSingle();
  if(error||!data)return alert(error?.message||'Ressource introuvable.');
  document.getElementById('libraryOfferId').value=data.id||'';
  document.getElementById('libraryOfferType').value=data.type||'pdf';
  document.getElementById('libraryOfferTitle').value=data.title||'';
  document.getElementById('libraryOfferDescription').value=data.description||'';
  document.getElementById('libraryOfferText').value=data.content_text||'';
  document.getElementById('libraryOfferDuration').value=data.duration_label||'';
  document.getElementById('libraryOfferThumbnail').value=data.thumbnail_url||'';
  document.getElementById('libraryOfferAudio').value=data.audio_url||'';
  document.getElementById('libraryOfferVideo').value=data.video_url||'';
  document.getElementById('libraryOfferPublicUrl').value=data.public_url||data.file_url||'';
  document.getElementById('libraryOfferExistingFile').value=data.file_url||data.public_url||'';
  document.getElementById('libraryOfferExistingThumb').value=data.thumbnail_url||'';
  document.getElementById('libraryOfferPublishedAt').value=mtAdminDatetimeLocal(data.published_at);
  document.getElementById('libraryOfferExpiresAt').value=mtAdminDatetimeLocal(data.expires_at);
  document.getElementById('libraryOfferOrder').value=Number(data.sort_order||100);
  document.getElementById('libraryOfferActive').checked=data.active!==false;
  mtAdminLibraryOfferTypeGuide();
  window.scrollTo({top:document.getElementById('libraryOfferForm').offsetTop-90,behavior:'smooth'});
}

async function toggleLibraryOffer(id,active){
  const {error}=await initSupabase()
    .from('library_offered_resources')
    .update({active:!!active,updated_at:new Date().toISOString()})
    .eq('id',id);
  if(error)return alert(error.message);
  await loadLibraryOffersAdmin();
}

function resetLibraryOfferForm(){
  const ids=['libraryOfferId','libraryOfferExistingFile','libraryOfferExistingThumb','libraryOfferTitle','libraryOfferDescription','libraryOfferText','libraryOfferDuration','libraryOfferThumbnail','libraryOfferAudio','libraryOfferVideo','libraryOfferPublicUrl','libraryOfferFile','libraryOfferThumbFile','libraryOfferExpiresAt'];
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const type=document.getElementById('libraryOfferType');if(type)type.value='pdf';
  const published=document.getElementById('libraryOfferPublishedAt');
  if(published)published.value=mtAdminDatetimeLocal(new Date().toISOString());
  const order=document.getElementById('libraryOfferOrder');if(order)order.value=100;
  const active=document.getElementById('libraryOfferActive');if(active)active.checked=true;
  mtAdminLibraryOfferTypeGuide();
}


/* CONTENTS */
function mtAdminContentTypeLabel(type) {
  const map = {
    pdf:"PDF", document:"Document", private_doc:"Journal privé", journal_private:"Journal privé", journal:"Journal privé",
    guide_plantes:"Guide terrain", recette:"Recette", routine:"Routine", checklist:"Checklist", tracker:"Tracker", suivi:"Suivi", playlist:"Playlist",
    audio:"Audio", video:"Vidéo", calendar:"Plan du parcours", calendrier:"Plan du parcours", photo:"Photo", photo_progression:"Photo privée", tableau:"Tableau", ebook:"Ebook", private_doc:"Document privé"
  };
  return map[String(type || "document")] || String(type || "document").replaceAll("_"," ");
}

function mtAdminContentIcon(type) {
  const map = {
    pdf:"📄", document:"📄", private_doc:"📝", journal_private:"📝", journal:"📝",
    guide_plantes:"🌿", recette:"🥣", routine:"🌙", checklist:"✅", tracker:"📊", suivi:"📈", playlist:"🎶",
    audio:"🎧", video:"🎥", calendar:"🗓️", calendrier:"🗓️", photo:"🖼️", photo_progression:"📷", tableau:"📋", ebook:"📚", private_doc:"🔒"
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
        <p>Tous tes protocoles restent visibles. Leurs contenus sont chargés uniquement quand tu les ouvres.</p>
      </div>
      <button type="button" class="ghost-btn" onclick="mtAdminCollapseAllContents()">Tout fermer</button>
    </div>
    <div class="admin-search-row">
      <input id="adminContentSearch" type="search" placeholder="Rechercher un protocole ou un contenu : Force & Construction, gingembre, tracker..." autocomplete="off">
    </div>
    <div id="adminContentStats" class="admin-filter-summary"></div>
  `;
  list.parentNode.insertBefore(wrap, list);

  document.getElementById("adminContentSearch").addEventListener("input", e => {
    MT_ADMIN_CONTENT_SEARCH = e.target.value || "";
    renderContentsList();
    clearTimeout(MT_ADMIN_CONTENT_SEARCH_TIMER);
    const value = String(MT_ADMIN_CONTENT_SEARCH || "").trim();
    if (!value) {
      MT_ADMIN_CONTENT_SEARCH_RESULTS = [];
      MT_ADMIN_CONTENT_SEARCH_PENDING = false;
      MT_ADMIN_CONTENT_SEARCH_ERROR = "";
      renderContentsList();
      return;
    }
    MT_ADMIN_CONTENT_SEARCH_TIMER = setTimeout(() => mtAdminSearchContents(value), 350);
  });
}

function mtAdminProtocolById(protocolId) {
  return (MT_ADMIN_PROTOCOLS || []).find(p => String(p.id) === String(protocolId)) || null;
}

function mtAdminDecorateContent(c) {
  const protocol = mtAdminProtocolById(c?.protocol_id);
  return {
    ...c,
    protocols: c?.protocols || (protocol ? { title: protocol.title } : { title: "Sans protocole" })
  };
}

function mtAdminSetProtocolContents(protocolId, rows) {
  const key = String(protocolId);
  const decorated = (rows || []).map(mtAdminDecorateContent);
  MT_ADMIN_CONTENTS_BY_PROTOCOL.set(key, decorated);
  MT_ADMIN_CONTENTS = [
    ...MT_ADMIN_CONTENTS.filter(c => String(c.protocol_id || "") !== key),
    ...decorated
  ];
}

function mtAdminBuildDays(contents) {
  const days = new Map();
  (contents || []).forEach(c => {
    const meta = mtAdminContentMeta(c);
    const dayKey = meta.day ? String(meta.day) : "sans-jour";
    if (!days.has(dayKey)) days.set(dayKey, { key: dayKey, day: meta.day, title: meta.dayLabel, contents: [] });
    days.get(dayKey).contents.push(c);
  });
  return days;
}

function mtAdminProtocolSearchable(p) {
  return mtAdminNormalizeText([
    p?.title, p?.subtitle, p?.category, p?.short_description, p?.long_description,
    p?.duration_label, p?.level_label
  ].join(" "));
}

function mtAdminSearchRowsForProtocol(protocolId) {
  const key = String(protocolId);
  return (MT_ADMIN_CONTENT_SEARCH_RESULTS || []).filter(c => String(c.protocol_id || "") === key);
}

function mtAdminGroupedContents() {
  const q = mtAdminNormalizeText(MT_ADMIN_CONTENT_SEARCH).trim();
  const protocols = [...(MT_ADMIN_PROTOCOLS || [])].sort((a,b) => String(a.title || "").localeCompare(String(b.title || ""), "fr"));
  const groups = [];

  protocols.forEach(protocol => {
    const key = String(protocol.id);
    const loaded = MT_ADMIN_CONTENTS_BY_PROTOCOL.has(key);
    const loadedRows = loaded ? (MT_ADMIN_CONTENTS_BY_PROTOCOL.get(key) || []) : [];
    const searchRows = q ? mtAdminSearchRowsForProtocol(key) : [];
    const protocolMatch = !q || mtAdminProtocolSearchable(protocol).includes(q);

    let contents = loadedRows;
    if (q && !protocolMatch) {
      const localMatches = loadedRows.filter(c => mtAdminContentMeta(c).searchable.includes(q));
      const merged = new Map();
      [...localMatches, ...searchRows].forEach(c => merged.set(String(c.id), c));
      contents = [...merged.values()];
    } else if (q && protocolMatch && !loaded) {
      contents = searchRows;
    }

    if (q && !protocolMatch && !contents.length) return;

    groups.push({
      id: key,
      title: protocol.title || "Protocole sans titre",
      protocol,
      contents,
      days: mtAdminBuildDays(contents),
      loaded,
      loading: MT_ADMIN_CONTENT_LOADING_PROTOCOLS.has(key),
      error: MT_ADMIN_CONTENT_ERRORS.get(key) || "",
      protocolMatch
    });
  });

  return groups;
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

function mtAdminDaysMarkup(group) {
  const days = [...group.days.values()].sort((a,b) => {
    if (!a.day && b.day) return 1;
    if (a.day && !b.day) return -1;
    return (a.day || 9999) - (b.day || 9999);
  });

  if (group.loading) return `<p class="admin-empty">Chargement des contenus de ${escapeHTML(group.title)}...</p>`;
  if (group.error) return `<p class="admin-error">${escapeHTML(group.error)} <button type="button" class="ghost-btn" onclick="mtAdminRetryProtocolContents('${group.id}')">Réessayer</button></p>`;
  if (!group.loaded && !group.contents.length) return `<p class="admin-empty">Ouverture du protocole : ses contenus vont être chargés à la demande.</p>`;
  if (!days.length) return `<p class="admin-empty">Aucun contenu dans ce protocole.</p>`;

  return days.map(day => `<details class="admin-day-group">
    <summary>
      <strong>${escapeHTML(day.title)}</strong>
      <small>${day.contents.length} contenu${day.contents.length>1?"s":""}</small>
    </summary>
    <div class="admin-day-contents">
      ${day.contents
        .sort((a,b)=>Number(a.sort_order||10)-Number(b.sort_order||10) || String(a.title||"").localeCompare(String(b.title||""),"fr"))
        .map(mtAdminContentRow).join("")}
    </div>
  </details>`).join("");
}

function renderContentsList() {
  const list = document.getElementById("contentsList");
  if (!list) return;

  const groups = mtAdminGroupedContents();
  const q = String(MT_ADMIN_CONTENT_SEARCH || "").trim();
  const loadedProtocols = MT_ADMIN_CONTENTS_BY_PROTOCOL.size;
  const loadedContents = [...MT_ADMIN_CONTENTS_BY_PROTOCOL.values()].reduce((sum,rows)=>sum+(rows?.length || 0),0);
  const stats = document.getElementById("adminContentStats");
  if (stats) {
    if (q) {
      const searchState = MT_ADMIN_CONTENT_SEARCH_PENDING ? " · recherche en cours…" : (MT_ADMIN_CONTENT_SEARCH_ERROR ? " · recherche distante indisponible" : "");
      stats.innerHTML = `<strong>${groups.length}</strong> protocole${groups.length>1?"s":""} trouvé${groups.length>1?"s":""}${searchState} · les contenus complets se chargent à l’ouverture`;
    } else {
      stats.innerHTML = `<strong>${(MT_ADMIN_PROTOCOLS || []).length}</strong> protocole${(MT_ADMIN_PROTOCOLS || []).length>1?"s":""} disponible${(MT_ADMIN_PROTOCOLS || []).length>1?"s":""} · <strong>${loadedContents}</strong> contenu${loadedContents>1?"s":""} chargé${loadedContents>1?"s":""} dans ${loadedProtocols} protocole${loadedProtocols>1?"s":""} · chargement à la demande`;
    }
  }

  if (!groups.length) {
    list.innerHTML = MT_ADMIN_CONTENT_SEARCH_PENDING
      ? `<p class="admin-empty">Recherche...</p>`
      : `<p class="admin-empty">Aucun protocole ou contenu trouvé.</p>`;
    return;
  }

  list.innerHTML = groups.map(group => {
    const days = [...group.days.values()];
    const typeCount = new Set(group.contents.map(c => c.type || "document")).size;
    const open = MT_ADMIN_CONTENT_OPEN_PROTOCOLS.has(group.id) ? " open" : "";
    let summary = "Contenus chargés à l’ouverture";
    if (group.loading) summary = "Chargement…";
    else if (group.error) summary = "Erreur de chargement";
    else if (group.loaded) summary = `${group.contents.length} contenu${group.contents.length>1?"s":""} · ${days.length} jour${days.length>1?"s":""}${typeCount ? ` · ${typeCount} type${typeCount>1?"s":""}` : ""}`;
    else if (group.contents.length) summary = `${group.contents.length} résultat${group.contents.length>1?"s":""} de recherche · ouvrir pour charger tout le protocole`;
    else if (group.protocol?.total_days) summary = `${Number(group.protocol.total_days)} jours · contenus chargés à l’ouverture`;

    return `<details class="admin-protocol-group" data-protocol-id="${escapeHTML(group.id)}"${open} ontoggle="mtAdminHandleProtocolToggle(this,'${group.id}')">
      <summary>
        <div>
          <strong>${escapeHTML(group.title)}</strong>
          <small>${summary}</small>
        </div>
        <span>Ouvrir</span>
      </summary>
      <div class="admin-days-list">
        ${mtAdminDaysMarkup(group)}
      </div>
    </details>`;
  }).join("");
}

window.mtAdminHandleProtocolToggle = function(details, protocolId) {
  const key = String(protocolId);
  if (details?.open) {
    MT_ADMIN_CONTENT_OPEN_PROTOCOLS.add(key);
    if (!MT_ADMIN_CONTENTS_BY_PROTOCOL.has(key) && !MT_ADMIN_CONTENT_LOADING_PROTOCOLS.has(key)) {
      mtAdminLoadProtocolContents(key);
    }
  } else {
    MT_ADMIN_CONTENT_OPEN_PROTOCOLS.delete(key);
  }
};

window.mtAdminRetryProtocolContents = function(protocolId) {
  MT_ADMIN_CONTENT_OPEN_PROTOCOLS.add(String(protocolId));
  mtAdminLoadProtocolContents(protocolId, true);
};

async function mtAdminFetchAllProtocolContents(protocolId) {
  const client = initSupabase();
  const pageSize = 500;
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await client
      .from("protocol_contents")
      .select("*")
      .eq("protocol_id", protocolId)
      .order("day_number", { ascending:true })
      .order("sort_order", { ascending:true })
      .order("created_at", { ascending:true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function mtAdminLoadProtocolContents(protocolId, force = false) {
  const key = String(protocolId);
  if (!force && MT_ADMIN_CONTENTS_BY_PROTOCOL.has(key)) return MT_ADMIN_CONTENTS_BY_PROTOCOL.get(key);
  if (MT_ADMIN_CONTENT_LOADING_PROTOCOLS.has(key)) return null;

  MT_ADMIN_CONTENT_LOADING_PROTOCOLS.add(key);
  MT_ADMIN_CONTENT_ERRORS.delete(key);
  renderContentsList();

  try {
    const rows = await mtAdminFetchAllProtocolContents(key);
    mtAdminSetProtocolContents(key, rows);
    return rows;
  } catch (err) {
    MT_ADMIN_CONTENT_ERRORS.set(key, err?.message || "Chargement impossible.");
    return null;
  } finally {
    MT_ADMIN_CONTENT_LOADING_PROTOCOLS.delete(key);
    renderContentsList();
  }
}

async function mtAdminSearchContents(value) {
  const raw = String(value || "").trim();
  const seq = ++MT_ADMIN_CONTENT_SEARCH_SEQ;
  if (!raw) return;

  const safe = raw.replace(/[(),.%*"'\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!safe) return;

  MT_ADMIN_CONTENT_SEARCH_PENDING = true;
  MT_ADMIN_CONTENT_SEARCH_ERROR = "";
  renderContentsList();

  const pattern = `%${safe}%`;
  const { data, error } = await initSupabase()
    .from("protocol_contents")
    .select("id,protocol_id,type,title,description,access_level,day_number,xp_points,sort_order,is_preview,active")
    .or(`title.ilike.${pattern},description.ilike.${pattern},content_text.ilike.${pattern},type.ilike.${pattern}`)
    .order("day_number", { ascending:true })
    .order("sort_order", { ascending:true })
    .limit(200);

  if (seq !== MT_ADMIN_CONTENT_SEARCH_SEQ || String(MT_ADMIN_CONTENT_SEARCH || "").trim() !== raw) return;

  MT_ADMIN_CONTENT_SEARCH_PENDING = false;
  if (error) {
    MT_ADMIN_CONTENT_SEARCH_RESULTS = [];
    MT_ADMIN_CONTENT_SEARCH_ERROR = error.message || "Recherche impossible.";
  } else {
    MT_ADMIN_CONTENT_SEARCH_RESULTS = (data || []).map(c => ({ ...mtAdminDecorateContent(c), _mt_search_match: true }));
    MT_ADMIN_CONTENT_SEARCH_ERROR = "";
  }
  renderContentsList();
}

window.mtAdminCollapseAllContents = function() {
  MT_ADMIN_CONTENT_OPEN_PROTOCOLS.clear();
  document.querySelectorAll("#contentsList details").forEach(d => d.open = false);
};

async function loadContents() {
  const list = document.getElementById("contentsList");
  if (!list) return;
  mtAdminEnsureGroupedLibrary(list);

  // Ne télécharge plus les 1 000 derniers contenus au chargement de l'admin.
  // La liste des protocoles est déjà disponible via loadProtocols(); chaque protocole
  // récupère ensuite uniquement ses propres contenus au moment où l'admin l'ouvre.
  MT_ADMIN_CONTENT_SEARCH = "";
  const searchInput = document.getElementById("adminContentSearch");
  if (searchInput) searchInput.value = "";
  MT_ADMIN_CONTENTS = [];
  MT_ADMIN_CONTENTS_BY_PROTOCOL.clear();
  MT_ADMIN_CONTENT_LOADING_PROTOCOLS.clear();
  MT_ADMIN_CONTENT_ERRORS.clear();
  MT_ADMIN_CONTENT_OPEN_PROTOCOLS.clear();
  MT_ADMIN_CONTENT_SEARCH_RESULTS = [];
  MT_ADMIN_CONTENT_SEARCH_PENDING = false;
  MT_ADMIN_CONTENT_SEARCH_ERROR = "";
  MT_ADMIN_CONTENT_SEARCH_SEQ += 1;
  clearTimeout(MT_ADMIN_CONTENT_SEARCH_TIMER);
  renderContentsList();
}


function mtAdminPhotoRoleFromText(text){
  const m=String(text||'').match(/\[\[photo_role:(start|progress|final)\]\]/i);
  return m ? m[1].toLowerCase() : 'start';
}
function mtAdminStripPhotoRole(text){
  return String(text||'').replace(/^\s*\[\[photo_role:(start|progress|final)\]\]\s*/i,'');
}
function mtAdminApplyPhotoRole(text,role,type){
  const clean=mtAdminStripPhotoRole(text);
  if(String(type||'').toLowerCase()!=='photo_progression') return clean;
  const safeRole=['start','progress','final'].includes(role)?role:'start';
  return `[[photo_role:${safeRole}]]\n${clean}`.trim();
}
function mtAdminUpdateContentTypeGuide(){
  const type=document.getElementById('contentType')?.value||'document';
  const guide=document.getElementById('contentTypeGuide'); const text=document.getElementById('contentText');
  const map={
    checklist:['Checklist','Une action par ligne. Utilise ## Titre pour créer des sections.','## Au réveil\nBoire un verre d’eau\nOuvrir les rideaux'],
    tracker:['Tracker','Format : Indicateur | Minimum | Maximum | Libellé bas | Libellé haut','Énergie|1|10|Très basse|Excellente'],
    suivi:['Suivi','Format : Nom du champ | Type | Unité ou options. Types : nombre, choix, texte, texte_long, oui_non, date.','Eau|nombre|verres\nDigestion|choix|Confortable,Variable,Difficile'],
    tableau:['Tableau éditorial','Première ligne = en-têtes. Sépare chaque colonne avec |.','Moment|Action|Conseil\nRéveil|Boire 300 ml d’eau|Avant le café'],
    calendar:['Plan du parcours','Format : Jour | Intention | Description.','Jour 1|Observer|Comprendre les signaux du corps'],
    routine:['Routine guidée','Une étape par ligne, dans l’ordre de réalisation.','Pose les pieds au sol\nPrends trois respirations lentes'],
    journal_private:['Journal privé','Une question par ligne. Le type choisi décide du rendu.','Comment je me sens aujourd’hui ?\nQuelle petite victoire puis-je reconnaître ?'],
    playlist:['Playlist','Format : Titre | Durée | URL ou fichier. Aucune piste fictive ne sera créée.','Respiration lente|4 min|https://...'],
    audio:['Audio','Ajoute le fichier audio, une couverture et une introduction dans le contenu texte.','Introduction de l’audio...'],
    video:['Vidéo','Ajoute le lien vidéo, une miniature et les points clés dans le contenu texte.','Point clé 1\nPoint clé 2'],
    guide_plantes:['Guide terrain','Structure avec ## Origine et tradition, ## Préparation, ## Anecdote méconnue, ## Note de Tee.','## Origine et tradition\nTexte...'],
    ebook:['Ebook','Ajoute la couverture, le fichier et une introduction ou un sommaire.','## Sommaire\nChapitre 1'],
    document:['Document','Ressource classique à ouvrir ou télécharger.','Notes facultatives...'],
    private_doc:['Document privé','Fichier personnel ou confidentiel. Ce type n’est pas un journal à remplir.','Description confidentielle...']
  };
  const cfg=map[type]||['Contenu','Renseigne uniquement les champs utiles à ce format.',''];
  if(guide)guide.innerHTML=`<strong>${cfg[0]}</strong><p>${cfg[1]}</p><code>${String(cfg[2]).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</code>`;
  if(text){text.placeholder=cfg[2]||'Contenu texte';text.previousElementSibling.textContent=type==='tableau'?'Données du tableau':type==='suivi'?'Champs du suivi':type==='tracker'?'Échelles du tracker':type==='playlist'?'Pistes de la playlist':type==='journal_private'?'Questions du journal':'Contenu texte';}
}

function mtAdminTogglePhotoRole(){
  const type=document.getElementById('contentType')?.value||'';
  const wrap=document.getElementById('contentPhotoRoleWrap');
  if(wrap) wrap.hidden=type!=='photo_progression';
}

async function editContent(id) {
  const { data, error } = await initSupabase().from("protocol_contents").select("*").eq("id", id).maybeSingle();
  if (error || !data) return alert("Contenu introuvable.");
  document.getElementById("contentId").value = data.id;
  document.getElementById("protocolSelect").value = data.protocol_id;
  document.getElementById("contentType").value = data.type || "document";
  mtAdminUpdateContentTypeGuide();
  mtAdminTogglePhotoRole();
  if (document.getElementById("contentPhotoRole")) document.getElementById("contentPhotoRole").value = mtAdminPhotoRoleFromText(data.content_text);
  document.getElementById("contentTitle").value = data.title || "";
  document.getElementById("contentDescription").value = data.description || "";
  if (document.getElementById("contentText")) document.getElementById("contentText").value = mtAdminStripPhotoRole(data.content_text || "");
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
  const known = [...MT_ADMIN_CONTENTS, ...(MT_ADMIN_CONTENT_SEARCH_RESULTS || [])].find(c => String(c.id) === String(id));
  const protocolId = known?.protocol_id ? String(known.protocol_id) : "";
  const { error } = await initSupabase().from("protocol_contents").delete().eq("id", id);
  if (error) return alert(error.message);

  MT_ADMIN_CONTENT_SEARCH_RESULTS = (MT_ADMIN_CONTENT_SEARCH_RESULTS || []).filter(c => String(c.id) !== String(id));
  if (protocolId) {
    MT_ADMIN_CONTENT_OPEN_PROTOCOLS.add(protocolId);
    await mtAdminLoadProtocolContents(protocolId, true);
  } else {
    renderContentsList();
  }
}

function resetContentForm() {
  ["contentId","contentTitle","contentDescription","contentVideo","contentPublicUrl","contentFile","contentText","contentDayNumber","contentThumbnail","contentAudioUrl"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("contentOrder").value = 10;
  document.getElementById("contentType").value = "pdf";
  mtAdminUpdateContentTypeGuide();
  if (document.getElementById("contentPhotoRole")) document.getElementById("contentPhotoRole").value = "start";
  mtAdminTogglePhotoRole();
  if (document.getElementById("contentAccessLevel")) document.getElementById("contentAccessLevel").value = "protocol";
  if (document.getElementById("contentXp")) document.getElementById("contentXp").value = 0;
  if (document.getElementById("contentPreview")) document.getElementById("contentPreview").checked = false;
}


/* PHOTO MIGRATION TOOL — suggestions only, confirmation required */
const MT_PHOTO_MIGRATION_WORDS = [
  'prendre une photo','photo de face','photo de profil','photo de dos','mensuration','mensurations',
  'comparer','comparaison','evolution','évolution','bilan visuel','repere visuel','repère visuel',
  'point de depart','point de départ','jour final','semaine 1','semaine 4','tour de taille','tour de hanches'
];

function mtAdminPhotoMigrationScore(content){
  const hay=mtAdminNormalizeText([content.title,content.description,content.content_text].filter(Boolean).join(' '));
  const hits=MT_PHOTO_MIGRATION_WORDS.filter(w=>hay.includes(mtAdminNormalizeText(w)));
  return { score:hits.length, hits };
}

window.mtAdminOpenPhotoMigration=async function(){
  const panel=document.getElementById('photoMigrationPanel');
  if(!panel) return;
  panel.hidden=false; panel.innerHTML='<p class="admin-empty">Analyse des contenus Photo…</p>';
  const {data:photos,error}=await initSupabase().from('protocol_contents').select('*, protocols(title)').eq('type','photo').order('created_at',{ascending:false});
  if(error){panel.innerHTML=`<p class="admin-error">${escapeHTML(error.message)}</p>`;return;}
  const ranked=photos.map(c=>({c,...mtAdminPhotoMigrationScore(c)})).sort((a,b)=>b.score-a.score || String(a.c.title||'').localeCompare(String(b.c.title||''),'fr'));
  panel.hidden=false;
  if(!ranked.length){ panel.innerHTML='<p class="admin-empty">Aucun ancien contenu de type Photo.</p>'; return; }
  panel.innerHTML=`
    <div class="admin-migration-head"><strong>${ranked.length} contenu${ranked.length>1?'s':''} Photo</strong><span>Suggestions : ${ranked.filter(x=>x.score>0).length}</span></div>
    <div class="admin-migration-bulk">
      <label><input type="checkbox" id="photoMigrationSelectSuggested"> Sélectionner uniquement les suggestions</label>
      <button type="button" onclick="mtAdminConvertSelectedPhotos()">Convertir la sélection en Photo privée</button>
    </div>
    <div class="admin-migration-list">${ranked.map(({c,score,hits})=>{
      const meta=mtAdminContentMeta(c);
      return `<label class="admin-migration-item ${score?'is-suggested':''}">
        <input class="photo-migration-check" type="checkbox" value="${escapeHTML(c.id)}" data-suggested="${score?1:0}">
        <div><strong>${escapeHTML(c.title||'Sans titre')}</strong><small>${escapeHTML(meta.protocolTitle)} · ${escapeHTML(meta.dayLabel)}</small>
        <p>${escapeHTML((c.description||c.content_text||'').slice(0,180))}</p>
        <span>${score?`Suggestion · ${escapeHTML(hits.slice(0,4).join(', '))}`:'Conserver probablement en Photo Méthode Tee'}</span></div>
      </label>`;
    }).join('')}</div>`;
  const toggle=document.getElementById('photoMigrationSelectSuggested');
  toggle?.addEventListener('change',()=>document.querySelectorAll('.photo-migration-check').forEach(cb=>cb.checked=toggle.checked && cb.dataset.suggested==='1'));
};

window.mtAdminConvertSelectedPhotos=async function(){
  const ids=[...document.querySelectorAll('.photo-migration-check:checked')].map(x=>x.value);
  if(!ids.length) return alert('Sélectionne au moins un contenu.');
  if(!confirm(`Convertir ${ids.length} contenu${ids.length>1?'s':''} en Photo privée / repère visuel ?\n\nLe texte et les fichiers ne seront pas modifiés.`)) return;
  const client=initSupabase();
  const {data:before,error:readError}=await client.from('protocol_contents').select('id,type,title').in('id',ids);
  if(readError) return alert(readError.message);
  const {error}=await client.from('protocol_contents').update({type:'photo_progression'}).in('id',ids).eq('type','photo');
  if(error) return alert(error.message);
  try{
    const history=JSON.parse(localStorage.getItem('mt_admin_photo_migration_history')||'[]');
    history.unshift({at:new Date().toISOString(),items:(before||[]).map(x=>({id:x.id,title:x.title,from:x.type,to:'photo_progression'}))});
    localStorage.setItem('mt_admin_photo_migration_history',JSON.stringify(history.slice(0,30)));
  }catch(_){ }
  alert(`${ids.length} contenu${ids.length>1?'s':''} converti${ids.length>1?'s':''}.`);
  await loadContents();
  mtAdminOpenPhotoMigration();
};

window.mtAdminShowPhotoMigrationHistory=function(){
  let history=[]; try{history=JSON.parse(localStorage.getItem('mt_admin_photo_migration_history')||'[]')}catch(_){ }
  if(!history.length) return alert('Aucune conversion enregistrée sur cet appareil.');
  const panel=document.getElementById('photoMigrationPanel');
  if(!panel) return;
  panel.hidden=false;
  panel.innerHTML=`<div class="admin-migration-head"><strong>Historique des conversions</strong></div>
    <div class="admin-migration-list">${history.slice(0,20).map((h,index)=>`<article class="admin-migration-item">
      <div><strong>${new Date(h.at).toLocaleString('fr-FR')}</strong><p>${h.items.length} contenu${h.items.length>1?'s':''} converti${h.items.length>1?'s':''}</p></div>
      <button type="button" class="ghost-btn" ${h.undone?'disabled':''} onclick="mtAdminUndoPhotoMigration(${index})">${h.undone?'Annulation effectuée':'Annuler cette conversion'}</button>
    </article>`).join('')}</div>`;
};
window.mtAdminUndoPhotoMigration=async function(index){
  let history=[]; try{history=JSON.parse(localStorage.getItem('mt_admin_photo_migration_history')||'[]')}catch(_){ }
  const entry=history[index];
  if(!entry || entry.undone) return;
  const ids=(entry.items||[]).map(x=>x.id).filter(Boolean);
  if(!ids.length || !confirm(`Repasser ${ids.length} contenu${ids.length>1?'s':''} en Photo Méthode Tee ?`)) return;
  const {error}=await initSupabase().from('protocol_contents').update({type:'photo'}).in('id',ids).eq('type','photo_progression');
  if(error) return alert(error.message);
  entry.undone=true; entry.undone_at=new Date().toISOString();
  localStorage.setItem('mt_admin_photo_migration_history',JSON.stringify(history));
  await loadContents();
  mtAdminShowPhotoMigrationHistory();
};

/* FREE INTRO PROTOCOL — isolated from paid products */
window.mtAdminCreateFreeIntroProtocol=async function(){
  const status=document.getElementById('freeIntroProtocolStatus');
  const setStatus=t=>{if(status) status.textContent=t};
  if(!confirm('Créer ou compléter le protocole gratuit « Premiers Pas — La Méthode Tee » ?')) return;
  setStatus('Création en cours…');
  const client=initSupabase();
  const slug='premiers-pas-la-methode-tee';
  let {data:protocol,error}=await client.from('protocols').select('*').eq('slug',slug).maybeSingle();
  if(error){setStatus(error.message);return;}
  const row={
    title:'Premiers Pas — La Méthode Tee', slug, subtitle:'Découvrir la méthode', category:'pharmacie_vegetale', filter_key:'routine', emoji:'✦',
    short_description:'Trois jours pour comprendre l’esprit Méthode Tee et commencer sans pression.',
    long_description:'Un parcours gratuit et bienveillant pour écouter ton corps, nourrir plutôt que restreindre et créer ton propre équilibre.',
    price_cents:0, duration_label:'3 jours', total_days:3, level_label:'Découverte', certificate_enabled:false,
    payment_link:null, apple_product_id:null, active:true
  };
  if(protocol){
    const r=await client.from('protocols').update(row).eq('id',protocol.id).select('*').maybeSingle();
    if(r.error){setStatus(r.error.message);return;} protocol=r.data;
  }else{
    const user=await mtRequireUser(); if(!user){setStatus('Connexion requise.');return;}
    const r=await client.from('protocols').insert({...row,created_by:user.id}).select('*').maybeSingle();
    if(r.error){setStatus(r.error.message);return;} protocol=r.data;
  }
  const contents=[
    {day_number:1,sort_order:10,title:'Ton corps n’est pas ton ennemi',description:'Observer les signaux du corps avec davantage de douceur.',content_text:'Ton corps ne cherche pas à te contrarier. Il s’adapte, protège et communique. Aujourd’hui, observe un signal de ton corps sans le juger.\n\nGeste du jour : note une sensation, un besoin ou un niveau d’énergie.',type:'journal_private',access_level:'protocol',xp_points:10,active:true},
    {day_number:2,sort_order:20,title:'Nourrir plutôt que restreindre',description:'Remettre la nutrition au service de l’énergie et de la stabilité.',content_text:'Au lieu de retirer toujours davantage, demande-toi ce que tu peux ajouter pour mieux nourrir ton corps.\n\nMission du jour : ajoute une source de protéines, de fibres ou une boisson hydratante à un repas.',type:'checklist',access_level:'protocol',xp_points:10,active:true},
    {day_number:3,sort_order:30,title:'Créer son propre équilibre',description:'Construire une méthode réaliste, personnelle et durable.',content_text:'Ton équilibre n’a pas besoin de ressembler à celui des autres. Choisis un rituel simple que tu peux réellement conserver.\n\nRituel du jour : écris l’habitude douce que tu souhaites garder cette semaine.',type:'journal_private',access_level:'protocol',xp_points:10,active:true}
  ];
  const existing=await client.from('protocol_contents').select('id,day_number,title').eq('protocol_id',protocol.id);
  if(existing.error){setStatus(existing.error.message);return;}
  for(const c of contents){
    const found=(existing.data||[]).find(x=>Number(x.day_number)===c.day_number && x.title===c.title);
    const payload={...c,protocol_id:protocol.id};
    const r=found ? await client.from('protocol_contents').update(payload).eq('id',found.id) : await client.from('protocol_contents').insert(payload);
    if(r.error){setStatus(`Jour ${c.day_number} : ${r.error.message}`);return;}
  }
  setStatus('✓ Protocole gratuit créé et prêt à être testé.');
  await refreshAdmin();
};

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
      full_content: mtAdminRecipeWithMeta(fd.get("full_content") || "", {
        time: fd.get("recipe_time") || "",
        portions: fd.get("recipe_portions") || "",
        calories: fd.get("recipe_calories") || "",
        proteins: fd.get("recipe_proteins") || "",
        carbs: fd.get("recipe_carbs") || "",
        fats: fd.get("recipe_fats") || ""
      }) || null,
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

    // V461 — Safari/iOS : lire directement les File depuis l’input, puis envoyer leurs octets.
    const mediaInput = document.getElementById("postMediaFiles");
    const mediaFiles = mediaInput?.files ? Array.from(mediaInput.files) : [];
    for (const file of mediaFiles) {
      if (file && file.name) {
        const uploaded = await mtUploadFeedFileIOS(window.MT_CONFIG.POST_MEDIA_BUCKET || "post-media", file, user.id);
        if (uploaded) urls.push(uploaded);
      }
    }

    urls = urls.filter(Boolean).slice(0,4);
    const excerpt = String(fd.get("excerpt") || "").trim().replace(/\]\]/g, "] ]");
    const bodyContent = String(fd.get("content") || "").trim();

    const now = new Date();
    const publishInput = String(fd.get("published_at") || "").trim();
    const publishDate = publishInput ? new Date(publishInput) : now;
    if (Number.isNaN(publishDate.getTime())) return alert("Date de publication invalide.");

    const isScheduled = publishDate.getTime() > now.getTime() + 30000;
    const wantsFeatured = fd.get("featured") === "on";
    const featureInput = String(fd.get("featured_until") || "").trim();
    let featureDate = featureInput ? new Date(featureInput) : null;
    if (featureDate && Number.isNaN(featureDate.getTime())) return alert("Date de mise en avant invalide.");
    if (wantsFeatured && !featureDate) {
      const base = isScheduled ? publishDate : now;
      featureDate = new Date(base.getTime() + 3 * 86400000);
    }

    const wantsNotification = fd.get("notify_on_publish") === "on";
    const row = {
      title: fd.get("title"),
      content: excerpt ? `[[EXTRAIT:${excerpt}]]\n\n${bodyContent}` : bodyContent,
      type: fd.get("type") || "Nutrition",
      media_urls: urls,
      image_url: urls[0] || null,
      active: true,
      created_by: user.id,
      published_at: publishDate.toISOString(),
      featured_until: wantsFeatured && featureDate ? featureDate.toISOString() : null,
      notify_on_publish: wantsNotification,
      updated_at: now.toISOString()
    };

    // Modifier une publication ne renvoie jamais une notification déjà envoyée.
    // Si une publication programmée est repoussée avant l'envoi, elle reste en attente.
    let savedPost = null;
    let error = null;

    if (id) {
      const res = await initSupabase().from("posts").update(row).eq("id", id).select("id,type,title,published_at,notify_on_publish,notification_sent_at").single();
      error = res.error;
      savedPost = res.data;
    } else {
      const res = await initSupabase().from("posts").insert(row).select("id,type,title,published_at,notify_on_publish,notification_sent_at").single();
      error = res.error;
      savedPost = res.data;
    }

    if (error) return alert(error.message);

    // Notification facultative :
    // - publication immédiate neuve -> envoi maintenant ;
    // - publication future -> le dispatcher SQL l'enverra à l'heure prévue ;
    // - modification -> jamais de doublon.
    if (!id && wantsNotification && !isScheduled) {
      try {
        const postType = row.type || "Journal";
        const postTitle = row.title || "Nouveau contenu";
        const typeEmojis = {
          "Journal": "✨", "Hydratation": "💧", "Fuel du jour": "🌿",
          "Routine": "🌸", "Mindset": "🕊️", "Conseil privé": "🌱",
          "Conseil du jour": "✨", "Nutrition": "🥑", "Pharmacopée": "🌿",
          "Bien-être": "✨", "Méthode TEE": "✶",
          "Drop exclusif": "✶", "Tip": "💡", "Mouvement": "🚶🏽‍♀️",
          "Sweet switch": "🍫", "Recette": "🥣"
        };
        const emoji = typeEmojis[postType] || "✨";
        const pushResult = await mtSendPushToAll({
          title: `${emoji} Méthode Tee`,
          body: mtPostNotificationBody(postType, postTitle),
          url: mtPostNotificationUrl(postType, savedPost?.id)
        });
        console.log("[MT Push] Notifications envoyées :", pushResult);
        await initSupabase().from("posts").update({
          notification_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", savedPost.id);
      } catch(pushErr) {
        console.warn("[MT Push] Notification non envoyée :", pushErr);
        alert("Post publié, mais notification non envoyée : " + (pushErr?.message || pushErr));
      }
    }

    const confirmation = isScheduled
      ? `Post programmé pour ${publishDate.toLocaleString("fr-FR",{day:"2-digit",month:"long",hour:"2-digit",minute:"2-digit"})}${wantsNotification ? " · notification prévue" : ""}.`
      : (id ? "Post modifié." : "Post publié.");
    alert(confirmation);
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
    // iOS/Safari : lire le File directement depuis l’input évite certaines références FormData
    // qui conservent le nom du fichier mais perdent son contenu au moment de l’upload.
    const fileInput = document.getElementById("protocolImageFile");
    const file = fileInput?.files?.[0] || null;

    if (file && file.name) {
      try {
        image_url = await mtUploadProtocolCoverIOS(
          window.MT_CONFIG.PROTOCOL_MEDIA_BUCKET || "protocol-media",
          file,
          user.id
        );
      } catch (uploadError) {
        console.error("[Admin Protocol] Échec upload couverture", uploadError);
        return alert(uploadError?.message || "Impossible d’envoyer l’image du protocole. Réessaie après avoir enregistré l’image localement sur l’iPhone.");
      }
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

  const foodDictionarySearch=document.getElementById('foodDictionaryAdminSearch');
  let foodDictionaryTimer=0;
  foodDictionarySearch?.addEventListener('input',()=>{clearTimeout(foodDictionaryTimer);foodDictionaryTimer=setTimeout(loadFoodDictionaryAdmin,350);});
  const foodDictionaryForm=document.getElementById('foodDictionaryForm');
  foodDictionaryForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    const id=document.getElementById('foodDictionaryId').value.trim();
    const value=id=>String(document.getElementById(id)?.value||'').trim();
    const num=id=>{const v=value(id);return v===''?null:Number(v);};
    const micro={};
    const putMicro=(key,id,unit)=>{const v=num(id);if(Number.isFinite(v))micro[key]={value:v,unit,source:value('foodDictionaryNutritionSource')||'Méthode Tee'};};
    putMicro('iron_mg','foodDictionaryIron','mg');putMicro('calcium_mg','foodDictionaryCalcium','mg');putMicro('magnesium_mg','foodDictionaryMagnesium','mg');putMicro('potassium_mg','foodDictionaryPotassium','mg');putMicro('zinc_mg','foodDictionaryZinc','mg');putMicro('vitamin_c_mg','foodDictionaryVitaminC','mg');putMicro('vitamin_b9_ug','foodDictionaryVitaminB9','µg');putMicro('vitamin_b12_ug','foodDictionaryVitaminB12','µg');putMicro('vitamin_d_ug','foodDictionaryVitaminD','µg');putMicro('omega3_g','foodDictionaryOmega3','g');
    const teeIntelligence={mode:value('foodDictionaryManualMode')||'complete',ahead_default:mtFoodList(value('foodDictionaryAheadDefault')),ahead_by_goal:{equilibre:mtFoodList(value('foodDictionaryAheadEquilibre')),digestion:mtFoodList(value('foodDictionaryAheadDigestion')),energie:mtFoodList(value('foodDictionaryAheadEnergie')),prise_masse:mtFoodList(value('foodDictionaryAheadMasse')),perte_poids:mtFoodList(value('foodDictionaryAheadLegerete'))},advice:value('foodDictionaryTeeAdvice')||null,preparation:value('foodDictionaryPreparation')||null,tee_choice:value('foodDictionaryTeeChoice')||null};
    const profile={
      adapter_family:document.getElementById('foodDictionaryFamily').value||null,
      already_contains_vegetable:document.getElementById('foodDictionaryVegetable').checked,
      protein_is_variable:document.getElementById('foodDictionaryProteinVariable').checked,
      do_not_auto_suggest_vegetables:document.getElementById('foodDictionaryNoVeg').checked,
      composition_variable:document.getElementById('foodDictionaryVariable').checked,
      soup:document.getElementById('foodDictionarySoup').checked,
      sweet_breakfast:document.getElementById('foodDictionarySweet').checked,
      tee_intelligence:teeIntelligence
    };
    const extra={};
    const putExtra=(key,id,unit='g')=>{const v=num(id);if(Number.isFinite(v))extra[key]={value:v,unit,source:value('foodDictionaryNutritionSource')||'Méthode Tee'};};
    putExtra('sugars_g','foodDictionarySugars');putExtra('saturated_fat_g','foodDictionarySaturatedFat');putExtra('sodium_g','foodDictionarySodium');putExtra('trans_fat_g','foodDictionaryTransFat');putExtra('monounsaturated_fat_g','foodDictionaryMonoFat');putExtra('polyunsaturated_fat_g','foodDictionaryPolyFat');putExtra('starch_g','foodDictionaryStarch');putExtra('polyols_g','foodDictionaryPolyols');putExtra('cholesterol_g','foodDictionaryCholesterol');putExtra('alcohol_g','foodDictionaryAlcohol');
    const row={canonical_name:value('foodDictionaryName'),display_name:value('foodDictionaryDisplay'),aliases:mtFoodList(value('foodDictionaryAliases')),country:value('foodDictionaryCountry')||null,region:value('foodDictionaryRegion')||null,culture:value('foodDictionaryCulture')||null,ciqual_code:value('foodDictionaryCiqual')||null,meal_contexts:mtFoodList(value('foodDictionaryContexts')),categories:mtFoodList(value('foodDictionaryCategories')),typical_components:mtFoodJsonList(value('foodDictionaryTypical')),optional_components:mtFoodJsonList(value('foodDictionaryOptional')),adapter_profile:profile,priority:Number(value('foodDictionaryPriority')||100),enabled:document.getElementById('foodDictionaryEnabled').checked,custom_kcal_100g:num('foodDictionaryKcal'),custom_protein_100g:num('foodDictionaryProtein'),custom_fat_100g:num('foodDictionaryFat'),custom_carbs_100g:num('foodDictionaryCarbs'),custom_fiber_100g:num('foodDictionaryFiber'),custom_salt_100g:num('foodDictionarySalt'),custom_nutrition_extra_100g:extra,custom_micronutrients_100g:micro,nutrition_basis:value('foodDictionaryNutritionBasis')||'100g',nutrition_source_label:value('foodDictionaryNutritionSource')||null,nutrition_verified:document.getElementById('foodDictionaryNutritionVerified').checked};
    const req=id?initSupabase().from('food_dictionary').update(row).eq('id',id):initSupabase().from('food_dictionary').insert(row);
    const {error}=await req;if(error)return alert(error.code==='23505'?'Ce plat existe déjà dans le dictionnaire.':error.message);
    alert(id?'Entrée alimentaire mise à jour.':'Entrée alimentaire ajoutée. Elle est maintenant disponible dans l’app.');resetFoodDictionaryForm();await loadFoodDictionaryAdmin();
  });

  const libraryOfferType = document.getElementById('libraryOfferType');
  libraryOfferType?.addEventListener('change', mtAdminLibraryOfferTypeGuide);
  if(document.getElementById('libraryOfferPublishedAt') && !document.getElementById('libraryOfferPublishedAt').value){
    document.getElementById('libraryOfferPublishedAt').value=mtAdminDatetimeLocal(new Date().toISOString());
  }
  mtAdminLibraryOfferTypeGuide();

  const libraryOfferForm=document.getElementById('libraryOfferForm');
  if(libraryOfferForm)libraryOfferForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(libraryOfferForm);
    const id=String(fd.get('id')||'').trim();
    const user=(await initSupabase().auth.getUser())?.data?.user;
    if(!user)return alert('Session admin introuvable.');

    let fileUrl=String(fd.get('existing_file_url')||'').trim()||null;
    let thumbnailUrl=String(fd.get('existing_thumbnail_url')||'').trim()||null;
    const manualFile=String(fd.get('public_url')||'').trim();
    const manualThumb=String(fd.get('thumbnail_url')||'').trim();
    // Sur iOS/Safari, récupérer le File directement depuis l'input est plus
    // fiable que FormData pour les documents choisis dans l'app Fichiers.
    const fileInput=document.getElementById('libraryOfferFile');
    const thumbInput=document.getElementById('libraryOfferThumbFile');
    const file=fileInput?.files?.[0]||fd.get('file');
    const thumbFile=thumbInput?.files?.[0]||fd.get('thumbnail_file');

    try{
      if(thumbFile&&thumbFile.name){
        thumbnailUrl=await mtUploadLibraryOfferFile(window.MT_CONFIG.POST_MEDIA_BUCKET||'post-media',thumbFile,`library-offers/covers/${user.id}`);
      }else if(manualThumb){
        thumbnailUrl=manualThumb;
      }

      if(file&&file.name){
        fileUrl=await mtUploadLibraryOfferFile(window.MT_CONFIG.POST_MEDIA_BUCKET||'post-media',file,`library-offers/${user.id}`);
      }else if(manualFile){
        fileUrl=manualFile;
      }
    }catch(err){
      return alert(err?.message||'Upload impossible.');
    }

    const publishInput=String(fd.get('published_at')||'').trim();
    const expiresInput=String(fd.get('expires_at')||'').trim();
    const publishDate=publishInput?new Date(publishInput):new Date();
    const expiresDate=expiresInput?new Date(expiresInput):null;
    if(Number.isNaN(publishDate.getTime()))return alert('Date de publication invalide.');
    if(expiresDate&&Number.isNaN(expiresDate.getTime()))return alert('Date de retrait invalide.');
    if(expiresDate&&expiresDate<=publishDate)return alert('La date de retrait doit être après la publication.');

    const type=String(fd.get('type')||'pdf');
    const row={
      type,
      title:String(fd.get('title')||'').trim(),
      description:String(fd.get('description')||'').trim()||null,
      content_text:String(fd.get('content_text')||'').trim()||null,
      duration_label:String(fd.get('duration_label')||'').trim()||null,
      thumbnail_url:thumbnailUrl,
      audio_url:String(fd.get('audio_url')||'').trim()||null,
      video_url:String(fd.get('video_url')||'').trim()||null,
      public_url:fileUrl,
      file_url:fileUrl,
      active:fd.get('active')==='on',
      published_at:publishDate.toISOString(),
      expires_at:expiresDate?expiresDate.toISOString():null,
      sort_order:Number(fd.get('sort_order')||100),
      updated_at:new Date().toISOString()
    };
    if(!id)row.created_by=user.id;

    const q=id
      ? initSupabase().from('library_offered_resources').update(row).eq('id',id)
      : initSupabase().from('library_offered_resources').insert(row);
    const {error}=await q;
    if(error)return alert(error.message);

    alert(id?'Ressource offerte modifiée.':'Ressource offerte publiée.');
    resetLibraryOfferForm();
    await loadLibraryOffersAdmin();
  });

  const contentTypeSelect = document.getElementById("contentType");
  contentTypeSelect?.addEventListener("change", ()=>{mtAdminTogglePhotoRole();mtAdminUpdateContentTypeGuide();});
  mtAdminUpdateContentTypeGuide();
  mtAdminTogglePhotoRole();

  const contentForm = document.getElementById("contentForm");
  if (contentForm) contentForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(contentForm);
    const id = fd.get("id");
    // Même correction que celle qui a résolu « Offert par Tee » sur iOS :
    // on lit le File directement depuis l’input, puis on l’envoie en octets.
    const fileInput = document.getElementById("contentFile");
    const file = fileInput?.files?.[0] || fd.get("file");
    const manual_url = fd.get("public_url") || fd.get("video_url") || null;
    let public_url = manual_url;
    let file_url = manual_url;

    if (file && file.name) {
      try {
        file_url = await mtUploadProtocolFileIOS(
          window.MT_CONFIG.PROTOCOL_FILES_BUCKET || "protocol-files",
          file,
          fd.get("protocol_id")
        );
        public_url = null;
      } catch (err) {
        return alert(err?.message || "Upload du fichier impossible.");
      }
    }

    const row = {
      protocol_id: fd.get("protocol_id"),
      type: fd.get("type"),
      title: fd.get("title"),
      description: fd.get("description"),
      content_text: mtAdminApplyPhotoRole(fd.get("content_text"), fd.get("photo_role"), fd.get("type")),
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
    const previous = id
      ? [...MT_ADMIN_CONTENTS, ...(MT_ADMIN_CONTENT_SEARCH_RESULTS || [])].find(c => String(c.id) === String(id))
      : null;
    const previousProtocolId = previous?.protocol_id ? String(previous.protocol_id) : "";
    const savedProtocolId = row.protocol_id ? String(row.protocol_id) : "";
    resetContentForm();

    if (savedProtocolId) {
      MT_ADMIN_CONTENT_OPEN_PROTOCOLS.add(savedProtocolId);
      await mtAdminLoadProtocolContents(savedProtocolId, true);
    }
    if (previousProtocolId && previousProtocolId !== savedProtocolId && MT_ADMIN_CONTENTS_BY_PROTOCOL.has(previousProtocolId)) {
      await mtAdminLoadProtocolContents(previousProtocolId, true);
    }
    if (!savedProtocolId) renderContentsList();
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


/* V294 BLOC 2 — Administration minimale « Notre journée ensemble » */
const MT_JOURNEY_SLOT_LABELS = {
  wake_up: 'Au réveil',
  morning: 'Dans la matinée',
  lunch: 'Autour du déjeuner',
  afternoon: 'Dans l’après-midi',
  evening: 'Dans la soirée',
  before_sleep: 'Avant de dormir'
};

function mtJourneyLocalDateISO(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function mtJourneyAdminDate() {
  const input = document.getElementById('journeyAdminDate');
  return input?.value || mtJourneyLocalDateISO();
}

function mtJourneySetStatus(message, isError = false) {
  const node = document.getElementById('journeyAdminStatus');
  if (!node) return;
  node.textContent = message || '';
  node.style.color = isError ? '#9E4B43' : '';
}

function mtJourneyResetForm() {
  const form = document.getElementById('journeyItemForm');
  if (!form) return;
  form.reset();
  document.getElementById('journeyItemId').value = '';
  document.getElementById('journeyDisplayOrder').value = '0';
  document.getElementById('journeyValidationEnabled').checked = true;
  document.getElementById('journeyIsActive').checked = true;
  document.getElementById('journeyStatus').value = 'draft';
  document.getElementById('journeyNotificationEnabled').checked = false;
  document.getElementById('journeyNotificationTime').value = '';
  document.getElementById('journeyNotificationTitle').value = '';
  document.getElementById('journeyNotificationBody').value = '';
  document.getElementById('journeySaveButton').textContent = 'Ajouter le rendez-vous';
  document.getElementById('journeyCancelEdit').hidden = true;
}

function mtJourneyTimeLabel(value) {
  return value ? String(value).slice(0, 5).replace(':', ' h ') : 'Heure libre';
}

async function loadCommunityJourneyAdmin() {
  const list = document.getElementById('journeyItemsList');
  if (!list) return;
  const dateInput = document.getElementById('journeyAdminDate');
  if (dateInput && !dateInput.value) dateInput.value = mtJourneyLocalDateISO();
  const date = mtJourneyAdminDate();
  mtJourneySetStatus('Chargement de la journée…');
  list.innerHTML = '<p class="admin-empty">Chargement…</p>';

  const { data, error } = await initSupabase()
    .from('community_journey_items')
    .select('*')
    .eq('journey_date', date)
    .order('display_order', { ascending: true })
    .order('scheduled_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    list.innerHTML = '<p class="admin-empty">Impossible de charger cette journée.</p>';
    mtJourneySetStatus(error.message, true);
    return;
  }

  const rows = data || [];
  const homeCount = rows.filter(item => item.is_active && item.show_on_home && ['scheduled','published'].includes(item.status)).length;
  mtJourneySetStatus(`${rows.length} rendez-vous · ${homeCount}/4 affichés sur l’accueil`);

  list.innerHTML = rows.map(item => `
    <article class="admin-row-card">
      <div>
        <strong>${escapeHTML(item.title || 'Rendez-vous')}</strong>
        <small>${escapeHTML(MT_JOURNEY_SLOT_LABELS[item.slot_key] || item.slot_key || '')} · ${escapeHTML(mtJourneyTimeLabel(item.scheduled_time))} · ${escapeHTML(item.status || 'draft')} · ordre ${Number(item.display_order || 0)}</small>
        ${item.short_text ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.5">${escapeHTML(item.short_text)}</p>` : ''}
        <small>${item.show_on_home ? 'Accueil' : 'Hors accueil'} · ${item.show_as_pill ? 'Pill' : 'Sans pill'} · ${item.validation_enabled ? 'Validable' : 'Non validable'} · ${item.is_active ? 'Actif' : 'Inactif'}</small>
      </div>
      <button type="button" onclick="editCommunityJourneyItem('${item.id}')">Modifier</button>
      <button type="button" class="danger" onclick="deleteCommunityJourneyItem('${item.id}')">Supprimer</button>
    </article>
  `).join('') || '<p class="admin-empty">Aucun rendez-vous pour cette date.</p>';
}

async function editCommunityJourneyItem(id) {
  const { data, error } = await initSupabase()
    .from('community_journey_items')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return alert(error.message);

  document.getElementById('journeyItemId').value = data.id;
  document.getElementById('journeySlotKey').value = data.slot_key || 'wake_up';
  document.getElementById('journeyScheduledTime').value = data.scheduled_time ? String(data.scheduled_time).slice(0,5) : '';
  document.getElementById('journeyTitle').value = data.title || '';
  document.getElementById('journeyShortText').value = data.short_text || '';
  document.getElementById('journeyLinkedType').value = data.linked_content_type || '';
  document.getElementById('journeyLinkedId').value = data.linked_content_id || '';
  document.getElementById('journeyLinkedUrl').value = data.linked_url || '';
  document.getElementById('journeyDisplayOrder').value = Number(data.display_order || 0);
  document.getElementById('journeyShowHome').checked = !!data.show_on_home;
  document.getElementById('journeyShowPill').checked = !!data.show_as_pill;
  document.getElementById('journeyPillLabel').value = data.pill_label || '';
  document.getElementById('journeyValidationEnabled').checked = data.validation_enabled !== false;
  document.getElementById('journeyValidationLabel').value = data.validation_label || '';
  document.getElementById('journeyCompletedLabel').value = data.completed_label || '';
  document.getElementById('journeyStatus').value = data.status || 'draft';
  document.getElementById('journeyNotificationEnabled').checked = !!data.notification_enabled;
  document.getElementById('journeyNotificationTime').value = data.notification_time ? String(data.notification_time).slice(0,5) : '';
  document.getElementById('journeyNotificationTitle').value = data.notification_title || '';
  document.getElementById('journeyNotificationBody').value = data.notification_body || '';
  document.getElementById('journeyIsActive').checked = data.is_active !== false;
  document.getElementById('journeySaveButton').textContent = 'Enregistrer la modification';
  document.getElementById('journeyCancelEdit').hidden = false;
  document.getElementById('communityJourneyAdmin')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveCommunityJourneyItem(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const id = String(fd.get('id') || '').trim();
  const payload = {
    journey_date: mtJourneyAdminDate(),
    slot_key: String(fd.get('slot_key') || 'wake_up'),
    scheduled_time: String(fd.get('scheduled_time') || '').trim() || null,
    title: String(fd.get('title') || '').trim(),
    short_text: String(fd.get('short_text') || '').trim(),
    linked_content_type: String(fd.get('linked_content_type') || '').trim() || null,
    linked_content_id: String(fd.get('linked_content_id') || '').trim() || null,
    linked_url: String(fd.get('linked_url') || '').trim() || null,
    display_order: Number(fd.get('display_order') || 0),
    show_on_home: fd.get('show_on_home') === 'on',
    show_as_pill: fd.get('show_as_pill') === 'on',
    pill_label: String(fd.get('pill_label') || '').trim() || null,
    validation_enabled: fd.get('validation_enabled') === 'on',
    validation_label: String(fd.get('validation_label') || '').trim() || null,
    completed_label: String(fd.get('completed_label') || '').trim() || null,
    notification_enabled: fd.get('notification_enabled') === 'on',
    notification_time: String(fd.get('notification_time') || '').trim() || null,
    notification_title: String(fd.get('notification_title') || '').trim() || null,
    notification_body: String(fd.get('notification_body') || '').trim() || null,
    status: String(fd.get('status') || 'draft'),
    is_active: fd.get('is_active') === 'on',
    updated_at: new Date().toISOString()
  };

  if (!payload.title) return alert('Le titre est obligatoire.');

  if (payload.show_on_home && payload.is_active && ['scheduled','published'].includes(payload.status)) {
    let query = initSupabase()
      .from('community_journey_items')
      .select('id', { count: 'exact', head: true })
      .eq('journey_date', payload.journey_date)
      .eq('show_on_home', true)
      .eq('is_active', true)
      .in('status', ['scheduled','published']);
    if (id) query = query.neq('id', id);
    const { count, error: countError } = await query;
    if (countError) return alert(countError.message);
    if ((count || 0) >= 4) return alert('Cette journée contient déjà 4 rendez-vous actifs affichés sur l’accueil. Désactive cette option sur un autre rendez-vous avant de continuer.');
  }

  mtJourneySetStatus(id ? 'Enregistrement de la modification…' : 'Ajout du rendez-vous…');
  const client = initSupabase();
  const result = id
    ? await client.from('community_journey_items').update(payload).eq('id', id)
    : await client.from('community_journey_items').insert(payload);

  if (result.error) {
    mtJourneySetStatus(result.error.message, true);
    return alert(result.error.message);
  }

  mtJourneyResetForm();
  await loadCommunityJourneyAdmin();
  alert(id ? 'Rendez-vous modifié.' : 'Rendez-vous ajouté.');
}

async function deleteCommunityJourneyItem(id) {
  if (!confirm('Supprimer uniquement ce rendez-vous ? Les autres rendez-vous de la journée resteront intacts.')) return;
  const { error } = await initSupabase().from('community_journey_items').delete().eq('id', id);
  if (error) return alert(error.message);
  if (document.getElementById('journeyItemId')?.value === id) mtJourneyResetForm();
  await loadCommunityJourneyAdmin();
}


async function loadCommunityJourneySettings() {
  const form = document.getElementById('journeySettingsForm');
  if (!form) return;
  const sb=initSupabase(),targetDate=mtJourneyAdminDate();
  const [globalResult,dayResult]=await Promise.all([
    sb.from('community_journey_settings').select('*').eq('id',1).maybeSingle(),
    sb.from('community_journey_day_settings').select('title,subtitle').eq('journey_date',targetDate).maybeSingle()
  ]);
  if (globalResult.error) return mtJourneySetStatus(globalResult.error.message, true);
  const s = globalResult.data || {},day=dayResult.data||{};
  document.getElementById('journeySettingsTitle').value = day.title || s.title || 'Notre journée ensemble';
  document.getElementById('journeySettingsSubtitle').value = day.subtitle || s.subtitle || 'Les rendez-vous de la communauté au rythme de ta journée.';
  document.getElementById('journeySettingsMemberCount').checked = s.show_member_count !== false;
  document.getElementById('journeySettingsThreshold').value = Number(s.member_count_threshold ?? 20);
  document.getElementById('journeySettingsLowText').value = s.low_member_text || 'La communauté avance avec toi';
  document.getElementById('journeySettingsCountedText').value = s.counted_member_text || '{count} membres avancent avec toi';
  document.getElementById('journeySettingsTimezone').value = s.timezone_mode || 'local';
  document.getElementById('journeySettingsEmpty').value = s.empty_message || 'La journée se vit plus librement aujourd’hui.';
  document.getElementById('journeySettingsProfile').checked = s.show_profile_progress !== false;
  document.getElementById('journeySettingsProfileLabel').value = s.profile_label || 'Notre journée';
  document.getElementById('journeySettingsWeekly').checked = s.show_weekly_stats !== false;
  document.getElementById('journeySettingsMonthly').checked = s.show_monthly_stats !== false;
  document.getElementById('journeySettingsCalendar').checked = s.show_calendar_participation !== false;
  document.getElementById('journeySettingsPastView').checked = s.allow_past_view !== false;
  document.getElementById('journeySettingsRetroactive').checked = s.allow_retroactive === true;
  document.getElementById('journeySettingsHistoryDays').value = Number(s.history_days || 365);
}

async function saveCommunityJourneySettings(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  const payload = {
    id: 1,
    show_member_count: fd.get('show_member_count') === 'on',
    member_count_threshold: Math.max(0, Number(fd.get('member_count_threshold') || 20)),
    low_member_text: String(fd.get('low_member_text') || '').trim() || 'La communauté avance avec toi',
    counted_member_text: String(fd.get('counted_member_text') || '').trim() || '{count} membres avancent avec toi',
    timezone_mode: String(fd.get('timezone_mode') || 'local'),
    empty_message: String(fd.get('empty_message') || '').trim() || 'La journée se vit plus librement aujourd’hui.',
    show_profile_progress: fd.get('show_profile_progress') === 'on',
    profile_label: String(fd.get('profile_label') || '').trim() || 'Notre journée',
    show_weekly_stats: fd.get('show_weekly_stats') === 'on',
    show_monthly_stats: fd.get('show_monthly_stats') === 'on',
    show_calendar_participation: fd.get('show_calendar_participation') === 'on',
    allow_past_view: fd.get('allow_past_view') === 'on',
    allow_retroactive: fd.get('allow_retroactive') === 'on',
    history_days: Math.min(3650, Math.max(30, Number(fd.get('history_days') || 365))),
    updated_at: new Date().toISOString()
  };
  mtJourneySetStatus('Enregistrement des réglages…');
  const sb=initSupabase(),targetDate=mtJourneyAdminDate();
  const dayPayload={journey_date:targetDate,title:String(fd.get('title')||'').trim()||null,subtitle:String(fd.get('subtitle')||'').trim()||null,updated_at:new Date().toISOString()};
  const [globalResult,dayResult]=await Promise.all([
    sb.from('community_journey_settings').upsert(payload,{onConflict:'id'}),
    sb.from('community_journey_day_settings').upsert(dayPayload,{onConflict:'journey_date'})
  ]);
  const error=globalResult.error||dayResult.error;
  if (error) { mtJourneySetStatus(error.message, true); return alert(error.message); }
  mtJourneySetStatus('Réglages enregistrés pour cette journée.');
}

async function duplicateCommunityJourneyDay() {
  const source = mtJourneyAdminDate();
  const target = document.getElementById('journeyDuplicateTarget')?.value;
  if (!target) return alert('Choisis une date de destination.');
  if (target === source) return alert('La date de destination doit être différente.');
  if (!confirm(`Dupliquer les rendez-vous du ${source} vers le ${target} ?`)) return;
  mtJourneySetStatus('Duplication de la journée…');
  const { data, error } = await initSupabase().rpc('community_journey_duplicate_day', { source_date: source, target_date: target });
  if (error) { mtJourneySetStatus(error.message, true); return alert(error.message); }
  mtJourneySetStatus(`${Number(data || 0)} rendez-vous dupliqués vers le ${target}.`);
  alert(`${Number(data || 0)} rendez-vous ont été dupliqués.`);
}

window.editCommunityJourneyItem = editCommunityJourneyItem;
window.deleteCommunityJourneyItem = deleteCommunityJourneyItem;

document.addEventListener('DOMContentLoaded', () => {
  const date = document.getElementById('journeyAdminDate');
  if (date && !date.value) date.value = mtJourneyLocalDateISO();
  document.getElementById('journeyLoadDate')?.addEventListener('click', () => {
    mtJourneyResetForm();
    loadCommunityJourneyAdmin();
    loadCommunityJourneySettings();
  });
  date?.addEventListener('change', () => {
    mtJourneyResetForm();
    loadCommunityJourneyAdmin();
    loadCommunityJourneySettings();
  });
  document.getElementById('journeyItemForm')?.addEventListener('submit', saveCommunityJourneyItem);
  document.getElementById('journeyCancelEdit')?.addEventListener('click', mtJourneyResetForm);
  document.getElementById('journeySettingsForm')?.addEventListener('submit', saveCommunityJourneySettings);
  document.getElementById('journeyDuplicateButton')?.addEventListener('click', duplicateCommunityJourneyDay);
  loadCommunityJourneySettings();
});
