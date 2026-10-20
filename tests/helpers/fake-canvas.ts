/**
 * A tiny canvas stand-in so the render pipeline can be exercised in Node
 * (jsdom has no 2D context). Every drawing call is recorded in order, which
 * lets the tests assert *how* the document is composited, not just that it runs.
 */

export type RecordedCall = { op: string; args: unknown[] };

let canvasSeq = 0;

export class FakeGradient {
  addColorStop(): void {}
}

export class FakeContext {
  readonly id: number;
  readonly calls: RecordedCall[] = [];

  filter = 'none';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  fillStyle = '#000';
  strokeStyle = '#000';
  lineWidth = 1;
  lineCap: CanvasLineCap = 'butt';
  lineJoin: CanvasLineJoin = 'miter';
  font = '10px sans-serif';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  imageSmoothingEnabled = true;
  imageSmoothingQuality: ImageSmoothingQuality = 'low';

  constructor(id: number) {
    this.id = id;
  }

  record(op: string, ...args: unknown[]): void {
    this.calls.push({ op, args });
  }

  ops(): string[] {
    return this.calls.map((call) => call.op);
  }

  save(): void {
    this.record('save');
  }
  restore(): void {
    this.record('restore');
  }
  setTransform(...args: number[]): void {
    this.record('setTransform', ...args);
  }
  translate(...args: number[]): void {
    this.record('translate', ...args);
  }
  rotate(...args: number[]): void {
    this.record('rotate', ...args);
  }
  scale(...args: number[]): void {
    this.record('scale', ...args);
  }
  clearRect(...args: number[]): void {
    this.record('clearRect', ...args);
  }
  fillRect(...args: unknown[]): void {
    this.record('fillRect', ...args, this.fillStyle, this.globalCompositeOperation);
  }
  drawImage(...args: unknown[]): void {
    this.record('drawImage', ...args, this.filter);
  }
  beginPath(): void {
    this.record('beginPath');
  }
  moveTo(...args: number[]): void {
    this.record('moveTo', ...args);
  }
  lineTo(...args: number[]): void {
    this.record('lineTo', ...args);
  }
  arc(...args: number[]): void {
    this.record('arc', ...args);
  }
  closePath(): void {
    this.record('closePath');
  }
  stroke(): void {
    this.record('stroke', this.lineWidth, this.strokeStyle, this.globalCompositeOperation, this.globalAlpha);
  }
  fill(): void {
    this.record('fill', this.fillStyle, this.globalCompositeOperation);
  }
  fillText(text: string, ...args: number[]): void {
    this.record('fillText', text, ...args);
  }
  measureText(text: string): TextMetrics {
    // Deterministic metrics: 0.6em per character.
    const size = Number.parseFloat(this.font) || 10;
    return { width: text.length * size * 0.6 } as TextMetrics;
  }
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData {
    this.record('getImageData', sx, sy, sw, sh);
    return { data: new Uint8ClampedArray(sw * sh * 4), width: sw, height: sh } as ImageData;
  }
  putImageData(...args: unknown[]): void {
    this.record('putImageData', ...args);
  }
  createLinearGradient(): FakeGradient {
    return new FakeGradient();
  }
  drawFocusIfNeeded(): void {}
}

export class FakeCanvas {
  readonly id: number;
  width: number;
  height: number;
  readonly tagName = 'CANVAS';
  readonly ctx: FakeContext;
  readonly toBlobs: { type?: string; quality?: number }[] = [];

  constructor(width = 300, height = 150) {
    canvasSeq += 1;
    this.id = canvasSeq;
    this.width = width;
    this.height = height;
    this.ctx = new FakeContext(this.id);
  }

  getContext(type: string): FakeContext {
    if (type !== '2d') throw new Error(`unsupported context ${type}`);
    return this.ctx;
  }

  toDataURL(type = 'image/png'): string {
    this.ctx.record('toDataURL', type);
    return `data:${type};base64,AAAA`;
  }

  toBlob(callback: (blob: Blob | null) => void, type = 'image/png', quality?: number): void {
    this.toBlobs.push({ type, quality });
    callback(new Blob([new Uint8Array([1, 2, 3])], { type }));
  }
}

export interface FakeDocument {
  createElement(tag: string): FakeCanvas;
  head: { appendChild(node: unknown): void };
  documentElement: { appendChild(node: unknown): void };
  body: { appendChild(node: unknown): void };
}

/** Install a minimal `document` (and optional `Image`) on the global scope. */
export function installFakeDom(): { canvases: FakeCanvas[]; uninstall(): void } {
  const canvases: FakeCanvas[] = [];
  const documentStub: FakeDocument = {
    createElement(tag: string) {
      if (tag !== 'canvas') throw new Error(`unexpected element ${tag}`);
      const canvas = new FakeCanvas();
      canvases.push(canvas);
      return canvas;
    },
    head: { appendChild() {} },
    documentElement: { appendChild() {} },
    body: { appendChild() {} },
  };
  const globalRef = globalThis as unknown as { document?: unknown };
  const previous = globalRef.document;
  globalRef.document = documentStub;
  return {
    canvases,
    uninstall() {
      if (previous === undefined) delete globalRef.document;
      else globalRef.document = previous;
    },
  };
}

/** Reset the FakeCanvas sequence so assertions can rely on ids.
 */
export function resetCanvasSequence(): void {
  canvasSeq = 0;
}

export { FakeCanvas as Canvas };
