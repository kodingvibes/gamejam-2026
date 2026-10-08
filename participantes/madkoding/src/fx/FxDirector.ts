// ─── FX Director: the game's motion-design brain ────────────────────────────
//
// Every "juice" effect funnels through here so they stack and decay coherently:
//   - hitStop(): freezes simulation time for a few frames on impactful hits
//   - slowMo(): eases time down and back (boss kill, bomb, last-life death)
//   - flash() / aberrate() / hurt(): screen-space pulses for the post pass
//   - kickFov(): punchy camera FOV impulses (boost, warp, explosions)
//   - warp: sustained zoom blur + FOV stretch for hyperspace transitions
//
// The director runs on REAL time (unaffected by its own slow-motion) and writes
// the resulting numbers into the post-processing pipeline and Timekeeper.

import * as THREE from 'three';
import { Timekeeper } from '../core/Timekeeper';
import type { CinematicParams, PostProcessingPipeline } from '../camera/PostProcessingPipeline';

const BASE_FOV = 70;

export class FxDirector {
  private timekeeper = Timekeeper.getInstance();

  // Time control
  private hitStopTimer = 0;
  private slowMoScale = 1;
  private slowMoTimer = 0;
  private slowMoDuration = 0;
  private slowMoRecover = 0.4;

  // Pulses (decay toward 0)
  private flashAmount = 0;
  private flashDecay = 4;
  private flashColor = new THREE.Color(1, 1, 1);
  private aberration = 0;
  private damage = 0;
  private fovImpulse = 0;
  private bloomImpulse = 0;

  // Sustained targets (lerped)
  private boost = 0;          // 0..1 current boost blend
  private boostTarget = 0;
  private warp = 0;           // 0..1 current warp blend
  private warpTarget = 0;
  private dangerTarget = 0;
  private danger = 0;
  private saturation = 1;
  private saturationTarget = 1;

  private params: CinematicParams = {
    aberration: 0, zoomBlur: 0, flash: 0, flashColor: new THREE.Color(1, 1, 1),
    damage: 0, danger: 0, vignette: 0.32, saturation: 1, bloom: 1,
  };

  constructor(private post: PostProcessingPipeline, private camera: THREE.PerspectiveCamera) {}

  // ── Triggers ──────────────────────────────────────────────────────────────

  /** Freeze the simulation for `seconds` of real time (impact frames). */
  hitStop(seconds: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, seconds);
  }

  /** Drop time to `scale` for `duration` seconds, then ease back to 1. */
  slowMo(scale: number, duration: number, recover = 0.5): void {
    this.slowMoScale = Math.min(this.slowMoTimer > 0 ? this.slowMoScale : 1, scale);
    this.slowMoTimer = Math.max(this.slowMoTimer, duration);
    this.slowMoDuration = Math.max(this.slowMoDuration, duration);
    this.slowMoRecover = recover;
  }

  flash(amount: number, color = 0xffffff, decay = 4): void {
    if (amount >= this.flashAmount) {
      this.flashColor.setHex(color);
      this.flashDecay = decay;
    }
    this.flashAmount = Math.min(1, Math.max(this.flashAmount, amount));
  }

  aberrate(amount: number): void {
    this.aberration = Math.min(2.5, this.aberration + amount);
  }

  hurt(amount: number): void {
    this.damage = Math.min(1, this.damage + amount);
    this.aberrate(amount * 1.2);
  }

  kickFov(degrees: number): void {
    this.fovImpulse += degrees;
  }

  bloomPulse(amount: number): void {
    this.bloomImpulse = Math.min(2, this.bloomImpulse + amount);
  }

  setBoost(active: boolean): void { this.boostTarget = active ? 1 : 0; }
  setWarp(amount: number): void { this.warpTarget = THREE.MathUtils.clamp(amount, 0, 1.5); }
  setDanger(amount: number): void { this.dangerTarget = THREE.MathUtils.clamp(amount, 0, 1); }
  setSaturation(s: number): void { this.saturationTarget = s; }

  get warpAmount(): number { return this.warp; }
  get boostAmount(): number { return this.boost; }

  /** Clear every effect (menu / restart). */
  reset(): void {
    this.hitStopTimer = 0;
    this.slowMoTimer = 0;
    this.slowMoScale = 1;
    this.flashAmount = 0;
    this.aberration = 0;
    this.damage = 0;
    this.fovImpulse = 0;
    this.bloomImpulse = 0;
    this.boost = this.boostTarget = 0;
    this.warp = this.warpTarget = 0;
    this.danger = this.dangerTarget = 0;
    this.saturation = this.saturationTarget = 1;
    this.timekeeper.timeScale = 1;
  }

  // ── Per-frame ─────────────────────────────────────────────────────────────

  /** `realDt` must be unscaled frame time. `paused` freezes time control. */
  update(realDt: number, paused = false): void {
    // Time scale: hit-stop wins, then slow-mo with an eased recovery.
    let scale = 1;
    if (!paused) {
      if (this.slowMoTimer > 0) {
        this.slowMoTimer -= realDt;
        const recoverT = this.slowMoRecover > 0
          ? THREE.MathUtils.clamp(1 - this.slowMoTimer / this.slowMoRecover, 0, 1)
          : 1;
        // Hold the slow scale, then ease back during the last `recover` secs.
        scale = this.slowMoTimer > this.slowMoRecover
          ? this.slowMoScale
          : THREE.MathUtils.lerp(this.slowMoScale, 1, easeInOutCubic(recoverT));
        if (this.slowMoTimer <= 0) { this.slowMoTimer = 0; this.slowMoDuration = 0; scale = 1; }
      }
      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= realDt;
        scale = 0.02;
      }
    }
    this.timekeeper.timeScale = scale;

    // Decays
    this.flashAmount = Math.max(0, this.flashAmount - realDt * this.flashDecay);
    this.aberration = Math.max(0, this.aberration - realDt * 2.8);
    this.damage = Math.max(0, this.damage - realDt * 2.2);
    this.bloomImpulse = Math.max(0, this.bloomImpulse - realDt * 2.5);
    this.fovImpulse *= Math.exp(-realDt * 7);

    // Sustained blends
    this.boost = damp(this.boost, this.boostTarget, 6, realDt);
    this.warp = damp(this.warp, this.warpTarget, 3.2, realDt);
    this.danger = damp(this.danger, this.dangerTarget, 3, realDt);
    this.saturation = damp(this.saturation, this.saturationTarget, 3, realDt);

    // Camera FOV: base + boost stretch + warp stretch + impulses.
    const fov = BASE_FOV + this.boost * 12 + this.warp * 38 + this.fovImpulse;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    const p = this.params;
    p.aberration = this.aberration + this.boost * 0.35 + this.warp * 1.4;
    p.zoomBlur = Math.min(1.6, this.boost * 0.45 + this.warp * 1.2);
    p.flash = this.flashAmount;
    p.flashColor.copy(this.flashColor);
    p.damage = this.damage;
    p.danger = this.danger;
    p.vignette = 0.32 + this.warp * 0.25;
    p.saturation = this.saturation + this.boost * 0.15;
    p.bloom = 1 + this.bloomImpulse + this.warp * 0.8;
    this.post.apply(p);
  }
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
