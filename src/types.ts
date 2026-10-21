import type { CSSProperties, ReactNode } from 'react';

/** Identifiers for every built-in editing tool / panel. */
export type ToolId =
  | 'move'
  | 'crop'
  | 'rotate'
  | 'adjust'
  | 'filter'
  | 'brush'
  | 'mosaic'
  | 'text'
  | 'marker'
  | 'export';

/** Output formats supported by the exporter. */
export type ExportFormat = 'png' | 'jpeg' | 'webp';

/** A rectangle expressed in image pixels (top-left origin). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Size = { width: number; height: number };

export type CropHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

/**
 * Non-destructive colour adjustments. Every value is expressed in the same
 * units as the equivalent CSS filter function, which keeps the render pipeline
 * and the DOM preview perfectly in sync.
 */
export interface Adjustments {
  /** 0..200 (%), 100 = untouched. */
  brightness: number;
  /** 0..200 (%), 100 = untouched. */
  contrast: number;
  /** 0..200 (%), 100 = untouched. */
  saturation: number;
  /** -180..180 degrees. */
  hue: number;
  /** 0..50 pixels. */
  blur: number;
  /** -100..100, negative = cooler, positive = warmer. */
  warmth: number;
  /** 0..100 (%). */
  grayscale: number;
  /** 0..100 (%). */
  sepia: number;
  /** 0..100 (%). */
  invert: number;
  /** 0..100 (%). */
  opacity: number;
}

export type AdjustKey = keyof Adjustments;

export interface Point {
  x: number;
  y: number;
}

export interface BrushSettings {
  color: string;
  /** Brush diameter in image pixels. */
  size: number;
  /** 0..100 (%). */
  opacity: number;
  /** Eraser strokes do not paint colour, they clear already painted pixels. */
  erase: boolean;
}

/** How a freehand stroke affects the image. */
export type StrokeKind = 'brush' | 'mosaic';

/** Redaction style of a mosaic stroke. */
export type MosaicStyle = 'pixelate' | 'blur';

/** A single freehand stroke, stored as a compact point list. */
export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  size: number;
  opacity: number;
  erase: boolean;
  /** Defaults to `'brush'`; `'mosaic'` strokes redact instead of painting. */
  kind?: StrokeKind;
  /** Pixelate block size in image pixels (mosaic strokes only). */
  mosaicBlock?: number;
  /** `'pixelate'` (blocky) or `'blur'` (soft) redaction. */
  mosaicStyle?: MosaicStyle;
  /** Redaction strength for `'blur'`, in image pixels. */
  mosaicBlur?: number;
}

/** Visual style of a numbered step marker. */
export type MarkerShape = 'circle' | 'square' | 'ring';

export interface MarkerSettings {
  color: string;
  /** Diameter in image pixels. */
  size: number;
  shape: MarkerShape;
}

/** A numbered annotation used for step-by-step screenshots. */
export interface Marker {
  id: string;
  /** Centre position in image pixels. */
  x: number;
  y: number;
  /** 1-based badge number. */
  number: number;
  color: string;
  /** Diameter in image pixels. */
  size: number;
  shape: MarkerShape;
}

export interface MosaicSettings {
  /** Brush diameter in image pixels. */
  size: number;
  style: MosaicStyle;
  /** Block size for `'pixelate'`, in image pixels. */
  block: number;
  /** Radius for `'blur'`, in image pixels. */
  blur: number;
}

export type TextAlign = 'left' | 'center' | 'right';

export interface TextItem {
  id: string;
  text: string;
  /** Anchor position in image pixels. */
  x: number;
  y: number;
  /** Font size in image pixels. */
  size: number;
  color: string;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  align: TextAlign;
  /** Rotation in degrees, clockwise. */
  rotation: number;
  /** 0..100 (%). */
  opacity: number;
}

