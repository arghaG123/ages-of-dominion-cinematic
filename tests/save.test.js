import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { createMemoryStorage, loadSlot, saveSlot, migrateSave, exportBackup, importBackup } from '../src/save/index.js';
import { newGame, SCHEMA_VERSION } from '../src/state/factory.js';
import { fnv1a } from '../src/util.js';

describe('save system', () => {
  it('roundtrips through memory storage', async () => {
    const storage = createMemoryStorage();
    const state = newGame('Kael', 'banner', 'knight');
    await saveSlot(storage, 'auto', state);
    const loaded = await loadSlot(storage, 'auto');
    expect(loaded.status).toBe('ok');
    expect(loaded.state.hero.name).toBe('Kael');
    expect(loaded.state.v).toBe(SCHEMA_VERSION);
  });

  it('reports damaged instead of inventing a new game', async () => {
    const storage = createMemoryStorage();
    await storage.set('aod.slot.auto', '{broken');
    await storage.set('aod.slot.auto.bak', '{also-broken');
    const loaded = await loadSlot(storage, 'auto');
    expect(loaded.status).toBe('damaged');
    expect(loaded.state).toBeUndefined();
  });

  it('recovers from bak', async () => {
    const storage = createMemoryStorage();
    const state = newGame('Kael', 'banner', 'ranger');
    await saveSlot(storage, 'auto', state);
    await storage.set('aod.slot.auto', '{broken');
    const loaded = await loadSlot(storage, 'auto');
    expect(loaded.status).toBe('recovered');
    expect(loaded.state.hero.cls).toBe('ranger');
  });

  it('migrates healthy v6 fixture to v7', () => {
    const raw = JSON.parse(readFileSync(resolve('reference/save-fixtures/healthy-v6.json'), 'utf8'));
    const migrated = migrateSave(raw);
    expect(migrated.v).toBe(7);
    expect(migrated.uiPrefs).toBeTruthy();
    expect(migrated.hero.name).toBe('Kael');
    expect(migrated.army.length).toBe(2);
  });

  it('refuses newer version', async () => {
    const storage = createMemoryStorage();
    const newer = readFileSync(resolve('reference/save-fixtures/newer-version.json'), 'utf8');
    await storage.set('aod.slot.auto', newer);
    const loaded = await loadSlot(storage, 'auto');
    expect(loaded.status).toBe('newer-version');
    expect(loaded.version).toBe(99);
  });

  it('backup checksum roundtrip', () => {
    const state = newGame('Kael', 'banner', 'warlock');
    const doc = exportBackup(state);
    const imported = importBackup(doc);
    expect(imported.hero.cls).toBe('warlock');
  });

  it('imports legacy v6 backup envelope (state + schemaVersion)', () => {
    const raw = JSON.parse(readFileSync(resolve('reference/save-fixtures/healthy-v6.json'), 'utf8'));
    const envelope = JSON.stringify({
      format: 'ages-of-dominion-save',
      formatVersion: 1,
      schemaVersion: 6,
      exportedAt: 1700000000000,
      checksum: fnv1a(JSON.stringify(raw)),
      state: raw,
    });
    const imported = importBackup(envelope);
    expect(imported.hero.name).toBe('Kael');
    expect(imported.v).toBe(SCHEMA_VERSION);
  });

  it('imports a bare v6 save object', () => {
    const raw = readFileSync(resolve('reference/save-fixtures/healthy-v6.json'), 'utf8');
    const imported = importBackup(raw);
    expect(imported.hero.cls).toBe('ranger');
  });

  it('classifies a malformed {v:6} slot as damaged, not ok', async () => {
    const storage = createMemoryStorage();
    await storage.set('aod.slot.auto', JSON.stringify({ v: 6 }));
    const loaded = await loadSlot(storage, 'auto');
    expect(loaded.status).toBe('damaged');
    expect(loaded.state).toBeUndefined();
  });
});
