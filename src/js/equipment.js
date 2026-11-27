import { blueprints, signatureLoadout, signatureText } from "./blacksmith-data.js";
import { materialOffer } from "./gear.js";
import { costText } from "./site-view.js";
import {
  buildProfile,
  builds,
  canPay,
  craftAt,
  evolutionOffer,
  recipePayment,
} from "./build-gear.js";
import { gearBagLimit } from "./gameplay.js";
import { gearValue } from "./gear.js";
import { calculateStats, equippedGear } from "./state.js";
import { worldGearCount } from "./worlds.js";
import { fmtRate } from "./numbers.js";
import { rarity, slots } from "./data.js";
import { iconMarkup } from "./dialogs.js";
import { forgeOffer, forgeUnlock, maxForgeRank, regionalSets } from "./gear.js";
import { fmt, fmtExact } from "./numbers.js";
import { equipped, getGearItem, itemName, itemStat, s } from "./state.js";
import { $, setText, setValue } from "./ui-dom.js";
import { recordWorld, worlds } from "./world-data.js";

function equippedSetsMarkup() {
  const counts = new Map();
  for (const slot of slots.keys()) {
    const gear = equipped(slot);
    if (!gear || gear.set) continue;
    const id = recordWorld(gear);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const entries = [...counts]
    .sort(([a], [b]) => Number(b === s.world) - Number(a === s.world))
    .map(([id, pieces]) => {
      const here = id === s.world;
      const set = regionalSets[id];
      return `<li><strong style="color:${worlds[id].accent}">${worlds[id].name} · ${pieces}/4</strong>${here ? "" : " · activates in its home field"}
        <div class="${here && pieces >= 2 ? "set-active" : ""}">2 pieces · ${set.two}</div>
        <div class="${here && pieces >= 4 ? "set-active" : ""}">4 pieces · ${set.four}</div></li>`;
    });
  return (
    buildSummary() +
    (entries.length
      ? `<details class="gear-sets"><summary>Equipped world sets</summary><ul>${entries.join("")}</ul></details>`
      : "")
  );
}

function forgeMarkup(item) {
  return `<div class="reward-preview" style="--rarity:${rarity[item.r].color}">${iconMarkup(item)}
    <div><div class="rarity">${worlds[recordWorld(item)].name} · ${rarity[item.r].name} · ${slots[item.slot]}</div>
    <h3>${itemName(item)}</h3><div id="forgeStat" class="item-stat"></div></div></div>
    <p class="subtext">Each rank adds 12% of the current base stat. Salvage spare gear for scrap. Salvaging a forged item gives its usual salvage reward.</p>
    <div class="forge-details"><p id="forgeRank"></p><p id="forgeBalance"></p><p id="forgeNext"></p><p id="evolutionInfo"></p></div>
    <div class="gear-filters recipe-controls">
      <label id="forgePaymentRow" hidden>Temper payment <select id="forgePayment"><option value="standard">Coins and scrap</option><option value="materials">Gathered materials</option></select></label>
      <button class="action gold" id="forgeBuy" data-forge="${item.id}"></button>
      <button class="action gold" id="evolveBuy" data-evolve="${item.id}" hidden></button>
    </div>`;
}

function updateForge() {
  const button = $("forgeBuy");
  if (!button) return;
  const item = getGearItem(+button.dataset.forge);
  if (!item) return;
  const offer = forgeOffer(s, item);
  setText($("forgeStat"), itemStat(item));
  setText($("forgeRank"), "Forge rank " + offer.rank + "/" + maxForgeRank);
  setText(
    $("forgeBalance"),
    "Available · " + fmt(s.coins) + " coins and " + fmt(s.scrap) + " scrap",
  );
  setText(
    $("forgeNext"),
    offer.maxed
      ? "Maximum rank reached."
      : "Next rank · " + itemStat({ ...item, forge: offer.rank + 1 }),
  );
  const step = evolutionOffer(s, item);
  const evolve = $("evolveBuy");
  setValue(evolve, "hidden", !step);
  if (step) {
    const next = rarity[item.r + 1].name;
    setText(
      $("evolutionInfo"),
      "Evolve to " +
        next +
        " at Forge rank 3 and " +
        fmtExact(step.at) +
        " coins earned this run. Base stat ×" +
        step.scale +
        ". Keeps your forge rank and equipment slot.",
    );
    setValue(evolve, "disabled", !step.available);
    setText(evolve, "Evolve · " + costLabel(step.cost));
  } else {
    setText(
      $("evolutionInfo"),
      item.r === 6
        ? "Highest evolution tier."
        : "Evolution starts with Rare gear.",
    );
  }
  const temper = materialOffer(s, item);
  const useMaterials = Boolean(temper && $("forgePayment").value === "materials");
  const payment = useMaterials ? temper : offer;
  setValue($("forgePaymentRow"), "hidden", !temper);
  setValue(button.dataset, "payment", useMaterials ? "materials" : "standard");
  setValue(button, "disabled", !payment.available);
  setText(
    button,
    offer.maxed
      ? "Fully forged"
      : offer.locked
        ? "Unlocks at " + fmtExact(forgeUnlock) + " coins earned"
        : "Temper · " + costText(payment.cost),
  );
}

function costLabel(cost) {
  return Object.entries(cost)
    .map(([id, amount]) => fmtExact(amount) + " " + id)
    .join(" + ");
}

function buildSummary() {
  const profile = buildProfile(equippedGear());
  const charge = s.abilityProgress;
  return Object.entries(profile)
    .filter(([, info]) => info.count)
    .map(([id, info]) => {
      const set = builds[id];
      if (set.rewardSlots) {
        return `<details class="gear-sets"><summary>${set.name} · ${info.count}/${set.rewardSlots.length} · ${info.count >= 2 ? "Active in combat" : "Bonus inactive"}</summary>
          <p>Boss Board reward</p><p>2 pieces · ${set.two}</p>${set.four ? "<p>4 pieces · " + set.four + "</p>" : ""}</details>`;
      }
      if (Object.hasOwn(blueprints, id)) {
        const signature = signatureLoadout(equippedGear(), id);
        const ability = signature ? signatureText(id, signature) : "Equip " + set.signature;
        return `<details class="gear-sets"><summary>${set.name} · ${info.count}/4 · ${ability}</summary>
          <p>${set.ability}</p><p>2 pieces · ${set.two}</p><p>4 pieces · ${set.four}</p></details>`;
      }
      const cap = info.count >= 2;
      const current = {
        hammerhand:
          Math.min(charge.hammerhand, cap ? 15 : 20) +
          "/" +
          (cap ? 15 : 20) +
          " presses",
        clockwork:
          Math.floor(Math.min(charge.clockwork, cap ? 45000 : 60000) / 1000) +
          "/" +
          (cap ? 45 : 60) +
          " seconds",
        forager: charge.forager + "/3 chest openings",
        pathfinder:
          Math.min(charge.pathfinder, cap ? 5 : 6) +
          "/" +
          (cap ? 5 : 6) +
          " openings · " +
          charge.charges +
          " banked",
      }[id];
      return `<details class="gear-sets"><summary>${set.name} · ${info.count}/4 · ${info.active ? current : "Ability inactive"}</summary>
      <p>${slots[set.slot]} or 2 pieces · ${set.ability}</p><p>2 pieces · ${set.two}</p><p>4 pieces · ${set.four}</p></details>`;
    })
    .join("");
}

function recipesMarkup() {
  const available = s.total >= craftAt;
  return `<p class="subtext" id="recipeGate" ${available ? "hidden" : ""}>Unlocks at ${fmtExact(craftAt)} coins earned this run.</p>
    <div id="recipeForm" ${available ? "" : "hidden"}><div class="forge-details">${Object.values(
      builds,
    )
      .filter((set) => !set.rewardSlots && !set.signature)
      .map(
        (set) =>
          `<details><summary>${set.name} · ${set.style}</summary><p>${slots[set.slot]} or 2 pieces · ${set.ability}</p><p>2 pieces · ${set.two}</p><p>4 pieces · ${set.four}</p></details>`,
      )
      .join("")}</div>
    <div class="gear-filters recipe-controls">
    <label>Set <select id="recipeSet">${Object.entries(builds)
      .filter(([id, set]) => !set.rewardSlots && (!set.signature || s.blacksmith.recipes.includes(id)))
      .map(([id, set]) => `<option value="${id}">${set.name}</option>`)
      .join("")}</select></label>
    <label>Slot <select id="recipeSlot">${slots.map((slot, i) => `<option value="${i}">${slot}</option>`).join("")}</select></label>
    <label id="recipePaymentRow">Payment <select id="recipePayment"><option value="standard">Coins, scrap, and shards</option><option value="materials">Gathered materials</option></select></label>
    </div><p class="subtext">Craft a Rare piece scaled to your current field and level.</p>
    <p id="recipeBalance" hidden></p><button id="craftGear" class="action gold">Craft</button>
    </div>
    <details class="smith-blueprints"><summary>Rare blueprints</summary>${Object.entries(blueprints).map(([id, def]) =>
      `<article style="--plate:${def.color}"><strong>${def.name} · ${def.signature}</strong>
      <p>${s.blacksmith.recipes.includes(id) ? def.ability : def.clue}</p>
      <p>${s.blacksmith.recipes.includes(id) ? def.two + " " + def.four : ""}</p></article>`
    ).join("")}</details>`;
}

function updateRecipes() {
  const unlocked = s.total >= craftAt;
  setValue($("recipeForm"), "hidden", !unlocked);
  setValue($("recipeGate"), "hidden", unlocked);
  const full = s.items.length >= gearBagLimit;
  const set = $("recipeSet").value;
  const rare = Object.hasOwn(blueprints, set);
  const useMaterials = !rare && $("recipePayment").value === "materials";
  const cost = recipePayment(s, set, useMaterials);
  const button = $("craftGear");
  setValue($("recipePaymentRow"), "hidden", rare);
  setValue(button.dataset, "payment", useMaterials ? "materials" : "standard");
  setText(button, cost ? "Craft · " + costText(cost) : rare
    ? "Unlocks at " + fmtExact(blueprints[set].at) + " earned" : "Craft");
  setValue($("recipeBalance"), "hidden", !full);
  if (full) setText($("recipeBalance"), "Gear bag is full.");
  setValue(button, "disabled", !cost || full || !canPay(s, cost));
}

const equipModes = {
  off: "Off",
  protect: "Protect current build",
  strongest: "Strongest stat",
};

const disposalModes = {
  off: "Off",
  salvage: "Auto Salvage",
  sell: "Auto Sell",
};

const disposalMode = (rules) => rules.sell ? "sell" : rules.salvage ? "salvage" : "off";

function lootRuleMarkup() {
  const rules = s.lootRules;
  return `<details class="gear-sets" id="lootRules"><summary>Loot automation</summary>
    <div class="gear-filters recipe-controls">
      <label>Auto Equip <select id="lootEquip">${Object.entries(equipModes)
        .map(
          ([id, label]) =>
            `<option value="${id}" ${id === rules.equip ? "selected" : ""}>${label}</option>`,
        )
        .join("")}</select></label>
      <label>Spare gear <select id="lootDisposal">${Object.entries(disposalModes)
        .map(([id, label]) => `<option value="${id}" ${id === disposalMode(rules) ? "selected" : ""}>${label}</option>`)
        .join("")}</select></label>
      <label>Rarity ceiling <select id="lootCeiling">${rarity
        .slice(0, 4)
        .map(
          (r, i) =>
            `<option value="${i}" ${i === rules.ceiling ? "selected" : ""}>${r.name}</option>`,
        )
        .join("")}</select></label>
      <label><input type="checkbox" id="lootDuplicates" ${rules.duplicates ? "checked" : ""}> Duplicates only</label>
    </div>
    <p id="lootRuleSummary"></p>
    <p class="subtext">Applies to new chest loot. Auto Equip runs first. First discoveries and stat upgrades are kept. Auto Sell pays extra coins in place of scrap.</p>
    </details>`;
}

function updateLootRuleSummary() {
  const rules = s.lootRules;
  setText(
    $("lootRuleSummary"),
    "Auto Equip · " +
      equipModes[rules.equip] +
      " · " +
      (disposalMode(rules) !== "off"
        ? disposalModes[disposalMode(rules)] + " up to " +
          rarity[rules.ceiling].name +
          (rules.duplicates ? ", duplicates only" : "")
        : "Spare gear kept"),
  );
}

function effectsFor(gear) {
  const profile = buildProfile(gear);
  const effects = Object.entries(profile)
    .filter(([, info]) => info.active)
    .map(
      ([id, info]) => {
        const signature = Object.hasOwn(blueprints, id) && signatureLoadout(gear, id);
        if (signature) return builds[id].signature + " · " + signatureText(id, signature);
        return builds[id].name +
        (info.count >= 2
          ? " · " + (info.count >= 4 ? 4 : 2) + "-piece"
          : " · Signature");
      },
    );
  const pieces = worldGearCount(s.world, gear);
  if (pieces >= 2)
    effects.push(
      worlds[s.world].name + " · " + (pieces >= 4 ? 4 : 2) + "-piece",
    );
  return effects;
}

let comparisonAnchor;

function hideComparison() {
  comparisonAnchor?.removeAttribute("aria-describedby");
  comparisonAnchor = null;
  const tip = $("gearComparison");
  if (tip) tip.hidden = true;
}

function showComparison(button) {
  const item = getGearItem(+button.dataset.compare);
  const tip = $("gearComparison");
  if (!item || !tip) return;
  hideComparison();
  comparisonAnchor = button;
  button.setAttribute("aria-describedby", tip.id);
  const before = equippedGear();
  const next = before.slice();
  next[item.slot] = item;
  const a = calculateStats(s, before);
  const b = calculateStats(s, next);
  const from = (name, first, second) =>
    `<div>${name} · ${fmtRate(first)} → ${fmtRate(second)}</div>`;
  const old = effectsFor(before);
  const newEffects = effectsFor(next);
  const lost = old.filter((name) => !newEffects.includes(name));
  const gained = newEffects.filter((name) => !old.includes(name));
  tip.innerHTML = `<strong>${itemName(item)}</strong><div>${before[item.slot] ? itemName(before[item.slot]) : "Empty slot"} equipped</div>
    ${from("Slot stat", gearValue(before[item.slot]), gearValue(item))}
    ${from("Coins per press", a.tap, b.tap)}${from("Coins per second", a.auto, b.auto)}
    ${from("Chest chance (%)", a.chance * 100, b.chance * 100)}
    ${lost.length ? "<div>Replaces · " + lost.join(", ") + "</div>" : ""}
    ${gained.length ? "<div>Adds · " + gained.join(", ") + "</div>" : ""}`;
  tip.hidden = false;
  positionComparison();
}

function positionComparison() {
  const tip = $("gearComparison");
  if (!tip || tip.hidden || !comparisonAnchor?.isConnected) return;
  const rect = comparisonAnchor.getBoundingClientRect();
  const width = tip.offsetWidth;
  tip.style.left =
    Math.max(8, Math.min(rect.left, innerWidth - width - 8)) + "px";
  tip.style.top =
    Math.max(
      8,
      rect.bottom + tip.offsetHeight + 8 <= innerHeight
        ? rect.bottom + 6
        : rect.top - tip.offsetHeight - 6,
    ) + "px";
}

export {
  equippedSetsMarkup,
  forgeMarkup,
  updateForge,
  recipesMarkup,
  updateRecipes,
  lootRuleMarkup,
  updateLootRuleSummary,
  showComparison,
  hideComparison,
  positionComparison,
};
