import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADJUST_DEFINITIONS,
  FILTER_PRESETS,
  adjustmentsForPreset,
  buildFilterString,
  clampAdjustment,
  describeAdjustments,
  isNeutralAdjust,
  neutralAdjustments,
  sanitizeAdjustments,
} from '../src/core/filters.js';
import { EN_LABELS } from '../src/i18n.js';

const adjustWith = (patch: Partial<ReturnType<typeof neutralAdjustments>>) =>
  sanitizeAdjustments({ ...neutralAdjustments(), ...patch });

test('neutral adjustments produce an empty filter string', () => {
  assert.equal(buildFilterString(neutralAdjustments()), '');
  assert.equal(isNeutralAdjust(neutralAdjustments()), true);
});

test('filter string uses CSS units and skips untouched values', () => {
  const css = buildFilterString(adjustWith({ brightness: 120, saturation: 150, blur: 4, hue: -30 }));
  assert.match(css, /brightness\(120%\)/);
  assert.match(css, /saturate\(150%\)/);
  assert.match(css, /blur\(4px\)/);
  assert.match(css, /hue-rotate\(-30deg\)/);
  assert.doesNotMatch(css, /contrast/);
  assert.doesNotMatch(css, /opacity/);
});

test('clamping keeps every adjustment inside its declared range', () => {
  for (const definition of ADJUST_DEFINITIONS) {
    assert.equal(clampAdjustment(definition.key, definition.max + 500), definition.max);
    assert.equal(clampAdjustment(definition.key, definition.min - 500), definition.min);
    assert.equal(clampAdjustment(definition.key, Number.NaN), definition.neutral);
  }
});

test('sanitizeAdjustments ignores unknown keys and non numbers', () => {
  const sanitized = sanitizeAdjustments({ brightness: 150, contrast: 'nope' } as never);
  assert.equal(sanitized.brightness, 150);
  assert.equal(sanitized.contrast, 100);
  assert.equal(sanitized.opacity, 100);
});

test('every preset is clamped and produces a filter string', () => {
  assert.ok(FILTER_PRESETS.length >= 10);
  for (const preset of FILTER_PRESETS) {
    const adjust = adjustmentsForPreset(preset.id);
    for (const definition of ADJUST_DEFINITIONS) {
      const value = adjust[definition.key];
      assert.ok(value >= definition.min && value <= definition.max, `${preset.id}.${definition.key} out of range`);
    }
    if (preset.id === 'original') {
      assert.equal(isNeutralAdjust(adjust), true);
      assert.equal(buildFilterString(adjust), '');
    } else {
      assert.notEqual(buildFilterString(adjust), '', `preset ${preset.id} should change something`);
    }
  }
});

test('unknown presets fall back to neutral adjustments', () => {
  assert.equal(isNeutralAdjust(adjustmentsForPreset('does-not-exist')), true);
});

test('describeAdjustments lists only non neutral values', () => {
  const text = describeAdjustments(adjustWith({ brightness: 110, blur: 2 }), EN_LABELS.adjust);
  assert.equal(text, 'Brightness 110% · Blur 2px');
  assert.equal(describeAdjustments(neutralAdjustments(), EN_LABELS.adjust), '');
});
