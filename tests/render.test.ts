import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeCanvas, installFakeDom, resetCanvasSequence } from './helpers/fake-canvas.js';

// The render pipeline needs `document.createElement('canvas')`; install the
// recording stand-in before importing anything that touches it at call time.
const dom = installFakeDom();

const { neutralAdjustments } = await import('../src/core/filters.js');
const { renderDoc, renderThumbnail, previewScaleFor, supportsContextFilter, resetFilterSupportCache } =
  await import('../src/core/render.js');
const { rotateCanvas, flipCanvas, cropCanvas } = await import('../src/core/transform.js');

import type { PixelDoc } from '../src/core/render.js';
import type { Stroke, TextItem } from '../src/types.js';

const makeBase = (width = 100, height = 50): HTMLCanvasElement => {
  resetCanvasSequence();
  const canvas = new FakeCanvas(width, height);
  dom.canvases.push(canvas);
  return canvas as unknown as HTMLCanvasElement;
};

const neutralDoc = (): PixelDoc => ({ adjust: neutralAdjustments(), strokes: [], texts: [] });

const stroke: Stroke = {
  id: 's1',
  points: [
    { x: 5, y: 5 },
    { x: 40, y: 30 },
  ],
  color: '#ff0000',
  size: 6,
  opacity: 100,
  erase: false,
};

const eraseStroke: Stroke = { ...stroke, id: 's2', erase: true };

const textItem: TextItem = {
  id: 't1',
  text: 'Hello',
  x: 10,
  y: 10,
  size: 20,
  color: '#ffffff',
  fontFamily: 'sans-serif',
  bold: true,
  italic: false,
  align: 'left',
  rotation: 0,
  opacity: 100,
};

const findCalls = (canvas: HTMLCanvasElement, op: string) =>
  (canvas as unknown as FakeCanvas).ctx.calls.filter((call) => call.op === op);

test('a neutral document is a single unstyled blit', () => {
  const base = makeBase();
  const out = renderDoc(base, neutralDoc());
  assert.equal(out.width, 100);
  assert.equal(out.height, 50);
  const drawCalls = findCalls(out, 'drawImage');
  assert.equal(drawCalls.length, 1);
  assert.equal(drawCalls[0].args[0], base);
  assert.equal(drawCalls[0].args.at(-1), 'none', 'no CSS filter should be applied');
});

test('adjustments are applied as a CSS filter through an intermediate canvas', () => {
  const base = makeBase();
  const doc = { ...neutralDoc(), adjust: { ...neutralAdjustments(), brightness: 120 } };
  const out = renderDoc(base, doc);
  const drawCalls = findCalls(out, 'drawImage');
  assert.equal(drawCalls.length, 1);
  const stage = drawCalls[0].args[0] as HTMLCanvasElement;
  assert.notEqual(stage, base, 'the composition happens on an intermediate canvas');
  assert.equal(drawCalls[0].args.at(-1), 'brightness(120%)');
});

test('strokes are painted on their own layer so the eraser only removes paint', () => {
  const base = makeBase();
  const paintOut = renderDoc(base, { ...neutralDoc(), strokes: [stroke] });
  const strokeCalls = dom.canvases.flatMap((canvas) => findCalls(canvas as unknown as HTMLCanvasElement, 'stroke'));
  assert.ok(strokeCalls.length >= 1, 'at least one stroke should be painted');
  assert.equal(strokeCalls[0].args[2], 'source-over');
  assert.equal(strokeCalls[0].args[0], 6, 'line width comes from the stroke');

  const eraseOut = renderDoc(base, { ...neutralDoc(), strokes: [eraseStroke] });
  const eraseCalls = dom.canvases.flatMap((canvas) => findCalls(canvas as unknown as HTMLCanvasElement, 'stroke'));
  assert.equal(eraseCalls.at(-1)?.args[2], 'destination-out');
  assert.notEqual(paintOut, eraseOut);
});

test('text layers are drawn with the configured font and colour', () => {
  const base = makeBase();
  const out = renderDoc(base, { ...neutralDoc(), texts: [textItem] });
  const textCalls = findCalls(out, 'fillText');
  assert.equal(textCalls.length, 1);
  assert.equal(textCalls[0].args[0], 'Hello');
});

test('warmth paints a soft-light wash over the composition', () => {
  const base = makeBase();
  const doc = { ...neutralDoc(), adjust: { ...neutralAdjustments(), warmth: 60 } };
  const out = renderDoc(base, doc);
  const fills = findCalls(out, 'fillRect');
  assert.equal(fills.length, 1);
  assert.equal(fills[0].args.at(-1), 'soft-light');
});

test('preview scale shrinks the output without touching the layers', () => {
  const base = makeBase(200, 100);
  const out = renderDoc(base, { ...neutralDoc(), texts: [textItem] }, { scale: 0.5 });
  assert.equal(out.width, 100);
  assert.equal(out.height, 50);
  assert.equal(previewScaleFor({ width: 200, height: 100 }), 1);
  assert.ok(previewScaleFor({ width: 8000, height: 4000 }) < 0.5);
});

test('renderThumbnail returns a data URL', () => {
  const base = makeBase();
  const url = renderThumbnail(base, neutralDoc(), 48);
  assert.ok(url.startsWith('data:image/png'));
});

test('context filter support is detected once and cached', () => {
  resetFilterSupportCache();
  assert.equal(supportsContextFilter(), true);
  assert.equal(supportsContextFilter(), true);
});

test('rotateCanvas swaps the dimensions for quarter turns', () => {
  const base = makeBase(120, 40);
  const rotated = rotateCanvas(base, 90);
  assert.equal(rotated.width, 40);
  assert.equal(rotated.height, 120);
  const rotatedTwice = rotateCanvas(base, 180);
  assert.equal(rotatedTwice.width, 120);
  assert.equal(rotatedTwice.height, 40);
  assert.equal(rotateCanvas(base, 0), base);
});

test('flipCanvas keeps the size', () => {
  const base = makeBase(120, 40);
  const flipped = flipCanvas(base, 'horizontal');
  assert.equal(flipped.width, 120);
  assert.equal(flipped.height, 40);
  const ops = findCalls(flipped, 'scale');
  assert.deepEqual(ops[0].args, [-1, 1]);
});

test('cropCanvas slices the requested rectangle', () => {
  const base = makeBase(200, 100);
  const cropped = cropCanvas(base, { x: 10.6, y: 20.2, width: 50.4, height: 30.7 });
  assert.equal(cropped.width, 50);
  assert.equal(cropped.height, 31);
  const drawCalls = findCalls(cropped, 'drawImage');
  assert.deepEqual(drawCalls[0].args.slice(1, 9), [11, 20, 50, 31, 0, 0, 50, 31]);
});

test('cropping the full frame returns the original canvas', () => {
  const base = makeBase(200, 100);
  assert.equal(cropCanvas(base, { x: 0, y: 0, width: 200, height: 100 }), base);
});
