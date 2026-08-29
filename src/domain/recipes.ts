import type { DrinkId, SizeId } from './types';

/**
 * The House Standard. Single source of truth for every gameplay judgement
 * and for the Recipe Book UI. Never duplicate these numbers elsewhere.
 */
export interface Recipe {
  drink: DrinkId;
  name: string;                                       // display name, British English
  allowedSizes: SizeId[];
  defaultShots: Partial<Record<SizeId, number>>;      // per allowed size
  houseVessel: string;                                // VesselId kept as string to avoid a UI import cycle
  milkDrink: boolean;
  milkVolumeMl: Partial<Record<SizeId, number>>;      // milk drinks only
  waterVolumeMl: Partial<Record<SizeId, number>>;     // americano only
  foamBandCm: [number, number] | null;                // target band, display only
  foamOkCm: [number, number] | null;                  // acceptance band (band ± tolerance, clamped at 0)
  parSeconds: number;
  assembly: string[];                                 // ordered: 'vessel' | 'shot' | 'water' | 'milk'
}

export const MILK_DRINKS: DrinkId[] = ['latte', 'cappuccino', 'flat-white'];

/** Milk temperature policy (°C). */
export const MILK_TEMP = {
  dairy: { target: [55, 65] as [number, number], failAt: 70 },
  oat: { target: [50, 60] as [number, number], failAt: 65 },
  extraHot: { target: [68, 76] as [number, number], failAt: 80 },
};

/** Extraction policy. */
export const EXTRACTION = {
  correctGrind: 'fine' as const,
  doseTargetGrams: 18,
  doseBandGrams: [16, 20] as [number, number],
  tampBandKg: [15, 20] as [number, number],
  timeBandSeconds: [24, 31] as [number, number],
};

export const MODIFIER_LIMITS = { maxShots: 3, extraShotStep: 1 };
export const TAKEAWAY_EXTRA_SECONDS = 5;

export const RECIPES: Record<DrinkId, Recipe> = {
  espresso: {
    drink: 'espresso', name: 'Espresso',
    allowedSizes: ['small'], defaultShots: { small: 1 },
    houseVessel: 'demitasse', milkDrink: false,
    milkVolumeMl: {}, waterVolumeMl: {},
    foamBandCm: null, foamOkCm: null,
    parSeconds: 25, assembly: ['vessel', 'shot'],
  },
  americano: {
    drink: 'americano', name: 'Americano',
    allowedSizes: ['small', 'medium', 'large'], defaultShots: { small: 1, medium: 2, large: 2 },
    houseVessel: 'americano-mug', milkDrink: false,
    milkVolumeMl: {}, waterVolumeMl: { small: 150, medium: 250, large: 350 },
    foamBandCm: null, foamOkCm: null,
    parSeconds: 35, assembly: ['vessel', 'shot', 'water'],
  },
  latte: {
    drink: 'latte', name: 'Latte',
    allowedSizes: ['small', 'medium', 'large'], defaultShots: { small: 1, medium: 2, large: 3 },
    houseVessel: 'latte-glass', milkDrink: true,
    milkVolumeMl: { small: 180, medium: 300, large: 420 }, waterVolumeMl: {},
    foamBandCm: [0.5, 1.0], foamOkCm: [0.5, 1.5],
    parSeconds: 50, assembly: ['vessel', 'shot', 'milk'],
  },
  cappuccino: {
    drink: 'cappuccino', name: 'Cappuccino',
    allowedSizes: ['small', 'medium'], defaultShots: { small: 1, medium: 2 },
    houseVessel: 'cappuccino-cup', milkDrink: true,
    milkVolumeMl: { small: 100, medium: 140 }, waterVolumeMl: {},
    foamBandCm: [2.0, 3.0], foamOkCm: [1.5, 3.5],
    parSeconds: 50, assembly: ['vessel', 'shot', 'milk'],
  },
  'flat-white': {
    drink: 'flat-white', name: 'Flat white',
    allowedSizes: ['small'], defaultShots: { small: 2 },
    houseVessel: 'flat-white-cup', milkDrink: true,
    milkVolumeMl: { small: 110 }, waterVolumeMl: {},
    foamBandCm: [0, 0.5], foamOkCm: [0, 1.0],
    parSeconds: 45, assembly: ['vessel', 'shot', 'milk'],
  },
};

export const DRINK_IDS: DrinkId[] = ['espresso', 'americano', 'latte', 'cappuccino', 'flat-white'];

export function recipeFor(drink: DrinkId): Recipe {
  return RECIPES[drink];
}

export function defaultShots(drink: DrinkId, size: SizeId): number {
  return RECIPES[drink].defaultShots[size] ?? 1;
}

export function resolveShots(drink: DrinkId, size: SizeId, extraShot: boolean): number {
  return Math.min(MODIFIER_LIMITS.maxShots, defaultShots(drink, size) + (extraShot ? MODIFIER_LIMITS.extraShotStep : 0));
}

export function parSeconds(drink: DrinkId, takeaway: boolean): number {
  return RECIPES[drink].parSeconds + (takeaway ? TAKEAWAY_EXTRA_SECONDS : 0);
}

export function isMilkDrink(drink: DrinkId): boolean {
  return RECIPES[drink].milkDrink;
}
