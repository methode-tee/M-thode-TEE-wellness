function getGuide(id){
  return (window.MT_DATA?.guides || []).find(g => g.id === id);
}
function params(name){ return new URLSearchParams(location.search).get(name); }
function money(n){ return `${n}€`; }

async function requireAuth(){
  const user = await mtGetUser();
  if(!user && !location.pathname.endsWith("auth.html") && !location.pathname.endsWith("landing.html")){
    location.href = "auth.html";
    return null;
  }
  return user;
}

async function initTopbar(){
  const area = document.querySelector("[data-user-area]");
  if(!area) return;
  const user = await mtGetUser();
  if(user){
    area.innerHTML = `<a href="profile.html">Profil</a><button id="logoutBtn">Sortir</button>`;
    document.getElementById("logoutBtn").onclick = async () => { await mtSignOut(); location.href="landing.html"; };
  } else {
    area.innerHTML = `<a href="auth.html">Connexion</a>`;
  }
}

function initAuth(){
  const form = document.getElementById("authForm");
  if(!form) return;

  let mode = "signin";
  const tabs = document.querySelectorAll(".tab");
  const title = document.getElementById("authTitle");
  const nameField = document.getElementById("nameField");
  const msg = document.getElementById("authMsg");

  tabs.forEach(tab => {
    tab.onclick = () => {
      mode = tab.dataset.mode;
      tabs.forEach(t => t.classList.toggle("active", t === tab));
      title.textContent = mode === "signup" ? "Créer ton compte" : "Connexion";
      nameField.classList.toggle("hidden", mode !== "signup");
      msg.textContent = "";
    };
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    msg.className = "message";
    msg.textContent = "Chargement…";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const fullName = document.getElementById("fullName").value.trim();

    try{
      if(mode === "signup") await mtSignUp(email, password, fullName);
      else await mtSignIn(email, password);

      const profile = await mtGetProfile();
      msg.className = "message success";
      msg.textContent = "Connexion validée.";
      setTimeout(() => {
        location.href = profile?.onboarding_completed ? "index.html" : "onboarding.html";
      }, 500);
    } catch(err){
      msg.className = "message error";
      msg.textContent = err.message || "Erreur de connexion.";
    }
  };
}

async function initOnboarding(){
  const wrap = document.getElementById("onboardingWrap");
  if(!wrap) return;
  await requireAuth();

  const questions = window.MT_DATA.onboardingQuestions;
  let step = 0;
  const answers = {};
  function render(){
    const q = questions[step];
    wrap.innerHTML = `
      <div class="onboarding-card">
        <div class="progress"><div style="width:${((step+1)/questions.length)*100}%"></div></div>
        <div class="section-label" style="text-align:left">Question ${step+1}/${questions.length}</div>
        <h1 class="section-title" style="text-align:left;margin-bottom:20px">${q.title}</h1>
        <div class="option-grid">
          ${q.options.map(o => `
            <button class="option ${answers[q.id] === o.value ? 'active':''}" data-val="${o.value}">
              <span class="emoji">${o.emoji}</span>
              <strong>${o.label}</strong>
            </button>
          `).join("")}
        </div>
        <div class="cta-row" style="justify-content:space-between">
          <button class="btn line" id="backBtn" ${step===0 ? "disabled" : ""}>Retour</button>
          <button class="btn sage" id="nextBtn">${step === questions.length-1 ? "Terminer" : "Continuer"}</button>
        </div>
      </div>
    `;
    wrap.querySelectorAll(".option").forEach(btn => btn.onclick = () => {
      answers[q.id] = btn.dataset.val;
      render();
    });
    document.getElementById("backBtn").onclick = () => { if(step>0){step--; render();} };
    document.getElementById("nextBtn").onclick = async () => {
      if(!answers[q.id]) return alert("Choisis une option.");
      if(step < questions.length-1){ step++; render(); }
      else{
        await mtSaveProfilePatch({
          main_goal: answers.main_goal,
          current_state: answers.current_state,
          routine_level: answers.routine_level,
          onboarding_completed: true
        });
        location.href = "index.html";
      }
    };
  }
  render();
}

function recommendationFor(profile){
  const goal = profile?.main_goal;
  const state = profile?.current_state;
  const guides = window.MT_DATA.guides;

  const match = guides.filter(g => {
    const tags = g.tags || [];
    return tags.includes(goal) || tags.includes(state) ||
      (goal === "cycle" && tags.includes("cycle")) ||
      (goal === "sleep" && tags.includes("sommeil")) ||
      (goal === "digestion" && tags.includes("digestion")) ||
      (goal === "body" && tags.includes("silhouette")) ||
      (goal === "beauty" && tags.includes("beaute"));
  });

  return match.length ? match.slice(0,3) : guides.slice(0,3);
}

async function initDashboard(){
  const dash = document.getElementById("dashboard");
  if(!dash) return;
  const user = await requireAuth();
  if(!user) return;
  const profile = await mtGetProfile();
  if(!profile?.onboarding_completed){
    location.href = "onboarding.html";
    return;
  }

  const name = profile.full_name || user.user_metadata?.full_name || "toi";
  const recos = recommendationFor(profile);

  dash.innerHTML = `
    <section class="dashboard-hero">
      <div class="welcome">
        <h1>Bonjour ${name} 🌿</h1>
        <p>Ton dashboard s’adapte à ton terrain : ${profile.main_goal || "bien-être"} · ${profile.current_state || "équilibre"} · approche ${profile.routine_level || "douce"}.</p>
        <div class="quick-grid">
          <a class="quick" href="catalogue.html?category=comptoir"><span>Besoin immédiat</span><strong>Je traverse quelque chose</strong><small>Accès 3 à 7 jours</small></a>
          <a class="quick" href="catalogue.html?category=objectifs"><span>Transformation</span><strong>J’ai un objectif</strong><small>21 à 28 jours</small></a>
          <a class="quick" href="catalogue.html?category=beaute"><span>Beauté interne</span><strong>Glow & cheveux</strong><small>Terrain, peau, pousse</small></a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-label">Recommandations adaptées</div>
      <h2 class="section-title">Pour ton terrain<br><em>aujourd’hui</em></h2>
      <div class="guide-grid">
        ${recos.map(guideCard).join("")}
      </div>
    </section>

    <section class="section" style="padding-top:20px">
      <div class="grid">
        <article class="card"><div class="card-icon">💧</div><h3>Rituel du jour</h3><p>Hydratation tiède, respiration 5 minutes, repas simple et marche digestive après dîner.</p><span class="badge">Personnalisé</span></article>
        <article class="card"><div class="card-icon">📊</div><h3>Suivi léger</h3><p>Bientôt : énergie, sommeil, digestion, stress et cycle pour affiner les recommandations.</p><span class="badge">À venir</span></article>
      </div>
    </section>
  `;
}

function guideCard(g){
  return `
    <article class="guide-card" onclick="location.href='guide.html?id=${g.id}'">
      <div class="guide-art">${g.emoji}</div>
      <div class="guide-body">
        <h3>${g.title}</h3>
        <p>${g.short}</p>
        <div class="guide-meta">
          <span class="price">${money(g.price)} · ${g.durationDays}j</span>
          <span class="locked">Voir</span>
        </div>
      </div>
    </article>`;
}

function initCatalogue(){
  const filters = document.getElementById("categoryFilters");
  const grid = document.getElementById("guideGrid");
  if(!filters || !grid) return;
  const initial = params("category") || "all";

  filters.innerHTML = MT_DATA.categories.map(c => `<button class="chip ${c.id===initial?'active':''}" data-cat="${c.id}">${c.emoji} ${c.label}</button>`).join("");

  async function draw(cat){
    filters.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.cat === cat));
    const guides = MT_DATA.guides.filter(g => cat === "all" || g.category === cat);
    const cards = [];
    for(const g of guides){
      const purchased = await mtHasPurchase(g.id);
      cards.push(`
        <article class="guide-card" onclick="location.href='guide.html?id=${g.id}'">
          <div class="guide-art">${g.emoji}</div>
          <div class="guide-body">
            <h3>${g.title}</h3>
            <p>${g.short}</p>
            <div class="guide-meta">
              <span class="price">${money(g.price)} · ${g.durationDays}j</span>
              <span class="${purchased?'unlocked':'locked'}">${purchased?'Débloqué':'🔒'}</span>
            </div>
          </div>
        </article>
      `);
    }
    grid.innerHTML = cards.join("");
  }

  filters.querySelectorAll(".chip").forEach(btn => btn.onclick = () => draw(btn.dataset.cat));
  draw(initial);
}

