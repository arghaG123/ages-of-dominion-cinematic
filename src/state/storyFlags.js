/**
 * Story-flag payoffs. Flags are written by chapters and map events; this
 * module is where they are read. Lives outside src/data so the parity tables
 * stay untouched.
 */
import { clamp } from '../util.js';

const FLAG_ORDER = [
  'generous', 'ruthless', 'creature',
  'indebted', 'independent',
  'defender', 'conqueror',
  'council', 'crown',
  'gunline', 'cautious',
  'industry', 'green', 'final',
];

/** Later-chapter asides. Keyed by the chapter about to open. */
const ECHOES = {
  1: {
    generous: 'The strangers who ate at your first fire work the bellows now. They ask what the trader’s terms will cost their children.',
    ruthless: 'Nobody in the smelter-yard asks about the flint. They watch the trader’s hands, and yours.',
    creature: 'A tamed beast sleeps against the furnace mouth. The trader pretends not to see it.',
  },
  2: {
    generous: 'Scouts say the three valleys still set a place for you at the fire.',
    ruthless: 'The warlords already use your name as a warning. The maps came with a cost.',
    indebted: 'The downriver debt is already a rumor in the passes.',
    independent: 'The ore in your own hills is why these maps matter.',
    creature: 'Wild things already screen your flanks. The warlords have noticed.',
  },
  3: {
    generous: 'The old families remember the fire. They will sit, if you let them.',
    ruthless: 'The captains remember the flint. They will not vote against a throne.',
    defender: 'The passes you walled are why they call you sovereign now.',
    conqueror: 'The warlord’s valley still answers to your banner. The old families have noticed.',
    creature: 'Beasts keep the gate. A council would have to look them in the eye.',
  },
  4: {
    council: 'The council will want a vote on the jar. They will take a season to have it.',
    crown: 'No one will vote on the jar. They wait on you.',
    defender: 'Walls that took a century to raise now have a countdown on them — including yours.',
    conqueror: 'Powder for the next march. The nearest banner will hear it first.',
  },
  5: {
    gunline: 'Thunder already speaks from your towers. Rail is the next voice.',
    cautious: 'You buried one recipe. The furnaces are asking for another.',
    council: 'The council wants the valleys spared and the rail laid. Both, they say.',
    crown: 'The screen is not built yet, but the chair at the end of it is already yours.',
  },
  6: {
    industry: 'The furnaces never cooled. The last banner is a light on the glass.',
    green: 'You spared the valleys. The last banner did not.',
    generous: 'From a cave mouth to a screen, they still tell the story of the fire.',
    ruthless: 'From a cave mouth to a screen, they still tell the story of the flint.',
  },
};

const TOASTS = {
  generous: 'They will remember the fire.',
  ruthless: 'The valley learned your banner.',
  indebted: 'The bronze is coming. So is the bill.',
  independent: 'The ore will be yours, and slower.',
  defender: 'The passes will have walls.',
  conqueror: 'The nearest warlord is next.',
  council: 'The old families take their seats.',
  crown: 'No one argued twice.',
  gunline: 'The towers will learn thunder.',
  cautious: 'The jar goes into the dark.',
  industry: 'The furnaces stay lit.',
  green: 'The old valleys stay green.',
  final: 'The age is yours.',
};

const PAYOFFS = {
  generous: 'Towns share food. Wild things come more readily, and dens hire cheaper.',
  ruthless: 'Towns pay a levy. Beasts rarely join — you take hides instead. Dens do not haggle.',
  indebted: 'Downriver still holds a note with your mark.',
  independent: 'Caches of stone and wood run richer. You dug your own.',
  defender: 'Towns send stone for the walls. Sieges pay in masonry.',
  conqueror: 'Hoards and warlords pay more. The nearest valley already knows.',
  council: 'Towns send grain. Deeper roots, slower gold.',
  crown: 'Towns send gold. No one argues twice about a levy.',
  gunline: 'Victories pay extra gold. Thunder is expensive to keep fed.',
  cautious: 'Towns send stone. You are provisioned for a long wait.',
  industry: 'Gold from the rail-yards. The furnaces never cooled.',
  green: 'Food from the spared valleys.',
  final: 'The last banner came down. The age is yours.',
};

