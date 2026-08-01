import Phaser from "phaser";

import { PALETA } from "../arte/theme";
import { textoPixel } from "../arte/TextoPixel";

export class PausaScene extends Phaser.Scene {
  constructor() {
    super("Pausa");
  }

  create() {
    const ancho = this.scale.width;
    const alto = this.scale.height;
    this.add.graphics().fillStyle(PALETA.cielo, 0.82).fillRect(0, 0, ancho, alto);
    textoPixel(this, ancho / 2, alto / 2 - 30, "PAUSA", 32, PALETA.linea).setOrigin(0.5);
    textoPixel(
      this,
      ancho / 2,
      alto / 2 + 30,
      "P PARA SEGUIR  ·  ESC PARA VOLVER AL MENU",
      8,
      PALETA.texto,
    ).setOrigin(0.5);

    this.input.keyboard?.on("keydown-P", () => {
      this.scene.stop();
      this.scene.resume("Juego");
    });
    this.input.keyboard?.on("keydown-ESC", () => {
      this.scene.stop();
      this.scene.stop("Juego");
      this.scene.stop("Hud");
      this.scene.start("Menu");
    });
  }
}
