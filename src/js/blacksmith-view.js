import { blueprints } from "./blacksmith-data.js";
import { beginWork, heatWork, markerAt, quenchWork, strikeWork } from "./blacksmith.js";
import { rarity } from "./data.js";
import { forgeMarkup } from "./equipment.js";
import { fieldSprite } from "./field-art.js";
import { materials } from "./sites.js";
import { gearIcon, itemIcon } from "./sprites.js";
import { sound } from "./sound.js";
import { itemName, level, s } from "./state.js";
import { $, setText, setValue } from "./ui-dom.js";

let work;
let frame;

const fixtures = {
  furnace: ["...111...", "...121...", "..11111..", ".1222221.", ".1211121.", "121333121", "121343121", "121444121", "122222221", ".1111111."],
  anvil: ["11111111...", "1222222211.", ".1333333321", "..12222221.", "....1211...", "...12221...", "..1111111.."],
  quench: [".1111111.", "133444331", "122222221", ".1232321.", ".1232321.", ".1222221.", "..11111.."],
  table: ["111111111", "122222221", "111111111", ".1211121.", ".1212121.", ".1211121."],
  rack: ["111111111", "122222221", "121343121", "121343121", "122222221", "121111121", "111111111"],
  bins: ["1111..1111", "1222112221", "1232112421", "1222112221", ".111..111."],
};
const pixels = ["none", "#211c29", "#b07954", "#ff8550", "#ffda8b"];

const fixtureDetail = {
  furnace: '<path fill="#df9b6d" d="M2 4h1v.5H2zm4 0h1v.5H6zM2 8h5v.35H2z"/><path fill="#f9a759" d="M3 6h.5v1H3zm2.5-.5H6V7h-.5z"/><path fill="#fff1a1" d="M4.5 7H5v.6h-.5z"/><path fill="#594047" d="M3.5 1h.5v2h-.5zM1 6h.5v2H1zm6.5 0H8v2h-.5z"/>',
  anvil: '<path fill="#d7d4cb" d="M1 1h7.5v.45H1zM2.5 2.1h7v.35h-7z"/><path fill="#41414e" d="M4.5 4.5h2v.35h-2zm-1 1h4v.35h-4z"/>',
  quench: '<path fill="#edfaff" d="M2 1.5h2v.25H2zm2.5-.2h2v.25h-2z"/><path fill="#604454" d="M1.5 3h6v.4h-6zm0 2h6v.4h-6z"/>',
  rack: '<path fill="#8c7967" d="M2 2h5v.35H2zM2 4.7h5v.35H2z"/><path fill="#c7d7d3" d="M3.25 2.5h.6v1.5h-.6zm1 1h1.2v.4h-1.2zM5.6 2.4h.7v1.2h-.7z"/>',
  table: '<path fill="#d5b581" d="M.8 1h7.4v.45H.8zm1 2.4h.4v2h-.4zM6.7 3.4h.4v2h-.4z"/><path fill="#a2c3c8" d="M5.9 .35h2v.4h-2z"/>',
  bins: '<path fill="#d4a165" d="M.6 1.2h2.8v.35H.6zm6 0h2.8v.35H6.6z"/><path fill="#f5d5a0" d="M2.1 2h.55v.55H2.1zm5 .2h.55v.55H7.1z"/>',
};

function fixture(key) {
  const rows = fixtures[key];
  return `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${rows.map((row, y) =>
    [...row].map((p, x) => p === "." ? "" : `<rect x="${x}" y="${y}" width="1" height="1" fill="${pixels[p]}" data-pixel="${p}"/>`).join("")
  ).join("")}${fixtureDetail[key]}</svg>`;
}

function station(id, title, attrs = "") {
  return `<button type="button" class="smith-station smith-${id}" id="smith-${id}" ${attrs}>${fixture(id)}<span>${title}</span></button>`;
}

