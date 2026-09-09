/** Shared pure helpers. No DOM. */

let _seq = 0;
export function uid() {
  _seq += 1;
  return `id_${Date.now().toString(36)}_${_seq}`;
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

/** Escape text before inserting into HTML. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function reducedMotion() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Mulberry32 seeded PRNG. */
export function makeRng(seed) {
  let t = (seed >>> 0) || 1;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function rnd(rng, a, b) {
  const r = rng || Math.random;
  return a + Math.floor(r() * (b - a + 1));
}

export function rf(rng, a, b) {
  const r = rng || Math.random;
  return a + r() * (b - a);
}

export function pick(rng, arr) {
  const r = rng || Math.random;
  return arr[Math.floor(r() * arr.length)];
}

/** FNV-1a 32-bit checksum for backup payloads. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
