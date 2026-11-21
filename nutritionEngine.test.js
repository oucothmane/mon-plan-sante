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
  assert.strictEqual(t.proteinG, 160, `Expected proteinG capped at 160, got ${t.proteinG}`);
  assert.strictEqual(t.fatG, 97, `Expected fatG 97, got ${t.fatG}`);
  assert(Math.abs(t.carbsOffG - 122) <= 1, `Expected carbsOffG ~122, got ${t.carbsOffG}`);
  assert(Math.abs(t.carbsOnG - 197) <= 1, `Expected carbsOnG ~197, got ${t.carbsOnG}`);
  assert(t.missingCardioKcal > 0, `Expected missingCardioKcal > 0, got ${t.missingCardioKcal}`);

  const planOff = NE.buildMealPlan(profile97, 'OFF');
  const planOn = NE.buildMealPlan(profile97, 'ON');

  assert(planOff.quantities.riceG <= 120, 'OFF riceG <= 120');
  assert(planOff.quantities.sweetPotatoG <= 250, 'OFF sweetPotatoG <= 250');
  assert(planOn.quantities.riceG <= 120, 'ON riceG <= 120');
  assert(planOn.quantities.sweetPotatoG <= 250, 'ON sweetPotatoG <= 250');
  assert(planOff.totals.p <= 165 && planOn.totals.p <= 165, 'Meal protein respects 160g cap');

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
  assert(t.proteinG <= 160, `Expected proteinG <= 160, got ${t.proteinG}`);
  assert.strictEqual(t.proteinG, 148, `Expected proteinG 148 at 82kg, got ${t.proteinG}`);
  assert.strictEqual(t.fatG, 82, `Expected fatG 82, got ${t.fatG}`);
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
  const shop99 = NE.buildShoppingTotals({ ...NE.DEFAULT_PROFILE, currentWeightKg: 99 }, 4, 4);
  const shop85 = NE.buildShoppingTotals({ ...NE.DEFAULT_PROFILE, currentWeightKg: 85 }, 4, 4);
  assert.strictEqual(shop99.onDays, 4);
  assert.strictEqual(shop99.offDays, 4);
  assert(shop99.totals.chicken > shop85.totals.chicken, 'Chicken shopping should drop from 99kg to 85kg');
  assert(shop99.totals.olive_oil > shop85.totals.olive_oil, 'Oil shopping should drop from 99kg to 85kg');
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
  assert(beefOil < baseOil - 5, `Expected beef5 swap to reduce olive oil (${beefOil} vs ${baseOil})`);
  assert(Math.abs(beefOn.totals.l - baseOn.targets.fatG) <= 2, `Beef5 fat drift too high: ${beefOn.totals.l} vs ${baseOn.targets.fatG}`);
  assert(Math.abs(beefOn.totals.kcal - baseOn.dayKcal) / baseOn.dayKcal <= 0.03, 'Beef5 kcal within 3%');

  const baseChicken = baseOn.quantities.chickenMidiG + baseOn.quantities.chickenSoirG;
  const pastaChicken = pastaOn.quantities.chickenMidiG + pastaOn.quantities.chickenSoirG;
  assert(pastaChicken < baseChicken, `Expected pasta swap to reduce chicken (${pastaChicken} vs ${baseChicken})`);
  assert(Math.abs(pastaOn.totals.p - baseOn.targets.proteinG) <= 3, 'Pasta protein within 3g');
  assert(Math.abs(pastaOn.totals.kcal - baseOn.dayKcal) / baseOn.dayKcal <= 0.03, 'Pasta kcal within 3%');
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
  assert(ev.message.includes('riz cru/j'), 'Landing advice mentions rice grams');

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