function displayMarkup() {
  return fieldSprite("lantern") + [5, 6].map((grade) => {
    const piece = s.items.find((item) => item.r === grade);
    return piece ? gearIcon(piece) : "";
  }).join("");
}

function updateDisplay() {
  $("smithDisplay").innerHTML = displayMarkup();
}

function blacksmithMarkup(panel = "", resultId = "smithResult") {
  return `<section class="smith-room" id="smithRoom" aria-label="Blacksmith workshop">
    <div class="smith-wall" aria-hidden="true"></div>
    <div class="smith-beams" aria-hidden="true"></div>
    <div class="smith-banners" aria-label="Discovered blueprints">${Object.entries(blueprints).map(([id, def]) => `<span style="--plate:${def.color}" ${s.blacksmith.recipes.includes(id) ? "" : "hidden"}>${def.name}</span>`).join("")}</div>
    <div class="smith-display" id="smithDisplay" aria-hidden="true">${displayMarkup()}</div>
    ${station("furnace", "Heat", "data-smith-step=furnace disabled")}
    ${station("anvil", "Strike", "data-smith-step=anvil disabled")}
    ${station("quench", "Quench", "data-smith-step=quench disabled")}
    ${station("table", "Recipes", "data-open=recipes" + (s.total < 2500 ? ' aria-label="Recipes, unlocks at 2,500 earned"' : ""))}
    ${station("rack", "Equipment rack", "data-open=inventory")}
    <div class="smith-bins">${fixture("bins")}<span>Materials</span></div>
    <div id="smithPiece" class="smith-piece" hidden></div>
    <div class="smith-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
  </section>
  <div id="smithBench" class="smith-bench" hidden>
    <div id="smithMeter" class="smith-meter" aria-hidden="true" hidden><i id="smithTarget"></i><b id="smithMarker"></b></div>
    <p id="smithStatus" role="status"></p>
    <div class="actions"><label><input type="checkbox" id="smithAssist"> Timing assist</label><button class="action secondary" data-smith-step="cancel">Cancel work</button></div>
  </div>
  <p id="${resultId}" class="smith-result" role="status"></p>
  <p class="smith-wallet" id="smithWallet"></p>
  <div id="smithPanel">${panel || "<p>Choose equipment from the rack to temper or evolve. Discover recipes in the field and craft them at the table.</p>"}</div>`;
}

function refreshBlacksmith() {
  if (!$("smithWallet")) return;
  const stock = ["coins", "scrap", "shards", ...Object.keys(materials)]
    .filter((id) => s[id] || ["coins", "scrap", "shards"].includes(id));
  setText($("smithWallet"), stock.map((id) => `${Math.floor(s[id]).toLocaleString()} ${materials[id] ?? id}`).join(" · "));
}

function clearWork() {
  work = null;
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
}

function animateMarker(now) {
  if (!work || work.stage !== "anvil") return;
  $("smithMarker").style.transform = `translateX(${markerAt(work, now)}cqw)`;
  frame = requestAnimationFrame(animateMarker);
}

function drawWork(message) {
  const stage = work?.stage;
  $("smithRoom").dataset.stage = stage ?? "";
  for (const step of ["furnace", "anvil", "quench"])
    setValue($("smith-" + step), "disabled", stage !== step);
  for (const station of ["table", "rack"])
    setValue($("smith-" + station), "disabled", Boolean(work));
  $("smithBench").hidden = !work;
  $("smithPanel").hidden = Boolean(work);
  $("smithPiece").hidden = !work;
  if (!work) {
    $("smithPiece").replaceChildren();
    return;
  }
  const timing = stage === "anvil" && !$("smithAssist").checked;
  $("smithMeter").hidden = !timing;
  if (timing) {
    $("smithTarget").style.left = work.targets[work.struck] - work.band + "%";
    $("smithTarget").style.width = work.band * 2 + "%";
    if (frame === undefined) frame = requestAnimationFrame(animateMarker);
  } else if (frame !== undefined) {
    cancelAnimationFrame(frame);
    frame = undefined;
  }
  const goal = work.targets[work.struck];
  setText($("smithStatus"), message ?? (stage === "furnace" ? "Heat the workpiece in the furnace."
    : stage === "quench" ? "Quench the piece to pay and finish."
    : `Strike ${work.struck + 1} of ${work.targets.length} · ${goal < 50 ? "left" : goal > 50 ? "right" : "center"} target`));
}

