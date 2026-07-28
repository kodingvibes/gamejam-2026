export const PIXELES_POR_METRO = 2;
export const SUELO_Y = 460;
export const ALTO_VEREDA = 16;
export const CELDA_PX = 4;
export const FILAS_DE_AGUA = 50;
export const MARGEN_DE_AGUA = 4;

export function metroAPixel(metro: number): number {
  return metro * PIXELES_POR_METRO;
}

export function pixelAMetro(pixel: number): number {
  return pixel / PIXELES_POR_METRO;
}
