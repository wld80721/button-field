import assert from "node:assert/strict";
import test from "node:test";
import { advanceClone, fieldSignatures } from "../src/js/blacksmith-effects.js";
import { beginWork, heatWork, quenchWork, strikeWork } from "../src/js/blacksmith.js";
import { advanceFight, guardFight, startFight, strikeBoss } from "../src/js/combat.js";
import { addGearItem } from "../src/js/gear.js";
import { gearBagLimit } from "../src/js/gameplay.js";
import { performAscension } from "../src/js/prestige.js";
import { normalize } from "../src/js/saves.js";
import { harvest, mine, plant } from "../src/js/sites.js";
import { fresh } from "../src/js/state.js";

const runAt = (total = 1e7) => Object.assign(fresh(), {
  total, coins: 2e6, scrap: 500, shards: 200, glowleaf: 30, copperOre: 30,
});
const piece = (slot, set, r = 2, extra = {}) =>
  ({ id: slot + 1, slot, set, r, level: 5, value: 10, ...extra });

function shape(work) {
  assert.equal(heatWork(work, 0), true);
  assert.equal(strikeWork(work, 10, false), false);
  for (let i = 0; i < work.targets.length; i++) assert.equal(strikeWork(work, i * 100, true), true);
}

test("only quenching applies a work order, with payment, item identity, rank and bag revalidation", () => {
  const run = runAt();
  assert.equal(beginWork(run, { kind: "craft", set: "sparkforged", slot: 0 }), null);
  run.blacksmith.recipes.push("sparkforged");
  const craft = beginWork(run, { kind: "craft", set: "sparkforged", slot: 0 });
  shape(craft);
  assert.equal(run.coins, 2e6);
  assert.equal(run.items.length, 0);
  const item = quenchWork(run, craft, 5);
  assert.equal(item.set, "sparkforged");
  assert.equal(run.coins, 2e6 - 650);
  assert.equal(run.copperOre, 26);
  assert.equal(quenchWork(run, craft, 5), null);

  const temper = beginWork(run, { kind: "temper", id: item.id });
  heatWork(temper, 1000);
  assert.equal(strikeWork(temper, 1899, false), true);
  assert.equal(strikeWork(temper, 2799, false), true);
  assert.equal(item.forge, undefined);
  assert.equal(quenchWork(run, temper, 5), item);
  assert.equal(item.forge, 1);

  Object.assign(item, { r: 4, forge: 3, locked: true });
  run.equip[0] = item.id;
  for (const r of [5, 6]) {
    const evolve = beginWork(run, { kind: "evolve", id: item.id });
    assert.equal(evolve.targets.length, 4);
    shape(evolve);
    assert.equal(quenchWork(run, evolve, 5), item);
    assert.equal(item.r, r);
    assert.equal(item.locked, true);
    assert.equal(item.forge, 3);
    assert.equal(run.equip[0], item.id);
  }

  const blocked = beginWork(run, { kind: "craft", set: "sparkforged", slot: 2 });
  shape(blocked);
  for (let i = 1; i < gearBagLimit; i++) addGearItem(run, piece(0, "sparkforged", 2, { id: i + 1 }));
  const balance = run.coins;
  assert.equal(quenchWork(run, blocked, 5), null);
  assert.equal(run.coins, balance);
});

test("manual farming and mining unlock recipes once and a banked seed plants ordinary free Glowleaf", () => {
  const run = runAt(2500);
  assert.equal(plant(run, 0, "glowleaf"), true);
  run.sites.plots[0].remaining = 0;
  assert.equal(harvest(run, 0, "manual").blueprint, true);
  mine(run, "copper", "manual");
  mine(run, "copper", "manual");
  assert.equal(mine(run, "copper", "manual").blueprint, true);
  assert.deepEqual(run.blacksmith.recipes, ["wildroot", "sparkforged"]);
  run.blacksmith.seeds = 1;
  const balance = run.coins;
  assert.equal(plant(run, 0, "magical"), true);
  assert.equal(run.coins, balance);
  assert.equal(run.blacksmith.seeds, 0);
  assert.equal(run.sites.plots[0].crop, "glowleaf");
});

test("mixed signatures chip veins, bank seeds and echo crops without advancing press counters", () => {
  const run = runAt(2500);
  const gear = [piece(0, "sparkforged", 6), null, piece(2, "wildroot"), piece(3, "wraithweave", 5)];
  run.equip[3] = gear[3].id;
  run.blacksmith.charge = { sparkforged: 19, wildroot: 14, wraithweave: 23 };
  const [lightning, seed, phantom] = fieldSignatures(run, gear, 10);
  assert.equal(lightning.rewards[0].amount, 4);
  assert.equal(seed.type, "seed");
  assert.equal(run.blacksmith.seeds, 1);
  assert.equal(phantom.clone.taps, 4);
  assert.equal(plant(run, 0, "glowleaf"), true);
  const before = run.sites.plots[0].remaining;
  const recovery = run.sites.veins.copper.remaining;
  assert.equal(advanceClone(run, phantom.clone, 999).coins, undefined);
  assert.equal(advanceClone(run, phantom.clone, 1).coins, 5);
  assert.equal(run.sites.plots[0].remaining, before - 1000);
  assert.equal(run.sites.veins.copper.remaining, recovery);
  assert.equal(run.presses, 0);
  delete run.equip[3];
  assert.equal(advanceClone(run, phantom.clone, 1000).clone, null);
  const { run: reset } = performAscension(runAt());
  assert.equal(reset.blacksmith.seeds, 0);
});

test("Dragonfire spends one primed strike, preserves Guard and round-trips in a live fight", () => {
  const run = runAt(5000);
  const gear = Array.from({ length: 4 }, (_, slot) => piece(slot, "dragonfire", 6));
  assert.equal(startFight(run, "mossguard", gear), true);
  assert.equal(run.combat.attempt.loadout.dragon.damage, 20);
  assert.equal(strikeBoss(run)[0].type, "fireball");
  assert.equal(strikeBoss(run)[0].type, "strike");
  while (run.combat.attempt.mode !== "warn") advanceFight(run, 250);
  assert.equal(guardFight(run), true);
  while (run.combat.attempt.mode === "warn") advanceFight(run, 250);
  const restored = normalize(run);
  assert.equal(restored.combat.attempt.fireballReady, true);
  assert.equal(strikeBoss(restored)[0].type, "fireball");
  while (restored.combat.attempt) strikeBoss(restored);
  assert.ok(restored.blacksmith.recipes.includes("dragonfire"));
});

test("v6 migration backfills proven recipes and Ascension retains blueprints only", () => {
  const run = runAt();
  run.companions.artifacts.push("bell");
  run.combat.records.mossguard = { wins: 1, best: 5000 };
  const { blacksmith, ...legacy } = run;
  const migrated = normalize({ ...legacy, schemaVersion: 6 });
  assert.deepEqual(migrated.blacksmith.recipes, ["wraithweave", "dragonfire"]);
  migrated.blacksmith.seeds = 2;
  migrated.blacksmith.charge.wildroot = 10;
  const { run: reset } = performAscension(migrated);
  assert.deepEqual(reset.blacksmith.recipes, migrated.blacksmith.recipes);
  assert.equal(reset.blacksmith.charge.wildroot, 0);
  assert.equal(reset.blacksmith.seeds, 0);
});
