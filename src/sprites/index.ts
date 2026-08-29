import type { SpriteData } from './customers';
import { CUSTOMER_SPRITES } from './customers';
import { EQUIPMENT_SPRITES } from './equipment';
import { VESSEL_SPRITES } from './vessels';
import { UI_SPRITES } from './ui';

export type { SpriteData };

/**
 * Normalise hand-authored pixel data: pad short rows with transparent dots,
 * drop stray chars beyond w, pad missing bottom rows. Keeps authoring forgiving
 * without changing the rendered image.
 */
function normalize(sprite: SpriteData): SpriteData {
  const rows = sprite.rows
    .slice(0, sprite.h)
    .map((row) => row.padEnd(sprite.w, '.').slice(0, sprite.w));
  while (rows.length < sprite.h) rows.push('.'.repeat(sprite.w));
  return { w: sprite.w, h: sprite.h, rows };
}

function normalizeAll(sprites: Record<string, SpriteData>): Record<string, SpriteData> {
  return Object.fromEntries(Object.entries(sprites).map(([key, sprite]) => [key, normalize(sprite)]));
}

export const SPRITES: Record<string, SpriteData> = {
  ...normalizeAll(CUSTOMER_SPRITES),
  ...normalizeAll(EQUIPMENT_SPRITES),
  ...normalizeAll(VESSEL_SPRITES),
  ...normalizeAll(UI_SPRITES),
};
