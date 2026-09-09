import { fitCanvas, calcGridGeometry, needsResize, cssPoint } from '../render/canvas.js';
import { createFx, spawnFloat, spawnBurst, updateFx, drawFx } from '../render/fx.js';
import { unitStats } from '../rules/units.js';
import { calcDamage, resolveBattle, FC, FR } from '../rules/combat.js';
import { heroLuck, heroStat, skillLevel } from '../rules/hero.js';
import { drawSilhouette } from '../render/atlas.js';
import { makeRng } from '../util.js';

export function createBattleController(dom, api) {
  const canvas = dom.canvas;
  let geo = { cellSize: 0, offsetX: 0, offsetY: 0 };
  let prev = { w: 0, h: 0 };
  let F = null;
  const fx = createFx();
  let raf = 0;

  function placeRows() {
    return 1 + skillLevel(api.getState().hero, 'tactics');
  }

  function fsize() {
    const st = dom.stage;
    const w = st.clientWidth;
    const h = st.clientHeight;
    if (!w || !h) return;
    fitCanvas(canvas, w, h);
    geo = calcGridGeometry(w, h, FC, FR);
    prev = { w, h };
  }

  function scheduleSizing() {
    const go = () => { fsize(); draw(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
    else setTimeout(go, 16);
  }

  function cellAt(cssX, cssY) {
    const c = Math.floor((cssX - geo.offsetX) / geo.cellSize);
    const r = Math.floor((cssY - geo.offsetY) / geo.cellSize);
    if (c < 0 || r < 0 || c >= FC || r >= FR) return null;
    return { c, r };
  }

  function start(foes, opts = {}) {
    const S = api.getState();
    F = {
      phase: 'place',
      units: [],
      roster: S.army.map((a, i) => ({ i, used: false, stack: a })),
      sel: 0,
      placeRows: placeRows(),
      foes,
      boss: !!opts.boss,
      seed: (S.profile.battles || 1) * 31337 + S.age * 1013,
      order: [],
      turn: 0,
    };
    dom.root.hidden = false;
    dom.root.classList.add('on');
    fsize();
    renderChrome();
    scheduleSizing();
    loop();
  }

  function end() {
    cancelAnimationFrame(raf);
    dom.root.hidden = true;
    dom.root.classList.remove('on');
    F = null;
  }

  function renderChrome() {
    if (!F) return;
    const placed = F.units.filter((u) => u.side === 'p').length;
    dom.go.disabled = F.phase === 'place' && placed < 1;
    dom.hint.textContent = F.phase === 'place'
      ? 'Deploy in the gold band. Place all available.'
      : 'Tap foe to strike. Use actions below.';
    dom.roster.innerHTML = F.roster.map((r, i) => {
      const st = unitStats(r.stack);
      return `<button type="button" class="rc ${r.used ? 'used' : ''} ${F.sel === i ? 'sel' : ''}" data-r="${i}">${st?.n || r.stack.type}<br>×${r.stack.count}</button>`;
    }).join('');
    dom.actions.innerHTML = F.phase === 'place'
      ? `<button type="button" class="btn" id="fPlaceAll" ${F.roster.every((r) => r.used) || !F.roster.length ? 'disabled' : ''}>Place all</button>`
      : `<button type="button" class="btn" data-act="wait">Wait</button><button type="button" class="btn" data-act="defend">Defend</button>`;
  }

  function deployAll() {
    const rows = F.placeRows;
    let col = 0;
    let row = FR - rows;
    for (let i = 0; i < F.roster.length; i++) {
      const r = F.roster[i];
      if (r.used) continue;
      while (row < FR && F.units.some((u) => u.x === col && u.y === row)) {
        col += 1;
        if (col >= FC) { col = 0; row += 1; }
      }
      if (row >= FR) break;
      placeAt(i, col, row);
      col += 1;
      if (col >= FC) { col = 0; row += 1; }
    }
    renderChrome();
    draw();
  }

  function placeAt(rosterIndex, c, r) {
    const entry = F.roster[rosterIndex];
    if (!entry || entry.used) return;
    if (r < FR - F.placeRows) {
      api.toast('Deploy in your own rows at the bottom');
      return;
    }
    if (F.units.some((u) => u.x === c && u.y === r)) return;
    const st = unitStats(entry.stack);
    F.units.push({
      ...st,
      id: entry.stack.id,
      side: 'p',
      count: entry.stack.count,
      uhp: st.hp,
      top: st.hp,
      x: c,
      y: r,
      ridx: rosterIndex,
      ref: entry.i,
      dead: false,
      shotsLeft: st.shots || 0,
    });
    entry.used = true;
    const next = F.roster.findIndex((x, idx) => idx > rosterIndex && !x.used);
    F.sel = next >= 0 ? next : (F.roster.findIndex((x) => !x.used));
    if (F.sel < 0) F.sel = null;
  }

  function beginFight() {
    const S = api.getState();
    // Spawn enemies top
    F.foes.forEach((stack, i) => {
      const st = unitStats(stack);
      F.units.push({
        ...st,
        id: stack.id || `e${i}`,
        side: 'e',
        count: stack.count,
        uhp: st.hp,
        top: st.hp,
        x: i % FC,
        y: Math.floor(i / FC),
        dead: false,
        boss: !!F.boss,
        shotsLeft: st.shots || 0,
      });
    });
    F.phase = 'fight';
    F.order = F.units.filter((u) => !u.dead).sort((a, b) => b.spd - a.spd);
    F.turn = 0;
    renderChrome();
    draw();
  }

  function currentUnit() {
    return F.order[F.turn % F.order.length];
  }

  function advanceTurn() {
    F.order = F.units.filter((u) => !u.dead && u.count > 0).sort((a, b) => b.spd - a.spd);
    if (!F.order.some((u) => u.side === 'p')) return finish('e');
    if (!F.order.some((u) => u.side === 'e')) return finish('p');
    F.turn += 1;
    let guard = 0;
    while (guard++ < 20) {
      const u = currentUnit();
      if (!u || u.dead) { F.turn += 1; continue; }
      if (u.side === 'e') {
        enemyAct(u);
        continue;
      }
      break;
    }
    renderChrome();
    draw();
  }

  function enemyAct(u) {
    const foes = F.units.filter((t) => !t.dead && t.side === 'p');
    if (!foes.length) return finish('e');
    const target = foes.sort((a, b) => a.count * a.uhp - b.count * b.uhp)[0];
    strike(u, target);
    F.turn += 1;
  }

  function strike(attacker, defender) {
    const S = api.getState();
    const ranged = (attacker.rng || 0) > 0 && (attacker.shotsLeft || 0) > 0;
    if (ranged) attacker.shotsLeft -= 1;
    const hero = {
      atk: heroStat(S.hero, 'atk'),
      def: heroStat(S.hero, 'def'),
      luck: heroLuck(S.hero),
      skills: S.hero.skills,
    };
    const { dmg, lucky } = calcDamage(attacker, defender, {
      ranged,
      hero: attacker.side === 'p' ? hero : null,
      adjacentEnemy: false,
      boss: !!attacker.boss,
      rng: Math.random,
    });
    const pool = (defender.count - 1) * defender.uhp + defender.top - dmg;
    const cx = geo.offsetX + (defender.x + 0.5) * geo.cellSize;
    const cy = geo.offsetY + (defender.y + 0.5) * geo.cellSize;
    spawnFloat(fx, cx, cy, String(dmg), lucky ? '#f0a92e' : '#e8e4d9');
    spawnBurst(fx, cx, cy, 'hit');
    if (pool <= 0) {
      defender.count = 0;
      defender.dead = true;
      spawnFloat(fx, cx, cy - 14, 'Fallen', '#c45c4a');
      if (attacker.side === 'p') api.haptic?.('kill');
    } else {
      const nc = Math.ceil(pool / defender.uhp);
      defender.count = nc;
      defender.top = pool - (nc - 1) * defender.uhp;
    }
  }

  function finish(winner) {
    const result = { winner, seed: F.seed };
    const armyAfter = api.getState().army.map((s) => {
      const u = F.units.find((x) => x.side === 'p' && x.id === s.id);
      return u ? { ...s, count: Math.max(0, u.count) } : s;
    }).filter((s) => s.count > 0);
    api.onBattleEnd(result, armyAfter);
    end();
  }

  function autoResolve() {
    const S = api.getState();
    const player = F.roster.filter((r) => r.used || F.phase === 'place').map((r) => {
      const st = unitStats(r.stack);
      return { ...r.stack, ...st };
    });
    // If still placing, auto-deploy conceptually for resolve
    const pStacks = (player.length ? player : S.army.map((s) => ({ ...s, ...unitStats(s) })));
    const eStacks = F.foes.map((s) => ({ ...s, ...unitStats(s) }));
    const result = resolveBattle({
      seed: F.seed,
      player: pStacks,
      enemy: eStacks,
      hero: {
        atk: heroStat(S.hero, 'atk'),
        def: heroStat(S.hero, 'def'),
        luck: heroLuck(S.hero),
        skills: S.hero.skills,
      },
    });
    api.onBattleEnd(result, result.player.filter((p) => p.count > 0).map((p) => {
      const orig = S.army.find((a) => a.id === p.id);
      return orig ? { ...orig, count: p.count } : null;
    }).filter(Boolean));
    end();
  }

  function draw() {
    if (!F) return;
    const st = dom.stage;
    if (needsResize(prev.w, prev.h, st.clientWidth, st.clientHeight)) fsize();
    const ctx = canvas.getContext('2d');
    const w = prev.w, h = prev.h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a2230';
    ctx.fillRect(0, 0, w, h);

    for (let r = 0; r < FR; r++) {
      for (let c = 0; c < FC; c++) {
        const x = geo.offsetX + c * geo.cellSize;
        const y = geo.offsetY + r * geo.cellSize;
        const deploy = F.phase === 'place' && r >= FR - F.placeRows;
        ctx.fillStyle = deploy ? 'rgba(201,162,39,0.18)' : (((c + r) % 2) ? '#243044' : '#1e2838');
        ctx.fillRect(x, y, geo.cellSize - 1, geo.cellSize - 1);
      }
    }

    for (const u of F.units) {
      if (u.dead) continue;
      const x = geo.offsetX + u.x * geo.cellSize;
      const y = geo.offsetY + u.y * geo.cellSize;
      const s = geo.cellSize * 0.82;
      const ox = x + (geo.cellSize - s) / 2;
      const oy = y + (geo.cellSize - s) / 2;
      ctx.save();
      if (u.face < 0) {
        ctx.translate(ox + s, oy);
        ctx.scale(-1, 1);
        drawSilhouette(ctx, 0, 0, s, s, u.n || u.type);
      } else {
        drawSilhouette(ctx, ox, oy, s, s, u.n || u.type);
      }
      ctx.restore();
      ctx.fillStyle = u.side === 'p' ? '#c9a227' : '#c45c4a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`×${u.count}`, x + geo.cellSize / 2, y + geo.cellSize - 4);
    }
    drawFx(ctx, fx);
  }

  function loop(now) {
    if (!F) return;
    updateFx(fx, 1 / 60);
    draw();
    raf = requestAnimationFrame(loop);
  }

  canvas.addEventListener('click', (e) => {
    if (!F) return;
    const pt = cssPoint(canvas, e.clientX, e.clientY);
    const cell = cellAt(pt.x, pt.y);
    if (!cell) return;
    if (F.phase === 'place') {
      if (F.sel == null) {
        api.toast('Pick a stack from the tray below first.');
        return;
      }
      const on = F.units.find((u) => u.x === cell.c && u.y === cell.r && u.side === 'p');
      if (on) {
        F.roster[on.ridx].used = false;
        F.units = F.units.filter((u) => u !== on);
        F.sel = on.ridx;
        renderChrome();
        draw();
        return;
      }
      placeAt(F.sel, cell.c, cell.r);
      renderChrome();
      draw();
      return;
    }
    const u = currentUnit();
    if (!u || u.side !== 'p') return;
    const target = F.units.find((t) => !t.dead && t.x === cell.c && t.y === cell.r && t.side === 'e');
    if (!target) return;
    // damage preview
    const S = api.getState();
    const preview = calcDamage(u, target, {
      ranged: (u.rng || 0) > 0 && u.shotsLeft > 0,
      hero: { atk: heroStat(S.hero, 'atk'), def: heroStat(S.hero, 'def'), luck: heroLuck(S.hero), skills: S.hero.skills },
      rng: () => 0.5,
    });
    dom.hint.textContent = `Expected ~${preview.dmg} damage`;
    strike(u, target);
    advanceTurn();
  });

  dom.roster.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-r]');
    if (!btn || !F || F.phase !== 'place') return;
    const i = Number(btn.dataset.r);
    if (F.roster[i]?.used) return;
    F.sel = i;
    renderChrome();
  });

  dom.actions.addEventListener('click', (e) => {
    if (e.target.id === 'fPlaceAll') deployAll();
    const act = e.target.dataset?.act;
    if (!F || F.phase !== 'fight') return;
    const u = currentUnit();
    if (!u || u.side !== 'p') return;
    if (act === 'defend') { u.defending = true; advanceTurn(); }
    if (act === 'wait') advanceTurn();
  });

  dom.go.addEventListener('click', () => {
    if (!F) return;
    if (F.phase === 'place') beginFight();
  });

  dom.resolve.addEventListener('click', () => autoResolve());
  dom.quit.addEventListener('click', () => {
    if (confirm('Quit battle?')) end();
  });

  return { start, end, active: () => !!F };
}
