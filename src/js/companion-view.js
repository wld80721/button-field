import {
  artifacts,
  assignField,
  cancelTrip,
  claimTrip,
  companionsAt,
  cooldown,
  equipArtifact,
  evolutionCost,
  evolvePet,
  expeditionsAt,
  fieldSlots,
  petDuty,
  petLevel,
  restPet,
  roster,
  routeAccess,
  routes,
  secondFieldAt,
  secondTripAt,
  sendPet,
  specializePet,
  tripQuote,
  tripRemaining,
  tripSlots,
} from "./companions.js";
import { firstWorld } from "./world-data.js";
import { fmtExact } from "./numbers.js";
import { runtime } from "./runtime.js";
import { costText } from "./site-view.js";
import { hasMaterials } from "./sites.js";
import { s } from "./state.js";
import { $, setText, setValue } from "./ui-dom.js";

const seconds = (ms) => Math.ceil(ms / 1000) + "s";
const roles = { "": "Untrained", field: "Field Hand", scout: "Scout" };
const artCache = new Map();
const paintedMarkup = new WeakMap();

function petIcon(id, evolved = false) {
  const key = id + Boolean(evolved);
  if (artCache.has(key)) return artCache.get(key);
  const def = roster[id];
  const colors = [
    "#182332",
    def.color,
    evolved ? "#88f4ee" : "#fff5c9",
    "#fffaff",
  ];
  const paths = colors.map(() => "");
  for (const [y, row] of def.art.entries()) {
    for (let x = 0; x < row.length; x++) {
      const index = row[x];
      if (index !== ".") paths[index] += `M${x + 1} ${y + 2}h1v1h-1z`;
    }
  }
  const pixels = paths
    .map((path, index) =>
      path ? `<path fill="${colors[index]}" d="${path}"/>` : "",
    )
    .join("");
  const crest = evolved
    ? `<path fill="${def.color}" d="M5 0h1v1h1v1H4V1h1z"/><path fill="#fff6ad" d="M5 1h1v1H5zM0 2h1v1H0zm8 0h1v1H8z"/>`
    : "";
  const result = `<svg viewBox="0 0 10 9" class="pet-icon" shape-rendering="crispEdges" aria-hidden="true">${pixels}${crest}</svg>`;
  artCache.set(key, result);
  return result;
}

function companionMarkup() {
  return `<p class="subtext">Recruits join when their requirements are met. Field companions work while the field is open. Expeditions continue while you’re away.</p>
    <div class="pet-summary">
      <section aria-label="Field assignments"><h3>On the field</h3><div id="petSlots"></div></section>
      <section aria-label="Expedition assignments"><h3>Expeditions</h3><div id="petTrips"></div></section>
    </div>
    <div class="pet-management">
      <section aria-label="Pet roster"><h3>Roster</h3><div class="pet-roster" id="petRoster"></div></section>
      <section id="petProfile" class="up-card pet-profile" aria-label="Selected companion"></section>
    </div>
    <details class="gear-sets" id="petArtifacts"><summary>Artifacts</summary><div id="petArtifactList"></div></details>
    <p role="status" id="petMessage" class="subtext"></p>`;
}

function paint(node, html) {
  if (paintedMarkup.get(node) === html) return;
  const focused = document.activeElement;
  const attributes = focused?.dataset;
  const identity =
    focused && node.contains(focused) && attributes?.petCommand
      ? [attributes.petCommand, attributes.petArg]
      : null;
  paintedMarkup.set(node, html);
  node.innerHTML = html;
  if (identity) {
    const replacement = [...node.querySelectorAll("[data-pet-command]")].find(
      (el) =>
        (el.dataset.petCommand === identity[0] ||
          (identity[0] === "cancel" && el.dataset.petCommand === "claim")) &&
        el.dataset.petArg === identity[1] &&
        !el.disabled,
    );
    replacement?.focus({ preventScroll: true });
  }
}

