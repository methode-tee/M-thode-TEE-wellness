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
  function iconHTML(key, cls){
    if (window.mtIconHTML) return window.mtIconHTML(key, cls || "");
    return `<span class="${cls || ""}"></span>`;
  }

  // ─── Supabase ─────────────────────────────────────────────
  function getClient() {
    if (window.mtSupabase) return window.mtSupabase;
    const cfg = window.MT_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null;
    return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  function activeLocalUserId(){
    try{return String(window.__MT_ACTIVE_USER_ID__||sessionStorage.getItem('mt_active_user_id')||'guest').replace(/[^a-zA-Z0-9_-]/g,'_');}catch(e){return String(window.__MT_ACTIVE_USER_ID__||'guest').replace(/[^a-zA-Z0-9_-]/g,'_');}
  }
  function migrateLegacyLocalJournalData(userId){
    const uid=String(userId||'').replace(/[^a-zA-Z0-9_-]/g,'_');if(!uid)return;
    const marker='mt_private_local_scope_migrated_v1';
    try{
      if(localStorage.getItem(marker))return;
      const pairs=[['mt_daily_activity_local_v1',`mt_daily_activity_local_v2_${uid}`],['mt_daily_journal_entries_v1',`mt_daily_journal_entries_v2_${uid}`]];
      pairs.forEach(([legacy,scoped])=>{const raw=localStorage.getItem(legacy);if(raw&&!localStorage.getItem(scoped))localStorage.setItem(scoped,raw);if(raw)localStorage.removeItem(legacy);});
      const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('mt_private_journal_'))keys.push(k);}
      keys.forEach(k=>{if(k.startsWith(`mt_private_journal_${uid}_`))return;const raw=localStorage.getItem(k);const scoped=`mt_private_journal_${uid}_${k.slice('mt_private_journal_'.length)}`;if(raw&&!localStorage.getItem(scoped))localStorage.setItem(scoped,raw);localStorage.removeItem(k);});
      localStorage.setItem(marker,uid);
    }catch(e){}
  }
  async function getUser() {
    const c = getClient(); if (!c) return null;
    const { data } = await c.auth.getUser();
    const user=data?.user||null;
    if(user?.id){window.__MT_ACTIVE_USER_ID__=user.id;try{sessionStorage.setItem('mt_active_user_id',user.id);}catch(e){}migrateLegacyLocalJournalData(user.id);}
    return user;
  }


  function localActivityKey(){
    return `mt_daily_activity_local_v2_${activeLocalUserId()}`;
  }
  function readLocalActivity(){
    try { return JSON.parse(localStorage.getItem(localActivityKey()) || "{}"); } catch(e){ return {}; }
  }
  function writeLocalActivity(data){
    localStorage.setItem(localActivityKey(), JSON.stringify(data || {}));
  }
  function activityField(type, scope){
    const local = {
      journal:"has_journal", checklist:"has_checklist", tracker:"has_tracker", photo:"has_photo", recipe:"has_recipe",
      hydration:"has_hydration", sleep:"has_sleep", protocol:"has_protocol", routine:"has_routine", ritual:"has_ritual"
    };
    // La table Supabase daily_activity existante ne contient pas forcément les nouvelles colonnes.
    // On garde donc un mapping sûr côté base, et le détail immédiat côté localStorage.
    const remote = {
      journal:"has_journal", checklist:"has_checklist", tracker:"has_tracker", photo:"has_photo", recipe:"has_recipe",
      hydration:"has_hydration", sleep:"has_sleep", protocol:"has_protocol", routine:"has_routine", ritual:"has_ritual"
    };
    return (scope === "remote" ? remote : local)[type];
  }
  function upsertLocalActivity(type, iso){
    const field = activityField(type, "local");
    if(!field) return;
    const data = readLocalActivity();
    data[iso] = data[iso] || { activity_date: iso };
    data[iso][field] = true;
    data[iso].updated_at = new Date().toISOString();
    writeLocalActivity(data);
  }

  function mergeTodayChecksIntoActivity(activity, iso, checks){
    if(!checks) return activity;
    const out = { ...(activity || { activity_date: iso }) };
    if(checks.hydration) out.has_hydration = true;
    if(checks.protocol) out.has_protocol = true;
    if(checks.routine) out.has_routine = true;
    Object.keys(checks).forEach(k => { if(k.startsWith("ritual_") && checks[k]) out.has_ritual = true; });
    return out;
  }
  function readTodayChecksFor(userId, iso){
    try { return JSON.parse(localStorage.getItem(`mt_today_checks_${userId || 'guest'}_${iso}`) || '{}') || {}; } catch(e){ return {}; }
  }
  function readHydrationFor(userId, iso){
    try{
      const a = localStorage.getItem(`mt_hydration_liters_${userId || 'guest'}_${iso}`);
      const b = localStorage.getItem(`mt_today_hydration_liters_${userId || 'guest'}_${iso}`);
      const n = Number(a || b || 0);
      return Number.isFinite(n) ? Math.max(0, Math.min(6, n)) : 0;
    }catch(e){ return 0; }
  }
  function readSleepFor(userId, iso){
    try{
      const n = Number(localStorage.getItem(`mt_sleep_hours_${userId || 'guest'}_${iso}`) || 0);
      return Number.isFinite(n) ? Math.max(0, Math.min(24, n)) : 0;
    }catch(e){ return 0; }
  }

  // V341 · Résumés génériques des nouveaux suivis et de l'alimentation.
  // Ils ne sont lus que lorsque Mon parcours est effectivement ouvert.
  const CUSTOM_TRACKER_ALIASES = { performance_sportive:"performance_recuperation", football:"performance_recuperation", recuperation:"performance_recuperation" };
  const CUSTOM_TRACKER_TITLES = {
    sommeil_profond:"Sommeil approfondi", digestion:"Confort digestif", reflux:"Reflux & aigreurs",
    equilibre_alimentaire:"Équilibre alimentaire", evolution_corporelle:"Évolution corporelle", peau:"Peau",
    performance_recuperation:"Activité & récupération", cycle:"Cycle & rythme hormonal",
    perimenopause:"Périménopause & ménopause", jeune_intermit:"Jeûne intermittent",
    reduction_sucre:"Réduction du sucre", changer_habitude:"Changer une habitude",
    pas_marche:"Pas & marche", nutrition_vegetale:"Nutrition végétale & micronutriments"
  };
  function customTrackerKey(key){ return CUSTOM_TRACKER_ALIASES[String(key || "")] || String(key || ""); }
  function customTrackerTitle(key){ return CUSTOM_TRACKER_TITLES[customTrackerKey(key)] || "Suivi personnel"; }
  function isPresent(value){ return value !== null && value !== undefined && String(value) !== ""; }
  function asNumber(value){ if(!isPresent(value)) return null; const n=Number(value); return Number.isFinite(n)?n:null; }
  function average(...values){ const list=values.map(asNumber).filter(Number.isFinite); return list.length?Math.round(list.reduce((a,b)=>a+b,0)/list.length*10)/10:null; }
  function durationLabel(hours){ const n=asNumber(hours); if(n===null)return ""; const h=Math.floor(n),m=Math.round((n-h)*60);return `${h}h${m?String(m).padStart(2,"0"):""}`; }
  function cleanCycleLabel(value,event){
    if(event==="ovulation_day")return "Ovulation";
    return String(value||"Cycle")
      .replace(/Fenêtre ovulatoire/gi,"Fenêtre d’ovulation")
      .replace(/\s+estimée?s?/gi,"")
      .trim();
  }
  function customTrackerSummary(row){
    const key = customTrackerKey(row?.tracker_key), v = row?.values && typeof row.values === "object" ? row.values : {};
    if(v._daily?.headline) return String(v._daily.headline);
    if(key === "cycle") return v.cycle_day_estimate ? `J${v.cycle_day_estimate} · ${cleanCycleLabel(v.cycle_phase_estimate,v._cycle_calendar_event||v._daily?.signals?.cycle_event)}` : "Repère de cycle renseigné";
    if(key === "performance_recuperation") return [v._discipline || "Activité",v.session||"",v.duration ? `${v.duration} min` : "",isPresent(v.recovery)?`récupération ${v.recovery}/10`:""].filter(Boolean).join(" · ");
    if(key === "sommeil_profond") return [v.night_state||"",v._sleep_hours?`${String(v._sleep_hours).replace(".",",")} h`:"",isPresent(v.quality)?`qualité ${v.quality}/10`:""].filter(Boolean).join(" · ")||"Nuit renseignée";
    if(key === "digestion") return [v.day_state||"",isPresent(v.comfort)?`confort ${v.comfort}/10`:""].filter(Boolean).join(" · ")||"Digestion renseignée";
    if(key === "reflux") return [v.episode||"",isPresent(v.intensity)?`intensité ${v.intensity}/10`:""].filter(Boolean).join(" · ")||"Reflux renseigné";
    if(key === "peau") return v.day_state|| (isPresent(v.inflammation)?`rougeurs ${v.inflammation}/10`:"Peau renseignée");
    if(key === "jeune_intermit") return [v.fast_state||"",v._fast_hours?`${String(v._fast_hours).replace(".",",")} h`:""].filter(Boolean).join(" · ")||"Rythme renseigné";
    if(key === "reduction_sucre") return v.craving_state||(isPresent(v.craving)?`envie ${v.craving}/10`:"Repère sucre renseigné");
    if(key === "changer_habitude") return v.victory?`Petit pas · ${String(v.victory).slice(0,42)}`:(v.day_state||"Habitude renseignée");
    if(key === "pas_marche") return [isPresent(v.steps)?`${new Intl.NumberFormat('fr-FR').format(Number(v.steps))} pas`:"",isPresent(v.distance_km)?`${String(v.distance_km).replace('.',',')} km`:"",isPresent(v._step_goal)?`repère personnel ${new Intl.NumberFormat('fr-FR').format(Number(v._step_goal))}`:""].filter(Boolean).join(' · ')||"Marche renseignée";
    if(key === "nutrition_vegetale") return [isPresent(v.calculated_meals)?`${v.calculated_meals}${isPresent(v.meal_count)?`/${v.meal_count}`:''} repas calculables`:"",isPresent(v.protein_g)?`${String(v.protein_g).replace('.',',')} g protéines`:"",isPresent(v.fiber_g)?`${String(v.fiber_g).replace('.',',')} g fibres`:""].filter(Boolean).join(' · ')||"Nutrition renseignée";
    return row?.note || "Repère renseigné";
  }
  function customTrackerDaily(row){
    const key=customTrackerKey(row?.tracker_key),v=row?.values&&typeof row.values==="object"?row.values:{};
    if(v._daily?.version===1){
      const signals=v._daily.signals||{};
      if(key==="cycle"){
        const event=signals.cycle_event||v._cycle_calendar_event,label=cleanCycleLabel(signals.cycle_phase||v.cycle_phase_estimate,event),cycleDay=signals.cycle_day||v.cycle_day_estimate;
        const pills=event==="ovulation_day"?["Ovulation"]:event==="ovulation_window"?["Fenêtre d’ovulation"]:event==="menstrual"?["Période menstruelle"]:(cycleDay?[`Cycle · J${cycleDay}`]:[]);
        return {...v._daily,key,title:v._daily.title||customTrackerTitle(key),headline:cycleDay?`J${cycleDay} · ${label}`:label,pills,metrics:[{label:"Jour du cycle",value:cycleDay?`J${cycleDay}`:""},{label:"Phase",value:label}].filter(item=>item.value),signals:{...signals,cycle_phase:label,cycle_event:event}};
      }
      return {...v._daily,key,title:v._daily.title||customTrackerTitle(key),pills:Array.isArray(v._daily.pills)?v._daily.pills:[],metrics:Array.isArray(v._daily.metrics)?v._daily.metrics:[],signals};
    }
    const metrics=[],pills=[],signals={};
    const metric=(label,value)=>{if(isPresent(value))metrics.push({label,value:String(value)});};
    const pill=(label,value)=>{if(isPresent(value))pills.push(`${label} · ${value}`);};
    if(key==="cycle"){
      pill("Cycle",v.cycle_day_estimate?`J${v.cycle_day_estimate}`:"renseigné");metric("Phase",v.cycle_phase_estimate);metric("Énergie",isPresent(v.energy)?`${v.energy}/10`:"");metric("Douleurs",isPresent(v.pain)?`${v.pain}/10`:"");metric("Appétit",isPresent(v.appetite)?`${v.appetite}/10`:"");
      Object.assign(signals,{cycle_day:asNumber(v.cycle_day_estimate),cycle_phase:v.cycle_phase_estimate||null,energy:asNumber(v.energy),pain:asNumber(v.pain),appetite:asNumber(v.appetite)});
    }else if(key==="performance_recuperation"){
      pill("Activité",v.duration?`${v.duration} min`:v.session||"renseignée");if(isPresent(v.recovery))pill("Récupération",`${v.recovery}/10`);
      metric("Activité",v._discipline);metric("Séance",v.session);metric("Durée",v.duration?`${v.duration} min`:"");metric("Intensité",isPresent(v.intensity)?`${v.intensity}/10`:"");metric("Énergie",isPresent(v.energy_before)?`${v.energy_before}/10`:"");metric("Récupération",isPresent(v.recovery)?`${v.recovery}/10`:"");
      Object.assign(signals,{discipline:v._discipline||null,sport_duration:asNumber(v.duration),sport_intensity:asNumber(v.intensity),energy:asNumber(v.energy_before),recovery:asNumber(v.recovery)});
    }else if(key==="sommeil_profond"){
      const duration=durationLabel(v._sleep_hours);pill("Sommeil",v.night_state||duration||"renseigné");if(isPresent(v.quality))pill("Qualité",`${v.quality}/10`);metric("Nuit",v.night_state);metric("Durée",duration);metric("Qualité",isPresent(v.quality)?`${v.quality}/10`:"");signals.sleep_minutes=asNumber(v._sleep_hours)===null?null:Math.round(Number(v._sleep_hours)*60);signals.sleep_quality=asNumber(v.quality);
    }else if(key==="digestion"){
      pill("Digestion",v.day_state||(isPresent(v.comfort)?`${v.comfort}/10`:"renseignée"));metric("Aujourd’hui",v.day_state);metric("Confort",isPresent(v.comfort)?`${v.comfort}/10`:"");metric("Ballonnements",isPresent(v.bloating)?`${v.bloating}/10`:"");metric("Transit",v.transit);signals.digestion=asNumber(v.comfort);signals.stress=asNumber(v.stress);
    }else if(key==="reflux"){
      const intensity=asNumber(v.intensity),none=/^Non/i.test(String(v.episode||"")),level=none?"aucun aujourd’hui":intensity===null?(v.episode||"renseigné"):intensity<=3?"léger":intensity<=6?"modéré":"marqué";pill("Reflux",level);metric("Aujourd’hui",v.episode);metric("Intensité",intensity===null?"":`${intensity}/10`);metric("Soulagement",v.relief);signals.reflux=none?0:intensity;
    }else if(key==="peau"){
      const score=average(v.blemishes,v.dryness,v.inflammation,v.sensitivity);pill("Peau",v.day_state||(score===null?"renseignée":`${score}/10`));metric("Aujourd’hui",v.day_state);metric("Rougeurs",isPresent(v.inflammation)?`${v.inflammation}/10`:"");metric("Sensibilité",isPresent(v.sensitivity)?`${v.sensitivity}/10`:"");signals.skin_discomfort=score;signals.stress=asNumber(v.stress);
    }else if(key==="jeune_intermit"){
      const duration=durationLabel(v._fast_hours),paused=/pause/i.test(String(v.fast_state||""));pill("Jeûne",paused?"pause":duration||v.fast_state||"renseigné");metric("Aujourd’hui",v.fast_state);metric("Durée",duration);metric("Énergie",isPresent(v.energy)?`${v.energy}/10`:"");signals.fast_minutes=paused||asNumber(v._fast_hours)===null?null:Math.round(Number(v._fast_hours)*60);signals.energy=asNumber(v.energy);
    }else if(key==="changer_habitude"){
      const done=/Petit pas réalisé/i.test(String(v.day_state||""))||!!String(v.victory||v.response||"").trim();pill("Habitude",v.day_state||(done?"petit pas réalisé":"renseignée"));metric("Aujourd’hui",v.day_state);metric("Habitude",v.habit);metric("Petit pas",v.victory);signals.habit_done=done;
    }else if(key==="equilibre_alimentaire"){
      const score=average(v.diversity,v.protein,v.plants,v.hydration,v.schedule);pill("Équilibre",score===null?"renseigné":`${score}/10`);metric("Protéines",isPresent(v.protein)?`${v.protein}/10`:"");metric("Végétaux",isPresent(v.plants)?`${v.plants}/10`:"");signals.nutrition_balance=score===null?null:score/10;
    }else if(key==="reduction_sucre"){
      pill("Sucre",v.craving_state||(isPresent(v.craving)?`envie ${v.craving}/10`:"renseigné"));metric("Aujourd’hui",v.craving_state);metric("Envie",isPresent(v.craving)?`${v.craving}/10`:"");metric("Déclencheur",v.trigger);signals.sugar_craving=v.craving_state==="Aucune"?0:asNumber(v.craving);signals.habit_done=v.no_added_sugar==="Oui";
    }else{
      pill(customTrackerTitle(key).split(" ")[0],"renseigné");metric("Résumé",customTrackerSummary(row));
    }
    return {version:1,key,title:customTrackerTitle(key),date:row?.entry_date||"",headline:customTrackerSummary(row),pills,metrics,signals};
  }
  function readLocalCyclePreference(userId){
    const aliases=[`mt_custom_trackers_v2_${userId||"guest"}`,`mt_custom_trackers_v1_${userId||"guest"}`];
    for(const storageKey of aliases){
      try{
        const raw=JSON.parse(localStorage.getItem(storageKey)||"{}");
        const pref=raw?.cycle;
        if(pref===true)return {enabled:true,settings:{}};
        if(pref?.enabled)return {enabled:true,settings:pref.settings&&typeof pref.settings==="object"?pref.settings:{}};
      }catch(e){}
    }
    return {enabled:false,settings:{}};
  }
  function cycleEstimateForDate(settings={},iso){
    const target=parseISO(iso);if(!target||Number.isNaN(target.getTime()))return null;
    const starts=[...new Set([...(Array.isArray(settings.period_starts)?settings.period_starts:[]),settings.last_period_start].filter(value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))))].sort();
    if(!starts.length)return null;
    const cycleLength=Math.min(45,Math.max(20,Number(settings.cycle_length)||28)),periodLength=Math.min(10,Math.max(1,Number(settings.period_length)||5));
    const eligible=starts.filter(value=>value<=iso),anchor=eligible.length?eligible[eligible.length-1]:starts[0],anchorDate=parseISO(anchor);
    const elapsed=Math.floor((target-anchorDate)/86400000),cycleDay=((elapsed%cycleLength)+cycleLength)%cycleLength+1,ovulationDay=Math.max(periodLength+3,cycleLength-14);
    let phase="Phase lutéale";
    if(cycleDay<=periodLength)phase="Période menstruelle";
    else if(cycleDay<ovulationDay-2)phase="Phase folliculaire";
    else if(cycleDay===ovulationDay)phase="Ovulation";
    else if(cycleDay<=ovulationDay+2)phase="Fenêtre d’ovulation";
    const cycleEvent=cycleDay<=periodLength
      ? "menstrual"
      : cycleDay===ovulationDay
        ? "ovulation_day"
        : (cycleDay>=ovulationDay-2&&cycleDay<=ovulationDay+2 ? "ovulation_window" : null);
    return {cycleDay,phase,cycleEvent,periodLength,ovulationDay};
  }
  function projectedCycleRow(settings,iso){
    const estimate=cycleEstimateForDate(settings,iso);if(!estimate)return null;
    const pills=estimate.cycleEvent==="ovulation_day"?["Ovulation"]:estimate.cycleEvent==="ovulation_window"?["Fenêtre d’ovulation"]:estimate.cycleEvent==="menstrual"?["Période menstruelle"]:[`Cycle · J${estimate.cycleDay}`];
    return {tracker_key:"cycle",entry_date:iso,note:null,projected:true,values:{cycle_day_estimate:estimate.cycleDay,cycle_phase_estimate:estimate.phase,_cycle_calendar_event:estimate.cycleEvent,_cycle_projection:true,_daily:{version:1,key:"cycle",title:"Cycle & rythme hormonal",date:iso,headline:`J${estimate.cycleDay} · ${estimate.phase}`,pills,metrics:[{label:"Jour du cycle",value:`J${estimate.cycleDay}`},{label:"Phase",value:estimate.phase}],signals:{cycle_day:estimate.cycleDay,cycle_phase:estimate.phase,cycle_event:estimate.cycleEvent}}}};
  }
  function mergeProjectedCycle(custom,settings,from,to){
    if(!settings?.last_period_start&&!Array.isArray(settings?.period_starts))return;
    for(let cursor=parseISO(from),end=parseISO(to);cursor<=end;cursor.setDate(cursor.getDate()+1)){
      const iso=dateToISO(cursor.getFullYear(),cursor.getMonth()+1,cursor.getDate()),rows=custom[iso]||(custom[iso]=[]);
      const projected=projectedCycleRow(settings,iso);if(!projected)continue;
      const existing=rows.find(row=>customTrackerKey(row.tracker_key)==="cycle");
      if(existing){
        existing.values={...(existing.values||{}),_cycle_calendar_event:projected.values._cycle_calendar_event};
        if(existing.values._daily)existing.values._daily={...existing.values._daily,signals:{...(existing.values._daily.signals||{}),cycle_event:projected.values._cycle_calendar_event}};
      }else rows.push(projected);
    }
  }
  function readLocalCustomEntries(userId, from, to){
    const grouped = {};
    try{
      const prefix = `mt_tracker_entry_${userId || "guest"}_`;
      for(let i=0;i<localStorage.length;i++){
        const key = localStorage.key(i); if(!key || !key.startsWith(prefix)) continue;
        const row = JSON.parse(localStorage.getItem(key) || "null");
        const iso = String(row?.entry_date || ""); if(!iso || iso < from || iso > to) continue;
        const normalized = { ...row, tracker_key:customTrackerKey(row.tracker_key) };
        grouped[iso] = grouped[iso] || [];
        const existing = grouped[iso].findIndex(x => customTrackerKey(x.tracker_key) === normalized.tracker_key);
        if(existing >= 0) grouped[iso][existing] = normalized; else grouped[iso].push(normalized);
      }
    }catch(e){}
    return grouped;
  }
  function aggregateFoodRows(rows){
    const grouped = {};
    (rows || []).forEach(row => {
      const iso = row.meal_date; if(!iso) return;
      const day = grouped[iso] || (grouped[iso] = { count:0,calculated_count:0,energy:[],digestion:[],satiety:[],protein_total:0,fiber_total:0,kcal_total:0,protein_known:0,fiber_known:0,kcal_known:0 });
      day.count++;
      const calculated=Array.isArray(row.food_meal_items)&&row.food_meal_items.length>0;
      if(calculated){
        day.calculated_count++;
        if(row.protein_total!==null&&row.protein_total!==undefined){day.protein_total+=Number(row.protein_total)||0;day.protein_known++;}
        if(row.fiber_total!==null&&row.fiber_total!==undefined){day.fiber_total+=Number(row.fiber_total)||0;day.fiber_known++;}
        if(row.kcal_total!==null&&row.kcal_total!==undefined){day.kcal_total+=Number(row.kcal_total)||0;day.kcal_known++;}
      }
      [["energy",row.energy_after],["digestion",row.digestion_after],["satiety",row.satiety_after]].forEach(([key,value]) => { const n=Number(value); if(n>0) day[key].push(n); });
    });
    Object.values(grouped).forEach(day => {
      ["energy","digestion","satiety"].forEach(key => { const values=day[key]; day[key]=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10:null; });
      day.pills=[`Alimentation · ${day.count} repas`];

      if(day.calculated_count>0){
        const proteinPerMeal=day.protein_known?day.protein_total/day.protein_known:null;
        const fiberPerMeal=day.fiber_known?day.fiber_total/day.fiber_known:null;
        day.protein_label=proteinPerMeal===null?"Non renseignées":proteinPerMeal>=15?"Bonne présence de protéines":proteinPerMeal>=7?"Présence de protéines modérée":"Protéines à compléter";
        day.plants_label=fiberPerMeal===null?"Non renseignées":fiberPerMeal>=5?"Bonne présence de fibres et végétaux":fiberPerMeal>=2.5?"Présence végétale modérée":"Fibres et végétaux à compléter";

        // Même philosophie que Mon Équilibre V365 : le nombre de repas est
        // descriptif et n'entre jamais dans la note nutritionnelle.
        const components=[];
        if(proteinPerMeal!==null)components.push({value:Math.min(1,proteinPerMeal/20),weight:.45});
        if(fiberPerMeal!==null)components.push({value:Math.min(1,fiberPerMeal/6),weight:.40});
        if(components.length&&day.satiety!==null)components.push({value:Math.min(1,day.satiety/10),weight:.15});
        const totalWeight=components.reduce((sum,item)=>sum+item.weight,0);
        day.nutrition_balance=totalWeight?Math.round((components.reduce((sum,item)=>sum+item.value*item.weight,0)/totalWeight)*100)/100:null;

        const calcLabel=day.calculated_count===day.count
          ? `${day.calculated_count} sur ${day.count}`
          : `Partiel · ${day.calculated_count} sur ${day.count}`;
        day.metrics=[
          {label:"Repas renseignés",value:String(day.count)},
          {label:"Repères nutritionnels",value:calcLabel},
          {label:"Protéines",value:day.protein_label},
          {label:"Végétaux / fibres",value:day.plants_label}
        ];
      }else{
        day.nutrition_balance=null;
        day.metrics=[
          {label:"Repas renseignés",value:String(day.count)},
          {label:"Repères nutritionnels",value:"Non calculés"}
        ];
      }

      if(day.energy!==null)day.metrics.push({label:"Énergie après repas",value:`${day.energy}/10`});
      if(day.digestion!==null)day.metrics.push({label:"Digestion",value:`${day.digestion}/10`});
      if(day.satiety!==null)day.metrics.push({label:"Satiété",value:`${day.satiety}/10`});
    });
    return grouped;
  }
  function installV341JournalStyles(){
    if(document.getElementById("mt-journal-v341-css")) return;
    const style=document.createElement("style");style.id="mt-journal-v341-css";style.textContent=`
      .jcal-signal-cluster{position:absolute;z-index:2;top:5px;right:5px;display:flex;align-items:center;justify-content:flex-end;gap:2px;max-width:calc(100% - 10px);min-height:8px}.jcal-signal{display:block;width:8px;height:5px;border-radius:999px;background:#567a70;box-shadow:0 0 0 1.5px rgba(255,252,247,.86)}.jcal-signal.is-menstrual{width:10px;background:#b63a48}.jcal-signal.is-ovulation-window{background:#d7bb75}.jcal-signal.is-ovulation-day{width:7px;height:7px;border-radius:50%;background:#c49535;box-shadow:0 0 0 2px rgba(255,252,247,.92),0 0 0 3px rgba(196,149,53,.32)}.jcal-signal.is-journey-complete{background:#184e45}.jcal-signal.is-journey-partial{background:#c49b4c}.jcal-signal.is-custom{background:#8d745c}.jcal-signal.is-food{background:#80946f}.jcal-signal-more{display:grid;place-items:center;min-width:13px;height:11px;padding:0 2px;border-radius:999px;background:#efe3cb;color:#745927;font-size:6.5px;font-weight:950;line-height:1;box-shadow:0 0 0 1px rgba(255,252,247,.88)}.jcal-cell.jcal-today .jcal-signal{box-shadow:0 0 0 1.5px #153d39}.jcal-cell.jcal-today .jcal-signal:not(.is-menstrual):not(.is-ovulation-day):not(.is-ovulation-window){background:#f1ddad}.jcal-cell.jcal-today .jcal-signal-more{background:#fff7e8;color:#654d20}
      .jday-dynamic-pills{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0}.jday-dynamic-pill{border-radius:999px;background:rgba(23,63,53,.075);color:#173f35;padding:8px 10px;font-size:11px;font-weight:850}.jday-dynamic-pill.is-period{background:rgba(166,48,58,.12);color:#972b37;border:1px solid rgba(166,48,58,.16)}.jday-linked-card .jday-metric-list{display:grid;gap:6px;margin-top:10px}.jday-linked-card .jday-metric{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;color:#806f61;font-size:11px;line-height:1.35}.jday-linked-card .jday-metric b{display:block;color:#173f35;text-align:right}.jday-linked-card .jday-food-note{margin:9px 0 0;color:#806f61;font-size:11px;line-height:1.45}
      .jday-linked-list{display:grid;gap:10px;margin:14px 0}.jday-linked-card{width:100%;border:1px solid rgba(23,63,53,.10);border-radius:19px;background:rgba(255,252,247,.75);padding:14px;text-align:left;color:#173f35}.jday-linked-card small{display:block;color:#b18843;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.jday-linked-card b{display:block;margin:5px 0 3px;font-family:Georgia,serif;font-size:19px;font-weight:500}.jday-linked-card span{display:block;color:#806f61;font-size:12px;line-height:1.4}.jday-linked-card em{display:block;margin-top:9px;color:#173f35;font-size:11px;font-style:normal;font-weight:900}.jday-badge-button{border:0;font:inherit;text-align:left}
      .jform-opening{min-height:230px;display:grid;place-items:center;text-align:center}.jform-opening small{display:block;color:#b18843;font-size:10px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}.jform-opening b{display:block;color:#173f35;font-family:Georgia,serif;font-size:30px;font-weight:400;margin:7px 0}.jform-opening p{margin:0;color:#806f61}.jform-opening i{display:inline-block;width:25px;height:25px;border:2px solid rgba(23,63,53,.14);border-top-color:#173f35;border-radius:50%;margin-top:18px;animation:mtJournalOpenSpin .8s linear infinite}@keyframes mtJournalOpenSpin{to{transform:rotate(360deg)}}.jform-slider.is-unset{opacity:.38}.jform-slider-val.is-unset{color:#9c9086;font-size:10.5px;white-space:nowrap}.jform-draft-note{margin:10px 0 0;text-align:center;color:#9a8c80;font-size:10.5px;line-height:1.4}.jform-protocol-zone{margin:24px 0 5px;padding-top:21px;border-top:1px solid rgba(190,166,124,.25)}.jform-protocol-zone>small{display:block;color:#b18843;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.jform-protocol-zone>h3{margin:6px 0 5px;color:#173f35;font-family:Georgia,serif;font-size:22px;font-weight:400}.jform-protocol-zone>p{margin:0 0 13px;color:#84766a;font-size:11.5px;line-height:1.5}.jform-protocol-card{margin:9px 0;padding:13px 14px;border:1px solid rgba(190,166,124,.24);border-radius:18px;background:rgba(255,250,241,.72)}.jform-protocol-card>small{color:#aa8139;font-size:9.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.jform-protocol-card>b{display:block;margin:4px 0 2px;color:#24483d;font-size:13px}.jform-protocol-card>em{display:block;color:#9a8b7e;font-size:10.5px;font-style:normal}.jform-protocol-qa{margin-top:10px}.jform-protocol-qa div{padding:8px 0;border-top:1px solid rgba(221,207,185,.55)}.jform-protocol-qa strong{display:block;color:#75675c;font-size:10.5px}.jform-protocol-qa p{margin:3px 0 0;color:#29483f;font-size:12px;line-height:1.45}
      @media(max-width:520px){.jcal-cell{min-height:58px!important;gap:3px!important}.jcal-num{line-height:1}.jcal-signal-cluster{top:5px;right:4px;gap:1px}.jcal-signal{width:7px}.jcal-signal-more{min-width:12px;padding:0 1px}}
      @media(prefers-reduced-motion:reduce){.jform-opening i{animation:none}}
    `;document.head.appendChild(style);
  }

  function dailyJournalKey(){
    return `mt_daily_journal_entries_v2_${activeLocalUserId()}`;
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
      const prefix=`mt_private_journal_${activeLocalUserId()}_`;
      for(let i=0;i<localStorage.length;i++){
        const key = localStorage.key(i);
        if(!key || !key.startsWith(prefix)) continue;
        const item = JSON.parse(localStorage.getItem(key) || "{}");
        const iso = item.date || (item.updated_at ? String(item.updated_at).slice(0,10) : todayISO());
        out[iso]=out[iso]||[];
        out[iso].push({
          id:key,
          entry_date:iso,
          protocol_id:String(item.protocol_id||""),
          content_id:String(item.content_id||""),
          protocol_title:item.protocol_title||"",
          journal_title:item.title||"Ressenti du protocole",
          protocol_day:Number(item.protocol_day)||null,
          signals:item.signals&&typeof item.signals==="object"?item.signals:{},
          note_libre:Object.values(item.answers||{}).filter(Boolean).slice(0,2).join(" · ")||null,
          answers:{questions:item.questions||[],answers:item.answers||{},source:"local_protocol_journal",content_id:item.content_id||""},
          updated_at:item.updated_at||null,
          source:"local_protocol_journal"
        });
      }
    }catch(e){}
    return out;
  }

  function isLegacyProtocolOnly(row){
    if(!row||typeof row!=="object")return false;
    const source=String(row?.answers?.source||"");
    const looksProtocol=row.has_protocol_journal===true||source==="protocol_journal"||source==="local_protocol_journal";
    if(!looksProtocol)return false;
    const hasDailySignals=!!row.mood||
      ["tracker_stress","tracker_energie","tracker_digestion","tracker_sommeil","tracker_humeur"].some(k=>Number(row[k])>0)||
      !!row?.answers?.libre;
    return !hasDailySignals;
  }

  function journalDraftKey(iso){
    return `mt_daily_journal_draft_v1_${activeLocalUserId()}_${iso}`;
  }
  function readJournalDraft(iso){
    try{return JSON.parse(localStorage.getItem(journalDraftKey(iso))||"null");}catch(e){return null;}
  }
  function writeJournalDraft(iso,payload){
    try{localStorage.setItem(journalDraftKey(iso),JSON.stringify({...payload,updated_at:new Date().toISOString()}));}catch(e){}
  }
  function clearJournalDraft(iso){
    try{localStorage.removeItem(journalDraftKey(iso));}catch(e){}
  }


  // ─── Activity tracking (hook public) ─────────────────────
  window.mtJournalTrack = async function(type) {
    const iso = todayISO();

    // Toujours enregistrer localement pour que le calendrier réagisse immédiatement.
    upsertLocalActivity(type, iso);

    const c = getClient();
    const u = await getUser();
    const field = activityField(type, "remote");
    if (!field) return;

    if (c && u) {
      const { error } = await c.from("daily_activity").upsert(
        { user_id: u.id, activity_date: iso, [field]: true, updated_at: new Date().toISOString() },
        { onConflict: "user_id,activity_date", ignoreDuplicates: false }
      );
      if(error) console.warn("[Mon parcours] daily_activity error", error);
      else if(type==='journal'&&window.mtGardenAwardDaily) await window.mtGardenAwardDaily('journal',iso);
    }

    if (window.mtRefreshParcoursCalendar) window.mtRefreshParcoursCalendar();

    // Tous les points d'entrée historiques (protocole, checklist, tracker,
    // photo, etc.) préviennent aussi Mon Équilibre. Les écrans récents
    // peuvent fournir un état plus précis juste après ; le rafraîchissement
    // est temporisé côté équilibre et conservera alors le dernier état reçu.
    window.dispatchEvent(new CustomEvent('mt:daily-state-changed', {
      detail: { source: type }
    }));
  };

  // ─── Fetch helpers ────────────────────────────────────────
  async function fetchMonthActivity(year, month) {
    const c = getClient(), u = await getUser();
    const from = dateToISO(year, month, 1);
    const to = dateToISO(year, month, new Date(year, month, 0).getDate());

    const activity = {};
    const journal = {};
    const custom = {};
    let food = {};
    let cyclePreference=readLocalCyclePreference(u?.id||"guest");

    if (c && u) {
      const monthSummaryPromise=window.mtCommunityJourneyGetProfileSummary ? window.mtCommunityJourneyGetProfileSummary(dateToISO(year,month,Math.min(new Date().getDate(),new Date(year,month,0).getDate()))) : Promise.resolve(null);
      const [actRes, jRes, customRes, foodRes, journeySummary, cyclePrefRes] = await Promise.all([
        c.from("daily_activity").select("activity_date,today_checks,hydration_liters,sleep_hours,has_hydration,has_sleep,has_protocol,has_routine,has_ritual,has_checklist,has_tracker,has_journal,has_photo,has_recipe,protocol_id,protocol_title,protocol_day").eq("user_id", u.id).gte("activity_date", from).lte("activity_date", to),
        c.from("journal_entries").select("entry_date,mood,note_libre,tracker_stress,tracker_energie,tracker_digestion,tracker_sommeil,tracker_humeur,protocol_title,protocol_day,answers").eq("user_id", u.id).gte("entry_date", from).lte("entry_date", to),
        c.from("user_tracker_entries").select("tracker_key,entry_date,values,note,updated_at").eq("user_id", u.id).gte("entry_date", from).lte("entry_date", to),
        c.from("food_meals").select("meal_date,kcal_total,protein_total,fiber_total,energy_after,digestion_after,satiety_after,food_meal_items(id)").eq("user_id", u.id).gte("meal_date", from).lte("meal_date", to),
        monthSummaryPromise,
        c.from("user_tracker_preferences").select("enabled,settings").eq("user_id",u.id).eq("tracker_key","cycle").maybeSingle()
      ]);
      if(cyclePrefRes?.data?.enabled)cyclePreference={enabled:true,settings:cyclePrefRes.data.settings&&typeof cyclePrefRes.data.settings==="object"?cyclePrefRes.data.settings:{}};
      window.__MT_JOURNEY_MONTH_DAYS__={};
      (journeySummary?.days||[]).forEach(r=>{window.__MT_JOURNEY_MONTH_DAYS__[r.journey_date]=r;});
      window.__MT_JOURNEY_CAL_SETTINGS__=journeySummary?.settings||{};
      (actRes.data || []).forEach(r => { activity[r.activity_date] = r; });
      (jRes.data || []).forEach(r => { if(!isLegacyProtocolOnly(r))journal[r.entry_date] = r; });
      (customRes.data || []).forEach(r => {
        const iso=String(r.entry_date || ""); if(!iso) return;
        custom[iso]=custom[iso]||[];
        const row={...r,tracker_key:customTrackerKey(r.tracker_key)};
        const existing=custom[iso].findIndex(x=>customTrackerKey(x.tracker_key)===row.tracker_key);
        if(existing>=0)custom[iso][existing]=row;else custom[iso].push(row);
      });
      food=aggregateFoodRows(foodRes.data || []);
    }

    const localActivity = readLocalActivity();
    Object.keys(localActivity || {}).forEach(iso => {
      if(iso >= from && iso <= to){
        activity[iso] = { ...(activity[iso] || { activity_date: iso }), ...localActivity[iso] };
      }
    });

    // Synchronisation immédiate des suivis gérés depuis Aujourd’hui (hydratation, routine, protocole, rituels).
    const localUserId = u?.id || 'guest';
    for(let d=1; d<=new Date(year, month, 0).getDate(); d++){
      const iso = dateToISO(year, month, d);
      const hydration = readHydrationFor(localUserId, iso);
      const sleep = readSleepFor(localUserId, iso);
      const checks = readTodayChecksFor(localUserId, iso);
      if(hydration > 0 || sleep > 0 || Object.keys(checks).length){
        const merged = mergeTodayChecksIntoActivity(activity[iso], iso, checks);
        if(hydration > 0){ merged.has_hydration = true; merged.hydration_liters = hydration; }
        if(sleep > 0){ merged.has_sleep = true; merged.sleep_hours = sleep; }
        activity[iso] = merged;
      }
    }

    const daily = readDailyJournals();
    Object.keys(daily || {}).forEach(iso => {
      if(iso >= from && iso <= to){
        journal[iso] = { ...(journal[iso] || {}), ...daily[iso], source: "daily_journal" };
        activity[iso] = { ...(activity[iso] || { activity_date: iso }), has_journal: true };
      }
    });

    const localJournals = readLocalProtocolJournals();
    Object.keys(localJournals || {}).forEach(iso => {
      if(iso >= from && iso <= to && (localJournals[iso]||[]).length){
        activity[iso] = { ...(activity[iso] || { activity_date: iso }), has_journal: true };
      }
    });

    const localCustom=readLocalCustomEntries(u?.id || "guest",from,to);
    Object.keys(localCustom).forEach(iso => {
      custom[iso]=custom[iso]||[];
      localCustom[iso].forEach(row => {
        const key=customTrackerKey(row.tracker_key),existing=custom[iso].findIndex(x=>customTrackerKey(x.tracker_key)===key);
        if(existing>=0)custom[iso][existing]={...custom[iso][existing],...row,tracker_key:key};else custom[iso].push({...row,tracker_key:key});
      });
    });

    // Le calcul quotidien reste disponible dans le détail, mais le calendrier
    // ne montre un repère que pour les règles et l'ovulation.
    if(cyclePreference.enabled)mergeProjectedCycle(custom,cyclePreference.settings,from,to);

    return { activity, journal, custom, food };
  }

  async function fetchDayDetail(iso) {
    const c = getClient(), u = await getUser();
    let act = null, jrn = null, protocolJournalRows = [], trackerRows = [], customRows = [], foodRows = [], routineRows = [];

    if (c && u) {
      const [actRes, jRes, protocolJournalRes, trackerRes, customRes, foodRes, routineRes] = await Promise.all([
        c.from("daily_activity").select("*").eq("user_id", u.id).eq("activity_date", iso).maybeSingle(),
        c.from("journal_entries").select("*").eq("user_id", u.id).eq("entry_date", iso).maybeSingle(),
        c.from("protocol_journal_entries").select("id,entry_date,protocol_id,content_id,protocol_title,journal_title,protocol_day,note_libre,answers,signals,updated_at").eq("user_id",u.id).eq("entry_date",iso).order("updated_at",{ascending:true}),
        c.from("tracker_entries").select("content_id,protocol_id,values,field_schema").eq("user_id", u.id).eq("entry_date", iso),
        c.from("user_tracker_entries").select("tracker_key,entry_date,values,note,updated_at").eq("user_id", u.id).eq("entry_date", iso),
        c.from("food_meals").select("meal_date,meal_type,kcal_total,protein_total,fiber_total,energy_after,digestion_after,satiety_after,food_meal_items(id)").eq("user_id", u.id).eq("meal_date", iso),
        c.from("user_routine_entries").select("routine_id,completed,completed_at,step_state,user_routines(title,daypart,steps)").eq("user_id",u.id).eq("entry_date",iso).eq("completed",true)
      ]);
      act = actRes.data || null;
      jrn = isLegacyProtocolOnly(jRes.data) ? null : (jRes.data || null);
      protocolJournalRows = Array.isArray(protocolJournalRes?.data) ? protocolJournalRes.data : [];
      trackerRows = Array.isArray(trackerRes?.data) ? trackerRes.data : [];
      customRows = Array.isArray(customRes?.data) ? customRes.data.map(row=>({...row,tracker_key:customTrackerKey(row.tracker_key)})) : [];
      foodRows = Array.isArray(foodRes?.data) ? foodRes.data : [];
      routineRows = Array.isArray(routineRes?.data) ? routineRes.data : [];

      if (trackerRows.length) {
        try {
          const contentIds = [...new Set(trackerRows.map(r => r.content_id).filter(Boolean))];
          const protocolIds = [...new Set(trackerRows.map(r => r.protocol_id).filter(Boolean))];
          const [contentsRes, protocolsRes] = await Promise.all([
            contentIds.length ? c.from("protocol_contents").select("id,title").in("id", contentIds) : Promise.resolve({data:[]}),
            protocolIds.length ? c.from("protocols").select("id,title").in("id", protocolIds) : Promise.resolve({data:[]})
          ]);
          const contentNames = Object.fromEntries((contentsRes?.data || []).map(x => [String(x.id), x.title]));
          const protocolNames = Object.fromEntries((protocolsRes?.data || []).map(x => [String(x.id), x.title]));
          trackerRows = trackerRows.map(row => ({
            ...row,
            tracker_title: contentNames[String(row.content_id)] || "Tracker",
            protocol_title: protocolNames[String(row.protocol_id)] || ""
          }));
        } catch (e) {
          console.warn("[Mon parcours] noms des trackers indisponibles", e);
        }
      }
    }

    const localActivity = readLocalActivity()[iso] || null;
    const localDaily = readDailyJournal(iso);
    const localProtocolRows = readLocalProtocolJournals()[iso] || [];
    const localUserId = u?.id || 'guest';
    const checks = readTodayChecksFor(localUserId, iso);
    const hydration = readHydrationFor(localUserId, iso);
    const sleep = readSleepFor(localUserId, iso);

    let activity = { ...(act || {}), ...(localActivity || {}) };
    activity = mergeTodayChecksIntoActivity(activity, iso, checks);
    if(hydration > 0){ activity.has_hydration = true; activity.hydration_liters = hydration; }
    if(sleep > 0){ activity.has_sleep = true; activity.sleep_hours = sleep; }
    const journalEntry = localDaily ? { ...(jrn || {}), ...localDaily, source:"daily_journal" } : (jrn || null);
    const protocolMap=new Map();
    protocolJournalRows.forEach(row=>protocolMap.set(`${row.protocol_id||""}__${row.content_id||row.id||""}`,row));
    localProtocolRows.forEach(row=>protocolMap.set(`${row.protocol_id||""}__${row.content_id||row.id||""}`,{...(protocolMap.get(`${row.protocol_id||""}__${row.content_id||row.id||""}`)||{}),...row}));
    const protocolJournals=[...protocolMap.values()].sort((a,b)=>String(a.updated_at||"").localeCompare(String(b.updated_at||"")));
    if (journalEntry || protocolJournals.length) activity.has_journal = true;

    const localCustom=readLocalCustomEntries(localUserId,iso,iso)[iso]||[];
    localCustom.forEach(row=>{
      const key=customTrackerKey(row.tracker_key),existing=customRows.findIndex(x=>customTrackerKey(x.tracker_key)===key);
      if(existing>=0)customRows[existing]={...customRows[existing],...row,tracker_key:key};else customRows.push({...row,tracker_key:key});
    });
    if(!customRows.some(row=>customTrackerKey(row.tracker_key)==="cycle")){
      let cyclePreference=readLocalCyclePreference(localUserId);
      if(c&&u){try{const prefRes=await c.from("user_tracker_preferences").select("enabled,settings").eq("user_id",u.id).eq("tracker_key","cycle").maybeSingle();if(prefRes?.data?.enabled)cyclePreference={enabled:true,settings:prefRes.data.settings||{}};}catch(e){}}
      if(cyclePreference.enabled){const projected=projectedCycleRow(cyclePreference.settings,iso);if(projected)customRows.push(projected);}
    }

    let journey=null;
    if(c&&u){try{const jr=await c.rpc('community_journey_payload',{target_date:iso});journey=jr.data||null;}catch(e){}}
    const foodSummary=aggregateFoodRows(foodRows)[iso]||null;
    return { activity, journal: journalEntry, protocolJournals, journey, trackers: trackerRows, customTrackers:customRows, foodSummary, routines:routineRows };
  }

  async function fetchJournalEntry(iso) {
    // Fallback localStorage immédiat
    const localFallback = readDailyJournal(iso);
    const c = getClient(), u = await getUser();
    if (!c || !u) return localFallback;
    const { data, error } = await c.from("journal_entries").select("*").eq("user_id", u.id).eq("entry_date", iso).maybeSingle();
    if (error || !data || isLegacyProtocolOnly(data)) return localFallback;
    // Merge : Supabase + local (local priority pour les champs rédigés non encore sync)
    return localFallback ? { ...data, ...localFallback, entry_date: iso } : data;
  }

  async function fetchProtocolJournalsForDate(iso){
    const localRows=readLocalProtocolJournals()[iso]||[],remoteRows=[];
    const c=getClient(),u=await getUser();
    if(c&&u){
      try{
        const {data}=await c.from("protocol_journal_entries")
          .select("id,entry_date,protocol_id,content_id,protocol_title,journal_title,protocol_day,note_libre,answers,signals,updated_at")
          .eq("user_id",u.id).eq("entry_date",iso).order("updated_at",{ascending:true});
        if(Array.isArray(data))remoteRows.push(...data);
      }catch(e){}
    }
    const map=new Map();
    remoteRows.forEach(row=>map.set(`${row.protocol_id||""}__${row.content_id||row.id||""}`,row));
    localRows.forEach(row=>{
      const key=`${row.protocol_id||""}__${row.content_id||row.id||""}`;
      const previous=map.get(key)||{};
      const prevAt=Date.parse(previous.updated_at||0)||0,localAt=Date.parse(row.updated_at||0)||0;
      map.set(key,localAt>=prevAt?{...previous,...row}:previous);
    });
    return [...map.values()].sort((a,b)=>String(a.updated_at||"").localeCompare(String(b.updated_at||"")));
  }

  async function saveJournalEntry(iso, payload) {
    const localEntry = {
      entry_date: iso,
      protocol_id: null,
      protocol_title: "Journal privé",
      protocol_day: null,
      mood: payload.mood || null,
      note_libre: payload.note_libre || "",
      answers: payload.answers || {},
      tracker_stress: payload.tracker_stress ?? null,
      tracker_energie: payload.tracker_energie ?? null,
      tracker_digestion: payload.tracker_digestion ?? null,
      tracker_sommeil: payload.tracker_sommeil ?? null,
      tracker_humeur: payload.tracker_humeur ?? null,
      has_protocol_journal: false,
      source: "daily_journal"
    };

    // Sauvegarde immédiate locale : le jour reste visible même si Supabase est lent.
    writeDailyJournal(iso, localEntry);

    const c = getClient(), u = await getUser();
    if (c && u) {
      const entry = {
        user_id:u.id,
        entry_date:iso,
        protocol_id:null,
        protocol_title:"Journal privé",
        protocol_day:null,
        has_protocol_journal:false,
        mood:payload.mood||null,
        note_libre:payload.note_libre||null,
        answers:payload.answers||{},
        tracker_stress:payload.tracker_stress??null,
        tracker_energie:payload.tracker_energie??null,
        tracker_digestion:payload.tracker_digestion??null,
        tracker_sommeil:payload.tracker_sommeil??null,
        tracker_humeur:payload.tracker_humeur??null,
        updated_at:new Date().toISOString()
      };
      const { error } = await c.from("journal_entries").upsert(entry, { onConflict: "user_id,entry_date" });
      if (error) console.warn("[Journal] save supabase error", error);
      // Le journal quotidien ne rattache plus artificiellement la journée au protocole actif.
      await c.from("daily_activity").upsert(
        { user_id:u.id, activity_date:iso, has_journal:true, updated_at:new Date().toISOString() },
        { onConflict:"user_id,activity_date" }
      );
    }

    await window.mtJournalTrack("journal");
    window.dispatchEvent(new CustomEvent('mt:daily-state-changed',{detail:{source:'journal'}}));
    if (window.mtRefreshParcoursCalendar) window.mtRefreshParcoursCalendar();
    return true;
  }

  // ─── Calendar render ──────────────────────────────────────
  function cycleCalendarEvent(row){
    if(customTrackerKey(row?.tracker_key)!=="cycle")return null;
    const values=row?.values||{},daily=values._daily||{},signals=daily.signals||{};
    return signals.cycle_event||values._cycle_calendar_event||null;
  }
  function calendarSignalHTML(signals){
    const unique=[];
    (signals||[]).forEach(signal=>{
      if(!signal?.key||unique.some(item=>item.key===signal.key))return;
      unique.push(signal);
    });
    if(!unique.length)return "";
    const visible=unique.slice(0,3),remaining=unique.length-visible.length;
    const label=unique.map(item=>item.label).join(" · ");
    return `<span class="jcal-signal-cluster" title="${safe(label)}" aria-label="${safe(label)}">${visible.map(item=>`<span class="jcal-signal is-${safe(item.kind||"activity")}" aria-hidden="true"></span>`).join("")}${remaining?`<span class="jcal-signal-more" aria-hidden="true">+${remaining}</span>`:""}</span>`;
  }
  function renderCalendar(year, month, activity, journal, custom, food, today, idPrefix="jcal") {
    const firstDay = new Date(year, month-1, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    let cells = "";
    for (let i = 0; i < offset; i++) cells += `<div class="jcal-cell jcal-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = dateToISO(year, month, d);
      const act = activity[iso], jrn = journal[iso], journey=window.__MT_JOURNEY_MONTH_DAYS__?.[iso];
      const customRows=custom?.[iso]||[],recordedCustomRows=customRows.filter(row=>!row.projected&&!row.values?._cycle_projection),foodDay=food?.[iso]||null;
      const isToday = iso === today;
      const signals=[];
      if(window.__MT_JOURNEY_CAL_SETTINGS__?.show_calendar_participation!==false&&journey&&(journey.participated||Number(journey.completed)>0))signals.push({key:'journey',kind:Number(journey.total)>0&&Number(journey.completed)>=Number(journey.total)?'journey-complete':'journey-partial',label:`Notre journée · ${Number(journey.completed||0)} / ${Number(journey.total||0)}`});
      const cycleRow=customRows.find(row=>customTrackerKey(row.tracker_key)==="cycle"),cycleEvent=cycleCalendarEvent(cycleRow);
      if(cycleEvent==='menstrual')signals.push({key:'cycle-menstrual',kind:'menstrual',label:'Période menstruelle'});
      if(cycleEvent==='ovulation_window')signals.push({key:'cycle-window',kind:'ovulation-window',label:"Fenêtre d’ovulation"});
      if(cycleEvent==='ovulation_day')signals.push({key:'cycle-day',kind:'ovulation-day',label:'Ovulation'});
      if(act?.has_protocol)signals.push({key:'protocol',label:'Protocole'});
      if(act?.has_hydration)signals.push({key:'hydration',label:'Hydratation'});
      if(act?.has_sleep)signals.push({key:'sleep',label:'Sommeil'});
      if(act?.has_checklist)signals.push({key:'checklist',label:'Checklist'});
      if(act?.has_tracker)signals.push({key:'tracker',label:'Tracker'});
      if(jrn||act?.has_journal)signals.push({key:'journal',label:'Journal'});
      if(act?.has_photo)signals.push({key:'photo',label:'Photo'});
      if(act?.has_routine)signals.push({key:'routine',label:'Routine'});
      if(act?.has_ritual)signals.push({key:'ritual',label:'Rituel'});
      if(act?.has_recipe)signals.push({key:'recipe',label:'Recette'});
      if(Number(foodDay?.count||0)>0)signals.push({key:'food',kind:'food',label:`Alimentation · ${Number(foodDay.count)} repas`});
      recordedCustomRows.forEach(row=>signals.push({key:`custom-${customTrackerKey(row.tracker_key)}`,kind:'custom',label:customTrackerTitle(row.tracker_key)}));
      const hasAct=signals.length>0,signalHTML=calendarSignalHTML(signals);
      cells += `<button class="jcal-cell${isToday?" jcal-today":""}${hasAct||jrn?" jcal-has-data":""}" data-date="${iso}" onclick="window.mtJournalOpenDay('${iso}')">
        <span class="jcal-num">${d}</span>
        ${signalHTML}
      </button>`;
    }
    return `
      <div class="jcal-header">
        <button class="jcal-nav" id="${safe(idPrefix)}Prev">‹</button>
        <span class="jcal-month-label">${MONTHS_FR[month-1]} ${year}</span>
        <button class="jcal-nav" id="${safe(idPrefix)}Next">›</button>
      </div>
      <div class="jcal-weekdays">${DAYS_FR.map(d=>`<span>${d}</span>`).join("")}</div>
      <div class="jcal-grid">${cells}</div>`;
  }

  // ─── Day detail ───────────────────────────────────────────
  function renderDayModal(iso, data) {
    const { activity: act, journal: jrn, protocolJournals = [], journey, trackers = [], customTrackers = [], foodSummary = null, routines = [] } = data || {};
    const label = formatDayFR(iso);
    const customDaily=customTrackers.map(customTrackerDaily);
    const isEstimatedPeriod=customDaily.some(daily=>daily.key==="cycle"&&/menstruelle/i.test(String(daily?.signals?.cycle_phase||"")));
    const metricListHTML=metrics=>Array.isArray(metrics)&&metrics.length?`<span class="jday-metric-list">${metrics.map(item=>`<span class="jday-metric"><span>${safe(item.label)}</span><b>${safe(item.value)}</b></span>`).join('')}</span>`:'';
    function trackerBar(val, lbl) {
      if (!val) return "";
      const pct = Math.round((Number(val)/10)*100);
      const color = val >= 7 ? "#4a7c5f" : val >= 4 ? "#C9A96E" : "#9E4B43";
      return `<div class="jday-tracker-row"><span class="jday-tracker-label">${lbl}</span><div class="jday-tracker-bar"><div class="jday-tracker-fill" style="width:${pct}%;background:${color}"></div></div><span class="jday-tracker-val">${val}/10</span></div>`;
    }
    const activityDefinitions = [
      { flag:"has_protocol",  icon:"movement", cls:"badge-green", label:"Protocole", detail:() => act?.protocol_title ? `${act.protocol_title}${act.protocol_day ? ` · jour ${act.protocol_day}` : ""}` : "" },
      { flag:"has_hydration", icon:"hydration", cls:"badge-blue", label:"Hydratation", detail:() => act?.hydration_liters ? `${String(act.hydration_liters).replace(".", ",")} L` : "" },
      { flag:"has_sleep",     icon:"sleep", cls:"badge-muted", label:"Sommeil", detail:() => act?.sleep_hours ? `${String(act.sleep_hours).replace(".", ",")} h` : "" },
      { flag:"has_routine",   icon:"leaf", cls:"badge-muted", label:routines.length>1?"Routines":"Routine", detail:() => routines.length ? routines.map(r=>r.user_routines?.title||"Routine").slice(0,3).join(" · ") : "" },
      { flag:"has_ritual",    icon:"seed", cls:"badge-sage", label:"Rituel" },
      { flag:"has_checklist", icon:"check", cls:"badge-green", label:"Checklist" },
      { flag:"has_photo",     icon:"sparkle", cls:"badge-rose", label:"Photo" },
      { flag:"has_recipe",    icon:"bowl", cls:"badge-muted", label:"Recette" }
    ];

    const knownFlags = new Set(activityDefinitions.map(x => x.flag).concat(["has_tracker","has_journal"]));
    const dynamicDefinitions = Object.keys(act || {})
      .filter(key => key.startsWith("has_") && act[key] === true && !knownFlags.has(key))
      .map(key => ({
        flag:key,
        icon:"sparkle",
        cls:"badge-muted",
        label:key.slice(4).replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase())
      }));

    const activityItems = activityDefinitions.concat(dynamicDefinitions)
      .filter(item => act?.[item.flag])
      .map(item => ({
        icon:item.icon,
        cls:item.cls,
        label:item.label,
        detail:typeof item.detail === "function" ? item.detail() : ""
      }));

    if (act?.has_tracker || trackers.length) {
      if (trackers.length) {
        trackers.forEach(row => {
          const schema = Array.isArray(row.field_schema) ? row.field_schema : [];
          const values = row.values && typeof row.values === "object" ? row.values : {};
          const valueSummary = schema
            .map(field => {
              const key = field?.key;
              if (!key || values[key] === undefined || values[key] === null) return "";
              return `${field.label || key} ${values[key]}`;
            })
            .filter(Boolean)
            .slice(0,3)
            .join(" · ");
          activityItems.push({
            icon:"chart",
            cls:"badge-gold",
            label:row.tracker_title || "Tracker",
            detail:[row.protocol_title, valueSummary].filter(Boolean).join(" · ")
          });
        });
      } else {
        activityItems.push({ icon:"chart", cls:"badge-gold", label:"Tracker", detail:"Renseigné ce jour-là" });
      }
    }

    if(jrn||protocolJournals.length){
      const journalParts=[];
      if(jrn)journalParts.push('écriture personnelle');
      if(protocolJournals.length)journalParts.push(`${protocolJournals.length} ressenti${protocolJournals.length>1?'s':''} de protocole`);
      activityItems.push({icon:"journal",cls:"badge-sage",label:"Journal",detail:journalParts.join(' · ')});
    }

    let badges = activityItems.map(item =>
      `<span class="jday-badge ${item.cls}">${iconHTML(item.icon,"jday-badge-icon")}<span><b>${safe(item.label)}</b>${item.detail ? `<small>${safe(item.detail)}</small>` : ""}</span></span>`
    ).join("");
    if(Number(foodSummary?.count||0)>0){
      badges += `<button type="button" class="jday-badge jday-badge-button badge-muted" onclick="location.href='food-day.html?date=${safe(iso)}'">${iconHTML('bowl','jday-badge-icon')}<span><b>Alimentation</b><small>${Number(foodSummary.count)} repas</small></span></button>`;
    }
    customDaily.forEach((daily,index) => {
      const projected=!!customTrackers[index]?.projected||!!customTrackers[index]?.values?._cycle_projection;
      badges += `<button type="button" class="jday-badge jday-badge-button badge-gold" onclick="window.mtJournalOpenCustomTracker('${safe(daily.key)}','${safe(iso)}')">${iconHTML('chart','jday-badge-icon')}<span><b>${safe(daily.title)}</b><small>${safe(daily.headline)}</small></span></button>`;
    });

    const dayPills=[];
    if(act?.has_hydration)dayPills.push(`Hydratation · ${act.hydration_liters?String(act.hydration_liters).replace('.',',')+' L':'renseignée'}`);
    if(act?.has_sleep&&!customDaily.some(d=>d.key==='sommeil_profond'))dayPills.push(`Sommeil · ${act.sleep_hours?String(act.sleep_hours).replace('.',',')+' h':'renseigné'}`);
    if(act?.has_routine){
      const routineTitles=routines.map(r=>r.user_routines?.title).filter(Boolean);
      dayPills.push(routineTitles.length===1?`Routine · ${routineTitles[0]}`:routineTitles.length>1?`Routines · ${routineTitles.length} complétées`:'Routine · ✓');
    }
    if(act?.has_ritual)dayPills.push('Rituel · ✓');if(jrn||protocolJournals.length||act?.has_journal)dayPills.push('Journal · ✓');
    if(Number(foodSummary?.count||0)>0)dayPills.push(...(foodSummary.pills||[`Alimentation · ${foodSummary.count} repas`]));
    customDaily.forEach(daily=>dayPills.push(...daily.pills));
    const uniqueDayPills=[...new Set(dayPills.filter(Boolean))];
    const dayPillsHTML=uniqueDayPills.length?`<div class="jday-dynamic-pills" aria-label="Repères de cette journée">${uniqueDayPills.map(text=>`<span class="jday-dynamic-pill${isEstimatedPeriod&&String(text).startsWith('Cycle ·')?' is-period':''}">${safe(text)}</span>`).join('')}</div>`:'';

    const ans = jrn?.answers || {};
    const isProtocol = ans?.source === "protocol_journal" || ans?.source === "local_protocol_journal";
    let answersHtml = "";

    if (isProtocol && Array.isArray(ans.questions)) {
      answersHtml = ans.questions.map((q,i)=> {
        const val = ans.answers?.[i] || "";
        return val ? `<div class="jday-answer"><strong>${safe(q)}</strong><p>${safe(val)}</p></div>` : "";
      }).join("");
    } else if (ans && typeof ans === "object") {
      const labels = { libre:"Écris ce que tu souhaites", ressenti:"Comment je me sens", nutrition:"Ce que j’ai mangé / bu", intention:"Mon intention" };
      answersHtml = Object.keys(ans).filter(k => ans[k]).map(k => `<div class="jday-answer"><strong>${safe(labels[k] || k)}</strong><p>${safe(ans[k])}</p></div>`).join("");
    }

    const journeyItems=Array.isArray(journey?.items)?journey.items:[];
    const journeyCompleted=new Set((journey?.completions||[]).filter(x=>x.completed).map(x=>String(x.journey_item_id)));
    const journeyValid=journeyItems.filter(x=>x.validation_enabled!==false);
    const journeyDone=journeyValid.filter(x=>journeyCompleted.has(String(x.id))).length;
    const journeyHTML=journeyItems.length?`<div class="jday-journey-summary"><small>Notre journée ensemble</small><b>${journeyDone} rendez-vous réalisés sur ${journeyValid.length}</b><p>${journeyItems.filter(x=>journeyCompleted.has(String(x.id))).slice(0,3).map(x=>safe(x.title)).join(' · ')||'Journée commencée'}</p><button type="button" onclick="window.mtJournalCloseDay();window.mtOpenCommunityJourneyDate&&window.mtOpenCommunityJourneyDate('${iso}')">Voir le détail de cette journée</button></div>`:'';
    const foodCard=Number(foodSummary?.count||0)>0?`<button type="button" class="jday-linked-card" onclick="location.href='food-day.html?date=${safe(iso)}'"><small>Ma journée alimentaire</small><b>${Number(foodSummary.count)} repas renseigné${Number(foodSummary.count)>1?'s':''}</b>${metricListHTML(foodSummary.metrics)}<span class="jday-food-note">${foodSummary.calculated_count>0?'Repères calculés uniquement à partir des aliments réellement renseignés.':'Repas enregistré · repères nutritionnels non calculés.'}</span><em>Voir ma journée →</em></button>`:'';
    const customCards=customDaily.map((daily,index)=>{const projected=!!customTrackers[index]?.projected||!!customTrackers[index]?.values?._cycle_projection;return `<button type="button" class="jday-linked-card" onclick="window.mtJournalOpenCustomTracker('${safe(daily.key)}','${safe(iso)}')"><small>${projected?'Repère du cycle':'Suivi personnel'}</small><b>${safe(daily.title)}</b><span>${safe(daily.headline)}</span>${metricListHTML(daily.metrics)}<em>${projected?'Renseigner mes ressentis':'Voir ou modifier'} →</em></button>`;}).join('');
    const protocolJournalCards=protocolJournals.map(row=>{
      const pack=row?.answers&&typeof row.answers==="object"?row.answers:{},questions=Array.isArray(pack.questions)?pack.questions:[],answers=pack.answers&&typeof pack.answers==="object"?pack.answers:{};
      const qa=questions.map((q,i)=>answers?.[i]?`<span class="jday-metric"><span>${safe(q)}</span><b>${safe(answers[i])}</b></span>`:'').filter(Boolean).join('');
      const origin=`Ressenti du protocole${row.protocol_day?` · Jour ${Number(row.protocol_day)}`:''}`;
      const protocolName=row.protocol_title||row.journal_title||'Protocole';
      const journalName=row.journal_title&&row.journal_title!==protocolName?`<span>${safe(row.journal_title)}</span>`:'';
      return `<div class="jday-linked-card"><small>✶ ${safe(origin)}</small><b>${safe(protocolName)}</b>${journalName}${qa?`<span class="jday-metric-list">${qa}</span>`:(row.note_libre?`<span>${safe(row.note_libre)}</span>`:'')}<em>Fait partie de ton journal du jour</em></div>`;
    }).join('');
    const linkedHTML=foodCard||customCards?`<div class="jday-linked-list">${foodCard}${customCards}</div>`:'';
    const hasContent = Boolean(activityItems.length || jrn || protocolJournals.length || customTrackers.length || Number(foodSummary?.count||0)>0);
    const moodLabel = { calme:"Sérénité", energique:"Énergie", fragile:"Fragilité", fatigue:"Fatigue", bien:"Joie" }[jrn?.mood] || "";

    return `
      <div class="jday-modal-backdrop" onclick="window.mtJournalCloseDay()"></div>
      <div class="jday-modal-card jday-v165-card">
        <button class="jday-modal-close jday-v165-close" onclick="window.mtJournalCloseDay()">×</button>
        <div class="jday-v165-head" aria-label="Détail du jour">
          <div class="jday-v165-kicker">Mon parcours</div>
          <h3 class="jday-v165-date">${safe(label)}</h3>
        </div>
        ${journeyHTML}
        ${hasContent ? `
          ${dayPillsHTML}
          ${badges ? `<div class="jday-badges">${badges}</div>` : ""}
          ${linkedHTML}
          ${jrn||protocolJournals.length ? `<h3 class="jday-title">Journal privé${moodLabel ? ` · ${safe(moodLabel)}` : ""}</h3>` : ""}
          ${jrn?.note_libre ? `<div class="jday-note">${safe(jrn.note_libre)}</div>` : ""}
          ${answersHtml ? `<div class="jday-answers">${answersHtml}</div>` : ""}
          ${jrn ? `<div class="jday-trackers">
            ${trackerBar(jrn.tracker_stress,"Stress")}
            ${trackerBar(jrn.tracker_energie,"Énergie")}
            ${trackerBar(jrn.tracker_digestion,"Digestion")}
            ${trackerBar(jrn.tracker_sommeil,"Sommeil")}
            ${trackerBar(jrn.tracker_humeur,"Humeur")}
          </div>` : ""}
          ${protocolJournalCards?`<div class="jday-linked-list">${protocolJournalCards}</div>`:''}
        ` : `<p class="jday-empty">Aucune activité enregistrée ce jour-là.</p>`}
        <button class="jday-open-journal" onclick="window.mtJournalCloseDay();window.mtJournalOpenForm('${iso}')">
          ${jrn ? `${iconHTML('journal','jday-button-icon')} Modifier mon journal` : protocolJournals.length ? `${iconHTML('journal','jday-button-icon')} Compléter mon journal` : `${iconHTML('journal','jday-button-icon')} Écrire dans mon journal`}
        </button>
      </div>`;
  }

  // ─── Journal form ─────────────────────────────────────────
  const JOURNAL_QUESTIONS = [
    { key:"libre", label:"Écris ce que tu souhaites", placeholder:"Ton ressenti, ta journée, ton alimentation, tes émotions, une victoire, une difficulté… cet espace est à toi." }
  ];

  function protocolJournalFormHTML(rows){
    if(!Array.isArray(rows)||!rows.length)return '';
    const cards=rows.map(row=>{
      const pack=row?.answers&&typeof row.answers==="object"?row.answers:{};
      const questions=Array.isArray(pack.questions)?pack.questions:[];
      const answers=pack.answers&&typeof pack.answers==="object"?pack.answers:{};
      const qa=questions.map((q,i)=>{
        const value=answers?.[i];if(!String(value||'').trim())return '';
        return `<div><strong>${safe(q)}</strong><p>${safe(value)}</p></div>`;
      }).join('');
      const origin=`✶ Ressenti du protocole${row.protocol_day?` · Jour ${Number(row.protocol_day)}`:''}`;
      const protocolName=row.protocol_title||row.journal_title||'Protocole';
      const journalName=row.journal_title&&row.journal_title!==protocolName?row.journal_title:'';
      return `<article class="jform-protocol-card"><small>${safe(origin)}</small><b>${safe(protocolName)}</b>${journalName?`<em>${safe(journalName)}</em>`:''}${qa?`<div class="jform-protocol-qa">${qa}</div>`:(row.note_libre?`<div class="jform-protocol-qa"><div><p>${safe(row.note_libre)}</p></div></div>`:'')}</article>`;
    }).join('');
    return `<section class="jform-protocol-zone"><small>Dans ce même journal</small><h3>Mes ressentis de protocole</h3><p>Les réponses écrites dans tes protocoles font partie de cette journée. Elles restent reliées à leur origine, sans remplacer ton espace personnel.</p>${cards}</section>`;
  }

  function renderJournalForm(iso, existing, protocolJournals=[]) {
    const label = formatDayFR(iso);
    const draft=readJournalDraft(iso);
    const savedAt=Date.parse(existing?.updated_at||0)||0,draftAt=Date.parse(draft?.updated_at||0)||0;
    const useDraft=!!draft&&(!savedAt||draftAt>=savedAt);
    const current=useDraft?{...(existing||{}),...draft,answers:{...(existing?.answers||{}),...(draft?.answers||{})}}:(existing||{});
    const ans = current?.answers || {};
    const questions = JOURNAL_QUESTIONS.map(q => `
      <div class="jform-question">
        <label class="jform-label">${safe(q.label)}</label>
        <textarea class="jform-textarea" name="${q.key}" placeholder="${safe(q.placeholder)}" rows="8">${safe(ans[q.key]||"")}</textarea>
      </div>`).join("");
    const trackers = [
      { key:"tracker_stress",    label:"Stress",    icon:"cloud" },
      { key:"tracker_energie",   label:"Énergie",   icon:"sparkle" },
      { key:"tracker_digestion", label:"Digestion", icon:"leaf" },
      { key:"tracker_sommeil",   label:"Sommeil",   icon:"cloud" },
      { key:"tracker_humeur",    label:"Humeur",    icon:"sparkle" },
    ].map(t => {
      const raw=current?.[t.key],hasValue=raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(Number(raw))&&Number(raw)>0;
      const value=hasValue?Number(raw):5;
      return `
      <div class="jform-tracker-row">
        <span class="jform-tracker-label">${iconHTML(t.icon,'jform-tracker-icon')} ${t.label}</span>
        <div class="jform-slider-wrap">
          <input type="range" class="jform-slider${hasValue?'':' is-unset'}" name="${t.key}" min="1" max="10" value="${value}" data-touched="${hasValue?'1':'0'}">
          <span class="jform-slider-val${hasValue?'':' is-unset'}">${hasValue?`${value}/10`:'— Non renseigné'}</span>
        </div>
      </div>`;
    }).join("");
    const moods = [
      { key:"calme",  icon:"leaf", label:"Sérénité" },
      { key:"energique",icon:"sparkle", label:"Énergie" },
      { key:"bien",  icon:"seed", label:"Joie" },
      { key:"fragile",  icon:"cloud", label:"Fragilité" },
      { key:"fatigue", icon:"cloud", label:"Fatigue" },
    ].map(m => `<button type="button" class="jform-mood-btn${current?.mood===m.key?" selected":""}" data-mood="${m.key}">${iconHTML(m.icon,'jform-mood-icon')}<span>${m.label}</span></button>`).join("");
    return `
      <div class="jform-backdrop" onclick="window.mtJournalCloseForm()"></div>
      <div class="jform-sheet">
        <button class="jform-close" onclick="window.mtJournalCloseForm()">✕</button>
        <div class="jform-kicker">Journal privé</div>
        <div class="jform-date">${safe(label)}</div>
        <div class="jform-section-title">Comment je me sens ?</div>
        <div class="jform-moods">${moods}</div>
        ${questions}
        <div class="jform-section-title">Repères du jour</div>
        <div class="jform-trackers">${trackers}</div>
        <div class="jform-question">
          <label class="jform-label">Ma phrase à retenir</label>
          <textarea class="jform-textarea" name="note_libre" placeholder="Une phrase courte à retenir pour ce jour…" rows="3">${safe(current?.note_libre||"")}</textarea>
        </div>
        ${protocolJournalFormHTML(protocolJournals)}
        <button class="jform-save" id="jformSaveBtn" onclick="window.mtJournalSaveForm('${iso}')">Enregistrer mon journal</button>
        <p class="jform-draft-note">Ton brouillon reste sur cet appareil tant que tu n’as pas enregistré.</p>
      </div>`;
  }

  function ensureJournalFormModal(){
    installV341JournalStyles();
    const all=[...document.querySelectorAll("#jformModal")];
    let modal=all.find(el=>el.parentElement===document.body)||all[0]||null;
    all.forEach(el=>{if(el!==modal)el.remove();});
    if(!modal){modal=document.createElement("div");modal.id="jformModal";modal.className="jform-modal hidden";}
    if(modal.parentElement!==document.body)document.body.appendChild(modal);
    return modal;
  }


  // Sauvegarde depuis un contenu "Journal privé" d'un protocole
  window.mtSaveJournalProtocolEntry = async function(payload) {
    const c = getClient();
    const u = await getUser();
    if (!c || !u || !payload) return false;
    const entryDate=String(payload.date||todayISO()).slice(0,10);
    const entry = {
      user_id:u.id,
      entry_date:entryDate,
      protocol_id:String(payload.protocol_id||""),
      content_id:String(payload.content_id||""),
      protocol_title:payload.protocol_title||"",
      journal_title:payload.title||"Ressenti du protocole",
      protocol_day:Number(payload.protocol_day)||null,
      answers:{questions:payload.questions||[],answers:payload.answers||{},source:"protocol_journal",content_id:payload.content_id||""},
      signals:payload.signals&&typeof payload.signals==="object"?payload.signals:{},
      note_libre:Object.values(payload.answers||{}).filter(Boolean).slice(0,2).join(" · ")||null,
      updated_at:new Date().toISOString()
    };
    const { error } = await c.from("protocol_journal_entries").upsert(entry, { onConflict:"user_id,protocol_id,content_id,entry_date" });
    if (error) { console.warn("[Journal protocol] save error", error); return false; }
    await window.mtJournalTrack("journal");
    return true;
  };


  function collectJournalDraft(modal){
    const answers={};
    JOURNAL_QUESTIONS.forEach(q=>{
      const el=modal.querySelector(`textarea[name="${q.key}"]`);
      if(el&&el.value.trim())answers[q.key]=el.value.trim();
    });
    const trackers={};
    ["tracker_stress","tracker_energie","tracker_digestion","tracker_sommeil","tracker_humeur"].forEach(k=>{
      const el=modal.querySelector(`input[name="${k}"]`);
      if(el?.dataset?.touched==="1")trackers[k]=Number(el.value);
    });
    const mood=modal.querySelector(".jform-mood-btn.selected")?.dataset?.mood||null;
    const note_libre=modal.querySelector(`textarea[name="note_libre"]`)?.value?.trim()||null;
    return {answers,...trackers,mood,note_libre};
  }
  function bindJournalDraftAutosave(modal,iso){
    let timer=null;
    const persist=()=>{clearTimeout(timer);timer=setTimeout(()=>writeJournalDraft(iso,collectJournalDraft(modal)),160);};
    modal.querySelectorAll(".jform-slider").forEach(input=>{
      input.addEventListener("input",()=>{
        input.dataset.touched="1";
        input.classList.remove("is-unset");
        const label=input.nextElementSibling;
        if(label){label.textContent=`${input.value}/10`;label.classList.remove("is-unset");}
        persist();
      });
    });
    modal.querySelectorAll("textarea").forEach(el=>el.addEventListener("input",persist));
    modal.querySelectorAll(".jform-mood-btn").forEach(btn=>{
      btn.addEventListener("click",()=>{
        modal.querySelectorAll(".jform-mood-btn").forEach(b=>b.classList.remove("selected"));
        btn.classList.add("selected");
        persist();
      });
    });
  }

  // ─── State ───────────────────────────────────────────────
  let _calYear, _calMonth;

  function ensureJourneyDayModal(){
    const all=[...document.querySelectorAll('#jdayModal')];
    let modal=all.find(el=>el.parentElement===document.body)||all[0]||null;
    all.forEach(el=>{if(el!==modal)el.remove();});
    if(!modal){modal=document.createElement('div');modal.id='jdayModal';modal.className='jday-modal hidden';}
    if(modal.parentElement!==document.body)document.body.appendChild(modal);
    return modal;
  }

  function journeyLegendHTML(){return `<div class="jcal-legend">
    <span>${iconHTML('movement','jcal-legend-icon')}Protocole</span><span>${iconHTML('hydration','jcal-legend-icon')}Hydratation</span><span>${iconHTML('sleep','jcal-legend-icon')}Sommeil</span><span>${iconHTML('check','jcal-legend-icon')}Checklist</span><span>${iconHTML('chart','jcal-legend-icon')}Tracker</span><span>${iconHTML('journal','jcal-legend-icon')}Journal</span><span>${iconHTML('sparkle','jcal-legend-icon')}Photo</span>
  </div>`;}

  async function loadJourneySummaryInto(el){
    if(!el)return;
    const summary=window.__MT_JOURNEY_PROFILE_SUMMARY__ || (window.mtCommunityJourneyGetProfileSummary ? await window.mtCommunityJourneyGetProfileSummary() : null);
    window.__MT_JOURNEY_PROFILE_SUMMARY__=summary||null;
    const settings=summary?.settings||{};if(settings.show_profile_progress===false){el.remove();return;}
    const t=summary?.today||{},w=summary?.week||{},m=summary?.month||{};
    const weekly=settings.show_weekly_stats===false?'':`<span>${Number(w.joined_days||0)} jours rejoints cette semaine</span>`;
    const monthly=settings.show_monthly_stats===false?'':`<span>${Number(m.joined_days||0)} jours vécus ensemble ce mois-ci</span>`;
    el.innerHTML=`<button type="button" class="jjourney-profile-card" onclick="window.mtOpenCommunityJourneyDate&&window.mtOpenCommunityJourneyDate('${todayISO()}')"><div><small>Mon rythme collectif</small><b>${safe(settings.profile_label||'Notre journée')} · ${Number(t.completed||0)} / ${Number(t.total||0)}</b><p>${weekly}${monthly}</p></div><strong>Reprendre →</strong></button>`;
  }

  window.mtJournalMountCarnetInline=async function(target){
    const host=typeof target==='string'?document.getElementById(target):target;if(!host)return;
    installV341JournalStyles();ensureJournalFormModal();ensureJourneyDayModal();
    const user=await getUser();if(!user){host.innerHTML='<p class="carnet-parcours-inline-empty">Connecte-toi pour afficher ton parcours.</p>';return;}
    let year=new Date().getFullYear(),month=new Date().getMonth()+1;
    host.innerHTML=`${journeyLegendHTML()}<div class="jjourney-profile-summary" data-carnet-journey-summary></div><div class="jcal-container" data-carnet-journey-calendar><div class="jcal-loading">Chargement…</div></div>`;
    const summaryReady=Promise.resolve(loadJourneySummaryInto(host.querySelector('[data-carnet-journey-summary]')));
    const load=async()=>{
      const container=host.querySelector('[data-carnet-journey-calendar]');if(!container)return;
      container.innerHTML='<div class="jcal-loading">Chargement…</div>';
      const {activity,journal,custom,food}=await fetchMonthActivity(year,month);
      container.innerHTML=renderCalendar(year,month,activity,journal,custom,food,todayISO(),'mtCarnetJcal');
      document.getElementById('mtCarnetJcalPrev')?.addEventListener('click',()=>{month--;if(month<1){month=12;year--;}load();});
      document.getElementById('mtCarnetJcalNext')?.addEventListener('click',()=>{month++;if(month>12){month=1;year++;}load();});
    };
    host._mtReloadJourney=load;await Promise.all([load(),summaryReady]);
  };

  // ─── SHEET INIT (appelé par mtOpenParcoursSheet dans app.js) ──
  window.mtJournalInitSheet = async function() {
    const body = document.getElementById("parcoursSheetBody");
    if (!body) return;
    installV341JournalStyles();
    // Un singleton global unique vit sous <body>. Mon parcours ne le recrée plus,
    // ce qui supprime définitivement les doublons et overlays fantômes.
    ensureJournalFormModal();ensureJourneyDayModal();
    const user = await getUser();
    if (!user) {
      body.innerHTML = `<p style="color:var(--muted);padding:20px 0;font-size:13px;">Connecte-toi pour accéder à ton parcours.</p>`;
      return;
    }
    const now = new Date();
    _calYear  = now.getFullYear();
    _calMonth = now.getMonth() + 1;

    body.innerHTML = `
      <button class="jcal-write-btn" onclick="window.mtJournalOpenForm('${todayISO()}')">${iconHTML('journal','jcal-write-icon')} Écrire dans mon journal aujourd'hui</button>
      ${journeyLegendHTML()}
      <div class="jjourney-profile-summary" id="jjourneyProfileSummary"></div>
      <div class="jcal-container" id="jcalContainer"></div>`;

    await Promise.all([_loadCalendar(), _loadJourneyProfileSummary()]);
  };

  async function _loadJourneyProfileSummary(){
    await loadJourneySummaryInto(document.getElementById('jjourneyProfileSummary'));
  }

  async function _loadCalendar() {
    const container = document.getElementById("jcalContainer");
    if (!container) return;
    container.innerHTML = `<div class="jcal-loading">Chargement…</div>`;
    const { activity, journal, custom, food } = await fetchMonthActivity(_calYear, _calMonth);
    container.innerHTML = renderCalendar(_calYear, _calMonth, activity, journal, custom, food, todayISO());
    document.getElementById("jcalPrev")?.addEventListener("click", () => {
      _calMonth--; if (_calMonth < 1) { _calMonth = 12; _calYear--; } _loadCalendar();
    });
    document.getElementById("jcalNext")?.addEventListener("click", () => {
      _calMonth++; if (_calMonth > 12) { _calMonth = 1; _calYear++; } _loadCalendar();
    });
  }
  window.mtRefreshParcoursCalendar = function(){
    _loadCalendar();
    const inline=document.getElementById('mtCarnetParcoursInline');
    if(typeof inline?._mtReloadJourney==='function')inline._mtReloadJourney();
    document.querySelectorAll('.jjourney-profile-summary').forEach(el=>loadJourneySummaryInto(el));
  };
  document.addEventListener('mt:community-journey-updated',()=>{
    window.__MT_JOURNEY_PROFILE_SUMMARY__=null;
    window.mtRefreshParcoursCalendar();
    window.dispatchEvent(new CustomEvent('mt:daily-state-changed',{detail:{source:'community_journey'}}));
  });

  // ─── Day modal ────────────────────────────────────────────
  window.mtJournalOpenDay = async function(iso) {
    const modal = ensureJourneyDayModal();
    modal.classList.remove("hidden");
    modal.innerHTML = `<div class="jday-modal-backdrop" onclick="window.mtJournalCloseDay()"></div><div class="jday-modal-card jday-loading"><span>⟳</span><p>Chargement…</p></div>`;
    try {
      const data = await fetchDayDetail(iso);
      modal.innerHTML = renderDayModal(iso, data || { activity: null, journal: null });
    } catch (error) {
      console.warn("[Mon parcours] détail du jour indisponible", error);
      modal.innerHTML = renderDayModal(iso, { activity: null, journal: null, journey: null });
    }
  };
  window.mtJournalCloseDay = function() {
    const m = document.getElementById("jdayModal");
    if (m) { m.classList.add("hidden"); m.innerHTML = ""; }
  };
  window.mtJournalOpenCustomTracker = async function(key, iso){
    window.mtJournalCloseDay();
    try{
      if(window.mtEnsureAdvancedTrackers) await window.mtEnsureAdvancedTrackers();
      if(window.mtAdvancedTrackerEntry) await window.mtAdvancedTrackerEntry(customTrackerKey(key), iso || todayISO());
      else if(window.mtOpenCarnetTrackingEntry) await window.mtOpenCarnetTrackingEntry(customTrackerKey(key), iso || todayISO());
    }catch(e){ if(window.mtToast) window.mtToast("Ce suivi est momentanément indisponible."); }
  };

  // ─── Journal form ─────────────────────────────────────────
  window.mtJournalOpenForm = async function(iso) {
    const modal = ensureJournalFormModal();

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    modal.scrollTop = 0;
    modal.classList.remove("hidden");
    // Le feedback est peint avant toute lecture Supabase : aucun écran blanc,
    // même avec un réseau lent.
    modal.innerHTML = `<div class="jform-backdrop" onclick="window.mtJournalCloseForm()"></div><div class="jform-sheet"><button class="jform-close" onclick="window.mtJournalCloseForm()">✕</button><div class="jform-opening"><div><small>Journal privé</small><b>Ouverture de ton journal…</b><p>Ton espace confidentiel se prépare.</p><i></i></div></div></div>`;
    const [existing,protocolJournals] = await Promise.all([
      fetchJournalEntry(iso),
      fetchProtocolJournalsForDate(iso)
    ]);
    modal.innerHTML = renderJournalForm(iso, existing, protocolJournals);
    const formSheet = modal.querySelector(".jform-sheet");
    if (formSheet) {
      // iOS/WKWebView peut restaurer la position d'un conteneur scrollable
      // après le remplacement du contenu. On force donc le haut après le rendu,
      // sur plusieurs cycles de layout, sans animation.
      const resetJournalScroll = () => {
        formSheet.style.scrollBehavior = "auto";
        formSheet.scrollTop = 0;
        try { formSheet.scrollTo({ top: 0, left: 0, behavior: "instant" }); }
        catch (_) { formSheet.scrollTo(0, 0); }
      };
      resetJournalScroll();
      requestAnimationFrame(() => {
        resetJournalScroll();
        requestAnimationFrame(resetJournalScroll);
      });
      setTimeout(resetJournalScroll, 60);
      setTimeout(resetJournalScroll, 180);
      setTimeout(resetJournalScroll, 360);
    }
    bindJournalDraftAutosave(modal,iso);
  };
  window.mtJournalOpenDirect = function(iso){
    return window.mtJournalOpenForm(iso || todayISO());
  };
  window.mtJournalCloseForm = function() {
    const m = document.getElementById("jformModal");
    if (m) { m.classList.add("hidden"); m.innerHTML = ""; }
    const drawer = document.getElementById("parcoursSheetDrawer");
    if (drawer?.classList.contains("journal-direct-open")) {
      drawer.classList.remove("journal-direct-open");
      window.mtCloseParcoursSheet?.();
    }
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
      if (el?.dataset?.touched==="1") trackers[k] = Number(el.value);
    });
    const moodBtn = modal.querySelector(".jform-mood-btn.selected");
    const mood = moodBtn?.dataset?.mood || null;
    const noteEl = modal.querySelector(`textarea[name="note_libre"]`);
    const note_libre = noteEl?.value?.trim() || null;
    const ok = await saveJournalEntry(iso, { answers, ...trackers, note_libre, mood });
    if (ok) {
      clearJournalDraft(iso);
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
