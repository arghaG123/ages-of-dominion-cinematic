/**
 * Lightweight particle / VFX helpers. Observational only — never mutate combat results.
 */
import { reducedMotion } from '../util.js';

export function createFx() {
  return { floats: [], bursts: [], t: 0 };
}

export function spawnFloat(fx, x, y, text, color = '#e8e4d9') {
  if (reducedMotion()) {
    fx.floats.push({ x, y, text, color, life: 0.35, vy: -10 });
  } else {
    fx.floats.push({ x, y, text, color, life: 0.9, vy: -28 });
  }
}

export function spawnBurst(fx, x, y, kind = 'hit') {
  if (reducedMotion()) return;
  fx.bursts.push({ x, y, kind, life: 0.45, r: 4 });
}

export function updateFx(fx, dt) {
  fx.t += dt;
  for (const f of fx.floats) {
    f.life -= dt;
    f.y += f.vy * dt;
  }
  fx.floats = fx.floats.filter((f) => f.life > 0);
  for (const b of fx.bursts) {
    b.life -= dt;
    b.r += 40 * dt;
  }
  fx.bursts = fx.bursts.filter((b) => b.life > 0);
}

export function drawFx(ctx, fx) {
  for (const b of fx.bursts) {
    ctx.strokeStyle = b.kind === 'heal' ? 'rgba(90,154,106,0.7)' : 'rgba(201,162,39,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px sans-serif';
  for (const f of fx.floats) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
