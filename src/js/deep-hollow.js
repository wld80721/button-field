import {
  GROUND, H, HOME, W, bags, bcost, caps, goals, hollowTile, hollowWorld,
  lamps, lcost, ores, pcost, picks, powers, radii,
} from "./deep-hollow-map.js";
import { creditCoins, creditResource, spendResource } from "./resources.js";

const seedMax = 999_999;
const countLimit = Number.MAX_SAFE_INTEGER;

export const hollowUpgrades = {
  pick: { names: picks, costs: pcost, detail: (level) => `Power ×${powers[level]}` },
  bag: { names: bags, costs: bcost, detail: (level) => `${caps[level]} slots` },
  lamp: { names: lamps, costs: lcost, detail: (level) => `Light radius ${radii[level]}` },
};

export function freshDeepHollow(seed = Math.floor(Math.random() * (seedMax + 1))) {
  return {
    seed, cleared: [], ...HOME, deep: { ...HOME },
    inv: ores.map(() => 0), sold: ores.map(() => 0),
    pick: 0, bag: 0, lamp: 0, goal: 0,
  };
}

function bounded(value, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
}

function emptyPosition(board, position) {
  const { x, y } = position ?? {};
  return Number.isInteger(x) && Number.isInteger(y) &&
    x >= 1 && x < W - 1 && y >= HOME.y && y < H - 1 && hollowTile(board, x, y) === 0;
}

export function normalizeDeepHollow(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const mine = freshDeepHollow(bounded(raw.seed, seedMax));
  const board = hollowWorld(mine.seed);
  if (Array.isArray(raw.cleared)) {
    for (const index of raw.cleared) {
      if (!Number.isInteger(index) || !board[index] || board[index] === 9) continue;
      board[index] = 0;
      mine.cleared.push(index);
    }
  }
  if (emptyPosition(board, raw)) {
    mine.x = raw.x;
    mine.y = raw.y;
  }
  if (emptyPosition(board, raw.deep) && raw.deep.y >= mine.y) mine.deep = { x: raw.deep.x, y: raw.deep.y };
  else mine.deep = { x: mine.x, y: mine.y };
  for (const [id, def] of Object.entries(hollowUpgrades)) mine[id] = bounded(raw[id], def.names.length - 1);
  let room = caps[mine.bag];
  for (let i = 0; i < ores.length; i++) {
    mine.inv[i] = bounded(raw.inv?.[i], room);
    room -= mine.inv[i];
    mine.sold[i] = bounded(raw.sold?.[i], countLimit);
  }
  mine.goal = bounded(raw.goal, goals.length);
  return mine;
}

export const hollowAtCamp = (mine) => mine.y < GROUND;
export const hollowDepth = (y) => Math.max(0, y - GROUND + 1);
export const hollowCount = (mine) => mine.inv.reduce((sum, quantity) => sum + quantity, 0);
export const hollowValue = (mine) => ores.reduce((sum, ore, index) => sum + mine.inv[index] * ore.value, 0);
export const hollowCapacity = (mine) => caps[mine.bag];
export const hollowGoalValue = (mine, goal) => goal.type === "depth" ? hollowDepth(mine.deep.y) : mine.sold[goal.ore - 3];

function awardContracts(run) {
  const mine = run.deepHollow;
  let reward = 0;
  while (mine.goal < goals.length && hollowGoalValue(mine, goals[mine.goal]) >= goals[mine.goal].n) {
    reward += goals[mine.goal].reward;
    mine.goal++;
  }
  creditCoins(run, reward);
  return reward;
}

export function hollowTarget(mine, board, dx, dy) {
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1) return null;
  const x = mine.x + dx;
  const y = mine.y + dy;
  if (x < 1 || x >= W - 1 || y < HOME.y || y >= H - 1) return null;
  const id = hollowTile(board, x, y);
  if (id === 9) return null;
  const hardness = id === 0 ? 0 : id === 1 ? 0.22 : id === 2 ? 0.48 : ores[id - 3].hp;
  const seconds = hardness * (1 + Math.max(0, hollowDepth(mine.y) - 20) * 0.009) / powers[mine.pick];
  return { x, y, id, seconds, blocked: id >= 3 && hollowCount(mine) >= caps[mine.bag] };
}

export function finishHollowTile(run, board, target) {
  const mine = run.deepHollow;
  const reachable = hollowTarget(mine, board, target.x - mine.x, target.y - mine.y);
  if (!reachable || reachable.id !== target.id || reachable.blocked) return null;
  const { x, y, id } = reachable;
  if (id) {
    const index = y * W + x;
    board[index] = 0;
    mine.cleared.push(index);
    if (id >= 3) mine.inv[id - 3]++;
  }
  mine.x = x;
  mine.y = y;
  if (y > mine.deep.y) mine.deep = { x, y };
  return { id, reward: awardContracts(run) };
}

export function sellHollowHaul(run) {
  const mine = run.deepHollow;
  if (!hollowAtCamp(mine) || !hollowCount(mine)) return null;
  const coins = hollowValue(mine);
  mine.inv.forEach((quantity, i) => {
    mine.sold[i] = Math.min(countLimit, mine.sold[i] + quantity);
    mine.inv[i] = 0;
  });
  creditCoins(run, coins);
  return { coins, reward: awardContracts(run) };
}

export function bankHollowCopper(run) {
  const mine = run.deepHollow;
  if (!hollowAtCamp(mine) || !mine.inv[0]) return 0;
  const copper = mine.inv[0];
  creditResource(run, "copperOre", copper);
  mine.inv[0] = 0;
  return copper;
}

export function upgradeHollow(run, id) {
  const mine = run.deepHollow;
  if (!hollowAtCamp(mine) || !Object.hasOwn(hollowUpgrades, id)) return false;
  const cost = hollowUpgrades[id].costs[mine[id]];
  if (cost === undefined || !spendResource(run, "coins", cost)) return false;
  mine[id]++;
  return true;
}

export function rideHollowLift(mine) {
  const camp = hollowAtCamp(mine);
  if (camp && !hollowDepth(mine.deep.y)) return false;
  const destination = camp ? mine.deep : HOME;
  mine.x = destination.x;
  mine.y = destination.y;
  return true;
}
