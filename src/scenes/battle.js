import { fitCanvas, calcGridGeometry, needsResize, cssPoint } from '../render/canvas.js';
import { createFx, spawnFloat, spawnBurst, updateFx, drawFx } from '../render/fx.js';
import { unitStats } from '../rules/units.js';
import { applyDamage, createRng, FC, FR } from '../rules/combat.js';
import { createTacticalBattle, unitAt as cellUnit } from '../rules/tactical.js';
import { heroLuck, heroStat, skillLevel, heroBonus } from '../rules/hero.js';
import { SPELLS, AGES } from '../data/index.js';
import { drawSilhouette, drawFrame, ensureAtlas } from '../render/atlas.js';

const AGE_KEYS = ['stone', 'bronze', 'iron', 'medieval', 'gunpowder', 'industrial', 'modern'];

function ageKey(age) {
  return AGE_KEYS[age] || (AGES[age]?.n || 'stone').split(' ')[0].toLowerCase();
}

function unitFrameId(u, age) {
  if (u.kind === 'creature' || u.side === 'e') {
    const t = u.type || u.stackType;
    return t ? `enemy-${t}-idle` : null;
  }
  const role = u.type || u.stackType || 'melee';
  return `unit-${role}-${ageKey(age ?? u.age ?? 0)}-idle`;
}

/**
 * Interactive battle UI.
 * Deployment → fight. Live turns and Resolve both run through createTacticalBattle.
 */
