# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and this project adheres to [Semantic Versioning](https://semver.org/).

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
