/**
 * Pack approved SVG/raster frames into atlas metadata (≤2048).
 * For SVG placeholders we emit a JSON atlas that references individual files
 * (runtime drawSilhouette / img load). When WebP sheets exist, frames map into them.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const byCat = new Map();
for (const a of manifest.assets) {
  if (a.category === 'icon') continue;
  const key = a.category;
  if (!byCat.has(key)) byCat.set(key, []);
  byCat.get(key).push(a);
}

const atlasIndex = [];

for (const [cat, assets] of byCat) {
  const frames = {};
  let x = EXTRUDE;
  let y = EXTRUDE;
  let rowH = 0;
  let sheetW = 0;
  let sheetH = 0;
  const cell = 64;

  for (const a of assets) {
    const w = cell;
    const h = cell;
    if (x + w + EXTRUDE > MAX) {
      x = EXTRUDE;
      y += rowH + EXTRUDE * 2;
      rowH = 0;
    }
    if (y + h + EXTRUDE > MAX) {
      console.warn(`Atlas ${cat} exceeded 2048 — truncating remaining into overflow note`);
      break;
    }
    frames[a.id] = {
      x, y, w, h,
      pivot: a.pivot,
      source: a.file,
      extruded: EXTRUDE,
    };
    rowH = Math.max(rowH, h);
    sheetW = Math.max(sheetW, x + w + EXTRUDE);
    sheetH = Math.max(sheetH, y + h + EXTRUDE);
    x += w + EXTRUDE * 2;
  }

  const atlas = {
    id: cat,
    image: null, // SVG pack uses per-frame sources until WebP pass
    width: sheetW,
    height: sheetH,
    maxSize: MAX,
    extrusion: EXTRUDE,
    frames,
  };
  writeFileSync(resolve(outDir, `${cat}.json`), JSON.stringify(atlas, null, 2));
  atlasIndex.push({ id: cat, frames: Object.keys(frames).length, width: sheetW, height: sheetH });
}

writeFileSync(resolve(outDir, 'index.json'), JSON.stringify({ atlases: atlasIndex }, null, 2));
console.log(`Wrote ${atlasIndex.length} atlases to public/assets/atlases`);
