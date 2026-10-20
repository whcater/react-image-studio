import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_ZOOM,
  MIN_ZOOM,
  centeredAspectRect,
  clampRectToBounds,
  clampView,
  clampZoom,
  fitView,
  handlePositions,
  hitTestCrop,
  imageToScreen,
  rectFromPoints,
  resizeCropRect,
  rotatedSize,
  screenToImage,
  zoomAt,
} from '../src/core/geometry.js';
import type { Rect } from '../src/types.js';

const bounds = { width: 1000, height: 800 };

test('rectFromPoints normalises any drag direction', () => {
  assert.deepEqual(rectFromPoints({ x: 20, y: 30 }, { x: 60, y: 10 }), { x: 20, y: 10, width: 40, height: 20 });
  assert.deepEqual(rectFromPoints({ x: 60, y: 10 }, { x: 20, y: 30 }), { x: 20, y: 10, width: 40, height: 20 });
});

test('clampRectToBounds shifts without resizing', () => {
  const rect: Rect = { x: -50, y: 700, width: 200, height: 200 };
  assert.deepEqual(clampRectToBounds(rect, bounds), { x: 0, y: 600, width: 200, height: 200 });
});

test('resizeCropRect moves a single handle only', () => {
  const rect: Rect = { x: 100, y: 100, width: 400, height: 300 };
  const resized = resizeCropRect(rect, 'se', 50, 40, { bounds });
  assert.deepEqual(resized, { x: 100, y: 100, width: 450, height: 340 });
});

test('resizeCropRect never escapes the image bounds', () => {
  const rect: Rect = { x: 700, y: 600, width: 300, height: 200 };
  const resized = resizeCropRect(rect, 'se', 500, 500, { bounds });
  assert.equal(resized.x + resized.width, bounds.width);
  assert.equal(resized.y + resized.height, bounds.height);
});

test('resizeCropRect enforces the minimum size', () => {
  const rect: Rect = { x: 100, y: 100, width: 200, height: 200 };
  const resized = resizeCropRect(rect, 'se', -500, -500, { bounds, minSize: 32 });
  assert.ok(resized.width >= 32, `width ${resized.width}`);
  assert.ok(resized.height >= 32, `height ${resized.height}`);
});

test('corner drags keep the requested aspect ratio', () => {
  const rect: Rect = { x: 0, y: 0, width: 400, height: 400 };
  const resized = resizeCropRect(rect, 'se', 100, 0, { bounds, aspect: 1 });
  assert.equal(resized.width, 500);
  assert.equal(resized.height, 500);
  assert.equal(resized.x, 0);
  assert.equal(resized.y, 0);
});

test('aspect ratio shrinks to fit when it would overflow', () => {
  const rect: Rect = { x: 0, y: 0, width: 500, height: 500 };
  const resized = resizeCropRect(rect, 'se', 4000, 4000, { bounds, aspect: 1 });
  assert.ok(resized.width <= bounds.width);
  assert.ok(resized.height <= bounds.height);
  assert.equal(resized.width, resized.height);
});

test('hitTestCrop resolves handles, the body and empty space', () => {
  const rect: Rect = { x: 100, y: 100, width: 200, height: 200 };
  assert.equal(hitTestCrop(rect, { x: 100, y: 100 }, 10).handle, 'nw');
  assert.equal(hitTestCrop(rect, { x: 300, y: 300 }, 10).handle, 'se');
  assert.equal(hitTestCrop(rect, { x: 200, y: 100 }, 10).handle, 'n');
  assert.equal(hitTestCrop(rect, { x: 300, y: 200 }, 10).handle, 'e');
  assert.equal(hitTestCrop(rect, { x: 200, y: 200 }, 10).handle, 'move');
  assert.equal(hitTestCrop(rect, { x: 900, y: 700 }, 10).handle, null);
});

