import { gatheredRecipeCost } from "./sites.js";
import { creditCoins, creditResource, spendResource } from "./resources.js";
import { recordWorld, worldTag, worlds, discoveryKey } from "./world-data.js";
import { milestones, slots } from "./data.js";

const legendary = 4;
const craftAt = milestones.helper;
const craftCost = { coins: 800, scrap: 10, shards: 4 };
const slotBases = [1, 8, 1, 2];
const builds = {
  hammerhand: {
    name: "Hammerhand",
    slot: 0,
    style: "Clicking",
    ability: "After 20 presses, open the oldest chest already on the field.",
    two: "Charge in 15 presses.",
    four: "Place a Common chest if the field is empty after the normal drop attempt.",
  },
  clockwork: {
    name: "Clockwork",
    slot: 2,
    style: "Automation",
    ability:
      "After 60 seconds on the open field with passive income, place a Common chest.",
    two: "Charge in 45 seconds.",
    four: "Open the oldest local chest if placement is blocked and the bag has room.",
  },
  forager: {
    name: "Forager",
    slot: 3,
    style: "Resources",
    ability: "Earn 2 scrap every three manual chest openings.",
    two: "Auto Chest openings count too.",
    four: "Each payout also grants 1 shard once shards are unlocked.",
  },
  pathfinder: {
    name: "Pathfinder",
    slot: 1,
    style: "Treasure",
    ability:
      "Every six manual or Auto Chest openings banks a one-tier boost to a natural chest drop, up to Legendary.",
    two: "Earn a charge every five openings.",
    four: "Bank up to two charges.",
  },
};
const evolution = {
  2: { at: 10000, cost: { coins: 3000, scrap: 16, shards: 8 }, scale: 1.5 },
  3: { at: 50000, cost: { coins: 12000, scrap: 32, shards: 16 }, scale: 1.5 },
  4: {
    at: 1000000,
    cost: { coins: 100000, scrap: 60, shards: 40 },
    scale: 1.2,
  },
  5: {
    at: 10000000,
    cost: { coins: 1000000, scrap: 120, shards: 80 },
    scale: 1.2,
  },
};
const defaultLootRules = () => ({
  equip: "off",
  salvage: false,
  ceiling: 0,
  duplicates: true,
});
const defaultAbilityProgress = () => ({
  hammerhand: 0,
  clockwork: 0,
  forager: 0,
  pathfinder: 0,
  charges: 0,
});

function normalizeLootRules(raw) {
  return {
    equip: ["off", "protect", "strongest"].includes(raw?.equip)
      ? raw.equip
      : "off",
    salvage: raw?.salvage === true,
    ceiling: Number.isInteger(raw?.ceiling)
      ? Math.max(0, Math.min(3, raw.ceiling))
      : 0,
    duplicates: raw?.duplicates !== false,
  };
}

function normalizeAbilityProgress(raw) {
  const caps = {
    hammerhand: 20,
    clockwork: 60000,
    forager: 2,
    pathfinder: 5,
    charges: 2,
  };
  return Object.fromEntries(
    Object.entries(caps).map(([key, max]) => [
      key,
      Number.isFinite(raw?.[key])
        ? Math.min(
            max,
            Math.max(0, key === "clockwork" ? raw[key] : Math.floor(raw[key])),
          )
        : 0,
    ]),
  );
}

function setId(item) {
  return item?.set || "";
}

function signature(item) {
  return item?.set && builds[item.set]?.slot === item.slot ? item.set : "";
}

function buildProfile(gear) {
  const pieces = {};
  const signatures = new Set();
  for (const item of gear) {
    if (!item?.set) continue;
    pieces[item.set] = (pieces[item.set] || 0) + 1;
    if (signature(item)) signatures.add(item.set);
  }
  return Object.fromEntries(
    Object.keys(builds).map((id) => {
      const count = pieces[id] || 0;
      return [id, { count, active: count >= 2 || signatures.has(id) }];
    }),
  );
}

function designKey(item) {
  return item.set
    ? `set:${item.set}:${item.slot}:${item.r}`
    : discoveryKey(item.slot, item.r, recordWorld(item));
}

function discover(state, item) {
  const key = designKey(item);
  if (state.found.includes(key)) return false;
  state.found.push(key);
  return true;
}

function canPay(state, cost) {
  return Object.entries(cost).every(([id, amount]) => state[id] >= amount);
}

