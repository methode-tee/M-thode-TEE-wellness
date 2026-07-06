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
  window.mtJournalTodayISO = todayISO;
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


  function localActivityKey(){
    return "mt_daily_activity_local_v1";
  }
  function readLocalActivity(){
    try { return JSON.parse(localStorage.getItem(localActivityKey()) || "{}"); } catch(e){ return {}; }
  }
  function writeLocalActivity(data){
    localStorage.setItem(localActivityKey(), JSON.stringify(data || {}));
  }
  function upsertLocalActivity(type, iso){
    const field = { journal:"has_journal", checklist:"has_checklist", tracker:"has_tracker", photo:"has_photo", recipe:"has_recipe" }[type];
    if(!field) return;
    const data = readLocalActivity();
    data[iso] = data[iso] || { activity_date: iso };
    data[iso][field] = true;
    data[iso].updated_at = new Date().toISOString();
    writeLocalActivity(data);
  }

  function dailyJournalKey(){
    return "mt_daily_journal_entries_v1";
  }
  function readDailyJournals(){
    try { return JSON.parse(localStorage.getItem(dailyJournalKey()) || "{}"); } catch(e){ return {}; }
  }
  function writeDailyJournals(data){
    localStorage.setItem(dailyJournalKey(), JSON.stringify(data || {}));
  }
  function readDailyJournal(iso){
    return readDailyJournals()[iso] || null;
  }
  function writeDailyJournal(iso, entry){
    const data = readDailyJournals();
    data[iso] = { ...(data[iso] || {}), ...entry, entry_date: iso, updated_at: new Date().toISOString() };
    writeDailyJournals(data);
    upsertLocalActivity("journal", iso);
  }

  function readLocalProtocolJournals(){
    const out = {};
    try{
      for(let i=0;i<localStorage.length;i++){
        const key = localStorage.key(i);
        if(!key || !key.startsWith("mt_private_journal_")) continue;
        const item = JSON.parse(localStorage.getItem(key) || "{}");
        const iso = item.date || (item.updated_at ? String(item.updated_at).slice(0,10) : todayISO());
        out[iso] = {
          entry_date: iso,
          mood: item.mood || null,
          note_libre: Object.values(item.answers || {}).filter(Boolean).slice(0,2).join(" · ") || null,
          protocol_title: item.title || "Journal privé",
          protocol_day: item.protocol_day || null,
          answers: { questions:item.questions || [], answers:item.answers || {}, source:"local_protocol_journal" }
        };
      }
    }catch(e){}
    return out;
  }


  // ─── Activity tracking (hook public) ─────────────────────
  window.mtJournalTrack = async function(type) {
    const iso = todayISO();

    // Toujours enregistrer localement pour que le calendrier réagisse immédiatement.
    upsertLocalActivity(type, iso);

    const c = getClient();
    const u = await getUser();
    const field = { journal:"has_journal", checklist:"has_checklist", tracker:"has_tracker", photo:"has_photo", recipe:"has_recipe" }[type];
    if (!field) return;

    if (c && u) {
      const { error } = await c.from("daily_activity").upsert(
        { user_id: u.id, activity_date: iso, [field]: true, updated_at: new Date().toISOString() },
        { onConflict: "user_id,activity_date", ignoreDuplicates: false }
      );
      if(error) console.warn("[Mon parcours] daily_activity error", error);
    }

    if (window.mtRefreshParcoursCalendar) window.mtRefreshParcoursCalendar();
  };

  // ─── Fetch helpers ────────────────────────────────────────
  async function fetchMonthActivity(year, month) {
    const c = getClient(), u = await getUser();
    const from = dateToISO(year, month, 1);
    const to = dateToISO(year, month, new Date(year, month, 0).getDate());

    const activity = {};
    const journal = {};

    if (c && u) {
      const [actRes, jRes] = await Promise.all([
        c.from("daily_activity").select("activity_date,has_journal,has_checklist,has_tracker,has_photo,has_recipe,protocol_title,protocol_day").eq("user_id", u.id).gte("activity_date", from).lte("activity_date", to),
        c.from("journal_entries").select("entry_date,mood,note_libre,tracker_stress,tracker_energie,tracker_digestion,tracker_sommeil,tracker_humeur,protocol_title,protocol_day,answers").eq("user_id", u.id).gte("entry_date", from).lte("entry_date", to)
      ]);
      (actRes.data || []).forEach(r => { activity[r.activity_date] = r; });
      (jRes.data || []).forEach(r => { journal[r.entry_date] = r; });
    }

    const localActivity = readLocalActivity();
    Object.keys(localActivity || {}).forEach(iso => {
      if(iso >= from && iso <= to){
        activity[iso] = { ...(activity[iso] || { activity_date: iso }), ...localActivity[iso] };
      }
    });

    const daily = readDailyJournals();
    Object.keys(daily || {}).forEach(iso => {
      if(iso >= from && iso <= to){
        journal[iso] = { ...(journal[iso] || {}), ...daily[iso], source: "daily_journal" };
        activity[iso] = { ...(activity[iso] || { activity_date: iso }), has_journal: true };
      }
    });

    const localJournals = readLocalProtocolJournals();
    Object.keys(localJournals || {}).forEach(iso => {
      if(iso >= from && iso <= to){
        journal[iso] = journal[iso] || localJournals[iso];
        activity[iso] = { ...(activity[iso] || { activity_date: iso }), has_journal: true };
      }
    });

    return { activity, journal };
  }

  async function fetchDayDetail(iso) {
    const c = getClient(), u = await getUser();
    let act = null, jrn = null;

    if (c && u) {
      const [actRes, jRes] = await Promise.all([
        c.from("daily_activity").select("*").eq("user_id", u.id).eq("activity_date", iso).maybeSingle(),
        c.from("journal_entries").select("*").eq("user_id", u.id).eq("entry_date", iso).maybeSingle()
      ]);
      act = actRes.data || null;
      jrn = jRes.data || null;
    }

    const localActivity = readLocalActivity()[iso] || null;
    const localDaily = readDailyJournal(iso);
    const localProtocol = readLocalProtocolJournals()[iso] || null;

    const activity = { ...(act || {}), ...(localActivity || {}) };
    const journalEntry = localDaily ? { ...(jrn || {}), ...localDaily, source:"daily_journal" } : (jrn || localProtocol || null);
    if (journalEntry) activity.has_journal = true;

    return { activity, journal: journalEntry };
  }

  async function fetchJournalEntry(iso) {
    // Fallback localStorage immédiat
    const localFallback = readDailyJournal(iso);
    const c = getClient(), u = await getUser();
    if (!c || !u) return localFallback;
    const { data, error } = await c.from("journal_entries").select("*").eq("user_id", u.id).eq("entry_date", iso).maybeSingle();
    if (error || !data) return localFallback;
    // Merge : Supabase + local (local priority pour les champs rédigés non encore sync)
    return localFallback ? { ...data, ...localFallback, entry_date: iso } : data;
  }

  async function saveJournalEntry(iso, payload) {
    const localEntry = {
      entry_date: iso,
      protocol_title: "Journal privé",
      mood: payload.mood || null,
      note_libre: payload.note_libre || "",
      answers: payload.answers || {},
      tracker_stress: payload.tracker_stress,
      tracker_energie: payload.tracker_energie,
      tracker_digestion: payload.tracker_digestion,
      tracker_sommeil: payload.tracker_sommeil,
      tracker_humeur: payload.tracker_humeur,
      source: "daily_journal"
    };

    // Sauvegarde immédiate locale : le jour reste visible même si Supabase est lent.
    writeDailyJournal(iso, localEntry);

    const c = getClient(), u = await getUser();
    if (c && u) {
      let pid = null, ptitle = "Journal privé", pday = null;
      try{
        const progRes = await c.from("protocol_progress").select("current_day,protocol_id,protocols(title)").eq("user_id", u.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        pid = progRes?.data?.protocol_id || null;
        ptitle = progRes?.data?.protocols?.title || "Journal privé";
        pday = progRes?.data?.current_day || null;
      }catch(e){}
      const entry = { user_id: u.id, entry_date: iso, protocol_id: pid, protocol_title: "Journal privé", protocol_day: pday, ...payload, updated_at: new Date().toISOString() };
      const { error } = await c.from("journal_entries").upsert(entry, { onConflict: "user_id,entry_date" });
      if (error) console.warn("[Journal] save supabase error", error);
      await c.from("daily_activity").upsert({ user_id: u.id, activity_date: iso, has_journal: true, protocol_id: pid, protocol_title: "Journal privé", protocol_day: pday, updated_at: new Date().toISOString() }, { onConflict: "user_id,activity_date" });
    }

    await window.mtJournalTrack("journal");
    if (window.mtRefreshParcoursCalendar) window.mtRefreshParcoursCalendar();
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
    const { activity: act, journal: jrn } = data || {};
    const label = formatDayFR(iso);
    function trackerBar(val, lbl) {
      if (!val) return "";
      const pct = Math.round((Number(val)/10)*100);
      const color = val >= 7 ? "#4a7c5f" : val >= 4 ? "#C9A96E" : "#9E4B43";
      return `<div class="jday-tracker-row"><span class="jday-tracker-label">${lbl}</span><div class="jday-tracker-bar"><div class="jday-tracker-fill" style="width:${pct}%;background:${color}"></div></div><span class="jday-tracker-val">${val}/10</span></div>`;
    }
    let badges = "";
    if (act?.has_checklist) badges += `<span class="jday-badge badge-green">✅ Checklist</span>`;
    if (act?.has_tracker)   badges += `<span class="jday-badge badge-gold">📊 Tracker</span>`;
    if (jrn)                badges += `<span class="jday-badge badge-sage">📖 Journal</span>`;
    if (act?.has_photo)     badges += `<span class="jday-badge badge-rose">📷 Photo</span>`;
    if (act?.has_recipe)    badges += `<span class="jday-badge badge-muted">🥣 Recette</span>`;

    const ans = jrn?.answers || {};
    const isProtocol = ans?.source === "protocol_journal" || ans?.source === "local_protocol_journal";
    let answersHtml = "";

    if (isProtocol && Array.isArray(ans.questions)) {
      answersHtml = ans.questions.map((q,i)=> {
        const val = ans.answers?.[i] || "";
        return val ? `<div class="jday-answer"><strong>${safe(q)}</strong><p>${safe(val)}</p></div>` : "";
      }).join("");
    } else if (ans && typeof ans === "object") {
      const labels = { ressenti:"Comment je me sens", nutrition:"Ce que j’ai mangé / bu", intention:"Mon intention" };
      answersHtml = Object.keys(ans).filter(k => ans[k]).map(k => `<div class="jday-answer"><strong>${safe(labels[k] || k)}</strong><p>${safe(ans[k])}</p></div>`).join("");
    }

    const hasContent = jrn || act?.has_checklist || act?.has_tracker || act?.has_photo || act?.has_recipe;
    const moodEmoji = { calme:"😌", energique:"⚡", fragile:"🌧️", fatigue:"😴", bien:"✨" }[jrn?.mood] || "";

    return `
      <div class="jday-modal-backdrop" onclick="window.mtJournalCloseDay()"></div>
      <div class="jday-modal-card">
        <button class="jday-modal-close" onclick="window.mtJournalCloseDay()">×</button>
        <div class="jday-modal-date">${safe(label)}</div>
        ${hasContent ? `
          ${badges ? `<div class="jday-badges">${badges}</div>` : ""}
          ${jrn ? `<h3 class="jday-title">Journal privé ${moodEmoji}</h3>` : ""}
          ${jrn?.note_libre ? `<div class="jday-note">${safe(jrn.note_libre)}</div>` : ""}
          ${answersHtml ? `<div class="jday-answers">${answersHtml}</div>` : ""}
          ${jrn ? `<div class="jday-trackers">
            ${trackerBar(jrn.tracker_stress,"Stress")}
            ${trackerBar(jrn.tracker_energie,"Énergie")}
            ${trackerBar(jrn.tracker_digestion,"Digestion")}
            ${trackerBar(jrn.tracker_sommeil,"Sommeil")}
            ${trackerBar(jrn.tracker_humeur,"Humeur")}
          </div>` : ""}
        ` : `<p class="jday-empty">Aucune activité enregistrée ce jour-là.</p>`}
        <button class="jday-open-journal" onclick="window.mtJournalCloseDay();window.mtJournalOpenForm('${iso}')">
          ${jrn ? "✏️ Modifier mon journal" : "📝 Écrire dans mon journal"}
        </button>
      </div>`;
  }

  // ─── Journal form ─────────────────────────────────────────
  const JOURNAL_QUESTIONS = [
    { key:"libre", label:"Écris ce que tu souhaites", placeholder:"Ton ressenti, ta journée, ton alimentation, tes émotions, une victoire, une difficulté… cet espace est à toi." }
  ];

  function renderJournalForm(iso, existing) {
    const label = formatDayFR(iso);
    const ans = existing?.answers || {};
    const questions = JOURNAL_QUESTIONS.map(q => `
      <div class="jform-question">
        <label class="jform-label">${safe(q.label)}</label>
        <textarea class="jform-textarea" name="${q.key}" placeholder="${safe(q.placeholder)}" rows="8">${safe(ans[q.key]||"")}</textarea>
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
      { key:"calme",  emoji:"😌", label:"Sereine"   },
      { key:"energique",emoji:"⚡", label:"Énergique" },
      { key:"bien",  emoji:"✨", label:"Joyeuse"   },
      { key:"fragile",  emoji:"🌧️", label:"Fragile"   },
      { key:"fatigue", emoji:"😴", label:"Fatiguée"  },
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
        <div class="jform-section-title">Repères du jour</div>
        <div class="jform-trackers">${trackers}</div>
        <div class="jform-question">
          <label class="jform-label">Note libre</label>
          <textarea class="jform-textarea" name="note_libre" placeholder="Une phrase courte à retenir pour ce jour…" rows="3">${safe(existing?.note_libre||"")}</textarea>
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
