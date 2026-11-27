import { milestones, stages } from "./data.js";
import { fmtExact } from "./numbers.js";
import { worlds } from "./world-data.js";

const progressionThresholds = Object.freeze({ ...milestones, firstWheel: 50 });

const coinUnlocks = [
  [
    progressionThresholds.workshop,
    "Workshop",
    "Buy your first button upgrade.",
  ],
  [
    progressionThresholds.forge,
    "Equipment forge",
    "Spend scrap and coins to improve a piece of gear.",
  ],
  [
    progressionThresholds.forge,
    "Treasure compass",
    "Raise your chest drop chance at the Workshop.",
  ],
  [
    progressionThresholds.shards,
    "Shards and skill tree",
    "Open chests for shards and spend them on skills.",
  ],
  [
    progressionThresholds.helper,
    "Garden helper + Set recipes",
    "Buy automatic income at the Workshop or craft a set piece in Gear.",
  ],
  [
    progressionThresholds.ascension,
    "Ascension",
    "Begin a new run to earn permanent stars.",
  ],
];

function hasRunCoins(state, amount) {
  return state.total >= amount;
}

function hasSkill(state, id) {
  return id === "root" || state.skills[id] > 0;
}

function hasUpgradeAccess(state, upgrade) {
  return upgrade.requires
    ? hasSkill(state, upgrade.requires)
    : hasRunCoins(state, upgrade.at);
}

function hasAscensionAccess(state) {
  return (
    state.asc.runs > 0 || hasRunCoins(state, progressionThresholds.ascension)
  );
}

function progressionAccess(state) {
  const shards = hasRunCoins(state, progressionThresholds.shards);
  return {
    gear: state.items.length > 0 || state.opened > 0,
    collection: state.opened > 0,
    workshop: hasRunCoins(state, progressionThresholds.workshop),
    skills: shards || state.asc.runs > 0,
    shards,
    gardenHelper: hasRunCoins(state, progressionThresholds.helper),
  };
}

function chapterIndex(state) {
  for (let index = stages.length - 1; index > 0; index--)
    if (hasRunCoins(state, stages[index].at)) return index;
  return 0;
}

function chapterHint(index) {
  if (stages[index].at === progressionThresholds.shards)
    return "Open chests for shards, then spend them on skills.";
  if (stages[index].at === progressionThresholds.helper)
    return "The Workshop now offers the Garden helper.";
  return stages[index].text;
}

function nextWorld(state) {
  return Object.entries(worlds).find(
    ([, world]) => !hasRunCoins(state, world.at),
  );
}

function nextCoinUnlocks(state) {
  const entries = [
    ...coinUnlocks,
    ...Object.values(worlds).map((world) => [
      world.at,
      world.name,
      "Travel there from the Worlds menu.",
    ]),
  ].filter(([amount]) => !hasRunCoins(state, amount));
  const grouped = new Map();
  for (const [target, name, description] of entries) {
    if (!grouped.has(target)) grouped.set(target, { target, unlocks: [] });
    grouped.get(target).unlocks.push({ name, description });
  }
  return [...grouped.values()].sort((a, b) => a.target - b.target).slice(0, 2);
}

function canPreviewAscension(state) {
  const limit = guideGoal(state) ? 1 : 2;
  return nextCoinUnlocks(state)
    .slice(0, limit)
    .some((tier) => tier.target === progressionThresholds.ascension);
}

function guideGoal(state) {
  if (state.opened === 0)
    return "Open your first chest to discover gear and start your collection.";
  if (state.wheelClaims === 0) {
    const remaining = Math.max(0, state.wheelNextAt - state.presses);
    return remaining === 0
      ? "Your first milestone reward is ready at the wheel."
      : "Make " +
          fmtExact(Math.ceil(remaining)) +
          " more presses to unlock the milestone wheel.";
  }
  return "";
}

const worldMilestones = Object.values(worlds).filter((world) => world.at > 0);

function worldUnlockMessage(before, after) {
  let latest;
  let count = 0;
  for (const world of worldMilestones) {
    if (before < world.at && after >= world.at) {
      latest = world;
      count++;
    }
  }
  if (count)
    return count === 1
      ? "World unlocked · " + latest.name
      : count + " worlds unlocked";
  return null;
}

export {
  canPreviewAscension,
  chapterHint,
  chapterIndex,
  guideGoal,
  hasAscensionAccess,
  hasRunCoins,
  hasSkill,
  hasUpgradeAccess,
  nextCoinUnlocks,
  nextWorld,
  progressionAccess,
  progressionThresholds,
  worldUnlockMessage,
};
