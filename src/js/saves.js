import { normalizeCombat } from "./combat.js";
import { normalizeCompanions } from "./companions.js";
import { normalizeDiscoveries } from "./field-discoveries.js";
import { normalizeSites } from "./sites.js";
import {
  builds,
  hasSetDesign,
  legendary,
  normalizeAbilityProgress,
  normalizeLootRules,
} from "./build-gear.js";
import { clamp, rarity, slots, upgrades } from "./data.js";
import { maxForgeRank } from "./gear.js";
import { initializeResources } from "./resources.js";
import { gearBagLimit, worldChestLimit } from "./gameplay.js";
import { progressionThresholds } from "./progression.js";
import { runtime } from "./runtime.js";
import { fresh, s, schemaVersion, setRunState } from "./state.js";
import { $, setText } from "./ui-dom.js";
import { discoveryKey, recordWorld, worldTag, worlds } from "./world-data.js";

function saveVersion(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Invalid save code.");
  const version = Object.hasOwn(payload, "schemaVersion")
    ? payload.schemaVersion
    : 0;
  if (!Number.isSafeInteger(version) || version < 0)
    throw new Error("Invalid save version.");
  if (version > schemaVersion)
    throw new Error("This save is from a newer version of Button Field.");
  // Older exports have all of these fields, but permit partial run backups too.
  for (const key of ["coins", "total", "presses"]) {
    if (Object.hasOwn(payload, key) && !Number.isFinite(payload[key]))
      throw new Error("Invalid save code.");
  }
  if (!["coins", "total", "presses"].some((key) => Object.hasOwn(payload, key)))
    throw new Error("Invalid save code.");
  for (const key of ["items", "chests", "found"]) {
    if (Object.hasOwn(payload, key) && !Array.isArray(payload[key]))
      throw new Error("Invalid save code.");
  }
  return version;
}

function normalize(o) {
  saveVersion(o);
  return normalizeRun(o);
}

function normalizeRun(o) {
  const f = initializeResources(fresh(), o),
    num = (n, max = 1e15) =>
      typeof n === "number" && Number.isFinite(n) ? clamp(n, 0, max) : 0;
  f.lootRules = normalizeLootRules(o.lootRules);
  f.abilityProgress = normalizeAbilityProgress(o.abilityProgress);
  f.total = num(o.total, Number.MAX_VALUE);
  normalizeSites(f, o.sites);
  for (const k of ["presses", "misses", "opened"]) f[k] = num(o[k]);
  for (const k of ["earned", "runs"])
    f.asc[k] = Math.floor(num(o.asc?.[k], Number.MAX_VALUE));
  f.asc.life = num(o.asc?.life ?? f.total, Number.MAX_VALUE);
  const world = recordWorld(o);
  if (f.total >= worlds[world].at) f.world = world;
  for (const [id, field] of Object.entries(worlds)) {
    if (f.total >= field.at)
      f.worldProgress[id] = Math.floor(num(o.worldProgress?.[id], field.limit));
  }
  if (typeof o.notice === "string") f.notice = o.notice;

  for (const k of Object.keys(f.asc.up))
    f.asc.up[k] = Math.floor(num(o.asc?.up?.[k], 30));
  f.wheelClaims = Math.floor(
    num(
      o.wheelClaims,
      Math.floor(f.presses / progressionThresholds.firstWheel),
    ),
  );
  f.wheelNextAt =
    typeof o.wheelNextAt === "number" && Number.isFinite(o.wheelNextAt)
      ? Math.max(
          progressionThresholds.firstWheel,
          Math.min(
            f.presses + progressionThresholds.firstWheel,
            Math.floor(o.wheelNextAt),
          ),
        )
      : Math.max(
          progressionThresholds.firstWheel,
          Math.min(
            f.presses + progressionThresholds.firstWheel,
            (f.wheelClaims + 1) * progressionThresholds.firstWheel,
          ),
        );
  for (const { id, max = 100 } of upgrades)
    f.up[id] = Math.floor(num(o.up?.[id], max));
  for (const k of Object.keys(f.skills))
    f.skills[k] = Math.floor(num(o.skills?.[k], 50));
  const validItem = (i) =>
    i &&
    Number.isInteger(i.id) &&
    i.id > 0 &&
    Number.isInteger(i.slot) &&
    i.slot >= 0 &&
    i.slot < slots.length &&
    Number.isInteger(i.r) &&
    i.r >= 0 &&
    i.r < rarity.length &&
    Number.isInteger(i.level) &&
    i.level >= 1 &&
    i.level <= 1000 &&
    Number.isFinite(i.value) &&
    i.value > 0 &&
    i.value < 4e8;
  const usedIds = new Set();
  function uniqueId(entry) {
    if (
      !Number.isSafeInteger(entry.id) ||
      entry.id < 1 ||
      entry.id >= Number.MAX_SAFE_INTEGER ||
      usedIds.has(entry.id)
    )
      return false;
    usedIds.add(entry.id);
    return true;
  }
  if (Array.isArray(o.items)) {
    for (const item of o.items) {
      if (validItem(item) && uniqueId(item)) {
        const { id, slot, r, level, value } = item;
        const forge = Math.floor(num(item.forge, maxForgeRank));
        f.items.push({
          id,
          slot,
          r,
          level,
          value,
          ...worldTag(recordWorld(item)),
          ...(forge ? { forge } : {}),
          ...(typeof item.set === "string" && hasSetDesign(item.set, slot, r)
            ? { set: item.set }
            : {}),
          ...(item.locked === true ? { locked: true } : {}),
        });
      }
      if (f.items.length === gearBagLimit) break;
    }
  }
  for (const k of slots.keys()) {
    const id = o.equip?.[k];
    if (f.items.some((i) => i.id === id && i.slot === k)) f.equip[k] = id;
  }
  const validDesigns = new Set(
    Object.keys(worlds).flatMap((id) =>
      slots.flatMap((_, slot) =>
        rarity.map((_, r) => discoveryKey(slot, r, id)),
      ),
    ),
  );
  for (const id of Object.keys(builds))
    for (const slot of slots.keys())
      for (let r = 2; r < rarity.length; r++)
        if (hasSetDesign(id, slot, r))
          validDesigns.add(`set:${id}:${slot}:${r}`);
  if (Array.isArray(o.found))
    f.found = [...new Set(o.found.filter((key) => validDesigns.has(key)))];

  const chestCounts = Object.create(null);
  if (Array.isArray(o.chests)) {
    for (const chest of o.chests) {
      if (
        !chest ||
        !Number.isInteger(chest.r) ||
        chest.r < 0 ||
        chest.r > legendary ||
        !Number.isFinite(chest.x) ||
        !Number.isFinite(chest.y) ||
        !Number.isInteger(chest.level) ||
        chest.level < 1 ||
        chest.level > 1000
      )
        continue;
      const id = recordWorld(chest);
      if (
        f.total < worlds[id].at ||
        chestCounts[id] === worldChestLimit ||
        !uniqueId(chest)
      )
        continue;
      chestCounts[id] = (chestCounts[id] || 0) + 1;
      f.chests.push({
        id: chest.id,
        r: chest.r,
        level: chest.level,
        x: clamp(chest.x, 11.5, 86.5),
        y: clamp(chest.y, 22, 79),
        ...worldTag(id),
      });
    }
  }
  f.nextId = Math.max(
    1,
    Math.floor(num(o.nextId, 1e12)),
    ...f.items.map((i) => i.id + 1),
    ...f.chests.map((c) => c.id + 1),
  );
  normalizeCompanions(f, o.companions);
  normalizeCombat(f, o.combat);
  f.fieldDiscoveries = normalizeDiscoveries(o.fieldDiscoveries);
  return f;
}
const KEY = "treasure-grove-v3";
const preLivingFieldSaveKey = KEY + "-before-living-field";
const preForgeSaveKey = KEY + "-before-forge";
const preCombatSaveKey = KEY + "-before-combat";
const preCompanionsSaveKey = KEY + "-before-companions";
const preSitesSaveKey = KEY + "-before-farming-mining";
const preExpansionSaveKey = KEY + "-before-equipment-expansion";
const preFoundationSaveKey = KEY + "-before-foundation";
let saveWarning = "";
let blockedSave = null;

