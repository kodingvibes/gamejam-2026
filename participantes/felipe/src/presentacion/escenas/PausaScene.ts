import Phaser from "phaser";

import { FUENTES, HEX, PALETA } from "../arte/theme";

export class PausaScene extends Phaser.Scene {
  constructor() {
    super("Pausa");
  }

  create() {
    const ancho = this.scale.width;
    const alto = this.scale.height;
    this.add.graphics().fillStyle(PALETA.cielo, 0.82).fillRect(0, 0, ancho, alto);
    this.add
      .text(ancho / 2, alto / 2 - 20, "PAUSA", {
        fontSize: "48px",
        color: HEX.linea,
        fontFamily: FUENTES.ui,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(ancho / 2, alto / 2 + 30, "P para seguir  ·  Esc para volver al menu", {
        fontSize: "16px",
        color: HEX.texto,
        fontFamily: FUENTES.ui,
      })
      .setOrigin(0.5);

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
