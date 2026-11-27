import { blacksmithMarkup, clearWork, refreshBlacksmith } from "./blacksmith-view.js";
import {
  renderBossBoard,
  resetCombatClock,
  syncCombat,
} from "./combat-view.js";
import { companionMarkup, renderCompanions } from "./companion-view.js";
import { companionsAt } from "./companions.js";
import { farmMarkup, mineMarkup, renderSites } from "./site-view.js";
import { farmAt, mineAt } from "./sites.js";
import { builds, craftAt, designKey, hasSetDesign } from "./build-gear.js";
import { ascCoinGoal } from "./prestige.js";
import { gearValue, salvageYield } from "./gear.js";
import { milestones, rarity, slots, upgrades } from "./data.js";
import {
  equippedSetsMarkup,
  forgeMarkup,
  updateForge,
  recipesMarkup,
  updateRecipes,
  lootRuleMarkup,
  updateLootRuleSummary,
  hideComparison,
} from "./equipment.js";
import { chestInterval } from "./field.js";
import { fieldLocationFor, playFieldReturn, renderLocationScene } from "./field-view.js";
import { workshopCost } from "./gameplay.js";
import { progressionGuideMarkup, updateProgressionGuide } from "./guide.js";
import { fmt, fmtExact } from "./numbers.js";
import {
  canPreviewAscension,
  hasAscensionAccess,
  hasUpgradeAccess,
  progressionThresholds,
} from "./progression.js";
import { runtime } from "./runtime.js";
import {
  getSaveWarning,
  readBlockedSave,
  readPreForgeSave,
  readPreFoundationSave,
  readPreExpansionSave,
  readPreSitesSave,
  readPreCompanionsSave,
  readPreCombatSave,
  readPreLivingFieldSave,
  readPreBlacksmithSave,
} from "./saves.js";
import {
  ascMarkup,
  ascReward,
  hideSkillTip,
  treeMarkup,
  updateTree,
} from "./skills.js";
import { sound } from "./sound.js";
import { gearIcon } from "./sprites.js";
import {
  equipped,
  getGearItem,
  itemName,
  itemStat,
  s,
  stats,
} from "./state.js";
import { $, setText, setValue } from "./ui-dom.js";
import { placeReel, wheelMarkup, wheelReady } from "./wheel.js";
import { recordWorld, worlds } from "./world-data.js";
import {
  isKnownWorld,
  updateWorlds,
  worldOptions,
  worldsMarkup,
} from "./worlds.js";

function upgradeLocked(u) {
  return !hasUpgradeAccess(s, u);
}
function upgradeRequirement(u) {
  return u.requires
    ? "Learn Auto Chest in the skill tree"
    : "Unlock at " + fmtExact(u.at) + " coins earned";
}
function chestSpeedLabel() {
  return (
    "Level " +
    s.up.chestSpeed +
    " / 20 · " +
    chestInterval().toFixed(2) +
    "s per chest"
  );
}
function iconMarkup(item) {
  return `<div class="item-icon">${gearIcon(item)}</div>`;
}
function itemCard(i) {
  const world = worlds[recordWorld(i)];
  const eq = equipped(i.slot),
    on = eq?.id === i.id,
    diff = eq ? Math.round((gearValue(i) - gearValue(eq)) * 100) / 100 : null;
  const salvage = salvageYield(i);
  return `<article class="item-card" style="--rarity:${rarity[i.r].color}"><div class="item-top">${iconMarkup(i)}<div><div class="rarity">${rarity[i.r].name} · Lv ${i.level}${i.forge ? " · Forge " + i.forge : ""}</div><h3>${itemName(i)}</h3><p>${slots[i.slot]} · ${world.name}${i.locked ? " · Locked" : ""}</p></div></div><div class="item-stat">${itemStat(i)}</div>${i.set ? `<div class="gear-bonus">${builds[i.set].name} · ${builds[i.set].style}${builds[i.set].slot === i.slot ? " · Signature" : ""}</div>` : world.gearBonus ? `<div class="gear-bonus">${world.gearBonus}</div>` : ""}<div class="compare">${on ? "Currently equipped" : diff === null ? "Empty equipment slot" : diff === 0 ? "Same stat as equipped" : (diff > 0 ? "+" : "") + diff + " compared with equipped"}</div><div class="actions"><button class="action gold" data-equip="${i.id}">${on ? "Unequip" : "Equip"}</button><button class="action secondary" data-salvage="${i.id}" ${on || i.locked ? "disabled" : ""}>Salvage<span class="salvage-yield">${salvage.coins} coins + ${salvage.scrap} scrap</span></button></div><div class="actions"><button class="action secondary" data-open-forge="${i.id}">Forge</button>
<button class="action secondary" data-lock="${i.id}" aria-pressed="${Boolean(i.locked)}">${i.locked ? "Unlock" : "Lock"}</button>
<button class="action secondary" data-compare="${i.id}">Compare</button></div></article>`;
}

