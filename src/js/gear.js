import { hasMaterials, mineAt, temperCost, useMaterials } from "./sites.js";
import { hasRunCoins, progressionThresholds } from "./progression.js";
import { creditCoins, creditResource } from "./resources.js";
import { worlds } from "./world-data.js";

const gearIndexes = new WeakMap();

function gearIndex(run) {
  let index = gearIndexes.get(run);
  if (!index) {
    index = new Map(run.items.map((item) => [item.id, item]));
    gearIndexes.set(run, index);
  }
  return index;
}

function addGearItem(run, item) {
  const index = gearIndex(run);
  run.items.push(item);
  index.set(item.id, item);
}

function removeGearItem(run, id) {
  if (!gearIndex(run).delete(id)) return false;
  const index = run.items.findIndex((item) => item.id === id);
  if (index !== -1) run.items.splice(index, 1);
  return true;
}

const maxForgeRank = 3;
const forgeUnlock = progressionThresholds.forge;

const regionalSets = {
  grasslands: {
    goals: [21, 17],
    two: "Wild Growth charges in 21 presses.",
    four: "Wild Growth charges in 17 presses.",
  },
  desert: {
    goals: [10, 8],
    two: "Dune Surge charges in 10 presses.",
    four: "Dune Surge charges in 8 presses.",
  },
  frozen: {
    goals: [9, 9],
    two: "Thaw charges in 9 presses.",
    four: "Thaw also grants one shard.",
  },
  volcano: {
    two: "Forge Heat pays 2.25× coins per press.",
    four: "Heated presses gain 8 percentage points of chest chance, up to the 55% cap.",
  },
  celestial: {
    goals: [20, 15],
    two: "Starlight raises chest rarity by two tiers.",
    four: "Starlight charges in 15 presses.",
  },
};

function worldChargeGoal(id, pieces) {
  const goals = regionalSets[id].goals;
  return goals && pieces >= 2 ? goals[pieces >= 4 ? 1 : 0] : worlds[id].limit;
}

function gearValue(item) {
  if (!item) return 0;
  if (!item.forge) return item.value;
  return Math.round(item.value * (100 + 12 * item.forge)) / 100;
}

function salvageYield(item) {
  const rank = Math.min(4, item.r);
  return { coins: 2 + rank * 3, scrap: 1 + rank };
}

function salvageGear(state, item) {
  if (
    !item ||
    item.locked ||
    state.equip[item.slot] === item.id ||
    !removeGearItem(state, item.id)
  )
    return null;
  const payout = salvageYield(item);
  creditCoins(state, payout.coins);
  creditResource(state, "scrap", payout.scrap);
  return payout;
}

function forgeCost(item) {
  const rank = item.forge || 0;
  return {
    coins: 25 * (item.r + 1) * (rank + 1) ** 2,
    scrap: 2 + item.r + 2 * rank,
  };
}

function forgeOffer(state, item) {
  const rank = item.forge || 0;
  const cost = forgeCost(item);
  const maxed = rank >= maxForgeRank;
  const locked = !hasRunCoins(state, forgeUnlock);
  return {
    rank,
    maxed,
    cost,
    available:
      !maxed &&
      !locked &&
      state.coins >= cost.coins &&
      state.scrap >= cost.scrap,
    locked,
  };
}

function materialOffer(state, item) {
  const forge = forgeOffer(state, item);
  const cost = temperCost(forge.cost, forge.rank);
  return !forge.locked && !forge.maxed && state.total >= mineAt && cost
    ? { cost, available: hasMaterials(state, cost) }
    : null;
}

function forgeGear(state, item, gathered = false) {
  if (!item || gearIndex(state).get(item.id) !== item) return false;
  const offer = forgeOffer(state, item);
  const payment = gathered ? materialOffer(state, item) : offer;
  if (!payment?.available || !useMaterials(state, payment.cost)) return false;
  item.forge = offer.rank + 1;
  return true;
}

export {
  addGearItem,
  gearIndex,
  forgeGear,
  forgeOffer,
  materialOffer,
  forgeUnlock,
  gearValue,
  maxForgeRank,
  regionalSets,
  salvageGear,
  salvageYield,
  worldChargeGoal,
};
