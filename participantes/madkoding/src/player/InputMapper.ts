// ─── Input Mapper ────────────────────────────────────────────────────────────
// WASD + Arrow keys = ship movement (both control the ship)
// Arrow keys also offset the crosshair relative to the ship center
// Space = fire lasers, Z = bomb, Escape = pause

import * as THREE from 'three';

export interface InputState {
  fire: boolean;
  bomb: boolean;
  pause: boolean;
  horizontalAxis: number;
  verticalAxis: number;
  aimX: number;
  aimY: number;
  // Normalised screen-space position of the ship reticule / move target.
  moveX: number;
  moveY: number;
}

// How fast the keyboard reticule drifts from the ship center (NDC units/sec).
const AIM_SPEED = 1.4;

export class InputMapper {
  private keys: Set<string> = new Set();
  private _state: InputState = {
    fire: false, bomb: false, pause: false,
    horizontalAxis: 0, verticalAxis: 0,
    aimX: 0, aimY: 0,
    moveX: 0, moveY: 0,
  };
  private pauseConsumed = false;
  private bombConsumed = false;
  private _aimX = 0;
  private _aimY = 0;
  private _lastTime = 0;
  private _mouseX = 0;
  private _mouseY = 0;
  private _mouseDown = false;
  // Last non-zero axis from keyboard, so mixing keys gives predictable movement.
  private _lastAxisX = 0;
  private _lastAxisY = 0;

  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseenter', this.onMouseEnter);
    window.addEventListener('mouseleave', this.onMouseLeave);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) {
      e.preventDefault();
    }
  }
  private onKeyUp(e: KeyboardEvent): void { this.keys.delete(e.code); }
  private getKey(key: string): boolean { return this.keys.has(key); }

  private onMouseMove(e: MouseEvent): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this._mouseX = (e.clientX / w) * 2 - 1;
    this._mouseY = -((e.clientY / h) * 2 - 1);
  }

  private onMouseEnter(): void {
    document.body.classList.add('cursor-hidden');
  }

  private onMouseLeave(): void {
    document.body.classList.remove('cursor-hidden');
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) this._mouseDown = true;
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) this._mouseDown = false;
  }

  update(): InputState {
    const left = this.getKey('KeyA') || this.getKey('ArrowLeft');
    const right = this.getKey('KeyD') || this.getKey('ArrowRight');
    const up = this.getKey('KeyW') || this.getKey('ArrowUp');
    const down = this.getKey('KeyS') || this.getKey('ArrowDown');

    const fire = this.getKey('Space') || this._mouseDown;
    const pause = this.getKey('Escape') && !this.pauseConsumed;
    const bomb = this.getKey('KeyZ') && !this.bombConsumed;

    this.pauseConsumed = this.getKey('Escape');
    this.bombConsumed = this.getKey('KeyZ');

    let horizontalAxis = 0;
    let verticalAxis = 0;
    if (left) horizontalAxis -= 1;
    if (right) horizontalAxis += 1;
    if (up) verticalAxis += 1;
    if (down) verticalAxis -= 1;

    // Cancel opposites (left+right = 0, up+down = 0) so mixed keys don't amplify.
    horizontalAxis = THREE.MathUtils.clamp(horizontalAxis, -1, 1);
    verticalAxis = THREE.MathUtils.clamp(verticalAxis, -1, 1);

    // ── Gamepad overrides movement axes if present ──
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

    const cursorHidden = document.body.classList.contains('cursor-hidden');

    // Normalised move target (-1..1). Mouse always wins when visible;
    // otherwise keyboard / gamepad axes build a relative target handled by the
    // PlayerShip / Game loop.
    const moveX = cursorHidden ? this._mouseX : 0;
    const moveY = cursorHidden ? this._mouseY : 0;

    this._state = {
      fire, bomb, pause,
      horizontalAxis: Math.max(-1, Math.min(1, horizontalAxis)),
      verticalAxis: Math.max(-1, Math.min(1, verticalAxis)),
      aimX: 0,
      aimY: 0,
      moveX,
      moveY,
    };
    return this._state;
  }

  get state(): InputState { return this._state; }

  dispose(): void {
    document.body.classList.remove('cursor-hidden');
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseenter', this.onMouseEnter);
    window.removeEventListener('mouseleave', this.onMouseLeave);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
}