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
    if (!gear) continue;
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
  return entries.length
    ? `<details class="gear-sets"><summary>Equipped world sets</summary><ul>${entries.join("")}</ul></details>`
    : "";
}

function forgeMarkup(item) {
  return `<div class="reward-preview" style="--rarity:${rarity[item.r].color}">${iconMarkup(item)}
    <div><div class="rarity">${worlds[recordWorld(item)].name} · ${rarity[item.r].name} · ${slots[item.slot]}</div>
    <h3>${itemName(item)}</h3><div id="forgeStat" class="item-stat"></div></div></div>
    <p class="subtext">Each rank adds 12% of the original stat. Salvage spare gear for scrap. Salvaging a forged item gives its usual salvage reward.</p>
    <div class="forge-details"><p id="forgeRank"></p><p id="forgeBalance"></p><p id="forgeNext"></p></div>
    <div class="settings-row"><button class="action gold" id="forgeBuy" data-forge="${item.id}"></button>
    <button class="action secondary" data-open="inventory">Back to Gear</button></div>
    <p class="subtext" id="forgeResult" role="status"></p>`;
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
  setValue(button, "disabled", !offer.available);
  setText(
    button,
    offer.maxed
      ? "Fully forged"
      : offer.locked
        ? "Unlocks at " + fmtExact(forgeUnlock) + " coins earned"
        : "Forge · " +
          fmtExact(offer.cost.coins) +
          " coins + " +
          fmtExact(offer.cost.scrap) +
          " scrap",
  );
}

export { equippedSetsMarkup, forgeMarkup, updateForge };
