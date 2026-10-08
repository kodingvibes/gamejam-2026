// ─── Rail Shape: the analytic path every level flies ────────────────────────
// Shared by RailFactory (which samples it into a Catmull-Rom curve) and by the
// terrain (which carves its valley along it), so the canyon always winds with
// the exact path the ship follows. t = distance fraction along the stage
// (z = −t · length); t > 1 is the boss arena.

import type { LevelRailConfig } from '../levels/LevelData';

let cfg: LevelRailConfig = { amplitudeX: 6, amplitudeY: 2, frequencyX: 1.5, frequencyY: 2, length: 1200 };

export function setRailShape(config: LevelRailConfig): void {
  cfg = config;
}

export function getRailShape(): LevelRailConfig {
  return cfg;
}

// Wider sweeps + a second harmonic so the path banks and dips instead of
// drifting along a single gentle sine.
export function railX(t: number, c: LevelRailConfig = cfg): number {
  const f = Math.PI * c.frequencyX;
  return c.amplitudeX * 1.5 * (Math.sin(f * t) + 0.38 * Math.sin(f * 2.7 * t + 1.3));
}

export function railY(t: number, c: LevelRailConfig = cfg): number {
  const f = Math.PI * c.frequencyY;
  return c.amplitudeY * 1.7 * (Math.sin(f * t) + 0.5 * Math.sin(f * 1.9 * t + 0.7));
}

/** Rail centre (x, y) at a world z. */
export function railAtZ(z: number, c: LevelRailConfig = cfg): { x: number; y: number } {
  const t = -z / c.length;
  return { x: railX(t, c), y: railY(t, c) };
}
