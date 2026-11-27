import {
  buildProfile,
  discover,
  legendary,
  lootValue,
  resolveLoot,
  trackOpening,
} from "./build-gear.js";
import { rarity, slots } from "./data.js";
import {
  addGearItem,
  gearIndex,
  gearValue,
  salvageYield,
  worldChargeGoal,
} from "./gear.js";
import {
  hasSkill,
  hasUpgradeAccess,
  progressionAccess,
} from "./progression.js";
import { creditCoins, creditResource, spendResource } from "./resources.js";
import { firstWorld, recordWorld, worldTag, worlds } from "./world-data.js";

const gearBagLimit = 300;
const worldChestLimit = 12;
const dropChanceMax = 0.55;

const chestPositions = [25, 41, 59, 75].flatMap((y) =>
  [13, 28, 43, 57, 72, 85]
    .filter((x) => !(x > 32 && x < 68 && y > 30 && y < 69))
    .map((x) => [x, y]),
);

function nextEntityId(state) {
  if (
    Number.isSafeInteger(state.nextId) &&
    state.nextId < Number.MAX_SAFE_INTEGER
  )
    return state.nextId++;
  const taken = new Set([...state.items, ...state.chests].map(({ id }) => id));
  let next = 1;
  while (taken.has(next)) next++;
  // When an imported ID is at the safe-integer limit, find free IDs
  // until a new run or a subsequent save normalization.
  return next;
}

function rollRarity(random) {
  let roll = random() * 100;
  for (let index = 0; index <= legendary; index++) {
    roll -= rarity[index].weight;
    if (roll < 0) return index;
  }
  return legendary;
}

function spawnChest(
  state,
  { forcedRarity, boost = 0, random = Math.random } = {},
) {
  const local = state.chests.filter(
    (chest) => recordWorld(chest) === state.world,
  );
  if (local.length >= worldChestLimit) return null;
  const free = chestPositions.filter(
    ([x, y]) =>
      !local.some((chest) => Math.hypot(chest.x - x, chest.y - y) < 12),
  );
  if (!free.length) return null;
  const [x, y] = free[Math.floor(random() * free.length)];
  const chest = {
    x: x + (random() - 0.5) * 3,
    y: y + (random() - 0.5) * 3,
    id: nextEntityId(state),
    r: forcedRarity ?? Math.min(legendary, rollRarity(random) + boost),
    level: fieldLevel(state),
    ...worldTag(state.world),
  };
  state.chests.push(chest);
  return chest;
}

function fieldLevel(state) {
  return 1 + Math.floor(Math.log2(1 + state.total / 100));
}

function advanceWorldPress(state, { tap, auto }, pieces, goal) {
  const id = state.world;
  if (id === "volcano") {
    if (state.worldProgress[id] <= 0) return { coins: tap };
    state.worldProgress[id]--;
    return {
      coins: finiteEarnings(tap * (pieces >= 2 ? 2.25 : 2)),
      bonus: worlds[id].mechanic,
      extraChance: pieces >= 4 ? 0.08 : 0,
    };
  }
  const world = worlds[id];
  const charge = Math.min(world.limit, state.worldProgress[id] + 1);
  state.worldProgress[id] = charge;
  if (charge >= goal) {
    if (id === "desert") {
      state.worldProgress[id] = 0;
      return {
        coins: finiteEarnings(tap * (4 + pieces * 0.5)),
        bonus: world.mechanic,
      };
    }
    if (id === "frozen" && auto > 0) {
      state.worldProgress[id] = 0;
      if (pieces >= 4) creditResource(state, "shards", 1);
      return {
        coins: finiteEarnings(tap + auto * (5 + pieces)),
        bonus: world.mechanic,
      };
    }
  }
  return { coins: tap };
}

function finiteEarnings(value) {
  return value > 0 ? Math.min(value, Number.MAX_VALUE) : 0;
}

function basePress(state, rates, pieces, random, profile) {
  const id = state.world;
  const goal = worldChargeGoal(id, pieces);
  const {
    coins,
    extraChance = 0,
    ...award
  } = advanceWorldPress(state, rates, pieces, goal);
  let { bonus } = award;
  creditCoins(state, coins);
  state.presses++;
  state.misses++;

  const count = state.chests.reduce(
    (n, chest) => n + Number(recordWorld(chest) === id),
    0,
  );
  if (count >= worldChestLimit) return { coins, bonus };
  const charged = state.worldProgress[id] >= goal;
  const growth = id === firstWorld && charged;
  const starlight = id === "celestial" && charged;
  const firstChest =
    state.opened === 0 && state.chests.length === 0 && state.misses >= 8;
  if (
    random() >= Math.min(dropChanceMax, rates.chance + extraChance) &&
    !growth &&
    !firstChest
  )
    return { coins, bonus };

  const chest = spawnChest(state, {
    boost: starlight ? (pieces >= 2 ? 2 : 1) : 0,
    random,
  });
  if (!chest) return { coins, bonus };
  if (
    !starlight &&
    profile.pathfinder.active &&
    state.abilityProgress.charges > 0 &&
    chest.r < legendary
  ) {
    chest.r++;
    state.abilityProgress.charges--;
    bonus = bonus || "Pathfinder";
  }
  state.misses = 0;
  if (growth || starlight) {
    state.worldProgress[id] = 0;
    return { chest, coins, bonus: bonus || worlds[id].mechanic };
  }
  return { chest, coins, bonus };
}

