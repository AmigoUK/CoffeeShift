import './style.css';
import type Phaser from 'phaser';
import { setTimeScale } from './game/timeScale';
import type { LevelCompletePayload } from './game/GameScene';
import { setExitGameHandler, setInstallPrompt, setStartLevelHandler, show, showSummary } from './ui/screens';
import { BOOT_ERROR_COPY, GAME_COPY } from './ui/copy';
import * as layout from './game/layout';
import { loadSave, writeSave } from './domain/save';
import { applyLevelResult, habitHints } from './domain/progression';

/**
 * Phaser needs WebGL or Canvas2D. Without this guard a browser that provides neither leaves
 * the player staring at an empty page with no explanation.
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

let game: Phaser.Game | null = null;
let loading: Promise<Phaser.Game> | null = null;

function wireGame(instance: Phaser.Game): void {
  instance.events.on('start-level', (levelId: string) => {
    show('game');
    instance.scene.start('game', { levelId });
  });

  instance.events.on('level-complete', (payload: LevelCompletePayload) => {
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

  instance.events.on('exit-level', () => {
    show('menu');
  });

  // The canvas is opaque to assistive technology; at least say what it is.
  instance.canvas?.setAttribute('role', 'img');
  instance.canvas?.setAttribute('aria-label', GAME_COPY.canvasLabel);
}

/**
 * Load Phaser and start the game on first use, then reuse it. Resolves once BootScene has
 * generated its textures, so callers can start a level straight away.
 */
async function ensureGame(): Promise<Phaser.Game> {
  loading ??= (async () => {
    let instance: Phaser.Game;
    try {
      const { createGame } = await import('./game/bootstrap');
      instance = createGame();
    } catch (error) {
      console.error('Coffee Shift could not start Phaser', error);
      reportBootFailure();
      throw error;
    }
    wireGame(instance);
    if (!instance.textures.exists('machine')) {
      await new Promise<void>((resolve) => instance.events.once('boot-ready', () => resolve()));
    }
    game = instance;
    if (import.meta.env.DEV) {
      const hook = (window as unknown as Record<string, unknown>).__COFFEE_SHIFT as Record<string, unknown> | undefined;
      if (hook != null) {
        hook.game = instance;
        hook.booted = true;
        instance.events.on('served', (report: unknown) => { hook.lastReport = report; });
      }
    }
    return instance;
  })();
  return loading;
}

async function startLevel(levelId: string): Promise<void> {
  const instance = await ensureGame();
  instance.events.emit('start-level', levelId);
}

setStartLevelHandler((levelId) => {
  void startLevel(levelId);
});

setExitGameHandler(() => {
  game?.scene.stop('game');
  show('menu', { fromHistory: true });
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  setInstallPrompt(event as unknown as { prompt: () => Promise<void> });
});

// The shell is plain DOM, so show it immediately rather than after Phaser has booted.
loadSave();
show('menu');

if (import.meta.env.DEV) {
  // Dev-only verification hook: lets browser tests observe boot and textures.
  const hook: Record<string, unknown> = {
    game: null as unknown,
    booted: true,
    startLevel,
    textureKeys: async () => {
      const instance = await ensureGame();
      return ['machine', 'grinder', 'wand', 'jug-small', 'jug-large', 'counter', 'menu-board', 'customer-regular-1', 'vessel-demitasse', 'icon-star']
        .filter((k) => instance.textures.exists(k));
    },
    lastReport: null as unknown,
    canvasRect: async () => {
      await ensureGame();
      return document.querySelector('#game-canvas canvas')?.getBoundingClientRect().toJSON() ?? null;
    },
    activeScene: () => game?.scene.getScene('game') ?? null,
    layout: () => ({ ...layout }),
    setTimeScale,
  };
  (window as unknown as Record<string, unknown>).__COFFEE_SHIFT = hook;
}
