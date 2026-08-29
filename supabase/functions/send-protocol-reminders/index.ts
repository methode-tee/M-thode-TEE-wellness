// =========================================================
// MÉTHODE TEE — send-protocol-reminders
// Envoie chaque matin une notification aux abonnés quand
// un nouveau jour de protocole est disponible.
//
// FIX: pas de jointure automatique protocol_progress -> protocols
// car la relation n'est pas déclarée dans le cache Supabase.
// On récupère les protocoles dans une seconde requête.
// =========================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { sendApns, shouldDisableNativeToken } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mt-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("MT_PUSH_INTERNAL_SECRET") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@methodetee.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function secureEqual(left: string, right: string): boolean {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i++) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
}

function authorized(req: Request): boolean {
  const internal = req.headers.get("x-mt-internal-secret") || "";
  if (secureEqual(internal, INTERNAL_SECRET)) return true;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return secureEqual(bearer, SERVICE_ROLE_KEY);
}

function effectiveProtocolDay(progress: any): number {
  const total = Math.max(1, Number(progress?.total_days || 1));
  const rawStart = progress?.started_at || progress?.created_at;

  if (!rawStart) {
    return Math.max(1, Math.min(total, Number(progress?.current_day || 1)));
  }

  const start = new Date(rawStart);
  if (Number.isNaN(start.getTime())) {
    return Math.max(1, Math.min(total, Number(progress?.current_day || 1)));
  }

  const now = new Date();

  const firstUnlock = new Date(start);
  firstUnlock.setDate(firstUnlock.getDate() + 1);
  firstUnlock.setHours(7, 0, 0, 0);

  let timeDay = 1;

  if (now >= firstUnlock) {
    const diff = now.getTime() - firstUnlock.getTime();
    timeDay = 2 + Math.floor(diff / 86400000);
  }

  const manualDay = Math.max(1, Number(progress?.current_day || 1));
  return Math.max(1, Math.min(total, Math.max(manualDay, timeDay)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }),
        { status: 405, headers: corsHeaders },
      );
    }
    if (!authorized(req)) return new Response(JSON.stringify({ok:false,error:"INTERNAL_AUTH_REQUIRED"}),{status:403,headers:corsHeaders});

    const { data: progresses, error } = await admin
      .from("protocol_progress")
      .select("id,user_id,protocol_id,current_day,total_days,started_at,created_at,last_protocol_reminder_day");

    if (error) throw error;

    const protocolIds = Array.from(
      new Set((progresses || []).map((p: any) => p.protocol_id).filter(Boolean)),
    );

    const protocolById = new Map<string, any>();

    if (protocolIds.length > 0) {
      const { data: protocols, error: protocolError } = await admin
        .from("protocols")
        .select("id,title,slug,active")
        .in("id", protocolIds)
        .eq("active", true);

      if (protocolError) throw protocolError;

      for (const protocol of protocols || []) {
        protocolById.set(String(protocol.id), protocol);
      }
    }

    let scanned = 0;
    let eligible = 0;
    let sent = 0;
    let failed = 0;

    for (const progress of progresses || []) {
      scanned++;

      const day = effectiveProtocolDay(progress);
      const total = Math.max(1, Number(progress.total_days || 1));
      const lastDay = Number(progress.last_protocol_reminder_day || 0);

      // Pas de rappel répétitif pour le même jour.
      if (day <= lastDay) continue;
      if (day < 1 || day > total) continue;

      eligible++;

      const protocol = protocolById.get(String(progress.protocol_id));
      // Si le protocole a été supprimé ou désactivé dans l’admin, on ignore la progression.
      if (!protocol) continue;

      const protocolTitle = protocol?.title || "ton protocole";
      const url = `/protocol-journey.html?id=${encodeURIComponent(progress.protocol_id)}&day=${day}#journey-day-${day}`;
      const body = `Ton Jour ${day} est prêt ✨
${protocolTitle}`;

      const [{ data: subs, error: subError }, { data: nativeTokens, error: nativeError }] = await Promise.all([
        admin.from("push_subscriptions").select("id, subscription").eq("enabled", true).eq("user_id", progress.user_id),
        admin.from("native_push_tokens").select("id, token").eq("enabled", true).eq("platform", "ios").eq("user_id", progress.user_id),
      ]);

      if (subError && subError.code !== "42P01") {
        failed++;
        console.error("Subscription query failed", progress.user_id, subError);
        continue;
      }
      if (nativeError && nativeError.code !== "42P01") {
        failed++;
        console.error("Native token query failed", progress.user_id, nativeError);
      }

      for (const sub of subs || []) {
        try {
          await webpush.sendNotification(sub.subscription, JSON.stringify({
            title: "🌿 Méthode Tee", body, url,
            icon: "/assets/app-icon-192.png", badge: "/assets/app-icon-192.png",
            tag: `methode-tee-protocol-${progress.protocol_id}-day-${day}`,
            actions: [{ action: "open", title: "Ouvrir mon rituel" }],
          }));
          sent++;
        } catch (err) { failed++; console.error("Protocol web push failed", sub.id, err); }
      }

      for (const token of nativeTokens || []) {
        try {
          const result = await sendApns(token.token, {
            title: "🌿 Méthode Tee", body, url,
            collapseId: `protocol-${progress.protocol_id}-day-${day}`,
          });
          if (result.ok) sent++;
          else {
            failed++;
            if (shouldDisableNativeToken(result.status, result.reason)) {
              await admin.from("native_push_tokens").update({enabled:false,updated_at:new Date().toISOString()}).eq("id",token.id);
            }
          }
        } catch (err) { failed++; console.error("Protocol APNs failed", token.id, err); }
      }

      await admin
        .from("protocol_progress")
        .update({
          current_day: day,
          last_protocol_reminder_day: day,
          last_protocol_reminder_at: new Date().toISOString(),
        })
        .eq("id", progress.id);
    }

    return new Response(
      JSON.stringify({ ok: true, scanned, eligible, sent, failed }),
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message || err) }),
      { status: 500, headers: corsHeaders },
    );
  }
});
