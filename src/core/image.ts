import type { ExportFormat } from '../types.js';

/** Create a canvas element with an explicit pixel size. */
export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('react-image-studio: 2D canvas context is not available');
  return ctx;
}

export const isBlob = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob;

export const isFile = (value: unknown): value is File =>
  typeof File !== 'undefined' && value instanceof File;

export interface LoadOptions {
  /** Value passed to `img.crossOrigin`. Defaults to `anonymous`. */
  crossOrigin?: string | null;
  /** Abort signal forwarded to the underlying loaders. */
  signal?: AbortSignal;
}

function assertBrowser(): void {
  if (typeof document === 'undefined') {
    throw new Error('react-image-studio: loading images requires a browser environment');
  }
}

function loadFromUrl(url: string, options: LoadOptions): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (options.crossOrigin !== null) {
      img.crossOrigin = options.crossOrigin ?? 'anonymous';
    }
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      options.signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Image loading aborted', 'AbortError'));
    };
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = () => {
      cleanup();
      reject(new Error(`react-image-studio: failed to load image "${url.slice(0, 120)}"`));
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    img.src = url;
  });
}

function loadFromBlob(blob: Blob, options: LoadOptions): Promise<HTMLImageElement> {
  assertBrowser();
  const url = URL.createObjectURL(blob);
  return loadFromUrl(url, { ...options, crossOrigin: null })
    .catch((error: unknown) => {
      URL.revokeObjectURL(url);
      throw error;
    })
    .then((img) => {
      // The bitmap is decoded already; the object URL can be released.
      URL.revokeObjectURL(url);
      return img;
    });
}

/**
 * Decode any supported source into an `HTMLImageElement`.
 * Remote URLs are requested with `crossOrigin: 'anonymous'` so the canvas
 * stays untainted and exports keep working.
 */
export function loadImage(src: string | Blob | File, options: LoadOptions = {}): Promise<HTMLImageElement> {
  assertBrowser();
  if (options.signal?.aborted) {
    return Promise.reject(new DOMException('Image loading aborted', 'AbortError'));
  }
  if (isBlob(src)) return loadFromBlob(src, options);
  return loadFromUrl(src, options);
}

/** Draw a decoded image (or bitmap) into a canvas, optionally downscaling it. */
export function sourceToCanvas(
  source: CanvasImageSource & { width: number; height: number },
  maxSize = 0,
): HTMLCanvasElement {
  const natural = getSourceSize(source);
  const ratio = maxSize > 0 ? Math.min(1, maxSize / Math.max(natural.width, natural.height)) : 1;
  const canvas = createCanvas(natural.width * ratio, natural.height * ratio);
  const ctx = get2d(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function getSourceSize(source: CanvasImageSource & { width?: number; height?: number }): {
  width: number;
  height: number;
} {
  const anySource = source as unknown as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number; width?: number; height?: number; displayWidth?: number };
  const width = anySource.naturalWidth ?? anySource.videoWidth ?? anySource.width ?? 0;
  const height = anySource.naturalHeight ?? anySource.videoHeight ?? anySource.height ?? 0;
  return { width, height };
}

export const MIME_BY_FORMAT: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const EXTENSION_BY_FORMAT: Record<ExportFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
};

export function mimeFor(format: ExportFormat): string {
  return MIME_BY_FORMAT[format] ?? MIME_BY_FORMAT.png;
}

export function extensionFor(format: ExportFormat): string {
  return EXTENSION_BY_FORMAT[format] ?? 'png';
}

/** Whether the running browser can actually encode `format`. */
export function supportsFormat(format: ExportFormat): boolean {
  if (typeof document === 'undefined') return format === 'png';
  const canvas = createCanvas(1, 1);
  return canvas.toDataURL(mimeFor(format)).startsWith(`data:${mimeFor(format)}`);
}

/** Flatten transparency onto white so JPEG output looks like a photo. */
export function flattenOnBackground(canvas: HTMLCanvasElement, background = '#ffffff'): HTMLCanvasElement {
  const out = createCanvas(canvas.width, canvas.height);
  const ctx = get2d(out);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/** Canvas -> Blob, with a `toDataURL` fallback for old Safari builds. */
export function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat, quality = 0.92): Promise<Blob> {
  const mime = mimeFor(format);
  const q = Math.min(1, Math.max(0, quality));
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error(`react-image-studio: the browser could not encode ${mime}`));
        },
        mime,
        q,
      );
      return;
    }
    try {
      const dataUrl = canvas.toDataURL(mime, q);
      const base64 = dataUrl.split(',')[1] ?? '';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      resolve(new Blob([bytes], { type: mime }));
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/** Replace characters that are illegal in file names. */
export function sanitizeFilename(name: string, fallback = 'edited-image'): string {
  const cleaned = name
    .replace(/^.*[\\/]/, '')
    .replace(/[\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

/** Build `name.format` from a user supplied base name. */
export function withExtension(name: string, format: ExportFormat): string {
  const base = sanitizeFilename(name).replace(/\.[a-z0-9]{1,5}$/i, '');
  return `${base}.${extensionFor(format)}`;
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Copy an image blob to the clipboard when the platform allows it. */
export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
    return false;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

/** Bytes -> human readable size. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  const rounded = Number.isInteger(value) ? String(value) : value >= 10 ? String(Math.round(value)) : value.toFixed(1);
  return `${rounded} ${units[index]}`;
}
