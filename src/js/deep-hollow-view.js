import { hollowRenderer, oreSprite } from "./deep-hollow-art.js";
import { T, goals, hollowWorld, ores } from "./deep-hollow-map.js";
import {
  bankHollowCopper, finishHollowTile, freshDeepHollow, hollowAtCamp,
  hollowCapacity, hollowCount, hollowDepth, hollowGoalValue, hollowTarget,
  hollowUpgrades, hollowValue, rideHollowLift, sellHollowHaul, upgradeHollow,
} from "./deep-hollow.js";
import { render } from "./field.js";
import { fmtRate } from "./numbers.js";
import { runtime } from "./runtime.js";
import { save } from "./saves.js";
import { sound } from "./sound.js";
import { recordEarnings, s } from "./state.js";
import { setText, setValue } from "./ui-dom.js";

const directions = {
  left: [-1, 0], up: [0, -1], down: [0, 1], right: [1, 0],
};
const keysFor = {
  arrowleft: "left", a: "left", arrowup: "up", w: "up",
  arrowdown: "down", s: "down", arrowright: "right", d: "right",
};
const zones = [
  [80, "The Deep Core"], [62, "Ruby Abyss"], [42, "Crystal Caverns"],
  [25, "Gilded Strata"], [12, "Iron Veins"], [1, "Copper Ridge"], [0, "Hollow Camp"],
];
const upgradeLabels = { pick: "Pickaxe", bag: "Backpack", lamp: "Lantern" };

let activeHollow;

function hollowMarkup() {
  return `<section class="hollow" id="deepHollow">
    <div class="hollow-hud" aria-label="Mining status">
      <span id="hollowZone"></span><span id="hollowDepth"></span><span id="hollowBest"></span><span id="hollowCoins"></span>
    </div>
    <div class="hollow-layout">
      <div class="hollow-play">
        <div class="hollow-map"><canvas id="hollowCanvas" width="480" height="320" tabindex="0" aria-label="Deep Hollow mine" aria-describedby="hollowHelp"></canvas></div>
        <div class="hollow-controls">
          <div class="hollow-directions" role="group" aria-label="Dig or move">
            ${Object.keys(directions).map((name, index) => `<button type="button" data-hollow-direction="${name}" aria-label="Dig or move ${name}">${["←", "↑", "↓", "→"][index]}</button>`).join("")}
          </div>
          <button type="button" class="action secondary" id="hollowLift"></button>
        </div>
        <p id="hollowNotice" class="hollow-notice" role="status"></p>
        <p id="hollowHelp" class="subtext">Tap to dig one tile or hold to keep digging. Focus the mine for arrows or WASD, R for the lift, and E to sell at camp.</p>
      </div>
      <aside class="hollow-sidebar">
        <section class="hollow-panel">
          <h3>Guild contract</h3><strong id="hollowGoal"></strong><p id="hollowTask"></p><small id="hollowProgress"></small>
        </section>
        <section class="hollow-panel">
          <div class="hollow-panel-head"><h3>Ore haul</h3><span id="hollowCapacity"></span></div>
          <dl class="hollow-ores" aria-label="Carried ore">${ores.map((ore) => `<div>
            <dt><canvas width="16" height="16" data-hollow-icon="${ore.id}" aria-hidden="true"></canvas>${ore.name}</dt>
            <dd data-hollow-ore="${ore.id}">0</dd></div>`).join("")}</dl>
          <label>Camp trade <select id="hollowTrade"><option value="sell">Sell haul for coins</option><option value="bank">Bank copper for crafting</option></select></label>
          <button type="button" class="action gold" id="hollowTradeAction"></button>
          <small id="hollowTradeHint"></small>
        </section>
        <section class="hollow-panel">
          <h3>Camp upgrades</h3>
          ${Object.keys(hollowUpgrades).map((id) => `<div class="hollow-upgrade">
            <span><strong data-hollow-name="${id}"></strong><small data-hollow-detail="${id}"></small></span>
            <button type="button" class="action secondary" data-hollow-upgrade="${id}" aria-label="Upgrade ${upgradeLabels[id].toLowerCase()}"></button>
          </div>`).join("")}
        </section>
      </aside>
    </div>
  </section>`;
}

