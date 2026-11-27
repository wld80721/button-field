import { clamp, rarity } from "./data.js";
import { gearIcon } from "./sprites.js";
import { itemName, itemStat, s } from "./state.js";
import { $ } from "./ui-dom.js";
import { worlds } from "./world-data.js";

let terrainWorld;
let toastTimer;

function terrain() {
  const c = $("terrain"),
    b = $("board"),
    w = b.clientWidth,
    h = b.clientHeight;
  const W = Math.max(120, Math.floor(w / 3)),
    H = Math.max(100, Math.floor(h / 3));
  if (c.width === W && c.height === H && terrainWorld === s.world) return;
  const traveled = terrainWorld !== undefined && terrainWorld !== s.world;
  terrainWorld = s.world;
  const style = worlds[s.world].terrain;
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  let seed = 74821;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const T = 16,
    cols = Math.ceil(W / T),
    rows = Math.ceil(H / T);
  g.fillStyle = "#173d43";
  g.fillRect(0, 0, W, H);
  const colors = style?.tiles || [
    "#23744d",
    "#268452",
    "#2b9853",
    "#37a853",
    "#45b65a",
    "#58bc63",
    "#2c8b55",
  ];
  const edges = style?.edges || ["#244b4e", "#1d4149", "#285657"];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      let edge = Math.min(x, y, cols - x - 1, rows - y - 1);
      const cx = x * T,
        cy = y * T;
      const inside = edge > 0 && (edge > 1 || rand() > 0.28);
      g.fillStyle = inside
        ? colors[Math.floor(rand() * colors.length)]
        : edges[Math.floor(rand() * edges.length)];
      g.fillRect(cx, cy, T, T);
      g.fillStyle = inside ? "#ffffff08" : "#0a272b40";
      g.fillRect(cx, cy, T, 1);
      g.fillRect(cx, cy, 1, T);
      if (inside) {
        g.fillStyle = style?.grain || "#16503c44";
        for (let i = 0; i < 3; i++) {
          const px = cx + 2 + Math.floor(rand() * 12),
            py = cy + 2 + Math.floor(rand() * 12);
          g.fillRect(px, py, 1, 2);
        }
        if (rand() < 0.16) {
          let px = cx + 5 + Math.floor(rand() * 5),
            py = cy + 7;
          if (style) {
            g.fillStyle = style.mark;
            for (const [x, y, w, h] of style.shape)
              g.fillRect(cx + x, cy + y, w, h);
            g.fillStyle = style.shine;
            g.fillRect(px, py, 2, 2);
          } else {
            g.fillStyle = "#17583e";
            g.fillRect(px, py, 1, 4);
            g.fillRect(px - 2, py + 1, 1, 2);
            g.fillRect(px + 2, py, 1, 3);
            g.fillStyle = "#77d86c";
            g.fillRect(px, py, 1, 2);
          }
        }
        if (rand() < 0.04) {
          g.fillStyle = style?.shine || "#f6da91";
          g.fillRect(cx + 8, cy + 5, 2, 2);
          g.fillStyle = "#e9fff2";
          g.fillRect(cx + 7, cy + 4, 1, 1);
          g.fillRect(cx + 10, cy + 6, 1, 1);
        }
      }
    }
  g.fillStyle = style?.border || "#0e343c";
  for (let x = 0; x < W; x += 4) {
    let z = Math.floor(rand() * 4) + 1;
    g.fillRect(x, 0, 4, z);
    g.fillRect(x, H - z, 4, z);
  }
  for (let y = 0; y < H; y += 4) {
    let z = Math.floor(rand() * 4) + 1;
    g.fillRect(0, y, z, 4);
    g.fillRect(W - z, y, z, 4);
  }
  if (traveled && !matchMedia("(prefers-reduced-motion: reduce)").matches)
    c.animate([{ opacity: 0.65 }, { opacity: 1 }], {
      duration: 360,
      easing: "ease-out",
    });
}
function initFieldEffects() {
  new ResizeObserver(terrain).observe($("board"));
}
function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 2400);
}
function directionalFloat(text, bonus) {
  const el = document.createElement("span"),
    board = $("board").getBoundingClientRect(),
    button = $("press").getBoundingClientRect(),
    angle = Math.random() * Math.PI * 2,
    dist = 65 + Math.random() * Math.min(105, board.width * 0.15);
  el.className = "float directional" + (bonus ? " world-bonus" : "");
  el.textContent = text;
  el.style.cssText = `left:${((button.left + button.width / 2 - board.left) / board.width) * 100}%;top:${((button.top + button.height / 2 - board.top) / board.height) * 100}%;--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist}px`;
  $("effects").append(el);
  setTimeout(() => el.remove(), 850);
}
function burst(x, y, color) {
  const particles = document.createDocumentFragment();
  for (let k = 0; k < 12; k++) {
    const el = document.createElement("i");
    el.className = "particle";
    const ang = (k * Math.PI) / 6,
      len = 15 + Math.random() * 50;
    el.style.cssText = `left:${x}%;top:${y}%;--c:${color};--dx:${Math.cos(ang) * len}px;--dy:${Math.sin(ang) * len}px`;
    particles.append(el);
  }
  const batch = [...particles.children];
  $("effects").append(particles);
  setTimeout(() => batch.forEach((el) => el.remove()), 650);
}
function popGroundLoot(c, item) {
  const layer = $("effects"),
    w = layer.clientWidth,
    h = layer.clientHeight;
  const side = c.x > 65 ? -1 : c.x < 35 ? 1 : Math.random() < 0.5 ? -1 : 1;
  const dx = side * Math.min(86, w * 0.12),
    dy = Math.min(38, h * 0.065) * (c.y > 65 ? -1 : 1);
  const x = clamp(c.x + (dx / w) * 100, 10, 88),
    y = clamp(c.y + (dy / h) * 100, 18, 76);
  const el = document.createElement("div");
  el.className = "ground-loot";
  el.style.cssText = `left:${x}%;top:${y}%;--rarity:${rarity[item.r].color};--from-x:${((c.x - x) * w) / 100}px;--from-y:${((c.y - y) * h) / 100}px`;
  el.innerHTML = `<div class="ground-shadow"></div><div class="ground-sprite">${gearIcon(item)}</div><div class="ground-label">${itemName(item)}<small>${itemStat(item)}</small></div>`;
  layer.append(el);
  setTimeout(() => el.remove(), 2650);
}

export {
  burst,
  directionalFloat,
  initFieldEffects,
  popGroundLoot,
  terrain,
  toast,
  toastTimer,
};
