import { bosses, combatSets } from "./boss-data.js";
import {
  advanceFight,
  bossAccess,
  claimBossGear,
  combatLoadout,
  currentMove,
  guardFight,
  retreatFight,
  startFight,
} from "./combat.js";
import { milestones, slots } from "./data.js";
import { fmtExact } from "./numbers.js";
import { runtime } from "./runtime.js";
import { save } from "./saves.js";
import { sound } from "./sound.js";
import { equippedGear, itemName, s } from "./state.js";
import { $, setText, setValue } from "./ui-dom.js";
import { worlds } from "./world-data.js";

let lastTick;
let selected = "";
let result = null;
let boardMessage = "";
const pictures = new Map();
const spriteIds = ["combatSprite", "combatActor"];

function bossSprite(id) {
  if (pictures.has(id)) return pictures.get(id);
  const { art, color } = bosses[id];
  const paths = ["", "", "", "", ""];
  for (const [y, row] of art.entries())
    for (const [x, pixel] of Array.from(row).entries())
      if (pixel !== ".") paths[pixel] += `M${x} ${y}h1v1h-1z`;
  const palette = ["", "#16242d", color, "#896291", "#fff2b5"];
  const sprite = `<svg viewBox="0 0 12 10" shape-rendering="crispEdges" class="boss-sprite" aria-hidden="true">${paths
    .slice(1)
    .map((d, i) => `<path fill="${palette[i + 1]}" d="${d}"/>`)
    .join("")}</svg>`;
  pictures.set(id, sprite);
  return sprite;
}

function rewardName(id) {
  const { set, slot } = bosses[id].reward;
  return combatSets[set].name + " " + slots[slot];
}

function timeLabel(ms) {
  return (ms / 1000).toFixed(1) + "s";
}

function loadoutMarkup() {
  const { damage, gearBonus, workshop, skills, maxHp, echo, sets, pets } =
    combatLoadout(s, equippedGear());
  const active = Object.entries(sets)
    .filter(([, count]) => count >= 2)
    .map(([id]) => combatSets[id].name);
  const assists = {
    strike: "strike",
    heal: "Guard heal",
    break: "armor damage",
  };
  return `<p><strong>${damage} base damage</strong> · ${maxHp} HP · +${6 + echo} base riposte damage</p>
    <p class="subtext">Damage · 4 base + ${gearBonus} gear + ${workshop} Workshop + ${skills} skills</p>
    <p class="subtext">Active sets · ${active.join(", ") || "None"}</p>
    <p class="subtext">Pet assists · ${pets.map((p) => assists[p.role]).join(", ") || "None assigned"}</p>`;
}

function boardMarkup() {
  const local = Object.keys(bosses).filter(
    (id) => bosses[id].world === s.world,
  );
  if (!local.includes(selected)) selected = local[0];
  const active = s.combat.attempt;
  const cards = local
    .map((id) => {
      const def = bosses[id];
      const record = s.combat.records[id];
      const access = bossAccess(s, id) ? "Available" : "Locked";
      const status = record ? access + " · Trophy earned" : access;
      return `<button class="boss-card" data-boss-select="${id}" aria-pressed="${selected === id}" style="--boss-color:${def.color}">
      ${bossSprite(id)}<span><strong>${def.name}</strong><small>${status}</small></span></button>`;
    })
    .join("");
  const def = bosses[selected];
  const requirement = bossAccess(s, selected)
    ? ""
    : `<p class="subtext">${fmtExact(def.at)} coins earned this run${def.requires ? " · Defeat " + bosses[def.requires].name + " this run" : ""}</p>`;
  const reward = s.combat.clears[selected]
    ? "First-clear gear earned this run"
    : "First clear this run · " + rewardName(selected);
  const pending = Object.keys(bosses).filter(
    (id) => s.combat.clears[id] === "unclaimed",
  );
  const trophies = Object.entries(bosses)
    .filter(([id]) => s.combat.records[id])
    .map(([id, boss]) => {
      const { wins, best } = s.combat.records[id];
      return `<li><strong>${boss.title}</strong> · ${boss.name} · ${fmtExact(wins)} wins · Best ${timeLabel(best)}</li>`;
    })
    .join("");
  return `<p class="subtext">${worlds[s.world].name} · Challenge a boss with your current gear, skills, and field companions.</p>
    <div class="boss-roster">${cards}</div>
    <article class="up-card boss-detail">
      <h3>${def.name}</h3><p>${def.intro}</p>${requirement}
      <p>${fmtExact(def.hp)} HP · ${reward}</p>
      <button class="action gold" data-boss-start="${selected}" ${active || !bossAccess(s, selected) ? "disabled" : ""}>Start fight</button>
      ${active ? '<button class="action secondary" data-close="1">Resume current fight</button>' : ""}
    </article>
    <section class="boss-loadout"><h3>Combat loadout</h3>${loadoutMarkup()}</section>
    ${
      pending.length
        ? `<section class="boss-claims"><h3>Unclaimed gear</h3>${pending
            .map(
              (id) =>
                `<button class="action gold" data-boss-claim="${id}">Claim ${rewardName(id)}</button>`,
            )
            .join("")}</section>`
        : ""
    }
    <details class="gear-sets"><summary>Boss trophies</summary>${trophies ? `<ul>${trophies}</ul>` : '<p class="subtext">Defeat a boss to earn its trophy.</p>'}</details>
    <p class="subtext" id="bossMessage" role="status"></p>`;
}

