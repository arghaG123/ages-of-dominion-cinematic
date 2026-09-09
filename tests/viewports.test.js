import { describe, it, expect } from 'vitest';
import { VIEWPORTS } from '../src/ui/viewports.js';
import { calcGridGeometry } from '../src/render/canvas.js';

describe('viewport matrix', () => {
  it('includes the design anchor and extremes', () => {
    expect(VIEWPORTS.some((v) => v.w === 375 && v.h === 812)).toBe(true);
    expect(VIEWPORTS.some((v) => v.w === 320)).toBe(true);
    expect(VIEWPORTS.some((v) => v.w === 1280)).toBe(true);
  });

  it('fits tactical and siege grids on narrow phones', () => {
    for (const vp of VIEWPORTS.filter((v) => v.h >= v.w)) {
      const stageH = Math.floor(vp.h * 0.72);
      const fight = calcGridGeometry(vp.w, stageH, 7, 10);
      const siege = calcGridGeometry(vp.w, stageH, 9, 15);
      expect(fight.cellSize).toBeGreaterThan(0);
      expect(siege.cellSize).toBeGreaterThan(0);
      expect(fight.offsetY + 10 * fight.cellSize).toBeLessThanOrEqual(stageH + 0.01);
      expect(siege.offsetY + 15 * siege.cellSize).toBeLessThanOrEqual(stageH + 0.01);
    }
  });
});
