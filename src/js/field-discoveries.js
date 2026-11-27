import { milestones } from "./data.js";
import { creditResource } from "./resources.js";
import { firstWorld } from "./world-data.js";

const discoveries = {
  stone: {
    at: milestones.workshop, name: "Carved stone", clue: "Inspect the glint by the trail",
    resource: "scrap", reward: "1 scrap",
  },
  carving: {
    at: milestones.shards, name: "Wooden carving", clue: "Look inside the hollow stump",
    resource: "glowleaf", reward: "1 Glowleaf",
  },
  lantern: {
    at: milestones.helper, name: "Old lantern", clue: "Lift the loose rock",
    resource: "copperOre", reward: "1 Copper Ore",
  },
};

function normalizeDiscoveries(raw) {
  return Object.keys(discoveries).filter((id) => Array.isArray(raw) && raw.includes(id));
}

function claimDiscovery(state, id) {
  if (!Object.hasOwn(discoveries, id) || state.world !== firstWorld) return null;
  const find = discoveries[id];
  if (state.total < find.at || state.fieldDiscoveries.includes(id)) return null;
  state.fieldDiscoveries.push(id);
  creditResource(state, find.resource, 1);
  return find;
}

export { claimDiscovery, discoveries, normalizeDiscoveries };
