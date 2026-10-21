import type { Adjustments, AdjustKey, EditorDoc, Marker, MarkerShape, Stroke, StrokeKind, TextItem } from '../types.js';
import { neutralAdjustments, sanitizeAdjustments } from './filters.js';
import type { PixelDoc } from './render.js';

let idCounter = 0;

/** Small, dependency free unique id. */
export function createId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function initialDoc(base: HTMLCanvasElement): EditorDoc {
  return {
    width: base.width,
    height: base.height,
    adjust: neutralAdjustments(),
    strokes: [],
    texts: [],
    markers: [],
    preset: null,
    rotation: 0,
    flipH: false,
    flipV: false,
  };
}

/** The subset of the document that affects pixels. */
export function pixelDocOf(doc: EditorDoc): PixelDoc {
  return { adjust: doc.adjust, strokes: doc.strokes, texts: doc.texts, markers: doc.markers };
}

export function withAdjust(doc: EditorDoc, key: AdjustKey, value: number): EditorDoc {
  return { ...doc, preset: null, adjust: { ...doc.adjust, [key]: value } };
}

export function withAdjustments(doc: EditorDoc, adjust: Adjustments, preset: string | null = null): EditorDoc {
  return { ...doc, preset, adjust };
}

export function appendStroke(doc: EditorDoc, stroke: Stroke): EditorDoc {
  return { ...doc, strokes: [...doc.strokes, stroke] };
}

/** `'brush'` and `'mosaic'` strokes share one list but behave differently. */
export const strokeKindOf = (stroke: Stroke): StrokeKind => stroke.kind ?? 'brush';

/** Remove every stroke of the given kind (brush painting or mosaic redaction). */
export function clearStrokes(doc: EditorDoc, kind: StrokeKind = 'brush'): EditorDoc {
  const strokes = doc.strokes.filter((stroke) => strokeKindOf(stroke) !== kind);
  if (strokes.length === doc.strokes.length) return doc;
  return { ...doc, strokes };
}

export function upsertText(doc: EditorDoc, item: TextItem): EditorDoc {
  const index = doc.texts.findIndex((existing) => existing.id === item.id);
  if (index === -1) return { ...doc, texts: [...doc.texts, item] };
  const texts = doc.texts.slice();
  texts[index] = item;
  return { ...doc, texts };
}

export function removeText(doc: EditorDoc, id: string): EditorDoc {
  const texts = doc.texts.filter((item) => item.id !== id);
  if (texts.length === doc.texts.length) return doc;
  return { ...doc, texts };
}

export function updateText(doc: EditorDoc, id: string, patch: Partial<TextItem>): EditorDoc {
  const index = doc.texts.findIndex((item) => item.id === id);
  if (index === -1) return doc;
  const texts = doc.texts.slice();
  texts[index] = { ...texts[index], ...patch };
  return { ...doc, texts };
}

export function clearTexts(doc: EditorDoc): EditorDoc {
  if (doc.texts.length === 0) return doc;
  return { ...doc, texts: [] };
}

// ---------------------------------------------------------------------------
// Markers (numbered step annotations)
// ---------------------------------------------------------------------------

/** The next number to hand out: one past the highest badge in use. */
export function nextMarkerNumber(doc: EditorDoc): number {
  return doc.markers.reduce((max, marker) => Math.max(max, marker.number), 0) + 1;
}

export function appendMarker(doc: EditorDoc, marker: Marker): EditorDoc {
  return { ...doc, markers: [...doc.markers, marker] };
}

export function updateMarker(doc: EditorDoc, id: string, patch: Partial<Marker>): EditorDoc {
  const index = doc.markers.findIndex((marker) => marker.id === id);
  if (index === -1) return doc;
  const markers = doc.markers.slice();
  markers[index] = { ...markers[index], ...patch };
  return { ...doc, markers };
}

export function removeMarker(doc: EditorDoc, id: string): EditorDoc {
  const markers = doc.markers.filter((marker) => marker.id !== id);
  if (markers.length === doc.markers.length) return doc;
  return { ...doc, markers };
}

export function clearMarkers(doc: EditorDoc): EditorDoc {
  if (doc.markers.length === 0) return doc;
  return { ...doc, markers: [] };
}

/**
 * Re-assign badge numbers in reading order (top row first, then left to right),
 * which is what tutorial screenshots usually need after editing.
 */
export function renumberMarkers(doc: EditorDoc): EditorDoc {
  if (doc.markers.length === 0) return doc;
  const rowHeight = Math.max(1, Math.min(doc.width, doc.height) * 0.08);
  const ordered = doc.markers
    .map((marker, index) => ({ marker, index }))
    .sort((a, b) => {
      const rowA = Math.floor(a.marker.y / rowHeight);
      const rowB = Math.floor(b.marker.y / rowHeight);
      if (rowA !== rowB) return rowA - rowB;
      if (a.marker.y !== b.marker.y) return a.marker.y - b.marker.y;
      if (a.marker.x !== b.marker.x) return a.marker.x - b.marker.x;
      return a.index - b.index;
    });
  const numbers = new Map<string, number>();
  ordered.forEach((entry, position) => numbers.set(entry.marker.id, position + 1));
  return {
    ...doc,
    markers: doc.markers.map((marker) => ({ ...marker, number: numbers.get(marker.id) ?? marker.number })),
  };
}

