/**
 * Docs-site demo: mounts the real component from ./lib/image-studio.js and
 * wires the toolbar above it. Plain React.createElement — no build step.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ImageStudio, VERSION } from './lib/image-studio.js';

const h = React.createElement;

/** Paint a colourful test photo so the demo needs no binary assets. */
function createSampleImage(width = 1600, height = 1000) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#10224a');
  sky.addColorStop(0.45, '#3d6fa8');
  sky.addColorStop(0.74, '#e9955f');
  sky.addColorStop(1, '#f7d9a8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sun = ctx.createRadialGradient(width * 0.72, height * 0.6, 8, width * 0.72, height * 0.6, 230);
  sun.addColorStop(0, 'rgba(255,248,214,.98)');
  sun.addColorStop(0.35, 'rgba(255,205,128,.72)');
  sun.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);

  const hills = [
    { color: '#1b3a4b', y: 0.73, amp: 70 },
    { color: '#173243', y: 0.82, amp: 50 },
    { color: '#0f2531', y: 0.9, amp: 34 },
  ];
  for (const hill of hills) {
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 18) {
      ctx.lineTo(x, height * hill.y + Math.sin(x / 210 + hill.y * 9) * hill.amp);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = hill.color;
    ctx.fill();
  }

  const palette = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c86bff'];
  for (let i = 0; i < 80; i += 1) {
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height * 0.66, 4 + Math.random() * 13, 0, Math.PI * 2);
    ctx.globalAlpha = 0.22 + Math.random() * 0.38;
    ctx.fillStyle = palette[i % palette.length];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return canvas.toDataURL('image/png');
}

const state = {
  source: null,
  theme: 'light',
  locale: 'en',
  format: 'webp',
  log: 'Ready — try crop, filters, mosaic and markers.',
  nonce: 0,
};

const logEl = () => document.getElementById('demo-log');
const setLog = (text) => {
  state.log = text;
  const el = logEl();
  if (el) el.textContent = text;
};

// ── mount ─────────────────────────────────────────────────────────────────
const host = document.getElementById('demo-root');
const root = createRoot(host);

function render() {
  root.render(
    h(ImageStudio, {
      key: `${state.nonce}-${state.format}-${state.locale}-${state.theme}`,
      src: state.source,
      theme: state.theme,
      labels: state.locale === 'en' ? undefined : 'zh-CN',
      defaultFormat: state.format,
      defaultTool: 'move',
      onSave: (result) => {
        setLog(
          `Exported ${result.filename} · ${result.format.toUpperCase()} · ${result.width}×${result.height} · ${(
            result.blob.size / 1024
          ).toFixed(1)} KB`,
        );
      },
      onError: (error) => setLog(`Error: ${error.message}`),
      onDocChange: (doc) => {
        const bits = [];
        if (doc.preset) bits.push(`preset=${doc.preset}`);
        if (doc.strokes.length) bits.push(`${doc.strokes.length} strokes`);
        if (doc.texts.length) bits.push(`${doc.texts.length} text`);
        if (doc.markers.length) bits.push(`${doc.markers.length} markers`);
        if (bits.length) setLog(`Document: ${bits.join(' · ')}`);
      },
    }),
  );
}

state.source = createSampleImage();
render();
setLog(`react-image-studio ${VERSION} loaded — ${state.source.length > 0 ? 'sample image ready' : 'no image'}`);

// ── controls ──────────────────────────────────────────────────────────────
document.getElementById('demo-sample').addEventListener('click', () => {
  state.nonce += 1;
  state.source = createSampleImage();
  render();
  setLog('Generated a new sample image.');
});

document.getElementById('demo-upload').addEventListener('change', (event) => {
  const file = event.currentTarget.files && event.currentTarget.files[0];
  if (!file) return;
  state.nonce += 1;
  state.source = file;
  render();
  setLog(`Loaded local file: ${file.name}`);
  event.currentTarget.value = '';
});

const localeBtn = document.getElementById('demo-locale');
localeBtn.addEventListener('click', () => {
  state.locale = state.locale === 'en' ? 'zh-CN' : 'en';
  localeBtn.textContent = state.locale === 'en' ? 'EN' : '中文';
  localeBtn.dataset.active = state.locale === 'en' ? 'false' : 'true';
  render();
  setLog(`UI language: ${state.locale === 'en' ? 'English' : '中文'}`);
});

const themeBtn = document.getElementById('demo-theme');
const THEMES = ['light', 'dark', 'auto'];
themeBtn.textContent = `Theme: ${state.theme}`;
themeBtn.addEventListener('click', () => {
  state.theme = THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length];
  themeBtn.textContent = `Theme: ${state.theme}`;
  render();
  setLog(`Chrome theme: ${state.theme}`);
});

document.getElementById('demo-format').addEventListener('change', (event) => {
  state.format = event.currentTarget.value;
  render();
  setLog(`Default export format: ${state.format.toUpperCase()}`);
});

// Copy buttons for the code blocks.
for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const target = document.querySelector(button.dataset.copy);
    const text = target ? target.textContent : '';
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'copied';
    } catch {
      button.textContent = 'press ⌘C';
    }
    setTimeout(() => {
      button.textContent = 'copy';
    }, 1500);
  });
}
