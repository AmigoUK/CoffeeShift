import type Phaser from 'phaser';
import { SPRITES } from './index';
import { PALETTE, TRANSPARENT_CHARS } from './palette';

/** Render every string-map sprite to an offscreen canvas and register it as a texture. */
export function registerTextures(scene: Phaser.Scene): void {
  for (const [key, sprite] of Object.entries(SPRITES)) {
    if (scene.textures.exists(key)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = sprite.w;
    canvas.height = sprite.h;
    const ctx = canvas.getContext('2d');
    if (ctx == null) continue;
    sprite.rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (TRANSPARENT_CHARS.has(ch)) return;
        const hex = PALETTE[ch];
        if (hex == null) return;
        ctx.fillStyle = hex;
        ctx.fillRect(x, y, 1, 1);
      });
    });
    scene.textures.addCanvas(key, canvas);
  }
}
