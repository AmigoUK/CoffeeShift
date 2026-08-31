import './style.css';
import Phaser from 'phaser';
import { BootScene } from './game/BootScene';
import { setTimeScale } from './game/timeScale';
import { GameScene } from './game/GameScene';
import type { LevelCompletePayload } from './game/GameScene';
import { setInstallPrompt, setStartLevelHandler, show, showSummary } from './ui/screens';
import { BOOT_ERROR_COPY } from './ui/copy';
import { loadSave, writeSave } from './domain/save';
import { applyLevelResult, habitHints } from './domain/progression';

/**
 * Phaser needs WebGL or Canvas2D. Without this guard a browser that provides neither
 * throws during module evaluation, the rest of main.ts never runs and the player is left
 * staring at an empty page with no explanation.
 */
function reportBootFailure(): void {
  const host = document.getElementById('overlay') ?? document.body;
  const panel = document.createElement('div');
  panel.className = 'boot-error';
  panel.setAttribute('role', 'alert');
  const title = document.createElement('h1');
  title.textContent = BOOT_ERROR_COPY.title;
  const body = document.createElement('p');
  body.textContent = BOOT_ERROR_COPY.noCanvas;
  panel.append(title, body);
  host.replaceChildren(panel);
  host.hidden = false;
}

let game: Phaser.Game;
try {
  game = new Phaser.Game({
  type: Phaser.AUTO,
  pixelArt: true,
  parent: 'game-canvas',
  backgroundColor: '#fdf6ec',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,
    height: 844,
  },
  scene: [BootScene, GameScene],
  });
} catch (error) {
  console.error('Coffee Shift could not start Phaser', error);
  reportBootFailure();
  throw error;
}

setStartLevelHandler((levelId) => {
  game.events.emit('start-level', levelId);
});

game.events.on('start-level', (levelId: string) => {
  show('game');
  game.scene.start('game', { levelId });
});

game.events.on('level-complete', (payload: LevelCompletePayload) => {
  const save = loadSave();
  const { avg, stars } = applyLevelResult(save, payload.levelId, payload.reports);
  writeSave(save);
  showSummary({
    levelId: payload.levelId,
    avg,
    stars,
    reports: payload.reports.map((r) => ({ order: { drink: r.order.drink }, total: r.total, feedback: [...r.feedback] })),
    masteryAfter: save.mastery,
    hints: habitHints(save),
  });
});

game.events.on('exit-level', () => {
  show('menu');
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  setInstallPrompt(event as unknown as { prompt: () => Promise<void> });
});

game.events.on('boot-ready', () => {
  loadSave();
  show('menu');
});

if (import.meta.env.DEV) {
  // Dev-only verification hook: lets browser tests observe boot and textures.
  const hook: Record<string, unknown> = {
    game,
    startLevel: (levelId: string) => game.events.emit('start-level', levelId),
    textureKeys: () => ['machine', 'grinder', 'wand', 'jug-small', 'jug-large', 'counter', 'menu-board', 'customer-regular-1', 'vessel-demitasse', 'icon-star']
      .filter((k) => game.textures.exists(k)),
    lastReport: null as unknown,
    canvasRect: () => document.querySelector('#game-canvas canvas')?.getBoundingClientRect().toJSON() ?? null,
    activeScene: () => game.scene.getScene('game'),
    setTimeScale,
  };
  (window as unknown as Record<string, unknown>).__COFFEE_SHIFT = hook;
  game.events.on('served', (report: unknown) => { hook.lastReport = report; });
  game.events.on('boot-ready', () => {
    ((window as unknown as Record<string, unknown>).__COFFEE_SHIFT as Record<string, unknown>).booted = true;
  });
}
