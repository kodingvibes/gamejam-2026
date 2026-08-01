import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.load.image('lobby-key-art', '/assets/lobby-key-art.png');
  }

  create(): void {
    this.scene.start('LobbyScene');
  }
}