const inventoryOptions = {
  gearRarity: ["All rarities", ...rarity.map((grade) => grade.name)],
  gearSet: {
    all: "All sets",
    regional: "Regional sets",
    ...Object.fromEntries(
      Object.entries(builds).map(([id, set]) => [id, set.name]),
    ),
  },
  gearEquipped: {
    all: "Any equipment status",
    yes: "Equipped",
    no: "Unequipped",
  },
  gearLocked: { all: "Any lock status", yes: "Locked", no: "Unlocked" },
  gearSort: {
    rarity: "Sort by rarity",
    stat: "Sort by effective stat",
    newest: "Sort by newest",
  },
};
const inventoryFilters = Object.keys(inventoryOptions);

function inventoryControls() {
  return Object.entries(inventoryOptions)
    .map(([id, options]) => {
      const entries = Array.isArray(options)
        ? options.map((name, i) => [i === 0 ? "all" : String(i - 1), name])
        : Object.entries(options);
      const current = runtime[id] || entries[0][0];
      const label = {
        gearRarity: "Filter rarity",
        gearSet: "Filter set",
        gearEquipped: "Filter equipped",
        gearLocked: "Filter locked",
        gearSort: "Sort gear",
      }[id];
      return `<select id="${id}" aria-label="${label}">${entries.map(([id, name]) => `<option value="${id}" ${id === current ? "selected" : ""}>${name}</option>`).join("")}</select>`;
    })
    .join("");
}

function statusMatch(filter, value) {
  return !filter || filter === "all" || (filter === "yes") === Boolean(value);
}

