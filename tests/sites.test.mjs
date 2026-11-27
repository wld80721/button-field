import assert from "node:assert/strict";
import test from "node:test";
import { buildRecipe } from "../src/js/build-gear.js";
import { gearBagLimit, nextEntityId } from "../src/js/gameplay.js";
import {
  addGearItem,
  forgeGear,
  forgeOffer,
  materialOffer,
} from "../src/js/gear.js";
import { performAscension } from "../src/js/prestige.js";
import { normalize } from "../src/js/saves.js";
import {
  advanceSites,
  buyMiner,
  buyPick,
  buyResearch,
  depositAccess,
  deposits,
  harvest,
  mine,
  plant,
  plotCount,
  setHarvestMode,
  setMiningMode,
} from "../src/js/sites.js";
import { fresh } from "../src/js/state.js";

function funded(total = 50000) {
  return Object.assign(fresh(), {
    total,
    coins: 10000,
    glowleaf: 30,
    rootFiber: 30,
    prismEssence: 30,
    copperOre: 30,
    silverOre: 30,
    starCrystals: 30,
    scrap: 20,
    shards: 20,
  });
}

function clear(run, id) {
  let last;
  do last = mine(run, id);
  while (last && !last.amount);
  return last;
}

test("farm and mine gates, crop effects and exact button acceleration", () => {
  const run = funded(599);
  assert.equal(plotCount(run), 0);
  assert.equal(plant(run, 0, "glowleaf"), false);
  run.total++;
  assert.equal(plotCount(run), 1);
  assert.equal(plant(run, 1, "glowleaf"), false);
  assert.equal(plant(run, 0, "ironroot"), false);
  assert.equal(plant(run, 0, "glowleaf"), true);
  assert.equal(plant(run, 0, "glowleaf"), false);
  assert.equal(run.coins, 9975);
  advanceSites(run, 11000);
  assert.equal(harvest(run, 0), null);
  advanceSites(run, 1000, true);
  assert.deepEqual(harvest(run, 0), { material: "glowleaf", amount: 3 });
  assert.equal(harvest(run, 0), null);
  assert.equal(run.sites.growthCharges, 3);
  run.total = 2500;
  assert.equal(plant(run, 0, "ironroot"), true);
  assert.equal(run.copperOre, 29);
  const copper = clear(run, "copper");
  assert.equal(copper.amount, 4);
  advanceSites(run, 1000, true);
  assert.equal(run.sites.plots[0].remaining, 16000);
  assert.equal(run.sites.veins.copper.remaining, 7000);
  assert.equal(run.sites.growthCharges, 2);
  run.sites.plots[0].remaining = 0;
  assert.deepEqual(harvest(run, 0), { material: "rootFiber", amount: 2 });
  assert.equal(run.sites.veins.copper.remaining, 1000);
  advanceSites(run, 1000);
  assert.equal(run.sites.veins.copper.hp, 3);
  assert.equal(run.presses, 0);
  assert.equal(run.total, 2500);
});

test("the first gathered recipe needs at most two starter crop and copper cycles", () => {
  const run = Object.assign(fresh(), { total: 2500, coins: 1000 });
  for (let i = 0; i < 2; i++) {
    assert.equal(plant(run, 0, "glowleaf"), true);
    assert.equal(clear(run, "copper").amount, 4);
    advanceSites(run, 12000);
    assert.equal(harvest(run, 0).amount, 3);
  }
  const item = buildRecipe(
    run,
    "forager",
    3,
    5,
    nextEntityId,
    addGearItem,
    gearBagLimit,
    true,
  );
  assert.equal(item.set, "forager");
  assert.equal(item.r, 2);
  assert.deepEqual(
    [run.coins, run.glowleaf, run.copperOre, run.scrap, run.shards],
    [300, 2, 4, 0, 0],
  );
});

test("tool purchases gate higher veins and focus pays only on the next crystal clear", () => {
  const run = funded(9999);
  assert.equal(depositAccess(run, "silver"), false);
  assert.equal(mine(run, "copper").amount, 0);
  assert.equal(run.sites.veins.copper.hp, 2);
  assert.equal(buyPick(run), true);
  assert.deepEqual([run.coins, run.copperOre, run.glowleaf], [9700, 24, 27]);
  run.total++;
  assert.equal(depositAccess(run, "silver"), true);
  assert.equal(depositAccess(run, "crystal"), false);
  assert.equal(mine(run, "silver").amount, 0);
  assert.equal(run.sites.veins.silver.hp, 3);
  assert.equal(clear(run, "silver").amount, 3);
  assert.equal(run.sites.veins.silver.remaining, 12000);
  assert.equal(mine(run, "silver"), null);
  run.total = 50000;
  assert.equal(plant(run, 0, "prismbloom"), true);
  advanceSites(run, 24000);
  harvest(run, 0);
  assert.equal(run.prismEssence, 31);
  assert.equal(run.sites.crystalFocus, true);
  assert.equal(clear(run, "copper").amount, 4);
  assert.equal(run.sites.crystalFocus, true);
  assert.equal(clear(run, "crystal").amount, 3);
  assert.equal(run.sites.crystalFocus, false);
  assert.equal(run.sites.veins.crystal.remaining, 20000);
  const before = [run.coins, run.silverOre, run.starCrystals, run.rootFiber];
  assert.equal(buyPick(run), true);
  assert.deepEqual(
    [run.coins, run.silverOre, run.starCrystals, run.rootFiber],
    before.map((n, i) => n - [2000, 6, 2, 4][i]),
  );
  advanceSites(run, 20000);
  mine(run, "crystal");
  assert.equal(run.sites.veins.crystal.hp, 4);
  assert.equal(clear(run, "crystal").amount, 2);
  assert.equal(buyPick(run), false);
});

