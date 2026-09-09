import { fitCanvas, cssPoint } from '../render/canvas.js';
import { reducedMotion } from '../util.js';
import { blOf } from '../rules/economy.js';
import { remainingMs } from '../rules/builds.js';

const PLOTS = [
  { id: 'townhall', x: 3, y: 3, label: 'Town Hall' },
  { id: 'farm', x: 1, y: 4, label: 'Farm' },
  { id: 'lumber', x: 5, y: 4, label: 'Lumber' },
  { id: 'quarry', x: 2, y: 5, label: 'Quarry' },
  { id: 'mine', x: 4, y: 5, label: 'Mine' },
  { id: 'barracks', x: 1, y: 2, label: 'Barracks' },
  { id: 'workshop', x: 5, y: 2, label: 'Workshop' },
  { id: 'hall', x: 3, y: 1, label: 'Hero Hall' },
  { id: 'armory', x: 2, y: 2, label: 'Armory' },
  { id: 'walls', x: 3, y: 6, label: 'Walls' },
];

export function initRealmScene(canvas, api) {
  let raf = 0;
  let last = performance.now();
  let running = true;
  const TILE = 7;

  function project(gx, gy, originX, originY, tw, th) {
    return {
      x: originX + (gx - gy) * tw / 2,
      y: originY + (gx + gy) * th / 2,
    };
  }

  function resize() {
    const host = canvas.parentElement;
    return fitCanvas(canvas, host.clientWidth || 375, host.clientHeight || 600);
  }

  function draw(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const { ctx, cssW: w, cssH: h } = resize();
    const state = api.getState();
    const tw = Math.min(w, h) / 8.2;
    const th = tw / 2;
    const originX = w / 2;
    const originY = h * 0.16;

    // Ground
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#243044');
    g.addColorStop(1, '#141820');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Isometric tiles
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const p = project(x, y, originX, originY, tw, th);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + tw / 2, p.y + th / 2);
        ctx.lineTo(p.x, p.y + th);
        ctx.lineTo(p.x - tw / 2, p.y + th / 2);
        ctx.closePath();
        ctx.fillStyle = ((x + y) % 2) ? '#2a3340' : '#263041';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.stroke();
      }
    }

    // Buildings
    const sorted = [...PLOTS].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const plot of sorted) {
      const lvl = blOf(state.bld, plot.id);
      const p = project(plot.x, plot.y, originX, originY, tw, th);
      const bh = 18 + lvl * 10;
      ctx.fillStyle = lvl > 0 ? '#3a4558' : 'rgba(90,100,120,0.25)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - bh);
      ctx.lineTo(p.x + tw * 0.28, p.y - bh + th * 0.35);
      ctx.lineTo(p.x + tw * 0.28, p.y + th * 0.2);
      ctx.lineTo(p.x, p.y + th * 0.45);
      ctx.lineTo(p.x - tw * 0.28, p.y + th * 0.2);
      ctx.lineTo(p.x - tw * 0.28, p.y - bh + th * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = lvl > 0 ? '#c9a227' : '#6e788a';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - bh - 8);
      ctx.lineTo(p.x + tw * 0.28, p.y - bh + th * 0.2);
      ctx.lineTo(p.x, p.y - bh + th * 0.45);
      ctx.lineTo(p.x - tw * 0.28, p.y - bh + th * 0.2);
      ctx.closePath();
      ctx.fill();

      if (lvl === 0) {
        ctx.fillStyle = '#9aa3b2';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(plot.label, p.x, p.y + 8);
      }

      const job = (state.builds || []).find((b) => b.buildingId === plot.id);
      if (job) {
        const rem = remainingMs(job, now);
        ctx.strokeStyle = '#c9a227';
        ctx.strokeRect(p.x - 12, p.y - bh - 18, 24, 4);
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(p.x - 12, p.y - bh - 18, 24 * (1 - rem / job.durationMs), 4);
      }
    }

    // Villagers
    if (!reducedMotion()) {
      for (let i = 0; i < 2 + blOf(state.bld, 'townhall'); i++) {
        const t = now / 1000 + i;
        const gx = 2 + Math.sin(t * 0.4 + i) * 1.5 + 1.5;
        const gy = 3 + Math.cos(t * 0.35 + i * 1.3) * 1.2 + 1;
        const p = project(gx, gy, originX, originY, tw, th);
        ctx.fillStyle = '#d4c4a0';
        ctx.beginPath();
        ctx.arc(p.x, p.y - 6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a4634';
        ctx.fillRect(p.x - 2, p.y - 3, 4, 6);
      }
    }

    // Weather wash
    if (state.weather === 'rain' || state.weather === 'storm') {
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

    raf = requestAnimationFrame(draw);
  }

  function onClick(e) {
    const { x, y } = cssPoint(canvas, e.clientX, e.clientY);
    const host = canvas.parentElement;
    const w = host.clientWidth || 375;
    const h = host.clientHeight || 600;
    const tw = Math.min(w, h) / 8.2;
    const th = tw / 2;
    const originX = w / 2;
    const originY = h * 0.16;
    // Inverse iso approx
    const rx = x - originX;
    const ry = y - originY;
    let gx = Math.round((rx / (tw / 2) + ry / (th / 2)) / 2);
    let gy = Math.round((ry / (th / 2) - rx / (tw / 2)) / 2);
    let plot = PLOTS.find((p) => p.x === gx && p.y === gy);
    if (!plot) plot = PLOTS.find((p) => p.x === gx && p.y === gy + 1) || PLOTS.find((p) => p.x === gx + 1 && p.y === gy);
    if (plot) api.onPlot(plot.id);
  }

  canvas.addEventListener('click', onClick);
  raf = requestAnimationFrame(draw);

  return {
    pause() { running = false; cancelAnimationFrame(raf); },
    resume() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(draw); } },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('click', onClick);
    },
  };
}

export { PLOTS };
