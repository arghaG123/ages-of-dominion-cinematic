/**
 * Shared scene render entry (handoff contract).
 * Scene controllers own the draw loop; this routes by scene id for tests/tools.
 */
import { drawSilhouette, drawFrame } from './atlas.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ w: number, h: number }} viewport
 * @param {object} state
 * @param {{ scene?: string, assets?: object, atlas?: object, frameId?: string }} assets
 */
export function renderScene(ctx, viewport, state, assets = {}) {
  const w = viewport?.w || 0;
  const h = viewport?.h || 0;
  if (!ctx || !w || !h) return;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#141820';
  ctx.fillRect(0, 0, w, h);
  if (assets.atlas && assets.frameId) {
    drawFrame(ctx, assets.atlas, assets.frameId, 0, 0, w, h);
    return;
  }
  const label = assets.scene || state?.scene || 'scene';
  drawSilhouette(ctx, w * 0.25, h * 0.3, w * 0.5, h * 0.35, label);
}