test("research and automation leave planting costs manual and do not bank blocked swings", () => {
  const run = funded();
  for (const [id, cost] of Object.entries({
    extraPlot: [150, 6, 0, 3, 0, 0],
    irrigation: [500, 0, 6, 0, 4, 0],
    harvester: [2000, 8, 6, 0, 0, 2],
  })) {
    const ids = [
      "coins",
      "glowleaf",
      "rootFiber",
      "copperOre",
      "silverOre",
      "starCrystals",
    ];
    const before = ids.map((k) => run[k]);
    assert.equal(buyResearch(run, id), true);
    assert.equal(buyResearch(run, id), false);
    assert.deepEqual(
      ids.map((k) => run[k]),
      before.map((value, i) => value - cost[i]),
    );
  }
  assert.equal(plotCount(run), 2);
  assert.equal(run.sites.autoHarvest, false);
  assert.equal(setHarvestMode(run, true), true);
  plant(run, 1, "glowleaf");
  assert.equal(run.sites.plots[1].remaining, 9000);
  assert.equal(advanceSites(run, 9000).rewards[0].amount, 3);
  assert.equal(run.sites.plots[1], null);
  assert.equal(buyMiner(run), false);
  assert.equal(buyPick(run), true);
  assert.equal(buyMiner(run), true);
  assert.equal(run.sites.autoMine, false);
  assert.equal(setMiningMode(run, true, "silver"), true);
  advanceSites(run, 2999);
  assert.equal(run.sites.veins.silver.hp, deposits.silver.hp);
  advanceSites(run, 1);
  assert.equal(run.sites.veins.silver.hp, 3);
  advanceSites(run, 3000);
  assert.equal(run.sites.veins.silver.hp, 1);
  assert.equal(advanceSites(run, 3000).rewards[0].amount, 3);
  advanceSites(run, 12000);
  assert.equal(run.sites.swing, 0);
  advanceSites(run, 2500);
  assert.equal(setMiningMode(run, true, "copper"), true);
  assert.equal(run.sites.swing, 0);
  advanceSites(run, 1000, true);
  assert.equal(run.sites.veins.copper.hp, 3);
});

test("alternate Forge payment is atomic and leaves standard purchases and evolution unchanged", () => {
  const run = funded(2499);
  const item = { id: 10, slot: 0, r: 2, level: 1, value: 8 };
  addGearItem(run, item);
  assert.equal(materialOffer(run, item), null);
  run.total++;
  for (const extra of [
    { copperOre: 3, glowleaf: 2 },
    { silverOre: 2, rootFiber: 2 },
    { starCrystals: 1, prismEssence: 1 },
  ]) {
    const standard = forgeOffer(run, item);
    const alternate = materialOffer(run, item);
    assert.deepEqual(alternate.cost, {
      coins: Math.ceil(standard.cost.coins * 0.75),
      scrap: Math.ceil(standard.cost.scrap * 0.5),
      ...extra,
    });
    const k = Object.keys(extra)[0];
    run[k] = extra[k] - 1;
    assert.equal(forgeGear(run, item, true), false);
    assert.equal(item.forge || 0, standard.rank);
    run[k]++;
    for (const [key, amount] of Object.entries(alternate.cost))
      run[key] = amount;
    assert.equal(forgeGear(run, item, true), true);
    for (const key of Object.keys(alternate.cost)) assert.equal(run[key], 0);
    run.coins = 2000;
    run.scrap = 20;
  }
  assert.equal(item.forge, 3);
  const old = { id: 11, slot: 1, r: 0, level: 1, value: 8 };
  addGearItem(run, old);
  assert.equal(forgeGear(run, old), true);
  assert.equal(old.forge, 1);
});

test("sites round-trip through saves, travel keeps them and Ascension starts clean", () => {
  const run = funded();
  buyPick(run);
  buyMiner(run);
  buyResearch(run, "extraPlot");
  buyResearch(run, "harvester");
  setMiningMode(run, true, "silver");
  setHarvestMode(run, true);
  plant(run, 1, "glowleaf");
  advanceSites(run, 1100);
  clear(run, "copper");
  run.world = "desert";
  const copy = normalize(JSON.parse(JSON.stringify(run)));
  assert.deepEqual(copy.sites, run.sites);
  assert.equal(copy.world, "desert");
  const { run: reset } = performAscension(copy);
  assert.deepEqual(reset.sites, fresh().sites);
  assert.equal(reset.copperOre, 0);
  assert.equal(reset.glowleaf, 0);
  assert.equal(reset.world, "grasslands");
});
