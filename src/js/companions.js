import { milestones } from "./data.js";
import { collectChest, gearBagLimit } from "./gameplay.js";
import { creditCoins, creditResource } from "./resources.js";
import {
  advanceCrops,
  depositAccess,
  deposits,
  harvest,
  mine,
  recoverVeins,
  useMaterials,
} from "./sites.js";
import { recordWorld } from "./world-data.js";

const {
  companions: companionsAt,
  expeditions: expeditionsAt,
  secondCompanionSlot: secondFieldAt,
  secondExpeditionSlot: secondTripAt,
} = milestones;
const evolutionCost = { coins: 1500, shards: 8, rootFiber: 3 };
const maxXp = 810;
const roster = {
  beetle: {
    name: "Button Beetle",
    seconds: 8,
    need: "150 earned and one chest opened",
    ready: (s) => s.opened >= 1,
    ability: "Presses for 40% of normal tap income.",
    action: "press",
    power: 0.4,
    color: "#f57965",
    art: [
      "..0110..",
      ".012210.",
      "01233210",
      "01222210",
      ".012210.",
      "0.0110.0",
    ],
  },
  sparrow: {
    name: "Scrap Sparrow",
    seconds: 20,
    need: "150 earned and 3 scrap held",
    ready: (s) => s.scrap >= 3,
    ability: "Gathers 1 scrap.",
    action: "scrap",
    color: "#e8bc71",
    art: [
      "....011.",
      "...01230",
      "01112200",
      ".012221.",
      "..01210.",
      "...0.0..",
    ],
  },
  mouse: {
    name: "Latch Mouse",
    seconds: 20,
    need: "600 earned and five chests opened",
    ready: (s) => s.total >= 600 && s.opened >= 5,
    ability: "Opens the oldest Common or Uncommon chest.",
    action: "chest",
    grades: [0, 1],
    color: "#b9b0cf",
    art: [
      "..01.01.",
      "..01010.",
      "0012320.",
      "01222210",
      ".012210.",
      "00.0.0..",
    ],
  },
  moth: {
    name: "Glow Moth",
    seconds: 10,
    need: "3 Glowleaf held",
    ready: (s) => s.glowleaf >= 3,
    ability: "Advances all growing crops by 2s.",
    action: "grow",
    amount: 2000,
    all: true,
    color: "#b6f489",
    art: [
      "01.00.10",
      "01211210",
      "01233210",
      ".011110.",
      "01211210",
      ".00..00.",
    ],
  },
  slime: {
    name: "Sprout Slime",
    seconds: 12,
    need: "Research the second plot",
    ready: (s) => s.sites.research.extraPlot,
    ability: "Harvests the first ripe plot.",
    action: "harvest",
    color: "#67dfa5",
    art: [
      "....10..",
      "...010..",
      "..0110..",
      ".012221.",
      "01232310",
      "01111110",
    ],
  },
  mole: {
    name: "Copper Mole",
    seconds: 8,
    need: "Purchase the Copper Pick",
    ready: (s) => s.sites.pick >= 1,
    ability: "Chips Copper once.",
    action: "mine",
    veins: ["copper"],
    color: "#d79c82",
    art: [
      "....00..",
      "..01110.",
      ".0123210",
      "01222100",
      "0122210.",
      ".00.00..",
    ],
  },
  crab: {
    name: "Quartz Crab",
    seconds: 11,
    need: "Unlock the Silver deposit",
    ready: (s) => depositAccess(s, "silver"),
    ability:
      "Chips the Copper or Silver vein with the least toughness left. Ties favor Silver.",
    action: "mine",
    veins: ["silver", "copper"],
    color: "#ec9fa8",
    art: [
      "00....00",
      "010..010",
      ".003300.",
      "01222210",
      "00111100",
      "0.0..0.0",
    ],
  },
  ferret: {
    name: "Chest Ferret",
    seconds: 24,
    need: "Visit Desert with 30 chests opened this run",
    ready: (s) => s.world === "desert" && s.opened >= 30,
    ability: "Opens the oldest Rare-or-better chest.",
    action: "chest",
    grades: [2, 3, 4],
    color: "#f3ce8c",
    art: [
      ".....01.",
      "....0120",
      "00011230",
      "01222210",
      ".011100.",
      "..0..0..",
    ],
  },
  gecko: {
    name: "Dune Gecko",
    seconds: 12,
    need: "Visit Desert holding a max-rank forged item",
    ready: (s) =>
      s.world === "desert" && s.items.some((item) => item.forge >= 3),
    ability:
      "Presses for 35% of tap income and advances recovering deposits by 1s.",
    action: "press",
    power: 0.35,
    recover: 1000,
    color: "#f5b84f",
    art: [
      "....0.0.",
      "...01330",
      "01122210",
      ".022210.",
      "0010110.",
      "0..0..0.",
    ],
  },
  hare: {
    name: "Tundra Hare",
    seconds: 12,
    need: "Visit Frozen Lands after researching Irrigation",
    ready: (s) => s.world === "frozen" && s.sites.research.irrigation,
    ability: "Advances the crop closest to ripening by 5s.",
    action: "grow",
    amount: 5000,
    color: "#b6e9ff",
    art: [
      "....0.0.",
      "....1.1.",
      "...01110",
      "..012320",
      ".0122210",
      ".001100.",
    ],
  },
  owl: {
    name: "Crystal Owl",
    seconds: 16,
    need: "Unlock the Star Crystal vein and hold 2 Star Crystals",
    ready: (s) => depositAccess(s, "crystal") && s.starCrystals >= 2,
    ability: "Chips the Star Crystal vein once.",
    action: "mine",
    veins: ["crystal"],
    color: "#dab0ff",
    art: [
      ".0....0.",
      ".011110.",
      "01233210",
      "01211210",
      ".012210.",
      "..0..0..",
    ],
  },
  ram: {
    name: "Cinder Ram",
    seconds: 14,
    need: "Visit Volcano with the Resonant Pick",
    ready: (s) => s.world === "volcano" && s.sites.pick >= 2,
    ability: "Advances every recovering deposit by 6s.",
    action: "recover",
    amount: 6000,
    color: "#fb8b66",
    art: [
      "..0000..",
      ".011011.",
      "01213010",
      "01222210",
      ".022110.",
      "..0.0...",
    ],
  },
  heron: {
    name: "Moon Heron",
    seconds: 14,
    need: "250,000 earned and 1 Prism Essence held",
    ready: (s) => s.total >= 250000 && s.prismEssence >= 1,
    ability:
      "Advances the crop closest to ripening by 4s and chips Silver when available.",
    action: "hybrid",
    amount: 4000,
    veins: ["silver"],
    color: "#d2deff",
    art: [
      "....0110",
      "...01230",
      "...010..",
      ".01110..",
      "012210..",
      "..0.0...",
    ],
  },
  koi: {
    name: "Star Koi",
    seconds: 18,
    need: "Visit Celestial Realm with an evolved pet",
    ready: (s) =>
      s.world === "celestial" &&
      Object.values(s.companions.pets).some((p) => p.evolved),
    ability: "Opens the oldest available chest of any rarity.",
    action: "chest",
    grades: [0, 1, 2, 3, 4],
    color: "#ff98ba",
    art: [
      ".....01.",
      "0..01110",
      "11012230",
      ".1122210",
      "1100110.",
      "0....10.",
    ],
  },
  drake: {
    name: "Relic Drake",
    seconds: 15,
    need: "10 million earned and two artifacts discovered",
    ready: (s) => s.total >= 10000000 && s.companions.artifacts.length >= 2,
    ability:
      "Presses for 75% of tap income and gathers 1 shard if a chest is waiting.",
    action: "press",
    power: 0.75,
    shard: true,
    color: "#87d1ff",
    art: [
      ".0..0.0.",
      "01001130",
      "01222210",
      ".122210.",
      "01112110",
      "0.0.0...",
    ],
  },
};
const artifacts = {
  bell: { name: "Field Bell", info: "10% shorter field cooldowns." },
  lens: { name: "Scout Lens", info: "10% shorter expeditions." },
  satchel: {
    name: "Trail Satchel",
    info: "One extra unit of the route’s first material.",
  },
};
const routes = {
  grove: {
    name: "Grove Trail",
    at: expeditionsAt,
    level: 1,
    seconds: 90,
    xp: 12,
    loot: { glowleaf: 3, scrap: 2 },
    artifact: "bell",
    requirement: "2,500 earned",
  },
  silver: {
    name: "Silver Pass",
    at: 10000,
    level: 2,
    tool: 1,
    seconds: 180,
    xp: 20,
    loot: { copperOre: 4, silverOre: 2, rootFiber: 2 },
    artifact: "lens",
    requirement: "10,000 earned · Copper Pick · level 2",
  },
  star: {
    name: "Star Ruins",
    at: 50000,
    level: 4,
    vein: "crystal",
    seconds: 360,
    xp: 32,
    loot: { starCrystals: 2, prismEssence: 1 },
    artifact: "satchel",
    requirement: "Star Crystal vein · level 4",
  },
};

