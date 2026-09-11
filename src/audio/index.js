/** Local audio — samples when present, procedural fallback. No network. */
let ctx = null;
let muted = false;
let musicOn = true;
let sfxOn = true;
let themeAudio = null;
let themeScene = 'title';

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function isMuted() { return muted; }
export function setMuted(v) {
  muted = !!v;
  if (muted) stopTheme();
  else if (themeScene) playTheme(themeScene);
}
export function setMusicEnabled(v) {
  musicOn = !!v;
  if (!musicOn) stopTheme();
  else if (themeScene) playTheme(themeScene);
}
export function setSfxEnabled(v) { sfxOn = !!v; }

const THEMES = {
  title: 'theme-title',
  realm: 'theme-realm',
  battle: 'theme-battle',
  siege: 'theme-siege',
};

function stopTheme() {
  if (!themeAudio) return;
  themeAudio.pause();
  themeAudio.src = '';
  themeAudio = null;
}

export async function playSample(name, { music = false } = {}) {
  if (muted) return;
  if (music && !musicOn) return;
  if (!music && !sfxOn) return;
  try {
    const audio = new Audio(`./audio/${name}.wav`);
    audio.volume = music ? 0.35 : 0.7;
    await audio.play();
  } catch {
    if (!music) beep(name);
  }
}

function beep(kind) {
  const a = ac();
  if (!a || muted || !sfxOn) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = kind === 'kill' ? 'sawtooth' : 'triangle';
  o.frequency.value = kind === 'ageup' ? 440 : kind === 'recruit' ? 330 : 220;
  g.gain.value = 0.04;
  o.connect(g); g.connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.12);
}

export function playSfx(kind) {
  const map = {
    upgrade: 'sfx-upgrade', recruit: 'sfx-recruit', ageup: 'sfx-ageup',
    kill: 'sfx-kill', hammer: 'sfx-hammer', coin: 'sfx-upgrade',
    attack: 'sfx-attack', death: 'sfx-death', spell: 'sfx-spell',
    victory: 'sfx-victory', defeat: 'sfx-defeat',
  };
  if (map[kind]) playSample(map[kind]);
  else beep(kind);
}

export function playTheme(scene = 'title') {
  const key = THEMES[scene] ? scene : 'title';
  themeScene = key;
  if (muted || !musicOn) {
    stopTheme();
    return;
  }
  const file = THEMES[key];
  if (themeAudio && themeAudio.dataset?.file === file && !themeAudio.paused) return;
  stopTheme();
  const audio = new Audio(`./audio/${file}.wav`);
  audio.loop = true;
  audio.volume = 0.35;
  audio.dataset.file = file;
  themeAudio = audio;
  audio.play().catch(() => {});
}

export function stopAll() {
  stopTheme();
}
