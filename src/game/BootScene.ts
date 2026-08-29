import Phaser from 'phaser';
import { registerTextures } from '../sprites/build';

/** Builds all pixel textures from code data, then hands control to the DOM shell. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    registerTextures(this);
    this.game.events.emit('boot-ready');
  }
}
