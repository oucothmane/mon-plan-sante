const assert = require('assert');
const NE = require('./nutritionEngine.js');

// Cas 1 : P = 97 kg, phase = "cut", activityFactor = 1.45
{
  const profile97 = {
    age: 32,
    heightCm: 182,
    sex: 'male',
    currentWeightKg: 97,
    targetWeightKg: 82,
    phase: 'cut',
    activityFactor: 1.45,
    carbCyclingDeltaKcal: 150,
    kcalFloor: 2000
  };

  const t = NE.calculateTargets(profile97);
  assert.strictEqual(t.bmr, 1953, `Expected BMR 1953, got ${t.bmr}`);
  assert.strictEqual(t.tdee, 2832, `Expected TDEE ~2832, got ${t.tdee}`);
  assert.strictEqual(t.kcalOff, 2000, `Expected kcalOff 2000, got ${t.kcalOff}`);
  assert.strictEqual(t.kcalOn, 2300, `Expected kcalOn 2300, got ${t.kcalOn}`);
  assert.strictEqual(t.proteinG, 165, `Expected proteinG fixed at 165, got ${t.proteinG}`);
  assert.strictEqual(t.fatOnG, 82, `Expected fatOnG 82, got ${t.fatOnG}`);
  assert.strictEqual(t.fatOffG, 98, `Expected fatOffG 98, got ${t.fatOffG}`);
  assert(Math.abs(t.carbsOffG - 115) <= 1, `Expected carbsOffG ~115, got ${t.carbsOffG}`);
  assert(Math.abs(t.carbsOnG - 226) <= 1, `Expected carbsOnG ~226, got ${t.carbsOnG}`);
  assert(t.missingCardioKcal > 0, `Expected missingCardioKcal > 0, got ${t.missingCardioKcal}`);

  const planOff = NE.buildMealPlan(profile97, 'OFF');
  const planOn = NE.buildMealPlan(profile97, 'ON');

  assert(planOff.quantities.riceG <= 120, 'OFF riceG <= 120');
  assert(planOff.quantities.sweetPotatoG <= 250, 'OFF sweetPotatoG <= 250');
  assert(planOn.quantities.riceG <= 120, 'ON riceG <= 120');
  assert(planOn.quantities.sweetPotatoG <= 250, 'ON sweetPotatoG <= 250');
  assert(planOff.totals.p <= 170 && planOn.totals.p <= 170, 'Meal protein respects 165g target');

  const errOff = Math.abs(planOff.totals.kcal - t.kcalOff) / t.kcalOff;
  const errOn = Math.abs(planOn.totals.kcal - t.kcalOn) / t.kcalOn;
  assert(errOff <= 0.03, `OFF kcal error ${(errOff * 100).toFixed(2)}% > 3%`);
  assert(errOn <= 0.03, `ON kcal error ${(errOn * 100).toFixed(2)}% > 3%`);
  console.log('Cas 1 (97 kg) OK');
}

// Cas 2 : P = 82 kg, phase = "cut", activityFactor = 1.45
{
  const profile82 = {
    age: 32,
    heightCm: 182,
    sex: 'male',
    currentWeightKg: 82,
    targetWeightKg: 82,
    phase: 'cut',
    activityFactor: 1.45,
    carbCyclingDeltaKcal: 150,
    kcalFloor: 2000
  };

  const t = NE.calculateTargets(profile82);
  assert.strictEqual(t.proteinG, 165, `Expected proteinG fixed at 165, got ${t.proteinG}`);
  assert.strictEqual(t.fatOnG, 82, `Expected fatOnG 82, got ${t.fatOnG}`);
  assert.strictEqual(t.fatOffG, 98, `Expected fatOffG 98, got ${t.fatOffG}`);
  assert.strictEqual(t.kcalOff, 2000, `Expected kcalOff 2000, got ${t.kcalOff}`);
  assert.strictEqual(t.kcalOn, 2300, `Expected kcalOn 2300, got ${t.kcalOn}`);

  const planOn = NE.buildMealPlan(profile82, 'ON');
  assert(planOn.quantities.riceG <= 120, 'ON riceG <= 120');
  assert(planOn.quantities.sweetPotatoG <= 250, 'ON sweetPotatoG <= 250');
  assert(planOn.quantities.raisinsG > 0, `Expected raisinsG > 0 on 82kg ON day, got ${planOn.quantities.raisinsG}`);

  const errOn = Math.abs(planOn.totals.kcal - t.kcalOn) / t.kcalOn;
  assert(errOn <= 0.03, `ON kcal error ${(errOn * 100).toFixed(2)}% > 3%`);
  console.log('Cas 2 (82 kg) OK');
}

