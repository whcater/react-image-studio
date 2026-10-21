import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendStroke,
  clearStrokes,
  cloneDoc,
  createId,
  initialDoc,
  isPristine,
  normalizeDoc,
  pixelDocOf,
  removeText,
  updateText,
  upsertText,
  withAdjust,
  withAdjustments,
} from '../src/core/doc.js';
import { neutralAdjustments } from '../src/core/filters.js';
import type { Stroke, TextItem } from '../src/types.js';

const base = { width: 800, height: 600 } as unknown as HTMLCanvasElement;

const stroke: Stroke = {
  id: 'stroke-1',
  points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
  color: '#ff0000',
  size: 8,
  opacity: 100,
  erase: false,
};

const text: TextItem = {
  id: 'text-1',
  text: 'hello',
  x: 10,
  y: 20,
  size: 32,
  color: '#fff',
  fontFamily: 'sans-serif',
  bold: false,
  italic: false,
  align: 'left',
  rotation: 0,
  opacity: 100,
};

test('initialDoc mirrors the committed bitmap size and is pristine', () => {
  const doc = initialDoc(base);
  assert.equal(doc.width, 800);
  assert.equal(doc.height, 600);
  assert.deepEqual(doc.adjust, neutralAdjustments());
  assert.equal(doc.strokes.length, 0);
  assert.equal(doc.texts.length, 0);
  assert.equal(isPristine(doc), true);
});

test('withAdjust is immutable and clears the preset', () => {
  const doc = initialDoc(base);
  const next = withAdjust({ ...doc, preset: 'vivid' }, 'brightness', 120);
  assert.equal(next.adjust.brightness, 120);
  assert.equal(next.preset, null);
  assert.equal(doc.adjust.brightness, 100);
});

test('withAdjustments stores the preset id', () => {
  const doc = initialDoc(base);
  const next = withAdjustments(doc, neutralAdjustments(), 'vivid');
  assert.equal(next.preset, 'vivid');
  assert.equal(isPristine(next), false);
});

test('strokes and text layers are immutable collections', () => {
  const doc = initialDoc(base);
  const withStroke = appendStroke(doc, stroke);
  assert.equal(withStroke.strokes.length, 1);
  assert.equal(doc.strokes.length, 0);

  const cleared = clearStrokes(withStroke);
  assert.equal(cleared.strokes.length, 0);
  assert.equal(clearStrokes(cleared), cleared, 'clearing an empty list is a no-op');

  const withText = upsertText(doc, text);
  assert.equal(withText.texts.length, 1);

  const moved = updateText(withText, text.id, { x: 99 });
  assert.equal(moved.texts[0].x, 99);
  assert.equal(withText.texts[0].x, 10);

  const removed = removeText(moved, text.id);
  assert.equal(removed.texts.length, 0);
  assert.equal(removeText(removed, 'nope'), removed);
});

test('pixelDocOf exposes only the pixel-affecting layers', () => {
  const doc = appendStroke(initialDoc(base), stroke);
  const pixel = pixelDocOf(doc);
  assert.deepEqual(Object.keys(pixel).sort(), ['adjust', 'markers', 'strokes', 'texts']);
});

test('cloneDoc deep copies strokes and text', () => {
  const doc = appendStroke(upsertText(initialDoc(base), text), stroke);
  const copy = cloneDoc(doc);
  copy.strokes[0].points[0].x = 500;
  copy.texts[0].text = 'changed';
  assert.equal(doc.strokes[0].points[0].x, 1);
  assert.equal(doc.texts[0].text, 'hello');
});

test('normalizeDoc repairs hostile input', () => {
  const doc = normalizeDoc(
    {
      width: 1,
      height: 1,
      adjust: { brightness: 500 } as never,
      strokes: [
        { id: 'ok', points: [{ x: 1, y: 1 }], color: '#000', size: 3, opacity: 50, erase: false },
        { points: [] } as never,
        null as never,
      ],
      texts: [{ text: 'hi' } as never, { nope: true } as never],
      preset: 42 as never,
    },
    800,
    600,
  );
  assert.equal(doc.width, 800);
  assert.equal(doc.height, 600);
  assert.equal(doc.adjust.brightness, 200, 'out of range values are clamped');
  assert.equal(doc.strokes.length, 1);
  assert.equal(doc.texts.length, 1);
  assert.equal(doc.texts[0].size, 32);
  assert.equal(doc.preset, null);
});

test('createId is unique', () => {
  const ids = new Set(Array.from({ length: 500 }, () => createId('x')));
  assert.equal(ids.size, 500);
});
