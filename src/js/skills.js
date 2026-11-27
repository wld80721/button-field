import { ascUpgrades, clamp, skills } from "./data.js";
import { toast } from "./effects.js";
import { render, replaceRun } from "./field.js";
import { skillLearnCost } from "./gameplay.js";
import {
  ascCoinGoal,
  ascensionCost,
  ascensionReward,
  performAscension,
} from "./prestige.js";
import { fmt, fmtExact } from "./numbers.js";
import {
  hasAscensionAccess,
  hasSkill,
  progressionThresholds,
} from "./progression.js";
import { runtime } from "./runtime.js";
import { save } from "./saves.js";
import { sound } from "./sound.js";
import { chestIcon, itemIcon, svg } from "./sprites.js";
import { s } from "./state.js";
import { $ } from "./ui-dom.js";

const skillById = (id) => skills.find((n) => n.id === id);
const owned = (id) => hasSkill(s, id);
const skillReady = (n) => n.req.every(owned);
const skillLevel = (n) => s.skills[n.id] || 0;
function skillPrice(n) {
  return skillLearnCost(s, n);
}
function skillState(n) {
  return owned(n.id) ? "owned" : skillReady(n) ? "ready" : "locked";
}
function treeBackground() {
  let seed = 5382;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let stars = "";
  for (let i = 0; i < 310; i++) {
    const x = Math.floor(rand() * 1000),
      y = Math.floor(rand() * 560),
      r = rand();
    stars +=
      r > 0.94
        ? `<path d="M${x - 4} ${y}h8m-4 -4v8" stroke="#c7d7ff" opacity=".45"/>`
        : `<rect x="${x}" y="${y}" width="${r > 0.6 ? 2 : 1}" height="${r > 0.6 ? 2 : 1}" fill="${r > 0.5 ? "#bdcafa" : "#fff4de"}" opacity="${(0.15 + rand() * 0.5).toFixed(2)}"/>`;
  }
  return `<svg class="tree-back" viewBox="0 0 1000 560" aria-hidden="true"><defs><pattern id="starGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#96a2bc" stroke-opacity=".14" stroke-width="1.5"/></pattern></defs><rect width="1000" height="560" fill="url(#starGrid)"/>${stars}</svg>`;
}
function treeEdges() {
  return skills
    .flatMap((n) =>
      n.req.map((id) => {
        const p = skillById(id);
        return `<line x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}" class="${owned(n.id) && owned(id) ? "owned" : owned(id) ? "ready" : ""}"/>`;
      }),
    )
    .join("");
}
function treeIcon(n) {
  if (n.id === "autoChest") return chestIcon(1);
  return n.id === "root"
    ? svg(
        '<path fill="#17232e" d="M11 2h10v7h9v12h-9v9H11v-9H2V9h9z"/><path fill="#88df68" d="M13 5h6v7h8v6h-8v9h-6v-9H5v-6h8z"/><path fill="#f2ffca" d="M14 12h4v7h-4z"/>',
      )
    : itemIcon(...n.icon);
}
function ascReward() {
  return ascensionReward(s);
}
function ascCost(u) {
  return ascensionCost(s, u);
}
function ascTabs() {
  return `<div class="tree-tabs"><button class="tree-tab ${runtime.treeTab === "skills" ? "active" : ""}" data-tree-tab="skills">Skill tree</button><button class="tree-tab ${runtime.treeTab === "ascend" ? "active" : ""}" data-tree-tab="ascend" ${hasAscensionAccess(s) ? "" : "hidden"}>✦ Ascend</button></div>`;
}
function ascMarkup() {
  const reward = ascReward(),
    next = ascCoinGoal(reward + 1),
    a = s.asc;
  return `${ascTabs()}<div class="asc-scroll"><div class="asc-shell"><div class="asc-banner"><div><h3>✦ ASCENSION</h3><p>Begin a new grove and turn this run's lifetime earnings into permanent Ascension Stars.</p><p><b>${fmt(s.total)} / ${fmt(next)} coins earned this run</b> · ${a.runs} ascensions</p><div class="asc-meter"><i style="width:${Math.min(100, (s.total / next) * 100)}%"></i></div><p>Next star at ${fmt(next)} coins · First ascension requires ${fmtExact(progressionThresholds.ascension)} coins.</p><div class="asc-rebirth"><button class="tree-buy" data-asc-start ${reward < 1 ? "disabled" : ""}>Ascend · +${fmt(reward)} ★</button><span>Lifetime multiplier: ×${(1 + a.earned * 0.15).toFixed(2)}</span></div><p class="asc-warning">Resets coins, gear, scrap, shards, normal skills, upgrades, chests, collection, world unlocks, field bonuses, wheel progress, farming and mining. Keeps Ascension Stars, permanent upgrades, and lifetime records. Companions keep their levels, training, evolutions, and artifacts. Field assignments and expeditions reset, including unclaimed rewards.</p>${runtime.ascConfirm ? `<div class="asc-confirm"><span>Start over and claim the stars shown above? Your field assignments and unclaimed expedition rewards will be cleared.</span><button class="tree-buy" data-asc-confirm>Confirm ascension</button><button class="tree-buy" data-asc-cancel>Cancel</button></div>` : ""}</div><div class="asc-crystal">✦ ${fmt(a.stars)}<small>AVAILABLE STARS</small><small>${fmt(a.earned)} EARNED ALL TIME</small></div></div><h3 class="asc-heading">Permanent constellation upgrades</h3><div class="asc-grid">${ascUpgrades
    .map((u) => {
      const lv = a.up[u.id],
        cost = ascCost(u),
        locked = a.runs < u.req;
      return `<article class="asc-card ${locked ? "locked" : ""}">${itemIcon(...u.icon)}<h4>${u.name}</h4><p>${u.desc}</p><span class="asc-level">Level ${lv} / ${u.max}</span><span class="requirement">${locked ? "Requires " + u.req + " ascensions" : "Persists through every reset"}</span><button class="tree-buy" data-asc-buy="${u.id}" ${locked || lv >= u.max || a.stars < cost ? "disabled" : ""}>${locked ? "Locked" : lv >= u.max ? "Max level" : "Upgrade · " + fmtExact(cost) + " ★"}</button></article>`;
    })
    .join(
      "",
    )}</div><p class="subtext">Lifetime coins generated: ${fmt(a.life)}. Earn stars by playing at your own pace; there are no time-limited bonuses.</p></div></div>`;
}
function refreshAsc() {
  const b = $("modalBody"),
    sc = b.querySelector(".asc-scroll"),
    y = sc?.scrollTop || 0;
  b.innerHTML = ascMarkup();
  b.querySelector(".asc-scroll").scrollTop = y;
}
function ascend() {
  if (!runtime.ascConfirm) return;
  const outcome = performAscension(s);
  if (!outcome) return;
  sound("ascend");
  const { run, stars } = outcome;
  run.notice = "Ascension complete! Permanent upgrades are active.";
  replaceRun(run);
  render();
  save();
  refreshAsc();
  toast("Ascended! +" + fmt(stars) + " stars");
}
function treeMarkup() {
  return `${ascTabs()}<div class="tree-map-scroll"><div class="tree-map">${treeBackground()}<svg class="tree-lines" viewBox="0 0 1000 560" aria-hidden="true">${treeEdges()}</svg>${skills.map((n) => `<button class="tree-node ${skillState(n)} ${n.id === runtime.selectedSkill ? "selected" : ""}" style="left:${n.x / 10}%;top:${n.y / 5.6}%" data-node="${n.id}" aria-label="${n.name}, ${skillState(n)}"><span class="node-core">${treeIcon(n)}</span><span class="node-tag">${n.id === "root" ? "✓" : owned(n.id) ? (n.max > 1 ? "Lv " + skillLevel(n) : "✓") : "+"}</span><span class="node-label">${n.name}</span></button>`).join("")}</div></div><div class="tree-info" id="treeInfo"></div>`;
}

