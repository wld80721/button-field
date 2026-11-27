import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecipe,
  builds,
  craftCost,
  evolveGear,
} from "../src/js/build-gear.js";
import {
  applyPress,
  collectChest,
  getBuild,
  gearBagLimit,
  nextEntityId,
  spawnChest,
  tickClockwork,
} from "../src/js/gameplay.js";
import {
  addGearItem,
  gearValue,
  salvageGear,
  salvageYield,
} from "../src/js/gear.js";
import { performAscension } from "../src/js/prestige.js";
import { normalize } from "../src/js/saves.js";
import { fresh } from "../src/js/state.js";

const rates = { tap: 1, auto: 3, chance: 0.16 };
const high = () => 0.99;
const low = () => 0;
function funded() {
  return Object.assign(fresh(), {
    total: 1e7,
    coins: 2e6,
    scrap: 500,
    shards: 200,
    opened: 1,
  });
}
function craft(run, id, slot) {
  return buildRecipe(run, id, slot, 5, nextEntityId, addGearItem, gearBagLimit);
}
function equipSet(run, id, slots) {
  for (const slot of slots) run.equip[slot] = craft(run, id, slot).id;
}
function put(run, slot, extra = {}) {
  const item = {
    id: nextEntityId(run),
    slot,
    r: 0,
    level: 1,
    value: 1,
    ...extra,
  };
  addGearItem(run, item);
  return item;
}
function chest(run, r = 0) {
  // Direct fixture; queued world drops have distinct IDs and a stable position.
  const item = {
    id: nextEntityId(run),
    r,
    level: 1,
    x: 13,
    y: 25,
    ...(run.world !== "grasslands" ? { world: run.world } : {}),
  };
  run.chests.push(item);
  return item.id;
}

test("16 targeted recipes share exact prices and reject invalid, premature and full-bag actions", () => {
  const run = funded();
  const original = put(run, 0);
  assert.equal(craft(run, "missing", 0), null);
  assert.equal(craft(run, "forager", 4), null);
  run.total = 2499;
  assert.equal(craft(run, "forager", 0), null);
  run.total++;
  const coins = run.coins;
  const scrap = run.scrap;
  const shards = run.shards;
  for (const set of Object.keys(builds).filter((id) => !builds[id].rewardSlots && !builds[id].signature))
    for (let slot = 0; slot < 4; slot++) {
      const item = craft(run, set, slot);
      assert.equal(item.set, set);
      assert.equal(item.slot, slot);
      assert.equal(item.r, 2);
      assert.equal(item.level, 5);
    }
  assert.equal(run.items[0], original);
  assert.equal(run.found.length, 16);
  assert.equal(run.coins, coins - 16 * craftCost.coins);
  assert.equal(run.scrap, scrap - 16 * craftCost.scrap);
  assert.equal(run.shards, shards - 16 * craftCost.shards);
  while (run.items.length < gearBagLimit) put(run, 0);
  assert.equal(craft(run, "forager", 0), null);
  assert.equal(collectChest(run, chest(run), 0).full, true);
});

test("all evolution costs are atomic and preserve item identity, lock, and rank", () => {
  const run = funded();
  const item = craft(run, "clockwork", 2);
  run.equip[2] = item.id;
  item.locked = true;
  assert.equal(evolveGear(run, item), false);
  item.forge = 3;
  for (const [r, gate, cost, scrap, shards, multiplier] of [
    [2, 10000, 3000, 16, 8, 1.5],
    [3, 50000, 12000, 32, 16, 1.5],
    [4, 1000000, 100000, 60, 40, 1.2],
    [5, 10000000, 1000000, 120, 80, 1.2],
  ]) {
    run.total = gate - 1;
    assert.equal(evolveGear(run, item), false);
    run.total++;
    run.coins = cost - 1;
    assert.equal(evolveGear(run, item), false);
    run.coins++;
    run.scrap = scrap;
    run.shards = shards;
    const base = item.value;
    assert.equal(evolveGear(run, item), true);
    assert.equal(item.r, r + 1);
    assert.equal(item.value, Math.round(base * multiplier * 100) / 100);
    assert.deepEqual([run.coins, run.scrap, run.shards], [0, 0, 0]);
    assert.equal(run.found.at(-1), `set:clockwork:2:${item.r}`);
  }
  assert.equal(evolveGear(run, item), false);
  assert.equal(salvageGear(run, item), null);
  assert.deepEqual(salvageYield(item), { coins: 14, scrap: 5 });
  assert.equal(run.equip[2], item.id);
  assert.equal(item.forge, 3);
  assert.deepEqual(normalize(run).items, run.items);
});

