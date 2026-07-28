import Phaser from "phaser";

import { MODOS, type Modo } from "../../dominio/partida/Modo";
import type { Resultado } from "../../dominio/partida/Partida";
import { FUENTES, HEX, PALETA } from "../arte/theme";
import { anotarPuntaje, mejorPuntaje } from "../Records";
import { sonido } from "../audio/Sonido";

interface DatosFinal {
  modo: Modo;
  resultado: Resultado;
  puntaje: number;
  segundos: number;
  metrosSalvados: number;
}

const TITULOS: Record<string, string> = {
  perdida: "EL AGUA LLEGO A LA MONEDA",
  ganada: "AGUANTASTE EL TEMPORAL",
};

export class FinalScene extends Phaser.Scene {
  private datos!: DatosFinal;

  constructor() {
    super("Final");
  }

  init(datos: DatosFinal) {
    this.datos = datos;
  }

  create() {
    const ancho = this.scale.width;
    const alto = this.scale.height;
    const perdio = this.datos.resultado === "perdida";
    const record = anotarPuntaje(this.datos.modo, this.datos.puntaje);

    this.pintarFondo(ancho, alto, perdio);
    this.pintarPresidente(ancho / 2, alto * 0.86, perdio);

    this.add
      .text(ancho / 2, alto * 0.14, TITULOS[this.datos.resultado] ?? "SE ACABO", {
        fontSize: "34px",
        color: perdio ? HEX.figura : HEX.linea,
        fontFamily: FUENTES.ui,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(ancho / 2, alto * 0.24, this.resumen(), {
        fontSize: "17px",
        color: HEX.texto,
        fontFamily: FUENTES.ui,
        align: "center",
      })
      .setOrigin(0.5);

    if (record) {
      this.add
        .text(ancho / 2, alto * 0.32, "RECORD NUEVO", {
          fontSize: "18px",
          color: HEX.luz,
          fontFamily: FUENTES.ui,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }

    this.add
      .text(ancho / 2, alto - 40, "R: otra vez  ·  Esc: menu", {
        fontSize: "16px",
        color: HEX.texto,
        fontFamily: FUENTES.ui,
      })
      .setOrigin(0.5)
      .setDepth(80);

    sonido.intensidadDeLluvia(0);
    if (perdio) {
      sonido.derrota();
    } else {
      sonido.victoria();
    }

    this.input.keyboard?.on("keydown-R", () => this.scene.start("Juego", { modo: this.datos.modo }));
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("Menu"));
  }

  private resumen(): string {
    const mejor = mejorPuntaje(this.datos.modo);
    const lineas = [
      `${this.datos.puntaje} puntos   ·   mejor ${mejor}`,
      `${this.datos.segundos.toFixed(0)} segundos aguantando el chaparron`,
    ];
    if (this.datos.resultado === "perdida") {
      lineas.push(`salvaste ${Math.round(this.datos.metrosSalvados)} metros de Alameda`);
    } else if (this.datos.modo === MODOS.temporal) {
      lineas.push("salio el sol y el presidente quedo seco. Nadie te lo agradecio.");
    }
    return lineas.join("\n");
  }

  private pintarFondo(ancho: number, alto: number, perdio: boolean) {
    const fondo = this.add.graphics();
    fondo.fillStyle(PALETA.cielo, 1);
    fondo.fillRect(0, 0, ancho, alto);
    fondo.fillStyle(perdio ? PALETA.cielo_alto : PALETA.piedra_uchile, perdio ? 1 : 0.22);
    fondo.fillRect(0, alto * 0.5, ancho, alto * 0.5);
    fondo.fillStyle(PALETA.vereda, 1);
    fondo.fillRect(0, alto * 0.86, ancho, 8);
  }

  private pintarPresidente(x: number, suelo: number, perdio: boolean) {
    const cuerpo = this.add.image(x, suelo, "presidente_cuerpo").setOrigin(0.5, 1).setScale(4);
    const brazoIzquierdo = this.add
      .image(x - 30, suelo - 106, "presidente_brazo")
      .setOrigin(0.5, 0.08)
      .setScale(4);
    const brazoDerecho = this.add
      .image(x + 30, suelo - 106, "presidente_brazo")
      .setOrigin(0.5, 0.08)
      .setScale(4);

    const rapidez = perdio ? 220 : 620;
    const giro = perdio ? 42 : 14;
    this.tweens.add({
      targets: brazoIzquierdo,
      angle: { from: giro, to: -giro },
      duration: rapidez,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.tweens.add({
      targets: brazoDerecho,
      angle: { from: -giro, to: giro },
      duration: rapidez,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    if (!perdio) {
      return;
    }
    const agua = this.add.graphics().setDepth(20);
    const nivel = { alto: 0 };
    this.tweens.add({
      targets: nivel,
      alto: 96,
      duration: 2600,
      ease: "Sine.Out",
      onUpdate: () => {
        const superficie = suelo - nivel.alto;
        agua.clear();
        agua.fillStyle(PALETA.agua, 0.88);
        agua.fillRect(0, superficie, this.scale.width, nivel.alto + 60);
        agua.fillStyle(PALETA.agua_brillo, 1);
        for (let x = 0; x < this.scale.width; x += 24) {
          const ola = (x / 24) % 2 === 0 ? 0 : 4;
          agua.fillRect(x, superficie - ola, 24, 5);
        }
      },
    });
    cuerpo.setDepth(10);
    brazoIzquierdo.setDepth(30);
    brazoDerecho.setDepth(30);
  }
}
