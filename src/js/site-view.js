import { fmtExact } from "./numbers.js";
import { fieldSprite } from "./field-art.js";
import { runtime } from "./runtime.js";
import {
  buyMiner,
  buyPick,
  buyResearch,
  canPlant,
  crops,
  depositAccess,
  deposits,
  farmAt,
  harvest,
  hasMaterials,
  materials,
  mine,
  mineAt,
  minerUpgrade,
  plant,
  plotCount,
  research,
  setHarvestMode,
  setMiningMode,
  tools,
} from "./sites.js";
import { s } from "./state.js";
import { $, setText, setValue } from "./ui-dom.js";

const seconds = (ms) => Math.ceil(ms / 1000) + "s";
const costText = (cost) =>
  Object.entries(cost)
    .map(([id, amount]) => fmtExact(amount) + " " + (materials[id] || id))
    .join(" + ");
const rewardText = (rewards) =>
  rewards
    .map(({ amount, material }) => "+" + amount + " " + materials[material])
    .join(" · ");

function wallet(ids) {
  return [
    fmtExact(s.coins) + " coins",
    ...ids.map((id) => fmtExact(s[id]) + " " + materials[id]),
  ].join(" · ");
}

function farmMarkup() {
  const cropOptions = Object.entries(crops)
    .map(([id, crop]) => `<option value="${id}">${crop.name}</option>`)
    .join("");
  const plots = s.sites.plots
    .map(
      (_, index) => `<article class="up-card site-plot" id="plot-${index}">
    ${runtime.fieldLocation === "farm" ? '<div class="location-bed" aria-hidden="true">' + fieldSprite("crop") + "</div>" : ""}
    <h3>Plot ${index + 1}</h3><p id="plotStatus-${index}"></p>
    <div class="site-controls" id="plantControls-${index}">
      <select id="seed-${index}" data-seed-choice aria-label="Seed for plot ${index + 1}">${cropOptions}<option value="magical">Magical seed</option></select>
      <button class="action gold" data-site-action="plant" data-plot="${index}" id="plant-${index}">Plant</button>
    </div><p id="seedInfo-${index}"></p>
    <button class="action gold" data-site-action="harvest" data-plot="${index}" id="harvest-${index}">Harvest</button>
    </article>`,
    )
    .join("");
  return `<p class="subtext">Grow crops while the game is visible. Red-button presses speed them up.</p>
    <p id="farmWallet" class="site-wallet"></p>
    <div class="item-grid">${plots}</div>
    <h3>Research</h3><div class="site-upgrades">${Object.entries(research)
      .map(
        ([id, def]) =>
          `<div class="up-card"><strong>${def.name}</strong><p>${def.effect}</p>
      <button class="action secondary" data-site-action="research" data-site-id="${id}" id="research-${id}"></button></div>`,
      )
      .join("")}</div>
    <label id="harvestMode"><input type="checkbox" id="autoHarvest"> Auto Harvest ripe crops</label>
    <p id="farmCharge" class="subtext"></p><p class="subtext site-result" id="siteResult" role="status"></p>`;
}

function mineMarkup() {
  return `<p class="subtext">Chip a deposit to gather materials. Red-button presses speed up recovery.</p>
    <p id="mineWallet" class="site-wallet"></p><p id="pickStatus"></p>
    <div class="item-grid">${Object.entries(deposits)
      .map(
        ([
          id,
          def,
        ]) => `<article class="up-card mine-vein" style="--ore:${def.color}">
      <h3>${def.name}</h3><p>${def.rarity} · ${def.yield} ${materials[def.material]} per clear</p><p id="vein-${id}"></p>
      ${runtime.fieldLocation === "mine" ? '<div class="location-vein" aria-hidden="true">' + fieldSprite("vein") + "</div>" : ""}
      <button class="action gold" data-site-action="mine" data-site-id="${id}" id="mine-${id}">Mine</button></article>`,
      )
      .join("")}</div>
    <h3>Mining upgrades</h3><div class="site-upgrades">
    <div class="up-card"><strong>Pick upgrade</strong><p id="pickUpgradeInfo"></p>
      <button class="action secondary" data-site-action="pick" id="buyPick"></button></div>
    <div class="up-card"><strong>Auto Mining</strong><p>Automatically swings at one available deposit every three visible seconds.</p>
      <button class="action secondary" data-site-action="miner" id="buyMiner"></button>
      <div class="site-controls" id="minerControls">
        <label><input type="checkbox" id="autoMine"> Enabled</label>
        <label>Target <select id="mineTarget">${Object.entries(deposits)
          .map(([id, def]) => `<option value="${id}">${def.name}</option>`)
          .join("")}</select></label>
      </div><p id="minerStatus"></p></div></div>
    <p class="subtext site-result" id="siteResult" role="status"></p>`;
}