test("Hammerhand opens only preexisting chests and four pieces can place a common", () => {
  for (const [slots, target] of [
    [[0], 20],
    [[1, 2], 15],
    [[0, 1, 2, 3], 15],
  ]) {
    const run = funded();
    equipSet(run, "hammerhand", slots);
    const id = chest(run);
    run.abilityProgress.hammerhand = target - 2;
    assert.equal(applyPress(run, rates, 0, high).opened, undefined);
    assert.equal(applyPress(run, rates, 0, high).opened.chest.id, id);
    assert.equal(run.presses, 2);
    assert.equal(run.abilityProgress.hammerhand, 0);
  }
  const fullSet = funded();
  equipSet(fullSet, "hammerhand", [0, 1, 2, 3]);
  fullSet.abilityProgress.hammerhand = 14;
  const currentDrop = applyPress(fullSet, rates, 0, low);
  assert.ok(currentDrop.chest);
  assert.equal(currentDrop.opened, undefined);
  assert.equal(fullSet.abilityProgress.hammerhand, 15);
  fullSet.chests.length = 0;
  const placed = applyPress(fullSet, rates, 0, high);
  assert.equal(placed.chest.r, 0);
  assert.equal(placed.ability, "Hammerhand");
  assert.equal(fullSet.abilityProgress.hammerhand, 0);
});

test("Clockwork charges only with passive income and only a full set opens blocked chests", () => {
  for (const [slots, target] of [
    [[2], 60],
    [[0, 1], 45],
    [[0, 1, 2, 3], 45],
  ]) {
    const run = funded();
    equipSet(run, "clockwork", slots);
    const profile = getBuild(run);
    run.abilityProgress.clockwork = (target - 1) * 1000;
    assert.equal(
      tickClockwork(run, 1, { ...rates, auto: 0 }, 0, profile),
      null,
    );
    assert.equal(tickClockwork(run, 1, rates, 0, profile, low).chest.r, 0);
    assert.equal(run.abilityProgress.clockwork, 0);
    while (run.chests.length < 12) chest(run);
    run.abilityProgress.clockwork = target * 1000;
    const result = tickClockwork(run, 1, rates, 0, profile, low);
    if (slots.length === 4)
      assert.equal(result.opened.chest.id, run.items.at(-1).id - 12);
    else assert.equal(result, null);
  }
});

test("Forager and Pathfinder use opening sources, charge capacity, and the existing Legendary cap", () => {
  const forager = funded();
  equipSet(forager, "forager", [3]);
  const start = forager.scrap;
  for (const source of ["auto", "ability", "manual", "manual"])
    assert.equal(
      collectChest(forager, chest(forager), 0, low, source).gathered,
      0,
    );
  assert.equal(collectChest(forager, chest(forager), 0, low).gathered, 2);
  assert.equal(forager.scrap, start + 2);
  equipSet(forager, "forager", [0, 1, 2]);
  forager.abilityProgress.forager = 2;
  const shards = forager.shards;
  assert.equal(
    collectChest(forager, chest(forager), 0, low, "auto").gathered,
    2,
  );
  assert.equal(forager.shards, shards + 2);

  for (const [slots, target, cap] of [
    [[1], 6, 1],
    [[0, 3], 5, 1],
    [[0, 1, 2, 3], 5, 2],
  ]) {
    const run = funded();
    equipSet(run, "pathfinder", slots);
    for (let i = 0; i < target * 3; i++)
      collectChest(run, chest(run), 0, low, "ability");
    assert.equal(run.abilityProgress.charges, 0);
    for (let i = 0; i < target * 3; i++)
      collectChest(run, chest(run), 0, low, "auto");
    assert.equal(run.abilityProgress.charges, cap);
    run.world = "celestial";
    run.worldProgress.celestial = 19;
    assert.equal(applyPress(run, rates, 0, low).chest.r, 1);
    assert.equal(run.abilityProgress.charges, cap);
    run.chests.length = 0;
    const rolls = [0, 0, 0.5, 0.5, 0.9999];
    assert.equal(
      applyPress(run, rates, 0, () => rolls.shift() ?? 0).chest.r,
      4,
    );
    assert.equal(run.abilityProgress.charges, cap);
    run.chests.length = 0;
    assert.equal(applyPress(run, rates, 0, low).chest.r, 1);
    assert.equal(run.abilityProgress.charges, cap - 1);
    assert.equal(spawnChest(run, { boost: 99, random: high }).r, 4);
  }
});