function inventory(inForge) {
  const list = s.items
    .filter(
      (i) =>
        (runtime.filter === "all" || String(i.slot) === runtime.filter) &&
        (runtime.gearWorldFilter === "all" ||
          recordWorld(i) === runtime.gearWorldFilter) &&
        (!runtime.gearRarity ||
          runtime.gearRarity === "all" ||
          runtime.gearRarity === String(i.r)) &&
        (!runtime.gearSet ||
          runtime.gearSet === "all" ||
          runtime.gearSet === (i.set || "regional")) &&
        statusMatch(runtime.gearEquipped, s.equip[i.slot] === i.id) &&
        statusMatch(runtime.gearLocked, i.locked),
    )
    .sort((a, b) => {
      if (runtime.gearSort === "newest") return b.id - a.id;
      if (runtime.gearSort === "stat")
        return gearValue(b) - gearValue(a) || b.r - a.r || b.id - a.id;
      return b.r - a.r || gearValue(b) - gearValue(a) || b.id - a.id;
    });
  return `<p class="subtext">Wear one item in each slot. Replacing gear keeps the previous item in your bag.</p><div class="slots">${slots
    .map((k, j) => {
      const i = equipped(j);
      return `<div class="slot ${i ? "filled" : ""}" style="--rarity:${i ? rarity[i.r].color : "#7b9b8a"}"><small>${k}</small>${i ? iconMarkup(i) + `<b>${itemName(i)}</b><small>${itemStat(i)}</small>` : "<b>— Empty —</b>"}</div>`;
    })
    .join("")}</div>${equippedSetsMarkup()}${lootRuleMarkup()}
    ${inForge ? "" : `<button class="action gold" data-open="recipes">Set recipes${s.total < craftAt ? " · " + fmtExact(craftAt) + " coins earned" : ""}</button>`}
    <div id="gearComparison" class="gear-comparison" role="tooltip" hidden></div>
    <div class="inv-head"><div><h3>Gear bag (${s.items.length}/300)</h3><small id="scrapBalance">${fmt(s.scrap)} scrap</small></div><div class="gear-filters"><select id="filter" aria-label="Filter gear"><option value="all">All slots</option>${slots.map((k, j) => `<option value="${j}">${k}</option>`).join("")}</select><select id="gearWorldFilter" aria-label="Filter gear by world"><option value="all">All worlds</option>${worldOptions()}</select>${inventoryControls()}</div></div>${list.length ? '<div class="item-grid">' + list.map(itemCard).join("") + "</div>" : '<div class="empty">No gear in this category yet. Open fallen chests to find equipment.</div>'}`;
}
function showCollection(id) {
  const set = Object.hasOwn(builds, id) ? id : null;
  const designs = slots
    .flatMap((slotName, slot) =>
      rarity.map((grade, r) => {
        if (set && !hasSetDesign(set, slot, r)) return null;
        const item = set ? { slot, r, set } : { slot, r, world: id };
        const found = s.found.includes(designKey(item));
        return {
          item,
          found,
          name: found ? itemName(item) : "Undiscovered " + slotName,
          grade,
        };
      }),
    )
    .filter(Boolean);
  const discovered = designs.filter((design) => design.found).length;
  setText(
    $("collectionCount"),
    discovered +
      "/" +
      designs.length +
      " item designs discovered in " +
      (set ? builds[set].name : worlds[id].name) +
      ". " +
      s.found.length +
      "/" +
      (rarity.length * slots.length * Object.keys(worlds).length +
        Object.values(builds).reduce(
          (total, def) =>
            total +
            (rarity.length - (def.baseRarity || 2)) *
              (def.rewardSlots?.length || slots.length),
          0,
        )) +
      " across all fields and sets.",
  );
  $("collectionGrid").innerHTML = designs
    .map(
      ({ item, found, name, grade }) =>
        `<div class="up-card" style="border-color:${found ? grade.color : "#3b6262"}"><div class="item-top" style="opacity:${found ? 1 : 0.45}">${iconMarkup(item)}<div><div class="rarity" style="--rarity:${grade.color}">${grade.name}</div><h3>${name}</h3></div></div></div>`,
    )
    .join("");
}