// Angle mort 1 : Courses dynamiques (4 ON + 4 OFF = cycle 8 jours)
{
  const shop99 = NE.buildShoppingTotals({ ...NE.DEFAULT_PROFILE, currentWeightKg: 99, targetWeightKg: 82 }, 4, 4);
  const shop75 = NE.buildShoppingTotals({ ...NE.DEFAULT_PROFILE, currentWeightKg: 75, targetWeightKg: 75 }, 4, 4);
  assert.strictEqual(shop99.onDays, 4);
  assert.strictEqual(shop99.offDays, 4);
  assert(shop99.totals.olive_oil > shop75.totals.olive_oil, 'Oil shopping should drop when targetWeightKg drops from 82kg to 75kg');
  console.log('Angle mort 1 (Courses 4 ON + 4 OFF dynamiques) OK');
}

// Angle mort 2 : Moyenne glissante 7 jours ignorant les jours sans repas cochés
{
  const entries = [
    { date: '2026-11-16', weightKg: 98.0, mealsChecked: 3 },
    { date: '2026-11-18', weightKg: 97.6, mealsChecked: 3 },
    { date: '2026-11-20', weightKg: 99.0, mealsChecked: 0 } // Repas non cochés -> ignoré !
  ];
  const roll = NE.computeRollingWeight(entries, 99, '2026-11-20');
  assert.strictEqual(roll.weightKg, 97.8, `Expected rolling avg 97.8, got ${roll.weightKg}`);
  assert.strictEqual(roll.ignoredCount, 1);
  console.log('Angle mort 2 (Moyenne glissante 7j sans yo-yo) OK');
}

// Angle mort 3 : Swaps bœuf 5% & pâtes complètes compensés sur huile & poulet
{
  const p97 = { ...NE.DEFAULT_PROFILE, currentWeightKg: 97 };
  const baseOn = NE.buildMealPlan(p97, 'ON');
  const beefOn = NE.buildMealPlan(p97, 'ON', { swaps: { midi: 'beef5', soir: 'beef5' } });
  const pastaOn = NE.buildMealPlan(p97, 'ON', { usePasta: true });

  const baseOil = baseOn.quantities.oilMidiG + baseOn.quantities.oilSoirG;
  const beefOil = beefOn.quantities.oilMidiG + beefOn.quantities.oilSoirG;
  const baseAddedFat = baseOil + baseOn.quantities.walnutsG * 0.65;
  const beefAddedFat = beefOil + beefOn.quantities.walnutsG * 0.65;
  assert(beefAddedFat < baseAddedFat - 5, `Expected beef5 swap to reduce added fat (${beefAddedFat.toFixed(1)} vs ${baseAddedFat.toFixed(1)})`);
  assert(Math.abs(beefOn.totals.l - baseOn.targets.fatG) <= 2, `Beef5 fat drift too high: ${beefOn.totals.l} vs ${baseOn.targets.fatG}`);
  assert(Math.abs(beefOn.totals.kcal - baseOn.dayKcal) / baseOn.dayKcal <= 0.03, 'Beef5 kcal within 3%');

  const baseChicken = baseOn.quantities.chickenMidiG + baseOn.quantities.chickenSoirG;
  const pastaChicken = pastaOn.quantities.chickenMidiG + pastaOn.quantities.chickenSoirG;
  assert.strictEqual(pastaChicken, baseChicken, 'Pasta is always the default grain (no rice)');
  assert(baseOn.meals[0].items.some((i) => i.f === 'pasta'), 'Midi meal uses pasta');
  assert(!baseOn.meals[0].items.some((i) => i.f === 'rice'), 'Midi meal has no rice');
  assert(Math.abs(pastaOn.totals.p - baseOn.targets.proteinG) <= 3, 'Pasta protein within 3g');
  assert(Math.abs(pastaOn.totals.kcal - baseOn.dayKcal) / baseOn.dayKcal <= 0.03, 'Pasta kcal within 3%');
  assert.strictEqual(NE.RULE_CONFIG.kcalMin, 2000, 'REGLES_ET_EQUATIONS.md kcalMin is 2000');
  assert.strictEqual(NE.RULE_CONFIG.defaultTargets.seche.on, 2200, 'Cut ON = 2200');
  assert.strictEqual(NE.RULE_CONFIG.defaultTargets.seche.off, 2000, 'Cut OFF = 2000');
  assert.strictEqual(NE.RULE_CONFIG.defaultTargets.maintien.on, 2400, 'Maintien ON = 2400');
  assert.strictEqual(NE.RULE_CONFIG.defaultTargets.maintien.off, 2200, 'Maintien OFF = 2200');
  console.log('Angle mort 3 (Swaps bœuf 5% & pâtes sans dérive macros) OK:', {
    baseOil,
    beefOil,
    baseChicken,
    pastaChicken
  });
}

