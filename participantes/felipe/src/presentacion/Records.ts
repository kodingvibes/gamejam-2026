import type { Modo } from "../dominio/partida/Modo";

const CLAVE = "tapao.records";

type Tabla = Partial<Record<Modo, number>>;

function leer(): Tabla {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as Tabla) : {};
  } catch {
    return {};
  }
}

export function mejorPuntaje(modo: Modo): number {
  return leer()[modo] ?? 0;
}

export function anotarPuntaje(modo: Modo, puntaje: number): boolean {
  const tabla = leer();
  if ((tabla[modo] ?? 0) >= puntaje) {
    return false;
  }
  tabla[modo] = puntaje;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(tabla));
  } catch {
    return true;
  }
  return true;
}
