import { describe, expect, it } from 'vitest';
import { grade } from '../src/domain/grading';
import { recipeFor } from '../src/domain/recipes';
import type { DrinkOrder, FeedbackId, PreparedDrink } from '../src/domain/types';

function makeOrder(over: Partial<DrinkOrder> = {}): DrinkOrder {
  return { drink: 'latte', size: 'medium', shots: 2, milk: 'whole', extraHot: false, takeaway: false, ...over };
}

function makePrepared(over: Partial<PreparedDrink> = {}): PreparedDrink {
  return {
    drink: 'latte', vessel: 'latte-glass',
    pulls: [
      { grind: 'fine', doseGrams: 18, tampOk: true, seconds: 27 },
      { grind: 'fine', doseGrams: 18, tampOk: true, seconds: 27 },
    ],
    milk: { typeUsed: 'whole', tempC: 60, foamCm: 0.8, wandPurged: true, jug: 'large-jug', volumeMl: 300 },
    waterMl: null,
    assemblyActions: ['vessel', 'shot', 'milk'],
    wasteEvents: [],
    elapsedSeconds: 40, timedLevel: false,
    ...over,
  };
}

function run(order: DrinkOrder, prepared: PreparedDrink) {
  return grade(order, prepared, recipeFor(order.drink));
}

describe('grading — perfect runs', () => {
  const cases: { name: string; order: DrinkOrder; prepared: PreparedDrink }[] = [
    {
      name: 'espresso', order: makeOrder({ drink: 'espresso', size: 'small', shots: 1 }),
      prepared: makePrepared({
        drink: 'espresso', vessel: 'demitasse',
        pulls: [{ grind: 'fine', doseGrams: 18, tampOk: true, seconds: 27 }],
        milk: null, assemblyActions: ['vessel', 'shot'],
      }),
    },
    {
      name: 'americano', order: makeOrder({ drink: 'americano', size: 'medium', shots: 2 }),
      prepared: makePrepared({
        drink: 'americano', vessel: 'americano-mug', milk: null, waterMl: 250,
        assemblyActions: ['vessel', 'shot', 'water'],
      }),
    },
    {
      name: 'cappuccino', order: makeOrder({ drink: 'cappuccino', size: 'small', shots: 1 }),
      prepared: makePrepared({
        drink: 'cappuccino', vessel: 'cappuccino-cup',
        pulls: [{ grind: 'fine', doseGrams: 18, tampOk: true, seconds: 27 }],
        milk: { typeUsed: 'whole', tempC: 60, foamCm: 2.5, wandPurged: true, jug: 'small-jug', volumeMl: 100 },
        assemblyActions: ['vessel', 'shot', 'milk'],
      }),
    },
    {
      name: 'flat-white', order: makeOrder({ drink: 'flat-white', size: 'small', shots: 2 }),
      prepared: makePrepared({
        drink: 'flat-white', vessel: 'flat-white-cup',
        milk: { typeUsed: 'whole', tempC: 60, foamCm: 0.3, wandPurged: true, jug: 'small-jug', volumeMl: 110 },
      }),
    },
  ];

  for (const { name, order, prepared } of cases) {
    it(` PERFECT_ORDER for ${name}`, () => {
      const report = run(order, prepared);
      expect(report.feedback).toEqual(['PERFECT_ORDER']);
      expect(report.total).toBeGreaterThanOrEqual(98);
      expect(report.summary.opener).toBe('perfect');
    });
  }

  it('category weights sum to 100 and each perfect category is at its maximum', () => {
    const report = run(makeOrder(), makePrepared());
    expect(report.breakdown).toEqual({ orderMatch: 45, recipe: 25, technique: 15, time: 10, waste: 5 });
    expect(report.total).toBe(100);
  });
});

