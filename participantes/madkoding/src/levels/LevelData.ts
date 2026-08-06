// ─── Level Definitions (20 levels, each with environment, rail, obstacles, waves) ──
// All levels have similar rail length (~1200 units) so completion time is consistent.

import type { EnemyType, PatternType, WaveDefinition } from '../waves/WaveDefinition';

export type TerrainType = 'space' | 'atmosphere' | 'cave' | 'nebula' | 'storm' | 'ice' | 'lava' | 'city' | 'void' | 'aurora';

export interface LevelEnvironment {
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  starfield: { count: number; depth: number; speed: number } | null;
  nebulae: { colors: number[]; count: number } | null;
  terrain: TerrainType;
  ambientLight: number;
  backgroundShips: boolean;
}

export interface LevelObstacleConfig {
  spawnInterval: number; // base seconds between obstacles (lower = denser)
  minRadius: number;
  maxRadius: number;
}

export interface LevelRailConfig {
  amplitudeX: number;
  amplitudeY: number;
  frequencyX: number;
  frequencyY: number;
  length: number;
}

export interface LevelDefinition {
  id: number;
  name: string;
  environment: LevelEnvironment;
  rail: LevelRailConfig;
  obstacles: LevelObstacleConfig;
  waves: WaveDefinition[];
  hasBoss: boolean;
}

// ── Helper: build a wave entry ──
function W(type: EnemyType, count: number, pattern: PatternType, bonus = 0) {
  return { entries: [{ enemyType: type, count, pattern }], bonusScore: bonus };
}
function MW(...entries: { enemyType: EnemyType; count: number; pattern: PatternType }[]) {
  const bonus = entries.reduce((s, e) => s + e.count * 100, 0);
  return { entries, bonusScore: bonus };
}

