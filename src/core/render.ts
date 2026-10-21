import type { Adjustments, Marker, Stroke, TextItem } from '../types.js';
import { buildFilterString, isNeutralAdjust } from './filters.js';
import { createCanvas, get2d } from './image.js';

/** The share of the document that actually affects pixels. */
export interface PixelDoc {
  adjust: Adjustments;
  strokes: Stroke[];
  texts: TextItem[];
  markers?: Marker[];
}

export const TEXT_LINE_HEIGHT = 1.25;

/** Longest edge (px) used for the on-screen preview of very large images. */
export const PREVIEW_MAX_SIZE = 2400;

let filterSupport: boolean | null = null;

/** `ctx.filter` is unsupported on older Safari/Firefox; detect it once. */
export function supportsContextFilter(): boolean {
  if (filterSupport !== null) return filterSupport;
  if (typeof document === 'undefined') return false;
  try {
    const ctx = createCanvas(1, 1).getContext('2d');
    filterSupport = !!ctx && 'filter' in ctx;
  } catch {
    filterSupport = false;
  }
  return filterSupport;
}

/** Test hook. */
export function resetFilterSupportCache(): void {
  filterSupport = null;
}

export function fontString(item: TextItem): string {
  const style = item.italic ? 'italic ' : '';
  const weight = item.bold ? '700 ' : '400 ';
  return `${style}${weight}${item.size}px ${item.fontFamily}`;
}

export function textLines(item: TextItem): string[] {
  return item.text.split('\n');
}

let measureCtx: CanvasRenderingContext2D | null = null;

function measurementContext(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') return null;
  measureCtx = createCanvas(8, 8).getContext('2d');
  if (measureCtx) measureCtx.textBaseline = 'top';
  return measureCtx;
}

/** Approximate bounding box of a text item, in image pixels. */
export function measureTextItem(item: TextItem): { width: number; height: number } {
  const lines = textLines(item);
  const lineHeight = item.size * TEXT_LINE_HEIGHT;
  const ctx = measurementContext();
  let width = 0;
  if (ctx) {
    ctx.font = fontString(item);
    for (const line of lines) {
      width = Math.max(width, ctx.measureText(line).width);
    }
  } else {
    width = item.size * Math.max(...lines.map((line) => line.length), 1) * 0.55;
  }
  return { width: Math.max(width, item.size * 0.4), height: lineHeight * lines.length };
}

/** Paint strokes onto a transparent layer; the eraser only removes paint. */
function drawStrokesLayer(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    ctx.save();
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    ctx.globalAlpha = Math.min(1, Math.max(0, stroke.opacity / 100));
    ctx.lineWidth = Math.max(0.5, stroke.size);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;

    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, stroke.size / 2), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i += 1) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Draw a single text item. Assumes the context is in image coordinates. */
export function drawTextItem(ctx: CanvasRenderingContext2D, item: TextItem): void {
  if (!item.text.trim()) return;
  const lines = textLines(item);
  const lineHeight = item.size * TEXT_LINE_HEIGHT;
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, item.opacity / 100));
  ctx.translate(item.x, item.y);
  if (item.rotation) ctx.rotate((item.rotation * Math.PI) / 180);
  if (item.align === 'center') ctx.translate(-measureTextItem(item).width / 2, 0);
  else if (item.align === 'right') ctx.translate(-measureTextItem(item).width, 0);
  ctx.font = fontString(item);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = item.color;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], 0, i * lineHeight);
  }
  ctx.restore();
}

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * Warmth cannot be expressed as a CSS filter, so it is emulated with a
 * soft-light colour wash. Positive = warmer, negative = cooler.
 */
