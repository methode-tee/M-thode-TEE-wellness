let MT_ADMIN_PAGES = [];
let MT_ADMIN_PROTOCOLS = [];

function slugify(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function escapeHTML(value) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
async function unlockAdmin() {
  const code = document.getElementById("adminCode").value.trim();
  const msg = document.getElementById("adminMsg");
  if (code !== window.MT_CONFIG.ADMIN_ACCESS_CODE) { msg.textContent = "Code incorrect."; return; }
  if (!(await mtIsAdmin())) { msg.textContent = "Connecte-toi avec l’email admin."; return; }
  document.getElementById("adminGate").classList.add("hidden");
  document.getElementById("adminPanel").classList.remove("hidden");
  await refreshAdmin();
}
async function refreshAdmin() {
  await loadProtocols();
  await loadPages();
  await loadPosts();
  fillSelects();
}
async function uploadToBucket(bucket, file, folder = "admin") {
  if (!file || !file.name) return null;
  const client = initSupabase();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${folder}/${Date.now()}-${safe}`;
  const { error } = await client.storage.from(bucket).upload(path, file);
  if (error) throw error;
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

/* POSTS */
async function loadPosts() {
  const client = initSupabase();
  const list = document.getElementById("postsList");
  if (!client || !list) return;
  const { data, error } = await client.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) { list.innerHTML = `<p class="admin-error">${error.message}</p>`; return; }
  list.innerHTML = (data || []).map(p => `<article class="admin-row-card">
    <div><strong>${escapeHTML(p.title || "Sans titre")}</strong><small>${escapeHTML(p.type || "Journal")} · ${p.active ? "visible" : "masqué"}</small></div>
    <button onclick="togglePost('${p.id}', ${p.active ? "false" : "true"})">${p.active ? "Masquer" : "Afficher"}</button>
    <button class="danger" onclick="deletePost('${p.id}')">Supprimer</button>
  </article>`).join("") || `<p class="admin-empty">Aucun post.</p>`;
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

/* PAGES */
async function loadPages() {
  const client = initSupabase();
  const { data, error } = await client.from("app_pages").select("*").order("sort_order", { ascending:true });
  MT_ADMIN_PAGES = !error && data?.length ? data : (window.MT_DEFAULT_PAGES || []);
  const list = document.getElementById("pagesList");
  if (!list) return;
  list.innerHTML = MT_ADMIN_PAGES.map(p => `<article class="admin-row-card">
    <div><strong>${escapeHTML(p.emoji || "✦")} ${escapeHTML(p.label || p.title || "Page")}</strong><small>${escapeHTML(p.slug)} · ${escapeHTML(p.system_key || "custom")}</small></div>
    <button onclick="editPage('${p.id}')">Modifier</button>
    ${p.system_key === "custom" ? `<button class="danger" onclick="deletePage('${p.id}')">Supprimer</button>` : `<button disabled>Fixe</button>`}
  </article>`).join("");
}
async function editPage(id) {
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
  await refreshAdmin();
}
function resetPageForm() {
  ["pageId","pageLabel","pageEmoji","pageSlug","pageDescription","pageOrder"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("pageSystemKey").value = "custom";
}

/* SECTIONS */
function fillSelects() {
  const pageSelect = document.getElementById("sectionPageId");
  const protocolSelect = document.getElementById("protocolSelect");
  if (pageSelect) pageSelect.innerHTML = MT_ADMIN_PAGES.map(p => `<option value="${p.id}">${escapeHTML(p.emoji || "")} ${escapeHTML(p.label || p.title)}</option>`).join("");
  if (protocolSelect) protocolSelect.innerHTML = MT_ADMIN_PROTOCOLS.map(p => `<option value="${p.id}">${escapeHTML(p.title)}</option>`).join("");
}
async function loadPageSections() {
  const pageId = document.getElementById("sectionPageId").value;
  const list = document.getElementById("sectionsList");
  if (!pageId || !list) return;
  const { data, error } = await initSupabase().from("page_sections").select("*").eq("page_id", pageId).order("sort_order", { ascending:true });
  if (error) { list.innerHTML = `<p>${error.message}</p>`; return; }
  list.innerHTML = (data || []).map(s => `<article class="admin-row-card">
    <div><strong>${escapeHTML(s.title || "Rubrique")}</strong><small>${escapeHTML(s.type)} · ordre ${s.sort_order || 0}</small></div>
    <button onclick="editSection('${s.id}')">Modifier</button>
    <button class="danger" onclick="deleteSection('${s.id}')">Supprimer</button>
  </article>`).join("") || `<p class="admin-empty">Aucune rubrique.</p>`;
}
async function editSection(id) {
  const { data } = await initSupabase().from("page_sections").select("*").eq("id", id).maybeSingle();
  if (!data) return;
  document.getElementById("sectionId").value = data.id;
  document.getElementById("sectionPageId").value = data.page_id;
  document.getElementById("sectionType").value = data.type || "text";
  document.getElementById("sectionTitle").value = data.title || "";
  document.getElementById("sectionIntro").value = data.intro || "";
  document.getElementById("sectionOrder").value = data.sort_order || 10;
  document.getElementById("sectionPayload").value = typeof data.payload === "string" ? data.payload : JSON.stringify(data.payload || {}, null, 2);
}
async function deleteSection(id) {
  if (!confirm("Supprimer cette rubrique ?")) return;
  const { error } = await initSupabase().from("page_sections").delete().eq("id", id);
  if (error) return alert(error.message);
  loadPageSections();
}
function resetSectionForm() {
  ["sectionId","sectionTitle","sectionIntro","sectionOrder","sectionPayload"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("sectionType").value = "text";
}

/* PROTOCOLS */
async function loadProtocols() {
  const client = initSupabase();
  const { data, error } = await client.from("protocols").select("*").order("created_at", { ascending:false });
  MT_ADMIN_PROTOCOLS = !error && data?.length ? data : [];
  const list = document.getElementById("protocolsList");
  if (!list) return;
  list.innerHTML = MT_ADMIN_PROTOCOLS.map(p => `<article class="admin-row-card">
    <div><strong>${escapeHTML(p.emoji || "🌿")} ${escapeHTML(p.title)}</strong><small>${escapeHTML(p.category)} · ${((p.price_cents || 0)/100).toFixed(2)}€ · ${p.active ? "visible" : "masqué"}</small></div>
    <button onclick="editProtocol('${p.id}')">Modifier</button>
    <button onclick="toggleProtocol('${p.id}', ${p.active ? "false" : "true"})">${p.active ? "Masquer" : "Afficher"}</button>
  </article>`).join("") || `<p class="admin-empty">Aucun protocole.</p>`;
}
async function editProtocol(id) {
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
}
async function toggleProtocol(id, active) {
  const { error } = await initSupabase().from("protocols").update({ active }).eq("id", id);
  if (error) return alert(error.message);
  loadProtocols();
}
function resetProtocolForm() {
  ["protocolId","protocolTitle","protocolSubtitle","protocolEmoji","protocolShort","protocolLong","protocolDuration","protocolPayment","protocolImageUrl","protocolImageFile"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("protocolPrice").value = 500;
  document.getElementById("protocolCategory").value = "pharmacie_vegetale";
}

/* FORMS */
document.addEventListener("DOMContentLoaded", () => {
  const postForm = document.getElementById("postForm");
  if (postForm) postForm.addEventListener("submit", async e => {
    e.preventDefault();
    const user = await mtRequireUser();
    const fd = new FormData(postForm);
    let urls = [];
    for (const file of fd.getAll("media_files")) {
      if (file && file.name) urls.push(await uploadToBucket(window.MT_CONFIG.POST_MEDIA_BUCKET || "post-media", file, user.id));
    }
    const external = String(fd.get("media_urls") || "").split("\n").map(x => x.trim()).filter(Boolean);
    urls = urls.concat(external).filter(Boolean).slice(0,4);
    const { error } = await initSupabase().from("posts").insert({
      title: fd.get("title"),
      content: fd.get("content"),
      type: fd.get("type") || "Journal",
      media_urls: urls,
      image_url: urls[0] || null,
      active: true,
      created_by: user.id
    });
    if (error) return alert(error.message);
    alert("Post publié.");
    postForm.reset();
    loadPosts();
  });

  const pageForm = document.getElementById("pageForm");
  if (pageForm) pageForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(pageForm);
    const id = fd.get("id");
    const label = fd.get("label");
    const row = {
      label,
      title: label,
      emoji: fd.get("emoji") || "✦",
      slug: fd.get("slug") || slugify(label),
      description: fd.get("description"),
      sort_order: Number(fd.get("sort_order") || 10),
      system_key: fd.get("system_key") || "custom",
      active: true
    };
    const q = id ? initSupabase().from("app_pages").update(row).eq("id", id) : initSupabase().from("app_pages").insert(row);
    const { error } = await q;
    if (error) return alert(error.message);
    alert("Page sauvegardée.");
    resetPageForm();
    refreshAdmin();
  });

  const sectionForm = document.getElementById("sectionForm");
  if (sectionForm) sectionForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(sectionForm);
    let payload = {};
    try { payload = fd.get("payload") ? JSON.parse(fd.get("payload")) : {}; } catch(err) { return alert("Payload JSON invalide."); }
    const id = fd.get("id");
    const row = {
      page_id: fd.get("page_id"),
      type: fd.get("type"),
      title: fd.get("title"),
      intro: fd.get("intro"),
      payload,
      sort_order: Number(fd.get("sort_order") || 10),
      active: true
    };
    const q = id ? initSupabase().from("page_sections").update(row).eq("id", id) : initSupabase().from("page_sections").insert(row);
    const { error } = await q;
    if (error) return alert(error.message);
    alert("Rubrique sauvegardée.");
    resetSectionForm();
    loadPageSections();
  });

  const protocolForm = document.getElementById("protocolForm");
  if (protocolForm) protocolForm.addEventListener("submit", async e => {
    e.preventDefault();
    const user = await mtRequireUser();
    const fd = new FormData(protocolForm);
    let image_url = fd.get("image_url") || null;
    const file = fd.get("image_file");
    if (file && file.name) image_url = await uploadToBucket(window.MT_CONFIG.PROTOCOL_MEDIA_BUCKET || "protocol-media", file, user.id);
    const title = fd.get("title");
    const id = fd.get("id");
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
    alert("Protocole sauvegardé.");
    resetProtocolForm();
    refreshAdmin();
  });

  const contentForm = document.getElementById("contentForm");
  if (contentForm) contentForm.addEventListener("submit", async e => {
    e.preventDefault();
    const user = await mtRequireUser();
    const fd = new FormData(contentForm);
    const file = fd.get("file");
    let public_url = fd.get("public_url") || fd.get("video_url") || null;
    if (file && file.name) public_url = await uploadToBucket(window.MT_CONFIG.PROTOCOL_FILES_BUCKET || "protocol-files", file, fd.get("protocol_id"));
    const { error } = await initSupabase().from("protocol_contents").insert({
      protocol_id: fd.get("protocol_id"),
      type: fd.get("type"),
      title: fd.get("title"),
      description: fd.get("description"),
      video_url: fd.get("video_url"),
      public_url,
      active: true,
      sort_order: Number(fd.get("sort_order") || 10),
      created_by: user.id
    });
    if (error) return alert(error.message);
    alert("Contenu ajouté.");
    contentForm.reset();
  });

  const accessForm = document.getElementById("accessForm");
  if (accessForm) accessForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(accessForm);
    const email = fd.get("email").trim().toLowerCase();
    const { data: profile, error: findErr } = await initSupabase().from("profiles").select("*").ilike("email", email).maybeSingle();
    if (findErr || !profile) return alert("Profil introuvable.");
    const { error } = await initSupabase().from("profiles").update({ has_app_access: true }).eq("id", profile.id);
    if (error) return alert(error.message);
    alert("Accès général activé.");
    accessForm.reset();
  });
});
