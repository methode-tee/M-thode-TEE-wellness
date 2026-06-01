// Netlify Function — stripe-webhook.js
// Valide l'achat Stripe puis insère l'achat dans Supabase.
// Installer : npm install stripe @supabase/supabase-js

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers["stripe-signature"];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const userId = session.metadata.user_id;
    const guideId = session.metadata.guide_id;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Récupère la durée du guide
    const { data: guide } = await supabase
      .from("guides")
      .select("duration_days, price, currency")
      .eq("id", guideId)
      .single();

    const days = guide?.duration_days || 7;
    const expires = new Date(Date.now() + days * 86400000).toISOString();

    await supabase.from("purchases").insert({
      user_id: userId,
      guide_id: guideId,
      stripe_session_id: session.id,
      amount: (session.amount_total || 0) / 100,
      currency: session.currency || "eur",
      access_expires_at: expires,
      status: "active"
    });
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