// Angle mort 4 : Fausse stagnation (Tour de taille en baisse & Sommeil < 7h)
{
  const pFloor = { ...NE.DEFAULT_PROFILE, currentWeightKg: 95, activityFactor: 1.45 };
  const waistGuard = NE.evaluateStagnation(pFloor, -0.1, -0.1, true, { waistDeltaCm: -1.0 });
  assert.strictEqual(waistGuard.status, 'recomp');
  assert.strictEqual(waistGuard.action, 'none');

  const sleepGuard = NE.evaluateStagnation(pFloor, -0.1, -0.1, true, { waistDeltaCm: 0, sleepUnder7h: true });
  assert.strictEqual(sleepGuard.status, 'sleep');
  assert.strictEqual(sleepGuard.action, 'none');
  console.log('Angle mort 4 (Garde-fous Tour de taille & Sommeil) OK');
}

// Angle mort 5 : Atterrissage 82 kg (~2500 kcal maintien bureau assis)
{
  const p82Cut = { ...NE.DEFAULT_PROFILE, currentWeightKg: 82, targetWeightKg: 82, phase: 'cut', extraDailySteps: 5000, extraWeeklyZone2Sessions: 2 };
  const ev = NE.evaluateStagnation(p82Cut, -0.6, -0.6, false);
  assert.strictEqual(ev.action, 'switch_maintain');
  assert(ev.message.includes('pâtes complètes crues/j'), 'Landing advice mentions pasta grams');

  const tMaint = NE.calculateTargets({ ...p82Cut, phase: 'maintain' });
  assert(Math.abs(tMaint.tdee - 2500) <= 20, `Expected ~2500 kcal maintenance at 82kg desk job, got ${tMaint.tdee}`);
  console.log('Angle mort 5 (Atterrissage 82 kg -> ~2500 kcal maintien) OK:', {
    tdee: tMaint.tdee,
    advice: ev.message
  });
}

// Arbre de décision stagnation standard
{
  const pAbove = { ...NE.DEFAULT_PROFILE, currentWeightKg: 99, activityFactor: 1.65 };
  assert.strictEqual(NE.evaluateStagnation(pAbove, -0.2, -0.2, false).action, 'decrease_activity');

  const pFloor0 = { ...NE.DEFAULT_PROFILE, currentWeightKg: 97, activityFactor: 1.45, extraDailySteps: 0, extraWeeklyZone2Sessions: 0 };
  assert.strictEqual(NE.evaluateStagnation(pFloor0, -0.2, -0.2, false).action, 'add_steps');

  const pFloor1 = { ...pFloor0, extraDailySteps: 5000 };
  assert.strictEqual(NE.evaluateStagnation(pFloor1, -0.2, -0.2, false).action, 'add_zone2');

  const pFloor2 = { ...pFloor1, extraWeeklyZone2Sessions: 3 };
  assert.strictEqual(NE.evaluateStagnation(pFloor2, -0.2, -0.2, false).action, 'diet_break');

  assert.strictEqual(NE.evaluateStagnation(pFloor0, -1.3, -0.8, false).action, 'increase_activity');
  console.log('Stagnation tree OK');
}

