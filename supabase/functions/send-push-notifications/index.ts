// =========================================================
// MÉTHODE TEE V19.4 — send-push-notifications
// Déployer avec:
// supabase functions deploy send-push-notifications
//
// Secrets requis:
// supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:hello@methodetee.app" SUPABASE_SERVICE_ROLE_KEY="..."
// =========================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@methodetee.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    const title = body.title || "Méthode Tee";
    const message = body.body || "Ton rituel du jour t’attend 🌿";
    const url = body.url || "/protocols.html";

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("enabled", true);

    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const row of subs || []) {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({
          title,
          body: message,
          url,
          icon: "/assets/app-icon-192.png",
          badge: "/assets/app-icon-192.png",
          tag: "methode-tee-rituel"
        }));
        sent++;
      } catch (err) {
        failed++;
        console.error("Push failed", row.id, err);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed }), {
      headers: { "content-type": "application/json" }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
});
