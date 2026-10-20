import type { Adjustments, Stroke, TextItem } from '../types.js';
import { buildFilterString, isNeutralAdjust } from './filters.js';
import { createCanvas, get2d } from './image.js';

/** The share of the document that actually affects pixels. */
export interface PixelDoc {
  adjust: Adjustments;
  strokes: Stroke[];
  texts: TextItem[];
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

/** Compose base pixels + strokes + text into `target`, in image coordinates. */
function composeLayers(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  doc: PixelDoc,
  deviceWidth: number,
  deviceHeight: number,
): void {
  ctx.drawImage(base, 0, 0, base.width, base.height);
  if (doc.strokes.length > 0) {
    const paint = createCanvas(deviceWidth, deviceHeight);
    const paintCtx = get2d(paint);
    // Re-use the caller's scale by drawing in image coordinates.
    const scale = deviceWidth / base.width;
    paintCtx.setTransform(scale, 0, 0, scale, 0, 0);
    drawStrokesLayer(paintCtx, doc.strokes);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(paint, 0, 0);
    ctx.restore();
  }
  for (const item of doc.texts) drawTextItem(ctx, item);
}

/**
 * Flatten a committed base bitmap plus the non-destructive layers
 * (strokes, text, colour adjustments) into a fresh canvas.
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

  if (filter) {
    // Everything must be filtered together, so compose first and blit once.
    const stage = createCanvas(deviceWidth, deviceHeight);
    const stageCtx = get2d(stage);
    stageCtx.setTransform(deviceWidth / width, 0, 0, deviceHeight / height, 0, 0);
    composeLayers(stageCtx, base, doc, deviceWidth, deviceHeight);
    ctx.filter = filter;
    ctx.drawImage(stage, 0, 0);
    ctx.filter = 'none';
  } else {
    ctx.setTransform(deviceWidth / width, 0, 0, deviceHeight / height, 0, 0);
    composeLayers(ctx, base, doc, deviceWidth, deviceHeight);
    if (!isNeutralAdjust(doc.adjust)) applyPixelAdjustments(ctx, deviceWidth, deviceHeight, doc.adjust);
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
