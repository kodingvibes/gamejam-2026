import type { Vec3 } from '../shared/protocol';

export function headingTowardCenter(spawn: readonly [number, number, number]): number {
  return Math.atan2(spawn[0], spawn[2]);
}

export function isOutOfBounds(position: Vec3): boolean {
  return position[1] < -4 || Math.abs(position[0]) > 22 || Math.abs(position[2]) > 22;
}

export function planarBrakingImpulse(
  velocity: Vec3,
  force: number,
  mass: number,
  deltaSeconds: number,
): Vec3 {
  const speed = Math.hypot(velocity[0], velocity[2]);
  if (speed < 0.01 || force <= 0 || mass <= 0 || deltaSeconds <= 0) return [0, 0, 0];
  const impulse = Math.min(force * deltaSeconds, speed * mass);
  return [-(velocity[0] / speed) * impulse, 0, -(velocity[2] / speed) * impulse];
}
