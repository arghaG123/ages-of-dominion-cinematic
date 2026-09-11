import { CLASSES, AGES, STORY, CREATURES } from './data/index.js';
import { chapterBody } from './state/storyFlags.js';
import { rivalSpeech } from './state/rival.js';
import { newGame } from './state/factory.js';
import { tutorialPending } from './state/tutorial.js';
import {
  createPreferredStorage,
  inspectContinue, loadSlot, SLOT_AUTO, MANUAL_SLOTS,
  exportBackup, importBackup,
  configureAutosave, requestSave, saveNow, registerLifecycle,
} from './save/index.js';
import { dispatch, nextAction } from './game/dispatch.js';
import { replayChallenge } from './rules/combat.js';
import { initTitleScene } from './scenes/title.js';
import { initRealmScene } from './scenes/realm.js';
import { createBattleController } from './scenes/battle.js';
import { createSiegeController } from './scenes/siege.js';
import { paintNavIcons } from './ui/icons.js';
import {
  renderHost, renderMap, renderWar, renderMore, renderBuildingsSheet, agePrompt, resBarHtml, drawHeroPreview,
} from './ui/views.js';
import { playSfx, playTheme, isMuted, setMuted, stopAll, setMusicEnabled, setSfxEnabled } from './audio/index.js';
import { haptic, setHapticsEnabled } from './platform/haptics.js';
import { downloadText, shareText } from './platform/files.js';
import { esc, makeRng, uid } from './util.js';

function blOfQuarry(state) {
  return state?.bld?.quarry?.l || 0;
}

let storage;
let S = null;
let tab = 'realm';
let hostSeg = 'hero';
let tickTimer = null;
let titleScene = null;
let realmScene = null;
let battle;
let siege;

const el = (id) => document.getElementById(id);

function toast(message) {
  const t = el('toast');
  t.textContent = message;
  t.classList.toggle('above-sheet', !el('modal').hidden);
  t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), 2200);
}

function openSheet(html) {
  el('sheet').innerHTML = html;
  el('modal').hidden = false;
}

function closeSheet() {
  el('modal').hidden = true;
  el('sheet').innerHTML = '';
}

function applyEffects(effects) {
  for (const e of effects) {
    if (e.type === 'toast') toast(e.message);
    if (e.type === 'sfx') playSfx(e.kind);
    if (e.type === 'haptic') haptic(e.kind);
    if (e.type === 'build-complete') {
      playSfx('hammer');
      toast(`Build complete: ${e.buildingId}`);
    }
    if (e.type === 'offline-grant') {
      const g = e.grant || {};
      openSheet(`<h3>While you were away</h3>
        <p>Food +${g.food || 0}, Wood +${g.wood || 0}, Stone +${g.stone || 0}, Gold +${g.gold || 0}</p>
        <button type="button" class="btn gold" id="collect">Collect</button>`);
      el('sheet').querySelector('#collect').onclick = () => closeSheet();
    }
    if (e.type === 'start-fight') battle.start(e.foes, { boss: e.boss, nodeIndex: e.nodeIndex });
    if (e.type === 'start-siege') siege.start({ mode: e.mode || 'site', nodeIndex: e.nodeIndex });
    if (e.type === 'chapter') openChapter(e.index);
    if (e.type === 'victory') toast('Victory');
    if (e.type === 'defeat') toast('Defeat');
    if (e.type === 'tutorial') {
      openSheet(`<h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>
        <button type="button" class="btn gold" id="tutOk">Continue</button>`);
      el('sheet').querySelector('#tutOk')?.addEventListener('click', closeSheet);
    }
    if (e.type === 'dwelling-offer') {
      openSheet(`<h3>Dwelling</h3><p>${esc(e.line || '')}</p>
        <p>Hire ${e.count} ${esc(e.creatureType)} for ${Object.entries(e.cost || {}).map(([k, v]) => `${v} ${k}`).join(', ')}</p>
        <button type="button" class="btn gold" id="hire">Hire</button>
        <button type="button" class="btn" id="skip">Leave</button>`);
      el('sheet').querySelector('#hire').onclick = () => {
        closeSheet();
        doDispatch({
          type: 'hire-dwelling',
          creatureType: e.creatureType,
          count: e.count,
          nodeIndex: e.nodeIndex,
        });
      };
      el('sheet').querySelector('#skip').onclick = closeSheet;
    }
    if (e.type === 'event-choices') {
      const ev = e.event || {};
      openSheet(`<h3>${esc(ev.t || 'Event')}</h3><p>${esc(ev.d || '')}</p>
        <button type="button" class="btn gold" id="evA" style="width:100%;margin:6px 0">${esc(ev.feedLabel || 'Feed')}</button>
        <button type="button" class="btn" id="evB" style="width:100%;margin:6px 0">${esc(ev.otherLabel || 'Conscript')}</button>`);
      el('sheet').querySelector('#evA').onclick = () => {
        closeSheet();
        doDispatch({ type: 'event-choice', choice: 'feed', nodeIndex: e.nodeIndex });
      };
      el('sheet').querySelector('#evB').onclick = () => {
        closeSheet();
        doDispatch({ type: 'event-choice', choice: 'conscript', nodeIndex: e.nodeIndex });
      };
    }
    if (e.type === 'rival-speech') toast(e.message);
    if (e.type === 'milestone-ready') toast(`Milestone ready: ${e.name || e.id}`);
  }
}