function offer(button, at, cost, owned, extra = true) {
  setValue(
    button,
    "disabled",
    owned || s.total < at || !extra || !hasMaterials(s, cost),
  );
  setText(
    button,
    owned
      ? "Purchased"
      : s.total < at
        ? "Unlocks at " + fmtExact(at) + " earned"
        : !extra
          ? "Requires Copper Pick"
          : "Buy · " + costText(cost),
  );
}

function updateFarm() {
  const site = s.sites;
  setText(
    $("farmWallet"),
    wallet([
      "glowleaf",
      "rootFiber",
      "prismEssence",
      "copperOre",
      "silverOre",
      "starCrystals",
    ]),
  );
  setText($("farmCharge"), "Glowleaf presses · " + site.growthCharges + " / 3");
  for (let index = 0; index < site.plots.length; index++) {
    setValue($("plot-" + index), "hidden", index >= plotCount(s));
    const plot = site.plots[index];
    if (runtime.fieldLocation === "farm") {
      const visual = $("plot-" + index).querySelector(".location-bed");
      const duration = plot && (crops[plot.crop].ms - (site.research.irrigation ? 3000 : 0));
      const growth = plot ? Math.max(1, 4 - Math.ceil(4 * plot.remaining / duration)) : 0;
      setValue(visual.dataset, "growth", String(growth));
      setValue(visual.dataset, "crop", plot?.crop ?? "");
    }
    const select = $("seed-" + index);
    for (const option of select.options) {
      const magical = option.value === "magical";
      const locked = magical ? s.blacksmith.seeds === 0 : s.total < crops[option.value].at;
      if (magical) setText(option, "Magical seed · " + s.blacksmith.seeds + " in stock");
      setValue(option, "hidden", locked);
      setValue(option, "disabled", locked);
    }
    const def = crops[select.value] || crops.glowleaf;
    const status = plot
      ? crops[plot.crop].name +
        (plot.remaining ? " · " + seconds(plot.remaining) : " · Ripe")
      : "Empty soil";
    setText($("plotStatus-" + index), status);
    setValue($("plantControls-" + index), "hidden", Boolean(plot));
    setValue($("seedInfo-" + index), "hidden", Boolean(plot));
    setText(
      $("seedInfo-" + index),
      seconds(def.ms - (site.research.irrigation ? 3000 : 0)) +
        " · " +
        def.yield +
        " " +
        materials[def.material] +
        " · " +
        def.effect,
    );
    setText($("plant-" + index), select.value === "magical" ? "Plant magical seed" : "Plant · " + costText(def.cost));
    setValue(
      $("plant-" + index),
      "disabled",
      !canPlant(s, index, select.value),
    );
    setValue($("harvest-" + index), "hidden", !plot || plot.remaining > 0);
  }
  for (const [id, def] of Object.entries(research))
    offer($("research-" + id), def.at, def.cost, site.research[id]);
  setValue($("harvestMode"), "hidden", !site.research.harvester);
  setValue($("autoHarvest"), "checked", site.autoHarvest);
}

