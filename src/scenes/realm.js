import { fitCanvas, cssPoint, needsResize, observeCanvasHost } from '../render/canvas.js';
import { reducedMotion } from '../util.js';
import { blOf } from '../rules/economy.js';
import { remainingMs } from '../rules/builds.js';
import { AGES } from '../data/index.js';
import { ensureAtlas, drawFrame } from '../render/atlas.js';
import { PLOT_HINTS } from '../ui/beat.js';

const PLOTS = [
  { id: 'townhall', x: 3, y: 3 },
  { id: 'farm', x: 1, y: 4 },
  { id: 'lumber', x: 5, y: 4 },
  { id: 'quarry', x: 2, y: 5 },
  { id: 'mine', x: 4, y: 5 },
  { id: 'barracks', x: 1, y: 2 },
  { id: 'workshop', x: 5, y: 2 },
  { id: 'hall', x: 3, y: 1 },
  { id: 'armory', x: 2, y: 2 },
  { id: 'walls', x: 3, y: 6 },
];

const GROUND_BY_AGE = [
  { a: '#3d5a38', b: '#456840', wash: ['#243044', '#1a2a22'] },
  { a: '#3f5e3a', b: '#487044', wash: ['#243844', '#1a2c24'] },
  { a: '#406240', b: '#4a7248', wash: ['#283848', '#1c2e28'] },
  { a: '#3e6240', b: '#486e44', wash: ['#2a3848', '#1e302a'] },
  { a: '#3c5a3c', b: '#466844', wash: ['#2c3844', '#202e2a'] },
  { a: '#3a523a', b: '#445e42', wash: ['#2e3844', '#222e2c'] },
  { a: '#3c5a42', b: '#46684a', wash: ['#303844', '#24302e'] },
];

const SMOKE_BUILDINGS = new Set(['townhall', 'lumber', 'workshop']);
const FRAME_MS = 1000 / 30;

function ageArtKey(age) {
  return (AGES[age]?.n || 'Stone Age').split(' ')[0].toLowerCase();
}

function seeded(n) {
  let s = (n >>> 0) || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function project(gx, gy, originX, originY, tw, th) {
  return {
    x: originX + (gx - gy) * tw / 2,
    y: originY + (gx + gy) * th / 2,
  };
}

function diamondPath(ctx, p, tw, th) {
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + tw / 2, p.y + th / 2);
  ctx.lineTo(p.x, p.y + th);
  ctx.lineTo(p.x - tw / 2, p.y + th / 2);
  ctx.closePath();
}

/** Roof forgiveness: tile, then gy+1, then gx+1 (original resolveTapPlot). */
export function resolveTapPlot(gx, gy, plots = PLOTS) {
  if (gx == null || gy == null) return null;
  const direct = plots.find((p) => p.x === gx && p.y === gy);
  if (direct) return direct;
  return plots.find((p) => p.x === gx && p.y === gy + 1)
    || plots.find((p) => p.x === gx + 1 && p.y === gy)
    || null;
}

function builtPlots(state) {
  return PLOTS.filter((p) => blOf(state.bld, p.id) > 0);
}

