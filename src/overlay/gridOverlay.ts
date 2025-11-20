import type { MapLike } from '@/types';
import type { GridRuntime, GridSettings, SelectionState } from '@/types';
import { computeMpp, computePhases, decideMode, toPxFromMeters } from './gridCompute';

export interface GridOverlayDeps {
  map: MapLike;
  getSettings: () => GridSettings;
  getSelection: () => SelectionState;
}

export function initGridOverlay(canvas: HTMLCanvasElement, deps: GridOverlayDeps) {
  const maybeCtx = canvas.getContext('2d');
  if (!maybeCtx) throw new Error('2D context not available');
  const ctx: CanvasRenderingContext2D = maybeCtx;

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
    parityOffsetX: 0,
    parityOffsetY: 0,
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // CSS px 좌표계로 맞춤
    requestDraw();
  }

  function requestDraw() {
    needsDraw = true;
    if (rafId == null) rafId = requestAnimationFrame(drawNow);
  }

  function getAnchorPxCanvas(settings: GridSettings) {
    // 앵커의 맵 픽셀 좌표 → 캔버스 기준으로 보정
    const anchorLL = { lng: settings.anchorLngLat[0], lat: settings.anchorLngLat[1] };
    const anchorPxMap = deps.map.project(anchorLL);
    const mapRect = (deps.map.getContainer() as HTMLElement).getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const anchorPxCanvas = {
      x: anchorPxMap.x + (mapRect.left - canvasRect.left),
      y: anchorPxMap.y + (mapRect.top - canvasRect.top),
    };
    return { anchorPxCanvas, anchorPxMap };
  }

  function updateOnMapRender() {
    const { map, getSettings } = deps;
    const settings = getSettings();

    // 1) 앵커 픽셀 좌표(맵 기준) 및 캔버스 기준 보정
    const { anchorPxCanvas, anchorPxMap } = getAnchorPxCanvas(settings);

    // 2) mpp는 앵커 위치에서 샘플링
    const mpp = computeMpp(map, { x: anchorPxMap.x, y: anchorPxMap.y });
    runtime.mppX = mpp.mppX;
    runtime.mppY = mpp.mppY;

    // 3) spacing/offset(px)
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

    // 4) phase (유클리드 모듈러 기반), 앵커 캔버스 좌표 기준
    const { phaseX, phaseY } = computePhases(
      { x: anchorPxCanvas.x, y: anchorPxCanvas.y },
      { x: offsetPxX, y: offsetPxY },
      { x: spacingPxX, y: spacingPxY }
    );
    runtime.phaseX = phaseX;
    runtime.phaseY = phaseY;

    // 5) 체커보드 패리티 안정화
    const basePxX = anchorPxCanvas.x + offsetPxX;
    const basePxY = anchorPxCanvas.y + offsetPxY;
    const safeSX = spacingPxX || 1;
    const safeSY = spacingPxY || 1;
    const baseIndexX = Math.floor(basePxX / safeSX);
    const baseIndexY = Math.floor(basePxY / safeSY);
    runtime.parityOffsetX = baseIndexX & 1;
    runtime.parityOffsetY = baseIndexY & 1;

    requestDraw();
  }

  function drawGrid() {
    const settings = deps.getSettings();

    // Clear
    ctx.clearRect(0, 0, runtime.canvasSize.width, runtime.canvasSize.height);
    if (!settings.enabled) return;

    const spacingPxX = runtime.spacingPxX;
    const spacingPxY = runtime.spacingPxY;
    const phaseX = runtime.phaseX;
    const phaseY = runtime.phaseY;

    // Mode
    runtime.mode = decideMode(spacingPxX, spacingPxY, runtime.canvasSize.width, runtime.canvasSize.height);

    // Colors with opacity
    const alpha = Math.max(0.1, Math.min(0.9, settings.opacity));
    const light = `rgba(255,255,255,${0.25 * alpha})`;
    const dark = `rgba(0,0,0,${0.15 * alpha})`;
    const line = `rgba(255,255,255,${0.3 * alpha})`;

    if (runtime.mode === 'cells') {
      const firstX = phaseX;
      const firstY = phaseY;
      const cols = Math.ceil((runtime.canvasSize.width - firstX) / spacingPxX) + 1;
      const rows = Math.ceil((runtime.canvasSize.height - firstY) / spacingPxY) + 1;
      const baseIX = runtime.parityOffsetX || 0;
      const baseIY = runtime.parityOffsetY || 0;
      for (let iy = 0; iy < rows; iy++) {
        const y = firstY + iy * spacingPxY;
        for (let ix = 0; ix < cols; ix++) {
          const x = firstX + ix * spacingPxX;
          const parity = (baseIX + ix + baseIY + iy) & 1;
          ctx.fillStyle = parity === 0 ? dark : light;
          ctx.fillRect(x, y, spacingPxX, spacingPxY);
        }
      }
      // subtle lines
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      for (let x = firstX; x <= runtime.canvasSize.width + spacingPxX; x += spacingPxX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, runtime.canvasSize.height);
        ctx.stroke();
      }
      for (let y = firstY; y <= runtime.canvasSize.height + spacingPxY; y += spacingPxY) {
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
    if (!sel) return;
    const settings = deps.getSettings();

    let r: { x: number; y: number; w: number; h: number } | null = null;
    if (sel.world) {
      const { minMX, maxMX, minMY, maxMY } = sel.world;
      // 앵커 캔버스 좌표 기준으로 rect 계산
      const { anchorPxCanvas } = getAnchorPxCanvas(settings);
      const offsetMX = (settings.offsetXmCm || 0) / 100;
      const offsetMY = (settings.offsetYmCm || 0) / 100;
      const x = anchorPxCanvas.x + (minMX + offsetMX) / (runtime.mppX || 1);
      const y = anchorPxCanvas.y + (minMY + offsetMY) / (runtime.mppY || 1);
      const w = (maxMX - minMX) / (runtime.mppX || 1);
      const h = (maxMY - minMY) / (runtime.mppY || 1);
      r = { x, y, w, h };
    } else if (sel.rectPx) {
      r = sel.rectPx;
    }

    if (!r) return;
    if (!(sel.active || sel.exists)) return;

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