function command(action, label, arg = "", disabled = false, primary = false) {
  return `<button class="action ${primary ? "gold" : "secondary"}" data-pet-command="${action}" data-pet-arg="${arg}" ${disabled ? "disabled" : ""}>${label}</button>`;
}

function safePetSelection() {
  const pets = s.companions.pets;
  if (!Object.hasOwn(roster, runtime.petSelected)) {
    runtime.petSelected = Object.keys(pets)[0] || "beetle";
  }
  return runtime.petSelected;
}

function renderCompanions(now = Date.now()) {
  setValue($("companions"), "hidden", s.world === firstWorld || s.total < companionsAt);
  updatePetField();
  if (runtime.modalType !== "companions") return;
  const camp = s.companions;
  const selected = safePetSelection();
  paint(
    $("petSlots"),
    camp.field
      .map((id, i) => {
        const available = i < fieldSlots(s);
        return `<div class="pet-assignment"><b>Slot ${i + 1}</b><span>${id ? roster[id].name : available ? "Empty" : fmtExact(secondFieldAt) + " coins earned"}</span>
      ${id ? command("select", "View", id) : ""}</div>`;
      })
      .join(""),
  );
  updatePetTrips(now);
  paint(
    $("petRoster"),
    Object.entries(roster)
      .map(([id, def]) => {
        const pet = camp.pets[id];
        const duty = pet ? petDuty(s, id) : null;
        const label = !duty
          ? "Locked"
          : duty.type === "field"
            ? "Field"
            : duty.type === "trip"
              ? "Away"
              : "Home";
        return `<button class="pet-card" data-pet-command="select" data-pet-arg="${id}" aria-pressed="${selected === id}" style="--pet-color:${def.color}">
      ${petIcon(id, pet?.evolved)}<span><strong>${def.name}</strong><small>${pet ? "Lv. " + petLevel(pet) + " · " : ""}${label}</small></span></button>`;
      })
      .join(""),
  );
  paint($("petProfile"), profileMarkup(selected));
  const pet = camp.pets[selected];
  if (pet) {
    const level = petLevel(pet);
    const status = $("petProgress");
    const ready = $("petCooldown");
    if (status)
      setText(
        status,
        level === 10
          ? "Maximum level"
          : pet.xp + " / " + 10 * level ** 2 + " XP",
      );
    if (ready)
      setText(
        ready,
        "Action · " +
          (pet.cooldown === 0
            ? "Ready, waiting for a target"
            : seconds(pet.cooldown ?? cooldown(selected, pet)) + " remaining"),
      );
    if ($("petLast")) setText($("petLast"), pet.last || "No activity yet.");
  }
  paint(
    $("petArtifactList"),
    Object.entries(artifacts)
      .map(([id, def]) => {
        const owner =
          camp.artifacts.includes(id) &&
          Object.keys(camp.pets).find((key) => camp.pets[key].gear === id);
        return `<p><strong>${def.name}</strong> · ${camp.artifacts.includes(id) ? (owner ? "Held by " + roster[owner].name : "Available") : "Undiscovered"}<br>${def.info}</p>`;
      })
      .join(""),
  );
}

function updatePetTrips(now = Date.now()) {
  const camp = s.companions;
  const slots = tripSlots(s);
  paint(
    $("petTrips"),
    slots
      ? camp.trips
          .slice(0, slots)
          .map((trip, i) => {
            if (!trip)
              return `<div class="pet-assignment"><b>Trip ${i + 1}</b><span>Available</span></div>`;
            const remaining = tripRemaining(trip, now);
            return `<div class="pet-assignment"><b>${routes[trip.route].name}</b><span>${roster[trip.pet].name} · <span id="tripTime-${i}"></span></span>
      ${remaining ? command("cancel", "Cancel", i) : command("claim", "Claim", i, false, true)}</div>`;
          })
          .join("") +
          (slots === 1
            ? `<p class="subtext">Second trip slot unlocks at ${fmtExact(secondTripAt)} earned.</p>`
            : "")
      : `<p class="subtext">Grove Trail unlocks at ${fmtExact(expeditionsAt)} earned.</p>`,
  );
  camp.trips.forEach((trip, i) => {
    const label = $("tripTime-" + i);
    if (trip && label) {
      const remaining = tripRemaining(trip, now);
      setText(label, remaining ? seconds(remaining) : "Ready to claim");
    }
  });
}

