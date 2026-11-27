import { keepCombat } from "./combat.js";
import { keepCompanions } from "./companions.js";
import { progressionThresholds } from "./progression.js";
import { creditResource, spendResource } from "./resources.js";
import { fresh } from "./state.js";

function ascensionReward(state) {
  return Math.floor(Math.sqrt(state.total / progressionThresholds.ascension));
}

function ascCoinGoal(stars) {
  return Math.min(
    Number.MAX_VALUE,
    progressionThresholds.ascension * stars ** 2,
  );
}

function ascensionCost(state, upgrade) {
  return Math.ceil(upgrade.base * Math.pow(1.65, state.asc.up[upgrade.id]));
}

function buyAscensionUpgrade(state, upgrade) {
  if (
    !upgrade ||
    state.asc.runs < upgrade.req ||
    state.asc.up[upgrade.id] >= upgrade.max
  )
    return false;
  if (!spendResource(state, "stars", ascensionCost(state, upgrade)))
    return false;
  state.asc.up[upgrade.id]++;
  return true;
}

function performAscension(state) {
  const stars = ascensionReward(state);
  if (stars < 1) return null;
  const run = fresh();
  run.companions = keepCompanions(state);
  run.combat = keepCombat(state);
  run.fieldDiscoveries = [...state.fieldDiscoveries];
  run.lootRules = { ...state.lootRules };
  run.asc = {
    ...state.asc,
    runs: state.asc.runs + 1,
    earned: Math.min(Number.MAX_VALUE, state.asc.earned + stars),
    up: { ...state.asc.up },
  };
  creditResource(run, "stars", stars);
  run.coins = run.asc.up.seed * 250;
  return { run, stars };
}

export {
  ascCoinGoal,
  ascensionCost,
  ascensionReward,
  buyAscensionUpgrade,
  performAscension,
};
