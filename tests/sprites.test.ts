import { describe, expect, it } from 'vitest';
import { SPRITES } from '../src/sprites/index';
import { PALETTE, TRANSPARENT_CHARS } from '../src/sprites/palette';

describe('pixel sprite data invariants', () => {
  it('every sprite has at least one row', () => {
    for (const [key, sprite] of Object.entries(SPRITES)) {
      expect(sprite.rows.length, key).toBeGreaterThan(0);
    }
  });

  it('every row is exactly w chars and every char is palette/transparent', () => {
    for (const [key, sprite] of Object.entries(SPRITES)) {
      for (const [y, row] of sprite.rows.entries()) {
        expect(row.length, `${key} row ${y}`).toBe(sprite.w);
      }
      expect(sprite.rows.length, `${key} h`).toBe(sprite.h);
    }
  });

  it('uses only known palette characters', () => {
    for (const [key, sprite] of Object.entries(SPRITES)) {
      for (const row of sprite.rows) {
        for (const ch of row) {
          if (TRANSPARENT_CHARS.has(ch)) continue;
          expect(PALETTE[ch], `${key} uses '${ch}'`).toBeDefined();
        }
      }
    }
  });
});
