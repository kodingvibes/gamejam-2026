export const GOTAS_POR_CIEN_COLUMNAS = 6.25;
export const TRAGO_POR_DRENAJE = 34;
export const RADIO_DE_TRAGO = 4;

export function gotasDeLluvia(caudal: number, columnasVisibles: number): number {
  return Math.max(1, Math.round((caudal * GOTAS_POR_CIEN_COLUMNAS * columnasVisibles) / 100));
}

export function tragoDeRejilla(drenaje: number): number {
  return Math.round(drenaje * TRAGO_POR_DRENAJE);
}
