import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest, isAdminEmail } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/security.ts";

function escapeHTML(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/conseil\s+du\s+coach/gi, "Note de Tee")
    .replace(/note\s+du\s+coach/gi, "Note de Tee")
    .replace(/coach/gi, "Tee")
    .trim();
}

function splitLines(raw: string) {
  return String(raw || "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function plainSections(recipe: Record<string, any>) {
  const raw = recipe.full_content || recipe.content_text || recipe.description || "";
  const lines = splitLines(raw);
  const ingredients: string[] = [];
  const preparation: string[] = [];
  const notes: string[] = [];
  let current = "notes";

  for (const line of lines) {
    const low = line.toLowerCase();
    if (low.includes("ingrédient") || low.includes("ingredient")) {
      current = "ingredients";
      continue;
    }
    if (low.includes("préparation") || low.includes("preparation") || low.includes("étape") || low.includes("etape")) {
      current = "preparation";
      continue;
    }
    if (low.includes("conseil") || low.includes("rituel") || low.includes("note")) {
      current = "notes";
      continue;
    }

    if (current === "ingredients") ingredients.push(line);
    else if (current === "preparation") preparation.push(line);
    else notes.push(line);
  }

  if (!ingredients.length && !preparation.length && lines.length) preparation.push(...lines);
  return { ingredients, preparation, notes };
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function safeFileName(value: string) {
  return String(value || "recette")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function buildRecipeHTML(recipe: Record<string, any>, carnetNumber: string) {
  const { ingredients, preparation, notes } = plainSections(recipe);

  const title = recipe.title || "Recette Méthode Tee";
  const subtitle = recipe.subtitle || recipe.description || "Une recette privée pensée comme un rituel simple, doux et intentionnel.";
  const category = recipe.category || "Recette";
  const mood = recipe.mood || recipe.intention || "Rituel";
  const access = recipe.is_premium ? "Débloquée" : "Libre";
  const imageUrl = recipe.image_url || "";
  const noteText = cleanText(notes.length ? notes.join(" ") : "À savourer lentement, comme une pause. L’intention compte autant que la recette.");

  const ingredientItems = (ingredients.length ? ingredients : ["Ingrédients à retrouver dans la fiche recette."])
    .map((item, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span><p>${escapeHTML(cleanText(item).replace(/^[-•*]\s*/, ""))}</p></li>`)
    .join("");

  const prep = preparation.length ? preparation : ["Prépare la recette en suivant les indications de ta fiche privée."];
  const prepChunks = chunk(prep, 4);

  const imageBlock = imageUrl
    ? `<figure class="recipe-photo"><img src="${escapeHTML(imageUrl)}" alt=""></figure>`
    : `<figure class="recipe-photo fallback"><span>Recette</span></figure>`;

  const prepPages = prepChunks.map((part, pageIndex) => {
    const items = part.map((item, i) => {
      const n = pageIndex * 4 + i + 1;
      const clean = cleanText(item).replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, "");
      return `<li><span>${String(n).padStart(2, "0")}</span><p>${escapeHTML(clean)}</p></li>`;
    }).join("");

    return `<section class="page page-dark">
      <div class="gold-orb orb-right"></div>
      <div class="page-inner">
        <header class="section-head">
          <small>Préparation</small>
          <h2>${pageIndex === 0 ? "Le rituel" : "La suite"}</h2>
        </header>
        <div class="white-card steps-card">
          <ol class="clean-list steps-list">${items}</ol>
        </div>
        ${pageIndex === prepChunks.length - 1 ? `<div class="white-card note-card"><small>Note de Tee</small><p>${escapeHTML(noteText)}</p></div>` : ""}
      </div>
      <footer><span>${escapeHTML(title)}</span><span>Page ${3 + pageIndex}</span></footer>
    </section>`;
  }).join("");

  const lastPage = 3 + prepChunks.length;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHTML(title)} · Méthode Tee</title>
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;font-family:Inter,Arial,sans-serif;color:#17130f;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;background:#fbf6ea;padding:16mm}
.page:last-child{page-break-after:auto}
.page:before{content:"";position:absolute;inset:10mm;border:1px solid rgba(188,148,74,.22);border-radius:24px;pointer-events:none}
.page-dark{background:#050606;color:#fbf6ea}
.page-dark:before{border-color:rgba(188,148,74,.24)}
.page-inner{position:relative;z-index:2;height:100%}
.gold-orb{position:absolute;z-index:1;width:145mm;height:145mm;border-radius:50%;background:#bd9445;opacity:.96}
.orb-left{left:-42mm;top:23mm}
.orb-right{right:-52mm;top:-18mm}
.orb-soft{right:-40mm;bottom:-34mm;background:#eadfc9;opacity:.92}
.brand{display:flex;align-items:flex-start;justify-content:space-between;position:relative;z-index:2;margin-bottom:16mm}
.logo{font:italic 24px Georgia,serif;color:#17483e}
.sub{margin-top:3px;font-size:7px;letter-spacing:.34em;text-transform:uppercase;font-weight:800;color:#8a7868}
.pill{border:1px solid rgba(23,72,62,.18);border-radius:999px;padding:8px 12px;background:rgba(255,255,255,.76);font-size:7px;text-transform:uppercase;letter-spacing:.22em;font-weight:900;color:#17483e}
.kicker{font-size:8px;letter-spacing:.35em;text-transform:uppercase;font-weight:900;color:#b99149;margin-bottom:9mm}
.cover-title{position:relative;z-index:2;margin:0 0 5mm;font:400 37px/.96 Georgia,serif;letter-spacing:-.035em;max-width:142mm}
.cover-title em{display:block;color:#17483e;font-style:italic}
.subtitle{position:relative;z-index:2;margin:0 0 9mm;color:#705f52;font-size:11px;line-height:1.45;max-width:135mm}
.recipe-photo{position:relative;z-index:2;margin:0;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.35);height:82mm;box-shadow:0 18px 38px rgba(0,0,0,.25);background:#eadfc9}
.recipe-photo img{width:100%;height:100%;object-fit:cover;display:block}
.recipe-photo.fallback{display:grid;place-items:center;font:italic 26px Georgia,serif;color:#17483e}
.meta-grid{position:relative;z-index:2;display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:7mm}
.meta{background:rgba(255,255,255,.82);border:1px solid rgba(188,148,74,.18);border-radius:12px;text-align:center;padding:5mm 2mm;color:#17483e}
.meta strong{font:400 13px/1.05 Georgia,serif;display:block}
.meta span{display:block;margin-top:3px;font-size:6px;letter-spacing:.22em;text-transform:uppercase;font-weight:900;color:#8a7868}
.quote{position:relative;z-index:2;margin-top:7mm;background:#17483e;color:#fffdf7;border-radius:14px;padding:6mm 8mm;font:italic 13px/1.4 Georgia,serif}
.section-head{margin-bottom:9mm}
.section-head small,.note-card small{display:block;color:#b99149;text-transform:uppercase;letter-spacing:.35em;font-size:8px;font-weight:900;margin-bottom:4mm}
.section-head h2{margin:0;font:400 35px/1 Georgia,serif;color:#17483e}
.page-dark .section-head h2{color:#17483e}
.ribbon{height:55mm;border-radius:15px;overflow:hidden;margin-bottom:9mm;box-shadow:0 12px 30px rgba(0,0,0,.16)}
.ribbon img{width:100%;height:100%;object-fit:cover}
.white-card{position:relative;z-index:2;background:rgba(255,255,255,.88);border-radius:18px;padding:8mm;border:1px solid rgba(23,72,62,.08);box-shadow:0 16px 36px rgba(0,0,0,.12);color:#17130f;margin-bottom:8mm}
.clean-list{margin:0;padding:0;list-style:none}
.clean-list li{display:grid;grid-template-columns:12mm 1fr;gap:6mm;align-items:start;margin-bottom:5mm;break-inside:avoid}
.clean-list li:last-child{margin-bottom:0}
.clean-list span{width:9mm;height:9mm;border-radius:999px;display:grid;place-items:center;background:#e8ebe5;color:#17483e;font-size:7px;font-weight:900;margin-top:.5mm}
.steps-list span{background:#17483e;color:#fff}
.clean-list p{margin:0;font-size:12px;line-height:1.42}
.steps-list p{font-size:11px;line-height:1.42}
.note-card p{margin:0;color:#776558;font:italic 13px/1.5 Georgia,serif}
.ritual-grid{display:grid;grid-template-columns:1fr 62mm;gap:9mm;align-items:center}
.ritual-grid .recipe-photo{height:70mm}
.closing{background:#17483e;color:#fffdf7;border-radius:22px;padding:11mm;margin-top:11mm}
.closing small{display:block;color:#d9be79;font-size:8px;text-transform:uppercase;letter-spacing:.33em;font-weight:900}
.closing h2{margin:6mm 0 5mm;font:400 34px/1 Georgia,serif}
.closing p{margin:0;font-size:12px;line-height:1.6;color:rgba(255,253,247,.82)}
footer{position:absolute;left:16mm;right:16mm;bottom:8mm;display:flex;justify-content:space-between;color:rgba(140,117,97,.72);font-size:7px;z-index:4}
.page-dark footer{color:rgba(255,253,247,.55)}
</style>
</head>
<body>
<section class="page cover">
  <div class="gold-orb orb-left"></div>
  <div class="page-inner">
    <header class="brand">
      <div><div class="logo">Teeyana</div><div class="sub">Nutrition · Plantes · Bien-être</div></div>
      <div class="pill">Recette privée</div>
    </header>
    <div class="kicker">Carnet Signature n°${carnetNumber} · ${escapeHTML(category)}</div>
    <h1 class="cover-title">${escapeHTML(title)}<em>${escapeHTML(mood)}</em></h1>
    <p class="subtitle">${escapeHTML(subtitle)}</p>
    ${imageBlock}
    <div class="meta-grid">
      <div class="meta"><strong>${escapeHTML(category)}</strong><span>Univers</span></div>
      <div class="meta"><strong>${escapeHTML(mood)}</strong><span>Intention</span></div>
      <div class="meta"><strong>${escapeHTML(access)}</strong><span>Accès</span></div>
    </div>
    <div class="quote">Une recette comme un rituel : simple, douce, précise, et pensée pour accompagner ton équilibre au quotidien.</div>
  </div>
  <footer><span>https://methodetee.app</span><span>Page 1</span></footer>
</section>

<section class="page page-dark">
  <div class="gold-orb orb-right"></div>
  <div class="page-inner">
    <header class="section-head"><small>Ingrédients</small><h2>La sélection</h2></header>
    ${imageUrl ? `<div class="ribbon"><img src="${escapeHTML(imageUrl)}" alt=""></div>` : ""}
    <div class="white-card"><ol class="clean-list">${ingredientItems}</ol></div>
  </div>
  <footer><span>${escapeHTML(title)}</span><span>Page 2</span></footer>
</section>

${prepPages}

<section class="page">
  <div class="gold-orb orb-soft"></div>
  <div class="page-inner">
    <header class="section-head"><small>Rituel de dégustation</small><h2>À savourer<br><em>lentement</em></h2></header>
    <div class="ritual-grid">
      <div class="white-card"><ol class="clean-list">
        <li><span>01</span><p>Installe-toi dans un moment calme.</p></li>
        <li><span>02</span><p>Respire avant de commencer.</p></li>
        <li><span>03</span><p>Savoure sans te presser.</p></li>
      </ol></div>
      ${imageUrl ? `<figure class="recipe-photo"><img src="${escapeHTML(imageUrl)}" alt=""></figure>` : ""}
    </div>
    <div class="closing"><small>Carnet Signature n°${carnetNumber}</small><h2>Ta fiche est prête.</h2><p>Merci d’avoir choisi Méthode Tee. Cette fiche fait désormais partie de ta bibliothèque privée.</p></div>
  </div>
  <footer><span>PDF généré depuis ton espace privé</span><span>Page ${lastPage}</span></footer>
</section>
</body>
</html>`;
}

async function renderWithBrowserless(html: string) {
  const token = Deno.env.get("BROWSERLESS_API_KEY") || "";
  const explicitUrl = Deno.env.get("BROWSERLESS_PDF_URL") || "";
  const endpoint = explicitUrl || (token ? `https://chrome.browserless.io/pdf?token=${encodeURIComponent(token)}` : "");

  if (!endpoint) {
    throw new Error("BROWSERLESS_API_KEY_MISSING");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      options: {
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Browserless PDF error", res.status, detail.slice(0, 800));
    throw new Error("PDF_RENDER_FAILED");
  }

  return await res.arrayBuffer();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");

    const user = await getUserFromRequest(req);
    await rateLimit(user.id, "generate_recipe_pdf", 12, 60);

    const { recipe_id } = await req.json();
    if (!recipe_id) throw new Error("MISSING_RECIPE_ID");

    const supabase = getAdminClient();
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", recipe_id)
      .maybeSingle();

    if (recipeError || !recipe) throw new Error("RECIPE_NOT_FOUND");
    if (recipe.active === false) throw new Error("RECIPE_INACTIVE");

    const admin = isAdminEmail(user.email);
    if (!admin && recipe.is_premium) {
      const email = user.email || "";
      let query = supabase
        .from("recipe_purchases")
        .select("id")
        .eq("recipe_id", recipe_id)
        .eq("status", "active")
        .limit(1);

      if (email) query = query.or(`user_id.eq.${user.id},user_email.eq.${email}`);
      else query = query.eq("user_id", user.id);

      const { data: purchase, error: purchaseError } = await query;
      if (purchaseError || !purchase?.length) throw new Error("RECIPE_ACCESS_DENIED");
    }

    const { count } = await supabase
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .lte("created_at", recipe.created_at || new Date().toISOString());

    const carnetNumber = String(Math.max(1, count || 1)).padStart(3, "0");
    const html = buildRecipeHTML(recipe, carnetNumber);
    const pdf = await renderWithBrowserless(html);
    const filename = `Methode_Tee_${safeFileName(recipe.title || String(recipe_id))}.pdf`;

    return new Response(pdf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("generate-recipe-pdf", error);
    return new Response(JSON.stringify({ error: error.message || "PDF_ERROR" }), {
      status: error.message === "RECIPE_ACCESS_DENIED" ? 403 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});