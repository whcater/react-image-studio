import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdjustKey,
  BrushSettings,
  EditorDoc,
  ExportFormat,
  ImageStudioProps,
  Labels,
  Point,
  Rect,
  SaveResult,
  Size,
  Stroke,
  TextItem,
  ToolId,
} from '../types.js';
import { resolveLabels, findAspect } from '../i18n.js';
import {
  appendStroke,
  clearStrokes as clearStrokesInDoc,
  cloneDoc,
  createId,
  initialDoc,
  normalizeDoc,
  removeText as removeTextInDoc,
  updateText as updateTextInDoc,
  upsertText,
  withAdjust,
  withAdjustments,
} from '../core/doc.js';
import { adjustmentsForPreset, neutralAdjustments } from '../core/filters.js';
import {
  canRedo as canRedoHistory,
  canUndo as canUndoHistory,
  commit as commitHistory,
  createHistory,
  currentSlot,
  redo as redoHistory,
  undo as undoHistory,
  type HistoryState,
} from '../core/history.js';
import {
  canvasToBlob,
  copyBlobToClipboard,
  downloadBlob,
  flattenOnBackground,
  formatBytes,
  loadImage,
  sanitizeFilename,
  sourceToCanvas,
  withExtension,
} from '../core/image.js';
import { previewScaleFor, renderDoc, supportsContextFilter } from '../core/render.js';
import {
  cropCanvas,
  flipCanvas,
  flipOverlays,
  offsetOverlays,
  rotateCanvas,
  rotateOverlays,
} from '../core/transform.js';
import { clampView, clampZoom, centeredAspectRect, fitView, roundRect, zoomAt, type ViewTransform } from '../core/geometry.js';

export type EditorStatus = 'empty' | 'loading' | 'ready' | 'error';

export const ALL_TOOLS: ToolId[] = ['move', 'crop', 'rotate', 'adjust', 'filter', 'brush', 'text', 'export'];

export const DEFAULT_BRUSH: BrushSettings = {
  color: '#ff3b30',
  size: 24,
  opacity: 100,
  erase: false,
};

export const DEFAULT_TEXT_STYLE: Omit<TextItem, 'id' | 'text' | 'x' | 'y'> = {
  size: 64,
  color: '#ffffff',
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  bold: true,
  italic: false,
  align: 'center',
  rotation: 0,
  opacity: 100,
};

export interface StudioApi {
  status: EditorStatus;
  error: Error | null;
  labels: Labels;
  theme: 'light' | 'dark';
  tools: ToolId[];
  tool: ToolId;
  setTool: (tool: ToolId) => void;

  base: HTMLCanvasElement | null;
  doc: EditorDoc | null;
  /** Committed pixels + strokes + text, without the CSS-filter adjustments. */
  layer: HTMLCanvasElement | null;
  /** Fully rendered preview, only used when `ctx.filter` is unavailable. */
  preview: HTMLCanvasElement | null;
  filterSupported: boolean;
  imageSize: Size;

  view: ViewTransform;
  viewport: Size;
  setViewport: (size: Size) => void;
  /** Apply a view transform (clamped to the visible area). */
  setView: (view: ViewTransform) => void;
  zoomBy: (factor: number, focal?: Point) => void;
  zoomTo: (scale: number) => void;
  fit: () => void;
  panBy: (dx: number, dy: number) => void;

  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  sourceName: string;
  load: (source: string | Blob | File) => Promise<void>;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  rotate: (direction: 1 | -1) => void;
  flip: (axis: 'horizontal' | 'vertical') => void;
  applyCrop: (rect: Rect) => void;

  /** Draft crop rectangle, in image pixels. */
  cropRect: Rect | null;
  setCropRect: (rect: Rect | null) => void;
  /** Selected aspect-ratio id for the crop tool. */
  cropAspect: string;
  setCropAspect: (id: string) => void;
  cropApply: () => void;
  cropReset: () => void;

  setAdjust: (key: AdjustKey, value: number) => void;
  beginTransient: () => void;
  endTransient: () => void;
  applyPreset: (id: string) => void;

  brush: BrushSettings;
  setBrush: (patch: Partial<BrushSettings>) => void;
  addStroke: (stroke: Stroke) => void;
  clearStrokes: () => void;

