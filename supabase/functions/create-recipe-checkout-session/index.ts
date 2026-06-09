import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");

    const user = await getUserFromRequest(req);
    const body = await req.json();

    const recipeId = body.recipe_id || body.recipeId || body.id;
    if (!recipeId) throw new Error("MISSING_RECIPE_ID");

    const supabase = getAdminClient();

    const { data: recipe, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", recipeId)
      .eq("active", true)
      .maybeSingle();

    if (error || !recipe) throw new Error("RECIPE_NOT_FOUND");
    if (!recipe.is_premium) throw new Error("RECIPE_IS_FREE");

    const appUrl = (Deno.env.get("APP_URL") || "https://methodetee.app").replace(/\/$/, "");

    const lineItem = recipe.stripe_price_id
      ? { price: recipe.stripe_price_id, quantity: 1 }
      : {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Méthode Tee — ${recipe.title}`,
              description: recipe.subtitle || recipe.category || "Recette premium",
              images: recipe.image_url ? [recipe.image_url] : [],
            },
            unit_amount: Number(recipe.price_cents || 500),
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email || undefined,
      line_items: [lineItem],
      metadata: {
        purchase_type: "recipe",
        user_id: user.id,
        user_email: user.email || "",
        recipe_id: recipe.id,
      },
      success_url: `${appUrl}/page.html?slug=recettes&payment=success&recipe=${recipe.id}`,
      cancel_url: `${appUrl}/page.html?slug=recettes&payment=cancelled`,
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
