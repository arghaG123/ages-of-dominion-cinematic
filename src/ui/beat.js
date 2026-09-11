import { AGES, BUILDINGS, CREATURES } from '../data/index.js';
import { rates, bcost, canPay, blOf, ageUpCost } from '../rules/economy.js';
import { calcHostPower, encounterVerdict, verdictLabel } from '../rules/encounters.js';
import { esc } from '../util.js';
import { iconMarkup } from './icons.js';

/** Plot labels for empty pads / first-session guidance (presentation only). */
export const PLOT_HINTS = {
  townhall: { label: 'Town square', hint: 'centre of the village' },
  farm: { label: 'Open field', hint: 'far-left field' },
  lumber: { label: 'Woodland edge', hint: 'far-right treeline' },
  quarry: { label: 'Rocky ground', hint: 'rocky plot, near-left' },
  mine: { label: 'Hillside', hint: 'hillside, near-right' },
  barracks: { label: 'Parade ground', hint: 'upper parade' },
  workshop: { label: 'Work yard', hint: 'right work yard' },
  hall: { label: 'Meeting ground', hint: 'north hall plot' },
  armory: { label: 'Forge yard', hint: 'inner forge yard' },
  walls: { label: 'Gate', hint: 'southern gate' },
};

export function costStr(cost) {
  if (!cost) return '';
  return Object.entries(cost)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${Math.ceil(v)} ${k}`)
    .join(' · ');
}

export function buildingDelta(id, lvl) {
  switch (id) {
    case 'farm':
      return `+${(lvl * 0.55).toFixed(2)} → +${((lvl + 1) * 0.55).toFixed(2)}/s food`;
    case 'lumber':
      return `+${(lvl * 0.45).toFixed(2)} → +${((lvl + 1) * 0.45).toFixed(2)}/s wood`;
    case 'quarry':
      return `+${(lvl * 0.35).toFixed(2)} → +${((lvl + 1) * 0.35).toFixed(2)}/s stone`;
    case 'mine':
      return `+${(lvl * 0.25).toFixed(2)} → +${((lvl + 1) * 0.25).toFixed(2)}/s gold`;
    case 'barracks':
      return `Army slots: ${2 + lvl} → ${3 + lvl}`;
    case 'workshop':
      return `Tower slots: ${2 + lvl} → ${3 + lvl}`;
    case 'walls':
      return `Core HP: +${180 * lvl} → +${180 * (lvl + 1)}`;
    case 'hall':
      return `Hero XP: +${lvl * 15}% → +${(lvl + 1) * 15}%`;
    case 'townhall':
      return `Town Hall ${lvl} → ${lvl + 1}`;
    case 'armory':
      return `Forge quality: Tier ${Math.min(4, Math.floor(lvl / 2) + 1)} gear`;
    default:
      return '';
  }
}

export function timeToAfford(c, S, r) {
  if (!c || !S) return '';
  const currentRes = S.res || {};
  let maxSec = 0;
  let hasMissingNoRate = false;
  for (const k in c) {
    const need = c[k] || 0;
    const have = currentRes[k] || 0;
    if (have < need) {
      const deficit = need - have;
      const rate = (r && r[k]) ? r[k] : 0;
      if (rate <= 0) hasMissingNoRate = true;
      else maxSec = Math.max(maxSec, deficit / rate);
    }
  }
  if (maxSec === 0 && !hasMissingNoRate) return 'Ready to build';
  if (hasMissingNoRate && maxSec === 0) return 'Waiting for production';
  const s = Math.ceil(maxSec);
  if (s < 60) return `Ready in ${s}s`;
  if (s < 3600) return `Ready in ${Math.floor(s / 60)}m ${s % 60}s`;
  return `Ready in ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function ageUpReqText(S) {
  if (!S || S.age >= 6) return 'You command the Modern Age.';
  const need = S.age + 2;
  const th = blOf(S.bld, 'townhall');
  const c = ageUpCost(S.age);
  if (th < need) return `Town Hall level ${need} required — yours is ${th}`;
  if (!canPay(S.res, c)) {
    const missing = [];
    for (const k in c) {
      if ((S.res[k] || 0) < c[k]) missing.push(`${Math.ceil(c[k] - (S.res[k] || 0))} ${k}`);
    }
    return `Need ${missing.join(', ')} to advance`;
  }
  return `Ready to advance to ${AGES[S.age + 1].n}`;
}

/**
 * Original getTodayBeat priority: Collect → affordable spine spend → Fight → March.
 * Collect uses pendingHarvest when present (offline sheet can set it).
 */
export function getTodayBeat(S) {
  if (!S) return { title: 'Begin', sub: 'Start a realm' };

  if (S.pendingHarvest) {
    return {
      beat: 'Collect',
      title: 'Harvest at the Gate',
      sub: 'Gather stored production from while you were away.',
      action: 'collect',
    };
  }

  if ((S.builds || []).length) {
    return { beat: 'Building', title: 'Building…', sub: 'Scaffolding at work' };
  }

  const bl = (id) => blOf(S.bld, id);
  const spendTargets = [];
  if (bl('quarry') === 0) spendTargets.push('quarry');
  else if (bl('mine') === 0) spendTargets.push('mine');
  else if (bl('townhall') < (S.age || 0) + 2) spendTargets.push('townhall');

  for (const id of spendTargets) {
    const cost = bcost(id, bl(id));
    if (canPay(S.res, cost)) {
      const bDef = BUILDINGS[id];
      const name = bDef?.n || id;
      const hint = PLOT_HINTS[id]?.hint;
      const title = bl(id) === 0 ? `Raise a ${name}` : `Upgrade ${name} to Lv ${bl(id) + 1}`;
      const firstHint = S.age === 0 && id === 'quarry' && bl(id) === 0
        ? `Tap the ${hint || 'rocky plot'}.`
        : (hint ? `Tap the ${hint}.` : 'One build this session, then march.');
      return {
        beat: 'Spend',
        title,
        sub: firstHint,
        buildingId: id,
        action: { type: 'open-building', buildingId: id },
      };
    }
  }

  // Age-up blocker stays on realmAgeUp chrome via ageUpReqText / calcAgeUpPrompt

  if (S.map?.nodes?.[S.map.at]) {
    const atNode = S.map.nodes[S.map.at];
    const linked = (atNode.link || S.map.links?.[S.map.at] || [])
      .map((id) => S.map.nodes[id])
      .filter(Boolean);
    const hostPow = calcHostPower(S.army, S.hero);
    const winnable = linked.find((n) => !n.cleared && !n.done && (n.type === 'creature' || n.type === 'boss') && (n.foes || n.pack));
    if (winnable) {
      const power = winnable.power || winnable.pack?.power || 1;
      const v = encounterVerdict(hostPow, power);
      const main = winnable.foes?.[0] || winnable.pack?.stacks?.[0];
      const foe = main ? (CREATURES[main.type]?.n || 'creatures') : 'creatures';
      return {
        beat: 'Fight',
        title: `Engage ${foe}`,
        sub: `Nearest site on Map (${verdictLabel(v)}).`,
        tab: 'map',
      };
    }
  }

  if (!S.map) {
    return { beat: 'March', title: 'March the Map', sub: 'Scout the valleys beyond your walls.', tab: 'map' };
  }

  return {
    beat: 'March',
    title: 'March the Map',
    sub: 'Explore borderlands for spoils.',
    tab: 'map',
  };
}

/** Single-building sheet body (Build/Upgrade wired by caller). */
export function renderBuildingPanel(state, id) {
  const B = BUILDINGS[id];
  if (!B) return `<h3>Unknown plot</h3>`;
  const lvl = blOf(state.bld, id);
  const cost = bcost(id, lvl);
  const affordable = canPay(state.res, cost);
  const delta = buildingDelta(id, lvl);
  const r = rates(state.bld);
  const affordTime = affordable ? 'Ready to build' : timeToAfford(cost, state, r);
  const plot = PLOT_HINTS[id];
  const building = (state.builds || []).find((b) => b.buildingId === id);
  return `<h3>${iconMarkup(B.ic, { size: 18, label: B.n })} ${esc(B.n)}</h3>
    <p>${lvl ? `Level ${lvl} → ${lvl + 1}` : '<span class="dim">Not yet built</span>'}</p>
    ${delta ? `<p style="color:var(--gold2)">${esc(delta)}</p>` : ''}
    <p class="dim">${esc(B.d)}</p>
    ${plot ? `<p class="dim">${esc(plot.label)}${plot.hint ? ` · ${esc(plot.hint)}` : ''}</p>` : ''}
    <p class="cost">${esc(costStr(cost))}</p>
    <p class="dim" style="color:var(--gold2)">${building ? 'Under construction…' : esc(affordTime)}</p>
    <button type="button" class="btn ${affordable && !building ? 'gold' : ''}" data-build="${id}" ${affordable && !building ? '' : 'disabled'}>
      ${lvl ? 'Upgrade' : 'Build'}
    </button>
    <button type="button" class="btn" data-close-sheet>Close</button>`;
}
