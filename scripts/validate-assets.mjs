import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'assets/source/manifest.json');

if (!existsSync(manifestPath)) {
  console.error('missing manifest');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const ids = new Set();
const errors = [];

for (const a of manifest.assets) {
  if (ids.has(a.id)) errors.push(`duplicate id ${a.id}`);
  ids.add(a.id);
  if (!a.approvalStatus || !['approved', 'placeholder-ship'].includes(a.approvalStatus)) {
    errors.push(`unapproved ${a.id}`);
  }
  if (!a.checksum) errors.push(`no checksum ${a.id}`);
  if (!a.logicalSize || !a.sourceSize) errors.push(`size missing ${a.id}`);
  const filePath = a.file.startsWith('../')
    ? resolve(root, a.file.replace(/^\.\.\//, ''))
    : resolve(root, 'assets/approved', a.file);
  // icons path fix
  const alt = a.category === 'icon' ? resolve(root, 'public/icons', a.id.replace('icon-', '') + '.svg') : filePath;
  if (!existsSync(filePath) && !existsSync(alt)) errors.push(`missing file ${a.id} (${a.file})`);
}

const atlasIndex = resolve(root, 'public/assets/atlases/index.json');
if (!existsSync(atlasIndex)) errors.push('missing atlases — run assets:atlas');
else {
  const idx = JSON.parse(readFileSync(atlasIndex, 'utf8'));
  for (const a of idx.atlases || []) {
    const jsonPath = resolve(root, 'public/assets/atlases', `${a.id}.json`);
    if (!existsSync(jsonPath)) {
      errors.push(`missing atlas json ${a.id}`);
      continue;
    }
    const atlas = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const imgs = Array.isArray(atlas.images) && atlas.images.length
      ? atlas.images
      : (atlas.image ? [atlas.image] : []);
    if (!imgs.length) errors.push(`atlas ${a.id} has no packed image`);
    for (const im of imgs) {
      const p = resolve(root, 'public/assets/atlases', im);
      if (!existsSync(p)) errors.push(`missing packed sheet ${im}`);
    }
    if (atlas.width > 2048 || atlas.height > 2048) errors.push(`atlas ${a.id} exceeds 2048`);
  }
}

if (errors.length) {
  console.error('Asset validation failed:');
  for (const e of errors.slice(0, 40)) console.error(' -', e);
  if (errors.length > 40) console.error(` ... +${errors.length - 40} more`);
  process.exit(1);
}

console.log(`OK ${manifest.assets.length} assets validated`);
