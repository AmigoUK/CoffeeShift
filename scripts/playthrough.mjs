/**
 * Playthrough bot: plays every level end-to-end in "clean" or "sloppy" mode and
 * reports per-level score metrics for difficulty tuning.
 *
 *   node scripts/playthrough.mjs clean   # optimal play: everything mid-band, parallel prep
 *   node scripts/playthrough.mjs sloppy  # median-player faults: fast shots, ±temp, ±volume
 *   SCALE=3 node scripts/playthrough.mjs clean   # game clock 3× faster
 *
 * Requires the dev server (npm run dev) — the bot drives the dev-only hook.
 * House Standard constants mirrored here deliberately: the bot encodes the
 * player's knowledge of the recipes.
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const MODE = process.argv[2] ?? 'clean';
const SCALE = Number(process.env.SCALE ?? 2);
const BASE = 'http://localhost:5173';
const OUT = `/tmp/playthrough-${MODE}.json`;
const LEVELS = (process.env.LEVELS ?? 'L1,L2,L3,L4,L5,P1,P2,P3,P4,P5,S1,S2,S3,S4,S5,S6,S7,S8,S9,S10').split(',');
// reaction budget: a skilled human reacts in ~0.3-0.45 s; the bot's evaluate
// latency plays the same role. Release holds predictively before the target.
const REACTION_S = 0.45;

// ---- House Standard reference (mirrors src/domain) ----
const MILK_ML = {
  latte: { small: 180, medium: 300, large: 420 },
  cappuccino: { small: 100, medium: 140 },
  'flat-white': { small: 110 },
};
const WATER_ML = { americano: { small: 150, medium: 250, large: 350 } };
const FOAM_OK = { latte: [0.5, 1.5], cappuccino: [1.5, 3.5], 'flat-white': [0, 1.0] };
const VESSEL = {
  espresso: [65, 655], americano: [195, 655], cappuccino: [325, 655],
  latte: [65, 711], 'flat-white': [195, 711], 'takeaway-cup': [325, 711],
};
const TAMP_HOLD_MS = 2200; // ≈17.6 kg at 8 kg/s

// seeded sloppy rng → reproducible runs
let seed = 20260829;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const clean = MODE === 'clean';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));

await page.goto(BASE);
for (let i = 0; i < 150; i++) {
  if (await page.evaluate(() => window.__COFFEE_SHIFT?.booted === true)) break;
  await page.waitForTimeout(200);
}
await page.evaluate((s) => window.__COFFEE_SHIFT.setTimeScale(s), SCALE);
const rect = await page.evaluate(() => window.__COFFEE_SHIFT.canvasRect());
const sx = rect.width / 390, sy = rect.height / 844;

const tap = async (gx, gy) => { await page.mouse.click(rect.left + gx * sx, rect.top + gy * sy); await page.waitForTimeout(60); };
const holdFor = async (gx, gy, ms) => {
  await page.mouse.move(rect.left + gx * sx, rect.top + gy * sy);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await page.waitForTimeout(60);
};
const scene = () => page.evaluate(() => window.__COFFEE_SHIFT.activeScene());
const currentOrder = async () => {
  const s = await scene();
  return { s, order: s.orders[s.drinkIndex] ?? null };
};
async function waitState(pred, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    const s = await scene();
    if (pred(s)) return s;
    if (Date.now() - start > timeoutMs) throw new Error(`waitState(${label}) timed out: ${JSON.stringify({ level: s.level?.id, brewing: s.ext.brewing, secs: Math.round(s.ext.brewSeconds), fill: Math.round(s.milk.fillMl), temp: Math.round(s.milk.tempC), steaming: s.milk.steaming })}`);
    await page.waitForTimeout(120);
  }
}
// Closed-loop hold: poll the live value and release when the value PROJECTED
// over the measured evaluate latency reaches the target. The observed value is
// stale by one round-trip; without projection the bot overshoots fast ramps.
const holdUntilValue = async (gx, gy, readExpr, ratePerRealSec, target, timeoutMs, label) => {
  await page.mouse.move(rect.left + gx * sx, rect.top + gy * sy);
  await page.mouse.down();
  try {
    const start = Date.now();
    for (;;) {
      const t0 = Date.now();
      const v = await page.evaluate(readExpr);
      const latencyS = (Date.now() - t0 + 150) / 1000;
      if (v + ratePerRealSec * latencyS >= target) break;
      if (Date.now() - start > timeoutMs) throw new Error(`holdUntilValue(${label}) timed out at ${v}`);
      await page.waitForTimeout(50);
    }
  } finally { await page.mouse.up(); }
  await page.waitForTimeout(60);
};

// Tap-based variant for stop-style actions (brew stop, jug off).
const tapAtProjected = async (gx, gy, readExpr, ratePerRealSec, target, timeoutMs, label) => {
  const start = Date.now();
  for (;;) {
    const t0 = Date.now();
    const v = await page.evaluate(readExpr);
    const latencyS = (Date.now() - t0 + 150) / 1000;
    if (v + ratePerRealSec * latencyS >= target) break;
    if (Date.now() - start > timeoutMs) throw new Error(`tapAtProjected(${label}) timed out at ${v}`);
    await page.waitForTimeout(50);
  }
  await tap(gx, gy);
};


let milkTrace = null;
const shotAnomalies = [];


async function ensureTab(station) {
  for (let guard = 0; guard < 5; guard++) {
    const cur = await page.evaluate(() => window.__COFFEE_SHIFT.activeScene().activeStation);
    if (cur === station) return;
    await tap(station === 'espresso' ? 65 : station === 'milk' ? 195 : 325, 290);
    await page.waitForTimeout(250);
  }
  throw new Error(`could not switch to ${station} tab`);
}

async function readField(expr) {
  return page.evaluate(expr);
}

async function playDrink() {
  milkTrace = null;
  // ESPRESSO — computed waits, every command verified
  await ensureTab('espresso');
  for (;;) {
    const { s, order } = await currentOrder();
    if (order == null || s.ext.pulls.length >= order.shots) break;
    const wantDose = clean ? 18 : 17 + Math.floor(rnd() * 3);
    for (let guard = 0; guard < 8; guard++) {
      const d = await readField(() => window.__COFFEE_SHIFT.activeScene().ext.doseGrams);
      if (d >= wantDose) break;
      await tap(65, 712);
    }
    for (let guard = 0; guard < 4; guard++) {
      await holdFor(195, 712, Math.round(TAMP_HOLD_MS / SCALE));
      const good = await readField(() => window.__COFFEE_SHIFT.activeScene().ext.tampGood);
      if (good === true) break;
    }
    const stopAt = clean ? 27.0 : (rnd() < 0.3 ? 22.5 : 28.5);
    await tap(325, 712); // brew
    // verify with a FRESH read; a blind re-tap could stop an already-running shot
    for (let guard = 0; guard < 3; guard++) {
      const brewing = await readField(() => window.__COFFEE_SHIFT.activeScene().ext.brewing);
      if (brewing === true) break;
      await page.waitForTimeout(250);
      if (guard < 2) await tap(325, 712);
    }
    await page.waitForTimeout(Math.max(0, (stopAt - 1.2) * 1000) / SCALE);
    // stop with read-before-tap discipline: never tap unless brewing is confirmed
    let pullsBefore = -1;
    for (let guard = 0; guard < 6; guard++) {
      const ext = await readField(() => { const e = window.__COFFEE_SHIFT.activeScene().ext; return { brewing: e.brewing, pulls: e.pulls.length }; });
      if (pullsBefore < 0) pullsBefore = ext.pulls;
      if (!ext.brewing) break;
      await tap(325, 712);
      await page.waitForTimeout(350);
    }
    const pullsAfter = await readField(() => window.__COFFEE_SHIFT.activeScene().ext.pulls.length);
    if (pullsAfter !== pullsBefore + 1) shotAnomalies.push(`pulls ${pullsBefore}->${pullsAfter} after ${stopAt}s`);
  }


  // MILK
  let { s, order } = await currentOrder();
  if (order != null && order.drink in MILK_ML) {
    shotAnomalies.push(`milk-entry ${order.drink}/${order.size} shots=${order.shots} pulls=${s.ext.pulls.length}`);
    await ensureTab('milk');
    const spec = MILK_ML[order.drink][order.size];
    const wantJug = spec > 150 ? 'large-jug' : 'small-jug';
    for (let guard = 0; guard < 4; guard++) {
      const j = await readField(() => window.__COFFEE_SHIFT.activeScene().milk.jug);
      if (j === wantJug) break;
      await tap(wantJug === 'large-jug' ? 195 : 65, 655);
      await page.waitForTimeout(200);
    }
    for (let i = 0; i < 4; i++) {
      const mt = await readField(() => window.__COFFEE_SHIFT.activeScene().milk.type);
      if (mt === order.milk) break;
      await tap(325, 655);
      await page.waitForTimeout(150);
    }
    const fillTarget = spec * (clean ? 0.99 : 0.9 + rnd() * 0.18);
    await holdFor(65, 712, Math.max(0, ((fillTarget - 4) / (90 * SCALE)) * 1000));
    for (let trim = 0; trim < 5; trim++) {
      const f = await readField(() => window.__COFFEE_SHIFT.activeScene().milk.fillMl);
      if (f >= fillTarget - 6) break;
      await holdFor(65, 712, 120);
    }
    if (clean || rnd() >= 0.25) {
      for (let guard = 0; guard < 3; guard++) {
        const p = await readField(() => window.__COFFEE_SHIFT.activeScene().milk.purged);
        if (p === true) break;
        await tap(195, 712);
        await page.waitForTimeout(150);
      }
    }
    const tempBand = order.extraHot ? [68, 76] : (order.milk === 'oat' ? [50, 60] : [55, 65]);
    const foamBand = FOAM_OK[order.drink];
    const tempTarget = clean ? (tempBand[0] + tempBand[1]) / 2 : tempBand[0] + rnd() * (tempBand[1] - tempBand[0] + 4);
    const foamTarget = clean ? (foamBand[0] + foamBand[1]) / 2 : foamBand[0] - 0.2 + rnd() * (foamBand[1] - foamBand[0] + 0.9);
    const tempRateGs = order.milk === 'oat' ? 3.5 : 3;
    for (let guard = 0; guard < 4; guard++) {
      await tap(325, 712);
      try { await waitState((x) => x.milk.steaming, 1800, 'steam start'); break; } catch { /* retry tap */ }
    }
    const switchDepth = clean || rnd() >= 0.25;
    if (switchDepth) {
      const foamSwitch = Math.max(0.05, foamTarget - 0.35);
      await page.waitForTimeout(Math.max(0, (foamSwitch / (0.14 * SCALE)) * 1000 - 250));
      await tap(195, 764);
      await page.waitForTimeout(300);
      for (let guard = 0; guard < 5; guard++) {
        const depth = await readField(() => window.__COFFEE_SHIFT.activeScene().milk.wandDepth);
        if (depth === 'deep') break;
        await tap(195, 764);
        await page.waitForTimeout(300);
      }
    }
    const tempNow = await readField(() => window.__COFFEE_SHIFT.activeScene().milk.tempC);
    const steamForS = Math.max(0, (tempTarget - tempNow - 1.2) / tempRateGs);
    await page.waitForTimeout((steamForS * 1000) / SCALE);
    let jugOff = false;
    for (let guard = 0; guard < 4 && !jugOff; guard++) {
      if (guard > 0) await tap(325, 712);
      try { await waitState((x) => !x.milk.steaming, 2500, 'jug off check'); jugOff = true; } catch { /* retry */ }
    }
    if (!jugOff) throw new Error('could not remove the jug');
    milkTrace = await readField(() => {
      const m = window.__COFFEE_SHIFT.activeScene().milk;
      return { fill: Math.round(m.fillMl), temp: Math.round(m.tempC), foam: Math.round(m.foamCm * 100) / 100, depth: m.wandDepth, type: m.type, ruined: m.ruined };
    });
  }

  // ASSEMBLY
  ({ s, order } = await currentOrder());
  if (order == null) return;
  await ensureTab('assembly');
  const v = order.takeaway ? 'takeaway-cup' : order.drink;
  const [vx, vy] = VESSEL[v] ?? VESSEL.espresso;
  for (let guard = 0; guard < 4; guard++) {
    const vs = await readField(() => window.__COFFEE_SHIFT.activeScene().asm.vessel);
    if (vs === v) break;
    await tap(vx, vy);
    await page.waitForTimeout(200);
  }
  const shotsAvailable = await readField(() => window.__COFFEE_SHIFT.activeScene().ext.pulls.length - window.__COFFEE_SHIFT.activeScene().asm.shotsUsed);
  for (let i = 0; i < Math.min(order.shots, shotsAvailable); i++) await tap(65, 764);
  if (order.drink === 'americano') {
    const spec = WATER_ML.americano[order.size];
    const target = spec * (clean ? 0.99 : 0.9 + rnd() * 0.18);
    await holdFor(195, 764, Math.max(0, ((target - 3) / (60 * SCALE)) * 1000));
    for (let trim = 0; trim < 5; trim++) {
      const w = await readField(() => window.__COFFEE_SHIFT.activeScene().asm.waterMl ?? 0);
      if (w >= target - 8) break;
      await holdFor(195, 764, 120);
    }
  }
  if (order.drink in MILK_ML) {
    for (let guard = 0; guard < 4; guard++) {
      await holdFor(325, 764, 150);
      const poured = await readField(() => window.__COFFEE_SHIFT.activeScene().asm.milkPoured);
      if (poured === true) break;
    }
  }
}

