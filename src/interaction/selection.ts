import type { MapLike } from '@/types';
import type { GridRuntime, GridSettings, SelectionState } from '@/types';

export function initSelection(
  rootEl: HTMLElement,
  map: MapLike,
  getRuntime: () => GridRuntime,
  getSettings: () => GridSettings
) {
  const state: SelectionState = {
    active: false,
    exists: false,
    startPx: null,
    currentPx: null,
    rectPx: null,
    widthM: 0,
    heightM: 0,
    world: null,
  };

  function snapshotAndDisableMapInteractions() {
    // Naver Map: keep default interactions; selection is on right-drag only
    // No-op
  }

  function restoreMapInteractions() {
    // No-op
  }

  function pxToMeters(clientX: number, clientY: number) {
    const settings = getSettings();
    const rt = getRuntime();
    const rect = rootEl.getBoundingClientRect();
    const anchorPx = map.project({ lng: settings.anchorLngLat[0], lat: settings.anchorLngLat[1] });
    const offsetMX = (settings.offsetXmCm || 0) / 100;
    const offsetMY = (settings.offsetYmCm || 0) / 100;
    const xCss = clientX - rect.left;
    const yCss = clientY - rect.top;
    const dxPx = xCss - anchorPx.x;
    const dyPx = yCss - anchorPx.y;
    const mX = dxPx * (rt.mppX || 1) - offsetMX;
    const mY = dyPx * (rt.mppY || 1) - offsetMY;
    return { mX, mY, xCss, yCss };
  }

  function metersToRectPx(minMX: number, maxMX: number, minMY: number, maxMY: number) {
    const settings = getSettings();
    const rt = getRuntime();
    const anchorPx = map.project({ lng: settings.anchorLngLat[0], lat: settings.anchorLngLat[1] });
    const offsetMX = (settings.offsetXmCm || 0) / 100;
    const offsetMY = (settings.offsetYmCm || 0) / 100;
    const x = anchorPx.x + (minMX + offsetMX) / (rt.mppX || 1);
    const y = anchorPx.y + (minMY + offsetMY) / (rt.mppY || 1);
    const w = (maxMX - minMX) / (rt.mppX || 1);
    const h = (maxMY - minMY) / (rt.mppY || 1);
    return { x, y, w, h };
  }

  function onMouseDown(ev: MouseEvent) {
    const settings = getSettings();
    if (!settings.enabled) return; // selection only when grid ON
    if (ev.button !== 2) return; // right button only for selection

    ev.preventDefault();
    // 새 선택 시작이므로 이전 선택 초기화
    state.active = true;
    state.exists = false;
    state.world = null;
    state.rectPx = null;

    snapshotAndDisableMapInteractions();

    const start = pxToMeters(ev.clientX, ev.clientY);
    state.startPx = { x: start.xCss, y: start.yCss };
    state.currentPx = { x: start.xCss, y: start.yCss };
  }

  function onMouseMove(ev: MouseEvent) {
    if (!state.active) return;
    const settings = getSettings();
    if (!settings.enabled) return;

    const cur = pxToMeters(ev.clientX, ev.clientY);
    state.currentPx = { x: cur.xCss, y: cur.yCss };

    const s = Math.max(0.1, settings.spacingM || 1);

    // startPx -> meters 재계산 (루트 좌표계를 client 좌표로 환원)
    const rect = rootEl.getBoundingClientRect();
    const startClientX = (state.startPx!.x + rect.left);
    const startClientY = (state.startPx!.y + rect.top);
    const st = pxToMeters(startClientX, startClientY);

    const startMX = st.mX;
    const startMY = st.mY;
    const curMX = cur.mX;
    const curMY = cur.mY;

    const minMX = Math.min(Math.floor(startMX / s) * s, Math.floor(curMX / s) * s);
    const maxMX = Math.max(Math.ceil(startMX / s) * s, Math.ceil(curMX / s) * s);
    const minMY = Math.min(Math.floor(startMY / s) * s, Math.floor(curMY / s) * s);
    const maxMY = Math.max(Math.ceil(startMY / s) * s, Math.ceil(curMY / s) * s);

    state.world = { minMX, maxMX, minMY, maxMY };

    const rectPx = metersToRectPx(minMX, maxMX, minMY, maxMY);
    state.rectPx = rectPx;
    state.widthM = Math.max(0, maxMX - minMX);
    state.heightM = Math.max(0, maxMY - minMY);
  }

  function onMouseUp(_ev: MouseEvent) {
    if (!state.active) return;
    state.active = false;
    state.exists = !!state.world && (state.widthM > 0 && state.heightM > 0);
    restoreMapInteractions();
  }

  function onContextMenu(ev: MouseEvent) {
    const settings = getSettings();
    if (settings.enabled) {
      ev.preventDefault(); // 우클릭 메뉴 방지
    }
  }

  function onKeyDown(ev: KeyboardEvent) {
    if (ev.key === 'Escape' || ev.key === 'Esc') {
      clear();
    }
  }

  function attach() {
    rootEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    rootEl.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
  }

  function detach() {
    rootEl.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    rootEl.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKeyDown);
  }

  function getState() {
    return state;
  }

  function clear() {
    state.active = false;
    state.exists = false;
    state.startPx = null;
    state.currentPx = null;
    state.rectPx = null;
    state.world = null;
    state.widthM = 0;
    state.heightM = 0;
  }

  attach();

  return { getState, clear, attach, detach };
}