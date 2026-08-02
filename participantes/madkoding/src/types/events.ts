// ─── Event Types ────────────────────────────────────────────────────────────

export enum GameEvent {
  // Game state
  STATE_CHANGE = 'state:change',
  LEVEL_COMPLETE = 'level:complete',
  GAME_OVER = 'game:over',
  VICTORY = 'game:victory',

  // Player
  PLAYER_DAMAGED = 'player:damaged',
  PLAYER_SHIELD_LOST = 'player:shield:lost',
  PLAYER_DEATH = 'player:death',
  PLAYER_FIRED = 'player:fired',
  BOMB_COUNT_CHANGED = 'bomb:count:changed',

  // Enemies
  ENEMY_DESTROYED = 'enemy:destroyed',
  BOSS_SPAWNED = 'boss:spawned',
  BOSS_DAMAGED = 'boss:damaged',
  BOSS_DESTROYED = 'boss:destroyed',

  // Waves
  WAVE_START = 'wave:start',

  // Scoring
  SCORE_CHANGED = 'score:changed',
  COMBO_CHANGED = 'combo:changed',
}

export type EventPayloads = {
  [GameEvent.STATE_CHANGE]: { from: string; to: string };
  [GameEvent.LEVEL_COMPLETE]: { level: number; score: number };
  [GameEvent.GAME_OVER]: { score: number; wave: number };
  [GameEvent.VICTORY]: { score: number };

  [GameEvent.PLAYER_DAMAGED]: { amount: number; health: number; shields: number };
  [GameEvent.PLAYER_SHIELD_LOST]: { shields: number };
  [GameEvent.PLAYER_DEATH]: {};
  [GameEvent.PLAYER_FIRED]: { weapon: string };
  [GameEvent.BOMB_COUNT_CHANGED]: { count: number };

  [GameEvent.ENEMY_DESTROYED]: { type: string; score: number; position: { x: number; y: number; z: number } };
  [GameEvent.BOSS_SPAWNED]: { name: string; maxHealth: number };
  [GameEvent.BOSS_DAMAGED]: { health: number; maxHealth: number };
  [GameEvent.BOSS_DESTROYED]: { score: number };

  [GameEvent.WAVE_START]: { wave: number; totalWaves: number };

  [GameEvent.SCORE_CHANGED]: { score: number };
  [GameEvent.COMBO_CHANGED]: { combo: number };
};
