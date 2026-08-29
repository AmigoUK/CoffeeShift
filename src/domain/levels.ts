import type { DrinkId, MilkId, ModeId, SizeId } from './types';
import { RECIPES } from './recipes';

export interface LevelDef {
  id: string;
  mode: ModeId;
  drinkPool: DrinkId[];
  sizes: SizeId[];
  milks: MilkId[];
  takeaway: boolean; takeawayChance: number;
  extraShot: boolean; extraShotChance: number;
  extraHot: boolean; extraHotChance: number;
  orderCount: number;
  queueLength: number;
  patience: boolean; patienceSeconds: number;
  timeScoring: boolean;
  parallelPrep: boolean;
  orderChanges: boolean;
  multiDrink: boolean;
  guided: boolean;   // Learn step cards walk every minigame
  goal: string;
}

const NONE = { takeaway: false, takeawayChance: 0, extraShot: false, extraShotChance: 0, extraHot: false, extraHotChance: 0 };
const PRACTICE_MODS = { takeaway: true, takeawayChance: 0.25, extraShot: true, extraShotChance: 0.2, extraHot: false, extraHotChance: 0 };

function learnLevel(drink: DrinkId, index: number): LevelDef {
  const recipe = RECIPES[drink];
  return {
    id: `L${index + 1}`, mode: 'learn', drinkPool: [drink],
    sizes: [...recipe.allowedSizes], milks: ['whole'],
    ...NONE,
    orderCount: 1, queueLength: 1,
    patience: false, patienceSeconds: 0, timeScoring: false,
    parallelPrep: false, orderChanges: false, multiDrink: false,
    guided: true, goal: `Learn to make a ${recipe.name.toLowerCase()}.`,
  };
}

function practiceLevel(drink: DrinkId, index: number): LevelDef {
  const recipe = RECIPES[drink];
  return {
    id: `P${index + 1}`, mode: 'practice', drinkPool: [drink],
    sizes: [...recipe.allowedSizes], milks: ['whole', 'semi-skimmed'],
    ...PRACTICE_MODS,
    orderCount: 3, queueLength: 2,
    patience: false, patienceSeconds: 0, timeScoring: false,
    parallelPrep: false, orderChanges: false, multiDrink: false,
    guided: false, goal: `Serve three ${recipe.name.toLowerCase()} orders with modifiers.`,
  };
}

function shiftLevel(
  id: string, drinkPool: DrinkId[], sizes: SizeId[], milks: MilkId[],
  orderCount: number, queueLength: number, patienceSeconds: number, timeScoring: boolean,
  flags: Partial<Pick<LevelDef, 'parallelPrep' | 'orderChanges' | 'multiDrink'>> & {
    takeaway?: number; extraShot?: number; extraHot?: number;
  },
  goal: string,
): LevelDef {
  return {
    id, mode: 'shift', drinkPool, sizes, milks,
    takeaway: (flags.takeaway ?? 0) > 0, takeawayChance: flags.takeaway ?? 0,
    extraShot: (flags.extraShot ?? 0) > 0, extraShotChance: flags.extraShot ?? 0,
    extraHot: (flags.extraHot ?? 0) > 0, extraHotChance: flags.extraHot ?? 0,
    orderCount, queueLength,
    patience: patienceSeconds > 0, patienceSeconds, timeScoring,
    parallelPrep: flags.parallelPrep ?? false, orderChanges: flags.orderChanges ?? false, multiDrink: flags.multiDrink ?? false,
    guided: false, goal,
  };
}

export const LEVELS: LevelDef[] = [
  learnLevel('espresso', 0),
  learnLevel('americano', 1),
  learnLevel('latte', 2),
  learnLevel('cappuccino', 3),
  learnLevel('flat-white', 4),
  practiceLevel('espresso', 0),
  practiceLevel('americano', 1),
  practiceLevel('latte', 2),
  practiceLevel('cappuccino', 3),
  practiceLevel('flat-white', 4),
  shiftLevel('S1', ['espresso', 'americano'], ['small', 'medium'], ['whole'], 3, 1, 0, false, {},
    'Serve every customer. No timers \u2014 find your rhythm.'),
  shiftLevel('S2', ['espresso', 'americano', 'latte'], ['small', 'medium'], ['whole'], 4, 2, 90, false, {},
    'Keep the queue moving \u2014 customers now wait.'),
  shiftLevel('S3', ['espresso', 'americano', 'latte'], ['small', 'medium'], ['whole', 'semi-skimmed'], 5, 2, 75, true, {},
    'Beat par time to keep the time score.'),
  shiftLevel('S4', ['espresso', 'americano', 'latte'], ['small', 'medium'], ['whole', 'semi-skimmed', 'oat'], 5, 2, 60, true, {},
    'Oat milk steams hotter faster \u2014 watch the gauge.'),
  shiftLevel('S5', ['espresso', 'americano', 'latte'], ['small', 'medium'], ['whole', 'semi-skimmed', 'oat'], 5, 2, 60, true,
    { takeaway: 0.3 }, 'Takeaway orders need the takeaway cup.'),
  shiftLevel('S6', ['espresso', 'americano', 'latte'], ['small', 'medium', 'large'], ['whole', 'semi-skimmed', 'oat'], 6, 2, 55, true,
    { takeaway: 0.3, extraShot: 0.2, extraHot: 0.15 }, 'Extra shots and large sizes join the menu.'),
  shiftLevel('S7', ['espresso', 'americano', 'latte', 'cappuccino', 'flat-white'], ['small', 'medium', 'large'],
    ['whole', 'semi-skimmed', 'oat'], 6, 3, 50, true,
    { takeaway: 0.3, extraShot: 0.2, extraHot: 0.15, parallelPrep: true },
    'Full menu. Steam milk while shots run.'),
  shiftLevel('S8', ['espresso', 'americano', 'latte', 'cappuccino', 'flat-white'], ['small', 'medium', 'large'],
    ['whole', 'semi-skimmed', 'oat'], 7, 3, 50, true,
    { takeaway: 0.3, extraShot: 0.2, extraHot: 0.15, parallelPrep: true, orderChanges: true },
    'Customers may change their minds \u2014 watch the ticket.'),
  shiftLevel('S9', ['espresso', 'americano', 'latte', 'cappuccino', 'flat-white'], ['small', 'medium', 'large'],
    ['whole', 'semi-skimmed', 'oat'], 7, 3, 60, true,
    { takeaway: 0.3, extraShot: 0.2, extraHot: 0.15, parallelPrep: true, orderChanges: true, multiDrink: true },
    'Some customers order two drinks at once.'),
  shiftLevel('S10', ['espresso', 'americano', 'latte', 'cappuccino', 'flat-white'], ['small', 'medium', 'large'],
    ['whole', 'semi-skimmed', 'oat'], 8, 3, 45, true,
    { takeaway: 0.3, extraShot: 0.2, extraHot: 0.15, parallelPrep: true, orderChanges: true, multiDrink: true },
    'Finish the shift with 80% or more.'),
];

export function levelsForMode(mode: ModeId): LevelDef[] {
  return LEVELS.filter((l) => l.mode === mode);
}

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}