function updateMine() {
  const site = s.sites;
  const pick = tools[site.pick];
  const next = tools[site.pick + 1];
  setText(
    $("mineWallet"),
    wallet(["copperOre", "silverOre", "starCrystals", "glowleaf", "rootFiber"]),
  );
  setText($("pickStatus"), pick.name + " · " + pick.damage + " damage per hit");
  setText(
    $("pickUpgradeInfo"),
    next
      ? next.name + " · " + next.damage + " damage per hit"
      : "Best pick equipped.",
  );
  offer($("buyPick"), mineAt, next?.cost || {}, !next);
  offer(
    $("buyMiner"),
    minerUpgrade.at,
    minerUpgrade.cost,
    site.minerOwned,
    site.pick >= 1,
  );
  for (const [id, def] of Object.entries(deposits)) {
    const vein = site.veins[id];
    const accessible = depositAccess(s, id);
    const status = accessible
      ? vein.remaining > 0
        ? "Recovering · " + seconds(vein.remaining)
        : "Available · " + vein.hp + " / " + def.hp + " toughness"
      : s.total < def.at
        ? "Unlocks at " + fmtExact(def.at) + " earned"
        : "Requires Copper Pick";
    setText($("vein-" + id), status);
    if (runtime.fieldLocation === "mine") {
      const visual = $("vein-" + id).closest(".mine-vein").querySelector(".location-vein");
      const toughness = !accessible || vein.remaining ? 0 : Math.ceil(4 * vein.hp / def.hp);
      setValue(visual.dataset, "toughness", String(toughness));
    }
    setValue($("mine-" + id), "disabled", !accessible || vein.remaining > 0);
  }
  setValue($("minerControls"), "hidden", !site.minerOwned);
  setValue($("autoMine"), "checked", site.autoMine);
  const target = $("mineTarget");
  for (const option of target.options) {
    setValue(option, "hidden", !depositAccess(s, option.value));
    setValue(option, "disabled", option.hidden);
  }
  setValue(target, "value", site.target);
  setText(
    $("minerStatus"),
    site.autoMine
      ? site.veins[site.target].remaining
        ? "Waiting for deposit recovery."
        : "Next hit · " + seconds(3000 - site.swing)
      : "",
  );
}

function renderSites() {
  const farm = s.total >= farmAt;
  const mining = s.total >= mineAt;
  setValue($("fieldSites"), "hidden", !farm && !mining);
  setValue($("farm"), "hidden", !farm);
  setValue($("mine"), "hidden", !mining);
  if (!farm && !mining) return;
  const plots = s.sites.plots.slice(0, plotCount(s));
  const planted = plots.filter(Boolean);
  const ripe = planted.filter((plot) => plot.remaining === 0).length;
  const farmButton = $("farm");
  setText(
    $("farmStatus"),
    ripe
      ? ripe + " ripe"
      : planted.length
        ? planted.length + " growing"
        : "Ready to plant",
  );
  setValue(
    farmButton.dataset,
    "stage",
    ripe ? "ripe" : planted.length ? "growing" : "empty",
  );

  if (mining) {
    const available = Object.keys(deposits).filter((id) =>
      depositAccess(s, id),
    );
    const ready = available.filter(
      (id) => s.sites.veins[id].remaining === 0,
    ).length;
    setText($("mineStatus"), ready + " / " + available.length + " available");
    setValue($("mine").dataset, "stage", ready ? "ready" : "cooling");
  }
  if (runtime.modalType === "farm") updateFarm();
  if (runtime.modalType === "mine") updateMine();
}

function siteButtonAction(button) {
  const { siteAction: action, siteId: id } = button.dataset;
  const index = +button.dataset.plot;
  if (runtime.modalType === "farm") {
    if (action === "plant" && plant(s, index, $("seed-" + index).value))
      return "Crop planted.";
    if (action === "harvest") {
      const reward = harvest(s, index, "manual");
      if (reward) {
        return "Harvested · " + rewardText([reward]) + (reward.blueprint ? " · Wildroot blueprint discovered." : "");
      }
    }
    if (action === "research" && buyResearch(s, id))
      return research[id].name + " researched.";
  }
  if (runtime.modalType === "mine") {
    if (action === "mine") {
      const hit = mine(s, id, "manual");
      if (hit) {
        return hit.amount ? "Mined · " + rewardText([hit]) + (hit.blueprint ? " · Sparkforged blueprint discovered." : "") : "Deposit chipped.";
      }
    }
    if (action === "pick" && buyPick(s))
      return tools[s.sites.pick].name + " equipped.";
    if (action === "miner" && buyMiner(s)) return "Auto Mining purchased.";
  }
  return null;
}

function siteControlChange(target) {
  if (runtime.modalType === "farm" && target.id === "autoHarvest")
    return setHarvestMode(s, target.checked);
  if (
    runtime.modalType === "mine" &&
    ["autoMine", "mineTarget"].includes(target.id)
  )
    return setMiningMode(s, $("autoMine").checked, $("mineTarget").value);
  return false;
}

export {
  costText,
  rewardText,
  farmMarkup,
  mineMarkup,
  renderSites,
  siteButtonAction,
  siteControlChange,
};
