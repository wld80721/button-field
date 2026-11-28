import { bosses } from "./boss-data.js";
import { milestones } from "./data.js";
import { discoveries } from "./field-discoveries.js";
import { fieldSprite, pixelSprite } from "./field-art.js";
import { fmtExact } from "./numbers.js";
import { hasRunCoins, progressionAccess } from "./progression.js";
import { $, setText, setValue } from "./ui-dom.js";
import { firstWorld, worlds } from "./world-data.js";

const landmarks = {
  workshop: { name: "Workshop", at: milestones.workshop, screens: ["upgrades"], art: "workbench", find: "stone", cover: "rock" },
  forge: { name: "Forge", at: milestones.forge, screens: ["blacksmith", "inventory", "forge", "recipes"], art: "anvil" },
  camp: { name: "Companion camp", at: milestones.companions, screens: ["companions"] },
  farm: { name: "Garden", at: milestones.shards, screens: ["farm", "meadowbrook"], find: "carving", cover: "stump", art: "crop" },
  grove: { name: "Skill grove", at: milestones.shards, screens: ["skills"] },
  mine: { name: "Mine", at: milestones.helper, screens: ["mine"], find: "lantern", cover: "rock", art: "vein" },
  bosses: { name: "Boss Board", at: milestones.combat, screens: ["bosses"] },
  gate: { name: "Trade gate", at: worlds.desert.at, screens: ["worlds"] },
};

const regionalRoutes = Object.entries(worlds).filter(([id]) => id !== firstWorld);
const fieldPlots = Object.entries(landmarks);
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let previousRun;
let previousWorld;
let previousTotal = 0;
let previousLandmarks = new Set();
let trophyKey;

function landmarkOpen(run, id, landmark) {
  return id === "grove" ? progressionAccess(run).skills : hasRunCoins(run, landmark.at);
}

function landmarkMarkup([id, { name, find, cover }]) {
  const secret = find
    ? '<button class="living-find" data-discovery="' + find + '" aria-label="' + discoveries[find].clue + '">' +
        fieldSprite(cover) + '</button><span class="living-keepsake" data-keepsake="' + find +
        '" title="' + discoveries[find].name + '" hidden>' + fieldSprite(find) + '</span>'
    : "";
  const status = id === "farm" || id === "mine" ? '<small id="landmark-' + id + '-status"></small>' : "";
  return '<div class="living-plot" data-field-plot="' + id + '" hidden>' +
    '<button class="living-landmark" data-landmark="' + id + '">' +
      fieldSprite(id) + '<span>' + name + status + '</span></button>' + secret +
    (id === "camp" ? '<span id="fieldExpeditionKit" aria-hidden="true" hidden>' + fieldSprite("lantern") + '</span>' : "") +
    (id === "bosses" ? '<span id="fieldTrophies" hidden></span>' : "") +
    (id === "gate" ? '<span id="fieldPennants" aria-hidden="true"></span>' : "") +
    '</div>';
}

function initLivingField() {
  const ambient = [
    ["tree", 7, 19, 130], ["oak", 91, 17, 155], ["tree", 4, 76, 111],
    ["tree", 94, 76, 138], ["grass", 17, 22, 61], ["grass", 72, 22, 75],
    ["grass", 12, 72, 82], ["grass", 82, 70, 64], ["flowers", 22, 79, 90],
    ["flowers", 82, 83, 93], ["flowers", 12, 55, 65, 2], ["flowers", 92, 53, 71, 2],
    ["oak", 28, 15, 105, 3], ["tree", 75, 14, 115, 3],
    ["flowers", 11, 86, 65, 3], ["flowers", 94, 41, 74, 3],
    ["bird", 83, 24, 48, 3],
    ["butterfly", 23, 71, 36, 1], ["butterfly", 78, 30, 41, 2],
  ];
  $("livingAmbient").innerHTML = ambient.map(([sprite, x, y, size, stage = 0], index) =>
    '<span class="living-ambient ' + sprite + '" data-growth="' + stage +
    '" style="--x:' + x + '%;--y:' + y + '%;--size:' + size + 'px;--phase:' +
    (-0.7 * (index % 6)) + 's">' + fieldSprite(sprite) + '</span>'
  ).join("") + [
    [15, 41], [23, 68], [74, 21], [89, 74], [33, 73], [64, 28],
  ].map(([x, y], i) =>
    '<i class="living-pollen" data-growth="1" style="--x:' + x + '%;--y:' + y +
    '%;--phase:' + (-1.3 * i) + 's"></i>'
  ).join("") + '<span class="living-path-mouth" aria-hidden="true"></span>';
  $("livingLandmarks").innerHTML = fieldPlots.map(landmarkMarkup).join("");
  $("livingField").style.setProperty("--trail-flowers", 'url("' + pixelSprite("flowers") + '")');
  $("worldHome").innerHTML = fieldSprite("gate") + "<span>Return to Grasslands</span>";
  $("fieldPennants").innerHTML = regionalRoutes.map(([id, world]) =>
    '<i data-pennant="' + id + '" style="--pennant:' + world.accent + '" hidden></i>'
  ).join("");
}

function renderFieldTrophies(run) {
  const earned = Object.keys(bosses).filter((id) => run.combat.records[id]);
  const key = earned.join(",");
  if (key === trophyKey) return;
  trophyKey = key;
  const display = $("fieldTrophies");
  display.hidden = earned.length === 0;
  display.innerHTML = earned.map((id) =>
    '<img class="living-sprite" alt="' + bosses[id].name + ' trophy" title="' +
      bosses[id].name + ' trophy" src="' + pixelSprite("trophy") + '">'
  ).join("");
}

