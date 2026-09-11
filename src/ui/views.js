import {
  CLASSES, BUILDINGS, ROLES, RANKS, SKILLS, SPELLS, SLOTS, MILESTONES, TOWERS,
  TERRAIN, WEATHER, CREATURES, PRIMARIES,
} from '../data/index.js';
import { rates, bcost, canPay, armySlots, blOf, ageUpCost, calcAgeUpPrompt, scaleCost, towerSlots } from '../rules/economy.js';
import { unitStats } from '../rules/units.js';
import { calcHostPower, encounterVerdict, verdictLabel } from '../rules/encounters.js';
import { standingLines } from '../state/storyFlags.js';
import { checkMilestones } from '../state/milestones.js';
import { encodeChallenge } from '../rules/combat.js';
import { iconMarkup } from './icons.js';
import { esc, reducedMotion } from '../util.js';
import { fitCanvas, observeCanvasHost, cssPoint } from '../render/canvas.js';
import { ensureAtlas, drawFrame } from '../render/atlas.js';
import { AGES } from '../data/index.js';
import { costStr, renderBuildingPanel, getTodayBeat } from './beat.js';
import {
  createCamera, clampCamera, worldToScreen, screenToWorld, applyZoom, applyPan,
} from './mapcamera.js';

const NODE_META = {
  town: { n: 'Town', tint: '#6a8a6a' },
  creature: { n: 'Pack', tint: '#c9a227' },
  resource: { n: 'Cache', tint: '#7a9ab0' },
  dwelling: { n: 'Dwelling', tint: '#8a7ab0' },
  event: { n: 'Event', tint: '#b08a5a' },
  treasure: { n: 'Treasure', tint: '#d4b84a' },
  ambush: { n: 'Ambush', tint: '#a05040' },
  garrison: { n: 'Garrison', tint: '#8a3a32' },
  boss: { n: 'Warlord', tint: '#c45c4a' },
};

const BIOME_FRAME = {
  plains: 'map-lowlands',
  forest: 'map-forest',
  hills: 'map-lowlands',
  swamp: 'map-swamp',
  desert: 'map-desert',
  snow: 'map-snow',
  waste: 'map-darklands',
  ruins: 'map-darklands',
};

function formatCost(cost) {
  return costStr(cost);
}

