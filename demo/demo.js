/**
 * Live demo for react-image-studio.
 *
 * Runs straight from the built output (../dist/esm) with React from esm.sh, so
 * there is no bundler in the loop: open demo/index.html over any static server.
 *
 *   npx serve .        # or: python3 -m http.server
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { ImageStudio } from '../dist/esm/index.js';

const html = htm.bind(React.createElement);

/** Paint a colourful test photograph so the demo needs no binary assets. */
function createSampleImage(width = 1600, height = 1000) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#122a5c');
  sky.addColorStop(0.45, '#3b6ea8');
  sky.addColorStop(0.75, '#e9955f');
  sky.addColorStop(1, '#f7d9a8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Sun
  const sun = ctx.createRadialGradient(width * 0.72, height * 0.62, 10, width * 0.72, height * 0.62, 220);
  sun.addColorStop(0, 'rgba(255, 246, 214, 0.98)');
  sun.addColorStop(0.35, 'rgba(255, 205, 128, 0.75)');
  sun.addColorStop(1, 'rgba(255, 170, 90, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);

  // Hills
  const hills = [
    { color: '#1b3a4b', y: 0.74, amp: 70 },
    { color: '#173243', y: 0.82, amp: 50 },
    { color: '#0f2531', y: 0.9, amp: 34 },
  ];
  for (const hill of hills) {
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 20) {
      const y = height * hill.y + Math.sin(x / 220 + hill.y * 9) * hill.amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = hill.color;
    ctx.fill();
  }

  // Confetti, to make filters and warmth obvious
  const palette = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c86bff'];
  for (let i = 0; i < 90; i += 1) {
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height * 0.7, 4 + Math.random() * 14, 0, Math.PI * 2);
    ctx.fillStyle = palette[i % palette.length];
    ctx.globalAlpha = 0.25 + Math.random() * 0.4;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return canvas.toDataURL('image/png');
}

function App() {
  const editorRef = useRef(null);
  const [source, setSource] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [locale, setLocale] = useState('en');
  const [log, setLog] = useState('Ready — try the crop, filter and brush tools.');

  useEffect(() => {
    setSource(createSampleImage());
  }, []);

  const labels = useMemo(() => (locale === 'zh-CN' ? 'zh-CN' : undefined), [locale]);

  const onPickFile = useCallback((event) => {
    const file = event.currentTarget.files?.[0];
    if (file) setSource(file);
  }, []);

  const onSave = useCallback((result) => {
    setLog(`Exported ${result.filename} · ${result.format.toUpperCase()} · ${result.width}×${result.height}`);
  }, []);

  const exportWebp = useCallback(async () => {
    const blob = await editorRef.current?.export('webp', 0.85);
    if (blob) setLog(`Programmatic export: ${(blob.size / 1024).toFixed(1)} KB WebP`);
  }, []);

  return html`
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>react-image-studio</h1>
          <code>none-destructive react image editor</code>
        </div>
        <div className="controls">
          <label className="file-picker" style=${{ display: 'inline-flex' }}>
            <input type="file" accept="image/*" onChange=${onPickFile} style=${{ color: '#9fb1c9', fontSize: '12px' }} />
          </label>
          <select value=${locale} onChange=${(e) => setLocale(e.currentTarget.value)} aria-label="Language">
            <option value="en">English</option>
            <option value="zh-CN">中文</option>
          </select>
          <button type="button" onClick=${() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            ${theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
          <button type="button" onClick=${exportWebp}>Export WebP (.85)</button>
          <button type="button" onClick=${() => setSource(createSampleImage())}>New sample</button>
        </div>
      </header>

      <main className="editor">
        ${source
          ? html`<${ImageStudio}
              ref=${editorRef}
              src=${source}
              theme=${theme}
              labels=${labels}
              defaultFormat="webp"
              onSave=${onSave}
              onError=${(error) => setLog(`Error: ${error.message}`)}
            />`
          : null}
      </main>

      <footer className="log">
        <b>log</b>
        <span>${log}</span>
      </footer>
    </div>
  `;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);