// Cible calorique personnalisée (overrideKcal)
{
  const p97 = { ...NE.DEFAULT_PROFILE, currentWeightKg: 97, phase: 'cut' };
  const customOn = NE.buildMealPlan(p97, 'ON', { overrideKcal: 2150 });
  assert.strictEqual(customOn.dayKcal, 2150, `Expected dayKcal 2150, got ${customOn.dayKcal}`);
  const expectedCarbs = Math.round((2150 - customOn.targets.proteinG * 4 - customOn.targets.fatG * 9) / 4);
  assert.strictEqual(customOn.carbsTargetG, expectedCarbs, `Expected carbsTargetG ${expectedCarbs}, got ${customOn.carbsTargetG}`);
  const errCustom = Math.abs(customOn.totals.kcal - 2150) / 2150;
  assert(errCustom <= 0.03, `Custom kcal error ${(errCustom * 100).toFixed(2)}% > 3%`);
  console.log('Custom overrideKcal (2150 kcal) OK:', { dayKcal: customOn.dayKcal, totalKcal: Math.round(customOn.totals.kcal), carbsTargetG: customOn.carbsTargetG });
}

// Rythme de perte personnalisable (0.25 / 0.5 / 1.0 kg/sem) + plancher 2000 kcal + stagnation sur choix final
{
  const base97 = { ...NE.DEFAULT_PROFILE, currentWeightKg: 97, phase: 'cut' };
  const slow = NE.calculateTargets({ ...base97, weeklyLossTargetKg: 0.25 });
  const med = NE.calculateTargets({ ...base97, weeklyLossTargetKg: 0.5 });
  const fast = NE.calculateTargets({ ...base97, weeklyLossTargetKg: 1.0 });

  assert.strictEqual(slow.weeklyLossKg, 0.25);
  assert(slow.kcalOff > 2000 && slow.missingCardioKcal === 0, '0.25 kg/wk stays above floor with 0 cardio');
  assert.strictEqual(med.weeklyLossKg, 0.5);
  assert(med.kcalOff >= 2000, '0.5 kg/wk respects 2000 floor');
  assert.strictEqual(fast.weeklyLossKg, 1.0);
  assert.strictEqual(fast.kcalOff, 2000, '1.0 kg/wk enforces 2000 kcal floor');
  assert.strictEqual(fast.kcalOn, 2300, '1.0 kg/wk preserves +300 kcal ON carb cycling');
  assert(fast.missingCardioKcal > 400 && fast.recommendedExtraSteps >= 8000, '1.0 kg/wk recommends cardio compensation');
  assert.strictEqual(fast.isAggressiveLoss, true, '1.0 kg/wk at 97kg flagged > 1%/wk');

  // Stagnation quand le choix final perso est au-dessus du plancher (2200 OFF) -> baisse quantités
  const stagMargin = NE.evaluateStagnation(base97, -0.1, -0.1, true, { effectiveOffKcal: 2200 });
  assert.strictEqual(stagMargin.action, 'decrease_activity');
  assert(!/PAL/i.test(stagMargin.message + stagMargin.buttonLabel), 'No technical PAL jargon');

  // Stagnation au plancher (2000 OFF) -> pas/cardio, jamais baisse sous 2000
  const stagFloor = NE.evaluateStagnation(base97, -0.1, -0.1, true, { effectiveOffKcal: 2000 });
  assert.strictEqual(stagFloor.action, 'add_steps');
  console.log('Weekly loss rate + floor stagnation OK:', {
    slow: `${slow.kcalOn}/${slow.kcalOff}`,
    med: `${med.kcalOn}/${med.kcalOff}`,
    fast: `${fast.kcalOn}/${fast.kcalOff} (+${fast.recommendedExtraSteps} pas/j)`
  });
}

