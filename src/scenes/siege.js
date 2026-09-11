import { fitCanvas, calcGridGeometry, needsResize, cssPoint, observeCanvasHost } from '../render/canvas.js';
import { COLS, ROWS, genPath, ETYPES, FIXED_DT, liveWaveRoster, waveIsClear } from '../rules/siege.js';
import { TOWERS } from '../data/index.js';
import { coreHP } from '../rules/economy.js';
import { drawSilhouette, drawFrame, ensureAtlas } from '../render/atlas.js';

const AGE_KEYS = ['stone', 'bronze', 'iron', 'medieval', 'gunpowder', 'industrial', 'modern'];

function ageKey(age) {
  return AGE_KEYS[age] || 'stone';
}

export function createSiegeController(dom, api) {
  const canvas = dom.canvas;
  let B = null;
  let geo = { cellSize: 0, offsetX: 0, offsetY: 0 };
  let prev = { w: 0, h: 0 };
  let raf = 0;
  let acc = 0;
  let last = 0;
  let towerAtlas = null;
  let enemyAtlas = null;
  let laneAtlas = null;
  let stopObserve = () => {};
  ensureAtlas('tower').then((a) => { towerAtlas = a; });
  ensureAtlas('siege-enemy').then((a) => { enemyAtlas = a; });
  ensureAtlas('siege-lane').then((a) => { laneAtlas = a; });

  function bsize() {
    const st = dom.stage;
    const w = st.clientWidth;
    const h = st.clientHeight;
    if (!w || !h) return;
    fitCanvas(canvas, w, h);
    geo = calcGridGeometry(w, h, COLS, ROWS);
    prev = { w, h };
  }

  function scheduleSizing() {
    const go = () => { bsize(); draw(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
    else setTimeout(go, 16);
  }

  function start(opts = {}) {
    const S = api.getState();
    B = {
      path: genPath(COLS, ROWS, (S.day || 1) * 17),
      towers: [],
      enemies: [],
      projectiles: [],
      core: coreHP(S.bld, S.age),
      coreMax: coreHP(S.bld, S.age),
      wave: 0,
      running: false,
      speed: 1,
      sel: null,
      roster: (S.towers || []).map((t, i) => ({ ...t, i, used: false })),
      mode: opts.mode || 'skirmish',
      nodeIndex: opts.nodeIndex,
      spawnTimer: 0,
      queue: [],
      spawned: 0,
      spawnGap: 1,
      paused: false,
    };
    dom.root.hidden = false;
    stopObserve();
    stopObserve = observeCanvasHost(dom.stage, () => { bsize(); draw(); });
    bsize();
    scheduleSizing();
    renderChrome();
    last = performance.now();
    loop(last);
  }

  function beginWave() {
    if (!B) return;
    const S = api.getState();
    const roster = liveWaveRoster(B.wave, S.age || 0, Math.random);
    B.queue = (roster.mix || []).slice();
    B.spawned = 0;
    B.spawnGap = roster.gap || 1;
    B.spawnTimer = 0.15;
    B.enemies = [];
  }

  function end() {
    stopObserve();
    stopObserve = () => {};
    cancelAnimationFrame(raf);
    dom.root.hidden = true;
    B = null;
  }

  function renderChrome() {
    if (!B) return;
    dom.info.innerHTML = `Core <div class="core-bar"><span style="width:${Math.max(0, 100 * B.core / B.coreMax)}%"></span></div> Wave ${B.wave}`;
    dom.roster.innerHTML = B.roster.map((t, i) => {
      const d = TOWERS[t.fam];
      return `<button type="button" class="rc ${t.used ? 'used' : ''} ${B.sel === i ? 'sel' : ''}" data-t="${i}">${d?.names?.[t.tier || 0] || t.fam}</button>`;
    }).join('');
    dom.speed.textContent = `${B.speed}×`;
    if (B.awaitingNext) {
      dom.hint.textContent = 'Wave clear. Call the next wave for a small gold reward (capped), or quit.';
      if (!dom.roster.querySelector('#callNext')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn gold';
        btn.id = 'callNext';
        btn.textContent = 'Call next wave';
        btn.onclick = () => {
          if (!B) return;
          const calls = B.nextCalls || 0;
          if (calls < 3) {
            B.nextCalls = calls + 1;
            api.toast?.(`+${15 + B.wave * 5} gold (call reward)`);
            // Gold applied via onSiegeEnd only at end; track pending
            B.pendingGold = (B.pendingGold || 0) + 15 + B.wave * 5;
          }
          B.awaitingNext = false;
          B.running = true;
          beginWave();
          renderChrome();
        };
        dom.roster.appendChild(btn);
      }
    } else {
      dom.hint.textContent = B.running ? 'Defend the core. Tap a tower to see range.' : 'Place towers beside the road, then Begin.';
    }
  }

  function step(dt) {
    if (!B?.running || B.paused) return;
    B.spawnTimer -= dt;
    if (B.queue.length && B.spawnTimer <= 0) {
      const kind = B.queue.shift();
      const def = ETYPES[kind];
      if (def) {
        const hp = def.hp * (1 + B.wave * 0.15);
        B.enemies.push({
          id: `e${B.spawned}-${B.wave}`,
          kind,
          hp,
          max: hp,
          spd: def.spd,
          dmg: def.dmg,
          pi: 0,
          dead: false,
        });
        B.spawned += 1;
      }
      B.spawnTimer = B.spawnGap / Math.max(0.25, B.speed);
    }

    for (const e of B.enemies) {
      if (e.dead) continue;
      e.pi += e.spd * dt * 1.8 * B.speed;
      if (e.pi >= B.path.length - 1) {
        B.core -= e.dmg;
        e.dead = true;
        if (B.core <= 0) {
          const result = { won: false, waves: B.wave, gold: B.pendingGold || 0 };
          const meta = { nodeIndex: B.nodeIndex };
          end();
          api.onSiegeEnd(result, meta);
          return;
        }
      }
    }

    for (const t of B.towers) {
      const def = TOWERS[t.fam];
      if (!def?.rate) continue;
      t.cd = (t.cd || 0) - dt * B.speed;
      if (t.cd > 0) continue;
      const target = B.enemies.find((e) => {
        if (e.dead) return false;
        const p = B.path[Math.min(B.path.length - 1, Math.floor(e.pi))];
        const dx = p.x - t.x;
        const dy = p.y - t.y;
        return Math.hypot(dx, dy) <= def.rng;
      });
      if (target) {
        t.cd = def.rate;
        B.projectiles.push({
          x: t.x, y: t.y, tx: target.id, dmg: def.dmg, splash: def.splash || 0, life: 0.25,
        });
      }
    }

    for (const p of B.projectiles) {
      p.life -= dt;
      if (p.life <= 0) {
        const target = B.enemies.find((e) => e.id === p.tx && !e.dead);
        if (target) {
          target.hp -= p.dmg;
          if (target.hp <= 0) target.dead = true;
        }
      }
    }
    B.projectiles = B.projectiles.filter((p) => p.life > 0);

    if (waveIsClear(B.queue, B.enemies, B.spawned)) {
      B.wave += 1;
      B.enemies = [];
      B.queue = [];
      B.spawned = 0;
      const winAt = B.mode === 'site' ? 3 : B.mode === 'skirmish' ? 4 : 5;
      if (B.mode === 'endless') {
        B.awaitingNext = true;
        B.running = false;
        B.callRewardCap = Math.min(3, (B.callRewardCap || 0));
        renderChrome();
        return;
      }
      if (B.wave >= winAt) {
        const result = { won: true, waves: B.wave, gold: 40 + B.wave * 10 };
        const meta = { nodeIndex: B.nodeIndex };
        end();
        api.onSiegeEnd(result, meta);
        return;
      }
      beginWave();
    }
  }

  function draw() {
    if (!B) return;
    const st = dom.stage;
    if (needsResize(prev.w, prev.h, st.clientWidth, st.clientHeight)) bsize();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, prev.w, prev.h);
    ctx.fillStyle = '#141820';
    ctx.fillRect(0, 0, prev.w, prev.h);
    if (laneAtlas) {
      drawFrame(ctx, laneAtlas, 'siege-lane-lowlands', 0, 0, prev.w, prev.h);
    }

    // Lane
    ctx.strokeStyle = '#3a2e24';
    ctx.lineWidth = Math.max(8, geo.cellSize * 0.45);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    B.path.forEach((p, i) => {
      const x = geo.offsetX + (p.x + 0.5) * geo.cellSize;
      const y = geo.offsetY + (p.y + 0.5) * geo.cellSize;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const age = api.getState()?.age || 0;
    for (const t of B.towers) {
      const x = geo.offsetX + t.x * geo.cellSize;
      const y = geo.offsetY + t.y * geo.cellSize;
      if (towerAtlas) {
        drawFrame(ctx, towerAtlas, `tower-${t.fam}-${ageKey(age)}`, x + 2, y + 2, geo.cellSize - 4, geo.cellSize - 4);
      } else {
        drawSilhouette(ctx, x + 2, y + 2, geo.cellSize - 4, geo.cellSize - 4, t.fam);
      }
      if (B.selTower === t) {
        const def = TOWERS[t.fam];
        ctx.strokeStyle = 'rgba(201,162,39,0.45)';
        ctx.beginPath();
        ctx.arc(x + geo.cellSize / 2, y + geo.cellSize / 2, (def?.rng || 2) * geo.cellSize, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const e of B.enemies) {
      if (e.dead) continue;
      const pi = Math.min(B.path.length - 1, Math.floor(e.pi));
      const p = B.path[pi];
      const x = geo.offsetX + p.x * geo.cellSize;
      const y = geo.offsetY + p.y * geo.cellSize;
      if (enemyAtlas) {
        const size = geo.cellSize * 0.72;
        drawFrame(ctx, enemyAtlas, `siege-enemy-${e.kind}`, x + geo.cellSize / 2 - size / 2, y + geo.cellSize / 2 - size / 2, size, size);
      } else {
        ctx.fillStyle = '#8a3a32';
        ctx.beginPath();
        ctx.arc(x + geo.cellSize / 2, y + geo.cellSize / 2, geo.cellSize * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const p of B.projectiles) {
      const target = B.enemies.find((e) => e.id === p.tx);
      if (!target) continue;
      const pi = Math.min(B.path.length - 1, Math.floor(target.pi));
      const tp = B.path[pi];
      const x0 = geo.offsetX + (p.x + 0.5) * geo.cellSize;
      const y0 = geo.offsetY + (p.y + 0.5) * geo.cellSize;
      const x1 = geo.offsetX + (tp.x + 0.5) * geo.cellSize;
      const y1 = geo.offsetY + (tp.y + 0.5) * geo.cellSize;
      const t = 1 - p.life / 0.25;
      ctx.strokeStyle = '#c9a227';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 20, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      ctx.stroke();
    }
  }

  function loop(now) {
    if (!B) return;
    const frame = (now - last) / 1000;
    last = now;
    if (!B.paused) {
      acc += frame;
      while (acc >= FIXED_DT) {
        step(FIXED_DT);
        acc -= FIXED_DT;
      }
    } else {
      acc = 0;
    }
    draw();
    renderChrome();
    raf = requestAnimationFrame(loop);
  }

  canvas.addEventListener('click', (e) => {
    if (!B || B.running) {
      if (!B) return;
      const pt = cssPoint(canvas, e.clientX, e.clientY);
      const c = Math.floor((pt.x - geo.offsetX) / geo.cellSize);
      const r = Math.floor((pt.y - geo.offsetY) / geo.cellSize);
      const tower = B.towers.find((t) => t.x === c && t.y === r);
      B.selTower = tower || null;
      return;
    }
    if (B.sel == null) {
      api.toast('Select a tower from the tray');
      return;
    }
    const pt = cssPoint(canvas, e.clientX, e.clientY);
    const c = Math.floor((pt.x - geo.offsetX) / geo.cellSize);
    const r = Math.floor((pt.y - geo.offsetY) / geo.cellSize);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    if (B.path.some((p) => p.x === c && p.y === r)) {
      api.toast('Cannot place on the road');
      return;
    }
    const entry = B.roster[B.sel];
    if (!entry || entry.used) return;
    B.towers.push({ fam: entry.fam, tier: entry.tier || 0, x: c, y: r, cd: 0, artFile: true });
    entry.used = true;
    B.sel = B.roster.findIndex((t) => !t.used);
    if (B.sel < 0) B.sel = null;
    renderChrome();
  });

  dom.roster.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-t]');
    if (!btn || !B) return;
    const i = Number(btn.dataset.t);
    if (B.roster[i]?.used) return;
    B.sel = i;
    renderChrome();
  });

  dom.go.addEventListener('click', () => {
    if (!B) return;
    B.running = true;
    B.wave = 1;
    beginWave();
    renderChrome();
  });

  dom.speed.addEventListener('click', () => {
    if (!B) return;
    B.speed = B.speed === 1 ? 2 : B.speed === 2 ? 4 : 1;
    renderChrome();
  });

  dom.quit.addEventListener('click', () => {
    if (confirm('Quit siege?')) end();
  });

  document.addEventListener('visibilitychange', () => {
    if (!B) return;
    if (document.visibilityState === 'hidden') {
      B.paused = true;
      acc = 0;
      last = performance.now();
    } else {
      B.paused = false;
      last = performance.now();
      acc = 0;
    }
  });

  return { start, end, active: () => !!B };
}
