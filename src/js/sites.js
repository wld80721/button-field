import { milestones } from "./data.js";
import { creditResource, spendResource } from "./resources.js";

const farmAt = milestones.shards;
const mineAt = milestones.helper;
const swingMs = 3000;

const materials = {
  glowleaf: "Glowleaf",
  rootFiber: "Root Fiber",
  prismEssence: "Prism Essence",
  copperOre: "Copper Ore",
  silverOre: "Silver Ore",
  starCrystals: "Star Crystals",
};

const crops = {
  glowleaf: {
    name: "Glowleaf",
    at: farmAt,
    ms: 12000,
    cost: { coins: 25 },
    material: "glowleaf",
    yield: 3,
    effect:
      "The next three presses give growing crops two bonus seconds instead of one.",
    color: "#a6f27b",
  },
  ironroot: {
    name: "Ironroot",
    at: mineAt,
    ms: 18000,
    cost: { coins: 50, copperOre: 1 },
    material: "rootFiber",
    yield: 2,
    effect: "Advance each recovering deposit by six seconds.",
    color: "#efa478",
  },
  prismbloom: {
    name: "Prismbloom",
    at: milestones.frozen,
    ms: 24000,
    cost: { coins: 120, silverOre: 1 },
    material: "prismEssence",
    yield: 1,
    effect:
      "Bank one charge for an extra Star Crystal on your next crystal clear.",
    color: "#e6b0ff",
  },
};

const deposits = {
  copper: {
    name: "Copper",
    rarity: "Common",
    at: mineAt,
    tool: 0,
    hp: 3,
    ms: 8000,
    material: "copperOre",
    yield: 4,
    color: "#ed9e6f",
  },
  silver: {
    name: "Silver",
    rarity: "Uncommon",
    at: milestones.ascension,
    tool: 1,
    hp: 5,
    ms: 12000,
    material: "silverOre",
    yield: 3,
    color: "#d8efff",
  },
  crystal: {
    name: "Star Crystal",
    rarity: "Rare",
    at: milestones.frozen,
    tool: 1,
    hp: 7,
    ms: 20000,
    material: "starCrystals",
    yield: 2,
    color: "#c595ff",
  },
};

const tools = [
  { name: "Stone Pick", damage: 1 },
  {
    name: "Copper Pick",
    damage: 2,
    cost: { coins: 300, copperOre: 6, glowleaf: 3 },
  },
  {
    name: "Resonant Pick",
    damage: 3,
    cost: { coins: 2000, silverOre: 6, starCrystals: 2, rootFiber: 4 },
  },
];

const research = {
  extraPlot: {
    name: "Second plot",
    at: mineAt,
    cost: { coins: 150, glowleaf: 6, copperOre: 3 },
    effect: "Plant and grow a second crop.",
  },
  irrigation: {
    name: "Irrigation",
    at: milestones.ascension,
    cost: { coins: 500, rootFiber: 6, silverOre: 4 },
    effect: "New crops grow three seconds faster.",
  },
  harvester: {
    name: "Auto Harvest",
    at: milestones.frozen,
    cost: { coins: 2000, glowleaf: 8, rootFiber: 6, starCrystals: 2 },
    effect: "Automatically harvest ripe crops. Planting remains manual.",
  },
};

const minerUpgrade = {
  name: "Auto Mining",
  at: milestones.frozen,
  cost: { coins: 1800, rootFiber: 6, silverOre: 4, starCrystals: 1 },
};
const gatheredRecipeCost = { coins: 650, copperOre: 4, glowleaf: 4 };
const temperIngredients = [
  { copperOre: 3, glowleaf: 2 },
  { silverOre: 2, rootFiber: 2 },
  { starCrystals: 1, prismEssence: 1 },
];

function temperCost(standard, rank) {
  const ingredients = temperIngredients[rank];
  return (
    ingredients && {
      coins: Math.ceil(standard.coins * 0.75),
      scrap: Math.ceil(standard.scrap * 0.5),
      ...ingredients,
    }
  );
}

function hasMaterials(state, cost) {
  return Object.entries(cost).every(
    ([resource, amount]) => state[resource] >= amount,
  );
}

function useMaterials(state, cost) {
  if (!hasMaterials(state, cost)) return false;
  for (const [resource, amount] of Object.entries(cost))
    spendResource(state, resource, amount);
  return true;
}

