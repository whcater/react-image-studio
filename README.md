# react-image-studio

> A feature-rich, **non-destructive** image editor component for React — crop, rotate, flip, colour filters, freehand brush, text layers, zoom/pan and multi-format export. Written in TypeScript, zero runtime dependencies, ships ESM + CJS + type definitions.

```tsx
import { ImageStudio } from 'react-image-studio';
import 'react-image-studio/style.css';

export default function App() {
  return (
    <div style={{ height: '80vh' }}>
      <ImageStudio src="/photo.jpg" onSave={(result) => console.log(result.blob)} />
    </div>
  );
}
```

## Features

| Area | What you get |
| --- | --- |
| **Crop** | 8-handle crop box, rule-of-thirds guides, drag-to-create, aspect presets (1:1, 4:3, 3:2, 16:9, 3:4, 9:16), lossless pixel-aligned output |
| **Transform** | 90° left/right rotation, horizontal & vertical flip — overlay layers (brush, text) are transformed with the image |
| **Adjust** | Brightness, contrast, saturation, warmth, hue, blur, grayscale, sepia, invert, opacity — double-click a value to reset it |
| **Filters** | 12 live presets (Vivid, Warm, Cool, Mono, Noir, Sepia, Vintage, Dramatic, Fade, Sunset, Matrix…) rendered as real thumbnails of your image |
| **Brush** | Colour, size, opacity and an eraser that only removes paint (never the photo), unlimited strokes with undo |
| **Text** | Multiple text layers, drag to move, font/size/colour/weight/italic/align/rotation/opacity, double-click to edit |
| **Navigation** | Wheel & pinch zoom to a focal point, drag to pan, fit-to-screen, actual-size, double-click reset |
| **History** | 60-step undo/redo with sensible coalescing (a slider drag is one step) |
| **Export** | PNG (with transparency), JPEG (flattened on white), WebP with quality control, custom file names, clipboard copy |
| **A11y / i18n** | Keyboard shortcuts, ARIA roles & labels, focus rings, `prefers-reduced-motion`, English + `zh-CN` labels, fully overridable strings |
| **Theming** | Light/dark/auto, all colours exposed as CSS custom properties |

Everything except crop/rotate is **non-destructive**: the original bitmap is kept and every layer is re-rendered on demand, so undo never degrades quality.

## Install

```bash
npm install react-image-studio
# peer dependencies
npm install react react-dom
```

## Usage

### Basic

```tsx
import { ImageStudio } from 'react-image-studio';
import 'react-image-studio/style.css';

<ImageStudio src={fileOrUrl} />
```

No global CSS import? Use the auto-injecting entry instead — it appends the stylesheet once, which is handy for quick prototypes:

```ts
import 'react-image-studio/auto-style';
```

### Controlled props & callbacks

```tsx
<ImageStudio
  src={file}                 // string | Blob | File
  theme="dark"               // 'light' | 'dark' | 'auto' (default)
  labels="zh-CN"             // or a Partial<Labels> override object
  tools={['crop', 'adjust', 'filter', 'export']}
  defaultTool="crop"
  defaultFormat="webp"
  maxSourceSize={4096}       // downscale huge photos on decode
  onSave={(result) => {
    // result: { blob, format, width, height, quality, filename }
    upload(result.blob);
  }}
  onDocChange={(doc) => setDraft(doc)}
  onError={(error) => toast.error(error.message)}
/>
```

### Imperative API

```tsx
const editor = useRef<ImageStudioHandle>(null);

<ImageStudio ref={editor} />

// later
await editor.current?.load(newFile);
const blob = await editor.current?.export('png');
editor.current?.rotate(1);
editor.current?.flip('horizontal');
editor.current?.crop({ x: 10, y: 10, width: 800, height: 600 });
editor.current?.undo();
const snapshot = editor.current?.getDoc();   // JSON-serialisable
editor.current?.setDoc(snapshot);
```

### Using the state hook directly

The whole editor is driven by a hook, so you can build your own chrome:

