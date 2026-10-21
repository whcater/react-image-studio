import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '../context.js';
import { buildFilterString } from '../core/filters.js';
import {
  CURSOR_FOR_HANDLE,
  clampRectToBounds,
  handlePositions,
  hitTestCrop,
  imageToScreen,
  rectFromPoints,
  resizeCropRect,
  screenToImage,
  type ViewTransform,
} from '../core/geometry.js';
import { createId } from '../core/doc.js';
import { measureTextItem } from '../core/render.js';
import { findAspect } from '../i18n.js';
import type { CropHandle, Marker, Point, Rect, Stroke, TextItem } from '../types.js';
import { Button } from './ui.js';

type Gesture =
  | { type: 'pan'; startClient: Point; startView: ViewTransform }
  | { type: 'crop-resize'; handle: CropHandle; startRect: Rect; startImage: Point }
  | { type: 'crop-move'; startRect: Rect; startImage: Point }
  | { type: 'crop-new'; startImage: Point }
  | { type: 'brush'; stroke: Stroke }
  | { type: 'text'; id: string; startImage: Point; origin: Point }
  | { type: 'marker'; id: string; startImage: Point; origin: Point }
  | null;

const HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function localPoint(container: HTMLElement, clientX: number, clientY: number): Point {
  const rect = container.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function textBoundsPoint(item: TextItem): Rect {
  const size = measureTextItem(item);
  const x = item.align === 'center' ? item.x - size.width / 2 : item.align === 'right' ? item.x - size.width : item.x;
  return { x, y: item.y, width: size.width, height: size.height };
}

function hitTestTexts(texts: TextItem[], point: Point): string | null {
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const item = texts[i];
    const bounds = textBoundsPoint(item);
    const pad = item.size * 0.2;
    if (
      point.x >= bounds.x - pad &&
      point.x <= bounds.x + bounds.width + pad &&
      point.y >= bounds.y - pad &&
      point.y <= bounds.y + bounds.height + pad
    ) {
      return item.id;
    }
  }
  return null;
}

/** Topmost marker under the cursor; `tolerance` is in image pixels. */
function hitTestMarkers(markers: Marker[], point: Point, tolerance: number): string | null {
  for (let i = markers.length - 1; i >= 0; i -= 1) {
    const marker = markers[i];
    const radius = Math.max(marker.size / 2, tolerance);
    if (Math.hypot(point.x - marker.x, point.y - marker.y) <= radius) return marker.id;
  }
  return null;
}

