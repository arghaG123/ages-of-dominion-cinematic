import { fitCanvas } from '../render/canvas.js';
import { reducedMotion } from '../util.js';

export function initTitleScene(canvas) {
  let raf = 0;
  let t0 = performance.now();
  let pointer = { x: 0.5, y: 0.5 };

  function resize() {
    const w = canvas.parentElement?.clientWidth || window.innerWidth || 375;
    const h = canvas.parentElement?.clientHeight || window.innerHeight || 812;
    return fitCanvas(canvas, w, h);
  }

  function draw(now) {
    const { ctx, cssW: w, cssH: h } = resize();
    const t = (now - t0) / 1000;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a2230');
    g.addColorStop(0.45, '#12151b');
    g.addColorStop(1, '#0b0d12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const parallax = reducedMotion() ? 0 : (pointer.x - 0.5) * 18;
    // Far ridges
    ctx.fillStyle = '#1c2433';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    for (let x = 0; x <= w; x += 24) {
      const y = h * 0.55 + Math.sin(x * 0.01 + t * 0.2) * 10 + parallax * 0.2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();

    // Ember particles
    if (!reducedMotion()) {
      for (let i = 0; i < 28; i++) {
        const px = ((i * 97 + t * (8 + i % 5)) % w);
        const py = h * 0.4 + ((i * 53 + t * 12) % (h * 0.5));
        ctx.fillStyle = `rgba(201,162,39,${0.15 + (i % 5) * 0.05})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.2 + (i % 3) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Gold brand glow band
    ctx.fillStyle = 'rgba(201,162,39,0.08)';
    ctx.fillRect(0, h * 0.72, w, h * 0.2);

    raf = requestAnimationFrame(draw);
  }

  function onPointer(e) {
    const r = canvas.getBoundingClientRect();
    pointer = {
      x: (e.clientX - r.left) / Math.max(1, r.width),
      y: (e.clientY - r.top) / Math.max(1, r.height),
    };
  }

  canvas.addEventListener('pointermove', onPointer);
  raf = requestAnimationFrame(draw);

  return {
    stop() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onPointer);
    },
  };
}
