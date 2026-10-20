import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { ImageStudio } from '../src/ImageStudio.js';
import { resolveLabels, EN_LABELS, ZH_CN_LABELS } from '../src/i18n.js';
import { FILTER_PRESETS } from '../src/core/filters.js';

test('ImageStudio renders its empty state on the server without a DOM', () => {
  const html = renderToString(createElement(ImageStudio, { src: null }));
  assert.match(html, /ris-root/);
  assert.match(html, /Drop an image to start/);
  assert.match(html, /Choose image/);
});

test('ImageStudio accepts a full tool list and a default tool', () => {
  const html = renderToString(
    createElement(ImageStudio, {
      src: null,
      tools: ['crop', 'adjust', 'export'],
      defaultTool: 'adjust',
    }),
  );
  assert.match(html, /aria-label="Crop"/);
  assert.match(html, /aria-label="Adjust"/);
  assert.match(html, /aria-label="Export"/);
  assert.doesNotMatch(html, /aria-label="Brush"/);
});

test('ImageStudio can be fully localised', () => {
  const html = renderToString(createElement(ImageStudio, { src: null, labels: 'zh-CN' }));
  assert.match(html, /拖拽图片开始编辑/);
  assert.match(html, /选择图片/);
});

test('theme and className/style props land on the root element', () => {
  const html = renderToString(
    createElement(ImageStudio, {
      src: null,
      theme: 'dark',
      className: 'my-editor',
      style: { height: 600 },
    }),
  );
  assert.match(html, /ris-theme-dark/);
  assert.match(html, /my-editor/);
  assert.match(html, /height:600px/);
});

test('labels resolve with partial overrides', () => {
  assert.equal(resolveLabels('zh-CN'), ZH_CN_LABELS);
  assert.equal(resolveLabels(), EN_LABELS);
  const merged = resolveLabels({ app: { ...EN_LABELS.app, undo: 'Back' } });
  assert.equal(merged.app.undo, 'Back');
  assert.equal(merged.app.redo, 'Redo', 'untouched keys fall back to English');
});

test('every filter preset has a translated label in both languages', () => {
  for (const preset of FILTER_PRESETS) {
    assert.ok(EN_LABELS.presets[preset.labelKey], `missing en label for ${preset.id}`);
    assert.ok(ZH_CN_LABELS.presets[preset.labelKey], `missing zh label for ${preset.id}`);
  }
});
