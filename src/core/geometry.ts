import type { CropHandle, Point, Rect, Size } from '../types.js';

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const MIN_CROP_SIZE = 16;

/** Normalised rectangle from two arbitrary corners. */
export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

/** Round a rect to whole pixels so crops never resample the source. */
export function roundRect(rect: Rect): Rect {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  return { x, y, width, height };
}

/** Shift a rect so it lies fully inside `bounds`, preserving its size where possible. */
export function clampRectToBounds(rect: Rect, bounds: Size): Rect {
  const width = Math.min(rect.width, bounds.width);
  const height = Math.min(rect.height, bounds.height);
  return {
    x: clamp(rect.x, 0, Math.max(0, bounds.width - width)),
    y: clamp(rect.y, 0, Math.max(0, bounds.height - height)),
    width,
    height,
  };
}


export interface ResizeOptions {
  /** Called with the pointer delta in image pixels. */
  aspect?: number | null;
  bounds: Size;
  minSize?: number;
}

const HANDLE_AXIS: Record<CropHandle, { h: -1 | 0 | 1; v: -1 | 0 | 1 }> = {
  nw: { h: -1, v: -1 },
  n: { h: 0, v: -1 },
  ne: { h: 1, v: -1 },
  e: { h: 1, v: 0 },
  se: { h: 1, v: 1 },
  s: { h: 0, v: 1 },
  sw: { h: -1, v: 1 },
  w: { h: -1, v: 0 },
};

/**
 * Resize a crop rectangle by dragging `handle` with a `(dx, dy)` delta.
 * Bounds, minimum size and an optional aspect ratio are all respected.
 */
export function resizeCropRect(rect: Rect, handle: CropHandle, dx: number, dy: number, options: ResizeOptions): Rect {
  const minSize = options.minSize ?? MIN_CROP_SIZE;
  const { bounds } = options;
  const axis = HANDLE_AXIS[handle];

  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;

  if (axis.h === -1) left = clamp(left + dx, 0, right - minSize);
  if (axis.h === 1) right = clamp(right + dx, left + minSize, bounds.width);
  if (axis.v === -1) top = clamp(top + dy, 0, bottom - minSize);
  if (axis.v === 1) bottom = clamp(bottom + dy, top + minSize, bounds.height);

  let next: Rect = { x: left, y: top, width: right - left, height: bottom - top };

  const aspect = options.aspect ?? null;
  if (aspect && aspect > 0) {
    next = enforceAspect(next, aspect, axis, bounds, minSize);
  }
  return next;
}

/**
 * Force `rect` to the given width/height ratio, keeping the dragged edge
 * anchored at `axis` (the handle direction) and staying inside `bounds`.
 */
export function enforceAspect(
  rect: Rect,
  aspect: number,
  axis: { h: -1 | 0 | 1; v: -1 | 0 | 1 },
  bounds: Size,
  minSize = MIN_CROP_SIZE,
): Rect {
  let width = Math.max(minSize, rect.width);
  let height = Math.max(minSize, rect.height);

  // Corner handles: height follows width. Edge handles: the free dimension follows it.
  if (axis.h !== 0 && axis.v !== 0) {
    height = width / aspect;
  } else if (axis.h !== 0) {
    height = width / aspect;
  } else {
    width = height * aspect;
  }

  // Shrink to fit the available bounds while preserving the ratio.
  const maxW = bounds.width;
  const maxH = bounds.height;
  if (width > maxW) {
    width = maxW;
    height = width / aspect;
  }
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  width = Math.max(minSize, Math.floor(width));
  height = Math.max(minSize, Math.floor(height));

  // Anchor: the edge opposite the dragged handle stays put.
  let x = rect.x;
  let y = rect.y;
  if (axis.h === -1) x = rect.x + rect.width - width;
  else if (axis.h === 0) x = rect.x + (rect.width - width) / 2;
  if (axis.v === -1) y = rect.y + rect.height - height;
  else if (axis.v === 0) y = rect.y + (rect.height - height) / 2;

  x = clamp(x, 0, Math.max(0, bounds.width - width));
  y = clamp(y, 0, Math.max(0, bounds.height - height));
  return { x, y, width, height };
}

export interface HandleHit {
  handle: CropHandle | 'move' | null;
}

/**
 * Hit test a crop overlay. `tolerance` is expressed in image pixels so the
 * hit area stays constant on screen regardless of zoom.
 */
