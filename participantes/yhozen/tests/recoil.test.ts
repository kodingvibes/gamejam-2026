import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeVector, recoilDelta, velocityAfterRecoil } from '../src/game/recoil';

function closeTo(actual: number[], expected: number[], tolerance = 1e-9): void {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => {
    assert.ok(
      Math.abs(value - expected[index]) <= tolerance,
      `component ${index}: expected ${expected[index]}, received ${value}`,
    );
  });
}

test('normalizes shot direction without changing a zero vector', () => {
  closeTo(normalizeVector([3, 0, 4]), [0.6, 0, 0.8]);
  closeTo(normalizeVector([0, 0, 0]), [0, 0, 0]);
});

test('recoil always points opposite the bullet direction', () => {
  closeTo(recoilDelta([0, 0, -1], 160, 80), [0, 0, 2]);
  closeTo(recoilDelta([0, 0, 1], 160, 80), [0, 0, -2]);
  closeTo(recoilDelta([1, 0, 0], 160, 80), [-2, 0, 0]);
  closeTo(recoilDelta([0, -1, 0], 160, 80), [0, 2, 0]);
});

test('recoil redirects current momentum using impulse divided by mass', () => {
  closeTo(velocityAfterRecoil([0, 0, -8], [0, 0, -1], 160, 80), [0, 0, -6]);
  closeTo(velocityAfterRecoil([0, 0, -8], [0, 0, 1], 160, 80), [0, 0, -10]);
  closeTo(velocityAfterRecoil([0, 0, -8], [1, 0, 0], 160, 80), [-2, 0, -8]);
});
