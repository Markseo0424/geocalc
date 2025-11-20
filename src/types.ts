export interface GridSettings {
  enabled: boolean;
  spacingM: number; // grid spacing in meters
  offsetXmCm: number; // offset X in centimeters
  offsetYmCm: number; // offset Y in centimeters
  opacity: number; // 0.1 ~ 0.9
  anchorLngLat: [number, number]; // [lng, lat], set after map ready
}

export interface GridRuntime {
  mppX: number; // meters per pixel along X(screen)
  mppY: number; // meters per pixel along Y(screen)
  spacingPxX: number;
  spacingPxY: number;
  offsetPxX: number;
  offsetPxY: number;
  phaseX: number;
  phaseY: number;
  dpr: number;
  canvasSize: { width: number; height: number };
  mode: 'cells' | 'lines';
}

export interface SelectionState {
  active: boolean;
  exists: boolean;
  startPx: { x: number; y: number } | null;
  currentPx: { x: number; y: number } | null;
  rectPx: { x: number; y: number; w: number; h: number } | null;
  widthM: number; // computed live in main from runtime
  heightM: number; // computed live in main from runtime
}

export const DEFAULT_SETTINGS: GridSettings = {
  enabled: false,
  spacingM: 1,
  offsetXmCm: 0,
  offsetYmCm: 0,
  opacity: 0.4,
  // anchorLngLat will be set with map.getCenter() after map load
  anchorLngLat: [127.0, 37.5],
};

export const MAX_LINES = 500;
export const MAX_CELLS = 40000;
export const MIN_CELL_PX = 4; // below this, switch to line mode
export const LARGE_CELL_PX = 100; // cells too large -> cap drawing