const newPet = () => ({
  xp: 0,
  evolved: false,
  role: "",
  gear: "",
  cooldown: null,
  last: "",
});
const freshCompanions = () => ({
  pets: {},
  field: [null, null],
  trips: [null, null],
  artifacts: [],
});
const isKnown = (catalog, id) =>
  typeof id === "string" && Object.hasOwn(catalog, id);
const petLevel = (pet) => Math.min(10, 1 + Math.floor(Math.sqrt(pet.xp / 10)));
const fieldSlots = (s) =>
  s.total < companionsAt ? 0 : s.total < secondFieldAt ? 1 : 2;
const tripSlots = (s) =>
  s.total < expeditionsAt ? 0 : s.total < secondTripAt ? 1 : 2;

function recruitPets(state) {
  if (state.total < companionsAt) return [];
  const pets = state.companions.pets;
  const recruited = [];
  for (const [id, def] of Object.entries(roster)) {
    if (!pets[id] && def.ready(state)) {
      pets[id] = newPet();
      recruited.push(id);
    }
  }
  return recruited;
}

function petDuty(state, id) {
  const camp = state.companions;
  const field = camp.field.indexOf(id);
  if (field >= 0) return { type: "field", slot: field };
  const trip = camp.trips.findIndex((trip) => trip?.pet === id);
  return trip >= 0 ? { type: "trip", slot: trip } : { type: "home" };
}