function renderBossBoard() {
  $("modalBody").innerHTML = boardMarkup();
  setText($("bossMessage"), boardMessage);
}

function selectBoss(id) {
  if (!Object.hasOwn(bosses, id) || bosses[id].world !== s.world) return;
  selected = id;
  boardMessage = "";
  renderBossBoard();
  $("modalBody")
    .querySelector(`[data-boss-select="${id}"]`)
    ?.focus({ preventScroll: true });
}

function prepareFight(id) {
  if (!startFight(s, id, equippedGear())) return false;
  resetCombatView();
  setText($("combatStatus"), "Fight started.");
  renderCombatField();
  sound("combatStart");
  return true;
}

function claimFightReward(id) {
  const item = claimBossGear(s, id);
  boardMessage = item
    ? itemName(item) + " added to your gear bag."
    : "Free a slot in your gear bag to claim this reward.";
  renderBossBoard();
  ($("modalBody").querySelector("[data-boss-claim]") || $("close")).focus({
    preventScroll: true,
  });
  if (item) sound("chest");
  return item;
}

function resetCombatClock() {
  lastTick = performance.now();
}

function resetCombatView() {
  result = null;
  boardMessage = "";
  $("combatEffects").replaceChildren();
  for (const id of spriteIds) {
    const sprite = $(id);
    delete sprite.dataset.boss;
    sprite.classList.remove("combat-hit", "combat-finish", "combat-enter");
  }
  setText($("combatStatus"), "");
  resetCombatClock();
}

function resetBossSelection() {
  selected = "";
  resetCombatView();
}

function syncCombat(now = performance.now()) {
  const elapsed = lastTick === undefined ? 0 : Math.max(0, now - lastTick);
  lastTick = now;
  if (!s.combat.attempt || document.hidden || runtime.modalType || !elapsed)
    return;
  const events = advanceFight(s, elapsed);
  runtime.saveDirty = true;
  showCombatEvents(events);
  renderCombatField();
  if (!s.combat.attempt) save();
}

function tryGuard() {
  if (document.hidden || runtime.modalType) return;
  syncCombat();
  if (!guardFight(s)) return;
  setText($("combatStatus"), "Guard ready.");
  renderCombatField();
  sound("combatGuard");
  save();
}

function leaveFight() {
  if (!retreatFight(s)) return;
  resetCombatView();
  renderCombatField();
  $("press").focus();
  save();
}