export function applyWarmth(ctx: CanvasRenderingContext2D, width: number, height: number, warmth: number): void {
  if (!warmth) return;
  const strength = clamp01(Math.abs(warmth) / 100) * 0.42;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = warmth > 0 ? `rgba(255, 138, 54, ${strength})` : `rgba(46, 122, 255, ${strength})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Per-pixel fallback used only when `ctx.filter` is unavailable. Covers the
 * adjustments that matter most; blur and hue need the real filter API.
 */
function applyPixelAdjustments(ctx: CanvasRenderingContext2D, width: number, height: number, adjust: Adjustments): void {
  if (width < 1 || height < 1) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const data = ctx.getImageData(0, 0, width, height);
  const px = data.data;
  const brightness = adjust.brightness / 100;
  const contrast = adjust.contrast / 100;
  const saturation = adjust.saturation / 100;
  const gray = adjust.grayscale / 100;
  const sepia = adjust.sepia / 100;
  const invert = adjust.invert / 100;
  const opacity = adjust.opacity / 100;

  for (let i = 0; i < px.length; i += 4) {
    let r = px[i] * brightness;
    let g = px[i + 1] * brightness;
    let b = px[i + 2] * brightness;

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + (r - lum) * saturation;
    g = lum + (g - lum) * saturation;
    b = lum + (b - lum) * saturation;

    if (gray > 0) {
      r += (lum - r) * gray;
      g += (lum - g) * gray;
      b += (lum - b) * gray;
    }
    if (sepia > 0) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      r += (sr - r) * sepia;
      g += (sg - g) * sepia;
      b += (sb - b) * sepia;
    }
    if (invert > 0) {
      r += (255 - 2 * r) * invert;
      g += (255 - 2 * g) * invert;
      b += (255 - 2 * b) * invert;
    }
    if (opacity < 1) px[i + 3] *= opacity;

    px[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    px[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    px[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  ctx.putImageData(data, 0, 0);
  ctx.restore();
}

export interface RenderOptions {
  /**
   * Preview scale in (0, 1]. Export always uses 1 so pixels are never
   * downscaled, while the interactive preview stays cheap on huge photos.
   */
  scale?: number;
}

/** Compose base pixels + brush strokes + text into `target`, in image coordinates. */
function composeLayers(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  doc: PixelDoc,
  deviceWidth: number,
  deviceHeight: number,
): void {
  ctx.drawImage(base, 0, 0, base.width, base.height);
  const brushStrokes = doc.strokes.filter((stroke) => (stroke.kind ?? 'brush') === 'brush');
  if (brushStrokes.length > 0) {
    const paint = createCanvas(deviceWidth, deviceHeight);
    const paintCtx = get2d(paint);
    // Re-use the caller's scale by drawing in image coordinates.
    const scale = deviceWidth / base.width;
    paintCtx.setTransform(scale, 0, 0, scale, 0, 0);
    drawStrokesLayer(paintCtx, brushStrokes);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(paint, 0, 0);
    ctx.restore();
  }
  for (const item of doc.texts) drawTextItem(ctx, item);
}

export const DEFAULT_MOSAIC_BLOCK = 12;
export const DEFAULT_MOSAIC_BLUR = 8;

function traceStrokePath(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, stroke.size);
  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(0.5, stroke.size / 2), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i += 1) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
}

/**
 * Redact an already-composed canvas: every mosaic stroke becomes a mask, and
 * the pixels inside it are replaced by a pixelated or blurred copy of whatever
 * is underneath (photo, painting or text). Runs in device pixels.
 */
export function applyMosaic(target: HTMLCanvasElement, strokes: Stroke[], scale = 1): void {
  const mosaicStrokes = strokes.filter((stroke) => stroke.kind === 'mosaic');
  if (mosaicStrokes.length === 0) return;

  const width = target.width;
  const height = target.height;
  const ctx = get2d(target);

  // Strokes with the same redaction settings share one mask + effect pass.
  const groups = new Map<string, Stroke[]>();
  for (const stroke of mosaicStrokes) {
    const style = stroke.mosaicStyle === 'blur' ? 'blur' : 'pixelate';
    const size = style === 'blur' ? stroke.mosaicBlur ?? DEFAULT_MOSAIC_BLUR : stroke.mosaicBlock ?? DEFAULT_MOSAIC_BLOCK;
    const key = `${style}:${size}`;
    const list = groups.get(key) ?? [];
    list.push(stroke);
    groups.set(key, list);
  }

  for (const [key, group] of groups) {
    const [style, rawSize] = key.split(':');
    const effectSize = Math.max(1, Number(rawSize) || 1);

    const mask = createCanvas(width, height);
    const maskCtx = get2d(mask);
    maskCtx.setTransform(scale, 0, 0, scale, 0, 0);
    maskCtx.strokeStyle = '#000000';
    maskCtx.fillStyle = '#000000';
    for (const stroke of group) traceStrokePath(maskCtx, stroke);

    const redacted = createCanvas(width, height);
    const redactedCtx = get2d(redacted);
    if (style === 'blur') {
      redactedCtx.filter = `blur(${Math.max(1, effectSize * scale).toFixed(2)}px)`;
      redactedCtx.drawImage(target, 0, 0);
      redactedCtx.filter = 'none';
    } else {
      const block = Math.max(2, Math.round(effectSize * scale));
      const small = createCanvas(Math.max(1, Math.ceil(width / block)), Math.max(1, Math.ceil(height / block)));
      get2d(small).drawImage(target, 0, 0, small.width, small.height);
      redactedCtx.imageSmoothingEnabled = false;
      redactedCtx.drawImage(small, 0, 0, width, height);
      redactedCtx.imageSmoothingEnabled = true;
    }

    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.globalCompositeOperation = 'source-in';
    maskCtx.drawImage(redacted, 0, 0);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(mask, 0, 0);
    ctx.restore();
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Contrast-aware text colour so badges stay readable on light colours. */
export function readableTextColor(color: string): string {
  const hex = color.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex.padEnd(6, '0').slice(0, 6);
  const r = Number.parseInt(full.slice(0, 2), 16) || 0;
  const g = Number.parseInt(full.slice(2, 4), 16) || 0;
  const b = Number.parseInt(full.slice(4, 6), 16) || 0;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? '#101828' : '#ffffff';
}

/** Draw one numbered step marker. Assumes the context is in image coordinates. */
export function drawMarker(ctx: CanvasRenderingContext2D, marker: Marker): void {
  const radius = marker.size / 2;
  const ring = Math.max(1, marker.size * 0.08);
  ctx.save();
  ctx.translate(marker.x, marker.y);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = marker.size * 0.12;
  ctx.shadowOffsetY = marker.size * 0.05;
  ctx.fillStyle = marker.color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = ring;

  if (marker.shape === 'square') {
    roundRectPath(ctx, -radius, -radius, marker.size, marker.size, marker.size * 0.24);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
  } else if (marker.shape === 'ring') {
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.arc(0, 0, radius - ring / 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = ring;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius - ring, 0, Math.PI * 2);
    ctx.strokeStyle = marker.color;
    ctx.lineWidth = Math.max(1, marker.size * 0.14);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
  }

  ctx.shadowColor = 'transparent';
  ctx.font = `700 ${Math.max(8, Math.round(marker.size * 0.5))}px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = String(marker.number);
  if (marker.shape === 'ring') {
    ctx.lineWidth = Math.max(1, marker.size * 0.07);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.strokeText(label, 0, marker.size * 0.02);
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.fillStyle = readableTextColor(marker.color);
  }
  ctx.fillText(label, 0, marker.size * 0.02);
  ctx.restore();
}

