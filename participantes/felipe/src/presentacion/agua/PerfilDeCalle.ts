export const CAIDA_HACIA_LA_REJILLA = 4;

export function alturaDelPiso(
  columna: number,
  rejillas: readonly number[],
  medioTramo: number,
  caida: number = CAIDA_HACIA_LA_REJILLA,
): number {
  if (rejillas.length === 0 || medioTramo <= 0) {
    return 0;
  }
  let distancia = Number.POSITIVE_INFINITY;
  for (const rejilla of rejillas) {
    distancia = Math.min(distancia, Math.abs(columna - rejilla));
  }
  return Math.round(caida * Math.min(1, distancia / medioTramo));
}