function doDispatch(action) {
  if (!S) return;
  const { state, effects } = dispatch(S, action);
  S = state;
  if (action.type === 'set-pref') {
    if (action.key === 'music') setMusicEnabled(action.value);
    if (action.key === 'sfx') setSfxEnabled(action.value);
    if (action.key === 'haptics') setHapticsEnabled(action.value);
  }
  applyEffects(effects);
  requestSave();
  render();
}

function openChapter(index) {
  const ch = STORY[index];
  if (!ch) return;
  const body = chapterBody(ch, S?.story?.flags || {}, index);
  openSheet(`<h3>${esc(ch.t)}</h3><p>${esc(body)}</p>
    ${ch.ch.map((c, i) => `<button type="button" class="btn" data-i="${i}" style="width:100%;margin:6px 0;min-height:44px">${esc(c.t)}</button>`).join('')}`);
  el('sheet').querySelectorAll('[data-i]').forEach((b) => {
    b.onclick = () => { closeSheet(); doDispatch({ type: 'story-choice', index: Number(b.dataset.i) }); };
  });
}

async function boot() {
  paintNavIcons();
  storage = await createPreferredStorage();
  if (storage.kind === 'memory') toast('Storage is in-memory only on this host');

  configureAutosave(storage, () => S);
  registerLifecycle();

  titleScene = initTitleScene(el('titlecv'));
  await renderTitle();

  battle = createBattleController({
    root: el('fight'),
    stage: el('fstage'),
    canvas: el('fcv'),
    roster: el('froster'),
    actions: el('fActions'),
    hint: el('fHint'),
    go: el('fGo'),
    resolve: el('fResolve'),
    quit: el('fQuit'),
  }, {
    getState: () => S,
    toast,
    haptic,
    onBattleEnd: (result, armyAfter, meta = {}) => doDispatch({
      type: 'apply-battle-result',
      result,
      armyAfter,
      nodeIndex: meta.nodeIndex,
    }),
  });

  siege = createSiegeController({
    root: el('battle'),
    stage: el('bstage'),
    canvas: el('bcv'),
    roster: el('roster'),
    hint: el('bHint'),
    go: el('bGo'),
    speed: el('bSpeed'),
    quit: el('bQuit'),
    info: el('bInfo'),
  }, {
    getState: () => S,
    toast,
    onSiegeEnd: (result, meta = {}) => {
      doDispatch({ type: 'apply-siege-result', result, nodeIndex: meta.nodeIndex });
    },
  });

  wireChrome();
  initMobileLifecycle();
  playTheme();
}