  selectedTextId: string | null;
  selectText: (id: string | null) => void;
  textStyle: typeof DEFAULT_TEXT_STYLE;
  setTextStyle: (patch: Partial<typeof DEFAULT_TEXT_STYLE>) => void;
  addText: (patch?: Partial<TextItem>) => TextItem | null;
  updateText: (id: string, patch: Partial<TextItem>, merge?: boolean) => void;
  removeText: (id: string) => void;

  format: ExportFormat;
  setFormat: (format: ExportFormat) => void;
  quality: number;
  setQuality: (quality: number) => void;
  filename: string;
  setFilename: (name: string) => void;
  exportBlob: (format?: ExportFormat, quality?: number) => Promise<Blob>;
  download: (format?: ExportFormat, quality?: number, filename?: string) => Promise<SaveResult>;
  copyToClipboard: () => Promise<boolean>;
  busy: boolean;
  message: string | null;
  getDoc: () => EditorDoc | null;
  setDoc: (doc: EditorDoc) => void;
}

function nameFromSource(source: string | Blob | File): string {
  if (typeof source === 'string') {
    if (source.startsWith('data:')) return 'image';
    if (source.startsWith('blob:')) return 'image';
    const base = source.split('?')[0].split('#')[0].split('/').pop() ?? 'image';
    return sanitizeFilename(base.replace(/\.[a-z0-9]{1,5}$/i, ''), 'image');
  }
  if (typeof (source as File).name === 'string' && (source as File).name) {
    return sanitizeFilename((source as File).name.replace(/\.[a-z0-9]{1,5}$/i, ''), 'image');
  }
  return 'image';
}

/**
 * Owns every piece of editor state: the undo history, the viewport transform,
 * tool settings and the export pipeline.
 */
