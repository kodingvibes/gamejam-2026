import { describe, expect, it } from "vitest";

import { MODOS } from "../src/dominio/partida/Modo";
import { Partida } from "../src/dominio/partida/Partida";

function correr(partida: Partida, segundos: number, inundacion = 0) {
  for (let tick = 0; tick < segundos * 10 && !partida.terminada; tick += 1) {
    partida.avanzar(0.1, inundacion);
  }
}

describe("Partida", () => {
  it("se pierde cuando el agua tapa la avenida entera", () => {
    const partida = Partida.comenzar(MODOS.temporal);
    correr(partida, 5, 0.5);
    expect(partida.resultado).toBe("jugando");
    partida.avanzar(0.1, 1);
    expect(partida.resultado).toBe("perdida");
  });

  it("se gana el temporal al llegar a La Moneda sin ahogarse", () => {
    const partida = Partida.comenzar(MODOS.temporal);
    correr(partida, 200, 0.3);
    expect(partida.frente.llegoALaMoneda).toBe(true);
    expect(partida.resultado).toBe("ganada");
  });

  it("el sin fin no se gana ni llegando a La Moneda", () => {
    const partida = Partida.comenzar(MODOS.sinFin);
    correr(partida, 200, 0.3);
    expect(partida.frente.llegoALaMoneda).toBe(true);
    expect(partida.resultado).toBe("jugando");
  });

  it("llueve mas fuerte mientras mas cerca esta La Moneda", () => {
    const partida = Partida.comenzar(MODOS.temporal);
    const alPrincipio = partida.caudal;
    correr(partida, 50, 0.2);
    const aMitadDeCamino = partida.caudal;
    expect(aMitadDeCamino).toBeGreaterThan(alPrincipio);
    expect(partida.avance).toBeGreaterThan(0.2);
  });

  it("la camara avanza aunque el jugador no haga nada", () => {
    const partida = Partida.comenzar(MODOS.temporal);
    correr(partida, 30, 0);
    expect(partida.frente.metro).toBeGreaterThan(300);
  });

  it("solo hay sumidero al alcance si el jugador esta encima", () => {
    const partida = Partida.comenzar(MODOS.temporal);
    partida.jugador.encerrarEntre(500, 500);
    expect(partida.sumideroAlAlcance()?.metro).toBe(500);
    partida.jugador.encerrarEntre(550, 550);
    expect(partida.sumideroAlAlcance()).toBeNull();
  });

  it("destapar un sumidero tapado suma puntaje una sola vez", () => {
    const partida = Partida.comenzar(MODOS.temporal);
    const sumidero = partida.alameda.sumideros[3];
    sumidero.tapar();
    let anotadas = 0;
    for (let tick = 0; tick < 40; tick += 1) {
      if (partida.destapar(sumidero, 0.1)) {
        anotadas += 1;
      }
    }
    expect(sumidero.estado).toBe("limpio");
    expect(anotadas).toBe(1);
    expect(partida.puntaje.sumiderosDestapados).toBe(1);
  });

  it("una partida terminada ya no avanza", () => {
    const partida = Partida.comenzar(MODOS.temporal);
    partida.avanzar(0.1, 1);
    const congelado = partida.tiempoSegundos;
    partida.avanzar(5, 0);
    expect(partida.tiempoSegundos).toBe(congelado);
  });
});
