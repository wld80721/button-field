import { KEY } from "./saves.js";
import { $ } from "./ui-dom.js";

const soundTones = {
  combatStart: [
    [145, 200, 0.15, 0, "triangle", 0.06],
    [293, 390, 0.12, 0.12, "triangle", 0.045],
  ],
  combatGuard: [[520, 320, 0.1, 0, "triangle", 0.055]],
  combatHurt: [[160, 72, 0.17, 0, "triangle", 0.075]],
  combatWin: [
    [392, 392, 0.12, 0, "triangle", 0.06],
    [523, 523, 0.14, 0.1, "triangle", 0.06],
    [659, 659, 0.16, 0.2, "triangle", 0.06],
    [784, 784, 0.28, 0.32, "triangle", 0.05],
  ],
  tap: [[180, 115, 0.065, 0, "triangle", 0.09]],
  menu: [[450, 350, 0.075, 0, "triangle", 0.045]],
  discovery: [
    [587, 587, 0.11, 0, "triangle", 0.05],
    [880, 880, 0.16, 0.08, "sine", 0.06],
  ],
  chest: [
    [220, 115, 0.09, 0, "triangle", 0.07],
    [410, 410, 0.1, 0.065, "triangle", 0.05],
    [520, 520, 0.11, 0.13, "triangle", 0.04],
  ],
  upgrade: [
    [392, 392, 0.1, 0, "triangle", 0.06],
    [523, 523, 0.12, 0.09, "triangle", 0.055],
    [659, 659, 0.16, 0.18, "triangle", 0.045],
  ],
  equip: [
    [330, 330, 0.08, 0, "triangle", 0.05],
    [440, 440, 0.12, 0.07, "triangle", 0.05],
  ],
  ascend: [
    [262, 262, 0.24, 0, "sine", 0.07],
    [392, 392, 0.24, 0.1, "sine", 0.065],
    [523, 523, 0.3, 0.2, "sine", 0.055],
  ],
};
let soundOn = true,
  audioCtx = null,
  soundLast = 0;
function syncSound() {
  const b = $("soundToggle");
  b.textContent = soundOn ? "🔊" : "🔇";
  b.setAttribute("aria-pressed", String(soundOn));
  b.setAttribute("aria-label", soundOn ? "Mute sound" : "Enable sound");
  b.title = soundOn ? "Mute sound" : "Enable sound";
}
function initAudio() {
  if (!soundOn) return null;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    if (!audioCtx) audioCtx = new C();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}
function sound(kind) {
  if (!soundOn) return;
  const ctx = initAudio();
  if (!ctx || ctx.state === "closed") return;
  const t = ctx.currentTime;
  if (kind === "tap" && t - soundLast < 0.042 && soundLast > 0) return;
  if (kind === "tap") soundLast = t;

  for (const [f, end, d, offset, type, vol] of soundTones[kind] ||
    soundTones.menu) {
    try {
      const o = ctx.createOscillator(),
        g = ctx.createGain(),
        start = t + offset;
      o.type = type;
      o.frequency.setValueAtTime(f, start);
      o.frequency.exponentialRampToValueAtTime(end, start + d);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + d);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + d + 0.01);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    } catch {}
  }
}
function initSound() {
  try {
    soundOn = localStorage.getItem(KEY + "-sound") !== "off";
  } catch {}
  syncSound();
  $("soundToggle").addEventListener("click", () => {
    soundOn = !soundOn;
    try {
      localStorage.setItem(KEY + "-sound", soundOn ? "on" : "off");
    } catch {}
    syncSound();
    if (soundOn) sound("menu");
    else if (audioCtx) audioCtx.suspend().catch(() => {});
  });
}

export { initSound, sound };
