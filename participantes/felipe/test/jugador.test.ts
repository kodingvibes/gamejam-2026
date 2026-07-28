import { describe, expect, it } from "vitest";

import { Jugador } from "../src/dominio/partida/Jugador";

describe("Jugador", () => {
  it("va mas lento cuando maneja con agua en la calle", () => {
    const enSeco = new Jugador(0);
    const enAgua = new Jugador(0);
    enSeco.mover(1, 1, false);
    enAgua.mover(1, 1, true);
    expect(enAgua.metro).toBeLessThan(enSeco.metro);
    expect(enAgua.metro).toBeGreaterThan(0);
  });

  it("cambia de rumbo segun hacia donde maneja", () => {
    const jugador = new Jugador(500);
    jugador.mover(-1, 0.5, false);
    expect(jugador.rumbo).toBe("izquierda");
    jugador.mover(1, 0.5, false);
    expect(jugador.rumbo).toBe("derecha");
  });

  it("no se mueve mientras destapa", () => {
    const jugador = new Jugador(300);
    jugador.trabajar();
    expect(jugador.estaTrabajando).toBe(true);
    expect(jugador.metro).toBe(300);
  });

  it("moverse corta el trabajo en curso", () => {
    const jugador = new Jugador(300);
    jugador.trabajar();
    jugador.mover(1, 0.2, false);
    expect(jugador.estaTrabajando).toBe(false);
  });

  it("queda encerrado en la ventana de la camara", () => {
    const jugador = new Jugador(300);
    jugador.mover(1, 10, false);
    jugador.encerrarEntre(200, 400);
    expect(jugador.metro).toBe(400);
    jugador.mover(-1, 10, false);
    jugador.encerrarEntre(200, 400);
    expect(jugador.metro).toBe(200);
  });
});
