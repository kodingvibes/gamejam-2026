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
      // FIT (not RESIZE): scales the fixed 960x540 composition up to fill
      // the window — e.g. exactly 2x on a 1920x1080 screen, since both are
      // 16:9 — instead of exposing more raw world space at the same pixel
      // size. RESIZE was why the skyline read as sparse/empty on tall
      // viewports (see the building-scale fix earlier this session).
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: JUEGO.ancho,
      height: JUEGO.alto,
    },
  });