function renderCombatField() {
  const enabled = s.total >= milestones.combat;
  setValue($("bosses"), "hidden", !enabled);
  const a = s.combat.attempt;
  const panel = $("combatPanel");
  const shown = Boolean(a || result);
  setValue(panel, "hidden", !shown);
  setValue($("combatActor"), "hidden", !shown);
  if (!shown) return;
  const id = a?.id || result.id;
  const def = bosses[id];
  for (const spriteId of spriteIds) {
    const sprite = $(spriteId);
    if (sprite.dataset.boss === id) continue;
    sprite.dataset.boss = id;
    sprite.innerHTML = bossSprite(id);
    sprite.classList.add("combat-enter");
  }
  setText($("combatName"), def.name);
  setValue($("combatGuard"), "hidden", !a);
  setValue($("combatRetreat"), "hidden", !a);
  setValue($("combatDone"), "hidden", Boolean(a));
  setValue($("combatDismiss"), "hidden", Boolean(a));
  setValue($("combatMeters"), "hidden", !a);
  setValue($("combatWarnTime"), "hidden", !a);
  if (!a) {
    setText(
      $("combatTell"),
      result.type === "victory"
        ? result.reward
          ? "Victory! Claim gear at the Boss Board."
          : "Victory! Rematch recorded."
        : "Defeated. You can try again from the Boss Board.",
    );
    return;
  }
  const move = currentMove(a);
  const warning = a.mode === "warn";
  const meters = [
    ["bossHp", a.hp, def.hp],
    ["playerHp", a.playerHp, a.loadout.maxHp],
  ];
  for (const [name, value, max] of meters) {
    setValue($(name), "max", max);
    setValue($(name), "value", value);
    setText($(name + "Text"), value + " / " + max);
  }
  const vent =
    !warning && move.kind === "vent" ? " · Heat " + a.heat + "/8" : "";
  setText(
    $("combatTell"),
    warning
      ? move.name + (a.guarded ? " · Guard ready" : "")
      : (a.exposed > 0 ? "Exposed · strike now" : "Opening") + vent,
  );
  setText($("combatWarnTime"), timeLabel(Math.ceil(a.remaining / 100) * 100));
  setValue($("combatGuard"), "disabled", !warning || a.guarded || !move.damage);
  panel.classList.toggle("combat-warning", warning && Boolean(move.damage));
}

function effectLabel(label, style) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = $("combatEffects");
  if (layer.childElementCount >= 8) layer.firstElementChild.remove();
  const el = document.createElement("span");
  el.className = "combat-number " + style;
  el.textContent = label;
  layer.append(el);
  setTimeout(() => el.remove(), 600);
}

function showCombatEvents(events) {
  for (const event of events) {
    if (event.type === "strike") {
      effectLabel("−" + event.amount, "combat-damage");
      for (const id of spriteIds) {
        const sprite = $(id);
        if (sprite.classList.contains("combat-hit")) continue;
        sprite.classList.add("combat-hit");
        setTimeout(() => sprite.classList.remove("combat-hit"), 110);
      }
    } else if (event.type === "hurt") {
      effectLabel("−" + event.amount + " HP", "combat-hurt");
      setText($("combatStatus"), "You took " + event.amount + " damage.");
      sound("combatHurt");
    } else if (event.type === "block") {
      effectLabel(
        event.amount ? "Block · +" + event.amount + " HP" : "Blocked!",
        "combat-block",
      );
      setText($("combatStatus"), "Blocked. Riposte ready.");
      sound("combatGuard");
    } else if (event.type === "warning") {
      setText($("combatStatus"), event.name);
    } else if (event.type === "interrupt") {
      setText($("combatStatus"), "Pounce interrupted. Strike while exposed.");
      effectLabel("Interrupted", "combat-block");
    } else if (event.type === "bossHeal") {
      effectLabel("+" + event.amount + " boss HP", "combat-block");
    } else if (event.type === "victory" || event.type === "defeat") {
      result = event;
      selected = event.id;
      for (const id of spriteIds) $(id).classList.add("combat-finish");
      $("combatPanel").classList.remove("combat-warning");
      setText(
        $("combatStatus"),
        event.type === "victory" ? "Boss defeated." : "You were defeated.",
      );
      if (event.type === "victory") {
        effectLabel("Victory!", "combat-block");
        sound("combatWin");
      }
    }
  }
}

export {
  claimFightReward,
  leaveFight,
  prepareFight,
  renderBossBoard,
  renderCombatField,
  resetBossSelection,
  resetCombatClock,
  resetCombatView,
  selectBoss,
  showCombatEvents,
  syncCombat,
  tryGuard,
};
