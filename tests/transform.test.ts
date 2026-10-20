import test from 'node:test';
import assert from 'node:assert/strict';

import {
  flipOverlays,
  offsetOverlays,
  rotateOverlays,
} from '../src/core/transform.js';

test('rotateOverlays maps points clockwise around the new origin', () => {
  const size = { width: 400, height: 200 };
  const rotated = rotateOverlays({ points: [{ x: 10, y: 20 }], texts: [] }, 90, size);
  // 90° clockwise: (x, y) -> (H - y, x)
  assert.deepEqual(rotated.points[0], { x: 180, y: 10 });
});

test('rotateOverlays handles half turns', () => {
  const size = { width: 400, height: 200 };
  const rotated = rotateOverlays({ points: [{ x: 10, y: 20 }], texts: [] }, 180, size);
  assert.deepEqual(rotated.points[0], { x: 390, y: 180 });
});

test('rotateOverlays turns text rotation with the point', () => {
  const size = { width: 400, height: 200 };
  const rotated = rotateOverlays({ points: [], texts: [{ x: 10, y: 20, rotation: 15 }] }, 90, size);
  assert.equal(rotated.texts[0].rotation, 105);
  assert.deepEqual({ x: rotated.texts[0].x, y: rotated.texts[0].y }, { x: 180, y: 10 });
});

test('a rotation of 0 is the identity', () => {
  const overlays = { points: [{ x: 5, y: 7 }], texts: [{ x: 1, y: 2, rotation: 3 }] };
  const mapped = rotateOverlays(overlays, 360, { width: 100, height: 100 });
  assert.deepEqual(mapped.points, overlays.points);
  assert.deepEqual(mapped.texts, overlays.texts);
});

test('flipOverlays mirrors on the requested axis', () => {
  const size = { width: 400, height: 200 };
  assert.deepEqual(flipOverlays([{ x: 10, y: 20 }], 'horizontal', size), [{ x: 390, y: 20 }]);
  assert.deepEqual(flipOverlays([{ x: 10, y: 20 }], 'vertical', size), [{ x: 10, y: 180 }]);
});

test('offsetOverlays translates after a crop', () => {
  assert.deepEqual(offsetOverlays([{ x: 10, y: 20 }, { x: 0, y: 0 }], 4, 6), [
    { x: 6, y: 14 },
    { x: -4, y: -6 },
  ]);
});

test('overlay helpers do not mutate their inputs', () => {
  const points = [{ x: 10, y: 20 }];
  flipOverlays(points, 'horizontal', { width: 100, height: 100 });
  offsetOverlays(points, 5, 5);
  assert.deepEqual(points, [{ x: 10, y: 20 }]);
});
