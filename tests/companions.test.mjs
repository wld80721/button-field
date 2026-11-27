import assert from "node:assert/strict";
import test from "node:test";
import {
  artifacts,
  assignField,
  cancelTrip,
  claimTrip,
  cooldown,
  equipArtifact,
  evolvePet,
  fieldSlots,
  petDuty,
  petLevel,
  recruitPets,
  restPet,
  roster,
  routeAccess,
  sendPet,
  specializePet,
  tickPets,
  tripRemaining,
  tripSlots,
} from "../src/js/companions.js";
import { applyPress, gearBagLimit } from "../src/js/gameplay.js";
import { performAscension } from "../src/js/prestige.js";
import { normalize } from "../src/js/saves.js";
import { fresh } from "../src/js/state.js";

const rates = { tap: 10, chance: 0, crit: 0, auto: 0 };
const random = () => 0.9;
const chest = (id, r, world = "grasslands") => ({
  id,
  r,
  level: 1,
  x: 24,
  y: 35,
  world,
});

function squad(...ids) {
  const run = fresh();
  run.coins = 25000;
  run.total = 5000000;
  run.nextId = 100;
  run.sites.pick = 2;
  run.sites.research.extraPlot = true;
  for (const id of ids)
    run.companions.pets[id] = {
      xp: 0,
      evolved: false,
      role: "",
      gear: "",
      cooldown: null,
      last: "",
    };
  return run;
}

test("all fifteen pets have distinct art and findable recruitment requirements", () => {
  const s = fresh();
  s.opened = 1;
  s.scrap = 3;
  s.total = 149;
  assert.deepEqual(recruitPets(s), []);
  s.total++;
  assert.deepEqual(recruitPets(s), ["beetle", "sparrow"]);
  assert.deepEqual(recruitPets(s), []);
  s.total = 600;
  s.opened = 5;
  s.glowleaf = 3;
  assert.deepEqual(recruitPets(s), ["mouse", "moth"]);
  s.total = 2500;
  s.sites.research.extraPlot = true;
  s.sites.pick = 1;
  assert.deepEqual(recruitPets(s), ["slime", "mole"]);
  s.total = 10000;
  s.opened = 30;
  s.items = [{ forge: 3 }];
  assert.deepEqual(recruitPets(s), ["crab"]);
  s.world = "desert";
  assert.deepEqual(recruitPets(s), ["ferret", "gecko"]);
  s.world = "frozen";
  s.total = 50000;
  s.starCrystals = 2;
  s.sites.research.irrigation = true;
  assert.deepEqual(recruitPets(s), ["hare", "owl"]);
  s.world = "volcano";
  s.total = 250000;
  s.sites.pick = 2;
  s.prismEssence = 1;
  assert.deepEqual(recruitPets(s), ["ram", "heron"]);
  s.world = "celestial";
  s.companions.pets.beetle.evolved = true;
  assert.deepEqual(recruitPets(s), ["koi"]);
  s.total = 10000000;
  s.companions.artifacts = ["bell", "lens"];
  assert.deepEqual(recruitPets(s), ["drake"]);
  assert.equal(Object.keys(s.companions.pets).length, 15);
  assert.equal(
    new Set(Object.values(roster).map((p) => p.art.join())).size,
    15,
  );
});