// ── 20 Levels ──
export const LEVELS: LevelDefinition[] = [
  // ═══ 1-5: Training / Easy (space, simple enemies) ═══
  {
    id: 1, name: 'Primer Vuelo',
    environment: { skyColor: 0x0a0a1e, fogColor: 0x0a0a1e, fogDensity: 0.0008, starfield: { count: 1000, depth: 500, speed: 15 }, nebulae: { colors: [0x4422aa], count: 2 }, terrain: 'space', ambientLight: 0.3, backgroundShips: true },
    rail: { amplitudeX: 6, amplitudeY: 2, frequencyX: 1.5, frequencyY: 2, length: 1200 },
    obstacles: { spawnInterval: 2.0, minRadius: 0.6, maxRadius: 1.2 },
    waves: [W('DRONE', 6, 'SWEEP', 200), W('DRONE', 4, 'CIRCLE', 200), W('SCOUT', 3, 'SWEEP', 300)],
    hasBoss: true,
  },
  {
    id: 2, name: 'Campo de Asteroides',
    environment: { skyColor: 0x0d0d20, fogColor: 0x0d0d20, fogDensity: 0.001, starfield: { count: 800, depth: 400, speed: 12 }, nebulae: { colors: [0x5533aa], count: 2 }, terrain: 'space', ambientLight: 0.25, backgroundShips: true },
    rail: { amplitudeX: 8, amplitudeY: 3, frequencyX: 1.2, frequencyY: 1.8, length: 1200 },
    obstacles: { spawnInterval: 1.2, minRadius: 0.5, maxRadius: 1.5 },
    waves: [W('DRONE', 8, 'SWEEP', 200), W('SCOUT', 4, 'CIRCLE', 300), W('DRONE', 4, 'ZIGZAG', 250)],
    hasBoss: true,
  },
  {
    id: 3, name: 'Corrientes de Nebulosa',
    environment: { skyColor: 0x1a0a2e, fogColor: 0x1a0a2e, fogDensity: 0.0015, starfield: { count: 600, depth: 300, speed: 10 }, nebulae: { colors: [0x8822aa, 0x4422aa], count: 3 }, terrain: 'nebula', ambientLight: 0.2, backgroundShips: true },
    rail: { amplitudeX: 10, amplitudeY: 4, frequencyX: 1.0, frequencyY: 1.5, length: 1200 },
    obstacles: { spawnInterval: 1.5, minRadius: 0.6, maxRadius: 1.3 },
    waves: [W('DRONE', 6, 'SWEEP', 200), W('SCOUT', 5, 'CIRCLE', 300), W('DRONE', 4, 'DIVE_BOMB', 300)],
    hasBoss: true,
  },
  {
    id: 4, name: 'Escolta Frágil',
    environment: { skyColor: 0x0e0e28, fogColor: 0x0e0e28, fogDensity: 0.0008, starfield: { count: 1000, depth: 500, speed: 15 }, nebulae: { colors: [0x2266aa], count: 2 }, terrain: 'space', ambientLight: 0.3, backgroundShips: true },
    rail: { amplitudeX: 7, amplitudeY: 3, frequencyX: 1.8, frequencyY: 2.2, length: 1200 },
    obstacles: { spawnInterval: 1.8, minRadius: 0.5, maxRadius: 1.0 },
    waves: [W('SCOUT', 6, 'SWEEP', 300), W('DRONE', 8, 'CIRCLE', 250), W('SCOUT', 4, 'DIVE', 400)],
    hasBoss: true,
  },
  {
    id: 5, name: 'Primera Sangre',
    environment: { skyColor: 0x12122a, fogColor: 0x12122a, fogDensity: 0.001, starfield: { count: 900, depth: 450, speed: 14 }, nebulae: { colors: [0x6622aa, 0xaa2266], count: 2 }, terrain: 'space', ambientLight: 0.25, backgroundShips: true },
    rail: { amplitudeX: 9, amplitudeY: 4, frequencyX: 1.3, frequencyY: 1.7, length: 1200 },
    obstacles: { spawnInterval: 1.0, minRadius: 0.6, maxRadius: 1.4 },
    waves: [W('DRONE', 10, 'SWEEP', 300), W('SCOUT', 6, 'CIRCLE', 400), W('FIGHTER', 2, 'DIVE_BOMB', 500)],
    hasBoss: true,
  },

  // ═══ 6-10: Medium (fighters appear, more obstacles) ═══
  {
    id: 6, name: 'Tormenta de Polvo',
    environment: { skyColor: 0x2a1a0a, fogColor: 0x2a1a0a, fogDensity: 0.003, starfield: { count: 400, depth: 200, speed: 8 }, nebulae: { colors: [0xaa6622, 0x884422], count: 3 }, terrain: 'storm', ambientLight: 0.15, backgroundShips: false },
    rail: { amplitudeX: 12, amplitudeY: 5, frequencyX: 1.5, frequencyY: 2.0, length: 1200 },
    obstacles: { spawnInterval: 0.8, minRadius: 0.5, maxRadius: 1.6 },
    waves: [W('DRONE', 8, 'SWEEP', 300), W('FIGHTER', 3, 'DIVE_BOMB', 600), W('SCOUT', 6, 'ZIGZAG', 400)],
    hasBoss: true,
  },
  {
    id: 7, name: 'Cañón Helado',
    environment: { skyColor: 0x0a1a2a, fogColor: 0x0a1a2a, fogDensity: 0.002, starfield: { count: 700, depth: 350, speed: 11 }, nebulae: { colors: [0x44aacc, 0x2266aa], count: 2 }, terrain: 'ice', ambientLight: 0.3, backgroundShips: false },
    rail: { amplitudeX: 8, amplitudeY: 3, frequencyX: 2.0, frequencyY: 2.5, length: 1200 },
    obstacles: { spawnInterval: 0.9, minRadius: 0.6, maxRadius: 1.5 },
    waves: [W('SCOUT', 8, 'CIRCLE', 400), W('FIGHTER', 4, 'DIVE', 600), W('DRONE', 6, 'SWEEP', 300)],
    hasBoss: true,
  },
  {
    id: 8, name: 'Río de Lava',
    environment: { skyColor: 0x2a0a0a, fogColor: 0x2a0a0a, fogDensity: 0.003, starfield: { count: 300, depth: 150, speed: 6 }, nebulae: { colors: [0xcc4422, 0xaa2200], count: 2 }, terrain: 'lava', ambientLight: 0.2, backgroundShips: false },
    rail: { amplitudeX: 10, amplitudeY: 6, frequencyX: 1.2, frequencyY: 1.6, length: 1200 },
    obstacles: { spawnInterval: 0.7, minRadius: 0.7, maxRadius: 1.8 },
    waves: [W('FIGHTER', 4, 'DIVE_BOMB', 600), W('DRONE', 10, 'CIRCLE', 300), W('INTERCEPTOR', 2, 'ZIGZAG', 500)],
    hasBoss: true,
  },
  {
    id: 9, name: 'Campo Minado',
    environment: { skyColor: 0x0a0a0a, fogColor: 0x0a0a0a, fogDensity: 0.004, starfield: { count: 500, depth: 250, speed: 9 }, nebulae: null, terrain: 'void', ambientLight: 0.1, backgroundShips: false },
    rail: { amplitudeX: 6, amplitudeY: 2, frequencyX: 1.0, frequencyY: 1.0, length: 1200 },
    obstacles: { spawnInterval: 0.5, minRadius: 0.8, maxRadius: 2.0 },
    waves: [W('DRONE', 12, 'SWEEP', 300), W('FIGHTER', 4, 'DIVE', 600), W('SCOUT', 6, 'ZIGZAG', 400)],
    hasBoss: true,
  },
  {
    id: 10, name: 'Aurora Mortal',
    environment: { skyColor: 0x0a1a2e, fogColor: 0x0a1a2e, fogDensity: 0.001, starfield: { count: 1000, depth: 500, speed: 16 }, nebulae: { colors: [0x22ff88, 0x22aaff, 0xaa44ff], count: 4 }, terrain: 'aurora', ambientLight: 0.3, backgroundShips: true },
    rail: { amplitudeX: 11, amplitudeY: 5, frequencyX: 1.4, frequencyY: 1.9, length: 1200 },
    obstacles: { spawnInterval: 0.8, minRadius: 0.5, maxRadius: 1.3 },
    waves: [W('FIGHTER', 5, 'DIVE_BOMB', 700), W('INTERCEPTOR', 3, 'ZIGZAG', 600), W('DRONE', 8, 'CIRCLE', 300)],
    hasBoss: true,
  },

  // ═══ 11-15: Hard (interceptors + bombers, dense obstacles) ═══
  {
    id: 11, name: 'Núcleo de la Tormenta',
    environment: { skyColor: 0x1a0a1a, fogColor: 0x1a0a1a, fogDensity: 0.005, starfield: { count: 200, depth: 100, speed: 5 }, nebulae: { colors: [0xaa22aa, 0x660066], count: 3 }, terrain: 'storm', ambientLight: 0.1, backgroundShips: false },
    rail: { amplitudeX: 14, amplitudeY: 7, frequencyX: 1.6, frequencyY: 2.2, length: 1200 },
    obstacles: { spawnInterval: 0.6, minRadius: 0.6, maxRadius: 1.7 },
    waves: [W('FIGHTER', 6, 'DIVE_BOMB', 800), W('INTERCEPTOR', 4, 'ZIGZAG', 700), W('BOMBER', 1, 'DIVE', 1000)],
    hasBoss: true,
  },
  {
    id: 12, name: 'Cuevas de Cristal',
    environment: { skyColor: 0x0a1a2a, fogColor: 0x0a1a2a, fogDensity: 0.002, starfield: { count: 600, depth: 300, speed: 10 }, nebulae: { colors: [0x44ffcc, 0x22aacc], count: 2 }, terrain: 'cave', ambientLight: 0.2, backgroundShips: false },
    rail: { amplitudeX: 7, amplitudeY: 4, frequencyX: 2.5, frequencyY: 3.0, length: 1200 },
    obstacles: { spawnInterval: 0.7, minRadius: 0.5, maxRadius: 1.4 },
    waves: [W('INTERCEPTOR', 4, 'CIRCLE', 700), W('FIGHTER', 6, 'DIVE', 800), W('SCOUT', 8, 'SWEEP', 400)],
    hasBoss: true,
  },
  {
    id: 13, name: 'Atmósfera Inestable',
    environment: { skyColor: 0x2a2a0a, fogColor: 0x2a2a0a, fogDensity: 0.004, starfield: { count: 300, depth: 150, speed: 7 }, nebulae: { colors: [0xaaaa44, 0x888822], count: 2 }, terrain: 'atmosphere', ambientLight: 0.25, backgroundShips: false },
    rail: { amplitudeX: 10, amplitudeY: 5, frequencyX: 1.8, frequencyY: 2.4, length: 1200 },
    obstacles: { spawnInterval: 0.6, minRadius: 0.6, maxRadius: 1.6 },
    waves: [W('FIGHTER', 8, 'DIVE_BOMB', 900), W('BOMBER', 2, 'DIVE', 1200), W('DRONE', 10, 'CIRCLE', 300)],
    hasBoss: true,
  },
  {
    id: 14, name: 'Ruinas Orbitales',
    environment: { skyColor: 0x1a1a2e, fogColor: 0x1a1a2e, fogDensity: 0.001, starfield: { count: 800, depth: 400, speed: 13 }, nebulae: { colors: [0x8866aa, 0x664488], count: 2 }, terrain: 'space', ambientLight: 0.25, backgroundShips: true },
    rail: { amplitudeX: 9, amplitudeY: 4, frequencyX: 1.5, frequencyY: 2.0, length: 1200 },
    obstacles: { spawnInterval: 0.5, minRadius: 0.7, maxRadius: 1.9 },
    waves: [W('INTERCEPTOR', 5, 'ZIGZAG', 800), W('FIGHTER', 6, 'DIVE', 800), W('BOMBER', 2, 'DIVE_BOMB', 1200)],
    hasBoss: true,
  },
  {
    id: 15, name: 'Corazón de la Nebulosa',
    environment: { skyColor: 0x2a0a3e, fogColor: 0x2a0a3e, fogDensity: 0.002, starfield: { count: 400, depth: 200, speed: 8 }, nebulae: { colors: [0xff44aa, 0xaa22ff, 0x6600cc], count: 4 }, terrain: 'nebula', ambientLight: 0.15, backgroundShips: false },
    rail: { amplitudeX: 12, amplitudeY: 6, frequencyX: 1.3, frequencyY: 1.7, length: 1200 },
    obstacles: { spawnInterval: 0.5, minRadius: 0.5, maxRadius: 1.5 },
    waves: [W('BOMBER', 3, 'DIVE', 1500), W('INTERCEPTOR', 6, 'CIRCLE', 800), W('FIGHTER', 8, 'DIVE_BOMB', 900)],
    hasBoss: true,
  },

  // ═══ 16-20: Very Hard (everything maxed) ═══
  {
    id: 16, name: 'Infierno de Metal',
    environment: { skyColor: 0x3a0a0a, fogColor: 0x3a0a0a, fogDensity: 0.005, starfield: { count: 200, depth: 100, speed: 5 }, nebulae: { colors: [0xff2200, 0xcc4400], count: 2 }, terrain: 'lava', ambientLight: 0.15, backgroundShips: false },
    rail: { amplitudeX: 13, amplitudeY: 7, frequencyX: 1.7, frequencyY: 2.3, length: 1200 },
    obstacles: { spawnInterval: 0.4, minRadius: 0.6, maxRadius: 1.8 },
    waves: [W('BOMBER', 3, 'DIVE', 1800), W('FIGHTER', 10, 'DIVE_BOMB', 1000), W('INTERCEPTOR', 6, 'ZIGZAG', 800)],
    hasBoss: true,
  },
  {
    id: 17, name: 'Vacío Absoluto',
    environment: { skyColor: 0x000000, fogColor: 0x000000, fogDensity: 0.006, starfield: { count: 100, depth: 50, speed: 3 }, nebulae: null, terrain: 'void', ambientLight: 0.05, backgroundShips: false },
    rail: { amplitudeX: 8, amplitudeY: 3, frequencyX: 1.0, frequencyY: 1.0, length: 1200 },
    obstacles: { spawnInterval: 0.3, minRadius: 0.8, maxRadius: 2.2 },
    waves: [W('BOMBER', 4, 'DIVE', 2000), W('INTERCEPTOR', 8, 'CIRCLE', 1000), W('FIGHTER', 10, 'DIVE_BOMB', 1000)],
    hasBoss: true,
  },
  {
    id: 18, name: 'Muralla de Hielo',
    environment: { skyColor: 0x0a1a2e, fogColor: 0x0a1a2e, fogDensity: 0.003, starfield: { count: 500, depth: 250, speed: 9 }, nebulae: { colors: [0x44ccff, 0x2288cc], count: 3 }, terrain: 'ice', ambientLight: 0.3, backgroundShips: false },
    rail: { amplitudeX: 10, amplitudeY: 5, frequencyX: 2.0, frequencyY: 2.5, length: 1200 },
    obstacles: { spawnInterval: 0.35, minRadius: 0.5, maxRadius: 1.6 },
    waves: [W('BOMBER', 4, 'DIVE_BOMB', 2000), W('INTERCEPTOR', 8, 'ZIGZAG', 1000), W('FIGHTER', 12, 'DIVE', 1200)],
    hasBoss: true,
  },
  {
    id: 19, name: 'Asalto Final',
    environment: { skyColor: 0x1a0a2e, fogColor: 0x1a0a2e, fogDensity: 0.002, starfield: { count: 600, depth: 300, speed: 10 }, nebulae: { colors: [0xff2266, 0xcc22aa, 0x8800cc], count: 3 }, terrain: 'nebula', ambientLight: 0.2, backgroundShips: true },
    rail: { amplitudeX: 11, amplitudeY: 6, frequencyX: 1.5, frequencyY: 2.0, length: 1200 },
    obstacles: { spawnInterval: 0.3, minRadius: 0.6, maxRadius: 1.7 },
    waves: [
      W('BOMBER', 5, 'DIVE', 2500),
      W('INTERCEPTOR', 10, 'CIRCLE', 1200),
      W('FIGHTER', 12, 'DIVE_BOMB', 1200),
      W('DRONE', 15, 'SWEEP', 500),
    ],
    hasBoss: true,
  },
  {
    id: 20, name: 'Más Allá',
    environment: { skyColor: 0x0a0a2e, fogColor: 0x0a0a2e, fogDensity: 0.001, starfield: { count: 1200, depth: 600, speed: 18 }, nebulae: { colors: [0x8844ff, 0x2266ff, 0x44ffaa, 0xff44aa], count: 5 }, terrain: 'aurora', ambientLight: 0.3, backgroundShips: true },
    rail: { amplitudeX: 12, amplitudeY: 6, frequencyX: 1.6, frequencyY: 2.2, length: 1200 },
    obstacles: { spawnInterval: 0.25, minRadius: 0.5, maxRadius: 1.5 },
    waves: [
      W('BOMBER', 6, 'DIVE', 3000),
      W('INTERCEPTOR', 12, 'ZIGZAG', 1500),
      W('FIGHTER', 15, 'DIVE_BOMB', 1500),
      W('SCOUT', 10, 'CIRCLE', 600),
    ],
    hasBoss: true,
  },
];
