import { fitCanvas, calcGridGeometry, needsResize, cssPoint } from '../render/canvas.js';
import { createFx, spawnFloat, spawnBurst, updateFx, drawFx } from '../render/fx.js';
import { unitStats } from '../rules/units.js';
import { calcDamage, applyDamage, resolveBattle, createRng, FC, FR } from '../rules/combat.js';
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
 * Deployment → fight with seeded createRng(F.seed); Resolve shortcuts via resolveBattle.
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
    };
  }

  function spdBon() {
    return heroBonus(api.getState().hero).spdBon || 0;
  }

  function effSpd(u) {
    return Math.max(1, (u.spd || 1) + (u.haste || 0) - (u.slowT || 0) + (u.side === 'p' ? spdBon() : 0));
  }

  function occupied(x, y) {
    return F.units.some((u) => !u.dead && u.x === x && u.y === y);
  }

  function unitAt(x, y) {
    return F.units.find((u) => !u.dead && u.x === x && u.y === y);
  }

  function reach(u) {
    const dest = {};
    const visited = {};
    const q = [{ x: u.x, y: u.y, d: 0 }];
    visited[`${u.x},${u.y}`] = 0;
    const mv = Math.max(1, effSpd(u));
    while (q.length) {
      const c = q.shift();
      if (c.d >= mv) continue;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          const nx = c.x + dx;
          const ny = c.y + dy;
          const k = `${nx},${ny}`;
          if (nx < 0 || ny < 0 || nx >= FC || ny >= FR) continue;
          if (visited[k] !== undefined) continue;
          const occ = occupied(nx, ny);
          if (occ && !u.fly) continue;
          visited[k] = c.d + 1;
          if (!occ) dest[k] = c.d + 1;
          q.push({ x: nx, y: ny, d: c.d + 1 });
        }
      }
    }
    return dest;
  }

  function adj(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
  }

  function hasAdjEnemy(u) {
    return F.units.some((e) => !e.dead && e.side !== u.side && adj(u, e));
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
    if (F.phase !== 'fight' || !F.order?.length) {
      oe.innerHTML = '';
      return;
    }
    const active = F.order[F.turn];
    oe.innerHTML = F.order
      .filter((u) => !u.dead)
      .map((u) => {
        const now = u === active ? ' now' : '';
        const spent = F.order.indexOf(u) < F.turn ? ' spent' : '';
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
      const u = F.order[F.turn];
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

  function buildOrder() {
    F.units.forEach((u) => {
      u.retaliated = false;
      u.defending = false;
      u.waited = false;
    });
    F.order = F.units
      .filter((u) => !u.dead && u.count > 0)
      .sort((a, b) => effSpd(b) - effSpd(a) || (F.rng() - 0.5));
    F.turn = 0;
    F.hero.castThisRound = false;
  }

  function beginFight() {
    spawnEnemies();
    F.rng = createRng(F.seed);
    F.phase = 'fight';
    F.round = 1;
    F.events = [];
    F.aim = null;
    F.cast = null;
    F.units.filter((u) => u.side === 'p').forEach((u) => { u.maxCount = u.count; });
    buildOrder();
    renderChrome();
    draw();
    const u = F.order[F.turn];
    if (u && u.side === 'e') turnTimer = setTimeout(aiTurn, 420);
  }

  function previewDmg(attacker, defender, ranged) {
    const S = api.getState();
    return calcDamage(attacker, defender, {
      ranged,
      hero: heroCtx(S),
      adjacentEnemy: hasAdjEnemy(attacker),
      boss: F.boss,
      rng: () => 0.5,
    });
  }

  function strikeKind(u, t) {
    if (!u || !t || t.dead || t.side === u.side) return null;
    if (u.rng > 0 && u.shots > 0 && !hasAdjEnemy(u)) return 'ranged';
    if (adj(u, t)) return 'melee';
    const rc = reach(u);
    for (const k in rc) {
      const [x, y] = k.split(',').map(Number);
      if (Math.max(Math.abs(x - t.x), Math.abs(y - t.y)) <= 1) return 'melee';
    }
    return null;
  }

  function doAttack(a, t, ranged) {
    const S = api.getState();
    const hit = calcDamage(a, t, {
      ranged,
      hero: heroCtx(S),
      adjacentEnemy: hasAdjEnemy(a),
      boss: F.boss,
      rng: F.rng,
    });
    const res = applyDamage(t, hit.dmg);
    a.dealt = (a.dealt || 0) + hit.dmg;
    if (ranged) a.shots = Math.max(0, (a.shots || 0) - 1);

    const cx = geo.offsetX + (t.x + 0.5) * geo.cellSize;
    const cy = geo.offsetY + (t.y + 0.5) * geo.cellSize;
    spawnFloat(fx, cx, cy, String(hit.dmg), hit.lucky ? '#f0a92e' : '#e8e4d9');
    spawnBurst(fx, cx, cy, 'hit');
    if (res.killed) spawnFloat(fx, cx, cy - 14, `${res.killed} slain`, '#c45c4a');
    if (res.dead) api.haptic?.('kill');

    F.events.push({
      type: 'strike', round: F.round, side: a.side, from: a.id, to: t.id,
      actor: a.n || a.type, target: t.n || t.type, dmg: hit.dmg, slain: res.killed,
      dead: res.dead, ranged, lucky: hit.lucky,
    });

    if (!ranged && !res.dead && !t.retaliated && t.count > 0) {
      t.retaliated = true;
      const back = calcDamage(t, a, {
        ranged: false,
        hero: heroCtx(S),
        adjacentEnemy: hasAdjEnemy(t),
        boss: F.boss,
        rng: F.rng,
      });
      const backRes = applyDamage(a, back.dmg);
      const ax = geo.offsetX + (a.x + 0.5) * geo.cellSize;
      const ay = geo.offsetY + (a.y + 0.5) * geo.cellSize;
      spawnFloat(fx, ax, ay, String(back.dmg), '#e8e4d9');
      F.events.push({
        type: 'retaliate', round: F.round, side: t.side, from: t.id, to: a.id,
        actor: t.n || t.type, target: a.n || a.type, dmg: back.dmg, slain: backRes.killed, retal: true,
      });
    }
  }

  function commitStrike(u, t, kind) {
    F.aim = null;
    if (kind === 'ranged') {
      doAttack(u, t, true);
    } else if (adj(u, t)) {
      doAttack(u, t, false);
    } else {
      const rc = reach(u);
      let best = null;
      let bd = 1e9;
      for (const k in rc) {
        const [x, y] = k.split(',').map(Number);
        const d = Math.max(Math.abs(x - t.x), Math.abs(y - t.y));
        if (d <= 1 && rc[k] < bd) {
          bd = rc[k];
          best = k;
        }
      }
      if (!best) return;
      const [x, y] = best.split(',').map(Number);
      u.x = x;
      u.y = y;
      doAttack(u, t, false);
    }
    renderChrome();
    draw();
    if (!checkEnd()) turnTimer = setTimeout(nextTurn, 360);
  }

  function nextTurn() {
    if (!F || F.phase !== 'fight') return;
    const cur = F.order[F.turn];
    if (cur) {
      if (cur.bless > 0) cur.bless--;
      if (cur.haste > 0) cur.haste--;
      if (cur.slowT > 0) cur.slowT--;
    }
    F.turn++;
    while (F.turn < F.order.length && F.order[F.turn].dead) F.turn++;
    if (F.turn >= F.order.length) {
      F.round++;
      buildOrder();
      while (F.turn < F.order.length && F.order[F.turn].dead) F.turn++;
    }
    if (checkEnd()) return;
    renderChrome();
    draw();
    const u = F.order[F.turn];
    if (u && u.side === 'e') turnTimer = setTimeout(aiTurn, 420);
  }

  function checkEnd() {
    const p = F.units.filter((u) => u.side === 'p' && !u.dead && u.count > 0);
    const e = F.units.filter((u) => u.side === 'e' && !u.dead && u.count > 0);
    if (!e.length) {
      finishInteractive(true);
      return true;
    }
    if (!p.length) {
      finishInteractive(false);
      return true;
    }
    return false;
  }

  function aiTurn() {
    if (!F || F.phase !== 'fight') return;
    const u = F.order[F.turn];
    if (!u || u.dead) {
      nextTurn();
      return;
    }
    const foes = F.units.filter((x) => x.side === 'p' && !x.dead && x.count > 0);
    if (!foes.length) {
      checkEnd();
      return;
    }
    const score = (t) => (t.count * (t.dmin + t.dmax)) / 2 / (1 + t.def * 0.05)
      - Math.max(Math.abs(t.x - u.x), Math.abs(t.y - u.y)) * 2;
    const target = foes.slice().sort((a, b) => score(b) - score(a))[0];
    if (u.rng > 0 && u.shots > 0 && !hasAdjEnemy(u)) {
      doAttack(u, target, true);
      renderChrome();
      draw();
      if (!checkEnd()) turnTimer = setTimeout(nextTurn, 400);
      return;
    }
    const rc = reach(u);
    let best = null;
    let bd = 1e9;
    for (const k in rc) {
      const [x, y] = k.split(',').map(Number);
      const d = Math.max(Math.abs(x - target.x), Math.abs(y - target.y));
      if (d < bd || (d === bd && (!best || rc[k] < rc[best]))) {
        bd = d;
        best = k;
      }
    }
    if (best) {
      const [x, y] = best.split(',').map(Number);
      u.x = x;
      u.y = y;
    }
    if (adj(u, target)) doAttack(u, target, false);
    renderChrome();
    draw();
    if (!checkEnd()) turnTimer = setTimeout(nextTurn, 400);
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

  function computeResolution() {
    const S = api.getState();
    const player = F.units
      .filter((u) => u.side === 'p' && !u.dead && u.count > 0)
      .map((u) => ({
        id: u.id,
        name: u.n || u.type,
        type: u.type,
        kind: u.kind,
        atk: u.atk,
        def: u.def,
        dmin: u.dmin,
        dmax: u.dmax,
        spd: effSpd(u),
        rng: u.rng,
        shots: u.shots,
        count: u.count,
        maxCount: u.maxCount ?? u.count,
        uhp: u.uhp,
        top: u.top,
        bless: !!u.bless,
        defending: !!u.defending,
      }));
    const enemy = F.units
      .filter((u) => u.side === 'e' && !u.dead && u.count > 0)
      .map((u) => ({
        id: u.id,
        name: u.n || u.type,
        type: u.type,
        kind: u.kind,
        atk: u.atk,
        def: u.def,
        dmin: u.dmin,
        dmax: u.dmax,
        spd: effSpd(u),
        rng: u.rng,
        shots: u.shots,
        count: u.count,
        maxCount: u.maxCount ?? u.count,
        uhp: u.uhp,
        top: u.top,
        bless: !!u.bless,
        defending: !!u.defending,
      }));
    return resolveBattle({
      seed: F.seed,
      player,
      enemy,
      boss: F.boss,
      hero: heroCtx(S),
    });
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

  function beginResolveShortcut() {
    if (F.phase === 'place') {
      if (!F.units.some((u) => u.side === 'p')) deployAll();
      if (!F.units.some((u) => u.side === 'p')) {
        api.toast('Deploy at least one stack');
        return;
      }
      spawnEnemies();
    }
    clearTimeout(turnTimer);
    F.resolved = computeResolution();
    F.phase = 'recap';
    F.eventIdx = 0;
    renderChrome();
    draw();
    playRecapStep();
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

  function finishInteractive(win) {
    clearTimeout(turnTimer);
    const player = F.units.filter((u) => u.side === 'p');
    const enemy = F.units.filter((u) => u.side === 'e');
    const result = {
      win,
      winner: win ? 'p' : 'e',
      rounds: F.round,
      player,
      enemy,
      events: F.events,
      seed: F.seed,
    };
    const armyAfter = armyAfterFromUnits(player);
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

    const active = F.phase === 'fight' ? F.order[F.turn] : null;
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

    if (F.phase !== 'fight') return;
    const u = F.order[F.turn];
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
        commitStrike(u, t, kind);
        return;
      }
      F.aim = { target: t, kind };
      renderChrome();
      draw();
      return;
    }

    if (!t) {
      F.aim = null;
      const rc = reach(u);
      if (rc[`${cell.c},${cell.r}`] === undefined) {
        api.toast('Too far');
        renderChrome();
        return;
      }
      u.x = cell.c;
      u.y = cell.r;
      renderChrome();
      draw();
      turnTimer = setTimeout(nextTurn, 260);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!F || F.phase !== 'fight') return;
    const u = F.order[F.turn];
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
    if (!F || F.phase !== 'fight') return;
    const btn = e.target.closest('[data-f]');
    if (!btn) return;
    const u = F.order[F.turn];
    if (!u || u.side !== 'p') return;
    F.aim = null;
    if (btn.dataset.f === 'wait') {
      F.order.splice(F.turn, 1);
      F.order.push(u);
      u.waited = true;
      F.turn--;
      nextTurn();
      return;
    }
    if (btn.dataset.f === 'defend') {
      u.defending = true;
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