export function standingLines(flags = {}) {
  const lines = [];
  if (flags.generous && flags.ruthless) {
    lines.push('You have been both kind and cruel. The valley keeps both stories.');
  } else if (flags.generous) {
    lines.push('Word of the shared fire still travels ahead of you.');
  } else if (flags.ruthless) {
    lines.push('They still speak of the flint you took.');
  }
  if (flags.creature) lines.push('Wild things have fought under your banner.');
  if (flags.indebted) lines.push('Downriver still holds a note with your mark.');
  if (flags.independent) lines.push('The ore in your hills is yours. You did not sign.');
  if (flags.defender) lines.push('You chose walls over marches.');
  if (flags.conqueror) lines.push('The nearest valley learned your banner.');
  if (flags.council) lines.push('A council sits. Slower decisions, deeper roots.');
  if (flags.crown) lines.push('You took the crown alone.');
  if (flags.gunline) lines.push('Your towers speak thunder now.');
  if (flags.cautious) lines.push('The recipe is buried. For now.');
  if (flags.industry) lines.push('The furnaces never cooled.');
  if (flags.green) lines.push('You spared the valleys.');
  if (flags.final) lines.push('The last banner came down.');
  return lines;
}

export function chapterEchoes(chapterIndex, flags = {}) {
  const table = ECHOES[chapterIndex];
  if (!table) return '';
  return FLAG_ORDER
    .filter((k) => flags[k] && table[k])
    .map((k) => table[k])
    .join('\n\n');
}

export function chapterBody(chapter, flags, chapterIndex) {
  const echo = chapterEchoes(chapterIndex, flags);
  const d = chapter?.d || '';
  return echo ? `${d}\n\n${echo}` : d;
}

export function choiceToast(flag) {
  return TOASTS[flag] || 'Chronicle updated.';
}

export function choicePayoff(flag) {
  return PAYOFFS[flag] || '';
}

export function scaleOfferCost(cost, mul) {
  if (mul === 1) return cost;
  const o = {};
  for (const k in cost) o[k] = Math.max(1, Math.round(cost[k] * mul));
  return o;
}

export function dwellingOffer(flags = {}) {
  let count = 5;
  let costMul = 1;
  let line = 'They fight for coin.';
  if (flags.generous && flags.ruthless) {
    count = 6;
    costMul = 0.85;
    line = 'They have heard both stories — the fire, and the flint. Coin still talks.';
  } else if (flags.generous) {
    count = 7;
    costMul = 0.8;
    line = 'They have heard of the shared fire. Some will march for less.';
  } else if (flags.ruthless) {
    costMul = 0.85;
    line = 'They have heard of the flint. They do not haggle.';
  }
  if (flags.creature) {
    count += 1;
    line += ' Wild things already keep your company.';
  }
  return { count, costMul, line };
}

export function survivorJoin(flags = {}, heroLvl = 1) {
  let chance = 0.4 + heroLvl * 0.02;
  let extra = 0;
  if (flags.generous) {
    chance += 0.22;
    extra += 2;
  }
  if (flags.ruthless) chance -= 0.18;
  if (flags.creature) chance += 0.08;
  return {
    chance: clamp(chance, 0.08, 0.9),
    extra,
    hides: !!flags.ruthless,
  };
}

export function hideGold(age = 0) {
  return 40 + age * 25;
}