function openModal(type, id, location = runtime.fieldLocation) {
  if (
    (type === "farm" && s.total < farmAt) ||
    (type === "mine" && s.total < mineAt) ||
    (type === "companions" && s.total < companionsAt) ||
    (type === "bosses" && s.total < milestones.combat)
  )
    return;
  if (type === "wheel" && !wheelReady()) return;
  syncCombat();
  clearWork();
  if (["blacksmith", "forge", "recipes"].includes(type)) location = "forge";
  hideSkillTip();
  hideComparison();
  sound("menu");
  if ($("modal").hidden) runtime.lastFocus = document.activeElement;
  const landmark = fieldLocationFor(s, location, type);
  const entering = Boolean(landmark && $("modal").hidden);
  runtime.fieldLocation = landmark ? location : "";
  runtime.modalType = type;
  $("modal").hidden = false;
  $("game").inert = true;
  $("modal").classList.toggle("constellation", type === "skills");
  $("modal").classList.toggle("milestone-wheel", type === "wheel");
  renderLocationScene(s, runtime.fieldLocation, entering);
  $("close").textContent = landmark ? "Return to field" : type === "skills" ? "DONE" : "✕";
  $("close").setAttribute(
    "aria-label",
    landmark ? "Return to field" : type === "skills" ? "Done, return to field" : "Close dialog",
  );
  const oldLegend = $("treeLegend");
  if (oldLegend) oldLegend.remove();
  const t = $("modalTitle"),
    b = $("modalBody");
  if (type === "wheel") {
    runtime.wheelGeneration++;
    runtime.wheelMoving = false;
    runtime.wheelResult = null;
    t.textContent = "Milestone rewards";
    b.innerHTML = wheelMarkup();
    placeReel();
  } else if (type === "reward") {
    const i = getGearItem(id);
    if (!i) {
      openModal("inventory");
      return;
    }
    t.textContent = "Treasure discovered";
    b.innerHTML = `<div class="reward-preview" style="--rarity:${rarity[i.r].color}">${iconMarkup(i)}<div><div class="rarity">${rarity[i.r].name} · Field level ${i.level}</div><h3>${itemName(i)}</h3><div class="item-stat">${itemStat(i)}</div></div></div><p class="subtext">${equipped(i.slot) ? "Equipped: " + itemName(equipped(i.slot)) + " · " + itemStat(equipped(i.slot)) : "Your " + slots[i.slot].toLowerCase() + " slot is empty."}</p><div class="actions"><button class="action gold" data-equip-reward="${i.id}">Equip item</button><button class="action secondary" data-close="1">Keep in bag</button><button class="action" data-open="inventory">Gear bag</button></div>`;
  } else if (type === "inventory") {
    t.textContent = "Equipment & gear";
    if (
      runtime.gearWorldFilter !== "all" &&
      !isKnownWorld(s, runtime.gearWorldFilter)
    )
      runtime.gearWorldFilter = "all";
    b.innerHTML = landmark ? blacksmithMarkup(inventory(true)) : inventory(false);
    $("filter").value = runtime.filter;
    $("gearWorldFilter").value = runtime.gearWorldFilter;
    updateLootRuleSummary();
  } else if (type === "forge") {
    const item = getGearItem(id);
    if (!item) {
      openModal("inventory");
      return;
    }
    t.textContent = "Equipment forge";
    b.innerHTML = landmark ? blacksmithMarkup(forgeMarkup(item), "forgeResult") : forgeMarkup(item);
    b.closest(".window").scrollTop = 0;
    updateForge();
  } else if (type === "blacksmith") {
    b.innerHTML = blacksmithMarkup();
  } else if (type === "bosses") {
    t.textContent = "Boss Board";
    renderBossBoard();
    b.closest(".window").scrollTop = 0;
  } else if (type === "companions") {
    t.textContent = "Companions";
    b.innerHTML = companionMarkup();
    b.closest(".window").scrollTop = 0;
    renderCompanions();
  } else if (type === "farm" || type === "mine") {
    t.textContent = type === "farm" ? "Farming" : "Mining";
    b.innerHTML = type === "farm" ? farmMarkup() : mineMarkup();
    b.closest(".window").scrollTop = 0;
    renderSites();
  } else if (type === "recipes") {
    t.textContent = "Set recipes";
    b.innerHTML = landmark ? blacksmithMarkup(recipesMarkup(), "recipeResult") : recipesMarkup();
    updateRecipes();
  } else if (type === "worlds") {
    t.textContent = "Worlds";
    b.innerHTML = worldsMarkup();
    updateWorlds();
    b.closest(".window").scrollTop = 0;
  } else if (type === "progressionGuide") {
    t.textContent = "Progression guide";
    b.innerHTML = progressionGuideMarkup();
    b.closest(".window").scrollTop = 0;
    updateProgressionGuide();
  } else if (type === "skills") {
    t.textContent = "Skill tree";
    if (!hasAscensionAccess(s)) runtime.treeTab = "skills";
    const legend = document.createElement("div");
    legend.id = "treeLegend";
    legend.className = "tree-legend";
    legend.innerHTML = '<i class="green"></i> Learned<br><i></i> Available';
    t.parentElement.appendChild(legend);
    b.innerHTML = runtime.treeTab === "ascend" ? ascMarkup() : treeMarkup();
    updateTree();
    const sc = b.querySelector(".tree-map-scroll");
    if (sc) sc.scrollLeft = Math.max(0, (sc.scrollWidth - sc.clientWidth) / 2);
  } else if (type === "upgrades") {
    t.textContent = "Workshop";
    b.innerHTML = `<p class="subtext">Spend earned coins on lasting improvements. New upgrades appear as your field grows.</p><div id="workshopItems" class="item-grid"></div>`;
    updateBuyButtons();
  } else if (type === "collection") {
    t.textContent = "Treasure collection";
    b.innerHTML = `<div class="inv-head"><p id="collectionCount" class="subtext collection-count"></p><select id="collectionWorld" aria-label="Collection world or set">${worldOptions()}${
      s.total >= craftAt || s.found.some((key) => key.startsWith("set:"))
        ? `<optgroup label="Crafted sets">${Object.entries(builds)
            .filter(([, set]) => !set.rewardSlots)
            .map(([id, set]) => `<option value="${id}">${set.name}</option>`)
            .join("")}</optgroup>` +
          (s.total >= milestones.combat || Object.keys(s.combat.records).length
            ? `<optgroup label="Boss sets">${Object.entries(builds)
                .filter(([, set]) => set.rewardSlots)
                .map(
                  ([id, set]) => `<option value="${id}">${set.name}</option>`,
                )
                .join("")}</optgroup>`
            : "")
        : ""
    }</select></div>
      <p class="subtext">Base chest rarities: Common 60%, Uncommon 26%, Rare 10%, Epic 3.5%, Legendary 0.5%.</p><div id="collectionGrid" class="item-grid"></div>`;
    $("collectionWorld").value = s.world;
    showCollection(s.world);
  } else if (type === "settings") {
    t.textContent = "Save & settings";
    b.innerHTML = `<p class="subtext">Your game saves locally when browser storage is available. Export a backup to keep progress across devices.</p>
      <p class="subtext" id="saveWarning" role="status" hidden></p>
      <textarea id="saveText" aria-label="Save code" placeholder="Export or paste a save code"></textarea>
      <div class="settings-row">
        <button class="action" id="export">Export</button>
        <button class="action" id="import">Import</button>
        ${readBlockedSave() !== null ? '<button class="action secondary" id="exportStoredSave">Export stored save</button>' : ""}
        ${readPreLivingFieldSave() ? '<button class="action secondary" id="exportPreLivingField">Export pre-Living Field backup</button>' : ""}
        ${readPreCombatSave() ? '<button class="action secondary" id="exportPreCombat">Export pre-combat backup</button>' : ""}
        ${readPreCompanionsSave() ? '<button class="action secondary" id="exportPreCompanions">Export pre-companions backup</button>' : ""}
        ${readPreSitesSave() ? '<button class="action secondary" id="exportPreSites">Export pre-farming and mining backup</button>' : ""}
        ${readPreExpansionSave() ? '<button class="action secondary" id="exportPreExpansion">Export pre-expansion backup</button>' : ""}
        ${readPreFoundationSave() ? '<button class="action secondary" id="exportPreFoundation">Export pre-foundation backup</button>' : ""}
        ${readPreBlacksmithSave() ? '<button class="action secondary" id="exportPreBlacksmith">Export pre-Blacksmith backup</button>' : ""}
        ${readPreForgeSave() ? '<button class="action secondary" id="exportPreForge">Export pre-forge backup</button>' : ""}
        <button class="action secondary" id="reset">New game</button>
      </div>
      <p class="subtext" id="saveMsg">Press the red button or Space. Chests have a ${Math.round(stats().chance * 100)}% drop chance per press while there is space. Your first chest is guaranteed by press 8 if none has landed.</p>`;
    const warning = getSaveWarning();
    if (warning) {
      setText($("saveWarning"), warning);
      $("saveWarning").hidden = false;
    }
  }
  if (landmark) t.textContent = location === "forge" ? "Blacksmith" : landmark.name;
  refreshBlacksmith();
  if (location === "forge") b.closest(".window").scrollTop = 0;
  if (type === "skills") updateBuyButtons();
  $("close").focus();
}
function closeModal() {
  clearWork();
  hideSkillTip();
  hideComparison();
  runtime.ascConfirm = false;
  sound("menu");
  runtime.wheelGeneration++;
  runtime.wheelMoving = false;
  $("modal").hidden = true;
  $("game").inert = false;
  runtime.modalType = "";
  if (runtime.fieldLocation) playFieldReturn();
  runtime.fieldLocation = "";
  renderLocationScene(s, "", false);
  resetCombatClock();
  if (runtime.lastFocus?.isConnected && !runtime.lastFocus.closest("[hidden]"))
    runtime.lastFocus.focus();
  else $("press").focus();
}
function updateWorkshop() {
  const grid = $("workshopItems");
  const next = upgrades.find((u) => !u.requires && upgradeLocked(u));
  const visible = upgrades
    .map((u, index) => ({ u, index }))
    .filter(({ u }) => !upgradeLocked(u) || u === next);
  const key = visible.map(({ index }) => index).join(",");
  if (grid.dataset.visible !== key) {
    const focused = document.activeElement?.dataset.buy;
    grid.dataset.visible = key;
    grid.innerHTML = visible
      .map(
        ({ u, index }) =>
          `<div class="up-card"><h3></h3><p>${u.desc}</p><strong data-level="${index}"></strong>
        <button class="action" data-buy="${index}"></button></div>`,
      )
      .join("");
    if (focused !== undefined)
      grid.querySelector(`[data-buy="${focused}"]`)?.focus();
  }
  for (const button of grid.querySelectorAll("[data-buy]")) {
    const index = +button.dataset.buy;
    const u = upgrades[index];
    const locked = upgradeLocked(u);
    const price = workshopCost(s, u);
    const lv = s.up[u.id];
    const maxed = lv >= (u.max || 100);
    setValue(button, "disabled", locked || maxed || s.coins < price);
    setText(
      button,
      locked
        ? upgradeRequirement(u)
        : maxed
          ? "Max level"
          : "Buy · " + fmtExact(price) + " coins",
    );
    setText(
      grid.querySelector(`[data-level="${index}"]`),
      u.id === "chestSpeed" ? chestSpeedLabel() : "Level " + lv,
    );
    setText(
      button.closest(".up-card").querySelector("h3"),
      (locked ? "🔒 " : "") + u.name,
    );
  }
}

