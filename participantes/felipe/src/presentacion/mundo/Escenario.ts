import Phaser from "phaser";

import { Azar } from "../../dominio/agua/Azar";
import type { Alameda } from "../../dominio/corredor/Alameda";
import type { Sumidero } from "../../dominio/corredor/Sumidero";
import { PALETA } from "../arte/theme";
import { ALTO_VEREDA, metroAPixel, SUELO_Y } from "../Escala";

const CLAVES_DE_HITO: Record<string, string> = {
  "Plaza Baquedano": "hito_baquedano",
  GAM: "hito_gam",
  "Casa Central UC": "hito_uc",
  "Cerro Santa Lucia": "hito_santa_lucia",
  "Biblioteca Nacional": "hito_biblioteca",
  "Iglesia San Francisco": "hito_san_francisco",
  "Casa Central U. de Chile": "hito_uchile",
  "La Moneda": "hito_moneda",
};

const CLAVES_DE_SUMIDERO = {
  limpio: "sumidero_limpio",
  medio: "sumidero_medio",
  tapado: "sumidero_tapado",
} as const;

export class Escenario {
  readonly anchoMundo: number;
  private readonly rejillas: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly escena: Phaser.Scene,
    private readonly alameda: Alameda,
  ) {
    this.anchoMundo = metroAPixel(alameda.largoMetros) + 240;
    this.pintarCielo();
    this.pintarFondo();
    this.pintarCalle();
    this.pintarHitos();
    this.pintarRejillas();
  }

  actualizarRejillas() {
    this.alameda.sumideros.forEach((sumidero, indice) => {
      const rejilla = this.rejillas[indice];
      if (rejilla) {
        rejilla.setTexture(CLAVES_DE_SUMIDERO[sumidero.estado]);
      }
    });
  }

  columnaDe(sumidero: Sumidero, celda: number): number {
    return Math.floor(metroAPixel(sumidero.metro) / celda);
  }

  private pintarCielo() {
    const cielo = this.escena.add.graphics().setDepth(-30).setScrollFactor(0);
    cielo.fillStyle(PALETA.cielo, 1);
    cielo.fillRect(0, 0, 2000, 1200);
    cielo.fillStyle(PALETA.cielo_alto, 1);
    cielo.fillRect(0, 200, 2000, 1000);
  }

  private pintarFondo() {
    const fondo = this.escena.add.graphics().setDepth(-20);
    const azar = new Azar(13);
    let x = -40;
    while (x < this.anchoMundo + 40) {
      const ancho = azar.entre(40, 110);
      const alto = azar.entre(150, 330);
      const cima = SUELO_Y - ALTO_VEREDA - alto;
      fondo.fillStyle(PALETA.edificio, 1);
      fondo.fillRect(x, cima, ancho, alto);
      fondo.fillStyle(PALETA.edificio_borde, 1);
      fondo.fillRect(x, cima, ancho, 4);
      fondo.fillStyle(PALETA.ventana, 1);
      for (let fila = cima + 16; fila < SUELO_Y - ALTO_VEREDA - 20; fila += 26) {
        for (let columna = x + 10; columna < x + ancho - 12; columna += 22) {
          if (azar.entre(0, 4) === 0) {
            fondo.fillRect(columna, fila, 5, 10);
          }
        }
      }
      x += ancho;
    }
  }

  private pintarCalle() {
    this.escena.add
      .tileSprite(0, SUELO_Y - ALTO_VEREDA, this.anchoMundo, ALTO_VEREDA, "vereda")
      .setOrigin(0, 0)
      .setDepth(-5);
    this.escena.add
      .tileSprite(0, SUELO_Y, this.anchoMundo, 100, "calzada")
      .setOrigin(0, 0)
      .setDepth(-5);
    this.escena.add
      .tileSprite(0, SUELO_Y + 44, this.anchoMundo, 32, "linea")
      .setOrigin(0, 0)
      .setDepth(-4);
  }

  private pintarHitos() {
    for (const hito of this.alameda.hitos) {
      const clave = CLAVES_DE_HITO[hito.nombre];
      if (!clave || !this.escena.textures.exists(clave)) {
        continue;
      }
      this.escena.add
        .image(metroAPixel(hito.metro), SUELO_Y - ALTO_VEREDA, clave)
        .setOrigin(0.5, 1)
        .setDepth(-10);
    }
  }

  private pintarRejillas() {
    for (const sumidero of this.alameda.sumideros) {
      this.rejillas.push(
        this.escena.add
          .image(metroAPixel(sumidero.metro), SUELO_Y - 6, CLAVES_DE_SUMIDERO[sumidero.estado])
          .setOrigin(0.5, 0)
          .setDepth(30),
      );
    }
  }
}