function mountDeepHollow(root) {
  const firstVisit = !s.deepHollow;
  const mine = s.deepHollow ??= freshDeepHollow();
  const board = hollowWorld(mine.seed, mine.cleared);
  const find = (selector) => root.querySelector(selector);
  const canvas = find("#hollowCanvas");
  const renderer = hollowRenderer(canvas, mine, board);
  const abort = new AbortController();
  const listen = { signal: abort.signal };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const status = find("#hollowNotice");
  const trade = find("#hollowTrade");
  const tradeAction = find("#hollowTradeAction");
  const lift = find("#hollowLift");
  const oreLabels = ores.map(({ id }) => find(`[data-hollow-ore="${id}"]`));
  const upgradeRows = Object.entries(hollowUpgrades).map(([id, def]) => ({
    id, def, name: find(`[data-hollow-name="${id}"]`), detail: find(`[data-hollow-detail="${id}"]`),
    button: find(`[data-hollow-upgrade="${id}"]`),
  }));
  let pointer;
  let queued;
  const keys = new Map();
  let target;
  let blockedMessage = "";
  let last = 0;
  let clock = 0;
  let walk = -1;
  let delay = 0;
  let lastPaint = 0;
  let frame;
  let face = 1;
  let shake = 0;
  let particles = [];
  let repaint = true;
  let cameraUntil = 0;

  root.querySelectorAll("[data-hollow-icon]").forEach((icon) =>
    oreSprite(icon.getContext("2d"), Number(icon.dataset.hollowIcon), 0, 0));

  function refresh() {
    const atCamp = hollowAtCamp(mine);
    const depth = hollowDepth(mine.y);
    const best = hollowDepth(mine.deep.y);
    const count = hollowCount(mine);
    const goal = goals[mine.goal];
    setText(find("#hollowZone"), zones.find(([level]) => depth >= level)[1]);
    setText(find("#hollowDepth"), `Depth ${depth} m`);
    setText(find("#hollowBest"), `Best ${best} m`);
    setText(find("#hollowCoins"), `${fmtRate(s.coins)} coins`);
    setText(find("#hollowCapacity"), `${count}/${hollowCapacity(mine)}`);
    setText(find("#hollowGoal"), goal?.name ?? "Legend of the Hollow");
    setText(find("#hollowTask"), goal?.text ?? "All guild contracts completed.");
    setText(find("#hollowProgress"), goal ? `${Math.min(goal.n, hollowGoalValue(mine, goal))}/${goal.n} · +${goal.reward} coins` : "");
    oreLabels.forEach((label, i) => setText(label, mine.inv[i]));
    const bank = trade.value === "bank";
    setText(tradeAction, bank ? `Bank ${mine.inv[0]} copper` : `Sell haul · +${hollowValue(mine)} coins`);
    setValue(tradeAction, "disabled", !atCamp || !(bank ? mine.inv[0] : count));
    setText(find("#hollowTradeHint"), atCamp ? "" : "Return to camp to trade and upgrade.");
    setText(lift, atCamp ? (best ? `Lift to ${best} m` : "Lift") : "Lift to camp");
    setValue(lift, "disabled", atCamp && !best);
    for (const { id, def, name, detail, button } of upgradeRows) {
      const level = mine[id];
      const cost = def.costs[level];
      setText(name, def.names[level]);
      setText(detail, def.detail(level));
      setText(button, cost === undefined ? "Max" : `${cost} coins`);
      setValue(button, "disabled", !atCamp || cost === undefined || s.coins < cost);
    }
  }

  function stop() {
    pointer = null;
    queued = null;
    keys.clear();
    target = null;
    blockedMessage = "";
    repaint = true;
  }

  function commit(before, message, cue) {
    recordEarnings(before);
    if (message) setText(status, message);
    if (cue) sound(cue);
    repaint = true;
    render();
    save();
  }

  function contractText(reward) {
    return reward ? ` Contract rewards +${reward} coins.` : "";
  }

  function useTrade() {
    const before = s.total;
    if (trade.value === "bank") {
      const copper = bankHollowCopper(s);
      if (copper) commit(before, `Banked ${copper} Copper Ore for crafting.`, "equip");
    } else {
      const result = sellHollowHaul(s);
      if (result) commit(before, `Sold the haul for ${result.coins} coins.` + contractText(result.reward), "upgrade");
    }
  }

  function useLift() {
    if (!rideHollowLift(mine)) return;
    stop();
    renderer.center();
    commit(s.total, hollowAtCamp(mine) ? "Back at Hollow Camp." : `Lift arrived at ${hollowDepth(mine.y)} m.`, "menu");
  }

  function burst(x, y, id) {
    if (reduced.matches) return;
    const color = ores[id - 3]?.color ?? "#99724e";
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: x * T + T / 2, y: y * T + T / 2,
        vx: (Math.random() - 0.5) * 64, vy: -Math.random() * 52,
        life: 0.24 + Math.random() * 0.25, size: 2, col: color,
      });
    }
    shake = 2;
  }

  function tick(delta) {
    delay = Math.max(0, delay - delta);
    const direction = pointer?.direction ?? [...keys.values()].at(-1) ?? queued;
    const next = direction && hollowTarget(mine, board, ...directions[direction]);
    if (!next) {
      if (target) repaint = true;
      target = null;
      queued = null;
      return;
    }
    const [dx] = directions[direction];
    if (dx) face = dx;
    if (next.blocked) {
      const key = `${next.x},${next.y}`;
      if (blockedMessage !== key) setText(status, "Backpack full. Take the lift to camp to trade.");
      blockedMessage = key;
      target = { ...next, progress: 0 };
      queued = null;
      repaint = true;
      return;
    }
    blockedMessage = "";
    if (delay) return;
    if (!target || target.x !== next.x || target.y !== next.y || target.blocked) target = { ...next, progress: 0 };
    target.progress += target.seconds ? delta / target.seconds : 1;
    repaint = true;
    if (target.progress < 1) return;
    const before = s.total;
    const result = finishHollowTile(s, board, target);
    queued = null;
    target = null;
    if (!result) return;
    walk = clock;
    cameraUntil = clock + 0.28;
    delay = 0.115;
    runtime.saveDirty = true;
    if (result.id) burst(next.x, next.y, result.id);
    const ore = ores[result.id - 3];
    const message = ore ? `Mined ${ore.name}.` : "";
    if (ore || result.reward) commit(before, message + contractText(result.reward), "hollowOre");
    else {
      if (result.id) sound("hollowChip");
      refresh();
    }
  }

  function loop(now) {
    const delta = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!document.hidden) {
      clock += delta;
      tick(delta);
      shake = Math.max(0, shake - delta * 10);
      for (const particle of particles) {
        particle.life -= delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vy += 100 * delta;
      }
      particles = particles.filter((particle) => particle.life > 0);
      if ((repaint || particles.length || clock < cameraUntil) && now - lastPaint >= 30) {
        renderer.paint({ dt: Math.max(delta, (now - lastPaint) / 1000), clock, walk, face, shake, particles, mine: target, reduced: reduced.matches });
        repaint = false;
        lastPaint = now;
      }
    }
    frame = requestAnimationFrame(loop);
  }

  function canvasDirection(event) {
    const [x, y] = renderer.tileAt(event.clientX, event.clientY);
    const dx = x - mine.x, dy = y - mine.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
    if (dy) return dy < 0 ? "up" : "down";
    return null;
  }

  function pointerStart(event, direction) {
    if (!direction || event.button !== 0 || pointer) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, direction };
    queued = direction;
  }

  function pointerEnd(event) {
    if (pointer?.id !== event.pointerId) return;
    pointer = null;
    if (event.type !== "pointerup") {
      queued = null;
      target = null;
      repaint = true;
    }
  }

  canvas.addEventListener("pointerdown", (event) => {
    canvas.focus({ preventScroll: true });
    pointerStart(event, canvasDirection(event));
  }, listen);
  canvas.addEventListener("pointermove", (event) => {
    if (pointer?.id !== event.pointerId) return;
    const direction = canvasDirection(event);
    if (direction && direction !== pointer.direction) {
      pointer.direction = direction;
      queued = direction;
    }
  }, listen);
  for (const button of root.querySelectorAll("[data-hollow-direction]")) {
    const direction = button.dataset.hollowDirection;
    button.addEventListener("pointerdown", (event) => pointerStart(event, direction), listen);
    button.addEventListener("click", (event) => {
      if (!event.detail) queued = direction;
    }, listen);
  }
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
    root.addEventListener(event, pointerEnd, listen);
  }
  canvas.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    const direction = Object.hasOwn(keysFor, key) && keysFor[key];
    if (direction) {
      event.preventDefault();
      if (event.repeat) return;
      keys.set(key, direction);
      queued = direction;
    } else if (!event.repeat && key === "r") useLift();
    else if (!event.repeat && key === "e" && trade.value === "sell") useTrade();
  }, listen);
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()), listen);
  canvas.addEventListener("blur", () => keys.clear(), listen);
  window.addEventListener("blur", stop, listen);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    last = 0;
  }, listen);
  trade.addEventListener("change", refresh, listen);
  tradeAction.addEventListener("click", useTrade, listen);
  lift.addEventListener("click", useLift, listen);
  for (const { id, def, button } of upgradeRows) {
    button.addEventListener("click", () => {
      if (upgradeHollow(s, id)) commit(s.total, `Equipped ${def.names[mine[id]]}.`, "equip");
    }, listen);
  }

  refresh();
  renderer.paint({ dt: 0, clock, walk, face, shake, particles, reduced: reduced.matches });
  if (firstVisit) {
    setText(status, "Dig down from the shaft. Copper lies just below camp.");
    save();
  }
  frame = requestAnimationFrame(loop);
  activeHollow = {
    refresh,
    close() {
      abort.abort();
      cancelAnimationFrame(frame);
      if (runtime.saveDirty) save();
    },
  };
}

function refreshDeepHollow() {
  activeHollow?.refresh();
}

function unmountDeepHollow() {
  activeHollow?.close();
  activeHollow = null;
}

export { hollowMarkup, mountDeepHollow, refreshDeepHollow, unmountDeepHollow };
