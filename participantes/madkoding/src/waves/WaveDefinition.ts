// ─── Wave Definitions (types only — levels moved to LevelData.ts) ────────────

export type EnemyType = 'DRONE' | 'SCOUT' | 'FIGHTER' | 'INTERCEPTOR' | 'BOMBER';
export type PatternType = 'SWEEP' | 'DIVE_BOMB' | 'CIRCLE' | 'ZIGZAG' | 'DIVE';

export interface WaveEntry {
  enemyType: EnemyType;
  count: number;
  pattern: PatternType;
}

export interface WaveDefinition {
  entries: WaveEntry[];
  bonusScore: number;
}
