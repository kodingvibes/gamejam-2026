export const GOTAS_POR_CIEN_COLUMNAS = 4;
export const TRAGO_POR_DRENAJE = 115;
// Sumideros sit METROS_ENTRE_SUMIDEROS (100m = 50 columns) apart. A radius
// under 25 columns leaves a dead zone in the middle of every gap that
// neither neighboring grate's drainage ever reaches, no matter how well
// either is maintained — 25 is the minimum radius where two neighbors'
// reach meets with no gap.
export const RADIO_DE_TRAGO = 25;
export const RADIO_DE_TRAGO_FILAS = 10;
export const RADIO_DE_PELIGRO_COLUMNAS = 25;

export function gotasDeLluvia(caudal: number, columnasVisibles: number): number {
  return Math.max(1, Math.round((caudal * GOTAS_POR_CIEN_COLUMNAS * columnasVisibles) / 100));
}

export function tragoDeRejilla(drenaje: number): number {
  return Math.round(drenaje * TRAGO_POR_DRENAJE);
}
