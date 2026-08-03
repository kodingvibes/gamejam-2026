export const TRAMOS = ["A", "B", "C", "D"] as const;

export type Tramo = (typeof TRAMOS)[number];

const AVANCE_POR_TRAMO = 1 / TRAMOS.length;
const AUMENTO_MAXIMO_DE_PRESION = 0.12;
const TOLERANCIA_DE_UMBRAL = 1e-9;

function avanceAcotado(avance: number): number {
  return Math.max(0, Math.min(1, avance));
}

export function indiceDeTramoEn(avance: number): number {
  return Math.min(
    TRAMOS.length - 1,
    Math.floor((avanceAcotado(avance) + TOLERANCIA_DE_UMBRAL) / AVANCE_POR_TRAMO),
  );
}

export function factorDePresionTemporal(avance: number): number {
  return 1 + avanceAcotado(avance) * AUMENTO_MAXIMO_DE_PRESION;
}

export class ProgresionDeTramos {
  private indiceActual = 0;
  private transicionesRealizadas = 0;

  get actual(): Tramo {
    return TRAMOS[this.indiceActual];
  }

  get transiciones(): number {
    return this.transicionesRealizadas;
  }

  actualizar(avance: number): Tramo {
    const indiceObjetivo = indiceDeTramoEn(avance);
    while (this.indiceActual < indiceObjetivo) {
      this.indiceActual += 1;
      this.transicionesRealizadas += 1;
    }
    return this.actual;
  }
}

export function tramosEntreTransiciones(desde: number, hasta: number): Tramo[] {
  const inicio = Math.max(0, Math.floor(desde));
  const final = Math.min(TRAMOS.length - 1, Math.floor(hasta));
  const pendientes: Tramo[] = [];
  for (let transicion = inicio + 1; transicion <= final; transicion += 1) {
    pendientes.push(TRAMOS[transicion]);
  }
  return pendientes;
}
