import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeCanvas, installFakeDom } from './helpers/fake-canvas.js';
import {
  canvasToBlob,
  extensionFor,
  flattenOnBackground,
  formatBytes,
  getSourceSize,
  mimeFor,
  sanitizeFilename,
  supportsFormat,
  withExtension,
} from '../src/core/image.js';

installFakeDom();

test('sanitizeFilename strips directories and illegal characters', () => {
  assert.equal(sanitizeFilename('/tmp/my photo?.png'), 'my-photo-.png');
  assert.equal(sanitizeFilename('a/b/c.jpg'), 'c.jpg');
  assert.equal(sanitizeFilename('   '), 'edited-image');
  assert.equal(sanitizeFilename('---x---'), 'x');
});

test('withExtension swaps the extension for the export format', () => {
  assert.equal(withExtension('holiday.jpg', 'png'), 'holiday.png');
  assert.equal(withExtension('holiday', 'jpeg'), 'holiday.jpg');
  assert.equal(withExtension('my photo', 'webp'), 'my-photo.webp');
});

test('format mapping is exhaustive', () => {
  assert.equal(mimeFor('png'), 'image/png');
  assert.equal(mimeFor('jpeg'), 'image/jpeg');
  assert.equal(mimeFor('webp'), 'image/webp');
  assert.equal(extensionFor('jpeg'), 'jpg');
});

test('formatBytes is human readable', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5 MB');
});

test('canvasToBlob forwards the mime type and quality', async () => {
  const canvas = new FakeCanvas(10, 10) as unknown as HTMLCanvasElement;
  const blob = await canvasToBlob(canvas, 'jpeg', 0.7);
  assert.equal(blob.type, 'image/jpeg');
  const recorded = (canvas as unknown as FakeCanvas).toBlobs[0];
  assert.equal(recorded.type, 'image/jpeg');
  assert.equal(recorded.quality, 0.7);
});

test('canvasToBlob clamps the quality', async () => {
  const canvas = new FakeCanvas(10, 10) as unknown as HTMLCanvasElement;
  await canvasToBlob(canvas, 'webp', 5);
  assert.equal((canvas as unknown as FakeCanvas).toBlobs[0].quality, 1);
  await canvasToBlob(canvas, 'webp', -3);
  assert.equal((canvas as unknown as FakeCanvas).toBlobs[1].quality, 0);
});

test('flattenOnBackground fills the canvas before drawing', () => {
  const canvas = new FakeCanvas(40, 20) as unknown as HTMLCanvasElement;
  const flattened = flattenOnBackground(canvas, '#000000');
  assert.equal(flattened.width, 40);
  assert.equal(flattened.height, 20);
  const ops = (flattened as unknown as FakeCanvas).ctx.ops();
  assert.equal(ops[0], 'fillRect');
  assert.equal(ops[1], 'drawImage');
});

test('getSourceSize prefers natural dimensions', () => {
  assert.deepEqual(getSourceSize({ naturalWidth: 800, naturalHeight: 600 } as never), {
    width: 800,
    height: 600,
  });
  assert.deepEqual(getSourceSize({ width: 100, height: 50 } as never), { width: 100, height: 50 });
});

test('supportsFormat reports true when the browser encodes the mime type', () => {
  assert.equal(supportsFormat('png'), true);
});