// Tendance lissée EWMA & TDEE adaptatif réel (façon MacroFactor)
{
  const pts = [
    { date: '2026-11-10', weightKg: 98.0 },
    { date: '2026-11-12', weightKg: 97.7 },
    { date: '2026-11-14', weightKg: 97.5 },
    { date: '2026-11-16', weightKg: 98.7 }, // pic d'eau ponctuel +1,2 kg
    { date: '2026-11-18', weightKg: 97.3 }
  ];
  const trended = NE.computeWeightTrend(pts);
  assert(trended[3].trendKg < 98.3, `EWMA should smooth single-day water spike, got ${trended[3].trendKg}`);
  assert(trended[4].trendKg < trended[0].trendKg, 'Overall trend should stay downward');

  const weights = [
    { date: '2026-11-01', weightKg: 98.5 },
    { date: '2026-11-03', weightKg: 98.4 },
    { date: '2026-11-05', weightKg: 98.3 },
    { date: '2026-11-15', weightKg: 97.5 },
    { date: '2026-11-17', weightKg: 97.4 },
    { date: '2026-11-19', weightKg: 97.3 }
  ];
  const kcalLog = {};
  for (let d = 1; d <= 14; d++) {
    kcalLog[`2026-11-${String(d + 5).padStart(2, '0')}`] = d % 2 === 0 ? 2300 : 2000; // moy 2150 kcal
  }
  const ad = NE.estimateAdaptiveTDEE(weights, kcalLog, 2695, '2026-11-19');
  assert.strictEqual(ad.ready, true, 'Adaptive TDEE should be ready with 14 logged days + 2 weeks weights');
  assert.strictEqual(ad.confidence, 'high');
  assert(ad.adaptiveTdee >= 2650 && ad.adaptiveTdee <= 2760, `Expected adaptive TDEE ~2700, got ${ad.adaptiveTdee}`);

  const notReady = NE.estimateAdaptiveTDEE(weights, { '2026-11-19': 2150 }, 2695, '2026-11-19');
  assert.strictEqual(notReady.ready, false, 'Adaptive TDEE should not activate on 1 day');
  console.log('EWMA trend + Adaptive TDEE OK:', {
    spikeSmooth: `${pts[3].weightKg} -> ${trended[3].trendKg}`,
    adaptiveTdee: ad.adaptiveTdee,
    weeklyDeltaKg: ad.weeklyDeltaKg
  });
}

// Déficit/cardio basé sur ce que l'utilisateur mange réellement (2200 moy) + Maintien 2500/2300
{
  const p99 = { ...NE.DEFAULT_PROFILE, currentWeightKg: 99, phase: 'cut', weeklyLossTargetKg: 0.75, actualAvgIntakeKcal: 2200 };
  const t = NE.calculateTargets(p99);
  assert.strictEqual(t.effectiveIntakeKcal, 2200);
  assert.strictEqual(t.foodDeficit, t.tdee - 2200);
  assert.strictEqual(t.missingCardioKcal, Math.max(0, t.requiredDailyDeficit - (t.tdee - 2200)));

  const maint82On = NE.buildMealPlan({ ...NE.DEFAULT_PROFILE, currentWeightKg: 82, phase: 'maintain' }, 'ON', { overrideKcal: 2500 });
  const errM = Math.abs(maint82On.totals.kcal - 2500) / 2500;
  assert(errM <= 0.03, `Maintien 2500 ON kcal error ${(errM * 100).toFixed(2)}% > 3% (got ${Math.round(maint82On.totals.kcal)})`);
  console.log('Actual intake cardio + Maintien 2500 OK:', {
    foodDeficit: t.foodDeficit,
    missingCardioKcal: t.missingCardioKcal,
    extraSteps: t.recommendedExtraSteps,
    maint2500: Math.round(maint82On.totals.kcal)
  });
}

