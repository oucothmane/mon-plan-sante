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
    chicken:       { id: 'chicken',       n: 'Filets de poulet surgelés (Picard)', kcal: 110, p: 23.0, g: 0.0,  l: 1.8,   fib: 0.0 },
    turkey:        { id: 'turkey',        n: 'Escalope de dinde crue',    kcal: 108, p: 23.0, g: 0.0,  l: 1.5,   fib: 0.0 },
    cod:           { id: 'cod',           n: 'Cabillaud cru',             kcal: 77,  p: 17.7, g: 0.0,  l: 0.6,   fib: 0.0 },
    beef5:         { id: 'beef5',         n: 'Bœuf haché 5 % cru',        kcal: 130, p: 21.9, g: 0.3,  l: 4.6,   fib: 0.0 },
    whey:          { id: 'whey',          n: 'Whey isolate',              kcal: 370, p: 85.0, g: 3.0,  l: 1.5,   fib: 0.0 },
    pasta:         { id: 'pasta',         n: 'Pâtes complètes crues',     kcal: 348, p: 13.0, g: 65.0, l: 2.5,   fib: 7.5 },
    sweet_potato:  { id: 'sweet_potato',  n: 'Frites patate douce surgelées (Picard)', kcal: 143, p: 1.5, g: 19.5, l: 6.1, fib: 2.5 },
    veggies:       { id: 'veggies',       n: 'Poêlée de légumes surgelée',             kcal: 127, p: 2.5, g: 13.6, l: 6.5, fib: 2.5 },
    tomato_sauce:  { id: 'tomato_sauce',  n: 'Sauce tomate nature (conserve)', kcal: 32, p: 1.5, g: 5.5, l: 0.2, fib: 1.5 },
    raisins:       { id: 'raisins',       n: 'Raisins secs',              kcal: 299, p: 3.1,  g: 72.0, l: 0.5,   fib: 3.7 },
    banana:        { id: 'banana',        n: 'Banane',                    kcal: 89,  p: 1.1,  g: 20.0, l: 0.3,   fib: 2.6 },
    honey:         { id: 'honey',         n: "Miel d'acacia",             kcal: 304, p: 0.3,  g: 82.0, l: 0.0,   fib: 0.0, hidden: true },
    peanut_butter: { id: 'peanut_butter', n: 'Beurre de cacahuète 100 %', kcal: 600, p: 25.0, g: 12.0, l: 50.0,  fib: 8.0, hidden: true },
    walnuts:       { id: 'walnuts',       n: 'Noix de Grenoble',          kcal: 654, p: 15.0, g: 7.0,  l: 65.0,  fib: 6.7 },
    dark_choc:     { id: 'dark_choc',     n: 'Chocolat noir 90 %',        kcal: 592, p: 10.0, g: 14.0, l: 55.0,  fib: 12.0, hidden: true },
    avocado:       { id: 'avocado',       n: 'Avocat',                    kcal: 160, p: 2.0,  g: 2.0,  l: 15.0,  fib: 6.7 },
    olive_oil:     { id: 'olive_oil',     n: "Huile d'olive",             kcal: 884, p: 0.0,  g: 0.0,  l: 100.0, fib: 0.0 },
    belvita:       { id: 'belvita',       n: 'Biscuit complet (Belvita)',   kcal: 440, p: 8.0,  g: 68.0, l: 15.0,  fib: 5.0, hidden: true },
    creatine:      { id: 'creatine',      n: 'Créatine monohydrate',      kcal: 0,   p: 0.0,  g: 0.0,  l: 0.0,   fib: 0.0, hidden: true }
  };

  const RULE_CONFIG = {
    kcalMin: 2000,
    kcalMax: 4500,
    defaultTargets: { seche: { on: 2200, off: 2000 }, maintien: { on: 2400, off: 2200 } },
    profile: {
      proteinMaxG: 165,
      fatOnPerKg: 1.0,
      fatOffPerKg: 1.2,
      activityOfficeFactor: 1.25,
      weeklyLossPct: 0.008,
      weeklyLossMinKg: 0.5,
      weeklyLossMaxKg: 0.8
    },
    fiber: {
      per1000Kcal: 14,
      minG: 25,
      maxG: 45,
      boostVeggiesG: 250
    },
    foodCaps: {
      pasta: 120,
      sweet_potato: 200,
      raisins: 50,
      banana: 240,
      honey: 0,
      belvita: 0,
      olive_oil: 60,
      avocado: 100,
      walnuts: 35,
      peanut_butter: 0,
      dark_choc: 0
    },
    mealBases: {
      eggs: 170,
      veggiesMidi: 150,
      veggiesSoir: 150,
      tomatoSauceMidi: 150,
      whey: 30,
      creatine: 5,
      dark_choc: 0,
      peanut_butter: 0,
      walnutsOn: 10,
      walnutsOff: 15,
      avocadoOn: 45,
      avocadoOff: 100,
      oilMinG: 10,
      belvitaGPerBiscuit: 12.5
    },
    cardioTargets: { seche: { on: 50, off: 30 }, maintien: { on: 50, off: 0 } },
    proteinSwaps: [
      ['chicken', 'Poulet'],
      ['turkey', 'Dinde'],
      ['cod', 'Cabillaud'],
      ['beef5', 'Bœuf 5 %']
    ],
    foodsGroupOrder: ['Protéines', 'Glucides', 'Lipides', 'Légumes'],
    mealMeta: {
      midi: {
        num: '1',
        name: 'Midi',
        sub: 'Repas 1',
        supps: 'Multivitamines · Oméga-3',
        suppNote: 'Au milieu du repas',
        ensureFoods: ['olive_oil']
      },
      collation: {
        num: '2',
        nameOn: 'Shaker post-séance',
        nameOff: 'Collation shaker',
        subOn: 'Après entraînement',
        subOff: 'Dans l’après-midi',
        ensureFoods: ['banana', 'raisins', 'walnuts']
      },
      soir: {
        num: '3',
        name: 'Soir',
        sub: 'Dîner',
        supps: 'Magnésium bisglycinate',
        suppNote: 'Au dîner ou avant de dormir',
        ensureFoods: ['olive_oil', 'avocado']
      }
    }
  };

  const DEFAULT_PROFILE = {
    age: 32,
    heightCm: 182,
    sex: 'male',
    currentWeightKg: 99,
    targetWeightKg: 82,
    phase: 'cut',
    weeklyLossTargetKg: null,
    transitionWeek: 1,
    activityFactor: 1.38,
    carbCyclingDeltaKcal: 150,
    kcalFloor: 2000,
    extraDailySteps: 0,
    extraWeeklyZone2Sessions: 0,
    gymRoundTripMin: 50,
    proteinTargetG: null,
    fatTargetG: null,
    proteinOnG: null,
    proteinOffG: null,
    fatOnG: null,
    fatOffG: null
  };

  function parseRulesMarkdown(mdText) {
    const matches = String(mdText || '').match(/```json\s*([\s\S]*?)```/gi);
    if (!matches || !matches.length) return null;
    const last = matches[matches.length - 1].replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(last);
    } catch (e) {
      return null;
    }
  }

  function applyConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') return RULE_CONFIG;
    if (isFinite(Number(cfg.kcalMin))) RULE_CONFIG.kcalMin = Math.max(2000, Math.round(Number(cfg.kcalMin)));
    if (isFinite(Number(cfg.kcalMax))) RULE_CONFIG.kcalMax = Math.round(Number(cfg.kcalMax));
    if (cfg.defaultTargets && typeof cfg.defaultTargets === 'object') {
      ['seche', 'maintien'].forEach((ph) => {
        if (cfg.defaultTargets[ph]) {
          RULE_CONFIG.defaultTargets[ph] = Object.assign({}, RULE_CONFIG.defaultTargets[ph], cfg.defaultTargets[ph]);
        }
      });
    }
    if (cfg.profile && typeof cfg.profile === 'object') {
      ['age', 'heightCm', 'sex', 'currentWeightKg', 'targetWeightKg', 'activityFactor', 'carbCyclingDeltaKcal', 'kcalFloor', 'gymRoundTripMin'].forEach((k) => {
        if (cfg.profile[k] != null) DEFAULT_PROFILE[k] = cfg.profile[k];
      });
      if (cfg.profile.kcalFloor != null) DEFAULT_PROFILE.kcalFloor = Math.max(RULE_CONFIG.kcalMin, Number(cfg.profile.kcalFloor));
      ['proteinMaxG', 'fatOnPerKg', 'fatOffPerKg', 'activityOfficeFactor', 'weeklyLossPct', 'weeklyLossMinKg', 'weeklyLossMaxKg'].forEach((k) => {
        if (cfg.profile[k] != null) RULE_CONFIG.profile[k] = Number(cfg.profile[k]);
      });
    }
    if (cfg.fiber && typeof cfg.fiber === 'object') {
      Object.assign(RULE_CONFIG.fiber, cfg.fiber);
    }
    if (cfg.foodCaps && typeof cfg.foodCaps === 'object') {
      Object.assign(RULE_CONFIG.foodCaps, cfg.foodCaps);
    }
    if (cfg.mealBases && typeof cfg.mealBases === 'object') {
      Object.assign(RULE_CONFIG.mealBases, cfg.mealBases);
    }
    if (cfg.cardioTargets && typeof cfg.cardioTargets === 'object') {
      ['seche', 'maintien'].forEach((ph) => {
        if (cfg.cardioTargets[ph]) {
          RULE_CONFIG.cardioTargets[ph] = Object.assign({}, RULE_CONFIG.cardioTargets[ph], cfg.cardioTargets[ph]);
        }
      });
    }
    if (Array.isArray(cfg.proteinSwaps)) {
      RULE_CONFIG.proteinSwaps = cfg.proteinSwaps.slice();
    }
    if (Array.isArray(cfg.foodsGroupOrder)) {
      RULE_CONFIG.foodsGroupOrder = cfg.foodsGroupOrder.slice();
    }
    if (cfg.foods && typeof cfg.foods === 'object') {
      Object.keys(FOOD_DB).forEach((id) => {
        if (!cfg.foods[id]) delete FOOD_DB[id];
      });
      Object.keys(cfg.foods).forEach((id) => {
        FOOD_DB[id] = Object.assign({}, FOOD_DB[id] || {}, cfg.foods[id]);
      });
    }
    if (cfg.meals && typeof cfg.meals === 'object') {
      RULE_CONFIG.meals = cfg.meals;
    }
    if (cfg.mealMeta && typeof cfg.mealMeta === 'object') {
      RULE_CONFIG.mealMeta = cfg.mealMeta;
    }
    return RULE_CONFIG;
  }

  if (typeof require === 'function' && typeof __dirname === 'string') {
    try {
      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.join(__dirname, 'plan-rules.json');
      if (fs.existsSync(jsonPath)) {
        applyConfig(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
      }
      const foodsPath = path.join(__dirname, 'foods.json');
      if (fs.existsSync(foodsPath)) {
        const fData = JSON.parse(fs.readFileSync(foodsPath, 'utf8'));
        if (fData && fData.foods) applyConfig({ foods: fData.foods, foodsGroupOrder: fData.groupOrder });
      }
      const mealsPath = path.join(__dirname, 'meals.json');
      if (fs.existsSync(mealsPath)) {
        const mData = JSON.parse(fs.readFileSync(mealsPath, 'utf8'));
        if (mData) applyConfig({ meals: mData.phases, mealMeta: mData.mealMeta });
      }
    } catch (e) {}
  }

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
    const P = Number(p.currentWeightKg) || DEFAULT_PROFILE.currentWeightKg;
    const targetW = Number(p.targetWeightKg) || DEFAULT_PROFILE.targetWeightKg;
    const heightCm = Number(p.heightCm) || DEFAULT_PROFILE.heightCm;
    const age = Number(p.age) || DEFAULT_PROFILE.age;
    const af = clamp(Number(p.activityFactor) || DEFAULT_PROFILE.activityFactor, 1.25, 1.7);
    const delta = Number(p.carbCyclingDeltaKcal != null ? p.carbCyclingDeltaKcal : DEFAULT_PROFILE.carbCyclingDeltaKcal);
    const floor = Math.max(RULE_CONFIG.kcalMin, Number(p.kcalFloor || RULE_CONFIG.kcalMin));
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
      : clamp(round2(P * RULE_CONFIG.profile.weeklyLossPct), RULE_CONFIG.profile.weeklyLossMinKg, RULE_CONFIG.profile.weeklyLossMaxKg);

    let weeklyLossKg = 0;
    let requiredDailyDeficit = 0;
    let rawAvgKcal = tdee;
    let kcalOff, kcalOn, actualAvgKcal, foodDeficit, missingCardioKcal;
    let transitionSteps = 0;
    let transitionZone2 = 0;

    const hasActualIntake =
      p.actualAvgIntakeKcal != null &&
      isFinite(Number(p.actualAvgIntakeKcal)) &&
      Number(p.actualAvgIntakeKcal) >= 1500;

    if (p.phase === 'cut') {
      weeklyLossKg = cutLossTarget;
      requiredDailyDeficit = Math.round(weeklyLossKg * 1100); // 7 700 kcal / kg ÷ 7 j
      rawAvgKcal = tdee - requiredDailyDeficit;
      kcalOff = Math.max(floor, Math.round(rawAvgKcal - delta));
      kcalOn = kcalOff + 2 * delta;
      actualAvgKcal = Math.round((kcalOn + kcalOff) / 2);
      const intakeForDeficit = hasActualIntake ? Math.round(Number(p.actualAvgIntakeKcal)) : actualAvgKcal;
      foodDeficit = Math.max(0, tdee - intakeForDeficit);
      missingCardioKcal = Math.max(0, requiredDailyDeficit - (tdee - intakeForDeficit));
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
    const kcalPerZone2Min = Math.max(5.5, round2(P * 0.08));
    const recommendedExtraSteps = roundTo500(missingCardioKcal / kcalPerStep);
    const recommendedZone2MinPerDay = Math.round(missingCardioKcal / kcalPerZone2Min);

    // Répartition cardio ON / OFF (cycle 1 ON / 1 OFF) :
    const gymRoundTripMin = Math.min(90, Math.max(0, roundTo5(Number(p.gymRoundTripMin != null ? p.gymRoundTripMin : DEFAULT_PROFILE.gymRoundTripMin))));
    let recommendedCardioOnMin = gymRoundTripMin;
    let recommendedCardioOffMin = 0;
    if (p.phase === 'cut' && missingCardioKcal >= 40) {
      const total2Days = Math.max(gymRoundTripMin, roundTo5(recommendedZone2MinPerDay * 2));
      if (total2Days > gymRoundTripMin) {
        const extraNeeded = total2Days - gymRoundTripMin;
        recommendedCardioOffMin = Math.min(60, roundTo5(extraNeeded));
        const overflowOn = Math.max(0, extraNeeded - recommendedCardioOffMin);
        recommendedCardioOnMin = Math.min(90, gymRoundTripMin + roundTo5(overflowOn));
      }
    }

    const nearTarget = p.phase === 'cut' && P <= targetW + 0.5;
    const maxSafeLossKg = round2(P * 0.01);
    const isAggressiveLoss = p.phase === 'cut' && weeklyLossKg > maxSafeLossKg + 0.01;
    const floorHit = p.phase === 'cut' && Math.round(rawAvgKcal - delta) < floor;
    const cutAvgForTrans = Math.max(floor, Math.round(tdee - cutLossTarget * 1100 - delta)) + delta;
    const transitionAddKcal = p.phase === 'transition' ? Math.max(0, actualAvgKcal - cutAvgForTrans) : 0;

    // 4.3 Macros & Fibres
    const parseMacro = (val, min, max) =>
      val != null && val !== '' && isFinite(Number(val)) && Number(val) >= min
        ? clamp(Math.round(Number(val)), min, max)
        : null;
    const defProt = parseMacro(p.proteinTargetG, 50, 350) ?? RULE_CONFIG.profile.proteinMaxG;
    const autoFatOnG = Math.round(RULE_CONFIG.profile.fatOnPerKg * targetW);
    const autoFatOffG = Math.round(RULE_CONFIG.profile.fatOffPerKg * targetW);
    const customGlobalFat = parseMacro(p.fatTargetG, 25, 250);

    const proteinOnG = parseMacro(p.proteinOnG, 50, 350) ?? defProt;
    const proteinOffG = parseMacro(p.proteinOffG, 50, 350) ?? defProt;
    const fatOnG = parseMacro(p.fatOnG, 25, 250) ?? customGlobalFat ?? autoFatOnG;
    const fatOffG = parseMacro(p.fatOffG, 25, 250) ?? customGlobalFat ?? autoFatOffG;
    const proteinG = proteinOnG;
    const fatG = fatOnG;
    const hasCustomMacros =
      p.proteinTargetG != null ||
      p.fatTargetG != null ||
      p.proteinOnG != null ||
      p.proteinOffG != null ||
      p.fatOnG != null ||
      p.fatOffG != null;

    const carbsFor = (dayKcal, prot, fat) => {
      const raw = Math.round((dayKcal - prot * 4 - fat * 9) / 4);
      return hasCustomMacros ? Math.max(0, raw) : Math.max(50, raw);
    };
    const fibCfg = RULE_CONFIG.fiber;
    const fiberFor = (dayKcal) => clamp(Math.round((dayKcal / 1000) * fibCfg.per1000Kcal), fibCfg.minG, fibCfg.maxG);

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
      effectiveIntakeKcal: hasActualIntake ? Math.round(Number(p.actualAvgIntakeKcal)) : actualAvgKcal,
      foodDeficit,
      missingCardioKcal,
      kcalPerZone2Min,
      recommendedExtraSteps,
      recommendedZone2MinPerDay,
      recommendedCardioOnMin,
      recommendedCardioOffMin,
      transitionWeek: transWeek,
      transitionAddKcal,
      transitionSteps,
      transitionZone2,
      nearTarget,
      proteinG,
      fatG,
      proteinOnG,
      proteinOffG,
      fatOnG,
      fatOffG,
      autoFatOnG,
      autoFatOffG,
      carbsOnG: carbsFor(kcalOn, proteinOnG, fatOnG),
      carbsOffG: carbsFor(kcalOff, proteinOffG, fatOffG),
      fiberOnG: fiberFor(kcalOn),
      fiberOffG: fiberFor(kcalOff)
    };
  }

  function buildMealPlan(rawProfile, dayType, opts) {
    const dt = String(dayType || 'ON').toUpperCase() === 'OFF' ? 'OFF' : 'ON';
    const options = opts || {};
    const foodOverrides = options.foodOverrides || null;
    const swaps = options.swaps || {};

    const targets = calculateTargets(rawProfile);
    const proteinG = dt === 'ON' ? targets.proteinOnG : targets.proteinOffG;
    const fatG = dt === 'ON' ? targets.fatOnG : targets.fatOffG;
    const customK = Number(options.overrideKcal);
    const hasCustomK = isFinite(customK) && customK >= 1500;
    const dayKcal = hasCustomK ? Math.round(customK) : dt === 'ON' ? targets.kcalOn : targets.kcalOff;
    const carbsG = hasCustomK
      ? Math.max(0, Math.round((dayKcal - proteinG * 4 - fatG * 9) / 4))
      : dt === 'ON'
      ? targets.carbsOnG
      : targets.carbsOffG;
    const fibCfg = RULE_CONFIG.fiber;
    const fiberTargetG = hasCustomK
      ? clamp(Math.round((dayKcal / 1000) * fibCfg.per1000Kcal), fibCfg.minG, fibCfg.maxG)
      : dt === 'ON'
      ? targets.fiberOnG
      : targets.fiberOffG;

    // Résolution des protéines choisies AVANT le calcul des lipides (évite toute dérive bœuf 5% / cabillaud)
    const midiProtId = swaps.midi && FOOD_DB[swaps.midi] ? swaps.midi : 'chicken';
    const soirProtId = swaps.soir && FOOD_DB[swaps.soir] ? swaps.soir : 'chicken';
    const grainId = 'pasta';
    const grainCarbRate = (getFood(grainId, foodOverrides).g || 65) / 100;
    const midiProtRate = (getFood(midiProtId, foodOverrides).p || 23) / 100;
    const soirProtRate = (getFood(soirProtId, foodOverrides).p || 23) / 100;
    const caps = RULE_CONFIG.foodCaps;
    const bases = RULE_CONFIG.mealBases;
    const pastaCap = caps.pasta;
    const spCap = caps.sweet_potato;

    // Solveur glucides + protéines avec plafonds stricts des aliments
    const solveCarbsAndProt = (baseKcal, baseP, baseG, baseL, baseF, targetCarbs) => {
      let kcal = baseKcal, p = baseP, g = baseG, l = baseL, fib = baseF;
      const add = (id, grams) => {
        if (grams <= 0) return;
        const m = macroOf(id, grams, foodOverrides);
        kcal += m.kcal; p += m.p; g += m.g; l += m.l; fib += m.fib;
      };

      const remG = Math.max(0, targetCarbs - g);
      const pastaG = Math.min(pastaCap, roundTo5((remG * 0.6) / grainCarbRate));
      add(grainId, pastaG);

      const spRate = (getFood('sweet_potato', foodOverrides).g || 20) / 100;
      const remG2 = Math.max(0, targetCarbs - g);
      const sweetPotatoG = Math.min(spCap, roundTo5(remG2 / spRate));
      add('sweet_potato', sweetPotatoG);

      let bananaG = 0, raisinsG = 0, honeyG = 0, belvitaG = 0;
      const remG3 = targetCarbs - g;
      if (remG3 > 3) {
        const bananaCap = Number(caps.banana) || 0;
        const firstBananaCap = Math.min(120, bananaCap);
        const bananaRate = (getFood('banana', foodOverrides).g || 20) / 100;
        if (firstBananaCap > 0 && remG3 >= 15) {
          bananaG = Math.min(firstBananaCap, Math.max(0, roundTo5(remG3 / bananaRate)));
          add('banana', bananaG);
        }

        const remG4 = targetCarbs - g;
        if (remG4 > 3) {
          const raisinsRate = (getFood('raisins', foodOverrides).g || 72) / 100;
          raisinsG = Math.min(caps.raisins, Math.max(0, Math.round(remG4 / raisinsRate)));
          add('raisins', raisinsG);

          // Si encore des glucides à combler (ex. Maintien ON), on complète avec la 2e banane jusqu'au plafond
          const remG5 = targetCarbs - g;
          if (remG5 > 3 && bananaG < bananaCap) {
            const extraBanana = Math.min(bananaCap - bananaG, Math.max(0, roundTo5(remG5 / bananaRate)));
            if (extraBanana > 0) {
              bananaG += extraBanana;
              add('banana', extraBanana);
            }
          }

          const remG6 = targetCarbs - g;
          if (remG6 > 4 && (Number(caps.belvita) || 0) > 0) {
            const belvitaCarbRate = (getFood('belvita', foodOverrides).g || 68) / 100;
            const bSize = bases.belvitaGPerBiscuit || 12.5;
            const maxBiscuits = Math.floor(caps.belvita / bSize);
            const nbBiscuits = Math.min(maxBiscuits, Math.max(0, Math.round(remG6 / (bSize * belvitaCarbRate))));
            belvitaG = Math.round(nbBiscuits * bSize);
            add('belvita', belvitaG);
          }
        }
      }

      const remP = Math.max(0, proteinG - p);
      let midiProtG = roundTo5((remP * 0.5) / midiProtRate);
      const remPAfterMidi = Math.max(0, remP - midiProtG * midiProtRate);
      let soirProtG = roundTo5(remPAfterMidi / soirProtRate);

      // Garde-fou protéine max : ne pas dépasser la cible de plus de 0,5 g
      while (p + midiProtG * midiProtRate + soirProtG * soirProtRate > proteinG + 0.5) {
        if (soirProtG >= 5) soirProtG -= 5;
        else if (midiProtG >= 5) midiProtG -= 5;
        else break;
      }
      add(midiProtId, midiProtG);
      add(soirProtId, soirProtG);

      return { pastaG, riceG: pastaG, sweetPotatoG, bananaG, raisinsG, honeyG, belvitaG, midiProtG, soirProtG, kcal, p, g, l, fib };
    };

    const sumBase = (eggsG, vegM, vegS, tomatoG, wheyG, chocG, pbG, walG, avoG) => {
      let kcal = 0, p = 0, g = 0, l = 0, fib = 0;
      const add = (id, grams) => {
        if (grams <= 0) return;
        const m = macroOf(id, grams, foodOverrides);
        kcal += m.kcal; p += m.p; g += m.g; l += m.l; fib += m.fib;
      };
      add('eggs', eggsG);
      add('veggies', vegM);
      add('veggies', vegS);
      add('tomato_sauce', tomatoG);
      add('whey', wheyG);
      add('dark_choc', chocG);
      add('peanut_butter', pbG);
      add('walnuts', walG);
      add('avocado', avoG);
      return { kcal, p, g, l, fib };
    };

    // Passe 1 : socle de départ + ajustement des sources de lipides (avocat, noix, huile d'olive)
    const eggsG = bases.eggs;
    let veggiesMidiG = bases.veggiesMidi;
    let veggiesSoirG = bases.veggiesSoir;
    const tomatoSauceG = Number(bases.tomatoSauceMidi) || 0;
    const wheyG = bases.whey;
    let darkChocG = bases.dark_choc;
    let peanutButterG = bases.peanut_butter;
    let walnutsG = dt === 'OFF' ? bases.walnutsOff : bases.walnutsOn;
    let avocadoG = dt === 'ON' ? bases.avocadoOn : bases.avocadoOff;
    const minOilG = bases.oilMinG != null ? Number(bases.oilMinG) : 10;

    const avoRate = (getFood('avocado', foodOverrides).l || 15) / 100;
    const walRate = (getFood('walnuts', foodOverrides).l || 65) / 100;
    const pbRate = (getFood('peanut_butter', foodOverrides).l || 50) / 100;
    const chocRate = (getFood('dark_choc', foodOverrides).l || 55) / 100;

    // Préserve au minimum minOilG (10 g = 5 g Midi + 5 g Soir) d'huile d'olive avant de descendre sous ce seuil
    const adjustFats = (currentL) => {
      let remL = fatG - currentL;
      if (remL < minOilG && avocadoG > 0) {
        const cut = Math.min(avocadoG, roundTo5((minOilG - remL) / avoRate));
        avocadoG -= cut;
        remL += cut * avoRate;
      }
      if (remL < minOilG && walnutsG > 0) {
        const cut = Math.min(walnutsG, roundTo5((minOilG - remL) / walRate));
        walnutsG -= cut;
        remL += cut * walRate;
      }
      if (remL < minOilG && peanutButterG > 0) {
        const cut = Math.min(peanutButterG, roundTo5((minOilG - remL) / pbRate));
        peanutButterG -= cut;
        remL += cut * pbRate;
      }
      if (remL < minOilG && darkChocG > 0) {
        const cut = Math.min(darkChocG, roundTo5((minOilG - remL) / chocRate));
        darkChocG -= cut;
        remL += cut * chocRate;
      }

      // Si beaucoup de lipides à combler (> 40 g restants pour l'huile) : on monte noix, avocat, beurre de cacahuète
      if (remL > 40 && walnutsG < caps.walnuts) {
        const addW = Math.min(caps.walnuts - walnutsG, Math.round((remL - 40) / walRate));
        if (addW > 0) { walnutsG += addW; remL -= addW * walRate; }
      }
      if (remL > 40 && avocadoG < caps.avocado) {
        const addA = Math.min(caps.avocado - avocadoG, roundTo5((remL - 40) / avoRate));
        if (addA > 0) { avocadoG += addA; remL -= addA * avoRate; }
      }
      if (remL > 40 && peanutButterG < caps.peanut_butter) {
        const addPb = Math.min(caps.peanut_butter - peanutButterG, roundTo5((remL - 40) / pbRate));
        if (addPb > 0) { peanutButterG += addPb; remL -= addPb * pbRate; }
      }
    };

    const b1 = sumBase(eggsG, veggiesMidiG, veggiesSoirG, tomatoSauceG, wheyG, darkChocG, peanutButterG, walnutsG, avocadoG);
    const pass1 = solveCarbsAndProt(b1.kcal, b1.p, b1.g, b1.l, b1.fib, carbsG);
    adjustFats(pass1.l);

    // Contrôle fibres avant la passe 2 pour que les protéines/glucides des légumes soient comptés
    if (pass1.fib < fibCfg.minG) {
      veggiesMidiG = fibCfg.boostVeggiesG;
      veggiesSoirG = fibCfg.boostVeggiesG;
    }

    // Passe 2 & 3 : convergence exacte calories (en tenant compte des ~2 kcal/g de fibres sur les étiquettes EU), protéines et lipides
    let effCarbs = carbsG;
    let pass2, totalOilG;
    for (let iter = 0; iter < 3; iter++) {
      const b = sumBase(eggsG, veggiesMidiG, veggiesSoirG, tomatoSauceG, wheyG, darkChocG, peanutButterG, walnutsG, avocadoG);
      pass2 = solveCarbsAndProt(b.kcal, b.p, b.g, b.l, b.fib, effCarbs);
      if (fatG - pass2.l < minOilG - 0.5 && (avocadoG > 0 || walnutsG > 0 || peanutButterG > 0 || darkChocG > 0)) {
        adjustFats(pass2.l);
        const bAdj = sumBase(eggsG, veggiesMidiG, veggiesSoirG, tomatoSauceG, wheyG, darkChocG, peanutButterG, walnutsG, avocadoG);
        pass2 = solveCarbsAndProt(bAdj.kcal, bAdj.p, bAdj.g, bAdj.l, bAdj.fib, effCarbs);
      }
      totalOilG = Math.max(0, Math.min(caps.olive_oil, Math.round(fatG - pass2.l)));
      const totKcal = pass2.kcal + macroOf('olive_oil', totalOilG, foodOverrides).kcal;
      const kcalErr = totKcal - dayKcal;
      if (Math.abs(kcalErr) <= 15) break;
      effCarbs = Math.max(0, Math.round(effCarbs - kcalErr / 4));
    }

    const { pastaG, sweetPotatoG, bananaG, raisinsG, honeyG, belvitaG, midiProtG, soirProtG } = pass2;

    const oilMidiG = totalOilG >= 5 ? Math.ceil(totalOilG / 2) : totalOilG;
    const oilSoirG = totalOilG >= 5 ? Math.floor(totalOilG / 2) : 0;
    const finalVeggiesMidiG = veggiesMidiG;
    const finalVeggiesSoirG = veggiesSoirG;
    const lowFiber = pass2.fib < fibCfg.minG;

    const makeItem = (f, g) => {
      const info = getFood(f, foodOverrides);
      const m = macroOf(f, g, foodOverrides);
      return { f, n: info.n, g, kcal: m.kcal, p: m.p, carbs: m.g, l: m.l, fib: m.fib };
    };

    const meta = RULE_CONFIG.mealMeta || {};
    const mMidiMeta = meta.midi || {};
    const mCollMeta = meta.collation || {};
    const mSoirMeta = meta.soir || {};

    const meals = [
      {
        id: 'midi',
        num: mMidiMeta.num || '1',
        name: mMidiMeta.name || 'Midi',
        sub: mMidiMeta.sub || 'Repas 1',
        supps: mMidiMeta.supps || '',
        suppNote: mMidiMeta.suppNote || '',
        items: [
          makeItem('eggs', eggsG),
          makeItem(midiProtId, midiProtG),
          makeItem(grainId, pastaG),
          makeItem('tomato_sauce', tomatoSauceG),
          makeItem('veggies', finalVeggiesMidiG),
          makeItem('olive_oil', oilMidiG)
        ].filter((i) => i.g > 0 || i.f === grainId)
      },
      {
        id: 'collation',
        num: mCollMeta.num || '2',
        name: dt === 'ON' ? (mCollMeta.nameOn || 'Shaker post-séance') : (mCollMeta.nameOff || 'Collation shaker'),
        sub: dt === 'ON' ? (mCollMeta.subOn || 'Après entraînement') : (mCollMeta.subOff || 'Dans l’après-midi'),
        items: [
          makeItem('whey', wheyG),
          makeItem('creatine', bases.creatine),
          makeItem('banana', bananaG),
          makeItem('raisins', raisinsG),
          makeItem('belvita', belvitaG),
          makeItem('walnuts', walnutsG)
        ].filter((i) => i.g > 0)
      },
      {
        id: 'soir',
        num: mSoirMeta.num || '3',
        name: mSoirMeta.name || 'Soir',
        sub: mSoirMeta.sub || 'Dîner',
        supps: mSoirMeta.supps || '',
        suppNote: mSoirMeta.suppNote || '',
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
      proteinTargetG: proteinG,
      fatTargetG: fatG,
      carbsTargetG: carbsG,
      fiberTargetG,
      lowFiber,
      quantities: {
        grainId,
        pastaG,
        riceG: pastaG,
        sweetPotatoG,
        bananaG,
        raisinsG,
        honeyG,
        belvitaG,
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
    const pastaKcalPerG = (getFood('pasta', ctx.foodOverrides)?.kcal || 348) / 100;
    const floorVal = Math.max(RULE_CONFIG.kcalMin, Number(p.kcalFloor || RULE_CONFIG.kcalMin));
    const floorStr = floorVal.toLocaleString('fr-FR');

    if (p.phase === 'transition') {
      const pastaG = Math.round(t.transitionAddKcal / pastaKcalPerG / 5) * 5;
      return {
        status: 'ok',
        action: 'none',
        title: 'Phase Transition',
        message: `Ajoute ~+${pastaG} g de pâtes complètes crues/j (+${t.transitionAddKcal} kcal) pendant 1 à 2 sem. en réduisant le cardio, puis passe en Maintien.`
      };
    }

    if (p.phase !== 'cut') {
      if (weeklyDeltaKg != null && weeklyDeltaKg > 0.3) {
        return {
          status: 'drift',
          action: 'decrease_activity',
          kcalDelta: -100,
          title: 'Légère hausse en Maintien',
          message: `Ta moyenne monte (+${fmtFr1(weeklyDeltaKg)} kg/sem) : baisse légèrement les quantités (~−100 kcal/j, soit −30 g de pâtes complètes crues/j).`,
          buttonLabel: 'Baisser de −100 kcal/j'
        };
      }
      if (weeklyDeltaKg != null && weeklyDeltaKg < -0.3) {
        return {
          status: 'drift',
          action: 'increase_activity',
          kcalDelta: 100,
          title: 'Légère baisse en Maintien',
          message: `Ta moyenne baisse (−${fmtFr1(weeklyDeltaKg)} kg/sem) : ajoute ~+100 kcal/j (+30 g de pâtes complètes crues/j) pour stabiliser ton poids.`,
          buttonLabel: 'Ajouter +100 kcal/j'
        };
      }
      return { status: 'ok', action: 'none', title: 'Maintien stable', message: 'Poids stable : garde tes quantités actuelles.' };
    }

    // Atterrissage objectif atteint
    if (t.nearTarget) {
      const halfKcal = Math.max(0, Math.round((t.tdee - t.actualAvgKcal) / 2));
      const pastaG = Math.round(halfKcal / pastaKcalPerG / 5) * 5;
      return {
        status: 'target_reached',
        action: 'switch_maintain',
        title: `Objectif ${p.targetWeightKg} kg atteint !`,
        message:
          `Ajoute +${pastaG} g de pâtes complètes crues/j (~+${halfKcal} kcal) pendant 1 semaine et coupe le cardio extra, puis passe au Maintien complet (+1,5 à +2,5 kg d’eau/glycogène normaux).`,
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
        message: `Tu perds plus vite que prévu (−${fmtFr1(loss1)} kg/sem) : ajoute ~+120 kcal/j en glucides (ex. +35 g de pâtes complètes crues/j) pour protéger ton muscle.`,
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

    // Stagnation confirmée : on vérifie la vraie marge alimentaire au-dessus du plancher
    const effectiveOffKcal =
      ctx.effectiveOffKcal != null && isFinite(Number(ctx.effectiveOffKcal))
        ? Number(ctx.effectiveOffKcal)
        : t.kcalOff;
    const marginAboveFloor = Math.round(effectiveOffKcal - floorVal);

    if (marginAboveFloor >= 50) {
      const cutKcal = Math.min(120, marginAboveFloor);
      const pastaG = Math.max(15, Math.round(cutKcal / pastaKcalPerG / 5) * 5);
      return {
        status: 'stagnating',
        action: 'decrease_activity',
        delta: -0.05,
        kcalDelta: -cutKcal,
        title: 'Stagnation — Diminue un peu les quantités',
        message: `Ta moyenne stagne : baisse d’environ −${cutKcal} kcal/j sur les glucides (ex. −${pastaG} g de pâtes complètes crues/j), en restant au-dessus du plancher ${floorStr} kcal.`,
        buttonLabel: `Baisser de −${cutKcal} kcal/j`
      };
    }

    if ((p.extraDailySteps || 0) < 5000) {
      return {
        status: 'stagnating',
        action: 'add_steps',
        stepsDelta: 2500,
        title: `Plancher ${floorStr} kcal atteint — Ajoute des pas`,
        message: `Ne baisse plus tes repas (plancher ${floorStr} kcal). Ajoute +2 500 pas/jour (~+125 kcal/j) pour relancer la perte sans toucher aux hormones.`,
        buttonLabel: 'Ajouter +2 500 pas/jour'
      };
    }

    if ((p.extraWeeklyZone2Sessions || 0) < 3) {
      return {
        status: 'stagnating',
        action: 'add_zone2',
        sessionsDelta: 1,
        title: `Plancher ${floorStr} kcal atteint — Ajoute du cardio`,
        message: 'Ne baisse plus tes repas. Ajoute +1 séance cardio léger Zone 2 (30–35 min sur jour OFF) pour augmenter la dépense sans fatigue nerveuse.',
        buttonLabel: 'Ajouter +1 séance cardio'
      };
    }

    return {
      status: 'stagnating',
      action: 'diet_break',
      title: 'Fatigue cumulée — Pause Maintien conseillée',
      message: `Plancher ${floorStr} kcal + beaucoup de cardio : passe 7 à 14 jours en Maintien (remonte les glucides) pour relancer ton métabolisme.`,
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

  // Moyennes hebdomadaires de poids Semaine N (J0..J-6) et Semaine N-1 (J-7..J-13)
  // avec repli si l'ancienne moyenne N bascule dans la fenêtre N-1.
  function computeWeeklyAvgs(weightsMap, prevWeeklyAvgs, todayStr) {
    const map = weightsMap || {};
    const prev = prevWeeklyAvgs || {};
    const t0 = dayNum(todayStr);
    if (!isFinite(t0)) {
      return { n: null, n1: null, deltaKg: null, updatedAt: todayStr || '' };
    }

    const avgWindow = (fromOffset, toOffset) => {
      const vals = Object.keys(map)
        .filter((d) => {
          const dn = dayNum(d);
          const w = Number(map[d]);
          return isFinite(dn) && isFinite(w) && w > 0 && t0 - dn >= fromOffset && t0 - dn <= toOffset;
        })
        .map((d) => Number(map[d]));
      if (!vals.length) return null;
      return {
        avg: round2(vals.reduce((a, b) => a + b, 0) / vals.length),
        n: vals.length,
        asOf: todayStr
      };
    };

    const n = avgWindow(0, 6);
    let n1 = avgWindow(7, 13);

    if (!n1 && prev.n && isFinite(Number(prev.n.avg)) && prev.n.asOf) {
      const ageN = t0 - dayNum(prev.n.asOf);
      if (isFinite(ageN) && ageN >= 7 && ageN <= 13) {
        n1 = {
          avg: round2(Number(prev.n.avg)),
          n: Number(prev.n.n) || 1,
          asOf: prev.n.asOf
        };
      }
    }

    if (!n1 && prev.n1 && isFinite(Number(prev.n1.avg)) && prev.n1.asOf) {
      const ageN1 = t0 - dayNum(prev.n1.asOf);
      if (isFinite(ageN1) && ageN1 >= 0 && ageN1 <= 13) {
        n1 = {
          avg: round2(Number(prev.n1.avg)),
          n: Number(prev.n1.n) || 1,
          asOf: prev.n1.asOf
        };
      }
    }

    const deltaKg = n && n1 ? round2(n.avg - n1.avg) : null;
    return { n, n1, deltaKg, updatedAt: todayStr };
  }

  return {
    FOOD_DB,
    RULE_CONFIG,
    DEFAULT_PROFILE,
    parseRulesMarkdown,
    applyConfig,
    getFood,
    computeRollingWeight,
    computeWeightTrend,
    computeWeeklyAvgs,
    estimateAdaptiveTDEE,
    calculateTargets,
    buildMealPlan,
    buildShoppingTotals,
    evaluateStagnation
  };
});
