import Phaser from 'phaser';
import { Canvas, enable3d } from '@enable3d/phaser-extension';
import { ArenaScene } from './scenes/ArenaScene';
import { LobbyScene } from './scenes/LobbyScene';
import { PreloadScene } from './scenes/PreloadScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  transparent: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  scene: [PreloadScene, LobbyScene, ArenaScene],
  ...Canvas({ parent: 'game-shell', canvasId: 'enable3d-phaser-canvas', antialias: false }),
};

enable3d(() => new Phaser.Game(config)).withPhysics('/lib');
