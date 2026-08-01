import Phaser from "phaser";

import { Azar } from "../../dominio/agua/Azar";
import { METROS_ENTRE_SUMIDEROS } from "../../dominio/corredor/Alameda";
import { MODOS, type Modo } from "../../dominio/partida/Modo";
import { Partida } from "../../dominio/partida/Partida";
import {
  gotasDeLluvia,
  RADIO_DE_PELIGRO_COLUMNAS,
  RADIO_DE_TRAGO,
  RADIO_DE_TRAGO_FILAS,
  tragoDeRejilla,
} from "../agua/Balance";
import { VentanaDeAgua } from "../agua/VentanaDeAgua";
import { PALETA } from "../arte/theme";
import { textoPixel } from "../arte/TextoPixel";
import { sonido } from "../audio/Sonido";
import { CELDA_PX, metroAPixel, pixelAMetro } from "../Escala";
import { Camioneta } from "../mundo/Camioneta";
import { Escenario } from "../mundo/Escenario";
import { Recuerdos } from "../mundo/Recuerdos";

interface DatosJuego {
  modo?: Modo;
}

const PASO_DE_SIMULACION = 1 / 30;
const MARGEN_DEL_JUGADOR = 90;

export class JuegoScene extends Phaser.Scene {
  private modo: Modo = MODOS.temporal;
  private partida!: Partida;
  private escenario!: Escenario;
  private ventana!: VentanaDeAgua;
  private camioneta!: Camioneta;
  private recuerdos!: Recuerdos;
  private azar = new Azar(97);
  private acumulado = 0;
  private teclas!: Phaser.Types.Input.Keyboard.CursorKeys;
  private espacio!: Phaser.Input.Keyboard.Key;
  private estabaEnAgua = false;

  constructor() {
    super("Juego");
  }

  init(datos: DatosJuego) {
    this.modo = datos.modo ?? MODOS.temporal;
  }

  create() {
    this.partida = Partida.comenzar(this.modo, Date.now() >>> 0);
    this.escenario = new Escenario(this, this.partida.alameda);
    this.ventana = new VentanaDeAgua(this);
    this.ventana.dondeEstanLasRejillas(
      this.partida.alameda.sumideros.map((sumidero) => this.escenario.columnaDe(sumidero, CELDA_PX)),
      Math.round(metroAPixel(METROS_ENTRE_SUMIDEROS) / CELDA_PX),
    );
    this.ventana.sembrarCharcos(
      this.partida.alameda.sumideros
        .filter((sumidero) => sumidero.estado !== "limpio")
        .map((sumidero) => this.escenario.columnaDe(sumidero, CELDA_PX)),
    );
    this.camioneta = new Camioneta(this);
    this.recuerdos = new Recuerdos(this, Date.now() >>> 0);
    this.azar = new Azar(97);
    this.acumulado = 0;

    this.cameras.main.setBounds(0, 0, this.escenario.anchoMundo, this.scale.height);
    this.cameras.main.setScroll(0, 0);
    this.teclas = this.input.keyboard!.createCursorKeys();
    this.espacio = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("Menu"));
    this.input.keyboard?.on("keydown-R", () => this.scene.restart({ modo: this.modo }));

    this.registry.set("partida", this.partida);
    this.scene.launch("Hud");
    sonido.encender();
    this.input.keyboard?.on("keydown-P", () => {
      this.scene.pause();
      this.scene.launch("Pausa");
    });

