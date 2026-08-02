// ─── Finite State Machine ────────────────────────────────────────────────────

import { EventBus } from './EventBus';
import { GameEvent } from '../types/events';

export enum GameState {
  BOOT = 'BOOT',
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
}

const VALID_TRANSITIONS: Record<GameState, GameState[]> = {
  [GameState.BOOT]: [GameState.MENU],
  [GameState.MENU]: [GameState.PLAYING],
  [GameState.PLAYING]: [GameState.PAUSED, GameState.GAME_OVER, GameState.VICTORY],
  [GameState.PAUSED]: [GameState.PLAYING, GameState.MENU],
  [GameState.GAME_OVER]: [GameState.MENU, GameState.PLAYING],
  [GameState.VICTORY]: [GameState.MENU],
};

export class StateManager {
  private static instance: StateManager;
  private _current: GameState = GameState.BOOT;
  private eventBus: EventBus;

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  get current(): GameState {
    return this._current;
  }

  isPlaying(): boolean {
    return this._current === GameState.PLAYING;
  }

  isPaused(): boolean {
    return this._current === GameState.PAUSED;
  }

  isMenu(): boolean {
    return this._current === GameState.MENU;
  }

  transition(to: GameState): boolean {
    const allowed = VALID_TRANSITIONS[this._current];
    if (!allowed || !allowed.includes(to)) {
      console.warn(`StateManager: Invalid transition ${this._current} → ${to}`);
      return false;
    }
    const from = this._current;
    this._current = to;
    this.eventBus.emit(GameEvent.STATE_CHANGE, { from, to });
    return true;
  }

  reset(): void {
    this._current = GameState.BOOT;
  }
}
