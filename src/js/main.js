import { buildRecipe, evolveGear, normalizeLootRules } from "./build-gear.js";
import {
  showComparison,
  hideComparison,
  positionComparison,
  updateLootRuleSummary,
} from "./equipment.js";
import { buyAscensionUpgrade } from "./prestige.js";
import { ascUpgrades, clamp, upgrades } from "./data.js";
import {
  closeModal,
  openModal,
  showCollection,
  inventoryFilters,
} from "./dialogs.js";
import { initFieldEffects, toast } from "./effects.js";
import { addGearItem, forgeGear, salvageGear } from "./gear.js";
import {
  autoChestTick,
  fieldSnapshot,
  notice,
  openChest,
  press,
  render,
  renderChests,
  replaceRun,
} from "./field.js";
import {
  buyWorkshopUpgrade,
  equipItem,
  learnSkill,
  gearBagLimit,
  nextEntityId,
} from "./gameplay.js";
import { hasAscensionAccess } from "./progression.js";
import { runtime } from "./runtime.js";
import {
  loadStoredRun,
  normalize,
  readBlockedSave,
  readPreForgeSave,
  readPreFoundationSave,
  readPreExpansionSave,
  resumeSaving,
  save,
} from "./saves.js";
import {
  ascend,
  initSkillUI,
  refreshAsc,
  skillById,
  updateTree,
} from "./skills.js";
import { initSound, sound } from "./sound.js";
import { coin, itemIcon } from "./sprites.js";
import {
  earn,
  fresh,
  getGearItem,
  itemName,
  recordEarnings,
  level,
  s,
} from "./state.js";
import { $, setText } from "./ui-dom.js";
import { collectWheel, placeReel } from "./wheel.js";
import { travel } from "./worlds.js";

loadStoredRun();
initSound();
initSkillUI();
initFieldEffects();

$("coinIcon").innerHTML = coin();
$("tapIcon").innerHTML = itemIcon(0, 0);
$("autoIcon").innerHTML = itemIcon(2, 1);
$("shardIcon").innerHTML = itemIcon(3, 3);
$("press").addEventListener("click", press);
$("chests").addEventListener("click", (e) => {
  const b = e.target.closest("[data-chest]");
  if (b) openChest(+b.dataset.chest);
});
for (const id of [
  "worlds",
  "progressionGuide",
  "inventory",
  "upgrades",
  "skills",
  "collection",
  "settings",
  "wheel",
])
  $(id).addEventListener("click", () => openModal(id));
