import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";

const saveKey = "treasure-grove-v3";
const migrationKey = saveKey + "-before-combat";
const livingMigrationKey = saveKey + "-before-living-field";
const documentUrl = "https://button-field.test/";
const standalone = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const executablePath = process.env.CHROMIUM_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
let browser;

before(async () => {
  browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox"],
  });
});
after(() => browser?.close());

function browserTest(name, run, { init, viewport = { width: 390, height: 844 }, motion = "reduce", touch = false } = {}) {
  test(name, async () => {
    const context = await browser.newContext({ offline: true, viewport, reducedMotion: motion, hasTouch: touch });
    const assets = [];
    await context.route("**/*", (route) => {
      if (route.request().url() === documentUrl) {
        return route.fulfill({ contentType: "text/html; charset=utf-8", body: standalone });
      }
      if (route.request().resourceType() !== "other") assets.push(route.request().url());
      return route.abort();
    });
    await context.addInitScript(() => {
      window.testRandom = () => 0.99;
      Math.random = () => window.testRandom();
    });
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error));
    page.setDefaultTimeout(4000);
    await page.clock.install();
    try {
      await page.goto(documentUrl);
      await run(page);
      assert.deepEqual(assets, [], "The standalone file attempted to load a separate asset");
      assert.deepEqual(errors.map(String), [], "Uncaught JavaScript errors");
    } finally {
      await context.close();
    }
  });
}

const fieldEntrances = {
  "#upgrades": "workshop", "#skills": "grove", "#companions": "camp",
  "#farm": "farm", "#mine": "mine", "#bosses": "bosses", "#worlds": "gate",
};
const visibleEntrance = (selector) => `${selector}:visible, [data-landmark="${fieldEntrances[selector]}"]:visible`;
const click = (page, selector) => page.locator(selector).click();
async function finishWork(page, selector, strikes) {
  await click(page, selector);
  await click(page, "#smith-furnace");
  if (!(await page.locator("#smithAssist").isChecked())) await page.locator("#smithAssist").check();
  for (let i = 0; i < strikes; i++) await click(page, "#smith-anvil");
  await click(page, "#smith-quench");
}
const text = (page, selector) => page.locator(selector).innerText();
const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
const stored = (page, key) => page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
const escape = (page) => page.keyboard.press("Escape");

async function importSave(page, data) {
  await click(page, "#settings");
  await page.locator("#saveText").fill(JSON.stringify(data));
  await click(page, "#import");
  await page.locator("#modal").waitFor({ state: "hidden" });
}

async function fieldPresses(page, count) {
  for (let press = 0; press < count; press++) await click(page, "#press");
}

function equipment(slot, { id = slot + 1, value = 10, world, r = 0, forge } = {}) {
  return { id, slot, value, r, level: 1, ...(world && { world }), ...(forge && { forge }) };
}

function chest(id, world, rarity = 0) {
  return { id, x: 25 + 10 * id, y: 36, r: rarity, level: 2, ...(world && { world }) };
}

function assertAmount(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}

browserTest("first chest, equipment, protected salvage, collection and audio", async (page) => {
  await page.keyboard.press("Space");
  await fieldPresses(page, 6);
  assert.equal((await saved(page)).presses, 7);
  await fieldPresses(page, 1);
  await click(page, "[data-chest]");
  const opened = await saved(page);
  assert.equal(opened.opened, 1);
  assert.equal(opened.items.length, 1);
  assert.equal(await page.locator(".chest.opening").count(), 1);
  assert.equal(await page.locator(".ground-loot").count(), 1);
  await click(page, "#inventory");
  const piece = opened.items[0];
  await click(page, `[data-equip="${piece.id}"]`);
  assert.equal((await saved(page)).equip[piece.slot], piece.id);
  assert.equal(await page.locator("[data-salvage]").isDisabled(), true);
  await page.locator("#filter").selectOption(String(piece.slot));
  await click(page, `[data-equip="${piece.id}"]`);
  await click(page, `[data-salvage="${piece.id}"]`);
  const salvaged = await saved(page);
  assert.equal(salvaged.items.length, 0);
  assert.equal(salvaged.scrap, 1 + piece.r);
  assert.equal(salvaged.coins, 8 + 2 + piece.r * 3);
  await escape(page);
  await click(page, "#collection");
  assert.match(await text(page, "#collectionCount"), /1\/28/);
  await escape(page);
  assert.ok(await page.evaluate(() => window.testTones > 0), "Synthesized audio should play");
  await click(page, "#soundToggle");
  await page.reload();
  assert.equal(await page.locator("#soundToggle").getAttribute("aria-pressed"), "false");
}, {
  init: () => {
    window.testTones = 0;
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      window.testTones++;
      return createOscillator.call(this);
    };
  },
});

