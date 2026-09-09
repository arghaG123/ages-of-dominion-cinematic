import { fnv1a } from '../util.js';
import { migrateSave } from './migrations.js';
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

export function importBackup(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('backup-parse');
  }
  if (doc.format !== FORMAT) throw new Error('backup-format');
  const body = JSON.stringify(doc.payload);
  if (fnv1a(body) !== doc.checksum) throw new Error('backup-checksum');
  return migrateSave(doc.payload);
}
