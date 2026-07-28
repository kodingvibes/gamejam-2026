export interface Hito {
  readonly nombre: string;
  readonly metro: number;
}

export const LARGO_DE_LA_ALAMEDA = 2000;

export const HITOS: readonly Hito[] = [
  { nombre: "Plaza Baquedano", metro: 0 },
  { nombre: "GAM", metro: 250 },
  { nombre: "Casa Central UC", metro: 420 },
  { nombre: "Cerro Santa Lucia", metro: 700 },
  { nombre: "Biblioteca Nacional", metro: 950 },
  { nombre: "Iglesia San Francisco", metro: 1200 },
  { nombre: "Casa Central U. de Chile", metro: 1460 },
  { nombre: "La Moneda", metro: LARGO_DE_LA_ALAMEDA },
];
