import Phaser from "phaser";

import type { Sumidero } from "../../dominio/corredor/Sumidero";
import type { Jugador } from "../../dominio/partida/Jugador";
import { CONO_DE_FOCO, RESPLANDOR } from "../arte/Luces";
import { PALETA } from "../arte/theme";
import { metroAPixel, SUELO_Y } from "../Escala";

const ANCHO_BARRA = 44;
const ALCANCE_DEL_FOCO = 78;
const ALTURA_DEL_FOCO = 26;
const ALTURA_DE_LA_BALIZA = 52;

export class Camioneta {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly foco: Phaser.GameObjects.Image;
  private readonly baliza: Phaser.GameObjects.Image;
  private readonly barra: Phaser.GameObjects.Graphics;
  private readonly marca: Phaser.GameObjects.Graphics;

  constructor(escena: Phaser.Scene) {
    this.foco = escena.add
      .image(0, SUELO_Y, CONO_DE_FOCO)
      .setOrigin(0, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(48);
    this.sprite = escena.add
      .image(0, SUELO_Y, "camioneta_derecha")
      .setOrigin(0.5, 1)
      .setScale(2)
      .setDepth(50);
    this.baliza = escena.add
      .image(0, SUELO_Y, RESPLANDOR)
      .setOrigin(0.5, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(PALETA.luz)
      .setScale(1.2)
      .setDepth(51);
    escena.tweens.add({
      targets: this.baliza,
      alpha: { from: 0.35, to: 0.95 },
      duration: 520,
      yoyo: true,
      repeat: -1,
    });
    this.marca = escena.add.graphics().setDepth(45);
    this.barra = escena.add.graphics().setDepth(60);
  }

  actualizar(jugador: Jugador, objetivo: Sumidero | null) {
    const x = metroAPixel(jugador.metro);
    this.sprite.setPosition(x, SUELO_Y + 6);
    const haciaLaIzquierda = jugador.rumbo === "izquierda";
    this.sprite.setTexture(haciaLaIzquierda ? "camioneta_izquierda" : "camioneta_derecha");

    const morro = haciaLaIzquierda ? x - ALCANCE_DEL_FOCO * 0.36 : x + ALCANCE_DEL_FOCO * 0.36;
    this.foco.setPosition(morro, SUELO_Y - ALTURA_DEL_FOCO);
    this.foco.setFlipX(haciaLaIzquierda);
    this.foco.setOrigin(haciaLaIzquierda ? 1 : 0, 0.5);
    this.baliza.setPosition(
      haciaLaIzquierda ? x - 16 : x + 16,
      SUELO_Y - ALTURA_DE_LA_BALIZA,
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
