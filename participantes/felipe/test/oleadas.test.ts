import { describe, expect, it } from "vitest";

import { curvaSinFin, curvaTemporal } from "../src/dominio/agua/Oleadas";

describe("Oleadas", () => {
  it("el temporal dura tres minutos y pasa por tres oleadas", () => {
    const curva = curvaTemporal();
    expect(curva.duracionTotalSegundos).toBe(180);
    expect(curva.oleadaEn(10).nombre).toBe("llovizna");
    expect(curva.oleadaEn(70).nombre).toBe("chubasco");
    expect(curva.oleadaEn(130).nombre).toBe("granizo");
    expect(curva.numeroDeOleada(179)).toBe(2);
  });

  it("el sin fin no termina y mete respiros de sol entre oleadas", () => {
    const curva = curvaSinFin();
    expect(curva.duracionTotalSegundos).toBeNull();
    expect(curva.oleadaEn(62).nombre).toBe("sol");
    expect(curva.oleadaEn(70).nombre).toBe("chubasco");
  });

  it("el sin fin escala: la misma oleada es mas brava en la vuelta siguiente", () => {
    const curva = curvaSinFin();
    const largoDelCiclo = 3 * (60 + 8);
    const primera = curva.oleadaEn(10);
    const segunda = curva.oleadaEn(10 + largoDelCiclo);
    const tercera = curva.oleadaEn(10 + largoDelCiclo * 2);
    expect(segunda.caudal).toBeGreaterThan(primera.caudal);
    expect(tercera.caudal).toBeGreaterThan(segunda.caudal);
    expect(tercera.obstruccionPorSegundo).toBeGreaterThan(primera.obstruccionPorSegundo);
  });

  it("el respiro de sol no escala, siempre es un descanso de verdad", () => {
    const curva = curvaSinFin();
    const largoDelCiclo = 3 * (60 + 8);
    expect(curva.oleadaEn(62).caudal).toBe(curva.oleadaEn(62 + largoDelCiclo * 3).caudal);
  });
});
