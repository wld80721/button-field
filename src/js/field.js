import { clamp, rarity, stages } from "./data.js";
import { updateBuyButtons } from "./dialogs.js";
import {
  burst,
  directionalFloat,
  popGroundLoot,
  toast,
  toastTimer,
} from "./effects.js";
import { updateForge } from "./equipment.js";
import {
  applyPress,
  collectChest,
  gearBagLimit,
  spawnChest,
} from "./gameplay.js";
import { updateProgressionGuide } from "./guide.js";
import { fmt, fmtRate } from "./numbers.js";
import { chapterHint, progressionAccess } from "./progression.js";
import { runtime } from "./runtime.js";
import { save } from "./saves.js";
import { owned } from "./skills.js";
import { sound } from "./sound.js";
import { chestIcon, openedChestIcon } from "./sprites.js";
import {
  equippedGear,
  itemName,
  level,
  recordEarnings,
  s,
  setRunState,
  stageIndex,
  stats,
} from "./state.js";
import { $, setText, setValue } from "./ui-dom.js";
import { wheelHUD } from "./wheel.js";
import { recordWorld, worlds } from "./world-data.js";
import {
  updateWorlds,
  worldChests,
  worldGearCount,
  worldReadout,
} from "./worlds.js";

let pressTimer;

function replaceRun(run) {
  setRunState(run);
  runtime.ascConfirm = false;
  runtime.selectedSkill = "root";
  runtime.pendingWorldUnlock = null;
  clearFieldEffects();
  renderChests();
}

function clearFieldEffects() {
  runtime.chestClock = 0;
  clearTimeout(pressTimer);
  clearTimeout(toastTimer);
  $("press").classList.remove("pressed");
  $("toast").hidden = true;
  $("chests").replaceChildren();
  $("effects").replaceChildren();
}

function notice(text) {
  s.notice = text;
  setText($("ticker"), text);
}
function revealChest(chest) {
  renderChests();
  notice(
    rarity[chest.r].name + " treasure chest landed! Tap it to discover gear.",
  );
}

function drop(forcedRarity) {
  const chest = spawnChest(s, { forcedRarity });
  if (!chest) return false;
  revealChest(chest);
  return true;
}
function renderChests() {
  const root = $("chests");
  const chests = worldChests();
  for (const e of [...root.children])
    if (
      !chests.some((c) => c.id === +e.dataset.chest) &&
      !e.classList.contains("opening")
    )
      e.remove();
  for (const c of chests) {
    if (root.querySelector(`[data-chest="${c.id}"]`)) continue;
    const el = document.createElement("button");
    el.className = "chest" + (c.r >= 2 ? " rareplus" : "");
    el.dataset.chest = c.id;
    el.setAttribute("aria-label", `Open ${rarity[c.r].name} treasure chest`);
    el.style.cssText = `left:${c.x}%;top:${c.y}%;--rarity:${rarity[c.r].color}`;
    el.innerHTML =
      chestIcon(c.r) +
      `<span class="chest-name">${rarity[c.r].name}</span>` +
      (c.r >= 2 ? '<span class="chest-star">✦</span>' : "");
    root.append(el);
  }
}
function fieldSnapshot() {
  const gear = equippedGear();
  return { rates: stats(gear), pieces: worldGearCount(s.world, gear) };
}

