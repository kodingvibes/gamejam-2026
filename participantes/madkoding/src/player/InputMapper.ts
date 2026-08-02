// ─── Input Mapper ────────────────────────────────────────────────────────────
// WASD + Arrow keys = ship movement (both control the ship)
// Arrow keys also offset the crosshair relative to the ship center
// Space = fire lasers, Z = bomb, Escape = pause

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  bomb: boolean;
  pause: boolean;
  horizontalAxis: number;
  verticalAxis: number;
  aimX: number;
  aimY: number;
}

const AIM_SPEED = 0.6; // how fast crosshair drifts from center

export class InputMapper {
  private keys: Set<string> = new Set();
  private _state: InputState = {
    left: false, right: false, up: false, down: false,
    fire: false, bomb: false,
    pause: false,
    horizontalAxis: 0, verticalAxis: 0,
    aimX: 0, aimY: 0,
  };
  private pauseConsumed = false;
  private bombConsumed = false;
  private _aimX = 0;
  private _aimY = 0;
  private _lastTime = 0;

  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) {
      e.preventDefault();
    }
  }
  private onKeyUp(e: KeyboardEvent): void { this.keys.delete(e.code); }
  private getKey(key: string): boolean { return this.keys.has(key); }

  update(): InputState {
    // Ship movement: both WASD and Arrow keys control the ship
    const left = this.getKey('KeyA') || this.getKey('ArrowLeft');
    const right = this.getKey('KeyD') || this.getKey('ArrowRight');
    const up = this.getKey('KeyW') || this.getKey('ArrowUp');
    const down = this.getKey('KeyS') || this.getKey('ArrowDown');

    const fire = this.getKey('Space');
    const pause = this.getKey('Escape') && !this.pauseConsumed;
    const bomb = this.getKey('KeyZ') && !this.bombConsumed;

    this.pauseConsumed = this.getKey('Escape');
    this.bombConsumed = this.getKey('KeyZ');

    let horizontalAxis = 0;
    let verticalAxis = 0;
    if (left) horizontalAxis -= 1;
    if (right) horizontalAxis += 1;
    if (up) verticalAxis -= 1;
    if (down) verticalAxis += 1;

    // Crosshair aim: arrow keys also drift the crosshair away from center.
    // When arrows are released, crosshair slowly returns to center (0,0).
    const now = performance.now();
    const dt = this._lastTime ? Math.min((now - this._lastTime) / 1000, 0.05) : 0.016;
    this._lastTime = now;

    let aimDx = 0, aimDy = 0;
    if (this.getKey('ArrowLeft')) aimDx -= 1;
    if (this.getKey('ArrowRight')) aimDx += 1;
    if (this.getKey('ArrowUp')) aimDy += 1;
    if (this.getKey('ArrowDown')) aimDy -= 1;

    // Move aim with arrows, drift back to center when released
    if (aimDx !== 0 || aimDy !== 0) {
      this._aimX += aimDx * AIM_SPEED * dt;
      this._aimY += aimDy * AIM_SPEED * dt;
    } else {
      // Return to center slowly
      this._aimX *= 0.92;
      this._aimY *= 0.92;
      if (Math.abs(this._aimX) < 0.01) this._aimX = 0;
      if (Math.abs(this._aimY) < 0.01) this._aimY = 0;
    }
    this._aimX = Math.max(-0.85, Math.min(0.85, this._aimX));
    this._aimY = Math.max(-0.6, Math.min(0.6, this._aimY));

    // Gamepad
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp) {
        const deadzone = 0.2;
        const lx = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;
        const ly = Math.abs(gp.axes[1]) > deadzone ? gp.axes[1] : 0;
        if (Math.abs(lx) > Math.abs(horizontalAxis)) horizontalAxis = lx;
        if (Math.abs(ly) > Math.abs(verticalAxis)) verticalAxis = ly;
        break;
      }
    }

    this._state = {
      left, right, up, down, fire, bomb, pause,
      horizontalAxis: Math.max(-1, Math.min(1, horizontalAxis)),
      verticalAxis: Math.max(-1, Math.min(1, verticalAxis)),
      aimX: this._aimX,
      aimY: this._aimY,
    };
    return this._state;
  }

  get state(): InputState { return this._state; }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}