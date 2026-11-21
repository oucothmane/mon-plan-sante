/* ==========================================================================
   Mon Plan Santé — Logique minimaliste (app.js)
   Parcours épuré en 5 onglets :
   1. Repas (Mes 3 repas du jour, macros, remplacement viande/poisson, −/+)
   2. Séance (Exercices du jour, minuteur auto, carnet de charges)
   3. Courses (Panier 3 / 7 / 10 jours)
   4. Poids (Semaine, moyenne et conseil en direct, courbe)
   5. Réglages (Objectif Sèche/Maintien, Calories, Apparence, Données)
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
    repas: 'Mes repas',
    seance: 'Ma séance',
    courses: 'Mes courses',
    suivi: 'Mon poids',
    reglages: 'Réglages'
  };

  // ==========================================================================
  // 2. ALIMENTS (CIQUAL 2025) & MODÈLES DE REPAS
  // ==========================================================================

  const NE = window.NutritionEngine;
  const FOODS_DEFAULT = NE.FOOD_DB;

  const CAPS = { rice: 120, pasta: 120, sweet_potato: 250, raisins: 55, honey: 35 };
  const TARGETS = { seche: { on: 2300, off: 2100 }, maintien: { on: 2500, off: 2300 } };
  const KCAL_MIN = 1500;
  const KCAL_MAX = 4500;
  const PROTS = [
    ['chicken', 'Poulet'],
    ['turkey', 'Dinde'],
    ['cod', 'Cabillaud'],
    ['beef5', 'Bœuf 5 %']
  ];
  const GRAINS = [
    ['rice', 'Riz cru'],
    ['pasta', 'Pâtes complètes']
  ];

  const PROFILE_DEFAULT = Object.assign(
    { auto: true, stagnating: false, dietAdhered: true },
    NE.DEFAULT_PROFILE
  );

  // ==========================================================================
  // 3. PROGRAMME D'ENTRAÎNEMENT (4 SÉANCES SUR 8 JOURS & JOURS OFF)
  // ==========================================================================

  const ex = (m, n, note, sets, reps, rir, rest, restTxt, opt) => ({
    m,
    n,
    note: note || '',
    sets,
    reps,
    rir,
    rest,
    restTxt: restTxt || '',
    opt: !!opt
  });

  const ISO_RIR = 'RIR 0';
  const R_POLY = '8–12';
  const R_ISO = '12–15';

  const poly = (m, n, note, sets, reps, rir, rest, restTxt) =>
    Object.assign(ex(m, n, note, sets, reps, rir || 'RIR 1–2', rest || 180, restTxt), { poly: true });

  const iso = (m, n, note, sets, reps, rir, rest, restTxt, opt) =>
    ex(m, n, note, sets, reps, rir || ISO_RIR, rest || 90, restTxt, opt);

  const TECH_STEPS = 2;
  const TECH = {
    drop: {
      k: 'D',
      n: 'dropset',
      N: 'Dropset',
      steps: 2,
      tip: 'Dropset (2 paliers sur la dernière série) : à l’échec (RIR 0), −25/30 % sans repos × 2'
    },
    rp: {
      k: 'RP',
      n: 'rest-pause',
      N: 'Rest-pause',
      steps: 2,
      tip: 'Rest-pause (2 paliers sur la dernière série) : à l’échec, (15 s de pause même charge + reps propres) × 2'
    },
    lp: {
      k: 'PE',
      n: 'partielles étirées',
      N: 'Partielles étirées',
      steps: 1,
      tip: 'Partielles étirées : à l’échec en amplitude complète, enchaîne 3–5 demi-reps propres en bas du mouvement (étirement max)'
    }
  };

  const RP_REST = 15;
  const techSteps = (tech) => (tech ? tech.steps || TECH_STEPS : 0);
  const withTech = (e, t) => Object.assign(e, { tech: t, sets: e.sets + techSteps(TECH[t]) });
  const techOf = (e, dl) => (dl ? null : TECH[e.tech] || null);

  const SESSIONS = {
    PecsBiceps: {
      short: 'Pecs',
      title: '🔵 Pecs & Biceps',
      sub: '15 séries · ~45 min',
      ex: [
        poly('Pecs', 'Développé incliné machine', 'Haut des pecs · coudes au niveau du buste en bas', 3, R_POLY, 'RIR 2 → 1', 120),
        poly('Pecs', 'Développé machine convergente', 'Milieu des pecs · épaules basses', 3, R_POLY, 'RIR 2 → 1', 120),
        withTech(
          iso('Pecs', 'Pec deck', 'Étirement contrôlé · dernière série dropset 2 paliers (−25/30 %)', 3, R_ISO, 'RIR 1 → 0 + Dropset', 90),
          'drop'
        ),
        withTech(
          iso('Biceps', 'Curl Bayesian poulie', 'Coude en arrière (étirement max) · dernière série rest-pause 2 paliers (15 s)', 3, '10–12', 'RIR 1 → 0 + Rest-Pause', 90),
          'rp'
        ),
        iso('Biceps', 'Curl Hammer poulie (corde)', 'Brachial / biceps · prise neutre, zéro balancement', 3, R_ISO, 'RIR 1 → 0', 90)
      ]
    },
    DosTriceps: {
      short: 'Dos',
      title: '🟢 Dos & Triceps',
      sub: '15 séries · ~45 min',
      ex: [
        poly('Dos', 'Tirage vertical prise neutre', 'Largeur · poitrine sortie, coudes vers les hanches', 3, R_POLY, 'RIR 2 → 1', 120),
        poly('Dos', 'Rowing machine poitrine appuyée', 'Épaisseur · poitrine calée, tire les coudes en arrière', 3, R_POLY, 'RIR 2 → 1', 120),
        withTech(
          poly('Dos', 'Rowing machine prise large', 'Haut du dos · dernière série rest-pause 2 paliers (15 s)', 3, '10–12', 'RIR 1 → 0 + Rest-Pause', 120),
          'rp'
        ),
        withTech(
          iso('Triceps', 'Extension triceps overhead poulie', 'Chef long étiré · dernière série dropset 2 paliers (−25/30 %)', 3, R_ISO, 'RIR 1 → 0 + Dropset', 90),
          'drop'
        ),
        iso('Triceps', 'Extension triceps corde', 'Coudes fixes le long du buste', 3, R_ISO, 'RIR 1 → 0', 90)
      ]
    },
    JambesMollets: {
      short: 'Jambes',
      title: '🟠 Jambes & Mollets',
      sub: '15 séries · ~45 min',
      ex: [
        poly('Quads', 'Presse à cuisses', 'Pieds à plat, genoux dans l’axe, fesses collées', 3, R_POLY, 'RIR 2 → 2', 150),
        poly('Ischios', 'RDL haltères', 'Sangles OK · dos plat, hanches en arrière', 3, R_POLY, 'RIR 2 → 2', 150),
        withTech(
          iso('Quads', 'Leg extension', 'Dernière série dropset 2 paliers (−25/30 %)', 3, R_ISO, 'RIR 1 → 0 + Dropset', 90),
          'drop'
        ),
        iso('Ischios', 'Leg curl assis', 'Pause 1 s en étirement · option 2–3 demi-reps étirées en fin de série', 3, R_ISO, 'RIR 1 → 0', 90),
        withTech(
          iso('Mollets', 'Mollets jambes tendues', 'Pause 2 s en bas · dernière série + 3–5 partielles en position étirée', 3, '10–15', 'RIR 1 → 0 + Partielles', 90),
          'lp'
        )
      ]
    },
    EpaulesAvantBras: {
      short: 'Épaules',
      title: '🟣 Épaules & Avant-bras',
      sub: '15 séries · ~45 min',
      ex: [
        withTech(
          iso(
            'Épaule lat.',
            'Élévations latérales poulie unilat.',
            'Repos après les 2 côtés · dernière série dropset 2 paliers (−25/30 %)',
            3,
            R_ISO,
            'RIR 1 → 0 + Dropset',
            90
          ),
          'drop'
        ),
        iso('Épaule post.', 'Reverse pec deck', 'Mouvement contrôlé sans élan', 3, R_ISO, 'RIR 1 → 0', 90),
        poly('Épaules', 'Développé militaire machine', 'Épaules ant. / global · gainage solide', 3, R_POLY, 'RIR 2 → 1', 120),
        iso('Avant-bras', 'Wrist curl poulie', 'Enrouler depuis le bout des doigts', 3, R_ISO, 'RIR 1 (contrôlé)', 60),
        withTech(
          iso(
            'Avant-bras',
            'Reverse curl poulie (barre EZ)',
            'Brachioradial · dernière série rest-pause 2 paliers (15 s)',
            3,
            R_ISO,
            'RIR 1 (contrôlé) + Rest-Pause',
            60
          ),
          'rp'
        )
      ]
    }
  };

  const DEFAULT_KG = {
    'Presse à cuisses': 140,
    'RDL haltères': 30,
    'Leg extension': 60,
    'Leg curl assis': 55,
    'Mollets jambes tendues': 10,
    'Développé incliné machine': 40,
    'Développé machine convergente': 50,
    'Pec deck': 45,
    'Curl Bayesian poulie': 12.5,
    'Curl Hammer poulie (corde)': 15,
    'Tirage vertical prise neutre': 65,
    'Rowing machine prise large': 45,
    'Rowing machine poitrine appuyée': 45,
    'Extension triceps overhead poulie': 25,
    'Extension triceps corde': 30,
    'Élévations latérales poulie unilat.': 5,
    'Reverse pec deck': 25,
    'Wrist curl poulie': 15,
    'Reverse curl poulie (barre EZ)': 10
  };

  const defKg = (e) => DEFAULT_KG[e.n];
  const STEP5 = ['Presse à cuisses', 'RDL haltères'];
  const stepFor = (e) => (STEP5.indexOf(e.n) >= 0 ? 5 : 2.5);

  const CYCLE = [
    'PecsBiceps',
    null,
    'DosTriceps',
    null,
    'JambesMollets',
    null,
    'EpaulesAvantBras',
    null
  ];

  const PSOAS = { n: 'Étirement psoas', d: '2 × 45 s/côté' };
  const BIRD_DOG = { n: 'Bird dog', d: '3 × 15–20' };
  const RECOVERY = [
    [PSOAS, BIRD_DOG, { n: 'Planche', d: '3 × 45–60 s' }],
    [PSOAS, BIRD_DOG, { n: 'Crunch', d: '3 × 15–20' }]
  ];
  const OFF_DAYS = CYCLE.map((x, k) => (x ? -1 : k)).filter((k) => k >= 0);
  const recoveryFor = (i) => RECOVERY[Math.max(0, OFF_DAYS.indexOf(i)) % RECOVERY.length];

  // ==========================================================================
  // 4. RÈGLES DE DÉCISION (POIDS)
  // ==========================================================================

  const ADJ = { slow: -1, up: -1, fast: 1, down: 1 };
  const STEP = { rice: 5, pasta: 5, sweet_potato: 25, raisins: 5, honey: 5 };
  const SOURCES = [
    { f: 'rice', step: 25, n: 'riz', N: 'Riz' },
    { f: 'sweet_potato', step: 100, n: 'patate douce', N: 'Patate douce' },
    { f: 'raisins', step: 30, n: 'raisins secs', N: 'Raisins' },
    { f: 'honey', step: 25, n: 'miel', N: 'Miel' }
  ];

  function decisions(phase) {
    if (phase === 'maintien' || phase === 'diet_break') {
      return {
        rows: [
          { id: 'ok', diag: 'Maintien validé', action: 'Poids stable : garde le menu actuel.' },
          { id: 'up', diag: 'Légère hausse', action: 'Pour baisser d’environ 90 kcal / jour :' },
          { id: 'down', diag: 'Légère baisse', action: 'Pour ajouter environ 90 kcal / jour :' }
        ]
      };
    }
    return {
      rows: [
        { id: 'ok', diag: 'Rythme optimal', action: 'Perte idéale : ne change rien.' },
        { id: 'slow', diag: 'Perte lente / Stagnation', action: 'Ajustement recommandé :' },
        { id: 'fast', diag: 'Perte rapide', action: 'Pour protéger ta testo et ton muscle :' }
      ]
    };
  }

  function diagnose(phase, d) {
    if (phase === 'maintien' || phase === 'diet_break') {
      if (Math.abs(d) <= 0.3) return 'ok';
      return d > 0 ? 'up' : 'down';
    }
    const loss = -d;
    if (loss >= 0.4 && loss <= 1.1) return 'ok';
    if (loss < 0.4) return 'slow';
    if (loss > 1.1) return 'fast';
    return 'edge';
  }

  // ==========================================================================
  // 5. ÉTAT DE L'APPLICATION (LOCALSTORAGE)
  // ==========================================================================

  const KEY = 'mon-plan-repas-v1';
  const TABS = ['repas', 'seance', 'courses', 'suivi', 'reglages'];

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
    log: { date: today, done: {} },
    deloadUntil: null,
    loads: {},
    hist: {},
    weights: {},
    waist: {},
    eatenLog: {},
    kcalLog: {},
    lastExport: '',
    shopDays: 8,
    foods: {},
    qty: {},
    targets: {},
    profile: Object.assign({}, PROFILE_DEFAULT),
    adj: { seche: {}, transition: {}, maintien: {}, diet_break: {} }
  };

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) st = Object.assign(st, JSON.parse(raw));
  } catch (e) {}

  st.foods = st.foods || {};
  st.qty = st.qty || {};
  st.targets = st.targets || {};
  st.swap = st.swap || {};
  st.loads = st.loads || {};
  st.hist = st.hist || {};
  st.weights = st.weights || {};
  st.waist = st.waist || {};
  st.eatenLog = st.eatenLog || {};
  st.kcalLog = st.kcalLog || {};
  if (st.shopDays === 7 || st.shopDays === 3) st.shopDays = 8;
  st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
  st.adj = Object.assign({ seche: {}, transition: {}, maintien: {}, diet_break: {} }, st.adj);

  // Migration douce des anciens IDs de swap/profile
  const SWAP_MIG = { poulet: 'chicken', dinde: 'turkey', cabillaud: 'cod', boeuf: 'beef5', riz: 'rice', pates: 'pasta' };
  Object.keys(st.swap).forEach((k) => {
    if (SWAP_MIG[st.swap[k]]) st.swap[k] = SWAP_MIG[st.swap[k]];
  });
  if (st.profile.weight && !st.profile.currentWeightKg) st.profile.currentWeightKg = st.profile.weight;
  if (st.profile.height && !st.profile.heightCm) st.profile.heightCm = st.profile.height;
  if (st.profile.activity && !st.profile.activityFactor) st.profile.activityFactor = st.profile.activity;

  if (st.cycleLen !== CYCLE.length) {
    st.cycleLen = CYCLE.length;
    st.cycleStart = null;
    st.viewIdx = 0;
    st.dayAutoDate = '';
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
    return NE.computeRollingWeight(entries, profile().currentWeightKg, today);
  }

  function currentWeight() {
    return rollingWeight().weightKg;
  }

  function startWeight() {
    const p = profile();
    if (p.startWeightKg != null && isFinite(Number(p.startWeightKg)) && Number(p.startWeightKg) > 30) {
      return Number(p.startWeightKg);
    }
    const dates = Object.keys(st.weights || {})
      .filter((d) => isFinite(st.weights[d]) && d <= today)
      .sort();
    return dates.length ? Number(st.weights[dates[0]]) : Number(p.currentWeightKg) || 99;
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

  const tgt = (ph, d) => {
    const c = customTarget(ph, d);
    if (c !== null) return c;
    return (TARGETS[ph] || TARGETS.seche)[d];
  };

  function engineProfile(phase) {
    const ph = phase || st.phase;
    return Object.assign({}, profile(), {
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
    const c = avgRange(0, 6);
    const p1 = avgRange(7, 13);
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

  const QTY_STEP = {
    eggs: 55,
    chicken: 10,
    turkey: 10,
    cod: 10,
    beef5: 10,
    rice: 10,
    pasta: 10,
    sweet_potato: 25,
    veggies: 25,
    avocado: 10,
    olive_oil: 5,
    whey: 5,
    raisins: 5,
    honey: 5,
    peanut_butter: 5,
    walnuts: 5,
    dark_choc: 5
  };

  function qtyMap(phase, day) {
    return ((st.qty || {})[phase] || {})[day] || {};
  }

  function buildDay(phase, day) {
    const overrideKcal = tgt(phase, day);
    const plan = NE.buildMealPlan(engineProfile(phase), day, {
      foodOverrides: st.foods,
      swaps: st.swap,
      usePasta: st.swap.grain === 'pasta',
      overrideKcal
    });

    // Garder tous les aliments du plan visibles (même à 0 g) pour ajustement libre façon Yazio
    const ensureFood = (meal, f) => {
      if (!meal.items.some((i) => i.f === f)) {
        const info = food(f);
        meal.items.push({ f, n: info.n, g: 0, kcal: 0, p: 0, carbs: 0, l: 0, fib: 0 });
      }
    };
    const mMidi = plan.meals.find((m) => m.id === 'midi');
    const mShake = plan.meals.find((m) => m.id === 'collation');
    const mSoir = plan.meals.find((m) => m.id === 'soir');
    if (mMidi) ensureFood(mMidi, 'olive_oil');
    if (mShake) {
      ensureFood(mShake, 'raisins');
      ensureFood(mShake, 'honey');
      ensureFood(mShake, 'walnuts');
    }
    if (mSoir) {
      ensureFood(mSoir, 'olive_oil');
      ensureFood(mSoir, 'avocado');
    }

    const qm = qtyMap(phase, day);
    const adj = (st.adj && st.adj[phase]) || {};
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
        } else if (adj[i.f]) {
          i.g = Math.min(CAPS[i.f] || 9999, Math.max(0, i.g + adj[i.f]));
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
      targetCarbs,
      fiberTargetG: plan.fiberTargetG,
      lowFiber: tot.fib < 25,
      hasCustom,
      N: plan.targets
    };
  }

  // ==========================================================================
  // 7. RENDU : REPAS, CYCLE & SÉANCE
  // ==========================================================================

  let swapOpen = null;

  function itemHint(i) {
    switch (i.f) {
      case 'eggs': {
        const n = Math.round((i.g / 56.7) * 2) / 2;
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
    const stp = QTY_STEP[i.f] || 5;
    const k = Math.round((food(i.f).kcal * i.g) / 100);
    return `<span class="item-q stepper">
      <button type="button" class="step-btn" data-qstep="${key}|-${stp}" aria-label="Moins"${i.g <= 0 ? ' disabled' : ''}>−</button>
      <span class="q-col">
        <span class="qty-wrap"><input type="text" inputmode="numeric" autocomplete="off" class="qty-in${i.custom ? ' is-custom' : ''}" data-qty="${key}" value="${i.g}" aria-label="${food(i.f).n} en grammes"><i>g</i></span>
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
        open ? 'Choisis ta viande / poisson' : 'Remplacer'
      }</small></span>
          </button>
          ${qtyControl(i, m)}
        </div>${chips}
      </li>`;
    }

    if (GRAINS.some((x) => x[0] === i.f)) {
      const open = swapOpen === 'grain';
      const chips = open
        ? `<div class="swap-chips" role="group" aria-label="Remplacer par">${GRAINS.map(
            (x) =>
              `<button type="button" class="chip" data-swap="grain|${x[0]}" aria-pressed="${
                x[0] === i.f
              }">${x[1]}</button>`
          ).join('')}</div>`
        : '';
      return `<li class="swap-li">
        <div class="swap-row">
          <button type="button" class="swap-btn" data-swap-open="grain" aria-expanded="${open}">
            <span class="item-name"><span>${F.n}</span><small>${
        open ? 'Riz cru ou pâtes complètes' : 'Remplacer'
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
      <article class="card meal">
        <div class="meal-head">
          <span class="meal-num" aria-hidden="true">${m.num}</span>
          <div class="meal-title"><h2>${m.name}</h2><span>${m.sub}</span></div>
          <span class="meal-kcal" data-mkcal="${m.id}">${fmt(m.kcal)} kcal</span>
        </div>
        <ul class="items">${m.items.map((i) => itemView(i, m)).join('')}</ul>
        ${supp}
        <div class="meal-foot">
          <button type="button" class="done-btn" data-meal="${m.id}" aria-pressed="${done}">${CHECK}<span>${
      done ? 'Mangé' : 'Valider ce repas'
    }</span></button>
        </div>
      </article>`;
  }

  function updateRepasSummary(P) {
    const t = P.tot;
    const p = profile();
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

    const needBanner =
      (st.phase === 'seche' && (P.N.nearTarget || P.N.missingCardioKcal > 0)) ||
      p.extraDailySteps > 0 ||
      p.extraWeeklyZone2Sessions > 0;
    $('cardioNote').hidden = !needBanner;
    if (needBanner) {
      const parts = [];
      if (st.phase === 'seche' && P.N.nearTarget) {
        parts.push(`Objectif ${p.targetWeightKg} kg atteint ! Demande au Coach IA (onglet Poids) pour la remontée vers le Maintien.`);
      } else if (st.phase === 'seche' && P.N.missingCardioKcal > 0) {
        const lossTxt = String(Math.round(P.N.weeklyLossKg * 100) / 100).replace('.', ',');
        parts.push(
          `À ${fmt(P.N.effectiveIntakeKcal)} kcal/j en moyenne : +${fmt(P.N.recommendedExtraSteps)} pas/j (ou ${P.N.recommendedZone2MinPerDay} min cardio léger/j) pour tenir −${lossTxt} kg/sem`
        );
      }
      if (p.extraDailySteps > 0) parts.push(`Palier actif : +${fmt(p.extraDailySteps)} pas/j`);
      if (p.extraWeeklyZone2Sessions > 0) parts.push(`+${p.extraWeeklyZone2Sessions} Zone 2/sem`);
      $('cardioNote').textContent = parts.join(' · ');
    }

    const pk = t.p * 4;
    const gk = t.g * 4;
    const lk = t.l * 9;
    const tot = Math.max(1, pk + gk + lk);
    $('barP').style.width = (pk / tot) * 100 + '%';
    $('barG').style.width = (gk / tot) * 100 + '%';
    $('barL').style.width = (lk / tot) * 100 + '%';
    $('mP').textContent = `${Math.round(t.p)} / ${P.N.proteinG} g`;
    $('mG').textContent = `${Math.round(t.g)} / ${P.targetCarbs} g`;
    $('mL').textContent = `${Math.round(t.l)} / ${P.N.fatG} g`;
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
  const setsFor = (e, dl) => (dl ? Math.min(2, e.sets) : e.sets);
  const unfolded = new Set();

  const resolveEx = (s, slot) => SESSIONS[s].ex[Number(slot)];

  function exHTML(s, e, i, dl, slot) {
    const nSets = setsFor(e, dl);
    const lt = lastTime(e.n);
    const tech = techOf(e, dl);
    const tSteps = techSteps(tech);
    const nNorm = tech ? nSets - tSteps : nSets;
    let all = true;

    const sets = Array.from({ length: nSets }, (_, k) => {
      const key = `${s}|${slot}|${k}`;
      const d = !!st.log.done[key];
      if (!d) all = false;
      const isTech = !!tech && k >= nNorm;
      return `<button type="button" class="set-btn" data-set="${key}" aria-pressed="${d}">${
        d ? CHECK_SM : isTech ? tech.k : k + 1
      }</button>`;
    }).join('');

    const id = `${s}|${slot}`;
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
        ${lt ? `<p class="ex-last">Dernière fois : ${fmtKg(lt.kg)} kg (${shortDate(lt.d)})</p>` : ''}
        ${all ? `<button type="button" class="link-btn ex-refold" data-unfold="${id}">Replier</button>` : ''}
      </article>`;
  }

  function renderSeance() {
    const ti = cycleIdx();
    const vi = ti !== null ? viewIdx() : st.viewIdx || 0;
    const dl = deloadOn();

    const s = CYCLE[vi];
    $('sessionBox').hidden = !s;
    $('recoveryBox').hidden = !!s;
    if (s) {
      const S = SESSIONS[s];
      let total = 0;
      let done = 0;
      S.ex.forEach((e, i) => {
        if (e.opt) return;
        const n = setsFor(e, dl) - techSteps(techOf(e, dl));
        for (let k = 0; k < n; k++) {
          total++;
          if (st.log.done[`${s}|${i}|${k}`]) done++;
        }
      });
      $('deloadTag').hidden = !dl;
      const cards = S.ex.map((e, i) => (dl && e.opt ? '' : exHTML(s, e, i, dl, String(i))));
      $('exList').innerHTML = cards.join('');
      $('setCount').textContent = `${done} / ${total}`;
      $('setBar').style.width = (done / total) * 100 + '%';
      $('deloadBtn').setAttribute('aria-checked', String(dl));
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
      $('loadsSummary').innerHTML = Object.keys(SESSIONS)
        .map((sessKey) => {
          const S = SESSIONS[sessKey];
          return `<div class="loads-group">${S.title}</div>` + S.ex.map(loadRow).join('');
        })
        .join('');
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
    const ml = Math.round(g('olive_oil') / 0.916 / 5) * 5;
    const nEggs = Math.ceil(g('eggs') / 56.7 - 0.001);
    const r = (id, n, need, buy) => ({ id, n, need, buy });

    const grocery = [
      ...[
        ['rice', 'Riz cru'],
        ['pasta', 'Pâtes complètes']
      ]
        .filter((x) => g(x[0]) > 0)
        .map((x) => r(x[0], x[1], fmt(g(x[0])) + ' g', packs(g(x[0]), 500, 'paquet 500 g', 'paquets 500 g'))),
      ...(ml > 0
        ? [r('olive_oil', "Huile d'olive", '~' + ml + ' ml', ml <= 500 ? '1 bouteille 50 cl' : '1 bouteille 1 L')]
        : []),
      ...(g('raisins') > 0
        ? [r('raisins', 'Raisins secs', fmt(g('raisins')) + ' g', packs(g('raisins'), 250, 'sachet 250 g', 'sachets 250 g'))]
        : []),
      ...(g('honey') > 0
        ? [r('honey', "Miel d'acacia", fmt(g('honey')) + ' g', packs(g('honey'), 250, 'pot 250 g', 'pots 250 g'))]
        : []),
      r(
        'peanut_butter',
        'Beurre de cacahuète',
        fmt(g('peanut_butter')) + ' g',
        packs(g('peanut_butter'), 350, 'pot 350 g', 'pots 350 g')
      ),
      ...(g('walnuts') > 0
        ? [r('walnuts', 'Noix de Grenoble', fmt(g('walnuts')) + ' g', packs(g('walnuts'), 150, 'sachet 150 g', 'sachets 150 g'))]
        : []),
      r(
        'dark_choc',
        'Chocolat noir 90 %',
        fmt(g('dark_choc')) + ' g',
        packs(g('dark_choc'), 100, 'tablette', 'tablettes')
      )
    ];

    return [
      {
        title: 'Frais',
        items: [
          ...[
            ['chicken', 'Blanc de poulet', 1.08],
            ['turkey', 'Escalopes de dinde', 1],
            ['cod', 'Cabillaud', 1],
            ['beef5', 'Bœuf haché 5 %', 1]
          ]
            .filter((x) => g(x[0]) > 0)
            .map((x) => r(x[0], x[1], fmt(g(x[0])) + ' g', '≈ ' + kgUp(g(x[0]) * x[2]))),
          r(
            'oeufs',
            'Œufs (calibre L)',
            nEggs + ' œufs',
            Math.max(1, Math.ceil(nEggs / 12)) +
              (Math.ceil(nEggs / 12) > 1 ? ' boîtes de 12' : ' boîte de 12')
          ),
          r('veggies', 'Légumes verts', fmt(g('veggies')) + ' g', '≈ ' + kgUp(g('veggies') * 1.1)),
          r('sweet_potato', 'Patate douce', fmt(g('sweet_potato')) + ' g', '≈ ' + kgUp(g('sweet_potato'))),
          ...(g('avocado') > 0
            ? [r('avocado', 'Avocats', fmt(g('avocado')) + ' g', packs(g('avocado'), 140, 'avocat', 'avocats'))]
            : [])
        ]
      },
      {
        title: 'Épicerie',
        items: grocery
      },
      {
        title: 'Compléments',
        items: [
          r('whey', 'Whey isolate', fmt(g('whey')) + ' g', 'Vérifier stock'),
          r('creatine', 'Créatine', fmt(g('creatine')) + ' g', 'Vérifier stock'),
          r('multi', 'Multivitamines & Oméga-3', 'Midi', 'Vérifier stock'),
          r('magnesium', 'Magnésium', 'Soir', 'Vérifier stock')
        ]
      }
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

  function renderSuivi() {
    const W = weekly();
    const ok = W.r1 != null;
    const p = profile();
    const rw = rollingWeight();
    const wa = waistInfo();
    const ep = engineProfile(st.phase);
    const N = NE.calculateTargets(ep);

    $('stagnateBtn').setAttribute('aria-pressed', String(!!p.stagnating));
    $('stagnateBtn').textContent = p.stagnating ? 'Stagnation signalée ✓' : 'Je stagne';
    $('dietAdhered').checked = p.dietAdhered !== false;
    $('sleepOk').checked = p.sleepOk !== false;

    if (document.activeElement !== $('waistInput')) {
      $('waistInput').value = st.waist[today] != null ? String(st.waist[today]).replace('.', ',') : wa.latest != null ? String(wa.latest).replace('.', ',') : '';
    }
    if (wa.delta != null) {
      const sign = wa.delta > 0 ? '+' : wa.delta < 0 ? '−' : '±';
      $('waistInfo').textContent = `${sign}${fmt1(Math.abs(wa.delta))} cm depuis le ${shortDate(wa.prevD)}`;
    } else if (wa.latest != null) {
      $('waistInfo').textContent = `Dernière mesure : ${fmt1(wa.latest)} cm (${shortDate(wa.latestD)})`;
    } else {
      $('waistInfo').textContent = 'Garde-fou contre la fausse stagnation (1×/sem)';
    }

    const ignTxt = rw.ignoredCount > 0 ? ` (${rw.ignoredCount} j sans repas cochés ignoré${rw.ignoredCount > 1 ? 's' : ''})` : '';
    const lossTxt = String(Math.round(N.weeklyLossKg * 100) / 100).replace('.', ',');
    if (W.c) {
      $('wInfo').innerHTML =
        `Moy. semaine : <b>${fmt1(rw.weightKg)} kg</b>${ignTxt}` +
        (W.p1 ? ` · Sem. −1 : ${fmt1(W.p1.avg)} kg` : '') +
        (st.phase === 'seche' ? ` · Cible : −${lossTxt} kg/sem` : '');
    } else {
      $('wInfo').textContent = `Pèse-toi à jeun (lun, mer, ven) · Poids actuel : ${fmt1(rw.weightKg)} kg → Objectif : ${fmt1(p.targetWeightKg)} kg`;
    }

    const ev = NE.evaluateStagnation(ep, W.r1, W.r0, !!p.stagnating, {
      waistDeltaCm: wa.delta,
      sleepUnder7h: p.sleepOk === false,
      effectiveOffKcal: tgt(st.phase, 'off')
    });
    const showResult = ok || !!p.stagnating || N.nearTarget;
    $('result').hidden = !showResult;
    $('adhereRow').hidden = !p.stagnating;
    $('sleepRow').hidden = !p.stagnating;

    if (showResult) {
      $('delta').textContent = ok
        ? (W.r1 > 0 ? '+' : W.r1 < 0 ? '−' : '±') + Math.abs(W.r1).toFixed(1).replace('.', ',') + ' kg / sem.'
        : N.nearTarget
        ? `${fmt1(rw.weightKg)} kg`
        : 'Stagnation';
      $('resDiag').textContent = ev.title;
      if (p.stagnating && p.dietAdhered === false) {
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

    const A = st.adj[st.phase] || {};
    const parts = [];
    SOURCES.forEach((x) => {
      if (A[x.f]) parts.push(`${x.n} ${A[x.f] > 0 ? '+' : '−'}${Math.abs(A[x.f])} g`);
    });
    $('adjBox').hidden = parts.length === 0;
    $('adjText').textContent = parts.join(' · ');

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
    $('wWeek').innerHTML = [6, 5, 4, 3, 2, 1, 0]
      .map((k) => {
        const d = fromNo(dayNo(today) - k);
        const v = st.weights[d];
        const dt = dateOf(d);
        return `<label class="wk-day${k === 0 ? ' is-today' : ''}"><span>${DOW[dt.getDay()]} ${dt.getDate()}</span>
        <input type="text" inputmode="decimal" autocomplete="off" data-wday="${d}"${
          v != null && String(v).length > 5 ? ' class="is-long"' : ''
        } value="${v != null ? String(v).replace('.', ',') : ''}" aria-label="${longDay(d)}"></label>`;
      })
      .join('');
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

    box.innerHTML = `
      <p class="wt-now"><b>${kgTxt(last.v)}</b><span>Tendance ${fmt1(last.trendKg)} kg · ${diffTxt}</span></p>
      <div class="wt-chart" tabindex="0">
        <svg viewBox="0 0 ${CW} ${CH}">
          ${grid}
          <text class="wt-tick" x="${CX0}" y="${CH - 8}">${shortDate(first.d)}</text>
          <text class="wt-tick" x="${CX1}" y="${CH - 8}" text-anchor="end">${shortDate(today)}</text>
          <path class="wt-raw" d="${pts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ')}"/>
          ${rawDots}
          <path class="wt-line" d="${pts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.ty).join(' ')}"/>
          <line class="wt-cross" id="wCross" x1="0" x2="0" y1="${CY0}" y2="${CY1}" style="display:none"/>
          <circle class="wt-dot" cx="${last.x}" cy="${last.ty}" r="4"/>
          <circle class="wt-dot" id="wHover" r="4" style="display:none"/>
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

  const REF_GROUPS = [
    ['Protéines', ['chicken', 'turkey', 'cod', 'beef5', 'eggs', 'whey']],
    ['Glucides', ['rice', 'pasta', 'sweet_potato', 'raisins', 'honey']],
    ['Lipides', ['olive_oil', 'avocado', 'peanut_butter', 'walnuts', 'dark_choc']],
    ['Légumes', ['veggies']]
  ];
  const REF_KEYS = [
    ['kcal', 'kcal'],
    ['p', 'P'],
    ['g', 'G'],
    ['l', 'L']
  ];

  function buildFoodRef() {
    $('foodRef').innerHTML = REF_GROUPS.map(
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
    ).join('');
  }

  function renderFoodRef() {
    const LABEL = { whey: 'étiquette', dark_choc: 'étiquette' };
    let any = false;
    REF_GROUPS.forEach(([, list]) =>
      list.forEach((f) => {
        const mod = Object.keys((st.foods || {})[f] || {}).length > 0;
        any = any || mod;
        const tag = $('refTag-' + f);
        tag.textContent = mod ? 'modifié' : LABEL[f] || 'Table';
        tag.classList.toggle('is-mod', mod);
        const F = food(f);
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
    const fields = [
      ['startWeightKg', 'Départ (kg)', startWeight(), 'decimal'],
      ['targetWeightKg', 'Objectif (kg)', p.targetWeightKg, 'decimal'],
      ['heightCm', 'Taille (cm)', p.heightCm, 'numeric'],
      ['age', 'Âge (ans)', p.age, 'numeric']
    ];
    $('profGrid').innerHTML = fields
      .map(
        ([k, lab, val, mode]) => `<label class="prof-field"><small>${lab}</small>
        <input type="text" inputmode="${mode}" autocomplete="off" data-prof="${k}" value="${String(val).replace('.', ',')}"></label>`
      )
      .join('');
  }

  function renderProfile() {
    const p = profile();
    const rw = rollingWeight();
    const sw = startWeight();
    const W = weekly();
    const wa = waistInfo();
    const ep = engineProfile(st.phase);
    const N = NE.calculateTargets(ep);
    const lossTxt = String(Math.round(N.weeklyLossKg * 100) / 100).replace('.', ',');

    $('lossBox').hidden = st.phase !== 'seche';
    const lossIn = $('lossRateInput');
    if (st.phase === 'seche') {
      if (document.activeElement !== lossIn) lossIn.value = lossTxt;
      document.querySelectorAll('[data-loss]').forEach((b) => {
        b.setAttribute('aria-pressed', String(Math.abs(Number(b.dataset.loss) - N.weeklyLossKg) < 0.01));
      });
    }

    const effOn = tgt(st.phase, 'on');
    const effOff = tgt(st.phase, 'off');
    const defTgt = TARGETS[st.phase] || TARGETS.seche;
    const avgChoice = Math.round((effOn + effOff) / 2);

    const onIn = $('myOnKcal');
    const offIn = $('myOffKcal');
    if (document.activeElement !== onIn) onIn.value = String(effOn);
    if (document.activeElement !== offIn) offIn.value = String(effOff);
    onIn.classList.toggle('is-custom', effOn !== defTgt.on);
    offIn.classList.toggle('is-custom', effOff !== defTgt.off);
    $('applyAdviceBtn').hidden = effOn === N.kcalOn && effOff === N.kcalOff;

    const ad = adaptiveInfo();
    $('profFoldTitle').textContent = `Mon profil (${fmt1(sw)} → ${fmt1(p.targetWeightKg)} kg · ${p.heightCm} cm · ${p.age} ans)`;
    $('planWeight').textContent =
      (W.c ? `Moyenne ${fmt1(rw.weightKg)} kg` : `Poids ${fmt1(rw.weightKg)} kg`) +
      ` · Tes repas : moy. ${fmt(avgChoice)} kcal/j` +
      (ad.ready ? ` · Maintien réel ~${fmt(ad.adaptiveTdee)}` : '');
    $('planKcal').textContent = `Équation : ${fmt(N.kcalOn)} ON · ${fmt(N.kcalOff)} OFF (moy. ${fmt(N.actualAvgKcal)})`;

    const ev = NE.evaluateStagnation(ep, W.r1, W.r0, !!p.stagnating, {
      waistDeltaCm: wa.delta,
      sleepUnder7h: p.sleepOk === false,
      effectiveOffKcal: effOff
    });

    let advice = '';
    if (st.phase === 'seche') {
      if (ev.status === 'stagnating' || ev.status === 'recomp' || ev.status === 'sleep' || ev.status === 'target_reached' || ev.status === 'fast') {
        advice = ev.message;
      } else if (N.missingCardioKcal > 0) {
        if (avgChoice > N.tdee) {
          advice = `À ${fmt(avgChoice)} kcal/j (au-dessus du maintien estimé ~${fmt(N.tdee)}), baisse tes repas ou ajoute ~+${fmt(N.recommendedExtraSteps)} pas/j pour viser −${lossTxt} kg/sem.`;
        } else {
          advice = `À ${fmt(avgChoice)} kcal/j (déficit repas −${fmt(N.foodDeficit)} kcal/j sur ~${fmt(N.tdee)}), ajoute ~+${fmt(N.recommendedExtraSteps)} pas/j (ou ${N.recommendedZone2MinPerDay} min cardio léger/j) pour tenir −${lossTxt} kg/sem.`;
        }
        if (N.isAggressiveLoss) advice += ` Rythme élevé (max conseillé ~${fmt1(N.maxSafeLossKg)} kg/sem).`;
      } else {
        advice = `À ${fmt(avgChoice)} kcal/j (déficit repas −${fmt(N.foodDeficit)} kcal/j sur ~${fmt(N.tdee)}) : pas besoin de cardio extra pour −${lossTxt} kg/sem · Prot ${N.proteinG} g · Lip ${N.fatG} g.`;
        if (N.isAggressiveLoss) advice += ` Rythme élevé (max conseillé ~${fmt1(N.maxSafeLossKg)} kg/sem).`;
      }
    } else if (ev.status === 'drift') {
      advice = ev.message;
    } else {
      advice = `Maintien actif à ${fmt(avgChoice)} kcal/j (estimation bureau + muscu ~${fmt(ad.ready ? ad.adaptiveTdee : N.tdee)} kcal/j) · Prot ${N.proteinG} g · Lip ${N.fatG} g.`;
    }
    $('planAdvice').textContent = advice;
    $('resetCardioBtn').hidden = !(p.extraDailySteps || p.extraWeeklyZone2Sessions);
  }

  function renderBackup() {
    if (!st.lastExport) {
      $('bkHint').textContent = 'Enregistré uniquement sur ton téléphone.';
      return;
    }
    $('bkHint').textContent = `Dernier export : ${shortDate(st.lastExport)}`;
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
    phaseBtn.hidden = st.tab === 'seance' || st.tab === 'reglages';
    phaseBtn.textContent = st.phase === 'seche' ? 'Cut' : 'Maintien';

    $('cycBar').hidden = st.tab === 'reglages' || st.tab === 'courses' || st.tab === 'suivi';

    document
      .querySelectorAll('[data-phase]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.phase === st.phase)));
    TABS.forEach((t) => {
      $('view-' + t).hidden = st.tab !== t;
    });
    document.querySelectorAll('.tab').forEach((b) => {
      if (b.dataset.tab === st.tab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });

    renderCycle();
    renderWeighCard();
    renderRepas();
    renderSeance();
    renderCourses();
    renderSuivi();
    renderCurve();
    renderBackup();
    renderProfile();
    renderFoodRef();
    renderAiCoach();
  }

  async function doExport() {
    const txt = JSON.stringify(
      { app: 'mon-plan-repas', v: 1, at: new Date().toISOString(), data: st },
      null,
      1
    );
    const name = `mon-plan-sante-${today}.json`;
    const done = () => {
      st.lastExport = today;
      save();
      render();
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
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      done();
    } catch (e) {
      alert('Export impossible.');
    }
  }

  function buildAiReportMd() {
    const clean = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const p = profile();
    const rw = rollingWeight();
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
    const ev = NE.evaluateStagnation(ep, W.r1, W.r0, !!p.stagnating, {
      waistDeltaCm: wa.delta,
      sleepUnder7h: p.sleepOk === false,
      effectiveOffKcal: effOff
    });

    const phaseLab = st.phase === 'seche' ? 'Cut' : 'Maintien';
    const sw = startWeight();
    const totalLost = Math.round((sw - rw.weightKg) * 10) / 10;
    const remToGoal = Math.round((rw.weightKg - p.targetWeightKg) * 10) / 10;
    const inTransitionZone = st.phase === 'seche' && remToGoal <= 1.5;
    const lossTxt = String(Math.round(N.weeklyLossKg * 100) / 100).replace('.', ',');
    const signKg = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(2).replace('.', ',') + ' kg/sem';

    const ad = adaptiveInfo();
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
      const head = `### ${label} — ${clean(t.kcal)} / ${clean(P.target)} kcal (P ${Math.round(t.p)}/${P.N.proteinG} g · G ${Math.round(t.g)}/${P.targetCarbs} g · L ${Math.round(t.l)}/${P.N.fatG} g · Fibres ${Math.round(t.fib)}/${P.fiberTargetG} g)`;
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

    const loadEntries = Object.keys(st.loads || {})
      .filter((k) => isFinite(num(st.loads[k])))
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

    return [
      `# Bilan Mon Plan Santé — ${longDate(today)}`,
      '',
      '## Rôle & Règles strictes du Coach IA',
      'Tu es mon coach nutrition et musculation fondé sur les preuves (précis, bienveillant, zéro jargon technique).',
      '- Mode de vie : travail de bureau assis toute la journée + musculation 1 jour sur 2 (Carb Cycling : Jour ON / Jour OFF).',
      `- Références choisies par moi : Cut par défaut **${clean(TARGETS.seche.on)} ON / ${clean(TARGETS.seche.off)} OFF** (moy. 2 200 kcal/j) · Maintien **${clean(TARGETS.maintien.on)} ON / ${clean(TARGETS.maintien.off)} OFF** (moy. 2 400 kcal/j).`,
      `- Plancher calorique strict en Cut : ne jamais descendre sous **${clean(p.kcalFloor || 2000)} kcal** en Jour OFF.`,
      '- Protéines : **maximum 160 g/jour**.',
      '- **Cas 1 — Tout va bien (`STATUT=ok`)** : rythme conforme, pas assez de recul (< 2 sem.), ou tour de taille en baisse (fausse stagnation / eau) → garde les mêmes calories et le même cardio (`STEPS_DELTA=0;ZONE2_DELTA=0`), rassure et résume.',
      '- **Cas 2 — Stagnation confirmée (`STATUT=stagnation`)** : ≥ 2 semaines sous la perte visée AVEC diète ≥ 90 %, sommeil ≥ 7 h et tour de taille stable → si Jour OFF > 2 000 kcal, tu peux baisser légèrement les glucides (sans jamais descendre sous 2 000 OFF) OU ajouter des pas ; si Jour OFF = 2 000 kcal, ne baisse plus les repas et ajoute `+2 500 pas/j` (max +5 000) ou `+1 séance Zone 2` (30–35 min jour OFF, max 3/sem).',
      '- **Cas 3 — Zone de transition (`STATUT=transition`)** : en Cut à ≤ 1,5 kg du poids objectif final (ou atteint) → prépare la remontée progressive vers le Maintien (ajoute des glucides précis en grammes, réduis le cardio extra avec `STEPS_DELTA` / `ZONE2_DELTA` négatifs si actif).',
      '- **Cas 4 — Fatigue / perte trop rapide / sommeil < 7 h (`STATUT=fatigue`)** : sommeil < 7 h, perte > 1 %/semaine, baisse de charges ou plancher + cardio max → remonte un peu les glucides, priorise 7–8 h de sommeil, propose un deload 8 j ou une pause Maintien.',
      '',
      '---',
      '',
      '## 1. Profil, Poids & Progression',
      `- **Date** : ${today} · **Cycle** : ${cycTxt}`,
      `- **Phase active** : ${phaseLab}`,
      `- **Poids de départ** : ${fmt1(sw)} kg`,
      `- **Poids actuel (moyenne 7 j)** : ${fmt1(rw.weightKg)} kg (${totalLost > 0 ? `−${fmt1(totalLost)} kg depuis le départ` : totalLost < 0 ? `+${fmt1(-totalLost)} kg depuis le départ` : 'stable depuis le départ'})`,
      latestTrendKg != null ? `- **Tendance lissée (EWMA)** : ${fmt1(latestTrendKg)} kg` : null,
      `- **Poids objectif final** : ${fmt1(p.targetWeightKg)} kg (${remToGoal > 0 ? `reste ${fmt1(remToGoal)} kg` : 'objectif atteint !'})`,
      inTransitionZone ? '- **Alerte transition** : ≤ 1,5 kg du poids final — évaluer la transition vers le Maintien.' : null,
      `- **Taille / Âge** : ${p.heightCm} cm · ${p.age} ans`,
      '',
      '## 2. Calories réellement mangées, Équation & Cardio',
      `- **Cibles actives choisies** : **${clean(effOn)} kcal ON** · **${clean(effOff)} kcal OFF** (**moy. ${clean(avgChoice)} kcal/j**)`,
      Math.abs(planAvgKcal - avgChoice) >= 20
        ? `- **Total réel dans mes assiettes (avec mes grammes perso)** : ${clean(onPlan.tot.kcal)} ON · ${clean(offPlan.tot.kcal)} OFF (moy. ${clean(planAvgKcal)} kcal/j)`
        : null,
      ad.avgIntakeKcal != null
        ? `- **Moyenne réellement validée (3/3 repas cochés)** : **${clean(ad.avgIntakeKcal)} kcal/j** sur ${ad.loggedDays} jour${ad.loggedDays > 1 ? 's' : ''} complet${ad.loggedDays > 1 ? 's' : ''}`
        : '- **Moyenne validée (3/3 repas)** : pas encore de journée complète cochée',
      `- **Suggestion équation (référence)** : ${clean(N.kcalOn)} ON · ${clean(N.kcalOff)} OFF (moy. ${clean(N.actualAvgKcal)} · Maintien théorique ${clean(N.tdee)} kcal/j)`,
      ad.ready
        ? `- **Maintien réel mesuré (adaptatif)** : **~${clean(ad.adaptiveTdee)} kcal/j** (confiance : ${ad.confidence})`
        : null,
      st.phase === 'seche'
        ? `- **Perte visée & déficit réel sur ce que je mange** : −${lossTxt} kg/sem (besoin −${clean(N.requiredDailyDeficit)} kcal/j) · déficit apporté par mes repas à ${clean(N.effectiveIntakeKcal)} kcal/j : **−${clean(N.foodDeficit)} kcal/j** · cardio manquant estimé : **${clean(N.missingCardioKcal)} kcal/j** (~+${clean(N.recommendedExtraSteps)} pas/j ou ${N.recommendedZone2MinPerDay} min Zone 2/j)`
        : null,
      `- **Cardio extra déjà actif dans l’app** : +${clean(p.extraDailySteps || 0)} pas/j · +${p.extraWeeklyZone2Sessions || 0} séance(s) Zone 2/sem`,
      `- **Garde-fous** : Diète ≥ 90 % : ${p.dietAdhered === false ? 'Non' : 'Oui'} · Sommeil ≥ 7 h : ${p.sleepOk === false ? 'Non' : 'Oui'} · « Je stagne » activé : ${p.stagnating ? 'Oui' : 'Non'}`,
      '',
      '## 3. Moyennes hebdo, Tour de taille & Historique 21 jours',
      `- **Semaine actuelle (J0 à J−6)** : ${W.c ? `${fmt1(W.c.avg)} kg (${W.c.n} pesée${W.c.n > 1 ? 's' : ''})` : 'Aucune pesée'}`,
      `- **Semaine −1 (J−7 à J−13)** : ${W.p1 ? `${fmt1(W.p1.avg)} kg (${W.p1.n} pesée${W.p1.n > 1 ? 's' : ''})` : 'Non renseignée'}`,
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
      `- **Deload actif** : ${deloadOn() ? `Oui (jusqu’au ${shortDate(fromNo(dayNo(st.deloadUntil) - 1))})` : 'Non'}`,
      `- **Charges enregistrées** : ${loadEntries.length ? loadEntries.join(' · ') : 'Charges par défaut'}`
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  // Coach IA direct (Google Gemini — clé stockée uniquement dans localStorage hors sauvegardes)
  const GEMINI_KEY_STORE = 'mon-plan-sante-gemini-key';
  const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  let aiBusy = false;
  let aiStatusMsg = '';

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
    let stepsDelta = 0;
    let zone2Delta = 0;
    const m = raw.match(/\[\[(?:PLAN|CIBLES):([^\]]+)\]\]/i);
    if (m) {
      const body = m[1];
      const stM = body.match(/STATUT\s*=\s*(ok|stagnation|transition|fatigue)/i);
      const phM = body.match(/PHASE\s*=\s*(seche|maintien)/i);
      const onM = body.match(/ON\s*=\s*(\d{4})/i);
      const offM = body.match(/OFF\s*=\s*(\d{4})/i);
      const sdM = body.match(/STEPS_DELTA\s*=\s*([+-]?\d+)/i);
      const z2M = body.match(/ZONE2_DELTA\s*=\s*([+-]?\d+)/i);
      if (stM) statut = stM[1].toLowerCase();
      if (phM) phase = phM[1].toLowerCase();
      const targetPhase = phase || st.phase;
      const floor = targetPhase === 'seche' ? profile().kcalFloor || 2000 : KCAL_MIN;
      const onV = onM ? Number(onM[1]) : NaN;
      const offV = offM ? Number(offM[1]) : NaN;
      if (isFinite(onV) && isFinite(offV) && onV >= floor && onV <= KCAL_MAX && offV >= floor && offV <= KCAL_MAX) {
        on = Math.round(onV);
        off = Math.round(offV);
      }
      if (sdM) {
        const sv = Number(sdM[1]);
        if (isFinite(sv)) stepsDelta = Math.max(-5000, Math.min(5000, Math.round(sv / 500) * 500));
      }
      if (z2M) {
        const zv = Number(z2M[1]);
        if (isFinite(zv)) zone2Delta = Math.max(-3, Math.min(2, Math.round(zv)));
      }
    }
    const text = raw.replace(/\[\[(?:PLAN|CIBLES):[^\]]+\]\]/gi, '').trim();
    return { text, statut, on, off, phase, stepsDelta, zone2Delta };
  }

  function renderAiCoach() {
    const key = getGeminiKey();
    const hasKey = key.length >= 10;

    if ($('aiKeyTitle')) {
      $('aiKeyTitle').textContent = hasKey
        ? 'Coach IA (Gemini · connecté ✓)'
        : 'Coach IA (Gemini · ajouter ma clé)';
    }
    if ($('geminiKeyInput') && document.activeElement !== $('geminiKeyInput')) {
      $('geminiKeyInput').value = key;
    }
    if ($('clearGeminiKey')) $('clearGeminiKey').hidden = !hasKey;

    const btn = $('askAiBtn');
    if (btn) {
      btn.disabled = aiBusy;
      btn.textContent = aiBusy ? 'Analyse…' : hasKey ? 'Demander à l’IA' : 'Configurer Gemini';
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
    $('aiReplyMeta').textContent = `Coach Gemini · ${shortDate(rep.date || today)}`;
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

    const applyBtn = $('applyAiTargets');
    if (applyBtn) {
      const p = profile();
      const targetPhase = rep.phase === 'seche' || rep.phase === 'maintien' ? rep.phase : st.phase;
      const phaseChanged = targetPhase !== st.phase;
      const kcalChanged = !!(rep.on && rep.off && (tgt(targetPhase, 'on') !== rep.on || tgt(targetPhase, 'off') !== rep.off));
      const curSteps = p.extraDailySteps || 0;
      const nextSteps = Math.max(0, curSteps + (rep.stepsDelta || 0));
      const stepsDiff = nextSteps - curSteps;
      const curZ2 = p.extraWeeklyZone2Sessions || 0;
      const nextZ2 = Math.max(0, curZ2 + (rep.zone2Delta || 0));
      const z2Diff = nextZ2 - curZ2;
      const hasChanges = phaseChanged || kcalChanged || stepsDiff !== 0 || z2Diff !== 0;

      if (rep.applied) {
        applyBtn.hidden = false;
        applyBtn.disabled = true;
        applyBtn.textContent = 'Plan appliqué ✓';
      } else if (hasChanges) {
        const parts = [];
        if (kcalChanged) parts.push(`${fmt(rep.on)}/${fmt(rep.off)} kcal`);
        if (stepsDiff !== 0) parts.push(`${stepsDiff > 0 ? '+' : '−'}${fmt(Math.abs(stepsDiff))} pas/j`);
        if (z2Diff !== 0) parts.push(`${z2Diff > 0 ? '+' : '−'}${Math.abs(z2Diff)} Zone 2/sem`);
        const phTag = phaseChanged ? ` (${targetPhase === 'seche' ? 'Cut' : 'Maintien'})` : '';
        applyBtn.hidden = false;
        applyBtn.disabled = false;
        applyBtn.textContent = parts.length
          ? `Appliquer${phTag} : ${parts.join(' · ')}`
          : `Passer en ${targetPhase === 'seche' ? 'Cut' : 'Maintien'}`;
      } else {
        applyBtn.hidden = true;
      }
    }
  }

  async function callGeminiModel(model, promptText, apiKey) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timerId = ctrl ? setTimeout(() => ctrl.abort(), 25000) : null;
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

  async function discoverGeminiFlashModel(apiKey) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': apiKey }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const models = (data && data.models) || [];
    const hit = models.find((m) => {
      const n = String(m.name || '').replace(/^models\//, '');
      const methods = m.supportedGenerationMethods || [];
      return (
        methods.includes('generateContent') &&
        /gemini/i.test(n) &&
        /flash/i.test(n) &&
        !/(tts|image|live|audio|embedding|vision)/i.test(n)
      );
    });
    return hit ? String(hit.name).replace(/^models\//, '') : null;
  }

  async function askGeminiCoach() {
    if (aiBusy) return;
    const apiKey = getGeminiKey();
    if (apiKey.length < 10) {
      st.tab = 'reglages';
      if ($('aiKeyFold')) $('aiKeyFold').open = true;
      aiStatusMsg = 'Ajoute d’abord ta clé Gemini gratuite dans Réglages → Coach IA.';
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

    const q = $('aiQuestion') ? $('aiQuestion').value.trim() : '';
    const floor = profile().kcalFloor || 2000;
    const promptText = [
      buildAiReportMd(),
      q ? `\n## Question particulière de l'utilisateur\n${q}` : '',
      '\n## Template Markdown de retour OBLIGATOIRE',
      'Réponds en français, sans texte d’introduction ni bloc de code ```, en remplissant EXACTEMENT ce template Markdown (concis, concret, zéro jargon technique) :',
      '',
      '### Résumé',
      '1 à 2 phrases directes : verdict clair (tout va bien / stagnation confirmée / fausse stagnation / zone de transition / fatigue) basé sur mon poids, les calories réellement mangées et mon tour de taille.',
      '',
      '### Calories (ON / OFF)',
      '- **Décision** : [Garder / Ajuster] à **XXXX kcal ON** / **YYYY kcal OFF** (moy. **ZZZZ kcal/j**)',
      '- **Dans l’assiette** : [Aucun changement OU ajustement concret en grammes d’aliments de mes repas, ex. −30 g de riz cru le midi]',
      '',
      '### Cardio & Pas',
      '- **Décision** : [Garder tel quel / Ajouter +2 500 pas/j / Ajouter +1 séance Zone 2 (30–35 min jour OFF) / Réduire de −2 500 pas/j]',
      '- **Pourquoi** : explication courte liée à mon objectif de perte/semaine et à ce que je mange réellement',
      '',
      '### Entraînement & Récup',
      '- 1 conseil bref et concret (continuer la progression, viser 7–8 h de sommeil ou activer le deload 8 j).',
      '',
      `Règle impérative : ne descends JAMAIS sous ${floor} kcal en Jour OFF en phase Cut.`,
      'Termine IMPÉRATIVEMENT par cette dernière ligne exacte (remplace les valeurs sans texte après) :',
      '[[PLAN:STATUT=ok;PHASE=seche;ON=2300;OFF=2100;STEPS_DELTA=0;ZONE2_DELTA=0]]',
      '(STATUT = ok | stagnation | transition | fatigue ; PHASE = seche | maintien ; ON et OFF = entiers kcal ; STEPS_DELTA = changement en pas/j par tranches de 500, ex. 0, +2500 ou -2500 ; ZONE2_DELTA = changement en séances Zone 2/sem, ex. 0, +1 ou -1).'
    ].join('\n');

    aiBusy = true;
    aiStatusMsg = '';
    renderAiCoach();

    try {
      let result = null;
      let lastErr = null;
      let all404 = true;
      for (const m of GEMINI_MODELS) {
        try {
          result = await callGeminiModel(m, promptText, apiKey);
          break;
        } catch (err) {
          lastErr = err;
          if (err.status !== 404) all404 = false;
          if (err.status === 400 || err.status === 401 || err.status === 403 || err.name === 'AbortError') break;
        }
      }
      if (!result && all404) {
        const discovered = await discoverGeminiFlashModel(apiKey);
        if (discovered) result = await callGeminiModel(discovered, promptText, apiKey);
      }
      if (!result) throw lastErr || new Error('Échec Gemini');

      const parsed = parseAiReply(result.text);
      st.lastAi = {
        date: today,
        model: result.model,
        text: parsed.text,
        statut: parsed.statut,
        on: parsed.on,
        off: parsed.off,
        phase: parsed.phase,
        stepsDelta: parsed.stepsDelta,
        zone2Delta: parsed.zone2Delta,
        applied: false
      };
      if ($('aiQuestion')) $('aiQuestion').value = '';
      aiStatusMsg = '';
      save();
    } catch (err) {
      if (err && err.name === 'AbortError') {
        aiStatusMsg = 'Délai dépassé, réessaie dans quelques secondes.';
      } else if (err && (err.status === 400 || err.status === 401 || err.status === 403)) {
        aiStatusMsg = 'Clé API invalide ou accès refusé. Vérifie ta clé dans Réglages → Coach IA.';
      } else if (err && err.status === 429) {
        aiStatusMsg = 'Quota gratuit temporairement atteint, réessaie dans 1 minute.';
      } else {
        aiStatusMsg = 'Impossible de joindre Gemini pour le moment (vérifie ta connexion ou ta clé).';
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

  // Apparence
  const LOOK = 'mon-plan-sante-apparence';
  function setLook(v) {
    if (v === 'light' || v === 'dark') document.documentElement.setAttribute('data-theme', v);
    else {
      v = 'auto';
      document.documentElement.removeAttribute('data-theme');
    }
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
              ? '#0D1014'
              : '#F5F7FA'
            : v === 'dark'
            ? '#0D1014'
            : '#F5F7FA'
        )
      );
  }
  let look = 'auto';
  try {
    look = localStorage.getItem(LOOK) || 'auto';
  } catch (e) {}
  setLook(look);

  // ==========================================================================
  // 10. ÉCOUTEURS D'ÉVÉNEMENTS & DÉMARRAGE
  // ==========================================================================

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;

    if (d.look) {
      setLook(d.look);
      return;
    }
    if (t.id === 'phaseToggleBtn') {
      st.phase = st.phase === 'seche' ? 'maintien' : 'seche';
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
      const list = mid === 'grain' ? GRAINS : PROTS;
      const mealId = mid === 'grain' ? 'midi' : mid;
      if (st.qty && st.qty[st.phase]) {
        ['on', 'off'].forEach((dy) => {
          const qd = st.qty[st.phase][dy];
          if (qd) list.forEach(([fid]) => delete qd[`${mealId}|${fid}`]);
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
        const floor = st.phase === 'seche' ? st.profile.kcalFloor || 2000 : KCAL_MIN;
        if (rep.on && rep.off && rep.on >= floor && rep.off >= floor && rep.on <= KCAL_MAX && rep.off <= KCAL_MAX) {
          st.targets = st.targets || {};
          st.targets[st.phase] = { on: rep.on, off: rep.off };
        }
        if (rep.stepsDelta) {
          st.profile.extraDailySteps = Math.max(0, (st.profile.extraDailySteps || 0) + rep.stepsDelta);
        }
        if (rep.zone2Delta) {
          st.profile.extraWeeklyZone2Sessions = Math.max(
            0,
            (st.profile.extraWeeklyZone2Sessions || 0) + rep.zone2Delta
          );
        }
        st.profile.stagnating = false;
        rep.applied = true;
        syncTodayKcalLog();
      }
    } else if (t.id === 'clearGeminiKey') {
      setGeminiKey('');
      aiStatusMsg = '';
      if ($('geminiKeyInput')) $('geminiKeyInput').value = '';
      renderAiCoach();
      return;
    } else if (t.id === 'shiftBtn') {
      peek = null;
      shiftCycle();
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
    } else if (d.step) {
      const [f, v] = d.step.split('|');
      const dv = Number(v);
      const it = buildDay(st.phase, viewDay())
        .meals.reduce((a, m) => a.concat(m.items), [])
        .find((x) => x.f === f);
      const ng = (it ? it.g : 0) + dv;
      if (ng < 0 || (CAPS[f] && ng > CAPS[f])) return;
      const A = st.adj[st.phase];
      A[f] = (A[f] || 0) + dv;
      if (!A[f]) delete A[f];
    } else if (t.id === 'deloadBtn') {
      st.deloadUntil = deloadOn() ? null : fromNo(dayNo(today) + CYCLE.length);
    } else if (d.set) {
      const now = !st.log.done[d.set];
      st.log.done[d.set] = now;
      const p = d.set.split('|');
      const exo = resolveEx(p[0], p[1]);
      if (now) {
        recordHist(exo.n);
        const tech = techOf(exo, deloadOn());
        const tSteps = techSteps(tech);
        const idx = Number(p[2]);
        const beforeTech = !!tech && idx >= exo.sets - tSteps - 1 && idx < exo.sets - 1;
        if (beforeTech && exo.tech === 'rp') startRest(RP_REST, exo.n);
        else if (!beforeTech) startRest(exo.rest, exo.n);
      }
    } else if (d.plus) {
      const p = d.plus.split('|');
      const exo = resolveEx(p[0], p[1]);
      const cur0 = num(st.loads[exo.n]);
      const cur = isFinite(cur0) ? cur0 : defKg(exo) || 0;
      st.loads[exo.n] = Math.round((cur + stepFor(exo)) * 100) / 100;
    } else if (d.rest) {
      const p = d.rest.split('|');
      const exo = resolveEx(p[0], p[1]);
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
    } else if (d.adj) {
      const [f, v] = d.adj.split('|');
      const A = st.adj[st.phase];
      A[f] = (A[f] || 0) + Number(v);
    } else if (d.loss) {
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      st.profile.weeklyLossTargetKg = Number(d.loss);
    } else if (d.stagAct) {
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      if (d.stagAct === 'decrease_activity') {
        const curOff = tgt(st.phase, 'off');
        const curOn = tgt(st.phase, 'on');
        const floor = st.phase === 'seche' ? st.profile.kcalFloor || 2000 : KCAL_MIN;
        const cut = st.phase === 'seche' ? Math.min(120, Math.max(0, curOff - floor)) : 100;
        st.targets = st.targets || {};
        st.targets[st.phase] = { on: Math.max(floor, curOn - cut), off: Math.max(floor, curOff - cut) };
        st.profile.stagnating = false;
        syncTodayKcalLog();
      } else if (d.stagAct === 'increase_activity') {
        const curOff = tgt(st.phase, 'off');
        const curOn = tgt(st.phase, 'on');
        const add = st.phase === 'seche' ? 120 : 100;
        st.targets = st.targets || {};
        st.targets[st.phase] = { on: Math.min(KCAL_MAX, curOn + add), off: Math.min(KCAL_MAX, curOff + add) };
        st.profile.stagnating = false;
        syncTodayKcalLog();
      } else if (d.stagAct === 'add_steps') {
        st.profile.extraDailySteps = (st.profile.extraDailySteps || 0) + 2500;
        st.profile.stagnating = false;
      } else if (d.stagAct === 'add_zone2') {
        st.profile.extraWeeklyZone2Sessions = (st.profile.extraWeeklyZone2Sessions || 0) + 1;
        st.profile.stagnating = false;
      } else if (d.stagAct === 'diet_break' || d.stagAct === 'switch_maintain') {
        st.phase = 'maintien';
        st.profile.stagnating = false;
        syncTodayKcalLog();
      }
    } else if (t.id === 'applyAdviceBtn') {
      const N = calcNutrition(st.phase);
      st.targets = st.targets || {};
      st.targets[st.phase] = { on: N.kcalOn, off: N.kcalOff };
      syncTodayKcalLog();
    } else if (t.id === 'resetCardioBtn') {
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      st.profile.extraDailySteps = 0;
      st.profile.extraWeeklyZone2Sessions = 0;
    } else if (t.id === 'stagnateBtn') {
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      st.profile.stagnating = !st.profile.stagnating;
    } else if (t.id === 'resetPlan') {
      if (!confirm('Revenir au plan de départ (calories, grammes et viandes) ?')) return;
      st.adj = { seche: {}, transition: {}, maintien: {}, diet_break: {} };
      st.qty = {};
      st.swap = {};
      st.targets = {};
      st.profile = Object.assign({}, PROFILE_DEFAULT);
      swapOpen = null;
      save();
      buildProfile();
    } else if (t.id === 'resetFoods') {
      if (!confirm('Remettre les valeurs par défaut ?')) return;
      st.foods = {};
      save();
      buildFoodRef();
    } else if (t.id === 'undoAdj') {
      st.adj[st.phase] = {};
    } else if (d.tab) {
      st.tab = d.tab;
      window.scrollTo(0, 0);
    } else return;

    save();
    render();
  });

  document.addEventListener('change', (e) => {
    if (!e.target) return;
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
      aiStatusMsg = '';
      renderAiCoach();
      return;
    }
    if (el.id === 'waistInput') {
      const v = num(el.value);
      st.waist = st.waist || {};
      if (el.value.trim() === '') delete st.waist[today];
      else if (isFinite(v) && v >= 40 && v <= 200) st.waist[today] = v;
      else return;
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
    } else if (el.dataset.prof) {
      const k = el.dataset.prof;
      const v = num(el.value);
      if (!isFinite(v) || v <= 0) return;
      st.profile = Object.assign({}, PROFILE_DEFAULT, st.profile || {});
      st.profile[k] = k === 'activityFactor' ? Math.min(1.7, Math.max(1.25, v)) : v;
    } else if (el.dataset.food) {
      const [f, k] = el.dataset.food.split('|');
      const v = num(el.value);
      st.foods = st.foods || {};
      const o = (st.foods[f] = Object.assign({}, st.foods[f]));
      if (el.value.trim() === '' || v === FOODS_DEFAULT[f][k]) delete o[k];
      else if (isFinite(v) && v >= 0 && v <= (k === 'kcal' ? 900 : 100)) o[k] = v;
      else return;
      if (!Object.keys(o).length) delete st.foods[f];
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
    } else if (el.dataset.target) {
      const [ph, d] = el.dataset.target.split('|');
      const v = Math.round(num(el.value));
      st.targets = st.targets || {};
      st.targets[ph] = st.targets[ph] || {};
      const okV = isFinite(v) && v >= KCAL_MIN && v <= KCAL_MAX;
      el.classList.toggle('is-bad', el.value.trim() !== '' && !okV);
      if (el.value.trim() === '') delete st.targets[ph][d];
      else if (okV) st.targets[ph][d] = v;
      else return;
    } else if (el.dataset.wday) {
      el.classList.toggle('is-long', el.value.trim().length > 5);
      const day = el.dataset.wday;
      const v = num(el.value);
      if (el.value.trim() === '') delete st.weights[day];
      else if (isFinite(v) && v > 30 && v < 300) st.weights[day] = v;
      else return;
      document.querySelectorAll(`[data-wday="${day}"]`).forEach((o) => {
        if (o !== el) {
          o.value = el.value;
          o.classList.toggle('is-long', el.value.trim().length > 5);
        }
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
    if (e.target.dataset && e.target.dataset.mykcal) {
      e.target.value = String(tgt(st.phase, e.target.dataset.mykcal));
      render();
      return;
    }
    if (e.target.dataset && e.target.dataset.food) {
      const [f, k] = e.target.dataset.food.split('|');
      const F = food(f);
      e.target.value = k === 'kcal' ? Math.round(F[k]) : n1(F[k]);
    }
    if (e.target.dataset && e.target.dataset.target) {
      const [ph, d] = e.target.dataset.target.split('|');
      e.target.value = tgt(ph, d);
      e.target.classList.remove('is-bad');
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

  render();
})();
