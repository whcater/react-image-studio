import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ImageStudioHandle, ImageStudioProps } from './types.js';
import { useImageStudio } from './hooks/useImageStudio.js';
import { StudioProvider } from './context.js';
import { CanvasStage } from './components/CanvasStage.js';
import { Toolbar } from './components/Toolbar.js';
import { ToolPanel } from './components/panels.js';
import { Button } from './components/ui.js';
import { Icon } from './components/icons.js';

function useResolvedTheme(theme: ImageStudioProps['theme']): 'light' | 'dark' {
  const [system, setSystem] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystem(query.matches ? 'dark' : 'light');
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  if (theme === 'dark' || theme === 'light') return theme;
  return system;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

export const ImageStudio = forwardRef<ImageStudioHandle, ImageStudioProps>(function ImageStudio(props, ref) {
  const api = useImageStudio(props);
  const theme = useResolvedTheme(props.theme);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const { labels, status } = api;

  useImperativeHandle(
    ref,
    (): ImageStudioHandle => ({
      load: (source) => api.load(source),
      export: (format, quality) => api.exportBlob(format, quality),
      download: (format, quality, filename) => api.download(format, quality, filename),
      getDoc: () => api.getDoc(),
      setDoc: (doc) => api.setDoc(doc),
      undo: () => api.undo(),
      redo: () => api.redo(),
      reset: () => api.reset(),
      rotate: (direction) => api.rotate(direction),
      flip: (axis) => api.flip(axis),
      crop: (rect) => api.applyCrop(rect),
      setTool: (tool) => api.setTool(tool),
      fit: () => api.fit(),
      setZoom: (zoom) => api.zoomTo(zoom),
      canUndo: () => api.canUndo,
      canRedo: () => api.canRedo,
    }),
    [api],
  );

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const onFilePicked = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      if (file) void api.load(file);
      event.currentTarget.value = '';
    },
    [api],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (props.allowDrop === false) return;
      const file = event.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) void api.load(file);
    },
    [api, props.allowDrop],
  );

  const onDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (props.allowDrop === false) return;
      setDragging(true);
    },
    [props.allowDrop],
  );

  const onDragLeave = useCallback(() => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }, []);

  const onDragEnter = useCallback(() => {
    dragDepth.current += 1;
    if (props.allowDrop !== false) setDragging(true);
  }, [props.allowDrop]);

  // ---------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (props.disableShortcuts || isEditableTarget(event.target)) return;
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (meta && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) api.redo();
        else api.undo();
        return;
      }
      if (meta && key === 'y') {
        event.preventDefault();
        api.redo();
        return;
      }
      if (key === 'escape') {
        if (api.tool === 'crop') api.setTool('move');
        else api.selectText(null);
        return;
      }
      if (key === 'enter' && api.tool === 'crop') {
        event.preventDefault();
        api.cropApply();
        return;
      }
      if (key === '0') {
        event.preventDefault();
        api.fit();
        return;
      }
      if (key === '+' || key === '=') {
        event.preventDefault();
        api.zoomBy(1.25);
        return;
      }
      if (key === '-') {
        event.preventDefault();
        api.zoomBy(1 / 1.25);
      }
    },
    [api, props.disableShortcuts],
  );

  const rootClassName = useMemo(
    () =>
      [
        'ris-root',
        `ris-theme-${theme}`,
        status === 'empty' ? 'is-empty' : '',
        props.className ?? '',
      ]
        .filter(Boolean)
        .join(' '),
    [props.className, status, theme],
  );

  const ready = status === 'ready';

  return (
    <StudioProvider value={api}>
      <div
        ref={rootRef}
        className={rootClassName}
        style={props.style}
        data-theme={theme}
        data-status={status}
        onKeyDown={onKeyDown}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        tabIndex={0}
        role="region"
        aria-label="Image editor"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="ris-visually-hidden"
          onChange={onFilePicked}
          tabIndex={-1}
        />

        <Toolbar onReplace={openPicker} />

        <div className="ris-main">
          <header className="ris-topbar">
            <div className="ris-topbar__info">
              <Icon name="image" size={16} />
              <span className="ris-topbar__name" title={api.filename}>
                {api.filename}
              </span>
              {ready ? (
                <span className="ris-topbar__meta">
                  {api.imageSize.width} × {api.imageSize.height}
                </span>
              ) : null}
            </div>
            <div className="ris-topbar__actions">
              <Button
                variant="ghost"
                size="sm"
                icon="image"
                onClick={openPicker}
                title={labels.app.chooseImage}
                aria-label={labels.app.chooseImage}
              />
            </div>
          </header>

          <div className="ris-canvas-wrap">
            <CanvasStage />
            {status === 'empty' ? (
              <div className="ris-empty">
                {props.emptyState ?? (
                  <>
                    <div className="ris-empty__icon" aria-hidden="true">
                      <Icon name="image" size={40} />
                    </div>
                    <h2 className="ris-empty__title">{labels.app.emptyTitle}</h2>
                    <p className="ris-empty__hint">{labels.app.emptyHint}</p>
                    <Button variant="solid" icon="plus" onClick={openPicker}>
                      {labels.app.chooseImage}
                    </Button>
                  </>
                )}
              </div>
            ) : null}

            {status === 'error' ? (
              <div className="ris-empty ris-empty--error" role="alert">
                <p>{labels.app.errorLoad}</p>
                <p className="ris-muted ris-small">{api.error?.message}</p>
                <Button variant="soft" icon="image" onClick={openPicker}>
                  {labels.app.chooseImage}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="ris-side" aria-label="Editor panel">
          {ready || status === 'loading' ? <ToolPanel /> : null}
        </aside>

        {dragging ? (
          <div className="ris-dropzone" aria-hidden="true">
            <div className="ris-dropzone__inner">
              <Icon name="image" size={28} />
              <span>{labels.app.dragHint}</span>
            </div>
          </div>
        ) : null}
      </div>
    </StudioProvider>
  );
});

ImageStudio.displayName = 'ImageStudio';
