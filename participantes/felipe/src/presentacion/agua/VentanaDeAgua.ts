import Phaser from "phaser";

import { DIFICULTAD } from "../../config";
import { Azar } from "../../dominio/agua/Azar";
import { CELDA, Granos } from "../../dominio/agua/Granos";
import { PALETA } from "../arte/theme";
import { CELDA_PX, FILAS_DE_AGUA, MARGEN_DE_AGUA, SUELO_Y } from "../Escala";
import { alturaDelPiso, CAIDA_HACIA_LA_REJILLA } from "./PerfilDeCalle";

const CLAVE = "ventana-de-agua";
const FRACCION_ANEGADA = 0.3;
const FILAS_HASTA_AHOGARSE = Math.min(88, Math.round(56 / DIFICULTAD));
const COLUMNAS_MAXIMAS = 800;
const FILAS_DE_CHARCO_INICIAL = 1;
const RADIO_DE_CHARCO_SUCIO = 11;
const FILAS_DE_CHARCO_SUCIO = 10;
const PASOS_PARA_ASENTAR = 20;

function componentes(color: number): [number, number, number] {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
}

export class VentanaDeAgua {
  readonly columnas: number;
  readonly granos: Granos;
  private readonly textura: Phaser.Textures.CanvasTexture;
  private readonly lienzo: Phaser.GameObjects.Image;
  private readonly imagen: ImageData;
  private readonly agua = componentes(PALETA.agua);
  private readonly brillo = componentes(PALETA.agua_brillo);
  private columnaOrigen = 0;
  private rejillas: readonly number[] = [];
  private medioTramo = 25;

  constructor(escena: Phaser.Scene) {
    this.columnas = Math.min(
      COLUMNAS_MAXIMAS,
      Math.ceil(escena.scale.width / CELDA_PX) + MARGEN_DE_AGUA * 2,
    );
    this.granos = new Granos(this.columnas, FILAS_DE_AGUA, new Azar(20260727));
    if (escena.textures.exists(CLAVE)) {
      escena.textures.remove(CLAVE);
    }
    this.textura = escena.textures.createCanvas(
      CLAVE,
      this.columnas,
      FILAS_DE_AGUA,
    ) as Phaser.Textures.CanvasTexture;
    this.imagen = this.textura.getContext().createImageData(this.columnas, FILAS_DE_AGUA);
    this.lienzo = escena.add.image(0, 0, CLAVE).setOrigin(0, 0).setScale(CELDA_PX).setDepth(40);
    this.ponerPiso();
  }

  get alturaTope(): number {
    return SUELO_Y - (FILAS_DE_AGUA - 1) * CELDA_PX;
  }

  dondeEstanLasRejillas(columnasDelMundo: readonly number[], separacion: number) {
    this.rejillas = columnasDelMundo;
    this.medioTramo = Math.max(1, Math.floor(separacion / 2));
    this.ponerPiso();
  }

  seguirCamara(scrollX: number) {
    const deseada = Math.floor(scrollX / CELDA_PX) - MARGEN_DE_AGUA;
    const diferencia = deseada - this.columnaOrigen;
    if (diferencia !== 0) {
      this.granos.desplazar(diferencia);
      this.columnaOrigen = deseada;
      this.ponerPiso();
    }
    this.lienzo.setPosition(this.columnaOrigen * CELDA_PX, this.alturaTope);
  }

  llover(cantidad: number, desdeColumna: number, hastaColumna: number, azar: Azar) {
    const desde = Math.max(0, desdeColumna - this.columnaOrigen);
    const hasta = Math.min(this.columnas - 1, hastaColumna - this.columnaOrigen);
    if (hasta < desde || cantidad <= 0) {
      return;
    }
    // Reparto estratificado: cada gota cae dentro de su propia franja del
    // ancho visible, en vez de puro azar independiente. Puro azar con pocas
    // gotas por tick (como en llovizna) deja parches visibles sin lluvia por
    // pura casualidad; estratificar los reparte parejo sin que se vea
    // artificialmente uniforme, porque adentro de cada franja sigue siendo
    // al azar.
    const ancho = hasta - desde + 1;
    const franja = ancho / cantidad;
    for (let gota = 0; gota < cantidad; gota += 1) {
      const inicioFranja = desde + gota * franja;
      const columna = Math.min(hasta, Math.floor(inicioFranja + azar.fraccion() * franja));
      this.granos.verter(columna, 0);
    }
  }

  drenarEnColumna(columna: number, radio: number, radioFilas: number, maximo: number): number {
    const local = columna - this.columnaOrigen;
    if (local < 0 || local >= this.columnas) {
      return 0;
    }
    return this.granos.drenar(local, FILAS_DE_AGUA - 2, radio, maximo, radioFilas);
  }

