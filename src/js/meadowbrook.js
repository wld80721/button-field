import { blocked } from "./meadowbrook-map.js";
import { creditCoins, spendResource } from "./resources.js";

export const meadowCrops = {
  turnip: { name: "Turnip", cost: 8, sell: 20, days: 2, color: "#e9e1cb", leaf: "#5e9b47" },
  carrot: { name: "Carrot", cost: 14, sell: 38, days: 3, color: "#e79544", leaf: "#629c45" },
  strawberry: { name: "Berry", cost: 25, sell: 72, days: 4, color: "#e55c60", leaf: "#43863e" },
  pumpkin: { name: "Pumpkin", cost: 40, sell: 120, days: 5, color: "#e49336", leaf: "#4c873e" },
};

export const meadowTools = ["Hand", "Hoe", "Seeds", "Water", "Harvest", "Scythe"];
export const meadowJournal = [
  ["First harvest", "Harvest 3 crops.", "harvest", 3, 45],
  ["Fresh beginnings", "Plant 8 seeds.", "plant", 8, 70],
  ["A growing farm", "Sell 12 crops.", "sold", 12, 120],
  ["Valley farmer", "Harvest 30 crops.", "harvest", 30, 250],
  ["The golden harvest", "Earn 1,000 coins from crop sales.", "earned", 1000, 400],
];

const cropIds = Object.keys(meadowCrops);
const bedKeys = Array.from({ length: 77 }, (_, index) =>
  `${10 + index % 11},${9 + Math.floor(index / 11)}`);
const stockLimit = 9999;
const dayStart = 360;
const dayLimit = 1_000_000;
const morning = () => ({ x: 5.5, y: 6.5 });

export function freshMeadowbrook() {
  const plots = Object.fromEntries(
    bedKeys.map((key) => [key, { tilled: false, water: false, crop: null, growth: 0 }]),
  );
  for (const x of [11, 12, 13]) plots[`${x},10`] = { tilled: true, water: false, crop: "turnip", growth: 2 };
  for (const x of [15, 16, 17]) plots[`${x},10`] = { tilled: true, water: false, crop: "carrot", growth: 1 };
  for (const x of [11, 12, 13]) plots[`${x},12`].tilled = true;
  return {
    day: 1, time: dayStart, energy: 100, weather: "Sunny",
    player: { x: 8.5, y: 9.5 },
    seeds: { turnip: 8, carrot: 4, strawberry: 0, pumpkin: 0 },
    bag: { turnip: 0, carrot: 0, strawberry: 0, pumpkin: 0 },
    plots,
    weeds: { "19,14": true, "10,15": true, "20,11": true },
    progress: { harvest: 0, plant: 0, sold: 0, earned: 0 },
    quest: 0,
  };
}

function bounded(value, min, max, fallback = min) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
}

export function normalizeMeadowbrook(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const farm = freshMeadowbrook();
  farm.day = bounded(raw.day, 1, dayLimit);
  farm.time = bounded(raw.time, dayStart, 1430);
  farm.energy = bounded(raw.energy, 0, 100, 100);
  farm.weather = raw.weather === "Rainy" ? "Rainy" : "Sunny";
  const { x, y } = raw.player ?? {};
  if (Number.isFinite(x) && Number.isFinite(y) && !blocked(Math.floor(x), Math.floor(y))) {
    farm.player = { x, y };
  }
  for (const id of cropIds) {
    farm.seeds[id] = bounded(raw.seeds?.[id], 0, stockLimit, farm.seeds[id]);
    farm.bag[id] = bounded(raw.bag?.[id], 0, stockLimit);
  }
  for (const key of bedKeys) {
    const plot = raw.plots?.[key];
    if (!plot) continue;
    const crop = typeof plot.crop === "string" && Object.hasOwn(meadowCrops, plot.crop) ? plot.crop : null;
    const tilled = plot.tilled === true || Boolean(crop);
    farm.plots[key] = {
      tilled, crop, water: tilled && plot.water === true,
      growth: crop ? bounded(plot.growth, 0, meadowCrops[crop].days) : 0,
    };
  }
  if (raw.weeds && typeof raw.weeds === "object") {
    farm.weeds = Object.fromEntries(bedKeys.filter((key) =>
      raw.weeds[key] === true && !farm.plots[key].crop).map((key) => [key, true]));
  }
  for (const key of Object.keys(farm.progress)) {
    farm.progress[key] = bounded(raw.progress?.[key], 0, Number.MAX_SAFE_INTEGER);
  }
  farm.quest = bounded(raw.quest, 0, meadowJournal.length);
  return farm;
}

