import { signatureAbility, signatureLoadout } from "./blacksmith-data.js";
import { advanceSites, depositAccess, mine } from "./sites.js";

const targets = ["crystal", "silver", "copper"];

function chargeSignature(state, id, goal) {
  const charge = state.blacksmith.charge;
  charge[id] = Math.min(goal, charge[id] + 1);
  return charge[id] === goal;
}

function fieldSignatures(state, gear, tap, clone) {
  const effects = [];
  const lightning = signatureLoadout(gear, "sparkforged");
  if (lightning) {
    const { goal, hits, chain } = signatureAbility("sparkforged", lightning);
    if (chargeSignature(state, "sparkforged", goal)) {
      const ready = targets.filter((id) => depositAccess(state, id) && state.sites.veins[id].remaining === 0);
      if (ready.length) {
        const rewards = [];
        for (const [index, target] of (chain ? ready : ready.slice(0, 1)).entries()) {
          const swings = index === 0 ? hits : 1;
          for (let i = 0; i < swings; i++) {
            const hit = mine(state, target);
            if (hit?.amount) {
              rewards.push(hit);
              break;
            }
          }
        }
        state.blacksmith.charge.sparkforged = 0;
        effects.push({ type: "lightning", rewards });
      }
    }
  }

  const nature = signatureLoadout(gear, "wildroot");
  if (nature) {
    const { goal, capacity } = signatureAbility("wildroot", nature);
    if (state.blacksmith.seeds < capacity && chargeSignature(state, "wildroot", goal)) {
      state.blacksmith.seeds++;
      state.blacksmith.charge.wildroot = 0;
      effects.push({ type: "seed" });
    }
  }

  const phantom = signatureLoadout(gear, "wraithweave");
  if (phantom && !clone) {
    const { goal, taps } = signatureAbility("wraithweave", phantom);
    if (chargeSignature(state, "wraithweave", goal)) {
      state.blacksmith.charge.wraithweave = 0;
      effects.push({ type: "summon", clone: { id: phantom.id, taps, coins: tap / 2, elapsed: 0 } });
    }
  }
  return effects;
}

function advanceClone(state, clone, elapsed) {
  if (!clone || state.combat.attempt || state.equip[3] !== clone.id) return { clone: null };
  clone.elapsed += elapsed;
  if (clone.elapsed < 1000) return { clone };
  clone.elapsed -= 1000;
  clone.taps--;
  return { clone: clone.taps ? clone : null, coins: clone.coins, rewards: advanceSites(state, 1000, true, true).rewards };
}

export { fieldSignatures, advanceClone };
