/* ==========================================================================
   Mon Plan Santé — Logique minimaliste (app.js)
   Parcours épuré en 5 onglets :
   1. Repas (Mes 3 repas du jour, macros, remplacement viande/poisson, −/+)
   2. Séance (Exercices du jour, minuteur auto, cardio ON/OFF & carnet)
   3. Courses (Panier 4 / 8 / 10 jours)
   4. Poids (Semaine, tour de taille, Coach IA Gemini & courbe)
   5. Réglages (Objectif Cut/Maintien, Calories, Coach IA, Apparence, Données)
   ========================================================================== */

(function () {
  'use strict';

  // ==========================================================================
  // 1. UTILITAIRES & DATES
  // ==========================================================================

  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');

  const ymd = (d) =>
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  const dayNo = (s) => {
    const p = s.split('-').map(Number);
    return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5);
  };

  const fromNo = (n) => new Date(n * 864e5).toISOString().slice(0, 10);

  const dateOf = (s) => {
    const p = s.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  };

  const longDate = (s) =>
    dateOf(s).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

  const longDay = (s) =>
    dateOf(s).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short'
    });

  const shortDate = (s) =>
    dateOf(s).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });

  const dayTxt = (s) =>
    dateOf(s).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });

  const today = ymd(new Date());
  const DOW = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  const num = (v) => parseFloat(String(v || '').replace(',', '.'));
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const fmt1 = (n) =>
    (Math.round(n * 10) / 10).toFixed(1).replace('.', ',').replace(',0', '');
  const fmtKg = (v) => String(v).replace('.', ',');
  const kgTxt = (v) => String(Math.round(v * 100) / 100).replace('.', ',') + ' kg';
  const frNum = (v, dec) => v.toFixed(dec).replace('.', ',');
  const n1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  const spoon = (x) => String(Math.max(0.5, Math.round(x * 2) / 2)).replace('.', ',');
  const fmtRest = (s) =>
    s >= 60 ? Math.floor(s / 60) + '′' + (s % 60 ? pad(s % 60) : '') : s + ' s';

  const CHECK =
    '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const CHECK_SM =
    '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const PILL =
    '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/></svg>';
  const CLOCK =
    '<svg class="ic" width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>';
  const CHEVRON =
    '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  const TITLES = {
    repas: 'Diet',
    seance: 'Séance',
    cardio: 'Cardio',
    suivi: 'Poids',
    courses: 'Courses',
    ia: 'Coach IA',
    profil: 'Profil',
    reglages: 'Réglages',
    donnees: 'Données'
  };

  // ==========================================================================
  // 2. CONFIGURATION CHARGÉE DEPUIS LES FICHIERS JSON
  // ==========================================================================

  const NE = window.NutritionEngine;
  const FOODS_DEFAULT = NE.FOOD_DB;

  const cloneObj = (o) => JSON.parse(JSON.stringify(o));

  let CARDIO_TARGETS = NE.RULE_CONFIG.cardioTargets;
  let KCAL_MIN = NE.RULE_CONFIG.kcalMin;
  let KCAL_MAX = NE.RULE_CONFIG.kcalMax;
  let DEFAULT_TARGETS = NE.RULE_CONFIG.defaultTargets;
  let PROTS = NE.RULE_CONFIG.proteinSwaps;
  const PROFILE_DEFAULT = Object.assign({}, NE.DEFAULT_PROFILE, {
    auto: true,
    dietAdhered: true,
    kcalFloor: KCAL_MIN
  });

  // Données chargées depuis split.json et courses.json
  let TECH = {};
  let DELOAD_MAX_SETS = 2;
  let DEFAULT_STEP_KG = 2.5;
  let SESSIONS = {};
  let ALT_EX = {};
  let DEFAULT_KG = {};
  let STEP_KG = {};
  let CYCLE = [];
  let RECOVERY = [];
  let OFF_DAYS = [];
  let SHOP_RULES = null;
  let SPLIT_RULES = {};

  const techSteps = (tech) => (tech ? tech.steps || 2 : 0);
  const techOf = (e, dl) => (dl ? null : TECH[e.tech] || null);
  const defKg = (e) => DEFAULT_KG[e.n];
  const stepFor = (e) => STEP_KG[e.n] || DEFAULT_STEP_KG;
  const recoveryFor = (i) =>
    RECOVERY.length ? RECOVERY[Math.max(0, OFF_DAYS.indexOf(i)) % RECOVERY.length] : [];
  const onDaysList = () => CYCLE.map((x, k) => (x ? k : -1)).filter((k) => k >= 0);

  function activeExNames() {
    const names = new Set();
    Object.keys(SESSIONS).forEach((k) => {
      (SESSIONS[k].ex || []).forEach((item) => {
        if (item.isAlt) (item.variants || []).forEach((v) => v && v.n && names.add(v.n));
        else if (item && item.n) names.add(item.n);
      });
    });
    return names;
  }

  function normalizeEx(rawEx) {
    const t = rawEx.tech ? TECH[rawEx.tech] : null;
    const baseSets = Number(rawEx.sets) || 3;
    const item = {
      m: rawEx.m || '',
      n: rawEx.n || '',
      short: rawEx.short || '',
      note: rawEx.note || '',
      sets: baseSets + (t ? techSteps(t) : 0),
      reps: rawEx.reps || '',
      rir: rawEx.rir || '',
      rest: Number(rawEx.rest) || 90,
      restTxt: rawEx.restTxt || '',
      opt: !!rawEx.opt,
      poly: !!rawEx.poly
    };
    if (rawEx.tech) item.tech = rawEx.tech;
    if (rawEx.defaultKg != null) DEFAULT_KG[item.n] = Number(rawEx.defaultKg);
    if (rawEx.stepKg != null) STEP_KG[item.n] = Number(rawEx.stepKg);
    return item;
  }

  function applySplitConfig(split) {
    if (!split || typeof split !== 'object') return;
    TECH = split.tech || {};
    SPLIT_RULES = split.rules || {};
    DELOAD_MAX_SETS = Number(split.deloadMaxSets) || 2;
    DEFAULT_STEP_KG = Number(split.defaultStepKg) || 2.5;
    CYCLE = Array.isArray(split.cycleKeys) ? split.cycleKeys.slice() : [];
    RECOVERY = Array.isArray(split.recovery) ? split.recovery : [];
    OFF_DAYS = CYCLE.map((x, k) => (x ? -1 : k)).filter((k) => k >= 0);

    SESSIONS = {};
    ALT_EX = {};
    DEFAULT_KG = {};
    STEP_KG = {};

    const rawAlts = split.altExercises || {};
    Object.keys(rawAlts).forEach((aKey) => {
      if (Array.isArray(rawAlts[aKey])) {
        ALT_EX[aKey] = rawAlts[aKey].map(normalizeEx);
      }
    });

    const rawSessions = split.sessions || {};
    Object.keys(rawSessions).forEach((sKey) => {
      const s = rawSessions[sKey];
      const exList = (s.ex || []).map((rawEx) => {
        if (rawEx.altKey && ALT_EX[rawEx.altKey]) {
          return {
            isAlt: true,
            altKey: rawEx.altKey,
            variants: ALT_EX[rawEx.altKey]
          };
        }
        return normalizeEx(rawEx);
      });
      SESSIONS[sKey] = {
        short: s.short || sKey,
        title: s.title || sKey,
        sub: s.sub || '',
        ex: exList
      };
    });
  }

  async function loadJsonConfigs() {
    if (typeof fetch !== 'function') return;
    const fetchJson = (url) =>
      fetch(url, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    const [rules, foods, meals, courses, split] = await Promise.all([
      fetchJson('./plan-rules.json'),
      fetchJson('./foods.json'),
      fetchJson('./meals.json'),
      fetchJson('./courses.json'),
      fetchJson('./split.json')
    ]);
    if (rules) NE.applyConfig(rules);
    if (foods && foods.foods) {
      NE.applyConfig({ foods: foods.foods, foodsGroupOrder: foods.groupOrder });
    }
    if (meals) NE.applyConfig({ meals: meals.phases, mealMeta: meals.mealMeta });
    if (courses && courses.shopRules) SHOP_RULES = courses.shopRules;
    if (split) applySplitConfig(split);

    CARDIO_TARGETS = NE.RULE_CONFIG.cardioTargets;
    KCAL_MIN = NE.RULE_CONFIG.kcalMin;
    KCAL_MAX = NE.RULE_CONFIG.kcalMax;
    DEFAULT_TARGETS = NE.RULE_CONFIG.defaultTargets;
    PROTS = NE.RULE_CONFIG.proteinSwaps;
    Object.assign(PROFILE_DEFAULT, NE.DEFAULT_PROFILE, {
      auto: true,
      dietAdhered: true,
      kcalFloor: KCAL_MIN
    });
  }

  // ==========================================================================
  // 3. DÉMARRAGE & ÉTAT DE L'APPLICATION (LOCALSTORAGE)
  // ==========================================================================

  const KEY = 'mon-plan-repas-v1';
  const TABS = ['repas', 'seance', 'cardio', 'suivi', 'courses', 'ia', 'profil', 'reglages', 'donnees'];

  async function initApp() {
    await loadJsonConfigs();

    let st = {
      phase: 'seche',
      day: 'on',
      tab: 'repas',
      eaten: {},
      eatenDate: today,
      cart: {},
      swap: {},
      cycleStart: null,
      dayAutoDate: '',
      viewIdx: 0,
      altParity: {},
      log: { date: today, done: {} },
      deloadUntil: null,
      loads: {},
      hist: {},
      weights: {},
      weeklyAvgs: { n: null, n1: null, deltaKg: null, updatedAt: '' },
      waist: {},
      cardioLog: {},
      eatenLog: {},
      kcalLog: {},
      lastExport: '',
      shopDays: 8,
      foods: {},
      qty: {},
      targets: cloneObj(DEFAULT_TARGETS),
      macros: {},
      profile: Object.assign({}, PROFILE_DEFAULT)
    };

    try {
      const raw = localStorage.getItem(KEY);
      if (raw) st = Object.assign(st, JSON.parse(raw));
    } catch (e) {}

    st.foods = st.foods || {};
    st.qty = st.qty || {};
    st.targets = st.targets || {};
    st.macros = st.macros || {};
    st.swap = st.swap || {};
    st.altParity = st.altParity || {};
    st.loads = st.loads || {};
    st.hist = st.hist || {};
    st.weights = st.weights || {};
    st.weeklyAvgs =
      st.weeklyAvgs && typeof st.weeklyAvgs === 'object'
        ? st.weeklyAvgs
        : { n: null, n1: null, deltaKg: null, updatedAt: '' };
    st.waist = st.waist || {};
    st.cardioLog = st.cardioLog || {};
    st.eatenLog = st.eatenLog || {};
    st.kcalLog = st.kcalLog || {};
    st.fatigueLog = st.fatigueLog || {};
    st.aiHistory = Array.isArray(st.aiHistory) ? st.aiHistory : [];
    if (st.shopDays === 7 || st.shopDays === 3) st.shopDays = 8;
    st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
    delete st.profile.stagnating;

    // Migration douce des anciens IDs de swap/profile
    const SWAP_MIG = { poulet: 'chicken', dinde: 'turkey', cabillaud: 'cod', boeuf: 'beef5', pates: 'pasta' };
    Object.keys(st.swap).forEach((k) => {
      if (SWAP_MIG[st.swap[k]]) st.swap[k] = SWAP_MIG[st.swap[k]];
    });
    if (st.profile.weight && !st.profile.currentWeightKg) st.profile.currentWeightKg = st.profile.weight;
    if (st.profile.height && !st.profile.heightCm) st.profile.heightCm = st.profile.height;
    if (st.profile.activity && !st.profile.activityFactor) st.profile.activityFactor = st.profile.activity;
    if (!st.v43Plan) {
      st.targets = cloneObj(DEFAULT_TARGETS);
      st.swap.grain = 'pasta';
      st.v43Plan = true;
    }
    st.swap.grain = 'pasta';
    if (!st.profile.kcalFloor || st.profile.kcalFloor < KCAL_MIN) {
      st.profile.kcalFloor = KCAL_MIN;
    }
    ['seche', 'maintien'].forEach((ph) => {
      if (!st.targets[ph]) return;
      ['on', 'off'].forEach((d) => {
        if (st.targets[ph][d] != null && Number(st.targets[ph][d]) < KCAL_MIN) {
          delete st.targets[ph][d];
        }
      });
      if (!Object.keys(st.targets[ph]).length) delete st.targets[ph];
    });

    if (CYCLE.length && st.cycleLen !== CYCLE.length) {
      st.cycleLen = CYCLE.length;
      st.cycleStart = null;
      st.viewIdx = 0;
      st.dayAutoDate = '';
      st.altParity = {};
      st.log = { date: today, done: {} };
    }
    if (TABS.indexOf(st.tab) < 0) st.tab = 'repas';
    if (st.eatenDate !== today) {
      st.eaten = {};
      st.eatenDate = today;
    }
    if (!st.log || st.log.date !== today) st.log = { date: today, done: {} };
    if (st.deloadUntil && dayNo(today) >= dayNo(st.deloadUntil)) st.deloadUntil = null;

  function cycleIdx() {
    if (!st.cycleStart) return null;
    const n = dayNo(today) - dayNo(st.cycleStart);
    return ((n % CYCLE.length) + CYCLE.length) % CYCLE.length;
  }

  function syncDay() {
    const i = cycleIdx();
    st.day = i % 2 === 0 ? 'on' : 'off';
    st.dayAutoDate = today;
  }

  function setTodayAs(i) {
    st.cycleStart = fromNo(dayNo(today) - i);
    syncDay();
  }

  function shiftCycle() {
    st.cycleStart = fromNo(dayNo(st.cycleStart) + 1);
    syncDay();
    st.viewIdx = cycleIdx();
  }

  const startIdx = cycleIdx();
  if (startIdx !== null) {
    st.viewIdx = startIdx;
    if (st.dayAutoDate !== today) syncDay();
  }

  let peek = null;
  const viewIdx = () => {
    const ti = cycleIdx();
    return peek !== null && ti !== null ? peek : ti;
  };
  const viewDay = () => {
    const v = viewIdx();
    return v === null ? st.day : v % 2 === 0 ? 'on' : 'off';
  };

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch (e) {}
  }

  function syncWeeklyAvgs() {
    st.weeklyAvgs = NE.computeWeeklyAvgs(st.weights, st.weeklyAvgs, today);
    return st.weeklyAvgs;
  }
  syncWeeklyAvgs();
  save();

  const food = (id) => NE.getFood(id, st.foods);
  const profile = () => Object.assign({}, PROFILE_DEFAULT, st.profile || {});

  function rollingWeight() {
    const eatenLog = st.eatenLog || {};
    const hasMealHistory = Object.keys(eatenLog).some((k) => eatenLog[k] > 0);
    const yesterday = fromNo(dayNo(today) - 1);
    const entries = Object.keys(st.weights || {})
      .filter((d) => isFinite(st.weights[d]) && d <= today)
      .map((d) => {
        let mealsChecked;
        if (d < today) {
          mealsChecked = hasMealHistory ? (eatenLog[d] || 0) > 0 : undefined;
        } else {
          // Pesée du matin à jeun : on vérifie les repas cochés d'aujourd'hui ou de la veille
          mealsChecked =
            (eatenLog[today] || 0) > 0
              ? true
              : hasMealHistory && eatenLog[yesterday] !== undefined
              ? eatenLog[yesterday] > 0
              : undefined;
        }
        return { date: d, weightKg: st.weights[d], mealsChecked };
      });
    const fallback = startWeight() != null ? startWeight() : profile().currentWeightKg;
    return NE.computeRollingWeight(entries, fallback, today);
  }

  function currentWeight() {
    return rollingWeight().weightKg;
  }

  function hasLoggedWeight() {
    return Object.keys(st.weights || {}).some((d) => isFinite(st.weights[d]) && d <= today);
  }

  function startWeight() {
    const p = profile();
    if (p.startWeightKg != null && isFinite(Number(p.startWeightKg)) && Number(p.startWeightKg) > 30) {
      return Number(p.startWeightKg);
    }
    const dates = Object.keys(st.weights || {})
      .filter((d) => isFinite(st.weights[d]) && d <= today)
      .sort();
    return dates.length ? Number(st.weights[dates[0]]) : null;
  }

  function waistInfo() {
    const keys = Object.keys(st.waist || {})
      .filter((d) => isFinite(st.waist[d]) && d <= today)
      .sort();
    if (!keys.length) return { latest: null, prev: null, delta: null };
    const latestD = keys[keys.length - 1];
    const latest = st.waist[latestD];
    const prevD = keys.length >= 2 ? keys[keys.length - 2] : null;
    const prev = prevD ? st.waist[prevD] : null;
    const delta = prev != null ? Math.round((latest - prev) * 10) / 10 : null;
    return { latest, latestD, prev, prevD, delta };
  }

  const enginePhase = (ph) => (ph === 'seche' ? 'cut' : 'maintain');

  function customTarget(ph, d) {
    const v = Number(((st.targets || {})[ph] || {})[d]);
    return isFinite(v) && v >= KCAL_MIN && v <= KCAL_MAX ? Math.round(v) : null;
  }

  function autoTargets(phase) {
    const ph = phase || st.phase;
    const N = NE.calculateTargets(
      Object.assign({}, profile(), {
        currentWeightKg: currentWeight(),
        phase: enginePhase(ph)
      })
    );
    return { on: N.kcalOn, off: N.kcalOff };
  }

  const defaultTarget = (ph, d) => (DEFAULT_TARGETS[ph] || DEFAULT_TARGETS.seche)[d];

  const tgt = (ph, d) => {
    const c = customTarget(ph, d);
    if (c !== null) return c;
    return defaultTarget(ph, d);
  };

  function phaseMacros(phase) {
    const ph = phase || st.phase;
    return (st.macros && st.macros[ph]) || {};
  }

  function engineProfile(phase) {
    const ph = phase || st.phase;
    return Object.assign({}, profile(), phaseMacros(ph), {
      currentWeightKg: currentWeight(),
      phase: enginePhase(ph),
      actualAvgIntakeKcal: Math.round((tgt(ph, 'on') + tgt(ph, 'off')) / 2)
    });
  }

  function calcNutrition(phase) {
    return NE.calculateTargets(engineProfile(phase));
  }

  function syncTodayKcalLog() {
    st.eatenLog = st.eatenLog || {};
    st.kcalLog = st.kcalLog || {};
    const count = ['midi', 'collation', 'soir'].filter((id) => st.eaten[id]).length;
    st.eatenLog[today] = count;
    if (count === 3) {
      const ti = cycleIdx();
      const todayDay = ti === null ? st.day : ti % 2 === 0 ? 'on' : 'off';
      st.kcalLog[today] = Math.round(buildDay(st.phase, todayDay).tot.kcal);
    } else {
      delete st.kcalLog[today];
    }
  }

  function adaptiveInfo() {
    const entries = Object.keys(st.weights || {})
      .filter((d) => isFinite(st.weights[d]) && d <= today)
      .map((d) => ({ date: d, weightKg: st.weights[d] }));
    return NE.estimateAdaptiveTDEE(entries, st.kcalLog || {}, calcNutrition(st.phase).tdee, today);
  }

  function recordHist(name) {
    const kg = num(st.loads[name]);
    if (!isFinite(kg)) return;
    const h = (st.hist[name] = st.hist[name] || []);
    const last = h[h.length - 1];
    if (last && last.d === today) last.kg = kg;
    else h.push({ d: today, kg });
    if (h.length > 60) h.splice(0, h.length - 60);
  }

  function lastTime(name) {
    const h = st.hist[name] || [];
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i].d < today) return h[i];
    }
    return null;
  }

  function avgRange(from, to) {
    const v = [];
    for (let k = from; k <= to; k++) {
      const w = st.weights[fromNo(dayNo(today) - k)];
      if (isFinite(w)) v.push(w);
    }
    return v.length ? { avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : null;
  }

  function slope7() {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const w = st.weights[fromNo(dayNo(today) - k)];
      if (isFinite(w)) pts.push([-k, w]);
    }
    if (pts.length < 3) return null;
    const xs = pts.map((p) => p[0]);
    if (Math.max.apply(null, xs) - Math.min.apply(null, xs) < 4) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / pts.length;
    const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const num_ = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0);
    const den = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
    return Math.round((num_ / den) * 7 * 100) / 100;
  }

  function weekly() {
    const wa = st.weeklyAvgs || syncWeeklyAvgs();
    const c = wa.n || avgRange(0, 6);
    const p1 = wa.n1 || avgRange(7, 13);
    const p2 = avgRange(14, 20);
    const r = (x, y, n) => Math.round(((x.avg - y.avg) / n) * 100) / 100;
    let r1 = c && p1 ? r(c, p1, 1) : c && p2 ? r(c, p2, 2) : null;
    let est = false;
    if (r1 == null && c) {
      r1 = slope7();
      est = r1 != null;
    }
    const r0 = p1 && p2 ? r(p1, p2, 1) : null;
    return { c, p1, r1, r0, est };
  }

  // ==========================================================================
  // 6. MOTEUR DE CALCUL DES REPAS (CARB CYCLING)
  // ==========================================================================

  function qtyMap(phase, day) {
    return ((st.qty || {})[phase] || {})[day] || {};
  }

  function buildDay(phase, day) {
    const overrideKcal = tgt(phase, day);
    const plan = NE.buildMealPlan(engineProfile(phase), day, {
      foodOverrides: st.foods,
      swaps: st.swap,
      overrideKcal
    });

    // Garder tous les aliments du plan visibles (même à 0 g) d'après meals.json (mealMeta.ensureFoods)
    const ensureFood = (meal, f) => {
      const info = food(f);
      if (info && !meal.items.some((i) => i.f === f)) {
        meal.items.push({ f, n: info.n, g: 0, kcal: 0, p: 0, carbs: 0, l: 0, fib: 0 });
      }
    };
    const meta = NE.RULE_CONFIG.mealMeta || {};
    plan.meals.forEach((meal) => {
      const list = (meta[meal.id] && meta[meal.id].ensureFoods) || [];
      list.forEach((f) => ensureFood(meal, f));
    });

    const qm = qtyMap(phase, day);
    let hasCustom = false;
    const tot = { kcal: 0, p: 0, g: 0, l: 0, fib: 0 };

    plan.meals.forEach((m) => {
      m.kcal = 0;
      m.items.forEach((i) => {
        const key = `${m.id}|${i.f}`;
        i.gAuto = i.g;
        if (qm[key] != null && isFinite(qm[key])) {
          i.g = Math.max(0, Math.round(qm[key]));
          i.custom = i.g !== i.gAuto;
          if (i.custom) hasCustom = true;
        }
        const F = food(i.f);
        const r = i.g / 100;
        i.kcal = F.kcal * r;
        m.kcal += i.kcal;
        tot.p += F.p * r;
        tot.g += F.g * r;
        tot.l += F.l * r;
        tot.fib += (F.fib || 0) * r;
      });
      tot.kcal += m.kcal;
    });

    const targetCarbs = plan.carbsTargetG;
    return {
      meals: plan.meals,
      tot,
      target: plan.dayKcal,
      targetProt: plan.proteinTargetG,
      targetFat: plan.fatTargetG,
      targetCarbs,
      fiberTargetG: plan.fiberTargetG,
      lowFiber: tot.fib < NE.RULE_CONFIG.fiber.minG,
      hasCustom,
      N: plan.targets
    };
  }

  // ==========================================================================
  // 7. RENDU : REPAS, CYCLE & SÉANCE
  // ==========================================================================

  let swapOpen = null;
  let macroDay = 'on';

  function itemHint(i) {
    const eggG = (SHOP_RULES && SHOP_RULES.eggWeightG) || 56.7;
    const bSize = (NE.RULE_CONFIG.mealBases && NE.RULE_CONFIG.mealBases.belvitaGPerBiscuit) || 12.5;
    switch (i.f) {
      case 'eggs': {
        const n = Math.round((i.g / eggG) * 2) / 2;
        return `≈ ${String(n).replace('.', ',')} œuf${n > 1 ? 's' : ''}`;
      }
      case 'olive_oil':
        return i.g > 0 ? '≈ ' + spoon(i.g / 13) + ' c. à soupe' : '0 c. à soupe';
      case 'creatine':
        return 'dans le shaker';
      case 'honey':
        return i.g > 0 ? '≈ ' + spoon(i.g / 20) + ' c. à soupe' : 'option glucides';
      case 'raisins':
        return i.g > 0 ? 'glucides rapides' : 'option glucides';
      case 'belvita': {
        const bInfo = food('belvita');
        const kcalPer = bInfo ? Math.round((bInfo.kcal * bSize) / 100) : 55;
        if (i.g <= 0) return `option glucides (${kcalPer} kcal/biscuit)`;
        const nb = Math.max(1, Math.round(i.g / bSize));
        return `≈ ${nb} biscuit${nb > 1 ? 's' : ''}`;
      }
      case 'peanut_butter':
        return i.g > 0 ? '≈ ' + spoon(i.g / 20) + ' c. à soupe' : '';
      case 'dark_choc':
        return i.g > 0 ? Math.round(i.g / 5) + ' carrés' : '';
      case 'avocado':
        return i.g >= 60 ? '½ avocat moyen' : i.g > 0 ? '½ petit avocat' : '';
      default:
        return '';
    }
  }

  function qtyControl(i, m) {
    const key = `${m.id}|${i.f}`;
    const F = food(i.f);
    const stp = (F && F.step) || 5;
    const k = Math.round(((F ? F.kcal : 0) * i.g) / 100);
    return `<span class="item-q stepper">
      <button type="button" class="step-btn" data-qstep="${key}|-${stp}" aria-label="Moins"${i.g <= 0 ? ' disabled' : ''}>−</button>
      <span class="q-col">
        <span class="qty-wrap"><input type="text" inputmode="numeric" autocomplete="off" class="qty-in${i.custom ? ' is-custom' : ''}" data-qty="${key}" value="${i.g}" aria-label="${F ? F.n : i.f} en grammes"><i>g</i></span>
        <small data-qkcal="${key}">${k} kcal</small>
      </span>
      <button type="button" class="step-btn" data-qstep="${key}|${stp}" aria-label="Plus">+</button>
    </span>`;
  }

  function itemView(i, m) {
    const F = food(i.f);
    if (i.f === 'creatine') {
      return `<li>
        <span class="item-name"><span>${F.n}</span><small>dans le shaker</small></span>
        <span class="item-q"><span class="q-col"><b>${i.g} g</b></span></span>
      </li>`;
    }

    if (PROTS.some((x) => x[0] === i.f)) {
      const open = swapOpen === m.id;
      const chips = open
        ? `<div class="swap-chips" role="group" aria-label="Remplacer par">${PROTS.map(
            (x) =>
              `<button type="button" class="chip" data-swap="${m.id}|${x[0]}" aria-pressed="${
                x[0] === i.f
              }">${x[1]}</button>`
          ).join('')}</div>`
        : '';
      return `<li class="swap-li">
        <div class="swap-row">
          <button type="button" class="swap-btn" data-swap-open="${m.id}" aria-expanded="${open}">
            <span class="item-name"><span>${F.n}</span><small>${
        open ? 'Choisis ta viande / poisson' : 'Changer ▾'
      }</small></span>
          </button>
          ${qtyControl(i, m)}
        </div>${chips}
      </li>`;
    }

    const hint = itemHint(i);
    return `<li>
      <span class="item-name"><span>${F.n}</span>${hint ? `<small>${hint}</small>` : ''}</span>
      ${qtyControl(i, m)}
    </li>`;
  }

  function mealHTML(m) {
    const done = !!st.eaten[m.id];
    const supp = m.supps
      ? `<div class="supp">${PILL}<div><strong>${m.supps}</strong><span>${m.suppNote}</span></div></div>`
      : '';
    return `
      <article class="card meal${done ? ' is-done' : ''}">
        <div class="meal-head">
          <span class="meal-num" aria-hidden="true">${done ? CHECK_SM : m.num}</span>
          <div class="meal-title"><h2>${m.name}</h2><span>${m.sub}</span></div>
          <span class="meal-kcal" data-mkcal="${m.id}">${fmt(m.kcal)} kcal</span>
        </div>
        <ul class="items">${m.items.map((i) => itemView(i, m)).join('')}</ul>
        ${supp}
        <div class="meal-foot">
          <button type="button" class="done-btn" data-meal="${m.id}" aria-pressed="${done}">${CHECK}<span>${
      done ? 'Repas validé' : 'Valider ce repas'
    }</span></button>
        </div>
      </article>`;
  }

  function updateRepasSummary(P) {
    const t = P.tot;
    const curK = Math.round(t.kcal);
    const tgtK = Math.round(P.target);
    const diff = tgtK - curK;

    $('kcal').textContent = fmt(curK);
    $('kcalTarget').textContent = `/ ${fmt(tgtK)} kcal`;

    const diffEl = $('kcalDiff');
    diffEl.classList.remove('is-ok', 'is-over');
    if (Math.abs(diff) <= 35) {
      diffEl.textContent = 'Dans la cible ✓';
      diffEl.classList.add('is-ok');
    } else if (diff > 0) {
      diffEl.textContent = `Reste ${fmt(diff)} kcal`;
    } else {
      diffEl.textContent = `+${fmt(-diff)} kcal au-dessus`;
      diffEl.classList.add('is-over');
    }

    $('floorNote').hidden = !P.lowFiber;
    if (P.lowFiber) {
      $('floorNote').textContent = `Fibres basses (${Math.round(t.fib)} g / ${P.fiberTargetG} g) : ajoute un peu de légumes verts.`;
    }

    const pk = t.p * 4;
    const gk = t.g * 4;
    const lk = t.l * 9;
    const tot = Math.max(1, pk + gk + lk);
    $('barP').style.width = (pk / tot) * 100 + '%';
    $('barG').style.width = (gk / tot) * 100 + '%';
    $('barL').style.width = (lk / tot) * 100 + '%';
    $('mP').textContent = `${Math.round(t.p)} / ${P.targetProt != null ? P.targetProt : P.N.proteinG} g`;
    $('mG').textContent = `${Math.round(t.g)} / ${P.targetCarbs} g`;
    $('mL').textContent = `${Math.round(t.l)} / ${P.targetFat != null ? P.targetFat : P.N.fatG} g`;
    $('mFib').textContent = `${Math.round(t.fib)} / ${P.fiberTargetG} g`;

    const eaten = P.meals.reduce((a, m) => a + (st.eaten[m.id] ? m.kcal : 0), 0);
    const count = P.meals.filter((m) => st.eaten[m.id]).length;
    $('doneCount').textContent = `${count} / 3 repas mangés`;
    $('eaten').textContent = `${fmt(eaten)} / ${fmt(curK)} kcal`;
    $('eatenBar').style.width = Math.min(100, curK > 0 ? (eaten / curK) * 100 : 0) + '%';
    $('resetQtyRow').hidden = !P.hasCustom;
  }

  function renderRepas() {
    const P = buildDay(st.phase, viewDay());
    updateRepasSummary(P);
    $('meals').innerHTML = P.meals.map(mealHTML).join('');
  }

  function renderCycle() {
    const ti = cycleIdx();
    const vi = viewIdx();
    const N = CYCLE.length;
    const ask = ti === null;
    const i = ask ? null : vi;
    const S = i !== null && CYCLE[i] ? SESSIONS[CYCLE[i]] : null;
    const sub = S && S.sub ? ` · ${S.sub}` : '';

    $('todayLab').textContent = ask
      ? 'Configure ton cycle'
      : vi !== ti
      ? `Aperçu · Jour ${vi + 1}/${N}${sub}`
      : `Aujourd’hui · Jour ${ti + 1}/${N}${sub}`;
    $('todayName').textContent = ask
      ? 'Quel jour du cycle es-tu ?'
      : S
      ? S.title
      : '🧘 Repos & Récupération';

    $('todayPill').hidden = ask;
    $('todayPill').textContent = viewDay() === 'on' ? 'Jour ON' : 'Jour OFF';

    $('strip').innerHTML = CYCLE.map(
      (s, k) => `
      <button type="button" class="cyc${s ? ' is-train' : ''}${k === ti ? ' is-now' : ''}${
        k === vi && vi !== ti ? ' is-peek' : ''
      }" data-cyc="${k}"${k === ti ? ' aria-current="date"' : ''}>
        <small>J${k + 1}</small><b>${s ? SESSIONS[s].short : 'Off'}</b>
      </button>`
    ).join('');

    $('todayActs').hidden = ask || vi !== ti;
    $('backBtn').hidden = ask || vi === ti;
    if (!ask) $('backBtn').textContent = `Revenir à aujourd’hui (J${ti + 1})`;
    $('cycBar').classList.toggle('is-ask', ask);
  }

  function renderWeighCard() {
    const has = st.weights[today] != null;
    const day = [1, 3, 5].includes(dateOf(today).getDay());
    $('weighCard').hidden = (!day || has) && document.activeElement !== $('wQuick');
  }

  const deloadOn = () => !!st.deloadUntil && dayNo(today) < dayNo(st.deloadUntil);
  const setsFor = (e, dl) => (dl ? Math.min(DELOAD_MAX_SETS, e.sets) : e.sets);
  const unfolded = new Set();

  const activeViewIdx = () => {
    const ti = cycleIdx();
    return ti !== null ? viewIdx() : st.viewIdx || 0;
  };

  function altVariantIdx(altKey, vi, listLen) {
    if (!listLen) return 0;
    const onDays = onDaysList();
    const onPos = onDays.indexOf(vi);
    if (onPos < 0) return 0;
    const ti = cycleIdx();
    let cycleNum = 0;
    if (ti !== null && st.cycleStart && CYCLE.length) {
      const n = dayNo(today) - dayNo(st.cycleStart);
      cycleNum = Math.floor(n / CYCLE.length);
      if (vi < ti) cycleNum += 1;
    }
    const seq = cycleNum * onDays.length + onPos;
    const offset = (st.altParity && Number(st.altParity[altKey])) || 0;
    return (((seq + offset) % listLen) + listLen) % listLen;
  }

  const resolveEx = (s, slot, vi) => {
    const sess = SESSIONS[s];
    const item = sess && sess.ex[Number(slot)];
    if (!item) return null;
    if (item.isAlt) {
      const idx = vi != null ? vi : activeViewIdx();
      const vIdx = altVariantIdx(item.altKey, idx, item.variants.length);
      return Object.assign(
        { altKey: item.altKey, variantIdx: vIdx, variants: item.variants },
        item.variants[vIdx]
      );
    }
    return item;
  };

  function exHTML(s, e, i, dl, slot) {
    const nSets = setsFor(e, dl);
    const lt = lastTime(e.n);
    const tech = techOf(e, dl);
    const tSteps = techSteps(tech);
    const nNorm = tech ? nSets - tSteps : nSets;
    const donePrefix = e.altKey ? `${s}|${slot}|v${e.variantIdx}` : `${s}|${slot}`;
    let all = true;

    const sets = Array.from({ length: nSets }, (_, k) => {
      const key = `${donePrefix}|${k}`;
      const d = !!st.log.done[key];
      if (!d) all = false;
      const isTech = !!tech && k >= nNorm;
      return `<button type="button" class="set-btn" data-set="${key}" aria-pressed="${d}">${
        d ? CHECK_SM : isTech ? tech.k : k + 1
      }</button>`;
    }).join('');

    const id = donePrefix;
    if (all && !unfolded.has(id)) {
      return `
      <article class="card ex is-done is-folded">
        <button type="button" class="ex-fold" data-unfold="${id}" aria-expanded="false">
          <span class="ex-num" aria-hidden="true">${CHECK_SM}</span>
          <span class="ex-fold-name">${e.n}</span>
          ${st.loads[e.n] != null ? `<span class="ex-fold-kg">${fmtKg(st.loads[e.n])} kg</span>` : ''}
          ${CHEVRON}
        </button>
      </article>`;
    }

    const curLoad = num(st.loads[e.n]);
    const progDiff = lt && isFinite(curLoad) && curLoad > lt.kg ? Math.round((curLoad - lt.kg) * 100) / 100 : 0;
    const progHtml = progDiff > 0 ? `<span class="ex-prog">+${fmtKg(progDiff)} kg</span>` : '';
    const lastHtml = lt ? `<p class="ex-last">Dernière fois : ${fmtKg(lt.kg)} kg (${shortDate(lt.d)})${progHtml}</p>` : '';
    const otherAlt = e.altKey && e.variants && e.variants.length > 1
      ? e.variants[(e.variantIdx + 1) % e.variants.length]
      : null;
    const altBtnHtml = otherAlt
      ? `<button type="button" class="link-btn ex-alt-btn" data-alt="${e.altKey}">⇄ ${otherAlt.short || otherAlt.n}</button>`
      : '';
    const allBtnHtml = !all ? `<button type="button" class="link-btn ex-all-btn" data-setall="${donePrefix}">Tout valider</button>` : '';
    const actsHtml = altBtnHtml || allBtnHtml ? `<div class="ex-foot-acts">${altBtnHtml}${allBtnHtml}</div>` : '';
    const footHtml = lastHtml || actsHtml ? `<div class="ex-foot">${lastHtml}${actsHtml}</div>` : '';

    return `
      <article class="card ex${all ? ' is-done' : ''}">
        <div class="ex-head">
          <span class="ex-num" aria-hidden="true">${e.opt ? '+' : i + 1}</span>
          <div class="ex-title">
            <h3>${e.n}</h3>
            <p class="ex-meta"><b>${
              tech ? `${nNorm} × ${e.reps} + ${tSteps > 1 ? `${tSteps} ` : ''}${tech.k}` : `${nSets} × ${e.reps}`
            }</b><span>${dl ? (e.poly ? 'Deload · RIR 3' : 'Deload · RIR 2') : e.rir}</span></p>
            ${e.note ? `<small>${e.note}</small>` : ''}
          </div>
          <button type="button" class="rest-btn" data-rest="${s}|${slot}">${CLOCK}${
      e.restTxt || fmtRest(e.rest)
    }</button>
        </div>
        <div class="ex-row">
          <div class="load-row">
            <input id="load-${s}-${slot}" type="text" inputmode="decimal" autocomplete="off" placeholder="${
      defKg(e) != null ? fmtKg(defKg(e)) : 'kg'
    }" data-load="${e.n}" value="${
      st.loads[e.n] != null ? fmtKg(st.loads[e.n]) : ''
    }" aria-label="Charge en kg">
            <button type="button" class="plus-btn" data-plus="${s}|${slot}">+${fmtKg(
      stepFor(e)
    )}</button>
          </div>
          <div class="sets" role="group">${sets}</div>
        </div>
        ${footHtml}
        ${all ? `<button type="button" class="link-btn ex-refold" data-unfold="${id}">Replier</button>` : ''}
      </article>`;
  }

  function renderSeance() {
    const vi = activeViewIdx();
    const dl = deloadOn();

    const s = CYCLE[vi];
    $('sessionBox').hidden = !s;
    $('recoveryBox').hidden = !!s;
    if (s) {
      const S = SESSIONS[s];
      let total = 0;
      let done = 0;
      S.ex.forEach((_, i) => {
        const e = resolveEx(s, i, vi);
        if (!e || e.opt) return;
        const n = setsFor(e, dl) - techSteps(techOf(e, dl));
        for (let k = 0; k < n; k++) {
          total++;
          if (st.log.done[`${s}|${i}|${k}`]) done++;
        }
      });
      $('deloadTag').hidden = !dl;
      const cards = S.ex.map((_, i) => {
        const e = resolveEx(s, i, vi);
        return !e || (dl && e.opt) ? '' : exHTML(s, e, i, dl, String(i));
      });
      $('exList').innerHTML = cards.join('');
      $('setCount').textContent = `${done} / ${total}`;
      $('setBar').style.width = total > 0 ? (done / total) * 100 + '%' : '0%';
      $('deloadBtn').setAttribute('aria-checked', String(dl));
      if ($('deloadTitle') && CYCLE.length) {
        $('deloadTitle').textContent = `Mode deload (${CYCLE.length} jours)`;
      }
      $('deloadText').textContent = dl
        ? `Actif jusqu’au ${longDate(fromNo(dayNo(st.deloadUntil) - 1))}`
        : '2 séries / exercice · RIR 4 poly / RIR 3 iso';
    } else {
      $('recList').innerHTML = recoveryFor(vi)
        .map((r, i) => {
          const d = !!st.log.done['R|' + i];
          return `<button type="button" class="row" data-rec="${i}" aria-pressed="${d}">
          <span class="box">${CHECK_SM}</span>
          <span class="row-main"><span class="row-name">${r.n}</span><small>${r.d}</small></span>
        </button>`;
        })
        .join('');
    }

    const fat = (st.fatigueLog && st.fatigueLog[today]) || 'ok';
    document.querySelectorAll('[data-fatigue]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.fatigue === fat));
    });

    if ($('loadsSummaryTitle')) {
      const shorts = Object.keys(SESSIONS).map((k) => SESSIONS[k].short);
      $('loadsSummaryTitle').textContent = shorts.length
        ? `Mes charges (${shorts.join(' · ')})`
        : 'Mes charges';
    }
    if ($('loadsSummary')) {
      const loadRow = (e) => {
        const cur = st.loads[e.n];
        const lt = lastTime(e.n);
        const valTxt =
          cur != null
            ? `${fmtKg(cur)} kg`
            : defKg(e) != null
            ? `<small>${fmtKg(defKg(e))} kg</small>`
            : '—';
        const subTxt = lt ? `<small>(${shortDate(lt.d)})</small>` : '';
        return `<div class="loads-row"><span>${e.n}</span><b>${valTxt}${subTxt}</b></div>`;
      };
      const seenAlt = new Set();
      const altGroups = [];
      const sessHtml = Object.keys(SESSIONS)
        .map((sessKey) => {
          const S = SESSIONS[sessKey];
          const rows = [];
          S.ex.forEach((raw) => {
            if (raw.isAlt) {
              if (!seenAlt.has(raw.altKey)) {
                seenAlt.add(raw.altKey);
                altGroups.push(raw);
              }
              return;
            }
            rows.push(loadRow(raw));
          });
          return `<div class="loads-group">${S.title}</div>` + rows.join('');
        })
        .join('');
      const altHtml = altGroups
        .map(
          (g) =>
            `<div class="loads-group">🟣 Alternance fin de séance</div>` +
            g.variants.map(loadRow).join('')
        )
        .join('');
      $('loadsSummary').innerHTML = sessHtml + altHtml;
    }
    renderCardio();
  }

  function cardioPlan(phase) {
    const ph = phase || st.phase;
    const p = profile();
    const N = calcNutrition(ph);
    const def = CARDIO_TARGETS[ph] || CARDIO_TARGETS.seche;
    const baseOn = def.on;
    const baseOff = def.off;
    const autoOn = N.recommendedCardioOnMin != null ? N.recommendedCardioOnMin : baseOn;
    const autoOff = N.recommendedCardioOffMin != null ? N.recommendedCardioOffMin : baseOff;
    const hasCustom = p.cardioOnMin != null || p.cardioOffMin != null;
    const on = p.cardioOnMin != null ? Math.max(0, Math.min(90, Math.round(Number(p.cardioOnMin)))) : baseOn;
    const off = p.cardioOffMin != null ? Math.max(0, Math.min(90, Math.round(Number(p.cardioOffMin)))) : baseOff;
    const source = hasCustom ? (p.cardioSource === 'ai' ? 'ai' : 'custom') : 'base';
    return {
      on,
      off,
      baseOn,
      baseOff,
      autoOn,
      autoOff,
      source,
      N,
      kcalPerMin: N.kcalPerZone2Min || 7.5
    };
  }

  function renderCardio() {
    const day = viewDay();
    const C = cardioPlan(st.phase);
    const todayMin = day === 'on' ? C.on : C.off;
    const estKcal = Math.round(todayMin * C.kcalPerMin);
    const avgMin = Math.round((C.on + C.off) / 2);
    const weeklyMin = Math.round(((C.on + C.off) / 2) * 7);
    const lossTxt = String(Math.round(C.N.weeklyLossKg * 100) / 100).replace('.', ',');
    const srcLabel = C.source === 'ai' ? 'Coach IA' : C.source === 'custom' ? 'Perso' : 'Plan';

    // 1. Affichage dans l'onglet Cardio (Jour ON / Jour OFF)
    if ($('cardioCard')) {
      $('cardioBadge').textContent = `Jour ${day === 'on' ? 'ON' : 'OFF'}`;
      $('cardioSub').textContent =
        day === 'on'
          ? 'Aller-retour salle à pied'
          : todayMin > 0
          ? 'Marche / Zone 2'
          : 'Repos · marche libre';
      $('cardioTodayMin').textContent = `${todayMin} min`;
      $('cardioTodayMeta').textContent =
        todayMin > 0
          ? `≈ ${fmt(estKcal)} kcal · ~${fmt(weeklyMin)} min/sem (${avgMin} min/j)`
          : `~${fmt(weeklyMin)} min/sem · pas de cardio obligatoire aujourd’hui`;
    }
    if ($('cardioResOn')) $('cardioResOn').textContent = `${C.on} min`;
    if ($('cardioResOff')) $('cardioResOff').textContent = `${C.off} min`;
    if ($('cardioResSlotOn')) $('cardioResSlotOn').classList.toggle('is-active', day === 'on');
    if ($('cardioResSlotOff')) $('cardioResSlotOff').classList.toggle('is-active', day === 'off');
    if ($('cardioPlanSource')) {
      $('cardioPlanSource').textContent =
        C.source === 'ai'
          ? 'Suggéré par le Coach IA'
          : C.source === 'custom'
          ? 'Durées personnalisées'
          : 'Plan par défaut';
    }

    // 2. Réglages cardio dans l'onglet Réglages
    if ($('cardioSettingsCard')) {
      $('cardioSettingsBadge').textContent = srcLabel;
      $('cardioSettingsHint').textContent =
        st.phase === 'seche'
          ? `Cut · cible −${lossTxt} kg/sem. Jour ON = aller-retour salle (${CARDIO_TARGETS.seche.on} min).`
          : `Maintien · Jour ON = aller-retour salle (${CARDIO_TARGETS.seche.on} min), Jour OFF libre.`;

      $('cardioSlotOn').classList.toggle('is-active', day === 'on');
      $('cardioSlotOff').classList.toggle('is-active', day === 'off');
      $('cardioOnVal').textContent = `${C.on} min`;
      $('cardioOffVal').textContent = `${C.off} min`;

      const decOn = document.querySelector('[data-cstep="on|-5"]');
      const incOn = document.querySelector('[data-cstep="on|5"]');
      const decOff = document.querySelector('[data-cstep="off|-5"]');
      const incOff = document.querySelector('[data-cstep="off|5"]');
      if (decOn) decOn.disabled = C.on <= 0;
      if (incOn) incOn.disabled = C.on >= 90;
      if (decOff) decOff.disabled = C.off <= 0;
      if (incOff) incOff.disabled = C.off >= 90;

      const showReset = C.source !== 'base';
      $('cardioResetRow').hidden = !showReset;
      if (showReset) {
        $('cardioSourceHint').textContent =
          C.source === 'ai'
            ? `Suggéré par le Coach IA (défaut : ${C.baseOn} ON / ${C.baseOff} OFF)`
            : `Durées perso (défaut : ${C.baseOn} ON / ${C.baseOff} OFF)`;
      }
    }
  }

  // ==========================================================================
  // 8. RENDU : COURSES, POIDS & COURBE SVG
  // ==========================================================================

  const packs = (t, size, one, many) => {
    const n = Math.max(1, Math.ceil(t / size - 0.001));
    return `${n} ${n > 1 ? many : one}`;
  };
  const kgUp = (g) => String(Math.max(0.5, Math.ceil(g / 500) * 0.5)).replace('.', ',') + ' kg';

  function shopCounts() {
    const N = st.shopDays || 8;
    const ti = cycleIdx();
    let on = 0;
    for (let k = 0; k < N; k++) {
      const isOn =
        ti === null
          ? (st.day === 'on') === (k % 2 === 0)
          : ((ti + k) % CYCLE.length) % 2 === 0;
      if (isOn) on++;
    }
    return { N, on, off: N - on };
  }

  function shopping() {
    const T = {};
    const C = shopCounts();
    [
      [buildDay(st.phase, 'on'), C.on],
      [buildDay(st.phase, 'off'), C.off]
    ].forEach((pair) => {
      pair[0].meals.forEach((m) =>
        m.items.forEach((i) => {
          T[i.f] = (T[i.f] || 0) + i.g * pair[1];
        })
      );
    });
    const g = (id) => Math.round(T[id] || 0);
    const rules = SHOP_RULES || {};
    const eggWeightG = Number(rules.eggWeightG) || 56.7;
    const eggBoxSize = Number(rules.eggBoxSize) || 12;
    const oilDensity = Number(rules.oilDensity) || 0.916;
    const ml = Math.round(g('olive_oil') / oilDensity / 5) * 5;
    const nEggs = Math.ceil(g('eggs') / eggWeightG - 0.001);
    const r = (id, n, need, buy) => ({ id, n, need, buy });

    const grocery = [];
    (rules.epicerie || []).forEach((it) => {
      if (it.type === 'oil') {
        if (ml > 0) {
          grocery.push(r(it.id, it.label, '~' + ml + ' ml', ml <= 500 ? '1 bouteille 50 cl' : '1 bouteille 1 L'));
        }
        return;
      }
      const amt = g(it.id);
      if (it.optional && amt <= 0) return;
      grocery.push(r(it.id, it.label, fmt(amt) + ' g', packs(amt, it.packSize, it.one, it.many)));
    });

    const freshItems = [];
    (rules.meats || []).forEach((x) => {
      const amt = g(x.id);
      if (amt > 0) freshItems.push(r(x.id, x.label, fmt(amt) + ' g', '≈ ' + kgUp(amt * (x.mult || 1))));
    });
    const nBoxes = Math.max(1, Math.ceil(nEggs / eggBoxSize));
    freshItems.push(
      r('oeufs', 'Œufs (calibre L)', nEggs + ' œufs', nBoxes + (nBoxes > 1 ? ` boîtes de ${eggBoxSize}` : ` boîte de ${eggBoxSize}`))
    );
    (rules.fresh || []).forEach((x) => {
      const amt = g(x.id);
      freshItems.push(r(x.id, x.label, fmt(amt) + ' g', '≈ ' + kgUp(amt * (x.mult || 1))));
    });
    if (rules.avocado && g(rules.avocado.id) > 0) {
      const av = rules.avocado;
      freshItems.push(r(av.id, av.label, fmt(g(av.id)) + ' g', packs(g(av.id), av.unitG, av.one, av.many)));
    }

    const compItems = (rules.complements || []).map((c) =>
      r(c.id, c.label, c.fromFood ? fmt(g(c.id)) + ' g' : c.need, c.buy || 'Vérifier stock')
    );

    return [
      { title: 'Frais', items: freshItems },
      { title: 'Épicerie', items: grocery },
      { title: 'Compléments', items: compItems }
    ];
  }

  function renderCourses() {
    let total = 0;
    let count = 0;
    $('groups').innerHTML = shopping()
      .map(
        (g) => `
      <section class="group">
        <h2>${g.title}</h2>
        <div class="card list-card">${g.items
          .map((r) => {
            const done = !!st.cart[r.id];
            total++;
            if (done) count++;
            return `<button type="button" class="row" data-cart="${r.id}" aria-pressed="${done}">
            <span class="box">${CHECK_SM}</span>
            <span class="row-main"><span class="row-name">${r.n}</span><small>${r.need}</small></span>
            <span class="row-buy">${r.buy}</span>
          </button>`;
          })
          .join('')}</div>
      </section>`
      )
      .join('');

    const C = shopCounts();
    $('cartBasis').textContent = `Pour ${C.N} jours (${C.on} ON · ${C.off} OFF)`;
    document
      .querySelectorAll('[data-shop]')
      .forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.shop) === C.N)));
    $('cartCount').textContent = `${count} / ${total}`;
    $('cartBar').style.width = (count / total) * 100 + '%';
    $('cartResetRow').hidden = count === 0;
  }

  let selectedWeightDay = today;
  let waistSuggestCm = null;

  function renderSuivi() {
    const W = weekly();
    const ok = W.r1 != null;
    const p = profile();
    const rw = rollingWeight();
    const wa = waistInfo();
    const ep = engineProfile(st.phase);
    const N = NE.calculateTargets(ep);

    buildWeek();

    $('dietAdhered').checked = p.dietAdhered !== false;
    $('sleepOk').checked = p.sleepOk !== false;

    if (document.activeElement !== $('waistInput')) {
      $('waistInput').value =
        st.waist[today] != null
          ? String(st.waist[today]).replace('.', ',')
          : wa.latest != null
          ? String(wa.latest).replace('.', ',')
          : '';
    }
    if (wa.delta != null) {
      const sign = wa.delta > 0 ? '+' : wa.delta < 0 ? '−' : '±';
      $('waistInfo').textContent = `${sign}${fmt1(Math.abs(wa.delta))} cm depuis le ${shortDate(wa.prevD)}`;
    } else if (wa.latest != null) {
      $('waistInfo').textContent = `Dernière mesure : ${fmt1(wa.latest)} cm (${shortDate(wa.latestD)})`;
    } else {
      $('waistInfo').textContent = 'À jeun au nombril · en cm';
    }
    if ($('waistHelper') && waistSuggestCm == null) $('waistHelper').hidden = true;

    const waAvg = st.weeklyAvgs || syncWeeklyAvgs();
    const nAvg = waAvg.n ? waAvg.n.avg : null;
    const n1Avg = waAvg.n1 ? waAvg.n1.avg : null;
    const ignTxt = rw.ignoredCount > 0 ? ` (${rw.ignoredCount} j sans repas cochés ignoré${rw.ignoredCount > 1 ? 's' : ''})` : '';
    const lossTxt = String(Math.round(N.weeklyLossKg * 100) / 100).replace('.', ',');
    if (nAvg != null || n1Avg != null) {
      $('wInfo').innerHTML =
        (nAvg != null ? `Sem. N : <b>${fmt1(nAvg)} kg</b>${ignTxt}` : 'Sem. N : —') +
        ` · Sem. N−1 : ${n1Avg != null ? `<b>${fmt1(n1Avg)} kg</b>` : '—'}` +
        (st.phase === 'seche' ? ` · Cible : −${lossTxt} kg/sem` : '');
    } else {
      $('wInfo').textContent = `Pèse-toi à jeun (lun, mer, ven) · Actuel : ${fmt1(rw.weightKg)} kg → Objectif : ${fmt1(p.targetWeightKg)} kg`;
    }

    const ev = NE.evaluateStagnation(ep, W.r1, W.r0, false, {
      waistDeltaCm: wa.delta,
      sleepUnder7h: p.sleepOk === false,
      effectiveOffKcal: tgt(st.phase, 'off')
    });
    const showResult = ok || N.nearTarget;
    $('result').hidden = !showResult;
    if ($('adhereGroup')) $('adhereGroup').hidden = ev.status !== 'stagnating' && ev.status !== 'sleep';

    if (showResult) {
      $('delta').textContent = ok
        ? (W.r1 > 0 ? '+' : W.r1 < 0 ? '−' : '±') + Math.abs(W.r1).toFixed(1).replace('.', ',') + ' kg / sem.'
        : `${fmt1(rw.weightKg)} kg`;
      const diag = $('resDiag');
      diag.textContent = ev.title;
      diag.classList.remove('is-ok', 'is-warn');
      if (ev.status === 'ok' || ev.status === 'recomp' || ev.status === 'target_reached') diag.classList.add('is-ok');
      else if (ev.status === 'stagnating' || ev.status === 'fast' || ev.status === 'sleep' || ev.status === 'drift') diag.classList.add('is-warn');
      if (ev.status === 'stagnating' && p.dietAdhered === false) {
        $('resAction').textContent =
          'Valide d’abord ≥ 90 % de respect de la diète sur 7 jours avant de baisser les calories ou d’ajouter du cardio.';
        $('adjBtns').hidden = true;
      } else {
        $('resAction').textContent = ev.message;
        const hasAct = ev.action && ev.action !== 'none';
        $('adjBtns').hidden = !hasAct;
        if (hasAct) {
          $('adjBtns').innerHTML = `<button type="button" class="apply-btn" data-stag-act="${ev.action}">${ev.buttonLabel}</button>`;
        }
      }
    }

    if ($('aiHint')) {
      if (!ok || ev.status === 'wait') {
        $('aiHint').textContent = 'Pas encore assez de recul auto : demande au Coach IA un bilan complet.';
      } else if (ev.status === 'stagnating' || ev.status === 'recomp' || ev.status === 'sleep' || ev.status === 'drift') {
        $('aiHint').textContent = 'Cas délicat : demande au Coach IA quoi ajuster (kcal et cardio).';
      } else {
        $('aiHint').textContent = 'Analyse ton poids, tes kcal et te dit quoi ajuster.';
      }
    }
  }

  function buildWeek() {
    const days = [6, 5, 4, 3, 2, 1, 0].map((k) => fromNo(dayNo(today) - k));
    if (!days.includes(selectedWeightDay)) selectedWeightDay = today;

    $('wWeek').innerHTML = days
      .map((d) => {
        const v = st.weights[d];
        const dt = dateOf(d);
        const isToday = d === today;
        const isSel = d === selectedWeightDay;
        return `<button type="button" class="wk-day${isToday ? ' is-today' : ''}${v == null ? ' is-empty' : ''}" data-pick-wday="${d}" aria-pressed="${isSel}" aria-label="${longDay(d)}">
          <span>${DOW[dt.getDay()]} ${dt.getDate()}</span>
          <b>${v != null ? fmt1(v) : '—'}</b>
        </button>`;
      })
      .join('');

    const entry = $('wEntryInput');
    if (entry) {
      entry.dataset.wday = selectedWeightDay;
      const val = st.weights[selectedWeightDay];
      if (document.activeElement !== entry) {
        entry.value = val != null ? String(val).replace('.', ',') : '';
      }
      if ($('wEntryLabel')) {
        $('wEntryLabel').textContent = selectedWeightDay === today ? 'Aujourd’hui' : longDay(selectedWeightDay);
      }
      if ($('wEntryClear')) $('wEntryClear').hidden = val == null;
    }
  }

  // Courbe de poids SVG
  const CW = 326, CH = 148, CX0 = 34, CX1 = 318, CY0 = 12, CY1 = 112;
  let curvePts = [], curveIdx = -1;

  function renderCurve() {
    const box = $('wCurve');
    const wasOpen = !!(box.querySelector('details') || {}).open;
    const t0 = dayNo(today);
    const all = Object.keys(st.weights)
      .filter((d) => isFinite(st.weights[d]) && dayNo(d) <= t0)
      .sort();
    const rawPts = all
      .filter((d) => t0 - dayNo(d) <= 55)
      .map((d) => ({ d, n: dayNo(d), v: st.weights[d] }));
    const pts = NE.computeWeightTrend(rawPts);

    curvePts = [];
    curveIdx = -1;

    if (pts.length < 2) {
      box.innerHTML = `<p class="hint">${
        pts.length
          ? 'Ajoute une 2e pesée pour afficher ta courbe.'
          : 'Ta courbe s’affichera dès ta 2e pesée.'
      }</p>`;
      return;
    }

    const vals = pts.reduce((a, p) => a.concat([p.v, p.trendKg]), []);
    const lo0 = Math.min.apply(null, vals);
    const hi0 = Math.max.apply(null, vals);
    const step = [0.5, 1, 2, 5, 10].find((x) => (hi0 - lo0) / x <= 3) || 20;
    const lo = Math.floor((lo0 - step * 0.1) / step) * step;
    const hi = Math.ceil((hi0 + step * 0.1) / step) * step;
    const n0 = pts[0].n;
    const span = Math.max(1, t0 - n0);
    const X = (n) => CX0 + ((n - n0) / span) * (CX1 - CX0);
    const Y = (v) => CY1 - ((v - lo) / (hi - lo)) * (CY1 - CY0);

    pts.forEach((p) => {
      p.x = Math.round(X(p.n) * 10) / 10;
      p.y = Math.round(Y(p.v) * 10) / 10;
      p.ty = Math.round(Y(p.trendKg) * 10) / 10;
    });
    curvePts = pts;

    let grid = '';
    for (let k = 0; lo + k * step <= hi + 1e-9; k++) {
      const v = lo + k * step;
      const y = Math.round(Y(v) * 10) / 10;
      grid += `<line class="wt-grid" x1="${CX0}" x2="${CX1}" y1="${y}" y2="${y}"/><text class="wt-tick" x="${
        CX0 - 8
      }" y="${y}" text-anchor="end" dominant-baseline="middle">${frNum(v, step < 1 ? 1 : 0)}</text>`;
    }

    const first = pts[0];
    const last = pts[pts.length - 1];
    const diff = Math.round((last.trendKg - first.trendKg) * 10) / 10;
    const diffTxt =
      diff === 0
        ? `Stable depuis le ${shortDate(first.d)}`
        : `${diff > 0 ? '+' : '−'}${frNum(Math.abs(diff), 1)} kg depuis le ${shortDate(first.d)}`;
    const rawDots = pts.map((p) => `<circle class="wt-pt" cx="${p.x}" cy="${p.y}" r="2.2"/>`).join('');
    const trendPath = pts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.ty).join(' ');
    const areaPath = `M${first.x} ${CY1} ${pts.map((p) => 'L' + p.x + ' ' + p.ty).join(' ')} L${last.x} ${CY1} Z`;

    box.innerHTML = `
      <p class="wt-now"><b>${kgTxt(last.v)}</b><span>Tendance ${fmt1(last.trendKg)} kg · ${diffTxt}</span></p>
      <div class="wt-chart" tabindex="0">
        <svg viewBox="0 0 ${CW} ${CH}">
          <defs>
            <linearGradient id="wtAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--wt)" stop-opacity="0.22"/>
              <stop offset="100%" stop-color="var(--wt)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          ${grid}
          <text class="wt-tick" x="${CX0}" y="${CH - 8}">${shortDate(first.d)}</text>
          <text class="wt-tick" x="${CX1}" y="${CH - 8}" text-anchor="end">${shortDate(today)}</text>
          <path class="wt-area" d="${areaPath}"/>
          <path class="wt-raw" d="${pts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ')}"/>
          ${rawDots}
          <path class="wt-line" d="${trendPath}"/>
          <line class="wt-cross" id="wCross" x1="0" x2="0" y1="${CY0}" y2="${CY1}" style="display:none"/>
          <circle class="wt-dot" cx="${last.x}" cy="${last.ty}" r="4.5"/>
          <circle class="wt-dot" id="wHover" r="4.5" style="display:none"/>
        </svg>
        <div class="wt-tip" id="wTip" hidden><b></b><span></span></div>
      </div>
      <details class="sub"${wasOpen ? ' open' : ''}>
        <summary>Historique (${all.length} pesées)${CHEVRON}</summary>
        <ul class="wt-list">${all
          .slice()
          .reverse()
          .slice(0, 60)
          .map((d) => `<li><span>${dayTxt(d)}</span><b>${kgTxt(st.weights[d])}</b></li>`)
          .join('')}</ul>
      </details>`;
  }

  function showPoint(i) {
    const p = curvePts[i];
    const tip = $('wTip');
    if (!p || !tip) return;
    curveIdx = i;
    const cross = $('wCross');
    const dot = $('wHover');
    cross.setAttribute('x1', p.x);
    cross.setAttribute('x2', p.x);
    cross.style.display = '';
    dot.setAttribute('cx', p.x);
    dot.setAttribute('cy', p.ty);
    dot.style.display = '';
    tip.firstElementChild.textContent = kgTxt(p.v);
    tip.lastElementChild.textContent = `${dayTxt(p.d)} · tend. ${fmt1(p.trendKg)} kg`;
    tip.hidden = false;
    const chart = tip.parentElement;
    const k = chart.clientWidth / CW;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const above = p.y * k - h - 10;
    tip.style.left = Math.min(chart.clientWidth - w, Math.max(0, p.x * k - w / 2)) + 'px';
    tip.style.top = (above >= -6 ? above : p.y * k + 12) + 'px';
  }

  function hidePoint() {
    curveIdx = -1;
    ['wCross', 'wHover'].forEach((id) => {
      const el = $(id);
      if (el) el.style.display = 'none';
    });
    const tip = $('wTip');
    if (tip) tip.hidden = true;
  }

  // ==========================================================================
  // 9. RENDU : RÉGLAGES, SAUVEGARDE & MINUTEUR DE REPOS
  // ==========================================================================

  const REF_KEYS = [
    ['kcal', 'kcal'],
    ['p', 'P'],
    ['g', 'G'],
    ['l', 'L']
  ];

  function foodRefGroups() {
    const order = NE.RULE_CONFIG.foodsGroupOrder || ['Protéines', 'Glucides', 'Lipides', 'Légumes'];
    const map = {};
    order.forEach((g) => { map[g] = []; });
    Object.keys(FOODS_DEFAULT).forEach((id) => {
      const F = FOODS_DEFAULT[id];
      if (!F || F.hidden) return;
      const g = F.group || 'Autres';
      if (!map[g]) map[g] = [];
      map[g].push(id);
    });
    return Object.keys(map).filter((g) => map[g].length > 0).map((g) => [g, map[g]]);
  }

  function buildFoodRef() {
    $('foodRef').innerHTML = foodRefGroups()
      .map(
        ([g, list]) =>
          `<p class="ref-group">${g}</p>` +
          list
            .map((f) => {
              const F = food(f);
              return `<div class="ref-row"><span class="ref-name">${F.n} <small id="refTag-${f}"></small></span>
        <div class="ref-in">${REF_KEYS.map(
          ([k, lab]) =>
            `<label><small>${lab}</small><input type="text" inputmode="decimal" autocomplete="off" data-food="${f}|${k}" value="${
              k === 'kcal' ? Math.round(F[k]) : n1(F[k])
            }"></label>`
        ).join('')}</div>
        <small class="ref-warn" id="refWarn-${f}" hidden></small></div>`;
            })
            .join('')
      )
      .join('');
  }

  function renderFoodRef() {
    let any = false;
    foodRefGroups().forEach(([, list]) =>
      list.forEach((f) => {
        const mod = Object.keys((st.foods || {})[f] || {}).length > 0;
        any = any || mod;
        const F = food(f);
        const tag = $('refTag-' + f);
        if (!tag) return;
        tag.textContent = mod ? 'modifié' : (FOODS_DEFAULT[f] && FOODS_DEFAULT[f].badge) || 'Table';
        tag.classList.toggle('is-mod', mod);
        const calc = 4 * F.p + 4 * F.g + 9 * F.l + 2 * (F.fib || 0);
        const off = F.kcal > 20 && Math.abs(calc - F.kcal) / F.kcal > 0.15;
        $('refWarn-' + f).hidden = !off;
        $('refWarn-' + f).textContent = off ? `Attendu ~${Math.round(calc)} kcal` : '';
      })
    );
    $('resetFoods').hidden = !any;
  }

  function buildProfile() {
    const p = profile();
    const sw = startWeight();
    const fields = [
      ['startWeightKg', 'Départ (kg)', sw != null ? String(sw).replace('.', ',') : '', 'decimal', '1re pesée'],
      ['targetWeightKg', 'Objectif (kg)', String(p.targetWeightKg).replace('.', ','), 'decimal', ''],
      ['heightCm', 'Taille (cm)', String(p.heightCm), 'numeric', ''],
      ['age', 'Âge (ans)', String(p.age), 'numeric', '']
    ];
    $('profGrid').innerHTML = fields
      .map(
        ([k, lab, val, mode, ph]) => `<label class="prof-field"><small>${lab}</small>
        <input type="text" inputmode="${mode}" autocomplete="off" data-prof="${k}" value="${val}"${ph ? ` placeholder="${ph}"` : ''}></label>`
      )
      .join('');
    const actBtns = document.querySelectorAll('[data-activity]');
    if (actBtns[0]) actBtns[0].dataset.activity = String(NE.DEFAULT_PROFILE.activityFactor);
    if (actBtns[1]) actBtns[1].dataset.activity = String(NE.RULE_CONFIG.profile.activityOfficeFactor || 1.25);
  }

  function renderProfile() {
    const p = profile();
    const pm = phaseMacros(st.phase);
    const sw = startWeight();
    const ep = engineProfile(st.phase);
    const N = NE.calculateTargets(ep);

    document.querySelectorAll('[data-activity]').forEach((b) => {
      b.setAttribute('aria-pressed', String(Math.abs(Number(b.dataset.activity) - N.activityFactor) < 0.04));
    });
    if ($('activityHint')) {
      $('activityHint').textContent = `×${String(N.activityFactor).replace('.', ',')} · Maintien ~${fmt(N.tdee)} kcal/j`;
    }

    const effOn = tgt(st.phase, 'on');
    const effOff = tgt(st.phase, 'off');

    const onIn = $('myOnKcal');
    const offIn = $('myOffKcal');
    if (document.activeElement !== onIn) onIn.value = String(effOn);
    if (document.activeElement !== offIn) offIn.value = String(effOff);
    onIn.classList.toggle('is-custom', customTarget(st.phase, 'on') !== null && effOn !== defaultTarget(st.phase, 'on'));
    offIn.classList.toggle('is-custom', customTarget(st.phase, 'off') !== null && effOff !== defaultTarget(st.phase, 'off'));

    const mDay = macroDay;
    document.querySelectorAll('[data-macroday]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.macroday === mDay));
    });

    const isOn = mDay === 'on';
    const protKey = isOn ? 'proteinOnG' : 'proteinOffG';
    const fatKey = isOn ? 'fatOnG' : 'fatOffG';
    const protVal = pm[protKey] ?? p[protKey] ?? p.proteinTargetG;
    const fatVal = pm[fatKey] ?? p[fatKey] ?? p.fatTargetG;
    const autoFat = isOn ? (N.autoFatOnG ?? N.fatOnG) : (N.autoFatOffG ?? N.fatOffG);

    const protIn = $('myMacroProtG');
    if (protIn) {
      protIn.dataset.macro = protKey;
      if (document.activeElement !== protIn) protIn.value = protVal != null ? String(protVal) : '';
      protIn.placeholder = String(NE.RULE_CONFIG.profile.proteinMaxG);
      protIn.classList.toggle('is-custom', protVal != null);
    }
    const fatIn = $('myMacroFatG');
    if (fatIn) {
      fatIn.dataset.macro = fatKey;
      if (document.activeElement !== fatIn) fatIn.value = fatVal != null ? String(fatVal) : '';
      fatIn.placeholder = `Auto (${autoFat})`;
      fatIn.classList.toggle('is-custom', fatVal != null);
    }

    const effCarbsOn = Math.max(0, Math.round((effOn - N.proteinOnG * 4 - N.fatOnG * 9) / 4));
    const effCarbsOff = Math.max(0, Math.round((effOff - N.proteinOffG * 4 - N.fatOffG * 9) / 4));
    if ($('myMacroCarbsG')) $('myMacroCarbsG').value = String(isOn ? effCarbsOn : effCarbsOff);
    if ($('myCarbsWarn')) {
      const warns = [];
      if (N.proteinOnG * 4 + N.fatOnG * 9 > effOn) {
        warns.push(`<span class="ks-chip is-warn">Prot + Lip &gt; Jour ON</span>`);
      }
      if (N.proteinOffG * 4 + N.fatOffG * 9 > effOff) {
        warns.push(`<span class="ks-chip is-warn">Prot + Lip &gt; Jour OFF</span>`);
      }
      $('myCarbsWarn').innerHTML = warns.join('');
      $('myCarbsWarn').hidden = warns.length === 0;
    }

    $('profFoldTitle').textContent =
      sw != null
        ? `Mon profil (${fmt1(sw)} → ${fmt1(p.targetWeightKg)} kg · ${p.heightCm} cm · ${p.age} ans)`
        : `Mon profil (Objectif ${fmt1(p.targetWeightKg)} kg · ${p.heightCm} cm · ${p.age} ans)`;
  }

  function needsBackup() {
    const hasData = hasLoggedWeight() || Object.keys(st.loads || {}).length > 0;
    if (!hasData) return false;
    if (!st.lastExport) return true;
    return dayNo(today) - dayNo(st.lastExport) >= 14;
  }

  function renderBackup() {
    if (!st.lastExport) {
      $('bkHint').textContent = needsBackup()
        ? 'Enregistré uniquement sur ton téléphone — pense à exporter une sauvegarde.'
        : 'Enregistré uniquement sur ton téléphone.';
      return;
    }
    const age = dayNo(today) - dayNo(st.lastExport);
    $('bkHint').textContent =
      age >= 14
        ? `Dernier export : ${shortDate(st.lastExport)} (${age} j) — export conseillé.`
        : `Dernier export : ${shortDate(st.lastExport)}`;
  }

  function render() {
    if (st.phase !== 'seche' && st.phase !== 'maintien') st.phase = 'maintien';
    $('app').dataset.day = viewDay();
    const raw = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    $('date').textContent = raw.charAt(0).toUpperCase() + raw.slice(1);
    $('screenTitle').textContent = TITLES[st.tab];

    const phaseBtn = $('phaseToggleBtn');
    phaseBtn.hidden = st.tab === 'seance' || st.tab === 'reglages' || st.tab === 'donnees' || st.tab === 'profil';
    phaseBtn.textContent = st.phase === 'seche' ? 'Cut' : 'Maintien';

    $('cycBar').hidden = !['repas', 'seance', 'cardio'].includes(st.tab);

    document
      .querySelectorAll('[data-phase]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.phase === st.phase)));
    TABS.forEach((t) => {
      if ($('view-' + t)) $('view-' + t).hidden = st.tab !== t;
    });
    document.querySelectorAll('.tab, .menu-item').forEach((b) => {
      if (b.dataset.tab === st.tab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if ($('menuBtn')) {
      $('menuBtn').classList.toggle('is-active', !['repas', 'seance', 'ia'].includes(st.tab));
      $('menuBtn').classList.toggle('has-dot', needsBackup());
    }

    if (['repas', 'seance', 'cardio'].includes(st.tab)) renderCycle();
    if (st.tab === 'repas') {
      renderWeighCard();
      renderRepas();
    } else if (st.tab === 'seance') {
      renderSeance();
    } else if (st.tab === 'cardio') {
      renderCardio();
    } else if (st.tab === 'courses') {
      renderCourses();
    } else if (st.tab === 'suivi') {
      renderSuivi();
      renderCurve();
    } else if (st.tab === 'ia') {
      renderAiCoach();
    } else if (st.tab === 'profil') {
      renderProfile();
    } else if (st.tab === 'reglages') {
      renderCardio();
      renderFoodRef();
      renderAiCoach();
    } else if (st.tab === 'donnees') {
      renderBackup();
    }
  }

  async function doExport() {
    const txt = JSON.stringify(
      { app: 'mon-plan-repas', v: 1, at: new Date().toISOString(), look, data: st },
      null,
      1
    );
    const name = `mon-plan-sante-${today}.json`;
    const done = () => {
      st.lastExport = today;
      save();
      render();
      showToast('Sauvegarde exportée ✓');
    };
    try {
      const file = new File([txt], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        done();
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    try {
      const url = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      done();
    } catch (e) {
      alert('Export impossible.');
    }
  }

  function buildAiReportMd() {
    const clean = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const p = profile();
    const rw = rollingWeight();
    const waAvg = st.weeklyAvgs || syncWeeklyAvgs();
    const wN = waAvg.n;
    const wN1 = waAvg.n1;
    const wDelta = waAvg.deltaKg != null ? waAvg.deltaKg : wN && wN1 ? Math.round((wN.avg - wN1.avg) * 100) / 100 : null;
    const W = weekly();
    const w2 = avgRange(14, 20);
    const wa = waistInfo();
    const ep = engineProfile(st.phase);
    const N = NE.calculateTargets(ep);
    const effOn = tgt(st.phase, 'on');
    const effOff = tgt(st.phase, 'off');
    const avgChoice = Math.round((effOn + effOff) / 2);
    const onPlan = buildDay(st.phase, 'on');
    const offPlan = buildDay(st.phase, 'off');
    const planAvgKcal = Math.round((onPlan.tot.kcal + offPlan.tot.kcal) / 2);
    const ev = NE.evaluateStagnation(ep, W.r1, W.r0, false, {
      waistDeltaCm: wa.delta,
      sleepUnder7h: p.sleepOk === false,
      effectiveOffKcal: effOff
    });

    const phaseLab = st.phase === 'seche' ? 'Cut' : 'Maintien';
    const sw = startWeight();
    const hasW = hasLoggedWeight();
    const totalLost = sw != null && hasW ? Math.round((sw - rw.weightKg) * 10) / 10 : null;
    const remToGoal = hasW ? Math.round((rw.weightKg - p.targetWeightKg) * 10) / 10 : null;
    const inTransitionZone = st.phase === 'seche' && remToGoal != null && remToGoal <= 1.5;
    const lossTxt = String(Math.round(N.weeklyLossKg * 100) / 100).replace('.', ',');
    const signKg = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(2).replace('.', ',') + ' kg/sem';

    const ad = adaptiveInfo();
    const C = cardioPlan(st.phase);
    const t0 = dayNo(today);
    const trendPts = NE.computeWeightTrend(
      Object.keys(st.weights || {})
        .filter((d) => isFinite(st.weights[d]) && dayNo(d) <= t0 && t0 - dayNo(d) <= 55)
        .sort()
        .map((d) => ({ d, n: dayNo(d), v: st.weights[d] }))
    );
    const latestTrendKg = trendPts.length >= 2 ? trendPts[trendPts.length - 1].trendKg : null;

    const logDates = Array.from(
      new Set([
        ...Object.keys(st.weights || {}),
        ...Object.keys(st.waist || {}),
        ...Object.keys(st.kcalLog || {})
      ])
    )
      .filter((d) => dayNo(d) <= t0 && t0 - dayNo(d) <= 20)
      .sort()
      .reverse();

    const logRows = logDates.length
      ? logDates
          .map((d) => {
            const wt = isFinite(st.weights[d]) ? fmt1(st.weights[d]) : '—';
            const eatenN = st.eatenLog && st.eatenLog[d] != null ? `${st.eatenLog[d]}/3` : '—';
            const kc = st.kcalLog && isFinite(st.kcalLog[d]) ? `${clean(st.kcalLog[d])}` : '—';
            const ws = st.waist && isFinite(st.waist[d]) ? fmt1(st.waist[d]) : '—';
            return `| ${d} | ${wt} | ${eatenN} | ${kc} | ${ws} |`;
          })
          .join('\n')
      : '| — | Aucune pesée enregistrée | — | — | — |';

    const formatDayPlan = (P, label) => {
      const t = P.tot;
      const head = `### ${label} — ${clean(t.kcal)} / ${clean(P.target)} kcal (P ${Math.round(t.p)}/${P.targetProt != null ? P.targetProt : P.N.proteinG} g · G ${Math.round(t.g)}/${P.targetCarbs} g · L ${Math.round(t.l)}/${P.targetFat != null ? P.targetFat : P.N.fatG} g · Fibres ${Math.round(t.fib)}/${P.fiberTargetG} g)`;
      const mealsTxt = P.meals
        .map((m) => {
          const items = m.items
            .filter((i) => i.g > 0)
            .map((i) => `${food(i.f).n} ${i.g} g${i.custom ? ' (perso)' : ''}`)
            .join(', ');
          return `- **${m.name} (${clean(m.kcal)} kcal)** : ${items || '—'}`;
        })
        .join('\n');
      return `${head}\n${mealsTxt}`;
    };

    const activeNames = activeExNames();
    const loadEntries = Object.keys(st.loads || {})
      .filter((k) => activeNames.has(k) && isFinite(num(st.loads[k])))
      .map((k) => {
        const cur = num(st.loads[k]);
        const lt = lastTime(k);
        const diff = lt ? Math.round((cur - lt.kg) * 100) / 100 : null;
        const deltaTxt = diff ? ` (${diff > 0 ? '+' : '−'}${fmtKg(Math.abs(diff))} kg)` : '';
        return `${k} : ${fmtKg(cur)} kg${deltaTxt}`;
      });

    const ti = cycleIdx();
    const cycTxt =
      ti === null
        ? 'Non configuré'
        : `Jour ${ti + 1}/${CYCLE.length} (${CYCLE[ti] ? SESSIONS[CYCLE[ti]].title : 'Repos OFF'})`;

    const ruleProf = NE.RULE_CONFIG.profile;
    const caps = NE.RULE_CONFIG.foodCaps || {};
    const fibRule = NE.RULE_CONFIG.fiber || {};
    const capsTxt = Object.keys(caps)
      .map((id) => {
        const f = food(id);
        return f && f.n ? `${f.n} ≤ ${caps[id]} g` : `${id} ≤ ${caps[id]} g`;
      })
      .join(', ');
    const swapsTxt = (PROTS || []).map((x) => x[1]).join(', ');
    const cycleDays = CYCLE.length || 6;
    const isOfficeOnly = Number(N.activityFactor) < 1.32;
    const activityLab = isOfficeOnly
      ? `Que bureau (sédentaire ×${String(ruleProf.activityOfficeFactor || 1.25).replace('.', ',')} — malade / sans entraînement)`
      : `Bureau + muscu (×${String(NE.DEFAULT_PROFILE.activityFactor).replace('.', ',')} — musculation 1 jour sur 2)`;
    const defCut = DEFAULT_TARGETS.seche;
    const defMaint = DEFAULT_TARGETS.maintien;
    const floorKcal = Math.max(KCAL_MIN, clean(p.kcalFloor || KCAL_MIN));
    const cardioRuleTxt = isOfficeOnly
      ? `- **Cardio (semaine sans salle / Que bureau)** : pas d’aller-retour salle cette semaine (\`CARDIO_ON=0\` ou marche douce). Propose un \`CARDIO_OFF\` adapté (multiples de 5 min) sans forcer le déficit sous ${floorKcal} kcal.`
      : `- **Cardio (Jour ON fixe = ${C.baseOn} min / Jour OFF ajustable)** : en **Jour ON**, l’aller-retour à pied à la salle représente **${C.baseOn} min** (base fixe). En **Jour OFF**, le plan de base est **${CARDIO_TARGETS.seche.off} min** en Cut et **${CARDIO_TARGETS.maintien.off} min** en Maintien. Propose une durée exacte en **Jour OFF (\`CARDIO_OFF\`, multiples de 5 min)** adaptée à ma phase (${phaseLab}), Semaine N vs N−1 et mes calories (garde \`CARDIO_ON=${C.on}\`).`;

    return [
      `# Bilan Mon Plan Santé — ${longDate(today)}`,
      '',
      '## Rôle & Règles strictes du Coach IA',
      'Agis en **expert nutritionniste du sport** et **expert coach en hypertrophie**, basé uniquement sur les **vraies études scientifiques** (méta-analyses, essais contrôlés, consensus ISSN/ACSM) — zéro bro-science, zéro tendances TikTok/internet ni modes alimentaires.',
      `- Mode de vie actif : ${activityLab} (Carb Cycling : Jour ON / Jour OFF).`,
      `- Plan de base (JSON) : Cut **${clean(defCut.on)} ON / ${clean(defCut.off)} OFF** · Maintien **${clean(defMaint.on)} ON / ${clean(defMaint.off)} OFF** (TDEE théorique BMR×facteur : **${clean(N.tdee)} kcal/j**).`,
      `- Plancher calorique strict : ne jamais descendre sous **${floorKcal} kcal/j** (ni en Cut, ni en Maintien).`,
      `- Macros actives : Jour ON **${onPlan.targetProt ?? N.proteinOnG} g P · ${onPlan.targetCarbs} g G · ${onPlan.targetFat ?? N.fatOnG} g L** | Jour OFF **${offPlan.targetProt ?? N.proteinOffG} g P · ${offPlan.targetCarbs} g G · ${offPlan.targetFat ?? N.fatOffG} g L** (base : ${ruleProf.proteinMaxG} g prot max, ${String(ruleProf.fatOnPerKg).replace('.', ',')} / ${String(ruleProf.fatOffPerKg).replace('.', ',')} g/kg poids cible lipides ON/OFF, reste en glucides).`,
      `- Plafonds aliments / jour (JSON, sans riz) : ${capsTxt || '—'}.`,
      `- Fibres & protéines interchangeables (JSON) : ${fibRule.per1000Kcal || 14} g fibres / 1 000 kcal (cible ${fibRule.minG || 25}–${fibRule.maxG || 45} g/j${fibRule.boostVeggiesG ? `, boost légumes ${fibRule.boostVeggiesG} g` : ''})${swapsTxt ? ` · Viandes/poissons midi/soir : ${swapsTxt}` : ''}.`,
      cardioRuleTxt,
      '- **Cas 1 — Tout va bien (`STATUT=ok`)** : rythme conforme, pas assez de recul (< 2 sem.), ou tour de taille en baisse (fausse stagnation / eau) → garde les mêmes calories et un `CARDIO_OFF` adapté à l’objectif, rassure et résume.',
      `- **Cas 2 — Stagnation confirmée (\`STATUT=stagnation\`)** : ≥ 2 semaines sous la perte visée (comparaison Semaine N vs Semaine N−1) AVEC diète ≥ 90 %, sommeil ≥ 7 h et tour de taille stable → si Jour OFF > ${floorKcal} kcal : possibilité de diminuer les glucides (sans jamais passer sous ${floorKcal} kcal en Jour OFF) ou d’augmenter \`CARDIO_OFF\` ; si Jour OFF atteint le plancher ${floorKcal} kcal : ne plus baisser les glucides et augmenter \`CARDIO_OFF\`.`,
      `- **Cas 3 — Zone de transition (\`STATUT=transition\`)** : en Cut à ≤ 1,5 kg du poids objectif final (ou atteint) → prépare la remontée progressive vers le Maintien (ajoute des glucides précis en grammes et réduis \`CARDIO_OFF\` progressivement vers 0${isOfficeOnly ? '' : ` en gardant les ${C.baseOn} min en Jour ON`}).`,
      `- **Cas 4 — Fatigue / perte trop rapide / sommeil < 7 h (\`STATUT=fatigue\`)** : sommeil < 7 h, perte > 1 %/semaine, baisse de charges ou fatigue excessive → remonte un peu les glucides, baisse \`CARDIO_OFF\`, priorise 7–8 h de sommeil, propose un deload ${cycleDays} j ou une pause Maintien.`,
      '',
      '---',
      '',
      '## 1. Profil, Poids & Progression',
      `- **Date** : ${today} · **Cycle** : ${cycTxt}`,
      `- **Phase active** : ${phaseLab}${st.phase === 'seche' ? ` (cible −${lossTxt} kg/sem)` : ''}`,
      `- **Poids de départ** : ${sw != null ? `${fmt1(sw)} kg` : 'Non renseigné'}`,
      hasW
        ? `- **Poids actuel (moyenne 7 j)** : ${fmt1(rw.weightKg)} kg (${totalLost != null ? (totalLost > 0 ? `−${fmt1(totalLost)} kg depuis le départ` : totalLost < 0 ? `+${fmt1(-totalLost)} kg depuis le départ` : 'stable depuis le départ') : 'suivi démarré'})`
        : '- **Poids actuel** : Aucune pesée enregistrée',
      latestTrendKg != null ? `- **Tendance lissée (EWMA)** : ${fmt1(latestTrendKg)} kg` : null,
      `- **Poids objectif final** : ${fmt1(p.targetWeightKg)} kg (${remToGoal != null ? (remToGoal > 0 ? `reste ${fmt1(remToGoal)} kg` : 'objectif atteint !') : 'en attente de pesée'})`,
      inTransitionZone ? '- **Alerte transition** : ≤ 1,5 kg du poids final — évaluer la transition vers le Maintien.' : null,
      `- **Taille / Âge / Activité** : ${p.heightCm} cm · ${p.age} ans · ${activityLab}`,
      '',
      '## 2. Calories & Cardio (Jour ON / Jour OFF)',
      `- **Cibles actives choisies** : **${clean(effOn)} kcal ON** · **${clean(effOff)} kcal OFF** (**moy. ${clean(avgChoice)} kcal/j**)`,
      Math.abs(planAvgKcal - avgChoice) >= 20
        ? `- **Total réel dans mes assiettes (avec mes grammes perso)** : ${clean(onPlan.tot.kcal)} ON · ${clean(offPlan.tot.kcal)} OFF (moy. ${clean(planAvgKcal)} kcal/j)`
        : null,
      ad.avgIntakeKcal != null
        ? `- **Moyenne réellement validée (3/3 repas cochés)** : **${clean(ad.avgIntakeKcal)} kcal/j** sur ${ad.loggedDays} jour${ad.loggedDays > 1 ? 's' : ''} complet${ad.loggedDays > 1 ? 's' : ''}`
        : '- **Moyenne validée (3/3 repas)** : pas encore de journée complète cochée',
      `- **Repère TDEE théorique (BMR×facteur)** : **${clean(N.tdee)} kcal/j** (repère équation Cut/Maintien : ${clean(N.kcalOn)} ON · ${clean(N.kcalOff)} OFF)`,
      ad.ready
        ? `- **Maintien réel mesuré (adaptatif)** : **~${clean(ad.adaptiveTdee)} kcal/j** (confiance : ${ad.confidence})`
        : null,
      st.phase === 'seche'
        ? `- **Perte visée & déficit réel sur ce que je mange** : **−${lossTxt} kg/sem** (besoin −${clean(N.requiredDailyDeficit)} kcal/j) · déficit repas à ${clean(N.effectiveIntakeKcal)} kcal/j : **−${clean(N.foodDeficit)} kcal/j** · cardio manquant estimé : **${clean(N.missingCardioKcal)} kcal/j** (~${fmt1(C.kcalPerMin)} kcal/min en Zone 2)`
        : null,
      `- **Durées cardio réglées actuellement** : **${C.on} min Jour ON** (aller-retour salle) · **${C.off} min Jour OFF** (marche / Zone 2) — source : ${C.source === 'ai' ? 'Coach IA' : C.source === 'custom' ? 'Perso' : 'Plan par défaut'}`,
      `- **Plan cardio de référence** : **${C.baseOn} min Jour ON** · **${C.baseOff} min Jour OFF** (moy. ${Math.round((C.baseOn + C.baseOff) / 2)} min/j)`,
      `- **Estimation équation cardio pour tenir −${lossTxt} kg/sem** : **${C.autoOn} min Jour ON** · **${C.autoOff} min Jour OFF**`,
      `- **Garde-fous** : Diète ≥ 90 % : ${p.dietAdhered === false ? 'Non' : 'Oui'} · Sommeil ≥ 7 h : ${p.sleepOk === false ? 'Non' : 'Oui'}`,
      '',
      '## 3. Moyennes hebdo, Tour de taille & Historique 21 jours',
      `- **Semaine N (J0 à J−6, stockée)** : ${wN ? `${fmt1(wN.avg)} kg (${wN.n} pesée${wN.n > 1 ? 's' : ''})` : 'Aucune pesée'}`,
      `- **Semaine N−1 (J−7 à J−13, stockée)** : ${wN1 ? `${fmt1(wN1.avg)} kg (${wN1.n} pesée${wN1.n > 1 ? 's' : ''})` : 'Non renseignée'}`,
      `- **Écart Semaine N vs N−1** : ${wDelta != null ? signKg(wDelta) : 'Insuffisant'}`,
      `- **Semaine −2 (J−14 à J−20)** : ${w2 ? `${fmt1(w2.avg)} kg (${w2.n} pesée${w2.n > 1 ? 's' : ''})` : 'Non renseignée'}`,
      `- **Évolution hebdo** : ${W.r1 != null ? signKg(W.r1) + (W.est ? ' (estimée sur 7 j)' : '') : 'Insuffisant'}${W.r0 != null ? ` · Semaine précédente : ${signKg(W.r0)}` : ''}`,
      `- **Tour de taille** : ${wa.latest != null ? `${fmt1(wa.latest)} cm` + (wa.delta != null ? ` (${wa.delta > 0 ? '+' : wa.delta < 0 ? '−' : '±'}${fmt1(Math.abs(wa.delta))} cm depuis le ${shortDate(wa.prevD)})` : '') : 'Non mesuré'}`,
      `- **Diagnostic auto de l’app** : **${ev.title}** — ${ev.message}`,
      '',
      '| Date | Poids (kg) | Repas | Kcal validées | Tour de taille (cm) |',
      '|---|---:|---:|---:|---:|',
      logRows,
      '',
      '## 4. Mes repas actuels',
      formatDayPlan(onPlan, 'Jour ON'),
      '',
      formatDayPlan(offPlan, 'Jour OFF'),
      '',
      '## 5. Entraînement & Charges',
      CYCLE.length ? `- **Split actif (JSON, ${CYCLE.length} j)** : ${CYCLE.map((k) => (k ? SESSIONS[k].short : 'Off')).join(' / ')}` : null,
      `- **Forme du jour** : ${
        (st.fatigueLog && st.fatigueLog[today]) === 'tired'
          ? 'Fatigué'
          : (st.fatigueLog && st.fatigueLog[today]) === 'good'
          ? 'En forme'
          : 'Normal'
      }`,
      `- **Deload actif** : ${deloadOn() ? `Oui (jusqu’au ${shortDate(fromNo(dayNo(st.deloadUntil) - 1))})` : 'Non'}`,
      SPLIT_RULES.progression ? `- **Règle progression (JSON)** : ${SPLIT_RULES.progression}` : null,
      SPLIT_RULES.deload ? `- **Règle deload (JSON)** : ${SPLIT_RULES.deload}` : null,
      `- **Charges enregistrées** : ${loadEntries.length ? loadEntries.join(' · ') : 'Charges par défaut'}`
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  // Coach IA direct (Google Gemini — clé et modèle stockés uniquement dans localStorage hors sauvegardes)
  const GEMINI_KEY_STORE = 'mon-plan-sante-gemini-key';
  const GEMINI_MODEL_STORE = 'mon-plan-sante-gemini-model';
  const GEMINI_MODELS = [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', short: '3.8 Flash' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', short: '3.6 Flash' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', short: '3.5 Lite' }
  ];
  const GEMINI_DEFAULT_MODEL = GEMINI_MODELS[0].id;
  const GEMINI_SYSTEM_PROMPT = [
    'Tu es un expert nutritionniste du sport et un expert coach en hypertrophie musculaire, strictement fondé sur les preuves scientifiques (evidence-based).',
    'Base exclusivement ton analyse et tes recommandations sur les méta-analyses, essais contrôlés randomisés et consensus scientifiques reconnus (ISSN, ACSM, recherche récente en hypertrophie : bilan énergétique, tendance de poids lissée, maintien de la masse maigre en déficit, tension mécanique proche de l’échec 0–2 RIR, volume hebdomadaire récupérable, amplitude complète et étirement musculaire, gestion de la fatigue systémique, sommeil ≥ 7 h, et cardio Zone 2 ON/OFF sans interférence).',
    'Rejette catégoriquement la bro-science, les modes internet et les tendances TikTok/réseaux sociaux sans preuve (ex. « mode famine », fenêtre anabolique stricte, diabolisation des glucides le soir ou de l’insuline, détox, perte de gras localisée, « confusion musculaire », volume poubelle, compléments gadgets). Si l’utilisateur pose une question sur un mythe ou une tendance virale, rétablis les faits simplement.',
    'Style : français clair, direct, concret et bienveillant, sans jargon académique inutile ni blabla. Donne des décisions chiffrées et applicables immédiatement sur ses vrais aliments, ses minutes exactes de cardio Jour ON / Jour OFF et ses charges, en respectant scrupuleusement le template Markdown demandé et la ligne [[PLAN:...]].'
  ].join('\n');
  let aiBusy = false;
  let aiStatusMsg = '';
  let aiKeyBusy = false;
  let aiKeyMsg = '';
  let aiKeyTone = '';

  function getGeminiKey() {
    try {
      return (localStorage.getItem(GEMINI_KEY_STORE) || '').trim();
    } catch (e) {
      return '';
    }
  }

  function setGeminiKey(v) {
    try {
      const k = String(v || '').trim();
      if (k) localStorage.setItem(GEMINI_KEY_STORE, k);
      else localStorage.removeItem(GEMINI_KEY_STORE);
    } catch (e) {}
  }

  function getGeminiModel() {
    try {
      const saved = (localStorage.getItem(GEMINI_MODEL_STORE) || '').trim();
      if (GEMINI_MODELS.some((m) => m.id === saved)) return saved;
    } catch (e) {}
    return GEMINI_DEFAULT_MODEL;
  }

  function setGeminiModel(id) {
    const valid = GEMINI_MODELS.some((m) => m.id === id) ? id : GEMINI_DEFAULT_MODEL;
    try {
      localStorage.setItem(GEMINI_MODEL_STORE, valid);
    } catch (e) {}
    return valid;
  }

  function geminiModelInfo(id) {
    const found = GEMINI_MODELS.find((m) => m.id === id);
    if (found) return found;
    const label = id
      ? String(id)
          .replace(/^gemini-/i, 'Gemini ')
          .replace(/-/g, ' ')
          .replace(/\b[a-z]/g, (c) => c.toUpperCase())
      : GEMINI_MODELS[0].label;
    return { id: id || GEMINI_DEFAULT_MODEL, label, short: label.replace(/^Gemini\s+/i, '') };
  }

  function geminiFallbackOrder() {
    const current = getGeminiModel();
    return [current, ...GEMINI_MODELS.map((m) => m.id).filter((id) => id !== current)];
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatAiHtml(text) {
    const cleaned = String(text || '')
      .trim()
      .replace(/^```(?:md|markdown)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    const lines = cleaned.replace(/\r/g, '').split('\n');
    const out = [];
    let inList = false;
    const inline = (s) => escHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    lines.forEach((raw) => {
      const l = raw.trim();
      if (!l || /^---+$/.test(l)) {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        return;
      }
      if (/^[-•*]\s+/.test(l) || /^\d+\.\s+/.test(l)) {
        if (!inList) {
          out.push('<ul>');
          inList = true;
        }
        out.push(`<li>${inline(l.replace(/^(?:[-•*]|\d+\.)\s+/, ''))}</li>`);
      } else {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        if (/^#{1,4}\s+/.test(l)) {
          out.push(`<h4>${inline(l.replace(/^#{1,4}\s+/, ''))}</h4>`);
        } else {
          out.push(`<p>${inline(l)}</p>`);
        }
      }
    });
    if (inList) out.push('</ul>');
    return out.join('');
  }

  function parseAiReply(rawText) {
    const raw = String(rawText || '')
      .trim()
      .replace(/^```(?:md|markdown)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    let statut = null;
    let on = null;
    let off = null;
    let phase = null;
    let cardioOn = null;
    let cardioOff = null;
    const m = raw.match(/\[\[(?:PLAN|CIBLES):([^\]]+)\]\]/i);
    if (m) {
      const body = m[1];
      const stM = body.match(/STATUT\s*=\s*(ok|stagnation|transition|fatigue)/i);
      const phM = body.match(/PHASE\s*=\s*(seche|maintien)/i);
      const onM = body.match(/(?:^|[;\s])ON\s*=\s*(\d{4})/i);
      const offM = body.match(/(?:^|[;\s])OFF\s*=\s*(\d{4})/i);
      const cOnM = body.match(/CARDIO_ON\s*=\s*(\d+)/i);
      const cOffM = body.match(/CARDIO_OFF\s*=\s*(\d+)/i);
      if (stM) statut = stM[1].toLowerCase();
      if (phM) phase = phM[1].toLowerCase();
      const targetPhase = phase || st.phase;
      const floor = targetPhase === 'seche' ? Math.max(KCAL_MIN, profile().kcalFloor || KCAL_MIN) : KCAL_MIN;
      const onV = onM ? Number(onM[1]) : NaN;
      const offV = offM ? Number(offM[1]) : NaN;
      if (isFinite(onV) && isFinite(offV) && onV >= floor && onV <= KCAL_MAX && offV >= floor && offV <= KCAL_MAX) {
        on = Math.round(onV);
        off = Math.round(offV);
      }
      if (cOnM) {
        const v = Number(cOnM[1]);
        if (isFinite(v)) cardioOn = Math.max(0, Math.min(90, Math.round(v / 5) * 5));
      }
      if (cOffM) {
        const v = Number(cOffM[1]);
        if (isFinite(v)) cardioOff = Math.max(0, Math.min(90, Math.round(v / 5) * 5));
      }
    }
    const text = raw.replace(/\[\[(?:PLAN|CIBLES):[^\]]+\]\]/gi, '').trim();
    return { text, statut, on, off, phase, cardioOn, cardioOff };
  }

  function renderAiCoach() {
    const key = getGeminiKey();
    const hasKey = key.length >= 10;
    const activeModel = geminiModelInfo(getGeminiModel());

    if ($('aiModelChip')) {
      $('aiModelChip').textContent = activeModel.label;
    }
    if ($('aiKeyTitle')) {
      $('aiKeyTitle').textContent = hasKey
        ? `Coach IA (${activeModel.short} · connecté ✓)`
        : 'Coach IA (Gemini · ajouter ma clé)';
    }
    document
      .querySelectorAll('[data-aimodel]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.aimodel === activeModel.id)));
    if ($('geminiKeyInput') && document.activeElement !== $('geminiKeyInput')) {
      $('geminiKeyInput').value = key;
    }
    if ($('clearGeminiKey')) $('clearGeminiKey').hidden = !hasKey;
    if ($('saveGeminiKeyBtn')) {
      $('saveGeminiKeyBtn').disabled = aiKeyBusy;
      $('saveGeminiKeyBtn').textContent = aiKeyBusy ? 'Test en cours…' : 'Enregistrer & tester';
    }
    if ($('goAiCoachBtn')) {
      $('goAiCoachBtn').hidden = !hasKey;
      $('goAiCoachBtn').disabled = aiBusy;
      $('goAiCoachBtn').textContent = aiBusy ? 'Génération en cours…' : 'Générer mon bilan IA';
    }
    if ($('aiKeyStatus')) {
      const msg = aiKeyMsg || (hasKey ? 'Clé enregistrée sur ton téléphone ✓ — prête pour ton bilan.' : '');
      const tone = aiKeyMsg ? aiKeyTone : hasKey ? 'ok' : '';
      $('aiKeyStatus').hidden = !msg;
      $('aiKeyStatus').textContent = msg;
      $('aiKeyStatus').classList.toggle('is-ok', tone === 'ok');
      $('aiKeyStatus').classList.toggle('is-err', tone === 'err');
    }

    const btn = $('askAiBtn');
    if (btn) {
      btn.disabled = aiBusy;
      btn.textContent = aiBusy ? 'Génération…' : hasKey ? 'Générer mon bilan' : 'Configurer Gemini';
    }

    if ($('aiStatus')) {
      $('aiStatus').hidden = !aiStatusMsg;
      $('aiStatus').textContent = aiStatusMsg;
    }

    const rep = st.lastAi;
    const box = $('aiReply');
    if (!box) return;
    if (!rep || !rep.text) {
      box.hidden = true;
      return;
    }

    box.hidden = false;
    const modelLab = geminiModelInfo(rep.model || activeModel.id).label;
    $('aiReplyMeta').textContent = `${modelLab} · ${shortDate(rep.date || today)}`;
    $('aiReplyBody').innerHTML = formatAiHtml(rep.text);

    const pill = $('aiStatusPill');
    if (pill) {
      const META = {
        ok: ['Tout va bien ✓', 'is-ok'],
        stagnation: ['Ajustement conseillé', 'is-warn'],
        transition: ['Zone de transition', 'is-warn'],
        fatigue: ['Attention fatigue', 'is-warn']
      };
      const m = rep.statut && META[rep.statut];
      pill.hidden = !m;
      pill.classList.remove('is-ok', 'is-warn');
      if (m) {
        pill.textContent = m[0];
        pill.classList.add(m[1]);
      }
    }

    const prescEl = $('aiPresc');
    const targetPhase = rep.phase === 'seche' || rep.phase === 'maintien' ? rep.phase : st.phase;
    const C = cardioPlan(targetPhase);
    const hasCardioSpec = rep.cardioOn != null || rep.cardioOff != null;
    const nextCOn = rep.cardioOn != null ? rep.cardioOn : C.on;
    const nextCOff = rep.cardioOff != null ? rep.cardioOff : C.off;

    if (prescEl) {
      const hasKcal = !!(rep.on && rep.off);
      if (hasKcal || hasCardioSpec) {
        const onKcal = hasKcal ? rep.on : tgt(targetPhase, 'on');
        const offKcal = hasKcal ? rep.off : tgt(targetPhase, 'off');
        prescEl.hidden = false;
        prescEl.innerHTML =
          `<div class="ai-presc-tile is-on">` +
          `<span class="ks-day"><span class="dot" style="background:var(--on)"></span>Jour ON</span>` +
          `<strong class="ks-val">${fmt(onKcal)}<span> kcal</span></strong>` +
          (hasCardioSpec ? `<span class="ai-presc-sub">Cardio · ${nextCOn} min</span>` : '') +
          `</div>` +
          `<div class="ai-presc-tile is-off">` +
          `<span class="ks-day"><span class="dot" style="background:var(--off)"></span>Jour OFF</span>` +
          `<strong class="ks-val">${fmt(offKcal)}<span> kcal</span></strong>` +
          (hasCardioSpec ? `<span class="ai-presc-sub">Cardio · ${nextCOff} min</span>` : '') +
          `</div>`;
      } else {
        prescEl.hidden = true;
      }
    }

    const applyBtn = $('applyAiTargets');
    if (applyBtn) {
      const phaseChanged = targetPhase !== st.phase;
      const kcalChanged = !!(rep.on && rep.off && (tgt(targetPhase, 'on') !== rep.on || tgt(targetPhase, 'off') !== rep.off));
      const cardioChanged = hasCardioSpec && (nextCOn !== C.on || nextCOff !== C.off || C.source !== 'ai');
      const hasChanges = phaseChanged || kcalChanged || cardioChanged;

      if (rep.applied) {
        applyBtn.hidden = false;
        applyBtn.disabled = true;
        applyBtn.textContent = 'Plan & Cardio appliqués ✓';
      } else if (hasChanges) {
        const phTag = phaseChanged ? ` (${targetPhase === 'seche' ? 'Cut' : 'Maintien'})` : '';
        applyBtn.hidden = false;
        applyBtn.disabled = false;
        applyBtn.textContent =
          kcalChanged && cardioChanged
            ? `Appliquer kcal & cardio${phTag}`
            : cardioChanged
            ? `Appliquer le cardio${phTag} (${nextCOn} / ${nextCOff} min)`
            : kcalChanged
            ? `Appliquer les calories${phTag}`
            : `Passer en ${targetPhase === 'seche' ? 'Cut' : 'Maintien'}`;
      } else {
        applyBtn.hidden = true;
      }
    }
    const histFold = $('aiHistFold');
    const histList = $('aiHistList');
    if (histFold && histList) {
      const hist = Array.isArray(st.aiHistory) ? st.aiHistory : [];
      histFold.hidden = hist.length === 0;
      if (hist.length > 0) {
        $('aiHistTitle').textContent = `Historique des bilans (${hist.length})`;
        histList.innerHTML = hist
          .map(
            (h) => `<div class="ai-hist-item">
            <div class="ai-hist-head"><b>${shortDate(h.date || today)}</b><span>${escHtml(geminiModelInfo(h.model).short)}</span></div>
            <div class="ai-hist-body">${formatAiHtml(h.text)}</div>
          </div>`
          )
          .join('');
      }
    }
  }

  async function testGeminiKey() {
    if (aiKeyBusy) return;
    const raw = $('geminiKeyInput') ? $('geminiKeyInput').value.trim() : getGeminiKey();
    setGeminiKey(raw);
    if (raw.length < 10) {
      aiKeyMsg = 'Colle ta clé complète Google AI Studio (commence par AIza…).';
      aiKeyTone = 'err';
      renderAiCoach();
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      aiKeyMsg = 'Clé enregistrée ✓ (connexion internet requise pour tester).';
      aiKeyTone = 'ok';
      renderAiCoach();
      return;
    }

    aiKeyBusy = true;
    aiKeyMsg = 'Vérification de ta clé auprès de Google…';
    aiKeyTone = '';
    renderAiCoach();

    const candidates = geminiFallbackOrder();
    let handled = false;
    try {
      for (let i = 0; i < candidates.length; i++) {
        const modelId = candidates[i];
        const info = geminiModelInfo(modelId);
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timerId = ctrl ? setTimeout(() => ctrl.abort(), 15000) : null;
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}`,
            {
              headers: { 'x-goog-api-key': raw },
              signal: ctrl ? ctrl.signal : undefined
            }
          );
          if (res.ok) {
            setGeminiModel(modelId);
            aiKeyMsg = `Clé valide et connectée à ${info.label} ✓ — clique sur « Générer mon bilan IA ».`;
            aiKeyTone = 'ok';
            handled = true;
            break;
          } else if (res.status === 400 || res.status === 401 || res.status === 403) {
            let detail = '';
            try {
              const d = await res.json();
              detail = (d && d.error && d.error.message) || '';
            } catch (e) {}
            aiKeyMsg = /location|region|country/i.test(detail)
              ? 'L’API Gemini n’est pas disponible dans ta zone géographique.'
              : 'Clé refusée par Google — vérifie que tu as copié la clé entière (sans espace).';
            aiKeyTone = 'err';
            handled = true;
            break;
          } else if (res.status === 404) {
            continue;
          } else {
            aiKeyMsg = `Clé enregistrée, mais Google répond HTTP ${res.status}. Réessaie dans 1 minute.`;
            aiKeyTone = 'err';
            handled = true;
            break;
          }
        } finally {
          if (timerId) clearTimeout(timerId);
        }
      }
      if (!handled) {
        aiKeyMsg = 'Clé reconnue, mais aucun modèle Gemini compatible n’est disponible sur ce compte.';
        aiKeyTone = 'err';
      }
    } catch (err) {
      aiKeyMsg =
        err && err.name === 'AbortError'
          ? 'Délai dépassé lors du test, réessaie dans quelques secondes.'
          : 'Clé enregistrée, mais impossible de joindre Google (vérifie ta connexion).';
      aiKeyTone = 'err';
    } finally {
      aiKeyBusy = false;
      renderAiCoach();
    }
  }

  async function callGeminiModel(model, promptText, apiKey) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timerId = ctrl ? setTimeout(() => ctrl.abort(), 60000) : null;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: promptText }] }]
          }),
          signal: ctrl ? ctrl.signal : undefined
        }
      );
      let data = null;
      try {
        data = await res.json();
      } catch (e) {}
      if (!res.ok) {
        const err = new Error((data && data.error && data.error.message) || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const parts = (((data && data.candidates) || [])[0] || {}).content?.parts || [];
      const text = parts
        .filter((pt) => pt && typeof pt.text === 'string' && !pt.thought)
        .map((pt) => pt.text)
        .join('\n')
        .trim();
      if (!text) {
        const err = new Error('Réponse vide');
        err.status = 502;
        throw err;
      }
      return { text, model };
    } finally {
      if (timerId) clearTimeout(timerId);
    }
  }

  async function askGeminiCoach() {
    if (aiBusy) return;
    let apiKey = getGeminiKey();
    if (apiKey.length < 10 && $('geminiKeyInput') && $('geminiKeyInput').value.trim().length >= 10) {
      apiKey = $('geminiKeyInput').value.trim();
      setGeminiKey(apiKey);
    }
    if (apiKey.length < 10) {
      st.tab = 'ia';
      if ($('aiKeyFold')) $('aiKeyFold').open = true;
      aiStatusMsg = 'Ajoute d’abord ta clé Gemini gratuite ci-dessous.';
      save();
      render();
      if ($('geminiKeyInput') && $('geminiKeyInput').focus) $('geminiKeyInput').focus();
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      aiStatusMsg = 'Pas de connexion internet pour contacter Gemini.';
      renderAiCoach();
      return;
    }

    const candidates = geminiFallbackOrder();
    aiBusy = true;
    let lastErr = null;
    let lastModelInfo = geminiModelInfo(candidates[0]);
    let result = null;

    try {
      aiStatusMsg = 'Synchronisation des règles JSON…';
      renderAiCoach();
      await loadJsonConfigs();

      const q = $('aiQuestion') ? $('aiQuestion').value.trim() : '';
      const floor = Math.max(KCAL_MIN, profile().kcalFloor || KCAL_MIN);
      const C = cardioPlan(st.phase);
      const isOfficeOnly = Number(C.N.activityFactor) < 1.32;
      const cardioOnDesc = isOfficeOnly ? '0 min (sans salle)' : `${C.on} min aller-retour salle`;
      const sampleCarb = (food('pasta') && food('pasta').n) || 'féculents';
      const sampleCarbTxt = sampleCarb.charAt(0).toLowerCase() + sampleCarb.slice(1);
      const cycleDays = CYCLE.length || 6;
      const promptText = [
        buildAiReportMd(),
        q ? `\n## Question particulière de l'utilisateur\n${q}` : '',
        '\n## Template Markdown de retour OBLIGATOIRE',
        'Réponds en français, sans texte d’introduction ni bloc de code ```, en remplissant EXACTEMENT ce template Markdown (concis, concret, zéro jargon technique) :',
        '',
        '### Résumé',
        '1 à 2 phrases directes : verdict clair (tout va bien / stagnation confirmée / fausse stagnation / zone de transition / fatigue) basé sur mon poids, Semaine N vs N−1, ma phase (Cut ou Maintien), mes calories et mon tour de taille.',
        '',
        '### Stagnation (Semaine N vs N−1)',
        '- **Constat** : compare les moyennes stockées Semaine N vs Semaine N−1 (et leur écart), le tour de taille, l’adhérence diète (≥ 90 %) et le sommeil (≥ 7 h) pour confirmer ou écarter une stagnation.',
        `- **Levier appliqué** : si Jour OFF > ${floor} kcal → possibilité de diminuer les glucides (sans jamais passer sous ${floor} kcal en Jour OFF) ou d’ajuster le cardio Jour OFF ; si Jour OFF atteint le plancher ${floor} kcal → ne plus baisser les glucides et ajuster \`CARDIO_OFF\`.`,
        '',
        '### Calories (ON / OFF)',
        '- **Décision** : [Garder / Ajuster] à **XXXX kcal ON** / **YYYY kcal OFF** (moy. **ZZZZ kcal/j**)',
        `- **Dans l’assiette** : [Aucun changement OU ajustement concret en grammes d’aliments de mes repas en respectant les plafonds, ex. −30 g de ${sampleCarbTxt} le midi]`,
        '',
        `### Cardio (Jour ON · Jour OFF proposé)`,
        `- **Décision** : **${isOfficeOnly ? 0 : C.on} min Jour ON** (${isOfficeOnly ? 'semaine sans salle' : 'aller-retour salle'}) · **YY min Jour OFF** (marche / Zone 2, à régler dans Réglages → Cardio)`,
        '- **Pourquoi** : explication courte liée à ma phase, à mon objectif de perte/semaine, à mes calories et à ma récupération musculaire.',
        '',
        '### Entraînement & Récup',
        `- 1 conseil bref et concret (continuer la progression, viser 7–8 h de sommeil ou activer le deload ${cycleDays} j).`,
        '',
        `Règle impérative : ne descends JAMAIS sous ${floor} kcal en Jour OFF.`,
        'Termine IMPÉRATIVEMENT par cette dernière ligne exacte (remplace les valeurs sans texte après) :',
        `[[PLAN:STATUT=ok;PHASE=${st.phase};ON=${tgt(st.phase, 'on')};OFF=${tgt(st.phase, 'off')};CARDIO_ON=${isOfficeOnly ? 0 : C.on};CARDIO_OFF=${C.off}]]`,
        `(STATUT = ok | stagnation | transition | fatigue ; PHASE = seche | maintien ; ON et OFF = entiers kcal ; CARDIO_ON = ${isOfficeOnly ? 0 : C.on} (${cardioOnDesc}) ; CARDIO_OFF = durée proposée pour Jour OFF en minutes entières par tranches de 5 min, de 0 à 90).`
      ].join('\n');

      for (let i = 0; i < candidates.length; i++) {
        const modelId = candidates[i];
        const info = geminiModelInfo(modelId);
        lastModelInfo = info;
        aiStatusMsg =
          i === 0
            ? `Analyse avec ${info.label} en cours…`
            : `${geminiModelInfo(candidates[i - 1]).short} indisponible, bascule sur ${info.label}…`;
        renderAiCoach();
        try {
          result = await callGeminiModel(modelId, promptText, apiKey);
          break;
        } catch (err) {
          lastErr = err;
          const detail = err && err.message ? String(err.message) : '';
          const isAuthOrRegion =
            err &&
            (err.status === 401 ||
              err.status === 403 ||
              (err.status === 400 && (/api[_ ]?key/i.test(detail) || /location|region|country/i.test(detail))));
          if (isAuthOrRegion) throw err;
        }
      }

      if (!result) throw lastErr || new Error('Aucun modèle disponible');

      const parsed = parseAiReply(result.text);
      if (st.lastAi && st.lastAi.text) {
        st.aiHistory = Array.isArray(st.aiHistory) ? st.aiHistory : [];
        st.aiHistory.unshift({
          date: st.lastAi.date || today,
          model: st.lastAi.model,
          statut: st.lastAi.statut,
          text: st.lastAi.text
        });
        if (st.aiHistory.length > 3) st.aiHistory.length = 3;
      }
      st.lastAi = {
        date: today,
        model: result.model,
        text: parsed.text,
        statut: parsed.statut,
        on: parsed.on,
        off: parsed.off,
        phase: parsed.phase,
        cardioOn: parsed.cardioOn,
        cardioOff: parsed.cardioOff,
        applied: false
      };
      if ($('aiQuestion')) $('aiQuestion').value = '';
      aiStatusMsg = '';
      save();
    } catch (err) {
      const detail = err && err.message ? String(err.message) : '';
      const lab = lastModelInfo.label;
      if (err && err.name === 'AbortError') {
        aiStatusMsg = `Délai dépassé sur ${lab}, réessaie dans quelques secondes.`;
      } else if (err && (err.status === 401 || err.status === 403 || (err.status === 400 && /api[_ ]?key/i.test(detail)))) {
        aiStatusMsg = 'Clé API invalide ou accès refusé. Vérifie ta clé dans Réglages → Coach IA.';
      } else if (err && err.status === 400 && /location|region|country/i.test(detail)) {
        aiStatusMsg = 'L’API Gemini n’est pas disponible dans ta zone géographique.';
      } else if (err && err.status === 404) {
        aiStatusMsg = 'Aucun des modèles Gemini configurés n’est disponible sur ce compte.';
      } else if (err && err.status === 429) {
        aiStatusMsg = `Quota gratuit atteint sur les modèles Gemini, réessaie dans 1 minute.`;
      } else if (err && err.status === 503) {
        aiStatusMsg = `${lab} est temporairement surchargé, réessaie dans quelques secondes.`;
      } else {
        aiStatusMsg = `Impossible de joindre ${lab} pour le moment${err && err.status ? ` (HTTP ${err.status})` : ''} — vérifie ta connexion ou ta clé.`;
      }
    } finally {
      aiBusy = false;
      renderAiCoach();
    }
  }

  // Minuteur de repos (AudioContext + WakeLock)
  let timer = null, tick = null, actx = null, wake = null;

  function ensureAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!actx && AC) actx = new AC();
      if (actx && actx.state === 'suspended') actx.resume();
    } catch (e) {}
  }

  function beep() {
    try {
      if (actx) {
        const t = actx.currentTime;
        [0, 0.28].forEach((off) => {
          const o = actx.createOscillator();
          const g = actx.createGain();
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.0001, t + off);
          g.gain.exponentialRampToValueAtTime(0.3, t + off + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.2);
          o.connect(g);
          g.connect(actx.destination);
          o.start(t + off);
          o.stop(t + off + 0.22);
        });
      }
    } catch (e) {}
    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch (e) {}
  }

  async function keepAwake(on) {
    try {
      if (on && !wake && navigator.wakeLock) {
        wake = await navigator.wakeLock.request('screen');
        wake.addEventListener('release', () => {
          wake = null;
        });
      } else if (!on && wake) {
        await wake.release();
        wake = null;
      }
    } catch (e) {
      wake = null;
    }
  }

  function startRest(sec, name) {
    ensureAudio();
    timer = { end: Date.now() + sec * 1000, total: sec, name, doneAt: 0 };
    keepAwake(true);
    clearInterval(tick);
    tick = setInterval(updateTimer, 250);
    updateTimer();
  }

  function stopTimer() {
    timer = null;
    clearInterval(tick);
    keepAwake(false);
    updateTimer();
  }

  function updateTimer() {
    if (!timer) {
      $('timer').hidden = true;
      $('app').classList.remove('has-timer');
      return;
    }
    $('timer').hidden = false;
    $('app').classList.add('has-timer');
    const ms = Math.max(0, timer.end - Date.now());
    const left = Math.ceil(ms / 1000);
    $('timerTime').textContent = Math.floor(left / 60) + ':' + pad(left % 60);
    $('timerBar').style.width = (ms / (timer.total * 1000)) * 100 + '%';
    if (left === 0) {
      if (!timer.doneAt) {
        timer.doneAt = Date.now();
        beep();
        $('timerLabel').textContent = 'Repos terminé · série suivante';
        $('timerSkip').textContent = 'OK';
      } else if (Date.now() - timer.doneAt > 6000) {
        stopTimer();
      }
    } else {
      $('timerLabel').textContent = 'Repos · ' + timer.name;
      $('timerSkip').textContent = 'Passer';
    }
  }

  // Toast iOS discret
  let toastT = null;
  function showToast(msg) {
    const el = $('toast');
    if (!el || !msg) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.remove('is-show');
    void el.offsetWidth;
    el.classList.add('is-show');
    if (toastT) clearTimeout(toastT);
    toastT = setTimeout(() => {
      el.classList.remove('is-show');
      setTimeout(() => {
        if (!el.classList.contains('is-show')) el.hidden = true;
      }, 240);
    }, 2000);
  }

  // Apparence
  const LOOK = 'mon-plan-sante-apparence';
  let look = 'auto';
  function setLook(v) {
    if (v === 'light' || v === 'dark') document.documentElement.setAttribute('data-theme', v);
    else {
      v = 'auto';
      document.documentElement.removeAttribute('data-theme');
    }
    look = v;
    try {
      localStorage.setItem(LOOK, v);
    } catch (e) {}
    document
      .querySelectorAll('[data-look]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.look === v)));
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) =>
        m.setAttribute(
          'content',
          v === 'auto'
            ? /dark/.test(m.media)
              ? '#000000'
              : '#F2F2F7'
            : v === 'dark'
            ? '#000000'
            : '#F2F2F7'
        )
      );
  }
  try {
    look = localStorage.getItem(LOOK) || 'auto';
  } catch (e) {}
  setLook(look);

  // ==========================================================================
  // 10. ÉCOUTEURS D'ÉVÉNEMENTS & DÉMARRAGE
  // ==========================================================================

  function setMenuOpen(open) {
    const m = $('appMenu');
    const b = $('menuBtn');
    if (m) m.hidden = !open;
    if (b) b.setAttribute('aria-expanded', String(!!open));
  }

  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'menuBackdrop') {
      setMenuOpen(false);
      return;
    }
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'menuBtn') {
      const m = $('appMenu');
      setMenuOpen(m ? m.hidden : false);
      return;
    }
    const d = t.dataset;

    if (d.look) {
      setLook(d.look);
      return;
    }
    if (d.pickWday) {
      selectedWeightDay = d.pickWday;
      buildWeek();
      const entry = $('wEntryInput');
      if (entry) {
        entry.focus();
        if (entry.select) entry.select();
      }
      return;
    }
    if (t.id === 'wEntryClear') {
      delete st.weights[selectedWeightDay];
      syncWeeklyAvgs();
      if (selectedWeightDay === today && $('wQuick')) $('wQuick').value = '';
      if ($('wEntryInput')) $('wEntryInput').value = '';
      showToast('Pesée effacée');
    } else if (t.id === 'waistConvertBtn') {
      if (waistSuggestCm != null) {
        const cm = waistSuggestCm;
        st.waist = st.waist || {};
        st.waist[today] = cm;
        waistSuggestCm = null;
        if ($('waistInput')) $('waistInput').value = String(cm).replace('.', ',');
        if ($('waistHelper')) $('waistHelper').hidden = true;
        showToast(`Tour de taille : ${fmt1(cm)} cm ✓`);
      }
    } else if (t.id === 'toggleKeyVis') {
      const inp = $('geminiKeyInput');
      if (inp) {
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        t.setAttribute('aria-pressed', String(show));
        t.textContent = show ? 'Masquer' : 'Voir';
      }
      return;
    } else if (t.id === 'timerAdd') {
      if (timer) {
        timer.end = Math.max(Date.now(), timer.end) + 30000;
        timer.total += 30;
        timer.doneAt = null;
        updateTimer();
      }
      return;
    } else if (t.id === 'phaseToggleBtn') {
      st.phase = st.phase === 'seche' ? 'maintien' : 'seche';
      showToast(st.phase === 'seche' ? 'Mode Cut activé' : 'Mode Maintien activé');
    } else if (d.phase) {
      st.phase = d.phase;
    } else if (d.shop) {
      st.shopDays = Number(d.shop);
    } else if (d.swapOpen) {
      swapOpen = swapOpen === d.swapOpen ? null : d.swapOpen;
      render();
      return;
    } else if (d.swap) {
      const [mid, f] = d.swap.split('|');
      st.swap[mid] = f;
      if (st.qty && st.qty[st.phase]) {
        ['on', 'off'].forEach((dy) => {
          const qd = st.qty[st.phase][dy];
          if (qd) PROTS.forEach(([fid]) => delete qd[`${mid}|${fid}`]);
        });
      }
      swapOpen = null;
      syncTodayKcalLog();
    } else if (d.meal) {
      st.eaten[d.meal] = !st.eaten[d.meal];
      syncTodayKcalLog();
    } else if (d.cart) {
      st.cart[d.cart] = !st.cart[d.cart];
    } else if (t.id === 'resetCart') {
      st.cart = {};
      showToast('Panier réinitialisé');
    } else if (d.cyc) {
      const i = Number(d.cyc);
      const ti = cycleIdx();
      if (ti === null) {
        setTodayAs(i);
        st.viewIdx = i;
      } else peek = i === ti ? null : i;
    } else if (t.id === 'exportBtn') {
      doExport();
      return;
    } else if (t.id === 'exportFoodsBtn') {
      const merged = {};
      Object.keys(FOODS_DEFAULT).forEach((id) => {
        merged[id] = Object.assign({}, FOODS_DEFAULT[id], (st.foods && st.foods[id]) || {});
      });
      const payload = JSON.stringify({ unit: 'pour 100 g', foods: merged }, null, 2) + '\n';
      if (window.showSaveFilePicker) {
        window.showSaveFilePicker({
          suggestedName: 'foods.json',
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        })
          .then((h) => h.createWritable().then((w) => w.write(payload).then(() => w.close())))
          .then(() => showToast('foods.json enregistré ✓'))
          .catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
        a.download = 'foods.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
        showToast('foods.json téléchargé ✓');
      }
      return;
    } else if (t.id === 'importBtn') {
      $('importFile').click();
      return;
    } else if (t.id === 'askAiBtn') {
      askGeminiCoach();
      return;
    } else if (t.id === 'clearAiReply') {
      delete st.lastAi;
      aiStatusMsg = '';
    } else if (t.id === 'applyAiTargets') {
      const rep = st.lastAi;
      if (rep && !rep.applied) {
        if (rep.phase === 'seche' || rep.phase === 'maintien') st.phase = rep.phase;
        st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
        const floor = st.phase === 'seche' ? Math.max(KCAL_MIN, st.profile.kcalFloor || KCAL_MIN) : KCAL_MIN;
        if (rep.on && rep.off && rep.on >= floor && rep.off >= floor && rep.on <= KCAL_MAX && rep.off <= KCAL_MAX) {
          st.targets = st.targets || {};
          st.targets[st.phase] = { on: rep.on, off: rep.off };
        }
        if (rep.cardioOn != null || rep.cardioOff != null) {
          const C = cardioPlan(st.phase);
          st.profile.cardioOnMin = rep.cardioOn != null ? rep.cardioOn : C.on;
          st.profile.cardioOffMin = rep.cardioOff != null ? rep.cardioOff : C.off;
          st.profile.cardioSource = 'ai';
        }
        rep.applied = true;
        syncTodayKcalLog();
        showToast('Plan & Cardio appliqués ✓');
      }
    } else if (d.aimodel) {
      const chosen = setGeminiModel(d.aimodel);
      aiKeyMsg = '';
      renderAiCoach();
      showToast(`Modèle : ${geminiModelInfo(chosen).label}`);
      return;
    } else if (t.id === 'saveGeminiKeyBtn') {
      testGeminiKey();
      return;
    } else if (t.id === 'goAiCoachBtn') {
      if ($('geminiKeyInput') && $('geminiKeyInput').value.trim()) setGeminiKey($('geminiKeyInput').value.trim());
      st.tab = 'ia';
      save();
      render();
      window.scrollTo(0, 0);
      askGeminiCoach();
      return;
    } else if (t.id === 'clearGeminiKey') {
      setGeminiKey('');
      aiStatusMsg = '';
      aiKeyMsg = '';
      aiKeyTone = '';
      if ($('geminiKeyInput')) $('geminiKeyInput').value = '';
      renderAiCoach();
      showToast('Clé supprimée');
      return;
    } else if (t.id === 'shiftBtn') {
      peek = null;
      shiftCycle();
      showToast('Cycle décalé d’un jour');
    } else if (t.id === 'changeDayBtn') {
      peek = null;
      st.cycleStart = null;
      st.dayAutoDate = '';
    } else if (t.id === 'backBtn') {
      peek = null;
    } else if (d.qstep) {
      const [mid, f, v] = d.qstep.split('|');
      const dv = Number(v);
      const day = viewDay();
      const P = buildDay(st.phase, day);
      const m = P.meals.find((x) => x.id === mid);
      const it = m && m.items.find((x) => x.f === f);
      const ng = Math.max(0, Math.min(2000, (it ? it.g : 0) + dv));
      st.qty = st.qty || {};
      st.qty[st.phase] = st.qty[st.phase] || {};
      st.qty[st.phase][day] = st.qty[st.phase][day] || {};
      if (it && ng === it.gAuto) delete st.qty[st.phase][day][`${mid}|${f}`];
      else st.qty[st.phase][day][`${mid}|${f}`] = ng;
      syncTodayKcalLog();
    } else if (t.id === 'resetQty') {
      if (st.qty && st.qty[st.phase]) delete st.qty[st.phase][viewDay()];
      syncTodayKcalLog();
      showToast('Grammes auto rétablis ✓');
    } else if (d.cstep) {
      const [slot, deltaStr] = d.cstep.split('|');
      const dv = Number(deltaStr);
      const C = cardioPlan(st.phase);
      const nextOn = slot === 'on' ? Math.max(0, Math.min(90, C.on + dv)) : C.on;
      const nextOff = slot === 'off' ? Math.max(0, Math.min(90, C.off + dv)) : C.off;
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      if (nextOn === C.baseOn && nextOff === C.baseOff) {
        delete st.profile.cardioOnMin;
        delete st.profile.cardioOffMin;
        delete st.profile.cardioSource;
      } else {
        st.profile.cardioOnMin = nextOn;
        st.profile.cardioOffMin = nextOff;
        st.profile.cardioSource = 'custom';
      }
    } else if (t.id === 'cardioResetAutoBtn') {
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      delete st.profile.cardioOnMin;
      delete st.profile.cardioOffMin;
      delete st.profile.cardioSource;
      const C = cardioPlan(st.phase);
      showToast(`Cardio rétabli (${C.baseOn} ON / ${C.baseOff} OFF) ✓`);
    } else if (t.id === 'deloadBtn') {
      const next = !deloadOn();
      st.deloadUntil = next ? fromNo(dayNo(today) + CYCLE.length) : null;
      showToast(next ? `Deload activé (${CYCLE.length} jours)` : 'Deload désactivé');
    } else if (d.fatigue) {
      st.fatigueLog = st.fatigueLog || {};
      st.fatigueLog[today] = d.fatigue;
    } else if (d.alt) {
      const list = ALT_EX[d.alt];
      const len = list && list.length ? list.length : 2;
      st.altParity = st.altParity || {};
      st.altParity[d.alt] = ((Number(st.altParity[d.alt]) || 0) + 1) % len;
      const vi = activeViewIdx();
      const s = CYCLE[vi];
      if (s && SESSIONS[s]) {
        const slot = SESSIONS[s].ex.findIndex((item) => item && item.altKey === d.alt);
        if (slot >= 0) {
          const nextEx = resolveEx(s, slot, vi);
          if (nextEx) showToast(`Alternance : ${nextEx.short || nextEx.n}`);
        }
      }
    } else if (d.setall) {
      const [sKey, slot] = d.setall.split('|');
      const exo = resolveEx(sKey, slot, activeViewIdx());
      const nSets = setsFor(exo, deloadOn());
      for (let k = 0; k < nSets; k++) {
        st.log.done[`${d.setall}|${k}`] = true;
      }
      recordHist(exo.n);
      startRest(exo.rest, exo.n);
    } else if (d.set) {
      const now = !st.log.done[d.set];
      st.log.done[d.set] = now;
      const p = d.set.split('|');
      const exo = resolveEx(p[0], p[1], activeViewIdx());
      if (now) {
        recordHist(exo.n);
        const tech = techOf(exo, deloadOn());
        const tSteps = techSteps(tech);
        const idx = Number(p[p.length - 1]);
        const beforeTech = !!tech && idx >= exo.sets - tSteps - 1 && idx < exo.sets - 1;
        if (!beforeTech) startRest(exo.rest, exo.n);
      }
    } else if (d.plus) {
      const p = d.plus.split('|');
      const exo = resolveEx(p[0], p[1], activeViewIdx());
      const cur0 = num(st.loads[exo.n]);
      const cur = isFinite(cur0) ? cur0 : defKg(exo) || 0;
      st.loads[exo.n] = Math.round((cur + stepFor(exo)) * 100) / 100;
    } else if (d.rest) {
      const p = d.rest.split('|');
      const exo = resolveEx(p[0], p[1], activeViewIdx());
      startRest(exo.rest, exo.n);
      return;
    } else if (d.unfold) {
      if (unfolded.has(d.unfold)) unfolded.delete(d.unfold);
      else unfolded.add(d.unfold);
      render();
      return;
    } else if (d.rec) {
      st.log.done['R|' + d.rec] = !st.log.done['R|' + d.rec];
    } else if (t.id === 'timerSkip') {
      stopTimer();
      return;
    } else if (d.activity) {
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      st.profile.activityFactor = Number(d.activity);
    } else if (d.loss) {
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      st.profile.weeklyLossTargetKg = Number(d.loss);
      if (st.targets) delete st.targets[st.phase];
      syncTodayKcalLog();
    } else if (d.stagAct) {
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      if (d.stagAct === 'decrease_activity') {
        const curOff = tgt(st.phase, 'off');
        const curOn = tgt(st.phase, 'on');
        const floor = st.phase === 'seche' ? Math.max(KCAL_MIN, st.profile.kcalFloor || KCAL_MIN) : KCAL_MIN;
        const cut = st.phase === 'seche' ? Math.min(120, Math.max(0, curOff - floor)) : 100;
        st.targets = st.targets || {};
        st.targets[st.phase] = { on: Math.max(floor, curOn - cut), off: Math.max(floor, curOff - cut) };
        syncTodayKcalLog();
      } else if (d.stagAct === 'increase_activity') {
        const curOff = tgt(st.phase, 'off');
        const curOn = tgt(st.phase, 'on');
        const add = st.phase === 'seche' ? 120 : 100;
        st.targets = st.targets || {};
        st.targets[st.phase] = { on: Math.min(KCAL_MAX, curOn + add), off: Math.min(KCAL_MAX, curOff + add) };
        syncTodayKcalLog();
      } else if (d.stagAct === 'add_steps' || d.stagAct === 'add_zone2') {
        const C = cardioPlan(st.phase);
        if (d.stagAct === 'add_steps') {
          st.profile.extraDailySteps = (st.profile.extraDailySteps || 0) + 2500;
        } else {
          st.profile.extraWeeklyZone2Sessions = (st.profile.extraWeeklyZone2Sessions || 0) + 1;
        }
        if (C.off < 75) {
          st.profile.cardioOnMin = C.on;
          st.profile.cardioOffMin = Math.min(75, C.off + 10);
        } else {
          st.profile.cardioOnMin = Math.min(90, C.on + 10);
          st.profile.cardioOffMin = C.off;
        }
        st.profile.cardioSource = 'custom';
      } else if (d.stagAct === 'diet_break' || d.stagAct === 'switch_maintain') {
        st.phase = 'maintien';
        syncTodayKcalLog();
      }
      showToast('Ajustement appliqué ✓');
    } else if (t.id === 'applyAdviceBtn') {
      const N = calcNutrition(st.phase);
      st.targets = st.targets || {};
      st.targets[st.phase] = { on: N.kcalOn, off: N.kcalOff };
      syncTodayKcalLog();
      showToast('Suggestion calorique appliquée ✓');
    } else if (t.id === 'resetPlan') {
      if (!confirm('Revenir au plan de départ (calories, grammes et viandes) ?')) return;
      st.qty = {};
      st.swap = { grain: 'pasta' };
      st.targets = cloneObj(DEFAULT_TARGETS);
      st.macros = {};
      st.profile = Object.assign({}, PROFILE_DEFAULT);
      swapOpen = null;
      save();
      buildProfile();
      showToast('Plan de départ rétabli');
    } else if (t.id === 'resetFoods') {
      if (!confirm('Remettre les valeurs par défaut ?')) return;
      st.foods = {};
      save();
      buildFoodRef();
      showToast('Valeurs par défaut rétablies');
    } else if (d.macroday) {
      macroDay = d.macroday === 'off' ? 'off' : 'on';
      renderProfile();
      return;
    } else if (d.tab) {
      st.tab = d.tab;
      setMenuOpen(false);
      window.scrollTo(0, 0);
    } else return;

    save();
    render();
  });

  document.addEventListener('change', (e) => {
    if (!e.target) return;
    if (e.target.id === 'geminiKeyInput') {
      setGeminiKey(e.target.value);
      aiKeyMsg = '';
      aiKeyTone = '';
      aiStatusMsg = '';
      renderAiCoach();
      return;
    }
    if (e.target.id === 'dietAdhered' || e.target.id === 'sleepOk') {
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      st.profile[e.target.id] = !!e.target.checked;
      save();
      render();
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.qty) {
      const key = el.dataset.qty;
      const day = viewDay();
      const raw = el.value.trim();
      const v = raw === '' ? 0 : Math.round(num(raw));
      if (!isFinite(v) || v < 0 || v > 2000) return;
      st.qty = st.qty || {};
      st.qty[st.phase] = st.qty[st.phase] || {};
      st.qty[st.phase][day] = st.qty[st.phase][day] || {};
      st.qty[st.phase][day][key] = v;
      syncTodayKcalLog();
      save();
      const P = buildDay(st.phase, day);
      updateRepasSummary(P);
      const [mid, f] = key.split('|');
      const m = P.meals.find((x) => x.id === mid);
      const it = m && m.items.find((x) => x.f === f);
      if (it) {
        el.classList.toggle('is-custom', !!it.custom);
        const qk = document.querySelector(`[data-qkcal="${key}"]`);
        if (qk) qk.textContent = `${Math.round(it.kcal)} kcal`;
      }
      if (m) {
        const mk = document.querySelector(`[data-mkcal="${mid}"]`);
        if (mk) mk.textContent = `${fmt(m.kcal)} kcal`;
      }
      return;
    }
    if (el.dataset.load) {
      const v = num(el.value);
      if (el.value.trim() === '') delete st.loads[el.dataset.load];
      else if (isFinite(v) && v >= 0) st.loads[el.dataset.load] = v;
      save();
      return;
    }
    if (el.id === 'geminiKeyInput') {
      setGeminiKey(el.value);
      aiKeyMsg = '';
      aiKeyTone = '';
      aiStatusMsg = '';
      renderAiCoach();
      return;
    }
    if (el.id === 'waistInput') {
      const raw = el.value.trim();
      const v = num(raw);
      st.waist = st.waist || {};
      if (raw === '') {
        delete st.waist[today];
        waistSuggestCm = null;
        if ($('waistHelper')) $('waistHelper').hidden = true;
      } else if (isFinite(v) && v >= 20 && v < 55) {
        const cm = Math.round(v * 2.54 * 10) / 10;
        waistSuggestCm = cm;
        if ($('waistHelper')) {
          $('waistHelperText').textContent = `${fmt1(v)} pouces ≈ ${fmt1(cm)} cm`;
          $('waistConvertBtn').textContent = `Utiliser ${fmt1(cm)} cm`;
          $('waistHelper').hidden = false;
        }
        return;
      } else if (isFinite(v) && v >= 55 && v <= 200) {
        st.waist[today] = v;
        waistSuggestCm = null;
        if ($('waistHelper')) $('waistHelper').hidden = true;
      } else {
        waistSuggestCm = null;
        if ($('waistHelper')) $('waistHelper').hidden = true;
        return;
      }
    } else if (el.id === 'lossRateInput') {
      const raw = el.value.trim();
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      if (raw === '') {
        st.profile.weeklyLossTargetKg = null;
      } else {
        const v = num(raw);
        if (!isFinite(v) || v < 0.1 || v > 1.5) return;
        st.profile.weeklyLossTargetKg = Math.round(v * 100) / 100;
      }
      if (st.targets) delete st.targets[st.phase];
      syncTodayKcalLog();
    } else if (el.dataset.prof) {
      const k = el.dataset.prof;
      const v = num(el.value);
      if (!isFinite(v) || v <= 0) return;
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      st.profile[k] = k === 'activityFactor' ? Math.min(1.7, Math.max(1.25, v)) : v;
      if (st.targets) delete st.targets[st.phase];
      syncTodayKcalLog();
    } else if (el.dataset.food) {
      const [f, k] = el.dataset.food.split('|');
      const v = num(el.value);
      st.foods = st.foods || {};
      const o = (st.foods[f] = Object.assign({}, st.foods[f]));
      if (el.value.trim() === '' || v === FOODS_DEFAULT[f][k]) delete o[k];
      else if (isFinite(v) && v >= 0 && v <= (k === 'kcal' ? 900 : 100)) o[k] = v;
      else return;
      if (!Object.keys(o).length) delete st.foods[f];
    } else if (el.dataset.macro) {
      const k = el.dataset.macro;
      const raw = el.value.trim();
      st.macros = st.macros || {};
      st.macros[st.phase] = st.macros[st.phase] || {};
      if (raw === '') {
        delete st.macros[st.phase][k];
        if (st.profile && st.profile[k] != null) delete st.profile[k];
        if (!Object.keys(st.macros[st.phase]).length) delete st.macros[st.phase];
      } else {
        const v = Math.round(num(raw));
        const isProt = k.startsWith('protein');
        const min = isProt ? 50 : 25;
        const max = isProt ? 350 : 250;
        if (!isFinite(v) || v < min || v > max) return;
        st.macros[st.phase][k] = v;
      }
      syncTodayKcalLog();
    } else if (el.dataset.mykcal) {
      const d = el.dataset.mykcal;
      const raw = el.value.trim();
      st.targets = st.targets || {};
      st.targets[st.phase] = st.targets[st.phase] || {};
      if (raw === '') {
        delete st.targets[st.phase][d];
        if (!Object.keys(st.targets[st.phase]).length) delete st.targets[st.phase];
      } else {
        const v = Math.round(num(raw));
        if (!isFinite(v) || v < KCAL_MIN || v > KCAL_MAX) return;
        st.targets[st.phase][d] = v;
      }
      syncTodayKcalLog();
    } else if (el.dataset.wday) {
      const day = el.dataset.wday;
      const v = num(el.value);
      if (el.value.trim() === '') delete st.weights[day];
      else if (isFinite(v) && v > 30 && v < 300) st.weights[day] = v;
      else return;
      syncWeeklyAvgs();
      document.querySelectorAll(`[data-wday="${day}"]`).forEach((o) => {
        if (o !== el) o.value = el.value;
      });
    } else return;

    save();
    render();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && timer) {
      keepAwake(true);
      updateTimer();
    }
  });

  buildWeek();
  buildProfile();
  buildFoodRef();
  $('wQuick').dataset.wday = today;
  $('wQuick').value = st.weights[today] != null ? String(st.weights[today]).replace('.', ',') : '';

  document.addEventListener('focusout', (e) => {
    if (e.target.id === 'wQuick') renderWeighCard();
    if (e.target.id === 'lossRateInput') {
      const N = calcNutrition('seche');
      e.target.value = String(Math.round(N.weeklyLossKg * 100) / 100).replace('.', ',');
      render();
      return;
    }
    if (e.target.dataset && e.target.dataset.qty) {
      render();
      return;
    }
    if (e.target.dataset && e.target.dataset.macro) {
      const k = e.target.dataset.macro;
      const pm = phaseMacros(st.phase);
      const p = profile();
      const v = pm[k] ?? p[k];
      e.target.value = v != null ? String(v) : '';
      renderProfile();
      return;
    }
    if (e.target.dataset && e.target.dataset.mykcal) {
      e.target.value = String(tgt(st.phase, e.target.dataset.mykcal));
      renderProfile();
      return;
    }
    if (e.target.dataset && e.target.dataset.food) {
      const [f, k] = e.target.dataset.food.split('|');
      const F = food(f);
      e.target.value = k === 'kcal' ? Math.round(F[k]) : n1(F[k]);
    }
  });

  const curveBox = $('wCurve');
  const nearestPoint = (e) => {
    const svg = curveBox.querySelector('svg');
    if (!svg || !curvePts.length) return -1;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * CW;
    let best = 0;
    curvePts.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(curvePts[best].x - x)) best = i;
    });
    return best;
  };

  ['pointerdown', 'pointermove'].forEach((t) =>
    curveBox.addEventListener(t, (e) => {
      if (!e.target.closest('.wt-chart')) return;
      const i = nearestPoint(e);
      if (i >= 0 && i !== curveIdx) showPoint(i);
    })
  );

  curveBox.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') hidePoint();
  });

  document.addEventListener('pointerdown', (e) => {
    if (curveIdx >= 0 && !e.target.closest('.wt-chart')) hidePoint();
  });

  $('importFile').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (!obj || obj.app !== 'mon-plan-repas' || !obj.data || typeof obj.data !== 'object') {
        throw new Error('format');
      }
      if (!confirm('Remplacer tes données actuelles par cette sauvegarde ?')) return;
      if (obj.look === 'light' || obj.look === 'dark' || obj.look === 'auto') {
        setLook(obj.look);
      }
      localStorage.setItem(KEY, JSON.stringify(obj.data));
      location.reload();
    } catch (err) {
      alert('Fichier non reconnu.');
    }
  });

  if ($('aiQuestion')) {
    $('aiQuestion').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        askGeminiCoach();
      }
    });
  }

  if ($('geminiKeyInput')) {
    $('geminiKeyInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        testGeminiKey();
      }
    });
  }

  render();
  }

  initApp();
})();
