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
  loadProtocols();
}

async function loadProtocols() {
  const client = initSupabase();
  const select = document.getElementById("protocolSelect");
  if (!client || !select) return;
  const { data } = await client.from("protocols").select("*").order("created_at", { ascending: false });
  select.innerHTML = (data || []).map(p => `<option value="${p.id}">${p.title}</option>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const protocolForm = document.getElementById("protocolForm");
  if (protocolForm) protocolForm.addEventListener("submit", async e => {
    e.preventDefault();
    const client = initSupabase();
    const user = await mtRequireUser();
    if (!client || !user) return;
    const fd = new FormData(protocolForm);
    const title = fd.get("title");
    const slug = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await client.from("protocols").insert({
      title, slug,
      subtitle: fd.get("subtitle"),
      category: fd.get("category"),
      emoji: fd.get("emoji"),
      short_description: fd.get("short_description"),
      long_description: fd.get("long_description"),
      price_cents: Number(fd.get("price_cents") || 500),
      duration_label: fd.get("duration_label"),
      active: true,
      created_by: user.id
    });
    if (error) return alert(error.message);
    alert("Protocole ajouté. Pense à ajouter son lien Stripe dans config.js.");
    protocolForm.reset();
    loadProtocols();
  });

  const contentForm = document.getElementById("contentForm");
  if (contentForm) contentForm.addEventListener("submit", async e => {
    e.preventDefault();
    const client = initSupabase();
    const user = await mtRequireUser();
    if (!client || !user) return;
    const fd = new FormData(contentForm);
    const file = fd.get("file");
    let file_path = null;
    if (file && file.name) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      file_path = `${fd.get("protocol_id")}/${Date.now()}-${safe}`;
      const { error: upErr } = await client.storage.from("protocol-files").upload(file_path, file);
      if (upErr) return alert(upErr.message);
    }
    const { error } = await client.from("protocol_contents").insert({
      protocol_id: fd.get("protocol_id"),
      type: fd.get("type"),
      title: fd.get("title"),
      description: fd.get("description"),
      video_url: fd.get("video_url"),
      file_path,
      active: true,
      created_by: user.id
    });
    if (error) return alert(error.message);
    alert("Contenu ajouté.");
    contentForm.reset();
  });
});