function freshSites() {
  return {
    plots: [null, null],
    research: { extraPlot: false, irrigation: false, harvester: false },
    growthCharges: 0,
    crystalFocus: false,
    autoHarvest: false,
    pick: 0,
    veins: Object.fromEntries(
      Object.entries(deposits).map(([id, def]) => [
        id,
        { hp: def.hp, remaining: 0 },
      ]),
    ),
    minerOwned: false,
    autoMine: false,
    target: "copper",
    swing: 0,
  };
}

function depositAccess(state, id) {
  return (
    typeof id === "string" &&
    Object.hasOwn(deposits, id) &&
    state.total >= deposits[id].at &&
    state.sites.pick >= deposits[id].tool
  );
}

function plotCount(state) {
  return state.total < farmAt ? 0 : state.sites.research.extraPlot ? 2 : 1;
}

function canPlant(state, index, id) {
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < plotCount(state) &&
    !state.sites.plots[index] &&
    typeof id === "string" &&
    Object.hasOwn(crops, id) &&
    state.total >= crops[id].at &&
    hasMaterials(state, crops[id].cost)
  );
}

function plant(state, index, id) {
  if (!canPlant(state, index, id)) return false;
  const crop = crops[id];
  useMaterials(state, crop.cost);
  state.sites.plots[index] = {
    crop: id,
    remaining: crop.ms - (state.sites.research.irrigation ? 3000 : 0),
  };
  return true;
}

function recoverVeins(state, elapsed) {
  let changed = false;
  for (const id of Object.keys(deposits)) {
    const vein = state.sites.veins[id];
    if (vein.remaining <= 0 || !depositAccess(state, id)) continue;
    vein.remaining = Math.max(0, vein.remaining - elapsed);
    if (vein.remaining === 0) vein.hp = deposits[id].hp;
    changed = true;
  }
  return changed;
}

function harvest(state, index) {
  const plot = state.sites.plots[index];
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= plotCount(state) ||
    !plot ||
    plot.remaining !== 0
  )
    return null;
  state.sites.plots[index] = null;
  const def = crops[plot.crop];
  creditResource(state, def.material, def.yield);
  if (plot.crop === "glowleaf") state.sites.growthCharges = 3;
  if (plot.crop === "ironroot") recoverVeins(state, 6000);
  if (plot.crop === "prismbloom") state.sites.crystalFocus = true;
  return { material: def.material, amount: def.yield };
}

function mine(state, id) {
  if (!depositAccess(state, id)) return null;
  const site = state.sites;
  const vein = site.veins[id];
  if (vein.remaining !== 0 || vein.hp <= 0) return null;
  vein.hp = Math.max(0, vein.hp - tools[site.pick].damage);
  if (vein.hp) return { material: deposits[id].material, amount: 0 };
  const def = deposits[id];
  vein.remaining = def.ms;
  if (site.target === id) site.swing = 0;
  const extra = id === "crystal" && site.crystalFocus;
  if (extra) site.crystalFocus = false;
  const amount = def.yield + Number(extra);
  creditResource(state, def.material, amount);
  return { material: def.material, amount };
}

function buyResearch(state, id) {
  if (typeof id !== "string" || !Object.hasOwn(research, id)) return false;
  const def = research[id];
  if (
    state.total < def.at ||
    state.sites.research[id] ||
    !useMaterials(state, def.cost)
  )
    return false;
  state.sites.research[id] = true;
  return true;
}

function buyPick(state) {
  const site = state.sites;
  const next = tools[site.pick + 1];
  if (state.total < mineAt || !next || !useMaterials(state, next.cost))
    return false;
  site.pick++;
  return true;
}

function buyMiner(state) {
  const site = state.sites;
  if (
    state.total < minerUpgrade.at ||
    site.pick < 1 ||
    site.minerOwned ||
    !useMaterials(state, minerUpgrade.cost)
  )
    return false;
  site.minerOwned = true;
  return true;
}

function setHarvestMode(state, enabled) {
  if (!state.sites.research.harvester) return false;
  state.sites.autoHarvest = enabled === true;
  return true;
}

