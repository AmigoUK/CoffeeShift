import { describe, expect, it } from 'vitest';
import { ARCHETYPES, archetypeForOrderIndex, generateOrders, mulberry32, orderLine } from '../src/domain/orders';
import { LEVELS } from '../src/domain/levels';
import { RECIPES } from '../src/domain/recipes';
import { defaultSave } from '../src/domain/save';
import type { DrinkOrder } from '../src/domain/types';

const regular = ARCHETYPES[0]!;
const student = ARCHETYPES[1]!;
const commuter = ARCHETYPES[2]!;

describe('order generation', () => {
  it('same seed → identical orders', () => {
    const level = LEVELS.find((l) => l.id === 'S6')!;
    const a = generateOrders(level, mulberry32(42), defaultSave());
    const b = generateOrders(level, mulberry32(42), defaultSave());
    expect(a).toEqual(b);
    expect(a.length).toBe(level.orderCount);
  });

  it('generated orders always satisfy House Standard constraints', () => {
    const save = defaultSave();
    for (const level of LEVELS) {
      for (const seed of [1, 7, 99, 1234]) {
        for (const order of generateOrders(level, mulberry32(seed), save)) {
          const recipe = RECIPES[order.drink];
          expect(recipe.allowedSizes).toContain(order.size);
          expect(order.shots).toBeLessThanOrEqual(3);
          expect(order.shots).toBeGreaterThan(0);
          if (!recipe.milkDrink) {
            expect(order.milk).toBe('whole');
            expect(order.extraHot).toBe(false);
          }
          if (!level.takeaway) expect(order.takeaway).toBe(false);
          if (!level.extraShot) {
            expect(order.shots).toBe(recipe.defaultShots[order.size] ?? 1);
          }
        }
      }
    }
  });
});

describe('order line builder — golden strings', () => {
  it('plain style with oat milk, extra hot, takeaway', () => {
    const order: DrinkOrder = { drink: 'latte', size: 'medium', shots: 2, milk: 'oat', extraHot: true, takeaway: true };
    expect(orderLine(order, regular)).toBe('A medium oat latte, extra hot, to take away, please.');
  });

  it('could-i-get style with an extra shot', () => {
    const order: DrinkOrder = {
      drink: 'flat-white',
      size: 'small',
      shots: 3,
      milk: 'whole',
      extraHot: false,
      takeaway: false,
    };
    expect(orderLine(order, student)).toBe('Could I get a small flat white with an extra shot?');
  });

  it('counting style takeaway americano', () => {
    const order: DrinkOrder = {
      drink: 'americano',
      size: 'large',
      shots: 2,
      milk: 'whole',
      extraHot: false,
      takeaway: true,
    };
    expect(orderLine(order, commuter)).toBe('One large americano to go, please.');
  });

  it('plain style double espresso', () => {
    const order: DrinkOrder = {
      drink: 'espresso',
      size: 'small',
      shots: 2,
      milk: 'whole',
      extraHot: false,
      takeaway: false,
    };
    expect(orderLine(order, regular)).toBe('A double espresso, please.');
  });

  it('archetypes rotate by order index', () => {
    expect(archetypeForOrderIndex(0)).toBe(regular);
    expect(archetypeForOrderIndex(1)).toBe(student);
    expect(archetypeForOrderIndex(2)).toBe(commuter);
    expect(archetypeForOrderIndex(3)).toBe(regular);
  });
});