function readBackup(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readPreForgeSave() {
  return readBackup(preForgeSaveKey);
}

function readPreCombatSave() {
  return readBackup(preCombatSaveKey);
}

function readPreLivingFieldSave() {
  return readBackup(preLivingFieldSaveKey);
}

function readPreCompanionsSave() {
  return readBackup(preCompanionsSaveKey);
}

function readPreSitesSave() {
  return readBackup(preSitesSaveKey);
}

function readPreExpansionSave() {
  return readBackup(preExpansionSaveKey);
}

function readPreFoundationSave() {
  return readBackup(preFoundationSaveKey);
}

function readBlockedSave() {
  return blockedSave;
}

function getSaveWarning() {
  return saveWarning;
}

function pauseSaving(warning, raw) {
  saveWarning = warning;
  blockedSave = raw;
}

function resumeSaving() {
  saveWarning = "";
  blockedSave = null;
}

function preserveBackup(key, raw) {
  if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
}

function loadStoredRun() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // There could be an existing save we were unable to read.
    pauseSaving(
      "Could not read the stored save. Import a save or start a new game to resume autosave.",
      null,
    );
    setRunState(fresh());
    return;
  }
  if (raw === null) {
    setRunState(fresh());
    return;
  }

  let payload, version, run;
  try {
    payload = JSON.parse(raw);
    version = saveVersion(payload);
    run = normalizeRun(payload);
  } catch (error) {
    const reason =
      error instanceof SyntaxError ? "Invalid save code." : error.message;
    pauseSaving(
      reason +
        " The stored save is preserved. Import a supported save or start a new game to resume autosave.",
      raw,
    );
    setRunState(fresh());
    return;
  }

  setRunState(run);
  if (version < schemaVersion) {
    try {
      preserveBackup(preLivingFieldSaveKey, raw);
      if (version < 5) preserveBackup(preCombatSaveKey, raw);
      if (version < 4) preserveBackup(preCompanionsSaveKey, raw);
      if (version < 3) preserveBackup(preSitesSaveKey, raw);
      if (version < 2) preserveBackup(preExpansionSaveKey, raw);
      if (version < 1) preserveBackup(preFoundationSaveKey, raw);
      if (version < 5 && !Object.hasOwn(payload, "scrap"))
        preserveBackup(preForgeSaveKey, raw);
    } catch {
      pauseSaving(
        "Could not back up the stored save before migration. Import a save or start a new game to resume autosave.",
        raw,
      );
    }
  }
}

function save() {
  if (saveWarning) {
    runtime.saveDirty = false;
    setText($("saveStatus"), "Autosave paused");
    return false;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    runtime.saveDirty = false;
    setText($("saveStatus"), "Saved locally");
    return true;
  } catch {
    runtime.saveDirty = true;
    setText($("saveStatus"), "Local save unavailable");
    return false;
  }
}

export {
  KEY,
  getSaveWarning,
  loadStoredRun,
  normalize,
  readBlockedSave,
  readPreForgeSave,
  readPreExpansionSave,
  readPreSitesSave,
  readPreCompanionsSave,
  readPreCombatSave,
  readPreLivingFieldSave,
  readPreFoundationSave,
  resumeSaving,
  save,
  schemaVersion,
};