describe('grading — every FeedbackId is triggerable', () => {
  const table: { tag: FeedbackId; order?: Partial<DrinkOrder>; prepared?: Partial<PreparedDrink> }[] = [
    { tag: 'WRONG_MILK', order: { milk: 'oat' } },
    { tag: 'EXTRACTION_TOO_FAST', prepared: { pulls: [{ grind: 'fine', doseGrams: 18, tampOk: true, seconds: 20 }] } },
    { tag: 'EXTRACTION_TOO_SLOW', prepared: { pulls: [{ grind: 'fine', doseGrams: 18, tampOk: true, seconds: 35 }] } },
    { tag: 'INCORRECT_SERVING_CUP', prepared: { vessel: 'demitasse' } },
    { tag: 'STEAM_WAND_NOT_PURGED', prepared: { milk: { typeUsed: 'whole', tempC: 60, foamCm: 0.8, wandPurged: false, jug: 'large-jug', volumeMl: 300 } } },
    { tag: 'DOSE_LOW', prepared: { pulls: [{ grind: 'fine', doseGrams: 14, tampOk: true, seconds: 27 }] } },
    { tag: 'DOSE_HIGH', prepared: { pulls: [{ grind: 'fine', doseGrams: 22, tampOk: true, seconds: 27 }] } },
    { tag: 'WRONG_SIZE', prepared: { milk: { typeUsed: 'whole', tempC: 60, foamCm: 0.8, wandPurged: true, jug: 'small-jug', volumeMl: 180 } } },
    { tag: 'WRONG_SHOT_COUNT', prepared: { pulls: [{ grind: 'fine', doseGrams: 18, tampOk: true, seconds: 27 }] } },
    { tag: 'UNEVEN_TAMP', prepared: { pulls: [{ grind: 'fine', doseGrams: 18, tampOk: false, seconds: 27 }, { grind: 'fine', doseGrams: 18, tampOk: true, seconds: 27 }] } },
    { tag: 'MISSING_STEP', prepared: { milk: null } },
    {
      tag: 'MISSING_STEP', order: { drink: 'americano', size: 'medium', shots: 2 },
      prepared: { drink: 'americano', vessel: 'americano-mug', waterMl: null, assemblyActions: ['vessel', 'shot'] },
    },
    {
      tag: 'JUG_TOO_LARGE', order: { drink: 'cappuccino', size: 'small', shots: 1 },
      prepared: {
        drink: 'cappuccino', vessel: 'cappuccino-cup',
        pulls: [{ grind: 'fine', doseGrams: 18, tampOk: true, seconds: 27 }],
        milk: { typeUsed: 'whole', tempC: 60, foamCm: 2.5, wandPurged: true, jug: 'large-jug', volumeMl: 100 },
        assemblyActions: ['vessel', 'shot', 'milk'],
      },
    },
    { tag: 'CORRECT_DRINK', prepared: { pulls: [{ grind: 'fine', doseGrams: 18, tampOk: true, seconds: 35 }, { grind: 'fine', doseGrams: 18, tampOk: true, seconds: 27 }] } },
    { tag: 'PERFECT_ORDER' },
  ];

  for (const { tag, order, prepared } of table) {
    it(`${tag} fires`, () => {
      const fullOrder = makeOrder(order ?? {});
      const fullPrepared = makePrepared(prepared ?? {});
      const report = run(fullOrder, fullPrepared);
      expect(report.feedback).toContain(tag);
    });
  }
});

