export { createMemoryStorage, createLocalStorage, createPreferredStorage } from './storage.js';
export {
  SLOT_AUTO, MANUAL_SLOTS, slotKey, loadSlot, saveSlot, inspectContinue, deleteSlot,
  isViableSave,
} from './slots.js';
export { migrateSave } from './migrations.js';
export { exportBackup, importBackup } from './backup.js';
export { configureAutosave, requestSave, saveNow, registerLifecycle } from './autosave.js';
