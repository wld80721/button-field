import { buildRecipe, canPay, evolutionOffer, evolveGear, recipePayment } from "./build-gear.js";
import { addGearItem, forgeGear, forgeOffer, gearIndex, materialOffer } from "./gear.js";
import { slots } from "./data.js";
import { gearBagLimit, nextEntityId } from "./gameplay.js";

const cycle = 1800;

function beginWork(state, { kind, id, set, slot, gathered = false }) {
  if (!["craft", "temper", "evolve"].includes(kind)) return null;
  let item;
  let offer;
  if (kind === "craft") {
    const cost = recipePayment(state, set, gathered);
    if (!Number.isInteger(slot) || slot < 0 || slot >= slots.length || !cost || !canPay(state, cost) || state.items.length >= gearBagLimit) return null;
  } else {
    item = gearIndex(state).get(id);
    if (!item) return null;
    offer = kind === "evolve" ? evolutionOffer(state, item)
      : gathered ? materialOffer(state, item) : forgeOffer(state, item);
    if (!offer?.available) return null;
  }
  const advanced = kind === "evolve" && item.r >= 4;
  const targets = kind === "temper" ? [50, 50] : advanced ? [50, 30, 70, 50] : [50, 30, 70];
  return {
    state, kind, id, set, slot, gathered, item, rarity: item?.r, rank: item?.forge,
    world: state.world, stage: "furnace", targets, band: advanced ? 10 : 15,
    struck: 0, started: 0,
  };
}

function heatWork(work, now) {
  if (work.stage !== "furnace") return false;
  work.stage = "anvil";
  work.started = now;
  return true;
}

function markerAt(work, now) {
  return Math.max(0, now - work.started) % cycle / cycle * 100;
}

function strikeWork(work, now, assist) {
  if (work.stage !== "anvil") return false;
  if (!assist && Math.abs(markerAt(work, now) - work.targets[work.struck]) > work.band) return false;
  work.struck++;
  work.started = now;
  if (work.struck === work.targets.length) work.stage = "quench";
  return true;
}

function quenchWork(state, work, level) {
  if (work.stage !== "quench" || state !== work.state || state.world !== work.world) return null;
  work.stage = "complete";
  if (work.kind === "craft")
    return buildRecipe(state, work.set, work.slot, level, nextEntityId, addGearItem, gearBagLimit, work.gathered);
  const item = gearIndex(state).get(work.id);
  if (!item || item !== work.item || item.r !== work.rarity || item.forge !== work.rank) return null;
  const success = work.kind === "evolve" ? evolveGear(state, item) : forgeGear(state, item, work.gathered);
  return success ? item : null;
}

export { beginWork, heatWork, markerAt, strikeWork, quenchWork };
