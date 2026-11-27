import { milestones } from "./data.js";

const firstWorld = "grasslands";
const worlds = {
  grasslands: {
    name: "Grasslands",
    at: milestones.start,
    accent: "#a3ec82",
    mechanic: "Wild Growth",
    limit: 25,
    description: "Every 25 presses guarantees a chest as soon as there’s room.",
  },
  desert: {
    name: "Desert",
    at: milestones.ascension,
    accent: "#ffd38b",
    mechanic: "Dune Surge",
    limit: 12,
    description: "Every 12th press pays 4× its usual coins.",
    gearBonus: "Each piece adds 0.5× to Dune Surge.",
    gear: [
      "Dunewalker Gloves",
      "Oasis Ring",
      "Sandstrider Boots",
      "Scarab Charm",
    ],
    gearScale: 1.25,
    terrain: {
      tiles: [
        "#a9673d",
        "#b97945",
        "#c28448",
        "#cd904e",
        "#d59b58",
        "#e0aa65",
        "#ba814e",
      ],
      edges: ["#6b4147", "#704748", "#805044"],
      border: "#4a353e",
      grain: "#6f442644",
      mark: "#536746",
      shine: "#a7bf65",
      shape: [
        [5, 3, 2, 9],
        [2, 6, 3, 2],
        [8, 4, 3, 2],
        [9, 2, 2, 3],
      ],
    },
  },
  frozen: {
    name: "Frozen Lands",
    at: milestones.frozen,
    accent: "#b5eeff",
    mechanic: "Thaw",
    limit: 10,
    description:
      "Every 10 presses releases 5 seconds of automatic income. The charge waits if your automatic income is zero.",
    gearBonus: "Each piece adds 1 second of income to Thaw.",
    gear: [
      "Rimeweave Gloves",
      "Glacier Ring",
      "Snowstep Boots",
      "Aurora Charm",
    ],
    gearScale: 1.5,
    terrain: {
      tiles: [
        "#407694",
        "#5d94ac",
        "#6fa5ba",
        "#89bbcd",
        "#94c5d5",
        "#abd4e0",
        "#588fa8",
      ],
      edges: ["#274a69", "#2b5271", "#355f7d"],
      border: "#1c3655",
      grain: "#2c688947",
      mark: "#3f8aaa",
      shine: "#ddfaff",
      shape: [
        [5, 2, 2, 10],
        [2, 6, 8, 2],
        [3, 4, 2, 2],
        [7, 8, 2, 2],
      ],
    },
  },
  volcano: {
    name: "Volcano",
    at: milestones.volcano,
    accent: "#ff9e70",
    mechanic: "Forge Heat",
    limit: 16,
    description:
      "Opening a chest, including with Auto Chest, doubles your next 8 presses here.",
    gearBonus: "Each piece adds 2 presses to the heat from a chest.",
    gear: [
      "Emberforge Gloves",
      "Obsidian Ring",
      "Cinderstep Boots",
      "Magma Charm",
    ],
    gearScale: 1.8,
    terrain: {
      tiles: [
        "#49363f",
        "#523c42",
        "#633e46",
        "#674345",
        "#714744",
        "#805047",
        "#5e3b44",
      ],
      edges: ["#362831", "#38282c", "#4a2932"],
      border: "#231a27",
      grain: "#240f274f",
      mark: "#b9533e",
      shine: "#ffae59",
      shape: [
        [2, 7, 5, 2],
        [6, 4, 2, 4],
        [7, 3, 5, 2],
        [10, 2, 4, 1],
      ],
    },
  },
  celestial: {
    name: "Celestial Realm",
    at: milestones.celestial,
    accent: "#dfbfff",
    mechanic: "Starlight",
    limit: 20,
    description:
      "After 20 presses, your next chest from pressing gains one rarity tier, up to Legendary.",
    gearBonus: "Two pieces make Starlight grant two rarity tiers.",
    gear: [
      "Astralweave Gloves",
      "Orbit Ring",
      "Cometstride Boots",
      "Nova Charm",
    ],
    gearScale: 2.1,
    terrain: {
      tiles: [
        "#353261",
        "#3e396e",
        "#473b7d",
        "#514383",
        "#5a488d",
        "#624e98",
        "#3e437a",
      ],
      edges: ["#23233d", "#252246", "#2d294f"],
      border: "#16182d",
      grain: "#a28fc248",
      mark: "#a891cf",
      shine: "#f8deff",
      shape: [
        [5, 2, 1, 9],
        [1, 6, 9, 1],
        [3, 4, 5, 5],
        [10, 2, 1, 1],
      ],
    },
  },
};

function recordWorld(entry) {
  const id = entry.world;
  return typeof id === "string" && Object.hasOwn(worlds, id) ? id : firstWorld;
}

function worldTag(id) {
  return id === firstWorld ? {} : { world: id };
}

function discoveryKey(slot, rarityIndex, id) {
  const design = slot + "-" + rarityIndex;
  return id === firstWorld ? design : id + ":" + design;
}

export { discoveryKey, firstWorld, recordWorld, worldTag, worlds };
