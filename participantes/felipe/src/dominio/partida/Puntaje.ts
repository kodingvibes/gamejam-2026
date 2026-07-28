export const PUNTOS_POR_SEGUNDO = 10;
export const PUNTOS_POR_DESTAPADA = 120;
export const RACHA_MAXIMA = 5;

export class Puntaje {
  private puntos = 0;
  private destapadas = 0;
  private rachaActual = 1;

  get total(): number {
    return Math.floor(this.puntos);
  }

  get sumiderosDestapados(): number {
    return this.destapadas;
  }

  get racha(): number {
    return this.rachaActual;
  }

  correrTiempo(segundos: number) {
    this.puntos += segundos * PUNTOS_POR_SEGUNDO;
  }

  anotarDestapada() {
    this.destapadas += 1;
    this.puntos += PUNTOS_POR_DESTAPADA * this.rachaActual;
    this.rachaActual = Math.min(RACHA_MAXIMA, this.rachaActual + 1);
  }

  cortarRacha() {
    this.rachaActual = 1;
  }
}