// Répartition cardio ON / OFF (50 min aller-retour salle en Jour ON + complément Jour OFF)
{
  const cut08 = NE.calculateTargets({
    ...NE.DEFAULT_PROFILE,
    currentWeightKg: 97,
    phase: 'cut',
    weeklyLossTargetKg: 0.8,
    actualAvgIntakeKcal: 2200
  });
  assert.strictEqual(cut08.recommendedCardioOnMin, 50, 'ON day carries the 50 min gym round-trip');
  assert(cut08.recommendedCardioOffMin >= 30 && cut08.recommendedCardioOffMin <= 60, 'OFF day carries complementary cardio up to 60 min');

  const cut078 = NE.calculateTargets({
    ...NE.DEFAULT_PROFILE,
    currentWeightKg: 97,
    phase: 'cut',
    actualAvgIntakeKcal: 2150
  });
  assert.strictEqual(cut078.recommendedCardioOnMin, 50, 'ON day stays at 50 min gym round-trip');
  assert.strictEqual(cut078.recommendedCardioOffMin, 30, 'OFF day lands at 30 min');

  const cut05 = NE.calculateTargets({
    ...NE.DEFAULT_PROFILE,
    currentWeightKg: 97,
    phase: 'cut',
    weeklyLossTargetKg: 0.5,
    actualAvgIntakeKcal: 2200
  });
  assert.strictEqual(cut05.recommendedCardioOnMin, 50, '50 min gym round-trip already covers light cardio');
  assert.strictEqual(cut05.recommendedCardioOffMin, 0, 'No extra OFF cardio needed when 50 min ON suffices');

  const maint = NE.calculateTargets({
    ...NE.DEFAULT_PROFILE,
    currentWeightKg: 97,
    phase: 'maintain',
    actualAvgIntakeKcal: 2400
  });
  assert.strictEqual(maint.recommendedCardioOnMin, 50, 'Maintien keeps 50 min gym round-trip on ON days');
  assert.strictEqual(maint.recommendedCardioOffMin, 0, 'Maintien requires 0 min on OFF days');
  console.log('Cardio ON/OFF split OK:', {
    cut08: `${cut08.recommendedCardioOnMin} ON / ${cut08.recommendedCardioOffMin} OFF`,
    cut078: `${cut078.recommendedCardioOnMin} ON / ${cut078.recommendedCardioOffMin} OFF`,
    cut05: `${cut05.recommendedCardioOnMin} ON / ${cut05.recommendedCardioOffMin} OFF`,
    maint: `${maint.recommendedCardioOnMin} ON / ${maint.recommendedCardioOffMin} OFF`
  });
}

// Moyennes hebdomadaires stockées Semaine N (J0..J-6) & Semaine N-1 (J-7..J-13) + repli N -> N-1
{
  const weights = {
    '2026-11-08': 98.4,
    '2026-11-10': 98.2,
    '2026-11-12': 98.0, // Semaine N-1 (J-7..J-13 par rapport au 2026-11-21) -> moy 98.2
    '2026-11-15': 97.6,
    '2026-11-18': 97.4,
    '2026-11-21': 97.2  // Semaine N (J0..J-6 par rapport au 2026-11-21) -> moy 97.4
  };
  const avgs = NE.computeWeeklyAvgs(weights, null, '2026-11-21');
  assert.strictEqual(avgs.n.avg, 97.4);
  assert.strictEqual(avgs.n.n, 3);
  assert.strictEqual(avgs.n1.avg, 98.2);
  assert.strictEqual(avgs.n1.n, 3);
  assert.strictEqual(avgs.deltaKg, -0.8);

  // Repli si aucune pesée dans J-7..J-13 mais l'ancienne moyenne N (d'il y a 7 jours) bascule en N-1
  const prevOnlyN = NE.computeWeeklyAvgs({ '2026-11-14': 98.1 }, null, '2026-11-14');
  assert.strictEqual(prevOnlyN.n.avg, 98.1);
  const shifted = NE.computeWeeklyAvgs({ '2026-11-21': 97.7 }, prevOnlyN, '2026-11-21');
  assert.strictEqual(shifted.n.avg, 97.7);
  assert.strictEqual(shifted.n1.avg, 98.1, 'Old Semaine N should shift into Semaine N-1 after 7 days');
  assert.strictEqual(shifted.deltaKg, -0.4);

  // Modification / suppression de pesée
  const modified = NE.computeWeeklyAvgs({ '2026-11-21': 97.5 }, shifted, '2026-11-21');
  assert.strictEqual(modified.n.avg, 97.5);
  assert.strictEqual(modified.n1.avg, 98.1, 'Stored N-1 preserved within 7 days');
  assert.strictEqual(modified.deltaKg, -0.6);

  const deleted = NE.computeWeeklyAvgs({}, modified, '2026-11-21');
  assert.strictEqual(deleted.n, null);
  assert.strictEqual(deleted.n1.avg, 98.1);
  assert.strictEqual(deleted.deltaKg, null);

  console.log('Weekly avgs (Sem. N / Sem. N-1 + repli) OK:', {
    n: avgs.n.avg,
    n1: avgs.n1.avg,
    deltaKg: avgs.deltaKg,
    shiftedN1: shifted.n1.avg
  });
}