export function renderHost(root, state, tab, api) {
  const seg = tab === 'army' ? 'army' : 'hero';
  const power = calcHostPower(state.army, state.hero);
  let html = `<div class="seg">
    <button type="button" class="btn ${seg === 'hero' ? 'on' : ''}" data-seg="hero">Hero</button>
    <button type="button" class="btn ${seg === 'army' ? 'on' : ''}" data-seg="army">Army</button>
  </div>`;

  if (seg === 'hero') {
    const C = CLASSES[state.hero.cls];
    const H = state.hero;
    html += `<div class="card">
      <h3>${esc(H.name)} · ${C.n}</h3>
      <canvas id="herocv" width="220" height="280" style="width:100%;max-width:220px;height:auto;background:#0f131a;border-radius:12px;border:1px solid rgba(201,162,39,.25)"></canvas>
      <p>Lv ${H.lvl} · XP ${H.xp || 0} · Pts ${H.pts || 0}</p>
      <p class="dim">Mana ${H.mana}/${(H.kno || 1) * 10} · Moves ${H.mp}/${H.mpMax || 5}</p>
      ${(H.pts || 0) > 0 ? `<div class="seg">${PRIMARIES.map((p) => `<button type="button" class="btn sm" data-a="stat" data-k="${p.k}" title="${esc(p.d)}">+${p.n}</button>`).join('')}</div>` : ''}
      <div class="seg" style="flex-wrap:wrap;gap:6px;margin-top:8px">
        ${PRIMARIES.map((p) => `<span class="dim">${p.n} ${H[p.k] || 0}</span>`).join(' · ')}
      </div>
    </div>
    <div class="card"><h3>Skills</h3>
      ${Object.keys(SKILLS).map((k) => {
        const lv = H.skills?.[k] || 0;
        const sk = SKILLS[k];
        return `<div class="unit-card"><strong>${sk.n}</strong> · Lv ${lv}
          <div class="dim">${esc(sk.d)}</div>
          ${(H.pts || 0) > 0 && lv < 3 ? `<button type="button" class="btn sm" data-a="skill" data-k="${k}">Train</button>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="card"><h3>Spells</h3>
      ${(H.spells || []).map((id) => {
        const sp = SPELLS[id];
        return `<div class="unit-card">${esc(sp?.n || id)} <span class="dim">${sp?.mana || '?'} mana · ${esc(sp?.d || '')}</span></div>`;
      }).join('') || '<p class="dim">None</p>'}
    </div>
    <div class="card"><h3>Paper doll</h3>
      ${SLOTS.map((s) => {
        const item = H.equip?.[s.k];
        return `<div class="unit-card"><strong>${s.n}</strong>: ${item ? esc(item.name || item.n || item.id) : '<span class="dim">Empty</span>'}
          ${item ? `<button type="button" class="btn sm" data-a="unequip" data-slot="${s.k}">Unequip</button>` : ''}
          <button type="button" class="btn sm" data-a="forge" data-slot="${s.k}">Forge</button>
        </div>`;
      }).join('')}
    </div>
    <div class="card"><h3>Bag</h3>
      ${(H.bag || []).length
        ? (H.bag || []).map((it, i) => `<div class="unit-card">${esc(it.name || it.n || it.id)}
            <button type="button" class="btn sm" data-a="equip" data-i="${i}">Equip</button></div>`).join('')
        : '<p class="dim">Empty bag</p>'}
    </div>`;
  } else {
    const slots = armySlots(state.bld);
    html += `<div class="card"><h3>Host strength <span class="power">${power}</span></h3>
      <p>Slots ${state.army.length}/${slots}</p></div>`;
    if (!state.army.length) {
      html += `<div class="card"><p>Your roster is empty. Recruit below — Begin stays disabled until you field a stack.</p></div>`;
    }
    html += state.army.map((s) => {
      const st = unitStats(s);
      const rank = RANKS[s.rank || 0] || RANKS[0];
      const rankPct = Math.min(100, ((s.xp || 0) % 100));
      const tags = [];
      if (st?.shots) tags.push(`${st.shots} shots`);
      if (st?.fly) tags.push('flying');
      return `<div class="card unit-card">
        <strong>${esc(st?.n || s.type)}</strong> ×${s.count}
        <div>ATK ${st?.atk ?? '—'} · DEF ${st?.def ?? '—'} · HP ${st?.hp ?? '—'} · DMG ${st?.dmin ?? '?'}-${st?.dmax ?? '?'} · SPD ${st?.spd ?? '—'}</div>
        <div class="dim">${rank?.n || 'RECRUIT'} · XP ${s.xp || 0}</div>
        <div style="height:6px;background:#1a2030;border-radius:3px;margin:6px 0"><div style="height:100%;width:${rankPct}%;background:var(--gold);border-radius:3px"></div></div>
        ${tags.length ? `<div class="dim">${tags.join(' · ')}</div>` : ''}
        <button type="button" class="btn sm" data-a="reinf" data-id="${s.id}">Reinforce</button>
        <button type="button" class="btn sm ghost" data-a="disband" data-id="${s.id}">Disband</button>
      </div>`;
    }).join('');
    html += `<div class="card"><h3>Recruit</h3>${Object.keys(ROLES).map((k) => {
      const r = ROLES[k];
      const cost = scaleCost(r.cost, state.age);
      const ok = canPay(state.res, cost) && state.army.length < slots;
      return `<button type="button" class="btn ${ok ? 'gold' : ''}" data-a="recruit" data-type="${k}" ${ok ? '' : 'disabled'}>
        ${r.names[state.age]} · ${formatCost(cost)}</button>`;
    }).join(' ')}</div>`;

    const tSlots = towerSlots(state.bld);
    const towers = state.towers || [];
    html += `<div class="card"><h3>Siege towers</h3>
      <p class="dim">Workshop slots ${towers.length}/${tSlots}</p>
      ${towers.length
        ? towers.map((t, i) => {
          const def = TOWERS[t.fam];
          return `<div class="unit-card">${def?.names?.[t.tier || state.age] || t.fam}
            · RNG ${def?.rng ?? '—'} · DMG ${def?.dmg ?? 0}
          </div>`;
        }).join('')
        : '<p class="dim">Build a Workshop to field towers in sieges.</p>'}
      ${blOf(state.bld, 'workshop') > 0 ? Object.keys(TOWERS).map((fam) => {
        const def = TOWERS[fam];
        const cost = scaleCost(def.cost, state.age);
        const ok = canPay(state.res, cost) && towers.length < tSlots;
        return `<button type="button" class="btn sm" data-a="btower" data-fam="${fam}" ${ok ? '' : 'disabled'}>${def.n} · ${formatCost(cost)}</button>`;
      }).join(' ') : ''}
    </div>`;
  }
  root.innerHTML = html;
  root.querySelectorAll('[data-seg]').forEach((b) => b.addEventListener('click', () => api.setHostSeg(b.dataset.seg)));
  root.querySelectorAll('[data-a="recruit"]').forEach((b) => b.addEventListener('click', () => api.dispatch({ type: 'recruit', unitType: b.dataset.type })));
  root.querySelectorAll('[data-a="reinf"]').forEach((b) => b.addEventListener('click', () => api.dispatch({ type: 'reinforce', stackId: b.dataset.id })));
  root.querySelectorAll('[data-a="disband"]').forEach((b) => b.addEventListener('click', () => {
    if (confirm('Disband this stack?')) api.dispatch({ type: 'disband', stackId: b.dataset.id });
  }));
  root.querySelectorAll('[data-a="btower"]').forEach((b) => b.addEventListener('click', () => api.dispatch({ type: 'buy-tower', fam: b.dataset.fam })));
  root.querySelectorAll('[data-a="stat"]').forEach((b) => b.addEventListener('click', () => api.dispatch({ type: 'spend-stat', stat: b.dataset.k })));
  root.querySelectorAll('[data-a="skill"]').forEach((b) => b.addEventListener('click', () => api.dispatch({ type: 'learn-skill', skill: b.dataset.k })));
  root.querySelectorAll('[data-a="forge"]').forEach((b) => b.addEventListener('click', () => api.dispatch({ type: 'forge', slot: b.dataset.slot })));
  root.querySelectorAll('[data-a="equip"]').forEach((b) => {
    b.addEventListener('click', () => api.dispatch({ type: 'equip', index: Number(b.dataset.i) }));
  });
  root.querySelectorAll('[data-a="unequip"]').forEach((b) => {
    b.addEventListener('click', () => api.dispatch({ type: 'unequip', slot: b.dataset.slot }));
  });
  const cv = root.querySelector('#herocv');
  if (cv) drawHeroPreview(cv, state.hero.cls);
}

export async function drawHeroPreview(canvas, cls) {
  const { ctx, cssW: w, cssH: h } = fitCanvas(canvas, canvas.clientWidth || 220, canvas.clientHeight || 280);
  ctx.fillStyle = '#12151b';
  ctx.fillRect(0, 0, w, h);
  try {
    const atlas = await ensureAtlas('hero');
    const idle = `hero-${cls}-idle`;
    const portrait = `hero-${cls}-portrait`;
    const frame = (atlas.frameImages?.[idle] || atlas.frames?.[idle]) ? idle : portrait;
    drawFrame(ctx, atlas, frame, 16, 16, w - 32, h - 32);
  } catch {
    ctx.fillStyle = cls === 'warlock' ? '#5a3a68' : cls === 'ranger' ? '#3a6a68' : '#4a4558';
    ctx.fillRect(w * 0.35, h * 0.35, w * 0.3, h * 0.4);
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.28, w * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#d4c4a0';
    ctx.fill();
  }
  ctx.strokeStyle = '#c9a227';
  ctx.strokeRect(8, 8, w - 16, h - 16);
}

let selectedMapNode = null;
let stopMapObserve = () => {};
let mapAtlas = null;
let mapCam = createCamera();
let mapPulse = 0;
ensureAtlas('map').then((a) => { mapAtlas = a; });

function findStoryPath(map) {
  if (!map?.nodes) return new Set();
  const bossIdx = map.nodes.findIndex((n) => n.type === 'boss' && !n.cleared);
  const goal = bossIdx >= 0 ? bossIdx : map.nodes.length - 1;
  const start = map.at;
  if (start === goal) return new Set();
  const parent = new Map([[start, -1]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    if (cur === goal) break;
    for (const n of map.links[cur] || []) {
      if (parent.has(n)) continue;
      parent.set(n, cur);
      q.push(n);
    }
  }
  const edges = new Set();
  if (!parent.has(goal)) return edges;
  let c = goal;
  while (c !== start) {
    const p = parent.get(c);
    if (p < 0) break;
    edges.add(`${Math.min(p, c)}-${Math.max(p, c)}`);
    c = p;
  }
  return edges;
}

function mapBiomeFrame(map) {
  const at = map.nodes[map.at];
  const t = at?.terrain || 'plains';
  return BIOME_FRAME[t] || 'map-lowlands';
}

function nodeWorld(n, worldW, worldH) {
  return { x: n.x * worldW, y: n.y * worldH };
}

export function renderMap(root, state, api) {
  stopMapObserve();
  if (!state.map) {
    selectedMapNode = null;
    root.innerHTML = `<div class="card"><h3>Region map</h3><p>Scouting the valleys…</p></div>`;
    // Auto-generate on first visit (defer to avoid re-entrant render)
    queueMicrotask(() => api.dispatch({ type: 'gen-map' }));
    return;
  }

  const weather = WEATHER[state.map.weather || state.weather] || WEATHER.clear;
  const atNode = state.map.nodes[state.map.at];
  const terrain = TERRAIN[atNode?.terrain] || TERRAIN.plains;
  const mp = state.hero.mp || 0;
  const mpMax = state.hero.mpMax || 5;
  const weatherMods = Object.entries(weather.mods || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`).join(' · ') || 'none';
  const terrainMods = Object.entries(terrain.mods || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${typeof v === 'number' && Math.abs(v) < 2 ? `${Math.round(v * 100)}%` : v}`).join(' · ') || 'none';

  root.innerHTML = `<div style="position:relative;height:100%;min-height:420px;display:flex;flex-direction:column">
    <div class="card" style="margin:0;border-radius:0;flex:0 0 auto">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <strong>${esc(state.map.region || 'Borderlands')}</strong>
        <span>Moves ${mp}/${mpMax}</span>
      </div>
      <div class="dim">${esc(weather.n)} · ${esc(weatherMods)}</div>
      <div class="dim">${esc(terrain.n)} · ${esc(terrainMods)}</div>
      <div class="seg" style="margin-top:8px">
        <button type="button" class="btn sm" id="endDay">End day</button>
        <button type="button" class="btn sm" id="campBtn" ${mp < 1 ? 'disabled' : ''}>Camp</button>
        <button type="button" class="btn sm" id="zoomIn">+</button>
        <button type="button" class="btn sm" id="zoomOut">−</button>
      </div>
    </div>
    <div style="position:relative;flex:1;min-height:320px">
      <canvas id="mapcv" style="width:100%;height:100%;background:#0f131a;touch-action:none"></canvas>
      <div id="mapCard" class="map-node-card" hidden></div>
    </div>
  </div>`;

  const canvas = root.querySelector('#mapcv');
  const card = root.querySelector('#mapCard');
  const host = canvas.parentElement;

  root.querySelector('#endDay').onclick = () => api.dispatch({ type: 'end-day' });
  root.querySelector('#campBtn').onclick = () => api.dispatch({ type: 'camp' });
  root.querySelector('#zoomIn').onclick = () => {
    const bounds = mapBounds(host);
    applyZoom(mapCam, 1.2, { x: bounds.width / 2, y: bounds.height / 2 }, bounds);
    paint();
  };
  root.querySelector('#zoomOut').onclick = () => {
    const bounds = mapBounds(host);
    applyZoom(mapCam, 1 / 1.2, { x: bounds.width / 2, y: bounds.height / 2 }, bounds);
    paint();
  };

  const paint = () => drawMap(canvas, state, api, card);
  paint();
  stopMapObserve = observeCanvasHost(host, paint);
  bindMapGestures(canvas, host, state, api, card, paint);
}

function mapBounds(host) {
  const width = host.clientWidth || 375;
  const height = host.clientHeight || 420;
  return { width, height, worldW: width, worldH: height };
}

function showNodeCard(card, state, api, index) {
  const map = state.map;
  const n = map.nodes[index];
  if (!n) return;
  selectedMapNode = index;
  const hostP = calcHostPower(state.army, state.hero);
  const meta = NODE_META[n.type] || { n: n.type, tint: '#c9a227' };
  let verdict = '';
  let foeLine = 'Explore';
  if (n.foes?.length) {
    const fp = n.power || 1;
    verdict = verdictLabel(encounterVerdict(hostP, fp));
    const f = n.foes[0];
    foeLine = `${CREATURES[f.type]?.n || f.type} ×${f.count} · ${verdict}`;
  }
  const loot = n.reward
    ? Object.entries(n.reward).map(([k, v]) => `${v} ${k}`).join(', ')
    : (n.type === 'treasure' ? 'Gold cache' : '');
  const linked = index !== map.at && map.links[map.at]?.includes(index);
  const atHere = index === map.at;
  const mp = state.hero.mp || 0;

  const actions = [];
  if (linked) {
    actions.push(`<button type="button" class="btn gold" id="doTravel" ${mp < 1 ? 'disabled' : ''}>Travel</button>`);
  }
  if (atHere && !n.cleared) {
    if (n.type === 'creature' || n.type === 'boss') {
      actions.push('<button type="button" class="btn gold" id="doFight">Fight</button>');
    } else if (n.type === 'resource' || n.type === 'treasure') {
      actions.push('<button type="button" class="btn gold" id="doSearch">Search</button>');
    } else if (n.type === 'dwelling') {
      actions.push('<button type="button" class="btn gold" id="doHire">Hire</button>');
    } else if (n.type === 'ambush' || n.type === 'garrison') {
      actions.push('<button type="button" class="btn gold" id="doFight">Deploy</button>');
    } else {
      actions.push('<button type="button" class="btn gold" id="doSearch">Interact</button>');
    }
  }

  card.hidden = false;
  card.innerHTML = `<strong>${esc(meta.n)}</strong> · ${esc(TERRAIN[n.terrain]?.n || n.terrain || 'plains')}
    <div class="verdict-${(verdict || 'even').toLowerCase()}">${esc(foeLine)}</div>
    ${loot ? `<div class="dim">Loot: ${esc(loot)}</div>` : ''}
    <div class="seg" style="margin-top:8px">${actions.join('')}</div>`;

  card.querySelector('#doTravel')?.addEventListener('click', () => {
    selectedMapNode = null;
    card.hidden = true;
    api.dispatch({ type: 'travel', nodeIndex: index });
  });
  const resolve = () => {
    selectedMapNode = null;
    card.hidden = true;
    api.dispatch({ type: 'resolve-node' });
  };
  card.querySelector('#doFight')?.addEventListener('click', resolve);
  card.querySelector('#doSearch')?.addEventListener('click', resolve);
  card.querySelector('#doHire')?.addEventListener('click', resolve);
}

function drawMap(canvas, state, api, card) {
  const host = canvas.parentElement;
  const { ctx, cssW: w, cssH: h } = fitCanvas(canvas, host.clientWidth, host.clientHeight || 420);
  const map = state.map;
  const bounds = { width: w, height: h, worldW: w, worldH: h };
  clampCamera(mapCam, bounds);
  mapPulse = (mapPulse + 1) % 120;

  ctx.fillStyle = '#1a2230';
  ctx.fillRect(0, 0, w, h);

  const frame = mapBiomeFrame(map);
  if (mapAtlas) {
    // Letterbox: draw biome filling world, then camera crops
    const origin = worldToScreen({ x: 0, y: 0 }, mapCam);
    drawFrame(ctx, mapAtlas, frame, origin.x, origin.y, w * mapCam.scale, h * mapCam.scale);
  }

  const story = findStoryPath(map);

  ctx.lineWidth = Math.max(2, 2 * mapCam.scale);
  map.links.forEach((arr, i) => {
    for (const j of arr) {
      if (j <= i) continue;
      const a = nodeWorld(map.nodes[i], w, h);
      const b = nodeWorld(map.nodes[j], w, h);
      const sa = worldToScreen(a, mapCam);
      const sb = worldToScreen(b, mapCam);
      const key = `${i}-${j}`;
      const isStory = story.has(key);
      ctx.strokeStyle = isStory ? '#c9a227' : 'rgba(154,163,178,0.35)';
      ctx.lineWidth = isStory ? Math.max(3, 3 * mapCam.scale) : Math.max(2, 2 * mapCam.scale);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      if (isStory) {
        ctx.quadraticCurveTo((sa.x + sb.x) / 2, Math.min(sa.y, sb.y) - 18 * mapCam.scale, sb.x, sb.y);
      } else {
        ctx.lineTo(sb.x, sb.y);
      }
      ctx.stroke();
    }
  });

  const minR = 14; // keep tap-sized on screen
  map.nodes.forEach((n, i) => {
    const wp = nodeWorld(n, w, h);
    const sp = worldToScreen(wp, mapCam);
    const meta = NODE_META[n.type] || NODE_META.creature;
    let r = Math.max(minR, (i === map.at ? 12 : 9) * mapCam.scale);
    if (i === map.at && !reducedMotion()) {
      r += Math.sin(mapPulse / 8) * 2;
    }
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
    ctx.fillStyle = n.cleared ? '#3a4558' : meta.tint;
    ctx.fill();
    if (i === map.at) {
      ctx.strokeStyle = '#e8e4d9';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Type glyph
    ctx.fillStyle = '#0f131a';
    ctx.font = `bold ${Math.max(9, Math.min(12, r))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = (meta.n || '?')[0];
    ctx.fillText(glyph, sp.x, sp.y);
  });

  // Re-render (1s tick) must keep the card open
  if (selectedMapNode != null && map.nodes[selectedMapNode]) {
    showNodeCard(card, state, api, selectedMapNode);
  }
}

function bindMapGestures(canvas, host, state, api, card, paint) {
  let pointers = new Map();
  let lastPinch = 0;
  let panning = false;
  let moved = false;

  const boundsOf = () => mapBounds(host);

  canvas.onpointerdown = (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    panning = false;
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      lastPinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };

  canvas.onpointermove = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastPinch > 0) {
        const rect = canvas.getBoundingClientRect();
        const focal = { x: (pts[0].x + pts[1].x) / 2 - rect.left, y: (pts[0].y + pts[1].y) / 2 - rect.top };
        applyZoom(mapCam, dist / lastPinch, focal, boundsOf());
        paint();
      }
      lastPinch = dist;
      moved = true;
      return;
    }

    if (Math.hypot(dx, dy) > 8 || panning) {
      panning = true;
      moved = true;
      applyPan(mapCam, dx, dy, boundsOf());
      paint();
    }
  };

  const endPtr = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = 0;
  };
  canvas.onpointerup = endPtr;
  canvas.onpointercancel = endPtr;

  canvas.onclick = (e) => {
    if (moved || panning) return;
    const { ctx, cssW: w, cssH: h } = fitCanvas(canvas, host.clientWidth, host.clientHeight || 420);
    void ctx;
    const pt = cssPoint(canvas, e.clientX, e.clientY);
    const world = screenToWorld(pt, mapCam);
    const map = state.map;
    let best = -1;
    let bestD = Math.max(22, 18 * mapCam.scale);
    map.nodes.forEach((n, i) => {
      const wp = nodeWorld(n, w, h);
      const d = Math.hypot(wp.x - world.x, wp.y - world.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best < 0) return;
    if (best !== map.at && map.links[map.at]?.includes(best)) {
      if ((state.hero.mp || 0) <= 0) {
        api.toast?.('No moves left — end the day.');
        showNodeCard(card, state, api, best);
        return;
      }
      selectedMapNode = null;
      api.dispatch({ type: 'travel', nodeIndex: best });
      return;
    }
    showNodeCard(card, state, api, best);
  };
}

export function renderWar(root, state, api) {
  const power = calcHostPower(state.army, state.hero);
  const empty = !state.army.length;
  const siegePending = (state.profile?.sieges || 0) < (state.age + 1) * 2;
  let recTitle = 'Random duel';
  let recSub = 'A quick field battle against roaming foes.';
  let recAction = 'duel';
  if (siegePending) {
    recTitle = 'Campaign siege';
    recSub = 'Hold the lane — recommended next war.';
    recAction = 'siege';
  } else if (state.map?.nodes) {
    const linked = (state.map.links[state.map.at] || [])
      .map((i) => state.map.nodes[i])
      .find((n) => n && !n.cleared && (n.type === 'creature' || n.type === 'boss'));
    if (linked) {
      const v = verdictLabel(encounterVerdict(power, linked.power || 1));
      recTitle = `Map fight · ${v}`;
      recSub = `${NODE_META[linked.type]?.n || linked.type} near your party.`;
      recAction = 'map';
    }
  }

  const duelCode = (() => {
    try {
      return encodeChallenge({
        seed: (state.profile.battles || 1) * 99 + state.day,
        age: state.age,
        player: state.army.map((s) => ({ ...s, ...unitStats(s) })),
        enemy: [{ id: 'duel', kind: 'creature', type: 'wolf', count: 8 + state.age, ...unitStats({ kind: 'creature', type: 'wolf', count: 8, age: state.age }) }],
      });
    } catch {
      return '';
    }
  })();

  root.innerHTML = `
    <div class="card" style="border-left:3px solid var(--gold)">
      <h3>${esc(recTitle)}</h3>
      <p>${esc(recSub)}</p>
      <button type="button" class="btn gold" data-a="${recAction}" ${empty && recAction !== 'siege' ? 'disabled' : ''}>Begin</button>
      ${empty ? '<p class="dim">Recruit troops on Host before field battles.</p>' : ''}
    </div>
    <div class="card"><h3>Campaign</h3>
      <button type="button" class="btn" data-a="siege">Campaign siege</button>
      <button type="button" class="btn" data-a="skirmish">Skirmish (no spoils)</button>
    </div>
    <div class="card"><h3>Duel</h3>
      <button type="button" class="btn" data-a="duel" ${empty ? 'disabled' : ''}>Random duel</button>
      <button type="button" class="btn" data-a="rival" ${empty ? 'disabled' : ''}>Challenge ${esc(state.rival?.name || 'Rival')}</button>
    </div>
    <div class="card"><h3>Endless</h3>
      <p>Best wave: ${state.endlessBest || 0}</p>
      <button type="button" class="btn" data-a="endless">Endless siege</button>
    </div>
    <div class="card"><h3>Async duel seed</h3>
      <p class="dim" style="word-break:break-all">${esc(duelCode.slice(0, 80))}…</p>
      <button type="button" class="btn" data-a="share">Share seed</button>
      <input id="seedIn" style="width:100%;min-height:44px;margin:8px 0;background:#0f131a;color:#e8e4d9;border:1px solid #3a4558;border-radius:8px;padding:8px" placeholder="Paste AOD1… code" />
      <button type="button" class="btn" data-a="replay" ${empty ? 'disabled' : ''}>Replay seed as fight</button>
    </div>`;

  root.querySelectorAll('[data-a]').forEach((b) => {
    const a = b.dataset.a;
    if (a === 'siege') b.onclick = () => api.startSiege({ mode: 'camp' });
    else if (a === 'skirmish') b.onclick = () => api.startSiege({ mode: 'skirmish' });
    else if (a === 'duel') b.onclick = () => api.startDuel();
    else if (a === 'endless') b.onclick = () => api.startSiege({ mode: 'endless' });
    else if (a === 'rival') b.onclick = () => api.dispatch({ type: 'rival-duel' });
    else if (a === 'map') b.onclick = () => api.goMap?.();
    else if (a === 'share') b.onclick = () => api.shareDuel?.(duelCode);
    else if (a === 'replay') b.onclick = () => api.replaySeed(root.querySelector('#seedIn').value.trim());
  });
}

export function renderMore(root, state, api) {
  const lines = standingLines(state.story?.flags || {});
  const ready = checkMilestones(state);
  const prefs = state.uiPrefs || {};
  root.innerHTML = `
    <div class="card"><h3>Quests</h3>
      ${(state.quests || []).map((q) => `<div class="unit-card">${esc(q.n)}         ${q.done ? '<span class="dim">[done]</span>' : '<span class="dim">in progress</span>'}
      </div>`).join('') || '<p>None</p>'}
    </div>
    <div class="card"><h3>Milestones</h3>
      ${MILESTONES.map((m) => {
        const claimed = (state.claimedMilestones || []).includes(m.id);
        const can = ready.includes(m.id);
        return `<div class="unit-card">${esc(m.n)} ${claimed ? '[claimed]' : ''}
          ${can && !claimed ? `<button type="button" class="btn sm" data-ms="${m.id}">Claim</button>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="card"><h3>Chronicle</h3>
      ${(state.story?.log || []).map((l) => `<p>${esc(l)}</p>`).join('') || '<p>No entries yet.</p>'}
      ${lines.map((l) => `<p class="dim">${esc(l)}</p>`).join('')}
      ${(state.story?.ch ?? 0) < 99 ? `<button type="button" class="btn" data-a="chapter">Read chapter</button>` : ''}
    </div>
    <div class="card"><h3>Rival</h3>
      <p>${esc(state.rival?.name || 'Unknown')} — encounters ${state.rival?.encounters || 0}, defeats ${state.rival?.defeated || 0}</p>
      <button type="button" class="btn" data-a="shareAch">Share standing</button>
      <button type="button" class="btn" data-a="rivalMap">Face on Map / War</button>
    </div>
    ${state.age >= 1 ? `<div class="card"><h3>Bronze Market</h3>
      <p>Trade 100 of one resource for 80 of another (frozen rates).</p>
      <button type="button" class="btn" data-trade="food,gold">Food → Gold</button>
      <button type="button" class="btn" data-trade="wood,stone">Wood → Stone</button>
      <button type="button" class="btn" data-trade="gold,food">Gold → Food</button>
    </div>` : ''}
    <div class="card"><h3>Settings</h3>
      <button type="button" class="btn" data-a="save">Save now</button>
      <button type="button" class="btn" data-a="export">Export backup</button>
      <label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" id="hap" ${prefs.haptics !== false ? 'checked' : ''}/> Haptics</label>
      <label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" id="mus" ${prefs.music !== false ? 'checked' : ''}/> Music</label>
      <label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" id="sfx" ${prefs.sfx !== false ? 'checked' : ''}/> Effects</label>
      <button type="button" class="btn" data-a="title">Return to title</button>
    </div>`;
  root.querySelector('[data-a="save"]').onclick = () => api.saveNow();
  root.querySelector('[data-a="export"]').onclick = () => api.exportSave();
  root.querySelector('[data-a="title"]').onclick = () => api.toTitle();
  root.querySelector('[data-a="shareAch"]')?.addEventListener('click', () => api.shareStanding?.());
  root.querySelector('[data-a="rivalMap"]')?.addEventListener('click', () => api.goWar?.());
  root.querySelector('[data-a="chapter"]')?.addEventListener('click', () => api.openChapter?.());
  root.querySelector('#hap').onchange = (e) => api.dispatch({ type: 'set-pref', key: 'haptics', value: e.target.checked });
  root.querySelector('#mus').onchange = (e) => api.dispatch({ type: 'set-pref', key: 'music', value: e.target.checked });
  root.querySelector('#sfx').onchange = (e) => api.dispatch({ type: 'set-pref', key: 'sfx', value: e.target.checked });
  root.querySelectorAll('[data-ms]').forEach((b) => b.addEventListener('click', () => api.dispatch({ type: 'claim-milestone', id: b.dataset.ms })));
  root.querySelectorAll('[data-trade]').forEach((b) => {
    const [from, to] = b.dataset.trade.split(',');
    b.onclick = () => api.dispatch({ type: 'market-trade', from, to, amount: 100 });
  });
}

export function renderBuildingsSheet(state) {
  return `<h3>Your realm</h3>${Object.keys(BUILDINGS).map((id) => {
    const B = BUILDINGS[id];
    const lvl = blOf(state.bld, id);
    const cost = bcost(id, lvl);
    const ok = canPay(state.res, cost);
    return `<div class="card"><strong>${B.n}</strong> Lv ${lvl}<div>${B.d}</div>
      <button type="button" class="btn ${ok ? 'gold' : ''}" data-build="${id}" ${ok ? '' : 'disabled'}>${lvl ? 'Upgrade' : 'Build'}</button></div>`;
  }).join('')}`;
}

export { renderBuildingPanel, getTodayBeat };

export function agePrompt(state) {
  return calcAgeUpPrompt(state.age, blOf(state.bld, 'townhall'), state.res, ageUpCost(state.age));
}

export function resBarHtml(state) {
  const r = rates(state.bld);
  return ['food', 'wood', 'stone', 'gold'].map((k) => `
    <button type="button" class="reschip" data-res="${k}" role="button">
      <span>${iconMarkup(k, { size: 14, label: k })} <span class="n">${Math.floor(state.res[k] || 0)}</span></span>
      <span class="r">+${(r[k] || 0).toFixed(2)}/s</span>
    </button>`).join('');
}
