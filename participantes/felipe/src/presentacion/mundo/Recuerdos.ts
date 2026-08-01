import Phaser from "phaser";

import { Azar } from "../../dominio/agua/Azar";
import type { Partida } from "../../dominio/partida/Partida";
import { PUNTOS_POR_RECUERDO } from "../../dominio/partida/Puntaje";
import { PALETA } from "../arte/theme";
import { textoPixel } from "../arte/TextoPixel";
import { sonido } from "../audio/Sonido";
import { metroAPixel, pixelAMetro, SUELO_Y } from "../Escala";

const CLAVES = [
  "recuerdo_moai",
  "recuerdo_lapislazuli",
  "recuerdo_copihue",
  "recuerdo_cobre",
  "recuerdo_chupalla",
  "recuerdo_trompo",
] as const;

const SEGUNDOS_ENTRE_CAIDAS = 3.2;
const VELOCIDAD_DE_CAIDA = 130;
const Y_DE_APARICION = 104;
const Y_DE_RESOLUCION = SUELO_Y - 26;
const RADIO_DE_ATRAPE = 38;
const SUCIEDAD_POR_PERDIDO = 0.08;
const ESCALA_DE_RECUERDO = 2;
const MARGEN_DE_APARICION = 48;

interface Cayendo {
  readonly sprite: Phaser.GameObjects.Image;
  readonly x: number;
  y: number;
}

export class Recuerdos {
  private readonly cayendo: Cayendo[] = [];
  private readonly azar: Azar;
  private acumulado = 0;
  private atrapados = 0;
  private perdidos = 0;

  get contadores(): { atrapados: number; perdidos: number } {
    return { atrapados: this.atrapados, perdidos: this.perdidos };
  }

  constructor(
    private readonly escena: Phaser.Scene,
    semilla: number,
  ) {
    this.azar = new Azar(semilla);
  }

  actualizar(segundos: number, partida: Partida, scrollX: number, ancho: number) {
    this.acumulado += segundos;
    if (this.acumulado >= SEGUNDOS_ENTRE_CAIDAS) {
      this.acumulado -= SEGUNDOS_ENTRE_CAIDAS;
      this.soltar(scrollX, ancho);
    }
    const xJugador = metroAPixel(partida.jugador.metro);
    for (let indice = this.cayendo.length - 1; indice >= 0; indice -= 1) {
      const recuerdo = this.cayendo[indice];
      recuerdo.y += VELOCIDAD_DE_CAIDA * segundos;
      recuerdo.sprite.setY(recuerdo.y);
      if (recuerdo.y < Y_DE_RESOLUCION) {
        continue;
      }
      if (Math.abs(recuerdo.x - xJugador) <= RADIO_DE_ATRAPE) {
        const ganados = PUNTOS_POR_RECUERDO * partida.puntaje.racha;
        this.atrapados += 1;
        partida.puntaje.anotarRecuerdo();
        sonido.recuerdoAtrapado();
        this.avisar(recuerdo.x, recuerdo.y, `+${ganados}`, PALETA.luz);
      } else {
        this.perdidos += 1;
        partida.alameda.masCercano(pixelAMetro(recuerdo.x)).ensuciar(SUCIEDAD_POR_PERDIDO);
        sonido.recuerdoPerdido();
      }
      recuerdo.sprite.destroy();
      this.cayendo.splice(indice, 1);
    }
  }

  limpiar() {
    for (const recuerdo of this.cayendo) {
      recuerdo.sprite.destroy();
    }
    this.cayendo.length = 0;
  }

  private soltar(scrollX: number, ancho: number) {
    const clave = CLAVES[Math.floor(this.azar.fraccion() * CLAVES.length) % CLAVES.length];
    const x = scrollX + MARGEN_DE_APARICION + this.azar.fraccion() * (ancho - MARGEN_DE_APARICION * 2);
    const sprite = this.escena.add
      .image(x, Y_DE_APARICION, clave)
      .setOrigin(0.5, 0.5)
      .setScale(ESCALA_DE_RECUERDO)
      .setDepth(45);
    this.cayendo.push({ sprite, x, y: Y_DE_APARICION });
  }

  private avisar(x: number, y: number, texto: string, color: number) {
    const aviso = textoPixel(this.escena, x, y - 12, texto, 16, color)
      .setOrigin(0.5, 1)
      .setDepth(90);
    this.escena.tweens.add({
      targets: aviso,
      y: y - 44,
      alpha: 0,
      duration: 620,
      ease: "Cubic.easeOut",
      onComplete: () => aviso.destroy(),
    });
  }
}
