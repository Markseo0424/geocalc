import type { Map } from 'maplibre-gl';
import type { GridRuntime, GridSettings, SelectionState } from '@/types';
import { computeMpp, computePhases, decideMode, toPxFromMeters } from './gridCompute';

export interface GridOverlayDeps {
  map: Map;
  getSettings: () => GridSettings;
  getSelection: () => SelectionState;
}

export function initGridOverlay(canvas: HTMLCanvasElement, deps: GridOverlayDeps) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context not available');

  const runtime: GridRuntime = {
    mppX: 1,
    mppY: 1,
    spacingPxX: 10,
    spacingPxY: 10,
    offsetPxX: 0,
    offsetPxY: 0,
    phaseX: 0,
    phaseY: 0,
    dpr: window.devicePixelRatio || 1,
    canvasSize: { width: 0, height: 0 },
    mode: 'cells',
  };

  let needsDraw = true;
  let rafId: number | null = null;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    runtime.dpr = dpr;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    runtime.canvasSize = { width: w, height: h };
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    requestDraw();
  }

  function requestDraw() {
    needsDraw = true;
    if (rafId == null) rafId = requestAnimationFrame(drawNow);
  }

  function updateOnMapRender() {
    const { map } = deps;
    const center = { x: runtime.canvasSize.width / 2, y: runtime.canvasSize.height / 2 };
    const mpp = computeMpp(map, center);
    runtime.mppX = mpp.mppX;
    runtime.mppY = mpp.mppY;
    requestDraw();
  }

  function drawGrid() {
    const { map, getSettings } = deps;
    const settings = getSettings();

    // Clear
    ctx.clearRect(0, 0, runtime.canvasSize.width, runtime.canvasSize.height);
    if (!settings.enabled) return;

    // Compute pixel spacing and offsets
    const spacingPxX = toPxFromMeters(settings.spacingM, runtime.mppX);
    const spacingPxY = toPxFromMeters(settings.spacingM, runtime.mppY);
    runtime.spacingPxX = spacingPxX;
    runtime.spacingPxY = spacingPxY;

    const offsetMX = (settings.offsetXmCm || 0) / 100; // cm -> m
    const offsetMY = (settings.offsetYmCm || 0) / 100; // cm -> m
    const offsetPxX = toPxFromMeters(offsetMX, runtime.mppX);
    const offsetPxY = toPxFromMeters(offsetMY, runtime.mppY);
    runtime.offsetPxX = offsetPxX;
    runtime.offsetPxY = offsetPxY;

    // Anchor in pixel space (project from lngLat)
    const anchor = map.project({ lng: settings.anchorLngLat[0], lat: settings.anchorLngLat[1] });
    const { phaseX, phaseY } = computePhases(
      { x: anchor.x, y: anchor.y },
      { x: offsetPxX, y: offsetPxY },
      { x: spacingPxX, y: spacingPxY }
    );
    runtime.phaseX = phaseX;
    runtime.phaseY = phaseY;

    // Mode
    runtime.mode = decideMode(spacingPxX, spacingPxY, runtime.canvasSize.width, runtime.canvasSize.height);

    // Colors with opacity
    const alpha = Math.max(0.1, Math.min(0.9, settings.opacity));
    const light = `rgba(255,255,255,${0.25 * alpha})`;
    const dark = `rgba(0,0,0,${0.15 * alpha})`;
    const line = `rgba(255,255,255,${0.3 * alpha})`;

    if (runtime.mode === 'cells') {
      const cols = Math.ceil(runtime.canvasSize.width / spacingPxX) + 2;
      const rows = Math.ceil(runtime.canvasSize.height / spacingPxY) + 2;
      for (let r = -1; r < rows; r++) {
        for (let c = -1; c < cols; c++) {
          const x = c * spacingPxX + phaseX;
          const y = r * spacingPxY + phaseY;
          const isDark = (r + c) % 2 === 0;
          ctx.fillStyle = isDark ? dark : light;
          ctx.fillRect(x, y, spacingPxX, spacingPxY);
        }
      }
      // cell border lines (optional subtle)
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      // Vertical lines
      for (let x = phaseX; x <= runtime.canvasSize.width + spacingPxX; x += spacingPxX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, runtime.canvasSize.height);
        ctx.stroke();
      }
      // Horizontal lines
      for (let y = phaseY; y <= runtime.canvasSize.height + spacingPxY; y += spacingPxY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(runtime.canvasSize.width, y);
        ctx.stroke();
      }
    } else {
      // lines-only mode
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      for (let x = phaseX; x <= runtime.canvasSize.width + spacingPxX; x += spacingPxX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, runtime.canvasSize.height);
        ctx.stroke();
      }
      for (let y = phaseY; y <= runtime.canvasSize.height + spacingPxY; y += spacingPxY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(runtime.canvasSize.width, y);
        ctx.stroke();
      }
    }
  }

  function drawSelection() {
    const sel = deps.getSelection();
    if (!sel || !sel.rectPx || !sel.exists) return;
    const r = sel.rectPx;
    // selection rect
    ctx.save();
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--selection-fill') || 'rgba(0,150,255,0.15)';
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--selection-stroke') || 'rgba(0,150,255,0.9)';
    ctx.lineWidth = 2;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  function drawNow() {
    rafId = null;
    if (!needsDraw) return;
    needsDraw = false;

    drawGrid();
    drawSelection();
  }

  // Initial sizing
  resize();

  return {
    requestDraw,
    resize,
    updateOnMapRender,
    getRuntime: () => runtime,
    teardown() {
      if (rafId != null) cancelAnimationFrame(rafId);
    },
  };
}