export function CanvasStage() {
  const api = useStudio();
  const { view, viewport, imageSize, doc, tool, status, filterSupported, layer, preview } = api;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<Gesture>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<number | null>(null);
  const spaceRef = useRef(false);
  const [panning, setPanning] = useState(false);

  const hasImage = status === 'ready' && imageSize.width > 0;

  // -------------------------------------------------------------------
  // Layout measurement
  // -------------------------------------------------------------------
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => api.setViewport({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [api.setViewport]);

  // -------------------------------------------------------------------
  // Painting
  // -------------------------------------------------------------------
  const adjust = doc?.adjust;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewport.width < 1 || viewport.height < 1) return;
    const dpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2);
    const deviceWidth = Math.round(viewport.width * dpr);
    const deviceHeight = Math.round(viewport.height * dpr);
    if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
      canvas.width = deviceWidth;
      canvas.height = deviceHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    const source = filterSupported ? layer : preview;
    if (!source) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (filterSupported && adjust) {
      ctx.filter = buildFilterString({ ...adjust, warmth: 0 });
    }
    ctx.drawImage(
      source,
      view.x,
      view.y,
      Math.max(1, imageSize.width * view.scale),
      Math.max(1, imageSize.height * view.scale),
    );
    ctx.filter = 'none';

    if (filterSupported && adjust && adjust.warmth) {
      const strength = Math.min(1, Math.abs(adjust.warmth) / 100) * 0.42;
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle =
        adjust.warmth > 0 ? `rgba(255, 138, 54, ${strength})` : `rgba(46, 122, 255, ${strength})`;
      ctx.fillRect(
        view.x,
        view.y,
        Math.max(1, imageSize.width * view.scale),
        Math.max(1, imageSize.height * view.scale),
      );
      ctx.restore();
    }
  }, [view, viewport, layer, preview, adjust, imageSize, filterSupported]);

  // The live stroke overlay is only valid for the view it was drawn in.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, [view]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || viewport.width < 1) return;
    const dpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2);
    const deviceWidth = Math.round(viewport.width * dpr);
    const deviceHeight = Math.round(viewport.height * dpr);
    if (overlay.width !== deviceWidth || overlay.height !== deviceHeight) {
      overlay.width = deviceWidth;
      overlay.height = deviceHeight;
    }
  }, [viewport]);

  // -------------------------------------------------------------------
  // Keyboard modifiers
  // -------------------------------------------------------------------
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        spaceRef.current = true;
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // -------------------------------------------------------------------
  // Wheel zoom (non-passive so the page does not scroll)
  // -------------------------------------------------------------------
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!hasImage) return;
      event.preventDefault();
      const point = localPoint(element, event.clientX, event.clientY);
      const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0018));
      api.zoomBy(factor, point);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [api.zoomBy, hasImage]);

  // -------------------------------------------------------------------
  // Gesture helpers
  // -------------------------------------------------------------------
  const clearOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, []);

  const drawOverlaySegment = useCallback(
    (stroke: Stroke, from: Point | null, to: Point) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      const dpr = overlay.width / Math.max(1, viewport.width);
      ctx.setTransform(view.scale * dpr, 0, 0, view.scale * dpr, view.x * dpr, view.y * dpr);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke.size;
      const isMosaic = stroke.kind === 'mosaic';
      const previewColor = stroke.erase
        ? 'rgba(255, 255, 255, 0.55)'
        : isMosaic
          ? 'rgba(120, 180, 255, 0.45)'
          : stroke.color;
      ctx.strokeStyle = previewColor;
      ctx.globalAlpha = stroke.erase ? 0.7 : isMosaic ? 0.85 : stroke.opacity / 100;
      if (from) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(to.x, to.y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = previewColor;
        ctx.fill();
      }
      ctx.restore();
    },
    [view, viewport.width],
  );

  const applyCropGesture = useCallback(
    (gesture: Extract<Gesture, { type: 'crop-resize' | 'crop-move' | 'crop-new' }>, image: Point) => {
      const bounds = { width: imageSize.width, height: imageSize.height };
      const aspect = findAspect(api.cropAspect)?.ratio ?? null;
      if (gesture.type === 'crop-resize') {
        const dx = image.x - gesture.startImage.x;
        const dy = image.y - gesture.startImage.y;
        api.setCropRect(resizeCropRect(gesture.startRect, gesture.handle, dx, dy, { aspect, bounds }));
        return;
      }
      if (gesture.type === 'crop-move') {
        const dx = image.x - gesture.startImage.x;
        const dy = image.y - gesture.startImage.y;
        api.setCropRect(
          clampRectToBounds({ ...gesture.startRect, x: gesture.startRect.x + dx, y: gesture.startRect.y + dy }, bounds),
        );
        return;
      }
      const raw = rectFromPoints(gesture.startImage, image);
      api.setCropRect(clampRectToBounds(raw, bounds));
    },
    [api, imageSize],
  );

  // -------------------------------------------------------------------
  // Pointer handling
  // -------------------------------------------------------------------
  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!hasImage) return;
      const container = containerRef.current;
      if (!container) return;
      const point = localPoint(container, event.clientX, event.clientY);
      pointersRef.current.set(event.pointerId, point);
      container.setPointerCapture?.(event.pointerId);

      if (pointersRef.current.size === 2) {
        const [a, b] = [...pointersRef.current.values()];
        pinchRef.current = Math.hypot(a.x - b.x, a.y - b.y);
        gestureRef.current = null;
        return;
      }

      const image = screenToImage(point, view);
      const wantsPan = event.button === 1 || event.button === 2 || spaceRef.current || tool === 'move';

      if (wantsPan) {
        gestureRef.current = { type: 'pan', startClient: point, startView: view };
        setPanning(true);
        event.preventDefault();
        return;
      }

      if (tool === 'crop') {
        const tolerance = 12 / view.scale;
        const current = api.cropRect;
        if (current) {
          const hit = hitTestCrop(current, image, tolerance);
          if (hit.handle === 'move') {
            gestureRef.current = { type: 'crop-move', startRect: current, startImage: image };
            event.preventDefault();
            return;
          }
          if (hit.handle) {
            gestureRef.current = { type: 'crop-resize', handle: hit.handle, startRect: current, startImage: image };
            event.preventDefault();
            return;
          }
        }
        gestureRef.current = { type: 'crop-new', startImage: image };
        api.setCropRect({ x: image.x, y: image.y, width: 0, height: 0 });
        event.preventDefault();
        return;
      }

      if (tool === 'brush') {
        const stroke: Stroke = {
          id: createId('stroke'),
          points: [image],
          color: api.brush.color,
          size: api.brush.size,
          opacity: api.brush.opacity,
          erase: api.brush.erase,
        };
        gestureRef.current = { type: 'brush', stroke };
        clearOverlay();
        drawOverlaySegment(stroke, null, image);
        event.preventDefault();
        return;
      }

      if (tool === 'mosaic') {
        const stroke: Stroke = {
          id: createId('stroke'),
          points: [image],
          color: '#000000',
          size: api.mosaic.size,
          opacity: 100,
          erase: false,
          kind: 'mosaic',
          mosaicStyle: api.mosaic.style,
          mosaicBlock: api.mosaic.block,
          mosaicBlur: api.mosaic.blur,
        };
        gestureRef.current = { type: 'brush', stroke };
        clearOverlay();
        drawOverlaySegment(stroke, null, image);
        event.preventDefault();
        return;
      }

      if (tool === 'marker' && doc) {
        const tolerance = 16 / view.scale;
        const hitId = hitTestMarkers(doc.markers, image, tolerance);
        if (hitId) {
          const item = doc.markers.find((entry) => entry.id === hitId);
          if (item) {
            api.selectMarker(hitId);
            api.beginTransient();
            gestureRef.current = { type: 'marker', id: hitId, startImage: image, origin: { x: item.x, y: item.y } };
            event.preventDefault();
            return;
          }
        }
        // Empty space: drop a new numbered step marker right where the user clicked.
        const created = api.addMarker({ x: Math.round(image.x), y: Math.round(image.y) });
        if (created) {
          gestureRef.current = { type: 'marker', id: created.id, startImage: image, origin: { x: created.x, y: created.y } };
          api.beginTransient();
        }
        event.preventDefault();
        return;
      }

      if (tool === 'text' && doc) {
        const hitId = hitTestTexts(doc.texts, image);
        if (hitId) {
          const item = doc.texts.find((entry) => entry.id === hitId);
          if (item) {
            api.selectText(hitId);
            api.beginTransient();
            gestureRef.current = { type: 'text', id: hitId, startImage: image, origin: { x: item.x, y: item.y } };
            event.preventDefault();
            return;
          }
        }
        api.selectText(null);
        gestureRef.current = { type: 'pan', startClient: point, startView: view };
        setPanning(true);
        event.preventDefault();
        return;
      }

      gestureRef.current = { type: 'pan', startClient: point, startView: view };
      setPanning(true);
      event.preventDefault();
    },
    [api, clearOverlay, doc, drawOverlaySegment, hasImage, tool, view],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;
      const point = localPoint(container, event.clientX, event.clientY);
      if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, point);

      if (pointersRef.current.size === 2 && pinchRef.current !== null) {
        const [a, b] = [...pointersRef.current.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > 0 && pinchRef.current > 0) {
          const factor = distance / pinchRef.current;
          pinchRef.current = distance;
          api.zoomBy(factor, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        }
        return;
      }

      const gesture = gestureRef.current;
      if (!gesture) return;
      const image = screenToImage(point, view);

      switch (gesture.type) {
        case 'pan': {
          api.setView({
            scale: gesture.startView.scale,
            x: gesture.startView.x + (point.x - gesture.startClient.x),
            y: gesture.startView.y + (point.y - gesture.startClient.y),
          });
          break;
        }
        case 'crop-resize':
        case 'crop-move':
        case 'crop-new': {
          applyCropGesture(gesture, image);
          break;
        }
        case 'brush': {
          const previous = gesture.stroke.points[gesture.stroke.points.length - 1] ?? null;
          // Thin out samples that are closer than a pixel and a half.
          if (previous && Math.hypot(image.x - previous.x, image.y - previous.y) * view.scale < 1.5) break;
          gesture.stroke.points.push(image);
          drawOverlaySegment(gesture.stroke, previous, image);
          break;
        }
        case 'text': {
          api.updateText(
            gesture.id,
            {
              x: gesture.origin.x + (image.x - gesture.startImage.x),
              y: gesture.origin.y + (image.y - gesture.startImage.y),
            },
            true,
          );
          break;
        }
        case 'marker': {
          api.updateMarker(
            gesture.id,
            {
              x: gesture.origin.x + (image.x - gesture.startImage.x),
              y: gesture.origin.y + (image.y - gesture.startImage.y),
            },
            true,
          );
          break;
        }
        default:
          break;
      }
    },
    [api, applyCropGesture, drawOverlaySegment, view],
  );

  const finishGesture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      pointersRef.current.delete(event.pointerId);
      if (pointersRef.current.size < 2) pinchRef.current = null;
      try {
        container?.releasePointerCapture?.(event.pointerId);
      } catch {
        // The pointer may already have been released by the browser.
      }
      const gesture = gestureRef.current;
      gestureRef.current = null;
      setPanning(false);
      if (!gesture) return;

      if (gesture.type === 'brush') {
        clearOverlay();
        if (gesture.stroke.points.length > 0) api.addStroke(gesture.stroke);
      } else if (gesture.type === 'text' || gesture.type === 'marker') {
        api.endTransient();
      } else if (gesture.type === 'crop-new' || gesture.type === 'crop-resize') {
        const rect = api.cropRect;
        if (rect && (rect.width < 8 || rect.height < 8)) {
          api.cropReset();
        }
      }
    },
    [api, clearOverlay],
  );

  const onDoubleClick = useCallback(() => {
    if (!hasImage) return;
    if (tool === 'text' && doc) {
      const selected = doc.texts.find((item) => item.id === api.selectedTextId);
      if (selected) {
        const next = window.prompt(selected.text) ?? null;
        if (next !== null && next !== selected.text) api.updateText(selected.id, { text: next }, false);
        return;
      }
    }
    api.fit();
  }, [api, doc, hasImage, tool]);

  // -------------------------------------------------------------------
  // Derived overlay geometry
  // -------------------------------------------------------------------
  const cropScreen = useMemo(() => {
    if (!api.cropRect) return null;
    const topLeft = imageToScreen({ x: api.cropRect.x, y: api.cropRect.y }, view);
    return {
      left: topLeft.x,
      top: topLeft.y,
      width: Math.max(0, api.cropRect.width * view.scale),
      height: Math.max(0, api.cropRect.height * view.scale),
    };
  }, [api.cropRect, view]);

  const selectedTextScreen = useMemo(() => {
    if (!doc || !api.selectedTextId) return null;
    const item = doc.texts.find((entry) => entry.id === api.selectedTextId);
    if (!item) return null;
    const bounds = textBoundsPoint(item);
    const topLeft = imageToScreen({ x: bounds.x, y: bounds.y }, view);
    return {
      left: topLeft.x,
      top: topLeft.y,
      width: bounds.width * view.scale,
      height: bounds.height * view.scale,
      rotation: item.rotation,
    };
  }, [api.selectedTextId, doc, view]);

  const selectedMarkerScreen = useMemo(() => {
    if (!doc || !api.selectedMarkerId) return null;
    const marker = doc.markers.find((entry) => entry.id === api.selectedMarkerId);
    if (!marker) return null;
    const topLeft = imageToScreen({ x: marker.x - marker.size / 2, y: marker.y - marker.size / 2 }, view);
    return {
      left: topLeft.x,
      top: topLeft.y,
      width: marker.size * view.scale,
      height: marker.size * view.scale,
      shape: marker.shape,
    };
  }, [api.selectedMarkerId, doc, view]);

  const cursor = (() => {
    if (panning) return 'grabbing';
    if (tool === 'move') return 'grab';
    if (tool === 'brush') return 'crosshair';
    if (tool === 'mosaic') return 'crosshair';
    if (tool === 'crop') return 'crosshair';
    if (tool === 'text') return 'text';
    if (tool === 'marker') return 'copy';
    return 'grab';
  })();

  const zoomPercent = Math.round(view.scale * 100);

  return (
    <div
      ref={containerRef}
      className={`ris-stage${tool === 'crop' ? ' is-cropping' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
      onDoubleClick={onDoubleClick}
      onContextMenu={(event) => event.preventDefault()}
      style={{ cursor }}
      role="application"
      aria-label="Image canvas"
      tabIndex={-1}
    >
      <canvas ref={canvasRef} className="ris-stage__canvas" />
      <canvas ref={overlayRef} className="ris-stage__overlay" />

      {hasImage && tool === 'crop' && cropScreen && cropScreen.width > 0 ? (
        <div
          className="ris-crop"
          style={{ left: cropScreen.left, top: cropScreen.top, width: cropScreen.width, height: cropScreen.height }}
        >
          <div className="ris-crop__grid" aria-hidden="true" />
          {HANDLES.map((handle) => {
            const position = handlePositions({ x: 0, y: 0, width: cropScreen.width, height: cropScreen.height })[handle];
            return (
              <span
                key={handle}
                className={`ris-crop__handle ris-crop__handle--${handle}`}
                style={{
                  left: position.x,
                  top: position.y,
                  cursor: CURSOR_FOR_HANDLE[handle],
                }}
              />
            );
          })}
        </div>
      ) : null}

      {hasImage && tool === 'crop' && cropScreen ? (
        <div
          className="ris-crop__badge"
          style={{ left: cropScreen.left, top: Math.max(8, cropScreen.top - 34) }}
        >
          {Math.round(api.cropRect?.width ?? 0)} × {Math.round(api.cropRect?.height ?? 0)}
        </div>
      ) : null}

      {selectedTextScreen && tool === 'text' ? (
        <div
          className="ris-text-box"
          style={{
            left: selectedTextScreen.left,
            top: selectedTextScreen.top,
            width: selectedTextScreen.width,
            height: selectedTextScreen.height,
            transform: `rotate(${selectedTextScreen.rotation}deg)`,
            transformOrigin: 'top left',
          }}
          aria-hidden="true"
        />
      ) : null}

      {selectedMarkerScreen && tool === 'marker' ? (
        <div
          className={`ris-marker-box${selectedMarkerScreen.shape === 'square' ? ' is-square' : ''}`}
          style={{
            left: selectedMarkerScreen.left,
            top: selectedMarkerScreen.top,
            width: selectedMarkerScreen.width,
            height: selectedMarkerScreen.height,
          }}
          aria-hidden="true"
        />
      ) : null}

      {hasImage ? (
        <div className="ris-zoom" role="group" aria-label="Zoom">
          <Button
            variant="soft"
            size="sm"
            icon="zoom-out"
            aria-label={api.labels.app.zoomOut}
            title={api.labels.app.zoomOut}
            onClick={() => api.zoomBy(1 / 1.25)}
          />
          <button
            type="button"
            className="ris-zoom__value"
            title={api.labels.app.zoomActual}
            onClick={() => api.zoomTo(1)}
          >
            {zoomPercent}%
          </button>
          <Button
            variant="soft"
            size="sm"
            icon="zoom-in"
            aria-label={api.labels.app.zoomIn}
            title={api.labels.app.zoomIn}
            onClick={() => api.zoomBy(1.25)}
          />
          <Button
            variant="soft"
            size="sm"
            icon="fit"
            aria-label={api.labels.app.zoomFit}
            title={api.labels.app.zoomFit}
            onClick={api.fit}
          />
        </div>
      ) : null}

      {status === 'loading' ? (
        <div className="ris-stage__state" role="status">
          <span className="ris-spinner" aria-hidden="true" />
          <span>{api.labels.app.loading}</span>
        </div>
      ) : null}

      {api.message ? (
        <div className="ris-toast" role="status">
          {api.message}
        </div>
      ) : null}
    </div>
  );
}