export function createBattleController(dom, api) {
  const canvas = dom.canvas;
  const orderEl = () => dom.order || (typeof document !== 'undefined' ? document.getElementById('fOrder') : null);
  let geo = { cellSize: 0, offsetX: 0, offsetY: 0 };
  let prev = { w: 0, h: 0 };
  let F = null;
  const fx = createFx();
  let raf = 0;
  let turnTimer = 0;
  let unitAtlas = null;
  let creatureAtlas = null;

  ensureAtlas('unit').then((a) => { unitAtlas = a; });
  ensureAtlas('creature').then((a) => { creatureAtlas = a; });

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

  function heroCtx(S) {
    const bon = heroBonus(S.hero);
    return {
      atk: heroStat(S.hero, 'atk'),
      def: heroStat(S.hero, 'def'),
      luck: heroLuck(S.hero),
      skills: S.hero.skills,
      shootBon: bon.shootBon || 0,
      pow: heroStat(S.hero, 'pow'),
      spdBon: bon.spdBon || 0,
    };
  }

  function unitAt(x, y) {
    return F.sim ? F.sim.unitAt(x, y) : cellUnit(F.units, x, y);
  }

  function reach(u) {
    return F.sim.reach(u);
  }

  function strikeKind(u, t) {
    return F.sim.strikeKind(u, t);
  }

  function start(foes, opts = {}) {
    const S = api.getState();
    clearTimeout(turnTimer);
    F = {
      phase: 'place',
      units: [],
      roster: S.army.map((a, i) => ({ i, used: false, stack: a })),
      sel: 0,
      placeRows: placeRows(),
      foes,
      boss: !!opts.boss,
      nodeIndex: opts.nodeIndex,
      seed: (S.profile.battles || 1) * 31337 + S.age * 1013 + (opts.nodeIndex || 0) * 17,
      rng: null,
      order: [],
      turn: 0,
      round: 1,
      hero: {
        mana: S.hero.mana,
        pow: heroStat(S.hero, 'pow'),
        castThisRound: false,
      },
      cast: null,
      aim: null,
      events: [],
      resolved: null,
      eventIdx: 0,
      sim: null,
      age: S.age,
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
    clearTimeout(turnTimer);
    const oe = orderEl();
    if (oe) oe.innerHTML = '';
    dom.root.hidden = true;
    dom.root.classList.remove('on');
    F = null;
  }

  function renderOrder() {
    const oe = orderEl();
    if (!oe || !F) return;
    const order = F.sim?.order || F.order;
    const turn = F.sim ? F.sim.turn : F.turn;
    if (F.phase !== 'fight' || !order?.length) {
      oe.innerHTML = '';
      return;
    }
    const active = order[turn];
    oe.innerHTML = order
      .filter((u) => !u.dead)
      .map((u) => {
        const now = u === active ? ' now' : '';
        const spent = order.indexOf(u) < turn ? ' spent' : '';
        return `<div class="forder-slot ${u.side}${now}${spent}" title="${u.n || u.type} ×${u.count}">${(u.n || u.type || '?').slice(0, 4)}<span class="count">${u.count}</span></div>`;
      })
      .join('');
  }

  function renderChrome() {
    if (!F) return;
    const placed = F.units.filter((u) => u.side === 'p').length;
    dom.go.disabled = F.phase === 'place' && placed < 1;

    if (F.phase === 'place') {
      dom.hint.textContent = 'Deploy in the gold band. Place all available.';
      dom.roster.innerHTML = F.roster.map((r, i) => {
        const st = unitStats(r.stack);
        return `<button type="button" class="rc ${r.used ? 'used' : ''} ${F.sel === i ? 'sel' : ''}" data-r="${i}">${st?.n || r.stack.type}<br>×${r.stack.count}</button>`;
      }).join('');
      dom.actions.innerHTML = `<button type="button" class="btn" id="fPlaceAll" ${F.roster.every((r) => r.used) || !F.roster.length ? 'disabled' : ''}>Place all</button>`;
    } else if (F.phase === 'recap') {
      dom.hint.textContent = 'Battle resolved — watching the clash.';
      dom.roster.innerHTML = '';
      dom.actions.innerHTML = `<button type="button" class="btn" id="fSkipRecap">Skip to result</button>`;
    } else {
      const u = F.sim ? F.sim.current() : F.order[F.turn];
      dom.roster.innerHTML = '';
      if (!u || u.dead) {
        dom.hint.textContent = '';
        dom.actions.innerHTML = '';
      } else if (u.side === 'p') {
        if (F.aim?.target && !F.aim.target.dead) {
          const prev = previewDmg(u, F.aim.target, F.aim.kind === 'ranged');
          dom.hint.textContent = `${F.aim.target.n || F.aim.target.type} ×${F.aim.target.count} — ~${prev.dmg} dmg${prev.lucky ? ' (lucky?)' : ''}. Tap again to strike.`;
        } else if (F.cast) {
          dom.hint.textContent = `Cast ${SPELLS[F.cast]?.n || F.cast} — pick a target.`;
        } else {
          dom.hint.textContent = `${u.n || u.type} ×${u.count} — tap empty cell to move, enemy to strike.`;
        }
        const S = api.getState();
        const spells = (S.hero.spells || [])
          .filter((k) => SPELLS[k] && SPELLS[k].mana <= F.hero.mana && SPELLS[k].lv <= 1 + skillLevel(S.hero, 'wisdom'))
          .map((k) => `<button type="button" class="btn sm" data-f="spell" data-spell="${k}">${SPELLS[k].n}</button>`)
          .join('');
        dom.actions.innerHTML = `
          <button type="button" class="btn gold" data-f="defend">Defend</button>
          <button type="button" class="btn" data-f="wait">Wait</button>
          ${spells}`;
      } else {
        dom.hint.textContent = `${u.n || u.type} is acting…`;
        dom.actions.innerHTML = '';
      }
    }
    renderOrder();
  }

  function deployAll() {
    let col = 0;
    let row = FR - F.placeRows;
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
      type: entry.stack.type,
      kind: entry.stack.kind,
      age: entry.stack.age ?? F.age,
      stackType: entry.stack.type,
      side: 'p',
      count: entry.stack.count,
      maxCount: entry.stack.count,
      uhp: st.hp,
      top: st.hp,
      x: c,
      y: r,
      ridx: rosterIndex,
      ref: entry.i,
      dead: false,
      shots: st.shots || 0,
      fly: st.fly || 0,
      dealt: 0,
      bless: 0,
      haste: 0,
      slowT: 0,
      retaliated: false,
      defending: false,
      waited: false,
    });
    entry.used = true;
    const next = F.roster.findIndex((x, idx) => idx > rosterIndex && !x.used);
    F.sel = next >= 0 ? next : F.roster.findIndex((x) => !x.used);
    if (F.sel < 0) F.sel = null;
  }

  function spawnEnemies() {
    F.foes.forEach((stack, i) => {
      const st = unitStats(stack);
      F.units.push({
        ...st,
        id: stack.id || `e${i}`,
        type: stack.type,
        kind: stack.kind || 'creature',
        stackType: stack.type,
        side: 'e',
        count: stack.count,
        maxCount: stack.count,
        uhp: st.hp,
        top: st.hp,
        x: i % FC,
        y: Math.floor(i / FC),
        dead: false,
        boss: !!F.boss,
        shots: st.shots || 0,
        fly: st.fly || 0,
        dealt: 0,
        bless: 0,
        haste: 0,
        slowT: 0,
        retaliated: false,
        defending: false,
      });
    });
  }

  function attachSim() {
    const S = api.getState();
    F.sim = createTacticalBattle({
      units: F.units,
      seed: F.seed,
      rng: F.rng,
      hero: heroCtx(S),
      boss: F.boss,
      placeRows: F.placeRows,
      round: F.round || 1,
      turn: F.turn || 0,
      order: F.order,
      events: F.events,
      onRoundStart: () => { if (F) F.hero.castThisRound = false; },
    });
    F.units = F.sim.units;
    F.rng = F.sim.rng;
    F.events = F.sim.events;
  }

  function beginFight() {
    spawnEnemies();
    F.rng = createRng(F.seed);
    F.phase = 'fight';
    F.round = 1;
    F.events = [];
    F.aim = null;
    F.cast = null;
    attachSim();
    F.sim.start();
    renderChrome();
    draw();
    const u = F.sim.current();
    if (u && u.side === 'e') turnTimer = setTimeout(aiTurn, 420);
  }

  function previewDmg(attacker, defender, ranged) {
    if (F.sim) return F.sim.previewDamage(attacker, defender, ranged);
    return { dmg: 1, lucky: false };
  }

  function playFx(evs) {
    for (const ev of evs || []) {
      const defender = unitById(ev.to);
      if (!defender) continue;
      const cx = geo.offsetX + (defender.x + 0.5) * geo.cellSize;
      const cy = geo.offsetY + (defender.y + 0.5) * geo.cellSize;
      spawnFloat(fx, cx, cy, String(ev.dmg), ev.lucky ? '#f0a92e' : '#e8e4d9');
      spawnBurst(fx, cx, cy, 'hit');
      if (ev.slain) spawnFloat(fx, cx, cy - 14, `${ev.slain} slain`, '#c45c4a');
      if (ev.dead) api.haptic?.('kill');
    }
  }

  function afterAct() {
    if (!F || F.phase !== 'fight' || !F.sim) return;
    if (checkEnd()) return;
    renderChrome();
    draw();
    const u = F.sim.current();
    if (u && u.side === 'e') turnTimer = setTimeout(aiTurn, 400);
  }

  function commitStrike(u, t) {
    F.aim = null;
    const res = F.sim.strike(u, t);
    if (!res.ok) {
      api.toast('Cannot reach that foe');
      return;
    }
    playFx(res.events);
    if (checkEnd()) return;
    F.sim.advanceTurn();
    renderChrome();
    draw();
    turnTimer = setTimeout(afterAct, 360);
  }

  function nextTurn() {
    if (!F || F.phase !== 'fight' || !F.sim) return;
    F.sim.advanceTurn();
    afterAct();
  }

  function checkEnd() {
    if (!F?.sim) return false;
    if (!F.sim.isOver()) return false;
    finishInteractive();
    return true;
  }

  function aiTurn() {
    if (!F || F.phase !== 'fight' || !F.sim) return;
    const res = F.sim.autoAct();
    playFx(res.events);
    afterAct();
  }

  function castSpell(t) {
    const k = F.cast;
    const P = SPELLS[k];
    if (!P || !t) {
      api.toast('Target a stack');
      return;
    }
    if ((P.type === 'dmg' || P.type === 'aoe' || P.type === 'debuff') && t.side !== 'e') {
      api.toast('That spell targets enemies');
      return;
    }
    if ((P.type === 'buff' || P.type === 'heal' || P.type === 'res') && t.side !== 'p') {
      api.toast('That spell targets your own');
      return;
    }
    if (F.hero.mana < P.mana) {
      api.toast('Not enough mana');
      return;
    }
    F.hero.mana -= P.mana;
    F.cast = null;
    F.hero.castThisRound = true;
    const pow = F.hero.pow;
    const cx = geo.offsetX + (t.x + 0.5) * geo.cellSize;
    const cy = geo.offsetY + (t.y + 0.5) * geo.cellSize;

    if (P.type === 'dmg') {
      const d = P.f(pow);
      const res = applyDamage(t, d);
      spawnFloat(fx, cx, cy, String(d), '#b06bff');
      spawnBurst(fx, cx, cy, 'hit');
      if (res.dead) api.haptic?.('kill');
    } else if (P.type === 'aoe') {
      const d = P.f(pow);
      F.units
        .filter((u) => u.side === 'e' && !u.dead && Math.max(Math.abs(u.x - t.x), Math.abs(u.y - t.y)) <= 1)
        .forEach((u) => {
          applyDamage(u, d);
          const ux = geo.offsetX + (u.x + 0.5) * geo.cellSize;
          const uy = geo.offsetY + (u.y + 0.5) * geo.cellSize;
          spawnFloat(fx, ux, uy, String(d), '#c45c4a');
        });
    } else if (P.type === 'buff') {
      if (k === 'bless') t.bless = pow + 1;
      else t.haste = 3;
      spawnBurst(fx, cx, cy, 'heal');
    } else if (P.type === 'debuff') {
      t.slowT = 3;
      spawnBurst(fx, cx, cy, 'hit');
    } else if (P.type === 'heal' || P.type === 'res') {
      const amt = P.f(pow);
      const pool = (t.count - 1) * t.uhp + t.top + amt;
      const maxPool = t.uhp * (t.maxCount || t.count);
      const np = Math.min(pool, maxPool);
      t.count = Math.ceil(np / t.uhp);
      t.top = np - (t.count - 1) * t.uhp;
      spawnFloat(fx, cx, cy, `+${amt}`, '#5ec27a');
      spawnBurst(fx, cx, cy, 'heal');
    }
    checkEnd();
    renderChrome();
    draw();
  }

  function beginResolveShortcut() {
    if (!F || F.phase === 'recap') return;
    if (F.phase === 'place') {
      if (!F.units.some((u) => u.side === 'p')) deployAll();
      if (!F.units.some((u) => u.side === 'p')) {
        api.toast('Deploy at least one stack');
        return;
      }
      spawnEnemies();
      F.rng = createRng(F.seed);
      attachSim();
    }
    if (!F.sim) {
      attachSim();
    }
    clearTimeout(turnTimer);
    F.resolved = F.sim.clone().runToEnd();
    F.phase = 'recap';
    F.eventIdx = 0;
    renderChrome();
    draw();
    playRecapStep();
  }

  function unitById(id, side) {
    return F.units.find((u) => u.id === id && (!side || u.side === side))
      || F.units.find((u) => u.id === id);
  }

  function applyEventVisual(ev) {
    const defender = unitById(ev.to);
    if (!defender) return;
    const cx = geo.offsetX + (defender.x + 0.5) * geo.cellSize;
    const cy = geo.offsetY + (defender.y + 0.5) * geo.cellSize;
    spawnFloat(fx, cx, cy, String(ev.dmg), ev.lucky ? '#f0a92e' : '#e8e4d9');
    spawnBurst(fx, cx, cy, 'hit');
    if (ev.dead || (ev.slain && defender.count <= (ev.slain || 0))) {
      defender.count = Math.max(0, defender.count - (ev.slain || defender.count));
      if (defender.count <= 0) {
        defender.dead = true;
        spawnFloat(fx, cx, cy - 14, 'Fallen', '#c45c4a');
        if (ev.side === 'p') api.haptic?.('kill');
      }
    } else if (ev.slain) {
      defender.count = Math.max(1, defender.count - ev.slain);
    }
  }

  function syncBoardToResult() {
    if (!F?.resolved) return;
    for (const p of F.resolved.player) {
      const u = unitById(p.id, 'p');
      if (!u) continue;
      u.count = p.count;
      u.top = p.top;
      u.dead = !!p.dead || p.count <= 0;
    }
    for (const e of F.resolved.enemy) {
      const u = unitById(e.id, 'e');
      if (!u) continue;
      u.count = e.count;
      u.top = e.top;
      u.dead = !!e.dead || e.count <= 0;
    }
  }

  function playRecapStep() {
    if (!F || F.phase !== 'recap') return;
    const events = F.resolved?.events || [];
    if (F.eventIdx >= events.length) {
      syncBoardToResult();
      draw();
      turnTimer = setTimeout(() => finishFromResolved(), 450);
      return;
    }
    applyEventVisual(events[F.eventIdx]);
    F.eventIdx += 1;
    draw();
    turnTimer = setTimeout(playRecapStep, 220);
  }

  function armyAfterFromUnits(playerUnits) {
    const S = api.getState();
    return playerUnits
      .filter((p) => p.count > 0)
      .map((p) => {
        const orig = S.army.find((a) => a.id === p.id);
        return orig ? { ...orig, count: p.count } : null;
      })
      .filter(Boolean);
  }

  function finishFromResolved() {
    if (!F?.resolved) return;
    clearTimeout(turnTimer);
    syncBoardToResult();
    const result = F.resolved;
    const armyAfter = armyAfterFromUnits(result.player);
    api.onBattleEnd(result, armyAfter, { nodeIndex: F.nodeIndex });
    end();
  }

  function finishInteractive() {
    clearTimeout(turnTimer);
    const result = F.sim ? F.sim.snapshot() : {
      win: false,
      winner: 'e',
      rounds: F.round,
      player: F.units.filter((u) => u.side === 'p'),
      enemy: F.units.filter((u) => u.side === 'e'),
      events: F.events,
      seed: F.seed,
    };
    const armyAfter = armyAfterFromUnits(result.player);
    api.onBattleEnd(result, armyAfter, { nodeIndex: F.nodeIndex });
    end();
  }

  function drawUnit(ctx, u) {
    const x = geo.offsetX + u.x * geo.cellSize;
    const y = geo.offsetY + u.y * geo.cellSize;
    const s = geo.cellSize * 0.82;
    const ox = x + (geo.cellSize - s) / 2;
    const oy = y + (geo.cellSize - s) / 2;
    const fid = unitFrameId(u, F.age);
    const atlas = (u.side === 'e' || u.kind === 'creature') ? creatureAtlas : unitAtlas;
    if (atlas && fid && (atlas.frameImages?.[fid] || atlas.frames?.[fid])) {
      drawFrame(ctx, atlas, fid, ox, oy, s, s, { flipX: u.side === 'e' });
    } else {
      drawSilhouette(ctx, ox, oy, s, s, u.n || u.type);
    }
    ctx.fillStyle = u.side === 'p' ? '#c9a227' : '#c45c4a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`×${u.count}`, x + geo.cellSize / 2, y + geo.cellSize - 4);
  }

  function draw() {
    if (!F) return;
    const st = dom.stage;
    if (needsResize(prev.w, prev.h, st.clientWidth, st.clientHeight)) fsize();
    const ctx = canvas.getContext('2d');
    const w = prev.w;
    const h = prev.h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a2230';
    ctx.fillRect(0, 0, w, h);

    const active = F.phase === 'fight' && F.sim ? F.sim.current() : null;
    const moveReach = active && active.side === 'p' ? reach(active) : null;

    for (let r = 0; r < FR; r++) {
      for (let c = 0; c < FC; c++) {
        const x = geo.offsetX + c * geo.cellSize;
        const y = geo.offsetY + r * geo.cellSize;
        const deploy = F.phase === 'place' && r >= FR - F.placeRows;
        const move = moveReach && moveReach[`${c},${r}`] !== undefined;
        ctx.fillStyle = deploy
          ? 'rgba(201,162,39,0.18)'
          : move
            ? 'rgba(74,168,255,0.18)'
            : (((c + r) % 2) ? '#243044' : '#1e2838');
        ctx.fillRect(x, y, geo.cellSize - 1, geo.cellSize - 1);
      }
    }

    for (const u of F.units) {
      if (u.dead) continue;
      drawUnit(ctx, u);
      if (active === u) {
        const x = geo.offsetX + u.x * geo.cellSize;
        const y = geo.offsetY + u.y * geo.cellSize;
        ctx.strokeStyle = '#ffe699';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, geo.cellSize - 5, geo.cellSize - 5);
      }
    }
    drawFx(ctx, fx);
  }

  function loop() {
    if (!F) return;
    updateFx(fx, 1 / 60);
    draw();
    raf = requestAnimationFrame(loop);
  }

  canvas.addEventListener('click', (e) => {
    if (!F) return;
    if (F.phase === 'recap') {
      finishFromResolved();
      return;
    }
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

    if (F.phase !== 'fight' || !F.sim) return;
    const u = F.sim.current();
    if (!u || u.side !== 'p') return;
    const t = unitAt(cell.c, cell.r);

    if (F.cast) {
      castSpell(t);
      return;
    }

    if (t && t.side === 'e') {
      const kind = strikeKind(u, t);
      if (!kind) {
        api.toast('Cannot reach that foe');
        return;
      }
      if (F.aim && F.aim.target === t) {
        commitStrike(u, t);
        return;
      }
      F.aim = { target: t, kind };
      renderChrome();
      draw();
      return;
    }

    if (!t) {
      F.aim = null;
      const moved = F.sim.move(u, cell.c, cell.r);
      if (!moved.ok) {
        api.toast('Too far');
        renderChrome();
        return;
      }
      F.sim.advanceTurn();
      renderChrome();
      draw();
      turnTimer = setTimeout(afterAct, 260);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!F || F.phase !== 'fight' || !F.sim) return;
    const u = F.sim.current();
    if (!u || u.side !== 'p' || F.cast) return;
    const pt = cssPoint(canvas, e.clientX, e.clientY);
    const cell = cellAt(pt.x, pt.y);
    if (!cell) return;
    const t = unitAt(cell.c, cell.r);
    if (t && t.side === 'e') {
      const kind = strikeKind(u, t);
      if (!kind) return;
      const prev = previewDmg(u, t, kind === 'ranged');
      dom.hint.textContent = `${t.n || t.type} ×${t.count} — ~${prev.dmg} dmg. Tap to aim.`;
    }
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
    if (e.target.id === 'fPlaceAll') {
      deployAll();
      return;
    }
    if (e.target.id === 'fSkipRecap' && F?.phase === 'recap') {
      finishFromResolved();
      return;
    }
    if (!F || F.phase !== 'fight' || !F.sim) return;
    const btn = e.target.closest('[data-f]');
    if (!btn) return;
    const u = F.sim.current();
    if (!u || u.side !== 'p') return;
    F.aim = null;
    if (btn.dataset.f === 'wait') {
      F.sim.wait(u);
      nextTurn();
      return;
    }
    if (btn.dataset.f === 'defend') {
      F.sim.defend(u);
      nextTurn();
      return;
    }
    if (btn.dataset.f === 'spell') {
      if (F.hero.castThisRound) {
        api.toast('Already cast this round');
        return;
      }
      const k = btn.dataset.spell;
      if (!SPELLS[k]) return;
      if (F.hero.mana < SPELLS[k].mana) {
        api.toast('Not enough mana');
        return;
      }
      F.cast = k;
      renderChrome();
    }
  });

  dom.go.addEventListener('click', () => {
    if (!F) return;
    if (F.phase === 'place') beginFight();
  });

  dom.resolve.addEventListener('click', () => {
    if (!F) return;
    beginResolveShortcut();
  });

  dom.quit.addEventListener('click', () => {
    if (confirm('Quit battle?')) end();
  });

  return { start, end, active: () => !!F };
}