// Macros personnalisées (165 g prot max + 100 g lipides + reste en glucides) et respect des limites aliments
{
  const customMacroProfile = {
    ...NE.DEFAULT_PROFILE,
    currentWeightKg: 99,
    proteinTargetG: 165,
    fatTargetG: 100
  };
  const t = NE.calculateTargets(customMacroProfile);
  assert.strictEqual(t.proteinG, 165);
  assert.strictEqual(t.fatG, 100);
  assert.strictEqual(t.carbsOnG, Math.round((t.kcalOn - 165 * 4 - 100 * 9) / 4));
  assert.strictEqual(t.carbsOffG, Math.round((t.kcalOff - 165 * 4 - 100 * 9) / 4));

  const onPlan = NE.buildMealPlan(customMacroProfile, 'ON');
  const offPlan = NE.buildMealPlan(customMacroProfile, 'OFF');
  [onPlan, offPlan].forEach((pl) => {
    assert(pl.totals.p <= 165.5, `${pl.dayType} protein ${pl.totals.p} exceeded 165g max`);
    assert(Math.abs(pl.totals.l - 100) <= 1.5, `${pl.dayType} fat ${pl.totals.l} != 100g`);
    assert(Math.abs(pl.totals.kcal - pl.dayKcal) / pl.dayKcal <= 0.03, `${pl.dayType} kcal drift > 3%`);
    assert(pl.quantities.riceG <= 120, 'rice <= 120');
    assert(pl.quantities.sweetPotatoG <= 250, 'sweetPotato <= 250');
    assert(pl.quantities.raisinsG <= 50, 'raisins <= 50');
    assert(pl.quantities.honeyG <= 30, 'honey <= 30');
    assert(pl.quantities.belvitaG <= 75, 'belvita <= 75');
    assert(pl.quantities.walnutsG <= 35, 'walnuts <= 35');
    assert(pl.quantities.avocadoG <= 100, 'avocado <= 100');
  });

  // Cas lipides bas (65 g) et protéines personnalisées (140 g)
  const lowFatPlan = NE.buildMealPlan(
    { ...NE.DEFAULT_PROFILE, proteinTargetG: 140, fatTargetG: 65 },
    'OFF',
    { overrideKcal: 2000 }
  );
  assert(lowFatPlan.totals.p <= 140.5, `LowFat protein ${lowFatPlan.totals.p} > 140.5`);
  assert(Math.abs(lowFatPlan.totals.l - 65) <= 2, `LowFat fat ${lowFatPlan.totals.l} != 65`);
  assert(Math.abs(lowFatPlan.totals.kcal - 2000) / 2000 <= 0.03, 'LowFat kcal drift > 3%');

  console.log('Custom proteinTargetG / fatTargetG + food limits OK:', {
    carbsOnG: t.carbsOnG,
    carbsOffG: t.carbsOffG,
    onP: Math.round(onPlan.totals.p),
    onL: Math.round(onPlan.totals.l),
    offP: Math.round(offPlan.totals.p),
    offL: Math.round(offPlan.totals.l)
  });

  // Macros distinctes Jour ON vs Jour OFF
  const splitProfile = {
    ...NE.DEFAULT_PROFILE,
    currentWeightKg: 99,
    proteinOnG: 165,
    fatOnG: 80,
    proteinOffG: 160,
    fatOffG: 105
  };
  const splitOn = NE.buildMealPlan(splitProfile, 'ON');
  const splitOff = NE.buildMealPlan(splitProfile, 'OFF');
  assert.strictEqual(splitOn.proteinTargetG, 165);
  assert.strictEqual(splitOn.fatTargetG, 80);
  assert.strictEqual(splitOff.proteinTargetG, 160);
  assert.strictEqual(splitOff.fatTargetG, 105);
  assert(splitOn.totals.p <= 165.5 && Math.abs(splitOn.totals.l - 80) <= 1.5);
  assert(splitOff.totals.p <= 160.5 && Math.abs(splitOff.totals.l - 105) <= 1.5);
  console.log('Distinct ON/OFF macro targets OK');

  // Vérification des valeurs par défaut (165 g prot, 1.0 g/kg cible ON, 1.2 g/kg cible OFF) en Cut et en Maintien
  ['cut', 'maintain'].forEach((ph) => {
    const defT = NE.calculateTargets({ ...NE.DEFAULT_PROFILE, phase: ph });
    assert.strictEqual(defT.proteinOnG, 165);
    assert.strictEqual(defT.proteinOffG, 165);
    assert.strictEqual(defT.fatOnG, 82);
    assert.strictEqual(defT.fatOffG, 98);
  });
  console.log('Default macros (165P / 82 ON / 98 OFF) in Cut & Maintain OK');

  // Vérification lecture des 5 JSON et absence de valeurs figées dans le code
  const fs = require('fs');
  const rulesJson = JSON.parse(fs.readFileSync('./plan-rules.json', 'utf8'));
  const foodsJson = JSON.parse(fs.readFileSync('./foods.json', 'utf8'));
  const mealsJson = JSON.parse(fs.readFileSync('./meals.json', 'utf8'));
  const coursesJson = JSON.parse(fs.readFileSync('./courses.json', 'utf8'));
  const splitJson = JSON.parse(fs.readFileSync('./split.json', 'utf8'));

  assert.strictEqual(NE.RULE_CONFIG.kcalMin, rulesJson.kcalMin);
  assert.deepStrictEqual(NE.RULE_CONFIG.defaultTargets, rulesJson.defaultTargets);
  assert.strictEqual(Object.keys(NE.FOOD_DB).length, Object.keys(foodsJson.foods).length);
  assert(!NE.FOOD_DB.rice, 'No rice in FOOD_DB');
  assert(mealsJson.phases.cut && mealsJson.phases.maintien, 'meals.json has cut and maintien');
  assert(coursesJson.shopRules && Array.isArray(coursesJson.shopRules.epicerie), 'courses.json has shopRules');
  assert(splitJson.sessions && Array.isArray(splitJson.cycleKeys), 'split.json has sessions and cycleKeys');
  assert.deepStrictEqual(
    splitJson.cycleKeys,
    ['A', null, 'B', null, 'C', null, 'D', null],
    '8-day Full Body cycleKeys'
  );
  assert.deepStrictEqual(Object.keys(splitJson.sessions), ['A', 'B', 'C', 'D'], '4 Full Body sessions');
  ['A', 'B', 'C', 'D'].forEach((k) => {
    const sess = splitJson.sessions[k];
    assert(sess, `Missing session ${k}`);
    assert.strictEqual(sess.ex.length, 7, `${k} should have 7 exercises, got ${sess.ex.length}`);
    const baseSets = sess.ex.filter((x) => x.sets != null).reduce((sum, x) => sum + x.sets, 0);
    assert.strictEqual(baseSets, 20, `${k} should have 20 base sets, got ${baseSets}`);
  });
  console.log('5 JSON sources + Full Body 4-session split.json loaded & verified OK');
}