```tsx
import { useImageStudio, buildFilterString } from 'react-image-studio';

function MyEditor() {
  const api = useImageStudio({ src });
  const layer = api.layer; // HTMLCanvasElement with pixels + strokes + text

  return (
    <>
      <canvas
        style={{ filter: buildFilterString(api.doc?.adjust ?? neutral) }}
        ref={(el) => {
          el?.getContext('2d')?.drawImage(layer!, 0, 0);
        }}
      />
      <input
        type="range"
        value={api.doc?.adjust.brightness ?? 100}
        onChange={(e) => api.setAdjust('brightness', Number(e.target.value))}
        onPointerUp={api.endTransient}
      />
      <button onClick={() => api.download('jpeg', 0.9)}>Save</button>
    </>
  );
}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | `string \| Blob \| File \| null` | – | Image to load (URL, data URL, blob or file) |
| `image` | `CanvasImageSource` | – | Alternative entry point for an already decoded image |
| `doc` | `EditorDoc` | – | Restore a previously saved document |
| `onDocChange` | `(doc: EditorDoc) => void` | – | Fired on every committed change |
| `onSave` | `(result: SaveResult) => void` | – | Fired after a successful export |
| `onError` | `(error: Error) => void` | – | Load/export failures |
| `tools` | `ToolId[]` | all | Which tools to show, in canonical order |
| `defaultTool` | `ToolId` | `'move'` | Tool selected on mount |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Chrome colour scheme |
| `labels` | `'zh-CN' \| Partial<Labels>` | English | UI strings |
| `className` / `style` | – | – | Applied to the root element |
| `defaultFormat` | `'png' \| 'jpeg' \| 'webp'` | `'png'` | Initial export format |
| `maxSourceSize` | `number` | `0` | Longest edge used when decoding (`0` = keep original) |
| `allowDrop` | `boolean` | `true` | Enable drag & drop loading |
| `disableShortcuts` | `boolean` | `false` | Turn off keyboard shortcuts |
| `emptyState` | `ReactNode` | – | Custom empty state |

### Ref API (`ImageStudioHandle`)

`load`, `export`, `download`, `getDoc`, `setDoc`, `undo`, `redo`, `reset`, `rotate`, `flip`, `crop`, `setTool`, `fit`, `setZoom`, `canUndo`, `canRedo`.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Shift + Z`, `Ctrl + Y` | Redo |
| `+` / `-` | Zoom in / out |
| `0` | Fit to screen |
| `Enter` | Apply crop |
| `Esc` | Cancel crop / deselect text |
| Double click | Fit to screen (or edit the selected text) |

## Theming

```css
.my-brand .ris-root {
  --ris-accent: #e11d48;
  --ris-radius: 16px;
  --ris-font: 'Inter', sans-serif;
}
```

Every colour is a CSS variable (`--ris-bg`, `--ris-surface`, `--ris-border`, `--ris-text`, `--ris-muted`, `--ris-accent`, …), and `.ris-theme-dark` flips the palette.

## Localisation

```tsx
<ImageStudio labels={{
  app: { ...EN_LABELS.app, download: 'Export image' },
  presets: { ...EN_LABELS.presets, vivid: 'Punchy' },
}} />
```

Pass `labels="zh-CN"` for the bundled Chinese translation (or `ZH_CN_LABELS` to extend it).

## Architecture

```
src/
  core/        framework-free engine (no React imports)
    geometry.ts    crop maths, hit testing, view transform
    filters.ts     adjustments, CSS filter string, presets
    render.ts      layer compositing pipeline
    transform.ts   rotate / flip / crop pixel ops
    history.ts     undo stack
    image.ts       loading, encoding, download helpers
  hooks/       useImageStudio — all editor state
  components/  UI (canvas stage, toolbar, panels)
  ImageStudio.tsx
```

The preview is rendered once per structural change; colour adjustments are applied as a CSS filter while blitting, so dragging a slider never re-renders the bitmap. Export always re-renders at full resolution.

## Browser support

Modern evergreen browsers (Chrome/Edge 88+, Firefox 90+, Safari 15.4+). Canvas `ctx.filter` is used for adjustments; older engines transparently fall back to a per-pixel implementation for brightness/contrast/saturation/grayscale/sepia/invert.

Remote images are fetched with `crossOrigin="anonymous"` so exports stay untainted — make sure the server sends `Access-Control-Allow-Origin`.

## Development

```bash
npm run build      # ESM + CJS + d.ts + style.css
npm run typecheck  # strict tsc, no emit
npm test           # node:test suite (72 tests)
npm run clean
```

## License

MIT © haione
