import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import * as DATA from '../src/data/index.js';

const EXPECTED = {
  AGES: 7,
  RANKS: 5,
  RANKXP: 5,
  RES: 4,
  ROLES: 3,
  CREATURES: 8,
  BUILDINGS: 10,
  TOWERS: 4,
  TERRAIN: 8,
  WEATHER: 7,
  PRIMARIES: 4,
  CLASSES: 3,
  SKILLS: 9,
  SPELLS: 8,
  SLOTS: 6,
  GEAR: 4,
  QUAL: 4,
  ARTIFACTS: 10,
  STORY: 7,
  QUEST_TEMPLATES: 6,
};

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

describe('data parity', () => {
  it('has expected table sizes', () => {
    expect(DATA.AGES.length).toBe(EXPECTED.AGES);
    expect(DATA.RANKS.length).toBe(EXPECTED.RANKS);
    expect(DATA.RANKXP.length).toBe(EXPECTED.RANKXP);
    expect(DATA.RES.length).toBe(EXPECTED.RES);
    expect(Object.keys(DATA.ROLES).length).toBe(EXPECTED.ROLES);
    expect(Object.keys(DATA.CREATURES).length).toBe(EXPECTED.CREATURES);
    expect(Object.keys(DATA.BUILDINGS).length).toBe(EXPECTED.BUILDINGS);
    expect(Object.keys(DATA.TOWERS).length).toBe(EXPECTED.TOWERS);
    expect(Object.keys(DATA.TERRAIN).length).toBe(EXPECTED.TERRAIN);
    expect(Object.keys(DATA.WEATHER).length).toBe(EXPECTED.WEATHER);
    expect(DATA.PRIMARIES.length).toBe(EXPECTED.PRIMARIES);
    expect(Object.keys(DATA.CLASSES).length).toBe(EXPECTED.CLASSES);
    expect(Object.keys(DATA.SKILLS).length).toBe(EXPECTED.SKILLS);
    expect(Object.keys(DATA.SPELLS).length).toBe(EXPECTED.SPELLS);
    expect(DATA.SLOTS.length).toBe(EXPECTED.SLOTS);
    expect(Object.keys(DATA.GEAR).length).toBe(EXPECTED.GEAR);
    expect(DATA.QUAL.length).toBe(EXPECTED.QUAL);
    expect(Object.keys(DATA.ARTIFACTS).length).toBe(EXPECTED.ARTIFACTS);
    expect(DATA.STORY.length).toBe(EXPECTED.STORY);
    expect(DATA.QUEST_TEMPLATES.length).toBe(EXPECTED.QUEST_TEMPLATES);
  });

  it('matches reference export when present', () => {
    const path = resolve('reference/game-data.json');
    if (!existsSync(path)) return;
    const ref = JSON.parse(readFileSync(path, 'utf8'));
    for (const key of Object.keys(EXPECTED)) {
      expect(toJsonSafe(DATA[key])).toEqual(ref.tables[key]);
    }
  });
});
