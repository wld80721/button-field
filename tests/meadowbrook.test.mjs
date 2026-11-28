import assert from "node:assert/strict";
import test from "node:test";
import { buyMeadowSeed, freshMeadowbrook, normalizeMeadowbrook, sellMeadowCrops, sleepAtMeadowbrook, workMeadowPlot } from "../src/js/meadowbrook.js";
import { performAscension } from "../src/js/prestige.js";
import { normalize } from "../src/js/saves.js";
import { fresh } from "../src/js/state.js";

test("Meadowbrook harvests starter crops once and uses Button Field coins and run earnings", () => {
  const run = Object.assign(fresh(), { meadowbrook: freshMeadowbrook(), coins: 45, total: 600 });
  assert.equal(buyMeadowSeed(run, "pumpkin", 5), false);
  assert.equal(buyMeadowSeed(run, "pumpkin", 1), true);
  assert.equal(run.coins, 5);
  assert.equal(run.total, 600);
  assert.match(workMeadowPlot(run, "11,10", 0).message, /Turnip · ripe/);
  assert.equal(run.meadowbrook.bag.turnip, 0);
  for (const x of [11, 12, 13]) assert.equal(workMeadowPlot(run, `${x},10`, 4).changed, true);
  assert.equal(workMeadowPlot(run, "11,10", 4).changed, undefined);
  assert.deepEqual([run.meadowbrook.quest, run.meadowbrook.energy, run.coins, run.total], [1, 97, 50, 645]);
  assert.equal(sellMeadowCrops(run).changed, true);
  assert.equal(sellMeadowCrops(run).changed, undefined);
  assert.deepEqual([run.coins, run.total, run.asc.life], [110, 705, 105]);
});

test("tools enforce soil and seed requirements and watered crops grow overnight", () => {
  const run = Object.assign(fresh(), { meadowbrook: freshMeadowbrook() });
  const farm = run.meadowbrook;
  const key = "19,14";
  assert.equal(workMeadowPlot(run, key, 1).changed, undefined);
  assert.equal(workMeadowPlot(run, key, 5).changed, true);
  assert.equal(workMeadowPlot(run, key, 2, "turnip").changed, undefined);
  assert.equal(workMeadowPlot(run, key, 1).changed, true);
  assert.equal(workMeadowPlot(run, key, 2, "turnip").changed, true);
  assert.equal(workMeadowPlot(run, key, 3).changed, true);
  assert.equal(workMeadowPlot(run, key, 3).changed, undefined);
  assert.equal(farm.energy, 95);
  sleepAtMeadowbrook(farm, () => 0);
  assert.equal(farm.weather, "Rainy");
  assert.equal(farm.plots[key].growth, 1);
  assert.equal(farm.plots[key].water, true);
  assert.equal(farm.plots["15,10"].growth, 1);
  sleepAtMeadowbrook(farm, () => 0.9);
  assert.equal(farm.plots[key].growth, 2);
  assert.equal(farm.plots[key].water, false);
  assert.equal(farm.energy, 100);
});

test("Meadowbrook saves round trip, validates bounds and resets on Ascension", () => {
  const run = Object.assign(fresh(), { total: 10000, meadowbrook: freshMeadowbrook() });
  run.sites.plots[0] = { crop: "glowleaf", remaining: 8000 };
  workMeadowPlot(run, "11,10", 4);
  const migrated = normalize({ schemaVersion: 7, total: run.total, coins: 50, sites: run.sites });
  assert.equal(migrated.meadowbrook, null);
  assert.deepEqual(migrated.sites.plots[0], run.sites.plots[0]);
  assert.deepEqual(normalize(run).meadowbrook, run.meadowbrook);
  assert.equal(performAscension(run).run.meadowbrook, null);
  const repaired = normalizeMeadowbrook({
    player: { x: 50, y: 4 }, energy: 200, seeds: { turnip: -3 }, plots: {
      "11,10": { crop: "__proto__", growth: 999 }, "12,10": { crop: "pumpkin", growth: 999 },
      "100,100": { crop: "turnip" },
    },
  });
  assert.deepEqual(repaired.player, { x: 8.5, y: 9.5 });
  assert.equal(repaired.energy, 100);
  assert.equal(repaired.plots["11,10"].crop, null);
  assert.equal(repaired.plots["12,10"].growth, 5);
  assert.equal(Object.keys(repaired.plots).length, 77);
});
