import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest, isAdminEmail } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    await rateLimit(user.id, "admin_check", 30, 60);

    const allowed = isAdminEmail(user.email);

    return new Response(JSON.stringify({ admin: allowed, email: user.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: allowed ? 200 : 403,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
