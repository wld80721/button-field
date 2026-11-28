import { render } from "./field.js";
import { drawMeadowTool, meadowRenderer } from "./meadowbrook-art.js";
import { blocked, mapHeight, mapWidth, pathTo, tileSize } from "./meadowbrook-map.js";
import {
  buyMeadowSeed, freshMeadowbrook, meadowCrops, meadowJournal, meadowTools,
  sellMeadowCrops, sleepAtMeadowbrook, workMeadowPlot,
} from "./meadowbrook.js";
import { fmtRate } from "./numbers.js";
import { runtime } from "./runtime.js";
import { save } from "./saves.js";
import { sound } from "./sound.js";
import { recordEarnings, s } from "./state.js";
import { setText, setValue } from "./ui-dom.js";

const directions = {
  left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1],
};
const keyDirections = {
  a: "left", d: "right", w: "up", s: "down",
  arrowleft: "left", arrowright: "right", arrowup: "up", arrowdown: "down",
};
const destinations = {
  home: { name: "Farmhouse", tile: [5, 5] },
  shop: { name: "Seed shop", tile: [25, 5] },
};
const seasons = ["Spring", "Summer", "Autumn", "Winter"];
const walkSpeed = 5.5;
let activeFarm;

function meadowMarkup() {
  const cropEntries = Object.entries(meadowCrops);
  return `<section class="meadowbrook" id="meadowbrook">
    <a class="meadow-skip" href="#meadowTools">Skip map to farming tools</a>
    <div class="meadow-hud" aria-label="Farm status">
      <span id="meadowDay"></span><span id="meadowTime"></span><span id="meadowWeather"></span>
      <span id="meadowCoins"></span><span id="meadowEnergy"></span>
    </div>
    <div class="meadow-layout">
      <div class="meadow-play">
        <div class="meadow-viewport">
          <div class="meadow-map">
            <canvas width="${mapWidth * tileSize}" height="${mapHeight * tileSize}" tabindex="0"
              id="meadowCanvas" aria-label="Meadowbrook farm map" aria-describedby="meadowHelp"></canvas>
            ${Object.entries(destinations).map(([id, { name }]) =>
              `<button type="button" class="meadow-pin meadow-${id}-pin" data-meadow-target="${id}">${name}</button>`).join("")}
          </div>
        </div>
        <div class="meadow-controls">
          <div class="meadow-directions" aria-label="Move farmer">
            ${Object.keys(directions).map((id, index) =>
              `<button type="button" data-meadow-direction="${id}" aria-label="Move ${id}">${["←", "→", "↑", "↓"][index]}</button>`).join("")}
          </div>
          <button type="button" class="action secondary" data-meadow-use>Use tool</button>
        </div>
        <div class="meadow-tools" id="meadowTools" role="group" aria-label="Farming tools" tabindex="-1">
          ${meadowTools.map((name, index) => `<button type="button" data-meadow-tool="${index}" aria-pressed="${index === 4}">
            <canvas width="24" height="24" aria-hidden="true"></canvas><span>${name}</span><kbd>${index + 1}</kbd>
          </button>`).join("")}
        </div>
        <label class="meadow-seed">Seed <select id="meadowSeed">${cropEntries.map(([id, crop]) => `<option value="${id}">${crop.name}</option>`).join("")}</select></label>
        <p class="meadow-notice" role="status" id="meadowNotice"></p>
        <p class="subtext meadow-help" id="meadowHelp">Tap a tile to walk there and use your tool. <span class="meadow-pan-help">Swipe the map to explore. </span>Focus the map for WASD or arrow keys, 1–6 for tools, and Space to use the selected tool.</p>
      </div>
      <aside class="meadow-sidebar">
        <section class="meadow-panel" id="meadowJournal">
          <h3>Farm journal</h3><strong id="meadowGoal"></strong><p id="meadowTask"></p><small id="meadowProgress"></small>
        </section>
        <section class="meadow-panel" id="meadowStock">
          <h3>Backpack</h3>
          <table><thead><tr><th scope="col">Crop</th><th scope="col">Seeds</th><th scope="col">Harvest</th></tr></thead>
            <tbody>${cropEntries.map(([id, crop]) => `<tr><th scope="row">${crop.name}</th><td data-meadow-seeds="${id}"></td><td data-meadow-crops="${id}"></td></tr>`).join("")}</tbody>
          </table>
          <button type="button" class="action gold" id="meadowSell">Sell crops</button>
        </section>
        <section class="meadow-panel" id="meadowService" aria-labelledby="meadowServiceTitle" hidden>
          <div class="meadow-panel-head"><h3 id="meadowServiceTitle"></h3><button type="button" class="action secondary" data-meadow-dismiss>Done</button></div>
          <div id="meadowServiceContent"></div>
        </section>
      </aside>
    </div>
  </section>`;
}