function press() {
  sound("tap");
  const before = stageIndex();
  const totalBefore = s.total;
  const snapshot = fieldSnapshot();
  const {
    coins,
    bonus: effect,
    chest,
  } = applyPress(s, snapshot.rates, snapshot.pieces);
  recordEarnings(totalBefore);
  if (chest) revealChest(chest);
  directionalFloat(
    (effect ? effect + " · " : "") + "+" + fmtRate(coins),
    effect,
  );
  burst(50, 47, effect ? worlds[s.world].accent : "#ffe5a2");
  $("press").classList.add("pressed");
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => $("press").classList.remove("pressed"), 90);
  if (stageIndex() > before)
    toast("New discovery: " + stages[stageIndex()].title);
  render(snapshot);
  save();
}
function openChest(id) {
  const outcome = collectChest(s, id, worldGearCount(s.world));
  if (!outcome) return;
  if (outcome.full) {
    toast("Gear bag is full. Salvage an unused item first.");
    return;
  }
  const { chest: c, item } = outcome;
  const el = $("chests").querySelector(`[data-chest="${id}"]`);
  if (el) {
    el.innerHTML = openedChestIcon(c.r);
    el.classList.add("opening");
    el.disabled = true;
    setTimeout(() => el.remove(), 1500);
  }
  sound("chest");
  burst(c.x, c.y, rarity[c.r].color);
  popGroundLoot(c, item);
  notice("Collected " + itemName(item) + "! Open Gear to equip it.");
  render();
  save();
}
function progress(i) {
  const n = stages[i + 1];
  return n
    ? clamp(((s.total - stages[i].at) / (n.at - stages[i].at)) * 100, 0, 100)
    : 100;
}
function render({ rates: v, pieces } = fieldSnapshot()) {
  const access = progressionAccess(s);
  const i = stageIndex(),
    p = progress(i);
  const chestCount = worldChests().length;
  setText($("coins"), fmt(s.coins));
  setText($("tapValue"), fmtRate(v.tap));
  setText($("autoValue"), fmtRate(v.auto));
  setText($("shards"), fmt(s.shards));
  setValue($("autoStat"), "hidden", v.auto === 0 && !access.gardenHelper);
  setValue($("shardStat"), "hidden", !access.shards);
  setValue($("powerLabel").firstChild, "nodeValue", "+" + fmtRate(v.tap));
  setText(
    $("questTitle"),
    "Chapter " + String(i + 1).padStart(2, "0") + " · " + stages[i].title,
  );
  setText(
    $("questText"),
    chestCount
      ? owned("autoChest")
        ? s.items.length >= gearBagLimit
          ? "Auto Chest paused · gear bag full."
          : "Auto Chest active · " +
            chestInterval().toFixed(2) +
            "s per chest. You can still open them manually."
        : "Tap a fallen chest to open it."
      : chapterHint(i),
  );
  setText($("level"), String(level()).padStart(2, "0"));
  setValue($("progressFill").style, "height", p + "%");
  setText($("progressNum"), Math.floor(p) + "%");
  const progressValue = String(Math.floor(p));
  if ($("progress").getAttribute("aria-valuenow") !== progressValue)
    $("progress").setAttribute("aria-valuenow", progressValue);
  setText(
    $("boardInfo"),
    chestCount + " chest" + (chestCount === 1 ? "" : "s") + " on field",
  );
  setValue($("inventory"), "hidden", !access.gear);
  setText($("invCount"), s.items.length);
  setValue($("upgrades"), "hidden", !access.workshop);
  setValue($("skills"), "hidden", !access.skills);
  setValue($("collection"), "hidden", !access.collection);
  setText($("ticker"), s.notice);
  worldReadout(pieces);
  if (runtime.pendingWorldUnlock) {
    toast(runtime.pendingWorldUnlock);
    runtime.pendingWorldUnlock = null;
  }
  wheelHUD();
  if (runtime.modalType === "worlds") updateWorlds();
  if (runtime.modalType === "progressionGuide") updateProgressionGuide();
  if (runtime.modalType === "forge") updateForge();
  if (runtime.modalType === "upgrades" || runtime.modalType === "skills")
    updateBuyButtons();
}
function chestInterval() {
  return 5 / (1 + 0.45 * s.up.chestSpeed);
}
function autoChestTick(dt) {
  const chest = s.chests.find((c) => recordWorld(c) === s.world);
  if (
    !owned("autoChest") ||
    !chest ||
    s.items.length >= gearBagLimit ||
    runtime.modalType
  ) {
    runtime.chestClock = 0;
    return;
  }
  runtime.chestClock += dt;
  if (runtime.chestClock >= chestInterval()) {
    runtime.chestClock = 0;
    openChest(chest.id);
  }
}

export {
  autoChestTick,
  chestInterval,
  clearFieldEffects,
  drop,
  fieldSnapshot,
  notice,
  openChest,
  press,
  render,
  renderChests,
  replaceRun,
};