/**
 * Flatten a committed base bitmap plus the non-destructive layers
 * (strokes, text, mosaic, markers, colour adjustments) into a fresh canvas.
 */
export function renderDoc(base: HTMLCanvasElement, doc: PixelDoc, options: RenderOptions = {}): HTMLCanvasElement {
  const scale = Math.min(1, Math.max(0.01, options.scale ?? 1));
  const width = base.width;
  const height = base.height;
  const deviceWidth = Math.max(1, Math.round(width * scale));
  const deviceHeight = Math.max(1, Math.round(height * scale));
  const out = createCanvas(deviceWidth, deviceHeight);
  const ctx = get2d(out);

  const filter = supportsContextFilter() && !isNeutralAdjust(doc.adjust) ? buildFilterString(doc.adjust) : '';
  // With a filter everything must be composed first and blitted once.
  const stage = filter ? createCanvas(deviceWidth, deviceHeight) : out;
  const stageCtx = get2d(stage);
  const scaleX = deviceWidth / width;
  const scaleY = deviceHeight / height;

  stageCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  composeLayers(stageCtx, base, doc, deviceWidth, deviceHeight);

  // Mosaic is a post-process on the composed pixels: it hides what is beneath.
  applyMosaic(stage, doc.strokes, scaleX);

  // Markers are annotations and always stay on top.
  if (doc.markers && doc.markers.length > 0) {
    stageCtx.save();
    stageCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    for (const marker of doc.markers) drawMarker(stageCtx, marker);
    stageCtx.restore();
  }

  if (filter) {
    ctx.filter = filter;
    ctx.drawImage(stage, 0, 0);
    ctx.filter = 'none';
  } else if (!isNeutralAdjust(doc.adjust)) {
    applyPixelAdjustments(ctx, deviceWidth, deviceHeight, doc.adjust);
  }

  applyWarmth(ctx, deviceWidth, deviceHeight, doc.adjust.warmth);
  return out;
}

/** Preview scale that keeps very large images interactive. */
export function previewScaleFor(size: { width: number; height: number }, maxSize = PREVIEW_MAX_SIZE): number {
  const longest = Math.max(size.width, size.height);
  if (!longest || longest <= maxSize) return 1;
  return Math.max(0.05, maxSize / longest);
}

/** A tiny data URL used by the filter preset swatches. */
export function renderThumbnail(base: HTMLCanvasElement, doc: PixelDoc, size = 96): string {
  const scale = Math.min(1, size / Math.max(base.width, base.height));
  const out = renderDoc(base, doc, { scale });
  return out.toDataURL('image/png');
}