function cooldown(id, pet) {
  const reduction =
    (petLevel(pet) - 1) * 0.02 +
    (pet.role === "field" ? 0.15 : 0) +
    (pet.evolved ? 0.1 : 0) +
    (pet.gear === "bell" ? 0.1 : 0);
  return Math.round(
    roster[id].seconds * 1000 * (1 - Math.min(0.45, reduction)),
  );
}

function assignField(state, id, slot) {
  if (
    !isKnown(state.companions.pets, id) ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= fieldSlots(state) ||
    state.companions.field[slot] ||
    petDuty(state, id).type !== "home"
  )
    return false;
  const pet = state.companions.pets[id];
  pet.cooldown ??= cooldown(id, pet);
  state.companions.field[slot] = id;
  return true;
}

function restPet(state, id) {
  const duty = petDuty(state, id);
  if (duty.type !== "field") return false;
  state.companions.field[duty.slot] = null;
  return true;
}

function specializePet(state, id, role) {
  if (
    !isKnown(state.companions.pets, id) ||
    !["field", "scout"].includes(role) ||
    petDuty(state, id).type !== "home" ||
    petLevel(state.companions.pets[id]) < 4
  )
    return false;
  state.companions.pets[id].role = role;
  return true;
}

function evolvePet(state, id) {
  if (!isKnown(state.companions.pets, id) || petDuty(state, id).type !== "home")
    return false;
  const pet = state.companions.pets[id];
  if (
    pet.evolved ||
    petLevel(pet) < 5 ||
    state.total < 10000 ||
    !useMaterials(state, evolutionCost)
  )
    return false;
  pet.evolved = true;
  return true;
}

function equipArtifact(state, id, gear) {
  const camp = state.companions;
  if (!isKnown(camp.pets, id) || petDuty(state, id).type === "trip")
    return false;
  if (gear && (!isKnown(artifacts, gear) || !camp.artifacts.includes(gear)))
    return false;
  const from =
    gear && Object.keys(camp.pets).find((key) => camp.pets[key].gear === gear);
  if (from && petDuty(state, from).type === "trip") return false;
  if (from) camp.pets[from].gear = "";
  camp.pets[id].gear = gear;
  return true;
}

function routeAccess(state, id, route) {
  const def = routes[route];
  return Boolean(
    def &&
    isKnown(routes, route) &&
    isKnown(state.companions.pets, id) &&
    state.total >= def.at &&
    state.sites.pick >= (def.tool || 0) &&
    (!def.vein || depositAccess(state, def.vein)) &&
    petLevel(state.companions.pets[id]) >= def.level,
  );
}

