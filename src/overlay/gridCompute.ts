import type { MapLike } from '@/types';
import { LARGE_CELL_PX, MAX_CELLS, MAX_LINES, MIN_CELL_PX } from '@/types';

// Euclidean modulo (handles negatives): returns value in [0, m)
export const emod = (n: number, m: number) => ((n % m) + m) % m;

// Haversine distance in meters between two lat/lon points
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Compute meters-per-pixel at a given screen pixel position using unproject deltas
export function computeMpp(map: MapLike, atPx: { x: number; y: number }): { mppX: number; mppY: number } {
  const p = atPx;
  const a = map.unproject({ x: p.x, y: p.y });
  const b = map.unproject({ x: p.x + 1, y: p.y });
  const c = map.unproject({ x: p.x, y: p.y + 1 });
  const mppX = haversine(a.lat, a.lng, b.lat, b.lng);
  const mppY = haversine(a.lat, a.lng, c.lat, c.lng);
  // Guard against zero/NaN
  return {
    mppX: mppX > 0 && isFinite(mppX) ? mppX : 1,
    mppY: mppY > 0 && isFinite(mppY) ? mppY : 1,
  };
}

export function toPxFromMeters(m: number, mpp: number): number {
  return m / (mpp || 1);
}

// Compute phase to align grid lines at anchor+offset in pixel space using Euclidean modulo
export function computePhases(
  anchorPx: { x: number; y: number },
  offsetPx: { x: number; y: number },
  spacingPx: { x: number; y: number }
): { phaseX: number; phaseY: number } {
  const baseX = anchorPx.x + offsetPx.x;
  const baseY = anchorPx.y + offsetPx.y;
  // phase moves in the same direction as base: phase = base mod spacing
  const phaseX = emod(baseX, spacingPx.x || 1);
  const phaseY = emod(baseY, spacingPx.y || 1);
  return { phaseX, phaseY };
}

// Decide rendering mode: 'cells' or 'lines' based on density and caps
export function decideMode(
  spacingPxX: number,
  spacingPxY: number,
  canvasW: number,
  canvasH: number
): 'cells' | 'lines' {
  const cols = Math.ceil(canvasW / Math.max(spacingPxX, 1));
  const rows = Math.ceil(canvasH / Math.max(spacingPxY, 1));
  const cells = cols * rows;

  if (spacingPxX < MIN_CELL_PX || spacingPxY < MIN_CELL_PX) return 'lines';
  if (cells > MAX_CELLS) return 'lines';
  if (cols + rows > MAX_LINES) return 'lines';
  if (spacingPxX > LARGE_CELL_PX || spacingPxY > LARGE_CELL_PX) return 'cells';
  return 'cells';
}