function awardJournal(run) {
  const farm = run.meadowbrook;
  let coins = 0;
  while (farm.quest < meadowJournal.length) {
    const [, , counter, goal, reward] = meadowJournal[farm.quest];
    if (farm.progress[counter] < goal) break;
    coins += reward;
    farm.quest++;
  }
  creditCoins(run, coins);
  return coins ? ` Journal reward +${coins} coins.` : "";
}

export function workMeadowPlot(run, key, tool, seed) {
  const farm = run.meadowbrook;
  const plot = Object.hasOwn(farm.plots, key) && farm.plots[key];
  if (!plot) return { message: "Choose a tile in the fenced field." };
  if (farm.weeds[key] && tool !== 5) return { message: "Clear the weeds with the scythe first." };
  const current = meadowCrops[plot.crop];
  const ready = current && plot.growth >= current.days;
  const cost = tool === 1 ? 2 : 1;
  if (tool === 0) {
    if (!current) return { message: plot.tilled ? "Tilled soil. Choose a seed to plant." : "Untilled soil. Use the hoe to prepare it." };
    const growth = ready ? "ripe" : `${plot.growth}/${current.days} days`;
    return { message: `${current.name} · ${growth} · ${plot.water ? "watered" : "dry"}` };
  }
  if (tool === 4) {
    if (!ready) return { message: current ? `${current.name} is still growing.` : "This tile has no crop to harvest." };
    if (farm.bag[plot.crop] >= stockLimit) return { message: "Sell some crops to make room." };
  } else if (tool === 5) {
    if (!farm.weeds[key]) return { message: "There are no weeds here." };
  } else if (tool === 1) {
    if (plot.tilled) return { message: "This soil is already tilled." };
  } else if (tool === 2 || tool === 3) {
    if (!plot.tilled) return { message: "Till the soil first." };
    if (tool === 2 && plot.crop) return { message: "A crop is already growing here." };
    if (tool === 2 && !(farm.seeds[seed] > 0)) return { message: "Buy more seeds at the shop." };
    if (tool === 3 && plot.water) return { message: "Already watered today." };
  } else {
    return { message: "Choose a tool." };
  }
  if (farm.energy < cost) return { message: "Rest at the farmhouse to restore energy." };

  farm.energy -= cost;
  let message;
  switch (tool) {
    case 4:
      farm.bag[plot.crop]++;
      farm.progress.harvest = Math.min(Number.MAX_SAFE_INTEGER, farm.progress.harvest + 1);
      plot.crop = null;
      plot.growth = 0;
      message = `Harvested ${current.name}.`;
      break;
    case 1:
      plot.tilled = true;
      plot.water = farm.weather === "Rainy";
      message = "Soil tilled.";
      break;
    case 2:
      farm.seeds[seed]--;
      plot.crop = seed;
      farm.progress.plant = Math.min(Number.MAX_SAFE_INTEGER, farm.progress.plant + 1);
      message = `Planted ${meadowCrops[seed].name}.`;
      break;
    case 3:
      plot.water = true;
      message = "Soil watered.";
      break;
    case 5:
      delete farm.weeds[key];
      message = "Weeds cleared.";
      break;
  }
  return { changed: true, message: message + awardJournal(run) };
}

export function buyMeadowSeed(run, id, quantity) {
  if (!Object.hasOwn(meadowCrops, id) || ![1, 5].includes(quantity)) return false;
  const farm = run.meadowbrook;
  if (farm.seeds[id] + quantity > stockLimit || !spendResource(run, "coins", meadowCrops[id].cost * quantity)) return false;
  farm.seeds[id] += quantity;
  return true;
}

export function sellMeadowCrops(run) {
  const { bag, progress } = run.meadowbrook;
  let coins = 0;
  let count = 0;
  for (const id of cropIds) {
    coins += bag[id] * meadowCrops[id].sell;
    count += bag[id];
    bag[id] = 0;
  }
  if (!count) return { message: "Harvest crops before selling." };
  creditCoins(run, coins);
  progress.sold = Math.min(Number.MAX_SAFE_INTEGER, progress.sold + count);
  progress.earned = Math.min(Number.MAX_SAFE_INTEGER, progress.earned + coins);
  return { changed: true, message: `Sold ${count} ${count === 1 ? "crop" : "crops"} for ${coins} coins.` + awardJournal(run) };
}

export function sleepAtMeadowbrook(farm, random = Math.random) {
  const rainy = random() < 0.22;
  for (const plot of Object.values(farm.plots)) {
    if (plot.crop && plot.water) plot.growth = Math.min(meadowCrops[plot.crop].days, plot.growth + 1);
    plot.water = rainy && plot.tilled;
  }
  farm.day = Math.min(dayLimit, farm.day + 1);
  farm.time = dayStart;
  farm.energy = 100;
  farm.weather = rainy ? "Rainy" : "Sunny";
  farm.player = morning();
}
