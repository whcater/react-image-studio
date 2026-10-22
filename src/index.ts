export { ImageStudio } from './ImageStudio.js';
export {
  useImageStudio,
  ALL_TOOLS,
  DEFAULT_BRUSH,
  DEFAULT_MARKER,
  DEFAULT_MOSAIC,
  DEFAULT_TEXT_STYLE,
} from './hooks/useImageStudio.js';
export type { StudioApi, EditorStatus } from './hooks/useImageStudio.js';

export type {
  AdjustKey,
  Adjustments,
  BrushSettings,
  CropAspectOption,
  CropHandle,
  EditorDoc,
  ExportFormat,
  FilterPreset,
  ImageStudioHandle,
  ImageStudioProps,
  Labels,
  Marker,
  MarkerSettings,
  MarkerShape,
  MosaicSettings,
  MosaicStyle,
  Point,
  Rect,
  SaveResult,
  Size,
  Stroke,
  StrokeKind,
  TextAlign,
  TextItem,
  ToolId,
} from './types.js';

export { EN_LABELS, ZH_CN_LABELS, CROP_ASPECTS, resolveLabels } from './i18n.js';
export {
  ADJUST_DEFINITIONS,
  DEFAULT_ADJUSTMENTS,
  FILTER_PRESETS,
  adjustmentsForPreset,
  buildFilterString,
  isNeutralAdjust,
  neutralAdjustments,
  sanitizeAdjustments,
} from './core/filters.js';
export {
  MIN_ZOOM,
  MAX_ZOOM,
  clampView,
  fitView,
  imageToScreen,
  screenToImage,
  zoomAt,
} from './core/geometry.js';
export { previewScaleFor, renderDoc, supportsContextFilter } from './core/render.js';
export { canvasToBlob, loadImage, sanitizeFilename, withExtension } from './core/image.js';
export { createHistory, commit, canUndo, canRedo, undo, redo, HISTORY_LIMIT } from './core/history.js';
export type { HistoryState, HistorySlot } from './core/history.js';
export { initialDoc, cloneDoc, normalizeDoc } from './core/doc.js';

export const VERSION = '1.1.1';

export { ImageStudio as default } from './ImageStudio.js';
