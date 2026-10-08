// ─── Input Mapper ────────────────────────────────────────────────────────────
// Keyboard: WASD / arrows move · SPACE fire · Z bomb · SHIFT boost · Q/E roll
// Mouse:    pointer steers · left click fire · right click bomb
// Gamepad:  left stick move · A/RT fire · B bomb · LT/X boost · LB/RB roll
// Touch:    floating stick (left) · FUEGO/BOOST hold · BOMBA · ⟲ ⟳ · II
//
// The active scheme (mouse vs keys/pad) follows the LAST device the player
// touched. The old version relied on window mouseenter/mouseleave, which
// browsers don't fire reliably, so mouse steering often never engaged.

import * as THREE from 'three';
import { TouchControls } from './TouchControls';

export interface InputState {
  fire: boolean;
  bomb: boolean;
  pause: boolean;
  boost: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  horizontalAxis: number;
  verticalAxis: number;
  aimX: number;
  aimY: number;
  // Normalised screen-space position of the ship reticule / move target.
  moveX: number;
  moveY: number;
  /** True when the mouse pointer is the active steering device. */
  mouseMode: boolean;
}

const MOVE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
const PREVENT_KEYS = [...MOVE_KEYS, 'Space', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'KeyZ'];

export class InputMapper {
  private keys: Set<string> = new Set();
  // Keys pressed since the last update() — so a tap shorter than one frame
  // (common at low frame rates) still triggers edge actions.
  private tapped: Set<string> = new Set();
  private _state: InputState = {
    fire: false, bomb: false, pause: false, boost: false, rollLeft: false, rollRight: false,
    horizontalAxis: 0, verticalAxis: 0, aimX: 0, aimY: 0, moveX: 0, moveY: 0, mouseMode: false,
  };
  private prev = { pause: false, bomb: false, rollL: false, rollR: false };
  private _mouseX = 0;
  private _mouseY = 0;
  private _mouseDown = false;
  private _rightDown = false;
  private _mouseMode = false;
  private _lastMouse = { x: -1, y: -1 };
  readonly touch: TouchControls;

  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('contextmenu', this.onContextMenu);
    this.touch = new TouchControls(document.getElementById('game-container') ?? document.body);
  }

  /** Mouse events the browser synthesizes right after a touch are not a mouse. */
  private fromTouch(): boolean {
    return performance.now() - this.touch.lastTouch < 1200;
  }

  private setMouseMode(on: boolean): void {
    if (this._mouseMode === on) return;
    this._mouseMode = on;
    document.body.classList.toggle('cursor-hidden', on);
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);
    if (!e.repeat) this.tapped.add(e.code);
    if (MOVE_KEYS.includes(e.code)) this.setMouseMode(false);
    if (PREVENT_KEYS.includes(e.code) && document.body.classList.contains('in-game')) {
      e.preventDefault();
    }
  }
  private onKeyUp(e: KeyboardEvent): void { this.keys.delete(e.code); }
  private onBlur(): void {
    // Releasing focus would otherwise leave keys "stuck" down.
    this.keys.clear();
    this.tapped.clear();
    this._mouseDown = false;
    this._rightDown = false;
    this.touch.release();
  }
  private getKey(key: string): boolean { return this.keys.has(key); }
  private getTap(key: string): boolean { return this.tapped.has(key); }

  private onMouseMove(e: MouseEvent): void {
    if (this.fromTouch()) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this._mouseX = (e.clientX / w) * 2 - 1;
    this._mouseY = -((e.clientY / h) * 2 - 1);
    // Ignore tiny jitter so resting a hand on the mouse doesn't steal control.
    const dx = Math.abs(e.clientX - this._lastMouse.x);
    const dy = Math.abs(e.clientY - this._lastMouse.y);
    if (this._lastMouse.x >= 0 && dx + dy > 3) this.setMouseMode(true);
    this._lastMouse.x = e.clientX;
    this._lastMouse.y = e.clientY;
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.fromTouch()) return;
    if (e.button === 0) this._mouseDown = true;
    if (e.button === 2) this._rightDown = true;
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) this._mouseDown = false;
    if (e.button === 2) this._rightDown = false;
  }

  private onContextMenu(e: MouseEvent): void {
    if (document.body.classList.contains('in-game')) e.preventDefault();
  }

  update(): InputState {
    const left = this.getKey('KeyA') || this.getKey('ArrowLeft');
    const right = this.getKey('KeyD') || this.getKey('ArrowRight');
    const up = this.getKey('KeyW') || this.getKey('ArrowUp');
    const down = this.getKey('KeyS') || this.getKey('ArrowDown');

    let fire = this.getKey('Space') || this._mouseDown;
    let bombHeld = this.getKey('KeyZ') || this._rightDown;
    let pauseHeld = this.getKey('Escape') || this.getKey('KeyP');
    let boost = this.getKey('ShiftLeft') || this.getKey('ShiftRight');
    let rollL = this.getKey('KeyQ');
    let rollR = this.getKey('KeyE');

    let horizontalAxis = (right ? 1 : 0) - (left ? 1 : 0);
    let verticalAxis = (up ? 1 : 0) - (down ? 1 : 0);

    // ── Gamepad ──
    const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;
      const deadzone = 0.2;
      const lx = Math.abs(gp.axes[0] ?? 0) > deadzone ? gp.axes[0] : 0;
      // Gamepad Y is +down; game vertical axis is +up.
      const ly = Math.abs(gp.axes[1] ?? 0) > deadzone ? -gp.axes[1] : 0;
      if (lx !== 0 || ly !== 0) this.setMouseMode(false);
      if (Math.abs(lx) > Math.abs(horizontalAxis)) horizontalAxis = lx;
      if (Math.abs(ly) > Math.abs(verticalAxis)) verticalAxis = ly;
      const b = (n: number) => !!gp.buttons[n]?.pressed;
      fire = fire || b(0) || b(7);
      bombHeld = bombHeld || b(1);
      boost = boost || b(2) || b(6);
      rollL = rollL || b(4);
      rollR = rollR || b(5);
      pauseHeld = pauseHeld || b(9);
      break;
    }

    // ── Touch ──
    const t = this.touch.poll();
    if (t.axisX !== 0 || t.axisY !== 0) {
      this.setMouseMode(false);
      if (Math.abs(t.axisX) > Math.abs(horizontalAxis)) horizontalAxis = t.axisX;
      if (Math.abs(t.axisY) > Math.abs(verticalAxis)) verticalAxis = t.axisY;
    }
    fire = fire || t.fire;
    boost = boost || t.boost;

    // Edge-triggered actions.
    const pause = (pauseHeld && !this.prev.pause) || this.getTap('Escape') || this.getTap('KeyP') || t.pause;
    const bomb = (bombHeld && !this.prev.bomb) || this.getTap('KeyZ') || t.bomb;
    const rollLeft = (rollL && !this.prev.rollL) || this.getTap('KeyQ') || t.rollLeft;
    const rollRight = (rollR && !this.prev.rollR) || this.getTap('KeyE') || t.rollRight;
    fire = fire || this.getTap('Space');
    this.tapped.clear();
    this.prev.pause = pauseHeld;
    this.prev.bomb = bombHeld;
    this.prev.rollL = rollL;
    this.prev.rollR = rollR;

    this._state = {
      fire, bomb, pause, boost, rollLeft, rollRight,
      horizontalAxis: THREE.MathUtils.clamp(horizontalAxis, -1, 1),
      verticalAxis: THREE.MathUtils.clamp(verticalAxis, -1, 1),
      aimX: 0,
      aimY: 0,
      moveX: this._mouseMode ? this._mouseX : 0,
      moveY: this._mouseMode ? this._mouseY : 0,
      mouseMode: this._mouseMode,
    };
    return this._state;
  }

  get state(): InputState { return this._state; }

  dispose(): void {
    document.body.classList.remove('cursor-hidden');
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('contextmenu', this.onContextMenu);
    this.touch.dispose();
  }
}
