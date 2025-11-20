/// <reference path="../types/external.d.ts" />
import { loadNaver } from '@/map/naverLoader';
import type { MapLike } from '@/types';

/**
 * Initialize Naver Map (JS v3) with HYBRID (satellite+labels) map type.
 * Expects VITE_NAVER_MAP_CLIENT_ID from env.
 */
export function initMap(
  containerId: string,
  onReady: (map: MapLike) => void,
  onRender: (map: MapLike) => void,
  onResize: (map: MapLike) => void
): MapLike {
  const clientId = (import.meta as any).env?.VITE_NAVER_MAP_CLIENT_ID as string | undefined;
  const masked = clientId ? `${(clientId as string).slice(0, 4)}***` : '(empty)';
  if (!clientId) {
    console.warn('VITE_NAVER_MAP_CLIENT_ID is missing. Naver map may fail to load.');
  }

  const containerEl = document.getElementById(containerId) as HTMLElement;
  if (!containerEl) throw new Error(`Container #${containerId} not found`);

  // Debug info for quick diagnosis
  console.info('[initMap] origin=', location.origin, 'clientId=', masked);

  let gmap: any = null;
  let readyFired = false;

  const adapter: MapLike = {
    getContainer() {
      return containerEl;
    },
    getCenter() {
      if (!gmap) return { lng: 127.0, lat: 37.5 };
      const c = gmap.getCenter();
      return { lng: c.lng(), lat: c.lat() };
    },
    project(lngLat: { lng: number; lat: number }) {
      if (!gmap) return { x: 0, y: 0 };
      const proj = gmap.getProjection();
      const pt = proj.fromCoordToOffset(new naver.maps.LatLng(lngLat.lat, lngLat.lng));
      return { x: pt.x, y: pt.y };
    },
    unproject(px: { x: number; y: number }) {
      if (!gmap) return { lng: 127.0, lat: 37.5 };
      const proj = gmap.getProjection();
      const coord = proj.fromOffsetToCoord(new naver.maps.Point(px.x, px.y));
      return { lng: coord.lng(), lat: coord.lat() };
    },
  };

  // Load script and create map
  loadNaver((clientId || '').trim()).then(() => {
    gmap = new naver.maps.Map(containerEl, {
      center: new naver.maps.LatLng(37.5, 127.0),
      zoom: 16,
      mapTypeId: naver.maps.MapTypeId.HYBRID,
    });

    const scheduleRender = () => {
      // Use rAF to collapse multiple events
      requestAnimationFrame(() => onRender(adapter));
    };

    // First idle -> onReady once, and also render
    naver.maps.Event.addListener(gmap, 'idle', () => {
      if (!readyFired) {
        readyFired = true;
        onReady(adapter);
      }
      scheduleRender();
    });

    naver.maps.Event.addListener(gmap, 'center_changed', scheduleRender);
    naver.maps.Event.addListener(gmap, 'zoom_changed', scheduleRender);
    // Some environments may not support heading/tilt; idle covers them sufficiently if unsupported
    try {
      naver.maps.Event.addListener(gmap, 'heading_changed', scheduleRender);
      naver.maps.Event.addListener(gmap, 'tilt_changed', scheduleRender);
    } catch {}
    naver.maps.Event.addListener(gmap, 'size_changed', () => onResize(adapter));
  }).catch((e) => {
    console.error(e);
  });

  return adapter;
}