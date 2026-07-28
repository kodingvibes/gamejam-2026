import { describe, expect, it } from "vitest";

import { Azar } from "../src/dominio/agua/Azar";
import { CELDA, Granos } from "../src/dominio/agua/Granos";
import { CAPACIDAD_POR_SUMIDERO } from "../src/dominio/corredor/Sumidero";
import {
  gotasDeLluvia,
  RADIO_DE_TRAGO,
  tragoDeRejilla,
} from "../src/presentacion/agua/Balance";
import { alturaDelPiso } from "../src/presentacion/agua/PerfilDeCalle";

function grillaConPiso(ancho: number, alto: number, semilla = 7): Granos {
  const granos = new Granos(ancho, alto, new Azar(semilla));
  granos.solido(0, alto - 1, ancho, 1);
  return granos;
}

function verterColumna(granos: Granos, x: number, cantidad: number) {
  for (let i = 0; i < cantidad; i += 1) {
    granos.verter(x, i);
  }
}

function huellaDelAgua(granos: Granos): string {
  const celdas: string[] = [];
  for (let fila = 0; fila < granos.alto; fila += 1) {
    for (let columna = 0; columna < granos.ancho; columna += 1) {
      if (granos.celdaEn(columna, fila) === CELDA.agua) {
        celdas.push(`${columna},${fila}`);
      }
    }
  }
  return celdas.join(" ");
}

function calleTrasElTemporal(caudal: number, obstruccion: number) {
  const rejillas = [25, 75, 125, 175, 225];
  const granos = new Granos(248, 50, new Azar(1));
  for (let columna = 0; columna < 248; columna += 1) {
    const altura = alturaDelPiso(columna, rejillas, 25);
    granos.solido(columna, 49 - altura, 1, altura + 1);
  }
  const lluvia = new Azar(2);
  const gotas = gotasDeLluvia(caudal, 248);
  const trago = tragoDeRejilla(CAPACIDAD_POR_SUMIDERO * (1 - obstruccion));
  for (let paso = 0; paso < 400; paso += 1) {
    for (let gota = 0; gota < gotas; gota += 1) {
      granos.verter(lluvia.entre(0, 247), 0);
    }
    if (trago > 0) {
      for (const columna of rejillas) {
        granos.drenar(columna, 48, RADIO_DE_TRAGO, trago);
      }
    }
    granos.paso();
  }
  const profundidad = (columna: number) => {
    let total = 0;
    for (let fila = 0; fila < 50; fila += 1) {
      if (granos.celdaEn(columna, fila) === CELDA.agua) {
        total += 1;
      }
    }
    return total;
  };
  return {
    agua: granos.aguaEnGrilla,
    profundidadEnMedio: profundidad(50),
  };
}

