/**
 * All user-facing British English strings, and the only home of such strings. The domain
 * layer deliberately does not import from here: it reports what happened as data, and this
 * module turns that into words.
 */
import type { FeedbackId, ScoreSummary } from '../domain/types';
import { EXTRACTION, SMALL_JUG_MAX_ML } from '../domain/recipes';

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
  binConfirm: 'Tap again to bin',
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
  canvasLabel: 'Coffee Shift play area. The espresso, milk and assembly stations are drawn here and operated by touch.',
  binArmed: 'Tap Bin again to throw this drink away.',
  binned: 'Drink binned \u2014 starting fresh.',
  ticket: 'Ticket',
  drink: 'Drink',
  size: 'Size',
  shots: 'Shots',
  milk: 'Milk',
  temperature: 'Temperature',
  takeaway: 'To take away',
  extraHot: 'Extra hot',
  inHouse: 'In house',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  whole: 'Whole milk',
  'semi-skimmed': 'Semi-skimmed milk',
  oat: 'Oat milk',
  stationEspresso: 'Espresso',
  stationMilk: 'Milk',
  stationAssembly: 'Assembly',
  grindFine: 'Fine grind',
  grindMedium: 'Medium grind',
  grindCoarse: 'Coarse grind',
  addEspresso: 'Add espresso',
  addWater: 'Add water',
  pourMilk: 'Pour milk',
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
  houseStandard:
    'Recipes follow this caf\u00e9\u2019s House Standard. In other caf\u00e9s, recipes and serving sizes may vary.',
  longBlackNote:
    'Long Black is traditionally made water-first \u2014 recipes and serving sizes may vary between caf\u00e9s.',
  sizes: 'Sizes',
  shots: 'Shots',
  vessel: 'Served in',
  milk: 'Milk',
  water: 'Water',
  foam: 'Foam',
  parTime: 'Par time',
  seconds: 's',
  ml: 'ml',
  cm: 'cm',
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

/** Shown when the browser cannot run the game at all. */
export const BOOT_ERROR_COPY = {
  title: 'Coffee Shift cannot start',
  noCanvas:
    'This browser could not create the graphics canvas the game needs. Try a different or newer browser, or turn hardware acceleration back on.',
  noScript: 'Coffee Shift needs JavaScript. Please switch it on and reload the page.',
} as const;

function joinClauses(clauses: string[]): string {
  const capped = clauses.map((c, i) => (i === 0 ? c.charAt(0).toUpperCase() + c.slice(1) : c));
  if (capped.length === 0) return '';
  if (capped.length === 1) return `${capped[0]}.`;
  if (capped.length === 2) return `${capped[0]} and ${capped[1]}.`;
  return `${capped.slice(0, -1).join(', ')}, and ${capped[capped.length - 1]}.`;
}

/**
 * Phrase a score summary. The domain reports which faults occurred; choosing the words,
 * the order and the closing hint is a presentation decision and belongs here.
 */
export function summarySentence(summary: ScoreSummary, drinkName: string): string {
  const opener = SUMMARY_OPENERS[summary.opener];
  const clauses = summary.clauses
    .map((f) => SUMMARY_CLAUSES[f]?.replace('{drink}', drinkName.toLowerCase()) ?? '')
    .filter((c) => c.length > 0);
  const faultSentence = joinClauses(clauses);
  if (faultSentence.length === 0) return opener;
  const hint = summary.clauses.map((f) => FEEDBACK_HINTS[f]).find((h) => h != null);
  return hint == null ? `${opener} ${faultSentence}` : `${opener} ${faultSentence} ${hint}`;
}

// ---------------------------------------------------------------------------
// Play-screen copy. Numbers are read from the House Standard rather than retyped,
// so a recipe change cannot leave the on-screen guidance saying something else.
// ---------------------------------------------------------------------------

const [DOSE_LOW, DOSE_HIGH] = EXTRACTION.doseBandGrams;
const [TAMP_LOW, TAMP_HIGH] = EXTRACTION.tampBandKg;
const [TIME_LOW, TIME_HIGH] = EXTRACTION.timeBandSeconds;

export const STATION_COPY = {
  smallJug: 'Small jug',
  largeJug: 'Large jug',
  purgeWand: 'Purge wand',
  purged: 'Purged \u2713',
  steam: 'Steam',
  removeJug: 'Remove jug',
  emptyJug: 'Empty jug',
  brew: 'Brew',
  stop: 'STOP',
  emptyGrinder: 'Empty grinder \u00b7 start over',
  dose: (grams: number) => `Dose +1 g (${grams} g)`,
  tamp: (kg: number) => `Tamp ${kg} kg`,
  fill: (ml: number) => `Fill ${ml} ml`,
  wandDepth: (depth: string) => `Wand depth: ${depth} (tap to toggle)`,
} as const;

