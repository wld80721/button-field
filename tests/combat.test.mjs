import assert from "node:assert/strict";
import test from "node:test";
import { bosses, combatSets } from "../src/js/boss-data.js";
import { buildRecipe, lootValue } from "../src/js/build-gear.js";
import { assignField, recruitPets } from "../src/js/companions.js";
import {
  advanceFight,
  bossAccess,
  claimBossGear,
  combatLoadout,
  currentMove,
  freshCombat,
  guardFight,
  retreatFight,
  startFight,
  strikeBoss,
} from "../src/js/combat.js";
import { rarity, slots } from "../src/js/data.js";
import { fieldLevel, gearBagLimit } from "../src/js/gameplay.js";
import { performAscension } from "../src/js/prestige.js";
import { normalize } from "../src/js/saves.js";
import { fresh } from "../src/js/state.js";

function fixture(id, build) {
  const def = bosses[id];
  const run = fresh();
  run.world = def.world;
  run.total = def.at;
  if (def.requires) {
    run.combat.clears[def.requires] = "claimed";
    run.combat.records[def.requires] = { wins: 1, best: 15000 };
  }
  run.up.power = Math.min(12, 7 + Math.floor(Math.log10(def.at / 5000)));
  run.skills.force = Number(def.at >= 10000);
  run.skills.echo = Number(def.at >= 20000);
  run.skills.sun = Number(def.at >= 250000);
  run.coins = 2000;
  const gear = slots.map((_, slot) => ({
    id: slot + 1,
    slot,
    r: 1,
    level: fieldLevel(run),
    value: lootValue(run.world, fieldLevel(run), slot, rarity[1].scale),
    ...(build ? { set: build } : {}),
  }));
  return { run, gear };
}

function advance(run, elapsed) {
  const events = [];
  for (let left = elapsed; left > 0; left -= 1000)
    events.push(...advanceFight(run, Math.min(left, 1000)));
  return events;
}

function attempt(id) {
  const { run, gear } = fixture(id);
  assert.equal(startFight(run, id, gear), true);
  return run;
}

test("ten bosses have distinct art, warnings and equipment, with run and local prerequisites", () => {
  const catalog = Object.entries(bosses);
  assert.equal(catalog.length, 10);
  assert.equal(new Set(catalog.map(([, b]) => b.art.join())).size, 10);
  assert.equal(new Set(catalog.map(([, b]) => b.title)).size, 10);
  assert.equal(
    new Set(catalog.map(([, b]) => b.reward.set + b.reward.slot)).size,
    10,
  );
  for (const [id, def] of catalog) {
    const { run, gear } = fixture(id);
    assert.equal(bossAccess(run, id), true, id);
    run.total--;
    assert.equal(bossAccess(run, id), false, id);
    run.total++;
    if (def.world !== "grasslands") {
      run.world = "grasslands";
      assert.equal(bossAccess(run, id), false, id);
    }
    run.world = def.world;
    if (def.requires) {
      delete run.combat.clears[def.requires];
      assert.equal(bossAccess(run, id), false, id);
      run.combat.clears[def.requires] = "unclaimed";
    }
    assert.equal(startFight(run, id, gear), true);
    assert.equal(startFight(run, id, gear), false);
    assert.equal(run.combat.attempt.hp, def.hp);
    assert.equal(retreatFight(run), true);
    assert.equal(run.combat.records[id], undefined);
    for (const phase of def.phases)
      for (const move of phase) {
        assert.ok(move.warning >= 1600);
        assert.ok(move.name);
      }
  }
});

test("Guard opens at the exact warning boundary and the first boss rewards a timed riposte", () => {
  const run = attempt("mossguard");
  const a = run.combat.attempt;
  advance(run, 2999);
  assert.equal(guardFight(run), false);
  assert.equal(advance(run, 1)[0].type, "warning");
  advance(run, 1999);
  assert.equal(guardFight(run), true);
  assert.equal(guardFight(run), false);
  assert.equal(advance(run, 1)[0].type, "block");
  assert.equal(a.playerHp, 100);
  assert.equal(a.exposed, 2000);
  assert.equal(
    strikeBoss(run)[0].amount,
    Math.round((a.loadout.damage + 6) * 1.25),
  );
  advance(run, 2000);
  assert.equal(a.exposed, 0);
  assert.equal(strikeBoss(run)[0].amount, a.loadout.damage);
  advance(run, 3000);
  assert.equal(a.playerHp, 72);
  assert.equal(guardFight(run), false);
});

