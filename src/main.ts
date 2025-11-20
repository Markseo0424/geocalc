import 'maplibre-gl/dist/maplibre-gl.css';
import type { GridRuntime, GridSettings, SelectionState } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { initMap } from '@/map/initMap';
import { initGridOverlay } from '@/overlay/gridOverlay';
import { initSelection } from '@/interaction/selection';
import { initControls } from '@/ui/controls';

const mapEl = document.getElementById('map') as HTMLDivElement;
const canvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLDivElement;
const labelEl = document.getElementById('selection-label') as HTMLDivElement;

let settings: GridSettings = { ...DEFAULT_SETTINGS };
let runtime: GridRuntime | null = null;

const map = initMap('map', onReady, onRender, onResize);

function onReady(m: any) {
  const center = m.getCenter();
  settings.anchorLngLat = [center.lng, center.lat];

  // 초기 상태에 맞춰 canvas pointer-events 조정 (격자 OFF -> none)
  canvas.style.pointerEvents = settings.enabled ? 'auto' : 'none';

  // selection 참조를 안전하게 캡처하기 위한 레퍼런스
  let selectionRef: ReturnType<typeof initSelection> | null = null;

  // Overlay 먼저 생성하되, getSelection은 selectionRef가 없을 수 있음을 고려
  const overlay = initGridOverlay(canvas, {
    map: m,
    getSettings: () => settings,
    getSelection: () => {
      if (selectionRef) return selectionRef.getState();
      // selection 초기화 전에는 빈 상태 반환
      const empty: SelectionState = { active: false, exists: false, startPx: null, currentPx: null, rectPx: null, widthM: 0, heightM: 0 };
      return empty;
    },
  });

  runtime = overlay.getRuntime();

  // 이제 selection 생성 (runtime은 overlay 생성 후 유효)
  const selection = initSelection(canvas, m, () => overlay.getRuntime(), () => settings);
  selectionRef = selection;

  initControls(ui, settings, {
    onSettingsChange: (partial) => {
      settings = { ...settings, ...partial };
      overlay.requestDraw();
    },
    onToggle: (enabled) => {
      settings = { ...settings, enabled };
      // 격자 토글에 따라 캔버스 포인터 이벤트 전환
      canvas.style.pointerEvents = enabled ? 'auto' : 'none';
      if (!enabled && selectionRef) {
        selectionRef.clear();
        labelEl.style.display = 'none';
      }
      overlay.requestDraw();
    },
    onResetAnchor: () => {
      const c = m.getCenter();
      settings.anchorLngLat = [c.lng, c.lat];
      overlay.requestDraw();
    },
  });

  // Initial draw
  overlay.requestDraw();

  // 디버깅용 노출
  (window as any).__app = { map: m, overlay, selection: selectionRef };
}

function onRender(_m: any) {
  const overlay = (window as any).__app?.overlay;
  if (overlay) overlay.updateOnMapRender();
  updateSelectionLabel();
}

function onResize(_m: any) {
  const overlay = (window as any).__app?.overlay;
  if (overlay) overlay.resize();
}

function updateSelectionLabel() {
  const overlay = (window as any).__app?.overlay;
  const selection = (window as any).__app?.selection;
  if (!overlay || !selection) {
    labelEl.style.display = 'none';
    return;
  }
  const sel = selection.getState();
  if (!sel || !sel.rectPx || !sel.exists) {
    labelEl.style.display = 'none';
    return;
  }
  const rt = overlay.getRuntime();
  const wM = sel.rectPx.w * (rt.mppX || 1);
  const hM = sel.rectPx.h * (rt.mppY || 1);
  labelEl.textContent = `${wM.toFixed(1)}m x ${hM.toFixed(1)}m`;
  const cx = sel.rectPx.x + sel.rectPx.w / 2;
  const cy = sel.rectPx.y + sel.rectPx.h / 2;
  labelEl.style.left = `${cx}px`;
  labelEl.style.top = `${cy}px`;
  labelEl.style.display = 'block';
}