let tipNode = null;
function hideSkillTip() {
  const tip = $("skillTooltip");
  if (tipNode) tipNode.removeAttribute("aria-describedby");
  tipNode = null;
  tip.hidden = true;
}
function showSkillTip(node) {
  if (
    runtime.modalType !== "skills" ||
    runtime.treeTab !== "skills" ||
    !node?.isConnected
  )
    return;
  const n = skillById(node.dataset.node);
  if (!n) return;
  const tip = $("skillTooltip"),
    lv = skillLevel(n),
    done = n.id === "root" || lv >= n.max,
    ready = skillReady(n),
    price = skillPrice(n),
    req = n.req
      .filter((id) => !owned(id))
      .map((id) => skillById(id).name)
      .join(", ");
  if (tipNode && tipNode !== node) tipNode.removeAttribute("aria-describedby");
  tipNode = node;
  node.setAttribute("aria-describedby", "skillTooltip");
  tip.innerHTML = `<h3>${n.name}</h3><p>${n.desc}</p><div class="tip-meta"><span>${n.id === "root" ? "Starting node" : "Level " + lv + " / " + n.max}</span><b class="${done || ready ? "tip-ready" : "tip-locked"}">${done ? "Learned" : fmtExact(price) + " shards"}</b></div>${!ready ? '<div class="tip-req">Requires: ' + req + "</div>" : !done && s.shards < price ? '<div class="tip-req">Not enough shards</div>' : ""}`;
  tip.hidden = false;
  const r = node.getBoundingClientRect(),
    w = tip.offsetWidth,
    h = tip.offsetHeight,
    pad = 10;
  let x = r.right + 12,
    y = r.top + r.height / 2 - h / 2;
  if (x + w > innerWidth - pad) x = r.left - w - 12;
  if (x < pad) {
    x = clamp(
      r.left + r.width / 2 - w / 2,
      pad,
      Math.max(pad, innerWidth - w - pad),
    );
    y = r.bottom + 12;
    if (y + h > innerHeight - pad) y = r.top - h - 12;
  }
  tip.style.left = clamp(x, pad, Math.max(pad, innerWidth - w - pad)) + "px";
  tip.style.top = clamp(y, pad, Math.max(pad, innerHeight - h - pad)) + "px";
}
function initSkillUI() {
  const treeBody = $("modalBody");
  treeBody.addEventListener("pointerover", (e) => {
    const n = e.target.closest("[data-node]");
    if (n && e.pointerType !== "touch" && !n.contains(e.relatedTarget))
      showSkillTip(n);
  });
  treeBody.addEventListener("pointerout", (e) => {
    const n = e.target.closest("[data-node]");
    if (n && tipNode === n && !n.contains(e.relatedTarget)) hideSkillTip();
  });
  treeBody.addEventListener("focusin", (e) => {
    const n = e.target.closest("[data-node]");
    if (n && n.matches(":focus-visible")) showSkillTip(n);
  });
  treeBody.addEventListener("focusout", (e) => {
    if (e.target === tipNode) hideSkillTip();
  });
  treeBody.addEventListener("scroll", hideSkillTip, true);
  window.addEventListener("resize", hideSkillTip);
}
function updateTree() {
  const n = skillById(runtime.selectedSkill) || skills[0],
    lv = skillLevel(n),
    max = n.id === "root" || lv >= n.max,
    ready = skillReady(n),
    price = skillPrice(n);
  const t = $("treeInfo");
  if (!t) return;
  const detailKey = [
    runtime.selectedSkill,
    s.shards,
    JSON.stringify(s.skills),
  ].join(":");
  if (t.dataset.key === detailKey) return;
  t.dataset.key = detailKey;
  const balance = `<div class="tree-balance">${itemIcon(3, 3)}<div>AVAILABLE SHARDS<b>${fmt(s.shards)}</b></div></div>`;
  const req = n.req
    .filter((id) => !owned(id))
    .map((id) => skillById(id).name)
    .join(", ");
  t.innerHTML =
    balance +
    `<div class="tree-detail"><h3>${n.name}${n.max > 1 ? " · Lv " + lv : ""}</h3><p>${n.desc}</p><small>${max ? "Fully unlocked" : !ready ? "Requires: " + req : s.shards < price ? "Not enough shards. Open chests to earn more." : "Ready to unlock"}</small></div><button class="tree-buy" data-learn="${n.id}" ${max || !ready || s.shards < price ? "disabled" : ""}>${max ? "Unlocked" : !ready ? "Locked" : "Unlock · " + fmtExact(price) + " shards"}</button>`;
  for (const b of $("modalBody").querySelectorAll("[data-node]")) {
    const k = skillById(b.dataset.node);
    b.className =
      "tree-node " +
      skillState(k) +
      (k.id === runtime.selectedSkill ? " selected" : "");
    b.setAttribute("aria-label", k.name + ", " + skillState(k));
    b.querySelector(".node-tag").textContent =
      k.id === "root"
        ? "✓"
        : owned(k.id)
          ? k.max > 1
            ? "Lv " + skillLevel(k)
            : "✓"
          : "+";
  }
  const lines = $("modalBody").querySelector(".tree-lines");
  if (lines) lines.innerHTML = treeEdges();
  if (tipNode) showSkillTip(tipNode);
}

export {
  ascCoinGoal,
  ascMarkup,
  ascReward,
  ascend,
  hideSkillTip,
  initSkillUI,
  owned,
  refreshAsc,
  skillById,
  treeMarkup,
  updateTree,
};