function updateBuyButtons() {
  if (runtime.modalType === "upgrades") {
    updateWorkshop();
    return;
  }
  if (runtime.modalType !== "skills") return;
  const ascTab = $("modalBody").querySelector('[data-tree-tab="ascend"]');
  if (ascTab) {
    const accessible = hasAscensionAccess(s);
    setValue(ascTab, "hidden", !accessible && !canPreviewAscension(s));
    setValue(ascTab, "disabled", !accessible);
    setText(
      ascTab,
      accessible
        ? "✦ Ascend"
        : "✦ Ascension · " + fmtExact(progressionThresholds.ascension),
    );
  }
  if (runtime.treeTab === "skills") {
    updateTree();
    return;
  }
  const btn = $("modalBody").querySelector("[data-asc-start]");
  if (!btn) return;
  const r = ascReward();
  const next = ascCoinGoal(r + 1);
  setValue(btn, "disabled", r < 1);
  setText(btn, "Ascend · +" + fmt(r) + " ★");
  const banner = $("modalBody").querySelector(".asc-banner");
  setValue(
    banner.querySelector(".asc-meter i").style,
    "width",
    Math.min(100, (s.total / next) * 100) + "%",
  );
  setText(
    banner.querySelector("p b"),
    fmt(s.total) + " / " + fmt(next) + " coins earned this run",
  );
  setText(
    banner.querySelector(".asc-meter + p"),
    "Next star at " +
      fmt(next) +
      " coins · First ascension requires " +
      fmtExact(progressionThresholds.ascension) +
      " coins.",
  );
}

export {
  inventoryFilters,
  closeModal,
  iconMarkup,
  openModal,
  showCollection,
  updateBuyButtons,
};
