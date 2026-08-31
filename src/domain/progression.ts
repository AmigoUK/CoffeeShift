import type { DrinkId, DrinkOrder, FeedbackId, ScoreReport } from './types';
import { isMilkDrink } from './recipes';
import { LEVELS, levelById } from './levels';
import type { SaveData } from './save';
export const LEARN_PASS = 60; // Learn levels pass at 60% total (generous)

export function starsFor(total: number): number {
  if (total >= 95) return 3;
  if (total >= 85) return 2;
  if (total >= 70) return 1;
  return 0;
}

export const SKILLS = [
  'recipe-knowledge',
  'espresso-extraction',
  'milk-texturing',
  'order-accuracy',
  'workflow',
  'waste-control',
] as const;
export type SkillId = (typeof SKILLS)[number];

/** Exponential moving average: m ← m + 0.3 × (score − m). First sample seeds the EMA. */
export function updateEma(current: number | undefined, sample: number): number {
  if (current == null) return sample;
  return current + 0.3 * (sample - current);
}

const EXTRACTION_FAULTS: FeedbackId[] = [
  'EXTRACTION_TOO_FAST',
  'EXTRACTION_TOO_SLOW',
  'DOSE_LOW',
  'DOSE_HIGH',
  'UNEVEN_TAMP',
];
const MILK_FAULTS: FeedbackId[] = [
  'MILK_TOO_HOT',
  'FOAM_TOO_THICK',
  'FOAM_TOO_THIN',
  'STEAM_WAND_NOT_PURGED',
  'JUG_TOO_LARGE',
];

/**
 * Per-skill sample fractions (0–100) derived from a score report.
 * Milk texturing is only fed by milk drinks; the remaining skills are fed by every order.
 */
export function skillSamples(drink: DrinkId, report: ScoreReport): Partial<Record<SkillId, number>> {
  const b = report.breakdown;
  const has = (f: FeedbackId) => report.feedback.includes(f);
  const samples: Partial<Record<SkillId, number>> = {
    'recipe-knowledge': (100 * b.recipe) / 25,
    'order-accuracy': (100 * b.orderMatch) / 45,
    workflow: (100 * b.time) / 10,
    'waste-control': (100 * b.waste) / 5,
    'espresso-extraction': Math.max(0, 100 - 25 * EXTRACTION_FAULTS.filter(has).length),
  };
  if (isMilkDrink(drink)) {
    samples['milk-texturing'] = Math.max(0, 100 - 25 * MILK_FAULTS.filter(has).length);
  }
  return samples;
}

/** Fold one graded order into the save: mastery EMAs, fault counts, stats. */
export function recordResult(save: SaveData, order: DrinkOrder, report: ScoreReport): void {
  const samples = skillSamples(order.drink, report);
  for (const [skill, sample] of Object.entries(samples) as [SkillId, number][]) {
    save.mastery[skill] = updateEma(save.mastery[skill], sample);
  }
  save.mastery[`drink:${order.drink}`] = updateEma(save.mastery[`drink:${order.drink}`], report.total);
  for (const tag of report.feedback) {
    if (tag !== 'PERFECT_ORDER' && tag !== 'CORRECT_DRINK') {
      save.errorTagCounts[tag] = (save.errorTagCounts[tag] ?? 0) + 1;
    }
  }
  save.stats.drinksServed += 1;
  if (report.feedback.includes('PERFECT_ORDER')) save.stats.perfectOrders += 1;
}

export const HABIT_HINTS: Partial<Record<FeedbackId, string>> = {
  MILK_TOO_HOT: 'You often overheat milk.',
  FOAM_TOO_THICK: 'Practise milk texturing.',
  EXTRACTION_TOO_FAST: 'Your shots run fast \u2014 check the grind.',
};

interface FaultDimension {
  tags: FeedbackId[];
  skill: string;
}

const DIMENSIONS: FaultDimension[] = [
  { tags: MILK_FAULTS, skill: 'milk texturing' },
  { tags: EXTRACTION_FAULTS, skill: 'espresso extraction' },
  { tags: ['WRONG_SIZE', 'WRONG_SHOT_COUNT', 'INCORRECT_SERVING_CUP', 'MISSING_STEP'], skill: 'order accuracy' },
];

/**
 * Habit hints: surfaced when an error tag has ≥3 lifetime occurrences and makes up
 * ≥30% of its dimension's faults.
 */
export function habitHints(save: SaveData): string[] {
  const hints: string[] = [];
  for (const dimension of DIMENSIONS) {
    const total = dimension.tags.reduce((s, t) => s + (save.errorTagCounts[t] ?? 0), 0);
    if (total === 0) continue;
    for (const tag of dimension.tags) {
      const count = save.errorTagCounts[tag] ?? 0;
      if (count >= 3 && count / total >= 0.3) {
        const hint = HABIT_HINTS[tag] ?? `Practise ${dimension.skill}.`;
        if (!hints.includes(hint)) hints.push(hint);
      }
    }
  }
  return hints;
}

