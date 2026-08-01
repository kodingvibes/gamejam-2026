import Phaser from "phaser";

import { MODOS, type Modo } from "../../dominio/partida/Modo";
import type { Resultado } from "../../dominio/partida/Partida";
import { PALETA } from "../arte/theme";
import { textoPixel } from "../arte/TextoPixel";
import {
  anotarPuntaje,
  calificaParaElTop,
  type EntradaDePuntaje,
  mejorPuntaje,
  tablaDePuntajes,
} from "../Records";
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

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class FinalScene extends Phaser.Scene {
  private datos!: DatosFinal;
  private iniciales: string[] = ["A", "A", "A"];
  private indiceLetra = 0;
  private grupoEntrada?: Phaser.GameObjects.Container;
  private manejarTeclaEntrada?: (evento: KeyboardEvent) => void;

  constructor() {
    super("Final");
  }

  init(datos: DatosFinal) {
    this.datos = datos;
    this.iniciales = ["A", "A", "A"];
    this.indiceLetra = 0;
  }

  create() {
    const ancho = this.scale.width;
    const alto = this.scale.height;
    const perdio = this.datos.resultado === "perdida";

    this.pintarFondo(ancho, alto, perdio);
    this.pintarPresidente(ancho / 2, alto * 0.86, perdio);

    textoPixel(
      this,
      ancho / 2,
      alto * 0.14,
      TITULOS[this.datos.resultado] ?? "SE ACABO",
      24,
      perdio ? PALETA.figura : PALETA.linea,
    ).setOrigin(0.5);

    textoPixel(this, ancho / 2, alto * 0.24, this.resumen(), 8, PALETA.texto)
      .setOrigin(0.5)
      .setCenterAlign();

    sonido.intensidadDeLluvia(0);
    if (perdio) {
      sonido.derrota();
    } else {
      sonido.victoria();
    }

    if (calificaParaElTop(this.datos.modo, this.datos.puntaje)) {
      this.iniciarIngresoDeIniciales(ancho, alto);
    } else {
      this.mostrarTabla(ancho, alto);
    }
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

  private iniciarIngresoDeIniciales(ancho: number, alto: number) {
    const y = alto * 0.36;
    const grupo = this.add.container(0, 0);
    this.grupoEntrada = grupo;

    grupo.add(
      textoPixel(
        this,
        ancho / 2,
        y - 34,
        "RECORD NUEVO - INGRESA TUS INICIALES",
        8,
        PALETA.luz,
      ).setOrigin(0.5),
    );

    const textosLetras = this.iniciales.map((letra, indice) => {
      const texto = textoPixel(
        this,
        ancho / 2 + (indice - 1) * 50,
        y,
        letra,
        32,
        indice === this.indiceLetra ? PALETA.figura : PALETA.texto,
      ).setOrigin(0.5);
      grupo.add(texto);
      return texto;
    });

    const cursor = textoPixel(
      this,
      ancho / 2 + (this.indiceLetra - 1) * 50,
      y + 30,
      "-",
      24,
      PALETA.figura,
    ).setOrigin(0.5);
    grupo.add(cursor);
    this.tweens.add({ targets: cursor, alpha: 0, duration: 350, yoyo: true, repeat: -1 });

    grupo.add(
      textoPixel(
        this,
        ancho / 2,
        y + 58,
        "ARRIBA/ABAJO: LETRA   ·   IZQ/DER: POSICION   ·   ESPACIO: CONFIRMAR",
        8,
        PALETA.texto_suave,
      ).setOrigin(0.5),
    );

    const redibujar = () => {
      textosLetras.forEach((texto, indice) => {
        texto.setText(this.iniciales[indice]);
        texto.setTint(indice === this.indiceLetra ? PALETA.figura : PALETA.texto);
      });
      cursor.setX(ancho / 2 + (this.indiceLetra - 1) * 50);
    };

    this.manejarTeclaEntrada = (evento: KeyboardEvent) => {
      if (evento.code === "ArrowUp" || evento.code === "ArrowDown") {
        const actual = ALFABETO.indexOf(this.iniciales[this.indiceLetra]);
        const paso = evento.code === "ArrowUp" ? 1 : -1;
        this.iniciales[this.indiceLetra] = ALFABETO[(actual + paso + ALFABETO.length) % ALFABETO.length];
        redibujar();
        return;
      }
      if (evento.code === "ArrowLeft") {
        this.indiceLetra = Math.max(0, this.indiceLetra - 1);
        redibujar();
        return;
      }
      if (evento.code === "ArrowRight") {
        this.indiceLetra = Math.min(2, this.indiceLetra + 1);
        redibujar();
        return;
      }
      if (evento.code === "Enter" || evento.code === "Space") {
        this.confirmarIniciales(ancho, alto);
      }
    };
    this.input.keyboard?.on("keydown", this.manejarTeclaEntrada);
  }

  private confirmarIniciales(ancho: number, alto: number) {
    if (this.manejarTeclaEntrada) {
      this.input.keyboard?.off("keydown", this.manejarTeclaEntrada);
      this.manejarTeclaEntrada = undefined;
    }
    this.grupoEntrada?.destroy();
    this.grupoEntrada = undefined;

    const tabla = anotarPuntaje(this.datos.modo, this.iniciales.join(""), this.datos.puntaje);
    this.mostrarTabla(ancho, alto, tabla);
  }

  private mostrarTabla(ancho: number, alto: number, tablaRecienAnotada?: EntradaDePuntaje[]) {
    const tabla = tablaRecienAnotada ?? tablaDePuntajes(this.datos.modo);
    const inicialesNuevas = tablaRecienAnotada ? this.iniciales.join("") : null;
    const y = alto * 0.34;

    textoPixel(this, ancho / 2, y, "MEJORES PUNTAJES", 16, PALETA.linea).setOrigin(0.5);

    tabla.forEach((entrada, indice) => {
      const esNueva = inicialesNuevas === entrada.iniciales && entrada.puntaje === this.datos.puntaje;
      textoPixel(
        this,
        ancho / 2,
        y + 26 + indice * 14,
        `${indice + 1}.  ${entrada.iniciales}   ${entrada.puntaje}`,
        8,
        esNueva ? PALETA.luz : PALETA.texto,
      ).setOrigin(0.5);
    });

    textoPixel(this, ancho / 2, alto - 40, "R: OTRA VEZ  ·  ESC: MENU", 8, PALETA.texto)
      .setOrigin(0.5)
      .setDepth(80);

    this.input.keyboard?.on("keydown-R", () => this.scene.start("Juego", { modo: this.datos.modo }));
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("Menu"));
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
