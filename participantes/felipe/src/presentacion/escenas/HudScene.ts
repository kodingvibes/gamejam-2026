import Phaser from "phaser";

import type { Partida } from "../../dominio/partida/Partida";
import { FUENTES, HEX, PALETA } from "../arte/theme";

const ALTO_BARRA = 10;

export class HudScene extends Phaser.Scene {
  private partida!: Partida;
  private titulo!: Phaser.GameObjects.Text;
  private detalle!: Phaser.GameObjects.Text;
  private barra!: Phaser.GameObjects.Graphics;

  constructor() {
    super("Hud");
  }

  create() {
    this.partida = this.registry.get("partida") as Partida;
    this.barra = this.add.graphics();
    this.titulo = this.add.text(16, 12, "", {
      fontSize: "20px",
      color: HEX.linea,
      fontFamily: FUENTES.ui,
      fontStyle: "bold",
    });
    this.detalle = this.add.text(16, 38, "", {
      fontSize: "14px",
      color: HEX.texto_suave,
      fontFamily: FUENTES.ui,
    });
  }

  override update() {
    if (!this.partida) {
      return;
    }
    const ancho = this.scale.width;
    const avance = Phaser.Math.Clamp(this.partida.avance, 0, 1);
    const agua = Phaser.Math.Clamp(this.partida.inundacion, 0, 1);

    this.titulo.setText(
      `${this.partida.puntaje.total} pts   x${this.partida.puntaje.racha}   ${this.partida.oleada.nombre.toUpperCase()}`,
    );
    this.detalle.setText(
      `${Math.round(this.partida.frente.metrosSalvados)} m hasta La Moneda   ·   agua ${Math.round(agua * 100)}%   ·   ${this.partida.alameda.tapados} rejillas tapadas`,
    );

    const barraX = 16;
    const barraAncho = ancho - 32;
    this.barra.clear();

    this.barra.fillStyle(PALETA.edificio, 0.85);
    this.barra.fillRect(barraX, 66, barraAncho, ALTO_BARRA);
    this.barra.fillStyle(PALETA.piedra_uchile, 1);
    this.barra.fillRect(barraX, 66, barraAncho * avance, ALTO_BARRA);
    this.barra.fillStyle(PALETA.luz, 1);
    this.barra.fillRect(barraX + barraAncho - 6, 60, 6, ALTO_BARRA + 12);

    this.barra.fillStyle(PALETA.edificio, 0.85);
    this.barra.fillRect(barraX, 82, barraAncho, ALTO_BARRA);
    this.barra.fillStyle(agua > 0.75 ? PALETA.figura : PALETA.agua, 1);
    this.barra.fillRect(barraX, 82, barraAncho * agua, ALTO_BARRA);
    this.barra.fillStyle(PALETA.agua_brillo, 1);
    this.barra.fillRect(barraX + barraAncho * agua - 2, 79, 4, ALTO_BARRA + 6);
  }
}
