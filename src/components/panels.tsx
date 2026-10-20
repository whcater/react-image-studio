import { useMemo, useState } from 'react';
import { useStudio } from '../context.js';
import { ADJUST_DEFINITIONS, FILTER_PRESETS, adjustmentsForPreset } from '../core/filters.js';
import { CROP_ASPECTS } from '../i18n.js';
import { renderThumbnail } from '../core/render.js';
import type { ExportFormat, TextAlign } from '../types.js';
import { Button, ColorField, Panel, Segmented, Slider } from './ui.js';
import { Icon } from './icons.js';

// ---------------------------------------------------------------------------
// Adjust
// ---------------------------------------------------------------------------

export function AdjustPanel() {
  const api = useStudio();
  const { doc, labels } = api;
  if (!doc) return null;
  return (
    <Panel
      title={labels.tools.adjust}
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            api.applyPreset('original');
          }}
        >
          {labels.app.reset}
        </Button>
      }
    >
      <div className="ris-stack">
        {ADJUST_DEFINITIONS.map((definition) => (
          <Slider
            key={definition.key}
            label={labels.adjust[definition.key]}
            value={doc.adjust[definition.key]}
            min={definition.min}
            max={definition.max}
            step={definition.step}
            unit={definition.unit}
            neutral={definition.neutral}
            onBegin={api.beginTransient}
            onChange={(value) => api.setAdjust(definition.key, value)}
            onCommit={api.endTransient}
          />
        ))}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export function FilterPanel() {
  const api = useStudio();
  const { base, doc, labels } = api;

  const thumbs = useMemo(() => {
    if (!base) return [] as { id: string; url: string }[];
    return FILTER_PRESETS.map((preset) => ({
      id: preset.id,
      url: renderThumbnail(
        base,
        { adjust: adjustmentsForPreset(preset.id), strokes: [], texts: [] },
        96,
      ),
    }));
  }, [base]);

  if (!doc) return null;

  return (
    <Panel
      title={labels.tools.filter}
      hint={doc.preset === null ? undefined : labels.presets[doc.preset] ?? doc.preset}
      actions={
        <Button variant="ghost" size="sm" onClick={() => api.applyPreset('original')}>
          {labels.app.original}
        </Button>
      }
    >
      <div className="ris-presets" role="list">
        {FILTER_PRESETS.map((preset, index) => {
          const active = doc.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="listitem"
              className={`ris-preset${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => api.applyPreset(preset.id)}
            >
              <span className="ris-preset__thumb" style={{ backgroundImage: `url(${thumbs[index]?.url ?? ''})` }} />
              <span className="ris-preset__name">{labels.presets[preset.labelKey] ?? preset.id}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Crop
// ---------------------------------------------------------------------------

export function CropPanel() {
  const api = useStudio();
  const { labels, cropRect } = api;
  return (
    <Panel
      title={labels.app.cropTitle}
      hint={labels.app.cropHint}
      actions={
        <Button variant="ghost" size="sm" icon="reset" onClick={api.cropReset} title={labels.app.reset} aria-label={labels.app.reset} />
      }
    >
      <div className="ris-stack">
        <Segmented
          ariaLabel="Aspect ratio"
          block
          size="sm"
          value={api.cropAspect}
          options={CROP_ASPECTS.map((aspect) => ({
            value: aspect.id,
            label: labels.aspects[aspect.labelKey] ?? aspect.id,
            title: labels.aspects[aspect.labelKey] ?? aspect.id,
          }))}
          onChange={api.setCropAspect}
        />
        <div className="ris-row ris-row--between">
          <span className="ris-muted">Output</span>
          <span className="ris-mono">
            {Math.round(cropRect?.width ?? 0)} × {Math.round(cropRect?.height ?? 0)} px
          </span>
        </div>
        <Button variant="solid" icon="check" block onClick={api.cropApply} disabled={!cropRect || cropRect.width < 4 || cropRect.height < 4}>
          {labels.app.cropApply}
        </Button>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Rotate & flip
// ---------------------------------------------------------------------------

export function RotatePanel() {
  const api = useStudio();
  const { labels, doc } = api;
  return (
    <Panel title={labels.app.rotateTitle}>
      <div className="ris-grid-2">
        <Button variant="soft" icon="rotate-left" onClick={() => api.rotate(-1)}>
          {labels.app.rotateLeft}
        </Button>
        <Button variant="soft" icon="rotate-right" onClick={() => api.rotate(1)}>
          {labels.app.rotateRight}
        </Button>
        <Button variant="soft" icon="flip-h" onClick={() => api.flip('horizontal')}>
          {labels.app.flipH}
        </Button>
        <Button variant="soft" icon="flip-v" onClick={() => api.flip('vertical')}>
          {labels.app.flipV}
        </Button>
      </div>
      <p className="ris-muted ris-small">
        {api.imageSize.width} × {api.imageSize.height} px
        {doc?.rotation ? ` · ${doc.rotation}°` : ''}
      </p>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Brush
// ---------------------------------------------------------------------------

export function BrushPanel() {
  const api = useStudio();
  const { labels, brush, doc } = api;
  return (
    <Panel
      title={labels.app.brushTitle}
      actions={
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          onClick={api.clearStrokes}
          disabled={!doc || doc.strokes.length === 0}
          title={labels.app.brushClear}
          aria-label={labels.app.brushClear}
        />
      }
    >
      <div className="ris-stack">
        <Segmented
          ariaLabel={labels.app.brushTitle}
          block
          size="sm"
          value={brush.erase ? 'eraser' : 'brush'}
          options={[
            { value: 'brush', label: labels.app.brushTitle, icon: 'brush' },
            { value: 'eraser', label: labels.app.brushEraser, icon: 'eraser' },
          ]}
          onChange={(value) => api.setBrush({ erase: value === 'eraser' })}
        />
        <ColorField label={labels.app.brushColor} value={brush.color} onChange={(color) => api.setBrush({ color })} />
        <Slider label={labels.app.brushSize} value={brush.size} min={1} max={200} unit="px" onChange={(size) => api.setBrush({ size })} />
        <Slider
          label={labels.app.brushOpacity}
          value={brush.opacity}
          min={5}
          max={100}
          unit="%"
          neutral={100}
          onChange={(opacity) => api.setBrush({ opacity })}
        />
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const FONTS = [
  { value: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', label: 'Sans' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Serif' },
  { value: '"Courier New", ui-monospace, monospace', label: 'Mono' },
  { value: '"Comic Sans MS", "Segoe Print", cursive', label: 'Handwriting' },
];

export function TextPanel() {
  const api = useStudio();
  const { labels, doc } = api;
  const selected = doc?.texts.find((item) => item.id === api.selectedTextId) ?? null;

  if (!doc) return null;

  return (
    <Panel
      title={labels.app.textTitle}
      actions={
        <Button variant="ghost" size="sm" icon="plus" onClick={() => api.addText()} title={labels.app.addText} aria-label={labels.app.addText} />
      }
    >
      <div className="ris-stack">
        {doc.texts.length > 0 ? (
          <ul className="ris-list">
            {doc.texts.map((item) => (
              <li key={item.id} className="ris-list__item">
                <button
                  type="button"
                  className={`ris-list__select${item.id === api.selectedTextId ? ' is-active' : ''}`}
                  onClick={() => api.selectText(item.id)}
                >
                  <Icon name="text" size={14} />
                  <span className="ris-list__label">{item.text.replace(/\n/g, ' ') || '…'}</span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="trash"
                  aria-label={labels.app.deleteText}
                  title={labels.app.deleteText}
                  onClick={() => api.removeText(item.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Button variant="soft" icon="plus" block onClick={() => api.addText()}>
            {labels.app.addText}
          </Button>
        )}

        {selected ? (
          <>
            <textarea
              className="ris-input ris-textarea"
              rows={2}
              value={selected.text}
              placeholder={labels.app.textPlaceholder}
              aria-label={labels.app.textPlaceholder}
              onFocus={api.beginTransient}
              onChange={(event) => {
                api.updateText(selected.id, { text: event.currentTarget.value }, true);
              }}
              onBlur={api.endTransient}
            />
            <Slider
              label={labels.app.textSize}
              value={selected.size}
              min={8}
              max={400}
              unit="px"
              onBegin={api.beginTransient}
              onChange={(size) => api.updateText(selected.id, { size })}
              onCommit={api.endTransient}
            />
            <Slider
              label={labels.app.textRotation}
              value={selected.rotation}
              min={-180}
              max={180}
              unit="deg"
              neutral={0}
              onBegin={api.beginTransient}
              onChange={(rotation) => api.updateText(selected.id, { rotation })}
              onCommit={api.endTransient}
            />
            <ColorField label={labels.app.textColor} value={selected.color} onChange={(color) => api.updateText(selected.id, { color }, false)} />
            <div className="ris-field">
              <div className="ris-field__head">
                <span className="ris-slider__label">{labels.app.textFont}</span>
              </div>
              <select
                className="ris-input"
                value={selected.fontFamily}
                onChange={(event) => api.updateText(selected.id, { fontFamily: event.currentTarget.value }, false)}
                aria-label={labels.app.textFont}
              >
                {FONTS.map((font) => (
                  <option key={font.label} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ris-row">
              <Button
                variant="soft"
                size="sm"
                icon="bold"
                active={selected.bold}
                aria-label={labels.app.textBold}
                title={labels.app.textBold}
                onClick={() => api.updateText(selected.id, { bold: !selected.bold }, false)}
              />
              <Button
                variant="soft"
                size="sm"
                icon="italic"
                active={selected.italic}
                aria-label={labels.app.textItalic}
                title={labels.app.textItalic}
                onClick={() => api.updateText(selected.id, { italic: !selected.italic }, false)}
              />
              <Segmented<TextAlign>
                ariaLabel={labels.app.textAlign}
                size="sm"
                value={selected.align}
                options={[
                  { value: 'left', icon: 'align-left', title: 'Left' },
                  { value: 'center', icon: 'align-center', title: 'Center' },
                  { value: 'right', icon: 'align-right', title: 'Right' },
                ]}
                onChange={(align) => api.updateText(selected.id, { align }, false)}
              />
            </div>
            <Slider
              label={labels.app.brushOpacity}
              value={selected.opacity}
              min={5}
              max={100}
              unit="%"
              neutral={100}
              onBegin={api.beginTransient}
              onChange={(opacity) => api.updateText(selected.id, { opacity })}
              onCommit={api.endTransient}
            />
          </>
        ) : (
          <p className="ris-muted ris-small">Select a text layer to edit it. Drag it on the canvas to move.</p>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function ExportPanel() {
  const api = useStudio();
  const { labels } = api;
  const [copied, setCopied] = useState(false);

  return (
    <Panel title={labels.app.exportTitle}>
      <div className="ris-stack">
        <div className="ris-field">
          <div className="ris-field__head">
            <span className="ris-slider__label">{labels.app.format}</span>
          </div>
          <Segmented<ExportFormat>
            ariaLabel={labels.app.format}
            block
            value={api.format}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'jpeg', label: 'JPEG' },
              { value: 'webp', label: 'WebP' },
            ]}
            onChange={api.setFormat}
          />
        </div>

        {api.format !== 'png' ? (
          <Slider
            label={labels.app.quality}
            value={Math.round(api.quality * 100)}
            min={10}
            max={100}
            unit="%"
            neutral={92}
            onChange={(value) => api.setQuality(value / 100)}
          />
        ) : null}

        <div className="ris-field">
          <div className="ris-field__head">
            <label className="ris-slider__label" htmlFor="ris-filename">
              {labels.app.filename}
            </label>
          </div>
          <input
            id="ris-filename"
            className="ris-input"
            value={api.filename}
            onChange={(event) => api.setFilename(event.currentTarget.value)}
            spellCheck={false}
          />
        </div>

        <p className="ris-muted ris-small ris-mono">
          {api.imageSize.width} × {api.imageSize.height} px
        </p>

        <Button
          variant="solid"
          icon="download"
          block
          disabled={api.status !== 'ready' || api.busy}
          onClick={() => {
            void api.download().catch(() => undefined);
          }}
        >
          {labels.app.download}
        </Button>
        <Button
          variant="outline"
          icon="copy"
          block
          disabled={api.status !== 'ready' || api.busy}
          onClick={async () => {
            const ok = await api.copyToClipboard();
            setCopied(ok);
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? labels.app.copied : labels.app.copy}
        </Button>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Move / info
// ---------------------------------------------------------------------------

export function InfoPanel() {
  const api = useStudio();
  const { labels, doc, imageSize } = api;
  const stats = useMemo(() => {
    const layers = (doc?.texts.length ?? 0) + (doc?.strokes.length ?? 0);
    return { layers };
  }, [doc]);

  return (
    <Panel title={labels.tools.move} hint={labels.app.keyboardHint}>
      <div className="ris-stack">
        <div className="ris-row ris-row--between">
          <span className="ris-muted">{labels.app.imageInfo}</span>
          <span className="ris-mono">
            {imageSize.width} × {imageSize.height} px
          </span>
        </div>
        <div className="ris-row ris-row--between">
          <span className="ris-muted">Layers</span>
          <span className="ris-mono">{stats.layers}</span>
        </div>
        <div className="ris-row ris-row--between">
          <span className="ris-muted">Zoom</span>
          <span className="ris-mono">{Math.round(api.view.scale * 100)}%</span>
        </div>
        <Button variant="soft" icon="fit" block onClick={api.fit}>
          {labels.app.zoomFit}
        </Button>
      </div>
    </Panel>
  );
}

export function ToolPanel() {
  const api = useStudio();
  switch (api.tool) {
    case 'crop':
      return <CropPanel />;
    case 'rotate':
      return <RotatePanel />;
    case 'adjust':
      return <AdjustPanel />;
    case 'filter':
      return <FilterPanel />;
    case 'brush':
      return <BrushPanel />;
    case 'text':
      return <TextPanel />;
    case 'export':
      return <ExportPanel />;
    default:
      return <InfoPanel />;
  }
}