test("each field action honors its target and pays XP only after a successful action", () => {
  const cases = {
    beetle: [(s) => {}, (s) => assert.equal(s.coins, 25004)],
    sparrow: [(s) => {}, (s) => assert.equal(s.scrap, 1)],
    mouse: [
      (s) => (s.chests = [chest(1, 3), chest(2, 1), chest(3, 0)]),
      (s) =>
        assert.deepEqual(
          s.chests.map((c) => c.id),
          [1, 3],
        ),
    ],
    moth: [
      (s) => (s.sites.plots = [{ remaining: 1000 }, { remaining: 5000 }]),
      (s) =>
        assert.deepEqual(
          s.sites.plots.map((p) => p.remaining),
          [0, 3000],
        ),
    ],
    slime: [
      (s) => (s.sites.plots = [{ crop: "glowleaf", remaining: 0 }, null]),
      (s) => {
        assert.equal(s.glowleaf, 3);
        assert.equal(s.sites.growthCharges, 3);
        assert.equal(s.sites.plots[0], null);
      },
    ],
    mole: [(s) => {}, (s) => assert.equal(s.copperOre, 4)],
    crab: [
      (s) => (s.sites.veins.silver.hp = 2),
      (s) => {
        assert.equal(s.silverOre, 3);
        assert.equal(s.copperOre, 0);
      },
    ],
    ferret: [
      (s) => (s.chests = [chest(1, 0), chest(2, 4, "desert"), chest(3, 2)]),
      (s) =>
        assert.deepEqual(
          s.chests.map((c) => c.id),
          [1, 2],
        ),
    ],
    gecko: [
      (s) => (s.sites.veins.copper = { hp: 0, remaining: 2000 }),
      (s) => {
        assert.equal(s.coins, 25003.5);
        assert.equal(s.sites.veins.copper.remaining, 1000);
      },
    ],
    hare: [
      (s) => (s.sites.plots = [{ remaining: 7000 }, { remaining: 5000 }]),
      (s) =>
        assert.deepEqual(
          s.sites.plots.map((p) => p.remaining),
          [7000, 0],
        ),
    ],
    owl: [
      (s) => (s.sites.crystalFocus = true),
      (s) => {
        assert.equal(s.sites.veins.crystal.hp, 4);
        assert.equal(s.sites.crystalFocus, true);
      },
    ],
    ram: [
      (s) => (s.sites.veins.silver = { hp: 0, remaining: 4000 }),
      (s) => assert.deepEqual(s.sites.veins.silver, { hp: 5, remaining: 0 }),
    ],
    heron: [
      (s) => (s.sites.plots = [{ remaining: 5000 }, null]),
      (s) => {
        assert.equal(s.sites.plots[0].remaining, 1000);
        assert.equal(s.sites.veins.silver.hp, 2);
      },
    ],
    koi: [
      (s) => (s.chests = [chest(1, 4, "desert"), chest(2, 0), chest(3, 4)]),
      (s) =>
        assert.deepEqual(
          s.chests.map((c) => c.id),
          [1, 3],
        ),
    ],
    drake: [
      (s) => (s.chests = [chest(1, 0)]),
      (s) => {
        assert.equal(s.coins, 25007.5);
        assert.equal(s.shards, 1);
      },
    ],
  };
  assert.deepEqual(Object.keys(cases), Object.keys(roster));
  for (const [id, [seed, verify]] of Object.entries(cases)) {
    const s = squad(id);
    seed(s);
    assert.ok(assignField(s, id, 0));
    assert.equal(
      tickPets(s, roster[id].seconds * 1000 - 1, rates, 0, random).results
        .length,
      0,
      id,
    );
    const { results } = tickPets(s, 1, rates, 0, random);
    assert.equal(results.length, 1, id);
    assert.equal(s.companions.pets[id].xp, 2, id);
    assert.ok(s.companions.pets[id].last, id);
    assert.equal(s.presses, 0, id);
    verify(s);
  }
});

