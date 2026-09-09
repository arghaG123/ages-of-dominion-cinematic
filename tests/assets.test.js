import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('assets', () => {
  it('manifest exists with provenance fields', () => {
    const path = resolve('assets/source/manifest.json');
    if (!existsSync(path)) {
      expect(existsSync(path)).toBe(true);
      return;
    }
    const m = JSON.parse(readFileSync(path, 'utf8'));
    expect(m.assets.length).toBeGreaterThan(100);
    const sample = m.assets[0];
    for (const k of ['id', 'category', 'file', 'checksum', 'approvalStatus', 'generator', 'license']) {
      expect(sample[k], k).toBeTruthy();
    }
    const ids = m.assets.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('atlas index present after build', () => {
    const path = resolve('public/assets/atlases/index.json');
    if (!existsSync(path)) return;
    const idx = JSON.parse(readFileSync(path, 'utf8'));
    expect(idx.atlases.length).toBeGreaterThan(0);
    for (const a of idx.atlases) {
      expect(a.width).toBeLessThanOrEqual(2048);
      expect(a.height).toBeLessThanOrEqual(2048);
    }
  });
});