/** Fault tags that push each drink's adaptive weight up (see drinkWeight). */
export const TAG_BIAS: Record<DrinkId, FeedbackId[]> = {
  espresso: [
    'EXTRACTION_TOO_FAST',
    'EXTRACTION_TOO_SLOW',
    'DOSE_LOW',
    'DOSE_HIGH',
    'UNEVEN_TAMP',
    'STEAM_WAND_NOT_PURGED',
  ],
  americano: [
    'EXTRACTION_TOO_FAST',
    'EXTRACTION_TOO_SLOW',
    'DOSE_LOW',
    'DOSE_HIGH',
    'UNEVEN_TAMP',
    'STEAM_WAND_NOT_PURGED',
  ],
  latte: [
    'EXTRACTION_TOO_FAST',
    'EXTRACTION_TOO_SLOW',
    'DOSE_LOW',
    'DOSE_HIGH',
    'UNEVEN_TAMP',
    'STEAM_WAND_NOT_PURGED',
    'WRONG_MILK',
    'MILK_TOO_HOT',
    'FOAM_TOO_THICK',
    'FOAM_TOO_THIN',
  ],
  cappuccino: [
    'EXTRACTION_TOO_FAST',
    'EXTRACTION_TOO_SLOW',
    'DOSE_LOW',
    'DOSE_HIGH',
    'UNEVEN_TAMP',
    'STEAM_WAND_NOT_PURGED',
    'WRONG_MILK',
    'MILK_TOO_HOT',
    'FOAM_TOO_THICK',
    'FOAM_TOO_THIN',
  ],
  'flat-white': [
    'EXTRACTION_TOO_FAST',
    'EXTRACTION_TOO_SLOW',
    'DOSE_LOW',
    'DOSE_HIGH',
    'UNEVEN_TAMP',
    'STEAM_WAND_NOT_PURGED',
    'WRONG_MILK',
    'MILK_TOO_HOT',
    'FOAM_TOO_THICK',
    'FOAM_TOO_THIN',
  ],
};

/** Adaptive drink weight: clamp(1 + 0.1 × Σ biased fault counts, 1, 3). */
export function drinkWeight(save: SaveData, drink: DrinkId): number {
  const sum = TAG_BIAS[drink].reduce((s, t) => s + (save.errorTagCounts[t] ?? 0), 0);
  return Math.min(3, Math.max(1, 1 + 0.1 * sum));
}

// ---- unlock chain ----

function learnDone(save: SaveData, index: number): boolean {
  return (save.progress.learn[index] ?? 0) >= LEARN_PASS;
}

export function isLearnUnlocked(save: SaveData, index: number): boolean {
  return index === 0 || learnDone(save, index - 1);
}

export function isPracticeUnlocked(save: SaveData, index: number): boolean {
  return learnDone(save, index);
}

export function isShiftUnlocked(save: SaveData, index: number): boolean {
  if (index === 0) {
    return Array.from({ length: 5 }, (_, i) => save.progress.learn[i] ?? 0).every((best) => best >= LEARN_PASS);
  }
  return (save.progress.shift[index - 1]?.stars ?? 0) >= 1;
}

/** Rank: Trainee until S7 earns ≥1 star, then Barista. */
export function rankFor(save: SaveData): 'trainee' | 'barista' {
  return (save.progress.shift[6]?.stars ?? 0) >= 1 ? 'barista' : 'trainee';
}

/** Fold a finished level's reports into progress, rank and stats. Returns the level average and stars. */
export function applyLevelResult(
  save: SaveData,
  levelId: string,
  reports: { total: number }[],
): { avg: number; stars: number } {
  const avg = reports.length === 0 ? 0 : Math.round(reports.reduce((s, r) => s + r.total, 0) / reports.length);
  const level = levelById(levelId);
  if (level == null) return { avg, stars: 0 };
  const indexInMode = LEVELS.filter((l) => l.mode === level.mode).findIndex((l) => l.id === levelId);
  if (indexInMode < 0) return { avg, stars: starsFor(avg) };
  if (level.mode === 'shift') {
    const prev = save.progress.shift[indexInMode] ?? { stars: 0, best: 0 };
    save.progress.shift[indexInMode] = { stars: Math.max(prev.stars, starsFor(avg)), best: Math.max(prev.best, avg) };
    save.stats.shiftsPlayed += 1;
    save.rank = rankFor(save);
    return { avg, stars: starsFor(avg) };
  }
  const arr = level.mode === 'learn' ? save.progress.learn : save.progress.practice;
  arr[indexInMode] = Math.max(arr[indexInMode] ?? 0, avg);
  return { avg, stars: starsFor(avg) };
}
