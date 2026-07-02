// =========================================================
// MÉTHODE TEE — send-protocol-reminders
// Envoie chaque matin une notification aux abonnés quand
// un nouveau jour de protocole est disponible.
//
// Secrets requis côté Supabase :
// SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
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

function effectiveProtocolDay(progress: any): number {
  const total = Math.max(1, Number(progress?.total_days || 1));
  const rawStart = progress?.started_at || progress?.created_at;
  if (!rawStart) return Math.max(1, Math.min(total, Number(progress?.current_day || 1)));

  const start = new Date(rawStart);
  if (Number.isNaN(start.getTime())) return Math.max(1, Math.min(total, Number(progress?.current_day || 1)));

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }), { status: 405, headers: corsHeaders });
    }

    const { data: progresses, error } = await admin
      .from("protocol_progress")
      .select("id,user_id,protocol_id,current_day,total_days,started_at,created_at,last_protocol_reminder_day, protocols(title, slug)");

    if (error) throw error;

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
      const protocolTitle = progress.protocols?.title || "ton protocole";
      const url = `/protocol-journey.html?id=${encodeURIComponent(progress.protocol_id)}`;
      const body = `Jour ${day} · ${protocolTitle}`;

      const { data: subs, error: subError } = await admin
        .from("push_subscriptions")
        .select("id, subscription")
        .eq("enabled", true)
        .eq("user_id", progress.user_id);

      if (subError) {
        failed++;
        console.error("Subscription query failed", progress.user_id, subError);
        continue;
      }

      for (const sub of subs || []) {
        try {
          await webpush.sendNotification(sub.subscription, JSON.stringify({
            title: "🌿 Méthode Tee",
            body,
            url,
            icon: "/assets/app-icon-192.png",
            badge: "/assets/app-icon-192.png",
            tag: `methode-tee-protocol-${progress.protocol_id}-day-${day}`,
          }));
          sent++;
        } catch (err) {
          failed++;
          console.error("Protocol push failed", sub.id, err);
        }
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

    return new Response(JSON.stringify({ ok: true, scanned, eligible, sent, failed }), { headers: corsHeaders });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500, headers: corsHeaders });
  }
});
