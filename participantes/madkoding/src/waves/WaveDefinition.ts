// ─── Wave Definitions ────────────────────────────────────────────────────────

export type EnemyType = 'DRONE' | 'SCOUT' | 'FIGHTER' | 'INTERCEPTOR' | 'BOMBER';
export type PatternType = 'SWEEP' | 'DIVE_BOMB' | 'CIRCLE';

export interface WaveEntry {
  enemyType: EnemyType;
  count: number;
  pattern: PatternType;
}

export interface WaveDefinition {
  entries: WaveEntry[];
  bonusScore: number;
}

export interface LevelDefinition {
  waves: WaveDefinition[];
  hasBoss: boolean;
}

// Procedurally generate 30 waves with all 5 enemy types, increasing difficulty.
//  1-10:  DRONE + SCOUT (light)
// 11-20:  + FIGHTER + INTERCEPTOR (medium)
// 21-30:  + BOMBER (heavy, everything mixed)
function generateWaves(): WaveDefinition[] {
  const waves: WaveDefinition[] = [];
  const allTypes: EnemyType[] = ['DRONE', 'SCOUT', 'FIGHTER', 'INTERCEPTOR', 'BOMBER'];
  const allPatterns: PatternType[] = ['SWEEP', 'DIVE_BOMB', 'CIRCLE'];

  for (let w = 0; w < 30; w++) {
    const entries: WaveEntry[] = [];
    const bonus = (w + 1) * 300;

    if (w < 10) {
      // Early: drones + scouts
      entries.push({ enemyType: 'DRONE', count: 4 + Math.floor(w / 2), pattern: 'SWEEP' });
      entries.push({ enemyType: 'SCOUT', count: 2 + Math.floor(w / 3), pattern: 'CIRCLE' });
      if (w >= 5) entries.push({ enemyType: 'DRONE', count: 3, pattern: 'DIVE_BOMB' });
    } else if (w < 20) {
      // Mid: add fighters + interceptors
      entries.push({ enemyType: 'DRONE', count: 6 + Math.floor((w - 10) / 2), pattern: 'CIRCLE' });
      entries.push({ enemyType: 'SCOUT', count: 4 + Math.floor((w - 10) / 3), pattern: 'SWEEP' });
      entries.push({ enemyType: 'FIGHTER', count: 3 + Math.floor((w - 10) / 2), pattern: 'DIVE_BOMB' });
      entries.push({ enemyType: 'INTERCEPTOR', count: 2 + Math.floor((w - 10) / 3), pattern: 'SWEEP' });
    } else {
      // Late: everything including bombers
      entries.push({ enemyType: 'DRONE', count: 8 + Math.floor((w - 20) / 2), pattern: 'CIRCLE' });
      entries.push({ enemyType: 'SCOUT', count: 6, pattern: 'SWEEP' });
      entries.push({ enemyType: 'FIGHTER', count: 6 + Math.floor((w - 20) / 2), pattern: 'DIVE_BOMB' });
      entries.push({ enemyType: 'INTERCEPTOR', count: 4 + Math.floor((w - 20) / 3), pattern: 'CIRCLE' });
      entries.push({ enemyType: 'BOMBER', count: 1 + Math.floor((w - 20) / 4), pattern: 'SWEEP' });
      // Extra mixed squad
      entries.push({ enemyType: allTypes[w % 5], count: 4, pattern: allPatterns[w % 3] });
    }

    waves.push({ entries, bonusScore: bonus });
  }

  return waves;
}

export const LEVELS: LevelDefinition[] = [
  {
    waves: generateWaves(),
    hasBoss: true,
  },
];
