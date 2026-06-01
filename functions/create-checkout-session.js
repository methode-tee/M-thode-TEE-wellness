// Netlify Function — create-checkout-session.js
// Installer : npm install stripe @supabase/supabase-js

const Stripe = require("stripe");

exports.handler = async (event) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { guideId, priceId, userId } = JSON.parse(event.body || "{}");

    if (!guideId || !priceId || !userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Paramètres manquants" }) };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.SITE_URL}/guide.html?id=${guideId}&success=true`,
      cancel_url: `${process.env.SITE_URL}/guide.html?id=${guideId}&canceled=true`,
      metadata: {
        guide_id: guideId,
        user_id: userId
      }
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