/** Deep copy so callers can never mutate internal state. */
export function cloneDoc(doc: EditorDoc): EditorDoc {
  return {
    ...doc,
    adjust: { ...doc.adjust },
    strokes: doc.strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((p) => ({ ...p })) })),
    texts: doc.texts.map((item) => ({ ...item })),
    markers: doc.markers.map((marker) => ({ ...marker })),
  };
}

/** Defensive normalisation of a user supplied document. */
export function normalizeDoc(input: Partial<EditorDoc>, width: number, height: number): EditorDoc {
  const doc: EditorDoc = {
    width,
    height,
    adjust: sanitizeAdjustments(input.adjust),
    strokes: Array.isArray(input.strokes)
      ? input.strokes
          .filter((stroke): stroke is Stroke => !!stroke && Array.isArray(stroke.points))
          .map((stroke) => ({
            id: typeof stroke.id === 'string' ? stroke.id : createId('stroke'),
            points: stroke.points
              .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
              .map((p) => ({ x: p.x, y: p.y })),
            color: typeof stroke.color === 'string' ? stroke.color : '#ff3b30',
            size: Number.isFinite(stroke.size) ? stroke.size : 12,
            opacity: Number.isFinite(stroke.opacity) ? stroke.opacity : 100,
            erase: stroke.erase === true,
            ...(stroke.kind === 'mosaic' ? { kind: 'mosaic' as const } : {}),
            ...(Number.isFinite(stroke.mosaicBlock) ? { mosaicBlock: Math.max(2, stroke.mosaicBlock as number) } : {}),
            ...(stroke.mosaicStyle === 'blur' ? { mosaicStyle: 'blur' as const } : {}),
            ...(Number.isFinite(stroke.mosaicBlur) ? { mosaicBlur: Math.max(1, stroke.mosaicBlur as number) } : {}),
          }))
          .filter((stroke) => stroke.points.length > 0)
      : [],
    texts: Array.isArray(input.texts)
      ? input.texts
          .filter((item): item is TextItem => !!item && typeof item.text === 'string')
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : createId('text'),
            text: item.text,
            x: Number.isFinite(item.x) ? item.x : 0,
            y: Number.isFinite(item.y) ? item.y : 0,
            size: Number.isFinite(item.size) ? Math.max(4, item.size) : 32,
            color: typeof item.color === 'string' ? item.color : '#ffffff',
            fontFamily: typeof item.fontFamily === 'string' ? item.fontFamily : 'sans-serif',
            bold: item.bold === true,
            italic: item.italic === true,
            align: item.align === 'center' || item.align === 'right' ? item.align : 'left',
            rotation: Number.isFinite(item.rotation) ? item.rotation : 0,
            opacity: Number.isFinite(item.opacity) ? item.opacity : 100,
          }))
      : [],
    markers: Array.isArray(input.markers)
      ? input.markers
          .filter((marker): marker is Marker => !!marker && Number.isFinite(marker.x) && Number.isFinite(marker.y))
          .map((marker, index) => ({
            id: typeof marker.id === 'string' ? marker.id : createId('marker'),
            x: marker.x,
            y: marker.y,
            number: Number.isFinite(marker.number) ? Math.max(1, Math.round(marker.number)) : index + 1,
            color: typeof marker.color === 'string' ? marker.color : '#ef4444',
            size: Number.isFinite(marker.size) ? Math.min(2000, Math.max(12, marker.size)) : 120,
            shape: (['circle', 'square', 'ring'] as MarkerShape[]).includes(marker.shape) ? marker.shape : 'circle',
          }))
      : [],
    preset: typeof input.preset === 'string' ? input.preset : null,
    rotation: Number.isFinite(input.rotation) ? (input.rotation as number) : 0,
    flipH: input.flipH === true,
    flipV: input.flipV === true,
  };
  return doc;
}

/** True when the document no longer matches a freshly loaded image. */
export function isPristine(doc: EditorDoc, strokesFlag = true, textsFlag = true): boolean {
  const neutral = sanitizeAdjustments(doc.adjust);
  const adjustUntouched = (Object.keys(neutral) as AdjustKey[]).every(
    (key) => neutral[key] === neutralAdjustments()[key],
  );
  return (
    adjustUntouched &&
    doc.preset === null &&
    (!strokesFlag || doc.strokes.length === 0) &&
    (!textsFlag || doc.texts.length === 0) &&
    doc.markers.length === 0
  );
}
