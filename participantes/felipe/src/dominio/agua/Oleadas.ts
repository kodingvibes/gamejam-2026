export interface Oleada {
  readonly nombre: string;
  readonly duracionSegundos: number;
  readonly caudal: number;
  readonly granizoPorSegundo: number;
  readonly obstruccionPorSegundo: number;
}

export interface Curva {
  readonly duracionTotalSegundos: number | null;
  oleadaEn(segundos: number): Oleada;
  numeroDeOleada(segundos: number): number;
}

const RESPIRO: Oleada = {
  nombre: "sol",
  duracionSegundos: 8,
  caudal: 0.1,
  granizoPorSegundo: 0,
  obstruccionPorSegundo: 0.004,
};

const BASE: readonly Oleada[] = [
  {
    nombre: "llovizna",
    duracionSegundos: 60,
    caudal: 1,
    granizoPorSegundo: 0,
    obstruccionPorSegundo: 0.015,
  },
  {
    nombre: "chubasco",
    duracionSegundos: 60,
    caudal: 1.3,
    granizoPorSegundo: 0.4,
    obstruccionPorSegundo: 0.022,
  },
  {
    nombre: "granizo",
    duracionSegundos: 60,
    caudal: 1.8,
    granizoPorSegundo: 2.2,
    obstruccionPorSegundo: 0.032,
  },
];

export const CAUDAL_DE_ARRANQUE = 1.2;
export const CAUDAL_POR_SEGUNDO = 0.0048;

export function envolventeDeCaudal(segundos: number): number {
  return CAUDAL_DE_ARRANQUE + CAUDAL_POR_SEGUNDO * Math.max(0, segundos);
}

const CRECIMIENTO_POR_VUELTA = 0.22;

function escalar(oleada: Oleada, vuelta: number): Oleada {
  const factor = 1 + CRECIMIENTO_POR_VUELTA * vuelta;
  return {
    nombre: oleada.nombre,
    duracionSegundos: oleada.duracionSegundos,
    caudal: oleada.caudal * factor,
    granizoPorSegundo: oleada.granizoPorSegundo * factor,
    obstruccionPorSegundo: oleada.obstruccionPorSegundo * factor,
  };
}

class CurvaTemporal implements Curva {
  readonly duracionTotalSegundos = BASE.reduce((total, oleada) => total + oleada.duracionSegundos, 0);

  oleadaEn(segundos: number): Oleada {
    return BASE[this.numeroDeOleada(segundos)] ?? BASE[BASE.length - 1];
  }

  numeroDeOleada(segundos: number): number {
    let restante = Math.max(0, segundos);
    for (let indice = 0; indice < BASE.length; indice += 1) {
      if (restante < BASE[indice].duracionSegundos) {
        return indice;
      }
      restante -= BASE[indice].duracionSegundos;
    }
    return BASE.length - 1;
  }
}

class CurvaSinFin implements Curva {
  readonly duracionTotalSegundos = null;

  private readonly ciclo: readonly Oleada[] = BASE.flatMap((oleada) => [oleada, RESPIRO]);

  private readonly largoDelCiclo = this.ciclo.reduce((total, oleada) => total + oleada.duracionSegundos, 0);

  oleadaEn(segundos: number): Oleada {
    const vuelta = Math.floor(Math.max(0, segundos) / this.largoDelCiclo);
    let restante = Math.max(0, segundos) % this.largoDelCiclo;
    for (const oleada of this.ciclo) {
      if (restante < oleada.duracionSegundos) {
        return oleada === RESPIRO ? RESPIRO : escalar(oleada, vuelta);
      }
      restante -= oleada.duracionSegundos;
    }
    return escalar(BASE[BASE.length - 1], vuelta);
  }

  numeroDeOleada(segundos: number): number {
    const vuelta = Math.floor(Math.max(0, segundos) / this.largoDelCiclo);
    let restante = Math.max(0, segundos) % this.largoDelCiclo;
    for (let indice = 0; indice < this.ciclo.length; indice += 1) {
      if (restante < this.ciclo[indice].duracionSegundos) {
        return vuelta * BASE.length + Math.floor(indice / 2);
      }
      restante -= this.ciclo[indice].duracionSegundos;
    }
    return vuelta * BASE.length + BASE.length - 1;
  }
}

export function curvaTemporal(): Curva {
  return new CurvaTemporal();
}

export function curvaSinFin(): Curva {
  return new CurvaSinFin();
}
