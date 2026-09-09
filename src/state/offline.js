/**
 * Offline harvest while the app was closed.
 *
 * Conceptually: resolve timed builds that finished while away first (so levels
 * that completed unlock their rates), then grant rates × elapsed seconds,
 * capped by age. This implementation resolves builds at `now`, then grants
 * the full capped window at the resulting rates — a deliberate simplification
 * documented here rather than integrating per-second rate changes mid-gap.
 */
import { rates } from '../rules/economy.js';
import { resolveBuilds } from '../rules/builds.js';

export const HONOUR_OFFLINE_PROGRESS = true;
export const OFFLINE_MIN_SECONDS = 5 * 60;

/**
 * Hours of closed time the village will bank, by age (Stone .. Modern).
 */
export const OFFLINE_CAP_HOURS_BY_AGE = [8, 7, 6, 5, 4, 3.5, 3];

export const OFFLINE_CAP_SECONDS = OFFLINE_CAP_HOURS_BY_AGE[0] * 3600;

export function offlineCapSeconds(age = 0) {
  const a = Number.isFinite(age)
    ? Math.max(0, Math.min(OFFLINE_CAP_HOURS_BY_AGE.length - 1, age | 0))
    : 0;
  return OFFLINE_CAP_HOURS_BY_AGE[a] * 3600;
}

export function formatAway(seconds) {
  const t = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Non-mutating preview of offline gains (null if too short). */
export function pendingOffline(state, now = Date.now()) {
  if (!HONOUR_OFFLINE_PROGRESS || !state?.t || !state.bld) return null;
  let dt = (now - state.t) / 1000;
  if (!Number.isFinite(dt) || dt < OFFLINE_MIN_SECONDS) return null;
  const cap = offlineCapSeconds(state.age);
  const capped = dt > cap;
  if (dt > cap) dt = cap;
  const r = rates(state.bld);
  const gained = {};
  for (const k of ['food', 'wood', 'stone', 'gold']) {
    const amt = Math.floor((r[k] || 0) * dt);
    if (amt > 0) gained[k] = amt;
  }
  if (!Object.keys(gained).length) return null;
  return { seconds: dt, capped, cap, gained };
}

/**
 * Apply offline progress to state.
 * 1. Resolve builds that finished by `now`.
 * 2. Grant rates × capped elapsed into state.res.
 * 3. Advance state.t to now.
 *
 * @returns {{seconds:number, capped:boolean, cap:number, gained:object, finishedBuilds:object[]}|null}
 */
export function calculateOfflineProgress(state, now = Date.now()) {
  if (!HONOUR_OFFLINE_PROGRESS || !state?.t || !state.bld) {
    return { state, grant: null, seconds: 0, capped: false, cap: 0, gained: {}, finishedBuilds: [] };
  }

  let dt = (now - state.t) / 1000;
  if (!Number.isFinite(dt) || dt < 0) {
    return { state, grant: null, seconds: 0, capped: false, cap: offlineCapSeconds(state.age), gained: {}, finishedBuilds: [] };
  }

  // Resolve builds first (conceptually: completions unlock rates before grant).
  const { completed: finishedBuilds } = resolveBuilds(state, now);

  if (dt < OFFLINE_MIN_SECONDS && !finishedBuilds.length) {
    state.t = now;
    return { state, grant: null, seconds: 0, capped: false, cap: offlineCapSeconds(state.age), gained: {}, finishedBuilds };
  }

  const cap = offlineCapSeconds(state.age);
  const capped = dt > cap;
  if (dt > cap) dt = cap;

  const r = rates(state.bld);
  const gained = {};
  for (const k of ['food', 'wood', 'stone', 'gold']) {
    const amt = Math.floor((r[k] || 0) * dt);
    if (amt > 0) {
      gained[k] = amt;
      state.res[k] = (state.res[k] || 0) + amt;
    }
  }

  state.t = now;

  const grant = Object.keys(gained).length ? gained : null;
  return { state, grant, seconds: dt, capped, cap, gained, finishedBuilds };
}