export function initRealmScene(canvas, api) {
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let running = true;
  let buildingAtlas = null;
  let propAtlas = null;
  let unitAtlas = null;
  let vfxAtlas = null;
  let stopObserve = () => {};
  const TILE = 7;
  const villagers = [];

  ensureAtlas('building').then((a) => { buildingAtlas = a; });
  ensureAtlas('prop').then((a) => { propAtlas = a; });
  ensureAtlas('unit').then((a) => { unitAtlas = a; });
  ensureAtlas('vfx').then((a) => { vfxAtlas = a; });

  function geometry(w, h) {
    const tw = Math.min(w, h) / 7.4;
    const th = tw / 2;
    const originX = w / 2;
    const originY = Math.max(th * 2, Math.min(h * 0.32, h - th * 8));
    return { tw, th, originX, originY };
  }

  let fitted = { ctx: null, cssW: 0, cssH: 0 };
  let prev = { w: 0, h: 0 };

  function resize() {
    const host = canvas.parentElement;
    const w = host.clientWidth || 375;
    const h = host.clientHeight || 600;
    if (!needsResize(prev.w, prev.h, w, h) && fitted.ctx) return fitted;
    prev = { w, h };
    fitted = fitCanvas(canvas, w, h);
    return fitted;
  }

  function paintGround(ctx, w, h, age, tw, th, originX, originY) {
    // Direct paint each frame (30 FPS). Cached OffscreenCanvas blit was brittle.
    const pal = GROUND_BY_AGE[Math.min(6, age | 0)] || GROUND_BY_AGE[0];
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, pal.wash[0]);
    wash.addColorStop(1, pal.wash[1]);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    const horizon = Math.max(24, originY - th * 2);
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#1d2a3a');
    sky.addColorStop(1, '#3b4d5c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon + 2);
    const rnd = seeded(age * 97 + 13);
    for (const r of [{ off: 28, c: '#334654', amp: 12 }, { off: 14, c: '#3a5350', amp: 18 }, { off: 2, c: '#3f5b40', amp: 24 }]) {
      ctx.fillStyle = r.c;
      ctx.beginPath();
      ctx.moveTo(-10, horizon + 40);
      for (let i = 0; i <= 8; i++) {
        const x = -10 + ((w + 20) * i) / 8;
        ctx.lineTo(x, horizon - r.off - Math.abs(Math.sin(i * 1.3 + r.off)) * r.amp - rnd() * 5);
      }
      ctx.lineTo(w + 10, horizon + 40);
      ctx.closePath();
      ctx.fill();
    }

    const land = ctx.createLinearGradient(0, horizon - 8, 0, h);
    land.addColorStop(0, pal.a);
    land.addColorStop(1, '#1a2418');
    ctx.fillStyle = land;
    ctx.fillRect(0, horizon - 8, w, h - horizon + 8);

    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const p = project(x, y, originX, originY, tw, th);
        diamondPath(ctx, p, tw, th);
        ctx.fillStyle = ((x + y) % 2) ? pal.a : pal.b;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.stroke();
      }
    }
  }

  function syncVillagers(state, now) {
    const targets = builtPlots(state);
    const want = Math.min(6, 2 + blOf(state.bld, 'townhall'));
    while (villagers.length < want && targets.length) {
      const a = targets[villagers.length % targets.length];
      const b = targets[(villagers.length + 1) % targets.length] || a;
      villagers.push({
        from: a, to: b, t: Math.random(), speed: 0.12 + Math.random() * 0.08, role: ['melee', 'ranged', 'heavy'][villagers.length % 3],
      });
    }
    while (villagers.length > want) villagers.pop();
    if (!targets.length) {
      villagers.length = 0;
      return;
    }
    for (const v of villagers) {
      if (!targets.includes(v.from)) v.from = targets[0];
      if (!targets.includes(v.to)) v.to = targets[Math.min(1, targets.length - 1)];
    }
  }

  function drawScaffold(ctx, p, tw, th, progress, now) {
    const size = tw * 0.7;
    const x = p.x - size / 2;
    const y = p.y - size * 0.75;
    if (propAtlas && (propAtlas.frameImages?.['fx-scaffold'] || propAtlas.frames?.['fx-scaffold'])) {
      ctx.globalAlpha = 0.85;
      drawFrame(ctx, propAtlas, 'fx-scaffold', x, y, size, size);
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = 'rgba(201,162,39,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - tw * 0.22, p.y - th * 1.6, tw * 0.44, th * 1.8);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(p.x - 14, p.y - th * 2.1, 28, 5);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(p.x - 14, p.y - th * 2.1, 28 * Math.max(0, Math.min(1, progress)), 5);
  }

  function drawSmoke(ctx, p, now, tw) {
    if (!vfxAtlas) return;
    const fid = 'vfx-smoke';
    if (!(vfxAtlas.frameImages?.[fid] || vfxAtlas.frames?.[fid])) return;
    const bob = Math.sin(now / 700) * 4;
    const size = tw * 0.35;
    ctx.globalAlpha = 0.55;
    drawFrame(ctx, vfxAtlas, fid, p.x - size / 2, p.y - tw * 0.95 + bob, size, size);
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt * 1000;
    if (acc < FRAME_MS) {
      raf = requestAnimationFrame(draw);
      return;
    }
    acc %= FRAME_MS;

    const { ctx, cssW: w, cssH: h } = resize();
    const state = api.getState();
    const { tw, th, originX, originY } = geometry(w, h);
    const age = state.age || 0;
    const artAge = ageArtKey(age);

    paintGround(ctx, w, h, age, tw, th, originX, originY);

    const sorted = [...PLOTS].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const plot of sorted) {
      const lvl = blOf(state.bld, plot.id);
      const p = project(plot.x, plot.y, originX, originY, tw, th);
      const frameId = `bld-${plot.id}-${artAge}`;
      const hasFrame = buildingAtlas
        && (buildingAtlas.frameImages?.[frameId] || buildingAtlas.frames?.[frameId]);
      const job = (state.builds || []).find((b) => b.buildingId === plot.id);

      if (lvl === 0 && !job) {
        // Reserved pad
        diamondPath(ctx, p, tw * 0.72, th * 0.72);
        ctx.fillStyle = 'rgba(90,100,120,0.22)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(201,162,39,0.28)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        const label = PLOT_HINTS[plot.id]?.label || plot.id;
        ctx.fillStyle = '#9aa3b2';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, p.x, p.y + th * 0.55);
      } else if (lvl > 0 && hasFrame) {
        const size = tw * 0.85;
        drawFrame(ctx, buildingAtlas, frameId, p.x - size / 2, p.y - size * 0.85, size, size);
        if (SMOKE_BUILDINGS.has(plot.id) && !reducedMotion()) drawSmoke(ctx, p, now, tw);
      } else if (lvl > 0) {
        const bh = 18 + lvl * 10;
        ctx.fillStyle = '#3a4558';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - bh);
        ctx.lineTo(p.x + tw * 0.28, p.y - bh + th * 0.35);
        ctx.lineTo(p.x + tw * 0.28, p.y + th * 0.2);
        ctx.lineTo(p.x, p.y + th * 0.45);
        ctx.lineTo(p.x - tw * 0.28, p.y + th * 0.2);
        ctx.lineTo(p.x - tw * 0.28, p.y - bh + th * 0.35);
        ctx.closePath();
        ctx.fill();
      }

      if (job) {
        const rem = remainingMs(job, now);
        const progress = 1 - rem / job.durationMs;
        drawScaffold(ctx, p, tw, th, progress, now);
      }
    }

    // Villagers walk between built plots
    if (!reducedMotion()) {
      syncVillagers(state, now);
      const ageKey = artAge;
      for (const v of villagers) {
        v.t += dt * v.speed;
        if (v.t >= 1) {
          v.t = 0;
          const built = builtPlots(state);
          v.from = v.to;
          v.to = built[Math.floor(Math.random() * built.length)] || v.from;
        }
        const gx = v.from.x + (v.to.x - v.from.x) * v.t;
        const gy = v.from.y + (v.to.y - v.from.y) * v.t;
        const p = project(gx, gy, originX, originY, tw, th);
        const fid = `unit-${v.role}-${ageKey}-idle`;
        const size = tw * 0.28;
        if (unitAtlas && (unitAtlas.frameImages?.[fid] || unitAtlas.frames?.[fid])) {
          drawFrame(ctx, unitAtlas, fid, p.x - size / 2, p.y - size * 0.9, size, size);
        } else {
          ctx.fillStyle = '#d4c4a0';
          ctx.beginPath();
          ctx.arc(p.x, p.y - 6, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#5a4634';
          ctx.fillRect(p.x - 2, p.y - 3, 4, 6);
        }
      }
    }

    // Weather
    const weather = state.weather || state.map?.weather;
    if (weather === 'rain' || weather === 'storm') {
      if (vfxAtlas && (vfxAtlas.frameImages?.['vfx-rain'] || vfxAtlas.frames?.['vfx-rain'])) {
        ctx.globalAlpha = 0.35;
        drawFrame(ctx, vfxAtlas, 'vfx-rain', 0, (now / 40) % 40, w, h);
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = 'rgba(180,200,220,0.25)';
        for (let i = 0; i < 40; i++) {
          const x = (i * 47 + (now / 8)) % w;
          const y = (i * 91 + now / 3) % h;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 2, y + 8);
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(draw);
  }

  function onClick(e) {
    const { x, y } = cssPoint(canvas, e.clientX, e.clientY);
    const host = canvas.parentElement;
    const w = host.clientWidth || 375;
    const h = host.clientHeight || 600;
    const { tw, th, originX, originY } = geometry(w, h);
    const rx = x - originX;
    const ry = y - originY;
    const gx = Math.round((rx / (tw / 2) + ry / (th / 2)) / 2);
    const gy = Math.round((ry / (th / 2) - rx / (tw / 2)) / 2);
    const plot = resolveTapPlot(gx, gy);
    if (plot) api.onPlot(plot.id);
  }

  canvas.addEventListener('click', onClick);
  stopObserve = observeCanvasHost(canvas.parentElement || canvas, () => { resize(); });
  raf = requestAnimationFrame(draw);

  return {
    pause() { running = false; cancelAnimationFrame(raf); },
    resume() {
      if (!running) {
        running = true;
        last = performance.now();
        acc = 0;
        raf = requestAnimationFrame(draw);
      }
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      stopObserve();
      canvas.removeEventListener('click', onClick);
    },
  };
}

export { PLOTS };
