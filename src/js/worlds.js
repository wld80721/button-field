import { closeModal } from "./dialogs.js";
import { terrain } from "./effects.js";
import { regionalSets, worldChargeGoal } from "./gear.js";
import { clearFieldEffects, notice, render, renderChests } from "./field.js";
import { fmtExact } from "./numbers.js";
import { hasRunCoins, nextWorld } from "./progression.js";
import { save } from "./saves.js";
import { equippedGear, s } from "./state.js";
import { $, setText, setValue } from "./ui-dom.js";
import { recordWorld, worlds } from "./world-data.js";

function worldChests(id = s.world) {
  return s.chests.filter((chest) => recordWorld(chest) === id);
}

function worldGearCount(id, gear = equippedGear()) {
  let count = 0;
  for (const item of gear) {
    if (item && recordWorld(item) === id) count++;
  }
  return count;
}

function worldReadout(pieces) {
  const id = s.world;
  const world = worlds[id];
  const charge = s.worldProgress[id];
  const goal = worldChargeGoal(id, pieces);
  const status =
    id === "volcano"
      ? charge
        ? charge + " presses left"
        : "Open a chest to charge"
      : charge >= goal
        ? "Ready"
        : charge + "/" + goal;
  setText($("worldName"), world.name);
  setText($("worldStatus"), world.mechanic + " · " + status);
  setValue(
    $("worldFill").style,
    "width",
    Math.min(100, (charge / goal) * 100) + "%",
  );
  if ($("board").dataset.world !== id) {
    $("board").dataset.world = id;
    $("board").style.setProperty("--world-accent", world.accent);
    terrain();
  }
}

function isKnownWorld(state, id) {
  const world = worlds[id];
  return (
    hasRunCoins(state, world.at) ||
    state.items.some((item) => recordWorld(item) === id) ||
    state.found.some((key) => key.startsWith(id + ":"))
  );
}

function worldOptions() {
  return Object.entries(worlds)
    .filter(([id]) => isKnownWorld(s, id))
    .map(([id, world]) => `<option value="${id}">${world.name}</option>`)
    .join("");
}

function worldsMarkup() {
  return `<p class="subtext">Unlock fields with coins earned this run. Travel is free. Chests stay where they land, and Auto Chest works in the field you’re visiting.</p>
    <div class="world-grid"></div>`;
}

function worldCard(id, world) {
  return `<article class="up-card world-card" style="--world-accent:${world.accent}">
    <h3>${world.name}</h3>
    <p><strong>${world.mechanic}</strong> · ${world.description}</p>
    <p>${world.gearBonus || "Find the original Treasure Grove equipment here."}</p>
    <details class="world-set-rules"><summary>World set bonuses</summary><p>2 pieces · ${regionalSets[id].two}</p><p>4 pieces · ${regionalSets[id].four}</p></details>
    <button class="action" data-travel="${id}"></button>
  </article>`;
}

function updateWorlds() {
  const grid = $("modalBody").querySelector(".world-grid");
  const next = nextWorld(s);
  const key = next?.[0] || "all-unlocked";
  if (grid.dataset.next !== key) {
    const focused = document.activeElement?.dataset.travel;
    const available = Object.entries(worlds).filter(([, world]) =>
      hasRunCoins(s, world.at),
    );
    grid.dataset.next = key;
    grid.innerHTML =
      available.map(([id, world]) => worldCard(id, world)).join("") +
      (next
        ? `<article class="up-card world-card world-undiscovered"><h3>${next[1].name}</h3>
        <p>Explore this field once you reach its coin milestone.</p>
        <button class="action" data-travel="${next[0]}" disabled></button>
      </article>`
        : "");
    if (focused)
      [...grid.querySelectorAll("[data-travel]")]
        .find((button) => button.dataset.travel === focused)
        ?.focus();
  }
  for (const button of grid.querySelectorAll("[data-travel]")) {
    const id = button.dataset.travel;
    const world = worlds[id];
    const here = id === s.world;
    const locked = !hasRunCoins(s, world.at);
    setValue(button, "disabled", here || locked);
    setText(
      button,
      here
        ? "Current field"
        : locked
          ? fmtExact(world.at) + " coins earned to unlock"
          : "Travel to " + world.name,
    );
  }
}

function travel(id) {
  const world = Object.hasOwn(worlds, id) && worlds[id];
  if (!world || !hasRunCoins(s, world.at) || s.world === id) return;
  s.world = id;
  clearFieldEffects();
  renderChests();
  notice("Arrived in " + world.name + ".");
  render();
  save();
  closeModal();
  $("press").focus();
}

export {
  isKnownWorld,
  travel,
  updateWorlds,
  worldChests,
  worldGearCount,
  worldOptions,
  worldReadout,
  worldsMarkup,
};