function tripQuote(pet, route) {
  const def = routes[route];
  const duration = Math.round(
    def.seconds *
      1000 *
      (1 - (pet.role === "scout" ? 0.2 : 0) - (pet.gear === "lens" ? 0.1 : 0)),
  );
  const loot = { ...def.loot };
  if (pet.gear === "satchel") loot[Object.keys(loot)[0]]++;
  return { duration, loot };
}

function sendPet(state, id, route, now) {
  const slot = state.companions.trips.findIndex(
    (trip, index) => !trip && index < tripSlots(state),
  );
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    slot === -1 ||
    !routeAccess(state, id, route) ||
    petDuty(state, id).type !== "home"
  )
    return false;
  const quote = tripQuote(state.companions.pets[id], route);
  const finishAt = now + quote.duration;
  if (!Number.isSafeInteger(finishAt)) return false;
  state.companions.trips[slot] = { pet: id, route, ...quote, finishAt };
  return true;
}

const tripRemaining = (trip, now) =>
  Math.min(trip.duration, Math.max(0, trip.finishAt - now));

function cancelTrip(state, slot, now) {
  const trip = state.companions.trips[slot];
  if (!trip || !Number.isFinite(now) || tripRemaining(trip, now) <= 0)
    return false;
  state.companions.trips[slot] = null;
  return true;
}

function claimTrip(state, slot, now) {
  const camp = state.companions;
  const trip = camp.trips[slot];
  if (!trip || tripRemaining(trip, now) !== 0) return null;
  camp.trips[slot] = null;
  const def = routes[trip.route];
  for (const [id, amount] of Object.entries(trip.loot))
    creditResource(state, id, amount);
  const pet = camp.pets[trip.pet];
  pet.xp = Math.min(maxXp, pet.xp + def.xp);
  const found = !camp.artifacts.includes(def.artifact);
  if (found) camp.artifacts.push(def.artifact);
  pet.last = "Returned from " + def.name + ".";
  return { ...trip, xp: def.xp, artifact: found ? def.artifact : "" };
}

function tickPets(state, dt, rates, regionalPieces, random = Math.random) {
  const results = [];
  let changed = false;
  if (!Number.isFinite(dt) || dt <= 0) return { changed, results };
  const busy = { chest: false, harvest: false, veins: new Set() };
  const { field, pets } = state.companions;
  for (const id of field.slice(0, fieldSlots(state))) {
    if (!id) continue;
    const pet = pets[id];
    const before = pet.cooldown ?? cooldown(id, pet);
    pet.cooldown = Math.max(0, before - dt);
    changed ||= before !== pet.cooldown;
    if (pet.cooldown > 0) continue;
    const result = actPet(
      state,
      roster[id],
      rates,
      regionalPieces,
      busy,
      random,
    );
    if (!result) continue;
    pet.xp = Math.min(maxXp, pet.xp + 2);
    pet.cooldown = cooldown(id, pet);
    pet.last = result.text;
    results.push({ id, ...result });
    changed = true;
  }
  return { changed, results };
}