function playStation(kind) {
  const room = $("smithRoom");
  room.classList.remove("smith-impact", "smith-finished");
  void room.offsetWidth;
  room.classList.add(kind === "quench" ? "smith-finished" : "smith-impact");
  sound({ furnace: "smithHeat", anvil: "smithStrike", quench: "smithQuench" }[kind]);
}

function handleBlacksmith(button) {
  const step = button.dataset.smithStep;
  if (!step && !button.dataset.forge && !button.dataset.evolve && !["craftGear", "craftGatheredGear"].includes(button.id)) return false;
  if (!$("smithRoom")) return true;
  const now = performance.now();
  if (!step && !work) {
    const kind = button.dataset.evolve ? "evolve" : button.dataset.forge ? "temper" : "craft";
    work = beginWork(s, {
      kind, id: Number(button.dataset.evolve || button.dataset.forge),
      set: $("recipeSet")?.value, slot: Number($("recipeSlot")?.value),
      gathered: ["craftGatheredGear", "temperGear"].includes(button.id),
    });
    if (work) {
      setText(document.querySelector(".smith-result"), "");
      $("smithPiece").innerHTML = work.item ? gearIcon(work.item) : itemIcon(work.slot, 2);
      $("smithAssist").checked = matchMedia("(prefers-reduced-motion: reduce)").matches;
      drawWork();
      $("smith-furnace").focus();
    }
  } else if (work && step === "cancel") {
    clearWork();
    drawWork();
    $("smith-rack").focus();
  } else if (work && step === "furnace" && heatWork(work, now)) {
    drawWork();
    playStation(step);
    $("smith-anvil").focus({ preventScroll: true });
  } else if (work && step === "anvil") {
    const hit = strikeWork(work, now, $("smithAssist").checked);
    drawWork(hit ? undefined : "Missed the target. Retry this strike.");
    if (hit) playStation(step);
    if (work.stage === "quench") $("smith-quench").focus({ preventScroll: true });
  } else if (work && step === "quench") {
    const previous = work.item && { ...work.item };
    const result = quenchWork(s, work, level());
    return { result, previous, kind: work.kind };
  }
  return true;
}

function finishBlacksmith({ result, previous, kind }) {
  clearWork();
  drawWork();
  if (result && kind === "evolve") $("smithPanel").innerHTML = forgeMarkup(result);
  const status = document.querySelector(".smith-result");
  if (!result) {
    setText(status, "Could not finish. Check materials, item, or bag space and try again.");
    $("smith-rack").focus();
    return;
  }
  const message = kind === "craft" ? "Crafted " + itemName(result) + "."
    : kind === "evolve" ? `Evolved ${itemName(result)} to ${rarity[result.r].name}.`
      : `Forged ${itemName(result)} to rank ${result.forge}.`;
  setText(status, message);
  $("smithPiece").innerHTML = (kind === "evolve" ? `<span aria-label="${rarity[previous.r].name}">${gearIcon(previous)}</span><b aria-hidden="true">›</b>` : "") +
    `<span aria-label="${rarity[result.r].name}">${gearIcon(result)}</span>`;
  $("smithPiece").hidden = false;
  if (kind === "evolve" && result.r >= 5) updateDisplay();
  $("smithRoom").dataset.stage = "finished";
  playStation("quench");
  $("smith-rack").focus({ preventScroll: true });
}

function updateTimingAssist() {
  if (work?.stage === "anvil") drawWork();
}

export { blacksmithMarkup, clearWork, finishBlacksmith, handleBlacksmith, refreshBlacksmith, updateTimingAssist };
