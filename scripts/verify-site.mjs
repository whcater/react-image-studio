#!/usr/bin/env node
/**
 * End-to-end check of the docs site without a browser.
 *
 * Builds a jsdom from docs/index.html, stubs the platform bits jsdom lacks
 * (2D context, ResizeObserver, Image, matchMedia), then imports the real
 * docs/app.js — which mounts the editor from docs/lib/image-studio.js and
 * wires the toolbar — and asserts the page actually works.
 *
 * jsdom is resolved from the sibling dsh plugin project, where it is installed
 * as a dev dependency.
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const docsDir = path.join(root, 'docs');
const jsdomRequire = createRequire(path.resolve(root, '../dsh-plugin-image-studio/package.json'));
const { JSDOM } = jsdomRequire('jsdom');

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};
const ok = (message) => console.log(`✓ ${message}`);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!existsSync(path.join(docsDir, 'lib/image-studio.js'))) {
  fail('docs/lib/image-studio.js is missing — run `npm run build:site`');
}

const dom = new JSDOM(readFileSync(path.join(docsDir, 'index.html'), 'utf8'), {
  pretendToBeVisual: true,
  url: 'http://127.0.0.1:8080/',
});
const { window } = dom;

for (const key of [
  'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent',
  'PointerEvent', 'Blob', 'File', 'FormData', 'ImageData', 'CustomEvent', 'MutationObserver', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame',
]) {
  if (key in window) globalThis[key] = window[key];
}

const makeContext = (canvas) => {
  const gradient = { addColorStop() {} };
  const ctx = {
    canvas, filter: 'none', globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    imageSmoothingEnabled: true, imageSmoothingQuality: 'low',
  };
  for (const name of ['save', 'restore', 'setTransform', 'translate', 'rotate', 'scale', 'clearRect', 'fillRect',
    'drawImage', 'beginPath', 'moveTo', 'lineTo', 'arc', 'rect', 'closePath', 'stroke', 'fill', 'fillText', 'putImageData', 'clip']) {
    ctx[name] = () => {};
  }
  ctx.measureText = (text) => ({ width: String(text).length * 6 });
  ctx.createLinearGradient = () => gradient;
  ctx.createRadialGradient = () => gradient;
  ctx.getImageData = (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h });
  return ctx;
};
window.HTMLCanvasElement.prototype.getContext = function getContext(type) {
  if (type !== '2d') return null;
  if (!this.__ctx) this.__ctx = makeContext(this);
  return this.__ctx;
};
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo=';
window.HTMLCanvasElement.prototype.toBlob = function toBlob(cb) {
  cb(new window.Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
};
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
window.ResizeObserver = ResizeObserverStub;
globalThis.ResizeObserver = ResizeObserverStub;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.matchMedia = window.matchMedia;
class ImageStub {
  constructor() { this.naturalWidth = 800; this.naturalHeight = 600; this.width = 800; this.height = 600; }
  set src(value) { this._src = value; window.setTimeout(() => this.onload && this.onload(), 0); }
  get src() { return this._src; }
}
window.Image = ImageStub;
globalThis.Image = ImageStub;
window.URL.createObjectURL = () => 'blob:docs-site-test';
window.URL.revokeObjectURL = () => {};
globalThis.URL = window.URL;

// ── load the real page module ───────────────────────────────────────────────
const errors = [];
window.addEventListener('error', (event) => errors.push(event.message));
process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED:', (error && error.stack) || error);
  process.exit(9);
});

await import(pathToFileURL(path.join(docsDir, 'app.js')).href);
await wait(400);

const rootEl = window.document.getElementById('demo-root');
if (!rootEl) fail('#demo-root missing');

// The editor mounts asynchronously (image decode goes through a timer).
for (let i = 0; i < 40 && !rootEl.querySelector('.ris-root'); i += 1) await wait(50);
const editor = rootEl.querySelector('.ris-root');
if (!editor) fail(`the editor did not mount inside #demo-root (${errors.join('; ') || 'no errors reported'})`);
ok('editor mounted into #demo-root');

const toolLabels = [...window.document.querySelectorAll('.ris-tool')].map((el) => el.getAttribute('aria-label'));
ok(`${toolLabels.length} tool buttons: ${toolLabels.join(' · ')}`);
if (!toolLabels.includes('Mosaic')) fail('mosaic tool missing from the toolbar');
if (!toolLabels.includes('Marker')) fail('marker (step) tool missing from the toolbar');
if (!toolLabels.includes('Crop')) fail('crop tool missing from the toolbar');

const log = () => window.document.getElementById('demo-log').textContent;
if (!log().includes('react-image-studio')) fail(`the demo log was not initialised: ${log()}`);
ok(`log initialised: ${log().slice(0, 70)}`);

// Locale toggle must re-render the editor in Chinese.
window.document.getElementById('demo-locale').click();
await wait(300);
for (let i = 0; i < 40 && !window.document.querySelector('.ris-tool[aria-label="马赛克"]'); i += 1) await wait(50);
if (!window.document.querySelector('.ris-tool[aria-label="马赛克"]')) fail('locale toggle did not switch the UI to zh-CN');
ok('locale toggle → zh-CN labels in the toolbar');

// Theme toggle must change the root data attribute.
window.document.getElementById('demo-theme').click();
await wait(300);
const themed = rootEl.querySelector('.ris-root');
if (!themed || themed.getAttribute('data-theme') !== 'dark') {
  fail(`theme toggle did not apply dark: ${themed ? themed.getAttribute('data-theme') : 'no root'}`);
}
ok('theme toggle → dark');

// Format switch remounts with a new default and keeps working.
const formatSelect = window.document.getElementById('demo-format');
formatSelect.value = 'png';
formatSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(400);
if (!rootEl.querySelector('.ris-root')) fail('the editor disappeared after changing the export format');
ok('format switch → editor remounted');

// Copy buttons are wired (clipboard is missing in jsdom, so it must not throw).
const copyButton = window.document.querySelector('[data-copy]');
copyButton.click();
await wait(120);
ok(`copy button handled without throwing (label: "${copyButton.textContent}")`);

// The bundled library itself must export the 1.1 surface.
const lib = await import(pathToFileURL(path.join(docsDir, 'lib/image-studio.js')).href);
if (typeof lib.ImageStudio !== 'object' && typeof lib.ImageStudio !== 'function') fail('bundle does not export ImageStudio');
if (!lib.VERSION) fail('bundle does not export VERSION');
if (!lib.DEFAULT_MARKER || !lib.DEFAULT_MOSAIC) fail('bundle is missing the marker/mosaic defaults');
ok(`bundle exports: VERSION ${lib.VERSION} · ${lib.FILTER_PRESETS.length} presets · marker ${JSON.stringify(lib.DEFAULT_MARKER.shape)} · mosaic ${JSON.stringify(lib.DEFAULT_MOSAIC.style)}`);

console.log('\nall docs-site checks passed');
process.exit(0);
