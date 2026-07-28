import { describe, expect, it } from "vitest";

import { Frente, SEGUNDOS_DE_RECORRIDO } from "../src/dominio/agua/Frente";
import { LARGO_DE_LA_ALAMEDA } from "../src/dominio/corredor/Hitos";

function correr(frente: Frente, segundos: number) {
  for (let tick = 0; tick < segundos * 10; tick += 1) {
    frente.avanzar(0.1);
  }
}

describe("Frente", () => {
  it("avanza solo hacia La Moneda pase lo que pase", () => {
    const frente = new Frente(LARGO_DE_LA_ALAMEDA);
    correr(frente, 10);
    expect(frente.metro).toBeGreaterThan(0);
  });

  it("llega a La Moneda justo al terminar el recorrido", () => {
    const frente = new Frente(LARGO_DE_LA_ALAMEDA);
    correr(frente, SEGUNDOS_DE_RECORRIDO - 5);
    expect(frente.llegoALaMoneda).toBe(false);
    correr(frente, 6);
    expect(frente.llegoALaMoneda).toBe(true);
  });

  it("nunca se pasa de La Moneda", () => {
    const frente = new Frente(LARGO_DE_LA_ALAMEDA);
    correr(frente, SEGUNDOS_DE_RECORRIDO * 2);
    expect(frente.metro).toBe(LARGO_DE_LA_ALAMEDA);
  });

  it("avanza siempre para el mismo lado, nunca retrocede", () => {
    const frente = new Frente(LARGO_DE_LA_ALAMEDA);
    let anterior = 0;
    for (let tick = 0; tick < 400; tick += 1) {
      frente.avanzar(0.1);
      expect(frente.metro).toBeGreaterThanOrEqual(anterior);
      anterior = frente.metro;
    }
  });
});
