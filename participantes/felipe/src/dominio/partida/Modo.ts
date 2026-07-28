export const MODOS = {
  temporal: "temporal",
  sinFin: "sin-fin",
} as const;

export type Modo = (typeof MODOS)[keyof typeof MODOS];