async function renderTitle() {
  const actions = el('titleActions');
  const cont = await inspectContinue(storage);
  let html = '';
  if (cont.status === 'ok' || cont.status === 'recovered') {
    const st = cont.state;
    html += `<button type="button" class="btn gold" id="btnContinue">Continue — ${esc(st.hero?.name || 'Commander')} · Day ${st.day}</button>`;
    if (cont.status === 'recovered') html += `<p class="tagline">Recovered from backup.</p>`;
  } else if (cont.status === 'damaged') {
    html += `<p class="tagline">Autosave damaged. Load a backup or start carefully.</p>`;
  } else if (cont.status === 'newer-version') {
    html += `<p class="tagline">Save is from a newer build (v${cont.version}). Update the app.</p>`;
  }
  html += `<button type="button" class="btn" id="btnNew">New Game</button>`;
  html += `<button type="button" class="btn" id="btnLoad">Load Game</button>`;
  html += `<button type="button" class="btn" id="btnSaves">Saves & Backups</button>`;
  actions.innerHTML = html;

  el('btnContinue')?.addEventListener('click', () => {
    if (cont.status === 'ok' || cont.status === 'recovered') enterGame(cont.state);
  });
  el('btnNew')?.addEventListener('click', () => openClassPicker());
  el('btnLoad')?.addEventListener('click', () => openLoadSheet());
  el('btnSaves')?.addEventListener('click', () => openSavesSheet());
}

function openClassPicker() {
  const ov = el('classSelect');
  ov.hidden = false;
  const carousel = el('classCarousel');
  carousel.innerHTML = Object.keys(CLASSES).map((k) => {
    const C = CLASSES[k];
    return `<div class="class-card" role="tab" data-cls="${k}" tabindex="0">
      <canvas class="class-portrait"></canvas>
      <h3>${C.n}</h3><p>${C.d}</p><p>Signature: ${C.spell}</p></div>`;
  }).join('');
  let selected = 'knight';
  carousel.querySelectorAll('.class-card').forEach((c) => {
    c.addEventListener('click', () => { selected = c.dataset.cls; });
    drawHeroPreview(c.querySelector('.class-portrait'), c.dataset.cls);
  });
  el('classChoose').onclick = () => {
    const name = el('heroName').value.trim() || 'Kael';
    ov.hidden = true;
    enterGame(newGame(name, 'banner', selected));
  };
  el('classCancel').onclick = () => { ov.hidden = true; };
}

async function openLoadSheet() {
  const rows = [];
  for (const id of [SLOT_AUTO, ...MANUAL_SLOTS]) {
    const r = await loadSlot(storage, id);
    rows.push(`<div class="card"><strong>Slot ${id}</strong> — ${r.status}
      ${r.state ? `${esc(r.state.hero?.name)} day ${r.state.day}` : ''}
      ${r.status === 'ok' || r.status === 'recovered' ? `<button type="button" class="btn" data-load="${id}">Load</button>` : ''}
    </div>`);
  }
  openSheet(`<h3>Load game</h3>${rows.join('')}<button type="button" class="btn" id="closeLd">Close</button>`);
  el('sheet').querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', async () => {
    const r = await loadSlot(storage, b.dataset.load);
    if (r.status === 'ok' || r.status === 'recovered') { closeSheet(); enterGame(r.state); }
    else toast('Cannot load that slot');
  }));
  el('sheet').querySelector('#closeLd').onclick = closeSheet;
}

async function openSavesSheet() {
  openSheet(`<h3>Saves & Backups</h3>
    <button type="button" class="btn" id="exp">Export backup</button>
    <label class="btn" style="display:block;text-align:center;margin-top:8px">Import<input type="file" id="imp" accept="application/json,.json" hidden/></label>
    <button type="button" class="btn" id="mut">${isMuted() ? 'Unmute' : 'Mute'}</button>
    <button type="button" class="btn" id="cls">Close</button>`);
  el('sheet').querySelector('#exp').onclick = async () => {
    if (!S) { toast('No active game'); return; }
    await downloadText('ages-of-dominion-backup.json', exportBackup(S));
  };
  el('sheet').querySelector('#imp').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const state = importBackup(await file.text());
      closeSheet();
      enterGame(state);
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    }
  };
  el('sheet').querySelector('#mut').onclick = () => { setMuted(!isMuted()); openSavesSheet(); };
  el('sheet').querySelector('#cls').onclick = closeSheet;
}

