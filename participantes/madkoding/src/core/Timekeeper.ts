// ─── Timekeeper ──────────────────────────────────────────────────────────────

import { GAME } from '../types/config';

export class Timekeeper {
  private static instance: Timekeeper;
  private lastTime = 0;
  private _delta = 0;
  private _rawDelta = 0;
  private _timeScale = 1;

  static getInstance(): Timekeeper {
    if (!Timekeeper.instance) {
      Timekeeper.instance = new Timekeeper();
    }
    return Timekeeper.instance;
  }

  get delta(): number {
    return this._delta;
  }

  /** Unscaled frame delta (still capped) — for FX that ignore slow-motion. */
  get rawDelta(): number {
    return this._rawDelta;
  }

  get timeScale(): number {
    return this._timeScale;
  }

  set timeScale(value: number) {
    this._timeScale = Math.max(0, Math.min(1, value));
  }

  update(timestamp: number): void {
    if (this.lastTime === 0) {
      this.lastTime = timestamp;
      this._delta = 1 / GAME.TARGET_FPS;
      this._rawDelta = this._delta;
      return;
    }

    const rawDelta = (timestamp - this.lastTime) / 1000;
    this._rawDelta = Math.min(Math.max(rawDelta, 0), GAME.MAX_DELTA);
    this._delta = this._rawDelta * this._timeScale;
    this.lastTime = timestamp;
  }

  reset(): void {
    this.lastTime = 0;
    this._delta = 0;
    this._timeScale = 1;
  }
}
