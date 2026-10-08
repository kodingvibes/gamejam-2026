// ─── Flight Plans: authored attack manoeuvres in rail-local space ───────────
//
// Coordinates are relative to the moving rail frame (the camera's rail point):
//   x = right, y = up, z = distance AHEAD of the rail point.
// The player ship sits near z ≈ 0, the camera at z ≈ −10. Because the frame
// travels with the player, a plan flown in this space always plays out on
// screen — exactly how Star Fox choreographs its enemy squadrons.
//
// A plan is a smooth Catmull-Rom path plus timing windows. The Enemy samples
// it, derives world velocity, and from that its heading, bank and pitch —
// so every curve is flown like an aircraft instead of slid like a sprite.

import * as THREE from 'three';

export type PlanName = 'SWEEP' | 'DIVE_BOMB' | 'CIRCLE' | 'ZIGZAG' | 'DIVE' | 'CRUISE';

export interface FlightPlan {
  curve: THREE.CatmullRomCurve3;
  duration: number;
  /** [start, end] fractions (0..1) where the pilot is allowed to shoot. */
  fireWindows: [number, number][];
  /** Fractions where the pilot performs a scripted barrel roll. */
  rolls: number[];
  /** How hard the pilot points the nose at the player while firing (0..1). */
  aimWeight: number;
  /** Bombers fire a 3-way spread instead of a single-file burst. */
  spread: boolean;
}

export interface PlanSlot {
  side: number;         // ±1, shared by the whole formation
  offset: THREE.Vector3; // formation offset (x right, y up, z further away)
  seed: number;         // 0..1, shared by the formation for coherent variety
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function rand(seed: number, salt: number, min: number, max: number): number {
  const v = Math.sin(seed * 9301 + salt * 49297) * 233280;
  return min + (v - Math.floor(v)) * (max - min);
}

/**
 * Build a manoeuvre. `player` is the player's rail-local position at spawn
 * (attack legs aim there); `speedMul` > 1 flies the plan faster.
 */
export function buildPlan(name: PlanName, slot: PlanSlot, player: THREE.Vector3, speedMul: number): FlightPlan {
  const s = slot.side;
  const k = slot.seed;
  const ax = player.x * 0.8;
  const ay = player.y * 0.8;
  let pts: THREE.Vector3[];
  let duration: number;
  let fireWindows: [number, number][];
  let rolls: number[] = [];
  let aimWeight = 0.75;
  let spread = false;

  switch (name) {
    case 'SWEEP': {
      if (k < 0.5) {
        // Crossing strafe: enter from one flank far ahead, bank across the
        // front of the player while firing, climb out on the other side.
        const h = rand(k, 1, 2, 9);
        pts = [V(-s * 52, h + 6, 80), V(-s * 28, h + 2, 50), V(-s * 8, h - 2, 30),
               V(s * 12, h - 1, 24), V(s * 30, h + 5, 32), V(s * 56, h + 14, 52)];
        duration = 5.4;
        fireWindows = [[0.28, 0.6]];
      } else {
        // Overtake: scream past the camera from behind, pull a hard U-turn
        // ahead of the player and come back head-on before breaking low.
        pts = [V(s * 16, 10, -26), V(s * 10, 6, 0), V(s * 4, 5, 30), V(-s * 4, 4, 62),
               V(-s * 12, 2, 48), V(-s * 10, 0, 22), V(-s * 20, -8, -4), V(-s * 34, -14, -30)];
        duration = 7.8;
        fireWindows = [[0.56, 0.8]];
        rolls = [0.2];
      }
      break;
    }
    case 'DIVE_BOMB': {
      // Appear high, nose over into a steep dive at the player, pull up at the
      // last moment and roar over the canopy.
      const x0 = s * rand(k, 2, 4, 22);
      pts = [V(x0, 36, 100), V(x0 * 0.6, 24, 64), V(ax, ay + 4, 28),
             V(ax * 0.8, ay + 1.5, 10), V(ax * 0.5, ay + 9, -2), V(ax * 0.2, 20, -26)];
      duration = 4.8;
      fireWindows = [[0.3, 0.56]];
      aimWeight = 0.9;
      break;
    }
    case 'CIRCLE': {
      // Vertical loop in front of the player — firing from the top of the loop.
      const c = V(s * rand(k, 3, 4, 14), rand(k, 4, 0, 6), 52);
      const R = 10;
      pts = [V(c.x - s * 44, c.y + 8, 78), V(c.x - s * 16, c.y - R + 2, 58)];
      for (let i = 0; i <= 8; i++) {
        const th = -Math.PI / 2 + (i / 8) * Math.PI * 2;
        pts.push(V(c.x + s * (i - 4) * 1.4, c.y + R * Math.sin(th), c.z - R * Math.cos(th)));
      }
      pts.push(V(c.x + s * 22, c.y - 2, 46), V(c.x + s * 50, c.y + 10, 70));
      duration = 7.2;
      fireWindows = [[0.42, 0.62]];
      aimWeight = 0.6;
      break;
    }
    case 'ZIGZAG': {
      // Jinking approach: snap-rolling S-turns, two bursts, then a hard break.
      pts = [V(s * 4, 8, 110)];
      const xs = [14, -11, 12, -8, 6];
      const ys = [5, -3, 4, -2, 2];
      for (let i = 0; i < xs.length; i++) pts.push(V(ax + s * xs[i], ay + ys[i], 92 - i * 17));
      pts.push(V(s * 26, 14, -6), V(s * 40, 20, -30));
      duration = 5.8;
      fireWindows = [[0.3, 0.44], [0.58, 0.7]];
      rolls = [0.22, 0.5];
      break;
    }
    case 'DIVE': {
      // Head-on joust: charge straight down the lane firing, barrel roll out.
      const x = s * rand(k, 5, 2, 16);
      const y = rand(k, 6, -2, 8);
      pts = [V(x, y, 120), V(x * 0.7, y * 0.7, 74), V(ax, ay, 32), V(ax + s * 3, ay + 2, 14),
             V(s * 14, 10, 4), V(s * 30, 18, -24)];
      duration = 4.4;
      fireWindows = [[0.28, 0.62]];
      rolls = [0.72];
      aimWeight = 0.95;
      break;
    }
    case 'CRUISE':
    default: {
      // Heavy bomber: lumbers across the horizon pumping spread volleys.
      const h = rand(k, 7, 6, 14);
      pts = [V(-s * 60, h + 4, 70), V(-s * 26, h, 60), V(0, h - 1, 56), V(s * 26, h, 60), V(s * 62, h + 8, 72)];
      duration = 12;
      fireWindows = [[0.18, 0.82]];
      aimWeight = 0.35;
      spread = true;
      break;
    }
  }

  for (const p of pts) p.add(slot.offset);
  return {
    curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'),
    duration: duration / speedMul,
    fireWindows, rolls, aimWeight, spread,
  };
}