function pay(state, cost) {
  for (const [id, amount] of Object.entries(cost))
    spendResource(state, id, amount);
}

function lootValue(world, level, slot, scale, roll = 1) {
  return Math.max(
    1,
    Math.round(
      slotBases[slot] *
        scale *
        (worlds[world].gearScale || 1) *
        (1 + Math.min(50, level - 1) * 0.18) *
        roll,
    ),
  );
}

function buildRecipe(
  state,
  set,
  slot,
  level,
  nextId,
  put,
  limit,
  gathered = false,
) {
  const cost = gathered ? gatheredRecipeCost : craftCost;
  if (
    !Object.hasOwn(builds, set) ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= slots.length ||
    state.total < craftAt ||
    state.items.length >= limit ||
    !canPay(state, cost)
  )
    return null;
  const item = {
    id: nextId(state),
    slot,
    set,
    r: 2,
    level,
    value: lootValue(state.world, level, slot, 4),
    ...worldTag(state.world),
  };
  pay(state, cost);
  put(state, item);
  discover(state, item);
  return item;
}

function evolutionOffer(state, item) {
  const step = evolution[item.r];
  return (
    step && {
      ...step,
      available:
        item.forge === 3 && state.total >= step.at && canPay(state, step.cost),
    }
  );
}

function evolveGear(state, item) {
  if (!item || !state.items.includes(item)) return false;
  const offer = evolutionOffer(state, item);
  if (!offer?.available) return false;
  pay(state, offer.cost);
  item.r++;
  item.value = Math.round(item.value * offer.scale * 100) / 100;
  discover(state, item);
  return true;
}

function resolveLoot(
  state,
  item,
  firstDiscovery,
  { lookup, put, value, payout },
) {
  const rules = state.lootRules;
  const equipped = lookup(state.equip[item.slot]);
  const strong = value(item) > value(equipped);
  const sameBuild =
    !equipped ||
    (recordWorld(equipped) === recordWorld(item) &&
      setId(equipped) === setId(item) &&
      signature(equipped) === signature(item));
  const equip =
    rules.equip !== "off" &&
    !equipped?.locked &&
    strong &&
    (rules.equip === "strongest" || sameBuild);
  const matches = (gear) =>
    gear.slot === item.slot &&
    recordWorld(gear) === recordWorld(item) &&
    !gear.set;
  const salvage =
    !equip &&
    !strong &&
    rules.salvage &&
    !firstDiscovery &&
    !item.locked &&
    !item.set &&
    item.r <= rules.ceiling &&
    (!rules.duplicates ||
      state.items.some((gear) => designKey(gear) === designKey(item))) &&
    state.items.some((gear) => matches(gear) && value(gear) >= value(item));
  if (salvage) {
    const reward = payout(item);
    creditCoins(state, reward.coins);
    creditResource(state, "scrap", reward.scrap);
    return "salvaged";
  }
  put(state, item);
  if (equip) state.equip[item.slot] = item.id;
  return equip ? "equipped" : "kept";
}

function trackOpening(state, profile, source, shardsUnlocked) {
  const progress = state.abilityProgress;
  const natural = source === "manual" || source === "auto";
  let gathered = 0;
  if (
    profile.forager.active &&
    (source === "manual" || (source === "auto" && profile.forager.count >= 2))
  ) {
    if (++progress.forager >= 3) {
      progress.forager = 0;
      gathered = 2;
      creditResource(state, "scrap", gathered);
      if (profile.forager.count >= 4 && shardsUnlocked)
        creditResource(state, "shards", 1);
    }
  }
  const cap = profile.pathfinder.count >= 4 ? 2 : 1;
  if (
    natural &&
    profile.pathfinder.active &&
    progress.charges < cap &&
    ++progress.pathfinder >= (profile.pathfinder.count >= 2 ? 5 : 6)
  ) {
    progress.pathfinder = 0;
    progress.charges++;
  }
  return gathered;
}

export {
  legendary,
  craftAt,
  craftCost,
  builds,
  defaultLootRules,
  defaultAbilityProgress,
  normalizeLootRules,
  normalizeAbilityProgress,
  buildProfile,
  designKey,
  discover,
  lootValue,
  buildRecipe,
  evolutionOffer,
  evolveGear,
  resolveLoot,
  trackOpening,
  canPay,
};
