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

if (errors.length) {
  console.error('Asset validation failed:');
  for (const e of errors.slice(0, 40)) console.error(' -', e);
  if (errors.length > 40) console.error(` ... +${errors.length - 40} more`);
  process.exit(1);
}

console.log(`OK ${manifest.assets.length} assets validated`);
