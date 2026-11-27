import assert from "node:assert/strict";
import test from "node:test";
import { upgrades } from "../src/js/data.js";
import {
  applyPress,
  buyWorkshopUpgrade,
  collectChest,
  nextEntityId,
} from "../src/js/gameplay.js";
import {
  addGearItem,
  forgeGear,
  gearIndex,
  gearValue,
  salvageGear,
} from "../src/js/gear.js";
import { fmt, fmtExact, fmtRate } from "../src/js/numbers.js";
import { performAscension } from "../src/js/prestige.js";
import { nextCoinUnlocks, progressionAccess } from "../src/js/progression.js";
import { normalize } from "../src/js/saves.js";
import { calculateStats, fresh } from "../src/js/state.js";

test("the shared unlock rules keep balances separate from run milestones", () => {
  const run = fresh();
  run.coins = 1e6;
  run.total = 24;
  assert.equal(progressionAccess(run).workshop, false);
  assert.equal(buyWorkshopUpgrade(run, upgrades[0]), false);
  assert.equal(nextCoinUnlocks(run)[0].target, 25);
  run.total = 25;
  assert.equal(progressionAccess(run).workshop, true);
  assert.equal(buyWorkshopUpgrade(run, upgrades[0]), true);
  assert.equal(run.coins, 999975);
  assert.equal(run.total, 25);
  assert.deepEqual(
    nextCoinUnlocks(run)[0].unlocks.map(({ name }) => name),
    ["Equipment forge", "Treasure compass"],
  );
  run.asc.runs = 1;
  assert.equal(progressionAccess(run).skills, true);
  assert.equal(progressionAccess(run).shards, false);
});

test("the seeded first-chest rule and indexed collection update one run", () => {
  const run = fresh();
  const rates = { tap: 1, auto: 0, chance: 0.16 };
  for (let i = 0; i < 7; i++)
    assert.equal(applyPress(run, rates, 0, () => 0.99).chest, undefined);
  const { chest } = applyPress(run, rates, 0, () => 0.99);
  assert.equal(chest.r, 3);
  assert.equal(run.coins, 8);
  assert.equal(run.misses, 0);
  const outcome = collectChest(run, chest.id, 0, () => 0);
  assert.equal(outcome.item.slot, 0);
  assert.equal(gearIndex(run).get(outcome.item.id), outcome.item);
  assert.equal(run.chests.length, 0);
  assert.equal(collectChest(run, chest.id, 0), null);
  assert.equal(run.shards, 0);
  assert.equal(progressionAccess(run).collection, true);
});

test("forging and salvaging spend and credit the same resource ledger", () => {
  const run = fresh();
  const item = { id: 700, r: 0, slot: 0, level: 1, value: 1 };
  run.total = 150;
  run.coins = 100;
  run.scrap = 2;
  addGearItem(run, item);
  assert.equal(forgeGear(run, item), true);
  assert.equal(gearValue(item), 1.12);
  assert.equal(run.coins, 75);
  assert.equal(run.scrap, 0);
  run.equip[0] = item.id;
  assert.equal(salvageGear(run, item), null);
  delete run.equip[0];
  assert.deepEqual(salvageGear(run, item), { coins: 2, scrap: 1 });
  assert.equal(gearIndex(run).has(item.id), false);
  assert.equal(run.total, 152);
});

test("old and current saves normalize without reusing gear or chest IDs", () => {
  const item = {
    id: Number.MAX_SAFE_INTEGER - 1,
    r: 0,
    slot: 0,
    level: 1,
    value: 1,
    forge: 3,
  };
  const run = normalize({
    coins: 2e16,
    total: 1e6,
    scraps: 99,
    scrap: 14,
    items: [item, item],
    equip: { 0: item.id, 1: item.id },
    chests: [{ id: item.id, r: 0, level: 1, x: 28, y: 40 }],
  });
  assert.equal(run.schemaVersion, 2);
  assert.equal(run.coins, 2e16);
  assert.deepEqual(run.items, [item]);
  assert.deepEqual(run.equip, { 0: item.id });
  assert.deepEqual(run.chests, []);
  assert.equal(run.scrap, 14);
  assert.equal(nextEntityId(run), 1);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(run))), run);
  for (const invalid of [{}, [], { coins: "2" }, { coins: 2, items: {} }])
    assert.throws(() => normalize(invalid), /Invalid save/);
  assert.throws(() => normalize({ ...run, schemaVersion: 3 }), /newer version/);
});

test("Ascension builds a new run and preserves only the permanent records", () => {
  const old = fresh();
  old.total = 40000;
  old.world = "desert";
  old.coins = 123;
  old.scrap = 4;
  old.asc.up.seed = 1;
  old.asc.life = 90000;
  const { run, stars } = performAscension(old);
  assert.equal(stars, 2);
  assert.equal(run.asc.stars, 2);
  assert.equal(run.asc.life, 90000);
  assert.equal(run.asc.runs, 1);
  assert.equal(run.coins, 250);
  assert.equal(run.scrap, 0);
  assert.equal(run.total, 0);
  assert.equal(run.world, "grasslands");
  assert.equal(old.scrap, 4);
});

test("compact formatting respects boundaries and extreme rates remain finite", () => {
  for (const [number, text] of [
    [999.99, "999"],
    [1000, "1K"],
    [999999, "999K"],
    [1e6, "1M"],
    [1e9, "1B"],
    [1e12, "1T"],
    [999999999999999, "999T"],
    [1e15, "1e+15"],
    [Number.MAX_VALUE, "1.79e+308"],
  ])
    assert.equal(fmt(number), text);
  assert.equal(fmtExact(250000), "250,000");
  assert.equal(fmtRate(1.123), "1.12");
  const run = fresh();
  run.asc.earned = Number.MAX_VALUE;
  run.asc.up.cosmos = 20;
  assert.equal(calculateStats(run, []).tap, Number.MAX_VALUE);
  assert.equal(calculateStats(run, []).auto, 0);
});