function getBuild(state) {
  const index = gearIndex(state);
  return buildProfile(slots.map((_, slot) => index.get(state.equip[slot])));
}

function oldestLocalChest(state) {
  return state.chests.find((chest) => recordWorld(chest) === state.world);
}

function applyPress(
  state,
  rates,
  pieces,
  random = Math.random,
  profile = getBuild(state),
) {
  const oldest = profile.hammerhand.active && oldestLocalChest(state);
  const result = basePress(state, rates, pieces, random, profile);
  const { active, count } = profile.hammerhand;
  if (!active) return result;
  const progress = state.abilityProgress;
  const target = count >= 2 ? 15 : 20;
  progress.hammerhand = Math.min(20, progress.hammerhand + 1);
  if (progress.hammerhand < target) return result;
  if (oldest && state.items.length < gearBagLimit) {
    result.opened = collectChest(
      state,
      oldest.id,
      pieces,
      random,
      "ability",
      profile,
    );
    result.ability = "Hammerhand";
  } else if (count >= 4 && !oldestLocalChest(state)) {
    result.chest = spawnChest(state, { forcedRarity: 0, random });
    if (result.chest) result.ability = "Hammerhand";
  }
  if (result.ability) progress.hammerhand = 0;
  return result;
}

function tickClockwork(
  state,
  seconds,
  rates,
  pieces,
  profile,
  random = Math.random,
) {
  const { active, count } = profile.clockwork;
  if (!active || rates.auto <= 0 || seconds <= 0) return null;
  const progress = state.abilityProgress;
  progress.clockwork = Math.min(60000, progress.clockwork + seconds * 1000);
  if (progress.clockwork < (count >= 2 ? 45000 : 60000)) return null;
  const chest = spawnChest(state, { forcedRarity: 0, random });
  const oldest = oldestLocalChest(state);
  const opened =
    !chest && count >= 4 && oldest && state.items.length < gearBagLimit
      ? collectChest(state, oldest.id, pieces, random, "ability", profile)
      : null;
  if (!chest && !opened) return null;
  progress.clockwork = 0;
  return { chest, opened };
}

function collectChest(
  state,
  id,
  pieces,
  random = Math.random,
  source = "manual",
  profile = getBuild(state),
) {
  const chest = state.chests.find((entry) => entry.id === id);
  if (!chest || recordWorld(chest) !== state.world) return null;
  if (state.items.length >= gearBagLimit) return { full: true };
  const slot = Math.floor(random() * slots.length);
  const value = lootValue(
    state.world,
    chest.level,
    slot,
    rarity[chest.r].scale,
    0.85 + random() * 0.3,
  );
  const item = {
    id: nextEntityId(state),
    slot,
    r: chest.r,
    level: chest.level,
    value,
    ...worldTag(state.world),
  };
  const first = discover(state, item);
  const disposition = resolveLoot(state, item, first, {
    lookup: (id) => gearIndex(state).get(id),
    put: addGearItem,
    value: gearValue,
    payout: salvageYield,
  });
  state.chests = state.chests.filter((entry) => entry.id !== id);
  state.opened++;
  if (state.world === "volcano") {
    state.worldProgress.volcano = Math.max(
      state.worldProgress.volcano,
      8 + 2 * pieces,
    );
  }
  const shards = progressionAccess(state).shards;
  const gathered = trackOpening(state, profile, source, shards);
  if (shards)
    creditResource(state, "shards", (1 + chest.r) * (1 + state.asc.up.wisdom));
  return { chest, item, disposition, gathered };
}

function equipItem(state, item, toggle) {
  if (!item || gearIndex(state).get(item.id) !== item) return false;
  if (toggle && state.equip[item.slot] === item.id)
    delete state.equip[item.slot];
  else state.equip[item.slot] = item.id;
  return true;
}

function workshopCost(state, upgrade) {
  return Math.ceil(upgrade.base * Math.pow(upgrade.rate, state.up[upgrade.id]));
}

function skillLearnCost(state, skill) {
  return skill.base + (state.skills[skill.id] || 0) * 2;
}

function buyWorkshopUpgrade(state, upgrade) {
  if (
    !upgrade ||
    !hasUpgradeAccess(state, upgrade) ||
    state.up[upgrade.id] >= (upgrade.max || 100)
  )
    return false;
  if (!spendResource(state, "coins", workshopCost(state, upgrade)))
    return false;
  state.up[upgrade.id]++;
  return true;
}

function learnSkill(state, skill) {
  if (
    !progressionAccess(state).skills ||
    !skill ||
    skill.id === "root" ||
    !skill.req.every((id) => hasSkill(state, id)) ||
    state.skills[skill.id] >= skill.max
  )
    return false;
  if (!spendResource(state, "shards", skillLearnCost(state, skill)))
    return false;
  state.skills[skill.id]++;
  return true;
}

export {
  applyPress,
  getBuild,
  tickClockwork,
  buyWorkshopUpgrade,
  collectChest,
  equipItem,
  fieldLevel,
  gearBagLimit,
  learnSkill,
  nextEntityId,
  skillLearnCost,
  spawnChest,
  workshopCost,
  worldChestLimit,
};
