export const SEGUNDOS_DE_RECORRIDO = 180;

export class Frente {
  private metroActual = 0;

  constructor(
    readonly largoMetros: number,
    private readonly metrosPorSegundo: number = largoMetros / SEGUNDOS_DE_RECORRIDO,
  ) {}

  get metro(): number {
    return this.metroActual;
  }

  get metrosSalvados(): number {
    return this.largoMetros - this.metroActual;
  }

  get llegoALaMoneda(): boolean {
    return this.metroActual >= this.largoMetros;
  }

  avanzar(segundos: number) {
    this.metroActual = Math.min(this.largoMetros, this.metroActual + this.metrosPorSegundo * segundos);
  }
}