function enterGame(state) {
  S = state;
  setHapticsEnabled(S.uiPrefs?.haptics !== false);
  setMusicEnabled(S.uiPrefs?.music !== false);
  setSfxEnabled(S.uiPrefs?.sfx !== false);
  el('title').hidden = true;
  el('app').hidden = false;
  titleScene?.stop();
  doDispatch({ type: 'offline' });
  tab = 'realm';
  render();
  startTick();
  const tut = tutorialPending(S.tutorial);
  if (tut?.trigger === 'boot') {
    openSheet(`<h3>Welcome</h3><p>${esc(tut.text)}</p><button type="button" class="btn gold" id="tutOk">To the realm</button>`);
    el('sheet').querySelector('#tutOk')?.addEventListener('click', () => {
      closeSheet();
      doDispatch({ type: 'tutorial-ack', id: 'welcome' });
    });
  }
  requestSave();
}

function startTick() {
  clearInterval(tickTimer);
  tickTimer = setInterval(() => doDispatch({ type: 'tick' }), 1000);
}

function stopTick() {
  clearInterval(tickTimer);
  tickTimer = null;
}

/** Resume the economy loop if it was stopped while the tab falsely stayed hidden. */
function ensureTick() {
  if (S && !tickTimer) startTick();
}

function render() {
  if (!S) return;
  const C = CLASSES[S.hero.cls];
  el('topIdentity').textContent = `${S.hero.name} · ${C.n} · Day ${S.day} · ${AGES[S.age]?.n || ''}`;
  el('resBar').innerHTML = resBarHtml(S);

  const unlocked = {
    realm: true,
    host: (S.profile.battles || 0) > 0 || S.age > 0 || blOfQuarry(S) > 0,
    map: true,
    war: (S.profile.battles || 0) > 0 || S.age > 0,
    more: (S.profile.battles || 0) > 0 || S.age > 0,
  };

  document.querySelectorAll('#nav button').forEach((b) => {
    const t = b.dataset.t;
    b.classList.toggle('on', t === tab);
    b.disabled = !unlocked[t];
  });

  const realmHost = el('realmHost');
  const view = el('view');
  if (tab === 'realm') {
    realmHost.hidden = false;
    view.hidden = true;
    if (!realmScene) {
      realmScene = initRealmScene(el('realmcv'), {
        getState: () => S,
        onPlot: (id) => {
          openSheet(`${renderBuildingsSheet(S)}<p class="dim">Selected ${id}</p>`);
          el('sheet').querySelectorAll('[data-build]').forEach((b) => {
            b.onclick = () => { closeSheet(); doDispatch({ type: 'build', buildingId: b.dataset.build }); };
          });
        },
      });
    } else realmScene.resume();
    const na = nextAction(S);
    el('realmNext').querySelector('.ab-title').textContent = na.title;
    el('realmNext').querySelector('.ab-sub').textContent = na.sub || '';
    const ap = agePrompt(S);
    el('realmAgeUp').querySelector('.ab-title').textContent = ap.title;
    el('realmAgeUp').querySelector('.ab-sub').textContent = ap.sub;
    el('realmAgeUp').disabled = !ap.ready;
  } else {
    realmScene?.pause();
    realmHost.hidden = true;
    view.hidden = false;
    if (tab === 'host') {
      renderHost(view, S, hostSeg, {
        setHostSeg: (s) => { hostSeg = s; render(); },
        dispatch: doDispatch,
      });
    }
    if (tab === 'map') renderMap(view, S, { dispatch: doDispatch });
    if (tab === 'war') {
      renderWar(view, S, {
        dispatch: doDispatch,
        startSiege: (o) => siege.start(o),
        startDuel: () => {
          const rng = makeRng(Date.now());
          const keys = Object.keys(CREATURES);
          const foes = [{
            id: uid(), kind: 'creature', type: keys[Math.floor(rng() * keys.length)],
            age: S.age, count: 6 + S.age, rank: 0, xp: 0,
          }];
          battle.start(foes);
        },
        shareDuel: async (code) => {
          const ok = await shareText('Ages of Dominion duel', `AOD1.${code}`);
          toast(ok ? 'Seed shared' : 'Could not share');
        },
        replaySeed: (code) => {
          try {
            const result = replayChallenge(code);
            toast(`Replay winner: ${result.winner === 'p' ? 'Challenger' : 'Opponent'}`);
          } catch {
            toast('Invalid seed');
          }
        },
      });
    }
    if (tab === 'more') {
      renderMore(view, S, {
        dispatch: doDispatch,
        saveNow: () => saveNow().then(() => toast('Saved')),
        exportSave: async () => {
          await downloadText('ages-of-dominion-backup.json', exportBackup(S));
          toast('Exported');
        },
        shareStanding: async () => {
          const text = `${S.hero.name} · Day ${S.day} · ${AGES[S.age]?.n} · ${S.profile.wins || 0} wins · Rival: ${S.rival?.name || 'none'}`;
          const ok = await shareText('Ages of Dominion', text);
          toast(ok ? 'Shared' : 'Could not share');
        },
        toTitle: () => returnToTitle(),
      });
    }
  }
}

