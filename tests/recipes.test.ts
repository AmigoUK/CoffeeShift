import { describe, expect, it } from 'vitest';
import { DRINK_IDS, RECIPES, defaultShots, parFor } from '../src/domain/recipes';

describe('recipes data invariants', () => {
  it('every drink has a unique house vessel', () => {
    const vessels = DRINK_IDS.map((d) => RECIPES[d].houseVessel);
    expect(new Set(vessels).size).toBe(vessels.length);
  });

  it('foam bands with tolerances do not overlap between drinks', () => {
    const bands = DRINK_IDS.map((d) => RECIPES[d].foamBandCm)
      .filter((b): b is [number, number] => b != null)
      .map(([lo, hi]) => [lo, hi] as const);
    for (let i = 0; i < bands.length; i++) {
      for (let j = i + 1; j < bands.length; j++) {
        const a = bands[i]!;
        const b = bands[j]!;
        const overlap = a[0] < b[1] && b[0] < a[1];
        expect(overlap, `bands [${a}] and [${b}] must not overlap`).toBe(false);
      }
    }
  });

  it('shots table is complete for every allowed size', () => {
    for (const drink of DRINK_IDS) {
      const recipe = RECIPES[drink];
      for (const size of recipe.allowedSizes) {
        const shots = recipe.defaultShots[size];
        expect(shots, `${drink}/${size} needs a default shot count`).toBeDefined();
        expect(shots!).toBeGreaterThan(0);
        expect(shots!).toBeLessThanOrEqual(3);
      }
    }
    expect(defaultShots('latte', 'large')).toBe(3);
  });

  it('pars are derived from the work an order needs', () => {
    // flat-white: 2 shots + milk — old flat par of 45 s was unreachable (min real ~68 s)
    expect(parFor({ drink: 'flat-white', shots: 2, takeaway: false })).toBe(76);
    expect(parFor({ drink: 'espresso', shots: 1, takeaway: false })).toBe(37);
    // americano medium: 2 shots + water
    expect(parFor({ drink: 'americano', shots: 2, takeaway: false })).toBe(70);
    // takeaway adds 5 s
    expect(parFor({ drink: 'espresso', shots: 1, takeaway: true })).toBe(42);
    for (const drink of DRINK_IDS) {
      const recipe = RECIPES[drink];
      for (const size of recipe.allowedSizes) {
        expect(parFor({ drink, shots: defaultShots(drink, size), takeaway: false })).toBeGreaterThan(0);
      }
    }
  });

  it('milk volumes are defined for milk drinks, water for americano', () => {
    for (const drink of DRINK_IDS) {
      const recipe = RECIPES[drink];
      if (recipe.milkDrink) {
        expect(Object.keys(recipe.milkVolumeMl).length).toBe(recipe.allowedSizes.length);
      }
      expect(Object.keys(recipe.waterVolumeMl).length).toBe(drink === 'americano' ? 3 : 0);
    }
  });
});
