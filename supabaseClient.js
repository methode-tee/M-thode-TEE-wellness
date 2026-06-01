let mtSupabase = null;

function supabaseReady(){
  const cfg = window.MT_CONFIG || {};
  return cfg.USE_SUPABASE && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_URL.includes("supabase.co");
}

function initSupabase(){
  if(!supabaseReady()) return null;
  if(window.supabase && !mtSupabase){
    mtSupabase = window.supabase.createClient(window.MT_CONFIG.SUPABASE_URL, window.MT_CONFIG.SUPABASE_ANON_KEY);
  }
  return mtSupabase;
}

async function mtGetUser(){
  const client = initSupabase();
  if(client){
    const { data } = await client.auth.getUser();
    return data.user;
  }
  const demo = localStorage.getItem("mt_demo_user");
  return demo ? JSON.parse(demo) : null;
}

async function mtSignUp(email, password, fullName){
  const client = initSupabase();
  if(client){
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if(error) throw error;
    return data.user;
  }
  const user = { id:"demo-user", email, user_metadata:{ full_name: fullName } };
  localStorage.setItem("mt_demo_user", JSON.stringify(user));
  return user;
}

async function mtSignIn(email, password){
  const client = initSupabase();
  if(client){
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if(error) throw error;
    return data.user;
  }
  const user = { id:"demo-user", email, user_metadata:{ full_name: "Teeyana" } };
  localStorage.setItem("mt_demo_user", JSON.stringify(user));
  return user;
}

async function mtSignOut(){
  const client = initSupabase();
  if(client) await client.auth.signOut();
  localStorage.removeItem("mt_demo_user");
}

async function mtGetProfile(){
  const user = await mtGetUser();
  if(!user) return null;
  const client = initSupabase();
  if(client){
    const { data, error } = await client.from("profiles").select("*").eq("id", user.id).single();
    if(error) return null;
    return data;
  }
  return JSON.parse(localStorage.getItem("mt_demo_profile") || "null") || {
    id:user.id,
    email:user.email,
    full_name:user.user_metadata?.full_name || "Teeyana",
    onboarding_completed: localStorage.getItem("mt_onboarding_done") === "true",
    main_goal: localStorage.getItem("mt_main_goal") || null,
    current_state: localStorage.getItem("mt_current_state") || null,
    routine_level: localStorage.getItem("mt_routine_level") || null
  };
}

async function mtSaveProfilePatch(patch){
  const user = await mtGetUser();
  if(!user) throw new Error("Utilisateur non connecté");
  const client = initSupabase();
  if(client){
    const { error } = await client.from("profiles").upsert({ id:user.id, email:user.email, ...patch, updated_at:new Date().toISOString() });
    if(error) throw error;
    return;
  }
  const current = await mtGetProfile() || { id:user.id, email:user.email };
  const next = { ...current, ...patch };
  localStorage.setItem("mt_demo_profile", JSON.stringify(next));
  Object.entries(patch).forEach(([k,v]) => {
    if(k === "onboarding_completed") localStorage.setItem("mt_onboarding_done", v ? "true" : "false");
    else localStorage.setItem("mt_" + k, v);
  });
}

async function mtHasPurchase(guideId){
  const user = await mtGetUser();
  if(!user) return false;
  const client = initSupabase();
  if(client){
    const { data } = await client
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .eq("guide_id", guideId)
      .eq("status", "active")
      .maybeSingle();

    if(!data) return false;
    if(data.access_expires_at && new Date(data.access_expires_at) < new Date()) return false;
    return true;
  }
  const ids = JSON.parse(localStorage.getItem("mt_demo_purchases") || "[]");
  return ids.includes(guideId);
}

async function mtDemoUnlock(guide){
  const user = await mtGetUser();
  if(!user) throw new Error("Connecte-toi d’abord.");
  const client = initSupabase();
  if(client){
    const expires = new Date(Date.now() + (guide.durationDays || 7) * 86400000).toISOString();
    const { error } = await client.from("purchases").insert({
      user_id:user.id,
      guide_id:guide.id,
      amount:guide.price,
      currency:guide.currency || "EUR",
      access_expires_at:expires,
      status:"active"
    });
    if(error) throw error;
    return;
  }
  const ids = JSON.parse(localStorage.getItem("mt_demo_purchases") || "[]");
  if(!ids.includes(guide.id)) ids.push(guide.id);
  localStorage.setItem("mt_demo_purchases", JSON.stringify(ids));
}

async function mtGetPurchases(){
  const user = await mtGetUser();
  if(!user) return [];
  const client = initSupabase();
  if(client){
    const { data, error } = await client.from("purchases").select("*").eq("user_id", user.id).order("created_at", { ascending:false });
    if(error) return [];
    return data || [];
  }
  const ids = JSON.parse(localStorage.getItem("mt_demo_purchases") || "[]");
  return ids.map(id => ({ guide_id:id, status:"active", created_at:new Date().toISOString() }));
}

async function mtCreateGuide(guide, file){
  const client = initSupabase();
  if(!client) {
    const saved = JSON.parse(localStorage.getItem("mt_demo_admin_guides") || "[]");
    saved.push({ ...guide, pdf_path:file ? file.name : null });
    localStorage.setItem("mt_demo_admin_guides", JSON.stringify(saved));
    return { ...guide, pdf_path:file ? file.name : null };
  }

  let pdfPath = null;
  if(file){
    const path = `guides/${guide.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await client.storage.from("guide-pdfs").upload(path, file, { upsert:true });
    if(uploadError) throw uploadError;
    pdfPath = path;
  }

  const { data, error } = await client.from("guides").upsert({ ...guide, pdf_path:pdfPath, active:true }).select().single();
  if(error) throw error;
  return data;
}

async function mtGetSignedPdfUrl(path){
  const client = initSupabase();
  if(!client || !path) return null;
  const { data, error } = await client.storage.from("guide-pdfs").createSignedUrl(path, 60 * 10);
  if(error) throw error;
  return data.signedUrl;
}