function mountMeadowbrook(root) {
  const firstVisit = !s.meadowbrook;
  const farm = s.meadowbrook ??= freshMeadowbrook();
  const find = (selector) => root.querySelector(selector);
  const canvas = find("#meadowCanvas");
  const view = find(".meadow-viewport");
  const paint = meadowRenderer(canvas);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const toolButtons = [...root.querySelectorAll("[data-meadow-tool]")];
  const status = find("#meadowNotice");
  const servicePanel = find("#meadowService");
  let tool = 4;
  let seed = "turnip";
  let facing = "down";
  let keys = new Set();
  let route = [];
  let pending;
  let selected;
  let service;
  let serviceFocus;
  let frame;
  let last = 0;
  let lastPaint = 0;
  let clock = 0;
  let anim = 0;
  let redraw = true;

  toolButtons.forEach((button, index) => drawMeadowTool(button.querySelector("canvas"), index));

  function refresh() {
    const season = seasons[Math.floor((farm.day - 1) / 28) % seasons.length];
    const hour = Math.floor(farm.time / 60);
    const mins = String(farm.time % 60).padStart(2, "0");
    setText(find("#meadowDay"), `Day ${farm.day} · ${season}`);
    setText(find("#meadowTime"), `${hour % 12 || 12}:${mins} ${hour < 12 ? "AM" : "PM"}`);
    setText(find("#meadowWeather"), farm.weather);
    setText(find("#meadowCoins"), `${fmtRate(s.coins)} coins`);
    setText(find("#meadowEnergy"), `${farm.energy}/100 energy`);
    const quest = meadowJournal[farm.quest];
    setText(find("#meadowGoal"), quest?.[0] ?? "Meadowbrook master");
    setText(find("#meadowTask"), quest?.[1] ?? "All journal goals completed.");
    setText(find("#meadowProgress"), quest ? `${Math.min(farm.progress[quest[2]], quest[3])}/${quest[3]} · +${quest[4]} coins` : "");
    for (const id of Object.keys(meadowCrops)) {
      setText(find(`[data-meadow-seeds="${id}"]`), farm.seeds[id]);
      setText(find(`[data-meadow-crops="${id}"]`), farm.bag[id]);
    }
    setValue(find("#meadowSell"), "disabled", !Object.values(farm.bag).some(Boolean));
    if (service === "shop") {
      for (const button of root.querySelectorAll("[data-meadow-buy]")) {
        const id = button.dataset.meadowBuy;
        const quantity = Number(button.dataset.quantity);
        setValue(button, "disabled", s.coins < meadowCrops[id].cost * quantity || farm.seeds[id] + quantity > 9999);
      }
    }
  }

  function announce(message) {
    setText(status, message);
  }

  function commit(before, message, cue = "tap") {
    recordEarnings(before);
    if (message) announce(message);
    sound(cue);
    redraw = true;
    refresh();
    render();
    save();
  }

  function chooseTool(index) {
    tool = index;
    toolButtons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === tool)));
  }

  function stopMoving() {
    keys = new Set();
    route = [];
    pending = null;
  }

  function closeService() {
    if (!service) return false;
    service = null;
    servicePanel.hidden = true;
    view.scrollIntoView({ block: "nearest" });
    (serviceFocus?.isConnected ? serviceFocus : canvas).focus({ preventScroll: true });
    return true;
  }

  function openService(id) {
    service = id;
    serviceFocus = document.activeElement;
    stopMoving();
    setText(find("#meadowServiceTitle"), destinations[id].name);
    find("#meadowServiceContent").innerHTML = id === "shop"
      ? Object.entries(meadowCrops).map(([key, crop]) => `<div class="meadow-shop-row">
          <div><b>${crop.name}</b><small>${crop.days} watered days · sells for ${crop.sell} coins</small></div>
          ${[1, 5].map((quantity) => `<button type="button" class="action secondary" data-meadow-buy="${key}" data-quantity="${quantity}"
              aria-label="Buy ${quantity} ${crop.name} seeds for ${crop.cost * quantity} coins">${quantity === 5 ? "×5 · " : ""}${crop.cost * quantity}</button>`).join("")}
        </div>`).join("")
      : '<p>Watered crops grow overnight. Sleep to restore your energy.</p><button type="button" class="action gold" data-meadow-sleep>Sleep until morning</button>';
    servicePanel.hidden = false;
    refresh();
    find("[data-meadow-dismiss]").focus();
  }

  function destinationAt(x, y) {
    if (x >= 3 && x <= 7 && y >= 2 && y <= 6) return "home";
    if (x >= 23 && x <= 27 && y >= 2 && y <= 7) return "shop";
    return null;
  }

  function useTile(x, y) {
    const destination = destinationAt(x, y);
    if (destination) {
      openService(destination);
      return;
    }
    const before = s.total;
    const result = workMeadowPlot(s, `${x},${y}`, tool, seed);
    if (result.changed) commit(before, result.message, tool === 4 ? "chest" : "tap");
    else announce(result.message);
  }

  function goTo(x, y) {
    if (service) return;
    const interact = Object.hasOwn(farm.plots, `${x},${y}`) || Boolean(destinationAt(x, y));
    const path = pathTo(farm.player, x, y, interact);
    if (!path) {
      announce("That tile is out of reach.");
      return;
    }
    stopMoving();
    selected = [x, y];
    redraw = true;
    route = path;
    if (interact && path.length) pending = selected;
    else if (interact) useTile(x, y);
  }

  function useFacingTile() {
    const [dx, dy] = directions[facing];
    stopMoving();
    selected = [Math.floor(farm.player.x) + dx, Math.floor(farm.player.y) + dy];
    redraw = true;
    useTile(...selected);
  }

  function move(dx, dy, distance) {
    const player = farm.player;
    if (Math.abs(dx) > Math.abs(dy)) facing = dx < 0 ? "left" : "right";
    else facing = dy < 0 ? "up" : "down";
    const length = Math.hypot(dx, dy);
    const x = player.x + dx * distance / length;
    const y = player.y + dy * distance / length;
    if (!blocked(Math.floor(x), Math.floor(player.y))) player.x = x;
    if (!blocked(Math.floor(player.x), Math.floor(y))) player.y = y;
    runtime.saveDirty = true;
  }

  function followPlayer(center = false) {
    const width = canvas.clientWidth;
    if (width <= view.clientWidth) return;
    const x = farm.player.x / mapWidth * width;
    const relative = x - view.scrollLeft;
    if (center || relative < 44 || relative > view.clientWidth - 44) {
      view.scrollLeft = Math.max(0, x - view.clientWidth / 2);
    }
  }

  function rest() {
    stopMoving();
    closeService();
    sleepAtMeadowbrook(farm);
    selected = null;
    clock = 0;
    commit(s.total, `Day ${farm.day} · ${farm.weather}`, "upgrade");
    followPlayer(true);
  }

  function frameLoop(now) {
    const delta = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    let moving = false;
    if (!document.hidden && !service) {
      const dx = Number(keys.has("right")) - Number(keys.has("left"));
      const dy = Number(keys.has("down")) - Number(keys.has("up"));
      if (dx || dy) {
        move(dx, dy, walkSpeed * delta);
        moving = true;
      } else if (route.length) {
        const [x, y] = route[0];
        const offsetX = x - farm.player.x;
        const offsetY = y - farm.player.y;
        if (Math.hypot(offsetX, offsetY) <= walkSpeed * delta + 0.02) {
          farm.player.x = x;
          farm.player.y = y;
          route.shift();
          runtime.saveDirty = true;
          if (!route.length && pending) {
            const target = pending;
            pending = null;
            useTile(...target);
          }
        } else move(offsetX, offsetY, walkSpeed * delta);
        moving = true;
      }
      clock += delta;
      if (clock >= 2.4) {
        clock -= 2.4;
        farm.time += 10;
        if (farm.time >= 1440) rest();
        else {
          runtime.saveDirty = true;
          refresh();
          redraw = true;
        }
      }
      anim += delta;
    }
    if ((redraw || moving || (!motion.matches && !service)) && now - lastPaint >= 33) {
      paint(farm, { anim, facing, moving, selected, reduced: motion.matches });
      if (moving) followPlayer();
      lastPaint = now;
      redraw = false;
    }
    frame = requestAnimationFrame(frameLoop);
  }

  canvas.addEventListener("click", (event) => {
    if (service) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * mapWidth);
    const y = Math.floor((event.clientY - rect.top) / rect.height * mapHeight);
    if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) goTo(x, y);
  }, options);
  canvas.addEventListener("keydown", (event) => {
    if (service || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    const direction = keyDirections[key];
    if (direction) {
      event.preventDefault();
      route = [];
      pending = null;
      keys.add(direction);
    } else if (key === " " && !event.repeat) {
      event.preventDefault();
      useFacingTile();
    } else if (/^[1-6]$/.test(key)) {
      event.preventDefault();
      chooseTool(Number(key) - 1);
    }
  }, options);
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && closeService()) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, options);
  window.addEventListener("keyup", (event) => keys.delete(keyDirections[event.key.toLowerCase()]), options);
  window.addEventListener("blur", stopMoving, options);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopMoving();
    last = 0;
  }, options);
  canvas.addEventListener("blur", () => keys.clear(), options);

  for (const button of root.querySelectorAll("[data-meadow-direction]")) {
    const direction = button.dataset.meadowDirection;
    button.addEventListener("pointerdown", (event) => {
      if (service || event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      stopMoving();
      keys.add(direction);
      move(...directions[direction], 0.22);
      followPlayer();
      redraw = true;
    }, options);
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(event, () => keys.delete(direction), options);
    }
    button.addEventListener("click", (event) => {
      if (service || event.detail) return;
      move(...directions[direction], 0.4);
      followPlayer();
      redraw = true;
    }, options);
  }

  root.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const { meadowTarget, meadowTool, meadowBuy, quantity } = button.dataset;
    if (meadowTarget) goTo(...destinations[meadowTarget].tile);
    else if (meadowTool !== undefined) chooseTool(Number(meadowTool));
    else if (button.hasAttribute("data-meadow-use") && !service) useFacingTile();
    else if (button.hasAttribute("data-meadow-dismiss")) closeService();
    else if (button.hasAttribute("data-meadow-sleep") && service === "home") rest();
    else if (meadowBuy && service === "shop" && buyMeadowSeed(s, meadowBuy, Number(quantity))) {
      seed = meadowBuy;
      setValue(find("#meadowSeed"), "value", seed);
      commit(s.total, `Bought ${quantity} ${meadowCrops[seed].name} seeds.`, "equip");
    } else if (button.id === "meadowSell") {
      const before = s.total;
      const result = sellMeadowCrops(s);
      if (result.changed) commit(before, result.message, "upgrade");
    }
  }, options);
  find("#meadowSeed").addEventListener("change", (event) => {
    seed = event.target.value;
    chooseTool(2);
  }, options);

  refresh();
  followPlayer(true);
  if (firstVisit) {
    announce("Three ripe turnips are ready. Tap them to harvest.");
    save();
  }
  paint(farm, { anim, facing, moving: false, reduced: motion.matches });
  frame = requestAnimationFrame(frameLoop);
  activeFarm = {
    refresh,
    close() {
      abort.abort();
      cancelAnimationFrame(frame);
      if (runtime.saveDirty) save();
    },
  };
}

function refreshMeadowbrook() {
  activeFarm?.refresh();
}

function unmountMeadowbrook() {
  activeFarm?.close();
  activeFarm = null;
}

export { meadowMarkup, mountMeadowbrook, refreshMeadowbrook, unmountMeadowbrook };
