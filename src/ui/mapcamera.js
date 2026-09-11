/**
 * Campaign-map camera. Pure — no DOM.
 * Ported behavior from the original mapcamera (not its drawing).
 */
export const MIN_SCALE = 1;
export const MAX_SCALE = 3.5;

export function createCamera() {
  return { scale: 1, x: 0, y: 0 };
}

export function clampCamera(cam, bounds) {
  if (!cam) return cam;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number.isFinite(cam.scale) ? cam.scale : 1));
  cam.scale = scale;
  const w = bounds?.width || 0;
  const h = bounds?.height || 0;
  const ww = bounds?.worldW || w;
  const wh = bounds?.worldH || h;
  const viewW = w / scale;
  const viewH = h / scale;
  const maxX = Math.max(0, ww - viewW);
  const maxY = Math.max(0, wh - viewH);
  let x = Number.isFinite(cam.x) ? cam.x : 0;
  let y = Number.isFinite(cam.y) ? cam.y : 0;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x > maxX) x = maxX;
  if (y > maxY) y = maxY;
  cam.x = x;
  cam.y = y;
  return cam;
}

export function worldToScreen(pt, cam) {
  const s = cam?.scale || 1;
  return {
    x: (pt.x - (cam?.x || 0)) * s,
    y: (pt.y - (cam?.y || 0)) * s,
  };
}

export function screenToWorld(pt, cam) {
  const s = cam?.scale || 1;
  return {
    x: pt.x / s + (cam?.x || 0),
    y: pt.y / s + (cam?.y || 0),
  };
}

export function applyZoom(cam, factor, focalPoint, bounds) {
  const world = screenToWorld(focalPoint, cam);
  let next = (cam.scale || 1) * (Number.isFinite(factor) ? factor : 1);
  if (!Number.isFinite(next)) next = 1;
  cam.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
  cam.x = world.x - focalPoint.x / cam.scale;
  cam.y = world.y - focalPoint.y / cam.scale;
  if (bounds) clampCamera(cam, bounds);
  return cam;
}

export function applyPan(cam, dx, dy, bounds) {
  const s = cam.scale || 1;
  cam.x -= (Number.isFinite(dx) ? dx : 0) / s;
  cam.y -= (Number.isFinite(dy) ? dy : 0) / s;
  if (bounds) clampCamera(cam, bounds);
  return cam;
}