/** The full, serialisable description of an edited image. */
export interface EditorDoc {
  /** Width/height of the committed pixel base, in image pixels. */
  width: number;
  height: number;
  adjust: Adjustments;
  strokes: Stroke[];
  texts: TextItem[];
  /** Numbered step markers, drawn on top of everything else. */
  markers: Marker[];
  /** Id of the applied filter preset, or `null` for a custom look. */
  preset: string | null;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

export interface FilterPreset {
  id: string;
  /** Translation key resolved through `labels.presets`. */
  labelKey: string;
  adjust: Partial<Adjustments>;
}

export interface CropAspectOption {
  id: string;
  labelKey: string;
  /** `null` means "free" (unconstrained). */
  ratio: number | null;
}

export interface SaveResult {
  blob: Blob;
  format: ExportFormat;
  width: number;
  height: number;
  quality: number;
  filename: string;
}

/** Resolved, fully-translated UI strings. */
export interface Labels {
  tools: Record<ToolId, string>;
  adjust: Record<AdjustKey, string>;
  presets: Record<string, string>;
  aspects: Record<string, string>;
  app: {
    loading: string;
    emptyTitle: string;
    emptyHint: string;
    chooseImage: string;
    dragHint: string;
    undo: string;
    redo: string;
    reset: string;
    apply: string;
    cancel: string;
    close: string;
    zoomIn: string;
    zoomOut: string;
    zoomFit: string;
    zoomActual: string;
    cropTitle: string;
    cropHint: string;
    cropApply: string;
    rotateTitle: string;
    rotateLeft: string;
    rotateRight: string;
    flipH: string;
    flipV: string;
    brushTitle: string;
    brushSize: string;
    brushOpacity: string;
    brushColor: string;
    brushEraser: string;
    brushClear: string;
    mosaicTitle: string;
    mosaicStyle: string;
    mosaicPixelate: string;
    mosaicBlur: string;
    mosaicBrushSize: string;
    mosaicBlock: string;
    mosaicStrength: string;
    mosaicClear: string;
    mosaicHint: string;
    textTitle: string;
    textPlaceholder: string;
    addText: string;
    textSize: string;
    textColor: string;
    textFont: string;
    textBold: string;
    textItalic: string;
    textAlign: string;
    textRotation: string;
    deleteText: string;
    markerTitle: string;
    markerHint: string;
    markerShape: string;
    markerCircle: string;
    markerSquare: string;
    markerRing: string;
    markerSize: string;
    markerColor: string;
    markerAdd: string;
    markerDelete: string;
    markerRenumber: string;
    markerClear: string;
    exportTitle: string;
    format: string;
    quality: string;
    filename: string;
    download: string;
    copy: string;
    copied: string;
    save: string;
    original: string;
    imageInfo: string;
    errorLoad: string;
    errorExport: string;
    keyboardHint: string;
  };
}

export interface ImageStudioProps {
  /** Image URL, data URL, Blob or File to start with. */
  src?: string | Blob | File | null;
  /** Alternative controlled entry point for an already decoded image. */
  image?: CanvasImageSource | null;
  /** Editor document to restore (e.g. a previously saved snapshot). */
  doc?: EditorDoc | null;
  /** Called whenever the document changes. */
  onDocChange?: (doc: EditorDoc) => void;
  /** Called after a successful export ("Save" button). */
  onSave?: (result: SaveResult) => void;
  /** Called when loading the image fails. */
  onError?: (error: Error) => void;
  /** Enable/disable individual tools. */
  tools?: ToolId[];
  /** Initial active tool. */
  defaultTool?: ToolId;
  /** Colour scheme of the chrome. `auto` follows `prefers-color-scheme`. */
  theme?: 'light' | 'dark' | 'auto';
  /** Partial label overrides, or a full custom `Labels` object. */
  labels?: Partial<Labels> | 'zh-CN';
  /** Extra class applied to the root element. */
  className?: string;
  /** Inline style overrides for the root element. */
  style?: CSSProperties;
  /** Default export format. */
  defaultFormat?: ExportFormat;
  /** Longest edge (in px) used when decoding very large images. 0 = disabled. */
  maxSourceSize?: number;
  /** Optional slot rendered in the empty state. */
  emptyState?: ReactNode;
  /** Show the built-in drag &amp; drop overlay. */
  allowDrop?: boolean;
  /** Disable keyboard shortcuts. */
  disableShortcuts?: boolean;
}

/** Imperative API exposed through `ref`. */
export interface ImageStudioHandle {
  /** Load a new image and reset the document. */
  load(src: string | Blob | File): Promise<void>;
  /** Export the current document to a Blob. */
  export(format?: ExportFormat, quality?: number): Promise<Blob>;
  /** Export and trigger a browser download. */
  download(format?: ExportFormat, quality?: number, filename?: string): Promise<SaveResult>;
  /** Current document snapshot. */
  getDoc(): EditorDoc | null;
  /** Restore a previously saved document. */
  setDoc(doc: EditorDoc): void;
  /** Undo the last committed change. */
  undo(): void;
  redo(): void;
  reset(): void;
  /** Rotate the committed pixels by ±90°. */
  rotate(direction: 1 | -1): void;
  flip(axis: 'horizontal' | 'vertical'): void;
  /** Commit a crop given in image pixels. */
  crop(rect: Rect): void;
  setTool(tool: ToolId): void;
  /** Fit the whole image into the viewport. */
  fit(): void;
  setZoom(zoom: number): void;
  canUndo(): boolean;
  canRedo(): boolean;
}