async function initGuide(){
  const shell = document.getElementById("guideDetail");
  if(!shell) return;
  const user = await requireAuth();
  if(!user) return;
  const id = params("id") || MT_DATA.guides[0].id;
  const g = getGuide(id) || MT_DATA.guides[0];
  const has = await mtHasPurchase(g.id);

  shell.innerHTML = `
    <section class="detail-hero">
      <div>
        <div class="pill" style="margin-bottom:20px">${money(g.price)} · accès ${g.durationDays} jours</div>
        <h1>${g.title}</h1>
        <p>${g.promise}</p>
        <div class="cta-row" style="justify-content:flex-start;margin-top:26px">
          ${has 
            ? `<button class="btn primary" id="openPdfBtn">Ouvrir le guide</button>` 
            : `<button class="btn primary" id="buyBtn">Débloquer maintenant</button>`}
          <a href="catalogue.html" class="btn ghost">Retour</a>
        </div>
      </div>
      <div class="detail-art">${g.emoji}</div>
    </section>

    ${has ? unlockedContent(g) : lockedContent(g)}
  `;

  const buy = document.getElementById("buyBtn");
  if(buy) buy.onclick = async () => {
    if(window.MT_CONFIG.DEMO_MODE){
      await mtDemoUnlock(g);
      alert("Mode démo : achat validé et accès débloqué.");
      location.reload();
      return;
    }
    const res = await fetch(window.MT_CONFIG.STRIPE_CHECKOUT_ENDPOINT, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ guideId:g.id, priceId:g.stripePriceId, userId:user.id })
    });
    const data = await res.json();
    if(data.url) location.href = data.url;
    else alert("Erreur Stripe.");
  };

  const pdf = document.getElementById("realPdfBtn");
  if(pdf) pdf.onclick = async () => {
    if(!g.pdfPath) return alert("PDF pas encore ajouté dans l’admin.");
    const url = await mtGetSignedPdfUrl(g.pdfPath);
    if(url) window.open(url, "_blank");
  };
}

