// =========================================================
// MÉTHODE TEE — V26 JOURNAL PRIVÉ & CALENDRIER PARCOURS
// S'intègre dans la sheet "Mon parcours" du dashboard.
// Aucune page autonome — zéro impact sur l'existant.
// =========================================================

(function () {
  "use strict";

  // ─── Utils ───────────────────────────────────────────────
  function safe(v) {
    return String(v || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function dateToISO(y, m, d) {
    return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  function parseISO(s) {
    const [y,m,d] = s.split("-").map(Number);
    return new Date(y, m-1, d);
  }
  function formatDayFR(iso) {
    return parseISO(iso).toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  }
  const DAYS_FR = ["L","M","M","J","V","S","D"];
  const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

  // ─── Supabase ─────────────────────────────────────────────
  function getClient() {
    if (window.mtSupabase) return window.mtSupabase;
    const cfg = window.MT_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null;
    return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  async function getUser() {
    const c = getClient(); if (!c) return null;
    const { data } = await c.auth.getUser();
    return data?.user || null;
  }

  // ─── Activity tracking (hook public) ─────────────────────
  window.mtJournalTrack = async function(type) {
    const c = getClient();
    const u = await getUser();
    if (!c || !u) return;
    const field = { journal:"has_journal", checklist:"has_checklist", tracker:"has_tracker", photo:"has_photo", recipe:"has_recipe" }[type];
    if (!field) return;
    await c.from("daily_activity").upsert(
      { user_id: u.id, activity_date: todayISO(), [field]: true },
      { onConflict: "user_id,activity_date", ignoreDuplicates: false }
    );
  };

  // ─── Fetch helpers ────────────────────────────────────────
  async function fetchMonthActivity(year, month) {
    const c = getClient(), u = await getUser();
    if (!c || !u) return { activity: {}, journal: {} };
    const from = dateToISO(year, month, 1);
    const to = dateToISO(year, month, new Date(year, month, 0).getDate());
    const [actRes, jRes] = await Promise.all([
      c.from("daily_activity").select("activity_date,has_journal,has_checklist,has_tracker,has_photo,has_recipe,protocol_title,protocol_day").eq("user_id", u.id).gte("activity_date", from).lte("activity_date", to),
      c.from("journal_entries").select("entry_date,mood,note_libre,tracker_stress,tracker_energie,tracker_digestion,tracker_sommeil,tracker_humeur,protocol_title,protocol_day").eq("user_id", u.id).gte("entry_date", from).lte("entry_date", to)
    ]);
    const activity = {};
    (actRes.data || []).forEach(r => { activity[r.activity_date] = r; });
    const journal = {};
    (jRes.data || []).forEach(r => { journal[r.entry_date] = r; });
    return { activity, journal };
  }

  async function fetchDayDetail(iso) {
    const c = getClient(), u = await getUser();
    if (!c || !u) return null;
    const [actRes, jRes] = await Promise.all([
      c.from("daily_activity").select("*").eq("user_id", u.id).eq("activity_date", iso).maybeSingle(),
      c.from("journal_entries").select("*").eq("user_id", u.id).eq("entry_date", iso).maybeSingle()
    ]);
    return { activity: actRes.data, journal: jRes.data };
  }

  async function fetchJournalEntry(iso) {
    const c = getClient(), u = await getUser();
    if (!c || !u) return null;
    const { data } = await c.from("journal_entries").select("*").eq("user_id", u.id).eq("entry_date", iso).maybeSingle();
    return data;
  }

  async function saveJournalEntry(iso, payload) {
    const c = getClient(), u = await getUser();
    if (!c || !u) return false;
    const progRes = await c.from("protocol_progress").select("current_day,protocol_id,protocols(title)").eq("user_id", u.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const pid = progRes?.data?.protocol_id || null;
    const ptitle = progRes?.data?.protocols?.title || null;
    const pday = progRes?.data?.current_day || null;
    const entry = { user_id: u.id, entry_date: iso, protocol_id: pid, protocol_title: ptitle, protocol_day: pday, ...payload, updated_at: new Date().toISOString() };
    const { error } = await c.from("journal_entries").upsert(entry, { onConflict: "user_id,entry_date" });
    if (error) { console.error("[Journal] save error", error); return false; }
    window.mtJournalTrack("journal");
    if (pid) await c.from("daily_activity").upsert({ user_id: u.id, activity_date: iso, has_journal: true, protocol_id: pid, protocol_title: ptitle, protocol_day: pday }, { onConflict: "user_id,activity_date" });
    return true;
  }

  // ─── Calendar render ──────────────────────────────────────
  function renderCalendar(year, month, activity, journal, today) {
    const firstDay = new Date(year, month-1, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    let cells = "";
    for (let i = 0; i < offset; i++) cells += `<div class="jcal-cell jcal-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = dateToISO(year, month, d);
      const act = activity[iso], jrn = journal[iso];
      const isToday = iso === today;
      const hasAct = act && (act.has_journal || act.has_checklist || act.has_tracker || act.has_photo || act.has_recipe);
      let dotsHtml = "";
      if (act?.has_checklist) dotsHtml += `<span class="jcal-dot dot-green"></span>`;
      if (act?.has_tracker)   dotsHtml += `<span class="jcal-dot dot-gold"></span>`;
      if (jrn)                dotsHtml += `<span class="jcal-dot dot-sage"></span>`;
      if (act?.has_photo)     dotsHtml += `<span class="jcal-dot dot-rose"></span>`;
      cells += `<button class="jcal-cell${isToday?" jcal-today":""}${hasAct||jrn?" jcal-has-data":""}" data-date="${iso}" onclick="window.mtJournalOpenDay('${iso}')">
        <span class="jcal-num">${d}</span>
        ${dotsHtml ? `<span class="jcal-dots">${dotsHtml}</span>` : ""}
      </button>`;
    }
    return `
      <div class="jcal-header">
        <button class="jcal-nav" id="jcalPrev">‹</button>
        <span class="jcal-month-label">${MONTHS_FR[month-1]} ${year}</span>
        <button class="jcal-nav" id="jcalNext">›</button>
      </div>
      <div class="jcal-weekdays">${DAYS_FR.map(d=>`<span>${d}</span>`).join("")}</div>
      <div class="jcal-grid">${cells}</div>`;
  }

  // ─── Day detail ───────────────────────────────────────────
  function renderDayModal(iso, data) {
    const { activity: act, journal: jrn } = data;
    const label = formatDayFR(iso);
    function trackerBar(val, lbl) {
      if (!val) return "";
      const pct = Math.round((val/10)*100);
      const color = val >= 7 ? "#4a7c5f" : val >= 4 ? "#C9A96E" : "#9E4B43";
      return `<div class="jday-tracker-row"><span class="jday-tracker-label">${lbl}</span><div class="jday-tracker-bar"><div class="jday-tracker-fill" style="width:${pct}%;background:${color}"></div></div><span class="jday-tracker-val">${val}/10</span></div>`;
    }
    let badges = "";
    if (act?.has_checklist) badges += `<span class="jday-badge badge-green">✅ Checklist</span>`;
    if (act?.has_tracker)   badges += `<span class="jday-badge badge-gold">📊 Tracker</span>`;
    if (jrn)                badges += `<span class="jday-badge badge-sage">📖 Journal</span>`;
    if (act?.has_photo)     badges += `<span class="jday-badge badge-rose">📷 Photo</span>`;
    if (act?.has_recipe)    badges += `<span class="jday-badge badge-muted">🥣 Recette</span>`;
    const ptag = (act?.protocol_title || jrn?.protocol_title)
      ? `<div class="jday-protocol-tag">🌿 ${safe(act?.protocol_title || jrn?.protocol_title)}${(act?.protocol_day || jrn?.protocol_day) ? ` — Jour ${act?.protocol_day || jrn?.protocol_day}` : ""}</div>` : "";
    const moodEmoji = { sereine:"😌", energique:"⚡", fragile:"🌧️", fatiguee:"😴", joyeuse:"✨" }[jrn?.mood] || "";
    const hasAny = act || jrn;
    return `
      <div class="jday-modal-backdrop" onclick="window.mtJournalCloseDay()"></div>
      <div class="jday-modal-card">
        <button class="jday-modal-close" onclick="window.mtJournalCloseDay()">✕</button>
        <div class="jday-modal-date">${safe(label)}</div>
        ${ptag}
        ${moodEmoji ? `<div class="jday-mood-display">${moodEmoji} <span>${safe(jrn?.mood||"")}</span></div>` : ""}
        ${!hasAny ? `<div class="jday-empty"><span>🌿</span><p>Aucune activité<br>enregistrée ce jour-là.</p></div>` : `
          ${badges ? `<div class="jday-badges">${badges}</div>` : ""}
          ${jrn?.note_libre ? `<div class="jday-note">"${safe(jrn.note_libre)}"</div>` : ""}
          ${jrn ? `<div class="jday-trackers">
            ${trackerBar(jrn.tracker_stress,"Stress")}
            ${trackerBar(jrn.tracker_energie,"Énergie")}
            ${trackerBar(jrn.tracker_digestion,"Digestion")}
            ${trackerBar(jrn.tracker_sommeil,"Sommeil")}
            ${trackerBar(jrn.tracker_humeur,"Humeur")}
          </div>` : ""}
        `}
        <button class="jday-open-journal" onclick="window.mtJournalCloseDay();window.mtJournalOpenForm('${iso}')">
          ${jrn ? "✏️ Modifier mon journal" : "📝 Écrire dans mon journal"}
        </button>
      </div>`;
  }

  // ─── Journal form ─────────────────────────────────────────
  const JOURNAL_QUESTIONS = [
    { key:"ressenti",   label:"Comment tu te sens aujourd'hui ?",  placeholder:"En quelques mots, décris ton état général…" },
    { key:"nutrition",  label:"Ce que j'ai mangé / bu",             placeholder:"Repas, infusions, hydratation…" },
    { key:"intention",  label:"Mon intention du jour",              placeholder:"Ce sur quoi je veux me concentrer…" },
  ];

  function renderJournalForm(iso, existing) {
    const label = formatDayFR(iso);
    const ans = existing?.answers || {};
    const questions = JOURNAL_QUESTIONS.map(q => `
      <div class="jform-question">
        <label class="jform-label">${safe(q.label)}</label>
        <textarea class="jform-textarea" name="${q.key}" placeholder="${safe(q.placeholder)}" rows="3">${safe(ans[q.key]||"")}</textarea>
      </div>`).join("");
    const trackers = [
      { key:"tracker_stress",    label:"Stress",    icon:"🌪️" },
      { key:"tracker_energie",   label:"Énergie",   icon:"⚡" },
      { key:"tracker_digestion", label:"Digestion", icon:"🌿" },
      { key:"tracker_sommeil",   label:"Sommeil",   icon:"🌙" },
      { key:"tracker_humeur",    label:"Humeur",    icon:"✨" },
    ].map(t => `
      <div class="jform-tracker-row">
        <span class="jform-tracker-label">${t.icon} ${t.label}</span>
        <div class="jform-slider-wrap">
          <input type="range" class="jform-slider" name="${t.key}" min="1" max="10" value="${existing?.[t.key]||5}" oninput="this.nextElementSibling.textContent=this.value+'/10'">
          <span class="jform-slider-val">${existing?.[t.key]||5}/10</span>
        </div>
      </div>`).join("");
    const moods = [
      { key:"sereine",  emoji:"😌", label:"Sereine"   },
      { key:"energique",emoji:"⚡", label:"Énergique" },
      { key:"joyeuse",  emoji:"✨", label:"Joyeuse"   },
      { key:"fragile",  emoji:"🌧️", label:"Fragile"   },
      { key:"fatiguee", emoji:"😴", label:"Fatiguée"  },
    ].map(m => `<button type="button" class="jform-mood-btn${existing?.mood===m.key?" selected":""}" data-mood="${m.key}">${m.emoji}<span>${m.label}</span></button>`).join("");
    return `
      <div class="jform-backdrop" onclick="window.mtJournalCloseForm()"></div>
      <div class="jform-sheet">
        <button class="jform-close" onclick="window.mtJournalCloseForm()">✕</button>
        <div class="jform-kicker">Journal privé</div>
        <div class="jform-date">${safe(label)}</div>
        <div class="jform-section-title">Mon humeur</div>
        <div class="jform-moods">${moods}</div>
        ${questions}
        <div class="jform-section-title">Mes ressentis du jour</div>
        <div class="jform-trackers">${trackers}</div>
        <div class="jform-question">
          <label class="jform-label">Note libre</label>
          <textarea class="jform-textarea" name="note_libre" placeholder="Tout ce que tu veux noter…" rows="4">${safe(existing?.note_libre||"")}</textarea>
        </div>
        <button class="jform-save" id="jformSaveBtn" onclick="window.mtJournalSaveForm('${iso}')">Enregistrer mon journal</button>
      </div>`;
  }


  // Sauvegarde depuis un contenu "Journal privé" d'un protocole
  window.mtSaveJournalProtocolEntry = async function(payload) {
    const c = getClient();
    const u = await getUser();
    if (!c || !u || !payload) return false;
    const today = todayISO();
    const entry = {
      user_id: u.id,
      entry_date: today,
      protocol_id: payload.protocol_id || null,
      protocol_title: payload.title || "Journal privé",
      has_protocol_journal: true,
      answers: { questions: payload.questions || [], answers: payload.answers || {}, source:"protocol_journal", content_id:payload.content_id || "" },
      note_libre: Object.values(payload.answers || {}).filter(Boolean).slice(0,2).join(" · ") || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await c.from("journal_entries").upsert(entry, { onConflict:"user_id,entry_date" });
    if (error) { console.warn("[Journal protocol] save error", error); return false; }
    await window.mtJournalTrack("journal");
    return true;
  };


  // ─── State ───────────────────────────────────────────────
  let _calYear, _calMonth;

  // ─── SHEET INIT (appelé par mtOpenParcoursSheet dans app.js) ──
  window.mtJournalInitSheet = async function() {
    const body = document.getElementById("parcoursSheetBody");
    if (!body) return;
    const user = await getUser();
    if (!user) {
      body.innerHTML = `<p style="color:var(--muted);padding:20px 0;font-size:13px;">Connecte-toi pour accéder à ton parcours.</p>`;
      return;
    }
    const now = new Date();
    _calYear  = now.getFullYear();
    _calMonth = now.getMonth() + 1;

    body.innerHTML = `
      <button class="jcal-write-btn" onclick="window.mtJournalOpenForm('${todayISO()}')">✦ Écrire dans mon journal aujourd'hui</button>
      <div class="jcal-legend">
        <span><span class="jcal-dot dot-green"></span>Checklist</span>
        <span><span class="jcal-dot dot-gold"></span>Tracker</span>
        <span><span class="jcal-dot dot-sage"></span>Journal</span>
        <span><span class="jcal-dot dot-rose"></span>Photo</span>
      </div>
      <div class="jcal-container" id="jcalContainer"></div>
      <div class="jday-modal hidden" id="jdayModal"></div>
      <div class="jform-modal hidden" id="jformModal"></div>`;

    await _loadCalendar();
  };

  async function _loadCalendar() {
    const container = document.getElementById("jcalContainer");
    if (!container) return;
    container.innerHTML = `<div class="jcal-loading">Chargement…</div>`;
    const { activity, journal } = await fetchMonthActivity(_calYear, _calMonth);
    container.innerHTML = renderCalendar(_calYear, _calMonth, activity, journal, todayISO());
    document.getElementById("jcalPrev")?.addEventListener("click", () => {
      _calMonth--; if (_calMonth < 1) { _calMonth = 12; _calYear--; } _loadCalendar();
    });
    document.getElementById("jcalNext")?.addEventListener("click", () => {
      _calMonth++; if (_calMonth > 12) { _calMonth = 1; _calYear++; } _loadCalendar();
    });
  }

  // ─── Day modal ────────────────────────────────────────────
  window.mtJournalOpenDay = async function(iso) {
    const modal = document.getElementById("jdayModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.innerHTML = `<div class="jday-modal-backdrop" onclick="window.mtJournalCloseDay()"></div><div class="jday-modal-card jday-loading"><span>⟳</span><p>Chargement…</p></div>`;
    const data = await fetchDayDetail(iso);
    modal.innerHTML = renderDayModal(iso, data || { activity: null, journal: null });
  };
  window.mtJournalCloseDay = function() {
    const m = document.getElementById("jdayModal");
    if (m) { m.classList.add("hidden"); m.innerHTML = ""; }
  };

  // ─── Journal form ─────────────────────────────────────────
  window.mtJournalOpenForm = async function(iso) {
    const modal = document.getElementById("jformModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.innerHTML = `<div class="jform-backdrop"></div><div class="jform-sheet jday-loading"><span>⟳</span><p>Chargement…</p></div>`;
    const existing = await fetchJournalEntry(iso);
    modal.innerHTML = renderJournalForm(iso, existing);
    modal.querySelectorAll(".jform-mood-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        modal.querySelectorAll(".jform-mood-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });
  };
  window.mtJournalCloseForm = function() {
    const m = document.getElementById("jformModal");
    if (m) { m.classList.add("hidden"); m.innerHTML = ""; }
  };
  window.mtJournalSaveForm = async function(iso) {
    const modal = document.getElementById("jformModal");
    if (!modal) return;
    const btn = document.getElementById("jformSaveBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Enregistrement…"; }
    const answers = {};
    JOURNAL_QUESTIONS.forEach(q => {
      const el = modal.querySelector(`textarea[name="${q.key}"]`);
      if (el && el.value.trim()) answers[q.key] = el.value.trim();
    });
    const trackers = {};
    ["tracker_stress","tracker_energie","tracker_digestion","tracker_sommeil","tracker_humeur"].forEach(k => {
      const el = modal.querySelector(`input[name="${k}"]`);
      if (el) trackers[k] = Number(el.value);
    });
    const moodBtn = modal.querySelector(".jform-mood-btn.selected");
    const mood = moodBtn?.dataset?.mood || null;
    const noteEl = modal.querySelector(`textarea[name="note_libre"]`);
    const note_libre = noteEl?.value?.trim() || null;
    const ok = await saveJournalEntry(iso, { answers, ...trackers, note_libre, mood });
    if (ok) {
      window.mtJournalCloseForm();
      if (window.mtToast) window.mtToast("Journal enregistré 🌿");
      const [y, m] = iso.split("-").map(Number);
      if (y === _calYear && m === _calMonth) await _loadCalendar();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = "Réessayer"; }
      if (window.mtToast) window.mtToast("Erreur — réessaie dans un instant.");
    }
  };

})();