$("close").addEventListener("click", closeModal);
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) closeModal();
});
$("modalBody").addEventListener("change", (e) => {
  const { id, value } = e.target;
  if (id === "collectionWorld") {
    showCollection(value);
    return;
  }
  if (
    runtime.modalType === "inventory" &&
    ["lootEquip", "lootSalvage", "lootCeiling", "lootDuplicates"].includes(id)
  ) {
    s.lootRules = normalizeLootRules({
      equip: $("lootEquip").value,
      salvage: $("lootSalvage").checked,
      ceiling: +$("lootCeiling").value,
      duplicates: $("lootDuplicates").checked,
    });
    updateLootRuleSummary();
    save();
    return;
  }
  if (inventoryFilters.includes(id)) {
    runtime[id] = value;
    openModal("inventory");
    $(id).focus();
    return;
  }
  if (id === "filter" || id === "gearWorldFilter") {
    if (id === "filter") runtime.filter = value;
    else runtime.gearWorldFilter = value;
    openModal("inventory");
    $(id).focus();
  }
});
$("modalBody").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.compare) {
    showComparison(b);
    return;
  }
  if (b.dataset.lock) {
    const item = getGearItem(+b.dataset.lock);
    if (!item) return;
    if (item.locked) delete item.locked;
    else item.locked = true;
    save();
    openModal("inventory");
    $("modalBody").querySelector(`[data-lock="${item.id}"]`)?.focus();
    return;
  }
  if (b.id === "craftGear" && runtime.modalType === "recipes") {
    const item = buildRecipe(
      s,
      $("recipeSet").value,
      +$("recipeSlot").value,
      level(),
      nextEntityId,
      addGearItem,
      gearBagLimit,
    );
    if (!item) return;
    sound("upgrade");
    notice("Crafted " + itemName(item) + ".");
    setText($("recipeResult"), "Crafted " + itemName(item) + ".");
    render();
    save();
    return;
  }
  if (b.dataset.evolve && runtime.modalType === "forge") {
    const item = getGearItem(+b.dataset.evolve);
    if (!evolveGear(s, item)) return;
    sound("upgrade");
    notice("Gear evolved.");
    save();
    openModal("forge", item.id);
    setText($("forgeResult"), "Gear evolved. Forge rank and lock retained.");
    render();
    return;
  }
  if (b.dataset.openForge) {
    openModal("forge", +b.dataset.openForge);
    return;
  }
  if (b.dataset.forge) {
    const item = getGearItem(+b.dataset.forge);
    if (runtime.modalType === "forge" && forgeGear(s, item)) {
      notice("Forged " + itemName(item) + " to rank " + item.forge + ".");
      sound("upgrade");
      render();
      save();
      setText($("forgeResult"), "Forged to rank " + item.forge + ".");
      if (b.disabled) $("close").focus();
    }
    return;
  }
  if (b.dataset.travel) {
    travel(b.dataset.travel);
    return;
  }
  if (b.id === "wheelClaim") {
    collectWheel();
    return;
  }
  if (b.id === "wheelNext") {
    closeModal();
    return;
  }
  if (b.dataset.treeTab) {
    if (b.dataset.treeTab === "ascend" && !hasAscensionAccess(s)) return;
    runtime.treeTab = b.dataset.treeTab;
    runtime.ascConfirm = false;
    openModal("skills");
    return;
  }
  if (b.hasAttribute("data-asc-start")) {
    runtime.ascConfirm = true;
    refreshAsc();
    return;
  }
  if (b.hasAttribute("data-asc-cancel")) {
    runtime.ascConfirm = false;
    refreshAsc();
    return;
  }
  if (b.hasAttribute("data-asc-confirm")) {
    ascend();
    return;
  }
  if (b.dataset.ascBuy) {
    const u = ascUpgrades.find((x) => x.id === b.dataset.ascBuy);
    if (buyAscensionUpgrade(s, u)) {
      sound("upgrade");
      render();
      save();
      refreshAsc();
    }
    return;
  }
  if (b.dataset.node) {
    runtime.selectedSkill = b.dataset.node;
    updateTree();
    return;
  }
  if (b.dataset.learn) {
    const n = skillById(b.dataset.learn);
    if (learnSkill(s, n)) {
      sound("upgrade");
      notice("Skill learned: " + n.name + ".");
      render();
      save();
      updateTree();
    }
    return;
  }
  if (b.dataset.close) {
    closeModal();
    return;
  }
  if (b.dataset.open) {
    openModal(b.dataset.open);
    return;
  }
  if (b.dataset.equip || b.dataset.equipReward) {
    const i = getGearItem(+(b.dataset.equip || b.dataset.equipReward));
    if (!equipItem(s, i, Boolean(b.dataset.equip))) return;
    sound("equip");
    notice("Equipment updated: " + itemName(i) + ".");
    render();
    save();
    if (b.dataset.equipReward) closeModal();
    else openModal("inventory");
    return;
  }
  if (b.dataset.salvage) {
    const i = getGearItem(+b.dataset.salvage);
    const before = s.total;
    const payout = salvageGear(s, i);
    if (payout) {
      recordEarnings(before);
      notice(
        "Salvaged " +
          itemName(i) +
          " for " +
          payout.coins +
          " coins and " +
          payout.scrap +
          " scrap.",
      );
      render();
      save();
      openModal("inventory");
    }
    return;
  }
  if (b.dataset.buy !== undefined) {
    if (
      runtime.modalType !== "upgrades" ||
      !buyWorkshopUpgrade(s, upgrades[+b.dataset.buy])
    )
      return;
    sound("upgrade");
    render();
    save();
    return;
  }
  if (b.id === "export") {
    $("saveText").value = JSON.stringify(s);
    $("saveText").select();
    $("saveMsg").textContent = "Copy the save code to keep a backup.";
  }
  if (b.id === "exportPreForge") {
    const backup = readPreForgeSave();
    if (backup) {
      $("saveText").value = backup;
      $("saveText").select();
      $("saveMsg").textContent =
        "Copy the pre-forge backup to keep it separately.";
    }
  }
  if (
    ["exportStoredSave", "exportPreExpansion", "exportPreFoundation"].includes(
      b.id,
    )
  ) {
    const backup =
      b.id === "exportStoredSave"
        ? readBlockedSave()
        : b.id === "exportPreExpansion"
          ? readPreExpansionSave()
          : readPreFoundationSave();
    if (backup !== null) {
      $("saveText").value = backup;
      $("saveText").select();
      setText($("saveMsg"), "Copy the save code to keep a backup.");
    }
  }
  if (b.id === "import") {
    try {
      replaceRun(normalize(JSON.parse($("saveText").value)));
      resumeSaving();
      render();
      save();
      closeModal();
      toast("Save imported");
    } catch (error) {
      setText(
        $("saveMsg"),
        error instanceof SyntaxError ? "Invalid save code." : error.message,
      );
    }
  }
  if (
    b.id === "reset" &&
    confirm("Start a new game and erase this progress?")
  ) {
    replaceRun(fresh());
    resumeSaving();
    render();
    save();
    closeModal();
  }
});
const comparisonButtons = $("modalBody");
comparisonButtons.addEventListener("pointerover", (event) => {
  const button = event.target.closest("[data-compare]");
  if (button && event.pointerType !== "touch") showComparison(button);
});
comparisonButtons.addEventListener("focusin", (event) => {
  if (event.target.matches("[data-compare]")) showComparison(event.target);
});
comparisonButtons.addEventListener("focusout", (event) => {
  if (event.target.matches("[data-compare]")) hideComparison();
});
comparisonButtons.addEventListener("pointerout", (event) => {
  const button = event.target.closest("[data-compare]");
  if (button && document.activeElement !== button) hideComparison();
});
$("modal").addEventListener("scroll", positionComparison, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !$("modal").hidden) {
    const targets = [
      ...$("modal").querySelectorAll(
        "button, input, select, textarea, summary, a[href], [tabindex]",
      ),
    ].filter(
      (element) =>
        !element.disabled &&
        element.tabIndex >= 0 &&
        element.getClientRects().length,
    );
    const first = targets[0];
    const last = targets.at(-1);
    const active = document.activeElement;
    if (
      first &&
      last &&
      (!targets.includes(active) || active === (e.shiftKey ? first : last))
    ) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
    return;
  }
  if (e.key === "Escape" && !$("modal").hidden) {
    if ($("gearComparison") && !$("gearComparison").hidden) hideComparison();
    else closeModal();
    return;
  }
  if (
    e.code === "Space" &&
    !e.repeat &&
    $("modal").hidden &&
    (!document.activeElement ||
      document.activeElement === $("press") ||
      !["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(
        document.activeElement.tagName,
      ))
  ) {
    e.preventDefault();
    press();
  }
});
window.addEventListener("resize", () => {
  positionComparison();
  if (runtime.modalType === "wheel" && !runtime.wheelMoving) placeReel();
});
function savePassiveIncome() {
  if (runtime.saveDirty) save();
}
window.addEventListener("pagehide", savePassiveIncome);
renderChests();
render();
save();
let last = performance.now();
setInterval(() => {
  const now = performance.now(),
    dt = clamp((now - last) / 1000, 0, 1);
  last = now;
  const snapshot = fieldSnapshot();
  if (snapshot.rates.auto > 0) {
    earn(snapshot.rates.auto * dt);
    render(snapshot);
  }
  autoChestTick(dt, snapshot);
}, 250);
setInterval(savePassiveIncome, 5000);
