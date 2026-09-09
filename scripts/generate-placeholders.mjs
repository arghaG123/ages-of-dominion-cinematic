/**
 * Deterministic dark-fantasy placeholders + SVG icon set + source manifest.
 * These ship as placeholder-ship until human AI+cleanup replaces them.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const approved = resolve(root, 'assets/approved');
const sourceDir = resolve(root, 'assets/source');
const publicAssets = resolve(root, 'public/assets');
const iconsDir = resolve(root, 'public/icons');
const audioDir = resolve(root, 'public/audio');

for (const d of [approved, sourceDir, publicAssets, iconsDir, audioDir, resolve(publicAssets, 'benchmarks')]) {
  mkdirSync(d, { recursive: true });
}

const AGES = ['stone', 'bronze', 'iron', 'medieval', 'gunpowder', 'industrial', 'modern'];
const BUILDINGS = ['townhall', 'farm', 'lumber', 'quarry', 'mine', 'barracks', 'workshop', 'hall', 'armory', 'walls'];
const ROLES = ['melee', 'ranged', 'heavy'];
const ANIM = ['idle', 'move', 'attack', 'hit', 'death'];
const CREATURES = ['wolf', 'bandit', 'bear', 'harpy', 'golem', 'griffin', 'wyvern', 'drone'];
const SIEGE_E = ['brute', 'runner', 'archer', 'sapper', 'shaman'];
const BIOMES = ['lowlands', 'forest', 'swamp', 'desert', 'snow', 'darklands'];
const TERRAINS = ['plains', 'forest', 'hills', 'swamp', 'desert', 'snow', 'waste', 'ruins'];
const TOWERS = ['arrow', 'splash', 'slow', 'support'];
const VFX = ['fire', 'ice', 'arrows', 'melee', 'heal', 'smoke', 'lightning', 'death', 'dust', 'rain', 'spell'];
const HEROES = ['knight', 'ranger', 'warlock'];

const entries = [];

function checksum(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

function svgPlaceholder(label, w, h, fill = '#2a3140') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="#12151b"/>
  <rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="12" fill="${fill}" stroke="#c9a227" stroke-width="3"/>
  <text x="50%" y="50%" fill="#e8e4d9" font-family="Georgia, serif" font-size="${Math.max(14, Math.floor(w / 18))}" text-anchor="middle" dominant-baseline="middle">${label}</text>
  <text x="50%" y="${h - 20}" fill="#6e788a" font-size="11" text-anchor="middle">placeholder-ship</text>
</svg>`;
}

function add(entry, svg) {
  const rel = entry.file;
  const abs = resolve(approved, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, svg);
  const sum = checksum(svg);
  entries.push({
    id: entry.id,
    category: entry.category,
    file: rel,
    atlas: entry.atlas || null,
    frame: entry.frame || null,
    pivot: entry.pivot || { x: 0.5, y: 1 },
    logicalSize: entry.logicalSize,
    sourceSize: entry.sourceSize,
    age: entry.age ?? null,
    faction: entry.faction || 'neutral',
    animation: entry.animation || null,
    prompt: entry.prompt || 'cinematic dark-fantasy placeholder',
    seed: entry.seed || 0,
    generator: 'scripts/generate-placeholders.mjs',
    humanEditor: 'pending',
    license: 'proprietary-game-asset',
    checksum: sum,
    approvalStatus: 'placeholder-ship',
  });
}

const prompt = 'Masterpiece cinematic dark-fantasy oil painting… magenta #FF00FF…';

// Benchmarks
add({ id: 'bench-hero-knight', category: 'benchmark', file: 'benchmarks/hero-knight.svg', logicalSize: [192, 256], sourceSize: [768, 1024], faction: 'player', prompt }, svgPlaceholder('Knight', 384, 512, '#4a4558'));
add({ id: 'bench-bld-townhall', category: 'benchmark', file: 'benchmarks/bld-townhall.svg', logicalSize: [128, 128], sourceSize: [512, 512], age: 0, prompt }, svgPlaceholder('Town Hall', 512, 512, '#3a4558'));
add({ id: 'bench-battle-plains', category: 'benchmark', file: 'benchmarks/battle-plains.svg', logicalSize: [375, 250], sourceSize: [1280, 853], prompt }, svgPlaceholder('Plains Battle', 640, 426, '#2c3f2e'));
add({ id: 'bench-unit-clubman', category: 'benchmark', file: 'benchmarks/unit-clubman.svg', logicalSize: [64, 64], sourceSize: [256, 256], animation: 'attack', prompt }, svgPlaceholder('Clubman', 256, 256, '#5a4634'));
add({ id: 'bench-ui-panel', category: 'benchmark', file: 'benchmarks/ui-panel.svg', logicalSize: [320, 80], sourceSize: [640, 160], prompt }, svgPlaceholder('UI Panel', 640, 160, '#1a1f29'));

for (const h of HEROES) {
  add({ id: `hero-${h}-portrait`, category: 'hero', file: `hero/${h}-portrait.svg`, logicalSize: [192, 256], sourceSize: [768, 1024], faction: 'player' }, svgPlaceholder(h, 384, 512));
  add({ id: `hero-${h}-idle`, category: 'hero', file: `hero/${h}-idle.svg`, logicalSize: [192, 128], sourceSize: [768, 512], animation: 'idle', faction: 'player' }, svgPlaceholder(`${h} idle`, 768, 512));
  add({ id: `hero-${h}-turn`, category: 'hero', file: `hero/${h}-turn.svg`, logicalSize: [192, 256], sourceSize: [768, 1024], animation: 'turn', faction: 'player' }, svgPlaceholder(`${h} turn`, 768, 1024));
}

for (let a = 0; a < AGES.length; a++) {
  for (const role of ROLES) {
    for (const anim of ANIM) {
      add({
        id: `unit-${role}-${AGES[a]}-${anim}`,
        category: 'unit',
        file: `units/${role}-${AGES[a]}-${anim}.svg`,
        logicalSize: [64, 64],
        sourceSize: [256, 256],
        age: a,
        faction: 'player',
        animation: anim,
      }, svgPlaceholder(`${role} ${AGES[a]} ${anim}`, 256, 256));
    }
  }
  for (const b of BUILDINGS) {
    add({
      id: `bld-${b}-${AGES[a]}`,
      category: 'building',
      file: `buildings/${b}-${AGES[a]}.svg`,
      logicalSize: [96, 96],
      sourceSize: [512, 512],
      age: a,
      faction: 'player',
    }, svgPlaceholder(`${b} ${AGES[a]}`, 512, 512));
  }
  for (const t of TOWERS) {
    add({
      id: `tower-${t}-${AGES[a]}`,
      category: 'tower',
      file: `towers/${t}-${AGES[a]}.svg`,
      logicalSize: [64, 64],
      sourceSize: [512, 512],
      age: a,
      faction: 'player',
    }, svgPlaceholder(`${t} ${AGES[a]}`, 512, 512));
  }
}

for (const c of CREATURES) {
  for (const anim of ANIM) {
    add({
      id: `enemy-${c}-${anim}`,
      category: 'creature',
      file: `creatures/${c}-${anim}.svg`,
      logicalSize: [64, 64],
      sourceSize: [256, 256],
      animation: anim,
      faction: 'neutral',
    }, svgPlaceholder(`${c} ${anim}`, 256, 256, '#4a2f2c'));
  }
}

for (const e of SIEGE_E) {
  add({
    id: `siege-enemy-${e}`,
    category: 'siege-enemy',
    file: `siege/enemy-${e}.svg`,
    logicalSize: [48, 48],
    sourceSize: [256, 256],
    faction: 'enemy',
  }, svgPlaceholder(e, 256, 256, '#8a3a32'));
}

add({
  id: 'rival-portrait',
  category: 'rival',
  file: 'rival/portrait.svg',
  logicalSize: [192, 256],
  sourceSize: [768, 1024],
  faction: 'enemy',
}, svgPlaceholder('Rival', 384, 512, '#8a3a32'));

for (const b of BIOMES) {
  add({ id: `map-${b}`, category: 'map', file: `map/${b}.svg`, logicalSize: [375, 250], sourceSize: [768, 512] }, svgPlaceholder(`map ${b}`, 768, 512, '#243044'));
  add({ id: `siege-lane-${b}`, category: 'siege-lane', file: `siege/lane-${b}.svg`, logicalSize: [375, 500], sourceSize: [1280, 720] }, svgPlaceholder(`lane ${b}`, 640, 360, '#3a2e24'));
}

for (const t of TERRAINS) {
  add({ id: `battle-${t}`, category: 'battleground', file: `battle/${t}.svg`, logicalSize: [375, 250], sourceSize: [1280, 853] }, svgPlaceholder(`battle ${t}`, 640, 426, '#2c3f2e'));
}

for (const v of VFX) {
  add({ id: `vfx-${v}`, category: 'vfx', file: `vfx/${v}.svg`, logicalSize: [256, 32], sourceSize: [256, 32], animation: v }, svgPlaceholder(v, 256, 32, '#1a1f29'));
}

add({ id: 'ui-metal', category: 'ui', file: 'ui/metal.svg', logicalSize: [64, 64], sourceSize: [128, 128] }, svgPlaceholder('metal', 128, 128, '#2a3140'));
add({ id: 'ui-leather', category: 'ui', file: 'ui/leather.svg', logicalSize: [64, 64], sourceSize: [128, 128] }, svgPlaceholder('leather', 128, 128, '#3a2e24'));
add({ id: 'ui-parchment', category: 'ui', file: 'ui/parchment.svg', logicalSize: [64, 64], sourceSize: [128, 128] }, svgPlaceholder('parchment', 128, 128, '#c4b79a'));
add({ id: 'ui-glass', category: 'ui', file: 'ui/glass.svg', logicalSize: [64, 64], sourceSize: [128, 128] }, svgPlaceholder('glass', 128, 128, '#243044'));
add({ id: 'fx-scaffold', category: 'prop', file: 'props/scaffold.svg', logicalSize: [64, 64], sourceSize: [256, 256] }, svgPlaceholder('scaffold', 256, 256));

// SVG icons (48+)
const iconNames = [
  'food', 'wood', 'stone', 'gold', 'realm', 'host', 'map', 'war', 'more',
  'attack', 'defend', 'move', 'wait', 'spell', 'build', 'recruit', 'age', 'mute',
  'heal', 'fire', 'ice', 'arrow', 'smoke', 'quest', 'rival', 'townhall', 'farm',
  'lumber', 'quarry', 'mine', 'barracks', 'workshop', 'hall', 'armory', 'walls',
  'melee', 'ranged', 'heavy', 'tower', 'core', 'victory', 'defeat', 'save', 'settings',
  'haptics', 'weather', 'terrain', 'boss', 'treasure', 'dwelling', 'event', 'ambush',
];
for (const name of iconNames) {
  const svg = svgPlaceholder(name, 64, 64, '#1a1f29');
  writeFileSync(resolve(iconsDir, `${name}.svg`), svg);
  entries.push({
    id: `icon-${name}`,
    category: 'icon',
    file: `../public/icons/${name}.svg`,
    atlas: null,
    frame: null,
    pivot: { x: 0.5, y: 0.5 },
    logicalSize: [24, 24],
    sourceSize: [64, 64],
    age: null,
    faction: 'ui',
    animation: null,
    prompt: 'engraved gold-on-charcoal SVG icon',
    seed: 0,
    generator: 'scripts/generate-placeholders.mjs',
    humanEditor: 'pending',
    license: 'proprietary-game-asset',
    checksum: checksum(svg),
    approvalStatus: 'placeholder-ship',
  });
}

// Minimal silent wav header stub notes (empty marker files)
writeFileSync(resolve(audioDir, 'README.md'), '# Bundled audio\nPlace theme-title.wav and sfx-*.wav here. Procedural fallback is used until present.\n');

const manifest = {
  game: 'Ages of Dominion Cinematic',
  version: 1,
  generated: new Date().toISOString(),
  style: 'docs/visual-style-bible.md',
  count: entries.length,
  assets: entries,
};

writeFileSync(resolve(sourceDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(resolve(publicAssets, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Copy benchmarks into public for slice
mkdirSync(resolve(publicAssets, 'benchmarks'), { recursive: true });
for (const e of entries.filter((x) => x.category === 'benchmark')) {
  const from = resolve(approved, e.file);
  const to = resolve(publicAssets, e.file);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, readFileSync(from));
}

console.log(`Wrote ${entries.length} placeholder assets + manifest`);
