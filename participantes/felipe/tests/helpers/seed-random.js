// Tapa'o already seeds its own PRNG deterministically per run: JuegoScene
// creates `new Azar(97)` for movement/rain and VentanaDeAgua uses a fixed
// seed for the water canvas (src/dominio/agua/Azar.ts). Every playthrough
// with identical input is already reproducible — no test-side override
// needed. This file exists for structural parity with the game-qa skill's
// expected layout; there is nothing to export.
export {};
