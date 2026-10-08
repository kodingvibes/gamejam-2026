// ─── Touch Controls: virtual stick + action buttons for phones/tablets ──────
// Left side: a floating stick that appears under the thumb (drag to steer).
// Right side: FIRE (hold), BOOST (hold), BOMB, two barrel-roll buttons, and a
// pause button at the top. Uses raw touch events with preventDefault so the
// browser neither scrolls/zooms nor synthesizes the mouse events that used to
// hijack steering (a tap became a "mouse move + click").

const STICK_RADIUS = 56;   // px of thumb travel for a full deflection

export interface TouchState {
  axisX: number;
  axisY: number;
  fire: boolean;
  boost: boolean;
  bomb: boolean;      // edge
  rollLeft: boolean;  // edge
  rollRight: boolean; // edge
  pause: boolean;     // edge
}

type Hold = 'fire' | 'boost';
type Tap = 'bomb' | 'rollLeft' | 'rollRight' | 'pause';

export class TouchControls {
  readonly root: HTMLDivElement;
  private zone: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private axis = { x: 0, y: 0 };
  private held = new Map<number, Hold>();
  private taps = new Set<Tap>();
  /** Time of the last real touch (to drop the browser's compat mouse events). */
  lastTouch = -Infinity;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'touch-controls';
    this.root.innerHTML = `
      <div class="tc-zone"><div class="tc-base"><div class="tc-knob"></div></div><div class="tc-hint">ARRASTRA PARA MOVER</div></div>
      <button class="tc-btn tc-pause" data-tap="pause" aria-label="Pausa">II</button>
      <div class="tc-actions">
        <button class="tc-btn tc-roll" data-tap="rollLeft" aria-label="Barrel roll izquierda">⟲</button>
        <button class="tc-btn tc-roll" data-tap="rollRight" aria-label="Barrel roll derecha">⟳</button>
        <button class="tc-btn tc-bomb" data-tap="bomb" aria-label="Bomba">BOMBA</button>
        <button class="tc-btn tc-boost" data-hold="boost" aria-label="Boost">BOOST</button>
        <button class="tc-btn tc-fire" data-hold="fire" aria-label="Disparar">FUEGO</button>
      </div>`;
    parent.appendChild(this.root);
    this.zone = this.root.querySelector('.tc-zone') as HTMLDivElement;
    this.base = this.root.querySelector('.tc-base') as HTMLDivElement;
    this.knob = this.root.querySelector('.tc-knob') as HTMLDivElement;

    const opts = { passive: false } as AddEventListenerOptions;
    this.zone.addEventListener('touchstart', this.onStickStart, opts);
    this.zone.addEventListener('touchmove', this.onStickMove, opts);
    this.zone.addEventListener('touchend', this.onStickEnd, opts);
    this.zone.addEventListener('touchcancel', this.onStickEnd, opts);
    for (const btn of this.root.querySelectorAll<HTMLButtonElement>('.tc-btn')) {
      btn.addEventListener('touchstart', this.onBtnStart, opts);
      btn.addEventListener('touchend', this.onBtnEnd, opts);
      btn.addEventListener('touchcancel', this.onBtnEnd, opts);
    }
    // Any touch anywhere marks the device as touch-first (shows this UI).
    window.addEventListener('touchstart', this.onAnyTouch, { passive: true, capture: true });
    if (window.matchMedia?.('(pointer: coarse)').matches) document.body.classList.add('touch');
  }

  private onAnyTouch = (): void => {
    this.lastTouch = performance.now();
    document.body.classList.add('touch');
  };

  private onStickStart = (e: TouchEvent): void => {
    e.preventDefault();
    if (this.stickId !== null) return;
    const t = e.changedTouches[0];
    this.stickId = t.identifier;
    this.origin.x = t.clientX;
    this.origin.y = t.clientY;
    const r = this.zone.getBoundingClientRect();
    this.base.style.left = `${t.clientX - r.left}px`;
    this.base.style.top = `${t.clientY - r.top}px`;
    this.root.classList.add('stick-on');
    this.setKnob(0, 0);
  };

  private onStickMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.stickId) continue;
      let dx = t.clientX - this.origin.x, dy = t.clientY - this.origin.y;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        // Drag the base along so reversing direction is instant.
        const k = (len - STICK_RADIUS) / len;
        this.origin.x += dx * k;
        this.origin.y += dy * k;
        const r = this.zone.getBoundingClientRect();
        this.base.style.left = `${this.origin.x - r.left}px`;
        this.base.style.top = `${this.origin.y - r.top}px`;
        dx = t.clientX - this.origin.x;
        dy = t.clientY - this.origin.y;
      }
      this.setKnob(dx, dy);
    }
  };

  private onStickEnd = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.stickId) continue;
      this.stickId = null;
      this.axis.x = this.axis.y = 0;
      this.root.classList.remove('stick-on');
    }
  };

  private setKnob(dx: number, dy: number): void {
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // Small dead zone, then a slight response curve for fine aiming.
    const shape = (v: number) => {
      const a = Math.abs(v);
      return a < 0.08 ? 0 : Math.sign(v) * Math.pow((a - 0.08) / 0.92, 1.25);
    };
    this.axis.x = shape(dx / STICK_RADIUS);
    this.axis.y = shape(-dy / STICK_RADIUS);
  }

  private onBtnStart = (e: TouchEvent): void => {
    e.preventDefault();
    const btn = e.currentTarget as HTMLElement;
    btn.classList.add('pressed');
    const hold = btn.dataset.hold as Hold | undefined;
    const tap = btn.dataset.tap as Tap | undefined;
    for (const t of Array.from(e.changedTouches)) if (hold) this.held.set(t.identifier, hold);
    if (tap) this.taps.add(tap);
    navigator.vibrate?.(tap ? 12 : 6);
  };

  private onBtnEnd = (e: TouchEvent): void => {
    e.preventDefault();
    const btn = e.currentTarget as HTMLElement;
    for (const t of Array.from(e.changedTouches)) this.held.delete(t.identifier);
    if (e.targetTouches.length === 0) btn.classList.remove('pressed');
  };

  private isHeld(kind: Hold): boolean {
    for (const k of this.held.values()) if (k === kind) return true;
    return false;
  }

  /** Read and consume this frame's touch input. */
  poll(): TouchState {
    const s: TouchState = {
      axisX: this.axis.x,
      axisY: this.axis.y,
      fire: this.isHeld('fire'),
      boost: this.isHeld('boost'),
      bomb: this.taps.has('bomb'),
      rollLeft: this.taps.has('rollLeft'),
      rollRight: this.taps.has('rollRight'),
      pause: this.taps.has('pause'),
    };
    this.taps.clear();
    return s;
  }

  /** Drop everything (blur, pause, screen change). */
  release(): void {
    this.stickId = null;
    this.axis.x = this.axis.y = 0;
    this.held.clear();
    this.taps.clear();
    this.root.classList.remove('stick-on');
    for (const b of this.root.querySelectorAll('.pressed')) b.classList.remove('pressed');
  }

  dispose(): void {
    window.removeEventListener('touchstart', this.onAnyTouch, { capture: true });
    this.root.remove();
  }
}
