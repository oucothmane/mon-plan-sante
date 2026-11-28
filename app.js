/* ==========================================================================
   Mon Plan Santé — Logique minimaliste (app.js)
   Parcours épuré en 3 onglets :
   1. Repas (Mes 3 repas du jour, macros, remplacement viande/poisson, −/+, copie Foodvisor)
   2. Split (Exercices du jour, minuteur auto, récupération & carnet de charges)
   3. Courses (Panier 4 / 8 / 10 jours)
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

  const shortDate = (s) =>
    dateOf(s).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });

  const today = ymd(new Date());

  const num = (v) => parseFloat(String(v || '').replace(',', '.'));
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const fmtKg = (v) => String(v).replace('.', ',');
  const n1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  const spoon = (x) => String(Math.max(0.5, Math.round(x * 2) / 2)).replace('.', ',');
  const fmtRest = (s) =>
    s >= 60 ? Math.floor(s / 60) + '′' + (s % 60 ? pad(s % 60) : '') : s + ' s';
  const escHtml = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const CHECK =
    '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const CHECK_SM =
    '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const COPY_IC =
    '<svg class="ic" width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const PILL =
    '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/></svg>';
  const CLOCK =
    '<svg class="ic" width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>';
  const CHEVRON =
    '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  const TITLES = {
    repas: 'Repas',
    seance: 'Split',
    courses: 'Courses'
  };

  // ==========================================================================
  // 2. CONFIGURATION CHARGÉE DEPUIS LES FICHIERS JSON
  // ==========================================================================

  const NE = window.NutritionEngine;
  const FOODS_DEFAULT = NE.FOOD_DB;
  const cloneObj = (o) => JSON.parse(JSON.stringify(o));

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
        day: s.day || '',
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
  const TABS = ['repas', 'seance', 'courses'];

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
      log: { date: today, done: {}, reps: {} },
      deloadUntil: null,
      loads: {},
      hist: {},
      eatenLog: {},
      kcalLog: {},
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
    st.cart = st.cart || {};
    st.swap = st.swap || {};
    st.altParity = st.altParity || {};
    st.loads = st.loads || {};
    st.hist = st.hist || {};
    st.eatenLog = st.eatenLog || {};
    st.kcalLog = st.kcalLog || {};
    if (st.shopDays === 7 || st.shopDays === 3) st.shopDays = 8;
    st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});

    // Migration douce des anciens IDs de swap
    const SWAP_MIG = { poulet: 'chicken', dinde: 'turkey', cabillaud: 'cod', boeuf: 'beef5', pates: 'pasta' };
    Object.keys(st.swap).forEach((k) => {
      if (SWAP_MIG[st.swap[k]]) st.swap[k] = SWAP_MIG[st.swap[k]];
    });
    if (!st.v43Plan) {
      st.targets = cloneObj(DEFAULT_TARGETS);
      st.swap.grain = 'pasta';
      st.v43Plan = true;
    }
    st.swap.grain = 'pasta';

    if (CYCLE.length && st.cycleLen !== CYCLE.length) {
      st.cycleLen = CYCLE.length;
      st.cycleStart = null;
      st.viewIdx = 0;
      st.dayAutoDate = '';
      st.altParity = {};
      st.log = { date: today, done: {}, reps: {} };
    }
    if (TABS.indexOf(st.tab) < 0) st.tab = 'repas';
    if (st.eatenDate !== today) {
      st.eaten = {};
      st.eatenDate = today;
    }
    if (!st.log || st.log.date !== today) st.log = { date: today, done: {}, reps: {} };
    st.log.reps = st.log.reps || {};
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

    save();

    const food = (id) => NE.getFood(id, st.foods);
    const profile = () => Object.assign({}, PROFILE_DEFAULT, st.profile || {});
    const enginePhase = (ph) => (ph === 'seche' ? 'cut' : 'maintain');

    function customTarget(ph, d) {
      const v = Number(((st.targets || {})[ph] || {})[d]);
      return isFinite(v) && v >= 1400 && v <= KCAL_MAX ? Math.round(v) : null;
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
        phase: enginePhase(ph),
        actualAvgIntakeKcal: Math.round((tgt(ph, 'on') + tgt(ph, 'off')) / 2)
      });
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

    // ==========================================================================
    // 4. HISTORIQUE DES CHARGES (SPLIT)
    // ==========================================================================

    function repRangeMax(repsStr) {
      const nums = String(repsStr || '').match(/\d+/g);
      if (!nums || !nums.length) return null;
      return Number(nums[nums.length - 1]);
    }

    function collectLoggedReps(prefix, nNorm) {
      const out = [];
      const repsMap = (st.log && st.log.reps) || {};
      for (let k = 0; k < nNorm; k++) {
        const v = Number(repsMap[`${prefix}|${k}`]);
        if (isFinite(v) && v > 0) out.push(Math.round(v));
      }
      return out;
    }

    function recordHist(name, repsArr) {
      const kg = num(st.loads[name]);
      const hasReps = Array.isArray(repsArr) && repsArr.length > 0;
      if (!isFinite(kg) && !hasReps) return;
      const h = (st.hist[name] = st.hist[name] || []);
      const last = h[h.length - 1];
      if (last && last.d === today) {
        if (isFinite(kg)) last.kg = kg;
        if (hasReps) last.reps = repsArr.slice();
      } else {
        const entry = { d: today };
        if (isFinite(kg)) entry.kg = kg;
        if (hasReps) entry.reps = repsArr.slice();
        h.push(entry);
      }
      if (h.length > 60) h.splice(0, h.length - 60);
    }

    function lastTime(name) {
      const h = st.hist[name] || [];
      for (let i = h.length - 1; i >= 0; i--) {
        if (h[i].d < today) return h[i];
      }
      return null;
    }

    // ==========================================================================
    // 5. MOTEUR DE CALCUL DES REPAS (CARB CYCLING)
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

      return {
        meals: plan.meals,
        tot,
        target: plan.dayKcal,
        targetProt: plan.proteinTargetG,
        targetFat: plan.fatTargetG,
        targetCarbs: plan.carbsTargetG,
        fiberTargetG: plan.fiberTargetG,
        lowFiber: tot.fib < NE.RULE_CONFIG.fiber.minG,
        hasCustom,
        N: plan.targets
      };
    }

    // ==========================================================================
    // 6. COPIE REPAS POUR FOODVISOR
    // ==========================================================================

    function formatMealForFoodvisor(meal) {
      const parts = [];
      (meal.items || []).forEach((i) => {
        if (!i || i.g <= 0 || i.f === 'creatine') return;
        const F = food(i.f);
        if (!F || F.hidden) return;
        parts.push(`${Math.round(i.g)} g ${F.n}`);
      });
      return parts.join(', ');
    }

    async function copyToClipboard(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (e) {}

      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (e) {}
      ta.remove();
      return copied;
    }

    async function copyMealForFoodvisor(mealId, btn) {
      const P = buildDay(st.phase, viewDay());
      const meal = P.meals.find((m) => m.id === mealId);
      if (!meal) return;
      const text = formatMealForFoodvisor(meal);
      if (!text) {
        showToast('Aucun aliment à copier');
        return;
      }

      const copied = await copyToClipboard(text);
      if (!copied) {
        alert('Copie impossible sur ce navigateur.');
        return;
      }

      showToast(`${meal.name} copié pour Foodvisor ✓`);
      if (btn) {
        btn.classList.add('is-copied');
        const label = btn.querySelector('span');
        if (label) label.textContent = 'Copié ✓';
        setTimeout(() => {
          btn.classList.remove('is-copied');
          if (label) label.textContent = 'Copier';
        }, 1800);
      }
    }

    function formatMealItems(meal) {
      const parts = [];
      (meal.items || []).forEach((i) => {
        if (!i || i.g <= 0) return;
        const F = food(i.f);
        if (!F || (F.hidden && i.f !== 'creatine')) return;
        parts.push(`${Math.round(i.g)} g ${F.n}`);
      });
      return parts.join(', ');
    }

    function formatAllMeals() {
      const lines = ['Plan repas complet (Cut & Maintien · Jours ON et OFF)'];
      const phases = [
        ['seche', 'CUT'],
        ['maintien', 'MAINTIEN']
      ];
      const days = [
        ['on', 'Jour ON'],
        ['off', 'Jour OFF']
      ];

      phases.forEach(([phaseKey, phaseLabel]) => {
        days.forEach(([dayKey, dayLabel]) => {
          const P = buildDay(phaseKey, dayKey);
          const t = P.tot;
          lines.push(
            '',
            `${phaseLabel} — ${dayLabel} (${Math.round(t.kcal)} / ${Math.round(P.target)} kcal · P ${Math.round(t.p)} g · G ${Math.round(t.g)} g · L ${Math.round(t.l)} g · Fibres ${Math.round(t.fib)} g)`
          );
          P.meals.forEach((m) => {
            const itemsTxt = formatMealItems(m);
            lines.push(`${m.num}. ${m.name} (${Math.round(m.kcal)} kcal) : ${itemsTxt}`);
          });
        });
      });

      return lines.join('\n');
    }

    async function copyAllMeals(btn) {
      const text = formatAllMeals();
      const copied = await copyToClipboard(text);
      if (!copied) {
        alert('Copie impossible sur ce navigateur.');
        return;
      }
      showToast('Tous les repas copiés (Cut & Maintien · ON/OFF) ✓');
      if (btn) {
        btn.classList.add('is-copied');
        const label = btn.querySelector('strong');
        if (label) label.textContent = 'Repas copiés ✓';
        setTimeout(() => {
          btn.classList.remove('is-copied');
          if (label) label.textContent = 'Copier tous les repas';
        }, 1800);
      }
    }

    function formatFullSplit() {
      const keys = Object.keys(SESSIONS);
      const isPpl = keys.join('/') === 'Push/Pull/Legs';
      const headLabel = isPpl ? 'Split PPL (Push / Pull / Legs)' : `Split ${keys.join('/')}`;
      const lines = [`${headLabel} — ${CYCLE.length || 6} jours (1 ON / 1 OFF)`];
      const seenAlt = new Set();
      const altGroups = [];

      keys.forEach((sKey) => {
        const S = SESSIONS[sKey];
        const dayTag = S.day ? ` (${S.day})` : '';
        lines.push('', `${S.title}${dayTag}`);
        if (S.sub) lines.push(S.sub);
        let idx = 1;
        (S.ex || []).forEach((raw) => {
          if (raw.isAlt) {
            if (!seenAlt.has(raw.altKey)) {
              seenAlt.add(raw.altKey);
              altGroups.push(raw);
            }
            return;
          }
          const e = raw;
          const tech = techOf(e, false);
          const tSteps = techSteps(tech);
          const nNorm = tech ? e.sets - tSteps : e.sets;
          const setsTxt = tech
            ? `${nNorm} × ${e.reps} + ${tSteps} paliers ${tech.n}`
            : `${e.sets} × ${e.reps}`;
          const cur = st.loads[e.n];
          const kgVal = cur != null ? cur : defKg(e);
          const kgTxt = kgVal != null ? ` · ${fmtKg(kgVal)} kg` : '';
          const restStr = e.restTxt || fmtRest(e.rest);
          const muscle = e.m ? ` (${e.m})` : '';
          lines.push(`${idx}. ${e.n}${muscle} — ${setsTxt} · ${e.rir} · ${restStr}${kgTxt}`);
          idx++;
        });
      });

      if (altGroups.length) {
        lines.push('', '🟣 Fin de séance (alternance 1 séance sur 2)');
        altGroups.forEach((g) => {
          (g.variants || []).forEach((e) => {
            const cur = st.loads[e.n];
            const kgVal = cur != null ? cur : defKg(e);
            const kgTxt = kgVal != null ? ` · ${fmtKg(kgVal)} kg` : '';
            const restStr = e.restTxt || fmtRest(e.rest);
            lines.push(`- ${e.n} — ${e.sets} × ${e.reps} · ${e.rir} · ${restStr}${kgTxt}`);
          });
        });
      }

      if (RECOVERY.length) {
        lines.push('', '🧘 Jours OFF (Récupération)');
        RECOVERY.forEach((routine, k) => {
          const items = routine.map((r) => `${r.n} (${r.d})`).join(', ');
          lines.push(`- Routine ${k + 1} : ${items}`);
        });
      }

      if (SPLIT_RULES && (SPLIT_RULES.progression || SPLIT_RULES.rest || SPLIT_RULES.dropset || SPLIT_RULES.restPause || SPLIT_RULES.deload)) {
        lines.push('');
        if (SPLIT_RULES.rest) lines.push(`Repos : ${SPLIT_RULES.rest}`);
        if (SPLIT_RULES.dropset) lines.push(`Dropset : ${SPLIT_RULES.dropset}`);
        if (SPLIT_RULES.restPause) lines.push(`Rest-pause : ${SPLIT_RULES.restPause}`);
        if (SPLIT_RULES.progression) lines.push(`Progression : ${SPLIT_RULES.progression}`);
        if (SPLIT_RULES.deload) lines.push(`Deload : ${SPLIT_RULES.deload}`);
      }

      return lines.join('\n');
    }

    async function copyFullSplit(btn) {
      const text = formatFullSplit();
      const copied = await copyToClipboard(text);
      if (!copied) {
        alert('Copie impossible sur ce navigateur.');
        return;
      }
      showToast('Split copié en entier ✓');
      if (btn) {
        btn.classList.add('is-copied');
        const label = btn.querySelector('strong');
        if (label) label.textContent = 'Split copié ✓';
        setTimeout(() => {
          btn.classList.remove('is-copied');
          if (label) label.textContent = 'Copier tout le split';
        }, 1800);
      }
    }

    // ==========================================================================
    // 7. RENDU : REPAS, CYCLE & SPLIT
    // ==========================================================================

    let swapOpen = null;

    function itemHint(i) {
      const eggG = 56.7;
      const bSize = (NE.RULE_CONFIG.mealBases && NE.RULE_CONFIG.mealBases.belvitaGPerBiscuit) || 12.5;
      switch (i.f) {
        case 'eggs': {
          const n = Math.round((i.g / eggG) * 2) / 2;
          return `≈ ${String(n).replace('.', ',')} œuf${n > 1 ? 's' : ''}`;
        }
        case 'olive_oil':
          return i.g > 0 ? '≈ ' + spoon(i.g / 5) + ' c. à café' : '0 c. à café';
        case 'creatine':
          return 'dans le shaker';
        case 'berries':
          return i.g > 0 ? 'dans le shaker' : 'option glucides';
        case 'banana':
          return i.g >= 200
            ? '≈ 2 bananes'
            : i.g >= 150
            ? '≈ 1,5 banane'
            : i.g >= 100
            ? '≈ 1 banane moyenne'
            : i.g > 0
            ? '≈ ½ banane'
            : 'option glucides';
        case 'raisins':
          return i.g > 0 ? 'glucides rapides' : 'option glucides';
        case 'belvita': {
          const bInfo = food('belvita');
          const kcalPer = bInfo ? Math.round((bInfo.kcal * bSize) / 100) : 55;
          if (i.g <= 0) return `option glucides (${kcalPer} kcal/biscuit)`;
          const nb = Math.max(1, Math.round(i.g / bSize));
          return `≈ ${nb} biscuit${nb > 1 ? 's' : ''}`;
        }
        case 'dark_choc': {
          const nc = Math.round(i.g / 5);
          return i.g > 0 ? `le matin · ${nc} carré${nc > 1 ? 's' : ''}` : 'option le matin';
        }
        case 'avocado':
          return i.g >= 85 ? '≈ ⅔ avocat' : i.g >= 55 ? '½ avocat moyen' : i.g > 0 ? '½ petit avocat' : '';
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
            <button type="button" class="copy-meal-btn" data-copy-meal="${m.id}" aria-label="Copier ${escHtml(m.name)} pour Foodvisor">${COPY_IC}<span>Copier</span></button>
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
        const label = isTech ? `${tech.k}${tSteps > 1 ? k - nNorm + 1 : ''}` : k + 1;
        return `<button type="button" class="set-btn${isTech ? ' is-tech' : ''}" data-set="${key}" aria-pressed="${d}" aria-label="${
          isTech ? `${tech.N} palier ${k - nNorm + 1}` : `Série ${k + 1}`
        }">${d ? CHECK_SM : label}</button>`;
      }).join('');

      const dividerHtml = e.altKey
        ? `<p class="sec-div">Fin de séance · Alternance avant-bras</p>`
        : '';

      const id = donePrefix;
      if (all && !unfolded.has(id)) {
        return (
          dividerHtml +
          `
        <article class="card ex is-done is-folded${e.altKey ? ' is-alt' : ''}">
          <button type="button" class="ex-fold" data-unfold="${id}" aria-expanded="false">
            <span class="ex-num" aria-hidden="true">${CHECK_SM}</span>
            <span class="ex-fold-txt">
              ${e.m ? `<small class="ex-fold-m">${escHtml(e.m)}</small>` : ''}
              <span class="ex-fold-name">${escHtml(e.n)}</span>
            </span>
            ${st.loads[e.n] != null ? `<span class="ex-fold-kg">${fmtKg(st.loads[e.n])} kg</span>` : ''}
            ${CHEVRON}
          </button>
        </article>`
        );
      }

      const curLoad = num(st.loads[e.n]);
      const ltKg = lt && isFinite(lt.kg) ? lt.kg : null;
      const progDiff = ltKg != null && isFinite(curLoad) && curLoad > ltKg ? Math.round((curLoad - ltKg) * 100) / 100 : 0;
      const progHtml = progDiff > 0 ? `<span class="ex-prog">+${fmtKg(progDiff)} kg</span>` : '';
      const lastHtml = lt && ltKg != null
        ? `<p class="ex-last">Dernière fois : ${fmtKg(ltKg)} kg (${shortDate(lt.d)})${progHtml}</p>`
        : '';
      const otherAlt = e.altKey && e.variants && e.variants.length > 1
        ? e.variants[(e.variantIdx + 1) % e.variants.length]
        : null;
      const altBtnHtml = otherAlt
        ? `<button type="button" class="link-btn ex-alt-btn" data-alt="${e.altKey}">⇄ ${escHtml(otherAlt.short || otherAlt.n)}</button>`
        : '';
      const allBtnHtml = !all ? `<button type="button" class="link-btn ex-all-btn" data-setall="${donePrefix}">Tout valider</button>` : '';
      const actsHtml = altBtnHtml || allBtnHtml ? `<div class="ex-foot-acts">${altBtnHtml}${allBtnHtml}</div>` : '';
      const footHtml = lastHtml || actsHtml ? `<div class="ex-foot">${lastHtml}${actsHtml}</div>` : '';

      const typeTag = e.altKey
        ? '<span class="ex-type is-alt">Alternance</span>'
        : e.poly
        ? '<span class="ex-type is-poly">Poly</span>'
        : '<span class="ex-type">Iso</span>';
      const rirClean = dl
        ? e.poly
          ? 'Deload · RIR 4'
          : 'Deload · RIR 3'
        : String(e.rir || '').replace(/\s*\+\s*(Dropset|Rest-pause)/i, '');
      const techChip = tech
        ? `<span class="ex-chip is-tech">${escHtml(tech.N)} ×${tSteps}</span>`
        : '';
      const techTipHtml = tech && tech.tip
        ? `<p class="ex-tech-tip">${escHtml(tech.tip)}</p>`
        : '';

      return (
        dividerHtml +
        `
        <article class="card ex${all ? ' is-done' : ''}${e.poly ? ' is-poly' : ''}${e.altKey ? ' is-alt' : ''}">
          <div class="ex-head">
            <span class="ex-num" aria-hidden="true">${e.opt ? '+' : i + 1}</span>
            <div class="ex-title">
              <div class="ex-eyebrow">
                ${e.m ? `<span class="ex-muscle">${escHtml(e.m)}</span>` : ''}
                ${typeTag}
              </div>
              <h3>${escHtml(e.n)}</h3>
              <div class="ex-chips">
                <span class="ex-chip is-vol">${nNorm} × ${escHtml(e.reps)}</span>
                ${rirClean ? `<span class="ex-chip">${escHtml(rirClean)}</span>` : ''}
                ${techChip}
              </div>
              ${e.note ? `<small>${escHtml(e.note)}</small>` : ''}
            </div>
            <button type="button" class="rest-btn${e.poly ? ' is-poly' : ''}" data-rest="${s}|${slot}" aria-label="Lancer repos ${e.restTxt || fmtRest(e.rest)}">${CLOCK}${
          e.restTxt || fmtRest(e.rest)
        }</button>
          </div>
          <div class="ex-row">
            <div class="load-row">
              <input id="load-${s}-${slot}" type="text" inputmode="decimal" autocomplete="off" placeholder="${
        defKg(e) != null ? fmtKg(defKg(e)) : 'kg'
      }" data-load="${escHtml(e.n)}" value="${
        st.loads[e.n] != null ? fmtKg(st.loads[e.n]) : ''
      }" aria-label="Charge en kg">
              <button type="button" class="plus-btn" data-plus="${s}|${slot}">+${fmtKg(
        stepFor(e)
      )}</button>
            </div>
            <div class="sets" role="group">${sets}</div>
          </div>
          ${techTipHtml}
          ${footHtml}
          ${all ? `<button type="button" class="link-btn ex-refold" data-unfold="${id}">Replier</button>` : ''}
        </article>`
      );
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
        const muscleVol = [];
        const muscleMap = {};
        let hasFinisher = false;
        let finisherSets = 0;

        S.ex.forEach((_, i) => {
          const e = resolveEx(s, i, vi);
          if (!e) return;
          if (e.opt) {
            if (!dl) {
              hasFinisher = true;
              finisherSets += setsFor(e, dl);
            }
            return;
          }
          const tech = techOf(e, dl);
          const tSteps = techSteps(tech);
          const n = setsFor(e, dl) - tSteps;
          for (let k = 0; k < n; k++) {
            total++;
            if (st.log.done[`${s}|${i}|${k}`]) done++;
          }
          if (e.m) {
            if (!muscleMap[e.m]) {
              muscleMap[e.m] = { m: e.m, sets: 0, techSteps: 0, techK: '' };
              muscleVol.push(muscleMap[e.m]);
            }
            muscleMap[e.m].sets += n;
            if (tSteps > 0) {
              muscleMap[e.m].techSteps += tSteps;
              muscleMap[e.m].techK = tech.k || 'D';
            }
          }
        });

        $('deloadTag').hidden = !dl;
        if ($('sessTitle')) $('sessTitle').textContent = S.title;
        if ($('sessPills')) {
          const pillsHtml = muscleVol
            .map(
              (mv) =>
                `<span class="sess-pill">${escHtml(mv.m)} <b>${mv.sets}${
                  mv.techSteps ? `+${mv.techSteps}${escHtml(mv.techK)}` : ''
                }</b></span>`
            )
            .join('');
          const finHtml = hasFinisher
            ? `<span class="sess-pill is-alt">+ Avant-bras <b>${finisherSets}</b></span>`
            : '';
          $('sessPills').innerHTML = pillsHtml + finHtml;
        }
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const cards = S.ex.map((_, i) => {
          const e = resolveEx(s, i, vi);
          return !e || (dl && e.opt) ? '' : exHTML(s, e, i, dl, String(i));
        });
        $('exList').innerHTML = cards.join('');
        $('setCount').textContent = `${done} / ${total}`;
        $('setBar').style.width = pct + '%';
        if ($('sessPct')) {
          $('sessPct').textContent = done >= total && total > 0 ? 'Séance terminée ✓' : `${pct} %`;
          $('sessPct').classList.toggle('is-done', done >= total && total > 0);
        }
        if ($('sessSub')) {
          $('sessSub').textContent = dl
            ? 'Deload · RIR 4 poly · RIR 3 iso'
            : '2′ polyarticulaires · 1′ isolation';
        }
        $('deloadBtn').setAttribute('aria-checked', String(dl));
        if ($('deloadTitle') && CYCLE.length) {
          $('deloadTitle').textContent = `Mode deload (${CYCLE.length} jours)`;
        }
        $('deloadText').textContent = dl
          ? `Actif jusqu’au ${longDate(fromNo(dayNo(st.deloadUntil) - 1))}`
          : '2 séries / exercice · RIR 4 poly / RIR 3 iso';
      } else {
        const recs = recoveryFor(vi);
        let recDone = 0;
        $('recList').innerHTML = recs
          .map((r, i) => {
            const d = !!st.log.done['R|' + i];
            if (d) recDone++;
            return `<button type="button" class="row" data-rec="${i}" aria-pressed="${d}">
            <span class="box">${CHECK_SM}</span>
            <span class="row-main"><span class="row-name">${r.n}</span><small>${r.d}</small></span>
          </button>`;
          })
          .join('');
        if ($('recCount')) {
          $('recCount').textContent =
            recs.length > 0 && recDone === recs.length ? 'Validé ✓' : `${recDone} / ${recs.length}`;
        }
        if ($('recBar')) {
          $('recBar').style.width = recs.length > 0 ? (recDone / recs.length) * 100 + '%' : '0%';
        }
      }

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
    }

    // ==========================================================================
    // 8. RENDU : COURSES
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
        if (amt > 0) {
          const buy = x.packSize ? packs(amt, x.packSize, x.one, x.many) : '≈ ' + kgUp(amt * (x.mult || 1));
          freshItems.push(r(x.id, x.label, fmt(amt) + ' g', buy));
        }
      });
      const nBoxes = Math.max(1, Math.ceil(nEggs / eggBoxSize));
      freshItems.push(
        r('oeufs', 'Œufs (calibre L)', nEggs + ' œufs', nBoxes + (nBoxes > 1 ? ` boîtes de ${eggBoxSize}` : ` boîte de ${eggBoxSize}`))
      );
      (rules.fresh || []).forEach((x) => {
        const amt = g(x.id);
        if (amt > 0) {
          const buy = x.packSize ? packs(amt, x.packSize, x.one, x.many) : '≈ ' + kgUp(amt * (x.mult || 1));
          freshItems.push(r(x.id, x.label, fmt(amt) + ' g', buy));
        }
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
      $('cartBar').style.width = total > 0 ? (count / total) * 100 + '%' : '0%';
      $('cartResetRow').hidden = count === 0;
    }

    const REF_KEYS = [
      ['kcal', 'kcal'],
      ['p', 'P'],
      ['g', 'G'],
      ['l', 'L']
    ];

    function foodRefGroups() {
      const order = NE.RULE_CONFIG.foodsGroupOrder || ['Protéines', 'Glucides', 'Lipides', 'Légumes'];
      const map = {};
      order.forEach((g) => {
        map[g] = [];
      });
      Object.keys(FOODS_DEFAULT).forEach((id) => {
        const F = FOODS_DEFAULT[id];
        if (!F || F.hidden) return;
        const g = F.group || 'Autres';
        if (!map[g]) map[g] = [];
        map[g].push(id);
      });
      return Object.keys(map)
        .filter((g) => map[g].length > 0)
        .map((g) => [g, map[g]]);
    }

    function buildFoodRef() {
      if (!$('foodRef')) return;
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
          ).join('')}</div></div>`;
              })
              .join('')
        )
        .join('');
    }

    function renderFoodRef() {
      if (!$('foodRef')) return;
      let any = false;
      foodRefGroups().forEach(([, list]) =>
        list.forEach((f) => {
          const mod = Object.keys((st.foods || {})[f] || {}).length > 0;
          any = any || mod;
          const tag = $('refTag-' + f);
          if (!tag) return;
          tag.textContent = mod ? 'modifié' : (FOODS_DEFAULT[f] && FOODS_DEFAULT[f].badge) || 'Table';
          tag.classList.toggle('is-mod', mod);
        })
      );
      if ($('resetFoods')) $('resetFoods').hidden = !any;
    }

    function render() {
      if (st.phase !== 'seche' && st.phase !== 'maintien') st.phase = 'seche';
      if (st.tab === 'kcal') st.tab = 'repas';
      $('app').dataset.day = viewDay();
      const raw = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      $('date').textContent = raw.charAt(0).toUpperCase() + raw.slice(1);
      $('screenTitle').textContent = TITLES[st.tab] || 'Repas';

      const phaseBtn = $('phaseToggleBtn');
      if (phaseBtn) {
        phaseBtn.hidden = st.tab === 'seance';
        phaseBtn.textContent = st.phase === 'seche' ? 'Cut' : 'Maintien';
      }

      $('cycBar').hidden = st.tab === 'courses';

      TABS.forEach((t) => {
        if ($('view-' + t)) $('view-' + t).hidden = st.tab !== t;
      });
      document.querySelectorAll('.tab').forEach((b) => {
        if (b.dataset.tab === st.tab) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });

      if (st.tab !== 'courses') renderCycle();
      if (st.tab === 'repas') {
        renderRepas();
        renderFoodRef();
      } else if (st.tab === 'seance') {
        renderSeance();
      } else if (st.tab === 'courses') {
        renderCourses();
      }
    }

    // ==========================================================================
    // 8. MINUTEUR DE REPOS (AudioContext + WakeLock) & TOAST
    // ==========================================================================

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

    // ==========================================================================
    // 9. ÉCOUTEURS D'ÉVÉNEMENTS & DÉMARRAGE
    // ==========================================================================

    document.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      const d = t.dataset;

      if (d.copyMeal) {
        copyMealForFoodvisor(d.copyMeal, t);
        return;
      }
      if (t.id === 'copyMealsBtn') {
        copyAllMeals(t);
        return;
      }
      if (t.id === 'copySplitBtn') {
        copyFullSplit(t);
        return;
      }
      if (t.id === 'timerAdd') {
        if (timer) {
          timer.end = Math.max(Date.now(), timer.end) + 30000;
          timer.total += 30;
          timer.doneAt = null;
          updateTimer();
        }
        return;
      } else if (t.id === 'timerSkip') {
        stopTimer();
        return;
      } else if (d.calcAct) {
        calcSt.act = d.calcAct;
        renderKcal();
        return;
      } else if (d.calcGoal) {
        calcSt.goal = d.calcGoal;
        renderKcal();
        return;
      } else if (d.calcPace) {
        calcSt.pace = d.calcPace;
        renderKcal();
        return;
      } else if (t.id === 'applyCalcBtn') {
        const c = computeCalcKcal();
        st.targets = st.targets || {};
        st.targets[st.phase] = { on: c.on, off: c.off };
        syncTodayKcalLog();
        save();
        render();
        showToast(`Objectif appliqué : ${fmt(c.on)} ON / ${fmt(c.off)} OFF ✓`);
        return;
      } else if (t.id === 'resetTargetsBtn') {
        if (st.targets) delete st.targets[st.phase];
        syncTodayKcalLog();
        save();
        render();
        showToast('Objectif remis à 2 200 ON / 2 000 OFF ✓');
        return;
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
      } else if (t.id === 'deloadBtn') {
        const next = !deloadOn();
        st.deloadUntil = next ? fromNo(dayNo(today) + CYCLE.length) : null;
        showToast(next ? `Deload activé (${CYCLE.length} jours)` : 'Deload désactivé');
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
        const dl = deloadOn();
        const nSets = setsFor(exo, dl);
        const nNorm = nSets - techSteps(techOf(exo, dl));
        for (let k = 0; k < nSets; k++) {
          st.log.done[`${d.setall}|${k}`] = true;
        }
        recordHist(exo.n, collectLoggedReps(d.setall, nNorm));
        startRest(exo.rest, exo.n);
      } else if (d.set) {
        const now = !st.log.done[d.set];
        st.log.done[d.set] = now;
        const p = d.set.split('|');
        const exo = resolveEx(p[0], p[1], activeViewIdx());
        if (now) {
          const dl = deloadOn();
          const tech = techOf(exo, dl);
          const tSteps = techSteps(tech);
          const nNorm = setsFor(exo, dl) - tSteps;
          const prefix = p.slice(0, -1).join('|');
          recordHist(exo.n, collectLoggedReps(prefix, nNorm));
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
      } else if (t.id === 'exportFoodsBtn') {
        const merged = {};
        Object.keys(FOODS_DEFAULT).forEach((id) => {
          merged[id] = Object.assign({}, FOODS_DEFAULT[id], (st.foods && st.foods[id]) || {});
        });
        const payload = JSON.stringify({ unit: 'pour 100 g', foods: merged }, null, 2) + '\n';
        if (window.showSaveFilePicker) {
          window
            .showSaveFilePicker({
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
      } else if (t.id === 'resetFoods') {
        if (!confirm('Remettre les valeurs par défaut ?')) return;
        st.foods = {};
        save();
        buildFoodRef();
        showToast('Valeurs par défaut rétablies');
      } else if (d.tab && TABS.includes(d.tab)) {
        st.tab = d.tab;
        window.scrollTo(0, 0);
      } else return;

      save();
      render();
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
      if (el.dataset.food) {
        const [f, k] = el.dataset.food.split('|');
        const v = num(el.value);
        st.foods = st.foods || {};
        const o = (st.foods[f] = Object.assign({}, st.foods[f]));
        if (el.value.trim() === '' || v === FOODS_DEFAULT[f][k]) delete o[k];
        else if (isFinite(v) && v >= 0 && v <= (k === 'kcal' ? 900 : 100)) o[k] = v;
        else return;
        if (!Object.keys(o).length) delete st.foods[f];
        save();
        render();
        return;
      }
      if (el.dataset.load) {
        const v = num(el.value);
        if (el.value.trim() === '') delete st.loads[el.dataset.load];
        else if (isFinite(v) && v >= 0) st.loads[el.dataset.load] = v;
        save();
        return;
      }
      if (el.dataset.rep) {
        st.log.reps = st.log.reps || {};
        const raw = el.value.trim();
        const v = Number(raw);
        if (raw === '') delete st.log.reps[el.dataset.rep];
        else if (isFinite(v) && v > 0 && v <= 99) st.log.reps[el.dataset.rep] = Math.round(v);
        const exName = el.dataset.repex;
        const prefix = el.dataset.repprefix;
        const nNorm = Number(el.dataset.repnorm) || 0;
        if (exName && prefix && nNorm > 0) {
          recordHist(exName, collectLoggedReps(prefix, nNorm));
        }
        save();
      }
    });

    document.addEventListener('focusout', (e) => {
      if (e.target && e.target.dataset && e.target.dataset.qty) {
        render();
        return;
      }
      if (e.target && e.target.dataset && e.target.dataset.food) {
        const [f, k] = e.target.dataset.food.split('|');
        const F = food(f);
        e.target.value = k === 'kcal' ? Math.round(F[k]) : n1(F[k]);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && timer) {
        keepAwake(true);
        updateTimer();
      }
    });

    buildFoodRef();
    render();
  }

  initApp();
})();