test("Bramble heals until pruned, Scarab shells, Jackal feints, and Rimeback cracks with Guard", () => {
  const bramble = attempt("bramble");
  for (let i = 0; i < 5; i++) strikeBoss(bramble);
  advance(bramble, 3000);
  for (let i = 0; i < 3; i++) strikeBoss(bramble);
  assert.equal(guardFight(bramble), true);
  assert.equal(advance(bramble, 2600)[0].amount, 33);
  advance(bramble, 3000);
  for (let i = 0; i < 4; i++) strikeBoss(bramble);
  assert.equal(guardFight(bramble), true);
  assert.equal(advance(bramble, 2600)[0].type, "block");

  const scarab = attempt("scarab");
  const hit = strikeBoss(scarab)[0].amount;
  advance(scarab, 3000);
  assert.equal(strikeBoss(scarab)[0].amount, Math.round(hit / 2));

  const jackal = attempt("jackal");
  advance(jackal, 3000);
  assert.match(currentMove(jackal.combat.attempt).name, /Feint/);
  assert.equal(guardFight(jackal), false);
  assert.equal(advance(jackal, 1600)[0].name, "Pounce");
  assert.equal(guardFight(jackal), true);
  assert.equal(advance(jackal, 1800)[0].type, "block");

  const rime = attempt("rimeback");
  let a = rime.combat.attempt;
  assert.equal(strikeBoss(rime)[0].amount, Math.round(a.loadout.damage * 0.4));
  advance(rime, 3000);
  assert.equal(guardFight(rime), true);
  advance(rime, 1800);
  assert.equal(strikeBoss(rime)[0].amount, a.loadout.damage + 8);
  advance(rime, 3000);
  assert.equal(strikeBoss(rime)[0].amount, Math.round(a.loadout.damage * 0.4));
});

test("Wisp reflection caps at four, Furnace vents by heat or time, and Weaver needs two guards", () => {
  const wisp = attempt("wisp");
  advance(wisp, 3000);
  for (let i = 0; i < 5; i++) strikeBoss(wisp);
  assert.equal(wisp.combat.attempt.playerHp, 80);
  assert.equal(guardFight(wisp), true);
  advance(wisp, 5200);
  strikeBoss(wisp);
  assert.equal(
    wisp.combat.attempt.playerHp,
    75,
    "Reflection resets on next warning",
  );

  const furnace = attempt("furnace");
  for (let i = 0; i < 7; i++) strikeBoss(furnace);
  assert.equal(furnace.combat.attempt.mode, "open");
  assert.equal(strikeBoss(furnace)[1].name, "Vent");
  assert.equal(advance(furnace, 2000)[0].amount, 44);
  assert.equal(advance(furnace, 6000)[0].name, "Vent");
  assert.equal(guardFight(furnace), true);
  advance(furnace, 2000);
  assert.equal(furnace.combat.attempt.heat, 0);

  const weaver = attempt("weaver");
  advance(weaver, 3000);
  assert.equal(guardFight(weaver), true);
  assert.equal(advance(weaver, 1800)[1].name, "Magma Wave · second");
  assert.equal(weaver.combat.attempt.guarded, false);
  assert.equal(advance(weaver, 1800)[0].amount, 38);
});

test("Mantis interrupt and Orrery threshold transitions preserve the next warning", () => {
  const mantis = attempt("mantis");
  advance(mantis, 3000);
  for (let i = 0; i < 2; i++) strikeBoss(mantis);
  assert.equal(mantis.combat.attempt.mode, "warn");
  assert.equal(strikeBoss(mantis)[1].type, "interrupt");
  assert.equal(mantis.combat.attempt.exposed, 2000);
  assert.match(advance(mantis, 3000)[0].name, /^Moon Scythe/);

  const orrery = attempt("orrery");
  const a = orrery.combat.attempt;
  advance(orrery, 3000);
  a.hp = 910;
  advance(orrery, 2199);
  assert.equal(a.phase, 0);
  assert.equal(guardFight(orrery), true);
  assert.equal(advance(orrery, 1)[1].phase, 1);
  assert.equal(advance(orrery, 3000)[0].name, "Twin Orbit · first");
  a.hp = 430;
  assert.equal(advance(orrery, 1800)[1].phase, 2);
  assert.equal(advance(orrery, 2000)[0].name, "Falling Star");
  assert.equal(a.remaining, 1600);
});

