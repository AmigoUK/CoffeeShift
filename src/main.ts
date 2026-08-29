import Phaser from 'phaser';
import { BootScene } from './game/BootScene';
import { setInstallPrompt, setStartLevelHandler, show } from './ui/screens';
import './style.css';
import { loadSave } from './domain/save';

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
  scene: [BootScene],
});

setStartLevelHandler((levelId) => {
  game.events.emit('start-level', levelId);
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
  (window as unknown as Record<string, unknown>).__COFFEE_SHIFT = {
    game,
    startLevel: (levelId: string) => game.events.emit('start-level', levelId),
    textureKeys: () => ['machine', 'grinder', 'wand', 'jug-small', 'jug-large', 'counter', 'menu-board', 'customer-regular-1', 'vessel-demitasse', 'icon-star']
      .filter((k) => game.textures.exists(k)),
  };
  game.events.on('boot-ready', () => {
    ((window as unknown as Record<string, unknown>).__COFFEE_SHIFT as Record<string, unknown>).booted = true;
  });
}
