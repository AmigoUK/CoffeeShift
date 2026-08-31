/**
 * Generates PWA icons in public/icons/ from the pixel-art APP_ICON sprite data
 * in src/sprites/ui.ts — the single source of truth. Hand-rolled PNG encoder
 * over node:zlib; no new dependencies.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function extractNamedBlock(source, name) {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) throw new Error(`generate-icons: cannot find export ${name}`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  throw new Error(`generate-icons: unterminated block for ${name}`);
}

function parseSprite(source, name) {
  const block = extractNamedBlock(source, name);
  const w = Number(/w:\s*(\d+)/.exec(block)?.[1]);
  const h = Number(/h:\s*(\d+)/.exec(block)?.[1]);
  const rowsMatch = /rows:\s*\[([\s\S]*?)\]/.exec(block);
  if (!rowsMatch || !w || !h) throw new Error(`generate-icons: cannot parse ${name}`);
  const rows = [...rowsMatch[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
  if (rows.length !== h) throw new Error(`generate-icons: ${name} has ${rows.length} rows, expected ${h}`);
  return { w, h, rows };
}

function parsePalette(source) {
  const block = extractNamedBlock(source, 'PALETTE');
  const map = {};
  for (const m of block.matchAll(/([A-Za-z]):\s*'#[0-9a-fA-F]{6}'/g)) {
    map[m[1]] = m[0].slice(m[0].indexOf("'"));
  }
  return map;
}

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// ---- minimal PNG encoder (RGBA, 8-bit) ----
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Render the sprite scaled by an integer factor over a solid background. */
function render(sprite, palette, size, background, contentScale) {
  const rgba = Buffer.alloc(size * size * 4);
  const [br, bg, bb] = hexToRgb(background);
  const factor = Math.floor((size * contentScale) / sprite.w);
  const offset = Math.floor((size - sprite.w * factor) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const sx = Math.floor((x - offset) / factor);
      const sy = Math.floor((y - offset) / factor);
      const ch = sprite.rows[sy]?.[sx];
      const hex = ch != null ? palette[ch] : undefined;
      if (hex != null && ch !== '.' && ch !== ' ') {
        const [r, g, b] = hexToRgb(hex);
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = 255;
      } else {
        rgba[i] = br;
        rgba[i + 1] = bg;
        rgba[i + 2] = bb;
        rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}

const uiSource = readFileSync(join(root, 'src/sprites/ui.ts'), 'utf8');
const paletteSource = readFileSync(join(root, 'src/sprites/palette.ts'), 'utf8');
const icon = parseSprite(uiSource, 'APP_ICON');
const palette = parsePalette(paletteSource);
const coffee = palette['B'] ?? "'#6f4e37'";

const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), encodePng(size, size, render(icon, palette, size, coffee, 1)));
  writeFileSync(join(outDir, `maskable-${size}.png`), encodePng(size, size, render(icon, palette, size, coffee, 0.8)));
  writeFileSync(join(outDir, `favicon-${size}.png`), encodePng(size, size, render(icon, palette, size, coffee, 1)));
}
console.log(`generate-icons: wrote icons to public/icons (${icon.w}x${icon.h} source sprite)`);