  nivelDeInundacion(columnaMundoJugador?: number, radioColumnas?: number): number {
    let desde = 0;
    let hasta = this.columnas;
    if (columnaMundoJugador !== undefined && radioColumnas !== undefined) {
      const local = columnaMundoJugador - this.columnaOrigen;
      desde = Math.max(0, local - radioColumnas);
      hasta = Math.min(this.columnas, local + radioColumnas);
    }
    const minimo = Math.floor((hasta - desde) * FRACCION_ANEGADA);
    for (let fila = 0; fila < FILAS_DE_AGUA; fila += 1) {
      let mojadas = 0;
      for (let columna = desde; columna < hasta; columna += 1) {
        if (this.granos.celdaEn(columna, fila) === CELDA.agua) {
          mojadas += 1;
          if (mojadas >= minimo) {
            return Math.min(1, (FILAS_DE_AGUA - 1 - fila) / FILAS_HASTA_AHOGARSE);
          }
        }
      }
    }
    return 0;
  }

  hayAguaEn(columnaMundo: number): boolean {
    const local = columnaMundo - this.columnaOrigen;
    if (local < 0 || local >= this.columnas) {
      return false;
    }
    for (let fila = FILAS_DE_AGUA - 4; fila < FILAS_DE_AGUA - 1; fila += 1) {
      if (this.granos.celdaEn(local, fila) === CELDA.agua) {
        return true;
      }
    }
    return false;
  }

  sembrarCharcos(columnasSucias: readonly number[] = []) {
    const desde = FILAS_DE_AGUA - 1 - FILAS_DE_CHARCO_INICIAL;
    for (let fila = desde; fila < FILAS_DE_AGUA; fila += 1) {
      for (let columna = 0; columna < this.columnas; columna += 1) {
        if (this.granos.celdaEn(columna, fila) === CELDA.aire) {
          this.granos.verter(columna, fila);
        }
      }
    }
    const hondo = FILAS_DE_AGUA - 1 - FILAS_DE_CHARCO_SUCIO;
    for (const columnaMundo of columnasSucias) {
      const centro = columnaMundo - this.columnaOrigen;
      for (let fila = hondo; fila < FILAS_DE_AGUA; fila += 1) {
        for (let paso = -RADIO_DE_CHARCO_SUCIO; paso <= RADIO_DE_CHARCO_SUCIO; paso += 1) {
          const columna = centro + paso;
          if (columna < 0 || columna >= this.columnas) {
            continue;
          }
          if (this.granos.celdaEn(columna, fila) === CELDA.aire) {
            this.granos.verter(columna, fila);
          }
        }
      }
    }
    for (let paso = 0; paso < PASOS_PARA_ASENTAR; paso += 1) {
      this.granos.paso();
    }
  }

  simular() {
    this.granos.paso();
  }

  pintar() {
    const datos = this.imagen.data;
    for (let fila = 0; fila < FILAS_DE_AGUA; fila += 1) {
      for (let columna = 0; columna < this.columnas; columna += 1) {
        const destino = (fila * this.columnas + columna) * 4;
        if (this.granos.celdaEn(columna, fila) !== CELDA.agua) {
          datos[destino + 3] = 0;
          continue;
        }
        const superficie = this.granos.celdaEn(columna, fila - 1) !== CELDA.agua;
        const color = superficie ? this.brillo : this.agua;
        datos[destino] = color[0];
        datos[destino + 1] = color[1];
        datos[destino + 2] = color[2];
        datos[destino + 3] = 255;

        if (this.granos.celdaEn(columna, fila + 1) === CELDA.aire) {
          for (let largo = 1; largo <= 4 && fila - largo >= 0; largo += 1) {
            const estela = ((fila - largo) * this.columnas + columna) * 4;
            datos[estela] = this.agua[0];
            datos[estela + 1] = this.agua[1];
            datos[estela + 2] = this.agua[2];
            datos[estela + 3] = 170 - largo * 34;
          }
        }
      }
    }
    this.textura.getContext().putImageData(this.imagen, 0, 0);
    this.textura.refresh();
  }

  private ponerPiso() {
    const desde = FILAS_DE_AGUA - 1 - CAIDA_HACIA_LA_REJILLA;
    for (let fila = desde; fila < FILAS_DE_AGUA; fila += 1) {
      for (let columna = 0; columna < this.columnas; columna += 1) {
        if (this.granos.celdaEn(columna, fila) === CELDA.solido) {
          this.granos.poner(columna, fila, CELDA.aire);
        }
      }
    }
    const locales = this.rejillas.map((columna) => columna - this.columnaOrigen);
    for (let columna = 0; columna < this.columnas; columna += 1) {
      const altura = alturaDelPiso(columna, locales, this.medioTramo);
      this.granos.solido(columna, FILAS_DE_AGUA - 1 - altura, 1, altura + 1);
    }
  }
}
