import type { PlayerSnapshot, PlayerState } from '../shared/protocol';
import type { NetworkState } from '../network/GameSocket';

export interface TestInput {
  forward?: boolean;
  brake?: boolean;
  left?: boolean;
  right?: boolean;
  ollie?: boolean;
  yaw?: number;
  pitch?: number;
}

export interface GameTestApi {
  readonly ready: boolean;
  readonly localPlayer: PlayerState & { health: number; score: number; speed: number; fps: number };
  readonly remotePlayers: PlayerSnapshot[];
  readonly events: {
    remoteShots: number;
    tuningVisible: boolean;
    networkState: NetworkState;
    latencyMs?: number;
  };
  setInput(input: TestInput): void;
  fire(targetId?: string): void;
  advance(milliseconds: number): Promise<void>;
}
