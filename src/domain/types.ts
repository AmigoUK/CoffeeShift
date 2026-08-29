export type DrinkId = 'espresso' | 'americano' | 'latte' | 'cappuccino' | 'flat-white';
export type SizeId = 'small' | 'medium' | 'large';
export type MilkId = 'whole' | 'semi-skimmed' | 'oat';
export type VesselId = 'demitasse' | 'americano-mug' | 'cappuccino-cup' | 'latte-glass' | 'flat-white-cup' | 'takeaway-cup';
export type GrindId = 'fine' | 'medium' | 'coarse';
export type JugId = 'small-jug' | 'large-jug';

export interface DrinkOrder {
  drink: DrinkId; size: SizeId; shots: number;      // shots = resolved final count
  milk: MilkId;                                     // dairy default 'whole'; ignored for americano/espresso
  extraHot: boolean; takeaway: boolean;
}

export interface MilkResult { typeUsed: MilkId | null; tempC: number | null; foamCm: number; wandPurged: boolean; jug: JugId | null; volumeMl: number | null; }
export interface ExtractionPull { grind: GrindId; doseGrams: number; tampOk: boolean; seconds: number; }
export interface PreparedDrink {
  drink: DrinkId; vessel: VesselId;
  pulls: ExtractionPull[];                          // length = shots pulled
  milk: MilkResult | null;                          // null if milk station never used
  waterMl: number | null;                           // americano only
  assemblyActions: string[];                        // ordered: 'vessel' | 'shot' | 'water' | 'milk'
  wasteEvents: string[];                            // 'binned-drink' | 'emptied-jug' | 'lost-customer' | 'jug-overflow'
  elapsedSeconds: number; timedLevel: boolean;      // timedLevel false → time component = full marks
}

export type FeedbackId =
  'PERFECT_ORDER' | 'CORRECT_DRINK' | 'WRONG_MILK' | 'MILK_TOO_HOT' | 'FOAM_TOO_THICK' | 'FOAM_TOO_THIN'
  | 'EXTRACTION_TOO_FAST' | 'EXTRACTION_TOO_SLOW' | 'INCORRECT_SERVING_CUP' | 'STEAM_WAND_NOT_PURGED'
  | 'DOSE_LOW' | 'DOSE_HIGH' | 'WRONG_SIZE' | 'WRONG_SHOT_COUNT' | 'UNEVEN_TAMP' | 'MISSING_STEP'
  | 'JUG_TOO_LARGE';

export interface ScoreReport {
  total: number; // 0–100
  breakdown: { orderMatch: number; recipe: number; technique: number; time: number; waste: number }; // max 45/25/15/10/5
  feedback: FeedbackId[];
  summarySentence: string;   // e.g. "Correct recipe. The milk was overheated and the foam was too thick for a latte."
}

export type ModeId = 'learn' | 'practice' | 'shift';