test("gear, learned skills, four-piece sets and all three companion roles contribute", () => {
  const { run, gear } = fixture("rimeback", "vanguard");
  run.scrap = 6;
  run.glowleaf = 3;
  run.sites.pick = 1;
  recruitPets(run);
  assert.ok(assignField(run, "sparrow", 0));
  assert.ok(assignField(run, "mole", 1));
  run.companions.pets.mole.xp = 810;
  run.companions.pets.mole.evolved = true;
  run.skills.star = 1;
  const profile = combatLoadout(run, gear);
  assert.equal(profile.maxHp, 115);
  assert.ok(profile.damage > combatLoadout(run, []).damage);
  assert.deepEqual(
    profile.pets.map((pet) => [pet.role, pet.power]),
    [
      ["strike", 2],
      ["break", 7],
    ],
  );
  startFight(run, "rimeback", gear);
  const a = run.combat.attempt;
  run.up.power = 0;
  run.skills.force = 0;
  assert.deepEqual(a.loadout, profile);
  const amounts = Array.from({ length: 5 }, () => strikeBoss(run)[0].amount);
  assert.equal(amounts[4] - amounts[0], 4);
  advance(run, 8000);
  assert.equal(
    a.loadout.pets.every((p) => p.ready),
    true,
  );
  const assisted = strikeBoss(run)[0].amount;
  assert.ok(assisted >= amounts[0] + 6);
  assert.equal(
    a.loadout.pets.some((p) => p.ready),
    false,
  );

  const ward = fixture("rimeback", "wardweaver");
  ward.run.glowleaf = 3;
  recruitPets(ward.run);
  assert.equal(assignField(ward.run, "moth", 0), true);
  startFight(ward.run, "rimeback", ward.gear);
  advance(ward.run, 4800);
  assert.equal(ward.run.combat.attempt.playerHp, 75);
  advance(ward.run, 3200);
  assert.equal(guardFight(ward.run), true);
  advance(ward.run, 1600);
  assert.equal(ward.run.combat.attempt.playerHp, 85);
  assert.equal(ward.run.combat.attempt.riposte, 14);

  const star = fixture("scarab");
  star.gear[2].set = star.gear[3].set = "starbound";
  startFight(star.run, "scarab", star.gear);
  advance(star.run, 3000);
  assert.equal(guardFight(star.run), true);
  advance(star.run, 5000);
  const b = star.run.combat.attempt;
  assert.equal(b.mode, "warn");
  const riposte = b.riposte;
  assert.equal(strikeBoss(star.run)[0].amount, b.loadout.damage + riposte);
  assert.equal(strikeBoss(star.run)[0].amount, b.loadout.damage);
  assert.equal(
    strikeBoss(star.run)[0].amount,
    Math.round(b.loadout.damage / 2),
  );
});

test("combat defeat is free and each boss reward survives a full bag and can be claimed once per run", () => {
  const lost = attempt("mossguard");
  advance(lost, 24000);
  assert.equal(lost.combat.attempt, null);
  assert.equal(lost.coins, 2000);
  assert.deepEqual(lost.combat, freshCombat());
  for (const [id, boss] of Object.entries(bosses)) {
    const run = attempt(id);
    run.combat.attempt.hp = 1;
    const reward = strikeBoss(run).at(-1);
    assert.deepEqual(reward, { type: "victory", id, reward: true, ...(id === "mossguard" && { blueprint: true }) });
    assert.deepEqual(strikeBoss(run), []);
    const batch = Array.from({ length: gearBagLimit }, (_, i) => ({
      id: i + 1,
      slot: 0,
      r: 0,
      level: 1,
      value: 1,
    }));
    run.items = batch;
    run.nextId = gearBagLimit + 1;
    assert.equal(claimBossGear(run, id), null);
    const reloaded = normalize(JSON.parse(JSON.stringify(run)));
    assert.equal(reloaded.combat.clears[id], "unclaimed");
    reloaded.items.pop();
    const item = claimBossGear(reloaded, id);
    assert.equal(item.set, boss.reward.set);
    assert.equal(item.r, combatSets[item.set].baseRarity);
    assert.equal(item.slot, boss.reward.slot);
    assert.equal(item.locked, true);
    assert.equal(item.id, gearBagLimit + 1);
    assert.equal(claimBossGear(reloaded, id), null);
    assert.equal(
      buildRecipe(
        reloaded,
        item.set,
        item.slot,
        1,
        () => 999,
        () => {},
        gearBagLimit,
      ),
      null,
    );
    assert.equal(startFight(reloaded, id, []), true);
    reloaded.combat.attempt.hp = 1;
    assert.equal(strikeBoss(reloaded).at(-1).reward, false);
    assert.equal(reloaded.combat.records[id].wins, 2);
  }
});

