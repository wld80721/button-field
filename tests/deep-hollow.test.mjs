import assert from "node:assert/strict";
import test from "node:test";
import { W, hollowWorld } from "../src/js/deep-hollow-map.js";
import { bankHollowCopper, finishHollowTile, freshDeepHollow, hollowTarget, normalizeDeepHollow, rideHollowLift, sellHollowHaul, upgradeHollow } from "../src/js/deep-hollow.js";
import { performAscension } from "../src/js/prestige.js";
import { normalize } from "../src/js/saves.js";
import { fresh } from "../src/js/state.js";

function setup(seed = 6) {
  const run = Object.assign(fresh(), { total: 2500, coins: 100, deepHollow: freshDeepHollow(seed) });
  return { run, mine: run.deepHollow, board: hollowWorld(seed) };
}

test("digging records cleared tiles and ore and the lift preserves the miner's checkpoint", () => {
  const { run, mine, board } = setup();
  for (let i = 0; i < 4; i++) {
    const target = hollowTarget(mine, board, 0, 1);
    assert.equal(target.seconds, 0);
    assert.equal(finishHollowTile(run, board, target).id, 0);
  }
  const copper = hollowTarget(mine, board, 0, 1);
  assert.equal(copper.seconds, 0.5);
  assert.equal(finishHollowTile(run, board, copper).id, 3);
  assert.equal(mine.inv[0], 1);
  assert.deepEqual(mine.cleared, [9 * W + 26]);
  assert.equal(finishHollowTile(run, board, copper), null);
  assert.equal(bankHollowCopper(run), 0);
  assert.equal(upgradeHollow(run, "pick"), false);
  assert.equal(rideHollowLift(mine), true);
  assert.equal(bankHollowCopper(run), 1);
  assert.equal(run.copperOre, 1);
  assert.equal(rideHollowLift(mine), true);
  assert.equal(mine.y, 9);
  assert.equal(hollowWorld(mine.seed, mine.cleared)[9 * W + 26], 0);
});

test("camp sales credit coins and contracts once, while purchases and copper transfers leave run earnings alone", () => {
  const { run, mine } = setup();
  mine.inv[0] = 6;
  mine.inv[1] = 1;
  assert.deepEqual(sellHollowHaul(run), { coins: 40, reward: 25 });
  assert.equal(sellHollowHaul(run), null);
  assert.equal(run.total, 2565);
  assert.equal(run.coins, 165);
  assert.equal(upgradeHollow(run, "pick"), true);
  assert.equal(run.total, 2565);
  assert.equal(run.coins, 105);
  assert.equal(mine.pick, 1);
  mine.inv[0] = 12;
  assert.equal(bankHollowCopper(run), 12);
  assert.equal(run.copperOre, 12);
  assert.equal(mine.sold[0], 6);
  assert.equal(mine.goal, 1);
});

test("save validation protects bedrock, repairs invalid positions and caps haul at backpack capacity", () => {
  const original = normalizeDeepHollow({
    seed: 6, cleared: [-2, 9 * W + 26, 9 * W + 26, 99 * W + 26],
    x: 26, y: 9, deep: { x: 26, y: 99 }, inv: [12, 20], goal: 99,
  });
  assert.deepEqual(original.cleared, [9 * W + 26]);
  assert.deepEqual(original.deep, { x: 26, y: 9 });
  assert.deepEqual(original.inv, [12, 0, 0, 0, 0, 0]);
  assert.equal(original.goal, 8);
  const { run } = setup();
  run.total = 10000;
  run.deepHollow = original;
  assert.deepEqual(normalize(run).deepHollow, original);
  assert.equal(normalize({ schemaVersion: 8, total: 2500, coins: 800 }).deepHollow, null);
  assert.equal(performAscension(run).run.deepHollow, null);
});

test("a full backpack blocks ore without consuming it or changing the save", () => {
  const { run, mine, board } = setup();
  mine.y = 8;
  mine.inv[1] = 12;
  const target = hollowTarget(mine, board, 0, 1);
  assert.equal(target.blocked, true);
  assert.equal(finishHollowTile(run, board, target), null);
  assert.equal(board[9 * W + 26], 3);
  assert.equal(mine.y, 8);
});