browserTest("guide timing, spoiler policy, keyboard focus and live Workshop reveal", async (page) => {
  const guide = "#progressionGuide";
  await click(page, guide);
  assert.match(await text(page, "#guideChapter"), /First steps/i);
  assert.match(await text(page, "#guideNext"), /Workshop/i);
  assert.match(await text(page, "#guideGoal"), /chest/i);
  assert.equal(await page.locator("#guideNext .guide-entry").count(), 2);
  assert.match(await text(page, "#guideEarned"), /0\s*\/\s*25/);
  assert.doesNotMatch(await text(page, "#modalBody"), /Volcano|Celestial Realm|Transcendence|Ascension/i);
  assert.ok(await page.locator(".window").evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
  await escape(page);
  assert.ok(await page.locator(guide).evaluate((el) => el === document.activeElement));
  assert.ok(await page.locator(visibleEntrance("#upgrades")).isHidden());

  await click(page, visibleEntrance("#worlds"));
  let worlds = await text(page, "#modalBody");
  assert.match(worlds, /Grasslands/);
  assert.match(worlds, /Desert/);
  assert.doesNotMatch(worlds, /Frozen Lands|Volcano|Celestial Realm|Dune Surge/);
  await escape(page);

  const fresh = await saved(page);
  const expected = [
    [24, /Workshop/],
    [25, /Forge|Treasure compass/i],
    [149, /Forge|Treasure compass/i],
    [150, /Skilltree|[Ss]hards/],
    [599, /Skilltree|[Ss]hards/],
    [600, /Garden [Hh]elper/],
    [2499, /Garden [Hh]elper/],
    [2500, /Boss Board/],
    [4999, /Boss Board/],
    [5000, /Desert|Ascension/],
    [9999, /Desert|Ascension/],
    [10000, /Frozen Lands/],
    [49999, /Frozen Lands/],
    [50000, /Volcano/],
    [249999, /Volcano/],
    [250000, /Celestial Realm/],
    [999999, /Celestial Realm/],
  ];
  for (const [total, unlock] of expected) {
    await importSave(page, { ...fresh, total, coins: total, opened: 1, wheelClaims: 1, presses: 55 });
    await click(page, guide);
    assert.match(await text(page, "#guideNext .guide-entry:first-child"), unlock, `Guide at ${total}`);
    assert.ok(await page.locator("#guideNext .guide-entry").count() <= 2);
    await escape(page);
  }
  await importSave(page, { ...fresh, total: 175, opened: 1, presses: 49 });
  await click(page, guide);
  assert.match(await text(page, "#guideGoal"), /1 more press.*wheel/i);
  await escape(page);
  await fieldPresses(page, 1);
  await click(page, guide);
  assert.match(await text(page, "#guideGoal"), /reward.*ready/i);
  await escape(page);

  await importSave(page, { ...fresh, total: 140, coins: 500, up: { auto: 1 } });
  await click(page, visibleEntrance("#upgrades"));
  assert.ok(await page.locator("[data-buy='1']").isDisabled());
  await page.clock.runFor(3800);
  assert.ok(await page.locator("[data-buy='1']").isEnabled());
  await click(page, "[data-buy='1']");
  assert.equal((await saved(page)).up.fortune, 1);
  await escape(page);

  await importSave(page, { ...fresh, total: 10000, coins: 300, world: "grasslands" });
  await click(page, visibleEntrance("#worlds"));
  worlds = await text(page, "#modalBody");
  assert.match(worlds, /Dune Surge/);
  assert.match(worlds, /Frozen Lands/);
  assert.doesNotMatch(worlds, /Thaw|Volcano|Celestial Realm/);
  await click(page, "[data-travel='desert']");
  assert.equal(await text(page, "#worldName"), "Desert");
  assert.equal((await saved(page)).coins, 300);
});

browserTest("Ascension preview shows only its requirement until eligible", async (page) => {
  const fresh = await saved(page);
  await importSave(page, { ...fresh, total: 600, opened: 1, presses: 20 });
  await click(page, visibleEntrance("#skills"));
  assert.ok(await page.locator("[data-tree-tab='ascend']").isHidden());
  await escape(page);
  await importSave(page, { ...fresh, total: 5000, opened: 1, presses: 20 });
  await click(page, visibleEntrance("#skills"));
  const ascend = page.locator("[data-tree-tab='ascend']");
  assert.ok(await ascend.isVisible());
  assert.ok(await ascend.isDisabled());
  assert.match(await ascend.innerText(), /10,000/);
  assert.equal(await page.locator("[data-asc-buy]").count(), 0);
  await escape(page);
  await importSave(page, { ...fresh, total: 10000, coins: 10000 });
  await click(page, visibleEntrance("#skills"));
  assert.ok(await ascend.isEnabled());
  await ascend.click();
  assert.equal(await page.locator("[data-asc-buy]").count(), 6);
}, { viewport: { width: 320, height: 568 } });

browserTest("forge uses original rates and gear index follows import, salvage and forge", async (page) => {
  const fresh = await saved(page);
  const basic = equipment(0, { value: 1 });
  const spare = equipment(3, { id: 2, r: 1 });
  await importSave(page, { ...fresh, total: 150, coins: 24, scrap: 2, items: [basic, spare], equip: { 0: 1 } });
  await click(page, "#inventory");
  await click(page, "[data-open-forge='1']");
  assert.ok(await page.locator("#forgeBuy").isDisabled());
  await click(page, "[data-open='inventory']");
  await click(page, "[data-salvage='2']");
  await click(page, "[data-open-forge='1']");
  assert.ok(await page.locator("#forgeBuy").isEnabled());
  await finishWork(page, "#forgeBuy", 2);
  const forged = await saved(page);
  assert.equal(forged.coins, 4);
  assert.equal(forged.scrap, 2);
  assert.equal(forged.items[0].forge, 1);
  assert.equal(forged.items[0].value, 1);
  assert.equal(await text(page, "#tapValue"), "2.12");
  await page.reload();
  assert.deepEqual(await saved(page), forged);
  await click(page, "#settings");
  await click(page, "#export");
  assert.deepEqual(JSON.parse(await page.locator("#saveText").inputValue()), forged);
  await escape(page);
  await importSave(page, { ...fresh, total: 150, items: [equipment(0, { value: 810 })], equip: { 0: 1 } });
  assert.equal(await text(page, "#tapValue"), "811");
  await click(page, "#inventory");
  await click(page, "[data-equip='1']");
  assert.equal(await text(page, "#tapValue"), "1");
  await click(page, "[data-salvage='1']");
  assert.equal((await saved(page)).items.length, 0);
});

browserTest("home-field play, terrain travel and both regional-set thresholds", async (page) => {
  const fresh = await saved(page);
  // Snapshot and press in one browser task so passive ticks cannot affect the delta.
  const coinDelta = () => page.evaluate((key) => {
    document.querySelector("#settings").click();
    document.querySelector("#export").click();
    const before = JSON.parse(document.querySelector("#saveText").value).coins;
    document.querySelector("#close").click();
    document.querySelector("#press").click();
    return JSON.parse(localStorage.getItem(key)).coins - before;
  }, saveKey);
  const worldSets = async (world, pieces, charge, extra = {}) => {
    const items = Array.from({ length: pieces }, (_, slot) => equipment(slot, { world }));
    await importSave(page, {
      ...fresh,
      total: 1000000,
      opened: 1,
      world,
      worldProgress: { [world]: charge },
      items,
      equip: Object.fromEntries(items.map((item) => [item.slot, item.id])),
      ...extra,
    });
  };
  await worldSets("grasslands", 2, 19);
  assert.match(await text(page, "#worldStatus"), /19\/21/);
  await fieldPresses(page, 1);
  assert.equal((await saved(page)).chests.length, 0);
  await fieldPresses(page, 1);
  assert.equal((await saved(page)).chests.length, 1);
  await worldSets("grasslands", 4, 16);
  await fieldPresses(page, 1);
  assert.equal((await saved(page)).chests.length, 1);
  const terrains = new Set();
  terrains.add(await page.locator("#terrain").evaluate((el) => el.toDataURL()));
  await click(page, "#inventory");
  await click(page, ".gear-sets summary:text-is('Equipped world sets')");
  assert.equal(await page.locator(".set-active").count(), 2);
  await escape(page);
  for (const id of ["desert", "frozen", "volcano", "celestial"]) {
    await click(page, visibleEntrance("#worlds"));
    await click(page, `[data-travel="${id}"]`);
    terrains.add(await page.locator("#terrain").evaluate((el) => el.toDataURL()));
  }
  assert.equal(terrains.size, 5, "Worlds have distinct pixel terrains");
  assert.deepEqual(await page.locator("#terrain").evaluate((el) => el.getAnimations().length), 0);
  assert.equal(await page.locator("[data-chest]").count(), 0);
  assert.equal((await saved(page)).chests.length, 1, "Chests remain parked in their world");
  await click(page, "#inventory");
  await click(page, ".gear-sets summary:text-is('Equipped world sets')");
  assert.equal(await page.locator(".set-active").count(), 0);
  await escape(page);

  for (const [pieces, charge, factor] of [[2, 9, 5], [4, 7, 6]]) {
    await worldSets("desert", pieces, charge);
    assertAmount(await coinDelta(), 12.1 * factor);
    assert.equal((await saved(page)).worldProgress.desert, 0);
  }
  await worldSets("frozen", 2, 8, { up: { auto: 1 } });
  const two = await saved(page);
  await fieldPresses(page, 1);
  assert.ok((await saved(page)).coins >= two.coins + 12.1 + 7 * 3 - 1e-8);
  assert.equal((await saved(page)).shards, 0);
  await worldSets("frozen", 4, 8);
  await fieldPresses(page, 1);
  assert.equal((await saved(page)).shards, 1);

  await worldSets("volcano", 2, 1);
  assertAmount(await coinDelta(), 12.1 * 2.25);
  await worldSets("volcano", 4, 1);
  await page.evaluate(() => { window.testRandom = () => 0.32; });
  await fieldPresses(page, 1);
  assert.equal((await saved(page)).chests.length, 1);
  await fieldPresses(page, 1);
  assert.equal((await saved(page)).chests.length, 1);

  await worldSets("celestial", 4, 14);
  await page.evaluate(() => {
    const rolls = [0, 0, 0.5, 0.5, 0.7];
    window.testRandom = () => rolls.shift() ?? 0.5;
  });
  await fieldPresses(page, 1);
  assert.equal((await saved(page)).chests[0].r, 3);
  assert.equal((await saved(page)).worldProgress.celestial, 0);
});

browserTest("skill prerequisites, passive income, chest speed and local Auto Chest", async (page) => {
  const fresh = await saved(page);
  await importSave(page, { ...fresh, total: 600, coins: 5000, shards: 30 });
  await click(page, visibleEntrance("#skills"));
  await click(page, "[data-node='autoChest']");
  assert.ok(await page.locator("[data-learn='autoChest']").isDisabled());
  await click(page, "[data-node='helper']");
  await click(page, "[data-learn='helper']");
  await click(page, "[data-node='autoChest']");
  await click(page, "[data-learn='autoChest']");
  assert.equal((await saved(page)).skills.autoChest, 1);
  await escape(page);
  await click(page, visibleEntrance("#upgrades"));
  await click(page, "[data-buy='3']");
  assert.equal((await saved(page)).up.chestSpeed, 1);
  await escape(page);

  await importSave(page, {
    ...fresh,
    total: 10000,
    world: "desert",
    chests: [chest(1), chest(2, "desert", 2)],
    skills: { helper: 1, autoChest: 1 },
    up: { chestSpeed: 20 },
  });
  await click(page, "#settings");
  await page.clock.runFor(1200);
  assert.equal((await saved(page)).opened, 0);
  await escape(page);
  await page.clock.runFor(1200);
  const result = await saved(page);
  assert.equal(result.opened, 1);
  assert.deepEqual(result.chests.map((c) => c.id), [1]);
  assert.equal(result.items[0].world, "desert");
  assert.equal(result.shards, 3);
  assert.ok(result.coins > 0);
});

browserTest("all milestone wheel rewards and Ascension reset", async (page) => {
  const fresh = await saved(page);
  for (let reward = 0; reward < 6; reward++) {
    const target = 50 * (reward + 1);
    await importSave(page, { ...fresh, presses: target, wheelClaims: reward, wheelNextAt: target });
    await click(page, "#wheel");
    await click(page, "#wheelClaim");
    const after = await saved(page);
    assert.equal(after.wheelClaims, reward + 1);
    assert.equal(after.wheelNextAt, target + 50);
    assert.equal(after.coins, [100, 0, 0, 250, 0, 0][reward]);
    assert.equal(after.shards, [0, 3, 0, 0, 5, 0][reward]);
    assert.deepEqual(after.chests.map((item) => item.r), [[], [], [2], [], [], [3]][reward]);
    await click(page, "#close");
    assert.ok(await page.locator("#wheel").isHidden());
  }

  await importSave(page, {
    ...fresh,
    total: 90000,
    asc: { ...fresh.asc, life: 100000, up: { ...fresh.asc.up, seed: 1 } },
    scrap: 4,
    items: [equipment(0, { forge: 3 })],
    presses: 10,
    world: "desert",
  });
  await click(page, visibleEntrance("#skills"));
  await click(page, "[data-tree-tab='ascend']");
  await click(page, "[data-asc-start]");
  await escape(page);
  await click(page, visibleEntrance("#skills"));
  assert.equal(await page.locator("[data-asc-confirm]").count(), 0);
  await click(page, "[data-asc-start]");
  await click(page, "[data-asc-confirm]");
  const ascended = await saved(page);
  assert.equal(ascended.asc.stars, 3);
  assert.equal(ascended.asc.earned, 3);
  assert.equal(ascended.asc.runs, 1);
  assert.equal(ascended.asc.life, 100000);
  assert.equal(ascended.coins, 250);
  assert.equal(ascended.total, 0);
  assert.equal(ascended.items.length, 0);
  assert.equal(ascended.scrap, 0);
  assert.equal(ascended.wheelNextAt, 50);
  assert.equal(ascended.world, "grasslands");
  await click(page, "[data-asc-buy='might']");
  assert.equal((await saved(page)).asc.up.might, 1);
  await escape(page);
  assert.ok(await page.locator(visibleEntrance("#skills")).isVisible(), "Skilltree remains accessible on subsequent runs");
});

const legacySaves = [
  ["original", { total: 80, coins: 10, presses: 80, up: { power: 1 }, items: [equipment(0)], equip: { 0: 1 } }],
  ["New Worlds", {
    total: 10001, coins: 50, presses: 70, world: "desert", worldProgress: { desert: 5 },
    chests: [chest(2), chest(3, "desert")], items: [equipment(0, { world: "desert" })], equip: { 0: 1 },
  }],
  ["Equipment Forge", {
    total: 10001, coins: 50, presses: 70, scrap: 7, world: "desert", worldProgress: { desert: 5 },
    chests: [chest(2), chest(3, "desert")], items: [equipment(0, { world: "desert", forge: 2 })], equip: { 0: 1 },
    wheelClaims: 1, wheelNextAt: 100, asc: { runs: 1, earned: 1, stars: 1, life: 11000 },
  }],
];
legacySaves.push(["Foundation", { schemaVersion: 1, coins: 8500, total: 10000, items: [equipment(0, { r: 4, forge: 3 })], equip: { 0: 1 }, found: ["0-4"] }]);
legacySaves.push(["Equipment Expansion", { schemaVersion: 2, total: 10000, coins: 1100,
  items: [{ ...equipment(0, {r: 2, forge: 3}), set: "hammerhand", locked: true }], equip: {0: 1},
  found: ["set:hammerhand:0:2"], lootRules: { equip: "off" }, abilityProgress: {hammerhand: 11} }]);
legacySaves.push(["Farming and Mining", { schemaVersion: 3, total: 10000, coins: 1100, opened: 5,
  glowleaf: 5, copperOre: 4, sites: { plots: [{ crop: "glowleaf", remaining: 4321 }], pick: 1,
    veins: { silver: { hp: 3, remaining: 0 } } } }]);
legacySaves.push(["Companions", { schemaVersion: 4, total: 5000, coins: 1200, opened: 7,
  companions: { pets: { beetle: { xp: 12, cooldown: 4321, gear: "bell" } }, field: ["beetle"], artifacts: ["bell"] } }]);
for (const [release, legacy] of legacySaves) {
  const raw = JSON.stringify(legacy, null, 2);
  browserTest(`migrate and back up ${release}`, async (page) => {
    assert.match(await text(page, "#saveStatus"), /Saved locally/i);
    const migrated = await saved(page);
    assert.equal(migrated.schemaVersion, 9);
    assert.deepEqual(migrated.fieldDiscoveries, []);
    assert.equal(await stored(page, livingMigrationKey), raw);
    assert.equal(await stored(page, migrationKey), raw);
    assert.equal(migrated.lootRules.equip, "off");
    assert.equal(migrated.lootRules.salvage, false);
    if (legacy.found) assert.deepEqual(migrated.found, legacy.found);
    if (legacy.abilityProgress) assert.equal(migrated.abilityProgress.hammerhand, legacy.abilityProgress.hammerhand);
    if (legacy.sites) {
      assert.deepEqual(migrated.sites.plots, [legacy.sites.plots[0], null]);
      assert.deepEqual(migrated.sites.veins.silver, legacy.sites.veins.silver);
      assert.equal(migrated.sites.pick, 1);
      assert.equal(migrated.glowleaf, 5);
      assert.equal(migrated.copperOre, 4);
      assert.ok(migrated.companions.pets.beetle);
    } else {
      assert.deepEqual(migrated.sites.plots, [null, null]);
      assert.equal(migrated.sites.pick, 0);
    }
    assert.equal(await stored(page, saveKey + "-before-farming-mining"), legacy.schemaVersion >= 3 ? null : raw);
    assert.equal(await stored(page, saveKey + "-before-companions"), legacy.schemaVersion === 4 ? null : raw);
    assert.deepEqual(migrated.combat, { records: {}, clears: {}, attempt: null });
    if (legacy.companions) {
      assert.equal(migrated.companions.pets.beetle.cooldown, 4321);
      assert.equal(migrated.companions.pets.beetle.gear, "bell");
      assert.deepEqual(migrated.companions.field, ["beetle", null]);
    }
    assert.equal(migrated.sites.autoHarvest, false);
    assert.equal(migrated.sites.autoMine, false);
    for (const field of ["total", "coins", "presses", "scrap", "world", "items", "equip", "chests", "wheelClaims", "wheelNextAt"]) {
      if (field in legacy) assert.deepEqual(migrated[field], legacy[field], field);
    }
    if (legacy.world) assert.equal(migrated.worldProgress[legacy.world], 5);
    if (legacy.asc) assert.equal(migrated.asc.life, 11000);
    await page.reload();
    assert.deepEqual(await saved(page), migrated);
    await click(page, "#settings");
    await click(page, "#exportPreCombat");
    assert.equal(await page.locator("#saveText").inputValue(), raw);
  }, {
    init: (() => {
      const source = `(() => {
        Object.defineProperty(document, "hidden", { get: () => true });
        if (sessionStorage.getItem("test-seeded")) return;
        sessionStorage.setItem("test-seeded","true");
        localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(raw)});
      })()`;
      return source;
    })(),
  });
}

for (const [reason, bad] of [["corrupt JSON", "{this is invalid"], ["unsupported version", '{"schemaVersion":99,"coins":100,"total":100}']]) {
  browserTest(`protects local data on ${reason}`, async (page) => {
    assert.match(await text(page, "#saveStatus"), /Autosave paused/i);
    await fieldPresses(page, 1);
    assert.equal(await stored(page, saveKey), bad);
    assert.equal(await stored(page, migrationKey), null);
    await click(page, "#settings");
    await click(page, "#exportStoredSave");
    assert.equal(await page.locator("#saveText").inputValue(), bad);
    await page.locator("#saveText").fill("{}");
    await click(page, "#import");
    assert.ok(await page.locator("#modal").isVisible());
    assert.equal(await stored(page, saveKey), bad);
    await escape(page);
    await importSave(page, { coins: 7, total: 7 });
    assert.equal((await saved(page)).coins, 7);
    assert.equal((await saved(page)).schemaVersion, 9);
  }, { init: `localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(bad)})` });
}

browserTest("backup storage failure suspends automatic writes", async (page) => {
  assert.match(await text(page, "#saveStatus"), /Autosave paused/i);
  await fieldPresses(page, 1);
  assert.equal(await stored(page, saveKey), '{"coins":12,"total":12}');
  assert.equal(await stored(page, migrationKey), null);
  await importSave(page, { coins: 20, total: 20 });
  assert.equal((await saved(page)).coins, 20);
}, {
  init: () => {
    localStorage.setItem("treasure-grove-v3", '{"coins":12,"total":12}');
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "treasure-grove-v3-before-combat") throw new DOMException("Simulated quota", "QuotaExceededError");
      return set.call(this, key, value);
    };
  },
});

