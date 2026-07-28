export const VELOCIDAD_METROS_POR_SEGUNDO = 105;
export const ALCANCE_METROS = 24;
export const FRENO_EN_EL_AGUA = 0.45;

export type Rumbo = "izquierda" | "derecha";

export class Jugador {
  private metroActual: number;
  private rumboActual: Rumbo = "derecha";
  private trabajando = false;

  constructor(metroInicial: number) {
    this.metroActual = metroInicial;
  }

  get metro(): number {
    return this.metroActual;
  }

  get rumbo(): Rumbo {
    return this.rumboActual;
  }

  get estaTrabajando(): boolean {
    return this.trabajando;
  }

  mover(direccion: number, segundos: number, conAgua: boolean) {
    this.trabajando = false;
    if (direccion === 0) {
      return;
    }
    this.rumboActual = direccion < 0 ? "izquierda" : "derecha";
    const velocidad = VELOCIDAD_METROS_POR_SEGUNDO * (conAgua ? FRENO_EN_EL_AGUA : 1);
    this.metroActual += direccion * velocidad * segundos;
  }

  trabajar() {
    this.trabajando = true;
  }

  encerrarEntre(desdeMetro: number, hastaMetro: number) {
    this.metroActual = Math.min(hastaMetro, Math.max(desdeMetro, this.metroActual));
  }
}