test("field slots, per-tick contention, full bags and cooldown persistence", () => {
  const s = squad("mouse", "koi", "slime", "mole", "crab");
  s.total = 49999;
  assert.equal(fieldSlots(s), 1);
  assert.equal(assignField(s, "koi", 1), false);
  s.total++;
  assert.ok(assignField(s, "mouse", 0));
  assert.equal(assignField(s, "mouse", 1), false);
  assert.ok(assignField(s, "koi", 1));
  s.chests = [chest(1, 0), chest(2, 4)];
  s.items = Array(gearBagLimit).fill({});
  assert.deepEqual(tickPets(s, 20000, rates, 0, random).results, []);
  assert.equal(s.companions.pets.mouse.xp, 0);
  s.items = [];
  assert.deepEqual(
    tickPets(s, 250, rates, 0, random).results.map((r) => r.id),
    ["mouse"],
  );
  assert.equal(s.companions.pets.koi.cooldown, 0);
  assert.deepEqual(
    tickPets(s, 250, rates, 0, random).results.map((r) => r.id),
    ["koi"],
  );
  assert.equal(s.abilityProgress.forager, fresh().abilityProgress.forager);
  assert.equal(
    s.abilityProgress.pathfinder,
    fresh().abilityProgress.pathfinder,
  );
  assert.equal(s.shards, 6);
  assert.ok(restPet(s, "mouse"));
  const remaining = s.companions.pets.mouse.cooldown;
  assert.ok(restPet(s, "koi"));
  assert.ok(assignField(s, "mole", 0));
  assert.ok(assignField(s, "crab", 1));
  s.sites.pick = 1;
  s.sites.veins.silver.remaining = 1000;
  assert.deepEqual(
    tickPets(s, 11000, rates, 0, random).results.map((r) => r.id),
    ["mole"],
  );
  assert.equal(s.sites.veins.copper.hp, 1);
  assert.equal(s.companions.pets.mouse.cooldown, remaining);
  assert.deepEqual(
    normalize(JSON.parse(JSON.stringify(s))).companions,
    s.companions,
  );
});

test("specializations and evolution use home and level gates, atomic costs and a cooldown floor", () => {
  const s = squad("beetle", "mouse");
  const beetle = s.companions.pets.beetle;
  assert.equal(specializePet(s, "beetle", "field"), false);
  beetle.xp = 90;
  assert.equal(petLevel(beetle), 4);
  assert.ok(specializePet(s, "beetle", "field"));
  assert.ok(assignField(s, "beetle", 0));
  assert.equal(specializePet(s, "beetle", "scout"), false);
  s.shards = 9;
  s.rootFiber = 3;
  assert.equal(evolvePet(s, "beetle"), false);
  assert.ok(restPet(s, "beetle"));
  beetle.xp = 160;
  s.shards = 7;
  assert.equal(evolvePet(s, "beetle"), false);
  assert.equal(s.coins, 25000);
  assert.equal(s.rootFiber, 3);
  s.shards = 9;
  assert.ok(evolvePet(s, "beetle"));
  assert.equal(s.coins, 23500);
  assert.equal(s.shards, 1);
  assert.equal(s.rootFiber, 0);
  assert.equal(evolvePet(s, "beetle"), false);
  beetle.xp = 810;
  s.companions.artifacts.push("bell");
  assert.ok(equipArtifact(s, "beetle", "bell"));
  assert.equal(cooldown("beetle", beetle), 4400);
  assert.ok(equipArtifact(s, "mouse", "bell"));
  assert.equal(beetle.gear, "");
  assert.equal(s.companions.pets.mouse.gear, "bell");
  assert.equal(equipArtifact(s, "beetle", "lens"), false);
});

