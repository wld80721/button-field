export const W = 52, H = 100, T = 16, GROUND = 5;
export const HOME = { x: 26, y: GROUND - 1 };

export const ores = [
  {
    id: 3,
    name: "Copper",
    color: "#d99153",
    light: "#ffca87",
    dark: "#875139",
    value: 5,
    hp: 0.5,
  },
  {
    id: 4,
    name: "Iron",
    color: "#a9b2b9",
    light: "#e8e3d0",
    dark: "#626c78",
    value: 10,
    hp: 0.74,
  },
  {
    id: 5,
    name: "Gold",
    color: "#e4b84e",
    light: "#fff09a",
    dark: "#9c6b30",
    value: 22,
    hp: 1.05,
  },
  {
    id: 6,
    name: "Amethyst",
    color: "#b17bd8",
    light: "#ebbbff",
    dark: "#684789",
    value: 38,
    hp: 1.35,
  },
  {
    id: 7,
    name: "Ruby",
    color: "#e35969",
    light: "#ffac9e",
    dark: "#893749",
    value: 65,
    hp: 1.75,
  },
  {
    id: 8,
    name: "Diamond",
    color: "#69d6d7",
    light: "#d8ffff",
    dark: "#367d91",
    value: 110,
    hp: 2.2,
  },
];
export const picks = [
    "Stone pickaxe",
    "Copper pickaxe",
    "Iron pickaxe",
    "Steel pickaxe",
    "Crystal pickaxe",
    "Void pickaxe",
  ],
  powers = [1, 1.7, 2.65, 3.9, 5.5, 8],
  pcost = [60, 175, 440, 1000, 2400];
export const bags = [
    "Canvas bag",
    "Leather pack",
    "Miner pack",
    "Steel satchel",
    "Deep vault",
    "Master vault",
  ],
  caps = [12, 24, 40, 64, 100, 150],
  bcost = [45, 130, 320, 720, 1600];
export const lamps = [
    "Oil lantern",
    "Brass lantern",
    "Glow lantern",
    "Crystal lamp",
    "Sunstone lamp",
  ],
  radii = [5, 6, 7, 9, 12],
  lcost = [40, 125, 330, 800];
export const goals = [
  {
    name: "First haul",
    type: "sold",
    ore: 3,
    n: 5,
    reward: 25,
    text: "Sell 5 copper ore.",
  },
  {
    name: "Into the stone",
    type: "depth",
    n: 12,
    reward: 50,
    text: "Reach a depth of 12 m.",
  },
  {
    name: "Iron worker",
    type: "sold",
    ore: 4,
    n: 8,
    reward: 90,
    text: "Sell 8 iron ore.",
  },
  {
    name: "Golden vein",
    type: "sold",
    ore: 5,
    n: 6,
    reward: 160,
    text: "Sell 6 gold ore.",
  },
  {
    name: "Crystal hunter",
    type: "depth",
    n: 42,
    reward: 300,
    text: "Reach a depth of 42 m.",
  },
  {
    name: "Royal jewels",
    type: "sold",
    ore: 7,
    n: 8,
    reward: 500,
    text: "Sell 8 rubies.",
  },
  {
    name: "Heart of the mine",
    type: "depth",
    n: 94,
    reward: 1800,
    text: "Reach the deepest chamber, 94 m.",
  },
  {
    name: "Master miner",
    type: "sold",
    ore: 8,
    n: 15,
    reward: 2500,
    text: "Sell 15 diamonds.",
  },
];
export function hash(x, y, s = 0) {
  let n =
    Math.imul(x + 7919 + s, 374761393) + Math.imul(y + 3571, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function hollowWorld(seed, cleared = []) {
  let a = new Uint8Array(W * H);
  for (let y = GROUND; y < H; y++)
    for (let x = 0; x < W; x++) {
      let d = y - GROUND,
        r = hash(x, y, seed),
        q = hash(x, y, seed + 19),
        id = d < 8 ? (r < 0.75 ? 1 : 2) : 2;
      let pool =
        d < 8
          ? [
              [3, 0.19],
              [4, 0.035],
            ]
          : d < 20
            ? [
                [3, 0.13],
                [4, 0.16],
                [5, 0.035],
              ]
            : d < 36
              ? [
                  [4, 0.13],
                  [5, 0.13],
                  [6, 0.06],
                ]
              : d < 55
                ? [
                    [5, 0.12],
                    [6, 0.14],
                    [7, 0.055],
                  ]
                : d < 74
                  ? [
                      [6, 0.12],
                      [7, 0.15],
                      [8, 0.055],
                    ]
                  : [
                      [7, 0.16],
                      [8, 0.18],
                      [6, 0.06],
                    ];
      let c = 0;
      for (let [o, p] of pool) {
        c += p;
        if (q < c) {
          id = o;
          break;
        }
      }
      if (x === 0 || x === W - 1 || y === H - 1) id = 9;
      a[y * W + x] = id;
    }
  for (let y = 5; y <= 8; y++) a[y * W + 26] = 0;
  for (let [x, y, id] of [
    [25, 6, 3],
    [27, 6, 3],
    [25, 7, 3],
    [27, 8, 3],
    [26, 9, 3],
    [24, 8, 4],
    [28, 9, 3],
    [26, 10, 3],
  ])
    a[y * W + x] = id;
  for (const index of cleared) a[index] = 0;
  return a;
}

export function hollowTile(board, x, y) {
  return x < 0 || x >= W || y < GROUND - 1 || y >= H ? 9 : board[y * W + x];
}
