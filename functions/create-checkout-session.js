const Stripe = require("stripe");
exports.handler = async (event) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { protocolId, priceId, userId } = JSON.parse(event.body || "{}");
    if (!protocolId || !priceId || !userId) return { statusCode: 400, body: JSON.stringify({ error: "Paramètres manquants" }) };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.SITE_URL}/protocol.html?id=${protocolId}&success=true`,
      cancel_url: `${process.env.SITE_URL}/protocol.html?id=${protocolId}&canceled=true`,
      metadata: { protocol_id: protocolId, user_id: userId }
    });
    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};