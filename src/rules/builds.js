/**
 * Timed building construction. Jobs: { id, buildingId, startedAt, durationMs }.
 * Mutates state in place; also returns { state, completed } for dispatch callers.
 */
import { bcost, blOf } from './economy.js';
import { clamp, uid } from '../util.js';

export function calcBuildDuration(id, lvl, _age = 0) {
  if (id === 'quarry' && lvl === 0) return 3000;
  const c = bcost(id, lvl);
  let totalCost = 0;
  for (const k in c) totalCost += c[k] || 0;
  const ratio = Math.min(1, Math.max(0, (totalCost - 300) / 2200));
  return clamp(Math.round(3000 + ratio * 5000), 3000, 8000);
}

export const buildDurationMs = calcBuildDuration;

/**
 * Enqueue a build job (does not deduct resources — caller pays).
 * Mutates state.builds; returns the same state for chaining.
 */
export function startBuild(state, id, now = Date.now()) {
  if (!state?.bld) return state;
  const lvl = blOf(state.bld, id);
  const job = {
    id: uid(),
    buildingId: id,
    startedAt: now,
    durationMs: calcBuildDuration(id, lvl, state.age || 0),
  };
  if (!Array.isArray(state.builds)) state.builds = [];
  state.builds = [...state.builds, job];
  return state;
}

export function remainingMs(job, now = Date.now()) {
  if (!job) return 0;
  const started = job.startedAt ?? job.start ?? 0;
  const dur = job.durationMs ?? job.duration ?? 0;
  return Math.max(0, started + dur - now);
}

/**
 * Complete finished jobs. Mutates state.bld / state.builds.
 * @returns {{ state: object, completed: object[] }}
 */
export function resolveBuilds(state, now = Date.now()) {
  if (!state) return { state, completed: [] };
  if (!Array.isArray(state.builds) || !state.builds.length) {
    return { state, completed: [] };
  }
  const completed = [];
  const remaining = [];

  for (const b of state.builds) {
    const buildingId = b.buildingId ?? b.id;
    const started = b.startedAt ?? b.start ?? 0;
    const dur = b.durationMs ?? b.duration ?? 0;
    const elapsed = now - started;
    if (elapsed >= dur || elapsed < 0) {
      completed.push(b);
      if (state.bld) {
        if (!state.bld[buildingId]) state.bld[buildingId] = { l: 0 };
        state.bld[buildingId] = {
          ...state.bld[buildingId],
          l: (state.bld[buildingId].l || 0) + 1,
        };
      }
    } else {
      remaining.push(b);
    }
  }

  state.builds = remaining;
  return { state, completed };
}

export function hasBuildInProgress(state, buildingId) {
  return (state.builds || []).some((j) => (j.buildingId ?? j.id) === buildingId);
}
