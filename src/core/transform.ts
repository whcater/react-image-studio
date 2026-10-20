import type { Rect } from '../types.js';
import { createCanvas, get2d } from './image.js';

/** Rotate a committed bitmap by a multiple of 90 degrees (clockwise). */
export function rotateCanvas(base: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized === 0) return base;
  const swap = normalized === 90 || normalized === 270;
  const out = createCanvas(swap ? base.height : base.width, swap ? base.width : base.height);
  const ctx = get2d(out);
  ctx.imageSmoothingEnabled = true;
  ctx.save();
  switch (normalized) {
    case 90:
      ctx.translate(out.width, 0);
      ctx.rotate(Math.PI / 2);
      break;
    case 180:
      ctx.translate(out.width, out.height);
      ctx.rotate(Math.PI);
      break;
    case 270:
      ctx.translate(0, out.height);
      ctx.rotate((3 * Math.PI) / 2);
      break;
    default:
      break;
  }
  ctx.drawImage(base, 0, 0);
  ctx.restore();
  return out;
}

/** Mirror a committed bitmap. */
export function flipCanvas(base: HTMLCanvasElement, axis: 'horizontal' | 'vertical'): HTMLCanvasElement {
  const out = createCanvas(base.width, base.height);
  const ctx = get2d(out);
  ctx.save();
  if (axis === 'horizontal') {
    ctx.translate(out.width, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, out.height);
    ctx.scale(1, -1);
  }
  ctx.drawImage(base, 0, 0);
  ctx.restore();
  return out;
}

/**
 * Cut a rectangle out of a committed bitmap. The rectangle is clamped and
 * rounded to whole pixels, so cropping never resamples the source.
 */
export function cropCanvas(base: HTMLCanvasElement, rect: Rect): HTMLCanvasElement {
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const width = Math.max(1, Math.min(base.width - x, Math.round(rect.width)));
  const height = Math.max(1, Math.min(base.height - y, Math.round(rect.height)));
  if (x === 0 && y === 0 && width === base.width && height === base.height) return base;
  const out = createCanvas(width, height);
  const ctx = get2d(out);
  ctx.drawImage(base, x, y, width, height, 0, 0, width, height);
  return out;
}

/** Overlay geometry (strokes + text) mapped through a rotation. */
export function rotateOverlays(
  overlays: { points: { x: number; y: number }[]; texts: { x: number; y: number; rotation: number }[] },
  degrees: number,
  size: { width: number; height: number },
): { points: { x: number; y: number }[]; texts: { x: number; y: number; rotation: number }[] } {
  const normalized = ((degrees % 360) + 360) % 360;
  const map = (p: { x: number; y: number }, rotation: number) => {
    switch (normalized) {
      case 90:
        return { x: size.height - p.y, y: p.x, rotation: rotation + 90 };
      case 180:
        return { x: size.width - p.x, y: size.height - p.y, rotation: rotation + 180 };
      case 270:
        return { x: p.y, y: size.width - p.x, rotation: rotation + 270 };
      default:
        return { x: p.x, y: p.y, rotation };
    }
  };
  return {
    points: overlays.points.map((p) => {
      const mapped = map(p, 0);
      return { x: mapped.x, y: mapped.y };
    }),
    texts: overlays.texts.map((t) => map(t, t.rotation)),
  };
}

/** Overlay geometry mapped through a flip. */
export function flipOverlays<T extends { x: number; y: number }>(
  points: T[],
  axis: 'horizontal' | 'vertical',
  size: { width: number; height: number },
): T[] {
  return points.map((p) =>
    axis === 'horizontal' ? { ...p, x: size.width - p.x } : { ...p, y: size.height - p.y },
  );
}

/** Translate overlay geometry after a crop. */
export function offsetOverlays<T extends { x: number; y: number }>(points: T[], dx: number, dy: number): T[] {
  return points.map((p) => ({ ...p, x: p.x - dx, y: p.y - dy }));
}
