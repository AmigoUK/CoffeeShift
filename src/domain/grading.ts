import type { Recipe } from './recipes';
import { EXTRACTION, MILK_TEMP, parFor, SMALL_JUG_MAX_ML } from './recipes';
import type {
  DrinkOrder,
  FeedbackId,
  PreparedDrink,
  ScoreReport,
  ScoreSummary,
  SizeId,
  SummaryOpenerId,
} from './types';

interface Check {
  earned: number;
  possible: number;
  applicable: boolean;
}

function chk(earned: number, possible: number, applicable = true): Check {
  return { earned: Math.max(0, Math.min(earned, possible)), possible, applicable };
}

function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/** Category score = total × (earned/possible) over applicable checks only. */
function allocate(total: number, checks: Check[]): number {
  const active = checks.filter((c) => c.applicable);
  const possible = active.reduce((s, c) => s + c.possible, 0);
  if (possible === 0) return total;
  const earned = active.reduce((s, c) => s + c.earned, 0);
  return roundHalfUp((total * earned) / possible);
}

function nearestSize(table: Partial<Record<SizeId, number>>, volumeMl: number): SizeId | null {
  let best: SizeId | null = null;
  let bestDistance = Infinity;
  for (const key of Object.keys(table) as SizeId[]) {
    const distance = Math.abs((table[key] ?? 0) - volumeMl);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = key;
    }
  }
  return best;
}

/** Infer the served size from prepared volumes; null when it cannot be inferred. */
function inferSize(recipe: Recipe, prepared: PreparedDrink): SizeId | null {
  if (recipe.milkDrink) {
    const volume = prepared.milk?.volumeMl;
    if (volume == null) return null;
    return nearestSize(recipe.milkVolumeMl, volume);
  }
  if (recipe.drink === 'americano') {
    if (prepared.waterMl == null) return null;
    return nearestSize(recipe.waterVolumeMl, prepared.waterMl);
  }
  return 'small';
}

function milkFailThreshold(order: DrinkOrder, milkType: string | null | undefined): number {
  if (order.extraHot) return MILK_TEMP.extraHot.failAt;
  return milkType === 'oat' ? MILK_TEMP.oat.failAt : MILK_TEMP.dairy.failAt;
}

function timeScore(order: DrinkOrder, prepared: PreparedDrink): number {
  if (!prepared.timedLevel) return 10;
  const par = parFor(order);
  const t = prepared.elapsedSeconds;
  if (t <= par) return 10;
  if (t <= 2 * par) return roundHalfUp(10 - (8 * (t - par)) / par);
  if (t <= 4 * par) return roundHalfUp(2 - (t - 2 * par) / par);
  return 0;
}

function wasteScore(prepared: PreparedDrink): number {
  const count = (tag: string) => prepared.wasteEvents.filter((e) => e === tag).length;
  const penalty =
    2 * count('binned-drink') + 2 * count('lost-customer') + 1 * count('emptied-jug') + 1 * count('jug-overflow');
  return Math.max(0, 5 - penalty);
}

/**
 * Grade a prepared drink against the ordered drink using the House Standard.
 * Category weights: orderMatch 45 / recipe 25 / technique 15 / time 10 / waste 5.
 */