function lockedContent(g){
  return `
  <div class="lock-panel">
    <h2 style="font-family:'Cormorant Garamond',serif;font-size:38px;font-weight:400;margin-bottom:12px">Contenu verrouillé</h2>
    <p style="line-height:1.8;color:#74766f">Débloque ce guide pour accéder au PDF, aux routines, aux plantes, aux gestes de soutien et aux recommandations liées.</p>
    <button class="btn sage" style="margin-top:22px" onclick="document.getElementById('buyBtn')?.click()">Débloquer pour ${money(g.price)}</button>
  </div>
  <div class="content-block">
    <h2>Ce guide contient</h2>
    <ul class="list">
      <li>◆ PDF préparé par Teeyana</li>
      <li>◆ Routine adaptée à la durée</li>
      <li>◆ Plantes et nutrition ciblées</li>
      <li>◆ Produits Maison Yanna liés</li>
    </ul>
  </div>`;
}

function unlockedContent(g){
  return `
  <div class="content-block">
    <h2>Ton PDF</h2>
    <p style="line-height:1.8;color:#74766f">Emplacement sécurisé pour ton fichier PDF. En production, l’URL sera signée et temporaire.</p>
    <button class="btn sage" id="realPdfBtn" style="margin-top:18px">Ouvrir le PDF sécurisé</button>
  </div>
  <div class="content-block">
    <h2>À faire maintenant</h2>
    <ul class="list">
      <li>Préparer une boisson chaude adaptée au terrain.</li>
      <li>Alléger l’assiette sur les prochaines heures sans restriction brutale.</li>
      <li>Observer les signaux : douleur, énergie, digestion, sommeil, humeur.</li>
    </ul>
  </div>
  <div class="content-block">
    <h2>Produits & plantes liés</h2>
    <ul class="list">${(g.products || []).map(p => `<li>🌿 ${p}</li>`).join("")}</ul>
  </div>`;
}

