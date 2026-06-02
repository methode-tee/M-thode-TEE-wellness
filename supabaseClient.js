function initSupabase() {
  if (!window.MT_CONFIG || !window.MT_CONFIG.USE_SUPABASE || !window.supabase) return null;
  if (window.mtSupabase) return window.mtSupabase;
  window.mtSupabase = window.supabase.createClient(
    window.MT_CONFIG.SUPABASE_URL,
    window.MT_CONFIG.SUPABASE_ANON_KEY
  );
  return window.mtSupabase;
}

async function mtGetUser() {
  const client = initSupabase();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data?.user || null;
}

async function mtRequireUser() {
  const user = await mtGetUser();
  if (!user) {
    location.href = "auth.html";
    return null;
  }
  return user;
}

async function mtIsAdmin() {
  const user = await mtGetUser();
  if (!user?.email) return false;
  return (window.MT_CONFIG.ADMIN_EMAILS || []).map(x => x.toLowerCase()).includes(user.email.toLowerCase());
}

async function mtSignOut() {
  const client = initSupabase();
  if (client) await client.auth.signOut();
  location.href = "auth.html";
}

async function mtGetProfile() {
  const user = await mtGetUser();
  const client = initSupabase();
  if (!user || !client) return null;
  const { data } = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data || null;
}

async function mtHasLimitedAccess() {
  const admin = await mtIsAdmin();
  if (admin) return true;
  const profile = await mtGetProfile();
  return !!profile?.has_app_access;
}
