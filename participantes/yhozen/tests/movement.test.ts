import assert from 'node:assert/strict';
import test from 'node:test';
import { headingTowardCenter, isOutOfBounds, planarBrakingImpulse } from '../src/game/movement';

test('all four spawn headings point toward the arena center', () => {
  const spawns = [
    [-12, 2.5, -12],
    [12, 2.5, 12],
    [-12, 2.5, 12],
    [12, 2.5, -12],
  ] as const;

  for (const spawn of spawns) {
    const heading = headingTowardCenter(spawn);
    const forward = [-Math.sin(heading), -Math.cos(heading)];
    const towardCenter = [-spawn[0], -spawn[2]];
    assert.ok(forward[0] * towardCenter[0] + forward[1] * towardCenter[1] > 0);
  }
});

test('out-of-bounds safety catches falls and escaped riders', () => {
  assert.equal(isOutOfBounds([0, 0, 0]), false);
  assert.equal(isOutOfBounds([23, 0, 0]), true);
  assert.equal(isOutOfBounds([0, -4.1, 0]), true);
  assert.equal(isOutOfBounds([0, 0, -23]), true);
});

test('braking impulse is frame-rate independent and cannot reverse velocity', () => {
  const impulse = planarBrakingImpulse([3, 4, -4], 1_200, 80, 0.05);
  assert.deepEqual(impulse, [-36, 0, 48]);
  assert.equal(Math.hypot(impulse[0], impulse[2]), 60);
  const stoppingImpulse = planarBrakingImpulse([0.03, 2, 0.04], 1_200, 80, 1);
  assert.ok(Math.abs(stoppingImpulse[0] + 2.4) < 1e-9);
  assert.equal(stoppingImpulse[1], 0);
  assert.ok(Math.abs(stoppingImpulse[2] + 3.2) < 1e-9);
  assert.deepEqual(planarBrakingImpulse([0, 2, 0], 1_200, 80, 0.05), [0, 0, 0]);
});
