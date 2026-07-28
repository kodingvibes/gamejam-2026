import Phaser from "phaser";

import { crearTexturas } from "../arte/Texturas";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    crearTexturas(this);
    this.scene.start("Menu");
  }
}