test("save restores combat snapshot, guard, timer and pending reward, and Ascension keeps trophies", () => {
  const run = attempt("weaver");
  advance(run, 3500);
  guardFight(run);
  const a = run.combat.attempt;
  const restored = normalize(JSON.parse(JSON.stringify(run)));
  assert.deepEqual(restored.combat, run.combat);
  assert.equal(restored.combat.attempt.remaining, a.remaining);
  assert.equal(advance(restored, a.remaining)[0].type, "block");
  advance(restored, 1800);
  restored.combat.attempt.hp = 1;
  strikeBoss(restored);
  assert.equal(startFight(restored, "weaver", []), true);
  const ascended = performAscension(restored).run;
  assert.equal(ascended.combat.attempt, null);
  assert.deepEqual(ascended.combat.clears, {});
  assert.deepEqual(ascended.combat.records, restored.combat.records);
  assert.equal(ascended.items.length, 0);
  assert.deepEqual(normalize(ascended).combat, ascended.combat);
  assert.deepEqual(
    normalize({ schemaVersion: 4, total: 5000, opened: 8 }).combat,
    freshCombat(),
  );
  assert.equal(normalize({ ...run, world: "frozen" }).combat.attempt, null);
});

function simulate(id, loadout, pressesPerSecond, missFirst) {
  const { run, gear } = fixture(id);
  if (loadout === "vanguard" || loadout === "wardweaver")
    gear.forEach((item) => (item.set = loadout));
  if (loadout === "mixed")
    gear.forEach((item, i) => (item.set = i < 2 ? "vanguard" : "wardweaver"));
  startFight(run, id, gear);
  let lastWarningEnd = null;
  let end;
  let strikeAt = 0;
  const interval = 1000 / pressesPerSecond;
  let time = 0;
  for (; time <= 60000 && run.combat.attempt; time += 100) {
    const a = run.combat.attempt;
    const move = currentMove(a);
    const warning = a.mode === "warn";
    if (
      warning &&
      move.damage &&
      a.remaining < move.warning - 650 &&
      move.kind !== "interrupt"
    ) {
      const warningEnd = a.time + a.remaining;
      if (lastWarningEnd !== warningEnd) {
        if (!missFirst || lastWarningEnd !== null) guardFight(run);
        lastWarningEnd = warningEnd;
      }
    }
    if (time >= strikeAt) {
      strikeAt += interval;
      if (!warning || move.kind !== "reflect") end = strikeBoss(run).at(-1);
    }
    if (run.combat.attempt) end = advanceFight(run, 100).at(-1) || end;
  }
  return { cleared: end?.type === "victory", time };
}

test("seeded at-unlock progression and varied loadouts can clear the roster at a steady tap rate", (t) => {
  const outcomes = Object.keys(bosses).map((id) => [
    id,
    simulate(id, "", 2.5, false),
  ]);
  for (const [id, outcome] of outcomes)
    t.diagnostic(id + " · " + outcome.time / 1000 + "s");
  for (const [id, outcome] of outcomes) {
    assert.ok(outcome.cleared, id);
    if (id === "mossguard")
      assert.ok(outcome.time >= 10000 && outcome.time <= 25000);
    if (["weaver", "mantis", "orrery"].includes(id))
      assert.ok(outcome.time >= 25000 && outcome.time <= 60000);
  }
  for (const id of ["rimeback", "wisp", "weaver"]) {
    const times = ["vanguard", "wardweaver", "mixed"].map((set) =>
      simulate(id, set, 2.5, true),
    );
    assert.ok(times.every((outcome) => outcome.cleared));
    assert.ok(times[0].time < times[1].time);
    assert.ok(times[2].time <= times[1].time);
  }
});