test('handlePositions maps the eight handles', () => {
  const positions = handlePositions({ x: 0, y: 0, width: 100, height: 50 });
  assert.deepEqual(positions.nw, { x: 0, y: 0 });
  assert.deepEqual(positions.se, { x: 100, y: 50 });
  assert.deepEqual(positions.n, { x: 50, y: 0 });
  assert.deepEqual(positions.w, { x: 0, y: 25 });
});

test('centeredAspectRect spans the limiting dimension', () => {
  // 1000x800: a square crop is limited by the height.
  assert.deepEqual(centeredAspectRect({ width: 1000, height: 800 }, 1), {
    x: 100,
    y: 0,
    width: 800,
    height: 800,
  });
  // 16:9 on 1000x800 is limited by the width.
  const wide = centeredAspectRect({ width: 1000, height: 800 }, 16 / 9);
  assert.equal(wide.width, 1000);
  assert.equal(wide.height, Math.floor(1000 / (16 / 9)));
  // "free" covers the whole image.
  assert.deepEqual(centeredAspectRect({ width: 1000, height: 800 }, null), {
    x: 0,
    y: 0,
    width: 1000,
    height: 800,
  });
});

test('fitView centres the image and never upscales by default', () => {
  const view = fitView({ width: 400, height: 200 }, { width: 800, height: 600 });
  assert.deepEqual(view, { scale: 1, x: 200, y: 200 });

  const scaled = fitView({ width: 4000, height: 2000 }, { width: 800, height: 600 });
  assert.equal(scaled.scale, 0.2);
  assert.equal(scaled.x, 0);
  assert.equal(scaled.y, 100);
});

test('fitView can be allowed to upscale', () => {
  const view = fitView({ width: 100, height: 100 }, { width: 400, height: 400 }, true);
  assert.equal(view.scale, 4);
  assert.equal(view.x, 0);
});

test('zoomAt keeps the focal point anchored', () => {
  const view = { scale: 1, x: 0, y: 0 };
  const focal = { x: 100, y: 200 };
  const before = screenToImage(focal, view);
  const zoomed = zoomAt(view, 2, focal);
  const after = screenToImage(focal, zoomed);
  assert.equal(zoomed.scale, 2);
  assert.ok(Math.abs(before.x - after.x) < 1e-9);
  assert.ok(Math.abs(before.y - after.y) < 1e-9);
});

test('screenToImage and imageToScreen are inverses', () => {
  const view = { scale: 2.5, x: -40, y: 12 };
  const point = { x: 137, y: 89 };
  const back = imageToScreen(screenToImage(point, view), view);
  assert.ok(Math.abs(back.x - point.x) < 1e-9);
  assert.ok(Math.abs(back.y - point.y) < 1e-9);
});

test('zoom is clamped to the supported range', () => {
  assert.equal(clampZoom(1000), MAX_ZOOM);
  assert.equal(clampZoom(0.0001), MIN_ZOOM);
  assert.equal(zoomAt({ scale: 1, x: 0, y: 0 }, 1000, { x: 0, y: 0 }).scale, MAX_ZOOM);
});

test('clampView keeps part of the image visible', () => {
  const view = { scale: 1, x: 5000, y: 5000 };
  const clamped = clampView(view, { width: 400, height: 200 }, { width: 800, height: 600 });
  assert.ok(clamped.x < 800);
  assert.ok(clamped.y < 600);
});

test('rotatedSize swaps dimensions for quarter turns', () => {
  assert.deepEqual(rotatedSize({ width: 400, height: 200 }, 90), { width: 200, height: 400 });
  assert.deepEqual(rotatedSize({ width: 400, height: 200 }, 180), { width: 400, height: 200 });
  assert.deepEqual(rotatedSize({ width: 400, height: 200 }, 270), { width: 200, height: 400 });
  assert.deepEqual(rotatedSize({ width: 400, height: 200 }, -90), { width: 200, height: 400 });
});
