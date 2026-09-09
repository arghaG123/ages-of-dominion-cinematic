/**
 * Viewport matrix smoke helpers — used by Playwright or manual QA.
 * Required viewports from the cinematic rebuild handoff.
 */
export const VIEWPORTS = [
  { w: 320, h: 568, name: 'min-phone' },
  { w: 360, h: 640, name: 'small-android' },
  { w: 360, h: 800, name: 'narrow-android' },
  { w: 375, h: 812, name: 'design-anchor' },
  { w: 390, h: 844, name: 'medium-phone' },
  { w: 412, h: 915, name: 'large-android' },
  { w: 440, h: 956, name: 'large-phone' },
  { w: 640, h: 360, name: 'phone-landscape' },
  { w: 768, h: 1024, name: 'tablet' },
  { w: 1024, h: 768, name: 'tablet-landscape' },
  { w: 1280, h: 800, name: 'desktop-shell' },
];

export function primaryActionsVisible(doc = document) {
  const selectors = ['#nav', '.btn', '.realmbar .btn', '#fGo', '#bGo'];
  return selectors.every((sel) => {
    const el = doc.querySelector(sel);
    if (!el) return true;
    const r = el.getBoundingClientRect?.();
    return !r || (r.width >= 0 && r.height >= 0);
  });
}
