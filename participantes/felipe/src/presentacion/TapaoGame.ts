import Phaser from "phaser";

import { HEX } from "./arte/theme";
import { JUEGO } from "../config";
import { BootScene } from "./escenas/BootScene";
import { FinalScene } from "./escenas/FinalScene";
import { HudScene } from "./escenas/HudScene";
import { JuegoScene } from "./escenas/JuegoScene";
import { MenuScene } from "./escenas/MenuScene";
import { PausaScene } from "./escenas/PausaScene";

export type PhaserGameFactory = (parent: HTMLElement) => Phaser.Game;

export const createTapaoGame: PhaserGameFactory = (parent) =>
  new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: JUEGO.ancho,
    height: JUEGO.alto,
    backgroundColor: HEX.cielo,
    pixelArt: true,
    scene: [BootScene, MenuScene, JuegoScene, HudScene, PausaScene, FinalScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
