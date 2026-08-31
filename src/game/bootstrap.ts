import Phaser from 'phaser';
import { BootScene } from './BootScene';
import { GameScene } from './GameScene';
import { GAME_HEIGHT, GAME_WIDTH } from './layout';

/**
 * Creating the Phaser game is isolated here so main.ts can import it dynamically. The DOM
 * shell — menu, level select, settings — needs none of Phaser's 1.4 MB, and used to wait
 * for it anyway because the menu was shown on BootScene's 'boot-ready'.
 */
export function createGame(): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    pixelArt: true,
    parent: 'game-canvas',
    backgroundColor: '#fdf6ec',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    scene: [BootScene, GameScene],
  });
}
