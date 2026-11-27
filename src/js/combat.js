import { bosses, combatSets } from "./boss-data.js";
import { discover, lootValue } from "./build-gear.js";
import { petLevel, roster } from "./companions.js";
import { milestones, rarity } from "./data.js";
import { addGearItem, gearValue } from "./gear.js";
import { fieldLevel, gearBagLimit, nextEntityId } from "./gameplay.js";
import { worldTag } from "./world-data.js";

const assistInterval = 8000;
const maxFightTime = 86400000;
const freshCombat = () => ({ records: {}, clears: {}, attempt: null });
const known = (id) => Object.hasOwn(bosses, id);
const bound = (value, max) =>
  Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;
const rank = (value, max) => Math.floor(bound(value, max));

function combatLoadout(state, gear) {
  const gearBonus = Math.min(
    10,
    Math.floor(2 * Math.log2(1 + gearValue(gear[0]) + gearValue(gear[1]) / 8)),
  );
  const workshop = Math.min(4, Math.floor(state.up.power / 3));
  const skills =
    2 * Number(state.skills.force > 0) + Number(state.skills.sun > 0);
  const sets = Object.fromEntries(
    Object.keys(combatSets).map((set) => [
      set,
      gear.filter((item) => item?.set === set).length,
    ]),
  );
  const pets = state.companions.field.filter(Boolean).map((id) => {
    const pet = state.companions.pets[id];
    const action = roster[id].action;
    const role = ["grow", "harvest"].includes(action)
      ? "heal"
      : ["mine", "recover", "hybrid"].includes(action)
        ? "break"
        : "strike";
    return {
      id,
      role,
      power: 2 + Math.floor(petLevel(pet) / 3) + Number(pet.evolved) * 2,
      ready: false,
    };
  });
  return {
    gearBonus,
    workshop,
    skills,
    sets,
    pets,
    damage: 4 + gearBonus + workshop + skills,
    maxHp: state.skills.star > 0 ? 115 : 100,
    echo: state.skills.echo > 0 ? 2 : 0,
  };
}

function bossAccess(state, id) {
  if (!known(id) || state.total < milestones.combat) return false;
  const def = bosses[id];
  return (
    state.world === def.world &&
    state.total >= def.at &&
    (!def.requires || Boolean(state.combat.clears[def.requires]))
  );
}

function startFight(state, id, gear) {
  if (state.combat.attempt || !bossAccess(state, id)) return false;
  const def = bosses[id];
  const loadout = combatLoadout(state, gear);
  state.combat.attempt = {
    id,
    hp: def.hp,
    playerHp: loadout.maxHp,
    time: 0,
    phase: 0,
    step: 0,
    mode: "open",
    remaining: def.phases[0][0].opening,
    guarded: false,
    hits: 0,
    heat: 0,
    streak: 0,
    armorBreak: false,
    exposed: 0,
    riposte: 0,
    pierce: 0,
    assist: assistInterval,
    loadout,
  };
  return true;
}

const currentMove = (attempt) =>
  bosses[attempt.id].phases[attempt.phase][attempt.step];

function startWarning(attempt, events) {
  const move = currentMove(attempt);
  attempt.mode = "warn";
  attempt.remaining = move.warning;
  attempt.guarded = false;
  attempt.hits = 0;
  attempt.streak = 0;
  attempt.armorBreak = false;
  events.push({ type: "warning", name: move.name });
}

function nextMove(attempt, events) {
  const def = bosses[attempt.id];
  const nextPhase =
    attempt.id === "orrery" && attempt.hp <= def.hp * 0.7
      ? attempt.hp <= def.hp * 0.35
        ? 2
        : 1
      : 0;
  attempt.step =
    nextPhase !== attempt.phase
      ? 0
      : (attempt.step + 1) % def.phases[attempt.phase].length;
  if (nextPhase !== attempt.phase)
    events.push({ type: "phase", phase: nextPhase });
  attempt.phase = nextPhase;
  attempt.mode = "open";
  attempt.guarded = false;
  attempt.heat = 0;
  attempt.remaining = currentMove(attempt).opening;
  if (!attempt.remaining) startWarning(attempt, events);
}

function guardFight(state) {
  const attempt = state.combat.attempt;
  if (
    !attempt ||
    attempt.mode !== "warn" ||
    attempt.guarded ||
    !currentMove(attempt).damage
  )
    return false;
  attempt.guarded = true;
  return true;
}

function heal(attempt, amount) {
  const gain = Math.min(amount, attempt.loadout.maxHp - attempt.playerHp);
  attempt.playerHp += gain;
  return gain;
}