browserTest("unreadable storage never triggers an automatic replacement", async (page) => {
  assert.match(await text(page, "#saveStatus"), /Autosave paused/i);
  await fieldPresses(page, 1);
  assert.equal(await page.evaluate(() => window.testOriginalStoredSave()), '{"coins":14,"total":14}');
  await click(page, "#settings");
  assert.match(await text(page, "#saveWarning"), /could not read/i);
  await escape(page);
  await importSave(page, { coins: 3, total: 3 });
  const value = await page.evaluate(() => JSON.parse(window.testOriginalStoredSave()));
  assert.equal(value.coins, 3);
}, {
  init: () => {
    const key = "treasure-grove-v3";
    localStorage.setItem(key, '{"coins":14,"total":14}');
    const get = Storage.prototype.getItem;
    window.testOriginalStoredSave = () => get.call(localStorage, key);
    Storage.prototype.getItem = function (name) {
      if (name === key) throw new DOMException("Simulated read failure", "SecurityError");
      return get.call(this, name);
    };
  },
});

browserTest("ID repair, large balances, number labels and compact HUD updates", async (page) => {
  const fresh = await saved(page);
  await importSave(page, {
    ...fresh,
    coins: 1e12,
    total: 1e12,
    items: [equipment(0, { value: 4 }), equipment(1, { id: 1 })],
    chests: [chest(1), chest(2)],
    equip: { 0: 1, 1: 1 },
  });
  const repaired = await saved(page);
  assert.equal(new Set([...repaired.items, ...repaired.chests].map((item) => item.id)).size,
    repaired.items.length + repaired.chests.length);
  assert.match(await text(page, "#coins"), /T$/);
  await importSave(page, { ...fresh, coins: 1e15, total: 1e15, up: { auto: 1 } });
  assert.match(await text(page, "#coins"), /e\+?15$/i);
  await page.evaluate(() => {
    window.testHudMutations = 0;
    new MutationObserver((changes) => { window.testHudMutations += changes.length; })
      .observe(document.querySelector(".hud"), { subtree: true, childList: true, characterData: true });
  });
  await page.clock.runFor(3500);
  assert.ok(await page.evaluate(() => window.testHudMutations <= 1));
  await importSave(page, {
    ...fresh,
    coins: Number.MAX_VALUE,
    total: Number.MAX_VALUE,
    asc: { ...fresh.asc, earned: Number.MAX_VALUE, up: { ...fresh.asc.up, might: 20, cosmos: 20 } },
  });
  await fieldPresses(page, 1);
  const huge = await saved(page);
  assert.equal(huge.coins, Number.MAX_VALUE);
  assert.equal(huge.total, Number.MAX_VALUE);
  assert.doesNotMatch(await text(page, ".hud"), /NaN|Infinity/i);
}, { viewport: { width: 1280, height: 800 } });

const baselinePath = process.env.BUTTON_FIELD_BASELINE;
test("compare stable tick and full-inventory work with the previous release", { skip: !baselinePath }, async (t) => {
  async function measure(html) {
    const context = await browser.newContext({
      offline: true,
      viewport: { width: 1280, height: 800 },
      reducedMotion: "reduce",
    });
    try {
      await context.route(documentUrl, (route) =>
        route.fulfill({ contentType: "text/html; charset=utf-8", body: html }),
      );
      const page = await context.newPage();
      await page.clock.install();
      await page.goto(documentUrl);
      await page.waitForFunction(() =>
        document.querySelector("#terrain").getContext("2d").getImageData(0, 0, 1, 1).data[3] > 0,
      );
      const initialTerrain = await page.locator("#terrain").evaluate((canvas) => canvas.toDataURL());
      const fresh = await saved(page);
      const items = Array.from({ length: 300 }, (_, index) => equipment(index % 4, { id: index + 1 }));
      await importSave(page, {
        ...fresh,
        total: 1e15,
        coins: 1e15,
        up: { auto: 1 },
        equip: { 0: 297, 1: 298, 2: 299, 3: 300 },
        items,
      });
      await page.evaluate(() => {
        window.testWork = { bagFinds: 0, hudMutations: 0 };
        const find = Array.prototype.find;
        Array.prototype.find = function (...args) {
          if (this.length === 300 && this[0]?.slot !== undefined) window.testWork.bagFinds++;
          return find.apply(this, args);
        };
        new MutationObserver((changes) => { window.testWork.hudMutations += changes.length; })
          .observe(document.querySelector(".hud"), { subtree: true, childList: true, characterData: true });
      });
      await page.clock.runFor(2000);
      await click(page, "#inventory");
      assert.equal(await page.locator(".item-card").count(), 300);
      const work = await page.evaluate(() => window.testWork);
      return { ...work, initialTerrain };
    } finally {
      await context.close();
    }
  }
  const baseline = await measure(readFileSync(baselinePath, "utf8"));
  const revised = await measure(standalone);
  assert.equal(revised.initialTerrain, baseline.initialTerrain, "Grasslands canvas pixels changed");
  assert.ok(revised.bagFinds <= baseline.bagFinds,
    `Expected no increase in linear bag scans (old ${baseline.bagFinds}, new ${revised.bagFinds})`);
  assert.ok(revised.hudMutations <= baseline.hudMutations);
  t.diagnostic(`Linear bag scans ${baseline.bagFinds} → ${revised.bagFinds}`);
  t.diagnostic(`Stable HUD DOM mutations ${baseline.hudMutations} → ${revised.hudMutations}`);
});

browserTest("craft, compare by keyboard, lock, filter, evolve and reload", async (page) => {
  await importSave(page, { total: 1e7, coins: 2e6, scrap: 500, shards: 250, opened: 1 });
  await click(page, landmark("forge"));
  await click(page, "#smith-table");
  await page.locator("#recipeSet").selectOption("hammerhand");
  await page.locator("#recipeSlot").selectOption("0");
  await finishWork(page, "#craftGear", 3);
  assert.match(await text(page, "#recipeResult"), /Hammerhand Gloves/);
  await click(page, "[data-open=inventory]");
  await page.locator("[data-compare='1']").focus();
  assert.match(await text(page, "#gearComparison"), /Adds.*Hammerhand/);
  assert.match(await text(page, "#gearComparison"), /Coins per press/);
  await escape(page);
  assert.ok(await page.locator("#gearComparison").isHidden());
  assert.ok(await page.locator("#modal").isVisible());
  await click(page, "[data-lock='1']");
  assert.ok(await page.locator("[data-salvage='1']").isDisabled());
  await page.locator("#gearLocked").selectOption("yes");
  await page.locator("#gearSet").selectOption("hammerhand");
  await page.locator("#gearRarity").selectOption("2");
  assert.equal(await page.locator(".item-card").count(), 1);
  await click(page, "[data-open-forge='1']");
  for (let i=0; i<3; i++) await finishWork(page, "#forgeBuy", 2);
  for (let i=0; i<4; i++) await finishWork(page, "#evolveBuy", i < 2 ? 3 : 4);
  assert.match(await text(page, "#evolutionInfo"), /Highest evolution/);
  const evolved = (await saved(page)).items[0];
  assert.equal(evolved.r, 6);
  assert.equal(evolved.set, "hammerhand");
  assert.equal(evolved.locked, true);
  assert.equal(evolved.forge, 3);
  await page.reload();
  assert.deepEqual((await saved(page)).items[0], evolved);
  await click(page, "#collection");
  await page.locator("#collectionWorld").selectOption("hammerhand");
  assert.match(await text(page, "#collectionCount"), /5\/20/);
}, { viewport: {width: 320, height: 568} });

browserTest("touch comparison and opt-in automation apply only to incoming gear", async (page) => {
  await importSave(page, {
    total: 2500, coins: 1000, opened: 1, world: "grasslands",
    items: [equipment(0, { value: 50 }), equipment(1)],
    equip: { 0: 1 }, found: ["0-0", "1-0"], chests: [chest(8)],
  });
  await click(page, "#inventory");
  await page.locator("[data-compare='2']").tap();
  assert.ok(await page.locator("#gearComparison").isVisible());
  await escape(page);
  await click(page, "#lootRules summary");
  await page.locator("#lootEquip").selectOption("protect");
  await page.locator("#lootDisposal").selectOption("salvage");
  assert.match(await text(page, "#lootRuleSummary"), /Protect current build.*duplicates only/);
  assert.equal((await saved(page)).items.length, 2);
  await escape(page);
  await page.evaluate(() => window.testRandom = () => 0);
  await click(page, "[data-chest='8']");
  assert.match(await text(page, "#ticker"), /Auto-salvaged/);
  assert.equal((await saved(page)).items.length, 2);
  await page.reload();
  assert.equal((await saved(page)).lootRules.equip, "protect");
}, { touch: true });

browserTest("Hammerhand opens a previously parked chest and preserves the press count", async (page) => {
  await importSave(page, {
    total: 3000, coins: 1000, opened: 1,
    items: [{ ...equipment(0, { r: 2 }), set: "hammerhand" }],
    equip: { 0: 1 }, chests: [chest(8)],
    abilityProgress: { hammerhand: 19 },
  });
  await click(page, "#press");
  const run = await saved(page);
  assert.equal(run.presses, 1);
  assert.equal(run.opened, 2);
  assert.equal(run.abilityProgress.hammerhand, 0);
  assert.equal(await page.locator("[data-chest='8'].opening").count(), 1);
});

browserTest("Clockwork pauses in menus and resumes from saved active-field time", async (page) => {
  await importSave(page, {
    total: 3000, coins: 1000, opened: 1,
    items: [{ ...equipment(2, { r: 2 }), set: "clockwork" }],
    equip: { 2: 3 }, abilityProgress: { clockwork: 58000 },
  });
  await click(page, "#inventory");
  await page.clock.runFor(4000);
  assert.equal(await page.locator("[data-chest]").count(), 0);
  await escape(page);
  await page.clock.runFor(3200);
  const run = await saved(page);
  assert.equal(run.chests.length, 1);
  assert.equal(run.chests[0].r, 0);
  assert.match(await text(page, "#ticker"), /Clockwork placed/);
});

