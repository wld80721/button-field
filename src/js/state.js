import { blueprints, freshBlacksmith } from "./blacksmith-data.js";
import { freshCompanions } from "./companions.js";
import { freshCombat } from "./combat.js";
import { freshSites } from "./sites.js";
import {
  builds,
  defaultAbilityProgress,
  defaultLootRules,
  legendary,
} from "./build-gear.js";
import {
  ascUpgrades,
  clamp,
  names,
  rarity,
  skills,
  slots,
  upgrades,
} from "./data.js";
import { gearIndex, gearValue } from "./gear.js";
import { fieldLevel } from "./gameplay.js";
import { fmtRate } from "./numbers.js";
import {
  chapterIndex,
  progressionThresholds,
  worldUnlockMessage,
} from "./progression.js";
import { creditCoins, initializeResources } from "./resources.js";
import { runtime } from "./runtime.js";
import { firstWorld, recordWorld, worlds } from "./world-data.js";

const schemaVersion = 7;
const zeroLevels = (definitions) =>
  Object.fromEntries(definitions.map(({ id }) => [id, 0]));

const fresh = () =>
  initializeResources({
    schemaVersion,
    sites: freshSites(),
    blacksmith: freshBlacksmith(),
    combat: freshCombat(),
    fieldDiscoveries: [],
    companions: freshCompanions(),
    lootRules: defaultLootRules(),
    abilityProgress: defaultAbilityProgress(),
    world: firstWorld,
    worldProgress: Object.fromEntries(Object.keys(worlds).map((id) => [id, 0])),
    total: 0,
    presses: 0,
    misses: 0,
    up: zeroLevels(upgrades),
    skills: zeroLevels(skills.filter(({ id }) => id !== "root")),
    items: [],
    equip: {},
    found: [],
    chests: [],
    nextId: 1,
    notice:
      "Welcome, explorer! Your first treasure is waiting to be discovered.",
    opened: 0,
    wheelClaims: 0,
    wheelNextAt: progressionThresholds.firstWheel,
    asc: {
      earned: 0,
      runs: 0,
      life: 0,
      up: zeroLevels(ascUpgrades),
    },
  });

let s;
function setRunState(run) {
  s = run;
}

function getGearItem(id) {
  return gearIndex(s).get(id);
}

function stageIndex() {
  return chapterIndex(s);
}

function level() {
  return fieldLevel(s);
}
function equipped(k) {
  return getGearItem(s.equip[k]);
}
function equippedGear() {
  return slots.map((_, slot) => equipped(slot));
}
function stats(gear = equippedGear()) {
  return calculateStats(s, gear);
}

function calculateStats(run, gear) {
  const a = run.asc.up,
    all = Math.pow(2, a.cosmos),
    legacy = 1 + run.asc.earned * 0.15;
  const baseAuto =
    run.up.auto * 3 +
    gearValue(gear[2]) +
    run.skills.helper * 3 +
    run.skills.engine * 9;
  return {
    tap: Math.min(
      Number.MAX_VALUE,
      all *
        legacy *
        Math.pow(2, a.might) *
        ((1 + run.up.power * 2 + gearValue(gear[0]) + run.skills.force * 5) *
          (1 +
            run.skills.tap * 0.15 +
            run.skills.echo * 0.3 +
            run.skills.sun * 0.65 +
            run.skills.star * 0.2 +
            gearValue(gear[1]) / 100)),
    ),
    auto:
      baseAuto === 0
        ? 0
        : Math.min(
            Number.MAX_VALUE,
            all *
              legacy *
              Math.pow(2, a.clock) *
              baseAuto *
              (1 + run.skills.star * 0.5),
          ),
    chance: clamp(
      0.16 +
        a.fortune * 0.025 +
        run.up.fortune * 0.018 +
        run.skills.fortune * 0.012 +
        run.skills.magnet * 0.025 +
        run.skills.luck * 0.035 +
        run.skills.grove * 0.05 +
        run.skills.star * 0.02 +
        gearValue(gear[3]) / 100,
      0.16,
      0.55,
    ),
  };
}
function earn(n) {
  const before = s.total;
  creditCoins(s, n);
  recordEarnings(before);
}
function recordEarnings(before) {
  runtime.pendingWorldUnlock =
    worldUnlockMessage(before, s.total) ?? runtime.pendingWorldUnlock;
  runtime.saveDirty = true;
}
function itemName(i) {
  const gear = worlds[recordWorld(i)].gear;
  const design = Object.hasOwn(blueprints, i.set) && blueprints[i.set];
  if (design && design.slot === i.slot) return design.signature;
  if (i.set) return builds[i.set].name + " " + slots[i.slot];
  if (gear) return rarity[i.r].name + " " + gear[i.slot];
  const base = names[i.slot][Math.min(i.r, legendary)];
  return i.r > legendary ? rarity[i.r].name + " " + base : base;
}
function itemStat(i) {
  const value = fmtRate(gearValue(i));
  return [
    "+" + value + " base coins / press",
    "+" + value + "% press income",
    "+" + value + " coins / sec",
    "+" + value + " percentage points chest chance",
  ][i.slot];
}

export {
  calculateStats,
  earn,
  equipped,
  equippedGear,
  fresh,
  getGearItem,
  itemName,
  itemStat,
  level,
  recordEarnings,
  s,
  schemaVersion,
  setRunState,
  stageIndex,
  stats,
};
