import { Azar } from "./Azar";

export const CELDA = {
  aire: 0,
  agua: 1,
  solido: 2,
} as const;

export type Celda = (typeof CELDA)[keyof typeof CELDA];

export const ALCANCE_LATERAL = 30;

export class Granos {
  private readonly celdas: Uint8Array;
  private readonly movidos: Uint8Array;
  private vertidosTotales = 0;
  private drenadosTotales = 0;

  constructor(
    readonly ancho: number,
    readonly alto: number,
    private readonly azar: Azar,
  ) {
    this.celdas = new Uint8Array(ancho * alto);
    this.movidos = new Uint8Array(ancho * alto);
  }

  get vertidos(): number {
    return this.vertidosTotales;
  }

  get drenados(): number {
    return this.drenadosTotales;
  }

  get aguaEnGrilla(): number {
    let total = 0;
    for (let posicion = 0; posicion < this.celdas.length; posicion += 1) {
      if (this.celdas[posicion] === CELDA.agua) {
        total += 1;
      }
    }
    return total;
  }

  dentro(x: number, y: number): boolean {
    return x >= 0 && x < this.ancho && y >= 0 && y < this.alto;
  }

  celdaEn(x: number, y: number): Celda {
    if (!this.dentro(x, y)) {
      return CELDA.solido;
    }
    return this.celdas[this.indice(x, y)] as Celda;
  }

  poner(x: number, y: number, celda: Celda) {
    if (this.dentro(x, y)) {
      this.celdas[this.indice(x, y)] = celda;
    }
  }

  solido(x: number, y: number, ancho: number, alto: number) {
    for (let fila = y; fila < y + alto; fila += 1) {
      for (let columna = x; columna < x + ancho; columna += 1) {
        this.poner(columna, fila, CELDA.solido);
      }
    }
  }

  verter(x: number, y: number): boolean {
    if (this.celdaEn(x, y) !== CELDA.aire) {
      return false;
    }
    this.celdas[this.indice(x, y)] = CELDA.agua;
    this.vertidosTotales += 1;
    return true;
  }

  drenar(x: number, y: number, radio: number, maximo: number, radioFilas: number = radio): number {
    let sacados = 0;
    for (let fila = y - radioFilas; fila <= y + radioFilas && sacados < maximo; fila += 1) {
      for (let columna = x - radio; columna <= x + radio && sacados < maximo; columna += 1) {
        if (this.celdaEn(columna, fila) === CELDA.agua) {
          this.celdas[this.indice(columna, fila)] = CELDA.aire;
          sacados += 1;
        }
      }
    }
    this.drenadosTotales += sacados;
    return sacados;
  }

  desplazar(columnas: number) {
    const cantidad = Math.min(Math.abs(columnas), this.ancho);
    if (cantidad === 0) {
      return;
    }
    const haciaIzquierda = columnas > 0;
    for (let fila = 0; fila < this.alto; fila += 1) {
      for (let borde = 0; borde < cantidad; borde += 1) {
        const columna = haciaIzquierda ? borde : this.ancho - 1 - borde;
        if (this.celdaEn(columna, fila) === CELDA.agua) {
          this.drenadosTotales += 1;
        }
      }
    }
    for (let fila = 0; fila < this.alto; fila += 1) {
      const base = fila * this.ancho;
      for (let avance = 0; avance < this.ancho; avance += 1) {
        const destino = haciaIzquierda ? avance : this.ancho - 1 - avance;
        const origen = haciaIzquierda ? destino + cantidad : destino - cantidad;
        this.celdas[base + destino] =
          origen >= 0 && origen < this.ancho ? this.celdas[base + origen] : CELDA.aire;
      }
    }
    this.movidos.fill(0);
  }

  paso() {
    this.movidos.fill(0);
    for (let y = this.alto - 1; y >= 0; y -= 1) {
      const haciaLaDerecha = this.azar.ocurre(0.5);
      for (let avance = 0; avance < this.ancho; avance += 1) {
        const x = haciaLaDerecha ? avance : this.ancho - 1 - avance;
        const origen = this.indice(x, y);
        if (this.celdas[origen] !== CELDA.agua || this.movidos[origen] === 1) {
          continue;
        }
        if (this.mover(x, y, x, y + 1)) {
          continue;
        }
        const preferida = haciaLaDerecha ? 1 : -1;
        if (this.mover(x, y, x + preferida, y + 1)) {
          continue;
        }
        if (this.mover(x, y, x - preferida, y + 1)) {
          continue;
        }
        const haciaAdelante = this.buscarBajada(x, y, preferida);
        if (haciaAdelante !== null && this.mover(x, y, haciaAdelante, y)) {
          continue;
        }
        const haciaAtras = this.buscarBajada(x, y, -preferida);
        if (haciaAtras !== null && this.mover(x, y, haciaAtras, y)) {
          continue;
        }
        if (this.celdaEn(x, y - 1) !== CELDA.agua) {
          continue;
        }
        if (this.mover(x, y, x + preferida, y)) {
          continue;
        }
        this.mover(x, y, x - preferida, y);
      }
    }
  }

  private indice(x: number, y: number): number {
    return y * this.ancho + x;
  }

  private buscarBajada(x: number, y: number, direccion: number): number | null {
    for (let paso = 1; paso <= ALCANCE_LATERAL; paso += 1) {
      const columna = x + direccion * paso;
      if (this.celdaEn(columna, y) !== CELDA.aire) {
        return null;
      }
      if (this.celdaEn(columna, y + 1) === CELDA.aire) {
        return columna;
      }
    }
    return null;
  }

  private mover(desdeX: number, desdeY: number, haciaX: number, haciaY: number): boolean {
    if (this.celdaEn(haciaX, haciaY) !== CELDA.aire) {
      return false;
    }
    this.celdas[this.indice(haciaX, haciaY)] = CELDA.agua;
    this.celdas[this.indice(desdeX, desdeY)] = CELDA.aire;
    this.movidos[this.indice(haciaX, haciaY)] = 1;
    return true;
  }
}