function setMiningMode(state, enabled, target) {
  const site = state.sites;
  if (!site.minerOwned || !depositAccess(state, target)) return false;
  const active = enabled === true;
  if (site.target !== target || site.autoMine !== active) site.swing = 0;
  site.target = target;
  site.autoMine = active;
  return true;
}

function advanceSites(state, elapsed, press = false) {
  const rewards = [];
  if (!Number.isFinite(elapsed) || elapsed <= 0 || state.total < farmAt)
    return { changed: false, rewards };
  const site = state.sites;
  const availablePlots = plotCount(state);
  const grew = site.plots
    .slice(0, availablePlots)
    .some((plot) => plot?.remaining > 0);
  let growth = elapsed;
  if (press && grew && site.growthCharges > 0) {
    growth *= 2;
    site.growthCharges--;
  }
  const targeted = site.veins[site.target];
  const recoveryBefore = targeted.remaining;
  let changed = recoverVeins(state, elapsed) || grew;
  for (let index = 0; index < availablePlots; index++) {
    const plot = site.plots[index];
    if (!plot) continue;
    plot.remaining = Math.max(0, plot.remaining - growth);
    if (site.autoHarvest && plot.remaining === 0) {
      rewards.push(harvest(state, index));
      changed = true;
    }
  }
  if (
    !press &&
    site.autoMine &&
    depositAccess(state, site.target) &&
    targeted.remaining === 0
  ) {
    const eligible = Math.max(0, elapsed - recoveryBefore);
    if (eligible > 0) {
      site.swing += eligible;
      changed = true;
      while (site.swing >= swingMs && targeted.remaining === 0) {
        site.swing -= swingMs;
        const outcome = mine(state, site.target);
        if (outcome?.amount) rewards.push(outcome);
      }
    }
  }
  return { changed, rewards };
}

function normalizeSites(state, raw) {
  const site = state.sites;
  const bounded = (value, cap) =>
    Number.isFinite(value) ? Math.max(0, Math.min(cap, value)) : 0;
  for (const [id, def] of Object.entries(research))
    site.research[id] = state.total >= def.at && raw?.research?.[id] === true;
  for (let i = 0; i < plotCount(state); i++) {
    const plot = raw?.plots?.[i];
    if (typeof plot?.crop !== "string" || !Object.hasOwn(crops, plot.crop))
      continue;
    const def = crops[plot.crop];
    if (state.total >= def.at && Number.isFinite(plot.remaining))
      site.plots[i] = {
        crop: plot.crop,
        remaining: bounded(plot.remaining, def.ms),
      };
  }
  if (state.total >= farmAt)
    site.growthCharges = Math.floor(bounded(raw?.growthCharges, 3));
  site.autoHarvest = site.research.harvester && raw?.autoHarvest === true;
  if (state.total < mineAt) return;
  site.pick = Math.floor(bounded(raw?.pick, tools.length - 1));
  for (const [id, def] of Object.entries(deposits)) {
    if (!depositAccess(state, id)) continue;
    const vein = raw?.veins?.[id];
    const remaining = bounded(vein?.remaining, def.ms);
    site.veins[id] = {
      remaining,
      hp:
        remaining > 0
          ? 0
          : Math.max(1, Math.floor(bounded(vein?.hp ?? def.hp, def.hp))),
    };
  }
  site.crystalFocus =
    state.total >= crops.prismbloom.at && raw?.crystalFocus === true;
  site.minerOwned =
    state.total >= minerUpgrade.at &&
    site.pick >= 1 &&
    raw?.minerOwned === true;
  site.autoMine = site.minerOwned && raw?.autoMine === true;
  if (depositAccess(state, raw?.target)) site.target = raw.target;
  site.swing =
    site.autoMine && site.veins[site.target].remaining === 0
      ? bounded(raw?.swing, swingMs - 1)
      : 0;
}

export {
  farmAt,
  mineAt,
  materials,
  crops,
  deposits,
  tools,
  research,
  minerUpgrade,
  gatheredRecipeCost,
  temperCost,
  hasMaterials,
  useMaterials,
  freshSites,
  depositAccess,
  plotCount,
  canPlant,
  plant,
  harvest,
  mine,
  buyResearch,
  buyPick,
  buyMiner,
  setHarvestMode,
  setMiningMode,
  advanceSites,
  normalizeSites,
};
