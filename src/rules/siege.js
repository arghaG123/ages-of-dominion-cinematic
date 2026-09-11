/**
 * Pure siege helpers — path, waves, simplified resolve (no canvas / DOM).
 * ETYPES multipliers match ages-of-dominion/src/siege/index.js.
 */
import { makeRng, rnd } from '../util.js';
import { coreHP } from './economy.js';
import { TOWERS } from '../data/index.js';

export { coreHP };

export const COLS = 9;
export const ROWS = 15;
export const FIXED_DT = 1 / 60;

export const ETYPES = {
  brute:  { ic: '👹', n: 'Brute',      hp: 1.25, spd: 0.85, dmg: 1.2,  rng: 0,   w: 3 },
  runner: { ic: '🐗', n: 'Runner',     hp: 0.6,  spd: 1.6,  dmg: 0.7,  rng: 0,   w: 2 },
  archer: { ic: '🏹', n: 'Skirmisher', hp: 0.75, spd: 0.9,  dmg: 0.9,  rng: 2.6, rate: 1.3, w: 3 },
  sapper: { ic: '🧨', n: 'Sapper',     hp: 0.9,  spd: 0.95, dmg: 2.2,  rng: 1.8, rate: 1.6, w: 2, antiTower: true },
  shaman: { ic: '🔮', n: 'Shaman',     hp: 0.8,  spd: 0.9,  dmg: 1.1,  rng: 3.2, rate: 2,   w: 1 },
};

/**
 * Zig-zag road from top to bottom (seeded).
 * @param {number} [cols=COLS]
 * @param {number} [rows=ROWS]
 * @param {number} [seed]
 */
export function genPath(cols = COLS, rows = ROWS, seed = 1) {
  const rng = makeRng(seed);
  const path = [];
  let x = Math.floor(cols / 2);
  for (let y = 0; y < rows; y++) {
    path.push({ x, y });
    if (y < rows - 1) {
      const dir = rng() < 0.5 ? -1 : 1;
      if (rng() < 0.55) x = Math.max(1, Math.min(cols - 2, x + dir));
    }
  }
  return path;
}

export function pathCells(wp) {
  const set = new Set();
  for (let i = 0; i < wp.length - 1; i++) {
    const a = wp[i];
    const b = wp[i + 1];
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    for (let s = 0; s <= steps; s++) {
      const cxx = Math.round(a.x + ((b.x - a.x) * s) / (steps || 1));
      const cyy = Math.round(a.y + ((b.y - a.y) * s) / (steps || 1));
      if (cyy >= 0) set.add(`${cxx},${cyy}`);
    }
  }
  return set;
}

export function pathLength(wp) {
  return pathCells(wp).size;
}

export function genWaves(cfg, age = 0, rng = Math.random) {
  const n = cfg.waves || 5;
  const diff = cfg.diff || 1;
  const base = 1 + age * 0.5;
  const w = [];
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const counts = {
      brute: 3 + Math.floor(i * 0.8),
      runner: 2 + Math.floor(i * 0.6),
      archer: 1 + Math.floor(i * 0.8),
      sapper: i >= 2 ? 1 + Math.floor(i * 0.4) : 0,
      shaman: i >= 4 ? 1 + Math.floor(i * 0.3) : 0,
    };
    let mix = [];
    for (const k in counts) {
      for (let j = 0; j < counts[k]; j++) mix.push(k);
    }
    mix = mix.slice().sort(() => rng() - 0.5);
    w.push({
      mix,
      hp: Math.round(26 * base * diff * (1 + i * 0.3)),
      dmg: 7 * base * diff * (1 + i * 0.15),
      spd: 0.85 + i * 0.03,
      gap: Math.max(0.35, 1 - i * 0.05),
      boss: last && !!cfg.boss,
    });
  }
  return w;
}

export function wavePreview(w) {
  if (!w?.mix) return '';
  const counts = {};
  w.mix.forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
  const parts = Object.keys(counts).map((k) => `${counts[k]} ${k}`);
  if (w.boss) parts.push('Boss');
  return `Incoming: ${parts.join(', ')}`;
}

/** Finite mix for live siege wave `wave` (1-based). */
export function liveWaveRoster(wave, age = 0, rng = Math.random) {
  const n = Math.max(1, wave | 0);
  const waves = genWaves({ waves: n }, age, rng);
  return waves[n - 1] || waves[waves.length - 1];
}

/** True when this wave's roster is spent and every spawned enemy is dead. */
export function waveIsClear(queue, enemies, spawned) {
  return spawned > 0 && !(queue && queue.length) && (enemies || []).every((e) => e.dead);
}

export function towerDef(fam) {
  return TOWERS[fam] || null;
}

/**
 * Simplified siege simulation for tests / auto-resolve.
 */
export function resolveSiege({
  bld = {},
  age = 0,
  cfg,
  waves: waveCount,
  towers = [],
  seed = 1,
  callNextBonus = 0,
} = {}) {
  const waveCfg = cfg || { waves: waveCount || 5, diff: 1, boss: false };
  const path = genPath(COLS, ROWS, seed);
  const waves = genWaves(waveCfg, age, makeRng(seed + 7));
  const coreMax = coreHP(bld, age) * (waveCfg.endless ? 1.4 : 1);
  let core = coreMax;
  let wavesCleared = 0;
  let gold = callNextBonus;
  const towerCount = Array.isArray(towers) ? towers.length : (towers || 0);
  const mitigation = 1 / (1 + towerCount * 0.35);

  for (const wave of waves) {
    let waveDmg = 0;
    for (const k of wave.mix) {
      const E = ETYPES[k];
      if (!E) continue;
      waveDmg += wave.dmg * E.dmg * E.hp;
    }
    if (wave.boss) waveDmg *= 1.5;
    const pathFactor = 12 / Math.max(8, pathLength(path));
    core -= waveDmg * mitigation * pathFactor * 0.08;
    if (core <= 0) {
      return {
        win: false,
        won: false,
        coreLeft: 0,
        core: 0,
        coreMax,
        wavesCleared,
        waves: wavesCleared + 1,
        gold,
        path,
        pathLen: path.length,
      };
    }
    wavesCleared++;
    gold += 15 + wavesCleared * 5;
  }

  return {
    win: true,
    won: true,
    coreLeft: Math.max(0, Math.round(core)),
    core: Math.max(0, Math.round(core)),
    coreMax,
    wavesCleared,
    waves: wavesCleared,
    gold,
    path,
    pathLen: path.length,
  };
}
