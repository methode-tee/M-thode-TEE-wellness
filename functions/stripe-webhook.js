const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
exports.handler = async (event) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let stripeEvent;
  try { stripeEvent = stripe.webhooks.constructEvent(event.body, event.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) { return { statusCode: 400, body: `Webhook Error: ${err.message}` }; }
  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const userId = session.metadata.user_id, protocolId = session.metadata.protocol_id;
    const { data: protocol } = await supabase.from("protocols").select("duration_days").eq("id", protocolId).single();
    const expires = new Date(Date.now() + (protocol?.duration_days || 7) * 86400000).toISOString();
    await supabase.from("purchases").insert({ user_id:userId, protocol_id:protocolId, stripe_session_id:session.id, amount:(session.amount_total||0)/100, currency:session.currency||"eur", access_expires_at:expires, status:"active" });
  }
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};