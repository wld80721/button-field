const blueprints = {
  sparkforged: {
    name: "Sparkforged", signature: "Thunder Gauntlet", slot: 0,
    style: "Mining", color: "#7ddfff", emblem: "bolt",
    clue: "Manually clear the Copper deposit in the Mine.",
    at: 2500, cost: { coins: 650, copperOre: 4, scrap: 4 },
    ability: "Every 20 manual field presses, strike the highest-tier ready deposit.",
    two: "Charge in 15 presses.", four: "Also strike each other ready deposit once.",
  },
  wraithweave: {
    name: "Wraithweave", signature: "Phantom Charm", slot: 3,
    style: "Echo presses", color: "#c6a2f4", emblem: "ghost",
    clue: "Claim a Grove Trail expedition at the Companion camp.",
    at: 2500, cost: { coins: 650, glowleaf: 3, scrap: 6 },
    ability: "Every 24 manual field presses, summon a clone that taps the red button.",
    two: "Charge in 18 presses.", four: "The clone makes one extra tap.",
  },
  wildroot: {
    name: "Wildroot", signature: "Nature Boots", slot: 2,
    style: "Farming", color: "#a8d879", emblem: "seed",
    clue: "Manually harvest Glowleaf from the Garden.",
    at: 2500, cost: { coins: 650, glowleaf: 4, copperOre: 2 },
    ability: "Every 15 manual field presses, bank a seed to plant free Glowleaf.",
    two: "Charge in 12 presses.", four: "Bank one extra seed.",
  },
  dragonfire: {
    name: "Dragonfire", signature: "Dragon Ring", slot: 1,
    style: "Combat", color: "#ff9869", emblem: "flame",
    clue: "Defeat Mossguard through the Boss Board.",
    at: 5000, cost: { coins: 1200, copperOre: 4, scrap: 8, shards: 4 },
    ability: "After a successful Guard, your next manual strike launches a fireball.",
    two: "Fireballs deal 4 extra base damage.", four: "Start each fight with a fireball ready.",
  },
};

const fieldCharge = { sparkforged: [20, 15], wraithweave: [24, 18], wildroot: [15, 12] };
const freshBlacksmith = () => ({ recipes: [], charge: { sparkforged: 0, wraithweave: 0, wildroot: 0 }, seeds: 0 });

function unlockBlueprint(state, id) {
  if (!state.blacksmith || !Object.hasOwn(blueprints, id) || state.blacksmith.recipes.includes(id)) return false;
  state.blacksmith.recipes.push(id);
  return true;
}

function normalizeBlacksmith(state, raw) {
  const clean = freshBlacksmith();
  const boundedInt = (value, max) => Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
  clean.recipes = Object.keys(blueprints).filter((id) => Array.isArray(raw?.recipes) && raw.recipes.includes(id));
  clean.seeds = boundedInt(raw?.seeds, 4);
  for (const [id, [max]] of Object.entries(fieldCharge)) clean.charge[id] = boundedInt(raw?.charge?.[id], max);
  state.blacksmith = clean;
  if (state.companions.artifacts.includes("bell")) unlockBlueprint(state, "wraithweave");
  if (state.combat.records.mossguard) unlockBlueprint(state, "dragonfire");
}

function signatureLoadout(gear, id) {
  const piece = gear[blueprints[id].slot];
  if (piece?.set !== id) return null;
  return { id: piece.id, count: gear.filter((item) => item?.set === id).length, tier: Math.max(0, piece.r - 4) };
}

function signatureAbility(id, loadout) {
  const { tier, count } = loadout;
  const paired = count >= 2;
  const full = count >= 4;
  const goal = fieldCharge[id]?.[Number(paired)];
  switch (id) {
    case "sparkforged": return { goal, hits: 1 + tier, chain: full };
    case "wraithweave": return { goal, taps: 3 + tier + Number(full) };
    case "wildroot": return { goal, capacity: 1 + tier + Number(full) };
    case "dragonfire": return { damage: 8 + tier * 4 + Number(paired) * 4, opener: full };
  }
}

function signatureText(id, loadout) {
  const effect = signatureAbility(id, loadout);
  switch (id) {
    case "sparkforged": return `${effect.hits} lightning strike(s) every ${effect.goal} presses${effect.chain ? " · chains to other deposits" : ""}`;
    case "wraithweave": return `${effect.taps} clone taps every ${effect.goal} presses`;
    case "wildroot": return `Seed every ${effect.goal} presses · stock ${effect.capacity}`;
    case "dragonfire": return `${effect.damage} fireball damage after Guard${effect.opener ? " · starts primed" : ""}`;
  }
}

export { blueprints, freshBlacksmith, normalizeBlacksmith, unlockBlueprint, signatureLoadout, signatureAbility, signatureText };
