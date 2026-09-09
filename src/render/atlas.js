/**
 * Atlas loader with bounded cache. Missing art → labelled silhouette in non-production.
 * When meta.image is null, frame.source SVGs under ./assets/approved/ are preloaded per frame.
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
      const frames = meta.frames || {};
      const frameImages = {};
      let img = null;

      if (meta.image != null) {
        const src = meta.image.startsWith('.') || meta.image.startsWith('/')
          ? meta.image
          : `./assets/atlases/${meta.image}`;
        img = await loadImage(src);
      } else {
        await Promise.all(
          Object.entries(frames).map(async ([id, frame]) => {
            if (!frame?.source) return;
            try {
              frameImages[id] = await loadImage(`./assets/approved/${frame.source}`);
            } catch {
              /* silhouette fallback in drawFrame */
            }
          }),
        );
      }

      const atlas = { id: atlasId, meta, img, frames, frameImages };
      cache.set(atlasId, atlas);
      return atlas;
    } catch (err) {
      const atlas = {
        id: atlasId, meta: { frames: {} }, img: null, frameImages: {}, error: String(err), frames: {},
      };
      cache.set(atlasId, atlas);
      return atlas;
    } finally {
      inflight.delete(atlasId);
    }
  })();

  inflight.set(atlasId, p);
  return p;
}

/** Ensure atlas is loaded (alias of loadAtlas for scene wiring). */
export async function ensureAtlas(id) {
  return loadAtlas(id);
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
  const frameImg = atlas?.frameImages?.[frameId];

  if (frameImg) {
    ctx.save();
    if (opts.flipX) {
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(frameImg, 0, 0, dw, dh);
    } else {
      ctx.drawImage(frameImg, dx, dy, dw, dh);
    }
    ctx.restore();
    return;
  }

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
