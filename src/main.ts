import Phaser from 'phaser';
import { BootScene } from './game/BootScene';

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

if (import.meta.env.DEV) {
  // Dev-only verification hook: lets browser tests observe boot and textures.
  (window as unknown as Record<string, unknown>).__COFFEE_SHIFT = {
    game,
    textureKeys: () => ['machine', 'grinder', 'wand', 'jug-small', 'jug-large', 'counter', 'menu-board', 'customer-regular-1', 'vessel-demitasse', 'icon-star']
      .filter((k) => game.textures.exists(k)),
  };
  game.events.on('boot-ready', () => {
    ((window as unknown as Record<string, unknown>).__COFFEE_SHIFT as Record<string, unknown>).booted = true;
  });
}