browserTest("mixed signatures collect materials and spend a Pathfinder charge on new drops", async (page) => {
  await importSave(page, {
    total: 5000, coins: 1000, opened: 1, scrap: 9,
    items: [
      { ...equipment(1, { r: 2 }), set: "pathfinder" },
      { ...equipment(3, { r: 2 }), set: "forager" },
    ],
    equip: { 1: 2, 3: 4 },
    chests: [chest(5)],
    abilityProgress: { forager: 2, pathfinder: 5 },
  });
  await page.evaluate(() => window.testRandom = () => 0);
  await click(page, "[data-chest='5']");
  let run = await saved(page);
  assert.equal(run.scrap, 11);
  assert.equal(run.abilityProgress.charges, 1);
  assert.match(await text(page, "#ticker"), /Forager/);
  await fieldPresses(page, 1);
  run = await saved(page);
  assert.equal(run.chests[0].r, 1);
  assert.equal(run.abilityProgress.charges, 0);
  assert.equal(await page.getByRole("button", { name: "Open Uncommon treasure chest" }).count(), 1);
});

browserTest("mobile farming and mining gates stay below the board and fund both Forge routes", async (page) => {
  await importSave(page, { total: 599, coins: 1000, opened: 1 });
  assert.ok(await page.locator("#fieldSites").isHidden());
  await fieldPresses(page, 1);
  assert.ok(await page.locator(visibleEntrance("#farm")).isVisible());
  assert.ok(await page.locator(visibleEntrance("#mine")).isHidden());
  await click(page, visibleEntrance("#farm"));
  assert.match(await text(page, "#modalTitle"), /Garden/);
  assert.ok(await page.locator("#plot-1").isHidden());
  await escape(page);

  await importSave(page, { total: 2500, coins: 1000, opened: 1, scrap: 2 });
  assert.ok(await page.locator(visibleEntrance("#mine")).isVisible());
  const geometry = await page.evaluate(() => {
    const sites = document.getElementById("livingField").getBoundingClientRect();
    const board = document.getElementById("board").getBoundingClientRect();
    return { below: sites.top >= board.bottom - 13, fits: document.documentElement.scrollWidth <= innerWidth + 1 };
  });
  assert.deepEqual(geometry, { below: true, fits: true });
  for (let i = 0; i < 2; i++) {
    await click(page, visibleEntrance("#farm"));
    await click(page, "#plant-0");
    await escape(page);
    const before = (await saved(page)).sites.plots[0].remaining;
    await fieldPresses(page, 1);
    assert.ok((await saved(page)).sites.plots[0].remaining <= before - 1000);
    await click(page, visibleEntrance("#mine"));
    assert.match(await text(page, "#pickStatus"), /Stone Pick/);
    for (let hit = 0; hit < 3; hit++) await click(page, "#mine-copper");
    assert.ok(await page.locator("#mine-copper").isDisabled());
    assert.match(await text(page, "#siteResult"), /4 Copper Ore/);
    await escape(page);
    await click(page, visibleEntrance("#farm"));
    await page.clock.runFor(12500);
    await click(page, "#harvest-0");
    assert.match(await text(page, "#siteResult"), /3 Glowleaf/);
    await escape(page);
  }
  let run = await saved(page);
  assert.equal(run.glowleaf, 6);
  assert.equal(run.copperOre, 8);
  assert.equal(run.presses, 2);
  assert.equal(run.wheelNextAt, 50);
  await click(page, landmark("forge"));
  await click(page, "#smith-table");
  assert.ok(await page.locator("#craftGear").isDisabled());
  await page.locator("#recipePayment").selectOption("materials");
  await finishWork(page, "#craftGear", 3);
  await click(page, "[data-open=inventory]");
  const id = (await saved(page)).items[0].id;
  await click(page, `[data-open-forge="${id}"]`);
  await page.locator("#forgePayment").selectOption("materials");
  await finishWork(page, "#forgeBuy", 2);
  run = await saved(page);
  assert.deepEqual([run.glowleaf, run.copperOre, run.scrap], [0, 1, 0]);
  assert.equal(run.items[0].forge, 1);
}, { viewport: {width: 320, height: 568}, touch: true });

