import { describe, expect, it } from 'vitest';
import {
  drinkWeight,
  habitHints,
  isLearnUnlocked,
  isPracticeUnlocked,
  isShiftUnlocked,
  rankFor,
  recordResult,
  starsFor,
  updateEma,
} from '../src/domain/progression';
import { defaultSave } from '../src/domain/save';
import type { DrinkOrder, ScoreReport } from '../src/domain/types';

describe('stars', () => {
  it('thresholds', () => {
    expect(starsFor(100)).toBe(3);
    expect(starsFor(95)).toBe(3);
    expect(starsFor(94)).toBe(2);
    expect(starsFor(85)).toBe(2);
    expect(starsFor(84)).toBe(1);
    expect(starsFor(70)).toBe(1);
    expect(starsFor(69)).toBe(0);
  });
});

describe('mastery EMA', () => {
  it('converges upward toward better scores and downward toward worse', () => {
    let m: number | undefined = 50;
    m = updateEma(m, 100);
    expect(m).toBe(65);
    m = updateEma(m, 100);
    expect(m).toBeGreaterThan(65);
    for (let i = 0; i < 60; i++) m = updateEma(m, 100);
    expect(m).toBeGreaterThan(99);

    let low = 80;
    for (let i = 0; i < 60; i++) low = updateEma(low, 0);
    expect(low).toBeLessThan(1);
  });

  it('recordResult feeds drink and skill mastery plus fault counts', () => {
    const save = defaultSave();
    const order: DrinkOrder = {
      drink: 'latte',
      size: 'medium',
      shots: 2,
      milk: 'whole',
      extraHot: false,
      takeaway: false,
    };
    const report: ScoreReport = {
      total: 100,
      breakdown: { orderMatch: 45, recipe: 25, technique: 15, time: 10, waste: 5 },
      feedback: ['PERFECT_ORDER'],
      summary: { opener: 'perfect' as const, clauses: [] },
    };
    recordResult(save, order, report);
    expect(save.mastery['drink:latte']).toBe(100);
    expect(save.mastery['recipe-knowledge']).toBe(100);
    expect(save.stats.drinksServed).toBe(1);
    expect(save.stats.perfectOrders).toBe(1);
    expect(Object.keys(save.errorTagCounts).length).toBe(0);

    recordResult(save, order, { ...report, total: 60, feedback: ['CORRECT_DRINK', 'FOAM_TOO_THICK'] });
    expect(save.mastery['drink:latte']).toBeLessThan(100);
    expect(save.errorTagCounts.FOAM_TOO_THICK).toBe(1);
    expect(save.stats.perfectOrders).toBe(1);
  });
});

describe('habit hints', () => {
  it('surfaces after ≥3 occurrences and ≥30% of the dimension', () => {
    const save = defaultSave();
    save.errorTagCounts.MILK_TOO_HOT = 2;
    expect(habitHints(save)).toEqual([]);
    save.errorTagCounts.MILK_TOO_HOT = 3;
    expect(habitHints(save)).toEqual(['You often overheat milk.']);
  });

  it('stays quiet below the 30% share and names the practise skill otherwise', () => {
    const save = defaultSave();
    save.errorTagCounts.MILK_TOO_HOT = 2;
    save.errorTagCounts.FOAM_TOO_THICK = 8;
    expect(habitHints(save)).toEqual(['Practise milk texturing.']);
  });
});

describe('adaptive drink weighting', () => {
  it('caps at 3 and floors at 1', () => {
    const save = defaultSave();
    save.errorTagCounts.EXTRACTION_TOO_FAST = 50;
    expect(drinkWeight(save, 'espresso')).toBe(3);
    expect(drinkWeight(save, 'espresso')).toBeGreaterThanOrEqual(1);

    const clean = defaultSave();
    expect(drinkWeight(clean, 'latte')).toBe(1);
    clean.errorTagCounts.WRONG_MILK = 5;
    expect(drinkWeight(clean, 'latte')).toBe(1.5);
  });
});

describe('unlock chain', () => {
  it('learn, practice and shift unlock in sequence', () => {
    const save = defaultSave();
    expect(isLearnUnlocked(save, 0)).toBe(true);
    expect(isLearnUnlocked(save, 1)).toBe(false);
    expect(isPracticeUnlocked(save, 0)).toBe(false);
    expect(isShiftUnlocked(save, 0)).toBe(false);

    save.progress.learn[0] = 60;
    expect(isLearnUnlocked(save, 1)).toBe(true);
    expect(isPracticeUnlocked(save, 0)).toBe(true);
    expect(isShiftUnlocked(save, 0)).toBe(false);

    for (let i = 0; i < 5; i++) save.progress.learn[i] = 60;
    expect(isShiftUnlocked(save, 0)).toBe(true);
    expect(isShiftUnlocked(save, 1)).toBe(false);

    save.progress.shift[0] = { stars: 1, best: 72 };
    expect(isShiftUnlocked(save, 1)).toBe(true);
  });

  it('rank becomes barista once S7 has a star', () => {
    const save = defaultSave();
    expect(rankFor(save)).toBe('trainee');
    save.progress.shift[5] = { stars: 3, best: 99 };
    expect(rankFor(save)).toBe('trainee');
    save.progress.shift[6] = { stars: 1, best: 70 };
    expect(rankFor(save)).toBe('barista');
  });
});
