import type { Adjustments, AdjustKey, EditorDoc, Stroke, TextItem } from '../types.js';
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
    preset: null,
    rotation: 0,
    flipH: false,
    flipV: false,
  };
}

/** The subset of the document that affects pixels. */
export function pixelDocOf(doc: EditorDoc): PixelDoc {
  return { adjust: doc.adjust, strokes: doc.strokes, texts: doc.texts };
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

export function clearStrokes(doc: EditorDoc): EditorDoc {
  if (doc.strokes.length === 0) return doc;
  return { ...doc, strokes: [] };
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

/** Deep copy so callers can never mutate internal state. */
export function cloneDoc(doc: EditorDoc): EditorDoc {
  return {
    ...doc,
    adjust: { ...doc.adjust },
    strokes: doc.strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((p) => ({ ...p })) })),
    texts: doc.texts.map((item) => ({ ...item })),
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
    (!textsFlag || doc.texts.length === 0)
  );
}
