import Phaser from "phaser";

import { crearLuces } from "../arte/Luces";
import { crearFuentePixel } from "../arte/TextoPixel";
import { crearTexturas } from "../arte/Texturas";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    crearTexturas(this);
    crearFuentePixel(this);
    crearLuces(this);
    this.scene.start("Menu");
  }
}