test("expeditions validate gates, pause field work, snapshot rewards, and claim offline once", () => {
  let s = squad("beetle", "mouse", "sparrow");
  const start = 1000000;
  s.total = 2499;
  assert.equal(tripSlots(s), 0);
  assert.equal(sendPet(s, "beetle", "grove", start), false);
  s.total = 2500;
  assert.ok(sendPet(s, "beetle", "grove", start));
  assert.deepEqual(petDuty(s, "beetle"), { type: "trip", slot: 0 });
  assert.equal(assignField(s, "beetle", 0), false);
  assert.equal(sendPet(s, "mouse", "grove", start), false);
  assert.equal(sendPet(s, "mouse", "grove", Number.MAX_SAFE_INTEGER), false);
  assert.equal(claimTrip(s, 0, start + 89999), null);
  assert.equal(cancelTrip(s, 0, start + 90000), false);
  s = normalize(JSON.parse(JSON.stringify(s)));
  const offline = start + 3600000;
  assert.equal(tripRemaining(s.companions.trips[0], start - 100), 90000);
  assert.equal(claimTrip(s, 0, offline).artifact, "bell");
  assert.equal(claimTrip(s, 0, offline), null);
  assert.equal(s.glowleaf, 3);
  assert.equal(s.scrap, 2);
  assert.equal(petLevel(s.companions.pets.beetle), 2);
  assert.ok(sendPet(s, "beetle", "grove", start));
  assert.equal(claimTrip(s, 0, offline).artifact, "");
  s.total = 10000;
  assert.equal(routeAccess(s, "mouse", "silver"), false);
  assert.ok(sendPet(s, "beetle", "silver", start));
  assert.ok(cancelTrip(s, 0, start + 1));
  assert.equal(s.copperOre, 0);
  assert.ok(sendPet(s, "beetle", "silver", start));
  assert.equal(claimTrip(s, 0, offline).artifact, "lens");
  assert.deepEqual([s.copperOre, s.silverOre, s.rootFiber], [4, 2, 2]);
  s.total = 250000;
  s.companions.pets.beetle.xp = 90;
  assert.ok(specializePet(s, "beetle", "scout"));
  assert.ok(equipArtifact(s, "beetle", "lens"));
  assert.ok(sendPet(s, "beetle", "star", start));
  assert.equal(s.companions.trips[0].duration, 252000);
  assert.equal(equipArtifact(s, "beetle", ""), false);
  assert.equal(equipArtifact(s, "mouse", "lens"), false);
  assert.ok(sendPet(s, "mouse", "grove", start));
  assert.equal(sendPet(s, "sparrow", "grove", start), false);
  assert.equal(claimTrip(s, 0, offline).artifact, "satchel");
  assert.ok(equipArtifact(s, "beetle", "satchel"));
  assert.ok(sendPet(s, "beetle", "star", start));
  assert.deepEqual(
    claimTrip(normalize(JSON.parse(JSON.stringify(s))), 0, offline).loot,
    { starCrystals: 3, prismEssence: 1 },
  );
  assert.deepEqual(s.companions.artifacts, Object.keys(artifacts));
});

test("companion save normalization repairs duplicate assignments and Ascension keeps earned companions", () => {
  const s = squad("beetle", "mouse", "sparrow");
  const beetle = s.companions.pets.beetle;
  beetle.xp = 9999;
  beetle.cooldown = -5;
  beetle.role = "scout";
  beetle.evolved = true;
  beetle.gear = "bell";
  s.companions.artifacts = ["bell", "bell", "fake"];
  s.companions.pets.mouse.gear = "bell";
  s.companions.field = ["beetle", "beetle"];
  assert.ok(sendPet(s, "mouse", "grove", 0));
  s.companions.trips[1] = { ...s.companions.trips[0] };
  const run = normalize(s);
  assert.deepEqual(run.companions.field, ["beetle", null]);
  assert.equal(run.companions.trips[1], null);
  assert.equal(run.companions.pets.mouse.gear, "");
  assert.deepEqual(run.companions.artifacts, ["bell"]);
  assert.equal(run.companions.pets.beetle.xp, 810);
  assert.equal(run.companions.pets.beetle.cooldown, 0);
  const next = performAscension(run).run;
  assert.equal(next.total, 0);
  assert.equal(next.companions.pets.beetle.xp, 810);
  assert.equal(next.companions.pets.beetle.evolved, true);
  assert.equal(next.companions.pets.beetle.role, "scout");
  assert.equal(next.companions.pets.beetle.gear, "bell");
  assert.equal(next.companions.pets.beetle.cooldown, null);
  assert.deepEqual(next.companions.field, [null, null]);
  assert.deepEqual(next.companions.trips, [null, null]);
  assert.deepEqual(normalize(next).companions, next.companions);
});

test("a seeded minute of companion tapping supplements active tapping", () => {
  const s = squad("beetle", "gecko");
  const manual = fresh();
  manual.total = s.total;
  manual.coins = s.coins;
  assignField(s, "beetle", 0);
  assignField(s, "gecko", 1);
  const before = s.coins;
  for (let second = 0; second < 60; second++) {
    tickPets(s, 1000, rates, 0, random);
    if (second % 3 === 0) applyPress(manual, rates, 0, random);
  }
  assert.equal(s.coins - before, 45.5);
  assert.equal(manual.coins - before, 200);
  assert.equal(s.presses, 0);
  assert.equal(s.chests.length, 0);
  assert.equal(s.wheelClaims, 0);
  assert.equal(s.wheelNextAt, 50);
});
