import { getAdminClient } from "./auth.ts";

export async function rateLimit(key: string, action: string, limit = 20, windowSeconds = 60) {
  const supabase = getAdminClient();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count } = await supabase
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .eq("actor_key", key)
    .eq("action", action)
    .gte("created_at", since);

  if ((count || 0) >= limit) {
    await logSecurityEvent(key, action + "_rate_limited", { limit, windowSeconds });
    throw new Error("RATE_LIMITED");
  }

  await logSecurityEvent(key, action, {});
}

export async function logSecurityEvent(actorKey: string, action: string, metadata: Record<string, unknown> = {}) {
  const supabase = getAdminClient();
  await supabase.from("security_events").insert({
    actor_key: actorKey,
    action,
    metadata,
  });
}
