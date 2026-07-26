function initSupabase() {
  if (!window.MT_CONFIG || !window.MT_CONFIG.USE_SUPABASE || !window.supabase) return null;
  if (window.mtSupabase) return window.mtSupabase;
  window.mtSupabase = window.supabase.createClient(
    window.MT_CONFIG.SUPABASE_URL,
    window.MT_CONFIG.SUPABASE_ANON_KEY
  );
  return window.mtSupabase;
}

let mtUserCache = { user: null, at: 0, promise: null };

async function mtGetUser() {
  const client = initSupabase();
  if (!client) return null;

  const now = Date.now();
  if (mtUserCache.user && now - mtUserCache.at < 10000) return mtUserCache.user;
  if (mtUserCache.promise) return mtUserCache.promise;

  mtUserCache.promise = client.auth.getUser()
    .then(({ data }) => {
      mtUserCache.user = data?.user || null;
      mtUserCache.at = Date.now();
      return mtUserCache.user;
    })
    .catch(() => null)
    .finally(() => { mtUserCache.promise = null; });

  return mtUserCache.promise;
}

(function mtInvalidateUserCacheOnAuthChange(){
  const client = initSupabase();
  if (!client?.auth?.onAuthStateChange) return;
  client.auth.onAuthStateChange((_event, session) => {
    mtUserCache.user = session?.user || null;
    mtUserCache.at = Date.now();
    mtUserCache.promise = null;
  });
})();

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

async function mtIsReviewUser() {
  const user = await mtGetUser();
  if (!user?.email) return false;
  return (window.MT_CONFIG.REVIEW_EMAILS || []).map(x => x.toLowerCase()).includes(user.email.toLowerCase());
}

async function mtHasFullPreviewAccess() {
  return (await mtIsAdmin()) || (await mtIsReviewUser());
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
  const fullPreview = typeof mtHasFullPreviewAccess === "function" ? await mtHasFullPreviewAccess() : await mtIsAdmin();
  if (fullPreview) return true;
  const profile = await mtGetProfile();
  return !!profile?.has_app_access;
}
