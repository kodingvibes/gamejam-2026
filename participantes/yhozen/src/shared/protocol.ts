/**
 * Shared wire contract for the browser client and the multiplayer room server.
 * The server treats every field received from the client as untrusted; these
 * definitions are intentionally a convenience for callers, not validation.
 */

export const MULTIPLAYER_PATH = '/multiplayer';
export const MAX_PLAYERS_PER_ROOM = 4;
export const MAX_MESSAGE_BYTES = 8 * 1024;
export const STATE_RATE_HZ = 20;
export const SHOT_COOLDOWN_MS = 350;
export const PLAYER_HEALTH = 100;
export const SHOT_DAMAGE = 34;
export const RESPAWN_DELAY_MS = 2_000;
export const SCORE_TO_WIN = 5;

export type Vec3 = [number, number, number];

export interface PlayerState {
  position: Vec3;
  velocity: Vec3;
  rotation: Vec3;
}

export interface PlayerSnapshot extends PlayerState {
  id: string;
  name: string;
  health: number;
  score: number;
  alive: boolean;
}

export type ClientMessage =
  | { type: 'join'; room: string; name: string }
  | { type: 'state'; state: PlayerState }
  | { type: 'shot'; origin: Vec3; direction: Vec3; targetId?: string }
  | { type: 'ping'; clientTime?: number };

export type ServerMessage =
  | { type: 'welcome'; playerId: string; room: string; players: PlayerSnapshot[]; config: GameConfig }
  | { type: 'snapshot'; players: PlayerSnapshot[]; timestamp: number }
  | { type: 'shot'; playerId: string; origin: Vec3; direction: Vec3; timestamp: number }
  | { type: 'damage'; targetId: string; sourceId: string; amount: number; health: number }
  | { type: 'score'; playerId: string; score: number; winnerId?: string }
  | { type: 'respawn'; playerId: string; state: PlayerState; health: number }
  | { type: 'peerJoined'; player: PlayerSnapshot }
  | { type: 'peerLeft'; playerId: string }
  | { type: 'pong'; clientTime?: number; serverTime: number }
  | { type: 'error'; code: string; message: string };

export interface GameConfig {
  maxPlayers: number;
  stateRateHz: number;
  shotCooldownMs: number;
  playerHealth: number;
  shotDamage: number;
  respawnDelayMs: number;
  scoreToWin: number;
}
