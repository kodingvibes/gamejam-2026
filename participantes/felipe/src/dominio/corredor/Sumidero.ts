export type EstadoSumidero = "limpio" | "medio" | "tapado";

export const CAPACIDAD_POR_SUMIDERO = 0.125;

export class Sumidero {
  private obstruccionActual = 0;

  constructor(
    readonly metro: number,
    readonly capacidad: number = CAPACIDAD_POR_SUMIDERO,
    readonly factorDeSuciedad: number = 1,
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
    const libre = 1 - this.obstruccionActual;
    return this.capacidad * libre * libre;
  }

  ensuciar(cantidad: number) {
    this.obstruccionActual = Math.min(
      1,
      this.obstruccionActual + Math.max(0, cantidad) * this.factorDeSuciedad,
    );
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