describe('grading — time formula', () => {
  const order = makeOrder({ drink: 'latte', size: 'small', shots: 1 });

  function timeAt(elapsed: number): number {
    return run(order, makePrepared({ elapsedSeconds: elapsed, timedLevel: true })).breakdown.time;
  }

  it('full marks at par (P=49: 10 s slack + 1 shot + milk) and below', () => {
    expect(timeAt(49)).toBe(10);
    expect(timeAt(30)).toBe(10);
  });
  it('linear decay between P and 2P', () => {
    expect(timeAt(73.5)).toBe(6);   // 10 − 8×24.5/49 (half-way to 2P)
    expect(timeAt(98)).toBe(2);    // boundary 2P
  });
  it('decay to zero at 4P', () => {
    expect(timeAt(122.5)).toBe(2); // 2 − 24.5/49 = 1.5 → rounds half-up to 2
    expect(timeAt(127)).toBe(1);   // 2 − 29/49 = 1.41 → 1
    expect(timeAt(147)).toBe(1);   // 2 − 49/49 = 1
    expect(timeAt(196)).toBe(0);   // boundary 4P
    expect(timeAt(400)).toBe(0);   // beyond 4P
  });
  it('untimed levels always score full marks', () => {
    const untimed = run(order, makePrepared({ elapsedSeconds: 9999, timedLevel: false }));
    expect(untimed.breakdown.time).toBe(10);
  });
});

describe('grading — waste floor and re-weighting', () => {
  it('waste floors at 0', () => {
    const report = run(makeOrder(), makePrepared({
      wasteEvents: ['binned-drink', 'binned-drink', 'binned-drink', 'lost-customer', 'lost-customer'],
    }));
    expect(report.breakdown.waste).toBe(0);
  });

  it('waste deducts 2 for binned/lost and 1 for emptied jug / overflow', () => {
    const report = run(makeOrder(), makePrepared({ wasteEvents: ['emptied-jug', 'jug-overflow'] }));
    expect(report.breakdown.waste).toBe(3);
  });

  it('espresso re-weights technique onto extraction checks (13 possible)', () => {
    const order = makeOrder({ drink: 'espresso', size: 'small', shots: 1 });
    const good = run(order, makePrepared({
      drink: 'espresso', vessel: 'demitasse', milk: null,
      pulls: [{ grind: 'fine', doseGrams: 18, tampOk: true, seconds: 27 }],
      assemblyActions: ['vessel', 'shot'],
    }));
    expect(good.breakdown.technique).toBe(15);

    const wrongGrind = run(order, makePrepared({
      drink: 'espresso', vessel: 'demitasse', milk: null,
      pulls: [{ grind: 'medium', doseGrams: 18, tampOk: true, seconds: 27 }],
      assemblyActions: ['vessel', 'shot'],
    }));
    // earned 10/13 → 15 × 10/13 = 11.54 → 12 (round half-up)
    expect(wrongGrind.breakdown.technique).toBe(12);
  });

  it('espresso recipe re-weights onto assembly (only applicable check)', () => {
    const order = makeOrder({ drink: 'espresso', size: 'small', shots: 1 });
    const good = run(order, makePrepared({
      drink: 'espresso', vessel: 'demitasse', milk: null,
      pulls: [{ grind: 'fine', doseGrams: 18, tampOk: true, seconds: 27 }],
      assemblyActions: ['vessel', 'shot'],
    }));
    expect(good.breakdown.recipe).toBe(25);
    const badOrder = run(order, makePrepared({
      drink: 'espresso', vessel: 'demitasse', milk: null,
      pulls: [{ grind: 'fine', doseGrams: 18, tampOk: true, seconds: 27 }],
      assemblyActions: ['shot', 'vessel'],
    }));
    expect(badOrder.breakdown.recipe).toBe(0);
  });
});

describe('grading — summary sentences', () => {
  it('reports the faults it found, in order, for the UI to phrase', () => {
    const report = run(makeOrder(), makePrepared({
      milk: { typeUsed: 'whole', tempC: 72, foamCm: 1.8, wandPurged: true, jug: 'large-jug', volumeMl: 300 },
    }));
    expect(report.summary.opener).toBe('correctRecipe');
    expect(report.summary.clauses).toContain('MILK_TOO_HOT');
    expect(report.summary.clauses).toContain('FOAM_TOO_THICK');
  });

  it('wrong drink uses the wrong-drink opener', () => {
    const report = run(makeOrder(), makePrepared({ drink: 'espresso', vessel: 'demitasse', milk: null }));
    expect(report.summary.opener).toBe('wrongDrink');
  });
});