export function townResupply(flags = {}) {
  const gain = { gold: 60 };
  const notes = [];
  if (flags.generous) {
    gain.food = (gain.food || 0) + 50;
    notes.push('They share bread — the fire is still a story here.');
  }
  if (flags.ruthless) {
    gain.gold += 30;
    notes.push('The reeve pays a levy without being asked twice.');
  }
  if (flags.independent) gain.stone = (gain.stone || 0) + 30;
  if (flags.defender) gain.stone = (gain.stone || 0) + 40;
  if (flags.conqueror) gain.gold += 40;
  if (flags.council) gain.food = (gain.food || 0) + 40;
  if (flags.crown) gain.gold += 50;
  if (flags.gunline) gain.gold += 40;
  if (flags.cautious) gain.stone = (gain.stone || 0) + 50;
  if (flags.industry) gain.gold += 80;
  if (flags.green) gain.food = (gain.food || 0) + 80;
  return {
    gain,
    toast: notes.length ? `The town resupplies you. ${notes.join(' ')}` : 'The town resupplies you.',
  };
}

export function cacheExtra(flags = {}, resource, amt) {
  let extra = 0;
  if (flags.independent && (resource === 'stone' || resource === 'wood')) {
    extra += Math.round(amt * 0.25);
  }
  if (flags.industry && resource === 'gold') extra += Math.round(amt * 0.2);
  if (flags.green && resource === 'food') extra += Math.round(amt * 0.25);
  return extra;
}

export function treasureExtra(flags = {}, gold) {
  let extra = 0;
  if (flags.conqueror) extra += Math.round(gold * 0.2);
  if (flags.crown) extra += Math.round(gold * 0.15);
  if (flags.ruthless) extra += Math.round(gold * 0.1);
  return extra;
}

export function withSpoils(flags = {}, reward = {}) {
  const out = { ...reward };
  if (flags.conqueror && out.gold) out.gold = Math.round(out.gold * 1.2);
  if (flags.industry && out.gold) out.gold = Math.round(out.gold * 1.1);
  if (flags.green && out.food) out.food = Math.round(out.food * 1.2);
  if (flags.gunline && out.gold) out.gold += 40;
  if (flags.defender && out.stone) out.stone = Math.round(out.stone * 1.15);
  return out;
}

export function encounterRumor(flags = {}) {
  if (flags.generous && flags.ruthless) {
    return 'They have heard both stories. Some hesitate; some will not.';
  }
  if (flags.generous) return 'They have caught your scent as kin, not meat.';
  if (flags.ruthless) return 'They will not yield. You will take what they leave.';
  if (flags.creature) return 'Your beasts have been seen. These ones are not sure they are next.';
  return '';
}

export function refugeeEvent(flags = {}) {
  if (flags.generous && flags.ruthless) {
    return {
      t: 'Refugees on the road',
      d: 'A column of refugees begs for food. They argue over which story of you is true.',
      feedFood: 100,
      feedXp: 120,
      join: 3,
      conscript: 6,
      feedLabel: 'Feed them (−100 food, +120 XP, 3 stay as spears)',
      otherLabel: 'Conscript them (+6 melee)',
    };
  }
  if (flags.generous) {
    return {
      t: 'Refugees on the road',
      d: 'A column of refugees begs for food. One of them names the night you shared the fire.',
      feedFood: 80,
      feedXp: 150,
      join: 5,
      conscript: 5,
      feedLabel: 'Feed them (−80 food, +150 XP, 5 stay as spears)',
      otherLabel: 'Conscript them (+5 melee)',
    };
  }
  if (flags.ruthless) {
    return {
      t: 'Refugees on the road',
      d: 'A column of refugees flinches at the banner. They have heard about the flint.',
      feedFood: 120,
      feedXp: 80,
      join: 0,
      conscript: 8,
      feedLabel: 'Feed them anyway (−120 food, +80 XP)',
      otherLabel: 'Conscript them (+8 melee)',
    };
  }
  return {
    t: 'Refugees on the road',
    d: 'A column of refugees begs for food.',
    feedFood: 120,
    feedXp: 120,
    join: 0,
    conscript: 5,
    feedLabel: 'Feed them (−120 food, +120 hero XP)',
    otherLabel: 'Conscript them (+5 melee)',
  };
}
