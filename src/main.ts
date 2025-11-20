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

  // selection 참조를 안전하게 캡처하기 위한 레퍼런스
  let selectionRef: ReturnType<typeof initSelection> | null = null;

  // Overlay 먼저 생성하되, getSelection은 selectionRef가 없을 수 있음을 고려
  const overlay = initGridOverlay(canvas, {
    map: m,
    getSettings: () => settings,
    getSelection: () => {
      if (selectionRef) return selectionRef.getState();
      const empty: SelectionState = { active: false, exists: false, startPx: null, currentPx: null, rectPx: null, widthM: 0, heightM: 0, world: null };
      return empty;
    },
  });

  runtime = overlay.getRuntime();

  // selection은 map 컨테이너 기준(좌클릭은 맵 이동 유지, 우클릭만 선택)
  const selection = initSelection(mapEl, m, () => overlay.getRuntime(), () => settings);
  selectionRef = selection;

  initControls(ui, settings, {
    onSettingsChange: (partial) => {
      settings = { ...settings, ...partial };
      overlay.requestDraw();
    },
    onToggle: (enabled) => {
      settings = { ...settings, enabled };
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
  if (!sel || !(sel.active || sel.exists)) {
    labelEl.style.display = 'none';
    return;
  }
  const rt = overlay.getRuntime();
  let wM = 0, hM = 0;
  let cx = 0, cy = 0;

  if (sel.world) {
    wM = (sel.world.maxMX - sel.world.minMX);
    hM = (sel.world.maxMY - sel.world.minMY);
    if (sel.rectPx) {
      cx = sel.rectPx.x + sel.rectPx.w / 2;
      cy = sel.rectPx.y + sel.rectPx.h / 2;
    }
  } else if (sel.rectPx) {
    wM = sel.rectPx.w * (rt.mppX || 1);
    hM = sel.rectPx.h * (rt.mppY || 1);
    cx = sel.rectPx.x + sel.rectPx.w / 2;
    cy = sel.rectPx.y + sel.rectPx.h / 2;
  } else {
    labelEl.style.display = 'none';
    return;
  }

  labelEl.textContent = `${wM.toFixed(1)}m x ${hM.toFixed(1)}m`;
  if (cx && cy) {
    labelEl.style.left = `${cx}px`;
    labelEl.style.top = `${cy}px`;
    labelEl.style.display = 'block';
  } else {
    labelEl.style.display = 'none';
  }
}