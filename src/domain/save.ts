export interface SaveData {
  version: 1;
  settings: { sound: boolean; vibration: boolean; reduceAnimations: boolean };
  progress: { learn: number[]; practice: number[]; shift: { stars: number; best: number }[] }; // best total % per level, index = level
  rank: 'trainee' | 'barista';
  mastery: Record<string, number>;        // skill id and 'drink:latte' style keys → 0–100
  errorTagCounts: Partial<Record<string, number>>;
  stats: { drinksServed: number; perfectOrders: number; shiftsPlayed: number };
}

export const SAVE_KEY = 'coffee-shift.save.v1';

/** Surfaced once by the UI when progress cannot persist (private mode etc.). */
export const savePersistence = { persisted: true };

let memorySave: SaveData | null = null;

export function defaultSave(): SaveData {
  return {
    version: 1,
    settings: { sound: true, vibration: true, reduceAnimations: false },
    progress: { learn: [], practice: [], shift: [] },
    rank: 'trainee',
    mastery: {},
    errorTagCounts: {},
    stats: { drinksServed: 0, perfectOrders: 0, shiftsPlayed: 0 },
  };
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function mergeSave(parsed: Partial<SaveData>): SaveData {
  const base = defaultSave();
  return {
    ...base,
    ...parsed,
    version: 1,
    settings: { ...base.settings, ...parsed.settings },
    progress: { ...base.progress, ...parsed.progress },
    stats: { ...base.stats, ...parsed.stats },
  };
}

/** Load the save; any failure yields a fresh default. Never throws. */
export function loadSave(): SaveData {
  const store = storage();
  if (store == null) {
    savePersistence.persisted = false;
    memorySave ??= defaultSave();
    return memorySave;
  }
  let raw: string | null = null;
  try {
    raw = store.getItem(SAVE_KEY);
  } catch {
    savePersistence.persisted = false;
    memorySave ??= defaultSave();
    return memorySave;
  }
  if (raw == null) return defaultSave();
  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1 || typeof parsed !== 'object' || parsed == null) return defaultSave();
    return mergeSave(parsed);
  } catch {
    return defaultSave();
  }
}

/** Persist the save after every graded order and level completion. Falls back to session memory. */
export function writeSave(save: SaveData): void {
  memorySave = save;
  const store = storage();
  if (store == null) {
    savePersistence.persisted = false;
    return;
  }
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    savePersistence.persisted = false;
  }
}

/** Test/UI helper: forget the session-memory fallback. */
export function resetMemorySave(): void {
  memorySave = null;
  savePersistence.persisted = true;
}