describe("Granos", () => {
  it("conserva el agua: lo vertido es lo drenado mas lo que queda en la grilla", () => {
    const granos = grillaConPiso(40, 30);
    verterColumna(granos, 20, 25);
    for (let paso = 0; paso < 500; paso += 1) {
      granos.paso();
    }
    granos.drenar(20, 28, 3, 5);
    for (let paso = 0; paso < 200; paso += 1) {
      granos.paso();
    }
    expect(granos.vertidos).toBe(granos.drenados + granos.aguaEnGrilla);
  });

  it("nunca convierte una celda solida en agua", () => {
    const granos = grillaConPiso(30, 20);
    granos.solido(10, 12, 8, 3);
    verterColumna(granos, 14, 10);
    for (let paso = 0; paso < 300; paso += 1) {
      granos.paso();
    }
    for (let fila = 12; fila < 15; fila += 1) {
      for (let columna = 10; columna < 18; columna += 1) {
        expect(granos.celdaEn(columna, fila)).toBe(CELDA.solido);
      }
    }
  });

  it("hace caer el agua hasta el piso", () => {
    const granos = grillaConPiso(10, 20);
    granos.verter(5, 0);
    for (let paso = 0; paso < 60; paso += 1) {
      granos.paso();
    }
    expect(granos.celdaEn(5, 0)).toBe(CELDA.aire);
    expect(granos.aguaEnGrilla).toBe(1);
    expect(granos.celdaEn(5, 18)).toBe(CELDA.agua);
  });

  it("el agua asentada se queda quieta en vez de pasearse por el piso", () => {
    const granos = grillaConPiso(20, 14);
    granos.verter(10, 0);
    for (let paso = 0; paso < 40; paso += 1) {
      granos.paso();
    }
    const reposo = huellaDelAgua(granos);
    for (let paso = 0; paso < 300; paso += 1) {
      granos.paso();
    }
    expect(huellaDelAgua(granos)).toBe(reposo);
  });

  it("una poza que crece termina encontrando el hoyo del sumidero", () => {
    const granos = new Granos(21, 16, new Azar(3));
    granos.solido(0, 15, 21, 1);
    granos.solido(0, 14, 10, 1);
    granos.solido(11, 14, 10, 1);
    for (let paso = 0; paso < 300; paso += 1) {
      granos.verter(2, 0);
      granos.paso();
    }
    expect(granos.celdaEn(10, 14)).toBe(CELDA.agua);
  });

  it("al desplazar la ventana cuenta como drenada el agua que se va", () => {
    const granos = grillaConPiso(24, 16);
    verterColumna(granos, 3, 10);
    for (let paso = 0; paso < 120; paso += 1) {
      granos.paso();
    }
    const antes = granos.aguaEnGrilla;
    granos.desplazar(10);
    expect(granos.vertidos).toBe(granos.drenados + granos.aguaEnGrilla);
    expect(granos.aguaEnGrilla).toBeLessThan(antes);
  });

  it("con llovizna y rejillas limpias solo queda una lamina fina", () => {
    const llovizna = calleTrasElTemporal(1, 0);
    expect(llovizna.agua).toBeLessThan(1100);
    expect(llovizna.profundidadEnMedio).toBeLessThan(8);
  });

  it("con granizo la calle se inunda aunque las rejillas esten limpias", () => {
    const granizo = calleTrasElTemporal(2.4, 0);
    expect(granizo.agua).toBeGreaterThan(1500);
    expect(granizo.profundidadEnMedio).toBeGreaterThan(10);
  });

  it("con las rejillas tapadas la calle se inunda con cualquier lluvia", () => {
    const tapadas = calleTrasElTemporal(1, 0.9);
    expect(tapadas.agua).toBeGreaterThan(calleTrasElTemporal(1, 0).agua * 3);
  });

  it("una loma de agua se aplana en vez de quedar como cerro", () => {
    const granos = grillaConPiso(120, 40);
    for (let gota = 0; gota < 600; gota += 1) {
      granos.verter(60 + (gota % 3) - 1, gota % 30);
    }
    for (let paso = 0; paso < 200; paso += 1) {
      granos.paso();
    }
    let alturaMaxima = 0;
    for (let columna = 0; columna < 120; columna += 1) {
      for (let fila = 0; fila < 39; fila += 1) {
        if (granos.celdaEn(columna, fila) === CELDA.agua) {
          alturaMaxima = Math.max(alturaMaxima, 39 - fila);
          break;
        }
      }
    }
    expect(alturaMaxima).toBeLessThan(14);
  });

  it("es determinista: misma semilla y mismos pasos dan la misma grilla", () => {
    const construir = () => {
      const granos = grillaConPiso(30, 24, 12345);
      verterColumna(granos, 15, 20);
      for (let paso = 0; paso < 1000; paso += 1) {
        granos.paso();
      }
      return granos;
    };
    const primera = construir();
    const segunda = construir();
    for (let fila = 0; fila < 24; fila += 1) {
      for (let columna = 0; columna < 30; columna += 1) {
        expect(segunda.celdaEn(columna, fila)).toBe(primera.celdaEn(columna, fila));
      }
    }
  });

  it("reparte el agua a los lados en vez de dejarla apilada en una torre", () => {
    const granos = grillaConPiso(40, 30);
    verterColumna(granos, 20, 20);
    for (let paso = 0; paso < 400; paso += 1) {
      granos.paso();
    }
    let columnasMojadas = 0;
    for (let columna = 0; columna < 40; columna += 1) {
      if (granos.celdaEn(columna, 28) === CELDA.agua) {
        columnasMojadas += 1;
      }
    }
    expect(columnasMojadas).toBeGreaterThan(1);
  });
});