    textoPixel(
      this,
      16,
      this.scale.height - 62,
      "FLECHAS: MANEJAR  ·  ESPACIO: DESTAPAR  ·  R: REINICIAR  ·  ESC: MENU",
      8,
      PALETA.texto_suave,
    )
      .setScrollFactor(0)
      .setDepth(100);
  }

  override update(_tiempo: number, delta: number) {
    const segundos = Math.min(delta / 1000, 0.1);
    const columnaJugador = Math.floor(metroAPixel(this.partida.jugador.metro) / CELDA_PX);
    this.partida.avanzar(
      segundos,
      this.ventana.nivelDeInundacion(columnaJugador, RADIO_DE_PELIGRO_COLUMNAS),
    );
    this.mandarAlJugador(segundos);
    this.moverCamara();
    this.encerrarAlJugador();

    this.acumulado += segundos;
    while (this.acumulado >= PASO_DE_SIMULACION) {
      this.acumulado -= PASO_DE_SIMULACION;
      this.simularAgua();
    }

    this.ventana.seguirCamara(this.cameras.main.scrollX);
    this.ventana.pintar();
    this.escenario.actualizarRejillas();
    this.recuerdos.actualizar(segundos, this.partida, this.cameras.main.scrollX, this.scale.width);
    this.camioneta.actualizar(this.partida.jugador, this.partida.sumideroAlAlcance());
    sonido.intensidadDeLluvia(this.partida.caudal);
    sonido.talVezGranizo(this.partida.oleada.granizoPorSegundo, segundos);

    if (this.partida.terminada) {
      this.terminar();
    }
  }

  private terminar() {
    this.scene.stop("Hud");
    this.scene.start("Final", {
      modo: this.modo,
      resultado: this.partida.resultado,
      puntaje: this.partida.puntaje.total,
      segundos: this.partida.tiempoSegundos,
      metrosSalvados: this.partida.frente.metrosSalvados,
    });
  }

  private mandarAlJugador(segundos: number) {
    const objetivo = this.partida.sumideroAlAlcance();
    if (this.espacio.isDown && objetivo) {
      this.partida.jugador.trabajar();
      sonido.actualizarMotor(false, false);
      sonido.actualizarSuccion(true);
      if (this.partida.destapar(objetivo, segundos)) {
        sonido.rejillaDestapada();
      }
      return;
    }
    sonido.actualizarSuccion(false);
    const direccion = (this.teclas.left.isDown ? -1 : 0) + (this.teclas.right.isDown ? 1 : 0);
    const columna = Math.floor(metroAPixel(this.partida.jugador.metro) / CELDA_PX);
    const enAgua = this.ventana.hayAguaEn(columna);
    if (enAgua && !this.estabaEnAgua && direccion !== 0) {
      sonido.chapoteo();
    }
    this.estabaEnAgua = enAgua;
    sonido.actualizarMotor(direccion !== 0, enAgua);
    this.partida.jugador.mover(direccion, segundos, enAgua);
  }

  private moverCamara() {
    const tope = Math.max(0, this.escenario.anchoMundo - this.scale.width);
    const deseada = Phaser.Math.Clamp(metroAPixel(this.partida.frente.metro), 0, tope);
    this.cameras.main.setScroll(deseada, 0);
  }

  private encerrarAlJugador() {
    const izquierda = pixelAMetro(this.cameras.main.scrollX + MARGEN_DEL_JUGADOR);
    const derecha = pixelAMetro(this.cameras.main.scrollX + this.scale.width - MARGEN_DEL_JUGADOR);
    this.partida.jugador.encerrarEntre(izquierda, derecha);
  }

  private simularAgua() {
    const izquierda = Math.floor(this.cameras.main.scrollX / CELDA_PX);
    const derecha = izquierda + Math.ceil(this.scale.width / CELDA_PX);
    this.ventana.llover(
      gotasDeLluvia(this.partida.caudal, derecha - izquierda),
      izquierda,
      derecha,
      this.azar,
    );

    for (const sumidero of this.partida.alameda.sumideros) {
      const columna = this.escenario.columnaDe(sumidero, CELDA_PX);
      if (columna < izquierda - 20 || columna > derecha + 20) {
        continue;
      }
      const capacidad = tragoDeRejilla(sumidero.drenaje);
      if (capacidad > 0) {
        this.ventana.drenarEnColumna(columna, RADIO_DE_TRAGO, RADIO_DE_TRAGO_FILAS, capacidad);
      }
    }

    this.ventana.simular();
  }

}