export const TOAST_COPY = {
  maxShots: 'Three shots pulled already \u2014 that\u2019s the maximum.',
  jugEmptied: 'Jug emptied \u2014 refill and steam again.',
  needJug: 'Pick a jug and fill it with milk first.',
  smallJugOverflow: 'The small jug overflows \u2014 empty it and use the large jug.',
  needMilk: 'Steam some milk first.',
  nothingToUndo: 'Nothing to undo.',
  milkTooHot: 'The milk is too hot \u2014 remove the jug now.',
  milkScorched: 'The milk is scorched \u2014 empty the jug and start again.',
  ticketChanged: 'The ticket changed \u2014 check it!',
  jugFull: 'The jug is full \u2014 stop pouring.',
  vesselFull: 'The cup is full \u2014 stop pouring.',
} as const;

export const BREAKDOWN_COPY = {
  orderMatch: (n: number) => `Order match ${n}/45`,
  recipe: (n: number) => `Recipe ${n}/25`,
  technique: (n: number) => `Technique ${n}/15`,
  time: (n: number) => `Time ${n}/10`,
  waste: (n: number) => `Waste ${n}/5`,
} as const;

export const STATUS_COPY = {
  extraction: (grind: string, dose: number, tampKg: number) =>
    `Grind ${grind} \u00b7 dose ${dose} g (target ${EXTRACTION.doseTargetGrams} \u00b1${EXTRACTION.doseTargetGrams - DOSE_LOW}) \u00b7 tamp ${tampKg} kg`,
  brewing: (seconds: number, yieldGrams: number) =>
    `Brewing \u2014 ${seconds}s \u00b7 yield ${yieldGrams} g \u00b7 STOP in ${TIME_LOW}\u2013${TIME_HIGH}s`,
  shotsPulled: (n: number) => `Shots pulled: ${n}`,
  jug: (jug: string, milk: string, depth: string, purged: boolean, ruined: boolean) =>
    `Jug ${jug} \u00b7 ${milk} \u00b7 wand ${depth}${purged ? ' \u00b7 purged \u2713' : ''}${ruined ? ' \u00b7 SCORCHED' : ''}`,
  milkFill: (ml: number, spec: number | null, tempC: number, foamCm: string, target: readonly [number, number]) =>
    `Fill ${ml}${spec != null ? `/${spec}` : ''} ml \u00b7 ${tempC}\u00b0C \u00b7 foam ${foamCm} cm \u00b7 target ${target[0]}\u2013${target[1]}\u00b0C`,
  vessel: (vessel: string, used: number, spare: number) =>
    `Vessel ${vessel} \u00b7 shots in cup ${used} (${spare} spare)`,
  water: (water: string, milk: string) => `Water ${water} \u00b7 milk ${milk}`,
  steps: (steps: string) => `Steps: ${steps}`,
  noSteps: 'none yet',
} as const;

/** The guided walkthrough shown on Learn levels, numbered as the player sees it. */
export const GUIDED_COPY = {
  setGrind: '1. Set the grinder to fine.',
  dose: `2. Tap Dose until you reach ${EXTRACTION.doseTargetGrams} g (${DOSE_LOW}\u2013${DOSE_HIGH} g works).`,
  tamp: `3. Hold Tamp and release inside ${TAMP_LOW}\u2013${TAMP_HIGH} kg.`,
  brew: `4. Tap Brew, then STOP between ${TIME_LOW} and ${TIME_HIGH} seconds.`,
  tampAgain: '5. Tamp the fresh dose (each shot needs its own tamp).',
  brewAgain: `6. Tap Brew, then STOP between ${TIME_LOW} and ${TIME_HIGH} seconds.`,
  pickJug: (ml: number) => `5. Milk tab: pick the ${ml > SMALL_JUG_MAX_ML ? 'large' : 'small'} jug.`,
  fill: (ml: number) => `6. Hold Fill to the line (${ml} ml).`,
  purge: '7. Tap Purge wand before steaming.',
  steam: '8. Tap Steam, watch the gauge, remove the jug on target.',
  steaming: '8. Steaming \u2014 remove the jug on target temperature.',
  chooseCup: '9. Assembly tab: choose the right cup.',
  addEspresso: '10. Tap Add espresso.',
  addWater: '11. Hold Add water to the line.',
  pourMilk: '12. Tap Pour milk.',
  serve: 'Serve when the drink matches the ticket!',
} as const;