async function playLevel(id) {
  await page.evaluate((lid) => {
    localStorage.removeItem('coffee-shift.save.v1');
    const save = {
      version: 1,
      settings: { sound: false, vibration: false, reduceAnimations: true },
      progress: {
        learn: [100, 100, 100, 100, 100],
        practice: [100, 100, 100, 100, 100],
        shift: Array.from({ length: 9 }, () => ({ stars: 1, best: 70 })),
      },
      rank: 'barista', mastery: {}, errorTagCounts: {},
      stats: { drinksServed: 0, perfectOrders: 0, shiftsPlayed: 0 },
    };
    localStorage.setItem('coffee-shift.save.v1', JSON.stringify(save));
    window.__COFFEE_SHIFT.startLevel(lid);
  }, id);
  await waitState((s) => s.level?.id === id && s.orders.length > 0, 20000, `${id} start`);

  const reports = [];
  for (;;) {
    const s = await scene();
    if (s.level == null) break; // level finished
    if (s.feedbackCard != null) { await tap(195, 640); await page.waitForTimeout(250); continue; }
    if (s.transitioning) { await page.waitForTimeout(400); continue; } // customer lost transition
    const order = s.orders[s.drinkIndex] ?? null;
    if (order == null) { await page.waitForTimeout(400); continue; }
    await playDrink();
    await tap(320, 812); // serve
    const st = await scene();
    if (st.feedbackCard == null && !st.transitioning) {
      await waitState((x) => x.feedbackCard != null || x.transitioning, 30000, 'serve');
    }
    if (st.transitioning || (await scene()).transitioning) {
      reports.push({ total: 0, feedback: [], breakdown: null, lost: true });
      await page.waitForTimeout(2000);
      continue;
    }
    const rep = await page.evaluate(() => window.__COFFEE_SHIFT.lastReport);
    reports.push({ ...rep, lost: false, milk: milkTrace });
    await tap(195, 640); // next
    await page.waitForTimeout(250);
  }
  return reports;
}

