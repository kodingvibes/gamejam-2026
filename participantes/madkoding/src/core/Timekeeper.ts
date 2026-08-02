// ─── Timekeeper ──────────────────────────────────────────────────────────────

import { GAME } from '../types/config';

export class Timekeeper {
  private static instance: Timekeeper;
  private lastTime = 0;
  private _delta = 0;
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
      return;
    }

    const rawDelta = (timestamp - this.lastTime) / 1000;
    this._delta = Math.min(rawDelta, GAME.MAX_DELTA) * this._timeScale;
    this.lastTime = timestamp;
  }

  reset(): void {
    this.lastTime = 0;
    this._delta = 0;
    this._timeScale = 1;
  }
}