browserTest("visible site timers pause in a hidden tab and retain progress on reload", async (page) => {
  await importSave(page, { total: 2500, coins: 1000, opened: 1 });
  await click(page, visibleEntrance("#farm"));
  await click(page, "#plant-0");
  await page.evaluate(() => {
    window.testHidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const remaining = (await saved(page)).sites.plots[0].remaining;
  await page.clock.runFor(20000);
  assert.ok(await page.locator("#harvest-0").isHidden());
  assert.equal((await saved(page)).sites.plots[0].remaining, remaining);
  await page.reload();
  assert.equal((await saved(page)).sites.plots[0].remaining, remaining);
  await click(page, visibleEntrance("#farm"));
  await page.clock.runFor(13000);
  assert.ok(await page.locator("#harvest-0").isVisible());
}, { init: () => {
  window.testHidden = false;
  Object.defineProperty(document, "hidden", { get: () => window.testHidden });
} });

browserTest("research, tools, automation, travel and Ascension use the same saved sites", async (page) => {
  await importSave(page, { total: 50000, coins: 10000, glowleaf: 30, rootFiber: 30,
    silverOre: 30, copperOre: 30, starCrystals: 30 });
  await click(page, visibleEntrance("#farm"));
  for (const id of ["extraPlot", "irrigation", "harvester"]) await click(page, "#research-" + id);
  assert.ok(await page.locator("#plot-1").isVisible());
  await page.locator("#autoHarvest").check();
  await page.locator("#seed-1").selectOption("prismbloom");
  assert.match(await text(page, "#seedInfo-1"), /21s/);
  await click(page, "#plant-1");
  await escape(page);
  await click(page, visibleEntrance("#mine"));
  await click(page, "#buyPick");
  assert.match(await text(page, "#pickStatus"), /Copper Pick/);
  await click(page, "#buyPick");
  assert.match(await text(page, "#pickStatus"), /Resonant Pick/);
  await click(page, "#buyMiner");
  await page.locator("#mineTarget").selectOption("copper");
  await page.locator("#autoMine").check();
  await page.clock.runFor(3500);
  assert.match(await text(page, "#siteResult"), /4 Copper Ore/);
  assert.ok(await page.locator("#mine-copper").isDisabled());
  await escape(page);
  await click(page, visibleEntrance("#worlds"));
  await click(page, "[data-travel=desert]");
  assert.equal(await text(page, "#worldName"), "Desert");
  await click(page, visibleEntrance("#farm"));
  await page.clock.runFor(22000);
  const gathered = await saved(page);
  assert.equal(gathered.sites.plots[1], null);
  assert.equal(gathered.prismEssence, 1);
  assert.equal(gathered.sites.crystalFocus, true);
  assert.equal(gathered.sites.pick, 2);
  await escape(page);
  await click(page, visibleEntrance("#skills"));
  await click(page, "[data-tree-tab=ascend]");
  await click(page, "[data-asc-start]");
  await click(page, "[data-asc-confirm]");
  const reset = await saved(page);
  assert.deepEqual(reset.sites.plots, [null, null]);
  assert.equal(reset.sites.pick, 0);
  assert.equal(reset.sites.autoMine, false);
  assert.equal(reset.prismEssence, 0);
  assert.equal(reset.copperOre, 0);
  assert.ok(await page.locator("#fieldSites").isHidden());
}, { viewport: { width: 1280, height: 800 } });

const petCard = (id) => `.pet-card[data-pet-arg="${id}"]`;
const petAction = (command, arg) => `[data-pet-command="${command}"]${arg === undefined ? "" : `[data-pet-arg="${arg}"]`}`;

browserTest("recruit companions and claim an offline trip exactly once", async (page) => {
  assert.ok(await page.locator(visibleEntrance("#companions")).isHidden());
  await importSave(page, { total: 2500, coins: 100, opened: 1, scrap: 3 });
  await click(page, visibleEntrance("#companions"));
  assert.equal(await page.locator(".pet-card").count(), 15);
  assert.match(await text(page, petCard("beetle")), /Button Beetle.*Home/s);
  assert.match(await text(page, petCard("ferret")), /Locked/);
  await click(page, petCard("ferret"));
  assert.match(await text(page, "#petProfile"), /Visit Desert.*30 chests/);
  assert.ok(await page.locator(".window").evaluate(el => el.scrollWidth <= el.clientWidth + 1));
  await click(page, petCard("beetle"));
  await click(page, petAction("send", "grove"));
  assert.match(await text(page, "#petMessage"), /departed for Grove Trail/);
  assert.match(await text(page, petCard("beetle")), /Away/);
  assert.ok(await page.locator(petAction("field")).count() === 0);
  const dispatched = await saved(page);
  assert.equal(dispatched.companions.trips[0].duration, 90000);
  await page.clock.setSystemTime(dispatched.companions.trips[0].finishAt + 100);
  await page.reload();
  await click(page, visibleEntrance("#companions"));
  assert.match(await text(page, "#petTrips"), /Ready to claim/);
  assert.equal((await saved(page)).glowleaf, 0);
  await click(page, petAction("claim", "0"));
  assert.match(await text(page, "#petMessage"), /Field Bell/);
  let result = await saved(page);
  assert.equal(result.glowleaf, 3);
  assert.equal(result.scrap, 5);
  assert.equal(result.companions.pets.beetle.xp, 12);
  assert.ok(result.blacksmith.recipes.includes("wraithweave"));
  assert.equal(result.companions.trips[0], null);
  await click(page, petAction("gear", "bell"));
  assert.equal((await saved(page)).companions.pets.beetle.gear, "bell");
  await page.reload();
  await click(page, visibleEntrance("#companions"));
  assert.equal(await page.locator(petAction("claim")).count(), 0);
  assert.equal((await saved(page)).glowleaf, 3);
  await click(page, petCard("sparrow"));
  await click(page, petAction("send", "grove"));
  await click(page, petAction("cancel", "0"));
  assert.match(await text(page, "#petMessage"), /canceled/);
  result = await saved(page);
  assert.equal(result.glowleaf, 3);
  assert.equal(result.companions.pets.sparrow.xp, 0);
}, { viewport: { width: 320, height: 700 }, touch: true });

browserTest("field companions animate, pause in menus and hidden tabs, and use normal chest and tap rewards", async (page) => {
  await importSave(page, { total: 50000, coins: 100, presses: 7, opened: 5, chests: [chest(2, "grasslands", 1)] });
  await click(page, visibleEntrance("#companions"));
  await click(page, petCard("beetle"));
  await click(page, petAction("field", "0"));
  await click(page, petCard("mouse"));
  await click(page, petAction("field", "1"));
  assert.equal(await page.locator("#fieldPet-0").getAttribute("data-pet-id"), "beetle");
  assert.equal(await page.locator("#fieldPet-1").getAttribute("data-pet-id"), "mouse");
  assert.equal(await page.locator("#fieldPet-0 svg").evaluate(el => getComputedStyle(el).animationName), "pet-wander");
  const assigned = await saved(page);
  await page.clock.runFor(25000);
  assert.deepEqual((await saved(page)).companions, assigned.companions);
  await escape(page);
  await page.evaluate(() => {
    window.testHidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(25000);
  assert.deepEqual((await saved(page)).companions, assigned.companions);
  await page.evaluate(() => {
    window.testHidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(5000);
  assert.equal((await saved(page)).coins, 100);
  await page.reload();
  const restored = await saved(page);
  assert.ok(restored.companions.pets.beetle.cooldown > 2000 && restored.companions.pets.beetle.cooldown < 4000);
  await page.clock.runFor(3250);
  assertAmount((await saved(page)).coins, 100.4);
  assert.equal((await saved(page)).presses, 7);
  assert.equal((await saved(page)).asc.life, 50000.4);
  assert.equal(await page.locator("#fieldPet-0").evaluate(el => el.style.getPropertyValue("--pet-x")), "50%");
  await page.clock.runFor(12000);
  const collected = await saved(page);
  assert.equal(collected.opened, 6);
  assert.equal(collected.items.length, 1);
  assert.equal(collected.shards, 2);
  assert.equal(collected.chests.length, 0);
  assert.equal(collected.presses, 7);
  assert.equal(await page.locator(".chest.opening").count(), 1);
  await click(page, visibleEntrance("#companions"));
  await click(page, petCard("mouse"));
  await click(page, petAction("rest"));
  await escape(page);
  assert.ok(await page.locator("#fieldPet-1").isHidden());
}, {
  viewport: { width: 1280, height: 800 },
  motion: "no-preference",
  init: () => {
    window.testHidden = false;
    Object.defineProperty(document, "hidden", { get: () => window.testHidden });
  },
});

browserTest("train and evolve companions, assist field sites, and retain growth after Ascension", async (page) => {
  const slime = { xp: 160 };
  const mole = { xp: 0 };
  await importSave(page, { total: 50000, coins: 6000, shards: 12, rootFiber: 3,
    sites: { research: { extraPlot: true }, pick: 1, plots: [{ crop: "glowleaf", remaining: 1 }] },
    companions: { pets: { slime, mole }, artifacts: ["bell"] } });
  await click(page, visibleEntrance("#companions"));
  await click(page, petCard("slime"));
  await click(page, petAction("role", "field"));
  await click(page, petAction("evolve"));
  assert.match(await text(page, "#petProfile"), /Level 5 · Evolved/);
  await click(page, petAction("gear", "bell"));
  await click(page, petAction("field", "0"));
  await click(page, petCard("mole"));
  await click(page, petAction("field", "1"));
  await escape(page);
  assert.equal(await page.locator("#fieldPet-0 svg").evaluate(el => getComputedStyle(el).animationName), "none");
  await page.clock.runFor(16500);
  const field = await saved(page);
  assert.equal(field.glowleaf, 3);
  assert.equal(field.copperOre, 4);
  assert.equal(field.rootFiber, 0);
  assert.equal(field.coins, 4500);
  assert.equal(field.sites.plots[0], null);
  assert.equal(field.companions.pets.slime.xp, 162);
  await click(page, visibleEntrance("#skills"));
  await click(page, '[data-tree-tab="ascend"]');
  await click(page, "[data-asc-start]");
  assert.match(await text(page, ".asc-confirm"), /unclaimed expedition rewards/);
  await click(page, "[data-asc-confirm]");
  const next = await saved(page);
  assert.deepEqual(next.companions.field, [null, null]);
  assert.deepEqual(next.companions.trips, [null, null]);
  assert.equal(next.companions.pets.slime.role, "field");
  assert.equal(next.companions.pets.slime.evolved, true);
  assert.equal(next.companions.pets.slime.gear, "bell");
  assert.equal(next.companions.pets.slime.xp, 162);
  await page.reload();
  assert.deepEqual((await saved(page)).companions, next.companions);
});

browserTest("advanced expedition routes offer separate slots and apply specialization and artifact bonuses", async (page) => {
  await importSave(page, { total: 250000, coins: 2000, sites: { pick: 1 },
    companions: { pets: { beetle: { xp: 90, role: "scout", gear: "lens" }, sparrow: { xp: 40, gear: "satchel" } },
      artifacts: ["lens", "satchel"] } });
  await click(page, visibleEntrance("#companions"));
  await click(page, petCard("beetle"));
  assert.match(await text(page, ".pet-route:has([data-pet-arg=star])"), /Star Ruins · 252s/);
  await click(page, petAction("send", "star"));
  await click(page, petCard("sparrow"));
  assert.ok(await page.locator(petAction("gear", "lens")).isDisabled());
  assert.match(await text(page, ".pet-route:has([data-pet-arg=silver])"), /5 Copper Ore/);
  await click(page, petAction("send", "silver"));
  assert.equal(await page.locator(petAction("cancel")).count(), 2);
  await page.clock.fastForward(181000);
  assert.ok(await page.locator(petAction("cancel", "0")).isVisible());
  await click(page, petAction("claim", "1"));
  assert.match(await text(page, "#petMessage"), /5 Copper Ore.*20 XP/);
  await page.clock.fastForward(73000);
  await click(page, petAction("claim", "0"));
  const result = await saved(page);
  assert.equal(result.copperOre, 5);
  assert.equal(result.silverOre, 2);
  assert.equal(result.starCrystals, 2);
  assert.equal(result.prismEssence, 1);
  assert.deepEqual(result.companions.trips, [null, null]);
});

const startBoss = async (page, id) => {
  await click(page, visibleEntrance("#bosses"));
  await click(page, `[data-boss-select="${id}"]`);
  await click(page, `[data-boss-start="${id}"]`);
};

browserTest("combat unlocks from ordinary earnings and a keyboard victory keeps the original button loop", async page => {
  await importSave(page, {total: 4999, coins: 2000, opened: 1, presses: 48, up: {power: 8},
    items: [equipment(0, {value: 7}), equipment(1, {value: 45})], equip: {0: 1, 1: 2},
    sites: {plots: [{crop: "glowleaf", remaining: 10000}]}});
  assert.ok(await page.locator(visibleEntrance("#bosses")).isHidden());
  await click(page, "#press");
  assert.ok(await page.locator(visibleEntrance("#bosses")).isVisible());
  assert.equal((await saved(page)).presses, 49);
  await click(page, visibleEntrance("#bosses"));
  await click(page, "[data-boss-select=bramble]");
  assert.match(await text(page, ".boss-detail"), /20,000.*Mossguard/s);
  assert.ok(await page.locator("[data-boss-start=bramble]").isDisabled());
  await click(page, "[data-boss-select=mossguard]");
  assert.match(await text(page, ".boss-detail"), /Guard Root Slam/);
  assert.match(await text(page, ".boss-loadout"), /base damage/);
  await click(page, "[data-boss-start=mossguard]");
  assert.equal(await page.locator("#bossHp").getAttribute("value"), "340");
  assert.ok(await page.locator("#combatActor .boss-sprite").isVisible());
  assert.ok(await page.locator("#combatGuard").isDisabled());
  const before = await saved(page);
  await page.evaluate(() => { window.testRandom = () => .1; });
  await page.keyboard.press("Space");
  const hit = await saved(page);
  assert.equal(hit.presses, 50);
  assert.equal(hit.wheelNextAt, 50);
  assert.ok(await page.locator("#wheel").isVisible());
  assert.ok(hit.coins > before.coins);
  assert.equal(hit.chests.length, 1);
  assert.ok(hit.sites.plots[0].remaining <= before.sites.plots[0].remaining - 1000);
  assert.ok(hit.combat.attempt.hp < before.combat.attempt.hp);
  assert.ok(await page.locator(".combat-number").count() > 0);
  await page.evaluate(() => { window.testRandom = () => .99; });
  await page.clock.runFor(3350);
  assert.match(await text(page, "#combatTell"), /Root Slam/);
  await page.keyboard.press("g");
  assert.match(await text(page, "#combatTell"), /Guard ready/);
  await page.clock.runFor(2000);
  assert.equal(await text(page, "#playerHpText"), "100 / 100");
  assert.match(await text(page, "#combatStatus"), /Blocked/);
  for (let i = 0; i < 45 && await page.locator("#combatMeters").isVisible(); i++) {
    if (await page.locator("#combatGuard").isEnabled()) await page.keyboard.press("g");
    await page.evaluate(() => document.getElementById("press").click());
    await page.clock.runFor(350);
  }
  assert.match(await text(page, "#combatTell"), /Victory/);
  assert.equal((await saved(page)).combat.clears.mossguard, "unclaimed");
  assert.equal((await saved(page)).combat.records.mossguard.wins, 1);
  assert.ok((await saved(page)).blacksmith.recipes.includes("dragonfire"));
  await click(page, visibleEntrance("#bosses"));
  await click(page, "[data-boss-claim=mossguard]");
  const won = await saved(page);
  const reward = won.items.find(item => item.set === "wardweaver");
  assert.ok(reward.locked);
  assert.equal(won.combat.clears.mossguard, "claimed");
  assert.ok(won.found.includes("set:wardweaver:1:2"));
  await page.locator(".gear-sets summary").click();
  assert.match(await text(page, ".gear-sets"), /Living Acorn.*Best/s);
  await escape(page);
  await click(page, "#inventory");
  assert.match(await text(page, ".item-card:has-text('Wardweaver Ring')"), /Combat defense/);
}, { viewport: { width: 1280, height: 800 }, motion: "no-preference" });

browserTest("mobile Guard, mid-fight refresh, hidden tabs, travel confirmation and reduced motion", async page => {
  await importSave(page, {total: 35000, world: "desert", opened: 2,
    combat: {records: {scarab: {wins: 1, best: 12000}}, clears: {scarab: "claimed"}}});
  await startBoss(page, "jackal");
  assert.ok(await page.locator("#combatPanel").evaluate(el => el.getBoundingClientRect().right <= innerWidth));
  // Combat ticks every 250 ms, with an offset relative to the fight start.
  const waitForWarning = async (warning) => {
    for (let tick = 0; tick < 17 && !warning.test(await text(page, "#combatTell")); tick++)
      await page.clock.runFor(250);
    assert.match(await text(page, "#combatTell"), warning);
  };
  await waitForWarning(/Feint/);
  assert.ok(await page.locator("#combatGuard").isDisabled());
  await waitForWarning(/^Pounce/);
  await page.locator("#combatGuard").tap();
  const armed = (await saved(page)).combat.attempt;
  assert.equal(armed.guarded, true);
  await click(page, "#settings");
  await page.clock.fastForward(9000);
  assert.equal(await text(page, "#playerHpText"), "100 / 100");
  await escape(page);
  await page.evaluate(() => {
    window.testHidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(9000);
  const frozen = (await saved(page)).combat.attempt;
  assert.equal(frozen.guarded, true);
  assert.ok(armed.remaining - frozen.remaining < 700);
  await page.reload();
  assert.equal((await saved(page)).combat.attempt.remaining, frozen.remaining);
  assert.equal((await saved(page)).combat.attempt.guarded, true);
  await page.clock.runFor(frozen.remaining + 300);
  assert.equal(await text(page, "#playerHpText"), "100 / 100");
  await page.evaluate(() => document.getElementById("press").click());
  assert.equal(await page.locator(".combat-number").count(), 0);
  assert.equal(await page.locator("#combatSprite").evaluate(el => getComputedStyle(el).animationName), "none");
  await click(page, visibleEntrance("#worlds"));
  page.once("dialog", async dialog => {
    assert.match(dialog.message(), /end your current boss fight/);
    await dialog.dismiss();
  });
  await click(page, "[data-travel=grasslands]");
  assert.equal((await saved(page)).combat.attempt.id, "jackal");
  page.once("dialog", dialog => dialog.accept());
  await click(page, "[data-travel=grasslands]");
  assert.equal((await saved(page)).combat.attempt, null);
  assert.ok(await page.locator("#combatPanel").isHidden());
}, {
  viewport: { width: 320, height: 700 }, touch: true,
  init: () => {
    window.testHidden = false;
    Object.defineProperty(document, "hidden", { get: () => window.testHidden });
  },
});

browserTest("recover rewards from a full bag, keep boss records on Ascension, and bound rapid damage effects", async page => {
  const items = Array.from({ length: 300 }, (_, i) => equipment(0, {id: i + 1}));
  await importSave(page, {total: 10000, world: "grasslands", opened: 5, items,
    combat: { records: {mossguard: {wins: 1, best: 12000}}, clears: {mossguard: "unclaimed"} }});
  await click(page, visibleEntrance("#bosses"));
  await click(page, "[data-boss-claim=mossguard]");
  assert.match(await text(page, "#bossMessage"), /Free a slot/);
  await page.reload();
  await click(page, "#inventory");
  await click(page, "[data-salvage='300']");
  await escape(page);
  await click(page, visibleEntrance("#bosses"));
  await click(page, "[data-boss-claim=mossguard]");
  assert.equal((await saved(page)).items.at(-1).set, "wardweaver");
  await click(page, "[data-boss-start=mossguard]");
  await page.evaluate(() => {
    for (let i = 0; i < 32; i++) document.getElementById("press").click();
  });
  assert.equal(await page.locator(".combat-number").count(), 8);
  assert.ok((await saved(page)).combat.attempt.hp < 340);
  await click(page, visibleEntrance("#skills"));
  await click(page, '[data-tree-tab="ascend"]');
  await click(page, "[data-asc-start]");
  assert.match(await text(page, ".asc-confirm"), /active boss fight will end/);
  await click(page, "[data-asc-confirm]");
  const next = await saved(page);
  assert.deepEqual(next.combat, {records: {mossguard: {wins: 1, best: 12000}}, clears: {}, attempt: null});
  assert.deepEqual(next.items, []);
}, { motion: "no-preference" });

browserTest("a defeat leaves earnings alone and provides a fresh retry", async page => {
  await importSave(page, {total: 5000, coins: 160, opened: 1});
  await startBoss(page, "mossguard");
  await page.clock.runFor(20500);
  assert.match(await text(page, "#combatTell"), /Defeated/);
  assert.equal((await saved(page)).coins, 160);
  assert.deepEqual((await saved(page)).combat.records, {});
  await click(page, visibleEntrance("#bosses"));
  await click(page, "[data-boss-start=mossguard]");
  assert.equal(await text(page, "#playerHpText"), "100 / 100");
  await click(page, "#combatRetreat");
  assert.ok(await page.locator("#combatPanel").isVisible());
  page.once("dialog", dialog => dialog.accept());
  await click(page, "#combatRetreat");
  assert.equal((await saved(page)).combat.attempt, null);
  assert.ok(await page.locator("#combatPanel").isHidden());
});

const landmark = (id) => '[data-landmark="' + id + '"]';
const fieldFind = (id) => '[data-discovery="' + id + '"]';
const keepsake = (id) => '[data-keepsake="' + id + '"]';

browserTest("Living Field opens quietly and builds a Workshop through fresh play", async (page) => {
  assert.ok(await page.locator("#livingField").isHidden());
  assert.ok(await page.locator(landmark("workshop")).isHidden());
  assert.ok(await page.locator(".living-ambient.tree").first().isVisible());
  const breeze = page.locator(".living-ambient.grass").first();
  assert.equal(await breeze.evaluate(el => getComputedStyle(el).animationName), "field-breeze");
  await fieldPresses(page, 8);
  await click(page, "[data-chest]:not(.opening)");
  await fieldPresses(page, 24 - (await saved(page)).total);
  assert.match(await text(page, "#livingRequirement"), /24 \/ 25 earned/);
  const built = await page.evaluate(() => {
    document.getElementById("press").click();
    return document.querySelector('[data-field-plot="workshop"]').getAnimations().length;
  });
  assert.ok(built > 0);
  await page.locator(landmark("workshop")).focus();
  await page.keyboard.press("Enter");
  assert.equal(await text(page, "#modalTitle"), "Workshop");
  assert.equal(await text(page, "#close"), "Return to field");
  assert.equal(await breeze.evaluate(el => getComputedStyle(el).animationPlayState), "paused");
  await click(page, "#workshopItems [data-buy='0']");
  await escape(page);
  assert.ok(await page.locator(landmark("workshop")).evaluate(el => el === document.activeElement));
  await click(page, fieldFind("stone"));
  assert.ok(await page.locator(keepsake("stone")).isVisible());
  assert.match(await text(page, "#ticker"), /Carved stone/);
  const run = await saved(page);
  assert.deepEqual([run.total, run.scrap, run.up.power], [25, 1, 1]);
  await fieldPresses(page, 1);
  assert.equal((await saved(page)).total, 28);
  await page.evaluate(() => {
    window.testHidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(await breeze.evaluate(el => getComputedStyle(el).animationPlayState), "paused");
}, {
  viewport: { width: 1280, height: 800 }, motion: "no-preference",
  init: () => {
    window.testHidden = false;
    Object.defineProperty(document, "hidden", { get: () => window.testHidden });
  },
});

browserTest("Living Field garden, mine and Forge form a playable mobile route", async (page) => {
  await importSave(page, { total: 599, coins: 1500, opened: 1, scrap: 2 });
  assert.ok(await page.locator(landmark("camp")).isVisible());
  assert.ok(await page.locator(landmark("farm")).isHidden());
  assert.ok(await page.locator(landmark("mine")).isHidden());
  await page.locator(landmark("camp")).tap();
  assert.ok(await page.locator("#petRoster").isVisible());
  await click(page, "#close");
  await fieldPresses(page, 1);
  assert.ok(await page.locator(landmark("grove")).isVisible());
  await page.locator(landmark("farm")).tap();
  assert.equal(await text(page, "#modalTitle"), "Garden");
  assert.ok(await page.locator("#locationArt").isVisible());
  const bed = page.locator("#plot-0 .location-bed");
  assert.equal(await bed.getAttribute("data-growth"), "0");
  await click(page, "#plant-0");
  assert.equal(await bed.getAttribute("data-growth"), "1");
  await page.clock.runFor(12500);
  assert.equal(await bed.getAttribute("data-growth"), "4");
  await click(page, "#harvest-0");
  await escape(page);
  await page.locator(fieldFind("carving")).tap();
  assert.equal((await saved(page)).glowleaf, 4);
  await importSave(page, { ...(await saved(page)), total: 2500 });
  await page.locator(landmark("mine")).tap();
  const vein = page.locator(".mine-vein").filter({ has: page.locator("#mine-copper") }).locator(".location-vein");
  assert.equal(await vein.getAttribute("data-toughness"), "4");
  for (let hit = 0; hit < 3; hit++) await click(page, "#mine-copper");
  assert.equal(await vein.getAttribute("data-toughness"), "0");
  await escape(page);
  await click(page, fieldFind("lantern"));
  await page.locator(landmark("forge")).tap();
  await click(page, "[data-open=recipes]");
  assert.equal(await page.locator("#modal").getAttribute("data-location"), "forge");
  await page.locator("#recipePayment").selectOption("materials");
  await finishWork(page, "#craftGear", 3);
  assert.equal((await saved(page)).items.length, 1);
  await escape(page);
  assert.ok(await page.locator(landmark("forge")).evaluate(el => el === document.activeElement));
  assert.equal(await page.locator(".living-ambient.tree").first().evaluate(el => getComputedStyle(el).animationName), "none");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
}, { viewport: { width: 320, height: 568 }, touch: true });

browserTest("Living Field advanced routes preserve chests, trophies, fight saves and keepsakes", async (page) => {
  const grasslandChests = [25, 75].flatMap((y, row) =>
    [13, 28, 43, 57, 72, 85].map((x, i) => ({ id: 1 + 6 * row + i, x, y, r: 0, level: 1 })));
  await importSave(page, {
    total: 1_000_000, coins: 10_000, presses: 100, opened: 1,
    combat: { records: { bramble: { wins: 1, best: 20000 } }, clears: { bramble: "unclaimed" } },
    chests: [...grasslandChests, chest(13, "desert")],
  });
  await click(page, fieldFind("stone"));
  await click(page, fieldFind("carving"));
  await click(page, fieldFind("lantern"));
  assert.equal(await page.locator("#fieldPennants i:visible").count(), 4);
  assert.ok(await page.getByAltText("Bramble Crown trophy").isVisible());
  const separated = await page.evaluate(() => {
    const board = document.getElementById("board").getBoundingClientRect();
    return document.getElementById("livingField").getBoundingClientRect().top >= board.bottom - 7;
  });
  assert.ok(separated);
  assert.equal(await page.locator("#chests [data-chest]").count(), 12);
  await click(page, landmark("bosses"));
  await click(page, "[data-boss-start=mossguard]");
  await page.reload();
  let run = await saved(page);
  assert.deepEqual(run.fieldDiscoveries, ["stone", "carving", "lantern"]);
  assert.equal(run.combat.attempt.id, "mossguard");
  assert.equal(run.combat.clears.bramble, "unclaimed");
  await click(page, landmark("gate"));
  page.once("dialog", dialog => dialog.dismiss());
  await click(page, "[data-travel=desert]");
  assert.equal((await saved(page)).combat.attempt.id, "mossguard");
  page.once("dialog", dialog => dialog.accept());
  await click(page, "[data-travel=desert]");
  assert.ok(await page.locator("#livingField").isHidden());
  assert.equal(await page.locator("#chests [data-chest]").count(), 1);
  await click(page, "#worldHome");
  assert.equal((await saved(page)).world, "grasslands");
  assert.equal(await page.locator("#chests [data-chest]").count(), 12);
  await click(page, '#chests [data-chest="1"]');
  assert.equal((await saved(page)).chests.length, 12);
  await click(page, landmark("grove"));
  await click(page, "[data-tree-tab=ascend]");
  await click(page, "[data-asc-start]");
  await click(page, "[data-asc-confirm]");
  await escape(page);
  run = await saved(page);
  assert.deepEqual(run.fieldDiscoveries, ["stone", "carving", "lantern"]);
  assert.deepEqual([run.scrap, run.glowleaf, run.copperOre, run.total], [0, 0, 0, 0]);
  assert.ok(await page.locator(keepsake("lantern")).isVisible());
  assert.ok(await page.locator(fieldFind("lantern")).isHidden());
  assert.ok(await page.locator(landmark("gate")).isHidden());
});

const combatSaveBeforeLivingField = JSON.stringify({
  schemaVersion: 5, total: 5000, coins: 2650,
  items: [equipment(0, { forge: 1 })], equip: { 0: 1 },
  combat: { records: { mossguard: { wins: 1, best: 10025 } }, clears: { mossguard: "unclaimed" } },
});
browserTest("Living Field backs up schema 5 and exposes the byte-exact export", async (page) => {
  const run = await saved(page);
  assert.equal(run.schemaVersion, 9);
  assert.equal(run.items[0].forge, 1);
  assert.equal(run.combat.clears.mossguard, "unclaimed");
  assert.equal(await stored(page, livingMigrationKey), combatSaveBeforeLivingField);
  assert.equal(await stored(page, migrationKey), null);
  assert.ok(await page.locator(landmark("bosses")).isVisible());
  assert.equal(await page.locator('[data-field-plot="bosses"]').evaluate(el => el.getAnimations().length), 0);
  await click(page, "#settings");
  await click(page, "#exportPreLivingField");
  assert.equal(await page.locator("#saveText").inputValue(), combatSaveBeforeLivingField);
}, { init: Function("localStorage.setItem(" + JSON.stringify(saveKey) + "," + JSON.stringify(combatSaveBeforeLivingField) + ")") });

browserTest("Living Field leaves a schema 5 save intact when the new backup cannot be written", async (page) => {
  assert.match(await text(page, "#saveStatus"), /Autosave paused/i);
  await fieldPresses(page, 1);
  assert.equal(await stored(page, saveKey), '{"schemaVersion":5,"total":25,"coins":25}');
  assert.equal(await stored(page, livingMigrationKey), null);
}, {
  init: () => {
    localStorage.setItem("treasure-grove-v3", '{"schemaVersion":5,"total":25,"coins":25}');
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "treasure-grove-v3-before-living-field") throw new DOMException("Simulated quota", "QuotaExceededError");
      return set.call(this, key, value);
    };
  },
});

const blacksmithBackup = saveKey + "-before-blacksmith";
const smithEvidence = process.env.BUTTON_FIELD_SMITH_SCREENSHOTS;
async function smithScreenshot(page, name) {
  if (smithEvidence) await page.screenshot({ path: smithEvidence + "/" + name + ".png", animations: "disabled" });
}

browserTest("Blacksmith unlocks from a fresh field and reload discards unfinished work", async (page) => {
  assert.ok(await page.locator(landmark("forge")).isHidden());
  await fieldPresses(page, 8);
  await click(page, "[data-chest]");
  const [gear] = (await saved(page)).items;
  await click(page, "#inventory");
  await click(page, `[data-equip="${gear.id}"]`);
  await escape(page);
  while ((await saved(page)).total < 150) await fieldPresses(page, 1);
  await click(page, landmark("forge"));
  assert.ok(await page.locator("#smithRoom").isVisible());
  await smithScreenshot(page, "01-desktop-first-unlock");
  await click(page, "#smith-rack");
  await click(page, `[data-open-forge="${gear.id}"]`);
  await escape(page);
  for (let i = 0; i < 2; i++) {
    await page.locator("[data-chest]:not([disabled])").first().click();
    const spare = (await saved(page)).items.at(-1);
    await click(page, "#inventory");
    await click(page, `[data-salvage="${spare.id}"]`);
    await escape(page);
  }
  await click(page, landmark("forge"));
  await click(page, "#smith-rack");
  await click(page, `[data-open-forge="${gear.id}"]`);
  const before = await saved(page);
  await click(page, "#forgeBuy");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#smith-anvil").evaluate(el => el === document.activeElement), true);
  await smithScreenshot(page, "02-desktop-timed-strike");
  await page.clock.runFor(900);
  await page.keyboard.press("Enter");
  assert.match(await text(page, "#smithStatus"), /Strike 2 of 2/);
  await click(page, '[data-smith-step="cancel"]');
  assert.deepEqual((await saved(page)).items, before.items);
  await click(page, "#forgeBuy");
  await page.reload();
  assert.deepEqual((await saved(page)).items, before.items);
  assert.equal((await saved(page)).scrap, before.scrap);
  await click(page, "#inventory");
  await click(page, `[data-open-forge="${before.items[0].id}"]`);
  await finishWork(page, "#forgeBuy", 2);
  assert.equal((await saved(page)).items[0].forge, 1);
  assert.equal((await saved(page)).scrap, before.scrap - 2 - gear.r);
  await smithScreenshot(page, "03-desktop-first-temper");
}, { viewport: { width: 1280, height: 800 }, motion: "no-preference" });

browserTest("discovered blueprints craft and trigger mixed gear in the mobile field", async (page) => {
  await importSave(page, {
    total: 5000, coins: 10000, scrap: 100, shards: 100, copperOre: 10, glowleaf: 10,
    companions: { artifacts: ["bell"] },
    items: [
      {...equipment(2, {r: 5}), set: "wildroot"},
      {...equipment(3, {r: 5}), set: "wraithweave"},
    ],
    equip: {2: 3, 3: 4},
    blacksmith: {charge: {sparkforged: 19, wildroot: 14, wraithweave: 23}},
  });
  await click(page, landmark("mine"));
  for (let i = 0; i < 3; i++) await click(page, "#mine-copper");
  assert.match(await text(page, "#siteResult"), /Sparkforged blueprint/);
  await escape(page);
  await page.locator(landmark("forge")).tap();
  await page.locator("#smith-table").tap();
  await page.locator("#recipeSet").selectOption("sparkforged");
  await page.locator("#recipeSlot").selectOption("0");
  await finishWork(page, "#craftGear", 3);
  assert.match(await text(page, "#recipeResult"), /Thunder Gauntlet/);
  assert.equal((await saved(page)).copperOre, 10);
  await smithScreenshot(page, "04-mobile-rare-craft");
  await click(page, "#smith-rack");
  const item = (await saved(page)).items.at(-1);
  await click(page, `[data-equip="${item.id}"]`);
  await escape(page);
  await page.clock.runFor(8000);
  await click(page, "#press");
  for (const mark of ["bolt", "seed", "ghost"]) assert.ok(await page.locator(`[data-signature="${mark}"]`).isVisible());
  await smithScreenshot(page, "05-mobile-signatures");
  const pressRun = await saved(page);
  assert.equal(pressRun.sites.veins.copper.hp, 2);
  assert.equal(pressRun.blacksmith.seeds, 1);
  await page.clock.runFor(1500);
  assert.equal((await saved(page)).presses, pressRun.presses);
  await click(page, landmark("farm"));
  await page.locator("#seed-0").selectOption("magical");
  await click(page, "#plant-0");
  assert.equal((await saved(page)).blacksmith.seeds, 0);
  assert.equal((await saved(page)).sites.plots[0].crop, "glowleaf");
}, { viewport: { width: 390, height: 844 }, touch: true });

browserTest("Blacksmith migration exports untouched schema 6 and evolves legacy gear with the same identity", async (page) => {
  const raw = '{ "schemaVersion": 6, "total": 10000000, "coins": 2000000, "scrap": 220, "shards": 140, "items": [{"id":1,"slot":0,"r":4,"level":1,"value":10,"forge":3,"set":"hammerhand","locked":true}], "equip":{"0":1} }';
  assert.equal(await stored(page, blacksmithBackup), raw);
  assert.equal((await saved(page)).schemaVersion, 9);
  await click(page, "#settings");
  await click(page, "#exportPreBlacksmith");
  assert.equal(await page.locator("#saveText").inputValue(), raw);
  await escape(page);
  await click(page, "#inventory");
  await click(page, '[data-open-forge="1"]');
  await finishWork(page, "#evolveBuy", 4);
  await smithScreenshot(page, "06-mobile-mythic");
  await finishWork(page, "#evolveBuy", 4);
  await smithScreenshot(page, "07-mobile-celestial");
  await page.reload();
  const { items, equip } = await saved(page);
  assert.deepEqual(items[0], { id: 1, slot: 0, r: 6, level: 1, value: 14.4, forge: 3, set: "hammerhand", locked: true });
  assert.equal(equip[0], 1);
}, { init: () => !localStorage.getItem("treasure-grove-v3") && localStorage.setItem("treasure-grove-v3", '{ "schemaVersion": 6, "total": 10000000, "coins": 2000000, "scrap": 220, "shards": 140, "items": [{"id":1,"slot":0,"r":4,"level":1,"value":10,"forge":3,"set":"hammerhand","locked":true}], "equip":{"0":1} }'), touch: true });

browserTest("Blacksmith backup failure preserves schema 6 and stops autosave", async (page) => {
  assert.equal(await stored(page, saveKey), '{"schemaVersion":6,"coins":150,"total":150}');
  await click(page, "#press");
  assert.equal(await stored(page, saveKey), '{"schemaVersion":6,"coins":150,"total":150}');
  assert.match(await text(page, "#saveStatus"), /paused/i);
}, {
  init: () => {
    localStorage.setItem("treasure-grove-v3", '{"schemaVersion":6,"coins":150,"total":150}');
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.endsWith("-before-blacksmith")) throw new Error("quota");
      return set.call(this, key, value);
    };
  },
});

browserTest("a specialized Dragonfire set primes fireballs on entry and after a successful Guard", async (page) => {
  await importSave(page, {
    total: 1e7, coins: 1e6,
    items: [0, 1, 2, 3].map(slot => ({ ...equipment(slot, {r: 6}), set: "dragonfire" })),
    equip: {0: 1, 1: 2, 2: 3, 3: 4},
  });
  await startBoss(page, "mossguard");
  assert.equal((await saved(page)).combat.attempt.fireballReady, true);
  await click(page, "#press");
  assert.ok(await page.locator(".smith-fireball").isVisible());
  assert.equal((await saved(page)).combat.attempt.fireballReady, false);
  await smithScreenshot(page, "08-desktop-dragonfire");
  await page.clock.runFor(3350);
  await page.keyboard.press("g");
  await page.clock.runFor(1900);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  assert.equal((await saved(page)).combat.attempt.fireballReady, true);
  await page.reload();
  assert.equal((await saved(page)).combat.attempt.loadout.dragon.damage, 20);
  await click(page, "#press");
  assert.ok(await page.locator(".smith-fireball").isVisible());
  assert.equal((await saved(page)).combat.attempt.fireballReady, false);
}, { viewport: { width: 1280, height: 800 } });

browserTest("Grasslands landmarks replace duplicate shortcuts and regional fields retain access", async (page) => {
  await importSave(page, { total: 50000, coins: 1000, opened: 1 });
  for (const [shortcut, id] of Object.entries(fieldEntrances)) {
    assert.ok(await page.locator(shortcut).isHidden(), shortcut);
    assert.equal(await page.locator(visibleEntrance(shortcut)).count(), 1, id);
  }
  assert.match(await text(page, "#landmark-farm-status"), /Ready to plant/);
  assert.match(await text(page, "#landmark-mine-status"), /available/);
  await click(page, landmark("gate"));
  await click(page, "[data-travel=desert]");
  for (const [shortcut, id] of Object.entries(fieldEntrances)) {
    assert.ok(await page.locator(landmark(id)).isHidden(), id);
    assert.equal(await page.locator(visibleEntrance(shortcut)).count(), 1, shortcut);
  }
});

browserTest("the forge opens in place when passive earnings reach its unlock", async (page) => {
  await importSave(page, { total: 139, coins: 200, scrap: 10, items: [equipment(2, {value: 4})], equip: {2: 3} });
  await click(page, "#inventory");
  await click(page, '[data-open-forge="3"]');
  assert.ok(await page.locator("#forgeBuy").isDisabled());
  await page.clock.runFor(4000);
  assert.ok(await page.locator("#smithRoom").isVisible());
  await finishWork(page, "#forgeBuy", 2);
  assert.equal((await saved(page)).items[0].forge, 1);
});

browserTest("the timing meter leaves the anvil tappable on a short viewport", async (page) => {
  await importSave(page, { total: 150, coins: 200, scrap: 10, items: [equipment(0)] });
  await click(page, "#inventory");
  await click(page, "[data-open-forge]");
  await click(page, "#forgeBuy");
  await click(page, "#smith-furnace");
  for (let strike = 0; strike < 2; strike++) {
    await page.clock.runFor(900);
    const target = await page.evaluate(() => {
      const anvil = document.querySelector("#smith-anvil");
      const rect = anvil.getBoundingClientRect();
      const meter = document.querySelector("#smithMeter").getBoundingClientRect();
      const x = (rect.left + rect.right) / 2;
      const y = (rect.top + rect.bottom) / 2;
      return {
        x, y, uncovered: anvil.contains(document.elementFromPoint(x, y)),
        meterVisible: meter.top >= 0 && meter.bottom <= innerHeight,
      };
    });
    assert.equal(target.uncovered, true);
    assert.equal(target.meterVisible, true);
    await page.touchscreen.tap(target.x, target.y);
  }
  await click(page, "#smith-quench");
  assert.equal((await saved(page)).items[0].forge, 1);
}, { viewport: { width: 568, height: 320 }, touch: true, motion: "no-preference" });

browserTest("Auto Sell trades eligible chest gear for coins and keeps protected gear", async (page) => {
  await importSave(page, {
    total: 2500, coins: 1000, scrap: 5, opened: 1,
    items: [equipment(0, { value: 50 })], equip: { 0: 1 },
    chests: [{ ...chest(2), x: 17 }, { ...chest(3), x: 17, y: 65 }, { ...chest(4), r: 1, x: 82 }],
    lootRules: { salvage: true },
  });
  await click(page, "#inventory");
  await click(page, "#lootRules summary");
  assert.equal(await page.locator("#lootDisposal").inputValue(), "salvage");
  await page.locator("#lootDisposal").selectOption("sell");
  assert.match(await text(page, "#lootRuleSummary"), /Auto Sell up to Common, duplicates only/);
  await escape(page);
  await page.evaluate(() => window.testRandom = () => 0);
  await click(page, "[data-chest='2']");
  assert.match(await text(page, "#ticker"), /Collected/);
  await click(page, "[data-chest='3']");
  assert.match(await text(page, "#ticker"), /Auto-sold/);
  await click(page, "[data-chest='4']");
  assert.match(await text(page, "#ticker"), /Collected/);
  await page.reload();
  const run = await saved(page);
  assert.equal(run.lootRules.sell, true);
  assert.equal(run.lootRules.salvage, false);
  assert.equal(run.coins, 1003);
  assert.equal(run.scrap, 5);
  assert.equal(run.items.length, 3);
  assert.equal(run.equip[0], 1);
}, { touch: true });

const meadowScreenshots = process.env.BUTTON_FIELD_MEADOW_SCREENSHOTS;
async function meadowScreenshot(page, name) {
  if (meadowScreenshots) await page.screenshot({ path: meadowScreenshots + "/" + name + ".png", animations: "disabled" });
}

async function openMeadowbrook(page) {
  await click(page, visibleEntrance("#farm"));
  await click(page, '[data-open="meadowbrook"]');
  assert.match(await text(page, "#modalTitle"), /Meadowbrook Farm/);
}

async function meadowTile(page, column, row, touch = false) {
  const position = await page.locator("#meadowCanvas").evaluate((canvas, [x, y]) => {
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + rect.width * (x + 0.5) / 32, y: rect.top + rect.height * (y + 0.5) / 20 };
  }, [column, row]);
  if (touch) await page.touchscreen.tap(position.x, position.y);
  else await page.mouse.click(position.x, position.y);
  await page.clock.runFor(1600);
}

browserTest("Meadowbrook unlocks through the Garden and sells a fresh harvest into the field wallet", async (page) => {
  assert.ok(await page.locator(visibleEntrance("#farm")).isHidden());
  const quickPresses = (count) => page.evaluate((presses) => {
    for (let i = 0; i < presses; i++) document.getElementById("press").click();
  }, count);
  await quickPresses(25);
  await page.clock.runFor(500);
  await click(page, landmark("workshop"));
  await click(page, "#workshopItems [data-buy='0']");
  await escape(page);
  await quickPresses(14);
  await page.clock.runFor(500);
  await click(page, landmark("workshop"));
  await click(page, "#workshopItems [data-buy='0']");
  await escape(page);
  await quickPresses(106);
  assert.ok(await page.locator(visibleEntrance("#farm")).isHidden());
  await quickPresses(1);
  await page.clock.runFor(500);
  const freshRun = await saved(page);
  await openMeadowbrook(page);
  await meadowScreenshot(page, "01-desktop-arrival");
  for (const x of [11, 12, 13]) await meadowTile(page, x, 10);
  assert.match(await text(page, "#meadowGoal"), /Fresh beginnings/);
  let run = await saved(page);
  assert.deepEqual([run.coins, run.total, run.meadowbrook.bag.turnip, run.meadowbrook.energy], [freshRun.coins + 45, freshRun.total + 45, 3, 97]);
  await click(page, "#meadowSell");
  assert.match(await text(page, "#meadowNotice"), /Sold 3 crops for 60 coins/);
  await meadowScreenshot(page, "02-desktop-new-goal");
  await escape(page);
  assert.ok(await page.locator(landmark("farm")).evaluate(el => el === document.activeElement));
  assert.equal(await text(page, "#coins"), String(freshRun.coins + 105));
  await page.reload();
  await openMeadowbrook(page);
  run = await saved(page);
  assert.equal(run.meadowbrook.quest, 1);
  assert.equal(run.meadowbrook.bag.turnip, 0);
  assert.equal(run.meadowbrook.plots["11,10"].crop, null);
  assert.equal(run.coins, freshRun.coins + 105);
}, { viewport: { width: 1280, height: 800 }, motion: "no-preference" });

browserTest("Meadowbrook touch map, keyboard tools, shop, rest and farm save migration", async (page) => {
  const backup = await stored(page, saveKey + "-before-meadowbrook");
  assert.equal(backup, '{"schemaVersion":7,"total":2500,"coins":600,"sites":{"plots":[{"crop":"glowleaf","remaining":8000}]}}');
  assert.equal((await saved(page)).sites.plots[0].crop, "glowleaf");
  await openMeadowbrook(page);
  await meadowScreenshot(page, "03-mobile-arrival");
  await meadowTile(page, 11, 10, true);
  assert.equal((await saved(page)).meadowbrook.bag.turnip, 1);
  await page.locator("#meadowCanvas").focus();
  await page.keyboard.press("2");
  assert.equal(await page.locator('[data-meadow-tool="1"]').getAttribute("aria-pressed"), "true");
  await page.locator("#meadowCanvas").evaluate(el => el.scrollIntoView({ block: "center" }));
  await meadowTile(page, 10, 11, true);
  assert.equal((await saved(page)).meadowbrook.plots["10,11"].tilled, true);
  await page.locator("#meadowSeed").selectOption("turnip");
  await page.locator("#meadowCanvas").evaluate(el => el.scrollIntoView({ block: "center" }));
  await meadowTile(page, 10, 11, true);
  assert.equal((await saved(page)).meadowbrook.plots["10,11"].crop, "turnip");
  await page.locator("#meadowCanvas").focus();
  await page.keyboard.press("4");
  await meadowTile(page, 10, 11, true);
  assert.equal((await saved(page)).meadowbrook.plots["10,11"].water, true);

  await page.locator('[data-meadow-target="home"]').tap();
  await page.clock.runFor(4500);
  await click(page, "[data-meadow-sleep]");
  let run = await saved(page);
  assert.equal(run.meadowbrook.day, 2);
  assert.equal(run.meadowbrook.energy, 100);
  assert.equal(run.meadowbrook.plots["10,11"].growth, 1);

  await page.locator('[data-meadow-target="shop"]').tap();
  await page.clock.runFor(6400);
  await click(page, '[data-meadow-buy="pumpkin"][data-quantity="1"]');
  run = await saved(page);
  assert.equal(run.meadowbrook.seeds.pumpkin, 1);
  assert.equal(run.coins, 560);
  assert.equal(run.total, 2500);
  await meadowScreenshot(page, "04-mobile-seed-shop");
  await escape(page);
  assert.ok(await page.locator("#meadowCanvas").isVisible());
  assert.ok(await page.locator("#meadowService").isHidden());
  await escape(page);
  await page.clock.runFor(10000);
  assert.equal((await saved(page)).meadowbrook.time, run.meadowbrook.time);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
}, {
  touch: true,
  init: () => localStorage.setItem("treasure-grove-v3", '{"schemaVersion":7,"total":2500,"coins":600,"sites":{"plots":[{"crop":"glowleaf","remaining":8000}]}}'),
});

browserTest("Meadowbrook's developed farm harvests pumpkins and keeps its progress across fields", async (page) => {
  await importSave(page, {
    total: 50000, coins: 450, opened: 1, world: "desert",
    meadowbrook: {
      day: 115, time: 840, energy: 36, weather: "Rainy",
      player: { x: 10.5, y: 10.5 }, seeds: { turnip: 0, carrot: 2, strawberry: 5, pumpkin: 3 },
      plots: { "11,10": { crop: "pumpkin", growth: 5, water: true }, "12,10": { crop: "strawberry", growth: 3, water: true } },
      quest: 4, progress: { harvest: 30, plant: 32, sold: 29, earned: 940 },
    },
  });
  await openMeadowbrook(page);
  assert.match(await text(page, "#meadowDay"), /Day 115 · Spring/);
  assert.equal(await text(page, "#meadowWeather"), "Rainy");
  await meadowScreenshot(page, "05-desktop-developed-farm");
  await meadowTile(page, 11, 10);
  await click(page, "#meadowSell");
  const run = await saved(page);
  assert.equal(run.meadowbrook.quest, 5);
  assert.equal(run.coins, 970);
  assert.equal(run.total, 50520);
  await escape(page);
  await click(page, "#worldHome");
  await openMeadowbrook(page);
  assert.equal(await text(page, "#meadowGoal"), "Meadowbrook master");
  assert.equal((await saved(page)).meadowbrook.day, 115);
}, { viewport: { width: 1280, height: 800 } });

const hollowScreenshots = process.env.BUTTON_FIELD_HOLLOW_SCREENSHOTS;
async function hollowScreenshot(page, name) {
  if (hollowScreenshots) await page.screenshot({ path: hollowScreenshots + "/" + name + ".png", animations: "disabled" });
}
async function openHollow(page) {
  await click(page, visibleEntrance("#mine"));
  await click(page, '[data-open="deep-hollow"]');
  assert.equal(await text(page, "#modalTitle"), "Deep Hollow");
}

browserTest("Deep Hollow unlocks from the red button and banks crafting copper from a fresh shaft", async (page) => {
  const quickPresses = (count) => page.evaluate((presses) => {
    for (let i = 0; i < presses; i++) document.getElementById("press").click();
  }, count);
  const reinforce = async (count = 1) => {
    await page.clock.runFor(450);
    await click(page, landmark("workshop"));
    for (let i = 0; i < count; i++) await click(page, "#workshopItems [data-buy='0']");
    await escape(page);
  };
  await quickPresses(25);
  await reinforce();
  await quickPresses(14);
  await reinforce();
  await quickPresses(40);
  await reinforce(2);
  const run = await saved(page);
  const beforeGate = Math.ceil((2500 - run.total) / Number(await text(page, "#tapValue"))) - 1;
  await quickPresses(beforeGate);
  assert.ok(await page.locator(visibleEntrance("#mine")).isHidden());
  await quickPresses(1);
  await page.clock.runFor(500);
  await openHollow(page);
  await hollowScreenshot(page, "01-desktop-camp");
  await page.locator("#hollowCanvas").focus();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("ArrowDown");
    await page.clock.runFor(i < 4 ? 200 : 720);
  }
  assert.match(await text(page, "#hollowZone"), /Copper Ridge/);
  assert.equal(await text(page, '[data-hollow-ore="3"]'), "1");
  assert.equal(await text(page, "#hollowDepth"), "Depth 5 m");
  assert.ok(await page.locator("#hollowTradeAction").isDisabled());
  await hollowScreenshot(page, "02-desktop-copper-ridge");
  await page.keyboard.press("r");
  await page.locator("#hollowTrade").selectOption("bank");
  await click(page, "#hollowTradeAction");
  assert.match(await text(page, "#hollowNotice"), /Banked 1 Copper Ore/);
  await escape(page);
  assert.ok(await page.locator(landmark("mine")).evaluate(el => el === document.activeElement));
  await click(page, visibleEntrance("#mine"));
  assert.match(await text(page, "#mineWallet"), /1 Copper Ore/);
  await escape(page);
  await page.reload();
  await openHollow(page);
  await click(page, "#hollowLift");
  assert.equal(await text(page, "#hollowDepth"), "Depth 5 m");
  assert.equal((await saved(page)).deepHollow.cleared.length, 1);
}, { viewport: { width: 1280, height: 800 }, motion: "no-preference" });

browserTest("Deep Hollow uses touch digging, shared coins, contracts, and existing saves in the late mine", async (page) => {
  const original = '{"schemaVersion":8,"total":50000,"coins":800,"copperOre":8,"meadowbrook":{"day":3}}';
  assert.equal(await stored(page, saveKey + "-before-deep-hollow"), original);
  assert.equal((await saved(page)).meadowbrook.day, 3);
  await importSave(page, {
    ...(await saved(page)), world: "desert",
    deepHollow: { seed: 6, deep: { x: 26, y: 97 }, cleared: [97 * 52 + 26],
      pick: 4, bag: 1, lamp: 3, goal: 6, inv: [0, 0, 0, 0, 0, 14] },
  });
  await openHollow(page);
  await page.locator("#hollowLift").tap();
  assert.equal(await text(page, "#hollowDepth"), "Depth 93 m");
  assert.match(await text(page, "#hollowZone"), /The Deep Core/);
  await hollowScreenshot(page, "03-mobile-deep-core");
  await page.locator('[data-hollow-direction="down"]').tap();
  await page.clock.runFor(1100);
  assert.equal(await text(page, "#hollowDepth"), "Depth 94 m");
  assert.equal(await text(page, '[data-hollow-ore="8"]'), "15");
  assert.match(await text(page, "#hollowNotice"), /Contract rewards \+1800 coins/);
  assert.ok(await page.locator('[data-hollow-upgrade="lamp"]').isDisabled());
  await page.locator("#hollowLift").tap();
  await page.locator("#hollowTradeAction").tap();
  const haul = await saved(page);
  assert.equal(haul.coins, 6750);
  assert.equal(haul.total, 55950);
  assert.equal(haul.deepHollow.goal, 8);
  await page.locator('[data-hollow-upgrade="lamp"]').tap();
  const upgraded = await saved(page);
  assert.equal(upgraded.coins, 5950);
  assert.equal(upgraded.total, haul.total);
  assert.equal(upgraded.deepHollow.lamp, 4);
  await hollowScreenshot(page, "04-mobile-sale");
  await escape(page);
  await page.reload();
  await openHollow(page);
  await page.locator("#hollowLift").tap();
  assert.equal(await text(page, "#hollowDepth"), "Depth 94 m");
  assert.equal(await text(page, "#hollowGoal"), "Legend of the Hollow");
  assert.equal((await saved(page)).copperOre, 8);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
}, {
  touch: true,
  init: () => {
    if (!localStorage.getItem("treasure-grove-v3")) localStorage.setItem("treasure-grove-v3", '{"schemaVersion":8,"total":50000,"coins":800,"copperOre":8,"meadowbrook":{"day":3}}');
  },
});
