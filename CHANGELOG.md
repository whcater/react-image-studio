# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.2.0] — 2026-11-01

### Added
- The Adjust panel groups its sliders into **Light**, **Color** and **Effects** sections,
  matching how people reason about a photo instead of one flat list of ten sliders.
  Exposed as `ADJUST_SECTIONS` plus a new `labels.sections` group (English and `zh-CN`).
- Slider rails are tinted from the left up to the thumb, so the current value is readable
  at a glance without reading the number.
- Two new tests: every adjustment belongs to exactly one section (an ungrouped key would
  silently disappear from the panel), and every section title is translated in both languages.

### Changed
- Tool rail labels are 11px instead of 10px, with a taller hit area per tool.
- The bottom rail actions (undo / redo / reset / replace) form a stable 2×2 grid instead of
  wrapping unpredictably.
- The top bar is 52px tall (was 44px) and shows the image dimensions as a chip.
- `npm run typecheck` invokes TypeScript through `node`, so it also works where
  `node_modules/.bin` is not executable (e.g. a `noexec` mount).
- `package-lock.json` catches up its stale root version (1.0.0 → 1.1.1); dependency
  versions are unchanged.

## [1.1.1] — 2026-10-22

### Added
- **Live demo site** on GitHub Pages (<https://whcater.github.io/react-image-studio/>):
  a zero-build page with the real component, a feature tour, usage snippets and the full
  props / ref / hook reference. Served from `docs/` and produced by `npm run build:site`.
- README now links to the demo and documents the mosaic and step-marker tools.

### Changed
- No API changes; this is a packaging/docs release on top of 1.1.0.

## [1.1.0] — 2026-10-21

### Added
- **Mosaic tool** (`mosaic`): brush-based redaction with a pixelate or blur style, adjustable
  brush size, block size and blur strength. The redaction is applied to the composed pixels,
  so it hides photos, painting and text underneath, and it survives rotation, flipping and cropping.
- **Step marker tool** (`marker`): click the image to drop auto-numbered badges (circle, square
  or ring), drag to move, with per-marker colour and size, `Delete` to remove and
  "Renumber from top-left" to re-sort badges into reading order.
- `Marker`, `MarkerSettings`, `MarkerShape`, `MosaicSettings`, `MosaicStyle` and `StrokeKind`
  are exported, together with `DEFAULT_MARKER` and `DEFAULT_MOSAIC`.
- **Docs site** (`docs/`): a zero-build GitHub Pages page with a live demo, feature tour, usage
  snippets and the full props/ref/hook reference. Built by `npm run build:site`, which flattens
  `dist/esm` into one module for static hosting.
- `EditorDoc.markers` is part of the serialisable document; `Stroke` gained an optional
  `kind` (`brush` | `mosaic`) plus `mosaicStyle`, `mosaicBlock` and `mosaicBlur`.

### Changed
- `clearStrokes()` clears brush painting only; use `clearMosaic()` for redaction strokes.
- Markers and mosaic strokes follow rotate, flip and crop, like text and painting.

## [1.0.0] — 2026-10-20

First public release.

### Added
- `ImageStudio` component with crop, rotate, flip, adjust, filter, brush, text and export tools.
- Non-destructive editing model: committed pixels plus re-rendered overlay layers.
- 12 filter presets with live thumbnails, 10 adjustment sliders.
- 8-handle crop tool with rule-of-thirds guides and aspect-ratio presets.
- Freehand brush with colour/size/opacity/eraser, and multi-layer text tool.
- 60-step undo/redo with drag coalescing.
- Zoom/pan stage with wheel, pinch, fit and actual-size controls.
- PNG/JPEG/WebP export with quality control, custom filenames and clipboard copy.
- `useImageStudio` hook for fully custom chrome, plus an imperative `ref` API.
- Light/dark/auto theming through CSS custom properties.
- English and Chinese (`zh-CN`) UI strings, all overridable.
- 72 unit tests covering geometry, filters, history, document normalisation, the render pipeline and SSR rendering.
