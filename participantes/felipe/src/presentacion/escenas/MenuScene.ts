import Phaser from "phaser";

import { FUENTES, HEX, PALETA } from "../arte/theme";
import { sonido } from "../audio/Sonido";
import { MODOS, type Modo } from "../../dominio/partida/Modo";

interface Opcion {
  modo: Modo;
  titulo: string;
  bajada: string;
}

const OPCIONES: Opcion[] = [
  {
    modo: MODOS.temporal,
    titulo: "TEMPORAL",
    bajada: "Tres minutos de tormenta. Aguanta y sale el sol.",
  },
  {
    modo: MODOS.sinFin,
    titulo: "SIN FIN",
    bajada: "El agua nunca para. Juega hasta que llegue a La Moneda.",
  },
];

const INSTRUCCIONES = [
  "Eres el funcionario municipal. Manejas la camioneta con las FLECHAS.",
  "Cuando una rejilla quede marcada en amarillo, manten ESPACIO para destaparla.",
  "Mientras destapas no te mueves, y el agua no te espera.",
  "El agua avanza desde Plaza Italia. Si llega a La Moneda, se acabo.",
  "R reinicia  ·  Esc vuelve al menu",
];

export class MenuScene extends Phaser.Scene {
  private seleccion = 0;
  private fondo!: Phaser.GameObjects.Graphics;
  private capa!: Phaser.GameObjects.Container;

  constructor() {
    super("Menu");
  }

  create() {
    this.fondo = this.add.graphics();
    this.capa = this.add.container(0, 0);
    this.input.keyboard?.on("keydown", this.tecla, this);
    this.scale.on("resize", this.dibujar, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.dibujar, this));
    this.dibujar();
  }

  private tecla(evento: KeyboardEvent) {
    sonido.encender();
    if (evento.code === "ArrowUp" || evento.code === "KeyW") {
      this.seleccion = (this.seleccion + OPCIONES.length - 1) % OPCIONES.length;
      this.dibujar();
      return;
    }
    if (evento.code === "ArrowDown" || evento.code === "KeyS") {
      this.seleccion = (this.seleccion + 1) % OPCIONES.length;
      this.dibujar();
      return;
    }
    if (evento.code === "Enter" || evento.code === "Space") {
      this.scene.start("Juego", { modo: OPCIONES[this.seleccion].modo });
    }
  }

  private dibujar() {
    const ancho = this.scale.width;
    const alto = this.scale.height;

    this.fondo.clear();
    this.fondo.fillStyle(PALETA.cielo, 1);
    this.fondo.fillRect(0, 0, ancho, alto);
    this.fondo.fillStyle(PALETA.cielo_alto, 1);
    this.fondo.fillRect(0, alto * 0.6, ancho, alto * 0.4);
    this.fondo.fillStyle(PALETA.vereda, 1);
    this.fondo.fillRect(0, alto * 0.78, ancho, alto * 0.05);
    this.fondo.fillStyle(PALETA.calzada, 1);
    this.fondo.fillRect(0, alto * 0.83, ancho, alto * 0.17);
    this.fondo.fillStyle(PALETA.linea, 1);
    for (let x = 20; x < ancho; x += 90) {
      this.fondo.fillRect(x, alto * 0.93, 44, 4);
    }
    this.fondo.fillStyle(PALETA.agua, 1);
    this.fondo.fillRect(0, alto - 10, ancho * 0.3, 10);
    this.fondo.fillStyle(PALETA.agua_brillo, 1);
    this.fondo.fillRect(0, alto - 10, ancho * 0.3, 3);

    this.capa.removeAll(true);
    const centro = ancho / 2;

    this.capa.add(
      this.add
        .text(centro, alto * 0.16, "TAPA'O", {
          fontSize: "72px",
          color: HEX.linea,
          fontFamily: FUENTES.ui,
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );

    this.capa.add(
      this.add
        .text(centro, alto * 0.27, "El temporal baja por la Alameda y tú tienes que destapar los sumideros", {
          fontSize: "17px",
          color: HEX.texto_suave,
          fontFamily: FUENTES.ui,
        })
        .setOrigin(0.5),
    );

    OPCIONES.forEach((opcion, indice) => {
      const y = alto * 0.36 + indice * 74;
      const activa = indice === this.seleccion;
      this.capa.add(
        this.add
          .text(centro, y, `${activa ? "> " : "  "}${opcion.titulo}`, {
            fontSize: "34px",
            color: activa ? HEX.figura : HEX.texto,
            fontFamily: FUENTES.ui,
            fontStyle: "bold",
          })
          .setOrigin(0.5),
      );
      this.capa.add(
        this.add
          .text(centro, y + 30, opcion.bajada, {
            fontSize: "15px",
            color: activa ? HEX.texto : HEX.texto_suave,
            fontFamily: FUENTES.ui,
          })
          .setOrigin(0.5),
      );
    });

    this.dibujarInstrucciones(centro, alto);

    this.capa.add(
      this.add.text(centro, alto - 34, "Flechas: elegir  ·  Enter: jugar", {
        fontSize: "14px",
        color: HEX.texto_suave,
        fontFamily: FUENTES.ui,
      }).setOrigin(0.5),
    );
  }

  private dibujarInstrucciones(centro: number, alto: number) {
    const y = alto * 0.62;
    this.capa.add(
      this.add
        .text(centro, y, "COMO SE JUEGA", {
          fontSize: "16px",
          color: HEX.linea,
          fontFamily: FUENTES.ui,
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );
    INSTRUCCIONES.forEach((linea, indice) => {
      this.capa.add(
        this.add
          .text(centro, y + 26 + indice * 20, linea, {
            fontSize: "15px",
            color: HEX.texto,
            fontFamily: FUENTES.ui,
          })
          .setOrigin(0.5),
      );
    });
  }
}
