/**
 * Canvas sizing helpers. Always drive hit-tests from CSS pixels, never backing-store pixels.
 */
export const MAX_DPR = 2;

export function fitCanvas(canvas, cssW, cssH, dprCap = MAX_DPR) {
  const dpr = Math.min((typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1, dprCap);
  const w = Math.max(1, Math.floor(cssW));
  const h = Math.max(1, Math.floor(cssH));
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, cssW: w, cssH: h, dpr };
}

/**
 * Letterbox a cols×rows grid inside a stage.
 * @returns {{ cellSize:number, offsetX:number, offsetY:number, gridW:number, gridH:number }}
 */
export function calcGridGeometry(stageW, stageH, cols, rows) {
  if (stageW <= 0 || stageH <= 0 || cols <= 0 || rows <= 0) {
    return { cellSize: 0, offsetX: 0, offsetY: 0, gridW: 0, gridH: 0 };
  }
  const cellSize = Math.min(stageW / cols, stageH / rows);
  const gridW = cellSize * cols;
  const gridH = cellSize * rows;
  return {
    cellSize,
    offsetX: (stageW - gridW) / 2,
    offsetY: (stageH - gridH) / 2,
    gridW,
    gridH,
  };
}

export function needsResize(prevW, prevH, stageW, stageH) {
  return prevW !== stageW || prevH !== stageH;
}

/** Observe a canvas host for CSS size changes (ResizeObserver with window fallback). */
export function observeCanvasHost(host, onSize) {
  if (!host || typeof onSize !== 'function') return () => {};
  onSize();
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => onSize());
    ro.observe(host);
    return () => ro.disconnect();
  }
  window.addEventListener('resize', onSize);
  return () => window.removeEventListener('resize', onSize);
}

/** CSS-space point from a pointer event relative to the canvas element. */
export function cssPoint(canvas, clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: clientX - r.left, y: clientY - r.top };
}
