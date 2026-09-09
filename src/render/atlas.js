/**
 * Atlas loader with bounded cache. Missing art → labelled silhouette in non-production.
 */
const cache = new Map();
const inflight = new Map();

export async function loadAtlas(atlasId, url = `./assets/atlases/${atlasId}.json`) {
  if (cache.has(atlasId)) return cache.get(atlasId);
  if (inflight.has(atlasId)) return inflight.get(atlasId);

  const p = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`atlas ${atlasId} HTTP ${res.status}`);
      const meta = await res.json();
      const img = await loadImage(meta.image || `./assets/atlases/${atlasId}.webp`);
      const atlas = { id: atlasId, meta, img, frames: meta.frames || {} };
      cache.set(atlasId, atlas);
      return atlas;
    } catch (err) {
      const atlas = { id: atlasId, meta: { frames: {} }, img: null, error: String(err), frames: {} };
      cache.set(atlasId, atlas);
      return atlas;
    } finally {
      inflight.delete(atlasId);
    }
  })();

  inflight.set(atlasId, p);
  return p;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image ${src}`));
    img.src = src;
  });
}

export function releaseAtlas(atlasId) {
  cache.delete(atlasId);
}

export function releaseAllAtlases() {
  cache.clear();
}

export function drawFrame(ctx, atlas, frameId, dx, dy, dw, dh, opts = {}) {
  const frame = atlas?.frames?.[frameId];
  if (!atlas?.img || !frame) {
    drawSilhouette(ctx, dx, dy, dw, dh, frameId || 'missing');
    return;
  }
  const { x, y, w, h } = frame;
  ctx.save();
  if (opts.flipX) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(atlas.img, x, y, w, h, 0, 0, dw, dh);
  } else {
    ctx.drawImage(atlas.img, x, y, w, h, dx, dy, dw, dh);
  }
  ctx.restore();
}

export function drawSilhouette(ctx, x, y, w, h, label) {
  ctx.fillStyle = '#2a3140';
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect?.(x, y, w, h, 6);
  if (!ctx.roundRect) {
    ctx.rect(x, y, w, h);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9aa3b2';
  ctx.font = `${Math.max(9, Math.floor(h * 0.18))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(label).slice(0, 12), x + w / 2, y + h / 2);
}
