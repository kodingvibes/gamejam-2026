import Phaser from "phaser";

import type { Sumidero } from "../../dominio/corredor/Sumidero";
import type { Jugador } from "../../dominio/partida/Jugador";
import { PALETA } from "../arte/theme";
import { metroAPixel, SUELO_Y } from "../Escala";

const ANCHO_BARRA = 44;

export class Camioneta {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly barra: Phaser.GameObjects.Graphics;
  private readonly marca: Phaser.GameObjects.Graphics;

  constructor(escena: Phaser.Scene) {
    this.sprite = escena.add
      .image(0, SUELO_Y, "camioneta_derecha")
      .setOrigin(0.5, 1)
      .setScale(2)
      .setDepth(50);
    this.marca = escena.add.graphics().setDepth(45);
    this.barra = escena.add.graphics().setDepth(60);
  }

  actualizar(jugador: Jugador, objetivo: Sumidero | null) {
    const x = metroAPixel(jugador.metro);
    this.sprite.setPosition(x, SUELO_Y + 6);
    this.sprite.setTexture(
      jugador.rumbo === "izquierda" ? "camioneta_izquierda" : "camioneta_derecha",
    );

    this.marca.clear();
    if (objetivo) {
      const marcaX = metroAPixel(objetivo.metro);
      this.marca.lineStyle(2, PALETA.luz, 0.9);
      this.marca.strokeRect(marcaX - 20, SUELO_Y - 10, 40, 20);
    }

    this.barra.clear();
    if (!jugador.estaTrabajando || !objetivo) {
      return;
    }
    const avance = 1 - objetivo.obstruccion;
    const barraX = x - ANCHO_BARRA / 2;
    const barraY = SUELO_Y - 74;
    this.barra.fillStyle(PALETA.edificio, 0.9);
    this.barra.fillRect(barraX - 2, barraY - 2, ANCHO_BARRA + 4, 12);
    this.barra.fillStyle(PALETA.agua_brillo, 1);
    this.barra.fillRect(barraX, barraY, ANCHO_BARRA * avance, 8);
  }
}