function settleAttack(state, attempt, events) {
  const move = currentMove(attempt);
  if (move.kind === "bloom" && attempt.hits < 4) {
    const def = bosses[attempt.id];
    const healed = Math.min(def.hp - attempt.hp, Math.ceil(def.hp * 0.08));
    attempt.hp += healed;
    if (healed) events.push({ type: "bossHeal", amount: healed });
  }
  if (move.damage && attempt.guarded) {
    const ward = attempt.loadout.sets.wardweaver >= 4;
    attempt.riposte = (ward ? 12 : 6) + attempt.loadout.echo;
    if (attempt.loadout.sets.starbound >= 2) attempt.pierce = 2;
    if (move.kind === "crack") attempt.armorBreak = true;
    if (move.kind === "expose") attempt.exposed = 2000;
    let recovery = ward ? 8 : 0;
    for (const pet of attempt.loadout.pets) {
      if (!pet.ready || pet.role !== "heal") continue;
      recovery += pet.power;
      pet.ready = false;
    }
    events.push({ type: "block", amount: heal(attempt, recovery) });
  } else if (move.damage) {
    const base = move.damage + (move.kind === "vent" ? attempt.heat * 2 : 0);
    const amount =
      attempt.loadout.sets.wardweaver >= 2 ? Math.ceil(base * 0.7) : base;
    if (damagePlayer(state, attempt, amount, events)) return;
  }
  nextMove(attempt, events);
}

function damagePlayer(state, attempt, amount, events) {
  const lost = Math.min(attempt.playerHp, amount);
  attempt.playerHp -= lost;
  events.push({ type: "hurt", amount: lost });
  if (attempt.playerHp > 0) return false;
  state.combat.attempt = null;
  events.push({ type: "defeat", id: attempt.id });
  return true;
}

function advanceFight(state, elapsed) {
  const events = [];
  let left = bound(elapsed, 1000);
  while (state.combat.attempt && left > 0) {
    const attempt = state.combat.attempt;
    const span = Math.min(left, attempt.remaining);
    left -= span;
    attempt.remaining -= span;
    attempt.time = Math.min(maxFightTime, attempt.time + span);
    attempt.exposed = Math.max(0, attempt.exposed - span);
    attempt.assist -= span;
    if (attempt.assist <= 0) {
      attempt.assist += assistInterval;
      for (const pet of attempt.loadout.pets) pet.ready = true;
    }
    if (attempt.remaining > 0) break;
    if (attempt.mode === "open") startWarning(attempt, events);
    else settleAttack(state, attempt, events);
  }
  return events;
}

function strikeBoss(state) {
  const attempt = state.combat.attempt;
  if (!attempt) return [];
  const events = [];
  const move = currentMove(attempt);
  const warning = attempt.mode === "warn";
  const ice =
    attempt.id === "rimeback" ||
    (attempt.id === "orrery" && attempt.phase === 0);
  const armor =
    ice && !attempt.armorBreak
      ? 0.4
      : attempt.id === "weaver"
        ? warning
          ? 0.55
          : 0.7
        : warning && move.kind === "shell"
          ? 0.5
          : warning && move.kind === "cloak"
            ? 0.4
            : 1;
  const { loadout } = attempt;
  let amount = loadout.damage;
  if (loadout.sets.vanguard >= 2) amount *= 1.2;
  if (!warning && loadout.sets.vanguard >= 4 && ++attempt.streak === 5) {
    amount += 10;
    attempt.streak = 0;
  }
  amount += attempt.riposte;
  attempt.riposte = 0;
  for (const pet of loadout.pets) {
    if (!pet.ready || pet.role === "heal") continue;
    amount += pet.power * (pet.role === "break" && armor < 1 ? 2 : 1);
    pet.ready = false;
  }
  if (attempt.pierce > 0) attempt.pierce--;
  else amount *= armor;
  if (attempt.exposed > 0) amount *= 1.25;

  const damage = Math.min(attempt.hp, Math.max(1, Math.round(amount)));
  attempt.hp -= damage;
  events.push({ type: "strike", amount: damage });
  if (attempt.hp === 0) {
    const old = state.combat.records[attempt.id];
    const time = Math.max(1, Math.round(attempt.time));
    state.combat.records[attempt.id] = {
      wins: Math.min(Number.MAX_SAFE_INTEGER, (old?.wins || 0) + 1),
      best: Math.min(time, old?.best ?? time),
    };
    const reward = !state.combat.clears[attempt.id];
    if (reward) state.combat.clears[attempt.id] = "unclaimed";
    state.combat.attempt = null;
    events.push({ type: "victory", id: attempt.id, reward });
    return events;
  }
  if (warning) {
    const reflects = move.kind === "reflect" && attempt.hits < 4;
    attempt.hits = Math.min(4, attempt.hits + 1);
    if (reflects) damagePlayer(state, attempt, 5, events);
    if (move.kind === "interrupt" && attempt.hits === 3) {
      attempt.exposed = 2000;
      events.push({ type: "interrupt" });
      nextMove(attempt, events);
    }
  } else if (move.kind === "vent" && ++attempt.heat === 8) {
    startWarning(attempt, events);
  }
  return events;
}

