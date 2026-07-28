export type EstadoSumidero = "limpio" | "medio" | "tapado";

export const CAPACIDAD_POR_SUMIDERO = 0.125;

export class Sumidero {
  private obstruccionActual = 0;

  constructor(
    readonly metro: number,
    readonly capacidad: number = CAPACIDAD_POR_SUMIDERO,
  ) {}

  get obstruccion(): number {
    return this.obstruccionActual;
  }

  get estado(): EstadoSumidero {
    if (this.obstruccionActual < 0.3) {
      return "limpio";
    }
    if (this.obstruccionActual < 0.8) {
      return "medio";
    }
    return "tapado";
  }

  get drenaje(): number {
    return this.capacidad * (1 - this.obstruccionActual);
  }

  ensuciar(cantidad: number) {
    this.obstruccionActual = Math.min(1, this.obstruccionActual + Math.max(0, cantidad));
  }

  destapar(cantidad: number): number {
    const antes = this.obstruccionActual;
    this.obstruccionActual = Math.max(0, this.obstruccionActual - Math.max(0, cantidad));
    return antes - this.obstruccionActual;
  }

  tapar() {
    this.obstruccionActual = 1;
  }

  limpiar() {
    this.obstruccionActual = 0;
  }
}