function actPet(state, def, rates, pieces, busy, random) {
  const local = () =>
    state.chests.find((chest) => recordWorld(chest) === state.world);
  if (def.action === "press") {
    const coins = rates.tap * def.power;
    if (!(coins > 0)) return null;
    creditCoins(state, coins);
    if (def.recover) recoverVeins(state, def.recover);
    const shard = def.shard && state.total >= 600 && local();
    if (shard) creditResource(state, "shards", 1);
    return {
      target: "button",
      coins,
      text: shard
        ? "Pressed the button and found 1 shard."
        : "Pressed the red button.",
    };
  }
  if (def.action === "scrap") {
    creditResource(state, "scrap", 1);
    return { target: "roam", text: "Gathered 1 scrap." };
  }
  if (def.action === "chest") {
    if (busy.chest || state.items.length >= gearBagLimit) return null;
    const chest = state.chests.find(
      (chest) =>
        recordWorld(chest) === state.world && def.grades.includes(chest.r),
    );
    if (!chest) return null;
    const opened = collectChest(state, chest.id, pieces, random, "pet");
    if (!opened || opened.full) return null;
    busy.chest = true;
    return { target: "chest", opened, text: "Opened a treasure chest." };
  }
  if (def.action === "harvest") {
    if (busy.harvest) return null;
    const index = state.sites.plots.findIndex((plot) => plot?.remaining === 0);
    const gathered = index >= 0 && harvest(state, index);
    if (!gathered) return null;
    busy.harvest = true;
    return { target: "farm", gathered, text: "Harvested a ripe crop." };
  }
  if (def.action === "recover") {
    if (!recoverVeins(state, def.amount)) return null;
    return { target: "mine", text: "Advanced recovering deposits." };
  }
  const grew = def.amount && advanceCrops(state, def.amount, def.all);
  const vein = def.veins
    ?.filter(
      (id) =>
        !busy.veins.has(id) &&
        depositAccess(state, id) &&
        state.sites.veins[id].remaining === 0,
    )
    .sort(
      (a, b) =>
        state.sites.veins[a].hp / deposits[a].hp -
        state.sites.veins[b].hp / deposits[b].hp,
    )[0];
  const mined = vein && mine(state, vein);
  if (mined) busy.veins.add(vein);
  if (!grew && !mined) return null;
  return {
    target: grew ? "farm" : "mine",
    gathered: mined?.amount ? mined : null,
    text:
      grew && mined
        ? "Tended crops and chipped Silver."
        : grew
          ? "Advanced crop growth."
          : "Chipped a deposit.",
  };
}

function normalizeCompanions(state, raw) {
  const camp = state.companions;
  const bounded = (n, max) =>
    Number.isFinite(n) ? Math.max(0, Math.min(n, max)) : 0;
  if (Array.isArray(raw?.artifacts))
    camp.artifacts = [
      ...new Set(raw.artifacts.filter((id) => isKnown(artifacts, id))),
    ];
  const held = new Set();
  for (const id of Object.keys(roster)) {
    const p = raw?.pets?.[id];
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const pet = newPet();
    pet.xp = Math.floor(bounded(p.xp, maxXp));
    pet.evolved = petLevel(pet) >= 5 && p.evolved === true;
    pet.role =
      petLevel(pet) >= 4 && ["field", "scout"].includes(p.role) ? p.role : "";
    if (camp.artifacts.includes(p.gear) && !held.has(p.gear)) {
      pet.gear = p.gear;
      held.add(p.gear);
    }
    pet.cooldown = Number.isFinite(p.cooldown)
      ? bounded(p.cooldown, roster[id].seconds * 1000)
      : null;
    pet.last = typeof p.last === "string" ? p.last.slice(0, 100) : "";
    camp.pets[id] = pet;
  }
  const assigned = new Set();
  for (let i = 0; i < tripSlots(state); i++) {
    const trip = raw?.trips?.[i];
    if (
      !trip ||
      !isKnown(camp.pets, trip.pet) ||
      assigned.has(trip.pet) ||
      !routeAccess(state, trip.pet, trip.route) ||
      !Number.isSafeInteger(trip.finishAt) ||
      trip.finishAt < 0
    )
      continue;
    const quote = tripQuote(camp.pets[trip.pet], trip.route);
    camp.trips[i] = {
      pet: trip.pet,
      route: trip.route,
      ...quote,
      finishAt: trip.finishAt,
    };
    assigned.add(trip.pet);
  }
  for (let i = 0; i < fieldSlots(state); i++) {
    const id = raw?.field?.[i];
    if (!isKnown(camp.pets, id) || assigned.has(id)) continue;
    camp.field[i] = id;
    assigned.add(id);
  }
}

function keepCompanions(state) {
  return {
    ...freshCompanions(),
    artifacts: [...state.companions.artifacts],
    pets: Object.fromEntries(
      Object.entries(state.companions.pets).map(([id, pet]) => [
        id,
        { ...pet, cooldown: null, last: "" },
      ]),
    ),
  };
}

export {
  companionsAt,
  secondFieldAt,
  expeditionsAt,
  secondTripAt,
  evolutionCost,
  roster,
  artifacts,
  routes,
  petLevel,
  fieldSlots,
  tripSlots,
  freshCompanions,
  normalizeCompanions,
  keepCompanions,
  recruitPets,
  petDuty,
  cooldown,
  assignField,
  restPet,
  specializePet,
  evolvePet,
  equipArtifact,
  routeAccess,
  tripQuote,
  sendPet,
  tripRemaining,
  cancelTrip,
  claimTrip,
  tickPets,
};
