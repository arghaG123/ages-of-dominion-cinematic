import { saveSlot, SLOT_AUTO } from './slots.js';

let timer = null;
let storageRef = null;
let getState = () => null;

export function configureAutosave(storage, stateGetter) {
  storageRef = storage;
  getState = stateGetter;
}

export function requestSave() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { saveNow(); }, 800);
}

export async function saveNow() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!storageRef) return;
  const state = getState();
  if (!state) return;
  await saveSlot(storageRef, SLOT_AUTO, state);
}

export function registerLifecycle() {
  const flush = () => { saveNow(); };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
  }
  return flush;
}