function retreatFight(state) {
  if (!state.combat.attempt) return false;
  state.combat.attempt = null;
  return true;
}

function claimBossGear(state, id) {
  if (
    !known(id) ||
    state.combat.clears[id] !== "unclaimed" ||
    state.items.length >= gearBagLimit
  )
    return null;
  const def = bosses[id];
  const { set, slot } = def.reward;
  const r = combatSets[set].baseRarity;
  const level = fieldLevel({ total: def.at });
  const item = {
    id: nextEntityId(state),
    set,
    slot,
    r,
    level,
    value: lootValue(def.world, level, slot, rarity[r].scale),
    ...worldTag(def.world),
    locked: true,
  };
  addGearItem(state, item);
  discover(state, item);
  state.combat.clears[id] = "claimed";
  return item;
}

function normalizeCombat(state, raw) {
  const combat = state.combat;
  for (const id of Object.keys(bosses)) {
    const record = raw?.records?.[id];
    const wins = rank(record?.wins, Number.MAX_SAFE_INTEGER);
    const best = rank(record?.best, maxFightTime);
    if (wins && best) combat.records[id] = { wins, best };
    const clear = raw?.clears?.[id];
    if (combat.records[id] && ["unclaimed", "claimed"].includes(clear))
      combat.clears[id] = clear;
  }
  const a = raw?.attempt;
  if (
    !a ||
    !bossAccess(state, a.id) ||
    !a.loadout ||
    !["open", "warn"].includes(a.mode)
  )
    return;
  const def = bosses[a.id];
  const maxHp = a.loadout.maxHp === 115 ? 115 : 100;
  const hp = rank(a.hp, def.hp);
  const playerHp = rank(a.playerHp, maxHp);
  if (!hp || !playerHp) return;
  const phase = rank(a.phase, def.phases.length - 1);
  const step = rank(a.step, def.phases[phase].length - 1);
  const move = def.phases[phase][step];
  const gearBonus = rank(a.loadout.gearBonus, 10);
  const workshop = rank(a.loadout.workshop, 4);
  const skills = rank(a.loadout.skills, 3);
  const ids = new Set();
  const pets = Array.isArray(a.loadout.pets)
    ? a.loadout.pets.slice(0, 2).flatMap((pet) => {
        if (
          !pet ||
          !Object.hasOwn(state.companions.pets, pet.id) ||
          ids.has(pet.id) ||
          !["strike", "heal", "break"].includes(pet.role)
        )
          return [];
        ids.add(pet.id);
        return [
          {
            id: pet.id,
            role: pet.role,
            power: rank(pet.power, 7),
            ready: pet.ready === true,
          },
        ];
      })
    : [];
  combat.attempt = {
    id: a.id,
    hp,
    playerHp,
    phase,
    step,
    mode: a.mode,
    time: bound(a.time, maxFightTime),
    remaining: bound(
      a.remaining,
      a.mode === "open" ? move.opening : move.warning,
    ),
    guarded: a.mode === "warn" && Boolean(move.damage) && a.guarded === true,
    hits: rank(a.hits, 4),
    heat: rank(a.heat, 8),
    streak: rank(a.streak, 4),
    armorBreak: a.armorBreak === true,
    exposed: bound(a.exposed, 2000),
    riposte: rank(a.riposte, 14),
    pierce: rank(a.pierce, 2),
    assist: bound(a.assist, assistInterval),
    loadout: {
      gearBonus,
      workshop,
      skills,
      damage: 4 + gearBonus + workshop + skills,
      sets: Object.fromEntries(
        Object.entries(combatSets).map(([id, set]) => [
          id,
          rank(a.loadout.sets?.[id], set.rewardSlots.length),
        ]),
      ),
      pets,
      maxHp,
      echo: rank(a.loadout.echo, 2),
    },
  };
}

function keepCombat(state) {
  return {
    ...freshCombat(),
    records: Object.fromEntries(
      Object.entries(state.combat.records).map(([id, record]) => [
        id,
        { ...record },
      ]),
    ),
  };
}

export {
  advanceFight,
  bossAccess,
  claimBossGear,
  combatLoadout,
  currentMove,
  freshCombat,
  guardFight,
  keepCombat,
  normalizeCombat,
  retreatFight,
  startFight,
  strikeBoss,
};