export function useImageStudio(props: ImageStudioProps): StudioApi {
  const labels = useMemo(() => resolveLabels(props.labels), [props.labels]);
  const tools = useMemo(() => {
    const enabled = props.tools && props.tools.length > 0 ? new Set(props.tools) : null;
    return enabled ? ALL_TOOLS.filter((tool) => enabled.has(tool)) : ALL_TOOLS;
  }, [props.tools]);

  const [status, setStatus] = useState<EditorStatus>(props.src || props.image ? 'loading' : 'empty');
  const [error, setError] = useState<Error | null>(null);
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [tool, setTool] = useState<ToolId>(() => {
    const requested = props.defaultTool;
    return requested && (props.tools ? props.tools.includes(requested) : true) ? requested : tools[0] ?? 'move';
  });
  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [brush, setBrushState] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [textStyle, setTextStyleState] = useState(DEFAULT_TEXT_STYLE);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>(props.defaultFormat ?? 'png');
  const [quality, setQuality] = useState(0.92);
  const [filename, setFilename] = useState('edited-image');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [cropAspectId, setCropAspectId] = useState('free');
  const [originalBase, setOriginalBase] = useState<HTMLCanvasElement | null>(null);

  const transientRef = useRef(false);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDocChangeRef = useRef(props.onDocChange);
  onDocChangeRef.current = props.onDocChange;
  const onErrorRef = useRef(props.onError);
  onErrorRef.current = props.onError;

  const slot = history ? currentSlot(history) : null;
  const base = slot?.base ?? null;
  const doc = slot?.doc ?? null;

  const filterSupported = useMemo(() => supportsContextFilter(), []);
  const imageSize = useMemo<Size>(
    () => ({ width: base?.width ?? 0, height: base?.height ?? 0 }),
    [base],
  );

  const emitDoc = useCallback((next: EditorDoc | null) => {
    if (next) onDocChangeRef.current?.(cloneDoc(next));
  }, []);

  const flash = useCallback((text: string, duration = 1800) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), duration);
  }, []);

  useEffect(() => () => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
  }, []);

  /**
   * Preview layer: committed pixels + strokes + text at a downscaled size.
   * Colour adjustments are deliberately *not* baked in — the stage applies them
   * as a CSS filter while drawing, so dragging a slider never re-renders.
   */
  const strokes = doc?.strokes;
  const texts = doc?.texts;
  const layer = useMemo(() => {
    if (!base || !strokes || !texts) return null;
    if (!filterSupported) return null;
    return renderDoc(
      base,
      { adjust: neutralAdjustments(), strokes, texts },
      { scale: previewScaleFor({ width: base.width, height: base.height }) },
    );
  }, [base, strokes, texts, filterSupported]);

  const preview = useMemo(() => {
    if (!base || !doc || filterSupported) return null;
    return renderDoc(base, doc, { scale: previewScaleFor({ width: base.width, height: base.height }) });
  }, [base, doc, filterSupported]);

  // ---------------------------------------------------------------------
  // History plumbing
  // ---------------------------------------------------------------------

  const beginTransient = useCallback(() => {
    if (transientRef.current) return;
    transientRef.current = true;
    setHistory((current) => (current ? commitHistory(current, currentSlot(current), false) : current));
  }, []);

  const endTransient = useCallback(() => {
    transientRef.current = false;
  }, []);

  const commitDoc = useCallback(
    (nextDoc: EditorDoc, merge = false) => {
      setHistory((current) => {
        if (!current) return current;
        const next = commitHistory(current, { base: currentSlot(current).base, doc: nextDoc }, merge);
        return next;
      });
      emitDoc(nextDoc);
    },
    [emitDoc],
  );

  const commitStructural = useCallback(
    (nextBase: HTMLCanvasElement, nextDoc: EditorDoc) => {
      transientRef.current = false;
      setHistory((current) => (current ? commitHistory(current, { base: nextBase, doc: nextDoc }, false) : current));
      emitDoc(nextDoc);
    },
    [emitDoc],
  );

  // ---------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------

  const applySource = useCallback(
    (canvas: HTMLCanvasElement, name: string) => {
      const nextDoc = initialDoc(canvas);
      setHistory(createHistory({ base: canvas, doc: nextDoc }));
      setOriginalBase(canvas);
      setStatus('ready');
      setError(null);
      setSelectedTextId(null);
      setFilename(name || 'edited-image');
      transientRef.current = false;
      emitDoc(nextDoc);
    },
    [emitDoc],
  );

  const load = useCallback(
    async (source: string | Blob | File) => {
      setStatus('loading');
      setError(null);
      try {
        const img = await loadImage(source);
        const maxSize = props.maxSourceSize ?? 0;
        const canvas = sourceToCanvas(img, maxSize);
        applySource(canvas, nameFromSource(source));
      } catch (cause) {
        const nextError = cause instanceof Error ? cause : new Error(String(cause));
        setError(nextError);
        setStatus('error');
        onErrorRef.current?.(nextError);
      }
    },
    [applySource, props.maxSourceSize],
  );

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (props.image) {
      try {
        const canvas = sourceToCanvas(props.image as CanvasImageSource & { width: number; height: number }, props.maxSourceSize ?? 0);
        applySource(canvas, 'image');
      } catch (cause) {
        const nextError = cause instanceof Error ? cause : new Error(String(cause));
        setError(nextError);
        setStatus('error');
        onErrorRef.current?.(nextError);
      }
      return;
    }
    if (props.src) void loadRef.current(props.src);
    else {
      setHistory(null);
      setOriginalBase(null);
      setStatus('empty');
    }
  }, [props.src, props.image, props.maxSourceSize, applySource]);

  // Restore an externally supplied document.
  const externalDocRef = useRef<EditorDoc | null>(props.doc ?? null);
  useEffect(() => {
    if (!props.doc || !base) return;
    if (externalDocRef.current === props.doc) return;
    externalDocRef.current = props.doc;
    const next = normalizeDoc(props.doc, base.width, base.height);
    commitDoc(next, false);
  }, [props.doc, base, commitDoc]);

  // ---------------------------------------------------------------------
  // View
  // ---------------------------------------------------------------------

  const fittedRef = useRef<HTMLCanvasElement | null>(null);
  const fittedViewport = useRef<Size>({ width: 0, height: 0 });

  useEffect(() => {
    if (!base || viewport.width < 1 || viewport.height < 1) return;
    if (
      fittedRef.current === base &&
      fittedViewport.current.width === viewport.width &&
      fittedViewport.current.height === viewport.height
    ) {
      return;
    }
    fittedRef.current = base;
    fittedViewport.current = viewport;
    setView(fitView({ width: base.width, height: base.height }, viewport));
  }, [base, viewport]);

  const fit = useCallback(() => {
    if (!base) return;
    setView(fitView({ width: base.width, height: base.height }, viewport));
  }, [base, viewport]);

  const zoomTo = useCallback(
    (scale: number) => {
      if (!base) return;
      const focal = { x: viewport.width / 2, y: viewport.height / 2 };
      setView((current) => {
        const target = clampZoom(scale);
        return clampView(zoomAt(current, target / current.scale, focal), imageSize, viewport);
      });
    },
    [base, imageSize, viewport],
  );

  const zoomBy = useCallback(
    (factor: number, focal?: Point) => {
      if (!base) return;
      const anchor = focal ?? { x: viewport.width / 2, y: viewport.height / 2 };
      setView((current) => clampView(zoomAt(current, factor, anchor), imageSize, viewport));
    },
    [base, imageSize, viewport],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      setView((current) => clampView({ ...current, x: current.x + dx, y: current.y + dy }, imageSize, viewport));
    },
    [imageSize, viewport],
  );

  const applyView = useCallback(
    (next: ViewTransform) => {
      setView(clampView(next, imageSize, viewport));
    },
    [imageSize, viewport],
  );

  // ---------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------

  const undo = useCallback(() => {
    transientRef.current = false;
    setHistory((current) => {
      if (!current) return current;
      const next = undoHistory(current);
      emitDoc(currentSlot(next).doc);
      return next;
    });
    setSelectedTextId(null);
  }, [emitDoc]);

  const redo = useCallback(() => {
    transientRef.current = false;
    setHistory((current) => {
      if (!current) return current;
      const next = redoHistory(current);
      emitDoc(currentSlot(next).doc);
      return next;
    });
    setSelectedTextId(null);
  }, [emitDoc]);

  const reset = useCallback(() => {
    if (!originalBase) return;
    const nextDoc = initialDoc(originalBase);
    commitStructural(originalBase, nextDoc);
    setSelectedTextId(null);
  }, [originalBase, commitStructural]);

  const rotate = useCallback(
    (direction: 1 | -1) => {
      if (!base || !doc) return;
      const nextBase = rotateCanvas(base, direction * 90);
      const mapped = rotateOverlays(
        {
          points: doc.strokes.flatMap((stroke) => stroke.points),
          texts: doc.texts.map((item) => ({ x: item.x, y: item.y, rotation: item.rotation })),
        },
        direction * 90,
        { width: base.width, height: base.height },
      );
      let cursor = 0;
      const strokes = doc.strokes.map((stroke) => {
        const points = mapped.points.slice(cursor, cursor + stroke.points.length);
        cursor += stroke.points.length;
        return { ...stroke, points };
      });
      const texts = doc.texts.map((item, index) => ({ ...item, x: mapped.texts[index].x, y: mapped.texts[index].y, rotation: mapped.texts[index].rotation }));
      const nextDoc: EditorDoc = {
        ...doc,
        width: nextBase.width,
        height: nextBase.height,
        rotation: (doc.rotation + direction * 90 + 360) % 360,
        strokes,
        texts,
      };
      commitStructural(nextBase, nextDoc);
      setSelectedTextId(null);
    },
    [base, doc, commitStructural],
  );

  const flip = useCallback(
    (axis: 'horizontal' | 'vertical') => {
      if (!base || !doc) return;
      const nextBase = flipCanvas(base, axis);
      const size = { width: base.width, height: base.height };
      const strokes = doc.strokes.map((stroke) => ({
        ...stroke,
        points: flipOverlays(stroke.points, axis, size),
      }));
      const texts = doc.texts.map((item) => ({
        ...item,
        ...flipOverlays([{ x: item.x, y: item.y }], axis, size)[0],
        rotation: -item.rotation,
        align:
          axis === 'horizontal'
            ? item.align === 'left'
              ? 'right'
              : item.align === 'right'
                ? 'left'
                : item.align
            : item.align,
      }));
      const nextDoc: EditorDoc = {
        ...doc,
        width: nextBase.width,
        height: nextBase.height,
        flipH: axis === 'horizontal' ? !doc.flipH : doc.flipH,
        flipV: axis === 'vertical' ? !doc.flipV : doc.flipV,
        strokes,
        texts,
      };
      commitStructural(nextBase, nextDoc);
    },
    [base, doc, commitStructural],
  );

  const applyCrop = useCallback(
    (rect: Rect) => {
      if (!base || !doc) return;
      const nextBase = cropCanvas(base, rect);
      if (nextBase === base) return;
      const dx = Math.max(0, Math.round(rect.x));
      const dy = Math.max(0, Math.round(rect.y));
      const strokes = doc.strokes.map((stroke) => ({ ...stroke, points: offsetOverlays(stroke.points, dx, dy) }));
      const texts = doc.texts.map((item) => ({ ...item, ...offsetOverlays([{ x: item.x, y: item.y }], dx, dy)[0] }));
      const nextDoc: EditorDoc = { ...doc, width: nextBase.width, height: nextBase.height, strokes, texts };
      commitStructural(nextBase, nextDoc);
      setSelectedTextId(null);
    },
    [base, doc, commitStructural],
  );

  // Crop draft: reset whenever the committed pixels change, and seed a
  // full-frame rectangle as soon as the crop tool is opened.
  useEffect(() => {
    setCropRect(null);
  }, [base]);

  useEffect(() => {
    if (tool !== 'crop' || imageSize.width < 1 || imageSize.height < 1) return;
    setCropRect((current) => current ?? centeredAspectRect(imageSize, findAspect(cropAspectId)?.ratio ?? null));
  }, [tool, imageSize, cropAspectId]);

  const setCropAspect = useCallback(
    (id: string) => {
      setCropAspectId(id);
      if (imageSize.width < 1) return;
      setCropRect(centeredAspectRect(imageSize, findAspect(id)?.ratio ?? null));
    },
    [imageSize],
  );

  const cropApply = useCallback(() => {
    if (!cropRect) return;
    applyCrop(roundRect(cropRect));
    setCropRect(null);
  }, [applyCrop, cropRect]);

  const cropReset = useCallback(() => {
    if (imageSize.width < 1) return;
    setCropRect(centeredAspectRect(imageSize, findAspect(cropAspectId)?.ratio ?? null));
  }, [cropAspectId, imageSize]);

  const setAdjust = useCallback(
    (key: AdjustKey, value: number) => {
      if (!doc) return;
      const next = withAdjust(doc, key, value);
      if (!transientRef.current) beginTransient();
      commitDoc(next, true);
    },
    [doc, beginTransient, commitDoc],
  );

  const applyPreset = useCallback(
    (id: string) => {
      if (!doc) return;
      transientRef.current = false;
      commitDoc(withAdjustments(doc, adjustmentsForPreset(id), id), false);
    },
    [doc, commitDoc],
  );

  const setBrush = useCallback((patch: Partial<BrushSettings>) => {
    setBrushState((current) => ({ ...current, ...patch }));
  }, []);

  const addStroke = useCallback(
    (stroke: Stroke) => {
      if (!doc) return;
      transientRef.current = false;
      commitDoc(appendStroke(doc, stroke), false);
    },
    [doc, commitDoc],
  );

  const clearStrokes = useCallback(() => {
    if (!doc) return;
    commitDoc(clearStrokesInDoc(doc), false);
  }, [doc, commitDoc]);

  const selectText = useCallback((id: string | null) => {
    setSelectedTextId(id);
  }, []);

  const setTextStyle = useCallback((patch: Partial<typeof DEFAULT_TEXT_STYLE>) => {
    setTextStyleState((current) => ({ ...current, ...patch }));
  }, []);

  const addText = useCallback(
    (patch?: Partial<TextItem>): TextItem | null => {
      if (!doc) return null;
      const item: TextItem = {
        ...textStyle,
        id: createId('text'),
        text: props.labels === 'zh-CN' ? '双击编辑' : 'Double click to edit',
        x: Math.round(doc.width / 2),
        y: Math.round(doc.height / 2),
        ...patch,
      };
      commitDoc(upsertText(doc, item), false);
      setSelectedTextId(item.id);
      return item;
    },
    [doc, textStyle, commitDoc, props.labels],
  );

  const updateText = useCallback(
    (id: string, patch: Partial<TextItem>, merge = true) => {
      if (!doc) return;
      if (!transientRef.current) beginTransient();
      commitDoc(updateTextInDoc(doc, id, patch), merge);
    },
    [doc, beginTransient, commitDoc],
  );

  const removeText = useCallback(
    (id: string) => {
      if (!doc) return;
      transientRef.current = false;
      commitDoc(removeTextInDoc(doc, id), false);
      setSelectedTextId(null);
    },
    [doc, commitDoc],
  );

  // ---------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------

  const exportBlob = useCallback(
    async (nextFormat: ExportFormat = format, nextQuality = quality): Promise<Blob> => {
      if (!base || !doc) throw new Error('react-image-studio: nothing to export yet');
      const rendered = renderDoc(base, doc, { scale: 1 });
      // JPEG has no alpha channel: flatten transparency onto white instead of
      // letting the encoder render it black.
      const target = nextFormat === 'jpeg' ? flattenOnBackground(rendered) : rendered;
      return canvasToBlob(target, nextFormat, nextQuality);
    },
    [base, doc, format, quality],
  );

  const download = useCallback(
    async (
      nextFormat: ExportFormat = format,
      nextQuality = quality,
      nextFilename?: string,
    ): Promise<SaveResult> => {
      if (!base || !doc) throw new Error('react-image-studio: nothing to export yet');
      setBusy(true);
      try {
        const blob = await exportBlob(nextFormat, nextQuality);
        const name = withExtension(nextFilename ?? filename, nextFormat);
        downloadBlob(blob, name);
        const result: SaveResult = {
          blob,
          format: nextFormat,
          width: base.width,
          height: base.height,
          quality: nextQuality,
          filename: name,
        };
        props.onSave?.(result);
        flash(`${labels.app.save} · ${formatBytes(blob.size)}`);
        return result;
      } catch (cause) {
        const nextError = cause instanceof Error ? cause : new Error(String(cause));
        onErrorRef.current?.(nextError);
        flash(labels.app.errorExport, 2600);
        throw nextError;
      } finally {
        setBusy(false);
      }
    },
    [base, doc, exportBlob, filename, flash, format, labels.app.errorExport, labels.app.save, props, quality],
  );

  const copyToClipboard = useCallback(async () => {
    try {
      const blob = await exportBlob('png', 1);
      const ok = await copyBlobToClipboard(blob);
      flash(ok ? labels.app.copied : labels.app.errorExport);
      return ok;
    } catch {
      flash(labels.app.errorExport);
      return false;
    }
  }, [exportBlob, flash, labels.app.copied, labels.app.errorExport]);

  const getDoc = useCallback(() => (doc ? cloneDoc(doc) : null), [doc]);

  const setDoc = useCallback(
    (next: EditorDoc) => {
      if (!base) return;
      externalDocRef.current = next;
      commitDoc(normalizeDoc(next, base.width, base.height), false);
    },
    [base, commitDoc],
  );

  return {
    status,
    error,
    labels,
    theme: props.theme === 'dark' || props.theme === 'light' ? props.theme : 'light',
    tools,
    tool,
    setTool,
    base,
    doc,
    layer,
    preview,
    filterSupported,
    imageSize,
    view,
    viewport,
    setViewport,
    setView: applyView,
    zoomBy,
    zoomTo,
    fit,
    panBy,
    canUndo: history ? canUndoHistory(history) : false,
    canRedo: history ? canRedoHistory(history) : false,
    dirty: history ? history.index > 0 : false,
    sourceName: filename,
    load,
    undo,
    redo,
    reset,
    rotate,
    flip,
    applyCrop,
    cropRect,
    setCropRect,
    cropAspect: cropAspectId,
    setCropAspect,
    cropApply,
    cropReset,
    setAdjust,
    beginTransient,
    endTransient,
    applyPreset,
    brush,
    setBrush,
    addStroke,
    clearStrokes,
    selectedTextId,
    selectText,
    textStyle,
    setTextStyle,
    addText,
    updateText,
    removeText,
    format,
    setFormat,
    quality,
    setQuality,
    filename,
    setFilename,
    exportBlob,
    download,
    copyToClipboard,
    busy,
    message,
    getDoc,
    setDoc,
  };
}
