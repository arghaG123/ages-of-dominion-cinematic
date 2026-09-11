/**
 * Pack approved raster frames into WebP atlases (≤2048, 2px extrusion).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'assets/source/manifest.json');
const outDir = resolve(root, 'public/assets/atlases');
mkdirSync(outDir, { recursive: true });

if (!existsSync(manifestPath)) {
  console.error('Run npm run assets:placeholders first');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const MAX = 2048;
const EXTRUDE = 2;
const MAX_EDGE = 256;

const byCat = new Map();
for (const a of manifest.assets) {
  if (a.category === 'icon') continue;
  if (!byCat.has(a.category)) byCat.set(a.category, []);
  byCat.get(a.category).push(a);
}

function capSize(logical) {
  let w = Math.max(8, Math.round(logical?.[0] || 64));
  let h = Math.max(8, Math.round(logical?.[1] || 64));
  const m = Math.max(w, h);
  if (m > MAX_EDGE) {
    const s = MAX_EDGE / m;
    w = Math.max(8, Math.round(w * s));
    h = Math.max(8, Math.round(h * s));
  }
  return [w, h];
}

function packLayout(items, scale) {
  let x = EXTRUDE;
  let y = EXTRUDE;
  let rowH = 0;
  let sheetW = EXTRUDE;
  let sheetH = EXTRUDE;
  const placed = [];
  for (const item of items) {
    const w = Math.max(1, Math.round(item.w * scale));
    const h = Math.max(1, Math.round(item.h * scale));
    if (x + w + EXTRUDE > MAX) {
      x = EXTRUDE;
      y += rowH + EXTRUDE * 2;
      rowH = 0;
    }
    if (y + h + EXTRUDE > MAX) return null;
    placed.push({ ...item, x, y, dw: w, dh: h });
    rowH = Math.max(rowH, h);
    sheetW = Math.max(sheetW, x + w + EXTRUDE);
    sheetH = Math.max(sheetH, y + h + EXTRUDE);
    x += w + EXTRUDE * 2;
  }
  return { placed, sheetW, sheetH };
}

function fillSheet(items, scale) {
  const accepted = [];
  for (const item of items) {
    if (!packLayout([...accepted, item], scale)) break;
    accepted.push(item);
  }
  if (!accepted.length) return null;
  return { layout: packLayout(accepted, scale), used: accepted.length };
}

function blitExtruded(sheet, sw, src, iw, ih, dx, dy) {
  for (let y = -EXTRUDE; y < ih + EXTRUDE; y++) {
    const sy = y < 0 ? 0 : y >= ih ? ih - 1 : y;
    for (let x = -EXTRUDE; x < iw + EXTRUDE; x++) {
      const sx = x < 0 ? 0 : x >= iw ? iw - 1 : x;
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= sw) continue;
      const si = (sy * iw + sx) * 4;
      const ti = (ty * sw + tx) * 4;
      sheet[ti] = src[si];
      sheet[ti + 1] = src[si + 1];
      sheet[ti + 2] = src[si + 2];
      sheet[ti + 3] = src[si + 3];
    }
  }
}

async function loadFrame(a) {
  const src = resolve(root, 'assets/approved', a.file);
  if (!existsSync(src)) return null;
  const [lw, lh] = capSize(a.logicalSize);
  const { data, info } = await sharp(src)
    .resize(lw, lh, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { id: a.id, w: info.width, h: info.height, data, pivot: a.pivot };
}

async function writeSheet(placed, sheetW, sheetH, outPath) {
  const w = Math.min(MAX, Math.max(1, Math.ceil(sheetW)));
  const h = Math.min(MAX, Math.max(1, Math.ceil(sheetH)));
  const sheet = Buffer.alloc(w * h * 4);
  for (const p of placed) {
    let pix = p.data;
    let pw = p.w;
    let ph = p.h;
    if (p.dw !== p.w || p.dh !== p.h) {
      const resized = await sharp(p.data, { raw: { width: p.w, height: p.h, channels: 4 } })
        .resize(p.dw, p.dh, { fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      pix = resized.data;
      pw = resized.info.width;
      ph = resized.info.height;
    }
    blitExtruded(sheet, w, pix, pw, ph, p.x, p.y);
  }
  const webp = await sharp(sheet, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 78, alphaQuality: 80 })
    .toBuffer();
  writeFileSync(outPath, webp);
  return {
    width: w,
    height: h,
    checksum: createHash('sha256').update(webp).digest('hex').slice(0, 16),
    bytes: webp.length,
  };
}

const atlasIndex = [];

for (const [cat, assets] of byCat) {
  const framesLoaded = [];
  for (const a of assets) {
    try {
      const f = await loadFrame(a);
      if (f) framesLoaded.push(f);
      else console.warn(`skip missing ${a.id} (${a.file})`);
    } catch (err) {
      console.warn(`skip ${a.id}: ${err.message}`);
    }
  }
  if (!framesLoaded.length) {
    console.warn(`no frames for ${cat}`);
    continue;
  }

  const sheets = [];
  let rest = framesLoaded.slice();
  while (rest.length) {
    let scale = 1;
    let packed = fillSheet(rest, scale);
    while (!packed && scale > 0.15) {
      scale *= 0.75;
      packed = fillSheet(rest, scale);
    }
    if (!packed) throw new Error(`Cannot pack ${rest[0].id} into ${MAX} atlas`);
    const { layout, used } = packed;
    const sheetIdx = sheets.length;
    const file = sheetIdx === 0 && used === rest.length ? `${cat}.webp` : `${cat}-${sheetIdx}.webp`;
    const meta = await writeSheet(layout.placed, layout.sheetW, layout.sheetH, resolve(outDir, file));
    sheets.push({ file, ...meta, placed: layout.placed });
    rest = rest.slice(used);
  }

  const frames = {};
  for (let i = 0; i < sheets.length; i++) {
    for (const p of sheets[i].placed) {
      frames[p.id] = {
        x: p.x,
        y: p.y,
        w: p.dw,
        h: p.dh,
        pivot: p.pivot,
        extruded: EXTRUDE,
        ...(sheets.length > 1 ? { sheet: i } : {}),
      };
    }
  }

  const atlas = {
    id: cat,
    image: sheets.length === 1 ? sheets[0].file : null,
    images: sheets.map((s) => s.file),
    width: sheets[0].width,
    height: sheets[0].height,
    maxSize: MAX,
    extrusion: EXTRUDE,
    checksum: sheets[0].checksum,
    frames,
  };
  writeFileSync(resolve(outDir, `${cat}.json`), JSON.stringify(atlas, null, 2));
  atlasIndex.push({
    id: cat,
    frames: Object.keys(frames).length,
    sheets: sheets.length,
    width: sheets[0].width,
    height: sheets[0].height,
    bytes: sheets.reduce((n, s) => n + s.bytes, 0),
  });
  console.log(`packed ${cat}: ${Object.keys(frames).length} frames, ${sheets.length} sheet(s)`);
}

writeFileSync(resolve(outDir, 'index.json'), JSON.stringify({ atlases: atlasIndex }, null, 2));
console.log(`Wrote ${atlasIndex.length} atlases to public/assets/atlases`);