async function initAdmin(){
  const form = document.getElementById("adminForm");
  if(!form) return;
  const user = await requireAuth();
  if(!user) return;

  document.getElementById("saveGuideBtn").onclick = async () => {
    const title = document.getElementById("adminTitle").value.trim();
    if(!title) return alert("Ajoute un titre.");
    const id = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const file = document.getElementById("adminPdf").files[0];

    const guide = {
      id,
      title,
      category: document.getElementById("adminCategory").value,
      emoji: document.getElementById("adminEmoji").value || "🌿",
      price: Number(document.getElementById("adminPrice").value || 5),
      currency: "EUR",
      duration_days: Number(document.getElementById("adminDuration").value || 7),
      durationDays: Number(document.getElementById("adminDuration").value || 7),
      short: document.getElementById("adminShort").value,
      promise: document.getElementById("adminPromise").value,
      tags: document.getElementById("adminTags").value.split(",").map(x => x.trim()).filter(Boolean),
      products: document.getElementById("adminProducts").value.split(",").map(x => x.trim()).filter(Boolean),
      stripe_price_id: document.getElementById("adminStripe").value,
      stripePriceId: document.getElementById("adminStripe").value
    };

    try{
      await mtCreateGuide(guide, file);
      alert("Guide sauvegardé. En mode démo, il est stocké localement. En Supabase, il ira en base + Storage.");
      form.reset();
    }catch(err){
      alert(err.message || "Erreur sauvegarde.");
    }
  };
}

async function initProfile(){
  const wrap = document.getElementById("profileWrap");
  if(!wrap) return;
  const user = await requireAuth();
  if(!user) return;
  const profile = await mtGetProfile();
  const purchases = await mtGetPurchases();

  wrap.innerHTML = `
    <div class="section-label" style="text-align:left">Profil</div>
    <h1 class="section-title" style="text-align:left;margin-bottom:24px">Ton espace<br><em>personnel</em></h1>
    <div class="grid">
      <article class="card">
        <h3>${profile?.full_name || "Utilisateur"}</h3>
        <p>${user.email}</p>
        <span class="badge">${profile?.onboarding_completed ? "Onboarding terminé" : "Onboarding à faire"}</span>
      </article>
      <article class="card">
        <h3>Terrain</h3>
        <p>Objectif : ${profile?.main_goal || "—"}<br>État : ${profile?.current_state || "—"}<br>Style : ${profile?.routine_level || "—"}</p>
        <a class="btn line" style="margin-top:18px" href="onboarding.html">Reprendre l’onboarding</a>
      </article>
    </div>

    <section style="margin-top:28px" class="content-block">
      <h2>Achats & accès</h2>
      <ul class="list">
        ${purchases.length ? purchases.map(p => `<li>Guide : ${p.guide_id} · statut : ${p.status}</li>`).join("") : "<li>Aucun achat pour le moment.</li>"}
      </ul>
    </section>
  `;
}

document.addEventListener("DOMContentLoaded", async () => {
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
  await initTopbar();
  initAuth();
  initOnboarding();
  initDashboard();
  initCatalogue();
  initGuide();
  initAdmin();
  initProfile();
});