function animateConstruction(nodes) {
  if (reducedMotion() || document.hidden || !$("modal").hidden) return;
  nodes.forEach((node, index) => node.animate([
    { filter: "brightness(1.55)", transform: "translateY(7px)", opacity: 0.48 },
    { filter: "brightness(1)", transform: "translateY(0)", opacity: 1 },
  ], { duration: 440, delay: index * 100, easing: "steps(7, end)", fill: "backwards" }));
}

function renderLivingField(run) {
  const home = run.world === firstWorld;
  const enabled = new Set(fieldPlots.filter(([id, landmark]) => landmarkOpen(run, id, landmark)).map(([id]) => id));
  const trailVisible = run.total > 0 || enabled.size > 0 || run.fieldDiscoveries.length > 0;
  setValue($("livingAmbient"), "hidden", !home);
  setValue($("livingField"), "hidden", !home || !trailVisible);
  setValue($("worldHome"), "hidden", home);
  setValue($("board").dataset, "livingTrail", String(home && trailVisible));
  if ($("modal").dataset.location === "forge") {
    const ready = hasRunCoins(run, milestones.helper);
    setValue($("modal").dataset, "recipesReady", String(ready));
  }

  const live = home && previousRun === run && previousWorld === run.world && previousTotal < run.total;
  previousRun = run;
  previousWorld = run.world;
  previousTotal = run.total;
  if (!home) return;
  const growth = run.total >= milestones.combat ? 3 : run.total >= milestones.shards ? 2 : enabled.size ? 1 : 0;
  setValue($("livingAmbient").dataset, "stage", String(growth));
  setValue($("livingField").dataset, "stage", String(growth));
  const built = [];
  for (const [id, { find }] of fieldPlots) {
    const plot = $("livingLandmarks").querySelector('[data-field-plot="' + id + '"]');
    const collected = Boolean(find && run.fieldDiscoveries.includes(find));
    setValue(plot, "hidden", !enabled.has(id) && !collected);
    setValue(plot.firstElementChild, "hidden", !enabled.has(id));
    if (find) {
      setValue(plot.querySelector("[data-discovery]"), "hidden", collected || !enabled.has(id));
      setValue(plot.querySelector("[data-keepsake]"), "hidden", !collected);
    }
    if (live && enabled.has(id) && !previousLandmarks.has(id)) built.push(plot);
  }
  animateConstruction(built);
  previousLandmarks = enabled;
  renderFieldTrophies(run);
  setValue($("fieldExpeditionKit"), "hidden", !hasRunCoins(run, milestones.expeditions));
  for (const [id, world] of regionalRoutes) {
    setValue($("fieldPennants").querySelector('[data-pennant="' + id + '"]'), "hidden", !hasRunCoins(run, world.at));
  }

  const nextLandmark = fieldPlots.find(([id]) => !enabled.has(id))?.[1];
  const nextWorld = regionalRoutes.find(([, world]) => !hasRunCoins(run, world.at))?.[1];
  const next = nextLandmark ?? nextWorld;
  const previousGate = next && Math.max(0, ...fieldPlots.map(([, place]) => place.at)
    .concat(regionalRoutes.map(([, world]) => world.at)).filter((at) => at < next.at));
  const pavers = next ? Math.floor(8 * (run.total - previousGate) / (next.at - previousGate)) : 8;
  setValue($("livingTrail").dataset, "pavers", String(pavers));
  setValue($("livingTrail"), "hidden", !next);
  if (next) {
    setText($("livingNext"), next.name);
    setText($("livingRequirement"), fmtExact(Math.floor(run.total)) + " / " + fmtExact(next.at) + " earned");
  }
}

function fieldLocationFor(run, id, type) {
  const landmark = Object.hasOwn(landmarks, id) && landmarks[id];
  if ((run.world !== firstWorld && id !== "forge") || !landmark || !landmarkOpen(run, id, landmark) ||
      (type && !landmark.screens.includes(type))) return null;
  return landmark;
}

function renderLocationScene(run, id, entering) {
  const modal = $("modal");
  const backdrop = $("locationArt");
  setValue(modal.dataset, "location", id);
  setValue(modal.dataset, "recipesReady", String(hasRunCoins(run, milestones.helper)));
  backdrop.hidden = !id || id === "forge";
  if (!id || id === "forge") return;
  if (backdrop.dataset.location !== id) {
    backdrop.dataset.location = id;
    const fixtures = landmarks[id].art;
    backdrop.innerHTML = fixtures
      ? fieldSprite(fixtures) + fieldSprite(id) + fieldSprite(fixtures)
      : fieldSprite("tree") + fieldSprite(id) + fieldSprite("flowers");
  }
  if (entering && !reducedMotion()) {
    modal.querySelector(".window").animate([
      { opacity: 0.2, transform: "translateY(9px)" },
      { opacity: 1, transform: "translateY(0)" },
    ], { duration: 230, easing: "ease-out" });
  }
}

function playFieldReturn() {
  if (reducedMotion()) return;
  $("board").animate([{ opacity: 0.75 }, { opacity: 1 }], {
    duration: 230, easing: "ease-out",
  });
}

function playDiscovery(keepsake, found) {
  const result = document.createElement("span");
  result.className = "living-discovery-result";
  result.setAttribute("aria-hidden", "true");
  keepsake.append(result);
  const message = found.name + " · +" + found.reward;
  setText($("fieldDiscoveryStatus"), message);
  setText(result, message);
  setTimeout(() => result.remove(), 3000);
  if (reducedMotion()) return;
  keepsake.animate([
    { filter: "brightness(2)", transform: "translateY(5px)" },
    { filter: "brightness(1)", transform: "translateY(0)" },
  ], { duration: 440, easing: "steps(6, end)" });
}

export { fieldLocationFor, initLivingField, playDiscovery, playFieldReturn, renderLivingField, renderLocationScene };
