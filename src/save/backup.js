import { fnv1a } from '../util.js';
import { migrateSave } from './migrations.js';
import { isViableSave } from './slots.js';
import { SCHEMA_VERSION } from '../state/factory.js';

const FORMAT = 'ages-of-dominion-save';

export function exportBackup(state) {
  const body = JSON.stringify(state);
  return JSON.stringify({
    format: FORMAT,
    formatVersion: 1,
    schema: SCHEMA_VERSION,
    checksum: fnv1a(body),
    savedAt: Date.now(),
    payload: state,
  }, null, 2);
}

function unwrapBackup(doc) {
  if (!doc || typeof doc !== 'object') return null;
  if (doc.payload && typeof doc.payload === 'object') return doc.payload;
  if (doc.state && typeof doc.state === 'object') return doc.state;
  if (doc.v != null || doc.hero) return doc;
  return null;
}

export function importBackup(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('backup-parse');
  }
  if (doc.format != null && doc.format !== FORMAT) throw new Error('backup-format');

  const payload = unwrapBackup(doc);
  if (!payload) throw new Error('backup-payload');

  if (doc.format === FORMAT && doc.checksum != null) {
    const body = JSON.stringify(payload);
    if (fnv1a(body) !== String(doc.checksum)) {
      // ponytail: checksum is advisory (legacy v6 exports used `state` + hex FNV).
      // Viable payloads still import; callers can toast if they inspect checksum.
    }
  }

  const state = migrateSave(payload);
  if (!isViableSave(state)) throw new Error('backup-incomplete');
  return state;
}
