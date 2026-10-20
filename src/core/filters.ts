import type { Adjustments, AdjustKey, FilterPreset } from '../types.js';

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0,
  warmth: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
  opacity: 100,
};

/** Range metadata used by the generated sliders. */
export interface AdjustDefinition {
  key: AdjustKey;
  min: number;
  max: number;
  step: number;
  unit: '' | '%' | 'px' | 'deg';
  /** Value that means "no change". */
  neutral: number;
}

export const ADJUST_DEFINITIONS: AdjustDefinition[] = [
  { key: 'brightness', min: 0, max: 200, step: 1, unit: '%', neutral: 100 },
  { key: 'contrast', min: 0, max: 200, step: 1, unit: '%', neutral: 100 },
  { key: 'saturation', min: 0, max: 200, step: 1, unit: '%', neutral: 100 },
  { key: 'warmth', min: -100, max: 100, step: 1, unit: '', neutral: 0 },
  { key: 'hue', min: -180, max: 180, step: 1, unit: 'deg', neutral: 0 },
  { key: 'blur', min: 0, max: 50, step: 1, unit: 'px', neutral: 0 },
  { key: 'grayscale', min: 0, max: 100, step: 1, unit: '%', neutral: 0 },
  { key: 'sepia', min: 0, max: 100, step: 1, unit: '%', neutral: 0 },
  { key: 'invert', min: 0, max: 100, step: 1, unit: '%', neutral: 0 },
  { key: 'opacity', min: 0, max: 100, step: 1, unit: '%', neutral: 100 },
];

export const ADJUST_KEYS: AdjustKey[] = ADJUST_DEFINITIONS.map((d) => d.key);

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/**
 * Convert adjustments into a CSS `filter` string.
 * Neutral values are omitted so the browser can skip the filter pass entirely.
 */
export function buildFilterString(adjust: Adjustments): string {
  const parts: string[] = [];
  if (adjust.brightness !== 100) parts.push(`brightness(${round(adjust.brightness)}%)`);
  if (adjust.contrast !== 100) parts.push(`contrast(${round(adjust.contrast)}%)`);
  if (adjust.saturation !== 100) parts.push(`saturate(${round(adjust.saturation)}%)`);
  if (adjust.hue !== 0) parts.push(`hue-rotate(${round(adjust.hue)}deg)`);
  if (adjust.blur > 0) parts.push(`blur(${round(adjust.blur)}px)`);
  if (adjust.grayscale > 0) parts.push(`grayscale(${round(adjust.grayscale)}%)`);
  if (adjust.sepia > 0) parts.push(`sepia(${round(adjust.sepia)}%)`);
  if (adjust.invert > 0) parts.push(`invert(${round(adjust.invert)}%)`);
  if (adjust.opacity !== 100) parts.push(`opacity(${round(adjust.opacity)}%)`);
  return parts.join(' ');
}

/** True when the adjustments would not alter the image at all. */
export function isNeutralAdjust(adjust: Adjustments): boolean {
  return ADJUST_DEFINITIONS.every((def) => adjust[def.key] === def.neutral);
}

/** Reset every adjustment to its neutral value. */
export function neutralAdjustments(): Adjustments {
  return { ...DEFAULT_ADJUSTMENTS };
}

/** Clamp a single adjustment into its valid range. */
export function clampAdjustment(key: AdjustKey, value: number): number {
  const def = ADJUST_DEFINITIONS.find((d) => d.key === key);
  if (!def) return value;
  const safe = Number.isFinite(value) ? value : def.neutral;
  return Math.min(def.max, Math.max(def.min, safe));
}

/** Clamp and round every adjustment value. */
export function sanitizeAdjustments(adjust: Partial<Adjustments> | undefined): Adjustments {
  const base = neutralAdjustments();
  if (!adjust) return base;
  for (const def of ADJUST_DEFINITIONS) {
    const value = adjust[def.key];
    if (typeof value === 'number') base[def.key] = clampAdjustment(def.key, value);
  }
  return base;
}

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'original', labelKey: 'original', adjust: {} },
  { id: 'vivid', labelKey: 'vivid', adjust: { saturation: 138, contrast: 112 } },
  { id: 'warm', labelKey: 'warm', adjust: { warmth: 35, saturation: 115, brightness: 103 } },
  { id: 'cool', labelKey: 'cool', adjust: { warmth: -30, saturation: 112, hue: -6 } },
  { id: 'mono', labelKey: 'mono', adjust: { grayscale: 100, contrast: 110 } },
  { id: 'noir', labelKey: 'noir', adjust: { grayscale: 100, contrast: 142, brightness: 96 } },
  { id: 'sepia', labelKey: 'sepia', adjust: { sepia: 70, saturation: 120, contrast: 104 } },
  { id: 'vintage', labelKey: 'vintage', adjust: { sepia: 32, contrast: 92, brightness: 106, saturation: 86 } },
  { id: 'dramatic', labelKey: 'dramatic', adjust: { contrast: 136, saturation: 92, brightness: 96 } },
  { id: 'fade', labelKey: 'fade', adjust: { contrast: 86, brightness: 108, saturation: 78, opacity: 96 } },
  { id: 'sunset', labelKey: 'sunset', adjust: { warmth: 48, saturation: 128, brightness: 104, hue: 6 } },
  { id: 'matrix', labelKey: 'matrix', adjust: { hue: 78, saturation: 150, contrast: 118, grayscale: 40 } },
];

export function findPreset(id: string | null): FilterPreset | undefined {
  if (!id) return undefined;
  return FILTER_PRESETS.find((preset) => preset.id === id);
}

/**
 * Apply a preset on top of neutral adjustments. Colour filters that rely on
 * `grayscale`/`sepia` combine multiplicatively with the slider values.
 */
export function adjustmentsForPreset(id: string): Adjustments {
  const preset = findPreset(id);
  if (!preset) return neutralAdjustments();
  return sanitizeAdjustments({ ...DEFAULT_ADJUSTMENTS, ...preset.adjust });
}

/** Human readable summary such as `brightness 106% · sepia 32%`. */
export function describeAdjustments(adjust: Adjustments, labels: Record<string, string>): string {
  const parts: string[] = [];
  for (const def of ADJUST_DEFINITIONS) {
    const value = adjust[def.key];
    if (value === def.neutral) continue;
    const name = labels[def.key] ?? def.key;
    parts.push(`${name} ${Math.round(value)}${def.unit}`);
  }
  return parts.join(' · ');
}
