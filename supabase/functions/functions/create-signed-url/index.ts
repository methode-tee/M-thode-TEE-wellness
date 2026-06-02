import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest, isAdminEmail } from "../_shared/auth.ts";
import { rateLimit, logSecurityEvent } from "../_shared/security.ts";

function extractStoragePath(urlOrPath: string) {
  if (!urlOrPath) return "";
  if (!urlOrPath.startsWith("http")) return urlOrPath;
  const marker = "/storage/v1/object/public/protocol-files/";
  const i = urlOrPath.indexOf(marker);
  if (i === -1) return "";
  return decodeURIComponent(urlOrPath.slice(i + marker.length));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    await rateLimit(user.id, "create_signed_url", 40, 60);

    const { content_id } = await req.json();
    if (!content_id) throw new Error("MISSING_CONTENT_ID");

    const supabase = getAdminClient();

    const { data: content, error } = await supabase
      .from("protocol_contents")
      .select("*, protocols(title)")
      .eq("id", content_id)
      .maybeSingle();

    if (error || !content) throw new Error("CONTENT_NOT_FOUND");

    const admin = isAdminEmail(user.email);

    if (!admin) {
      const { data: access } = await supabase
        .from("user_protocols")
        .select("id")
        .eq("user_id", user.id)
        .eq("protocol_id", content.protocol_id)
        .eq("status", "active")
        .maybeSingle();

      if (!access) throw new Error("ACCESS_DENIED");
    }

    const storagePath = extractStoragePath(content.file_path || content.file_url || content.public_url || "");
    if (!storagePath) {
      if (content.video_url || content.public_url) {
        await logSecurityEvent(user.id, "external_file_opened", { content_id });
        return new Response(JSON.stringify({ signed_url: content.video_url || content.public_url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("NO_STORAGE_PATH");
    }

    const { data, error: signedError } = await supabase.storage
      .from("protocol-files")
      .createSignedUrl(storagePath, 60 * 10);

    if (signedError || !data?.signedUrl) throw new Error("SIGNED_URL_FAILED");

    await logSecurityEvent(user.id, "signed_url_created", { content_id });

    return new Response(JSON.stringify({ signed_url: data.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    return new Response(JSON.stringify({ error: message }), {
      status: message === "RATE_LIMITED" ? 429 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