export function grade(order: DrinkOrder, prepared: PreparedDrink, drink: Recipe): ScoreReport {
  const feedback: FeedbackId[] = [];
  const add = (f: FeedbackId) => {
    if (!feedback.includes(f)) feedback.push(f);
  };

  // ---- orderMatch /45: drink 15, vessel 10, milk 5, size 5, shots 5, extraHot 5 ----
  const drinkOk = prepared.drink === order.drink;
  const expectedVessel = order.takeaway ? 'takeaway-cup' : drink.houseVessel;
  const vesselOk = prepared.vessel === expectedVessel;
  const milkOk = drink.milkDrink ? prepared.milk?.typeUsed === order.milk : prepared.milk == null;
  const inferredSize = inferSize(drink, prepared);
  const sizeOk = inferredSize !== null && inferredSize === order.size;
  const shotsOk = prepared.pulls.length === order.shots;
  const extraHotOk =
    order.extraHot &&
    prepared.milk?.tempC != null &&
    prepared.milk.tempC >= MILK_TEMP.extraHot.target[0] &&
    prepared.milk.tempC <= MILK_TEMP.extraHot.target[1];

  const orderMatch = allocate(45, [
    chk(drinkOk ? 15 : 0, 15),
    chk(vesselOk ? 10 : 0, 10),
    chk(milkOk ? 5 : 0, 5),
    chk(sizeOk ? 5 : 0, 5, inferredSize !== null),
    chk(shotsOk ? 5 : 0, 5),
    chk(extraHotOk ? 5 : 0, 5, order.extraHot),
  ]);

  // ---- recipe /25: foam 10, milk volume 5, water 5, assembly 5, jug 3 ----
  const milkUsed = drink.milkDrink && prepared.milk != null;
  const foamOk =
    milkUsed &&
    drink.foamOkCm != null &&
    prepared.milk != null &&
    prepared.milk.foamCm >= drink.foamOkCm[0] &&
    prepared.milk.foamCm <= drink.foamOkCm[1];
  const milkSpec = drink.milkVolumeMl[order.size] ?? null;
  const milkVolumeOk =
    milkUsed &&
    milkSpec != null &&
    prepared.milk?.volumeMl != null &&
    Math.abs(prepared.milk.volumeMl - milkSpec) <= 0.1 * milkSpec;
  const waterSpec = drink.waterVolumeMl[order.size] ?? null;
  const waterOk =
    drink.drink === 'americano' &&
    prepared.waterMl != null &&
    waterSpec != null &&
    Math.abs(prepared.waterMl - waterSpec) <= 0.1 * waterSpec;
  const assemblyOk = JSON.stringify(prepared.assemblyActions) === JSON.stringify(drink.assembly);
  const jugVolume = prepared.milk?.volumeMl ?? null;
  const jugOk =
    milkUsed &&
    jugVolume != null &&
    prepared.milk?.jug != null &&
    ((jugVolume <= SMALL_JUG_MAX_ML && prepared.milk.jug === 'small-jug') ||
      (jugVolume > SMALL_JUG_MAX_ML && prepared.milk.jug === 'large-jug'));

  const recipeScore = allocate(25, [
    chk(foamOk ? 10 : 0, 10, Boolean(milkUsed && drink.foamOkCm != null)),
    chk(milkVolumeOk ? 5 : 0, 5, Boolean(milkUsed && milkSpec != null && prepared.milk?.volumeMl != null)),
    chk(waterOk ? 5 : 0, 5, Boolean(drink.drink === 'americano' && prepared.waterMl != null && waterSpec != null)),
    chk(assemblyOk ? 5 : 0, 5),
    chk(jugOk ? 3 : 0, 3, Boolean(milkUsed && jugVolume != null && prepared.milk?.jug != null)),
  ]);

  // ---- technique /15: time band 5, grind 3, dose 3, purge 2, tamp 2 ----
  const pulls = prepared.pulls;
  const timeOk =
    pulls.length > 0 &&
    pulls.every((p) => p.seconds >= EXTRACTION.timeBandSeconds[0] && p.seconds <= EXTRACTION.timeBandSeconds[1]);
  const grindOk = pulls.length > 0 && pulls.every((p) => p.grind === EXTRACTION.correctGrind);
  const doseOk =
    pulls.length > 0 &&
    pulls.every((p) => p.doseGrams >= EXTRACTION.doseBandGrams[0] && p.doseGrams <= EXTRACTION.doseBandGrams[1]);
  const tampOk = pulls.length > 0 && pulls.every((p) => p.tampOk);
  const purgeApplicable = drink.milkDrink && prepared.milk != null;

  const technique = allocate(15, [
    chk(timeOk ? 5 : 0, 5),
    chk(grindOk ? 3 : 0, 3),
    chk(doseOk ? 3 : 0, 3),
    chk(prepared.milk?.wandPurged === true ? 2 : 0, 2, purgeApplicable),
    chk(tampOk ? 2 : 0, 2),
  ]);

  const time = timeScore(order, prepared);
  const waste = wasteScore(prepared);
  const total = orderMatch + recipeScore + technique + time + waste;

  // ---- feedback tags ----
  if (drink.milkDrink && prepared.milk == null) add('MISSING_STEP');
  if (!drink.milkDrink && prepared.milk != null) add('MISSING_STEP');
  if (drink.drink === 'americano' && prepared.waterMl == null) add('MISSING_STEP');
  if (drink.milkDrink && prepared.milk != null && prepared.milk.typeUsed !== order.milk) add('WRONG_MILK');
  const temp = prepared.milk?.tempC ?? null;
  if (temp != null && temp >= milkFailThreshold(order, prepared.milk?.typeUsed)) add('MILK_TOO_HOT');
  if (milkUsed && drink.foamOkCm != null && prepared.milk != null) {
    if (prepared.milk.foamCm > drink.foamOkCm[1]) add('FOAM_TOO_THICK');
    else if (prepared.milk.foamCm < drink.foamOkCm[0]) add('FOAM_TOO_THIN');
  }
  for (const p of pulls) {
    if (p.seconds < EXTRACTION.timeBandSeconds[0]) add('EXTRACTION_TOO_FAST');
    if (p.seconds > EXTRACTION.timeBandSeconds[1]) add('EXTRACTION_TOO_SLOW');
    if (p.doseGrams < EXTRACTION.doseBandGrams[0]) add('DOSE_LOW');
    if (p.doseGrams > EXTRACTION.doseBandGrams[1]) add('DOSE_HIGH');
    if (!p.tampOk) add('UNEVEN_TAMP');
  }
  if (!vesselOk) add('INCORRECT_SERVING_CUP');
  if (purgeApplicable && prepared.milk?.wandPurged !== true) add('STEAM_WAND_NOT_PURGED');
  if (inferredSize !== null && inferredSize !== order.size) add('WRONG_SIZE');
  if (!shotsOk) add('WRONG_SHOT_COUNT');
  if (prepared.milk?.jug === 'large-jug' && jugVolume != null && jugVolume <= SMALL_JUG_MAX_ML) add('JUG_TOO_LARGE');

  const faults = [...feedback];
  const correctDrink = drinkOk && sizeOk && shotsOk && milkOk && vesselOk;
  const finalFeedback: FeedbackId[] = [];
  if (total >= 98 && faults.length === 0) finalFeedback.push('PERFECT_ORDER');
  else if (correctDrink) finalFeedback.push('CORRECT_DRINK');
  finalFeedback.push(...faults);

  // ---- summary, as data for the UI to phrase ----
  const opener: SummaryOpenerId =
    faults.length === 0 && total >= 98 ? 'perfect' : correctDrink ? 'correctRecipe' : 'wrongDrink';
  const summary: ScoreSummary = { opener, clauses: faults };

  return {
    total,
    breakdown: { orderMatch, recipe: recipeScore, technique, time, waste },
    feedback: finalFeedback,
    summary,
  };
}
