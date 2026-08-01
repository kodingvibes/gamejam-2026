import type { Modo } from "../dominio/partida/Modo";

const CLAVE = "tapao.records";
export const MAX_PUNTAJES = 5;
export const INICIALES_POR_DEFECTO = "AAA";

export interface EntradaDePuntaje {
  readonly iniciales: string;
  readonly puntaje: number;
}

type Tabla = Partial<Record<Modo, EntradaDePuntaje[]>>;

function leer(): Tabla {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as Tabla) : {};
  } catch {
    return {};
  }
}

function escribir(tabla: Tabla) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(tabla));
  } catch {
    // Sin localStorage (privado/bloqueado): la partida sigue, solo no se guarda.
  }
}

export function tablaDePuntajes(modo: Modo): EntradaDePuntaje[] {
  return leer()[modo] ?? [];
}

export function mejorPuntaje(modo: Modo): number {
  return tablaDePuntajes(modo)[0]?.puntaje ?? 0;
}

export function calificaParaElTop(modo: Modo, puntaje: number): boolean {
  const tabla = tablaDePuntajes(modo);
  return tabla.length < MAX_PUNTAJES || puntaje > tabla[tabla.length - 1].puntaje;
}

export function anotarPuntaje(modo: Modo, iniciales: string, puntaje: number): EntradaDePuntaje[] {
  const tabla = leer();
  const actualizada = [...(tabla[modo] ?? []), { iniciales, puntaje }]
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, MAX_PUNTAJES);
  tabla[modo] = actualizada;
  escribir(tabla);
  return actualizada;
}
