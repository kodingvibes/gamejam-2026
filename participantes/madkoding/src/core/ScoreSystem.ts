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

  /** 0..1 time left before the combo drops (for the HUD timer bar). */
  get comboRatio(): number {
    return this._combo > 0 ? Math.max(0, 1 - this._comboTimer / this._comboTimeout) : 0;
  }
  get multiplier(): number { return Math.min(Math.max(this._combo, 1), 10); }

  /** Add points (multiplied by the combo). Returns the points actually gained. */
  add(baseScore: number): number {
    this._combo++;
    this._comboTimer = 0;
    const multiplier = Math.min(this._combo, 10);
    const gained = baseScore * multiplier;
    this._score += gained;
    this.eventBus.emit(GameEvent.SCORE_CHANGED, { score: this._score });
    this.eventBus.emit(GameEvent.COMBO_CHANGED, { combo: this._combo });
    return gained;
  }

  /** Flat bonus (stage clear) — not multiplied, doesn't touch the combo. */
  addBonus(points: number): void {
    this._score += points;
    this.eventBus.emit(GameEvent.SCORE_CHANGED, { score: this._score });
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
    this.eventBus.emit(GameEvent.SCORE_CHANGED, { score: 0 });
    this.eventBus.emit(GameEvent.COMBO_CHANGED, { combo: 0 });
  }
}