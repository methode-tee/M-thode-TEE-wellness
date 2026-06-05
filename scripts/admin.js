let MT_ADMIN_PROTOCOLS = [];
let MT_ADMIN_PAGES = [];

function slugify(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function escapeHTML(value) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
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
  fillSelects();
  if (typeof loadClubSettingsAdmin === "function") await loadClubSettingsAdmin();
  if (typeof loadCapsulesAdmin === "function") await loadCapsulesAdmin();
  if (typeof loadDropsAdmin === "function") await loadDropsAdmin();
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
  if (document.getElementById("protocolTotalDays")) document.getElementById("protocolTotalDays").value = p.total_days || 21;
  if (document.getElementById("protocolLevelLabel")) document.getElementById("protocolLevelLabel").value = p.level_label || "";
  if (document.getElementById("protocolCertificate")) document.getElementById("protocolCertificate").checked = p.certificate_enabled !== false;
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
  ["protocolId","protocolTitle","protocolSubtitle","protocolEmoji","protocolShort","protocolLong","protocolDuration","protocolPayment","protocolImageUrl","protocolImageFile","protocolLevelLabel"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("protocolPrice").value = 500;
  document.getElementById("protocolCategory").value = "pharmacie_vegetale";
  if (document.getElementById("protocolTotalDays")) document.getElementById("protocolTotalDays").value = 21;
  if (document.getElementById("protocolCertificate")) document.getElementById("protocolCertificate").checked = true;
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
    <div><strong>${escapeHTML(c.title || "Sans titre")}</strong><small>${escapeHTML(c.type || "document")} · ${c.day_number ? "Jour " + c.day_number + " · " : ""}${escapeHTML(c.access_level || "protocol")} · ${escapeHTML(c.protocols?.title || "Protocole")}</small></div>
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
      total_days: Number(fd.get("total_days") || String(fd.get("duration_label") || "").match(/\d+/)?.[0] || 21),
      level_label: fd.get("level_label") || "Exploration",
      certificate_enabled: fd.get("certificate_enabled") === "on",
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


/* V14 ADMIN — Club settings, capsules, drops, member levels */
async function loadClubSettingsAdmin(){const w=document.getElementById('clubSettingsStatus');try{const {data}=await initSupabase().from('club_settings').select('*').limit(1).maybeSingle(); if(data){clubName.value=data.club_name||''; clubSubtitle.value=data.hero_subtitle||''; clubQuote.value=data.quote||''; clubAmbiance.value=data.ambiance||'botanical'; clubStories.checked=data.show_stories!==false; clubDrops.checked=data.show_private_drops!==false;} if(w)w.textContent='Réglages chargés.';}catch(e){if(w)w.textContent=e.message}}
async function saveClubSettings(e){e.preventDefault();const payload={id:1,club_name:clubName.value||'Méthode Tee Club',hero_subtitle:clubSubtitle.value||'',quote:clubQuote.value||'',ambiance:clubAmbiance.value||'botanical',show_stories:clubStories.checked,show_private_drops:clubDrops.checked,updated_at:new Date().toISOString()}; const {error}=await initSupabase().from('club_settings').upsert(payload); if(error)return alert(error.message); alert('Ambiance du club sauvegardée.')}
async function loadCapsulesAdmin(){const list=document.getElementById('capsulesList'); if(!list)return; const {data,error}=await initSupabase().from('club_capsules').select('*').order('sort_order',{ascending:true}); if(error){list.innerHTML='<p>'+error.message+'</p>';return} list.innerHTML=(data||[]).map(c=>`<article class="admin-row-card"><div><strong>${escapeHTML(c.emoji||'✦')} ${escapeHTML(c.title||'Capsule')}</strong><small>${escapeHTML(c.type||'Privé')} · ${c.active?'visible':'masquée'}</small></div><button onclick="deleteCapsule('${c.id}')" class="danger">Supprimer</button></article>`).join('')||'<p class="admin-empty">Aucune capsule.</p>'}
async function deleteCapsule(id){if(!confirm('Supprimer cette capsule ?'))return; const {error}=await initSupabase().from('club_capsules').delete().eq('id',id); if(error)return alert(error.message); loadCapsulesAdmin()}
async function loadDropsAdmin(){const list=document.getElementById('dropsList'); if(!list)return; const {data,error}=await initSupabase().from('private_drops').select('*').order('created_at',{ascending:false}); if(error){list.innerHTML='<p>'+error.message+'</p>';return} list.innerHTML=(data||[]).map(d=>`<article class="admin-row-card"><div><strong>${escapeHTML(d.emoji||'🔒')} ${escapeHTML(d.title||'Drop')}</strong><small>${d.active?'visible':'masqué'}</small></div><button onclick="deleteDrop('${d.id}')" class="danger">Supprimer</button></article>`).join('')||'<p class="admin-empty">Aucun drop privé.</p>'}
async function deleteDrop(id){if(!confirm('Supprimer ce drop ?'))return; const {error}=await initSupabase().from('private_drops').delete().eq('id',id); if(error)return alert(error.message); loadDropsAdmin()}
async function assignMemberLevel(email,level,points,streak){const clean=String(email||'').trim().toLowerCase(); const {data:profile}=await initSupabase().from('profiles').select('*').ilike('email',clean).maybeSingle(); if(!profile)return alert('Profil introuvable.'); const badge=level==='Prestige'?'👑':level==='Gold'?'✨':level==='Silver'?'🤍':'🌿'; const {error}=await initSupabase().from('member_profiles').upsert({user_id:profile.id,level,badge,points:Number(points||0),streak:Number(streak||0),updated_at:new Date().toISOString()},{onConflict:'user_id'}); if(error)return alert(error.message); alert('Niveau membre sauvegardé.')}
document.addEventListener('DOMContentLoaded',()=>{const f=document.getElementById('clubSettingsForm'); if(f)f.addEventListener('submit',saveClubSettings); const cf=document.getElementById('capsuleForm'); if(cf)cf.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(cf); const {error}=await initSupabase().from('club_capsules').insert({title:fd.get('title'),emoji:fd.get('emoji'),type:fd.get('type'),accent:fd.get('accent'),sort_order:Number(fd.get('sort_order')||10),active:true}); if(error)return alert(error.message); cf.reset(); loadCapsulesAdmin()}); const df=document.getElementById('dropForm'); if(df)df.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(df); const {error}=await initSupabase().from('private_drops').insert({title:fd.get('title'),description:fd.get('description'),emoji:fd.get('emoji'),url:fd.get('url'),active:true}); if(error)return alert(error.message); df.reset(); loadDropsAdmin()}); const mf=document.getElementById('memberLevelForm'); if(mf)mf.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(mf); await assignMemberLevel(fd.get('email'),fd.get('level'),fd.get('points'),fd.get('streak')); mf.reset()});});
