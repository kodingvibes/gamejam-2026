export class Azar {
  private estado: number;

  constructor(semilla: number) {
    this.estado = semilla >>> 0 || 1;
  }

  siguiente(): number {
    this.estado = (Math.imul(1664525, this.estado) + 1013904223) >>> 0;
    return this.estado;
  }

  fraccion(): number {
    return this.siguiente() / 0x100000000;
  }

  entre(minimo: number, maximo: number): number {
    return minimo + (this.siguiente() % (maximo - minimo + 1));
  }

  ocurre(probabilidad: number): boolean {
    return this.fraccion() < probabilidad;
  }
}
