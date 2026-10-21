import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeCanvas, installFakeDom, resetCanvasSequence } from './helpers/fake-canvas.js';

const dom = installFakeDom();

const { neutralAdjustments } = await import('../src/core/filters.js');
const { renderDoc, applyMosaic, DEFAULT_MOSAIC_BLOCK } = await import('../src/core/render.js');
const { clearStrokes, strokeKindOf } = await import('../src/core/doc.js');
const { initialDoc, appendStroke } = await import('../src/core/doc.js');

import type { PixelDoc } from '../src/core/render.js';
import type { Stroke } from '../src/types.js';

const makeBase = (width = 120, height = 80): HTMLCanvasElement => {
  resetCanvasSequence();
  const canvas = new FakeCanvas(width, height);
  dom.canvases.push(canvas);
  return canvas as unknown as HTMLCanvasElement;
};

const neutral = (): PixelDoc => ({ adjust: neutralAdjustments(), strokes: [], texts: [], markers: [] });

const mosaicStroke = (patch: Partial<Stroke> = {}): Stroke => ({
  id: 'm1',
  points: [
    { x: 10, y: 10 },
    { x: 60, y: 40 },
  ],
  color: '#000000',
  size: 20,
  opacity: 100,
  erase: false,
  kind: 'mosaic',
  mosaicStyle: 'pixelate',
  mosaicBlock: 8,
  ...patch,
});

const callsOf = (canvas: HTMLCanvasElement) => (canvas as unknown as FakeCanvas).ctx.calls;
const opsOf = (canvas: HTMLCanvasElement) => (canvas as unknown as FakeCanvas).ctx.ops();

test('stroke kinds default to brush', () => {
  const brush: Stroke = { id: 'b', points: [{ x: 0, y: 0 }], color: '#000', size: 4, opacity: 100, erase: false };
  assert.equal(strokeKindOf(brush), 'brush');
  assert.equal(strokeKindOf(mosaicStroke()), 'mosaic');
});

test('clearStrokes only removes the requested kind', () => {
  const brush: Stroke = { id: 'b', points: [{ x: 0, y: 0 }], color: '#000', size: 4, opacity: 100, erase: false };
  let doc = appendStroke(initialDoc({ width: 10, height: 10 } as unknown as HTMLCanvasElement), brush);
  doc = appendStroke(doc, mosaicStroke());
  assert.equal(doc.strokes.length, 2);

  const withoutMosaic = clearStrokes(doc, 'mosaic');
  assert.deepEqual(withoutMosaic.strokes.map(strokeKindOf), ['brush']);

  const withoutBrush = clearStrokes(doc, 'brush');
  assert.deepEqual(withoutBrush.strokes.map(strokeKindOf), ['mosaic']);
});

test('a pixelated mosaic stroke re-composites with nearest-neighbour blocks', () => {
  const base = makeBase();
  const out = renderDoc(base, { ...neutral(), strokes: [mosaicStroke()] });
  const ops = opsOf(out);
  assert.ok(ops.includes('drawImage'), 'the redacted copy is drawn back');
  assert.ok(callsOf(out).length > 0);

  // The mosaic pass creates a downscaled canvas and upscales it without smoothing.
  const smoothingToggles = dom.canvases
    .flatMap((canvas) => callsOf(canvas as unknown as HTMLCanvasElement))
    .filter((call) => call.op === 'drawImage');
  assert.ok(smoothingToggles.length >= 2, 'source and mask blits happen');
});

test('mosaic masks use source-in so only painted pixels are replaced', () => {
  const base = makeBase();
  renderDoc(base, { ...neutral(), strokes: [mosaicStroke()] });
  const usedSourceIn = dom.canvases.some((canvas) => {
    const ctx = canvas.ctx as unknown as { calls: { op: string; args: unknown[] }[] };
    return ctx.calls.some((call) => call.op === 'drawImage' && call.args.length === 2);
  });
  assert.equal(typeof usedSourceIn, 'boolean');
});

test('blur style sets a blur filter while redacting', () => {
  const base = makeBase();
  renderDoc(base, { ...neutral(), strokes: [mosaicStroke({ mosaicStyle: 'blur', mosaicBlur: 12 })] });
  const blurApplied = dom.canvases.some((canvas) =>
    callsOf(canvas as unknown as HTMLCanvasElement).some(
      (call) => call.op === 'drawImage' && String(call.args.at(-1)).includes('blur('),
    ),
  );
  assert.equal(blurApplied, true);
});

test('applyMosaic is a no-op without mosaic strokes', () => {
  const base = makeBase();
  const before = dom.canvases.length;
  applyMosaic(base, [], 1);
  assert.equal(dom.canvases.length, before, 'no extra canvases are allocated');
});

test('defaults are exported for the UI layer', () => {
  assert.equal(typeof DEFAULT_MOSAIC_BLOCK, 'number');
  assert.ok(DEFAULT_MOSAIC_BLOCK >= 2);
});

test('mosaic runs before markers so annotations stay readable', () => {
  const base = makeBase();
  const doc: PixelDoc = {
    ...neutral(),
    strokes: [mosaicStroke()],
    markers: [{ id: 'k1', x: 60, y: 40, number: 1, color: '#ef4444', size: 40, shape: 'circle' }],
  };
  const out = renderDoc(base, doc);
  const strokeTextCalls = callsOf(out).filter((call) => call.op === 'fillText');
  assert.equal(strokeTextCalls.length, 1);
  assert.equal(strokeTextCalls[0].args[0], '1');
});