test("loot automation keeps first discoveries and protected builds, and respects the saved ceiling", () => {
  const run = funded();
  const selected = put(run, 0, { value: 2, locked: true });
  run.equip[0] = selected.id;
  run.lootRules = {
    equip: "protect",
    salvage: true,
    ceiling: 0,
    duplicates: true,
  };
  assert.equal(collectChest(run, chest(run), 0, low).disposition, "kept");
  assert.equal(collectChest(run, chest(run), 0, low).disposition, "salvaged");
  assert.equal(collectChest(run, chest(run, 1), 0, low).disposition, "kept");
  assert.equal(collectChest(run, chest(run, 2), 0, low).disposition, "kept");
  assert.equal(run.equip[0], selected.id);
  delete selected.locked;
  selected.set = "hammerhand";
  assert.equal(collectChest(run, chest(run, 3), 0, low).disposition, "kept");
  run.lootRules.equip = "strongest";
  const replacement = collectChest(run, chest(run, 3), 0, low);
  assert.equal(replacement.disposition, "equipped");
  assert.equal(run.equip[0], replacement.item.id);
  assert.ok(gearValue(replacement.item) > gearValue(selected));
  const { run: reset } = performAscension(run);
  assert.deepEqual(reset.lootRules, run.lootRules);
  assert.equal(reset.items.length, 0);
  assert.equal(reset.abilityProgress.charges, 0);
});

test("equal-cost crafted builds specialize in separate activities with seeded rolls", () => {
  const results = {};
  function scenario(set) {
    const run = funded();
    equipSet(run, set, [0, 1, 2, 3]);
    return run;
  }
  function randomFor(seed) {
    return () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  }
  for (const id of Object.keys(builds).filter(
    (id) => !builds[id].rewardSlots && !builds[id].signature,
  )) {
    const clickRun = scenario(id);
    let fastOpens = 0;
    const pressRandom = randomFor(31);
    for (let i = 0; i < 100; i++) {
      const result = applyPress(clickRun, rates, 0, pressRandom);
      fastOpens += Number(Boolean(result.opened));
    }
    const idleRun = scenario(id);
    let generated = 0;
    const idleRandom = randomFor(44);
    for (let sec = 0; sec < 185; sec++) {
      generated += Number(
        Boolean(
          tickClockwork(idleRun, 1, rates, 0, getBuild(idleRun), idleRandom)
            ?.chest,
        ),
      );
    }
    const lootRun = scenario(id);
    const lootRandom = randomFor(55);
    let shards = lootRun.shards;
    let scrap = lootRun.scrap;
    for (let i = 0; i < 12; i++)
      collectChest(lootRun, chest(lootRun), 0, lootRandom, "auto");
    const material = [lootRun.scrap - scrap, lootRun.shards - shards];
    const treasureRandom = randomFor(4);
    let raised = 0;
    for (let i = 0; i < 20; i++) {
      raised += Number(
        applyPress(lootRun, { ...rates, chance: 0.55 }, 0, treasureRandom)
          .bonus === "Pathfinder",
      );
    }
    results[id] = { fastOpens, generated, material, raised };
  }
  assert.ok(results.hammerhand.fastOpens > 0);
  assert.ok(results.clockwork.generated >= 3);
  assert.deepEqual(results.forager.material, [8, 16]);
  assert.equal(results.pathfinder.raised, 2);
  for (const [id, score] of Object.entries(results)) {
    assert.equal(score.fastOpens > 0, id === "hammerhand");
    assert.equal(score.generated > 0, id === "clockwork");
    assert.equal(score.material[0] > 0, id === "forager");
    assert.equal(score.raised > 0, id === "pathfinder");
  }
});
