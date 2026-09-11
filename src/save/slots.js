import { SCHEMA_VERSION } from '../state/factory.js';
import { migrateSave } from './migrations.js';

export const SLOT_AUTO = 'auto';
export const MANUAL_SLOTS = ['0', '1', '2'];
export const slotKey = (id) => `aod.slot.${id}`;
export const tmpKey = (id) => `aod.slot.${id}.tmp`;
export const bakKey = (id) => `aod.slot.${id}.bak`;

const RES_KEYS = ['food', 'wood', 'stone', 'gold'];

/** A migrated blob is only playable if the core campaign fields exist. `{v:6}` is not. */
export function isViableSave(s) {
  if (!s || typeof s !== 'object') return false;
  const hero = s.hero;
  if (!hero || typeof hero !== 'object') return false;
  if (typeof hero.cls !== 'string' || !hero.cls) return false;
  if (typeof hero.name !== 'string' || !hero.name) return false;
  const res = s.res;
  if (!res || typeof res !== 'object') return false;
  for (const k of RES_KEYS) {
    if (typeof res[k] !== 'number' || !Number.isFinite(res[k])) return false;
  }
  if (!s.bld || typeof s.bld !== 'object') return false;
  if (!Array.isArray(s.army)) return false;
  return true;
}

function parseRaw(raw) {
  if (raw == null || raw === '') return { status: 'empty' };
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { status: 'damaged', reason: 'parse' };
  }
  if (!data || typeof data !== 'object') return { status: 'damaged', reason: 'shape' };
  const ver = data.v ?? data.version ?? 0;
  if (ver > SCHEMA_VERSION) return { status: 'newer-version', version: ver };
  try {
    const state = migrateSave(data);
    if (!isViableSave(state)) return { status: 'damaged', reason: 'incomplete' };
    return { status: 'ok', state };
  } catch (e) {
    if (e?.code === 'newer-version') return { status: 'newer-version', version: e.version };
    return { status: 'damaged', reason: String(e?.message || e) };
  }
}

export async function loadSlot(storage, slotId = SLOT_AUTO) {
  const live = await storage.get(slotKey(slotId));
  const primary = parseRaw(live);
  if (primary.status === 'ok' || primary.status === 'empty' || primary.status === 'newer-version') {
    return primary;
  }
  const bak = await storage.get(bakKey(slotId));
  const recovered = parseRaw(bak);
  if (recovered.status === 'ok') {
    return { status: 'recovered', state: recovered.state, reason: primary.reason };
  }
  return { status: 'damaged', reason: primary.reason || 'unreadable' };
}

export async function saveSlot(storage, slotId, state) {
  const payload = JSON.stringify({
    ...state,
    v: SCHEMA_VERSION,
    meta: { ...(state.meta || {}), savedAt: Date.now() },
  });
  await storage.set(tmpKey(slotId), payload);
  const check = await storage.get(tmpKey(slotId));
  if (check !== payload) throw new Error('tmp-verify-failed');
  const live = await storage.get(slotKey(slotId));
  // Always keep a readable .bak (first save mirrors live → bak).
  await storage.set(bakKey(slotId), live != null ? live : payload);
  await storage.set(slotKey(slotId), payload);
  await storage.remove(tmpKey(slotId));
}

export async function inspectContinue(storage) {
  return loadSlot(storage, SLOT_AUTO);
}

export async function deleteSlot(storage, slotId) {
  await storage.remove(slotKey(slotId));
  await storage.remove(bakKey(slotId));
  await storage.remove(tmpKey(slotId));
}
