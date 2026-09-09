import { SCHEMA_VERSION, newMeta } from '../state/factory.js';
import { initRival } from '../state/rival.js';

export function migrateSave(rawSave) {
  if (!rawSave || typeof rawSave !== 'object') throw new Error('not-object');
  let s = { ...rawSave };
  let from = s.v ?? s.version ?? 0;
  if (from > SCHEMA_VERSION) {
    const err = new Error('from-newer-build');
    err.code = 'newer-version';
    err.version = from;
    throw err;
  }

  if (from < 3) {
    s.hero = s.hero || {};
    s.bld = s.bld || {};
    s.quests = s.quests || [];
    from = 3;
  }
  if (from < 4) {
    s.meta = s.meta || newMeta();
    from = 4;
  }
  if (from < 5) {
    s.tutorial = s.tutorial || { step: 0, done: true };
    from = 5;
  }
  if (from < 6) {
    s.builds = s.builds || [];
    s.rival = s.rival || initRival();
    s.claimedMilestones = s.claimedMilestones || [];
    from = 6;
  }
  if (from < 7) {
    s.uiPrefs = s.uiPrefs || { haptics: true, music: true, sfx: true };
    s.builds = Array.isArray(s.builds) ? s.builds : [];
    if (!s.rival) s.rival = initRival();
    from = 7;
  }

  s.v = SCHEMA_VERSION;
  return s;
}
