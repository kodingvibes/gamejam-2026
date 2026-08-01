import type { Azar } from "../agua/Azar";
import { HITOS, LARGO_DE_LA_ALAMEDA, type Hito } from "./Hitos";
import { CAPACIDAD_POR_SUMIDERO, Sumidero } from "./Sumidero";

export const METROS_ENTRE_SUMIDEROS = 100;
export const FACTOR_DE_SUCIEDAD_MINIMO = 0.55;
export const FACTOR_DE_SUCIEDAD_MAXIMO = 1.45;

export class Alameda {
  private constructor(
    readonly largoMetros: number,
    readonly hitos: readonly Hito[],
    readonly sumideros: readonly Sumidero[],
  ) {}

  static porDefecto(azar?: Azar): Alameda {
    return Alameda.crear(LARGO_DE_LA_ALAMEDA, HITOS, METROS_ENTRE_SUMIDEROS, azar);
  }

  static crear(
    largoMetros: number,
    hitos: readonly Hito[],
    metrosEntreSumideros: number,
    azar?: Azar,
  ): Alameda {
    const sumideros: Sumidero[] = [];
    const rango = FACTOR_DE_SUCIEDAD_MAXIMO - FACTOR_DE_SUCIEDAD_MINIMO;
    for (let metro = 0; metro <= largoMetros; metro += metrosEntreSumideros) {
      const factor = azar ? FACTOR_DE_SUCIEDAD_MINIMO + azar.fraccion() * rango : 1;
      sumideros.push(new Sumidero(metro, CAPACIDAD_POR_SUMIDERO, factor));
    }
    return new Alameda(largoMetros, hitos, sumideros);
  }

  get drenajeTotal(): number {
    return this.sumideros.reduce((total, sumidero) => total + sumidero.drenaje, 0);
  }

  get drenajeMaximo(): number {
    return this.sumideros.reduce((total, sumidero) => total + sumidero.capacidad, 0);
  }

  get tapados(): number {
    return this.sumideros.filter((sumidero) => sumidero.estado === "tapado").length;
  }

  ensuciarTodos(cantidad: number) {
    for (const sumidero of this.sumideros) {
      sumidero.ensuciar(cantidad);
    }
  }

  masCercano(metro: number): Sumidero {
    return this.sumideros.reduce((mejor, sumidero) =>
      Math.abs(sumidero.metro - metro) < Math.abs(mejor.metro - metro) ? sumidero : mejor,
    );
  }

  hitoMasCercano(metro: number): Hito {
    return this.hitos.reduce((mejor, hito) =>
      Math.abs(hito.metro - metro) < Math.abs(mejor.metro - metro) ? hito : mejor,
    );
  }
}
