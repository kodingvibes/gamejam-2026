// ─── Score System: combo, multiplier, score tracking ────────────────────────

import { EventBus } from './EventBus';
import { GameEvent } from '../types/events';

export class ScoreSystem {
  private eventBus: EventBus;
  private _score = 0;
  private _combo = 0;
  private _comboTimer = 0;
  private readonly _comboTimeout = 2;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  get score(): number { return this._score; }
  get combo(): number { return this._combo; }

  add(baseScore: number): void {
    this._combo++;
    this._comboTimer = 0;
    const multiplier = Math.min(this._combo, 10);
    this._score += baseScore * multiplier;
    this.eventBus.emit(GameEvent.SCORE_CHANGED, { score: this._score });
    this.eventBus.emit(GameEvent.COMBO_CHANGED, { combo: this._combo });
  }

  update(dt: number): void {
    if (this._combo > 0) {
      this._comboTimer += dt;
      if (this._comboTimer >= this._comboTimeout) {
        this._combo = 0;
        this.eventBus.emit(GameEvent.COMBO_CHANGED, { combo: 0 });
      }
    }
  }

  reset(): void {
    this._score = 0;
    this._combo = 0;
    this._comboTimer = 0;
  }
}