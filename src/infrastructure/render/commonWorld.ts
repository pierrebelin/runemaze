export const MAP_GAP = 2;

export interface MapPlacement { x: number; y: number; w: number; h: number }
export interface CommonWorld { maps: MapPlacement[]; w: number; h: number }

export interface WorldView { x: number; y: number; scale: number }

export function fittedView(map: MapPlacement, screen: { w: number; h: number }): WorldView {
  const scale = Math.max(8, Math.floor(Math.min(screen.w / map.w, screen.h / map.h) * 4) / 4);
  return {
    x: map.x - (screen.w / scale - map.w) / 2,
    y: map.y - (screen.h / scale - map.h) / 2,
    scale,
  };
}

export function layOutMaps(sizes: { w: number; h: number }[]): CommonWorld {
  let x = 0;
  const maps = sizes.map(({ w, h }) => {
    const placement = { x, y: 0, w, h };
    x += w + MAP_GAP;
    return placement;
  });
  return {
    maps,
    w: x > 0 ? x - MAP_GAP : 0,
    h: Math.max(0, ...sizes.map((s) => s.h)),
  };
}

export function toWorldPoint(view: WorldView, p: { x: number; y: number }): { x: number; y: number } {
  return { x: view.x + p.x / view.scale, y: view.y + p.y / view.scale };
}

export function mapAt(world: CommonWorld, p: { x: number; y: number }): { index: number; x: number; y: number } | null {
  const index = world.maps.findIndex((m) => p.x >= m.x && p.x < m.x + m.w && p.y >= m.y && p.y < m.y + m.h);
  if (index < 0) return null;
  const m = world.maps[index];
  return { index, x: p.x - m.x, y: p.y - m.y };
}

export function isMapVisible(view: WorldView, screen: { w: number; h: number }, map: MapPlacement): boolean {
  const left = (map.x - view.x) * view.scale;
  const top = (map.y - view.y) * view.scale;
  return left < screen.w && left + map.w * view.scale > 0 && top < screen.h && top + map.h * view.scale > 0;
}

export const DRAG_THRESHOLD = 6;

export function isDrag(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) > DRAG_THRESHOLD;
}

export const MAX_ZOOM = 2;

export function zoomView(view: WorldView, factor: number, at: { x: number; y: number }, world: CommonWorld, fitted: WorldView, screen: { w: number; h: number }): WorldView {
  const entire = Math.min(screen.w / world.w, screen.h / world.h);
  const scale = Math.min(MAX_ZOOM * fitted.scale, Math.max(Math.min(fitted.scale, entire), view.scale * factor));
  const p = toWorldPoint(view, at);
  return panView({ x: p.x - at.x / scale, y: p.y - at.y / scale, scale }, 0, 0, world, screen);
}

export function panView(view: WorldView, dx: number, dy: number, world: CommonWorld, screen: { w: number; h: number }): WorldView {
  const halfW = screen.w / 2 / view.scale;
  const halfH = screen.h / 2 / view.scale;
  const cx = Math.min(world.w, Math.max(0, view.x + halfW - dx / view.scale));
  const cy = Math.min(world.h, Math.max(0, view.y + halfH - dy / view.scale));
  return { x: cx - halfW, y: cy - halfH, scale: view.scale };
}