function profileMarkup(id) {
  const def = roster[id];
  const camp = s.companions;
  const pet = camp.pets[id];
  const intro = `<header class="pet-profile-head">${petIcon(id, pet?.evolved)}<div><h3>${def.name}</h3>
    <p>${pet ? "Level " + petLevel(pet) + (pet.evolved ? " · Evolved" : "") : def.need}</p></div></header>
    <p>${def.ability} Base cooldown ${def.seconds}s.</p>`;
  if (!pet) return intro;
  const duty = petDuty(s, id);
  const home = duty.type === "home";
  const status =
    duty.type === "field"
      ? "Field slot " + (duty.slot + 1)
      : duty.type === "trip"
        ? "On expedition"
        : "At home";
  const fieldButtons = home
    ? camp.field
        .map((active, i) =>
          i < fieldSlots(s)
            ? command(
                "field",
                "Assign slot " + (i + 1),
                i,
                Boolean(active),
                true,
              )
            : "",
        )
        .join("")
    : duty.type === "field"
      ? command("rest", "Recall to camp")
      : "";
  const spec = `<p><strong>Training</strong> · ${roles[pet.role]}<br>Field Hand cuts cooldowns by 15%. Scout cuts trip time by 20%.</p>
    ${
      home && petLevel(pet) >= 4
        ? command("role", "Field Hand", "field", pet.role === "field") +
          command("role", "Scout", "scout", pet.role === "scout")
        : "<p class='subtext'>Train or retrain at home from level 4.</p>"
    }`;
  const evolve = pet.evolved
    ? ""
    : `<p><strong>Evolution</strong> · Level 5 and 10,000 earned. Cuts cooldowns by 10%.</p>
    ${command("evolve", "Evolve · " + costText(evolutionCost), "", !home || petLevel(pet) < 5 || s.total < 10000 || !hasMaterials(s, evolutionCost))}`;
  const gear = `<p><strong>Artifact</strong> · ${pet.gear ? artifacts[pet.gear].name : "None"}</p>
    ${
      duty.type === "trip"
        ? '<p class="subtext">Equipment stays with a pet on a trip.</p>'
        : camp.artifacts
            .map((gear) => {
              const owner = Object.keys(camp.pets).find(
                (key) => camp.pets[key].gear === gear,
              );
              return command(
                "gear",
                artifacts[gear].name,
                gear,
                pet.gear === gear ||
                  Boolean(owner && petDuty(s, owner).type === "trip"),
              );
            })
            .join("") + (pet.gear ? command("gear", "Unequip artifact") : "")
    }`;
  const expeditions =
    tripSlots(s) && home
      ? `<h4>Expedition routes</h4>${Object.entries(routes)
          .map(([key, route]) => {
            const quote = tripQuote(pet, key);
            const full = camp.trips.slice(0, tripSlots(s)).every(Boolean);
            return `<article class="pet-route"><strong>${route.name} · ${seconds(quote.duration)}</strong><p>${route.requirement}</p>
      <p>${costText(quote.loot)} + ${route.xp} XP${!camp.artifacts.includes(route.artifact) ? " · First clear: " + artifacts[route.artifact].name : ""}</p>
      ${command("send", "Dispatch to " + route.name, key, full || !routeAccess(s, id, key), true)}</article>`;
          })
          .join("")}`
      : "";
  return (
    intro +
    `<div class="pet-actions"><strong>${status}</strong>${fieldButtons}</div><p id="petProgress"></p><p id="petCooldown"></p><p id="petLast"></p>
    <section class="pet-options">${spec}${evolve}${gear}</section>${expeditions}`
  );
}

