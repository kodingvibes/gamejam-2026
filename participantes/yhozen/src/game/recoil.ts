import type { Vec3 } from '../shared/protocol';

export function normalizeVector(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector);
  if (length === 0) return [0, 0, 0];
  return vector.map((component) => component / length) as Vec3;
}

export function recoilDelta(direction: Vec3, impulse: number, mass: number): Vec3 {
  const normalized = normalizeVector(direction);
  const velocityChange = impulse / mass;
  return normalized.map((component) => -component * velocityChange) as Vec3;
}

export function velocityAfterRecoil(
  velocity: Vec3,
  direction: Vec3,
  impulse: number,
  mass: number,
): Vec3 {
  const delta = recoilDelta(direction, impulse, mass);
  return velocity.map((component, index) => component + delta[index]) as Vec3;
}
