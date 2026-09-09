/** Storage backends: Preferences → localStorage → memory */

export function createMemoryStorage() {
  const map = new Map();
  return {
    kind: 'memory',
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async set(key, value) { map.set(key, String(value)); },
    async remove(key) { map.delete(key); },
  };
}

export function createLocalStorage() {
  return {
    kind: 'localStorage',
    async get(key) {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    async set(key, value) {
      localStorage.setItem(key, String(value));
    },
    async remove(key) {
      localStorage.removeItem(key);
    },
  };
}

export async function createPreferredStorage() {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    return {
      kind: 'preferences',
      async get(key) {
        const { value } = await Preferences.get({ key });
        return value ?? null;
      },
      async set(key, value) {
        await Preferences.set({ key, value: String(value) });
      },
      async remove(key) {
        await Preferences.remove({ key });
      },
    };
  } catch {
    try {
      if (typeof localStorage !== 'undefined') return createLocalStorage();
    } catch { /* fall through */ }
    return createMemoryStorage();
  }
}