function companionButton(button, now = Date.now()) {
  const action = button.dataset.petCommand;
  const arg = button.dataset.petArg;
  const id = safePetSelection();
  let message = "";
  if (action === "select" && Object.hasOwn(roster, arg)) {
    runtime.petSelected = arg;
    return { changed: false, message: "" };
  }
  if (action === "field" && assignField(s, id, +arg))
    message = roster[id].name + " joined the field.";
  if (action === "rest" && restPet(s, id))
    message = roster[id].name + " returned to camp.";
  if (action === "gear" && equipArtifact(s, id, arg))
    message = arg ? artifacts[arg].name + " equipped." : "Artifact unequipped.";
  if (action === "role" && specializePet(s, id, arg))
    message = roster[id].name + " trained as " + roles[arg] + ".";
  if (action === "evolve" && evolvePet(s, id))
    message = roster[id].name + " evolved.";
  if (action === "send" && sendPet(s, id, arg, now))
    message = roster[id].name + " departed for " + routes[arg].name + ".";
  if (action === "cancel" && cancelTrip(s, +arg, now))
    message = "Expedition canceled. The companion returned without rewards.";
  if (action === "claim") {
    const reward = claimTrip(s, +arg, now);
    if (reward)
      message =
        "Claimed · " +
        costText(reward.loot) +
        " + " +
        reward.xp +
        " XP" +
        (reward.artifact
          ? " · Discovered " + artifacts[reward.artifact].name + "."
          : ".") + (reward.blueprint ? " Wraithweave blueprint discovered." : "");
  }
  return { changed: Boolean(message), message };
}

function updatePetField() {
  const camp = s.companions;
  for (let i = 0; i < 2; i++) {
    const node = $("fieldPet-" + i);
    const id = camp.field[i];
    setValue(node, "hidden", !id);
    if (!id) {
      if (node.dataset.pet) {
        delete node.dataset.pet;
        delete node.dataset.petId;
        clearTimeout(actionTimers.get(node));
      }
      continue;
    }
    const evolved = camp.pets[id].evolved;
    const key = id + evolved;
    if (node.dataset.pet === key) continue;
    node.dataset.pet = key;
    node.dataset.petId = id;
    node.innerHTML = petIcon(id, evolved);
    node.style.removeProperty("--pet-x");
    node.style.removeProperty("--pet-y");
  }
}

const actionTimers = new WeakMap();

function clearPetActions() {
  for (let index = 0; index < 2; index++) {
    const node = $("fieldPet-" + index);
    clearTimeout(actionTimers.get(node));
    node.style.removeProperty("--pet-x");
    node.style.removeProperty("--pet-y");
  }
}

function animatePetAction(result) {
  const index = s.companions.field.indexOf(result.id);
  const node = $("fieldPet-" + index);
  if (!node) return;
  const locations = {
    button: [50, 48],
    farm: [30, 81],
    mine: [70, 81],
    roam: [index ? 72 : 28, 44],
  };
  const [x, y] = result.opened
    ? [result.opened.chest.x, result.opened.chest.y]
    : locations[result.target];
  node.style.setProperty("--pet-x", x + "%");
  node.style.setProperty("--pet-y", y + "%");
  clearTimeout(actionTimers.get(node));
  const key = node.dataset.pet;
  actionTimers.set(
    node,
    setTimeout(() => {
      if (node.dataset.pet !== key) return;
      node.style.removeProperty("--pet-x");
      node.style.removeProperty("--pet-y");
    }, 1050),
  );
}

export {
  companionMarkup,
  renderCompanions,
  companionButton,
  animatePetAction,
  updatePetTrips,
  clearPetActions,
};
