import type { Map } from 'maplibre-gl';
import type { GridRuntime, GridSettings, SelectionState } from '@/types';

export function initSelection(
  rootEl: HTMLElement,
  map: Map,
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
  };

  const interactionsSnapshot = {
    dragPan: true,
    dragRotate: true,
    scrollZoom: true,
  };

  function snapshotAndDisableMapInteractions() {
    // @ts-ignore private access
    interactionsSnapshot.dragPan = map.dragPan?._enabled ?? true;
    // @ts-ignore
    interactionsSnapshot.dragRotate = map.dragRotate?._enabled ?? true;
    // @ts-ignore
    interactionsSnapshot.scrollZoom = map.scrollZoom?._enabled ?? true;

    map.dragPan?.disable();
    map.dragRotate?.disable();
    map.scrollZoom?.disable();
  }

  function restoreMapInteractions() {
    if (interactionsSnapshot.dragPan) map.dragPan?.enable();
    if (interactionsSnapshot.dragRotate) map.dragRotate?.enable();
    if (interactionsSnapshot.scrollZoom) map.scrollZoom?.enable();
  }

  function onMouseDown(ev: MouseEvent) {
    const settings = getSettings();
    if (!settings.enabled) return; // selection only when grid ON
    if (ev.button !== 0) return; // left only

    state.active = true;
    state.exists = false;
    const rect = (rootEl as HTMLElement).getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    state.startPx = { x, y };
    state.currentPx = { x, y };
    state.rectPx = { x, y, w: 0, h: 0 };

    try {
      (rootEl as HTMLElement).setPointerCapture?.((ev as any).pointerId);
    } catch {}

    snapshotAndDisableMapInteractions();
  }

  function onMouseMove(ev: MouseEvent) {
    if (!state.active) return;
    const rect = (rootEl as HTMLElement).getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    state.currentPx = { x, y };

    if (state.startPx) {
      const sx = state.startPx.x;
      const sy = state.startPx.y;
      const rx = Math.min(sx, x);
      const ry = Math.min(sy, y);
      const rw = Math.abs(x - sx);
      const rh = Math.abs(y - sy);
      state.rectPx = { x: rx, y: ry, w: rw, h: rh };

      // Update width/height in meters using current runtime (will be re-evaluated in main on render)
      const rt = getRuntime();
      state.widthM = rw * rt.mppX;
      state.heightM = rh * rt.mppY;
    }
  }

  function onMouseUp(_ev: MouseEvent) {
    if (!state.active) return;
    state.active = false;
    state.exists = !!state.rectPx && state.rectPx.w > 0 && state.rectPx.h > 0;
    restoreMapInteractions();
  }

  function onContextMenu(ev: MouseEvent) {
    ev.preventDefault();
    // Clear selection
    state.active = false;
    state.exists = false;
    state.startPx = null;
    state.currentPx = null;
    state.rectPx = null;
    // map interactions remain unchanged
  }

  function attach() {
    rootEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    rootEl.addEventListener('contextmenu', onContextMenu);
  }

  function detach() {
    rootEl.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    rootEl.removeEventListener('contextmenu', onContextMenu);
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
  }

  attach();

  return { getState, clear, attach, detach };
}