import type { DrinkId, DrinkOrder, MilkId, SizeId } from './types';
import { RECIPES, defaultShots, resolveShots } from './recipes';
import { drinkWeight } from './progression';
import type { LevelDef } from './levels';
import type { SaveData } from './save';

/** Seeded RNG (mulberry32) — deterministic order generation for tests and Learn levels. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T>(items: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
}

/**
 * Generate a level's orders. Drinks are picked from the level pool weighted by
 * the player's fault history (adaptive difficulty); modifiers come from the
 * level's pools and chances.
 */
export function generateOrders(level: LevelDef, rng: () => number, save: SaveData): DrinkOrder[] {
  const orders: DrinkOrder[] = [];
  for (let i = 0; i < level.orderCount; i++) {
    const drink = weightedPick(
      level.drinkPool,
      level.drinkPool.map((d) => drinkWeight(save, d)),
      rng,
    ) as DrinkId;
    const recipe = RECIPES[drink];
    const sizes = recipe.allowedSizes.filter((s) => level.sizes.includes(s));
    const size: SizeId =
      sizes.length > 0 ? (sizes[Math.floor(rng() * sizes.length)] as SizeId) : (recipe.allowedSizes[0] as SizeId);
    let milk: MilkId = 'whole';
    if (recipe.milkDrink && level.milks.length > 1) {
      milk = level.milks[Math.floor(rng() * level.milks.length)] as MilkId;
    }
    const takeaway = level.takeaway && rng() < level.takeawayChance;
    const extraShot = level.extraShot && rng() < level.extraShotChance;
    const extraHot = recipe.milkDrink && level.extraHot && rng() < level.extraHotChance;
    orders.push({ drink, size, shots: resolveShots(drink, size, extraShot), milk, extraHot, takeaway });
  }
  return orders;
}

export interface CustomerArchetype {
  id: string;
  name: string;
  lineStyle: 'plain' | 'could-i-get' | 'counting';
}

export const ARCHETYPES: CustomerArchetype[] = [
  { id: 'regular', name: 'The Regular', lineStyle: 'plain' },
  { id: 'student', name: 'The Student', lineStyle: 'could-i-get' },
  { id: 'commuter', name: 'The Commuter', lineStyle: 'counting' },
];

const SHOT_WORDS: Record<number, string> = { 2: 'double', 3: 'triple' };

/** Noun phrase without article, e.g. "medium oat latte", "double espresso". */
function nounPhrase(
  order: { drink: DrinkId; size: SizeId; shots: number; milk: MilkId },
  includeSize: boolean,
): string {
  const recipe = RECIPES[order.drink];
  const milk = recipe.milkDrink && order.milk !== 'whole' ? `${order.milk} ` : '';
  const espressoShot = order.drink === 'espresso' ? SHOT_WORDS[order.shots] : undefined;
  const size = includeSize && order.drink !== 'espresso' && !espressoShot ? `${order.size} ` : '';
  return `${size}${milk}${espressoShot != null ? `${espressoShot} ` : ''}${recipe.name.toLowerCase()}`;
}

function article(phrase: string): string {
  return /^[aeiou]/.test(phrase) ? 'An' : 'A';
}

/** Deterministic British English order line, e.g. "A medium oat latte, extra hot, to take away, please." */
export function orderLine(
  order: { drink: DrinkId; size: SizeId; shots: number; milk: MilkId; extraHot: boolean; takeaway: boolean },
  customer: CustomerArchetype,
): string {
  const recipe = RECIPES[order.drink];
  const hasExtraShot = order.shots > defaultShots(order.drink, order.size);
  const hot = order.extraHot && recipe.milkDrink;

  if (customer.lineStyle === 'counting') {
    const head = `One ${nounPhrase(order, true)}`;
    return `${head}${order.takeaway ? ' to go' : ''}, please.`;
  }
  if (customer.lineStyle === 'could-i-get') {
    const phrase = nounPhrase(order, true);
    const extras: string[] = [];
    if (hasExtraShot) extras.push('with an extra shot');
    if (hot) extras.push('extra hot');
    if (order.takeaway) extras.push('to take away');
    return `Could I get ${article(phrase).toLowerCase()} ${phrase}${extras.length > 0 ? ` ${extras.join(', ')}` : ''}?`;
  }
  // plain
  const phrase = nounPhrase(order, true);
  const extras: string[] = [];
  if (hot) extras.push('extra hot');
  if (order.takeaway) extras.push('to take away');
  return `${article(phrase)} ${phrase}${extras.length > 0 ? `, ${extras.join(', ')}` : ''}, please.`;
}

export function archetypeForOrderIndex(index: number): CustomerArchetype {
  return ARCHETYPES[index % ARCHETYPES.length] as CustomerArchetype;
}
