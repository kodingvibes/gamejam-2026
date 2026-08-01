import Phaser from "phaser";

import type { Partida } from "../../dominio/partida/Partida";
import { normalizar } from "../arte/fuente";
import { PALETA } from "../arte/theme";
import { textoPixel } from "../arte/TextoPixel";

const ALTO_BARRA = 10;

export class HudScene extends Phaser.Scene {
  private partida!: Partida;
  private titulo!: Phaser.GameObjects.BitmapText;
  private detalle!: Phaser.GameObjects.BitmapText;
  private barra!: Phaser.GameObjects.Graphics;

  constructor() {
    super("Hud");
  }

  create() {
    this.partida = this.registry.get("partida") as Partida;
    this.barra = this.add.graphics();
    this.titulo = textoPixel(this, 16, 12, "", 16, PALETA.linea);
    this.detalle = textoPixel(this, 16, 42, "", 8, PALETA.texto_suave);
  }

  override update() {
    if (!this.partida) {
      return;
    }
    const ancho = this.scale.width;
    const avance = Phaser.Math.Clamp(this.partida.avance, 0, 1);
    const agua = Phaser.Math.Clamp(this.partida.inundacion, 0, 1);

    this.titulo.setText(
      normalizar(
        `${this.partida.puntaje.total} PTS   X${this.partida.puntaje.racha}   ${this.partida.oleada.nombre}`,
      ),
    );
    this.detalle.setText(
      normalizar(
        `${Math.round(this.partida.frente.metrosSalvados)} M HASTA LA MONEDA   ·   AGUA ${Math.round(agua * 100)}%   ·   ${this.partida.alameda.tapados} REJILLAS TAPADAS`,
      ),
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
