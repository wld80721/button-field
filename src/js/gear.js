import { hasRunCoins, progressionThresholds } from "./progression.js";
import { creditCoins, creditResource, spendResource } from "./resources.js";
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
  return { coins: 2 + item.r * 3, scrap: 1 + item.r };
}

function salvageGear(state, item) {
  if (
    !item ||
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

function forgeGear(state, item) {
  if (!item || gearIndex(state).get(item.id) !== item) return false;
  const offer = forgeOffer(state, item);
  if (!offer.available) return false;
  spendResource(state, "coins", offer.cost.coins);
  spendResource(state, "scrap", offer.cost.scrap);
  item.forge = offer.rank + 1;
  return true;
}

export {
  addGearItem,
  gearIndex,
  forgeGear,
  forgeOffer,
  forgeUnlock,
  gearValue,
  maxForgeRank,
  regionalSets,
  salvageGear,
  salvageYield,
  worldChargeGoal,
};
