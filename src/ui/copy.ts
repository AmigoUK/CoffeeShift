/**
 * All user-facing British English strings. The only home of such strings:
 * domain logic and UI code import from here; nothing user-facing is inlined.
 */
import type { FeedbackId } from '../domain/types';

export const APP_NAME = 'Coffee Shift';

/** Exact feedback chip labels (surface exactly as written). */
export const FEEDBACK_LABELS: Record<FeedbackId, string> = {
  PERFECT_ORDER: 'Perfect Order!',
  CORRECT_DRINK: 'Correct Drink',
  WRONG_MILK: 'Wrong Milk',
  MILK_TOO_HOT: 'Milk Too Hot',
  FOAM_TOO_THICK: 'Foam Too Thick',
  FOAM_TOO_THIN: 'Foam Too Thin',
  EXTRACTION_TOO_FAST: 'Extraction Too Fast',
  EXTRACTION_TOO_SLOW: 'Extraction Too Slow',
  INCORRECT_SERVING_CUP: 'Incorrect Serving Cup',
  STEAM_WAND_NOT_PURGED: 'Steam Wand Not Purged',
  DOSE_LOW: 'Dose Too Low',
  DOSE_HIGH: 'Dose Too High',
  WRONG_SIZE: 'Wrong Size',
  WRONG_SHOT_COUNT: 'Wrong Number of Shots',
  UNEVEN_TAMP: 'Uneven Tamp',
  MISSING_STEP: 'Missing Step',
  JUG_TOO_LARGE: 'Jug Too Large',
};

/** Short practise hint per fault, appended to summary sentences and habit hints. */
export const FEEDBACK_HINTS: Partial<Record<FeedbackId, string>> = {
  MILK_TOO_HOT: 'Practise milk temperature control.',
  FOAM_TOO_THICK: 'Practise milk texturing.',
  FOAM_TOO_THIN: 'Practise milk texturing.',
  EXTRACTION_TOO_FAST: 'Practise dialling in the grind.',
  EXTRACTION_TOO_SLOW: 'Practise dialling in the grind.',
};

export const SUMMARY_OPENERS = {
  perfect: 'Perfect!',
  correctRecipe: 'Correct recipe.',
  wrongDrink: 'Not quite the drink ordered.',
} as const;

/** Summary clauses per fault; {drink} is replaced with the drink's display name. */
export const SUMMARY_CLAUSES: Partial<Record<FeedbackId, string>> = {
  WRONG_MILK: 'the wrong milk was used',
  MILK_TOO_HOT: 'the milk was overheated',
  FOAM_TOO_THICK: 'the foam was too thick for a {drink}',
  FOAM_TOO_THIN: 'the foam was too thin for a {drink}',
  EXTRACTION_TOO_FAST: 'the shot ran fast',
  EXTRACTION_TOO_SLOW: 'the shot ran slow',
  INCORRECT_SERVING_CUP: 'it was served in the wrong cup',
  STEAM_WAND_NOT_PURGED: 'the steam wand was not purged',
  DOSE_LOW: 'the dose was too low',
  DOSE_HIGH: 'the dose was too high',
  WRONG_SIZE: 'the size was wrong',
  WRONG_SHOT_COUNT: 'the number of shots was wrong',
  UNEVEN_TAMP: 'the tamp was uneven',
  MISSING_STEP: 'a step was missed',
  JUG_TOO_LARGE: 'the jug was too large',
};

export const MENU = {
  play: 'Play',
  recipeBook: 'Recipe Book',
  settings: 'Settings',
  learn: 'Learn',
  practice: 'Practise',
  shift: 'Shift',
  retry: 'Retry',
  next: 'Next',
  back: 'Back',
  serve: 'Serve',
  undo: 'Undo',
  bin: 'Bin & restart',
  ok: 'OK',
  confirm: 'Confirm',
  cancel: 'Cancel',
} as const;

export const SETTINGS_COPY = {
  title: 'Settings',
  sound: 'Sound',
  vibration: 'Vibration',
  reduceAnimations: 'Reduce animations',
  resetProgress: 'Reset progress',
  resetConfirm: 'Reset all progress? This cannot be undone.',
  installHint: 'Install the app from your browser menu to play offline.',
  notPersisted: 'Progress won\u2019t be saved in this browser mode.',
} as const;

export const GAME_COPY = {
  ticket: 'Ticket',
  drink: 'Drink', size: 'Size', shots: 'Shots', milk: 'Milk', temperature: 'Temperature',
  takeaway: 'To take away', extraHot: 'Extra hot', inHouse: 'In house',
  small: 'Small', medium: 'Medium', large: 'Large',
  whole: 'Whole milk', 'semi-skimmed': 'Semi-skimmed milk', oat: 'Oat milk',
  stationEspresso: 'Espresso', stationMilk: 'Milk', stationAssembly: 'Assembly',
  grindFine: 'Fine grind', grindMedium: 'Medium grind', grindCoarse: 'Coarse grind',
  addEspresso: 'Add espresso', addWater: 'Add water', pourMilk: 'Pour milk',
  pullShotFirst: 'Pull the espresso first.',
  customerLeft: 'Customer left \u2014 too slow.',
  orderChange: 'Actually, make that a large, please.',
  levelComplete: 'Shift complete!',
  learnComplete: 'Lesson complete!',
  perfectServe: 'Perfect serve!',
  parallelTip: 'Tip: steam milk while the shots run \u2014 parallel prep is allowed from now on.',
} as const;

export const RECIPE_BOOK_COPY = {
  title: 'Recipe Book',
  houseStandardTitle: 'The House Standard',
  houseStandard: 'Recipes follow this caf\u00e9\u2019s House Standard. In other caf\u00e9s, recipes and serving sizes may vary.',
  longBlackNote: 'Long Black is traditionally made water-first \u2014 recipes and serving sizes may vary between caf\u00e9s.',
  sizes: 'Sizes', shots: 'Shots', vessel: 'Served in', milk: 'Milk', water: 'Water',
  foam: 'Foam', parTime: 'Par time',
  seconds: 's', ml: 'ml', cm: 'cm',
} as const;

export const FOOTER_COPY = {
  email: 'dev@attv.uk',
  credit: 'Project & Development: Tomasz \u2018Amigo\u2019 Lewandowski',
  site: 'www.attv.uk',
  siteUrl: 'https://www.attv.uk',
  github: 'GitHub',
  githubUrl: 'https://github.com/AmigoUK/CoffeeShift',
} as const;

export const VESSEL_LABELS: Record<string, string> = {
  demitasse: 'Demitasse',
  'americano-mug': 'Americano mug',
  'cappuccino-cup': 'Cappuccino cup',
  'latte-glass': 'Latte glass',
  'flat-white-cup': 'Flat white cup',
  'takeaway-cup': 'Takeaway cup',
};

export const MODE_COPY = {
  learn: { name: 'Learn', blurb: 'Guided lessons, one drink at a time.' },
  practice: { name: 'Practise', blurb: 'Free play with modifiers, no timers.' },
  shift: { name: 'Shift', blurb: 'Serve a full caf\u00e9 queue under pressure.' },
  locked: 'Locked',
  levelsComplete: 'levels complete',
  starsEarned: 'stars earned',
  rank: 'Rank',
} as const;
