import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendMarker,
  clearMarkers,
  cloneDoc,
  initialDoc,
  nextMarkerNumber,
  normalizeDoc,
  removeMarker,
  renumberMarkers,
  updateMarker,
} from '../src/core/doc.js';
import { readableTextColor } from '../src/core/render.js';
import type { Marker } from '../src/types.js';

const base = { width: 1000, height: 800 } as unknown as HTMLCanvasElement;

const marker = (patch: Partial<Marker> = {}): Marker => ({
  id: patch.id ?? 'm1',
  x: patch.x ?? 100,
  y: patch.y ?? 100,
  number: patch.number ?? 1,
  color: patch.color ?? '#ef4444',
  size: patch.size ?? 120,
  shape: patch.shape ?? 'circle',
});

test('a fresh document has no markers', () => {
  const doc = initialDoc(base);
  assert.deepEqual(doc.markers, []);
});

test('markers get incrementing numbers', () => {
  let doc = initialDoc(base);
  assert.equal(nextMarkerNumber(doc), 1);
  doc = appendMarker(doc, marker({ id: 'a', number: nextMarkerNumber(doc) }));
  doc = appendMarker(doc, marker({ id: 'b', number: nextMarkerNumber(doc) }));
  assert.equal(nextMarkerNumber(doc), 3);
  assert.deepEqual(doc.markers.map((m) => m.number), [1, 2]);
});

test('updateMarker patches immutably and ignores unknown ids', () => {
  const doc = appendMarker(initialDoc(base), marker({ id: 'a' }));
  const moved = updateMarker(doc, 'a', { x: 400, y: 300 });
  assert.equal(moved.markers[0].x, 400);
  assert.equal(doc.markers[0].x, 100);
  assert.equal(updateMarker(doc, 'missing', { x: 1 }), doc);
});

test('removeMarker and clearMarkers drop badges', () => {
  let doc = appendMarker(appendMarker(initialDoc(base), marker({ id: 'a' })), marker({ id: 'b', number: 2 }));
  doc = removeMarker(doc, 'a');
  assert.deepEqual(doc.markers.map((m) => m.id), ['b']);
  assert.equal(removeMarker(doc, 'nope'), doc);
  const cleared = clearMarkers(doc);
  assert.deepEqual(cleared.markers, []);
  assert.equal(clearMarkers(cleared), cleared, 'clearing an empty list is a no-op');
});

test('renumberMarkers sorts into reading order', () => {
  let doc = initialDoc(base);
  // Deliberately out of order: bottom-right, top-left, top-right.
  doc = appendMarker(doc, marker({ id: 'c', x: 700, y: 600, number: 9 }));
  doc = appendMarker(doc, marker({ id: 'a', x: 100, y: 60, number: 4 }));
  doc = appendMarker(doc, marker({ id: 'b', x: 600, y: 80, number: 7 }));

  const ordered = renumberMarkers(doc);
  const byId = Object.fromEntries(ordered.markers.map((m) => [m.id, m.number]));
  assert.equal(byId.a, 1, 'top-left is number 1');
  assert.equal(byId.b, 2, 'top-right is number 2');
  assert.equal(byId.c, 3, 'the lower row comes last');
});

test('cloneDoc deep copies markers', () => {
  const doc = appendMarker(initialDoc(base), marker({ id: 'a' }));
  const copy = cloneDoc(doc);
  copy.markers[0].x = 999;
  assert.equal(doc.markers[0].x, 100);
});

test('normalizeDoc repairs hostile marker input', () => {
  const doc = normalizeDoc(
    {
      markers: [
        { x: 10, y: 20 } as Marker,
        { id: 'ok', x: 5, y: 5, number: -3, color: 'red', size: 5000, shape: 'triangle' as never },
        { x: Number.NaN, y: 0 } as Marker,
        null as never,
      ],
    },
    800,
    600,
  );
  assert.equal(doc.markers.length, 2, 'entries without finite coordinates are dropped');
  assert.equal(doc.markers[0].number, 1, 'missing numbers are filled in');
  assert.equal(doc.markers[0].shape, 'circle');
  assert.equal(doc.markers[1].number, 1, 'invalid numbers are clamped to >= 1');
  assert.equal(doc.markers[1].size, 2000, 'size is capped');
  assert.equal(doc.markers[1].shape, 'circle', 'unknown shapes fall back to circle');
});

test('documents without markers normalise to an empty list', () => {
  const doc = normalizeDoc({ strokes: [], texts: [] }, 800, 600);
  assert.deepEqual(doc.markers, []);
});

test('readableTextColor picks a contrasting badge colour', () => {
  assert.equal(readableTextColor('#ffffff'), '#101828');
  assert.equal(readableTextColor('#facc15'), '#101828');
  assert.equal(readableTextColor('#ef4444'), '#ffffff');
  assert.equal(readableTextColor('#000'), '#ffffff');
  assert.equal(readableTextColor('#0ea5e9'), '#ffffff');
});
