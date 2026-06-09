// AJOUT À PLACER AVANT LE else if (purchaseType === "protocol")

if (purchaseType === "recipe") {

  const recipeId = body.recipe_id;

  if (!recipeId) throw new Error("MISSING_RECIPE_ID");

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", recipeId)
    .maybeSingle();

  if (error || !recipe) throw new Error("RECIPE_NOT_FOUND");

  metadata.recipe_id = recipe.id;

  lineItem = {
    price_data: {
      currency: "eur",
      product_data: {
        name: recipe.title,
        description: recipe.subtitle || "",
        images: recipe.image_url ? [recipe.image_url] : [],
      },
      unit_amount: Number(recipe.price_cents),
    },
    quantity: 1,
  };

}
