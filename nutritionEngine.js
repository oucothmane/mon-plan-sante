/* ==========================================================================
   Mon Plan Santé — Moteur pur de nutrition, Carb Cycling & Anti-stagnation
   Compatible Navigateur (window.NutritionEngine) et Node.js (module.exports)
   ========================================================================== */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NutritionEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FOOD_DB = {
    eggs:          { id: 'eggs',          n: 'Œufs entiers (calibre L)',  kcal: 140, p: 12.6, g: 0.7,  l: 9.6,   fib: 0.0 },
    chicken:       { id: 'chicken',       n: 'Blanc de poulet cru',       kcal: 110, p: 23.0, g: 0.0,  l: 1.8,   fib: 0.0 },
    turkey:        { id: 'turkey',        n: 'Escalope de dinde crue',    kcal: 108, p: 23.0, g: 0.0,  l: 1.5,   fib: 0.0 },
    cod:           { id: 'cod',           n: 'Cabillaud cru',             kcal: 77,  p: 17.7, g: 0.0,  l: 0.6,   fib: 0.0 },
    beef5:         { id: 'beef5',         n: 'Bœuf haché 5 % cru',        kcal: 130, p: 21.9, g: 0.3,  l: 4.6,   fib: 0.0 },
    whey:          { id: 'whey',          n: 'Whey isolate',              kcal: 370, p: 85.0, g: 3.0,  l: 1.5,   fib: 0.0 },
    rice:          { id: 'rice',          n: 'Riz cru (basmati/complet)', kcal: 355, p: 7.5,  g: 77.0, l: 1.0,   fib: 2.5 },
    pasta:         { id: 'pasta',         n: 'Pâtes complètes crues',     kcal: 348, p: 13.0, g: 65.0, l: 2.5,   fib: 7.5 },
    sweet_potato:  { id: 'sweet_potato',  n: 'Patate douce crue',         kcal: 86,  p: 1.6,  g: 20.0, l: 0.1,   fib: 3.0 },
    veggies:       { id: 'veggies',       n: 'Légumes verts',             kcal: 30,  p: 2.2,  g: 4.0,  l: 0.3,   fib: 3.0 },
    raisins:       { id: 'raisins',       n: 'Raisins secs',              kcal: 299, p: 3.1,  g: 72.0, l: 0.5,   fib: 3.7 },
    honey:         { id: 'honey',         n: "Miel d'acacia",             kcal: 304, p: 0.3,  g: 82.0, l: 0.0,   fib: 0.0 },
    peanut_butter: { id: 'peanut_butter', n: 'Beurre de cacahuète 100 %', kcal: 600, p: 25.0, g: 12.0, l: 50.0,  fib: 8.0 },
    walnuts:       { id: 'walnuts',       n: 'Noix de Grenoble',          kcal: 654, p: 15.0, g: 7.0,  l: 65.0,  fib: 6.7 },
    dark_choc:     { id: 'dark_choc',     n: 'Chocolat noir 90 %',        kcal: 592, p: 10.0, g: 14.0, l: 55.0,  fib: 12.0 },
    avocado:       { id: 'avocado',       n: 'Avocat',                    kcal: 160, p: 2.0,  g: 2.0,  l: 15.0,  fib: 6.7 },
    olive_oil:     { id: 'olive_oil',     n: "Huile d'olive",             kcal: 884, p: 0.0,  g: 0.0,  l: 100.0, fib: 0.0 },
    creatine:      { id: 'creatine',      n: 'Créatine monohydrate',      kcal: 0,   p: 0.0,  g: 0.0,  l: 0.0,   fib: 0.0, hidden: true }
  };

  const DEFAULT_PROFILE = {
    age: 32,
    heightCm: 182,
    sex: 'male',
    currentWeightKg: 99,
    targetWeightKg: 82,
    phase: 'cut', // 'cut' | 'transition' | 'maintain' | 'diet_break'
    weeklyLossTargetKg: null, // null = auto ~0,8 %/sem (0,5–0,8 kg) ; sinon choix utilisateur (0,1–1,5 kg/sem)
    transitionWeek: 1, // 1 | 2
    activityFactor: 1.38, // Bureau H24 (~1,30x BMR en OFF) + séance muscu (~+300 kcal en ON, Carb Cycling ±150)
    carbCyclingDeltaKcal: 150,
    kcalFloor: 2000,
    extraDailySteps: 0,
    extraWeeklyZone2Sessions: 0
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round2 = (v) => Math.round(v * 100) / 100;
  const roundTo5 = (v) => Math.max(0, Math.round(v / 5) * 5);
  const roundTo500 = (v) => Math.max(0, Math.round(v / 500) * 500);

  const dayNum = (s) => {
    const p = String(s || '').split('-').map(Number);
    if (p.length !== 3 || !isFinite(p[0])) return NaN;
    return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5);
  };

  function getFood(id, overrides) {
    const base = FOOD_DB[id];
    if (!base) return null;
    return overrides && overrides[id] ? Object.assign({}, base, overrides[id]) : base;
  }

  function macroOf(id, grams, overrides) {
    const f = getFood(id, overrides);
    if (!f || grams <= 0) return { kcal: 0, p: 0, g: 0, l: 0, fib: 0 };
    const r = grams / 100;
    return {
      kcal: f.kcal * r,
      p: f.p * r,
      g: f.g * r,
      l: f.l * r,
      fib: (f.fib || 0) * r
    };
  }

  // Moyenne glissante sur 7 jours en ignorant les jours où les repas n'ont pas été cochés
  function computeRollingWeight(entries, fallbackKg, todayStr) {
    const list = Array.isArray(entries) ? entries : [];
    const t0 = todayStr ? dayNum(todayStr) : Math.max.apply(null, list.map((e) => dayNum(e.date)).filter(isFinite));
    if (!isFinite(t0) || !list.length) {
      return { weightKg: Number(fallbackKg) || 99, count: 0, ignoredCount: 0, isRolling: false };
    }
    const inWin = list.filter((e) => {
      const dn = dayNum(e.date);
      return isFinite(dn) && isFinite(e.weightKg) && dn <= t0 && t0 - dn <= 6;
    });
    if (!inWin.length) {
      const past = list
        .filter((e) => isFinite(dayNum(e.date)) && isFinite(e.weightKg) && dayNum(e.date) <= t0)
        .sort((a, b) => dayNum(b.date) - dayNum(a.date));
      const validPast = past.filter((e) => e.mealsChecked !== false && e.mealsChecked !== 0);
      const chosen = validPast[0] || past[0];
      return {
        weightKg: chosen ? round2(chosen.weightKg) : Number(fallbackKg) || 99,
        count: chosen ? 1 : 0,
        ignoredCount: 0,
        isRolling: false
      };
    }

    const valid = inWin.filter((e) => e.mealsChecked !== false && e.mealsChecked !== 0);
    const ignoredCount = inWin.length - valid.length;
    const pool = valid.length ? valid : inWin;
    const avg = pool.reduce((s, e) => s + e.weightKg, 0) / pool.length;
    return {
      weightKg: round2(avg),
      count: pool.length,
      ignoredCount,
      isRolling: pool.length > 1 || ignoredCount > 0
    };
  }

  function calculateTargets(rawProfile) {
    const p = Object.assign({}, DEFAULT_PROFILE, rawProfile || {});
    const P = Number(p.currentWeightKg) || 99;
    const targetW = Number(p.targetWeightKg) || 82;
    const heightCm = Number(p.heightCm) || 182;
    const age = Number(p.age) || 32;
    const af = clamp(Number(p.activityFactor) || 1.38, 1.25, 1.7);
    const delta = Number(p.carbCyclingDeltaKcal != null ? p.carbCyclingDeltaKcal : 150);
    const floor = Math.max(1800, Number(p.kcalFloor || 2000));
    const transWeek = Number(p.transitionWeek) >= 2 ? 2 : 1;

    // 4.1 Métabolisme et Maintenance (Mifflin-St Jeor — Bureau H24 + muscu Carb Cycling)
    const bmr = Math.round(10 * P + 6.25 * heightCm - 5 * age + 5);
    const tdee = Math.round(bmr * af);

    const hasCustomLoss =
      p.weeklyLossTargetKg != null &&
      p.weeklyLossTargetKg !== '' &&
      isFinite(Number(p.weeklyLossTargetKg)) &&
      Number(p.weeklyLossTargetKg) > 0;
    const cutLossTarget = hasCustomLoss
      ? clamp(round2(Number(p.weeklyLossTargetKg)), 0.1, 1.5)
      : clamp(round2(P * 0.008), 0.5, 0.8);

    let weeklyLossKg = 0;
    let requiredDailyDeficit = 0;
    let rawAvgKcal = tdee;
    let kcalOff, kcalOn, actualAvgKcal, foodDeficit, missingCardioKcal;
    let transitionSteps = 0;
    let transitionZone2 = 0;

    if (p.phase === 'cut') {
      weeklyLossKg = cutLossTarget;
      requiredDailyDeficit = Math.round(weeklyLossKg * 1100); // 7 700 kcal / kg ÷ 7 j
      rawAvgKcal = tdee - requiredDailyDeficit;
      kcalOff = Math.max(floor, Math.round(rawAvgKcal - delta));
      kcalOn = kcalOff + 2 * delta;
      actualAvgKcal = Math.round((kcalOn + kcalOff) / 2);
      foodDeficit = Math.max(0, tdee - actualAvgKcal);
      missingCardioKcal = Math.max(0, requiredDailyDeficit - foodDeficit);
    } else if (p.phase === 'transition') {
      // Atterrissage progressif vers le maintien
      const cutOff = Math.max(floor, Math.round(tdee - cutLossTarget * 1100 - delta));
      const cutAvg = cutOff + delta;
      const transAvg = transWeek === 1 ? Math.round((cutAvg + tdee) / 2) : tdee;
      kcalOff = Math.max(floor, Math.round(transAvg - delta));
      kcalOn = kcalOff + 2 * delta;
      actualAvgKcal = Math.round((kcalOn + kcalOff) / 2);
      foodDeficit = Math.max(0, tdee - actualAvgKcal);
      missingCardioKcal = 0;
      transitionSteps = transWeek === 1 ? roundTo500((p.extraDailySteps || 0) * 0.5) : 0;
      transitionZone2 = transWeek === 1 ? Math.ceil((p.extraWeeklyZone2Sessions || 0) * 0.5) : 0;
    } else {
      kcalOff = Math.round(tdee - delta);
      kcalOn = Math.round(tdee + delta);
      actualAvgKcal = Math.round((kcalOn + kcalOff) / 2);
      foodDeficit = 0;
      missingCardioKcal = 0;
    }

    // Conversion cardio/pas pondérée par le poids réel (ACSM marche & Zone 2 ~5 METs)
    const kcalPerStep = Math.max(0.035, P * 0.00052);
    const kcalPerZone2Min = Math.max(5.5, P * 0.08);
    const recommendedExtraSteps = roundTo500(missingCardioKcal / kcalPerStep);
    const recommendedZone2MinPerDay = Math.round(missingCardioKcal / kcalPerZone2Min);
    const nearTarget = p.phase === 'cut' && P <= targetW + 0.5;
    const maxSafeLossKg = round2(P * 0.01);
    const isAggressiveLoss = p.phase === 'cut' && weeklyLossKg > maxSafeLossKg + 0.01;
    const floorHit = p.phase === 'cut' && Math.round(rawAvgKcal - delta) < floor;
    const cutAvgForTrans = Math.max(floor, Math.round(tdee - cutLossTarget * 1100 - delta)) + delta;
    const transitionAddKcal = p.phase === 'transition' ? Math.max(0, actualAvgKcal - cutAvgForTrans) : 0;

    // 4.3 Macros & Fibres (protéines plafonnées à 160 g max dans tous les cas)
    const proteinG = Math.min(160, Math.round(1.8 * P));
    const fatG = Math.max(targetW, Math.round(1.0 * P));

    const carbsFor = (dayKcal) => Math.max(50, Math.round((dayKcal - proteinG * 4 - fatG * 9) / 4));
    const fiberFor = (dayKcal) => clamp(Math.round((dayKcal / 1000) * 14), 25, 45);

    return {
      bmr,
      tdee,
      activityFactor: af,
      weeklyLossKg,
      maxSafeLossKg,
      isAggressiveLoss,
      floorHit,
      requiredDailyDeficit,
      rawAvgKcal,
      kcalOff,
      kcalOn,
      actualAvgKcal,
      foodDeficit,
      missingCardioKcal,
      recommendedExtraSteps,
      recommendedZone2MinPerDay,
      transitionWeek: transWeek,
      transitionAddKcal,
      transitionSteps,
      transitionZone2,
      nearTarget,
      proteinG,
      fatG,
      carbsOnG: carbsFor(kcalOn),
      carbsOffG: carbsFor(kcalOff),
      fiberOnG: fiberFor(kcalOn),
      fiberOffG: fiberFor(kcalOff)
    };
  }

  function buildMealPlan(rawProfile, dayType, opts) {
    const dt = String(dayType || 'ON').toUpperCase() === 'OFF' ? 'OFF' : 'ON';
    const options = opts || {};
    const foodOverrides = options.foodOverrides || null;
    const swaps = options.swaps || {};
    const usePasta = !!options.usePasta || swaps.grain === 'pasta';

    const targets = calculateTargets(rawProfile);
    const { proteinG, fatG } = targets;
    const customK = Number(options.overrideKcal);
    const hasCustomK = isFinite(customK) && customK >= 1500;
    const dayKcal = hasCustomK ? Math.round(customK) : dt === 'ON' ? targets.kcalOn : targets.kcalOff;
    const carbsG = hasCustomK
      ? Math.max(50, Math.round((dayKcal - proteinG * 4 - fatG * 9) / 4))
      : dt === 'ON'
      ? targets.carbsOnG
      : targets.carbsOffG;
    const fiberTargetG = hasCustomK
      ? clamp(Math.round((dayKcal / 1000) * 14), 25, 45)
      : dt === 'ON'
      ? targets.fiberOnG
      : targets.fiberOffG;

    // Résolution des protéines choisies AVANT le calcul des lipides (évite toute dérive bœuf 5% / cabillaud)
    const midiProtId = swaps.midi && FOOD_DB[swaps.midi] ? swaps.midi : 'chicken';
    const soirProtId = swaps.soir && FOOD_DB[swaps.soir] ? swaps.soir : 'chicken';

    let usedP = 0;
    let usedG = 0;
    let usedL = 0;
    let usedF = 0;
    const addMacro = (id, grams) => {
      const m = macroOf(id, grams, foodOverrides);
      usedP += m.p;
      usedG += m.g;
      usedL += m.l;
      usedF += m.fib;
    };

    // Étape 1 : Socle fixe + sources de bons lipides
    const eggsG = 170;
    const veggiesMidiG = 200;
    const veggiesSoirG = 200;
    const wheyG = 30;
    const darkChocG = 15;
    const peanutButterG = 20;
    let walnutsG = dt === 'OFF' ? 20 : 0;
    let avocadoG = dt === 'ON' ? 70 : 50;

    addMacro('eggs', eggsG);
    addMacro('veggies', veggiesMidiG);
    addMacro('veggies', veggiesSoirG);
    addMacro('whey', wheyG);
    addMacro('dark_choc', darkChocG);
    addMacro('peanut_butter', peanutButterG);
    if (walnutsG > 0) addMacro('walnuts', walnutsG);
    addMacro('avocado', avocadoG);

    // Étape 2 : Glucides restants (plafonds stricts : riz/pâtes 120 g, patate douce 250 g)
    const grainId = usePasta ? 'pasta' : 'rice';
    const grainCarbRate = (getFood(grainId, foodOverrides).g || 77) / 100;
    const remG = Math.max(0, carbsG - usedG);
    const riceG = Math.min(120, roundTo5((remG * 0.6) / grainCarbRate));
    addMacro(grainId, riceG);

    const remG2 = Math.max(0, carbsG - usedG);
    const sweetPotatoG = Math.min(250, roundTo5(remG2 / 0.2));
    addMacro('sweet_potato', sweetPotatoG);

    let raisinsG = 0;
    let honeyG = 0;
    const remG3 = carbsG - usedG;
    if (remG3 > 3) {
      raisinsG = Math.min(55, Math.max(0, Math.round(remG3 / 0.72)));
      if (raisinsG > 0) addMacro('raisins', raisinsG);

      const remG4 = carbsG - usedG;
      if (remG4 > 3) {
        honeyG = Math.min(35, Math.max(0, Math.round(remG4 / 0.82)));
        if (honeyG > 0) addMacro('honey', honeyG);
      }
    }

    // Étape 3 : Protéines exactes calculées directement avec la viande/poisson choisie (midi & soir)
    const remP = Math.max(0, proteinG - usedP);
    const midiProtRate = (getFood(midiProtId, foodOverrides).p || 23) / 100;
    const soirProtRate = (getFood(soirProtId, foodOverrides).p || 23) / 100;
    const midiProtG = roundTo5((remP * 0.5) / midiProtRate);
    const remPAfterMidi = Math.max(0, remP - midiProtG * midiProtRate);
    const soirProtG = roundTo5(remPAfterMidi / soirProtRate);
    addMacro(midiProtId, midiProtG);
    addMacro(soirProtId, soirProtG);

    // Étape 4 : Lipides exacts (tient compte des lipides du bœuf 5%, pâtes, cabillaud, etc.)
    let remL = fatG - usedL;
    if (remL < -1 && avocadoG > 0) {
      const cutAvo = Math.min(avocadoG, roundTo5(-remL / ((getFood('avocado', foodOverrides).l || 15) / 100)));
      if (cutAvo > 0) {
        avocadoG -= cutAvo;
        addMacro('avocado', -cutAvo);
        remL = fatG - usedL;
      }
    }
    if (remL < -1 && walnutsG > 0) {
      const cutWal = Math.min(walnutsG, Math.round(-remL / ((getFood('walnuts', foodOverrides).l || 65) / 100)));
      if (cutWal > 0) {
        walnutsG -= cutWal;
        addMacro('walnuts', -cutWal);
        remL = fatG - usedL;
      }
    }
    remL = Math.max(0, remL);
    if (remL > 40) {
      const extraWalnuts = Math.min(20, Math.round((remL - 40) / 0.65));
      if (extraWalnuts > 0) {
        walnutsG += extraWalnuts;
        addMacro('walnuts', extraWalnuts);
        remL = Math.max(0, fatG - usedL);
      }
    }
    if (remL > 40) {
      const extraAvocado = Math.min(30, roundTo5((remL - 40) / 0.15));
      if (extraAvocado > 0) {
        avocadoG += extraAvocado;
        addMacro('avocado', extraAvocado);
        remL = Math.max(0, fatG - usedL);
      }
    }
    const totalOilG = Math.max(0, Math.round(remL));
    const oilMidiG = Math.ceil(totalOilG / 2);
    const oilSoirG = Math.floor(totalOilG / 2);
    addMacro('olive_oil', oilMidiG + oilSoirG);

    // Étape 5 : Contrôle fibres (< 25 g -> légumes 250 g / repas)
    let finalVeggiesMidiG = veggiesMidiG;
    let finalVeggiesSoirG = veggiesSoirG;
    if (usedF < 25) {
      addMacro('veggies', 50);
      addMacro('veggies', 50);
      finalVeggiesMidiG = 250;
      finalVeggiesSoirG = 250;
    }
    const lowFiber = usedF < 25;

    const makeItem = (f, g) => {
      const info = getFood(f, foodOverrides);
      const m = macroOf(f, g, foodOverrides);
      return { f, n: info.n, g, kcal: m.kcal, p: m.p, carbs: m.g, l: m.l, fib: m.fib };
    };

    const meals = [
      {
        id: 'midi',
        num: '1',
        name: 'Midi',
        sub: 'Repas 1',
        supps: 'Multivitamines · Oméga-3',
        suppNote: 'Au milieu du repas',
        items: [
          makeItem('eggs', eggsG),
          makeItem(midiProtId, midiProtG),
          makeItem(grainId, riceG),
          makeItem('veggies', finalVeggiesMidiG),
          makeItem('olive_oil', oilMidiG)
        ].filter((i) => i.g > 0 || i.f === grainId)
      },
      {
        id: 'collation',
        num: '2',
        name: dt === 'ON' ? 'Shaker post-séance' : 'Collation shaker',
        sub: dt === 'ON' ? 'Après entraînement' : 'Dans l’après-midi',
        items: [
          makeItem('whey', wheyG),
          makeItem('creatine', 5),
          makeItem('raisins', raisinsG),
          makeItem('honey', honeyG),
          makeItem('peanut_butter', peanutButterG),
          makeItem('walnuts', walnutsG),
          makeItem('dark_choc', darkChocG)
        ].filter((i) => i.g > 0)
      },
      {
        id: 'soir',
        num: '3',
        name: 'Soir',
        sub: 'Dîner',
        supps: 'Magnésium bisglycinate',
        suppNote: 'Au dîner ou avant de dormir',
        items: [
          makeItem(soirProtId, soirProtG),
          makeItem('sweet_potato', sweetPotatoG),
          makeItem('veggies', finalVeggiesSoirG),
          makeItem('olive_oil', oilSoirG),
          makeItem('avocado', avocadoG)
        ].filter((i) => i.g > 0 || i.f === 'sweet_potato')
      }
    ];

    const totals = { kcal: 0, p: 0, g: 0, l: 0, fib: 0 };
    meals.forEach((m) => {
      m.kcal = m.items.reduce((s, i) => s + i.kcal, 0);
      totals.kcal += m.kcal;
      m.items.forEach((i) => {
        totals.p += i.p;
        totals.g += i.carbs;
        totals.l += i.l;
        totals.fib += i.fib;
      });
    });

    return {
      dayType: dt,
      targets,
      dayKcal,
      carbsTargetG: carbsG,
      fiberTargetG,
      lowFiber,
      quantities: {
        grainId,
        riceG,
        sweetPotatoG,
        raisinsG,
        honeyG,
        midiProtId,
        soirProtId,
        chickenMidiG: midiProtG,
        chickenSoirG: soirProtG,
        oilMidiG,
        oilSoirG,
        walnutsG,
        avocadoG,
        veggiesMidiG: finalVeggiesMidiG,
        veggiesSoirG: finalVeggiesSoirG
      },
      meals,
      totals
    };
  }

  // Somme dynamique des courses sur N jours ON + M jours OFF (par défaut 4 ON + 4 OFF = cycle 8 jours)
  function buildShoppingTotals(rawProfile, onDays, offDays, opts) {
    const nOn = onDays != null ? onDays : 4;
    const nOff = offDays != null ? offDays : 4;
    const planOn = buildMealPlan(rawProfile, 'ON', opts);
    const planOff = buildMealPlan(rawProfile, 'OFF', opts);
    const totals = {};
    const addPlan = (plan, mult) => {
      plan.meals.forEach((m) => {
        m.items.forEach((i) => {
          totals[i.f] = (totals[i.f] || 0) + i.g * mult;
        });
      });
    };
    addPlan(planOn, nOn);
    addPlan(planOff, nOff);
    Object.keys(totals).forEach((k) => {
      totals[k] = Math.round(totals[k]);
    });
    return { onDays: nOn, offDays: nOff, totals, planOn, planOff };
  }

  function evaluateStagnation(rawProfile, weeklyDeltaKg, prevWeeklyDeltaKg, manualTrigger, context) {
    const p = Object.assign({}, DEFAULT_PROFILE, rawProfile || {});
    const t = calculateTargets(p);
    const ctx = context || {};
    const fmtFr1 = (n) => Math.abs(n).toFixed(1).replace('.', ',');

    if (p.phase === 'transition') {
      const riceG = Math.round(t.transitionAddKcal / 3.55 / 5) * 5;
      return {
        status: 'ok',
        action: 'none',
        title: 'Phase Transition',
        message: `Ajoute ~+${riceG} g de riz cru/j (+${t.transitionAddKcal} kcal) pendant 1 à 2 sem. en réduisant le cardio, puis passe en Maintien.`
      };
    }

    if (p.phase !== 'cut') {
      if (weeklyDeltaKg != null && weeklyDeltaKg > 0.3) {
        return {
          status: 'drift',
          action: 'decrease_activity',
          kcalDelta: -100,
          title: 'Légère hausse en Maintien',
          message: `Ta moyenne monte (+${fmtFr1(weeklyDeltaKg)} kg/sem) : baisse légèrement les quantités (~−100 kcal/j, soit −30 g de riz cru/j).`,
          buttonLabel: 'Baisser de −100 kcal/j'
        };
      }
      if (weeklyDeltaKg != null && weeklyDeltaKg < -0.3) {
        return {
          status: 'drift',
          action: 'increase_activity',
          kcalDelta: 100,
          title: 'Légère baisse en Maintien',
          message: `Ta moyenne baisse (−${fmtFr1(weeklyDeltaKg)} kg/sem) : ajoute ~+100 kcal/j (+30 g de riz cru/j) pour stabiliser ton poids.`,
          buttonLabel: 'Ajouter +100 kcal/j'
        };
      }
      return { status: 'ok', action: 'none', title: 'Maintien stable', message: 'Poids stable : garde tes quantités actuelles.' };
    }

    // Atterrissage objectif atteint (82 kg)
    if (t.nearTarget) {
      const halfKcal = Math.max(0, Math.round((t.tdee - t.actualAvgKcal) / 2));
      const riceG = Math.round(halfKcal / 3.55 / 5) * 5;
      return {
        status: 'target_reached',
        action: 'switch_maintain',
        title: `Objectif ${p.targetWeightKg} kg atteint !`,
        message:
          `Ajoute +${riceG} g de riz cru/j (~+${halfKcal} kcal) pendant 1 semaine et coupe le cardio extra, puis passe au Maintien complet (+1,5 à +2,5 kg d’eau/glycogène normaux).`,
        buttonLabel: 'Passer en Maintien'
      };
    }

    const loss1 = weeklyDeltaKg != null ? -weeklyDeltaKg : null;
    const loss0 = prevWeeklyDeltaKg != null ? -prevWeeklyDeltaKg : null;
    const minLoss = Math.max(0.15, round2(t.weeklyLossKg * 0.5));
    const maxLoss = Math.max(1.1, round2(t.weeklyLossKg * 1.4));

    if (loss1 != null && loss1 > maxLoss) {
      return {
        status: 'fast',
        action: 'increase_activity',
        delta: 0.05,
        kcalDelta: 120,
        title: `Perte trop rapide (> ${fmtFr1(maxLoss)} kg/sem)`,
        message: `Tu perds plus vite que prévu (−${fmtFr1(loss1)} kg/sem) : ajoute ~+120 kcal/j en glucides (ex. +35 g de riz cru/j) pour protéger ton muscle.`,
        buttonLabel: 'Ajouter +120 kcal/j'
      };
    }

    const autoStag = loss1 != null && loss0 != null && loss1 < minLoss && loss0 < minLoss;
    if (!autoStag && !manualTrigger) {
      if (loss1 != null && loss1 >= minLoss) {
        return {
          status: 'ok',
          action: 'none',
          title: 'Rythme optimal',
          message: `Perte dans ta cible (−${fmtFr1(loss1)} kg/sem pour −${fmtFr1(t.weeklyLossKg)} visé) : garde tes quantités actuelles.`
        };
      }
      return {
        status: 'wait',
        action: 'none',
        title: 'Observation en cours',
        message: `Attends 2 semaines de moyenne < ${fmtFr1(minLoss)} kg/sem avant d’ajuster tes quantités ou ton cardio.`
      };
    }

    // Garde-fou #1 : Tour de taille en baisse -> fausse stagnation (rétention d'eau)
    if (ctx.waistDeltaCm != null && isFinite(ctx.waistDeltaCm) && ctx.waistDeltaCm <= -0.5) {
      return {
        status: 'recomp',
        action: 'none',
        title: 'Fausse stagnation — Tour de taille en baisse',
        message: `Ton tour de taille a baissé de ${fmtFr1(ctx.waistDeltaCm)} cm : tu perds bien du gras (rétention d’eau sur la balance). Ne touche à rien !`
      };
    }

    // Garde-fou #2 : Sommeil < 7 h -> cortisol + chute testostérone
    if (ctx.sleepUnder7h === true) {
      return {
        status: 'sleep',
        action: 'none',
        title: 'Priorité sommeil (< 7 h)',
        message:
          'Dormir moins de 7 h en sèche fait chuter la testostérone et grimper le cortisol (rétention d’eau). Vise 7–8 h/nuit pendant 7 jours avant d’ajuster le plan.'
      };
    }

    // Stagnation confirmée : on vérifie la vraie marge alimentaire au-dessus du plancher 2 000 kcal
    const effectiveOffKcal =
      ctx.effectiveOffKcal != null && isFinite(Number(ctx.effectiveOffKcal))
        ? Number(ctx.effectiveOffKcal)
        : t.kcalOff;
    const marginAboveFloor = Math.round(effectiveOffKcal - p.kcalFloor);

    if (marginAboveFloor >= 50) {
      const cutKcal = Math.min(120, marginAboveFloor);
      const riceG = Math.max(15, Math.round(cutKcal / 3.55 / 5) * 5);
      return {
        status: 'stagnating',
        action: 'decrease_activity',
        delta: -0.05,
        kcalDelta: -cutKcal,
        title: 'Stagnation — Diminue un peu les quantités',
        message: `Ta moyenne stagne : baisse d’environ −${cutKcal} kcal/j sur les glucides (ex. −${riceG} g de riz cru/j), en restant au-dessus du plancher ${p.kcalFloor.toLocaleString('fr-FR')} kcal.`,
        buttonLabel: `Baisser de −${cutKcal} kcal/j`
      };
    }

    if ((p.extraDailySteps || 0) < 5000) {
      return {
        status: 'stagnating',
        action: 'add_steps',
        stepsDelta: 2500,
        title: 'Plancher 2 000 kcal atteint — Ajoute des pas',
        message: 'Ne baisse plus tes repas (plancher 2 000 kcal). Ajoute +2 500 pas/jour (~+125 kcal/j) pour relancer la perte sans toucher aux hormones.',
        buttonLabel: 'Ajouter +2 500 pas/jour'
      };
    }

    if ((p.extraWeeklyZone2Sessions || 0) < 3) {
      return {
        status: 'stagnating',
        action: 'add_zone2',
        sessionsDelta: 1,
        title: 'Plancher 2 000 kcal atteint — Ajoute du cardio',
        message: 'Ne baisse plus tes repas. Ajoute +1 séance cardio léger Zone 2 (30–35 min sur jour OFF) pour augmenter la dépense sans fatigue nerveuse.',
        buttonLabel: 'Ajouter +1 séance cardio'
      };
    }

    return {
      status: 'stagnating',
      action: 'diet_break',
      title: 'Fatigue cumulée — Pause Maintien conseillée',
      message: 'Plancher 2 000 kcal + beaucoup de cardio : passe 7 à 14 jours en Maintien (remonte les glucides) pour relancer ton métabolisme.',
      buttonLabel: 'Passer en Maintien (7–14 j)'
    };
  }

  // Tendance lissée EWMA (façon MacroFactor / Happy Scale) adaptée aux pesées espacées
  function computeWeightTrend(points) {
    const list = Array.isArray(points) ? points : [];
    let trend = null;
    let prevDn = null;
    return list.map((pt) => {
      const w = Number(pt.weightKg != null ? pt.weightKg : pt.v);
      const dn = pt.n != null ? pt.n : dayNum(pt.date || pt.d);
      if (!isFinite(w)) return Object.assign({}, pt, { trendKg: trend });
      if (trend == null) {
        trend = w;
      } else {
        const dt = prevDn != null && isFinite(dn) ? clamp(dn - prevDn, 1, 5) : 1;
        const alpha = 1 - Math.pow(0.75, dt);
        trend = trend + alpha * (w - trend);
      }
      prevDn = isFinite(dn) ? dn : prevDn;
      return Object.assign({}, pt, { trendKg: round2(trend) });
    });
  }

  // TDEE adaptatif réel à partir des journées complètes (kcalLog) et de la tendance de poids (≥ 2 sem.)
  function estimateAdaptiveTDEE(weightEntries, kcalByDate, fallbackTdee, todayStr) {
    const baseTdee = Math.round(Number(fallbackTdee) || 2500);
    const list = Array.isArray(weightEntries) ? weightEntries : [];
    const kmap = kcalByDate || {};
    const t0 = todayStr ? dayNum(todayStr) : Math.max.apply(null, list.map((e) => dayNum(e.date)).filter(isFinite));
    if (!isFinite(t0)) {
      return { ready: false, adaptiveTdee: baseTdee, avgIntakeKcal: null, weeklyDeltaKg: null, loggedDays: 0, confidence: 'low' };
    }

    const avgWin = (from, to) => {
      const vals = list
        .filter((e) => {
          const dn = dayNum(e.date);
          return isFinite(dn) && isFinite(e.weightKg) && t0 - dn >= from && t0 - dn <= to;
        })
        .map((e) => Number(e.weightKg));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const w0 = avgWin(0, 6);
    const w1 = avgWin(7, 13);
    const w2 = avgWin(14, 20);
    const weeklyDeltaKg =
      w0 != null && w2 != null
        ? round2((w0 - w2) / 2)
        : w0 != null && w1 != null
        ? round2(w0 - w1)
        : null;

    const spanDays = w0 != null && w2 != null ? 20 : 13;
    const intakes = Object.keys(kmap)
      .filter((d) => {
        const dn = dayNum(d);
        const k = Number(kmap[d]);
        return isFinite(dn) && dn <= t0 && t0 - dn <= spanDays && isFinite(k) && k >= 1200 && k <= 5000;
      })
      .map((d) => Number(kmap[d]));

    const loggedDays = intakes.length;
    if (weeklyDeltaKg == null || loggedDays < 6) {
      return {
        ready: false,
        adaptiveTdee: baseTdee,
        avgIntakeKcal: loggedDays ? Math.round(intakes.reduce((a, b) => a + b, 0) / loggedDays) : null,
        weeklyDeltaKg,
        loggedDays,
        confidence: 'low'
      };
    }

    const avgIntakeKcal = Math.round(intakes.reduce((a, b) => a + b, 0) / loggedDays);
    const rawTdee = avgIntakeKcal - weeklyDeltaKg * 1100;
    const clampedTdee = clamp(rawTdee, baseTdee - 450, baseTdee + 450);
    const blend = Math.min(0.85, loggedDays / 14);
    const adaptiveTdee = Math.round(baseTdee * (1 - blend) + clampedTdee * blend);

    return {
      ready: true,
      adaptiveTdee,
      avgIntakeKcal,
      weeklyDeltaKg,
      loggedDays,
      confidence: loggedDays >= 10 ? 'high' : 'medium'
    };
  }

  return {
    FOOD_DB,
    DEFAULT_PROFILE,
    getFood,
    computeRollingWeight,
    computeWeightTrend,
    estimateAdaptiveTDEE,
    calculateTargets,
    buildMealPlan,
    buildShoppingTotals,
    evaluateStagnation
  };
});
