/** Local audio — samples when present, procedural fallback. No network. */
let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function isMuted() { return muted; }
export function setMuted(v) { muted = !!v; }

export async function playSample(name) {
  if (muted) return;
  try {
    const audio = new Audio(`./audio/${name}.wav`);
    audio.volume = 0.7;
    await audio.play();
  } catch {
    beep(name);
  }
}

function beep(kind) {
  const a = ac();
  if (!a || muted) return;
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
  const map = { upgrade: 'sfx-upgrade', recruit: 'sfx-recruit', ageup: 'sfx-ageup', kill: 'sfx-kill', hammer: 'sfx-hammer' };
  if (map[kind]) playSample(map[kind]);
  else beep(kind);
}

export function playTheme() {
  playSample('theme-title');
}

export function stopAll() {
  // Sample Audio elements are fire-and-forget; procedural oscillators are short.
}
