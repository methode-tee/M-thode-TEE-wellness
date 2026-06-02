let MT_ADMIN_PROTOCOLS = [];
let MT_ADMIN_PAGES = [];

function slugify(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function escapeHTML(value) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

async function unlockAdmin() {
  const code = document.getElementById("adminCode").value.trim();
  const msg = document.getElementById("adminMsg");
  if (code !== window.MT_CONFIG.ADMIN_ACCESS_CODE) {
    msg.textContent = "Code incorrect.";
    return;
  }
  const ok = await mtIsAdmin();
  if (!ok) {
    msg.textContent = "Connecte-toi avec l’email admin.";
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
  fillSelects();
}

async function uploadToBucket(bucket, file, folder = "admin") {
  if (!file || !file.name) return null;
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${folder}/${Date.now()}-${safe}`;
  const client = initSupabase();
  const { error } = await client.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

/* POSTS */
async function loadPosts() {
  const list = document.getElementById("postsList");
  if (!list) return;
  const { data, error } = await initSupabase()
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    list.innerHTML = `<p class="admin-error">${error.message}</p>`;
    return;
  }

  list.innerHTML = (data || []).map(p => `<article class="admin-row-card">
    <div><strong>${escapeHTML(p.title || "Sans titre")}</strong><small>${escapeHTML(p.type || "Journal")} · ${p.active ? "visible" : "masqué"}</small></div>
    <button type="button" onclick="editPost('${p.id}')">Modifier</button>
    <button type="button" onclick="togglePost('${p.id}', ${p.active ? "false" : "true"})">${p.active ? "Masquer" : "Afficher"}</button>
    <button type="button" class="danger" onclick="deletePost('${p.id}')">Supprimer</button>
  </article>`).join("") || `<p class="admin-empty">Aucun post.</p>`;
}

async function editPost(id) {
  const { data, error } = await initSupabase().from("posts").select("*").eq("id", id).maybeSingle();
  if (error || !data) return alert("Post introuvable.");
  document.getElementById("postId").value = data.id;
  document.getElementById("postTitle").value = data.title || "";
  document.getElementById("postType").value = data.type || "Journal";
  document.getElementById("postContent").value = data.content || "";
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
  ["postId","postTitle","postContent","postMediaUrls","postMediaFiles"].forEach(id => {
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
async function loadProtocols() {
  const list = document.getElementById("protocolsList");
  const { data, error } = await initSupabase().from("protocols").select("*").order("created_at", { ascending:false });
  MT_ADMIN_PROTOCOLS = !error && data?.length ? data : [];
  if (!list) return;
  list.innerHTML = MT_ADMIN_PROTOCOLS.map(p => `<article class="admin-row-card">
    <div><strong>${escapeHTML(p.emoji || "🌿")} ${escapeHTML(p.title || "Sans titre")}</strong><small>${escapeHTML(p.category || "")} · ${((p.price_cents || 0)/100).toFixed(2)}€ · ${p.active ? "visible" : "masqué"}</small></div>
    <button type="button" onclick="editProtocol('${p.id}')">Modifier</button>
    <button type="button" onclick="toggleProtocol('${p.id}', ${p.active ? "false" : "true"})">${p.active ? "Masquer" : "Afficher"}</button>
  </article>`).join("") || `<p class="admin-empty">Aucun protocole.</p>`;
}

function editProtocol(id) {
  const p = MT_ADMIN_PROTOCOLS.find(x => x.id === id);
  if (!p) return;
  document.getElementById("protocolId").value = p.id;
  document.getElementById("protocolTitle").value = p.title || "";
  document.getElementById("protocolSubtitle").value = p.subtitle || "";
  document.getElementById("protocolCategory").value = p.category || "pharmacie_vegetale";
  document.getElementById("protocolEmoji").value = p.emoji || "";
  document.getElementById("protocolShort").value = p.short_description || "";
  document.getElementById("protocolLong").value = p.long_description || "";
  document.getElementById("protocolPrice").value = p.price_cents || 500;
  document.getElementById("protocolDuration").value = p.duration_label || "";
  document.getElementById("protocolPayment").value = p.payment_link || "";
  document.getElementById("protocolImageUrl").value = p.image_url || "";
  window.scrollTo({ top: document.getElementById("protocolForm").offsetTop - 90, behavior: "smooth" });
}

async function toggleProtocol(id, active) {
  const { error } = await initSupabase().from("protocols").update({ active }).eq("id", id);
  if (error) return alert(error.message);
  loadProtocols();
}

function resetProtocolForm() {
  ["protocolId","protocolTitle","protocolSubtitle","protocolEmoji","protocolShort","protocolLong","protocolDuration","protocolPayment","protocolImageUrl","protocolImageFile"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("protocolPrice").value = 500;
  document.getElementById("protocolCategory").value = "pharmacie_vegetale";
}

/* CONTENTS */
async function loadContents() {
  const list = document.getElementById("contentsList");
  if (!list) return;
  const { data, error } = await initSupabase()
    .from("protocol_contents")
    .select("*, protocols(title)")
    .order("created_at", { ascending:false })
    .limit(100);

  if (error) {
    list.innerHTML = `<p class="admin-error">${error.message}</p>`;
    return;
  }

  list.innerHTML = (data || []).map(c => `<article class="admin-row-card">
    <div><strong>${escapeHTML(c.title || "Sans titre")}</strong><small>${escapeHTML(c.type || "document")} · ${escapeHTML(c.protocols?.title || "Protocole")}</small></div>
    <button type="button" onclick="editContent('${c.id}')">Modifier</button>
    <button type="button" class="danger" onclick="deleteContent('${c.id}')">Supprimer</button>
  </article>`).join("") || `<p class="admin-empty">Aucun contenu.</p>`;
}

async function editContent(id) {
  const { data, error } = await initSupabase().from("protocol_contents").select("*").eq("id", id).maybeSingle();
  if (error || !data) return alert("Contenu introuvable.");
  document.getElementById("contentId").value = data.id;
  document.getElementById("protocolSelect").value = data.protocol_id;
  document.getElementById("contentType").value = data.type || "document";
  document.getElementById("contentTitle").value = data.title || "";
  document.getElementById("contentDescription").value = data.description || "";
  document.getElementById("contentVideo").value = data.video_url || "";
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
  ["contentId","contentTitle","contentDescription","contentVideo","contentPublicUrl","contentFile"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("contentOrder").value = 10;
  document.getElementById("contentType").value = "document";
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
    protocol_id: protocolId,
    status: "active",
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

  const pageSelect = document.getElementById("sectionPageId");
  if (pageSelect) pageSelect.innerHTML = MT_ADMIN_PAGES.map(p => `<option value="${p.id}">${escapeHTML(p.emoji || "")} ${escapeHTML(p.label || p.title || p.slug)}</option>`).join("");
}

/* FORMS */
document.addEventListener("DOMContentLoaded", () => {
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
    const row = {
      title: fd.get("title"),
      content: fd.get("content"),
      type: fd.get("type") || "Journal",
      media_urls: urls,
      image_url: urls[0] || null,
      active: true,
      created_by: user.id
    };

    const q = id ? initSupabase().from("posts").update(row).eq("id", id) : initSupabase().from("posts").insert(row);
    const { error } = await q;
    if (error) return alert(error.message);

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
    const id = fd.get("id");
    const title = fd.get("title");
    let image_url = fd.get("image_url") || null;
    const file = fd.get("image_file");

    if (file && file.name) image_url = await uploadToBucket(window.MT_CONFIG.PROTOCOL_MEDIA_BUCKET || "protocol-media", file, user.id);

    const row = {
      title,
      slug: slugify(title),
      subtitle: fd.get("subtitle"),
      category: fd.get("category"),
      emoji: fd.get("emoji"),
      short_description: fd.get("short_description"),
      long_description: fd.get("long_description"),
      price_cents: Number(fd.get("price_cents") || 500),
      duration_label: fd.get("duration_label"),
      payment_link: fd.get("payment_link"),
      image_url,
      active: true,
      created_by: user.id
    };

    const q = id ? initSupabase().from("protocols").update(row).eq("id", id) : initSupabase().from("protocols").insert(row);
    const { error } = await q;
    if (error) return alert(error.message);

    alert(id ? "Protocole modifié." : "Protocole créé.");
    resetProtocolForm();
    refreshAdmin();
  });

  const contentForm = document.getElementById("contentForm");
  if (contentForm) contentForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(contentForm);
    const id = fd.get("id");
    const file = fd.get("file");
    let public_url = fd.get("public_url") || fd.get("video_url") || null;

    if (file && file.name) public_url = await uploadToBucket(window.MT_CONFIG.PROTOCOL_FILES_BUCKET || "protocol-files", file, fd.get("protocol_id"));

    const row = {
      protocol_id: fd.get("protocol_id"),
      type: fd.get("type"),
      title: fd.get("title"),
      description: fd.get("description"),
      video_url: fd.get("video_url"),
      public_url,
      file_url: public_url,
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
