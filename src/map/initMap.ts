import maplibregl, { Map } from 'maplibre-gl';

/**
 * Initialize MapLibre GL map with MapTiler Satellite style.
 * Expects VITE_MAPTILER_KEY from env.
 */
export function initMap(
  containerId: string,
  onReady: (map: Map) => void,
  onRender: (map: Map) => void,
  onResize: (map: Map) => void
): Map {
  const key = (import.meta as any).env?.VITE_MAPTILER_KEY as string | undefined;
  const styleUrl = key
    ? `https://api.maptiler.com/maps/satellite/style.json?key=${key}`
    : // Fallback: public demo (limited). Recommend setting your own key.
      'https://demotiles.maplibre.org/style.json';

  const map = new maplibregl.Map({
    container: containerId,
    style: styleUrl,
    center: [127.0, 37.5], // Korea approx
    zoom: 16,
    pitch: 0,
    bearing: 0,
    antialias: true,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');

  map.on('load', () => onReady(map));
  map.on('render', () => onRender(map));
  map.on('resize', () => onResize(map));

  return map;
}