import { describe, expect, it } from "vitest";

import {
  factorDePresionTemporal,
  indiceDeTramoEn,
  ProgresionDeTramos,
  tramosEntreTransiciones,
} from "../src/dominio/partida/Tramos";

describe("ProgresionDeTramos", () => {
  it.each([
    [0, 0],
    [0.249, 0],
    [0.25, 1],
    [0.499, 1],
    [0.5, 2],
    [0.749, 2],
    [0.75, 3],
    [1, 3],
  ])("ubica el avance %s en el indice %s", (avance, indice) => {
    expect(indiceDeTramoEn(avance)).toBe(indice);
  });

  it("transita A → B → C → D una sola vez", () => {
    const progresion = new ProgresionDeTramos();
    expect(progresion.actual).toBe("A");

    progresion.actualizar(0.25);
    progresion.actualizar(0.25);
    progresion.actualizar(0.5);
    progresion.actualizar(0.75);
    progresion.actualizar(1);

    expect(progresion.actual).toBe("D");
    expect(progresion.transiciones).toBe(3);
  });

  it("alcanza D deterministicamente aunque un avance salte umbrales", () => {
    const progresion = new ProgresionDeTramos();
    progresion.actualizar(0.8);
    expect(progresion.actual).toBe("D");
    expect(progresion.transiciones).toBe(3);
  });

  it("enumera una sola vez cada aviso pendiente en saltos multiples", () => {
    expect(tramosEntreTransiciones(0, 3)).toEqual(["B", "C", "D"]);
    expect(tramosEntreTransiciones(2, 3)).toEqual(["D"]);
    expect(tramosEntreTransiciones(3, 3)).toEqual([]);
  });

  it("aumenta la presion de forma suave y acotada", () => {
    expect(factorDePresionTemporal(0)).toBe(1);
    expect(factorDePresionTemporal(0.5)).toBeCloseTo(1.06);
    expect(factorDePresionTemporal(1)).toBeCloseTo(1.12);
  });
});
