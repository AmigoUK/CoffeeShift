import Phaser from 'phaser';
import { BootScene } from './game/BootScene';
import { setTimeScale } from './game/timeScale';
import { GameScene } from './game/GameScene';
import type { LevelCompletePayload } from './game/GameScene';
import { setInstallPrompt, setStartLevelHandler, show, showSummary } from './ui/screens';
import { loadSave, writeSave } from './domain/save';
import { applyLevelResult, habitHints } from './domain/progression';

const game = new Phaser.Game({
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