function wireChrome() {
  el('nav').addEventListener('click', (e) => {
    ensureTick();
    const b = e.target.closest('button[data-t]');
    if (!b || b.disabled) return;
    closeSheet();
    tab = b.dataset.t;
    render();
  });
  el('realmBuildings').onclick = () => {
    ensureTick();
    openSheet(renderBuildingsSheet(S));
    el('sheet').querySelectorAll('[data-build]').forEach((b) => {
      b.onclick = () => { closeSheet(); doDispatch({ type: 'build', buildingId: b.dataset.build }); };
    });
  };
  el('realmAgeUp').onclick = () => { ensureTick(); doDispatch({ type: 'age-up' }); };
  el('realmNext').onclick = () => {
    ensureTick();
    const na = nextAction(S);
    if (na.action) doDispatch(na.action);
    else if (na.tab) { tab = na.tab; render(); }
  };
  el('muteBtn').onclick = () => {
    setMuted(!isMuted());
    el('muteBtn').textContent = isMuted() ? 'Unmute' : 'Mute';
  };
}

async function returnToTitle() {
  await saveNow();
  stopTick();
  realmScene?.destroy();
  realmScene = null;
  S = null;
  el('app').hidden = true;
  el('title').hidden = false;
  titleScene = initTitleScene(el('titlecv'));
  await renderTitle();
}

function initMobileLifecycle() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopTick();
      realmScene?.pause();
      stopAll();
      saveNow();
    } else if (S) {
      doDispatch({ type: 'offline' });
      startTick();
      realmScene?.resume();
    }
  });

  // Embedded / backgrounded WebViews can stay "hidden" while still interactive.
  document.addEventListener('pointerdown', () => {
    if (S) ensureTick();
  }, { passive: true });

  import('@capacitor/app').then(({ App }) => {
    App.addListener('pause', () => { saveNow(); });
    App.addListener('backButton', () => {
      if (!el('modal').hidden) { closeSheet(); return; }
      if (battle.active()) { el('fQuit').click(); return; }
      if (siege.active()) { el('bQuit').click(); return; }
      if (S && tab !== 'realm') { tab = 'realm'; render(); return; }
      if (S) {
        openSheet(`<h3>Return to Title?</h3>
          <button type="button" class="btn gold" id="yes">Yes</button>
          <button type="button" class="btn" id="no">No</button>`);
        el('sheet').querySelector('#yes').onclick = () => { closeSheet(); returnToTitle(); };
        el('sheet').querySelector('#no').onclick = closeSheet;
        return;
      }
      App.exitApp();
    });
  }).catch(() => {});
}

boot();