const results = [];
for (const id of LEVELS) {
  const t0 = Date.now();
  let reports;
  try {
    reports = await playLevel(id);
  } catch (e) {
    results.push({ id, error: String(e).slice(0, 300), anomalies: shotAnomalies.slice() });
    continue;
  }
  const totals = reports.map((r) => r.total);
  const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  const cats = reports.filter((r) => r.breakdown).map((r) => r.breakdown);
  const mean = (key) => cats.length ? (cats.reduce((s2, c) => s2 + c[key], 0) / cats.length).toFixed(1) : '-';
  const lost = reports.filter((r) => r.lost).length;
  const faults = {};
  for (const r of reports) for (const f of r.feedback ?? []) faults[f] = (faults[f] ?? 0) + 1;
  results.push({ id, orders: reports.length, avg, stars: avg >= 95 ? 3 : avg >= 85 ? 2 : avg >= 70 ? 1 : 0, lost,
    orderMatch: mean('orderMatch'), recipe: mean('recipe'), technique: mean('technique'), time: mean('time'), waste: mean('waste'), faults,
    drinks: reports.map((r) => ({ total: r.total, feedback: r.feedback, milk: r.milk ?? null })) });
  console.log(`${id}  n=${reports.length}  avg=${avg}%  stars=${avg >= 95 ? 3 : avg >= 85 ? 2 : avg >= 70 ? 1 : 0}  lost=${lost}  o=${mean('orderMatch')} r=${mean('recipe')} t=${mean('technique')} time=${mean('time')} w=${mean('waste')}  [${Math.round((Date.now() - t0) / 1000)}s]`);
}

writeFileSync(OUT, JSON.stringify({ mode: MODE, scale: SCALE, results, pageErrors }, null, 2));
console.log(`\nwrote ${OUT}; pageErrors=${pageErrors.length}`);
await browser.close();