export function hitTestCrop(rect: Rect, point: Point, tolerance: number): HandleHit {
  const { x, y, width, height } = rect;
  const nearLeft = Math.abs(point.x - x) <= tolerance;
  const nearRight = Math.abs(point.x - (x + width)) <= tolerance;
  const nearTop = Math.abs(point.y - y) <= tolerance;
  const nearBottom = Math.abs(point.y - (y + height)) <= tolerance;
  const withinX = point.x >= x - tolerance && point.x <= x + width + tolerance;
  const withinY = point.y >= y - tolerance && point.y <= y + height + tolerance;

  if (!withinX || !withinY) return { handle: null };
  if (nearLeft && nearTop) return { handle: 'nw' };
  if (nearRight && nearTop) return { handle: 'ne' };
  if (nearRight && nearBottom) return { handle: 'se' };
  if (nearLeft && nearBottom) return { handle: 'sw' };
  if (nearLeft) return { handle: 'w' };
  if (nearRight) return { handle: 'e' };
  if (nearTop) return { handle: 'n' };
  if (nearBottom) return { handle: 's' };
  return { handle: 'move' };
}

/** Screen-space positions of the eight resize handles. */
export function handlePositions(rect: Rect): Record<CropHandle, Point> {
  const { x, y, width, height } = rect;
  return {
    nw: { x, y },
    n: { x: x + width / 2, y },
    ne: { x: x + width, y },
    e: { x: x + width, y: y + height / 2 },
    se: { x: x + width, y: y + height },
    s: { x: x + width / 2, y: y + height },
    sw: { x, y: y + height },
    w: { x, y: y + height / 2 },
  };
}

export const CURSOR_FOR_HANDLE: Record<CropHandle | 'move', string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
  move: 'move',
};

/** A centred rect covering `ratio` (width/height) of the image. */
export function centeredAspectRect(size: Size, ratio: number | null): Rect {
  if (!ratio || ratio <= 0) return { x: 0, y: 0, ...size };
  const imageRatio = size.width / size.height;
  let width: number;
  let height: number;
  if (ratio >= imageRatio) {
    // The target is wider than the image: it spans the full width.
    width = size.width;
    height = Math.min(size.height, width / ratio);
  } else {
    // The target is relatively taller: it spans the full height.
    height = size.height;
    width = Math.min(size.width, height * ratio);
  }
  width = Math.max(1, Math.floor(width));
  height = Math.max(1, Math.floor(height));
  return {
    x: Math.floor((size.width - width) / 2),
    y: Math.floor((size.height - height) / 2),
    width,
    height,
  };
}

// ---------------------------------------------------------------------------
// View transform: image space -> screen space
// ---------------------------------------------------------------------------

export interface ViewTransform {
  /** Image pixels -> CSS pixels factor. */
  scale: number;
  /** Translation in CSS pixels. */
  x: number;
  y: number;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 16;

export function imageToScreen(point: Point, view: ViewTransform): Point {
  return { x: point.x * view.scale + view.x, y: point.y * view.scale + view.y };
}

export function screenToImage(point: Point, view: ViewTransform): Point {
  return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
}

/** Scale and centre `image` inside `viewport`, never magnifying past 1:1. */
export function fitView(image: Size, viewport: Size, allowUpscale = false): ViewTransform {
  if (!image.width || !image.height || !viewport.width || !viewport.height) {
    return { scale: 1, x: 0, y: 0 };
  }
  const raw = Math.min(viewport.width / image.width, viewport.height / image.height);
  const scale = allowUpscale ? raw : Math.min(raw, 1);
  return {
    scale,
    x: (viewport.width - image.width * scale) / 2,
    y: (viewport.height - image.height * scale) / 2,
  };
}

export function clampZoom(scale: number): number {
  return clamp(scale, MIN_ZOOM, MAX_ZOOM);
}

/** Zoom around a focal point given in screen coordinates. */
export function zoomAt(view: ViewTransform, factor: number, focal: Point): ViewTransform {
  const scale = clampZoom(view.scale * factor);
  const ratio = scale / view.scale;
  return {
    scale,
    x: focal.x - (focal.x - view.x) * ratio,
    y: focal.y - (focal.y - view.y) * ratio,
  };
}

/**
 * Keep the image from being dragged completely out of view.
 * At least `margin` CSS pixels of the image stay visible on every axis.
 */
export function clampView(view: ViewTransform, image: Size, viewport: Size, margin = 80): ViewTransform {
  const w = image.width * view.scale;
  const h = image.height * view.scale;
  const minX = Math.min(margin - w, (viewport.width - w) / 2);
  const maxX = Math.max(viewport.width - margin, (viewport.width - w) / 2);
  const minY = Math.min(margin - h, (viewport.height - h) / 2);
  const maxY = Math.max(viewport.height - margin, (viewport.height - h) / 2);
  return {
    scale: view.scale,
    x: clamp(view.x, Math.min(minX, maxX), Math.max(minX, maxX)),
    y: clamp(view.y, Math.min(minY, maxY), Math.max(minY, maxY)),
  };
}

/** Dimensions after applying a rotation of `deg` (0/90/180/270). */
export function rotatedSize(size: Size, deg: number): Size {
  const normalized = ((deg % 360) + 360) % 360;
  return normalized === 90 || normalized === 270
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}
