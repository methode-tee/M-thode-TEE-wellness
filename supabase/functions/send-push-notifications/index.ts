// =========================================================
// MÉTHODE TEE — send-push-notifications
// Envoie une notification à tous les abonnés push actifs.
// Secrets requis côté Supabase:
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_SERVICE_ROLE_KEY
// =========================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@methodetee.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    const body = await req.json().catch(() => ({}));

    const title = body.title || "Méthode Tee";
    const message = body.body || "Ton rituel du jour t’attend 🌿";
    const url = body.url || "/index.html";

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
          tag: "methode-tee-post",
        }));
        sent++;
      } catch (err) {
        failed++;
        console.error("Push failed", row.id, err);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, total: (subs || []).length }), {
      headers: corsHeaders,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
