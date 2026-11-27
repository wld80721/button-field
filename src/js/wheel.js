import { clamp } from "./data.js";
import { toast } from "./effects.js";
import { drop, notice, render } from "./field.js";
import { progressionThresholds } from "./progression.js";
import { creditResource } from "./resources.js";
import { runtime } from "./runtime.js";
import { save } from "./saves.js";
import { chestIcon, coin, itemIcon } from "./sprites.js";
import { earn, s } from "./state.js";
import { $, setValue } from "./ui-dom.js";

const wheelRewards = [
  {
    name: "Coin bundle",
    detail: "+100 coins",
    color: "#d5b85a",
    icon: () => coin(),
    apply: () => {
      earn(100);
      return true;
    },
  },
  {
    name: "Crystal gift",
    detail: "+3 shards",
    color: "#b875f1",
    icon: () => itemIcon(3, 3),
    apply: () => {
      creditResource(s, "shards", 3);
      return true;
    },
  },
  {
    name: "Rare chest",
    detail: "One rare chest on the field",
    color: "#78d9ff",
    icon: () => chestIcon(2),
    apply: () => drop(2),
  },
  {
    name: "Coin cache",
    detail: "+250 coins",
    color: "#ffb04d",
    icon: () => coin(),
    apply: () => {
      earn(250);
      return true;
    },
  },
  {
    name: "Star crystals",
    detail: "+5 shards",
    color: "#a3ef85",
    icon: () => itemIcon(3, 4),
    apply: () => {
      creditResource(s, "shards", 5);
      return true;
    },
  },
  {
    name: "Epic chest",
    detail: "One epic chest on the field",
    color: "#e3a4ff",
    icon: () => chestIcon(3),
    apply: () => drop(3),
  },
];

function wheelReady() {
  return s.presses >= s.wheelNextAt ? 1 : 0;
}
function wheelProgress() {
  return clamp(50 - (s.wheelNextAt - s.presses), 0, 50);
}
function wheelHUD() {
  setValue($("wheel"), "hidden", !wheelReady());
}
function rewardCard(index, extra = "") {
  const a =
    wheelRewards[
      ((index % wheelRewards.length) + wheelRewards.length) %
        wheelRewards.length
    ];
  return `<div class="wheel-card ${extra}" style="--reward-color:${a.color}">${a.icon()}<span>${a.name}</span></div>`;
}
function wheelMarkup() {
  const index =
      runtime.wheelResult === null
        ? s.wheelClaims % wheelRewards.length
        : runtime.wheelResult,
    r = wheelRewards[index],
    ready = wheelReady(),
    progress = wheelProgress(),
    claimed = runtime.wheelResult !== null;
  return `<div class="wheel-stage"><div class="wheel-disc" aria-hidden="true"><div class="wheel-face" style="--angle:${-index * 60}deg"></div><div class="wheel-pointer"></div></div><div class="wheel-info"><strong>${claimed ? "Reward collected!" : ready ? "Milestone complete!" : "Next milestone reward"}</strong>${r.detail}<small>${claimed ? "Your reward has been added." : ready ? "Spin to collect your displayed milestone reward." : "A new reward becomes available after 50 presses following each claim. Rewards do not stack."}</small>${claimed ? "" : `<div class="wheel-progress"><i style="width:${progress * 2}%"></i></div><small>${progress}/50 presses · ${ready} reward available</small>`}</div><div class="wheel-reel"><div class="wheel-title">REWARD WHEEL</div><div class="wheel-track"><div class="wheel-strip" id="wheelStrip">${Array.from({ length: 29 }, (_, j) => rewardCard(index + j - 2, j === 2 ? "chosen" : "")).join("")}</div></div></div><div class="wheel-controls">${claimed ? '<button class="wheel-claim" id="wheelNext">Done</button>' : `<button class="wheel-claim" id="wheelClaim" ${!ready ? "disabled" : ""}>${ready ? "SPIN WHEEL" : "SPIN WHEEL · " + (50 - progress) + " presses left"}</button>`}<button class="action secondary" data-close="1">Return to field</button></div></div>`;
}
function centerReel(strip, index) {
  const card = strip.children[index],
    track = strip.parentElement;
  return track.clientWidth / 2 - card.offsetLeft - card.offsetWidth / 2;
}
function placeReel() {
  const strip = $("wheelStrip");
  if (!strip) return;
  strip.style.transition = "none";
  strip.style.transform = `translateX(${centerReel(strip, runtime.wheelResult === null ? 2 : 20)}px)`;
}

function collectWheel() {
  if (runtime.wheelMoving || !wheelReady() || runtime.wheelResult !== null)
    return;
  const i = s.wheelClaims % wheelRewards.length,
    r = wheelRewards[i];
  if (!r.apply()) {
    toast("Make room on the field by opening a chest first.");
    return;
  }
  s.wheelClaims++;
  s.wheelNextAt = s.presses + progressionThresholds.firstWheel;
  runtime.wheelResult = i;
  runtime.wheelMoving = true;
  const token = ++runtime.wheelGeneration;
  notice("Milestone reward: " + r.detail + ".");
  render();
  save();
  const strip = $("wheelStrip"),
    btn = $("wheelClaim"),
    face = $("modalBody").querySelector(".wheel-face");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "SPINNING…";
  }
  const info = $("modalBody").querySelector(".wheel-info strong");
  if (info) info.textContent = "Collecting your reward…";
  const finish = () => {
    if (token !== runtime.wheelGeneration || runtime.modalType !== "wheel")
      return;
    runtime.wheelMoving = false;
    placeReel();
    const controls = $("modalBody").querySelector(".wheel-controls");
    controls.innerHTML =
      '<button class="wheel-claim" id="wheelNext">Done</button><button class="action secondary" data-close="1">Return to field</button>';
    const detail = $("modalBody").querySelector(".wheel-info");
    detail.innerHTML = `<strong>Reward collected!</strong>${r.detail}<small>Your reward has been added.</small>`;
    if (strip) strip.children[20].classList.add("chosen", "revealed");
    $("wheelNext").focus();
  };
  if (!strip) {
    finish();
    return;
  }
  strip.children[2].classList.remove("chosen");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduced ? 0 : 2200;
  strip.style.transition = `transform ${duration}ms cubic-bezier(.12,.72,.15,1)`;
  strip.getBoundingClientRect();
  strip.style.transform = `translateX(${centerReel(strip, 20)}px)`;
  if (face && !reduced)
    face.animate(
      [
        { transform: `rotate(${-i * 60}deg)` },
        { transform: `rotate(${1080 - i * 60}deg)` },
      ],
      { duration, easing: "cubic-bezier(.12,.72,.15,1)" },
    );
  setTimeout(finish, duration + 40);
}

export { collectWheel, placeReel, wheelHUD, wheelMarkup, wheelReady };
