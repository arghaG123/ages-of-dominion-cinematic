/**
 * Export immutable reference fixtures from the prior Ages of Dominion build.
 * READ-ONLY against C:/dev/ages-of-dominion.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const refRoot = resolve(root, '../ages-of-dominion');
const outDir = resolve(root, 'reference');
const tablesDir = resolve(outDir, 'tables');
const fixturesDir = resolve(outDir, 'save-fixtures');
mkdirSync(tablesDir, { recursive: true });
mkdirSync(fixturesDir, { recursive: true });

function toJsonSafe(value) {
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'function') out[`_fn_${k}`] = v.toString();
      else out[k] = toJsonSafe(v);
    }
    return out;
  }
  return value;
}

const dataUrl = pathToFileURL(resolve(refRoot, 'src/data/index.js')).href;
const DATA = await import(dataUrl);

const tables = {};
for (const [name, table] of Object.entries(DATA)) {
  if (name === 'default') continue;
  const safe = toJsonSafe(table);
  tables[name] = safe;
  writeFileSync(resolve(tablesDir, `${name}.json`), JSON.stringify(safe, null, 2) + '\n');
}

writeFileSync(resolve(outDir, 'game-data.json'), JSON.stringify({
  game: 'Ages of Dominion',
  exportedFrom: 'C:/dev/ages-of-dominion',
  generated: new Date().toISOString(),
  tables,
}, null, 2) + '\n');

writeFileSync(resolve(outDir, 'balance-baseline.json'), JSON.stringify({
  source: 'ages-of-dominion balance-sim 7 Sep 2026',
  matrix: '50 battles per age, competent hero',
  ages: [
    { age: 0, name: 'Stone', winRate: 1, avgRounds: 1.0, avgCasualties: 0.187 },
    { age: 1, name: 'Bronze', winRate: 1, avgRounds: 2.0, avgCasualties: 0.436 },
    { age: 2, name: 'Iron', winRate: 1, avgRounds: 1.9, avgCasualties: 0.266 },
    { age: 3, name: 'Medieval', winRate: 1, avgRounds: 2.5, avgCasualties: 0.356 },
    { age: 4, name: 'Gunpowder', winRate: 1, avgRounds: 3.0, avgCasualties: 0.667 },
    { age: 5, name: 'Industrial', winRate: 1, avgRounds: 3.9, avgCasualties: 0.785 },
    { age: 6, name: 'Modern', winRate: 1, avgRounds: 5.7, avgCasualties: 0.895 },
  ],
  note: 'No src/data retune. Baseline for cinematic rebuild parity.',
}, null, 2) + '\n');

const healthy = {
  v: 6,
  profile: { name: 'Kael', banner: 'banner', created: 1700000000000, wins: 1, losses: 0, battles: 1, duels: 0 },
  age: 0,
  t: 1700000000000,
  res: { food: 250, wood: 250, stone: 160, gold: 150 },
  bld: {
    townhall: { l: 1 }, farm: { l: 1 }, lumber: { l: 1 }, quarry: { l: 0 }, mine: { l: 0 },
    barracks: { l: 1 }, workshop: { l: 1 }, hall: { l: 0 }, armory: { l: 0 }, walls: { l: 1 },
  },
  army: [
    { id: 'a1', kind: 'role', type: 'melee', age: 0, count: 12, rank: 0, xp: 0 },
    { id: 'a2', kind: 'role', type: 'ranged', age: 0, count: 8, rank: 0, xp: 0 },
  ],
  towers: [
    { id: 't1', fam: 'arrow', tier: 0, rank: 0, xp: 0 },
    { id: 't2', fam: 'slow', tier: 0, rank: 0, xp: 0 },
  ],
  hero: {
    name: 'Kael', cls: 'ranger', lvl: 1, xp: 0, pts: 0,
    atk: 2, def: 2, pow: 2, kno: 2, mana: 20, skills: {}, spells: ['haste', 'arrow'],
    equip: { weapon: null, armor: null, helm: null, boots: null, art1: null, art2: null },
    bag: [], mp: 5, mpMax: 5,
  },
  map: null,
  day: 1,
  story: { ch: 0, log: [], flags: {} },
  quests: [
    { id: 'q1', n: 'Win your first battle', need: 'wins', v: 1, done: false, rw: { gold: 120 } },
  ],
  claimedMilestones: [],
  campaign: { cleared: 0 },
  endlessBest: 0,
  builds: [],
  rival: { name: 'Varric the Ash', portrait: 'rival', defeated: false, encounters: 0, remembers: [] },
  tutorial: { step: 0, done: false },
  meta: { playtime: 120, savedAt: 1700000000000, createdAt: 1700000000000 },
};

writeFileSync(resolve(fixturesDir, 'healthy-v6.json'), JSON.stringify(healthy, null, 2) + '\n');
writeFileSync(resolve(fixturesDir, 'backup-recovered.json'), JSON.stringify({
  ...healthy,
  meta: { ...healthy.meta, note: 'recovered from bak' },
}, null, 2) + '\n');
writeFileSync(resolve(fixturesDir, 'newer-version.json'), JSON.stringify({ ...healthy, v: 99 }, null, 2) + '\n');
writeFileSync(resolve(fixturesDir, 'damaged.json'), '{broken');

console.log(`Exported ${Object.keys(tables).length} tables + save fixtures`);
