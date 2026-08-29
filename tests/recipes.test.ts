import { describe, expect, it } from 'vitest';
import { DRINK_IDS, RECIPES, defaultShots, parSeconds } from '../src/domain/recipes';

describe('recipes data invariants', () => {
  it('every drink has a unique house vessel', () => {
    const vessels = DRINK_IDS.map((d) => RECIPES[d].houseVessel);
    expect(new Set(vessels).size).toBe(vessels.length);
  });

  it('foam bands with tolerances do not overlap between drinks', () => {
    const bands = DRINK_IDS
      .map((d) => RECIPES[d].foamBandCm)
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

  it('par times are defined for every drink', () => {
    for (const drink of DRINK_IDS) {
      expect(RECIPES[drink].parSeconds).toBeGreaterThan(0);
    }
    expect(parSeconds('latte', true)).toBe(55);
    expect(parSeconds('espresso', false)).toBe(25);
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
