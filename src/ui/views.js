import {
  CLASSES, BUILDINGS, ROLES, RANKS, SKILLS, SPELLS, SLOTS, MILESTONES,
} from '../data/index.js';
import { rates, bcost, canPay, armySlots, blOf, ageUpCost, calcAgeUpPrompt } from '../rules/economy.js';
import { unitStats } from '../rules/units.js';
import { calcHostPower, encounterVerdict, verdictLabel } from '../rules/encounters.js';
import { standingLines } from '../state/storyFlags.js';
import { checkMilestones } from '../state/milestones.js';
import { encodeChallenge } from '../rules/combat.js';
import { iconMarkup } from './icons.js';
import { esc } from '../util.js';
import { fitCanvas } from '../render/canvas.js';
import { ensureAtlas, drawFrame } from '../render/atlas.js';
import { AGES } from '../data/index.js';

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
      <p>Atk ${H.atk} Def ${H.def} Pow ${H.pow} Kno ${H.kno}</p>
      <p class="dim">Mana ${H.mana} · Moves ${H.mp}/${H.mpMax}</p>
      ${(H.pts || 0) > 0 ? `<div class="seg">${['atk', 'def', 'pow', 'kno'].map((k) => `<button type="button" class="btn sm" data-a="stat" data-k="${k}">+${k}</button>`).join('')}</div>` : ''}
    </div>
    <div class="card"><h3>Skills</h3>
      ${Object.keys(SKILLS).map((k) => {
        const lv = H.skills?.[k] || 0;
        return `<div class="unit-card">${SKILLS[k].n} · Lv ${lv}
          ${(H.pts || 0) > 0 && lv < 3 ? `<button type="button" class="btn sm" data-a="skill" data-k="${k}">Train</button>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="card"><h3>Spells</h3>
      ${(H.spells || []).map((id) => `<span class="dim">${SPELLS[id]?.n || id}</span>`).join(' · ') || 'None'}
    </div>
    <div class="card"><h3>Equipment</h3>
      ${SLOTS.map((s) => {
        const item = H.equip?.[s.k];
        return `<div class="unit-card">${s.n}: ${item ? esc(item.n || item.id) : 'Empty'}</div>`;
      }).join('')}
      <button type="button" class="btn" data-a="forge">Forge at Armory</button>
      ${(H.bag || []).map((it, i) => `<div class="unit-card">${esc(it.name || it.n || it.id)}
        <button type="button" class="btn sm" data-a="equip" data-i="${i}">Equip</button></div>`).join('')}
    </div>`;
  } else {
    html += `<div class="card"><h3>Host strength <span class="power">${power}</span></h3>
      <p>Slots ${state.army.length}/${armySlots(state.bld)}</p></div>`;
    if (!state.army.length) {
      html += `<div class="card"><p>Your roster is empty. Recruit below.</p></div>`;
    }
    html += state.army.map((s) => {
      const st = unitStats(s);
      return `<div class="card unit-card"><strong>${esc(st?.n || s.type)}</strong> ×${s.count}
        <div>${RANKS[s.rank || 0]?.n || 'RECRUIT'} · XP ${s.xp || 0}</div>
        <button type="button" class="btn sm" data-a="reinf" data-id="${s.id}">Reinforce</button>
      </div>`;
    }).join('');
    html += `<div class="card"><h3>Recruit</h3>${Object.keys(ROLES).map((k) => {
      const r = ROLES[k];
      return `<button type="button" class="btn" data-a="recruit" data-type="${k}">${r.names[state.age]}</button>`;
    }).join(' ')}</div>`;
  }
  root.innerHTML = html;
  root.querySelectorAll('[data-seg]').forEach((b) => b.addEventListener('click', () => api.setHostSeg(b.dataset.seg)));
  root.querySelectorAll('[data-a="recruit"]').forEach((b) => b.addEventListener('click', () => api.dispatch({ type: 'recruit', unitType: b.dataset.type })));
  root.querySelectorAll('[data-a="reinf"]').forEach((b) => b.addEventListener('click', () => api.dispatch({ type: 'reinforce', stackId: b.dataset.id })));
  root.querySelectorAll('[data-a="stat"]').forEach((b) => b.addEventListener('click', () => api.dispatch({ type: 'spend-stat', stat: b.dataset.k })));
  root.querySelectorAll('[data-a="skill"]').forEach((b) => b.addEventListener('click', () => api.dispatch({ type: 'learn-skill', skill: b.dataset.k })));
  root.querySelector('[data-a="forge"]')?.addEventListener('click', () => {
    const slot = SLOTS[0]?.k || 'weapon';
    api.dispatch({ type: 'forge', slot });
  });
  root.querySelectorAll('[data-a="equip"]').forEach((b) => b.addEventListener('click', () => {
    api.dispatch({ type: 'equip', index: Number(b.dataset.i) });
  }));
  const cv = root.querySelector('#herocv');
  if (cv) drawHeroPreview(cv, state.hero.cls);
}

async function drawHeroPreview(canvas, cls) {
  const { ctx, cssW: w, cssH: h } = fitCanvas(canvas, canvas.clientWidth || 220, canvas.clientHeight || 280);
  ctx.fillStyle = '#12151b';
  ctx.fillRect(0, 0, w, h);
  try {
    const atlas = await ensureAtlas('hero');
    drawFrame(ctx, atlas, `${cls}-portrait`, 16, 16, w - 32, h - 32);
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

export function renderMap(root, state, api) {
  if (!state.map) {
    root.innerHTML = `<div class="card"><h3>Region map</h3><p>Scout the valleys beyond your walls.</p>
      <button type="button" class="btn gold" id="genMap">March forth</button></div>`;
    root.querySelector('#genMap')?.addEventListener('click', () => api.dispatch({ type: 'gen-map' }));
    return;
  }
  root.innerHTML = `<div style="position:relative;height:100%;min-height:420px">
    <canvas id="mapcv" style="width:100%;height:100%;background:#0f131a"></canvas>
    <div id="mapCard" class="map-node-card" hidden></div>
  </div>`;
  const canvas = root.querySelector('#mapcv');
  const card = root.querySelector('#mapCard');
  drawMap(canvas, state, api, card);
}

function drawMap(canvas, state, api, card) {
  const host = canvas.parentElement;
  const { ctx, cssW: w, cssH: h } = fitCanvas(canvas, host.clientWidth, host.clientHeight || 420);
  const map = state.map;
  ctx.fillStyle = '#1a2230';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(154,163,178,0.35)';
  ctx.lineWidth = 2;
  map.links.forEach((arr, i) => {
    for (const j of arr) {
      if (j <= i) continue;
      const a = map.nodes[i], b = map.nodes[j];
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }
  });

  const next = map.nodes.findIndex((n, i) => i !== map.at && !n.cleared && map.links[map.at]?.includes(i));
  if (next >= 0) {
    const a = map.nodes[map.at], b = map.nodes[next];
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x * w, a.y * h);
    ctx.quadraticCurveTo((a.x + b.x) * w / 2, Math.min(a.y, b.y) * h - 20, b.x * w, b.y * h);
    ctx.stroke();
  }

  const hostP = calcHostPower(state.army, state.hero);
  map.nodes.forEach((n, i) => {
    const x = n.x * w, y = n.y * h;
    ctx.beginPath();
    ctx.arc(x, y, i === map.at ? 12 : 9, 0, Math.PI * 2);
    ctx.fillStyle = n.cleared ? '#3a4558' : (n.type === 'boss' ? '#8a3a32' : '#c9a227');
    ctx.fill();
    if (i === map.at) {
      ctx.strokeStyle = '#e8e4d9';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  canvas.onclick = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    let best = -1, bestD = 0.05;
    map.nodes.forEach((n, i) => {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best < 0) return;
    const n = map.nodes[best];
    if (best !== map.at && map.links[map.at]?.includes(best)) {
      api.dispatch({ type: 'travel', nodeIndex: best });
      return;
    }
    if (best === map.at) {
      let verdict = '';
      if (n.foes) {
        const fp = n.power || 1;
        verdict = verdictLabel(encounterVerdict(hostP, fp));
      }
      card.hidden = false;
      card.innerHTML = `<strong>${n.type}</strong> · ${n.terrain || 'plains'}
        <div class="verdict-${(verdict || 'even').toLowerCase()}">${n.foes ? `${n.foes[0].count} foes · ${verdict} fight` : 'Explore'}</div>
        <button type="button" class="btn gold" id="doNode">Interact</button>`;
      card.querySelector('#doNode').onclick = () => api.dispatch({ type: 'resolve-node' });
    }
  };
}

export function renderWar(root, state, api) {
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
    <div class="card"><h3>Next battle</h3>
      <p>Campaign siege or a quick duel.</p>
      <button type="button" class="btn gold" data-a="siege">Campaign siege</button>
    </div>
    <div class="card"><h3>Duel</h3>
      <button type="button" class="btn" data-a="duel">Random duel</button>
      <button type="button" class="btn" data-a="rival">Challenge ${esc(state.rival?.name || 'Rival')}</button>
    </div>
    <div class="card"><h3>Endless</h3>
      <p>Best wave: ${state.endlessBest || 0}</p>
      <button type="button" class="btn" data-a="endless">Endless siege</button>
    </div>
    <div class="card"><h3>Async duel seed</h3>
      <p class="dim" style="word-break:break-all">${esc(duelCode.slice(0, 80))}…</p>
      <button type="button" class="btn" data-a="share">Share seed</button>
      <input id="seedIn" style="width:100%;min-height:44px;margin:8px 0;background:#0f131a;color:#e8e4d9;border:1px solid #3a4558;border-radius:8px;padding:8px" placeholder="Paste AOD1… code" />
      <button type="button" class="btn" data-a="replay">Replay seed</button>
    </div>`;
  root.querySelector('[data-a="siege"]').onclick = () => api.startSiege({ mode: 'camp' });
  root.querySelector('[data-a="duel"]').onclick = () => api.startDuel();
  root.querySelector('[data-a="endless"]').onclick = () => api.startSiege({ mode: 'endless' });
  root.querySelector('[data-a="rival"]').onclick = () => api.dispatch({ type: 'rival-duel' });
  root.querySelector('[data-a="share"]').onclick = () => api.shareDuel?.(duelCode);
  root.querySelector('[data-a="replay"]').onclick = () => api.replaySeed(root.querySelector('#seedIn').value.trim());
}

export function renderMore(root, state, api) {
  const lines = standingLines(state.story?.flags || {});
  const ready = checkMilestones(state);
  const prefs = state.uiPrefs || {};
  root.innerHTML = `
    <div class="card"><h3>Quests</h3>
      ${(state.quests || []).map((q) => `<div>${esc(q.n)} ${q.done ? '[done]' : ''}</div>`).join('') || '<p>None</p>'}
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
    </div>
    <div class="card"><h3>Rival</h3>
      <p>${esc(state.rival?.name || 'Unknown')} — encounters ${state.rival?.encounters || 0}, defeats ${state.rival?.defeated || 0}</p>
      <button type="button" class="btn" data-a="shareAch">Share standing</button>
    </div>
    ${state.age >= 1 ? `<div class="card"><h3>Bronze Market</h3>
      <p>Trade 100 of one resource for 80 of another.</p>
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
      <button type="button" class="btn ${ok ? 'gold' : ''}" data-build="${id}" ${ok ? '' : 'disabled'}>Upgrade</button></div>`;
  }).join('')}`;
}

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
