import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/auth.ts";
import { logSecurityEvent } from "../_shared/security.ts";

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

async function verifyStripeSignature(body: string, signatureHeader: string, webhookSecret: string) {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = new Uint8Array(digest);

  return signatures.some((sig) => timingSafeEqual(expected, hexToBytes(sig)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!signature || !webhookSecret) {
      return new Response(JSON.stringify({ error: "MISSING_SIGNATURE_OR_SECRET" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    const valid = await verifyStripeSignature(body, signature, webhookSecret);

    if (!valid) {
      return new Response(JSON.stringify({ error: "INVALID_STRIPE_SIGNATURE" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);
    const supabase = getAdminClient();

    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      const metadata = session?.metadata || {};
      const userId = metadata.user_id || null;
      const purchaseType = metadata.purchase_type || null;
      const protocolId = metadata.protocol_id || null;
      const userEmail = session.customer_email || session.customer_details?.email || metadata.user_email || null;

      if (purchaseType === "app_access") {
        if (!userId) throw new Error("MISSING_USER_ID_METADATA");

        const { error } = await supabase
          .from("profiles")
          .update({ has_app_access: true })
          .eq("id", userId);
        if (error) throw error;

        await logSecurityEvent(userId, "app_access_granted", { sessionId: session.id });
      }

      // Déblocage protocole : on accepte soit purchase_type=protocol, soit la présence d'un protocol_id.
      // IMPORTANT LIVE : l'app lit surtout user_id + protocol_id + unlocked=true.
      // On enregistre donc les deux identifiants (user_id et user_email) pour éviter tout blocage côté front.
      if (purchaseType === "protocol" || protocolId) {
        if (!protocolId) throw new Error("MISSING_PROTOCOL_ID_METADATA");
        if (!userId) throw new Error("MISSING_USER_ID_METADATA");
        if (!userEmail) throw new Error("MISSING_USER_EMAIL");

        const accessPayload = {
          user_id: userId,
          user_email: userEmail,
          protocol_id: protocolId,
          status: "active",
          unlocked: true,
          purchased_at: new Date().toISOString(),
        };

        // 1) Cas normal : met à jour si la ligne existe déjà, sinon crée la ligne.
        let { error } = await supabase
          .from("user_protocols")
          .upsert(accessPayload, { onConflict: "user_id,protocol_id" });

        // 2) Sécurité LIVE : si une ancienne ligne existe avec user_email mais user_id NULL, on la corrige aussi.
        await supabase
          .from("user_protocols")
          .update(accessPayload)
          .eq("protocol_id", protocolId)
          .ilike("user_email", userEmail);

        // 3) Fallback pour anciennes bases sans contrainte unique user_id/protocol_id.
        if (error) {
          const { error: updateError } = await supabase
            .from("user_protocols")
            .update(accessPayload)
            .eq("user_id", userId)
            .eq("protocol_id", protocolId);

          if (updateError) {
            const { error: insertError } = await supabase.from("user_protocols").insert(accessPayload);
            if (insertError) throw insertError;
          }
        }

        await logSecurityEvent(userId, "protocol_access_granted", {
          sessionId: session.id,
          protocolId,
          userEmail,
        });
      }

      await supabase.from("payments").upsert(
        {
          stripe_session_id: session.id,
          user_id: userId,
          user_email: userEmail,
          purchase_type: purchaseType,
          protocol_id: protocolId,
          amount_total: session.amount_total,
          currency: session.currency,
          status: session.payment_status,
          raw: session,
        },
        { onConflict: "stripe_session_id" },
      );
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "WEBHOOK_ERROR";
    console.error("STRIPE_WEBHOOK_ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
